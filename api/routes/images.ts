import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { queueService } from '../services/queue.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const GENERATED_DIR = path.join(__dirname, '..', 'generated')

const router = Router()

router.get('/:id', (req, res) => {
  const { id } = req.params
  const task = queueService.getTask(id)
  
  if (!task || !task.imageUrl) {
    return res.status(404).json({ success: false, message: '图片不存在' })
  }
  
  const filename = `${id}.png`
  const filepath = path.join(GENERATED_DIR, filename)
  
  if (fs.existsSync(filepath)) {
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.sendFile(filepath)
  } else {
    res.status(404).json({ success: false, message: '图片文件不存在' })
  }
})

router.get('/:id/download', (req, res) => {
  const { id } = req.params
  const task = queueService.getTask(id)
  
  if (!task || !task.imageUrl) {
    return res.status(404).json({ success: false, message: '图片不存在' })
  }
  
  const filename = `${id}.png`
  const filepath = path.join(GENERATED_DIR, filename)
  
  if (fs.existsSync(filepath)) {
    res.setHeader('Content-Disposition', `attachment; filename="${task.prompt.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}_${id}.png"`)
    res.setHeader('Content-Type', 'image/png')
    res.sendFile(filepath)
  } else {
    res.status(404).json({ success: false, message: '图片文件不存在' })
  }
})

router.delete('/:id', (req, res) => {
  const { id } = req.params
  const task = queueService.getTask(id)
  
  if (task) {
    queueService.deleteTask(id)
    
    const filename = `${id}.png`
    const filepath = path.join(GENERATED_DIR, filename)
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath)
    }
    
    res.json({ success: true, message: '图片已删除' })
  } else {
    res.status(404).json({ success: false, message: '图片不存在' })
  }
})

export default router