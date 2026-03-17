import React, { useState, useMemo } from 'react';

interface HelpEntry {
  title: string;
  syntax: string;
  description: string;
  example: string;
}

const HELP_ENTRIES: HelpEntry[] = [
  {
    title: 'CONTAINER',
    syntax: 'CONTAINER width height',
    description: 'Defines dimensions of the main container in pixels. Must be min. 100x100.',
    example: 'CONTAINER 800 600',
  },
  {
    title: 'ELEMENT',
    syntax: 'ELEMENT id width height',
    description: 'Creates a layout element with an ID and dimensions. Dimensions can be in pixels or percentages.',
    example: 'ELEMENT card 300 200\nELEMENT sidebar 25% 100%',
  },
  {
    title: 'CONSTRAINT',
    syntax: 'CONSTRAINT el.prop OP el.prop [* factor] [+/- offset] [STRENGTH]',
    description: 'Defines a constraint (equation) between element variables. Supports ==, >=, <= operators, multiplication (*), division (/), and offset (+/-).',
    example: 'CONSTRAINT card.centerX == container.centerX\nCONSTRAINT card.width == container.width * 0.5\nCONSTRAINT btn.left == card.right + 10\nCONSTRAINT card.width >= 200 WEAK',
  },
  {
    title: 'COLOR',
    syntax: 'COLOR elementId #hexcolor',
    description: 'Sets element color. Color must be in 6-digit hex format.',
    example: 'COLOR card #bd93f9\nCOLOR header #ff79c6',
  },
  {
    title: 'PARENT',
    syntax: 'PARENT childId parentId',
    description: 'Defines hierarchy — child element is inside parent element. Position of child is relative to parent.',
    example: 'PARENT button card\nPARENT icon button',
  },
  {
    title: 'AVOID',
    syntax: 'AVOID id1 id2',
    description: 'Prevents two elements from overlapping. The solver automatically separates overlapping elements.',
    example: 'AVOID card1 card2\nAVOID sidebar content',
  },
];

const OPERATOR_ENTRIES = [
  { op: '==', desc: 'Equality — left side must equal right side' },
  { op: '>=', desc: 'Greater or equal — left side must be greater or equal' },
  { op: '<=', desc: 'Less or equal — left side must be less or equal' },
  { op: '+', desc: 'Addition — adds offset to the right side' },
  { op: '-', desc: 'Subtraction — subtracts offset from the right side' },
  { op: '*', desc: 'Multiplication — multiplies right side by a factor (e.g. * 0.5 for 50%)' },
  { op: '/', desc: 'Division — divides right side (e.g. / 2 for half)' },
];

const STRENGTH_ENTRIES = [
  { strength: 'REQUIRED', desc: 'Required — constraint must be satisfied (default)', color: '#ff5555' },
  { strength: 'STRONG', desc: 'Strong — solver will try to satisfy, but can yield to REQUIRED', color: '#ffb86c' },
  { strength: 'WEAK', desc: 'Weak — solver satisfies only if it does not violate stronger constraints', color: '#50fa7b' },
];

const PROPERTY_ENTRIES = [
  { prop: 'left', desc: 'Left edge of element (X coordinate)' },
  { prop: 'right', desc: 'Right edge of element (left + width)' },
  { prop: 'top', desc: 'Top edge of element (Y coordinate)' },
  { prop: 'bottom', desc: 'Bottom edge of element (top + height)' },
  { prop: 'width', desc: 'Width of element' },
  { prop: 'height', desc: 'Height of element' },
  { prop: 'centerX', desc: 'Horizontal center (left + width/2)' },
  { prop: 'centerY', desc: 'Vertical center (top + height/2)' },
];

