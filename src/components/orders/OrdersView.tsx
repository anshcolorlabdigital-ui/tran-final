import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { SupplierOrder, OrderItem, Supplier, ItemStockSummary } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { formatDateToDisplay, getTodayDateString } from '../../utils/dateUtils';
import { OrderReceiptModal } from './OrderReceiptModal';
import { CreateOrderModal } from './CreateOrderModal';
import { ReceiptData } from '../../utils/shareUtils';
import { Plus, Share2, Package, Keyboard } from 'lucide-react';

export const OrdersView: React.FC = () => {
  const { refreshKey, showToast, selectedDate, setActiveTab } = useApp();

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [activeReceiptData, setActiveReceiptData] = useState<ReceiptData | null>(null);

  // Staged / Draft Order Items waiting to be placed (keyed by supplierId)
  const [draftSupplierItems, setDraftSupplierItems] = useState<{
    [supplierId: string]: {
      supplier: Supplier;
      items: OrderItem[];
    };
  }>({});

  // Draft remarks per supplier
  const [draftRemarks, setDraftRemarks] = useState<{ [supplierId: string]: string }>({});

  // Load suppliers, orders, and stock summaries
  const suppliers = useMemo(() => db.getSuppliers().filter(s => s.isActive !== false), [refreshKey]);
  const allOrders = useMemo(() => db.getOrders(), [refreshKey]);
  const lowStockSummaries = useMemo(() => StockEngine.getLowStockItems(), [refreshKey]);

  // Pending quantities map for low-stock items
  const [pendingOverrides, setPendingOverrides] = useState<{ [itemId: string]: number }>({});

  // Active placed orders count
  const placedOrdersCount = useMemo(() => {
    return allOrders.filter(o => o.status === 'ORDERED' || o.status === 'PARTIALLY_RECEIVED').length;
  }, [allOrders]);

  // Low stock items that are NOT currently in draft
  const pendingLowStockItems = useMemo(() => {
    const draftItemIds = new Set<string>();
    Object.values(draftSupplierItems).forEach(group => {
      group.items.forEach(it => draftItemIds.add(it.itemId));
    });

    return lowStockSummaries.filter(summary => !draftItemIds.has(summary.item.id));
  }, [lowStockSummaries, draftSupplierItems]);

  // Assign a pending item to a supplier draft
  const handleAssignSupplierToPending = (summary: ItemStockSummary, supplierId: string) => {
    if (!supplierId) return;
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;

    const qtyToOrder = pendingOverrides[summary.item.id] !== undefined ? pendingOverrides[summary.item.id] : 0;
    const orderDate = getTodayDateString();

    const newOrderItem: OrderItem = {
      id: `ord-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sno: summary.item.sno,
      itemId: summary.item.id,
      itemName: summary.item.name,
      description: summary.item.description,
      orderedQty: qtyToOrder,
      receivedQty: 0,
      supplierId: supplier.id,
      supplierName: supplier.name,
      orderDate,
      status: 'ORDERED'
    };

    setDraftSupplierItems(prev => {
      const existing = prev[supplier.id] || { supplier, items: [] };
      return {
        ...prev,
        [supplier.id]: {
          supplier,
          items: [...existing.items, newOrderItem]
        }
      };
    });

    showToast(`Added "${summary.item.name}" to ${supplier.name} order draft!`, 'success');
  };

  // Remove an item from the draft
  const handleRemoveDraftItem = (supplierId: string, itemId: string) => {
    setDraftSupplierItems(prev => {
      const group = prev[supplierId];
      if (!group) return prev;
      const updatedItems = group.items.filter(it => it.id !== itemId);
      if (updatedItems.length === 0) {
        const copy = { ...prev };
        delete copy[supplierId];
        return copy;
      }
      return {
        ...prev,
        [supplierId]: {
          ...group,
          items: updatedItems
        }
      };
    });
    showToast('Item removed from draft.', 'info');
  };

  // ORDER PLACE: Finalizes draft into a distinct, independent SupplierOrder and opens share popup
  const handlePlaceOrder = (supplierId: string) => {
    const draftGroup = draftSupplierItems[supplierId];
    if (!draftGroup || draftGroup.items.length === 0) return;

    const orderDate = getTodayDateString();
    const remark = (draftRemarks[supplierId] || '').trim();

    const newOrder: SupplierOrder = {
      id: `ord-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      orderNumber: StockEngine.getNextBillNumber('ORDER'),
      orderDate,
      supplierId: draftGroup.supplier.id,
      supplierName: draftGroup.supplier.name,
      status: 'ORDERED',
      items: [...draftGroup.items],
      notes: remark,
      createdAt: new Date().toISOString()
    };

    // Save independent order to DB
    db.saveOrder(newOrder);

    // Clear draft for this supplier
    setDraftSupplierItems(prev => {
      const copy = { ...prev };
      delete copy[supplierId];
      return copy;
    });

    setDraftRemarks(prev => {
      const copy = { ...prev };
      delete copy[supplierId];
      return copy;
    });

    // Generate clean receipt (Contains ONLY S.No., Date, Item, Description, Quantity, Remark)
    const receiptData: ReceiptData = {
      date: newOrder.orderDate,
      orderNumber: newOrder.orderNumber,
      supplierName: newOrder.supplierName,
      items: newOrder.items.map(item => ({
        sno: item.sno,
        itemName: item.itemName,
        description: item.description,
        qty: item.orderedQty
      })),
      notes: remark
    };

    setActiveReceiptData(receiptData);
    setIsReceiptModalOpen(true);
    showToast(`Order #${newOrder.orderNumber} placed! Screenshot slip generated. Moved to ORDERED section.`, 'success');
  };

  // Global Keyboard Shortcuts (Alt+N for New Order, Ctrl+S / Alt+S to place order)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsCreateModalOpen(true);
      } else if ((e.ctrlKey || e.metaKey || e.altKey) && e.key.toLowerCase() === 's') {
        const firstSupplierId = Object.keys(draftSupplierItems)[0];
        if (firstSupplierId) {
          e.preventDefault();
          handlePlaceOrder(firstSupplierId);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [draftSupplierItems, draftRemarks]);

  const draftSupplierList = Object.values(draftSupplierItems);

  return (
    <div className="content-panel-grey">
      {/* Top Header Bar */}
      <div
        style={{
          backgroundColor: 'var(--color-lime)',
          padding: '10px 20px',
          borderRadius: '8px 8px 0 0',
          border: '2px solid #000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2px',
          flexWrap: 'wrap',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2
            style={{
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 900,
              fontSize: '1.4rem',
              color: '#002B99',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              margin: 0
            }}
          >
            ORDER
          </h2>
          <span style={{ fontSize: '0.8rem', background: '#FFFFFF', color: '#002B99', padding: '2px 12px', borderRadius: '12px', fontWeight: 800, border: '1px solid #002B99' }}>
            {pendingLowStockItems.length} Pending Items
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', border: '1px solid #000000', borderRadius: '20px', padding: '3px 12px', fontSize: '0.78rem', color: '#002B99', fontWeight: 700 }}>
            <Keyboard size={13} />
            <span><kbd style={{ background: '#F3F4F6', padding: '1px 5px', border: '1px solid #9CA3AF', borderRadius: '3px' }}>Alt+N</kbd> New Order | <kbd style={{ background: '#F3F4F6', padding: '1px 5px', border: '1px solid #9CA3AF', borderRadius: '3px' }}>Ctrl+S</kbd> Place Order</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-red-action"
            style={{ padding: '8px 20px', fontSize: '0.9rem' }}
          >
            <Plus size={16} />
            CREATE NEW ORDER (Alt+N)
          </button>
        </div>
      </div>

      {/* NEW ORDER PLACEMENT / DRAFT SECTION (When supplier is selected for items) */}
      {draftSupplierList.length > 0 && (
        <div
          className="dynamic-entry-card is-creating-green"
          style={{
            border: '2px solid #10B981',
            borderRadius: '0 0 8px 8px',
            padding: '16px',
            marginBottom: '28px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="active-mode-indicator is-creating">
                ● Ready to Place Order ({draftSupplierList.length} {draftSupplierList.length === 1 ? 'Supplier' : 'Suppliers'})
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065F46' }}>
                Add remarks and click "ORDER PLACE" to generate shareable screenshot & move to ORDERED section
              </span>
            </div>
          </div>

          {/* Draft Orders per Supplier */}
          {draftSupplierList.map(group => (
            <div
              key={group.supplier.id}
              style={{
                background: '#FFFFFF',
                border: '2px solid #059669',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '14px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
              }}
            >
              {/* Supplier Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#065F46' }}>
                  Supplier: {group.supplier.name}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6B7280' }}>
                  Date: {formatDateToDisplay(getTodayDateString())}
                </span>
              </div>

              {/* Table Column Header & Item Rows */}
              <div className="table-responsive-wrapper">
                <div style={{ minWidth: '580px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '110px 1fr 100px 140px 90px',
                      gap: '8px',
                      padding: '6px 12px',
                      background: 'var(--color-lime)',
                      border: '1px solid #000000',
                      borderRadius: '4px',
                      fontFamily: 'Outfit, sans-serif',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      textTransform: 'uppercase',
                      color: '#000000',
                      marginBottom: '2px'
                    }}
                  >
                    <div>DATE</div>
                    <div>ITEM & DESCRIPTION</div>
                    <div style={{ textAlign: 'center', color: '#EA3943' }}>QTY</div>
                    <div>SUPPLIER</div>
                    <div style={{ textAlign: 'center' }}>REMOVE</div>
                  </div>

                  {group.items.map(item => (
                    <div
                      key={item.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '110px 1fr 100px 140px 90px',
                        gap: '8px',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ background: '#ECECEC', border: '1px solid #000000', borderRadius: '4px', padding: '6px 8px', fontWeight: 700, textAlign: 'center', fontSize: '0.85rem' }}>
                        {formatDateToDisplay(item.orderDate)}
                      </div>
                      <div style={{ background: '#ECECEC', border: '1px solid #000000', borderRadius: '4px', padding: '6px 12px' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#000000' }}>
                          {item.itemName}
                        </div>
                        {item.description && item.description.trim() && (
                          <div style={{ fontSize: '0.78rem', color: '#6B7280', fontWeight: 500, marginTop: '2px' }}>
                            {item.description.trim()}
                          </div>
                        )}
                      </div>
                      <div style={{ background: '#ECECEC', border: '1px solid #000000', borderRadius: '4px', padding: '6px 8px', fontWeight: 900, fontSize: '1rem', textAlign: 'center', color: '#EA3943' }}>
                        {item.orderedQty}
                      </div>
                      <div style={{ background: '#FFFFFF', border: '1px solid #000000', borderRadius: '4px', padding: '6px 8px', fontWeight: 800, fontSize: '0.88rem', textAlign: 'center', color: '#000000', textTransform: 'uppercase' }}>
                        {group.supplier.name}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftItem(group.supplier.id, item.id)}
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
              </div>

              {/* Remark / Note Input before ORDER PLACE */}
              <div
                style={{
                  marginTop: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  backgroundColor: '#F9FAFB',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  padding: '8px 12px'
                }}
              >
                <label style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1F2937', minWidth: '140px' }}>
                  Remark / Note:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Urgent delivery by 5 PM / Grade A quality (will appear on receipt & slip)"
                  className="input-text-clean"
                  value={draftRemarks[group.supplier.id] || ''}
                  onChange={e => setDraftRemarks(prev => ({ ...prev, [group.supplier.id]: e.target.value }))}
                  style={{ flex: 1, padding: '6px 12px', fontSize: '0.88rem' }}
                />
              </div>

              {/* ORDER PLACE Button matching customer requirement */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => handlePlaceOrder(group.supplier.id)}
                  style={{
                    background: 'var(--color-lime)',
                    border: '2px solid #15803D',
                    color: '#000000',
                    borderRadius: 'var(--radius-pill)',
                    padding: '10px 32px',
                    fontWeight: 900,
                    fontSize: '1rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Share2 size={18} color="#000000" />
                  ORDER PLACE
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PENDING ORDER SECTION (Matching Screenshot 32177) */}
      <div style={{ marginTop: '10px' }}>
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
              ✓ No pending low-stock items. All items are either well-stocked or assigned to order draft.
            </div>
          ) : (
            <div className="table-responsive-wrapper">
              <div style={{ minWidth: '540px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 110px 160px 80px',
                    gap: '8px',
                    padding: '6px 12px',
                    background: 'var(--color-lime)',
                    border: '1px solid #000000',
                    borderRadius: '4px',
                    fontFamily: 'Outfit, sans-serif',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    textTransform: 'uppercase',
                    color: '#000000',
                    marginBottom: '2px'
                  }}
                >
                  <div>ITEM & DESCRIPTION</div>
                  <div style={{ textAlign: 'center', color: '#EA3943' }}>QTY</div>
                  <div>ASSIGN SUPPLIER</div>
                  <div style={{ textAlign: 'center' }}>ACTION</div>
                </div>

                {pendingLowStockItems.map(summary => {
                  const currentQty =
                    pendingOverrides[summary.item.id] !== undefined ? pendingOverrides[summary.item.id] : 0;

                  return (
                    <div
                      key={summary.item.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 110px 160px 80px',
                        gap: '8px',
                        alignItems: 'center'
                      }}
                    >
                      {/* Item Name & Description in Smaller Light Grey Font */}
                      <div
                        style={{
                          background: '#ECECEC',
                          border: '1px solid #000000',
                          borderRadius: '4px',
                          padding: '6px 12px'
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#000000' }}>
                          {summary.item.name}
                        </div>
                        {summary.item.description && summary.item.description.trim() && (
                          <div style={{ fontSize: '0.78rem', color: '#6B7280', fontWeight: 500, marginTop: '2px' }}>
                            {summary.item.description.trim()}
                          </div>
                        )}
                      </div>

                      {/* QTY Input (Red Text, Editable) */}
                      <div>
                        <input
                          type="number"
                          min="0"
                          className="input-text-clean"
                          value={currentQty}
                          onChange={e => {
                            const val = e.target.value === '' ? 0 : Number(e.target.value);
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
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onOrderCreated={order => {
          const receiptData: ReceiptData = {
            date: order.orderDate,
            orderNumber: order.orderNumber,
            supplierName: order.supplierName,
            items: order.items.map(it => ({
              sno: it.sno,
              itemName: it.itemName,
              description: it.description,
              qty: it.orderedQty
            })),
            notes: order.notes
          };
          setActiveReceiptData(receiptData);
          setIsReceiptModalOpen(true);
        }}
      />

      <OrderReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        receiptData={activeReceiptData}
      />
    </div>
  );
};
