import * as kiwi from 'kiwi.js';
import type { AST } from '../parser/types';

/**
 * LayoutSolver — uses kiwi.js (Cassowary) to solve constraints.
 *
 * Supports:
 *   - Multiplication/division via multiplier field
 *   - Percentage dimensions via widthPercent/heightPercent
 *   - Constraint priorities via strength field (required/strong/weak)
 *   - Parent/child hierarchy with local positioning
 *   - Drag & drop with edit variables
 */
export class LayoutSolver {
  solver: kiwi.Solver;
  variables: Record<string, Record<string, kiwi.Variable>>;
  editVars: Set<string>;
  savedPositions: Record<string, { localLeft: number; localTop: number }>;

  constructor() {
    this.solver = new kiwi.Solver();
    this.variables = {};
    this.editVars = new Set();
    this.savedPositions = {};
  }

  /** Map string strength to kiwi.Strength */
  private mapStrength(s: string): number {
    switch (s) {
      case 'weak': return kiwi.Strength.weak;
      case 'strong': return kiwi.Strength.strong;
      case 'required': return kiwi.Strength.required;
      default: return kiwi.Strength.required;
    }
  }

  update(ast: AST, containerWidth: number, containerHeight: number) {
    // 1. Build hierarchy tree for translation detection
    const tree: Record<string, string> = {};
    ast.hierarchy.forEach(h => tree[h.childId] = h.parentId);

    // 2. Save current local and global positions before re-creating the solver
    // This allows us to detect parent changes and adjust local coords to keep GLOBAL pos stationary.
    const prevPositions: Record<string, { left: number; top: number; localLeft: number; localTop: number; parentId: string }> = {};
    for (const id in this.variables) {
      if (id !== 'container' && this.variables[id].localLeft && this.variables[id].localTop) {
        prevPositions[id] = {
          left: this.variables[id].left.value() || 0,
          top: this.variables[id].top.value() || 0,
          localLeft: this.variables[id].localLeft.value() || 0,
          localTop: this.variables[id].localTop.value() || 0,
          parentId: (this.savedPositions[id] as any)?.parentId || 'container'
        };
      }
    }

    this.solver = new kiwi.Solver();
    this.variables = {};
    this.editVars.clear();

    const newSaved: Record<string, { localLeft: number; localTop: number; parentId: string }> = {};

    // 3. Create all variables first
    for (const el of ast.elements) {
      this.variables[el.id] = {
        left: new kiwi.Variable(`${el.id}.left`),
        right: new kiwi.Variable(`${el.id}.right`),
        top: new kiwi.Variable(`${el.id}.top`),
        bottom: new kiwi.Variable(`${el.id}.bottom`),
        width: new kiwi.Variable(`${el.id}.width`),
        height: new kiwi.Variable(`${el.id}.height`),
        centerX: new kiwi.Variable(`${el.id}.centerX`),
        centerY: new kiwi.Variable(`${el.id}.centerY`)
      };
      
      if (el.id !== 'container') {
        const v = this.variables[el.id];
        v.localLeft = new kiwi.Variable(`${el.id}.localLeft`);
        v.localTop = new kiwi.Variable(`${el.id}.localTop`);
        
        const prev = prevPositions[el.id];
        const newParentId = tree[el.id] || 'container';
        
        if (prev) {
          if (prev.parentId !== newParentId) {
            // Parent changed! Calculate new local coords so element stays at the same GLOBAL position
            const newParentPos = prevPositions[newParentId] || { left: 0, top: 0 };
            newSaved[el.id] = {
              localLeft: prev.left - (newParentPos.left || 0),
              localTop: prev.top - (newParentPos.top || 0),
              parentId: newParentId
            };
          } else {
            newSaved[el.id] = {
              localLeft: prev.localLeft,
              localTop: prev.localTop,
              parentId: newParentId
            };
          }
        } else {
          newSaved[el.id] = { localLeft: 0, localTop: 0, parentId: newParentId };
        }
      }
    }
    this.savedPositions = newSaved as any;

    // 4. Add structural constraints
    for (const el of ast.elements) {
      const v = this.variables[el.id];

      // Static size constraints
      if (el.id === 'container') {
         this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.width), kiwi.Operator.Eq, new kiwi.Expression(containerWidth), kiwi.Strength.required));
         this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.height), kiwi.Operator.Eq, new kiwi.Expression(containerHeight), kiwi.Strength.required));
         this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.left), kiwi.Operator.Eq, new kiwi.Expression(0), kiwi.Strength.required));
         this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.top), kiwi.Operator.Eq, new kiwi.Expression(0), kiwi.Strength.required));
      } else {
        const parentId = tree[el.id] || 'container';
        const pVar = this.variables[parentId];

        if (el.widthPercent !== undefined && pVar) {
          const factor = el.widthPercent / 100;
          this.solver.addConstraint(new kiwi.Constraint(
            new kiwi.Expression(v.width),
            kiwi.Operator.Eq,
            new kiwi.Expression([factor, pVar.width]),
            kiwi.Strength.strong
          ));
        } else {
          this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.width), kiwi.Operator.Eq, new kiwi.Expression(el.width), kiwi.Strength.strong));
        }

        if (el.heightPercent !== undefined && pVar) {
          const factor = el.heightPercent / 100;
          this.solver.addConstraint(new kiwi.Constraint(
            new kiwi.Expression(v.height),
            kiwi.Operator.Eq,
            new kiwi.Expression([factor, pVar.height]),
            kiwi.Strength.strong
          ));
        } else {
          this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.height), kiwi.Operator.Eq, new kiwi.Expression(el.height), kiwi.Strength.strong));
        }
      }

      this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.right), kiwi.Operator.Eq, new kiwi.Expression(v.left, v.width)));
      this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.bottom), kiwi.Operator.Eq, new kiwi.Expression(v.top, v.height)));
      this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression([-1, v.centerX], v.left, [0.5, v.width]), kiwi.Operator.Eq, new kiwi.Expression(0)));
      this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression([-1, v.centerY], v.top, [0.5, v.height]), kiwi.Operator.Eq, new kiwi.Expression(0)));
    }

    // 5. Process Parent/Child hierarchy
    for (const el of ast.elements) {
      if (el.id === 'container') continue;

      const parentId = tree[el.id] || 'container';
      const pVar = this.variables[parentId];
      const v = this.variables[el.id];

      if (!pVar) continue;

      this.solver.addConstraint(new kiwi.Constraint(
        new kiwi.Expression(v.left), kiwi.Operator.Eq, new kiwi.Expression(pVar.left, v.localLeft)
      ));
      this.solver.addConstraint(new kiwi.Constraint(
        new kiwi.Expression(v.top), kiwi.Operator.Eq, new kiwi.Expression(pVar.top, v.localTop)
      ));

      // bounds: localLeft >= 0, localLeft + width <= parent.width
      this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.localLeft), kiwi.Operator.Ge, new kiwi.Expression(0)));
      this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.localTop), kiwi.Operator.Ge, new kiwi.Expression(0)));
      
      this.solver.addConstraint(new kiwi.Constraint(
        new kiwi.Expression(v.localLeft, v.width), kiwi.Operator.Le, new kiwi.Expression(pVar.width)
      ));
      this.solver.addConstraint(new kiwi.Constraint(
        new kiwi.Expression(v.localTop, v.height), kiwi.Operator.Le, new kiwi.Expression(pVar.height)
      ));

      // Edit variables for preserving local position
      this.solver.addEditVariable(v.localLeft, kiwi.Strength.weak);
      this.solver.addEditVariable(v.localTop, kiwi.Strength.weak);

      const saved = (this.savedPositions as any)[el.id];
      if (saved) {
        this.solver.suggestValue(v.localLeft, saved.localLeft || 0);
        this.solver.suggestValue(v.localTop, saved.localTop || 0);
      } else {
        this.solver.suggestValue(v.localLeft, 0);
        this.solver.suggestValue(v.localTop, 0);
      }
    }

    // 6. Apply DSL constraints (with multiplier, offset, and strength support)
    for (const c of ast.constraints) {
      const vLeft = this.variables[c.leftId]?.[c.leftProp];
      if (!vLeft) continue;

      let op = kiwi.Operator.Eq;
      if (c.operator === '>=') op = kiwi.Operator.Ge;
      if (c.operator === '<=') op = kiwi.Operator.Le;

      const constraintStrength = this.mapStrength(c.strength || 'required');
      let rightExpr: kiwi.Expression | null = null;

      if (c.rightConstant !== undefined) {
        rightExpr = new kiwi.Expression(c.rightConstant + c.offset);
      } else if (c.rightId && c.rightProp) {
        const vRight = this.variables[c.rightId]?.[c.rightProp];
        if (!vRight) continue;
        const multiplier = c.multiplier !== undefined ? c.multiplier : 1;
        if (multiplier === 1) {
          rightExpr = new kiwi.Expression(vRight, c.offset);
        } else {
          rightExpr = new kiwi.Expression([multiplier, vRight], c.offset);
        }
      }

      if (!rightExpr) continue;
      this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(vLeft), op, rightExpr, constraintStrength));
    }

    this.solver.updateVariables();
  }

  beginDrag(id: string, lockedIds: string[] = []) {
    if (!this.variables[id]) return;
    try {
      if (!this.editVars.has(id)) {
        // Child's drag uses medium strength so parent's strong lock will absolutely overpower it
        this.solver.addEditVariable(this.variables[id].left, kiwi.Strength.medium);
        this.solver.addEditVariable(this.variables[id].top, kiwi.Strength.medium);
        this.editVars.add(id);

        // Lock parents
        for (const lid of lockedIds) {
          if (this.variables[lid] && !this.editVars.has(lid)) {
             try {
               // Use strong instead of required, as required edit variables throw in Cassowary
               this.solver.addEditVariable(this.variables[lid].left, kiwi.Strength.strong);
               this.solver.addEditVariable(this.variables[lid].top, kiwi.Strength.strong);
               this.solver.suggestValue(this.variables[lid].left, this.variables[lid].left.value());
               this.solver.suggestValue(this.variables[lid].top, this.variables[lid].top.value());
               this.editVars.add(lid);
             } catch(e) { console.error("Could not lock parent", lid, e); }
          }
        }
      }
    } catch(e) { /* ignore */ }
  }

  drag(id: string, x: number, y: number) {
    if (!this.variables[id] || !this.editVars.has(id)) return;
    try {
      this.solver.suggestValue(this.variables[id].left, x);
      this.solver.suggestValue(this.variables[id].top, y);
      this.solver.updateVariables();
    } catch(e) { /* ignore */ }
  }

  endDrag(id: string, lockedIds: string[] = []) {
    if (!this.variables[id] || !this.editVars.has(id)) return;
    try {
       this.solver.removeEditVariable(this.variables[id].left);
       this.solver.removeEditVariable(this.variables[id].top);
       this.editVars.delete(id);

       for (const lid of lockedIds) {
          if (this.variables[lid] && this.editVars.has(lid)) {
             this.solver.removeEditVariable(this.variables[lid].left);
             this.solver.removeEditVariable(this.variables[lid].top);
             this.editVars.delete(lid);
          }
       }

       const ll = this.variables[id].localLeft.value();
       const lt = this.variables[id].localTop.value();
       this.solver.suggestValue(this.variables[id].localLeft, ll);
       this.solver.suggestValue(this.variables[id].localTop, lt);
       this.solver.updateVariables();

       this.savedPositions[id] = { localLeft: ll, localTop: lt } as any;
    } catch(e) { /* ignore */ }
  }

  getPositions(): Record<string, { left: number; top: number; width: number; height: number }> {
    const pos: Record<string, { left: number; top: number; width: number; height: number }> = {};
    for (const id in this.variables) {
      if (id !== 'container') {
        pos[id] = {
          left: this.variables[id].left.value() || 0,
          top: this.variables[id].top.value() || 0,
          width: this.variables[id].width.value() || 0,
          height: this.variables[id].height.value() || 0
        };
      }
    }
    return pos;
  }
}

