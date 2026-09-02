import React, { useState, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Party } from '../../types';
import { Search } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const PartyMasterView: React.FC = () => {
  const { refreshKey, showToast } = useApp();
  const { hasPermission } = useAuth();

  const parties = useMemo(() => db.getParties(), [refreshKey]);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(parties[0]?.id || null);
  const [search, setSearch] = useState('');
  const [showDirectory, setShowDirectory] = useState(false);

  // Form Fields matching customer screenshot party.jpg
  const [firmName, setFirmName] = useState(parties[0]?.name || '');
  const [gstNo, setGstNo] = useState(parties[0]?.gstin || '');
  const [propName, setPropName] = useState(parties[0]?.propName || '');
  const [address, setAddress] = useState(parties[0]?.address || '');
  const [block, setBlock] = useState(parties[0]?.block || '');
  const [distt, setDistt] = useState(parties[0]?.distt || '');
  const [city, setCity] = useState(parties[0]?.city || '');
  const [state, setState] = useState(parties[0]?.state || '');
  const [mobile1, setMobile1] = useState(parties[0]?.phone || '');
  const [mobile2, setMobile2] = useState(parties[0]?.phone2 || '');
  const [mailId, setMailId] = useState(parties[0]?.email || '');

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: '',
    name: ''
  });

  const loadPartyIntoForm = (party: Party) => {
    setSelectedPartyId(party.id);
    setFirmName(party.name);
    setGstNo(party.gstin || '');
    setPropName(party.propName || '');
    setAddress(party.address || '');
    setBlock(party.block || '');
    setDistt(party.distt || '');
    setCity(party.city || '');
    setState(party.state || '');
    setMobile1(party.phone || '');
    setMobile2(party.phone2 || '');
    setMailId(party.email || '');
  };

  const handleCreateNew = () => {
    setSelectedPartyId(null);
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
    showToast('Ready to create new party', 'info');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmName.trim()) {
      showToast('Firm Name is required', 'error');
      return;
    }

    const partyRecord: Party = {
      id: selectedPartyId || `party-${Date.now()}`,
      name: firmName.trim(),
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
      creditLimit: 50000,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    db.saveParty(partyRecord);
    setSelectedPartyId(partyRecord.id);
    showToast(`Party "${partyRecord.name}" saved successfully!`, 'success');
  };

  const handleDelete = () => {
    if (!selectedPartyId) {
      showToast('Please select a party to delete', 'error');
      return;
    }
    if (!hasPermission('MANAGE_MASTERS')) {
      showToast('You do not have permission to delete parties', 'error');
      return;
    }
    setDeleteDialog({ isOpen: true, id: selectedPartyId, name: firmName });
  };

  const confirmDelete = () => {
    if (deleteDialog.id) {
      db.deleteParty(deleteDialog.id);
      showToast(`Party "${deleteDialog.name}" deleted.`, 'info');
      setDeleteDialog({ isOpen: false, id: '', name: '' });
      handleCreateNew();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredParties = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return parties;
    return parties.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q)) ||
        (p.gstin && p.gstin.toLowerCase().includes(q)) ||
        (p.city && p.city.toLowerCase().includes(q))
    );
  }, [parties, search]);

  return (
    <div className="content-panel-grey">
      {/* Top Header Strip matching party.jpg */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div className="pill-header-lavender" style={{ fontSize: '1.25rem', padding: '8px 48px', minWidth: '160px', textAlign: 'center' }}>
          PARTY
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setShowDirectory(!showDirectory)}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: '1.5px solid #6B7280',
              background: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            {showDirectory ? 'Hide Party List' : `View All (${parties.length})`}
          </button>

          <button
            type="button"
            onClick={handleCreateNew}
            className="btn-customer-new-entry"
            style={{ fontSize: '0.95rem', padding: '8px 24px' }}
          >
            CREATE PARTY
          </button>
        </div>
      </div>

      {/* Main White Form Container matching party.jpg */}
      <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '14px', padding: '32px', maxWidth: '850px', margin: '0 auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Row 1: Firm Name & Gst No. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.95rem', marginBottom: '6px' }}>
                Firm Name
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={firmName}
                onChange={e => setFirmName(e.target.value)}
                placeholder="e.g. Royal Printers & Pack"
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
                onChange={e => setGstNo(e.target.value)}
                placeholder="e.g. 07AAAAA0000A1Z5"
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
              onChange={e => setPropName(e.target.value)}
              placeholder="e.g. Vikram Singh"
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
              onChange={e => setAddress(e.target.value)}
              placeholder="e.g. 88, Central Commercial Hub"
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
                onChange={e => setBlock(e.target.value)}
                placeholder="e.g. Block-C"
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
                onChange={e => setDistt(e.target.value)}
                placeholder="e.g. North"
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
                onChange={e => setCity(e.target.value)}
                placeholder="e.g. Noida"
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
                onChange={e => setState(e.target.value)}
                placeholder="e.g. Uttar Pradesh"
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
                onChange={e => setMobile1(e.target.value)}
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
                onChange={e => setMobile2(e.target.value)}
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
              onChange={e => setMailId(e.target.value)}
              placeholder="e.g. royalprinters@yahoo.com"
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
                  setShowDirectory(true);
                  showToast('Select a party from the list below to edit', 'info');
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

      {/* Quick Select & Party Directory Drawer */}
      {showDirectory && (
        <div style={{ marginTop: '28px', background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '20px', maxWidth: '850px', margin: '28px auto 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h4 style={{ fontWeight: 900, fontSize: '1.05rem', margin: 0 }}>Party Directory</h4>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={14} color="#6B7280" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                type="text"
                placeholder="Search parties..."
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
                  <th style={{ textAlign: 'center' }}>Select</th>
                </tr>
              </thead>
              <tbody>
                {filteredParties.map(p => (
                  <tr
                    key={p.id}
                    style={{
                      backgroundColor: selectedPartyId === p.id ? '#F5F3FF' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => loadPartyIntoForm(p)}
                  >
                    <td style={{ fontWeight: 800 }}>{p.name}</td>
                    <td>{p.propName || '-'}</td>
                    <td>{p.phone || '-'}</td>
                    <td>{[p.city, p.state].filter(Boolean).join(', ') || '-'}</td>
                    <td style={{ fontFamily: 'monospace' }}>{p.gstin || '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          loadPartyIntoForm(p);
                          setShowDirectory(false);
                          showToast(`Loaded ${p.name}`, 'info');
                        }}
                        style={{
                          background: '#E2D2F8',
                          color: '#EA3943',
                          border: '1px solid #C4B5FD',
                          borderRadius: '12px',
                          padding: '2px 10px',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          cursor: 'pointer'
                        }}
                      >
                        Load
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: '', name: '' })}
        onConfirm={confirmDelete}
        title="Delete Party"
        message={`Are you sure you want to delete party "${deleteDialog.name}"?`}
      />
    </div>
  );
};
