import React, { useMemo } from 'react';
import { useApp } from './context/AppContext';
import { useAuth } from './context/AuthContext';
import { db } from './db/db';
import { LoginView } from './components/auth/LoginView';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { OrdersView } from './components/orders/OrdersView';
import { OrderedView } from './components/orders/OrderedView';
import { SalesEntryView } from './components/sales/SalesEntryView';
import { PurchaseEntryView } from './components/purchase/PurchaseEntryView';
import { SelfUseView } from './components/selfuse/SelfUseView';
import { PaymentCollectionView } from './components/payments/PaymentCollectionView';
import { SupplierPaymentView } from './components/payments/SupplierPaymentView';
import { PartyMasterView } from './components/masters/PartyMasterView';
import { ItemMasterView } from './components/masters/ItemMasterView';
import { SupplierMasterView } from './components/masters/SupplierMasterView';
import { OpeningStockView } from './components/masters/OpeningStockView';
import { SalesReportView } from './components/reports/SalesReportView';
import { PurchaseReportView } from './components/reports/PurchaseReportView';
import { SelfUseReportView } from './components/reports/SelfUseReportView';
import { ItemStockReportView } from './components/reports/ItemStockReportView';
import { PartyLedgerReportView } from './components/reports/PartyLedgerReportView';
import { SupplierLedgerReportView } from './components/reports/SupplierLedgerReportView';
import { ItemLedgerReportView } from './components/reports/ItemLedgerReportView';
import { PhysicalStockView } from './components/physicalstock/PhysicalStockView';
import { PhysicalStockReportView } from './components/reports/PhysicalStockReportView';
import { AdminSettingsView } from './components/settings/AdminSettingsView';
import { UserPermissionsView } from './components/settings/UserPermissionsView';
import { QuickPartyModal } from './components/common/QuickPartyModal';
import { QuickItemModal } from './components/common/QuickItemModal';
import { QuickSupplierModal } from './components/common/QuickSupplierModal';
import { AlertDialog } from './components/common/AlertDialog';
import { CheckCircle2, AlertCircle, Info, X, ShieldAlert, Wrench } from 'lucide-react';

