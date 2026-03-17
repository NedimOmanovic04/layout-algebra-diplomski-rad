import React, { useState, useEffect, useRef } from 'react';

interface ResizablePanelProps {
  id: string;
  title?: string;
  defaultSize: number;
  minSize: number;
  maxSize: number;
  direction: 'left' | 'right' | 'top' | 'bottom';
  children: React.ReactNode;
  className?: string;
  hideHeader?: boolean;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  id,
  title,
  defaultSize,
  minSize,
  maxSize,
  direction,
  children,
  className = '',
  hideHeader = false
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [size, setSize] = useState(defaultSize);
  const isDragging = useRef(false);
  const isVertical = direction === 'top' || direction === 'bottom';

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`panel_${id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.size) setSize(parsed.size);
        if (parsed.isCollapsed !== undefined) setIsCollapsed(parsed.isCollapsed);
      } catch (e) {
        // ignore
      }
    }
  }, [id]);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(`panel_${id}`, JSON.stringify({ size, isCollapsed }));
  }, [size, isCollapsed, id]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = isVertical ? 'row-resize' : 'col-resize';
    
    const startCoord = isVertical ? e.clientY : e.clientX;
    const startSize = size;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      
      const currentCoord = isVertical ? moveEvent.clientY : moveEvent.clientX;
      const d = currentCoord - startCoord;
      let newSize = startSize;
      
      if (direction === 'right' || direction === 'bottom') {
        newSize = startSize + d;
      } else {
        newSize = startSize - d;
      }
      
      newSize = Math.max(minSize, Math.min(maxSize, newSize));
      setSize(newSize);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  const style: React.CSSProperties = isVertical 
    ? { height: isCollapsed ? 40 : size, borderTop: direction === 'bottom' ? '1px solid var(--border-color)' : 'none', borderBottom: direction === 'top' ? '1px solid var(--border-color)' : 'none' }
    : { width: isCollapsed ? 40 : size, borderRight: direction === 'right' ? '1px solid var(--border-color)' : 'none', borderLeft: direction === 'left' ? '1px solid var(--border-color)' : 'none' };

  if (isCollapsed) {
    return (
      <div className={`resizable-panel collapsed ${className}`} style={style}>
        <div className={isVertical ? "collapsed-header-horizontal" : "collapsed-header"}>
           <button className="collapse-toggle-btn" onClick={toggleCollapse} title="Show panel">
             {direction === 'right' ? '▶' : (direction === 'left' ? '◀' : (direction === 'bottom' ? '▲' : '▼')) }
           </button>
           {title && <div className={isVertical ? "collapsed-title-horizontal" : "collapsed-title"}>{title}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={`resizable-panel expanded ${className}`} style={style}>
      {!hideHeader && (
        <div className="panel-header-row">
          {title && <span className="panel-title-text">{title}</span>}
          <button className="collapse-toggle-btn" onClick={toggleCollapse} title="Hide panel">
            {direction === 'right' ? '◀' : (direction === 'left' ? '▶' : (direction === 'bottom' ? '▼' : '▲'))}
          </button>
        </div>
      )}
      <div className="panel-content-area">
        {children}
      </div>
      {/* Resizer Handle */}
      <div 
        className={`resizer-handle ${direction}`}
        onMouseDown={onMouseDown}
      />
    </div>
  );
};

