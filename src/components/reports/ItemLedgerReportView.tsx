import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../db/db';
import { StockEngine } from '../../db/stockEngine';
import { useApp } from '../../context/AppContext';
import { Item, Sale, Purchase, SelfUse } from '../../types';
import { formatDateToDisplay, getTodayDateString } from '../../utils/dateUtils';
import { calculateItemUnitBreakdown, calculateUnitBFromUnitA, round2 } from '../../utils/calculations';
import {
  FileSpreadsheet,
  Printer,
  Search,
  X,
  ExternalLink,
  Receipt,
  ShoppingCart,
  Building2,
  ChevronUp
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ItemSearchSelect } from '../common/ItemSearchSelect';

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
    showAlert
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

  // View mode toggles
  const [showQty, setShowQty] = useState<boolean>(true);
  const [showAmount, setShowAmount] = useState<boolean>(false);

  // Search filter
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Detailed Document Popup States
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = useState<Purchase | null>(null);
  const [selectedSelfUseDetail, setSelectedSelfUseDetail] = useState<SelfUse | null>(null);

  // Unit A pricing breakdown
  const unitABreakdown = useMemo(() => {
    if (!activeItem) {
      return calculateItemUnitBreakdown({ basicPrice: 0 });
    }
    return calculateItemUnitBreakdown({
      basicPrice: activeItem.unitA?.basicPrice ?? activeItem.purchaseRate ?? 0,
      gstPercent: activeItem.unitA?.gstPercent ?? activeItem.gstPercent ?? 0,
      tranPercent: activeItem.unitA?.tranPercent ?? 0,
      misPercent: activeItem.unitA?.misPercent ?? 0,
      profPercentDeal: activeItem.unitA?.profPercentDeal ?? activeItem.profPercentDeal ?? 0,
      roundUpSale: activeItem.unitA?.roundUpSale ?? activeItem.roundUpSale ?? 0,
      profPercentAm: activeItem.unitA?.profPercentAm ?? activeItem.profPercentAm ?? 0,
      roundUpMrp: activeItem.unitA?.roundUpMrp ?? activeItem.roundUpMrp ?? 0,
    });
  }, [activeItem]);

  // Check whether Unit B is defined and active for the active item
  const hasUnitB = Boolean(
    activeItem?.hasSecondaryUnit &&
    activeItem?.unitB &&
    activeItem?.unitB?.unitName &&
    activeItem?.unitB?.isActive !== false
  );

  // Unit B pricing breakdown
  const unitBBreakdown = useMemo(() => {
    if (!hasUnitB || !activeItem?.unitB) {
      return calculateItemUnitBreakdown({ basicPrice: 0 });
    }
    const b = activeItem.unitB;
    const conv = Number(b.conversionFactor) > 0 ? Number(b.conversionFactor) : 1;
    const baseB = b.basicPrice !== undefined && b.basicPrice !== null && Number(b.basicPrice) > 0
      ? Number(b.basicPrice)
      : Number(((activeItem.unitA?.basicPrice ?? activeItem.purchaseRate ?? 0) / conv).toFixed(2));

    return calculateItemUnitBreakdown({
      basicPrice: baseB,
      gstPercent: b.gstPercent ?? activeItem.unitA?.gstPercent ?? activeItem.gstPercent ?? 0,
      tranPercent: b.tranPercent ?? activeItem.unitA?.tranPercent ?? 0,
      misPercent: b.misPercent ?? activeItem.unitA?.misPercent ?? 0,
      profPercentDeal: b.profPercentDeal ?? b.profPercent ?? activeItem.unitA?.profPercentDeal ?? 0,
      roundUpSale: b.roundUpSale ?? b.roundUp ?? 0,
      profPercentAm: b.profPercentAm ?? activeItem.unitA?.profPercentAm ?? 0,
      roundUpMrp: b.roundUpMrp ?? 0,
    });
  }, [hasUnitB, activeItem]);

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

  // Filtered ledger entries based on search (excludes OPENING row since Opening Stock is shown at top)
  const filteredLedger = useMemo<ItemLedgerEntry[]>(() => {
    return rawLedgerEntries.filter(entry => {
      if (entry.type === 'OPENING') return false;
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const refMatch = (entry.refNo || '').toLowerCase().includes(query);
        const partyMatch = (entry.counterparty || '').toLowerCase().includes(query);
        const notesMatch = (entry.notes || '').toLowerCase().includes(query);
        if (!refMatch && !partyMatch && !notesMatch) return false;
      }
      return true;
    });
  }, [rawLedgerEntries, searchTerm]);

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
        totalSelfUseValue: 0
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

    return {
      currentStock: round2(currentStock),
      openingStock: round2(openingStock),
      totalPurchasedQty: round2(totalPurchasedQty),
      totalPurchasedValue: round2(totalPurchasedValue),
      totalSoldQty: round2(totalSoldQty),
      totalSoldValue: round2(totalSoldValue),
      totalSelfUseQty: round2(totalSelfUseQty),
      totalSelfUseValue: round2(totalSelfUseValue)
    };
  }, [activeItem, rawLedgerEntries]);

  // Complete metrics for 6 cards: OPP, PURCHASES, SALES, PROFIT & %, SELF USE, STOCK VALUE
  const activeItemMetrics = useMemo(() => {
    if (!activeItem) {
      return {
        oppValue: 0,
        purchasesValue: 0,
        salesValue: 0,
        salesProfit: 0,
        profitPct: 0,
        selfUseValue: 0,
        stockValue: 0,
        totalPurcQty: 0,
        totalSaleQty: 0,
        totalUseQty: 0,
        closingStock: 0
      };
    }

    const baseRate = Number(activeItem.unitA?.basicPrice ?? activeItem.purchaseRate ?? 0);
    const gstPct = Number(activeItem.unitA?.gstPercent ?? activeItem.gstPercent ?? 0);
    const tranPct = Number(activeItem.unitA?.tranPercent ?? 0);
    const misPct = Number(activeItem.unitA?.misPercent ?? 0);
    const gstAmt = Number((baseRate * (gstPct / 100)).toFixed(2));
    const tranAmt = Number((baseRate * (tranPct / 100)).toFixed(2));
    const misAmt = Number((baseRate * (misPct / 100)).toFixed(2));
    const landedCostRate = Number(
      activeItem.unitA?.nettPrice && activeItem.unitA.nettPrice > 0
        ? activeItem.unitA.nettPrice
        : (baseRate + gstAmt + tranAmt + misAmt).toFixed(2)
    );

    const oppValue = Number((itemSummary.openingStock * baseRate).toFixed(2));
    const purchasesValue = Number(itemSummary.totalPurchasedValue.toFixed(2));
    const salesValue = Number(itemSummary.totalSoldValue.toFixed(2));
    const saleCost = Number((itemSummary.totalSoldQty * landedCostRate).toFixed(2));
    const salesProfit = Number((salesValue - saleCost).toFixed(2));
    const profitPct = saleCost > 0 ? Number(((salesProfit / saleCost) * 100).toFixed(1)) : 0;
    const selfUseValue = Number(itemSummary.totalSelfUseValue.toFixed(2));
    const stockValue = Number((Math.max(0, itemSummary.currentStock) * baseRate).toFixed(2));

    return {
      oppValue,
      purchasesValue,
      salesValue,
      salesProfit,
      profitPct,
      selfUseValue,
      stockValue,
      totalPurcQty: itemSummary.totalPurchasedQty,
      totalSaleQty: itemSummary.totalSoldQty,
      totalUseQty: itemSummary.totalSelfUseQty,
      closingStock: itemSummary.currentStock
    };
  }, [activeItem, itemSummary]);

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

  // Export ledger to Excel matching layout
  const handleExportExcel = () => {
    if (!activeItem) return;
    const baseRate = Number(activeItem.unitA?.basicPrice ?? activeItem.purchaseRate ?? 0);
    const exportRows = filteredLedger.map((entry, idx) => ({
      '#': idx + 1,
      'Date': formatDateToDisplay(entry.date),
      'Bill No': entry.refNo,
      'Supplier / Party': entry.counterparty,
      'Unit': activeItem.unitA?.unitName || activeItem.unit || 'PCS',
      'B. Price': round2(entry.rate || baseRate || 0),
      'Purc.': entry.inwardQty > 0 ? round2(entry.inwardQty) : 0,
      'Sale': entry.type === 'SALE' && entry.outwardQty > 0 ? round2(entry.outwardQty) : 0,
      'Use': entry.type === 'SELF_USE' && entry.outwardQty > 0 ? round2(entry.outwardQty) : 0,
      'Stock': round2(entry.runningBalance)
    }));

    exportRows.push({
      '#': '' as any,
      'Date': '',
      'Bill No': '',
      'Supplier / Party': 'TOTAL',
      'Unit': '',
      'B. Price': '' as any,
      'Purc.': activeItemMetrics.totalPurcQty,
      'Sale': activeItemMetrics.totalSaleQty,
      'Use': activeItemMetrics.totalUseQty,
      'Stock': activeItemMetrics.closingStock
    });

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
    <div className="item-ledger-view" style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1.5px solid #000000', position: 'relative' }}>
      
      {/* 1. TOP HEADER BAR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div
          style={{
            background: '#BFF573',
            border: '1.5px solid #000000',
            borderRadius: '9999px',
            padding: '6px 28px',
            fontWeight: 900,
            fontSize: '1.05rem',
            letterSpacing: '0.04em',
            color: '#000000',
            display: 'inline-flex',
            alignItems: 'center'
          }}
        >
          ITEM LEADGER
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleExportExcel}
            className="btn-classic"
            style={{
              background: '#059669',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1.5px solid #047857',
              cursor: 'pointer'
            }}
          >
            <FileSpreadsheet size={16} /> Export Excel (.xlsx)
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="btn-classic"
            style={{
              background: '#EF4444',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1.5px solid #DC2626',
              cursor: 'pointer'
            }}
          >
            <Printer size={16} /> PRINT REPORT
          </button>
        </div>
      </div>

      {/* 2. ITEM SELECTOR ROW */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 900, fontSize: '0.9rem', color: '#000000', minWidth: '95px' }}>
          ITEM NAME
        </span>
        <div style={{ minWidth: '320px', maxWidth: '520px', flex: 1 }}>
          <ItemSearchSelect
            items={items}
            selectedItemId={currentItemId}
            onSelect={(id) => {
              if (id) {
                setCurrentItemId(id);
                setSelectedLedgerItemId(id);
              }
            }}
            placeholder="Type item name or code to search..."
          />
        </div>

        {/* Quick Search */}
        <div style={{ position: 'relative', width: '220px', marginLeft: 'auto' }}>
          <Search size={15} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            className="input-text-clean"
            placeholder="Search bill or party..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '28px', fontSize: '0.82rem', height: '32px', width: '100%', borderRadius: '6px', border: '1.5px solid #CBD5E1' }}
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

      {/* 3. ITEM PRICING BREAKDOWN (UNIT-A & UNIT-B) */}
      <div style={{ background: '#FFFFFF', border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* UNIT-A SECTION */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontWeight: 900, fontSize: '0.88rem', color: '#000000' }}>UNIT-A :</span>
              <span
                style={{
                  border: '1.5px solid #F43F5E',
                  color: '#E11D48',
                  background: '#FFF1F2',
                  padding: '2px 14px',
                  borderRadius: '4px',
                  fontWeight: 900,
                  fontSize: '0.85rem'
                }}
              >
                {activeItem?.unitA?.unitName || activeItem?.unit || 'PIC'}
              </span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 800, cursor: 'default' }}>
                <input type="checkbox" checked={activeItem?.unitA?.isActive !== false} readOnly style={{ accentColor: '#2563EB', width: '16px', height: '16px' }} />
                Active
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#000000' }}>Min Stock :</span>
              <span
                style={{
                  border: '1.5px solid #000000',
                  padding: '3px 18px',
                  borderRadius: '4px',
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  background: '#FFFFFF',
                  minWidth: '60px',
                  textAlign: 'center'
                }}
              >
                {activeItem?.minStock ?? 0}
              </span>
            </div>
          </div>

          {/* Unit A 10-column pricing table */}
          <div className="pricing-calc-scroll-wrapper">
            <div className="pricing-calc-grid-10" style={{ gap: '6px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Besic Price</label>
                <div style={{ border: '1.5px solid #000000', borderRadius: '4px', padding: '4px', fontWeight: 800, fontSize: '0.88rem', background: '#FFFFFF', textAlign: 'center' }}>
                  {unitABreakdown.basicPrice}
                </div>
                <div className="subtext-calc-red">{unitABreakdown.basicPrice}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>GST %</label>
                <div style={{ border: '1.5px solid #000000', borderRadius: '4px', padding: '4px', fontWeight: 800, fontSize: '0.88rem', background: '#FFFFFF', textAlign: 'center' }}>
                  {unitABreakdown.gstPercent}
                </div>
                <div className="subtext-calc-red">{unitABreakdown.gstAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>tran%</label>
                <div style={{ border: '1.5px solid #000000', borderRadius: '4px', padding: '4px', fontWeight: 800, fontSize: '0.88rem', background: '#FFFFFF', textAlign: 'center' }}>
                  {unitABreakdown.tranPercent}
                </div>
                <div className="subtext-calc-red">{unitABreakdown.tranAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>mis%</label>
                <div style={{ border: '1.5px solid #000000', borderRadius: '4px', padding: '4px', fontWeight: 800, fontSize: '0.88rem', background: '#FFFFFF', textAlign: 'center' }}>
                  {unitABreakdown.misPercent}
                </div>
                <div className="subtext-calc-red">{unitABreakdown.misAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#6D28D9' }}>Prof% -S</label>
                <div style={{ border: '1.5px solid #8B5CF6', borderRadius: '4px', padding: '4px', fontWeight: 800, fontSize: '0.88rem', background: '#FFFFFF', textAlign: 'center' }}>
                  {unitABreakdown.profPercentDeal}
                </div>
                <div className="subtext-calc-red">{unitABreakdown.profDealAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#6D28D9' }}>Round-S</label>
                <div style={{ border: '1.5px solid #8B5CF6', borderRadius: '4px', padding: '4px', fontWeight: 800, fontSize: '0.88rem', background: '#FFFFFF', textAlign: 'center' }}>
                  {unitABreakdown.roundUpSale}
                </div>
                <div className="subtext-calc-red">{unitABreakdown.roundUpSale}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#2563EB' }}>Sale Price</label>
                <div style={{ border: '2px solid #2563EB', borderRadius: '4px', padding: '4px', fontWeight: 900, fontSize: '0.92rem', background: '#EFF6FF', color: '#1D4ED8', textAlign: 'center' }}>
                  {unitABreakdown.salePrice}
                </div>
                <div className="subtext-calc-red">{unitABreakdown.salePrice}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#1E40AF' }}>Prof% -M</label>
                <div style={{ border: '1.5px solid #3B82F6', borderRadius: '4px', padding: '4px', fontWeight: 800, fontSize: '0.88rem', background: '#FFFFFF', textAlign: 'center' }}>
                  {unitABreakdown.profPercentAm}
                </div>
                <div className="subtext-calc-red">{unitABreakdown.profAmAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#1E40AF' }}>Round-M</label>
                <div style={{ border: '1.5px solid #3B82F6', borderRadius: '4px', padding: '4px', fontWeight: 800, fontSize: '0.88rem', background: '#FFFFFF', textAlign: 'center' }}>
                  {unitABreakdown.roundUpMrp}
                </div>
                <div className="subtext-calc-red">{unitABreakdown.roundUpMrp}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#2563EB' }}>mrp</label>
                <div style={{ border: '2px solid #2563EB', borderRadius: '4px', padding: '4px', fontWeight: 900, fontSize: '0.92rem', background: '#EFF6FF', color: '#1D4ED8', textAlign: 'center' }}>
                  {unitABreakdown.mrp}
                </div>
                <div className="subtext-calc-red">{unitABreakdown.mrp}</div>
              </div>
            </div>
          </div>
        </div>

        {/* UNIT-B SECTION */}
        {hasUnitB && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px', borderTop: '1px dashed #CBD5E1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontWeight: 900, fontSize: '0.88rem', color: '#000000' }}>UNIT-B :</span>
                <span
                  style={{
                    border: '1.5px solid #F43F5E',
                    color: '#E11D48',
                    background: '#FFF1F2',
                    padding: '2px 14px',
                    borderRadius: '4px',
                    fontWeight: 900,
                    fontSize: '0.85rem'
                  }}
                >
                  {activeItem?.unitB?.unitName || 'Mt'}
                </span>
                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#000000' }}>
                  1 {activeItem?.unitA?.unitName || activeItem?.unit || 'PIC'} ={' '}
                  <span style={{ border: '1.5px solid #059669', padding: '2px 10px', borderRadius: '4px', fontWeight: 900, color: '#059669', background: '#ECFDF5' }}>
                    {activeItem?.unitB?.conversionFactor || 50}
                  </span>{' '}
                  {activeItem?.unitB?.unitName || 'Mt'}
                </span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 800, cursor: 'default' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(activeItem?.unitB?.isActive !== false)}
                    readOnly
                    style={{ accentColor: '#2563EB', width: '16px', height: '16px' }}
                  />
                  Active Unit B
                </label>
              </div>
            </div>

            {/* Unit B 10-column pricing table */}
            <div className="pricing-calc-scroll-wrapper">
              <div className="pricing-calc-grid-10" style={{ gap: '6px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Besic Price</label>
                  <div style={{ border: '1.5px solid #000000', borderRadius: '4px', padding: '4px', fontWeight: 800, fontSize: '0.88rem', background: '#FFFFFF', textAlign: 'center' }}>
                    {unitBBreakdown.basicPrice}
                  </div>
                  <div className="subtext-calc-red">{unitBBreakdown.basicPrice}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>GST %</label>
                  <div style={{ border: '1.5px solid #000000', borderRadius: '4px', padding: '4px', fontWeight: 800, fontSize: '0.88rem', background: '#FFFFFF', textAlign: 'center' }}>
                    {unitBBreakdown.gstPercent}
                  </div>
                  <div className="subtext-calc-red">{unitBBreakdown.gstAmt}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>tran%</label>
                  <div style={{ border: '1.5px solid #000000', borderRadius: '4px', padding: '4px', fontWeight: 800, fontSize: '0.88rem', background: '#FFFFFF', textAlign: 'center' }}>
                    {unitBBreakdown.tranPercent}
                  </div>
                  <div className="subtext-calc-red">{unitBBreakdown.tranAmt}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>mis%</label>
                  <div style={{ border: '1.5px solid #000000', borderRadius: '4px', padding: '4px', fontWeight: 800, fontSize: '0.88rem', background: '#FFFFFF', textAlign: 'center' }}>
                    {unitBBreakdown.misPercent}
                  </div>
                  <div className="subtext-calc-red">{unitBBreakdown.misAmt}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#6D28D9' }}>Prof% -S</label>
                  <div style={{ border: '1.5px solid #8B5CF6', borderRadius: '4px', padding: '4px', fontWeight: 800, fontSize: '0.88rem', background: '#FFFFFF', textAlign: 'center' }}>
                    {unitBBreakdown.profPercentDeal}
                  </div>
                  <div className="subtext-calc-red">{unitBBreakdown.profDealAmt}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#6D28D9' }}>Round-S</label>
                  <div style={{ border: '1.5px solid #8B5CF6', borderRadius: '4px', padding: '4px', fontWeight: 800, fontSize: '0.88rem', background: '#FFFFFF', textAlign: 'center' }}>
                    {unitBBreakdown.roundUpSale}
                  </div>
                  <div className="subtext-calc-red">{unitBBreakdown.roundUpSale}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#2563EB' }}>Sale Price</label>
                  <div style={{ border: '2px solid #2563EB', borderRadius: '4px', padding: '4px', fontWeight: 900, fontSize: '0.92rem', background: '#EFF6FF', color: '#1D4ED8', textAlign: 'center' }}>
                    {unitBBreakdown.salePrice}
                  </div>
                  <div className="subtext-calc-red">{unitBBreakdown.salePrice}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#1E40AF' }}>Prof% -M</label>
                  <div style={{ border: '1.5px solid #3B82F6', borderRadius: '4px', padding: '4px', fontWeight: 800, fontSize: '0.88rem', background: '#FFFFFF', textAlign: 'center' }}>
                    {unitBBreakdown.profPercentAm}
                  </div>
                  <div className="subtext-calc-red">{unitBBreakdown.profAmAmt}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#1E40AF' }}>Round-M</label>
                  <div style={{ border: '1.5px solid #3B82F6', borderRadius: '4px', padding: '4px', fontWeight: 800, fontSize: '0.88rem', background: '#FFFFFF', textAlign: 'center' }}>
                    {unitBBreakdown.roundUpMrp}
                  </div>
                  <div className="subtext-calc-red">{unitBBreakdown.roundUpMrp}</div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', marginBottom: '2px', color: '#2563EB' }}>mrp</label>
                  <div style={{ border: '2px solid #2563EB', borderRadius: '4px', padding: '4px', fontWeight: 900, fontSize: '0.92rem', background: '#EFF6FF', color: '#1D4ED8', textAlign: 'center' }}>
                    {unitBBreakdown.mrp}
                  </div>
                  <div className="subtext-calc-red">{unitBBreakdown.mrp}</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 4. 6 SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
        {/* Card 1: OPP. VALUE */}
        <div style={{ background: '#FFFFFF', border: '1.5px solid #94A3B8', borderRadius: '6px', padding: '8px 6px', textAlign: 'center' }}>
          <div style={{ color: '#DC2626', fontWeight: 900, fontSize: '0.76rem', letterSpacing: '0.03em' }}>
            OPP. VALUE
          </div>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#000000', marginTop: '4px' }}>
            ₹{activeItemMetrics.oppValue}
          </div>
        </div>

        {/* Card 2: PURCHASES VALUE */}
        <div style={{ background: '#FFFFFF', border: '1.5px solid #94A3B8', borderRadius: '6px', padding: '8px 6px', textAlign: 'center' }}>
          <div style={{ color: '#DC2626', fontWeight: 900, fontSize: '0.76rem', letterSpacing: '0.03em' }}>
            PURCHASES VALUE
          </div>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#000000', marginTop: '4px' }}>
            ₹{activeItemMetrics.purchasesValue}
          </div>
        </div>

        {/* Card 3: SALES VALUE */}
        <div style={{ background: '#FFFFFF', border: '1.5px solid #94A3B8', borderRadius: '6px', padding: '8px 6px', textAlign: 'center' }}>
          <div style={{ color: '#DC2626', fontWeight: 900, fontSize: '0.76rem', letterSpacing: '0.03em' }}>
            SALES VALUE
          </div>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#000000', marginTop: '4px' }}>
            ₹{activeItemMetrics.salesValue}
          </div>
        </div>

        {/* Card 4: SALES PROFIT VLAUE & % */}
        <div style={{ background: '#FFFFFF', border: '1.5px solid #10B981', borderRadius: '6px', padding: '8px 6px', textAlign: 'center' }}>
          <div style={{ color: '#DC2626', fontWeight: 900, fontSize: '0.76rem', letterSpacing: '0.03em' }}>
            SALES PROFIT VLAUE & %
          </div>
          <div style={{ fontWeight: 900, fontSize: '1.05rem', color: activeItemMetrics.salesProfit >= 0 ? '#15803D' : '#DC2626', marginTop: '4px' }}>
            ₹{activeItemMetrics.salesProfit} <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>({activeItemMetrics.profitPct}%)</span>
          </div>
        </div>

        {/* Card 5: SELF USE */}
        <div style={{ background: '#FFFFFF', border: '1.5px solid #94A3B8', borderRadius: '6px', padding: '8px 6px', textAlign: 'center' }}>
          <div style={{ color: '#DC2626', fontWeight: 900, fontSize: '0.76rem', letterSpacing: '0.03em' }}>
            SELF USE
          </div>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#000000', marginTop: '4px' }}>
            ₹{activeItemMetrics.selfUseValue}
          </div>
        </div>

        {/* Card 6: STOCK VALUE */}
        <div style={{ background: '#FFFFFF', border: '1.5px solid #10B981', borderRadius: '6px', padding: '8px 6px', textAlign: 'center' }}>
          <div style={{ color: '#DC2626', fontWeight: 900, fontSize: '0.76rem', letterSpacing: '0.03em' }}>
            STOCK VALUE
          </div>
          <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#000000', marginTop: '4px' }}>
            ₹{activeItemMetrics.stockValue}
          </div>
        </div>
      </div>

      {/* 5. CHECKBOX & OPENING STOCK ROW */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showQty}
              onChange={e => setShowQty(e.target.checked)}
              style={{ accentColor: '#2563EB', width: '16px', height: '16px', cursor: 'pointer' }}
            />
            Show Qty
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showAmount}
              onChange={e => setShowAmount(e.target.checked)}
              style={{ accentColor: '#2563EB', width: '16px', height: '16px', cursor: 'pointer' }}
            />
            Show Amount
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: 900, fontSize: '0.88rem', color: '#000000' }}>OPP.</span>
          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#374151' }}>Opening Stock</span>
          <span
            style={{
              border: '1.5px solid #000000',
              padding: '3px 18px',
              borderRadius: '4px',
              fontWeight: 900,
              fontSize: '0.88rem',
              background: '#FFFFFF',
              minWidth: '60px',
              textAlign: 'center'
            }}
          >
            {itemSummary.openingStock}
          </span>
        </div>
      </div>

      {/* 6. CHRONOLOGICAL TRANSACTION LEDGER TABLE */}
      <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', overflow: 'hidden' }}>
        <div className="table-responsive-wrapper" style={{ maxHeight: '600px' }}>
          <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#D4C4FB', borderBottom: '1.5px solid #000000' }}>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900, fontSize: '0.82rem', color: '#000000', borderRight: '1.5px solid #000000', width: '100px' }}>DATE</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 900, fontSize: '0.82rem', color: '#000000', borderRight: '1.5px solid #000000', width: '120px' }}>BILL NO.</th>
                <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 900, fontSize: '0.82rem', color: '#000000', borderRight: '1.5px solid #000000' }}>SUPPLIER</th>
                <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900, fontSize: '0.82rem', color: '#000000', borderRight: '1.5px solid #000000', width: '65px' }}>UNIT</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, fontSize: '0.82rem', color: '#000000', borderRight: '1.5px solid #000000', width: '90px' }}>B. PRICE</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, fontSize: '0.82rem', color: '#000000', borderRight: '1.5px solid #000000', width: '85px' }}>PURC.</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, fontSize: '0.82rem', color: '#000000', borderRight: '1.5px solid #000000', width: '85px' }}>SALE</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, fontSize: '0.82rem', color: '#000000', borderRight: '1.5px solid #000000', width: '85px' }}>USE</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, fontSize: '0.82rem', color: '#000000', width: '90px' }}>STOCK</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>
                    No transactions recorded for {activeItem?.name || 'this item'}.
                  </td>
                </tr>
              ) : (
                filteredLedger.map(entry => {
                  const isSale = entry.type === 'SALE';
                  const isSelfUse = entry.type === 'SELF_USE';
                  const hasDoc = Boolean(entry.saleDoc || entry.purchaseDoc || entry.selfUseDoc);

                  const inQty = round2(entry.inwardQty);
                  const outQty = round2(entry.outwardQty);
                  const totalAmt = round2(entry.totalAmount);
                  const runBal = round2(entry.runningBalance);

                  const purcVal = inQty > 0
                    ? (showAmount && !showQty ? `₹${totalAmt}` : (showAmount && showQty ? `${inQty} (₹${totalAmt})` : inQty))
                    : '';
                  const saleVal = isSale && outQty > 0
                    ? (showAmount && !showQty ? `₹${totalAmt}` : (showAmount && showQty ? `${outQty} (₹${totalAmt})` : outQty))
                    : '';
                  const useVal = isSelfUse && outQty > 0
                    ? (showAmount && !showQty ? `₹${totalAmt}` : (showAmount && showQty ? `${outQty} (₹${totalAmt})` : outQty))
                    : '';
                  const baseRate = round2(activeItem?.unitA?.basicPrice ?? activeItem?.purchaseRate ?? entry.rate);
                  const runningStockVal = round2(runBal * baseRate);
                  const stockDisplay = showAmount && !showQty
                    ? `₹${runningStockVal}`
                    : (showAmount && showQty ? `${runBal} (₹${runningStockVal})` : runBal);

                  return (
                    <tr key={entry.id} style={{ borderBottom: '1px solid #E2E8F0', height: '36px' }}>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, borderRight: '1px solid #CBD5E1' }}>
                        {formatDateToDisplay(entry.date)}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 800, borderRight: '1px solid #CBD5E1' }}>
                        {hasDoc ? (
                          <button
                            type="button"
                            onClick={() => handleOpenDocDetail(entry)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#002B99',
                              fontWeight: 900,
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: 0
                            }}
                            title="View Document Details"
                          >
                            <span>{entry.refNo}</span>
                            <ExternalLink size={11} />
                          </button>
                        ) : (
                          entry.refNo
                        )}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 800, borderRight: '1px solid #CBD5E1' }}>
                        {entry.counterparty}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, borderRight: '1px solid #CBD5E1' }}>
                        {activeItem?.unitA?.unitName || activeItem?.unit || 'PCS'}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, borderRight: '1px solid #CBD5E1' }}>
                        {round2(entry.rate || baseRate || 0)}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 800, color: '#047857', borderRight: '1px solid #CBD5E1' }}>
                        {purcVal}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 800, color: '#1D4ED8', borderRight: '1px solid #CBD5E1' }}>
                        {saleVal}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 800, color: '#7E22CE', borderRight: '1px solid #CBD5E1' }}>
                        {useVal}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 900, color: '#000000' }}>
                        {stockDisplay}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: '#D4C4FB', borderTop: '1.5px solid #000000', fontWeight: 900, fontSize: '0.92rem' }}>
                <td colSpan={5} style={{ padding: '10px 14px', textAlign: 'left', borderRight: '1.5px solid #000000', color: '#000000' }}>
                  TOTAL
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'right', borderRight: '1.5px solid #000000', color: '#000000' }}>
                  {showAmount && !showQty
                    ? `₹${activeItemMetrics.purchasesValue}`
                    : (showAmount && showQty ? `${activeItemMetrics.totalPurcQty} (₹${activeItemMetrics.purchasesValue})` : activeItemMetrics.totalPurcQty)}
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'right', borderRight: '1.5px solid #000000', color: '#000000' }}>
                  {showAmount && !showQty
                    ? `₹${activeItemMetrics.salesValue}`
                    : (showAmount && showQty ? `${activeItemMetrics.totalSaleQty} (₹${activeItemMetrics.salesValue})` : activeItemMetrics.totalSaleQty)}
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'right', borderRight: '1.5px solid #000000', color: '#000000' }}>
                  {showAmount && !showQty
                    ? `₹${activeItemMetrics.selfUseValue}`
                    : (showAmount && showQty ? `${activeItemMetrics.totalUseQty} (₹${activeItemMetrics.selfUseValue})` : activeItemMetrics.totalUseQty)}
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'right', color: '#000000' }}>
                  {showAmount && !showQty
                    ? `₹${activeItemMetrics.stockValue}`
                    : (showAmount && showQty ? `${activeItemMetrics.closingStock} (₹${activeItemMetrics.stockValue})` : activeItemMetrics.closingStock)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Floating TOP Scroll Button */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#FFFFFF',
          border: '1.5px solid #000000',
          borderRadius: '8px',
          padding: '6px 12px',
          fontWeight: 900,
          fontSize: '0.8rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
          zIndex: 99
        }}
        title="Scroll to Top"
      >
        <ChevronUp size={14} /> TOP
      </button>

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
              <div className="stat-grid-auto" style={{ gap: '10px' }}>
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>Basic Total</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#002B99' }}>₹{round2(selectedSaleDetail.basicTotal)}</div>
                </div>
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>GST Total</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#002B99' }}>₹{round2(selectedSaleDetail.gstTotal)}</div>
                </div>
                <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E40AF' }}>Bill Total</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1E40AF' }}>₹{round2(selectedSaleDetail.billTotal)}</div>
                </div>
                <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534' }}>Paid / Balance</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#16A34A' }}>
                    ₹{round2((selectedSaleDetail.recdCash || 0) + (selectedSaleDetail.recdUpi || 0))}
                    {selectedSaleDetail.balanceDue ? (
                      <span style={{ fontSize: '0.8rem', color: '#DC2626', marginLeft: '6px' }}>
                        (Due: ₹{round2(selectedSaleDetail.balanceDue)})
                      </span>
                    ) : ''}
                  </div>
                </div>
              </div>

              <div style={{ border: '1.5px solid #000000', borderRadius: '8px', overflow: 'hidden' }}>
                <div className="table-responsive-wrapper">
                  <table className="table-clean" style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse' }}>
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
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{round2(item.basicPrice)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>{round2(item.gstPercent)}%</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{round2(item.gstAmt)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{round2(item.nettPrice)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#002B99' }}>
                            ₹{round2(item.salePrice || item.mrp)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900 }}>{round2(item.qty)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: '#002B99' }}>
                            ₹{round2(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
              <div className="stat-grid-auto" style={{ gap: '10px' }}>
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>Basic Total</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#002B99' }}>₹{round2(selectedPurchaseDetail.basicTotal)}</div>
                </div>
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>GST Total</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#002B99' }}>₹{round2(selectedPurchaseDetail.gstTotal)}</div>
                </div>
                <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534' }}>Purchase Bill Total</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#16A34A' }}>₹{round2(selectedPurchaseDetail.billTotal)}</div>
                </div>
              </div>

              <div style={{ border: '1.5px solid #000000', borderRadius: '8px', overflow: 'hidden' }}>
                <div className="table-responsive-wrapper">
                  <table className="table-clean" style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse' }}>
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
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{round2(item.basicPrice)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>{round2(item.gstPercent)}%</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{round2(item.nettPrice)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900 }}>{round2(item.qty)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: '#002B99' }}>
                            ₹{round2(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{round2(item.rate)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900 }}>{round2(item.qty)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: '#002B99' }}>
                          ₹{round2(item.amount)}
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
                  Total Value: ₹{round2(selectedSelfUseDetail.totalAmount)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
