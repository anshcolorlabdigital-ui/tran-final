import React, { useState, useMemo } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Item, Supplier } from '../../types';
import { StockEngine } from '../../db/stockEngine';
import { Search } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { calculateItemUnitBreakdown } from '../../utils/calculations';

export const ItemMasterView: React.FC = () => {
  const { refreshKey, showToast } = useApp();
  const { hasPermission } = useAuth();

  const items = useMemo(() => db.getItems(), [refreshKey]);
  const suppliers = useMemo(() => db.getSuppliers().filter(s => s.isActive !== false), [refreshKey]);
  const stockSummaries = useMemo(() => StockEngine.getAllItemsStockSummary(), [refreshKey]);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(items[0]?.id || null);
  const [search, setSearch] = useState('');
  const [showDirectory, setShowDirectory] = useState(false);

  // Form Fields matching customer screenshot item.jpg
  const [sno, setSno] = useState(items[0]?.sno || '1456');
  const [name, setName] = useState(items[0]?.name || 'ASTER - 12X36');
  const [hsn, setHsn] = useState(items[0]?.hsn || '4802');
  const [description, setDescription] = useState(items[0]?.description || 'High Quality Glossy Aster Sheets');
  const [category, setCategory] = useState(items[0]?.category || 'Paper & Sheets');
  const [supplierId, setSupplierId] = useState(items[0]?.supplierId || suppliers[0]?.id || '');
  const [isActive, setIsActive] = useState(items[0]?.isActive !== false);

  // Unit A State
  const [unitAName, setUnitAName] = useState(items[0]?.unitA?.unitName || 'Roll');
  const [unitABasicPrice, setUnitABasicPrice] = useState(String(items[0]?.unitA?.basicPrice ?? 1000));
  const [unitAGstPercent, setUnitAGstPercent] = useState(String(items[0]?.unitA?.gstPercent ?? 18));
  const [unitATranPercent, setUnitATranPercent] = useState(String(items[0]?.unitA?.tranPercent ?? 10));
  const [unitAProfPercent, setUnitAProfPercent] = useState(String(items[0]?.unitA?.profPercent ?? 25));
  const [unitAMisPercent, setUnitAMisPercent] = useState(String(items[0]?.unitA?.misPercent ?? 2));
  const [unitARoundUp, setUnitARoundUp] = useState(String(items[0]?.unitA?.roundUp ?? 30));
  const [unitASalePrice, setUnitASalePrice] = useState(String(items[0]?.unitA?.salePrice ?? 500));
  const [unitAActive, setUnitAActive] = useState(items[0]?.unitA?.isActive !== false);

  // Unit B State
  const [unitBName, setUnitBName] = useState(items[0]?.unitB?.unitName || 'Mt.');
  const [unitBConversion, setUnitBConversion] = useState(String(items[0]?.unitB?.conversionFactor ?? 40));
  const [unitBBasicPrice, setUnitBBasicPrice] = useState(String(items[0]?.unitB?.basicPrice ?? 1000));
  const [unitBGstPercent, setUnitBGstPercent] = useState(String(items[0]?.unitB?.gstPercent ?? 18));
  const [unitBTranPercent, setUnitBTranPercent] = useState(String(items[0]?.unitB?.tranPercent ?? 10));
  const [unitBProfPercent, setUnitBProfPercent] = useState(String(items[0]?.unitB?.profPercent ?? 25));
  const [unitBMisPercent, setUnitBMisPercent] = useState(String(items[0]?.unitB?.misPercent ?? 2));
  const [unitBRoundUp, setUnitBRoundUp] = useState(String(items[0]?.unitB?.roundUp ?? 30));
  const [unitBSalePrice, setUnitBSalePrice] = useState(String(items[0]?.unitB?.salePrice ?? 500));
  const [unitBActive, setUnitBActive] = useState(items[0]?.unitB?.isActive !== false);

  const [minStock, setMinStock] = useState(String(items[0]?.minStock ?? 100));
  const [openingStock, setOpeningStock] = useState(String(items[0]?.openingStock ?? 50));

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

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: '',
    name: ''
  });

  const loadItemIntoForm = (item: Item) => {
    setSelectedItemId(item.id);
    setSno(item.sno);
    setName(item.name);
    setHsn(item.hsn || '');
    setDescription(item.description || '');
    setCategory(item.category || '');
    setSupplierId(item.supplierId || '');
    setIsActive(item.isActive !== false);

    // Unit A
    if (item.unitA) {
      setUnitAName(item.unitA.unitName || 'Roll');
      setUnitABasicPrice(String(item.unitA.basicPrice ?? 0));
      setUnitAGstPercent(String(item.unitA.gstPercent ?? 18));
      setUnitATranPercent(String(item.unitA.tranPercent ?? 10));
      setUnitAProfPercent(String(item.unitA.profPercent ?? 25));
      setUnitAMisPercent(String(item.unitA.misPercent ?? 2));
      setUnitARoundUp(String(item.unitA.roundUp ?? 0));
      setUnitASalePrice(String(item.unitA.salePrice ?? 0));
      setUnitAActive(item.unitA.isActive !== false);
    } else {
      setUnitAName(item.unit || 'Roll');
      setUnitABasicPrice(String(item.purchaseRate || 0));
      setUnitAGstPercent(String(item.gstPercent || 18));
      setUnitATranPercent('10');
      setUnitAProfPercent('25');
      setUnitAMisPercent('2');
      setUnitARoundUp('0');
      setUnitASalePrice(String(item.saleRate || 0));
      setUnitAActive(true);
    }

    // Unit B
    if (item.unitB) {
      setUnitBName(item.unitB.unitName || 'Mt.');
      setUnitBConversion(String(item.unitB.conversionFactor ?? 40));
      setUnitBBasicPrice(String(item.unitB.basicPrice ?? 0));
      setUnitBGstPercent(String(item.unitB.gstPercent ?? 18));
      setUnitBTranPercent(String(item.unitB.tranPercent ?? 10));
      setUnitBProfPercent(String(item.unitB.profPercent ?? 25));
      setUnitBMisPercent(String(item.unitB.misPercent ?? 2));
      setUnitBRoundUp(String(item.unitB.roundUp ?? 0));
      setUnitBSalePrice(String(item.unitB.salePrice ?? 0));
      setUnitBActive(item.unitB.isActive !== false);
    } else {
      setUnitBName('Mt.');
      setUnitBConversion('40');
      setUnitBBasicPrice(String(item.purchaseRate || 0));
      setUnitBGstPercent(String(item.gstPercent || 18));
      setUnitBTranPercent('10');
      setUnitBProfPercent('25');
      setUnitBMisPercent('2');
      setUnitBRoundUp('0');
      setUnitBSalePrice(String(item.saleRate || 0));
      setUnitBActive(true);
    }

    setMinStock(String(item.minStock || 0));
    setOpeningStock(String(item.openingStock || 0));
  };

  const handleCreateNew = () => {
    setSelectedItemId(null);
    setSno(StockEngine.getNextItemSno());
    setName('');
    setHsn('');
    setDescription('');
    setCategory('Paper & Sheets');
    if (suppliers.length > 0) setSupplierId(suppliers[0].id);
    setIsActive(true);

    setUnitAName('Roll');
    setUnitABasicPrice('1000');
    setUnitAGstPercent('18');
    setUnitATranPercent('10');
    setUnitAProfPercent('25');
    setUnitAMisPercent('2');
    setUnitARoundUp('30');
    setUnitASalePrice('500');
    setUnitAActive(true);

    setUnitBName('Mt.');
    setUnitBConversion('40');
    setUnitBBasicPrice('1000');
    setUnitBGstPercent('18');
    setUnitBTranPercent('10');
    setUnitBProfPercent('25');
    setUnitBMisPercent('2');
    setUnitBRoundUp('30');
    setUnitBSalePrice('500');
    setUnitBActive(true);

    setMinStock('10');
    setOpeningStock('0');
    showToast('Ready to create new item', 'info');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sno.trim()) {
      showToast('S.No. / Item Code is required', 'error');
      return;
    }
    if (!name.trim()) {
      showToast('Item Name is required', 'error');
      return;
    }

    const existing = db.getItemBySno(sno.trim());
    if (existing && existing.id !== selectedItemId) {
      showToast(`Item Code / S.No. "${sno}" is already used by "${existing.name}"`, 'error');
      return;
    }

    const supObj = suppliers.find(s => s.id === supplierId);

    const itemRecord: Item = {
      id: selectedItemId || `item-${Date.now()}`,
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
        isActive: unitAActive
      },
      unitB: {
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
        isActive: unitBActive
      },
      isActive,
      createdAt: new Date().toISOString()
    };

    db.saveItem(itemRecord);
    setSelectedItemId(itemRecord.id);
    showToast(`Item "${itemRecord.name}" saved successfully!`, 'success');
  };

  const handleDelete = () => {
    if (!selectedItemId) {
      showToast('Please select an item to delete', 'error');
      return;
    }
    if (!hasPermission('MANAGE_MASTERS')) {
      showToast('You do not have permission to delete items', 'error');
      return;
    }
    setDeleteDialog({ isOpen: true, id: selectedItemId, name });
  };

  const confirmDelete = () => {
    if (deleteDialog.id) {
      db.deleteItem(deleteDialog.id);
      showToast(`Item "${deleteDialog.name}" deleted from master.`, 'info');
      setDeleteDialog({ isOpen: false, id: '', name: '' });
      handleCreateNew();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredSummaries = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return stockSummaries;
    return stockSummaries.filter(
      s =>
        s.item.name.toLowerCase().includes(q) ||
        s.item.sno.toLowerCase().includes(q) ||
        (s.item.category && s.item.category.toLowerCase().includes(q)) ||
        (s.item.supplierName && s.item.supplierName.toLowerCase().includes(q))
    );
  }, [stockSummaries, search]);

  return (
    <div className="content-panel-grey">
      {/* Top Header Strip matching item.jpg */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div className="pill-header-lavender" style={{ fontSize: '1.25rem', padding: '8px 48px', minWidth: '160px', textAlign: 'center' }}>
          ITEM
        </div>

        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', padding: '6px 14px', borderRadius: '20px', border: '1px solid #D1D5DB' }}>
            <input
              type="checkbox"
              id="activeItemCheckbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="activeItemCheckbox" style={{ fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer' }}>
              Active
            </label>
          </div>

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
            {showDirectory ? 'Hide Items Table' : `Stock List (${items.length})`}
          </button>

          <button
            type="button"
            onClick={handleCreateNew}
            className="btn-customer-new-entry"
            style={{ fontSize: '0.95rem', padding: '8px 24px' }}
          >
            CREATE ITEM
          </button>
        </div>
      </div>

      {/* Main White Form Container matching item.jpg */}
      <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '14px', padding: '28px', maxWidth: '980px', margin: '0 auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Top Fields Grid: Item, Hsn, Description, Category, Supplier */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.92rem', marginBottom: '4px' }}>
                Item Name *
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. ASTER - 12X36"
                required
                style={{ fontWeight: 800 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.92rem', marginBottom: '4px' }}>
                Hsn
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={hsn}
                onChange={e => setHsn(e.target.value)}
                placeholder="e.g. 4802"
                style={{ fontFamily: 'monospace' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.92rem', marginBottom: '4px' }}>
                Description
              </label>
              <input
                type="text"
                className="input-text-clean"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. High Quality Glossy Aster Sheets"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.92rem', marginBottom: '4px' }}>
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

          {/* Supplier Selector with Quick Pills (KONARK, VMS, PAYAL, DELTA) */}
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.92rem', marginBottom: '4px' }}>
              Supplier
            </label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <select
                className="input-text-clean"
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                style={{ flex: 1, fontWeight: 700 }}
              >
                <option value="">-- Select Supplier --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              {/* Quick Clickable Supplier Pills from Screenshot */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {suppliers.slice(0, 5).map(s => (
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
          </div>

          {/* UNIT-A SECTION matching item.jpg */}
          <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '14px', marginTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 900, fontSize: '1rem', color: '#000000' }}>UNIT-A :</span>
                <input
                  type="text"
                  className="input-text-clean"
                  value={unitAName}
                  onChange={e => setUnitAName(e.target.value)}
                  style={{ width: '100px', color: '#EA3943', fontWeight: 900, textAlign: 'center', fontSize: '0.95rem' }}
                  placeholder="e.g. Roll"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="checkbox"
                  id="unitAActiveCheck"
                  checked={unitAActive}
                  onChange={e => setUnitAActive(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="unitAActiveCheck" style={{ fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
                  Active
                </label>
              </div>
            </div>

            {/* Pricing Grid with Red Calculation Subtexts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', textAlign: 'center' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Besic Price</label>
                <input
                  type="number"
                  className="input-text-clean"
                  value={unitABasicPrice}
                  onChange={e => setUnitABasicPrice(e.target.value)}
                  style={{ textAlign: 'center', fontWeight: 700 }}
                />
                <div className="subtext-calc-red">{unitABreakdown.basicPrice}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>GST %</label>
                <input
                  type="number"
                  className="input-text-clean"
                  value={unitAGstPercent}
                  onChange={e => setUnitAGstPercent(e.target.value)}
                  style={{ textAlign: 'center', fontWeight: 700 }}
                />
                <div className="subtext-calc-red">{unitABreakdown.gstAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>TRAN%</label>
                <input
                  type="number"
                  className="input-text-clean"
                  value={unitATranPercent}
                  onChange={e => setUnitATranPercent(e.target.value)}
                  style={{ textAlign: 'center', fontWeight: 700 }}
                />
                <div className="subtext-calc-red">{unitABreakdown.tranAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Prof%</label>
                <input
                  type="number"
                  className="input-text-clean"
                  value={unitAProfPercent}
                  onChange={e => setUnitAProfPercent(e.target.value)}
                  style={{ textAlign: 'center', fontWeight: 700 }}
                />
                <div className="subtext-calc-red">{unitABreakdown.profAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Mis.%</label>
                <input
                  type="number"
                  className="input-text-clean"
                  value={unitAMisPercent}
                  onChange={e => setUnitAMisPercent(e.target.value)}
                  style={{ textAlign: 'center', fontWeight: 700 }}
                />
                <div className="subtext-calc-red">{unitABreakdown.misAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>ROUND UP</label>
                <input
                  type="number"
                  className="input-text-clean"
                  value={unitARoundUp}
                  onChange={e => setUnitARoundUp(e.target.value)}
                  style={{ textAlign: 'center', fontWeight: 700 }}
                />
                <div className="subtext-calc-red" style={{ visibility: 'hidden' }}>0</div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Sale Price</label>
                <input
                  type="number"
                  className="input-text-clean"
                  value={unitASalePrice}
                  onChange={e => setUnitASalePrice(e.target.value)}
                  style={{ textAlign: 'center', fontWeight: 900, color: '#002B99', fontSize: '0.95rem' }}
                />
                <div className="subtext-calc-red" style={{ visibility: 'hidden' }}>0</div>
              </div>
            </div>
          </div>

          {/* UNIT-B SECTION matching item.jpg */}
          <div style={{ background: '#FFFFFF', border: '1.5px solid #000000', borderRadius: '8px', padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 900, fontSize: '1rem', color: '#000000' }}>UNIT-B :</span>
                <input
                  type="text"
                  className="input-text-clean"
                  value={unitBName}
                  onChange={e => setUnitBName(e.target.value)}
                  style={{ width: '100px', color: '#EA3943', fontWeight: 900, textAlign: 'center', fontSize: '0.95rem' }}
                  placeholder="e.g. Mt."
                />
                <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>1 {unitAName || 'Unit A'} =</span>
                <input
                  type="number"
                  className="input-text-clean"
                  value={unitBConversion}
                  onChange={e => setUnitBConversion(e.target.value)}
                  style={{ width: '80px', textAlign: 'center', fontWeight: 800 }}
                />
                <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{unitBName || 'Unit B'}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="checkbox"
                  id="unitBActiveCheck"
                  checked={unitBActive}
                  onChange={e => setUnitBActive(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="unitBActiveCheck" style={{ fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
                  Active
                </label>
              </div>
            </div>

            {/* Pricing Grid for Unit B */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px', textAlign: 'center' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Besic Price</label>
                <input
                  type="number"
                  className="input-text-clean"
                  value={unitBBasicPrice}
                  onChange={e => setUnitBBasicPrice(e.target.value)}
                  style={{ textAlign: 'center', fontWeight: 700 }}
                />
                <div className="subtext-calc-red">{unitBBreakdown.basicPrice}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>GST %</label>
                <input
                  type="number"
                  className="input-text-clean"
                  value={unitBGstPercent}
                  onChange={e => setUnitBGstPercent(e.target.value)}
                  style={{ textAlign: 'center', fontWeight: 700 }}
                />
                <div className="subtext-calc-red">{unitBBreakdown.gstAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>TRAN%</label>
                <input
                  type="number"
                  className="input-text-clean"
                  value={unitBTranPercent}
                  onChange={e => setUnitBTranPercent(e.target.value)}
                  style={{ textAlign: 'center', fontWeight: 700 }}
                />
                <div className="subtext-calc-red">{unitBBreakdown.tranAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Prof%</label>
                <input
                  type="number"
                  className="input-text-clean"
                  value={unitBProfPercent}
                  onChange={e => setUnitBProfPercent(e.target.value)}
                  style={{ textAlign: 'center', fontWeight: 700 }}
                />
                <div className="subtext-calc-red">{unitBBreakdown.profAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Mis.%</label>
                <input
                  type="number"
                  className="input-text-clean"
                  value={unitBMisPercent}
                  onChange={e => setUnitBMisPercent(e.target.value)}
                  style={{ textAlign: 'center', fontWeight: 700 }}
                />
                <div className="subtext-calc-red">{unitBBreakdown.misAmt}</div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>ROUND UP</label>
                <input
                  type="number"
                  className="input-text-clean"
                  value={unitBRoundUp}
                  onChange={e => setUnitBRoundUp(e.target.value)}
                  style={{ textAlign: 'center', fontWeight: 700 }}
                />
                <div className="subtext-calc-red" style={{ visibility: 'hidden' }}>0</div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Sale Price</label>
                <input
                  type="number"
                  className="input-text-clean"
                  value={unitBSalePrice}
                  onChange={e => setUnitBSalePrice(e.target.value)}
                  style={{ textAlign: 'center', fontWeight: 900, color: '#002B99', fontSize: '0.95rem' }}
                />
                <div className="subtext-calc-red" style={{ visibility: 'hidden' }}>0</div>
              </div>
            </div>
          </div>

          {/* Stock Thresholds */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '4px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
                Min Stock (Reorder Alert Threshold)
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
              <label style={{ display: 'block', fontWeight: 800, fontSize: '0.88rem', marginBottom: '4px' }}>
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

          {/* Customer Authentic Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '20px' }}>
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
                  showToast('Select an item from the table below to edit', 'info');
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

      {/* Item Stock Directory Drawer */}
      {showDirectory && (
        <div style={{ marginTop: '28px', background: '#FFFFFF', border: '2px solid #000000', borderRadius: '12px', padding: '20px', maxWidth: '980px', margin: '28px auto 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h4 style={{ fontWeight: 900, fontSize: '1.05rem', margin: 0 }}>Items Master & Live Stock</h4>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={14} color="#6B7280" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                type="text"
                placeholder="Search items..."
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
                  <th style={{ width: '80px' }}>S.No</th>
                  <th>Item Name</th>
                  <th>Supplier</th>
                  <th>Unit-A (Sale Price)</th>
                  <th>Unit-B (Conversion)</th>
                  <th style={{ textAlign: 'center' }}>Live Stock</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Select</th>
                </tr>
              </thead>
              <tbody>
                {filteredSummaries.map(s => (
                  <tr
                    key={s.item.id}
                    style={{
                      backgroundColor: selectedItemId === s.item.id ? '#F5F3FF' : 'transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => loadItemIntoForm(s.item)}
                  >
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{s.item.sno}</td>
                    <td style={{ fontWeight: 800 }}>{s.item.name}</td>
                    <td>{s.item.supplierName || '-'}</td>
                    <td>
                      {s.item.unitA ? `${s.item.unitA.unitName} (₹${s.item.unitA.salePrice})` : `${s.item.unit || 'Pcs'} (₹${s.item.saleRate})`}
                    </td>
                    <td>
                      {s.item.unitB ? `${s.item.unitB.unitName} (1=${s.item.unitB.conversionFactor})` : '-'}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 900, color: s.isLowStock ? '#EA3943' : '#15803D' }}>
                      {s.closingStock}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: s.item.isActive !== false ? '#DCFCE7' : '#FEE2E2',
                          color: s.item.isActive !== false ? '#166534' : '#991B1B'
                        }}
                      >
                        {s.item.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          loadItemIntoForm(s.item);
                          setShowDirectory(false);
                          showToast(`Loaded ${s.item.name}`, 'info');
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
        title="Delete Item"
        message={`Are you sure you want to delete item "${deleteDialog.name}"? This will also remove associated stock movements.`}
      />
    </div>
  );
};
