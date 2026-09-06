export type Permission =
  | 'VIEW_DASHBOARD'
  | 'MANAGE_ORDERS'
  | 'CREATE_SALE'
  | 'EDIT_SALE'
  | 'DELETE_SALE'
  | 'CREATE_PURCHASE'
  | 'EDIT_PURCHASE'
  | 'DELETE_PURCHASE'
  | 'CREATE_SELF_USE'
  | 'EDIT_SELF_USE'
  | 'DELETE_SELF_USE'
  | 'VIEW_REPORTS'
  | 'MANAGE_MASTERS'
  | 'ADJUST_STOCK'
  | 'MANAGE_USERS'
  | 'MANAGE_SETTINGS';

export type UserRole = 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'CASHIER' | 'VIEWER';

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  pin?: string;
  createdAt: string;
}

export interface Party {
  id: string;
  name: string; // Firm Name
  propName?: string; // Prop. Name
  propPhone?: string; // Prop. Phone Number
  phone: string; // Mobile 1
  phone2?: string; // Mobile 2
  contactPerson1?: string; // Contact 1 (Ref for Mobile 1)
  contactPerson2?: string; // Contact 2 (Ref for Mobile 2)
  email?: string; // Mail id
  address: string;
  block?: string;
  distt?: string;
  city?: string;
  state?: string;
  gstin: string; // Gst No.
  openingBalance: number;
  creditLimit: number;
  allowCredit?: boolean; // When true, customer can make partial/credit purchases
  partyType?: 'DEALER' | 'AMATEUR'; // Dealer vs Amateur (Retailer/End Customer)
  dealerProfitPercent?: number; // Custom profit % configured when party is a Dealer
  amateurProfitPercent?: number; // Custom profit % configured when party is an Amateur
  isActive: boolean; // When false, hidden from Sales dropdowns but visible in Party Master
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string; // Firm Name
  propName?: string; // Prop. Name
  propPhone?: string; // Prop. Phone Number
  phone: string; // Mobile 1
  phone2?: string; // Mobile 2
  contactPerson1?: string; // Contact 1 (Ref for Mobile 1)
  contactPerson2?: string; // Contact 2 (Ref for Mobile 2)
  email?: string; // Mail id
  address: string;
  block?: string;
  distt?: string;
  city?: string;
  state?: string;
  gstin: string; // Gst No.
  openingBalance: number;
  isActive: boolean;
  createdAt: string;
}

export interface ItemUnitPricing {
  unitName?: string;
  basicPrice?: number;
  gstPercent?: number;
  tranPercent?: number; // Transport %
  profPercent?: number; // Legacy Profit %
  profPercentAm?: number; // Amateur Profit %
  profPercentDeal?: number; // Dealer Profit %
  misPercent?: number;  // Misc %
  nettPrice?: number;
  roundUp?: number; // legacy/default round up for sale
  roundUpSale?: number; // Round-S (Sale Price round up)
  roundUpMrp?: number;  // Round-M (MRP round up)
  salePrice?: number; // Dealer rate
  mrp?: number;       // Amateur rate
  isActive?: boolean;
}

export interface ItemUnitSecondaryPricing extends ItemUnitPricing {
  conversionFactor?: number; // e.g. 1 UnitA = 40 UnitB
}

export interface Item {
  id: string;
  sno: string; // Business Item Code / Serial Number (unique)
  name: string;
  hsn?: string;
  description?: string;
  category: string;
  supplierId?: string;
  supplierName?: string;
  unit: string; // Primary unit representation
  hasSecondaryUnit?: boolean; // Optional Unit B toggle (Default OFF)
  minStock: number; // Reorder level threshold
  openingStock: number;
  purchaseRate: number; // Basic Price
  saleRate: number;     // Sale Price (Dealer rate)
  mrp?: number;         // MRP (Amateur rate)
  gstPercent: number;   // e.g. 0, 5, 12, 18, 28
  profPercentAm?: number;
  profPercentDeal?: number;
  roundUp?: number;
  roundUpSale?: number;
  roundUpMrp?: number;
  unitA?: ItemUnitPricing;
  unitB?: ItemUnitSecondaryPricing;
  isActive: boolean;
  createdAt: string;
}

export type MovementType =
  | 'OPENING'
  | 'PURCHASE_IN'
  | 'SALE_OUT'
  | 'SELF_USE_OUT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT';

export interface StockMovement {
  id: string;
  itemId: string;
  type: MovementType;
  qtyChange: number; // Positive for IN, Negative for OUT
  refType: 'OPENING' | 'PURCHASE' | 'SALE' | 'SELF_USE' | 'ADJUSTMENT';
  refId: string;
  refNo: string;
  date: string; // YYYY-MM-DD
  notes?: string;
  createdAt: string;
}

export type OrderStatus = 'PENDING' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface OrderItem {
  id: string;
  sno: string; // Clean serial number on receipt
  itemId: string;
  itemName: string;
  description?: string;
  orderedQty: number;
  receivedQty: number;
  supplierId?: string;
  supplierName?: string;
  orderDate: string; // YYYY-MM-DD
  status: OrderStatus;
}

