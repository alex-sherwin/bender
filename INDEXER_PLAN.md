# Implementation Plan: SQLite Index with Snapshots

## Overview
Migrate from JSON-based storage to SQLite database for storing parsed codebase data. Support multiple snapshots of the codebase in a single database file for time-travel analysis and comparison.

## Architecture Decision
- **Runtime**: Bun for fast I/O and built-in SQLite support
- **Storage**: SQLite with snapshot-based versioning (multiple full snapshots in one DB)
- **Update strategy**: Full re-index only (no incremental updates)
- **Data model**: Normalized relational schema with JSON for metadata
- **Multi-language**: Support bash, Java, TypeScript, TSX, C# from the start
- **Parsers**: Build new purpose-built parser/indexer code optimized for semantic extraction (existing parsers are reference only)
- **Tree-sitter**: WASM files already in `packages/core/public/` (tree-sitter-bash.wasm, tree-sitter-c_sharp.wasm, tree-sitter-java.wasm, tree-sitter-tsx.wasm, tree-sitter-typescript.wasm)

## Schema Design

### Core Tables
1. **snapshots**: Track complete codebase snapshots
   - `id` (UUID), `created_at`, `is_latest` flag, optional `description`
   - Only one snapshot marked as `is_latest = 1`

2. **files**: One row per source file per snapshot
   - Links to snapshot, stores path, language, package
   - `UNIQUE(snapshot_id, path)`

3. **symbols**: All declarations (classes, interfaces, methods, fields, functions)
   - Links to snapshot and file
   - Hierarchical via `parent_id` (methods/fields point to containing class)
   - Stores `kind`, `name`, `qualified_name`, `signature`
   - `metadata` JSON column for language-specific details (comments, return types, parameters)

4. **references**: Who calls/uses what
   - Links `from_symbol_id` → `to_qualified_name`
   - `to_symbol_id` resolved for internal symbols, NULL for external
   - `ref_kind`: 'call', 'field_access', 'type_reference', 'import'

5. **imports**: File-level import tracking
   - Links to file and snapshot
   - Stores source package/module, wildcard flag
   - `imported_names` as JSON array

### Indexes 
Strategic indexes on:
- `snapshot_id` + frequently queried columns (qualified_name, name)
- Foreign keys for joins
- `is_latest` for default queries

## Parser Architecture

Build new purpose-built parsers optimized for semantic extraction and indexing:

### Language-Specific Extractors
Each language needs:
1. **Symbol extraction**: Classes, interfaces, functions, methods, fields, variables
2. **Reference extraction**: Method calls, field accesses, type references
3. **Qualified name construction**: Language-appropriate naming (e.g., Java packages, TS modules)
4. **Import/dependency tracking**: Cross-file linkages

### Unified Interface
All parsers implement common interface:
```typescript
interface LanguageParser {
  parseFile(filePath: string, content: string): ParsedFileData;
}

interface ParsedFileData {
  file: { path: string; language: string; package?: string };
  symbols: SymbolData[];
  references: ReferenceData[];
  imports: ImportData[];
}
```

### Reference Existing Parsers
Use `src/java-parser.ts`, `src/typescript-parser.ts`, `src/tsx-parser.ts` as examples of:
- Loading tree-sitter WASM files
- Walking AST with tree-sitter
- Extracting node text and structure

## Critical Files to Create

### Database Layer
- `packages/core/src/db/schema.ts` - SQLite schema definition and initialization
- `packages/core/src/db/writer.ts` - Write ParsedFileData to SQLite
- `packages/core/src/db/queries.ts` - Query helpers (blast radius, find usages, etc)
- `packages/core/src/db/snapshots.ts` - Snapshot management (create, list, compare)
- `packages/core/src/db/types.ts` - TypeScript types for rows and queries

### Parser Layer (New Purpose-Built)
- `packages/core/src/parsers/base.ts` - Common parser interface and utilities
- `packages/core/src/parsers/java.ts` - Java parser (classes, methods, calls, imports)
- `packages/core/src/parsers/typescript.ts` - TypeScript parser (interfaces, classes, functions)
- `packages/core/src/parsers/tsx.ts` - TSX parser (extends TypeScript, adds JSX component tracking)
- `packages/core/src/parsers/csharp.ts` - C# parser (classes, methods, namespaces)
- `packages/core/src/parsers/bash.ts` - Bash parser (functions, command calls)
- `packages/core/src/parsers/index.ts` - Parser registry (language → parser mapping)

