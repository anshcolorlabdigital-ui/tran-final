import React, { useState } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { User, Permission, UserRole } from '../../types';
import { Plus, Edit, Trash2, Shield, KeyRound, Check, Eye, EyeOff, ShieldCheck, UserCheck, Lock, Sparkles, AlertCircle } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface PermissionItem {
  id: Permission;
  label: string;
}

interface PermissionGroup {
  groupName: string;
  permissions: PermissionItem[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    groupName: 'Dashboard',
    permissions: [
      { id: 'VIEW_DASHBOARD', label: 'View Dashboard & Stock Status' }
    ]
  },
  {
    groupName: 'Orders & Placed Orders',
    permissions: [
      { id: 'VIEW_ORDERS', label: 'View Reorder Suggestions' },
      { id: 'MANAGE_ORDERS', label: 'Create & Place Orders to Suppliers' },
      { id: 'VIEW_ORDERED', label: 'View Placed Orders (ORDERED Section)' },
      { id: 'RECEIVE_ORDER', label: 'Receive Stock from Placed Orders' }
    ]
  },
  {
    groupName: 'Purchase (Inward)',
    permissions: [
      { id: 'VIEW_PURCHASES', label: 'View Purchase History' },
      { id: 'CREATE_PURCHASE', label: 'Create Inward Purchase Bills' },
      { id: 'EDIT_PURCHASE', label: 'Edit Existing Purchase Bills' },
      { id: 'DELETE_PURCHASE', label: 'Delete Purchase Bills (Reverses Stock)' }
    ]
  },
  {
    groupName: 'Sales & Invoicing',
    permissions: [
      { id: 'VIEW_SALES', label: 'View Sales History' },
      { id: 'CREATE_SALE', label: 'Create Sales Invoices' },
      { id: 'EDIT_SALE', label: 'Edit Sales Invoices' },
      { id: 'DELETE_SALE', label: 'Delete Sales Invoices (Reverses Stock)' }
    ]
  },
  {
    groupName: 'Self Use & Consumption',
    permissions: [
      { id: 'VIEW_SELF_USE', label: 'View Self-Use Consumption Records' },
      { id: 'CREATE_SELF_USE', label: 'Record Self-Use Consumption' },
      { id: 'EDIT_SELF_USE', label: 'Edit Self-Use Records' },
      { id: 'DELETE_SELF_USE', label: 'Delete Self-Use Records' }
    ]
  },
  {
    groupName: 'Payments & Ledgers',
    permissions: [
      { id: 'COLLECT_PAYMENT', label: 'Collect Customer Payments (Party Ledger)' },
      { id: 'PAY_SUPPLIER', label: 'Pay Suppliers (Supplier Ledger)' }
    ]
  },
  {
    groupName: 'Master Records',
    permissions: [
      { id: 'VIEW_MASTERS', label: 'View Master Data' },
      { id: 'MANAGE_PARTY_MASTER', label: 'Manage Customer / Party Master' },
      { id: 'MANAGE_ITEM_MASTER', label: 'Manage Item Master & Pricing' },
      { id: 'MANAGE_SUPPLIER_MASTER', label: 'Manage Supplier Master' },
      { id: 'MANAGE_OPENING_STOCK', label: 'Manage Opening Stock & Adjustments' }
    ]
  },
  {
    groupName: 'Reports & Analytics',
    permissions: [
      { id: 'VIEW_REPORTS', label: 'Access Reports Section' },
      { id: 'VIEW_SALES_REPORT', label: 'View Sales Report & Export' },
      { id: 'VIEW_PURCHASE_REPORT', label: 'View Purchase Report & Export' },
      { id: 'VIEW_SELF_USE_REPORT', label: 'View Self-Use Report & Export' },
      { id: 'VIEW_ITEM_STOCK_REPORT', label: 'View Item Stock & Low Stock Report' },
      { id: 'VIEW_PARTY_LEDGER_REPORT', label: 'View Customer Ledger Statements' },
      { id: 'VIEW_SUPPLIER_LEDGER_REPORT', label: 'View Supplier Ledger Statements' },
      { id: 'VIEW_ITEM_LEDGER_REPORT', label: 'View Item Movement Ledger' }
    ]
  },
  {
    groupName: 'Physical Stock Audit',
    permissions: [
      { id: 'VIEW_PHYSICAL_STOCK', label: 'View Physical Stock Entry Screen' },
      { id: 'MANAGE_PHYSICAL_STOCK', label: 'Create & Save Physical Stock Audits' },
      { id: 'VIEW_PHYSICAL_STOCK_REPORT', label: 'View Physical Stock Variance Report & Export' }
    ]
  },
  {
    groupName: 'System Administration',
    permissions: [
      { id: 'ADJUST_STOCK', label: 'Perform Stock Audits & Overrides' },
      { id: 'MANAGE_USERS', label: 'Manage Users, Passwords & Permissions' },
      { id: 'MANAGE_SETTINGS', label: 'Manage Company Profile & Cloud Sync' }
    ]
  }
];

