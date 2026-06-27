import { Schema, type SchemaDescription } from '../index'

// `Schema.from()` rebuilds a Schema from standard JSON Schema. Each test feeds
// an EXPLICIT JSON Schema object and then validates concrete data, so the
// accepted input format and its effect are obvious at a glance.

describe('Schema.from(JSON Schema) -> validation', () => {
  it('basic types', () => {
    const jsonSchema: SchemaDescription = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        active: { type: 'boolean' },
      },
      required: ['name', 'age', 'active'],
    }

    const schema = Schema.from(jsonSchema)

    expect(schema.validate({ name: 'John', age: 30, active: true })).toBe(true)
    expect(schema.validate({ name: 'John', age: '30', active: true })).toBe(false) // age not a number
    expect(schema.validate({ name: 'John', age: 30 })).toBe(false) // active missing
  })

  it('string validations (min, max, pattern)', () => {
    const jsonSchema: SchemaDescription = {
      type: 'object',
      properties: {
        username: {
          type: 'string',
          minLength: 3,
          maxLength: 20,
          pattern: '^[a-zA-Z0-9_]+$',
        },
      },
      required: ['username'],
    }

    const schema = Schema.from(jsonSchema)

    expect(schema.validate({ username: 'john_doe' })).toBe(true)
    expect(schema.validate({ username: 'ab' })).toBe(false) // too short
    expect(schema.validate({ username: 'a'.repeat(21) })).toBe(false) // too long
    expect(schema.validate({ username: 'john-doe' })).toBe(false) // pattern mismatch
  })

  it('number validations (minimum, maximum)', () => {
    const jsonSchema: SchemaDescription = {
      type: 'object',
      properties: {
        age: { type: 'number', minimum: 18, maximum: 100 },
      },
      required: ['age'],
    }

    const schema = Schema.from(jsonSchema)

    expect(schema.validate({ age: 25 })).toBe(true)
    expect(schema.validate({ age: 18 })).toBe(true)
    expect(schema.validate({ age: 17 })).toBe(false) // below minimum
    expect(schema.validate({ age: 101 })).toBe(false) // above maximum
  })

  it('optional fields (absent from `required`)', () => {
    const jsonSchema: SchemaDescription = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'], // age is optional
    }

    const schema = Schema.from(jsonSchema)

    expect(schema.validate({ name: 'John', age: 30 })).toBe(true)
    expect(schema.validate({ name: 'John' })).toBe(true) // optional age omitted
    expect(schema.validate({ age: 30 })).toBe(false) // required name omitted
  })

  it('arrays', () => {
    const jsonSchema: SchemaDescription = {
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['tags'],
    }

    const schema = Schema.from(jsonSchema)

    expect(schema.validate({ tags: ['a', 'b'] })).toBe(true)
    expect(schema.validate({ tags: [] })).toBe(true)
    expect(schema.validate({ tags: ['a', 2] })).toBe(false) // wrong item type
  })

  it('records (additionalProperties)', () => {
    const jsonSchema: SchemaDescription = {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          propertyNames: { type: 'string' },
          additionalProperties: { type: 'number' },
        },
      },
      required: ['data'],
    }

    const schema = Schema.from(jsonSchema)

    expect(schema.validate({ data: { a: 1, b: 2 } })).toBe(true)
    expect(schema.validate({ data: { a: 'x' } })).toBe(false) // value not a number
  })

  it('mixed records (anyOf additionalProperties)', () => {
    const jsonSchema: SchemaDescription = {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          propertyNames: { type: 'string' },
          additionalProperties: {
            anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
          },
        },
      },
      required: ['data'],
    }

    const schema = Schema.from(jsonSchema)

    expect(schema.validate({ data: { a: 'x', b: 1, c: true } })).toBe(true)
    expect(schema.validate({ data: { a: [1, 2] } })).toBe(false) // array not allowed
  })

  it('nested objects', () => {
    const jsonSchema: SchemaDescription = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 2 },
            age: { type: 'number' },
          },
          required: ['name'],
        },
      },
      required: ['user'],
    }

    const schema = Schema.from(jsonSchema)

    expect(schema.validate({ user: { name: 'John', age: 30 } })).toBe(true)
    expect(schema.validate({ user: { name: 'John' } })).toBe(true) // nested age optional
    expect(schema.validate({ user: { name: 'J' } })).toBe(false) // name too short
    expect(schema.validate({ user: { age: 30 } })).toBe(false) // nested name required
  })

  it('string format: email', () => {
    const jsonSchema: SchemaDescription = {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
      },
      required: ['email'],
    }

    const schema = Schema.from(jsonSchema)

    expect(schema.validate({ email: 'john@example.com' })).toBe(true)
    expect(schema.validate({ email: 'not-an-email' })).toBe(false)
  })

  it('string format: date-time', () => {
    const jsonSchema: SchemaDescription = {
      type: 'object',
      properties: {
        createdAt: { type: 'string', format: 'date-time' },
      },
      required: ['createdAt'],
    }

    const schema = Schema.from(jsonSchema)

    expect(schema.validate({ createdAt: '2024-03-20T12:00:00Z' })).toBe(true)
    expect(schema.validate({ createdAt: 'not-a-date' })).toBe(false)
  })
})
