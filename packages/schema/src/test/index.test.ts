import Schema from '../index'

describe('Schema basic types', () => {
  it('should validate a string', () => {
    const schema = new Schema({
      name: Schema.string(),
    })

    const result = schema.validate({
      name: 'World',
    })

    expect(result).toBe(true)
  })

  it('should validate a string and number', () => {
    const schema = new Schema({
      name: Schema.string(),
      age: Schema.number(),
    })

    const result = schema.validate({
      name: 'World',
      age: 20,
    })

    expect(result).toEqual(true)
  })
})

describe('Schema description (JSON Schema)', () => {
  it('should describe a string', () => {
    const schema = new Schema({
      name: Schema.string(),
    })

    const result = schema.describe()
    expect(result.type).toBe('object')
    expect(result.properties).toEqual({
      name: { type: 'string' },
    })
    expect(result.required).toEqual(['name'])
  })

  it('should describe a string and number', () => {
    const schema = new Schema({
      name: Schema.string(),
      age: Schema.number(),
    })

    const result = schema.describe()
    expect(result.properties).toEqual({
      name: { type: 'string' },
      age: { type: 'number' },
    })
    expect(result.required).toEqual(['name', 'age'])
  })
})

describe('Schema hydrate', () => {
  it('should rebuild a schema from its description', () => {
    const original = new Schema({
      name: Schema.string(),
      age: Schema.number(),
    })

    const schema = Schema.from(original.describe())

    const result = schema.describe()
    expect(result.properties).toEqual({
      name: { type: 'string' },
      age: { type: 'number' },
    })
    expect(result.required).toEqual(['name', 'age'])
  })
})

describe('Schema validation errors', () => {
  it('should reject invalid string type', () => {
    const schema = new Schema({
      name: Schema.string(),
    })

    const result = schema.validate({
      name: 123, // number instead of string
    })

    expect(result).toBe(false)
  })

  it('should reject invalid number type', () => {
    const schema = new Schema({
      age: Schema.number(),
    })

    const result = schema.validate({
      age: 'not a number',
    })

    expect(result).toBe(false)
  })
})

describe('Schema optional fields', () => {
  it('should validate with missing optional field', () => {
    const schema = new Schema({
      name: Schema.string(),
      age: Schema.number().optional(),
    })

    const result = schema.validate({
      name: 'World',
    })

    expect(result).toBe(true)
  })

  it('should omit optional fields from the required list', () => {
    const schema = new Schema({
      name: Schema.string(),
      age: Schema.number().optional(),
    })

    const result = schema.describe()
    expect(result.required).toEqual(['name'])
    expect(result.properties).toHaveProperty('age')
  })
})

describe('Schema arrays', () => {
  it('should validate array of strings', () => {
    const schema = new Schema({
      tags: Schema.array(Schema.string()),
    })

    const result = schema.validate({
      tags: ['tag1', 'tag2', 'tag3'],
    })

    expect(result).toBe(true)
  })

  it('should validate array of numbers', () => {
    const schema = new Schema({
      scores: Schema.array(Schema.number()),
    })

    const result = schema.validate({
      scores: [1, 2, 3, 4, 5],
    })

    expect(result).toBe(true)
  })

  it('should reject invalid array types', () => {
    const schema = new Schema({
      tags: Schema.array(Schema.string()),
    })

    const result = schema.validate({
      tags: ['tag1', 123, 'tag3'], // mixed types
    })

    expect(result).toBe(false)
  })

  it('should validate empty arrays', () => {
    const schema = new Schema({
      tags: Schema.array(Schema.string()),
    })

    const result = schema.validate({
      tags: [],
    })

    expect(result).toBe(true)
  })

  it('should describe array schema', () => {
    const schema = new Schema({
      tags: Schema.array(Schema.string()),
      scores: Schema.array(Schema.number()),
    })

    const result = schema.describe()
    expect(result.properties).toEqual({
      tags: { type: 'array', items: { type: 'string' } },
      scores: { type: 'array', items: { type: 'number' } },
    })
  })

  it('should hydrate array schema from description', () => {
    const original = new Schema({
      tags: Schema.array(Schema.string()),
      scores: Schema.array(Schema.number()),
    })
    const schema = Schema.from(original.describe())

    const result = schema.describe()
    expect(result.properties).toEqual({
      tags: { type: 'array', items: { type: 'string' } },
      scores: { type: 'array', items: { type: 'number' } },
    })
  })
})

