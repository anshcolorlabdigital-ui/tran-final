import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { StockEngine } from '../../db/stockEngine';
import { FileSpreadsheet, Printer, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getTodayDateString } from '../../utils/dateUtils';

type StockStatusFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'ZERO_STOCK';

export const ItemStockReportView: React.FC = () => {
  const { refreshKey, openItemLedger } = useApp();

  const stockSummaries = useMemo(() => StockEngine.getAllItemsStockSummary(), [refreshKey]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilter>('ALL');
  const [showQty, setShowQty] = useState(true);
  const [showAmount, setShowAmount] = useState(false);
  const [showCategoryWise, setShowCategoryWise] = useState(false);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    stockSummaries.forEach(s => {
      if (s.item.category) set.add(s.item.category);
    });
    return Array.from(set);
  }, [stockSummaries]);

  // Filter counts
  const filterCounts = useMemo(() => {
    let inStock = 0;
    let lowStock = 0;
    let zeroStock = 0;
    stockSummaries.forEach(s => {
      if (s.closingStock <= 0) {
        zeroStock++;
      } else {
        inStock++;
        if (s.item.minStock && s.closingStock <= s.item.minStock) {
          lowStock++;
        }
      }
    });
    return { inStock, lowStock, zeroStock, total: stockSummaries.length };
  }, [stockSummaries]);

  // Filtered summaries (sorted by closing stock descending - highest stock first)
  const filteredSummaries = useMemo(() => {
    const q = search.toLowerCase().trim();
    return stockSummaries
      .filter(s => {
        // Stock Status filter
        if (stockStatusFilter === 'IN_STOCK' && s.closingStock <= 0) return false;
        if (stockStatusFilter === 'ZERO_STOCK' && s.closingStock !== 0) return false;
        if (stockStatusFilter === 'LOW_STOCK' && (s.closingStock <= 0 || s.closingStock > (s.item.minStock || 0))) return false;

        // Category filter
        if (selectedCategory !== 'ALL' && s.item.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }

        // Search query
        if (q) {
          return (
            s.item.name.toLowerCase().includes(q) ||
            (s.item.sno && s.item.sno.toLowerCase().includes(q)) ||
            (s.item.category && s.item.category.toLowerCase().includes(q))
          );
        }

        return true;
      })
      .sort((a, b) => (Number(b.closingStock) || 0) - (Number(a.closingStock) || 0));
  }, [stockSummaries, search, selectedCategory, stockStatusFilter]);

  // Aggregated totals for actual monetary values + quantities
  const totals = useMemo(() => {
    let totalOpeningQty = 0;
    let totalOpeningVal = 0;
    let totalPurchaseQty = 0;
    let totalPurchaseVal = 0;
    let totalSaleQty = 0;
    let totalSaleVal = 0;
    let totalSaleCost = 0;
    let totalProfit = 0;
    let totalSelfUseQty = 0;
    let totalSelfUseVal = 0;
    let totalClosingQty = 0;
    let totalValuation = 0;

    filteredSummaries.forEach(s => {
      const baseRate = Number(s.item.unitA?.basicPrice ?? s.item.purchaseRate ?? 0);
      const gstPct = Number(s.item.unitA?.gstPercent ?? s.item.gstPercent ?? 0);
      const tranPct = Number(s.item.unitA?.tranPercent ?? 0);
      const misPct = Number(s.item.unitA?.misPercent ?? 0);
      const gstAmt = Number((baseRate * (gstPct / 100)).toFixed(2));
      const tranAmt = Number((baseRate * (tranPct / 100)).toFixed(2));
      const misAmt = Number((baseRate * (misPct / 100)).toFixed(2));
      const landedCostRate = Number(
        s.item.unitA?.nettPrice && s.item.unitA.nettPrice > 0
          ? s.item.unitA.nettPrice
          : (baseRate + gstAmt + tranAmt + misAmt).toFixed(2)
      );

      const saleRate = Number(
        s.item.unitA?.salePrice && s.item.unitA.salePrice > 0
          ? s.item.unitA.salePrice
          : s.item.saleRate && s.item.saleRate > 0
            ? s.item.saleRate
            : (landedCostRate > 0 ? (landedCostRate * 1.25) : baseRate)
      );

      const opVal = s.openingStock * baseRate;
      const purVal = s.purchaseQty * baseRate;
      const salVal = s.saleQty * saleRate;
      const saleCostVal = s.saleQty * landedCostRate; // (base price + trans + gst + misc) * qty
      const profitVal = salVal - saleCostVal;
      const suVal = s.selfUseQty * baseRate;
      const stockVal = Math.max(0, s.closingStock) * baseRate;

      totalOpeningQty += s.openingStock;
      totalOpeningVal += opVal;
      totalPurchaseQty += s.purchaseQty;
      totalPurchaseVal += purVal;
      totalSaleQty += s.saleQty;
      totalSaleVal += salVal;
      totalSaleCost += saleCostVal;
      totalProfit += profitVal;
      totalSelfUseQty += s.selfUseQty;
      totalSelfUseVal += suVal;
      totalClosingQty += s.closingStock;
      totalValuation += stockVal;
    });

    return {
      count: filteredSummaries.length,
      totalOpeningQty: Number(totalOpeningQty.toFixed(2)),
      totalOpeningVal: Number(totalOpeningVal.toFixed(2)),
      totalPurchaseQty: Number(totalPurchaseQty.toFixed(2)),
      totalPurchaseVal: Number(totalPurchaseVal.toFixed(2)),
      totalSaleQty: Number(totalSaleQty.toFixed(2)),
      totalSaleVal: Number(totalSaleVal.toFixed(2)),
      totalSaleCost: Number(totalSaleCost.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(2)),
      totalSelfUseQty: Number(totalSelfUseQty.toFixed(2)),
      totalSelfUseVal: Number(totalSelfUseVal.toFixed(2)),
      totalClosingQty: Number(totalClosingQty.toFixed(2)),
      totalValuation: Number(totalValuation.toFixed(2)),
      totalAllCount: stockSummaries.length
    };
  }, [filteredSummaries, stockSummaries]);

  // Group by category if "Show Category Wise" is enabled
  const categoryGroups = useMemo(() => {
    if (!showCategoryWise) return null;
    const map = new Map<string, typeof filteredSummaries>();
    filteredSummaries.forEach(s => {
      const cat = s.item.category || 'General / Uncategorized';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    });
    return Array.from(map.entries());
  }, [showCategoryWise, filteredSummaries]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const data = filteredSummaries.map((s, idx) => {
      const baseRate = Number(s.item.unitA?.basicPrice ?? s.item.purchaseRate ?? 0);
      const gstPct = Number(s.item.unitA?.gstPercent ?? s.item.gstPercent ?? 0);
      const tranPct = Number(s.item.unitA?.tranPercent ?? 0);
      const misPct = Number(s.item.unitA?.misPercent ?? 0);
      const gstAmt = Number((baseRate * (gstPct / 100)).toFixed(2));
      const tranAmt = Number((baseRate * (tranPct / 100)).toFixed(2));
      const misAmt = Number((baseRate * (misPct / 100)).toFixed(2));
      const landedCostRate = Number(
        s.item.unitA?.nettPrice && s.item.unitA.nettPrice > 0
          ? s.item.unitA.nettPrice
          : (baseRate + gstAmt + tranAmt + misAmt).toFixed(2)
      );

      const saleRate = Number(
        s.item.unitA?.salePrice && s.item.unitA.salePrice > 0
          ? s.item.unitA.salePrice
          : s.item.saleRate && s.item.saleRate > 0
            ? s.item.saleRate
            : (landedCostRate > 0 ? (landedCostRate * 1.25) : baseRate)
      );

      const opVal = Number((s.openingStock * baseRate).toFixed(2));
      const purVal = Number((s.purchaseQty * baseRate).toFixed(2));
      const salVal = Number((s.saleQty * saleRate).toFixed(2));
      const saleCostVal = Number((s.saleQty * landedCostRate).toFixed(2));
      const profitVal = Number((salVal - saleCostVal).toFixed(2));
      const suVal = Number((s.selfUseQty * baseRate).toFixed(2));
      const stockVal = Number((Math.max(0, s.closingStock) * baseRate).toFixed(2));

      return {
        'S.No.': idx + 1,
        'Item Code': s.item.sno || '',
        'Item Name': s.item.name,
        'Category': s.item.category || '',
        'Unit': s.item.unitA?.unitName || s.item.unit || 'Pcs',
        'Unit Purchase Rate (₹)': baseRate,
        'Unit Landed Cost (₹)': landedCostRate,
        'Opening Qty': Number(s.openingStock.toFixed(2)),
        'Opening Value (₹)': opVal,
        'Purchases Qty (+)': Number(s.purchaseQty.toFixed(2)),
        'Purchases Value (₹)': purVal,
        'Sales Qty (-)': Number(s.saleQty.toFixed(2)),
        'Sales Value (₹)': salVal,
        'Sales Purchase Cost (Base+GST+Tran+Misc) (₹)': saleCostVal,
        'Sales Profit (₹)': profitVal,
        'Self Use Qty (-)': Number(s.selfUseQty.toFixed(2)),
        'Self Use Value (₹)': suVal,
        'On-Hand Stock Qty': Number(s.closingStock.toFixed(2)),
        'Total Stock Valuation (₹)': stockVal
      };
    });

    // Add Summary TOTAL row at the bottom
    data.push({
      'S.No.': '' as any,
      'Item Code': '',
      'Item Name': 'TOTAL',
      'Category': '',
      'Unit': '',
      'Unit Purchase Rate (₹)': '' as any,
      'Unit Landed Cost (₹)': '' as any,
      'Opening Qty': totals.totalOpeningQty,
      'Opening Value (₹)': totals.totalOpeningVal,
      'Purchases Qty (+)': totals.totalPurchaseQty,
      'Purchases Value (₹)': totals.totalPurchaseVal,
      'Sales Qty (-)': totals.totalSaleQty,
      'Sales Value (₹)': totals.totalSaleVal,
      'Sales Purchase Cost (Base+GST+Tran+Misc) (₹)': totals.totalSaleCost,
      'Sales Profit (₹)': totals.totalProfit,
      'Self Use Qty (-)': totals.totalSelfUseQty,
      'Self Use Value (₹)': totals.totalSelfUseVal,
      'On-Hand Stock Qty': totals.totalClosingQty,
      'Total Stock Valuation (₹)': totals.totalValuation
    });

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 6 },  // S.No.
      { wch: 12 }, // Item Code
      { wch: 30 }, // Item Name
      { wch: 18 }, // Category
      { wch: 10 }, // Unit
      { wch: 18 }, // Rate
      { wch: 18 }, // Landed Cost
      { wch: 14 }, // Opening Qty
      { wch: 18 }, // Opening Value
      { wch: 16 }, // Purchases Qty
      { wch: 18 }, // Purchases Value
      { wch: 14 }, // Sales Qty
      { wch: 18 }, // Sales Value
      { wch: 22 }, // Sales Purchase Cost
      { wch: 20 }, // Sales Profit
      { wch: 16 }, // Self Use Qty
      { wch: 18 }, // Self Use Value
      { wch: 18 }, // Stock Qty
      { wch: 22 }  // Total Stock Valuation
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Item Stock Values');
    XLSX.writeFile(workbook, `Item_Stock_Values_${getTodayDateString()}.xlsx`);
  };

  const renderTableRow = (s: typeof filteredSummaries[0]) => {
    const baseRate = Number((Number(s.item.unitA?.basicPrice ?? s.item.purchaseRate ?? 0)).toFixed(2));
    const opVal = Number((s.openingStock * baseRate).toFixed(2));
    const purVal = Number((s.purchaseQty * baseRate).toFixed(2));
    const salVal = Number((s.saleQty * (s.item.unitA?.salePrice || baseRate)).toFixed(2));
    const suVal = Number((s.selfUseQty * baseRate).toFixed(2));
    const stockVal = Number((Math.max(0, s.closingStock) * baseRate).toFixed(2));

    const oppDisplay = showAmount && !showQty ? opVal : (showAmount && showQty ? `${s.openingStock} (₹${opVal})` : s.openingStock);
    const purcDisplay = showAmount && !showQty ? purVal : (showAmount && showQty ? `${s.purchaseQty} (₹${purVal})` : s.purchaseQty);
    const saleDisplay = showAmount && !showQty ? salVal : (showAmount && showQty ? `${s.saleQty} (₹${salVal})` : s.saleQty);
    const useDisplay = showAmount && !showQty ? suVal : (showAmount && showQty ? `${s.selfUseQty} (₹${suVal})` : s.selfUseQty);
    const stockDisplay = showAmount && !showQty ? stockVal : (showAmount && showQty ? `${s.closingStock} (₹${stockVal})` : s.closingStock);

    return (
      <tr key={s.item.id} style={{ borderBottom: '1px solid #000000' }}>
        <td style={{ padding: '8px 12px', fontWeight: 800, fontSize: '0.86rem', color: '#111827', borderRight: '1px solid #000000' }}>
          <button
            type="button"
            onClick={() => openItemLedger(s.item.id)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontWeight: 800,
              fontSize: '0.86rem',
              color: '#000000',
              cursor: 'pointer',
              textAlign: 'left',
              textTransform: 'uppercase'
            }}
            title="Click to view Item Ledger"
          >
            {s.item.name}
          </button>
        </td>
        <td style={{ textAlign: 'center', padding: '8px', fontSize: '0.84rem', fontWeight: 800, borderRight: '1px solid #000000' }}>
          {s.item.unitA?.unitName || s.item.unit || 'PCS'}
        </td>
        <td style={{ textAlign: 'center', padding: '8px', fontSize: '0.84rem', fontWeight: 800, borderRight: '1px solid #000000' }}>
          {baseRate}
        </td>
        <td style={{ textAlign: 'center', padding: '8px', fontSize: '0.84rem', fontWeight: 800, borderRight: '1px solid #000000' }}>
          {oppDisplay}
        </td>
        <td style={{ textAlign: 'center', padding: '8px', fontSize: '0.84rem', fontWeight: 800, borderRight: '1px solid #000000' }}>
          {purcDisplay}
        </td>
        <td style={{ textAlign: 'center', padding: '8px', fontSize: '0.84rem', fontWeight: 800, borderRight: '1px solid #000000' }}>
          {saleDisplay}
        </td>
        <td style={{ textAlign: 'center', padding: '8px', fontSize: '0.84rem', fontWeight: 800, borderRight: '1px solid #000000' }}>
          {useDisplay}
        </td>
        <td style={{ textAlign: 'center', padding: '8px', fontSize: '0.84rem', fontWeight: 800 }}>
          {stockDisplay}
        </td>
      </tr>
    );
  };

  return (
    <div className="content-panel-grey">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div className="pill-header-lime" style={{ padding: '8px 28px', fontSize: '1.2rem', fontWeight: 900 }}>
          ITEM STOCK REPORT
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleExportExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#059669',
              color: '#FFFFFF',
              border: '1.5px solid #047857',
              padding: '7px 18px',
              borderRadius: '20px',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
            title="Export Excel (.xlsx) with Values & Quantities"
          >
            <FileSpreadsheet size={16} />
            Export Excel (.xlsx)
          </button>
          <button
            onClick={handlePrint}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              border: '1.5px solid #DC2626',
              padding: '7px 18px',
              borderRadius: '20px',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            <Printer size={15} />
            PRINT REPORT
          </button>
        </div>
      </div>

      {/* 6 Top KPI Summary Cards matching image */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '10px',
        marginBottom: '14px'
      }}>
        <div style={{
          background: '#FFFFFF',
          border: '1.5px solid #10B981',
          borderRadius: '8px',
          padding: '10px 12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#DC2626', textTransform: 'uppercase', marginBottom: '4px' }}>
            OPP. VALUE
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#111827' }}>
            ₹{totals.totalOpeningVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{
          background: '#FFFFFF',
          border: '1.5px solid #10B981',
          borderRadius: '8px',
          padding: '10px 12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#DC2626', textTransform: 'uppercase', marginBottom: '4px' }}>
            PURCHASES VALUE
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#111827' }}>
            ₹{totals.totalPurchaseVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{
          background: '#FFFFFF',
          border: '1.5px solid #10B981',
          borderRadius: '8px',
          padding: '10px 12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#DC2626', textTransform: 'uppercase', marginBottom: '4px' }}>
            SALES VALUE
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#111827' }}>
            ₹{totals.totalSaleVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{
          background: '#FFFFFF',
          border: '1.5px solid #10B981',
          borderRadius: '8px',
          padding: '10px 12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#DC2626', textTransform: 'uppercase', marginBottom: '4px' }}>
            SALES PROFIT
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: totals.totalProfit >= 0 ? '#15803D' : '#DC2626' }}>
            {totals.totalProfit >= 0 ? '+' : ''}₹{totals.totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{
          background: '#FFFFFF',
          border: '1.5px solid #10B981',
          borderRadius: '8px',
          padding: '10px 12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#DC2626', textTransform: 'uppercase', marginBottom: '4px' }}>
            SELF USE
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#111827' }}>
            ₹{totals.totalSelfUseVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{
          background: '#FFFFFF',
          border: '1.5px solid #10B981',
          borderRadius: '8px',
          padding: '10px 12px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 900, color: '#DC2626', textTransform: 'uppercase', marginBottom: '4px' }}>
            STOCK VALUE
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#111827' }}>
            ₹{totals.totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Filter and Search Controls Card matching image */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1.5px solid #000000',
          borderRadius: '8px',
          padding: '8px 14px',
          marginBottom: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '240px', flex: 1, maxWidth: '340px' }}>
            <Search size={15} color="#6B7280" style={{ position: 'absolute', left: '10px', top: '9px' }} />
            <input
              type="text"
              placeholder="Search by code, name, category.."
              className="input-text-clean"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '0.88rem', height: '34px' }}
            />
          </div>

          {/* Stock Status Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1F2937', whiteSpace: 'nowrap' }}>
              Stock Status:
            </span>
            <select
              className="input-text-clean"
              value={stockStatusFilter}
              onChange={e => setStockStatusFilter(e.target.value as StockStatusFilter)}
              style={{
                fontWeight: 800,
                fontSize: '0.85rem',
                padding: '4px 10px',
                height: '34px',
                minWidth: '180px'
              }}
            >
              <option value="ALL">All Items ({filterCounts.total})</option>
              <option value="IN_STOCK">In Stock ({filterCounts.inStock})</option>
              <option value="LOW_STOCK">Low Stock ({filterCounts.lowStock})</option>
              <option value="ZERO_STOCK">Zero Stock ({filterCounts.zeroStock})</option>
            </select>
          </div>

          {/* Category Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1F2937', whiteSpace: 'nowrap' }}>
              Category:
            </span>
            <select
              className="input-text-clean"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{ fontWeight: 700, fontSize: '0.85rem', padding: '4px 10px', height: '34px', minWidth: '160px' }}
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick count badge */}
        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4B5563', whiteSpace: 'nowrap' }}>
          Showing <span style={{ color: '#002B99', fontWeight: 900 }}>{filteredSummaries.length}</span> of {totals.totalAllCount} items
        </div>
      </div>

      {/* Checkbox Options Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '12px', paddingLeft: '4px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.86rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showQty}
            onChange={e => setShowQty(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          Show Qty
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.86rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showAmount}
            onChange={e => setShowAmount(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          Show Amount
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.86rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showCategoryWise}
            onChange={e => setShowCategoryWise(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          Show Category Wise
        </label>
      </div>

      {/* Stock Table matching image */}
      <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '4px', overflow: 'hidden' }}>
        <div className="custom-table-container table-responsive-wrapper" style={{ margin: 0, border: 'none' }}>
          <table className="custom-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ background: '#D4C4FB', borderBottom: '1.5px solid #000000' }}>
                <th style={{ textAlign: 'left', padding: '9px 12px', fontWeight: 900, color: '#000000', fontSize: '0.86rem', borderRight: '1px solid #000000' }}>ITEM</th>
                <th style={{ textAlign: 'center', width: '70px', padding: '9px 8px', fontWeight: 900, color: '#000000', fontSize: '0.86rem', borderRight: '1px solid #000000' }}>UNIT</th>
                <th style={{ textAlign: 'center', width: '85px', padding: '9px 8px', fontWeight: 900, color: '#000000', fontSize: '0.86rem', borderRight: '1px solid #000000' }}>RATE</th>
                <th style={{ textAlign: 'center', width: '90px', padding: '9px 8px', fontWeight: 900, color: '#000000', fontSize: '0.86rem', borderRight: '1px solid #000000' }}>
                  {showAmount && !showQty ? 'OPP. (₹)' : 'OPP.'}
                </th>
                <th style={{ textAlign: 'center', width: '90px', padding: '9px 8px', fontWeight: 900, color: '#000000', fontSize: '0.86rem', borderRight: '1px solid #000000' }}>
                  {showAmount && !showQty ? 'PURC. (₹)' : 'PURC.'}
                </th>
                <th style={{ textAlign: 'center', width: '90px', padding: '9px 8px', fontWeight: 900, color: '#000000', fontSize: '0.86rem', borderRight: '1px solid #000000' }}>
                  {showAmount && !showQty ? 'SALE (₹)' : 'SALE'}
                </th>
                <th style={{ textAlign: 'center', width: '85px', padding: '9px 8px', fontWeight: 900, color: '#000000', fontSize: '0.86rem', borderRight: '1px solid #000000' }}>
                  {showAmount && !showQty ? 'USE (₹)' : 'USE'}
                </th>
                <th style={{ textAlign: 'center', width: '95px', padding: '9px 8px', fontWeight: 900, color: '#000000', fontSize: '0.86rem' }}>
                  {showAmount && !showQty ? 'STOCK (₹)' : 'STOCK'}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSummaries.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#6B7280', fontWeight: 700 }}>
                    No stock summary items found matching the selected filters.
                  </td>
                </tr>
              ) : showCategoryWise && categoryGroups ? (
                categoryGroups.map(([catName, groupItems]) => (
                  <React.Fragment key={catName}>
                    {/* Category Header Row */}
                    <tr style={{ background: '#F3E8FF', borderTop: '1.5px solid #000000', borderBottom: '1.5px solid #000000' }}>
                      <td colSpan={8} style={{ fontWeight: 900, padding: '7px 12px', fontSize: '0.86rem', color: '#6B21A8', textTransform: 'uppercase' }}>
                        📁 {catName} ({groupItems.length} items)
                      </td>
                    </tr>
                    {groupItems.map(s => renderTableRow(s))}
                  </React.Fragment>
                ))
              ) : (
                filteredSummaries.map(s => renderTableRow(s))
              )}
            </tbody>
            <tfoot>
              <tr style={{ background: '#D4C4FB', borderTop: '2px solid #000000' }}>
                <td colSpan={4} style={{ padding: '10px 14px', fontWeight: 900, fontSize: '0.92rem', textAlign: 'center', color: '#000000', borderRight: '1px solid #000000' }}>
                  TOTAL
                </td>
                <td style={{ textAlign: 'center', fontWeight: 900, fontSize: '0.92rem', color: '#000000', padding: '10px 8px', borderRight: '1px solid #000000' }}>
                  {showAmount && !showQty ? totals.totalPurchaseVal.toFixed(2) : totals.totalPurchaseQty}
                </td>
                <td style={{ textAlign: 'center', fontWeight: 900, fontSize: '0.92rem', color: '#000000', padding: '10px 8px', borderRight: '1px solid #000000' }}>
                  {showAmount && !showQty ? totals.totalSaleVal.toFixed(2) : totals.totalSaleQty}
                </td>
                <td style={{ textAlign: 'center', fontWeight: 900, fontSize: '0.92rem', color: '#000000', padding: '10px 8px', borderRight: '1px solid #000000' }}>
                  {showAmount && !showQty ? totals.totalSelfUseVal.toFixed(2) : totals.totalSelfUseQty}
                </td>
                <td style={{ textAlign: 'center', fontWeight: 900, fontSize: '0.92rem', color: '#000000', padding: '10px 8px' }}>
                  {showAmount && !showQty ? totals.totalValuation.toFixed(2) : totals.totalClosingQty}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
