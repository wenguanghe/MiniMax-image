const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const GENERATED_DIR = path.join(__dirname, 'generated');
if (!fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

const config = {
  modelUrl: '',
  modelName: '',
  apiKey: '',
  apiFormat: 'auto',
  concurrency: 3,
  retryMax: 3,
  isPaused: false,
};

const tasks = new Map();
const queue = [];
let processingCount = 0;
let schedulerTimer = null;

function generateId() {
  return crypto.randomUUID();
}

function detectApiFormat(url, modelName) {
  if (url.includes('/services/aigc/') || url.includes('multimodal-generation')) {
    return 'qwen';
  }
  if (modelName && modelName.toLowerCase().includes('qwen')) {
    return 'qwen';
  }
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host.includes('dashscope') || host.includes('ctaigw') || host.includes('aliyuncs')) {
      return 'qwen';
    }
  } catch {}
  return 'openai';
}

function buildOpenaiRequestBody(prompt, modelName, imageSize) {
  return {
    model: modelName,
    prompt: prompt,
    n: 1,
    size: imageSize || '1024x1024',
    response_format: 'b64_json',
  };
}

function buildQwenRequestBody(prompt, modelName, imageSize) {
  const size = (imageSize || '1024x1024').replace('x', '*');
  return {
    model: modelName,
    input: {
      messages: [
        {
          role: 'user',
          content: [
            { text: prompt }
          ]
        }
      ]
    },
    parameters: {
      n: 1,
      size: size,
      prompt_extend: true,
      watermark: false,
    }
  };
}

function extractImageUrl(data, apiFormat) {
  if (apiFormat === 'qwen') {
    const results = data?.output?.results;
    if (results && results.length > 0) {
      const result = results[0];
      if (result.url) return result.url;
      if (result.image) return result.image;
      if (result.b64_image) return { b64_json: result.b64_image };
    }

    const choices = data?.output?.choices;
    if (choices && choices.length > 0) {
      const choice = choices[0];
      const content = choice?.message?.content;
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.url) return item.url;
          if (item.image) return item.image;
          if (item.b64_image) return { b64_json: item.b64_image };
        }
      }
      if (typeof content === 'string') {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item.url) return item.url;
              if (item.image) return item.image;
              if (item.b64_image) return { b64_json: item.b64_image };
            }
          }
        } catch {}
      }
    }
  }

  if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
    const item = data.data[0];
    if (item.b64_json) return { b64_json: item.b64_json };
    if (item.url) return item.url;
  }

  if (data?.url) return data.url;
  if (data?.b64_json) return { b64_json: data.b64_json };

  return null;
}