describe('Schema nested objects', () => {
  it('should validate and describe nested object fields', () => {
    const schema = new Schema({
      user: Schema.object({
        name: Schema.string(),
        age: Schema.number().optional(),
      }),
    })

    expect(schema.validate({ user: { name: 'John', age: 30 } })).toBe(true)
    expect(schema.validate({ user: { name: 'John' } })).toBe(true)
    expect(schema.validate({ user: { age: 30 } })).toBe(false)

    const result = schema.describe()
    expect(result.properties?.user).toMatchObject({
      type: 'object',
      properties: { name: { type: 'string' }, age: { type: 'number' } },
      required: ['name'],
    })
  })

  it('should round-trip a nested object schema', () => {
    const original = new Schema({
      user: Schema.object({
        name: Schema.string().min(3),
      }),
    })

    const clone = Schema.from(original.describe())
    expect(clone.validate({ user: { name: 'John' } })).toBe(true)
    expect(clone.validate({ user: { name: 'Jo' } })).toBe(false)
  })

  it('should infer types through safeParse for an optional nested object', () => {
    const base = new Schema({
      name: Schema.string().describe('The name of the user'),
      address: Schema.object({
        street: Schema.string(),
        city: Schema.string(),
        state: Schema.string(),
        zip: Schema.string(),
      }).optional().describe('The address of the user'),
    })

    // Optional nested object omitted
    const withoutAddress = base.safeParse({ name: 'World' })
    expect(withoutAddress.success).toBe(true)
    if (withoutAddress.success) {
      // res.data.name is string, res.data.address is optional
      const name: string = withoutAddress.data.name
      const street: string = withoutAddress.data.address?.street ?? ''
      expect(name).toBe('World')
      expect(street).toBe('')
    }

    // Optional nested object present
    const withAddress = base.safeParse({
      name: 'World',
      address: { street: 'Main', city: 'Town', state: 'CA', zip: '00000' },
    })
    expect(withAddress.success).toBe(true)
    if (withAddress.success) {
      expect(withAddress.data.address?.street).toBe('Main')
    }

    // Partial nested object is rejected (street/city/... required when present)
    expect(base.validate({ name: 'World', address: { street: 'Main' } })).toBe(false)
  })
})

describe('Schema custom validation', () => {
  it('should validate with custom rules', () => {
    const schema = new Schema({
      age: Schema.number().min(0).max(120),
      email: Schema.email(),
    })

    const result = schema.validate({
      age: 25,
      email: 'test@example.com',
    })

    expect(result).toBe(true)
  })

  it('should serialize element descriptions', () => {
    const schema = new Schema({
      name: Schema.string().describe('the user name'),
    })

    const result = schema.describe()
    expect(result.properties?.name).toMatchObject({
      type: 'string',
      description: 'the user name',
    })
  })

  it('should keep element descriptions through the describe/from round-trip', () => {
    const schema = new Schema({
      name: Schema.string().describe('The name of the user'),
      age: Schema.number().describe('The age of the user'),
    })

    const clone = Schema.from(schema.describe())
    const result = clone.describe()

    expect(result.properties?.name).toMatchObject({
      type: 'string',
      description: 'The name of the user',
    })
    expect(result.properties?.age).toMatchObject({
      type: 'number',
      description: 'The age of the user',
    })
  })
})
