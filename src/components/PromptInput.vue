<script setup lang="ts">
import { ref, computed } from 'vue'
import { Sparkles, Send, X, Image, Hash, CheckCircle, AlertCircle } from 'lucide-vue-next'

const emit = defineEmits<{
  'task-submitted': [payload: { taskIds: string[]; queueLength: number }]
}>()

const promptText = ref('')
const imageSize = ref('1024x1024')
const count = ref(1)
const isSubmitting = ref(false)
const feedback = ref<{ type: 'success' | 'error'; message: string } | null>(null)

const sizeOptions = ['1024x1024', '1024x1792', '1792x1024', '2048x2048', '512x512']

const templates = ['风景摄影', '人物肖像', '抽象艺术', '赛博朋克', '水彩画', '动漫风格']

const charCount = computed(() => promptText.value.length)
const lineCount = computed(() => {
  if (!promptText.value.trim()) return 0
  return promptText.value.split('\n').filter(l => l.trim()).length
})

const prompts = computed(() =>
  promptText.value.split('\n').map(l => l.trim()).filter(Boolean)
)

function applyTemplate(tpl: string) {
  if (promptText.value && !promptText.value.endsWith('\n')) {
    promptText.value += '\n'
  }
  promptText.value += tpl
}

function clearPrompt() {
  promptText.value = ''
  feedback.value = null
}

async function submitToQueue() {
  if (!prompts.value.length || isSubmitting.value) return

  isSubmitting.value = true
  feedback.value = null

  try {
    const res = await fetch('http://localhost:3001/api/queue/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompts: prompts.value,
        imageSize: imageSize.value,
        count: count.value
      })
    })

    if (!res.ok) throw new Error(`请求失败: ${res.status}`)

    const data = await res.json()
    feedback.value = { type: 'success', message: `已添加 ${data.taskIds?.length ?? prompts.value.length} 条任务到队列` }
    promptText.value = ''
    emit('task-submitted', { taskIds: data.taskIds ?? [], queueLength: data.queueLength ?? 0 })
  } catch (err: any) {
    feedback.value = { type: 'error', message: err.message || '提交失败，请重试' }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="bg-[#14142a]/80 border border-white/15 rounded-2xl p-6 space-y-5">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
        <Sparkles class="w-4 h-4 text-amber-400" />
      </div>
      <h2 class="text-lg font-semibold text-white">提示词输入</h2>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="tpl in templates"
        :key="tpl"
        @click="applyTemplate(tpl)"
        class="bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/20 rounded-lg px-3 py-1.5 text-sm transition-colors"
      >
        {{ tpl }}
      </button>
    </div>

    <div class="relative">
      <textarea
        v-model="promptText"
        placeholder="输入提示词，每行一条可批量提交..."
        class="w-full bg-white/[0.06] border border-white/20 rounded-xl text-white placeholder-gray-500 px-4 py-3 min-h-[120px] resize-y focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-colors"
      />
      <button
        v-if="promptText"
        @click="clearPrompt"
        class="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg p-1.5 transition-colors"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <div class="flex items-center justify-between text-xs text-gray-400">
      <span>{{ charCount }} 字符</span>
      <span>{{ lineCount }} 行 / {{ prompts.length }} 条有效提示词</span>
    </div>

    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2 flex-1">
        <Image class="w-4 h-4 text-gray-400 shrink-0" />
        <select
          v-model="imageSize"
          class="w-full bg-white/[0.06] border border-white/20 rounded-xl text-white px-3 py-2 text-sm focus:outline-none focus:border-amber-500/50 transition-colors appearance-none cursor-pointer"
        >
          <option v-for="opt in sizeOptions" :key="opt" :value="opt" class="bg-gray-900">
            {{ opt }}
          </option>
        </select>
      </div>

      <div class="flex items-center gap-2">
        <Hash class="w-4 h-4 text-gray-400 shrink-0" />
        <input
          v-model.number="count"
          type="number"
          min="1"
          max="10"
          class="w-20 bg-white/[0.06] border border-white/20 rounded-xl text-white px-3 py-2 text-sm text-center focus:outline-none focus:border-amber-500/50 transition-colors"
        />
      </div>
    </div>

    <button
      @click="submitToQueue"
      :disabled="!prompts.length || isSubmitting"
      class="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-500/25"
    >
      <Send class="w-4 h-4" />
      {{ isSubmitting ? '提交中...' : '提交到队列' }}
    </button>

    <Transition name="fade">
      <div
        v-if="feedback"
        :class="[
          'flex items-center gap-2 px-4 py-3 rounded-xl text-sm border',
          feedback.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
            : 'bg-red-500/10 border-red-500/25 text-red-300'
        ]"
      >
        <CheckCircle v-if="feedback.type === 'success'" class="w-4 h-4 shrink-0" />
        <AlertCircle v-else class="w-4 h-4 shrink-0" />
        <span>{{ feedback.message }}</span>
        <button @click="feedback = null" class="ml-auto hover:opacity-70">
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
select option {
  background: #1a1a2e;
}
</style>
