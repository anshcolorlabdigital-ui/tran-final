import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Item, ItemUnitPricing, Party, Sale, SaleItem } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { getTodayDateString } from '../../utils/dateUtils';
import { calculateBillSummary } from '../../utils/calculations';
import { SalesPrintInvoice } from './SalesPrintInvoice';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ItemSearchSelect, ItemSearchSelectHandle } from '../common/ItemSearchSelect';
import { SearchableSelect, SearchableSelectHandle } from '../common/SearchableSelect';
import { Search, Keyboard } from 'lucide-react';

export const SalesEntryView: React.FC = () => {
  const { showToast, showAlert, openQuickModal, refreshKey, selectedDate } = useApp();
  const { hasPermission } = useAuth();

  // Master lists
  const parties = useMemo(() => db.getParties().filter(p => p.isActive !== false), [refreshKey]);
  const items = useMemo(() => db.getItems().filter(i => i.isActive !== false), [refreshKey]);
  const salesHistory = useMemo(() => db.getSales(), [refreshKey]);

  // Unique categories from items
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [items]);

  // Active parties (only active parties show in sales dropdown)
  const activeParties = useMemo(() => {
    return parties.filter(p => p.isActive !== false);
  }, [parties]);

  const partyOptions = useMemo(() => {
    return activeParties.map(p => ({
      id: p.id,
      label: p.name,
      subLabel: `${p.partyType === 'DEALER' ? '🏢 Dealer' : '👤 Amateur'}${p.phone ? ` • ${p.phone}` : ''}${p.city ? ` • ${p.city}` : ''} • ${p.allowCredit ? 'Credit Allowed' : 'Cash Only'}`,
      badge: p.partyType === 'DEALER' ? `DEALER (${p.dealerProfitPercent ?? 10}%)` : (p.amateurProfitPercent !== undefined ? `AMATEUR (${p.amateurProfitPercent}%)` : 'AMATEUR'),
      badgeBg: p.partyType === 'DEALER' ? '#F5F3FF' : '#EFF6FF',
      badgeColor: p.partyType === 'DEALER' ? '#6D28D9' : '#1D4ED8'
    }));
  }, [activeParties]);

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

  // Form Header State
  const [billDate, setBillDate] = useState<string>(getTodayDateString());
  const [billNo, setBillNo] = useState<string>('');
  const [partyId, setPartyId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [isViewOnly, setIsViewOnly] = useState<boolean>(false);
  const [isEditPromptOpen, setIsEditPromptOpen] = useState<boolean>(false);

  // Line Item Input Strip State
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // Unit A Pricing State
  const [unitABasicPrice, setUnitABasicPrice] = useState<string>('0');
  const [unitAGstPercent, setUnitAGstPercent] = useState<string>('18');
  const [unitAProfAm, setUnitAProfAm] = useState<string>('0');
  const [unitAProfDeal, setUnitAProfDeal] = useState<string>('0');
  const [unitAQty, setUnitAQty] = useState<string>('1');

  // Unit B Pricing State
  const [unitBBasicPrice, setUnitBBasicPrice] = useState<string>('0');
  const [unitBGstPercent, setUnitBGstPercent] = useState<string>('18');
  const [unitBProfAm, setUnitBProfAm] = useState<string>('0');
  const [unitBProfDeal, setUnitBProfDeal] = useState<string>('0');
  const [unitBQty, setUnitBQty] = useState<string>('1');

  // Items added to the bill
  const [billItems, setBillItems] = useState<SaleItem[]>([]);
  const [manualRoundUp, setManualRoundUp] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState(false);

  // Payment Breakdown
  const [recdCash, setRecdCash] = useState<string>('0');
  const [recdUpi, setRecdUpi] = useState<string>('0');

  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isJustSaved, setIsJustSaved] = useState(false);

  // Keyboard navigation refs
  const billDateInputRef = useRef<HTMLInputElement>(null);
  const billNoInputRef = useRef<HTMLInputElement>(null);
  const partySelectRef = useRef<SearchableSelectHandle>(null);
  const categorySelectRef = useRef<SearchableSelectHandle>(null);
  const itemSearchRef = useRef<ItemSearchSelectHandle>(null);

  const unitABasicPriceInputRef = useRef<HTMLInputElement>(null);
  const unitAQtyInputRef = useRef<HTMLInputElement>(null);
  const unitAAddBtnRef = useRef<HTMLButtonElement>(null);

  const unitBBasicPriceInputRef = useRef<HTMLInputElement>(null);
  const unitBQtyInputRef = useRef<HTMLInputElement>(null);
  const unitBAddBtnRef = useRef<HTMLButtonElement>(null);

  const roundUpInputRef = useRef<HTMLInputElement>(null);
  const recdCashInputRef = useRef<HTMLInputElement>(null);
  const recdUpiInputRef = useRef<HTMLInputElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  // Auto initialize new bill number and auto-focus Bill Date on screen load
  useEffect(() => {
    if (!editingSaleId) {
      setBillNo(StockEngine.getNextBillNumber('SALE'));
      setBillDate(selectedDate || getTodayDateString());
    }
    const timer = setTimeout(() => {
      billDateInputRef.current?.focus();
      billDateInputRef.current?.select();
    }, 60);
    return () => clearTimeout(timer);
  }, [editingSaleId, selectedDate, refreshKey]);

  const selectedParty = useMemo(() => {
    return parties.find(p => p.id === partyId);
  }, [parties, partyId]);

  // Live computed Bill Summary with editable round up
  const billSummary = useMemo(() => {
    return calculateBillSummary(
      billItems,
      manualRoundUp !== null ? Number(manualRoundUp) : undefined
    );
  }, [billItems, manualRoundUp]);

  // Payment totals and credit calculation
  const totalPaid = useMemo(() => {
    return Number(((Number(recdCash) || 0) + (Number(recdUpi) || 0)).toFixed(2));
  }, [recdCash, recdUpi]);

  const balanceDue = useMemo(() => {
    return Number((billSummary.billTotal - totalPaid).toFixed(2));
  }, [billSummary.billTotal, totalPaid]);

  const isCreditSale = totalPaid < billSummary.billTotal && billItems.length > 0;
  const isCreditAllowed = Boolean(selectedParty?.allowCredit);

  // Can save check: If credit sale and credit NOT allowed, save is blocked!
  const isSaveBlockedByCredit = Boolean(isCreditSale && !isCreditAllowed);
  const canSaveSale = Boolean(partyId && billItems.length > 0 && billNo.trim() && !isSaveBlockedByCredit);

  // Filter items by category if selected
  const filteredCategoryItems = useMemo(() => {
    if (!selectedCategory) return items;
    return items.filter(i => i.category?.toLowerCase() === selectedCategory.toLowerCase());
  }, [items, selectedCategory]);

  const selectedItemObj = useMemo(() => {
    return items.find(i => i.id === selectedItemId);
  }, [items, selectedItemId]);

  const hasUnitB = Boolean(
    selectedItemObj &&
    (selectedItemObj.hasSecondaryUnit || (selectedItemObj.unitB && selectedItemObj.unitB.isActive !== false && selectedItemObj.unitB.unitName && selectedItemObj.unitB.unitName !== selectedItemObj.unitA?.unitName))
  );

  // When selected item changes, auto-populate configured rates for Unit A & Unit B directly from Item
  const handleItemSelect = (itemId: string) => {
    setIsTouched(true);
    setSelectedItemId(itemId);
    const found = items.find(i => i.id === itemId);
    if (found) {
      const uA = found.unitA || {
        basicPrice: found.purchaseRate || 0,
        gstPercent: found.gstPercent || 18,
        tranPercent: 0,
        profPercent: 0,
        profPercentAm: found.profPercentAm ?? 0,
        profPercentDeal: found.profPercentDeal ?? 0,
        misPercent: 0,
        salePrice: found.saleRate || 0,
        mrp: found.mrp || 0
      };

      setUnitABasicPrice(String(uA.basicPrice || 0));
      setUnitAGstPercent(String(uA.gstPercent || 18));
      
      const amateurProfA = uA.profPercentAm ?? found.profPercentAm ?? 0;
      const dealerProfA = uA.profPercentDeal ?? uA.profPercent ?? found.profPercentDeal ?? 0;

      setUnitAProfAm(String(amateurProfA));
      setUnitAProfDeal(String(dealerProfA));
      setUnitAQty('1');

      if (found.unitB) {
        setUnitBBasicPrice(String(found.unitB.basicPrice || 0));
        setUnitBGstPercent(String(found.unitB.gstPercent || 18));

        const amateurProfB = found.unitB.profPercentAm ?? 0;
        const dealerProfB = found.unitB.profPercentDeal ?? found.unitB.profPercent ?? 0;

        setUnitBProfAm(String(amateurProfB));
        setUnitBProfDeal(String(dealerProfB));
        setUnitBQty('1');
      }
    }
  };

  const handlePartyChange = (newPartyId: string) => {
    setIsTouched(true);
    setPartyId(newPartyId);
  };

  const isDealer = selectedParty?.partyType === 'DEALER';

  // Live computed values for Unit A and Unit B directly taking Item's configured MRP / Sale Price
  const calculatedUnitAPricing = useMemo(() => {
    if (!selectedItemObj) {
      return {
        basicPrice: 0,
        gstPercent: 0,
        gstAmt: 0,
        nettPrice: 0,
        profPercentAm: 0,
        profPercentDeal: 0,
        salePrice: 0,
        mrp: 0,
        effectivePrice: 0,
        qty: 0,
        amount: 0
      };
    }
    const uA = selectedItemObj.unitA;
    const saleRate = uA?.salePrice ?? selectedItemObj.saleRate ?? 0;
    const mrpRate = uA?.mrp ?? selectedItemObj.mrp ?? saleRate;
    const effectiveRate = isDealer ? saleRate : (mrpRate || saleRate);
    const qty = Number(unitAQty) || 0;
    const amount = Number((effectiveRate * qty).toFixed(2));
    const basic = uA?.basicPrice ?? selectedItemObj.purchaseRate ?? 0;
    const gst = uA?.gstPercent ?? selectedItemObj.gstPercent ?? 18;
    const gstAmt = Number((basic * (gst / 100)).toFixed(2));
    const nett = Number((basic + gstAmt).toFixed(2));

    return {
      basicPrice: basic,
      gstPercent: gst,
      gstAmt,
      nettPrice: nett,
      profPercentAm: uA?.profPercentAm ?? selectedItemObj.profPercentAm ?? 0,
      profPercentDeal: uA?.profPercentDeal ?? uA?.profPercent ?? selectedItemObj.profPercentDeal ?? 0,
      salePrice: saleRate,
      mrp: mrpRate,
      effectivePrice: effectiveRate,
      qty,
      amount
    };
  }, [selectedItemObj, unitAQty, isDealer]);

  const calculatedUnitBPricing = useMemo(() => {
    if (!selectedItemObj || !selectedItemObj.unitB) {
      return {
        basicPrice: 0,
        gstPercent: 0,
        gstAmt: 0,
        nettPrice: 0,
        profPercentAm: 0,
        profPercentDeal: 0,
        salePrice: 0,
        mrp: 0,
        effectivePrice: 0,
        qty: 0,
        amount: 0
      };
    }
    const uB = selectedItemObj.unitB;
    const saleRate = uB.salePrice ?? 0;
    const mrpRate = uB.mrp ?? saleRate;
    const effectiveRate = isDealer ? saleRate : (mrpRate || saleRate);
    const qty = Number(unitBQty) || 0;
    const amount = Number((effectiveRate * qty).toFixed(2));
    const basic = uB.basicPrice ?? 0;
    const gst = uB.gstPercent ?? selectedItemObj.gstPercent ?? 18;
    const gstAmt = Number((basic * (gst / 100)).toFixed(2));
    const nett = Number((basic + gstAmt).toFixed(2));

    return {
      basicPrice: basic,
      gstPercent: gst,
      gstAmt,
      nettPrice: nett,
      profPercentAm: uB.profPercentAm ?? 0,
      profPercentDeal: uB.profPercentDeal ?? uB.profPercent ?? 0,
      salePrice: saleRate,
      mrp: mrpRate,
      effectivePrice: effectiveRate,
      qty,
      amount
    };
  }, [selectedItemObj, unitBQty, isDealer]);

  // Current stock for the selected item
  const selectedItemCurrentStock = useMemo(() => {
    if (!selectedItemId) return 0;
    return StockEngine.getItemCurrentStock(selectedItemId);
  }, [selectedItemId, refreshKey]);

  const isFormActive = Boolean(editingSaleId || billItems.length > 0 || selectedItemId || isTouched);

  // Add Unit A Item
  const handleAddUnitAItem = () => {
    setIsTouched(true);
    if (!selectedItemId) {
      showAlert('Please select an item first.', 'Validation Error', 'error');
      itemSearchRef.current?.focus();
      return;
    }
    const numQty = Number(unitAQty);
    if (!numQty || numQty <= 0) {
      showAlert('Quantity must be greater than 0', 'Validation Error', 'error');
      unitAQtyInputRef.current?.focus();
      return;
    }

    const itemObj = items.find(i => i.id === selectedItemId);
    if (!itemObj) return;

    if (numQty > selectedItemCurrentStock) {
      showToast(`Notice: Available stock is ${selectedItemCurrentStock} ${itemObj.unit || 'Units'}`, 'warning');
    }

    const unitLabel = itemObj.unitA?.unitName || itemObj.unit || 'Roll';
    const newSaleItem: SaleItem = {
      id: `sale-item-${Date.now()}-${Math.random()}`,
      itemId: itemObj.id,
      sno: itemObj.sno,
      itemName: `${itemObj.name}`,
      unit: unitLabel,
      basicPrice: calculatedUnitAPricing.basicPrice,
      gstPercent: calculatedUnitAPricing.gstPercent,
      gstAmt: calculatedUnitAPricing.gstAmt,
      nettPrice: calculatedUnitAPricing.nettPrice,
      profPercentAm: calculatedUnitAPricing.profPercentAm,
      profPercentDeal: calculatedUnitAPricing.profPercentDeal,
      profPercent: selectedParty?.partyType === 'DEALER' ? calculatedUnitAPricing.profPercentDeal : calculatedUnitAPricing.profPercentAm,
      toPercent: selectedParty?.partyType === 'DEALER' ? calculatedUnitAPricing.profPercentDeal : calculatedUnitAPricing.profPercentAm,
      salePrice: calculatedUnitAPricing.salePrice,
      mrp: calculatedUnitAPricing.mrp,
      qty: calculatedUnitAPricing.qty,
      amount: calculatedUnitAPricing.amount,
      isSecondaryUnit: false,
      conversionFactor: 1,
      baseQty: calculatedUnitAPricing.qty
    };

    setBillItems(prev => [...prev, newSaleItem]);
    showToast(`Added ${numQty} ${unitLabel} of ${itemObj.name}`, 'success');

    // Reset item input and immediately focus ItemSearchSelect for the next product!
    setSelectedItemId('');
    setUnitAQty('1');
    setTimeout(() => {
      itemSearchRef.current?.focus();
    }, 40);
  };

  // Add Unit B Item
  const handleAddUnitBItem = () => {
    setIsTouched(true);
    if (!selectedItemId) {
      showAlert('Please select an item first.', 'Validation Error', 'error');
      itemSearchRef.current?.focus();
      return;
    }
    const numQty = Number(unitBQty);
    if (!numQty || numQty <= 0) {
      showAlert('Quantity must be greater than 0', 'Validation Error', 'error');
      unitBQtyInputRef.current?.focus();
      return;
    }

    const itemObj = items.find(i => i.id === selectedItemId);
    if (!itemObj || !itemObj.unitB) return;

    const convFactor = Number(itemObj.unitB.conversionFactor) || 1;
    const baseQty = Number((numQty / convFactor).toFixed(3));
    const unitLabel = itemObj.unitB.unitName || 'Mt.';

    const newSaleItem: SaleItem = {
      id: `sale-item-${Date.now()}-${Math.random()}`,
      itemId: itemObj.id,
      sno: itemObj.sno,
      itemName: `${itemObj.name} (${unitLabel})`,
      unit: unitLabel,
      basicPrice: calculatedUnitBPricing.basicPrice,
      gstPercent: calculatedUnitBPricing.gstPercent,
      gstAmt: calculatedUnitBPricing.gstAmt,
      nettPrice: calculatedUnitBPricing.nettPrice,
      profPercentAm: calculatedUnitBPricing.profPercentAm,
      profPercentDeal: calculatedUnitBPricing.profPercentDeal,
      profPercent: selectedParty?.partyType === 'DEALER' ? calculatedUnitBPricing.profPercentDeal : calculatedUnitBPricing.profPercentAm,
      toPercent: selectedParty?.partyType === 'DEALER' ? calculatedUnitBPricing.profPercentDeal : calculatedUnitBPricing.profPercentAm,
      salePrice: calculatedUnitBPricing.salePrice,
      mrp: calculatedUnitBPricing.mrp,
      qty: calculatedUnitBPricing.qty,
      amount: calculatedUnitBPricing.amount,
      isSecondaryUnit: true,
      conversionFactor: convFactor,
      baseQty
    };

    setBillItems(prev => [...prev, newSaleItem]);
    showToast(`Added ${numQty} ${unitLabel} (${baseQty} ${itemObj.unitA?.unitName || 'Roll'}) of ${itemObj.name}`, 'success');

    // Reset item input and immediately focus ItemSearchSelect for next product
    setSelectedItemId('');
    setUnitBQty('1');
    setTimeout(() => {
      itemSearchRef.current?.focus();
    }, 40);
  };

  const handleEditLineItem = (index: number) => {
    setIsTouched(true);
    const item = billItems[index];
    const foundItem = items.find(i => i.id === item.itemId);
    if (foundItem?.category) setSelectedCategory(foundItem.category);
    setSelectedItemId(item.itemId);
    if (item.isSecondaryUnit) {
      setUnitBBasicPrice(String(item.basicPrice));
      setUnitBGstPercent(String(item.gstPercent));
      setUnitBProfAm(String(item.profPercentAm !== undefined ? item.profPercentAm : (item.profPercent || 0)));
      setUnitBProfDeal(String(item.profPercentDeal !== undefined ? item.profPercentDeal : (item.profPercent || 0)));
      setUnitBQty(String(item.qty));
      setTimeout(() => {
        unitBBasicPriceInputRef.current?.focus();
        unitBBasicPriceInputRef.current?.select();
      }, 40);
    } else {
      setUnitABasicPrice(String(item.basicPrice));
      setUnitAGstPercent(String(item.gstPercent));
      setUnitAProfAm(String(item.profPercentAm !== undefined ? item.profPercentAm : (item.profPercent || 0)));
      setUnitAProfDeal(String(item.profPercentDeal !== undefined ? item.profPercentDeal : (item.profPercent || 0)));
      setUnitAQty(String(item.qty));
      setTimeout(() => {
        unitABasicPriceInputRef.current?.focus();
        unitABasicPriceInputRef.current?.select();
      }, 40);
    }
    setEditingItemIndex(index);
  };

  const handleDeleteLineItem = (index: number) => {
    setIsTouched(true);
    setBillItems(prev => prev.filter((_, i) => i !== index));
    if (editingItemIndex === index) {
      setEditingItemIndex(null);
      setSelectedItemId('');
    }
  };

  const handleNewEntry = () => {
    setEditingSaleId(null);
    setIsJustSaved(false);
    setIsTouched(false);
    setIsViewOnly(false);
    setBillNo(StockEngine.getNextBillNumber('SALE'));
    setBillDate(getTodayDateString());
    setPartyId('');
    setSelectedCategory('');
    setBillItems([]);
    setRecdCash('0');
    setRecdUpi('0');
    setSelectedItemId('');
    setEditingItemIndex(null);
    setManualRoundUp(null);
    showToast('New Sale entry ready', 'info');
    setTimeout(() => {
      billDateInputRef.current?.focus();
    }, 40);
  };

  const handleSaveSale = () => {
    if (isViewOnly) {
      setIsEditPromptOpen(true);
      return;
    }
    if (!partyId) {
      showAlert('Please select a customer / party.', 'Validation Error', 'error');
      partySelectRef.current?.focus();
      return;
    }
    if (!billNo.trim()) {
      showAlert('Bill No. is required', 'Validation Error', 'error');
      billNoInputRef.current?.focus();
      return;
    }
    if (billItems.length === 0) {
      showAlert('Please add at least one item to the sale bill.', 'Validation Error', 'error');
      itemSearchRef.current?.focus();
      return;
    }

    const party = parties.find(p => p.id === partyId);

    // Credit enforcement: if total paid is less than bill total, check if party has allowCredit enabled
    if (isSaveBlockedByCredit) {
      showAlert(
        `Party "${party?.name || 'Customer'}" does not have Credit Privileges enabled. Total payment received (₹${totalPaid}) must equal Bill Total (₹${billSummary.billTotal}). Please collect the full payment or enable "Allow Credit" in Party Master.`,
        'Credit Sale Not Allowed',
        'error'
      );
      return;
    }

    const saleRecord: Sale = {
      id: editingSaleId || `sale-${Date.now()}`,
      billNo: billNo.trim(),
      billDate,
      partyId,
      partyName: party?.name || 'Cash Customer',
      items: billItems,
      basicTotal: billSummary.basicTotal,
      gstTotal: billSummary.gstTotal,
      roundUp: billSummary.roundUp,
      billTotal: billSummary.billTotal,
      recdCash: Number(recdCash) || 0,
      recdUpi: Number(recdUpi) || 0,
      balanceDue: isCreditSale ? balanceDue : 0,
      isCreditSale: isCreditSale,
      notes: isCreditSale ? `Credit Sale. Paid: ₹${totalPaid}, Balance Due: ₹${balanceDue}` : `Cash: ₹${recdCash}, UPI: ₹${recdUpi}`,
      createdAt: new Date().toISOString()
    };

    // Save to Database: automatically registers SALE_OUT in universal Stock Ledger and Party Statement Log!
    db.saveSale(saleRecord);

    if (editingSaleId) {
      setIsJustSaved(true);
      setIsTouched(false);
      setIsViewOnly(false);
      showToast(`Sale Invoice ${saleRecord.billNo} updated! Stock & Ledger adjusted.`, 'success');
    } else {
      setIsJustSaved(false);
      setIsViewOnly(false);
      showToast(`Sale Invoice ${saleRecord.billNo} saved! Stock & Ledger updated.`, 'success');
      handleNewEntry();
    }
  };

  const handleLoadSaleForEdit = (sale: Sale, viewOnly: boolean = false) => {
    setIsJustSaved(false);
    setEditingSaleId(sale.id);
    setIsViewOnly(viewOnly);
    setIsTouched(true);
    setBillNo(sale.billNo);
    setBillDate(sale.billDate);
    setPartyId(sale.partyId);
    setBillItems(sale.items);
    setRecdCash(String(sale.recdCash || 0));
    setRecdUpi(String(sale.recdUpi || 0));
    setManualRoundUp(sale.roundUp !== undefined ? String(sale.roundUp) : null);
    showToast(viewOnly ? `Viewing invoice ${sale.billNo}` : `Loaded invoice ${sale.billNo} for editing`, 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCurrentSale = () => {
    if (!editingSaleId) {
      showToast('Please select a saved invoice to delete', 'warning');
      return;
    }
    if (!hasPermission('DELETE_SALE')) {
      showToast('You do not have permission to delete sales', 'error');
      return;
    }
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteSale = () => {
    if (editingSaleId) {
      db.deleteSale(editingSaleId);
      showToast(`Sale invoice deleted. Stock restored.`, 'info');
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
        handleSaveSale();
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
  }, [billNo, partyId, billItems, billSummary, recdCash, recdUpi, isViewOnly, isSaveBlockedByCredit]);

  const currentSaleForPrint: Sale = {
    id: editingSaleId || 'temp',
    billNo: billNo || 'NEW-INVOICE',
    billDate,
    partyId,
    partyName: selectedParty?.name || 'Cash Customer',
    items: billItems,
    basicTotal: billSummary.basicTotal,
    gstTotal: billSummary.gstTotal,
    roundUp: billSummary.roundUp,
    billTotal: billSummary.billTotal,
    recdCash: Number(recdCash) || 0,
    recdUpi: Number(recdUpi) || 0,
    balanceDue: isCreditSale ? balanceDue : 0,
    isCreditSale: isCreditSale,
    notes: isCreditSale ? `Credit Sale. Paid: ₹${totalPaid}, Balance Due: ₹${balanceDue}` : `Cash: ₹${recdCash}, UPI: ₹${recdUpi}`,
    createdAt: new Date().toISOString()
  };

  const filteredSales = useMemo(() => {
    const q = searchHistory.toLowerCase().trim();
    if (!q) return salesHistory;
    return salesHistory.filter(
      s =>
        s.billNo.toLowerCase().includes(q) ||
        s.partyName.toLowerCase().includes(q) ||
        s.billDate.includes(q)
    );
  }, [salesHistory, searchHistory]);

  const isEditing = Boolean(editingSaleId && !isViewOnly);
  const isViewing = Boolean(editingSaleId && isViewOnly);
  const isCreating = Boolean(!editingSaleId && !isJustSaved && (isTouched || billItems.length > 0 || selectedItemId || billNo.trim() !== ''));

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
      {/* Hidden Print Slip */}
      <SalesPrintInvoice sale={currentSaleForPrint} />

      {/* Top Header Strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="pill-header-lavender" style={{ fontSize: '1.25rem', padding: '8px 36px', minWidth: '220px', textAlign: 'center' }}>
            SALE ENTRY
          </div>
          {isJustSaved ? (
            <span className="active-mode-indicator is-saved">
              ● Saved / Updated Just Now ({billNo})
            </span>
          ) : isViewing ? (
            <span className="active-mode-indicator is-initial" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B' }}>
              ● Viewing Invoice: {billNo} (Read Only — Double-Click to Edit)
            </span>
          ) : isEditing ? (
            <span className="active-mode-indicator is-editing">
              ● Editing Sale Invoice ({billNo})
            </span>
          ) : isCreating ? (
            <span className="active-mode-indicator is-creating">
              ● Creating New Sale Entry
            </span>
          ) : (
            <span className="active-mode-indicator is-initial">
              ● Ready for New Entry
            </span>
          )}
        </div>

        {/* Keyboard shortcuts banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#4B5563', background: '#FFFFFF', padding: '5px 12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
          <Keyboard size={15} color="#4F46E5" />
          <span><b>Enter:</b> Next Field / Add Item</span>
          <span style={{ color: '#D1D5DB' }}>|</span>
          <span><b>Ctrl+S:</b> Save</span>
          <span style={{ color: '#D1D5DB' }}>|</span>
          <span><b>Alt+N:</b> New</span>
        </div>
      </div>

      {/* Main Entry Card: Light Blue on Initial, Light Green on Creating, Light Pink on Editing */}
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
              🔒 View-Only Mode: Sales invoice is locked against accidental edits. Click anywhere or press button to edit.
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
        {/* Top date and bill no */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 900, fontSize: '0.95rem' }}>BILL DATE</label>
            <input
              ref={billDateInputRef}
              type="date"
              className="input-text-clean"
              value={billDate}
              onChange={e => { setIsTouched(true); setBillDate(e.target.value); }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  billNoInputRef.current?.focus();
                  billNoInputRef.current?.select();
                }
              }}
              style={{ width: '145px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 900, fontSize: '0.95rem' }}>BILL NO.</label>
            <input
              ref={billNoInputRef}
              type="text"
              className="input-text-clean"
              value={billNo}
              onChange={e => { setIsTouched(true); setBillNo(e.target.value); }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  partySelectRef.current?.focus();
                }
              }}
              style={{ width: '140px', fontWeight: 800 }}
            />
          </div>
        </div>

        {/* PARTY SELECTION ROW */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontWeight: 900, fontSize: '1.05rem' }}>Party :</label>
          <SearchableSelect
            ref={partySelectRef}
            options={partyOptions}
            value={partyId}
            onChange={val => handlePartyChange(val)}
            onEnterNext={() => {
              categorySelectRef.current?.focus();
            }}
            placeholder="Type customer/party name/phone or use arrows..."
            onQuickAdd={() => openQuickModal('PARTY', (newId) => {
              handlePartyChange(newId);
              setTimeout(() => categorySelectRef.current?.focus(), 40);
            })}
            quickAddTitle="Quick Create Party"
          />
        </div>

        {/* CATG. ROW */}
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

        {/* ITEM SELECTION ROW */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontWeight: 900, fontSize: '1.05rem' }}>ITEM :</label>
          <ItemSearchSelect
            ref={itemSearchRef}
            items={filteredCategoryItems}
            selectedItemId={selectedItemId}
            onSelectItem={(item) => handleItemSelect(item ? item.id : '')}
            onEnterNext={() => {
              unitAQtyInputRef.current?.focus();
              unitAQtyInputRef.current?.select();
            }}
            onQuickAdd={() => openQuickModal('ITEM', (newId) => handleItemSelect(newId))}
            placeholder="Type to search item name/code or use arrow keys..."
          />
        </div>

        {/* DUAL PRICING INPUT CARDS (UNIT-A & UNIT-B) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Card 1: Unit A */}
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
                gridTemplateColumns: '1.2fr 100px 1.2fr auto',
                gap: '10px',
                alignItems: 'flex-end'
              }}
            >
              {selectedParty?.partyType === 'DEALER' ? (
                <div>
                  <label style={{ display: 'block', color: '#5B21B6', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
                    Sale Price ★ (Dealer)
                  </label>
                  <input
                    type="text"
                    readOnly
                    className="input-text-clean"
                    value={calculatedUnitAPricing.salePrice}
                    style={{
                      textAlign: 'center',
                      background: '#F5F3FF',
                      borderColor: '#8B5CF6',
                      color: '#6D28D9',
                      padding: '4px',
                      fontWeight: 800
                    }}
                    title="Dealer rate applied to bill"
                  />
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', color: '#1E40AF', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
                    MRP ★ {selectedParty?.partyType === 'AMATEUR' ? '(Amateur)' : ''}
                  </label>
                  <input
                    type="text"
                    readOnly
                    className="input-text-clean"
                    value={calculatedUnitAPricing.mrp}
                    style={{
                      textAlign: 'center',
                      background: '#EFF6FF',
                      borderColor: '#3B82F6',
                      color: '#1D4ED8',
                      padding: '4px',
                      fontWeight: 800
                    }}
                    title="Amateur / Retail MRP applied to bill"
                  />
                </div>
              )}
              <div>
                <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>Qty ({selectedItemObj?.unitA?.unitName || 'Unit A'})</label>
                <input
                  ref={unitAQtyInputRef}
                  type="number"
                  min="1"
                  className="input-text-clean"
                  value={unitAQty}
                  onChange={e => { setIsTouched(true); setUnitAQty(e.target.value); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      unitAAddBtnRef.current?.focus();
                    }
                  }}
                  style={{ textAlign: 'center', padding: '4px', fontWeight: 900, color: '#EA3943' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>Amount</label>
                <input type="text" readOnly className="input-text-clean" value={calculatedUnitAPricing.amount} style={{ textAlign: 'center', background: '#F3F4F6', padding: '4px', fontWeight: 800 }} />
              </div>
              <div style={{ paddingBottom: '2px' }}>
                <button
                  ref={unitAAddBtnRef}
                  type="button"
                  onClick={handleAddUnitAItem}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddUnitAItem();
                    }
                  }}
                  className="btn-customer-save"
                  style={{
                    padding: '7px 18px',
                    fontSize: '0.85rem',
                    fontWeight: 900,
                    whiteSpace: 'nowrap',
                    outline: 'none',
                    transition: 'all 0.15s ease-in-out'
                  }}
                  onFocus={e => {
                    e.currentTarget.style.boxShadow = '0 0 0 3.5px #1E40AF, 0 4px 14px rgba(30, 64, 175, 0.45)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.borderColor = '#1E40AF';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.borderColor = '#000000';
                  }}
                  title="Add item (press Enter to add)"
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
                  gridTemplateColumns: '1.2fr 100px 1.2fr auto',
                  gap: '10px',
                  alignItems: 'flex-end'
                }}
              >
                {selectedParty?.partyType === 'DEALER' ? (
                  <div>
                    <label style={{ display: 'block', color: '#5B21B6', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
                      Sale Price ★ (Dealer)
                    </label>
                    <input
                      type="text"
                      readOnly
                      className="input-text-clean"
                      value={calculatedUnitBPricing.salePrice}
                      style={{
                        textAlign: 'center',
                        background: '#F5F3FF',
                        borderColor: '#8B5CF6',
                        color: '#6D28D9',
                        padding: '4px',
                        fontWeight: 800
                      }}
                      title="Dealer rate applied to bill"
                    />
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', color: '#1E40AF', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
                      MRP ★ {selectedParty?.partyType === 'AMATEUR' ? '(Amateur)' : ''}
                    </label>
                    <input
                      type="text"
                      readOnly
                      className="input-text-clean"
                      value={calculatedUnitBPricing.mrp}
                      style={{
                        textAlign: 'center',
                        background: '#EFF6FF',
                        borderColor: '#3B82F6',
                        color: '#1D4ED8',
                        padding: '4px',
                        fontWeight: 800
                      }}
                      title="Amateur / Retail MRP applied to bill"
                    />
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>Qty ({selectedItemObj?.unitB?.unitName || 'Unit B'})</label>
                  <input
                    ref={unitBQtyInputRef}
                    type="number"
                    min="1"
                    className="input-text-clean"
                    value={unitBQty}
                    onChange={e => { setIsTouched(true); setUnitBQty(e.target.value); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        unitBAddBtnRef.current?.focus();
                      }
                    }}
                    style={{ textAlign: 'center', padding: '4px', fontWeight: 900, color: '#EA3943' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>Amount</label>
                  <input type="text" readOnly className="input-text-clean" value={calculatedUnitBPricing.amount} style={{ textAlign: 'center', background: '#F3F4F6', padding: '4px', fontWeight: 800 }} />
                </div>
                <div style={{ paddingBottom: '2px' }}>
                  <button
                    ref={unitBAddBtnRef}
                    type="button"
                    onClick={handleAddUnitBItem}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddUnitBItem();
                      }
                    }}
                    className="btn-customer-save"
                    style={{
                      padding: '7px 18px',
                      fontSize: '0.85rem',
                      fontWeight: 900,
                      whiteSpace: 'nowrap',
                      background: '#A7F3D0',
                      outline: 'none',
                      transition: 'all 0.15s ease-in-out'
                    }}
                    onFocus={e => {
                      e.currentTarget.style.boxShadow = '0 0 0 3.5px #059669, 0 4px 14px rgba(5, 150, 105, 0.45)';
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.borderColor = '#059669';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.borderColor = '#000000';
                    }}
                    title="Add secondary unit item (press Enter to add)"
                  >
                    + Add {selectedItemObj?.unitB?.unitName || 'Unit B'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ITEMS TABLE matching sales layout */}
        <div style={{ border: '2px solid #000000', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#D2BEF6', borderBottom: '2px solid #000000' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, borderRight: '1px solid #000000' }}>Item</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, width: '120px', borderRight: '1px solid #000000' }}>
                  {selectedParty?.partyType === 'DEALER' ? 'Sale Price' : 'MRP'}
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, width: '90px', borderRight: '1px solid #000000' }}>Qty</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, width: '120px', borderRight: '1px solid #000000' }}>Amount</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, width: '70px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {billItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#9CA3AF', fontWeight: 600 }}>
                    No items in current sales invoice. Select item above and press Enter on Qty or click "Add".
                  </td>
                </tr>
              ) : (
                billItems.map((item, idx) => (
                  <tr key={idx} onClick={() => handleEditLineItem(idx)} style={{ borderBottom: '1px solid #E5E7EB', cursor: 'pointer', background: editingItemIndex === idx ? '#F3E8FF' : 'transparent' }} title="Click to edit item rates">
                    <td style={{ padding: '8px 12px', fontWeight: 800, borderRight: '1px solid #000000' }}>{item.itemName}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, borderRight: '1px solid #000000', color: selectedParty?.partyType === 'DEALER' ? '#6D28D9' : '#1D4ED8' }}>
                      {selectedParty?.partyType === 'DEALER' ? item.salePrice : (item.mrp || item.salePrice)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: '#16A34A', borderRight: '1px solid #000000' }}>{item.qty} {item.unit}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, borderRight: '1px solid #000000' }}>{item.amount}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLineItem(idx);
                        }}
                        style={{
                          background: '#FEE2E2',
                          border: '1px solid #EF4444',
                          color: '#B91C1C',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                        title="Remove item from bill"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: '#D2BEF6', borderTop: '2px solid #000000' }}>
                <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, borderRight: '1px solid #000000' }}>Total</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: '#002B99', borderRight: '1px solid #000000' }}>{billSummary.billTotal}</td>
                <td style={{ background: '#D2BEF6' }}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* BOTTOM SECTION WITH EDITABLE ROUND UP */}
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '30px', alignItems: 'center', marginTop: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '340px' }}>
            {/* EDITABLE ROUND UP */}
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
                      recdCashInputRef.current?.focus();
                      recdCashInputRef.current?.select();
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

            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#EA3943', fontWeight: 900, fontSize: '1.05rem' }}>BILL TOTAL</span>
              <input type="text" readOnly className="input-text-clean" value={billSummary.billTotal} style={{ textAlign: 'right', fontWeight: 900, fontSize: '1.15rem', background: '#FFFFFF', color: '#002B99' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#EA3943', fontWeight: 900, fontSize: '0.95rem' }}>RECD CASH</span>
              <input
                ref={recdCashInputRef}
                type="number"
                className="input-text-clean"
                value={recdCash}
                onChange={e => { setIsTouched(true); setRecdCash(e.target.value); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    recdUpiInputRef.current?.focus();
                    recdUpiInputRef.current?.select();
                  }
                }}
                style={{ textAlign: 'right', fontWeight: 800 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#EA3943', fontWeight: 900, fontSize: '0.95rem' }}>RECD UPI</span>
              <input
                ref={recdUpiInputRef}
                type="number"
                className="input-text-clean"
                value={recdUpi}
                onChange={e => { setIsTouched(true); setRecdUpi(e.target.value); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveButtonRef.current?.focus();
                  }
                }}
                style={{ textAlign: 'right', fontWeight: 800 }}
              />
            </div>

            {/* Total Paid & Credit Calculation Status Banner */}
            {billSummary.billTotal > 0 && (
              <div style={{ marginTop: '4px', padding: '8px 10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 800, border: '1px solid', ...(
                isSaveBlockedByCredit
                  ? { background: '#FEE2E2', borderColor: '#F87171', color: '#991B1B' }
                  : isCreditSale
                  ? { background: '#FEF3C7', borderColor: '#F59E0B', color: '#92400E' }
                  : { background: '#DCFCE7', borderColor: '#86EFAC', color: '#166534' }
              )}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Total Paid: ₹{totalPaid}</span>
                  <span>{isCreditSale ? `Due: ₹${balanceDue}` : 'Paid in Full'}</span>
                </div>
                {isSaveBlockedByCredit && (
                  <div style={{ marginTop: '4px', fontSize: '0.78rem', color: '#DC2626' }}>
                    ⛔ Credit NOT Allowed for this party. Total paid must equal ₹{billSummary.billTotal}!
                  </div>
                )}
                {isCreditSale && isCreditAllowed && (
                  <div style={{ marginTop: '4px', fontSize: '0.78rem', color: '#B45309' }}>
                    ✓ Credit Authorized for {selectedParty?.name}. ₹{balanceDue} will be added to ledger.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Customer Action Buttons: Del, Large Save, Print */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-customer-action-pill"
              onClick={handleDeleteCurrentSale}
              disabled={!isEditing && !isViewing}
              style={{ opacity: (isEditing || isViewing) ? 1 : 0.5, cursor: (isEditing || isViewing) ? 'pointer' : 'not-allowed' }}
            >
              Del
            </button>

            <button
              ref={saveButtonRef}
              type="button"
              onClick={handleSaveSale}
              disabled={isSaveBlockedByCredit}
              className="btn-customer-save"
              style={{
                padding: '10px 48px',
                fontSize: '1.2rem',
                minWidth: '160px',
                opacity: isSaveBlockedByCredit ? 0.45 : 1,
                cursor: isSaveBlockedByCredit ? 'not-allowed' : 'pointer',
                background: isSaveBlockedByCredit ? '#9CA3AF' : undefined,
                boxShadow: isSaveBlockedByCredit ? 'none' : undefined
              }}
              title={isSaveBlockedByCredit ? `Credit not allowed for ${selectedParty?.name || 'this customer'}. Must collect full ₹${billSummary.billTotal}` : 'Save Sales Invoice (Ctrl+S / Alt+S)'}
            >
              {isViewing ? 'Edit Invoice' : 'Save'}
            </button>

            <button
              type="button"
              className="btn-customer-action-pill"
              onClick={handlePrint}
              title="Print Invoice (Alt+P)"
            >
              Print
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Sales Invoices History in the Downside (Always Visible) */}
      <div id="sales-invoices-register" style={{ marginTop: '28px', background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '20px', maxWidth: '960px', margin: '28px auto 0', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h4 style={{ fontWeight: 900, fontSize: '1.1rem', margin: 0 }}>Sales Invoices Register (History)</h4>
            <span style={{ fontSize: '0.8rem', background: '#E0E7FF', color: '#3730A3', padding: '2px 10px', borderRadius: '12px', fontWeight: 800 }}>
              {filteredSales.length} {filteredSales.length === 1 ? 'Record' : 'Records'}
            </span>
          </div>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={14} color="#6B7280" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input type="text" placeholder="Search invoice, customer..." className="input-text-clean" value={searchHistory} onChange={e => setSearchHistory(e.target.value)} style={{ paddingLeft: '32px', fontSize: '0.85rem' }} />
          </div>
        </div>
        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Invoice Date</th>
                <th>Bill No.</th>
                <th>Party / Customer</th>
                <th style={{ textAlign: 'center' }}>Total Items</th>
                <th style={{ textAlign: 'right' }}>Bill Total</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF', fontWeight: 600 }}>
                    No sales invoice records found.
                  </td>
                </tr>
              ) : (
                filteredSales.map(s => (
                  <tr
                    key={s.id}
                    style={{ backgroundColor: editingSaleId === s.id ? '#EFF6FF' : 'transparent', cursor: 'pointer' }}
                    onClick={() => handleLoadSaleForEdit(s, true)}
                    onDoubleClick={() => handleLoadSaleForEdit(s, false)}
                    title="Single-click to View, Double-click to Edit"
                  >
                    <td>{s.billDate}</td>
                    <td style={{ fontWeight: 800 }}>{s.billNo}</td>
                    <td>{s.partyName}</td>
                    <td style={{ textAlign: 'center' }}>{s.items?.length || 0}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#16A34A' }}>₹{s.billTotal}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleLoadSaleForEdit(s, false);
                        }}
                        style={{
                          background: (editingSaleId === s.id && !isViewOnly) ? '#BFDBFE' : '#E2D2F8',
                          color: (editingSaleId === s.id && !isViewOnly) ? '#1E40AF' : '#EA3943',
                          border: '1px solid #C4B5FD',
                          borderRadius: '12px',
                          padding: '3px 12px',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        {(editingSaleId === s.id && !isViewOnly) ? 'Editing' : 'Edit'}
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
        message="Would you like to edit this sales invoice?"
        confirmText="Yes, Edit"
        cancelText="No, Keep View Only"
      />

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmDeleteSale}
        title="Delete Sales Invoice"
        message={`Are you sure you want to delete invoice "${billNo}"? This will reverse the transaction and restore inventory stock.`}
      />
    </div>
  );
};
