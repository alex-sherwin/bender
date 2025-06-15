import fs from 'node:fs/promises';
import path from 'node:path';
import Parser from 'tree-sitter';
import JavaImport from 'tree-sitter-java';

const Java = JavaImport as Parser.Language;

interface JavaMethod {
  name: string;
  signature: string;
  isStatic: boolean;
  returnType: string;
}

interface JavaField {
  name: string;
  type: string;
  signature: string;
  isStatic: boolean;
}

interface ClassInfo {
  name: string;
  fields: JavaField[];
  methods: JavaMethod[];
  type: "class" | "interface";
}

interface FileData {
  filePath: string;
  packageName: string | null;
  imports: string[];
  definedClasses: ClassInfo[];
}


type ProjectData = Record<string, FileData>;

const parser = new Parser();

// Helper function to get text of a node
function getNodeText(node: Parser.SyntaxNode | null | undefined, sourceCode: string): string {
  if (!node) return '';
  return sourceCode.substring(node.startIndex, node.endIndex);
}

function parseClassNode(classNode: Parser.SyntaxNode, sourceCode: string, definedClasses: ClassInfo[], type: ClassInfo["type"]): ClassInfo {

  const classNameNode = classNode.childForFieldName('name');
  if (!classNameNode) {
    throw new Error('Class node missing name');
  }

  const className = getNodeText(classNameNode, sourceCode);
  console.log(`className [${className}]`);

  const classInfo: ClassInfo = { type, name: className, fields: [], methods: [] };

  const classBodyNode = classNode.childForFieldName('body');
  if (!classBodyNode) {
    return classInfo;
  }

  // Process all children of the class body
  classBodyNode.children.forEach(child => {
    switch (child.type) {

      case 'constant_declaration': {
        const field = parseConstantNode(child, sourceCode);
        if (field) {
          classInfo.fields.push(field);
        }
        break;
      }

      case 'field_declaration': {
        const field = parseFieldNode(child, sourceCode);
        if (field) {
          classInfo.fields.push(field);
        }
        break;
      }

      case 'method_declaration': {
        const method = parseMethodNode(child, sourceCode);
        if (method) {
          classInfo.methods.push(method);
        }
        break;
      }

      case 'interface_declaration': {
        // Recursively parse nested classes
        const nestedClass = parseClassNode(child, sourceCode, definedClasses, "interface");
        definedClasses.push(nestedClass);
        break;
      }

      case 'class_declaration': {
        // Recursively parse nested classes
        const nestedClass = parseClassNode(child, sourceCode, definedClasses, "class");
        definedClasses.push(nestedClass);
        break;
      }

      default: {
        console.warn(`[${className}] Unhandled class node type: ${child.type}`);
        break;
      }

    }

  });

  return classInfo;
}

function parseConstantNode(constantNode: Parser.SyntaxNode, sourceCode: string): JavaField | null {
  const typeNode = constantNode.childForFieldName('type');
  const declaratorNode = constantNode.children.find(c => c.type === 'variable_declarator');
  const nameNode = declaratorNode?.childForFieldName('name');

  if (!nameNode) return null;

  // Check if field is static
  const isStatic = constantNode.children.some(child =>
    child.type === 'modifiers' &&
    child.children.some(modifier => modifier.type === 'static')
  );

  const fieldType = typeNode ? getNodeText(typeNode, sourceCode) : 'unknown';
  const fieldName = getNodeText(nameNode, sourceCode);

  return {
    name: fieldName,
    type: fieldType,
    signature: `${fieldType} ${fieldName}`,
    isStatic: isStatic
  };
}

function parseFieldNode(fieldNode: Parser.SyntaxNode, sourceCode: string): JavaField | null {
  const typeNode = fieldNode.childForFieldName('type');
  const declaratorNode = fieldNode.children.find(c => c.type === 'variable_declarator');
  const nameNode = declaratorNode?.childForFieldName('name');

  if (!nameNode) return null;

  // Check if field is static
  const isStatic = fieldNode.children.some(child =>
    child.type === 'modifiers' &&
    child.children.some(modifier => modifier.type === 'static')
  );

  const fieldType = typeNode ? getNodeText(typeNode, sourceCode) : 'unknown';
  const fieldName = getNodeText(nameNode, sourceCode);

  return {
    name: fieldName,
    type: fieldType,
    signature: `${fieldType} ${fieldName}`,
    isStatic: isStatic
  };
}

function parseMethodNode(methodNode: Parser.SyntaxNode, sourceCode: string): JavaMethod | null {
  const returnTypeNode = methodNode.childForFieldName('type');
  const nameNode = methodNode.childForFieldName('name');
  const paramsNode = methodNode.childForFieldName('parameters');

  if (!nameNode) return null;

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

  return {
    name: methodName,
    returnType: returnType,
    signature: `${returnType} ${methodName}(${paramsString})`,
    isStatic: isStatic
  };
}

function parsePackageNode(packageNode: Parser.SyntaxNode, sourceCode: string): string {
  // Package name can be either identifier or scoped_identifier
  const nameNode = packageNode.children.find(child =>
    child.type === 'identifier' || child.type === 'scoped_identifier'
  );
  return nameNode ? getNodeText(nameNode, sourceCode) : '';
}

function parseImportNode(importNode: Parser.SyntaxNode, sourceCode: string): string {
  // Import name can be either identifier or scoped_identifier
  const nameNode = importNode.children.find(child =>
    child.type === 'identifier' || child.type === 'scoped_identifier'
  );

  if (!nameNode) return '';

  let importName = getNodeText(nameNode, sourceCode);

  // Check if it's a wildcard import
  if (importNode.children.some(child => child.type === 'asterisk')) {
    importName += '.*';
  }

  return importName;
}

async function parseJavaFile(filePath: string, sourceCode: string): Promise<FileData> {
  const tree = parser.parse(sourceCode);
  const rootNode = tree.rootNode;

  let packageName: string | null = null;
  const imports: string[] = [];
  const definedClasses: ClassInfo[] = [];

  // Iterate through all top-level nodes
  rootNode.children.forEach(node => {

    // console.log(`node.type [${node.type}]`);

    switch (node.type) {

      case 'package_declaration': {
        packageName = parsePackageNode(node, sourceCode);
        break;
      }

      case 'import_declaration': {
        const importName = parseImportNode(node, sourceCode);
        if (importName) {
          imports.push(importName);
        }
        break;
      }

      case 'interface_declaration': {
        const classInfo = parseClassNode(node, sourceCode, definedClasses, "interface");
        definedClasses.push(classInfo);
        break;
      }

      case 'class_declaration': {
        const classInfo = parseClassNode(node, sourceCode, definedClasses, "class");
        definedClasses.push(classInfo);
        break;
      }

      default: {
        console.warn(`Unhandled top-level node type: ${node.type}`);
        break;
      }


    }
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