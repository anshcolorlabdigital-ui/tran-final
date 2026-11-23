import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { Supplier, SupplierLog, Purchase } from '../../types';
import { formatDateToDisplay, getTodayDateString } from '../../utils/dateUtils';
import { round2, formatCurrency } from '../../utils/calculations';
import {
  FileText,
  Printer,
  Download,
  PlusCircle,
  X,
  ArrowLeft,
  Trash2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SupplierPaymentModal } from '../common/SupplierPaymentModal';
import { SearchableSelect, SearchableSelectOption } from '../common/SearchableSelect';

export const SupplierLedgerReportView: React.FC = () => {
  const {
    refreshKey,
    selectedLedgerSupplierId,
    setSelectedLedgerSupplierId,
    showToast,
    showAlert
  } = useApp();

  const suppliers = useMemo(() => db.getSuppliers(), [refreshKey]);
  const purchases = useMemo(() => db.getPurchases(), [refreshKey]);

  // Mode: 'OUTSTANDING_LIST' (all suppliers table) or 'INDIVIDUAL_LEDGER' (single supplier details)
  const [viewMode, setViewMode] = useState<'OUTSTANDING_LIST' | 'INDIVIDUAL_LEDGER'>(() => {
    return selectedLedgerSupplierId ? 'INDIVIDUAL_LEDGER' : 'OUTSTANDING_LIST';
  });

  const [currentSupplierId, setCurrentSupplierId] = useState<string>(() => {
    if (selectedLedgerSupplierId && suppliers.some(s => s.id === selectedLedgerSupplierId)) {
      return selectedLedgerSupplierId;
    }
    return suppliers.length > 0 ? suppliers[0].id : '';
  });

  // Sync when selectedLedgerSupplierId changes from context
  useEffect(() => {
    if (selectedLedgerSupplierId && suppliers.some(s => s.id === selectedLedgerSupplierId)) {
      setCurrentSupplierId(selectedLedgerSupplierId);
      setViewMode('INDIVIDUAL_LEDGER');
    }
  }, [selectedLedgerSupplierId, suppliers]);

  // Date filters
  const [fromDate, setFromDate] = useState<string>('2026-11-01');
  const [toDate, setToDate] = useState<string>(getTodayDateString());
  const [isAllTime, setIsAllTime] = useState<boolean>(true);

  // Supplier Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);

  // Detailed Purchase Bill Modal State
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = useState<Purchase | null>(null);

  // Active supplier entity for individual ledger
  const activeSupplier = useMemo<Supplier | undefined>(() => {
    return suppliers.find(s => s.id === currentSupplierId);
  }, [suppliers, currentSupplierId]);

  // Individual ledger logs
  const rawLogs = useMemo<SupplierLog[]>(() => {
    if (!currentSupplierId) return [];
    return db.getSupplierLogsBySupplierId(currentSupplierId);
  }, [currentSupplierId, refreshKey]);

  // Financial summary for individual supplier
  const summary = useMemo(() => {
    if (!activeSupplier) {
      return {
        totalPurchased: 0,
        totalPaid: 0,
        openingBalance: 0,
        payableBalance: 0,
        logsCount: 0
      };
    }
    const balanceSummary = db.getSupplierBalanceSummary(activeSupplier.id);
    return {
      ...balanceSummary,
      openingBalance: Number(activeSupplier.openingBalance) || 0,
      logsCount: rawLogs.length
    };
  }, [activeSupplier, rawLogs, refreshKey]);

  // Filtered transactions for individual supplier
  const transactionLogs = useMemo<SupplierLog[]>(() => {
    if (!currentSupplierId || !activeSupplier) return [];
    const nonOpeningLogs = rawLogs.filter(l => l.type !== 'OPENING_BALANCE');
    if (isAllTime) {
      return nonOpeningLogs;
    }
    return nonOpeningLogs.filter(l => l.date >= fromDate && l.date <= toDate);
  }, [rawLogs, isAllTime, fromDate, toDate, currentSupplierId, activeSupplier]);

  // All suppliers data calculated for the SUPPLIER OUTSTANDING list view
  const supplierOutstandingRows = useMemo(() => {
    return suppliers.map(s => {
      const balSummary = db.getSupplierBalanceSummary(s.id);
      const sLogs = db.getSupplierLogs().filter(l => l.supplierId === s.id && l.type !== 'OPENING_BALANCE');
      
      let periodDebit = 0;
      let periodCredit = 0;

      sLogs.forEach(l => {
        if (isAllTime || (l.date >= fromDate && l.date <= toDate)) {
          if (l.type === 'PURCHASE') {
            periodDebit += Number(l.totalAmount) || 0;
            periodCredit += Number(l.paidAmount) || 0;
          } else if (l.type === 'PAYMENT') {
            periodCredit += Number(l.paidAmount) || 0;
          }
        }
      });

      const oppBal = Number(s.openingBalance) || 0;
      const netBalance = isAllTime ? (balSummary.payableBalance ?? 0) : round2(oppBal + periodDebit - periodCredit);

      return {
        supplier: s,
        gstin: s.gstin || '-',
        oppBalance: oppBal,
        debit: round2(periodDebit),
        credit: round2(periodCredit),
        balance: round2(netBalance)
      };
    });
  }, [suppliers, isAllTime, fromDate, toDate, refreshKey]);

  // Totals for SUPPLIER OUTSTANDING list view
  const outstandingTotals = useMemo(() => {
    let totalOpp = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let totalBal = 0;

    supplierOutstandingRows.forEach(r => {
      totalOpp += r.oppBalance;
      totalDebit += r.debit;
      totalCredit += r.credit;
      totalBal += r.balance;
    });

    return {
      oppBalance: round2(totalOpp),
      debit: round2(totalDebit),
      credit: round2(totalCredit),
      balance: round2(totalBal)
    };
  }, [supplierOutstandingRows]);

  // Supplier options for SearchableSelect
  const supplierOptions = useMemo<SearchableSelectOption[]>(() => {
    return suppliers.map(s => {
      const bal = db.getSupplierBalanceSummary(s.id).outstandingPayable;
      return {
        id: s.id,
        label: s.name,
        subLabel: `${s.city || ''} ${s.phone || ''}`.trim(),
        badge: bal > 0 ? `₹${bal}` : 'Settled',
        badgeBg: bal > 0 ? '#FEE2E2' : '#DCFCE7',
        badgeColor: bal > 0 ? '#991B1B' : '#166534'
      };
    });
  }, [suppliers, refreshKey]);

  // Quick preset filters
  const setQuickFilter = (type: 'ALL' | 'TODAY' | 'MONTH') => {
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
    }
  };

  // Open individual ledger for a supplier
  const handleOpenLedger = (supplierId: string) => {
    setCurrentSupplierId(supplierId);
    setSelectedLedgerSupplierId(supplierId);
    setViewMode('INDIVIDUAL_LEDGER');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenPurchaseDetail = (refNo?: string) => {
    if (!refNo) return;
    const purchase = purchases.find(
      p => p.billNo === refNo || p.id === refNo || (p.billNo && p.billNo.toLowerCase() === refNo.toLowerCase())
    );
    if (purchase) {
      setSelectedPurchaseDetail(purchase);
    } else {
      const orphanLog = transactionLogs.find(l => l.refNo === refNo);
      if (orphanLog && window.confirm(`Purchase invoice for "${refNo}" was not found in purchases.\n\nWould you like to remove this orphan entry from the ledger statement?`)) {
        db.deleteSupplierLog(orphanLog.id);
        showToast(`Orphan entry "${refNo}" deleted from ledger.`, 'success');
      } else {
        showAlert(`Purchase invoice detail for "${refNo}" not found.`, 'Purchase Bill Not Found', 'info');
      }
    }
  };

  const handleDeleteLog = (log: SupplierLog) => {
    const isPur = log.type === 'PURCHASE';
    const msg = isPur
      ? `Are you sure you want to delete purchase entry "${log.refNo || 'entry'}"? This will remove it from the statement.`
      : `Are you sure you want to delete payment entry "${log.refNo || 'entry'}" of ₹${log.paidAmount || 0}?`;
    if (window.confirm(msg)) {
      db.deleteSupplierLog(log.id);
      showToast(`Ledger entry ${log.refNo || ''} deleted successfully.`, 'success');
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (viewMode === 'OUTSTANDING_LIST') {
      const rows = supplierOutstandingRows.map((r, idx) => ({
        '#': idx + 1,
        'SUPPLIER': r.supplier.name,
        'GST NO.': r.gstin,
        'Opp. Balance': r.oppBalance,
        'Debit (Purchases)': r.debit,
        'Credit (Paid)': r.credit,
        'Balance (Payable)': r.balance
      }));
      rows.push({
        '#': 'Total' as any,
        'SUPPLIER': '',
        'GST NO.': '',
        'Opp. Balance': outstandingTotals.oppBalance,
        'Debit (Purchases)': outstandingTotals.debit,
        'Credit (Paid)': outstandingTotals.credit,
        'Balance (Payable)': outstandingTotals.balance
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Supplier Outstanding');
      XLSX.writeFile(wb, `Supplier_Outstanding_${getTodayDateString()}.xlsx`);
      showToast('Supplier outstanding list exported to Excel!', 'success');
    } else {
      if (!activeSupplier) return;
      const exportRows: Record<string, any>[] = [
        {
          'Date': '',
          'Bill No.': 'OPP. BALANCE',
          'Debit (Billed ₹)': '',
          'Credit (Paid ₹)': '',
          'Balance (₹)': summary.openingBalance,
          'Mode': '',
          'Remarks': 'Opening Balance'
        }
      ];

      transactionLogs.forEach(log => {
        exportRows.push({
          'Date': formatDateToDisplay(log.date),
          'Bill No.': log.refNo || '-',
          'Debit (Billed ₹)': log.totalAmount || '',
          'Credit (Paid ₹)': log.paidAmount || '',
          'Balance (₹)': log.runningBalance !== undefined ? log.runningBalance : log.balanceChange,
          'Mode': log.paymentMode || '',
          'Remarks': log.notes || ''
        });
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Supplier Ledger');
      XLSX.writeFile(wb, `Supplier_Ledger_${activeSupplier.name.replace(/\s+/g, '_')}_${getTodayDateString()}.xlsx`);
      showToast('Supplier statement ledger exported to Excel!', 'success');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="supplier-ledger-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* TOP HEADER & ACTION BAR matching mockup */}
      <div
        style={{
          background: '#FFFFFF',
          border: '2px solid #000000',
          borderRadius: '10px',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {viewMode === 'INDIVIDUAL_LEDGER' && (
              <button
                type="button"
                onClick={() => setViewMode('OUTSTANDING_LIST')}
                style={{
                  background: '#F1F5F9',
                  border: '1.5px solid #000000',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 800,
                  fontSize: '0.82rem'
                }}
                title="Back to Outstanding List"
              >
                <ArrowLeft size={16} />
                <span>All Outstanding</span>
              </button>
            )}
            <div
              style={{
                background: '#002B99',
                color: '#FFFFFF',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.35rem', color: '#002B99', letterSpacing: '-0.3px' }}>
                {viewMode === 'OUTSTANDING_LIST' ? 'SUPPLIER OUTSTANDING' : 'SUPPLIER LEDGER'}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              style={{
                background: '#DC2626',
                color: '#FFFFFF',
                border: '1.5px solid #000000',
                fontWeight: 900,
                fontSize: '0.85rem',
                padding: '7px 14px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <PlusCircle size={16} />
              <span>Pay Supplier</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              style={{
                background: '#FFFFFF',
                color: '#000000',
                border: '1.5px solid #000000',
                fontWeight: 800,
                fontSize: '0.85rem',
                padding: '7px 12px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Download size={15} />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              style={{
                background: '#FFFFFF',
                color: '#000000',
                border: '1.5px solid #000000',
                fontWeight: 800,
                fontSize: '0.85rem',
                padding: '7px 12px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Printer size={15} />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Date Filter Bar matching mockup */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            paddingTop: '6px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontWeight: 800, fontSize: '0.78rem', color: '#4B5563' }}>From Date</label>
            <input
              type="date"
              className="input-text-clean"
              disabled={isAllTime}
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setIsAllTime(false); }}
              style={{ opacity: isAllTime ? 0.5 : 1, width: '140px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontWeight: 800, fontSize: '0.78rem', color: '#4B5563' }}>To Date</label>
            <input
              type="date"
              className="input-text-clean"
              disabled={isAllTime}
              value={toDate}
              onChange={e => { setToDate(e.target.value); setIsAllTime(false); }}
              style={{ opacity: isAllTime ? 0.5 : 1, width: '140px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setQuickFilter('ALL')}
              style={{
                padding: '5px 12px',
                fontSize: '0.75rem',
                fontWeight: 900,
                borderRadius: '4px',
                border: '1.5px solid #000000',
                background: isAllTime ? '#002B99' : '#FFFFFF',
                color: isAllTime ? '#FFFFFF' : '#000000',
                cursor: 'pointer'
              }}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('MONTH')}
              style={{
                padding: '5px 12px',
                fontSize: '0.75rem',
                fontWeight: 900,
                borderRadius: '4px',
                border: '1.5px solid #000000',
                background: !isAllTime ? '#002B99' : '#FFFFFF',
                color: !isAllTime ? '#FFFFFF' : '#000000',
                cursor: 'pointer'
              }}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('TODAY')}
              style={{
                padding: '5px 12px',
                fontSize: '0.75rem',
                fontWeight: 900,
                borderRadius: '4px',
                border: '1.5px solid #000000',
                background: '#FFFFFF',
                color: '#000000',
                cursor: 'pointer'
              }}
            >
              Today
            </button>
          </div>

          {viewMode === 'INDIVIDUAL_LEDGER' && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', minWidth: '300px' }}>
              <label style={{ fontWeight: 800, fontSize: '0.78rem', color: '#4B5563', whiteSpace: 'nowrap' }}>Switch Vendor:</label>
              <div style={{ flex: 1 }}>
                <SearchableSelect
                  options={supplierOptions}
                  value={currentSupplierId}
                  onChange={val => {
                    if (val) {
                      setCurrentSupplierId(val);
                      setSelectedLedgerSupplierId(val);
                    }
                  }}
                  placeholder="Search vendor / supplier..."
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: SUPPLIER OUTSTANDING (Main view matching Image 2 mockup)          */}
      {/* ========================================================================= */}
      {viewMode === 'OUTSTANDING_LIST' && (
        <>
          {/* TOTAL OUTSTANDING PINK BANNER matching mockup */}
          <div
            style={{
              background: '#F5A3E0',
              border: '2px solid #000000',
              borderRadius: '6px',
              padding: '6px',
              textAlign: 'center'
            }}
          >
            <span
              style={{
                background: '#DC2626',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '1.1rem',
                padding: '4px 18px',
                borderRadius: '2px',
                letterSpacing: '0.04em'
              }}
            >
              TOTAL OUTSTANDING
            </span>
          </div>

          {/* Centered Total Box matching mockup */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
            <div
              style={{
                background: '#FFFFFF',
                border: '2px solid #000000',
                borderRadius: '8px',
                padding: '8px 36px',
                minWidth: '220px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#000000', fontFamily: 'monospace' }}>
                {outstandingTotals.balance}
              </div>
            </div>
          </div>

          {/* Outstanding Table with Lavender Header #D4C4FB matching mockup */}
          <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '4px', overflow: 'hidden' }}>
            <div className="table-responsive-wrapper">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                <thead>
                  <tr style={{ background: '#D4C4FB', borderBottom: '2px solid #000000' }}>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900, fontSize: '1rem', color: '#002B99', width: '280px' }}>
                      SUPPLIER
                    </th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900, fontSize: '0.92rem', width: '160px' }}>
                      GST NO.
                    </th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900, fontSize: '0.92rem', width: '130px' }}>
                      Opp. Balance
                    </th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900, fontSize: '0.92rem', width: '120px' }}>
                      Debit
                    </th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900, fontSize: '0.92rem', width: '120px' }}>
                      Crebit
                    </th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900, fontSize: '0.95rem', width: '130px' }}>
                      Balance
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 900, fontSize: '0.92rem', width: '110px' }}>
                      ACTION
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {supplierOutstandingRows.map((r) => (
                    <tr
                      key={r.supplier.id}
                      style={{
                        borderBottom: '1px solid #000000',
                        background: '#FFFFFF',
                        height: '38px'
                      }}
                    >
                      <td style={{ padding: '8px 12px', borderRight: '1px solid #000000', textAlign: 'left', fontWeight: 900, color: '#002B99' }}>
                        {r.supplier.name}
                      </td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 800, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {r.gstin}
                      </td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 800 }}>
                        {r.oppBalance || ''}
                      </td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 800 }}>
                        {r.debit || ''}
                      </td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 800 }}>
                        {r.credit || ''}
                      </td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900 }}>
                        {r.balance}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenLedger(r.supplier.id)}
                          style={{
                            background: '#FFFFFF',
                            color: '#002B99',
                            border: '1px solid #000000',
                            borderRadius: '4px',
                            padding: '3px 14px',
                            fontWeight: 900,
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          LEDGER
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Empty rows padding */}
                  {Array.from({ length: Math.max(0, 8 - supplierOutstandingRows.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #000000', height: '34px' }}>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#FFFFFF', borderTop: '2px solid #000000', height: '42px' }}>
                    <td
                      colSpan={2}
                      style={{
                        padding: '8px 14px',
                        fontWeight: 900,
                        fontSize: '1.15rem',
                        textAlign: 'center',
                        borderRight: '1px solid #000000'
                      }}
                    >
                      Total
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 900, fontSize: '1.05rem', borderRight: '1px solid #000000' }}>
                      {outstandingTotals.oppBalance}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 900, fontSize: '1.05rem', borderRight: '1px solid #000000' }}>
                      {outstandingTotals.debit}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 900, fontSize: '1.05rem', borderRight: '1px solid #000000' }}>
                      {outstandingTotals.credit}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 900, fontSize: '1.1rem', borderRight: '1px solid #000000' }}>
                      {outstandingTotals.balance}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: INDIVIDUAL SUPPLIER LEDGER STATEMENT                              */}
      {/* ========================================================================= */}
      {viewMode === 'INDIVIDUAL_LEDGER' && (
        <>
          {/* Magenta Banner */}
          <div
            style={{
              background: '#F5A3E0',
              border: '2px solid #000000',
              borderRadius: '8px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span
              style={{
                fontWeight: 900,
                fontSize: '1.25rem',
                color: '#000000',
                letterSpacing: '0.02em',
                textTransform: 'uppercase'
              }}
            >
              {activeSupplier?.name || 'SELECT SUPPLIER'}
            </span>
            <button
              type="button"
              onClick={() => setViewMode('OUTSTANDING_LIST')}
              style={{
                background: '#FFFFFF',
                color: '#000000',
                border: '1.5px solid #000000',
                borderRadius: '4px',
                padding: '3px 10px',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              ← Back to Outstanding
            </button>
          </div>

          {/* 4 KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px'
            }}
          >
            <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ display: 'inline-block', background: '#DC2626', color: '#FFFFFF', fontSize: '0.72rem', fontWeight: 900, padding: '2px 8px', borderRadius: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
                SUPPLIER OPP. BALANCE
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#000000' }}>{summary.openingBalance}</div>
            </div>

            <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ display: 'inline-block', background: '#DC2626', color: '#FFFFFF', fontSize: '0.72rem', fontWeight: 900, padding: '2px 8px', borderRadius: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
                TOTAL PURCHASES
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#000000' }}>{summary.totalPurchased}</div>
            </div>

            <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ display: 'inline-block', background: '#DC2626', color: '#FFFFFF', fontSize: '0.72rem', fontWeight: 900, padding: '2px 8px', borderRadius: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
                TOTAL PAID TO SUPPLIER
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#000000' }}>{summary.totalPaid}</div>
            </div>

            <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '8px', padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ display: 'inline-block', background: '#DC2626', color: '#FFFFFF', fontSize: '0.72rem', fontWeight: 900, padding: '2px 8px', borderRadius: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>
                NET PAYBLE BALANCE
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#000000' }}>{summary.payableBalance}</div>
            </div>
          </div>

          {/* Statement Table */}
          <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '10px', overflow: 'hidden' }}>
            <div className="table-responsive-wrapper">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                <thead>
                  <tr style={{ background: '#D4C4FB', borderBottom: '2px solid #000000' }}>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', width: '130px', fontWeight: 900, fontSize: '0.95rem' }}>Date</th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', width: '150px', fontWeight: 900, fontSize: '0.95rem' }}>Bill No.</th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', width: '140px', fontWeight: 900, fontSize: '0.95rem', color: '#002B99' }}>Debit (Billed ₹)</th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', width: '140px', fontWeight: 900, fontSize: '0.95rem', color: '#16A34A' }}>Credit (Paid ₹)</th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', width: '150px', fontWeight: 900, fontSize: '0.95rem', color: '#DC2626' }}>Balance (₹)</th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', width: '100px', fontWeight: 900, fontSize: '0.95rem' }}>Mode</th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.95rem', textAlign: 'left' }}>Remarks</th>
                    <th style={{ padding: '10px 8px', width: '70px', fontWeight: 900, fontSize: '0.95rem', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: OPP. BALANCE */}
                  <tr style={{ background: '#CFF4FC', borderBottom: '1px solid #000000', height: '48px' }}>
                    <td style={{ borderRight: '1px solid #000000' }}></td>
                    <td style={{ borderRight: '1px solid #000000' }}></td>
                    <td style={{ borderRight: '1px solid #000000' }}></td>
                    <td style={{ borderRight: '1px solid #000000' }}></td>
                    <td style={{ borderRight: '1px solid #000000', padding: '6px 10px', lineHeight: 1.2 }}>
                      <div style={{ fontWeight: 900, fontSize: '0.85rem' }}>OPP. BALACE</div>
                      <div style={{ fontWeight: 900, fontSize: '1rem' }}>{summary.openingBalance}</div>
                    </td>
                    <td style={{ borderRight: '1px solid #000000' }}></td>
                    <td style={{ borderRight: '1px solid #000000' }}></td>
                    <td></td>
                  </tr>

                  {transactionLogs.map(log => {
                    const isPurchase = log.type === 'PURCHASE';
                    const displayBalance = log.runningBalance !== undefined ? log.runningBalance : log.balanceChange;
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid #000000', background: '#FFFFFF', height: '38px' }}>
                        <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 800 }}>
                          {formatDateToDisplay(log.date)}
                        </td>
                        <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 800 }}>
                          {isPurchase ? (
                            <button
                              type="button"
                              onClick={() => handleOpenPurchaseDetail(log.refNo)}
                              style={{ background: 'transparent', border: 'none', color: '#000000', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              {log.refNo}
                            </button>
                          ) : (
                            <span>{log.refNo || '-'}</span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 800 }}>
                          {log.totalAmount ? round2(log.totalAmount) : ''}
                        </td>
                        <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 800 }}>
                          {log.paidAmount ? round2(log.paidAmount) : ''}
                        </td>
                        <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 800 }}>
                          {round2(displayBalance)}
                        </td>
                        <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 800 }}>
                          {log.paymentMode || ''}
                        </td>
                        <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', textAlign: 'left', fontWeight: 700 }}>
                          {log.notes || ''}
                        </td>
                        <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteLog(log)}
                            title="Delete Ledger Entry"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#DC2626',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '4px'
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#FFFFFF', borderTop: '2px solid #000000', height: '42px' }}>
                    <td colSpan={2} style={{ padding: '8px 12px', fontWeight: 900, fontSize: '1.1rem', textAlign: 'center', borderRight: '1px solid #000000' }}>
                      Total
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 900, fontSize: '1rem', borderRight: '1px solid #000000' }}>
                      {summary.totalPurchased}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 900, fontSize: '1rem', borderRight: '1px solid #000000' }}>
                      {summary.totalPaid}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 900, fontSize: '1rem', borderRight: '1px solid #000000' }}>
                      {summary.payableBalance}
                    </td>
                    <td style={{ borderRight: '1px solid #000000' }}></td>
                    <td style={{ borderRight: '1px solid #000000' }}></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Payment Modal */}
      <SupplierPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        initialSupplierId={activeSupplier?.id}
      />

      {/* Detailed Purchase Bill Modal */}
      {selectedPurchaseDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #000000',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                background: '#D4C4FB',
                padding: '12px 18px',
                borderBottom: '2px solid #000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>
                Purchase Invoice: {selectedPurchaseDetail.billNo} ({formatDateToDisplay(selectedPurchaseDetail.billDate)})
              </div>
              <button
                onClick={() => setSelectedPurchaseDetail(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '16px', overflowY: 'auto' }}>
              <div style={{ marginBottom: '12px', fontWeight: 800 }}>
                Supplier: {selectedPurchaseDetail.supplierName}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#ECECEC', borderBottom: '1px solid #000000' }}>
                    <th style={{ padding: '8px' }}>Item</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Basic Rate</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurchaseDetail.items.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '8px', fontWeight: 700 }}>{it.itemName}</td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 800 }}>{it.qty}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>₹{it.purchaseRate}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800 }}>₹{it.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ textAlign: 'right', marginTop: '16px', fontWeight: 900, fontSize: '1.1rem' }}>
                Total Bill Amount: ₹{selectedPurchaseDetail.billTotal}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
