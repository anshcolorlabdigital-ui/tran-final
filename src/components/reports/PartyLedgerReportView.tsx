import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { Party, PartyLog, Sale } from '../../types';
import { formatDateToDisplay, getTodayDateString } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/calculations';
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
  User,
  ArrowRight,
  ExternalLink,
  Receipt,
  CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const PartyLedgerReportView: React.FC = () => {
  const {
    refreshKey,
    selectedLedgerPartyId,
    setSelectedLedgerPartyId,
    showToast,
    showAlert,
    setActiveTab
  } = useApp();

  const parties = useMemo(() => db.getParties(), [refreshKey]);
  const sales = useMemo(() => db.getSales(), [refreshKey]);

  // Selected party state
  const [currentPartyId, setCurrentPartyId] = useState<string>(() => {
    if (selectedLedgerPartyId && parties.some(p => p.id === selectedLedgerPartyId)) {
      return selectedLedgerPartyId;
    }
    return parties.length > 0 ? parties[0].id : '';
  });

  // Sync when selectedLedgerPartyId changes from context
  useEffect(() => {
    if (selectedLedgerPartyId && parties.some(p => p.id === selectedLedgerPartyId)) {
      setCurrentPartyId(selectedLedgerPartyId);
    }
  }, [selectedLedgerPartyId, parties]);

  // Date filters
  const [fromDate, setFromDate] = useState<string>('2026-08-01');
  const [toDate, setToDate] = useState<string>(getTodayDateString());
  const [isAllTime, setIsAllTime] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Payment Receipt Modal State
  const [showPaymentForm, setShowPaymentForm] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'COMBINED'>('UPI');
  const [paymentRefNo, setPaymentRefNo] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Detailed Bill Log Modal State
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);

  // Active party entity
  const activeParty = useMemo<Party | undefined>(() => {
    return parties.find(p => p.id === currentPartyId);
  }, [parties, currentPartyId]);

  // Ledger logs for the active party
  const rawLogs = useMemo<PartyLog[]>(() => {
    if (!currentPartyId) return [];
    return db.getPartyLogsByPartyId(currentPartyId);
  }, [currentPartyId, refreshKey]);

  // Filtered logs
  const filteredLogs = useMemo<PartyLog[]>(() => {
    return rawLogs.filter(log => {
      if (!isAllTime) {
        if (fromDate && log.date < fromDate) return false;
        if (toDate && log.date > toDate) return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const refMatch = (log.refNo || '').toLowerCase().includes(query);
        const notesMatch = (log.notes || '').toLowerCase().includes(query);
        const modeMatch = (log.paymentMode || '').toLowerCase().includes(query);
        if (!refMatch && !notesMatch && !modeMatch) return false;
      }
      return true;
    });
  }, [rawLogs, fromDate, toDate, isAllTime, searchTerm]);

  // Financial summary
  const summary = useMemo(() => {
    if (!activeParty) {
      return {
        totalBilled: 0,
        totalPaid: 0,
        openingBalance: 0,
        outstandingBalance: 0,
        logsCount: 0
      };
    }
    const balanceSummary = db.getPartyBalanceSummary(activeParty.id);
    return {
      ...balanceSummary,
      logsCount: filteredLogs.length
    };
  }, [activeParty, filteredLogs, refreshKey]);

  // Handle party change from dropdown
  const handleSelectParty = (partyId: string) => {
    setCurrentPartyId(partyId);
    setSelectedLedgerPartyId(partyId);
    setShowPaymentForm(false);
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

  // Handle recording payment
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeParty) return;

    const amt = parseFloat(paymentAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      showAlert('Please enter a valid positive payment amount.', 'Invalid Amount', 'error');
      return;
    }

    db.recordPartyPayment(
      activeParty.id,
      amt,
      paymentMode,
      paymentRefNo.trim() || undefined,
      paymentNotes.trim() || `Payment received from ${activeParty.name}`
    );

    showToast(`Payment receipt of ₹${amt} recorded successfully for ${activeParty.name}!`, 'success');
    setShowPaymentForm(false);
    setPaymentAmount('');
    setPaymentRefNo('');
    setPaymentNotes('');
  };

  // Open full detail log when clicking any bill
  const handleOpenBillDetail = (refNo?: string) => {
    if (!refNo) return;
    const sale = sales.find(s => s.billNo === refNo || s.id === refNo || s.billNo.toLowerCase() === (refNo || '').toLowerCase());
    if (sale) {
      setSelectedSaleDetail(sale);
    } else {
      showAlert(`Invoice detail log for "${refNo}" not found in current sales database.`, 'Invoice Not Found', 'info');
    }
  };

  // Export ledger to Excel
  const handleExportExcel = () => {
    if (!activeParty) return;
    const exportRows = filteredLogs.map((log, idx) => ({
      '#': idx + 1,
      'Date': formatDateToDisplay(log.date),
      'Particulars': log.type === 'SALE' ? 'Sale Invoice' : log.type === 'PAYMENT' ? 'Payment Receipt' : 'Opening Balance',
      'Voucher / Bill No': log.refNo || '-',
      'Debit (Billed ₹)': log.totalAmount || 0,
      'Credit (Paid ₹)': log.paidAmount || 0,
      'Running Balance (₹)': log.runningBalance !== undefined ? log.runningBalance : log.balanceChange,
      'Payment Mode': log.paymentMode || '-',
      'Notes / Remarks': log.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Party Ledger');
    XLSX.writeFile(wb, `Ledger_${activeParty.name.replace(/\s+/g, '_')}_${getTodayDateString()}.xlsx`);
    showToast('Party statement ledger exported to Excel!', 'success');
  };

  // Print statement
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="party-ledger-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                PARTY STATEMENT & CUSTOMER LEDGER
              </h2>
              <div style={{ fontSize: '0.82rem', color: '#6B7280', fontWeight: 600 }}>
                Comprehensive financial ledger, payment collections, and interactive bill logs
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowPaymentForm(true)}
              className="btn-classic"
              style={{
                background: '#16A34A',
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
              <span>Collect Payment</span>
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

        {/* DYNAMIC PARTY SELECTOR & DATE CONTROLS */}
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
          {/* Party Switcher Dropdown */}
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.78rem', color: '#475569', marginBottom: '3px' }}>
              Select Customer / Party
            </label>
            <select
              className="input-text-clean"
              value={currentPartyId}
              onChange={e => handleSelectParty(e.target.value)}
              style={{
                width: '100%',
                fontWeight: 800,
                fontSize: '0.92rem',
                background: '#FFFFFF',
                borderColor: '#002B99'
              }}
            >
              {parties.map(p => {
                const bal = db.getPartyBalanceSummary(p.id).outstandingBalance;
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.city ? `(${p.city})` : ''} {bal > 0 ? `— Due: ₹${bal}` : '— Settled'}
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

      {/* PARTY PROFILE & KPI SUMMARY RIBBON */}
      {activeParty && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr repeat(3, 1fr)',
            gap: '14px'
          }}
        >
          {/* Party Metadata Card */}
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
                    background: activeParty.partyType === 'DEALER' ? '#DBEAFE' : '#FEF3C7',
                    color: activeParty.partyType === 'DEALER' ? '#1E40AF' : '#92400E',
                    fontSize: '0.72rem',
                    fontWeight: 900,
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}
                >
                  {activeParty.partyType === 'DEALER' ? '🏢 DEALER (Wholesale)' : '👤 AMATEUR (Retail)'}
                </span>
                <span
                  style={{
                    background: activeParty.allowCredit ? '#DCFCE7' : '#F1F5F9',
                    color: activeParty.allowCredit ? '#15803D' : '#475569',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}
                >
                  {activeParty.allowCredit ? '✓ Credit Allowed' : 'Cash Only'}
                </span>
              </div>
              <h3 style={{ margin: '8px 0 4px', fontWeight: 900, fontSize: '1.15rem', color: '#002B99' }}>
                {activeParty.name}
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#4B5563', lineHeight: 1.4 }}>
                {activeParty.phone && <div>📞 {activeParty.phone} {activeParty.phone2 ? `| ${activeParty.phone2}` : ''}</div>}
                {activeParty.address && <div>📍 {activeParty.address} {activeParty.city ? `, ${activeParty.city}` : ''}</div>}
                {activeParty.gstin && <div>GST: <code style={{ fontWeight: 800 }}>{activeParty.gstin}</code></div>}
              </div>
            </div>
          </div>

          {/* KPI 1: Total Billed */}
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
              Total Sales Billed
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#002B99', marginTop: '4px' }}>
              ₹{summary.totalBilled}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600 }}>
              All invoices issued
            </div>
          </div>

          {/* KPI 2: Total Payments Received */}
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
              Total Paid / Collected
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#16A34A', marginTop: '4px' }}>
              ₹{summary.totalPaid}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#15803D', fontWeight: 600 }}>
              Cash + UPI + Receipts
            </div>
          </div>

          {/* KPI 3: Outstanding Balance Due */}
          <div
            style={{
              background: summary.outstandingBalance > 0 ? '#FEF2F2' : '#F0FDF4',
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
                color: summary.outstandingBalance > 0 ? '#991B1B' : '#166534',
                textTransform: 'uppercase'
              }}
            >
              Outstanding Balance Due
            </div>
            <div
              style={{
                fontSize: '1.6rem',
                fontWeight: 900,
                color: summary.outstandingBalance > 0 ? '#DC2626' : '#16A34A',
                marginTop: '4px'
              }}
            >
              ₹{summary.outstandingBalance}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: summary.outstandingBalance > 0 ? '#B91C1C' : '#15803D'
              }}
            >
              {summary.outstandingBalance > 0 ? '⚠️ Payment Pending' : '✓ Fully Settled'}
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
            LEDGER TRANSACTION LOGS ({filteredLogs.length} Records)
          </div>
          <div style={{ fontSize: '0.8rem', color: '#4B5563', fontWeight: 700 }}>
            💡 Tip: Click on any Voucher / Bill Number to view detailed item breakdown
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
                <th style={{ padding: '10px 12px', textAlign: 'right', width: '130px', color: '#002B99' }}>Debit (Billed ₹)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', width: '130px', color: '#16A34A' }}>Credit (Paid ₹)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', width: '130px', color: '#DC2626' }}>Balance (₹)</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '110px' }}>Mode</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>Notes / Remarks</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '90px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>
                    No transactions found for {activeParty?.name || 'this party'} in the selected date range.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, index) => {
                  const isInvoice = log.type === 'SALE';
                  const displayBalance = log.runningBalance !== undefined ? log.runningBalance : log.balanceChange;
                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid #E2E8F0',
                        background: isInvoice ? '#FFFFFF' : '#F0FDF4'
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
                            background: isInvoice ? '#DBEAFE' : '#DCFCE7',
                            color: isInvoice ? '#1E40AF' : '#15803D',
                            fontSize: '0.75rem',
                            fontWeight: 900,
                            padding: '3px 8px',
                            borderRadius: '4px'
                          }}
                        >
                          {isInvoice ? '📄 SALE INVOICE' : log.type === 'PAYMENT' ? '💰 RECEIPT' : '📌 OPENING'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'left' }}>
                        {isInvoice ? (
                          <button
                            type="button"
                            onClick={() => handleOpenBillDetail(log.refNo)}
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
                        {isInvoice && (
                          <button
                            type="button"
                            onClick={() => handleOpenBillDetail(log.refNo)}
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

      {/* PAYMENT COLLECTION MODAL */}
      {showPaymentForm && activeParty && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #000000',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                background: '#D2BEF6',
                padding: '14px 18px',
                borderBottom: '2px solid #000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.15rem', color: '#002B99' }}>
                Collect Payment Receipt: {activeParty.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowPaymentForm(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#475569' }}>Current Outstanding Due:</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: summary.outstandingBalance > 0 ? '#DC2626' : '#16A34A' }}>
                  ₹{summary.outstandingBalance}
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  autoFocus
                  className="input-text-clean"
                  placeholder="Enter amount collected"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  style={{ fontWeight: 900, fontSize: '1.1rem', color: '#16A34A' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
                    Payment Mode
                  </label>
                  <select
                    className="input-text-clean"
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value as any)}
                    style={{ fontWeight: 700 }}
                  >
                    <option value="UPI">UPI / Online</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
                    Reference / Txn No.
                  </label>
                  <input
                    type="text"
                    className="input-text-clean"
                    placeholder="e.g. UPI-12345"
                    value={paymentRefNo}
                    onChange={e => setPaymentRefNo(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
                  Notes / Remarks
                </label>
                <input
                  type="text"
                  className="input-text-clean"
                  placeholder="e.g. Cleared bill INV-1002"
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="btn-classic"
                  style={{ background: '#F1F5F9', color: '#334155' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-classic"
                  style={{ background: '#16A34A', color: '#FFFFFF', fontWeight: 900 }}
                >
                  Save Payment Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILED BILL LOG POPUP MODAL */}
      {selectedSaleDetail && (
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
                    Sale Invoice Detail Log: {selectedSaleDetail.billNo}
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: '#4B5563', fontWeight: 700 }}>
                    Date: {formatDateToDisplay(selectedSaleDetail.billDate)} | Customer: {selectedSaleDetail.partyName}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedSaleDetail(null)}
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
              {/* Key Invoice Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>Basic Total</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#002B99' }}>₹{selectedSaleDetail.basicTotal}</div>
                </div>
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>GST Total</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#002B99' }}>₹{selectedSaleDetail.gstTotal}</div>
                </div>
                <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E40AF' }}>Bill Total</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1E40AF' }}>₹{selectedSaleDetail.billTotal}</div>
                </div>
                <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534' }}>Paid / Balance</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#16A34A' }}>
                    ₹{(selectedSaleDetail.recdCash || 0) + (selectedSaleDetail.recdUpi || 0)}
                    {selectedSaleDetail.balanceDue ? (
                      <span style={{ fontSize: '0.8rem', color: '#DC2626', marginLeft: '6px' }}>
                        (Due: ₹{selectedSaleDetail.balanceDue})
                      </span>
                    ) : ''}
                  </div>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div style={{ border: '1.5px solid #000000', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ background: '#ECECEC', padding: '8px 12px', fontWeight: 800, fontSize: '0.88rem', borderBottom: '1px solid #000000' }}>
                  Billed Items & Rate Breakdown
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
                    {selectedSaleDetail.items.map((item, idx) => (
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
                          ₹{item.salePrice || item.mrp}
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
                    Cash: ₹{selectedSaleDetail.recdCash || 0} | UPI/Online: ₹{selectedSaleDetail.recdUpi || 0}
                  </span>
                </div>
                {selectedSaleDetail.notes && (
                  <div>
                    <span style={{ fontWeight: 800, color: '#475569' }}>Remarks: </span>
                    <span>{selectedSaleDetail.notes}</span>
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
