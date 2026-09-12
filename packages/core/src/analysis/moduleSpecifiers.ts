import ts from 'typescript';
import path from 'node:path';

export interface ModuleSpecifierReference {
  value: string;
  line: number;
  isTypeOnly: boolean;
}

function getScriptKind(filePath: string): ts.ScriptKind {
  switch (path.extname(filePath).toLowerCase()) {
    case '.ts':
    case '.mts':
    case '.cts':
      return ts.ScriptKind.TS;
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.js':
    case '.mjs':
    case '.cjs':
      return ts.ScriptKind.JS;
    case '.jsx':
      return ts.ScriptKind.JSX;
    default:
      return ts.ScriptKind.Unknown;
  }
}

export function parseSourceFile(filePath: string, content: string): ts.SourceFile {
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, getScriptKind(filePath));
}

/** Extracts only syntactic module references, never import-looking text in literals/comments. */
export function collectModuleSpecifiers(sourceFile: ts.SourceFile): ModuleSpecifierReference[] {
  const references: ModuleSpecifierReference[] = [];

  const add = (node: ts.StringLiteralLike, isTypeOnly = false): void => {
    references.push({
      value: node.text,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
      isTypeOnly,
    });
  };

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      const importIsTypeOnly = ts.isImportDeclaration(node)
        ? Boolean(
            node.importClause?.isTypeOnly ||
            (node.importClause &&
              !node.importClause.name &&
              node.importClause.namedBindings &&
              ts.isNamedImports(node.importClause.namedBindings) &&
              node.importClause.namedBindings.elements.length > 0 &&
              node.importClause.namedBindings.elements.every((element) => element.isTypeOnly))
          )
        : node.isTypeOnly;
      add(node.moduleSpecifier, importIsTypeOnly);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      add(node.moduleReference.expression, node.isTypeOnly);
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0]!) &&
      ((ts.isIdentifier(node.expression) && node.expression.text === 'require') ||
        node.expression.kind === ts.SyntaxKind.ImportKeyword)
    ) {
      add(node.arguments[0]!);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return references;
}