const FULL_EXAMPLE = `// Responsive card layout
CONTAINER 800 600

ELEMENT header 100% 60
ELEMENT sidebar 25% 100%
ELEMENT content 75% 100%
ELEMENT card 200 150
ELEMENT button 100 40

COLOR header #bd93f9
COLOR sidebar #44475a
COLOR content #282a36
COLOR card #6272a4
COLOR button #ff79c6

PARENT button card
PARENT card content

CONSTRAINT header.top == container.top
CONSTRAINT header.left == container.left

CONSTRAINT sidebar.top == header.bottom
CONSTRAINT sidebar.left == container.left

CONSTRAINT content.top == header.bottom
CONSTRAINT content.left == sidebar.right

CONSTRAINT card.centerX == content.centerX
CONSTRAINT card.top == content.top + 20

CONSTRAINT button.centerX == card.centerX
CONSTRAINT button.bottom == card.bottom - 10 WEAK

AVOID card sidebar`;

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    right: 0,
    bottom: 0,
    width: '420px',
    background: '#1a1a2e',
    borderLeft: '2px solid #44475a',
    zIndex: 2000,
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '-8px 0 30px rgba(0,0,0,0.6)',
    fontFamily: "'Inter', -apple-system, sans-serif",
    color: '#f8f8f2',
    animation: 'slideInRight 0.25s ease-out',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #44475a',
    background: '#12121f',
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#8be9fd',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#6272a4',
    fontSize: 24,
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
  },
  searchBox: {
    margin: '12px 20px',
    padding: '10px 14px',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid #44475a',
    borderRadius: 6,
    color: '#f8f8f2',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
  },
  content: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '0 20px 20px',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#bd93f9',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    background: 'rgba(0,0,0,0.25)',
    border: '1px solid #44475a',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#50fa7b',
    marginBottom: 4,
  },
  cardSyntax: {
    fontSize: 11,
    fontFamily: "'Fira Code', monospace",
    color: '#f1fa8c',
    background: 'rgba(0,0,0,0.3)',
    padding: '4px 8px',
    borderRadius: 3,
    marginBottom: 6,
    display: 'block',
  },
  cardDesc: {
    fontSize: 12,
    color: '#c0c0d0',
    lineHeight: 1.5,
  },
  cardExample: {
    fontSize: 11,
    fontFamily: "'Fira Code', monospace",
    color: '#8be9fd',
    background: 'rgba(0,0,0,0.3)',
    padding: '6px 8px',
    borderRadius: 3,
    marginTop: 6,
    whiteSpace: 'pre-wrap' as const,
    display: 'block',
  },
  opRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '6px 0',
    fontSize: 12,
  },
  opBadge: {
    fontFamily: "'Fira Code', monospace",
    fontSize: 12,
    fontWeight: 700,
    color: '#ff79c6',
    width: '90px',
    textAlign: 'left' as const,
    flexShrink: 0,
    marginTop: '1px',
  },
  fullExample: {
    fontFamily: "'Fira Code', monospace",
    fontSize: 11,
    color: '#f1fa8c',
    background: 'rgba(0,0,0,0.4)',
    padding: 12,
    borderRadius: 6,
    whiteSpace: 'pre-wrap' as const,
    lineHeight: 1.6,
    border: '1px solid #44475a',
  },
  backdrop: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.3)',
    zIndex: 1999,
  }
};

