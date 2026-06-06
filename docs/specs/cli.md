# Forge CLI Reference

This document describes every command in the `forge` CLI. It is intended as a language-agnostic implementation reference — enough detail to re-implement the CLI in any language.

## Overview

- **Command format**: `forge <domain>:<action> [arguments] [--flags]`
- **Config file**: `forge.json` in the current working directory
- **Profiles file**: `~/.forge/profiles.json` (global, per-user)
- **Build cache**: `~/.forge/builds/` (bundled task files)

All commands that need auth read the active profile from `~/.forge/profiles.json`. Commands that interact with the Hive server use `profile.url` as the base URL with `Authorization: Bearer <apiKey>:<apiSecret>`.

---

## Local Configuration

### `forge.json` structure

Created by `forge init`. Read by almost every command.

```json
{
  "project": {
    "name": "my-project",
    "uuid": "...",
    "description": "..."
  },
  "paths": {
    "logs": "logs",
    "tasks": "src/tasks",
    "runners": "src/runners",
    "fixtures": "fixtures",
    "fingerprints": "fingerprints",
    "tests": "src/tests"
  },
  "infra": {
    "region": "us-east-1",
    "bucket": ""
  },
  "tasks": {
    "domain:taskName": {
      "path": "src/tasks/domain/taskName.ts",
      "handler": "default",
      "uuid": "..."
    }
  },
  "runners": {
    "runnerName": {
      "path": "src/runners/runnerName/index.ts",
      "version": "1.0.0"
    }
  }
}
```

### `~/.forge/profiles.json` structure

```json
{
  "default": "my-profile",
  "profiles": [
    {
      "name": "my-profile",
      "apiKey": "...",
      "apiSecret": "...",
      "url": "https://forgehive.dev",
      "teamName": "...",
      "teamUuid": "...",
      "userName": "..."
    }
  ]
}
```

---

## Commands

### Initialization

#### `forge init`

Creates a `forge.json` in the current directory with the default structure.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--dryRun` | boolean | No | Print the config without writing to disk |

**File operations:**
- Writes `forge.json`

---

### Info

#### `forge info`

Prints the current project setup: CLI version, active profile, and configured paths.

**Output includes:** version, profile name/URL/apiKey, paths for logs/fixtures/fingerprints.

**File operations:**
- Reads `package.json` (for version), `forge.json`, `~/.forge/profiles.json`

---

### Authentication

#### `forge auth:add <profile_name> --apiKey <key> --apiSecret <secret> --url <url>`

Adds or updates an auth profile. Verifies credentials against the server before saving.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `profile_name` | string | Yes | Profile identifier |
| `--apiKey` | string | Yes | API key |
| `--apiSecret` | string | Yes | API secret |
| `--url` | string | Yes | Hive server base URL |

**API calls:**
- `GET {url}/api/me` — verifies credentials, returns team/user info

**File operations:**
- Reads `~/.forge/profiles.json` (creates if missing)
- Writes updated `~/.forge/profiles.json`
- Sets this profile as the new default

---

#### `forge auth:list`

Prints all stored profiles and marks the active default.

**File operations:**
- Reads `~/.forge/profiles.json`

---

#### `forge auth:switch <profile_identifier>`

Switches the active default profile.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `profile_identifier` | string or number | Yes | Profile name or 0-based index |

**File operations:**
- Reads and writes `~/.forge/profiles.json`

---

#### `forge auth:remove <profile_name>`

Deletes a profile. If it was the default, the default is reset.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `profile_name` | string | Yes | Profile to remove |

**File operations:**
- Reads and writes `~/.forge/profiles.json`

---

#### `forge auth:clear`

Deletes all profiles and resets the profiles file to an empty state.

**File operations:**
- Reads and writes `~/.forge/profiles.json`

---

### Project Management

#### `forge project:create --name <name> [--description <description>]`

Creates a project on the Hive server and saves the returned UUID locally.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name` | string | Yes | Project name |
| `--description` | string | No | Project description |

**API calls:**
- `POST /api/projects` with `{ projectName, description, uuid }` (UUID generated locally)

**File operations:**
- Reads `forge.json`, `~/.forge/profiles.json`
- Writes `forge.json` with `project.uuid`

**Output includes:** dashboard link `{profile.url}/dashboard/projects/{uuid}`

---

#### `forge project:link --uuid <project_uuid>`

