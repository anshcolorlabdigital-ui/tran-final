export interface PricingCalculations {
  basicPrice: number;
  gstPercent: number;
  gstAmt: number;
  nettPrice: number;
  toPercent: number;
  roundup?: number;
  salePrice: number;
  qty: number;
  amount: number;
}

export interface ItemUnitBreakdown {
  basicPrice: number;
  gstPercent: number;
  gstAmt: number;
  tranPercent: number;
  tranAmt: number;
  profPercent: number;
  profAmt: number;
  profPercentAm: number;
  profAmAmt: number;
  profPercentDeal: number;
  profDealAmt: number;
  misPercent: number;
  misAmt: number;
  nettPrice: number;
  roundUp: number;
  roundUpSale: number;
  roundUpMrp: number;
  salePrice: number;
  mrp: number;
}

/**
 * Calculates item unit pricing breakdown with intermediate currency values (e.g. 18% -> 180, 10% -> 100)
 */
export function calculateItemUnitBreakdown(
  basicPriceOrConfig: number | Partial<ItemUnitBreakdown> & { unitName?: string; roundUpSale?: number; roundUpMrp?: number },
  gstPercent: number = 18,
  tranPercent: number = 0,
  profPercentOrAm: number = 0,
  misPercent: number = 0,
  roundUp: number = 0,
  manualNettPrice?: number,
  profPercentDeal: number = 0,
  roundUpMrpParam: number = 0
): ItemUnitBreakdown {
  let basic = 0;
  let gst = 18;
  let tran = 0;
  let profAm = 0;
  let profDeal = 0;
  let mis = 0;
  let rUpSale = 0;
  let rUpMrp = 0;
  let manualNett = manualNettPrice;

  if (typeof basicPriceOrConfig === 'object' && basicPriceOrConfig !== null) {
    basic = Number(basicPriceOrConfig.basicPrice) || 0;
    gst = basicPriceOrConfig.gstPercent !== undefined ? Number(basicPriceOrConfig.gstPercent) : 18;
    tran = Number(basicPriceOrConfig.tranPercent) || 0;
    profAm = Number(basicPriceOrConfig.profPercentAm !== undefined ? basicPriceOrConfig.profPercentAm : basicPriceOrConfig.profPercent) || 0;
    profDeal = Number(basicPriceOrConfig.profPercentDeal !== undefined ? basicPriceOrConfig.profPercentDeal : basicPriceOrConfig.profPercent) || 0;
    mis = Number(basicPriceOrConfig.misPercent) || 0;
    rUpSale = Number(basicPriceOrConfig.roundUpSale !== undefined ? basicPriceOrConfig.roundUpSale : basicPriceOrConfig.roundUp) || 0;
    rUpMrp = Number(basicPriceOrConfig.roundUpMrp) || 0;
  } else {
    basic = Number(basicPriceOrConfig) || 0;
    gst = Number(gstPercent) || 0;
    tran = Number(tranPercent) || 0;
    profAm = Number(profPercentOrAm) || 0;
    profDeal = Number(profPercentDeal !== undefined ? profPercentDeal : profPercentOrAm) || 0;
    mis = Number(misPercent) || 0;
    rUpSale = Number(roundUp) || 0;
    rUpMrp = Number(roundUpMrpParam) || 0;
  }

  const safeBasic = basic;
  const safeGst = gst;
  const safeTran = tran;
  const safeProfAm = profAm;
  const safeProfDeal = profDeal;
  const safeMis = mis;
  const safeRoundUpSale = rUpSale;
  const safeRoundUpMrp = rUpMrp;

  const gstAmt = Number((safeBasic * (safeGst / 100)).toFixed(2));
  const tranAmt = Number((safeBasic * (safeTran / 100)).toFixed(2));
  const misAmt = Number((safeBasic * (safeMis / 100)).toFixed(2));
  const profAmAmt = Number((safeBasic * (safeProfAm / 100)).toFixed(2));
  const profDealAmt = Number((safeBasic * (safeProfDeal / 100)).toFixed(2));

  // Landed cost before profit margins = Basic + GST + Tran + Mis
  let nettPrice = manualNett !== undefined && manualNett > 0
    ? Number(manualNett.toFixed(2))
    : Number((safeBasic + gstAmt + tranAmt + misAmt).toFixed(2));

  // Dealer Sale Price = Landed Nett + Dealer Profit + Round-S
  const salePrice = Number((nettPrice + profDealAmt + safeRoundUpSale).toFixed(2));

  // Amateur MRP = Landed Nett + Amateur Profit + Round-M
  const mrp = Number((nettPrice + profAmAmt + safeRoundUpMrp).toFixed(2));

  return {
    basicPrice: safeBasic,
    gstPercent: safeGst,
    gstAmt,
    tranPercent: safeTran,
    tranAmt,
    profPercent: safeProfDeal,
    profAmt: profDealAmt,
    profPercentAm: safeProfAm,
    profAmAmt,
    profPercentDeal: safeProfDeal,
    profDealAmt,
    misPercent: safeMis,
    misAmt,
    nettPrice,
    roundUp: safeRoundUpSale,
    roundUpSale: safeRoundUpSale,
    roundUpMrp: safeRoundUpMrp,
    salePrice,
    mrp
  };
}

