import axios from 'axios'
import fs from 'fs'
import { HiveLogClient } from '../index'

// Mock axios and fs
jest.mock('axios')
jest.mock('fs')
const mockedAxios = axios as jest.Mocked<typeof axios>
const mockedFs = fs as jest.Mocked<typeof fs>

describe('HiveLogClient sendLog with ExecutionRecord', () => {
  let client: HiveLogClient

  const testConfig = {
    projectName: 'test-project',
    projectUuid: '550e8400-e29b-41d4-a716-446655440000',
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    host: 'https://test-host.com',
    forgeConfigPath: './forge.json'
  }

  const mockForgeConfig = {
    project: {
      name: 'test-project',
      uuid: '550e8400-e29b-41d4-a716-446655440000'
    },
    tasks: {
      'test-task': {
        path: 'src/tasks/test.ts',
        handler: 'testTask',
        uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
      },
      'complex-task': {
        path: 'src/tasks/complex.ts',
        handler: 'complexTask',
        uuid: 'a45aafe3-8b01-4b58-b15d-9a96274858ee'
      },
      'error-task': {
        path: 'src/tasks/error.ts',
        handler: 'errorTask',
        uuid: '8879271f-7e84-4748-bd11-4d81acf29fb6'
      },
      'metadata-task': {
        path: 'src/tasks/metadata.ts',
        handler: 'metadataTask',
        uuid: 'fad2f735-ca09-4b8b-9c44-597de3641d28'
      }
    }
  }

  beforeEach(() => {
    // Mock fs.existsSync to return true
    mockedFs.existsSync.mockReturnValue(true)
    // Mock fs.readFileSync to return forge.json content
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockForgeConfig))

    // Create client instance with config
    client = new HiveLogClient(testConfig)

    // Clear all mocks
    jest.clearAllMocks()
  })

  describe('successful sendLog with ExecutionRecord', () => {
    it('should send log successfully with ExecutionRecord and return success', async () => {
      // Mock successful axios response
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } })

      const executionRecord = {
        input: { value: 'test-input' },
        output: { result: 'test-output' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      const result = await client.sendLog(executionRecord)

      expect(result).toBe('success')
      expect(mockedAxios.post).toHaveBeenCalledTimes(1)

      // Verify it uses the UUID endpoint
      const callArgs = mockedAxios.post.mock.calls[0]
      expect(callArgs[0]).toBe('https://test-host.com/api/log-ingest')

      // Verify request body structure
      const requestBody = callArgs[1] as { projectUuid: string; taskUuid: string; logItem: string }
      expect(requestBody.projectUuid).toBe(testConfig.projectUuid)
      expect(requestBody.taskUuid).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479')

      // Verify logItem has UUID generated
      const logItem = JSON.parse(requestBody.logItem)
      expect(logItem.uuid).toBeDefined()
      expect(typeof logItem.uuid).toBe('string')
      expect(logItem.input).toEqual({ value: 'test-input' })
      expect(logItem.output).toEqual({ result: 'test-output' })
      expect(logItem.taskName).toBe('test-task')
      expect(logItem.type).toBe('success')
    })

    it('should handle ExecutionRecord with complex boundaries', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } })

      const executionRecord = {
        input: { userId: 123, action: 'login' },
        output: { success: true, sessionId: 'abc123' },
        taskName: 'complex-task',
        type: 'success' as const,
        boundaries: {
          database: [{
            input: ['SELECT * FROM users'],
            output: [{ id: 123 }],
            timing: { startTime: 1000, endTime: 1100, duration: 100 }
          }],
          api: [{
            input: [{ endpoint: '/auth' }],
            output: { token: 'jwt123' },
            timing: { startTime: 1200, endTime: 1250, duration: 50 }
          }]
        },
        metadata: { environment: 'test' }
      }

      const result = await client.sendLog(executionRecord)

      expect(result).toBe('success')

      // Verify request structure
      const callArgs = mockedAxios.post.mock.calls[0]
      expect(callArgs[0]).toBe('https://test-host.com/api/log-ingest')

      const requestBody = callArgs[1] as { projectUuid: string; taskUuid: string; logItem: string }
      expect(requestBody.projectUuid).toBe(testConfig.projectUuid)
      expect(requestBody.taskUuid).toBe('a45aafe3-8b01-4b58-b15d-9a96274858ee')

      const logItem = JSON.parse(requestBody.logItem)
      expect(logItem.uuid).toBeDefined()
      expect(logItem.boundaries).toEqual(executionRecord.boundaries)
    })

    it('should handle ExecutionRecord with error', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } })

      const executionRecord = {
        input: { value: 'test-input' },
        output: undefined,
        error: 'Task execution failed',
        taskName: 'error-task',
        type: 'error' as const,
        boundaries: {},
        metadata: {}
      }

      const result = await client.sendLog(executionRecord)

      expect(result).toBe('success')

      const callArgs = mockedAxios.post.mock.calls[0]
      const requestBody = callArgs[1] as { projectUuid: string; taskUuid: string; logItem: string }
      expect(requestBody.taskUuid).toBe('8879271f-7e84-4748-bd11-4d81acf29fb6')

      const logItem = JSON.parse(requestBody.logItem)
      expect(logItem.error).toBe('Task execution failed')
      expect(logItem.type).toBe('error')
    })

    it('should preserve existing UUID when execution record already has one', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } })

      const existingUuid = '01234567-89ab-7def-8123-456789abcdef'
      const executionRecord = {
        uuid: existingUuid,
        input: { value: 'test-input' },
        output: { result: 'test-output' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      const result = await client.sendLog(executionRecord)

      expect(result).toBe('success')

      const callArgs = mockedAxios.post.mock.calls[0]
      const requestBody = callArgs[1] as { projectUuid: string; taskUuid: string; logItem: string }
      const logItem = JSON.parse(requestBody.logItem)

      expect(logItem.uuid).toBe(existingUuid)
    })

    it('should generate UUID v7 when execution record has no UUID', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } })

      const executionRecord = {
        input: { value: 'test-input' },
        output: { result: 'test-output' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      const result = await client.sendLog(executionRecord)

      expect(result).toBe('success')

      const callArgs = mockedAxios.post.mock.calls[0]
      const requestBody = callArgs[1] as { projectUuid: string; taskUuid: string; logItem: string }
      const logItem = JSON.parse(requestBody.logItem)

      expect(logItem.uuid).toBeDefined()
      expect(typeof logItem.uuid).toBe('string')
      // UUID v7 pattern
      expect(logItem.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })
  })

  describe('sendLog with additional metadata', () => {
    it('should merge metadata from ExecutionRecord and sendLog parameter', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } })

      const executionRecord = {
        input: { value: 'test-input' },
        output: { result: 'test-output' },
        taskName: 'metadata-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {
          recordMeta: 'from-record',
          sharedKey: 'record-value'
        }
      }

      const sendLogMetadata = {
        sendLogMeta: 'from-sendlog',
        sharedKey: 'sendlog-value' // This should override record value
      }

      const result = await client.sendLog(executionRecord, sendLogMetadata)

      expect(result).toBe('success')

      const callArgs = mockedAxios.post.mock.calls[0]
      const requestBody = callArgs[1] as { projectUuid: string; taskUuid: string; logItem: string }
      const logItem = JSON.parse(requestBody.logItem)

      expect(logItem.metadata).toEqual({
        recordMeta: 'from-record',
        sharedKey: 'sendlog-value', // sendLog metadata takes priority
        sendLogMeta: 'from-sendlog'
      })
    })
  })

  describe('failed sendLog', () => {
    it('should return error when axios throws an error', async () => {
      // Mock axios to throw an error
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'))

      const executionRecord = {
        input: { value: 'test-input' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      const result = await client.sendLog(executionRecord)

      expect(result).toBe('error')
    })

    it('should return error when server returns 500', async () => {
      // Mock axios to throw a server error
      const serverError = new Error('Server Error')
      mockedAxios.post.mockRejectedValueOnce(serverError)

      const executionRecord = {
        input: { value: 'test' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      const result = await client.sendLog(executionRecord)

      expect(result).toBe('error')
    })

    it('should return error when task is not found in forge.json', async () => {
      const executionRecord = {
        input: { value: 'test-input' },
        taskName: 'nonexistent-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      const result = await client.sendLog(executionRecord)

      expect(result).toBe('error')
      expect(mockedAxios.post).not.toHaveBeenCalled()
    })

    it('should return error when projectUuid is not set', async () => {
      // Create client without projectUuid
      const clientWithoutUuid = new HiveLogClient({
        projectName: 'test-project',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        host: 'https://test-host.com'
      })

      const executionRecord = {
        input: { value: 'test-input' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      const result = await clientWithoutUuid.sendLog(executionRecord)

      expect(result).toBe('error')
      expect(mockedAxios.post).not.toHaveBeenCalled()
    })
  })

  describe('sendLog in silent mode', () => {
    it('should return silent when client is not initialized', async () => {
      const uninitializedClient = new HiveLogClient({
        projectName: 'test-project'
        // No API credentials
      })

      const executionRecord = {
        input: { value: 'test-input' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      const result = await uninitializedClient.sendLog(executionRecord)

      expect(result).toBe('silent')
      expect(mockedAxios.post).not.toHaveBeenCalled()
    })
  })

  describe('sendLog with unknown task name', () => {
    it('should return error when taskName is missing and defaults to unknown-task', async () => {
      const executionRecord = {
        input: { value: 'test-input' },
        output: { result: 'test-output' },
        // taskName is missing - will default to 'unknown-task'
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      const result = await client.sendLog(executionRecord)

      // Should return error because 'unknown-task' is not in forge.json
      expect(result).toBe('error')
      expect(mockedAxios.post).not.toHaveBeenCalled()
    })
  })

  describe('sendLog response handling', () => {
    it('should return response data when API returns object with uuid', async () => {
      const responseData = {
        uuid: 'log-uuid-123',
        taskName: 'test-task',
        projectName: 'test-project',
        logItem: {},
        createdAt: '2024-01-01T00:00:00Z'
      }
      mockedAxios.post.mockResolvedValueOnce({ data: responseData })

      const executionRecord = {
        input: { value: 'test' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      const result = await client.sendLog(executionRecord)

      expect(result).toEqual(responseData)
    })
  })
})


describe('HiveLogClient getListener', () => {
  let client: HiveLogClient

  const testConfig = {
    projectName: 'test-project',
    projectUuid: '550e8400-e29b-41d4-a716-446655440000',
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    host: 'https://test-host.com',
    forgeConfigPath: './forge.json'
  }

  const mockForgeConfig = {
    project: {
      name: 'test-project',
      uuid: '550e8400-e29b-41d4-a716-446655440000'
    },
    tasks: {
      'test-task': {
        path: 'src/tasks/test.ts',
        handler: 'testTask',
        uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
      }
    }
  }

  beforeEach(() => {
    // Mock fs
    mockedFs.existsSync.mockReturnValue(true)
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockForgeConfig))

    client = new HiveLogClient(testConfig)
    jest.clearAllMocks()
  })

  describe('getListener method', () => {
    it('should return a function that calls sendLog', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } })

      const listener = client.getListener()

      expect(typeof listener).toBe('function')

      const executionRecord = {
        input: { value: 'test-input' },
        output: { result: 'test-output' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      await listener(executionRecord)

      expect(mockedAxios.post).toHaveBeenCalledTimes(1)

      // Verify it uses the UUID endpoint
      const callArgs = mockedAxios.post.mock.calls[0]
      expect(callArgs[0]).toBe('https://test-host.com/api/log-ingest')
    })

    it('should return a function that calls sendLog with provided metadata', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } })

      const listener = client.getListener()

      const executionRecord = {
        input: { value: 'test-input' },
        output: { result: 'test-output' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: { recordMeta: 'from-record' }
      }

      await listener(executionRecord)

      const callArgs = mockedAxios.post.mock.calls[0]
      const requestBody = callArgs[1] as { projectUuid: string; taskUuid: string; logItem: string }
      const logItem = JSON.parse(requestBody.logItem)

      expect(logItem.metadata).toEqual({ recordMeta: 'from-record' })
    })

    it('should handle listener errors gracefully', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'))

      const listener = client.getListener()

      const executionRecord = {
        input: { value: 'test-input' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      // Should not throw, even if sendLog fails
      await expect(listener(executionRecord)).resolves.toBeUndefined()
    })
  })
})
