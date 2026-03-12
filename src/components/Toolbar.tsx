import React from 'react';
import { exportToCSS } from '../export/cssExport';
import { useLayoutStore } from '../store/layoutStore';

export const Toolbar: React.FC = () => {
  const { ast, positions } = useLayoutStore();

  const handleExport = () => {
    const css = exportToCSS(ast, positions);
    if (!css) return;
    
    const blob = new Blob([css], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'layout.css';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="toolbar">
      <h1>Layout Algebra</h1>
      <button className="export-btn" onClick={handleExport}>
        Export CSS
      </button>
    </div>
  );
};
