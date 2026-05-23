export interface Config {
  modelUrl: string
  modelName: string
  apiKey: string
  concurrency: number
  retryMax: number
}

export interface Task {
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

export interface AddTaskRequest {
  prompts: string[]
  imageSize: string
  count: number
}

export interface QueueStatus {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
  isPaused: boolean
  tasks: Task[]
}

export interface ImageGenerationResponse {
  id: string
  data: {
    image_urls: string[]
  }
  metadata: {
    failed_count: string
    success_count: string
  }
  base_resp: {
    status_code: number
    status_msg: string
  }
}