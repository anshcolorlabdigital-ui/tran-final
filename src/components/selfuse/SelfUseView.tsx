import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Item, SelfUse, SelfUseItem } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { getTodayDateString } from '../../utils/dateUtils';
import { SelfUsePrintSlip } from './SelfUsePrintSlip';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Search } from 'lucide-react';

export const SelfUseView: React.FC = () => {
  const { showToast, openQuickModal, refreshKey, selectedDate } = useApp();
  const { hasPermission } = useAuth();

  const items = useMemo(() => db.getItems().filter(i => i.isActive !== false), [refreshKey]);
  const selfUseHistory = useMemo(() => db.getSelfUses(), [refreshKey]);

  // Unique categories from items
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [items]);

  const [billDate, setBillDate] = useState<string>(getTodayDateString());
  const [billNo, setBillNo] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingSelfUseId, setEditingSelfUseId] = useState<string | null>(null);

  // Line item state
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [qty, setQty] = useState<string>('1');
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // Table items
  const [selfUseItems, setSelfUseItems] = useState<SelfUseItem[]>([]);
  const [isTouched, setIsTouched] = useState(false);
  const [searchHistory, setSearchHistory] = useState('');

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (!editingSelfUseId) {
      setBillNo(StockEngine.getNextBillNumber('SELF_USE'));
      setBillDate(selectedDate || getTodayDateString());
      if (categories.length > 0 && !selectedCategory) {
        setSelectedCategory(categories[0]);
      }
    }
  }, [editingSelfUseId, selectedDate, categories, refreshKey]);

  // Filter items by category if selected
  const filteredCategoryItems = useMemo(() => {
    if (!selectedCategory) return items;
    return items.filter(i => i.category?.toLowerCase() === selectedCategory.toLowerCase());
  }, [items, selectedCategory]);

  const selectedItemCurrentStock = useMemo(() => {
    if (!selectedItemId) return 0;
    return StockEngine.getItemCurrentStock(selectedItemId);
  }, [selectedItemId, refreshKey]);

  const totalAmount = useMemo(() => {
    return selfUseItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
  }, [selfUseItems]);

  const isFormActive = Boolean(editingSelfUseId || selfUseItems.length > 0 || selectedItemId || isTouched);

  const handleAddOrUpdateItem = () => {
    setIsTouched(true);
    if (!selectedItemId) {
      showToast('Please select an item', 'error');
      return;
    }
    const numQty = Number(qty);
    if (!numQty || numQty <= 0) {
      showToast('Quantity must be greater than 0', 'error');
      return;
    }

    const itemObj = items.find(i => i.id === selectedItemId);
    if (!itemObj) return;

    if (numQty > selectedItemCurrentStock) {
      showToast(`Notice: Available stock is ${selectedItemCurrentStock} for ${itemObj.name}`, 'warning');
    }

    const rate = itemObj.unitA?.basicPrice ?? itemObj.purchaseRate ?? 0;
    const amount = Number((rate * numQty).toFixed(2));

    const newItem: SelfUseItem = {
      id: `su-item-${Date.now()}-${Math.random()}`,
      itemId: itemObj.id,
      sno: itemObj.sno,
      itemName: itemObj.name,
      rate,
      qty: numQty,
      amount
    };

    if (editingItemIndex !== null && editingItemIndex >= 0) {
      const updated = [...selfUseItems];
      updated[editingItemIndex] = newItem;
      setSelfUseItems(updated);
      setEditingItemIndex(null);
      showToast('Item updated in Self Use table', 'info');
    } else {
      setSelfUseItems(prev => [...prev, newItem]);
      showToast('Item added to Self Use table', 'success');
    }

    setSelectedItemId('');
    setQty('1');
  };

  const handleEditItem = (index: number) => {
    setIsTouched(true);
    const item = selfUseItems[index];
    const foundItem = items.find(i => i.id === item.itemId);
    if (foundItem?.category) setSelectedCategory(foundItem.category);
    setSelectedItemId(item.itemId);
    setQty(String(item.qty));
    setEditingItemIndex(index);
  };

  const handleDeleteItem = (index: number) => {
    setIsTouched(true);
    setSelfUseItems(prev => prev.filter((_, i) => i !== index));
    if (editingItemIndex === index) {
      setEditingItemIndex(null);
      setSelectedItemId('');
    }
  };

  const handleNewEntry = () => {
    setEditingSelfUseId(null);
    setIsTouched(false);
    setBillNo(StockEngine.getNextBillNumber('SELF_USE'));
    setBillDate(getTodayDateString());
    setSelfUseItems([]);
    setSelectedItemId('');
    setQty('1');
    setEditingItemIndex(null);
    showToast('New Self Use entry ready', 'info');
  };

  const handleSaveSelfUse = () => {
    if (!billNo.trim()) {
      showToast('Bill No. is required', 'error');
      return;
    }
    if (selfUseItems.length === 0) {
      showToast('Please add at least one item to Self Use', 'error');
      return;
    }

    const selfUseRecord: SelfUse = {
      id: editingSelfUseId || `su-${Date.now()}`,
      billNo: billNo.trim(),
      billDate,
      category: selectedCategory,
      items: selfUseItems,
      totalAmount,
      reason: 'Factory Internal Consumption / Sample',
      createdAt: new Date().toISOString()
    };

    // Automatically records SELF_USE_OUT stock movements, isolated from Sales
    db.saveSelfUse(selfUseRecord);

    showToast(`Self Use voucher ${selfUseRecord.billNo} saved! Stock updated.`, 'success');
    handleNewEntry();
  };

  const handleLoadSelfUseForEdit = (su: SelfUse) => {
    setEditingSelfUseId(su.id);
    setIsTouched(true);
    setBillNo(su.billNo);
    setBillDate(su.billDate);
    if (su.category) setSelectedCategory(su.category);
    setSelfUseItems(su.items);
    showToast(`Loaded Self Use voucher ${su.billNo} for editing`, 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteCurrentSelfUse = () => {
    if (!editingSelfUseId) {
      showToast('Please select a saved voucher to delete', 'warning');
      return;
    }
    if (!hasPermission('DELETE_SELF_USE')) {
      showToast('You do not have permission to delete self use vouchers', 'error');
      return;
    }
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteSelfUse = () => {
    if (editingSelfUseId) {
      db.deleteSelfUse(editingSelfUseId);
      showToast(`Self Use voucher deleted. Stock restored.`, 'info');
      handleNewEntry();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const currentSelfUseForPrint: SelfUse = {
    id: editingSelfUseId || 'temp',
    billNo,
    billDate,
    category: selectedCategory,
    items: selfUseItems,
    totalAmount,
    reason: 'Internal Consumption',
    createdAt: new Date().toISOString()
  };

  const filteredHistory = useMemo(() => {
    const q = searchHistory.toLowerCase().trim();
    if (!q) return selfUseHistory;
    return selfUseHistory.filter(
      su =>
        su.billNo.toLowerCase().includes(q) ||
        (su.category && su.category.toLowerCase().includes(q)) ||
        su.billDate.includes(q)
    );
  }, [selfUseHistory, searchHistory]);

  const isEditing = Boolean(editingSelfUseId);
  const isCreating = Boolean(!isEditing && (isTouched || selfUseItems.length > 0 || selectedItemId));

  const cardStateClass = isEditing
    ? 'is-editing-pink'
    : isCreating
    ? 'is-creating-green'
    : 'is-initial-blue';

  return (
    <div className="content-panel-grey">
      <SelfUsePrintSlip selfUse={currentSelfUseForPrint} />

      {/* Top Header Strip matching self use new.jpg */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="pill-header-lavender" style={{ fontSize: '1.25rem', padding: '8px 36px', minWidth: '220px', textAlign: 'center' }}>
            SELF USE
          </div>
          {isEditing ? (
            <span className="active-mode-indicator is-editing">
              ● Editing Self Use Voucher ({billNo})
            </span>
          ) : isCreating ? (
            <span className="active-mode-indicator is-creating">
              ● Creating New Self Use Entry
            </span>
          ) : (
            <span className="active-mode-indicator is-initial">
              ● Ready for New Entry
            </span>
          )}
        </div>
      </div>

      {/* Main Form Container: Light Blue on Initial, Light Green on Creating, Light Pink on Editing */}
      <div
        className={`dynamic-entry-card ${cardStateClass}`}
        style={{
          maxWidth: '850px',
          margin: '0 auto'
        }}
      >
        {/* Top Dates & Bill No Row */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 900, fontSize: '0.9rem' }}>BILL DATE</label>
            <input
              type="date"
              className="input-text-clean"
              value={billDate}
              onChange={e => {
                setIsTouched(true);
                setBillDate(e.target.value);
              }}
              style={{ width: '140px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontWeight: 900, fontSize: '0.9rem' }}>BILL NO.</label>
            <input
              type="text"
              className="input-text-clean"
              value={billNo}
              onChange={e => {
                setIsTouched(true);
                setBillNo(e.target.value);
              }}
              style={{ width: '140px', fontWeight: 800 }}
            />
          </div>
        </div>

        {/* CATEGORY SELECTION matching self use new.jpg */}
        <div style={{ display: 'grid', gridTemplateColumns: '85px 1fr 34px', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontWeight: 900, fontSize: '1.05rem' }}>CATG. :</label>
          <select
            className="input-text-clean"
            value={selectedCategory}
            onChange={e => {
              setIsTouched(true);
              setSelectedCategory(e.target.value);
            }}
            style={{ fontSize: '0.95rem', height: '38px', fontWeight: 700 }}
          >
            <option value="">-- All Categories --</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-quick-n"
            title="Create Item / Category"
            onClick={() => openQuickModal('ITEM', () => setIsTouched(true))}
          >
            N
          </button>
        </div>

        {/* ITEM SELECTION matching self use new.jpg */}
        <div style={{ display: 'grid', gridTemplateColumns: '85px 1fr 34px', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontWeight: 900, fontSize: '1.05rem' }}>ITEM :</label>
          <select
            className="input-text-clean"
            value={selectedItemId}
            onChange={e => {
              setIsTouched(true);
              setSelectedItemId(e.target.value);
            }}
            style={{ fontSize: '0.95rem', height: '38px', fontWeight: 700 }}
          >
            <option value="">-- Select Item --</option>
            {filteredCategoryItems.map(i => (
              <option key={i.id} value={i.id}>
                [{i.sno}] {i.name} ({i.unit || 'Units'})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-quick-n"
            title="Quick Create Item"
            onClick={() => openQuickModal('ITEM', (newId) => {
              setIsTouched(true);
              setSelectedItemId(newId);
            })}
          >
            N
          </button>
        </div>

        {/* QTY ROW & ACTION BUTTONS matching self use new.jpg */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{ fontWeight: 900, fontSize: '1.05rem', width: '85px' }}>QTY :</label>
          <input
            type="number"
            min="1"
            className="input-text-clean"
            value={qty}
            onChange={e => {
              setIsTouched(true);
              setQty(e.target.value);
            }}
            style={{ width: '150px', fontWeight: 900, fontSize: '1rem', color: '#EA3943', textAlign: 'center' }}
          />

          <div style={{ display: 'flex', gap: '18px', marginLeft: '16px' }}>
            <button
              type="button"
              onClick={handleAddOrUpdateItem}
              style={{ color: '#EA3943', background: 'transparent', border: 'none', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer' }}
            >
              {editingItemIndex !== null ? 'Update' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (selfUseItems.length > 0) handleEditItem(selfUseItems.length - 1);
              }}
              style={{ color: '#EA3943', background: 'transparent', border: 'none', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer' }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                if (selfUseItems.length > 0) handleDeleteItem(selfUseItems.length - 1);
              }}
              style={{ color: '#EA3943', background: 'transparent', border: 'none', fontWeight: 900, fontSize: '1.05rem', cursor: 'pointer' }}
            >
              Del
            </button>
          </div>
        </div>

        {/* ITEMS TABLE matching self use new.jpg */}
        <div style={{ border: '2px solid #000000', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#D2BEF6', borderBottom: '2px solid #000000' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 800, borderRight: '1px solid #000000' }}>
                  Item
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, width: '100px', borderRight: '1px solid #000000' }}>
                  Qty
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, width: '120px', borderRight: '1px solid #000000' }}>
                  Rate
                </th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, width: '140px' }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {selfUseItems.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '30px', textAlign: 'center', color: '#9CA3AF', fontWeight: 600 }}>
                    No items in current Self Use voucher. Select item & qty above.
                  </td>
                </tr>
              ) : (
                selfUseItems.map((item, idx) => (
                  <tr
                    key={idx}
                    onClick={() => handleEditItem(idx)}
                    style={{
                      borderBottom: '1px solid #E5E7EB',
                      cursor: 'pointer',
                      background: editingItemIndex === idx ? '#F3E8FF' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '8px 12px', fontWeight: 800, borderRight: '1px solid #000000' }}>
                      [{item.sno}] {item.itemName}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 800, color: '#EA3943', borderRight: '1px solid #000000' }}>
                      {item.qty}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, borderRight: '1px solid #000000' }}>
                      {item.rate}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800 }}>
                      {item.amount}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: '#D2BEF6', borderTop: '2px solid #000000' }}>
                <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, borderRight: '1px solid #000000' }}>
                  Total
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 900, color: '#002B99' }}>
                  {totalAmount}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* CUSTOMER AUTHENTIC ACTION BUTTONS matching self use new.jpg */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
          <button
            type="button"
            onClick={handleSaveSelfUse}
            className="btn-customer-save"
          >
            Save
          </button>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-customer-action-pill"
              onClick={() => {
                if (selfUseHistory.length > 0) {
                  showToast('Select a voucher from the history list below to edit', 'info');
                  const el = document.getElementById('self-use-history-register');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                } else {
                  showToast('No saved vouchers found', 'warning');
                }
              }}
            >
              Edit
            </button>

            <button
              type="button"
              className="btn-customer-action-pill"
              onClick={handleDeleteCurrentSelfUse}
            >
              Del
            </button>

            <button
              type="button"
              className="btn-customer-action-pill"
              onClick={handlePrint}
            >
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Self Use Consumption History in the Downside (Always Visible) */}
      <div id="self-use-history-register" style={{ marginTop: '28px', background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '20px', maxWidth: '850px', margin: '28px auto 0', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h4 style={{ fontWeight: 900, fontSize: '1.1rem', margin: 0 }}>Self Use Consumption Register (History)</h4>
            <span style={{ fontSize: '0.8rem', background: '#E0E7FF', color: '#3730A3', padding: '2px 10px', borderRadius: '12px', fontWeight: 800 }}>
              {filteredHistory.length} {filteredHistory.length === 1 ? 'Record' : 'Records'}
            </span>
          </div>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={14} color="#6B7280" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search voucher no..."
              className="input-text-clean"
              value={searchHistory}
              onChange={e => setSearchHistory(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Voucher Date</th>
                <th>Voucher No.</th>
                <th style={{ textAlign: 'center' }}>Total Items</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF', fontWeight: 600 }}>
                    No self use consumption records found.
                  </td>
                </tr>
              ) : (
                filteredHistory.map(su => (
                  <tr
                    key={su.id}
                    style={{
                      backgroundColor: editingSelfUseId === su.id ? '#EFF6FF' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleLoadSelfUseForEdit(su)}
                  >
                    <td>{su.billDate}</td>
                    <td style={{ fontWeight: 800 }}>{su.billNo}</td>
                    <td style={{ textAlign: 'center' }}>{su.items?.length || 0}</td>
                    <td style={{ textAlign: 'right', fontWeight: 900, color: '#EA3943' }}>₹{su.totalAmount}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleLoadSelfUseForEdit(su);
                        }}
                        style={{
                          background: editingSelfUseId === su.id ? '#BFDBFE' : '#E2D2F8',
                          color: editingSelfUseId === su.id ? '#1E40AF' : '#EA3943',
                          border: '1px solid #C4B5FD',
                          borderRadius: '12px',
                          padding: '3px 12px',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        {editingSelfUseId === su.id ? 'Editing' : 'Load'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmDeleteSelfUse}
        title="Delete Self Use Voucher"
        message={`Are you sure you want to delete self use voucher "${billNo}"? This will reverse the consumption and restore inventory stock.`}
      />
    </div>
  );
};
