import React, { useState, useMemo, useRef } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { SupplierLog, Supplier } from '../../types';
import { getTodayDateString, formatDateToDisplay } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/calculations';
import {
  CreditCard,
  Search,
  PlusCircle,
  Calendar,
  DollarSign,
  Building2,
  Printer,
  Download,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Receipt,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const SupplierPaymentView: React.FC = () => {
  const { refreshKey, triggerRefresh, showToast, showAlert, openSupplierLedger } = useApp();

  const suppliers = useMemo(() => {
    return db.getSuppliers().filter(s => s.isActive !== false);
  }, [refreshKey]);

  const allLogs = useMemo(() => {
    return db.getSupplierLogs();
  }, [refreshKey]);

  // Payment logs only (type === 'PAYMENT')
  const paymentVouchers = useMemo<SupplierLog[]>(() => {
    return allLogs
      .filter(l => l.type === 'PAYMENT')
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : -1)));
  }, [allLogs]);

  // Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(() => {
    return suppliers.length > 0 ? suppliers[0].id : '';
  });
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(getTodayDateString());
  const [paymentMode, setPaymentMode] = useState<'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'CASH'>('BANK_TRANSFER');
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
    supplierName: string;
    amount: number;
    refNo: string;
  }>({
    isOpen: false,
    logId: '',
    supplierName: '',
    amount: 0,
    refNo: ''
  });

  // Printable Payment Slip State
  const [voucherToPrint, setVoucherToPrint] = useState<SupplierLog | null>(null);

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Active selected supplier entity and balance
  const activeSupplier = useMemo(() => {
    return suppliers.find(s => s.id === selectedSupplierId);
  }, [suppliers, selectedSupplierId]);

  const activeSupplierBalance = useMemo(() => {
    if (!selectedSupplierId) return { outstandingPayable: 0, totalPurchased: 0, totalPaid: 0, openingBalance: 0 };
    return db.getSupplierBalanceSummary(selectedSupplierId);
  }, [selectedSupplierId, refreshKey]);

  // Total Supplier Payable Metrics
  const supplierMetrics = useMemo(() => {
    let totalPayables = 0;
    suppliers.forEach(s => {
      const summary = db.getSupplierBalanceSummary(s.id);
      if (summary.outstandingPayable > 0) {
        totalPayables += summary.outstandingPayable;
      }
    });

    const todayStr = getTodayDateString();
    const currentMonthPrefix = todayStr.slice(0, 7);

    let paidToday = 0;
    let paidThisMonth = 0;

    paymentVouchers.forEach(r => {
      const amt = Number(r.paidAmount) || 0;
      if (r.date === todayStr) {
        paidToday += amt;
      }
      if (r.date.startsWith(currentMonthPrefix)) {
        paidThisMonth += amt;
      }
    });

    return {
      totalPayables: Number(totalPayables.toFixed(2)),
      paidToday: Number(paidToday.toFixed(2)),
      paidThisMonth: Number(paidThisMonth.toFixed(2)),
      totalVouchersCount: paymentVouchers.length
    };
  }, [suppliers, paymentVouchers, refreshKey]);

  // Filtered payments list for the table
  const filteredVouchers = useMemo(() => {
    return paymentVouchers.filter(voucher => {
      if (!isAllTime) {
        if (filterDateFrom && voucher.date < filterDateFrom) return false;
        if (filterDateTo && voucher.date > filterDateTo) return false;
      }
      if (filterMode !== 'ALL' && voucher.paymentMode !== filterMode) {
        return false;
      }
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const supMatch = voucher.supplierName.toLowerCase().includes(query);
        const refMatch = (voucher.refNo || '').toLowerCase().includes(query);
        const notesMatch = (voucher.notes || '').toLowerCase().includes(query);
        const modeMatch = (voucher.paymentMode || '').toLowerCase().includes(query);
        if (!supMatch && !refMatch && !notesMatch && !modeMatch) return false;
      }
      return true;
    });
  }, [paymentVouchers, isAllTime, filterDateFrom, filterDateTo, filterMode, searchTerm]);

  // Quick amount preset handler
  const handleQuickAmount = (type: 'PAYABLE' | 1000 | 2000 | 5000 | 10000) => {
    if (type === 'PAYABLE') {
      if (activeSupplierBalance.outstandingPayable > 0) {
        setPaymentAmount(String(activeSupplierBalance.outstandingPayable));
      } else {
        showAlert('Selected supplier has no outstanding payable balance.', 'No Dues', 'info');
      }
    } else {
      setPaymentAmount(String(type));
    }
  };

  // Submit supplier payment
  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !activeSupplier) {
      showAlert('Please select a supplier.', 'Validation Error', 'error');
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
      db.recordSupplierPayment(
        selectedSupplierId,
        amt,
        paymentMode,
        paymentRefNo.trim() || undefined,
        paymentNotes.trim() || `Payment made to ${activeSupplier.name}`,
        paymentDate
      );

      showToast(`Payment of ₹${amt} made to ${activeSupplier.name} recorded successfully!`, 'success');
      triggerRefresh();

      // Reset form
      setPaymentAmount('');
      setPaymentRefNo('');
      setPaymentNotes('');
      setPaymentDate(getTodayDateString());
      setPaymentMode('BANK_TRANSFER');
    } catch (err: any) {
      showAlert(err?.message || 'Failed to record payment.', 'Error', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete supplier payment voucher
  const handleConfirmDelete = () => {
    if (!deleteDialog.logId) return;
    db.deleteSupplierLog(deleteDialog.logId);
    showToast(`Payment voucher ${deleteDialog.refNo} (₹${deleteDialog.amount}) deleted.`, 'success');
    triggerRefresh();
    setDeleteDialog({ isOpen: false, logId: '', supplierName: '', amount: 0, refNo: '' });
  };

  // Export payments table to Excel
  const handleExportExcel = () => {
    const exportRows = filteredVouchers.map((r, idx) => ({
      '#': idx + 1,
      'Payment Date': formatDateToDisplay(r.date),
      'Payment Voucher No': r.refNo || '-',
      'Supplier Name': r.supplierName,
      'Payment Mode': r.paymentMode || '-',
      'Amount Paid (₹)': r.paidAmount || 0,
      'Notes / Remarks': r.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Supplier Payments');
    XLSX.writeFile(wb, `Supplier_Payments_${getTodayDateString()}.xlsx`);
    showToast('Supplier payments register exported to Excel!', 'success');
  };

  return (
    <div className="supplier-payment-view" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* 1. TOP STATS BAR */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px'
        }}
      >
        {/* Total Supplier Payables */}
        <div
          style={{
            background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
            border: '2px solid #000000',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total Supplier Payables
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#B45309', marginTop: '4px' }}>
            ₹{supplierMetrics.totalPayables}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#78350F', fontWeight: 700, marginTop: '2px' }}>
            Unpaid purchases & opening dues across suppliers
          </div>
        </div>

        {/* Paid to Suppliers Today */}
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
            Paid Out Today
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#15803D', marginTop: '4px' }}>
            ₹{supplierMetrics.paidToday}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#14532D', fontWeight: 700, marginTop: '2px' }}>
            {formatDateToDisplay(getTodayDateString())}
          </div>
        </div>

        {/* Paid This Month */}
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
            Paid This Month
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#1D4ED8', marginTop: '4px' }}>
            ₹{supplierMetrics.paidThisMonth}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#1E3A8A', fontWeight: 700, marginTop: '2px' }}>
            Current Financial Cycle
          </div>
        </div>

        {/* Total Payment Vouchers */}
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
            Total Payment Vouchers
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#7E22CE', marginTop: '4px' }}>
            {supplierMetrics.totalVouchersCount} <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>Vouchers</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#581C87', fontWeight: 700, marginTop: '2px' }}>
            Payments made to vendors
          </div>
        </div>
      </div>

      {/* 2. MAIN SPLIT SECTION: PAY SUPPLIER FORM (LEFT) & REGISTER (RIGHT) */}
      <div
        className="sales-bottom-grid"
        style={{
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
                  background: '#002B99',
                  color: '#FFFFFF',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex'
                }}
              >
                <CreditCard size={20} />
              </div>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem', color: '#0F172A' }}>
                Pay Supplier / Payment Out
              </h3>
            </div>
            {activeSupplier && (
              <button
                type="button"
                onClick={() => openSupplierLedger(activeSupplier.id)}
                className="btn-classic"
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 8px',
                  background: '#EFF6FF',
                  color: '#1D4ED8',
                  borderColor: '#93C5FD'
                }}
                title="View full statement for this supplier"
              >
                <FileText size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                Ledger
              </button>
            )}
          </div>

          <form onSubmit={handleSubmitPayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Supplier Selector */}
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px', color: '#1E293B' }}>
                Select Supplier / Vendor *
              </label>
              <select
                className="input-text-clean"
                value={selectedSupplierId}
                onChange={e => setSelectedSupplierId(e.target.value)}
                required
                style={{
                  width: '100%',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  background: '#F8FAFC',
                  borderColor: '#002B99'
                }}
              >
                {suppliers.map(s => {
                  const bal = db.getSupplierBalanceSummary(s.id).outstandingPayable;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.city ? `(${s.city})` : ''} {bal > 0 ? `— Payable: ₹${bal}` : '— Settled'}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Dynamic Payable Balance Card */}
            {activeSupplier && (
              <div
                style={{
                  background: activeSupplierBalance.outstandingPayable > 0 ? '#FFFBEB' : '#F0FDF4',
                  border: `1.5px solid ${activeSupplierBalance.outstandingPayable > 0 ? '#FDE68A' : '#BBF7D0'}`,
                  borderRadius: '10px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569' }}>
                    Current Outstanding Payable:
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                    Opening: ₹{activeSupplierBalance.openingBalance} | Purchases: ₹{activeSupplierBalance.totalPurchased} | Paid: ₹{activeSupplierBalance.totalPaid}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '1.3rem',
                    fontWeight: 900,
                    color: activeSupplierBalance.outstandingPayable > 0 ? '#D97706' : '#16A34A'
                  }}
                >
                  ₹{activeSupplierBalance.outstandingPayable}
                </div>
              </div>
            )}

            {/* Payment Amount */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1E293B' }}>
                  Payment Amount to Pay (₹) *
                </label>
                {activeSupplierBalance.outstandingPayable > 0 && (
                  <button
                    type="button"
                    onClick={() => handleQuickAmount('PAYABLE')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#002B99',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Pay Full Due (₹{activeSupplierBalance.outstandingPayable})
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
                placeholder="Enter amount (e.g. 10000)"
                style={{
                  fontWeight: 900,
                  fontSize: '1.3rem',
                  color: '#002B99',
                  padding: '10px 14px'
                }}
              />

              {/* Quick Amount Presets */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                {[1000, 2000, 5000, 10000].map(preset => (
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
                  Payment Date *
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
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="UPI">UPI / Online / QR</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
            </div>

            {/* Reference / Txn No */}
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.82rem', marginBottom: '4px' }}>
                Reference / Txn / Cheque No.
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={paymentRefNo}
                onChange={e => setPaymentRefNo(e.target.value)}
                placeholder="e.g. NEFT-12345678, CHQ-5501"
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
                placeholder="e.g. Paid for Purchase bill PUR-1002"
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
                  background: '#002B99',
                  color: '#FFFFFF',
                  fontWeight: 900,
                  fontSize: '1rem',
                  padding: '10px 16px'
                }}
              >
                {isSubmitting ? 'Saving...' : 'Save Payment Voucher'}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT: SUPPLIER PAYMENTS REGISTER & HISTORY */}
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
                Supplier Payments Register
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                Showing {filteredVouchers.length} payment records
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
                placeholder="Search supplier, voucher no, notes..."
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
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="UPI">UPI / Online</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CASH">Cash</option>
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
          <div className="table-responsive-wrapper" style={{ border: '1.5px solid #000000', borderRadius: '8px' }}>
            <table className="table-clean" style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#002B99', color: '#FFFFFF', fontSize: '0.82rem' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: '45px' }}>#</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', width: '105px' }}>Date</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', width: '130px' }}>Voucher / Ref</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Supplier / Vendor</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: '120px' }}>Mode</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', width: '130px' }}>Amount Paid (₹)</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left' }}>Notes</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', width: '90px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>
                      No supplier payment vouchers found matching the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredVouchers.map((voucher, index) => {
                    const modeBg =
                      voucher.paymentMode === 'BANK_TRANSFER'
                        ? '#DBEAFE'
                        : voucher.paymentMode === 'UPI'
                        ? '#F3E8FF'
                        : voucher.paymentMode === 'CASH'
                        ? '#DCFCE7'
                        : '#FEF3C7';
                    const modeColor =
                      voucher.paymentMode === 'BANK_TRANSFER'
                        ? '#1D4ED8'
                        : voucher.paymentMode === 'UPI'
                        ? '#6B21A8'
                        : voucher.paymentMode === 'CASH'
                        ? '#15803D'
                        : '#B45309';

                    return (
                      <tr
                        key={voucher.id}
                        style={{
                          borderBottom: '1px solid #E2E8F0',
                          background: index % 2 === 0 ? '#FFFFFF' : '#F8FAFC'
                        }}
                      >
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#64748B' }}>
                          {index + 1}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, fontSize: '0.85rem' }}>
                          {formatDateToDisplay(voucher.date)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, color: '#002B99' }}>
                          {voucher.refNo || '-'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'left' }}>
                          <button
                            type="button"
                            onClick={() => openSupplierLedger(voucher.supplierId)}
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
                            title="Click to view Supplier Statement Ledger"
                          >
                            {voucher.supplierName}
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
                            {voucher.paymentMode || 'BANK_TRANSFER'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, fontSize: '1rem', color: '#002B99' }}>
                          ₹{voucher.paidAmount}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.82rem', color: '#475569' }}>
                          {voucher.notes || '-'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => setVoucherToPrint(voucher)}
                              className="btn-classic"
                              style={{ padding: '3px 6px', background: '#F1F5F9', borderColor: '#CBD5E1' }}
                              title="Print Payment Slip"
                            >
                              <Printer size={14} color="#334155" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setDeleteDialog({
                                  isOpen: true,
                                  logId: voucher.id,
                                  supplierName: voucher.supplierName,
                                  amount: voucher.paidAmount || 0,
                                  refNo: voucher.refNo
                                })
                              }
                              className="btn-classic"
                              style={{ padding: '3px 6px', background: '#FEE2E2', borderColor: '#FCA5A5' }}
                              title="Delete Payment Voucher"
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

      {/* DELETE PAYMENT CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Delete Supplier Payment"
        message={`Are you sure you want to delete payment voucher "${deleteDialog.refNo}" of ₹${deleteDialog.amount} for "${deleteDialog.supplierName}"? This will reverse the payment on the supplier ledger.`}
        confirmText="Yes, Delete Voucher"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteDialog({ isOpen: false, logId: '', supplierName: '', amount: 0, refNo: '' })}
      />

      {/* PRINTABLE PAYMENT VOUCHER SLIP MODAL */}
      {voucherToPrint && (
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
          onClick={() => setVoucherToPrint(null)}
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
              <div style={{ fontWeight: 900, fontSize: '1.2rem', color: '#002B99' }}>SUPPLIER PAYMENT VOUCHER</div>
              <div style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Raw Material Management System</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B', fontWeight: 700 }}>Voucher No:</span>
                <span style={{ fontWeight: 900, color: '#0F172A' }}>{voucherToPrint.refNo}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B', fontWeight: 700 }}>Payment Date:</span>
                <span style={{ fontWeight: 800 }}>{formatDateToDisplay(voucherToPrint.date)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B', fontWeight: 700 }}>Supplier Name:</span>
                <span style={{ fontWeight: 900, color: '#002B99' }}>{voucherToPrint.supplierName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B', fontWeight: 700 }}>Payment Mode:</span>
                <span style={{ fontWeight: 800 }}>{voucherToPrint.paymentMode || 'BANK_TRANSFER'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B', fontWeight: 700 }}>Notes / Remarks:</span>
                <span style={{ fontWeight: 700, color: '#475569' }}>{voucherToPrint.notes || '-'}</span>
              </div>

              <div
                style={{
                  background: '#EFF6FF',
                  border: '1.5px solid #93C5FD',
                  borderRadius: '8px',
                  padding: '12px',
                  marginTop: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontWeight: 900, fontSize: '0.95rem', color: '#1E40AF' }}>Amount Paid Out:</span>
                <span style={{ fontWeight: 900, fontSize: '1.4rem', color: '#1D4ED8' }}>₹{voucherToPrint.paidAmount}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setVoucherToPrint(null)}
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
