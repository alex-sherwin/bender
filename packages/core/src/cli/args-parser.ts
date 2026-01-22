import { parseArgs as utilParseArgs } from "node:util";

/**
 * Supported programming languages for indexing
 */
export type SupportedLanguage = "typescript" | "tsx" | "java" | "bash" | "csharp";

/**
 * Parsed arguments for the index command
 */
export interface ParsedIndexArgs {
  path: string;
  db: string;
  description?: string;
  languages: Set<SupportedLanguage>;
}

/**
 * Parsed arguments for the query command
 */
export interface ParsedQueryArgs {
  db: string;
  snapshot?: string;
}

/**
 * Parsed arguments for the snapshot command
 */
export interface ParsedSnapshotArgs {
  db: string;
}

/**
 * Parse command-line arguments for the index command.
 *
 * Usage:
 *   index --path <source-dir> --db <output-db> [--description <text>]
 *   [--typescript] [--tsx] [--java] [--bash] [--csharp] [--all-langs]
 *
 * If no language flags are provided, defaults to all 5 supported languages.
 *
 * @author GitHub Copilot
 * @param args Raw command-line arguments
 * @returns Parsed index command arguments
 * @throws Error if --path or --db are missing or invalid flags provided
 */
export function parseIndexCommandArgs(args: string[]): ParsedIndexArgs {
  const options = {
    path: { type: "string" as const },
    db: { type: "string" as const },
    description: { type: "string" as const },
    typescript: { type: "boolean" as const },
    tsx: { type: "boolean" as const },
    java: { type: "boolean" as const },
    bash: { type: "boolean" as const },
    csharp: { type: "boolean" as const },
    "all-langs": { type: "boolean" as const },
  };

  let parsed: ReturnType<typeof utilParseArgs>;

  try {
    parsed = utilParseArgs({ args, options, allowPositionals: false, strict: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Invalid arguments: ${message}`);
  }

  // Validate required arguments
  const path = parsed.values.path as string | undefined;
  const db = parsed.values.db as string | undefined;

  if (!path) {
    throw new Error("Missing required argument: --path");
  }
  if (!db) {
    throw new Error("Missing required argument: --db");
  }

  const description = parsed.values.description as string | undefined;

  // Parse language flags
  const languages = new Set<SupportedLanguage>();
  const languageFlags = ["typescript", "tsx", "java", "bash", "csharp"];
  const allLanguages: SupportedLanguage[] = [
    "typescript",
    "tsx",
    "java",
    "bash",
    "csharp",
  ];

  // Check if any language flags were provided
  let anyLanguageFlagProvided = false;

  for (const flag of languageFlags) {
    const value = parsed.values[flag as keyof typeof parsed.values];
    if (value === true) {
      anyLanguageFlagProvided = true;
      languages.add(flag as SupportedLanguage);
    }
  }

  // Handle --all-langs flag
  if (parsed.values["all-langs" as keyof typeof parsed.values] === true) {
    anyLanguageFlagProvided = true;
    for (const lang of allLanguages) {
      languages.add(lang);
    }
  }

  // Default to all languages if no language flags provided
  if (!anyLanguageFlagProvided) {
    for (const lang of allLanguages) {
      languages.add(lang);
    }
  }

  return {
    path,
    db,
    description,
    languages,
  };
}

/**
 * Parse command-line arguments for the query command.
 *
 * Usage:
 *   query [--db <database-path>] [--snapshot <snapshot-id>] <subcommand> [subcommand-args...]
 *
 * Subcommands:
 *   blast-radius <qualified-name> [depth]
 *   find-usages <qualified-name>
 *   list-symbols [file-path]
 *   search <pattern>
 *
 * @author GitHub Copilot
 * @param args Raw command-line arguments
 * @returns Parsed query command arguments
 * @throws Error if invalid flags provided
 */
export function parseQueryCommandArgs(args: string[]): ParsedQueryArgs {
  const options = {
    db: { type: "string" as const },
    snapshot: { type: "string" as const },
  };

  let parsed: ReturnType<typeof utilParseArgs>;

  try {
    parsed = utilParseArgs({ args, options, allowPositionals: true, strict: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Invalid arguments: ${message}`);
  }

  const db = (parsed.values.db as string | undefined) ?? "index.db";
  const snapshot = parsed.values.snapshot as string | undefined;

  return {
    db,
    snapshot,
  };
}

/**
 * Parse command-line arguments for the snapshot command.
 *
 * Usage:
 *   snapshots [--db <database-path>] <subcommand> [subcommand-args...]
 *
 * Subcommands:
 *   list
 *   compare <id1> <id2>
 *   delete <id>
 *   set-latest <id>
 *   stats [id]
 *
 * @author GitHub Copilot
 * @param args Raw command-line arguments
 * @returns Parsed snapshot command arguments
 * @throws Error if invalid flags provided
 */
export function parseSnapshotCommandArgs(args: string[]): ParsedSnapshotArgs {
  const options = {
    db: { type: "string" as const },
  };

  let parsed: ReturnType<typeof utilParseArgs>;

  try {
    parsed = utilParseArgs({ args, options, allowPositionals: true, strict: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Invalid arguments: ${message}`);
  }

  const db = (parsed.values.db as string | undefined) ?? "index.db";

  return {
    db,
  };
}
