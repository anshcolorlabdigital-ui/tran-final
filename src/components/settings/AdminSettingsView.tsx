import React, { useState, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { StockEngine } from '../../db/stockEngine';
import { CompanySettings, StockAdjustment } from '../../types';
import { Download, Upload, RotateCcw, Save, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { getTodayDateString } from '../../utils/dateUtils';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const AdminSettingsView: React.FC = () => {
  const { settings, updateSettings, refreshKey, showToast } = useApp();
  const { currentUser, isAdmin } = useAuth();

  const items = useMemo(() => db.getItems().filter(i => i.isActive !== false), [refreshKey]);
  const adjustments = useMemo(() => db.getStockAdjustments(), [refreshKey]);

  // Company Profile form
  const [formData, setFormData] = useState<CompanySettings>(settings);

  // Stock Adjustment form
  const [adjItemId, setAdjItemId] = useState('');
  const [countedStock, setCountedStock] = useState('0');
  const [adjReason, setAdjReason] = useState('Physical audit variance');

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

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

  const handleDownloadBackup = () => {
    const jsonStr = db.exportFullBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RMMS_Database_Backup_${getTodayDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Database backup downloaded successfully!', 'success');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      if (content) {
        const ok = db.importFullBackupJSON(content);
        if (ok) {
          showToast('Database restored successfully from backup!', 'success');
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.75rem', marginBottom: '2px' }}>
                  Sale Inv Prefix
                </label>
                <input
                  type="text"
                  className="input-text-clean"
                  value={formData.invoicePrefix}
                  onChange={e => setFormData({ ...formData, invoicePrefix: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.75rem', marginBottom: '2px' }}>
                  Purchase Prefix
                </label>
                <input
                  type="text"
                  className="input-text-clean"
                  value={formData.purchasePrefix}
                  onChange={e => setFormData({ ...formData, purchasePrefix: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.75rem', marginBottom: '2px' }}>
                  Order Prefix
                </label>
                <input
                  type="text"
                  className="input-text-clean"
                  value={formData.orderPrefix}
                  onChange={e => setFormData({ ...formData, orderPrefix: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="btn-lime-action" style={{ alignSelf: 'flex-start', marginTop: '6px' }}>
              <Save size={15} />
              Save Profile
            </button>
          </form>
        </div>

        {/* Physical Stock Adjustment Tool */}
        <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.15rem', marginBottom: '14px', color: '#002B99' }}>
            Physical Stock Audit & Reconciliation
          </h3>

          <form onSubmit={handleStockAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '2px' }}>
                Select Item to Reconcile
              </label>
              <select
                className="input-text-clean"
                value={adjItemId}
                onChange={e => {
                  setAdjItemId(e.target.value);
                  const curr = StockEngine.getItemCurrentStock(e.target.value);
                  setCountedStock(String(curr));
                }}
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

      {/* Database Backup & Recovery Section */}
      <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '20px', marginTop: '24px' }}>
        <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.15rem', marginBottom: '14px', color: '#002B99' }}>
          Data Backup & Safe Migration
        </h3>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={handleDownloadBackup} className="btn-lime-action">
            <Download size={16} />
            Download Full JSON Backup
          </button>

          <label
            style={{
              background: '#FFFFFF',
              border: '1px solid #000000',
              borderRadius: 'var(--radius-pill)',
              padding: '8px 18px',
              fontWeight: 800,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Upload size={16} />
            Restore Database from JSON
            <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>

          <button
            onClick={() => setIsResetConfirmOpen(true)}
            style={{
              background: '#FEE2E2',
              color: '#991B1B',
              border: '1px solid #F87171',
              borderRadius: 'var(--radius-pill)',
              padding: '8px 18px',
              fontWeight: 800,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginLeft: 'auto'
            }}
          >
            <RotateCcw size={16} />
            Reset to Sample Catalog
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
