import React, { useState, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { PhysicalStockAudit, PhysicalStockItem } from '../../types';
import { formatDateDMY, getTodayDateString } from '../../utils/dateUtils';
import {
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  ClipboardCheck,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';
import * as XLSX from 'xlsx';

type VarianceTypeFilter = 'ALL' | 'DISCREPANCY_ONLY' | 'SHORTAGE_ONLY' | 'SURPLUS_ONLY' | 'MATCHED_ONLY';

export const PhysicalStockReportView: React.FC = () => {
  const { refreshKey, openItemLedger } = useApp();

  const audits = useMemo(() => db.getPhysicalStockAudits(), [refreshKey]);
  const items = useMemo(() => db.getItems(), [refreshKey]);

  // Filters state
  const [selectedAuditId, setSelectedAuditId] = useState<string>('ALL');
  const [varianceFilter, setVarianceFilter] = useState<VarianceTypeFilter>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Extract all flat audit items with audit metadata attached
  const allAuditRows = useMemo(() => {
    const rows: (PhysicalStockItem & { auditDate: string; auditNo: string; auditId: string; notes?: string })[] = [];

    audits.forEach(audit => {
      // Date filter on audit date
      if (fromDate && audit.auditDate < fromDate) return;
      if (toDate && audit.auditDate > toDate) return;
      if (selectedAuditId !== 'ALL' && audit.id !== selectedAuditId) return;

      (audit.items || []).forEach(item => {
        rows.push({
          ...item,
          auditDate: audit.auditDate,
          auditNo: audit.auditNo,
          auditId: audit.id,
          notes: audit.notes
        });
      });
    });

    return rows;
  }, [audits, selectedAuditId, fromDate, toDate]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    allAuditRows.forEach(r => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set);
  }, [allAuditRows]);

  // Filtered rows based on category, search, and variance type
  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();

    return allAuditRows.filter(row => {
      // Variance filter
      const isMatched = Math.abs(row.diffQty) < 0.001;
      const isSurplus = row.diffQty > 0.001;
      const isShortage = row.diffQty < -0.001;

      if (varianceFilter === 'DISCREPANCY_ONLY' && isMatched) return false;
      if (varianceFilter === 'SHORTAGE_ONLY' && !isShortage) return false;
      if (varianceFilter === 'SURPLUS_ONLY' && !isSurplus) return false;
      if (varianceFilter === 'MATCHED_ONLY' && !isMatched) return false;

      // Category filter
      if (selectedCategory !== 'ALL' && row.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }

      // Search query
      if (q) {
        return (
          row.itemName.toLowerCase().includes(q) ||
          (row.itemCode && row.itemCode.toLowerCase().includes(q)) ||
          (row.category && row.category.toLowerCase().includes(q)) ||
          row.auditNo.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [allAuditRows, varianceFilter, selectedCategory, search]);

  // Aggregated summary metrics
  const summary = useMemo(() => {
    let totalSystemQty = 0;
    let totalSystemValuation = 0;
    let totalPhysicalQty = 0;
    let totalPhysicalValuation = 0;
    let totalDiffQty = 0;
    let totalNetVarianceValue = 0;
    let totalShortageValue = 0;
    let totalShortageQty = 0;
    let totalSurplusValue = 0;
    let totalSurplusQty = 0;
    let matchedCount = 0;
    let shortageCount = 0;
    let surplusCount = 0;

    filteredRows.forEach(r => {
      const rate = r.rate || 0;
      const sysVal = r.systemStock * rate;
      const phyVal = r.physicalStock * rate;

      totalSystemQty += r.systemStock;
      totalSystemValuation += sysVal;
      totalPhysicalQty += r.physicalStock;
      totalPhysicalValuation += phyVal;
      totalDiffQty += r.diffQty;
      totalNetVarianceValue += r.diffValue;

      if (Math.abs(r.diffQty) < 0.001) {
        matchedCount++;
      } else if (r.diffQty > 0) {
        surplusCount++;
        totalSurplusQty += r.diffQty;
        totalSurplusValue += r.diffValue;
      } else {
        shortageCount++;
        totalShortageQty += Math.abs(r.diffQty);
        totalShortageValue += Math.abs(r.diffValue);
      }
    });

    return {
      totalRows: filteredRows.length,
      totalSystemQty: Number(totalSystemQty.toFixed(2)),
      totalSystemValuation: Number(totalSystemValuation.toFixed(2)),
      totalPhysicalQty: Number(totalPhysicalQty.toFixed(2)),
      totalPhysicalValuation: Number(totalPhysicalValuation.toFixed(2)),
      totalDiffQty: Number(totalDiffQty.toFixed(2)),
      totalNetVarianceValue: Number(totalNetVarianceValue.toFixed(2)),
      totalShortageValue: Number(totalShortageValue.toFixed(2)),
      totalShortageQty: Number(totalShortageQty.toFixed(2)),
      totalSurplusValue: Number(totalSurplusValue.toFixed(2)),
      totalSurplusQty: Number(totalSurplusQty.toFixed(2)),
      matchedCount,
      shortageCount,
      surplusCount
    };
  }, [filteredRows]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const data = filteredRows.map((r, idx) => ({
      'S.No.': idx + 1,
      'Audit Date': formatDateDMY(r.auditDate),
      'Voucher No': r.auditNo,
      'Item Code': r.itemCode || '',
      'Item Name': r.itemName,
      'Category': r.category || '',
      'Unit': r.unit,
      'System Stock': r.systemStock,
      'Physical Stock': r.physicalStock,
      'Variance Qty': r.diffQty,
      'Unit Purchase Rate (₹)': r.rate,
      'System Valuation (₹)': Number((r.systemStock * r.rate).toFixed(2)),
      'Physical Valuation (₹)': Number((r.physicalStock * r.rate).toFixed(2)),
      'Net Variance (₹)': r.diffValue,
      'Status': Math.abs(r.diffQty) < 0.001 ? 'MATCHED' : r.diffQty > 0 ? `SURPLUS (+${r.diffQty})` : `SHORTAGE (${r.diffQty})`
    }));

    // Add Summary Row
    data.push({
      'S.No.': '' as any,
      'Audit Date': '',
      'Voucher No': '',
      'Item Code': '',
      'Item Name': 'TOTAL SUMMARY',
      'Category': '',
      'Unit': '',
      'System Stock': summary.totalSystemQty,
      'Physical Stock': summary.totalPhysicalQty,
      'Variance Qty': summary.totalDiffQty,
      'Unit Purchase Rate (₹)': '' as any,
      'System Valuation (₹)': summary.totalSystemValuation,
      'Physical Valuation (₹)': summary.totalPhysicalValuation,
      'Net Variance (₹)': summary.totalNetVarianceValue,
      'Status': `Surplus: +₹${summary.totalSurplusValue} | Shortage: -₹${summary.totalShortageValue}`
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 28 },
      { wch: 16 },
      { wch: 8 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 22 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Physical Stock Variance');
    XLSX.writeFile(workbook, `Physical_Stock_Report_${getTodayDateString()}.xlsx`);
  };

  return (
    <div className="content-panel-grey">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div className="pill-header-lime" style={{ padding: '8px 28px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClipboardCheck size={22} />
          PHYSICAL STOCK VARIANCE REPORT
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleExportExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#10B981',
              color: '#FFFFFF',
              border: '1.5px solid #047857',
              padding: '7px 16px',
              borderRadius: '6px',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
            title="Export Excel (.xlsx)"
          >
            <FileSpreadsheet size={16} />
            Export Excel (.xlsx)
          </button>
          <button onClick={handlePrint} className="btn-red-action" style={{ fontSize: '0.85rem' }}>
            <Printer size={15} />
            Print Report
          </button>
        </div>
      </div>

      {/* Filter and Search Controls Card */}
      <div
        style={{
          background: '#FFFFFF',
          border: '2px solid #000000',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Audit Voucher Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1F2937', whiteSpace: 'nowrap' }}>
              Audit Voucher:
            </label>
            <select
              className="input-text-clean"
              value={selectedAuditId}
              onChange={e => setSelectedAuditId(e.target.value)}
              style={{ fontWeight: 800, fontSize: '0.85rem', padding: '6px 10px', minWidth: '160px' }}
            >
              <option value="ALL">All Audits ({audits.length})</option>
              {audits.map(a => (
                <option key={a.id} value={a.id}>
                  {a.auditNo} ({formatDateDMY(a.auditDate)})
                </option>
              ))}
            </select>
          </div>

          {/* Variance Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1F2937', whiteSpace: 'nowrap' }}>
              Variance Type:
            </label>
            <select
              className="input-text-clean"
              value={varianceFilter}
              onChange={e => setVarianceFilter(e.target.value as VarianceTypeFilter)}
              style={{
                fontWeight: 800,
                fontSize: '0.85rem',
                padding: '6px 12px',
                minWidth: '190px',
                backgroundColor: varianceFilter === 'SHORTAGE_ONLY' ? '#FEE2E2' : varianceFilter === 'SURPLUS_ONLY' ? '#DCFCE7' : varianceFilter === 'DISCREPANCY_ONLY' ? '#FEF3C7' : '#FFFFFF',
                color: varianceFilter === 'SHORTAGE_ONLY' ? '#991B1B' : varianceFilter === 'SURPLUS_ONLY' ? '#166534' : varianceFilter === 'DISCREPANCY_ONLY' ? '#92400E' : '#111827'
              }}
            >
              <option value="ALL">All Items Audited ({allAuditRows.length})</option>
              <option value="DISCREPANCY_ONLY">Only Variances / Differences</option>
              <option value="SHORTAGE_ONLY">Only Shortages (- Loss)</option>
              <option value="SURPLUS_ONLY">Only Surpluses (+ Excess)</option>
              <option value="MATCHED_ONLY">Only Matched (0 Diff)</option>
            </select>
          </div>

          {/* Category Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1F2937', whiteSpace: 'nowrap' }}>
              Category:
            </label>
            <select
              className="input-text-clean"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{ fontWeight: 700, fontSize: '0.85rem', padding: '6px 10px', minWidth: '150px' }}
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1F2937', whiteSpace: 'nowrap' }}>
              From:
            </label>
            <input
              type="date"
              className="input-text-clean"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '5px 8px' }}
            />
            <label style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1F2937', whiteSpace: 'nowrap' }}>
              To:
            </label>
            <input
              type="date"
              className="input-text-clean"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '5px 8px' }}
            />
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                }}
                className="btn-classic"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
              >
                Clear Dates
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Search Box & Item Count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ position: 'relative', width: '320px' }}>
            <Search size={16} color="#6B7280" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search by code, item, voucher..."
              className="input-text-clean"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '34px', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4B5563' }}>
            Showing <span style={{ color: '#002B99', fontWeight: 900 }}>{filteredRows.length}</span> audit items
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stat-grid-auto" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B' }}>1. SYSTEM BOOK VALUATION</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1E293B' }}>
            ₹{summary.totalSystemValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', marginTop: '2px' }}>
            Total Qty: {summary.totalSystemQty}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0284C7' }}>2. PHYSICAL COUNT VALUATION</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0284C7' }}>
            ₹{summary.totalPhysicalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0284C7', marginTop: '2px' }}>
            Total Qty: {summary.totalPhysicalQty}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#166534' }}>3. TOTAL SURPLUS (+ EXCESS)</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#166534' }}>
            +₹{summary.totalSurplusValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', marginTop: '2px' }}>
            {summary.surplusCount} items (+{summary.totalSurplusQty} qty)
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '12px 14px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#991B1B' }}>4. TOTAL SHORTAGE (- DEFICIT)</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#991B1B' }}>
            -₹{summary.totalShortageValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991B1B', marginTop: '2px' }}>
            {summary.shortageCount} items (-{summary.totalShortageQty} qty)
          </div>
        </div>

        <div
          style={{
            background: summary.totalNetVarianceValue > 0 ? '#F0FDF4' : summary.totalNetVarianceValue < 0 ? '#FEF2F2' : '#F8FAFC',
            border: `2px solid ${summary.totalNetVarianceValue > 0 ? '#166534' : summary.totalNetVarianceValue < 0 ? '#991B1B' : '#000000'}`,
            borderRadius: '8px',
            padding: '12px 14px'
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155' }}>5. NET VARIANCE VALUE (₹)</div>
          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 900,
              color: summary.totalNetVarianceValue > 0 ? '#166534' : summary.totalNetVarianceValue < 0 ? '#991B1B' : '#0F172A'
            }}
          >
            {summary.totalNetVarianceValue > 0 ? `+₹${summary.totalNetVarianceValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : summary.totalNetVarianceValue < 0 ? `-₹${Math.abs(summary.totalNetVarianceValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginTop: '2px' }}>
            Net Qty Diff: {summary.totalDiffQty > 0 ? `+${summary.totalDiffQty}` : summary.totalDiffQty}
          </div>
        </div>
      </div>

      {/* Variance Table */}
      <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '10px', padding: '16px' }}>
        <div className="custom-table-container table-responsive-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '90px' }}>Date</th>
                <th style={{ width: '100px' }}>Voucher</th>
                <th style={{ minWidth: '180px' }}>Item Description</th>
                <th style={{ textAlign: 'right', width: '90px' }}>Rate (₹)</th>
                <th style={{ textAlign: 'right', width: '110px' }}>System Stock</th>
                <th style={{ textAlign: 'right', width: '110px', color: '#0284C7' }}>Physical Count</th>
                <th style={{ textAlign: 'right', width: '110px' }}>Variance Qty</th>
                <th style={{ textAlign: 'right', width: '130px' }}>System Val (₹)</th>
                <th style={{ textAlign: 'right', width: '130px' }}>Physical Val (₹)</th>
                <th style={{ textAlign: 'right', width: '140px' }}>Variance Val (₹)</th>
                <th style={{ textAlign: 'center', width: '100px' }}>Status</th>
                <th style={{ textAlign: 'center', width: '70px' }}>Ledger</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: '32px', color: '#64748B', fontWeight: 700 }}>
                    No physical stock audit records found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, idx) => {
                  const isMatched = Math.abs(r.diffQty) < 0.001;
                  const isSurplus = r.diffQty > 0.001;
                  const isShortage = r.diffQty < -0.001;
                  const sysVal = Number((r.systemStock * r.rate).toFixed(2));
                  const phyVal = Number((r.physicalStock * r.rate).toFixed(2));

                  return (
                    <tr
                      key={`${r.auditId}_${r.itemId}_${idx}`}
                      style={{
                        background: isShortage ? '#FEF2F2' : isSurplus ? '#F0FDF4' : 'transparent'
                      }}
                    >
                      <td style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                        {formatDateDMY(r.auditDate)}
                      </td>
                      <td style={{ fontSize: '0.88rem', fontWeight: 900, color: '#002B99' }}>
                        {r.auditNo}
                      </td>
                      <td style={{ fontWeight: 800 }}>
                        <div style={{ color: '#0F172A', fontSize: '0.9rem' }}>{r.itemName}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748B', fontWeight: 600 }}>
                          {r.itemCode ? `[${r.itemCode}] ` : ''}{r.category || 'General'} • {r.unit}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.88rem' }}>
                        ₹{r.rate.toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.9rem' }}>
                        {r.systemStock}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 900, fontSize: '0.92rem', color: '#0284C7' }}>
                        {r.physicalStock}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 900,
                          fontSize: '0.92rem',
                          color: isMatched ? '#64748B' : isSurplus ? '#166534' : '#991B1B'
                        }}
                      >
                        {isSurplus ? `+${r.diffQty}` : r.diffQty}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.88rem' }}>
                        ₹{sysVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.88rem', color: '#0284C7' }}>
                        ₹{phyVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 900,
                          fontSize: '0.95rem',
                          color: isMatched ? '#64748B' : isSurplus ? '#166534' : '#991B1B'
                        }}
                      >
                        {isSurplus ? `+₹${r.diffValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : r.diffValue < 0 ? `-₹${Math.abs(r.diffValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isMatched ? (
                          <span style={{ backgroundColor: '#F1F5F9', color: '#475569', fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                            MATCHED
                          </span>
                        ) : isSurplus ? (
                          <span style={{ backgroundColor: '#DCFCE7', color: '#166534', fontSize: '0.7rem', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>
                            SURPLUS
                          </span>
                        ) : (
                          <span style={{ backgroundColor: '#FEE2E2', color: '#991B1B', fontSize: '0.7rem', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>
                            SHORTAGE
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openItemLedger(r.itemId)}
                          className="btn-classic"
                          style={{
                            background: '#D2BEF6',
                            color: '#002B99',
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            padding: '2px 6px',
                            border: '1.5px solid #000000'
                          }}
                          title="Open item ledger"
                        >
                          Ledger
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--color-lavender-table-head)', borderTop: '2px solid #000000' }}>
                <td style={{ padding: '10px 12px', fontWeight: 900, textAlign: 'right' }} colSpan={4}>
                  TOTAL SUMMARY:
                </td>
                <td style={{ textAlign: 'right', fontWeight: 900 }}>{summary.totalSystemQty}</td>
                <td style={{ textAlign: 'right', fontWeight: 900, color: '#0284C7' }}>{summary.totalPhysicalQty}</td>
                <td
                  style={{
                    textAlign: 'right',
                    fontWeight: 900,
                    color: summary.totalDiffQty > 0 ? '#166534' : summary.totalDiffQty < 0 ? '#991B1B' : '#0F172A'
                  }}
                >
                  {summary.totalDiffQty > 0 ? `+${summary.totalDiffQty}` : summary.totalDiffQty}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 900 }}>
                  ₹{summary.totalSystemValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 900, color: '#0284C7' }}>
                  ₹{summary.totalPhysicalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontWeight: 900,
                    fontSize: '1.05rem',
                    color: summary.totalNetVarianceValue > 0 ? '#166534' : summary.totalNetVarianceValue < 0 ? '#991B1B' : '#0F172A'
                  }}
                >
                  {summary.totalNetVarianceValue > 0 ? `+₹${summary.totalNetVarianceValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : summary.totalNetVarianceValue < 0 ? `-₹${Math.abs(summary.totalNetVarianceValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
