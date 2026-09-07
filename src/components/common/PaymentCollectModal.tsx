import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { getTodayDateString, formatDateToDisplay } from '../../utils/dateUtils';
import { X, CheckCircle2, DollarSign, CreditCard, User, AlertCircle } from 'lucide-react';

interface PaymentCollectModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPartyId?: string | null;
}

export const PaymentCollectModal: React.FC<PaymentCollectModalProps> = ({
  isOpen,
  onClose,
  initialPartyId
}) => {
  const { showToast, showAlert, triggerRefresh, refreshKey } = useApp();

  const parties = useMemo(() => {
    return db.getParties().filter(p => p.isActive !== false);
  }, [refreshKey]);

  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(getTodayDateString());
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'CASH' | 'CHEQUE' | 'BANK_TRANSFER'>('UPI');
  const [paymentRefNo, setPaymentRefNo] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (initialPartyId) {
        setSelectedPartyId(initialPartyId);
      } else if (parties.length > 0) {
        setSelectedPartyId(parties[0].id);
      }
      setPaymentAmount('');
      setPaymentDate(getTodayDateString());
      setPaymentMode('UPI');
      setPaymentRefNo('');
      setPaymentNotes('');
    }
  }, [isOpen, initialPartyId, parties]);

  const activeParty = useMemo(() => {
    return parties.find(p => p.id === selectedPartyId);
  }, [parties, selectedPartyId]);

  const balanceSummary = useMemo(() => {
    if (!selectedPartyId) return { outstandingBalance: 0, totalBilled: 0, totalPaid: 0, openingBalance: 0 };
    return db.getPartyBalanceSummary(selectedPartyId);
  }, [selectedPartyId, refreshKey]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartyId || !activeParty) {
      showAlert('Please select a customer / party.', 'Validation Error', 'error');
      return;
    }

    const amt = parseFloat(paymentAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      showAlert('Please enter a valid positive payment amount.', 'Invalid Amount', 'error');
      return;
    }

    db.recordPartyPayment(
      selectedPartyId,
      amt,
      paymentMode,
      paymentRefNo.trim() || undefined,
      paymentNotes.trim() || `Payment received from ${activeParty.name}`,
      paymentDate
    );

    showToast(`Payment receipt of ₹${amt} recorded successfully for ${activeParty.name}!`, 'success');
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
          maxWidth: '540px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={20} color="#002B99" />
            <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem', color: '#002B99' }}>
              COLLECT PAYMENT RECEIPT
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1F2937'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: 'calc(90vh - 70px)', overflowY: 'auto' }}>
          {/* Party Selector */}
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', color: '#374151', marginBottom: '4px' }}>
              Select Customer / Party *
            </label>
            <select
              className="input-text-clean"
              value={selectedPartyId}
              onChange={e => setSelectedPartyId(e.target.value)}
              style={{
                width: '100%',
                fontWeight: 800,
                fontSize: '0.95rem',
                background: '#FFFFFF',
                borderColor: '#002B99',
                padding: '8px 10px'
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

          {/* Outstanding Balance Banner */}
          {activeParty && (
            <div
              style={{
                background: balanceSummary.outstandingBalance > 0 ? '#FEF2F2' : '#F0FDF4',
                border: '1.5px solid #000000',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                  {activeParty.name} {activeParty.partyType === 'DEALER' ? '🏢 (Dealer)' : '👤 (Amateur)'}
                </span>
                <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                  Total Billed: ₹{balanceSummary.totalBilled} • Total Paid: ₹{balanceSummary.totalPaid}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'block' }}>
                  Current Due
                </span>
                <span
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    color: balanceSummary.outstandingBalance > 0 ? '#DC2626' : '#16A34A'
                  }}
                >
                  ₹{balanceSummary.outstandingBalance}
                </span>
              </div>
            </div>
          )}

          {/* Amount & Date in 2 columns */}
          <div className="form-grid-2col">
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', color: '#166534', marginBottom: '4px' }}>
                Payment Amount (₹) *
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                autoFocus
                className="input-text-clean"
                placeholder="Enter amount"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                style={{
                  fontWeight: 900,
                  fontSize: '1.15rem',
                  color: '#16A34A',
                  borderColor: '#16A34A',
                  background: '#F0FDF4'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', color: '#374151', marginBottom: '4px' }}>
                Date
              </label>
              <input
                type="date"
                className="input-text-clean"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                style={{ width: '100%', fontWeight: 700 }}
              />
            </div>
          </div>

          {/* Mode & Ref No */}
          <div className="form-grid-2col">
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', color: '#374151', marginBottom: '4px' }}>
                Payment Method *
              </label>
              <select
                className="input-text-clean"
                value={paymentMode}
                onChange={e => setPaymentMode(e.target.value as any)}
                style={{ fontWeight: 800, width: '100%' }}
              >
                <option value="UPI">UPI / Online QR</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', color: '#374151', marginBottom: '4px' }}>
                Reference / Txn No.
              </label>
              <input
                type="text"
                className="input-text-clean"
                placeholder="e.g. UPI-98765 / CHQ-1002"
                value={paymentRefNo}
                onChange={e => setPaymentRefNo(e.target.value)}
                style={{ fontWeight: 700 }}
              />
            </div>
          </div>

          {/* Notes / Remarks */}
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', color: '#374151', marginBottom: '4px' }}>
              Notes / Remark
            </label>
            <input
              type="text"
              className="input-text-clean"
              placeholder="e.g. Received part payment for bill INV-1001"
              value={paymentNotes}
              onChange={e => setPaymentNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-classic"
              style={{
                background: '#F1F5F9',
                color: '#334155',
                border: '1.5px solid #000000',
                padding: '8px 16px',
                fontWeight: 800
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-classic"
              style={{
                background: '#16A34A',
                color: '#FFFFFF',
                border: '1.5px solid #000000',
                padding: '8px 20px',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <CheckCircle2 size={16} />
              <span>Save Payment Receipt</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