### Indexer & CLI
- `packages/core/src/indexer.ts` - Main indexer (scan directory, dispatch to parsers, write to DB)
- `packages/core/src/cli/index-cmd.ts` - CLI command to index a directory
- `packages/core/src/cli/query-cmd.ts` - CLI commands for querying (blast-radius, find-usages, etc)
- `packages/core/src/cli/snapshot-cmd.ts` - CLI commands for snapshot management

### Configuration
- `packages/core/bunfig.toml` - Bun configuration if needed
- Update `packages/core/tsconfig.json` if needed for Bun compatibility

## Implementation Steps

### Phase 1: Database Schema & Core Types
1. Create `packages/core/src/db/schema.ts`:
   - Define `CREATE TABLE` statements for all 5 tables (snapshots, files, symbols, references, imports)
   - Write `initDatabase(dbPath: string)` function using `bun:sqlite`
   - Add `createSnapshot(db, description?: string)` to create new snapshot and mark as latest
   - Include all indexes from schema design

2. Create `packages/core/src/db/types.ts`:
   - TypeScript types for row objects (SnapshotRow, FileRow, SymbolRow, ReferenceRow, ImportRow)
   - Types for query results (BlastRadiusResult, SymbolSearchResult, etc)
   - Shared types: SymbolData, ReferenceData, ImportData, ParsedFileData

3. Create `packages/core/src/db/writer.ts`:
   - `writeParsedFile(db, snapshotId, parsed: ParsedFileData)` - Insert file + symbols + references + imports
   - Use transactions for batch inserts
   - Build hierarchical symbol relationships (parent_id for methods/fields)
   - Resolve internal references (match to_qualified_name → to_symbol_id)

### Phase 2: Parser Base & Utilities
4. Create `packages/core/src/parsers/base.ts`:
   - `LanguageParser` interface definition
   - `initTreeSitter()` - Initialize web-tree-sitter
   - `loadParser(language, wasmPath)` - Load specific WASM parser
   - Shared utilities: `walkAST(node, visitor)`, `getNodeText(node)`, `getLocation(node)`
   - Helper: `buildQualifiedName(parts: string[])` for consistent naming

5. Create `packages/core/src/parsers/index.ts`:
   - Parser registry: Map file extension → LanguageParser
   - `getParserForFile(filePath: string)` - Return appropriate parser
   - Language detection from file extension (.java, .ts, .tsx, .cs, .sh)

### Phase 3: Language Parsers (Start with Java)
6. Create `packages/core/src/parsers/java.ts`:
   - Load tree-sitter-java.wasm
   - Extract symbols: package, classes, interfaces, methods, fields, constructors
   - Extract references: method calls, field accesses, type references (in signatures, variable declarations)
   - Extract imports: track package imports, wildcard vs specific
   - Build qualified names: `{package}.{Class}.{method}`
   - Populate metadata JSON: comments, modifiers (static, public), return types, parameters

7. Create `packages/core/src/parsers/typescript.ts`:
   - Load tree-sitter-typescript.wasm
   - Extract symbols: interfaces, type aliases, classes, functions, variables (exported)
   - Extract references: function calls, property accesses, type references
   - Extract imports: ES6 imports (default, named, namespace)
   - Build qualified names: use file path + export name (e.g., `src/utils/helpers:formatDate`)
   - Handle TypeScript-specific: generics, optional parameters, union types

8. Create remaining parsers (can be done in parallel or sequentially):
   - `packages/core/src/parsers/tsx.ts` - Extend typescript.ts, add JSX component extraction
   - `packages/core/src/parsers/csharp.ts` - Namespaces, classes, methods, properties, using directives
   - `packages/core/src/parsers/bash.ts` - Function definitions, command calls, source/dot includes

