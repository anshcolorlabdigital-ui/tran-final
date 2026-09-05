import React, { useState } from 'react';
import { Modal } from './Modal';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { Party } from '../../types';

export const QuickPartyModal: React.FC = () => {
  const { quickModal, closeQuickModal, showToast } = useApp();
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [propName, setPropName] = useState('');
  const [address, setAddress] = useState('');
  const [block, setBlock] = useState('');
  const [distt, setDistt] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [phone, setPhone] = useState('');
  const [phone2, setPhone2] = useState('');
  const [email, setEmail] = useState('');
  const [partyType, setPartyType] = useState<'DEALER' | 'AMATEUR'>('AMATEUR');
  const [dealerProfitPercent, setDealerProfitPercent] = useState<string>('10');
  const [amateurProfitPercent, setAmateurProfitPercent] = useState<string>('25');

  if (!quickModal.isOpen || quickModal.type !== 'PARTY') return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Firm Name is required', 'error');
      return;
    }

    const newParty: Party = {
      id: `party-${Date.now()}`,
      name: name.trim(),
      propName: propName.trim(),
      gstin: gstin.trim().toUpperCase(),
      address: address.trim(),
      block: block.trim(),
      distt: distt.trim(),
      city: city.trim(),
      state: state.trim(),
      phone: phone.trim(),
      phone2: phone2.trim(),
      email: email.trim(),
      openingBalance: 0,
      creditLimit: 0,
      isActive: true,
      partyType,
      dealerProfitPercent: partyType === 'DEALER' ? (dealerProfitPercent !== '' ? Number(dealerProfitPercent) : 10) : undefined,
      amateurProfitPercent: partyType === 'AMATEUR' ? (amateurProfitPercent !== '' ? Number(amateurProfitPercent) : 25) : undefined,
      createdAt: new Date().toISOString().split('T')[0]
    };

    db.saveParty(newParty);
    showToast(`Party "${newParty.name}" created successfully!`, 'success');
    if (quickModal.onSuccess) {
      quickModal.onSuccess(newParty.id, newParty.name);
    }
    setName('');
    setGstin('');
    setPropName('');
    setAddress('');
    setBlock('');
    setDistt('');
    setCity('');
    setState('');
    setPhone('');
    setPhone2('');
    setEmail('');
    setPartyType('AMATEUR');
    setDealerProfitPercent('10');
    setAmateurProfitPercent('25');
    closeQuickModal();
  };

  return (
    <Modal isOpen={quickModal.isOpen} onClose={closeQuickModal} title="Quick Create Party" maxWidth="640px">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
            Firm Name *
          </label>
          <input
            type="text"
            className="input-text-clean"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Royal Printers & Pack"
            autoFocus
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
              Gst No.
            </label>
            <input
              type="text"
              className="input-text-clean"
              value={gstin}
              onChange={e => setGstin(e.target.value)}
              placeholder="e.g. 07AAAAA0000A1Z5"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
              Prop. Name
            </label>
            <input
              type="text"
              className="input-text-clean"
              value={propName}
              onChange={e => setPropName(e.target.value)}
              placeholder="e.g. Rajesh Sharma"
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
            Address
          </label>
          <input
            type="text"
            className="input-text-clean"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="e.g. 14, Main Market, Sector 5"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
              Block
            </label>
            <input
              type="text"
              className="input-text-clean"
              value={block}
              onChange={e => setBlock(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
              Distt.
            </label>
            <input
              type="text"
              className="input-text-clean"
              value={distt}
              onChange={e => setDistt(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
              CITY
            </label>
            <input
              type="text"
              className="input-text-clean"
              value={city}
              onChange={e => setCity(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
              State
            </label>
            <input
              type="text"
              className="input-text-clean"
              value={state}
              onChange={e => setState(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
              Mobile
            </label>
            <input
              type="tel"
              className="input-text-clean"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Primary Contact"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
              Mobile
            </label>
            <input
              type="tel"
              className="input-text-clean"
              value={phone2}
              onChange={e => setPhone2(e.target.value)}
              placeholder="Alternate Contact"
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
            Mail id
          </label>
          <input
            type="email"
            className="input-text-clean"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="e.g. party@example.com"
          />
        </div>

        {/* Classification: Amateur vs Dealer */}
        <div style={{ background: '#F8FAFC', border: '1.5px solid #CBD5E1', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ display: 'block', fontWeight: 900, fontSize: '0.84rem', color: '#1E293B' }}>
            Party Classification & Profit %
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setPartyType('AMATEUR')}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                border: partyType === 'AMATEUR' ? '2px solid #2563EB' : '1px solid #D1D5DB',
                background: partyType === 'AMATEUR' ? '#EFF6FF' : '#FFFFFF',
                color: partyType === 'AMATEUR' ? '#1D4ED8' : '#6B7280'
              }}
            >
              👤 Amateur
            </button>
            <button
              type="button"
              onClick={() => setPartyType('DEALER')}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
                border: partyType === 'DEALER' ? '2px solid #7C3AED' : '1px solid #D1D5DB',
                background: partyType === 'DEALER' ? '#F5F3FF' : '#FFFFFF',
                color: partyType === 'DEALER' ? '#6D28D9' : '#6B7280'
              }}
            >
              🏢 Dealer
            </button>
          </div>

          {partyType === 'AMATEUR' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#EFF6FF', padding: '6px 10px', borderRadius: '6px' }}>
              <label style={{ fontWeight: 800, fontSize: '0.8rem', color: '#1E40AF', whiteSpace: 'nowrap' }}>
                Amateur Profit %:
              </label>
              <input
                type="number"
                step="any"
                className="input-text-clean"
                value={amateurProfitPercent}
                onChange={e => setAmateurProfitPercent(e.target.value)}
                placeholder="e.g. 25"
                style={{ width: '80px', fontWeight: 800, textAlign: 'center', borderColor: '#3B82F6', padding: '4px 6px' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#1D4ED8', fontWeight: 600 }}>
                Custom profit for sales
              </span>
            </div>
          )}

          {partyType === 'DEALER' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F5F3FF', padding: '6px 10px', borderRadius: '6px' }}>
              <label style={{ fontWeight: 800, fontSize: '0.8rem', color: '#5B21B6', whiteSpace: 'nowrap' }}>
                Dealer Profit %:
              </label>
              <input
                type="number"
                step="any"
                className="input-text-clean"
                value={dealerProfitPercent}
                onChange={e => setDealerProfitPercent(e.target.value)}
                placeholder="e.g. 10"
                style={{ width: '80px', fontWeight: 800, textAlign: 'center', borderColor: '#8B5CF6', padding: '4px 6px' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#6D28D9', fontWeight: 600 }}>
                Custom margin for sales
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
          <button
            type="button"
            onClick={closeQuickModal}
            style={{
              padding: '8px 18px',
              borderRadius: '20px',
              border: '1px solid #9CA3AF',
              background: '#F3F4F6',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button type="submit" className="btn-customer-save" style={{ fontSize: '1rem', padding: '6px 24px' }}>
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
};