function createTask(prompt, imageSize) {
  const task = {
    id: generateId(),
    prompt,
    status: 'pending',
    progress: 0,
    retryCount: 0,
    retryMax: config.retryMax,
    imageSize,
    imageUrl: null,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  tasks.set(task.id, task);
  queue.push(task.id);
  return task;
}

async function processTask(taskId) {
  const task = tasks.get(taskId);
  if (!task || task.status === 'cancelled') return;

  task.status = 'processing';
  task.progress = 10;
  task.updatedAt = Date.now();

  try {
    if (!config.modelUrl || !config.modelName || !config.apiKey) {
      throw new Error('请先配置API参数');
    }

    const apiFormat = detectApiFormat(config.modelUrl, config.modelName);

    const apiUrl = config.modelUrl;
    console.log(`[Task ${taskId.substring(0, 8)}] 格式: ${apiFormat}, URL: ${apiUrl}`);
    console.log(`[Task ${taskId.substring(0, 8)}] 模型: ${config.modelName}, 尺寸: ${task.imageSize}`);

    task.progress = 30;
    task.updatedAt = Date.now();

    let requestBody;
    if (apiFormat === 'qwen') {
      requestBody = buildQwenRequestBody(task.prompt, config.modelName, task.imageSize);
    } else {
      requestBody = buildOpenaiRequestBody(task.prompt, config.modelName, task.imageSize);
    }

    console.log(`[Task ${taskId.substring(0, 8)}] 请求体:`, JSON.stringify(requestBody).substring(0, 300));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      timeout: 180000,
    });

    task.progress = 70;
    task.updatedAt = Date.now();

    console.log(`[Task ${taskId.substring(0, 8)}] 响应状态: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[Task ${taskId.substring(0, 8)}] 错误响应: ${errorText.substring(0, 500)}`);
      let errorMsg = `HTTP错误: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData?.error?.message || errorData?.message || errorData?.error?.code || errorData?.message || errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const debugPath = path.join(GENERATED_DIR, `_debug_response_${taskId.substring(0, 8)}.json`);
    fs.writeFileSync(debugPath, JSON.stringify(data, null, 2));
    console.log(`[Task ${taskId.substring(0, 8)}] 响应数据已保存: ${debugPath}`);
    console.log(`[Task ${taskId.substring(0, 8)}] 响应数据:`, JSON.stringify(data).substring(0, 800));

    let imageUrl = null;

    const imageResult = extractImageUrl(data, apiFormat);
    if (!imageResult) {
      throw new Error('API未返回图片数据');
    }
    if (typeof imageResult === 'string') {
      console.log(`[Task ${taskId.substring(0, 8)}] 图片URL: ${imageResult.substring(0, 100)}...`);
      try {
        const imgResponse = await fetch(imageResult, { timeout: 60000 });
        if (imgResponse.ok) {
          const buffer = await imgResponse.buffer();
          const fileName = `${task.id}.png`;
          const filePath = path.join(GENERATED_DIR, fileName);
          fs.writeFileSync(filePath, buffer);
          imageUrl = `/api/images/${task.id}`;
          console.log(`[Task ${taskId.substring(0, 8)}] 图片已下载保存: ${fileName} (${(buffer.length / 1024).toFixed(1)}KB)`);
        } else {
          imageUrl = imageResult;
          console.log(`[Task ${taskId.substring(0, 8)}] 图片下载失败(${imgResponse.status}), 使用原始URL`);
        }
      } catch (downloadErr) {
        imageUrl = imageResult;
        console.log(`[Task ${taskId.substring(0, 8)}] 图片下载异常: ${downloadErr.message}, 使用原始URL`);
      }
    } else if (imageResult.b64_json) {
      const buffer = Buffer.from(imageResult.b64_json, 'base64');
      const fileName = `${task.id}.png`;
      const filePath = path.join(GENERATED_DIR, fileName);
      fs.writeFileSync(filePath, buffer);
      imageUrl = `/api/images/${task.id}`;
      console.log(`[Task ${taskId.substring(0, 8)}] 图片已保存: ${fileName} (${(buffer.length / 1024).toFixed(1)}KB)`);
    }

    task.status = 'completed';
    task.progress = 100;
    task.imageUrl = imageUrl;
    task.updatedAt = Date.now();
    console.log(`[Task ${taskId.substring(0, 8)}] 完成!`);

  } catch (error) {
    task.error = error.message;
    task.updatedAt = Date.now();
    console.log(`[Task ${taskId.substring(0, 8)}] 失败: ${error.message}`);

    if (task.retryCount < task.retryMax) {
      task.retryCount++;
      task.status = 'retrying';
      task.progress = 0;

      const delay = Math.pow(2, task.retryCount) * 1000;
      console.log(`[Task ${taskId.substring(0, 8)}] 将在 ${delay / 1000}s 后重试 (${task.retryCount}/${task.retryMax})`);
      setTimeout(() => {
        if (tasks.has(task.id) && tasks.get(task.id).status === 'retrying') {
          queue.unshift(task.id);
          scheduleNext();
        }
      }, delay);
    } else {
      task.status = 'failed';
      task.progress = 0;
      console.log(`[Task ${taskId.substring(0, 8)}] 已达最大重试次数，标记为失败`);
    }
  } finally {
    processingCount--;
    scheduleNext();
  }
}

function scheduleNext() {
  if (config.isPaused) return;
  if (processingCount >= config.concurrency) return;
  if (queue.length === 0) {
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
    return;
  }

  while (processingCount < config.concurrency && queue.length > 0) {
    const taskId = queue.shift();
    const task = tasks.get(taskId);
    if (!task || task.status === 'cancelled') continue;
    processingCount++;
    processTask(taskId);
  }

  if (!schedulerTimer && queue.length > 0) {
    schedulerTimer = setInterval(() => {
      if (queue.length === 0) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
        return;
      }
      scheduleNext();
    }, 500);
  }
}

app.post('/api/config/test', async (req, res) => {
  try {
    const { modelUrl, modelName, apiKey, apiFormat } = req.body;
    if (!modelUrl || !modelName || !apiKey) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    const format = apiFormat === 'auto' ? detectApiFormat(modelUrl, modelName) : (apiFormat || 'openai');
    console.log(`[Config Test] 格式: ${format}, URL: ${modelUrl}`);

    let requestBody;
    if (format === 'qwen') {
      requestBody = buildQwenRequestBody('test', modelName, '512*512');
    } else {
      requestBody = buildOpenaiRequestBody('test', modelName, '256x256');
    }

    const response = await fetch(modelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      timeout: 30000,
    });

    console.log(`[Config Test] 响应状态: ${response.status}`);

    if (response.ok) {
      res.json({ success: true, message: `连接成功 (格式: ${format})` });
    } else {
      const errorText = await response.text();
      console.log(`[Config Test] 错误: ${errorText.substring(0, 300)}`);
      let errorMsg = `HTTP错误: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData?.error?.message || errorData?.message || errorData?.error?.code || errorMsg;
      } catch {}
      res.json({ success: false, message: `${errorMsg} (格式: ${format})` });
    }
  } catch (error) {
    console.log(`[Config Test] 异常: ${error.message}`);
    res.json({ success: false, message: `连接失败: ${error.message}` });
  }
});