export const App: React.FC = () => {
  const { activeTab, setActiveTab, toasts, removeToast, alertModal, closeAlert, refreshKey } = useApp();
  const { currentUser, isAuthenticated, hasPermission, isAdmin } = useAuth();
  const maintenanceMode = useMemo(() => db.getMaintenanceMode(), [refreshKey]);

  const renderRestrictedAccess = () => (
    <div className="content-panel-grey" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '360px', textAlign: 'center', gap: '16px' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ShieldAlert size={36} color="#DC2626" />
      </div>
      <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 900, color: '#111827' }}>
        Access Restricted
      </h2>
      <p style={{ color: '#4B5563', maxWidth: '420px', fontSize: '0.9rem', lineHeight: 1.5 }}>
        Your user account (<strong>{currentUser?.name}</strong>) does not have permission to view this section. Please contact your system Administrator to request access.
      </p>
    </div>
  );

  const renderActiveView = () => {
    switch (activeTab) {
      case 'DASHBOARD':
        return hasPermission('VIEW_DASHBOARD') ? <DashboardView /> : renderRestrictedAccess();
      case 'ORDER':
        return (hasPermission('VIEW_ORDERS') || hasPermission('MANAGE_ORDERS')) ? <OrdersView /> : renderRestrictedAccess();
      case 'ORDERED':
        return (hasPermission('VIEW_ORDERED') || hasPermission('RECEIVE_ORDER')) ? <OrderedView /> : renderRestrictedAccess();
      case 'PURCHASE':
        return (hasPermission('VIEW_PURCHASES') || hasPermission('CREATE_PURCHASE')) ? <PurchaseEntryView /> : renderRestrictedAccess();
      case 'SALE':
        return (hasPermission('VIEW_SALES') || hasPermission('CREATE_SALE')) ? <SalesEntryView /> : renderRestrictedAccess();
      case 'SELF_USE':
        return (hasPermission('VIEW_SELF_USE') || hasPermission('CREATE_SELF_USE')) ? <SelfUseView /> : renderRestrictedAccess();
      case 'COLLECT_PAYMENT':
        return hasPermission('COLLECT_PAYMENT') ? <PaymentCollectionView /> : renderRestrictedAccess();
      case 'PAY_SUPPLIER':
        return hasPermission('PAY_SUPPLIER') ? <SupplierPaymentView /> : renderRestrictedAccess();
      case 'PHYSICAL_STOCK':
        return (hasPermission('VIEW_PHYSICAL_STOCK') || hasPermission('MANAGE_PHYSICAL_STOCK') || isAdmin) ? <PhysicalStockView /> : renderRestrictedAccess();
      case 'PARTY':
        return (hasPermission('MANAGE_PARTY_MASTER') || hasPermission('VIEW_MASTERS') || hasPermission('MANAGE_MASTERS')) ? <PartyMasterView /> : renderRestrictedAccess();
      case 'ITEM':
        return (hasPermission('MANAGE_ITEM_MASTER') || hasPermission('VIEW_MASTERS') || hasPermission('MANAGE_MASTERS')) ? <ItemMasterView /> : renderRestrictedAccess();
      case 'SUPPLIER':
        return (hasPermission('MANAGE_SUPPLIER_MASTER') || hasPermission('VIEW_MASTERS') || hasPermission('MANAGE_MASTERS')) ? <SupplierMasterView /> : renderRestrictedAccess();
      case 'OPENING_STOCK':
        return (hasPermission('MANAGE_OPENING_STOCK') || hasPermission('VIEW_MASTERS') || hasPermission('ADJUST_STOCK') || hasPermission('MANAGE_MASTERS')) ? <OpeningStockView /> : renderRestrictedAccess();
      case 'REPORT_SALES':
        return (hasPermission('VIEW_SALES_REPORT') || hasPermission('VIEW_REPORTS')) ? <SalesReportView /> : renderRestrictedAccess();
      case 'REPORT_PURCHASES':
        return (hasPermission('VIEW_PURCHASE_REPORT') || hasPermission('VIEW_REPORTS')) ? <PurchaseReportView /> : renderRestrictedAccess();
      case 'REPORT_SELF_USE':
        return (hasPermission('VIEW_SELF_USE_REPORT') || hasPermission('VIEW_REPORTS')) ? <SelfUseReportView /> : renderRestrictedAccess();
      case 'REPORT_ITEM_STOCK':
        return (hasPermission('VIEW_ITEM_STOCK_REPORT') || hasPermission('VIEW_REPORTS')) ? <ItemStockReportView /> : renderRestrictedAccess();
      case 'REPORT_PARTY_LEDGER':
        return (hasPermission('VIEW_PARTY_LEDGER_REPORT') || hasPermission('VIEW_REPORTS')) ? <PartyLedgerReportView /> : renderRestrictedAccess();
      case 'REPORT_SUPPLIER_LEDGER':
        return (hasPermission('VIEW_SUPPLIER_LEDGER_REPORT') || hasPermission('VIEW_REPORTS')) ? <SupplierLedgerReportView /> : renderRestrictedAccess();
      case 'REPORT_ITEM_LEDGER':
        return (hasPermission('VIEW_ITEM_LEDGER_REPORT') || hasPermission('VIEW_REPORTS')) ? <ItemLedgerReportView /> : renderRestrictedAccess();
      case 'REPORT_PHYSICAL_STOCK':
        return (hasPermission('VIEW_PHYSICAL_STOCK_REPORT') || hasPermission('VIEW_REPORTS') || isAdmin) ? <PhysicalStockReportView /> : renderRestrictedAccess();
      case 'ADMIN':
        return isAdmin ? <AdminSettingsView /> : renderRestrictedAccess();
      case 'USER':
        return <UserPermissionsView />;
      default:
        return <DashboardView />;
    }
  };

  // If not logged in, render the Sign In View
  if (!isAuthenticated || !currentUser) {
    return (
      <>
        <LoginView />

        {/* Global Toast Notifications on Login */}
        <div className="toast-container no-print">
          {toasts.map(toast => (
            <div key={toast.id} className={`toast-item ${toast.type}`}>
              {toast.type === 'success' && <CheckCircle2 size={18} />}
              {toast.type === 'error' && <AlertCircle size={18} />}
              {toast.type === 'warning' && <AlertCircle size={18} />}
              {toast.type === 'info' && <Info size={18} />}
              <span>{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: '8px' }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="app-layout">
      {/* Top Header */}
      <Header />

      {/* Global Maintenance Mode Active Banner */}
      {maintenanceMode.enabled && (
        <div style={{
          background: 'linear-gradient(90deg, #F59E0B 0%, #EA580C 100%)',
          color: '#FFFFFF',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '2px solid #C2410C',
          boxShadow: '0 2px 8px rgba(234, 88, 12, 0.3)',
          zIndex: 50
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              background: '#FFFFFF',
              color: '#EA580C',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '0.9rem',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              ⚠️
            </span>
            <div style={{ fontSize: '0.88rem' }}>
              <strong style={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Maintenance Mode Active:
              </strong>{' '}
              A complete database snapshot was duplicated to Firebase Cloud ({maintenanceMode.snapshotSummary?.totalRecords ?? 'all'} records). You can safely test, delete, and clear records. All changes will be reverted when turned OFF.
            </div>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('ADMIN')}
              style={{
                background: '#FFFFFF',
                color: '#9A3412',
                border: '1.5px solid #000000',
                borderRadius: '6px',
                padding: '6px 14px',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
              }}
            >
              <Wrench size={14} />
              Manage in Admin Settings
            </button>
          )}
        </div>
      )}

      {/* Main Content Body */}
      <main className="app-body-container">
        <Sidebar />
        <section className="app-content-area">
          {renderActiveView()}
        </section>
      </main>

      {/* Quick Modals */}
      <QuickPartyModal />
      <QuickItemModal />
      <QuickSupplierModal />

      {/* Global Classic Alert Dialog */}
      <AlertDialog
        isOpen={alertModal.isOpen}
        onClose={closeAlert}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

      {/* Global Toast Notifications */}
      <div className="toast-container no-print">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast-item ${toast.type}`}>
            {toast.type === 'success' && <CheckCircle2 size={18} />}
            {toast.type === 'error' && <AlertCircle size={18} />}
            {toast.type === 'warning' && <AlertCircle size={18} />}
            {toast.type === 'info' && <Info size={18} />}
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: '8px' }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
export default App;
