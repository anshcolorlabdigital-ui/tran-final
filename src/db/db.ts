import {
  Item,
  Party,
  Supplier,
  SupplierOrder,
  Sale,
  Purchase,
  SelfUse,
  StockMovement,
  StockAdjustment,
  User,
  CompanySettings
} from '../types';
import {
  INITIAL_COMPANY_SETTINGS,
  INITIAL_USERS,
  INITIAL_PARTIES,
  INITIAL_SUPPLIERS,
  INITIAL_ITEMS,
  INITIAL_ORDERS,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_SALES
} from './seedData';

const STORAGE_KEYS = {
  SETTINGS: 'rmms_settings_v1',
  USERS: 'rmms_users_v1',
  PARTIES: 'rmms_parties_v1',
  SUPPLIERS: 'rmms_suppliers_v1',
  ITEMS: 'rmms_items_v1',
  ORDERS: 'rmms_orders_v1',
  SALES: 'rmms_sales_v1',
  PURCHASES: 'rmms_purchases_v1',
  SELF_USES: 'rmms_self_uses_v1',
  STOCK_MOVEMENTS: 'rmms_stock_movements_v1',
  STOCK_ADJUSTMENTS: 'rmms_stock_adjustments_v1',
  INITIALIZED: 'rmms_initialized_v1'
};

const memoryStore: Record<string, string> = {};

function safeGetStorage(key: string): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(key);
  }
  return memoryStore[key] || null;
}

function safeSetStorage(key: string, value: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(key, value);
  } else {
    memoryStore[key] = value;
  }
}

type DbChangeListener = () => void;

class DatabaseService {
  private listeners: Set<DbChangeListener> = new Set();

  constructor() {
    this.initDatabase();
  }

