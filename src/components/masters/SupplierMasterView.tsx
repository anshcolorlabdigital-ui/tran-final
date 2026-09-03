import React, { useState, useMemo, useRef } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Supplier } from '../../types';
import { Search, Plus, Printer } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const SupplierMasterView: React.FC = () => {
  const { refreshKey, showToast } = useApp();
  const { hasPermission } = useAuth();

  const suppliers = useMemo(() => db.getSuppliers(), [refreshKey]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState(false);
  const [search, setSearch] = useState('');

  // Form Fields matching customer screenshot supplier.jpg
  const [firmName, setFirmName] = useState('');
  const [gstNo, setGstNo] = useState('');
  const [propName, setPropName] = useState('');
  const [address, setAddress] = useState('');
  const [block, setBlock] = useState('');
  const [distt, setDistt] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [mobile1, setMobile1] = useState('');
  const [mobile2, setMobile2] = useState('');
  const [mailId, setMailId] = useState('');

  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: '',
    name: ''
  });

  const isFormActive = Boolean(isTouched || selectedSupplierId || firmName.trim() !== '');

  // When selected supplier changes, populate fields
  const loadSupplierIntoForm = (supplier: Supplier) => {
    setSelectedSupplierId(supplier.id);
    setIsTouched(true);
    setFirmName(supplier.name);
    setGstNo(supplier.gstin || '');
    setPropName(supplier.propName || '');
    setAddress(supplier.address || '');
    setBlock(supplier.block || '');
    setDistt(supplier.distt || '');
    setCity(supplier.city || '');
    setState(supplier.state || '');
    setMobile1(supplier.phone || '');
    setMobile2(supplier.phone2 || '');
    setMailId(supplier.email || '');
    showToast(`Loaded ${supplier.name} for editing`, 'info');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateNew = () => {
    setSelectedSupplierId(null);
    setIsTouched(false);
    setFirmName('');
    setGstNo('');
    setPropName('');
    setAddress('');
    setBlock('');
    setDistt('');
    setCity('');
    setState('');
    setMobile1('');
    setMobile2('');
    setMailId('');
    showToast('Ready to create new supplier', 'info');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmName.trim()) {
      showToast('Firm Name is required', 'error');
      return;
    }

    const supplierRecord: Supplier = {
      id: selectedSupplierId || `sup-${Date.now()}`,
      name: firmName.trim().toUpperCase(),
      propName: propName.trim(),
      gstin: gstNo.trim().toUpperCase(),
      address: address.trim(),
      block: block.trim(),
      distt: distt.trim(),
      city: city.trim(),
      state: state.trim(),
      phone: mobile1.trim(),
      phone2: mobile2.trim(),
      email: mailId.trim(),
      openingBalance: 0,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    db.saveSupplier(supplierRecord);
    setSelectedSupplierId(supplierRecord.id);
    setIsTouched(false);
    showToast(`Supplier "${supplierRecord.name}" saved successfully!`, 'success');
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
  const isCreating = Boolean(!isEditing && (isTouched || firmName.trim() !== ''));

  const cardStateClass = isEditing
    ? 'is-editing-pink'
    : isCreating
    ? 'is-creating-green'
    : 'is-initial-blue';

  return (
    <div className="content-panel-grey">
      {/* Top Header Strip matching supplier.jpg */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="pill-header-lavender" style={{ fontSize: '1.25rem', padding: '8px 36px', minWidth: '160px', textAlign: 'center' }}>
            Supplier
          </div>
          {isEditing ? (
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
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Row 1: Firm Name (wider) & Gst No. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.95rem', marginBottom: '6px' }}>
                Firm Name
              </label>
              <input
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
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.95rem', marginBottom: '6px' }}>
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

          {/* Row 2: Prop. Name */}
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.95rem', marginBottom: '6px' }}>
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

          {/* Row 3: Address */}
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.95rem', marginBottom: '6px' }}>
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
              placeholder="e.g. Plot No 42, Ring Road Depot"
            />
          </div>

          {/* Row 4: Block & Distt. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.95rem', marginBottom: '6px' }}>
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
                placeholder="e.g. Industrial Area"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.95rem', marginBottom: '6px' }}>
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

          {/* Row 5: CITY & State */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.95rem', marginBottom: '6px' }}>
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
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.95rem', marginBottom: '6px' }}>
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
                placeholder="e.g. Delhi"
              />
            </div>
          </div>

          {/* Row 6: Mobile 1 & Mobile 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.95rem', marginBottom: '6px' }}>
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
                placeholder="Primary phone"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.95rem', marginBottom: '6px' }}>
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
                placeholder="Alternate phone"
              />
            </div>
          </div>

          {/* Row 7: Mail id */}
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.95rem', marginBottom: '6px' }}>
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
              placeholder="e.g. sales@konarkmaterials.com"
            />
          </div>

          {/* Customer Authentic Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
            {/* Top Center: Mint Green Save Button */}
            <button type="submit" className="btn-customer-save">
              Save
            </button>

            {/* Bottom Row: Lavender Action Pills (Edit, Del, Print) */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-customer-action-pill"
                onClick={() => {
                  if (suppliers.length > 0) {
                    showToast('Select a supplier from the directory below to edit', 'info');
                    const el = document.getElementById('supplier-directory-register');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  } else {
                    showToast('No saved suppliers found', 'warning');
                  }
                }}
              >
                Edit
              </button>

              <button
                type="button"
                className="btn-customer-action-pill"
                onClick={handleDelete}
              >
                Del
              </button>

              <button
                type="button"
                className="btn-customer-action-pill"
                onClick={handlePrint}
              >
                Print
              </button>
            </div>
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
                    style={{
                      backgroundColor: selectedSupplierId === s.id ? '#EFF6FF' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => loadSupplierIntoForm(s)}
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
                          loadSupplierIntoForm(s);
                        }}
                        style={{
                          background: selectedSupplierId === s.id ? '#BFDBFE' : '#E2D2F8',
                          color: selectedSupplierId === s.id ? '#1E40AF' : '#EA3943',
                          border: '1px solid #C4B5FD',
                          borderRadius: '12px',
                          padding: '3px 12px',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        {selectedSupplierId === s.id ? 'Editing' : 'Load'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
