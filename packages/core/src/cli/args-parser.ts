import { parseArgs as utilParseArgs } from "node:util";

/**
 * Supported programming languages for indexing
 */
export type SupportedLanguage = "typescript" | "tsx" | "java" | "bash" | "csharp";

/**
 * Parsed arguments for the index command
 */
export interface ParsedIndexArgs {
  sourceDir: string;
  outputDb: string;
  description?: string;
  languages: Set<SupportedLanguage>;
}

/**
 * Parse command-line arguments for the index command.
 *
 * Usage:
 *   index <source-dir> <output-db> [description]
 *   --typescript --tsx --java --bash --csharp --all-langs
 *
 * If no language flags are provided, defaults to all 5 supported languages.
 *
 * @author GitHub Copilot
 * @param args Raw command-line arguments
 * @returns Parsed index command arguments
 * @throws Error if sourceDir or outputDb are missing or invalid flags provided
 */
export function parseIndexCommandArgs(args: string[]): ParsedIndexArgs {
  const options = {
    typescript: { type: "boolean" as const },
    tsx: { type: "boolean" as const },
    java: { type: "boolean" as const },
    bash: { type: "boolean" as const },
    csharp: { type: "boolean" as const },
    "all-langs": { type: "boolean" as const },
  };

  let parsed: ReturnType<typeof utilParseArgs>;

  try {
    parsed = utilParseArgs({ args, options, allowPositionals: true, strict: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Invalid arguments: ${message}`);
  }

  const positionals = parsed.positionals as string[];

  // Validate required positional arguments
  if (positionals.length < 2) {
    throw new Error(
      "Missing required arguments. Usage: index <source-dir> <output-db> [description]",
    );
  }

  const [sourceDir, outputDb, ...descParts] = positionals;
  const description = descParts.length > 0 ? descParts.join(" ") : undefined;

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
    sourceDir,
    outputDb,
    description,
    languages,
  };
}
