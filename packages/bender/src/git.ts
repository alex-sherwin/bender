/**
 * Git integration utilities for extracting repository metadata.
 * @author GitHub Copilot
 */

import { execSync } from "node:child_process";

/**
 * Get the current git branch name for a directory.
 * @author GitHub Copilot
 * @param dirPath Path to the directory (should be inside a git repository)
 * @returns The current branch name, or null if not a git repo or on error
 */
export function getCurrentBranch(dirPath: string): string | null {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: dirPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    return branch || null;
  } catch {
    return null;
  }
}

/**
 * Get the current git commit hash for a directory.
 * @author GitHub Copilot
 * @param dirPath Path to the directory (should be inside a git repository)
 * @returns The current commit hash, or null if not a git repo or on error
 */
export function getCurrentCommit(dirPath: string): string | null {
  try {
    const commit = execSync("git rev-parse HEAD", {
      cwd: dirPath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    return commit || null;
  } catch {
    return null;
  }
}
