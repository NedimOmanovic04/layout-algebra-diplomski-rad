export interface ElementDef {
  id: string;
  width: number;
  height: number;
  widthPercent?: number;  // e.g. 50 means 50% of parent width
  heightPercent?: number; // e.g. 30 means 30% of parent height
}

export interface ConstraintDef {
  leftId: string;
  leftProp: string; // 'centerX', 'left', 'right', 'top', 'bottom', 'width', 'height', 'centerY'
  operator: '==' | '>=' | '<=';
  rightId?: string;
  rightProp?: string;
  rightConstant?: number; // when right side is a number
  multiplier: number; // default 1, used for * and / (e.g. 0.5 for *0.5 or /2)
  offset: number; // e.g. + 10 or - 20
  strength: 'required' | 'strong' | 'weak'; // constraint priority, default 'required'
}

export interface ColorDef {
  elementId: string;
  color: string; // hex color e.g. #ff0000
}

export interface HierarchyDef {
  childId: string;
  parentId: string;
}

export interface AvoidDef {
  id1: string;
  id2: string;
}

export interface AST {
  elements: ElementDef[];
  constraints: ConstraintDef[];
  colors: ColorDef[];
  hierarchy: HierarchyDef[];
  avoids: AvoidDef[];
}
