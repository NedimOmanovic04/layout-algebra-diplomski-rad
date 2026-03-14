import React, { useEffect } from 'react';
import { useLayoutStore } from '../store/layoutStore';

interface ToolbarProps {
  onExport: () => void;
  onHelp: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onExport, onHelp }) => {
  const { canUndo, canRedo, undo, redo } = useLayoutStore();

  // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="toolbar">
      <h1>Layout Algebra</h1>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          className="toolbar-btn"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          ↩ Undo
        </button>
        <button
          className="toolbar-btn"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          ↪ Redo
        </button>
        <button className="export-btn" onClick={onExport}>
          Export
        </button>
        <button className="help-btn" onClick={onHelp} title="Help / Documentation">
          ?
        </button>
      </div>
    </div>
  );
};
