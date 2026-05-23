<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import {
  ListOrdered, Pause, Play, Trash2, RotateCcw, X, Loader2,
  CheckCircle, AlertCircle, Clock, RefreshCw
} from 'lucide-vue-next'

interface TaskInfo {
  id: string
  prompt: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying' | 'cancelled'
  progress: number
  retryCount: number
  retryMax: number
  imageSize: string
  imageUrl?: string
  error?: string
  createdAt: number
  updatedAt: number
}

const props = defineProps<{ refreshTrigger: number }>()
const emit = defineEmits<{ 'task-changed': [] }>()

const API = 'http://localhost:3001'
const tasks = ref<TaskInfo[]>([])
const queuePaused = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const stats = computed(() => ({
  total: tasks.value.length,
  pending: tasks.value.filter(t => t.status === 'pending').length,
  processing: tasks.value.filter(t => t.status === 'processing').length,
  completed: tasks.value.filter(t => t.status === 'completed').length,
  failed: tasks.value.filter(t => t.status === 'failed').length,
}))

const statusLabel: Record<string, string> = {
  pending: '等待中',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
  retrying: '重试中',
  cancelled: '已取消',
}

const statusColor: Record<string, string> = {
  pending: 'bg-zinc-400/20 text-zinc-300',
  processing: 'bg-blue-400/20 text-blue-300',
  completed: 'bg-emerald-400/20 text-emerald-300',
  failed: 'bg-rose-400/20 text-rose-300',
  retrying: 'bg-yellow-400/20 text-yellow-300',
  cancelled: 'bg-zinc-500/20 text-zinc-400',
}

const progressColor: Record<string, string> = {
  pending: 'bg-zinc-500',
  processing: 'bg-blue-500',
  completed: 'bg-emerald-500',
  failed: 'bg-rose-500',
  retrying: 'bg-yellow-500',
  cancelled: 'bg-zinc-600',
}

const statusIcon: Record<string, typeof Clock> = {
  pending: Clock,
  processing: Loader2,
  completed: CheckCircle,
  failed: AlertCircle,
  retrying: RefreshCw,
  cancelled: X,
}

async function fetchStatus() {
  try {
    const res = await fetch(`${API}/api/queue/status`)
    const data = await res.json()
    tasks.value = data.tasks ?? []
    queuePaused.value = data.isPaused ?? false
  } catch {}
}

async function pauseQueue() {
  await fetch(`${API}/api/queue/pause`, { method: 'POST' })
  queuePaused.value = true
  await fetchStatus()
}

async function resumeQueue() {
  await fetch(`${API}/api/queue/resume`, { method: 'POST' })
  queuePaused.value = false
  await fetchStatus()
}

async function clearQueue(type: string) {
  await fetch(`${API}/api/queue/clear`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) })
  emit('task-changed')
  await fetchStatus()
}

async function cancelTask(id: string) {
  await fetch(`${API}/api/queue/cancel/${id}`, { method: 'POST' })
  emit('task-changed')
  await fetchStatus()
}

async function retryTask(id: string) {
  await fetch(`${API}/api/queue/retry/${id}`, { method: 'POST' })
  emit('task-changed')
  await fetchStatus()
}

async function deleteTask(id: string) {
  await fetch(`${API}/api/images/${id}`, { method: 'DELETE' })
  emit('task-changed')
  await fetchStatus()
}

function truncate(str: string, len: number) {
  return str.length > len ? str.slice(0, len) + '…' : str
}

watch(() => props.refreshTrigger, () => fetchStatus())

onMounted(() => {
  fetchStatus()
  timer = setInterval(fetchStatus, 2000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="bg-[#14142a]/80 border border-white/15 rounded-2xl p-6">
    <div class="flex items-center justify-between mb-5">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
          <ListOrdered class="w-4 h-4 text-amber-400" />
        </div>
        <h2 class="text-lg font-semibold text-white">任务队列</h2>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="queuePaused"
          @click="resumeQueue"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 transition text-sm font-medium"
        >
          <Play class="w-3.5 h-3.5" /> 恢复
        </button>
        <button
          v-else
          @click="pauseQueue"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-300 hover:bg-amber-500/25 transition text-sm font-medium"
        >
          <Pause class="w-3.5 h-3.5" /> 暂停
        </button>
      </div>
    </div>

    <div class="flex flex-wrap gap-2 mb-4">
      <span class="rounded-full px-3 py-1 text-xs font-medium bg-white/10 text-gray-200">
        总计 {{ stats.total }}
      </span>
      <span class="rounded-full px-3 py-1 text-xs font-medium bg-zinc-400/15 text-zinc-300">
        等待 {{ stats.pending }}
      </span>
      <span class="rounded-full px-3 py-1 text-xs font-medium bg-blue-400/15 text-blue-300">
        处理中 {{ stats.processing }}
      </span>
      <span class="rounded-full px-3 py-1 text-xs font-medium bg-emerald-400/15 text-emerald-300">
        完成 {{ stats.completed }}
      </span>
      <span class="rounded-full px-3 py-1 text-xs font-medium bg-rose-400/15 text-rose-300">
        失败 {{ stats.failed }}
      </span>
    </div>

    <div class="flex gap-2 mb-5">
      <button @click="clearQueue('completed')" class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition text-xs">
        <Trash2 class="w-3 h-3" /> 清除已完成
      </button>
      <button @click="clearQueue('failed')" class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition text-xs">
        <Trash2 class="w-3 h-3" /> 清除失败
      </button>
      <button @click="clearQueue('all')" class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition text-xs">
        <Trash2 class="w-3 h-3" /> 清除全部
      </button>
    </div>

    <div v-if="tasks.length === 0" class="flex flex-col items-center justify-center py-12 text-gray-500">
      <ListOrdered class="w-12 h-12 mb-3 opacity-40" />
      <p class="text-sm">暂无任务，提交提示词开始生成</p>
    </div>

    <div v-else class="space-y-3 max-h-[480px] overflow-y-auto pr-1">
      <div
        v-for="task in tasks"
        :key="task.id"
        class="bg-white/[0.04] border border-white/10 rounded-xl p-4 hover:bg-white/[0.07] transition"
      >
        <div class="flex items-start justify-between gap-3 mb-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs text-gray-500 font-mono">{{ truncate(task.id, 8) }}</span>
              <span :class="['rounded-full px-2 py-0.5 text-[10px] font-medium inline-flex items-center gap-1', statusColor[task.status]]">
                <component :is="statusIcon[task.status]" class="w-3 h-3" :class="{ 'animate-spin': task.status === 'processing' }" />
                {{ statusLabel[task.status] || task.status }}
              </span>
              <span v-if="task.retryCount > 0" class="text-[10px] text-yellow-400">
                重试 {{ task.retryCount }}/{{ task.retryMax }}
              </span>
            </div>
            <p class="text-sm text-gray-300 truncate">{{ truncate(task.prompt, 60) }}</p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button v-if="task.status === 'pending'" @click="cancelTask(task.id)" class="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition">
              <X class="w-3.5 h-3.5" />
            </button>
            <button v-if="task.status === 'failed'" @click="retryTask(task.id)" class="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-amber-400 transition">
              <RotateCcw class="w-3.5 h-3.5" />
            </button>
            <button @click="deleteTask(task.id)" class="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-rose-400 transition">
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div class="bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            :class="['h-full rounded-full transition-all duration-500', progressColor[task.status]]"
            :style="{ width: `${task.progress}%` }"
          />
        </div>

        <p v-if="task.error" class="mt-2 text-xs text-rose-400 truncate">{{ task.error }}</p>
      </div>
    </div>
  </div>
</template>