### Phase 4: Indexer & Main Flow
9. Create `packages/core/src/indexer.ts`:
   - `indexDirectory(dirPath: string, dbPath: string, description?: string)` - Main entry point
   - Scan directory recursively for supported file types
   - Create new snapshot
   - For each file:
     - Detect language
     - Get appropriate parser
     - Parse file → ParsedFileData
     - Write to database via writer.ts
   - Commit transaction
   - Print summary: files indexed, symbols extracted, references found, snapshot ID

10. Create `packages/core/src/cli/index-cmd.ts`:
    - CLI wrapper around indexer.ts
    - Accept arguments: source directory, output DB path, snapshot description
    - Progress reporting: show files as they're indexed
    - Error handling: skip unparseable files, log errors, continue indexing

### Phase 5: Query Layer & CLI
11. Create `packages/core/src/db/queries.ts`:
    - `getLatestSnapshot(db)` - Get current snapshot ID
    - `findSymbol(db, snapshotId, qualifiedName)` - Find symbol by qualified name
    - `findSymbolsByName(db, snapshotId, name)` - Find all symbols with given name (across files)
    - `getBlastRadius(db, snapshotId, qualifiedName, depth)` - Recursive CTE for call graph
    - `findReferences(db, snapshotId, qualifiedName)` - Find all usages
    - `getCallersOfMethod(db, snapshotId, symbolId)` - Direct callers (1-level)
    - `getFileSymbols(db, snapshotId, filePath)` - All symbols in a file
    - `searchSymbols(db, snapshotId, pattern)` - Wildcard search on qualified names

12. Create `packages/core/src/cli/query-cmd.ts`:
    - Commands:
      - `blast-radius <qualified-name> [depth]` - Show call graph
      - `find-usages <qualified-name>` - Show all references
      - `list-symbols [file-path]` - List symbols (optionally filtered by file)
      - `search <pattern>` - Search symbols by pattern
    - Default to latest snapshot, allow `--snapshot <id>` override
    - Format output: table view with file:line info

### Phase 6: Snapshot Management
13. Create `packages/core/src/db/snapshots.ts`:
    - `listSnapshots(db)` - Show all snapshots with metadata (ID, date, description, symbol count)
    - `compareSnapshots(db, snapshot1, snapshot2)` - Diff symbols: added, removed, modified
    - `deleteSnapshot(db, snapshotId)` - Remove old snapshot (cascade delete)
    - `setLatestSnapshot(db, snapshotId)` - Change which snapshot is "latest"
    - `getSnapshotStats(db, snapshotId)` - Count symbols, references, files

14. Create `packages/core/src/cli/snapshot-cmd.ts`:
    - Commands:
      - `snapshots list` - Show all snapshots
      - `snapshots compare <id1> <id2>` - Diff two snapshots
      - `snapshots delete <id>` - Remove snapshot
      - `snapshots set-latest <id>` - Change latest
      - `snapshots stats [id]` - Show stats for snapshot (default: latest)

### Phase 7: Testing
15. Add tests:
    - `packages/core/test/parsers/java.test.ts` - Test Java parser on sample code
    - `packages/core/test/parsers/typescript.test.ts` - Test TypeScript parser
    - `packages/core/test/db-writer.test.ts` - Test writing ParsedFileData to DB
    - `packages/core/test/db-queries.test.ts` - Test all query functions
    - `packages/core/test/indexer.test.ts` - Test full indexing flow on test directory
    - Use in-memory SQLite (`:memory:`) for fast tests
    - Verify: qualified names correct, parent relationships, reference resolution, snapshot isolation

16. Update documentation:
    - Update `AGENTS.md` with:
      - New file structure (src/parsers/, src/db/, src/cli/)
      - Commands to run: index, query, snapshot management
      - How to run with Bun
    - Add example queries and use cases
    - Document snapshot workflow and qualified name formats per language

## Migration Notes

### Breaking Changes
- JSON output format replaced with SQLite
- Users will need Bun runtime instead of Node.js
- Existing parsers (java-parser.ts, typescript-parser.ts, tsx-parser.ts) are reference only - new parsers built from scratch
- Existing JSON outputs won't be compatible (one-time migration acceptable)

