import React, { useState, useMemo, useEffect, useRef } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Item, Supplier } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { Search, FileSpreadsheet } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ExcelImportModal } from '../common/ExcelImportModal';
import { calculateItemUnitBreakdown } from '../../utils/calculations';

export const ItemMasterView: React.FC = () => {
  const { refreshKey, showToast, showAlert, openItemLedger } = useApp();
  const { hasPermission } = useAuth();

  const items = useMemo(() => db.getItems(), [refreshKey]);
  // Sort suppliers alphabetically A-Z matching Hindi note: "Supplier Alfaber areng karna hai"
  const suppliers = useMemo(() => {
    return db
      .getSuppliers()
      .filter(s => s.isActive !== false)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [refreshKey]);

  // Unique categories for suggestion dropdown
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.category && i.category.trim()) set.add(i.category.trim());
    });
    return Array.from(set).sort();
  }, [items]);

  const stockSummaries = useMemo(() => StockEngine.getAllItemsStockSummary(), [refreshKey]);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState(false);
  const [isJustSaved, setIsJustSaved] = useState(false);
  const [hasSecondaryUnit, setHasSecondaryUnit] = useState(true);

  // Table filters matching mockup
  const [showCategoryWise, setShowCategoryWise] = useState(false);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterItem, setFilterItem] = useState('ALL');

  const itemNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      itemNameInputRef.current?.focus();
      itemNameInputRef.current?.select();
    }, 60);
    return () => clearTimeout(timer);
  }, [selectedItemId]);

  // Form Fields
  const [sno, setSno] = useState('');
  const [name, setName] = useState('');
  const [hsn, setHsn] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [disableRestockNotification, setDisableRestockNotification] = useState(false);

  // Unit A State (On Add New item, Unit A & B must be BLANK matching Hindi note)
  const [unitAName, setUnitAName] = useState('');
  const [unitABasicPrice, setUnitABasicPrice] = useState('0');
  const [unitAGstPercent, setUnitAGstPercent] = useState('0');
  const [unitATranPercent, setUnitATranPercent] = useState('0');
  const [unitAProfAm, setUnitAProfAm] = useState('0');
  const [unitAProfDeal, setUnitAProfDeal] = useState('0');
  const [unitAMisPercent, setUnitAMisPercent] = useState('0');
  const [unitARoundUpSale, setUnitARoundUpSale] = useState('0');
  const [unitARoundUpMrp, setUnitARoundUpMrp] = useState('0');
  const [unitASalePrice, setUnitASalePrice] = useState('0');
  const [unitAMrp, setUnitAMrp] = useState('0');
  const [unitAActive, setUnitAActive] = useState(true);

  // Unit B State
  const [unitBName, setUnitBName] = useState('');
  const [unitBConversion, setUnitBConversion] = useState('40');
  const [unitBBasicPrice, setUnitBBasicPrice] = useState('0');
  const [unitBGstPercent, setUnitBGstPercent] = useState('0');
  const [unitBTranPercent, setUnitBTranPercent] = useState('0');
  const [unitBProfAm, setUnitBProfAm] = useState('0');
  const [unitBProfDeal, setUnitBProfDeal] = useState('0');
  const [unitBMisPercent, setUnitBMisPercent] = useState('0');
  const [unitBRoundUpSale, setUnitBRoundUpSale] = useState('0');
  const [unitBRoundUpMrp, setUnitBRoundUpMrp] = useState('0');
  const [unitBSalePrice, setUnitBSalePrice] = useState('0');
  const [unitBMrp, setUnitBMrp] = useState('0');
  const [unitBActive, setUnitBActive] = useState(true);
  const [isUnitBProfCustomized, setIsUnitBProfCustomized] = useState(false);

  const [minStock, setMinStock] = useState('0');
  const [openingStock, setOpeningStock] = useState('0');
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [isEditPromptOpen, setIsEditPromptOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);

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

  // Sync sale price and mrp when inputs change
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

  // Sync Unit A's percentages to Unit B automatically matching Hindi note:
  // "UNIT B ka gst% tran% mis% prof% prof%-M by defalt unit A copy ho jaye chainj karne par cheng ho jaye"
  const handleUnitAChange = (field: 'gst' | 'tran' | 'mis' | 'profDeal' | 'profAm', value: string) => {
    setIsTouched(true);
    if (field === 'gst') {
      setUnitAGstPercent(value);
      setUnitBGstPercent(value);
    } else if (field === 'tran') {
      setUnitATranPercent(value);
      setUnitBTranPercent(value);
    } else if (field === 'mis') {
      setUnitAMisPercent(value);
      setUnitBMisPercent(value);
    } else if (field === 'profDeal') {
      setUnitAProfDeal(value);
      if (!isUnitBProfCustomized) {
        setUnitBProfDeal(value);
      }
    } else if (field === 'profAm') {
      setUnitAProfAm(value);
      if (!isUnitBProfCustomized) {
        setUnitBProfAm(value);
      }
    }
  };

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: '',
    name: ''
  });

  const loadItemIntoForm = (item: Item, viewOnly: boolean = false) => {
    setSelectedItemId(item.id);
    setIsTouched(false);
    setIsJustSaved(false);
    setIsViewOnly(viewOnly);
    setHasSecondaryUnit(Boolean(item.hasSecondaryUnit || (item.unitB && item.unitB.isActive !== false)));
    setSno(item.sno || '');
    setName(item.name);
    setHsn(item.hsn || '');
    setDescription(item.description || '');
    setCategory(item.category || '');
    setSupplierId(item.supplierId || '');
    setIsActive(item.isActive !== false);

    // Unit A
    if (item.unitA) {
      setUnitAName(item.unitA.unitName || '');
      setUnitABasicPrice(String(item.unitA.basicPrice ?? 0));
      setUnitAGstPercent(String(item.unitA.gstPercent ?? 0));
      setUnitATranPercent(String(item.unitA.tranPercent ?? 0));
      setUnitAProfAm(String(item.unitA.profPercentAm ?? item.profPercentAm ?? 0));
      setUnitAProfDeal(String(item.unitA.profPercentDeal ?? item.unitA.profPercent ?? item.profPercentDeal ?? 0));
      setUnitAMisPercent(String(item.unitA.misPercent ?? 0));
      setUnitARoundUpSale(String(item.unitA.roundUpSale ?? item.unitA.roundUp ?? item.roundUpSale ?? item.roundUp ?? 0));
      setUnitARoundUpMrp(String(item.unitA.roundUpMrp ?? item.roundUpMrp ?? 0));
      setUnitASalePrice(String(item.unitA.salePrice ?? item.saleRate ?? 0));
      setUnitAMrp(String(item.unitA.mrp ?? item.mrp ?? 0));
      setUnitAActive(item.unitA.isActive !== false);
    } else {
      setUnitAName(item.unit || '');
      setUnitABasicPrice(String(item.purchaseRate || 0));
      setUnitAGstPercent(String(item.gstPercent || 0));
      setUnitATranPercent('0');
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
      setUnitBName(item.unitB.unitName || '');
      setUnitBConversion(String(item.unitB.conversionFactor ?? 40));
      setUnitBBasicPrice(String(item.unitB.basicPrice ?? 0));
      setUnitBGstPercent(String(item.unitB.gstPercent ?? 0));
      setUnitBTranPercent(String(item.unitB.tranPercent ?? 0));
      setUnitBProfAm(String(item.unitB.profPercentAm ?? 0));
      setUnitBProfDeal(String(item.unitB.profPercentDeal ?? item.unitB.profPercent ?? 0));
      setUnitBMisPercent(String(item.unitB.misPercent ?? 0));
      setUnitBRoundUpSale(String(item.unitB.roundUpSale ?? item.unitB.roundUp ?? 0));
      setUnitBRoundUpMrp(String(item.unitB.roundUpMrp ?? 0));
      setUnitBSalePrice(String(item.unitB.salePrice ?? 0));
      setUnitBMrp(String(item.unitB.mrp ?? 0));
      setUnitBActive(item.unitB.isActive !== false);

      const bProfDeal = String(item.unitB.profPercentDeal ?? item.unitB.profPercent ?? 0);
      const bProfAm = String(item.unitB.profPercentAm ?? 0);
      const aProfDeal = String(item.unitA?.profPercentDeal ?? item.unitA?.profPercent ?? item.profPercentDeal ?? 0);
      const aProfAm = String(item.unitA?.profPercentAm ?? item.profPercentAm ?? 0);
      setIsUnitBProfCustomized(bProfDeal !== aProfDeal || bProfAm !== aProfAm);
    } else {
      setUnitBName('');
      setUnitBConversion('40');
      setUnitBBasicPrice(String(item.purchaseRate || 0));
      setUnitBGstPercent(String(item.gstPercent || 0));
      setUnitBTranPercent('0');
      setUnitBProfAm('0');
      setUnitBProfDeal('0');
      setUnitBMisPercent('0');
      setUnitBRoundUpSale('0');
      setUnitBRoundUpMrp('0');
      setUnitBSalePrice(String(item.saleRate || 0));
      setUnitBMrp(String(item.mrp || 0));
      setUnitBActive(true);
      setIsUnitBProfCustomized(false);
    }

    setMinStock(String(item.minStock || 0));
    setOpeningStock(String(item.openingStock || 0));
    setDisableRestockNotification(Boolean(item.disableRestockNotification));
    showToast(viewOnly ? `Viewing ${item.name}` : `Loaded ${item.name} for editing`, 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Add new item: Unit A & B blank matching Hindi note!
  const handleCreateNew = () => {
    setSelectedItemId(null);
    setIsTouched(false);
    setIsJustSaved(false);
    setIsViewOnly(false);
    setHasSecondaryUnit(true);
    setSno(StockEngine.getNextItemSno());
    setName('');
    setHsn('');
    setDescription('');
    setCategory('');
    if (suppliers.length > 0) setSupplierId(suppliers[0].id);
    setIsActive(true);
    setDisableRestockNotification(false);

    // Keep Unit A & B unit names BLANK on Add New!
    setUnitAName('');
    setUnitABasicPrice('0');
    setUnitAGstPercent('0');
    setUnitATranPercent('0');
    setUnitAProfAm('0');
    setUnitAProfDeal('0');
    setUnitAMisPercent('0');
    setUnitARoundUpSale('0');
    setUnitARoundUpMrp('0');
    setUnitASalePrice('0');
    setUnitAMrp('0');
    setUnitAActive(true);

    setUnitBName('');
    setUnitBConversion('40');
    setUnitBBasicPrice('0');
    setUnitBGstPercent('0');
    setUnitBTranPercent('0');
    setUnitBProfAm('0');
    setUnitBProfDeal('0');
    setUnitBMisPercent('0');
    setUnitBRoundUpSale('0');
    setUnitBRoundUpMrp('0');
    setUnitBSalePrice('0');
    setUnitBMrp('0');
    setUnitBActive(true);
    setIsUnitBProfCustomized(false);

    setMinStock('0');
    setOpeningStock('0');
    showToast('Ready to create new item (Units blank)', 'info');
  };

  // Repeat / Clone Item
  const handleRepeat = () => {
    if (!name.trim()) {
      showToast('No item loaded to repeat', 'error');
      return;
    }
    setSelectedItemId(null);
    setSno(StockEngine.getNextItemSno());
    setName(`${name} (COPY)`);
    setIsTouched(true);
    setIsViewOnly(false);
    showToast('Item duplicated. Modify and click Save.', 'info');
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
      gstPercent: Number(unitAGstPercent) || 0,
      roundUp: Number(unitARoundUpSale) || 0,
      roundUpSale: Number(unitARoundUpSale) || 0,
      roundUpMrp: Number(unitARoundUpMrp) || 0,
      profPercentAm: Number(unitAProfAm) || 0,
      profPercentDeal: Number(unitAProfDeal) || 0,
      unitA: {
        unitName: unitAName.trim() || 'Unit A',
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
        unitName: unitBName.trim() || 'Unit B',
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
      disableRestockNotification,
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

  const confirmDelete = async () => {
    if (deleteDialog.id) {
      await db.deleteItem(deleteDialog.id);
      showToast(`Item "${deleteDialog.name}" deleted.`, 'info');
      setDeleteDialog({ isOpen: false, id: '', name: '' });
      handleCreateNew();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Filtered summaries for bottom table matching mockup filters
  const filteredSummaries = useMemo(() => {
    return stockSummaries.filter(s => {
      if (filterCategory !== 'ALL' && s.item.category && s.item.category.toLowerCase() !== filterCategory.toLowerCase()) {
        return false;
      }
      if (filterItem !== 'ALL' && s.item.name.toLowerCase() !== filterItem.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [stockSummaries, filterCategory, filterItem]);

  return (
    <div className="content-panel-grey">
      {/* Top Header Strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="pill-header-lavender" style={{ fontSize: '1.25rem', padding: '6px 36px', fontWeight: 900 }}>
            ITEM
          </div>
          <span className="active-mode-indicator is-creating" style={{ padding: '4px 12px', borderRadius: '16px', background: '#DCFCE7', color: '#166534', fontWeight: 800, fontSize: '0.82rem' }}>
            ● Creating New Item
          </span>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#4B5563', background: '#FFFFFF', padding: '5px 12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
            <span><b>Ctrl+S:</b> Save Item</span>
            <span style={{ color: '#D1D5DB' }}>|</span>
            <span><b>Alt+N:</b> New Item</span>
            <span style={{ color: '#D1D5DB' }}>|</span>
            <span><b>Alt+P:</b> Print</span>
          </div>

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
              gap: '6px'
            }}
          >
            <FileSpreadsheet size={15} color="#16A34A" />
            Import from Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Main Form Container */}
      <div
        style={{
          background: '#FFFFFF',
          border: '2px solid #000000',
          borderRadius: '12px',
          padding: '20px',
          maxWidth: '960px',
          margin: '0 auto 24px'
        }}
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Top Toggles Bar matching mockup */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 12px',
              border: '1.5px solid #000000',
              borderRadius: '8px',
              background: '#FFFFFF'
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => { setIsTouched(true); setIsActive(e.target.checked); }}
                style={{ width: '16px', height: '16px' }}
              />
              Active Item
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={disableRestockNotification}
                onChange={e => { setIsTouched(true); setDisableRestockNotification(e.target.checked); }}
                style={{ width: '16px', height: '16px' }}
              />
              Disable Restock Alert
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={hasSecondaryUnit}
                onChange={e => { setIsTouched(true); setHasSecondaryUnit(e.target.checked); }}
                style={{ width: '16px', height: '16px' }}
              />
              Secondary Unit (Unit B) ON
            </label>
          </div>

          {/* Row 1: Item Name (with datalist) and HSN */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
                Item Name *
              </label>
              <input
                ref={itemNameInputRef}
                type="text"
                list="item-name-suggestions"
                className="input-text-clean"
                value={name}
                onChange={e => {
                  setIsTouched(true);
                  setName(e.target.value);
                  // If matching existing item, offer to load
                  const matched = items.find(it => it.name.toUpperCase() === e.target.value.trim().toUpperCase());
                  if (matched) {
                    loadItemIntoForm(matched, false);
                  }
                }}
                placeholder="e.g. ASTER / PRINTING SHEET 70 GSM"
                required
                style={{ width: '100%', fontWeight: 800 }}
              />
              {/* Datalist for Item Name Suggestions matching Hindi note */}
              <datalist id="item-name-suggestions">
                {items.map(it => (
                  <option key={it.id} value={it.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
                HSN Code (Optional)
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={hsn}
                onChange={e => { setIsTouched(true); setHsn(e.target.value); }}
                placeholder="e.g. 4802"
                style={{ width: '100%', fontFamily: 'monospace' }}
              />
            </div>
          </div>

          {/* Row 2: Description, Category (with datalist), Supplier (sorted A-Z) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
                Description
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={description}
                onChange={e => { setIsTouched(true); setDescription(e.target.value); }}
                placeholder="e.g. High Quality Glossy Aster Sheets"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
                Category
              </label>
              <input
                type="text"
                list="category-suggestions"
                className="input-text-clean"
                value={category}
                onChange={e => { setIsTouched(true); setCategory(e.target.value); }}
                placeholder="e.g. Paper & Sheets"
                style={{ width: '100%' }}
              />
              {/* Datalist for Category list show matching Hindi note */}
              <datalist id="category-suggestions">
                {existingCategories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
                Supplier (Alphabetical A-Z)
              </label>
              <select
                className="input-text-clean"
                value={supplierId}
                onChange={e => { setIsTouched(true); setSupplierId(e.target.value); }}
                style={{ width: '100%', fontWeight: 700 }}
              >
                <option value="">-- Select Supplier --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* UNIT-A SECTION matching mockup */}
          <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 900, fontSize: '0.95rem' }}>UNIT-A :</span>
                <input
                  type="text"
                  className="input-text-clean"
                  value={unitAName}
                  onChange={e => { setIsTouched(true); setUnitAName(e.target.value); }}
                  style={{ width: '90px', color: '#DC2626', fontWeight: 900, textAlign: 'center' }}
                  placeholder=""
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={unitAActive}
                  onChange={e => { setIsTouched(true); setUnitAActive(e.target.checked); }}
                />
                Active
              </label>
            </div>

            {/* Pricing 10-column Grid */}
            <div className="pricing-calc-scroll-wrapper">
              <div className="pricing-calc-grid-10">
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block' }}>Besic Price</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitABasicPrice}
                    onChange={e => { setIsTouched(true); setUnitABasicPrice(e.target.value); }}
                    style={{ textAlign: 'center', fontWeight: 700 }}
                  />
                  <div className="subtext-calc-red">{unitABreakdown.basicPrice}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block' }}>GST %</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitAGstPercent}
                    onChange={e => handleUnitAChange('gst', e.target.value)}
                    style={{ textAlign: 'center', fontWeight: 700 }}
                  />
                  <div className="subtext-calc-red">{unitABreakdown.gstAmt}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block' }}>tran%</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitATranPercent}
                    onChange={e => handleUnitAChange('tran', e.target.value)}
                    style={{ textAlign: 'center', fontWeight: 700 }}
                  />
                  <div className="subtext-calc-red">{unitABreakdown.tranAmt}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block' }}>mis%</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitAMisPercent}
                    onChange={e => handleUnitAChange('mis', e.target.value)}
                    style={{ textAlign: 'center', fontWeight: 700 }}
                  />
                  <div className="subtext-calc-red">{unitABreakdown.misAmt}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', color: '#6D28D9' }}>Prof% -S</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitAProfDeal}
                    onChange={e => handleUnitAChange('profDeal', e.target.value)}
                    style={{ textAlign: 'center', fontWeight: 700, borderColor: '#8B5CF6' }}
                  />
                  <div className="subtext-calc-red">{unitABreakdown.profDealAmt}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', color: '#6D28D9' }}>Round-S</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitARoundUpSale}
                    onChange={e => { setIsTouched(true); setUnitARoundUpSale(e.target.value); }}
                    style={{ textAlign: 'center', fontWeight: 700, borderColor: '#8B5CF6' }}
                  />
                  <div className="subtext-calc-red">{unitABreakdown.roundUpSale}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', color: '#6D28D9' }}>Sale Price</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitABreakdown.salePrice}
                    readOnly
                    style={{ textAlign: 'center', fontWeight: 900, color: '#6D28D9', background: '#F5F3FF' }}
                  />
                  <div className="subtext-calc-red">{unitABreakdown.salePrice}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', color: '#1E40AF' }}>Prof% -M</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitAProfAm}
                    onChange={e => handleUnitAChange('profAm', e.target.value)}
                    style={{ textAlign: 'center', fontWeight: 700, borderColor: '#3B82F6' }}
                  />
                  <div className="subtext-calc-red">{unitABreakdown.profAmAmt}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', color: '#1E40AF' }}>Round-M</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitARoundUpMrp}
                    onChange={e => { setIsTouched(true); setUnitARoundUpMrp(e.target.value); }}
                    style={{ textAlign: 'center', fontWeight: 700, borderColor: '#3B82F6' }}
                  />
                  <div className="subtext-calc-red">{unitABreakdown.roundUpMrp}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', color: '#1E40AF' }}>mrp</label>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitABreakdown.mrp}
                    readOnly
                    style={{ textAlign: 'center', fontWeight: 900, color: '#1E40AF', background: '#EFF6FF' }}
                  />
                  <div className="subtext-calc-red">{unitABreakdown.mrp}</div>
                </div>
              </div>
            </div>
          </div>

          {/* UNIT-B SECTION matching mockup */}
          {hasSecondaryUnit && (
            <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 900, fontSize: '0.95rem' }}>UNIT-B :</span>
                  <input
                    type="text"
                    className="input-text-clean"
                    value={unitBName}
                    onChange={e => { setIsTouched(true); setUnitBName(e.target.value); }}
                    style={{ width: '80px', color: '#DC2626', fontWeight: 900, textAlign: 'center' }}
                    placeholder=""
                  />
                  <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>1 {unitAName || 'Roll'} =</span>
                  <input
                    type="number"
                    step="any"
                    className="input-text-clean"
                    value={unitBConversion}
                    onChange={e => { setIsTouched(true); setUnitBConversion(e.target.value); }}
                    style={{ width: '60px', textAlign: 'center', fontWeight: 900, color: '#059669' }}
                  />
                  <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{unitBName || 'Mt.'}</span>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={unitBActive}
                    onChange={e => { setIsTouched(true); setUnitBActive(e.target.checked); }}
                  />
                  Active Unit B
                </label>
              </div>

              {/* Pricing 10-column Grid for Unit B */}
              <div className="pricing-calc-scroll-wrapper">
                <div className="pricing-calc-grid-10">
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block' }}>Besic Price</label>
                    <input
                      type="number"
                      step="any"
                      className="input-text-clean"
                      value={unitBBasicPrice}
                      onChange={e => { setIsTouched(true); setUnitBBasicPrice(e.target.value); }}
                      style={{ textAlign: 'center', fontWeight: 700 }}
                    />
                    <div className="subtext-calc-red">{unitBBreakdown.basicPrice}</div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block' }}>GST %</label>
                    <input
                      type="number"
                      step="any"
                      className="input-text-clean"
                      value={unitBGstPercent}
                      onChange={e => { setIsTouched(true); setUnitBGstPercent(e.target.value); }}
                      style={{ textAlign: 'center', fontWeight: 700 }}
                    />
                    <div className="subtext-calc-red">{unitBBreakdown.gstAmt}</div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block' }}>tran%</label>
                    <input
                      type="number"
                      step="any"
                      className="input-text-clean"
                      value={unitBTranPercent}
                      onChange={e => { setIsTouched(true); setUnitBTranPercent(e.target.value); }}
                      style={{ textAlign: 'center', fontWeight: 700 }}
                    />
                    <div className="subtext-calc-red">{unitBBreakdown.tranAmt}</div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block' }}>mis%</label>
                    <input
                      type="number"
                      step="any"
                      className="input-text-clean"
                      value={unitBMisPercent}
                      onChange={e => { setIsTouched(true); setUnitBMisPercent(e.target.value); }}
                      style={{ textAlign: 'center', fontWeight: 700 }}
                    />
                    <div className="subtext-calc-red">{unitBBreakdown.misAmt}</div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', color: '#6D28D9' }}>Prof% -S</label>
                    <input
                      type="number"
                      step="any"
                      className="input-text-clean"
                      value={unitBProfDeal}
                      onChange={e => {
                        setIsTouched(true);
                        setIsUnitBProfCustomized(true);
                        setUnitBProfDeal(e.target.value);
                      }}
                      style={{ textAlign: 'center', fontWeight: 700, borderColor: '#8B5CF6' }}
                    />
                    <div className="subtext-calc-red">{unitBBreakdown.profDealAmt}</div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', color: '#6D28D9' }}>Round-S</label>
                    <input
                      type="number"
                      step="any"
                      className="input-text-clean"
                      value={unitBRoundUpSale}
                      onChange={e => { setIsTouched(true); setUnitBRoundUpSale(e.target.value); }}
                      style={{ textAlign: 'center', fontWeight: 700, borderColor: '#8B5CF6' }}
                    />
                    <div className="subtext-calc-red">{unitBBreakdown.roundUpSale}</div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', color: '#6D28D9' }}>Sale Price</label>
                    <input
                      type="number"
                      step="any"
                      className="input-text-clean"
                      value={unitBBreakdown.salePrice}
                      readOnly
                      style={{ textAlign: 'center', fontWeight: 900, color: '#6D28D9', background: '#F5F3FF' }}
                    />
                    <div className="subtext-calc-red">{unitBBreakdown.salePrice}</div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', color: '#1E40AF' }}>Prof% -M</label>
                    <input
                      type="number"
                      step="any"
                      className="input-text-clean"
                      value={unitBProfAm}
                      onChange={e => {
                        setIsTouched(true);
                        setIsUnitBProfCustomized(true);
                        setUnitBProfAm(e.target.value);
                      }}
                      style={{ textAlign: 'center', fontWeight: 700, borderColor: '#3B82F6' }}
                    />
                    <div className="subtext-calc-red">{unitBBreakdown.profAmAmt}</div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', color: '#1E40AF' }}>Round-M</label>
                    <input
                      type="number"
                      step="any"
                      className="input-text-clean"
                      value={unitBRoundUpMrp}
                      onChange={e => { setIsTouched(true); setUnitBRoundUpMrp(e.target.value); }}
                      style={{ textAlign: 'center', fontWeight: 700, borderColor: '#3B82F6' }}
                    />
                    <div className="subtext-calc-red">{unitBBreakdown.roundUpMrp}</div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', color: '#1E40AF' }}>mrp</label>
                    <input
                      type="number"
                      step="any"
                      className="input-text-clean"
                      value={unitBBreakdown.mrp}
                      readOnly
                      style={{ textAlign: 'center', fontWeight: 900, color: '#1E40AF', background: '#EFF6FF' }}
                    />
                    <div className="subtext-calc-red">{unitBBreakdown.mrp}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stock Thresholds */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
                Min Stock (Reorder Alert Threshold)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                className="input-text-clean"
                value={minStock}
                onChange={e => { setIsTouched(true); setMinStock(e.target.value); }}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
                Opening Stock
              </label>
              <input
                type="number"
                step="any"
                min="0"
                className="input-text-clean"
                value={openingStock}
                onChange={e => { setIsTouched(true); setOpeningStock(e.target.value); }}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Action Buttons row matching mockup: Add New | Edit | Repit | Del | Save | Print */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
            <button
              type="button"
              onClick={handleCreateNew}
              style={{
                background: '#E9D5FF',
                color: '#7E22CE',
                border: '1.5px solid #C084FC',
                borderRadius: '20px',
                padding: '6px 22px',
                fontWeight: 900,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Add New
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedItemId) setIsViewOnly(false);
                else showToast('Select an item from the list below to edit', 'info');
              }}
              style={{
                background: '#E9D5FF',
                color: '#DC2626',
                border: '1.5px solid #C084FC',
                borderRadius: '20px',
                padding: '6px 22px',
                fontWeight: 900,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Edit
            </button>

            <button
              type="button"
              onClick={handleRepeat}
              style={{
                background: '#E9D5FF',
                color: '#DC2626',
                border: '1.5px solid #C084FC',
                borderRadius: '20px',
                padding: '6px 22px',
                fontWeight: 900,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Repit
            </button>

            <button
              type="button"
              onClick={handleDelete}
              style={{
                background: '#E9D5FF',
                color: '#6B7280',
                border: '1.5px solid #C084FC',
                borderRadius: '20px',
                padding: '6px 22px',
                fontWeight: 900,
                fontSize: '0.9rem',
                cursor: selectedItemId ? 'pointer' : 'not-allowed',
                opacity: selectedItemId ? 1 : 0.6
              }}
            >
              Del
            </button>

            <button
              type="submit"
              style={{
                background: '#86EFAC',
                color: '#15803D',
                border: '1.5px solid #22C55E',
                borderRadius: '20px',
                padding: '8px 36px',
                fontWeight: 900,
                fontSize: '1.05rem',
                cursor: 'pointer'
              }}
            >
              Save
            </button>

            <button
              type="button"
              onClick={handlePrint}
              style={{
                background: '#E9D5FF',
                color: '#DC2626',
                border: '1.5px solid #C084FC',
                borderRadius: '20px',
                padding: '6px 22px',
                fontWeight: 900,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Print
            </button>
          </div>
        </form>
      </div>

      {/* BOTTOM REGISTER & TABLE matching mockup */}
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        {/* Filters row above table */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showCategoryWise}
              onChange={e => setShowCategoryWise(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            Show Category Wise
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>Select Cate. :</span>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              style={{
                border: '1.5px solid #000000',
                borderRadius: '4px',
                padding: '4px 10px',
                fontWeight: 800,
                fontSize: '0.85rem',
                background: '#FFFFFF'
              }}
            >
              <option value="ALL">Q ALL</option>
              {existingCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>Select Item :</span>
            <select
              value={filterItem}
              onChange={e => setFilterItem(e.target.value)}
              style={{
                border: '1.5px solid #000000',
                borderRadius: '4px',
                padding: '4px 10px',
                fontWeight: 800,
                fontSize: '0.85rem',
                background: '#FFFFFF'
              }}
            >
              <option value="ALL">Q ALL</option>
              {items.map(it => (
                <option key={it.id} value={it.name}>{it.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Register Table with Lavender Header #D4C4FB */}
        <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '4px', overflow: 'hidden' }}>
          <div className="table-responsive-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#D4C4FB', borderBottom: '2px solid #000000' }}>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.82rem' }}>
                    ITEM
                  </th>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.82rem' }}>
                    SUPPLIER
                  </th>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.82rem', width: '70px', textAlign: 'center' }}>
                    UNIT A
                  </th>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.82rem', width: '80px', textAlign: 'right' }}>
                    BASIC PRICE
                  </th>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.82rem', width: '80px', textAlign: 'right' }}>
                    SALE PRICE
                  </th>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.82rem', width: '70px', textAlign: 'right' }}>
                    MRP
                  </th>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.82rem', width: '70px', textAlign: 'center' }}>
                    LIVE STOCK
                  </th>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.82rem', width: '70px', textAlign: 'center' }}>
                    RE-STOCK
                  </th>
                  <th style={{ padding: '8px 10px', fontWeight: 900, fontSize: '0.82rem', width: '90px', textAlign: 'center' }}>
                    ACTION
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSummaries.map(s => {
                  const it = s.item;
                  const isSelected = selectedItemId === it.id;
                  const unitName = it.unitA?.unitName || it.unit || 'PCS';
                  const basicPrice = it.unitA?.basicPrice ?? it.purchaseRate ?? 0;
                  const salePrice = it.unitA?.salePrice ?? it.saleRate ?? 0;
                  const mrp = it.unitA?.mrp ?? it.mrp ?? 0;

                  return (
                    <tr
                      key={it.id}
                      onClick={() => loadItemIntoForm(it, true)}
                      onDoubleClick={() => loadItemIntoForm(it, false)}
                      style={{
                        borderBottom: '1px solid #000000',
                        background: isSelected ? '#EFF6FF' : '#FFFFFF',
                        cursor: 'pointer'
                      }}
                    >
                      <td style={{ padding: '6px 10px', borderRight: '1px solid #000000', fontWeight: 800, fontSize: '0.82rem' }}>
                        {it.name}
                      </td>
                      <td style={{ padding: '6px 10px', borderRight: '1px solid #000000', fontWeight: 700, fontSize: '0.82rem' }}>
                        {it.supplierName || '-'}
                      </td>
                      <td style={{ padding: '6px 8px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 800, fontSize: '0.82rem' }}>
                        {unitName}
                      </td>
                      <td style={{ padding: '6px 10px', borderRight: '1px solid #000000', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem' }}>
                        {basicPrice}
                      </td>
                      <td style={{ padding: '6px 10px', borderRight: '1px solid #000000', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem' }}>
                        {salePrice}
                      </td>
                      <td style={{ padding: '6px 10px', borderRight: '1px solid #000000', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem' }}>
                        {mrp}
                      </td>
                      <td style={{ padding: '6px 10px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900, fontSize: '0.85rem' }}>
                        {s.closingStock}
                      </td>
                      <td style={{ padding: '6px 10px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900, fontSize: '0.82rem', color: s.isLowStock ? '#DC2626' : '#15803D' }}>
                        {s.isLowStock ? 'YES' : ''}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            openItemLedger(it.id);
                          }}
                          style={{
                            background: '#E9D5FF',
                            color: '#7E22CE',
                            border: '1px solid #C084FC',
                            borderRadius: '12px',
                            padding: '2px 10px',
                            fontWeight: 900,
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          LEADGER
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Mode Prompt */}
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
        cancelText="Keep View Only"
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: '', name: '' })}
        onConfirm={confirmDelete}
        title="Delete Item"
        message={`Are you sure you want to delete item "${deleteDialog.name}"?`}
      />

      {/* Excel Bulk Import Modal */}
      <ExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
      />
    </div>
  );
};
