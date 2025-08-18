# Project Commands

This directory contains ForgeHive CLI commands for project management operations.

## Commands

### `project:create`

Creates a new project in ForgeHive with automatic UUID generation and API integration.

#### Usage

```bash
forge project:create [--projectName="My Project"] [--description="Project description"]
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectName` | string | No | Name of the project to create. If not provided, uses the project name from `forge.json` |
| `description` | string | No | Optional description for the project |

#### Behavior

1. **UUID Management**: Checks if the local `forge.json` has a project UUID
   - If no UUID exists, generates a new UUID v4 and saves it to `forge.json`
   - If UUID already exists, uses the existing one

2. **Authentication**: Uses the current profile from `auth:list` for API authentication
   - Requires a valid profile set via `auth:add` and `auth:switch`
   - Uses profile's `apiKey`, `apiSecret`, and `url` for the request

3. **API Request**: Makes a POST request to `/api/projects` with:
   - `projectName`: The provided project name
   - `description`: The provided description (or empty string if not provided)
   - `uuid`: The project UUID (generated or existing)

4. **Response**: Returns the created project details including:
   - Project UUID
   - Project name
   - Team information
   - Creation timestamps

#### Examples

```bash
# Create a project using the name from forge.json
forge project:create

# Create a project with custom name
forge project:create --projectName="My New Project"

# Create a project with custom name and description
forge project:create --projectName="Analytics Dashboard" --description="Customer analytics and reporting platform"

# Create a project using forge.json name but with description
forge project:create --description="Using the default project name from configuration"
```

#### Success Output

```
Generated and saved project UUID: 550e8400-e29b-41d4-a716-446655440000
Project created successfully!
Project UUID: 550e8400-e29b-41d4-a716-446655440000
Project Name: My New Project

🌐 View your project on the dashboard: https://api.forgehive.com/dashboard/projects/550e8400-e29b-41d4-a716-446655440000
```

#### Error Cases

- **No Project Name**: If no `--projectName` is provided and `forge.json` doesn't contain a project name
- **No Profile**: If no authentication profile is configured
- **Invalid Profile**: If the current profile is invalid or expired
- **API Errors**: Network issues, server errors, or validation failures
- **Duplicate Names**: If a project with the same name already exists in the team

#### File Changes

When run, this command may modify:
- `forge.json`: Adds or updates the project UUID if one doesn't exist

#### Dependencies

- Requires `@forgehive/task` framework
- Requires `@forgehive/schema` for validation
- Uses `uuid` package for UUID generation
- Integrates with `auth:loadCurrent` for profile management
- Integrates with `conf:load` for configuration management

#### API Integration

This command integrates with the ForgeHive Projects API. See the [Projects API Documentation](../../../../../../../hive/docs/projects-api.md) for detailed API specifications.

---

## Project Configuration

Projects are configured via the `forge.json` file in your project root:

```json
{
  "project": {
    "name": "My Project",
    "uuid": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

The UUID is automatically generated and managed by the CLI commands.

---

### `project:link`

Links an existing remote project to the local project by validating the UUID and updating forge.json.

#### Usage

```bash
forge project:link [uuid]
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `uuid` | string (UUID) | Yes | UUID of the existing remote project to link |

#### Behavior

1. **UUID Validation**: Validates the provided UUID format using regex
2. **Remote Verification**: Makes a GET request to `/api/projects/{uuid}` to verify the project exists
3. **Authentication**: Uses the current profile for API authentication
4. **Project Details**: Displays project information (name, description, task count) if found
5. **Local Update**: Updates the local `forge.json` with the verified UUID

#### Examples

```bash
# Link to an existing remote project
forge project:link 550e8400-e29b-41d4-a716-446655440000
```

#### Success Output

```
Checking if project 550e8400-e29b-41d4-a716-446655440000 exists on https://api.forgehive.com...
✓ Found project: Customer Analytics
  Description: Analytics platform for customer behavior analysis
  Tasks: 3 task(s)

✓ Successfully linked project 550e8400-e29b-41d4-a716-446655440000 to local forge.json
  Local project name: My Local Project
  Remote project name: Customer Analytics

🌐 View your project on the dashboard: https://api.forgehive.com/dashboard/projects/550e8400-e29b-41d4-a716-446655440000
```

#### Error Cases

- **Invalid UUID Format**: If the provided UUID doesn't match the expected format
- **Project Already Linked**: If the local project already has a UUID in forge.json
- **Project Not Found**: If the UUID doesn't exist on the remote server (404)
- **Authentication Failed**: If the current profile credentials are invalid (401)
- **No Profile**: If no authentication profile is configured
- **Network Issues**: Connection problems or server errors

#### Error Examples

```bash
# Invalid UUID format
forge project:link invalid-uuid
# Error: Invalid UUID format: invalid-uuid. Please provide a valid UUID.

# Project already linked
forge project:link 550e8400-e29b-41d4-a716-446655440000
# Error: Project is already linked to UUID: 123e4567-e89b-12d3-a456-426614174000. Use a different project or remove the existing UUID from forge.json first.

# Project not found
forge project:link 00000000-0000-0000-0000-000000000000
# Error: Project with UUID 00000000-0000-0000-0000-000000000000 not found on https://api.forgehive.com. Please verify the UUID is correct.

# Authentication failed
forge project:link 550e8400-e29b-41d4-a716-446655440000
# Error: Authentication failed. Please check your profile credentials with 'forge auth:list'.
```

#### File Changes

When run successfully, this command modifies:
- `forge.json`: Updates the `project.uuid` field with the verified remote project UUID

#### Dependencies

- Requires `@forgehive/task` framework
- Requires `@forgehive/schema` for validation
- Integrates with `auth:loadCurrent` for profile management
- Integrates with `conf:load` for configuration management
- Uses the ForgeHive Projects API `/api/projects/{uuid}` endpoint

---

### `project:unlink`

Removes the project UUID link from the local forge.json, allowing the project to be linked to a different remote project.

#### Usage

```bash
forge project:unlink
```

#### Parameters

This command takes no parameters.

#### Behavior

1. **UUID Check**: Verifies that a project UUID exists in forge.json
2. **Local Update**: Removes the UUID field from the project configuration
3. **Confirmation**: Shows the UUID that was removed and next steps

#### Examples

```bash
# Unlink the current project
forge project:unlink
```

#### Success Output

```
✓ Successfully unlinked project from UUID: 550e8400-e29b-41d4-a716-446655440000
  The project is no longer linked to a remote project.
  You can now link to a different project using 'forge project:link [uuid]'
```

#### Error Cases

- **No UUID Found**: If the project is not currently linked (no UUID in forge.json)

#### Error Examples

```bash
# No project linked
forge project:unlink
# Error: No project UUID found in forge.json. The project is not currently linked to a remote project.
```

#### File Changes

When run successfully, this command modifies:
- `forge.json`: Removes the `project.uuid` field completely

#### Dependencies

- Requires `@forgehive/task` framework
- Requires `@forgehive/schema` for validation
- Integrates with `conf:load` for configuration management

**Note**: This command only affects the local forge.json file. It does not make any API calls or modify anything on the remote server.

---

## Project Configuration