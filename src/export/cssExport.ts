import type { AST } from '../parser/types';

export type ExportFormat = 'absolute' | 'flexbox' | 'grid' | 'html';

/**
 * Export layout to CSS/HTML in various formats.
 *
 * Supported formats:
 *   - absolute: position: absolute with px values (existing behavior)
 *   - flexbox: approximate flexbox layout
 *   - grid: CSS Grid layout
 *   - html: complete HTML file with inline <style>
 */
export function exportLayout(
  format: ExportFormat,
  ast: AST | null,
  positions: Record<string, { left: number; top: number; width: number; height: number }>
): string {
  if (!ast) return '';
  switch (format) {
    case 'absolute': return exportToCSS(ast, positions);
    case 'flexbox': return exportToFlexbox(ast, positions);
    case 'grid': return exportToGrid(ast, positions);
    case 'html': return exportToHTML(ast, positions);
    default: return exportToCSS(ast, positions);
  }
}

/** Get file extension for export format */
export function getExportExtension(format: ExportFormat): string {
  switch (format) {
    case 'html': return 'html';
    default: return 'css';
  }
}

/** Get MIME type for export format */
export function getExportMime(format: ExportFormat): string {
  switch (format) {
    case 'html': return 'text/html';
    default: return 'text/css';
  }
}

// --- Absolute CSS Export ---
function exportToCSS(
  ast: AST,
  positions: Record<string, { left: number; top: number; width: number; height: number }>
): string {
  const container = ast.elements.find(e => e.id === 'container');
  const cw = container?.width ?? 800;
  const ch = container?.height ?? 600;
  const colorMap: Record<string, string> = {};
  ast.colors.forEach(c => colorMap[c.elementId] = c.color);

  let css = '/* Layout Algebra — Exported CSS (Absolute) */\n';
  css += `.container {\n  position: relative;\n  width: ${cw}px;\n  height: ${ch}px;\n  background: #282a36;\n}\n\n`;

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
    if (colorMap[el.id]) css += `  background-color: ${colorMap[el.id]};\n`;
    css += `}\n\n`;
  }

  return css;
}

// --- Flexbox Export ---
function exportToFlexbox(
  ast: AST,
  positions: Record<string, { left: number; top: number; width: number; height: number }>
): string {
  const container = ast.elements.find(e => e.id === 'container');
  const cw = container?.width ?? 800;
  const ch = container?.height ?? 600;
  const colorMap: Record<string, string> = {};
  ast.colors.forEach(c => colorMap[c.elementId] = c.color);

  // Build parent-child tree
  const parentMap: Record<string, string> = {};
  ast.hierarchy.forEach(h => parentMap[h.childId] = h.parentId);
  const childrenOf: Record<string, string[]> = { container: [] };
  ast.elements.forEach(el => {
    if (el.id === 'container') return;
    const parent = parentMap[el.id] || 'container';
    if (!childrenOf[parent]) childrenOf[parent] = [];
    childrenOf[parent].push(el.id);
  });

  // Analyze layout direction for each parent
  const elements = ast.elements.filter(e => e.id !== 'container');

  let css = '/* Layout Algebra — Exported CSS (Flexbox) */\n';
  css += `.container {\n  display: flex;\n  flex-direction: column;\n  width: ${cw}px;\n  min-height: ${ch}px;\n  background: #282a36;\n  position: relative;\n}\n\n`;

  // Detect if children are arranged horizontally or vertically
  for (const el of elements) {
    const pos = positions[el.id];
    if (!pos) continue;
    const children = childrenOf[el.id] || [];

    css += `.${el.id} {\n`;
    css += `  width: ${Math.round(pos.width)}px;\n`;
    css += `  height: ${Math.round(pos.height)}px;\n`;
    if (colorMap[el.id]) css += `  background-color: ${colorMap[el.id]};\n`;
    css += `  margin: ${Math.round(pos.top)}px 0 0 ${Math.round(pos.left)}px;\n`;

    if (children.length > 0) {
      // Determine flex direction based on child positions
      const childPositions = children.map(cid => positions[cid]).filter(Boolean);
      if (childPositions.length > 1) {
        const sortedByLeft = [...childPositions].sort((a, b) => a.left - b.left);
        const sortedByTop = [...childPositions].sort((a, b) => a.top - b.top);
        const horizontalSpread = sortedByLeft[sortedByLeft.length - 1].left - sortedByLeft[0].left;
        const verticalSpread = sortedByTop[sortedByTop.length - 1].top - sortedByTop[0].top;
        const direction = horizontalSpread > verticalSpread ? 'row' : 'column';
        css += `  display: flex;\n  flex-direction: ${direction};\n`;
      } else {
        css += `  display: flex;\n  flex-direction: column;\n`;
      }
      css += `  position: relative;\n`;
    }

    css += `}\n\n`;
  }

  return css;
}

