import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ActiveNavTab, CompanySettings } from '../types';
import { db } from '../db/db';
import { getTodayDateString } from '../utils/dateUtils';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface QuickModalState {
  isOpen: boolean;
  type: 'PARTY' | 'ITEM' | 'SUPPLIER' | null;
  onSuccess?: (id: string, name: string) => void;
}

interface AlertModalState {
  isOpen: boolean;
  message: string;
  title?: string;
  type: 'warning' | 'error' | 'info' | 'success';
}

interface AppContextType {
  activeTab: ActiveNavTab;
  setActiveTab: (tab: ActiveNavTab) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  settings: CompanySettings;
  updateSettings: (newSettings: CompanySettings) => void;
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
  alertModal: AlertModalState;
  showAlert: (message: string, title?: string, type?: 'warning' | 'error' | 'info' | 'success') => void;
  closeAlert: () => void;
  quickModal: QuickModalState;
  openQuickModal: (type: 'PARTY' | 'ITEM' | 'SUPPLIER', onSuccess?: (id: string, name: string) => void) => void;
  closeQuickModal: () => void;
  refreshKey: number;
  triggerRefresh: () => void;
  pendingPurchasePrefill: any | null;
  setPendingPurchasePrefill: (data: any | null) => void;
  selectedLedgerPartyId: string | null;
  setSelectedLedgerPartyId: (partyId: string | null) => void;
  openPartyLedger: (partyId: string) => void;
  selectedLedgerSupplierId: string | null;
  setSelectedLedgerSupplierId: (supplierId: string | null) => void;
  openSupplierLedger: (supplierId: string) => void;
  selectedLedgerItemId: string | null;
  setSelectedLedgerItemId: (itemId: string | null) => void;
  openItemLedger: (itemId: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('DASHBOARD');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [settings, setSettings] = useState<CompanySettings>(() => db.getSettings());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [pendingPurchasePrefill, setPendingPurchasePrefill] = useState<any | null>(null);
  const [selectedLedgerPartyId, setSelectedLedgerPartyId] = useState<string | null>(null);
  const [selectedLedgerSupplierId, setSelectedLedgerSupplierId] = useState<string | null>(null);
  const [selectedLedgerItemId, setSelectedLedgerItemId] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState<AlertModalState>({
    isOpen: false,
    message: '',
    title: undefined,
    type: 'warning'
  });
  const [quickModal, setQuickModal] = useState<QuickModalState>({
    isOpen: false,
    type: null
  });

  const triggerRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const openPartyLedger = useCallback((partyId: string) => {
    setSelectedLedgerPartyId(partyId);
    setActiveTab('REPORT_PARTY_LEDGER');
  }, []);

  const openSupplierLedger = useCallback((supplierId: string) => {
    setSelectedLedgerSupplierId(supplierId);
    setActiveTab('REPORT_SUPPLIER_LEDGER');
  }, []);

  const openItemLedger = useCallback((itemId: string) => {
    setSelectedLedgerItemId(itemId);
    setActiveTab('REPORT_ITEM_LEDGER');
  }, []);

  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      setSettings(db.getSettings());
      setRefreshKey(prev => prev + 1);
    });
    return unsubscribe;
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const updateSettings = useCallback((newSettings: CompanySettings) => {
    db.saveSettings(newSettings);
    setSettings(newSettings);
    showToast('Company settings updated successfully!', 'success');
  }, [showToast]);

  const showAlert = useCallback((message: string, title?: string, type: 'warning' | 'error' | 'info' | 'success' = 'warning') => {
    setAlertModal({
      isOpen: true,
      message,
      title,
      type
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  const openQuickModal = useCallback((type: 'PARTY' | 'ITEM' | 'SUPPLIER', onSuccess?: (id: string, name: string) => void) => {
    setQuickModal({ isOpen: true, type, onSuccess });
  }, []);

  const closeQuickModal = useCallback(() => {
    setQuickModal({ isOpen: false, type: null });
  }, []);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        selectedDate,
        setSelectedDate,
        settings,
        updateSettings,
        toasts,
        showToast,
        removeToast,
        alertModal,
        showAlert,
        closeAlert,
        quickModal,
        openQuickModal,
        closeQuickModal,
        refreshKey,
        triggerRefresh,
        pendingPurchasePrefill,
        setPendingPurchasePrefill,
        selectedLedgerPartyId,
        setSelectedLedgerPartyId,
        openPartyLedger,
        selectedLedgerSupplierId,
        setSelectedLedgerSupplierId,
        openSupplierLedger,
        selectedLedgerItemId,
        setSelectedLedgerItemId,
        openItemLedger
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
