import { create } from 'zustand';
import { parseDSL } from '../parser/parser';
import type { AST } from '../parser/types';
import { LayoutSolver } from '../solver/solver';

interface LayoutState {
  code: string;
  ast: AST | null;
  error: string | null;
  positions: Record<string, { left: number; top: number; width: number; height: number }>;
  positionOverrides: Record<string, { left: number; top: number; width: number; height: number }>;
  solver: LayoutSolver;
  elementCounters: Record<string, number>;
  selectedElementIds: string[];
  selectionOrder: string[];
  setCode: (code: string, opts?: { keepPositionOverrides?: boolean }) => void;
  setSelectedElementId: (id: string, multi?: boolean) => void;
  addElement: (type: string, width: number, height: number) => void;
  resizeElement: (id: string, newWidth: number, newHeight: number, newLeft?: number, newTop?: number) => void;
  setPositionsDirect: (positions: Record<string, { left: number; top: number; width: number; height: number }>) => void;
  setPositionOverride: (id: string, rect: { left: number; top: number; width: number; height: number } | null) => void;
  resizeContainer: (width: number, height: number) => void;
  setElementColor: (id: string, color: string) => void;
  setElementParent: (childId: string, parentId: string) => void;
  removeElement: (id: string) => void;
  groups: { leaderId: string; followerId: string; offsetX: number; offsetY: number; gapX: number; gapY: number }[];
  addGroup: (leaderId: string, followerId: string) => void;
  addGroupMultiple: (leaderId: string, followerIds: string[]) => void;
  removeGroup: (leaderId: string, followerId: string) => void;
  updateGroupGap: (leaderId: string, followerId: string, gapX: number, gapY: number) => void;
  handleDragStart: (id: string) => void;
  handleDrag: (id: string, x: number, y: number) => void;
  handleDragStop: (id: string) => void;
}

const defaultCode = `// Layout Algebra - Definition
CONTAINER 800 600
ELEMENT card 300 200
ELEMENT button 120 40
ELEMENT header 800 60
COLOR header #bd93f9
COLOR button #ff79c6
PARENT button card

CONSTRAINT header.top == container.top
CONSTRAINT header.left == container.left
CONSTRAINT card.centerX == container.centerX
CONSTRAINT card.centerY == container.centerY
`;

const solverInstance = new LayoutSolver();