/**
 * Derives Unit-B rates from Unit-A using conversion factor (e.g., 1 Roll = 40 Mt)
 */
export function calculateUnitBFromUnitA(
  unitABreakdown: ItemUnitBreakdown,
  conversionFactor: number = 1
): ItemUnitBreakdown {
  const factor = Number(conversionFactor) > 0 ? Number(conversionFactor) : 1;
  const basicB = Number((unitABreakdown.basicPrice / factor).toFixed(2));

  return calculateItemUnitBreakdown({
    basicPrice: basicB,
    gstPercent: unitABreakdown.gstPercent,
    tranPercent: unitABreakdown.tranPercent,
    profPercentAm: unitABreakdown.profPercentAm,
    profPercentDeal: unitABreakdown.profPercentDeal,
    misPercent: unitABreakdown.misPercent,
    roundUp: 0
  });
}

/**
 * Normalizes an Item's Unit A and Unit B pricing breakdown, ensuring that
 * salePrice, mrp, nettPrice, and all breakdown amounts match the configured formula
 */
export function normalizeItemPricing<T extends {
  purchaseRate?: number;
  saleRate?: number;
  mrp?: number;
  gstPercent?: number;
  hasSecondaryUnit?: boolean;
  unit?: string;
  unitA?: any;
  unitB?: any;
}>(item: T): T {
  if (!item) return item;

  const basicPrice = Number(item.unitA?.basicPrice ?? item.purchaseRate ?? 0);
  const gstPercent = Number(item.unitA?.gstPercent ?? item.gstPercent ?? 18);

  if (item.unitA) {
    const bdA = calculateItemUnitBreakdown({
      ...item.unitA,
      basicPrice,
      gstPercent
    });

    const updatedUnitA = {
      ...item.unitA,
      ...bdA,
      unitName: item.unitA.unitName || item.unit || 'Roll',
      basicPrice,
      gstPercent,
      salePrice: bdA.salePrice,
      mrp: bdA.mrp,
      isActive: item.unitA.isActive !== false
    };

    let updatedUnitB = item.unitB;
    if (item.hasSecondaryUnit && item.unitB) {
      const conv = Number(item.unitB.conversionFactor) || 1;
      const bdB = calculateUnitBFromUnitA(bdA, conv);
      updatedUnitB = {
        ...item.unitB,
        ...bdB,
        unitName: item.unitB.unitName || 'Mt.',
        conversionFactor: conv,
        salePrice: bdB.salePrice,
        mrp: bdB.mrp,
        isActive: item.unitB.isActive !== false
      };
    }

    return {
      ...item,
      purchaseRate: basicPrice,
      saleRate: bdA.salePrice,
      mrp: bdA.mrp,
      gstPercent,
      unitA: updatedUnitA,
      unitB: updatedUnitB
    };
  }

  return item;
}

