import { Router } from 'express'
import { queueService } from '../services/queue.js'

const router = Router()

router.post('/add', (req, res) => {
  const { prompts, imageSize, count } = req.body
  
  if (!prompts || !Array.isArray(prompts) || prompts.length === 0) {
    return res.status(400).json({ success: false, message: '请提供有效的提示词' })
  }
  
  const taskIds = queueService.addTasks(prompts, imageSize || '1024x1024')
  const status = queueService.getStatus()
  
  res.json({
    success: true,
    taskIds,
    queueLength: status.total,
  })
})

router.get('/status', (req, res) => {
  res.json(queueService.getStatus())
})

router.post('/pause', (req, res) => {
  queueService.pause()
  res.json({ success: true, message: '队列已暂停' })
})

router.post('/resume', (req, res) => {
  queueService.resume()
  res.json({ success: true, message: '队列已恢复' })
})

router.post('/clear', (req, res) => {
  const { type } = req.body
  const count = queueService.clearTasks(type || 'completed')
  res.json({ success: true, cleared: count })
})

router.post('/cancel/:id', (req, res) => {
  const { id } = req.params
  const success = queueService.cancelTask(id)
  res.json({ success, message: success ? '任务已取消' : '无法取消任务' })
})

router.post('/retry/:id', (req, res) => {
  const { id } = req.params
  const success = queueService.retryTask(id)
  res.json({ success, message: success ? '任务已重试' : '无法重试任务' })
})

export default router