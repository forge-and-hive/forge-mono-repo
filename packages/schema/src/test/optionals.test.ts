import { Schema } from '../index'

describe('Schema Optional Fields', () => {
  describe('Optional Fields', () => {
    it('should handle optional string fields', () => {
      const schema = new Schema({
        name: Schema.string().optional(),
        age: Schema.number()
      })

      // Valid with optional field present
      expect(schema.validate({ name: 'John', age: 30 })).toBe(true)

      // Valid with optional field missing
      expect(schema.validate({ age: 30 })).toBe(true)

      // Invalid - missing required field
      expect(schema.validate({ name: 'John' })).toBe(false)
    })

    it('should handle optional array fields', () => {
      const schema = new Schema({
        tags: Schema.array(Schema.string()).optional(),
        scores: Schema.array(Schema.number())
      })

      // Valid with optional array present
      expect(schema.validate({ tags: ['tag1', 'tag2'], scores: [1, 2, 3] })).toBe(true)

      // Valid with optional array missing
      expect(schema.validate({ scores: [1, 2, 3] })).toBe(true)

      // Invalid - missing required array
      expect(schema.validate({ tags: ['tag1'] })).toBe(false)
    })

    it('should correctly describe optional fields', () => {
      const schema = new Schema({
        name: Schema.string().optional(),
        age: Schema.number(),
        tags: Schema.array(Schema.string()).optional()
      })

      const description = schema.describe()

      // Optionality is expressed by absence from the `required` list
      expect(description.required).toEqual(['age'])
      expect(description.properties?.name).toEqual({ type: 'string' })
      expect(description.properties?.age).toEqual({ type: 'number' })
      expect(description.properties?.tags).toEqual({ type: 'array', items: { type: 'string' } })
    })
  })

  describe('Schema Roundtrip', () => {
    it('should maintain optional fields through describe/from cycle', () => {
      const originalSchema = new Schema({
        name: Schema.string().optional(),
        age: Schema.number(),
        tags: Schema.array(Schema.string()).optional()
      })

      const description = originalSchema.describe()
      const reconstructedSchema = Schema.from(description)

      // Both schemas should validate the same data
      const validData = { name: 'John', age: 30, tags: ['tag1'] }
      const dataWithoutOptional = { age: 30 }

      expect(originalSchema.validate(validData)).toBe(true)
      expect(reconstructedSchema.validate(validData)).toBe(true)
      expect(originalSchema.validate(dataWithoutOptional)).toBe(true)
      expect(reconstructedSchema.validate(dataWithoutOptional)).toBe(true)

      // The reconstructed schema preserves which field stayed required
      expect(reconstructedSchema.describe().required).toEqual(['age'])
    })
  })
})
