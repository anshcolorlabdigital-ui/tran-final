import React from 'react';
import { useApp } from '../../context/AppContext';
import { formatDateToDisplay } from '../../utils/dateUtils';
import { Calendar, RefreshCw, Menu, X } from 'lucide-react';

export const Header: React.FC = () => {
  const { selectedDate, setSelectedDate, triggerRefresh, isMobileMenuOpen, toggleMobileMenu } = useApp();

  return (
    <header className="app-top-header">
      <div className="header-left-group">
        <button
          className="mobile-hamburger-btn"
          onClick={toggleMobileMenu}
          aria-label={isMobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
          title={isMobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
          type="button"
        >
          {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <h1 className="app-title">RAW MATERIAL MANAGEMENT SYSTEM</h1>
      </div>

      <div className="header-actions-group">
        {/* Date Selector */}
        <div className="header-action-widget date-widget">
          <Calendar size={16} color="#4B5563" />
          <span className="widget-label">DATE:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={e => e.target.value && setSelectedDate(e.target.value)}
            className="date-input"
            title="Select Dashboard / Transaction Date"
          />
          <span className="date-display-badge">
            ({formatDateToDisplay(selectedDate)})
          </span>
        </div>

        {/* Refresh button */}
        <button
          onClick={triggerRefresh}
          title="Refresh Data"
          className="header-sync-btn"
          type="button"
        >
          <RefreshCw size={14} />
          <span>Sync</span>
        </button>
      </div>
    </header>
  );
};
