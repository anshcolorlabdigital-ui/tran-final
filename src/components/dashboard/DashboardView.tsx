import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { StockEngine } from '../../db/stockEngine';
import { formatDateToDisplay, getTodayDateString } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/calculations';
import { AlertCircle, ShoppingCart, ArrowRight, CreditCard, ChevronLeft, ChevronRight, Calendar, RotateCcw } from 'lucide-react';
import { PaymentCollectModal } from '../common/PaymentCollectModal';

export const DashboardView: React.FC = () => {
  const { selectedDate, refreshKey, setActiveTab } = useApp();
  const [isCollectPaymentOpen, setIsCollectPaymentOpen] = useState(false);
  
  // Date selection state
  const [dateMode, setDateMode] = useState<'SINGLE' | 'RANGE'>('SINGLE');
  const [currentDate, setCurrentDate] = useState<string>(selectedDate || getTodayDateString());
  const [rangeFrom, setRangeFrom] = useState<string>(selectedDate || getTodayDateString());
  const [rangeTo, setRangeTo] = useState<string>(selectedDate || getTodayDateString());

  const todayStr = getTodayDateString();
  const isToday = dateMode === 'SINGLE' && currentDate === todayStr;

  const handlePrevDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    const prev = d.toISOString().split('T')[0];
    setCurrentDate(prev);
  };

  const handleNextDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    const next = d.toISOString().split('T')[0];
    setCurrentDate(next);
  };

  const handleResetToday = () => {
    setCurrentDate(todayStr);
    setRangeFrom(todayStr);
    setRangeTo(todayStr);
  };

  // Quick Range Presets
  const handleSetPreset = (preset: 'TODAY' | 'YESTERDAY' | 'LAST7' | 'THIS_MONTH') => {
    const now = new Date();
    if (preset === 'TODAY') {
      setRangeFrom(todayStr);
      setRangeTo(todayStr);
    } else if (preset === 'YESTERDAY') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setRangeFrom(yStr);
      setRangeTo(yStr);
    } else if (preset === 'LAST7') {
      const past = new Date();
      past.setDate(past.getDate() - 6);
      setRangeFrom(past.toISOString().split('T')[0]);
      setRangeTo(todayStr);
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setRangeFrom(firstDay);
      setRangeTo(todayStr);
    }
  };

  // Calculate live sales numbers for the selected date or date range
  const salesMetrics = useMemo(() => {
    if (dateMode === 'RANGE') {
      return StockEngine.getDashboardSalesMetrics(rangeFrom, rangeTo);
    }
    return StockEngine.getDashboardSalesMetrics(currentDate);
  }, [dateMode, currentDate, rangeFrom, rangeTo, refreshKey]);

  // Retrieve low-stock items with active order statuses
  const lowStockItems = useMemo(() => {
    return StockEngine.getLowStockItems();
  }, [refreshKey]);

  return (
    <div className="content-panel-grey">
      {/* Date Navigation & Range Selector Header Strip */}
      <div
        className="date-selector-strip"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px'
        }}
      >
        {dateMode === 'SINGLE' ? (
          /* Single Date Navigation with Prev/Next Arrows */
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={handlePrevDay}
              className="btn-classic"
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.88rem'
              }}
              title="Previous Day (View yesterday's sales)"
            >
              <ChevronLeft size={18} />
              <span>Prev</span>
            </button>

            {/* Today Badge & Interactive Date Picker */}
            <div
              className="today-date-badge"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 16px',
                border: isToday ? '2px solid #002B99' : '2px solid #000000',
                borderRadius: '10px',
                background: isToday ? '#DCFCE7' : '#FFFFFF',
                boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
              }}
            >
              {isToday && (
                <span className="label" style={{ background: '#16A34A', color: '#FFFFFF', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 900 }}>
                  TODAY
                </span>
              )}
              <input
                type="date"
                value={currentDate}
                onChange={e => setCurrentDate(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontFamily: 'Outfit, sans-serif',
                  fontWeight: 900,
                  fontSize: '1.05rem',
                  color: '#002B99',
                  cursor: 'pointer',
                  outline: 'none'
                }}
                title="Click to select any custom date"
              />
            </div>

            <button
              type="button"
              onClick={handleNextDay}
              className="btn-classic"
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.88rem'
              }}
              title="Next Day (View next day's sales)"
            >
              <span>Next</span>
              <ChevronRight size={18} />
            </button>

            {!isToday && (
              <button
                type="button"
                onClick={handleResetToday}
                className="btn-classic"
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  background: '#FEF3C7',
                  color: '#92400E',
                  border: '1.5px solid #F59E0B',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Reset to today's date"
              >
                <RotateCcw size={14} />
                <span>Today</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setDateMode('RANGE')}
              className="btn-classic"
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                background: '#EEF2FF',
                color: '#3730A3',
                border: '1.5px solid #818CF8',
                fontWeight: 800,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Switch to Date Range Filter"
            >
              <Calendar size={15} />
              <span>Date Range</span>
            </button>
          </div>
        ) : (
          /* Date Range Mode */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', padding: '6px 12px', border: '1.5px solid #000000', borderRadius: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#4B5563' }}>From:</span>
                <input
                  type="date"
                  value={rangeFrom}
                  onChange={e => setRangeFrom(e.target.value)}
                  style={{ border: 'none', fontWeight: 800, fontSize: '0.92rem', color: '#002B99', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', padding: '6px 12px', border: '1.5px solid #000000', borderRadius: '8px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#4B5563' }}>To:</span>
                <input
                  type="date"
                  value={rangeTo}
                  onChange={e => setRangeTo(e.target.value)}
                  style={{ border: 'none', fontWeight: 800, fontSize: '0.92rem', color: '#002B99', outline: 'none' }}
                />
              </div>

              <button
                type="button"
                onClick={() => setDateMode('SINGLE')}
                className="btn-classic"
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  background: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '0.85rem'
                }}
              >
                Single Day Mode
              </button>
            </div>

            {/* Quick Presets for Date Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => handleSetPreset('TODAY')}
                style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '14px', padding: '3px 10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('YESTERDAY')}
                style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '14px', padding: '3px 10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('LAST7')}
                style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '14px', padding: '3px 10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => handleSetPreset('THIS_MONTH')}
                style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '14px', padding: '3px 10px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
              >
                This Month
              </button>
            </div>
          </div>
        )}
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
            padding: '10px 16px',
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
              textTransform: 'uppercase',
              margin: 0
            }}
          >
            SALES {dateMode === 'SINGLE' ? `(${formatDateToDisplay(currentDate)})` : `(${formatDateToDisplay(rangeFrom)} - ${formatDateToDisplay(rangeTo)})`}
          </h2>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#4B5563' }}>
            {salesMetrics.salesCount} {salesMetrics.salesCount === 1 ? 'Sale Invoice' : 'Sale Invoices'} Total
          </span>
        </div>

        {/* 3 Circle Metric Cards */}
        <div
          className="sales-metric-row"
          style={{
            padding: '24px 20px',
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
            borderBottom: '2px solid #000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px'
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
        <div style={{ padding: '16px', backgroundColor: '#D9D9D9' }} className="table-responsive-wrapper">
          <table
            style={{
              width: '100%',
              minWidth: '500px',
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

      {/* Reusable Collect Payment Modal */}
      <PaymentCollectModal
        isOpen={isCollectPaymentOpen}
        onClose={() => setIsCollectPaymentOpen(false)}
      />
    </div>
  );
};
