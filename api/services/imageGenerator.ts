import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { configService } from './config.js'
import { queueService } from './queue.js'
import type { Task, ImageGenerationResponse } from '../types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const GENERATED_DIR = path.join(__dirname, '..', 'generated')

if (!fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true })
}

function parseAspectRatio(imageSize: string): string {
  const [width, height] = imageSize.split('x').map(Number)
  if (!width || !height) return '1:1'
  
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
  const divisor = gcd(width, height)
  return `${width / divisor}:${height / divisor}`
}

async function generateImage(task: Task): Promise<string | null> {
  const config = configService.get()
  
  console.log('[ImageGen] Request config:', {
    modelUrl: config.modelUrl,
    modelName: config.modelName,
    apiKeyLength: config.apiKey.length,
    apiKeyPrefix: config.apiKey.substring(0, 4) + '...' + config.apiKey.substring(config.apiKey.length - 4),
  })
  
  const body: Record<string, unknown> = {
    model: config.modelName,
    prompt: task.prompt,
    aspect_ratio: parseAspectRatio(task.imageSize),
    response_format: 'url',
    n: 1,
    prompt_optimizer: true,
  }

  try {
    console.log('[ImageGen] Sending request to:', config.modelUrl)
    console.log('[ImageGen] Authorization header:', `Bearer ${config.apiKey.substring(0, 4)}...`)
    
    const response = await fetch(config.modelUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    console.log('[ImageGen] Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.log('[ImageGen] Error response:', errorText)
      throw new Error(`API Error: ${response.status} - ${errorText}`)
    }

    const data: ImageGenerationResponse = await response.json()
    
    if (data.base_resp?.status_code !== 0) {
      throw new Error(data.base_resp?.status_msg || 'Generation failed')
    }

    if (data.data?.image_urls?.[0]) {
      const imageUrl = data.data.image_urls[0]
      const filename = `${task.id}.png`
      const filepath = path.join(GENERATED_DIR, filename)
      
      const imageResponse = await fetch(imageUrl)
      if (!imageResponse.ok) {
        throw new Error('Failed to download image')
      }
      
      const buffer = await imageResponse.arrayBuffer()
      fs.writeFileSync(filepath, Buffer.from(buffer))
      
      return `/api/images/${task.id}`
    }

    return null
  } catch (error) {
    throw error
  }
}

async function processTask(task: Task): Promise<void> {
  queueService.updateTask(task.id, { status: 'processing', progress: 20 })
  
  try {
    queueService.updateTask(task.id, { progress: 50 })
    const imageUrl = await generateImage(task)
    
    if (imageUrl) {
      queueService.updateTask(task.id, {
        status: 'completed',
        progress: 100,
        imageUrl,
      })
    } else {
      throw new Error('No image URL returned')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    if (task.retryCount < task.retryMax) {
      queueService.updateTask(task.id, {
        status: 'retrying',
        retryCount: task.retryCount + 1,
        error: `Retry ${task.retryCount + 1}/${task.retryMax}: ${errorMessage}`,
        progress: 0,
      })
    } else {
      queueService.updateTask(task.id, {
        status: 'failed',
        error: errorMessage,
        progress: 0,
      })
    }
  }
}

let isProcessing = false
const retryTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map()

async function processQueue(): Promise<void> {
  if (isProcessing) return
  isProcessing = true
  
  try {
    const retryTasks = queueService.getRetryTasks()
    for (const task of retryTasks) {
      const delay = Math.pow(2, task.retryCount) * 1000
      
      if (!retryTimeouts.has(task.id)) {
        const timeout = setTimeout(async () => {
          retryTimeouts.delete(task.id)
          const t = queueService.getTask(task.id)
          if (t) await processTask(t)
        }, delay)
        retryTimeouts.set(task.id, timeout)
      }
    }

    let task = queueService.getNextPending()
    while (task) {
      await processTask(task)
      task = queueService.getNextPending()
    }
  } finally {
    isProcessing = false
  }
}

const PROCESS_INTERVAL = 500

export function startScheduler(): void {
  setInterval(processQueue, PROCESS_INTERVAL)
}

export { generateImage }