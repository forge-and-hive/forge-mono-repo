import { createTask, Schema } from '../index'

describe('Task safeRun tests', () => {
  it('returns [result, null, record] on successful execution', async () => {
    // Create a simple schema
    const schema = new Schema({
      value: Schema.number()
    })

    // Define the boundaries
    const boundaries = {
      fetchData: async (value: number): Promise<number> => {
        return value * 2
      }
    }

    // Create the task
    const successTask = createTask({
      name: 'successTask',
      schema,
      boundaries,
      fn: async function ({ value }, { fetchData }) {
        const result = await fetchData(value)
        return { result, success: true }
      }
    })

    // Call safeRun with valid input
    const [result, error, record] = await successTask.safeRun({ value: 5 })

    // Verify success case
    expect(error).toBeNull()
    expect(result).toEqual({ result: 10, success: true })
    expect(record).not.toBeNull()
    expect(record).toHaveProperty('boundaries.fetchData')
    expect(record.boundaries.fetchData).toHaveLength(1)

    // useful to check types on record
    const data = record.boundaries.fetchData[0]
    expect(data.input).toEqual([5])
    expect(data.output).toEqual(10)
    expect(data.error).toBeUndefined()
    expect(data.timing).toEqual(expect.objectContaining({
      startTime: expect.any(Number),
      endTime: expect.any(Number),
      duration: expect.any(Number)
    }))
  })

  it('returns [null, error, record] on failed execution', async () => {
    // Create a simple schema
    const schema = new Schema({
      value: Schema.number()
    })

    // Define the boundaries with a function that will throw an error
    const boundaries = {
      fetchData: async (value: number): Promise<number> => {
        if (value < 0) {
          throw new Error('Value cannot be negative')
        }
        return value * 2
      }
    }

    // Create the task
    const errorTask = createTask({
      name: 'errorTask',
      schema,
      boundaries,
      fn: async function ({ value }, { fetchData }) {
        const result = await fetchData(value)
        return { result, success: true }
      }
    })

    // Call safeRun with problematic input that will cause an error
    const [result, error, record] = await errorTask.safeRun({ value: -5 })

    // Verify error case
    expect(error).not.toBeNull()
    expect(error instanceof Error).toBe(true)
    if (error instanceof Error) {
      expect(error.message).toContain('Value cannot be negative')
    }
    expect(result).toBeNull()
    expect(record).not.toBeNull()
    expect(record).toHaveProperty('boundaries.fetchData')
    expect(record.boundaries.fetchData).toHaveLength(1)

    const data = record.boundaries.fetchData[0]
    expect(data.input).toEqual([-5])
    expect(data.error).toContain('Value cannot be negative')
    expect(data.output).toBeUndefined()
    expect(data.timing).toEqual(expect.objectContaining({
      startTime: expect.any(Number),
      endTime: expect.any(Number),
      duration: expect.any(Number)
    }))
  })

  it('returns [null, error, record] on schema validation failure', async () => {
    // Create a schema that requires a positive number
    const schema = new Schema({
      value: Schema.number().min(1, 'Value must be positive')
    })

    // Define the boundaries
    const boundaries = {
      fetchData: async (value: number): Promise<number> => {
        return value * 2
      }
    }

    // Create the task
    const validationTask = createTask({
      name: 'validationTask',
      schema,
      boundaries,
      fn: async function ({ value }, { fetchData }) {
        const result = await fetchData(value)
        return { result, success: true }
      }
    })

    // Call safeRun with invalid input that will fail schema validation
    const [result, error, record] = await validationTask.safeRun({ value: 0 })

    // Verify validation error case
    expect(error).toBeInstanceOf(Error)
    expect(error instanceof Error).toBe(true)
    if (error instanceof Error) {
      expect(error.message).toContain('Value must be positive')
    }
    expect(result).toBeNull()
    expect(record).not.toBeNull()
    expect(record.input).toEqual({ value: 0 })
    expect(record.error).toContain('Value must be positive')
    expect(record.boundaries).toEqual({
      fetchData: []
    })
  })

  it('properly calls the listener with safeRun and run', async () => {
    // Create a schema
    const schema = new Schema({
      value: Schema.number()
    })

    // Define the boundaries
    const boundaries = {
      fetchData: async (value: number): Promise<number> => {
        return value * 2
      }
    }

    // Create the task
    const listenerTask = createTask({
      name: 'listenerTask',
      schema,
      boundaries,
      fn: async function ({ value }, { fetchData }) {
        const result = await fetchData(value)
        return result
      }
    })

    // Create a mock listener
    const originalListener = jest.fn()
    listenerTask.addListener(originalListener)

    // Call safeRun - this should call the listener once
    await listenerTask.safeRun({ value: 10 })

    // Run the task normally - this should call the listener again through safeRun
    await listenerTask.run({ value: 20 })

    // The original listener should have been called for both runs
    expect(originalListener).toHaveBeenCalledTimes(2)

    // First call should be for safeRun with value 10
    expect(originalListener).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: { value: 10 },
        output: 20,
        boundaries: {
          fetchData: expect.any(Array)
        }
      })
    )

    // Second call should be for run with value 20
    expect(originalListener).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: { value: 20 },
        output: 40,
        boundaries: {
          fetchData: expect.any(Array)
        }
      })
    )
  })

  it('handles multiple boundary calls correctly', async () => {
    // Create a schema
    const schema = new Schema({
      values: Schema.array(Schema.number())
    })

    // Define multiple boundaries
    const boundaries = {
      doubleValue: async (value: number): Promise<number> => {
        return value * 2
      },
      sumValues: async (values: number[]): Promise<number> => {
        return values.reduce((sum, val) => sum + val, 0)
      }
    }

    // Create a task that uses multiple boundaries
    const multiBoundaryTask = createTask({
      name: 'multiBoundaryTask',
      schema,
      boundaries,
      fn: async function ({ values }, { doubleValue, sumValues }) {
        const doubled = await Promise.all(values.map(value => doubleValue(value)))
        const total = await sumValues(doubled)
        return { doubled, total }
      }
    })

    // Call safeRun
    const [result, error, record] = await multiBoundaryTask.safeRun({ values: [1, 2, 3] })

    // Verify success
    expect(error).toBeNull()
    expect(result).toEqual({
      doubled: [2, 4, 6],
      total: 12
    })

    // Verify record structure
    expect(record).not.toBeNull()
    expect(record).toHaveProperty('boundaries.doubleValue')
    expect(record).toHaveProperty('boundaries.sumValues')

    expect(record.boundaries.doubleValue).toHaveLength(3)
    expect(record.boundaries.sumValues).toHaveLength(1)
    expect(record.boundaries.doubleValue[0]).toEqual({
      input: [1],
      output: 2,
      timing: expect.objectContaining({
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        duration: expect.any(Number)
      })
    })
    expect(record.boundaries.doubleValue[1]).toEqual({
      input: [2],
      output: 4,
      timing: expect.objectContaining({
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        duration: expect.any(Number)
      })
    })
    expect(record.boundaries.doubleValue[2]).toEqual({
      input: [3],
      output: 6,
      timing: expect.objectContaining({
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        duration: expect.any(Number)
      })
    })
    expect(record.boundaries.sumValues[0]).toEqual({
      input: [[2, 4, 6]],
      output: 12,
      timing: expect.objectContaining({
        startTime: expect.any(Number),
        endTime: expect.any(Number),
        duration: expect.any(Number)
      })
    })
  })

  describe('Empty Schema Tasks', () => {
    it('should accept undefined input and normalize to empty object', async () => {
      const emptySchema = new Schema({})

      const task = createTask({
        name: 'emptySchemaTask',
        schema: emptySchema,
        boundaries: {},
        fn: async (input) => {
          return { received: input, type: typeof input }
        }
      })

      // Should work with undefined input (no arguments passed)
      const [result, error, record] = await task.safeRun()

      expect(error).toBeNull()
      expect(record.input).toEqual({}) // Should normalize undefined to {}
      expect(result).toEqual({ received: {}, type: 'object' })
    })

    it('should validate empty schema tasks correctly', async () => {
      const emptySchema = new Schema({})

      const task = createTask({
        name: 'validationTask',
        schema: emptySchema,
        boundaries: {},
        fn: async (input) => ({ processed: true, input })
      })

      // Empty schema should validate successfully
      expect(task.isValid()).toBe(true)
      expect(task.isValid(undefined)).toBe(true)
      expect(task.isValid({})).toBe(true)
    })

    it('should support replay with normalized empty schema records', async () => {
      const emptySchema = new Schema({})

      const task = createTask({
        name: 'replayTask',
        schema: emptySchema,
        boundaries: {
          getData: async () => 'test-data'
        },
        fn: async (input, { getData }) => {
          const data = await getData()
          return { data, inputReceived: input }
        }
      })

      // Create a record with undefined input (should normalize to {})
      const [originalResult, originalError, originalRecord] = await task.safeRun()

      expect(originalError).toBeNull()
      expect(originalResult).toEqual({
        data: 'test-data',
        inputReceived: {}
      })
      expect(originalRecord.input).toEqual({})

      // Replay should work with the normalized input
      const [replayResult, replayError, replayRecord] = await task.safeReplay(
        originalRecord,
        { boundaries: { getData: 'replay' } }
      )

      expect(replayError).toBeNull()
      expect(replayResult).toEqual(originalResult)
      expect(replayRecord.input).toEqual(originalRecord.input)
    })

    it('should create consistent execution records for different input types', async () => {
      const emptySchema = new Schema({})

      const task = createTask({
        name: 'consistencyTask',
        schema: emptySchema,
        boundaries: {},
        fn: async (input) => ({ inputReceived: input, type: typeof input })
      })

      // Test different input scenarios - all should normalize to {} for empty schema
      const scenarios = [
        { name: 'undefined', input: undefined, expectedInput: {} },
        { name: 'empty object', input: {}, expectedInput: {} }
      ]

      for (const scenario of scenarios) {
        const [result, error, record] = await task.safeRun(scenario.input as undefined | Record<string, never>)

        expect(error).toBeNull()
        expect(record).toHaveProperty('input')
        expect(record).toHaveProperty('output')
        expect(record).toHaveProperty('type')
        expect(record).toHaveProperty('boundaries')
        expect(record.type).toBe('success')
        expect(record.input).toEqual(scenario.expectedInput)
        expect(result).toEqual({ inputReceived: scenario.expectedInput, type: 'object' })
      }
    })
  })
})
