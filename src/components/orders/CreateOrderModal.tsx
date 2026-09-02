import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { Item, Supplier, SupplierOrder, OrderItem } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { getTodayDateString } from '../../utils/dateUtils';
import { Plus, Trash2 } from 'lucide-react';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (order: SupplierOrder) => void;
}

interface DraftOrderItem {
  id: string;
  sno: string;
  itemId: string;
  itemName: string;
  qty: number;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated
}) => {
  const { showToast, openQuickModal, refreshKey } = useApp();
  const [itemsList, setItemsList] = useState<Item[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);

  const [orderDate, setOrderDate] = useState<string>(getTodayDateString());
  const [supplierId, setSupplierId] = useState<string>('');

  // Line item input state with bidirectional lookup
  const [currentSno, setCurrentSno] = useState<string>('');
  const [currentItemId, setCurrentItemId] = useState<string>('');
  const [currentQty, setCurrentQty] = useState<string>('1');

  // Draft items in current order
  const [draftItems, setDraftItems] = useState<DraftOrderItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      const items = db.getItems().filter(i => i.isActive !== false);
      const suppliers = db.getSuppliers().filter(s => s.isActive !== false);
      setItemsList(items);
      setSuppliersList(suppliers);
      if (suppliers.length > 0 && !supplierId) {
        setSupplierId(suppliers[0].id);
      }
    }
  }, [isOpen, refreshKey]);

  if (!isOpen) return null;

  // BIDIRECTIONAL LOOKUP: Handle S.No. change
  const handleSnoChange = (val: string) => {
    setCurrentSno(val);
    const matched = itemsList.find(i => i.sno.trim().toLowerCase() === val.trim().toLowerCase());
    if (matched) {
      setCurrentItemId(matched.id);
    }
  };

  // BIDIRECTIONAL LOOKUP: Handle Item dropdown change
  const handleItemChange = (val: string) => {
    setCurrentItemId(val);
    const matched = itemsList.find(i => i.id === val);
    if (matched) {
      setCurrentSno(matched.sno);
    }
  };

  // Add Item to Order list
  const handleAddItemToDraft = () => {
    if (!currentItemId) {
      showToast('Please select an item', 'error');
      return;
    }
    const qty = Number(currentQty);
    if (!qty || qty <= 0) {
      showToast('Quantity must be greater than 0', 'error');
      return;
    }

    const item = itemsList.find(i => i.id === currentItemId);
    if (!item) return;

    setDraftItems(prev => [
      ...prev,
      {
        id: `draft-${Date.now()}-${Math.random()}`,
        sno: item.sno,
        itemId: item.id,
        itemName: item.name,
        qty
      }
    ]);

    // Reset input fields
    setCurrentSno('');
    setCurrentItemId('');
    setCurrentQty('1');
  };

  const handleRemoveDraftItem = (id: string) => {
    setDraftItems(prev => prev.filter(i => i.id !== id));
  };

  const handleSaveOrder = () => {
    if (!supplierId) {
      showToast('Please select a supplier', 'error');
      return;
    }
    if (draftItems.length === 0) {
      showToast('Please add at least one item to the order', 'error');
      return;
    }

    const supplier = suppliersList.find(s => s.id === supplierId);
    const orderNumber = StockEngine.getNextBillNumber('ORDER');

    const orderItems: OrderItem[] = draftItems.map(d => ({
      id: `ord-item-${Date.now()}-${Math.random()}`,
      sno: d.sno,
      itemId: d.itemId,
      itemName: d.itemName,
      orderedQty: d.qty,
      receivedQty: 0,
      supplierId: supplier?.id,
      supplierName: supplier?.name,
      orderDate,
      status: 'ORDERED'
    }));

    const newOrder: SupplierOrder = {
      id: `ord-${Date.now()}`,
      orderNumber,
      orderDate,
      supplierId: supplier?.id || '',
      supplierName: supplier?.name || '',
      status: 'ORDERED',
      items: orderItems,
      createdAt: new Date().toISOString()
    };

    // Save order: Note that creating order does NOT increase stock!
    db.saveOrder(newOrder);
    showToast(`Order ${orderNumber} placed with ${supplier?.name}!`, 'success');

    if (onOrderCreated) {
      onOrderCreated(newOrder);
    }

    setDraftItems([]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Supplier Order" maxWidth="700px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Top order info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>
              Order Date
            </label>
            <input
              type="date"
              className="input-text-clean"
              value={orderDate}
              onChange={e => setOrderDate(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '4px' }}>
              Supplier *
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <select
                className="input-text-clean"
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">-- Select Supplier --</option>
                {suppliersList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-quick-n"
                title="Quick Add Supplier"
                onClick={() => openQuickModal('SUPPLIER', (newId) => setSupplierId(newId))}
              >
                N
              </button>
            </div>
          </div>
        </div>

        {/* Item Entry Strip with Bidirectional Lookup */}
        <div
          style={{
            background: '#F3F4F6',
            border: '1px solid #D1D5DB',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', color: '#374151' }}>
            Add Item (Bidirectional Lookup by S.No. or Name)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px auto', gap: '8px', alignItems: 'flex-end' }}>
            {/* S.No Input */}
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.75rem', marginBottom: '2px' }}>
                S.No. / Code
              </label>
              <input
                type="text"
                className="input-text-clean"
                placeholder="1456"
                value={currentSno}
                onChange={e => handleSnoChange(e.target.value)}
              />
            </div>

            {/* Item Dropdown */}
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.75rem', marginBottom: '2px' }}>
                Item Name
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <select
                  className="input-text-clean"
                  value={currentItemId}
                  onChange={e => handleItemChange(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">-- Choose Item --</option>
                  {itemsList.map(i => (
                    <option key={i.id} value={i.id}>
                      [{i.sno}] {i.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-quick-n"
                  title="Quick Add Item"
                  onClick={() => openQuickModal('ITEM', (newId) => {
                    handleItemChange(newId);
                  })}
                >
                  N
                </button>
              </div>
            </div>

            {/* Qty Input */}
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.75rem', marginBottom: '2px', color: '#EA3943' }}>
                Qty *
              </label>
              <input
                type="number"
                min="1"
                className="input-text-clean"
                value={currentQty}
                onChange={e => setCurrentQty(e.target.value)}
                style={{ fontWeight: 800, color: '#EA3943' }}
              />
            </div>

            {/* Add Button */}
            <button
              type="button"
              onClick={handleAddItemToDraft}
              className="btn-lime-action"
              style={{ padding: '7px 14px', height: '36px' }}
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>

        {/* Draft Items Table */}
        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>S.No.</th>
                <th>Item Name</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Qty</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Del</th>
              </tr>
            </thead>
            <tbody>
              {draftItems.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#9CA3AF', padding: '16px' }}>
                    No items added yet. Enter S.No. or select an item above.
                  </td>
                </tr>
              ) : (
                draftItems.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontFamily: 'monospace' }}>{d.sno}</td>
                    <td>{d.itemName}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: '#EA3943' }}>{d.qty}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveDraftItem(d.id)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#EA3943' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
            onClick={handleSaveOrder}
            className="btn-red-action"
            disabled={draftItems.length === 0}
          >
            Place Supplier Order
          </button>
        </div>
      </div>
    </Modal>
  );
};
