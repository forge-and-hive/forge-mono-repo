import { Schema } from '../index'

describe('Schema.parse()', () => {
  it('returns typed data on success', () => {
    const schema = new Schema({
      name: Schema.string(),
      age: Schema.number(),
    })

    const data = schema.parse({ name: 'John', age: 30 })

    expect(data).toEqual({ name: 'John', age: 30 })
    // Type-level: the result is { name: string; age: number }
    const name: string = data.name
    const age: number = data.age
    expect(name).toBe('John')
    expect(age).toBe(30)
  })

  it('strips unknown keys', () => {
    const schema = new Schema({
      name: Schema.string(),
    })

    const data = schema.parse({ name: 'John', extra: 'ignored' })

    expect(data).toEqual({ name: 'John' })
    expect(data).not.toHaveProperty('extra')
  })

  it('coerces nothing and throws ZodError on invalid data', () => {
    const schema = new Schema({
      name: Schema.string(),
      age: Schema.number(),
    })

    expect(() => schema.parse({ name: 'John', age: 'thirty' })).toThrow()
  })

  it('throws a ZodError exposing issues with path and message', () => {
    const schema = new Schema({
      name: Schema.string(),
      age: Schema.number().min(18),
    })

    try {
      schema.parse({ name: 123, age: 10 })
      throw new Error('expected parse to throw')
    } catch (err) {
      const zodError = err as { issues?: Array<{ path: PropertyKey[]; message: string }> }
      expect(Array.isArray(zodError.issues)).toBe(true)
      const paths = (zodError.issues ?? []).map((issue) => issue.path.join('.'))
      expect(paths).toContain('name')
      expect(paths).toContain('age')
    }
  })

  it('parses nested objects and optionals', () => {
    const schema = new Schema({
      user: Schema.object({
        name: Schema.string(),
        nickname: Schema.string().optional(),
      }),
    })

    expect(schema.parse({ user: { name: 'John' } })).toEqual({ user: { name: 'John' } })
    expect(schema.parse({ user: { name: 'John', nickname: 'JJ' } })).toEqual({
      user: { name: 'John', nickname: 'JJ' },
    })
    expect(() => schema.parse({ user: {} })).toThrow()
  })
})

describe('Schema.safeParse()', () => {
  it('returns success: true with data on valid input', () => {
    const schema = new Schema({
      name: Schema.string(),
      age: Schema.number(),
    })

    const result = schema.safeParse({ name: 'John', age: 30 })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ name: 'John', age: 30 })
      // Type-level: result.data is fully typed
      const name: string = result.data.name
      expect(name).toBe('John')
    }
  })

  it('returns success: false with an error on invalid input', () => {
    const schema = new Schema({
      name: Schema.string(),
      age: Schema.number(),
    })

    const result = schema.safeParse({ name: 'John', age: 'thirty' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBeDefined()
      expect(Array.isArray(result.error.issues)).toBe(true)
      const paths = result.error.issues.map((issue) => issue.path.join('.'))
      expect(paths).toContain('age')
    }
  })

  it('does not throw on invalid input', () => {
    const schema = new Schema({
      age: Schema.number(),
    })

    expect(() => schema.safeParse({ age: 'nope' })).not.toThrow()
  })

  it('reports each failing field in the issues list', () => {
    const schema = new Schema({
      email: Schema.email(),
      age: Schema.number().min(18),
      username: Schema.string().min(3),
    })

    const result = schema.safeParse({ email: 'nope', age: 5, username: 'ab' })

    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'))
      expect(paths).toEqual(expect.arrayContaining(['email', 'age', 'username']))
    }
  })

  it('strips unknown keys on success', () => {
    const schema = new Schema({
      name: Schema.string(),
    })

    const result = schema.safeParse({ name: 'John', extra: true })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ name: 'John' })
    }
  })

  it('infers optional fields as possibly undefined', () => {
    const schema = new Schema({
      name: Schema.string(),
      age: Schema.number().optional(),
    })

    const result = schema.safeParse({ name: 'John' })

    expect(result.success).toBe(true)
    if (result.success) {
      const age: number | undefined = result.data.age
      expect(age).toBeUndefined()
    }
  })
})
