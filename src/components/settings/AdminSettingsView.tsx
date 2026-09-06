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
  Building2,
  SlidersHorizontal,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Zap
} from 'lucide-react';
import { getTodayDateString, formatDateToDisplay } from '../../utils/dateUtils';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ExportFilterOptions } from '../../utils/exportUtils';
import {
  downloadCompleteExcelBackup,
  inspectExcelBackup,
  restoreDatabaseFromExcel,
  importItemsFromExcel,
  loadBundledMaterialsCatalog,
  ExcelRestorePreview,
  ExcelImportResult
} from '../../utils/excelEngine';
import * as XLSX from 'xlsx';

type AdminTab = 'COMPANY' | 'STOCK_AUDIT' | 'BACKUP' | 'RESTORE' | 'EXCEL_IMPORT' | 'DELETE';

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
  const { settings, updateSettings, refreshKey, showToast, showAlert } = useApp();
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

  // Cloud Firestore Handlers & State
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [isPullingCloud, setIsPullingCloud] = useState(false);
  const [showRulesInfo, setShowRulesInfo] = useState(false);
  const [isRulesCopied, setIsRulesCopied] = useState(false);

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

  // --- EXCEL RESTORE STATE ---
  const [restoreBuffer, setRestoreBuffer] = useState<ArrayBuffer | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string>('');
  const [restoreFileSize, setRestoreFileSize] = useState<string>('');
  const [restoreExcelPreview, setRestoreExcelPreview] = useState<ExcelRestorePreview | null>(null);
  const [restoreParseError, setRestoreParseError] = useState<string | null>(null);

  // --- EXCEL IMPORT ITEMS STATE ---
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBuffer, setImportBuffer] = useState<ArrayBuffer | null>(null);
  const [importPreviewRows, setImportPreviewRows] = useState<any[]>([]);
  const [importPreviewCols, setImportPreviewCols] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ExcelImportResult | null>(null);

  // --- DELETE STATE ---
  const [deleteDateMode, setDeleteDateMode] = useState<'ALL_TIME' | 'THIS_MONTH' | 'CUSTOM'>('ALL_TIME');
  const [deleteFromDate, setDeleteFromDate] = useState(firstOfMonthStr);
  const [deleteToDate, setDeleteToDate] = useState(todayStr);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPurgingA2, setIsPurgingA2] = useState(false);

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
  const deleteEffectiveFrom = deleteDateMode === 'ALL_TIME' ? '1970-01-01' : (deleteDateMode === 'THIS_MONTH' ? firstOfMonthStr : deleteFromDate);
  const deleteEffectiveTo = deleteDateMode === 'ALL_TIME' ? '2099-12-31' : (deleteDateMode === 'THIS_MONTH' ? todayStr : deleteToDate);

  const deletePreviewCounts = useMemo(() => {
    const options: DeleteFilterOptions = {
      fromDate: deleteEffectiveFrom,
      toDate: deleteEffectiveTo,
      isCustomDate: deleteDateMode === 'CUSTOM',
      isAllTime: deleteDateMode === 'ALL_TIME',
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
        item: true,
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
      setDeleteDateMode('ALL_TIME');
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
    showToast('Company settings & numbering rules updated!', 'success');
  };

  // Cloud Firestore Handlers
  const handlePushToCloud = async () => {
    setIsSyncingCloud(true);
    try {
      const ok = await db.pushAllToCloudFirestore();
      if (ok) {
        showToast('Cloud Firestore: All local records synced & uploaded to cloud!', 'success');
      } else {
        showToast('Notice: Could not push to Firestore. Check network and security rules.', 'error');
      }
    } catch (err: any) {
      showToast(`Cloud Sync Error: ${err.message}`, 'error');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handlePullFromCloud = async () => {
    setIsPullingCloud(true);
    try {
      const res = await db.pullAllFromCloudFirestore();
      if (res.success) {
        const total = Object.values(res.stats).reduce((a, b) => a + b, 0);
        showToast(`Cloud Firestore: Successfully downloaded ${total} records from cloud!`, 'success');
      } else {
        showToast(`Cloud Pull Failed: ${res.error || 'Check Firestore connection'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Cloud Pull Error: ${err.message}`, 'error');
    } finally {
      setIsPullingCloud(false);
    }
  };

  const handleCopySecurityRules = () => {
    const rules = `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}`;
    navigator.clipboard.writeText(rules);
    setIsRulesCopied(true);
    setTimeout(() => setIsRulesCopied(false), 2500);
    showToast('Firestore Security Rules copied to clipboard!', 'info');
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

  const handleDownloadExcelOnly = () => {
    const hasAny = Object.values(backupModules).some(Boolean);
    if (!hasAny) {
      showToast('Please select at least one module to backup', 'error');
      return;
    }
    downloadCompleteExcelBackup(getExportOptions());
    showToast('Complete Excel workbook (.xlsx) backup downloaded successfully!', 'success');
  };

  // Excel Restore File Upload & Inspection
  const handleExcelRestoreUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFileName(file.name);
    setRestoreFileSize(`${(file.size / 1024).toFixed(1)} KB`);
    setRestoreParseError(null);

    const reader = new FileReader();
    reader.onload = event => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        setRestoreBuffer(buffer);
        const preview = inspectExcelBackup(buffer);
        if (preview.isValidBackup) {
          setRestoreExcelPreview(preview);
          showToast(`Excel backup "${file.name}" loaded for inspection.`, 'info');
        } else {
          setRestoreExcelPreview(null);
          setRestoreParseError('The uploaded file is not a valid RMMS multi-sheet Excel backup workbook.');
          showToast('Invalid Excel backup workbook.', 'error');
        }
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const executeExcelRestore = () => {
    if (!restoreBuffer) {
      showToast('Please select an Excel backup workbook first', 'error');
      return;
    }
    const res = restoreDatabaseFromExcel(restoreBuffer);
    setIsRestoreConfirmOpen(false);
    if (res.success) {
      const total = Object.values(res.restoredCounts).reduce((a, b) => a + b, 0);
      showToast(`Database restored successfully from Excel workbook (${total} records restored)!`, 'success');
      setRestoreBuffer(null);
      setRestoreExcelPreview(null);
      setRestoreFileName('');
    } else {
      showToast(`Failed to restore: ${res.error}`, 'error');
    }
  };

  // Bulk Item Import from Excel Tab Handlers
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = event => {
      const buffer = event.target?.result as ArrayBuffer;
      if (buffer) {
        setImportBuffer(buffer);
        try {
          const wb = XLSX.read(buffer, { type: 'array' });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          const rows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
          if (rows.length > 0) {
            setImportPreviewCols(Object.keys(rows[0]));
            setImportPreviewRows(rows.slice(0, 8));
          } else {
            setImportPreviewCols([]);
            setImportPreviewRows([]);
          }
        } catch (err: any) {
          showAlert(`Failed to read file: ${err.message}`, 'File Read Error', 'error');
        }
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleExecuteBulkItemImport = () => {
    if (!importBuffer) {
      showToast('Please select an Excel file to import', 'error');
      return;
    }
    setIsImporting(true);
    try {
      const res = importItemsFromExcel(importBuffer);
      setImportResult(res);
      showToast(`Imported ${res.importedCount} items and created ${res.createdSuppliersCount} suppliers!`, 'success');
    } catch (err: any) {
      showAlert(`Import failed: ${err.message}`, 'Import Error', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleLoadBundledCatalog = async () => {
    setIsImporting(true);
    try {
      const res = await loadBundledMaterialsCatalog();
      setImportResult(res);
      showToast(`Successfully loaded and imported ${res.importedCount} materials and ${res.createdSuppliersCount} suppliers from ITEM.xls!`, 'success');
    } catch (err: any) {
      showAlert(`Failed to load materials catalog: ${err.message}`, 'Load Error', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadSampleTemplate = () => {
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

  // Delete Data Execution
  const executeDelete = async () => {
    const hasAny = Object.values(deleteModules).some(Boolean);
    if (!hasAny) {
      showToast('Please select at least one module to delete', 'error');
      return;
    }

    setIsDeleting(true);
    setIsDeleteConfirmOpen(false);
    showToast('Deleting selected data from Cloud Firestore & local state...', 'info');

    try {
      const options: DeleteFilterOptions = {
        fromDate: deleteEffectiveFrom,
        toDate: deleteEffectiveTo,
        isCustomDate: deleteDateMode === 'CUSTOM',
        isAllTime: deleteDateMode === 'ALL_TIME',
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

      const deletedCounts = await db.deleteDataByFilter(options);
      const total = Object.values(deletedCounts).reduce((acc, c) => acc + c, 0);
      showToast(`Successfully deleted ${total} records from Cloud Firestore & local database.`, 'success');
    } catch (e: any) {
      showToast(`Failed to delete data: ${e.message}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePurgeA2 = async () => {
    setIsPurgingA2(true);
    try {
      const res = await db.purgeOrphanedTestItems();
      showToast(`Purged ${res.purgedCount} test artifacts (A2222) from Cloud Firestore & local state!`, 'success');
    } catch (e: any) {
      showToast(`Error purging test item: ${e.message}`, 'error');
    } finally {
      setIsPurgingA2(false);
    }
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
            { key: 'BACKUP', label: 'Excel Backup', icon: Download },
            { key: 'RESTORE', label: 'Excel Restore', icon: Upload },
            { key: 'EXCEL_IMPORT', label: 'Import Items', icon: FileSpreadsheet },
            { key: 'DELETE', label: 'Selective Deletion', icon: Trash2 },
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
                  background: isActive ? (tab.key === 'DELETE' ? '#EA3943' : tab.key === 'BACKUP' ? '#10B981' : tab.key === 'RESTORE' || tab.key === 'EXCEL_IMPORT' ? '#6366F1' : '#E2D2F8') : 'transparent',
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
          TAB 1: BACKUP DATA (EXCEL ONLY)
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
              onClick={handleDownloadExcelOnly}
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
              <FileSpreadsheet size={18} />
              <span>Download Multi-Sheet Excel Backup (.xlsx)</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: RESTORE DATA (EXCEL WORKBOOK RESTORE)
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
            <FileSpreadsheet size={36} color="#6366F1" style={{ margin: '0 auto 10px auto' }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: '#1E1B4B', fontWeight: 800 }}>
              Choose or Drag & Drop Backup Excel Workbook (.xlsx / .xls)
            </h4>
            <p style={{ margin: '0 0 10px', fontSize: '0.82rem', color: '#6B7280' }}>
              Restores all multi-sheet items, masters, sales, purchases, and orders directly into your system.
            </p>
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
                marginTop: '6px'
              }}
            >
              <Upload size={16} />
              Browse Excel Backup File (.xlsx)
              <input type="file" accept=".xlsx, .xls" onChange={handleExcelRestoreUpload} style={{ display: 'none' }} />
            </label>
          </div>

          {/* File Inspection / Preview Details */}
          {restoreExcelPreview && (
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
                    Excel Backup: {restoreFileName} ({restoreFileSize})
                  </span>
                </div>
                <span style={{ fontSize: '0.78rem', background: '#DCFCE7', color: '#166534', padding: '3px 10px', borderRadius: '12px', fontWeight: 800 }}>
                  Ready to Restore • {restoreExcelPreview.totalRecords} Total Records
                </span>
              </div>

              {/* Table of records found in file */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                {[
                  { label: 'Items Master', val: restoreExcelPreview.itemsCount },
                  { label: 'Parties', val: restoreExcelPreview.partiesCount },
                  { label: 'Suppliers', val: restoreExcelPreview.suppliersCount },
                  { label: 'Orders', val: restoreExcelPreview.ordersCount },
                  { label: 'Sales Invoices', val: restoreExcelPreview.salesCount },
                  { label: 'Purchases', val: restoreExcelPreview.purchasesCount },
                  { label: 'Self Uses', val: restoreExcelPreview.selfUseCount }
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
                  Restore Database from Excel Workbook
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
          TAB 3: BULK IMPORT ITEMS (4-COLUMN EXCEL SHEET)
          ========================================================================= */}
      {activeSubTab === 'EXCEL_IMPORT' && (
        <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.15rem', color: '#002B99' }}>
                📥 Bulk Item Importer (4-Column Excel Sheet)
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748B' }}>
                Upload an Excel sheet containing your 569 materials. Columns: <strong>Item</strong>, <strong>Category</strong>, <strong>Supplier</strong>, <strong>Base Price</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadSampleTemplate}
              style={{
                background: '#F8FAFC',
                color: '#2563EB',
                border: '1.5px solid #2563EB',
                borderRadius: '20px',
                padding: '6px 16px',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Download size={15} />
              Download Sample 4-Column Template
            </button>
          </div>

          {/* 1-Click Load Pre-Bundled Catalog */}
          <div style={{ background: 'linear-gradient(135deg, #ECFDF5 0%, #DCFCE7 100%)', border: '2px solid #10B981', borderRadius: '10px', padding: '14px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
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
              disabled={isImporting}
              style={{
                background: '#059669',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '20px',
                padding: '8px 20px',
                fontWeight: 900,
                fontSize: '0.85rem',
                cursor: isImporting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(5,150,105,0.3)',
                whiteSpace: 'nowrap'
              }}
            >
              {isImporting ? <RefreshCw size={15} className="spin" /> : <Zap size={15} />}
              ⚡ 1-Click Load 569 Materials
            </button>
          </div>

          {!importFile ? (
            <div
              style={{
                border: '2px dashed #93C5FD',
                borderRadius: '12px',
                padding: '36px 20px',
                textAlign: 'center',
                background: '#F0FDF4',
                cursor: 'pointer',
                marginBottom: '16px'
              }}
            >
              <FileSpreadsheet size={40} color="#16A34A" style={{ margin: '0 auto 10px auto' }} />
              <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: '#166534', fontWeight: 800 }}>
                Upload Materials Excel File (.xlsx / .xls / .csv)
              </h4>
              <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: '#475569' }}>
                Suppliers not present in your system will be created automatically.
              </p>
              <label
                style={{
                  background: '#16A34A',
                  color: '#FFFFFF',
                  padding: '8px 24px',
                  borderRadius: '20px',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Upload size={16} />
                Browse Excel File
                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImportFileChange} style={{ display: 'none' }} />
              </label>
            </div>
          ) : (
            <div style={{ border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '18px', background: '#F8FAFC', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileSpreadsheet size={24} color="#16A34A" />
                  <div>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A' }}>{importFile.name}</span>
                    <span style={{ fontSize: '0.78rem', color: '#64748B', display: 'block' }}>
                      {(importFile.size / 1024).toFixed(1)} KB • Detected Columns: {importPreviewCols.join(', ')}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setImportFile(null); setImportBuffer(null); setImportPreviewRows([]); setImportResult(null); }}
                  style={{ background: '#FFFFFF', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Choose Different File
                </button>
              </div>

              {/* Preview Table */}
              {importPreviewRows.length > 0 && (
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #CBD5E1', borderRadius: '6px', background: '#FFFFFF' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: '#E2E8F0', borderBottom: '1px solid #CBD5E1', textAlign: 'left' }}>
                        {importPreviewCols.map((col, i) => (
                          <th key={i} style={{ padding: '6px 10px', fontWeight: 800, color: '#334155' }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreviewRows.map((r, rIdx) => (
                        <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          {importPreviewCols.map((col, cIdx) => (
                            <td key={cIdx} style={{ padding: '6px 10px', color: '#1E293B' }}>{String(r[col] ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {importResult && (
                <div style={{ marginTop: '14px', background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '8px', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <CheckCircle2 size={18} color="#16A34A" />
                    <span style={{ fontWeight: 900, color: '#166534', fontSize: '0.92rem' }}>
                      Import Completed Successfully!
                    </span>
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#15803D' }}>
                    ✓ <strong>{importResult.importedCount}</strong> items imported/updated.<br />
                    ✓ <strong>{importResult.createdSuppliersCount}</strong> new suppliers automatically created.
                  </div>
                </div>
              )}

              {!importResult && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                  <button
                    type="button"
                    onClick={handleExecuteBulkItemImport}
                    disabled={isImporting}
                    style={{
                      background: isImporting ? '#93C5FD' : '#16A34A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '20px',
                      padding: '8px 24px',
                      fontWeight: 800,
                      cursor: isImporting ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {isImporting ? <RefreshCw size={16} className="spin" /> : <Upload size={16} />}
                    {isImporting ? 'Importing Materials...' : 'Confirm & Import All Items'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: SELECTIVE DATA DELETION
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
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setDeleteDateMode('ALL_TIME')}
                  style={{
                    padding: '5px 16px',
                    borderRadius: '20px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    border: deleteDateMode === 'ALL_TIME' ? '1.5px solid #DC2626' : '1px solid #D1D5DB',
                    background: deleteDateMode === 'ALL_TIME' ? '#DC2626' : '#FFFFFF',
                    color: deleteDateMode === 'ALL_TIME' ? '#FFFFFF' : '#374151'
                  }}
                >
                  ⚡ All Time (Complete History)
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteDateMode('THIS_MONTH')}
                  style={{
                    padding: '5px 16px',
                    borderRadius: '20px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    border: deleteDateMode === 'THIS_MONTH' ? '1.5px solid #002B99' : '1px solid #D1D5DB',
                    background: deleteDateMode === 'THIS_MONTH' ? '#002B99' : '#FFFFFF',
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
                    border: deleteDateMode === 'CUSTOM' ? '1.5px solid #002B99' : '1px solid #D1D5DB',
                    background: deleteDateMode === 'CUSTOM' ? '#002B99' : '#FFFFFF',
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
                  style={{ background: '#FEE2E2', border: '1.5px solid #DC2626', color: '#DC2626', borderRadius: '12px', padding: '4px 12px', fontSize: '0.78rem', fontWeight: 900, cursor: 'pointer' }}
                >
                  Select All (Complete Cleanup)
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

          {/* Grouped Modules matching Left Nav Sidebar */}
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
              disabled={deletePreviewCounts.total === 0 || isDeleting}
              onClick={() => setIsDeleteConfirmOpen(true)}
              style={{
                backgroundColor: deletePreviewCounts.total > 0 && !isDeleting ? '#EA3943' : '#D1D5DB',
                color: '#FFFFFF',
                border: deletePreviewCounts.total > 0 && !isDeleting ? '2px solid #991B1B' : '1px solid #9CA3AF',
                borderRadius: 'var(--radius-pill)',
                padding: '10px 28px',
                fontWeight: 900,
                fontSize: '0.98rem',
                cursor: deletePreviewCounts.total > 0 && !isDeleting ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: deletePreviewCounts.total > 0 && !isDeleting ? '0 2px 6px rgba(234,57,67,0.3)' : 'none'
              }}
            >
              {isDeleting ? <RefreshCw className="animate-spin" size={18} /> : <Trash2 size={18} />}
              <span>{isDeleting ? 'Deleting from Cloud Firestore...' : `Delete Selected Data (${deletePreviewCounts.total} Records)`}</span>
            </button>

            <button
              type="button"
              disabled={isPurgingA2}
              onClick={handlePurgeA2}
              style={{
                background: '#FEF3C7',
                color: '#92400E',
                border: '1.5px solid #F59E0B',
                borderRadius: 'var(--radius-pill)',
                padding: '9px 20px',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: isPurgingA2 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isPurgingA2 ? <RefreshCw className="animate-spin" size={15} /> : <Zap size={15} />}
              <span>{isPurgingA2 ? 'Purging A2222...' : 'Clean & Purge "A2222" Test Artifacts'}</span>
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
          TAB 5: COMPANY PROFILE & DOCUMENT NUMBERING PATTERNS
          ========================================================================= */}
      {activeSubTab === 'COMPANY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '850px', margin: '0 auto' }}>
          
          {/* Cloud Firestore Sync Card */}
          <div style={{ background: '#EFF6FF', border: '2px solid #3B82F6', borderRadius: '12px', padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#3B82F6', color: '#FFFFFF', padding: '10px', borderRadius: '10px', display: 'flex' }}>
                  <Cloud size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 style={{ margin: 0, fontWeight: 900, fontSize: '1.05rem', color: '#1E3A8A' }}>
                      Cloud Firestore Real-Time Live Sync
                    </h4>
                    <span style={{ fontSize: '0.72rem', background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>
                      ⚡ Live Auto-Sync Active
                    </span>
                    <span style={{ fontSize: '0.72rem', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                      acl-inventory-mange-final
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: '2px', fontWeight: 600 }}>
                    ⚡ Real-time automatic sync: Any change on any device syncs instantly across all computers without clicking anything!
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handlePushToCloud}
                  disabled={isSyncingCloud}
                  style={{
                    background: isSyncingCloud ? '#93C5FD' : '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '20px',
                    padding: '8px 18px',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    cursor: isSyncingCloud ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <RefreshCw size={14} className={isSyncingCloud ? 'spin' : ''} />
                  <span>{isSyncingCloud ? 'Uploading...' : '☁️ Push Local Data to Cloud'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePullFromCloud}
                  disabled={isPullingCloud}
                  style={{
                    background: '#FFFFFF',
                    color: '#2563EB',
                    border: '1.5px solid #2563EB',
                    borderRadius: '20px',
                    padding: '8px 18px',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    cursor: isPullingCloud ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Download size={14} />
                  <span>{isPullingCloud ? 'Downloading...' : '📥 Pull Cloud Data'}</span>
                </button>
              </div>
            </div>

            {/* Expandable Firebase Security Rules Guidance */}
            <div style={{ borderTop: '1px solid #BFDBFE', paddingTop: '10px' }}>
              <div
                onClick={() => setShowRulesInfo(!showRulesInfo)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', color: '#1E40AF', fontSize: '0.82rem', fontWeight: 800 }}
              >
                <span>Need help with Firestore Permissions / Security Rules? Click here</span>
                {showRulesInfo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>

              {showRulesInfo && (
                <div style={{ marginTop: '10px', background: '#FFFFFF', border: '1px solid #93C5FD', borderRadius: '8px', padding: '12px' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: '#334155' }}>
                    If you get a <em>Permission Denied</em> error in the browser console, paste the following rules in your <strong>Firebase Console &gt; Firestore Database &gt; Rules</strong>:
                  </p>
                  <pre style={{ background: '#1E293B', color: '#F8FAFC', padding: '10px', borderRadius: '6px', fontSize: '0.78rem', overflowX: 'auto', margin: 0 }}>
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
                  </pre>
                  <button
                    type="button"
                    onClick={handleCopySecurityRules}
                    style={{
                      marginTop: '8px',
                      background: isRulesCopied ? '#DCFCE7' : '#EFF6FF',
                      color: isRulesCopied ? '#166534' : '#1D4ED8',
                      border: '1px solid #93C5FD',
                      borderRadius: '6px',
                      padding: '4px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {isRulesCopied ? <Check size={14} /> : <Copy size={14} />}
                    {isRulesCopied ? 'Copied Rules!' : 'Copy Firestore Rules'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Company Details & Numbering Rules Form */}
          <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', marginBottom: '16px', color: '#002B99' }}>
              Company & Document Profile
            </h3>

            <form onSubmit={handleSaveCompanyProfile} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Business Info Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', color: '#374151' }}>
                  Business Identification
                </h4>
                
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
              </div>

              {/* DOCUMENT NUMBERING & SEQUENCE PATTERN CUSTOMIZER */}
              <div style={{ borderTop: '1.5px solid #E5E7EB', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: 0, fontWeight: 800, fontSize: '0.98rem', color: '#002B99' }}>
                      Document Bill / Invoice Numbering & Sequence Patterns
                    </h4>
                    <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#6B7280' }}>
                      Customize prefixes, starting sequence numbers, and formatting for auto-generated documents.
                    </p>
                  </div>
                </div>

                {/* Pattern 1: Sales Invoices */}
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1E293B' }}>
                      📄 Sales Invoices (Sale Vouchers)
                    </span>
                    <span style={{ fontSize: '0.78rem', background: '#E0E7FF', color: '#3730A3', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                      Preview: {(formData.invoicePrefix ?? 'INV-') + (formData.invoicePadDigits && formData.invoicePadDigits > 0 ? String(formData.invoiceNextNumber ?? 1002).padStart(formData.invoicePadDigits, '0') : String(formData.invoiceNextNumber ?? 1002))}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '2px' }}>Prefix</label>
                      <input
                        type="text"
                        className="input-text-clean"
                        value={formData.invoicePrefix ?? 'INV-'}
                        onChange={e => setFormData({ ...formData, invoicePrefix: e.target.value })}
                        placeholder="e.g. INV- or INV"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '2px' }}>Next Sequence No.</label>
                      <input
                        type="number"
                        min="1"
                        className="input-text-clean"
                        value={formData.invoiceNextNumber ?? 1002}
                        onChange={e => setFormData({ ...formData, invoiceNextNumber: parseInt(e.target.value, 10) || 1 })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '2px' }}>Pad Digits (0=Raw)</label>
                      <input
                        type="number"
                        min="0"
                        max="8"
                        className="input-text-clean"
                        value={formData.invoicePadDigits ?? 0}
                        onChange={e => setFormData({ ...formData, invoicePadDigits: parseInt(e.target.value, 10) || 0 })}
                      />
                    </div>
                  </div>
                </div>

                {/* Pattern 2: Self Use Vouchers */}
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1E293B' }}>
                      🏷️ Self Use Vouchers
                    </span>
                    <span style={{ fontSize: '0.78rem', background: '#FEF3C7', color: '#92400E', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                      Preview: {(formData.selfUsePrefix ?? 'SU-') + (formData.selfUsePadDigits && formData.selfUsePadDigits > 0 ? String(formData.selfUseNextNumber ?? 101).padStart(formData.selfUsePadDigits, '0') : String(formData.selfUseNextNumber ?? 101))}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '2px' }}>Prefix</label>
                      <input
                        type="text"
                        className="input-text-clean"
                        value={formData.selfUsePrefix ?? 'SU-'}
                        onChange={e => setFormData({ ...formData, selfUsePrefix: e.target.value })}
                        placeholder="e.g. SU- or SU"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '2px' }}>Next Sequence No.</label>
                      <input
                        type="number"
                        min="1"
                        className="input-text-clean"
                        value={formData.selfUseNextNumber ?? 101}
                        onChange={e => setFormData({ ...formData, selfUseNextNumber: parseInt(e.target.value, 10) || 1 })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '2px' }}>Pad Digits (0=Raw)</label>
                      <input
                        type="number"
                        min="0"
                        max="8"
                        className="input-text-clean"
                        value={formData.selfUsePadDigits ?? 0}
                        onChange={e => setFormData({ ...formData, selfUsePadDigits: parseInt(e.target.value, 10) || 0 })}
                      />
                    </div>
                  </div>
                </div>

                {/* Pattern 3: Purchase Orders (Ordered Section) */}
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1E293B' }}>
                      📋 Purchase Order Prefix (Ordered Section)
                    </span>
                    <span style={{ fontSize: '0.78rem', background: '#F3E8FF', color: '#6B21A8', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                      Preview: {(formData.orderPrefix ?? 'ORD-') + (formData.orderPadDigits && formData.orderPadDigits > 0 ? String(formData.orderNextNumber ?? 103).padStart(formData.orderPadDigits, '0') : String(formData.orderNextNumber ?? 103))}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '2px' }}>Prefix</label>
                      <input
                        type="text"
                        className="input-text-clean"
                        value={formData.orderPrefix ?? 'ORD-'}
                        onChange={e => setFormData({ ...formData, orderPrefix: e.target.value })}
                        placeholder="e.g. ORD-"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '2px' }}>Next Sequence No.</label>
                      <input
                        type="number"
                        min="1"
                        className="input-text-clean"
                        value={formData.orderNextNumber ?? 103}
                        onChange={e => setFormData({ ...formData, orderNextNumber: parseInt(e.target.value, 10) || 1 })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '2px' }}>Pad Digits (0=Raw)</label>
                      <input
                        type="number"
                        min="0"
                        max="8"
                        className="input-text-clean"
                        value={formData.orderPadDigits ?? 0}
                        onChange={e => setFormData({ ...formData, orderPadDigits: parseInt(e.target.value, 10) || 0 })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn-lime-action" style={{ alignSelf: 'flex-start', marginTop: '10px', padding: '10px 28px', fontSize: '0.95rem' }}>
                <Save size={16} />
                Save Settings & Numbering Patterns
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: STOCK AUDIT
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

      {/* Confirmation Dialog: Restore Database from Excel */}
      <ConfirmDialog
        isOpen={isRestoreConfirmOpen}
        onClose={() => setIsRestoreConfirmOpen(false)}
        onConfirm={executeExcelRestore}
        title="Confirm Database Restore from Excel"
        message={`Are you sure you want to restore the database from this Excel backup workbook (${restoreExcelPreview?.totalRecords || 0} records)? Existing records will be updated with the archive contents.`}
      />

      {/* Confirmation Dialog: Delete Selected Data */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={executeDelete}
        title="Permanently Delete Selected Data"
        message={`Are you sure you want to permanently delete ${deletePreviewCounts.total} record(s) matching selected modules for ${deleteDateMode === 'ALL_TIME' ? 'All Time (Complete History)' : deleteDateMode === 'THIS_MONTH' ? 'This Month' : `${formatDateToDisplay(deleteFromDate)} to ${formatDateToDisplay(deleteToDate)}`}? This action cannot be reversed.`}
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
