import React, { useState, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { StockEngine } from '../../db/stockEngine';
import { Download, Printer, Search, AlertTriangle } from 'lucide-react';
import { formatDateToDisplay } from '../../utils/dateUtils';

export const ItemStockReportView: React.FC = () => {
  const { refreshKey } = useApp();

  const stockSummaries = useMemo(() => StockEngine.getAllItemsStockSummary(), [refreshKey]);
  const [search, setSearch] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  const filteredSummaries = useMemo(() => {
    const q = search.toLowerCase().trim();
    return stockSummaries.filter(s => {
      if (onlyLowStock && !s.isLowStock) return false;
      if (q) {
        return (
          s.item.name.toLowerCase().includes(q) ||
          s.item.sno.toLowerCase().includes(q) ||
          (s.item.category && s.item.category.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [stockSummaries, search, onlyLowStock]);

  const totals = useMemo(() => {
    let totalOpening = 0;
    let totalPurchase = 0;
    let totalSale = 0;
    let totalSelfUse = 0;
    let totalAdjustment = 0;
    let totalClosing = 0;
    let lowStockCount = 0;

    filteredSummaries.forEach(s => {
      totalOpening += s.openingStock;
      totalPurchase += s.purchaseQty;
      totalSale += s.saleQty;
      totalSelfUse += s.selfUseQty;
      totalAdjustment += s.adjustmentQty;
      totalClosing += s.closingStock;
      if (s.isLowStock) lowStockCount++;
    });

    return {
      count: filteredSummaries.length,
      totalOpening,
      totalPurchase,
      totalSale,
      totalSelfUse,
      totalAdjustment,
      totalClosing,
      lowStockCount
    };
  }, [filteredSummaries]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['S.No', 'Item Name', 'Category', 'Unit', 'Opening', 'Purchase In', 'Sale Out', 'Self Use Out', 'Adjustment', 'Closing Stock', 'Min Stock', 'Low Stock', 'Active Order'];
    const rows = filteredSummaries.map(s => [
      s.item.sno,
      `"${s.item.name}"`,
      `"${s.item.category || ''}"`,
      `"${s.item.unit || 'Pcs'}"`,
      s.openingStock,
      s.purchaseQty,
      s.saleQty,
      s.selfUseQty,
      s.adjustmentQty,
      s.closingStock,
      s.item.minStock,
      s.isLowStock ? 'YES' : 'NO',
      s.activeOrder ? `"${s.activeOrder.supplierName} (${s.activeOrder.orderDate})"` : 'NONE'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Item_Stock_Movement_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="content-panel-grey">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div className="pill-header-lime" style={{ padding: '8px 28px', fontSize: '1.2rem' }}>
          ITEM STOCK MOVEMENT LEDGER REPORT
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleExportCSV} className="btn-lime-action" style={{ fontSize: '0.85rem' }}>
            <Download size={15} />
            Export CSV
          </button>
          <button onClick={handlePrint} className="btn-red-action" style={{ fontSize: '0.85rem' }}>
            <Printer size={15} />
            Print Report
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
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
          gap: '12px'
        }}
      >
        <div style={{ position: 'relative', width: '380px' }}>
          <Search size={16} color="#6B7280" style={{ position: 'absolute', left: '10px', top: '10px' }} />
          <input
            type="text"
            placeholder="Search items by code, name, category..."
            className="input-text-clean"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '34px' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            id="onlyLowStockCheck"
            checked={onlyLowStock}
            onChange={e => setOnlyLowStock(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <label htmlFor="onlyLowStockCheck" style={{ fontWeight: 800, fontSize: '0.9rem', color: '#EA3943', cursor: 'pointer' }}>
            Show Low-Stock / Reorder Items Only ({totals.lowStockCount})
          </label>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #000000', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6B7280' }}>TOTAL ITEMS</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>{totals.count}</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #000000', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#16A34A' }}>PURCHASES (+)</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#15803D' }}>+{totals.totalPurchase}</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #000000', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#EA3943' }}>SALES OUT (-)</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#EA3943' }}>-{totals.totalSale}</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #000000', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#D97706' }}>SELF USE (-)</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#B45309' }}>-{totals.totalSelfUse}</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #000000', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#002B99' }}>NET PHYSICAL STOCK</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#002B99' }}>{totals.totalClosing}</div>
        </div>
      </div>

      {/* Stock Matrix Table */}
      <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '10px', padding: '16px' }}>
        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '70px' }}>S.No</th>
                <th>Item Description</th>
                <th style={{ textAlign: 'center', width: '90px' }}>Opening</th>
                <th style={{ textAlign: 'center', width: '90px', color: '#15803D' }}>Purchases</th>
                <th style={{ textAlign: 'center', width: '90px', color: '#EA3943' }}>Sales</th>
                <th style={{ textAlign: 'center', width: '90px', color: '#B45309' }}>Self Use</th>
                <th style={{ textAlign: 'center', width: '90px' }}>Adjust</th>
                <th style={{ textAlign: 'center', width: '100px', color: '#002B99' }}>Closing</th>
                <th style={{ textAlign: 'center', width: '85px' }}>Min Stock</th>
                <th style={{ textAlign: 'center', width: '140px' }}>Order Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF' }}>
                    No stock summary items found matching the filter.
                  </td>
                </tr>
              ) : (
                filteredSummaries.map(s => (
                  <tr key={s.item.id} style={{ background: s.isLowStock ? '#FFFBEB' : 'transparent' }}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{s.item.sno}</td>
                    <td style={{ fontWeight: 800 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{s.item.name}</span>
                        {s.isLowStock && (
                          <span
                            style={{
                              backgroundColor: '#FEE2E2',
                              color: '#DC2626',
                              fontSize: '0.7rem',
                              fontWeight: 900,
                              padding: '1px 6px',
                              borderRadius: '4px'
                            }}
                          >
                            LOW STOCK
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.openingStock}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#15803D' }}>+{s.purchaseQty}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#EA3943' }}>-{s.saleQty}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#B45309' }}>-{s.selfUseQty}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.adjustmentQty >= 0 ? `+${s.adjustmentQty}` : s.adjustmentQty}</td>
                    <td
                      style={{
                        textAlign: 'center',
                        fontWeight: 900,
                        fontSize: '1.05rem',
                        color: s.isLowStock ? '#EA3943' : '#15803D'
                      }}
                    >
                      {s.closingStock}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.item.minStock}</td>
                    <td style={{ textAlign: 'center' }}>
                      {s.activeOrder ? (
                        <div style={{ fontSize: '0.8rem', lineHeight: 1.2 }}>
                          <strong style={{ color: '#15803D' }}>{s.activeOrder.supplierName}</strong>
                          <div style={{ color: '#6B7280', fontSize: '0.72rem' }}>
                            {formatDateToDisplay(s.activeOrder.orderDate)}
                          </div>
                        </div>
                      ) : s.isLowStock ? (
                        <span style={{ color: '#EA3943', fontWeight: 900, fontSize: '0.8rem' }}>PENDING</span>
                      ) : (
                        <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--color-lavender-table-head)', borderTop: '2px solid #000000' }}>
                <td colSpan={2} style={{ padding: '10px 12px', fontWeight: 900, textAlign: 'right' }}>
                  TOTAL PHYSICAL MOVEMENT:
                </td>
                <td style={{ textAlign: 'center', fontWeight: 900 }}>{totals.totalOpening}</td>
                <td style={{ textAlign: 'center', fontWeight: 900, color: '#15803D' }}>+{totals.totalPurchase}</td>
                <td style={{ textAlign: 'center', fontWeight: 900, color: '#EA3943' }}>-{totals.totalSale}</td>
                <td style={{ textAlign: 'center', fontWeight: 900, color: '#B45309' }}>-{totals.totalSelfUse}</td>
                <td style={{ textAlign: 'center', fontWeight: 900 }}>{totals.totalAdjustment}</td>
                <td style={{ textAlign: 'center', fontWeight: 900, fontSize: '1.1rem', color: '#002B99' }}>
                  {totals.totalClosing}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
