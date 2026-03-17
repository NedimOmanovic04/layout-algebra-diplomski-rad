import { useMemo, useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { CodeEditor } from './components/CodeEditor';
import { ComponentPanel } from './components/ComponentPanel';
import { Canvas } from './components/Canvas';
import { ElementListPanel } from './components/ElementListPanel';
import { ConstraintBuilder, type ConstraintData } from './components/ConstraintBuilder';
import { ExportModal } from './components/ExportModal';
import { HelpPanel } from './components/HelpPanel';
import { ResizablePanel } from './components/ResizablePanel';
import { useLayoutStore } from './store/layoutStore';
import './App.css';

function parseConstraintsFromCode(code: string): ConstraintData[] {
  const lines = code.split('\n');
  const result: ConstraintData[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith('CONSTRAINT ')) continue;
    const body = t.substring('CONSTRAINT '.length).trim();
    const id = `CONSTRAINT ${body}`;
    const parts = body.split(/\s+/);
    if (parts.length < 3) continue;
    const op = parts.find((p) => p === '==' || p === '>=' || p === '<=');
    if (!op) continue;
    const opIdx = parts.indexOf(op);
    const left = parts.slice(0, opIdx).join(' ');
    const right = parts.slice(opIdx + 1).join(' ');
    result.push({ id, left, op, right });
  }
  return result;
}

function App() {
  const { code, setCode, ast, error } = useLayoutStore();
  const [showExport, setShowExport] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const elementNames = useMemo(() => (ast?.elements ?? []).map((e) => e.id) ?? [], [ast]);
  const constraints = useMemo(() => {
    const parsed = parseConstraintsFromCode(code);
    if (error && error.includes('Conflict')) {
      return parsed.map(c => ({ ...c, hasError: true }));
    }
    return parsed;
  }, [code, error]);

  const handleAddConstraint = (c: ConstraintData) => {
    const line = 'CONSTRAINT ' + c.left + ' ' + c.op + ' ' + c.right;
    if (code.includes(line)) return;
    setCode(code.trimEnd() + '\n' + line + '\n');
  };

  const handleRemoveConstraint = (id: string) => {
    const lineToRemove = id.startsWith('CONSTRAINT ') ? id : `CONSTRAINT ${id}`;
    const newCode = code
      .split('\n')
      .filter((line) => line.trim() !== lineToRemove.trim())
      .join('\n');
    setCode(newCode);
  };

  return (
    <div className="app-container">
      <Toolbar
        onExport={() => setShowExport(true)}
        onHelp={() => setShowHelp(true)}
      />
      <div className="main-content">
        {/* Leftmost Sidebar: DSL Editor */}
        <ResizablePanel
          id="editor"
          title="DSL Editor"
          defaultSize={350}
          minSize={200}
          maxSize={800}
          direction="right"
          className="left-panel-wrapper"
        >
          <div className="left-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <ResizablePanel
               id="dsl-code-panel"
               title="Code"
               hideHeader={true}
               defaultSize={typeof window !== 'undefined' ? window.innerHeight * 0.4 : 350}
               minSize={100}
               maxSize={1000}
               direction="bottom"
            >
               <CodeEditor />
            </ResizablePanel>
            <div style={{ flex: 1, overflowY: 'auto' }}>
               <ConstraintBuilder
                 elementNames={elementNames}
                 constraints={constraints}
                 onAdd={handleAddConstraint}
                 onRemove={handleRemoveConstraint}
               />
            </div>
          </div>
        </ResizablePanel>

        {/* Center-Left Sidebar: Components */}
        <ResizablePanel
          id="components"
          title="Components"
          defaultSize={250}
          minSize={150}
          maxSize={500}
          direction="right"
          className="components-panel-wrapper"
        >
          <div className="center-panel">
            <ComponentPanel />
          </div>
        </ResizablePanel>

        {/* Adaptive Center: Visual Canvas */}
        <div className="right-panel">
          <Canvas />
        </div>

        {/* Rightmost Sidebar: Document Elements */}
        <ResizablePanel
          id="elements"
          title="Document Elements"
          defaultSize={300}
          minSize={200}
          maxSize={600}
          direction="left"
          className="far-right-panel-wrapper"
        >
          <div className="far-right-panel">
            <ElementListPanel />
          </div>
        </ResizablePanel>
      </div>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
    </div>
  );
}

export default App;
