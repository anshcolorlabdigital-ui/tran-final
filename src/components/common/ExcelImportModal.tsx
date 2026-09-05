import React, { useState, useRef } from 'react';
import { Modal } from './Modal';
import { importItemsFromExcel, loadBundledMaterialsCatalog, ExcelImportResult } from '../../utils/excelEngine';
import { useApp } from '../../context/AppContext';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Upload, Download, CheckCircle, AlertTriangle, RefreshCw, Zap } from 'lucide-react';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ isOpen, onClose }) => {
  const { showToast, showAlert } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ExcelImportResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = event => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        setFileBuffer(buffer);
        try {
          const wb = XLSX.read(buffer, { type: 'array' });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          const rows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
          if (rows.length > 0) {
            setPreviewColumns(Object.keys(rows[0]));
            setPreviewRows(rows.slice(0, 10)); // first 10 for preview
          } else {
            setPreviewColumns([]);
            setPreviewRows([]);
          }
        } catch (err: any) {
          showAlert(`Failed to parse Excel file: ${err.message}`, 'File Read Error', 'error');
        }
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleExecuteImport = () => {
    if (!fileBuffer) {
      showToast('Please select an Excel file first', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const result = importItemsFromExcel(fileBuffer);
      setImportResult(result);
      showToast(`Successfully imported ${result.importedCount} items and created ${result.createdSuppliersCount} suppliers!`, 'success');
    } catch (err: any) {
      showAlert(`Import failed: ${err.message}`, 'Import Error', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadBundledCatalog = async () => {
    setIsProcessing(true);
    try {
      const res = await loadBundledMaterialsCatalog();
      setImportResult(res);
      showToast(`Successfully imported ${res.importedCount} materials and created ${res.createdSuppliersCount} suppliers from ITEM.xls!`, 'success');
    } catch (err: any) {
      showAlert(`Failed to load ITEM.xls: ${err.message}`, 'Load Error', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { 'Item': 'ASTER / PRINTING SHEET 70 GSM', 'Category': 'Paper & Sheets', 'Supplier': 'KONARK RAW MATERIALS', 'Base Price': 100 },
      { 'Item': 'ASTER - 12X36 GLOSSY', 'Category': 'Glossy Media', 'Supplier': 'ROYAL GRAPHICS SUPPLIES', 'Base Price': 200 },
      { 'Item': 'INKJET BACKLIT FILM 100 MIC', 'Category': 'Film Media', 'Supplier': 'APEX DIGITAL CORP', 'Base Price': 450 },
      { 'Item': 'CANVAS MATTE ROLL 24 INCH', 'Category': 'Canvas & Fabric', 'Supplier': 'KONARK RAW MATERIALS', 'Base Price': 850 }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Items Template');
    XLSX.writeFile(wb, 'Items_Import_Template_4_Columns.xlsx');
    showToast('Downloaded sample 4-column Excel template!', 'success');
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFileBuffer(null);
    setPreviewRows([]);
    setPreviewColumns([]);
    setImportResult(null);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📥 Bulk Import Items from Excel (.xlsx / .xls)" maxWidth="850px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* 1-Click Load Bundled Catalog Banner */}
        <div style={{ background: 'linear-gradient(135deg, #ECFDF5 0%, #DCFCE7 100%)', border: '2px solid #10B981', borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontWeight: 900, color: '#065F46', fontSize: '0.96rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={18} color="#059669" />
              Pre-Bundled Materials File Available (assets/ITEM.xls)
            </span>
            <span style={{ fontSize: '0.82rem', color: '#047857', marginTop: '2px', display: 'block' }}>
              Contains all <strong>569 items/materials</strong> and <strong>29 suppliers</strong> ready to import in 1 click!
            </span>
          </div>
          <button
            type="button"
            onClick={handleLoadBundledCatalog}
            disabled={isProcessing}
            style={{
              background: '#059669',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 20px',
              fontWeight: 900,
              fontSize: '0.85rem',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(5,150,105,0.3)',
              whiteSpace: 'nowrap'
            }}
          >
            {isProcessing ? <RefreshCw size={15} className="spin" /> : <Zap size={15} />}
            ⚡ 1-Click Load 569 Materials
          </button>
        </div>

        {/* Info Banner */}
        <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <span style={{ fontWeight: 800, color: '#1E40AF', fontSize: '0.92rem', display: 'block' }}>
              📊 Standard 4-Column Excel Sheet Support
            </span>
            <span style={{ fontSize: '0.82rem', color: '#3B82F6', marginTop: '2px', display: 'block' }}>
              Supports columns: <strong>Item</strong>, <strong>Category</strong>, <strong>Supplier</strong>, and <strong>Base Price</strong>. Suppliers will be created automatically if they don't already exist.
            </span>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            style={{
              background: '#FFFFFF',
              color: '#2563EB',
              border: '1.5px solid #2563EB',
              borderRadius: '6px',
              padding: '6px 14px',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <Download size={14} />
            Download Sample
          </button>
        </div>

        {/* Upload Drop Zone */}
        {!selectedFile ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #93C5FD',
              borderRadius: '12px',
              background: '#F8FAFC',
              padding: '36px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx, .xls, .csv"
              style={{ display: 'none' }}
            />
            <div style={{ background: '#DBEAFE', color: '#2563EB', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <FileSpreadsheet size={28} />
            </div>
            <h4 style={{ margin: '0 0 6px', fontWeight: 800, fontSize: '1.05rem', color: '#1E293B' }}>
              Click to browse or Drag & Drop your Excel file (.xlsx / .xls)
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748B' }}>
              Upload your file containing 500+ materials (Item, Category, Supplier, Base Price)
            </p>
          </div>
        ) : (
          <div style={{ border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '16px', background: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileSpreadsheet size={24} color="#059669" />
                <div>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A' }}>{selectedFile.name}</span>
                  <span style={{ fontSize: '0.78rem', color: '#64748B', display: 'block' }}>
                    {(selectedFile.size / 1024).toFixed(1)} KB • {previewRows.length > 0 ? `Ready to import` : 'Analyzing'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset}
                style={{
                  background: '#F1F5F9',
                  color: '#475569',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Change File
              </button>
            </div>

            {/* Preview Table */}
            {previewRows.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>
                    Preview (First {previewRows.length} rows):
                  </span>
                  <span style={{ fontSize: '0.75rem', background: '#DCFCE7', color: '#166534', padding: '2px 8px', borderRadius: '10px', fontWeight: 800 }}>
                    Detected Columns: {previewColumns.join(', ')}
                  </span>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #CBD5E1', textAlign: 'left' }}>
                        {previewColumns.map((col, i) => (
                          <th key={i} style={{ padding: '6px 10px', fontWeight: 800, color: '#475569' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rIdx) => (
                        <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          {previewColumns.map((col, cIdx) => (
                            <td key={cIdx} style={{ padding: '6px 10px', color: '#1E293B' }}>
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Result banner if imported */}
            {importResult && (
              <div style={{ marginTop: '14px', background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '8px', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <CheckCircle size={18} color="#16A34A" />
                  <span style={{ fontWeight: 900, color: '#166534', fontSize: '0.92rem' }}>
                    Import Completed Successfully!
                  </span>
                </div>
                <div style={{ fontSize: '0.84rem', color: '#15803D', lineHeight: 1.5 }}>
                  ✓ <strong>{importResult.importedCount}</strong> items imported/updated into Item Master.<br />
                  ✓ <strong>{importResult.createdSuppliersCount}</strong> new suppliers automatically created in Supplier Master.<br />
                  ✓ Taxes and profit margins calculated automatically.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
          <button
            type="button"
            onClick={() => {
              handleReset();
              onClose();
            }}
            style={{
              padding: '8px 20px',
              borderRadius: '20px',
              border: '1px solid #CBD5E1',
              background: '#F8FAFC',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Close
          </button>

          {selectedFile && !importResult && (
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isProcessing}
              style={{
                padding: '8px 24px',
                borderRadius: '20px',
                border: 'none',
                background: isProcessing ? '#93C5FD' : '#2563EB',
                color: '#FFFFFF',
                fontWeight: 800,
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isProcessing ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
              {isProcessing ? 'Importing...' : 'Confirm & Import Items'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
