import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Permission } from '../types';
import { db } from '../db/db';

interface AuthContextType {
  currentUser: User;
  users: User[];
  switchUser: (userId: string) => void;
  hasPermission: (perm: Permission) => boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => db.getUsers());
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const savedUsers = db.getUsers();
    return savedUsers[0] || {
      id: 'default-admin',
      name: 'Administrator',
      username: 'admin',
      role: 'ADMIN',
      permissions: [
        'VIEW_DASHBOARD',
        'MANAGE_ORDERS',
        'CREATE_SALE',
        'EDIT_SALE',
        'DELETE_SALE',
        'CREATE_PURCHASE',
        'EDIT_PURCHASE',
        'DELETE_PURCHASE',
        'CREATE_SELF_USE',
        'EDIT_SELF_USE',
        'DELETE_SELF_USE',
        'VIEW_REPORTS',
        'MANAGE_MASTERS',
        'ADJUST_STOCK',
        'MANAGE_USERS',
        'MANAGE_SETTINGS'
      ],
      isActive: true,
      createdAt: '2026-08-01'
    };
  });

  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      const updatedUsers = db.getUsers();
      setUsers(updatedUsers);
      const updatedCurrent = updatedUsers.find(u => u.id === currentUser.id);
      if (updatedCurrent) {
        setCurrentUser(updatedCurrent);
      } else if (updatedUsers.length > 0) {
        setCurrentUser(updatedUsers[0]);
      }
    });
    return unsubscribe;
  }, [currentUser.id]);

  const switchUser = (userId: string) => {
    const target = users.find(u => u.id === userId);
    if (target) {
      setCurrentUser(target);
    }
  };

  const hasPermission = (perm: Permission): boolean => {
    if (currentUser.role === 'ADMIN') return true;
    return currentUser.permissions.includes(perm);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        switchUser,
        hasPermission,
        isAdmin: currentUser.role === 'ADMIN'
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
