<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Search,
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Cpu,
  Copy,
  Check,
  Filter,
  ChevronDown,
  X,
} from 'lucide-vue-next'

interface ModelInfo {
  id: string
  object?: string
  created?: number
  owned_by?: string
}

const apiUrl = ref('')
const apiKey = ref('')
const showApiKey = ref(false)
const isLoading = ref(false)
const errorMsg = ref('')
const models = ref<ModelInfo[]>([])
const searchFilter = ref('')
const ownerFilter = ref('')
const showOwnerDropdown = ref(false)
const copiedId = ref('')

const API_BASE = 'http://localhost:3001'

const owners = computed(() => {
  const set = new Set(models.value.map(m => m.owned_by).filter(Boolean))
  return Array.from(set).sort()
})

const filteredModels = computed(() => {
  let result = models.value
  if (searchFilter.value) {
    const keyword = searchFilter.value.toLowerCase()
    result = result.filter(m => m.id.toLowerCase().includes(keyword))
  }
  if (ownerFilter.value) {
    result = result.filter(m => m.owned_by === ownerFilter.value)
  }
  return result.sort((a, b) => a.id.localeCompare(b.id))
})

async function fetchModels() {
  if (!apiUrl.value || !apiKey.value) {
    errorMsg.value = '请填写 API URL 和 API Key'
    return
  }

  isLoading.value = true
  errorMsg.value = ''
  models.value = []
  searchFilter.value = ''
  ownerFilter.value = ''

  try {
    const res = await fetch(`${API_BASE}/api/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiUrl: apiUrl.value,
        apiKey: apiKey.value,
      }),
    })
    const data = await res.json()

    if (data.success) {
      models.value = data.models || []
      if (models.value.length === 0) {
        errorMsg.value = '该 API 未返回任何模型'
      }
    } else {
      errorMsg.value = data.message || '获取模型列表失败'
    }
  } catch {
    errorMsg.value = '网络错误，请检查后端服务是否运行'
  } finally {
    isLoading.value = false
  }
}

function formatDate(timestamp?: number) {
  if (!timestamp) return '-'
  return new Date(timestamp * 1000).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function copyModelId(id: string) {
  try {
    await navigator.clipboard.writeText(id)
    copiedId.value = id
    setTimeout(() => {
      copiedId.value = ''
    }, 1500)
  } catch {}
}

function clearResults() {
  models.value = []
  errorMsg.value = ''
  searchFilter.value = ''
  ownerFilter.value = ''
}

function selectOwner(owner: string) {
  ownerFilter.value = ownerFilter.value === owner ? '' : owner
  showOwnerDropdown.value = false
}
</script>

<template>
  <div class="bg-[#14142a]/80 border border-white/15 rounded-2xl p-6 space-y-5">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
        <Cpu class="w-4 h-4 text-amber-400" />
      </div>
      <h2 class="text-lg font-semibold text-white">模型查询</h2>
      <span class="text-xs text-gray-500 ml-auto">输入 API 信息查看可用模型</span>
    </div>

    <div class="space-y-4">
      <div>
        <label class="block text-sm text-gray-300 mb-1.5">API URL</label>
        <input
          v-model="apiUrl"
          type="text"
          placeholder="https://api.openai.com/v1"
          class="w-full bg-white/[0.06] border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none transition text-sm"
        />
      </div>

      <div>
        <label class="block text-sm text-gray-300 mb-1.5">API Key</label>
        <div class="relative">
          <input
            v-model="apiKey"
            :type="showApiKey ? 'text' : 'password'"
            placeholder="sk-..."
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
      </div>
    </div>

    <button
      @click="fetchModels"
      :disabled="isLoading || !apiUrl || !apiKey"
      class="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/25"
    >
      <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
      <Search v-else class="w-4 h-4" />
      {{ isLoading ? '查询中...' : '查询模型' }}
    </button>

    <div v-if="errorMsg" class="flex items-center gap-2 text-sm p-3 rounded-xl bg-red-500/10 border border-red-500/20">
      <AlertCircle class="w-4 h-4 text-red-400 shrink-0" />
      <span class="text-red-300">{{ errorMsg }}</span>
    </div>

    <div v-if="models.length > 0" class="border-t border-white/10 pt-4 space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <CheckCircle class="w-4 h-4 text-emerald-400" />
          <span class="text-sm text-emerald-300">
            找到 <span class="font-semibold text-white">{{ models.length }}</span> 个模型
          </span>
        </div>
        <button
          @click="clearResults"
          class="text-xs text-gray-500 hover:text-gray-300 transition flex items-center gap-1"
        >
          <X class="w-3 h-3" />
          清除
        </button>
      </div>

      <div class="flex items-center gap-3">
        <div class="flex-1 relative">
          <Search class="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            v-model="searchFilter"
            type="text"
            placeholder="搜索模型名称..."
            class="w-full bg-white/[0.06] border border-white/15 rounded-xl pl-9 pr-4 py-2 text-white placeholder-gray-500 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 outline-none transition text-sm"
          />
        </div>

        <div class="relative">
          <button
            @click="showOwnerDropdown = !showOwnerDropdown"
            class="flex items-center gap-2 bg-white/[0.06] border border-white/15 rounded-xl px-3 py-2 text-sm text-gray-300 hover:bg-white/[0.1] transition"
          >
            <Filter class="w-3.5 h-3.5" />
            <span>{{ ownerFilter || '所有者' }}</span>
            <ChevronDown class="w-3.5 h-3.5" />
          </button>
          <div
            v-if="showOwnerDropdown"
            class="absolute right-0 top-full mt-1 bg-[#1a1a2e] border border-white/20 rounded-xl shadow-xl z-20 min-w-[160px] max-h-48 overflow-y-auto py-1"
          >
            <button
              @click="ownerFilter = ''; showOwnerDropdown = false"
              :class="[
                'w-full text-left px-3 py-2 text-sm transition',
                !ownerFilter ? 'text-amber-400 bg-amber-500/10' : 'text-gray-300 hover:bg-white/[0.06]'
              ]"
            >
              全部
            </button>
            <button
              v-for="owner in owners"
              :key="owner"
              @click="selectOwner(owner)"
              :class="[
                'w-full text-left px-3 py-2 text-sm transition truncate',
                ownerFilter === owner ? 'text-amber-400 bg-amber-500/10' : 'text-gray-300 hover:bg-white/[0.06]'
              ]"
            >
              {{ owner }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="filteredModels.length === 0" class="text-center py-6 text-gray-500 text-sm">
        没有匹配的模型
      </div>

      <div class="max-h-[400px] overflow-y-auto space-y-2 pr-1">
        <div
          v-for="model in filteredModels"
          :key="model.id"
          class="group bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-amber-500/30 rounded-xl px-4 py-3 transition-all"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="text-sm text-white font-medium truncate">{{ model.id }}</div>
              <div class="flex items-center gap-3 mt-1.5">
                <span v-if="model.owned_by" class="text-xs text-gray-500">
                  {{ model.owned_by }}
                </span>
                <span v-if="model.created" class="text-xs text-gray-600">
                  {{ formatDate(model.created) }}
                </span>
              </div>
            </div>
            <button
              @click="copyModelId(model.id)"
              class="shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition opacity-0 group-hover:opacity-100"
              title="复制模型ID"
            >
              <Check v-if="copiedId === model.id" class="w-3.5 h-3.5 text-emerald-400" />
              <Copy v-else class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="filteredModels.length !== models.length" class="text-xs text-gray-500 text-center">
        显示 {{ filteredModels.length }} / {{ models.length }} 个模型
      </div>
    </div>
  </div>
</template>

<style scoped>
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
