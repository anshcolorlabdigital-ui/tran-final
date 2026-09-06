import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../db/db';
import { StockEngine } from '../../db/stockEngine';
import { useApp } from '../../context/AppContext';
import { Item, Sale, Purchase, SelfUse, StockMovement } from '../../types';
import { formatDateToDisplay, getTodayDateString } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/calculations';
import {
  Boxes,
  Search,
  Printer,
  Download,
  Calendar,
  Layers,
  X,
  Tag,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  Receipt,
  ShoppingCart,
  Building2,
  SlidersHorizontal,
  Info,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface ItemLedgerEntry {
  id: string;
  date: string;
  type: 'OPENING' | 'PURCHASE' | 'SALE' | 'SELF_USE' | 'ADJUSTMENT';
  refNo: string;
  counterparty: string; // Customer Name / Supplier Name / Purpose
  rate: number;
  inwardQty: number;
  outwardQty: number;
  qtyChange: number;
  runningBalance: number;
  totalAmount: number;
  notes?: string;
  saleDoc?: Sale;
  purchaseDoc?: Purchase;
  selfUseDoc?: SelfUse;
}

export const ItemLedgerReportView: React.FC = () => {
  const {
    refreshKey,
    selectedLedgerItemId,
    setSelectedLedgerItemId,
    showToast,
    showAlert,
    setActiveTab
  } = useApp();

  const items = useMemo(() => db.getItems().filter(i => i.isActive !== false), [refreshKey]);
  const sales = useMemo(() => db.getSales(), [refreshKey]);
  const purchases = useMemo(() => db.getPurchases(), [refreshKey]);
  const selfUses = useMemo(() => db.getSelfUses(), [refreshKey]);
  const stockMovements = useMemo(() => db.getStockMovements(), [refreshKey]);

  // Selected item state
  const [currentItemId, setCurrentItemId] = useState<string>(() => {
    if (selectedLedgerItemId && items.some(i => i.id === selectedLedgerItemId)) {
      return selectedLedgerItemId;
    }
    return items.length > 0 ? items[0].id : '';
  });

  // Sync when selectedLedgerItemId changes from context
  useEffect(() => {
    if (selectedLedgerItemId && items.some(i => i.id === selectedLedgerItemId)) {
      setCurrentItemId(selectedLedgerItemId);
    }
  }, [selectedLedgerItemId, items]);

  // Active item entity
  const activeItem = useMemo<Item | undefined>(() => {
    return items.find(i => i.id === currentItemId);
  }, [items, currentItemId]);

  // Date filters
  const [fromDate, setFromDate] = useState<string>('2026-08-01');
  const [toDate, setToDate] = useState<string>(getTodayDateString());
  const [isAllTime, setIsAllTime] = useState<boolean>(true);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INWARD' | 'OUTWARD' | 'SALE' | 'PURCHASE' | 'SELF_USE'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Detailed Document Popup States
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = useState<Purchase | null>(null);
  const [selectedSelfUseDetail, setSelectedSelfUseDetail] = useState<SelfUse | null>(null);

  // Build complete chronological ledger entries for the active item
  const rawLedgerEntries = useMemo<ItemLedgerEntry[]>(() => {
    if (!activeItem) return [];

    const entries: ItemLedgerEntry[] = [];
    const itemId = activeItem.id;

    // 1. Opening Stock Entry
    const openingMov = stockMovements.find(m => m.itemId === itemId && m.type === 'OPENING');
    const openingQty = openingMov ? Number(openingMov.qtyChange) : Number(activeItem.openingStock || 0);
    const itemBasicPrice = activeItem.unitA?.basicPrice ?? activeItem.purchaseRate ?? 0;

    if (openingQty > 0 || activeItem.openingStock > 0) {
      entries.push({
        id: `opening-${itemId}`,
        date: activeItem.createdAt ? activeItem.createdAt.split('T')[0] : '2026-08-01',
        type: 'OPENING',
        refNo: 'OPENING-STOCK',
        counterparty: 'Initial On-Hand Stock',
        rate: itemBasicPrice,
        inwardQty: openingQty,
        outwardQty: 0,
        qtyChange: openingQty,
        runningBalance: 0,
        totalAmount: Number((openingQty * itemBasicPrice).toFixed(2)),
        notes: 'Opening balance setup'
      });
    }

    // 2. Purchases (Inward)
    purchases.forEach(purchase => {
      const lineItems = purchase.items.filter(it => it.itemId === itemId || it.itemName === activeItem.name);
      lineItems.forEach((it, idx) => {
        const qty = Number(it.qty) || 0;
        const rate = it.nettPrice || it.basicPrice || 0;
        const amt = it.amount || (qty * rate);
        entries.push({
          id: `purch-${purchase.id}-${idx}`,
          date: purchase.billDate || purchase.recdDate || getTodayDateString(),
          type: 'PURCHASE',
          refNo: purchase.billNo,
          counterparty: purchase.supplierName || 'Supplier',
          rate: Number(rate.toFixed(2)),
          inwardQty: qty,
          outwardQty: 0,
          qtyChange: qty,
          runningBalance: 0,
          totalAmount: Number(amt.toFixed(2)),
          notes: purchase.notes || '',
          purchaseDoc: purchase
        });
      });
    });

    // 3. Sales (Outward)
    sales.forEach(sale => {
      const lineItems = sale.items.filter(it => it.itemId === itemId || it.itemName === activeItem.name);
      lineItems.forEach((it, idx) => {
        const qty = Number(it.qty) || 0;
        const rate = it.salePrice || it.mrp || it.nettPrice || 0;
        const amt = it.amount || (qty * rate);
        entries.push({
          id: `sale-${sale.id}-${idx}`,
          date: sale.billDate || getTodayDateString(),
          type: 'SALE',
          refNo: sale.billNo,
          counterparty: sale.partyName || 'Customer',
          rate: Number(rate.toFixed(2)),
          inwardQty: 0,
          outwardQty: qty,
          qtyChange: -qty,
          runningBalance: 0,
          totalAmount: Number(amt.toFixed(2)),
          notes: sale.notes || '',
          saleDoc: sale
        });
      });
    });

    // 4. Self-Use (Outward)
    selfUses.forEach(selfUse => {
      const lineItems = selfUse.items.filter(it => it.itemId === itemId || it.itemName === activeItem.name);
      lineItems.forEach((it, idx) => {
        const qty = Number(it.qty) || 0;
        const rate = it.rate || 0;
        const amt = it.amount || (qty * rate);
        entries.push({
          id: `selfuse-${selfUse.id}-${idx}`,
          date: selfUse.billDate || getTodayDateString(),
          type: 'SELF_USE',
          refNo: selfUse.billNo,
          counterparty: selfUse.category ? `Internal (${selfUse.category})` : 'Self-Use / Internal',
          rate: Number(rate.toFixed(2)),
          inwardQty: 0,
          outwardQty: qty,
          qtyChange: -qty,
          runningBalance: 0,
          totalAmount: Number(amt.toFixed(2)),
          notes: selfUse.remarks || selfUse.reason || '',
          selfUseDoc: selfUse
        });
      });
    });

    // 5. Stock Adjustments
    const adjustments = db.getStockAdjustments().filter(a => a.itemId === itemId);
    adjustments.forEach(adj => {
      const diff = Number(adj.difference) || 0;
      const isInward = adj.type === 'INCREASE' || diff > 0;
      const qty = Math.abs(diff);
      entries.push({
        id: `adj-${adj.id}`,
        date: adj.date || getTodayDateString(),
        type: 'ADJUSTMENT',
        refNo: adj.adjustmentNo,
        counterparty: `Adjustment (${adj.reason || 'Manual'})`,
        rate: itemBasicPrice,
        inwardQty: isInward ? qty : 0,
        outwardQty: !isInward ? qty : 0,
        qtyChange: isInward ? qty : -qty,
        runningBalance: 0,
        totalAmount: Number((qty * itemBasicPrice).toFixed(2)),
        notes: `Adjusted by ${adj.adjustedBy || 'Admin'}: ${adj.reason || ''}`
      });
    });

    // Sort chronologically ascending (oldest to newest)
    entries.sort((a, b) => {
      if (a.date === b.date) {
        if (a.type === 'OPENING') return -1;
        if (b.type === 'OPENING') return 1;
        return a.id.localeCompare(b.id);
      }
      return a.date.localeCompare(b.date);
    });

    // Calculate cumulative running stock balance
    let currentBal = 0;
    entries.forEach(e => {
      currentBal += e.qtyChange;
      e.runningBalance = Number(currentBal.toFixed(2));
    });

    return entries;
  }, [activeItem, stockMovements, purchases, sales, selfUses, refreshKey]);

  // Filtered ledger entries based on UI filters
  const filteredLedger = useMemo<ItemLedgerEntry[]>(() => {
    return rawLedgerEntries.filter(entry => {
      // Date filter
      if (!isAllTime) {
        if (fromDate && entry.date < fromDate) return false;
        if (toDate && entry.date > toDate) return false;
      }

      // Type filter
      if (typeFilter === 'INWARD' && entry.inwardQty <= 0) return false;
      if (typeFilter === 'OUTWARD' && entry.outwardQty <= 0) return false;
      if (typeFilter === 'SALE' && entry.type !== 'SALE') return false;
      if (typeFilter === 'PURCHASE' && entry.type !== 'PURCHASE') return false;
      if (typeFilter === 'SELF_USE' && entry.type !== 'SELF_USE') return false;

      // Text search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const refMatch = (entry.refNo || '').toLowerCase().includes(query);
        const partyMatch = (entry.counterparty || '').toLowerCase().includes(query);
        const notesMatch = (entry.notes || '').toLowerCase().includes(query);
        if (!refMatch && !partyMatch && !notesMatch) return false;
      }

      return true;
    });
  }, [rawLedgerEntries, fromDate, toDate, isAllTime, typeFilter, searchTerm]);

  // Summary Metrics for the Active Item
  const itemSummary = useMemo(() => {
    if (!activeItem) {
      return {
        currentStock: 0,
        openingStock: 0,
        totalPurchasedQty: 0,
        totalPurchasedValue: 0,
        totalSoldQty: 0,
        totalSoldValue: 0,
        totalSelfUseQty: 0,
        totalSelfUseValue: 0,
        isLowStock: false
      };
    }

    const currentStock = StockEngine.getItemCurrentStock(activeItem.id);
    let openingStock = 0;
    let totalPurchasedQty = 0;
    let totalPurchasedValue = 0;
    let totalSoldQty = 0;
    let totalSoldValue = 0;
    let totalSelfUseQty = 0;
    let totalSelfUseValue = 0;

    rawLedgerEntries.forEach(e => {
      if (e.type === 'OPENING') {
        openingStock += e.inwardQty;
      } else if (e.type === 'PURCHASE') {
        totalPurchasedQty += e.inwardQty;
        totalPurchasedValue += e.totalAmount;
      } else if (e.type === 'SALE') {
        totalSoldQty += e.outwardQty;
        totalSoldValue += e.totalAmount;
      } else if (e.type === 'SELF_USE') {
        totalSelfUseQty += e.outwardQty;
        totalSelfUseValue += e.totalAmount;
      }
    });

    const isLowStock = currentStock <= Number(activeItem.minStock || 0);

    return {
      currentStock,
      openingStock,
      totalPurchasedQty: Number(totalPurchasedQty.toFixed(2)),
      totalPurchasedValue: Number(totalPurchasedValue.toFixed(2)),
      totalSoldQty: Number(totalSoldQty.toFixed(2)),
      totalSoldValue: Number(totalSoldValue.toFixed(2)),
      totalSelfUseQty: Number(totalSelfUseQty.toFixed(2)),
      totalSelfUseValue: Number(totalSelfUseValue.toFixed(2)),
      isLowStock
    };
  }, [activeItem, rawLedgerEntries]);

  // Quick preset filters
  const setQuickFilter = (type: 'ALL' | 'TODAY' | 'MONTH' | 'YEAR') => {
    const today = getTodayDateString();
    if (type === 'ALL') {
      setIsAllTime(true);
    } else if (type === 'TODAY') {
      setIsAllTime(false);
      setFromDate(today);
      setToDate(today);
    } else if (type === 'MONTH') {
      setIsAllTime(false);
      const parts = today.split('-');
      setFromDate(`${parts[0]}-${parts[1]}-01`);
      setToDate(today);
    } else if (type === 'YEAR') {
      setIsAllTime(false);
      const parts = today.split('-');
      setFromDate(`${parts[0]}-04-01`); // Indian FY Apr 1
      setToDate(today);
    }
  };

  // Open Document Detail Modal on click
  const handleOpenDocDetail = (entry: ItemLedgerEntry) => {
    if (entry.type === 'SALE') {
      const foundSale = entry.saleDoc || sales.find(s => s.billNo === entry.refNo || s.id === entry.refNo);
      if (foundSale) setSelectedSaleDetail(foundSale);
      else showAlert(`Sale Invoice "${entry.refNo}" details not found.`, 'Invoice Detail', 'info');
    } else if (entry.type === 'PURCHASE') {
      const foundPurch = entry.purchaseDoc || purchases.find(p => p.billNo === entry.refNo || p.id === entry.refNo);
      if (foundPurch) setSelectedPurchaseDetail(foundPurch);
      else showAlert(`Purchase Bill "${entry.refNo}" details not found.`, 'Purchase Detail', 'info');
    } else if (entry.type === 'SELF_USE') {
      const foundSu = entry.selfUseDoc || selfUses.find(su => su.billNo === entry.refNo || su.id === entry.refNo);
      if (foundSu) setSelectedSelfUseDetail(foundSu);
      else showAlert(`Self-Use Entry "${entry.refNo}" details not found.`, 'Self-Use Detail', 'info');
    }
  };

  // Export ledger to Excel
  const handleExportExcel = () => {
    if (!activeItem) return;
    const exportRows = filteredLedger.map((entry, idx) => ({
      '#': idx + 1,
      'Date': formatDateToDisplay(entry.date),
      'Type': entry.type,
      'Voucher / Bill No': entry.refNo,
      'Party / Supplier / Purpose': entry.counterparty,
      'Rate (₹)': entry.rate,
      'Inward (Inflow +)': entry.inwardQty > 0 ? entry.inwardQty : 0,
      'Outward (Outflow -)': entry.outwardQty > 0 ? entry.outwardQty : 0,
      'Running Balance': entry.runningBalance,
      'Unit': activeItem.unit || 'Roll',
      'Total Amount (₹)': entry.totalAmount,
      'Remarks': entry.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Item Ledger');
    XLSX.writeFile(wb, `Item_Ledger_${activeItem.name.replace(/\s+/g, '_')}_${getTodayDateString()}.xlsx`);
    showToast('Item transaction ledger exported to Excel!', 'success');
  };

  // Print ledger
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="item-ledger-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* TOP HEADER & ITEM SWITCHER BAR */}
      <div
        className="glass-card"
        style={{
          background: '#FFFFFF',
          border: '2px solid #000000',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px'
        }}
      >
        {/* Title & Item Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '320px' }}>
          <div
            style={{
              background: '#D2BEF6',
              border: '2px solid #000000',
              borderRadius: '10px',
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Boxes size={28} color="#002B99" />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.35rem', color: '#002B99' }}>
                Item Stock & Transaction Ledger
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#475569' }}>
                Select Item:
              </span>
              <select
                value={currentItemId}
                onChange={e => {
                  setCurrentItemId(e.target.value);
                  setSelectedLedgerItemId(e.target.value);
                }}
                className="input-text-clean"
                style={{
                  fontWeight: 900,
                  fontSize: '0.98rem',
                  padding: '6px 12px',
                  background: '#F0FDF4',
                  border: '2px solid #000000',
                  borderRadius: '8px',
                  color: '#002B99',
                  minWidth: '280px',
                  maxWidth: '450px'
                }}
              >
                {items.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} {item.unit ? `(${item.unit})` : ''} {item.category ? `• ${item.category}` : ''}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setActiveTab('REPORT_ITEM_STOCK')}
                className="btn-classic"
                style={{
                  background: '#EFF6FF',
                  color: '#1D4ED8',
                  borderColor: '#93C5FD',
                  fontSize: '0.8rem',
                  padding: '4px 10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="View All Items Stock Table"
              >
                <Layers size={14} /> All Items Stock Report
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons: Excel & Print */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleExportExcel}
            className="btn-classic"
            style={{
              background: '#047857',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px'
            }}
          >
            <Download size={16} /> Excel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="btn-classic"
            style={{
              background: '#334155',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px'
            }}
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* ACTIVE ITEM DETAILS & PRICING BAR */}
      {activeItem && (
        <div
          className="glass-card"
          style={{
            background: '#F8FAFC',
            border: '2px solid #000000',
            borderRadius: '12px',
            padding: '12px 18px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#1E293B' }}>
              📦 {activeItem.name}
            </span>
            <span style={{ background: '#E2E8F0', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 800, color: '#334155' }}>
              Category: {activeItem.category || 'General'}
            </span>
            <span style={{ background: '#DBEAFE', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 800, color: '#1E40AF' }}>
              Unit: {activeItem.unit || 'Roll'}
            </span>
            {activeItem.minStock !== undefined && activeItem.minStock > 0 && (
              <span style={{ background: '#FEF3C7', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 800, color: '#92400E' }}>
                Min Stock: {activeItem.minStock} {activeItem.unit}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
            <span>Basic: <strong style={{ color: '#002B99' }}>₹{activeItem.unitA?.basicPrice ?? activeItem.purchaseRate ?? 0}</strong></span>
            <span>•</span>
            <span>GST: <strong>{activeItem.gstPercent || 0}%</strong></span>
            <span>•</span>
            <span>Sale Price (Dealer): <strong style={{ color: '#16A34A' }}>₹{activeItem.saleRate || activeItem.unitA?.salePrice || (activeItem.unitA?.basicPrice ?? activeItem.purchaseRate ?? 0)}</strong></span>
            <span>•</span>
            <span>MRP (Amateur): <strong style={{ color: '#9333EA' }}>₹{activeItem.mrp || activeItem.unitA?.mrp || (activeItem.unitA?.basicPrice ?? activeItem.purchaseRate ?? 0)}</strong></span>
          </div>
        </div>
      )}

      {/* KPI SUMMARY CARDS */}
      {activeItem && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {/* Card 1: Current Stock */}
          <div
            style={{
              background: itemSummary.isLowStock ? '#FEF2F2' : '#F0FDF4',
              border: '2px solid #000000',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: itemSummary.isLowStock ? '#991B1B' : '#166534', textTransform: 'uppercase' }}>
                Current Physical Stock
              </span>
              {itemSummary.isLowStock ? (
                <span style={{ background: '#FEE2E2', color: '#DC2626', fontSize: '0.68rem', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>
                  LOW STOCK
                </span>
              ) : (
                <span style={{ background: '#DCFCE7', color: '#15803D', fontSize: '0.68rem', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>
                  HEALTHY
                </span>
              )}
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: itemSummary.isLowStock ? '#DC2626' : '#16A34A', marginTop: '2px' }}>
              {itemSummary.currentStock} <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{activeItem.unit || 'Roll'}</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
              Opening: {itemSummary.openingStock} {activeItem.unit || 'Roll'}
            </div>
          </div>

          {/* Card 2: Total Purchased (Inflow) */}
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #000000',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
              Total Inflow (Purchased)
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#047857', marginTop: '2px' }}>
              +{itemSummary.totalPurchasedQty} <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{activeItem.unit || 'Roll'}</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#065F46', fontWeight: 700 }}>
              Purchase Value: ₹{itemSummary.totalPurchasedValue}
            </div>
          </div>

          {/* Card 3: Total Sold (Outflow) */}
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #000000',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase' }}>
              Total Outflow (Sold)
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1D4ED8', marginTop: '2px' }}>
              -{itemSummary.totalSoldQty} <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{activeItem.unit || 'Roll'}</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#1E3A8A', fontWeight: 700 }}>
              Sales Billed: ₹{itemSummary.totalSoldValue}
            </div>
          </div>

          {/* Card 4: Total Self-Used */}
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #000000',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6B21A8', textTransform: 'uppercase' }}>
              Self-Use / Internal
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#7E22CE', marginTop: '2px' }}>
              -{itemSummary.totalSelfUseQty} <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{activeItem.unit || 'Roll'}</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#581C87', fontWeight: 700 }}>
              Consumed Value: ₹{itemSummary.totalSelfUseValue}
            </div>
          </div>
        </div>
      )}

      {/* FILTER & SEARCH TOOLBAR */}
      <div
        className="glass-card"
        style={{
          background: '#FFFFFF',
          border: '2px solid #000000',
          borderRadius: '10px',
          padding: '12px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        {/* Left: Date Presets & Inputs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', background: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setQuickFilter('ALL')}
              style={{
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 800,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: isAllTime ? '#002B99' : 'transparent',
                color: isAllTime ? '#FFFFFF' : '#475569'
              }}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('TODAY')}
              style={{
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 800,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: !isAllTime && fromDate === getTodayDateString() && toDate === getTodayDateString() ? '#002B99' : 'transparent',
                color: !isAllTime && fromDate === getTodayDateString() && toDate === getTodayDateString() ? '#FFFFFF' : '#475569'
              }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('MONTH')}
              style={{
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 800,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: !isAllTime && fromDate.endsWith('-01') && toDate === getTodayDateString() ? '#002B99' : 'transparent',
                color: !isAllTime && fromDate.endsWith('-01') && toDate === getTodayDateString() ? '#FFFFFF' : '#475569'
              }}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('YEAR')}
              style={{
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 800,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: !isAllTime && fromDate.endsWith('-04-01') ? '#002B99' : 'transparent',
                color: !isAllTime && fromDate.endsWith('-04-01') ? '#FFFFFF' : '#475569'
              }}
            >
              This FY
            </button>
          </div>

          {/* Custom Date Pickers */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700 }}>
            <span>From:</span>
            <input
              type="date"
              className="input-text-clean"
              value={fromDate}
              onChange={e => {
                setFromDate(e.target.value);
                setIsAllTime(false);
              }}
              style={{ padding: '3px 8px', fontSize: '0.8rem', width: '130px' }}
            />
            <span>To:</span>
            <input
              type="date"
              className="input-text-clean"
              value={toDate}
              onChange={e => {
                setToDate(e.target.value);
                setIsAllTime(false);
              }}
              style={{ padding: '3px 8px', fontSize: '0.8rem', width: '130px' }}
            />
          </div>
        </div>

        {/* Right: Type Filter & Text Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as any)}
            className="input-text-clean"
            style={{ fontWeight: 800, fontSize: '0.82rem', padding: '4px 8px', height: '32px' }}
          >
            <option value="ALL">All Types</option>
            <option value="INWARD">Inward Only (+)</option>
            <option value="OUTWARD">Outward Only (-)</option>
            <option value="SALE">Sales (Invoices)</option>
            <option value="PURCHASE">Purchases (Stock In)</option>
            <option value="SELF_USE">Self-Use (Consumed)</option>
          </select>

          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              className="input-text-clean"
              placeholder="Search Bill / Party..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '28px', fontSize: '0.82rem', height: '32px' }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} color="#94A3B8" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CHRONOLOGICAL TRANSACTION LEDGER TABLE */}
      <div
        className="glass-card"
        style={{
          background: '#FFFFFF',
          border: '2px solid #000000',
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          style={{
            background: '#D2BEF6',
            padding: '10px 16px',
            borderBottom: '2px solid #000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 900, fontSize: '0.98rem', color: '#002B99' }}>
              Transaction History ({filteredLedger.length} Records)
            </span>
            <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700 }}>
              💡 Click any Voucher / Bill number to view complete line items & breakdown
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '550px' }}>
          <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#ECECEC', borderBottom: '2px solid #000000', fontSize: '0.82rem' }}>
                <th style={{ padding: '8px 10px', textAlign: 'center', width: '40px' }}>#</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', width: '95px' }}>Date</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', width: '130px' }}>Type</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', width: '130px' }}>Voucher / Bill No</th>
                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Party / Supplier / Purpose</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Rate (₹)</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', width: '95px' }}>Inward (+)</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', width: '95px' }}>Outward (-)</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', width: '110px' }}>Running Bal</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', width: '105px' }}>Amount (₹)</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', width: '140px' }}>Remarks</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', width: '75px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>
                    No stock movements or transactions found for {activeItem?.name || 'this item'} in the selected range.
                  </td>
                </tr>
              ) : (
                filteredLedger.map((entry, index) => {
                  const isSale = entry.type === 'SALE';
                  const isPurchase = entry.type === 'PURCHASE';
                  const isSelfUse = entry.type === 'SELF_USE';
                  const isOpening = entry.type === 'OPENING';
                  const hasDocModal = Boolean(entry.saleDoc || entry.purchaseDoc || entry.selfUseDoc);

                  return (
                    <tr
                      key={entry.id}
                      style={{
                        borderBottom: '1px solid #E2E8F0',
                        background: isSale ? '#EFF6FF' : isPurchase ? '#F0FDF4' : isSelfUse ? '#FAF5FF' : '#FFFFFF'
                      }}
                    >
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#64748B' }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, fontSize: '0.82rem' }}>
                        {formatDateToDisplay(entry.date)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'left' }}>
                        <span
                          style={{
                            background: isSale ? '#DBEAFE' : isPurchase ? '#DCFCE7' : isSelfUse ? '#F3E8FF' : '#FEF3C7',
                            color: isSale ? '#1E40AF' : isPurchase ? '#15803D' : isSelfUse ? '#6B21A8' : '#92400E',
                            fontSize: '0.75rem',
                            fontWeight: 900,
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}
                        >
                          {isSale ? '📄 SALE' : isPurchase ? '🛒 PURCHASE' : isSelfUse ? '🏢 SELF USE' : isOpening ? '📌 OPENING' : '⚖️ ADJUSTMENT'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'left' }}>
                        {hasDocModal ? (
                          <button
                            type="button"
                            onClick={() => handleOpenDocDetail(entry)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#002B99',
                              fontWeight: 900,
                              fontSize: '0.88rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              textDecoration: 'underline',
                              padding: 0
                            }}
                            title="Click to view complete itemized bill breakdown"
                          >
                            <span>{entry.refNo}</span>
                            <ExternalLink size={12} />
                          </button>
                        ) : (
                          <span style={{ fontWeight: 800, color: '#334155' }}>{entry.refNo}</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem' }}>
                        {entry.counterparty}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, fontSize: '0.85rem' }}>
                        {entry.rate > 0 ? `₹${entry.rate}` : '-'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: '#16A34A' }}>
                        {entry.inwardQty > 0 ? `+${entry.inwardQty}` : '-'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: '#DC2626' }}>
                        {entry.outwardQty > 0 ? `-${entry.outwardQty}` : '-'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: '#002B99' }}>
                        {entry.runningBalance} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>{activeItem?.unit || ''}</span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#1E293B' }}>
                        {entry.totalAmount > 0 ? `₹${entry.totalAmount}` : '-'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'left', fontSize: '0.8rem', color: '#64748B' }}>
                        {entry.notes || '-'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        {hasDocModal && (
                          <button
                            type="button"
                            onClick={() => handleOpenDocDetail(entry)}
                            className="btn-classic"
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              background: '#EFF6FF',
                              color: '#1D4ED8',
                              borderColor: '#93C5FD'
                            }}
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SALE INVOICE DETAIL MODAL */}
      {selectedSaleDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10005,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #000000',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '900px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 30px -5px rgba(0, 0, 0, 0.4)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                background: '#D2BEF6',
                padding: '16px 22px',
                borderBottom: '2px solid #000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Receipt size={24} color="#002B99" />
                <div>
                  <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.25rem', color: '#002B99' }}>
                    Sale Invoice Detail: {selectedSaleDetail.billNo}
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: '#4B5563', fontWeight: 700 }}>
                    Date: {formatDateToDisplay(selectedSaleDetail.billDate)} | Customer: {selectedSaleDetail.partyName}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSaleDetail(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>Basic Total</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#002B99' }}>₹{selectedSaleDetail.basicTotal}</div>
                </div>
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>GST Total</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#002B99' }}>₹{selectedSaleDetail.gstTotal}</div>
                </div>
                <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E40AF' }}>Bill Total</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1E40AF' }}>₹{selectedSaleDetail.billTotal}</div>
                </div>
                <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534' }}>Paid / Balance</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#16A34A' }}>
                    ₹{(selectedSaleDetail.recdCash || 0) + (selectedSaleDetail.recdUpi || 0)}
                    {selectedSaleDetail.balanceDue ? (
                      <span style={{ fontSize: '0.8rem', color: '#DC2626', marginLeft: '6px' }}>
                        (Due: ₹{selectedSaleDetail.balanceDue})
                      </span>
                    ) : ''}
                  </div>
                </div>
              </div>

              <div style={{ border: '1.5px solid #000000', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="table-clean" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #CBD5E1', fontSize: '0.82rem' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '40px' }}>#</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Item Name</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '85px' }}>Basic (₹)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '70px' }}>GST %</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '85px' }}>GST Amt</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '85px' }}>Nett (₹)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Rate (₹)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '70px' }}>Qty</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '100px' }}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSaleDetail.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', fontSize: '0.85rem' }}>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800 }}>
                          {item.itemName} {item.unit ? `(${item.unit})` : ''}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{item.basicPrice}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{item.gstPercent}%</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{item.gstAmt}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{item.nettPrice}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#002B99' }}>
                          ₹{item.salePrice || item.mrp}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900 }}>{item.qty}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: '#002B99' }}>
                          ₹{item.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PURCHASE BILL DETAIL MODAL */}
      {selectedPurchaseDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10005,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #000000',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '850px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 30px -5px rgba(0, 0, 0, 0.4)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                background: '#D2BEF6',
                padding: '16px 22px',
                borderBottom: '2px solid #000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShoppingCart size={24} color="#002B99" />
                <div>
                  <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.25rem', color: '#002B99' }}>
                    Purchase Bill Detail: {selectedPurchaseDetail.billNo}
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: '#4B5563', fontWeight: 700 }}>
                    Date: {formatDateToDisplay(selectedPurchaseDetail.billDate)} | Supplier: {selectedPurchaseDetail.supplierName}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPurchaseDetail(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>Basic Total</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#002B99' }}>₹{selectedPurchaseDetail.basicTotal}</div>
                </div>
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>GST Total</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#002B99' }}>₹{selectedPurchaseDetail.gstTotal}</div>
                </div>
                <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534' }}>Purchase Bill Total</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#16A34A' }}>₹{selectedPurchaseDetail.billTotal}</div>
                </div>
              </div>

              <div style={{ border: '1.5px solid #000000', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="table-clean" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #CBD5E1', fontSize: '0.82rem' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '40px' }}>#</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Item Name</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Basic (₹)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '70px' }}>GST %</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Nett (₹)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '70px' }}>Qty</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '100px' }}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPurchaseDetail.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', fontSize: '0.85rem' }}>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800 }}>
                          {item.itemName} {item.unit ? `(${item.unit})` : ''}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{item.basicPrice}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{item.gstPercent}%</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{item.nettPrice}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900 }}>{item.qty}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: '#002B99' }}>
                          ₹{item.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SELF USE DETAIL MODAL */}
      {selectedSelfUseDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10005,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #000000',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 30px -5px rgba(0, 0, 0, 0.4)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                background: '#D2BEF6',
                padding: '16px 22px',
                borderBottom: '2px solid #000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building2 size={24} color="#002B99" />
                <div>
                  <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.25rem', color: '#002B99' }}>
                    Self-Use Consumption Detail: {selectedSelfUseDetail.billNo}
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: '#4B5563', fontWeight: 700 }}>
                    Date: {formatDateToDisplay(selectedSelfUseDetail.billDate)} | Purpose: {selectedSelfUseDetail.category || 'Internal Use'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSelfUseDetail(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ border: '1.5px solid #000000', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="table-clean" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #CBD5E1', fontSize: '0.82rem' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '40px' }}>#</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Item Name</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Rate (₹)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: '70px' }}>Qty</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', width: '100px' }}>Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSelfUseDetail.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', fontSize: '0.85rem' }}>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800 }}>
                          {item.itemName} {item.unit ? `(${item.unit})` : ''}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{item.rate}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900 }}>{item.qty}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: '#002B99' }}>
                          ₹{item.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                  <strong>Remarks / Reason: </strong> {selectedSelfUseDetail.remarks || selectedSelfUseDetail.reason || 'None'}
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#002B99' }}>
                  Total Value: ₹{selectedSelfUseDetail.totalAmount}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
