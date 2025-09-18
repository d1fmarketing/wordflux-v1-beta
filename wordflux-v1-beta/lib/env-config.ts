/**
 * Centralized environment variable validation and configuration
 * This ensures all env vars are validated and have proper defaults
 */

export function getEnv(key: string, defaultValue?: string, required = false): string {
  const value = process.env[key]

  if (!value || value.trim() === '') {
    if (required && !defaultValue) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
    return defaultValue || ''
  }

  return value
}

export function getIntEnv(key: string, defaultValue: number, min?: number, max?: number): number {
  const value = process.env[key]

  if (!value || value.trim() === '') {
    return defaultValue
  }

  const num = parseInt(value, 10)

  if (isNaN(num)) {
    console.warn(`Invalid integer value for ${key}: ${value}, using default: ${defaultValue}`)
    return defaultValue
  }

  if (min !== undefined && num < min) {
    console.warn(`${key} value ${num} is below minimum ${min}, using minimum`)
    return min
  }

  if (max !== undefined && num > max) {
    console.warn(`${key} value ${num} is above maximum ${max}, using maximum`)
    return max
  }

  return num
}

export function getBoolEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key]

  if (!value || value.trim() === '') {
    return defaultValue
  }

  return value.toLowerCase() === 'true' || value === '1'
}

// OpenAI Configuration
export const OPENAI_API_KEY = getEnv('OPENAI_API_KEY', '', true)
export const OPENAI_MODEL = getEnv('OPENAI_MODEL', 'gpt-5-mini')
export const OPENAI_MAX_TOKENS = getIntEnv('OPENAI_MAX_TOKENS', 1000, 1, 8192)
export const OPENAI_TEMPERATURE = parseFloat(getEnv('OPENAI_TEMPERATURE', '0.7')) || 0.7

// TaskCafe Configuration
export const TASKCAFE_URL = getEnv('TASKCAFE_URL', 'http://localhost:3333')
export const TASKCAFE_USERNAME = getEnv('TASKCAFE_USERNAME', 'admin')
export const TASKCAFE_PASSWORD = getEnv('TASKCAFE_PASSWORD', '', true)
export const TASKCAFE_PROJECT_ID = getEnv('TASKCAFE_PROJECT_ID', '00000000-0000-0000-0000-000000000001')
export const TASKCAFE_SWIMLANE_ID = getEnv('TASKCAFE_SWIMLANE_ID', '00000000-0000-0000-0000-000000000001')

// Application Configuration
export const NODE_ENV = getEnv('NODE_ENV', 'development')
export const PORT = getIntEnv('PORT', 3000, 1, 65535)
export const HOST = getEnv('HOST', 'localhost')

// Feature Flags
export const ENABLE_AI_FEATURES = getBoolEnv('ENABLE_AI_FEATURES', true)
export const ENABLE_SSE_STREAMING = getBoolEnv('ENABLE_SSE_STREAMING', true)
export const ENABLE_TIDY_COMMANDS = getBoolEnv('ENABLE_TIDY_COMMANDS', true)
export const ENABLE_UNDO_REDO = getBoolEnv('ENABLE_UNDO_REDO', true)

// Rate Limiting
export const RATE_LIMIT_WINDOW_MS = getIntEnv('RATE_LIMIT_WINDOW_MS', 60000, 1000, 3600000)
export const RATE_LIMIT_MAX_REQUESTS = getIntEnv('RATE_LIMIT_MAX_REQUESTS', 10, 1, 1000)

// Caching
export const CACHE_TTL_MS = getIntEnv('CACHE_TTL_MS', 300000, 1000, 3600000)
export const PREVIEW_TTL_MS = getIntEnv('PREVIEW_TTL_MS', 1800000, 60000, 7200000)

// Logging
export const LOG_LEVEL = getEnv('LOG_LEVEL', 'info')
export const LOG_FORMAT = getEnv('LOG_FORMAT', 'json')

// Build Info
export const BUILD_TIME = getEnv('NEXT_PUBLIC_BUILD_TIME', new Date().toISOString())
export const BUILD_COMMIT = getEnv('NEXT_PUBLIC_BUILD_COMMIT', 'development')

// Validate critical configurations at startup
export function validateEnvironment() {
  const warnings: string[] = []

  if (!OPENAI_API_KEY || OPENAI_API_KEY.length < 20) {
    warnings.push('OPENAI_API_KEY is missing or invalid')
  }

  if (!TASKCAFE_PASSWORD || TASKCAFE_PASSWORD.length < 8) {
    warnings.push('TASKCAFE_PASSWORD is missing or too short')
  }

  if (!TASKCAFE_URL.startsWith('http')) {
    warnings.push('TASKCAFE_URL must start with http:// or https://')
  }

  if (warnings.length > 0) {
    console.warn('[ENV] Environment validation warnings:')
    warnings.forEach(w => console.warn(`  ⚠️  ${w}`))

    // In production, log but don't crash
    if (NODE_ENV === 'production') {
      console.error('[ENV] Critical environment variables may be missing. App may not function correctly.')
    }
  } else {
    console.log('[ENV] Environment validated successfully')
  }

  console.log(`[ENV] Node Env: ${NODE_ENV}`)
  console.log(`[ENV] Port: ${PORT}`)
  console.log(`[ENV] TaskCafe: ${TASKCAFE_URL}`)
  console.log(`[ENV] OpenAI Model: ${OPENAI_MODEL}`)
}

// Run validation on module load (but don't crash)
if (typeof window === 'undefined') {
  try {
    validateEnvironment()
  } catch (err) {
    console.error('[ENV] Validation error:', err)
  }
}
