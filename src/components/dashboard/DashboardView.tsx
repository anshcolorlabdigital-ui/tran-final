import React, { useState, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { StockEngine } from '../../db/stockEngine';
import { formatDateToDisplay, getTodayDateString } from '../../utils/dateUtils';
import { formatCurrency, round2 } from '../../utils/calculations';
import { ItemSearchSelect } from '../common/ItemSearchSelect';

export const DashboardView: React.FC = () => {
  const { refreshKey } = useApp();

  const items = useMemo(() => db.getItems(), [refreshKey]);
  const purchases = useMemo(() => db.getPurchases(), [refreshKey]);
  const sales = useMemo(() => db.getSales(), [refreshKey]);
  const selfUses = useMemo(() => db.getSelfUses(), [refreshKey]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.category && i.category.trim()) set.add(i.category.trim());
    });
    return Array.from(set).sort();
  }, [items]);

  // Filter state for dashboard center search
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>(() => {
    return items.length > 0 ? items[0].id : '';
  });

  const [showQty, setShowQty] = useState<boolean>(true);
  const [showAmount, setShowAmount] = useState<boolean>(false);

  // Filtered items based on selected category
  const filteredItemsByCategory = useMemo(() => {
    if (!selectedCategory) return items;
    return items.filter(i => (i.category || '').toLowerCase() === selectedCategory.toLowerCase());
  }, [items, selectedCategory]);

  // Selected item entity
  const selectedItem = useMemo(() => {
    const found = items.find(i => i.id === selectedItemId);
    return found || (items.length > 0 ? items[0] : null);
  }, [items, selectedItemId]);

  // Compute live stock value for selected item
  const itemClosingStock = useMemo(() => {
    if (!selectedItem) return 0;
    return StockEngine.getItemCurrentStock(selectedItem.id);
  }, [selectedItem, refreshKey]);

  const itemStockValue = useMemo(() => {
    if (!selectedItem) return 0;
    const rate = selectedItem.purchaseRate || (selectedItem.unitA?.basicPrice ?? 0);
    return round2(itemClosingStock * rate);
  }, [selectedItem, itemClosingStock]);

  // Transactions list for selected item
  const itemLedgerRows = useMemo(() => {
    if (!selectedItem) return [];

    const rows: Array<{
      date: string;
      billNo: string;
      supplier: string;
      unit: string;
      basicPrice: number;
      purcQty: number;
      saleQty: number;
      useQty: number;
      stockAfter: number;
    }> = [];

    let currentStock = Number(selectedItem.openingStock) || 0;

    // Collect all transactions
    const rawEvents: Array<{
      date: string;
      billNo: string;
      supplierOrParty: string;
      unit: string;
      basicPrice: number;
      purc: number;
      sale: number;
      use: number;
    }> = [];

    // Purchases
    purchases.forEach(p => {
      const match = p.items.find(it => it.itemId === selectedItem.id);
      if (match) {
        rawEvents.push({
          date: p.billDate,
          billNo: p.billNo,
          supplierOrParty: p.supplierName,
          unit: selectedItem.unit || 'PCS',
          basicPrice: match.purchaseRate || match.basicPrice || selectedItem.purchaseRate || 0,
          purc: Number(match.qty) || 0,
          sale: 0,
          use: 0
        });
      }
    });

    // Sales
    sales.forEach(s => {
      const match = s.items.find(it => it.itemId === selectedItem.id);
      if (match) {
        rawEvents.push({
          date: s.billDate,
          billNo: s.billNo,
          supplierOrParty: s.partyName,
          unit: selectedItem.unit || 'PCS',
          basicPrice: match.salePrice || selectedItem.saleRate || 0,
          purc: 0,
          sale: Number(match.qty) || 0,
          use: 0
        });
      }
    });

    // Self Use
    selfUses.forEach(su => {
      const match = su.items.find(it => it.itemId === selectedItem.id);
      if (match) {
        rawEvents.push({
          date: su.billDate,
          billNo: su.billNo,
          supplierOrParty: su.remarks || 'Self-Use',
          unit: selectedItem.unit || 'PCS',
          basicPrice: match.rate || selectedItem.purchaseRate || 0,
          purc: 0,
          sale: 0,
          use: Number(match.qty) || 0
        });
      }
    });

    // Sort chronologically
    rawEvents.sort((a, b) => a.date.localeCompare(b.date));

    rawEvents.forEach(ev => {
      currentStock += ev.purc - ev.sale - ev.use;
      rows.push({
        date: ev.date,
        billNo: ev.billNo,
        supplier: ev.supplierOrParty,
        unit: ev.unit,
        basicPrice: ev.basicPrice,
        purcQty: ev.purc,
        saleQty: ev.sale,
        useQty: ev.use,
        stockAfter: round2(currentStock)
      });
    });

    return rows;
  }, [selectedItem, purchases, sales, selfUses]);

  // Aggregate totals for the preview table
  const ledgerTotals = useMemo(() => {
    let purc = 0;
    let sale = 0;
    let use = 0;
    itemLedgerRows.forEach(r => {
      purc += r.purcQty;
      sale += r.saleQty;
      use += r.useQty;
    });
    return {
      purc: round2(purc),
      sale: round2(sale),
      use: round2(use),
      closingStock: itemClosingStock
    };
  }, [itemLedgerRows, itemClosingStock]);

  return (
    <div className="content-panel-grey" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* WELCOME HEADER matching mockup */}
      <div style={{ textAlign: 'center', marginTop: '4px' }}>
        <h1
          style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '2rem',
            fontWeight: 900,
            margin: '0 0 2px',
            color: '#000000',
            letterSpacing: '0.04em'
          }}
        >
          WELCOME
        </h1>
        <h2
          style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '1.75rem',
            fontWeight: 900,
            margin: '0 0 4px',
            color: '#000000',
            letterSpacing: '0.03em'
          }}
        >
          RAW MATERIAL MANAGEMENT SYSTEM
        </h2>
        <div style={{ fontSize: '0.78rem', color: '#DC2626', fontWeight: 800, lineHeight: 1.2 }}>
          Devloped by evodebs<br />
          Ansh Rajput
        </div>
      </div>

      {/* CENTER SEARCH SECTION matching mockup */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          maxWidth: '560px',
          margin: '0 auto',
          width: '100%'
        }}
      >
        {/* Search Category */}
        <select
          value={selectedCategory}
          onChange={e => {
            setSelectedCategory(e.target.value);
            // Optionally select first item in this category
            const match = items.find(i => !e.target.value || (i.category || '').toLowerCase() === e.target.value.toLowerCase());
            if (match) setSelectedItemId(match.id);
          }}
          style={{
            width: '100%',
            maxWidth: '380px',
            padding: '8px 14px',
            border: '1.5px solid #000000',
            borderRadius: '4px',
            fontSize: '0.95rem',
            fontWeight: 700,
            textAlign: 'center',
            background: '#FFFFFF',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="">Search Category (All Categories)</option>
          {categories.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Search Item */}
        <div style={{ width: '100%', maxWidth: '480px' }}>
          <ItemSearchSelect
            items={filteredItemsByCategory}
            selectedItemId={selectedItem?.id || ''}
            onSelect={id => {
              if (id) setSelectedItemId(id);
            }}
            placeholder="Type item name or code to search..."
          />
        </div>

        {/* UNIT-A & UNIT-B PARALLEL BOXES matching mockup */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: (selectedItem?.hasSecondaryUnit && selectedItem?.unitB?.unitName && selectedItem?.unitB?.isActive !== false) ? '1fr 1fr' : '1fr',
            gap: '24px',
            width: '100%',
            maxWidth: (selectedItem?.hasSecondaryUnit && selectedItem?.unitB?.unitName && selectedItem?.unitB?.isActive !== false) ? '560px' : '280px',
            marginTop: '6px'
          }}
        >
          {/* Unit-A */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: '4px' }}>
              Unit-A : {selectedItem?.unitA?.unitName || selectedItem?.unit || 'Box'}
            </div>
            <div
              style={{
                border: '1.5px solid #000000',
                height: '38px',
                background: '#FFFFFF',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '1rem'
              }}
            >
              {selectedItem?.unitA?.unitName || selectedItem?.unit || ''}
            </div>

            <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#15803D', margin: '8px 0 4px' }}>
              SALE PRICE
            </div>
            <div
              style={{
                border: '1.5px solid #000000',
                height: '48px',
                background: '#FFFFFF',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '1.3rem',
                color: '#002B99'
              }}
            >
              {selectedItem?.unitA?.salePrice ?? selectedItem?.saleRate ?? 0}
            </div>
          </div>

          {/* Unit-B */}
          {Boolean(selectedItem?.hasSecondaryUnit && selectedItem?.unitB?.unitName && selectedItem?.unitB?.isActive !== false) && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', marginBottom: '4px' }}>
                Unit-B : {selectedItem?.unitB?.unitName || 'Box'}
              </div>
              <div
                style={{
                  border: '1.5px solid #000000',
                  height: '38px',
                  background: '#FFFFFF',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1rem'
                }}
              >
                {selectedItem?.unitB?.unitName || ''}
              </div>

              <div style={{ fontWeight: 900, fontSize: '0.9rem', color: '#15803D', margin: '8px 0 4px' }}>
                SALE PRICE
              </div>
              <div
                style={{
                  border: '1.5px solid #000000',
                  height: '48px',
                  background: '#FFFFFF',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1.3rem',
                  color: '#002B99'
                }}
              >
                {selectedItem?.unitB?.salePrice ?? 0}
              </div>
            </div>
          )}
        </div>

        {/* Current Stock Value matching mockup */}
        <div style={{ textAlign: 'center', marginTop: '6px', width: '100%', maxWidth: '240px' }}>
          <div style={{ fontWeight: 900, fontSize: '0.92rem', color: '#15803D', marginBottom: '4px' }}>
            Curent Stock Value
          </div>
          <div
            style={{
              border: '1.5px solid #000000',
              height: '42px',
              background: '#FFFFFF',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '1.25rem',
              color: '#000000'
            }}
          >
            {itemStockValue}
          </div>
        </div>
      </div>

      {/* ITEM LEADGER SECTION matching mockup */}
      <div style={{ marginTop: '10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '8px'
          }}
        >
          <h3
            style={{
              margin: 0,
              fontWeight: 900,
              fontSize: '1.2rem',
              color: '#000000',
              letterSpacing: '0.04em'
            }}
          >
            ITEM LEADGER
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showQty}
                onChange={e => setShowQty(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              Show Qty
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showAmount}
                onChange={e => setShowAmount(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              Show Amount
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>OPP. Opening Stock</span>
              <div
                style={{
                  border: '1.5px solid #000000',
                  padding: '4px 14px',
                  background: '#FFFFFF',
                  borderRadius: '4px',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  minWidth: '50px',
                  textAlign: 'center'
                }}
              >
                {selectedItem?.openingStock ?? 0}
              </div>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div
          style={{
            background: '#FFFFFF',
            border: '2px solid #000000',
            borderRadius: '6px',
            overflow: 'hidden'
          }}
        >
          <div className="table-responsive-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
              <thead>
                <tr style={{ background: '#D4C4FB', borderBottom: '2px solid #000000' }}>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.88rem', width: '110px' }}>
                    DATE
                  </th>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.88rem', width: '110px' }}>
                    BILL NO.
                  </th>
                  <th style={{ padding: '8px 12px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.88rem', textAlign: 'left' }}>
                    SUPPLIER
                  </th>
                  <th style={{ padding: '8px 8px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.88rem', width: '70px' }}>
                    UNIT
                  </th>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.88rem', width: '90px' }}>
                    B.PRICE
                  </th>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.88rem', width: '80px' }}>
                    PURC.
                  </th>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.88rem', width: '80px' }}>
                    SALE
                  </th>
                  <th style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.88rem', width: '80px' }}>
                    USE
                  </th>
                  <th style={{ padding: '8px 10px', fontWeight: 900, fontSize: '0.88rem', width: '90px' }}>
                    STOCK
                  </th>
                </tr>
              </thead>
              <tbody>
                {itemLedgerRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#4B5563', fontWeight: 700 }}>
                      No transactions recorded for {selectedItem?.name || 'this item'}.
                    </td>
                  </tr>
                ) : (
                  itemLedgerRows.map((r, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #000000', background: '#FFFFFF' }}>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 700 }}>
                        {formatDateToDisplay(r.date)}
                      </td>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 800, fontFamily: 'monospace' }}>
                        {r.billNo}
                      </td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid #000000', textAlign: 'left', fontWeight: 700 }}>
                        {r.supplier}
                      </td>
                      <td style={{ padding: '8px 8px', borderRight: '1px solid #000000', fontWeight: 700 }}>
                        {r.unit}
                      </td>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 800 }}>
                        {r.basicPrice}
                      </td>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 900 }}>
                        {r.purcQty || ''}
                      </td>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 900 }}>
                        {r.saleQty || ''}
                      </td>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 900 }}>
                        {r.useQty || ''}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 900, color: '#002B99' }}>
                        {r.stockAfter}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: '#D4C4FB', borderTop: '2px solid #000000' }}>
                  <td colSpan={5} style={{ padding: '8px 14px', fontWeight: 900, textAlign: 'left', borderRight: '1px solid #000000' }}>
                    TOTAL
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 900, borderRight: '1px solid #000000' }}>
                    {ledgerTotals.purc}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 900, borderRight: '1px solid #000000' }}>
                    {ledgerTotals.sale}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 900, borderRight: '1px solid #000000' }}>
                    {ledgerTotals.use}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 900 }}>
                    {ledgerTotals.closingStock}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
