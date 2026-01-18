import { describe, it, expect } from "vitest";
import { parseIndexCommandArgs } from "../../src/cli/args-parser";

describe("CLI argument parser", () => {
  describe("parseIndexCommandArgs", () => {
    it("should parse basic index command with source and db path only", () => {
      const args = ["./src", "./output.db"];
      const result = parseIndexCommandArgs(args);

      expect(result.sourceDir).toBe("./src");
      expect(result.outputDb).toBe("./output.db");
      expect(result.description).toBeUndefined();
      expect(result.languages.size).toBe(5);
      expect(result.languages.has("typescript")).toBe(true);
      expect(result.languages.has("tsx")).toBe(true);
      expect(result.languages.has("java")).toBe(true);
      expect(result.languages.has("bash")).toBe(true);
      expect(result.languages.has("csharp")).toBe(true);
    });

    it("should parse with description", () => {
      const args = ["./src", "./output.db", "Initial snapshot"];
      const result = parseIndexCommandArgs(args);

      expect(result.sourceDir).toBe("./src");
      expect(result.outputDb).toBe("./output.db");
      expect(result.description).toBe("Initial snapshot");
      expect(result.languages.size).toBe(5);
    });

    it("should parse --typescript flag only", () => {
      const args = ["./src", "./output.db", "--typescript"];
      const result = parseIndexCommandArgs(args);

      expect(result.languages.has("typescript")).toBe(true);
      expect(result.languages.has("tsx")).toBe(false);
      expect(result.languages.has("java")).toBe(false);
      expect(result.languages.has("bash")).toBe(false);
      expect(result.languages.has("csharp")).toBe(false);
      expect(result.languages.size).toBe(1);
    });

    it("should parse --bash flag only", () => {
      const args = ["./src", "./output.db", "--bash"];
      const result = parseIndexCommandArgs(args);

      expect(result.languages.has("bash")).toBe(true);
      expect(result.languages.has("typescript")).toBe(false);
      expect(result.languages.has("tsx")).toBe(false);
      expect(result.languages.has("java")).toBe(false);
      expect(result.languages.has("csharp")).toBe(false);
      expect(result.languages.size).toBe(1);
    });

    it("should parse --java flag only", () => {
      const args = ["./src", "./output.db", "--java"];
      const result = parseIndexCommandArgs(args);

      expect(result.languages.has("java")).toBe(true);
      expect(result.languages.has("typescript")).toBe(false);
      expect(result.languages.has("tsx")).toBe(false);
      expect(result.languages.has("bash")).toBe(false);
      expect(result.languages.has("csharp")).toBe(false);
      expect(result.languages.size).toBe(1);
    });

    it("should parse --csharp flag only", () => {
      const args = ["./src", "./output.db", "--csharp"];
      const result = parseIndexCommandArgs(args);

      expect(result.languages.has("csharp")).toBe(true);
      expect(result.languages.has("typescript")).toBe(false);
      expect(result.languages.has("tsx")).toBe(false);
      expect(result.languages.has("java")).toBe(false);
      expect(result.languages.has("bash")).toBe(false);
      expect(result.languages.size).toBe(1);
    });

    it("should parse --tsx flag separately from --typescript", () => {
      const args = ["./src", "./output.db", "--tsx"];
      const result = parseIndexCommandArgs(args);

      expect(result.languages.has("tsx")).toBe(true);
      expect(result.languages.has("typescript")).toBe(false);
      expect(result.languages.has("java")).toBe(false);
      expect(result.languages.has("bash")).toBe(false);
      expect(result.languages.has("csharp")).toBe(false);
      expect(result.languages.size).toBe(1);
    });

    it("should combine --typescript and --bash flags", () => {
      const args = ["./src", "./output.db", "--typescript", "--bash"];
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
        "./src",
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
      const args = ["./src", "./output.db", "--all-langs"];
      const result = parseIndexCommandArgs(args);

      expect(result.languages.has("typescript")).toBe(true);
      expect(result.languages.has("tsx")).toBe(true);
      expect(result.languages.has("java")).toBe(true);
      expect(result.languages.has("bash")).toBe(true);
      expect(result.languages.has("csharp")).toBe(true);
      expect(result.languages.size).toBe(5);
    });

    it("should throw error on missing sourceDir", () => {
      const args: string[] = [];

      expect(() => parseIndexCommandArgs(args)).toThrow();
      expect(() => parseIndexCommandArgs(args)).toThrow("Missing required arguments");
    });

    it("should throw error on missing outputDb", () => {
      const args = ["./src"];

      expect(() => parseIndexCommandArgs(args)).toThrow();
      expect(() => parseIndexCommandArgs(args)).toThrow("Missing required arguments");
    });

    it("should preserve description with language flags", () => {
      const args = [
        "./src",
        "./output.db",
        "My snapshot",
        "--typescript",
        "--bash",
      ];
      const result = parseIndexCommandArgs(args);

      expect(result.sourceDir).toBe("./src");
      expect(result.outputDb).toBe("./output.db");
      expect(result.description).toBe("My snapshot");
      expect(result.languages.has("typescript")).toBe(true);
      expect(result.languages.has("bash")).toBe(true);
      expect(result.languages.has("tsx")).toBe(false);
      expect(result.languages.size).toBe(2);
    });

    it("should preserve description between flags", () => {
      const args = [
        "./src",
        "./output.db",
        "--typescript",
        "My snapshot",
        "--bash",
      ];
      const result = parseIndexCommandArgs(args);

      expect(result.description).toBe("My snapshot");
      expect(result.languages.has("typescript")).toBe(true);
      expect(result.languages.has("bash")).toBe(true);
      expect(result.languages.has("tsx")).toBe(false);
      expect(result.languages.size).toBe(2);
    });

    it("should throw error on invalid flag", () => {
      const args = ["./src", "./output.db", "--invalid-lang"];

      expect(() => parseIndexCommandArgs(args)).toThrow();
      expect(() => parseIndexCommandArgs(args)).toThrow("Invalid arguments");
    });

    it("should throw error on no arguments", () => {
      const args: string[] = [];

      expect(() => parseIndexCommandArgs(args)).toThrow();
    });

    it("should handle multi-word descriptions", () => {
      const args = [
        "./src",
        "./output.db",
        "This is a multi-word description",
        "--java",
      ];
      const result = parseIndexCommandArgs(args);

      expect(result.description).toBe("This is a multi-word description");
      expect(result.languages.has("java")).toBe(true);
      expect(result.languages.size).toBe(1);
    });

    it("should parse all languages explicitly", () => {
      const args = [
        "./src",
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
      const args = ["./src", "./output.db", "--all-langs"];
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
      const args = ["./src", "./output.db", "--typescript", "--all-langs"];
      const result = parseIndexCommandArgs(args);

      // When both specific flags and --all-langs are provided, both should be honored
      // resulting in all languages being selected
      expect(result.languages.size).toBe(5);
    });

    it("should handle absolute paths for source and output", () => {
      const args = ["/absolute/path/src", "/absolute/path/output.db"];
      const result = parseIndexCommandArgs(args);

      expect(result.sourceDir).toBe("/absolute/path/src");
      expect(result.outputDb).toBe("/absolute/path/output.db");
    });

    it("should handle relative paths with multiple segments", () => {
      const args = ["./path/to/src", "./path/to/output.db"];
      const result = parseIndexCommandArgs(args);

      expect(result.sourceDir).toBe("./path/to/src");
      expect(result.outputDb).toBe("./path/to/output.db");
    });
  });
});
