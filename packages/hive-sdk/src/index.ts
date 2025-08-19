import axios from 'axios'
import debug from 'debug'
import { v7 as uuidv7 } from 'uuid'
import type { ExecutionRecord } from '@forgehive/task'

const log = debug('hive-sdk')

// Metadata interface
export interface Metadata {
  [key: string]: string
}

// Re-export ExecutionRecord type from task package for convenience
export type { ExecutionRecord } from '@forgehive/task'

// Configuration interface for HiveLogClient
export interface HiveLogClientConfig {
  projectName: string
  projectUuid?: string // Optional UUID for new endpoint
  apiKey?: string
  apiSecret?: string
  host?: string
  metadata?: Metadata
}

// API Response Types
export interface LogApiResponse {
  uuid: string
  taskName: string
  projectName: string
  logItem: ExecutionRecord
  replayFrom?: string
  createdAt: string
}

export interface ApiError {
  error: string
}

export interface LogApiSuccess extends LogApiResponse {}

export type LogApiResult = LogApiSuccess | ApiError

// Quality interface for setQuality method
export interface Quality {
  score: number
  reason: string
  suggestions: string
}

// Type guard to check if response is an error
export function isApiError(response: unknown): response is ApiError {
  return response !== null && typeof response === 'object' && 'error' in response
}

export class HiveLogClient {
  private apiKey: string | null
  private apiSecret: string | null
  private host: string | null
  private projectName: string
  private projectUuid: string | null
  private baseMetadata: Metadata
  private isInitialized: boolean

  constructor(config: HiveLogClientConfig) {
    const apiKey = config.apiKey || process.env.HIVE_API_KEY
    const apiSecret = config.apiSecret || process.env.HIVE_API_SECRET
    const host = config.host || process.env.HIVE_HOST || 'https://www.forgehive.cloud'

    this.projectName = config.projectName
    this.projectUuid = config.projectUuid || null
    this.baseMetadata = config.metadata || {}

    if (!apiKey || !apiSecret) {
      this.apiKey = null
      this.apiSecret = null
      this.host = null
      this.isInitialized = false
      log('HiveLogClient in silent mode for project "%s" - missing API credentials (get them at https://www.forgehive.cloud)', config.projectName)
    } else {
      this.apiKey = apiKey
      this.apiSecret = apiSecret
      this.host = host
      this.isInitialized = true
      log('HiveLogClient initialized for project "%s" with host "%s"', config.projectName, host)
    }
  }

  isActive(): boolean {
    return this.isInitialized
  }

  private mergeMetadata(record: ExecutionRecord, sendLogMetadata?: Metadata): Metadata {
    // Start with base metadata from client
    let finalMetadata = { ...this.baseMetadata }

    // Merge with record metadata if it exists
    if (record.metadata) {
      finalMetadata = { ...finalMetadata, ...record.metadata }
    }

    // Merge with sendLog metadata (highest priority)
    if (sendLogMetadata) {
      finalMetadata = { ...finalMetadata, ...sendLogMetadata }
    }

    return finalMetadata
  }

