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
  misPercent: number;
  misAmt: number;
  nettPrice: number;
  roundUp: number;
  salePrice: number;
}

/**
 * Calculates item unit pricing breakdown with intermediate currency values (e.g. 18% -> 180, 10% -> 100)
 */
export function calculateItemUnitBreakdown(
  basicPriceOrConfig: number | Partial<ItemUnitBreakdown> & { unitName?: string },
  gstPercent: number = 18,
  tranPercent: number = 0,
  profPercent: number = 0,
  misPercent: number = 0,
  roundUp: number = 0,
  manualNettPrice?: number
): ItemUnitBreakdown {
  let basic = 0;
  let gst = 18;
  let tran = 0;
  let prof = 0;
  let mis = 0;
  let rUp = 0;
  let manualNett = manualNettPrice;

  if (typeof basicPriceOrConfig === 'object' && basicPriceOrConfig !== null) {
    basic = Number(basicPriceOrConfig.basicPrice) || 0;
    gst = basicPriceOrConfig.gstPercent !== undefined ? Number(basicPriceOrConfig.gstPercent) : 18;
    tran = Number(basicPriceOrConfig.tranPercent) || 0;
    prof = Number(basicPriceOrConfig.profPercent) || 0;
    mis = Number(basicPriceOrConfig.misPercent) || 0;
    rUp = Number(basicPriceOrConfig.roundUp) || 0;
    if (basicPriceOrConfig.nettPrice) manualNett = Number(basicPriceOrConfig.nettPrice);
  } else {
    basic = Number(basicPriceOrConfig) || 0;
    gst = Number(gstPercent) || 0;
    tran = Number(tranPercent) || 0;
    prof = Number(profPercent) || 0;
    mis = Number(misPercent) || 0;
    rUp = Number(roundUp) || 0;
  }

  const safeBasic = basic;
  const safeGst = gst;
  const safeTran = tran;
  const safeProf = prof;
  const safeMis = mis;
  const safeRoundUp = rUp;

  const gstAmt = Number((safeBasic * (safeGst / 100)).toFixed(2));
  const tranAmt = Number((safeBasic * (safeTran / 100)).toFixed(2));
  const profAmt = Number((safeBasic * (safeProf / 100)).toFixed(2));
  const misAmt = Number((safeBasic * (safeMis / 100)).toFixed(2));

  // If manualNettPrice is provided and > 0, respect it; otherwise compute sum of (Basic + GST + Tran + Prof + Mis)
  let nettPrice = manualNett !== undefined && manualNett > 0
    ? Number(manualNett.toFixed(2))
    : Number((safeBasic + gstAmt + tranAmt + profAmt + misAmt).toFixed(2));

  const salePrice = Number((nettPrice + safeRoundUp).toFixed(2));

  return {
    basicPrice: safeBasic,
    gstPercent: safeGst,
    gstAmt,
    tranPercent: safeTran,
    tranAmt,
    profPercent: safeProf,
    profAmt,
    misPercent: safeMis,
    misAmt,
    nettPrice,
    roundUp: safeRoundUp,
    salePrice
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

  return calculateItemUnitBreakdown(
    basicB,
    unitABreakdown.gstPercent,
    unitABreakdown.tranPercent,
    unitABreakdown.profPercent,
    unitABreakdown.misPercent,
    0
  );
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

/**
 * Calculates Bill Summary totals
 */
export function calculateBillSummary(
  items: Array<{
    basicPrice?: number;
    gstAmt?: number;
    salePrice?: number;
    qty?: number;
    amount?: number;
  }>
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

  const roundedTotal = Math.round(rawTotal);
  const roundUp = Number((roundedTotal - rawTotal).toFixed(2));

  return {
    basicTotal: Number(basicTotal.toFixed(2)),
    gstTotal: Number(gstTotal.toFixed(2)),
    roundUp,
    billTotal: roundedTotal
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