const ALL_PERMISSION_IDS: Permission[] = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.id));

export const UserPermissionsView: React.FC = () => {
  const { showToast } = useApp();
  const { users, currentUser, isAdmin } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('OPERATOR');
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const [isActive, setIsActive] = useState(true);

  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: '',
    name: ''
  });

  const handleStartNew = () => {
    setIsEditing(true);
    setEditingId(null);
    setName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setRole('OPERATOR');
    setSelectedPermissions([
      'VIEW_DASHBOARD',
      'VIEW_ORDERS',
      'MANAGE_ORDERS',
      'VIEW_ORDERED',
      'VIEW_PURCHASES',
      'CREATE_PURCHASE',
      'VIEW_SALES',
      'CREATE_SALE',
      'VIEW_SELF_USE',
      'CREATE_SELF_USE',
      'COLLECT_PAYMENT',
      'PAY_SUPPLIER',
      'VIEW_MASTERS',
      'VIEW_REPORTS',
      'VIEW_SALES_REPORT',
      'VIEW_PURCHASE_REPORT',
      'VIEW_SELF_USE_REPORT',
      'VIEW_ITEM_STOCK_REPORT'
    ]);
    setIsActive(true);
  };

  const handleEdit = (user: User) => {
    setIsEditing(true);
    setEditingId(user.id);
    setName(user.name);
    setUsername(user.username);
    setEmail(user.email || '');
    setPassword(user.password || user.pin || '');
    setShowPassword(false);
    setRole(user.role);
    setSelectedPermissions(user.permissions || []);
    setIsActive(user.isActive !== false);
  };

  const togglePermission = (perm: Permission) => {
    setSelectedPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const selectAllInGroup = (group: PermissionGroup) => {
    const groupPermIds = group.permissions.map(p => p.id);
    setSelectedPermissions(prev => Array.from(new Set([...prev, ...groupPermIds])));
  };

  const clearAllInGroup = (group: PermissionGroup) => {
    const groupPermIds = group.permissions.map(p => p.id);
    setSelectedPermissions(prev => prev.filter(p => !groupPermIds.includes(p)));
  };

  const applyPreset = (preset: 'ALL' | 'CASHIER' | 'STORE' | 'REPORTS' | 'CLEAR') => {
    switch (preset) {
      case 'ALL':
        setSelectedPermissions([...ALL_PERMISSION_IDS]);
        break;
      case 'CASHIER':
        setSelectedPermissions([
          'VIEW_DASHBOARD',
          'VIEW_SALES',
          'CREATE_SALE',
          'EDIT_SALE',
          'COLLECT_PAYMENT',
          'VIEW_MASTERS',
          'VIEW_REPORTS',
          'VIEW_SALES_REPORT',
          'VIEW_PARTY_LEDGER_REPORT'
        ]);
        break;
      case 'STORE':
        setSelectedPermissions([
          'VIEW_DASHBOARD',
          'VIEW_ORDERS',
          'MANAGE_ORDERS',
          'VIEW_ORDERED',
          'RECEIVE_ORDER',
          'VIEW_PURCHASES',
          'CREATE_PURCHASE',
          'EDIT_PURCHASE',
          'VIEW_SELF_USE',
          'CREATE_SELF_USE',
          'VIEW_MASTERS',
          'MANAGE_ITEM_MASTER',
          'MANAGE_OPENING_STOCK',
          'VIEW_REPORTS',
          'VIEW_ITEM_STOCK_REPORT',
          'VIEW_ITEM_LEDGER_REPORT'
        ]);
        break;
      case 'REPORTS':
        setSelectedPermissions([
          'VIEW_DASHBOARD',
          'VIEW_REPORTS',
          'VIEW_SALES_REPORT',
          'VIEW_PURCHASE_REPORT',
          'VIEW_SELF_USE_REPORT',
          'VIEW_ITEM_STOCK_REPORT',
          'VIEW_PARTY_LEDGER_REPORT',
          'VIEW_SUPPLIER_LEDGER_REPORT',
          'VIEW_ITEM_LEDGER_REPORT'
        ]);
        break;
      case 'CLEAR':
        setSelectedPermissions([]);
        break;
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) {
      showToast('Name and Username are required.', 'error');
      return;
    }

    if (!password.trim()) {
      showToast('Please assign a password to this account.', 'error');
      return;
    }

    // Check for duplicate username
    const existing = users.find(
      u => u.username.toLowerCase() === username.trim().toLowerCase() && u.id !== editingId
    );
    if (existing) {
      showToast(`Username "${username.trim()}" is already in use by ${existing.name}.`, 'error');
      return;
    }

    const userRecord: User = {
      id: editingId || `user-${Date.now()}`,
      name: name.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim() || `${username.trim().toLowerCase()}@ansh.com`,
      password: password.trim(),
      role,
      permissions: role === 'ADMIN' ? ALL_PERMISSION_IDS : selectedPermissions,
      isActive,
      createdAt: editingId ? (users.find(u => u.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString()
    };

    db.saveUser(userRecord);
    showToast(`User account "${userRecord.name}" saved successfully!`, 'success');
    setIsEditing(false);
  };

  const handleDelete = (id: string, userName: string) => {
    if (id === currentUser?.id) {
      showToast('You cannot delete your own active account.', 'error');
      return;
    }
    setDeleteDialog({ isOpen: true, id, name: userName });
  };

  const confirmDelete = () => {
    if (deleteDialog.id) {
      db.deleteUser(deleteDialog.id);
      showToast(`User "${deleteDialog.name}" removed successfully.`, 'info');
      setDeleteDialog({ isOpen: false, id: '', name: '' });
    }
  };

  // --- NON-ADMIN STAFF VIEW (READ-ONLY PROFILE) ---
  if (!isAdmin) {
    const userPermissions = currentUser?.permissions || [];
    return (
      <div className="content-panel-grey">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div className="pill-header-lime" style={{ padding: '8px 28px', fontSize: '1.2rem' }}>
            USER PROFILE & PERMISSIONS
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4B5563' }}>
            Logged in as: <strong style={{ color: '#111827' }}>{currentUser?.name}</strong>
          </span>
        </div>

        {/* Profile Card */}
        <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '14px', padding: '24px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', borderBottom: '1.5px solid #E5E7EB', paddingBottom: '16px', marginBottom: '20px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#E2D2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #000000' }}>
              <UserCheck size={28} color="#6B46C1" />
            </div>
            <div>
              <h2 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 900, color: '#111827' }}>
                {currentUser?.name}
              </h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4B5563', fontSize: '0.9rem' }}>
                  @{currentUser?.username}
                </span>
                <span className="role-badge role-operator">
                  {currentUser?.role}
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6B7280' }}>
                  {currentUser?.email}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FEF3C7', padding: '10px 14px', borderRadius: '8px', border: '1px solid #FDE68A', marginBottom: '20px' }}>
            <Lock size={18} color="#92400E" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400E' }}>
              Standard Staff Account — Your module access and actions are configured by the Administrator.
            </span>
          </div>

          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.1rem', fontWeight: 800, marginBottom: '14px', color: '#111827' }}>
            Your Assigned System Permissions ({userPermissions.length} Active)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {PERMISSION_GROUPS.map(group => {
              const groupPerms = group.permissions;
              const hasAny = groupPerms.some(p => userPermissions.includes(p.id));
              return (
                <div
                  key={group.groupName}
                  style={{
                    background: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: '10px',
                    padding: '14px',
                    opacity: hasAny ? 1 : 0.6
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', color: '#374151', marginBottom: '8px', borderBottom: '1px solid #E5E7EB', paddingBottom: '4px' }}>
                    {group.groupName}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {groupPerms.map(p => {
                      const isGranted = userPermissions.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.82rem',
                            fontWeight: isGranted ? 700 : 500,
                            color: isGranted ? '#15803D' : '#9CA3AF'
                          }}
                        >
                          {isGranted ? (
                            <Check size={14} color="#15803D" style={{ strokeWidth: 3 }} />
                          ) : (
                            <span style={{ width: '14px', textAlign: 'center', color: '#D1D5DB' }}>—</span>
                          )}
                          <span>{p.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // --- ADMIN FULL MANAGEMENT VIEW ---
  return (
    <div className="content-panel-grey">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div className="pill-header-lime" style={{ padding: '8px 28px', fontSize: '1.2rem' }}>
          USER MANAGEMENT & ROLE PERMISSIONS
        </div>

        {!isEditing && (
          <button onClick={handleStartNew} className="btn-red-action" type="button">
            <Plus size={16} />
            <span>Create New User</span>
          </button>
        )}
      </div>

      {isEditing ? (
        <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '14px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1.5px solid #E5E7EB', paddingBottom: '12px' }}>
            <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 900, fontSize: '1.3rem' }}>
              {editingId ? 'Edit User Credentials & Permissions' : 'Create New Staff / Admin Account'}
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#6B7280', fontWeight: 600 }}>
              * Marked fields are required
            </span>
          </div>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* User Credentials Grid */}
            <div className="form-grid-3col">
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '5px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  className="input-text-clean"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '5px' }}>
                  Username (Login ID) *
                </label>
                <input
                  type="text"
                  className="input-text-clean"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. rahul"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '5px' }}>
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  className="input-text-clean"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. rahul@ansh.com"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '5px' }}>
                  Password *
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-text-clean"
                    style={{ paddingRight: '36px', width: '100%' }}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#6B7280',
                      padding: '4px'
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '5px' }}>
                  Assigned Role
                </label>
                <select
                  className="input-text-clean"
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                >
                  <option value="ADMIN">Administrator (Full Access to Everything)</option>
                  <option value="MANAGER">Store / Accounts Manager</option>
                  <option value="OPERATOR">Counter Operator / Cashier</option>
                  <option value="VIEWER">Read-Only Viewer</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '5px' }}>
                  Account Status
                </label>
                <select
                  className="input-text-clean"
                  value={isActive ? 'active' : 'inactive'}
                  onChange={e => setIsActive(e.target.value === 'active')}
                >
                  <option value="active">Active (Can Sign In)</option>
                  <option value="inactive">Suspended / Deactivated</option>
                </select>
              </div>
            </div>

            {/* Quick Presets Bar */}
            {role !== 'ADMIN' && (
              <div style={{ background: '#F3F4F6', padding: '10px 14px', borderRadius: '10px', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#374151' }}>
                  Quick Permission Presets:
                </span>
                <button
                  type="button"
                  onClick={() => applyPreset('CASHIER')}
                  style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '14px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Sales & Cashier
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('STORE')}
                  style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '14px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Inventory & Storekeeper
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('REPORTS')}
                  style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '14px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Reports Only
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('ALL')}
                  style={{ background: '#DCFCE7', border: '1px solid #86EFAC', color: '#166534', borderRadius: '14px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('CLEAR')}
                  style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: '14px', padding: '3px 10px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Clear All
                </button>
              </div>
            )}

            {/* Granular Permissions Matrix */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <label style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                  Granular Module Permissions ({role === 'ADMIN' ? 'All Permissions Enabled for Administrator' : `${selectedPermissions.length} Enabled`})
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
                {PERMISSION_GROUPS.map(group => {
                  return (
                    <div
                      key={group.groupName}
                      style={{
                        background: '#FAFAFA',
                        border: '1.5px solid #E5E7EB',
                        borderRadius: '10px',
                        padding: '14px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #E5E7EB', paddingBottom: '6px' }}>
                        <span style={{ fontWeight: 900, fontSize: '0.82rem', textTransform: 'uppercase', color: '#1F2937' }}>
                          {group.groupName}
                        </span>
                        {role !== 'ADMIN' && (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => selectAllInGroup(group)}
                              style={{ background: 'transparent', border: 'none', color: '#2563EB', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              All
                            </button>
                            <span style={{ color: '#D1D5DB' }}>|</span>
                            <button
                              type="button"
                              onClick={() => clearAllInGroup(group)}
                              style={{ background: 'transparent', border: 'none', color: '#DC2626', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                            >
                              None
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {group.permissions.map(p => {
                          const isChecked = role === 'ADMIN' || selectedPermissions.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                cursor: role === 'ADMIN' ? 'not-allowed' : 'pointer'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={role === 'ADMIN'}
                                onChange={() => togglePermission(p.id)}
                                style={{ width: '16px', height: '16px', accentColor: '#166534', cursor: 'pointer' }}
                              />
                              <span style={{ color: isChecked ? '#111827' : '#6B7280' }}>
                                {p.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px', borderTop: '1.5px solid #E5E7EB', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                style={{ padding: '8px 20px', borderRadius: '20px', border: '1px solid #9CA3AF', background: '#F3F4F6', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button type="submit" className="btn-lime-action">
                Save User Account
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Users List Table */
        <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <div className="table-responsive-wrapper">
            <div className="custom-table-container" style={{ minWidth: '700px' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>User Name</th>
                    <th>Username (Login ID)</th>
                    <th>Email</th>
                    <th style={{ textAlign: 'center' }}>Role</th>
                    <th style={{ textAlign: 'center' }}>Permissions</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center', width: '120px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 800 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{u.name}</span>
                          {currentUser?.id === u.id && (
                            <span style={{ fontSize: '0.7rem', fontWeight: 900, background: '#DCFCE7', color: '#166534', padding: '1px 6px', borderRadius: '6px' }}>
                              YOU
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{u.username}</td>
                      <td style={{ fontSize: '0.85rem', color: '#4B5563' }}>{u.email || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: u.role === 'ADMIN' ? '#DCFCE7' : '#FEF3C7',
                            color: u.role === 'ADMIN' ? '#166534' : '#92400E'
                          }}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                        {u.role === 'ADMIN' ? 'ALL (Full Access)' : `${u.permissions?.length || 0} permissions`}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: u.isActive !== false ? '#DCFCE7' : '#FEE2E2',
                            color: u.isActive !== false ? '#166534' : '#991B1B'
                          }}
                        >
                          {u.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                          <button
                            onClick={() => handleEdit(u)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#4F46E5', padding: '4px' }}
                            title="Edit User & Permissions"
                            type="button"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(u.id, u.name)}
                            disabled={u.id === currentUser?.id}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: u.id === currentUser?.id ? 'not-allowed' : 'pointer',
                              color: u.id === currentUser?.id ? '#D1D5DB' : '#EA3943',
                              padding: '4px'
                            }}
                            title={u.id === currentUser?.id ? 'Cannot delete own active account' : 'Delete User'}
                            type="button"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: '', name: '' })}
        onConfirm={confirmDelete}
        title="Delete User Account"
        message={`Are you sure you want to permanently delete the user account "${deleteDialog.name}"?`}
      />
    </div>
  );
};
