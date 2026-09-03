import * as XLSX from 'xlsx';
import { db } from '../db/db';
import { StockEngine } from '../db/stockEngine';
import { formatDateToDisplay } from './dateUtils';

export interface ExportFilterOptions {
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  isFullHistory: boolean;
  modules: {
    orders: boolean;
    purchases: boolean;
    sales: boolean;
    selfUse: boolean;
    parties: boolean;
    suppliers: boolean;
    items: boolean;
    adjustments: boolean;
    settings: boolean;
  };
}

/**
 * Filters array of objects by date field
 */
function filterByDateRange<T>(items: T[], dateField: keyof T, fromDate: string, toDate: string, isFullHistory: boolean): T[] {
  if (isFullHistory) return items;
  return items.filter(item => {
    const itemDate = String(item[dateField] || '');
    if (!itemDate) return true;
    return itemDate >= fromDate && itemDate <= toDate;
  });
}

/**
 * Builds the structured export dataset based on user options
 */
export function buildExportDataset(options: ExportFilterOptions) {
  const { fromDate, toDate, isFullHistory, modules } = options;

  const allSales = db.getSales();
  const allPurchases = db.getPurchases();
  const allOrders = db.getOrders();
  const allSelfUses = db.getSelfUses();
  const allAdjustments = db.getStockAdjustments();
  const allItems = db.getItems();
  const allParties = db.getParties();
  const allSuppliers = db.getSuppliers();
  const settings = db.getSettings();

  return {
    sales: modules.sales ? filterByDateRange(allSales, 'billDate', fromDate, toDate, isFullHistory) : [],
    purchases: modules.purchases ? filterByDateRange(allPurchases, 'billDate', fromDate, toDate, isFullHistory) : [],
    orders: modules.orders ? filterByDateRange(allOrders, 'orderDate', fromDate, toDate, isFullHistory) : [],
    selfUses: modules.selfUse ? filterByDateRange(allSelfUses, 'billDate', fromDate, toDate, isFullHistory) : [],
    adjustments: modules.adjustments ? filterByDateRange(allAdjustments, 'date', fromDate, toDate, isFullHistory) : [],
    items: modules.items ? allItems : [],
    parties: modules.parties ? allParties : [],
    suppliers: modules.suppliers ? allSuppliers : [],
    settings: modules.settings ? settings : undefined
  };
}

/**
 * Generates and downloads a multi-sheet Excel (.xlsx) file
 */
