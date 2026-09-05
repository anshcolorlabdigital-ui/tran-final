import React, { useState, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { formatDateToDisplay, getTodayDateString } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/calculations';
import { Download, Printer } from 'lucide-react';

export const PurchaseReportView: React.FC = () => {
  const { refreshKey } = useApp();

  const purchases = useMemo(() => db.getPurchases(), [refreshKey]);
  const suppliers = useMemo(() => db.getSuppliers(), [refreshKey]);
  const items = useMemo(() => db.getItems(), [refreshKey]);

  const [fromDate, setFromDate] = useState<string>('2026-08-01');
  const [toDate, setToDate] = useState<string>(getTodayDateString());
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const dateToCheck = p.recdDate || p.billDate;
      if (fromDate && dateToCheck < fromDate) return false;
      if (toDate && dateToCheck > toDate) return false;
      if (selectedSupplierId && p.supplierId !== selectedSupplierId) return false;
      if (selectedItemId && !p.items.some(i => i.itemId === selectedItemId)) return false;
      return true;
    });
  }, [purchases, fromDate, toDate, selectedSupplierId, selectedItemId]);

  const totals = useMemo(() => {
    let totalQty = 0;
    let totalBasic = 0;
    let totalGst = 0;
    let totalBillAmount = 0;

    filteredPurchases.forEach(p => {
      totalBasic += Number(p.basicTotal) || 0;
      totalGst += Number(p.gstTotal) || 0;
      totalBillAmount += Number(p.billTotal) || 0;
      p.items.forEach(i => {
        totalQty += Number(i.qty) || 0;
      });
    });

    return {
      count: filteredPurchases.length,
      totalQty,
      totalBasic,
      totalGst,
      totalBillAmount
    };
  }, [filteredPurchases]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Bill No', 'Bill Date', 'Recd Date', 'Supplier', 'Items', 'Total Qty', 'Basic Total', 'GST Total', 'Bill Total'];
    const rows = filteredPurchases.map(p => [
      p.billNo,
      p.billDate,
      p.recdDate,
      `"${p.supplierName}"`,
      `"${p.items.map(i => `${i.itemName} (${i.qty})`).join(', ')}"`,
      p.items.reduce((a, b) => a + b.qty, 0),
      p.basicTotal,
      p.gstTotal,
      p.billTotal
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Purchase_Report_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="content-panel-grey">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div className="pill-header-lime" style={{ padding: '8px 28px', fontSize: '1.2rem' }}>
          PURCHASE REPORT
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

      {/* Filter Bar */}
      <div
        style={{
          background: '#FFFFFF',
          border: '2px solid #000000',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          alignItems: 'flex-end'
        }}
      >
        <div>
          <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '4px' }}>From Date</label>
          <input
            type="date"
            className="input-text-clean"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '4px' }}>To Date</label>
          <input
            type="date"
            className="input-text-clean"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '4px' }}>Supplier</label>
          <select
            className="input-text-clean"
            value={selectedSupplierId}
            onChange={e => setSelectedSupplierId(e.target.value)}
          >
            <option value="">All Suppliers</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '4px' }}>Item</label>
          <select
            className="input-text-clean"
            value={selectedItemId}
            onChange={e => setSelectedItemId(e.target.value)}
          >
            <option value="">All Items</option>
            {items.map(i => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #000000', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6B7280' }}>PURCHASE BILLS</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#111827' }}>{totals.count}</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #000000', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6B7280' }}>TOTAL UNITS INWARD</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#15803D' }}>{totals.totalQty}</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #000000', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#EA3943' }}>TOTAL INWARD VALUE</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#EA3943' }}>{formatCurrency(totals.totalBillAmount)}</div>
        </div>
      </div>

      {/* Report Table */}
      <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '10px', padding: '16px' }}>
        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Bill No.</th>
                <th style={{ width: '100px' }}>Bill Date</th>
                <th style={{ width: '100px' }}>Recd Date</th>
                <th>Supplier</th>
                <th>Items Received</th>
                <th style={{ textAlign: 'center', width: '80px' }}>Qty</th>
                <th style={{ textAlign: 'right', width: '110px' }}>Basic</th>
                <th style={{ textAlign: 'right', width: '90px' }}>GST</th>
                <th style={{ textAlign: 'right', width: '130px' }}>Bill Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF' }}>
                    No purchase inward transactions match the specified filter criteria.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 800, fontFamily: 'monospace' }}>{p.billNo}</td>
                    <td>{formatDateToDisplay(p.billDate)}</td>
                    <td>{formatDateToDisplay(p.recdDate || p.billDate)}</td>
                    <td style={{ fontWeight: 800 }}>{p.supplierName}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {p.items.map((i, idx) => (
                        <div key={idx}>
                          {i.itemName} <span style={{ color: '#15803D', fontWeight: 800 }}>x{i.qty}</span>
                        </div>
                      ))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#15803D' }}>
                      {p.items.reduce((a, b) => a + b.qty, 0)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(p.basicTotal, false)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(p.gstTotal, false)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, fontSize: '1rem', color: '#000000' }}>
                      {formatCurrency(p.billTotal, false)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--color-lavender-table-head)', borderTop: '2px solid #000000' }}>
                <td colSpan={5} style={{ padding: '10px 12px', fontWeight: 900, textAlign: 'right' }}>
                  TOTALS:
                </td>
                <td style={{ textAlign: 'center', fontWeight: 900, color: '#15803D' }}>{totals.totalQty}</td>
                <td style={{ textAlign: 'right', fontWeight: 900 }}>{formatCurrency(totals.totalBasic, false)}</td>
                <td style={{ textAlign: 'right', fontWeight: 900 }}>{formatCurrency(totals.totalGst, false)}</td>
                <td style={{ textAlign: 'right', fontWeight: 900, fontSize: '1.05rem', color: '#000000' }}>
                  {formatCurrency(totals.totalBillAmount, false)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
