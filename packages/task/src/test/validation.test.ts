import { Task, type TaskInstanceType } from '../index'
import { Schema, type InferSchema } from '@forgehive/schema'

describe('Validation tests', () => {
  let task: TaskInstanceType

  beforeEach(() => {
    const schema = new Schema({
      value: Schema.number()
    })

    task = new Task(function (argv: InferSchema<typeof schema>) {
      return argv
    }, {
      schema
    })
  })

  it('Should be invalid', () => {
    const check = task.isValid({ value: null })

    expect(check).toBe(false)
  })

  it('Should be valid', () => {
    const check = task.isValid({ value: 5 })

    expect(check).toBe(true)
  })

  it('Should validate data as part of run function', async () => {
    try {
      await task.run({ value: null })
      // If we get here, the test should fail
      expect('no error thrown').toBeUndefined()
    } catch (e) {
      const error = e as Error

      expect(error.message).toEqual('Invalid input on: value: Invalid input: expected number, received null')
    }
  })

  it('Should provide detailed error messages', async () => {
    try {
      await task.run({ value: 'null' })
      // If we get here, the test should fail
      expect('no error thrown').toBeUndefined()
    } catch (e: unknown) {
      const error = e as Error

      // Test the error message format
      expect(error.message).toEqual('Invalid input on: value: Invalid input: expected number, received string')
    }
  })

  it('Should work well', async () => {
    const result = await task.run({ value: 5 })
    expect(result.value).toBe(5)
  })
})

describe('Validation tests on param', () => {
  let task: TaskInstanceType

  beforeEach(() => {
    const schema = new Schema({
      name: Schema.string()
    })

    task = new Task(function (argv: InferSchema<typeof schema>) {
      return argv
    }, {
      schema
    })
  })

  it('Should be invalid', () => {
    const check = task.isValid({ name: null })

    expect(check).toBe(false)
  })

  it('Should be valid', () => {
    const check = task.isValid({ name: 'John Doe' })

    expect(check).toBe(true)
  })

  it('Should validate data as part of run function', async () => {
    try {
      await task.run({ name: null })
      // If we get here, the test should fail
      expect('no error thrown').toBeUndefined()
    } catch (e) {
      const error = e as Error
      expect(error.message).toEqual('Invalid input on: name: Invalid input: expected string, received null')
    }
  })

  it('Should work well', async () => {
    const result = await task.run({ name: 'John Doe' })

    expect(result.name).toBe('John Doe')
  })
})

describe('Validation multiple values tests', () => {
  let task: TaskInstanceType

  beforeEach(() => {
    const schema = new Schema({
      value: Schema.number(),
      increment: Schema.number()
    })

    task = new Task(function (argv: InferSchema<typeof schema>) {
      return argv
    }, {
      schema
    })
  })

  it('Should be on both invalid but fail in first', async () => {
    try {
      await task.run({ value: null })
      // If we get here, the test should fail
      expect('no error thrown').toBeUndefined()
    } catch (e) {
      const error = e as Error
      expect(error.message).toEqual('Invalid input on: value: Invalid input: expected number, received null, increment: Invalid input: expected number, received undefined')
    }
  })

  it('Should be on both invalid but fail in increment', async () => {
    try {
      await task.run({ value: 5 })
      // If we get here, the test should fail
      expect('no error thrown').toBeUndefined()
    } catch (e) {
      const error = e as Error
      expect(error.message).toEqual('Invalid input on: increment: Invalid input: expected number, received undefined')
    }
  })

  it('Should work well', async () => {
    const result = await task.run({ value: 5, increment: 1 })

    expect(result.value).toBe(5)
    expect(result.increment).toBe(1)
  })
})

describe('Get Schema', () => {
  it('Object as string', async () => {
    const add2 = new Task(function (int: number) {
      return int + 2
    }, {
      schema: new Schema({
        value: Schema.number()
      })
    })

    const schema = add2.getSchema()
    const schemaDescription = schema?.describe() ?? {}

    expect(schemaDescription).toMatchObject({
      type: 'object',
      properties: { value: { type: 'number' } },
      required: ['value']
    })
  })

  it('Empty object as string', async () => {
    const add2 = new Task(function (int: number) {
      return int + 2
    }, {})

    const schema = add2.getSchema()

    expect(schema).toBeUndefined()
  })
})

describe('Set Schema', () => {
  it('Object as string', async () => {
    const add2 = new Task(function (int: number) {
      return int + 2
    })

    add2.setSchema(new Schema({
      value: Schema.number()
    }))

    const schema = add2.getSchema()
    const schemaDescription = schema?.describe() ?? {}

    expect(schemaDescription).toMatchObject({
      type: 'object',
      properties: { value: { type: 'number' } },
      required: ['value']
    })
  })

  it('Empty object as string', async () => {
    const add2 = new Task(function (int: number) {
      return int + 2
    })

    const schema = add2.getSchema()

    expect(schema).toBeUndefined()
  })
})

