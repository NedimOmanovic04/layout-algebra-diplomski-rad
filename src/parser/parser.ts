import type { AST } from './types';

/**
 * Parser for Layout Algebra DSL.
 *
 * Supported commands:
 *   CONTAINER 800 600
 *   ELEMENT card 300 200        — fixed dimensions
 *   ELEMENT card 50% 200        — 50% of parent width, fixed height
 *   ELEMENT card 50% 30%        — percentage width and height
 *   CONSTRAINT a.left == b.right + 20
 *   CONSTRAINT a.width == b.width * 0.5
 *   CONSTRAINT a.width == b.height / 2
 *   CONSTRAINT a.x == b.width * 0.25 + 10
 *   CONSTRAINT a.width == 300 WEAK
 *   CONSTRAINT a.left == 0 STRONG
 *   CONSTRAINT a.top == 50 REQUIRED
 *   COLOR card #ff0000
 *   PARENT child parent
 *   AVOID a b
 */
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
      // Supports: ELEMENT id 300 200, ELEMENT id 50% 200, ELEMENT id 50% 30%
      const parts = line.split(/\s+/);
      if (parts.length !== 4) return { ast: null, error: `Line ${i + 1}: Invalid ELEMENT syntax. Expected: ELEMENT id width height (e.g. ELEMENT card 300 200 or ELEMENT card 50% 30%)` };
      const [_, id, wStr, hStr] = parts;

      let width = 100;
      let height = 100;
      let widthPercent: number | undefined;
      let heightPercent: number | undefined;

      if (wStr.endsWith('%')) {
        const pct = parseFloat(wStr.slice(0, -1));
        if (isNaN(pct) || pct <= 0 || pct > 100) return { ast: null, error: `Line ${i + 1}: Width percentage must be a number between 0 and 100.` };
        widthPercent = pct;
        width = Math.round(containerWidth * pct / 100); // fallback initial value
      } else {
        width = parseFloat(wStr);
        if (isNaN(width)) return { ast: null, error: `Line ${i + 1}: Width must be a number or percentage (e.g. 300 or 50%).` };
      }

      if (hStr.endsWith('%')) {
        const pct = parseFloat(hStr.slice(0, -1));
        if (isNaN(pct) || pct <= 0 || pct > 100) return { ast: null, error: `Line ${i + 1}: Height percentage must be a number between 0 and 100.` };
        heightPercent = pct;
        height = Math.round(containerHeight * pct / 100); // fallback initial value
      } else {
        height = parseFloat(hStr);
        if (isNaN(height)) return { ast: null, error: `Line ${i + 1}: Height must be a number or percentage (e.g. 200 or 30%).` };
      }

      const elDef: any = { id, width, height };
      if (widthPercent !== undefined) elDef.widthPercent = widthPercent;
      if (heightPercent !== undefined) elDef.heightPercent = heightPercent;
      ast.elements.push(elDef);
    } else if (line.startsWith('CONSTRAINT ')) {
      const parsed = parseConstraintLine(line, i + 1);
      if (parsed.error) return { ast: null, error: parsed.error };
      if (parsed.constraint) ast.constraints.push(parsed.constraint);
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
  const container = ast.elements.find(e => e.id === 'container');
  if (!container) {
    ast.elements.unshift({ id: 'container', width: containerWidth, height: containerHeight });
  } else {
    container.width = containerWidth;
    container.height = containerHeight;
  }

  // Ensure all elements have a color (fallback to default)
  const defaultColor = '#8be9fd';
  for (const el of ast.elements) {
    if (el.id === 'container') continue;
    if (!ast.colors.find(c => c.elementId === el.id)) {
      ast.colors.push({ elementId: el.id, color: defaultColor });
    }
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

/**
 * Parse a single CONSTRAINT line.
 *
 * Supported forms:
 *   CONSTRAINT a.prop == b.prop
 *   CONSTRAINT a.prop == b.prop + 10
 *   CONSTRAINT a.prop == b.prop - 20
 *   CONSTRAINT a.prop == b.prop * 0.5
 *   CONSTRAINT a.prop == b.prop / 2
 *   CONSTRAINT a.prop == b.prop * 0.5 + 10
 *   CONSTRAINT a.prop == b.prop / 2 - 5
 *   CONSTRAINT a.prop == 300
 *   CONSTRAINT a.prop == 300 WEAK
 *   CONSTRAINT a.prop == b.prop STRONG
 *   CONSTRAINT a.prop >= b.prop REQUIRED
 */
function parseConstraintLine(line: string, lineNum: number): { constraint: any | null; error: string | null } {
  let constraintStr = line.substring('CONSTRAINT '.length).trim();

  // Extract optional strength suffix: WEAK, STRONG, REQUIRED
  let strength: 'required' | 'strong' | 'weak' = 'required';
  const strengthMatch = constraintStr.match(/\s+(REQUIRED|STRONG|WEAK)\s*$/i);
  if (strengthMatch) {
    strength = strengthMatch[1].toLowerCase() as 'required' | 'strong' | 'weak';
    constraintStr = constraintStr.substring(0, strengthMatch.index).trim();
  }

  // Pattern 1: element.prop OP element.prop [* factor | / factor] [+/- offset]
  const fullMatch = constraintStr.match(
    /^([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*(==|>=|<=)\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)(?:\s*([*/])\s*([0-9.]+))?(?:\s*([+-])\s*([0-9.]+))?$/
  );

  // Pattern 2: element.prop OP constant
  const constMatch = constraintStr.match(
    /^([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*(==|>=|<=)\s*([0-9.-]+)$/
  );

  if (fullMatch) {
    const [_, leftId, leftProp, operator, rightId, rightProp, mulDivOp, mulDivVal, sign, offsetStr] = fullMatch;
    let multiplier = 1;
    if (mulDivOp && mulDivVal) {
      const val = parseFloat(mulDivVal);
      if (isNaN(val) || val === 0) return { constraint: null, error: `Line ${lineNum}: Invalid multiplier/divisor value.` };
      multiplier = mulDivOp === '*' ? val : 1 / val;
    }
    let offset = 0;
    if (offsetStr) {
      offset = parseFloat(offsetStr);
      if (sign === '-') offset = -offset;
    }
    return {
      constraint: { leftId, leftProp, operator, rightId, rightProp, multiplier, offset, strength },
      error: null
    };
  } else if (constMatch) {
    const [_, leftId, leftProp, operator, rightConstStr] = constMatch;
    const rightConstant = parseFloat(rightConstStr);
    if (isNaN(rightConstant)) return { constraint: null, error: `Line ${lineNum}: Invalid constant in CONSTRAINT.` };
    return {
      constraint: { leftId, leftProp, operator, rightConstant, multiplier: 1, offset: 0, strength },
      error: null
    };
  } else {
    return { constraint: null, error: `Line ${lineNum}: Invalid CONSTRAINT syntax. Supported: a.prop == b.prop [* factor] [+ offset] [WEAK|STRONG|REQUIRED]` };
  }
}
