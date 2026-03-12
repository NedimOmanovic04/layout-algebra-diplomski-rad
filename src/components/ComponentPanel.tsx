import React from 'react';
import { useLayoutStore } from '../store/layoutStore';

interface ElementTemplate {
  type: string;
  label: string;
  icon: string;
  width: number;
  height: number;
}

const ELEMENT_TEMPLATES: ElementTemplate[] = [
  { type: 'header',  label: 'Header',  icon: '▬',  width: 800, height: 60 },
  { type: 'navbar',  label: 'NavBar',  icon: '☰',  width: 800, height: 50 },
  { type: 'sidebar', label: 'Sidebar', icon: '▮',  width: 200, height: 600 },
  { type: 'footer',  label: 'Footer',  icon: '▭',  width: 800, height: 50 },
  { type: 'button',  label: 'Button',  icon: '▢',  width: 120, height: 40 },
  { type: 'card',    label: 'Card',    icon: '▧',  width: 300, height: 200 },
  { type: 'input',   label: 'Input',   icon: '▤',  width: 200, height: 35 },
  { type: 'image',   label: 'Image',   icon: '▩',  width: 300, height: 200 },
];

export const ComponentPanel: React.FC = () => {
  const addElement = useLayoutStore(s => s.addElement);

  return (
    <div className="component-panel">
      <div className="component-panel-header">Components</div>
      <div className="component-panel-list">
        {ELEMENT_TEMPLATES.map(tpl => (
          <button
            key={tpl.type}
            className="component-item"
            onClick={() => addElement(tpl.type, tpl.width, tpl.height)}
            title={`Add ${tpl.label} (${tpl.width}×${tpl.height})`}
          >
            <span className="component-item-icon">{tpl.icon}</span>
            <span className="component-item-label">{tpl.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
