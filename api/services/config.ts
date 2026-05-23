import type { Config } from '../types.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CONFIG_FILE = path.join(__dirname, '..', 'config.json')

function loadFromFile(): Partial<Config> | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch {}
  return null
}

function saveToFile(config: Config): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2))
  } catch (error) {
    console.error('Failed to save config:', error)
  }
}

const defaultConfig: Config = {
  modelUrl: 'https://api.minimaxi.com/v1/image_generation',
  modelName: 'image-01',
  apiKey: '',
  concurrency: 3,
  retryMax: 3,
}

class ConfigService {
  private config: Config

  constructor() {
    const saved = loadFromFile()
    this.config = {
      ...defaultConfig,
      ...saved,
      apiKey: (saved?.apiKey || '')?.trim() || '',
    }
  }

  get(): Config {
    return {
      ...this.config,
      apiKey: this.config.apiKey.trim(),
    }
  }

  set(config: Partial<Config>): void {
    this.config = {
      ...this.config,
      ...config,
      apiKey: (config.apiKey || this.config.apiKey || '').trim(),
    }
    saveToFile(this.config)
  }

  isConfigured(): boolean {
    const key = this.config.apiKey?.trim()
    return !!key && !!this.config.modelUrl
  }
}

export const configService = new ConfigService()