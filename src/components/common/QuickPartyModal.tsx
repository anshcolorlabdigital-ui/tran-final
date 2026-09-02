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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
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
