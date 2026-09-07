import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { getTodayDateString, formatDateToDisplay } from '../../utils/dateUtils';
import { X, CheckCircle2, DollarSign, CreditCard, Building2, AlertCircle } from 'lucide-react';

interface SupplierPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSupplierId?: string | null;
}

export const SupplierPaymentModal: React.FC<SupplierPaymentModalProps> = ({
  isOpen,
  onClose,
  initialSupplierId
}) => {
  const { showToast, showAlert, triggerRefresh, refreshKey } = useApp();

  const suppliers = useMemo(() => {
    return db.getSuppliers().filter(s => s.isActive !== false);
  }, [refreshKey]);

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(getTodayDateString());
  const [paymentMode, setPaymentMode] = useState<'BANK_TRANSFER' | 'UPI' | 'CHEQUE' | 'CASH'>('BANK_TRANSFER');
  const [paymentRefNo, setPaymentRefNo] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (initialSupplierId) {
        setSelectedSupplierId(initialSupplierId);
      } else if (suppliers.length > 0) {
        setSelectedSupplierId(suppliers[0].id);
      }
      setPaymentAmount('');
      setPaymentDate(getTodayDateString());
      setPaymentMode('BANK_TRANSFER');
      setPaymentRefNo('');
      setPaymentNotes('');
    }
  }, [isOpen, initialSupplierId, suppliers]);

  const activeSupplier = useMemo(() => {
    return suppliers.find(s => s.id === selectedSupplierId);
  }, [suppliers, selectedSupplierId]);

  const balanceSummary = useMemo(() => {
    if (!selectedSupplierId) return { outstandingPayable: 0, totalPurchased: 0, totalPaid: 0, openingBalance: 0 };
    return db.getSupplierBalanceSummary(selectedSupplierId);
  }, [selectedSupplierId, refreshKey]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || !activeSupplier) {
      showAlert('Please select a supplier.', 'Validation Error', 'error');
      return;
    }

    const amt = parseFloat(paymentAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      showAlert('Please enter a valid positive payment amount.', 'Invalid Amount', 'error');
      return;
    }

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
    onClose();
  };

  return (
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
      onClick={onClose}
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
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            background: '#002B99',
            color: '#FFFFFF',
            padding: '14px 18px',
            borderBottom: '2px solid #000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={20} />
            <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.15rem' }}>
              Pay Supplier / Record Payment
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* MODAL BODY */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: 'calc(90vh - 70px)', overflowY: 'auto' }}>
          {/* Supplier Selector */}
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
              Select Supplier *
            </label>
            <select
              className="input-text-clean"
              value={selectedSupplierId}
              onChange={e => setSelectedSupplierId(e.target.value)}
              required
              style={{ fontWeight: 800, fontSize: '0.95rem', borderColor: '#002B99' }}
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

          {/* Current Payable Summary Card */}
          {activeSupplier && (
            <div
              style={{
                background: balanceSummary.outstandingPayable > 0 ? '#FFFBEB' : '#F0FDF4',
                border: `1.5px solid ${balanceSummary.outstandingPayable > 0 ? '#FDE68A' : '#BBF7D0'}`,
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569' }}>
                  Current Outstanding Payable:
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748B' }}>
                  Opening: ₹{balanceSummary.openingBalance} | Purchases: ₹{balanceSummary.totalPurchased} | Paid: ₹{balanceSummary.totalPaid}
                </div>
              </div>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  color: balanceSummary.outstandingPayable > 0 ? '#D97706' : '#16A34A'
                }}
              >
                ₹{balanceSummary.outstandingPayable}
              </div>
            </div>
          )}

          {/* Payment Amount */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                Payment Amount (₹) *
              </label>
              {balanceSummary.outstandingPayable > 0 && (
                <button
                  type="button"
                  onClick={() => setPaymentAmount(String(balanceSummary.outstandingPayable))}
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
                  Pay Full Payable (₹{balanceSummary.outstandingPayable})
                </button>
              )}
            </div>
            <input
              type="number"
              step="any"
              min="0.01"
              required
              autoFocus
              className="input-text-clean"
              placeholder="Enter amount paid"
              value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value)}
              style={{ fontWeight: 900, fontSize: '1.15rem', color: '#002B99' }}
            />
          </div>

          {/* Payment Date & Mode */}
          <div className="form-grid-2col">
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
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
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
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
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
              Reference / Txn / Cheque No.
            </label>
            <input
              type="text"
              className="input-text-clean"
              placeholder="e.g. NEFT-98765432, CHQ-1002"
              value={paymentRefNo}
              onChange={e => setPaymentRefNo(e.target.value)}
            />
          </div>

          {/* Notes / Remarks */}
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
              Notes / Remarks
            </label>
            <input
              type="text"
              className="input-text-clean"
              placeholder="e.g. Cleared bill PUR-1002, Advance payment"
              value={paymentNotes}
              onChange={e => setPaymentNotes(e.target.value)}
            />
          </div>

          {/* Footer Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-classic"
              style={{ background: '#F1F5F9', color: '#334155' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-classic"
              style={{ background: '#002B99', color: '#FFFFFF', fontWeight: 900, padding: '8px 20px' }}
            >
              Save Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
