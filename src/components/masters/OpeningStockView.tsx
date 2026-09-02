import React, { useState, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { StockEngine } from '../../db/stockEngine';
import { Save, Search, RefreshCw, AlertCircle } from 'lucide-react';

export const OpeningStockView: React.FC = () => {
  const { refreshKey, showToast } = useApp();
  const { hasPermission } = useAuth();

  const stockSummaries = useMemo(() => StockEngine.getAllItemsStockSummary(), [refreshKey]);
  const [search, setSearch] = useState('');

  // Editable opening stock map
  const [openingStockValues, setOpeningStockValues] = useState<{ [itemId: string]: string }>({});

  // Initialize values
  React.useEffect(() => {
    const initial: { [itemId: string]: string } = {};
    stockSummaries.forEach(s => {
      initial[s.item.id] = String(s.item.openingStock ?? s.openingStock ?? 0);
    });
    setOpeningStockValues(initial);
  }, [stockSummaries]);

  const filteredSummaries = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return stockSummaries;
    return stockSummaries.filter(
      s =>
        s.item.name.toLowerCase().includes(q) ||
        s.item.sno.toLowerCase().includes(q)
    );
  }, [stockSummaries, search]);

  const handleQtyChange = (itemId: string, val: string) => {
    setOpeningStockValues(prev => ({
      ...prev,
      [itemId]: val
    }));
  };

  const handleSaveAll = () => {
    if (!hasPermission('MANAGE_MASTERS')) {
      showToast('You do not have permission to modify opening inventory', 'error');
      return;
    }

    let updatedCount = 0;
    stockSummaries.forEach(s => {
      const inputVal = Number(openingStockValues[s.item.id]);
      if (!isNaN(inputVal) && inputVal !== s.item.openingStock) {
        const item = db.getItemById(s.item.id);
        if (item) {
          item.openingStock = inputVal;
          db.saveItem(item); // saveItem handles updating the OPENING StockMovement record in stock ledger!
          updatedCount++;
        }
      }
    });

    if (updatedCount > 0) {
      showToast(`Updated opening stock for ${updatedCount} items. Stock ledger synchronized.`, 'success');
    } else {
      showToast('No opening stock changes detected.', 'info');
    }
  };

  return (
    <div className="content-panel-grey">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div className="pill-header-lime" style={{ padding: '8px 28px', fontSize: '1.2rem' }}>
          OPENING STOCK MASTER
        </div>

        <button onClick={handleSaveAll} className="btn-lime-action">
          <Save size={16} />
          Save Opening Stock Changes
        </button>
      </div>

      <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '24px' }}>
        <div style={{ background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '0.88rem', color: '#374151' }}>
          <strong>Ledger Invariant:</strong> Opening stock initializes baseline inventory and registers immutable <code>OPENING</code> stock ledger entries.
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={16} color="#6B7280" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search items..."
              className="input-text-clean"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '34px' }}
            />
          </div>
        </div>

        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '90px' }}>S.No.</th>
                <th>Item Description</th>
                <th>Category</th>
                <th style={{ textAlign: 'center', width: '130px', color: '#002B99' }}>Opening Stock</th>
                <th style={{ textAlign: 'center', width: '110px' }}>Purchases</th>
                <th style={{ textAlign: 'center', width: '110px' }}>Sales Out</th>
                <th style={{ textAlign: 'center', width: '110px' }}>Self Use</th>
                <th style={{ textAlign: 'center', width: '130px', color: '#15803D' }}>Current Closing</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummaries.map(s => {
                const currentInput = openingStockValues[s.item.id] ?? String(s.item.openingStock || 0);

                return (
                  <tr key={s.item.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{s.item.sno}</td>
                    <td style={{ fontWeight: 800 }}>{s.item.name}</td>
                    <td>{s.item.category || '-'}</td>

                    {/* Editable Opening Stock */}
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        className="input-text-clean"
                        value={currentInput}
                        onChange={e => handleQtyChange(s.item.id, e.target.value)}
                        style={{
                          width: '100px',
                          textAlign: 'center',
                          fontWeight: 800,
                          fontSize: '1rem',
                          border: '2px solid #4F46E5',
                          background: '#EEF2FF'
                        }}
                      />
                    </td>

                    <td style={{ textAlign: 'center', fontWeight: 700 }}>+{s.purchaseQty}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#EA3943' }}>-{s.saleQty}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#EA3943' }}>-{s.selfUseQty}</td>
                    <td style={{ textAlign: 'center', fontWeight: 900, fontSize: '1.05rem', color: s.isLowStock ? '#EA3943' : '#15803D' }}>
                      {s.closingStock}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
