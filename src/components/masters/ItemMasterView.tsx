import React, { useState, useMemo, useEffect, useRef } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Item, Supplier } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { Search, FileSpreadsheet, Zap, RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ExcelImportModal } from '../common/ExcelImportModal';
import { calculateItemUnitBreakdown } from '../../utils/calculations';
import { loadBundledMaterialsCatalog } from '../../utils/excelEngine';

export const ItemMasterView: React.FC = () => {
  const { refreshKey, showToast, showAlert } = useApp();
  const { hasPermission } = useAuth();

  const items = useMemo(() => db.getItems(), [refreshKey]);
  const suppliers = useMemo(() => db.getSuppliers().filter(s => s.isActive !== false), [refreshKey]);
  const stockSummaries = useMemo(() => StockEngine.getAllItemsStockSummary(), [refreshKey]);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState(false);
  const [isJustSaved, setIsJustSaved] = useState(false);
  const [hasSecondaryUnit, setHasSecondaryUnit] = useState(false);
  const [search, setSearch] = useState('');

  const itemNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      itemNameInputRef.current?.focus();
      itemNameInputRef.current?.select();
    }, 60);
    return () => clearTimeout(timer);
  }, [selectedItemId]);

  // Form Fields matching customer screenshot item.jpg
  const [sno, setSno] = useState('');
  const [name, setName] = useState('');
  const [hsn, setHsn] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Unit A State
  const [unitAName, setUnitAName] = useState('Roll');
  const [unitABasicPrice, setUnitABasicPrice] = useState('0');
  const [unitAGstPercent, setUnitAGstPercent] = useState('18');
  const [unitATranPercent, setUnitATranPercent] = useState('10');
  const [unitAProfAm, setUnitAProfAm] = useState('0');
  const [unitAProfDeal, setUnitAProfDeal] = useState('0');
  const [unitAMisPercent, setUnitAMisPercent] = useState('0');
  const [unitARoundUpSale, setUnitARoundUpSale] = useState('0');
  const [unitARoundUpMrp, setUnitARoundUpMrp] = useState('0');
  const [unitASalePrice, setUnitASalePrice] = useState('0');
  const [unitAMrp, setUnitAMrp] = useState('0');
  const [unitAActive, setUnitAActive] = useState(true);

  // Unit B State
  const [unitBName, setUnitBName] = useState('Mt.');
  const [unitBConversion, setUnitBConversion] = useState('40');
  const [unitBBasicPrice, setUnitBBasicPrice] = useState('0');
  const [unitBGstPercent, setUnitBGstPercent] = useState('18');
  const [unitBTranPercent, setUnitBTranPercent] = useState('10');
  const [unitBProfAm, setUnitBProfAm] = useState('0');
  const [unitBProfDeal, setUnitBProfDeal] = useState('0');
  const [unitBMisPercent, setUnitBMisPercent] = useState('0');
  const [unitBRoundUpSale, setUnitBRoundUpSale] = useState('0');
  const [unitBRoundUpMrp, setUnitBRoundUpMrp] = useState('0');
  const [unitBSalePrice, setUnitBSalePrice] = useState('0');
  const [unitBMrp, setUnitBMrp] = useState('0');
  const [unitBActive, setUnitBActive] = useState(true);

  const [minStock, setMinStock] = useState('100');
  const [openingStock, setOpeningStock] = useState('0');
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [isEditPromptOpen, setIsEditPromptOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [isImportingBundled, setIsImportingBundled] = useState(false);

  const handleQuickLoadBundled = async () => {
    setIsImportingBundled(true);
    try {
      const res = await loadBundledMaterialsCatalog();
      showToast(`Successfully loaded ${res.importedCount} materials and ${res.createdSuppliersCount} suppliers from ITEM.xls!`, 'success');
    } catch (err: any) {
      showAlert(`Failed to load materials: ${err.message}`, 'Load Error', 'error');
    } finally {
      setIsImportingBundled(false);
    }
  };

  // Live Unit A Calculation
  const unitABreakdown = useMemo(() => {
    return calculateItemUnitBreakdown(
      Number(unitABasicPrice) || 0,
      Number(unitAGstPercent) || 0,
      Number(unitATranPercent) || 0,
      Number(unitAProfAm) || 0,
      Number(unitAMisPercent) || 0,
      Number(unitARoundUpSale) || 0,
      undefined,
      Number(unitAProfDeal) || 0,
      Number(unitARoundUpMrp) || 0
    );
  }, [unitABasicPrice, unitAGstPercent, unitATranPercent, unitAProfAm, unitAProfDeal, unitAMisPercent, unitARoundUpSale, unitARoundUpMrp]);

  // Live Unit B Calculation
  const unitBBreakdown = useMemo(() => {
    return calculateItemUnitBreakdown(
      Number(unitBBasicPrice) || 0,
      Number(unitBGstPercent) || 0,
      Number(unitBTranPercent) || 0,
      Number(unitBProfAm) || 0,
      Number(unitBMisPercent) || 0,
      Number(unitBRoundUpSale) || 0,
      undefined,
      Number(unitBProfDeal) || 0,
      Number(unitBRoundUpMrp) || 0
    );
  }, [unitBBasicPrice, unitBGstPercent, unitBTranPercent, unitBProfAm, unitBProfDeal, unitBMisPercent, unitBRoundUpSale, unitBRoundUpMrp]);

  // Auto-sync sale price and mrp when inputs change
  useEffect(() => {
    if (isTouched) {
      setUnitASalePrice(String(unitABreakdown.salePrice));
      setUnitAMrp(String(unitABreakdown.mrp));
    }
  }, [unitABreakdown.salePrice, unitABreakdown.mrp, isTouched]);

  useEffect(() => {
    if (isTouched && hasSecondaryUnit) {
      setUnitBSalePrice(String(unitBBreakdown.salePrice));
      setUnitBMrp(String(unitBBreakdown.mrp));
    }
  }, [unitBBreakdown.salePrice, unitBBreakdown.mrp, isTouched, hasSecondaryUnit]);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: '',
    name: ''
  });

  const isFormActive = Boolean(isTouched || selectedItemId || name.trim() !== '');

  const loadItemIntoForm = (item: Item, viewOnly: boolean = false) => {
    setSelectedItemId(item.id);
    setIsTouched(false);
    setIsJustSaved(false);
    setIsViewOnly(viewOnly);
    setHasSecondaryUnit(Boolean(item.hasSecondaryUnit || (item.unitB && item.unitB.isActive !== false && item.unitB.unitName && item.unitB.unitName !== item.unitA?.unitName)));
    setSno(item.sno || '');
    setName(item.name);
    setHsn(item.hsn || '');
    setDescription(item.description || '');
    setCategory(item.category || '');
    setSupplierId(item.supplierId || '');
    setIsActive(item.isActive !== false);

    // Unit A
    if (item.unitA) {
      setUnitAName(item.unitA.unitName || 'Roll');
      setUnitABasicPrice(String(item.unitA.basicPrice ?? 0));
      setUnitAGstPercent(String(item.unitA.gstPercent ?? 18));
      setUnitATranPercent(String(item.unitA.tranPercent ?? 10));
      setUnitAProfAm(String(item.unitA.profPercentAm ?? item.profPercentAm ?? 0));
      setUnitAProfDeal(String(item.unitA.profPercentDeal ?? item.unitA.profPercent ?? item.profPercentDeal ?? 0));
      setUnitAMisPercent(String(item.unitA.misPercent ?? 0));
      setUnitARoundUpSale(String(item.unitA.roundUpSale ?? item.unitA.roundUp ?? item.roundUpSale ?? item.roundUp ?? 0));
      setUnitARoundUpMrp(String(item.unitA.roundUpMrp ?? item.roundUpMrp ?? 0));
      setUnitASalePrice(String(item.unitA.salePrice ?? item.saleRate ?? 0));
      setUnitAMrp(String(item.unitA.mrp ?? item.mrp ?? 0));
      setUnitAActive(item.unitA.isActive !== false);
    } else {
      setUnitAName(item.unit || 'Roll');
      setUnitABasicPrice(String(item.purchaseRate || 0));
      setUnitAGstPercent(String(item.gstPercent || 18));
      setUnitATranPercent('10');
      setUnitAProfAm(String(item.profPercentAm ?? 0));
      setUnitAProfDeal(String(item.profPercentDeal ?? 0));
      setUnitAMisPercent('0');
      setUnitARoundUpSale(String(item.roundUpSale ?? item.roundUp ?? 0));
      setUnitARoundUpMrp(String(item.roundUpMrp ?? 0));
      setUnitASalePrice(String(item.saleRate || 0));
      setUnitAMrp(String(item.mrp || 0));
      setUnitAActive(true);
    }

    // Unit B
    if (item.unitB) {
      setUnitBName(item.unitB.unitName || 'Mt.');
      setUnitBConversion(String(item.unitB.conversionFactor ?? 40));
      setUnitBBasicPrice(String(item.unitB.basicPrice ?? 0));
      setUnitBGstPercent(String(item.unitB.gstPercent ?? 18));
      setUnitBTranPercent(String(item.unitB.tranPercent ?? 10));
      setUnitBProfAm(String(item.unitB.profPercentAm ?? 0));
      setUnitBProfDeal(String(item.unitB.profPercentDeal ?? item.unitB.profPercent ?? 0));
      setUnitBMisPercent(String(item.unitB.misPercent ?? 0));
      setUnitBRoundUpSale(String(item.unitB.roundUpSale ?? item.unitB.roundUp ?? 0));
      setUnitBRoundUpMrp(String(item.unitB.roundUpMrp ?? 0));
      setUnitBSalePrice(String(item.unitB.salePrice ?? 0));
      setUnitBMrp(String(item.unitB.mrp ?? 0));
      setUnitBActive(item.unitB.isActive !== false);
    } else {
      setUnitBName('Mt.');
      setUnitBConversion('40');
      setUnitBBasicPrice(String(item.purchaseRate || 0));
      setUnitBGstPercent(String(item.gstPercent || 18));
      setUnitBTranPercent('10');
      setUnitBProfAm('0');
      setUnitBProfDeal('0');
      setUnitBMisPercent('0');
      setUnitBRoundUpSale('0');
      setUnitBRoundUpMrp('0');
      setUnitBSalePrice(String(item.saleRate || 0));
      setUnitBMrp(String(item.mrp || 0));
      setUnitBActive(true);
    }

    setMinStock(String(item.minStock || 0));
    setOpeningStock(String(item.openingStock || 0));
    showToast(viewOnly ? `Viewing ${item.name}` : `Loaded ${item.name} for editing`, 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateNew = () => {
    setSelectedItemId(null);
    setIsTouched(false);
    setIsJustSaved(false);
    setIsViewOnly(false);
    setHasSecondaryUnit(false);
    setSno(StockEngine.getNextItemSno());
    setName('');
    setHsn('');
    setDescription('');
    setCategory('Paper & Sheets');
    if (suppliers.length > 0) setSupplierId(suppliers[0].id);
    setIsActive(true);

    setUnitAName('Roll');
    setUnitABasicPrice('0');
    setUnitAGstPercent('18');
    setUnitATranPercent('10');
    setUnitAProfAm('0');
    setUnitAProfDeal('0');
    setUnitAMisPercent('0');
    setUnitARoundUpSale('0');
    setUnitARoundUpMrp('0');
    setUnitASalePrice('0');
    setUnitAMrp('0');
    setUnitAActive(true);

    setUnitBName('Mt.');
    setUnitBConversion('40');
    setUnitBBasicPrice('0');
    setUnitBGstPercent('18');
    setUnitBTranPercent('10');
    setUnitBProfAm('0');
    setUnitBProfDeal('0');
    setUnitBMisPercent('0');
    setUnitBRoundUpSale('0');
    setUnitBRoundUpMrp('0');
    setUnitBSalePrice('0');
    setUnitBMrp('0');
    setUnitBActive(true);

    setMinStock('10');
    setOpeningStock('0');
    showToast('Ready to create new item', 'info');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) {
      setIsEditPromptOpen(true);
      return;
    }
    if (!name.trim()) {
      showAlert('Item Name is required', 'Validation Error', 'error');
      return;
    }

    // Auto-generate S.No if not provided
    const finalSno = sno.trim() || StockEngine.getNextItemSno();

    const existing = db.getItemBySno(finalSno);
    if (existing && existing.id !== selectedItemId) {
      showAlert(`Item Code / S.No. "${finalSno}" is already used by "${existing.name}"`, 'Duplicate Code', 'error');
      return;
    }

    const supObj = suppliers.find(s => s.id === supplierId);

    const itemRecord: Item = {
      id: selectedItemId || `item-${Date.now()}`,
      sno: finalSno,
      name: name.trim().toUpperCase(),
      hsn: hsn.trim(),
      description: description.trim(),
      category: category.trim(),
      supplierId: supplierId || undefined,
      supplierName: supObj?.name,
      unit: unitAName.trim() || 'Pcs',
      hasSecondaryUnit,
      minStock: Number(minStock) || 0,
      openingStock: Number(openingStock) || 0,
      purchaseRate: Number(unitABasicPrice) || 0,
      saleRate: Number(unitASalePrice) || unitABreakdown.salePrice,
      mrp: Number(unitAMrp) || unitABreakdown.mrp,
      gstPercent: Number(unitAGstPercent) || 18,
      roundUp: Number(unitARoundUpSale) || 0,
      roundUpSale: Number(unitARoundUpSale) || 0,
      roundUpMrp: Number(unitARoundUpMrp) || 0,
      profPercentAm: Number(unitAProfAm) || 0,
      profPercentDeal: Number(unitAProfDeal) || 0,
      unitA: {
        unitName: unitAName.trim() || 'Roll',
        basicPrice: Number(unitABasicPrice) || 0,
        gstPercent: Number(unitAGstPercent) || 0,
        tranPercent: Number(unitATranPercent) || 0,
        profPercent: Number(unitAProfDeal) || 0,
        profPercentAm: Number(unitAProfAm) || 0,
        profPercentDeal: Number(unitAProfDeal) || 0,
        misPercent: Number(unitAMisPercent) || 0,
        nettPrice: unitABreakdown.nettPrice,
        roundUp: Number(unitARoundUpSale) || 0,
        roundUpSale: Number(unitARoundUpSale) || 0,
        roundUpMrp: Number(unitARoundUpMrp) || 0,
        salePrice: Number(unitASalePrice) || unitABreakdown.salePrice,
        mrp: Number(unitAMrp) || unitABreakdown.mrp,
        isActive: unitAActive
      },
      unitB: hasSecondaryUnit ? {
        unitName: unitBName.trim() || 'Mt.',
        conversionFactor: Number(unitBConversion) || 1,
        basicPrice: Number(unitBBasicPrice) || 0,
        gstPercent: Number(unitBGstPercent) || 0,
        tranPercent: Number(unitBTranPercent) || 0,
        profPercent: Number(unitBProfDeal) || 0,
        profPercentAm: Number(unitBProfAm) || 0,
        profPercentDeal: Number(unitBProfDeal) || 0,
        misPercent: Number(unitBMisPercent) || 0,
        nettPrice: unitBBreakdown.nettPrice,
        roundUp: Number(unitBRoundUpSale) || 0,
        roundUpSale: Number(unitBRoundUpSale) || 0,
        roundUpMrp: Number(unitBRoundUpMrp) || 0,
        salePrice: Number(unitBSalePrice) || unitBBreakdown.salePrice,
        mrp: Number(unitBMrp) || unitBBreakdown.mrp,
        isActive: unitBActive
      } : undefined,
      isActive,
      createdAt: new Date().toISOString()
    };

    const isUpdating = Boolean(selectedItemId);
    db.saveItem(itemRecord);
    if (isUpdating) {
      setIsJustSaved(true);
      setIsTouched(false);
      setIsViewOnly(false);
      showToast(`Item "${itemRecord.name}" updated successfully!`, 'success');
    } else {
      setIsJustSaved(false);
      setIsViewOnly(false);
      showToast(`Item "${itemRecord.name}" created successfully!`, 'success');
      handleCreateNew();
    }
  };

  const handleDelete = () => {
    if (!selectedItemId) {
      showToast('Please select an item to delete', 'error');
      return;
    }
    if (!hasPermission('MANAGE_MASTERS')) {
      showToast('You do not have permission to delete items', 'error');
      return;
    }
    setDeleteDialog({ isOpen: true, id: selectedItemId, name });
  };

  const confirmDelete = () => {
    if (deleteDialog.id) {
      db.deleteItem(deleteDialog.id);
      showToast(`Item "${deleteDialog.name}" deleted from master.`, 'info');
      setDeleteDialog({ isOpen: false, id: '', name: '' });
      handleCreateNew();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Keyboard Shortcuts (Ctrl+S to save, Alt+N for new, Alt+P to print)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey || e.altKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave({ preventDefault: () => {} } as any);
      } else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleCreateNew();
      } else if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItemId, sno, name, hsn, description, category, supplierId, unitAName, unitABasicPrice, unitAGstPercent, unitATranPercent, unitAProfAm, unitAProfDeal, unitAMisPercent, unitASalePrice, unitAMrp, unitAActive, unitBName, unitBConversion, unitBBasicPrice, unitBGstPercent, unitBTranPercent, unitBProfAm, unitBProfDeal, unitBMisPercent, unitBSalePrice, unitBMrp, unitBActive, minStock, openingStock, hasSecondaryUnit, isActive, isViewOnly]);

  const filteredSummaries = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return stockSummaries;
    return stockSummaries.filter(
      s =>
        s.item.name.toLowerCase().includes(q) ||
        s.item.sno.toLowerCase().includes(q) ||
        (s.item.category && s.item.category.toLowerCase().includes(q)) ||
        (s.item.supplierName && s.item.supplierName.toLowerCase().includes(q))
    );
  }, [stockSummaries, search]);

  const isEditing = Boolean(selectedItemId && !isViewOnly);
  const isViewing = Boolean(selectedItemId && isViewOnly);
  const isCreating = Boolean(!selectedItemId && !isJustSaved && (isTouched || name.trim() !== ''));

  const cardStateClass = isJustSaved
    ? 'is-saved-yellow'
    : isViewing
    ? 'is-initial-blue'
    : isEditing
    ? 'is-editing-pink'
    : isCreating
    ? 'is-creating-green'
    : 'is-initial-blue';

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'BUTTON' && target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const form = e.currentTarget;
        const focusable = Array.from(
          form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement | HTMLTextAreaElement>(
            'input:not([disabled]):not([type="hidden"]):not([type="checkbox"]), select:not([disabled]), textarea:not([disabled]), button[type="submit"]'
          )
        );
        const index = focusable.indexOf(target as any);
        if (index > -1 && index < focusable.length - 1) {
          focusable[index + 1]?.focus();
          if ('select' in focusable[index + 1]) {
            (focusable[index + 1] as HTMLInputElement).select?.();
          }
        }
      }
    }
  };

  return (
    <div className="content-panel-grey">
      {/* Top Header Strip matching item.jpg */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="pill-header-lavender" style={{ fontSize: '1.25rem', padding: '8px 48px', minWidth: '160px', textAlign: 'center' }}>
            ITEM
          </div>
          {isJustSaved ? (
            <span className="active-mode-indicator is-saved">
              ● Saved / Updated Just Now ({name})
            </span>
          ) : isViewing ? (
            <span className="active-mode-indicator is-initial" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B' }}>
              ● Viewing Item: {name || 'Saved Item'} (Read Only — Double-Click to Edit)
            </span>
          ) : isEditing ? (
            <span className="active-mode-indicator is-editing">
              ● Editing Item ({name || 'Saved Item'})
            </span>
          ) : isCreating ? (
            <span className="active-mode-indicator is-creating">
              ● Creating New Item
            </span>
          ) : (
            <span className="active-mode-indicator is-initial">
              ● Ready for New Item
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Shortcuts indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#4B5563', background: '#FFFFFF', padding: '5px 12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
            <span><b>Ctrl+S:</b> Save Item</span>
            <span style={{ color: '#D1D5DB' }}>|</span>
            <span><b>Alt+N:</b> New Item</span>
            <span style={{ color: '#D1D5DB' }}>|</span>
            <span><b>Alt+P:</b> Print</span>
          </div>

          {/* 1-Click Load 569 Materials Button */}
          <button
            type="button"
            onClick={handleQuickLoadBundled}
            disabled={isImportingBundled}
            style={{
              background: '#059669',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 16px',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: isImportingBundled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(5,150,105,0.3)'
            }}
          >
            {isImportingBundled ? <RefreshCw size={14} className="spin" /> : <Zap size={14} />}
            ⚡ 1-Click Load 569 Materials
          </button>

          {/* Bulk Excel Import Button */}
          <button
            type="button"
            onClick={() => setIsExcelImportOpen(true)}
            style={{
              background: '#F0FDF4',
              color: '#166534',
              border: '1.5px solid #86EFAC',
              borderRadius: '20px',
              padding: '6px 16px',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <FileSpreadsheet size={15} color="#16A34A" />
            Import from Excel (.xlsx)
          </button>

          {/* Secondary Unit Toggle (OFF by default) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: hasSecondaryUnit ? '#DCFCE7' : '#FFFFFF', padding: '6px 14px', borderRadius: '20px', border: '1px solid #D1D5DB' }}>
            <input
              type="checkbox"
              id="hasSecondaryUnitCheckbox"
              checked={hasSecondaryUnit}
              onChange={e => {
                setIsTouched(true);
                setHasSecondaryUnit(e.target.checked);
              }}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="hasSecondaryUnitCheckbox" style={{ fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', color: hasSecondaryUnit ? '#166534' : '#4B5563' }}>
              Secondary Unit (Unit B) {hasSecondaryUnit ? 'ON' : 'OFF'}
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', padding: '6px 14px', borderRadius: '20px', border: '1px solid #D1D5DB' }}>
            <input
              type="checkbox"
              id="activeItemCheckbox"
              checked={isActive}
              onChange={e => {
                setIsTouched(true);
                setIsActive(e.target.checked);
              }}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="activeItemCheckbox" style={{ fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer' }}>
              Active
            </label>
          </div>
        </div>
      </div>

      {/* Main Form Container: Light Blue on Initial, Light Green on Creating, Light Pink on Editing */}
      <div
        className={`dynamic-entry-card ${cardStateClass}`}
        style={{
          padding: '28px',
          maxWidth: '980px',
          margin: '0 auto',
          position: 'relative'
        }}
      >
        {isViewOnly && (
          <div
            onClick={() => setIsEditPromptOpen(true)}
            style={{
              marginBottom: '18px',
              padding: '10px 16px',
              background: '#FEF3C7',
              border: '1.5px solid #F59E0B',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontWeight: 800, color: '#92400E', fontSize: '0.88rem' }}>
              🔒 View-Only Mode: Item record is locked against accidental edits. Click anywhere or press button to edit.
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditPromptOpen(true);
              }}
              style={{
                background: '#D97706',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 14px',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              Unlock / Edit
            </button>
          </div>
        )}

        <form
          onSubmit={handleSave}
          onKeyDown={handleFormKeyDown}
          onClickCapture={isViewOnly ? (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsEditPromptOpen(true);
          } : undefined}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          
          {/* Row 1: Item Name, HSN Code */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Item Name *
              </label>
              <input
                ref={itemNameInputRef}
                type="text"
                className="input-text-clean"
                value={name}
                onChange={e => {
                  setIsTouched(true);
                  setName(e.target.value);
                }}
                placeholder="e.g. ASTER / PRINTING SHEET 70 GSM"
                required
                style={{ fontWeight: 800 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                HSN Code (Optional)
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={hsn}
                onChange={e => {
                  setIsTouched(true);
                  setHsn(e.target.value);
                }}
                placeholder="e.g. 4802"
                style={{ fontFamily: 'monospace' }}
              />
            </div>
          </div>

          {/* Row 2: Description, Category, Supplier */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Description
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={description}
                onChange={e => {
                  setIsTouched(true);
                  setDescription(e.target.value);
                }}
                placeholder="e.g. High Quality Glossy Aster Sheets"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Category
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={category}
                onChange={e => {
                  setIsTouched(true);
                  setCategory(e.target.value);
                }}
                placeholder="e.g. Paper & Sheets"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Supplier
              </label>
              <select
                className="input-text-clean"
                value={supplierId}
                onChange={e => {
                  setIsTouched(true);
                  setSupplierId(e.target.value);
                }}
                style={{ fontWeight: 700 }}
              >
                <option value="">-- Select Supplier --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* UNIT-A SECTION matching item.jpg */}
          <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '14px', marginTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 900, fontSize: '1rem', color: '#000000' }}>UNIT-A :</span>
                <input
                  type="text"
                  className="input-text-clean"
                  value={unitAName}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitAName(e.target.value);
                  }}
                  style={{ width: '100px', color: '#EA3943', fontWeight: 900, textAlign: 'center', fontSize: '0.95rem' }}
                  placeholder="e.g. Roll"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="checkbox"
                  id="unitAActiveCheck"
                  checked={unitAActive}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitAActive(e.target.checked);
                  }}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="unitAActiveCheck" style={{ fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
                  Active
                </label>
              </div>
            </div>

            {/* Pricing Grid with Red Calculation Subtexts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '8px', textAlign: 'center' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Besic Price</label>
                <input
                  type="number"
                  step="any"
                  className="input-text-clean"
                  value={unitABasicPrice}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitABasicPrice(e.target.value);
                  }}
                  style={{ textAlign: 'center', fontWeight: 700 }}
                />
                <div className="subtext-calc-red">{unitABreakdown.basicPrice}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>GST %</label>
                <input
                  type="number"
                  step="any"
                  className="input-text-clean"
                  value={unitAGstPercent}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitAGstPercent(e.target.value);
                  }}
                  style={{ textAlign: 'center', fontWeight: 700 }}
                />
                <div className="subtext-calc-red">{unitABreakdown.gstAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>tran%</label>
                <input
                  type="number"
                  step="any"
                  className="input-text-clean"
                  value={unitATranPercent}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitATranPercent(e.target.value);
                  }}
                  style={{ textAlign: 'center', fontWeight: 700 }}
                />
                <div className="subtext-calc-red">{unitABreakdown.tranAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>mis%</label>
                <input
                  type="number"
                  step="any"
                  className="input-text-clean"
                  value={unitAMisPercent}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitAMisPercent(e.target.value);
                  }}
                  style={{ textAlign: 'center', fontWeight: 700 }}
                />
                <div className="subtext-calc-red">{unitABreakdown.misAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#1E40AF' }}>Prof % Am</label>
                <input
                  type="number"
                  step="any"
                  className="input-text-clean"
                  value={unitAProfAm}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitAProfAm(e.target.value);
                  }}
                  style={{ textAlign: 'center', fontWeight: 700, borderColor: '#3B82F6' }}
                />
                <div className="subtext-calc-red">{unitABreakdown.profAmAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#6D28D9' }}>Prof % deal</label>
                <input
                  type="number"
                  step="any"
                  className="input-text-clean"
                  value={unitAProfDeal}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitAProfDeal(e.target.value);
                  }}
                  style={{ textAlign: 'center', fontWeight: 700, borderColor: '#8B5CF6' }}
                />
                <div className="subtext-calc-red">{unitABreakdown.profDealAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#6D28D9' }}>Round-S</label>
                <input
                  type="number"
                  step="any"
                  className="input-text-clean"
                  value={unitARoundUpSale}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitARoundUpSale(e.target.value);
                  }}
                  style={{ textAlign: 'center', fontWeight: 700, borderColor: '#8B5CF6' }}
                />
                <div className="subtext-calc-red">{unitABreakdown.roundUpSale}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#1E40AF' }}>Round-M</label>
                <input
                  type="number"
                  step="any"
                  className="input-text-clean"
                  value={unitARoundUpMrp}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitARoundUpMrp(e.target.value);
                  }}
                  style={{ textAlign: 'center', fontWeight: 700, borderColor: '#3B82F6' }}
                />
                <div className="subtext-calc-red">{unitABreakdown.roundUpMrp}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#6D28D9' }}>Sale Price</label>
                <input
                  type="number"
                  step="any"
                  className="input-text-clean"
                  value={unitASalePrice}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitASalePrice(e.target.value);
                  }}
                  style={{ textAlign: 'center', fontWeight: 900, color: '#6D28D9', fontSize: '0.92rem' }}
                />
                <div className="subtext-calc-red">{unitABreakdown.salePrice}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#1E40AF' }}>mrp</label>
                <input
                  type="number"
                  step="any"
                  className="input-text-clean"
                  value={unitAMrp}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitAMrp(e.target.value);
                  }}
                  style={{ textAlign: 'center', fontWeight: 900, color: '#1E40AF', fontSize: '0.92rem' }}
                />
                <div className="subtext-calc-red">{unitABreakdown.mrp}</div>
              </div>
            </div>
          </div>

          {/* UNIT-B SECTION matching item.jpg - Only shown when Secondary Unit is enabled */}
          {hasSecondaryUnit && (
            <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 900, fontSize: '1rem', color: '#000000' }}>UNIT-B :</span>
                  <input
                    type="text"
                    className="input-text-clean"
                    value={unitBName}
                    onChange={e => {
                      setIsTouched(true);
                      setUnitBName(e.target.value);
                    }}
                    style={{ width: '100px', color: '#EA3943', fontWeight: 900, textAlign: 'center', fontSize: '0.95rem' }}
                    placeholder="e.g. Mt."
                  />
                  <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>1 {unitAName || 'Unit A'} =</span>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitBConversion}
                    onChange={e => {
                      setIsTouched(true);
                      setUnitBConversion(e.target.value);
                    }}
                    style={{ width: '80px', fontWeight: 800, textAlign: 'center' }}
                    placeholder="40"
                  />
                  <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{unitBName || 'Unit B'}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="checkbox"
                    id="unitBActiveCheck"
                    checked={unitBActive}
                    onChange={e => {
                      setIsTouched(true);
                      setUnitBActive(e.target.checked);
                    }}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="unitBActiveCheck" style={{ fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
                    Active
                  </label>
                </div>
              </div>

              {/* Pricing Grid for Unit B */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '8px', textAlign: 'center' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Besic Price</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitBBasicPrice}
                    onChange={e => {
                      setIsTouched(true);
                      setUnitBBasicPrice(e.target.value);
                    }}
                    style={{ textAlign: 'center', fontWeight: 700 }}
                  />
                  <div className="subtext-calc-red">{unitBBreakdown.basicPrice}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>GST %</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitBGstPercent}
                    onChange={e => {
                      setIsTouched(true);
                      setUnitBGstPercent(e.target.value);
                    }}
                    style={{ textAlign: 'center', fontWeight: 700 }}
                  />
                  <div className="subtext-calc-red">{unitBBreakdown.gstAmt}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>tran%</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitBTranPercent}
                    onChange={e => {
                      setIsTouched(true);
                      setUnitBTranPercent(e.target.value);
                    }}
                    style={{ textAlign: 'center', fontWeight: 700 }}
                  />
                  <div className="subtext-calc-red">{unitBBreakdown.tranAmt}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>mis%</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitBMisPercent}
                    onChange={e => {
                      setIsTouched(true);
                      setUnitBMisPercent(e.target.value);
                    }}
                    style={{ textAlign: 'center', fontWeight: 700 }}
                  />
                  <div className="subtext-calc-red">{unitBBreakdown.misAmt}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#1E40AF' }}>Prof % Am</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitBProfAm}
                    onChange={e => {
                      setIsTouched(true);
                      setUnitBProfAm(e.target.value);
                    }}
                    style={{ textAlign: 'center', fontWeight: 700, borderColor: '#3B82F6' }}
                  />
                  <div className="subtext-calc-red">{unitBBreakdown.profAmAmt}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#6D28D9' }}>Prof % deal</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitBProfDeal}
                    onChange={e => {
                      setIsTouched(true);
                      setUnitBProfDeal(e.target.value);
                    }}
                    style={{ textAlign: 'center', fontWeight: 700, borderColor: '#8B5CF6' }}
                  />
                  <div className="subtext-calc-red">{unitBBreakdown.profDealAmt}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#6D28D9' }}>Round-S</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitBRoundUpSale}
                    onChange={e => {
                      setIsTouched(true);
                      setUnitBRoundUpSale(e.target.value);
                    }}
                    style={{ textAlign: 'center', fontWeight: 700, borderColor: '#8B5CF6' }}
                  />
                  <div className="subtext-calc-red">{unitBBreakdown.roundUpSale}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#1E40AF' }}>Round-M</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitBRoundUpMrp}
                    onChange={e => {
                      setIsTouched(true);
                      setUnitBRoundUpMrp(e.target.value);
                    }}
                    style={{ textAlign: 'center', fontWeight: 700, borderColor: '#3B82F6' }}
                  />
                  <div className="subtext-calc-red">{unitBBreakdown.roundUpMrp}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#6D28D9' }}>Sale Price</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitBSalePrice}
                    onChange={e => {
                      setIsTouched(true);
                      setUnitBSalePrice(e.target.value);
                    }}
                    style={{ textAlign: 'center', fontWeight: 900, color: '#6D28D9', fontSize: '0.92rem' }}
                  />
                  <div className="subtext-calc-red">{unitBBreakdown.salePrice}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#1E40AF' }}>mrp</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitBMrp}
                    onChange={e => {
                      setIsTouched(true);
                      setUnitBMrp(e.target.value);
                    }}
                    style={{ textAlign: 'center', fontWeight: 900, color: '#1E40AF', fontSize: '0.92rem' }}
                  />
                  <div className="subtext-calc-red">{unitBBreakdown.mrp}</div>
                </div>
              </div>
            </div>
          )}

          {/* Stock Thresholds */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '4px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Min Stock (Reorder Alert Threshold)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                className="input-text-clean"
                value={minStock}
                onChange={e => {
                  setIsTouched(true);
                  setMinStock(e.target.value);
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Opening Stock
              </label>
              <input
                type="number"
                step="any"
                min="0"
                className="input-text-clean"
                value={openingStock}
                onChange={e => {
                  setIsTouched(true);
                  setOpeningStock(e.target.value);
                }}
              />
            </div>
          </div>

          {/* Customer Action Buttons: Del, Large Save, Print */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', flexWrap: 'wrap', marginTop: '24px' }}>
            <button
              type="button"
              className="btn-customer-action-pill"
              onClick={handleDelete}
              disabled={!isEditing}
              style={{ opacity: isEditing ? 1 : 0.5, cursor: isEditing ? 'pointer' : 'not-allowed' }}
            >
              Del
            </button>

            <button
              type="submit"
              className="btn-customer-save"
              style={{ padding: '10px 48px', fontSize: '1.2rem', minWidth: '160px' }}
            >
              Save
            </button>

            <button
              type="button"
              className="btn-customer-action-pill"
              onClick={handlePrint}
            >
              Print
            </button>
          </div>
        </form>
      </div>

      {/* Item Stock Directory Register in the Downside (Always Visible) */}
      <div id="item-directory-register" style={{ marginTop: '28px', background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '20px', maxWidth: '980px', margin: '28px auto 0', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h4 style={{ fontWeight: 900, fontSize: '1.1rem', margin: 0 }}>Items Master & Live Stock (Register)</h4>
            <span style={{ fontSize: '0.8rem', background: '#E0E7FF', color: '#3730A3', padding: '2px 10px', borderRadius: '12px', fontWeight: 800 }}>
              {filteredSummaries.length} {filteredSummaries.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={14} color="#6B7280" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search items by name, code, category..."
              className="input-text-clean"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Supplier</th>
                <th>Unit-A (Sale / MRP)</th>
                <th>Unit-B (Conversion)</th>
                <th style={{ textAlign: 'center' }}>Live Stock</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF', fontWeight: 600 }}>
                    No items found matching "{search}".
                  </td>
                </tr>
              ) : (
                filteredSummaries.map(s => (
                  <tr
                    key={s.item.id}
                    title="Single-click to view, double-click to edit directly"
                    style={{
                      backgroundColor: selectedItemId === s.item.id ? '#EFF6FF' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => loadItemIntoForm(s.item, true)}
                    onDoubleClick={() => loadItemIntoForm(s.item, false)}
                  >
                    <td style={{ fontWeight: 800 }}>{s.item.name}</td>
                    <td>{s.item.supplierName || '-'}</td>
                    <td>
                      {s.item.unitA 
                        ? `${s.item.unitA.unitName}: ₹${s.item.unitA.salePrice ?? s.item.saleRate ?? 0} (Sale) / ₹${s.item.unitA.mrp ?? s.item.mrp ?? 0} (MRP)` 
                        : `${s.item.unit || 'Pcs'}: ₹${s.item.saleRate || 0} (Sale) / ₹${s.item.mrp || 0} (MRP)`}
                    </td>
                    <td>
                      {s.item.unitB ? `${s.item.unitB.unitName} (1=${s.item.unitB.conversionFactor})` : '-'}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 900, color: s.isLowStock ? '#EA3943' : '#15803D' }}>
                      {s.closingStock}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: s.item.isActive !== false ? '#DCFCE7' : '#FEE2E2',
                          color: s.item.isActive !== false ? '#166534' : '#991B1B'
                        }}
                      >
                        {s.item.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          loadItemIntoForm(s.item, false);
                        }}
                        style={{
                          background: selectedItemId === s.item.id && !isViewOnly ? '#BFDBFE' : '#E2D2F8',
                          color: selectedItemId === s.item.id && !isViewOnly ? '#1E40AF' : '#EA3943',
                          border: '1px solid #C4B5FD',
                          borderRadius: '12px',
                          padding: '3px 12px',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        {selectedItemId === s.item.id && !isViewOnly ? 'Editing' : selectedItemId === s.item.id ? 'Viewing' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Mode Prompt Confirmation */}
      <ConfirmDialog
        isOpen={isEditPromptOpen}
        onClose={() => setIsEditPromptOpen(false)}
        onConfirm={() => {
          setIsViewOnly(false);
          setIsEditPromptOpen(false);
          showToast('Edit mode enabled', 'info');
        }}
        title="Enable Edit Mode?"
        message="Would you like to edit this item record?"
        confirmText="Yes, Edit"
        cancelText="No, Keep View Only"
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: '', name: '' })}
        onConfirm={confirmDelete}
        title="Delete Item"
        message={`Are you sure you want to delete item "${deleteDialog.name}"? This will also remove associated stock movements.`}
      />

      {/* Excel Bulk Import Modal */}
      <ExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
      />
    </div>
  );
};
