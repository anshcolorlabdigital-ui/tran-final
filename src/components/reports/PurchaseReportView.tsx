import React, { useState, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { formatDateToDisplay, getTodayDateString } from '../../utils/dateUtils';
import { formatCurrency, round2 } from '../../utils/calculations';
import { Download, Printer } from 'lucide-react';
import { SearchableSelect, SearchableSelectOption } from '../common/SearchableSelect';

export const PurchaseReportView: React.FC = () => {
  const { refreshKey, openSupplierLedger } = useApp();

  const purchases = useMemo(() => db.getPurchases(), [refreshKey]);
  const suppliers = useMemo(() => db.getSuppliers(), [refreshKey]);
  const items = useMemo(() => db.getItems(), [refreshKey]);

  const supplierOptions = useMemo<SearchableSelectOption[]>(() => {
    return [
      { id: '', label: 'All Suppliers' },
      ...suppliers.map(s => ({
        id: s.id,
        label: s.name,
        subLabel: `${s.city || ''} ${s.phone || ''}`.trim()
      }))
    ];
  }, [suppliers]);

  const itemOptions = useMemo<SearchableSelectOption[]>(() => {
    return [
      { id: '', label: 'All Items' },
      ...items.map(i => ({
        id: i.id,
        label: i.name,
        subLabel: i.category || ''
      }))
    ];
  }, [items]);

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
      totalQty: round2(totalQty),
      totalBasic: round2(totalBasic),
      totalGst: round2(totalGst),
      totalBillAmount: round2(totalBillAmount)
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
      `"${p.items.map(i => `${i.itemName} (${round2(i.qty)})`).join(', ')}"`,
      round2(p.items.reduce((a, b) => a + (Number(b.qty) || 0), 0)),
      round2(p.basicTotal),
      round2(p.gstTotal),
      round2(p.billTotal)
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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="content-panel-grey" style={{ position: 'relative' }}>
      {/* Top Header matching mockup */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div className="pill-header-lime" style={{ padding: '8px 28px', fontSize: '1.2rem', fontWeight: 900 }}>
          PURCHASE REPORT
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
            Export Excel (.xlsx)
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
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxWidth: '560px',
          margin: '0 auto 20px'
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '4px' }}>Supplier</label>
            <SearchableSelect
              options={supplierOptions}
              value={selectedSupplierId}
              onChange={val => setSelectedSupplierId(val)}
              placeholder="All Suppliers / Search..."
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.8rem', marginBottom: '4px' }}>Item</label>
            <SearchableSelect
              options={itemOptions}
              value={selectedItemId}
              onChange={val => setSelectedItemId(val)}
              placeholder="All Items / Search..."
            />
          </div>
        </div>
      </div>

      {/* 3 KPI Cards matching mockup */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '20px'
        }}
      >
        <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
          <span style={{ background: '#DC2626', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 900, padding: '2px 10px', borderRadius: '2px', display: 'inline-block', marginBottom: '6px' }}>
            INWARD VALUE
          </span>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#000000' }}>
            {totals.totalBasic}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
          <span style={{ background: '#DC2626', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 900, padding: '2px 10px', borderRadius: '2px', display: 'inline-block', marginBottom: '6px' }}>
            GST VALUE
          </span>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#000000' }}>
            {totals.totalGst}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
          <span style={{ background: '#DC2626', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 900, padding: '2px 10px', borderRadius: '2px', display: 'inline-block', marginBottom: '6px' }}>
            TOTAL INWARD VALUE
          </span>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#000000' }}>
            {totals.totalBillAmount}
          </div>
        </div>
      </div>

      {/* Report Table matching mockup with Voucher Grouping and Yellow Subtotals */}
      <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '10px', overflow: 'hidden' }}>
        <div className="table-responsive-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#D4C4FB', borderBottom: '2px solid #000000' }}>
                <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', width: '90px', fontWeight: 900, fontSize: '0.85rem' }}>DATE</th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', width: '100px', fontWeight: 900, fontSize: '0.85rem' }}>BILL NO</th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', width: '140px', fontWeight: 900, fontSize: '0.85rem' }}>SUPPLIER</th>
                <th style={{ padding: '8px 12px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.85rem' }}>Items Used In-House</th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', width: '110px', fontWeight: 900, fontSize: '0.85rem' }}>DESCRIPTION</th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', width: '60px', textAlign: 'center', fontWeight: 900, fontSize: '0.85rem' }}>Qty</th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', width: '80px', textAlign: 'right', fontWeight: 900, fontSize: '0.85rem' }}>BASIC PRICE</th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', width: '70px', textAlign: 'right', fontWeight: 900, fontSize: '0.85rem' }}>GST</th>
                <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', width: '80px', textAlign: 'right', fontWeight: 900, fontSize: '0.85rem' }}>PRICE</th>
                <th style={{ padding: '8px 12px', width: '110px', textAlign: 'right', fontWeight: 900, fontSize: '0.85rem' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '36px', color: '#9CA3AF', fontWeight: 700 }}>
                    No purchase inward transactions match the specified filter criteria.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map(p => {
                  const billTotal = Number(p.billTotal) || 0;
                  return (
                    <React.Fragment key={p.id}>
                      {p.items.map((item, idx) => {
                        const basicRate = item.purchaseRate || item.basicPrice || (item.qty ? round2(item.amount / item.qty) : 0);
                        const gstVal = item.gstAmt || (item.gstPercent && basicRate ? round2(basicRate * (item.gstPercent / 100)) : 0);
                        const nettRate = item.nettPrice || round2(basicRate + gstVal);
                        const itemAmt = item.amount || round2(item.qty * (nettRate || basicRate));

                        return (
                          <tr key={`${p.id}-${idx}`} style={{ borderBottom: '1px solid #000000', background: '#FFFFFF' }}>
                            {idx === 0 ? (
                              <>
                                <td
                                  rowSpan={p.items.length}
                                  style={{ padding: '8px 10px', borderRight: '1px solid #000000', verticalAlign: 'top', fontWeight: 700, fontSize: '0.82rem' }}
                                >
                                  {formatDateToDisplay(p.billDate)}
                                </td>
                                <td
                                  rowSpan={p.items.length}
                                  style={{ padding: '8px 10px', borderRight: '1px solid #000000', verticalAlign: 'top', fontWeight: 900, fontFamily: 'monospace', fontSize: '0.85rem' }}
                                >
                                  {p.billNo}
                                </td>
                                <td
                                  rowSpan={p.items.length}
                                  style={{ padding: '8px 10px', borderRight: '1px solid #000000', verticalAlign: 'top', fontWeight: 800, fontSize: '0.82rem' }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => openSupplierLedger(p.supplierId)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#000000',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      padding: 0,
                                      textAlign: 'left'
                                    }}
                                  >
                                    {p.supplierName}
                                  </button>
                                </td>
                              </>
                            ) : null}

                            <td style={{ padding: '6px 12px', borderRight: '1px solid #000000', fontWeight: 700, fontSize: '0.82rem' }}>
                              {item.itemName}
                            </td>
                            <td style={{ padding: '6px 10px', borderRight: '1px solid #000000', fontSize: '0.8rem', color: '#4B5563' }}>
                              {(item as any).description || (item as any).category || ''}
                            </td>
                            <td style={{ padding: '6px 10px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900, fontSize: '0.85rem' }}>
                              {round2(item.qty)}
                            </td>
                            <td style={{ padding: '6px 10px', borderRight: '1px solid #000000', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem' }}>
                              {round2(basicRate)}
                            </td>
                            <td style={{ padding: '6px 10px', borderRight: '1px solid #000000', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem' }}>
                              {round2(gstVal)}
                            </td>
                            <td style={{ padding: '6px 10px', borderRight: '1px solid #000000', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem' }}>
                              {round2(nettRate)}
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 800, fontSize: '0.85rem' }}>
                              {formatCurrency(itemAmt, false)}
                            </td>
                          </tr>
                        );
                      })}

                      {/* SUB TOTAL (Yellow Row) matching mockup */}
                      <tr style={{ background: '#FFFF00', borderTop: '1px solid #000000', borderBottom: '2px solid #000000' }}>
                        <td colSpan={9} style={{ padding: '6px 14px', textAlign: 'left', fontWeight: 900, fontSize: '0.85rem', color: '#DC2626', borderRight: '1px solid #000000' }}>
                          SUB TOTAL
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 900, fontSize: '0.95rem', color: '#DC2626' }}>
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

      {/* Floating TOP button matching mockup */}
      <div
        onClick={scrollToTop}
        style={{
          position: 'fixed',
          right: '24px',
          bottom: '50%',
          transform: 'translateY(50%)',
          background: '#FFFFFF',
          border: '1.5px solid #000000',
          padding: '8px 12px',
          clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
          width: '54px',
          height: '54px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontWeight: 900,
          fontSize: '0.8rem',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          zIndex: 99
        }}
        title="Scroll to Top"
      >
        TOP
      </div>
    </div>
  );
};
