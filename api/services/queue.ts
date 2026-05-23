import type { Task, QueueStatus } from '../types.js'
import { configService } from './config.js'

class QueueService {
  private tasks: Map<string, Task> = new Map()
  private isPaused: boolean = false

  generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
  }

  addTasks(prompts: string[], imageSize: string): string[] {
    const ids: string[] = []
    for (const prompt of prompts) {
      const id = this.generateId()
      const task: Task = {
        id,
        prompt,
        status: 'pending',
        progress: 0,
        retryCount: 0,
        retryMax: configService.get().retryMax,
        imageSize,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      this.tasks.set(id, task)
      ids.push(id)
    }
    return ids
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id)
  }

  getStatus(): QueueStatus {
    const tasks = Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt)
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      processing: tasks.filter(t => t.status === 'processing').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      isPaused: this.isPaused,
      tasks,
    }
  }

  getNextPending(): Task | undefined {
    if (this.isPaused) return undefined
    const processingCount = Array.from(this.tasks.values()).filter(t => t.status === 'processing').length
    if (processingCount >= configService.get().concurrency) return undefined
    
    for (const task of this.tasks.values()) {
      if (task.status === 'pending') return task
    }
    return undefined
  }

  getRetryTasks(): Task[] {
    if (this.isPaused) return []
    return Array.from(this.tasks.values()).filter(t => t.status === 'retrying')
  }

  updateTask(id: string, updates: Partial<Task>): void {
    const task = this.tasks.get(id)
    if (task) {
      this.tasks.set(id, { ...task, ...updates, updatedAt: Date.now() })
    }
  }

  cancelTask(id: string): boolean {
    const task = this.tasks.get(id)
    if (task && (task.status === 'pending' || task.status === 'retrying')) {
      this.updateTask(id, { status: 'cancelled' })
      return true
    }
    return false
  }

  retryTask(id: string): boolean {
    const task = this.tasks.get(id)
    if (task && task.status === 'failed') {
      this.updateTask(id, { status: 'pending', retryCount: 0, error: undefined, progress: 0 })
      return true
    }
    return false
  }

  clearTasks(type: 'completed' | 'failed' | 'all'): number {
    let count = 0
    for (const [id, task] of this.tasks.entries()) {
      if (type === 'all' || task.status === type) {
        this.tasks.delete(id)
        count++
      }
    }
    return count
  }

  pause(): void {
    this.isPaused = true
  }

  resume(): void {
    this.isPaused = false
  }

  deleteTask(id: string): boolean {
    return this.tasks.delete(id)
  }
}

export const queueService = new QueueService()