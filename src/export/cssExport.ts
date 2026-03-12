import type { AST } from '../parser/types';

export function exportToCSS(ast: AST | null, positions: Record<string, { left: number; top: number; width: number; height: number }>): string {
  if (!ast) return '';

  let css = '/* Layout Algebra - Exported CSS */\n';
  css += '.container {\n  position: relative;\n  width: 800px;\n  height: 600px;\n  background: #f0f0f0;\n}\n\n';

  for (const el of ast.elements) {
    if (el.id === 'container') continue;
    const pos = positions[el.id];
    if (!pos) continue;

    css += `.${el.id} {\n`;
    css += `  position: absolute;\n`;
    css += `  left: ${Math.round(pos.left)}px;\n`;
    css += `  top: ${Math.round(pos.top)}px;\n`;
    css += `  width: ${Math.round(pos.width)}px;\n`;
    css += `  height: ${Math.round(pos.height)}px;\n`;
    css += `}\n\n`;
  }

  return css;
}
