import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ActiveNavTab } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { db } from '../../db/db';
import { X, LogOut, ShieldCheck, UserCheck, Shield, ChevronDown } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, refreshKey, isMobileMenuOpen, closeMobileMenu, showToast } = useApp();
  const { currentUser, logout, hasPermission, isAdmin } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
        onClick={() => {
          setActiveTab(tab);
          closeMobileMenu();
        }}
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

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    showToast('You have been logged out successfully.', 'info');
  };

  if (!currentUser) return null;

  // Permission Checks for Tabs
  const canViewDashboard = hasPermission('VIEW_DASHBOARD');
  const canViewOrder = hasPermission('VIEW_ORDERS') || hasPermission('MANAGE_ORDERS');
  const canViewOrdered = hasPermission('VIEW_ORDERED') || hasPermission('RECEIVE_ORDER');
  const canViewPurchase = hasPermission('VIEW_PURCHASES') || hasPermission('CREATE_PURCHASE');
  const canViewSale = hasPermission('VIEW_SALES') || hasPermission('CREATE_SALE');
  const canViewSelfUse = hasPermission('VIEW_SELF_USE') || hasPermission('CREATE_SELF_USE');
  const canCollectPayment = hasPermission('COLLECT_PAYMENT');
  const canPaySupplier = hasPermission('PAY_SUPPLIER');
  const canPhysicalStock = hasPermission('VIEW_PHYSICAL_STOCK') || hasPermission('MANAGE_PHYSICAL_STOCK') || isAdmin;

  const canPartyMaster = hasPermission('MANAGE_PARTY_MASTER') || hasPermission('VIEW_MASTERS') || hasPermission('MANAGE_MASTERS');
  const canItemMaster = hasPermission('MANAGE_ITEM_MASTER') || hasPermission('VIEW_MASTERS') || hasPermission('MANAGE_MASTERS');
  const canSupplierMaster = hasPermission('MANAGE_SUPPLIER_MASTER') || hasPermission('VIEW_MASTERS') || hasPermission('MANAGE_MASTERS');
  const canOpeningStock = hasPermission('MANAGE_OPENING_STOCK') || hasPermission('VIEW_MASTERS') || hasPermission('ADJUST_STOCK') || hasPermission('MANAGE_MASTERS');

  const canReportSales = hasPermission('VIEW_SALES_REPORT') || hasPermission('VIEW_REPORTS');
  const canReportPurchases = hasPermission('VIEW_PURCHASE_REPORT') || hasPermission('VIEW_REPORTS');
  const canReportSelfUse = hasPermission('VIEW_SELF_USE_REPORT') || hasPermission('VIEW_REPORTS');
  const canReportItemStock = hasPermission('VIEW_ITEM_STOCK_REPORT') || hasPermission('VIEW_REPORTS');
  const canReportPartyLedger = hasPermission('VIEW_PARTY_LEDGER_REPORT') || hasPermission('VIEW_REPORTS');
  const canReportSupplierLedger = hasPermission('VIEW_SUPPLIER_LEDGER_REPORT') || hasPermission('VIEW_REPORTS');
  const canReportItemLedger = hasPermission('VIEW_ITEM_LEDGER_REPORT') || hasPermission('VIEW_REPORTS');
  const canReportPhysicalStock = hasPermission('VIEW_PHYSICAL_STOCK_REPORT') || hasPermission('VIEW_REPORTS') || isAdmin;

  const hasAnyMasters = canPartyMaster || canItemMaster || canSupplierMaster || canOpeningStock;
  const hasAnyReports = canReportSales || canReportPurchases || canReportSelfUse || canReportItemStock || canReportPartyLedger || canReportSupplierLedger || canReportItemLedger || canReportPhysicalStock;

  const [isMastersOpen, setIsMastersOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Automatically expand section if the active tab is inside it
  const isMasterTab = ['PARTY', 'ITEM', 'SUPPLIER', 'OPENING_STOCK'].includes(activeTab);
  const isReportTab = ['REPORT_SALES', 'REPORT_PURCHASES', 'REPORT_SELF_USE', 'REPORT_ITEM_STOCK', 'REPORT_PARTY_LEDGER', 'REPORT_SUPPLIER_LEDGER', 'REPORT_ITEM_LEDGER', 'REPORT_PHYSICAL_STOCK'].includes(activeTab);
  const isSettingTab = ['ADMIN', 'USER'].includes(activeTab);

  React.useEffect(() => {
    if (isMasterTab) setIsMastersOpen(true);
    if (isReportTab) setIsReportsOpen(true);
    if (isSettingTab) setIsSettingsOpen(true);
  }, [activeTab]);

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

        {/* Scrollable Nav Items */}
        <div className="sidebar-nav-scroll-area">
          {/* SECTION 1: DASHBOARD & TRANSACTIONS (Open by default) */}
          <div className="nav-section">
            <div
              className="pill-header-lime"
              style={{ cursor: canViewDashboard ? 'pointer' : 'default' }}
              onClick={() => { if (canViewDashboard) { setActiveTab('DASHBOARD'); closeMobileMenu(); } }}
              title="Click to open Main Dashboard"
            >
              DASHBOARD
            </div>
            {canViewOrder && navItem('ORDER', 'ORDER', pendingOrderCount)}
            {canViewOrdered && navItem('ORDERED', 'ORDERED Section', placedOrdersCount > 0 ? placedOrdersCount : undefined)}
            {canViewPurchase && navItem('PURCHASE', 'PURCHASE')}
            {canViewSale && navItem('SALE', 'SALE')}
            {canViewSelfUse && navItem('SELF_USE', 'SELF USE')}
            {canCollectPayment && navItem('COLLECT_PAYMENT', 'COLLECT PAYMENT')}
            {canPaySupplier && navItem('PAY_SUPPLIER', 'PAY SUPPLIER')}
            {canPhysicalStock && navItem('PHYSICAL_STOCK', 'PHYSICAL STOCK')}
          </div>

          {/* SECTION 2: MASTERS (Collapsible Accordion - Closed by default) */}
          {hasAnyMasters && (
            <div className="nav-section">
              <button
                type="button"
                className="pill-header-lime"
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  border: '1px solid var(--color-lime-border)',
                  background: 'var(--color-lime)'
                }}
                onClick={() => setIsMastersOpen(prev => !prev)}
                title="Click to expand/collapse Masters"
              >
                <span>MASTERS</span>
                <ChevronDown
                  size={18}
                  style={{
                    transform: isMastersOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease-in-out'
                  }}
                />
              </button>
              {isMastersOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  {canPartyMaster && navItem('PARTY', 'PARTY')}
                  {canItemMaster && navItem('ITEM', 'ITEM')}
                  {canSupplierMaster && navItem('SUPPLIER', 'SUPPLIER')}
                  {canOpeningStock && navItem('OPENING_STOCK', 'OPENING STOCK')}
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: REPORT (Collapsible Accordion - Closed by default) */}
          {hasAnyReports && (
            <div className="nav-section">
              <button
                type="button"
                className="pill-header-lime"
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  border: '1px solid var(--color-lime-border)',
                  background: 'var(--color-lime)'
                }}
                onClick={() => setIsReportsOpen(prev => !prev)}
                title="Click to expand/collapse Reports"
              >
                <span>REPORT</span>
                <ChevronDown
                  size={18}
                  style={{
                    transform: isReportsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease-in-out'
                  }}
                />
              </button>
              {isReportsOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  {canReportSales && navItem('REPORT_SALES', 'SALES')}
                  {canReportPurchases && navItem('REPORT_PURCHASES', 'PURCHASES')}
                  {canReportSelfUse && navItem('REPORT_SELF_USE', 'SELF USE')}
                  {canReportItemStock && navItem('REPORT_ITEM_STOCK', 'ITEM STOCK', lowStockItems.length > 0 ? lowStockItems.length : undefined)}
                  {canReportPartyLedger && navItem('REPORT_PARTY_LEDGER', 'PARTY LEDGER')}
                  {canReportSupplierLedger && navItem('REPORT_SUPPLIER_LEDGER', 'SUPPLIER LEDGER')}
                  {canReportItemLedger && navItem('REPORT_ITEM_LEDGER', 'ITEM LEDGER')}
                  {canReportPhysicalStock && navItem('REPORT_PHYSICAL_STOCK', 'STOCK REPORT')}
                </div>
              )}
            </div>
          )}

          {/* SECTION 4: SETTING (Collapsible Accordion - Closed by default) */}
          <div className="nav-section">
            <button
              type="button"
              className="pill-header-lime"
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                border: '1px solid var(--color-lime-border)',
                background: 'var(--color-lime)'
              }}
              onClick={() => setIsSettingsOpen(prev => !prev)}
              title="Click to expand/collapse Settings"
            >
              <span>SETTING</span>
              <ChevronDown
                size={18}
                style={{
                  transform: isSettingsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease-in-out'
                }}
              />
            </button>
            {isSettingsOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                {isAdmin && navItem('ADMIN', 'ADMIN')}
                {navItem('USER', 'USER')}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 5: USER PROFILE & LOGOUT (Sticky at the bottom of hamburger/sidebar) */}
        <div className="sidebar-user-footer">
          <div className="sidebar-user-card" onClick={() => { setActiveTab('USER'); closeMobileMenu(); }} title="View User Profile & Permissions">
            <div className="sidebar-user-avatar">
              {isAdmin ? <ShieldCheck size={20} color="#166534" /> : <UserCheck size={20} color="#6B46C1" />}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{currentUser.name}</div>
              <div className="sidebar-user-meta">
                <span className={`sidebar-role-badge ${isAdmin ? 'role-admin' : 'role-operator'}`}>
                  {currentUser.role}
                </span>
                <span className="sidebar-user-perm-count">
                  {isAdmin ? 'All Access' : `${currentUser.permissions?.length || 0} Perms`}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={() => setShowLogoutConfirm(true)}
            title="Log out of the system"
          >
            <LogOut size={16} />
            <span>LOG OUT</span>
          </button>
        </div>
      </aside>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleConfirmLogout}
        title="Sign Out Confirmation"
        message={`Are you sure you want to log out, ${currentUser.name}?`}
        confirmText="Yes, Sign Out"
        cancelText="Cancel"
        isDestructive={true}
      />
    </>
  );
};