  async sendLog(record: ExecutionRecord, metadata?: Metadata): Promise<'success' | 'error' | 'silent' | LogApiSuccess> {
    // Extract taskName from record
    const taskName = record.taskName || 'unknown-task'

    if (!this.isInitialized) {
      log('Silent mode: Skipping sendLog for task "%s" - client not initialized', taskName)
      return 'silent'
    }

    // Deprecation warning for legacy endpoint
    log('DEPRECATION WARNING: sendLog() is deprecated. Use sendLogByUuid() with project and task UUIDs for enhanced features and better performance.')

    try {
      const logsUrl = `${this.host}/api/tasks/log-ingest`
      log('Sending log for task "%s" to %s', taskName, logsUrl)

      const authToken = `${this.apiKey}:${this.apiSecret}`

      // Merge metadata with priority: sendLog > record.metadata > client
      const finalMetadata = this.mergeMetadata(record, metadata)

      // Create logItem with merged metadata (no UUID generation for legacy method)
      const logItem = {
        ...record,
        taskName,
        metadata: finalMetadata
      }

      const response = await axios.post(logsUrl, {
        projectName: this.projectName,
        taskName,
        logItem: JSON.stringify(logItem)
      }, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      log('Success: Sent log for task "%s"', taskName)

      // Return the full response data if available
      if (response.data && typeof response.data === 'object' && 'uuid' in response.data) {
        return response.data as LogApiSuccess
      }

      return 'success'
    } catch (e) {
      const error = e as Error
      log('Error: Failed to send log for task "%s": %s', taskName, error.message)
      return 'error'
    }
  }

  async sendLogByUuid(record: ExecutionRecord, taskUuid: string, metadata?: Metadata): Promise<'success' | 'error' | 'silent' | LogApiSuccess> {
    if (!this.isInitialized) {
      log('Silent mode: Skipping sendLogByUuid for task UUID "%s" - client not initialized', taskUuid)
      return 'silent'
    }

    if (!this.projectUuid) {
      log('Error: sendLogByUuid requires projectUuid to be set in client config')
      return 'error'
    }

    try {
      const logsUrl = `${this.host}/api/log-ingest`
      log('Sending log for task UUID "%s" to %s', taskUuid, logsUrl)

      const authToken = `${this.apiKey}:${this.apiSecret}`

      // Merge metadata with priority: sendLog > record.metadata > client
      const finalMetadata = this.mergeMetadata(record, metadata)

      // Ensure execution record has a UUID - generate one if missing
      const recordWithUuid = {
        ...record,
        uuid: record.uuid || uuidv7(),
        metadata: finalMetadata
      }

      // Create logItem with merged metadata and UUID
      const logItem = recordWithUuid

      const response = await axios.post(logsUrl, {
        projectUuid: this.projectUuid,
        taskUuid,
        logItem: JSON.stringify(logItem)
      }, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      log('Success: Sent log for task UUID "%s"', taskUuid)

      // Return the full response data if available
      if (response.data && typeof response.data === 'object' && 'uuid' in response.data) {
        return response.data as LogApiSuccess
      }

      return 'success'
    } catch (e) {
      const error = e as Error
      log('Error: Failed to send log for task UUID "%s": %s', taskUuid, error.message)
      return 'error'
    }
  }

  getListener(): (record: ExecutionRecord) => Promise<void> {
    return async (record: ExecutionRecord) => {
      await this.sendLog(record)
    }
  }

  async getLog(taskName: string, uuid: string): Promise<LogApiResult | null> {
    if (!this.isInitialized) {
      log('Error: getLog for task "%s" with uuid "%s" - missing credentials', taskName, uuid)
      throw new Error('Missing Hive API credentials or host, get them at https://www.forgehive.cloud')
    }

    try {
      const logUrl = `${this.host}/api/tasks/${taskName}/logs/${uuid}`
      log('Fetching log for task "%s" with uuid "%s" from %s', taskName, uuid, logUrl)

      const authToken = `${this.apiKey}:${this.apiSecret}`

      const response = await axios.get(logUrl, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      log('Success: Fetched log for task "%s" with uuid "%s"', taskName, uuid)
      return response.data as LogApiResult
    } catch (e) {
      const error = e as Error
      log('Error: Failed to fetch log for task "%s" with uuid "%s": %s', taskName, uuid, error.message)
      return null
    }
  }

  async setQuality(taskName: string, uuid: string, quality: Quality): Promise<boolean> {
    if (!this.isInitialized) {
      log('Error: setQuality for task "%s" with uuid "%s" - missing credentials', taskName, uuid)
      throw new Error('Missing Hive API credentials or host, get them at https://www.forgehive.cloud')
    }

    try {
      const qualityUrl = `${this.host}/api/tasks/${taskName}/logs/${uuid}/set-quality`
      log('Setting quality for task "%s" with uuid "%s" (score: %d) to %s', taskName, uuid, quality.score, qualityUrl)

      const authToken = `${this.apiKey}:${this.apiSecret}`

      await axios.post(qualityUrl, {
        quality
      }, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      log('Success: Set quality for task "%s" with uuid "%s" (score: %d)', taskName, uuid, quality.score)
      return true
    } catch (e) {
      const error = e as Error
      log('Error: Failed to set quality for task "%s" with uuid "%s": %s', taskName, uuid, error.message)
      return false
    }
  }
}

export const createHiveLogClient = (config: HiveLogClientConfig): HiveLogClient => {
  log('Creating HiveLogClient for project "%s"', config.projectName)
  return new HiveLogClient(config)
}

// Configuration interface for HiveClient
export interface HiveClientConfig {
  projectUuid: string
  apiKey?: string
  apiSecret?: string
  host?: string
}

// Response types for invoke method
export interface InvokeResponse {
  responsePayload: unknown
}

export interface InvokeError {
  error: string
}

export type InvokeResult = InvokeResponse | InvokeError

// Type guard to check if invoke response is an error
export function isInvokeError(response: unknown): response is InvokeError {
  return response !== null && typeof response === 'object' && 'error' in response
}

export class HiveClient {
  private apiKey: string
  private apiSecret: string
  private host: string
  private projectUuid: string

  constructor(config: HiveClientConfig) {
    const apiKey = config.apiKey || process.env.HIVE_API_KEY
    const apiSecret = config.apiSecret || process.env.HIVE_API_SECRET
    const host = config.host || process.env.HIVE_HOST || 'https://forgehive.dev'

    if (!apiKey || !apiSecret) {
      throw new Error('Missing Hive API credentials. Please provide apiKey and apiSecret, or set HIVE_API_KEY and HIVE_API_SECRET environment variables. Get them at https://forgehive.dev')
    }

    this.projectUuid = config.projectUuid
    this.host = host
    this.apiKey = apiKey
    this.apiSecret = apiSecret

    log('HiveClient initialized for project "%s" with host "%s"', config.projectUuid, host)
  }

  async invoke(taskName: string, payload: unknown): Promise<InvokeResult | null> {
    try {
      const invokeUrl = `${this.host}/api/project/${this.projectUuid}/task/${taskName}/invoke`
      log('Invoking task "%s" at %s', taskName, invokeUrl)

      const authToken = `${this.apiKey}:${this.apiSecret}`

      const response = await axios.post(invokeUrl, {
        payload
      }, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      log('Success: Invoked task "%s"', taskName)
      return response.data as InvokeResult
    } catch (e) {
      const error = e as Error
      log('Error: Failed to invoke task "%s": %s', taskName, error.message)

      // Check if it's an axios error with response data
      if (axios.isAxiosError(error) && error.response?.data) {
        return error.response.data as InvokeError
      }

      return { error: error.message }
    }
  }
}

export const createHiveClient = (config: HiveClientConfig): HiveClient => {
  log('Creating HiveClient for project "%s"', config.projectUuid)
  return new HiveClient(config)
}
