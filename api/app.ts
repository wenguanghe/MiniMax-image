/**
 * API Server for MiniMax Image Generation
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

import configRoutes from './routes/config.js'
import queueRoutes from './routes/queue.js'
import imagesRoutes from './routes/images.js'
import { startScheduler } from './services/imageGenerator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/config', configRoutes)
app.use('/api/queue', queueRoutes)
app.use('/api/images', imagesRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', error)
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

startScheduler()

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`)
})

export default app