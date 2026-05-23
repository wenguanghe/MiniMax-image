import { Router } from 'express'
import { configService } from '../services/config.js'

const router = Router()

router.get('/', (req, res) => {
  res.json(configService.get())
})

router.post('/save', (req, res) => {
  const { modelUrl, modelName, apiKey, concurrency, retryMax } = req.body
  
  console.log('[Config] Saving config:', {
    modelUrl,
    modelName,
    apiKeyLength: apiKey?.length,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 4) + '...' : 'empty',
  })
  
  configService.set({
    modelUrl: modelUrl || 'https://api.minimaxi.com/v1/image_generation',
    modelName: modelName || 'image-01',
    apiKey: apiKey || '',
    concurrency: Number(concurrency) || 3,
    retryMax: Number(retryMax) || 3,
  })
  
  const savedConfig = configService.get()
  console.log('[Config] Saved config:', {
    modelUrl: savedConfig.modelUrl,
    modelName: savedConfig.modelName,
    apiKeyLength: savedConfig.apiKey.length,
  })
  
  res.json({ success: true, message: '配置已保存' })
})

router.post('/test', async (req, res) => {
  const { modelUrl, modelName, apiKey } = req.body
  
  if (!apiKey) {
    return res.status(400).json({ success: false, message: '请输入 API Key' })
  }
  
  try {
    const response = await fetch(modelUrl || 'https://api.minimaxi.com/v1/image_generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName || 'image-01',
        prompt: 'test connection',
        aspect_ratio: '1:1',
        n: 1,
      }),
    })
    
    if (response.ok) {
      res.json({ success: true, message: '连接成功' })
    } else {
      const error = await response.text()
      res.json({ success: false, message: `连接失败: ${response.status} - ${error}` })
    }
  } catch (error) {
    res.json({ success: false, message: `网络错误: ${error instanceof Error ? error.message : 'Unknown error'}` })
  }
})

export default router