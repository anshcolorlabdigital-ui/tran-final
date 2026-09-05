import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Item, SelfUse, SelfUseItem } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { getTodayDateString } from '../../utils/dateUtils';
import { SelfUsePrintSlip } from './SelfUsePrintSlip';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ItemSearchSelect } from '../common/ItemSearchSelect';
import { Search } from 'lucide-react';

export const SelfUseView: React.FC = () => {
  const { showToast, showAlert, openQuickModal, refreshKey, selectedDate } = useApp();
  const { hasPermission } = useAuth();

  const items = useMemo(() => db.getItems().filter(i => i.isActive !== false), [refreshKey]);
  const selfUseHistory = useMemo(() => db.getSelfUses(), [refreshKey]);

  // Unique categories from items
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [items]);

  const [billDate, setBillDate] = useState<string>(getTodayDateString());
  const [billNo, setBillNo] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingSelfUseId, setEditingSelfUseId] = useState<string | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [isEditPromptOpen, setIsEditPromptOpen] = useState(false);

  // Line item state
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [unitAQty, setUnitAQty] = useState<string>('1');
  const [unitARate, setUnitARate] = useState<string>('0');

  const [unitBQty, setUnitBQty] = useState<string>('1');
  const [unitBRate, setUnitBRate] = useState<string>('0');

  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // Table items
  const [selfUseItems, setSelfUseItems] = useState<SelfUseItem[]>([]);
  const [isTouched, setIsTouched] = useState(false);
  const [searchHistory, setSearchHistory] = useState('');

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (!editingSelfUseId) {
      setBillNo(StockEngine.getNextBillNumber('SELF_USE'));
      setBillDate(selectedDate || getTodayDateString());
      if (categories.length > 0 && !selectedCategory) {
        setSelectedCategory(categories[0]);
      }
    }
  }, [editingSelfUseId, selectedDate, categories, refreshKey]);

  const selectedItemObj = useMemo(() => {
    return items.find(i => i.id === selectedItemId);
  }, [items, selectedItemId]);

  const hasUnitB = Boolean(
    selectedItemObj?.hasSecondaryUnit &&
    selectedItemObj?.unitB &&
    selectedItemObj.unitB.unitName
  );

  const handleItemSelect = (itemId: string) => {
    setIsTouched(true);
    setSelectedItemId(itemId);
    setEditingItemIndex(null);
    const item = items.find(i => i.id === itemId);
    if (item) {
      const settings = db.getSettings();
      const baseA = Number(item.unitA?.basicPrice ?? item.purchaseRate ?? 0);
      const gstPctA = Number(item.unitA?.gstPercent ?? item.gstPercent ?? settings.defaultGstPercent ?? 18);
      const tranPctA = Number(item.unitA?.tranPercent ?? 10);
      // Landed In-House Cost = Base Price + GST (18%) + Transport (%)
      const landedRateA = Number((baseA + (baseA * gstPctA / 100) + (baseA * tranPctA / 100)).toFixed(2));

      setUnitARate(String(landedRateA));
      setUnitAQty('1');

      if (item.hasSecondaryUnit && item.unitB) {
        const conv = Number(item.unitB.conversionFactor) || 1;
        const baseB = Number(item.unitB.basicPrice ?? (baseA / conv));
        const gstPctB = Number(item.unitB.gstPercent ?? gstPctA);
        const tranPctB = Number(item.unitB.tranPercent ?? tranPctA);
        const landedRateB = Number((baseB + (baseB * gstPctB / 100) + (baseB * tranPctB / 100)).toFixed(2));

        setUnitBRate(String(landedRateB));
        setUnitBQty('1');
      }
    }
  };

  // Filter items by category if selected
  const filteredCategoryItems = useMemo(() => {
    if (!selectedCategory) return items;
    return items.filter(i => i.category?.toLowerCase() === selectedCategory.toLowerCase());
  }, [items, selectedCategory]);

  const selectedItemCurrentStock = useMemo(() => {
    if (!selectedItemId) return 0;
    return StockEngine.getItemCurrentStock(selectedItemId);
  }, [selectedItemId, refreshKey]);

  const totalAmount = useMemo(() => {
    return Number(selfUseItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0).toFixed(2));
  }, [selfUseItems]);

  const isFormActive = Boolean(editingSelfUseId || selfUseItems.length > 0 || selectedItemId || isTouched);

  const handleAddUnitAItem = () => {
    setIsTouched(true);
    if (!selectedItemId || !selectedItemObj) {
      showAlert('Please select an item first.', 'Selection Required', 'warning');
      return;
    }
    const numQty = Number(unitAQty);
    if (!numQty || numQty <= 0) {
      showAlert('Please enter a quantity greater than 0 for Unit A.', 'Invalid Quantity', 'warning');
      return;
    }

    const rate = Number(unitARate) || 0;
    const amount = Number((rate * numQty).toFixed(2));
    const unitName = selectedItemObj.unitA?.unitName || selectedItemObj.unit || 'Units';

    const newItem: SelfUseItem = {
      id: `su-item-${Date.now()}-${Math.random()}`,
      itemId: selectedItemObj.id,
      sno: selectedItemObj.sno,
      itemName: `${selectedItemObj.name} (${unitName})`,
      unit: unitName,
      category: selectedItemObj.category,
      rate,
      qty: numQty,
      amount,
      conversionFactor: selectedItemObj.unitB?.conversionFactor || 1,
      isSecondaryUnit: false,
      baseQty: numQty
    };

    if (editingItemIndex !== null && editingItemIndex >= 0) {
      const updated = [...selfUseItems];
      updated[editingItemIndex] = newItem;
      setSelfUseItems(updated);
      setEditingItemIndex(null);
      showToast('Item updated in Self Use table', 'info');
    } else {
      setSelfUseItems(prev => [...prev, newItem]);
      showToast(`Added ${numQty} ${unitName} of ${selectedItemObj.name}`, 'success');
    }

    setUnitAQty('1');
  };

  const handleAddUnitBItem = () => {
    setIsTouched(true);
    if (!selectedItemId || !selectedItemObj || !selectedItemObj.unitB) {
      showAlert('Secondary unit not configured for this item.', 'Invalid Action', 'warning');
      return;
    }
    const numQty = Number(unitBQty);
    if (!numQty || numQty <= 0) {
      showAlert('Please enter a quantity greater than 0 for Unit B.', 'Invalid Quantity', 'warning');
      return;
    }

    const convFactor = Number(selectedItemObj.unitB.conversionFactor) || 1;
    const rate = Number(unitBRate) || 0;
    const amount = Number((rate * numQty).toFixed(2));
    const unitName = selectedItemObj.unitB.unitName || 'Unit B';
    const baseQty = Number((numQty / convFactor).toFixed(4));

    const newItem: SelfUseItem = {
      id: `su-item-${Date.now()}-${Math.random()}`,
      itemId: selectedItemObj.id,
      sno: selectedItemObj.sno,
      itemName: `${selectedItemObj.name} (${unitName})`,
      unit: unitName,
      category: selectedItemObj.category,
      rate,
      qty: numQty,
      amount,
      conversionFactor: convFactor,
      isSecondaryUnit: true,
      baseQty
    };

    if (editingItemIndex !== null && editingItemIndex >= 0) {
      const updated = [...selfUseItems];
      updated[editingItemIndex] = newItem;
      setSelfUseItems(updated);
      setEditingItemIndex(null);
      showToast('Item updated in Self Use table', 'info');
    } else {
      setSelfUseItems(prev => [...prev, newItem]);
      showToast(`Added ${numQty} ${unitName} (${baseQty} primary units) to Self Use`, 'success');
    }

    setUnitBQty('1');
  };

  const handleEditItem = (index: number) => {
    setIsTouched(true);
    const item = selfUseItems[index];
    const foundItem = items.find(i => i.id === item.itemId);
    if (foundItem?.category) setSelectedCategory(foundItem.category);
    setSelectedItemId(item.itemId);
    if (item.isSecondaryUnit) {
      setUnitBQty(String(item.qty));
      setUnitBRate(String(item.rate));
    } else {
      setUnitAQty(String(item.qty));
      setUnitARate(String(item.rate));
    }
    setEditingItemIndex(index);
  };

  const handleDeleteItem = (index: number) => {
    setIsTouched(true);
    setSelfUseItems(prev => prev.filter((_, i) => i !== index));
    if (editingItemIndex === index) {
      setEditingItemIndex(null);
      setSelectedItemId('');
    }
  };

  const [isJustSaved, setIsJustSaved] = useState(false);

  const handleNewEntry = () => {
    setEditingSelfUseId(null);
    setIsJustSaved(false);
    setIsTouched(false);
    setIsViewOnly(false);
    setBillNo(StockEngine.getNextBillNumber('SELF_USE'));
    setBillDate(getTodayDateString());
    setSelfUseItems([]);
    setSelectedItemId('');
    setUnitAQty('1');
    setUnitARate('0');
    setUnitBQty('1');
    setUnitBRate('0');
    setEditingItemIndex(null);
    showToast('New Self Use entry ready', 'info');
  };

  const handleSaveSelfUse = () => {
    if (isViewOnly) {
      setIsEditPromptOpen(true);
      return;
    }
    if (!billNo.trim()) {
      showAlert("Please enter the Self Use Bill / Voucher Number first.", 'Validation Error', 'warning');
      return;
    }
    if (selfUseItems.length === 0) {
      showAlert('Please add at least one item to the Self Use voucher.', 'Empty Line Items', 'warning');
      return;
    }

    const selfUseRecord: SelfUse = {
      id: editingSelfUseId || `su-${Date.now()}`,
      billNo: billNo.trim(),
      billDate,
      category: selectedCategory,
      items: selfUseItems,
      totalAmount,
      reason: 'Factory Internal Consumption / Sample',
      createdAt: new Date().toISOString()
    };

    // Automatically records SELF_USE_OUT stock movements, isolated from Sales
    db.saveSelfUse(selfUseRecord);

    if (editingSelfUseId) {
      setIsJustSaved(true);
      setIsTouched(false);
      setIsViewOnly(false);
      showToast(`Self Use voucher ${selfUseRecord.billNo} updated! Stock adjusted.`, 'success');
    } else {
      setIsJustSaved(false);
      setIsViewOnly(false);
      showToast(`Self Use voucher ${selfUseRecord.billNo} saved! Stock updated.`, 'success');
      handleNewEntry();
    }
  };

  const handleLoadSelfUseForEdit = (su: SelfUse, viewOnly: boolean = false) => {
    setIsJustSaved(false);
    setEditingSelfUseId(su.id);
    setIsViewOnly(viewOnly);
    setIsTouched(true);
    setBillNo(su.billNo);
    setBillDate(su.billDate);
    if (su.category) setSelectedCategory(su.category);
    setSelfUseItems(su.items);
    showToast(viewOnly ? `Viewing Self Use voucher ${su.billNo}` : `Loaded Self Use voucher ${su.billNo} for editing`, 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCurrentSelfUse = () => {
    if (!editingSelfUseId) {
      showAlert('Please select a saved voucher to delete.', 'Selection Required', 'warning');
      return;
    }
    if (!hasPermission('DELETE_SELF_USE')) {
      showAlert('You do not have permission to delete self use vouchers.', 'Permission Denied', 'error');
      return;
    }
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteSelfUse = () => {
    if (editingSelfUseId) {
      db.deleteSelfUse(editingSelfUseId);
      showToast(`Self Use voucher deleted. Stock restored.`, 'info');
      handleNewEntry();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const currentSelfUseForPrint: SelfUse = {
    id: editingSelfUseId || 'temp',
    billNo,
    billDate,
    category: selectedCategory,
    items: selfUseItems,
    totalAmount,
    reason: 'Internal Consumption',
    createdAt: new Date().toISOString()
  };

  const filteredHistory = useMemo(() => {
    const q = searchHistory.toLowerCase().trim();
    if (!q) return selfUseHistory;
    return selfUseHistory.filter(
      su =>
        su.billNo.toLowerCase().includes(q) ||
        (su.category && su.category.toLowerCase().includes(q)) ||
        su.billDate.includes(q)
    );
  }, [selfUseHistory, searchHistory]);

  const isEditing = Boolean(editingSelfUseId && !isViewOnly);
  const isViewing = Boolean(editingSelfUseId && isViewOnly);
  const isCreating = Boolean(!editingSelfUseId && !isJustSaved && (isTouched || selfUseItems.length > 0 || selectedItemId));

  const cardStateClass = isJustSaved
    ? 'is-saved-yellow'
    : isViewing
    ? 'is-initial-blue'
    : isEditing
    ? 'is-editing-pink'
    : isCreating
    ? 'is-creating-green'
    : 'is-initial-blue';

  return (
    <div className="content-panel-grey">
      <SelfUsePrintSlip selfUse={currentSelfUseForPrint} />

      {/* Top Header Strip matching self use new.jpg */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="pill-header-lavender" style={{ fontSize: '1.25rem', padding: '8px 36px', minWidth: '220px', textAlign: 'center' }}>
            SELF USE
          </div>
          {isJustSaved ? (
            <span className="active-mode-indicator is-saved">
              ● Saved / Updated Just Now ({billNo})
            </span>
          ) : isViewing ? (
            <span className="active-mode-indicator is-initial" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B' }}>
              ● Viewing Self Use Voucher: {billNo} (Read Only — Double-Click to Edit)
            </span>
          ) : isEditing ? (
            <span className="active-mode-indicator is-editing">
              ● Editing Self Use Voucher ({billNo})
            </span>
          ) : isCreating ? (
            <span className="active-mode-indicator is-creating">
              ● Creating New Self Use Entry
            </span>
          ) : (
            <span className="active-mode-indicator is-initial">
              ● Ready for New Entry
            </span>
          )}
        </div>
      </div>

      {/* Main Form Container: Light Blue on Initial, Light Green on Creating, Light Pink on Editing */}
      <div
        className={`dynamic-entry-card ${cardStateClass}`}
        style={{
          maxWidth: '850px',
          margin: '0 auto',
          position: 'relative'
        }}
      >
        {isViewing && (
          <div
            onClick={() => setIsEditPromptOpen(true)}
            style={{
              marginBottom: '16px',
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
              🔒 View-Only Mode: Self Use voucher is locked against accidental edits. Click anywhere or press button to edit.
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

        <div
          onClickCapture={isViewing ? (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsEditPromptOpen(true);
          } : undefined}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
        {/* Top Dates & Bill No Row */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 900, fontSize: '0.9rem' }}>BILL DATE</label>
            <input
              type="date"
              className="input-text-clean"
              value={billDate}
              onChange={e => {
                setIsTouched(true);
                setBillDate(e.target.value);
              }}
              style={{ width: '140px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 900, fontSize: '0.9rem' }}>BILL NO.</label>
            <input
              type="text"
              className="input-text-clean"
              value={billNo}
              onChange={e => {
                setIsTouched(true);
                setBillNo(e.target.value);
              }}
              style={{ width: '140px', fontWeight: 800 }}
            />
          </div>
        </div>

        {/* CATEGORY SELECTION matching self use new.jpg */}
        <div style={{ display: 'grid', gridTemplateColumns: '85px 1fr 34px', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontWeight: 900, fontSize: '1.05rem' }}>CATG. :</label>
          <select
            className="input-text-clean"
            value={selectedCategory}
            onChange={e => {
              setIsTouched(true);
              setSelectedCategory(e.target.value);
              setSelectedItemId('');
            }}
            style={{ fontSize: '0.95rem', height: '38px', fontWeight: 700 }}
          >
            <option value="">-- All Categories --</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-quick-n"
            title="Create Item / Category"
            onClick={() => openQuickModal('ITEM', () => setIsTouched(true))}
          >
            N
          </button>
        </div>

        {/* ITEM SELECTION matching self use new.jpg */}
        <div style={{ display: 'grid', gridTemplateColumns: '85px 1fr', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontWeight: 900, fontSize: '1.05rem' }}>ITEM :</label>
          <ItemSearchSelect
            items={filteredCategoryItems}
            selectedItemId={selectedItemId}
            onSelect={handleItemSelect}
            onQuickAdd={() => openQuickModal('ITEM', (newId) => handleItemSelect(newId))}
            placeholder="Type to search item (e.g. ASTER)..."
          />
        </div>

        {/* DUAL PRICING / CONSUMPTION INPUT CARDS (UNIT-A & UNIT-B) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Card 1: Unit A (Primary) */}
          <div
            style={{
              background: '#FFFFFF',
              border: '1.5px solid #000000',
              borderRadius: '8px',
              padding: '10px 12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 900, fontSize: '0.95rem', color: '#1E3A8A' }}>
                UNIT-A : {selectedItemObj?.unitA?.unitName || selectedItemObj?.unit || 'Roll'} (Primary)
              </span>
              <span style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 700 }}>
                Available Stock: {selectedItemCurrentStock} {selectedItemObj?.unitA?.unitName || selectedItemObj?.unit || 'Units'}
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 1.2fr auto',
                gap: '12px',
                alignItems: 'flex-end'
              }}
            >
              <div>
                <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.75rem', textAlign: 'center', marginBottom: '2px' }}>
                  Rate (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input-text-clean"
                  value={unitARate}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitARate(e.target.value);
                  }}
                  style={{ textAlign: 'center', padding: '6px', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.75rem', textAlign: 'center', marginBottom: '2px' }}>
                  Qty ({selectedItemObj?.unitA?.unitName || 'Unit A'})
                </label>
                <input
                  type="number"
                  min="1"
                  className="input-text-clean"
                  value={unitAQty}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitAQty(e.target.value);
                  }}
                  style={{ textAlign: 'center', padding: '6px', fontWeight: 900, color: '#EA3943' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.75rem', textAlign: 'center', marginBottom: '2px' }}>
                  Amount (₹)
                </label>
                <input
                  type="text"
                  readOnly
                  className="input-text-clean"
                  value={((Number(unitARate) || 0) * (Number(unitAQty) || 0)).toFixed(2)}
                  style={{ textAlign: 'center', background: '#F3F4F6', padding: '6px', fontWeight: 800 }}
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleAddUnitAItem}
                  className="btn-customer-save"
                  style={{ padding: '8px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                >
                  + Add {selectedItemObj?.unitA?.unitName || 'Unit A'}
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Unit B (Shown if secondary unit is enabled) */}
          {hasUnitB && (
            <div
              style={{
                background: '#FFFFFF',
                border: '1.5px solid #000000',
                borderRadius: '8px',
                padding: '10px 12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 900, fontSize: '0.95rem', color: '#047857' }}>
                    UNIT-B : {selectedItemObj?.unitB?.unitName || 'Unit B'} (Secondary)
                  </span>
                  <span style={{ fontSize: '0.8rem', background: '#DCFCE7', color: '#166534', padding: '1px 8px', borderRadius: '10px', fontWeight: 800 }}>
                    1 {selectedItemObj?.unitA?.unitName || 'Unit A'} = {selectedItemObj?.unitB?.conversionFactor || 40} {selectedItemObj?.unitB?.unitName || 'Unit B'}
                  </span>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 700 }}>
                  Equivalent in {selectedItemObj?.unitB?.unitName || 'Unit B'}: {Number((selectedItemCurrentStock * (Number(selectedItemObj?.unitB?.conversionFactor) || 1)).toFixed(1))} {selectedItemObj?.unitB?.unitName}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1.2fr auto',
                  gap: '12px',
                  alignItems: 'flex-end'
                }}
              >
                <div>
                  <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.75rem', textAlign: 'center', marginBottom: '2px' }}>
                    Rate (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-text-clean"
                    value={unitBRate}
                    onChange={e => {
                      setIsTouched(true);
                      setUnitBRate(e.target.value);
                    }}
                    style={{ textAlign: 'center', padding: '6px', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.75rem', textAlign: 'center', marginBottom: '2px' }}>
                    Qty ({selectedItemObj?.unitB?.unitName || 'Unit B'})
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input-text-clean"
                    value={unitBQty}
                    onChange={e => {
                      setIsTouched(true);
                      setUnitBQty(e.target.value);
                    }}
                    style={{ textAlign: 'center', padding: '6px', fontWeight: 900, color: '#EA3943' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.75rem', textAlign: 'center', marginBottom: '2px' }}>
                    Amount (₹)
                  </label>
                  <input
                    type="text"
                    readOnly
                    className="input-text-clean"
                    value={((Number(unitBRate) || 0) * (Number(unitBQty) || 0)).toFixed(2)}
                    style={{ textAlign: 'center', background: '#F3F4F6', padding: '6px', fontWeight: 800 }}
                  />
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleAddUnitBItem}
                    className="btn-customer-save"
                    style={{ padding: '8px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap', background: '#A7F3D0' }}
                  >
                    + Add {selectedItemObj?.unitB?.unitName || 'Unit B'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ITEMS TABLE matching self use new.jpg */}
        <div style={{ border: '2px solid #000000', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#D2BEF6', borderBottom: '2px solid #000000' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, borderRight: '1px solid #000000' }}>
                  Item
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, width: '100px', borderRight: '1px solid #000000' }}>
                  Qty
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, width: '120px', borderRight: '1px solid #000000' }}>
                  Rate
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, width: '140px' }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {selfUseItems.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: '#9CA3AF', fontWeight: 600 }}>
                    No items in current Self Use voucher. Select item & qty above.
                  </td>
                </tr>
              ) : (
                selfUseItems.map((item, idx) => (
                  <tr
                    key={idx}
                    onClick={() => handleEditItem(idx)}
                    style={{
                      borderBottom: '1px solid #E5E7EB',
                      cursor: 'pointer',
                      background: editingItemIndex === idx ? '#F3E8FF' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '8px 12px', fontWeight: 800, borderRight: '1px solid #000000' }}>
                      {item.itemName}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: '#EA3943', borderRight: '1px solid #000000' }}>
                      {item.qty}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, borderRight: '1px solid #000000' }}>
                      {item.rate}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800 }}>
                      {item.amount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: '#D2BEF6', borderTop: '2px solid #000000' }}>
                <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, borderRight: '1px solid #000000' }}>
                  Total
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: '#002B99' }}>
                  {totalAmount}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Customer Action Buttons: Del, Large Save, Print */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', flexWrap: 'wrap', marginTop: '16px' }}>
          <button
            type="button"
            className="btn-customer-action-pill"
            onClick={handleDeleteCurrentSelfUse}
            disabled={!isEditing && !isViewing}
            style={{ opacity: (isEditing || isViewing) ? 1 : 0.5, cursor: (isEditing || isViewing) ? 'pointer' : 'not-allowed' }}
          >
            Del
          </button>

          <button
            type="button"
            onClick={handleSaveSelfUse}
            className="btn-customer-save"
            style={{ padding: '10px 48px', fontSize: '1.2rem', minWidth: '160px' }}
          >
            {isViewing ? 'Edit Voucher' : 'Save'}
          </button>

          <button
            type="button"
            className="btn-customer-action-pill"
            onClick={handlePrint}
          >
            Print
          </button>
        </div>
        </div>
      </div>

      {/* Self Use Consumption History in the Downside (Always Visible) */}
      <div id="self-use-history-register" style={{ marginTop: '28px', background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '20px', maxWidth: '850px', margin: '28px auto 0', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h4 style={{ fontWeight: 900, fontSize: '1.1rem', margin: 0 }}>Self Use Consumption Register (History)</h4>
            <span style={{ fontSize: '0.8rem', background: '#E0E7FF', color: '#3730A3', padding: '2px 10px', borderRadius: '12px', fontWeight: 800 }}>
              {filteredHistory.length} {filteredHistory.length === 1 ? 'Record' : 'Records'}
            </span>
          </div>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={14} color="#6B7280" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search voucher no..."
              className="input-text-clean"
              value={searchHistory}
              onChange={e => setSearchHistory(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Voucher Date</th>
                <th>Voucher No.</th>
                <th style={{ textAlign: 'center' }}>Total Items</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF', fontWeight: 600 }}>
                    No self use consumption records found.
                  </td>
                </tr>
              ) : (
                filteredHistory.map(su => (
                  <tr
                    key={su.id}
                    style={{
                      backgroundColor: editingSelfUseId === su.id ? '#EFF6FF' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleLoadSelfUseForEdit(su, true)}
                    onDoubleClick={() => handleLoadSelfUseForEdit(su, false)}
                    title="Single-click to View, Double-click to Edit"
                  >
                    <td>{su.billDate}</td>
                    <td style={{ fontWeight: 800 }}>{su.billNo}</td>
                    <td style={{ textAlign: 'center' }}>{su.items?.length || 0}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#EA3943' }}>₹{su.totalAmount}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleLoadSelfUseForEdit(su, false);
                        }}
                        style={{
                          background: (editingSelfUseId === su.id && !isViewOnly) ? '#BFDBFE' : '#E2D2F8',
                          color: (editingSelfUseId === su.id && !isViewOnly) ? '#1E40AF' : '#EA3943',
                          border: '1px solid #C4B5FD',
                          borderRadius: '12px',
                          padding: '3px 12px',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        {(editingSelfUseId === su.id && !isViewOnly) ? 'Editing' : 'Edit'}
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
        message="Would you like to edit this self use voucher?"
        confirmText="Yes, Edit"
        cancelText="No, Keep View Only"
      />

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmDeleteSelfUse}
        title="Delete Self Use Voucher"
        message={`Are you sure you want to delete self use voucher "${billNo}"? This will reverse the consumption and restore inventory stock.`}
      />
    </div>
  );
};
