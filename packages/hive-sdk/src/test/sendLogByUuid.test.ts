import axios from 'axios'
import { HiveLogClient } from '../index'

// Mock axios
jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('HiveLogClient sendLogByUuid', () => {
  const testConfig = {
    projectName: 'test-project',
    projectUuid: '550e8400-e29b-41d4-a716-446655440000',
    apiKey: 'test-key',
    apiSecret: 'test-secret',
    host: 'https://test.example.com'
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('UUID Generation', () => {
    it('should generate UUID v7 when execution record has no UUID', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } })

      const client = new HiveLogClient(testConfig)
      const executionRecord = {
        input: { value: 'test-input' },
        output: { result: 'test-output' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      const result = await client.sendLogByUuid(executionRecord, 'task-uuid-123')

      expect(result).toBe('success')
      expect(mockedAxios.post).toHaveBeenCalledTimes(1)

      // Check that the request was made with a UUID
      const callArgs = mockedAxios.post.mock.calls[0]
      const requestBody = callArgs[1] as { projectUuid: string; taskUuid: string; logItem: string }
      const logItem = JSON.parse(requestBody.logItem)

      expect(logItem.uuid).toBeDefined()
      expect(typeof logItem.uuid).toBe('string')
      expect(logItem.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i) // UUID v7 pattern
    })

    it('should preserve existing UUID when execution record already has one', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } })

      const client = new HiveLogClient(testConfig)
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

      const result = await client.sendLogByUuid(executionRecord, 'task-uuid-123')

      expect(result).toBe('success')
      expect(mockedAxios.post).toHaveBeenCalledTimes(1)

      // Check that the existing UUID was preserved
      const callArgs = mockedAxios.post.mock.calls[0]
      const requestBody = callArgs[1] as { projectUuid: string; taskUuid: string; logItem: string }
      const logItem = JSON.parse(requestBody.logItem)

      expect(logItem.uuid).toBe(existingUuid)
    })

    it('should generate UUID v7 when execution record has empty UUID', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } })

      const client = new HiveLogClient(testConfig)
      const executionRecord = {
        uuid: '', // Empty string should trigger UUID generation
        input: { value: 'test-input' },
        output: { result: 'test-output' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      const result = await client.sendLogByUuid(executionRecord, 'task-uuid-123')

      expect(result).toBe('success')
      expect(mockedAxios.post).toHaveBeenCalledTimes(1)

      // Check that a new UUID was generated (not empty string)
      const callArgs = mockedAxios.post.mock.calls[0]
      const requestBody = callArgs[1] as { projectUuid: string; taskUuid: string; logItem: string }
      const logItem = JSON.parse(requestBody.logItem)

      expect(logItem.uuid).toBeDefined()
      expect(logItem.uuid).not.toBe('')
      expect(typeof logItem.uuid).toBe('string')
      expect(logItem.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i) // UUID v7 pattern
    })
  })

  describe('API Integration', () => {
    it('should send correct request to log-ingest endpoint', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } })

      const client = new HiveLogClient(testConfig)
      const taskUuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
      const executionRecord = {
        input: { userId: 123 },
        output: { result: 'processed' },
        taskName: 'process-user',
        type: 'success' as const,
        boundaries: {},
        metadata: { session: 'abc123' }
      }

      await client.sendLogByUuid(executionRecord, taskUuid)

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test.example.com/api/log-ingest',
        {
          projectUuid: testConfig.projectUuid,
          taskUuid: taskUuid,
          logItem: expect.any(String)
        },
        {
          headers: {
            'Authorization': 'Bearer test-key:test-secret',
            'Content-Type': 'application/json'
          }
        }
      )

      // Verify the logItem contains the execution record with UUID
      const callArgs = mockedAxios.post.mock.calls[0]
      const requestBody = callArgs[1] as { projectUuid: string; taskUuid: string; logItem: string }
      const logItem = JSON.parse(requestBody.logItem)

      expect(logItem.uuid).toBeDefined()
      expect(logItem.input).toEqual({ userId: 123 })
      expect(logItem.output).toEqual({ result: 'processed' })
      expect(logItem.taskName).toBe('process-user')
      expect(logItem.type).toBe('success')
      expect(logItem.metadata).toEqual({ session: 'abc123' })
    })

    it('should return "silent" when client is not initialized', async () => {
      const client = new HiveLogClient({
        projectName: 'test-project',
        projectUuid: testConfig.projectUuid
        // Missing apiKey and apiSecret
      })

      const executionRecord = {
        input: { value: 'test' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      const result = await client.sendLogByUuid(executionRecord, 'task-uuid-123')

      expect(result).toBe('silent')
      expect(mockedAxios.post).not.toHaveBeenCalled()
    })

    it('should return "error" when projectUuid is missing', async () => {
      const client = new HiveLogClient({
        projectName: 'test-project',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        host: 'https://test.example.com'
        // Missing projectUuid
      })

      const executionRecord = {
        input: { value: 'test' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      const result = await client.sendLogByUuid(executionRecord, 'task-uuid-123')

      expect(result).toBe('error')
      expect(mockedAxios.post).not.toHaveBeenCalled()
    })

    it('should handle API error responses', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'))

      const client = new HiveLogClient(testConfig)
      const executionRecord = {
        input: { value: 'test' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      const result = await client.sendLogByUuid(executionRecord, 'task-uuid-123')

      expect(result).toBe('error')
      expect(mockedAxios.post).toHaveBeenCalledTimes(1)
    })

    it('should return response data when API returns object with uuid', async () => {
      const responseData = { uuid: 'log-uuid-123', success: true }
      mockedAxios.post.mockResolvedValueOnce({ data: responseData })

      const client = new HiveLogClient(testConfig)
      const executionRecord = {
        input: { value: 'test' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: {}
      }

      const result = await client.sendLogByUuid(executionRecord, 'task-uuid-123')

      expect(result).toEqual(responseData)
    })
  })

  describe('Metadata Handling', () => {
    it('should merge metadata correctly with UUID generation', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } })

      const baseMetadata = { environment: 'test', version: '1.0' }
      const client = new HiveLogClient({ ...testConfig, metadata: baseMetadata })

      const recordMetadata = { session: 'abc123' }
      const sendLogMetadata = { priority: 'high' }

      const executionRecord = {
        input: { value: 'test' },
        taskName: 'test-task',
        type: 'success' as const,
        boundaries: {},
        metadata: recordMetadata
      }

      await client.sendLogByUuid(executionRecord, 'task-uuid-123', sendLogMetadata)

      const callArgs = mockedAxios.post.mock.calls[0]
      const requestBody = callArgs[1] as { projectUuid: string; taskUuid: string; logItem: string }
      const logItem = JSON.parse(requestBody.logItem)

      // Should have UUID generated
      expect(logItem.uuid).toBeDefined()
      expect(typeof logItem.uuid).toBe('string')

      // Should have merged metadata (sendLog > record > client)
      expect(logItem.metadata).toEqual({
        environment: 'test',    // from client
        version: '1.0',         // from client
        session: 'abc123',      // from record
        priority: 'high'        // from sendLog (highest priority)
      })
    })
  })
})
