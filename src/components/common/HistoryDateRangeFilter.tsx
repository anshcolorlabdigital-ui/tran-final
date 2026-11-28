import React from 'react';
import { useApp } from '../../context/AppContext';
import { getTodayDateString } from '../../utils/dateUtils';
import { Calendar } from 'lucide-react';

interface HistoryDateRangeFilterProps {
  className?: string;
}

export const HistoryDateRangeFilter: React.FC<HistoryDateRangeFilterProps> = ({ className }) => {
  const { historyFromDate, historyToDate, setHistoryFromDate, setHistoryToDate, setHistoryDateRange } = useApp();
  const today = getTodayDateString();

  const d = new Date();
  d.setDate(d.getDate() - 7);
  const weekStart = d.toISOString().split('T')[0];

  const parts = today.split('-');
  const monthStart = `${parts[0]}-${parts[1]}-01`;

  const isTodayActive = historyFromDate === today && historyToDate === today;
  const isWeekActive = historyFromDate === weekStart && historyToDate === today;
  const isMonthActive = historyFromDate === monthStart && historyToDate === today;
  const isAllActive = historyFromDate === '' && historyToDate === '';

  const handleSetToday = () => {
    setHistoryDateRange(today, today);
  };

  const handleSetWeek = () => {
    setHistoryDateRange(weekStart, today);
  };

  const handleSetMonth = () => {
    setHistoryDateRange(monthStart, today);
  };

  const handleSetAll = () => {
    setHistoryDateRange('', '');
  };

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
        backgroundColor: '#F3F4F6',
        padding: '4px 10px',
        borderRadius: '8px',
        border: '1px solid #D1D5DB'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 800, color: '#374151' }}>
        <Calendar size={14} color="#4B5563" />
        <span>Date:</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <input
          type="date"
          value={historyFromDate}
          onChange={e => setHistoryFromDate(e.target.value)}
          style={{
            padding: '3px 6px',
            fontSize: '0.8rem',
            fontWeight: 700,
            borderRadius: '4px',
            border: '1px solid #9CA3AF',
            backgroundColor: '#FFFFFF',
            outline: 'none',
            color: '#111827'
          }}
          title="From Date"
        />
        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6B7280' }}>to</span>
        <input
          type="date"
          value={historyToDate}
          onChange={e => setHistoryToDate(e.target.value)}
          style={{
            padding: '3px 6px',
            fontSize: '0.8rem',
            fontWeight: 700,
            borderRadius: '4px',
            border: '1px solid #9CA3AF',
            backgroundColor: '#FFFFFF',
            outline: 'none',
            color: '#111827'
          }}
          title="To Date"
        />
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          type="button"
          onClick={handleSetToday}
          style={{
            padding: '3px 8px',
            fontSize: '0.75rem',
            fontWeight: 800,
            borderRadius: '4px',
            border: isTodayActive ? '1px solid #059669' : '1px solid #D1D5DB',
            backgroundColor: isTodayActive ? '#10B981' : '#FFFFFF',
            color: isTodayActive ? '#FFFFFF' : '#374151',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Today
        </button>

        <button
          type="button"
          onClick={handleSetWeek}
          style={{
            padding: '3px 8px',
            fontSize: '0.75rem',
            fontWeight: 800,
            borderRadius: '4px',
            border: isWeekActive ? '1px solid #7C3AED' : '1px solid #D1D5DB',
            backgroundColor: isWeekActive ? '#8B5CF6' : '#FFFFFF',
            color: isWeekActive ? '#FFFFFF' : '#374151',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Week
        </button>

        <button
          type="button"
          onClick={handleSetMonth}
          style={{
            padding: '3px 8px',
            fontSize: '0.75rem',
            fontWeight: 800,
            borderRadius: '4px',
            border: isMonthActive ? '1px solid #D97706' : '1px solid #D1D5DB',
            backgroundColor: isMonthActive ? '#F59E0B' : '#FFFFFF',
            color: isMonthActive ? '#FFFFFF' : '#374151',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Month
        </button>

        <button
          type="button"
          onClick={handleSetAll}
          style={{
            padding: '3px 8px',
            fontSize: '0.75rem',
            fontWeight: 800,
            borderRadius: '4px',
            border: isAllActive ? '1px solid #2563EB' : '1px solid #D1D5DB',
            backgroundColor: isAllActive ? '#3B82F6' : '#FFFFFF',
            color: isAllActive ? '#FFFFFF' : '#374151',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          All
        </button>
      </div>
    </div>
  );
};
