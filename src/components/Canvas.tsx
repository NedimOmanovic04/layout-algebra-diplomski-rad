import { useRef } from 'react';
import { useLayoutStore } from '../store/layoutStore';

export const Canvas: React.FC = () => {
  const { ast, error, positions, selectionOrder, selectedElementIds, handleDragStart, handleDrag, handleDragStop, setSelectedElementId, setPositionsDirect, resizeElement, addElement } = useLayoutStore();
  const wrapperRef = useRef<HTMLDivElement>(null);

  const activeDragId = useRef<string | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0, left: 0, top: 0 });
  const didMove = useRef(false);

  if (error) return <div className="canvas-wrapper error">{error}</div>;
  if (!ast || !positions || Object.keys(positions).length === 0) {
    return (
      <div className="canvas-wrapper empty">
        <div className="empty-message">Invalid DSL or Solver Conflict</div>
      </div>
    );
  }

  const container = ast.elements.find(e => e.id === 'container');
  const cw = container?.width ?? 800;
  const ch = container?.height ?? 600;
  const parentMap = new Map<string, string>();
  ast.hierarchy.forEach(h => parentMap.set(h.childId, h.parentId));

  // ─── Task 1: Strict child-within-parent clamping ──────────────────
  // Gets the ACTUAL current parent position (may be overridden/solver'd)
  const getParentBounds = (id: string) => {
    const parentId = parentMap.get(id) || 'container';
    const parentPos = positions[parentId] || { left: 0, top: 0, width: cw, height: ch };
    return {
      parentId,
      pLeft: parentPos.left,
      pTop: parentPos.top,
      pRight: parentPos.left + parentPos.width,
      pBottom: parentPos.top + parentPos.height,
      pWidth: parentPos.width,
      pHeight: parentPos.height,
    };
  };

  // Clamp position: child stays within parent bounds
  const clampPosition = (id: string, left: number, top: number, width: number, height: number) => {
    const { pLeft, pTop, pRight, pBottom } = getParentBounds(id);
    const nLeft = Math.max(pLeft, Math.min(left, pRight - width));
    const nTop = Math.max(pTop, Math.min(top, pBottom - height));
    return { left: nLeft, top: nTop, width, height };
  };

  // Clamp resize: child can't extend beyond parent bounds
  const clampResize = (id: string, left: number, top: number, width: number, height: number) => {
    const { pLeft, pTop, pRight, pBottom } = getParentBounds(id);
    // Clamp left/top to not go before parent origin
    let nLeft = Math.max(pLeft, left);
    let nTop = Math.max(pTop, top);
    // Clamp width/height to not go beyond parent right/bottom
    let nW = Math.min(width, pRight - nLeft);
    let nH = Math.min(height, pBottom - nTop);
    // Enforce minimum size
    nW = Math.max(20, nW);
    nH = Math.max(20, nH);
    return { left: nLeft, top: nTop, width: nW, height: nH };
  };

  // ─── Task 2: Z-index layering logic ───────────────────────────────
  // Depth = how deep in hierarchy (container=0, direct child=1, grandchild=2...)
  const getDepth = (id: string): number => {
    let d = 0, curr = id;
    while (parentMap.has(curr)) { d++; curr = parentMap.get(curr)!; if (d > 50) break; }
    return d;
  };

  // Get selection boost: for an element's z-index, we want it to carry the
  // selection boost of its most-recently-selected ancestor (or itself).
  // This ensures: when parent B is selected and dragged over element A,
  // B goes above A AND child C of B also goes above A (because C inherits B's boost).
  const getSelectionBoost = (id: string): number => {
    // Get the max selection order index from this element and all its ancestors
    let maxBoost = selectionOrder.indexOf(id);
    let curr = id;
    while (parentMap.has(curr)) {
      curr = parentMap.get(curr)!;
      const idx = selectionOrder.indexOf(curr);
      if (idx > maxBoost) maxBoost = idx;
    }
    return maxBoost >= 0 ? (maxBoost + 1) : 0;
  };

  // Z-index formula:
  //   selectionBoost * 100  → groups element families by selection order
  //   + depth * 10          → child always above parent within same family
  //   + 1                   → base offset
  const computeZIndex = (id: string): number => {
    const depth = getDepth(id);
    const boost = getSelectionBoost(id);
    return boost * 100 + depth * 10 + 1;
  };

  // ──────────────────────────────────────────────────────────────────

  const onElementMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedElementId(id);
    activeDragId.current = id;
    const pos = positions[id];
    if (!pos) return;

    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      left: pos.left,
      top: pos.top
    };

    handleDragStart(id);

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (!activeDragId.current) return;
      const dx = moveEvt.clientX - dragStartPos.current.x;
      const dy = moveEvt.clientY - dragStartPos.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didMove.current = true;
      const newLeft = dragStartPos.current.left + dx;
      const newTop = dragStartPos.current.top + dy;
      const { positions: posNow } = useLayoutStore.getState();
      const p = posNow[id];
      if (!p) return;
      // Task 1: Clamp within parent bounds during drag
      const clamped = clampPosition(id, newLeft, newTop, p.width, p.height);
      handleDrag(id, clamped.left, clamped.top);
    };

    const onMouseUp = () => {
      if (activeDragId.current) {
        didMove.current = false;
        handleDragStop(activeDragId.current);
        activeDragId.current = null;
      }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onHandleMouseDown = (e: React.MouseEvent, id: string, dir: string) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const pos = positions[id];
    if (!pos) return;

    const startW = pos.width;
    const startH = pos.height;
    const startL = pos.left;
    const startT = pos.top;

    const onMouseMove = (moveEvt: MouseEvent) => {
      const dx = moveEvt.clientX - startX;
      const dy = moveEvt.clientY - startY;

      let nw = startW, nh = startH, nl = startL, nt = startT;

      if (dir.includes('e')) nw = Math.max(20, startW + dx);
      if (dir.includes('s')) nh = Math.max(20, startH + dy);
      if (dir.includes('w')) { nw = Math.max(20, startW - dx); nl = startL + (startW - nw); }
      if (dir.includes('n')) { nh = Math.max(20, startH - dy); nt = startT + (startH - nh); }

      // Task 1: Clamp resize within parent bounds
      const clamped = clampResize(id, nl, nt, nw, nh);
      const currentPositions = useLayoutStore.getState().positions;
      const nextPositions = { ...currentPositions, [id]: clamped };
      setPositionsDirect(nextPositions);
    };

    const onMouseUp = () => {
      const posNow = useLayoutStore.getState().positions[id];
      if (posNow) {
        resizeElement(id, posNow.width, posNow.height, posNow.left, posNow.top);
      }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const elementsToRender = [...ast.elements]
    .filter(e => e.id !== 'container')
    .sort((a, b) => getDepth(a.id) - getDepth(b.id));

  const colorMap: Record<string, string> = {};
  ast.colors.forEach(c => colorMap[c.elementId] = c.color);

  const getContrastColor = (hexcolor: string) => {
    if (!hexcolor) return '#ffffff';
    const r = parseInt(hexcolor.slice(1, 3), 16);
    const g = parseInt(hexcolor.slice(3, 5), 16);
    const b = parseInt(hexcolor.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    let type = '';
    let width = 100;
    let height = 100;

    try {
      const jsonStr = e.dataTransfer.getData('application/json');
      if (jsonStr) {
        const data = JSON.parse(jsonStr);
        type = data.type;
        width = data.width;
        height = data.height;
      } else {
        // Fallback to individual strings (lowercased by some browsers)
        type = e.dataTransfer.getData('componenttype') || e.dataTransfer.getData('componentType');
        width = parseInt(e.dataTransfer.getData('width')) || 100;
        height = parseInt(e.dataTransfer.getData('height')) || 100;
      }
    } catch (err) {
      console.error('Drop failed', err);
    }

    if (!type) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dropX = Math.round(x - width / 2);
    const dropY = Math.round(y - height / 2);

    addElement(type, width, height, dropX, dropY);
  };

  return (
    <div className="canvas-wrapper canvas-wrapper-scroll" ref={wrapperRef} onClick={(e) => { if (!(e.target as Element).closest('.canvas-element')) setSelectedElementId(''); }}>
      <div
        className="canvas-container"
        style={{ width: cw, height: ch }}
        data-container-size={`${cw}x${ch}`}
        onDragOver={(e) => {
          // Check for either the JSON type or our legacy custom types (handles lowercasing)
          const isComponent = e.dataTransfer.types.some(t =>
            t.toLowerCase() === 'application/json' ||
            t.toLowerCase() === 'componenttype'
          );

          if (isComponent) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }
        }}
        onDrop={onDrop}
      >
        {elementsToRender.map(el => {
          const pos = positions[el.id];
          if (!pos) return null;
          const bgColor = colorMap[el.id] || 'var(--element-bg)';
          const isSelected = selectedElementIds.includes(el.id);
          // Task 2: Proper z-index with recursive parent-child hierarchy
          const zIndex = computeZIndex(el.id);

          return (
            <div
              key={el.id}
              className={`canvas-element ${isSelected ? 'selected' : ''}`}
              data-element-id={el.id}
              style={{
                left: pos.left, top: pos.top, width: pos.width, height: pos.height,
                backgroundColor: bgColor,
                color: getContrastColor(bgColor),
                zIndex,
                boxShadow: isSelected ? '0 0 0 2px #ff79c6' : 'none',
              }}
              onMouseDown={(e) => {
                const isMulti = e.ctrlKey || e.metaKey;
                setSelectedElementId(el.id, isMulti);
                onElementMouseDown(e, el.id);
              }}
            >
              <span className="element-label">{el.id}</span>

              <div className="resize-handle resize-handle-nw" onMouseDown={(e) => onHandleMouseDown(e, el.id, 'nw')} />
              <div className="resize-handle resize-handle-ne" onMouseDown={(e) => onHandleMouseDown(e, el.id, 'ne')} />
              <div className="resize-handle resize-handle-sw" onMouseDown={(e) => onHandleMouseDown(e, el.id, 'sw')} />
              <div className="resize-handle resize-handle-se" onMouseDown={(e) => onHandleMouseDown(e, el.id, 'se')} />
              <div className="resize-handle resize-handle-n" onMouseDown={(e) => onHandleMouseDown(e, el.id, 'n')} />
              <div className="resize-handle resize-handle-s" onMouseDown={(e) => onHandleMouseDown(e, el.id, 's')} />
              <div className="resize-handle resize-handle-e" onMouseDown={(e) => onHandleMouseDown(e, el.id, 'e')} />
              <div className="resize-handle resize-handle-w" onMouseDown={(e) => onHandleMouseDown(e, el.id, 'w')} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
