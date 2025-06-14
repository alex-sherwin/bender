import fs from 'node:fs/promises';
import path from 'node:path';
import Parser from 'tree-sitter';
import JavaImport from 'tree-sitter-java';

const Java = JavaImport as Parser.Language;

interface JavaMethod {
  name: string;
  signature: string; // For methods, includes name, params, return type
  isStatic: boolean; // For methods, whether they are static or instance
  returnType: string;
}

interface JavaField {
  name: string;
  type: string; // For fields, parameters
  signature: string; // For methods, includes name, params, return type
  isStatic: boolean; // Whether the field is static or instance
}

interface ClassInfo {
  name: string;
  fields: JavaField[];
  methods: JavaMethod[];
}

interface FileData {
  filePath: string;
  packageName: string | null;
  imports: string[]; // List of fully qualified names or patterns from imports
  definedClasses: ClassInfo[];
}

// Type for the output JSON structure
type ProjectData = Record<string, FileData>;

const parser = new Parser();

// Helper function to get text of a node
function getNodeText(node: Parser.SyntaxNode | null | undefined, sourceCode: string): string {
  if (!node) return '';
  return sourceCode.substring(node.startIndex, node.endIndex);
}

async function parseJavaFile(filePath: string, sourceCode: string): Promise<FileData> {
  const tree = parser.parse(sourceCode);
  const rootNode = tree.rootNode;

  let packageName: string | null = null;
  const imports: string[] = [];
  const definedClasses: ClassInfo[] = [];

  // Query for package
  const packageQuery = new Parser.Query(Java, `
    (package_declaration (identifier) @pkg.name)
    (package_declaration (scoped_identifier) @pkg.name)
  `);
  const packageCaptures = packageQuery.captures(rootNode);
  if (packageCaptures.length > 0) {
    packageName = getNodeText(packageCaptures[0].node, sourceCode);
  }

  // Query for imports
  const simpleImportQuery = new Parser.Query(Java, `
    (import_declaration
      (scoped_identifier) @name
      ((asterisk))? @wildcard)
    (import_declaration
      (identifier) @name
      ((asterisk))? @wildcard)
  `);
  simpleImportQuery.captures(rootNode).forEach(capture => {
    if (capture.name === 'name') {
      let importName = getNodeText(capture.node, sourceCode);
      // Get the parent import_declaration node
      const importDeclarationNode = capture.node.parent;
      // If any child of the declaration is an asterisk, it's a wildcard import
      if (importDeclarationNode?.children.some(child => child.type === 'asterisk')) {
        importName += '.*';
      }
      imports.push(importName);
    }
  });


  // Query for classes and their members
  const classQuery = new Parser.Query(Java, `
    (class_declaration
      name: (identifier) @class.name
      body: (class_body
        (field_declaration
          type: (_) @field.type
          declarator: (variable_declarator
            name: (identifier) @field.name
          )
        )* @fields
        (method_declaration
          type: (_) @method.return_type
          name: (identifier) @method.name
          parameters: (formal_parameters) @method.parameters
        )* @methods
      )
    )
  `);

  const classResults = classQuery.captures(rootNode);

  // console.log("classResults", classResults);

  // More detailed queries might be needed, especially for complex signatures.
  // This is a simplified extraction.

  rootNode.children.forEach(node => {
    console.log(`node.type [${node.type}]`);

  });

  rootNode.children.filter(node => node.type === 'class_declaration').forEach(classNode => {
    const classNameNode = classNode.childForFieldName('name');
    if (!classNameNode) return;

    const className = getNodeText(classNameNode, sourceCode);
    console.log(`className [${className}]`);
    const classInfo: ClassInfo = { name: className, fields: [], methods: [] };

    const classBodyNode = classNode.childForFieldName('body');
    if (!classBodyNode) {
      definedClasses.push(classInfo);
      return;
    }

    // Extract nested classes
    classBodyNode.children.filter(child => child.type === 'class_declaration').forEach(classNode => {
      const classNameNode = classNode.childForFieldName('name');
      if (!classNameNode) return;

      const className = getNodeText(classNameNode, sourceCode);


    });

    // Extract Fields
    classBodyNode.children.filter(child => child.type === 'field_declaration').forEach(fieldNode => {
      const typeNode = fieldNode.childForFieldName('type');
      const declaratorNode = fieldNode.children.find(c => c.type === 'variable_declarator');
      const nameNode = declaratorNode?.childForFieldName('name');

      // Check if field is static
      const isStatic = fieldNode.children.some(child =>
        child.type === 'modifiers' &&
        child.children.some(modifier => modifier.type === 'static')
      );

      if (nameNode) {
        const fieldType = typeNode ? getNodeText(typeNode, sourceCode) : 'unknown';
        const fieldName = getNodeText(nameNode, sourceCode);
        classInfo.fields.push({
          name: fieldName,
          type: fieldType,
          signature: `${fieldType} ${fieldName}`,
          isStatic: isStatic
        });
      }
    });

    // Extract Methods
    classBodyNode.children.filter(child => child.type === 'method_declaration').forEach(methodNode => {
      const returnTypeNode = methodNode.childForFieldName('type');
      const nameNode = methodNode.childForFieldName('name');
      const paramsNode = methodNode.childForFieldName('parameters');

      if (nameNode) {
        const methodName = getNodeText(nameNode, sourceCode);
        const returnType = returnTypeNode ? getNodeText(returnTypeNode, sourceCode) : 'void';

        // Check if method is static
        const isStatic = methodNode.children.some(child =>
          child.type === 'modifiers' &&
          child.children.some(modifier => modifier.type === 'static')
        );

        const params: { name: string, type: string }[] = [];
        if (paramsNode) {
          paramsNode.children.filter(p => p.type === 'formal_parameter').forEach(param => {
            const paramTypeNode = param.childForFieldName('type');
            const paramNameNode = param.childForFieldName('name');
            if (paramTypeNode && paramNameNode) {
              params.push({
                name: getNodeText(paramNameNode, sourceCode),
                type: getNodeText(paramTypeNode, sourceCode)
              });
            }
          });
        }

        const paramsString = params.map(p => `${p.type} ${p.name}`).join(', ');
        classInfo.methods.push({
          name: methodName,
          returnType: returnType,
          signature: `${returnType} ${methodName}(${paramsString})`,
          isStatic: isStatic
        });
      }
    });


    definedClasses.push(classInfo);
  });


  return {
    filePath: path.resolve(filePath), // Store absolute path
    packageName,
    imports,
    definedClasses,
  };
}

