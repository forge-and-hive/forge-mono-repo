import { z } from 'zod'

// `z` is re-exported as an escape hatch for zod types the helpers don't cover
// (enums, unions, refinements, ...). Prefer the `Schema.*` helpers for fields:
// they keep call sites independent of zod, so the underlying library can be
// swapped without touching consumers.
export { z }

/**
 * A single field within a schema. Any zod type is allowed, which enables
 * nested objects, arrays, records, unions and the full range of zod validations.
 */
export type SchemaType = z.ZodType

/**
 * The serialized form of a Schema. `describe()` produces standard JSON Schema
 * (draft 2020-12) and `from()` consumes it.
 */
export type SchemaDescription = z.core.JSONSchema.BaseSchema

/**
 * Infers the TypeScript type produced by a Schema instance.
 */
export type InferSchema<S extends Schema<z.ZodRawShape>> = z.infer<S['schema']>

/**
 * A thin wrapper around a zod object schema. Fields are created with the static
 * `Schema.*` helpers so call sites stay independent of the underlying validation
 * library; the wrapper owns validation plus JSON Schema serialization
 * (`describe`) and rehydration (`from`).
 */
export class Schema<T extends z.ZodRawShape = z.ZodRawShape> {
  readonly schema: z.ZodObject<T>

  constructor(fields: T) {
    this.schema = z.object(fields) as z.ZodObject<T>
  }

  /**
   * Creates a string schema
   * @returns A string schema
   */
  static string(): z.ZodString {
    return z.string()
  }

  /**
   * Creates a number schema
   * @returns A number schema
   */
  static number(): z.ZodNumber {
    return z.number()
  }

  /**
   * Creates a boolean schema
   * @returns A boolean schema
   */
  static boolean(): z.ZodBoolean {
    return z.boolean()
  }

  /**
   * Creates an ISO 8601 date-time schema. The runtime value is a string
   * (e.g. "2020-01-01T00:00:00Z"), which is natively representable in JSON Schema.
   * @returns An ISO date-time schema
   */
  static date(): z.ZodISODateTime {
    return z.iso.datetime()
  }

  /**
   * Creates an email string schema (serializes to JSON Schema `format: "email"`).
   * @returns An email schema
   */
  static email(): z.ZodEmail {
    return z.email()
  }

  /**
   * Creates a UUID string schema (serializes to JSON Schema `format: "uuid"`).
   * @returns A UUID schema
   */
  static uuid(): z.ZodUUID {
    return z.uuid()
  }

  /**
   * Creates a URL string schema (serializes to JSON Schema `format: "uri"`).
   * @returns A URL schema
   */
  static url(): z.ZodURL {
    return z.url()
  }

  /**
   * Creates an array schema
   * @param type The type of items in the array
   * @returns An array schema
   */
  static array<E extends z.ZodType>(type: E): z.ZodArray<E> {
    return z.array(type)
  }

  /**
   * Creates a nested object schema
   * @param fields The fields of the object
   * @returns An object schema
   */
  static object<S extends z.ZodRawShape>(fields: S): z.ZodObject<S> {
    return z.object(fields) as z.ZodObject<S>
  }

  /**
   * Creates a record schema with string keys and string values
   * @returns A record schema with string values
   */
  static stringRecord(): z.ZodRecord<z.ZodString, z.ZodString> {
    return z.record(z.string(), z.string())
  }

  /**
   * Creates a record schema with string keys and number values
   * @returns A record schema with number values
   */
  static numberRecord(): z.ZodRecord<z.ZodString, z.ZodNumber> {
    return z.record(z.string(), z.number())
  }

  /**
   * Creates a record schema with string keys and boolean values
   * @returns A record schema with boolean values
   */
  static booleanRecord(): z.ZodRecord<z.ZodString, z.ZodBoolean> {
    return z.record(z.string(), z.boolean())
  }

  /**
   * Creates a record schema with string keys and mixed values (string, number, or boolean)
   * @returns A record schema with mixed values
   */
  static mixedRecord(): z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>> {
    return z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  }

  /**
   * Infers the TypeScript type from a Schema instance
   * @template S The Schema type
   * @returns The inferred TypeScript type
   */
  static infer<S extends Schema<z.ZodRawShape>>(_schema: S): z.infer<S['schema']> {
    // This is a type-level utility, the implementation is not used at runtime
    return {} as z.infer<S['schema']>
  }

  /**
   * Creates a Schema instance from a JSON Schema description.
   *
   * Note: this relies on zod's `fromJSONSchema`, which zod considers
   * semi-experimental. Round-trips of schemas produced by `describe()` are
   * covered by the package tests.
   *
   * @param description A JSON Schema object describing an object schema
   * @returns A new Schema instance
   */
  static from(description: SchemaDescription): Schema<z.ZodRawShape> {
    const zodSchema = z.fromJSONSchema(description as z.core.JSONSchema.JSONSchema)

    if (!(zodSchema instanceof z.ZodObject)) {
      throw new Error('Schema.from expects a JSON Schema that describes an object')
    }

    return new Schema(zodSchema.shape)
  }

  /**
   * Validates the provided data against the schema
   * @param data The data to validate
   * @returns A boolean indicating whether the data is valid
   */
  validate(data: unknown): boolean {
    const result = this.schema.safeParse(data)

    return result.success
  }

  /**
   * Parses and validates the provided data against the schema
   * @param data The data to parse and validate
   * @returns The parsed and typed data
   * @throws {z.ZodError} If the data is invalid
   */
  parse(data: unknown): z.infer<z.ZodObject<T>> {
    return this.schema.parse(data)
  }

  /**
   * Safely parses and validates the provided data against the schema
   * @param data The data to parse and validate
   * @returns An object containing either the successfully parsed data or error information
   */
  safeParse(data: unknown): z.ZodSafeParseResult<z.infer<z.ZodObject<T>>> {
    return this.schema.safeParse(data)
  }

  /**
   * Serializes the schema to JSON Schema (draft 2020-12).
   * @returns A JSON Schema object describing the schema structure
   */
  describe(): SchemaDescription {
    return z.toJSONSchema(this.schema, { target: 'draft-2020-12' })
  }

  /**
   * Returns the underlying Zod schema object
   * @returns The Zod schema object
   */
  asZod(): z.ZodObject<T> {
    return this.schema
  }
}

export default Schema
