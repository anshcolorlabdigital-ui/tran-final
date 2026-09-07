import React, { useState, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { formatDateToDisplay, getTodayDateString } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/calculations';
import { Download, Printer } from 'lucide-react';

export const SelfUseReportView: React.FC = () => {
  const { refreshKey } = useApp();

  const selfUses = useMemo(() => db.getSelfUses(), [refreshKey]);
  const items = useMemo(() => db.getItems(), [refreshKey]);

  const [fromDate, setFromDate] = useState<string>('2026-08-01');
  const [toDate, setToDate] = useState<string>(getTodayDateString());
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  const filteredSelfUses = useMemo(() => {
    return selfUses.filter(su => {
      if (fromDate && su.billDate < fromDate) return false;
      if (toDate && su.billDate > toDate) return false;
      if (selectedItemId && !su.items.some(i => i.itemId === selectedItemId)) return false;
      return true;
    });
  }, [selfUses, fromDate, toDate, selectedItemId]);

  const totals = useMemo(() => {
    let totalQty = 0;
    let totalValue = 0;

    filteredSelfUses.forEach(su => {
      totalValue += Number(su.totalAmount) || 0;
      su.items.forEach(i => {
        totalQty += Number(i.qty) || 0;
      });
    });

    return {
      count: filteredSelfUses.length,
      totalQty,
      totalValue
    };
  }, [filteredSelfUses]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Voucher No', 'Date', 'Items Used', 'Total Qty', 'Total Cost', 'Remarks'];
    const rows = filteredSelfUses.map(su => [
      su.billNo,
      su.billDate,
      `"${su.items.map(i => `${i.itemName} (${i.qty})`).join(', ')}"`,
      su.items.reduce((a, b) => a + b.qty, 0),
      su.totalAmount,
      `"${su.remarks || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Self_Use_Report_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="content-panel-grey">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div className="pill-header-lime" style={{ padding: '8px 28px', fontSize: '1.2rem' }}>
          SELF USE CONSUMPTION REPORT
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
          <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '4px' }}>Filter by Item</label>
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
      <div className="stat-grid-auto" style={{ marginBottom: '20px' }}>
        <div style={{ background: '#FFFFFF', border: '1px solid #000000', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6B7280' }}>CONSUMPTION VOUCHERS</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#111827' }}>{totals.count}</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #000000', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6B7280' }}>TOTAL UNITS CONSUMED</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#EA3943' }}>{totals.totalQty}</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #000000', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6B7280' }}>TOTAL ESTIMATED COST</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#111827' }}>{formatCurrency(totals.totalValue)}</div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '10px', padding: '16px' }}>
        <div className="custom-table-container table-responsive-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Voucher No</th>
                <th style={{ width: '110px' }}>Date</th>
                <th>Items Used In-House</th>
                <th style={{ textAlign: 'center', width: '90px' }}>Qty</th>
                <th style={{ textAlign: 'right', width: '130px' }}>Total Cost</th>
                <th>Remarks / Dept</th>
              </tr>
            </thead>
            <tbody>
              {filteredSelfUses.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF' }}>
                    No self-use transactions recorded for this period.
                  </td>
                </tr>
              ) : (
                filteredSelfUses.map(su => (
                  <tr key={su.id}>
                    <td style={{ fontWeight: 800, fontFamily: 'monospace' }}>{su.billNo}</td>
                    <td>{formatDateToDisplay(su.billDate)}</td>
                    <td style={{ fontSize: '0.88rem' }}>
                      {su.items.map((i, idx) => (
                        <div key={idx}>
                          {i.itemName} <span style={{ color: '#EA3943', fontWeight: 800 }}>x{i.qty}</span>
                        </div>
                      ))}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 800, color: '#EA3943' }}>
                      {su.items.reduce((a, b) => a + b.qty, 0)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800 }}>
                      {formatCurrency(su.totalAmount, false)}
                    </td>
                    <td style={{ color: '#4B5563', fontSize: '0.85rem' }}>{su.remarks || 'Production'}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--color-lavender-table-head)', borderTop: '2px solid #000000' }}>
                <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 900, textAlign: 'right' }}>
                  TOTALS:
                </td>
                <td style={{ textAlign: 'center', fontWeight: 900, color: '#EA3943' }}>{totals.totalQty}</td>
                <td style={{ textAlign: 'right', fontWeight: 900, fontSize: '1.05rem' }}>
                  {formatCurrency(totals.totalValue, false)}
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
