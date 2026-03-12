import { useMemo } from 'react';
import { Toolbar } from './components/Toolbar';
import { CodeEditor } from './components/CodeEditor';
import { ComponentPanel } from './components/ComponentPanel';
import { Canvas } from './components/Canvas';
import { ElementListPanel } from './components/ElementListPanel';
import { ConstraintBuilder, type ConstraintData } from './components/ConstraintBuilder';
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
  const { code, setCode, ast } = useLayoutStore();
  const elementNames = useMemo(() => (ast?.elements ?? []).map((e) => e.id) ?? [], [ast]);
  const constraints = useMemo(() => parseConstraintsFromCode(code), [code]);

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
      <Toolbar />
      <div className="main-content">
        <div className="left-panel">
          <CodeEditor />
          <ConstraintBuilder
            elementNames={elementNames}
            constraints={constraints}
            onAdd={handleAddConstraint}
            onRemove={handleRemoveConstraint}
          />
        </div>
        <div className="center-panel">
          <ComponentPanel />
        </div>
        <div className="right-panel">
          <Canvas />
        </div>
        <div className="far-right-panel">
          <ElementListPanel />
        </div>
      </div>
    </div>
  );
}

export default App;
