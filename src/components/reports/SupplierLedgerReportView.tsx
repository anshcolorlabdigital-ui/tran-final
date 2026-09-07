import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { Supplier, SupplierLog, Purchase } from '../../types';
import { formatDateToDisplay, getTodayDateString } from '../../utils/dateUtils';
import {
  FileText,
  Search,
  Printer,
  Download,
  Calendar,
  DollarSign,
  PlusCircle,
  X,
  CreditCard,
  Building2,
  ArrowRight,
  ExternalLink,
  Receipt,
  CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SupplierPaymentModal } from '../common/SupplierPaymentModal';

export const SupplierLedgerReportView: React.FC = () => {
  const {
    refreshKey,
    selectedLedgerSupplierId,
    setSelectedLedgerSupplierId,
    showToast,
    showAlert,
    setActiveTab
  } = useApp();

  const suppliers = useMemo(() => db.getSuppliers(), [refreshKey]);
  const purchases = useMemo(() => db.getPurchases(), [refreshKey]);

  // Selected supplier state
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
    }
  }, [selectedLedgerSupplierId, suppliers]);

  // Date filters
  const [fromDate, setFromDate] = useState<string>('2026-04-01');
  const [toDate, setToDate] = useState<string>(getTodayDateString());
  const [isAllTime, setIsAllTime] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Supplier Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);

  // Detailed Purchase Bill Modal State
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = useState<Purchase | null>(null);

  // Active supplier entity
  const activeSupplier = useMemo<Supplier | undefined>(() => {
    return suppliers.find(s => s.id === currentSupplierId);
  }, [suppliers, currentSupplierId]);

  // Ledger logs for the active supplier
  const rawLogs = useMemo<SupplierLog[]>(() => {
    if (!currentSupplierId) return [];
    return db.getSupplierLogsBySupplierId(currentSupplierId);
  }, [currentSupplierId, refreshKey]);

  // Filtered logs with continuous running balance and period opening balance calculation
  const filteredLogs = useMemo<SupplierLog[]>(() => {
    if (!currentSupplierId || !activeSupplier) return [];

    let processedLogs: SupplierLog[] = [];

    if (isAllTime) {
      processedLogs = [...rawLogs];
    } else {
      // Calculate pre-period opening balance brought forward
      const openingBal = Number(activeSupplier.openingBalance) || 0;
      const openingDate = activeSupplier.openingBalanceDate || (activeSupplier.createdAt ? activeSupplier.createdAt.split('T')[0] : '2026-04-01');
      let preBalance = 0;

      if (openingDate < fromDate) {
        preBalance += openingBal;
      }

      const allDbLogs = db.getSupplierLogs().filter(l => l.supplierId === currentSupplierId);
      allDbLogs.forEach(l => {
        if (l.date < fromDate) {
          preBalance += (Number(l.balanceChange) || 0);
        }
      });

      // Synthetic Period Opening Balance row
      const periodOpeningLog: SupplierLog = {
        id: `period-open-${currentSupplierId}-${fromDate}`,
        supplierId: currentSupplierId,
        supplierName: activeSupplier.name,
        date: fromDate,
        type: 'OPENING_BALANCE',
        refNo: 'OPENING-BF',
        totalAmount: preBalance > 0 ? preBalance : 0,
        paidAmount: preBalance < 0 ? Math.abs(preBalance) : 0,
        balanceChange: preBalance,
        runningBalance: Number(preBalance.toFixed(2)),
        notes: `Opening Balance B/F as of ${formatDateToDisplay(fromDate)}`,
        createdAt: fromDate
      };

      processedLogs.push(periodOpeningLog);

      // Period transactions
      const periodLogs = rawLogs.filter(l => {
        if (l.type === 'OPENING_BALANCE') {
          return openingDate >= fromDate && openingDate <= toDate;
        }
        return l.date >= fromDate && l.date <= toDate;
      });

      let currentRunning = preBalance;
      periodLogs.forEach(log => {
        if (log.type !== 'OPENING_BALANCE') {
          currentRunning += (Number(log.balanceChange) || 0);
          processedLogs.push({
            ...log,
            runningBalance: Number(currentRunning.toFixed(2))
          });
        }
      });
    }

    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      return processedLogs.filter(log => {
        const refMatch = (log.refNo || '').toLowerCase().includes(query);
        const notesMatch = (log.notes || '').toLowerCase().includes(query);
        const modeMatch = (log.paymentMode || '').toLowerCase().includes(query);
        const particularsMatch = (log.type || '').toLowerCase().includes(query);
        return refMatch || notesMatch || modeMatch || particularsMatch;
      });
    }

    return processedLogs;
  }, [rawLogs, isAllTime, fromDate, toDate, searchTerm, currentSupplierId, activeSupplier]);

  // Financial summary
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
      logsCount: filteredLogs.length
    };
  }, [activeSupplier, filteredLogs, refreshKey]);

  // Handle supplier change from dropdown
  const handleSelectSupplier = (supplierId: string) => {
    setCurrentSupplierId(supplierId);
    setSelectedLedgerSupplierId(supplierId);
  };

  // Quick preset filters
  const setQuickFilter = (type: 'ALL' | 'TODAY' | 'MONTH' | 'YEAR') => {
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
    } else if (type === 'YEAR') {
      setIsAllTime(false);
      const parts = today.split('-');
      setFromDate(`${parts[0]}-04-01`); // Indian Financial Year Apr 1
      setToDate(today);
    }
  };

  // Open full detail log when clicking any purchase bill
  const handleOpenPurchaseDetail = (refNo?: string) => {
    if (!refNo) return;
    const purchase = purchases.find(
      p => p.billNo === refNo || p.id === refNo || (p.billNo && p.billNo.toLowerCase() === refNo.toLowerCase())
    );
    if (purchase) {
      setSelectedPurchaseDetail(purchase);
    } else {
      showAlert(`Purchase invoice detail for "${refNo}" not found in current purchase records.`, 'Purchase Bill Not Found', 'info');
    }
  };

  // Export ledger to Excel
  const handleExportExcel = () => {
    if (!activeSupplier) return;
    const exportRows = filteredLogs.map((log, idx) => ({
      '#': idx + 1,
      'Date': formatDateToDisplay(log.date),
      'Particulars': log.type === 'PURCHASE' ? 'Purchase Invoice' : log.type === 'PAYMENT' ? 'Payment Out Voucher' : 'Opening Balance',
      'Voucher / Bill No': log.refNo || '-',
      'Debit (Purchase ₹)': log.totalAmount || 0,
      'Credit (Paid ₹)': log.paidAmount || 0,
      'Running Balance (₹)': log.runningBalance !== undefined ? log.runningBalance : log.balanceChange,
      'Payment Mode': log.paymentMode || '-',
      'Notes / Remarks': log.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Supplier Ledger');
    XLSX.writeFile(wb, `Supplier_Ledger_${activeSupplier.name.replace(/\s+/g, '_')}_${getTodayDateString()}.xlsx`);
    showToast('Supplier statement ledger exported to Excel!', 'success');
  };

  // Print statement
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="supplier-ledger-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* TOP HEADER & ACTION BAR */}
      <div
        className="glass-card"
        style={{
          background: '#FFFFFF',
          border: '2px solid #000000',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                background: '#002B99',
                color: '#FFFFFF',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.4rem', color: '#002B99', letterSpacing: '-0.3px' }}>
                SUPPLIER STATEMENT & VENDOR LEDGER
              </h2>
              <div style={{ fontSize: '0.82rem', color: '#6B7280', fontWeight: 600 }}>
                Comprehensive purchase logs, vendor payments outgoing, and running balance ledger
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              className="btn-classic"
              style={{
                background: '#DC2626',
                color: '#FFFFFF',
                border: '1.5px solid #000000',
                fontWeight: 800,
                fontSize: '0.88rem',
                padding: '8px 14px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <PlusCircle size={17} />
              <span>Pay Supplier</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="btn-classic"
              style={{
                background: '#F1F5F9',
                color: '#0F172A',
                border: '1.5px solid #000000',
                fontWeight: 800,
                fontSize: '0.88rem',
                padding: '8px 12px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Download size={16} />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="btn-classic"
              style={{
                background: '#F1F5F9',
                color: '#0F172A',
                border: '1.5px solid #000000',
                fontWeight: 800,
                fontSize: '0.88rem',
                padding: '8px 12px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Printer size={16} />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* DYNAMIC SUPPLIER SELECTOR & DATE CONTROLS */}
        <div
          style={{
            background: '#F8FAFC',
            border: '1.5px solid #E2E8F0',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr 1fr auto',
            gap: '12px',
            alignItems: 'center'
          }}
        >
          {/* Supplier Switcher Dropdown */}
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.78rem', color: '#475569', marginBottom: '3px' }}>
              Select Vendor / Supplier
            </label>
            <select
              className="input-text-clean"
              value={currentSupplierId}
              onChange={e => handleSelectSupplier(e.target.value)}
              style={{
                width: '100%',
                fontWeight: 800,
                fontSize: '0.92rem',
                background: '#FFFFFF',
                borderColor: '#002B99'
              }}
            >
              {suppliers.map(s => {
                const suppSummary = db.getSupplierBalanceSummary(s.id);
                const bal = suppSummary.payableBalance ?? suppSummary.outstandingPayable ?? 0;
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.city ? `(${s.city})` : ''} {bal > 0 ? `— Payable: ₹${bal}` : '— Settled'}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Date Range: From Date */}
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.78rem', color: '#475569', marginBottom: '3px' }}>
              From Date
            </label>
            <input
              type="date"
              className="input-text-clean"
              disabled={isAllTime}
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setIsAllTime(false); }}
              style={{ width: '100%', opacity: isAllTime ? 0.5 : 1 }}
            />
          </div>

          {/* Date Range: To Date */}
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.78rem', color: '#475569', marginBottom: '3px' }}>
              To Date
            </label>
            <input
              type="date"
              className="input-text-clean"
              disabled={isAllTime}
              value={toDate}
              onChange={e => { setToDate(e.target.value); setIsAllTime(false); }}
              style={{ width: '100%', opacity: isAllTime ? 0.5 : 1 }}
            />
          </div>

          {/* Quick Preset Buttons */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', paddingTop: '16px' }}>
            <button
              type="button"
              onClick={() => setQuickFilter('ALL')}
              className="btn-classic"
              style={{
                padding: '6px 10px',
                fontSize: '0.75rem',
                fontWeight: 800,
                background: isAllTime ? '#002B99' : '#FFFFFF',
                color: isAllTime ? '#FFFFFF' : '#002B99',
                borderColor: '#002B99'
              }}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('MONTH')}
              className="btn-classic"
              style={{
                padding: '6px 10px',
                fontSize: '0.75rem',
                fontWeight: 800,
                background: !isAllTime ? '#FFFFFF' : '#F1F5F9'
              }}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('TODAY')}
              className="btn-classic"
              style={{
                padding: '6px 10px',
                fontSize: '0.75rem',
                fontWeight: 800,
                background: '#FFFFFF'
              }}
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {/* SUPPLIER PROFILE & KPI SUMMARY RIBBON */}
      {activeSupplier && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr repeat(3, 1fr)',
            gap: '14px'
          }}
        >
          {/* Supplier Metadata Card */}
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #000000',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    background: '#DBEAFE',
                    color: '#1E40AF',
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}
                >
                  🏭 VENDOR / SUPPLIER
                </span>
                {activeSupplier.openingBalance ? (
                  <span
                    style={{
                      background: '#FEF3C7',
                      color: '#92400E',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}
                  >
                    Opening: ₹{activeSupplier.openingBalance}
                  </span>
                ) : null}
              </div>
              <h3 style={{ margin: '8px 0 4px', fontWeight: 900, fontSize: '1.15rem', color: '#002B99' }}>
                {activeSupplier.name}
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#4B5563', lineHeight: 1.4 }}>
                {activeSupplier.phone && <div>📞 {activeSupplier.phone} {activeSupplier.phone2 ? `| ${activeSupplier.phone2}` : ''}</div>}
                {activeSupplier.address && <div>📍 {activeSupplier.address} {activeSupplier.city ? `, ${activeSupplier.city}` : ''}</div>}
                {activeSupplier.gstin && <div>GST: <code style={{ fontWeight: 800 }}>{activeSupplier.gstin}</code></div>}
              </div>
            </div>
          </div>

          {/* KPI 1: Total Purchases Billed */}
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #000000',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
              Total Purchases Billed
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#002B99', marginTop: '4px' }}>
              ₹{summary.totalPurchased}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600 }}>
              All purchase bills recorded
            </div>
          </div>

          {/* KPI 2: Total Payments Made */}
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #000000',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
              Total Paid to Supplier
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#16A34A', marginTop: '4px' }}>
              ₹{summary.totalPaid}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#15803D', fontWeight: 600 }}>
              Cash + Bank + Cheques Paid
            </div>
          </div>

          {/* KPI 3: Net Payable Balance */}
          <div
            style={{
              background: summary.payableBalance > 0 ? '#FEF2F2' : '#F0FDF4',
              border: '2px solid #000000',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            <div
              style={{
                fontSize: '0.8rem',
                fontWeight: 800,
                color: summary.payableBalance > 0 ? '#991B1B' : '#166534',
                textTransform: 'uppercase'
              }}
            >
              Net Payable Balance
            </div>
            <div
              style={{
                fontSize: '1.6rem',
                fontWeight: 900,
                color: summary.payableBalance > 0 ? '#DC2626' : '#16A34A',
                marginTop: '4px'
              }}
            >
              ₹{summary.payableBalance}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: summary.payableBalance > 0 ? '#B91C1C' : '#15803D'
              }}
            >
              {summary.payableBalance > 0 ? '⚠️ Payment Payable to Vendor' : '✓ Fully Settled / Clear'}
            </div>
          </div>
        </div>
      )}

      {/* DETAILED TRANSACTION LEDGER TABLE */}
      <div
        className="glass-card"
        style={{
          background: '#FFFFFF',
          border: '2px solid #000000',
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          style={{
            background: '#D2BEF6',
            padding: '12px 18px',
            borderBottom: '2px solid #000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ fontWeight: 900, fontSize: '1rem', color: '#002B99' }}>
            SUPPLIER TRANSACTION LEDGER ({filteredLogs.length} Records)
          </div>
          <div style={{ fontSize: '0.8rem', color: '#4B5563', fontWeight: 700 }}>
            💡 Tip: Click on any Purchase Bill Number to view item and tax breakdown
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table-clean" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#ECECEC', borderBottom: '2px solid #000000' }}>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '50px' }}>#</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '110px' }}>Date</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', width: '140px' }}>Type</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', width: '150px' }}>Voucher / Bill No.</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', width: '130px', color: '#002B99' }}>Debit (Purchase ₹)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', width: '130px', color: '#16A34A' }}>Credit (Paid ₹)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', width: '130px', color: '#DC2626' }}>Payable Balance (₹)</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '110px' }}>Mode</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Notes / Remarks</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '90px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>
                    No transactions found for {activeSupplier?.name || 'this supplier'} in the selected date range.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, index) => {
                  const isPurchase = log.type === 'PURCHASE';
                  const displayBalance = log.runningBalance !== undefined ? log.runningBalance : log.balanceChange;
                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid #E2E8F0',
                        background: isPurchase ? '#FFFFFF' : '#F0FDF4'
                      }}
                    >
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#64748B' }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>
                        {formatDateToDisplay(log.date)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'left' }}>
                        <span
                          style={{
                            background: isPurchase ? '#DBEAFE' : '#DCFCE7',
                            color: isPurchase ? '#1E40AF' : '#15803D',
                            fontSize: '0.75rem',
                            fontWeight: 900,
                            padding: '3px 8px',
                            borderRadius: '4px'
                          }}
                        >
                          {isPurchase ? '📦 PURCHASE' : log.type === 'PAYMENT' ? '💸 PAYMENT OUT' : '📌 OPENING'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'left' }}>
                        {isPurchase ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPurchaseDetail(log.refNo)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#002B99',
                              fontWeight: 900,
                              fontSize: '0.92rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              textDecoration: 'underline'
                            }}
                            title="Click to view detailed item breakdown"
                          >
                            <span>{log.refNo}</span>
                            <ExternalLink size={13} />
                          </button>
                        ) : (
                          <span style={{ fontWeight: 800, color: '#475569' }}>{log.refNo || '-'}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#002B99' }}>
                        {log.totalAmount ? `₹${log.totalAmount}` : '-'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: '#16A34A' }}>
                        {log.paidAmount ? `₹${log.paidAmount}` : '-'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 900, color: displayBalance > 0 ? '#DC2626' : '#16A34A' }}>
                        ₹{displayBalance}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, fontSize: '0.82rem' }}>
                        {log.paymentMode || '-'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.85rem', color: '#4B5563' }}>
                        {log.notes || '-'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {isPurchase && (
                          <button
                            type="button"
                            onClick={() => handleOpenPurchaseDetail(log.refNo)}
                            className="btn-classic"
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              background: '#EFF6FF',
                              color: '#1D4ED8',
                              borderColor: '#93C5FD'
                            }}
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SUPPLIER PAYMENT MODAL */}
      <SupplierPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        initialSupplierId={activeSupplier?.id}
      />

      {/* DETAILED PURCHASE BILL POPUP MODAL */}
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
            {/* Modal Header */}
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
                    Purchase Bill Detail: {selectedPurchaseDetail.billNo}
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: '#4B5563', fontWeight: 700 }}>
                    Date: {formatDateToDisplay(selectedPurchaseDetail.billDate)} | Supplier: {selectedPurchaseDetail.supplierName}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedPurchaseDetail(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '50%'
                  }}
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Key Purchase Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>Basic Total</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#002B99' }}>₹{selectedPurchaseDetail.basicTotal}</div>
                </div>
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>GST Total</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#002B99' }}>₹{selectedPurchaseDetail.gstTotal}</div>
                </div>
                <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E40AF' }}>Bill Total</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1E40AF' }}>₹{selectedPurchaseDetail.billTotal}</div>
                </div>
                <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534' }}>Paid / Payable Due</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#16A34A' }}>
                    ₹{(selectedPurchaseDetail.paidCash || 0) + (selectedPurchaseDetail.paidUpi || 0)}
                    {selectedPurchaseDetail.balanceDue ? (
                      <span style={{ fontSize: '0.8rem', color: '#DC2626', marginLeft: '6px' }}>
                        (Due: ₹{selectedPurchaseDetail.balanceDue})
                      </span>
                    ) : ''}
                  </div>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div style={{ border: '1.5px solid #000000', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: '#ECECEC', padding: '8px 12px', fontWeight: 800, fontSize: '0.88rem', borderBottom: '1px solid #000000' }}>
                  Purchased Items & Rate Breakdown
                </div>
                <table className="table-clean" style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                    {selectedPurchaseDetail.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9', fontSize: '0.85rem' }}>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 800 }}>
                          {item.itemName} {item.unit ? `(${item.unit})` : ''}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{item.basicPrice}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{item.gstPercent}%</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{item.gstAmt}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{item.nettPrice}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#002B99' }}>
                          ₹{item.purchaseRate || item.purchasePrice}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900 }}>{item.qty}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 900, color: '#002B99' }}>
                          ₹{item.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Payment Details Footer */}
              <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ fontWeight: 800, color: '#475569' }}>Payment Mode: </span>
                  <span style={{ fontWeight: 700 }}>
                    Cash: ₹{selectedPurchaseDetail.paidCash || 0} | UPI/Online: ₹{selectedPurchaseDetail.paidUpi || 0}
                  </span>
                </div>
                {selectedPurchaseDetail.notes && (
                  <div>
                    <span style={{ fontWeight: 800, color: '#475569' }}>Remarks: </span>
                    <span>{selectedPurchaseDetail.notes}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
