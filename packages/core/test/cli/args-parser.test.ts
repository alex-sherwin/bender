import { describe, it, expect } from "vitest";
import { parseIndexCommandArgs } from "../../src/cli/args-parser";

describe("CLI argument parser", () => {
  describe("parseIndexCommandArgs", () => {
    it("should parse basic index command with --path and --db", () => {
      const args = ["--path", "./src", "--db", "./output.db"];
      const result = parseIndexCommandArgs(args);

      expect(result.path).toBe("./src");
      expect(result.db).toBe("./output.db");
      expect(result.description).toBeUndefined();
      expect(result.languages.size).toBe(5);
      expect(result.languages.has("typescript")).toBe(true);
      expect(result.languages.has("tsx")).toBe(true);
      expect(result.languages.has("java")).toBe(true);
      expect(result.languages.has("bash")).toBe(true);
      expect(result.languages.has("csharp")).toBe(true);
    });

    it("should parse with description", () => {
      const args = ["--path", "./src", "--db", "./output.db", "--description", "Initial snapshot"];
      const result = parseIndexCommandArgs(args);

      expect(result.path).toBe("./src");
      expect(result.db).toBe("./output.db");
      expect(result.description).toBe("Initial snapshot");
      expect(result.languages.size).toBe(5);
    });

    it("should parse --typescript flag only", () => {
      const args = ["--path", "./src", "--db", "./output.db", "--typescript"];
      const result = parseIndexCommandArgs(args);

      expect(result.languages.has("typescript")).toBe(true);
      expect(result.languages.has("tsx")).toBe(false);
      expect(result.languages.has("java")).toBe(false);
      expect(result.languages.has("bash")).toBe(false);
      expect(result.languages.has("csharp")).toBe(false);
      expect(result.languages.size).toBe(1);
    });

    it("should parse --bash flag only", () => {
      const args = ["--path", "./src", "--db", "./output.db", "--bash"];
      const result = parseIndexCommandArgs(args);

      expect(result.languages.has("bash")).toBe(true);
      expect(result.languages.has("typescript")).toBe(false);
      expect(result.languages.has("tsx")).toBe(false);
      expect(result.languages.has("java")).toBe(false);
      expect(result.languages.has("csharp")).toBe(false);
      expect(result.languages.size).toBe(1);
    });

    it("should parse --java flag only", () => {
      const args = ["--path", "./src", "--db", "./output.db", "--java"];
      const result = parseIndexCommandArgs(args);

      expect(result.languages.has("java")).toBe(true);
      expect(result.languages.has("typescript")).toBe(false);
      expect(result.languages.has("tsx")).toBe(false);
      expect(result.languages.has("bash")).toBe(false);
      expect(result.languages.has("csharp")).toBe(false);
      expect(result.languages.size).toBe(1);
    });

    it("should parse --csharp flag only", () => {
      const args = ["--path", "./src", "--db", "./output.db", "--csharp"];
      const result = parseIndexCommandArgs(args);

      expect(result.languages.has("csharp")).toBe(true);
      expect(result.languages.has("typescript")).toBe(false);
      expect(result.languages.has("tsx")).toBe(false);
      expect(result.languages.has("java")).toBe(false);
      expect(result.languages.has("bash")).toBe(false);
      expect(result.languages.size).toBe(1);
    });

    it("should parse --tsx flag separately from --typescript", () => {
      const args = ["--path", "./src", "--db", "./output.db", "--tsx"];
      const result = parseIndexCommandArgs(args);

      expect(result.languages.has("tsx")).toBe(true);
      expect(result.languages.has("typescript")).toBe(false);
      expect(result.languages.has("java")).toBe(false);
      expect(result.languages.has("bash")).toBe(false);
      expect(result.languages.has("csharp")).toBe(false);
      expect(result.languages.size).toBe(1);
    });

    it("should combine --typescript and --bash flags", () => {
      const args = ["--path", "./src", "--db", "./output.db", "--typescript", "--bash"];
      const result = parseIndexCommandArgs(args);

      expect(result.languages.has("typescript")).toBe(true);
      expect(result.languages.has("bash")).toBe(true);
      expect(result.languages.has("tsx")).toBe(false);
      expect(result.languages.has("java")).toBe(false);
      expect(result.languages.has("csharp")).toBe(false);
      expect(result.languages.size).toBe(2);
    });

    it("should combine --typescript, --bash, and --java flags", () => {
      const args = [
        "--path",
        "./src",
        "--db",
        "./output.db",
        "--typescript",
        "--bash",
        "--java",
      ];
      const result = parseIndexCommandArgs(args);

      expect(result.languages.has("typescript")).toBe(true);
      expect(result.languages.has("bash")).toBe(true);
      expect(result.languages.has("java")).toBe(true);
      expect(result.languages.has("tsx")).toBe(false);
      expect(result.languages.has("csharp")).toBe(false);
      expect(result.languages.size).toBe(3);
    });

    it("should handle --all-langs flag", () => {
      const args = ["--path", "./src", "--db", "./output.db", "--all-langs"];
      const result = parseIndexCommandArgs(args);

      expect(result.languages.has("typescript")).toBe(true);
      expect(result.languages.has("tsx")).toBe(true);
      expect(result.languages.has("java")).toBe(true);
      expect(result.languages.has("bash")).toBe(true);
      expect(result.languages.has("csharp")).toBe(true);
      expect(result.languages.size).toBe(5);
    });

    it("should throw error on missing --path", () => {
      const args = ["--db", "./output.db"];

      expect(() => parseIndexCommandArgs(args)).toThrow();
      expect(() => parseIndexCommandArgs(args)).toThrow("Missing required argument: --path");
    });

    it("should throw error on missing --db", () => {
      const args = ["--path", "./src"];

      expect(() => parseIndexCommandArgs(args)).toThrow();
      expect(() => parseIndexCommandArgs(args)).toThrow("Missing required argument: --db");
    });

    it("should preserve description with language flags", () => {
      const args = [
        "--path",
        "./src",
        "--db",
        "./output.db",
        "--description",
        "My snapshot",
        "--typescript",
        "--bash",
      ];
      const result = parseIndexCommandArgs(args);

      expect(result.path).toBe("./src");
      expect(result.db).toBe("./output.db");
      expect(result.description).toBe("My snapshot");
      expect(result.languages.has("typescript")).toBe(true);
      expect(result.languages.has("bash")).toBe(true);
      expect(result.languages.has("tsx")).toBe(false);
      expect(result.languages.size).toBe(2);
    });

    it("should throw error on invalid flag", () => {
      const args = ["--path", "./src", "--db", "./output.db", "--invalid-lang"];

      expect(() => parseIndexCommandArgs(args)).toThrow();
      expect(() => parseIndexCommandArgs(args)).toThrow("Invalid arguments");
    });

    it("should throw error on no arguments", () => {
      const args: string[] = [];

      expect(() => parseIndexCommandArgs(args)).toThrow();
    });

    it("should parse all languages explicitly", () => {
      const args = [
        "--path",
        "./src",
        "--db",
        "./output.db",
        "--typescript",
        "--tsx",
        "--java",
        "--bash",
        "--csharp",
      ];
      const result = parseIndexCommandArgs(args);

      expect(result.languages.size).toBe(5);
      expect(result.languages.has("typescript")).toBe(true);
      expect(result.languages.has("tsx")).toBe(true);
      expect(result.languages.has("java")).toBe(true);
      expect(result.languages.has("bash")).toBe(true);
      expect(result.languages.has("csharp")).toBe(true);
    });

    it("should default to all languages when --all-langs used with no other flags", () => {
      const args = ["--path", "./src", "--db", "./output.db", "--all-langs"];
      const result = parseIndexCommandArgs(args);

      expect(result.languages.size).toBe(5);
      expect(Array.from(result.languages).sort()).toEqual([
        "bash",
        "csharp",
        "java",
        "tsx",
        "typescript",
      ]);
    });

    it("should ignore --all-langs when specific language flags are provided", () => {
      const args = ["--path", "./src", "--db", "./output.db", "--typescript", "--all-langs"];
      const result = parseIndexCommandArgs(args);

      // When both specific flags and --all-langs are provided, both should be honored
      // resulting in all languages being selected
      expect(result.languages.size).toBe(5);
    });

    it("should handle absolute paths for source and output", () => {
      const args = ["--path", "/absolute/path/src", "--db", "/absolute/path/output.db"];
      const result = parseIndexCommandArgs(args);

      expect(result.path).toBe("/absolute/path/src");
      expect(result.db).toBe("/absolute/path/output.db");
    });

    it("should handle relative paths with multiple segments", () => {
      const args = ["--path", "./path/to/src", "--db", "./path/to/output.db"];
      const result = parseIndexCommandArgs(args);

      expect(result.path).toBe("./path/to/src");
      expect(result.db).toBe("./path/to/output.db");
    });
  });
});
