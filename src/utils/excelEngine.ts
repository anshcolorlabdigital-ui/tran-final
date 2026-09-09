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
  StockAdjustment,
  PhysicalStockAudit,
  PartyLog,
  SupplierLog
} from '../types';
import { ExportFilterOptions, buildExportDataset } from './exportUtils';
import { formatDateToDisplay } from './dateUtils';

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
  physicalStockAuditsCount?: number;
  partyLogsCount?: number;
  supplierLogsCount?: number;
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
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const errors: string[] = [];
  const importedItems: Item[] = [];
  const createdSuppliers: Supplier[] = [];

  const existingItems = db.getItems();
  const existingSuppliers = db.getSuppliers();

  let maxSno = existingItems.reduce((max, it) => {
    const parsed = parseInt(it.sno, 10);
    return isNaN(parsed) ? max : Math.max(max, parsed);
  }, 100);

  rawRows.forEach((row, index) => {
    const rawItemName = getColumnValue(row, ['itemname', 'item', 'name', 'material', 'product', 'particulers', 'particulars', 'itemdescription']);
    if (!rawItemName) {
      errors.push(`Row ${index + 2}: Missing item name, skipped.`);
      return;
    }

    const rawSno = getColumnValue(row, ['sno', 'serialno', 'code', 'itemcode', 'srno']);
    const rawCategory = getColumnValue(row, ['category', 'catg', 'catagory', 'group', 'type']);
    const rawSupplier = getColumnValue(row, ['supplier', 'suppliername', 'vendor', 'firm']);
    const rawPrice = getColumnValue(row, ['baseprice', 'price', 'rate', 'basicprice', 'purchaserate', 'cost', 'costprice']);
    const rawGst = getColumnValue(row, ['gst', 'gst%', 'gstpercent', 'tax']);
    const rawTransport = getColumnValue(row, ['transport', 'tran%', 'tranpercent', 'freight']);
    const rawProfAm = getColumnValue(row, ['profam', 'amateurmargin', 'profpercentam', 'amateur%']);
    const rawProfDeal = getColumnValue(row, ['profdeal', 'dealermargin', 'profpercentdeal', 'dealer%', 'profit%']);
    const rawMisc = getColumnValue(row, ['misc', 'misc%', 'mispercent']);
    const rawMinStock = getColumnValue(row, ['minstock', 'reorder', 'minimumstock', 'alertstock']);
    const rawDisableAlert = getColumnValue(row, ['disablerestockalert', 'disablerestock', 'noalert', 'disablealert']);

    const basePrice = rawPrice !== '' && !isNaN(Number(rawPrice)) ? Number(rawPrice) : 0;
    const rowGst = rawGst !== '' && !isNaN(Number(rawGst)) ? Number(rawGst) : (options?.defaultGst ?? 18);
    const rowTran = rawTransport !== '' && !isNaN(Number(rawTransport)) ? Number(rawTransport) : (options?.defaultTransport ?? 10);
    const rowProfAm = rawProfAm !== '' && !isNaN(Number(rawProfAm)) ? Number(rawProfAm) : 0;
    const rowProfDeal = rawProfDeal !== '' && !isNaN(Number(rawProfDeal)) ? Number(rawProfDeal) : 25;
    const rowMisc = rawMisc !== '' && !isNaN(Number(rawMisc)) ? Number(rawMisc) : 0;
    const rowMinStock = rawMinStock !== '' && !isNaN(Number(rawMinStock)) ? Number(rawMinStock) : 0;
    const disableRestock = String(rawDisableAlert).toLowerCase() === 'yes' || String(rawDisableAlert).toLowerCase() === 'true' || rawDisableAlert === 1;

    let matchedSupplier = existingSuppliers.find(
      s => s.name.trim().toUpperCase() === String(rawSupplier).trim().toUpperCase()
    );

    if (!matchedSupplier && rawSupplier && String(rawSupplier).trim() !== '') {
      matchedSupplier = {
        id: `sup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: String(rawSupplier).trim().toUpperCase(),
        phone: '',
        address: '',
        gstin: '',
        openingBalance: 0,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      db.saveSupplier(matchedSupplier);
      existingSuppliers.push(matchedSupplier);
      createdSuppliers.push(matchedSupplier);
    }

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
      disableRestockNotification: disableRestock,
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

  // 1. Items Master Sheet (ALL Fields included)
  if (dataset.items && dataset.items.length > 0) {
    const itemRows = dataset.items.map(it => {
      const stock = StockEngine.getItemCurrentStock(it.id);
      return {
        'S.No': it.sno,
        'Item Name': it.name,
        'HSN Code': it.hsn || '',
        'Description': it.description || '',
        'Category': it.category,
        'Supplier Name': it.supplierName || '',
        'Primary Unit': it.unit,
        'Base Price (Purchase Rate)': it.purchaseRate,
        'GST %': it.gstPercent,
        'Transport %': it.unitA?.tranPercent ?? 10,
        'Amateur Profit %': it.profPercentAm ?? it.unitA?.profPercentAm ?? 0,
        'Dealer Profit %': it.profPercentDeal ?? it.unitA?.profPercentDeal ?? 0,
        'Misc %': it.unitA?.misPercent ?? 0,
        'Sale Price (Dealer)': it.saleRate,
        'MRP (Amateur)': it.mrp ?? it.saleRate,
        'Has Secondary Unit': it.hasSecondaryUnit ? 'Yes' : 'No',
        'Secondary Unit (Unit B)': it.unitB?.unitName || '',
        'Unit B Conversion (1A = B)': it.unitB?.conversionFactor || '',
        'Unit B Basic Price': it.unitB?.basicPrice || '',
        'Unit B GST %': it.unitB?.gstPercent || '',
        'Unit B Transport %': it.unitB?.tranPercent || '',
        'Unit B Amateur Profit %': it.unitB?.profPercentAm || '',
        'Unit B Dealer Profit %': it.unitB?.profPercentDeal || '',
        'Unit B Misc %': it.unitB?.misPercent || '',
        'Unit B Sale Price': it.unitB?.salePrice || '',
        'Unit B MRP': it.unitB?.mrp || '',
        'Min Stock': it.minStock,
        'Opening Stock': it.openingStock,
        'Current Stock Level': stock,
        'Status': it.isActive !== false ? 'Active' : 'Inactive',
        'Disable Restock Alert': it.disableRestockNotification ? 'Yes' : 'No'
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
          'Received Date': p.recdDate || p.billDate,
          'Supplier Name': p.supplierName,
          'Linked Order ID': p.orderId || '',
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

  // 8. Physical Stock Audits Sheet
  if (dataset.physicalStockAudits && dataset.physicalStockAudits.length > 0) {
    const auditRows: any[] = [];
    dataset.physicalStockAudits.forEach(audit => {
      (audit.items || []).forEach(it => {
        auditRows.push({
          'Audit Voucher No': audit.auditNo,
          'Audit Date': audit.auditDate,
          'Item Code': it.itemCode || '',
          'Item Name': it.itemName,
          'Category': it.category || '',
          'Unit': it.unit,
          'System Book Stock': it.systemStock,
          'Physical Count Stock': it.physicalStock,
          'Variance Qty': it.diffQty,
          'Unit Purchase Rate (₹)': it.rate,
          'Variance Value (₹)': it.diffValue,
          'Status': it.diffQty === 0 ? 'MATCHED' : it.diffQty > 0 ? `SURPLUS (+${it.diffQty})` : `SHORTAGE (${it.diffQty})`,
          'Audit Notes': audit.notes || ''
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(auditRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Physical_Stock_Audits');
  }

  // 9. Stock Adjustments Sheet
  if (dataset.adjustments && dataset.adjustments.length > 0) {
    const adjRows = dataset.adjustments.map(a => ({
      'Adjustment No': a.adjustmentNo,
      'Date': a.date,
      'Item Name': a.itemName,
      'Previous Stock': a.previousStock,
      'Counted Stock': a.newStock,
      'Difference': a.difference,
      'Type': a.type,
      'Reason': a.reason,
      'Adjusted By': a.adjustedBy
    }));
    const ws = XLSX.utils.json_to_sheet(adjRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Stock_Adjustments');
  }

  // 10. Customer Payment Logs Sheet
  if (dataset.partyLogs && dataset.partyLogs.length > 0) {
    const partyLogRows = dataset.partyLogs.map(l => ({
      'Log ID': l.id,
      'Date': l.date,
      'Party Name': l.partyName,
      'Type': l.type,
      'Ref No': l.refNo,
      'Payment Mode': l.paymentMode || 'CASH',
      'Total Amount (₹)': l.totalAmount,
      'Paid Amount (₹)': l.paidAmount,
      'Balance Change (₹)': l.balanceChange,
      'Running Balance (₹)': l.runningBalance ?? 0,
      'Notes': l.notes || ''
    }));
    const ws = XLSX.utils.json_to_sheet(partyLogRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Customer_Payments');
  }

  // 11. Supplier Payment Logs Sheet
  if (dataset.supplierLogs && dataset.supplierLogs.length > 0) {
    const supplierLogRows = dataset.supplierLogs.map(l => ({
      'Log ID': l.id,
      'Date': l.date,
      'Supplier Name': l.supplierName,
      'Type': l.type,
      'Ref No': l.refNo,
      'Payment Mode': l.paymentMode || 'CASH',
      'Total Amount (₹)': l.totalAmount,
      'Paid Amount (₹)': l.paidAmount,
      'Balance Change (₹)': l.balanceChange,
      'Running Balance (₹)': l.runningBalance ?? 0,
      'Notes': l.notes || ''
    }));
    const ws = XLSX.utils.json_to_sheet(supplierLogRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Supplier_Payments');
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
    let physicalStockAuditsCount = 0;
    let partyLogsCount = 0;
    let supplierLogsCount = 0;

    sheetNames.forEach(name => {
      const lower = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const sheet = wb.Sheets[name];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (lower.includes('physical') || lower.includes('audit')) physicalStockAuditsCount = rows.length;
      else if (lower.includes('custpay') || lower.includes('partylog') || (lower.includes('customer') && lower.includes('pay'))) partyLogsCount = rows.length;
      else if (lower.includes('supppay') || lower.includes('supplierlog') || (lower.includes('supplier') && lower.includes('pay'))) supplierLogsCount = rows.length;
      else if (lower.includes('item') || lower.includes('material')) itemsCount = rows.length;
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

    const totalRecords = itemsCount + partiesCount + suppliersCount + salesCount + purchasesCount + ordersCount + selfUseCount + adjustmentsCount + physicalStockAuditsCount + partyLogsCount + supplierLogsCount;
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
      physicalStockAuditsCount,
      partyLogsCount,
      supplierLogsCount,
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
      selfUse: 0,
      physicalStockAudits: 0,
      customerPayments: 0,
      supplierPayments: 0
    };

    wb.SheetNames.forEach(sheetName => {
      const lower = sheetName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const sheet = wb.Sheets[sheetName];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      // 1. Items Sheet (All fields including Disable Restock Alert & Unit B)
      if (lower.includes('item') || lower.includes('material')) {
        rows.forEach(r => {
          const name = String(getColumnValue(r, ['itemname', 'item', 'name', 'material', 'product'])).trim();
          if (!name) return;

          const basePrice = Number(getColumnValue(r, ['basepricepurchaserate', 'baseprice', 'purchaserate', 'purcrate', 'rate', 'price'])) || 0;
          const gstVal = getColumnValue(r, ['gst', 'gstpercent', 'gst%']);
          const gst = gstVal !== '' && !isNaN(Number(gstVal)) ? Number(gstVal) : 0;
          const tranVal = getColumnValue(r, ['transport', 'tranpercent', 'tran%', 'tran']);
          const tran = tranVal !== '' && !isNaN(Number(tranVal)) ? Number(tranVal) : 10;
          const profAmVal = getColumnValue(r, ['profam', 'profpercentam', 'amateurmargin', 'amateurprofit', 'amateur%']);
          const profAm = profAmVal !== '' && !isNaN(Number(profAmVal)) ? Number(profAmVal) : 0;
          const profDealVal = getColumnValue(r, ['profdeal', 'profpercentdeal', 'profit', 'profpercent', 'dealermargin', 'dealerprofit', 'dealer%']);
          const profDeal = profDealVal !== '' && !isNaN(Number(profDealVal)) ? Number(profDealVal) : 25;
          const miscVal = getColumnValue(r, ['misc', 'mispercent', 'misc%', 'mis']);
          const misc = miscVal !== '' && !isNaN(Number(miscVal)) ? Number(miscVal) : 0;
          const sno = String(getColumnValue(r, ['sno', 'serialno', 'code', 'itemcode', 'empty'])) || '';
          const hsn = String(getColumnValue(r, ['hsn', 'hsncode'])) || '';
          const description = String(getColumnValue(r, ['description', 'desc'])) || '';
          const category = String(getColumnValue(r, ['category', 'catagary', 'catagory', 'group'])) || 'GENERAL';
          const supplierName = String(getColumnValue(r, ['suppliername', 'supplier', 'vendor'])) || '';

          // Secondary Unit B details
          const rawHasSecondary = getColumnValue(r, ['hassecondaryunit', 'secondaryunitactive', 'hasunitb']);
          const hasSecondaryUnit = String(rawHasSecondary).toLowerCase() === 'yes' || String(rawHasSecondary).toLowerCase() === 'true' || Boolean(getColumnValue(r, ['secondaryunitunitb', 'secondaryunit', 'unitbname']));
          const unitBName = String(getColumnValue(r, ['secondaryunitunitb', 'secondaryunit', 'unitbname', 'unitb'])) || '';
          const unitBConversion = Number(getColumnValue(r, ['unitbconversion1ab', 'unitbconversion', 'conversionfactor', 'conversion'])) || 1;
          const unitBBasePrice = Number(getColumnValue(r, ['unitbbasicprice', 'unitbprice', 'unitbrate'])) || (basePrice / (unitBConversion || 1));
          const unitBGst = Number(getColumnValue(r, ['unitbgst', 'unitbgstpercent'])) || gst;
          const unitBTran = Number(getColumnValue(r, ['unitbtransport', 'unitbtranpercent'])) || tran;
          const unitBProfAm = Number(getColumnValue(r, ['unitbamateurprofit', 'unitbprofam'])) || profAm;
          const unitBProfDeal = Number(getColumnValue(r, ['unitbdealerprofit', 'unitbprofdeal'])) || profDeal;
          const unitBMisc = Number(getColumnValue(r, ['unitbmisc', 'unitbmispercent'])) || misc;

          const rawDisableAlert = getColumnValue(r, ['disablerestockalert', 'disablerestock', 'noalert', 'disablealert']);
          const disableRestockNotification = String(rawDisableAlert).toLowerCase() === 'yes' || String(rawDisableAlert).toLowerCase() === 'true' || rawDisableAlert === 1;

          const unitA = calculateItemUnitBreakdown(basePrice, gst, tran, profAm, misc, 0, undefined, profDeal, 0);
          const unitB = hasSecondaryUnit && unitBName ? calculateItemUnitBreakdown(unitBBasePrice, unitBGst, unitBTran, unitBProfAm, unitBMisc, 0, undefined, unitBProfDeal, 0) : undefined;

          const item: Item = {
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            sno,
            name: name.toUpperCase(),
            hsn,
            description,
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
            hasSecondaryUnit,
            unitA,
            unitB: unitB ? {
              ...unitB,
              unitName: unitBName,
              conversionFactor: unitBConversion,
              basicPrice: unitBBasePrice,
              isActive: true
            } : undefined,
            isActive: String(getColumnValue(r, ['status', 'active'])).toLowerCase() !== 'inactive',
            disableRestockNotification,
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
          const isCreditSale = String(getColumnValue(firstRow, ['iscreditsale', 'credit'])).toLowerCase() === 'yes';

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
            isCreditSale,
            items: saleItems,
            basicTotal: saleItems.reduce((acc, it) => acc + (it.basicPrice * it.qty), 0),
            gstTotal: saleItems.reduce((acc, it) => acc + (it.gstAmt * it.qty), 0),
            roundUp: 0,
            billTotal: grandTotal || saleItems.reduce((acc, it) => acc + it.amount, 0),
            recdCash,
            recdUpi,
            balanceDue: isCreditSale ? Math.max(0, grandTotal - (recdCash + recdUpi)) : 0,
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
          const recdDate = String(getColumnValue(firstRow, ['receiveddate', 'recddate'])) || billDate;
          const grandTotal = Number(getColumnValue(firstRow, ['billgrandtotal', 'grandtotal', 'amount'])) || 0;
          const orderId = String(getColumnValue(firstRow, ['linkedorderid', 'orderid'])) || '';

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
            recdDate,
            supplierId: '',
            supplierName,
            orderId: orderId || undefined,
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

      // 8. Physical Stock Audits Sheet
      if (lower.includes('physical') || lower.includes('audit')) {
        const auditsByVoucher = new Map<string, any[]>();
        rows.forEach(r => {
          const auditNo = String(getColumnValue(r, ['auditvoucherno', 'voucherno', 'auditno', 'voucher'])).trim();
          if (!auditNo) return;
          if (!auditsByVoucher.has(auditNo)) auditsByVoucher.set(auditNo, []);
          auditsByVoucher.get(auditNo)!.push(r);
        });

        auditsByVoucher.forEach((vRows, auditNo) => {
          const firstRow = vRows[0];
          const auditDate = String(getColumnValue(firstRow, ['auditdate', 'date'])) || new Date().toISOString().split('T')[0];
          const notes = String(getColumnValue(firstRow, ['auditnotes', 'notes', 'remarks'])).trim();

          const auditItems = vRows.map(ar => {
            const itemCode = String(getColumnValue(ar, ['itemcode', 'code', 'sno'])) || '';
            const itemName = String(getColumnValue(ar, ['itemname', 'item'])).trim();
            const category = String(getColumnValue(ar, ['category', 'group'])) || '';
            const unit = String(getColumnValue(ar, ['unit'])) || 'Pcs';
            const systemStock = Number(getColumnValue(ar, ['systembookstock', 'systemstock'])) || 0;
            const physicalStock = Number(getColumnValue(ar, ['physicalcountstock', 'physicalstock'])) || 0;
            const diffQty = Number(getColumnValue(ar, ['varianceqty', 'diffqty'])) || (physicalStock - systemStock);
            const rate = Number(getColumnValue(ar, ['unitpurchaserate', 'rate'])) || 0;
            const diffValue = Number(getColumnValue(ar, ['variancevalue', 'diffvalue'])) || (diffQty * rate);

            return {
              itemId: `item-gen-${Date.now()}`,
              itemName,
              itemCode,
              category,
              unit,
              systemStock,
              physicalStock,
              diffQty,
              rate,
              diffValue
            };
          });

          const auditRecord: PhysicalStockAudit = {
            id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            auditNo,
            auditDate,
            notes: notes || undefined,
            items: auditItems,
            totalSystemQty: auditItems.reduce((acc, it) => acc + it.systemStock, 0),
            totalPhysicalQty: auditItems.reduce((acc, it) => acc + it.physicalStock, 0),
            totalDiffQty: auditItems.reduce((acc, it) => acc + it.diffQty, 0),
            totalDiffValue: auditItems.reduce((acc, it) => acc + it.diffValue, 0),
            createdAt: new Date().toISOString()
          };
          db.savePhysicalStockAudit(auditRecord);
          restoredCounts.physicalStockAudits += 1;
        });
      }

      // 9. Customer Payment Logs Sheet
      if (lower.includes('custpay') || lower.includes('partylog') || (lower.includes('customer') && lower.includes('pay'))) {
        rows.forEach(r => {
          const partyName = String(getColumnValue(r, ['partyname', 'party', 'customer'])).trim();
          if (!partyName) return;

          const date = String(getColumnValue(r, ['date'])) || new Date().toISOString().split('T')[0];
          const paymentMode = String(getColumnValue(r, ['paymentmode', 'mode'])).toUpperCase() || 'CASH';
          const paidAmount = Number(getColumnValue(r, ['paidamount', 'amountpaid', 'amount'])) || 0;
          const totalAmount = Number(getColumnValue(r, ['totalamount', 'total', 'amount'])) || paidAmount;
          const balanceChange = Number(getColumnValue(r, ['balancechange'])) || (0 - paidAmount);
          const runningBalance = Number(getColumnValue(r, ['runningbalance'])) || 0;
          const refNo = String(getColumnValue(r, ['refno', 'receiptno', 'referenceno'])) || `RCPT-${Date.now().toString().slice(-4)}`;
          const type = (String(getColumnValue(r, ['type'])).toUpperCase() || 'PAYMENT') as any;

          const log: PartyLog = {
            id: String(getColumnValue(r, ['logid', 'id'])) || `plog-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            partyId: '',
            partyName,
            date,
            type,
            refNo,
            paymentMode,
            totalAmount,
            paidAmount,
            balanceChange,
            runningBalance,
            notes: String(getColumnValue(r, ['notes', 'remarks'])),
            createdAt: new Date().toISOString()
          };
          db.savePartyLog(log);
          restoredCounts.customerPayments += 1;
        });
      }

      // 10. Supplier Payment Logs Sheet
      if (lower.includes('supppay') || lower.includes('supplierlog') || (lower.includes('supplier') && lower.includes('pay'))) {
        rows.forEach(r => {
          const supplierName = String(getColumnValue(r, ['suppliername', 'supplier', 'vendor'])).trim();
          if (!supplierName) return;

          const date = String(getColumnValue(r, ['date'])) || new Date().toISOString().split('T')[0];
          const paymentMode = String(getColumnValue(r, ['paymentmode', 'mode'])).toUpperCase() || 'CASH';
          const paidAmount = Number(getColumnValue(r, ['paidamount', 'amountpaid', 'amount'])) || 0;
          const totalAmount = Number(getColumnValue(r, ['totalamount', 'total', 'amount'])) || paidAmount;
          const balanceChange = Number(getColumnValue(r, ['balancechange'])) || (0 - paidAmount);
          const runningBalance = Number(getColumnValue(r, ['runningbalance'])) || 0;
          const refNo = String(getColumnValue(r, ['refno', 'voucherno', 'referenceno'])) || `PAY-${Date.now().toString().slice(-4)}`;
          const type = (String(getColumnValue(r, ['type'])).toUpperCase() || 'PAYMENT') as any;

          const log: SupplierLog = {
            id: String(getColumnValue(r, ['logid', 'id'])) || `slog-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            supplierId: '',
            supplierName,
            date,
            type,
            refNo,
            paymentMode,
            totalAmount,
            paidAmount,
            balanceChange,
            runningBalance,
            notes: String(getColumnValue(r, ['notes', 'remarks'])),
            createdAt: new Date().toISOString()
          };
          db.saveSupplierLog(log);
          restoredCounts.supplierPayments += 1;
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
    db.pushAllToCloudFirestore().catch(() => { });

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
 * Generates and downloads a complete Sample Restore Excel Template with pre-filled examples and instructions
 */
export function downloadSampleRestoreExcelTemplate() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: INSTRUCTIONS & GUIDE
  const guideRows = [
    { 'Topic': 'How to Use', 'Details': 'This template shows the exact sheet names and column structures accepted by the system restore tool.' },
    { 'Topic': 'Sheet Names', 'Details': 'Items, Suppliers, Parties, Sales, Purchases, Orders, Self_Use, Physical_Stock_Audits, Customer_Payments, Supplier_Payments' },
    { 'Topic': 'Item Master', 'Details': 'Includes Primary Unit A, Secondary Unit B, conversion factors, purchase rates, profit % margins, and Disable Restock Alert (Yes/No).' },
    { 'Topic': 'Parties Master', 'Details': 'Party Type can be DEALER or AMATEUR. Configure custom dealer profit % or amateur profit %.' },
    { 'Topic': 'Dates Format', 'Details': 'Use standard YYYY-MM-DD format (e.g. 2026-09-10).' },
    { 'Topic': 'Status Values', 'Details': 'Active / Inactive, or Yes / No.' },
    { 'Topic': 'Restoring Data', 'Details': 'Go to SETTING > RESTORE tab, click "Browse Excel Backup (.xlsx)", preview the record counts, and click "Restore Database".' }
  ];
  const wsGuide = XLSX.utils.json_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 20 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'INSTRUCTIONS');

  // Sheet 2: Items Master
  const sampleItems = [
    {
      'S.No': '101',
      'Item Name': 'ASTER PRINTING ROLL 70 GSM',
      'HSN Code': '4802',
      'Description': 'Premium Grade 70 GSM Roll',
      'Category': 'PRINTING PAPER',
      'Supplier Name': 'SUPREME PAPER MILLS',
      'Primary Unit': 'Roll',
      'Base Price (Purchase Rate)': 1200,
      'GST %': 18,
      'Transport %': 10,
      'Amateur Profit %': 30,
      'Dealer Profit %': 25,
      'Misc %': 2,
      'Sale Price (Dealer)': 1750,
      'MRP (Amateur)': 1850,
      'Has Secondary Unit': 'Yes',
      'Secondary Unit (Unit B)': 'Mt.',
      'Unit B Conversion (1A = B)': 40,
      'Unit B Basic Price': 30,
      'Unit B GST %': 18,
      'Unit B Transport %': 10,
      'Unit B Amateur Profit %': 30,
      'Unit B Dealer Profit %': 25,
      'Unit B Misc %': 2,
      'Unit B Sale Price': 45,
      'Unit B MRP': 50,
      'Min Stock': 10,
      'Opening Stock': 25,
      'Status': 'Active',
      'Disable Restock Alert': 'No'
    },
    {
      'S.No': '102',
      'Item Name': 'GLOSSY PHOTO SHEET A4',
      'HSN Code': '3701',
      'Description': 'Glossy photo paper 200 GSM',
      'Category': 'PHOTO PAPER',
      'Supplier Name': 'COLOR LAB SUPPLIERS',
      'Primary Unit': 'Pkt',
      'Base Price (Purchase Rate)': 350,
      'GST %': 18,
      'Transport %': 5,
      'Amateur Profit %': 40,
      'Dealer Profit %': 30,
      'Misc %': 0,
      'Sale Price (Dealer)': 520,
      'MRP (Amateur)': 580,
      'Has Secondary Unit': 'No',
      'Secondary Unit (Unit B)': '',
      'Unit B Conversion (1A = B)': '',
      'Unit B Basic Price': '',
      'Unit B GST %': '',
      'Unit B Transport %': '',
      'Unit B Amateur Profit %': '',
      'Unit B Dealer Profit %': '',
      'Unit B Misc %': '',
      'Unit B Sale Price': '',
      'Unit B MRP': '',
      'Min Stock': 20,
      'Opening Stock': 50,
      'Status': 'Active',
      'Disable Restock Alert': 'Yes'
    }
  ];
  const wsItems = XLSX.utils.json_to_sheet(sampleItems);
  XLSX.utils.book_append_sheet(wb, wsItems, 'Items');

  // Sheet 3: Suppliers
  const sampleSuppliers = [
    {
      'Supplier ID': 'sup-101',
      'Firm Name': 'SUPREME PAPER MILLS',
      'Proprietor': 'Rajesh Sharma',
      'Mobile 1': '9876543210',
      'Mobile 2': '9876543211',
      'Contact Person 1': 'Amit Kumar',
      'Contact Person 2': '',
      'Address': 'Plot 45, Industrial Area',
      'Block': 'Phase 2',
      'District': 'Ludhiana',
      'City': 'Ludhiana',
      'State': 'Punjab',
      'GSTIN': '03AAAAA1234A1Z5',
      'Email': 'supremepaper@example.com',
      'Opening Balance': 15000,
      'Active': 'Yes'
    }
  ];
  const wsSuppliers = XLSX.utils.json_to_sheet(sampleSuppliers);
  XLSX.utils.book_append_sheet(wb, wsSuppliers, 'Suppliers');

  // Sheet 4: Parties
  const sampleParties = [
    {
      'Party ID': 'pty-101',
      'Firm Name': 'ROYAL PRINTERS',
      'Party Type': 'DEALER',
      'Dealer Profit %': 20,
      'Amateur Profit %': '',
      'Proprietor': 'Vikram Singh',
      'Mobile 1': '9123456780',
      'Mobile 2': '',
      'Contact Person 1': 'Rohan',
      'Contact Person 2': '',
      'Address': 'Shop 12, Main Market',
      'Block': 'Sector 14',
      'District': 'Chandigarh',
      'City': 'Chandigarh',
      'State': 'Chandigarh',
      'GSTIN': '04BBBBB5678B1Z2',
      'Email': 'royalprinters@example.com',
      'Opening Balance': 8500,
      'Credit Limit': 50000,
      'Allow Credit': 'Yes',
      'Active': 'Yes'
    }
  ];
  const wsParties = XLSX.utils.json_to_sheet(sampleParties);
  XLSX.utils.book_append_sheet(wb, wsParties, 'Parties');

  // Sheet 5: Sales
  const sampleSales = [
    {
      'Bill No': 'SL-101',
      'Bill Date': '2026-09-08',
      'Party Name': 'ROYAL PRINTERS',
      'Item Name': 'ASTER PRINTING ROLL 70 GSM',
      'Item S.No': '101',
      'Qty': 5,
      'Unit': 'Roll',
      'Basic Price': 1200,
      'GST %': 18,
      'GST Amount': 216,
      'Nett Price': 1416,
      'Sale Price': 1750,
      'Line Amount': 8750,
      'Bill Grand Total': 8750,
      'Recd Cash': 5000,
      'Recd UPI': 0,
      'Is Credit Sale': 'Yes'
    }
  ];
  const wsSales = XLSX.utils.json_to_sheet(sampleSales);
  XLSX.utils.book_append_sheet(wb, wsSales, 'Sales');

  // Sheet 6: Purchases
  const samplePurchases = [
    {
      'Bill No': 'PU-101',
      'Bill Date': '2026-09-05',
      'Received Date': '2026-09-05',
      'Supplier Name': 'SUPREME PAPER MILLS',
      'Linked Order ID': '',
      'Item Name': 'ASTER PRINTING ROLL 70 GSM',
      'Item S.No': '101',
      'Qty Inwarded': 20,
      'Unit': 'Roll',
      'Basic Price': 1200,
      'GST %': 18,
      'GST Amount': 216,
      'Nett Price': 1416,
      'Line Amount': 28320,
      'Bill Grand Total': 28320
    }
  ];
  const wsPurchases = XLSX.utils.json_to_sheet(samplePurchases);
  XLSX.utils.book_append_sheet(wb, wsPurchases, 'Purchases');

  // Sheet 7: Orders
  const sampleOrders = [
    {
      'Order Number': 'ORD-101',
      'Order Date': '2026-09-01',
      'Supplier Name': 'SUPREME PAPER MILLS',
      'Status': 'RECEIVED',
      'Item Name': 'ASTER PRINTING ROLL 70 GSM',
      'Ordered Qty': 20,
      'Received Qty': 20,
      'Unit': 'Roll',
      'Description': 'Urgent Stock Order',
      'Notes': 'Delivery within 3 days'
    }
  ];
  const wsOrders = XLSX.utils.json_to_sheet(sampleOrders);
  XLSX.utils.book_append_sheet(wb, wsOrders, 'Orders');

  // Sheet 8: Self Use
  const sampleSelfUse = [
    {
      'Voucher No': 'SU-101',
      'Date': '2026-09-07',
      'Category': 'OFFICE PRINTING',
      'Item Name': 'GLOSSY PHOTO SHEET A4',
      'Qty Consumed': 2,
      'Unit': 'Pkt',
      'Rate': 350,
      'Amount': 700,
      'Purpose': 'Internal Sample Testing'
    }
  ];
  const wsSelfUse = XLSX.utils.json_to_sheet(sampleSelfUse);
  XLSX.utils.book_append_sheet(wb, wsSelfUse, 'Self_Use');

  // Sheet 9: Physical Stock Audits
  const samplePhysicalAudits = [
    {
      'Audit Voucher No': 'PHY-101',
      'Audit Date': '2026-09-09',
      'Item Code': '101',
      'Item Name': 'ASTER PRINTING ROLL 70 GSM',
      'Category': 'PRINTING PAPER',
      'Unit': 'Roll',
      'System Book Stock': 40,
      'Physical Count Stock': 38,
      'Variance Qty': -2,
      'Unit Purchase Rate (₹)': 1200,
      'Variance Value (₹)': -2400,
      'Status': 'SHORTAGE (-2)',
      'Audit Notes': 'Monthly Physical Verification'
    }
  ];
  const wsAudits = XLSX.utils.json_to_sheet(samplePhysicalAudits);
  XLSX.utils.book_append_sheet(wb, wsAudits, 'Physical_Stock_Audits');

  // Sheet 10: Customer Payments
  const samplePartyPayments = [
    {
      'Log ID': 'plog-101',
      'Date': '2026-09-09',
      'Party Name': 'ROYAL PRINTERS',
      'Type': 'PAYMENT',
      'Ref No': 'RCPT-1001',
      'Payment Mode': 'UPI',
      'Total Amount (₹)': 3750,
      'Paid Amount (₹)': 3750,
      'Balance Change (₹)': -3750,
      'Running Balance (₹)': 0,
      'Notes': 'Cleared balance for bill SL-101'
    }
  ];
  const wsPartyPayments = XLSX.utils.json_to_sheet(samplePartyPayments);
  XLSX.utils.book_append_sheet(wb, wsPartyPayments, 'Customer_Payments');

  // Sheet 11: Supplier Payments
  const sampleSupplierPayments = [
    {
      'Log ID': 'slog-101',
      'Date': '2026-09-06',
      'Supplier Name': 'SUPREME PAPER MILLS',
      'Type': 'PAYMENT',
      'Ref No': 'PAY-1001',
      'Payment Mode': 'NEFT',
      'Total Amount (₹)': 15000,
      'Paid Amount (₹)': 15000,
      'Balance Change (₹)': -15000,
      'Running Balance (₹)': 0,
      'Notes': 'Advance payment for order ORD-101'
    }
  ];
  const wsSupplierPayments = XLSX.utils.json_to_sheet(sampleSupplierPayments);
  XLSX.utils.book_append_sheet(wb, wsSupplierPayments, 'Supplier_Payments');

  XLSX.writeFile(wb, 'RMMS_Sample_Restore_Template.xlsx');
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