describe('Multiple validation errors', () => {
  let task: TaskInstanceType

  beforeEach(() => {
    const schema = new Schema({
      name: Schema.string(),
      age: Schema.number(),
      email: Schema.string().email()
    })

    task = new Task(function (argv: InferSchema<typeof schema>) {
      return argv
    }, {
      schema
    })
  })

  it('Should report all validation errors', async () => {
    try {
      await task.run({ name: 123, age: 'twenty', email: 'invalid-email' })
      // If we get here, the test should fail
      expect('no error thrown').toBeUndefined()
    } catch (e: unknown) {
      const error = e as Error
      // Test that multiple errors are reported
      expect(error.message).toContain('Invalid input on')
      expect(error.message).toContain('name: Invalid input: expected string, received number')
      expect(error.message).toContain('age: Invalid input: expected number, received string')
      expect(error.message).toContain('email: Invalid email address')
    }
  })
})

describe('Array validation tests', () => {
  let task: TaskInstanceType

  beforeEach(() => {
    const schema = new Schema({
      tags: Schema.array(Schema.string())
    })

    task = new Task(function (argv: InferSchema<typeof schema>) {
      return argv
    }, {
      schema
    })
  })

  it('Should be invalid with non-array value', () => {
    const check = task.isValid({ tags: 'not an array' })
    expect(check).toBe(false)
  })

  it('Should be invalid with array containing non-string items', () => {
    const check = task.isValid({ tags: ['valid', 123, true] })
    expect(check).toBe(false)
  })

  it('Should be valid with string array', () => {
    const check = task.isValid({ tags: ['tag1', 'tag2', 'tag3'] })
    expect(check).toBe(true)
  })

  it('Should validate array data on run', async () => {
    try {
      await task.run({ tags: 'not an array' })
      // If we get here, the test should fail
      expect('no error thrown').toBeUndefined()
    } catch (e) {
      const error = e as Error
      expect(error.message).toEqual('Invalid input on: tags: Invalid input: expected array, received string')
    }
  })

  it('Should validate array items on run', async () => {
    try {
      await task.run({ tags: ['valid', 123, true] })
      // If we get here, the test should fail
      expect('no error thrown').toBeUndefined()
    } catch (e) {
      const error = e as Error
      expect(error.message).toContain('Invalid input on')
      expect(error.message).toContain('tags.1: Invalid input: expected string, received number')
      expect(error.message).toContain('tags.2: Invalid input: expected string, received boolean')
    }
  })

  it('Should work with valid string array', async () => {
    const result = await task.run({ tags: ['tag1', 'tag2', 'tag3'] })
    expect(result.tags).toEqual(['tag1', 'tag2', 'tag3'])
  })
})

describe('MixedRecord validation tests', () => {
  let task: TaskInstanceType

  beforeEach(() => {
    const schema = new Schema({
      metadata: Schema.mixedRecord()
    })

    task = new Task(function (argv: InferSchema<typeof schema>) {
      return argv
    }, {
      schema
    })
  })

  it('Should be invalid with non-object value', () => {
    const check = task.isValid({ metadata: 'not an object' })
    expect(check).toBe(false)
  })

  it('Should be invalid with non-string keys', () => {
    // In JavaScript, object keys are always coerced to strings, so this actually becomes a valid record
    // with a string key "123"
    const check = task.isValid({ metadata: { 123: 'value' }})
    expect(check).toBe(true)
  })

  it('Should be valid with mixed value types', () => {
    const check = task.isValid({
      metadata: {
        stringValue: 'text',
        numberValue: 42,
        booleanValue: true
      }
    })
    expect(check).toBe(true)
  })

  it('Should validate record type on run', async () => {
    try {
      await task.run({ metadata: 'not an object' })
      // If we get here, the test should fail
      expect('no error thrown').toBeUndefined()
    } catch (e) {
      const error = e as Error
      expect(error.message).toEqual('Invalid input on: metadata: Invalid input: expected record, received string')
    }
  })

  it('Should validate value types on run', async () => {
    try {
      await task.run({ metadata: { valid: 'string', invalid: { nested: 'object' } }})
      // If we get here, the test should fail
      expect('no error thrown').toBeUndefined()
    } catch (e) {
      const error = e as Error
      expect(error.message).toContain('Invalid input on')
      // The actual error message from Zod for this case
      expect(error.message).toContain('metadata.invalid: Invalid input')
    }
  })

  it('Should work with valid mixed record', async () => {
    const validData = {
      metadata: {
        stringValue: 'text',
        numberValue: 42,
        booleanValue: true
      }
    }
    const result = await task.run(validData)
    expect(result).toEqual(validData)
  })
})
