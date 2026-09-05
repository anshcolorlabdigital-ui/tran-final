import React from 'react';
import { Sale } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatDateToDisplay } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/calculations';

interface SalesPrintInvoiceProps {
  sale: Sale | null;
}

export const SalesPrintInvoice: React.FC<SalesPrintInvoiceProps> = ({ sale }) => {
  const { settings } = useApp();

  if (!sale) return null;

  return (
    <div
      className="print-only"
      style={{
        padding: '30px',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        fontFamily: 'Inter, sans-serif'
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000000', paddingBottom: '16px', marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.8rem', fontWeight: 900, textTransform: 'uppercase' }}>
          {settings.companyName}
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#4B5563', margin: '4px 0' }}>{settings.address}</p>
        <p style={{ fontSize: '0.85rem', color: '#4B5563' }}>
          Phone: {settings.phone} | GSTIN: {settings.gstin}
        </p>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          TAX INVOICE
        </h2>
      </div>

      {/* Bill & Party Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', border: '1px solid #000000', padding: '12px', marginBottom: '20px', borderRadius: '4px' }}>
        <div>
          <div style={{ fontSize: '0.85rem', color: '#4B5563', fontWeight: 700 }}>BILLED TO:</div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{sale.partyName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><strong>Invoice No:</strong> {sale.billNo}</div>
          <div><strong>Date:</strong> {formatDateToDisplay(sale.billDate)}</div>
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', border: '1px solid #000000' }}>
        <thead>
          <tr style={{ background: '#ECECEC', borderBottom: '1px solid #000000' }}>
            <th style={{ padding: '8px', textAlign: 'center', width: '50px', borderRight: '1px solid #000000' }}>#</th>
            <th style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #000000' }}>Item Description</th>
            <th style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #000000' }}>Basic</th>
            <th style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #000000' }}>GST %</th>
            <th style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #000000' }}>Rate</th>
            <th style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #000000' }}>Qty</th>
            <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item, index) => (
            <tr key={index} style={{ borderBottom: '1px solid #E5E7EB' }}>
              <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #000000' }}>{index + 1}</td>
              <td style={{ padding: '8px', fontWeight: 700, borderRight: '1px solid #000000' }}>{item.itemName}</td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #000000' }}>{formatCurrency(item.basicPrice, false)}</td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #000000' }}>{item.gstPercent}%</td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #000000' }}>{formatCurrency(item.salePrice, false)}</td>
              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, borderRight: '1px solid #000000' }}>{item.qty}</td>
              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800 }}>{formatCurrency(item.amount, false)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
        <div style={{ width: '280px', border: '1px solid #000000', padding: '12px', borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span>Basic Total:</span>
            <span>{formatCurrency(sale.basicTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span>GST Total:</span>
            <span>{formatCurrency(sale.gstTotal)}</span>
          </div>
          {sale.roundUp !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span>Round Off:</span>
              <span>{formatCurrency(sale.roundUp)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #000000', fontWeight: 900, fontSize: '1.15rem' }}>
            <span>BILL TOTAL:</span>
            <span>{formatCurrency(sale.billTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: '#4B5563' }}>
            <span>Recd Cash:</span>
            <span>{formatCurrency(sale.recdCash)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: '#4B5563' }}>
            <span>Recd UPI:</span>
            <span>{formatCurrency(sale.recdUpi)}</span>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', paddingTop: '10px' }}>
        <div>Customer Signature</div>
        <div>For {settings.companyName} (Authorized Signatory)</div>
      </div>
    </div>
  );
};