/**
 * Updates an item's prices when a new purchase price is recorded
 */
export function updateItemPricingFromPurchase<T extends {
  purchaseRate?: number;
  saleRate?: number;
  mrp?: number;
  gstPercent?: number;
  hasSecondaryUnit?: boolean;
  unit?: string;
  unitA?: any;
  unitB?: any;
}>(item: T, newBasicPrice: number, newGstPercent?: number): T {
  const safeBasic = Number(newBasicPrice) || 0;
  if (safeBasic <= 0) return item;

  const safeGst = newGstPercent !== undefined ? Number(newGstPercent) : Number(item.unitA?.gstPercent ?? item.gstPercent ?? 18);

  const baseUnitA = item.unitA || {
    unitName: item.unit || 'Roll',
    basicPrice: safeBasic,
    gstPercent: safeGst,
    tranPercent: 0,
    profPercent: 0,
    profPercentAm: 0,
    profPercentDeal: 0,
    misPercent: 0,
    roundUpSale: 0,
    roundUpMrp: 0,
    isActive: true
  };

  const bdA = calculateItemUnitBreakdown({
    ...baseUnitA,
    basicPrice: safeBasic,
    gstPercent: safeGst
  });

  const updatedUnitA = {
    ...baseUnitA,
    ...bdA,
    unitName: baseUnitA.unitName || item.unit || 'Roll',
    basicPrice: safeBasic,
    gstPercent: safeGst,
    salePrice: bdA.salePrice,
    mrp: bdA.mrp,
    isActive: baseUnitA.isActive !== false
  };

  let updatedUnitB = item.unitB;
  if (item.hasSecondaryUnit && item.unitB) {
    const conv = Number(item.unitB.conversionFactor) || 1;
    const bdB = calculateUnitBFromUnitA(bdA, conv);
    updatedUnitB = {
      ...item.unitB,
      ...bdB,
      unitName: item.unitB.unitName || 'Mt.',
      conversionFactor: conv,
      salePrice: bdB.salePrice,
      mrp: bdB.mrp,
      isActive: item.unitB.isActive !== false
    };
  }

  return {
    ...item,
    purchaseRate: safeBasic,
    saleRate: bdA.salePrice,
    mrp: bdA.mrp,
    gstPercent: safeGst,
    unitA: updatedUnitA,
    unitB: updatedUnitB
  };
}


/**
 * Calculates pricing strip values according to customer's business logic
 */
export function calculateItemPricing(
  basicPrice: number,
  gstPercent: number,
  toPercent: number,
  qty: number,
  manualRoundup: number = 0
): PricingCalculations {
  const safeBasic = Number(basicPrice) || 0;
  const safeGstPct = Number(gstPercent) || 0;
  const safeToPct = Number(toPercent) || 0;
  const safeQty = Number(qty) || 0;

  // GST Amount per unit
  const gstAmt = Number((safeBasic * (safeGstPct / 100)).toFixed(2));

  // Nett Price before Profit Margin = Basic + GST
  const nettPrice = Number((safeBasic + gstAmt).toFixed(2));

  // Profit / Margin Amount per unit (Prof % on basic price)
  const toAmt = Number((safeBasic * (safeToPct / 100)).toFixed(2));

  // Sale Price = Nett Price + Profit Amount + optional roundup
  const rawSalePrice = nettPrice + toAmt + manualRoundup;
  const salePrice = Number(rawSalePrice.toFixed(2));

  // Total Line Amount = Sale Price * Qty
  const amount = Number((salePrice * safeQty).toFixed(2));

  return {
    basicPrice: safeBasic,
    gstPercent: safeGstPct,
    gstAmt,
    nettPrice,
    toPercent: safeToPct,
    roundup: manualRoundup,
    salePrice,
    qty: safeQty,
    amount
  };
}

