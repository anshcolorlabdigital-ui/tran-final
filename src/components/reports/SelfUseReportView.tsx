import React, { useState, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { formatDateToDisplay, getTodayDateString } from '../../utils/dateUtils';
import { formatCurrency, round2 } from '../../utils/calculations';
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
      totalQty: round2(totalQty),
      totalValue: round2(totalValue)
    };
  }, [filteredSelfUses]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Voucher No', 'Date', 'Items Used In-House', 'Qty', 'Purchase Price', 'Amount'];
    const rows: (string | number)[][] = [];

    filteredSelfUses.forEach(su => {
      su.items.forEach((item, idx) => {
        const itemPrice = item.rate || (item.qty ? round2(item.amount / item.qty) : 0);
        rows.push([
          idx === 0 ? su.billNo : '',
          idx === 0 ? formatDateToDisplay(su.billDate) : '',
          item.itemName,
          round2(item.qty),
          round2(itemPrice),
          round2(item.amount || (item.qty * itemPrice))
        ]);
      });
      rows.push(['SUB TOTAL', '', '', '', '', round2(su.totalAmount)]);
    });

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
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div className="pill-header-lime" style={{ padding: '8px 28px', fontSize: '1.2rem', fontWeight: 900 }}>
          SELF USE CONSUMPTION REPORT
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleExportCSV}
            className="btn-lime-action"
            style={{
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: '1.5px solid #000000',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            <Download size={15} />
            EXPORT CSV
          </button>
          <button
            onClick={handlePrint}
            className="btn-red-action"
            style={{
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: '1.5px solid #000000',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            <Printer size={15} />
            PRINT REPORT
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          background: '#FFFFFF',
          border: '2px solid #000000',
          borderRadius: '10px',
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
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
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '4px' }}>To Date</label>
          <input
            type="date"
            className="input-text-clean"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '4px' }}>Filter by Item</label>
          <select
            className="input-text-clean"
            value={selectedItemId}
            onChange={e => setSelectedItemId(e.target.value)}
            style={{ width: '100%' }}
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

      {/* Single Centered KPI Card matching mockup */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '22px' }}>
        <div
          style={{
            background: '#FFFFFF',
            border: '2px solid #000000',
            borderRadius: '6px',
            padding: '10px 48px',
            minWidth: '320px',
            textAlign: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}
        >
          <div
            style={{
              fontSize: '0.82rem',
              fontWeight: 900,
              color: '#DC2626',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '4px'
            }}
          >
            TOTALCONSUMTION VALUE
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#000000', fontFamily: 'monospace' }}>
            {totals.totalValue.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Grouped Table */}
      <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '10px', overflow: 'hidden' }}>
        <div className="table-responsive-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#D4C4FB', borderBottom: '2px solid #000000' }}>
                <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', width: '120px', fontWeight: 900, fontSize: '0.9rem' }}>Voucher No</th>
                <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', width: '120px', fontWeight: 900, fontSize: '0.9rem' }}>Date</th>
                <th style={{ padding: '10px 14px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.9rem' }}>Items Used In-House</th>
                <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', width: '80px', textAlign: 'center', fontWeight: 900, fontSize: '0.9rem' }}>Qty</th>
                <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', width: '140px', textAlign: 'right', fontWeight: 900, fontSize: '0.9rem' }}>
                  PURCHESH PRICE
                </th>
                <th style={{ padding: '10px 14px', width: '130px', textAlign: 'right', fontWeight: 900, fontSize: '0.9rem' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {filteredSelfUses.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#9CA3AF', fontWeight: 700 }}>
                    No self use consumption records found for this period.
                  </td>
                </tr>
              ) : (
                filteredSelfUses.map(su => {
                  const billTotal = Number(su.totalAmount) || 0;
                  return (
                    <React.Fragment key={su.id}>
                      {su.items.map((item, idx) => {
                        const itemPrice = item.rate || (item.qty ? round2(item.amount / item.qty) : 0);
                        const itemAmt = item.amount || round2(item.qty * itemPrice);
                        return (
                          <tr
                            key={`${su.id}-${item.id || idx}`}
                            style={{
                              borderBottom: '1px solid #D1D5DB',
                              background: '#FFFFFF'
                            }}
                          >
                            {/* Voucher No & Date spanning the bill rows */}
                            {idx === 0 ? (
                              <>
                                <td
                                  rowSpan={su.items.length}
                                  style={{
                                    padding: '10px 12px',
                                    borderRight: '1px solid #000000',
                                    fontWeight: 900,
                                    verticalAlign: 'top',
                                    fontFamily: 'monospace'
                                  }}
                                >
                                  {su.billNo}
                                </td>
                                <td
                                  rowSpan={su.items.length}
                                  style={{
                                    padding: '10px 12px',
                                    borderRight: '1px solid #000000',
                                    fontWeight: 800,
                                    verticalAlign: 'top'
                                  }}
                                >
                                  {formatDateToDisplay(su.billDate)}
                                </td>
                              </>
                            ) : null}

                            {/* Item details */}
                            <td style={{ padding: '8px 14px', borderRight: '1px solid #000000', fontWeight: 700 }}>
                              {item.itemName}
                            </td>
                            <td style={{ padding: '8px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900 }}>
                              {round2(item.qty)}
                            </td>
                            <td style={{ padding: '8px 12px', borderRight: '1px solid #000000', textAlign: 'right', fontWeight: 800 }}>
                              {round2(itemPrice)}
                            </td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 800 }}>
                              {formatCurrency(itemAmt, false)}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Yellow SUB TOTAL row under each voucher */}
                      <tr style={{ background: '#FFFF00', borderTop: '1px solid #000000', borderBottom: '2px solid #000000' }}>
                        <td
                          colSpan={5}
                          style={{
                            padding: '8px 14px',
                            fontWeight: 900,
                            fontSize: '0.92rem',
                            color: '#DC2626',
                            borderRight: '1px solid #000000',
                            letterSpacing: '0.04em'
                          }}
                        >
                          SUB TOTAL
                        </td>
                        <td
                          style={{
                            padding: '8px 14px',
                            textAlign: 'right',
                            fontWeight: 900,
                            fontSize: '1rem',
                            color: '#DC2626'
                          }}
                        >
                          {formatCurrency(billTotal, false)}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
