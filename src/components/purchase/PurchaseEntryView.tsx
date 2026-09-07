import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Item, Supplier, Purchase, PurchaseItem } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { getTodayDateString } from '../../utils/dateUtils';
import { calculateItemPricing, calculateBillSummary, calculateUnitBFromUnitA, calculateItemUnitBreakdown, updateItemPricingFromPurchase } from '../../utils/calculations';
import { PurchasePrintVoucher } from './PurchasePrintVoucher';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ItemSearchSelect, ItemSearchSelectHandle } from '../common/ItemSearchSelect';
import { SearchableSelect, SearchableSelectHandle } from '../common/SearchableSelect';
import { Search, Keyboard } from 'lucide-react';

export const PurchaseEntryView: React.FC = () => {
  const { showToast, showAlert, openQuickModal, refreshKey, selectedDate, pendingPurchasePrefill, setPendingPurchasePrefill } = useApp();
  const { hasPermission } = useAuth();

  // Masters
  const settings = useMemo(() => db.getSettings(), [refreshKey]);
  const suppliers = useMemo(() => db.getSuppliers().filter(s => s.isActive !== false), [refreshKey]);
  const items = useMemo(() => db.getItems().filter(i => i.isActive !== false), [refreshKey]);
  const purchasesHistory = useMemo(() => db.getPurchases(), [refreshKey]);

  // Unique categories from items
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [items]);

  // Options for SearchableSelects
  const supplierOptions = useMemo(() => {
    return suppliers.map(s => ({
      id: s.id,
      label: s.name,
      subLabel: s.phone ? `${s.phone}${s.city ? ` • ${s.city}` : ''}` : s.city,
      badge: s.gstin ? 'GST' : undefined,
      badgeBg: s.gstin ? '#DCFCE7' : undefined,
      badgeColor: s.gstin ? '#15803D' : undefined
    }));
  }, [suppliers]);

  const categoryOptions = useMemo(() => {
    const allOpt = [{ id: '', label: '-- All Categories --', subLabel: 'Show all catalog items' }];
    const catOpts = categories.map(c => {
      const count = items.filter(i => i.category?.toLowerCase() === c.toLowerCase()).length;
      return {
        id: c,
        label: c,
        subLabel: `${count} items in category`,
        badge: `${count}`
      };
    });
    return [...allOpt, ...catOpts];
  }, [categories, items]);

  // Header State
  const [billDate, setBillDate] = useState<string>(getTodayDateString());
  const [recdDate, setRecdDate] = useState<string>(getTodayDateString());
  const [billNo, setBillNo] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [associatedOrderId, setAssociatedOrderId] = useState<string | null>(null);
  const [isJustSaved, setIsJustSaved] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [isEditPromptOpen, setIsEditPromptOpen] = useState(false);

  // Line item selection & Unit A state (Purchase is strictly in Unit A)
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  const [unitABasicPrice, setUnitABasicPrice] = useState<string>('0');
  const [unitAGstPercent, setUnitAGstPercent] = useState<string>(String(settings.defaultGstPercent || 0));
  const [unitAQty, setUnitAQty] = useState<string>('1');

  // Items added to the bill
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [manualRoundUp, setManualRoundUp] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState(false);
  const [searchHistory, setSearchHistory] = useState('');

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Focus Refs for 100% Keyboard-Driven Navigation
  const billDateInputRef = useRef<HTMLInputElement>(null);
  const billNoInputRef = useRef<HTMLInputElement>(null);
  const recdDateInputRef = useRef<HTMLInputElement>(null);
  const supplierSelectRef = useRef<SearchableSelectHandle>(null);
  const categorySelectRef = useRef<SearchableSelectHandle>(null);
  const itemSearchRef = useRef<ItemSearchSelectHandle>(null);
  const unitABasicPriceInputRef = useRef<HTMLInputElement>(null);
  const unitAGstPercentInputRef = useRef<HTMLInputElement>(null);
  const unitAQtyInputRef = useRef<HTMLInputElement>(null);
  const roundUpInputRef = useRef<HTMLInputElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  // Filter items by category if selected
  const filteredCategoryItems = useMemo(() => {
    if (!selectedCategory) return items;
    return items.filter(i => i.category?.toLowerCase() === selectedCategory.toLowerCase());
  }, [items, selectedCategory]);

  // Handle incoming order prefill from ORDERED section
  useEffect(() => {
    if (pendingPurchasePrefill) {
      setIsJustSaved(false);
      if (pendingPurchasePrefill.supplierId) {
        setSupplierId(pendingPurchasePrefill.supplierId);
      }
      setBillNo(''); // User enters physical supplier bill number
      setBillDate(pendingPurchasePrefill.orderDate || getTodayDateString());
      setRecdDate(getTodayDateString());
      setAssociatedOrderId(pendingPurchasePrefill.orderId || null);
      setIsTouched(true);

      if (pendingPurchasePrefill.items && pendingPurchasePrefill.items.length > 0) {
        const prefilledList: PurchaseItem[] = pendingPurchasePrefill.items.map((it: any) => {
          const itemObj = items.find(i => i.id === it.itemId);
          const bPrice = itemObj?.unitA?.basicPrice ?? itemObj?.purchaseRate ?? 0;
          const gPercent = itemObj?.unitA?.gstPercent ?? itemObj?.gstPercent ?? (settings.defaultGstPercent || 0);
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
      setTimeout(() => billNoInputRef.current?.focus(), 50);
    }
  }, [pendingPurchasePrefill, items, settings]);

  useEffect(() => {
    if (!editingPurchaseId && !pendingPurchasePrefill && !associatedOrderId) {
      setBillDate(selectedDate || getTodayDateString());
      setRecdDate(selectedDate || getTodayDateString());
    }
    if (!pendingPurchasePrefill) {
      const timer = setTimeout(() => {
        billDateInputRef.current?.focus();
        billDateInputRef.current?.select();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [editingPurchaseId, selectedDate, refreshKey]);

  const selectedItemObj = useMemo(() => {
    return items.find(i => i.id === selectedItemId);
  }, [items, selectedItemId]);

  const handleItemSelect = (itemId: string) => {
    setIsTouched(true);
    setSelectedItemId(itemId);
    setEditingItemIndex(null);
    const found = items.find(i => i.id === itemId);
    if (found) {
      if (found.category) setSelectedCategory(found.category);
      const uA = found.unitA || {
        basicPrice: found.purchaseRate || 0,
        gstPercent: found.gstPercent || settings.defaultGstPercent || 0,
      };
      setUnitABasicPrice(String(uA.basicPrice || 0));
      setUnitAGstPercent(String(uA.gstPercent || settings.defaultGstPercent || 0));
      setUnitAQty('1');
    }
  };

  // Live computed pricing for Unit A
  const calculatedUnitAPricing = useMemo(() => {
    return calculateItemPricing(
      Number(unitABasicPrice),
      Number(unitAGstPercent),
      0,
      Number(unitAQty),
      0
    );
  }, [unitABasicPrice, unitAGstPercent, unitAQty]);

  const selectedItemCurrentStock = useMemo(() => {
    if (!selectedItemId) return 0;
    return StockEngine.getItemCurrentStock(selectedItemId);
  }, [selectedItemId, refreshKey]);

  const billSummary = useMemo(() => {
    return calculateBillSummary(
      purchaseItems,
      manualRoundUp !== null ? Number(manualRoundUp) : undefined
    );
  }, [purchaseItems, manualRoundUp]);

  const isFormActive = Boolean(editingPurchaseId || purchaseItems.length > 0 || selectedItemId || isTouched);

  const handleAddUnitAItem = () => {
    setIsTouched(true);
    if (!selectedItemId || !selectedItemObj) {
      showAlert('Please select an item first.', 'Selection Required', 'warning');
      itemSearchRef.current?.focus();
      return;
    }
    const numQty = Number(unitAQty);
    if (!numQty || numQty <= 0) {
      showAlert('Please enter a quantity greater than 0 for Unit A.', 'Invalid Quantity', 'warning');
      unitAQtyInputRef.current?.focus();
      return;
    }

    const unitName = selectedItemObj.unitA?.unitName || selectedItemObj.unit || 'Roll';
    const convFactor = Number(selectedItemObj.unitB?.conversionFactor) || 1;

    const newPurchaseItem: PurchaseItem = {
      id: `pur-item-${Date.now()}-${Math.random()}`,
      itemId: selectedItemObj.id,
      sno: selectedItemObj.sno || '',
      itemName: selectedItemObj.name,
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

    // Reset item input and immediately focus ItemSearchSelect for the next product!
    setSelectedItemId('');
    setUnitAQty('1');
    setTimeout(() => {
      itemSearchRef.current?.focus();
    }, 40);
  };

  const handleEditLineItem = (index: number) => {
    setIsTouched(true);
    const item = purchaseItems[index];
    const foundItem = items.find(i => i.id === item.itemId);
    if (foundItem?.category) setSelectedCategory(foundItem.category);
    setSelectedItemId(item.itemId);
    setUnitABasicPrice(String(item.basicPrice));
    setUnitAGstPercent(String(item.gstPercent));
    setUnitAQty(String(item.qty));
    setEditingItemIndex(index);
    setTimeout(() => {
      unitABasicPriceInputRef.current?.focus();
      unitABasicPriceInputRef.current?.select();
    }, 40);
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
    setIsViewOnly(false);
    setBillNo('');
    setBillDate(getTodayDateString());
    setRecdDate(getTodayDateString());
    setSupplierId('');
    setSelectedCategory('');
    setPurchaseItems([]);
    setSelectedItemId('');
    setEditingItemIndex(null);
    setAssociatedOrderId(null);
    setManualRoundUp(null);
    showToast('New Purchase entry ready', 'info');
    setTimeout(() => {
      billDateInputRef.current?.focus();
    }, 40);
  };

  const handleSavePurchase = () => {
    if (isViewOnly) {
      setIsEditPromptOpen(true);
      return;
    }
    if (!billNo.trim()) {
      showAlert('Please enter the Supplier Bill No.', 'Validation Error', 'error');
      billNoInputRef.current?.focus();
      return;
    }
    if (!supplierId) {
      showAlert('Please select a Supplier.', 'Validation Error', 'error');
      supplierSelectRef.current?.focus();
      return;
    }
    if (purchaseItems.length === 0) {
      showAlert('Please add at least one item to the purchase bill.', 'Validation Error', 'error');
      itemSearchRef.current?.focus();
      return;
    }

    const supplier = suppliers.find(s => s.id === supplierId);

    const purchaseRecord: Purchase = {
      id: editingPurchaseId || `purchase-${Date.now()}`,
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
      orderId: associatedOrderId || undefined,
      createdAt: new Date().toISOString()
    };

    // Auto-update Item Master prices for newly purchased items based on their latest landed cost
    purchaseItems.forEach(pi => {
      const itemToUpdate = items.find(i => i.id === pi.itemId);
      if (itemToUpdate) {
        const newBasic = Number(pi.basicPrice);
        const newGst = Number(pi.gstPercent);
        
        if (newBasic > 0) {
          const updatedItem = updateItemPricingFromPurchase(itemToUpdate, newBasic, newGst);
          db.saveItem(updatedItem);
        }
      }
    });

    // Save to Database
    db.savePurchase(purchaseRecord);

    if (editingPurchaseId) {
      setIsJustSaved(true);
      setIsTouched(false);
      setIsViewOnly(false);
      showToast(`Purchase bill ${purchaseRecord.billNo} updated! Stock adjusted.`, 'success');
    } else {
      setIsJustSaved(false);
      setIsViewOnly(false);
      showToast(`Purchase bill ${purchaseRecord.billNo} saved! Item rates and stock updated.`, 'success');
      setAssociatedOrderId(null);
      handleNewEntry();
    }
  };

  const handleLoadPurchaseForEdit = (purchase: Purchase, viewOnly: boolean = false) => {
    setIsJustSaved(false);
    setEditingPurchaseId(purchase.id);
    setIsViewOnly(viewOnly);
    setIsTouched(true);
    setBillNo(purchase.billNo);
    setBillDate(purchase.billDate);
    setRecdDate(purchase.recdDate || purchase.billDate);
    setSupplierId(purchase.supplierId);
    setPurchaseItems(purchase.items);
    setManualRoundUp(purchase.roundUp !== undefined ? String(purchase.roundUp) : null);
    setAssociatedOrderId(purchase.orderId || null);
    showToast(viewOnly ? `Viewing purchase bill ${purchase.billNo}` : `Loaded purchase bill ${purchase.billNo} for editing`, 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCurrentPurchase = () => {
    if (!editingPurchaseId) {
      showToast('Please select a saved purchase bill to delete', 'warning');
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

  // Global Keyboard Shortcuts (Ctrl+S / Alt+S to save, Alt+N for new, Alt+P for print)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey || e.altKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSavePurchase();
      } else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewEntry();
      } else if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [billNo, supplierId, purchaseItems, billSummary, isViewOnly]);

  const currentPurchaseForPrint: Purchase = {
    id: editingPurchaseId || 'temp',
    billNo: billNo || 'NEW-BILL',
    billDate,
    recdDate,
    supplierId,
    supplierName: suppliers.find(s => s.id === supplierId)?.name || 'Cash Supplier',
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

  const isEditing = Boolean(editingPurchaseId && !isViewOnly);
  const isViewing = Boolean(editingPurchaseId && isViewOnly);
  const isCreating = Boolean(!editingPurchaseId && !isJustSaved && (isTouched || purchaseItems.length > 0 || selectedItemId || billNo.trim() !== ''));

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
      {/* Hidden Print Voucher */}
      <PurchasePrintVoucher purchase={currentPurchaseForPrint} />

      {/* Top Header Strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="pill-header-lavender" style={{ fontSize: '1.25rem', padding: '8px 36px', minWidth: '220px', textAlign: 'center' }}>
            PURCHASE ENTRY
          </div>
          {isJustSaved ? (
            <span className="active-mode-indicator is-saved">
              ● Saved / Updated Just Now ({billNo})
            </span>
          ) : isViewing ? (
            <span className="active-mode-indicator is-initial" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B' }}>
              ● Viewing Purchase Bill: {billNo} (Read Only — Double-Click to Edit)
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

        {/* Keyboard shortcuts badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#4B5563', background: '#FFFFFF', padding: '5px 12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
          <Keyboard size={15} color="#4F46E5" />
          <span><b>Enter:</b> Next Field / Add Item</span>
          <span style={{ color: '#D1D5DB' }}>|</span>
          <span><b>Ctrl+S:</b> Save</span>
          <span style={{ color: '#D1D5DB' }}>|</span>
          <span><b>Alt+N:</b> New</span>
        </div>
      </div>

      {/* Main Form Container */}
      <div
        className={`dynamic-entry-card ${cardStateClass}`}
        style={{
          borderRadius: '14px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxWidth: '960px',
          margin: '0 auto',
          position: 'relative'
        }}
      >
        {isViewing && (
          <div
            onClick={() => setIsEditPromptOpen(true)}
            style={{
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
              🔒 View-Only Mode: Purchase bill is locked against accidental edits. Click anywhere or press button to edit.
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
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >

        {/* Top Dates & Bill No Row */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 900, fontSize: '0.9rem' }}>BILL DATE</label>
            <input
              ref={billDateInputRef}
              type="date"
              className="input-text-clean"
              value={billDate}
              onChange={e => {
                setIsTouched(true);
                setBillDate(e.target.value);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  billNoInputRef.current?.focus();
                  billNoInputRef.current?.select();
                }
              }}
              style={{ width: '140px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 900, fontSize: '0.9rem' }}>BILL NO.</label>
            <input
              ref={billNoInputRef}
              type="text"
              placeholder="Supplier Bill #"
              className="input-text-clean"
              value={billNo}
              onChange={e => {
                setIsTouched(true);
                setBillNo(e.target.value);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  recdDateInputRef.current?.focus();
                }
              }}
              style={{ width: '150px', fontWeight: 800 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 900, fontSize: '0.9rem' }}>RECD. DATE</label>
            <input
              ref={recdDateInputRef}
              type="date"
              className="input-text-clean"
              value={recdDate}
              onChange={e => {
                setIsTouched(true);
                setRecdDate(e.target.value);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  supplierSelectRef.current?.focus();
                }
              }}
              style={{ width: '140px' }}
            />
          </div>
        </div>

        {/* PARTY / SUPPLIER SELECTION */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontWeight: 900, fontSize: '1.05rem' }}>Party :</label>
          <SearchableSelect
            ref={supplierSelectRef}
            options={supplierOptions}
            value={supplierId}
            onChange={val => {
              setIsTouched(true);
              setSupplierId(val);
            }}
            onEnterNext={() => {
              categorySelectRef.current?.focus();
            }}
            placeholder="Type supplier name / phone or use arrows..."
            onQuickAdd={() => openQuickModal('SUPPLIER', (newId) => {
              setIsTouched(true);
              setSupplierId(newId);
              setTimeout(() => categorySelectRef.current?.focus(), 40);
            })}
            quickAddTitle="Quick Create Supplier"
          />
        </div>

        {/* CATEGORY SELECTION */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontWeight: 900, fontSize: '1.05rem' }}>CATG. :</label>
          <SearchableSelect
            ref={categorySelectRef}
            options={categoryOptions}
            value={selectedCategory}
            onChange={val => {
              setIsTouched(true);
              setSelectedCategory(val);
              setSelectedItemId('');
            }}
            onEnterNext={() => {
              itemSearchRef.current?.focus();
            }}
            placeholder="Type category or press Enter to choose item..."
            onQuickAdd={() => openQuickModal('ITEM', () => setIsTouched(true))}
            quickAddTitle="Quick Create Item / Category"
          />
        </div>

        {/* SEARCHABLE ITEM SELECTION */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontWeight: 900, fontSize: '1.05rem' }}>ITEM :</label>
          <ItemSearchSelect
            ref={itemSearchRef}
            items={filteredCategoryItems}
            selectedItemId={selectedItemId}
            onSelectItem={(item) => handleItemSelect(item ? item.id : '')}
            onEnterNext={() => {
              unitABasicPriceInputRef.current?.focus();
              unitABasicPriceInputRef.current?.select();
            }}
            placeholder="Type item name/code to search or use arrow keys..."
            onQuickAdd={() => openQuickModal('ITEM', (newId) => handleItemSelect(newId))}
          />
        </div>

        {/* PRICING INPUT CARD (UNIT-A ONLY FOR PURCHASES) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                UNIT-A : {selectedItemObj?.unitA?.unitName || selectedItemObj?.unit || 'Roll'} (Primary Inward Unit)
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
                  ref={unitABasicPriceInputRef}
                  type="number"
                  step="0.01"
                  className="input-text-clean"
                  value={unitABasicPrice}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitABasicPrice(e.target.value);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      unitAGstPercentInputRef.current?.focus();
                      unitAGstPercentInputRef.current?.select();
                    }
                  }}
                  style={{ textAlign: 'center', padding: '4px', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
                  GST %
                </label>
                <input
                  ref={unitAGstPercentInputRef}
                  type="number"
                  className="input-text-clean"
                  value={unitAGstPercent}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitAGstPercent(e.target.value);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      unitAQtyInputRef.current?.focus();
                      unitAQtyInputRef.current?.select();
                    }
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
                  Qty ({selectedItemObj?.unitA?.unitName || selectedItemObj?.unit || 'Unit A'})
                </label>
                <input
                  ref={unitAQtyInputRef}
                  type="number"
                  min="1"
                  className="input-text-clean"
                  value={unitAQty}
                  onChange={e => {
                    setIsTouched(true);
                    setUnitAQty(e.target.value);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddUnitAItem();
                    }
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
                  style={{ padding: '6px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                  title="Add item (or press Enter in Qty field)"
                >
                  + Add
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ITEMS TABLE */}
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
                    No items in this purchase bill. Select an item above and press Enter on Qty or click "+ Add".
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
                    title="Click to edit item rates"
                  >
                    <td style={{ padding: '8px 12px', fontWeight: 800, borderRight: '1px solid #000000' }}>
                      {item.itemName}
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
          
          {/* Financial Summary with EDITABLE ROUND UP */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem', fontWeight: 800 }}>
              <span>Basic</span>
              <span>{billSummary.basicTotal}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem', fontWeight: 800 }}>
              <span>Gst</span>
              <span>{billSummary.gstTotal}</span>
            </div>

            {/* EDITABLE ROUND UP FIELD */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem', fontWeight: 800 }}>
              <span>Round up</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  ref={roundUpInputRef}
                  type="number"
                  step="0.01"
                  className="input-text-clean"
                  value={manualRoundUp !== null ? manualRoundUp : billSummary.roundUp}
                  onChange={e => {
                    setIsTouched(true);
                    setManualRoundUp(e.target.value);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveButtonRef.current?.focus();
                    }
                  }}
                  style={{
                    width: '90px',
                    textAlign: 'right',
                    fontWeight: 800,
                    padding: '3px 6px',
                    fontSize: '0.92rem',
                    background: manualRoundUp !== null ? '#FEF3C7' : '#FFFFFF'
                  }}
                  title="Manual Round-Up adjustment"
                  placeholder="0.00"
                />
                {manualRoundUp !== null && (
                  <button
                    type="button"
                    onClick={() => setManualRoundUp(null)}
                    title="Reset to automatic round-up"
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid #D1D5DB',
                      background: '#F3F4F6',
                      cursor: 'pointer',
                      fontWeight: 700,
                      color: '#4B5563'
                    }}
                  >
                    Auto
                  </button>
                )}
              </div>
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
              disabled={!isEditing && !isViewing}
              style={{ opacity: (isEditing || isViewing) ? 1 : 0.5, cursor: (isEditing || isViewing) ? 'pointer' : 'not-allowed' }}
            >
              Del
            </button>

            <button
              ref={saveButtonRef}
              type="button"
              onClick={handleSavePurchase}
              className="btn-customer-save"
              style={{ padding: '10px 48px', fontSize: '1.2rem', minWidth: '160px' }}
              title="Save Purchase Bill (Ctrl+S / Alt+S)"
            >
              {isViewing ? 'Edit Bill' : 'Save'}
            </button>

            <button
              type="button"
              className="btn-customer-action-pill"
              onClick={handlePrint}
              title="Print Voucher (Alt+P)"
            >
              Print
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Purchase Inward History */}
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
                    onClick={() => handleLoadPurchaseForEdit(p, true)}
                    onDoubleClick={() => handleLoadPurchaseForEdit(p, false)}
                    title="Single-click to View, Double-click to Edit"
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
                          handleLoadPurchaseForEdit(p, false);
                        }}
                        style={{
                          background: (editingPurchaseId === p.id && !isViewOnly) ? '#BFDBFE' : '#E2D2F8',
                          color: (editingPurchaseId === p.id && !isViewOnly) ? '#1E40AF' : '#EA3943',
                          border: '1px solid #C4B5FD',
                          borderRadius: '12px',
                          padding: '3px 12px',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        {(editingPurchaseId === p.id && !isViewOnly) ? 'Editing' : 'Edit'}
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
        message="Would you like to edit this purchase voucher?"
        confirmText="Yes, Edit"
        cancelText="No, Keep View Only"
      />

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
