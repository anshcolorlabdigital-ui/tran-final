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
  quickModal: QuickModalState;
  openQuickModal: (type: 'PARTY' | 'ITEM' | 'SUPPLIER', onSuccess?: (id: string, name: string) => void) => void;
  closeQuickModal: () => void;
  refreshKey: number;
  triggerRefresh: () => void;
  pendingPurchasePrefill: any | null;
  setPendingPurchasePrefill: (data: any | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('DASHBOARD');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [settings, setSettings] = useState<CompanySettings>(() => db.getSettings());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [pendingPurchasePrefill, setPendingPurchasePrefill] = useState<any | null>(null);
  const [quickModal, setQuickModal] = useState<QuickModalState>({
    isOpen: false,
    type: null
  });

  const triggerRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
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
        quickModal,
        openQuickModal,
        closeQuickModal,
        refreshKey,
        triggerRefresh,
        pendingPurchasePrefill,
        setPendingPurchasePrefill
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
