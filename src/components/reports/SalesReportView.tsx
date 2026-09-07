import React, { useState, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { formatDateToDisplay, getTodayDateString } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/calculations';
import { Search, Printer, Download, Filter } from 'lucide-react';

export const SalesReportView: React.FC = () => {
  const { refreshKey } = useApp();

  const sales = useMemo(() => db.getSales(), [refreshKey]);
  const parties = useMemo(() => db.getParties(), [refreshKey]);
  const items = useMemo(() => db.getItems(), [refreshKey]);

  // Filters
  const [fromDate, setFromDate] = useState<string>('2026-08-01');
  const [toDate, setToDate] = useState<string>(getTodayDateString());
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('ALL');

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (fromDate && s.billDate < fromDate) return false;
      if (toDate && s.billDate > toDate) return false;
      if (selectedPartyId && s.partyId !== selectedPartyId) return false;
      if (selectedItemId && !s.items.some(i => i.itemId === selectedItemId)) return false;
      if (paymentMode === 'CASH' && (s.recdCash || 0) <= 0) return false;
      if (paymentMode === 'ONLINE' && (s.recdUpi || 0) <= 0) return false;
      return true;
    });
  }, [sales, fromDate, toDate, selectedPartyId, selectedItemId, paymentMode]);

  // Aggregated totals
  const totals = useMemo(() => {
    let totalQty = 0;
    let totalBasic = 0;
    let totalGst = 0;
    let totalBillAmount = 0;
    let totalCash = 0;
    let totalUpi = 0;

    filteredSales.forEach(s => {
      totalBasic += Number(s.basicTotal) || 0;
      totalGst += Number(s.gstTotal) || 0;
      totalBillAmount += Number(s.billTotal) || 0;
      totalCash += Number(s.recdCash) || 0;
      totalUpi += Number(s.recdUpi) || 0;
      s.items.forEach(i => {
        totalQty += Number(i.qty) || 0;
      });
    });

    return {
      count: filteredSales.length,
      totalQty,
      totalBasic,
      totalGst,
      totalBillAmount,
      totalCash,
      totalUpi
    };
  }, [filteredSales]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Bill No', 'Date', 'Party', 'Items', 'Total Qty', 'Basic', 'GST', 'Bill Total', 'Cash', 'UPI'];
    const rows = filteredSales.map(s => [
      s.billNo,
      s.billDate,
      `"${s.partyName}"`,
      `"${s.items.map(i => `${i.itemName} (${i.qty})`).join(', ')}"`,
      s.items.reduce((a, b) => a + b.qty, 0),
      s.basicTotal,
      s.gstTotal,
      s.billTotal,
      s.recdCash,
      s.recdUpi
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sales_Report_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="content-panel-grey">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div className="pill-header-lime" style={{ padding: '8px 28px', fontSize: '1.2rem' }}>
          SALES REPORT
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
          <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '4px' }}>Party</label>
          <select
            className="input-text-clean"
            value={selectedPartyId}
            onChange={e => setSelectedPartyId(e.target.value)}
          >
            <option value="">All Parties</option>
            {parties.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
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

        <div>
          <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '4px' }}>Payment Mode</label>
          <select
            className="input-text-clean"
            value={paymentMode}
            onChange={e => setPaymentMode(e.target.value)}
          >
            <option value="ALL">All Payments</option>
            <option value="CASH">Cash Sales</option>
            <option value="ONLINE">UPI / Online Sales</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stat-grid-auto" style={{ marginBottom: '20px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #000000', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6B7280' }}>TOTAL INVOICES</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#111827' }}>{totals.count}</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #000000', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6B7280' }}>RECD CASH</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#15803D' }}>{formatCurrency(totals.totalCash)}</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #000000', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6B7280' }}>RECD ONLINE / UPI</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#2563EB' }}>{formatCurrency(totals.totalUpi)}</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #000000', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#EA3943' }}>TOTAL SALES VALUE</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#EA3943' }}>{formatCurrency(totals.totalBillAmount)}</div>
        </div>
      </div>

      {/* Report Table */}
      <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '10px', padding: '16px' }}>
        <div className="custom-table-container table-responsive-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Bill No.</th>
                <th style={{ width: '100px' }}>Date</th>
                <th>Party Name</th>
                <th>Items Sold</th>
                <th style={{ textAlign: 'center', width: '80px' }}>Qty</th>
                <th style={{ textAlign: 'right', width: '110px' }}>Basic</th>
                <th style={{ textAlign: 'right', width: '90px' }}>GST</th>
                <th style={{ textAlign: 'right', width: '100px' }}>Cash</th>
                <th style={{ textAlign: 'right', width: '100px' }}>UPI</th>
                <th style={{ textAlign: 'right', width: '120px' }}>Bill Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF' }}>
                    No sales transactions match the specified filter criteria.
                  </td>
                </tr>
              ) : (
                filteredSales.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 800, fontFamily: 'monospace' }}>{s.billNo}</td>
                    <td>{formatDateToDisplay(s.billDate)}</td>
                    <td style={{ fontWeight: 700 }}>{s.partyName}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {s.items.map((i, idx) => (
                        <div key={idx}>
                          {i.itemName} <span style={{ color: '#EA3943', fontWeight: 800 }}>x{i.qty}</span>
                        </div>
                      ))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#EA3943' }}>
                      {s.items.reduce((a, b) => a + b.qty, 0)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(s.basicTotal, false)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(s.gstTotal, false)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#15803D' }}>{formatCurrency(s.recdCash, false)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#2563EB' }}>{formatCurrency(s.recdUpi, false)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, fontSize: '1rem', color: '#000000' }}>
                      {formatCurrency(s.billTotal, false)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--color-lavender-table-head)', borderTop: '2px solid #000000' }}>
                <td colSpan={4} style={{ padding: '10px 12px', fontWeight: 900, textAlign: 'right' }}>
                  TOTALS:
                </td>
                <td style={{ textAlign: 'center', fontWeight: 900, color: '#EA3943' }}>{totals.totalQty}</td>
                <td style={{ textAlign: 'right', fontWeight: 900 }}>{formatCurrency(totals.totalBasic, false)}</td>
                <td style={{ textAlign: 'right', fontWeight: 900 }}>{formatCurrency(totals.totalGst, false)}</td>
                <td style={{ textAlign: 'right', fontWeight: 900, color: '#15803D' }}>{formatCurrency(totals.totalCash, false)}</td>
                <td style={{ textAlign: 'right', fontWeight: 900, color: '#2563EB' }}>{formatCurrency(totals.totalUpi, false)}</td>
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
