import { Task, createTask, Schema } from '../index'

describe('Task run without arguments', () => {
  it('should run a task with no arguments', async () => {
    // Create a task that doesn't require arguments
    const noArgsTask = new Task(function () {
      return 'success'
    })

    // Call run without passing any arguments
    const result = await noArgsTask.run()

    // Verify the result
    expect(result).toBe('success')
  })

  it('should run a task with optional arguments', async () => {
    // Create a task with optional arguments
    const optionalArgsTask = new Task(function (argv?: { value?: string }) {
      return argv?.value || 'default'
    })

    // Call run without passing any arguments
    const defaultResult = await optionalArgsTask.run()

    // Call run with arguments for comparison
    const customResult = await optionalArgsTask.run({ value: 'custom' })

    // Verify the results
    expect(defaultResult).toBe('default')
    expect(customResult).toBe('custom')
  })

  describe('Empty Schema Tasks', () => {
    it('should accept undefined input and normalize to empty object', async () => {
      const emptySchema = new Schema({
        // No fields defined - should accept any input including undefined
      })

      const task = createTask({
        name: 'emptySchemaTask',
        schema: emptySchema,
        boundaries: {},
        fn: async (input) => {
          return { received: input }
        }
      })

      // Should work with undefined input
      const [result, error, record] = await task.safeRun()

      expect(error).toBeNull()
      expect(record.input).toEqual({}) // Should normalize undefined to {}
      expect(result).toEqual({ received: {} })
    })

    it('should validate empty schema tasks correctly', async () => {
      const emptySchema = new Schema({})

      const task = createTask({
        name: 'validationTask',
        schema: emptySchema,
        boundaries: {},
        fn: async (_input) => {
          return { processed: true }
        }
      })

      // Empty schema should validate successfully
      expect(task.isValid()).toBe(true)
      expect(task.isValid(undefined)).toBe(true)
      expect(task.isValid({})).toBe(true)
    })

    it('should work correctly with empty object input', async () => {
      const emptySchema = new Schema({})

      const task = createTask({
        name: 'workingTask',
        schema: emptySchema,
        boundaries: {},
        fn: async (input) => {
          return { received: input }
        }
      })

      // This should continue to work correctly
      const [result, error, record] = await task.safeRun({})

      expect(error).toBeNull()
      expect(record.input).toEqual({})
      expect(result).toEqual({ received: {} })
    })

    it('should normalize undefined input to empty object for consistency', async () => {
      const emptySchema = new Schema({})

      const task = createTask({
        name: 'normalizationTask',
        schema: emptySchema,
        boundaries: {},
        fn: async (input) => {
          return { inputType: typeof input, input }
        }
      })

      // Undefined input should be normalized to {}
      const [result, error, record] = await task.safeRun()

      expect(error).toBeNull()
      expect(record.input).toEqual({}) // Should normalize undefined to {}
      expect(result).not.toBeNull()
      expect(result!.inputType).toBe('object')
      expect(result!.input).toEqual({})
    })
  })
})