export interface SupplierOrder {
  id: string;
  orderNumber: string;
  orderDate: string; // YYYY-MM-DD
  supplierId: string;
  supplierName: string;
  status: OrderStatus;
  items: OrderItem[];
  notes?: string;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  itemId: string;
  sno: string;
  itemName: string;
  unit?: string;
  category?: string;
  basicPrice: number;
  gstPercent: number;
  gstAmt: number;
  nettPrice: number;
  toPercent?: number;
  tranPercent?: number;
  profPercent?: number;
  profPercentAm?: number;
  profPercentDeal?: number;
  mrp?: number;
  misPercent?: number;
  salePrice: number;
  qty: number;
  amount: number;
  conversionFactor?: number;
  isSecondaryUnit?: boolean;
  baseQty?: number;
}

export interface PartyLog {
  id: string;
  partyId: string;
  partyName: string;
  date: string; // YYYY-MM-DD
  type: 'SALE' | 'PAYMENT' | 'OPENING_BALANCE' | 'CREDIT_ADJUSTMENT';
  refNo: string; // e.g. INV-1002, RCPT-001
  totalAmount: number; // Sale bill total or Payment receipt total
  paidAmount: number; // Received via cash + UPI
  balanceChange: number; // Positive = credit added to balance, Negative = payment reducing balance
  runningBalance?: number; // Calculated balance after this transaction
  paymentMode?: 'CASH' | 'UPI' | 'COMBINED';
  notes?: string;
  createdAt: string;
}

export interface Sale {
  id: string;
  billNo: string;
  billDate: string; // YYYY-MM-DD
  partyId: string;
  partyName: string;
  items: SaleItem[];
  basicTotal: number;
  gstTotal: number;
  roundUp: number;
  billTotal: number;
  recdCash: number;
  recdUpi: number;
  balanceDue?: number; // Unpaid credit balance (billTotal - (recdCash + recdUpi))
  isCreditSale?: boolean; // True if total paid < bill total
  notes?: string;
  createdAt: string;
}

export interface PurchaseItem {
  id: string;
  itemId: string;
  sno: string;
  itemName: string;
  unit?: string;
  basicPrice: number;
  gstPercent: number;
  gstAmt: number;
  nettPrice: number;
  toPercent?: number;
  roundup?: number;
  salePrice?: number;
  qty: number;
  amount: number;
  conversionFactor?: number;
  isSecondaryUnit?: boolean;
  baseQty?: number;
}

export interface Purchase {
  id: string;
  billNo: string;
  billDate: string; // YYYY-MM-DD
  recdDate: string; // YYYY-MM-DD
  supplierId: string;
  supplierName: string;
  orderId?: string; // If fulfilled from an existing order
  items: PurchaseItem[];
  basicTotal: number;
  gstTotal: number;
  roundUp: number;
  billTotal: number;
  recdCash: number;
  recdUpi: number;
  notes?: string;
  createdAt: string;
}

export interface SelfUseItem {
  id: string;
  itemId: string;
  sno: string;
  itemName: string;
  unit?: string;
  category?: string;
  rate: number;
  qty: number;
  amount: number;
  conversionFactor?: number;
  isSecondaryUnit?: boolean;
  baseQty?: number;
}

export interface SelfUse {
  id: string;
  billNo: string;
  billDate: string; // YYYY-MM-DD
  category?: string;
  items: SelfUseItem[];
  totalAmount: number;
  reason?: string;
  remarks?: string;
  createdAt: string;
}

export interface StockAdjustment {
  id: string;
  adjustmentNo: string;
  date: string;
  itemId: string;
  itemName: string;
  previousStock: number;
  newStock: number;
  difference: number;
  type: 'INCREASE' | 'DECREASE';
  reason: string;
  adjustedBy: string;
  createdAt: string;
}

export interface CompanySettings {
  companyName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  currencySymbol: string;
  defaultGstPercent: number;
  defaultTransportPercent?: number;
  invoicePrefix: string;
  invoiceNextNumber?: number;
  invoicePadDigits?: number;
  purchasePrefix?: string;
  purchaseNextNumber?: number;
  purchasePadDigits?: number;
  selfUsePrefix: string;
  selfUseNextNumber?: number;
  selfUsePadDigits?: number;
  orderPrefix: string;
  orderNextNumber?: number;
  orderPadDigits?: number;
}

export interface ItemStockSummary {
  item: Item;
  openingStock: number;
  purchaseQty: number;
  saleQty: number;
  selfUseQty: number;
  adjustmentQty: number;
  closingStock: number;
  isLowStock: boolean;
  activeOrder?: {
    orderNumber: string;
    supplierName: string;
    orderDate: string;
    status: OrderStatus;
    orderedQty: number;
  };
}

export type ActiveNavTab =
  | 'DASHBOARD'
  | 'ORDER'
  | 'ORDERED'
  | 'PURCHASE'
  | 'SALE'
  | 'SELF_USE'
  | 'PARTY'
  | 'ITEM'
  | 'SUPPLIER'
  | 'OPENING_STOCK'
  | 'REPORT_SALES'
  | 'REPORT_PURCHASES'
  | 'REPORT_SELF_USE'
  | 'REPORT_ITEM_STOCK'
  | 'REPORT_PARTY_LEDGER'
  | 'REPORT_ITEM_LEDGER'
  | 'ADMIN'
  | 'USER';
