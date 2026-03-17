import { useState } from 'react';
import { useLayoutStore } from '../store/layoutStore';

export const ElementListPanel: React.FC = () => {
  const { ast, setElementColor, setElementParent, resizeElement, resizeContainer, removeElement, addGroup, addGroupMultiple, removeGroup, updateGroupGap, groups, selectedElementIds, setSelectedElementId } = useLayoutStore();
  const [groupLeader, setGroupLeader] = useState<string>('');
  const [colorInput, setColorInput] = useState<string>('#bd93f9');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  if (!ast) return null;

  const container = ast.elements.find(e => e.id === 'container');
  const hierarchyMap = Object.fromEntries(ast.hierarchy.map(h => [h.childId, h.parentId]));
  const elements = ast.elements.filter(e => e.id !== 'container');
  const colorMap = Object.fromEntries(ast.colors.map(c => [c.elementId, c.color]));

  const getChildren = (parentId: string) => elements.filter(e => hierarchyMap[e.id] === parentId);
  const roots = elements.filter(e => !hierarchyMap[e.id] || hierarchyMap[e.id] === 'container');

  const toggleCollapse = (id: string) => {
    const next = new Set(collapsedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsedIds(next);
  };


  const renderElement = (el: typeof elements[0]) => {
    const children = getChildren(el.id);
    const isDropTarget = dragOverId === el.id;
    const isSelected = selectedElementIds.includes(el.id);
    const groupingStatus = groups.find(g => g.followerId === el.id) ? `[Slave]` : (groups.find(g => g.leaderId === el.id) ? `[Leader]` : '');
    const isCollapsed = collapsedIds.has(el.id);

    return (
      <div key={el.id} className="tree-node">
        <div
          className={`element-list-item ${isSelected ? 'selected' : ''}`}
          onClick={(e) => { e.stopPropagation(); setSelectedElementId(el.id, e.ctrlKey || e.metaKey); }}
          draggable
          onDragStart={(e) => { e.dataTransfer.setData('elementId', el.id); e.dataTransfer.effectAllowed = 'move'; }}
        >
          <div
            className={`element-item-header ${isDropTarget ? 'drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId(el.id); }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverId(null);
              const childId = e.dataTransfer.getData('elementId');
              if (childId && childId !== el.id) {
                const pm = Object.fromEntries(ast.hierarchy.map(h => [h.childId, h.parentId]));
                let curr: string | undefined = el.id;
                let wouldCycle = false;
                while (curr) { if (curr === childId) { wouldCycle = true; break; } curr = pm[curr]; }
                if (!wouldCycle) setElementParent(childId, el.id);
              }
            }}
          >
            {children.length > 0 && (
              <button className="collapse-toggle" onClick={(e) => { e.stopPropagation(); toggleCollapse(el.id); }}>
                {isCollapsed ? '▶' : '▼'}
              </button>
            )}
            <div className="element-color-swatch" style={{ backgroundColor: colorMap[el.id] || 'var(--element-bg)' }} />
            <span className="element-id-text">
              {el.id} {groupingStatus && <span style={{ fontSize: '0.7em', color: 'var(--accent)', marginLeft: '8px' }}>{groupingStatus}</span>}
            </span>
            <button
              type="button"
              className="element-delete-btn"
              onClick={(ev) => { ev.stopPropagation(); removeElement(el.id); }}
              title="Delete element"
            >
              ×
            </button>
          </div>
          <div className="element-properties">
            <div className="property-row">
              <label>W:</label>
              <input type="number" className="size-input" value={el.width} onChange={ev => { ev.stopPropagation(); resizeElement(el.id, parseInt(ev.target.value) || el.width, el.height); }} />
              <label>H:</label>
              <input type="number" className="size-input" value={el.height} onChange={ev => { ev.stopPropagation(); resizeElement(el.id, el.width, parseInt(ev.target.value) || el.height); }} />
            </div>
            {hierarchyMap[el.id] && hierarchyMap[el.id] !== 'container' && (
              <button
                className="free-children-btn"
                onClick={(e) => { e.stopPropagation(); setElementParent(el.id, 'container'); }}
              >
                Free from Parent
              </button>
            )}
          </div>
        </div>
        {!isCollapsed && children.length > 0 && (
          <div className="tree-children">
            {children.map(c => renderElement(c))}
          </div>
        )}
      </div>
    );
  };

  const applyColor = () => {
    if (selectedElementIds.length > 0 && /^#[0-9a-fA-F]{6}$/i.test(colorInput)) {
      selectedElementIds.forEach(id => setElementColor(id, colorInput));
    }
  };

  return (
    <div className="element-list-panel">

      <div className="container-size-section">
        <div className="panel-subheader">Container</div>
        <div className="property-row">
          <label>W:</label>
          <input type="number" className="size-input" value={container?.width ?? 800} onChange={e => resizeContainer(parseInt(e.target.value) || 800, container?.height ?? 600)} />
          <label>H:</label>
          <input type="number" className="size-input" value={container?.height ?? 600} onChange={e => resizeContainer(container?.width ?? 800, parseInt(e.target.value) || 600)} />
        </div>
      </div>

      <div className="element-list-items">
        {roots.map(el => renderElement(el))}
      </div>

      <div className="group-section">
        <div className="panel-subheader">Grouping</div>
        <div className="builder-row">
          <label>Leader:</label>
          <select className="builder-select" value={groupLeader} onChange={e => setGroupLeader(e.target.value)}>
            <option value="">...</option>
            {elements.map(e => <option key={e.id} value={e.id}>{e.id}</option>)}
          </select>
        </div>
        <button
          className="add-rule-btn"
          onClick={() => {
            if (groupLeader && selectedElementIds.length > 0) {
              if (selectedElementIds.length === 1) {
                if (groupLeader !== selectedElementIds[0]) addGroup(groupLeader, selectedElementIds[0]);
              } else {
                addGroupMultiple(groupLeader, selectedElementIds);
              }
            }
          }}
          disabled={!groupLeader || selectedElementIds.length === 0 || (selectedElementIds.length === 1 && selectedElementIds[0] === groupLeader)}
        >
          {selectedElementIds.length > 1 ? `Group ${selectedElementIds.length} selected` : 'Group with selected'}
        </button>
        {groups.length > 0 && (
          <div className="group-list">
            {groups.map((g, i) => (
              <div key={i} className="group-item" style={{ fontSize: '0.85em', padding: '4px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{g.leaderId} → {g.followerId}</span>
                  <button type="button" className="element-delete-btn" onClick={() => removeGroup(g.leaderId, g.followerId)}>×</button>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label>Gap X:</label>
                  <input
                    type="number"
                    style={{ width: '40px', background: 'var(--panel-bg)', color: 'white', border: '1px solid var(--border-color)' }}
                    value={g.gapX}
                    onChange={e => updateGroupGap(g.leaderId, g.followerId, parseInt(e.target.value) || 0, g.gapY)}
                  />
                  <label>Gap Y:</label>
                  <input
                    type="number"
                    style={{ width: '40px', background: 'var(--panel-bg)', color: 'white', border: '1px solid var(--border-color)' }}
                    value={g.gapY}
                    onChange={e => updateGroupGap(g.leaderId, g.followerId, g.gapX, parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="color-picker-section">
        <div className="panel-subheader">Color</div>
        <input type="color" className="color-wheel" value={colorInput} onChange={e => { e.stopPropagation(); setColorInput(e.target.value); }} />
        <button className="apply-color-btn" onClick={applyColor} disabled={selectedElementIds.length === 0}>Apply</button>
      </div>
    </div>
  );
};
