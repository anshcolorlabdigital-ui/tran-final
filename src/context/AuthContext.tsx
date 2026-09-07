import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Permission } from '../types';
import { db } from '../db/db';

const SESSION_STORAGE_KEY = 'rmms_session_user_id';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  users: User[];
  login: (identifier: string, password: string) => { success: boolean; message?: string };
  logout: () => void;
  switchUser: (userId: string) => void;
  hasPermission: (perm: Permission) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => db.getUsers());
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const savedUsers = db.getUsers();
    const savedSessionId = typeof window !== 'undefined' ? localStorage.getItem(SESSION_STORAGE_KEY) : null;
    if (savedSessionId) {
      const matched = savedUsers.find(u => u.id === savedSessionId && u.isActive !== false);
      if (matched) return matched;
    }
    // Default to admin for initial state if needed or start at login screen
    return null;
  });

  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      const updatedUsers = db.getUsers();
      setUsers(updatedUsers);
      if (currentUser) {
        const updatedCurrent = updatedUsers.find(u => u.id === currentUser.id);
        if (updatedCurrent) {
          if (updatedCurrent.isActive === false) {
            // User got deactivated while logged in
            logout();
          } else {
            setCurrentUser(updatedCurrent);
          }
        }
      }
    });
    return unsubscribe;
  }, [currentUser?.id]);

  const login = (identifier: string, password: string): { success: boolean; message?: string } => {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanId) {
      return { success: false, message: 'Please enter your email or username.' };
    }
    if (!cleanPass) {
      return { success: false, message: 'Please enter your password.' };
    }

    const allUsers = db.getUsers();
    const foundUser = allUsers.find(u => {
      const matchUsername = u.username && u.username.trim().toLowerCase() === cleanId;
      const matchEmail = u.email && u.email.trim().toLowerCase() === cleanId;
      return matchUsername || matchEmail;
    });

    if (!foundUser) {
      return { success: false, message: 'No account found matching this email or username.' };
    }

    if (foundUser.isActive === false) {
      return { success: false, message: 'This account has been deactivated. Please contact your administrator.' };
    }

    const expectedPass = (foundUser.password || foundUser.pin || (foundUser.role === 'ADMIN' ? 'admin' : '')).trim();
    if (cleanPass !== expectedPass) {
      return { success: false, message: 'Incorrect password. Please try again.' };
    }

    // Success
    setCurrentUser(foundUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, foundUser.id);
    }
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  };

  const switchUser = (userId: string) => {
    const target = users.find(u => u.id === userId && u.isActive !== false);
    if (target) {
      setCurrentUser(target);
      if (typeof window !== 'undefined') {
        localStorage.setItem(SESSION_STORAGE_KEY, target.id);
      }
    }
  };

  const hasPermission = (perm: Permission): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN') return true;
    
    const perms = currentUser.permissions || [];
    if (perms.includes(perm)) return true;

    // Smart fallbacks for composite permissions
    if (perm === 'VIEW_ORDERS' && perms.includes('MANAGE_ORDERS')) return true;
    if (perm === 'VIEW_ORDERED' && perms.includes('MANAGE_ORDERS')) return true;
    if (perm === 'VIEW_PURCHASES' && perms.includes('CREATE_PURCHASE')) return true;
    if (perm === 'VIEW_SALES' && perms.includes('CREATE_SALE')) return true;
    if (perm === 'VIEW_SELF_USE' && perms.includes('CREATE_SELF_USE')) return true;
    if (perm === 'VIEW_MASTERS' && perms.includes('MANAGE_MASTERS')) return true;
    if (perm === 'MANAGE_PARTY_MASTER' && perms.includes('MANAGE_MASTERS')) return true;
    if (perm === 'MANAGE_ITEM_MASTER' && perms.includes('MANAGE_MASTERS')) return true;
    if (perm === 'MANAGE_SUPPLIER_MASTER' && perms.includes('MANAGE_MASTERS')) return true;
    if (perm === 'MANAGE_OPENING_STOCK' && (perms.includes('MANAGE_MASTERS') || perms.includes('ADJUST_STOCK'))) return true;

    // Report fallbacks
    if (
      (perm === 'VIEW_SALES_REPORT' ||
       perm === 'VIEW_PURCHASE_REPORT' ||
       perm === 'VIEW_SELF_USE_REPORT' ||
       perm === 'VIEW_ITEM_STOCK_REPORT' ||
       perm === 'VIEW_PARTY_LEDGER_REPORT' ||
       perm === 'VIEW_SUPPLIER_LEDGER_REPORT' ||
       perm === 'VIEW_ITEM_LEDGER_REPORT') &&
      perms.includes('VIEW_REPORTS')
    ) {
      return true;
    }

    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        users,
        login,
        logout,
        switchUser,
        hasPermission,
        isAdmin: currentUser?.role === 'ADMIN'
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
