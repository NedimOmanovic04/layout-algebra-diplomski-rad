import type { AST } from './types';

export function parseDSL(code: string): { ast: AST | null; error: string | null } {
  const lines = code.split('\n');
  const ast: AST = { elements: [], constraints: [], colors: [], hierarchy: [], avoids: [] };
  let containerWidth = 800;
  let containerHeight = 600;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('//')) continue;

    if (line.startsWith('CONTAINER ')) {
      const parts = line.split(/\s+/);
      if (parts.length !== 3) return { ast: null, error: `Line ${i + 1}: Invalid CONTAINER syntax. Expected: CONTAINER width height` };
      const w = parseFloat(parts[1]);
      const h = parseFloat(parts[2]);
      if (isNaN(w) || isNaN(h) || w < 100 || h < 100) return { ast: null, error: `Line ${i + 1}: Container width and height must be numbers >= 100.` };
      containerWidth = Math.round(w);
      containerHeight = Math.round(h);
    } else if (line.startsWith('ELEMENT ')) {
      const parts = line.split(/\s+/);
      if (parts.length !== 4) return { ast: null, error: `Line ${i + 1}: Invalid ELEMENT syntax. Expected: ELEMENT id width height` };
      const [_, id, wStr, hStr] = parts;
      const width = parseFloat(wStr);
      const height = parseFloat(hStr);
      if (isNaN(width) || isNaN(height)) return { ast: null, error: `Line ${i + 1}: Width and height must be numbers.` };
      ast.elements.push({ id, width, height });
    } else if (line.startsWith('CONSTRAINT ')) {
      const constraintStr = line.substring('CONSTRAINT '.length).trim();
      const elemMatch = constraintStr.match(/^([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*(==|>=|<=)\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)(?:\s*([+-])\s*([0-9.]+))?$/);
      const constMatch = constraintStr.match(/^([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*(==|>=|<=)\s*([0-9.-]+)$/);
      if (elemMatch) {
        const [_, leftId, leftProp, operator, rightId, rightProp, sign, offsetStr] = elemMatch;
        let offset = 0;
        if (offsetStr) {
          offset = parseFloat(offsetStr);
          if (sign === '-') offset = -offset;
        }
        ast.constraints.push({
          leftId,
          leftProp,
          operator: operator as any,
          rightId,
          rightProp,
          offset
        });
      } else if (constMatch) {
        const [_, leftId, leftProp, operator, rightConstStr] = constMatch;
        const rightConstant = parseFloat(rightConstStr);
        if (isNaN(rightConstant)) return { ast: null, error: `Line ${i + 1}: Invalid constant in CONSTRAINT.` };
        ast.constraints.push({
          leftId,
          leftProp,
          operator: operator as any,
          rightConstant,
          offset: 0
        });
      } else {
        return { ast: null, error: `Line ${i + 1}: Invalid CONSTRAINT syntax.` };
      }
    } else if (line.startsWith('COLOR ')) {
      const parts = line.split(/\s+/);
      if (parts.length !== 3) return { ast: null, error: `Line ${i + 1}: Invalid COLOR syntax. Expected: COLOR elementId #hexcolor` };
      const [_, elementId, color] = parts;
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { ast: null, error: `Line ${i + 1}: Color must be a valid hex color (e.g. #ff0000).` };
      ast.colors.push({ elementId, color });
    } else if (line.startsWith('PARENT ')) {
      const parts = line.split(/\s+/);
      if (parts.length !== 3) return { ast: null, error: `Line ${i + 1}: Invalid PARENT syntax. Expected: PARENT childId parentId` };
      const [_, childId, parentId] = parts;
      ast.hierarchy.push({ childId, parentId });
    } else if (line.startsWith('AVOID ')) {
      const parts = line.split(/\s+/);
      if (parts.length !== 3) return { ast: null, error: `Line ${i + 1}: Invalid AVOID syntax. Expected: AVOID id1 id2` };
      const [_, id1, id2] = parts;
      ast.avoids.push({ id1, id2 });
    } else {
      return { ast: null, error: `Line ${i + 1}: Unknown command "${line}". Use CONTAINER, ELEMENT, CONSTRAINT, COLOR, PARENT, or AVOID.` };
    }
  }

  // Ensure container element is defined
  if (!ast.elements.find(e => e.id === 'container')) {
    ast.elements.unshift({ id: 'container', width: containerWidth, height: containerHeight });
  } else {
    const cont = ast.elements.find(e => e.id === 'container')!;
    cont.width = containerWidth;
    cont.height = containerHeight;
  }

  // Validate hierarchy and avoids
  const elIds = new Set(ast.elements.map(e => e.id));
  for (let i = 0; i < ast.hierarchy.length; i++) {
    const { childId, parentId } = ast.hierarchy[i];
    if (!elIds.has(childId)) return { ast: null, error: `Hierarchy error: child "${childId}" is not defined.` };
    if (!elIds.has(parentId)) return { ast: null, error: `Hierarchy error: parent "${parentId}" is not defined.` };
  }
  for (let i = 0; i < ast.avoids.length; i++) {
    const { id1, id2 } = ast.avoids[i];
    if (!elIds.has(id1)) return { ast: null, error: `Avoid error: element "${id1}" is not defined.` };
    if (!elIds.has(id2)) return { ast: null, error: `Avoid error: element "${id2}" is not defined.` };
  }

  return { ast, error: null };
}
