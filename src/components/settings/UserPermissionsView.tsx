import React, { useState, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { User, Permission, UserRole } from '../../types';
import { Plus, Edit, Trash2, Shield, KeyRound, Check } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';

const ALL_PERMISSIONS: { id: Permission; label: string; group: string }[] = [
  { id: 'VIEW_DASHBOARD', label: 'View Dashboard & Stock Status', group: 'General' },
  { id: 'MANAGE_ORDERS', label: 'Manage & Place Orders with Suppliers', group: 'Orders' },
  { id: 'CREATE_SALE', label: 'Create Sales Invoices', group: 'Sales' },
  { id: 'EDIT_SALE', label: 'Edit Existing Sales Invoices', group: 'Sales' },
  { id: 'DELETE_SALE', label: 'Delete Sales Invoices (Reverses Stock)', group: 'Sales' },
  { id: 'CREATE_PURCHASE', label: 'Create Purchase / Inward Stock', group: 'Purchase' },
  { id: 'EDIT_PURCHASE', label: 'Edit Purchase Vouchers', group: 'Purchase' },
  { id: 'DELETE_PURCHASE', label: 'Delete Purchase Vouchers', group: 'Purchase' },
  { id: 'CREATE_SELF_USE', label: 'Record Self-Use Consumption', group: 'Self-Use' },
  { id: 'EDIT_SELF_USE', label: 'Edit Self-Use Records', group: 'Self-Use' },
  { id: 'DELETE_SELF_USE', label: 'Delete Self-Use Records', group: 'Self-Use' },
  { id: 'VIEW_REPORTS', label: 'View Financial & Stock Reports', group: 'Reports' },
  { id: 'MANAGE_MASTERS', label: 'Manage Item, Party & Supplier Masters', group: 'Masters' },
  { id: 'ADJUST_STOCK', label: 'Perform Stock Audits & Overrides', group: 'Admin' },
  { id: 'MANAGE_USERS', label: 'Manage Users & Permissions', group: 'Admin' },
  { id: 'MANAGE_SETTINGS', label: 'Manage System & Backup Settings', group: 'Admin' }
];

export const UserPermissionsView: React.FC = () => {
  const { refreshKey, showToast } = useApp();
  const { users, currentUser, switchUser, hasPermission } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
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
    setRole('OPERATOR');
    setSelectedPermissions([
      'VIEW_DASHBOARD',
      'MANAGE_ORDERS',
      'CREATE_SALE',
      'CREATE_PURCHASE',
      'CREATE_SELF_USE',
      'VIEW_REPORTS'
    ]);
    setIsActive(true);
  };

  const handleEdit = (user: User) => {
    setIsEditing(true);
    setEditingId(user.id);
    setName(user.name);
    setUsername(user.username);
    setRole(user.role);
    setSelectedPermissions(user.permissions || []);
    setIsActive(user.isActive !== false);
  };

  const togglePermission = (perm: Permission) => {
    setSelectedPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim()) {
      showToast('Name and Username are required', 'error');
      return;
    }

    const userRecord: User = {
      id: editingId || `user-${Date.now()}`,
      name: name.trim(),
      username: username.trim().toLowerCase(),
      role,
      permissions: role === 'ADMIN' ? ALL_PERMISSIONS.map(p => p.id) : selectedPermissions,
      isActive,
      createdAt: new Date().toISOString()
    };

    db.saveUser(userRecord);
    showToast(`User "${userRecord.name}" saved successfully!`, 'success');
    setIsEditing(false);
  };

  const handleDelete = (id: string, userName: string) => {
    if (id === currentUser.id) {
      showToast('You cannot delete your own active account', 'error');
      return;
    }
    setDeleteDialog({ isOpen: true, id, name: userName });
  };

  const confirmDelete = () => {
    if (deleteDialog.id) {
      db.deleteUser(deleteDialog.id);
      showToast(`User "${deleteDialog.name}" removed.`, 'info');
      setDeleteDialog({ isOpen: false, id: '', name: '' });
    }
  };

  return (
    <div className="content-panel-grey">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div className="pill-header-lime" style={{ padding: '8px 28px', fontSize: '1.2rem' }}>
          USER MANAGEMENT & ROLE PERMISSIONS
        </div>

        {!isEditing && (
          <button onClick={handleStartNew} className="btn-red-action">
            <Plus size={16} />
            Create User Account
          </button>
        )}
      </div>

      {isEditing ? (
        <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 800, fontSize: '1.2rem', marginBottom: '16px' }}>
            {editingId ? 'Edit User & Permissions' : 'Create New User'}
          </h3>

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
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
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
                  Username / ID *
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
                <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
                  Assigned Role
                </label>
                <select
                  className="input-text-clean"
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                >
                  <option value="ADMIN">Administrator (Full Access)</option>
                  <option value="MANAGER">Store Manager</option>
                  <option value="OPERATOR">Counter Operator / Cashier</option>
                  <option value="VIEWER">Read-Only Viewer</option>
                </select>
              </div>
            </div>

            {/* Permissions Matrix */}
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.95rem', marginBottom: '10px' }}>
                Granular Permissions ({role === 'ADMIN' ? 'Admin has all permissions enabled' : `${selectedPermissions.length} enabled`})
              </label>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '10px',
                  background: '#F9FAFB',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB'
                }}
              >
                {ALL_PERMISSIONS.map(p => {
                  const isChecked = role === 'ADMIN' || selectedPermissions.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: role === 'ADMIN' ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={role === 'ADMIN'}
                        onChange={() => togglePermission(p.id)}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span>{p.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                style={{ padding: '8px 18px', borderRadius: '20px', border: '1px solid #9CA3AF', background: '#F3F4F6', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button type="submit" className="btn-lime-action">
                Save User
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* List View */
        <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '20px' }}>
          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Username</th>
                  <th style={{ textAlign: 'center' }}>Role</th>
                  <th style={{ textAlign: 'center' }}>Permissions Count</th>
                  <th style={{ textAlign: 'center' }}>Active Session</th>
                  <th style={{ textAlign: 'center', width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 800 }}>{u.name}</td>
                    <td style={{ fontFamily: 'monospace' }}>{u.username}</td>
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
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>
                      {u.role === 'ADMIN' ? 'ALL (Full)' : `${u.permissions?.length || 0} permissions`}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {currentUser.id === u.id ? (
                        <span style={{ color: '#15803D', fontWeight: 900, fontSize: '0.85rem' }}>
                          ✓ CURRENT
                        </span>
                      ) : (
                        <button
                          onClick={() => switchUser(u.id)}
                          style={{
                            background: '#F3F4F6',
                            border: '1px solid #D1D5DB',
                            borderRadius: '12px',
                            padding: '3px 10px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          Switch User
                        </button>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                        <button
                          onClick={() => handleEdit(u)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#4F46E5' }}
                          title="Edit User"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id, u.name)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#EA3943' }}
                          title="Delete User"
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
      )}

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: '', name: '' })}
        onConfirm={confirmDelete}
        title="Delete User"
        message={`Are you sure you want to remove user "${deleteDialog.name}"?`}
      />
    </div>
  );
};
