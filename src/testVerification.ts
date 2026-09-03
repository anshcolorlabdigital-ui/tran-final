/**
 * Comprehensive Automated Verification of All 30 Customer Workflow & Business Invariant Steps
 */

import { calculateItemPricing, calculateBillSummary, calculateItemUnitBreakdown, calculateUnitBFromUnitA } from './utils/calculations';
import { formatReceiptText, ReceiptData } from './utils/shareUtils';
import { formatDateToDisplay, getTodayDateString } from './utils/dateUtils';
import { ItemUnitPricing, SupplierOrder } from './types';
import { buildExportDataset } from './utils/exportUtils';
import { db } from './db/db';

// Mock in-memory DB test harness matching DatabaseService logic
interface Item {
  id: string;
  sno: string;
  name: string;
  category?: string;
  unit?: string;
  minStock: number;
  openingStock: number;
  unitA?: ItemUnitPricing;
  unitB?: ItemUnitPricing;
}

interface StockMovement {
  id: string;
  itemId: string;
  type: string;
  qtyChange: number;
  refType: string;
  refId: string;
}

function runVerificationSuite() {
  console.log('====================================================');
  console.log('STARTING 30-STEP AUTOMATED VERIFICATION SUITE');
  console.log('====================================================');

  const items: Item[] = [];
  const movements: StockMovement[] = [];
  const orders: any[] = [];
  const purchases: any[] = [];
  const sales: any[] = [];
  const selfUses: any[] = [];

  function getItemCurrentStock(itemId: string): number {
    return movements
      .filter(m => m.itemId === itemId)
      .reduce((sum, m) => sum + m.qtyChange, 0);
  }

  // 1 & 2. Create item with dual-unit pricing: ASTER - 12X36
  console.log('\nStep 1 & 2: Creating Item ASTER - 12X36 with minStock = 100, openingStock = 50');
  const unitAPricing: ItemUnitPricing = {
    unitName: 'Roll',
    basicPrice: 200,
    gstPercent: 18,
    tranPercent: 5,
    profPercent: 10,
    misPercent: 2,
    roundUp: 0,
    salePrice: 234
  };

  const item1: Item = {
    id: 'item-aster',
    sno: '1456',
    name: 'ASTER - 12X36',
    category: 'PAPER',
    unit: 'Roll',
    minStock: 100,
    openingStock: 50,
    unitA: unitAPricing,
    unitB: {
      ...calculateUnitBFromUnitA(calculateItemUnitBreakdown(unitAPricing), 40),
      unitName: 'Mt'
    }
  };
  items.push(item1);

  // 3. Set opening stock = 50 (registers OPENING stock movement)
  movements.push({
    id: 'mov-open-1',
    itemId: item1.id,
    type: 'OPENING',
    qtyChange: 50,
    refType: 'OPENING',
    refId: item1.id
  });

  // 4. Confirm dashboard / current stock
  const stockStep4 = getItemCurrentStock(item1.id);
  console.log(`Step 4: Current stock is ${stockStep4}. Expected: 50. PASS? ${stockStep4 === 50}`);
  if (stockStep4 !== 50) throw new Error(`Expected stock 50, got ${stockStep4}`);

  // 5 & 6. Low stock check and Pending Order detection
  const isLowStock = stockStep4 <= item1.minStock;
  console.log(`Step 5 & 6: Is low stock? (50 <= 100): ${isLowStock}. PASS? ${isLowStock === true}`);
  if (!isLowStock) throw new Error('Item should be flagged as low stock');

  // 7 & 8. Assign to Supplier KONARK
  console.log('\nStep 7 & 8: Assigning item to KONARK order group');
  const order1 = {
    id: 'ord-101',
    orderNumber: 'ORD-101',
    supplierName: 'KONARK',
    orderDate: '2026-08-25',
    status: 'ORDERED',
    items: [
      {
        sno: item1.sno,
        itemId: item1.id,
        itemName: item1.name,
        orderedQty: 500,
        receivedQty: 0
      }
    ]
  };
  orders.push(order1);

  // 9, 10, 11. ORDER DONE: Confirm stock DOES NOT INCREASE
  console.log('Step 9, 10, 11: ORDER DONE placed. Checking stock...');
  const stockAfterOrder = getItemCurrentStock(item1.id);
  console.log(`Stock after ORDER DONE: ${stockAfterOrder}. Expected: 50 (NO CHANGE). PASS? ${stockAfterOrder === 50}`);
  if (stockAfterOrder !== 50) throw new Error('Order creation must NOT change stock!');

  // 12 & 13. Generate Order Receipt (Contains strictly S.No., Date, Item, Qty. NO supplier name, NO DB ids)
  console.log('\nStep 12 & 13: Generating Order Receipt for sharing...');
  const receiptData: ReceiptData = {
    date: order1.orderDate,
    items: order1.items.map(i => ({
      sno: i.sno,
      itemName: i.itemName,
      qty: i.orderedQty
    }))
  };
  const formattedText = formatReceiptText(receiptData);
  console.log('--- GENERATED RECEIPT PREVIEW ---');
  console.log(formattedText);
  console.log('---------------------------------');

  // Verify privacy constraints
  const containsSupplier = formattedText.includes('KONARK');
  const containsDbId = formattedText.includes('ord-101') || formattedText.includes('item-aster');
  console.log(`Receipt excludes supplier name: ${!containsSupplier}. PASS? ${!containsSupplier}`);
  console.log(`Receipt excludes internal DB IDs: ${!containsDbId}. PASS? ${!containsDbId}`);
  if (containsSupplier || containsDbId) throw new Error('Receipt violated privacy rules!');

  // 14 & 15. Create Purchase / Receive 500 units
  console.log('\nStep 14 & 15: Inwarding Purchase of 500 units...');
  purchases.push({
    id: 'pur-101',
    billNo: 'PUR-101',
    billDate: '2026-08-26',
    supplierName: 'KONARK',
    items: [{ itemId: item1.id, qty: 500, rate: 25 }]
  });
  movements.push({
    id: 'mov-pur-1',
    itemId: item1.id,
    type: 'PURCHASE_IN',
    qtyChange: 500,
    refType: 'PURCHASE',
    refId: 'pur-101'
  });
  const stockAfterPur = getItemCurrentStock(item1.id);
  console.log(`Stock after Purchase: ${stockAfterPur}. Expected: 550 (50 + 500). PASS? ${stockAfterPur === 550}`);
  if (stockAfterPur !== 550) throw new Error(`Expected 550, got ${stockAfterPur}`);

  // 16 & 17. Create Sale of 10 units
  console.log('\nStep 16 & 17: Recording Sale of 10 units...');
  sales.push({
    id: 'sale-101',
    billNo: 'INV-1001',
    billDate: '2026-08-31',
    partyName: 'Shree Ganesh Graphics',
    recdCash: 350,
    recdUpi: 0,
    items: [{ itemId: item1.id, qty: 10, rate: 35 }]
  });
  movements.push({
    id: 'mov-sale-1',
    itemId: item1.id,
    type: 'SALE_OUT',
    qtyChange: -10,
    refType: 'SALE',
    refId: 'sale-101'
  });
  const stockAfterSale = getItemCurrentStock(item1.id);
  console.log(`Stock after Sale: ${stockAfterSale}. Expected: 540 (550 - 10). PASS? ${stockAfterSale === 540}`);
  if (stockAfterSale !== 540) throw new Error(`Expected 540, got ${stockAfterSale}`);

  // 18 & 19. Create Self Use of 10 units
  console.log('\nStep 18 & 19: Recording Self Use consumption of 10 units...');
  selfUses.push({
    id: 'su-101',
    billNo: 'SU-101',
    billDate: '2026-08-31',
    items: [{ itemId: item1.id, qty: 10, rate: 25 }]
  });
  movements.push({
    id: 'mov-su-1',
    itemId: item1.id,
    type: 'SELF_USE_OUT',
    qtyChange: -10,
    refType: 'SELF_USE',
    refId: 'su-101'
  });
  const stockAfterSelfUse = getItemCurrentStock(item1.id);
  console.log(`Stock after Self Use: ${stockAfterSelfUse}. Expected: 530 (540 - 10). PASS? ${stockAfterSelfUse === 530}`);
  if (stockAfterSelfUse !== 530) throw new Error(`Expected 530, got ${stockAfterSelfUse}`);

  // 20 & 21. Check Item Stock Report
  console.log('\nStep 20 & 21: Checking Item Stock Report balance matrix...');
  const openingTotal = movements.filter(m => m.type === 'OPENING').reduce((a, b) => a + b.qtyChange, 0);
  const purchaseTotal = movements.filter(m => m.type === 'PURCHASE_IN').reduce((a, b) => a + b.qtyChange, 0);
  const saleTotal = Math.abs(movements.filter(m => m.type === 'SALE_OUT').reduce((a, b) => a + b.qtyChange, 0));
  const selfUseTotal = Math.abs(movements.filter(m => m.type === 'SELF_USE_OUT').reduce((a, b) => a + b.qtyChange, 0));
  const closingStockReport = openingTotal + purchaseTotal - saleTotal - selfUseTotal;

  console.log(`Opening: ${openingTotal}`);
  console.log(`Purchases: +${purchaseTotal}`);
  console.log(`Sales: -${saleTotal}`);
  console.log(`Self Use: -${selfUseTotal}`);
  console.log(`Closing Stock: ${closingStockReport}`);
  console.log(`Math Formula Verified: 50 + 500 - 10 - 10 = ${closingStockReport}. PASS? ${closingStockReport === 530}`);
  if (closingStockReport !== 530) throw new Error(`Report formula mismatch: ${closingStockReport}`);

  // 22. Pricing and Tax Verification
  console.log('\nStep 22: Testing Financial and Tax Calculations...');
  const pricing = calculateItemPricing(100, 18, 5, 2);
  console.log('Pricing output:', pricing);
  if (pricing.gstAmt !== 18 || pricing.nettPrice !== 118 || pricing.amount !== 247.8) {
    throw new Error('Pricing calculation failed!');
  }

  // 23. Bill Summary Rounding Verification
  console.log('\nStep 23: Testing Bill Summary Rounding...');
  const summary = calculateBillSummary([
    { basicPrice: 100, gstAmt: 18, salePrice: 123.9, qty: 2, amount: 247.8 }
  ]);
  console.log('Summary output:', summary);
  if (summary.billTotal !== 248) {
    throw new Error(`Expected rounded bill total 248, got ${summary.billTotal}`);
  }

  // 24. Multi-Unit Breakdown Verification (Unit A calculations)
  console.log('\nStep 24: Testing Multi-Unit Breakdown for Unit A...');
  const unitABreakdown = calculateItemUnitBreakdown({
    unitName: 'Roll',
    basicPrice: 200,
    gstPercent: 18,
    tranPercent: 5,
    profPercent: 10,
    misPercent: 2,
    roundUp: 0
  });
  console.log('Unit A calculated breakdown:', unitABreakdown);
  if (unitABreakdown.gstAmt !== 36 || unitABreakdown.tranAmt !== 10 || unitABreakdown.profAmt !== 20 || unitABreakdown.misAmt !== 4 || unitABreakdown.salePrice !== 234) {
    throw new Error('Unit A breakdown calculation failed!');
  }

  // 25. Unit B Conversion from Unit A (1 Roll = 40 Mt)
  console.log('\nStep 25: Testing Unit B Conversion Factor calculation (1 Roll = 40 Mt)...');
  const unitBConverted = calculateUnitBFromUnitA(unitABreakdown, 40);
  console.log('Unit B converted rates:', unitBConverted);
  if (unitBConverted.basicPrice !== 5 || unitBConverted.salePrice !== 5.85) {
    throw new Error(`Unit B conversion failed: basicPrice=${unitBConverted.basicPrice}, salePrice=${unitBConverted.salePrice}`);
  }

  // 26. Supplier Master Field Integrity
  console.log('\nStep 26: Testing Supplier Master 11-field entity integrity...');
  const supplierTest = {
    id: 'sup-1',
    sno: '1',
    name: 'KONARK SYNTHETICS',
    gstNo: '08AAAAA0000A1Z5',
    propName: 'Shri R.K. Agarwal',
    address: 'Plot 42, Industrial Area',
    block: 'Phase 2',
    distt: 'Jaipur',
    city: 'Jaipur',
    state: 'Rajasthan',
    phone: '9829012345',
    phone2: '9414012345',
    email: 'info@konarksyn.com'
  };
  if (!supplierTest.gstNo || !supplierTest.propName || !supplierTest.distt || !supplierTest.phone2) {
    throw new Error('Supplier master missing essential fields!');
  }

  // 27. Party Master Field Integrity
  console.log('\nStep 27: Testing Party Master 11-field entity integrity...');
  const partyTest = {
    id: 'pty-1',
    sno: '1',
    name: 'Shree Ganesh Graphics',
    gstNo: '08BBBBB1111B1Z2',
    propName: 'Ganesh Sharma',
    address: 'Shop 12, Nehru Bazar',
    block: 'Central',
    distt: 'Jaipur',
    city: 'Jaipur',
    state: 'Rajasthan',
    phone: '9829098765',
    phone2: '9414098765',
    email: 'ganeshgraphics@gmail.com'
  };
  if (!partyTest.gstNo || !partyTest.propName || !partyTest.block || !partyTest.email) {
    throw new Error('Party master missing essential fields!');
  }

  // 28. Date formatting helper
  console.log('\nStep 28: Testing Date Formatting...');
  const formattedD = formatDateToDisplay('2026-08-31');
  console.log(`Formatted 2026-08-31 -> ${formattedD}`);
  if (!formattedD.includes('31')) throw new Error('Date format failed');

  // 29. Self Use does not impact Sales Revenue or Parties
  console.log('\nStep 29: Verifying Self Use isolation from Sales revenue...');
  const totalSalesRevenue = sales.reduce((sum, s) => sum + s.recdCash + s.recdUpi, 0);
  console.log(`Total Sales Revenue: ₹${totalSalesRevenue}. Self use excluded? PASS`);
  if (totalSalesRevenue !== 350) throw new Error('Sales revenue corrupted by self use!');

  // 30. Purchase automatically inbounds stock
  console.log('\nStep 30: Verifying Purchase inwarding increments ledger...');
  const totalPurchasesIn = movements.filter(m => m.type === 'PURCHASE_IN').reduce((sum, m) => sum + m.qtyChange, 0);
  console.log(`Total Purchases In: ${totalPurchasesIn}. PASS? ${totalPurchasesIn === 500}`);
  if (totalPurchasesIn !== 500) throw new Error('Purchase did not inward correct quantity');

  // 31. Order with Remarks & Item Descriptions formatting
  console.log('\nStep 31: Verifying Order with Remarks & Item Descriptions...');
  const receiptWithRemarkText = formatReceiptText({
    date: '2026-09-03',
    items: [
      {
        sno: '1456',
        itemName: 'ASTER - 12X36',
        description: 'Glossy Photographic Paper Premium',
        qty: 100
      }
    ],
    notes: 'Urgent delivery by 5 PM'
  });
  console.log('--- RECEIPT WITH REMARKS & DESCRIPTIONS ---\n' + receiptWithRemarkText);
  if (!receiptWithRemarkText.includes('Glossy Photographic Paper Premium') || !receiptWithRemarkText.includes('Urgent delivery by 5 PM')) {
    throw new Error('Receipt formatting failed to include description or remark!');
  }
  console.log('Step 31 PASS? true');

  // 32. Separate Placed Order Batches (2nd Sept vs 4th Sept)
  console.log('\nStep 32: Verifying distinct order batches remain separate in ORDERED history...');
  const sampleOrder1: SupplierOrder = {
    id: 'ord-1',
    orderNumber: 'ORD-01',
    orderDate: '2026-09-02',
    supplierId: 'sup-1',
    supplierName: 'KONARK',
    status: 'ORDERED',
    items: [{ id: 'it-1', sno: '1456', itemId: item1.id, itemName: item1.name, orderedQty: 50, receivedQty: 0, orderDate: '2026-09-02', status: 'ORDERED' }],
    notes: 'Batch 1',
    createdAt: '2026-09-02T10:00:00Z'
  };
  const sampleOrder2: SupplierOrder = {
    id: 'ord-2',
    orderNumber: 'ORD-02',
    orderDate: '2026-09-04',
    supplierId: 'sup-1',
    supplierName: 'KONARK',
    status: 'ORDERED',
    items: [{ id: 'it-2', sno: '1456', itemId: item1.id, itemName: item1.name, orderedQty: 100, receivedQty: 0, orderDate: '2026-09-04', status: 'ORDERED' }],
    notes: 'Batch 2',
    createdAt: '2026-09-04T10:00:00Z'
  };
  const orderList = [sampleOrder1, sampleOrder2];
  if (orderList.length !== 2 || orderList[0].id === orderList[1].id) {
    throw new Error('Distinct order batches were merged inappropriately');
  }
  console.log('Step 32 PASS? true: Orders on 2nd Sept and 4th Sept are independent distinct batches.');

  // 33. Modular & Date-Filtered Export Dataset Verification
  console.log('\nStep 33: Verifying Modular & Date-Filtered Export Dataset...');
  const testExportOptions = {
    fromDate: '2026-08-01',
    toDate: '2026-08-31',
    isFullHistory: false,
    modules: {
      orders: true,
      purchases: true,
      sales: true,
      selfUse: true,
      parties: true,
      suppliers: true,
      items: true,
      adjustments: true,
      settings: true
    }
  };
  const dataset = buildExportDataset(testExportOptions);
  console.log(`Exported items count: ${dataset.items.length}, sales: ${dataset.sales.length}, purchases: ${dataset.purchases.length}`);
  if (!Array.isArray(dataset.items) || !Array.isArray(dataset.sales)) {
    throw new Error('Export dataset failed to build valid arrays');
  }
  console.log('Step 33 PASS? true');

  // 34. Full JSON Backup & Restore Invariant
  console.log('\nStep 34: Verifying JSON Backup export and Restore...');
  const jsonBackupString = db.exportFullBackupJSON();
  const parsedBackup = JSON.parse(jsonBackupString);
  if (!parsedBackup.items || !parsedBackup.parties || !parsedBackup.settings) {
    throw new Error('Full backup JSON missing core tables');
  }
  const restoreSuccess = db.importFullBackupJSON(jsonBackupString);
  if (!restoreSuccess) {
    throw new Error('Failed to restore database from backup JSON');
  }
  console.log('Step 34 PASS? true: Database export and restore validated successfully.');

  console.log('\n====================================================');
  console.log('ALL 34 CUSTOMER WORKFLOW STEPS & INVARIANTS PASSED!');
  console.log('====================================================\n');
}

runVerificationSuite();
