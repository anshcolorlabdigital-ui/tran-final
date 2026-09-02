import React from 'react';
import { useApp } from './context/AppContext';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { OrdersView } from './components/orders/OrdersView';
import { SalesEntryView } from './components/sales/SalesEntryView';
import { PurchaseEntryView } from './components/purchase/PurchaseEntryView';
import { SelfUseView } from './components/selfuse/SelfUseView';
import { PartyMasterView } from './components/masters/PartyMasterView';
import { ItemMasterView } from './components/masters/ItemMasterView';
import { SupplierMasterView } from './components/masters/SupplierMasterView';
import { OpeningStockView } from './components/masters/OpeningStockView';
import { SalesReportView } from './components/reports/SalesReportView';
import { PurchaseReportView } from './components/reports/PurchaseReportView';
import { SelfUseReportView } from './components/reports/SelfUseReportView';
import { ItemStockReportView } from './components/reports/ItemStockReportView';
import { AdminSettingsView } from './components/settings/AdminSettingsView';
import { UserPermissionsView } from './components/settings/UserPermissionsView';
import { QuickPartyModal } from './components/common/QuickPartyModal';
import { QuickItemModal } from './components/common/QuickItemModal';
import { QuickSupplierModal } from './components/common/QuickSupplierModal';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const App: React.FC = () => {
  const { activeTab, toasts, removeToast } = useApp();

  const renderActiveView = () => {
    switch (activeTab) {
      case 'DASHBOARD':
        return <DashboardView />;
      case 'ORDER':
        return <OrdersView />;
      case 'PURCHASE':
        return <PurchaseEntryView />;
      case 'SALE':
        return <SalesEntryView />;
      case 'SELF_USE':
        return <SelfUseView />;
      case 'PARTY':
        return <PartyMasterView />;
      case 'ITEM':
        return <ItemMasterView />;
      case 'SUPPLIER':
        return <SupplierMasterView />;
      case 'OPENING_STOCK':
        return <OpeningStockView />;
      case 'REPORT_SALES':
        return <SalesReportView />;
      case 'REPORT_PURCHASES':
        return <PurchaseReportView />;
      case 'REPORT_SELF_USE':
        return <SelfUseReportView />;
      case 'REPORT_ITEM_STOCK':
        return <ItemStockReportView />;
      case 'ADMIN':
        return <AdminSettingsView />;
      case 'USER':
        return <UserPermissionsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="app-layout">
      {/* Top Header */}
      <Header />

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
