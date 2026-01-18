# AGENTS.md

Guide for agentic coding agents working in this repository.

## Project Structure

Monorepo using pnpm workspaces. Main package:
- `packages/core`: Multi-language code indexer using tree-sitter and SQLite

### New File Structure
- `src/parsers/`: Language-specific parsers (Java, TypeScript, TSX, C#, Bash)
- `src/db/`: Database layer (schema, writer, queries, snapshots)
- `src/cli/`: Command-line interface commands
- `src/indexer.ts`: Main indexing logic
- `src/logger.ts`: Centralized logging utility

## Build, Lint, and Test Commands

### From repository root:
```bash
# No root-level build commands; work within packages/core
```

### From packages/core directory:

**Run all tests:**
```bash
bun test
```

**Run fitered tests**
```bash
# matches parts of test filenames
bun test filter_here
```


**Linting:**
OxLint is configured (.oxlintrc.json is empty, using defaults). Run via IDE integration or build tools.

## Runtime Environment

The system is designed to run on **Bun** for optimal performance with built-in SQLite support. However, the current setup uses **Node.js** with compatible libraries.

### Running with Bun (Recommended)
```bash
# Install Bun: https://bun.sh
bun install

# Run indexer
bun run index <source-dir> <output-db>

# Run queries
bun run query blast-radius "com.example.MyClass.myMethod"
```

### Running with Node.js (Current Setup)
```bash
pnpm install
# TBD programs
```

## Example Queries and Use Cases

### Basic Usage Examples

TODO: these package.json scripts are NOT implemented yet

**Index a Java project:**
```bash
pnpm index /path/to/java/project ./codebase.db
```

**Find all usages of a method:**
```bash
pnpm query find-usages "com.example.UserService.saveUser"
```

**Get call graph for a method:**
```bash
pnpm query blast-radius "com.example.UserService.saveUser" 3
```

**Search for methods by pattern:**
```bash
pnpm query search "save.*"
```

**List all symbols in a file:**
```bash
pnpm query list-symbols "src/main/java/com/example/UserService.java"
```

### Snapshot Workflow

Snapshots enable time-travel analysis and comparison of codebase changes:

```bash
# Create initial index
pnpm index ./project ./codebase.db "Initial version"

# Make changes to code...

# Create new snapshot
pnpm index ./project ./codebase.db "After refactoring"

# Compare snapshots
pnpm snapshots list
pnpm snapshots compare <id1> <id2>

# Set older snapshot as latest
pnpm snapshots set-latest <older-id>
```

### Qualified Name Formats

Qualified names follow language-specific conventions:

**Java:**
- Classes: `{package}.{ClassName}` (e.g., `com.example.Calculator`)
- Methods: `{package}.{ClassName}.{methodName}` (e.g., `com.example.Calculator.add`)
- Fields: `{package}.{ClassName}.{fieldName}` (e.g., `com.example.Calculator.value`)

**TypeScript/TSX:**
- Functions: `{filePath}:{exportName}` (e.g., `src/utils/helpers.ts:formatDate`)
- Classes: `{filePath}:{ClassName}` (e.g., `src/components/Button.tsx:Button`)
- Methods: `{filePath}:{ClassName}.{methodName}` (e.g., `src/components/Button.tsx:Button.onClick`)

**C#:**
- Classes: `{Namespace}.{ClassName}` (e.g., `MyApp.Services.UserService`)
- Methods: `{Namespace}.{ClassName}.{MethodName}` (e.g., `MyApp.Services.UserService.GetUser`)

**Bash:**
- Functions: `{filePath}:{functionName}` (e.g., `scripts/deploy.sh:check_dependencies`)

**Common Use Cases:**
- **Impact Analysis**: Use `blast-radius` to understand what code is affected by a change
- **Refactoring**: Use `find-usages` to locate all references before renaming
- **Code Exploration**: Use `list-symbols` and `search` to understand codebase structure
- **Change Tracking**: Use snapshots to compare code evolution over time

## Code Style Guidelines

### TypeScript and Formatting
- **TypeScript required**: All code must be TypeScript with strict mode enabled
- **Indentation**: 2 spaces (not tabs)
- **Quotes**: Double quotes for strings
- **Semicolons**: Required at end of statements
- **Line width**: No strict limit, but aim for readability

### Imports
- Use ES modules (`import`/`export`)
- Prefer named imports and exports over default exports
- Order imports: node builtins, external packages, relative paths
- Use `type` keyword for type-only imports: `import type { MyType } from "..."` 
- Imports with side effects should be explicit and clearly commented
- Example:
  ```typescript
  import fs from "node:fs/promises";
  import path from "node:path";
  import { Parser } from "web-tree-sitter";
  import type { FileData, ClassInfo } from "./types";
  import { log } from "./logger";
  ```

### Naming Conventions
- **Functions/Variables**: camelCase
- **Classes/Interfaces**: PascalCase
- **Constants**: CONSTANT_CASE (for compile-time constants)
- **Private members**: Prefix with underscore (e.g., `_privateField`)
- **Booleans**: Start with `is`, `has`, `can`, etc. (e.g., `isDirectory`, `hasContent`)
- **Handler functions**: Prefix with `handle`, `on` (e.g., `handleError`, `onNodeVisit`)

### Types
- **Strict mode enabled**: All code must pass TypeScript strict checks
- **Use interface for object shapes**, type for unions and aliases
- **Explicit return types** on exported functions and complex logic
- **Avoid `any`**: Use unknown, generics, or proper types
- **Use satisfies operator** for type narrowing when appropriate
- Unused locals/parameters are compilation errors - remove or prefix with `_` if intentional

### Sqlite
- Use `bun:sqlite` package exclusively.  DO NOT bring third party better-sqlite3 packages, etc.

### Error Handling
- Use explicit error handling, don't suppress exceptions
- Log errors with context using the `log` utility (see logger.ts)
- Catch and rethrow with additional context when appropriate
- Example:
  ```typescript
  try {
    const content = await fs.readFile(fullPath, "utf-8");
  } catch (error) {
    log.error(`Error parsing file ${fullPath}:`, error);
    throw error;  // or handle gracefully
  }
  ```

### Nullish Coalescing
- **Prefer nullish coalescing (`??`) over logical OR (`||`)** for default values
- `??` only falls back for `null`/`undefined`, not falsy values
- Example: `value ?? defaultValue` (not `value || defaultValue`)

### TSDoc Comments
- Add TSDoc comments to public functions and complex logic
- **Copilot-generated code**: Include `@author GitHub Copilot` tag
- Use `@param`, `@returns`, `@throws` for documentation
- Example:
  ```typescript
  /**
   * Find the first node of a specific type.
   * @author GitHub Copilot
   * @param node Root node to search from
   * @returns First matching node or null
   */
  export function findFirstNodeOfType(node: Node, type: string): Node | null {
  ```

### Tree-Sitter Usage
- **Prefer `tree.walk()` over `node.descendantsOfType()`** when traversing AST
- Use the provided `walkGenerator` utility for efficient traversal
- Handle both Node and Tree types in functions that accept roots

### Test Structure (Vitest)
- Use `bun test` to run tests always
- Use `describe`, `it`, `expect` from vitest
- Test file naming: `*.test.ts`
- Clear test names describing behavior
- Use `expect().toEqual()`, `toHaveLength()`, `.not.toBeNull()`, etc.
- Example:
  ```typescript
  describe("extractor", () => {
    it("getImports extracts all imports", async () => {
      const parser = await createJavaParser();
      const imports = getImports(tree.rootNode);
      expect(imports).toHaveLength(3);
    });
  });
  ```

### Logging
- Use the exported `log` utility (from logger.ts)
- Methods: `log.debug()`, `log.info()`, `log.warn()`, `log.error()`
- Logs include ISO timestamp and level prefix
- Pass objects as second parameter: `log.error("message", { key: value })`

## Compiler Options

- **Target**: ES2020
- **Module**: ESNext  
- **Resolution**: bundler
- **Declaration**: Emit .d.ts files
- **Strict mode**: All strict checks enabled
- **No unused locals/parameters**: Enforced
- **No unchecked side effect imports**: Enforced

## Important Conventions

1. **Use `node:` prefix** for Node.js built-in modules (fs, path, etc.)
2. **Async/await**: Preferred over callbacks or promise chains
3. **Tree-sitter parsing**: Multi-language support (Java, TypeScript, TSX, C#, Bash); parsers in `src/parsers/`
4. **Database storage**: SQLite with Bun for fast I/O and built-in support
5. **Project data format**: Normalized relational schema in SQLite (see db/schema.ts)
6. **File operations**: Use `node:fs/promises` for non-blocking I/O

## Configuration Files

- `tsconfig.json`: Strict TypeScript compilation (packages/core/)
- `.oxlintrc.json`: Empty (default linting rules)
- `vite.config.ts`: Build and test configuration
- `.github/copilot-instructions.md`: See this file for Copilot-specific guidelines

## Key Files to Know

- `packages/core/src/types.ts`: Core type definitions
- `packages/core/src/logger.ts`: Centralized logging utility
- `packages/core/src/indexer.ts`: Main indexing logic (scans directories, parses files, writes to DB)
- `packages/core/src/cli/index-cmd.ts`: CLI command to index a directory
- `packages/core/src/cli/query-cmd.ts`: CLI commands for querying the index (blast-radius, find-usages, etc.)
- `packages/core/src/db/schema.ts`: SQLite database schema and initialization
- `packages/core/src/db/types.ts`: TypeScript types for database rows and query results
- `packages/core/src/db/queries.ts`: Query functions for accessing indexed data
- `packages/core/src/db/writer.ts`: Functions to write parsed data to SQLite
- `packages/core/src/db/snapshots.ts`: Snapshot management (create, list, compare)
- `packages/core/src/parsers/`: Directory with language-specific parsers
- `packages/core/test/`: Test files for parsers and database operations
