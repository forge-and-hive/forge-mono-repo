import { RecordTape } from '../index'

describe('RecordTape Data Methods', () => {
  let tape: RecordTape

  beforeEach(() => {
    tape = new RecordTape()
  })

  describe('getLength', () => {
    test('should return 0 for empty tape', () => {
      expect(tape.getLength()).toBe(0)
    })

    test('should return correct length after adding records', () => {
      const record1 = {
        uuid: 'test-uuid-1',
        input: { userId: 1 },
        output: { name: 'John' },
        taskName: 'getUser',
        boundaries: {},
        type: 'success' as const
      }

      const record2 = {
        uuid: 'test-uuid-2',
        input: { userId: 2 },
        output: { name: 'Jane' },
        taskName: 'getUser',
        boundaries: {},
        type: 'success' as const
      }

      tape.push(record1)
      expect(tape.getLength()).toBe(1)

      tape.push(record2)
      expect(tape.getLength()).toBe(2)
    })

    test('should return correct length after removing records', () => {
      const record = {
        uuid: 'test-uuid',
        input: { userId: 1 },
        output: { name: 'John' },
        taskName: 'getUser',
        boundaries: {},
        type: 'success' as const
      }

      tape.push(record)
      tape.push(record)
      expect(tape.getLength()).toBe(2)

      tape.shift()
      expect(tape.getLength()).toBe(1)

      tape.shift()
      expect(tape.getLength()).toBe(0)
    })
  })

  describe('shift', () => {
    test('should return undefined for empty tape', () => {
      expect(tape.shift()).toBeUndefined()
    })

    test('should return and remove first record', () => {
      const record1 = {
        uuid: 'test-uuid',
        input: { userId: 1 },
        output: { name: 'John' },
        taskName: 'getUser',
        boundaries: {},
        type: 'success' as const
      }

      const record2 = {
        input: { userId: 2 },
        output: { name: 'Jane' },
        taskName: 'getUser',
        boundaries: {},
        type: 'success' as const
      }

      tape.push(record1)
      tape.push(record2)

      const shiftedRecord = tape.shift()

      // Should return the first record
      expect(shiftedRecord).toEqual(expect.objectContaining({
        taskName: 'getUser',
        input: { userId: 1 },
        output: { name: 'John' },
        type: 'success'
      }))

      // Should have removed the first record
      expect(tape.getLength()).toBe(1)
      expect(tape.getLog()[0]).toEqual(expect.objectContaining({
        taskName: 'getUser',
        input: { userId: 2 },
        output: { name: 'Jane' },
        type: 'success'
      }))
    })

    test('should work correctly with multiple shifts', () => {
      const records = [
        {
          input: { userId: 1 },
          output: { name: 'John' },
          taskName: 'getUser',
          boundaries: {},
          type: 'success' as const
        },
        {
          input: { userId: 2 },
          output: { name: 'Jane' },
          taskName: 'getUser',
          boundaries: {},
          type: 'success' as const
        },
        {
          input: { userId: 3 },
          output: { name: 'Bob' },
          taskName: 'getUser',
          boundaries: {},
          type: 'success' as const
        }
      ]

      records.forEach(record => tape.push(record))
      expect(tape.getLength()).toBe(3)

      const first = tape.shift()
      expect(first?.input).toEqual({ userId: 1 })
      expect(tape.getLength()).toBe(2)

      const second = tape.shift()
      expect(second?.input).toEqual({ userId: 2 })
      expect(tape.getLength()).toBe(1)

      const third = tape.shift()
      expect(third?.input).toEqual({ userId: 3 })
      expect(tape.getLength()).toBe(0)

      const fourth = tape.shift()
      expect(fourth).toBeUndefined()
      expect(tape.getLength()).toBe(0)
    })
  })
})
