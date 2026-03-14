import React, { useState, useMemo } from 'react';
import { useLayoutStore } from '../store/layoutStore';
import { exportLayout, getExportExtension, getExportMime, type ExportFormat } from '../export/cssExport';

const FORMATS: { value: ExportFormat; label: string; desc: string }[] = [
  { value: 'absolute', label: 'Absolute CSS', desc: 'position: absolute sa px vrijednostima' },
  { value: 'flexbox', label: 'Flexbox CSS', desc: 'flex layout na osnovu rasporeda' },
  { value: 'grid', label: 'CSS Grid', desc: 'grid-template na osnovu layout-a' },
  { value: 'html', label: 'HTML + CSS', desc: 'kompletna HTML stranica sa inline stilovima' },
];

const styles = {
  backdrop: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 2000,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    background: '#1a1a2e',
    border: '1px solid #44475a',
    borderRadius: 10,
    width: 600,
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
    fontFamily: "'Inter', -apple-system, sans-serif",
    color: '#f8f8f2',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #44475a',
    background: '#12121f',
    borderRadius: '10px 10px 0 0',
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#8be9fd',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#6272a4',
    fontSize: 24,
    cursor: 'pointer',
    padding: '4px 8px',
    lineHeight: 1,
  },
  body: {
    padding: 20,
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  formatRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  formatBtn: {
    flex: 1,
    minWidth: 120,
    padding: '10px 12px',
    border: '1px solid #44475a',
    borderRadius: 6,
    background: 'rgba(0,0,0,0.2)',
    color: '#c0c0d0',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    textAlign: 'left' as const,
  },
  formatBtnActive: {
    border: '1px solid #bd93f9',
    background: 'rgba(189, 147, 249, 0.15)',
    color: '#f8f8f2',
  },
  formatLabel: {
    fontSize: 13,
    fontWeight: 600,
    display: 'block',
  },
  formatDesc: {
    fontSize: 11,
    color: '#6272a4',
    display: 'block',
    marginTop: 2,
  },
  preview: {
    flex: 1,
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid #44475a',
    borderRadius: 6,
    padding: 12,
    fontFamily: "'Fira Code', monospace",
    fontSize: 11,
    color: '#f1fa8c',
    whiteSpace: 'pre-wrap' as const,
    overflow: 'auto',
    maxHeight: 300,
    lineHeight: 1.5,
  },
  footer: {
    padding: '12px 20px',
    borderTop: '1px solid #44475a',
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
  },
  exportBtn: {
    padding: '10px 20px',
    background: '#bd93f9',
    color: '#12121f',
    border: 'none',
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  copyBtn: {
    padding: '10px 20px',
    background: 'rgba(0,0,0,0.3)',
    color: '#f8f8f2',
    border: '1px solid #44475a',
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
  },
};

interface ExportModalProps {
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ onClose }) => {
  const { ast, positions } = useLayoutStore();
  const [format, setFormat] = useState<ExportFormat>('absolute');
  const [copied, setCopied] = useState(false);

  const output = useMemo(() => exportLayout(format, ast, positions), [format, ast, positions]);

  const handleDownload = () => {
    if (!output) return;
    const ext = getExportExtension(format);
    const mime = getExportMime(format);
    const blob = new Blob([output], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `layout.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Export Layout</span>
          <button style={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>
          <div>
            <div style={{ fontSize: 12, color: '#6272a4', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Format</div>
            <div style={styles.formatRow}>
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  style={{
                    ...styles.formatBtn,
                    ...(format === f.value ? styles.formatBtnActive : {}),
                  }}
                  onClick={() => { setFormat(f.value); setCopied(false); }}
                >
                  <span style={styles.formatLabel}>{f.label}</span>
                  <span style={styles.formatDesc}>{f.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: '#6272a4', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Preview</div>
            <pre style={styles.preview}>{output || 'No layout to export.'}</pre>
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.copyBtn} onClick={handleCopy}>
            {copied ? '✓ Kopirano!' : 'Kopiraj'}
          </button>
          <button style={styles.exportBtn} onClick={handleDownload} disabled={!output}>
            ⬇ Download
          </button>
        </div>
      </div>
    </div>
  );
};
