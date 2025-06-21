import fs from 'node:fs/promises';
import path from 'node:path';
import { log } from "./logger";
import { createJavaParser, parseJavaFile, type ProjectData } from "./extractor2";

async function scanDirectory(projectRootDir: string, dirPath: string, projectData: ProjectData): Promise<void> {
  const parser = await createJavaParser();
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await scanDirectory(projectRootDir, fullPath, projectData);
    } else if (entry.isFile() && entry.name.endsWith('.java')) {
      log.debug(`Parsing: ${fullPath}`);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const relativePath = path.relative(projectRootDir, fullPath);
        const fileName = path.basename(fullPath);
        log.warn(`projectRootDir [${projectRootDir}]`);
        const fileAstData = await parseJavaFile(parser, relativePath, fileName, content);
        projectData[fileAstData.filePath] = fileAstData;
      } catch (error) {
        log.error(`Error parsing file ${fullPath}:`, error);
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    log.error('Usage: ts-node main.ts <maven_project_root_dir> [output_file.json]');
    process.exit(1);
  }

  const projectRootDir = path.resolve(args[0]);
  const outputFilePath = args[1] ? path.resolve(args[1]) : path.resolve(projectRootDir, 'project-data.json');

  if (!await fs.stat(projectRootDir).then((s: any) => s.isDirectory()).catch(() => false)) {
    log.error(`Error: Project root directory not found: ${projectRootDir}`);
    process.exit(1);
  }

  const projectData: ProjectData = {};
  const javaSrcDirs = [
    path.join(projectRootDir, 'src', 'main', 'java'),
    path.join(projectRootDir, 'src', 'test', 'java'),
  ];

  for (const srcDir of javaSrcDirs) {
    if (await fs.stat(srcDir).then((s: any) => s.isDirectory()).catch(() => false)) {
      log.info(`Scanning directory: ${srcDir}`);
      await scanDirectory(projectRootDir, srcDir, projectData);
    } else {
      log.warn(`Directory not found, skipping: ${srcDir}`);
    }
  }

  await fs.mkdir(path.dirname(outputFilePath), { recursive: true });
  await fs.writeFile(outputFilePath, JSON.stringify(projectData, null, 2));
  log.info(`Project data extracted to: ${outputFilePath}`);
}

main().catch(log.error);