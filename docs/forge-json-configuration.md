# forge.json Configuration Guide

The `forge.json` file is the main configuration file for Forge projects. It defines project metadata, file paths, infrastructure settings, tasks, and runners.

## File Location

The `forge.json` file should be located in the root directory of your Forge project.

## Configuration Schema

### Complete Example

```json
{
  "project": {
    "name": "my-forge-project",
    "uuid": "167aa373-cecc-42b5-90d1-a29454d76504"
  },
  "paths": {
    "logs": "logs/",
    "tasks": "src/tasks/",
    "runners": "src/runners/",
    "fixtures": "fixtures/",
    "fingerprints": "fingerprints/",
    "tests": "src/tests/"
  },
  "infra": {
    "region": "us-west-2",
    "bucket": "my-project-bucket"
  },
  "build": {
    "externalPackages": ["@playwright/test", "puppeteer"]
  },
  "tasks": {
    "myTask:run": {
      "path": "src/tasks/myTask/run.ts",
      "handler": "run",
      "uuid": "a45aafe3-8b01-4b58-b15d-9a96274858ee"
    }
  },
  "runners": {
    "myRunner": {
      "path": "src/runners/myRunner.ts",
      "version": "1.0.0"
    }
  }
}
```

## Configuration Options

### `project` (required)

Project metadata and identification.

**Properties:**
- `name` (string, required): The name of your project
- `uuid` (string, optional): Unique identifier for the project. Generated when you run `forge project:create` or `forge project:link`

**Example:**
```json
{
  "project": {
    "name": "my-forge-project",
    "uuid": "167aa373-cecc-42b5-90d1-a29454d76504"
  }
}
```

### `paths` (required)

Directory paths used by the Forge CLI for organizing project files.

**Properties:**
- `logs` (string, required): Directory for task execution logs
- `tasks` (string, required): Directory containing task implementations
- `runners` (string, required): Directory containing runner implementations
- `fixtures` (string, required): Directory for test fixtures and mock data
- `fingerprints` (string, required): Directory for task fingerprints (type information)
- `tests` (string, required): Directory for test files

**Example:**
```json
{
  "paths": {
    "logs": "logs/",
    "tasks": "src/tasks/",
    "runners": "src/runners/",
    "fixtures": "fixtures/",
    "fingerprints": "fingerprints/",
    "tests": "src/tests/"
  }
}
```

### `infra` (required)

Infrastructure configuration for cloud deployments.

**Properties:**
- `region` (string, required): AWS region for infrastructure resources
- `bucket` (string, required): S3 bucket name for storing task bundles and artifacts

**Example:**
```json
{
  "infra": {
    "region": "us-west-2",
    "bucket": "my-project-bucket"
  }
}
```

### `build` (optional)

Build configuration for bundling tasks and runners with esbuild.

**Properties:**
- `externalPackages` (array of strings, optional): List of package names that should be excluded from the bundle. These packages will be loaded externally at runtime instead of being bundled.

**Use Cases:**
- Packages with native bindings (e.g., `@playwright/test`, `puppeteer`)
- Large packages that shouldn't be bundled
- Packages that need to be loaded from `node_modules` at runtime

**Example:**
```json
{
  "build": {
    "externalPackages": [
      "@playwright/test",
      "puppeteer",
      "canvas"
    ]
  }
}
```

### `tasks` (required)

Task definitions mapping task names to their implementations.

**Structure:**
Each key is a task descriptor (usually in format `domain:action`), and the value is an object with:

**Properties:**
- `path` (string, required): Relative path to the task file from project root
- `handler` (string, required): Name of the exported task function from the file
- `uuid` (string, optional): Unique identifier for the task. Generated when you sync tasks with `forge project:sync`

**Example:**
```json
{
  "tasks": {
    "stock:getPrice": {
      "path": "src/tasks/stock/getPrice.ts",
      "handler": "getPrice",
      "uuid": "a45aafe3-8b01-4b58-b15d-9a96274858ee"
    },
    "user:create": {
      "path": "src/tasks/user/create.ts",
      "handler": "create"
    }
  }
}
```

**Task Naming Convention:**
- Use format `domain:action` (e.g., `user:create`, `stock:getPrice`)
- Keep names descriptive and consistent
- Group related tasks by domain

### `runners` (required)

Runner definitions for orchestrating multiple tasks.

**Structure:**
Each key is a runner name, and the value is an object with:

**Properties:**
- `path` (string, required): Relative path to the runner file from project root
- `version` (string, required): Version number for the runner
- `upload` (object, optional): S3 upload configuration
  - `bucket` (string): S3 bucket for uploading the runner bundle
  - `path` (string): S3 path within the bucket

**Example:**
```json
{
  "runners": {
    "dataProcessor": {
      "path": "src/runners/dataProcessor.ts",
      "version": "1.0.0",
      "upload": {
        "bucket": "my-runners-bucket",
        "path": "runners/dataProcessor"
      }
    }
  }
}
```

## CLI Commands that Modify forge.json

Several Forge CLI commands will automatically update your `forge.json`:

- `forge init` - Creates initial `forge.json` file
- `forge task:create <name>` - Adds new task to `tasks` section
- `forge task:remove <name>` - Removes task from `tasks` section
- `forge runner:create <name>` - Adds new runner to `runners` section
- `forge runner:remove <name>` - Removes runner from `runners` section
- `forge project:create` - Generates and adds project UUID
- `forge project:link` - Links to existing project and adds UUID
- `forge project:sync` - Syncs tasks and adds UUIDs

## Best Practices

1. **Version Control**: Always commit `forge.json` to version control
2. **UUIDs**: Don't manually edit UUIDs - let the CLI manage them
3. **Paths**: Use relative paths with trailing slashes for directories
4. **Naming**: Use consistent naming conventions for tasks (domain:action format)
5. **External Packages**: Only add packages to `externalPackages` when necessary (e.g., native bindings, large packages)
6. **Infrastructure**: Keep infrastructure settings environment-specific using environment variables if needed

## Validation

The Forge CLI validates your `forge.json` structure when running commands. Common validation errors:

- **Missing required fields**: Ensure all required top-level properties exist
- **Invalid paths**: Task/runner paths must point to existing files
- **Duplicate task names**: Each task must have a unique descriptor name
- **Invalid handler names**: Handler must match an exported function from the task file

## Migration Guide

If you're upgrading from an older version of Forge:

1. **Add `build` section** (optional): If you need to exclude packages from bundling
   ```json
   {
     "build": {
       "externalPackages": ["@playwright/test"]
     }
   }
   ```

2. **Add UUIDs**: Run `forge project:link` or `forge project:create` to add project UUID
3. **Sync tasks**: Run `forge project:sync` to add task UUIDs
4. **Update paths**: Ensure all paths use the correct format with trailing slashes

## TypeScript Type Definition

The `forge.json` structure is defined by the `ForgeConf` interface in `apps/cli/src/tasks/types.ts`:

```typescript
export interface ForgeConf {
  project: {
    name: string
    uuid?: string
  }
  paths: {
    logs: string
    tasks: string
    runners: string
    fixtures: string
    fingerprints: string
    tests: string
  }
  infra: {
    region: string
    bucket: string
  }
  tasks: Record<string, TaskDescriptor>
  runners: Record<string, RunnerDescriptor>
  build?: {
    externalPackages?: string[]
  }
}
```
