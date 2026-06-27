import { Schema } from '../index'

describe('Schema Custom Number Validations', () => {
  it('should validate number min/max constraints', () => {
    const schema = new Schema({
      age: Schema.number().min(18).max(100),
      score: Schema.number().min(0).max(100)
    })

    // Valid cases
    expect(schema.validate({ age: 25, score: 85 })).toBe(true)
    expect(schema.validate({ age: 18, score: 0 })).toBe(true)
    expect(schema.validate({ age: 100, score: 100 })).toBe(true)

    // Invalid cases
    expect(schema.validate({ age: 17, score: 85 })).toBe(false)
    expect(schema.validate({ age: 25, score: -1 })).toBe(false)
    expect(schema.validate({ age: 101, score: 85 })).toBe(false)
    expect(schema.validate({ age: 25, score: 101 })).toBe(false)
  })

  it('should describe number validations as JSON Schema', () => {
    const schema = new Schema({
      age: Schema.number().min(18).max(100)
    })

    const description = schema.describe()
    expect(description.properties?.age).toEqual({
      type: 'number',
      minimum: 18,
      maximum: 100
    })
  })
})

describe('Schema Custom String Validations', () => {
  it('should validate string email format', () => {
    const schema = new Schema({
      email: Schema.email()
    })

    // Valid cases
    expect(schema.validate({ email: 'user@example.com' })).toBe(true)
    expect(schema.validate({ email: 'test.name@domain.co.uk' })).toBe(true)
    expect(schema.validate({ email: 'user+tag@example.com' })).toBe(true)

    // Invalid cases
    expect(schema.validate({ email: 'not-an-email' })).toBe(false)
    expect(schema.validate({ email: 'missing@domain' })).toBe(false)
    expect(schema.validate({ email: '@domain.com' })).toBe(false)
  })

  it('should validate string length constraints', () => {
    const schema = new Schema({
      username: Schema.string().min(3).max(20)
    })

    // Valid cases
    expect(schema.validate({ username: 'abc' })).toBe(true)
    expect(schema.validate({ username: 'valid_username' })).toBe(true)
    expect(schema.validate({ username: 'a'.repeat(20) })).toBe(true)

    // Invalid cases
    expect(schema.validate({ username: 'ab' })).toBe(false)
    expect(schema.validate({ username: 'a'.repeat(21) })).toBe(false)
  })

  it('should validate string regex pattern', () => {
    const schema = new Schema({
      username: Schema.string().regex(/^[a-zA-Z0-9_]+$/)
    })

    // Valid cases
    expect(schema.validate({ username: 'john_doe123' })).toBe(true)
    expect(schema.validate({ username: 'User123' })).toBe(true)
    expect(schema.validate({ username: '123456' })).toBe(true)

    // Invalid cases
    expect(schema.validate({ username: 'john-doe' })).toBe(false)
    expect(schema.validate({ username: 'user@123' })).toBe(false)
    expect(schema.validate({ username: 'user name' })).toBe(false)
  })

  it('should describe string length validations as JSON Schema', () => {
    const schema = new Schema({
      email: Schema.email().min(5).max(100)
    })

    const description = schema.describe()
    expect(description.properties?.email).toMatchObject({
      type: 'string',
      format: 'email',
      minLength: 5,
      maxLength: 100
    })
  })

  it('should describe string regex validation as a pattern', () => {
    const schema = new Schema({
      username: Schema.string().regex(/^[a-zA-Z0-9_]+$/)
    })

    const description = schema.describe()
    expect(description.properties?.username).toMatchObject({
      type: 'string',
      pattern: '^[a-zA-Z0-9_]+$'
    })
  })

  it('should handle regex with other string validations', () => {
    const schema = new Schema({
      username: Schema.string().regex(/^[a-zA-Z0-9_]+$/).min(3).max(20)
    })

    // Valid cases
    expect(schema.validate({ username: 'john_doe123' })).toBe(true)
    expect(schema.validate({ username: 'User123' })).toBe(true)

    // Invalid cases - regex
    expect(schema.validate({ username: 'john-doe' })).toBe(false)
    expect(schema.validate({ username: 'user@123' })).toBe(false)

    // Invalid cases - length
    expect(schema.validate({ username: 'ab' })).toBe(false)
    expect(schema.validate({ username: 'a'.repeat(21) })).toBe(false)
  })

  it('should handle regex patterns containing forward slashes', () => {
    const schema = new Schema({
      path: Schema.string().regex(/^\/api\/v[0-9]+\/users\/[0-9]+$/)
    })

    // Valid cases
    expect(schema.validate({ path: '/api/v1/users/123' })).toBe(true)
    expect(schema.validate({ path: '/api/v2/users/456' })).toBe(true)
    expect(schema.validate({ path: '/api/v10/users/789' })).toBe(true)

    // Invalid cases
    expect(schema.validate({ path: 'api/v1/users/123' })).toBe(false)
    expect(schema.validate({ path: '/api/v1/users' })).toBe(false)
    expect(schema.validate({ path: '/api/v1/users/abc' })).toBe(false)

    // Verify the description preserves the pattern (regex source keeps escaped slashes)
    const description = schema.describe()
    expect(description.properties?.path).toMatchObject({
      type: 'string',
      pattern: '^\\/api\\/v[0-9]+\\/users\\/[0-9]+$'
    })
  })

  it('should handle round trip of regex patterns containing forward slashes', () => {
    const schema = new Schema({
      path: Schema.string().regex(/^\/api\/v[0-9]+\/users\/[0-9]+$/)
    })

    const description = schema.describe()
    const cloneSchema = Schema.from(description)

    // Valid cases
    expect(cloneSchema.validate({ path: '/api/v1/users/123' })).toBe(true)
    expect(cloneSchema.validate({ path: '/api/v2/users/456' })).toBe(true)
    expect(cloneSchema.validate({ path: '/api/v10/users/789' })).toBe(true)

    // Invalid cases
    expect(cloneSchema.validate({ path: 'api/v1/users/123' })).toBe(false)
    expect(cloneSchema.validate({ path: '/api/v1/users' })).toBe(false)
    expect(cloneSchema.validate({ path: '/api/v1/users/abc' })).toBe(false)

    // Verify the description preserves the pattern (regex source keeps escaped slashes)
    const cloneDescription = cloneSchema.describe()
    expect(cloneDescription.properties?.path).toMatchObject({
      type: 'string',
      pattern: '^\\/api\\/v[0-9]+\\/users\\/[0-9]+$'
    })
  })
})

describe('Schema Roundtrip', () => {
  it('should maintain custom validations through describe/from cycle', () => {
    const originalSchema = new Schema({
      age: Schema.number().min(18).max(100),
      email: Schema.email(),
      username: Schema.string().regex(/^[a-zA-Z0-9_]+$/).min(3).max(20)
    })

    const description = originalSchema.describe()
    const reconstructedSchema = Schema.from(description)

    // Both schemas should validate the same data
    const validData = {
      age: 25,
      email: 'user@example.com',
      username: 'john_doe123'
    }
    const invalidData = {
      age: 17,
      email: 'not-an-email',
      username: 'john-doe'
    }

    expect(originalSchema.validate(validData)).toBe(true)
    expect(reconstructedSchema.validate(validData)).toBe(true)
    expect(originalSchema.validate(invalidData)).toBe(false)
    expect(reconstructedSchema.validate(invalidData)).toBe(false)
  })
})
