import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Item, Supplier, Purchase, PurchaseItem } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { getTodayDateString } from '../../utils/dateUtils';
import { calculateItemPricing, calculateBillSummary } from '../../utils/calculations';
import { PurchasePrintVoucher } from './PurchasePrintVoucher';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Search } from 'lucide-react';

export const PurchaseEntryView: React.FC = () => {
  const { showToast, openQuickModal, refreshKey, selectedDate } = useApp();
  const { hasPermission } = useAuth();

  // Masters
  const suppliers = useMemo(() => db.getSuppliers().filter(s => s.isActive !== false), [refreshKey]);
  const items = useMemo(() => db.getItems().filter(i => i.isActive !== false), [refreshKey]);
  const purchasesHistory = useMemo(() => db.getPurchases(), [refreshKey]);

  // Header State
  const [billDate, setBillDate] = useState<string>(getTodayDateString());
  const [recdDate, setRecdDate] = useState<string>(getTodayDateString());
  const [billNo, setBillNo] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);

  // Line item strip
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  const [basicPrice, setBasicPrice] = useState<string>('0');
  const [gstPercent, setGstPercent] = useState<string>('18');
  const [qty, setQty] = useState<string>('1');

  // Items added
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState('');

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (!editingPurchaseId) {
      setBillNo(StockEngine.getNextBillNumber('PURCHASE'));
      setBillDate(selectedDate || getTodayDateString());
      setRecdDate(selectedDate || getTodayDateString());
      if (suppliers.length > 0 && !supplierId) {
        setSupplierId(suppliers[0].id);
      }
    }
  }, [editingPurchaseId, selectedDate, suppliers, refreshKey]);

  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    const found = items.find(i => i.id === itemId);
    if (found) {
      const price = found.unitA?.basicPrice ?? found.purchaseRate ?? 0;
      const gst = found.unitA?.gstPercent ?? found.gstPercent ?? 18;
      setBasicPrice(String(price));
      setGstPercent(String(gst));
      setQty('1');
    }
  };

  // Live computed pricing for the entry strip
  const calculatedLinePricing = useMemo(() => {
    return calculateItemPricing(
      Number(basicPrice),
      Number(gstPercent),
      0,
      Number(qty),
      0
    );
  }, [basicPrice, gstPercent, qty]);

  const billSummary = useMemo(() => {
    return calculateBillSummary(purchaseItems);
  }, [purchaseItems]);

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

    const newPurchaseItem: PurchaseItem = {
      id: `pur-item-${Date.now()}-${Math.random()}`,
      itemId: itemObj.id,
      sno: itemObj.sno,
      itemName: itemObj.name,
      basicPrice: calculatedLinePricing.basicPrice,
      gstPercent: calculatedLinePricing.gstPercent,
      gstAmt: calculatedLinePricing.gstAmt,
      nettPrice: calculatedLinePricing.nettPrice,
      toPercent: 0,
      roundup: 0,
      salePrice: calculatedLinePricing.nettPrice,
      qty: calculatedLinePricing.qty,
      amount: calculatedLinePricing.amount
    };

    if (editingItemIndex !== null && editingItemIndex >= 0) {
      const updated = [...purchaseItems];
      updated[editingItemIndex] = newPurchaseItem;
      setPurchaseItems(updated);
      setEditingItemIndex(null);
      showToast('Item updated in purchase table', 'info');
    } else {
      setPurchaseItems(prev => [...prev, newPurchaseItem]);
      showToast('Item added to purchase table', 'success');
    }

    setSelectedItemId('');
    setBasicPrice('0');
    setGstPercent('18');
    setQty('1');
  };

  const handleEditLineItem = (index: number) => {
    const item = purchaseItems[index];
    setSelectedItemId(item.itemId);
    setBasicPrice(String(item.basicPrice));
    setGstPercent(String(item.gstPercent));
    setQty(String(item.qty));
    setEditingItemIndex(index);
  };

  const handleDeleteLineItem = (index: number) => {
    setPurchaseItems(prev => prev.filter((_, i) => i !== index));
    if (editingItemIndex === index) {
      setEditingItemIndex(null);
      setSelectedItemId('');
    }
  };

  const handleNewEntry = () => {
    setEditingPurchaseId(null);
    setBillNo(StockEngine.getNextBillNumber('PURCHASE'));
    setBillDate(getTodayDateString());
    setRecdDate(getTodayDateString());
    if (suppliers.length > 0) setSupplierId(suppliers[0].id);
    setPurchaseItems([]);
    setSelectedItemId('');
    setEditingItemIndex(null);
    showToast('New Purchase entry ready', 'info');
  };

  const handleSavePurchase = () => {
    if (!supplierId) {
      showToast('Please select a supplier / party', 'error');
      return;
    }
    if (!billNo.trim()) {
      showToast('Bill No. is required', 'error');
      return;
    }
    if (purchaseItems.length === 0) {
      showToast('Please add at least one item to the purchase', 'error');
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
      createdAt: new Date().toISOString()
    };

    // Automatically increases Universal Stock Ledger via PURCHASE_IN!
    db.savePurchase(purchaseRecord);

    showToast(`Purchase bill ${purchaseRecord.billNo} saved! Stock increased.`, 'success');
    handleNewEntry();
  };

  const handleLoadPurchaseForEdit = (purchase: Purchase) => {
    setEditingPurchaseId(purchase.id);
    setBillNo(purchase.billNo);
    setBillDate(purchase.billDate);
    setRecdDate(purchase.recdDate || purchase.billDate);
    setSupplierId(purchase.supplierId);
    setPurchaseItems(purchase.items);
    showToast(`Loaded purchase bill ${purchase.billNo} for editing`, 'info');
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

  return (
    <div className="content-panel-grey">
      <PurchasePrintVoucher purchase={currentPurchaseForPrint} />

      {/* Top Header Strip matching new purchase.jpg */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div className="pill-header-lavender" style={{ fontSize: '1.25rem', padding: '8px 36px', minWidth: '220px', textAlign: 'center' }}>
          PURCHASE ENTRY
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
            {showHistory ? 'Hide Purchase History' : `History (${purchasesHistory.length})`}
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

      {/* Main White Form Container matching new purchase.jpg */}
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
        {/* Top Dates & Bill No Row */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 900, fontSize: '0.9rem' }}>BILL DATE</label>
            <input
              type="date"
              className="input-text-clean"
              value={billDate}
              onChange={e => setBillDate(e.target.value)}
              style={{ width: '140px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 900, fontSize: '0.9rem' }}>BILL NO.</label>
            <input
              type="text"
              className="input-text-clean"
              value={billNo}
              onChange={e => setBillNo(e.target.value)}
              style={{ width: '140px', fontWeight: 800 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 900, fontSize: '0.9rem' }}>RECD. DATE</label>
            <input
              type="date"
              className="input-text-clean"
              value={recdDate}
              onChange={e => setRecdDate(e.target.value)}
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
            onChange={e => setSupplierId(e.target.value)}
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
            onClick={() => openQuickModal('SUPPLIER', (newId) => setSupplierId(newId))}
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

        {/* PRICING INPUT STRIP matching new purchase.jpg */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 80px 1fr 1fr 80px 1fr auto',
            gap: '8px',
            alignItems: 'flex-end',
            background: '#F9FAFB',
            padding: '12px 10px',
            borderRadius: '6px',
            border: '1px solid #000000'
          }}
        >
          {/* Basic Price */}
          <div>
            <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.75rem', textAlign: 'center', marginBottom: '2px' }}>
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
            <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.75rem', textAlign: 'center', marginBottom: '2px' }}>
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
            <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.75rem', textAlign: 'center', marginBottom: '2px' }}>
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
            <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.75rem', textAlign: 'center', marginBottom: '2px' }}>
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

          {/* Qty */}
          <div>
            <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.75rem', textAlign: 'center', marginBottom: '2px' }}>
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
            <label style={{ display: 'block', color: '#EA3943', fontWeight: 800, fontSize: '0.75rem', textAlign: 'center', marginBottom: '2px' }}>
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
              style={{ color: '#EA3943', background: 'transparent', border: 'none', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', padding: '2px 4px' }}
            >
              {editingItemIndex !== null ? 'Update' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (purchaseItems.length > 0) handleEditLineItem(purchaseItems.length - 1);
              }}
              style={{ color: '#EA3943', background: 'transparent', border: 'none', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', padding: '2px 4px' }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                if (purchaseItems.length > 0) handleDeleteLineItem(purchaseItems.length - 1);
              }}
              style={{ color: '#EA3943', background: 'transparent', border: 'none', fontWeight: 900, fontSize: '0.9rem', cursor: 'pointer', padding: '2px 4px' }}
            >
              Del
            </button>
          </div>
        </div>

        {/* ITEMS TABLE matching new purchase.jpg */}
        <div style={{ border: '2px solid #000000', borderRadius: '4px', overflow: 'hidden' }}>
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

          {/* Customer Action Buttons matching new purchase.jpg */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            {/* Top Center: Mint Green Save Button */}
            <button
              type="button"
              onClick={handleSavePurchase}
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
                  if (purchasesHistory.length > 0) {
                    setShowHistory(true);
                    showToast('Select a purchase from history to edit', 'info');
                  } else {
                    showToast('No saved purchases found', 'warning');
                  }
                }}
              >
                Edit
              </button>

              <button
                type="button"
                className="btn-customer-action-pill"
                onClick={handleDeleteCurrentPurchase}
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

      {/* Purchase History Drawer */}
      {showHistory && (
        <div style={{ marginTop: '28px', background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '20px', maxWidth: '960px', margin: '28px auto 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h4 style={{ fontWeight: 900, fontSize: '1.05rem', margin: 0 }}>Purchase Inward Register</h4>
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
                {filteredPurchases.map(p => (
                  <tr
                    key={p.id}
                    style={{
                      backgroundColor: editingPurchaseId === p.id ? '#F5F3FF' : 'transparent',
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
        onConfirm={confirmDeletePurchase}
        title="Delete Purchase Voucher"
        message={`Are you sure you want to delete purchase voucher "${billNo}"? This will reverse the transaction and reduce stock.`}
      />
    </div>
  );
};
