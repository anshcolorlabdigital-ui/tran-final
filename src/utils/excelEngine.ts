import * as XLSX from 'xlsx';
import { db } from '../db/db';
import { StockEngine } from '../db/stockEngine';
import { calculateItemUnitBreakdown } from './calculations';
import {
  Item,
  Supplier,
  Party,
  Sale,
  Purchase,
  SupplierOrder,
  SelfUse,
  StockAdjustment
} from '../types';
import { ExportFilterOptions, buildExportDataset } from './exportUtils';

export interface ExcelImportResult {
  totalRows: number;
  importedCount: number;
  createdSuppliersCount: number;
  errors: string[];
  importedItems: Item[];
}

export interface ExcelRestorePreview {
  sheetNames: string[];
  itemsCount: number;
  partiesCount: number;
  suppliersCount: number;
  salesCount: number;
  purchasesCount: number;
  ordersCount: number;
  selfUseCount: number;
  adjustmentsCount: number;
  totalRecords: number;
  isValidBackup: boolean;
}

/**
 * Normalizes string keys in an object for loose header matching
 */
function getColumnValue(row: Record<string, any>, possibleKeys: string[]): any {
  const rowKeys = Object.keys(row);
  for (const targetKey of possibleKeys) {
    const matchedKey = rowKeys.find(
      k => k.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === targetKey.toLowerCase().replace(/[^a-z0-9]/g, '')
    );
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && String(row[matchedKey]).trim() !== '') {
      return row[matchedKey];
    }
  }
  return '';
}

/**
 * Bulk Import Items from Excel / CSV (4 Columns: Item, Category, Supplier, Base Price)
 */
