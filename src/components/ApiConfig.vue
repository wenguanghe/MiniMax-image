<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  Settings,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-vue-next'

const emit = defineEmits<{
  'config-saved': []
}>()

const modelUrl = ref('https://api.minimaxi.com/v1/image_generation')
const modelName = ref('image-01')
const apiKey = ref('')
const showApiKey = ref(false)
const concurrency = ref(3)
const maxRetries = ref(3)

type Status = 'idle' | 'testing' | 'success' | 'failed'
const connStatus = ref<Status>('idle')
const statusMsg = ref('')

const API_BASE = 'http://localhost:3001'

const testConnection = async () => {
  connStatus.value = 'testing'
  statusMsg.value = ''
  try {
    const res = await fetch(`${API_BASE}/api/config/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelUrl: modelUrl.value,
        modelName: modelName.value,
        apiKey: apiKey.value,
      }),
    })
    const data = await res.json()
    if (res.ok && data.success) {
      connStatus.value = 'success'
      statusMsg.value = data.message || '连接成功'
    } else {
      connStatus.value = 'failed'
      statusMsg.value = data.message || '连接失败'
    }
  } catch {
    connStatus.value = 'failed'
    statusMsg.value = '网络错误'
  }
}

const saveConfig = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/config/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelUrl: modelUrl.value,
        modelName: modelName.value,
        apiKey: apiKey.value,
        concurrency: concurrency.value,
        retryMax: maxRetries.value,
      }),
    })
    if (res.ok) {
      emit('config-saved')
      connStatus.value = 'success'
      statusMsg.value = '配置已保存'
      setTimeout(() => {
        if (connStatus.value === 'success' && statusMsg.value === '配置已保存') {
          connStatus.value = 'idle'
          statusMsg.value = ''
        }
      }, 2000)
    }
  } catch {}
}

const loadConfig = async () => {
  try {
    const res = await fetch(`${API_BASE}/api/config`)
    if (res.ok) {
      const data = await res.json()
      if (data.modelUrl) modelUrl.value = data.modelUrl
      if (data.modelName) modelName.value = data.modelName
      if (data.apiKey) apiKey.value = data.apiKey
      if (data.concurrency) concurrency.value = data.concurrency
      if (data.retryMax) maxRetries.value = data.retryMax
    }
  } catch {}
}

onMounted(loadConfig)
</script>

<template>
  <div class="bg-[#14142a]/80 border border-white/15 rounded-2xl p-6 space-y-5">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
        <Settings class="w-4 h-4 text-amber-400" />
      </div>
      <h2 class="text-lg font-semibold text-white">MiniMax API 配置</h2>
    </div>

    <div class="space-y-4">
      <div>
        <label class="block text-sm text-gray-300 mb-1.5">API URL</label>
        <input
          v-model="modelUrl"
          type="text"
          placeholder="https://api.minimaxi.com/v1/image_generation"
          class="w-full bg-white/[0.06] border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none transition text-sm"
        />
        <p class="text-[11px] text-gray-500 mt-1.5">MiniMax 图片生成 API 地址</p>
      </div>

      <div>
        <label class="block text-sm text-gray-300 mb-1.5">模型名称</label>
        <select
          v-model="modelName"
          class="w-full bg-white/[0.06] border border-white/20 rounded-xl px-4 py-2.5 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none transition text-sm appearance-none cursor-pointer"
        >
          <option value="image-01" class="bg-gray-900">image-01 - 基础图片生成模型</option>
          <option value="image-01-live" class="bg-gray-900">image-01-live - 手绘/卡通风格增强</option>
        </select>
        <p class="text-[11px] text-gray-500 mt-1.5">
          image-01: 画面表现细腻，支持文生图、图生图<br/>
          image-01-live: 手绘、卡通等画风增强，支持画风设置
        </p>
      </div>

      <div>
        <label class="block text-sm text-gray-300 mb-1.5">API Key</label>
        <div class="relative">
          <input
            v-model="apiKey"
            :type="showApiKey ? 'text' : 'password'"
            placeholder="输入您的 MiniMax API Key"
            class="w-full bg-white/[0.06] border border-white/20 rounded-xl px-4 py-2.5 pr-10 text-white placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none transition text-sm"
          />
          <button
            @click="showApiKey = !showApiKey"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition"
          >
            <Eye v-if="!showApiKey" class="w-4 h-4" />
            <EyeOff v-else class="w-4 h-4" />
          </button>
        </div>
        <p class="text-[11px] text-gray-500 mt-1.5">
          可在 <a href="https://platform.minimaxi.com/user-center/basic-information/interface-key" target="_blank" class="text-amber-400 hover:underline">账户管理 &gt; 接口密钥</a> 中查看
        </p>
      </div>
    </div>

    <div class="border-t border-white/10 pt-4 space-y-4">
      <h3 class="text-sm font-medium text-gray-200">高级设置</h3>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm text-gray-300 mb-1.5">并发数</label>
          <input
            v-model.number="concurrency"
            type="number"
            min="1"
            max="10"
            class="w-full bg-white/[0.06] border border-white/20 rounded-xl px-4 py-2.5 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none transition"
          />
          <p class="text-[10px] text-gray-500 mt-1">同时处理的任务数</p>
        </div>
        <div>
          <label class="block text-sm text-gray-300 mb-1.5">最大重试</label>
          <input
            v-model.number="maxRetries"
            type="number"
            min="0"
            max="10"
            class="w-full bg-white/[0.06] border border-white/20 rounded-xl px-4 py-2.5 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none transition"
          />
          <p class="text-[10px] text-gray-500 mt-1">失败任务自动重试次数</p>
        </div>
      </div>
    </div>

    <div v-if="connStatus !== 'idle'" class="flex items-center gap-2 text-sm p-3 rounded-xl" :class="{
      'bg-yellow-500/10 border border-yellow-500/20': connStatus === 'testing',
      'bg-emerald-500/10 border border-emerald-500/20': connStatus === 'success',
      'bg-red-500/10 border border-red-500/20': connStatus === 'failed',
    }">
      <Loader2 v-if="connStatus === 'testing'" class="w-4 h-4 text-yellow-400 animate-spin" />
      <CheckCircle v-else-if="connStatus === 'success'" class="w-4 h-4 text-emerald-400" />
      <AlertCircle v-else-if="connStatus === 'failed'" class="w-4 h-4 text-red-400" />
      <span :class="{
        'text-yellow-300': connStatus === 'testing',
        'text-emerald-300': connStatus === 'success',
        'text-red-300': connStatus === 'failed',
      }">{{ statusMsg }}</span>
    </div>

    <div class="flex gap-3 pt-2">
      <button
        @click="testConnection"
        :disabled="connStatus === 'testing' || !apiKey"
        class="flex-1 bg-white/[0.08] hover:bg-white/15 text-gray-200 border border-white/20 rounded-xl py-2.5 transition disabled:opacity-50 font-medium"
      >
        测试连接
      </button>
      <button
        @click="saveConfig"
        class="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl py-2.5 shadow-lg shadow-amber-500/25 transition font-medium"
      >
        保存配置
      </button>
    </div>
  </div>
</template>