app.post('/api/config/save', (req, res) => {
  const { modelUrl, modelName, apiKey, apiFormat, concurrency, retryMax } = req.body;
  if (modelUrl !== undefined) config.modelUrl = modelUrl;
  if (modelName !== undefined) config.modelName = modelName;
  if (apiKey !== undefined) config.apiKey = apiKey;
  if (apiFormat !== undefined) config.apiFormat = apiFormat;
  if (concurrency !== undefined) config.concurrency = Math.max(1, Math.min(10, concurrency));
  if (retryMax !== undefined) config.retryMax = Math.max(0, Math.min(10, retryMax));
  console.log(`[Config] 已保存 - URL: ${config.modelUrl}, 模型: ${config.modelName}, 格式: ${config.apiFormat}, 并发: ${config.concurrency}`);
  res.json({ success: true, config: { ...config, apiKey: '***' } });
});

app.get('/api/config', (req, res) => {
  res.json({
    modelUrl: config.modelUrl,
    modelName: config.modelName,
    apiKey: config.apiKey ? '***' : '',
    apiFormat: config.apiFormat,
    concurrency: config.concurrency,
    retryMax: config.retryMax,
    isPaused: config.isPaused,
  });
});

app.post('/api/queue/add', (req, res) => {
  const { prompts, imageSize, count } = req.body;

  if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
    return res.status(400).json({ error: '请提供至少一条提示词' });
  }

  const validPrompts = prompts.filter(p => p && p.trim());
  if (validPrompts.length === 0) {
    return res.status(400).json({ error: '请提供有效的提示词' });
  }

  const size = imageSize || '1024x1024';
  const newTasks = [];

  for (const prompt of validPrompts) {
    const taskCount = count && count > 1 ? count : 1;
    for (let i = 0; i < taskCount; i++) {
      const task = createTask(prompt.trim(), size);
      newTasks.push(task.id);
    }
  }

  console.log(`[Queue] 添加 ${newTasks.length} 个任务, 队列长度: ${queue.length}`);
  scheduleNext();

  res.json({
    taskIds: newTasks,
    queueLength: queue.length,
  });
});

