import React from 'react';
import { useLayoutStore } from '../store/layoutStore';

export const CodeEditor: React.FC = () => {
  const { code, setCode, error } = useLayoutStore();

  return (
    <div className="code-editor-wrapper">
      <textarea
        className="code-editor-textarea"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
      />
      {error && (
        <div className="code-editor-error">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};
