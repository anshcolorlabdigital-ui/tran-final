import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { PhysicalStockAudit, PhysicalStockItem } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { getTodayDateString, formatDateDMY } from '../../utils/dateUtils';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ItemSearchSelect, ItemSearchSelectHandle } from '../common/ItemSearchSelect';
import {
  ClipboardCheck,
  Search,
  Plus,
  Trash2,
  Printer,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Eye,
  Edit,
  ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';

export const PhysicalStockView: React.FC = () => {
  const { showToast, showAlert, refreshKey, selectedDate } = useApp();
  const { hasPermission } = useAuth();

  const items = useMemo(() => db.getItems().filter(i => i.isActive !== false), [refreshKey]);
  const auditHistory = useMemo(() => db.getPhysicalStockAudits(), [refreshKey]);

  // Unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [items]);

  // Audit Form Header state
  const [auditDate, setAuditDate] = useState<string>(getTodayDateString());
  const [auditNo, setAuditNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [editingAuditId, setEditingAuditId] = useState<string | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);

  // Selected Category filter for batch loading
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Audit Items List
  const [auditItems, setAuditItems] = useState<PhysicalStockItem[]>([]);

  // Item Search selector ref
  const itemSearchRef = useRef<ItemSearchSelectHandle>(null);
  const [selectedSingleItemId, setSelectedSingleItemId] = useState<string>('');

  // History search filter
  const [historySearch, setHistorySearch] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Auto-generate voucher number on mount or when reset
  useEffect(() => {
    if (!editingAuditId) {
      setAuditNo(StockEngine.getNextBillNumber('PHYSICAL_STOCK'));
      setAuditDate(selectedDate || getTodayDateString());
    }
  }, [editingAuditId, selectedDate, refreshKey]);

  // Load all items (or category filtered items) into the audit table
  const handleLoadItems = (catFilter: string = 'ALL') => {
    const targetItems = catFilter === 'ALL'
      ? items
      : items.filter(i => i.category?.toLowerCase() === catFilter.toLowerCase());

    if (targetItems.length === 0) {
      showAlert('No items found for the selected category.', 'No Items', 'warning');
      return;
    }

    const newAuditItems: PhysicalStockItem[] = targetItems.map(item => {
      const systemStock = StockEngine.getItemCurrentStock(item.id);
      const rate = Number(item.unitA?.basicPrice ?? item.purchaseRate ?? 0);
      // Check if item was already in table to preserve user's entered physical stock
      const existing = auditItems.find(ai => ai.itemId === item.id);
      const physicalStock = existing ? existing.physicalStock : systemStock;
      const diffQty = Number((physicalStock - systemStock).toFixed(2));
      const diffValue = Number((diffQty * rate).toFixed(2));

      return {
        itemId: item.id,
        itemName: item.name,
        itemCode: item.sno || '',
        category: item.category || '',
        unit: item.unitA?.unitName || item.unit || 'Pcs',
        systemStock: Number(systemStock.toFixed(2)),
        physicalStock: Number(physicalStock.toFixed(2)),
        diffQty,
        rate: Number(rate.toFixed(2)),
        diffValue
      };
    });

    setAuditItems(newAuditItems);
    showToast(`Loaded ${newAuditItems.length} items into physical audit sheet.`, 'info');
  };

  // Add individual item to the table
  const handleAddSingleItem = (itemId: string) => {
    if (!itemId) return;
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    // Check if already in table
    const exists = auditItems.some(ai => ai.itemId === itemId);
    if (exists) {
      showAlert(`"${item.name}" is already in the audit sheet.`, 'Item Already Added', 'info');
      return;
    }

    const systemStock = StockEngine.getItemCurrentStock(item.id);
    const rate = Number(item.unitA?.basicPrice ?? item.purchaseRate ?? 0);
    const physicalStock = systemStock;
    const diffQty = 0;
    const diffValue = 0;

    const newItem: PhysicalStockItem = {
      itemId: item.id,
      itemName: item.name,
      itemCode: item.sno || '',
      category: item.category || '',
      unit: item.unitA?.unitName || item.unit || 'Pcs',
      systemStock: Number(systemStock.toFixed(2)),
      physicalStock: Number(physicalStock.toFixed(2)),
      diffQty,
      rate: Number(rate.toFixed(2)),
      diffValue
    };

    setAuditItems(prev => [newItem, ...prev]);
    setSelectedSingleItemId('');
    showToast(`Added "${item.name}" to audit sheet.`, 'success');
  };

  // Update physical count for a specific item
  const handlePhysicalStockChange = (index: number, newCountVal: string) => {
    const parsed = parseFloat(newCountVal);
    const validCount = isNaN(parsed) ? 0 : parsed;

    setAuditItems(prev => {
      const updated = [...prev];
      const item = updated[index];
      const diffQty = Number((validCount - item.systemStock).toFixed(2));
      const diffValue = Number((diffQty * item.rate).toFixed(2));

      updated[index] = {
        ...item,
        physicalStock: validCount,
        diffQty,
        diffValue
      };
      return updated;
    });
  };

  // Remove a row
  const handleRemoveRow = (index: number) => {
    setAuditItems(prev => prev.filter((_, i) => i !== index));
  };

  // Bulk: Pre-fill physical counts to match system stock
  const handlePrefillAll = () => {
    setAuditItems(prev =>
      prev.map(item => ({
        ...item,
        physicalStock: item.systemStock,
        diffQty: 0,
        diffValue: 0
      }))
    );
    showToast('Reset all physical counts to match system stock.', 'info');
  };

  // Bulk: Reset all physical counts to 0
  const handleZeroAll = () => {
    setAuditItems(prev =>
      prev.map(item => {
        const diffQty = Number((0 - item.systemStock).toFixed(2));
        const diffValue = Number((diffQty * item.rate).toFixed(2));
        return {
          ...item,
          physicalStock: 0,
          diffQty,
          diffValue
        };
      })
    );
    showToast('Reset all physical counts to 0.', 'info');
  };

  // Summaries & Calculations
  const auditSummary = useMemo(() => {
    let totalSystemQty = 0;
    let totalPhysicalQty = 0;
    let totalDiffQty = 0;
    let totalDiffValue = 0;
    let matchedCount = 0;
    let surplusCount = 0;
    let surplusValue = 0;
    let shortageCount = 0;
    let shortageValue = 0;

    auditItems.forEach(item => {
      totalSystemQty += item.systemStock;
      totalPhysicalQty += item.physicalStock;
      totalDiffQty += item.diffQty;
      totalDiffValue += item.diffValue;

      if (Math.abs(item.diffQty) < 0.001) {
        matchedCount++;
      } else if (item.diffQty > 0) {
        surplusCount++;
        surplusValue += item.diffValue;
      } else {
        shortageCount++;
        shortageValue += Math.abs(item.diffValue);
      }
    });

    return {
      totalItems: auditItems.length,
      totalSystemQty: Number(totalSystemQty.toFixed(2)),
      totalPhysicalQty: Number(totalPhysicalQty.toFixed(2)),
      totalDiffQty: Number(totalDiffQty.toFixed(2)),
      totalDiffValue: Number(totalDiffValue.toFixed(2)),
      matchedCount,
      surplusCount,
      surplusValue: Number(surplusValue.toFixed(2)),
      shortageCount,
      shortageValue: Number(shortageValue.toFixed(2))
    };
  }, [auditItems]);

  // Reset form
  const handleResetForm = () => {
    setEditingAuditId(null);
    setIsViewOnly(false);
    setAuditItems([]);
    setNotes('');
    setAuditNo(StockEngine.getNextBillNumber('PHYSICAL_STOCK'));
    setAuditDate(selectedDate || getTodayDateString());
  };

  // Save Physical Stock Audit
  const handleSaveAudit = () => {
    if (auditItems.length === 0) {
      showAlert('Please add at least one item to the physical audit sheet.', 'Empty Audit', 'warning');
      return;
    }

    if (!auditNo.trim()) {
      showAlert('Please enter an Audit / Voucher Number.', 'Validation Error', 'warning');
      return;
    }

    const auditData: PhysicalStockAudit = {
      id: editingAuditId || `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      auditNo: auditNo.trim(),
      auditDate,
      notes: notes.trim() || undefined,
      items: auditItems,
      totalSystemQty: auditSummary.totalSystemQty,
      totalPhysicalQty: auditSummary.totalPhysicalQty,
      totalDiffQty: auditSummary.totalDiffQty,
      totalDiffValue: auditSummary.totalDiffValue,
      createdAt: new Date().toISOString()
    };

    db.savePhysicalStockAudit(auditData);
    showToast(`Physical Stock Audit ${auditData.auditNo} saved successfully!`, 'success');
    handleResetForm();
  };

  // View / Edit previous audit
  const handleSelectAudit = (audit: PhysicalStockAudit, viewOnlyMode: boolean = false) => {
    setEditingAuditId(audit.id);
    setIsViewOnly(viewOnlyMode);
    setAuditNo(audit.auditNo);
    setAuditDate(audit.auditDate);
    setNotes(audit.notes || '');
    setAuditItems(audit.items || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete previous audit
  const handleDeleteAudit = (id: string) => {
    db.deletePhysicalStockAudit(id);
    showToast('Physical Stock Audit deleted.', 'info');
    setDeleteConfirmId(null);
    if (editingAuditId === id) {
      handleResetForm();
    }
  };

  // Filtered History
  const filteredHistory = useMemo(() => {
    const q = historySearch.toLowerCase().trim();
    return auditHistory.filter(a => {
      if (!q) return true;
      return (
        a.auditNo.toLowerCase().includes(q) ||
        (a.notes && a.notes.toLowerCase().includes(q)) ||
        a.auditDate.includes(q)
      );
    });
  }, [auditHistory, historySearch]);

  const handlePrint = () => {
    window.print();
  };

  // Export current table to Excel
  const handleExportExcel = () => {
    if (auditItems.length === 0) {
      showAlert('No items in the table to export.', 'Empty Data', 'warning');
      return;
    }

    const data = auditItems.map((item, idx) => ({
      'S.No.': idx + 1,
      'Item Code': item.itemCode || '',
      'Item Name': item.itemName,
      'Category': item.category || '',
      'Unit': item.unit,
      'System Stock': item.systemStock,
      'Physical Stock': item.physicalStock,
      'Variance (Diff Qty)': item.diffQty,
      'Unit Purchase Rate (₹)': item.rate,
      'Variance Value (₹)': item.diffValue,
      'Status': item.diffQty === 0 ? 'MATCHED' : item.diffQty > 0 ? `SURPLUS (+${item.diffQty})` : `SHORTAGE (${item.diffQty})`
    }));

    // Add summary totals row
    data.push({
      'S.No.': '' as any,
      'Item Code': '',
      'Item Name': 'TOTAL',
      'Category': '',
      'Unit': '',
      'System Stock': auditSummary.totalSystemQty,
      'Physical Stock': auditSummary.totalPhysicalQty,
      'Variance (Diff Qty)': auditSummary.totalDiffQty,
      'Unit Purchase Rate (₹)': '' as any,
      'Variance Value (₹)': auditSummary.totalDiffValue,
      'Status': `Surplus: +₹${auditSummary.surplusValue} | Shortage: -₹${auditSummary.shortageValue}`
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 28 },
      { wch: 16 },
      { wch: 8 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Physical Stock Audit');
    XLSX.writeFile(workbook, `Physical_Stock_${auditNo || 'Audit'}_${auditDate}.xlsx`);
  };

  return (
    <div className="content-panel-grey">
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="pill-header-lime" style={{ padding: '8px 24px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardCheck size={22} />
            PHYSICAL STOCK ENTRY & AUDIT
          </div>
          {editingAuditId && (
            <span style={{ backgroundColor: isViewOnly ? '#E0E7FF' : '#FEF3C7', color: isViewOnly ? '#3730A3' : '#92400E', padding: '4px 10px', borderRadius: '6px', fontWeight: 800, fontSize: '0.82rem', border: '1px solid currentColor' }}>
              {isViewOnly ? 'VIEWING AUDIT' : 'EDITING AUDIT'}: {auditNo}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {auditItems.length > 0 && (
            <>
              <button
                onClick={handleExportExcel}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#10B981',
                  color: '#FFFFFF',
                  border: '1.5px solid #047857',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                <FileSpreadsheet size={16} />
                Export Excel
              </button>
              <button onClick={handlePrint} className="btn-red-action" style={{ fontSize: '0.85rem' }}>
                <Printer size={15} />
                Print Audit Slip
              </button>
            </>
          )}

          <button
            onClick={handleResetForm}
            className="btn-classic"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '7px 14px' }}
          >
            <RotateCcw size={15} />
            New Audit
          </button>
        </div>
      </div>

      {/* Main Audit Form Card */}
      <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
        {/* Row 1: Audit Metadata (Date, Voucher No, Category Loader, Notes) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#374151', marginBottom: '4px' }}>
              Audit Date:
            </label>
            <input
              type="date"
              className="input-text-clean"
              value={auditDate}
              onChange={e => setAuditDate(e.target.value)}
              disabled={isViewOnly}
              style={{ fontWeight: 800, fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#374151', marginBottom: '4px' }}>
              Audit Voucher No:
            </label>
            <input
              type="text"
              className="input-text-clean"
              value={auditNo}
              onChange={e => setAuditNo(e.target.value)}
              placeholder="e.g. PHY-101"
              disabled={isViewOnly}
              style={{ fontWeight: 800, fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#374151', marginBottom: '4px' }}>
              Remarks / Audit Notes:
            </label>
            <input
              type="text"
              className="input-text-clean"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Monthly Physical Verification"
              disabled={isViewOnly}
              style={{ fontSize: '0.9rem' }}
            />
          </div>

          {/* Load Category Items Button */}
          {!isViewOnly && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#374151', marginBottom: '4px' }}>
                Batch Load by Category:
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <select
                  className="input-text-clean"
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  style={{ fontWeight: 700, fontSize: '0.85rem', flex: 1 }}
                >
                  <option value="ALL">All Categories ({items.length} Items)</option>
                  {categories.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleLoadItems(selectedCategory)}
                  style={{
                    backgroundColor: '#002B99',
                    color: '#FFFFFF',
                    border: '1.5px solid #001A66',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Load Items
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Row 2: Add Single Item manually & Fast Helper Tools */}
        {!isViewOnly && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '10px 14px',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
              marginBottom: '16px'
            }}
          >
            {/* Search single item to add */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px', maxWidth: '460px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#475569', whiteSpace: 'nowrap' }}>
                Add Item:
              </span>
              <div style={{ flex: 1 }}>
                <ItemSearchSelect
                  ref={itemSearchRef}
                  items={items}
                  selectedItemId={selectedSingleItemId}
                  onSelect={(id: string) => {
                    setSelectedSingleItemId(id);
                    if (id) handleAddSingleItem(id);
                  }}
                  placeholder="Type to search and add item..."
                />
              </div>
            </div>

            {/* Helper tools: Pre-fill / Reset */}
            {auditItems.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handlePrefillAll}
                  className="btn-classic"
                  style={{ fontSize: '0.78rem', padding: '5px 10px', background: '#E0E7FF', color: '#1E1B4B', borderColor: '#818CF8' }}
                  title="Copy System Stock into Physical Stock"
                >
                  Pre-fill with System Stock
                </button>
                <button
                  type="button"
                  onClick={handleZeroAll}
                  className="btn-classic"
                  style={{ fontSize: '0.78rem', padding: '5px 10px', background: '#FEE2E2', color: '#991B1B', borderColor: '#FCA5A5' }}
                  title="Reset all Physical Counts to 0"
                >
                  Zero All
                </button>
                <button
                  type="button"
                  onClick={() => setAuditItems([])}
                  className="btn-classic"
                  style={{ fontSize: '0.78rem', padding: '5px 10px', background: '#F3F4F6', color: '#374151' }}
                >
                  Clear Sheet
                </button>
              </div>
            )}
          </div>
        )}

        {/* Audit Items Table */}
        <div className="custom-table-container table-responsive-wrapper" style={{ maxHeight: '420px', overflowY: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--color-lavender-table-head)' }}>
                <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                <th style={{ minWidth: '220px' }}>Item Name / Description</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Unit</th>
                <th style={{ width: '120px', textAlign: 'right', background: '#F1F5F9' }}>System Stock</th>
                <th style={{ width: '130px', textAlign: 'center', background: '#FEF3C7' }}>Physical Count</th>
                <th style={{ width: '120px', textAlign: 'right' }}>Difference Qty</th>
                <th style={{ width: '110px', textAlign: 'right' }}>Unit Rate (₹)</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Variance Value (₹)</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Status</th>
                {!isViewOnly && <th style={{ width: '60px', textAlign: 'center' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {auditItems.length === 0 ? (
                <tr>
                  <td colSpan={isViewOnly ? 9 : 10} style={{ textAlign: 'center', padding: '36px', color: '#64748B', fontWeight: 700 }}>
                    No items in physical audit sheet. Click <strong>"Load Items"</strong> above or search to add individual items.
                  </td>
                </tr>
              ) : (
                auditItems.map((item, idx) => {
                  const isMatched = Math.abs(item.diffQty) < 0.001;
                  const isSurplus = item.diffQty > 0;
                  const isShortage = item.diffQty < 0;

                  return (
                    <tr
                      key={item.itemId}
                      style={{
                        background: isShortage ? '#FEF2F2' : isSurplus ? '#F0FDF4' : 'transparent'
                      }}
                    >
                      <td style={{ textAlign: 'center', fontWeight: 700, color: '#6B7280', fontSize: '0.85rem' }}>
                        {idx + 1}
                      </td>

                      {/* Item Details */}
                      <td style={{ fontWeight: 800 }}>
                        <div style={{ color: '#0F172A', fontSize: '0.92rem' }}>{item.itemName}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>
                          {item.itemCode ? `[${item.itemCode}] ` : ''}{item.category || 'General'}
                        </div>
                      </td>

                      {/* Unit */}
                      <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>
                        {item.unit}
                      </td>

                      {/* System Stock */}
                      <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.95rem', color: '#334155', background: '#F8FAFC' }}>
                        {item.systemStock}
                      </td>

                      {/* Physical Stock Input */}
                      <td style={{ textAlign: 'center', background: '#FFFBEB' }}>
                        {isViewOnly ? (
                          <span style={{ fontWeight: 900, fontSize: '1rem', color: '#000000' }}>{item.physicalStock}</span>
                        ) : (
                          <input
                            type="number"
                            step="any"
                            min="0"
                            className="input-text-clean"
                            value={item.physicalStock}
                            onChange={e => handlePhysicalStockChange(idx, e.target.value)}
                            onFocus={e => e.target.select()}
                            style={{
                              textAlign: 'center',
                              fontWeight: 900,
                              fontSize: '0.95rem',
                              width: '100px',
                              padding: '4px 6px',
                              border: '2px solid #D97706',
                              backgroundColor: '#FFFFFF',
                              color: '#000000'
                            }}
                          />
                        )}
                      </td>

                      {/* Difference Qty */}
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 900,
                          fontSize: '0.95rem',
                          color: isMatched ? '#64748B' : isSurplus ? '#166534' : '#991B1B'
                        }}
                      >
                        {isSurplus ? `+${item.diffQty}` : item.diffQty}
                      </td>

                      {/* Rate */}
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.88rem', color: '#475569' }}>
                        ₹{item.rate.toFixed(2)}
                      </td>

                      {/* Variance Value */}
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 900,
                          fontSize: '0.95rem',
                          color: isMatched ? '#64748B' : isSurplus ? '#166534' : '#991B1B'
                        }}
                      >
                        {isSurplus ? `+₹${item.diffValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : item.diffValue < 0 ? `-₹${Math.abs(item.diffValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                      </td>

                      {/* Status */}
                      <td style={{ textAlign: 'center' }}>
                        {isMatched ? (
                          <span style={{ backgroundColor: '#F1F5F9', color: '#475569', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                            MATCHED
                          </span>
                        ) : isSurplus ? (
                          <span style={{ backgroundColor: '#DCFCE7', color: '#166534', fontSize: '0.72rem', fontWeight: 900, padding: '2px 8px', borderRadius: '4px' }}>
                            SURPLUS (+{item.diffQty})
                          </span>
                        ) : (
                          <span style={{ backgroundColor: '#FEE2E2', color: '#991B1B', fontSize: '0.72rem', fontWeight: 900, padding: '2px 8px', borderRadius: '4px' }}>
                            SHORTAGE ({item.diffQty})
                          </span>
                        )}
                      </td>

                      {/* Delete action */}
                      {!isViewOnly && (
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#DC2626',
                              cursor: 'pointer',
                              padding: '2px'
                            }}
                            title="Remove row"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Live Summary Bar */}
        {auditItems.length > 0 && (
          <div
            style={{
              marginTop: '16px',
              padding: '14px 18px',
              backgroundColor: '#F8FAFC',
              borderRadius: '8px',
              border: '2px solid #000000',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px'
            }}
          >
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>Total Audited Items: </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0F172A' }}>{auditSummary.totalItems}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>Matched: </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#475569' }}>{auditSummary.matchedCount}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534' }}>Surplus (+): </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#166534' }}>
                  {auditSummary.surplusCount} (+₹{auditSummary.surplusValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991B1B' }}>Shortage (-): </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#991B1B' }}>
                  {auditSummary.shortageCount} (-₹{auditSummary.shortageValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                </span>
              </div>
              <div style={{ paddingLeft: '8px', borderLeft: '2px solid #CBD5E1' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0F172A' }}>Net Variance: </span>
                <span
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 900,
                    color: auditSummary.totalDiffValue > 0 ? '#166534' : auditSummary.totalDiffValue < 0 ? '#991B1B' : '#0F172A'
                  }}
                >
                  {auditSummary.totalDiffValue > 0 ? `+₹${auditSummary.totalDiffValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : auditSummary.totalDiffValue < 0 ? `-₹${Math.abs(auditSummary.totalDiffValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                </span>
              </div>
            </div>

            {/* Save Button */}
            {!isViewOnly && (
              <button
                type="button"
                onClick={handleSaveAudit}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#EA3943',
                  color: '#FFFFFF',
                  border: '2px solid #991B1B',
                  padding: '9px 24px',
                  borderRadius: '6px',
                  fontWeight: 900,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                }}
              >
                <Save size={18} />
                {editingAuditId ? 'Update Physical Audit' : 'Save Physical Audit'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Audit History Log Card */}
      <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '10px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontWeight: 900, fontSize: '1.05rem', color: '#1E293B', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardCheck size={18} color="#002B99" />
            Previous Physical Audits History ({auditHistory.length})
          </div>

          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={15} color="#64748B" style={{ position: 'absolute', left: '10px', top: '9px' }} />
            <input
              type="text"
              placeholder="Search audit voucher..."
              className="input-text-clean"
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        <div className="custom-table-container table-responsive-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Audit Date</th>
                <th style={{ width: '120px' }}>Voucher No</th>
                <th style={{ width: '100px', textAlign: 'center' }}>Total Items</th>
                <th style={{ width: '120px', textAlign: 'right', color: '#166534' }}>Surplus Value</th>
                <th style={{ width: '120px', textAlign: 'right', color: '#991B1B' }}>Shortage Value</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Net Variance (₹)</th>
                <th>Notes / Remarks</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#64748B', fontWeight: 700 }}>
                    No recorded physical audits found.
                  </td>
                </tr>
              ) : (
                filteredHistory.map(audit => {
                  let surplusVal = 0;
                  let shortageVal = 0;
                  (audit.items || []).forEach(it => {
                    if (it.diffValue > 0) surplusVal += it.diffValue;
                    if (it.diffValue < 0) shortageVal += Math.abs(it.diffValue);
                  });

                  return (
                    <tr key={audit.id}>
                      <td style={{ fontWeight: 800, fontSize: '0.88rem' }}>
                        {formatDateDMY(audit.auditDate)}
                      </td>
                      <td style={{ fontWeight: 900, color: '#002B99', fontSize: '0.9rem' }}>
                        {audit.auditNo}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>
                        {audit.items?.length || 0}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#166534' }}>
                        {surplusVal > 0 ? `+₹${surplusVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#991B1B' }}>
                        {shortageVal > 0 ? `-₹${shortageVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 900,
                          fontSize: '0.95rem',
                          color: audit.totalDiffValue > 0 ? '#166534' : audit.totalDiffValue < 0 ? '#991B1B' : '#334155'
                        }}
                      >
                        {audit.totalDiffValue > 0 ? `+₹${audit.totalDiffValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : audit.totalDiffValue < 0 ? `-₹${Math.abs(audit.totalDiffValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#475569' }}>
                        {audit.notes || '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleSelectAudit(audit, true)}
                            className="btn-classic"
                            style={{ padding: '3px 6px', fontSize: '0.75rem', background: '#F1F5F9' }}
                            title="View Audit"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectAudit(audit, false)}
                            className="btn-classic"
                            style={{ padding: '3px 6px', fontSize: '0.75rem', background: '#D2BEF6', color: '#002B99' }}
                            title="Edit Audit"
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(audit.id)}
                            className="btn-classic"
                            style={{ padding: '3px 6px', fontSize: '0.75rem', background: '#FEE2E2', color: '#991B1B' }}
                            title="Delete Audit"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteConfirmId)}
        title="Delete Physical Stock Audit"
        message="Are you sure you want to delete this physical stock audit record? This action cannot be undone."
        confirmText="Delete Audit"
        onConfirm={() => deleteConfirmId && handleDeleteAudit(deleteConfirmId)}
        onClose={() => setDeleteConfirmId(null)}
        isDestructive={true}
      />
    </div>
  );
};
