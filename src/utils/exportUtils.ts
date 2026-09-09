import * as XLSX from 'xlsx';
import { db } from '../db/db';
import { StockEngine } from '../db/stockEngine';
import { formatDateToDisplay } from './dateUtils';

export interface ExportFilterOptions {
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  isFullHistory?: boolean;
  isCustomDate?: boolean;
  modules: {
    orders?: boolean;
    order?: boolean;
    orderedSection?: boolean;
    purchases?: boolean;
    purchase?: boolean;
    sales?: boolean;
    sale?: boolean;
    selfUse?: boolean;
    parties?: boolean;
    party?: boolean;
    suppliers?: boolean;
    supplier?: boolean;
    items?: boolean;
    item?: boolean;
    adjustments?: boolean;
    openingStock?: boolean;
    settings?: boolean;
    reportSales?: boolean;
    reportPurchases?: boolean;
    reportSelfUse?: boolean;
    reportItemStock?: boolean;
    physicalStockAudits?: boolean;
    partyLogs?: boolean;
    supplierLogs?: boolean;
  };
}

/**
 * Filters array of objects by date field
 */
function filterByDateRange<T>(items: T[], dateField: keyof T, fromDate: string, toDate: string, isFullHistory?: boolean): T[] {
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
  const allPhysicalStockAudits = db.getPhysicalStockAudits();
  const allPartyLogs = db.getPartyLogs();
  const allSupplierLogs = db.getSupplierLogs();
  const allStockMovements = db.getStockMovements();
  const allItems = db.getItems();
  const allParties = db.getParties();
  const allSuppliers = db.getSuppliers();
  const settings = db.getSettings();
  const users = db.getUsers();

  const incSales = !modules || Boolean(modules.sales || modules.sale || modules.reportSales);
  const incPurchases = !modules || Boolean(modules.purchases || modules.purchase || modules.reportPurchases);
  const incOrders = !modules || Boolean(modules.orders || modules.order || modules.orderedSection);
  const incSelfUse = !modules || Boolean(modules.selfUse || modules.reportSelfUse);
  const incAdjustments = !modules || Boolean(modules.adjustments || modules.reportItemStock);
  const incPhysicalStock = !modules || Boolean(modules.physicalStockAudits || modules.reportItemStock);
  const incPartyLogs = !modules || Boolean(modules.partyLogs || modules.parties || modules.party);
  const incSupplierLogs = !modules || Boolean(modules.supplierLogs || modules.suppliers || modules.supplier);
  const incItems = !modules || Boolean(modules.items || modules.item);
  const incParties = !modules || Boolean(modules.parties || modules.party);
  const incSuppliers = !modules || Boolean(modules.suppliers || modules.supplier);
  const incSettings = !modules || Boolean(modules.settings);

  return {
    sales: incSales ? filterByDateRange(allSales, 'billDate', fromDate, toDate, isFullHistory) : [],
    purchases: incPurchases ? filterByDateRange(allPurchases, 'billDate', fromDate, toDate, isFullHistory) : [],
    orders: incOrders ? filterByDateRange(allOrders, 'orderDate', fromDate, toDate, isFullHistory) : [],
    selfUses: incSelfUse ? filterByDateRange(allSelfUses, 'billDate', fromDate, toDate, isFullHistory) : [],
    adjustments: incAdjustments ? filterByDateRange(allAdjustments, 'date', fromDate, toDate, isFullHistory) : [],
    physicalStockAudits: incPhysicalStock ? filterByDateRange(allPhysicalStockAudits, 'auditDate', fromDate, toDate, isFullHistory) : [],
    partyLogs: incPartyLogs ? filterByDateRange(allPartyLogs, 'date', fromDate, toDate, isFullHistory) : [],
    supplierLogs: incSupplierLogs ? filterByDateRange(allSupplierLogs, 'date', fromDate, toDate, isFullHistory) : [],
    stockMovements: filterByDateRange(allStockMovements, 'date', fromDate, toDate, isFullHistory),
    items: incItems ? allItems : [],
    parties: incParties ? allParties : [],
    suppliers: incSuppliers ? allSuppliers : [],
    settings: incSettings ? settings : undefined,
    users
  };
}

/**
 * Generates and downloads a multi-sheet Excel (.xlsx) file
 */
