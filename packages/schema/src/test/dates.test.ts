import { Schema } from '../index'

// Dates are represented as ISO 8601 date-time strings (Schema.date() ->
// z.iso.datetime()), which are natively representable in JSON Schema.

describe('Schema single date field', () => {
  const schema = new Schema({
    createdAt: Schema.date()
  })

  it('should validate a valid ISO date-time string', () => {
    const data = {
      createdAt: new Date().toISOString()
    }
    expect(schema.validate(data)).toBe(true)
  })

  it('should validate a fixed ISO date-time string', () => {
    const data = {
      createdAt: '2024-03-20T12:00:00Z'
    }
    expect(schema.validate(data)).toBe(true)
  })

  it('should reject an invalid date string', () => {
    const data = {
      createdAt: 'invalid-date'
    }
    expect(schema.validate(data)).toBe(false)
  })

  it('should reject a Date instance (runtime type is a string now)', () => {
    const data = {
      createdAt: new Date()
    }
    expect(schema.validate(data)).toBe(false)
  })

  it('should reject a non-date value', () => {
    const data = {
      createdAt: 123
    }
    expect(schema.validate(data)).toBe(false)
  })
})

describe('Schema array of dates', () => {
  const schema = new Schema({
    timestamps: Schema.array(Schema.date())
  })

  it('should validate an array of valid ISO date-time strings', () => {
    const data = {
      timestamps: [new Date().toISOString(), new Date().toISOString()]
    }
    expect(schema.validate(data)).toBe(true)
  })

  it('should validate an array of fixed ISO date-time strings', () => {
    const data = {
      timestamps: ['2024-03-20T12:00:00Z', '2024-03-21T12:00:00Z']
    }
    expect(schema.validate(data)).toBe(true)
  })

  it('should reject an array with an invalid date string', () => {
    const data = {
      timestamps: [new Date().toISOString(), 'invalid-date']
    }
    expect(schema.validate(data)).toBe(false)
  })

  it('should reject a non-array value', () => {
    const data = {
      timestamps: 'not-an-array'
    }
    expect(schema.validate(data)).toBe(false)
  })
})

describe('Dates Schema description', () => {
  it('should describe date fields as date-time formatted strings', () => {
    const schema = new Schema({
      createdAt: Schema.date(),
      timestamps: Schema.array(Schema.date())
    })

    const description = schema.describe()
    expect(description.properties?.createdAt).toMatchObject({
      type: 'string',
      format: 'date-time'
    })
    expect(description.properties?.timestamps).toMatchObject({
      type: 'array',
      items: { type: 'string', format: 'date-time' }
    })
  })

  it('should round-trip date validation through describe/from', () => {
    const schema = new Schema({
      createdAt: Schema.date()
    })

    const clone = Schema.from(schema.describe())
    expect(clone.validate({ createdAt: '2024-03-20T12:00:00Z' })).toBe(true)
    expect(clone.validate({ createdAt: 'invalid-date' })).toBe(false)
  })
})
