export interface ElementDef {
  id: string;
  width: number;
  height: number;
}

export interface ConstraintDef {
  leftId: string;
  leftProp: string; // 'centerX', 'left', 'right', 'top', 'bottom', 'width', 'height', 'centerY'
  operator: '==' | '>=' | '<=';
  rightId?: string;
  rightProp?: string;
  rightConstant?: number; // when right side is a number
  offset: number; // e.g. + 10 or - 20
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
