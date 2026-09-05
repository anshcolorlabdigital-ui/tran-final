import React, { useState, useMemo, useRef, useEffect } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Supplier } from '../../types';
import { Search, Plus, Printer, Keyboard } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const SupplierMasterView: React.FC = () => {
  const { refreshKey, showToast, showAlert } = useApp();
  const { hasPermission } = useAuth();

  const suppliers = useMemo(() => db.getSuppliers(), [refreshKey]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [isJustSaved, setIsJustSaved] = useState(false);
  const [isTouched, setIsTouched] = useState(false);

  // Form Fields matching Customer Screenshot supplier.jpg
  const [firmName, setFirmName] = useState('');
  const [gstNo, setGstNo] = useState('');
  const [propName, setPropName] = useState('');
  const [propPhone, setPropPhone] = useState('');
  const [contactPerson1, setContactPerson1] = useState('');
  const [mobile1, setMobile1] = useState('');
  const [contactPerson2, setContactPerson2] = useState('');
  const [mobile2, setMobile2] = useState('');
  const [address, setAddress] = useState('');
  const [block, setBlock] = useState('');
  const [distt, setDistt] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [mailId, setMailId] = useState('');

  const [search, setSearch] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: '',
    name: ''
  });

  const [isViewOnly, setIsViewOnly] = useState(false);
  const [isEditPromptOpen, setIsEditPromptOpen] = useState(false);

  const firmNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      firmNameInputRef.current?.focus();
      firmNameInputRef.current?.select();
    }, 60);
    return () => clearTimeout(timer);
  }, [selectedSupplierId]);

  // When selected supplier changes, populate fields
  const loadSupplierIntoForm = (supplier: Supplier, viewOnly: boolean = false) => {
    setSelectedSupplierId(supplier.id);
    setIsJustSaved(false);
    setIsTouched(false);
    setIsViewOnly(viewOnly);
    setFirmName(supplier.name);
    setGstNo(supplier.gstin || '');
    setPropName(supplier.propName || '');
    setPropPhone(supplier.propPhone || '');
    setContactPerson1(supplier.contactPerson1 || '');
    setMobile1(supplier.phone || '');
    setContactPerson2(supplier.contactPerson2 || '');
    setMobile2(supplier.phone2 || '');
    setAddress(supplier.address || '');
    setBlock(supplier.block || '');
    setDistt(supplier.distt || '');
    setCity(supplier.city || '');
    setState(supplier.state || '');
    setMailId(supplier.email || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateNew = () => {
    setSelectedSupplierId(null);
    setIsJustSaved(false);
    setIsTouched(false);
    setIsViewOnly(false);
    setFirmName('');
    setGstNo('');
    setPropName('');
    setPropPhone('');
    setContactPerson1('');
    setMobile1('');
    setContactPerson2('');
    setMobile2('');
    setAddress('');
    setBlock('');
    setDistt('');
    setCity('');
    setState('');
    setMailId('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmName.trim()) {
      showAlert('Firm Name is required', 'Validation Error', 'error');
      return;
    }

    const supplierRecord: Supplier = {
      id: selectedSupplierId || `sup-${Date.now()}`,
      name: firmName.trim().toUpperCase(),
      propName: propName.trim(),
      propPhone: propPhone.trim(),
      gstin: gstNo.trim().toUpperCase(),
      address: address.trim(),
      block: block.trim(),
      distt: distt.trim(),
      city: city.trim(),
      state: state.trim(),
      phone: mobile1.trim(),
      phone2: mobile2.trim(),
      contactPerson1: contactPerson1.trim(),
      contactPerson2: contactPerson2.trim(),
      email: mailId.trim(),
      openingBalance: 0,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    db.saveSupplier(supplierRecord);
    setSelectedSupplierId(supplierRecord.id);

    if (selectedSupplierId) {
      setIsJustSaved(true);
      setIsTouched(false);
      showToast(`Supplier "${supplierRecord.name}" updated successfully!`, 'success');
    } else {
      setIsJustSaved(false);
      setIsTouched(false);
      showToast(`Supplier "${supplierRecord.name}" created successfully!`, 'success');
      handleCreateNew();
    }
  };

  const handleDelete = () => {
    if (!selectedSupplierId) {
      showToast('Please select a supplier to delete', 'error');
      return;
    }
    if (!hasPermission('MANAGE_MASTERS')) {
      showToast('You do not have permission to delete suppliers', 'error');
      return;
    }
    setDeleteDialog({ isOpen: true, id: selectedSupplierId, name: firmName });
  };

  const confirmDelete = () => {
    if (deleteDialog.id) {
      db.deleteSupplier(deleteDialog.id);
      showToast(`Supplier "${deleteDialog.name}" deleted.`, 'info');
      setDeleteDialog({ isOpen: false, id: '', name: '' });
      handleCreateNew();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Keyboard Shortcuts (Ctrl+S to save, Alt+N for new, Alt+P to print)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey || e.altKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave({ preventDefault: () => {} } as any);
      } else if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleCreateNew();
      } else if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSupplierId, firmName, gstNo, propName, propPhone, mobile1, mobile2, contactPerson1, contactPerson2, address, block, distt, city, state, mailId, isViewOnly]);

  const filteredSuppliers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return suppliers;
    return suppliers.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q)) ||
        (s.gstin && s.gstin.toLowerCase().includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q))
    );
  }, [suppliers, search]);

  const isEditing = Boolean(selectedSupplierId);
  const isCreating = Boolean(!isEditing && !isJustSaved && (isTouched || firmName.trim() !== ''));

  const cardStateClass = isJustSaved
    ? 'is-saved-yellow'
    : isEditing
    ? 'is-editing-pink'
    : isCreating
    ? 'is-creating-green'
    : 'is-initial-blue';

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'BUTTON' && target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const form = e.currentTarget;
        const focusable = Array.from(
          form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement | HTMLTextAreaElement>(
            'input:not([disabled]):not([type="hidden"]):not([type="checkbox"]), select:not([disabled]), textarea:not([disabled]), button[type="submit"]'
          )
        );
        const index = focusable.indexOf(target as any);
        if (index > -1 && index < focusable.length - 1) {
          focusable[index + 1]?.focus();
          if ('select' in focusable[index + 1]) {
            (focusable[index + 1] as HTMLInputElement).select?.();
          }
        }
      }
    }
  };

  return (
    <div className="content-panel-grey">
      {/* Top Header Strip matching supplier.jpg */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="pill-header-lavender" style={{ fontSize: '1.25rem', padding: '8px 36px', minWidth: '160px', textAlign: 'center' }}>
            Supplier
          </div>
          {isViewOnly ? (
            <span className="active-mode-indicator is-saved" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B' }}>
              🔒 Viewing Supplier ({firmName || 'Selected Supplier'}) — Read-Only
            </span>
          ) : isJustSaved ? (
            <span className="active-mode-indicator is-saved">
              ● Saved / Updated Just Now ({firmName})
            </span>
          ) : isEditing ? (
            <span className="active-mode-indicator is-editing">
              ● Editing Supplier ({firmName || 'Saved Supplier'})
            </span>
          ) : isCreating ? (
            <span className="active-mode-indicator is-creating">
              ● Creating New Supplier
            </span>
          ) : (
            <span className="active-mode-indicator is-initial">
              ● Ready for New Supplier
            </span>
          )}
        </div>

        {/* Shortcuts indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#4B5563', background: '#FFFFFF', padding: '5px 12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
          <span><b>Ctrl+S:</b> Save Supplier</span>
          <span style={{ color: '#D1D5DB' }}>|</span>
          <span><b>Alt+N:</b> New Supplier</span>
          <span style={{ color: '#D1D5DB' }}>|</span>
          <span><b>Alt+P:</b> Print</span>
        </div>
      </div>

      {/* Main Form Container: Light Blue on Initial, Light Green on Creating, Light Pink on Editing */}
      <div
        className={`dynamic-entry-card ${cardStateClass}`}
        style={{
          padding: '32px',
          maxWidth: '850px',
          margin: '0 auto'
        }}
      >
        {isViewOnly && (
          <div
            onClick={() => setIsEditPromptOpen(true)}
            style={{
              marginBottom: '18px',
              padding: '10px 16px',
              background: '#FEF3C7',
              border: '1.5px solid #F59E0B',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontWeight: 800, color: '#92400E', fontSize: '0.88rem' }}>
              🔒 View-Only Mode: Supplier record is locked against accidental edits. Click anywhere or press button to edit.
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditPromptOpen(true);
              }}
              style={{
                background: '#D97706',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 14px',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              Unlock / Edit
            </button>
          </div>
        )}

        <form
          onSubmit={handleSave}
          onKeyDown={handleFormKeyDown}
          onClickCapture={isViewOnly ? (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsEditPromptOpen(true);
          } : undefined}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          
          {/* Row 1: Firm Name (wider) & Gst No. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Firm Name *
              </label>
              <input
                ref={firmNameInputRef}
                type="text"
                className="input-text-clean"
                value={firmName}
                onChange={e => {
                  setIsTouched(true);
                  setFirmName(e.target.value);
                }}
                placeholder="e.g. KONARK RAW MATERIALS"
                required
                style={{ fontWeight: 800 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Gst No.
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={gstNo}
                onChange={e => {
                  setIsTouched(true);
                  setGstNo(e.target.value);
                }}
                placeholder="e.g. 07AAACK9988K1Z9"
                style={{ fontFamily: 'monospace' }}
              />
            </div>
          </div>

          {/* Row 2: Prop. Name & Prop. Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Prop. Name
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={propName}
                onChange={e => {
                  setIsTouched(true);
                  setPropName(e.target.value);
                }}
                placeholder="e.g. Rajesh Agarwal"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Prop. Phone
              </label>
              <input
                type="tel"
                className="input-text-clean"
                value={propPhone}
                onChange={e => {
                  setIsTouched(true);
                  setPropPhone(e.target.value);
                }}
                placeholder="Proprietor direct number"
              />
            </div>
          </div>

          {/* Row 3: Contact Person 1 & Mobile 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Contact 1 (Person / Ref)
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={contactPerson1}
                onChange={e => {
                  setIsTouched(true);
                  setContactPerson1(e.target.value);
                }}
                placeholder="e.g. Sales Manager / Desk"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Mobile 1
              </label>
              <input
                type="tel"
                className="input-text-clean"
                value={mobile1}
                onChange={e => {
                  setIsTouched(true);
                  setMobile1(e.target.value);
                }}
                placeholder="Primary contact phone"
              />
            </div>
          </div>

          {/* Row 4: Contact Person 2 & Mobile 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Contact 2 (Person / Ref)
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={contactPerson2}
                onChange={e => {
                  setIsTouched(true);
                  setContactPerson2(e.target.value);
                }}
                placeholder="e.g. Logistics / Dispatch"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Mobile 2
              </label>
              <input
                type="tel"
                className="input-text-clean"
                value={mobile2}
                onChange={e => {
                  setIsTouched(true);
                  setMobile2(e.target.value);
                }}
                placeholder="Alternate contact phone"
              />
            </div>
          </div>

          {/* Row 5: Address, Block, Distt */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Address
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={address}
                onChange={e => {
                  setIsTouched(true);
                  setAddress(e.target.value);
                }}
                placeholder="e.g. Industrial Area Phase-2"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Block
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={block}
                onChange={e => {
                  setIsTouched(true);
                  setBlock(e.target.value);
                }}
                placeholder="e.g. B-Block"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Distt.
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={distt}
                onChange={e => {
                  setIsTouched(true);
                  setDistt(e.target.value);
                }}
                placeholder="e.g. Central"
              />
            </div>
          </div>

          {/* Row 6: CITY, State, Mail ID */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                CITY
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={city}
                onChange={e => {
                  setIsTouched(true);
                  setCity(e.target.value);
                }}
                placeholder="e.g. Delhi"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                State
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={state}
                onChange={e => {
                  setIsTouched(true);
                  setState(e.target.value);
                }}
                placeholder="e.g. Delhi NCR"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Mail id
              </label>
              <input
                type="email"
                className="input-text-clean"
                value={mailId}
                onChange={e => {
                  setIsTouched(true);
                  setMailId(e.target.value);
                }}
                placeholder="e.g. konarkmaterials@gmail.com"
              />
            </div>
          </div>

          {/* Customer Action Buttons: Del, Large Save, Print */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', flexWrap: 'wrap', marginTop: '24px' }}>
            <button
              type="button"
              className="btn-customer-action-pill"
              onClick={handleDelete}
              disabled={!isEditing}
              style={{ opacity: isEditing ? 1 : 0.5, cursor: isEditing ? 'pointer' : 'not-allowed' }}
            >
              Del
            </button>

            <button
              type="submit"
              className="btn-customer-save"
              style={{ padding: '10px 48px', fontSize: '1.2rem', minWidth: '160px' }}
            >
              Save
            </button>

            <button
              type="button"
              className="btn-customer-action-pill"
              onClick={handlePrint}
            >
              Print
            </button>
          </div>
        </form>
      </div>

      {/* Supplier Directory Register in the Downside (Always Visible) */}
      <div id="supplier-directory-register" style={{ marginTop: '28px', background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '20px', maxWidth: '850px', margin: '28px auto 0', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h4 style={{ fontWeight: 900, fontSize: '1.1rem', margin: 0 }}>Supplier Directory (Register)</h4>
            <span style={{ fontSize: '0.8rem', background: '#E0E7FF', color: '#3730A3', padding: '2px 10px', borderRadius: '12px', fontWeight: 800 }}>
              {filteredSuppliers.length} {filteredSuppliers.length === 1 ? 'Supplier' : 'Suppliers'}
            </span>
          </div>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={14} color="#6B7280" style={{ position: 'absolute', left: '10px', top: '10px' }} />
            <input
              type="text"
              placeholder="Search suppliers..."
              className="input-text-clean"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Firm Name</th>
                <th>Prop. Name</th>
                <th>Mobile</th>
                <th>CITY / State</th>
                <th>GST No.</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF', fontWeight: 600 }}>
                    No suppliers found matching "{search}".
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map(s => (
                  <tr
                    key={s.id}
                    title="Single-click to view, double-click to edit directly"
                    style={{
                      backgroundColor: selectedSupplierId === s.id ? '#EFF6FF' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => loadSupplierIntoForm(s, true)}
                    onDoubleClick={() => loadSupplierIntoForm(s, false)}
                  >
                    <td style={{ fontWeight: 800 }}>{s.name}</td>
                    <td>{s.propName || '-'}</td>
                    <td>{s.phone || '-'}</td>
                    <td>{[s.city, s.state].filter(Boolean).join(', ') || '-'}</td>
                    <td style={{ fontFamily: 'monospace' }}>{s.gstin || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          loadSupplierIntoForm(s, false);
                        }}
                        style={{
                          background: selectedSupplierId === s.id && !isViewOnly ? '#BFDBFE' : '#E2D2F8',
                          color: selectedSupplierId === s.id && !isViewOnly ? '#1E40AF' : '#EA3943',
                          border: '1px solid #C4B5FD',
                          borderRadius: '12px',
                          padding: '3px 12px',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        {selectedSupplierId === s.id && !isViewOnly ? 'Editing' : selectedSupplierId === s.id ? 'Viewing' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Mode Prompt Confirmation */}
      <ConfirmDialog
        isOpen={isEditPromptOpen}
        onClose={() => setIsEditPromptOpen(false)}
        onConfirm={() => {
          setIsViewOnly(false);
          setIsEditPromptOpen(false);
          showToast('Edit mode enabled', 'info');
        }}
        title="Enable Edit Mode?"
        message="Would you like to edit this supplier record?"
        confirmText="Yes, Edit"
        cancelText="No, Keep View Only"
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: '', name: '' })}
        onConfirm={confirmDelete}
        title="Delete Supplier"
        message={`Are you sure you want to delete supplier "${deleteDialog.name}"?`}
      />
    </div>
  );
};
