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

  const defaultGst = options?.defaultGst ?? settings.defaultGstPercent ?? 18;
  const defaultTransport = options?.defaultTransport ?? settings.defaultTransportPercent ?? 10;

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
    const rowNum = index + 2; // Excel 1-based index + header

    // Match column names loosely with all phonetic and common variations
    const rawItemName = String(
      getColumnValue(row, [
        'item',
        'itemname',
        'material',
        'materialname',
        'name',
        'product',
        'productname',
        'description',
        'particulars',
        'itemdescription'
      ])
    ).trim();

    const rawCategory = String(
      getColumnValue(row, [
        'category',
        'catagary',
        'catagory',
        'categary',
        'group',
        'itemcategory',
        'type',
        'cat',
        'categoryname',
        'groupname'
      ])
    ).trim();

    const rawSupplier = String(
      getColumnValue(row, [
        'supplier',
        'suppliername',
        'vendor',
        'vendorname',
        'firm',
        'firmname',
        'party',
        'manufacturer',
        'company',
        'distributor'
      ])
    ).trim();

    const rawBasePrice = getColumnValue(row, [
      'baseprice',
      'basicprice',
      'purchaserate',
      'purcrate',
      'purrate',
      'base',
      'rate',
      'price',
      'cost',
      'purchaseprice',
      'mrp',
      'salerate'
    ]);

    const rawSno = getColumnValue(row, [
      'sno',
      'srno',
      'serialno',
      'code',
      'no',
      'sr',
      'empty'
    ]);

    // Skip blank rows
    if (!rawItemName && !rawCategory && !rawSupplier && !rawBasePrice) {
      return;
    }

    if (!rawItemName) {
      errors.push(`Row ${rowNum}: Skipped because Item Name is missing.`);
      return;
    }

    // Parse numeric price
    let basePrice = 0;
    if (typeof rawBasePrice === 'number') {
      basePrice = rawBasePrice;
    } else if (rawBasePrice) {
      const cleaned = String(rawBasePrice).replace(/[^0-9.-]+/g, '');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) basePrice = parsed;
    }

    // Match or auto-create supplier
    let matchedSupplier: Supplier | undefined = undefined;
    const cleanSupplierName = rawSupplier.trim().toUpperCase();

    if (cleanSupplierName) {
      if (supplierNameMap.has(cleanSupplierName)) {
        matchedSupplier = supplierNameMap.get(cleanSupplierName);
      } else {
        // Auto-create supplier with clean default fields
        const newSupplier: Supplier = {
          id: `sup-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: cleanSupplierName,
          address: '',
          phone: '',
          gstin: '',
          openingBalance: 0,
          isActive: true,
          createdAt: new Date().toISOString()
        };
        db.saveSupplier(newSupplier);
        supplierNameMap.set(cleanSupplierName, newSupplier);
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
      defaultGst,
      defaultTransport,
      25, // default profit %
      2,  // default misc %
      0   // roundup
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
      minStock: existingItem?.minStock ?? 100,
      openingStock: existingItem?.openingStock ?? 0,
      purchaseRate: basePrice,
      saleRate: unitA.salePrice,
      gstPercent: defaultGst,
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
          const gst = Number(getColumnValue(r, ['gst', 'gstpercent'])) || 18;
          const tran = Number(getColumnValue(r, ['transport', 'tranpercent'])) || 10;
          const prof = Number(getColumnValue(r, ['profit', 'profpercent'])) || 25;
          const misc = Number(getColumnValue(r, ['misc', 'mispercent'])) || 2;
          const sno = String(getColumnValue(r, ['sno', 'serialno', 'code', 'empty'])) || '';
          const category = String(getColumnValue(r, ['category', 'catagary', 'catagory', 'group'])) || 'GENERAL';
          const supplierName = String(getColumnValue(r, ['suppliername', 'supplier', 'vendor'])) || '';

          const unitA = calculateItemUnitBreakdown(basePrice, gst, tran, prof, misc, 0);

          const item: Item = {
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            sno,
            name: name.toUpperCase(),
            category: category.toUpperCase(),
            supplierName: supplierName.toUpperCase(),
            unit: String(getColumnValue(r, ['primaryunit', 'unit'])) || 'Roll',
            minStock: Number(getColumnValue(r, ['minstock', 'reorder'])) || 100,
            openingStock: Number(getColumnValue(r, ['openingstock'])) || 0,
            purchaseRate: basePrice,
            saleRate: unitA.salePrice,
            gstPercent: gst,
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
    });

    // Fallback: If standard multi-sheet tables yielded 0 restored records, but the file contains items, run importItemsFromExcel!
    const totalMultiSheetRestored = Object.values(restoredCounts).reduce((a, b) => a + b, 0);
    if (totalMultiSheetRestored === 0) {
      const importResult = importItemsFromExcel(fileData);
      restoredCounts.items = importResult.importedCount;
      restoredCounts.suppliers = importResult.createdSuppliersCount;
    }

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
