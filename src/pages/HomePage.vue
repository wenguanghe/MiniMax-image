<script setup lang="ts">
import { ref } from 'vue'
import ApiConfig from '@/components/ApiConfig.vue'
import PromptInput from '@/components/PromptInput.vue'
import QueuePanel from '@/components/QueuePanel.vue'
import ImageGallery from '@/components/ImageGallery.vue'

const refreshTrigger = ref(0)

function handleTaskSubmitted() {
  refreshTrigger.value++
}

function handleTaskChanged() {
  refreshTrigger.value++
}

function handleImageDeleted() {
  refreshTrigger.value++
}
</script>

<template>
  <div class="min-h-screen bg-[#0a0a0f] text-white">
    <div class="fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(245,158,11,0.15),transparent)] pointer-events-none" />
    <div class="fixed inset-0 bg-[radial-gradient(circle_500px_at_90%_90%,rgba(245,158,11,0.05),transparent)] pointer-events-none" />
    
    <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <header class="text-center mb-12">
        <h1 class="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent mb-3">
          MiniMax 文生图
        </h1>
        <p class="text-gray-400 text-lg">基于 MiniMax API 的智能图片生成工具</p>
      </header>
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-6">
          <ApiConfig @config-saved="handleTaskChanged" />
          <PromptInput @task-submitted="handleTaskSubmitted" />
        </div>
        <div class="space-y-6">
          <QueuePanel 
            :refresh-trigger="refreshTrigger" 
            @task-changed="handleTaskChanged"
          />
          <ImageGallery 
            @image-deleted="handleImageDeleted"
          />
        </div>
      </div>
    </div>
  </div>
</template>