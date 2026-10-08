import { builderLines } from './builder-model.js';
import type { BuilderDocument, BuilderNode, Expr } from './types.js';

export function hasValueReturn(nodes: readonly BuilderNode[]): boolean {
  return nodes.some(node => node.kind === 'return' && !!node.expression
    || node.kind !== 'define' && 'body' in node && hasValueReturn(node.body)
    || node.kind === 'if' && !!node.otherwise && hasValueReturn([node.otherwise]));
}

// Do not count a function's own recursive calls when deleting that block.
export function functionReferenceLines(model: BuilderDocument, name: string, definitionId: string): number[] {
  const lines = new Map(builderLines(model).map(row => [row.id, row.line])), references: number[] = [];
  const uses = (expr: Expr): boolean => {
    switch (expr.kind) {
      case 'call': return expr.name === name || expr.args.some(uses);
      case 'array': return expr.items.some(uses);
      case 'index': return uses(expr.target) || expr.indices.some(uses);
      case 'unary': return uses(expr.expression);
      case 'binary': return uses(expr.left) || uses(expr.right);
      default: return false;
    }
  };
  function visit(node: BuilderNode): void {
    if (node.id === definitionId) return;
    const expressions: Expr[] = [];
    if (node.kind === 'assign') node.assignments.forEach(a => expressions.push(...a.target.indices, a.expression));
    if (node.kind === 'print') expressions.push(...node.args);
    if ((node.kind === 'return' || node.kind === 'call') && node.expression) expressions.push(node.expression);
    if (node.kind === 'if' || node.kind === 'while') expressions.push(node.condition);
    if (node.kind === 'for') expressions.push(node.start, node.end, node.step);
    if (expressions.some(uses)) references.push(lines.get(node.id)!);
    if ('body' in node) node.body.forEach(visit);
    if (node.kind === 'if' && node.otherwise) visit(node.otherwise);
  }
  model.nodes.forEach(visit); return references;
}
