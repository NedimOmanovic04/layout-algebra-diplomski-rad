import React, { useState } from 'react';

const PROPERTIES = ['x', 'y', 'width', 'height', 'centerX', 'centerY', 'top', 'bottom', 'left', 'right'] as const;
const OPERATORS = ['==', '>=', '<='] as const;
const STRENGTHS = ['REQUIRED', 'STRONG', 'WEAK'] as const;

export interface ConstraintData {
  id: string;
  left: string;
  op: string;
  right: string;
  hasError?: boolean; // set true when constraint is in conflict
}

interface ConstraintBuilderProps {
  elementNames: string[];
  constraints: ConstraintData[];
  onAdd: (c: ConstraintData) => void;
  onRemove: (id: string) => void;
}

const styles = {
  panel: {
    background: '#12121f',
    color: '#f8f8f2',
    padding: 12,
    fontFamily: "'Fira Code', 'Consolas', monospace",
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    borderTop: '1px solid #44475a',
  },
  header: {
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    color: '#7c6fff',
  },
  row: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  label: {
    color: '#6272a4',
    fontSize: 11,
  },
  select: {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid #44475a',
    color: '#f8f8f2',
    padding: '6px 8px',
    borderRadius: 4,
    fontFamily: 'inherit',
    fontSize: 12,
    outline: 'none',
  },
  input: {
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid #44475a',
    color: '#f8f8f2',
    padding: '6px 8px',
    borderRadius: 4,
    fontFamily: 'inherit',
    fontSize: 12,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  opRow: {
    display: 'flex',
    gap: 6,
  },
  opBtn: {
    flex: 1,
    padding: '6px 10px',
    border: '1px solid #44475a',
    borderRadius: 4,
    background: 'rgba(0,0,0,0.3)',
    color: '#6272a4',
    fontFamily: 'inherit',
    fontSize: 12,
    cursor: 'pointer',
  },
  opBtnActive: {
    background: '#7c6fff',
    color: '#12121f',
    borderColor: '#7c6fff',
  },
  toggleRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  toggleBtn: {
    padding: '4px 10px',
    border: '1px solid #44475a',
    borderRadius: 4,
    background: 'rgba(0,0,0,0.3)',
    color: '#6272a4',
    fontFamily: 'inherit',
    fontSize: 11,
    cursor: 'pointer',
  },
  toggleBtnActive: {
    background: '#7c6fff',
    color: '#12121f',
    borderColor: '#7c6fff',
  },
  preview: {
    padding: 8,
    background: 'rgba(0,0,0,0.4)',
    borderRadius: 4,
    color: '#50fa7b',
    fontSize: 11,
  },
  addBtn: {
    padding: '8px 12px',
    background: '#7c6fff',
    color: '#12121f',
    border: 'none',
    borderRadius: 4,
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 4,
    fontSize: 11,
  },
  itemError: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    background: 'rgba(255,85,85,0.15)',
    border: '1px solid #ff5555',
    borderRadius: 4,
    fontSize: 11,
  },
  itemText: {
    flex: 1,
    color: '#f8f8f2',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#ff5555',
    fontSize: 16,
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  mulDivRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  strengthRow: {
    display: 'flex',
    gap: 4,
  },
  strengthBtn: {
    flex: 1,
    padding: '4px 6px',
    border: '1px solid #44475a',
    borderRadius: 4,
    background: 'rgba(0,0,0,0.3)',
    color: '#6272a4',
    fontFamily: 'inherit',
    fontSize: 10,
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
  },
  strengthBtnActive: {
    background: '#7c6fff',
    color: '#12121f',
    borderColor: '#7c6fff',
  },
};

export const ConstraintBuilder: React.FC<ConstraintBuilderProps> = ({
  elementNames,
  constraints,
  onAdd,
  onRemove,
}) => {
  const [leftElement, setLeftElement] = useState('');
  const [leftProp, setLeftProp] = useState<string>('centerX');
  const [op, setOp] = useState<string>('==');
  const [rightMode, setRightMode] = useState<'element' | 'constant'>('element');
  const [rightElement, setRightElement] = useState('');
  const [rightProp, setRightProp] = useState<string>('centerX');
  const [rightOffset, setRightOffset] = useState('');
  const [rightConstant, setRightConstant] = useState('0');
  const [mulDivOp, setMulDivOp] = useState<'' | '*' | '/'>('');
  const [mulDivValue, setMulDivValue] = useState('');
  const [strength, setStrength] = useState<string>('REQUIRED');

  const elements = ['container', ...elementNames.filter((n) => n !== 'container')];

  const leftExpr = leftElement && leftProp ? `${leftElement}.${leftProp}` : '';
  let rightExpr = '';
  if (rightMode === 'element') {
    rightExpr = rightElement && rightProp ? `${rightElement}.${rightProp}` : '';
    // Add multiplier/divisor
    if (rightExpr && mulDivOp && mulDivValue.trim()) {
      const val = parseFloat(mulDivValue.trim());
      if (!isNaN(val) && val !== 0) {
        rightExpr += ` ${mulDivOp} ${val}`;
      }
    }
    // Add offset
    if (rightExpr && rightOffset.trim()) {
      const off = rightOffset.trim();
      const num = parseFloat(off);
      if (!isNaN(num)) {
        rightExpr += num >= 0 ? ` + ${num}` : ` - ${Math.abs(num)}`;
      }
    }
  } else {
    rightExpr = rightConstant;
  }

  // Add strength suffix if not REQUIRED
  const strengthSuffix = strength !== 'REQUIRED' ? ` ${strength}` : '';
  const previewText = leftExpr && op && rightExpr
    ? `CONSTRAINT ${leftExpr} ${op} ${rightExpr}${strengthSuffix}`
    : '';

  const constraintStr = leftExpr && op && rightExpr ? `${leftExpr} ${op} ${rightExpr}${strengthSuffix}` : '';
  const isDuplicate = Boolean(constraintStr && constraints.some(c => `${c.left} ${c.op} ${c.right}` === `${leftExpr} ${op} ${rightExpr}`));
  const canAdd = Boolean(constraintStr && !isDuplicate);

  const handleAdd = () => {
    if (!canAdd) return;
    let right = '';
    if (rightMode === 'element') {
      right = rightElement && rightProp ? `${rightElement}.${rightProp}` : '';
      if (right && mulDivOp && mulDivValue.trim()) {
        const val = parseFloat(mulDivValue.trim());
        if (!isNaN(val) && val !== 0) {
          right += ` ${mulDivOp} ${val}`;
        }
      }
      if (right && rightOffset.trim()) {
        const off = rightOffset.trim();
        const num = parseFloat(off);
        if (!isNaN(num)) {
          right += num >= 0 ? ` + ${num}` : ` - ${Math.abs(num)}`;
        }
      }
    } else {
      right = String(Number(rightConstant));
    }
    if (!right) return;
    // Append strength suffix to right side for the DSL line
    const finalRight = strength !== 'REQUIRED' ? `${right} ${strength}` : right;
    onAdd({
      id: crypto.randomUUID(),
      left: leftExpr,
      op,
      right: finalRight,
    });
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>Constraint Builder</div>

      <div style={styles.row}>
        <div style={styles.label}>Left element</div>
        <select
          style={styles.select}
          value={leftElement}
          onChange={(e) => setLeftElement(e.target.value)}
        >
          <option value="">Select...</option>
          {elements.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      <div style={styles.row}>
        <div style={styles.label}>Left property</div>
        <select
          style={styles.select}
          value={leftProp}
          onChange={(e) => setLeftProp(e.target.value)}
        >
          {PROPERTIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      <div style={styles.row}>
        <div style={styles.label}>Operator</div>
        <div style={styles.opRow}>
          {OPERATORS.map((o) => (
            <button
              key={o}
              type="button"
              style={{ ...styles.opBtn, ...(op === o ? styles.opBtnActive : {}) }}
              onClick={() => setOp(o)}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.row}>
        <div style={styles.label}>Right side</div>
        <div style={styles.toggleRow}>
          <button
            type="button"
            style={{ ...styles.toggleBtn, ...(rightMode === 'element' ? styles.toggleBtnActive : {}) }}
            onClick={() => setRightMode('element')}
          >
            Element
          </button>
          <button
            type="button"
            style={{ ...styles.toggleBtn, ...(rightMode === 'constant' ? styles.toggleBtnActive : {}) }}
            onClick={() => setRightMode('constant')}
          >
            Constant
          </button>
        </div>
      </div>

      {rightMode === 'element' ? (
        <>
          <div style={styles.row}>
            <div style={styles.label}>Right element</div>
            <select
              style={styles.select}
              value={rightElement}
              onChange={(e) => setRightElement(e.target.value)}
            >
              <option value="">Select...</option>
              {elements.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div style={styles.row}>
            <div style={styles.label}>Right property</div>
            <select
              style={styles.select}
              value={rightProp}
              onChange={(e) => setRightProp(e.target.value)}
            >
              {PROPERTIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          {/* Multiplier / Divisor */}
          <div style={styles.row}>
            <div style={styles.label}>Multiply / Divide (optional)</div>
            <div style={styles.mulDivRow}>
              <select
                style={{ ...styles.select, width: '60px' }}
                value={mulDivOp}
                onChange={(e) => setMulDivOp(e.target.value as '' | '*' | '/')}
              >
                <option value="">None</option>
                <option value="*">×</option>
                <option value="/">/</option>
              </select>
              {mulDivOp && (
                <input
                  style={{ ...styles.input, width: '80px' }}
                  type="text"
                  placeholder="0.5"
                  value={mulDivValue}
                  onChange={(e) => setMulDivValue(e.target.value)}
                />
              )}
            </div>
          </div>
          <div style={styles.row}>
            <div style={styles.label}>Offset (e.g. +20)</div>
            <input
              style={styles.input}
              type="text"
              placeholder="+20 or -10"
              value={rightOffset}
              onChange={(e) => setRightOffset(e.target.value)}
            />
          </div>
        </>
      ) : (
        <div style={styles.row}>
          <div style={styles.label}>Constant value</div>
          <input
            style={styles.input}
            type="number"
            value={rightConstant}
            onChange={(e) => setRightConstant(e.target.value)}
          />
        </div>
      )}

      {/* Strength selector */}
      <div style={styles.row}>
        <div style={styles.label}>Priority</div>
        <div style={styles.strengthRow}>
          {STRENGTHS.map((s) => (
            <button
              key={s}
              type="button"
              style={{ ...styles.strengthBtn, ...(strength === s ? styles.strengthBtnActive : {}) }}
              onClick={() => setStrength(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {previewText && (
        <div style={styles.preview}>{previewText}</div>
      )}

      <button
        style={styles.addBtn}
        onClick={handleAdd}
        disabled={!canAdd}
        title={isDuplicate ? 'Constraint već postoji' : ''}
      >
        Dodaj Constraint
      </button>

      <div style={styles.row}>
        <div style={styles.label}>Aktivni constraints</div>
        <div style={styles.list}>
          {constraints.length === 0 ? (
            <div style={{ color: '#6272a4', fontSize: 11 }}>Nema constraints-a</div>
          ) : (
            constraints.map((c) => (
              <div key={c.id} style={c.hasError ? styles.itemError : styles.item}>
                {c.hasError && <span title="Constraint je u konfliktu" style={{ color: '#ff5555', marginRight: 4 }}>⚠️</span>}
                <span style={styles.itemText}>{c.left} {c.op} {c.right}</span>
                <button
                  type="button"
                  style={styles.removeBtn}
                  onClick={() => onRemove(c.id)}
                  title="Obriši"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
