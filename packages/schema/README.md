# @forgehive/schema

A thin, type-safe wrapper around [Zod 4](https://zod.dev) that adds JSON Schema serialization and rehydration on top of native Zod validation.

## Installation

```bash
npm install @forgehive/schema
```

## Overview

`@forgehive/schema` wraps a Zod object schema in a `Schema` class. Fields are created with the
`Schema.*` helpers, which keeps your call sites independent of the underlying validation library —
so Zod can be swapped or upgraded without touching consumer code. In return you get:

- **Type-safe validation** — `parse`, `safeParse`, `validate`
- **Type inference** — `InferSchema<typeof schema>`
- **JSON Schema serialization** — `describe()` emits standard [JSON Schema](https://zod.dev/json-schema) (draft 2020-12)
- **Rehydration** — `Schema.from(jsonSchema)` rebuilds a `Schema` from JSON Schema

Helpers return real Zod types, so chaining (`.min()`, `.optional()`, `.describe()`, ...) works as
usual. The full `z` namespace is also re-exported as an escape hatch for anything the helpers
don't cover. See [`docs/specs/schema.md`](../../docs/specs/schema.md) for the design rationale.

## Basic Usage

```typescript
import { Schema } from '@forgehive/schema';

const userSchema = new Schema({
  name: Schema.string().describe('The name of the user'),
  age: Schema.number().min(0).max(120),
  email: Schema.email(),
  tags: Schema.array(Schema.string()),
});

const result = userSchema.safeParse({
  name: 'John Doe',
  age: 30,
  email: 'john@example.com',
  tags: ['user', 'active'],
});

if (result.success) {
  // TypeScript knows the shape of the data
  console.log(result.data.name); // string
}
```

## Building Fields

Use the `Schema.*` helpers to declare fields:

```typescript
// Basic types
Schema.string()
Schema.number()
Schema.boolean()
Schema.date()    // ISO 8601 date-time string (see note below)

// String formats (serialize to JSON Schema `format`)
Schema.email()   // format: "email"
Schema.uuid()    // format: "uuid"
Schema.url()     // format: "uri"

// Arrays
Schema.array(Schema.string())

// Nested objects
Schema.object({
  street: Schema.string(),
  zip: Schema.string().regex(/^[0-9]{5}$/),
})

// Records
Schema.stringRecord()  // Record<string, string>
Schema.numberRecord()  // Record<string, number>
Schema.booleanRecord() // Record<string, boolean>
Schema.mixedRecord()   // Record<string, string | number | boolean>
```

Validations and metadata are added with chaining: `.min()`, `.max()`, `.regex()`, `.optional()`,
`.describe('...')`, etc.

For anything the helpers don't cover (enums, unions, refinements), reach for the re-exported `z`:

```typescript
import { Schema, z } from '@forgehive/schema';

const schema = new Schema({
  role: z.enum(['admin', 'user', 'guest']),
});
```

> **Note on dates:** `Schema.date()` validates an ISO 8601 date-time **string**
> (e.g. `"2024-03-20T12:00:00Z"`), not a `Date` instance. JSON Schema has no native date type,
> so dates are represented as `{ type: "string", format: "date-time" }`.

## Validation

```typescript
const schema = new Schema({
  name: Schema.string(),
  age: Schema.number(),
});

// Parse and throw on error
const data = schema.parse({ name: 'John', age: 30 });

// Safe parse with a result object
const result = schema.safeParse({ name: 'John', age: 30 });
if (result.success) {
  const data = result.data;
} else {
  const issues = result.error.issues; // ZodError
}

// Validate without parsing (boolean)
const isValid = schema.validate({ name: 'John', age: 30 });
```

## Serialization (`describe`) and Rehydration (`from`)

`describe()` returns standard JSON Schema. Every validation and `.describe()` on a field is
included automatically:

```typescript
const schema = new Schema({
  name: Schema.string().describe('The name of the user'),
  age: Schema.number().min(0),
  email: Schema.email(),
  nickname: Schema.string().optional(),
});

const description = schema.describe();
// {
//   "$schema": "https://json-schema.org/draft/2020-12/schema",
//   "type": "object",
//   "properties": {
//     "name":     { "type": "string", "description": "The name of the user" },
//     "age":      { "type": "number", "minimum": 0 },
//     "email":    { "type": "string", "format": "email", "pattern": "..." },
//     "nickname": { "type": "string" }
//   },
//   "required": ["name", "age", "email"],   // optional fields are absent here
//   "additionalProperties": false
// }
```

Optionality is expressed by the `required` array (JSON Schema semantics), not a per-field flag.

`Schema.from()` rebuilds a `Schema` from JSON Schema. A `describe()` → `from()` round-trip
preserves validations, descriptions, and which fields are optional:

```typescript
const clone = Schema.from(schema.describe());
clone.validate({ name: 'Jane', age: 5, email: 'jane@example.com' }); // true
```

> `Schema.from()` is backed by `z.fromJSONSchema`, which Zod considers semi-experimental.
> Round-trips of schemas produced by `describe()` are covered by this package's tests.

## Type Inference

```typescript
import { Schema, type InferSchema } from '@forgehive/schema';

const schema = new Schema({
  name: Schema.string(),
  age: Schema.number(),
});

type User = InferSchema<typeof schema>;
// { name: string; age: number }
```

## API Reference

### `Schema` class

- `constructor(fields)` — creates a schema from a map of field name → field type
- `parse(data)` — parses and validates, throws `ZodError` on failure
- `safeParse(data)` — returns a Zod `{ success, data | error }` result
- `validate(data)` — validates without parsing, returns a boolean
- `describe()` — returns the schema as JSON Schema (draft 2020-12)
- `asZod()` — returns the underlying `z.ZodObject`

### Static methods

- `string()`, `number()`, `boolean()`, `date()` — basic field types
- `email()`, `uuid()`, `url()` — string-format field types
- `array(type)` — array of the given field type
- `object(fields)` — nested object schema
- `stringRecord()`, `numberRecord()`, `booleanRecord()`, `mixedRecord()` — record types
- `from(jsonSchema)` — rebuilds a `Schema` from JSON Schema
- `infer(schema)` — type-level inference helper

### Exports

- `Schema` (also the default export)
- `z` — the full Zod 4 namespace, re-exported as an escape hatch
- Types: `SchemaType`, `SchemaDescription` (JSON Schema), `InferSchema`

## License

MIT
