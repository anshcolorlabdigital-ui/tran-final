import React, { useState, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { SupplierOrder, OrderItem, Supplier, ItemStockSummary } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { formatDateToDisplay, getTodayDateString } from '../../utils/dateUtils';
import { OrderReceiptModal } from './OrderReceiptModal';
import { CreateOrderModal } from './CreateOrderModal';
import { OrderReceiveModal } from './OrderReceiveModal';
import { ReceiptData } from '../../utils/shareUtils';
import { Plus, Trash2, CheckCircle2, Share2, PackageCheck } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface PendingRowState {
  itemId: string;
  sno: string;
  name: string;
  qty: number;
  selectedSupplierId: string;
}

export const OrdersView: React.FC = () => {
  const { refreshKey, showToast, selectedDate } = useApp();

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [activeReceiptData, setActiveReceiptData] = useState<ReceiptData | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [selectedOrderForReceive, setSelectedOrderForReceive] = useState<SupplierOrder | null>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    orderId?: string;
    itemId?: string;
  }>({ isOpen: false });

  // Load suppliers and existing orders
  const suppliers = useMemo(() => db.getSuppliers().filter(s => s.isActive !== false), [refreshKey]);
  const existingOrders = useMemo(() => db.getOrders(), [refreshKey]);
  const lowStockSummaries = useMemo(() => StockEngine.getLowStockItems(), [refreshKey]);

  // Pending quantities map for low-stock items
  const [pendingOverrides, setPendingOverrides] = useState<{ [itemId: string]: number }>({});

  // Active unplaced or active placed orders
  const placedOrders = useMemo(() => {
    return existingOrders.filter(o => o.status === 'ORDERED' || o.status === 'PARTIALLY_RECEIVED');
  }, [existingOrders]);

  // Low stock items that do NOT have an active placed order
  const pendingLowStockItems = useMemo(() => {
    return lowStockSummaries.filter(summary => {
      const isAlreadyInActiveOrder = placedOrders.some(order =>
        order.items.some(oi => oi.itemId === summary.item.id)
      );
      return !isAlreadyInActiveOrder;
    });
  }, [lowStockSummaries, placedOrders]);

  // Handle supplier assignment for a pending item
  const handleAssignSupplierToPending = (summary: ItemStockSummary, supplierId: string) => {
    if (!supplierId) return;

    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;

    const qtyToOrder = pendingOverrides[summary.item.id] ?? Math.max(1, summary.item.minStock * 2 || 10);
    const orderDate = getTodayDateString();

    // Check if there is already an active order draft for this supplier created today
    const existingSupplierOrder = placedOrders.find(
      o => o.supplierId === supplierId && o.orderDate === orderDate
    );

    const newOrderItem: OrderItem = {
      id: `ord-item-${Date.now()}-${Math.random()}`,
      sno: summary.item.sno,
      itemId: summary.item.id,
      itemName: summary.item.name,
      orderedQty: qtyToOrder,
      receivedQty: 0,
      supplierId: supplier.id,
      supplierName: supplier.name,
      orderDate,
      status: 'ORDERED'
    };

    if (existingSupplierOrder) {
      // Append to existing supplier group
      existingSupplierOrder.items.push(newOrderItem);
      db.saveOrder(existingSupplierOrder);
    } else {
      // Create new supplier order group
      const newOrder: SupplierOrder = {
        id: `ord-${Date.now()}`,
        orderNumber: StockEngine.getNextBillNumber('ORDER'),
        orderDate,
        supplierId: supplier.id,
        supplierName: supplier.name,
        status: 'ORDERED',
        items: [newOrderItem],
        createdAt: new Date().toISOString()
      };
      db.saveOrder(newOrder);
    }

    showToast(`Added "${summary.item.name}" to ${supplier.name} order group!`, 'success');
  };

  // Trigger ORDER DONE
  const handleOrderDone = (order: SupplierOrder) => {
    // Generate clean receipt (Contains ONLY S.No., Date, Item, Quantity)
    const receiptData: ReceiptData = {
      date: order.orderDate,
      items: order.items.map(item => ({
        sno: item.sno,
        itemName: item.itemName,
        qty: item.orderedQty
      }))
    };

    setActiveReceiptData(receiptData);
    setIsReceiptModalOpen(true);
    showToast(`Order placed for ${order.supplierName}! Share receipt generated.`, 'success');
  };

  // Remove Item from an Order
  const handleRemoveOrderItem = (order: SupplierOrder, itemId: string) => {
    order.items = order.items.filter(i => i.id !== itemId);
    if (order.items.length === 0) {
      db.deleteOrder(order.id);
      showToast('Order group removed.', 'info');
    } else {
      db.saveOrder(order);
      showToast('Item removed from order.', 'info');
    }
  };

  // Open Receive Modal
  const handleOpenReceive = (order: SupplierOrder) => {
    setSelectedOrderForReceive(order);
    setIsReceiveModalOpen(true);
  };

  return (
    <div className="content-panel-grey">
      {/* Top Header Bar matching Screenshot 32177.jpg */}
      <div
        style={{
          backgroundColor: 'var(--color-lime)',
          padding: '10px 20px',
          borderRadius: '8px 8px 0 0',
          border: '2px solid #000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2px'
        }}
      >
        <h2
          style={{
            fontFamily: 'Outfit, sans-serif',
            fontWeight: 900,
            fontSize: '1.4rem',
            color: '#002B99',
            letterSpacing: '0.06em',
            textTransform: 'uppercase'
          }}
        >
          ORDER
        </h2>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="btn-red-action"
          style={{ padding: '8px 20px', fontSize: '0.9rem' }}
        >
          <Plus size={16} />
          CREATE NEW ORDER
        </button>
      </div>

      {/* Existing Supplier Orders Section */}
      <div
        style={{
          border: '2px solid #000000',
          borderTop: 'none',
          backgroundColor: '#FFFFFF',
          padding: '16px',
          marginBottom: '28px',
          borderRadius: '0 0 8px 8px'
        }}
      >
        {/* Table Column Header strip matching Screenshot 32177 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '80px 110px 1fr 100px 140px 90px',
            gap: '8px',
            padding: '8px 12px',
            background: 'var(--color-lime)',
            border: '1px solid #000000',
            borderRadius: '4px',
            fontFamily: 'Outfit, sans-serif',
            fontWeight: 800,
            fontSize: '0.9rem',
            textTransform: 'uppercase',
            color: '#000000',
            marginBottom: '14px'
          }}
        >
          <div>SNO</div>
          <div>DATE</div>
          <div>ITEM</div>
          <div style={{ textAlign: 'center', color: '#EA3943' }}>QTY</div>
          <div>SUPPLIER</div>
          <div style={{ textAlign: 'center' }}>REMOVE</div>
        </div>

        {/* Grouped by Supplier Orders */}
        {placedOrders.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280', fontWeight: 600 }}>
            No active supplier orders. Items in Pending Order below can be assigned to suppliers.
          </div>
        ) : (
          placedOrders.map(order => (
            <div
              key={order.id}
              style={{
                marginBottom: '24px',
                borderBottom: '2px dashed #D1D5DB',
                paddingBottom: '20px'
              }}
            >
              {/* Order Items Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {order.items.map(item => (
                  <div
                    key={item.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '80px 110px 1fr 100px 140px 90px',
                      gap: '8px',
                      alignItems: 'center'
                    }}
                  >
                    {/* SNO */}
                    <div
                      style={{
                        background: '#ECECEC',
                        border: '1px solid #000000',
                        borderRadius: '4px',
                        padding: '6px 8px',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        textAlign: 'center',
                        fontSize: '0.88rem'
                      }}
                    >
                      {item.sno}
                    </div>

                    {/* Date */}
                    <div
                      style={{
                        background: '#ECECEC',
                        border: '1px solid #000000',
                        borderRadius: '4px',
                        padding: '6px 8px',
                        fontWeight: 700,
                        textAlign: 'center',
                        fontSize: '0.85rem'
                      }}
                    >
                      {formatDateToDisplay(order.orderDate)}
                    </div>

                    {/* Item Name */}
                    <div
                      style={{
                        background: '#ECECEC',
                        border: '1px solid #000000',
                        borderRadius: '4px',
                        padding: '6px 12px',
                        fontWeight: 800,
                        fontSize: '0.92rem',
                        color: '#000000'
                      }}
                    >
                      {item.itemName}
                    </div>

                    {/* Qty */}
                    <div
                      style={{
                        background: '#ECECEC',
                        border: '1px solid #000000',
                        borderRadius: '4px',
                        padding: '6px 8px',
                        fontWeight: 900,
                        fontSize: '1rem',
                        textAlign: 'center',
                        color: '#EA3943'
                      }}
                    >
                      {item.orderedQty}
                    </div>

                    {/* Supplier */}
                    <div
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #000000',
                        borderRadius: '4px',
                        padding: '6px 8px',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        textAlign: 'center',
                        color: '#000000',
                        textTransform: 'uppercase'
                      }}
                    >
                      {order.supplierName}
                    </div>

                    {/* Remove DEL Button */}
                    <div style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveOrderItem(order, item.id)}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #000000',
                          borderRadius: '4px',
                          padding: '5px 12px',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          color: '#000000',
                          cursor: 'pointer'
                        }}
                      >
                        DEL
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons under each supplier group */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '12px'
                }}
              >
                <button
                  type="button"
                  onClick={() => handleOpenReceive(order)}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #16A34A',
                    color: '#16A34A',
                    borderRadius: 'var(--radius-pill)',
                    padding: '8px 18px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <PackageCheck size={16} />
                  Receive Goods / Inward Stock
                </button>

                {/* ORDER DONE BUTTON (Matching Screenshot 32177) */}
                <button
                  type="button"
                  onClick={() => handleOrderDone(order)}
                  style={{
                    background: 'var(--color-lime)',
                    border: '2px solid #15803D',
                    color: '#000000',
                    borderRadius: 'var(--radius-pill)',
                    padding: '8px 24px',
                    fontWeight: 900,
                    fontSize: '0.95rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Share2 size={16} color="#000000" />
                  ORDER DONE
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* PENDING ORDER SECTION (Matching Screenshot 32177) */}
      <div style={{ marginTop: '20px' }}>
        {/* Lime Header Pill */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div
            className="pill-header-lime"
            style={{
              padding: '8px 36px',
              fontSize: '1.15rem',
              fontWeight: 900,
              boxShadow: 'var(--shadow-md)',
              border: '2px solid #000000'
            }}
          >
            PENDING ORDER
          </div>
        </div>

        {/* Pending Order Items List */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '2px solid #000000',
            borderRadius: '8px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          {pendingLowStockItems.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#16A34A', fontWeight: 700 }}>
              ✓ No pending low-stock items. All items are either well-stocked or already assigned to suppliers.
            </div>
          ) : (
            pendingLowStockItems.map(summary => {
              const currentQty =
                pendingOverrides[summary.item.id] ?? Math.max(1, summary.item.minStock * 2 || 10);

              return (
                <div
                  key={summary.item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 110px 1fr 100px 140px 90px',
                    gap: '8px',
                    alignItems: 'center'
                  }}
                >
                  {/* SNO */}
                  <div
                    style={{
                      background: '#ECECEC',
                      border: '1px solid #000000',
                      borderRadius: '4px',
                      padding: '6px 8px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      textAlign: 'center',
                      fontSize: '0.88rem'
                    }}
                  >
                    {summary.item.sno}
                  </div>

                  {/* Date */}
                  <div
                    style={{
                      background: '#ECECEC',
                      border: '1px solid #000000',
                      borderRadius: '4px',
                      padding: '6px 8px',
                      fontWeight: 700,
                      textAlign: 'center',
                      fontSize: '0.85rem'
                    }}
                  >
                    {formatDateToDisplay(selectedDate)}
                  </div>

                  {/* Item Name */}
                  <div
                    style={{
                      background: '#ECECEC',
                      border: '1px solid #000000',
                      borderRadius: '4px',
                      padding: '6px 12px',
                      fontWeight: 800,
                      fontSize: '0.92rem',
                      color: '#000000'
                    }}
                  >
                    {summary.item.name}
                  </div>

                  {/* QTY Input (Red Text, Editable) */}
                  <div>
                    <input
                      type="number"
                      min="1"
                      className="input-text-clean"
                      value={currentQty}
                      onChange={e => {
                        const val = Number(e.target.value) || 1;
                        setPendingOverrides(prev => ({
                          ...prev,
                          [summary.item.id]: val
                        }));
                      }}
                      style={{
                        background: '#ECECEC',
                        fontWeight: 900,
                        fontSize: '1rem',
                        textAlign: 'center',
                        color: '#EA3943',
                        padding: '5px 6px'
                      }}
                    />
                  </div>

                  {/* Supplier Select Dropdown */}
                  <div>
                    <select
                      className="input-text-clean"
                      defaultValue=""
                      onChange={e => handleAssignSupplierToPending(summary, e.target.value)}
                      style={{
                        padding: '6px 8px',
                        fontWeight: 700,
                        fontSize: '0.85rem'
                      }}
                    >
                      <option value="">[Select Supplier]</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* DEL button */}
                  <div style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => showToast('Low stock item remains in inventory master.', 'info')}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #000000',
                        borderRadius: '4px',
                        padding: '5px 12px',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        color: '#000000',
                        cursor: 'pointer'
                      }}
                    >
                      DEL
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onOrderCreated={order => {
          handleOrderDone(order);
        }}
      />

      <OrderReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        receiptData={activeReceiptData}
      />

      <OrderReceiveModal
        isOpen={isReceiveModalOpen}
        onClose={() => {
          setIsReceiveModalOpen(false);
          setSelectedOrderForReceive(null);
        }}
        order={selectedOrderForReceive}
      />
    </div>
  );
};