Links the local project to an existing remote project by UUID. Verifies the UUID is valid before saving.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--uuid` | string | Yes | Remote project UUID |

**API calls:**
- `GET /api/projects/{uuid}` — verifies project exists

**File operations:**
- Reads and writes `forge.json`

---

#### `forge project:unlink`

Removes the `project.uuid` from `forge.json`, detaching the local project from any remote.

**File operations:**
- Reads and writes `forge.json`

---

#### `forge project:sync`

Ensures all local tasks have UUIDs, then syncs the full task list to the server (upsert semantics).

**API calls:**
- `POST /api/projects/{projectUuid}/sync` with:
  ```json
  {
    "projectName": "...",
    "description": "...",
    "tasks": [{ "uuid": "...", "name": "..." }]
  }
  ```
- Response includes `summary` (total/created/updated/errors) and `results` arrays

**File operations:**
- Reads `forge.json`, `~/.forge/profiles.json`
- Writes `forge.json` — assigns UUIDs to any tasks that were missing them

**Returns early (no API call) when:** no tasks exist, no auth profile, or project UUID is missing.

---

### Task Management

#### `forge task:create <descriptor>`

Scaffolds a new task file and registers it in `forge.json`.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `descriptor` | string | Yes | Task name or `domain:taskName` |

**Behavior:**
- Generates a UUID for the task
- Creates the task file at `{paths.tasks}/{domain}/{taskName}.ts` with a boilerplate template
- Adds the task entry to `forge.json`
- If the project has a UUID and an auth profile, also calls the server to create the task there

**API calls (optional, if project is linked):**
- `POST /api/projects/{projectUuid}/tasks/{taskUuid}` with `{ taskName, description }`

**File operations:**
- Reads `forge.json`, `~/.forge/profiles.json`
- Writes new task file and updated `forge.json`

---

#### `forge task:list`

Prints all tasks registered in `forge.json` with their paths and count.

**File operations:**
- Reads `forge.json`

---

#### `forge task:describe <descriptor>`

Prints the schema, boundaries, and metadata for a specific task by bundling it and inspecting the exports.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `descriptor` | string | Yes | Task identifier |

**Output includes:** path, handler, description, input schema fields, boundary names.

**File operations:**
- Reads `forge.json`
- Writes temporary bundle to `~/.forge/builds/`

---

#### `forge task:run <descriptor> [--input <json>] [key=value ...]`

Executes a task locally. Bundles the task, runs it, and saves the execution record.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `descriptor` | string | Yes | Task identifier |
| `--input` | string (JSON) | No | Full input as a JSON string (overrides key=value args) |
| `key=value` | pairs | No | Individual input fields |

**Behavior:**
- Bundles the task file with esbuild to `~/.forge/builds/{descriptor}.js`
- Runs the task with the provided input
- Saves the `ExecutionRecord` as a JSON file under `{paths.logs}/{descriptor}/`
- Keeps a maximum of 10 log files per task (oldest deleted first)
- If an auth profile is configured, sends the record to the Hive log ingest endpoint

**File operations:**
- Reads `forge.json`, `~/.forge/profiles.json`
- Writes bundle to `~/.forge/builds/`, log file to `{paths.logs}/{descriptor}/`

---

#### `forge task:replay <descriptor> --path <fixture_path> [--cache <boundaries>]`

Replays a task using a saved fixture. Boundaries listed in `--cache` use the recorded response instead of calling the real implementation.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `descriptor` | string | Yes | Task identifier |
| `--path` | string | Yes | Path to fixture JSON (relative to `paths.fixtures` or absolute) |
| `--cache` | string | No | Comma-separated list of boundary names to replay from fixture |

**File operations:**
- Reads `forge.json`, fixture file, `~/.forge/profiles.json`
- Writes execution log to `{paths.logs}/{descriptor}/`, temporary bundle

---

#### `forge task:publish <descriptor>`

Bundles, zips, fingerprints, and publishes a task to the Hive server.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `descriptor` | string | Yes | Task identifier |

**Behavior:**
1. Bundle the task to `~/.forge/builds/{descriptor}.js`
2. Zip the bundle to `~/.forge/builds/{descriptor}.zip`
3. Generate a fingerprint
4. POST task metadata and source code to the server, receive a presigned S3 upload URL
5. PUT the zip binary to the presigned S3 URL

**API calls:**
- `POST /api/projects/{projectUuid}/tasks/{taskUuid}/publish` with:
  ```json
  {
    "taskName": "...",
    "handler": "...",
    "projectName": "...",
    "description": "...",
    "schemaDescriptor": "...",
    "boundaries": ["boundaryA", "boundaryB"],
    "sourceCode": "...",
    "bundleSize": 12345,
    "fingerprint": { ... },
    "uuid": "..."
  }
  ```
  Response: `{ bundleUploadUrl: string }`
- `PUT {bundleUploadUrl}` — binary upload with `Content-Type: application/octet-stream`

**File operations:**
- Reads `forge.json`, task source, `~/.forge/profiles.json`
- Writes bundle and zip to `~/.forge/builds/`, fingerprint to `{paths.fingerprints}/`

---

#### `forge task:download <descriptor> --uuid <uuid>`

Downloads a published task from the server and saves it locally.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `descriptor` | string | Yes | Local identifier to give the downloaded task |
| `--uuid` | string | Yes | Remote task UUID |

**API calls:**
- `POST /api/tasks/download` with `{ uuid }`
  Response: `{ handler, sourceCode, ... }`

**File operations:**
- Reads `forge.json`, `~/.forge/profiles.json`
- Writes task file to `{paths.tasks}/`, updated `forge.json`

---

#### `forge task:invoke <descriptor> --json <json_payload>`

Remotely invokes a deployed task on the Hive server and prints the response.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `descriptor` | string | Yes | Task identifier (must have a UUID in `forge.json`) |
| `--json` | string (JSON) | Yes | Input payload |

**API calls:**
- `POST /api/projects/{projectUuid}/tasks/{taskUuid}/invoke` with `{ payload }`
  Response: `{ responsePayload }`

**File operations:**
- Reads `forge.json`, `~/.forge/profiles.json`

---

#### `forge task:fingerprint <descriptor>`

Analyzes a task's source (without bundling) and saves a fingerprint describing its schema and boundaries.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `descriptor` | string | Yes | Task identifier |

**Output:** input schema properties, boundary names, analysis summary.

**File operations:**
- Reads `forge.json`, task source
- Writes fingerprint JSON to `{paths.fingerprints}/{descriptor}.fingerprint.json`

---

#### `forge task:remove <descriptor>`

Deletes the task file and removes its entry from `forge.json`.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `descriptor` | string | Yes | Task identifier |

**File operations:**
- Reads `forge.json`
- Deletes task file, writes updated `forge.json`

---

### Runner Management

Runners are orchestration modules that compose multiple tasks.

#### `forge runner:create <runner_name>`

Scaffolds a new runner module.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `runner_name` | string | Yes | Runner name (converted to camelCase) |

**File operations:**
- Reads `forge.json`
- Creates `{paths.runners}/{runnerName}/index.ts`, writes updated `forge.json`

---

#### `forge runner:remove <runner_name>`

Deletes a runner directory and removes it from `forge.json`.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `runner_name` | string | Yes | Runner name |

**File operations:**
- Reads `forge.json`
- Recursively deletes runner directory, writes updated `forge.json`

---

#### `forge runner:bundle <runner_name> --targetPath <path>`

Bundles a runner module into a single JavaScript file using esbuild.

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `runner_name` | string | Yes | Runner identifier |
| `--targetPath` | string | Yes | Output directory |

**Output:** `{targetPath}/{runnerName}.js` and `.js.map`

**File operations:**
- Reads `forge.json`, runner source files
- Writes bundle and sourcemap to target directory

---

### Fixture Management

Fixtures are saved boundary responses used for replaying tasks deterministically.

#### `forge fixture:download --uuid <fixture_uuid>`

Downloads a fixture from the server and saves it locally.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--uuid` | string | Yes | Fixture UUID |