export interface SalesPricingCalculations {
  basicPrice: number;
  gstPercent: number;
  gstAmt: number;
  nettPrice: number;
  profPercentAm: number;
  profPercentDeal: number;
  mrp: number;        // Amateur rate = Nett Price + (Basic Price * (Prof % Am / 100))
  salePrice: number;  // Dealer rate = Nett Price + (Basic Price * (Prof % Deal / 100))
  effectivePrice: number; // mrp if party is AMATEUR, salePrice if party is DEALER
  qty: number;
  amount: number;     // effectivePrice * qty
}

/**
 * Calculates sales line item dual-pricing with Prof % Am (MRP) and Prof % Deal (Sale Price)
 */
export function calculateSalesItemPricing(
  basicPrice: number,
  gstPercent: number,
  profPercentAm: number,
  profPercentDeal: number,
  qty: number,
  isDealer: boolean = false
): SalesPricingCalculations {
  const safeBasic = Number(basicPrice) || 0;
  const safeGstPct = Number(gstPercent) || 0;
  const safeProfAm = Number(profPercentAm) || 0;
  const safeProfDeal = Number(profPercentDeal) || 0;
  const safeQty = Number(qty) || 0;

  const gstAmt = Number((safeBasic * (safeGstPct / 100)).toFixed(2));
  const nettPrice = Number((safeBasic + gstAmt).toFixed(2));

  // mrp = nettPrice + (basic * profAm / 100)
  const profAmAmt = Number((safeBasic * (safeProfAm / 100)).toFixed(2));
  const mrp = Number((nettPrice + profAmAmt).toFixed(2));

  // salePrice = nettPrice + (basic * profDeal / 100)
  const profDealAmt = Number((safeBasic * (safeProfDeal / 100)).toFixed(2));
  const salePrice = Number((nettPrice + profDealAmt).toFixed(2));

  const effectivePrice = isDealer ? salePrice : mrp;
  const amount = Number((effectivePrice * safeQty).toFixed(2));

  return {
    basicPrice: safeBasic,
    gstPercent: safeGstPct,
    gstAmt,
    nettPrice,
    profPercentAm: safeProfAm,
    profPercentDeal: safeProfDeal,
    mrp,
    salePrice,
    effectivePrice,
    qty: safeQty,
    amount
  };
}

/**
 * Calculates Bill Summary totals with support for optional user-edited round-up
 */
export function calculateBillSummary(
  items: Array<{
    basicPrice?: number;
    gstAmt?: number;
    salePrice?: number;
    qty?: number;
    amount?: number;
  }>,
  customRoundUp?: number
) {
  let basicTotal = 0;
  let gstTotal = 0;
  let rawTotal = 0;

  items.forEach(item => {
    const qty = Number(item.qty) || 0;
    basicTotal += (Number(item.basicPrice) || 0) * qty;
    gstTotal += (Number(item.gstAmt) || 0) * qty;
    rawTotal += Number(item.amount) || 0;
  });

  const defaultRoundedTotal = Math.round(rawTotal);
  const defaultRoundUp = Number((defaultRoundedTotal - rawTotal).toFixed(2));
  const finalRoundUp = customRoundUp !== undefined && !isNaN(Number(customRoundUp))
    ? Number(Number(customRoundUp).toFixed(2))
    : defaultRoundUp;
  const billTotal = Number((rawTotal + finalRoundUp).toFixed(2));

  return {
    basicTotal: Number(basicTotal.toFixed(2)),
    gstTotal: Number(gstTotal.toFixed(2)),
    rawTotal: Number(rawTotal.toFixed(2)),
    roundUp: finalRoundUp,
    defaultRoundUp,
    billTotal
  };
}

/**
 * Format currency with Indian standard notation (e.g. ₹ 1,50,000.00)
 */
export function formatCurrency(amount: number, showSymbol: boolean = true): string {
  const safeAmount = Number(amount) || 0;
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(safeAmount);

  return showSymbol ? `₹ ${formatted}` : formatted;
}
