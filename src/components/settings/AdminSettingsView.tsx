import React, { useState, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { StockEngine } from '../../db/stockEngine';
import { CompanySettings, StockAdjustment } from '../../types';
import { Download, Upload, RotateCcw, Save, FileSpreadsheet, FileCode, CheckSquare, Square, Calendar } from 'lucide-react';
import { getTodayDateString } from '../../utils/dateUtils';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { downloadExcelBackup, downloadJSONBackup, downloadCombinedBackup, ExportFilterOptions } from '../../utils/exportUtils';

export const AdminSettingsView: React.FC = () => {
  const { settings, updateSettings, refreshKey, showToast } = useApp();
  const { currentUser, isAdmin } = useAuth();

  const items = useMemo(() => db.getItems().filter(i => i.isActive !== false), [refreshKey]);

  // Company Profile form
  const [formData, setFormData] = useState<CompanySettings>(settings);

  // Stock Adjustment form
  const [adjItemId, setAdjItemId] = useState('');
  const [countedStock, setCountedStock] = useState('0');
  const [adjReason, setAdjReason] = useState('Physical audit variance');

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // --- BACKUP & EXPORT STATE ---
  const todayStr = getTodayDateString();
  const firstOfMonthStr = `${todayStr.slice(0, 7)}-01`;

  const [backupFromDate, setBackupFromDate] = useState(firstOfMonthStr);
  const [backupToDate, setBackupToDate] = useState(todayStr);
  const [isFullHistory, setIsFullHistory] = useState(true);

  const [selectedModules, setSelectedModules] = useState({
    orders: true,
    purchases: true,
    sales: true,
    selfUse: true,
    parties: true,
    suppliers: true,
    items: true,
    adjustments: true,
    settings: true
  });

  React.useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const selectedItemCurrentStock = useMemo(() => {
    if (!adjItemId) return 0;
    return StockEngine.getItemCurrentStock(adjItemId);
  }, [adjItemId, refreshKey]);

  const handleSaveCompanyProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
  };

  const handleStockAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjItemId) {
      showToast('Please select an item for adjustment', 'error');
      return;
    }
    const item = db.getItemById(adjItemId);
    if (!item) return;

    const previousStock = StockEngine.getItemCurrentStock(adjItemId);
    const newStock = Number(countedStock);
    const difference = newStock - previousStock;

    if (difference === 0) {
      showToast('No difference between counted stock and current stock.', 'info');
      return;
    }

    const adjRecord: StockAdjustment = {
      id: `adj-${Date.now()}`,
      adjustmentNo: `ADJ-${Date.now().toString().slice(-4)}`,
      date: getTodayDateString(),
      itemId: item.id,
      itemName: item.name,
      previousStock,
      newStock,
      difference,
      type: difference > 0 ? 'INCREASE' : 'DECREASE',
      reason: adjReason.trim() || 'Physical inventory audit',
      adjustedBy: currentUser.name,
      createdAt: new Date().toISOString()
    };

    db.saveStockAdjustment(adjRecord);
    showToast(`Adjusted stock for ${item.name} from ${previousStock} to ${newStock}!`, 'success');

    setAdjItemId('');
    setCountedStock('0');
  };

  const getExportOptions = (): ExportFilterOptions => ({
    fromDate: backupFromDate,
    toDate: backupToDate,
    isFullHistory,
    modules: selectedModules
  });

  // Action: Download Both Excel + JSON
  const handleDownloadCombined = () => {
    const hasAny = Object.values(selectedModules).some(Boolean);
    if (!hasAny) {
      showToast('Please select at least one module to backup', 'error');
      return;
    }
    downloadCombinedBackup(getExportOptions());
    showToast('Downloading Excel (.xlsx) and JSON (.json) backup files...', 'success');
  };

  // Action: Download Excel (.xlsx)
  const handleDownloadExcelOnly = () => {
    const hasAny = Object.values(selectedModules).some(Boolean);
    if (!hasAny) {
      showToast('Please select at least one module to backup', 'error');
      return;
    }
    downloadExcelBackup(getExportOptions());
    showToast('Excel workbook backup downloaded successfully!', 'success');
  };

  // Action: Download JSON (.json)
  const handleDownloadJSONOnly = () => {
    const hasAny = Object.values(selectedModules).some(Boolean);
    if (!hasAny) {
      showToast('Please select at least one module to backup', 'error');
      return;
    }
    downloadJSONBackup(getExportOptions());
    showToast('JSON backup file downloaded successfully!', 'success');
  };

  // Action: File upload for restore
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      if (content) {
        const ok = db.importFullBackupJSON(content);
        if (ok) {
          showToast('Database restored successfully from backup JSON file!', 'success');
        } else {
          showToast('Failed to parse backup JSON file. Ensure format is valid.', 'error');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetDatabase = () => {
    db.initDatabase(true);
    showToast('Database reset to clean sample catalog.', 'info');
  };

  const setAllModules = (val: boolean) => {
    setSelectedModules({
      orders: val,
      purchases: val,
      sales: val,
      selfUse: val,
      parties: val,
      suppliers: val,
      items: val,
      adjustments: val,
      settings: val
    });
  };

  const setTransactionsOnly = () => {
    setSelectedModules({
      orders: true,
      purchases: true,
      sales: true,
      selfUse: true,
      parties: false,
      suppliers: false,
      items: false,
      adjustments: true,
      settings: false
    });
  };

  const setMastersOnly = () => {
    setSelectedModules({
      orders: false,
      purchases: false,
      sales: false,
      selfUse: false,
      parties: true,
      suppliers: true,
      items: true,
      adjustments: false,
      settings: true
    });
  };

  return (
    <div className="content-panel-grey">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div className="pill-header-lime" style={{ padding: '8px 28px', fontSize: '1.2rem' }}>
          ADMINISTRATION & SYSTEM SETTINGS
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Company Settings Card */}
        <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.15rem', marginBottom: '14px', color: '#002B99' }}>
            Company & Document Profile
          </h3>

          <form onSubmit={handleSaveCompanyProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '2px' }}>
                Business Name
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={formData.companyName}
                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '2px' }}>
                Address
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '2px' }}>
                  Phone
                </label>
                <input
                  type="text"
                  className="input-text-clean"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '2px' }}>
                  GSTIN
                </label>
                <input
                  type="text"
                  className="input-text-clean"
                  value={formData.gstin}
                  onChange={e => setFormData({ ...formData, gstin: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '2px' }}>
                  Sale Invoice Prefix
                </label>
                <input
                  type="text"
                  className="input-text-clean"
                  value={formData.invoicePrefix}
                  onChange={e => setFormData({ ...formData, invoicePrefix: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '2px' }}>
                  Purchase Bill Prefix
                </label>
                <input
                  type="text"
                  className="input-text-clean"
                  value={formData.purchasePrefix}
                  onChange={e => setFormData({ ...formData, purchasePrefix: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="btn-lime-action" style={{ alignSelf: 'flex-start', marginTop: '6px' }}>
              <Save size={16} />
              Save Company Profile
            </button>
          </form>
        </div>

        {/* Stock Adjustment Card */}
        <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.15rem', marginBottom: '14px', color: '#002B99' }}>
            Physical Stock Adjustment & Audit
          </h3>

          <form onSubmit={handleStockAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '2px' }}>
                Select Item to Adjust *
              </label>
              <select
                className="input-text-clean"
                value={adjItemId}
                onChange={e => {
                  setAdjItemId(e.target.value);
                  if (e.target.value) {
                    const cur = StockEngine.getItemCurrentStock(e.target.value);
                    setCountedStock(String(cur));
                  }
                }}
                required
              >
                <option value="">-- Choose Item --</option>
                {items.map(i => (
                  <option key={i.id} value={i.id}>
                    [{i.sno}] {i.name}
                  </option>
                ))}
              </select>
            </div>

            {adjItemId && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#F3F4F6', padding: '8px 12px', borderRadius: '6px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>System Recorded Stock:</span>
                  <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{selectedItemCurrentStock}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Difference:</span>
                  <div style={{ fontWeight: 900, fontSize: '1.1rem', color: Number(countedStock) - selectedItemCurrentStock >= 0 ? '#15803D' : '#EA3943' }}>
                    {Number(countedStock) - selectedItemCurrentStock >= 0 ? `+${Number(countedStock) - selectedItemCurrentStock}` : Number(countedStock) - selectedItemCurrentStock}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '2px' }}>
                Actual Counted Physical Stock *
              </label>
              <input
                type="number"
                min="0"
                className="input-text-clean"
                value={countedStock}
                onChange={e => setCountedStock(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '2px' }}>
                Reason / Audit Note
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={adjReason}
                onChange={e => setAdjReason(e.target.value)}
                placeholder="e.g. Damaged rolls, Physical stock recount"
              />
            </div>

            <button type="submit" className="btn-red-action" style={{ alignSelf: 'flex-start', marginTop: '6px' }}>
              Record Adjustment
            </button>
          </form>
        </div>
      </div>

      {/* Database Backup, Excel Export & Safe Migration Section */}
      <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '24px', marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.25rem', color: '#002B99', margin: 0 }}>
              Database Backup & Multi-Format Data Export
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#4B5563', fontWeight: 600 }}>
              Export formatted Excel workbooks (.xlsx) and JSON backup files with custom date ranges and module filters.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label
              style={{
                background: '#E0E7FF',
                color: '#3730A3',
                border: '1.5px solid #4F46E5',
                borderRadius: 'var(--radius-pill)',
                padding: '8px 20px',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Upload size={16} />
              Restore Database from JSON
              <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>

            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              style={{
                background: '#FEE2E2',
                color: '#991B1B',
                border: '1px solid #F87171',
                borderRadius: 'var(--radius-pill)',
                padding: '8px 16px',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RotateCcw size={15} />
              Reset Catalog
            </button>
          </div>
        </div>

        {/* Date Range & Quick Preset Filters */}
        <div
          style={{
            background: '#F9FAFB',
            border: '1.5px solid #D1D5DB',
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '0.92rem', color: '#1F2937' }}>
              <Calendar size={18} color="#002B99" />
              <span>Backup Date Range / Period:</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setIsFullHistory(true)}
                style={{
                  padding: '4px 14px',
                  borderRadius: '16px',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  border: isFullHistory ? '1.5px solid #002B99' : '1px solid #D1D5DB',
                  background: isFullHistory ? '#002B99' : '#FFFFFF',
                  color: isFullHistory ? '#FFFFFF' : '#374151'
                }}
              >
                All Time / Full Database
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsFullHistory(false);
                  setBackupFromDate(firstOfMonthStr);
                  setBackupToDate(todayStr);
                }}
                style={{
                  padding: '4px 14px',
                  borderRadius: '16px',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  border: !isFullHistory && backupFromDate === firstOfMonthStr ? '1.5px solid #002B99' : '1px solid #D1D5DB',
                  background: !isFullHistory && backupFromDate === firstOfMonthStr ? '#002B99' : '#FFFFFF',
                  color: !isFullHistory && backupFromDate === firstOfMonthStr ? '#FFFFFF' : '#374151'
                }}
              >
                This Month
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsFullHistory(false);
                  setBackupFromDate(`${todayStr.slice(0, 4)}-04-01`);
                  setBackupToDate(todayStr);
                }}
                style={{
                  padding: '4px 14px',
                  borderRadius: '16px',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  border: '1px solid #D1D5DB',
                  background: '#FFFFFF',
                  color: '#374151'
                }}
              >
                Current Financial Year
              </button>
            </div>
          </div>

          {!isFullHistory && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', paddingTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#4B5563' }}>From Date:</label>
                <input
                  type="date"
                  className="input-text-clean"
                  value={backupFromDate}
                  onChange={e => setBackupFromDate(e.target.value)}
                  style={{ width: '150px', padding: '5px 10px', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#4B5563' }}>To Date:</label>
                <input
                  type="date"
                  className="input-text-clean"
                  value={backupToDate}
                  onChange={e => setBackupToDate(e.target.value)}
                  style={{ width: '150px', padding: '5px 10px', fontSize: '0.88rem' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Modules Checkboxes */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#1F2937' }}>
              Select Data Modules to Include in Backup:
            </span>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setAllModules(true)}
                style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '12px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Select All
              </button>
              <button
                type="button"
                onClick={setTransactionsOnly}
                style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '12px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Transactions Only
              </button>
              <button
                type="button"
                onClick={setMastersOnly}
                style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '12px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Masters Only
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '10px',
              background: '#F9FAFB',
              border: '1.5px solid #E5E7EB',
              borderRadius: '8px',
              padding: '14px'
            }}
          >
            {[
              { key: 'orders', label: 'Supplier Orders' },
              { key: 'purchases', label: 'Purchase Entries' },
              { key: 'sales', label: 'Sales Invoices' },
              { key: 'selfUse', label: 'Self Use Vouchers' },
              { key: 'parties', label: 'Parties Master' },
              { key: 'suppliers', label: 'Suppliers Master' },
              { key: 'items', label: 'Items & Stock Master' },
              { key: 'adjustments', label: 'Stock Adjustments' },
              { key: 'settings', label: 'Company Settings' }
            ].map(mod => {
              const checked = (selectedModules as any)[mod.key];
              return (
                <label
                  key={mod.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: checked ? '#EEF2FF' : '#FFFFFF',
                    border: checked ? '1px solid #6366F1' : '1px solid #E5E7EB',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: checked ? '#312E81' : '#4B5563'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={e => setSelectedModules({ ...selectedModules, [mod.key]: e.target.checked })}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>{mod.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Action Buttons: "Download Backup (Excel + JSON)", "Excel Only", "JSON Only" */}
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', borderTop: '1.5px dashed #D1D5DB', paddingTop: '18px' }}>
          {/* Main Button: Excel + JSON Combined */}
          <button
            type="button"
            onClick={handleDownloadCombined}
            style={{
              backgroundColor: '#10B981',
              color: '#FFFFFF',
              border: '2px solid #047857',
              borderRadius: 'var(--radius-pill)',
              padding: '10px 28px',
              fontWeight: 900,
              fontSize: '0.98rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(16,185,129,0.25)'
            }}
          >
            <Download size={18} />
            <span>Download Backup (Excel + JSON)</span>
          </button>

          {/* Excel Only (.xlsx) */}
          <button
            type="button"
            onClick={handleDownloadExcelOnly}
            style={{
              backgroundColor: '#FFFFFF',
              color: '#047857',
              border: '1.5px solid #10B981',
              borderRadius: 'var(--radius-pill)',
              padding: '9px 20px',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileSpreadsheet size={16} />
            Download Excel (.xlsx)
          </button>

          {/* JSON Only (.json) */}
          <button
            type="button"
            onClick={handleDownloadJSONOnly}
            style={{
              backgroundColor: '#FFFFFF',
              color: '#4338CA',
              border: '1.5px solid #6366F1',
              borderRadius: 'var(--radius-pill)',
              padding: '9px 20px',
              fontWeight: 800,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileCode size={16} />
            Download JSON (.json)
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleResetDatabase}
        title="Reset Entire Database"
        message="Are you sure you want to reset all transaction data, orders, and masters back to the sample demo state? All current unexported records will be overwritten."
      />
    </div>
  );
};
