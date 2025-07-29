# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Primary Commands
- `pnpm test` - Run all tests across all packages using Lerna
- `pnpm build` - Build all packages using Lerna
- `pnpm lint` - Run ESLint across all TypeScript files
- `pnpm lint:fix` - Run ESLint with automatic fixes

### Package-Specific Commands
Individual packages support:
- `pnpm build` - Compile TypeScript to JavaScript
- `pnpm test` - Run Jest tests
- `pnpm dev` - Watch mode for development (some packages)

### CLI Testing
- `cd apps/cli && pnpm dev <command>` - Run CLI commands in development mode
- `cd apps/cli && pnpm start <command>` - Run CLI commands from built version

### CLI Task Development Workflow
When creating new CLI tasks:
1. **Create task**: `forge task:create domain:taskName` (uses the forge CLI)
2. **Implement task**: Modify the generated file following the Task and Boundaries pattern
3. **Register task**: Add import and runner.load() in `apps/cli/src/runner.ts`
4. **Add handler logic**: Add specific handler in runner.ts if needed for argument parsing
5. **Build CLI**: `cd apps/cli && pnpm build` (required after changes)
6. **Test task**: `forge domain:taskName [options]` (uses the built forge CLI)

**Important**: Always run `pnpm build` in apps/cli after making changes before testing with `forge` commands.

## Project Architecture

### Monorepo Structure
- **Lerna + pnpm workspaces** - Independent package versioning
- **apps/cli** - Main CLI application (`@forgehive/forge-cli`)
- **apps/sample-project** - Example project for testing CLI functionality
- **packages/** - Core libraries:
  - `@forgehive/task` - Task creation and execution framework
  - `@forgehive/runner` - Command runner and task orchestration
  - `@forgehive/schema` - Type-safe data validation using Zod
  - `@forgehive/record-tape` - Execution logging and replay system
  - `@forgehive/hive-sdk` - SDK for external integrations

### Task and Boundaries Pattern
The codebase implements a unique "Task and Boundaries" pattern:

- **Tasks** are black boxes with validated inputs/outputs using schemas
- **Boundaries** are explicit interfaces to external dependencies (databases, APIs, etc.)
- **Execution modes**: proxy (normal), replay (recorded), proxy-pass, proxy-catch
- All task executions are logged with inputs, outputs, and boundary calls

Example task structure:
```typescript
const myTask = createTask(
  inputSchema,        // Schema for input validation
  boundaries,         // External dependency interfaces
  async (input, boundaries) => {
    // Task implementation using boundaries for external calls
    return result;
  }
);
```

### CLI Command Structure
The CLI uses a command pattern with actions:
- Format: `forge <command>:<action> [options]`
- Examples: `forge task:create myTask`, `forge auth:add myProfile`

Commands are organized by domain:
- `task:*` - Task management (create, run, list, publish, etc.)
- `runner:*` - Runner management (create, remove, bundle)
- `auth:*` - Authentication profiles
- `fixture:*` - Test fixture management
- `init` - Project initialization
- `info` - Configuration information

### Key Dependencies
- **Zod** - Runtime schema validation
- **Lerna** - Monorepo management
- **TypeScript** - Type safety
- **Jest** - Testing framework
- **ESLint** - Code linting
- **Husky** - Git hooks

## Configuration Files
- `forge.json` - Project configuration in CLI apps
- `lerna.json` - Lerna configuration with independent versioning
- `pnpm-workspace.yaml` - Workspace package definitions
- `.env` and `.env.local` - Environment variables for CLI

## Testing Strategy
- Unit tests for individual packages
- Integration tests for CLI commands
- Test utilities in `testUtils.ts` files
- Mock boundaries for testing tasks in isolation
- Sample project for end-to-end testing

## Package Publishing
- Packages use `workspace:*` for internal dependencies
- `publishConfig` in package.json for NPM registry settings
- Independent versioning managed by Lerna