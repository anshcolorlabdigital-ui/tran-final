import React, { useState, useMemo, useEffect } from 'react';
import { db, DeleteFilterOptions } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { StockEngine } from '../../db/stockEngine';
import { CompanySettings, StockAdjustment } from '../../types';
import {
  Download,
  Upload,
  RotateCcw,
  Save,
  FileSpreadsheet,
  FileCode,
  Calendar,
  Building2,
  SlidersHorizontal,
  Trash2,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { getTodayDateString, formatDateToDisplay } from '../../utils/dateUtils';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { downloadExcelBackup, downloadJSONBackup, downloadCombinedBackup, ExportFilterOptions } from '../../utils/exportUtils';

type AdminTab = 'COMPANY' | 'STOCK_AUDIT' | 'BACKUP' | 'RESTORE' | 'DELETE';

interface SidebarModulesSelection {
  // OPERATIONS
  order: boolean;
  orderedSection: boolean;
  purchase: boolean;
  sale: boolean;
  selfUse: boolean;
  // MASTERS
  party: boolean;
  item: boolean;
  supplier: boolean;
  openingStock: boolean;
  // REPORT
  reportSales: boolean;
  reportPurchases: boolean;
  reportSelfUse: boolean;
  reportItemStock: boolean;
}

export const AdminSettingsView: React.FC = () => {
  const { settings, updateSettings, refreshKey, showToast } = useApp();
  const { currentUser } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<AdminTab>('BACKUP');
  const items = useMemo(() => db.getItems().filter(i => i.isActive !== false), [refreshKey]);

  // Company Profile form
  const [formData, setFormData] = useState<CompanySettings>(settings);

  // Stock Adjustment form
  const [adjItemId, setAdjItemId] = useState('');
  const [countedStock, setCountedStock] = useState('0');
  const [adjReason, setAdjReason] = useState('Physical audit variance');

  // Confirmation dialogs
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Dates
  const todayStr = getTodayDateString();
  const firstOfMonthStr = `${todayStr.slice(0, 7)}-01`;

  // --- LIVE COUNTS MATCHING SIDEBAR ---
  const lowStockSummaries = useMemo(() => StockEngine.getLowStockItems(), [refreshKey]);
  const pendingOrderCount = useMemo(() => lowStockSummaries.filter(item => !item.activeOrder).length, [lowStockSummaries]);
  const placedOrdersCount = useMemo(() => db.getOrders().filter(o => o.status === 'ORDERED' || o.status === 'PARTIALLY_RECEIVED').length, [refreshKey]);
  const purchasesCount = useMemo(() => db.getPurchases().length, [refreshKey]);
  const salesCount = useMemo(() => db.getSales().length, [refreshKey]);
  const selfUseCount = useMemo(() => db.getSelfUses().length, [refreshKey]);
  const partiesCount = useMemo(() => db.getParties().length, [refreshKey]);
  const itemsCount = useMemo(() => db.getItems().length, [refreshKey]);
  const suppliersCount = useMemo(() => db.getSuppliers().length, [refreshKey]);
  const openingStockCount = useMemo(() => db.getStockMovements().filter(m => m.type === 'OPENING').length, [refreshKey]);
  const itemStockCount = useMemo(() => lowStockSummaries.length, [lowStockSummaries]);

  // --- BACKUP STATE ---
  const [backupDateMode, setBackupDateMode] = useState<'THIS_MONTH' | 'CUSTOM'>('THIS_MONTH');
  const [backupFromDate, setBackupFromDate] = useState(firstOfMonthStr);
  const [backupToDate, setBackupToDate] = useState(todayStr);

  const [backupModules, setBackupModules] = useState<SidebarModulesSelection>({
    order: true,
    orderedSection: true,
    purchase: true,
    sale: true,
    selfUse: true,
    party: true,
    item: true,
    supplier: true,
    openingStock: true,
    reportSales: true,
    reportPurchases: true,
    reportSelfUse: true,
    reportItemStock: true
  });

  // --- RESTORE STATE ---
  const [restoreFileJson, setRestoreFileJson] = useState<string | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string>('');
  const [restoreFileSize, setRestoreFileSize] = useState<string>('');
  const [restoreParsedData, setRestoreParsedData] = useState<any | null>(null);
  const [restoreParseError, setRestoreParseError] = useState<string | null>(null);

  // --- DELETE STATE ---
  const [deleteDateMode, setDeleteDateMode] = useState<'THIS_MONTH' | 'CUSTOM'>('THIS_MONTH');
  const [deleteFromDate, setDeleteFromDate] = useState(firstOfMonthStr);
  const [deleteToDate, setDeleteToDate] = useState(todayStr);

  // CRITICAL: Item, Supplier, Opening Stock, and Party are UNCHECKED (OFF) by default for safety!
  const [deleteModules, setDeleteModules] = useState<SidebarModulesSelection>({
    order: true,
    orderedSection: true,
    purchase: true,
    sale: true,
    selfUse: true,
    party: false,
    item: false,
    supplier: false,
    openingStock: false,
    reportSales: true,
    reportPurchases: true,
    reportSelfUse: true,
    reportItemStock: true
  });

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const selectedItemCurrentStock = useMemo(() => {
    if (!adjItemId) return 0;
    return StockEngine.getItemCurrentStock(adjItemId);
  }, [adjItemId, refreshKey]);

  // --- PREVIEW COUNTS FOR DELETE ---
  const deleteEffectiveFrom = deleteDateMode === 'THIS_MONTH' ? firstOfMonthStr : deleteFromDate;
  const deleteEffectiveTo = deleteDateMode === 'THIS_MONTH' ? todayStr : deleteToDate;

  const deletePreviewCounts = useMemo(() => {
    const options: DeleteFilterOptions = {
      fromDate: deleteEffectiveFrom,
      toDate: deleteEffectiveTo,
      isCustomDate: deleteDateMode === 'CUSTOM',
      modules: {
        orders: Boolean(deleteModules.order || deleteModules.orderedSection),
        purchases: Boolean(deleteModules.purchase || deleteModules.reportPurchases),
        sales: Boolean(deleteModules.sale || deleteModules.reportSales),
        selfUse: Boolean(deleteModules.selfUse || deleteModules.reportSelfUse),
        adjustments: Boolean(deleteModules.reportItemStock),
        openingStock: Boolean(deleteModules.openingStock),
        items: Boolean(deleteModules.item),
        suppliers: Boolean(deleteModules.supplier),
        parties: Boolean(deleteModules.party)
      }
    };
    return db.getDeletePreviewCounts(options);
  }, [deleteEffectiveFrom, deleteEffectiveTo, deleteDateMode, deleteModules, refreshKey]);

  // --- BACKUP PRESET HANDLERS ---
  const setBackupPreset = (preset: 'ALL' | 'REPORT' | 'DASHBOARD' | 'REPORT_DASHBOARD' | 'CLEAR') => {
    if (preset === 'ALL') {
      setBackupModules({
        order: true,
        orderedSection: true,
        purchase: true,
        sale: true,
        selfUse: true,
        party: true,
        item: true,
        supplier: true,
        openingStock: true,
        reportSales: true,
        reportPurchases: true,
        reportSelfUse: true,
        reportItemStock: true
      });
    } else if (preset === 'REPORT') {
      setBackupModules({
        order: false,
        orderedSection: false,
        purchase: true,
        sale: true,
        selfUse: true,
        party: false,
        item: true,
        supplier: false,
        openingStock: false,
        reportSales: true,
        reportPurchases: true,
        reportSelfUse: true,
        reportItemStock: true
      });
    } else if (preset === 'DASHBOARD') {
      setBackupModules({
        order: true,
        orderedSection: true,
        purchase: false,
        sale: false,
        selfUse: false,
        party: false,
        item: true,
        supplier: false,
        openingStock: false,
        reportSales: false,
        reportPurchases: false,
        reportSelfUse: false,
        reportItemStock: false
      });
    } else if (preset === 'REPORT_DASHBOARD') {
      setBackupModules({
        order: true,
        orderedSection: true,
        purchase: true,
        sale: true,
        selfUse: true,
        party: false,
        item: false,
        supplier: false,
        openingStock: false,
        reportSales: true,
        reportPurchases: true,
        reportSelfUse: true,
        reportItemStock: true
      });
    } else if (preset === 'CLEAR') {
      setBackupModules({
        order: false,
        orderedSection: false,
        purchase: false,
        sale: false,
        selfUse: false,
        party: false,
        item: false,
        supplier: false,
        openingStock: false,
        reportSales: false,
        reportPurchases: false,
        reportSelfUse: false,
        reportItemStock: false
      });
    }
  };

  // --- DELETE PRESET HANDLERS ---
  const setDeletePreset = (preset: 'ALL' | 'REPORT' | 'DASHBOARD' | 'REPORT_DASHBOARD' | 'CLEAR') => {
    if (preset === 'ALL') {
      setDeleteModules({
        order: true,
        orderedSection: true,
        purchase: true,
        sale: true,
        selfUse: true,
        party: true,
        item: true,
        supplier: true,
        openingStock: true,
        reportSales: true,
        reportPurchases: true,
        reportSelfUse: true,
        reportItemStock: true
      });
    } else if (preset === 'REPORT') {
      setDeleteModules({
        order: false,
        orderedSection: false,
        purchase: true,
        sale: true,
        selfUse: true,
        party: false,
        item: false,
        supplier: false,
        openingStock: false,
        reportSales: true,
        reportPurchases: true,
        reportSelfUse: true,
        reportItemStock: true
      });
    } else if (preset === 'DASHBOARD') {
      setDeleteModules({
        order: true,
        orderedSection: true,
        purchase: false,
        sale: false,
        selfUse: false,
        party: false,
        item: false,
        supplier: false,
        openingStock: false,
        reportSales: false,
        reportPurchases: false,
        reportSelfUse: false,
        reportItemStock: false
      });
    } else if (preset === 'REPORT_DASHBOARD') {
      setDeleteModules({
        order: true,
        orderedSection: true,
        purchase: true,
        sale: true,
        selfUse: true,
        party: false,
        item: false,
        supplier: false,
        openingStock: false,
        reportSales: true,
        reportPurchases: true,
        reportSelfUse: true,
        reportItemStock: true
      });
    } else if (preset === 'CLEAR') {
      setDeleteModules({
        order: false,
        orderedSection: false,
        purchase: false,
        sale: false,
        selfUse: false,
        party: false,
        item: false,
        supplier: false,
        openingStock: false,
        reportSales: false,
        reportPurchases: false,
        reportSelfUse: false,
        reportItemStock: false
      });
    }
  };

  // Company Profile Save
  const handleSaveCompanyProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
  };

  // Physical Stock Adjustment
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

  // Backup Export Options Builder
  const getExportOptions = (): ExportFilterOptions => ({
    fromDate: backupDateMode === 'THIS_MONTH' ? firstOfMonthStr : backupFromDate,
    toDate: backupDateMode === 'THIS_MONTH' ? todayStr : backupToDate,
    isFullHistory: false,
    modules: {
      orders: Boolean(backupModules.order || backupModules.orderedSection),
      purchases: Boolean(backupModules.purchase || backupModules.reportPurchases),
      sales: Boolean(backupModules.sale || backupModules.reportSales),
      selfUse: Boolean(backupModules.selfUse || backupModules.reportSelfUse),
      parties: Boolean(backupModules.party),
      suppliers: Boolean(backupModules.supplier),
      items: Boolean(backupModules.item),
      adjustments: Boolean(backupModules.reportItemStock),
      settings: true
    }
  });

  const handleDownloadCombined = () => {
    const hasAny = Object.values(backupModules).some(Boolean);
    if (!hasAny) {
      showToast('Please select at least one module to backup', 'error');
      return;
    }
    downloadCombinedBackup(getExportOptions());
    showToast('Downloading Excel (.xlsx) and JSON (.json) backup files...', 'success');
  };

  const handleDownloadExcelOnly = () => {
    const hasAny = Object.values(backupModules).some(Boolean);
    if (!hasAny) {
      showToast('Please select at least one module to backup', 'error');
      return;
    }
    downloadExcelBackup(getExportOptions());
    showToast('Excel workbook backup downloaded successfully!', 'success');
  };

  const handleDownloadJSONOnly = () => {
    const hasAny = Object.values(backupModules).some(Boolean);
    if (!hasAny) {
      showToast('Please select at least one module to backup', 'error');
      return;
    }
    downloadJSONBackup(getExportOptions());
    showToast('JSON backup file downloaded successfully!', 'success');
  };

  // Restore File Upload & Inspection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFileName(file.name);
    setRestoreFileSize(`${(file.size / 1024).toFixed(1)} KB`);
    setRestoreParseError(null);

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      if (content) {
        setRestoreFileJson(content);
        try {
          let parsed = JSON.parse(content);
          if (parsed && parsed.data && typeof parsed.data === 'object') {
            parsed = { ...parsed, ...parsed.data };
          }
          setRestoreParsedData(parsed);
          showToast(`Backup file "${file.name}" loaded for inspection.`, 'info');
        } catch (err) {
          setRestoreParsedData(null);
          setRestoreParseError('Invalid JSON format or corrupted file.');
          showToast('Failed to parse backup JSON file.', 'error');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const executeRestore = () => {
    if (!restoreFileJson) {
      showToast('Please select a JSON backup file first', 'error');
      return;
    }
    const ok = db.importFullBackupJSON(restoreFileJson);
    setIsRestoreConfirmOpen(false);
    if (ok) {
      showToast('Database restored successfully from backup JSON file!', 'success');
      setRestoreFileJson(null);
      setRestoreParsedData(null);
      setRestoreFileName('');
    } else {
      showToast('Failed to restore backup. Ensure format matches RMMS schema.', 'error');
    }
  };

  // Delete Data Execution
  const executeDelete = () => {
    const hasAny = Object.values(deleteModules).some(Boolean);
    if (!hasAny) {
      showToast('Please select at least one module to delete', 'error');
      return;
    }

    const options: DeleteFilterOptions = {
      fromDate: deleteEffectiveFrom,
      toDate: deleteEffectiveTo,
      isCustomDate: deleteDateMode === 'CUSTOM',
      modules: {
        orders: Boolean(deleteModules.order || deleteModules.orderedSection),
        purchases: Boolean(deleteModules.purchase || deleteModules.reportPurchases),
        sales: Boolean(deleteModules.sale || deleteModules.reportSales),
        selfUse: Boolean(deleteModules.selfUse || deleteModules.reportSelfUse),
        adjustments: Boolean(deleteModules.reportItemStock),
        openingStock: Boolean(deleteModules.openingStock),
        items: Boolean(deleteModules.item),
        suppliers: Boolean(deleteModules.supplier),
        parties: Boolean(deleteModules.party)
      }
    };

    const deletedCounts = db.deleteDataByFilter(options);
    setIsDeleteConfirmOpen(false);

    const total = Object.values(deletedCounts).reduce((acc, c) => acc + c, 0);
    showToast(`Successfully deleted ${total} records matching selected modules and date range.`, 'success');
  };

  const handleResetDatabase = () => {
    db.initDatabase(true);
    setIsResetConfirmOpen(false);
    showToast('Database reset to clean default sample catalog.', 'info');
  };

  // Render module card component
  const renderModuleCard = (
    key: keyof SidebarModulesSelection,
    label: string,
    badgeCount: number,
    state: SidebarModulesSelection,
    setState: React.Dispatch<React.SetStateAction<SidebarModulesSelection>>,
    isMaster = false
  ) => {
    const checked = state[key];
    return (
      <label
        key={key}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderRadius: '6px',
          background: checked ? (isMaster ? '#FEF2F2' : '#EEF2FF') : '#FFFFFF',
          border: checked ? (isMaster ? '1.5px solid #DC2626' : '1.5px solid #6366F1') : '1px solid #E5E7EB',
          cursor: 'pointer',
          fontSize: '0.88rem',
          fontWeight: 800,
          color: checked ? (isMaster ? '#991B1B' : '#1E1B4B') : '#4B5563'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setState(prev => ({ ...prev, [key]: e.target.checked }))}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <span>{label}</span>
        </div>
        {badgeCount > 0 && (
          <span
            style={{
              backgroundColor: '#EA3943',
              color: '#FFFFFF',
              fontSize: '0.75rem',
              fontWeight: 900,
              padding: '1px 8px',
              borderRadius: '9999px',
              marginLeft: '4px'
            }}
          >
            {badgeCount}
          </span>
        )}
      </label>
    );
  };

  return (
    <div className="content-panel-grey">
      {/* Top Header Bar with Segmented Pill Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div className="pill-header-lime" style={{ padding: '8px 24px', fontSize: '1.2rem', fontWeight: 900 }}>
          ADMINISTRATION
        </div>

        {/* Segmented Sub-Navigation Bar */}
        <div style={{ display: 'flex', gap: '8px', background: '#FFFFFF', padding: '5px', borderRadius: '30px', border: '1.5px solid #000000', flexWrap: 'wrap' }}>
          {[
            { key: 'BACKUP', label: 'Backup Data', icon: Download },
            { key: 'RESTORE', label: 'Restore Data', icon: Upload },
            { key: 'DELETE', label: 'Delete Data', icon: Trash2 },
            { key: 'COMPANY', label: 'Company Profile', icon: Building2 },
            { key: 'STOCK_AUDIT', label: 'Stock Audit', icon: SlidersHorizontal }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveSubTab(tab.key as AdminTab)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 16px',
                  borderRadius: '20px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  transition: 'all 0.15s ease',
                  background: isActive ? (tab.key === 'DELETE' ? '#EA3943' : tab.key === 'BACKUP' ? '#10B981' : tab.key === 'RESTORE' ? '#6366F1' : '#E2D2F8') : 'transparent',
                  color: isActive ? (tab.key === 'COMPANY' || tab.key === 'STOCK_AUDIT' ? '#000000' : '#FFFFFF') : '#4B5563'
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          TAB 1: BACKUP DATA
          ========================================================================= */}
      {activeSubTab === 'BACKUP' && (
        <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '24px' }}>
          {/* Date Range Selector: "This Month" and "Custom" */}
          <div
            style={{
              background: '#F9FAFB',
              border: '1.5px solid #D1D5DB',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setBackupDateMode('THIS_MONTH')}
                  style={{
                    padding: '5px 16px',
                    borderRadius: '20px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    border: backupDateMode === 'THIS_MONTH' ? '1.5px solid #002B99' : '1px solid #D1D5DB',
                    background: backupDateMode === 'THIS_MONTH' ? '#002B99' : '#FFFFFF',
                    color: backupDateMode === 'THIS_MONTH' ? '#FFFFFF' : '#374151'
                  }}
                >
                  This Month ({formatDateToDisplay(firstOfMonthStr)} to {formatDateToDisplay(todayStr)})
                </button>

                <button
                  type="button"
                  onClick={() => setBackupDateMode('CUSTOM')}
                  style={{
                    padding: '5px 16px',
                    borderRadius: '20px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    border: backupDateMode === 'CUSTOM' ? '1.5px solid #002B99' : '1px solid #D1D5DB',
                    background: backupDateMode === 'CUSTOM' ? '#002B99' : '#FFFFFF',
                    color: backupDateMode === 'CUSTOM' ? '#FFFFFF' : '#374151'
                  }}
                >
                  Custom Date Range
                </button>
              </div>

              {/* Preset Buttons */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setBackupPreset('ALL')}
                  style={{ background: '#FFFFFF', border: '1px solid #002B99', color: '#002B99', borderRadius: '12px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setBackupPreset('REPORT')}
                  style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '12px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Report Only
                </button>
                <button
                  type="button"
                  onClick={() => setBackupPreset('DASHBOARD')}
                  style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '12px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Dashboard Only
                </button>
                <button
                  type="button"
                  onClick={() => setBackupPreset('REPORT_DASHBOARD')}
                  style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '12px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Report + Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setBackupPreset('CLEAR')}
                  style={{ background: '#FFFFFF', border: '1px solid #EF4444', color: '#DC2626', borderRadius: '12px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Custom Date Pickers */}
            {backupDateMode === 'CUSTOM' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', paddingTop: '6px', borderTop: '1px dashed #E5E7EB' }}>
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

          {/* Grouped Modules matching Left Nav Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
            {/* 1. OPERATIONS */}
            <div>
              <div className="pill-header-lime" style={{ fontSize: '0.88rem', padding: '4px 16px', display: 'inline-block', marginBottom: '8px' }}>
                DASHBOARD / OPERATIONS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {renderModuleCard('order', 'ORDER', pendingOrderCount, backupModules, setBackupModules)}
                {renderModuleCard('orderedSection', 'ORDERED SECTION', placedOrdersCount, backupModules, setBackupModules)}
                {renderModuleCard('purchase', 'PURCHASE', purchasesCount, backupModules, setBackupModules)}
                {renderModuleCard('sale', 'SALE', salesCount, backupModules, setBackupModules)}
                {renderModuleCard('selfUse', 'SELF USE', selfUseCount, backupModules, setBackupModules)}
              </div>
            </div>

            {/* 2. MASTERS */}
            <div>
              <div className="pill-header-lime" style={{ fontSize: '0.88rem', padding: '4px 16px', display: 'inline-block', marginBottom: '8px' }}>
                MASTERS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {renderModuleCard('party', 'PARTY', partiesCount, backupModules, setBackupModules)}
                {renderModuleCard('item', 'ITEM', itemsCount, backupModules, setBackupModules)}
                {renderModuleCard('supplier', 'SUPPLIER', suppliersCount, backupModules, setBackupModules)}
                {renderModuleCard('openingStock', 'OPENING STOCK', openingStockCount, backupModules, setBackupModules)}
              </div>
            </div>

            {/* 3. REPORT */}
            <div>
              <div className="pill-header-lime" style={{ fontSize: '0.88rem', padding: '4px 16px', display: 'inline-block', marginBottom: '8px' }}>
                REPORT
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {renderModuleCard('reportSales', 'SALES', salesCount, backupModules, setBackupModules)}
                {renderModuleCard('reportPurchases', 'PURCHASES', purchasesCount, backupModules, setBackupModules)}
                {renderModuleCard('reportSelfUse', 'SELF USE', selfUseCount, backupModules, setBackupModules)}
                {renderModuleCard('reportItemStock', 'ITEM STOCK', itemStockCount, backupModules, setBackupModules)}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', borderTop: '1.5px dashed #D1D5DB', paddingTop: '18px' }}>
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
      )}

      {/* =========================================================================
          TAB 2: RESTORE DATA
          ========================================================================= */}
      {activeSubTab === 'RESTORE' && (
        <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '24px' }}>
          {/* File Upload Box */}
          <div
            style={{
              border: '2px dashed #6366F1',
              borderRadius: '12px',
              padding: '30px',
              textAlign: 'center',
              background: '#F5F3FF',
              cursor: 'pointer',
              marginBottom: '20px'
            }}
          >
            <Upload size={36} color="#6366F1" style={{ margin: '0 auto 10px auto' }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: '#1E1B4B', fontWeight: 800 }}>
              Choose or Drag & Drop Backup JSON File
            </h4>
            <label
              style={{
                background: '#6366F1',
                color: '#FFFFFF',
                padding: '8px 24px',
                borderRadius: '20px',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '10px'
              }}
            >
              <FileCode size={16} />
              Browse Backup File (.json)
              <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>

          {/* File Inspection / Preview Details */}
          {restoreParsedData && (
            <div
              style={{
                background: '#F0FDF4',
                border: '1.5px solid #86EFAC',
                borderRadius: '10px',
                padding: '18px',
                marginBottom: '20px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={20} color="#15803D" />
                  <span style={{ fontWeight: 900, color: '#166534', fontSize: '1rem' }}>
                    Backup File: {restoreFileName} ({restoreFileSize})
                  </span>
                </div>
                <span style={{ fontSize: '0.78rem', background: '#DCFCE7', color: '#166534', padding: '3px 10px', borderRadius: '12px', fontWeight: 800 }}>
                  Ready to Restore
                </span>
              </div>

              {/* Table of records found in file */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                {[
                  { label: 'Items Master', val: restoreParsedData.items?.length ?? 0 },
                  { label: 'Parties', val: restoreParsedData.parties?.length ?? 0 },
                  { label: 'Suppliers', val: restoreParsedData.suppliers?.length ?? 0 },
                  { label: 'Orders', val: restoreParsedData.orders?.length ?? 0 },
                  { label: 'Sales Invoices', val: restoreParsedData.sales?.length ?? 0 },
                  { label: 'Purchases', val: restoreParsedData.purchases?.length ?? 0 },
                  { label: 'Self Uses', val: restoreParsedData.selfUses?.length ?? 0 },
                  { label: 'Stock Adjustments', val: restoreParsedData.stockAdjustments?.length ?? 0 }
                ].map(stat => (
                  <div key={stat.label} style={{ background: '#FFFFFF', padding: '8px 12px', borderRadius: '6px', border: '1px solid #BBF7D0' }}>
                    <div style={{ fontSize: '0.75rem', color: '#4B5563', fontWeight: 700 }}>{stat.label}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#166534' }}>{stat.val} records</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsRestoreConfirmOpen(true)}
                  style={{
                    backgroundColor: '#6366F1',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 'var(--radius-pill)',
                    padding: '10px 28px',
                    fontWeight: 900,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 6px rgba(99,102,241,0.3)'
                  }}
                >
                  <Upload size={18} />
                  Restore Database from Selected Backup
                </button>
              </div>
            </div>
          )}

          {restoreParseError && (
            <div style={{ background: '#FEF2F2', border: '1.5px solid #FCA5A5', color: '#991B1B', padding: '14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={20} />
              <span style={{ fontWeight: 700 }}>{restoreParseError}</span>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: DELETE DATA
          ========================================================================= */}
      {activeSubTab === 'DELETE' && (
        <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '24px' }}>
          {/* Date Range Selector for Deletion */}
          <div
            style={{
              background: '#F9FAFB',
              border: '1.5px solid #D1D5DB',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setDeleteDateMode('THIS_MONTH')}
                  style={{
                    padding: '5px 16px',
                    borderRadius: '20px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    border: deleteDateMode === 'THIS_MONTH' ? '1.5px solid #B91C1C' : '1px solid #D1D5DB',
                    background: deleteDateMode === 'THIS_MONTH' ? '#B91C1C' : '#FFFFFF',
                    color: deleteDateMode === 'THIS_MONTH' ? '#FFFFFF' : '#374151'
                  }}
                >
                  This Month ({formatDateToDisplay(firstOfMonthStr)} to {formatDateToDisplay(todayStr)})
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteDateMode('CUSTOM')}
                  style={{
                    padding: '5px 16px',
                    borderRadius: '20px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    border: deleteDateMode === 'CUSTOM' ? '1.5px solid #B91C1C' : '1px solid #D1D5DB',
                    background: deleteDateMode === 'CUSTOM' ? '#B91C1C' : '#FFFFFF',
                    color: deleteDateMode === 'CUSTOM' ? '#FFFFFF' : '#374151'
                  }}
                >
                  Custom Date Range
                </button>
              </div>

              {/* Preset Buttons for Delete */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setDeletePreset('ALL')}
                  style={{ background: '#FFFFFF', border: '1px solid #DC2626', color: '#DC2626', borderRadius: '12px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setDeletePreset('REPORT')}
                  style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '12px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Report Only
                </button>
                <button
                  type="button"
                  onClick={() => setDeletePreset('DASHBOARD')}
                  style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '12px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Dashboard Only
                </button>
                <button
                  type="button"
                  onClick={() => setDeletePreset('REPORT_DASHBOARD')}
                  style={{ background: '#FFFFFF', border: '1px solid #002B99', color: '#002B99', borderRadius: '12px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Report + Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setDeletePreset('CLEAR')}
                  style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '12px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Custom Date Pickers for Deletion */}
            {deleteDateMode === 'CUSTOM' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', paddingTop: '6px', borderTop: '1px dashed #E5E7EB' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#4B5563' }}>From Date:</label>
                  <input
                    type="date"
                    className="input-text-clean"
                    value={deleteFromDate}
                    onChange={e => setDeleteFromDate(e.target.value)}
                    style={{ width: '150px', padding: '5px 10px', fontSize: '0.88rem' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#4B5563' }}>To Date:</label>
                  <input
                    type="date"
                    className="input-text-clean"
                    value={deleteToDate}
                    onChange={e => setDeleteToDate(e.target.value)}
                    style={{ width: '150px', padding: '5px 10px', fontSize: '0.88rem' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Grouped Modules matching Left Nav Sidebar (Masters OFF by default) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
            {/* 1. OPERATIONS */}
            <div>
              <div className="pill-header-lime" style={{ fontSize: '0.88rem', padding: '4px 16px', display: 'inline-block', marginBottom: '8px' }}>
                DASHBOARD / OPERATIONS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {renderModuleCard('order', 'ORDER', pendingOrderCount, deleteModules, setDeleteModules)}
                {renderModuleCard('orderedSection', 'ORDERED SECTION', placedOrdersCount, deleteModules, setDeleteModules)}
                {renderModuleCard('purchase', 'PURCHASE', deletePreviewCounts.purchases, deleteModules, setDeleteModules)}
                {renderModuleCard('sale', 'SALE', deletePreviewCounts.sales, deleteModules, setDeleteModules)}
                {renderModuleCard('selfUse', 'SELF USE', deletePreviewCounts.selfUse, deleteModules, setDeleteModules)}
              </div>
            </div>

            {/* 2. MASTERS (OFF BY DEFAULT) */}
            <div>
              <div className="pill-header-lime" style={{ fontSize: '0.88rem', padding: '4px 16px', display: 'inline-block', marginBottom: '8px' }}>
                MASTERS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {renderModuleCard('party', 'PARTY', deletePreviewCounts.parties, deleteModules, setDeleteModules, true)}
                {renderModuleCard('item', 'ITEM', deletePreviewCounts.items, deleteModules, setDeleteModules, true)}
                {renderModuleCard('supplier', 'SUPPLIER', deletePreviewCounts.suppliers, deleteModules, setDeleteModules, true)}
                {renderModuleCard('openingStock', 'OPENING STOCK', deletePreviewCounts.openingStock, deleteModules, setDeleteModules, true)}
              </div>
            </div>

            {/* 3. REPORT */}
            <div>
              <div className="pill-header-lime" style={{ fontSize: '0.88rem', padding: '4px 16px', display: 'inline-block', marginBottom: '8px' }}>
                REPORT
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {renderModuleCard('reportSales', 'SALES', deletePreviewCounts.sales, deleteModules, setDeleteModules)}
                {renderModuleCard('reportPurchases', 'PURCHASES', deletePreviewCounts.purchases, deleteModules, setDeleteModules)}
                {renderModuleCard('reportSelfUse', 'SELF USE', deletePreviewCounts.selfUse, deleteModules, setDeleteModules)}
                {renderModuleCard('reportItemStock', 'ITEM STOCK', deletePreviewCounts.adjustments, deleteModules, setDeleteModules)}
              </div>
            </div>
          </div>

          {/* Action Buttons for Delete */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', borderTop: '1.5px dashed #D1D5DB', paddingTop: '18px' }}>
            <button
              type="button"
              disabled={deletePreviewCounts.total === 0}
              onClick={() => setIsDeleteConfirmOpen(true)}
              style={{
                backgroundColor: deletePreviewCounts.total > 0 ? '#EA3943' : '#D1D5DB',
                color: '#FFFFFF',
                border: deletePreviewCounts.total > 0 ? '2px solid #991B1B' : '1px solid #9CA3AF',
                borderRadius: 'var(--radius-pill)',
                padding: '10px 28px',
                fontWeight: 900,
                fontSize: '0.98rem',
                cursor: deletePreviewCounts.total > 0 ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: deletePreviewCounts.total > 0 ? '0 2px 6px rgba(234,57,67,0.3)' : 'none'
              }}
            >
              <Trash2 size={18} />
              <span>Delete Selected Data ({deletePreviewCounts.total} Records)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsResetConfirmOpen(true)}
              style={{
                background: '#FEE2E2',
                color: '#991B1B',
                border: '1px solid #F87171',
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
              <RotateCcw size={15} />
              Reset Entire Database to Default Sample Data
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: COMPANY PROFILE
          ========================================================================= */}
      {activeSubTab === 'COMPANY' && (
        <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', marginBottom: '16px', color: '#002B99' }}>
            Company & Document Profile
          </h3>

          <form onSubmit={handleSaveCompanyProfile} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
                Business Name *
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={formData.companyName}
                onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                required
                style={{ fontWeight: 800 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
                Address
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
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
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
                  GSTIN
                </label>
                <input
                  type="text"
                  className="input-text-clean"
                  value={formData.gstin}
                  onChange={e => setFormData({ ...formData, gstin: e.target.value })}
                  style={{ fontFamily: 'monospace', fontWeight: 700 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
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
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
                  Purchase Bill Prefix
                </label>
                <input
                  type="text"
                  className="input-text-clean"
                  value={formData.purchasePrefix}
                  onChange={e => setFormData({ ...formData, purchasePrefix: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
                  Default GST %
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  className="input-text-clean"
                  value={formData.defaultGstPercent || 18}
                  onChange={e => setFormData({ ...formData, defaultGstPercent: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            <button type="submit" className="btn-lime-action" style={{ alignSelf: 'flex-start', marginTop: '10px', padding: '10px 24px', fontSize: '0.92rem' }}>
              <Save size={16} />
              Save Company Profile
            </button>
          </form>
        </div>
      )}

      {/* =========================================================================
          TAB 5: STOCK AUDIT
          ========================================================================= */}
      {activeSubTab === 'STOCK_AUDIT' && (
        <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', marginBottom: '16px', color: '#002B99' }}>
            Physical Stock Adjustment & Audit
          </h3>

          <form onSubmit={handleStockAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
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
                style={{ fontWeight: 700 }}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#F3F4F6', padding: '12px', borderRadius: '8px', border: '1px solid #D1D5DB' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 700 }}>System Recorded Stock:</span>
                  <div style={{ fontWeight: 900, fontSize: '1.2rem' }}>{selectedItemCurrentStock}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 700 }}>Difference:</span>
                  <div style={{ fontWeight: 900, fontSize: '1.2rem', color: Number(countedStock) - selectedItemCurrentStock >= 0 ? '#15803D' : '#EA3943' }}>
                    {Number(countedStock) - selectedItemCurrentStock >= 0 ? `+${Number(countedStock) - selectedItemCurrentStock}` : Number(countedStock) - selectedItemCurrentStock}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
                Actual Counted Physical Stock *
              </label>
              <input
                type="number"
                step="any"
                min="0"
                className="input-text-clean"
                value={countedStock}
                onChange={e => setCountedStock(e.target.value)}
                required
                style={{ fontWeight: 800, fontSize: '1rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
                Reason / Audit Note
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={adjReason}
                onChange={e => setAdjReason(e.target.value)}
                placeholder="e.g. Damaged rolls, Physical stock recount audit"
              />
            </div>

            <button type="submit" className="btn-red-action" style={{ alignSelf: 'flex-start', marginTop: '10px', padding: '10px 24px', fontSize: '0.92rem' }}>
              Record Adjustment
            </button>
          </form>
        </div>
      )}

      {/* Confirmation Dialog: Restore Database */}
      <ConfirmDialog
        isOpen={isRestoreConfirmOpen}
        onClose={() => setIsRestoreConfirmOpen(false)}
        onConfirm={executeRestore}
        title="Confirm Database Restore"
        message="Are you sure you want to restore the database from this backup file? Existing records will be updated with the contents of the archive."
      />

      {/* Confirmation Dialog: Delete Selected Data */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={executeDelete}
        title="Permanently Delete Selected Data"
        message={`Are you sure you want to permanently delete ${deletePreviewCounts.total} record(s) matching selected modules for ${deleteDateMode === 'THIS_MONTH' ? 'This Month' : `${formatDateToDisplay(deleteFromDate)} to ${formatDateToDisplay(deleteToDate)}`}? This action cannot be reversed.`}
      />

      {/* Confirmation Dialog: Reset Database */}
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