export function downloadExcelBackup(options: ExportFilterOptions, filenameBase = 'RMMS_Backup') {
  const dataset = buildExportDataset(options);
  const wb = XLSX.utils.book_new();

  // 1. ITEMS & STOCK MASTER SHEET
  if (options.modules.items && dataset.items.length > 0) {
    const itemsRows = dataset.items.map(it => {
      const currentStock = StockEngine.getItemCurrentStock(it.id);
      return {
        'S.No': it.sno,
        'Item Name': it.name,
        'Description': it.description || '',
        'Category': it.category,
        'Supplier Name': it.supplierName || '',
        'Primary Unit': it.unit,
        'Min Stock (Reorder)': it.minStock,
        'Opening Stock': it.openingStock,
        'Purchase Rate (Basic)': it.purchaseRate,
        'Sale Rate': it.saleRate,
        'GST %': it.gstPercent,
        'Current Stock Level': currentStock,
        'Status': it.isActive !== false ? 'Active' : 'Inactive'
      };
    });
    const ws = XLSX.utils.json_to_sheet(itemsRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Items Master & Stock');
  }

  // 2. SALES INVOICES SHEET
  if (options.modules.sales && dataset.sales.length > 0) {
    const salesRows: any[] = [];
    dataset.sales.forEach(s => {
      s.items.forEach(it => {
        salesRows.push({
          'Bill No': s.billNo,
          'Bill Date': formatDateToDisplay(s.billDate),
          'Party / Customer': s.partyName,
          'Item S.No': it.sno,
          'Item Name': it.itemName,
          'Qty': it.qty,
          'Basic Price': it.basicPrice,
          'GST %': it.gstPercent,
          'GST Amt': it.gstAmt,
          'Nett Price': it.nettPrice,
          'Sale Price': it.salePrice,
          'Amount (₹)': it.amount,
          'Bill Basic Total (₹)': s.basicTotal,
          'Bill GST Total (₹)': s.gstTotal,
          'Bill Grand Total (₹)': s.billTotal,
          'Recd Cash (₹)': s.recdCash,
          'Recd UPI (₹)': s.recdUpi
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(salesRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Invoices');
  }

  // 3. PURCHASES SHEET
  if (options.modules.purchases && dataset.purchases.length > 0) {
    const purchaseRows: any[] = [];
    dataset.purchases.forEach(p => {
      p.items.forEach(it => {
        purchaseRows.push({
          'Bill No': p.billNo,
          'Bill Date': formatDateToDisplay(p.billDate),
          'Received Date': formatDateToDisplay(p.recdDate || p.billDate),
          'Supplier Name': p.supplierName,
          'Linked Order ID': p.orderId || '',
          'Item S.No': it.sno,
          'Item Name': it.itemName,
          'Qty Inwarded': it.qty,
          'Basic Price': it.basicPrice,
          'GST %': it.gstPercent,
          'GST Amt': it.gstAmt,
          'Nett Price': it.nettPrice,
          'Amount (₹)': it.amount,
          'Bill Grand Total (₹)': p.billTotal
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(purchaseRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Purchases (Inward)');
  }

  // 4. ORDERS SHEET
  if (options.modules.orders && dataset.orders.length > 0) {
    const orderRows: any[] = [];
    dataset.orders.forEach(o => {
      o.items.forEach(it => {
        orderRows.push({
          'Order Number': o.orderNumber,
          'Order Date': formatDateToDisplay(o.orderDate),
          'Supplier Name': o.supplierName,
          'Order Status': o.status,
          'Item S.No': it.sno,
          'Item Name': it.itemName,
          'Description': it.description || '',
          'Ordered Qty': it.orderedQty,
          'Received Qty': it.receivedQty || 0,
          'Order Remark / Note': o.notes || ''
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(orderRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Supplier Orders');
  }

  // 5. SELF USE SHEET
  if (options.modules.selfUse && dataset.selfUses.length > 0) {
    const selfUseRows: any[] = [];
    dataset.selfUses.forEach(su => {
      su.items.forEach(it => {
        selfUseRows.push({
          'Voucher No': su.billNo,
          'Date': formatDateToDisplay(su.billDate),
          'Category': su.category || '',
          'Item S.No': it.sno,
          'Item Name': it.itemName,
          'Qty Consumed': it.qty,
          'Rate': it.rate,
          'Amount (₹)': it.amount,
          'Purpose / Reason': su.reason || su.remarks || ''
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(selfUseRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Self Use');
  }

  // 6. PARTIES MASTER SHEET
  if (options.modules.parties && dataset.parties.length > 0) {
    const partyRows = dataset.parties.map(p => ({
      'Firm Name': p.name,
      'Proprietor': p.propName || '',
      'Mobile 1': p.phone,
      'Mobile 2': p.phone2 || '',
      'Email': p.email || '',
      'Address': p.address,
      'Block': p.block || '',
      'District': p.distt || '',
      'City': p.city || '',
      'State': p.state || '',
      'GSTIN': p.gstin,
      'Opening Balance (₹)': p.openingBalance,
      'Credit Limit (₹)': p.creditLimit,
      'Active': p.isActive !== false ? 'Yes' : 'No'
    }));
    const ws = XLSX.utils.json_to_sheet(partyRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Party Master');
  }

  // 7. SUPPLIERS MASTER SHEET
  if (options.modules.suppliers && dataset.suppliers.length > 0) {
    const supplierRows = dataset.suppliers.map(s => ({
      'Firm Name': s.name,
      'Proprietor': s.propName || '',
      'Mobile 1': s.phone,
      'Mobile 2': s.phone2 || '',
      'Email': s.email || '',
      'Address': s.address,
      'Block': s.block || '',
      'District': s.distt || '',
      'City': s.city || '',
      'State': s.state || '',
      'GSTIN': s.gstin,
      'Opening Balance (₹)': s.openingBalance,
      'Active': s.isActive !== false ? 'Yes' : 'No'
    }));
    const ws = XLSX.utils.json_to_sheet(supplierRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Supplier Master');
  }

  // 8. STOCK ADJUSTMENTS SHEET
  if (options.modules.adjustments && dataset.adjustments.length > 0) {
    const adjRows = dataset.adjustments.map(a => ({
      'Adjustment No': a.adjustmentNo,
      'Date': formatDateToDisplay(a.date),
      'Item Name': a.itemName,
      'Previous Stock': a.previousStock,
      'Counted Stock': a.newStock,
      'Difference': a.difference,
      'Type': a.type,
      'Audit Reason': a.reason,
      'Adjusted By': a.adjustedBy
    }));
    const ws = XLSX.utils.json_to_sheet(adjRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Adjustments');
  }

  // Download the workbook
  const dateSuffix = options.isFullHistory ? 'Full' : `${options.fromDate}_to_${options.toDate}`;
  XLSX.writeFile(wb, `${filenameBase}_${dateSuffix}.xlsx`);
}

/**
 * Generates and downloads a formatted JSON backup file
 */
export function downloadJSONBackup(options: ExportFilterOptions, filenameBase = 'RMMS_Database_Backup') {
  const dataset = buildExportDataset(options);
  const backupPayload = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    filterOptions: {
      fromDate: options.fromDate,
      toDate: options.toDate,
      isFullHistory: options.isFullHistory
    },
    data: dataset
  };

  const jsonStr = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateSuffix = options.isFullHistory ? 'Full' : `${options.fromDate}_to_${options.toDate}`;
  a.href = url;
  a.download = `${filenameBase}_${dateSuffix}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Downloads BOTH an Excel workbook AND a JSON backup file simultaneously
 */
export function downloadCombinedBackup(options: ExportFilterOptions) {
  downloadExcelBackup(options);
  setTimeout(() => {
    downloadJSONBackup(options);
  }, 400);
}
