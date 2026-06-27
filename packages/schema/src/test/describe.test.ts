import { Schema } from '../index'

// `describe()` serializes a Schema to standard JSON Schema (draft 2020-12).
// Each test builds a Schema with the Schema.* helpers and asserts the EXACT
// JSON Schema it produces, so the wire format is obvious at a glance.

const $schema = 'https://json-schema.org/draft/2020-12/schema'

describe('Schema.describe() -> JSON Schema', () => {
  it('basic types', () => {
    const schema = new Schema({
      name: Schema.string(),
      age: Schema.number(),
      active: Schema.boolean(),
    })

    expect(schema.describe()).toEqual({
      $schema,
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        active: { type: 'boolean' },
      },
      required: ['name', 'age', 'active'],
      additionalProperties: false,
    })
  })

  it('string validations', () => {
    const schema = new Schema({
      username: Schema.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
    })

    expect(schema.describe()).toEqual({
      $schema,
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
      additionalProperties: false,
    })
  })

  it('number validations', () => {
    const schema = new Schema({
      age: Schema.number().min(18).max(100),
    })

    expect(schema.describe()).toEqual({
      $schema,
      type: 'object',
      properties: {
        age: { type: 'number', minimum: 18, maximum: 100 },
      },
      required: ['age'],
      additionalProperties: false,
    })
  })

  it('optional fields are omitted from `required`', () => {
    const schema = new Schema({
      name: Schema.string(),
      age: Schema.number().optional(),
    })

    expect(schema.describe()).toEqual({
      $schema,
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
      required: ['name'], // age is optional, so it is not required
      additionalProperties: false,
    })
  })

  it('arrays', () => {
    const schema = new Schema({
      tags: Schema.array(Schema.string()),
      scores: Schema.array(Schema.number()),
    })

    expect(schema.describe()).toEqual({
      $schema,
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
        scores: { type: 'array', items: { type: 'number' } },
      },
      required: ['tags', 'scores'],
      additionalProperties: false,
    })
  })

  it('records', () => {
    const schema = new Schema({
      strings: Schema.stringRecord(),
      mixed: Schema.mixedRecord(),
    })

    expect(schema.describe()).toEqual({
      $schema,
      type: 'object',
      properties: {
        strings: {
          type: 'object',
          propertyNames: { type: 'string' },
          additionalProperties: { type: 'string' },
        },
        mixed: {
          type: 'object',
          propertyNames: { type: 'string' },
          additionalProperties: {
            anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
          },
        },
      },
      required: ['strings', 'mixed'],
      additionalProperties: false,
    })
  })

  it('nested objects', () => {
    const schema = new Schema({
      user: Schema.object({
        name: Schema.string(),
        age: Schema.number().optional(),
      }),
    })

    expect(schema.describe()).toEqual({
      $schema,
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
          },
          required: ['name'],
          additionalProperties: false,
        },
      },
      required: ['user'],
      additionalProperties: false,
    })
  })

  it('element descriptions', () => {
    const schema = new Schema({
      name: Schema.string().describe('The name of the user'),
    })

    expect(schema.describe()).toEqual({
      $schema,
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The name of the user' },
      },
      required: ['name'],
      additionalProperties: false,
    })
  })

  it('string formats: email, uuid, url, date', () => {
    const schema = new Schema({
      email: Schema.email(),
      id: Schema.uuid(),
      site: Schema.url(),
      when: Schema.date(),
    })

    // Format keywords are the stable part; the generated `pattern` strings are
    // long and version-specific, so we assert the meaningful keys.
    const properties = schema.describe().properties
    expect(properties?.email).toMatchObject({ type: 'string', format: 'email' })
    expect(properties?.id).toMatchObject({ type: 'string', format: 'uuid' })
    expect(properties?.site).toMatchObject({ type: 'string', format: 'uri' })
    expect(properties?.when).toMatchObject({ type: 'string', format: 'date-time' })
  })
})
