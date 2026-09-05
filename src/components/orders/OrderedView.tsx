import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db } from '../../db/db';
import { SupplierOrder, OrderStatus } from '../../types';
import { formatDateToDisplay } from '../../utils/dateUtils';
import { OrderReceiptModal } from './OrderReceiptModal';
import { ReceiptData } from '../../utils/shareUtils';
import { useAuth } from '../../context/AuthContext';
import {
  Share2,
  PackageCheck,
  Trash2,
  Search,
  Calendar,
  Building2,
  Package,
  StickyNote,
  ArrowRight,
  PlusCircle,
  Keyboard
} from 'lucide-react';

export const OrderedView: React.FC = () => {
  const { setActiveTab, showToast, refreshKey, setPendingPurchasePrefill } = useApp();
  const { hasPermission } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'RECEIVED' | 'ALL'>('ACTIVE');
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(null);

  // Fetch all placed supplier orders
  const orders = useMemo<SupplierOrder[]>(() => {
    return db.getOrders().sort((a: SupplierOrder, b: SupplierOrder) => {
      return new Date(b.createdAt || b.orderDate).getTime() - new Date(a.createdAt || a.orderDate).getTime();
    });
  }, [refreshKey]);

  // Filtered orders: Default shows active pending orders (removed when entered into Purchase)
  const filteredOrders = useMemo<SupplierOrder[]>(() => {
    return orders.filter((order: SupplierOrder) => {
      let matchesStatus = true;
      if (statusFilter === 'ACTIVE') {
        matchesStatus = order.status === 'ORDERED' || order.status === 'PARTIALLY_RECEIVED';
      } else if (statusFilter === 'RECEIVED') {
        matchesStatus = order.status === 'RECEIVED';
      }

      const q = searchTerm.toLowerCase().trim();
      if (!q) return matchesStatus;

      const matchesQuery =
        order.orderNumber.toLowerCase().includes(q) ||
        order.supplierName.toLowerCase().includes(q) ||
        order.orderDate.includes(q) ||
        (order.notes && order.notes.toLowerCase().includes(q)) ||
        order.items.some(
          it =>
            it.itemName.toLowerCase().includes(q) ||
            it.sno.toLowerCase().includes(q) ||
            (it.description && it.description.toLowerCase().includes(q))
        );

      return matchesStatus && matchesQuery;
    });
  }, [orders, searchTerm, statusFilter]);

  // Handler: Open Share / Screenshot Modal
  const handleOpenShareSlip = (order: SupplierOrder) => {
    setSelectedReceipt({
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
    });
  };

  // Global keyboard shortcuts (Alt+N to go to Order, Alt+P to view first order slip)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setActiveTab('ORDER');
      } else if (e.altKey && e.key.toLowerCase() === 'p') {
        if (filteredOrders.length > 0) {
          e.preventDefault();
          handleOpenShareSlip(filteredOrders[0]);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [filteredOrders]);

  // Handler: Open Direct Purchase Entry (Prefilled with this Order)
  const handleOpenPurchaseEntry = (order: SupplierOrder) => {
    if (!hasPermission('CREATE_PURCHASE')) {
      showToast('You do not have permission to create purchase entries', 'error');
      return;
    }

    // Set prefill data for PurchaseEntryView
    setPendingPurchasePrefill({
      orderId: order.id,
      supplierId: order.supplierId,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      notes: order.notes,
      items: order.items.map(it => ({
        itemId: it.itemId,
        sno: it.sno,
        itemName: it.itemName,
        qty: Math.max(1, it.orderedQty - (it.receivedQty || 0))
      }))
    });

    showToast(`Opening Purchase Entry for Order ${order.orderNumber}...`, 'info');
    setActiveTab('PURCHASE');
  };

  // Handler: Delete Order
  const handleDeleteOrder = (order: SupplierOrder) => {
    if (!hasPermission('MANAGE_ORDERS')) {
      showToast('You do not have permission to delete orders', 'error');
      return;
    }
    if (window.confirm(`Are you sure you want to delete Order #${order.orderNumber} for ${order.supplierName}?`)) {
      db.deleteOrder(order.id);
      showToast(`Order #${order.orderNumber} deleted`, 'info');
    }
  };

  return (
    <div className="content-panel-grey">
      {/* Top Header Strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="pill-header-lavender" style={{ fontSize: '1.25rem', padding: '8px 36px', minWidth: '220px', textAlign: 'center' }}>
            ORDERED HISTORY
          </div>
          <span style={{ fontSize: '0.85rem', background: '#DBEAFE', color: '#1E40AF', padding: '4px 14px', borderRadius: '12px', fontWeight: 800 }}>
            {filteredOrders.length} {filteredOrders.length === 1 ? 'Order' : 'Orders'} {statusFilter === 'ACTIVE' ? 'Active' : ''}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', border: '1px solid #000000', borderRadius: '20px', padding: '3px 12px', fontSize: '0.78rem', color: '#1E40AF', fontWeight: 700 }}>
            <Keyboard size={13} />
            <span><kbd style={{ background: '#F3F4F6', padding: '1px 5px', border: '1px solid #9CA3AF', borderRadius: '3px' }}>Alt+N</kbd> New Order | <kbd style={{ background: '#F3F4F6', padding: '1px 5px', border: '1px solid #9CA3AF', borderRadius: '3px' }}>Alt+P</kbd> View Slip</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1.5px solid #000000',
          borderRadius: '10px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '260px' }}>
          <Search size={18} color="#6B7280" />
          <input
            type="text"
            placeholder="Search by Order #, Supplier, Item, Date, or Remark..."
            className="input-text-clean"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ flex: 1, padding: '6px 12px', fontSize: '0.9rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#374151' }}>Status:</label>
          <select
            className="input-text-clean"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{ padding: '6px 12px', fontSize: '0.85rem', fontWeight: 700 }}
          >
            <option value="ACTIVE">Active Placed Orders (Pending Inward)</option>
            <option value="RECEIVED">Received / Fulfilled History</option>
            <option value="ALL">All Orders (Active + Fulfilled)</option>
          </select>
        </div>
      </div>

      {/* Orders List / Empty State */}
      {filteredOrders.length === 0 ? (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '2px dashed #9CA3AF',
            borderRadius: '14px',
            padding: '48px 24px',
            textAlign: 'center',
            color: '#6B7280'
          }}
        >
          <Package size={48} style={{ margin: '0 auto 12px', opacity: 0.6 }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#111827', marginBottom: '6px' }}>
            No Placed Orders Found
          </h3>
          <p style={{ fontSize: '0.9rem', marginBottom: '18px' }}>
            {searchTerm || statusFilter !== 'ALL'
              ? 'Try changing your search keywords or status filter.'
              : 'You have not placed any supplier orders yet.'}
          </p>
          <button
            type="button"
            onClick={() => setActiveTab('ORDER')}
            className="btn-customer-new-entry"
            style={{ padding: '8px 20px', fontSize: '0.9rem' }}
          >
            Go to Orders Section
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {filteredOrders.map(order => {
            const isCompleted = order.status === 'RECEIVED';
            const isPartial = order.status === 'PARTIALLY_RECEIVED';
            const totalQty = order.items.reduce((sum, it) => sum + Number(it.orderedQty || 0), 0);
            const recdQty = order.items.reduce((sum, it) => sum + Number(it.receivedQty || 0), 0);

            return (
              <div
                key={order.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '2px solid #000000',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px'
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderBottom: '1.5px solid #E5E7EB', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        backgroundColor: '#111827',
                        color: '#FFFFFF',
                        fontFamily: 'monospace',
                        fontWeight: 900,
                        fontSize: '1rem',
                        padding: '4px 12px',
                        borderRadius: '6px'
                      }}
                    >
                      {order.orderNumber}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '1.05rem', color: '#1F2937' }}>
                      <Building2 size={18} color="#4B5563" />
                      <span>{order.supplierName}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', color: '#4B5563', fontWeight: 700 }}>
                      <Calendar size={15} />
                      <span>{formatDateToDisplay(order.orderDate)}</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isCompleted ? (
                      <span style={{ backgroundColor: '#D1FAE5', color: '#065F46', padding: '4px 12px', borderRadius: '20px', fontWeight: 800, fontSize: '0.8rem' }}>
                        ✓ COMPLETED
                      </span>
                    ) : isPartial ? (
                      <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', padding: '4px 12px', borderRadius: '20px', fontWeight: 800, fontSize: '0.8rem' }}>
                        ● PARTIALLY RECEIVED ({recdQty}/{totalQty})
                      </span>
                    ) : (
                      <span style={{ backgroundColor: '#DBEAFE', color: '#1E40AF', padding: '4px 12px', borderRadius: '20px', fontWeight: 800, fontSize: '0.8rem' }}>
                        ● ORDER PLACED
                      </span>
                    )}
                  </div>
                </div>

                {/* Items Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1.5px solid #D1D5DB' }}>
                        <th style={{ padding: '8px 12px', fontWeight: 800, width: '100px' }}>S.No.</th>
                        <th style={{ padding: '8px 12px', fontWeight: 800 }}>Item Name & Description</th>
                        <th style={{ padding: '8px 12px', fontWeight: 800, textAlign: 'right', width: '130px' }}>Ordered Qty</th>
                        <th style={{ padding: '8px 12px', fontWeight: 800, textAlign: 'right', width: '130px' }}>Received Qty</th>
                        <th style={{ padding: '8px 12px', fontWeight: 800, textAlign: 'center', width: '120px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}>
                            {item.sno || `${1456 + idx}`}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 700 }}>
                            <div>{item.itemName}</div>
                            {item.description && item.description.trim() && (
                              <div style={{ fontSize: '0.78rem', color: '#6B7280', fontWeight: 500, marginTop: '2px' }}>
                                {item.description.trim()}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 800, textAlign: 'right', color: '#EA3943' }}>
                            {item.orderedQty}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 800, textAlign: 'right', color: item.receivedQty >= item.orderedQty ? '#16A34A' : '#4B5563' }}>
                            {item.receivedQty || 0}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {item.status === 'RECEIVED' ? (
                              <span style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 800 }}>✓ Inwarded</span>
                            ) : item.status === 'PARTIALLY_RECEIVED' ? (
                              <span style={{ fontSize: '0.75rem', color: '#D97706', fontWeight: 800 }}>Part Received</span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#2563EB', fontWeight: 800 }}>Pending Inward</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Remark Row if present */}
                {order.notes && order.notes.trim() && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#FEF3C7',
                      border: '1px solid #F59E0B',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '0.88rem',
                      color: '#92400E',
                      fontWeight: 700
                    }}
                  >
                    <StickyNote size={16} color="#D97706" />
                    <span>
                      <strong style={{ textTransform: 'uppercase', marginRight: '6px' }}>Remark:</strong>
                      {order.notes}
                    </span>
                  </div>
                )}

                {/* Action Buttons: "Share / View Slip" & "Open Purchase Entry" */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid #E5E7EB',
                    paddingTop: '12px',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {/* Share / View Slip Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenShareSlip(order)}
                      style={{
                        backgroundColor: '#E2E6FF',
                        color: '#000000',
                        border: '1.5px solid #000000',
                        borderRadius: '20px',
                        padding: '6px 18px',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                      }}
                    >
                      <Share2 size={15} />
                      Share / View Slip
                    </button>

                    {/* Delete Order Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteOrder(order)}
                      style={{
                        backgroundColor: '#FFFFFF',
                        color: '#DC2626',
                        border: '1px solid #EF4444',
                        borderRadius: '20px',
                        padding: '6px 14px',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Delete this order"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>

                  {/* Green "Open Purchase Entry" Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenPurchaseEntry(order)}
                    style={{
                      backgroundColor: '#10B981',
                      color: '#FFFFFF',
                      border: '1.5px solid #047857',
                      borderRadius: '20px',
                      padding: '8px 24px',
                      fontWeight: 900,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  >
                    <PackageCheck size={18} />
                    <span>Open Purchase Entry</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Share / Screenshot Modal */}
      {selectedReceipt && (
        <OrderReceiptModal
          isOpen={Boolean(selectedReceipt)}
          onClose={() => setSelectedReceipt(null)}
          receiptData={selectedReceipt}
        />
      )}
    </div>
  );
};
