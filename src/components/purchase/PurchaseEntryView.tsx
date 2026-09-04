import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Item, Supplier, Purchase, PurchaseItem } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { getTodayDateString } from '../../utils/dateUtils';
import { calculateItemPricing, calculateBillSummary, calculateItemUnitBreakdown, calculateUnitBFromUnitA } from '../../utils/calculations';
import { PurchasePrintVoucher } from './PurchasePrintVoucher';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Search } from 'lucide-react';

export const PurchaseEntryView: React.FC = () => {
  const { showToast, showAlert, openQuickModal, refreshKey, selectedDate, pendingPurchasePrefill, setPendingPurchasePrefill } = useApp();
  const { hasPermission } = useAuth();

  // Masters
  const settings = useMemo(() => db.getSettings(), [refreshKey]);
  const suppliers = useMemo(() => db.getSuppliers().filter(s => s.isActive !== false), [refreshKey]);
  const items = useMemo(() => db.getItems().filter(i => i.isActive !== false), [refreshKey]);
  const purchasesHistory = useMemo(() => db.getPurchases(), [refreshKey]);

  // Header State
  const [billDate, setBillDate] = useState<string>(getTodayDateString());
  const [recdDate, setRecdDate] = useState<string>(getTodayDateString());
  const [billNo, setBillNo] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [associatedOrderId, setAssociatedOrderId] = useState<string | null>(null);
  const [isJustSaved, setIsJustSaved] = useState(false);

  // Line item selection & dual unit state
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  const [unitABasicPrice, setUnitABasicPrice] = useState<string>('0');
  const [unitAGstPercent, setUnitAGstPercent] = useState<string>(String(settings.defaultGstPercent || 18));
  const [unitAQty, setUnitAQty] = useState<string>('1');

  const [unitBBasicPrice, setUnitBBasicPrice] = useState<string>('0');
  const [unitBGstPercent, setUnitBGstPercent] = useState<string>(String(settings.defaultGstPercent || 18));
  const [unitBQty, setUnitBQty] = useState<string>('1');

  // Items added
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [isTouched, setIsTouched] = useState(false);
  const [searchHistory, setSearchHistory] = useState('');

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Handle incoming order prefill from ORDERED section
  useEffect(() => {
    if (pendingPurchasePrefill) {
      setIsJustSaved(false);
      if (pendingPurchasePrefill.supplierId) {
        setSupplierId(pendingPurchasePrefill.supplierId);
      }
      setBillNo(''); // User must enter physical supplier bill number
      setBillDate(pendingPurchasePrefill.orderDate || getTodayDateString());
      setRecdDate(getTodayDateString());
      setAssociatedOrderId(pendingPurchasePrefill.orderId || null);
      setIsTouched(true);

      if (pendingPurchasePrefill.items && pendingPurchasePrefill.items.length > 0) {
        const prefilledList: PurchaseItem[] = pendingPurchasePrefill.items.map((it: any) => {
          const itemObj = items.find(i => i.id === it.itemId);
          const bPrice = itemObj?.unitA?.basicPrice ?? itemObj?.purchaseRate ?? 0;
          const gPercent = itemObj?.unitA?.gstPercent ?? itemObj?.gstPercent ?? (settings.defaultGstPercent || 18);
          const calc = calculateItemPricing(bPrice, gPercent, 0, Number(it.qty) || 1, 0);

          return {
            id: `pur-item-${Date.now()}-${Math.random()}`,
            itemId: it.itemId,
            sno: it.sno || itemObj?.sno || '',
            itemName: it.itemName || itemObj?.name || 'Item',
            unit: itemObj?.unitA?.unitName || itemObj?.unit || 'Units',
            basicPrice: calc.basicPrice,
            gstPercent: calc.gstPercent,
            gstAmt: calc.gstAmt,
            nettPrice: calc.nettPrice,
            toPercent: 0,
            roundup: 0,
            salePrice: calc.salePrice,
            qty: Number(it.qty) || 1,
            amount: calc.amount,
            conversionFactor: itemObj?.unitB?.conversionFactor || 1,
            isSecondaryUnit: false,
            baseQty: Number(it.qty) || 1
          };
        });

        setPurchaseItems(prefilledList);
      }

      showToast(`Loaded Order #${pendingPurchasePrefill.orderNumber} into Purchase Entry! Enter the supplier's Bill No. to complete.`, 'info');
      setPendingPurchasePrefill(null);
    }
  }, [pendingPurchasePrefill, items, settings]);

  useEffect(() => {
    if (!editingPurchaseId && !pendingPurchasePrefill && !associatedOrderId) {
      setBillDate(selectedDate || getTodayDateString());
      setRecdDate(selectedDate || getTodayDateString());
    }
  }, [editingPurchaseId, selectedDate, refreshKey]);

  const selectedItemObj = useMemo(() => {
    return items.find(i => i.id === selectedItemId);
  }, [items, selectedItemId]);

  const hasUnitB = Boolean(
    selectedItemObj &&
    (selectedItemObj.hasSecondaryUnit || (selectedItemObj.unitB && selectedItemObj.unitB.isActive !== false && selectedItemObj.unitB.unitName && selectedItemObj.unitB.unitName !== selectedItemObj.unitA?.unitName))
  );

  const handleItemSelect = (itemId: string) => {
    setIsTouched(true);
    setSelectedItemId(itemId);
    setEditingItemIndex(null);
    const found = items.find(i => i.id === itemId);
    if (found) {
      const uA = found.unitA || {
        basicPrice: found.purchaseRate || 0,
        gstPercent: found.gstPercent || settings.defaultGstPercent || 18,
      };
      setUnitABasicPrice(String(uA.basicPrice || 0));
      setUnitAGstPercent(String(uA.gstPercent || settings.defaultGstPercent || 18));
      setUnitAQty('1');

      if (found.unitB) {
        setUnitBBasicPrice(String(found.unitB.basicPrice || 0));
        setUnitBGstPercent(String(found.unitB.gstPercent || settings.defaultGstPercent || 18));
        setUnitBQty('1');
      }
    }
  };

  // Live computed pricing for Unit A and Unit B
  const calculatedUnitAPricing = useMemo(() => {
    return calculateItemPricing(
      Number(unitABasicPrice),
      Number(unitAGstPercent),
      0,
      Number(unitAQty),
      0
    );
  }, [unitABasicPrice, unitAGstPercent, unitAQty]);

  const calculatedUnitBPricing = useMemo(() => {
    return calculateItemPricing(
      Number(unitBBasicPrice),
      Number(unitBGstPercent),
      0,
      Number(unitBQty),
      0
    );
  }, [unitBBasicPrice, unitBGstPercent, unitBQty]);

  const selectedItemCurrentStock = useMemo(() => {
    if (!selectedItemId) return 0;
    return StockEngine.getItemCurrentStock(selectedItemId);
  }, [selectedItemId, refreshKey]);

  const billSummary = useMemo(() => {
    return calculateBillSummary(purchaseItems);
  }, [purchaseItems]);

  const isFormActive = Boolean(editingPurchaseId || purchaseItems.length > 0 || selectedItemId || isTouched);

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

    const unitName = selectedItemObj.unitA?.unitName || selectedItemObj.unit || 'Roll';
    const convFactor = Number(selectedItemObj.unitB?.conversionFactor) || 1;

    const newPurchaseItem: PurchaseItem = {
      id: `pur-item-${Date.now()}-${Math.random()}`,
      itemId: selectedItemObj.id,
      sno: selectedItemObj.sno,
      itemName: hasUnitB ? `${selectedItemObj.name} (${unitName})` : selectedItemObj.name,
      unit: unitName,
      basicPrice: calculatedUnitAPricing.basicPrice,
      gstPercent: calculatedUnitAPricing.gstPercent,
      gstAmt: calculatedUnitAPricing.gstAmt,
      nettPrice: calculatedUnitAPricing.nettPrice,
      toPercent: 0,
      roundup: 0,
      salePrice: calculatedUnitAPricing.nettPrice,
      qty: calculatedUnitAPricing.qty,
      amount: calculatedUnitAPricing.amount,
      conversionFactor: convFactor,
      isSecondaryUnit: false,
      baseQty: numQty
    };

    if (editingItemIndex !== null && editingItemIndex >= 0) {
      const updated = [...purchaseItems];
      updated[editingItemIndex] = newPurchaseItem;
      setPurchaseItems(updated);
      setEditingItemIndex(null);
      showToast('Item updated in purchase table', 'info');
    } else {
      setPurchaseItems(prev => [...prev, newPurchaseItem]);
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
    const unitName = selectedItemObj.unitB.unitName || 'Unit B';
    const baseQty = Number((numQty / convFactor).toFixed(4));

    const newPurchaseItem: PurchaseItem = {
      id: `pur-item-${Date.now()}-${Math.random()}`,
      itemId: selectedItemObj.id,
      sno: selectedItemObj.sno,
      itemName: `${selectedItemObj.name} (${unitName})`,
      unit: unitName,
      basicPrice: calculatedUnitBPricing.basicPrice,
      gstPercent: calculatedUnitBPricing.gstPercent,
      gstAmt: calculatedUnitBPricing.gstAmt,
      nettPrice: calculatedUnitBPricing.nettPrice,
      toPercent: 0,
      roundup: 0,
      salePrice: calculatedUnitBPricing.nettPrice,
      qty: calculatedUnitBPricing.qty,
      amount: calculatedUnitBPricing.amount,
      conversionFactor: convFactor,
      isSecondaryUnit: true,
      baseQty
    };

    if (editingItemIndex !== null && editingItemIndex >= 0) {
      const updated = [...purchaseItems];
      updated[editingItemIndex] = newPurchaseItem;
      setPurchaseItems(updated);
      setEditingItemIndex(null);
      showToast('Item updated in purchase table', 'info');
    } else {
      setPurchaseItems(prev => [...prev, newPurchaseItem]);
      showToast(`Added ${numQty} ${unitName} (${baseQty} primary units) to purchase`, 'success');
    }

    setUnitBQty('1');
  };

  const handleEditLineItem = (index: number) => {
    setIsTouched(true);
    const item = purchaseItems[index];
    setSelectedItemId(item.itemId);
    if (item.isSecondaryUnit) {
      setUnitBBasicPrice(String(item.basicPrice));
      setUnitBGstPercent(String(item.gstPercent));
      setUnitBQty(String(item.qty));
    } else {
      setUnitABasicPrice(String(item.basicPrice));
      setUnitAGstPercent(String(item.gstPercent));
      setUnitAQty(String(item.qty));
    }
    setEditingItemIndex(index);
  };

  const handleDeleteLineItem = (index: number) => {
    setIsTouched(true);
    setPurchaseItems(prev => prev.filter((_, i) => i !== index));
    if (editingItemIndex === index) {
      setEditingItemIndex(null);
      setSelectedItemId('');
    }
  };

  const handleNewEntry = () => {
    setEditingPurchaseId(null);
    setIsJustSaved(false);
    setIsTouched(false);
    setBillNo('');
    setBillDate(getTodayDateString());
    setRecdDate(getTodayDateString());
    setSupplierId('');
    setPurchaseItems([]);
    setSelectedItemId('');
    setUnitABasicPrice('0');
    setUnitAGstPercent(String(settings.defaultGstPercent || 18));
    setUnitAQty('1');
    setUnitBBasicPrice('0');
    setUnitBGstPercent(String(settings.defaultGstPercent || 18));
    setUnitBQty('1');
    setEditingItemIndex(null);
    showToast('New Purchase entry ready', 'info');
  };

  const handleSavePurchase = () => {
    if (!supplierId) {
      showAlert("Please select a Supplier / Vendor first.", 'Validation Error', 'warning');
      return;
    }
    if (!billNo.trim()) {
      showAlert("Please enter the Supplier's Bill / Invoice Number first.", 'Validation Error', 'warning');
      return;
    }
    if (purchaseItems.length === 0) {
      showAlert('Please add at least one item to the purchase bill.', 'Empty Line Items', 'warning');
      return;
    }

    const supplier = suppliers.find(s => s.id === supplierId);

    const purchaseRecord: Purchase = {
      id: editingPurchaseId || `pur-${Date.now()}`,
      billNo: billNo.trim(),
      billDate,
      recdDate,
      supplierId,
      supplierName: supplier?.name || 'Cash Supplier',
      items: purchaseItems,
      basicTotal: billSummary.basicTotal,
      gstTotal: billSummary.gstTotal,
      roundUp: billSummary.roundUp,
      billTotal: billSummary.billTotal,
      recdCash: 0,
      recdUpi: 0,
      notes: `Purchase from ${supplier?.name}`,
      orderId: associatedOrderId || undefined,
      createdAt: new Date().toISOString()
    };

    // Auto-update Item Master base prices & GST % if updated during purchase invoice entry
    purchaseItems.forEach(pItem => {
      const currentItem = db.getItemById(pItem.itemId);
      if (currentItem) {
        let newUnitABasicPrice = currentItem.unitA?.basicPrice ?? currentItem.purchaseRate ?? 0;
        let newGstPercent = currentItem.unitA?.gstPercent ?? currentItem.gstPercent ?? 18;
        let hasChange = false;

        if (pItem.isSecondaryUnit) {
          const conv = Number(pItem.conversionFactor) || 1;
          const derivedUnitAPrice = Number((pItem.basicPrice * conv).toFixed(2));
          if (derivedUnitAPrice !== newUnitABasicPrice || pItem.gstPercent !== newGstPercent) {
            newUnitABasicPrice = derivedUnitAPrice;
            newGstPercent = pItem.gstPercent;
            hasChange = true;
          }
        } else {
          if (pItem.basicPrice !== newUnitABasicPrice || pItem.gstPercent !== newGstPercent) {
            newUnitABasicPrice = pItem.basicPrice;
            newGstPercent = pItem.gstPercent;
            hasChange = true;
          }
        }

        if (hasChange) {
          const updatedItem = { ...currentItem };
          updatedItem.purchaseRate = newUnitABasicPrice;
          updatedItem.gstPercent = newGstPercent;

          if (updatedItem.unitA) {
            const updatedUnitA = calculateItemUnitBreakdown({
              ...updatedItem.unitA,
              basicPrice: newUnitABasicPrice,
              gstPercent: newGstPercent
            });
            updatedItem.unitA = updatedUnitA;
            updatedItem.saleRate = updatedUnitA.salePrice;

            if (updatedItem.hasSecondaryUnit && updatedItem.unitB) {
              const conv = Number(updatedItem.unitB.conversionFactor) || 1;
              updatedItem.unitB = {
                ...calculateUnitBFromUnitA(updatedUnitA, conv),
                unitName: updatedItem.unitB.unitName,
                conversionFactor: conv,
                isActive: updatedItem.unitB.isActive
              };
            }
          }

          db.saveItem(updatedItem);
        }
      }
    });

    // Automatically increases Universal Stock Ledger via PURCHASE_IN!
    db.savePurchase(purchaseRecord);

    if (editingPurchaseId) {
      setIsJustSaved(true);
      setIsTouched(false);
      showToast(`Purchase bill ${purchaseRecord.billNo} updated! Stock adjusted.`, 'success');
    } else {
      setIsJustSaved(false);
      showToast(`Purchase bill ${purchaseRecord.billNo} saved! Item rates and stock updated.`, 'success');
      setAssociatedOrderId(null);
      handleNewEntry();
    }
  };

  const handleLoadPurchaseForEdit = (purchase: Purchase) => {
    setIsJustSaved(false);
    setEditingPurchaseId(purchase.id);
    setIsTouched(true);
    setBillNo(purchase.billNo);
    setBillDate(purchase.billDate);
    setRecdDate(purchase.recdDate || purchase.billDate);
    setSupplierId(purchase.supplierId);
    setPurchaseItems(purchase.items);
    showToast(`Loaded purchase bill ${purchase.billNo} for editing`, 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCurrentPurchase = () => {
    if (!editingPurchaseId) {
      showToast('Please select a saved purchase to delete', 'warning');
      return;
    }
    if (!hasPermission('DELETE_PURCHASE')) {
      showToast('You do not have permission to delete purchases', 'error');
      return;
    }
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeletePurchase = () => {
    if (editingPurchaseId) {
      db.deletePurchase(editingPurchaseId);
      showToast(`Purchase bill deleted. Stock reversed.`, 'info');
      handleNewEntry();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const currentPurchaseForPrint: Purchase = {
    id: editingPurchaseId || 'temp',
    billNo,
    billDate,
    recdDate,
    supplierId,
    supplierName: suppliers.find(s => s.id === supplierId)?.name || 'Supplier',
    items: purchaseItems,
    basicTotal: billSummary.basicTotal,
    gstTotal: billSummary.gstTotal,
    roundUp: billSummary.roundUp,
    billTotal: billSummary.billTotal,
    recdCash: 0,
    recdUpi: 0,
    createdAt: new Date().toISOString()
  };

  const filteredPurchases = useMemo(() => {
    const q = searchHistory.toLowerCase().trim();
    if (!q) return purchasesHistory;
    return purchasesHistory.filter(
      p =>
        p.billNo.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q) ||
        p.billDate.includes(q)
    );
  }, [purchasesHistory, searchHistory]);

  const isEditing = Boolean(editingPurchaseId);
  const isCreating = Boolean(!isEditing && !isJustSaved && (isTouched || purchaseItems.length > 0 || selectedItemId || supplierId || billNo.trim()));

  const cardStateClass = isJustSaved
    ? 'is-saved-yellow'
    : isEditing
    ? 'is-editing-pink'
    : isCreating
    ? 'is-creating-green'
    : 'is-initial-blue';

  return (
    <div className="content-panel-grey">
      <PurchasePrintVoucher purchase={currentPurchaseForPrint} />

      {/* Top Header Strip matching new purchase.jpg */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="pill-header-lavender" style={{ fontSize: '1.25rem', padding: '8px 36px', minWidth: '220px', textAlign: 'center' }}>
            PURCHASE ENTRY
          </div>
          {isJustSaved ? (
            <span className="active-mode-indicator is-saved">
              ● Saved / Updated Just Now ({billNo})
            </span>
          ) : isEditing ? (
            <span className="active-mode-indicator is-editing">
              ● Editing Purchase Bill ({billNo})
            </span>
          ) : isCreating ? (
            <span className="active-mode-indicator is-creating">
              ● Creating New Purchase Entry
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
          maxWidth: '960px',
          margin: '0 auto'
        }}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 900, fontSize: '0.9rem' }}>RECD. DATE</label>
            <input
              type="date"
              className="input-text-clean"
              value={recdDate}
              onChange={e => {
                setIsTouched(true);
                setRecdDate(e.target.value);
              }}
              style={{ width: '140px' }}
            />
          </div>
        </div>

        {/* PARTY / SUPPLIER SELECTION */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 34px', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontWeight: 900, fontSize: '1.05rem' }}>Party :</label>
          <select
            className="input-text-clean"
            value={supplierId}
            onChange={e => {
              setIsTouched(true);
              setSupplierId(e.target.value);
            }}
            style={{ fontSize: '0.95rem', height: '38px', fontWeight: 700 }}
          >
            <option value="">-- Select Supplier / Vendor --</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.phone ? `(${s.phone})` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-quick-n"
            title="Quick Create Supplier"
            onClick={() => openQuickModal('SUPPLIER', (newId) => {
              setIsTouched(true);
              setSupplierId(newId);
            })}
          >
            N
          </button>
        </div>

        {/* ITEM SELECTION */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 34px', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontWeight: 900, fontSize: '1.05rem' }}>ITEM :</label>
          <select
            className="input-text-clean"
            value={selectedItemId}
            onChange={e => handleItemSelect(e.target.value)}
            style={{ fontSize: '0.95rem', height: '38px', fontWeight: 700 }}
          >
            <option value="">-- Select Item --</option>
            {items.map(i => (
              <option key={i.id} value={i.id}>
                [{i.sno}] {i.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-quick-n"
            title="Quick Create Item"
            onClick={() => openQuickModal('ITEM', (newId) => handleItemSelect(newId))}
          >
            N
          </button>
        </div>

        {/* DUAL PRICING INPUT CARDS (UNIT-A & UNIT-B) */}
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
                gridTemplateColumns: '1.2fr 80px 1fr 1fr 90px 1.1fr auto',
                gap: '8px',
                alignItems: 'flex-end'
              }}
            >
              <div>
                <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
                  Besic Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input-text-clean"
                  value={unitABasicPrice}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitABasicPrice(e.target.value);
                  }}
                  style={{ textAlign: 'center', padding: '4px', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
                  GST %
                </label>
                <input
                  type="number"
                  className="input-text-clean"
                  value={unitAGstPercent}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitAGstPercent(e.target.value);
                  }}
                  style={{ textAlign: 'center', padding: '4px', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
                  GST Amt.
                </label>
                <input
                  type="text"
                  readOnly
                  className="input-text-clean"
                  value={calculatedUnitAPricing.gstAmt}
                  style={{ textAlign: 'center', background: '#F3F4F6', padding: '4px', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
                  Nett Price
                </label>
                <input
                  type="text"
                  readOnly
                  className="input-text-clean"
                  value={calculatedUnitAPricing.nettPrice}
                  style={{ textAlign: 'center', background: '#F3F4F6', padding: '4px', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
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
                  style={{ textAlign: 'center', padding: '4px', fontWeight: 900, color: '#EA3943' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
                  Amount
                </label>
                <input
                  type="text"
                  readOnly
                  className="input-text-clean"
                  value={calculatedUnitAPricing.amount}
                  style={{ textAlign: 'center', background: '#F3F4F6', padding: '4px', fontWeight: 800 }}
                />
              </div>

              <div style={{ paddingBottom: '2px' }}>
                <button
                  type="button"
                  onClick={handleAddUnitAItem}
                  className="btn-customer-save"
                  style={{ padding: '6px 14px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
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
                  gridTemplateColumns: '1.2fr 80px 1fr 1fr 90px 1.1fr auto',
                  gap: '8px',
                  alignItems: 'flex-end'
                }}
              >
                <div>
                  <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
                    Besic Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-text-clean"
                    value={unitBBasicPrice}
                    onChange={e => {
                      setIsTouched(true);
                      setUnitBBasicPrice(e.target.value);
                    }}
                    style={{ textAlign: 'center', padding: '4px', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
                    GST %
                  </label>
                  <input
                    type="number"
                    className="input-text-clean"
                    value={unitBGstPercent}
                    onChange={e => {
                      setIsTouched(true);
                      setUnitBGstPercent(e.target.value);
                    }}
                    style={{ textAlign: 'center', padding: '4px', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
                    GST Amt.
                  </label>
                  <input
                    type="text"
                    readOnly
                    className="input-text-clean"
                    value={calculatedUnitBPricing.gstAmt}
                    style={{ textAlign: 'center', background: '#F3F4F6', padding: '4px', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
                    Nett Price
                  </label>
                  <input
                    type="text"
                    readOnly
                    className="input-text-clean"
                    value={calculatedUnitBPricing.nettPrice}
                    style={{ textAlign: 'center', background: '#F3F4F6', padding: '4px', fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
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
                    style={{ textAlign: 'center', padding: '4px', fontWeight: 900, color: '#EA3943' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
                    Amount
                  </label>
                  <input
                    type="text"
                    readOnly
                    className="input-text-clean"
                    value={calculatedUnitBPricing.amount}
                    style={{ textAlign: 'center', background: '#F3F4F6', padding: '4px', fontWeight: 800 }}
                  />
                </div>

                <div style={{ paddingBottom: '2px' }}>
                  <button
                    type="button"
                    onClick={handleAddUnitBItem}
                    className="btn-customer-save"
                    style={{ padding: '6px 14px', fontSize: '0.82rem', whiteSpace: 'nowrap', background: '#A7F3D0' }}
                  >
                    + Add {selectedItemObj?.unitB?.unitName || 'Unit B'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ITEMS TABLE matching new purchase.jpg */}
        <div style={{ border: '2px solid #000000', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#D2BEF6', borderBottom: '2px solid #000000' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, borderRight: '1px solid #000000' }}>
                  Item
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, width: '110px', borderRight: '1px solid #000000' }}>
                  Besic Price
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, width: '80px', borderRight: '1px solid #000000' }}>
                  GST
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, width: '110px', borderRight: '1px solid #000000' }}>
                  Net Price
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, width: '80px', borderRight: '1px solid #000000' }}>
                  Qty
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, width: '130px' }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {purchaseItems.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#9CA3AF', fontWeight: 600 }}>
                    No items in this purchase bill. Select an item above and click "Add".
                  </td>
                </tr>
              ) : (
                purchaseItems.map((item, idx) => (
                  <tr
                    key={idx}
                    onClick={() => handleEditLineItem(idx)}
                    style={{
                      borderBottom: '1px solid #E5E7EB',
                      cursor: 'pointer',
                      background: editingItemIndex === idx ? '#F3E8FF' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '8px 12px', fontWeight: 800, borderRight: '1px solid #000000' }}>
                      [{item.sno}] {item.itemName}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, borderRight: '1px solid #000000' }}>
                      {item.basicPrice}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, borderRight: '1px solid #000000' }}>
                      {item.gstPercent}%
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, borderRight: '1px solid #000000' }}>
                      {item.nettPrice}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: '#15803D', borderRight: '1px solid #000000' }}>
                      {item.qty}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800 }}>
                      {item.amount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* BOTTOM FINANCIAL SUMMARY & CUSTOMER ACTION BUTTONS */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '30px', alignItems: 'center', marginTop: '10px' }}>
          
          {/* Financial Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem', fontWeight: 800 }}>
              <span>Basic</span>
              <span>{billSummary.basicTotal}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem', fontWeight: 800 }}>
              <span>Gst</span>
              <span>{billSummary.gstTotal}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem', fontWeight: 800 }}>
              <span>Round up</span>
              <span>{billSummary.roundUp}</span>
            </div>

            {/* BILL TOTAL */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ color: '#EA3943', fontWeight: 900, fontSize: '1.05rem' }}>BILL TOTAL</span>
              <input
                type="text"
                readOnly
                className="input-text-clean"
                value={billSummary.billTotal}
                style={{ textAlign: 'right', fontWeight: 900, fontSize: '1.15rem', background: '#FFFFFF', color: '#002B99' }}
              />
            </div>
          </div>

          {/* Customer Action Buttons: Del, Large Save, Print */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-customer-action-pill"
              onClick={handleDeleteCurrentPurchase}
              disabled={!isEditing}
              style={{ opacity: isEditing ? 1 : 0.5, cursor: isEditing ? 'pointer' : 'not-allowed' }}
            >
              Del
            </button>

            <button
              type="button"
              onClick={handleSavePurchase}
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
        </div>
      </div>

      {/* Purchase Inward History in the Downside (Always Visible) */}
      <div id="purchase-inward-register" style={{ marginTop: '28px', background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '20px', maxWidth: '960px', margin: '28px auto 0', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h4 style={{ fontWeight: 900, fontSize: '1.1rem', margin: 0 }}>Purchase Inward Register (History)</h4>
            <span style={{ fontSize: '0.8rem', background: '#E0E7FF', color: '#3730A3', padding: '2px 10px', borderRadius: '12px', fontWeight: 800 }}>
              {filteredPurchases.length} {filteredPurchases.length === 1 ? 'Record' : 'Records'}
            </span>
          </div>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={14} color="#6B7280" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search bill no, supplier..."
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
                <th>Bill Date</th>
                <th>Bill No.</th>
                <th>Supplier / Party</th>
                <th style={{ textAlign: 'center' }}>Total Items</th>
                <th style={{ textAlign: 'right' }}>Bill Total</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF', fontWeight: 600 }}>
                    No purchase inward records found.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map(p => (
                  <tr
                    key={p.id}
                    style={{
                      backgroundColor: editingPurchaseId === p.id ? '#EFF6FF' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleLoadPurchaseForEdit(p)}
                  >
                    <td>{p.billDate}</td>
                    <td style={{ fontWeight: 800 }}>{p.billNo}</td>
                    <td>{p.supplierName}</td>
                    <td style={{ textAlign: 'center' }}>{p.items?.length || 0}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#15803D' }}>₹{p.billTotal}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleLoadPurchaseForEdit(p);
                        }}
                        style={{
                          background: editingPurchaseId === p.id ? '#BFDBFE' : '#E2D2F8',
                          color: editingPurchaseId === p.id ? '#1E40AF' : '#EA3943',
                          border: '1px solid #C4B5FD',
                          borderRadius: '12px',
                          padding: '3px 12px',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        {editingPurchaseId === p.id ? 'Editing' : 'Load'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmDeletePurchase}
        title="Delete Purchase Voucher"
        message={`Are you sure you want to delete purchase voucher "${billNo}"? This will reverse the transaction and reduce stock.`}
      />
    </div>
  );
};