  public subscribe(listener: DbChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch (err) {
        console.error('Error in DB change listener:', err);
      }
    });
  }

  private get<T>(key: string, defaultValue: T): T {
    try {
      const data = safeGetStorage(key);
      if (!data) return defaultValue;
      return JSON.parse(data) as T;
    } catch (e) {
      console.error(`Error reading ${key} from storage:`, e);
      return defaultValue;
    }
  }

  private set<T>(key: string, value: T): void {
    try {
      safeSetStorage(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Error writing ${key} to storage:`, e);
    }
  }

  public initDatabase(forceReset = false): void {
    const isInitializedV2 = safeGetStorage('rmms_initialized_v2');
    if (!isInitializedV2 || forceReset) {
      const isFresh = !safeGetStorage(STORAGE_KEYS.SETTINGS);
      if (isFresh || forceReset) {
        this.set(STORAGE_KEYS.SETTINGS, INITIAL_COMPANY_SETTINGS);
        this.set(STORAGE_KEYS.USERS, INITIAL_USERS);
        this.set(STORAGE_KEYS.PARTIES, INITIAL_PARTIES);
        this.set(STORAGE_KEYS.SUPPLIERS, INITIAL_SUPPLIERS);
        this.set(STORAGE_KEYS.ITEMS, INITIAL_ITEMS);
        this.set(STORAGE_KEYS.ORDERS, INITIAL_ORDERS);
        this.set(STORAGE_KEYS.SALES, INITIAL_SALES);
        this.set(STORAGE_KEYS.PURCHASES, []);
        this.set(STORAGE_KEYS.SELF_USES, []);
        this.set(STORAGE_KEYS.STOCK_MOVEMENTS, INITIAL_STOCK_MOVEMENTS);
        this.set(STORAGE_KEYS.STOCK_ADJUSTMENTS, []);
      } else {
        // Upgrade existing data with missing suppliers and item unit configs
        const suppliers = this.get<Supplier[]>(STORAGE_KEYS.SUPPLIERS, []);
        INITIAL_SUPPLIERS.forEach(s => {
          if (!suppliers.some(existing => existing.name.toUpperCase() === s.name.toUpperCase())) {
            suppliers.push(s);
          }
        });
        this.set(STORAGE_KEYS.SUPPLIERS, suppliers);

        const items = this.get<Item[]>(STORAGE_KEYS.ITEMS, []);
        INITIAL_ITEMS.forEach(initItem => {
          const item = items.find(i => i.sno === initItem.sno);
          if (item) {
            if (!item.unitA && initItem.unitA) item.unitA = initItem.unitA;
            if (!item.unitB && initItem.unitB) item.unitB = initItem.unitB;
            if (!item.hsn && initItem.hsn) item.hsn = initItem.hsn;
            if (!item.supplierName && initItem.supplierName) {
              item.supplierName = initItem.supplierName;
              item.supplierId = initItem.supplierId;
            }
          }
        });
        this.set(STORAGE_KEYS.ITEMS, items);
      }
      safeSetStorage('rmms_initialized_v2', 'true');
      this.notify();
    }
  }

  // --- SETTINGS ---
  public getSettings(): CompanySettings {
    return this.get(STORAGE_KEYS.SETTINGS, INITIAL_COMPANY_SETTINGS);
  }

  public saveSettings(settings: CompanySettings): void {
    this.set(STORAGE_KEYS.SETTINGS, settings);
    this.notify();
  }

  // --- USERS ---
  public getUsers(): User[] {
    return this.get(STORAGE_KEYS.USERS, INITIAL_USERS);
  }

  public saveUser(user: User): void {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    this.set(STORAGE_KEYS.USERS, users);
    this.notify();
  }

  public deleteUser(id: string): void {
    const users = this.getUsers().filter(u => u.id !== id);
    this.set(STORAGE_KEYS.USERS, users);
    this.notify();
  }

  // --- PARTIES ---
  public getParties(): Party[] {
    return this.get(STORAGE_KEYS.PARTIES, []);
  }

  public getPartyById(id: string): Party | undefined {
    return this.getParties().find(p => p.id === id);
  }

  public saveParty(party: Party): void {
    const parties = this.getParties();
    const index = parties.findIndex(p => p.id === party.id);
    if (index >= 0) {
      parties[index] = party;
    } else {
      parties.push(party);
    }
    this.set(STORAGE_KEYS.PARTIES, parties);
    this.notify();
  }

  public deleteParty(id: string): void {
    const parties = this.getParties().filter(p => p.id !== id);
    this.set(STORAGE_KEYS.PARTIES, parties);
    this.notify();
  }

  // --- SUPPLIERS ---
  public getSuppliers(): Supplier[] {
    return this.get(STORAGE_KEYS.SUPPLIERS, []);
  }

  public getSupplierById(id: string): Supplier | undefined {
    return this.getSuppliers().find(s => s.id === id);
  }

  public saveSupplier(supplier: Supplier): void {
    const suppliers = this.getSuppliers();
    const index = suppliers.findIndex(s => s.id === supplier.id);
    if (index >= 0) {
      suppliers[index] = supplier;
    } else {
      suppliers.push(supplier);
    }
    this.set(STORAGE_KEYS.SUPPLIERS, suppliers);
    this.notify();
  }

  public deleteSupplier(id: string): void {
    const suppliers = this.getSuppliers().filter(s => s.id !== id);
    this.set(STORAGE_KEYS.SUPPLIERS, suppliers);
    this.notify();
  }

  // --- ITEMS ---
  public getItems(): Item[] {
    return this.get(STORAGE_KEYS.ITEMS, []);
  }

  public getItemById(id: string): Item | undefined {
    return this.getItems().find(i => i.id === id);
  }

  public getItemBySno(sno: string): Item | undefined {
    if (!sno) return undefined;
    return this.getItems().find(
      i => i.sno.trim().toLowerCase() === sno.trim().toLowerCase()
    );
  }

  public getItemByName(name: string): Item | undefined {
    if (!name) return undefined;
    return this.getItems().find(
      i => i.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
  }

  public saveItem(item: Item): void {
    const items = this.getItems();
    const index = items.findIndex(i => i.id === item.id);
    const isNew = index < 0;

    if (isNew) {
      items.push(item);
      // Create initial opening stock movement if openingStock > 0 or 0
      this.addStockMovementInternal({
        id: `mov-init-${item.id}-${Date.now()}`,
        itemId: item.id,
        type: 'OPENING',
        qtyChange: Number(item.openingStock) || 0,
        refType: 'OPENING',
        refId: item.id,
        refNo: 'OPENING',
        date: item.createdAt || new Date().toISOString().split('T')[0],
        notes: 'Opening stock',
        createdAt: new Date().toISOString()
      });
    } else {
      const oldItem = items[index];
      items[index] = item;
      // If opening stock changed, adjust opening movement
      if (oldItem.openingStock !== item.openingStock) {
        this.updateOpeningStockMovement(item.id, item.openingStock);
      }
    }
    this.set(STORAGE_KEYS.ITEMS, items);
    this.notify();
  }

  public deleteItem(id: string): void {
    const items = this.getItems().filter(i => i.id !== id);
    this.set(STORAGE_KEYS.ITEMS, items);
    // Remove related stock movements
    this.deleteStockMovementsByItemId(id);
    this.notify();
  }

  // --- STOCK MOVEMENTS ---
  public getStockMovements(): StockMovement[] {
    return this.get(STORAGE_KEYS.STOCK_MOVEMENTS, []);
  }

  private addStockMovementInternal(movement: StockMovement): void {
    const movements = this.getStockMovements();
    movements.push(movement);
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, movements);
  }

  public addStockMovement(movement: StockMovement): void {
    this.addStockMovementInternal(movement);
    this.notify();
  }

  public deleteStockMovementsByRef(refType: string, refId: string): void {
    const movements = this.getStockMovements().filter(
      m => !(m.refType === refType && m.refId === refId)
    );
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, movements);
  }

  private deleteStockMovementsByItemId(itemId: string): void {
    const movements = this.getStockMovements().filter(m => m.itemId !== itemId);
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, movements);
  }

  private updateOpeningStockMovement(itemId: string, newOpeningQty: number): void {
    const movements = this.getStockMovements();
    const index = movements.findIndex(
      m => m.itemId === itemId && m.type === 'OPENING'
    );
    if (index >= 0) {
      movements[index].qtyChange = Number(newOpeningQty) || 0;
    } else {
      movements.push({
        id: `mov-open-${itemId}-${Date.now()}`,
        itemId,
        type: 'OPENING',
        qtyChange: Number(newOpeningQty) || 0,
        refType: 'OPENING',
        refId: itemId,
        refNo: 'OPENING',
        date: new Date().toISOString().split('T')[0],
        notes: 'Updated opening stock',
        createdAt: new Date().toISOString()
      });
    }
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, movements);
  }

  // --- ORDERS ---
  public getOrders(): SupplierOrder[] {
    return this.get(STORAGE_KEYS.ORDERS, []);
  }

  public getOrderById(id: string): SupplierOrder | undefined {
    return this.getOrders().find(o => o.id === id);
  }

  public saveOrder(order: SupplierOrder): void {
    const orders = this.getOrders();
    const index = orders.findIndex(o => o.id === order.id);
    if (index >= 0) {
      orders[index] = order;
    } else {
      orders.unshift(order);
    }
    this.set(STORAGE_KEYS.ORDERS, orders);
    this.notify();
  }

  public deleteOrder(id: string): void {
    const orders = this.getOrders().filter(o => o.id !== id);
    this.set(STORAGE_KEYS.ORDERS, orders);
    this.notify();
  }

  // --- SALES (Reduces Stock) ---
  public getSales(): Sale[] {
    return this.get(STORAGE_KEYS.SALES, []);
  }

  public getSaleById(id: string): Sale | undefined {
    return this.getSales().find(s => s.id === id);
  }

  public saveSale(sale: Sale): void {
    const sales = this.getSales();
    const index = sales.findIndex(s => s.id === sale.id);

    // Remove previous stock movements for this sale if editing
    this.deleteStockMovementsByRef('SALE', sale.id);

    if (index >= 0) {
      sales[index] = sale;
    } else {
      sales.unshift(sale);
    }
    this.set(STORAGE_KEYS.SALES, sales);

    // Create new stock out movements
    const movements = this.getStockMovements();
    sale.items.forEach(item => {
      const qtyChange = item.baseQty !== undefined ? -Math.abs(Number(item.baseQty)) : -Math.abs(Number(item.qty) || 0);
      movements.push({
        id: `mov-sale-${sale.id}-${item.id}-${Date.now()}`,
        itemId: item.itemId,
        type: 'SALE_OUT',
        qtyChange: Number(qtyChange.toFixed(3)),
        refType: 'SALE',
        refId: sale.id,
        refNo: sale.billNo,
        date: sale.billDate,
        notes: `Sale to ${sale.partyName} (Rate: ₹${item.salePrice}, Unit: ${item.unit || 'Default'})`,
        createdAt: new Date().toISOString()
      });
    });
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, movements);

    this.notify();
  }

  public deleteSale(id: string): void {
    const sales = this.getSales().filter(s => s.id !== id);
    this.set(STORAGE_KEYS.SALES, sales);
    this.deleteStockMovementsByRef('SALE', id);
    this.notify();
  }

  // --- PURCHASES (Increases Stock) ---
  public getPurchases(): Purchase[] {
    return this.get(STORAGE_KEYS.PURCHASES, []);
  }

  public getPurchaseById(id: string): Purchase | undefined {
    return this.getPurchases().find(p => p.id === id);
  }

  public savePurchase(purchase: Purchase): void {
    const purchases = this.getPurchases();
    const index = purchases.findIndex(p => p.id === purchase.id);

    // Remove previous stock movements for this purchase if editing
    this.deleteStockMovementsByRef('PURCHASE', purchase.id);

    if (index >= 0) {
      purchases[index] = purchase;
    } else {
      purchases.unshift(purchase);
    }
    this.set(STORAGE_KEYS.PURCHASES, purchases);

    // Create new stock in movements
    const movements = this.getStockMovements();
    purchase.items.forEach(item => {
      const qtyChange = item.baseQty !== undefined ? Math.abs(Number(item.baseQty)) : Math.abs(Number(item.qty) || 0);
      movements.push({
        id: `mov-pur-${purchase.id}-${item.id}-${Date.now()}`,
        itemId: item.itemId,
        type: 'PURCHASE_IN',
        qtyChange: Number(qtyChange.toFixed(3)),
        refType: 'PURCHASE',
        refId: purchase.id,
        refNo: purchase.billNo,
        date: purchase.recdDate || purchase.billDate,
        notes: `Purchase from ${purchase.supplierName} (Unit: ${item.unit || 'Default'})`,
        createdAt: new Date().toISOString()
      });
    });
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, movements);

    // If purchase is linked to an order, update received quantities on that order
    if (purchase.orderId) {
      const order = this.getOrderById(purchase.orderId);
      if (order) {
        let allReceived = true;
        order.items.forEach(ordItem => {
          const matchingPurItem = purchase.items.find(pi => pi.itemId === ordItem.itemId);
          if (matchingPurItem) {
            ordItem.receivedQty = (ordItem.receivedQty || 0) + matchingPurItem.qty;
          }
          if (ordItem.receivedQty < ordItem.orderedQty) {
            allReceived = false;
          }
        });
        order.status = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
        this.saveOrder(order);
      }
    }

    this.notify();
  }

  public deletePurchase(id: string): void {
    const purchases = this.getPurchases().filter(p => p.id !== id);
    this.set(STORAGE_KEYS.PURCHASES, purchases);
    this.deleteStockMovementsByRef('PURCHASE', id);
    this.notify();
  }

  // --- SELF USE (Reduces Stock) ---
  public getSelfUses(): SelfUse[] {
    return this.get(STORAGE_KEYS.SELF_USES, []);
  }

  public getSelfUseById(id: string): SelfUse | undefined {
    return this.getSelfUses().find(su => su.id === id);
  }

  public saveSelfUse(selfUse: SelfUse): void {
    const selfUses = this.getSelfUses();
    const index = selfUses.findIndex(su => su.id === selfUse.id);

    // Remove previous movements if editing
    this.deleteStockMovementsByRef('SELF_USE', selfUse.id);

    if (index >= 0) {
      selfUses[index] = selfUse;
    } else {
      selfUses.unshift(selfUse);
    }
    this.set(STORAGE_KEYS.SELF_USES, selfUses);

    // Create new stock out movements
    const movements = this.getStockMovements();
    selfUse.items.forEach(item => {
      const qtyChange = item.baseQty !== undefined ? -Math.abs(Number(item.baseQty)) : -Math.abs(Number(item.qty) || 0);
      movements.push({
        id: `mov-su-${selfUse.id}-${item.id}-${Date.now()}`,
        itemId: item.itemId,
        type: 'SELF_USE_OUT',
        qtyChange: Number(qtyChange.toFixed(3)),
        refType: 'SELF_USE',
        refId: selfUse.id,
        refNo: selfUse.billNo,
        date: selfUse.billDate,
        notes: `Internal Self Use: ${selfUse.remarks || 'Production'} (Unit: ${item.unit || 'Default'})`,
        createdAt: new Date().toISOString()
      });
    });
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, movements);

    this.notify();
  }

  public deleteSelfUse(id: string): void {
    const selfUses = this.getSelfUses().filter(su => su.id !== id);
    this.set(STORAGE_KEYS.SELF_USES, selfUses);
    this.deleteStockMovementsByRef('SELF_USE', id);
    this.notify();
  }

  // --- STOCK ADJUSTMENTS ---
  public getStockAdjustments(): StockAdjustment[] {
    return this.get(STORAGE_KEYS.STOCK_ADJUSTMENTS, []);
  }

  public saveStockAdjustment(adj: StockAdjustment): void {
    const adjustments = this.getStockAdjustments();
    adjustments.unshift(adj);
    this.set(STORAGE_KEYS.STOCK_ADJUSTMENTS, adjustments);

    // Record stock movement
    const movementType = adj.type === 'INCREASE' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
    const qtyChange = adj.type === 'INCREASE' ? Math.abs(adj.difference) : -Math.abs(adj.difference);

    this.addStockMovementInternal({
      id: `mov-adj-${adj.id}-${Date.now()}`,
      itemId: adj.itemId,
      type: movementType,
      qtyChange,
      refType: 'ADJUSTMENT',
      refId: adj.id,
      refNo: adj.adjustmentNo,
      date: adj.date,
      notes: `Stock Adjustment: ${adj.reason} (by ${adj.adjustedBy})`,
      createdAt: new Date().toISOString()
    });

    this.notify();
  }

  // --- BACKUP & RESTORE ---
  public exportFullBackupJSON(): string {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings: this.getSettings(),
      users: this.getUsers(),
      parties: this.getParties(),
      suppliers: this.getSuppliers(),
      items: this.getItems(),
      orders: this.getOrders(),
      sales: this.getSales(),
      purchases: this.getPurchases(),
      selfUses: this.getSelfUses(),
      stockMovements: this.getStockMovements(),
      stockAdjustments: this.getStockAdjustments()
    };
    return JSON.stringify(backupData, null, 2);
  }

  public importFullBackupJSON(jsonString: string): boolean {
    try {
      let data = JSON.parse(jsonString);
      if (data && data.data && typeof data.data === 'object') {
        data = { ...data, ...data.data };
      }
      if (!data) {
        throw new Error('Invalid backup file structure.');
      }
      if (data.settings) this.set(STORAGE_KEYS.SETTINGS, data.settings);
      if (data.users) this.set(STORAGE_KEYS.USERS, data.users);
      if (data.parties) this.set(STORAGE_KEYS.PARTIES, data.parties);
      if (data.suppliers) this.set(STORAGE_KEYS.SUPPLIERS, data.suppliers);
      if (data.items) this.set(STORAGE_KEYS.ITEMS, data.items);
      if (data.orders) this.set(STORAGE_KEYS.ORDERS, data.orders);
      if (data.sales) this.set(STORAGE_KEYS.SALES, data.sales);
      if (data.purchases) this.set(STORAGE_KEYS.PURCHASES, data.purchases);
      if (data.selfUses) this.set(STORAGE_KEYS.SELF_USES, data.selfUses);
      if (data.stockMovements) this.set(STORAGE_KEYS.STOCK_MOVEMENTS, data.stockMovements);
      if (data.stockAdjustments) this.set(STORAGE_KEYS.STOCK_ADJUSTMENTS, data.stockAdjustments);

      this.notify();
      return true;
    } catch (e) {
      console.error('Failed to import backup:', e);
      return false;
    }
  }

  // --- SELECTIVE DATA DELETION ---
  public getDeletePreviewCounts(options: DeleteFilterOptions): {
    orders: number;
    purchases: number;
    sales: number;
    selfUse: number;
    adjustments: number;
    openingStock: number;
    items: number;
    suppliers: number;
    parties: number;
    total: number;
  } {
    const { fromDate, toDate, modules } = options;
    const filterByDate = (dateVal?: string) => {
      if (!dateVal) return true;
      return dateVal >= fromDate && dateVal <= toDate;
    };

    const counts = {
      orders: modules.orders ? this.getOrders().filter(o => filterByDate(o.orderDate)).length : 0,
      purchases: modules.purchases ? this.getPurchases().filter(p => filterByDate(p.billDate)).length : 0,
      sales: modules.sales ? this.getSales().filter(s => filterByDate(s.billDate)).length : 0,
      selfUse: modules.selfUse ? this.getSelfUses().filter(su => filterByDate(su.billDate)).length : 0,
      adjustments: modules.adjustments ? this.getStockAdjustments().filter(a => filterByDate(a.date)).length : 0,
      openingStock: modules.openingStock ? this.getStockMovements().filter(m => m.type === 'OPENING').length : 0,
      items: modules.items ? this.getItems().length : 0,
      suppliers: modules.suppliers ? this.getSuppliers().length : 0,
      parties: modules.parties ? this.getParties().length : 0,
      total: 0
    };

    counts.total = counts.orders + counts.purchases + counts.sales + counts.selfUse +
      counts.adjustments + counts.openingStock + counts.items + counts.suppliers + counts.parties;

    return counts;
  }

  public deleteDataByFilter(options: DeleteFilterOptions): { [key: string]: number } {
    const { fromDate, toDate, modules } = options;
    const filterByDate = (dateVal?: string) => {
      if (!dateVal) return true;
      return dateVal >= fromDate && dateVal <= toDate;
    };

    const deletedCounts: { [key: string]: number } = {
      orders: 0,
      purchases: 0,
      sales: 0,
      selfUse: 0,
      adjustments: 0,
      openingStock: 0,
      items: 0,
      suppliers: 0,
      parties: 0
    };

    // 1. Delete Orders
    if (modules.orders) {
      const allOrders = this.getOrders();
      const remainingOrders = allOrders.filter(o => !filterByDate(o.orderDate));
      deletedCounts.orders = allOrders.length - remainingOrders.length;
      this.set(STORAGE_KEYS.ORDERS, remainingOrders);
    }

    // 2. Delete Purchases
    if (modules.purchases) {
      const allPurchases = this.getPurchases();
      const purchasesToDelete = allPurchases.filter(p => filterByDate(p.billDate));
      const remainingPurchases = allPurchases.filter(p => !filterByDate(p.billDate));
      deletedCounts.purchases = purchasesToDelete.length;
      this.set(STORAGE_KEYS.PURCHASES, remainingPurchases);

      purchasesToDelete.forEach(p => {
        this.deleteStockMovementsByRef('PURCHASE', p.id);
      });
    }

    // 3. Delete Sales
    if (modules.sales) {
      const allSales = this.getSales();
      const salesToDelete = allSales.filter(s => filterByDate(s.billDate));
      const remainingSales = allSales.filter(s => !filterByDate(s.billDate));
      deletedCounts.sales = salesToDelete.length;
      this.set(STORAGE_KEYS.SALES, remainingSales);

      salesToDelete.forEach(s => {
        this.deleteStockMovementsByRef('SALE', s.id);
      });
    }

    // 4. Delete Self Use
    if (modules.selfUse) {
      const allSelfUses = this.getSelfUses();
      const selfUsesToDelete = allSelfUses.filter(su => filterByDate(su.billDate));
      const remainingSelfUses = allSelfUses.filter(su => !filterByDate(su.billDate));
      deletedCounts.selfUse = selfUsesToDelete.length;
      this.set(STORAGE_KEYS.SELF_USES, remainingSelfUses);

      selfUsesToDelete.forEach(su => {
        this.deleteStockMovementsByRef('SELF_USE', su.id);
      });
    }

    // 5. Delete Adjustments
    if (modules.adjustments) {
      const allAdjustments = this.getStockAdjustments();
      const adjustmentsToDelete = allAdjustments.filter(a => filterByDate(a.date));
      const remainingAdjustments = allAdjustments.filter(a => !filterByDate(a.date));
      deletedCounts.adjustments = adjustmentsToDelete.length;
      this.set(STORAGE_KEYS.STOCK_ADJUSTMENTS, remainingAdjustments);

      adjustmentsToDelete.forEach(a => {
        this.deleteStockMovementsByRef('ADJUSTMENT', a.id);
      });
    }

    // 6. Delete Opening Stock
    if (modules.openingStock) {
      const movements = this.getStockMovements();
      const nonOpening = movements.filter(m => m.type !== 'OPENING');
      deletedCounts.openingStock = movements.length - nonOpening.length;
      this.set(STORAGE_KEYS.STOCK_MOVEMENTS, nonOpening);

      const items = this.getItems().map(it => ({ ...it, openingStock: 0 }));
      this.set(STORAGE_KEYS.ITEMS, items);
    }

    // 7. Delete Items (Only if explicitly checked)
    if (modules.items) {
      const items = this.getItems();
      deletedCounts.items = items.length;
      this.set(STORAGE_KEYS.ITEMS, []);
      this.set(STORAGE_KEYS.STOCK_MOVEMENTS, []);
    }

    // 8. Delete Suppliers (Only if explicitly checked)
    if (modules.suppliers) {
      const suppliers = this.getSuppliers();
      deletedCounts.suppliers = suppliers.length;
      this.set(STORAGE_KEYS.SUPPLIERS, []);
    }

    // 9. Delete Parties (Only if explicitly checked)
    if (modules.parties) {
      const parties = this.getParties();
      deletedCounts.parties = parties.length;
      this.set(STORAGE_KEYS.PARTIES, []);
    }

    this.notify();
    return deletedCounts;
  }
}

export interface DeleteFilterOptions {
  fromDate: string;
  toDate: string;
  isCustomDate: boolean;
  modules: {
    orders: boolean;
    purchases: boolean;
    sales: boolean;
    selfUse: boolean;
    adjustments: boolean;
    openingStock?: boolean;
    items?: boolean;
    suppliers?: boolean;
    parties?: boolean;
  };
}

export const db = new DatabaseService();