**API calls:**
- `GET /api/fixture/{uuid}`
  Response: `{ fixture: { name, taskName, boundaries, ... } }`

**File operations:**
- Reads `forge.json`, `~/.forge/profiles.json`
- Writes fixture to `{paths.fixtures}/{taskName}/{uuid}.json`

---

### Documentation

#### `forge docs:download [--path <custom_path>] [--logs]`

Downloads LLM integration guides from the forge-mono-repo GitHub.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--path` | string | No | Output path (default: `docs/forge.md`) |
| `--logs` | boolean | No | Also download the Hive logging guide |

**External fetches:**
- `https://raw.githubusercontent.com/forge-and-hive/forge-mono-repo/refs/heads/main/docs/llm.md`
- `https://raw.githubusercontent.com/forge-and-hive/forge-mono-repo/refs/heads/main/docs/llm-hive-logging.md` (if `--logs`)

**File operations:**
- Writes markdown files to disk (creates `docs/` directory if needed, overwrites existing)

---

## Bundling

Several commands (run, describe, publish, replay) need to bundle TypeScript task files into plain JavaScript before executing or uploading them. The CLI uses **esbuild** for this.

Bundle outputs go to `~/.forge/builds/{descriptor}.js` with an accompanying sourcemap.

For publish, the bundle is further zipped into `~/.forge/builds/{descriptor}.zip`.

If you are re-implementing the CLI in another language, you need to produce a CommonJS-compatible single-file bundle from the TypeScript task source. The bundle must export a `default` that is a task object with `run`, `describe`, and `boundaries` methods.

---

## Execution Records

When a task runs locally (`task:run`, `task:replay`), the CLI saves an `ExecutionRecord` as a JSON file:

- **Location**: `{paths.logs}/{descriptor}/{uuid}.json`
- **Max files per task**: 10 (oldest deleted when exceeded)

If an auth profile is configured, the record is also sent to `POST /api/log-ingest`. See [`hive-server.md`](./hive-server.md) for the full `ExecutionRecord` schema and ingest API spec.
