import React, { useState } from 'react';
import { Modal } from './Modal';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { Supplier } from '../../types';

export const QuickSupplierModal: React.FC = () => {
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
  const [openingBalance, setOpeningBalance] = useState<string>('0');
  const [openingBalanceDate, setOpeningBalanceDate] = useState<string>('2026-04-01');

  if (!quickModal.isOpen || quickModal.type !== 'SUPPLIER') return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Firm Name is required', 'error');
      return;
    }

    const newSupplier: Supplier = {
      id: `sup-${Date.now()}`,
      name: name.trim().toUpperCase(),
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
      openingBalance: openingBalance !== '' ? Number(openingBalance) : 0,
      openingBalanceDate: openingBalanceDate || '2026-04-01',
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0]
    };

    db.saveSupplier(newSupplier);
    showToast(`Supplier "${newSupplier.name}" added successfully!`, 'success');
    if (quickModal.onSuccess) {
      quickModal.onSuccess(newSupplier.id, newSupplier.name);
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
    setOpeningBalance('0');
    setOpeningBalanceDate('2026-04-01');
    closeQuickModal();
  };

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
    <Modal isOpen={quickModal.isOpen} onClose={closeQuickModal} title="Quick Create Supplier" maxWidth="640px">
      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
            Firm Name *
          </label>
          <input
            type="text"
            className="input-text-clean"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. KONARK / DELTA"
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
              placeholder="e.g. 07AAACK9988K1Z9"
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
              placeholder="e.g. Rajesh Agarwal"
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
            placeholder="e.g. Plot No 42, Industrial Area"
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
              placeholder="Primary Mobile"
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
              placeholder="Alternate Mobile"
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
            placeholder="e.g. supplier@example.com"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
              Opening Balance (₹)
            </label>
            <input
              type="number"
              step="any"
              className="input-text-clean"
              value={openingBalance}
              onChange={e => setOpeningBalance(e.target.value)}
              placeholder="0"
              style={{ fontWeight: 800, color: '#002B99' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '4px' }}>
              As-On Date
            </label>
            <input
              type="date"
              className="input-text-clean"
              value={openingBalanceDate}
              onChange={e => setOpeningBalanceDate(e.target.value)}
              style={{ fontWeight: 800 }}
            />
          </div>
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
