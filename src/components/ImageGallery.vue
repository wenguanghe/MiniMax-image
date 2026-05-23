<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ImageIcon, Download, Maximize2, Trash2, X } from 'lucide-vue-next'

interface TaskInfo {
  id: string
  prompt: string
  status: string
  imageUrl?: string
  imageSize: string
  createdAt: number
}

const emit = defineEmits<{
  'image-deleted': []
}>()

const API = 'http://localhost:3001'
const tasks = ref<TaskInfo[]>([])
let timer: ReturnType<typeof setInterval> | null = null

function resolveImageUrl(url: string) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${API}${url}`
}

const completedImages = computed(() =>
  tasks.value.filter((t) => t.status === 'completed' && t.imageUrl)
)

const previewImage = ref<TaskInfo | null>(null)
const loadedImages = ref<Set<string>>(new Set())

async function fetchImages() {
  try {
    const res = await fetch(`${API}/api/queue/status`)
    const data = await res.json()
    tasks.value = data.tasks ?? []
  } catch {}
}

function onImageLoad(id: string) {
  loadedImages.value.add(id)
}

function openPreview(image: TaskInfo) {
  previewImage.value = image
}

function closePreview() {
  previewImage.value = null
}

function downloadImage(id: string) {
  window.open(`${API}/api/images/${id}/download`, '_blank')
}

async function deleteImage(id: string) {
  try {
    const res = await fetch(`${API}/api/images/${id}`, { method: 'DELETE' })
    if (res.ok) {
      emit('image-deleted')
      await fetchImages()
    }
  } catch {}
}

function onOverlayClick(e: MouseEvent) {
  if (e.target === e.currentTarget) closePreview()
}

onMounted(() => {
  fetchImages()
  timer = setInterval(fetchImages, 3000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <section class="bg-[#14142a]/80 border border-white/15 rounded-2xl p-6">
    <div class="flex items-center gap-3 mb-6">
      <div class="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
        <ImageIcon class="w-4 h-4 text-amber-400" />
      </div>
      <h2 class="text-lg font-semibold text-white">生成结果</h2>
      <span
        v-if="completedImages.length > 0"
        class="bg-amber-500/20 text-amber-300 text-xs font-medium px-2.5 py-0.5 rounded-full border border-amber-500/25"
      >
        {{ completedImages.length }}
      </span>
    </div>

    <div
      v-if="completedImages.length === 0"
      class="flex flex-col items-center justify-center py-16 text-gray-500"
    >
      <ImageIcon class="w-16 h-16 mb-4 opacity-30" />
      <p class="text-sm">暂无生成结果</p>
      <p class="text-xs text-gray-600 mt-1">提交提示词后，生成的图片将在此展示</p>
    </div>

    <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <div
        v-for="img in completedImages"
        :key="img.id"
        class="rounded-xl overflow-hidden group relative aspect-square bg-white/[0.04] border border-white/10"
      >
        <div
          v-if="!loadedImages.has(img.id)"
          class="absolute inset-0 bg-white/[0.06] animate-pulse"
        />
        <img
          :src="resolveImageUrl(img.imageUrl)"
          :alt="img.prompt"
          class="w-full h-full object-cover"
          loading="lazy"
          @load="onImageLoad(img.id)"
        />
        <div
          class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3"
        >
          <p class="text-white text-xs line-clamp-2">{{ img.prompt }}</p>
          <div class="flex items-center gap-2 justify-end">
            <button
              class="bg-white/20 backdrop-blur-sm rounded-lg p-2 text-white hover:bg-white/30 transition-colors"
              @click="downloadImage(img.id)"
            >
              <Download class="w-4 h-4" />
            </button>
            <button
              class="bg-white/20 backdrop-blur-sm rounded-lg p-2 text-white hover:bg-white/30 transition-colors"
              @click="openPreview(img)"
            >
              <Maximize2 class="w-4 h-4" />
            </button>
            <button
              class="bg-white/20 backdrop-blur-sm rounded-lg p-2 text-rose-400 hover:bg-rose-500/30 transition-colors"
              @click="deleteImage(img.id)"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="previewImage"
        class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
        @click="onOverlayClick"
      >
        <button
          class="absolute top-4 right-4 bg-white/20 backdrop-blur-sm rounded-lg p-2 text-white hover:bg-white/30 transition-colors"
          @click="closePreview"
        >
          <X class="w-6 h-6" />
        </button>
        <div class="max-w-4xl max-h-[85vh] flex flex-col items-center gap-4">
          <img
            :src="resolveImageUrl(previewImage.imageUrl)"
            :alt="previewImage.prompt"
            class="max-w-full max-h-[75vh] object-contain rounded-lg"
          />
          <p class="text-gray-300 text-sm text-center max-w-2xl line-clamp-3">
            {{ previewImage.prompt }}
          </p>
          <button
            class="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 text-white hover:bg-white/30 transition-colors flex items-center gap-2"
            @click="downloadImage(previewImage.id)"
          >
            <Download class="w-4 h-4" />
            <span class="text-sm">下载图片</span>
          </button>
        </div>
      </div>
    </Teleport>
  </section>
</template>