### Bun-Specific Considerations
- Use `bun:sqlite` for database access (built-in, no dependencies)
- Leverage Bun's fast file I/O for reading source files
- Use Bun's native TypeScript execution (no transpilation needed)
- WASM files load via `import.meta.url` or file:// paths

### Data Mapping Details

**ParsedFileData → SQLite:**
```
ParsedFileData.file → files table (1 row)
ParsedFileData.symbols[] → symbols table (1 row per symbol)
  - Top-level symbols (classes, functions): parent_id = NULL
  - Nested symbols (methods, fields): parent_id = parent symbol ID
ParsedFileData.references[] → references table (1 row per reference)
  - Resolve to_symbol_id via qualified name lookup (if internal)
  - Leave to_symbol_id = NULL for external references
ParsedFileData.imports[] → imports table (1 row per import)
```

**Qualified Name Construction:**
- **Java**: `{package}.{ClassName}.{methodName}` (e.g., `com.example.MyClass.doWork`)
  - Fields: `com.example.MyClass.fieldName`
  - Top-level classes: `com.example.MyClass`
- **TypeScript/TSX**: `{filePath}:{exportName}` (e.g., `src/utils/helpers.ts:formatDate`)
  - Methods: `src/components/Button.tsx:Button.onClick`
  - Use relative paths from project root
- **C#**: `{Namespace}.{ClassName}.{MethodName}` (e.g., `MyApp.Services.UserService.GetUser`)
- **Bash**: `{filePath}:{functionName}` (e.g., `scripts/deploy.sh:check_dependencies`)

**Reference Extraction Strategy:**
- Walk AST to find call expressions, member access, type annotations
- Extract callee/target as qualified name (best-effort from context)
- Match against known symbols in current file first, then cross-file via imports
- Store all references, even if unresolved (useful for finding external dependencies)

## Verification Plan

1. **Test each parser individually**:
   - Java: Index `test-data/jsch` project, verify classes/methods/fields extracted
   - TypeScript: Index a TS project, verify interfaces/functions/classes
   - TSX: Index React components, verify component/props extraction
   - C#: Index a .NET project, verify namespaces/classes/methods
   - Bash: Index shell scripts, verify function definitions and calls

2. **Test full indexing flow**:
   - Create test directory with mixed languages (Java + TS + bash files)
   - Run indexer, verify all languages processed
   - Check snapshot created with correct metadata

3. **Test query functionality**:
   - Blast radius: Pick a Java method, verify 3-level call graph is accurate
   - Find usages: Query for a class name, verify all references found
   - Search: Wildcard search for method names
   - File symbols: List all symbols in a specific file

4. **Test snapshot management**:
   - Create 2 snapshots of same codebase
   - Verify isolation (queries on snapshot1 don't see snapshot2 data)
   - Compare snapshots (should show no changes for identical code)
   - Modify code, create snapshot3, compare with snapshot1 (should show diffs)

5. **Performance benchmarks**:
   - Index Apache SSHD (large Java codebase), time the indexing
   - Query performance: blast radius and find-usages should return in <100ms
   - Verify Bun's speed advantage over Node.js for file I/O

6. **End-to-end workflow**:
   - Index a real multi-language project
   - Use CLI commands to explore: find a method, check its blast radius, find usages
   - Verify output is useful and accurate enough for AI agent consumption

## Success Criteria
- ✅ SQLite database created with correct schema (5 tables + indexes)
- ✅ All 5 languages successfully parsed and indexed (Java, TypeScript, TSX, C#, Bash)
- ✅ Symbols have correct qualified names following per-language conventions
- ✅ Parent-child relationships correct (methods/fields under classes)
- ✅ References extracted and linked to symbols (internal) or stored as qualified names (external)
- ✅ Blast radius query returns accurate multi-level call graph
- ✅ Find usages returns all references to a symbol
- ✅ Multiple snapshots can coexist in one database
- ✅ Latest snapshot is queryable by default
- ✅ Snapshot comparison shows diffs correctly
- ✅ CLI commands work and produce readable output
- ✅ Tests pass for all core functionality
- ✅ Indexing performance acceptable for large codebases (e.g., <10s for 1000 files)
