import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Item, Party, Sale, SaleItem } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { getTodayDateString } from '../../utils/dateUtils';
import { calculateItemPricing, calculateBillSummary } from '../../utils/calculations';
import { SalesPrintInvoice } from './SalesPrintInvoice';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Search } from 'lucide-react';

export const SalesEntryView: React.FC = () => {
  const { showToast, openQuickModal, refreshKey, selectedDate } = useApp();
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

  // Form Header State
  const [billDate, setBillDate] = useState<string>(getTodayDateString());
  const [billNo, setBillNo] = useState<string>('');
  const [partyId, setPartyId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);

  // Line Item Input Strip State
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedUnitType, setSelectedUnitType] = useState<'unitA' | 'unitB'>('unitA');
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  const [basicPrice, setBasicPrice] = useState<string>('0');
  const [gstPercent, setGstPercent] = useState<string>('18');
  const [toPercent, setToPercent] = useState<string>('0');
  const [qty, setQty] = useState<string>('1');

  // Items added to the bill
  const [billItems, setBillItems] = useState<SaleItem[]>([]);

  // Payment Breakdown
  const [recdCash, setRecdCash] = useState<string>('0');
  const [recdUpi, setRecdUpi] = useState<string>('0');

  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // Auto initialize new bill number
  useEffect(() => {
    if (!editingSaleId) {
      setBillNo(StockEngine.getNextBillNumber('SALE'));
      setBillDate(selectedDate || getTodayDateString());
      if (parties.length > 0 && !partyId) {
        setPartyId(parties[0].id);
      }
    }
  }, [editingSaleId, selectedDate, parties, refreshKey]);

  // Filter items by category if selected
  const filteredCategoryItems = useMemo(() => {
    if (!selectedCategory) return items;
    return items.filter(i => i.category?.toLowerCase() === selectedCategory.toLowerCase());
  }, [items, selectedCategory]);

  // When selected item changes, auto-populate configured rates
  const handleItemSelect = (itemId: string, unitType: 'unitA' | 'unitB' = 'unitA') => {
    setSelectedItemId(itemId);
    setSelectedUnitType(unitType);
    const found = items.find(i => i.id === itemId);
    if (found) {
      const pricing = unitType === 'unitB' && found.unitB ? found.unitB : (found.unitA || {
        basicPrice: found.purchaseRate || 0,
        gstPercent: found.gstPercent || 18,
        tranPercent: 0,
        profPercent: 0,
        misPercent: 0,
        roundUp: 0,
        salePrice: found.saleRate || 0
      });

      setBasicPrice(String(pricing.basicPrice || 0));
      setGstPercent(String(pricing.gstPercent || 18));
      const totalMargin = (pricing.tranPercent || 0) + (pricing.profPercent || 0) + (pricing.misPercent || 0);
      setToPercent(String(totalMargin));
      setQty('1');
    }
  };

  // Live computed values for pricing strip
  const calculatedLinePricing = useMemo(() => {
    return calculateItemPricing(
      Number(basicPrice),
      Number(gstPercent),
      Number(toPercent),
      Number(qty)
    );
  }, [basicPrice, gstPercent, toPercent, qty]);

  // Current stock for the selected item
  const selectedItemCurrentStock = useMemo(() => {
    if (!selectedItemId) return 0;
    return StockEngine.getItemCurrentStock(selectedItemId);
  }, [selectedItemId, refreshKey]);

  // Live computed Bill Summary
  const billSummary = useMemo(() => {
    return calculateBillSummary(billItems);
  }, [billItems]);

  // Auto-balance payment when bill total changes if not manually set
  useEffect(() => {
    if (billItems.length > 0) {
      const currentCash = Number(recdCash) || 0;
      const currentUpi = Number(recdUpi) || 0;
      if (currentCash === 0 && currentUpi === 0) {
        setRecdCash(String(billSummary.billTotal));
      }
    }
  }, [billSummary.billTotal]);

  // Add or Update Line Item
  const handleAddOrUpdateLineItem = () => {
    if (!selectedItemId) {
      showToast('Please select an item', 'error');
      return;
    }
    const numQty = Number(qty);
    if (!numQty || numQty <= 0) {
      showToast('Quantity must be greater than 0', 'error');
      return;
    }

    const itemObj = items.find(i => i.id === selectedItemId);
    if (!itemObj) return;

    if (numQty > selectedItemCurrentStock) {
      showToast(`Notice: Available stock is ${selectedItemCurrentStock} for ${itemObj.name}`, 'warning');
    }

    const unitLabel = selectedUnitType === 'unitB' && itemObj.unitB?.unitName ? itemObj.unitB.unitName : itemObj.unitA?.unitName || itemObj.unit;

    const newSaleItem: SaleItem = {
      id: `sale-item-${Date.now()}-${Math.random()}`,
      itemId: itemObj.id,
      sno: itemObj.sno,
      itemName: `${itemObj.name}${unitLabel ? ` (${unitLabel})` : ''}`,
      unit: unitLabel,
      basicPrice: calculatedLinePricing.basicPrice,
      gstPercent: calculatedLinePricing.gstPercent,
      gstAmt: calculatedLinePricing.gstAmt,
      nettPrice: calculatedLinePricing.nettPrice,
      toPercent: calculatedLinePricing.toPercent,
      salePrice: calculatedLinePricing.salePrice,
      qty: calculatedLinePricing.qty,
      amount: calculatedLinePricing.amount
    };

    if (editingItemIndex !== null && editingItemIndex >= 0) {
      const updated = [...billItems];
      updated[editingItemIndex] = newSaleItem;
      setBillItems(updated);
      setEditingItemIndex(null);
      showToast('Item updated in bill table', 'info');
    } else {
      setBillItems(prev => [...prev, newSaleItem]);
      showToast('Item added to bill table', 'success');
    }

    // Reset line inputs
    setSelectedItemId('');
    setBasicPrice('0');
    setGstPercent('18');
    setToPercent('0');
    setQty('1');
  };

  const handleEditLineItem = (index: number) => {
    const item = billItems[index];
    const foundItem = items.find(i => i.id === item.itemId);
    if (foundItem?.category) setSelectedCategory(foundItem.category);
    setSelectedItemId(item.itemId);
    setBasicPrice(String(item.basicPrice));
    setGstPercent(String(item.gstPercent));
    setToPercent(String(item.toPercent));
    setQty(String(item.qty));
    setEditingItemIndex(index);
  };

  const handleDeleteLineItem = (index: number) => {
    setBillItems(prev => prev.filter((_, i) => i !== index));
    if (editingItemIndex === index) {
      setEditingItemIndex(null);
      setSelectedItemId('');
    }
  };

  const handleNewEntry = () => {
    setEditingSaleId(null);
    setBillNo(StockEngine.getNextBillNumber('SALE'));
    setBillDate(getTodayDateString());
    if (parties.length > 0) setPartyId(parties[0].id);
    setBillItems([]);
    setRecdCash('0');
    setRecdUpi('0');
    setSelectedItemId('');
    setEditingItemIndex(null);
    showToast('New Sale form ready', 'info');
  };

  const handleSaveSale = () => {
    if (!partyId) {
      showToast('Please select a party / customer', 'error');
      return;
    }
    if (!billNo.trim()) {
      showToast('Bill No. is required', 'error');
      return;
    }
    if (billItems.length === 0) {
      showToast('Please add at least one item to the sale', 'error');
      return;
    }

    const party = parties.find(p => p.id === partyId);

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
      notes: `Cash: ₹${recdCash}, UPI: ₹${recdUpi}`,
      createdAt: new Date().toISOString()
    };

    // Save to Database: automatically registers SALE_OUT in universal Stock Ledger!
    db.saveSale(saleRecord);

    showToast(`Sale Invoice ${saleRecord.billNo} saved successfully! Stock updated.`, 'success');
    handleNewEntry();
  };

  const handleLoadSaleForEdit = (sale: Sale) => {
    setEditingSaleId(sale.id);
    setBillNo(sale.billNo);
    setBillDate(sale.billDate);
    setPartyId(sale.partyId);
    setBillItems(sale.items);
    setRecdCash(String(sale.recdCash));
    setRecdUpi(String(sale.recdUpi));
    showToast(`Loaded invoice ${sale.billNo} for editing`, 'info');
  };

  const handleDeleteCurrentSale = () => {
    if (!editingSaleId) {
      showToast('Please select a saved bill to delete', 'warning');
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
      showToast(`Sale Invoice deleted. Stock restored.`, 'info');
      handleNewEntry();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const currentSaleForPrint: Sale = {
    id: editingSaleId || 'temp',
    billNo,
    billDate,
    partyId,
    partyName: parties.find(p => p.id === partyId)?.name || 'Cash Customer',
    items: billItems,
    basicTotal: billSummary.basicTotal,
    gstTotal: billSummary.gstTotal,
    roundUp: billSummary.roundUp,
    billTotal: billSummary.billTotal,
    recdCash: Number(recdCash) || 0,
    recdUpi: Number(recdUpi) || 0,
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

  const selectedItemObj = useMemo(() => {
    return items.find(i => i.id === selectedItemId);
  }, [items, selectedItemId]);

  return (
    <div className="content-panel-grey">
      {/* Hidden Print Voucher */}
      <SalesPrintInvoice sale={currentSaleForPrint} />

      {/* Top Header Strip matching sales new.jpg */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div className="pill-header-lavender" style={{ fontSize: '1.25rem', padding: '8px 48px', minWidth: '180px', textAlign: 'center' }}>
          SALE ENTRY
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: '1.5px solid #6B7280',
              background: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            {showHistory ? 'Hide History' : `History (${salesHistory.length})`}
          </button>

          <button
            type="button"
            onClick={handleNewEntry}
            className="btn-customer-new-entry"
            style={{ fontSize: '0.95rem', padding: '8px 24px' }}
          >
            NEW ENTRY
          </button>
        </div>
      </div>

      {/* Main White Card matching sales new.jpg */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '2px solid #000000',
          borderRadius: '14px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          maxWidth: '960px',
          margin: '0 auto',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
        }}
      >
        {/* Top date and bill no */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 900, fontSize: '0.95rem' }}>BILL DATE</label>
            <input
              type="date"
              className="input-text-clean"
              value={billDate}
              onChange={e => setBillDate(e.target.value)}
              style={{ width: '145px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 900, fontSize: '0.95rem' }}>BILL NO.</label>
            <input
              type="text"
              className="input-text-clean"
              value={billNo}
              onChange={e => setBillNo(e.target.value)}
              style={{ width: '140px', fontWeight: 800 }}
            />
          </div>
        </div>

        {/* PARTY SELECTION ROW matching sales new.jpg */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 34px', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontWeight: 900, fontSize: '1.05rem' }}>Party :</label>
          <select
            className="input-text-clean"
            value={partyId}
            onChange={e => setPartyId(e.target.value)}
            style={{ fontSize: '0.95rem', height: '38px', fontWeight: 700 }}
          >
            <option value="">-- Select Party / Customer --</option>
            {parties.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} {p.phone ? `(${p.phone})` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-quick-n"
            title="Quick Add Party"
            onClick={() => openQuickModal('PARTY', (newId) => setPartyId(newId))}
          >
            N
          </button>
        </div>

        {/* CATG. ROW matching sales new.jpg */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 34px', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontWeight: 900, fontSize: '1.05rem' }}>CATG. :</label>
          <select
            className="input-text-clean"
            value={selectedCategory}
            onChange={e => {
              setSelectedCategory(e.target.value);
              setSelectedItemId('');
            }}
            style={{ fontSize: '0.95rem', height: '38px', fontWeight: 700 }}
          >
            <option value="">-- All Categories --</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn-quick-n"
            title="Quick Create Item/Category"
            onClick={() => openQuickModal('ITEM')}
          >
            N
          </button>
        </div>

        {/* ITEM SELECTION ROW matching sales new.jpg */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 34px', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontWeight: 900, fontSize: '1.05rem' }}>ITEM :</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="input-text-clean"
              value={selectedItemId}
              onChange={e => handleItemSelect(e.target.value, selectedUnitType)}
              style={{ flex: 1, fontSize: '0.95rem', height: '38px', fontWeight: 700 }}
            >
              <option value="">-- Select Item --</option>
              {filteredCategoryItems.map(i => (
                <option key={i.id} value={i.id}>
                  [{i.sno}] {i.name}
                </option>
              ))}
            </select>
            {selectedItemObj && selectedItemObj.unitB?.unitName && (
              <div style={{ display: 'flex', gap: '4px', background: '#F3F4F6', padding: '2px 6px', borderRadius: '6px', border: '1px solid #D1D5DB' }}>
                <button
                  type="button"
                  onClick={() => handleItemSelect(selectedItemId, 'unitA')}
                  style={{
                    background: selectedUnitType === 'unitA' ? '#D2BEF6' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  {selectedItemObj.unitA?.unitName || 'Unit A'}
                </button>
                <button
                  type="button"
                  onClick={() => handleItemSelect(selectedItemId, 'unitB')}
                  style={{
                    background: selectedUnitType === 'unitB' ? '#D2BEF6' : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    fontWeight: 800,
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  {selectedItemObj.unitB.unitName}
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn-quick-n"
            title="Quick Create Item"
            onClick={() => openQuickModal('ITEM', (newId) => handleItemSelect(newId))}
          >
            N
          </button>
        </div>

        {/* PRICING INPUT STRIP matching sales new.jpg */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 75px 1fr 1fr 75px 1.1fr 75px 1.1fr auto',
            gap: '6px',
            alignItems: 'flex-end',
            background: '#F9FAFB',
            padding: '12px 8px',
            borderRadius: '6px',
            border: '1px solid #000000'
          }}
        >
          {/* Basic Price */}
          <div>
            <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
              Besic Price
            </label>
            <input
              type="number"
              step="0.01"
              className="input-text-clean"
              value={basicPrice}
              onChange={e => setBasicPrice(e.target.value)}
              style={{ textAlign: 'center', padding: '4px', fontWeight: 700 }}
            />
          </div>

          {/* GST % */}
          <div>
            <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
              GST %
            </label>
            <input
              type="number"
              className="input-text-clean"
              value={gstPercent}
              onChange={e => setGstPercent(e.target.value)}
              style={{ textAlign: 'center', padding: '4px', fontWeight: 700 }}
            />
          </div>

          {/* GST Amt */}
          <div>
            <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
              GST Amt.
            </label>
            <input
              type="text"
              readOnly
              className="input-text-clean"
              value={calculatedLinePricing.gstAmt}
              style={{ textAlign: 'center', background: '#F3F4F6', padding: '4px', fontWeight: 700 }}
            />
          </div>

          {/* Nett Price */}
          <div>
            <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
              Nett Price
            </label>
            <input
              type="text"
              readOnly
              className="input-text-clean"
              value={calculatedLinePricing.nettPrice}
              style={{ textAlign: 'center', background: '#F3F4F6', padding: '4px', fontWeight: 700 }}
            />
          </div>

          {/* T&O % */}
          <div>
            <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
              T&O%
            </label>
            <input
              type="number"
              step="0.01"
              className="input-text-clean"
              value={toPercent}
              onChange={e => setToPercent(e.target.value)}
              style={{ textAlign: 'center', padding: '4px', fontWeight: 700 }}
            />
          </div>

          {/* Sale Price */}
          <div>
            <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
              Sale Price
            </label>
            <input
              type="text"
              readOnly
              className="input-text-clean"
              value={calculatedLinePricing.salePrice}
              style={{ textAlign: 'center', background: '#F3F4F6', padding: '4px', fontWeight: 800 }}
            />
          </div>

          {/* Qty */}
          <div>
            <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
              Qty
            </label>
            <input
              type="number"
              min="1"
              className="input-text-clean"
              value={qty}
              onChange={e => setQty(e.target.value)}
              style={{ textAlign: 'center', padding: '4px', fontWeight: 900, color: '#EA3943' }}
            />
          </div>

          {/* Amount */}
          <div>
            <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.72rem', textAlign: 'center', marginBottom: '2px' }}>
              Amount
            </label>
            <input
              type="text"
              readOnly
              className="input-text-clean"
              value={calculatedLinePricing.amount}
              style={{ textAlign: 'center', background: '#F3F4F6', padding: '4px', fontWeight: 800 }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '6px', paddingBottom: '4px' }}>
            <button
              type="button"
              onClick={handleAddOrUpdateLineItem}
              style={{
                color: '#EA3943',
                background: 'transparent',
                border: 'none',
                fontWeight: 900,
                fontSize: '0.9rem',
                cursor: 'pointer',
                padding: '2px 4px'
              }}
            >
              {editingItemIndex !== null ? 'Update' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (billItems.length > 0) handleEditLineItem(billItems.length - 1);
              }}
              style={{
                color: '#EA3943',
                background: 'transparent',
                border: 'none',
                fontWeight: 900,
                fontSize: '0.9rem',
                cursor: 'pointer',
                padding: '2px 4px'
              }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                if (billItems.length > 0) handleDeleteLineItem(billItems.length - 1);
              }}
              style={{
                color: '#EA3943',
                background: 'transparent',
                border: 'none',
                fontWeight: 900,
                fontSize: '0.9rem',
                cursor: 'pointer',
                padding: '2px 4px'
              }}
            >
              Del
            </button>
          </div>
        </div>

        {/* ITEMS TABLE matching sales new.jpg */}
        <div style={{ border: '2px solid #000000', borderRadius: '4px', overflow: 'hidden' }}>
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
              {billItems.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: '#9CA3AF', fontWeight: 600 }}>
                    No items in current bill. Add items using the pricing strip above.
                  </td>
                </tr>
              ) : (
                billItems.map((item, idx) => (
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
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: '#EA3943', borderRight: '1px solid #000000' }}>
                      {item.qty}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, borderRight: '1px solid #000000' }}>
                      {item.salePrice}
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
                  {billSummary.billTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* BOTTOM SECTION: SUMMARY & AUTHENTIC CUSTOMER BUTTONS */}
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
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#EA3943', fontWeight: 900, fontSize: '1.05rem' }}>BILL TOTAL</span>
              <input
                type="text"
                readOnly
                className="input-text-clean"
                value={billSummary.billTotal}
                style={{ textAlign: 'right', fontWeight: 900, fontSize: '1.15rem', background: '#FFFFFF', color: '#002B99' }}
              />
            </div>

            {/* RECD CASH */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#EA3943', fontWeight: 900, fontSize: '0.95rem' }}>RECD CASH</span>
              <input
                type="number"
                className="input-text-clean"
                value={recdCash}
                onChange={e => setRecdCash(e.target.value)}
                style={{ textAlign: 'right', fontWeight: 800 }}
              />
            </div>

            {/* RECD UPI */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#EA3943', fontWeight: 900, fontSize: '0.95rem' }}>RECD UPI</span>
              <input
                type="number"
                className="input-text-clean"
                value={recdUpi}
                onChange={e => setRecdUpi(e.target.value)}
                style={{ textAlign: 'right', fontWeight: 800 }}
              />
            </div>
          </div>

          {/* Customer Action Buttons matching sales new.jpg */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            {/* Top Center: Mint Green Save Button */}
            <button
              type="button"
              onClick={handleSaveSale}
              className="btn-customer-save"
            >
              Save
            </button>

            {/* Bottom Row: Lavender Action Pills */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-customer-action-pill"
                onClick={() => {
                  if (salesHistory.length > 0) {
                    setShowHistory(true);
                    showToast('Select an invoice from history to edit', 'info');
                  } else {
                    showToast('No saved invoices found', 'warning');
                  }
                }}
              >
                Edit
              </button>

              <button
                type="button"
                className="btn-customer-action-pill"
                onClick={handleDeleteCurrentSale}
              >
                Del
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
      </div>

      {/* Sales History Drawer */}
      {showHistory && (
        <div style={{ marginTop: '28px', background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '20px', maxWidth: '960px', margin: '28px auto 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h4 style={{ fontWeight: 900, fontSize: '1.05rem', margin: 0 }}>Sales Invoices History</h4>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={14} color="#6B7280" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                type="text"
                placeholder="Search invoice, customer..."
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
                  <th>Invoice Date</th>
                  <th>Bill No.</th>
                  <th>Party / Customer</th>
                  <th style={{ textAlign: 'center' }}>Total Items</th>
                  <th style={{ textAlign: 'right' }}>Bill Total</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map(s => (
                  <tr
                    key={s.id}
                    style={{
                      backgroundColor: editingSaleId === s.id ? '#F5F3FF' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleLoadSaleForEdit(s)}
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
                          handleLoadSaleForEdit(s);
                          setShowHistory(false);
                        }}
                        style={{
                          background: '#E2D2F8',
                          color: '#EA3943',
                          border: '1px solid #C4B5FD',
                          borderRadius: '12px',
                          padding: '2px 10px',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          cursor: 'pointer'
                        }}
                      >
                        Load
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
