import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { StockEngine } from '../../db/stockEngine';
import { formatDateToDisplay } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/calculations';
import { AlertCircle, ShoppingCart, ArrowRight } from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { selectedDate, refreshKey, setActiveTab } = useApp();

  // Calculate live sales numbers for the selected date
  const salesMetrics = useMemo(() => {
    return StockEngine.getDashboardSalesMetrics(selectedDate);
  }, [selectedDate, refreshKey]);

  // Retrieve low-stock items with active order statuses
  const lowStockItems = useMemo(() => {
    return StockEngine.getLowStockItems();
  }, [refreshKey]);

  return (
    <div className="content-panel-grey">
      {/* Date Header Strip */}
      <div className="date-selector-strip">
        <div className="today-date-badge">
          <span className="label">TODAY</span>
          <span>{formatDateToDisplay(selectedDate)}</span>
        </div>
      </div>

      {/* SALES SUMMARY SECTION */}
      <div
        style={{
          border: '2px solid #000000',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: '#D9D9D9',
          marginBottom: '24px'
        }}
      >
        <div
          style={{
            backgroundColor: '#D9D9D9',
            padding: '8px 16px',
            textAlign: 'center',
            borderBottom: '2px solid #000000'
          }}
        >
          <h2
            style={{
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 900,
              fontSize: '1.35rem',
              color: '#002B99',
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}
          >
            SALES
          </h2>
        </div>

        {/* 3 Circle Metric Cards */}
        <div
          style={{
            padding: '24px 20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
            background: '#D9D9D9'
          }}
        >
          {/* CASH */}
          <div className="metric-circle-card">
            <div className="metric-title">CASH</div>
            <div className="metric-value">
              {formatCurrency(salesMetrics.cash, false)}
            </div>
          </div>

          {/* ONLINE */}
          <div className="metric-circle-card">
            <div className="metric-title">ONLINE</div>
            <div className="metric-value">
              {formatCurrency(salesMetrics.online, false)}
            </div>
          </div>

          {/* TOTAL */}
          <div className="metric-circle-card">
            <div className="metric-title">TOTAL</div>
            <div className="metric-value">
              {formatCurrency(salesMetrics.total, false)}
            </div>
          </div>
        </div>
      </div>

      {/* STOCK / LOW STOCK SECTION */}
      <div
        style={{
          border: '2px solid #000000',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: '#D9D9D9'
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--color-lime)',
            padding: '10px 16px',
            textAlign: 'center',
            borderBottom: '2px solid #000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}
        >
          <h2
            style={{
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 900,
              fontSize: '1.35rem',
              color: '#002B99',
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}
          >
            STOCK
          </h2>

          <button
            onClick={() => setActiveTab('ORDER')}
            style={{
              position: 'absolute',
              right: '16px',
              background: '#FFFFFF',
              border: '1px solid #000000',
              borderRadius: '20px',
              padding: '4px 12px',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <ShoppingCart size={14} />
            Manage Orders
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Stock Table */}
        <div style={{ padding: '16px', backgroundColor: '#D9D9D9' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'separate',
              borderSpacing: '0 8px'
            }}
          >
            <thead>
              <tr style={{ background: 'transparent' }}>
                <th
                  style={{
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontFamily: 'Outfit, sans-serif',
                    fontWeight: 800,
                    fontSize: '1rem',
                    color: '#000000',
                    textTransform: 'uppercase'
                  }}
                >
                  ITEM
                </th>
                <th
                  style={{
                    padding: '8px 12px',
                    textAlign: 'center',
                    fontFamily: 'Outfit, sans-serif',
                    fontWeight: 800,
                    fontSize: '1rem',
                    color: '#EA3943',
                    textTransform: 'uppercase',
                    width: '120px'
                  }}
                >
                  STOCK
                </th>
                <th
                  style={{
                    padding: '8px 12px',
                    textAlign: 'center',
                    fontFamily: 'Outfit, sans-serif',
                    fontWeight: 800,
                    fontSize: '1rem',
                    color: '#000000',
                    textTransform: 'uppercase',
                    width: '160px'
                  }}
                >
                  ORDER
                </th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #000000',
                      borderRadius: '8px',
                      padding: '24px',
                      textAlign: 'center',
                      fontWeight: 700,
                      color: '#15803D'
                    }}
                  >
                    ✓ All inventory items are adequately stocked above their reorder levels.
                  </td>
                </tr>
              ) : (
                lowStockItems.map(summary => {
                  const hasOrder = !!summary.activeOrder;
                  return (
                    <tr key={summary.item.id}>
                      {/* ITEM NAME */}
                      <td
                        style={{
                          background: '#E0E0E0',
                          border: '1px solid #000000',
                          borderTopLeftRadius: '4px',
                          borderBottomLeftRadius: '4px',
                          padding: '10px 14px',
                          fontWeight: 800,
                          fontSize: '0.95rem',
                          color: '#000000'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{summary.item.name}</span>
                          <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600 }}>
                            (Min: {summary.item.minStock})
                          </span>
                        </div>
                      </td>

                      {/* STOCK */}
                      <td
                        style={{
                          background: '#FFFFFF',
                          borderTop: '1px solid #000000',
                          borderBottom: '1px solid #000000',
                          padding: '10px 14px',
                          textAlign: 'center',
                          fontFamily: 'Outfit, sans-serif',
                          fontWeight: 900,
                          fontSize: '1.2rem',
                          color: '#EA3943'
                        }}
                      >
                        {summary.closingStock}
                      </td>

                      {/* ORDER STATUS */}
                      <td
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #000000',
                          borderTopRightRadius: '4px',
                          borderBottomRightRadius: '4px',
                          padding: '8px 12px',
                          textAlign: 'center'
                        }}
                      >
                        {hasOrder ? (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              lineHeight: 1.2
                            }}
                          >
                            <span
                              style={{
                                color: '#059669',
                                fontWeight: 900,
                                fontSize: '0.85rem',
                                letterSpacing: '0.03em',
                                textTransform: 'uppercase'
                              }}
                            >
                              {summary.activeOrder?.supplierName}
                            </span>
                            <span
                              style={{
                                color: '#059669',
                                fontSize: '0.75rem',
                                fontWeight: 700
                              }}
                            >
                              {formatDateToDisplay(summary.activeOrder?.orderDate)}
                            </span>
                          </div>
                        ) : (
                          <span
                            style={{
                              color: '#EA3943',
                              fontWeight: 900,
                              fontSize: '0.9rem',
                              letterSpacing: '0.05em',
                              textTransform: 'uppercase'
                            }}
                          >
                            PENDING
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
