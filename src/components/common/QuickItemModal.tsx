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
  const [unitABasicPrice, setUnitABasicPrice] = useState('1000');
  const [unitAGstPercent, setUnitAGstPercent] = useState('18');
  const [unitATranPercent, setUnitATranPercent] = useState('10');
  const [unitAProfPercent, setUnitAProfPercent] = useState('25');
  const [unitAMisPercent, setUnitAMisPercent] = useState('2');
  const [unitARoundUp, setUnitARoundUp] = useState('30');
  const [unitASalePrice, setUnitASalePrice] = useState('500');

  // Unit B
  const [hasUnitB, setHasUnitB] = useState(true);
  const [unitBName, setUnitBName] = useState('Mt.');
  const [unitBConversion, setUnitBConversion] = useState('40');
  const [unitBBasicPrice, setUnitBBasicPrice] = useState('1000');
  const [unitBGstPercent, setUnitBGstPercent] = useState('18');
  const [unitBTranPercent, setUnitBTranPercent] = useState('10');
  const [unitBProfPercent, setUnitBProfPercent] = useState('25');
  const [unitBMisPercent, setUnitBMisPercent] = useState('2');
  const [unitBRoundUp, setUnitBRoundUp] = useState('30');
  const [unitBSalePrice, setUnitBSalePrice] = useState('500');

  const [minStock, setMinStock] = useState('10');
  const [openingStock, setOpeningStock] = useState('0');

  // Auto initialize next SNO on open
  React.useEffect(() => {
    if (quickModal.isOpen && quickModal.type === 'ITEM') {
      setSno(StockEngine.getNextItemSno());
      setName('');
      setHsn('');
      setDescription('');
      if (suppliers.length > 0 && !supplierId) {
        setSupplierId(suppliers[0].id);
      }
    }
  }, [quickModal.isOpen, quickModal.type, suppliers]);

  // Live Unit A Calculation
  const unitABreakdown = useMemo(() => {
    return calculateItemUnitBreakdown(
      Number(unitABasicPrice),
      Number(unitAGstPercent),
      Number(unitATranPercent),
      Number(unitAProfPercent),
      Number(unitAMisPercent),
      Number(unitARoundUp)
    );
  }, [unitABasicPrice, unitAGstPercent, unitATranPercent, unitAProfPercent, unitAMisPercent, unitARoundUp]);

  // Live Unit B Calculation
  const unitBBreakdown = useMemo(() => {
    return calculateItemUnitBreakdown(
      Number(unitBBasicPrice),
      Number(unitBGstPercent),
      Number(unitBTranPercent),
      Number(unitBProfPercent),
      Number(unitBMisPercent),
      Number(unitBRoundUp)
    );
  }, [unitBBasicPrice, unitBGstPercent, unitBTranPercent, unitBProfPercent, unitBMisPercent, unitBRoundUp]);

  if (!quickModal.isOpen || quickModal.type !== 'ITEM') return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Item Name is required', 'error');
      return;
    }
    if (!sno.trim()) {
      showToast('S.No. / Item Code is required', 'error');
      return;
    }

    const existing = db.getItemBySno(sno.trim());
    if (existing) {
      showToast(`Item Code / S.No. "${sno}" already exists!`, 'error');
      return;
    }

    const supObj = suppliers.find(s => s.id === supplierId);

    const newItem: Item = {
      id: `item-${Date.now()}`,
      sno: sno.trim(),
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
      gstPercent: Number(unitAGstPercent) || 18,
      unitA: {
        unitName: unitAName.trim() || 'Roll',
        basicPrice: Number(unitABasicPrice) || 0,
        gstPercent: Number(unitAGstPercent) || 0,
        tranPercent: Number(unitATranPercent) || 0,
        profPercent: Number(unitAProfPercent) || 0,
        misPercent: Number(unitAMisPercent) || 0,
        nettPrice: unitABreakdown.nettPrice,
        roundUp: Number(unitARoundUp) || 0,
        salePrice: Number(unitASalePrice) || unitABreakdown.salePrice,
        isActive: true
      },
      unitB: hasUnitB ? {
        unitName: unitBName.trim() || 'Mt.',
        conversionFactor: Number(unitBConversion) || 1,
        basicPrice: Number(unitBBasicPrice) || 0,
        gstPercent: Number(unitBGstPercent) || 0,
        tranPercent: Number(unitBTranPercent) || 0,
        profPercent: Number(unitBProfPercent) || 0,
        misPercent: Number(unitBMisPercent) || 0,
        nettPrice: unitBBreakdown.nettPrice,
        roundUp: Number(unitBRoundUp) || 0,
        salePrice: Number(unitBSalePrice) || unitBBreakdown.salePrice,
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

  return (
    <Modal isOpen={quickModal.isOpen} onClose={closeQuickModal} title="Quick Create Item" maxWidth="750px">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.85rem', marginBottom: '3px' }}>
              S.No. / Code *
            </label>
            <input
              type="text"
              className="input-text-clean"
              value={sno}
              onChange={e => setSno(e.target.value)}
              placeholder="e.g. 1463"
              required
            />
          </div>
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
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center' }}>
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
              <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>TRAN%</label>
              <input type="number" className="input-text-clean" value={unitATranPercent} onChange={e => setUnitATranPercent(e.target.value)} style={{ textAlign: 'center' }} />
              <div className="subtext-calc-red">{unitABreakdown.tranAmt}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>Prof%</label>
              <input type="number" className="input-text-clean" value={unitAProfPercent} onChange={e => setUnitAProfPercent(e.target.value)} style={{ textAlign: 'center' }} />
              <div className="subtext-calc-red">{unitABreakdown.profAmt}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>Mis.%</label>
              <input type="number" className="input-text-clean" value={unitAMisPercent} onChange={e => setUnitAMisPercent(e.target.value)} style={{ textAlign: 'center' }} />
              <div className="subtext-calc-red">{unitABreakdown.misAmt}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>ROUND UP</label>
              <input type="number" className="input-text-clean" value={unitARoundUp} onChange={e => setUnitARoundUp(e.target.value)} style={{ textAlign: 'center' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>Sale Price</label>
              <input type="number" className="input-text-clean" value={unitASalePrice} onChange={e => setUnitASalePrice(e.target.value)} style={{ textAlign: 'center', fontWeight: 800, color: '#002B99' }} />
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center' }}>
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
              <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>TRAN%</label>
              <input type="number" className="input-text-clean" value={unitBTranPercent} onChange={e => setUnitBTranPercent(e.target.value)} style={{ textAlign: 'center' }} />
              <div className="subtext-calc-red">{unitBBreakdown.tranAmt}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>Prof%</label>
              <input type="number" className="input-text-clean" value={unitBProfPercent} onChange={e => setUnitBProfPercent(e.target.value)} style={{ textAlign: 'center' }} />
              <div className="subtext-calc-red">{unitBBreakdown.profAmt}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>Mis.%</label>
              <input type="number" className="input-text-clean" value={unitBMisPercent} onChange={e => setUnitBMisPercent(e.target.value)} style={{ textAlign: 'center' }} />
              <div className="subtext-calc-red">{unitBBreakdown.misAmt}</div>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>ROUND UP</label>
              <input type="number" className="input-text-clean" value={unitBRoundUp} onChange={e => setUnitBRoundUp(e.target.value)} style={{ textAlign: 'center' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 800 }}>Sale Price</label>
              <input type="number" className="input-text-clean" value={unitBSalePrice} onChange={e => setUnitBSalePrice(e.target.value)} style={{ textAlign: 'center', fontWeight: 800, color: '#002B99' }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
