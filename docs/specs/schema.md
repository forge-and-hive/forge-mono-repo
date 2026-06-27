# Schema

This document describes `@forgehive/schema` — the wrapper the toolchain uses to define a task's
input schema, validate inputs at runtime, and serialize the schema to a portable format that the
CLI and Hive server can store and render.

It is written to be language-agnostic: enough detail to re-implement the same behavior on another
runtime or validation library.

---

## Purpose

Every task has an input schema. That schema needs to do two jobs:

1. **Validate** input at runtime (reject bad arguments before the task body runs).
2. **Be serialized** to a portable, language-neutral description so it can be:
   - stored on the Hive server when a task is published (`schemaDescriptor`),
   - rendered as CLI help (`forge <task> --help`),
   - inspected by tooling without executing the task.

`@forgehive/schema` provides both from a single definition.

---

## The wrapper approach

The package is a deliberately thin wrapper around [Zod 4](https://zod.dev). It is one class,
`Schema`, that holds a Zod object schema:

```typescript
class Schema {
  readonly schema: z.ZodObject   // the underlying Zod object

  constructor(fields) {
    this.schema = z.object(fields)
  }
}
```

A schema is constructed from a map of **field name → field type**. Fields are created with the
`Schema.*` helpers:

```typescript
import { Schema } from '@forgehive/schema'

const schema = new Schema({
  name: Schema.string(),
  age: Schema.number().min(0).max(120),
  email: Schema.email(),
})
```

### Why wrap Zod instead of using it directly?

- **Library independence.** Consumers reference `Schema.*` for field construction, not `z.*`.
  This keeps every call site decoupled from the underlying validation library, so Zod can be
  upgraded or swapped wholesale by changing only the wrapper — consumers don't move.
- **Serialization contract.** `describe()` (→ JSON Schema) and `Schema.from()` (← JSON Schema)
  are the contract the rest of the toolchain depends on. Co-locating them on one type means
  callers never reach into Zod internals or re-implement the conversion.
- **A single handle to pass around.** The toolchain passes one type — `Schema` — through
  `getSchema()` / `setSchema()` / `describe()`.

The helpers return real Zod types, so chaining (`.min()`, `.optional()`, `.describe()`, ...)
works as usual. `z` is also re-exported as an **escape hatch** for types the helpers don't cover
(enums, unions, refinements). The wrapper widens; it never restricts.

### Field builders

| Helper | Underlying Zod | Runtime type |
|--------|----------------|--------------|
| `Schema.string()` | `z.string()` | `string` |
| `Schema.number()` | `z.number()` | `number` |
| `Schema.boolean()` | `z.boolean()` | `boolean` |
| `Schema.date()` | `z.iso.datetime()` | `string` (ISO 8601 date-time) |
| `Schema.email()` | `z.email()` | `string` |
| `Schema.uuid()` | `z.uuid()` | `string` |
| `Schema.url()` | `z.url()` | `string` |
| `Schema.array(type)` | `z.array(type)` | `T[]` |
| `Schema.object(fields)` | `z.object(fields)` | nested object |
| `Schema.stringRecord()` | `z.record(z.string(), z.string())` | `Record<string, string>` |
| `Schema.numberRecord()` | `z.record(z.string(), z.number())` | `Record<string, number>` |
| `Schema.booleanRecord()` | `z.record(z.string(), z.boolean())` | `Record<string, boolean>` |
| `Schema.mixedRecord()` | `z.record(z.string(), z.union([...]))` | `Record<string, string \| number \| boolean>` |

Validations and metadata are added with chaining: `.min()`, `.max()`, `.regex()`, `.optional()`,
`.describe('...')`, etc. Whatever Zod can express, a field can carry.

> **Dates are strings.** JSON Schema has no date type, so `Schema.date()` is an ISO 8601
> date-time *string* (`z.iso.datetime()`), e.g. `"2024-03-20T12:00:00Z"`. The runtime value is a
> string, not a `Date`.

---

## Validation

| Method | Behavior |
|--------|----------|
| `parse(data)` | Returns typed data, throws `ZodError` on failure |
| `safeParse(data)` | Returns `{ success: true, data }` or `{ success: false, error }` |
| `validate(data)` | Returns a boolean (`safeParse(...).success`) |
| `asZod()` | Returns the underlying `z.ZodObject` for advanced use |

On failure, `error.issues` holds the list of `{ path, message }` validation issues (Zod 4 names
this `issues`, not `errors`).

---

## Serialization: `describe()`

`describe()` returns standard **JSON Schema (draft 2020-12)**, produced by Zod's native
`z.toJSONSchema(this.schema, { target: 'draft-2020-12' })`. There is no custom serializer —
every Zod validation and `.describe()` is mapped to its JSON Schema equivalent automatically.

Given:

```typescript
new Schema({
  name: Schema.string().describe('The name of the user'),
  age: Schema.number().min(0),
  email: Schema.email(),
  nickname: Schema.string().optional(),
})
```

`describe()` produces:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name":     { "type": "string", "description": "The name of the user" },
    "age":      { "type": "number", "minimum": 0 },
    "email":    { "type": "string", "format": "email", "pattern": "..." },
    "nickname": { "type": "string" }
  },
  "required": ["name", "age", "email"],
  "additionalProperties": false
}
```

### Mapping rules (selected)

| Definition | JSON Schema |
|------------|-------------|
| `Schema.string()` | `{ "type": "string" }` |
| `Schema.number().min(0).max(10)` | `{ "type": "number", "minimum": 0, "maximum": 10 }` |
| `Schema.string().min(3).max(20)` | `{ "type": "string", "minLength": 3, "maxLength": 20 }` |
| `Schema.string().regex(/.../)` | `{ "type": "string", "pattern": "..." }` |
| `.describe('text')` | adds `"description": "text"` |
| `Schema.email()` | `{ "type": "string", "format": "email", "pattern": "..." }` |
| `Schema.date()` | `{ "type": "string", "format": "date-time", "pattern": "..." }` |
| `Schema.array(Schema.string())` | `{ "type": "array", "items": { "type": "string" } }` |
| `Schema.object({...})` | nested `{ "type": "object", "properties": {...}, "required": [...] }` |
| `Schema.stringRecord()` | `{ "type": "object", "additionalProperties": { "type": "string" } }` |
| `Schema.mixedRecord()` | `additionalProperties.anyOf: [string, number, boolean]` |
| `.optional()` | field is omitted from the object's `required` array |

**Optionality** is a JSON Schema concept: a field is optional if it is **absent from the
`required` array**, not via a per-field flag. Consumers (e.g. CLI help) determine optionality by
checking membership in `required`.

---

## Rehydration: `Schema.from()`

`Schema.from(jsonSchema)` rebuilds a `Schema` from JSON Schema. It is backed by Zod's
`z.fromJSONSchema`, then wraps the resulting object's shape back into a `Schema`:

```typescript
static from(description) {
  const zod = z.fromJSONSchema(description)   // -> z.ZodObject
  return new Schema(zod.shape)
}
```

A `describe()` → `from()` round-trip preserves validations, descriptions, and optionality:

```typescript
const clone = Schema.from(original.describe())
// clone validates and serializes equivalently to `original`
```

> `z.fromJSONSchema` is considered **semi-experimental** by Zod; its behavior may change across
> Zod releases. The toolchain only relies on round-tripping schemas produced by `describe()`,
> which is covered by the package's test suite.

---

## Wire format and the Hive server

When a task is published, the CLI calls `schema.describe()` and sends the result as the
`schemaDescriptor` field (a JSON string) in the publish payload — see
[`cli.md`](./cli.md) and [`hive-server.md`](./hive-server.md). As of the JSON Schema migration,
`schemaDescriptor` is **standard JSON Schema**, not a custom shape. Anything that reads
`schemaDescriptor` (storage, rendering, re-validation) should treat it as JSON Schema and can
rehydrate it with any JSON-Schema-aware validator (or `Schema.from()`).

---

## Type inference

`InferSchema<typeof schema>` yields the TypeScript type of validated data, derived from the
underlying Zod object (`z.infer`). This is purely a compile-time utility.

```typescript
type User = InferSchema<typeof schema>  // { name: string; age: number; ... }
```
