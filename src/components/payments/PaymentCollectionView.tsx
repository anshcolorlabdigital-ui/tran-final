import React, { useState, useMemo, useRef, useEffect } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { PartyLog, Party } from '../../types';
import { getTodayDateString, formatDateToDisplay } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/calculations';
import {
  CreditCard,
  Search,
  PlusCircle,
  Calendar,
  DollarSign,
  User,
  Printer,
  Download,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Receipt,
  FileText,
  RotateCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const PaymentCollectionView: React.FC = () => {
  const { refreshKey, triggerRefresh, showToast, showAlert, openPartyLedger } = useApp();

  const parties = useMemo(() => {
    return db.getParties().filter(p => p.isActive !== false);
  }, [refreshKey]);

  const allLogs = useMemo(() => {
    return db.getPartyLogs();
  }, [refreshKey]);

  // Payment receipts only (type === 'PAYMENT')
  const paymentReceipts = useMemo<PartyLog[]>(() => {
    return allLogs
      .filter(l => l.type === 'PAYMENT')
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : -1)));
  }, [allLogs]);

  // Form State
  const [selectedPartyId, setSelectedPartyId] = useState<string>(() => {
    return parties.length > 0 ? parties[0].id : '';
  });
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(getTodayDateString());
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'CASH' | 'CHEQUE' | 'BANK_TRANSFER'>('UPI');
  const [paymentRefNo, setPaymentRefNo] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Table Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('2026-04-01');
  const [filterDateTo, setFilterDateTo] = useState<string>(getTodayDateString());
  const [isAllTime, setIsAllTime] = useState<boolean>(true);
  const [filterMode, setFilterMode] = useState<string>('ALL');

  // Delete Confirm Dialog State
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    logId: string;
    partyName: string;
    amount: number;
    refNo: string;
  }>({
    isOpen: false,
    logId: '',
    partyName: '',
    amount: 0,
    refNo: ''
  });

  // Printable Receipt Modal State
  const [receiptToPrint, setReceiptToPrint] = useState<PartyLog | null>(null);

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Active selected party entity and balance
  const activeParty = useMemo<Party | undefined>(() => {
    return parties.find(p => p.id === selectedPartyId);
  }, [parties, selectedPartyId]);

  const activePartyBalance = useMemo(() => {
    if (!selectedPartyId) return { outstandingBalance: 0, totalBilled: 0, totalPaid: 0, openingBalance: 0 };
    return db.getPartyBalanceSummary(selectedPartyId);
  }, [selectedPartyId, refreshKey]);

  // Total Market Outstanding Metrics
  const marketMetrics = useMemo(() => {
    let totalMarketDue = 0;
    parties.forEach(p => {
      const summary = db.getPartyBalanceSummary(p.id);
      if (summary.outstandingBalance > 0) {
        totalMarketDue += summary.outstandingBalance;
      }
    });

    const todayStr = getTodayDateString();
    const currentMonthPrefix = todayStr.slice(0, 7);

    let collectedToday = 0;
    let collectedThisMonth = 0;

    paymentReceipts.forEach(r => {
      const amt = Number(r.paidAmount) || 0;
      if (r.date === todayStr) {
        collectedToday += amt;
      }
      if (r.date.startsWith(currentMonthPrefix)) {
        collectedThisMonth += amt;
      }
    });

    return {
      totalMarketDue: Number(totalMarketDue.toFixed(2)),
      collectedToday: Number(collectedToday.toFixed(2)),
      collectedThisMonth: Number(collectedThisMonth.toFixed(2)),
      totalReceiptsCount: paymentReceipts.length
    };
  }, [parties, paymentReceipts, refreshKey]);

  // Filtered receipts list for the table
  const filteredReceipts = useMemo(() => {
    return paymentReceipts.filter(receipt => {
      if (!isAllTime) {
        if (filterDateFrom && receipt.date < filterDateFrom) return false;
        if (filterDateTo && receipt.date > filterDateTo) return false;
      }
      if (filterMode !== 'ALL' && receipt.paymentMode !== filterMode) {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const partyMatch = receipt.partyName.toLowerCase().includes(query);
        const refMatch = (receipt.refNo || '').toLowerCase().includes(query);
        const notesMatch = (receipt.notes || '').toLowerCase().includes(query);
        const modeMatch = (receipt.paymentMode || '').toLowerCase().includes(query);
        if (!partyMatch && !refMatch && !notesMatch && !modeMatch) return false;
      }
      return true;
    });
  }, [paymentReceipts, isAllTime, filterDateFrom, filterDateTo, filterMode, searchTerm]);

  // Quick amount preset handler
  const handleQuickAmount = (type: 'DUE' | 500 | 1000 | 2000 | 5000) => {
    if (type === 'DUE') {
      if (activePartyBalance.outstandingBalance > 0) {
        setPaymentAmount(String(activePartyBalance.outstandingBalance));
      } else {
        showAlert('Selected party has no outstanding due balance.', 'No Dues', 'info');
      }
    } else {
      setPaymentAmount(String(type));
    }
  };

  // Submit payment receipt
  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartyId || !activeParty) {
      showAlert('Please select a customer / party.', 'Validation Error', 'error');
      return;
    }

    const amt = parseFloat(paymentAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      showAlert('Please enter a valid positive payment amount.', 'Invalid Amount', 'error');
      amountInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const receipt = db.recordPartyPayment(
        selectedPartyId,
        amt,
        paymentMode,
        paymentRefNo.trim() || undefined,
        paymentNotes.trim() || `Payment received from ${activeParty.name}`,
        paymentDate
      );

      showToast(`Payment receipt of ₹${amt} successfully recorded for ${activeParty.name}!`, 'success');
      triggerRefresh();

      // Reset form
      setPaymentAmount('');
      setPaymentRefNo('');
      setPaymentNotes('');
      setPaymentDate(getTodayDateString());
      setPaymentMode('UPI');
    } catch (err: any) {
      showAlert(err?.message || 'Failed to record payment.', 'Error', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete payment receipt
  const handleConfirmDelete = () => {
    if (!deleteDialog.logId) return;
    db.deletePartyLog(deleteDialog.logId);
    showToast(`Payment receipt ${deleteDialog.refNo} (₹${deleteDialog.amount}) deleted.`, 'success');
    triggerRefresh();
    setDeleteDialog({ isOpen: false, logId: '', partyName: '', amount: 0, refNo: '' });
  };

  // Export receipts table to Excel
  const handleExportExcel = () => {
    const exportRows = filteredReceipts.map((r, idx) => ({
      '#': idx + 1,
      'Receipt Date': formatDateToDisplay(r.date),
      'Receipt Voucher No': r.refNo || '-',
      'Customer Name': r.partyName,
      'Payment Mode': r.paymentMode || '-',
      'Amount Collected (₹)': r.paidAmount || 0,
      'Notes / Remarks': r.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payment Receipts');
    XLSX.writeFile(wb, `Payment_Receipts_${getTodayDateString()}.xlsx`);
    showToast('Payment receipts exported to Excel!', 'success');
  };

  return (
    <div className="payment-collection-view" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* 1. TOP STATS BAR */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px'
        }}
      >
        {/* Total Market Dues */}
        <div
          style={{
            background: 'linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%)',
            border: '2px solid #000000',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#9F1239', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total Market Dues
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#BE123C', marginTop: '4px' }}>
            ₹{marketMetrics.totalMarketDue}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#881337', fontWeight: 700, marginTop: '2px' }}>
            Uncollected credit across active parties
          </div>
        </div>

        {/* Collected Today */}
        <div
          style={{
            background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
            border: '2px solid #000000',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Collected Today
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#15803D', marginTop: '4px' }}>
            ₹{marketMetrics.collectedToday}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#14532D', fontWeight: 700, marginTop: '2px' }}>
            {formatDateToDisplay(getTodayDateString())}
          </div>
        </div>

        {/* Collected This Month */}
        <div
          style={{
            background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
            border: '2px solid #000000',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Collected This Month
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#1D4ED8', marginTop: '4px' }}>
            ₹{marketMetrics.collectedThisMonth}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#1E3A8A', fontWeight: 700, marginTop: '2px' }}>
            Current Billing Cycle
          </div>
        </div>

        {/* Total Receipts */}
        <div
          style={{
            background: 'linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)',
            border: '2px solid #000000',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#6B21A8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total Collections
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#7E22CE', marginTop: '4px' }}>
            {marketMetrics.totalReceiptsCount} <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Vouchers</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#581C87', fontWeight: 700, marginTop: '2px' }}>
            Receipts logged in system
          </div>
        </div>
      </div>

      {/* 2. MAIN SPLIT SECTION: COLLECT PAYMENT FORM (LEFT/TOP) & REGISTER (RIGHT/BOTTOM) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(360px, 480px) 1fr',
          gap: '18px',
          alignItems: 'start'
        }}
      >
        {/* LEFT: PAYMENT ENTRY CARD */}
        <div
          className="dynamic-entry-card"
          style={{
            background: '#FFFFFF',
            border: '2px solid #000000',
            borderRadius: '12px',
            padding: '22px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              borderBottom: '2px solid #E2E8F0',
              paddingBottom: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  background: '#16A34A',
                  color: '#FFFFFF',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex'
                }}
              >
                <PlusCircle size={20} />
              </div>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem', color: '#0F172A' }}>
                Collect Payment Receipt
              </h3>
            </div>
            {activeParty && (
              <button
                type="button"
                onClick={() => openPartyLedger(activeParty.id)}
                className="btn-classic"
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 8px',
                  background: '#EFF6FF',
                  color: '#1D4ED8',
                  borderColor: '#93C5FD'
                }}
                title="View full statement for this party"
              >
                <FileText size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                Ledger
              </button>
            )}
          </div>

          <form onSubmit={handleSubmitPayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Customer Selector */}
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px', color: '#1E293B' }}>
                Select Customer / Party *
              </label>
              <select
                className="input-text-clean"
                value={selectedPartyId}
                onChange={e => setSelectedPartyId(e.target.value)}
                required
                style={{
                  width: '100%',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  background: '#F8FAFC',
                  borderColor: '#002B99'
                }}
              >
                {parties.map(p => {
                  const bal = db.getPartyBalanceSummary(p.id).outstandingBalance;
                  const tag = p.partyType === 'DEALER' ? '[Dealer]' : '[Amateur]';
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} {tag} {p.city ? `(${p.city})` : ''} {bal > 0 ? `— Due: ₹${bal}` : '— Settled'}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Dynamic Due Balance Card */}
            {activeParty && (
              <div
                style={{
                  background: activePartyBalance.outstandingBalance > 0 ? '#FEF2F2' : '#F0FDF4',
                  border: `1.5px solid ${activePartyBalance.outstandingBalance > 0 ? '#FECACA' : '#BBF7D0'}`,
                  borderRadius: '10px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569' }}>
                    Current Outstanding Due:
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                    Opening: ₹{activePartyBalance.openingBalance} | Billed: ₹{activePartyBalance.totalBilled} | Paid: ₹{activePartyBalance.totalPaid}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '1.3rem',
                    fontWeight: 900,
                    color: activePartyBalance.outstandingBalance > 0 ? '#DC2626' : '#16A34A'
                  }}
                >
                  ₹{activePartyBalance.outstandingBalance}
                </div>
              </div>
            )}

            {/* Payment Amount */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1E293B' }}>
                  Payment Amount Collected (₹) *
                </label>
                {activePartyBalance.outstandingBalance > 0 && (
                  <button
                    type="button"
                    onClick={() => handleQuickAmount('DUE')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#2563EB',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Clear Full Due (₹{activePartyBalance.outstandingBalance})
                  </button>
                )}
              </div>
              <input
                ref={amountInputRef}
                type="number"
                step="any"
                min="0.01"
                required
                className="input-text-clean"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                placeholder="Enter amount (e.g. 5000)"
                style={{
                  fontWeight: 900,
                  fontSize: '1.3rem',
                  color: '#16A34A',
                  padding: '10px 14px'
                }}
              />

              {/* Quick Amount Presets */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                {[500, 1000, 2000, 5000].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleQuickAmount(preset as any)}
                    className="btn-classic"
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      background: '#F8FAFC',
                      color: '#334155'
                    }}
                  >
                    +₹{preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Date & Mode */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.82rem', marginBottom: '4px' }}>
                  Receipt Date *
                </label>
                <input
                  type="date"
                  required
                  className="input-text-clean"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  style={{ fontWeight: 800 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.82rem', marginBottom: '4px' }}>
                  Payment Mode *
                </label>
                <select
                  className="input-text-clean"
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value as any)}
                  style={{ fontWeight: 800 }}
                >
                  <option value="UPI">UPI / Online / QR</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                </select>
              </div>
            </div>

            {/* Reference / Txn No */}
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.82rem', marginBottom: '4px' }}>
                Reference / Transaction / Cheque No.
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={paymentRefNo}
                onChange={e => setPaymentRefNo(e.target.value)}
                placeholder="e.g. UPI-9876543210, CHQ-00124"
              />
            </div>

            {/* Notes / Remarks */}
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.82rem', marginBottom: '4px' }}>
                Notes / Remarks
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
                placeholder="e.g. Cleared bill INV-1004, Part payment"
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  setPaymentAmount('');
                  setPaymentRefNo('');
                  setPaymentNotes('');
                }}
                className="btn-classic"
                style={{ flex: 1, background: '#F1F5F9', color: '#334155' }}
              >
                Reset
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-classic"
                style={{
                  flex: 2,
                  background: '#16A34A',
                  color: '#FFFFFF',
                  fontWeight: 900,
                  fontSize: '1rem',
                  padding: '10px 16px'
                }}
              >
                {isSubmitting ? 'Saving...' : 'Save Payment Receipt'}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT: PAYMENT COLLECTIONS REGISTER & HISTORY */}
        <div
          style={{
            background: '#FFFFFF',
            border: '2px solid #000000',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}
        >
          {/* Header & Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.25rem', color: '#002B99' }}>
                Payment Receipts Register
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                Showing {filteredReceipts.length} payment records
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleExportExcel}
                className="btn-classic"
                style={{
                  background: '#F8FAFC',
                  color: '#0F172A',
                  border: '1.5px solid #000000',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={15} />
                Excel
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div
            style={{
              background: '#F8FAFC',
              border: '1.5px solid #E2E8F0',
              borderRadius: '8px',
              padding: '10px 12px',
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 1fr auto',
              gap: '10px',
              alignItems: 'center'
            }}
          >
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
              <input
                type="text"
                className="input-text-clean"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search party, receipt no, notes..."
                style={{ paddingLeft: '32px', width: '100%', fontSize: '0.85rem' }}
              />
            </div>

            {/* Mode Filter */}
            <select
              className="input-text-clean"
              value={filterMode}
              onChange={e => setFilterMode(e.target.value)}
              style={{ fontWeight: 700, fontSize: '0.85rem' }}
            >
              <option value="ALL">All Payment Modes</option>
              <option value="UPI">UPI / Online</option>
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>

            {/* Date Filters */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="date"
                className="input-text-clean"
                disabled={isAllTime}
                value={filterDateFrom}
                onChange={e => { setFilterDateFrom(e.target.value); setIsAllTime(false); }}
                style={{ fontSize: '0.78rem', width: '100%', opacity: isAllTime ? 0.5 : 1 }}
              />
              <input
                type="date"
                className="input-text-clean"
                disabled={isAllTime}
                value={filterDateTo}
                onChange={e => { setFilterDateTo(e.target.value); setIsAllTime(false); }}
                style={{ fontSize: '0.78rem', width: '100%', opacity: isAllTime ? 0.5 : 1 }}
              />
            </div>

            {/* Quick All Time Toggle */}
            <button
              type="button"
              onClick={() => setIsAllTime(!isAllTime)}
              className="btn-classic"
              style={{
                padding: '6px 10px',
                fontSize: '0.78rem',
                fontWeight: 800,
                background: isAllTime ? '#002B99' : '#FFFFFF',
                color: isAllTime ? '#FFFFFF' : '#002B99',
                borderColor: '#002B99'
              }}
            >
              {isAllTime ? 'All Time ✓' : 'All Time'}
            </button>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto', border: '1.5px solid #000000', borderRadius: '8px' }}>
            <table className="table-clean" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#002B99', color: '#FFFFFF', fontSize: '0.82rem' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: '45px' }}>#</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', width: '105px' }}>Date</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', width: '130px' }}>Receipt / Ref</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Customer / Party</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: '110px' }}>Mode</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', width: '130px' }}>Amount (₹)</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Notes</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: '90px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>
                      No payment receipts found matching the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((receipt, index) => {
                    const modeBg =
                      receipt.paymentMode === 'UPI'
                        ? '#F3E8FF'
                        : receipt.paymentMode === 'CASH'
                        ? '#DCFCE7'
                        : receipt.paymentMode === 'CHEQUE'
                        ? '#DBEAFE'
                        : '#FEF3C7';
                    const modeColor =
                      receipt.paymentMode === 'UPI'
                        ? '#6B21A8'
                        : receipt.paymentMode === 'CASH'
                        ? '#15803D'
                        : receipt.paymentMode === 'CHEQUE'
                        ? '#1D4ED8'
                        : '#B45309';

                    return (
                      <tr
                        key={receipt.id}
                        style={{
                          borderBottom: '1px solid #E2E8F0',
                          background: index % 2 === 0 ? '#FFFFFF' : '#F8FAFC'
                        }}
                      >
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#64748B' }}>
                          {index + 1}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, fontSize: '0.85rem' }}>
                          {formatDateToDisplay(receipt.date)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, color: '#002B99' }}>
                          {receipt.refNo || '-'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'left' }}>
                          <button
                            type="button"
                            onClick={() => openPartyLedger(receipt.partyId)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#1E40AF',
                              fontWeight: 800,
                              fontSize: '0.88rem',
                              cursor: 'pointer',
                              textAlign: 'left',
                              padding: 0
                            }}
                            title="Click to view Customer Statement Ledger"
                          >
                            {receipt.partyName}
                          </button>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <span
                            style={{
                              background: modeBg,
                              color: modeColor,
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              border: `1px solid ${modeColor}33`
                            }}
                          >
                            {receipt.paymentMode || 'CASH'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, fontSize: '1rem', color: '#16A34A' }}>
                          ₹{receipt.paidAmount}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.82rem', color: '#475569' }}>
                          {receipt.notes || '-'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => setReceiptToPrint(receipt)}
                              className="btn-classic"
                              style={{ padding: '3px 6px', background: '#F1F5F9', borderColor: '#CBD5E1' }}
                              title="Print Receipt Slip"
                            >
                              <Printer size={14} color="#334155" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setDeleteDialog({
                                  isOpen: true,
                                  logId: receipt.id,
                                  partyName: receipt.partyName,
                                  amount: receipt.paidAmount || 0,
                                  refNo: receipt.refNo
                                })
                              }
                              className="btn-classic"
                              style={{ padding: '3px 6px', background: '#FEE2E2', borderColor: '#FCA5A5' }}
                              title="Delete Receipt"
                            >
                              <Trash2 size={14} color="#DC2626" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DELETE RECEIPT CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Delete Payment Receipt"
        message={`Are you sure you want to delete payment receipt "${deleteDialog.refNo}" of ₹${deleteDialog.amount} for "${deleteDialog.partyName}"? This will reverse the credit on the customer ledger.`}
        confirmText="Yes, Delete Receipt"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteDialog({ isOpen: false, logId: '', partyName: '', amount: 0, refNo: '' })}
      />

      {/* PRINTABLE RECEIPT SLIP MODAL */}
      {receiptToPrint && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => setReceiptToPrint(null)}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #000000',
              borderRadius: '12px',
              maxWidth: '420px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', borderBottom: '2px dashed #CBD5E1', paddingBottom: '14px', marginBottom: '14px' }}>
              <div style={{ fontWeight: 900, fontSize: '1.2rem', color: '#002B99' }}>PAYMENT RECEIPT VOUCHER</div>
              <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Raw Material Management System</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B', fontWeight: 700 }}>Voucher No:</span>
                <span style={{ fontWeight: 900, color: '#0F172A' }}>{receiptToPrint.refNo}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B', fontWeight: 700 }}>Receipt Date:</span>
                <span style={{ fontWeight: 800 }}>{formatDateToDisplay(receiptToPrint.date)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B', fontWeight: 700 }}>Customer Name:</span>
                <span style={{ fontWeight: 900, color: '#002B99' }}>{receiptToPrint.partyName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B', fontWeight: 700 }}>Payment Mode:</span>
                <span style={{ fontWeight: 800 }}>{receiptToPrint.paymentMode || 'CASH'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B', fontWeight: 700 }}>Notes / Remarks:</span>
                <span style={{ fontWeight: 700, color: '#475569' }}>{receiptToPrint.notes || '-'}</span>
              </div>

              <div
                style={{
                  background: '#F0FDF4',
                  border: '1.5px solid #86EFAC',
                  borderRadius: '8px',
                  padding: '12px',
                  marginTop: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontWeight: 900, fontSize: '0.95rem', color: '#166534' }}>Amount Received:</span>
                <span style={{ fontWeight: 900, fontSize: '1.4rem', color: '#15803D' }}>₹{receiptToPrint.paidAmount}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setReceiptToPrint(null)}
                className="btn-classic"
                style={{ background: '#F1F5F9', color: '#334155' }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-classic"
                style={{ background: '#002B99', color: '#FFFFFF', fontWeight: 900 }}
              >
                Print Slip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
