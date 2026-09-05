import React, { useState, useMemo, useEffect, useRef } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Party, PartyLog } from '../../types';
import { Search, Plus, CreditCard, CheckCircle, XCircle, FileText, ArrowUpRight, ArrowDownLeft, X, Keyboard } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { getTodayDateString, formatDateToDisplay } from '../../utils/dateUtils';

export const PartyMasterView: React.FC = () => {
  const { refreshKey, showToast, showAlert } = useApp();
  const { hasPermission } = useAuth();

  const parties = useMemo(() => db.getParties(), [refreshKey]);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [isJustSaved, setIsJustSaved] = useState(false);
  const [isTouched, setIsTouched] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [isEditPromptOpen, setIsEditPromptOpen] = useState(false);

  // Form Fields matching Customer Screenshot party.jpg
  const [firmName, setFirmName] = useState('');
  const [gstin, setGstin] = useState('');
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
  const [isActive, setIsActive] = useState<boolean>(true);
  const [allowCredit, setAllowCredit] = useState<boolean>(false);
  const [partyType, setPartyType] = useState<'DEALER' | 'AMATEUR'>('AMATEUR');
  const [dealerProfitPercent, setDealerProfitPercent] = useState<string>('0');
  const [amateurProfitPercent, setAmateurProfitPercent] = useState<string>('0');

  const [search, setSearch] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: '',
    name: ''
  });

  // Statement / Ledger Modal State
  const [statementParty, setStatementParty] = useState<Party | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'COMBINED'>('CASH');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const firmNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      firmNameInputRef.current?.focus();
      firmNameInputRef.current?.select();
    }, 60);
    return () => clearTimeout(timer);
  }, [selectedPartyId]);

  const handleCreateNew = () => {
    setSelectedPartyId(null);
    setIsJustSaved(false);
    setIsTouched(false);
    setIsViewOnly(false);
    setFirmName('');
    setGstin('');
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
    setIsActive(true);
    setAllowCredit(false);
    setPartyType('AMATEUR');
    setDealerProfitPercent('0');
    setAmateurProfitPercent('0');
  };

  const handleEditParty = (party: Party, viewOnly: boolean = false) => {
    setSelectedPartyId(party.id);
    setIsJustSaved(false);
    setIsTouched(false);
    setIsViewOnly(viewOnly);
    setFirmName(party.name);
    setGstin(party.gstin || '');
    setPropName(party.propName || '');
    setPropPhone(party.propPhone || '');
    setContactPerson1(party.contactPerson1 || '');
    setMobile1(party.phone || '');
    setContactPerson2(party.contactPerson2 || '');
    setMobile2(party.phone2 || '');
    setAddress(party.address || '');
    setBlock(party.block || '');
    setDistt(party.distt || '');
    setCity(party.city || '');
    setState(party.state || '');
    setMailId(party.email || '');
    setIsActive(party.isActive !== false);
    setAllowCredit(Boolean(party.allowCredit));
    setPartyType(party.partyType || 'AMATEUR');
    setDealerProfitPercent(party.dealerProfitPercent !== undefined ? String(party.dealerProfitPercent) : '0');
    setAmateurProfitPercent(party.amateurProfitPercent !== undefined ? String(party.amateurProfitPercent) : '0');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnly) {
      setIsEditPromptOpen(true);
      return;
    }
    if (!firmName.trim()) {
      showAlert('Firm Name is required', 'Validation Error', 'error');
      return;
    }

    const partyRecord: Party = {
      id: selectedPartyId || `party-${Date.now()}`,
      name: firmName.trim(),
      gstin: gstin.trim(),
      propName: propName.trim(),
      propPhone: propPhone.trim(),
      phone: mobile1.trim(),
      phone2: mobile2.trim(),
      contactPerson1: contactPerson1.trim(),
      contactPerson2: contactPerson2.trim(),
      address: address.trim(),
      block: block.trim(),
      distt: distt.trim(),
      city: city.trim(),
      state: state.trim(),
      email: mailId.trim(),
      openingBalance: 0,
      creditLimit: 50000,
      isActive,
      allowCredit,
      partyType,
      dealerProfitPercent: dealerProfitPercent !== '' ? Number(dealerProfitPercent) : 0,
      amateurProfitPercent: amateurProfitPercent !== '' ? Number(amateurProfitPercent) : 0,
      createdAt: new Date().toISOString()
    };

    db.saveParty(partyRecord);
    setSelectedPartyId(partyRecord.id);

    if (selectedPartyId) {
      setIsJustSaved(true);
      setIsTouched(false);
      setIsViewOnly(false);
      showToast(`Party "${partyRecord.name}" updated successfully!`, 'success');
    } else {
      setIsJustSaved(false);
      setIsTouched(false);
      setIsViewOnly(false);
      showToast(`Party "${partyRecord.name}" created successfully!`, 'success');
      handleCreateNew();
    }
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
  }, [selectedPartyId, firmName, gstin, propName, propPhone, mobile1, mobile2, contactPerson1, contactPerson2, address, block, distt, city, state, mailId, isActive, allowCredit, partyType, dealerProfitPercent, amateurProfitPercent, isViewOnly]);

  // Payment Recording in Statement Modal
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statementParty) return;

    const amt = Number(paymentAmount);
    if (!amt || amt <= 0) {
      showAlert('Payment amount must be greater than 0', 'Validation Error', 'error');
      return;
    }

    db.recordPartyPayment(
      statementParty.id,
      amt,
      paymentMode,
      paymentRef.trim() || undefined,
      paymentNotes.trim() || undefined
    );

    showToast(`Payment of ₹${amt} recorded for ${statementParty.name}!`, 'success');
    setPaymentAmount('');
    setPaymentRef('');
    setPaymentNotes('');
    setShowPaymentForm(false);
  };

  const statementLogs: PartyLog[] = useMemo(() => {
    if (!statementParty) return [];
    return db.getPartyLogsByPartyId(statementParty.id);
  }, [statementParty, refreshKey]);

  const statementSummary = useMemo(() => {
    if (!statementParty) return { totalBilled: 0, totalPaid: 0, outstandingBalance: 0 };
    return db.getPartyBalanceSummary(statementParty.id);
  }, [statementParty, refreshKey]);

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

  const isEditing = Boolean(selectedPartyId && !isViewOnly);
  const isViewing = Boolean(selectedPartyId && isViewOnly);
  const isCreating = Boolean(!selectedPartyId && !isJustSaved && (isTouched || firmName.trim() !== ''));

  const cardStateClass = isJustSaved
    ? 'is-saved-yellow'
    : isViewing
    ? 'is-initial-blue'
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
      {/* Top Header Strip matching party.jpg */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="pill-header-lavender" style={{ fontSize: '1.25rem', padding: '8px 48px', minWidth: '160px', textAlign: 'center' }}>
            PARTY
          </div>
          {isJustSaved ? (
            <span className="active-mode-indicator is-saved">
              ● Saved / Updated Just Now ({firmName})
            </span>
          ) : isViewing ? (
            <span className="active-mode-indicator is-initial" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B' }}>
              ● Viewing Party: {firmName || 'Saved Party'} (Read Only — Double-Click to Edit)
            </span>
          ) : isEditing ? (
            <span className="active-mode-indicator is-editing">
              ● Editing Party ({firmName || 'Saved Party'})
            </span>
          ) : isCreating ? (
            <span className="active-mode-indicator is-creating">
              ● Creating New Party
            </span>
          ) : (
            <span className="active-mode-indicator is-initial">
              ● Ready for New Party
            </span>
          )}
        </div>

        {/* Shortcuts indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#4B5563', background: '#FFFFFF', padding: '5px 12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
          <span><b>Ctrl+S:</b> Save Party</span>
          <span style={{ color: '#D1D5DB' }}>|</span>
          <span><b>Alt+N:</b> New Party</span>
          <span style={{ color: '#D1D5DB' }}>|</span>
          <span><b>Alt+P:</b> Print</span>
        </div>
      </div>

      {/* Main Form Container */}
      <div
        className={`dynamic-entry-card ${cardStateClass}`}
        style={{
          padding: '32px',
          maxWidth: '850px',
          margin: '0 auto',
          position: 'relative'
        }}
      >
        {isViewing && (
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
              🔒 View-Only Mode: Record is locked against accidental edits. Click anywhere or press button to edit.
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
          onClickCapture={isViewing ? (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsEditPromptOpen(true);
          } : undefined}
          style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
        >
          
          {/* Row 1: Firm Name & Gst No. */}
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
                placeholder="e.g. Royal Printers & Pack"
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
                value={gstin}
                onChange={e => {
                  setIsTouched(true);
                  setGstin(e.target.value);
                }}
                placeholder="e.g. 07AAAAA0000A1Z5"
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
                placeholder="e.g. Vikram Singh"
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
                placeholder="e.g. Manager / Accounts"
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
                placeholder="Primary mobile number"
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
                placeholder="e.g. Dispatch / Order Incharge"
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
                placeholder="Alternate phone number"
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
                placeholder="e.g. 88, Central Commercial Hub"
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
                placeholder="e.g. Block-C"
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
                placeholder="e.g. North"
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
                placeholder="e.g. Noida"
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
                placeholder="e.g. Uttar Pradesh"
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
                placeholder="e.g. royalprinters@yahoo.com"
              />
            </div>
          </div>

          {/* CLASSIFICATION: Amateur vs Dealer with Dual Profit % below each */}
          <div style={{ background: '#F8FAFC', border: '1.5px solid #CBD5E1', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
            <label style={{ display: 'block', fontWeight: 900, fontSize: '0.88rem', color: '#1E293B' }}>
              Party Classification (Select Amateur vs Dealer)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* Amateur Option */}
              <button
                type="button"
                onClick={() => { setIsTouched(true); setPartyType('AMATEUR'); }}
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  border: partyType === 'AMATEUR' ? '2.5px solid #2563EB' : '1px solid #D1D5DB',
                  background: partyType === 'AMATEUR' ? '#EFF6FF' : '#FFFFFF',
                  color: partyType === 'AMATEUR' ? '#1D4ED8' : '#4B5563',
                  boxShadow: partyType === 'AMATEUR' ? '0 0 0 2px rgba(37,99,235,0.2)' : 'none'
                }}
              >
                👤 Amateur (Retail / End Customer) {partyType === 'AMATEUR' && '✓'}
              </button>

              {/* Dealer Option */}
              <button
                type="button"
                onClick={() => { setIsTouched(true); setPartyType('DEALER'); }}
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  border: partyType === 'DEALER' ? '2.5px solid #7C3AED' : '1px solid #D1D5DB',
                  background: partyType === 'DEALER' ? '#F5F3FF' : '#FFFFFF',
                  color: partyType === 'DEALER' ? '#6D28D9' : '#4B5563',
                  boxShadow: partyType === 'DEALER' ? '0 0 0 2px rgba(124,58,237,0.2)' : 'none'
                }}
              >
                🏢 Dealer (Wholesale Rate) {partyType === 'DEALER' && '✓'}
              </button>
            </div>
          </div>

          {/* PRIVILEGES & STATUS TOGGLES: Active Status & Credit Facility */}
          <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '2px' }}>
            {/* Active / Inactive Toggle */}
            <div>
              <label style={{ display: 'block', fontWeight: 900, fontSize: '0.86rem', color: '#1E293B', marginBottom: '6px' }}>
                Party Status (Visibility)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setIsTouched(true); setIsActive(true); }}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    border: isActive ? '2px solid #16A34A' : '1px solid #D1D5DB',
                    background: isActive ? '#DCFCE7' : '#FFFFFF',
                    color: isActive ? '#15803D' : '#6B7280'
                  }}
                >
                  <CheckCircle size={15} />
                  Active (Show Everywhere)
                </button>
                <button
                  type="button"
                  onClick={() => { setIsTouched(true); setIsActive(false); }}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    border: !isActive ? '2px solid #DC2626' : '1px solid #D1D5DB',
                    background: !isActive ? '#FEE2E2' : '#FFFFFF',
                    color: !isActive ? '#B91C1C' : '#6B7280'
                  }}
                >
                  <XCircle size={15} />
                  Inactive (Hidden from Sales)
                </button>
              </div>
            </div>

            {/* Allow Credit Toggle */}
            <div>
              <label style={{ display: 'block', fontWeight: 900, fontSize: '0.86rem', color: '#1E293B', marginBottom: '6px' }}>
                Credit Facility (Payment Rules)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setIsTouched(true); setAllowCredit(true); }}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    border: allowCredit ? '2px solid #002B99' : '1px solid #D1D5DB',
                    background: allowCredit ? '#E0E7FF' : '#FFFFFF',
                    color: allowCredit ? '#002B99' : '#6B7280'
                  }}
                >
                  <CreditCard size={15} />
                  Allow Credit (Partial Pay)
                </button>
                <button
                  type="button"
                  onClick={() => { setIsTouched(true); setAllowCredit(false); }}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    border: !allowCredit ? '2px solid #F59E0B' : '1px solid #D1D5DB',
                    background: !allowCredit ? '#FEF3C7' : '#FFFFFF',
                    color: !allowCredit ? '#B45309' : '#6B7280'
                  }}
                >
                  <XCircle size={15} />
                  Cash Only (Full Pay Required)
                </button>
              </div>
            </div>
          </div>

          {/* Customer Action Buttons: Del, Large Save, Print */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', flexWrap: 'wrap', marginTop: '24px' }}>
            <button
              type="button"
              className="btn-customer-action-pill"
              onClick={handleDelete}
              disabled={!isEditing && !isViewing}
              style={{ opacity: (isEditing || isViewing) ? 1 : 0.5, cursor: (isEditing || isViewing) ? 'pointer' : 'not-allowed' }}
            >
              Del
            </button>

            <button
              type="submit"
              className="btn-customer-save"
              style={{ padding: '10px 48px', fontSize: '1.2rem', minWidth: '160px' }}
            >
              {isViewing ? 'Edit Party' : 'Save'}
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

      {/* Party Directory Register in the Downside (Always Visible) */}
      <div id="party-directory-register" style={{ marginTop: '28px', background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '20px', maxWidth: '960px', margin: '28px auto 0', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h4 style={{ fontWeight: 900, fontSize: '1.1rem', margin: 0 }}>Party Directory (Register & Ledger)</h4>
            <span style={{ fontSize: '0.8rem', background: '#E0E7FF', color: '#3730A3', padding: '2px 10px', borderRadius: '12px', fontWeight: 800 }}>
              {filteredParties.length} {filteredParties.length === 1 ? 'Party' : 'Parties'}
            </span>
          </div>
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
                <th>Type & Status</th>
                <th>Prop. Name</th>
                <th>Mobile</th>
                <th>CITY / State</th>
                <th style={{ textAlign: 'right' }}>Balance Due</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredParties.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF', fontWeight: 600 }}>
                    No parties found matching "{search}".
                  </td>
                </tr>
              ) : (
                filteredParties.map(p => {
                  const bal = db.getPartyBalanceSummary(p.id);
                  const isDealer = p.partyType === 'DEALER';
                  return (
                    <tr
                      key={p.id}
                      style={{
                        backgroundColor: selectedPartyId === p.id ? '#EFF6FF' : 'transparent',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleEditParty(p, true)}
                      onDoubleClick={() => handleEditParty(p, false)}
                      title="Single-click to View, Double-click to Edit"
                    >
                      <td style={{ fontWeight: 800 }}>
                        {p.name}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: isDealer ? '#F5F3FF' : '#EFF6FF',
                            color: isDealer ? '#6D28D9' : '#1D4ED8',
                            border: isDealer ? '1px solid #DDD6FE' : '1px solid #BFDBFE'
                          }}>
                            {isDealer
                              ? `Dealer (${p.dealerProfitPercent ?? 10}%)`
                              : (p.amateurProfitPercent !== undefined ? `Amateur (${p.amateurProfitPercent}%)` : 'Amateur')}
                          </span>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: p.isActive !== false ? '#DCFCE7' : '#FEE2E2',
                            color: p.isActive !== false ? '#15803D' : '#991B1B'
                          }}>
                            {p.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: p.allowCredit ? '#E0E7FF' : '#FEF3C7',
                            color: p.allowCredit ? '#3730A3' : '#92400E'
                          }}>
                            {p.allowCredit ? 'Credit OK' : 'Cash Only'}
                          </span>
                        </div>
                      </td>
                      <td>{p.propName || '-'}</td>
                      <td>{p.phone || '-'}</td>
                      <td>{[p.city, p.state].filter(Boolean).join(', ') || '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 900, color: bal.outstandingBalance > 0 ? '#DC2626' : '#16A34A' }}>
                        {bal.outstandingBalance > 0 ? `₹${bal.outstandingBalance}` : '₹0'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleEditParty(p, false);
                            }}
                            style={{
                              background: (selectedPartyId === p.id && !isViewOnly) ? '#BFDBFE' : '#E2D2F8',
                              color: (selectedPartyId === p.id && !isViewOnly) ? '#1E40AF' : '#EA3943',
                              border: '1px solid #C4B5FD',
                              borderRadius: '12px',
                              padding: '3px 10px',
                              fontWeight: 800,
                              fontSize: '0.78rem',
                              cursor: 'pointer'
                            }}
                          >
                            {(selectedPartyId === p.id && !isViewOnly) ? 'Editing' : 'Edit'}
                          </button>

                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setStatementParty(p);
                            }}
                            style={{
                              background: '#DCFCE7',
                              color: '#15803D',
                              border: '1px solid #86EFAC',
                              borderRadius: '12px',
                              padding: '3px 10px',
                              fontWeight: 800,
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <FileText size={12} />
                            Ledger
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CUSTOMER STATEMENT / LEDGER & CREDIT LOG MODAL */}
      {statementParty && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#FFFFFF',
            border: '2px solid #000000',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              background: '#D2BEF6',
              padding: '16px 20px',
              borderBottom: '2px solid #000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={22} color="#002B99" />
                <div>
                  <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem', color: '#002B99' }}>
                    Customer Statement & Credit Log: {statementParty.name}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#4B5563', fontWeight: 700 }}>
                    {statementParty.phone && `📞 ${statementParty.phone} | `}
                    {statementParty.city && `📍 ${statementParty.city} | `}
                    Status: {statementParty.isActive !== false ? 'Active' : 'Inactive'} |
                    Credit: {statementParty.allowCredit ? 'Allowed' : 'Cash Only'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setStatementParty(null); setShowPaymentForm(false); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '50%'
                }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '10px', padding: '12px 16px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748B' }}>Total Sales Billed</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#002B99' }}>₹{statementSummary.totalBilled}</div>
                </div>
                <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: '10px', padding: '12px 16px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#166534' }}>Total Payments Received</div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#16A34A' }}>₹{statementSummary.totalPaid}</div>
                </div>
                <div style={{
                  background: statementSummary.outstandingBalance > 0 ? '#FEF2F2' : '#F0FDF4',
                  border: statementSummary.outstandingBalance > 0 ? '1.5px solid #FECACA' : '1.5px solid #BBF7D0',
                  borderRadius: '10px',
                  padding: '12px 16px'
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: statementSummary.outstandingBalance > 0 ? '#991B1B' : '#166534' }}>
                    Outstanding Balance Due
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: statementSummary.outstandingBalance > 0 ? '#DC2626' : '#16A34A' }}>
                    ₹{statementSummary.outstandingBalance}
                  </div>
                </div>
              </div>

              {/* Payment Receipt Quick Record Strip */}
              <div style={{ background: '#F8FAFC', border: '1.5px dashed #CBD5E1', borderRadius: '10px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showPaymentForm ? '12px' : 0 }}>
                  <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#1E293B' }}>
                    Collect / Settle Outstanding Balance
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPaymentForm(!showPaymentForm)}
                    style={{
                      background: showPaymentForm ? '#E2E8F0' : '#DCFCE7',
                      color: showPaymentForm ? '#334155' : '#15803D',
                      border: '1px solid',
                      borderColor: showPaymentForm ? '#CBD5E1' : '#86EFAC',
                      borderRadius: '20px',
                      padding: '4px 14px',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {showPaymentForm ? 'Hide Form' : '+ Record Payment Receipt'}
                  </button>
                </div>

                {showPaymentForm && (
                  <form onSubmit={handleRecordPayment} style={{ display: 'grid', gridTemplateColumns: '120px 140px 150px 1fr auto', gap: '10px', alignItems: 'flex-end', paddingTop: '8px', borderTop: '1px dashed #E2E8F0' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '3px' }}>Amount (₹) *</label>
                      <input
                        type="number"
                        step="any"
                        required
                        className="input-text-clean"
                        value={paymentAmount}
                        onChange={e => setPaymentAmount(e.target.value)}
                        placeholder="e.g. 500"
                        style={{ fontWeight: 800, padding: '6px 8px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '3px' }}>Payment Mode</label>
                      <select
                        className="input-text-clean"
                        value={paymentMode}
                        onChange={e => setPaymentMode(e.target.value as any)}
                        style={{ fontWeight: 700, padding: '6px 8px', height: '35px' }}
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="COMBINED">Bank / Other</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '3px' }}>Ref / Cheque No.</label>
                      <input
                        type="text"
                        className="input-text-clean"
                        value={paymentRef}
                        onChange={e => setPaymentRef(e.target.value)}
                        placeholder="e.g. UPI-12345"
                        style={{ padding: '6px 8px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '3px' }}>Notes</label>
                      <input
                        type="text"
                        className="input-text-clean"
                        value={paymentNotes}
                        onChange={e => setPaymentNotes(e.target.value)}
                        placeholder="Remarks / details"
                        style={{ padding: '6px 8px' }}
                      />
                    </div>
                    <button
                      type="submit"
                      style={{
                        background: '#16A34A',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '8px 16px',
                        fontWeight: 900,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        height: '35px'
                      }}
                    >
                      Save Receipt
                    </button>
                  </form>
                )}
              </div>

              {/* Chronological Statement Table */}
              <div>
                <h4 style={{ fontWeight: 900, fontSize: '0.95rem', marginBottom: '8px', color: '#1E293B' }}>
                  Transaction History & Ledger Logs
                </h4>
                <div className="custom-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Ref / Bill No.</th>
                        <th style={{ textAlign: 'right' }}>Total Bill (Debit)</th>
                        <th style={{ textAlign: 'right' }}>Paid (Credit)</th>
                        <th style={{ textAlign: 'right' }}>Balance Change</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementLogs.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF', fontWeight: 600 }}>
                            No statement logs or transactions recorded yet for this party.
                          </td>
                        </tr>
                      ) : (
                        statementLogs.map(log => (
                          <tr key={log.id}>
                            <td>{formatDateToDisplay(log.date)}</td>
                            <td>
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: log.type === 'SALE' ? '#E0E7FF' : '#DCFCE7',
                                color: log.type === 'SALE' ? '#3730A3' : '#15803D'
                              }}>
                                {log.type === 'SALE' ? 'Sale Invoice' : 'Payment Received'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 800 }}>{log.refNo || '-'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              {log.totalAmount ? `₹${log.totalAmount}` : '-'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: '#16A34A' }}>
                              ₹{log.paidAmount || 0}
                            </td>
                            <td style={{
                              textAlign: 'right',
                              fontWeight: 900,
                              color: log.balanceChange > 0 ? '#DC2626' : log.balanceChange < 0 ? '#16A34A' : '#4B5563'
                            }}>
                              {log.balanceChange > 0 ? `+₹${log.balanceChange}` : log.balanceChange < 0 ? `-₹${Math.abs(log.balanceChange)}` : '₹0'}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: '#6B7280' }}>
                              {log.notes || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', background: '#F9FAFB' }}>
              <button
                type="button"
                onClick={() => { setStatementParty(null); setShowPaymentForm(false); }}
                style={{
                  background: '#E2E8F0',
                  color: '#1E293B',
                  border: '1px solid #CBD5E1',
                  borderRadius: '20px',
                  padding: '6px 20px',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
        message="Would you like to edit this party record?"
        confirmText="Yes, Edit"
        cancelText="No, Keep View Only"
      />

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