export const useLayoutStore = create<LayoutState>((set, get) => ({
  code: defaultCode,
  ast: null,
  error: null,
  positions: {},
  positionOverrides: {},
  solver: solverInstance,
  elementCounters: {},
  selectedElementIds: [],
  selectionOrder: [],
  groups: [],

  setCode: (code: string, opts?: { keepPositionOverrides?: boolean }) => {
    set({ code });
    // Default to KEEPING overrides unless explicitly told otherwise
    const keepOverrides = opts?.keepPositionOverrides !== false; 
    if (!keepOverrides) {
      set({ positionOverrides: {} });
    }
    const { ast, error } = parseDSL(code);
    if (!error && ast) {
      try {
        const solver = get().solver;
        const container = ast.elements.find(e => e.id === 'container');
        const cw = container?.width ?? 800;
        const ch = container?.height ?? 600;
        solver.update(ast, cw, ch);
        const positions = solver.getPositions();
        
        // Post-solve: apply AVOID collisions if any
        resolveOverlaps(ast, positions);
        
        // Apply position overrides (from manual resize/drag) - override solver result
        const overrides = get().positionOverrides;
        const merged = { ...positions };
        for (const id of Object.keys(overrides)) {
          if (merged[id]) {
            merged[id] = { ...overrides[id] };
          }
        }
        
        set({ ast, error: null, positions: merged });
      } catch (e: any) {
        set({ error: "Constraint Error: " + e.message, ast: null });
      }
    } else {
      set({ error, ast: null });
    }
  },

  addElement: (type: string, width: number, height: number) => {
    const counters = { ...get().elementCounters };
    const count = (counters[type] || 0) + 1;
    counters[type] = count;
    const id = `${type}${count}`;

    const currentCode = get().code.trimEnd();
    const newLine = `ELEMENT ${id} ${width} ${height}`;
    const newCode = currentCode + '\n' + newLine + '\n';

    set({ elementCounters: counters });
    get().setCode(newCode, { keepPositionOverrides: true });
  },

  resizeElement: (id: string, newWidth: number, newHeight: number, newLeft?: number, newTop?: number) => {
    const w = Math.max(20, Math.round(newWidth));
    const h = Math.max(20, Math.round(newHeight));
    const currentCode = get().code;
    const ast = get().ast;

    let left = newLeft;
    let top = newTop;
    if (left === undefined || top === undefined) {
      const pos = get().positions[id];
      if (pos) {
        left = pos.left;
        top = pos.top;
      }
    }

    if (left !== undefined && top !== undefined) {
      const newOverrides = { ...get().positionOverrides, [id]: { left, top, width: w, height: h } };
      const currentPositions = { ...get().positions, [id]: { left, top, width: w, height: h } };
      
      // Sync recursive group offsets
      const visited = new Set<string>();
      const syncGroupRecursively = (currId: string) => {
        if (visited.has(currId)) return;
        visited.add(currId);
        const pos = currentPositions[currId];
        if (pos) newOverrides[currId] = pos;
        
        get().groups.forEach(g => {
          if (g.leaderId === currId || g.followerId === currId) {
            const leader = currentPositions[g.leaderId];
            const follower = currentPositions[g.followerId];
            if (leader && follower) {
              g.offsetX = follower.left - leader.left;
              g.offsetY = follower.top - leader.top;
              g.gapX = follower.left - (leader.left + leader.width);
              g.gapY = follower.top - (leader.top + leader.height);
            }
            syncGroupRecursively(g.leaderId === currId ? g.followerId : g.leaderId);
          }
        });
      };
      syncGroupRecursively(id);

      set({ 
        positionOverrides: newOverrides,
        groups: [...get().groups] // Trigger update
      });

      if (ast) {
        const tree: Record<string, string> = {};
        ast.hierarchy.forEach((h) => (tree[h.childId] = h.parentId));
        const parentId = tree[id] || 'container';
        const parentPos = currentPositions[parentId] || { left: 0, top: 0 };
        const localLeft = left - parentPos.left;
        const localTop = top - parentPos.top;
        get().solver.savedPositions[id] = { localLeft, localTop };
      }
    }

    const regex = new RegExp(`^(ELEMENT\\s+${id}\\s+)\\d+(\\.\\d+)?\\s+\\d+(\\.\\d+)?`, 'm');
    const newCode = currentCode.replace(regex, `ELEMENT ${id} ${w} ${h}`);

    if (newCode !== currentCode) {
      get().setCode(newCode, { keepPositionOverrides: true });
    }
  },

  setPositionsDirect: (nextPositions) => {
    set({ positions: nextPositions });
  },

  setPositionOverride: (id: string, rect) => {
    const next = { ...get().positionOverrides };
    if (rect) next[id] = rect;
    else delete next[id];
    set({ positionOverrides: next });
  },

  setElementColor: (id: string, color: string) => {
    const currentCode = get().code;
    const regex = new RegExp(`^COLOR\\s+${id}\\s+#[0-9a-fA-F]{6}`, 'm');
    let newCode;
    
    if (regex.test(currentCode)) {
      newCode = currentCode.replace(regex, `COLOR ${id} ${color}`);
    } else {
      const elementRegex = new RegExp(`^ELEMENT\\s+${id}\\s+.*$`, 'm');
      const match = currentCode.match(elementRegex);
      if (match && match.index !== undefined) {
        const insertPos = match.index + match[0].length;
        newCode = currentCode.substring(0, insertPos) + `\nCOLOR ${id} ${color}` + currentCode.substring(insertPos);
      } else {
        newCode = currentCode.trimEnd() + `\nCOLOR ${id} ${color}\n`;
      }
    }

    if (newCode !== currentCode) {
      get().setCode(newCode, { keepPositionOverrides: true });
    }
  },

  setElementParent: (childId: string, parentId: string) => {
    const currentCode = get().code;
    const regex = new RegExp(`^PARENT\\s+${childId}\\s+[a-zA-Z0-9_]+`, 'm');
    let newCode;
    
    if (parentId === 'none') {
      newCode = currentCode.replace(regex, '').replace(/\n\n+/g, '\n');
    } else {
      if (regex.test(currentCode)) {
        newCode = currentCode.replace(regex, `PARENT ${childId} ${parentId}`);
      } else {
        const elementRegex = new RegExp(`^ELEMENT\\s+${childId}\\s+.*$`, 'm');
        const match = currentCode.match(elementRegex);
        if (match && match.index !== undefined) {
          const insertPos = match.index + match[0].length;
          newCode = currentCode.substring(0, insertPos) + `\nPARENT ${childId} ${parentId}` + currentCode.substring(insertPos);
        } else {
          newCode = currentCode.trimEnd() + `\nPARENT ${childId} ${parentId}\n`;
        }
      }
    }

    if (newCode !== currentCode) {
      get().setCode(newCode, { keepPositionOverrides: true });
    }
  },

  removeElement: (id: string) => {
    if (id === 'container') return;
    let code = get().code;
    const lines = code.split('\n');
    const newLines: string[] = [];
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith(`ELEMENT ${id} `)) continue;
      if (t.startsWith(`COLOR ${id} `)) continue;
      if (t.startsWith(`PARENT ${id} `) || t.match(new RegExp(`^PARENT\\s+\\S+\\s+${id}$`))) continue;
      if (t.startsWith('CONSTRAINT ')) {
        const body = t.substring(11).trim();
        const elemIds = [...body.matchAll(/([a-zA-Z0-9_]+)\./g)].map(m => m[1]);
        if (elemIds.some(eid => eid === id)) continue;
      }
      if (t.startsWith('AVOID ')) {
        const parts = t.split(/\s+/);
        if (parts[1] === id || parts[2] === id) continue;
      }
      newLines.push(line);
    }
    code = newLines.join('\n').replace(/\n\n\n+/g, '\n\n').trimEnd();
    const { selectedElementIds: sel, selectionOrder: so, groups: grps } = get();
    set({
      selectedElementIds: sel.filter(x => x !== id),
      selectionOrder: so.filter(x => x !== id),
      groups: grps.filter(g => g.leaderId !== id && g.followerId !== id)
    });
    const nextOverrides = { ...get().positionOverrides };
    delete nextOverrides[id];
    set({ positionOverrides: nextOverrides });
    get().setCode(code, { keepPositionOverrides: true });
  },

  setSelectedElementId: (id: string, multi: boolean = false) => {
    if (id) {
      const prevIds = get().selectedElementIds;
      const prevOrder = get().selectionOrder.filter(x => x !== id);
      
      if (multi) {
        const nextIds = prevIds.includes(id) 
          ? prevIds.filter(x => x !== id) 
          : [...prevIds, id];
        set({ selectedElementIds: nextIds, selectionOrder: [...prevOrder, id] });
      } else {
        set({ selectedElementIds: [id], selectionOrder: [...prevOrder, id] });
      }
    } else {
      set({ selectedElementIds: [] });
    }
  },

  resizeContainer: (width: number, height: number) => {
    const w = Math.max(100, Math.round(width));
    const h = Math.max(100, Math.round(height));
    const currentCode = get().code;
    const regex = /^CONTAINER\s+\d+\s+\d+/m;
    let newCode: string;
    if (regex.test(currentCode)) {
      newCode = currentCode.replace(regex, `CONTAINER ${w} ${h}`);
    } else {
      const firstLine = currentCode.split('\n')[0];
      const insert = firstLine.startsWith('//') ? 1 : 0;
      const lines = currentCode.split('\n');
      lines.splice(insert, 0, `CONTAINER ${w} ${h}`);
      newCode = lines.join('\n');
    }
    if (newCode !== currentCode) get().setCode(newCode);
  },

  handleDragStart: (id: string) => {
    const solver = get().solver;
    solver.beginDrag(id);
  },

  addGroup: (leaderId: string, followerId: string) => {
    const positions = get().positions;
    const leader = positions[leaderId];
    const follower = positions[followerId];
    if (!leader || !follower) return;
    const groups = get().groups;
    if (groups.some(g => g.leaderId === leaderId && g.followerId === followerId)) return;
    set({ groups: [...groups, { leaderId, followerId, offsetX: follower.left - leader.left, offsetY: follower.top - leader.top, gapX: follower.left - (leader.left + leader.width), gapY: follower.top - (leader.top + leader.height) }] });
  },

  addGroupMultiple: (leaderId: string, followerIds: string[]) => {
    const positions = get().positions;
    const leader = positions[leaderId];
    if (!leader) return;
    const currentGroups = get().groups;
    const newGroups = [...currentGroups];
    
    followerIds.forEach(fid => {
      if (fid === leaderId) return;
      const follower = positions[fid];
      if (!follower) return;
      if (newGroups.some(g => g.leaderId === leaderId && g.followerId === fid)) return;
      newGroups.push({
        leaderId,
        followerId: fid,
        offsetX: follower.left - leader.left,
        offsetY: follower.top - leader.top,
        gapX: follower.left - (leader.left + leader.width),
        gapY: follower.top - (leader.top + leader.height)
      });
    });
    set({ groups: newGroups });
  },

  removeGroup: (leaderId: string, followerId: string) => {
    set({ groups: get().groups.filter(g => !(g.leaderId === leaderId && g.followerId === followerId)) });
  },

  updateGroupGap: (leaderId: string, followerId: string, gapX: number, gapY: number) => {
    const nextGroups = get().groups.map(g => {
      if (g.leaderId === leaderId && g.followerId === followerId) {
        const positions = get().positions;
        const leader = positions[leaderId];
        if (leader) {
          // Adjust position based on new gap
          // We'll update the offset directly
          return {
            ...g,
            gapX,
            gapY,
            offsetX: leader.width + gapX,
            offsetY: leader.height + gapY
          };
        }
      }
      return g;
    });
    set({ groups: nextGroups });
    // Trigger position update for followers
    get().handleDrag(leaderId, get().positions[leaderId]?.left || 0, get().positions[leaderId]?.top || 0);
  },

  handleDrag: (id: string, x: number, y: number) => {
    const solver = get().solver;
    solver.drag(id, x, y);
    let positions = solver.getPositions();
    const ast = get().ast;
    if (ast) resolveOverlaps(ast, positions);
    positions = { ...positions };

    // Grouping logic (Recursive/Two-sided)
    const updateRecursively = (changedId: string, visited: Set<string>) => {
      if (visited.has(changedId)) return;
      visited.add(changedId);

      const pos = positions[changedId];
      if (!pos) return;

      // Find where changedId is leader
      get().groups.forEach(g => {
        if (g.leaderId === changedId && !visited.has(g.followerId)) {
          const followerPos = positions[g.followerId];
          if (followerPos) {
            positions[g.followerId] = {
              ...followerPos,
              left: pos.left + g.offsetX,
              top: pos.top + g.offsetY
            };
            updateRecursively(g.followerId, visited);
          }
        }
      });

      // Find where changedId is follower (Two-sided)
      get().groups.forEach(g => {
        if (g.followerId === changedId && !visited.has(g.leaderId)) {
          const leaderPos = positions[g.leaderId];
          if (leaderPos) {
            positions[g.leaderId] = {
              ...leaderPos,
              left: pos.left - g.offsetX,
              top: pos.top - g.offsetY
            };
            updateRecursively(g.leaderId, visited);
          }
        }
      });
    };

    updateRecursively(id, new Set<string>());
    set({ positions });
  },

  handleDragStop: (id: string) => {
    const solver = get().solver;
    solver.endDrag(id);
    let positions = get().positions; // Use updated positions from handleDrag
    const overrides = { ...get().positionOverrides };
    
    // Persist all group member positions
    const visited = new Set<string>();
    const markVisited = (currId: string) => {
      if (visited.has(currId)) return;
      visited.add(currId);
      const pos = positions[currId];
      if (pos) overrides[currId] = pos;
      get().groups.forEach(g => {
        if (g.leaderId === currId) markVisited(g.followerId);
        if (g.followerId === currId) markVisited(g.leaderId);
      });
    };
    markVisited(id);

    set({ positionOverrides: overrides });
  }
}));