export function downloadExcelBackup(options: ExportFilterOptions, filenameBase = 'RMMS_Backup') {
  const dataset = buildExportDataset(options);
  const wb = XLSX.utils.book_new();

  // 1. ITEMS & STOCK MASTER SHEET (All item fields)
  if (options.modules.items && dataset.items.length > 0) {
    const itemsRows = dataset.items.map(it => {
      const currentStock = StockEngine.getItemCurrentStock(it.id);
      return {
        'S.No': it.sno,
        'Item Name': it.name,
        'HSN Code': it.hsn || '',
        'Description': it.description || '',
        'Category': it.category,
        'Supplier Name': it.supplierName || '',
        'Primary Unit': it.unit,
        'Purchase Rate (Basic Price)': it.purchaseRate,
        'GST %': it.gstPercent,
        'Transport %': it.unitA?.tranPercent ?? 10,
        'Amateur Profit %': it.profPercentAm ?? it.unitA?.profPercentAm ?? 0,
        'Dealer Profit %': it.profPercentDeal ?? it.unitA?.profPercentDeal ?? 0,
        'Misc %': it.unitA?.misPercent ?? 0,
        'Sale Price (Dealer Rate)': it.saleRate,
        'MRP (Amateur Rate)': it.mrp ?? it.saleRate,
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
        'Min Stock (Reorder)': it.minStock,
        'Opening Stock': it.openingStock,
        'Current Stock Level': currentStock,
        'Status': it.isActive !== false ? 'Active' : 'Inactive',
        'Disable Restock Alert': it.disableRestockNotification ? 'Yes' : 'No'
      };
    });
    const ws = XLSX.utils.json_to_sheet(itemsRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Items Master & Stock');
  }

  // 2. SUPPLIERS MASTER SHEET
  if (options.modules.suppliers && dataset.suppliers.length > 0) {
    const supplierRows = dataset.suppliers.map(s => ({
      'Supplier ID': s.id,
      'Firm Name': s.name,
      'Proprietor': s.propName || '',
      'Mobile 1': s.phone,
      'Mobile 2': s.phone2 || '',
      'Contact Person 1': s.contactPerson1 || '',
      'Contact Person 2': s.contactPerson2 || '',
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

  // 3. PARTIES MASTER SHEET
  if (options.modules.parties && dataset.parties.length > 0) {
    const partyRows = dataset.parties.map(p => ({
      'Party ID': p.id,
      'Firm Name': p.name,
      'Party Type': p.partyType || 'AMATEUR',
      'Dealer Profit %': p.dealerProfitPercent ?? '',
      'Amateur Profit %': p.amateurProfitPercent ?? '',
      'Proprietor': p.propName || '',
      'Mobile 1': p.phone,
      'Mobile 2': p.phone2 || '',
      'Contact Person 1': p.contactPerson1 || '',
      'Contact Person 2': p.contactPerson2 || '',
      'Email': p.email || '',
      'Address': p.address,
      'Block': p.block || '',
      'District': p.distt || '',
      'City': p.city || '',
      'State': p.state || '',
      'GSTIN': p.gstin,
      'Opening Balance (₹)': p.openingBalance,
      'Credit Limit (₹)': p.creditLimit,
      'Allow Credit': p.allowCredit ? 'Yes' : 'No',
      'Active': p.isActive !== false ? 'Yes' : 'No'
    }));
    const ws = XLSX.utils.json_to_sheet(partyRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Party Master');
  }

  // 4. SALES INVOICES SHEET
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
          'Unit': it.unit || 'Roll',
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
          'Recd UPI (₹)': s.recdUpi,
          'Is Credit Sale': s.isCreditSale ? 'Yes' : 'No'
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(salesRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Invoices');
  }

  // 5. PURCHASES SHEET
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
          'Unit': it.unit || 'Roll',
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

  // 6. ORDERS SHEET
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
          'Unit': (it as any).unit || '',
          'Order Remark / Note': o.notes || ''
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(orderRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Supplier Orders');
  }

  // 7. SELF USE SHEET
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
          'Unit': it.unit || 'Roll',
          'Rate': it.rate,
          'Amount (₹)': it.amount,
          'Purpose / Reason': su.reason || su.remarks || ''
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(selfUseRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Self Use');
  }

  // 8. PHYSICAL STOCK AUDITS SHEET
  if (dataset.physicalStockAudits && dataset.physicalStockAudits.length > 0) {
    const auditRows: any[] = [];
    dataset.physicalStockAudits.forEach(audit => {
      (audit.items || []).forEach(it => {
        auditRows.push({
          'Audit Voucher No': audit.auditNo,
          'Audit Date': formatDateToDisplay(audit.auditDate),
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
    XLSX.utils.book_append_sheet(wb, ws, 'Physical Stock Audits');
  }

  // 9. STOCK ADJUSTMENTS SHEET
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

  // 10. CUSTOMER PAYMENT LOGS SHEET
  if (dataset.partyLogs && dataset.partyLogs.length > 0) {
    const partyLogRows = dataset.partyLogs.map(l => ({
      'Log ID': l.id,
      'Date': formatDateToDisplay(l.date),
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
    XLSX.utils.book_append_sheet(wb, ws, 'Customer Payments');
  }

  // 11. SUPPLIER PAYMENT LOGS SHEET
  if (dataset.supplierLogs && dataset.supplierLogs.length > 0) {
    const supplierLogRows = dataset.supplierLogs.map(l => ({
      'Log ID': l.id,
      'Date': formatDateToDisplay(l.date),
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
    XLSX.utils.book_append_sheet(wb, ws, 'Supplier Payments');
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
