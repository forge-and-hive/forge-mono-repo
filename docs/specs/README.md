# Specs

Implementation reference documents for the forge toolchain. These are written to be language-agnostic — enough detail to re-implement any part in another language or runtime.

## Documents

| Doc | What it covers |
|-----|---------------|
| [schema.md](./schema.md) | The `@forgehive/schema` wrapper: field builders, validation, JSON Schema serialization (`describe`/`from`), and the `schemaDescriptor` wire format |
| [cli.md](./cli.md) | Every CLI command: arguments, flags, file I/O, API calls, side effects |
| [hive-server.md](./hive-server.md) | Hive server API contract: all endpoints, request/response shapes, auth, data structures |
| [fingerprint.md](./fingerprint.md) | Task fingerprinting: data structure, AST analysis algorithm, storage, publish integration |
| [build-and-run.md](./build-and-run.md) | Build pipeline (esbuild bundling) and task execution: boundaries, execution modes, log format, replay, Hive integration |
