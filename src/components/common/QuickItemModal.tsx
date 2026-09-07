import React, { useState, useMemo } from 'react';
import { Modal } from './Modal';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { Item, Supplier } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { calculateItemUnitBreakdown } from '../../utils/calculations';

export const QuickItemModal: React.FC = () => {
  const { quickModal, closeQuickModal, showToast, refreshKey } = useApp();
  const suppliers = useMemo(() => db.getSuppliers().filter(s => s.isActive !== false), [refreshKey]);

  const [sno, setSno] = useState('');
  const [name, setName] = useState('');
  const [hsn, setHsn] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Raw Material');
  const [supplierId, setSupplierId] = useState('');

  // Unit A
  const [unitAName, setUnitAName] = useState('Roll');
  const [unitABasicPrice, setUnitABasicPrice] = useState('0');
  const [unitAGstPercent, setUnitAGstPercent] = useState('0');
  const [unitATranPercent, setUnitATranPercent] = useState('0');
  const [unitAProfAm, setUnitAProfAm] = useState('0');
  const [unitAProfDeal, setUnitAProfDeal] = useState('0');
  const [unitAMisPercent, setUnitAMisPercent] = useState('0');
  const [unitARoundUpSale, setUnitARoundUpSale] = useState('0');
  const [unitARoundUpMrp, setUnitARoundUpMrp] = useState('0');
  const [unitASalePrice, setUnitASalePrice] = useState('0');
  const [unitAMrp, setUnitAMrp] = useState('0');

  // Unit B
  const [hasUnitB, setHasUnitB] = useState(true);
  const [unitBName, setUnitBName] = useState('Mt.');
  const [unitBConversion, setUnitBConversion] = useState('40');
  const [unitBBasicPrice, setUnitBBasicPrice] = useState('0');
  const [unitBGstPercent, setUnitBGstPercent] = useState('0');
  const [unitBTranPercent, setUnitBTranPercent] = useState('0');
  const [unitBProfAm, setUnitBProfAm] = useState('0');
  const [unitBProfDeal, setUnitBProfDeal] = useState('0');
  const [unitBMisPercent, setUnitBMisPercent] = useState('0');
  const [unitBRoundUpSale, setUnitBRoundUpSale] = useState('0');
  const [unitBRoundUpMrp, setUnitBRoundUpMrp] = useState('0');
  const [unitBSalePrice, setUnitBSalePrice] = useState('0');
  const [unitBMrp, setUnitBMrp] = useState('0');

  const [minStock, setMinStock] = useState('0');
  const [openingStock, setOpeningStock] = useState('0');

  // Auto initialize next SNO on open
  React.useEffect(() => {
    if (quickModal.isOpen && quickModal.type === 'ITEM') {
      setSno(StockEngine.getNextItemSno());
      setName('');
      setHsn('');
      setDescription('');
      setUnitABasicPrice('0');
      setUnitAGstPercent('0');
      setUnitATranPercent('0');
      setUnitAProfAm('0');
      setUnitAProfDeal('0');
      setUnitAMisPercent('0');
      setUnitARoundUpSale('0');
      setUnitARoundUpMrp('0');
      setUnitBBasicPrice('0');
      setUnitBGstPercent('0');
      setUnitBTranPercent('0');
      setUnitBProfAm('0');
      setUnitBProfDeal('0');
      setUnitBMisPercent('0');
      setUnitBRoundUpSale('0');
      setUnitBRoundUpMrp('0');
      setMinStock('0');
      setOpeningStock('0');
      if (suppliers.length > 0 && !supplierId) {
        setSupplierId(suppliers[0].id);
      }
    }
  }, [quickModal.isOpen, quickModal.type, suppliers]);

  // Live Unit A Calculation
  const unitABreakdown = useMemo(() => {
    return calculateItemUnitBreakdown(
      Number(unitABasicPrice) || 0,
      Number(unitAGstPercent) || 0,
      Number(unitATranPercent) || 0,
      Number(unitAProfAm) || 0,
      Number(unitAMisPercent) || 0,
      Number(unitARoundUpSale) || 0,
      undefined,
      Number(unitAProfDeal) || 0,
      Number(unitARoundUpMrp) || 0
    );
  }, [unitABasicPrice, unitAGstPercent, unitATranPercent, unitAProfAm, unitAProfDeal, unitAMisPercent, unitARoundUpSale, unitARoundUpMrp]);

  // Live Unit B Calculation
  const unitBBreakdown = useMemo(() => {
    return calculateItemUnitBreakdown(
      Number(unitBBasicPrice) || 0,
      Number(unitBGstPercent) || 0,
      Number(unitBTranPercent) || 0,
      Number(unitBProfAm) || 0,
      Number(unitBMisPercent) || 0,
      Number(unitBRoundUpSale) || 0,
      undefined,
      Number(unitBProfDeal) || 0,
      Number(unitBRoundUpMrp) || 0
    );
  }, [unitBBasicPrice, unitBGstPercent, unitBTranPercent, unitBProfAm, unitBProfDeal, unitBMisPercent, unitBRoundUpSale, unitBRoundUpMrp]);

  if (!quickModal.isOpen || quickModal.type !== 'ITEM') return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Item Name is required', 'error');
      return;
    }

    const finalSno = sno.trim() || StockEngine.getNextItemSno();
    const supObj = suppliers.find(s => s.id === supplierId);

    const newItem: Item = {
      id: `item-${Date.now()}`,
      sno: finalSno,
      name: name.trim().toUpperCase(),
      hsn: hsn.trim(),
      description: description.trim(),
      category: category.trim(),
      supplierId: supplierId || undefined,
      supplierName: supObj?.name,
      unit: unitAName.trim() || 'Pcs',
      minStock: Number(minStock) || 0,
      openingStock: Number(openingStock) || 0,
      purchaseRate: Number(unitABasicPrice) || 0,
      saleRate: Number(unitASalePrice) || unitABreakdown.salePrice,
      mrp: Number(unitAMrp) || unitABreakdown.mrp,
      gstPercent: Number(unitAGstPercent) || 18,
      roundUp: Number(unitARoundUpSale) || 0,
      roundUpSale: Number(unitARoundUpSale) || 0,
      roundUpMrp: Number(unitARoundUpMrp) || 0,
      profPercentAm: Number(unitAProfAm) || 0,
      profPercentDeal: Number(unitAProfDeal) || 0,
      unitA: {
        unitName: unitAName.trim() || 'Roll',
        basicPrice: Number(unitABasicPrice) || 0,
        gstPercent: Number(unitAGstPercent) || 0,
        tranPercent: Number(unitATranPercent) || 0,
        profPercent: Number(unitAProfDeal) || 0,
        profPercentAm: Number(unitAProfAm) || 0,
        profPercentDeal: Number(unitAProfDeal) || 0,
        misPercent: Number(unitAMisPercent) || 0,
        nettPrice: unitABreakdown.nettPrice,
        roundUp: Number(unitARoundUpSale) || 0,
        roundUpSale: Number(unitARoundUpSale) || 0,
        roundUpMrp: Number(unitARoundUpMrp) || 0,
        salePrice: Number(unitASalePrice) || unitABreakdown.salePrice,
        mrp: Number(unitAMrp) || unitABreakdown.mrp,
        isActive: true
      },
      unitB: hasUnitB ? {
        unitName: unitBName.trim() || 'Mt.',
        conversionFactor: Number(unitBConversion) || 1,
        basicPrice: Number(unitBBasicPrice) || 0,
        gstPercent: Number(unitBGstPercent) || 0,
        tranPercent: Number(unitBTranPercent) || 0,
        profPercent: Number(unitBProfDeal) || 0,
        profPercentAm: Number(unitBProfAm) || 0,
        profPercentDeal: Number(unitBProfDeal) || 0,
        misPercent: Number(unitBMisPercent) || 0,
        nettPrice: unitBBreakdown.nettPrice,
        roundUp: Number(unitBRoundUpSale) || 0,
        roundUpSale: Number(unitBRoundUpSale) || 0,
        roundUpMrp: Number(unitBRoundUpMrp) || 0,
        salePrice: Number(unitBSalePrice) || unitBBreakdown.salePrice,
        mrp: Number(unitBMrp) || unitBBreakdown.mrp,
        isActive: true
      } : undefined,
      isActive: true,
      createdAt: new Date().toISOString().split('T')[0]
    };

    db.saveItem(newItem);
    showToast(`Item "${newItem.name}" added successfully!`, 'success');
    if (quickModal.onSuccess) {
      quickModal.onSuccess(newItem.id, newItem.name);
    }
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
    <Modal isOpen={quickModal.isOpen} onClose={closeQuickModal} title="Quick Create Item" maxWidth="880px">
      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
            Item Name *
          </label>
          <input
            type="text"
            className="input-text-clean"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. ASTER - 12X36"
            autoFocus
            required
            style={{ fontWeight: 700 }}
          />
        </div>

        <div className="form-grid-3col">
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
              HSN Code
            </label>
            <input
              type="text"
              className="input-text-clean"
              value={hsn}
              onChange={e => setHsn(e.target.value)}
              placeholder="e.g. 4802"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
              Description
            </label>
            <input
              type="text"
              className="input-text-clean"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Glossy Sheets"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
              Category
            </label>
            <input
              type="text"
              className="input-text-clean"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Paper & Sheets"
            />
          </div>
        </div>

        {/* Supplier Selector with Quick Pills */}
        <div>
          <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
            Supplier
          </label>
          <select
            className="input-text-clean"
            value={supplierId}
            onChange={e => setSupplierId(e.target.value)}
          >
            <option value="">-- Select Supplier --</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            {suppliers.map(s => (
              <button
                key={s.id}
                type="button"
                className={`supplier-chip-btn ${supplierId === s.id ? 'active' : ''}`}
                onClick={() => setSupplierId(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* UNIT-A */}
        <div style={{ background: '#F9FAFB', border: '1px solid #000000', borderRadius: '6px', padding: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontWeight: 900, fontSize: '0.9rem' }}>UNIT-A:</span>
            <input
              type="text"
              className="input-text-clean"
              value={unitAName}
              onChange={e => setUnitAName(e.target.value)}
              style={{ width: '90px', color: '#EA3943', fontWeight: 800, textAlign: 'center' }}
              placeholder="e.g. Roll"
            />
          </div>
          <div className="pricing-calc-scroll-wrapper">
            <div className="pricing-calc-grid-10" style={{ minWidth: '680px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>Besic Price</label>
                <input type="number" className="input-text-clean" value={unitABasicPrice} onChange={e => setUnitABasicPrice(e.target.value)} style={{ textAlign: 'center' }} />
                <div className="subtext-calc-red">{unitABreakdown.basicPrice}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>GST %</label>
                <input type="number" className="input-text-clean" value={unitAGstPercent} onChange={e => setUnitAGstPercent(e.target.value)} style={{ textAlign: 'center' }} />
                <div className="subtext-calc-red">{unitABreakdown.gstAmt}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>tran%</label>
                <input type="number" className="input-text-clean" value={unitATranPercent} onChange={e => setUnitATranPercent(e.target.value)} style={{ textAlign: 'center' }} />
                <div className="subtext-calc-red">{unitABreakdown.tranAmt}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>mis%</label>
                <input type="number" className="input-text-clean" value={unitAMisPercent} onChange={e => setUnitAMisPercent(e.target.value)} style={{ textAlign: 'center' }} />
                <div className="subtext-calc-red">{unitABreakdown.misAmt}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6D28D9' }}>Prof% -S</label>
                <input type="number" className="input-text-clean" value={unitAProfDeal} onChange={e => setUnitAProfDeal(e.target.value)} style={{ textAlign: 'center', borderColor: '#8B5CF6' }} />
                <div className="subtext-calc-red">{unitABreakdown.profDealAmt}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6D28D9' }}>Round-S</label>
                <input type="number" className="input-text-clean" value={unitARoundUpSale} onChange={e => setUnitARoundUpSale(e.target.value)} style={{ textAlign: 'center', borderColor: '#8B5CF6' }} />
                <div className="subtext-calc-red">{unitABreakdown.roundUpSale}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6D28D9' }}>Sale Price</label>
                <input type="number" step="any" className="input-text-clean" value={unitABreakdown.salePrice} readOnly style={{ textAlign: 'center', fontWeight: 900, color: '#6D28D9', background: '#F5F3FF', cursor: 'default' }} />
                <div className="subtext-calc-red">{unitABreakdown.salePrice}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1E40AF' }}>Prof% -M</label>
                <input type="number" className="input-text-clean" value={unitAProfAm} onChange={e => setUnitAProfAm(e.target.value)} style={{ textAlign: 'center', borderColor: '#3B82F6' }} />
                <div className="subtext-calc-red">{unitABreakdown.profAmAmt}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1E40AF' }}>Round-M</label>
                <input type="number" className="input-text-clean" value={unitARoundUpMrp} onChange={e => setUnitARoundUpMrp(e.target.value)} style={{ textAlign: 'center', borderColor: '#3B82F6' }} />
                <div className="subtext-calc-red">{unitABreakdown.roundUpMrp}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1E40AF' }}>mrp</label>
                <input type="number" step="any" className="input-text-clean" value={unitABreakdown.mrp} readOnly style={{ textAlign: 'center', fontWeight: 900, color: '#1E40AF', background: '#EFF6FF', cursor: 'default' }} />
                <div className="subtext-calc-red">{unitABreakdown.mrp}</div>
              </div>
            </div>
          </div>
        </div>

        {/* UNIT-B */}
        <div style={{ background: '#F9FAFB', border: '1px solid #000000', borderRadius: '6px', padding: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 900, fontSize: '0.9rem' }}>UNIT-B:</span>
            <input
              type="text"
              className="input-text-clean"
              value={unitBName}
              onChange={e => setUnitBName(e.target.value)}
              style={{ width: '90px', color: '#EA3943', fontWeight: 800, textAlign: 'center' }}
              placeholder="e.g. Mt."
            />
            <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>1 {unitAName || 'Unit A'} =</span>
            <input
              type="number"
              className="input-text-clean"
              value={unitBConversion}
              onChange={e => setUnitBConversion(e.target.value)}
              style={{ width: '70px', textAlign: 'center', fontWeight: 800 }}
            />
            <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{unitBName || 'Unit B'}</span>
          </div>
          <div className="pricing-calc-scroll-wrapper">
            <div className="pricing-calc-grid-10" style={{ minWidth: '680px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>Besic Price</label>
                <input type="number" className="input-text-clean" value={unitBBasicPrice} onChange={e => setUnitBBasicPrice(e.target.value)} style={{ textAlign: 'center' }} />
                <div className="subtext-calc-red">{unitBBreakdown.basicPrice}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>GST %</label>
                <input type="number" className="input-text-clean" value={unitBGstPercent} onChange={e => setUnitBGstPercent(e.target.value)} style={{ textAlign: 'center' }} />
                <div className="subtext-calc-red">{unitBBreakdown.gstAmt}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>tran%</label>
                <input type="number" className="input-text-clean" value={unitBTranPercent} onChange={e => setUnitBTranPercent(e.target.value)} style={{ textAlign: 'center' }} />
                <div className="subtext-calc-red">{unitBBreakdown.tranAmt}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>mis%</label>
                <input type="number" className="input-text-clean" value={unitBMisPercent} onChange={e => setUnitBMisPercent(e.target.value)} style={{ textAlign: 'center' }} />
                <div className="subtext-calc-red">{unitBBreakdown.misAmt}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6D28D9' }}>Prof% -S</label>
                <input type="number" className="input-text-clean" value={unitBProfDeal} onChange={e => setUnitBProfDeal(e.target.value)} style={{ textAlign: 'center', borderColor: '#8B5CF6' }} />
                <div className="subtext-calc-red">{unitBBreakdown.profDealAmt}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6D28D9' }}>Round-S</label>
                <input type="number" className="input-text-clean" value={unitBRoundUpSale} onChange={e => setUnitBRoundUpSale(e.target.value)} style={{ textAlign: 'center', borderColor: '#8B5CF6' }} />
                <div className="subtext-calc-red">{unitBBreakdown.roundUpSale}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6D28D9' }}>Sale Price</label>
                <input type="number" step="any" className="input-text-clean" value={unitBBreakdown.salePrice} readOnly style={{ textAlign: 'center', fontWeight: 900, color: '#6D28D9', background: '#F5F3FF', cursor: 'default' }} />
                <div className="subtext-calc-red">{unitBBreakdown.salePrice}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1E40AF' }}>Prof% -M</label>
                <input type="number" className="input-text-clean" value={unitBProfAm} onChange={e => setUnitBProfAm(e.target.value)} style={{ textAlign: 'center', borderColor: '#3B82F6' }} />
                <div className="subtext-calc-red">{unitBBreakdown.profAmAmt}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1E40AF' }}>Round-M</label>
                <input type="number" className="input-text-clean" value={unitBRoundUpMrp} onChange={e => setUnitBRoundUpMrp(e.target.value)} style={{ textAlign: 'center', borderColor: '#3B82F6' }} />
                <div className="subtext-calc-red">{unitBBreakdown.roundUpMrp}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1E40AF' }}>mrp</label>
                <input type="number" step="any" className="input-text-clean" value={unitBBreakdown.mrp} readOnly style={{ textAlign: 'center', fontWeight: 900, color: '#1E40AF', background: '#EFF6FF', cursor: 'default' }} />
                <div className="subtext-calc-red">{unitBBreakdown.mrp}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="form-grid-2col">
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
              Min Stock (Reorder Level)
            </label>
            <input
              type="number"
              min="0"
              className="input-text-clean"
              value={minStock}
              onChange={e => setMinStock(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
              Opening Stock
            </label>
            <input
              type="number"
              min="0"
              className="input-text-clean"
              value={openingStock}
              onChange={e => setOpeningStock(e.target.value)}
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
