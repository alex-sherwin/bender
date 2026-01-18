import { Parser, Language, TreeCursor } from 'web-tree-sitter';

await Parser.init();

const Java = await Language.load('public/tree-sitter-java.wasm');

const parser = new Parser();
parser.setLanguage(Java);

// Test parsing to verify comment detection
const testCode = `
/**
 * block
 * comment
 */
public class Test {
    /* Block comment */
    public void method() {
        // Another comment
    }
}
`;

const tree = parser.parse(testCode);
if (!tree) {
  console.error("Failed to parse code");
  throw new Error("Parser failed");
}

console.log("Parsed tree:", tree.rootNode.toString());

// Check all node types to debug what's actually being parsed
const allNodes: Array<{type: string, text: string}> = [];
const comments: Array<{type: string, text: string}> = [];
const cursor = tree.walk();

function walkTree(cursor: TreeCursor): void {
  do {
    allNodes.push({
      type: cursor.nodeType,
      text: cursor.nodeText.substring(0, 50) // Limit text length for logging
    });
    
    if (cursor.nodeType === 'comment' || cursor.nodeType === 'line_comment' || cursor.nodeType === 'block_comment') {
      comments.push({
        type: cursor.nodeType,
        text: cursor.nodeText
      });
    }
    
    if (cursor.gotoFirstChild()) {
      walkTree(cursor);
      cursor.gotoParent();
    }
  } while (cursor.gotoNextSibling());
}

walkTree(cursor);
console.log("All node types found:", [...new Set(allNodes.map(n => n.type))]);
console.log("Found comments:", comments);

// Additional debugging - check language and version info
console.log("Language version:", (Java as any).version);
console.log("Language loaded successfully");

// Try parsing just a comment to see if it's recognized
const commentOnlyCode = "// Just a comment";
const commentTree = parser.parse(commentOnlyCode);
if (commentTree) {
  console.log("Comment-only parse result:", commentTree.rootNode.toString());
  const commentCursor = commentTree.walk();
  const commentNodes: string[] = [];
  
  function walkCommentTree(cursor: any): void {
    do {
      commentNodes.push(cursor.nodeType);
      if (cursor.gotoFirstChild()) {
        walkCommentTree(cursor);
        cursor.gotoParent();
      }
    } while (cursor.gotoNextSibling());
  }
  
  walkCommentTree(commentCursor);
  console.log("Comment-only node types:", commentNodes);
}

console.log("here!");