// --- CSS Grid Export ---
function exportToGrid(
  ast: AST,
  positions: Record<string, { left: number; top: number; width: number; height: number }>
): string {
  const container = ast.elements.find(e => e.id === 'container');
  const cw = container?.width ?? 800;
  const ch = container?.height ?? 600;
  const colorMap: Record<string, string> = {};
  ast.colors.forEach(c => colorMap[c.elementId] = c.color);

  const elements = ast.elements.filter(e => e.id !== 'container');

  // Collect unique column breakpoints and row breakpoints
  const colPoints = new Set<number>([0, cw]);
  const rowPoints = new Set<number>([0, ch]);

  for (const el of elements) {
    const pos = positions[el.id];
    if (!pos) continue;
    colPoints.add(Math.round(pos.left));
    colPoints.add(Math.round(pos.left + pos.width));
    rowPoints.add(Math.round(pos.top));
    rowPoints.add(Math.round(pos.top + pos.height));
  }

  const cols = [...colPoints].sort((a, b) => a - b);
  const rows = [...rowPoints].sort((a, b) => a - b);

  // Generate grid template
  const colSizes = [];
  for (let i = 0; i < cols.length - 1; i++) {
    colSizes.push(`${cols[i + 1] - cols[i]}px`);
  }
  const rowSizes = [];
  for (let i = 0; i < rows.length - 1; i++) {
    rowSizes.push(`${rows[i + 1] - rows[i]}px`);
  }

  let css = '/* Layout Algebra — Exported CSS (Grid) */\n';
  css += `.container {\n`;
  css += `  display: grid;\n`;
  css += `  grid-template-columns: ${colSizes.join(' ')};\n`;
  css += `  grid-template-rows: ${rowSizes.join(' ')};\n`;
  css += `  width: ${cw}px;\n`;
  css += `  height: ${ch}px;\n`;
  css += `  background: #282a36;\n`;
  css += `}\n\n`;

  for (const el of elements) {
    const pos = positions[el.id];
    if (!pos) continue;

    const colStart = cols.indexOf(Math.round(pos.left)) + 1;
    const colEnd = cols.indexOf(Math.round(pos.left + pos.width)) + 1;
    const rowStart = rows.indexOf(Math.round(pos.top)) + 1;
    const rowEnd = rows.indexOf(Math.round(pos.top + pos.height)) + 1;

    css += `.${el.id} {\n`;
    css += `  grid-column: ${colStart} / ${colEnd};\n`;
    css += `  grid-row: ${rowStart} / ${rowEnd};\n`;
    if (colorMap[el.id]) css += `  background-color: ${colorMap[el.id]};\n`;
    css += `}\n\n`;
  }

  return css;
}

// --- HTML + CSS Export ---
function exportToHTML(
  ast: AST,
  positions: Record<string, { left: number; top: number; width: number; height: number }>
): string {
  const cssContent = exportToCSS(ast, positions);
  const colorMap: Record<string, string> = {};
  ast.colors.forEach(c => colorMap[c.elementId] = c.color);

  // Build parent-child tree
  const parentMap: Record<string, string> = {};
  ast.hierarchy.forEach(h => parentMap[h.childId] = h.parentId);
  const childrenOf: Record<string, string[]> = { container: [] };
  ast.elements.forEach(el => {
    if (el.id === 'container') return;
    const parent = parentMap[el.id] || 'container';
    if (!childrenOf[parent]) childrenOf[parent] = [];
    childrenOf[parent].push(el.id);
  });

  // Build HTML tree recursively
  const renderElement = (id: string, indent: number): string => {
    const pad = '  '.repeat(indent);
    const children = childrenOf[id] || [];
    if (children.length === 0) {
      return `${pad}<div class="${id}">${id}</div>`;
    }
    let html = `${pad}<div class="${id}">\n`;
    for (const childId of children) {
      html += renderElement(childId, indent + 1) + '\n';
    }
    html += `${pad}</div>`;
    return html;
  };

  let html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Layout Algebra Export</title>\n  <style>\n`;

  // Indent CSS inside <style>
  const cssLines = cssContent.split('\n');
  for (const line of cssLines) {
    html += `    ${line}\n`;
  }

  html += `  </style>\n</head>\n<body>\n`;

  // Render container with children
  html += `  <div class="container">\n`;
  const rootChildren = childrenOf['container'] || [];
  for (const childId of rootChildren) {
    html += renderElement(childId, 2) + '\n';
  }
  html += `  </div>\n`;
  html += `</body>\n</html>\n`;

  return html;
}