app.get('/api/queue/status', (req, res) => {
  const allTasks = Array.from(tasks.values());
  const pending = allTasks.filter(t => t.status === 'pending' || t.status === 'retrying').length;
  const processing = allTasks.filter(t => t.status === 'processing').length;
  const completed = allTasks.filter(t => t.status === 'completed').length;
  const failed = allTasks.filter(t => t.status === 'failed').length;

  const sortedTasks = allTasks.sort((a, b) => b.updatedAt - a.updatedAt);

  res.json({
    total: allTasks.length,
    pending,
    processing,
    completed,
    failed,
    isPaused: config.isPaused,
    tasks: sortedTasks.map(t => ({
      id: t.id,
      prompt: t.prompt,
      status: t.status,
      progress: t.progress,
      retryCount: t.retryCount,
      retryMax: t.retryMax,
      imageSize: t.imageSize,
      imageUrl: t.imageUrl,
      error: t.error,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
  });
});

app.post('/api/queue/cancel/:id', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  task.status = 'cancelled';
  task.updatedAt = Date.now();
  const idx = queue.indexOf(req.params.id);
  if (idx !== -1) queue.splice(idx, 1);
  res.json({ success: true });
});

app.post('/api/queue/retry/:id', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  if (task.status !== 'failed' && task.status !== 'cancelled') {
    return res.status(400).json({ error: '只能重试失败或已取消的任务' });
  }
  task.status = 'pending';
  task.progress = 0;
  task.retryCount = 0;
  task.error = null;
  task.updatedAt = Date.now();
  queue.push(task.id);
  scheduleNext();
  res.json({ success: true });
});

app.post('/api/queue/clear', (req, res) => {
  const { type } = req.body;
  for (const [id, task] of tasks) {
    if (type === 'completed' && task.status === 'completed') tasks.delete(id);
    else if (type === 'failed' && task.status === 'failed') tasks.delete(id);
    else if (type === 'all' && task.status !== 'processing' && task.status !== 'pending') tasks.delete(id);
  }
  res.json({ success: true });
});

app.post('/api/queue/pause', (req, res) => {
  config.isPaused = true;
  res.json({ success: true, isPaused: true });
});

app.post('/api/queue/resume', (req, res) => {
  config.isPaused = false;
  scheduleNext();
  res.json({ success: true, isPaused: false });
});

app.get('/api/images/:id', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task || !task.imageUrl) return res.status(404).json({ error: '图片不存在' });

  const filePath = path.join(GENERATED_DIR, `${req.params.id}.png`);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(filePath).pipe(res);
  } else if (task.imageUrl.startsWith('http')) {
    res.redirect(task.imageUrl);
  } else {
    res.status(404).json({ error: '图片文件不存在' });
  }
});

app.get('/api/images/:id/download', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });

  const filePath = path.join(GENERATED_DIR, `${req.params.id}.png`);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="image_${req.params.id}.png"`);
    fs.createReadStream(filePath).pipe(res);
  } else if (task.imageUrl && task.imageUrl.startsWith('http')) {
    res.redirect(task.imageUrl);
  } else {
    res.status(404).json({ error: '图片文件不存在' });
  }
});

app.delete('/api/images/:id', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  const filePath = path.join(GENERATED_DIR, `${req.params.id}.png`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  task.imageUrl = null;
  task.updatedAt = Date.now();
  res.json({ success: true });
});

app.get('/api/images/list', (req, res) => {
  const completedTasks = Array.from(tasks.values())
    .filter(t => t.status === 'completed' && t.imageUrl)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(t => ({
      id: t.id,
      prompt: t.prompt,
      imageUrl: t.imageUrl,
      imageSize: t.imageSize,
      createdAt: t.createdAt,
    }));
  res.json({ images: completedTasks });
});

app.post('/api/models', async (req, res) => {
  try {
    const { apiUrl, apiKey } = req.body;
    if (!apiUrl || !apiKey) {
      return res.status(400).json({ success: false, message: '请提供 API URL 和 API Key' });
    }

    let modelsUrl = apiUrl.replace(/\/+$/, '');
    if (modelsUrl.endsWith('/models')) {
      // already has /models
    } else if (modelsUrl.endsWith('/v1') || modelsUrl.endsWith('/v1/')) {
      modelsUrl = modelsUrl.replace(/\/+$/, '') + '/models';
    } else if (!modelsUrl.includes('/v1')) {
      modelsUrl = modelsUrl + '/v1/models';
    } else {
      modelsUrl = modelsUrl + '/models';
    }

    console.log(`[Models] 请求: ${modelsUrl}`);

    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 30000,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[Models] 错误: ${response.status} - ${errorText.substring(0, 300)}`);
      let errorMsg = `HTTP错误: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMsg = errorData?.error?.message || errorData?.message || errorMsg;
      } catch {}
      return res.json({ success: false, message: errorMsg });
    }

    const data = await response.json();
    const models = (data.data || []).map(m => ({
      id: m.id,
      object: m.object,
      created: m.created,
      owned_by: m.owned_by,
    }));

    console.log(`[Models] 获取到 ${models.length} 个模型`);
    res.json({ success: true, models, total: models.length });
  } catch (error) {
    console.log(`[Models] 异常: ${error.message}`);
    res.json({ success: false, message: `请求失败: ${error.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`AI Image Queue Server running on http://localhost:${PORT}`);
  console.log(`图片保存目录: ${GENERATED_DIR}`);
});
