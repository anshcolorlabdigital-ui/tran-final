import React, { useRef, useState } from 'react';
import { Modal } from '../common/Modal';
import { ReceiptData, downloadReceiptImage, shareToWhatsApp, shareReceiptNative, formatReceiptText } from '../../utils/shareUtils';
import { formatDateToDisplay } from '../../utils/dateUtils';
import { Download, Share2, MessageCircle, Copy, Check, Printer } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface OrderReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ReceiptData | null;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptData
}) => {
  const { showToast } = useApp();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [phone, setPhone] = useState('');

  if (!isOpen || !receiptData) return null;

  const handleDownload = async () => {
    if (receiptRef.current) {
      const filename = `Order_Receipt_${receiptData.date}.png`;
      const ok = await downloadReceiptImage(receiptRef.current, filename);
      if (ok) {
        showToast('Receipt image downloaded successfully!', 'success');
      } else {
        showToast('Could not generate image. Text copied instead.', 'info');
      }
    }
  };

  const handleWhatsApp = () => {
    shareToWhatsApp(receiptData, phone);
  };

  const handleNativeShare = async () => {
    if (receiptRef.current) {
      await shareReceiptNative(receiptRef.current, receiptData);
    }
  };

  const handleCopyText = () => {
    const text = formatReceiptText(receiptData);
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('Receipt text copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Order Receipt / Share" maxWidth="600px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Action bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleDownload}
              className="btn-lime-action"
              style={{ fontSize: '0.82rem', padding: '6px 14px' }}
            >
              <Download size={15} />
              Download Image
            </button>
            <button
              onClick={handleNativeShare}
              style={{
                background: '#FFFFFF',
                border: '1px solid #000000',
                borderRadius: '20px',
                padding: '6px 14px',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Share2 size={15} />
              Share
            </button>
            <button
              onClick={handleCopyText}
              style={{
                background: '#FFFFFF',
                border: '1px solid #000000',
                borderRadius: '20px',
                padding: '6px 14px',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {copied ? <Check size={15} color="#16A34A" /> : <Copy size={15} />}
              {copied ? 'Copied' : 'Copy Text'}
            </button>
          </div>

          <button
            onClick={handlePrint}
            style={{
              background: '#FFFFFF',
              border: '1px solid #000000',
              borderRadius: '20px',
              padding: '6px 14px',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Printer size={15} />
            Print
          </button>
        </div>

        {/* WhatsApp Direct Share input */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#F3F4F6', padding: '8px 12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
          <MessageCircle size={18} color="#16A34A" />
          <input
            type="tel"
            placeholder="Supplier WhatsApp No. (optional)"
            className="input-text-clean"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            style={{ flex: 1, padding: '4px 8px', fontSize: '0.85rem' }}
          />
          <button
            onClick={handleWhatsApp}
            style={{
              backgroundColor: '#25D366',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '20px',
              padding: '6px 16px',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Send WhatsApp
          </button>
        </div>

        {/* The Clean Receipt (Captured for Image Export) */}
        {/* IMPORTANT: Shows ONLY S.No., Date, Item, Quantity. NO SUPPLIER NAME. NO INTERNAL DB IDs. */}
        <div
          ref={receiptRef}
          style={{
            backgroundColor: '#FFFFFF',
            border: '2px solid #000000',
            borderRadius: '8px',
            padding: '24px',
            fontFamily: 'Inter, sans-serif',
            color: '#000000',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #000000', paddingBottom: '12px', marginBottom: '16px' }}>
            <h2
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 900,
                fontSize: '1.4rem',
                letterSpacing: '0.1em',
                textTransform: 'uppercase'
              }}
            >
              ORDER
            </h2>
            <div style={{ marginTop: '4px', fontWeight: 800, fontSize: '0.95rem' }}>
              Date: {formatDateToDisplay(receiptData.date)}
            </div>
          </div>

          {/* Table */}
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              marginBottom: '16px'
            }}
          >
            <thead>
              <tr style={{ borderBottom: '2px solid #000000' }}>
                <th style={{ padding: '8px 12px', fontWeight: 800, fontSize: '0.95rem' }}>Item</th>
                <th style={{ padding: '8px 12px', fontWeight: 800, fontSize: '0.95rem', textAlign: 'right', width: '90px' }}>Qty</th>
              </tr>
            </thead>
            <tbody>
              {receiptData.items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: '0.95rem' }}>
                    <div>{item.itemName}</div>
                    {item.description && item.description.trim() && (
                      <div style={{ fontSize: '0.78rem', color: '#6B7280', fontWeight: 500, marginTop: '2px' }}>
                        {item.description.trim()}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '8px 12px',
                      fontWeight: 800,
                      fontSize: '1rem',
                      textAlign: 'right',
                      color: '#EA3943'
                    }}
                  >
                    {item.qty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Remark / Note section if provided */}
          {receiptData.notes && receiptData.notes.trim() && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 14px',
                backgroundColor: '#FEF3C7',
                border: '1.5px solid #F59E0B',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#92400E',
                textAlign: 'left'
              }}
            >
              <span style={{ fontWeight: 900, textTransform: 'uppercase', marginRight: '6px' }}>Remark:</span>
              {receiptData.notes.trim()}
            </div>
          )}

          {/* Footer note */}
          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#6B7280', paddingTop: '10px', marginTop: '12px', borderTop: '1px dashed #9CA3AF' }}>
            Total Items: {receiptData.items.length} | Total Quantity: {receiptData.items.reduce((a, b) => a + Number(b.qty || 0), 0)}
          </div>
        </div>
      </div>
    </Modal>
  );
};