export function importItemsFromExcel(
  fileData: ArrayBuffer | Uint8Array,
  options?: { defaultGst?: number; defaultTransport?: number }
): ExcelImportResult {
  const workbook = XLSX.read(fileData, { type: 'array' });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded Excel file contains no worksheets.');
  }

  // Find the most appropriate sheet (one with the most rows or named Sheet1/Items/ACTUAL)
  let bestSheetName = workbook.SheetNames[0];
  let maxRowCount = 0;
  for (const name of workbook.SheetNames) {
    const s = workbook.Sheets[name];
    const r: Record<string, any>[] = XLSX.utils.sheet_to_json(s, { defval: '' });
    if (r.length > maxRowCount) {
      maxRowCount = r.length;
      bestSheetName = name;
    }
  }

  const sheet = workbook.Sheets[bestSheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const existingSuppliers = db.getSuppliers();
  const existingItems = db.getItems();
  const settings = db.getSettings();

  const defaultGst = options?.defaultGst ?? 0;
  const defaultTransport = options?.defaultTransport ?? 0;

  const createdSuppliers: Supplier[] = [];
  const importedItems: Item[] = [];
  const errors: string[] = [];

  // Track suppliers in a local map to avoid creating duplicates during the same batch
  const supplierNameMap = new Map<string, Supplier>();
  existingSuppliers.forEach(s => supplierNameMap.set(s.name.trim().toUpperCase(), s));

  // Determine current max S.No
  let maxSno = 1450;
  existingItems.forEach(it => {
    const parsed = parseInt(it.sno, 10);
    if (!isNaN(parsed) && parsed > maxSno) maxSno = parsed;
  });

  rawRows.forEach((row, index) => {
    // Match column names loosely with all phonetic and common variations
    const rawItemName = String(
      getColumnValue(row, [
        'item',
        'itemname',
        'itemdescription',
        'description',
        'particulars',
        'material',
        'product',
        'name'
      ])
    ).trim();

    if (!rawItemName) return; // Skip completely empty rows

    const rawCategory = String(
      getColumnValue(row, ['category', 'catagory', 'catagary', 'group', 'type', 'itemgroup'])
    );

    const rawSupplier = String(
      getColumnValue(row, [
        'supplier',
        'suppliername',
        'vendor',
        'vendorname',
        'party',
        'company',
        'dealer'
      ])
    ).trim();

    const rawBasePrice = getColumnValue(row, [
      'baseprice',
      'basicprice',
      'besicprice',
      'purchaserate',
      'purcrate',
      'purrate',
      'purchaseprice',
      'rate',
      'price',
      'cost',
      'base',
      'basic',
      'amount',
      'buyingrate'
    ]);

    const rawSno = getColumnValue(row, ['sno', 'serialno', 'code', 'itemcode', 'id']);

    const rawGst = getColumnValue(row, ['gst', 'gstpercent', 'tax', 'taxpercent', 'gst%']);
    const rowGst = rawGst !== '' && !isNaN(Number(rawGst)) ? Number(rawGst) : defaultGst;

    const rawTran = getColumnValue(row, ['tran', 'tranpercent', 'transport', 'freight', 'transport%']);
    const rowTran = rawTran !== '' && !isNaN(Number(rawTran)) ? Number(rawTran) : defaultTransport;

    const rawProfAm = getColumnValue(row, ['profam', 'profpercentam', 'amateurprof', 'amateurmargin']);
    const rowProfAm = rawProfAm !== '' && !isNaN(Number(rawProfAm)) ? Number(rawProfAm) : 0;

    const rawProfDeal = getColumnValue(row, ['profdeal', 'profpercentdeal', 'dealerprof', 'dealermargin', 'profit', 'prof']);
    const rowProfDeal = rawProfDeal !== '' && !isNaN(Number(rawProfDeal)) ? Number(rawProfDeal) : 0;

    const rawMisc = getColumnValue(row, ['misc', 'mis', 'mispercent', 'other']);
    const rowMisc = rawMisc !== '' && !isNaN(Number(rawMisc)) ? Number(rawMisc) : 0;

    const rawMinStock = getColumnValue(row, ['minstock', 'reorder', 'minimumstock']);
    const rowMinStock = rawMinStock !== '' && !isNaN(Number(rawMinStock)) ? Number(rawMinStock) : (existingItems.find(it => it.name.trim().toUpperCase() === rawItemName.toUpperCase())?.minStock ?? 0);

    const basePrice = Number(rawBasePrice) || 0;

    // Resolve or auto-create Supplier
    let matchedSupplier: Supplier | undefined;
    if (rawSupplier) {
      const supKey = rawSupplier.toUpperCase();
      if (supplierNameMap.has(supKey)) {
        matchedSupplier = supplierNameMap.get(supKey);
      } else {
        // Create new Supplier on the fly with empty details
        const newSupplier: Supplier = {
          id: `sup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: rawSupplier.toUpperCase(),
          address: '',
          phone: '',
          gstin: '',
          openingBalance: 0,
          isActive: true,
          createdAt: new Date().toISOString()
        };
        db.saveSupplier(newSupplier);
        supplierNameMap.set(supKey, newSupplier);
        createdSuppliers.push(newSupplier);
        matchedSupplier = newSupplier;
      }
    }

    // Check if item exists by name (case-insensitive) to update or create
    const cleanItemName = rawItemName.toUpperCase();
    const existingItem = existingItems.find(it => it.name.trim().toUpperCase() === cleanItemName);

    maxSno += 1;
    let finalSno = existingItem?.sno;
    if (!finalSno) {
      if (rawSno && !isNaN(Number(rawSno))) {
        finalSno = String(rawSno);
      } else {
        finalSno = String(maxSno);
      }
    }

    const unitA = calculateItemUnitBreakdown(
      basePrice,
      rowGst,
      rowTran,
      rowProfAm,
      rowMisc,
      0,
      undefined,
      rowProfDeal,
      0
    );

    const itemRecord: Item = {
      id: existingItem?.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sno: finalSno,
      name: cleanItemName,
      description: existingItem?.description || '',
      category: rawCategory ? rawCategory.trim().toUpperCase() : (existingItem?.category || 'GENERAL'),
      supplierId: matchedSupplier?.id || existingItem?.supplierId || '',
      supplierName: matchedSupplier?.name || existingItem?.supplierName || '',
      unit: existingItem?.unit || 'Roll',
      minStock: rowMinStock,
      openingStock: existingItem?.openingStock ?? 0,
      purchaseRate: basePrice,
      saleRate: unitA.salePrice,
      mrp: unitA.mrp,
      gstPercent: rowGst,
      profPercentAm: rowProfAm,
      profPercentDeal: rowProfDeal,
      unitA,
      hasSecondaryUnit: existingItem?.hasSecondaryUnit ?? false,
      unitB: existingItem?.unitB,
      isActive: true,
      createdAt: existingItem?.createdAt || new Date().toISOString()
    };

    db.saveItem(itemRecord);
    importedItems.push(itemRecord);
  });

  return {
    totalRows: rawRows.length,
    importedCount: importedItems.length,
    createdSuppliersCount: createdSuppliers.length,
    errors,
    importedItems
  };
}

/**
 * Downloads a Complete Excel (.xlsx) Multi-Sheet Backup Workbook
 */
export function downloadCompleteExcelBackup(options: ExportFilterOptions, filenameBase = 'RMMS_System_Backup') {
  const dataset = buildExportDataset(options);
  const wb = XLSX.utils.book_new();

  // 1. Items Master Sheet
  if (dataset.items && dataset.items.length > 0) {
    const itemRows = dataset.items.map(it => {
      const stock = StockEngine.getItemCurrentStock(it.id);
      return {
        'S.No': it.sno,
        'Item Name': it.name,
        'Category': it.category,
        'Supplier Name': it.supplierName || '',
        'Base Price (Purchase Rate)': it.purchaseRate,
        'GST %': it.gstPercent,
        'Transport %': it.unitA?.tranPercent ?? 10,
        'Profit %': it.unitA?.profPercent ?? 25,
        'Misc %': it.unitA?.misPercent ?? 2,
        'Sale Price': it.saleRate,
        'Primary Unit': it.unit,
        'Secondary Unit': it.unitB?.unitName || '',
        'Unit Conversion (1A=B)': it.unitB?.conversionFactor || '',
        'Min Stock': it.minStock,
        'Opening Stock': it.openingStock,
        'Current Stock Level': stock,
        'Status': it.isActive !== false ? 'Active' : 'Inactive'
      };
    });
    const ws = XLSX.utils.json_to_sheet(itemRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Items');
  }

  // 2. Suppliers Master Sheet
  if (dataset.suppliers && dataset.suppliers.length > 0) {
    const supRows = dataset.suppliers.map(s => ({
      'Supplier ID': s.id,
      'Firm Name': s.name,
      'Proprietor': s.propName || '',
      'Mobile 1': s.phone || '',
      'Mobile 2': s.phone2 || '',
      'Contact Person 1': s.contactPerson1 || '',
      'Contact Person 2': s.contactPerson2 || '',
      'Address': s.address || '',
      'Block': s.block || '',
      'District': s.distt || '',
      'City': s.city || '',
      'State': s.state || '',
      'GSTIN': s.gstin || '',
      'Email': s.email || '',
      'Opening Balance': s.openingBalance || 0,
      'Active': s.isActive !== false ? 'Yes' : 'No'
    }));
    const ws = XLSX.utils.json_to_sheet(supRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
  }

  // 3. Parties Master Sheet
  if (dataset.parties && dataset.parties.length > 0) {
    const ptyRows = dataset.parties.map(p => ({
      'Party ID': p.id,
      'Firm Name': p.name,
      'Party Type': p.partyType || 'AMATEUR',
      'Dealer Profit %': p.dealerProfitPercent ?? '',
      'Amateur Profit %': p.amateurProfitPercent ?? '',
      'Proprietor': p.propName || '',
      'Mobile 1': p.phone || '',
      'Mobile 2': p.phone2 || '',
      'Contact Person 1': p.contactPerson1 || '',
      'Contact Person 2': p.contactPerson2 || '',
      'Address': p.address || '',
      'Block': p.block || '',
      'District': p.distt || '',
      'City': p.city || '',
      'State': p.state || '',
      'GSTIN': p.gstin || '',
      'Email': p.email || '',
      'Opening Balance': p.openingBalance || 0,
      'Credit Limit': p.creditLimit || 0,
      'Allow Credit': p.allowCredit ? 'Yes' : 'No',
      'Active': p.isActive !== false ? 'Yes' : 'No'
    }));
    const ws = XLSX.utils.json_to_sheet(ptyRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Parties');
  }

  // 4. Sales Invoices Sheet
  if (dataset.sales && dataset.sales.length > 0) {
    const saleRows: any[] = [];
    dataset.sales.forEach(s => {
      s.items.forEach(it => {
        saleRows.push({
          'Bill No': s.billNo,
          'Bill Date': s.billDate,
          'Party Name': s.partyName,
          'Item Name': it.itemName,
          'Item S.No': it.sno || '',
          'Qty': it.qty,
          'Unit': it.unit || 'Roll',
          'Basic Price': it.basicPrice,
          'GST %': it.gstPercent,
          'GST Amount': it.gstAmt,
          'Nett Price': it.nettPrice,
          'Sale Price': it.salePrice,
          'Line Amount': it.amount,
          'Bill Grand Total': s.billTotal,
          'Recd Cash': s.recdCash,
          'Recd UPI': s.recdUpi,
          'Is Credit Sale': s.isCreditSale ? 'Yes' : 'No'
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(saleRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
  }

  // 5. Purchases Sheet
  if (dataset.purchases && dataset.purchases.length > 0) {
    const purRows: any[] = [];
    dataset.purchases.forEach(p => {
      p.items.forEach(it => {
        purRows.push({
          'Bill No': p.billNo,
          'Bill Date': p.billDate,
          'Supplier Name': p.supplierName,
          'Item Name': it.itemName,
          'Item S.No': it.sno || '',
          'Qty Inwarded': it.qty,
          'Unit': it.unit || 'Roll',
          'Basic Price': it.basicPrice,
          'GST %': it.gstPercent,
          'GST Amount': it.gstAmt,
          'Nett Price': it.nettPrice,
          'Line Amount': it.amount,
          'Bill Grand Total': p.billTotal
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(purRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Purchases');
  }

  // 6. Orders Sheet
  if (dataset.orders && dataset.orders.length > 0) {
    const ordRows: any[] = [];
    dataset.orders.forEach(o => {
      o.items.forEach(it => {
        ordRows.push({
          'Order Number': o.orderNumber,
          'Order Date': o.orderDate,
          'Supplier Name': o.supplierName,
          'Status': o.status,
          'Item Name': it.itemName,
          'Ordered Qty': it.orderedQty,
          'Received Qty': it.receivedQty || 0,
          'Unit': (it as any).unit || '',
          'Description': it.description || '',
          'Notes': o.notes || ''
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(ordRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  }

  // 7. Self Use Sheet
  if (dataset.selfUses && dataset.selfUses.length > 0) {
    const suRows: any[] = [];
    dataset.selfUses.forEach(su => {
      su.items.forEach(it => {
        suRows.push({
          'Voucher No': su.billNo,
          'Date': su.billDate,
          'Category': su.category || '',
          'Item Name': it.itemName,
          'Qty Consumed': it.qty,
          'Unit': it.unit || 'Roll',
          'Rate': it.rate,
          'Amount': it.amount,
          'Purpose': su.reason || su.remarks || ''
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(suRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Self_Use');
  }

  const dateSuffix = options.isFullHistory ? 'Full' : `${options.fromDate}_to_${options.toDate}`;
  XLSX.writeFile(wb, `${filenameBase}_${dateSuffix}.xlsx`);
}

/**
 * Inspects an Excel Backup File for Restore Preview
 */
export function inspectExcelBackup(fileData: ArrayBuffer | Uint8Array): ExcelRestorePreview {
  try {
    const wb = XLSX.read(fileData, { type: 'array' });
    const sheetNames = wb.SheetNames;

    let itemsCount = 0;
    let partiesCount = 0;
    let suppliersCount = 0;
    let salesCount = 0;
    let purchasesCount = 0;
    let ordersCount = 0;
    let selfUseCount = 0;
    let adjustmentsCount = 0;

    sheetNames.forEach(name => {
      const lower = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const sheet = wb.Sheets[name];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (lower.includes('item') || lower.includes('material')) itemsCount = rows.length;
      else if (lower.includes('part') || lower.includes('client') || lower.includes('cust')) partiesCount = rows.length;
      else if (lower.includes('supp') || lower.includes('vendor')) suppliersCount = rows.length;
      else if (lower.includes('sale') || lower.includes('invoice')) salesCount = rows.length;
      else if (lower.includes('purch')) purchasesCount = rows.length;
      else if (lower.includes('ord')) ordersCount = rows.length;
      else if (lower.includes('self')) selfUseCount = rows.length;
      else if (lower.includes('adj')) adjustmentsCount = rows.length;
    });

    // Fallback: If no standard named sheets matched, inspect sheets for item catalog data (e.g. ITEM.xls)
    if (itemsCount === 0 && partiesCount === 0 && suppliersCount === 0 && salesCount === 0 && purchasesCount === 0 && ordersCount === 0) {
      for (const name of sheetNames) {
        const sheet = wb.Sheets[name];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (rows.length > 0) {
          const sampleRow = rows[0];
          const keys = Object.keys(sampleRow).map(k => k.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
          const hasItemCol = keys.some(k => k.includes('item') || k.includes('material') || k.includes('name') || k.includes('description') || k.includes('product'));
          const hasPriceCol = keys.some(k => k.includes('price') || k.includes('rate') || k.includes('cost') || k.includes('purc') || k.includes('mrp'));

          if (hasItemCol || hasPriceCol) {
            itemsCount = rows.length;
            // Count unique suppliers in this sheet
            const suppSet = new Set<string>();
            rows.forEach(r => {
              const s = String(getColumnValue(r, ['supplier', 'vendor', 'firm'])).trim();
              if (s) suppSet.add(s.toUpperCase());
            });
            suppliersCount = suppSet.size;
            break;
          }
        }
      }
    }

    const totalRecords = itemsCount + partiesCount + suppliersCount + salesCount + purchasesCount + ordersCount + selfUseCount + adjustmentsCount;
    const isValidBackup = sheetNames.length > 0 && totalRecords > 0;

    return {
      sheetNames,
      itemsCount,
      partiesCount,
      suppliersCount,
      salesCount,
      purchasesCount,
      ordersCount,
      selfUseCount,
      adjustmentsCount,
      totalRecords,
      isValidBackup
    };
  } catch (err) {
    return {
      sheetNames: [],
      itemsCount: 0,
      partiesCount: 0,
      suppliersCount: 0,
      salesCount: 0,
      purchasesCount: 0,
      ordersCount: 0,
      selfUseCount: 0,
      adjustmentsCount: 0,
      totalRecords: 0,
      isValidBackup: false
    };
  }
}

/**
 * Restores the complete database from an Excel (.xlsx/.xls) Backup Workbook or Item Catalog
 */
export function restoreDatabaseFromExcel(fileData: ArrayBuffer | Uint8Array): {
  success: boolean;
  restoredCounts: Record<string, number>;
  error?: string;
} {
  try {
    const wb = XLSX.read(fileData, { type: 'array' });
    const restoredCounts: Record<string, number> = {
      items: 0,
      suppliers: 0,
      parties: 0,
      sales: 0,
      purchases: 0,
      orders: 0,
      selfUse: 0
    };

    wb.SheetNames.forEach(sheetName => {
      const lower = sheetName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const sheet = wb.Sheets[sheetName];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      // 1. Items Sheet
      if (lower.includes('item') || lower.includes('material')) {
        rows.forEach(r => {
          const name = String(getColumnValue(r, ['itemname', 'item', 'name', 'material', 'product'])).trim();
          if (!name) return;

          const basePrice = Number(getColumnValue(r, ['basepricepurchaserate', 'baseprice', 'purchaserate', 'purcrate', 'rate', 'price'])) || 0;
          const gstVal = getColumnValue(r, ['gst', 'gstpercent']);
          const gst = gstVal !== '' && !isNaN(Number(gstVal)) ? Number(gstVal) : 0;
          const tranVal = getColumnValue(r, ['transport', 'tranpercent', 'tran']);
          const tran = tranVal !== '' && !isNaN(Number(tranVal)) ? Number(tranVal) : 0;
          const profAmVal = getColumnValue(r, ['profam', 'profpercentam', 'amateurmargin', 'amateurprof']);
          const profAm = profAmVal !== '' && !isNaN(Number(profAmVal)) ? Number(profAmVal) : 0;
          const profDealVal = getColumnValue(r, ['profdeal', 'profpercentdeal', 'profit', 'profpercent', 'dealermargin']);
          const profDeal = profDealVal !== '' && !isNaN(Number(profDealVal)) ? Number(profDealVal) : 0;
          const miscVal = getColumnValue(r, ['misc', 'mispercent', 'mis']);
          const misc = miscVal !== '' && !isNaN(Number(miscVal)) ? Number(miscVal) : 0;
          const sno = String(getColumnValue(r, ['sno', 'serialno', 'code', 'empty'])) || '';
          const category = String(getColumnValue(r, ['category', 'catagary', 'catagory', 'group'])) || 'GENERAL';
          const supplierName = String(getColumnValue(r, ['suppliername', 'supplier', 'vendor'])) || '';

          const unitA = calculateItemUnitBreakdown(basePrice, gst, tran, profAm, misc, 0, undefined, profDeal, 0);

          const item: Item = {
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            sno,
            name: name.toUpperCase(),
            category: category.toUpperCase(),
            supplierName: supplierName.toUpperCase(),
            unit: String(getColumnValue(r, ['primaryunit', 'unit'])) || 'Roll',
            minStock: Number(getColumnValue(r, ['minstock', 'reorder'])) || 0,
            openingStock: Number(getColumnValue(r, ['openingstock'])) || 0,
            purchaseRate: basePrice,
            saleRate: unitA.salePrice,
            mrp: unitA.mrp,
            gstPercent: gst,
            profPercentAm: profAm,
            profPercentDeal: profDeal,
            unitA,
            isActive: String(getColumnValue(r, ['status', 'active'])).toLowerCase() !== 'inactive',
            createdAt: new Date().toISOString()
          };
          db.saveItem(item);
          restoredCounts.items += 1;
        });
      }

      // 2. Suppliers Sheet
      if (lower.includes('supp') || lower.includes('vendor')) {
        rows.forEach(r => {
          const name = String(getColumnValue(r, ['firmname', 'name', 'supplier', 'vendor'])).trim();
          if (!name) return;

          const supplier: Supplier = {
            id: String(getColumnValue(r, ['supplierid', 'id'])) || `sup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: name.toUpperCase(),
            propName: String(getColumnValue(r, ['proprietor', 'propname'])),
            phone: String(getColumnValue(r, ['mobile1', 'phone', 'mobile'])),
            phone2: String(getColumnValue(r, ['mobile2', 'phone2'])),
            contactPerson1: String(getColumnValue(r, ['contactperson1'])),
            contactPerson2: String(getColumnValue(r, ['contactperson2'])),
            address: String(getColumnValue(r, ['address'])),
            block: String(getColumnValue(r, ['block'])),
            distt: String(getColumnValue(r, ['district', 'distt'])),
            city: String(getColumnValue(r, ['city'])),
            state: String(getColumnValue(r, ['state'])),
            gstin: String(getColumnValue(r, ['gstin', 'gstno'])),
            email: String(getColumnValue(r, ['email', 'mailid'])),
            openingBalance: Number(getColumnValue(r, ['openingbalance'])) || 0,
            isActive: String(getColumnValue(r, ['active'])).toLowerCase() !== 'no',
            createdAt: new Date().toISOString()
          };
          db.saveSupplier(supplier);
          restoredCounts.suppliers += 1;
        });
      }

      // 3. Parties Sheet
      if (lower.includes('part') || lower.includes('client') || lower.includes('cust')) {
        rows.forEach(r => {
          const name = String(getColumnValue(r, ['firmname', 'name', 'party', 'client'])).trim();
          if (!name) return;

          const rawPartyType = String(getColumnValue(r, ['partytype', 'type'])).toUpperCase();
          const partyType = rawPartyType === 'DEALER' ? 'DEALER' : 'AMATEUR';
          const rawDealerProfit = getColumnValue(r, ['dealerprofit', 'dealerprofitpercent', 'dealerprofitmargin']);
          const dealerProfitPercent = rawDealerProfit !== '' ? Number(rawDealerProfit) : undefined;
          const rawAmateurProfit = getColumnValue(r, ['amateurprofit', 'amateurprofitpercent', 'amateurprofitmargin']);
          const amateurProfitPercent = rawAmateurProfit !== '' ? Number(rawAmateurProfit) : undefined;

          const party: Party = {
            id: String(getColumnValue(r, ['partyid', 'id'])) || `pty-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: name.toUpperCase(),
            partyType,
            dealerProfitPercent,
            amateurProfitPercent,
            propName: String(getColumnValue(r, ['proprietor', 'propname'])),
            phone: String(getColumnValue(r, ['mobile1', 'phone', 'mobile'])),
            phone2: String(getColumnValue(r, ['mobile2', 'phone2'])),
            contactPerson1: String(getColumnValue(r, ['contactperson1'])),
            contactPerson2: String(getColumnValue(r, ['contactperson2'])),
            address: String(getColumnValue(r, ['address'])),
            block: String(getColumnValue(r, ['block'])),
            distt: String(getColumnValue(r, ['district', 'distt'])),
            city: String(getColumnValue(r, ['city'])),
            state: String(getColumnValue(r, ['state'])),
            gstin: String(getColumnValue(r, ['gstin', 'gstno'])),
            email: String(getColumnValue(r, ['email', 'mailid'])),
            openingBalance: Number(getColumnValue(r, ['openingbalance'])) || 0,
            creditLimit: Number(getColumnValue(r, ['creditlimit'])) || 0,
            allowCredit: String(getColumnValue(r, ['allowcredit'])).toLowerCase() === 'yes',
            isActive: String(getColumnValue(r, ['active'])).toLowerCase() !== 'no',
            createdAt: new Date().toISOString()
          };
          db.saveParty(party);
          restoredCounts.parties += 1;
        });
      }

      // 4. Sales Sheet
      if (lower.includes('sale')) {
        const salesByBill = new Map<string, any[]>();
        rows.forEach(r => {
          const billNo = String(getColumnValue(r, ['billno', 'invoiceno', 'bill'])).trim();
          if (!billNo) return;
          if (!salesByBill.has(billNo)) salesByBill.set(billNo, []);
          salesByBill.get(billNo)!.push(r);
        });

        salesByBill.forEach((billRows, billNo) => {
          const firstRow = billRows[0];
          const partyName = String(getColumnValue(firstRow, ['partyname', 'party', 'customer'])).trim() || 'CASH';
          const billDate = String(getColumnValue(firstRow, ['billdate', 'date'])) || new Date().toISOString().split('T')[0];
          const grandTotal = Number(getColumnValue(firstRow, ['billgrandtotal', 'grandtotal', 'amount', 'total'])) || 0;
          const recdCash = Number(getColumnValue(firstRow, ['recdcash', 'cash'])) || 0;
          const recdUpi = Number(getColumnValue(firstRow, ['recdupi', 'upi'])) || 0;

          const saleItems = billRows.map((br, idx) => {
            const itemName = String(getColumnValue(br, ['itemname', 'item', 'particulars'])).trim();
            const basicPrice = Number(getColumnValue(br, ['basicprice', 'rate'])) || 0;
            const gstPercent = Number(getColumnValue(br, ['gstpercent', 'gst%'])) || 0;
            const gstAmt = Number(getColumnValue(br, ['gstamount', 'gstamt'])) || 0;
            const nettPrice = Number(getColumnValue(br, ['nettprice'])) || basicPrice;
            const salePrice = Number(getColumnValue(br, ['saleprice', 'mrp'])) || basicPrice;
            const qty = Number(getColumnValue(br, ['qty', 'quantity'])) || 1;
            const amount = Number(getColumnValue(br, ['lineamount', 'amount'])) || salePrice * qty;

            return {
              id: `sitem-${Date.now()}-${idx}`,
              sno: String(getColumnValue(br, ['itemsno', 'sno'])) || '',
              itemId: `item-gen-${Date.now()}`,
              itemName,
              unit: String(getColumnValue(br, ['unit'])) || 'Roll',
              basicPrice,
              gstPercent,
              gstAmt,
              nettPrice,
              salePrice,
              mrp: salePrice,
              qty,
              amount
            };
          });

          const sale: Sale = {
            id: `sale-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            billNo,
            billDate,
            partyId: '',
            partyName,
            items: saleItems,
            basicTotal: saleItems.reduce((acc, it) => acc + (it.basicPrice * it.qty), 0),
            gstTotal: saleItems.reduce((acc, it) => acc + (it.gstAmt * it.qty), 0),
            roundUp: 0,
            billTotal: grandTotal || saleItems.reduce((acc, it) => acc + it.amount, 0),
            recdCash,
            recdUpi,
            balanceDue: 0,
            createdAt: new Date().toISOString()
          };
          db.saveSale(sale);
          restoredCounts.sales += 1;
        });
      }

      // 5. Purchases Sheet
      if (lower.includes('purch')) {
        const purByBill = new Map<string, any[]>();
        rows.forEach(r => {
          const billNo = String(getColumnValue(r, ['billno', 'invoiceno', 'bill'])).trim();
          if (!billNo) return;
          if (!purByBill.has(billNo)) purByBill.set(billNo, []);
          purByBill.get(billNo)!.push(r);
        });

        purByBill.forEach((billRows, billNo) => {
          const firstRow = billRows[0];
          const supplierName = String(getColumnValue(firstRow, ['suppliername', 'supplier', 'vendor'])).trim();
          const billDate = String(getColumnValue(firstRow, ['billdate', 'date'])) || new Date().toISOString().split('T')[0];
          const grandTotal = Number(getColumnValue(firstRow, ['billgrandtotal', 'grandtotal', 'amount'])) || 0;

          const purItems = billRows.map((br, idx) => {
            const itemName = String(getColumnValue(br, ['itemname', 'item', 'particulars'])).trim();
            const basicPrice = Number(getColumnValue(br, ['basicprice', 'rate'])) || 0;
            const gstPercent = Number(getColumnValue(br, ['gstpercent', 'gst%'])) || 0;
            const gstAmt = Number(getColumnValue(br, ['gstamount', 'gstamt'])) || 0;
            const nettPrice = Number(getColumnValue(br, ['nettprice'])) || basicPrice;
            const qty = Number(getColumnValue(br, ['qtyinwarded', 'qty', 'quantity'])) || 1;
            const amount = Number(getColumnValue(br, ['lineamount', 'amount'])) || nettPrice * qty;

            return {
              id: `pitem-${Date.now()}-${idx}`,
              sno: String(getColumnValue(br, ['itemsno', 'sno'])) || '',
              itemId: `item-gen-${Date.now()}`,
              itemName,
              unit: String(getColumnValue(br, ['unit'])) || 'Roll',
              basicPrice,
              gstPercent,
              gstAmt,
              nettPrice,
              qty,
              amount
            };
          });

          const purchase: Purchase = {
            id: `purch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            billNo,
            billDate,
            recdDate: billDate,
            supplierId: '',
            supplierName,
            items: purItems,
            basicTotal: purItems.reduce((acc, it) => acc + (it.basicPrice * it.qty), 0),
            gstTotal: purItems.reduce((acc, it) => acc + (it.gstAmt * it.qty), 0),
            roundUp: 0,
            billTotal: grandTotal || purItems.reduce((acc, it) => acc + it.amount, 0),
            recdCash: 0,
            recdUpi: 0,
            createdAt: new Date().toISOString()
          };
          db.savePurchase(purchase);
          restoredCounts.purchases += 1;
        });
      }

      // 6. Orders Sheet
      if (lower.includes('order')) {
        const ordersByNum = new Map<string, any[]>();
        rows.forEach(r => {
          const orderNumber = String(getColumnValue(r, ['ordernumber', 'orderno', 'number'])).trim();
          if (!orderNumber) return;
          if (!ordersByNum.has(orderNumber)) ordersByNum.set(orderNumber, []);
          ordersByNum.get(orderNumber)!.push(r);
        });

        ordersByNum.forEach((ordRows, orderNumber) => {
          const firstRow = ordRows[0];
          const supplierName = String(getColumnValue(firstRow, ['suppliername', 'supplier', 'vendor'])).trim();
          const orderDate = String(getColumnValue(firstRow, ['orderdate', 'date'])) || new Date().toISOString().split('T')[0];
          const status = String(getColumnValue(firstRow, ['status'])) || 'ORDERED';

          const orderItems = ordRows.map((orow, idx) => ({
            id: `oitem-${Date.now()}-${idx}`,
            sno: String(getColumnValue(orow, ['sno'])) || '',
            itemId: `item-gen-${Date.now()}`,
            itemName: String(getColumnValue(orow, ['itemname', 'item'])).trim(),
            orderedQty: Number(getColumnValue(orow, ['orderedqty', 'qty'])) || 0,
            receivedQty: Number(getColumnValue(orow, ['receivedqty', 'recdqty'])) || 0,
            orderDate,
            status: status as any
          }));

          const supplierOrder: SupplierOrder = {
            id: `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            orderNumber,
            orderDate,
            supplierId: '',
            supplierName,
            status: status as any,
            items: orderItems,
            createdAt: new Date().toISOString()
          };
          db.saveOrder(supplierOrder);
          restoredCounts.orders += 1;
        });
      }

      // 7. Self Use Sheet
      if (lower.includes('selfuse') || lower.includes('self_use') || lower.includes('internal')) {
        const selfUseByVoucher = new Map<string, any[]>();
        rows.forEach(r => {
          const billNo = String(getColumnValue(r, ['voucherno', 'billno', 'refno'])).trim();
          if (!billNo) return;
          if (!selfUseByVoucher.has(billNo)) selfUseByVoucher.set(billNo, []);
          selfUseByVoucher.get(billNo)!.push(r);
        });

        selfUseByVoucher.forEach((vRows, billNo) => {
          const firstRow = vRows[0];
          const category = String(getColumnValue(firstRow, ['category', 'department'])).trim();
          const billDate = String(getColumnValue(firstRow, ['date', 'billdate'])) || new Date().toISOString().split('T')[0];
          const remarks = String(getColumnValue(firstRow, ['purpose', 'remarks', 'reason'])).trim();

          const suItems = vRows.map((vr, idx) => ({
            id: `suitem-${Date.now()}-${idx}`,
            sno: String(getColumnValue(vr, ['sno'])) || '',
            itemId: `item-gen-${Date.now()}`,
            itemName: String(getColumnValue(vr, ['itemname', 'item'])).trim(),
            unit: String(getColumnValue(vr, ['unit'])) || 'Roll',
            rate: Number(getColumnValue(vr, ['rate'])) || 0,
            qty: Number(getColumnValue(vr, ['qtyconsumed', 'qty'])) || 0,
            amount: Number(getColumnValue(vr, ['amount'])) || 0
          }));

          const selfUse: SelfUse = {
            id: `su-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            billNo,
            billDate,
            category,
            items: suItems,
            totalAmount: suItems.reduce((acc, it) => acc + it.amount, 0),
            remarks,
            createdAt: new Date().toISOString()
          };
          db.saveSelfUse(selfUse);
          restoredCounts.selfUse += 1;
        });
      }
    });

    // Fallback: If standard multi-sheet tables yielded 0 restored records, but the file contains items, run importItemsFromExcel!
    const totalMultiSheetRestored = Object.values(restoredCounts).reduce((a, b) => a + b, 0);
    if (totalMultiSheetRestored === 0) {
      const importResult = importItemsFromExcel(fileData);
      restoredCounts.items = importResult.importedCount;
      restoredCounts.suppliers = importResult.createdSuppliersCount;
    }

    // Push all restored records to Firestore
    db.pushAllToCloudFirestore().catch(() => {});

    return {
      success: true,
      restoredCounts
    };
  } catch (err: any) {
    return {
      success: false,
      restoredCounts: {},
      error: err?.message || 'Failed to restore database from Excel.'
    };
  }
}

/**
 * Loads the bundled ITEM.xls material catalog file with one click
 */
export async function loadBundledMaterialsCatalog(): Promise<ExcelImportResult> {
  try {
    const urls = ['/assets/ITEM.xls', '/ITEM.xls', './assets/ITEM.xls'];
    let arrayBuffer: ArrayBuffer | null = null;

    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          arrayBuffer = await res.arrayBuffer();
          break;
        }
      } catch (e) {
        // try next
      }
    }

    if (!arrayBuffer) {
      throw new Error('Could not locate ITEM.xls file on server.');
    }

    return importItemsFromExcel(arrayBuffer);
  } catch (err: any) {
    throw new Error(`Failed to load materials catalog: ${err?.message || err}`);
  }
}