async function scanDirectory(dirPath: string, projectData: ProjectData): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await scanDirectory(fullPath, projectData);
    } else if (entry.isFile() && entry.name.endsWith('.java')) {
      console.log(`Parsing: ${fullPath}`);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const fileAstData = await parseJavaFile(fullPath, content);
        projectData[fileAstData.filePath] = fileAstData;
      } catch (error) {
        console.error(`Error parsing file ${fullPath}:`, error);
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: ts-node extractor.ts <maven_project_root_dir> [output_file.json]');
    process.exit(1);
  }

  const projectRootDir = path.resolve(args[0]);
  const outputFilePath = args[1] ? path.resolve(args[1]) : path.resolve(projectRootDir, 'project-data.json');

  if (!await fs.stat(projectRootDir).then(s => s.isDirectory()).catch(() => false)) {
    console.error(`Error: Project root directory not found: ${projectRootDir}`);
    process.exit(1);
  }

  // await Parser.init(); // Initialize Tree-sitter (loads tree-sitter.wasm)
  // Ensure tree-sitter-java grammar is loaded.
  // If 'tree-sitter-java' is a standard npm package, this should work.
  // Otherwise, you might need: await Parser.Language.load('path/to/tree-sitter-java.wasm');
  try {
    parser.setLanguage(Java);
  } catch (e) {
    console.error("Failed to set Tree-sitter Java language. Ensure tree-sitter-java.wasm is accessible.", e);
    console.log("You might need to copy 'tree-sitter.wasm' from 'node_modules/tree-sitter/' and 'tree-sitter-java.wasm' from 'node_modules/tree-sitter-java/wasm/' to your project directory or ensure your NODE_PATH is set up correctly.");
    process.exit(1);
  }


  const projectData: ProjectData = {};
  const javaSrcDirs = [
    path.join(projectRootDir, 'src', 'main', 'java'),
    path.join(projectRootDir, 'src', 'test', 'java'),
  ];

  for (const srcDir of javaSrcDirs) {
    if (await fs.stat(srcDir).then(s => s.isDirectory()).catch(() => false)) {
      console.log(`Scanning directory: ${srcDir}`);
      await scanDirectory(srcDir, projectData);
    } else {
      console.log(`Directory not found, skipping: ${srcDir}`);
    }
  }

  await fs.mkdir(path.dirname(outputFilePath), { recursive: true });

  await fs.writeFile(outputFilePath, JSON.stringify(projectData, null, 2));
  console.log(`Project data extracted to: ${outputFilePath}`);
}

main().catch(console.error);