import * as kiwi from 'kiwi.js';
import type { AST } from '../parser/types';

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

  update(ast: AST, containerWidth: number, containerHeight: number) {
    // Save current local positions before re-creating the solver
    const oldPositions: Record<string, { localLeft: number; localTop: number }> = {};
    for (const id in this.variables) {
      if (id !== 'container' && this.variables[id].localLeft && this.variables[id].localTop) {
        oldPositions[id] = {
          localLeft: this.variables[id].localLeft.value() || 0,
          localTop: this.variables[id].localTop.value() || 0,
        };
      }
    }
    Object.assign(this.savedPositions, oldPositions);

    this.solver = new kiwi.Solver();
    this.variables = {};
    this.editVars.clear();

    // Build hierarchy tree
    const tree: Record<string, string> = {};
    ast.hierarchy.forEach(h => tree[h.childId] = h.parentId);

    // 1. Create all variables first
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
        this.variables[el.id].localLeft = new kiwi.Variable(`${el.id}.localLeft`);
        this.variables[el.id].localTop = new kiwi.Variable(`${el.id}.localTop`);
      }
    }

    // 2. Add structural constraints
    for (const el of ast.elements) {
      const v = this.variables[el.id];

      // Static size constraints
      if (el.id === 'container') {
         this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.width), kiwi.Operator.Eq, new kiwi.Expression(containerWidth), kiwi.Strength.required));
         this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.height), kiwi.Operator.Eq, new kiwi.Expression(containerHeight), kiwi.Strength.required));
         this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.left), kiwi.Operator.Eq, new kiwi.Expression(0), kiwi.Strength.required));
         this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.top), kiwi.Operator.Eq, new kiwi.Expression(0), kiwi.Strength.required));
      } else {
         this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.width), kiwi.Operator.Eq, new kiwi.Expression(el.width), kiwi.Strength.strong));
         this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.height), kiwi.Operator.Eq, new kiwi.Expression(el.height), kiwi.Strength.strong));
      }

      // Relational constraints
      this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.right), kiwi.Operator.Eq, new kiwi.Expression(v.left, v.width)));
      this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression(v.bottom), kiwi.Operator.Eq, new kiwi.Expression(v.top, v.height)));
      this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression([-1, v.centerX], v.left, [0.5, v.width]), kiwi.Operator.Eq, new kiwi.Expression(0)));
      this.solver.addConstraint(new kiwi.Constraint(new kiwi.Expression([-1, v.centerY], v.top, [0.5, v.height]), kiwi.Operator.Eq, new kiwi.Expression(0)));
    }

    // 3. Process Parent/Child hierarchy
    for (const el of ast.elements) {
      if (el.id === 'container') continue;

      const parentId = tree[el.id] || 'container';
      const pVar = this.variables[parentId];
      const v = this.variables[el.id];

      // left = parent.left + localLeft
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

      // Restore saved local positions or default to 0
      const saved = this.savedPositions[el.id];
      if (saved) {
        this.solver.suggestValue(v.localLeft, saved.localLeft || 0);
        this.solver.suggestValue(v.localTop, saved.localTop || 0);
      } else {
        this.solver.suggestValue(v.localLeft, 0);
        this.solver.suggestValue(v.localTop, 0);
      }
    }

    // 4. Apply DSL constraints
    for (const c of ast.constraints) {
      const vLeft = this.variables[c.leftId]?.[c.leftProp];
      if (!vLeft) continue;

      let op = kiwi.Operator.Eq;
      if (c.operator === '>=') op = kiwi.Operator.Ge;
      if (c.operator === '<=') op = kiwi.Operator.Le;

      const rightExpr = c.rightConstant !== undefined
        ? new kiwi.Expression(c.rightConstant + c.offset)
        : (() => {
            const vRight = this.variables[c.rightId!]?.[c.rightProp!];
            if (!vRight) return null;
            return new kiwi.Expression(vRight, c.offset);
          })();
      if (!rightExpr) continue;

      this.solver.addConstraint(new kiwi.Constraint(
        new kiwi.Expression(vLeft),
        op,
        rightExpr,
        (c as any).isWeak ? kiwi.Strength.weak : kiwi.Strength.strong
      ));
    }

    this.solver.updateVariables();
  }

  beginDrag(id: string) {
    if (!this.variables[id]) return;
    try {
      if (!this.editVars.has(id)) {
        this.solver.addEditVariable(this.variables[id].left, kiwi.Strength.strong);
        this.solver.addEditVariable(this.variables[id].top, kiwi.Strength.strong);
        this.editVars.add(id);
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

  endDrag(id: string) {
    if (!this.variables[id] || !this.editVars.has(id)) return;
    try {
       this.solver.removeEditVariable(this.variables[id].left);
       this.solver.removeEditVariable(this.variables[id].top);
       this.editVars.delete(id);

       // suggest the new achieved local position to the weak local vars
       const ll = this.variables[id].localLeft.value();
       const lt = this.variables[id].localTop.value();
       this.solver.suggestValue(this.variables[id].localLeft, ll);
       this.solver.suggestValue(this.variables[id].localTop, lt);
       this.solver.updateVariables();

       // Save the local position so it survives solver re-creation
       this.savedPositions[id] = { localLeft: ll, localTop: lt };
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
