import axios from 'axios'
import debug from 'debug'
import { v7 as uuidv7 } from 'uuid'
import fs from 'fs'
import type { ExecutionRecord } from '@forgehive/task'

const log = debug('hive-sdk')

interface ForgeConfig {
  project: {
    name: string
    uuid: string
  }
  tasks: {
    [taskName: string]: {
      path: string
      handler: string
      uuid: string
    }
  }
}

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
  forgeConfigPath?: string // Optional path to forge.json file
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
  private forgeConfig: ForgeConfig | null = null

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

    // Load forge.json - use provided path or default to ./forge.json
    const configPath = config.forgeConfigPath || './forge.json'
    this.loadForgeConfig(configPath)
  }

  isActive(): boolean {
    return this.isInitialized
  }

  private maskSecret(secret: string | null): string {
    if (!secret || secret.length <= 8) {
      return secret ? '****' : 'null'
    }
    const first4 = secret.slice(0, 4)
    const last4 = secret.slice(-4)
    const middle = '*'.repeat(secret.length - 8)
    return `${first4}${middle}${last4}`
  }

  getConf(): Record<string, unknown> {
    return {
      projectName: this.projectName,
      projectUuid: this.projectUuid,
      host: this.host,
      apiKey: this.maskSecret(this.apiKey),
      apiSecret: this.maskSecret(this.apiSecret),
      isInitialized: this.isInitialized,
      baseMetadata: this.baseMetadata,
      forgeConfig: this.forgeConfig
    }
  }

  async testConfig(): Promise<{
    success: boolean
    teamName?: string
    teamUuid?: string
    userName?: string
    projectName?: string
    projectExists?: boolean
    tasksVerified?: {
      total: number
      found: number
      missing: string[]
    }
    error?: string
  }> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'Client not initialized - missing API credentials'
      }
    }

    try {
      // First verify credentials with /api/me
      const meResponse = await axios.get(`${this.host}/api/me`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}:${this.apiSecret}`,
          'Content-Type': 'application/json'
        }
      })

      if (meResponse.status !== 200) {
        const error = `Credential verification failed: HTTP ${meResponse.status}`
        log('Failed to verify credentials: %s', error)
        return { success: false, error }
      }

      const meData = meResponse.data
      log('Successfully verified credentials for user "%s" in team "%s"', meData.user?.name, meData.team?.name)

      // Then verify project exists if we have a projectUuid
      let projectExists = false
      let projectName: string | undefined
      let tasksVerified: { total: number; found: number; missing: string[] } | undefined

      if (this.projectUuid) {
        try {
          const projectResponse = await axios.get(`${this.host}/api/projects/${this.projectUuid}`, {
            headers: {
              'Authorization': `Bearer ${this.apiKey}:${this.apiSecret}`,
              'Content-Type': 'application/json'
            }
          })

          if (projectResponse.status === 200) {
            projectExists = true
            projectName = projectResponse.data.project?.projectName
            log('Successfully verified project "%s" exists with UUID "%s"', projectName, this.projectUuid)

            // Verify tasks if we have forge config
            if (this.forgeConfig && this.forgeConfig.tasks) {
              const localTasks = Object.keys(this.forgeConfig.tasks)
              const remoteTasks = projectResponse.data.project?.tasks || []
              const remoteTaskUuids = new Set(remoteTasks.map((task: any) => task.uuid))

              const missing: string[] = []
              let found = 0

              for (const taskName of localTasks) {
                const taskUuid = this.forgeConfig.tasks[taskName].uuid
                if (remoteTaskUuids.has(taskUuid)) {
                  found++
                } else {
                  missing.push(taskName)
                }
              }

              tasksVerified = {
                total: localTasks.length,
                found,
                missing
              }

              log('Task verification: %d/%d tasks found, missing: %s', found, localTasks.length, missing.join(', '))
            }
          }
        } catch (projectError) {
          log('Project verification failed for UUID "%s": %s', this.projectUuid, projectError instanceof Error ? projectError.message : String(projectError))
        }
      }

      return {
        success: true,
        teamName: meData.team?.name,
        teamUuid: meData.team?.uuid,
        userName: meData.user?.name,
        projectName,
        projectExists: this.projectUuid ? projectExists : undefined,
        tasksVerified
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Network error'
      log('Error during config test: %s', error)
      return { success: false, error }
    }
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

  private loadForgeConfig(configPath: string): void {
    try {
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8')
        this.forgeConfig = JSON.parse(configContent) as ForgeConfig
        log('Found forge.json configuration at %s', configPath)
      } else {
        log('No forge.json configuration found at %s', configPath)
      }
    } catch (error) {
      log('Error loading forge.json: %s', error instanceof Error ? error.message : String(error))
    }
  }

  private getTaskUUID(taskName: string): string | null {
    if (!this.forgeConfig) {
      log('No forge.json configuration loaded, cannot get UUID for task "%s"', taskName)
      return null
    }

    const task = this.forgeConfig.tasks[taskName]
    if (!task) {
      log('Task "%s" not found in forge.json configuration', taskName)
      return null
    }

    log('Found UUID "%s" for task "%s"', task.uuid, taskName)
    return task.uuid
  }

  async sendLogByName(record: ExecutionRecord, taskName: string, metadata?: Metadata): Promise<'success' | 'error' | 'silent' | LogApiSuccess> {
    if (!this.isInitialized) {
      log('Silent mode: Skipping sendLogByName for task "%s" - client not initialized', taskName)
      return 'silent'
    }

    if (!this.projectUuid) {
      log('Error: sendLogByName requires projectUuid to be set in client config')
      return 'error'
    }

    const taskUuid = this.getTaskUUID(taskName)
    if (!taskUuid) {
      log('Error: Cannot find UUID for task "%s" in forge.json', taskName)
      return 'error'
    }

    // Use the existing sendLogByUuid method
    console.log('[sendLogByName]Sending log for task "%s" with uuid "%s"', taskName, taskUuid)
    console.log('[sendLogByName]Sending log for project uuid "%s"', this.projectUuid)
    return await this.sendLogByUuid(record, taskUuid, metadata)
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

  private maskSecret(secret: string): string {
    if (secret.length <= 8) {
      return '****'
    }
    const first4 = secret.slice(0, 4)
    const last4 = secret.slice(-4)
    const middle = '*'.repeat(secret.length - 8)
    return `${first4}${middle}${last4}`
  }

  getConf(): Record<string, unknown> {
    return {
      projectUuid: this.projectUuid,
      host: this.host,
      apiKey: this.maskSecret(this.apiKey),
      apiSecret: this.maskSecret(this.apiSecret)
    }
  }

  async testConfig(): Promise<{
    success: boolean
    teamName?: string
    teamUuid?: string
    userName?: string
    projectName?: string
    projectExists?: boolean
    tasksVerified?: {
      total: number
      found: number
      missing: string[]
    }
    error?: string
  }> {
    try {
      // First verify credentials with /api/me
      const meResponse = await axios.get(`${this.host}/api/me`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}:${this.apiSecret}`,
          'Content-Type': 'application/json'
        }
      })

      if (meResponse.status !== 200) {
        const error = `Credential verification failed: HTTP ${meResponse.status}`
        log('Failed to verify credentials: %s', error)
        return { success: false, error }
      }

      const meData = meResponse.data
      log('Successfully verified credentials for user "%s" in team "%s"', meData.user?.name, meData.team?.name)

      // Then verify project exists
      let projectExists = false
      let projectName: string | undefined

      try {
        const projectResponse = await axios.get(`${this.host}/api/projects/${this.projectUuid}`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}:${this.apiSecret}`,
            'Content-Type': 'application/json'
          }
        })

        if (projectResponse.status === 200) {
          projectExists = true
          projectName = projectResponse.data.project?.projectName
          log('Successfully verified project "%s" exists with UUID "%s"', projectName, this.projectUuid)
        }
      } catch (projectError) {
        log('Project verification failed for UUID "%s": %s', this.projectUuid, projectError instanceof Error ? projectError.message : String(projectError))
      }

      return {
        success: true,
        teamName: meData.team?.name,
        teamUuid: meData.team?.uuid,
        userName: meData.user?.name,
        projectName,
        projectExists
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Network error'
      log('Error during config test: %s', error)
      return { success: false, error }
    }
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

/**
 * Create a HiveLogClient from forge.json configuration
 * @param forgeConfigPath Path to forge.json file (defaults to './forge.json')
 * @param additionalConfig Additional config options to override forge.json values
 * @returns HiveLogClient configured from forge.json
 */
export const createClientFromForgeConf = (
  forgeConfigPath: string = './forge.json',
  additionalConfig: Partial<HiveLogClientConfig> = {}
): HiveLogClient => {
  log('Creating HiveLogClient from forge.json at "%s"', forgeConfigPath)

  let forgeConfig: ForgeConfig | null = null

  try {
    if (fs.existsSync(forgeConfigPath)) {
      const configContent = fs.readFileSync(forgeConfigPath, 'utf8')
      forgeConfig = JSON.parse(configContent) as ForgeConfig
      log('Loaded forge.json configuration from %s', forgeConfigPath)
    } else {
      log('No forge.json found at %s', forgeConfigPath)
      throw new Error(`forge.json not found at ${forgeConfigPath}`)
    }
  } catch (error) {
    log('Error loading forge.json: %s', error instanceof Error ? error.message : String(error))
    throw error
  }

  const config: HiveLogClientConfig = {
    projectName: forgeConfig.project.name,
    projectUuid: forgeConfig.project.uuid,
    forgeConfigPath,
    ...additionalConfig // Allow overriding any config values
  }

  return new HiveLogClient(config)
}
