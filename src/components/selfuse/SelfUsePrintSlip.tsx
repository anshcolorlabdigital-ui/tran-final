import React from 'react';
import { SelfUse } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatDateToDisplay } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/calculations';

interface SelfUsePrintSlipProps {
  selfUse: SelfUse | null;
}

export const SelfUsePrintSlip: React.FC<SelfUsePrintSlipProps> = ({ selfUse }) => {
  const { settings } = useApp();

  if (!selfUse) return null;

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
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000000', paddingBottom: '16px', marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.8rem', fontWeight: 900, textTransform: 'uppercase' }}>
          {settings.companyName}
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#4B5563', margin: '4px 0' }}>{settings.address}</p>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          INTERNAL CONSUMPTION / SELF USE SLIP
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', border: '1px solid #000000', padding: '12px', marginBottom: '20px', borderRadius: '4px' }}>
        <div>
          <div><strong>Voucher No:</strong> {selfUse.billNo}</div>
          <div><strong>Date:</strong> {formatDateToDisplay(selfUse.billDate)}</div>
        </div>
        <div>
          <div><strong>Department / Purpose:</strong> {selfUse.remarks || 'In-House Production & Operations'}</div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', border: '1px solid #000000' }}>
        <thead>
          <tr style={{ background: '#ECECEC', borderBottom: '1px solid #000000' }}>
            <th style={{ padding: '8px', textAlign: 'center', width: '50px', borderRight: '1px solid #000000' }}>#</th>
            <th style={{ padding: '8px', textAlign: 'left', borderRight: '1px solid #000000' }}>Item Description</th>
            <th style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #000000' }}>Rate</th>
            <th style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #000000' }}>Qty Used</th>
            <th style={{ padding: '8px', textAlign: 'right' }}>Cost Amount</th>
          </tr>
        </thead>
        <tbody>
          {selfUse.items.map((item, index) => (
            <tr key={index} style={{ borderBottom: '1px solid #E5E7EB' }}>
              <td style={{ padding: '8px', textAlign: 'center', borderRight: '1px solid #000000' }}>{index + 1}</td>
              <td style={{ padding: '8px', fontWeight: 700, borderRight: '1px solid #000000' }}>{item.itemName}</td>
              <td style={{ padding: '8px', textAlign: 'right', borderRight: '1px solid #000000' }}>{formatCurrency(item.rate, false)}</td>
              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800, color: '#EA3943', borderRight: '1px solid #000000' }}>{item.qty}</td>
              <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800 }}>{formatCurrency(item.amount, false)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#ECECEC', borderTop: '2px solid #000000' }}>
            <td colSpan={4} style={{ padding: '8px', textAlign: 'right', fontWeight: 900, borderRight: '1px solid #000000' }}>
              TOTAL INTERNAL COST:
            </td>
            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 900 }}>
              {formatCurrency(selfUse.totalAmount)}
            </td>
          </tr>
        </tfoot>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px' }}>
        <div>Issued By (Store Manager)</div>
        <div>Received / Consumed By</div>
      </div>
    </div>
  );
};
