import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { SupplierOrder, Purchase, PurchaseItem } from '../../types';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { StockEngine } from '../../db/stockEngine';
import { getTodayDateString, formatDateToDisplay } from '../../utils/dateUtils';
import { calculateItemPricing, calculateBillSummary } from '../../utils/calculations';
import { CheckCircle2, PackageCheck } from 'lucide-react';

interface OrderReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: SupplierOrder | null;
}

export const OrderReceiveModal: React.FC<OrderReceiveModalProps> = ({
  isOpen,
  onClose,
  order
}) => {
  const { showToast } = useApp();
  const [recdDate, setRecdDate] = useState<string>(getTodayDateString());
  const [billNo, setBillNo] = useState<string>('');
  const [receivingQuantities, setReceivingQuantities] = useState<{ [itemId: string]: number }>({});

  useEffect(() => {
    if (order && isOpen) {
      setBillNo(StockEngine.getNextBillNumber('PURCHASE'));
      const initialQtys: { [itemId: string]: number } = {};
      order.items.forEach(item => {
        const remaining = Math.max(0, item.orderedQty - (item.receivedQty || 0));
        initialQtys[item.itemId] = remaining;
      });
      setReceivingQuantities(initialQtys);
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const handleQtyChange = (itemId: string, val: string) => {
    const num = Number(val) || 0;
    setReceivingQuantities(prev => ({
      ...prev,
      [itemId]: num
    }));
  };

  const handleConfirmReceive = () => {
    // Check that at least one item is being received
    const totalRecd = Object.values(receivingQuantities).reduce((a, b) => a + b, 0);
    if (totalRecd <= 0) {
      showToast('Please enter a receiving quantity greater than 0', 'error');
      return;
    }

    const itemsDb = db.getItems();
    const purchaseItems: PurchaseItem[] = [];

    // Create Purchase Items for received items
    order.items.forEach(ordItem => {
      const recdNow = receivingQuantities[ordItem.itemId] || 0;
      if (recdNow > 0) {
        const itemMaster = itemsDb.find(i => i.id === ordItem.itemId);
        const basicPrice = itemMaster?.purchaseRate || 25;
        const gstPercent = itemMaster?.gstPercent || 18;

        const pricing = calculateItemPricing(basicPrice, gstPercent, 0, recdNow);

        purchaseItems.push({
          id: `pur-item-${Date.now()}-${Math.random()}`,
          itemId: ordItem.itemId,
          sno: ordItem.sno,
          itemName: ordItem.itemName,
          basicPrice: pricing.basicPrice,
          gstPercent: pricing.gstPercent,
          gstAmt: pricing.gstAmt,
          nettPrice: pricing.nettPrice,
          toPercent: 0,
          roundup: 0,
          salePrice: pricing.salePrice,
          qty: recdNow,
          amount: pricing.amount
        });
      }
    });

    const summary = calculateBillSummary(purchaseItems);

    const newPurchase: Purchase = {
      id: `pur-${Date.now()}`,
      billNo: billNo || StockEngine.getNextBillNumber('PURCHASE'),
      billDate: order.orderDate,
      recdDate,
      supplierId: order.supplierId,
      supplierName: order.supplierName,
      orderId: order.id,
      items: purchaseItems,
      basicTotal: summary.basicTotal,
      gstTotal: summary.gstTotal,
      roundUp: summary.roundUp,
      billTotal: summary.billTotal,
      recdCash: 0,
      recdUpi: 0,
      notes: `Received from Order ${order.orderNumber}`,
      createdAt: new Date().toISOString()
    };

    // Saving the purchase automatically increases physical stock through the stock ledger!
    db.savePurchase(newPurchase);

    showToast(`Received ${totalRecd} items from Order ${order.orderNumber}! Stock updated.`, 'success');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Receive Goods - Order ${order.orderNumber}`} maxWidth="750px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Order Details Header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: '#F3F4F6', padding: '12px', borderRadius: '8px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 700 }}>SUPPLIER</span>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>{order.supplierName}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 700 }}>ORDER DATE</span>
            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{formatDateToDisplay(order.orderDate)}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 700 }}>STATUS</span>
            <div>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: order.status === 'RECEIVED' ? '#DCFCE7' : '#FEF3C7',
                  color: order.status === 'RECEIVED' ? '#166534' : '#92400E'
                }}
              >
                {order.status}
              </span>
            </div>
          </div>
        </div>

        {/* Receiving Parameters */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>
              Received Date *
            </label>
            <input
              type="date"
              className="input-text-clean"
              value={recdDate}
              onChange={e => setRecdDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>
              Purchase / Inward Bill No. *
            </label>
            <input
              type="text"
              className="input-text-clean"
              value={billNo}
              onChange={e => setBillNo(e.target.value)}
              placeholder="e.g. PUR-101"
              required
            />
          </div>
        </div>

        {/* Receiving items table */}
        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>S.No.</th>
                <th>Item Name</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Ordered</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Prev Recd</th>
                <th style={{ width: '120px', textAlign: 'center', color: '#15803D' }}>Receive Now</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map(item => {
                const prevRecd = item.receivedQty || 0;
                const remaining = Math.max(0, item.orderedQty - prevRecd);
                const recdNow = receivingQuantities[item.itemId] ?? remaining;

                return (
                  <tr key={item.id}>
                    <td style={{ fontFamily: 'monospace' }}>{item.sno}</td>
                    <td style={{ fontWeight: 700 }}>{item.itemName}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.orderedQty}</td>
                    <td style={{ textAlign: 'center', color: '#6B7280' }}>{prevRecd}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        max={remaining}
                        className="input-text-clean"
                        value={recdNow}
                        onChange={e => handleQtyChange(item.itemId, e.target.value)}
                        style={{
                          width: '90px',
                          textAlign: 'center',
                          fontWeight: 800,
                          color: '#15803D',
                          border: '2px solid #16A34A'
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ background: '#FEF3C7', padding: '10px 14px', borderRadius: '6px', border: '1px solid #FDE68A', fontSize: '0.85rem', color: '#92400E' }}>
          <strong>Stock Note:</strong> Confirming receipt will automatically increase the physical stock ledger and record an inward purchase entry.
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: '1px solid #9CA3AF',
              background: '#F3F4F6',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmReceive}
            className="btn-lime-action"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <PackageCheck size={16} />
            Confirm Stock Inward
          </button>
        </div>
      </div>
    </Modal>
  );
};
