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
    if (error && error.includes('Konflikt')) {
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
        <ResizablePanel
           id="editor"
           title="DSL Editor"
           defaultWidth={350}
           minWidth={200}
           maxWidth={800}
           direction="right"
           className="left-panel-wrapper"
        >
          <div className="left-panel">
            <CodeEditor />
            <ConstraintBuilder
              elementNames={elementNames}
              constraints={constraints}
              onAdd={handleAddConstraint}
              onRemove={handleRemoveConstraint}
            />
          </div>
        </ResizablePanel>

        <ResizablePanel
           id="components"
           title="Components"
           defaultWidth={250}
           minWidth={150}
           maxWidth={500}
           direction="right"
           className="center-panel-wrapper"
        >
          <div className="center-panel">
            <ComponentPanel />
          </div>
        </ResizablePanel>

        <div className="right-panel">
           <Canvas />
        </div>

        <ResizablePanel
           id="elements"
           title="Document Elements"
           defaultWidth={300}
           minWidth={200}
           maxWidth={600}
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
