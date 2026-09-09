import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { StockEngine } from '../../db/stockEngine';
import { FileSpreadsheet, Printer, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getTodayDateString } from '../../utils/dateUtils';

type StockStatusFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'ZERO_STOCK';

export const ItemStockReportView: React.FC = () => {
  const { refreshKey, openItemLedger } = useApp();

  const stockSummaries = useMemo(() => StockEngine.getAllItemsStockSummary(), [refreshKey]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilter>('ALL');

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    stockSummaries.forEach(s => {
      if (s.item.category) set.add(s.item.category);
    });
    return Array.from(set);
  }, [stockSummaries]);

  // Filter counts
  const filterCounts = useMemo(() => {
    let inStock = 0;
    let lowStock = 0;
    let zeroStock = 0;
    stockSummaries.forEach(s => {
      if (s.closingStock <= 0) {
        zeroStock++;
      } else {
        inStock++;
        if (s.item.minStock && s.closingStock <= s.item.minStock) {
          lowStock++;
        }
      }
    });
    return { inStock, lowStock, zeroStock, total: stockSummaries.length };
  }, [stockSummaries]);

  // Filtered summaries
  const filteredSummaries = useMemo(() => {
    const q = search.toLowerCase().trim();
    return stockSummaries.filter(s => {
      // Stock Status filter
      if (stockStatusFilter === 'IN_STOCK' && s.closingStock <= 0) return false;
      if (stockStatusFilter === 'ZERO_STOCK' && s.closingStock !== 0) return false;
      if (stockStatusFilter === 'LOW_STOCK' && (s.closingStock <= 0 || s.closingStock > (s.item.minStock || 0))) return false;

      // Category filter
      if (selectedCategory !== 'ALL' && s.item.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      // Search query
      if (q) {
        return (
          s.item.name.toLowerCase().includes(q) ||
          (s.item.sno && s.item.sno.toLowerCase().includes(q)) ||
          (s.item.category && s.item.category.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [stockSummaries, search, selectedCategory, stockStatusFilter]);

  // Aggregated totals for actual monetary values + quantities
  const totals = useMemo(() => {
    let totalOpeningQty = 0;
    let totalOpeningVal = 0;
    let totalPurchaseQty = 0;
    let totalPurchaseVal = 0;
    let totalSaleQty = 0;
    let totalSaleVal = 0;
    let totalSelfUseQty = 0;
    let totalSelfUseVal = 0;
    let totalClosingQty = 0;
    let totalValuation = 0;

    filteredSummaries.forEach(s => {
      const rate = Number(s.item.unitA?.basicPrice ?? s.item.purchaseRate ?? 0);
      const saleRate = Number(s.item.unitA?.salePrice ?? s.item.saleRate ?? rate);

      const opVal = s.openingStock * rate;
      const purVal = s.purchaseQty * rate;
      const salVal = s.saleQty * saleRate;
      const suVal = s.selfUseQty * rate;
      const stockVal = Math.max(0, s.closingStock) * rate;

      totalOpeningQty += s.openingStock;
      totalOpeningVal += opVal;
      totalPurchaseQty += s.purchaseQty;
      totalPurchaseVal += purVal;
      totalSaleQty += s.saleQty;
      totalSaleVal += salVal;
      totalSelfUseQty += s.selfUseQty;
      totalSelfUseVal += suVal;
      totalClosingQty += s.closingStock;
      totalValuation += stockVal;
    });

    return {
      count: filteredSummaries.length,
      totalOpeningQty: Number(totalOpeningQty.toFixed(2)),
      totalOpeningVal: Number(totalOpeningVal.toFixed(2)),
      totalPurchaseQty: Number(totalPurchaseQty.toFixed(2)),
      totalPurchaseVal: Number(totalPurchaseVal.toFixed(2)),
      totalSaleQty: Number(totalSaleQty.toFixed(2)),
      totalSaleVal: Number(totalSaleVal.toFixed(2)),
      totalSelfUseQty: Number(totalSelfUseQty.toFixed(2)),
      totalSelfUseVal: Number(totalSelfUseVal.toFixed(2)),
      totalClosingQty: Number(totalClosingQty.toFixed(2)),
      totalValuation: Number(totalValuation.toFixed(2)),
      totalAllCount: stockSummaries.length
    };
  }, [filteredSummaries, stockSummaries]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const data = filteredSummaries.map((s, idx) => {
      const rate = Number(s.item.unitA?.basicPrice ?? s.item.purchaseRate ?? 0);
      const saleRate = Number(s.item.unitA?.salePrice ?? s.item.saleRate ?? rate);
      const opVal = Number((s.openingStock * rate).toFixed(2));
      const purVal = Number((s.purchaseQty * rate).toFixed(2));
      const salVal = Number((s.saleQty * saleRate).toFixed(2));
      const suVal = Number((s.selfUseQty * rate).toFixed(2));
      const stockVal = Number((Math.max(0, s.closingStock) * rate).toFixed(2));

      return {
        'S.No.': idx + 1,
        'Item Code': s.item.sno || '',
        'Item Name': s.item.name,
        'Category': s.item.category || '',
        'Unit': s.item.unitA?.unitName || s.item.unit || 'Pcs',
        'Unit Purchase Rate (₹)': rate,
        'Opening Qty': Number(s.openingStock.toFixed(2)),
        'Opening Value (₹)': opVal,
        'Purchases Qty (+)': Number(s.purchaseQty.toFixed(2)),
        'Purchases Value (₹)': purVal,
        'Sales Qty (-)': Number(s.saleQty.toFixed(2)),
        'Sales Value (₹)': salVal,
        'Self Use Qty (-)': Number(s.selfUseQty.toFixed(2)),
        'Self Use Value (₹)': suVal,
        'On-Hand Stock Qty': Number(s.closingStock.toFixed(2)),
        'Total Stock Valuation (₹)': stockVal
      };
    });

    // Add Summary TOTAL row at the bottom
    data.push({
      'S.No.': '' as any,
      'Item Code': '',
      'Item Name': 'TOTAL',
      'Category': '',
      'Unit': '',
      'Unit Purchase Rate (₹)': '' as any,
      'Opening Qty': totals.totalOpeningQty,
      'Opening Value (₹)': totals.totalOpeningVal,
      'Purchases Qty (+)': totals.totalPurchaseQty,
      'Purchases Value (₹)': totals.totalPurchaseVal,
      'Sales Qty (-)': totals.totalSaleQty,
      'Sales Value (₹)': totals.totalSaleVal,
      'Self Use Qty (-)': totals.totalSelfUseQty,
      'Self Use Value (₹)': totals.totalSelfUseVal,
      'On-Hand Stock Qty': totals.totalClosingQty,
      'Total Stock Valuation (₹)': totals.totalValuation
    });

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 6 },  // S.No.
      { wch: 12 }, // Item Code
      { wch: 30 }, // Item Name
      { wch: 18 }, // Category
      { wch: 10 }, // Unit
      { wch: 18 }, // Rate
      { wch: 14 }, // Opening Qty
      { wch: 18 }, // Opening Value
      { wch: 16 }, // Purchases Qty
      { wch: 18 }, // Purchases Value
      { wch: 14 }, // Sales Qty
      { wch: 18 }, // Sales Value
      { wch: 16 }, // Self Use Qty
      { wch: 18 }, // Self Use Value
      { wch: 18 }, // Stock Qty
      { wch: 22 }  // Total Stock Valuation
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Item Stock Values');
    XLSX.writeFile(workbook, `Item_Stock_Values_${getTodayDateString()}.xlsx`);
  };

  return (
    <div className="content-panel-grey">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div className="pill-header-lime" style={{ padding: '8px 28px', fontSize: '1.2rem' }}>
          ITEM STOCK INVENTORY REPORT
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleExportExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#10B981',
              color: '#FFFFFF',
              border: '1.5px solid #047857',
              padding: '7px 16px',
              borderRadius: '6px',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
            title="Export Excel (.xlsx) with Values & Quantities"
          >
            <FileSpreadsheet size={16} />
            Export Excel (.xlsx)
          </button>
          <button onClick={handlePrint} className="btn-red-action" style={{ fontSize: '0.85rem' }}>
            <Printer size={15} />
            Print Report
          </button>
        </div>
      </div>

      {/* Filter and Search Controls Card */}
      <div
        style={{
          background: '#FFFFFF',
          border: '2px solid #000000',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '260px', flex: 1, maxWidth: '360px' }}>
            <Search size={16} color="#6B7280" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search by code, name, category..."
              className="input-text-clean"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '34px', fontSize: '0.9rem' }}
            />
          </div>

          {/* Stock Status Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1F2937', whiteSpace: 'nowrap' }}>
              Stock Status:
            </label>
            <select
              className="input-text-clean"
              value={stockStatusFilter}
              onChange={e => setStockStatusFilter(e.target.value as StockStatusFilter)}
              style={{
                fontWeight: 800,
                fontSize: '0.88rem',
                padding: '6px 12px',
                minWidth: '200px',
                backgroundColor: stockStatusFilter === 'ZERO_STOCK' ? '#FEE2E2' : stockStatusFilter === 'LOW_STOCK' ? '#FEF3C7' : stockStatusFilter === 'IN_STOCK' ? '#DCFCE7' : '#FFFFFF',
                color: stockStatusFilter === 'ZERO_STOCK' ? '#991B1B' : stockStatusFilter === 'LOW_STOCK' ? '#92400E' : stockStatusFilter === 'IN_STOCK' ? '#166534' : '#111827'
              }}
            >
              <option value="ALL">All Items ({filterCounts.total})</option>
              <option value="IN_STOCK">In Stock ({filterCounts.inStock})</option>
              <option value="LOW_STOCK">Low Stock ({filterCounts.lowStock})</option>
              <option value="ZERO_STOCK">Zero Stock ({filterCounts.zeroStock})</option>
            </select>
          </div>

          {/* Category Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1F2937', whiteSpace: 'nowrap' }}>
              Category:
            </label>
            <select
              className="input-text-clean"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{ fontWeight: 700, fontSize: '0.88rem', padding: '6px 10px', minWidth: '160px' }}
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick count badge */}
        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4B5563' }}>
          Showing <span style={{ color: '#002B99', fontWeight: 900 }}>{filteredSummaries.length}</span> of {totals.totalAllCount} items
        </div>
      </div>

      {/* Actual Values KPI Summary Cards */}
      <div className="stat-grid-auto" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280' }}>1. OPENING VALUE</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#374151' }}>
            ₹{totals.totalOpeningVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', marginTop: '2px' }}>
            Total Qty: {totals.totalOpeningQty}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#15803D' }}>2. PURCHASES VALUE (+)</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#15803D' }}>
            +₹{totals.totalPurchaseVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803D', marginTop: '2px' }}>
            Total Qty: +{totals.totalPurchaseQty}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#EA3943' }}>3. SALES VALUE (-)</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#EA3943' }}>
            -₹{totals.totalSaleVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#EA3943', marginTop: '2px' }}>
            Total Qty: -{totals.totalSaleQty}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#B45309' }}>4. SELF USE VALUE (-)</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#B45309' }}>
            -₹{totals.totalSelfUseVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#B45309', marginTop: '2px' }}>
            Total Qty: -{totals.totalSelfUseQty}
          </div>
        </div>

        <div style={{ background: '#F0FDF4', border: '2px solid #059669', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#065F46' }}>TOTAL STOCK VALUATION</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#047857' }}>
            ₹{totals.totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065F46', marginTop: '2px' }}>
            On-Hand: {totals.totalClosingQty} units
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '10px', padding: '16px' }}>
        <div className="custom-table-container table-responsive-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ minWidth: '200px' }}>Item Description</th>
                <th style={{ textAlign: 'right', width: '100px' }}>Rate (₹)</th>
                <th style={{ textAlign: 'right', minWidth: '130px' }}>1. Opening Value</th>
                <th style={{ textAlign: 'right', minWidth: '130px', color: '#15803D' }}>2. Purchases (+)</th>
                <th style={{ textAlign: 'right', minWidth: '130px', color: '#EA3943' }}>3. Sales (-)</th>
                <th style={{ textAlign: 'right', minWidth: '130px', color: '#B45309' }}>4. Self Use (-)</th>
                <th style={{ textAlign: 'right', minWidth: '150px', color: '#047857' }}>Total Stock Valuation (₹)</th>
                <th style={{ textAlign: 'center', width: '80px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#6B7280', fontWeight: 700 }}>
                    No stock summary items found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map(s => {
                  const rate = Number(s.item.unitA?.basicPrice ?? s.item.purchaseRate ?? 0);
                  const saleRate = Number(s.item.unitA?.salePrice ?? s.item.saleRate ?? rate);
                  const opVal = Number((s.openingStock * rate).toFixed(2));
                  const purVal = Number((s.purchaseQty * rate).toFixed(2));
                  const salVal = Number((s.saleQty * saleRate).toFixed(2));
                  const suVal = Number((s.selfUseQty * rate).toFixed(2));
                  const itemValuation = Number((Math.max(0, s.closingStock) * rate).toFixed(2));
                  const isZero = s.closingStock <= 0;
                  const isLow = s.item.minStock && s.closingStock > 0 && s.closingStock <= s.item.minStock;

                  return (
                    <tr
                      key={s.item.id}
                      style={{
                        background: isZero ? '#FEF2F2' : isLow ? '#FFFBEB' : 'transparent'
                      }}
                    >
                      {/* Item Info */}
                      <td style={{ fontWeight: 800 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => openItemLedger(s.item.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                fontWeight: 800,
                                fontSize: '0.92rem',
                                color: '#002B99',
                                cursor: 'pointer',
                                textAlign: 'left',
                                textDecoration: 'underline'
                              }}
                              title="Click to open full transaction ledger"
                            >
                              {s.item.name}
                            </button>
                            {isZero ? (
                              <span style={{ backgroundColor: '#FEE2E2', color: '#991B1B', fontSize: '0.68rem', fontWeight: 900, padding: '1px 6px', borderRadius: '4px' }}>
                                ZERO
                              </span>
                            ) : isLow ? (
                              <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', fontSize: '0.68rem', fontWeight: 900, padding: '1px 6px', borderRadius: '4px' }}>
                                LOW
                              </span>
                            ) : null}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600 }}>
                            {s.item.sno ? `[${s.item.sno}] ` : ''}{s.item.category || 'General'} • {s.item.unitA?.unitName || s.item.unit || 'Pcs'}
                          </div>
                        </div>
                      </td>

                      {/* Rate */}
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.88rem', color: '#374151' }}>
                        ₹{rate.toFixed(2)}
                      </td>

                      {/* 1. Opening Value */}
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem' }}>
                        <div>₹{opVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: '0.72rem', color: '#6B7280', fontWeight: 600 }}>Qty: {Number(s.openingStock.toFixed(2))}</div>
                      </td>

                      {/* 2. Purchases Value (+) */}
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', color: '#15803D' }}>
                        <div>+₹{purVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>Qty: +{Number(s.purchaseQty.toFixed(2))}</div>
                      </td>

                      {/* 3. Sales Value (-) */}
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', color: '#EA3943' }}>
                        <div>-₹{salVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: '0.72rem', color: '#991B1B', fontWeight: 600 }}>Qty: -{Number(s.saleQty.toFixed(2))}</div>
                      </td>

                      {/* 4. Self Use Value (-) */}
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', color: '#B45309' }}>
                        <div>-₹{suVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: '0.72rem', color: '#92400E', fontWeight: 600 }}>Qty: -{Number(s.selfUseQty.toFixed(2))}</div>
                      </td>

                      {/* Total Stock Valuation */}
                      <td style={{ textAlign: 'right', fontWeight: 900, fontSize: '0.98rem', color: '#047857' }}>
                        <div>₹{itemValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div style={{ fontSize: '0.75rem', color: isZero ? '#DC2626' : '#065F46', fontWeight: 700 }}>
                          Stock: {Number(s.closingStock.toFixed(2))} {s.item.unitA?.unitName || s.item.unit || 'Units'}
                          {s.item.hasSecondaryUnit && s.item.unitB && s.item.unitB.unitName && (
                            <span> ({Number((s.closingStock * (Number(s.item.unitB.conversionFactor) || 1)).toFixed(1))} {s.item.unitB.unitName})</span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openItemLedger(s.item.id)}
                          className="btn-classic"
                          style={{
                            background: '#D2BEF6',
                            color: '#002B99',
                            fontWeight: 800,
                            fontSize: '0.74rem',
                            padding: '3px 8px',
                            border: '1.5px solid #000000'
                          }}
                          title="Open complete Item Transaction Ledger"
                        >
                          Ledger
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--color-lavender-table-head)', borderTop: '2px solid #000000' }}>
                <td style={{ padding: '10px 12px', fontWeight: 900, textAlign: 'right' }} colSpan={2}>
                  TOTAL SUMMARY:
                </td>
                <td style={{ textAlign: 'right', fontWeight: 900 }}>
                  <div>₹{totals.totalOpeningVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151' }}>Qty: {totals.totalOpeningQty}</div>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 900, color: '#15803D' }}>
                  <div>+₹{totals.totalPurchaseVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534' }}>Qty: +{totals.totalPurchaseQty}</div>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 900, color: '#EA3943' }}>
                  <div>-₹{totals.totalSaleVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#991B1B' }}>Qty: -{totals.totalSaleQty}</div>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 900, color: '#B45309' }}>
                  <div>-₹{totals.totalSelfUseVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#92400E' }}>Qty: -{totals.totalSelfUseQty}</div>
                </td>
                <td style={{ textAlign: 'right', fontWeight: 900, fontSize: '1.05rem', color: '#047857' }}>
                  <div>₹{totals.totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065F46' }}>Stock: {totals.totalClosingQty} units</div>
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
