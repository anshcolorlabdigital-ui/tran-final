import React from 'react';
import { useApp } from '../../context/AppContext';
import { ActiveNavTab } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { db } from '../../db/db';
import { X } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, refreshKey, isMobileMenuOpen, closeMobileMenu } = useApp();

  // Low stock count for subtle badge indicator
  const lowStockItems = React.useMemo(() => {
    return StockEngine.getLowStockItems();
  }, [refreshKey]);

  const pendingOrderCount = React.useMemo(() => {
    return lowStockItems.filter(item => !item.activeOrder).length;
  }, [lowStockItems]);

  const placedOrdersCount = React.useMemo(() => {
    return db.getOrders().filter(o => o.status === 'ORDERED' || o.status === 'PARTIALLY_RECEIVED').length;
  }, [refreshKey]);

  const navItem = (tab: ActiveNavTab, label: string, badgeCount?: number) => {
    const isActive = activeTab === tab;
    return (
      <button
        key={tab}
        className={`pill-nav-btn ${isActive ? 'active' : ''}`}
        onClick={() => setActiveTab(tab)}
        type="button"
      >
        <span>{label}</span>
        {badgeCount !== undefined && badgeCount > 0 && (
          <span
            style={{
              backgroundColor: '#EA3943',
              color: '#FFFFFF',
              fontSize: '0.75rem',
              fontWeight: 900,
              padding: '1px 7px',
              borderRadius: '9999px',
              marginLeft: '4px'
            }}
          >
            {badgeCount}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={closeMobileMenu}
          aria-label="Close navigation overlay"
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Escape') closeMobileMenu(); }}
        />
      )}

      <aside className={`app-sidebar no-print ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        {/* Mobile-only Drawer Header */}
        <div className="mobile-drawer-header">
          <span className="mobile-drawer-title">Navigation Menu</span>
          <button
            className="mobile-drawer-close-btn"
            onClick={closeMobileMenu}
            aria-label="Close navigation menu"
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {/* SECTION 1: DASHBOARD */}
        <div className="nav-section">
          <div
            className="pill-header-lime"
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('DASHBOARD')}
            title="Click to open Main Dashboard"
          >
            DASHBOARD
          </div>
          {navItem('ORDER', 'ORDER', pendingOrderCount)}
          {navItem('ORDERED', 'ORDERED Section', placedOrdersCount > 0 ? placedOrdersCount : undefined)}
          {navItem('PURCHASE', 'PURCHASE')}
          {navItem('SALE', 'SALE')}
          {navItem('SELF_USE', 'SELF USE')}
          {navItem('COLLECT_PAYMENT', 'COLLECT PAYMENT')}
          {navItem('PAY_SUPPLIER', 'PAY SUPPLIER')}
        </div>

        {/* SECTION 2: MASTERS */}
        <div className="nav-section">
          <div className="pill-header-lime">MASTERS</div>
          {navItem('PARTY', 'PARTY')}
          {navItem('ITEM', 'ITEM')}
          {navItem('SUPPLIER', 'SUPPLIER')}
          {navItem('OPENING_STOCK', 'OPENING STOCK')}
        </div>

        {/* SECTION 3: REPORT */}
        <div className="nav-section">
          <div className="pill-header-lime">REPORT</div>
          {navItem('REPORT_SALES', 'SALES')}
          {navItem('REPORT_PURCHASES', 'PURCHASES')}
          {navItem('REPORT_SELF_USE', 'SELF USE')}
          {navItem('REPORT_ITEM_STOCK', 'ITEM STOCK', lowStockItems.length > 0 ? lowStockItems.length : undefined)}
          {navItem('REPORT_PARTY_LEDGER', 'PARTY LEDGER')}
          {navItem('REPORT_SUPPLIER_LEDGER', 'SUPPLIER LEDGER')}
          {navItem('REPORT_ITEM_LEDGER', 'ITEM LEDGER')}
        </div>

        {/* SECTION 4: SETTING */}
        <div className="nav-section">
          <div className="pill-header-lime">SETTING</div>
          {navItem('ADMIN', 'ADMIN')}
          {navItem('USER', 'USER')}
        </div>
      </aside>
    </>
  );
};