function resolveOverlaps(
  ast: AST, 
  positions: Record<string, { left: number; top: number; width: number; height: number }>
) {
  if (!ast.avoids || ast.avoids.length === 0) return;

  for (let pass = 0; pass < 3; pass++) {
    for (const rule of ast.avoids) {
      const a = positions[rule.id1];
      const b = positions[rule.id2];
      
      if (!a || !b) continue;

      const overlapX = a.left < b.left + b.width && a.left + a.width > b.left;
      const overlapY = a.top < b.top + b.height && a.top + a.height > b.top;

      if (overlapX && overlapY) {
        const overlapRight = (a.left + a.width) - b.left;
        const overlapLeft = (b.left + b.width) - a.left;
        const overlapBottom = (a.top + a.height) - b.top;
        const overlapTop = (b.top + b.height) - a.top;

        const minOverlap = Math.min(overlapRight, overlapLeft, overlapBottom, overlapTop);
        const pushAmount = minOverlap / 2 + 1;

        if (minOverlap === overlapRight) {
          a.left -= pushAmount;
          b.left += pushAmount;
        } else if (minOverlap === overlapLeft) {
          a.left += pushAmount;
          b.left -= pushAmount;
        } else if (minOverlap === overlapBottom) {
          a.top -= pushAmount;
          b.top += pushAmount;
        } else {
          a.top += pushAmount;
          b.top -= pushAmount;
        }
      }
    }
  }
}

useLayoutStore.getState().setCode(defaultCode);
