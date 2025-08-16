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