import React, { useState, useEffect, useRef } from 'react';

interface ResizablePanelProps {
  id: string;
  title?: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  direction: 'left' | 'right';
  children: React.ReactNode;
  className?: string;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  id,
  title,
  defaultWidth,
  minWidth,
  maxWidth,
  direction,
  children,
  className = ''
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [width, setWidth] = useState(defaultWidth);
  const isDragging = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`panel_${id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.width) setWidth(parsed.width);
        if (parsed.isCollapsed !== undefined) setIsCollapsed(parsed.isCollapsed);
      } catch (e) {
        // ignore
      }
    }
  }, [id]);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(`panel_${id}`, JSON.stringify({ width, isCollapsed }));
  }, [width, isCollapsed, id]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    
    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      
      const dx = moveEvent.clientX - startX;
      let newWidth = startWidth;
      
      if (direction === 'right') {
        newWidth = startWidth + dx;
      } else {
        newWidth = startWidth - dx;
      }
      
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(newWidth);
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

  if (isCollapsed) {
    return (
      <div className={`resizable-panel collapsed ${className}`} style={{ width: 40, borderRight: direction === 'right' ? '1px solid var(--border-color)' : 'none', borderLeft: direction === 'left' ? '1px solid var(--border-color)' : 'none' }}>
        <div className="collapsed-header">
           <button className="collapse-toggle-btn" onClick={toggleCollapse} title="Prikaži panel">
             {direction === 'right' ? '▶' : '◀'}
           </button>
           {title && <div className="collapsed-title">{title}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={`resizable-panel expanded ${className}`} style={{ width, borderRight: direction === 'right' ? '1px solid var(--border-color)' : 'none', borderLeft: direction === 'left' ? '1px solid var(--border-color)' : 'none' }}>
      <div className="panel-header-row">
        {title && <span className="panel-title-text">{title}</span>}
        <button className="collapse-toggle-btn" onClick={toggleCollapse} title="Sakrij panel">
          {direction === 'right' ? '◀' : '▶'}
        </button>
      </div>
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
