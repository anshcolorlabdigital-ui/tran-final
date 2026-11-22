import React, { useState, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { formatDateToDisplay, getTodayDateString } from '../../utils/dateUtils';
import { formatCurrency, round2 } from '../../utils/calculations';
import { Download, Printer } from 'lucide-react';

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
    let totalCredit = 0;

    filteredSales.forEach(s => {
      totalBasic += Number(s.basicTotal) || 0;
      totalGst += Number(s.gstTotal) || 0;
      const bTotal = Number(s.billTotal) || 0;
      totalBillAmount += bTotal;
      const c = Number(s.recdCash) || 0;
      const u = Number(s.recdUpi) || 0;
      totalCash += c;
      totalUpi += u;
      totalCredit += Math.max(0, bTotal - c - u);
      s.items.forEach(i => {
        totalQty += Number(i.qty) || 0;
      });
    });

    return {
      count: filteredSales.length,
      totalQty: round2(totalQty),
      totalBasic: round2(totalBasic),
      totalGst: round2(totalGst),
      totalBillAmount: round2(totalBillAmount),
      totalCash: round2(totalCash),
      totalUpi: round2(totalUpi),
      totalCredit: round2(totalCredit)
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
      `"${s.items.map(i => `${i.itemName} (${round2(i.qty)})`).join(', ')}"`,
      round2(s.items.reduce((a, b) => a + (Number(b.qty) || 0), 0)),
      round2(s.basicTotal),
      round2(s.gstTotal),
      round2(s.billTotal),
      round2(s.recdCash),
      round2(s.recdUpi)
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div className="pill-header-lime" style={{ padding: '8px 28px', fontSize: '1.2rem', fontWeight: 900 }}>
          SALES REPORT
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

      {/* Filter Bar matching mockup */}
      <div
        style={{
          background: '#FFFFFF',
          border: '2px solid #000000',
          borderRadius: '10px',
          padding: '14px 18px',
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
          <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '4px' }}>Party</label>
          <select
            className="input-text-clean"
            value={selectedPartyId}
            onChange={e => setSelectedPartyId(e.target.value)}
            style={{ width: '100%' }}
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

        <div>
          <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '4px' }}>Payment Mode</label>
          <select
            className="input-text-clean"
            value={paymentMode}
            onChange={e => setPaymentMode(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="ALL">All Payments</option>
            <option value="CASH">Cash Sales</option>
            <option value="ONLINE">UPI / Online Sales</option>
          </select>
        </div>
      </div>

      {/* 4 KPI Cards matching mockup */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '20px'
        }}
      >
        <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '10px 14px' }}>
          <span style={{ background: '#DC2626', color: '#FFFFFF', fontSize: '0.72rem', fontWeight: 900, padding: '2px 8px', borderRadius: '2px', display: 'inline-block', marginBottom: '4px' }}>
            RECD CASH
          </span>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#15803D' }}>₹ {totals.totalCash}</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '10px 14px' }}>
          <span style={{ background: '#DC2626', color: '#FFFFFF', fontSize: '0.72rem', fontWeight: 900, padding: '2px 8px', borderRadius: '2px', display: 'inline-block', marginBottom: '4px' }}>
            RECD ONLINE / UPI
          </span>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#2563EB' }}>₹ {totals.totalUpi}</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '10px 14px' }}>
          <span style={{ background: '#DC2626', color: '#FFFFFF', fontSize: '0.72rem', fontWeight: 900, padding: '2px 8px', borderRadius: '2px', display: 'inline-block', marginBottom: '4px' }}>
            Credit sale
          </span>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#2563EB' }}>₹ {totals.totalCredit}</div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '10px 14px' }}>
          <span style={{ background: '#DC2626', color: '#FFFFFF', fontSize: '0.72rem', fontWeight: 900, padding: '2px 8px', borderRadius: '2px', display: 'inline-block', marginBottom: '4px' }}>
            TOTAL SALE VALUE
          </span>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#DC2626' }}>₹ {totals.totalBillAmount}</div>
        </div>
      </div>

      {/* Grouped Report Table matching mockup */}
      <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '10px', overflow: 'hidden' }}>
        <div className="table-responsive-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#D4C4FB', borderBottom: '2px solid #000000' }}>
                <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', width: '90px', fontWeight: 900, fontSize: '0.85rem' }}>DATE</th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', width: '110px', fontWeight: 900, fontSize: '0.85rem' }}>BILL NO</th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', width: '130px', fontWeight: 900, fontSize: '0.85rem' }}>PARTY</th>
                <th style={{ padding: '8px 12px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.85rem' }}>Items Used In-House</th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', width: '110px', fontWeight: 900, fontSize: '0.85rem' }}>DESCRIPTION</th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', width: '60px', textAlign: 'center', fontWeight: 900, fontSize: '0.85rem' }}>Qty</th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', width: '90px', textAlign: 'right', fontWeight: 900, fontSize: '0.85rem' }}>SALE PRICE</th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', width: '80px', textAlign: 'right', fontWeight: 900, fontSize: '0.85rem' }}>CASH</th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', width: '80px', textAlign: 'right', fontWeight: 900, fontSize: '0.85rem' }}>CREDIT</th>
                <th style={{ padding: '8px 12px', width: '110px', textAlign: 'right', fontWeight: 900, fontSize: '0.85rem' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '36px', color: '#9CA3AF', fontWeight: 700 }}>
                    No sales transactions match the specified filter criteria.
                  </td>
                </tr>
              ) : (
                filteredSales.map(s => {
                  const billTotal = Number(s.billTotal) || 0;
                  const cashVal = Number(s.recdCash) || 0;
                  const upiVal = Number(s.recdUpi) || 0;
                  const creditVal = Math.max(0, billTotal - cashVal - upiVal);
                  const roundUpVal = Number(s.roundUp) || 0;
                  const balanceVal = Number(s.balanceDue ?? 0);

                  return (
                    <React.Fragment key={s.id}>
                      {/* Line items of the bill */}
                      {s.items.map((item, idx) => {
                        const itemRate = item.salePrice || (item.qty ? round2(item.amount / item.qty) : 0);
                        const itemAmt = item.amount || round2(item.qty * itemRate);
                        const itemRatio = billTotal > 0 ? itemAmt / billTotal : 0;
                        const itemCash = cashVal > 0 ? round2(cashVal * itemRatio) : '';
                        const itemCredit = creditVal > 0 ? round2(creditVal * itemRatio) : '';

                        return (
                          <tr key={`${s.id}-${idx}`} style={{ borderBottom: '1px solid #000000', background: '#FFFFFF' }}>
                            {idx === 0 ? (
                              <>
                                <td
                                  rowSpan={s.items.length}
                                  style={{ padding: '8px 10px', borderRight: '1px solid #000000', verticalAlign: 'top', fontWeight: 700, fontSize: '0.82rem' }}
                                >
                                  {formatDateToDisplay(s.billDate)}
                                </td>
                                <td
                                  rowSpan={s.items.length}
                                  style={{ padding: '8px 10px', borderRight: '1px solid #000000', verticalAlign: 'top', fontWeight: 900, fontFamily: 'monospace', fontSize: '0.85rem' }}
                                >
                                  {s.billNo}
                                </td>
                                <td
                                  rowSpan={s.items.length}
                                  style={{ padding: '8px 10px', borderRight: '1px solid #000000', verticalAlign: 'top', fontWeight: 800, fontSize: '0.82rem' }}
                                >
                                  {s.partyName}
                                </td>
                              </>
                            ) : null}

                            <td style={{ padding: '6px 12px', borderRight: '1px solid #000000', fontWeight: 700, fontSize: '0.82rem' }}>
                              {item.itemName}
                            </td>
                            <td style={{ padding: '6px 10px', borderRight: '1px solid #000000', fontSize: '0.8rem', color: '#4B5563' }}>
                              {(item as any).description || item.category || ''}
                            </td>
                            <td style={{ padding: '6px 10px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900, fontSize: '0.85rem' }}>
                              {round2(item.qty)}
                            </td>
                            <td style={{ padding: '6px 10px', borderRight: '1px solid #000000', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem' }}>
                              {round2(itemRate)}
                            </td>
                            <td style={{ padding: '6px 10px', borderRight: '1px solid #000000', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem' }}>
                              {itemCash}
                            </td>
                            <td style={{ padding: '6px 10px', borderRight: '1px solid #000000', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem' }}>
                              {itemCredit}
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 800, fontSize: '0.85rem' }}>
                              {formatCurrency(itemAmt, false)}
                            </td>
                          </tr>
                        );
                      })}

                      {/* BILL TOTAL (Yellow Row) */}
                      <tr style={{ background: '#FFFF00', borderTop: '1px solid #000000', borderBottom: '1px solid #000000' }}>
                        <td colSpan={9} style={{ padding: '6px 14px', textAlign: 'right', fontWeight: 900, fontSize: '0.85rem', borderRight: '1px solid #000000' }}>
                          BILL TOTAL
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 900, fontSize: '0.92rem' }}>
                          {formatCurrency(billTotal, false)}
                        </td>
                      </tr>

                      {/* RECD. CASH */}
                      <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #000000' }}>
                        <td colSpan={9} style={{ padding: '4px 14px', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem', borderRight: '1px solid #000000' }}>
                          RECD. CASH
                        </td>
                        <td style={{ padding: '4px 12px', textAlign: 'right', fontWeight: 800, fontSize: '0.85rem' }}>
                          {cashVal}
                        </td>
                      </tr>

                      {/* RECD. UPI */}
                      <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #000000' }}>
                        <td colSpan={9} style={{ padding: '4px 14px', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem', borderRight: '1px solid #000000' }}>
                          RECD. UPI
                        </td>
                        <td style={{ padding: '4px 12px', textAlign: 'right', fontWeight: 800, fontSize: '0.85rem' }}>
                          {upiVal}
                        </td>
                      </tr>

                      {/* CREDIT SALE */}
                      <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #000000' }}>
                        <td colSpan={9} style={{ padding: '4px 14px', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem', borderRight: '1px solid #000000' }}>
                          CREDIT SALE
                        </td>
                        <td style={{ padding: '4px 12px', textAlign: 'right', fontWeight: 800, fontSize: '0.85rem' }}>
                          {creditVal}
                        </td>
                      </tr>

                      {/* ROUND UP */}
                      <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #000000' }}>
                        <td colSpan={9} style={{ padding: '4px 14px', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem', borderRight: '1px solid #000000' }}>
                          ROUND UP
                        </td>
                        <td style={{ padding: '4px 12px', textAlign: 'right', fontWeight: 800, fontSize: '0.85rem' }}>
                          {roundUpVal}
                        </td>
                      </tr>

                      {/* BALANCE (Yellow Row) */}
                      <tr style={{ background: '#FFFF00', borderBottom: '1px solid #000000' }}>
                        <td colSpan={9} style={{ padding: '4px 14px', textAlign: 'right', fontWeight: 900, fontSize: '0.85rem', borderRight: '1px solid #000000' }}>
                          BALANCE
                        </td>
                        <td style={{ padding: '4px 12px', textAlign: 'right', fontWeight: 900, fontSize: '0.88rem' }}>
                          {balanceVal.toFixed(2)}
                        </td>
                      </tr>

                      {/* Thick Purple Divider Row between bills matching mockup */}
                      <tr style={{ background: '#9333EA', height: '14px' }}>
                        <td colSpan={10} style={{ padding: '0', height: '14px', border: 'none' }}></td>
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