interface HelpPanelProps {
  onClose: () => void;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({ onClose }) => {
  const [filter, setFilter] = useState('');

  const lowerFilter = filter.toLowerCase();

  const filteredHelp = useMemo(
    () => HELP_ENTRIES.filter(e =>
      e.title.toLowerCase().includes(lowerFilter) ||
      e.description.toLowerCase().includes(lowerFilter) ||
      e.syntax.toLowerCase().includes(lowerFilter) ||
      e.example.toLowerCase().includes(lowerFilter)
    ),
    [lowerFilter]
  );

  const filteredOps = useMemo(
    () => OPERATOR_ENTRIES.filter(e =>
      e.op.includes(lowerFilter) ||
      e.desc.toLowerCase().includes(lowerFilter)
    ),
    [lowerFilter]
  );

  const filteredStrengths = useMemo(
    () => STRENGTH_ENTRIES.filter(e =>
      e.strength.toLowerCase().includes(lowerFilter) ||
      e.desc.toLowerCase().includes(lowerFilter)
    ),
    [lowerFilter]
  );

  const filteredProps = useMemo(
    () => PROPERTY_ENTRIES.filter(e =>
      e.prop.toLowerCase().includes(lowerFilter) ||
      e.desc.toLowerCase().includes(lowerFilter)
    ),
    [lowerFilter]
  );

  const showExample = !filter || 'responsive card layout primjer example'.includes(lowerFilter);

  return (
    <>
      <div style={styles.backdrop} onClick={onClose} />
      <div style={styles.overlay}>
        <div style={styles.header}>
          <span style={styles.title}>Documentation</span>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <input
          style={styles.searchBox}
          type="text"
          placeholder="Search commands, operators, examples..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          autoFocus
        />

        <div style={styles.content}>
          {/* DSL Commands */}
          {filteredHelp.length > 0 && (
            <>
              <div style={styles.sectionTitle}>DSL Commands</div>
              {filteredHelp.map((entry) => (
                <div key={entry.title} style={styles.card}>
                  <div style={styles.cardTitle}>{entry.title}</div>
                  <code style={styles.cardSyntax}>{entry.syntax}</code>
                  <div style={styles.cardDesc}>{entry.description}</div>
                  <code style={styles.cardExample}>{entry.example}</code>
                </div>
              ))}
            </>
          )}

          {/* Properties */}
          {filteredProps.length > 0 && (
            <>
              <div style={styles.sectionTitle}>Variables (Properties)</div>
              <div style={styles.card}>
                {filteredProps.map((p) => (
                  <div key={p.prop} style={styles.opRow}>
                    <span style={styles.opBadge}>{p.prop}</span>
                    <span style={{ color: '#c0c0d0', fontSize: 12 }}>{p.desc}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Operators */}
          {filteredOps.length > 0 && (
            <>
              <div style={styles.sectionTitle}>Operators</div>
              <div style={styles.card}>
                {filteredOps.map((o) => (
                  <div key={o.op} style={styles.opRow}>
                    <span style={styles.opBadge}>{o.op}</span>
                    <span style={{ color: '#c0c0d0', fontSize: 12 }}>{o.desc}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Strengths */}
          {filteredStrengths.length > 0 && (
            <>
              <div style={styles.sectionTitle}>Priorities (Strength)</div>
              <div style={styles.card}>
                {filteredStrengths.map((s) => (
                  <div key={s.strength} style={styles.opRow}>
                    <span style={{ ...styles.opBadge, color: s.color, width: 'auto', marginRight: 4 }}>{s.strength}</span>
                    <span style={{ color: '#c0c0d0', fontSize: 12 }}>{s.desc}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Full example */}
          {showExample && (
            <>
              <div style={styles.sectionTitle}>Full Example</div>
              <pre style={styles.fullExample}>{FULL_EXAMPLE}</pre>
            </>
          )}

          {/* Keyboard shortcuts */}
          {(!filter || 'shortcut prečica undo redo tastatura keyboard ctrl'.includes(lowerFilter)) && (
            <>
              <div style={styles.sectionTitle}>Keyboard Shortcuts</div>
              <div style={styles.card}>
                <div style={styles.opRow}>
                  <span style={{ ...styles.opBadge, width: 'auto', fontFamily: "'Fira Code', monospace" }}>Ctrl+Z</span>
                  <span style={{ color: '#c0c0d0', fontSize: 12 }}>Undo (poništi)</span>
                </div>
                <div style={styles.opRow}>
                  <span style={{ ...styles.opBadge, width: 'auto', fontFamily: "'Fira Code', monospace" }}>Ctrl+Y</span>
                  <span style={{ color: '#c0c0d0', fontSize: 12 }}>Redo (ponovi)</span>
                </div>
                <div style={styles.opRow}>
                  <span style={{ ...styles.opBadge, width: 'auto', fontFamily: "'Fira Code', monospace" }}>Ctrl+Shift+Z</span>
                  <span style={{ color: '#c0c0d0', fontSize: 12 }}>Redo (alternativa)</span>
                </div>
                <div style={styles.opRow}>
                  <span style={{ ...styles.opBadge, width: 'auto', fontFamily: "'Fira Code', monospace" }}>Ctrl+Click</span>
                  <span style={{ color: '#c0c0d0', fontSize: 12 }}>Multi-select elements</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};
