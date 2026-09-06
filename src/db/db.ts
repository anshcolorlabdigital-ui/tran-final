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
  CompanySettings,
  PartyLog
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
import { firestore } from '../services/firebase';
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';

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
  PARTY_LOGS: 'rmms_party_logs_v1',
  INITIALIZED: 'rmms_initialized_v1'
};

export interface CloudSyncState {
  status: 'CONNECTED' | 'SYNCING' | 'LOCAL' | 'ERROR';
  lastSync: string | null;
  error?: string | null;
  projectId: string;
}

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
  private unsubs: Unsubscribe[] = [];
  private cloudSyncState: CloudSyncState = {
    status: 'LOCAL',
    lastSync: null,
    error: null,
    projectId: 'acl-inventory-mange-final'
  };

  constructor() {
    this.initDatabase();
    this.initFirestoreSync();
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

  public getCloudSyncState(): CloudSyncState {
    return { ...this.cloudSyncState };
  }

  private updateSyncSuccess(): void {
    this.cloudSyncState = {
      status: 'CONNECTED',
      lastSync: new Date().toLocaleTimeString(),
      error: null,
      projectId: 'acl-inventory-mange-final'
    };
    this.notify();
  }

  private handleSyncError(err: any): void {
    console.warn('Firestore real-time sync status:', err?.message || err);
    this.cloudSyncState = {
      status: 'LOCAL',
      lastSync: this.cloudSyncState.lastSync,
      error: err?.message || 'Firestore offline or pending connection',
      projectId: 'acl-inventory-mange-final'
    };
    this.notify();
  }

  public async pushDocToFirestore(collectionName: string, docId: string, data: any): Promise<void> {
    try {
      if (typeof window === 'undefined') return;
      const cleanData = JSON.parse(JSON.stringify(data));
      const docRef = doc(firestore, collectionName, String(docId));
      await setDoc(docRef, cleanData, { merge: true });
      this.updateSyncSuccess();
    } catch (err: any) {
      this.handleSyncError(err);
    }
  }

  public async deleteDocFromFirestore(collectionName: string, docId: string): Promise<void> {
    try {
      if (typeof window === 'undefined') return;
      const docRef = doc(firestore, collectionName, String(docId));
      await deleteDoc(docRef);
      this.updateSyncSuccess();
    } catch (err: any) {
      console.warn(`Firestore delete warning for ${collectionName}/${docId}:`, err);
    }
  }

  public async batchDeleteDocs(collectionName: string, docIds: string[]): Promise<void> {
    if (typeof window === 'undefined' || !docIds || docIds.length === 0) return;
    try {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < docIds.length; i += CHUNK_SIZE) {
        const chunk = docIds.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(firestore);
        chunk.forEach(id => {
          if (id) {
            batch.delete(doc(firestore, collectionName, String(id)));
          }
        });
        await batch.commit();
      }
      this.updateSyncSuccess();
    } catch (err: any) {
      console.warn(`Firestore batch delete warning for ${collectionName}:`, err);
    }
  }

  public async batchSetDocs<T extends { id: string }>(collectionName: string, items: T[]): Promise<void> {
    if (typeof window === 'undefined' || !items || items.length === 0) return;
    try {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(firestore);
        chunk.forEach(item => {
          if (item && item.id) {
            const cleanData = JSON.parse(JSON.stringify(item));
            batch.set(doc(firestore, collectionName, String(item.id)), cleanData, { merge: true });
          }
        });
        await batch.commit();
      }
      this.updateSyncSuccess();
    } catch (err: any) {
      console.warn(`Firestore batch set warning for ${collectionName}:`, err);
    }
  }

  private initFirestoreSync(): void {
    if (typeof window === 'undefined') return;

    // Clean up any existing listeners before establishing new ones
    this.unsubs.forEach(unsub => {
      try { unsub(); } catch (e) {}
    });
    this.unsubs = [];

    try {
      this.cloudSyncState.status = 'SYNCING';
      this.notify();

      // 1. Real-time listener for Settings
      const settingsUnsub = onSnapshot(doc(firestore, 'app_metadata', 'settings'), (docSnap) => {
        if (docSnap.exists()) {
          const cloudSettings = docSnap.data() as CompanySettings;
          if (cloudSettings) {
            this.set(STORAGE_KEYS.SETTINGS, cloudSettings);
            this.updateSyncSuccess();
          }
        }
      }, (err) => {
        this.handleSyncError(err);
      });
      this.unsubs.push(settingsUnsub);

      // 2. Pure real-time collection synchronization (Firestore is single source of truth)
      const setupCollectionSync = <T extends { id: string }>(
        collectionName: string,
        storageKey: string
      ) => {
        const unsub = onSnapshot(collection(firestore, collectionName), (snapshot) => {
          const cloudDocs = snapshot.docs.map(d => d.data() as T);
          this.set(storageKey, cloudDocs);
          this.updateSyncSuccess();
        }, (err) => {
          this.handleSyncError(err);
        });
        this.unsubs.push(unsub);
      };

      // Set up real-time bidirectional listeners for all master and transaction entities
      setupCollectionSync<Item>('items', STORAGE_KEYS.ITEMS);
      setupCollectionSync<Supplier>('suppliers', STORAGE_KEYS.SUPPLIERS);
      setupCollectionSync<Party>('parties', STORAGE_KEYS.PARTIES);
      setupCollectionSync<Sale>('sales', STORAGE_KEYS.SALES);
      setupCollectionSync<Purchase>('purchases', STORAGE_KEYS.PURCHASES);
      setupCollectionSync<SupplierOrder>('orders', STORAGE_KEYS.ORDERS);
      setupCollectionSync<SelfUse>('self_uses', STORAGE_KEYS.SELF_USES);
      setupCollectionSync<StockAdjustment>('stock_adjustments', STORAGE_KEYS.STOCK_ADJUSTMENTS);
      setupCollectionSync<PartyLog>('party_logs', STORAGE_KEYS.PARTY_LOGS);
      setupCollectionSync<User>('users', STORAGE_KEYS.USERS);
      setupCollectionSync<StockMovement>('stock_movements', STORAGE_KEYS.STOCK_MOVEMENTS);

    } catch (err: any) {
      this.handleSyncError(err);
    }
  }

  public async pushAllToCloudFirestore(): Promise<boolean> {
    try {
      this.cloudSyncState.status = 'SYNCING';
      this.notify();

      // Push settings
      await setDoc(doc(firestore, 'app_metadata', 'settings'), this.getSettings());

      // Push all collections with fast batches
      await this.batchSetDocs('parties', this.getParties());
      await this.batchSetDocs('items', this.getItems());
      await this.batchSetDocs('suppliers', this.getSuppliers());
      await this.batchSetDocs('orders', this.getOrders());
      await this.batchSetDocs('sales', this.getSales());
      await this.batchSetDocs('purchases', this.getPurchases());
      await this.batchSetDocs('self_uses', this.getSelfUses());
      await this.batchSetDocs('stock_adjustments', this.getStockAdjustments());
      await this.batchSetDocs('party_logs', this.getPartyLogs());
      await this.batchSetDocs('stock_movements', this.getStockMovements());

      this.cloudSyncState = {
        status: 'CONNECTED',
        lastSync: new Date().toLocaleTimeString(),
        error: null,
        projectId: 'acl-inventory-mange-final'
      };
      this.notify();
      return true;
    } catch (e: any) {
      console.error('Error pushing to Firestore:', e);
      this.cloudSyncState = {
        status: 'ERROR',
        lastSync: this.cloudSyncState.lastSync,
        error: e?.message || 'Failed to push to Cloud Firestore',
        projectId: 'acl-inventory-mange-final'
      };
      this.notify();
      return false;
    }
  }

  public async pullAllFromCloudFirestore(): Promise<{ success: boolean; stats: Record<string, number>; error?: string }> {
    try {
      this.cloudSyncState.status = 'SYNCING';
      this.notify();

      const stats: Record<string, number> = {
        items: 0,
        suppliers: 0,
        parties: 0,
        sales: 0,
        purchases: 0,
        orders: 0,
        self_uses: 0,
        stock_movements: 0,
        stock_adjustments: 0,
        party_logs: 0
      };

      // Pull Settings
      const settingsDoc = await getDoc(doc(firestore, 'app_metadata', 'settings'));
      if (settingsDoc.exists()) {
        const cloudSettings = settingsDoc.data() as CompanySettings;
        if (cloudSettings) this.set(STORAGE_KEYS.SETTINGS, cloudSettings);
      }

      // Helper to pull collection
      const pullCollection = async <T extends { id: string }>(colName: string, storageKey: string, statKey: string) => {
        const snap = await getDocs(collection(firestore, colName));
        const docs = snap.docs.map(d => d.data() as T);
        this.set(storageKey, docs);
        stats[statKey] = docs.length;
      };

      await pullCollection<Item>('items', STORAGE_KEYS.ITEMS, 'items');
      await pullCollection<Supplier>('suppliers', STORAGE_KEYS.SUPPLIERS, 'suppliers');
      await pullCollection<Party>('parties', STORAGE_KEYS.PARTIES, 'parties');
      await pullCollection<Sale>('sales', STORAGE_KEYS.SALES, 'sales');
      await pullCollection<Purchase>('purchases', STORAGE_KEYS.PURCHASES, 'purchases');
      await pullCollection<SupplierOrder>('orders', STORAGE_KEYS.ORDERS, 'orders');
      await pullCollection<SelfUse>('self_uses', STORAGE_KEYS.SELF_USES, 'self_uses');
      await pullCollection<StockMovement>('stock_movements', STORAGE_KEYS.STOCK_MOVEMENTS, 'stock_movements');
      await pullCollection<StockAdjustment>('stock_adjustments', STORAGE_KEYS.STOCK_ADJUSTMENTS, 'stock_adjustments');
      await pullCollection<PartyLog>('party_logs', STORAGE_KEYS.PARTY_LOGS, 'party_logs');

      this.cloudSyncState = {
        status: 'CONNECTED',
        lastSync: new Date().toLocaleTimeString(),
        error: null,
        projectId: 'acl-inventory-mange-final'
      };
      this.notify();
      return { success: true, stats };
    } catch (e: any) {
      console.error('Error pulling from Cloud Firestore:', e);
      this.cloudSyncState = {
        status: 'ERROR',
        lastSync: this.cloudSyncState.lastSync,
        error: e?.message || 'Failed to pull from Cloud Firestore',
        projectId: 'acl-inventory-mange-final'
      };
      this.notify();
      return { success: false, stats: {}, error: e?.message };
    }
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
    if (forceReset) {
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
      this.set(STORAGE_KEYS.PARTY_LOGS, []);
      this.pushAllToCloudFirestore().catch(() => {});
      this.notify();
    } else {
      // Ensure basic system settings/users default if missing
      if (!safeGetStorage(STORAGE_KEYS.SETTINGS)) {
        this.set(STORAGE_KEYS.SETTINGS, INITIAL_COMPANY_SETTINGS);
      }
      if (!safeGetStorage(STORAGE_KEYS.USERS)) {
        this.set(STORAGE_KEYS.USERS, INITIAL_USERS);
      }
      // Purge any lingering A2222 test artifacts asynchronously
      this.purgeOrphanedTestItems().catch(() => {});
    }
  }

  // --- SETTINGS ---
  public getSettings(): CompanySettings {
    return this.get(STORAGE_KEYS.SETTINGS, INITIAL_COMPANY_SETTINGS);
  }

  public saveSettings(settings: CompanySettings): void {
    this.set(STORAGE_KEYS.SETTINGS, settings);
    this.pushDocToFirestore('app_metadata', 'settings', settings);
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
    this.pushDocToFirestore('users', user.id, user);
    this.notify();
  }

  public deleteUser(id: string): void {
    const users = this.getUsers().filter(u => u.id !== id);
    this.set(STORAGE_KEYS.USERS, users);
    this.deleteDocFromFirestore('users', id);
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
    this.pushDocToFirestore('parties', party.id, party);
    this.notify();
  }

  public deleteParty(id: string): void {
    const parties = this.getParties().filter(p => p.id !== id);
    this.set(STORAGE_KEYS.PARTIES, parties);
    this.deleteDocFromFirestore('parties', id);
    this.notify();
  }

  // --- PARTY LOGS (Customer Ledger Statements) ---
  public getPartyLogs(): PartyLog[] {
    return this.get(STORAGE_KEYS.PARTY_LOGS, []);
  }

  public getPartyLogsByPartyId(partyId: string): PartyLog[] {
    const logs = this.getPartyLogs().filter(l => l.partyId === partyId);
    logs.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : (a.createdAt > b.createdAt ? 1 : -1)));

    let running = 0;
    return logs.map(log => {
      running += (Number(log.balanceChange) || 0);
      return {
        ...log,
        runningBalance: Number(running.toFixed(2))
      };
    });
  }

  public savePartyLog(log: PartyLog): void {
    const logs = this.getPartyLogs();
    const index = logs.findIndex(l => l.id === log.id);
    if (index >= 0) {
      logs[index] = log;
    } else {
      logs.push(log);
    }
    this.set(STORAGE_KEYS.PARTY_LOGS, logs);
    this.pushDocToFirestore('party_logs', log.id, log);
    this.notify();
  }

  public recordPartyPayment(
    partyId: string,
    amount: number,
    paymentMode: 'CASH' | 'UPI' | 'COMBINED' = 'CASH',
    refNo?: string,
    notes?: string
  ): PartyLog {
    const party = this.getPartyById(partyId);
    const partyName = party?.name || 'Customer';
    const numAmount = Number(amount) || 0;
    const paymentRecord: PartyLog = {
      id: `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      partyId,
      partyName,
      date: new Date().toISOString().split('T')[0],
      type: 'PAYMENT',
      refNo: refNo?.trim() || `RCPT-${Date.now().toString().slice(-4)}`,
      totalAmount: numAmount,
      paidAmount: numAmount,
      balanceChange: -numAmount,
      paymentMode,
      notes: notes?.trim() || `Payment received via ${paymentMode}`,
      createdAt: new Date().toISOString()
    };

    this.savePartyLog(paymentRecord);
    return paymentRecord;
  }

  public deletePartyLog(id: string): void {
    const logs = this.getPartyLogs().filter(l => l.id !== id);
    this.set(STORAGE_KEYS.PARTY_LOGS, logs);
    this.deleteDocFromFirestore('party_logs', id);
    this.notify();
  }

  public getPartyBalanceSummary(partyId: string): {
    totalBilled: number;
    totalPaid: number;
    outstandingBalance: number;
  } {
    const logs = this.getPartyLogsByPartyId(partyId);
    let totalBilled = 0;
    let totalPaid = 0;
    let outstandingBalance = 0;

    logs.forEach(l => {
      if (l.type === 'SALE') {
        totalBilled += Number(l.totalAmount) || 0;
        totalPaid += Number(l.paidAmount) || 0;
      } else if (l.type === 'PAYMENT') {
        totalPaid += Number(l.paidAmount) || 0;
      }
      outstandingBalance += Number(l.balanceChange) || 0;
    });

    return {
      totalBilled: Number(totalBilled.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      outstandingBalance: Number(outstandingBalance.toFixed(2))
    };
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
    this.pushDocToFirestore('suppliers', supplier.id, supplier);
    this.notify();
  }

  public deleteSupplier(id: string): void {
    const suppliers = this.getSuppliers().filter(s => s.id !== id);
    this.set(STORAGE_KEYS.SUPPLIERS, suppliers);
    this.deleteDocFromFirestore('suppliers', id);
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
    this.pushDocToFirestore('items', item.id, item);
    this.notify();
  }

  public async deleteItem(idOrSnoOrName: string): Promise<void> {
    const target = (idOrSnoOrName || '').trim();
    const items = this.getItems();
    const foundItem = items.find(
      i => i.id === target || i.sno === target || i.name.toUpperCase() === target.toUpperCase()
    );

    const targetId = foundItem ? foundItem.id : target;
    const targetSno = foundItem ? foundItem.sno : target;
    const targetName = foundItem ? foundItem.name.toUpperCase() : target.toUpperCase();

    // 1. Remove from items
    const remainingItems = items.filter(
      i => i.id !== targetId && i.sno !== targetSno && i.name.toUpperCase() !== targetName
    );
    this.set(STORAGE_KEYS.ITEMS, remainingItems);
    await this.deleteDocFromFirestore('items', targetId);

    // 2. Remove all related stock movements (OPENING, PURCHASE_IN, SALE_OUT, SELF_USE_OUT, ADJUSTMENT)
    const allMovements = this.getStockMovements();
    const movToDelete = allMovements.filter(
      m => m.itemId === targetId || m.itemId === targetSno || m.refId === targetId
    );
    const remainingMovements = allMovements.filter(
      m => m.itemId !== targetId && m.itemId !== targetSno && m.refId !== targetId
    );
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, remainingMovements);
    if (movToDelete.length > 0) {
      await this.batchDeleteDocs('stock_movements', movToDelete.map(m => m.id));
    }

    // 3. Remove this item from all active and placed orders
    const allOrders = this.getOrders();
    const ordersToDeleteIds: string[] = [];
    const ordersToUpdate: SupplierOrder[] = [];
    const updatedOrdersList: SupplierOrder[] = [];

    for (const ord of allOrders) {
      const remainingItems = ord.items.filter(
        oi => oi.itemId !== targetId && oi.sno !== targetSno && oi.itemName.toUpperCase() !== targetName
      );
      if (remainingItems.length === 0) {
        ordersToDeleteIds.push(ord.id);
      } else if (remainingItems.length !== ord.items.length) {
        const updatedOrd = { ...ord, items: remainingItems };
        ordersToUpdate.push(updatedOrd);
        updatedOrdersList.push(updatedOrd);
      } else {
        updatedOrdersList.push(ord);
      }
    }

    if (ordersToDeleteIds.length > 0) {
      await this.batchDeleteDocs('orders', ordersToDeleteIds);
    }
    if (ordersToUpdate.length > 0) {
      await this.batchSetDocs('orders', ordersToUpdate);
    }
    this.set(STORAGE_KEYS.ORDERS, updatedOrdersList);

    this.notify();
  }

  public async purgeOrphanedTestItems(): Promise<{ purgedCount: number }> {
    const items = this.getItems();
    const testItems = items.filter(
      i => i.name.toUpperCase().includes('A2222') || i.sno.includes('A2222') || i.id.includes('a2222')
    );
    let purgedCount = 0;
    for (const ti of testItems) {
      await this.deleteItem(ti.id);
      purgedCount++;
    }

    // Clean up any remaining movements or orders referencing A2222
    const allMovements = this.getStockMovements();
    const orphanMov = allMovements.filter(
      m => m.itemId.toLowerCase().includes('a2222') || m.refId.toLowerCase().includes('a2222') || m.refNo.toLowerCase().includes('a2222')
    );
    if (orphanMov.length > 0) {
      const remainingMov = allMovements.filter(m => !orphanMov.includes(m));
      this.set(STORAGE_KEYS.STOCK_MOVEMENTS, remainingMov);
      await this.batchDeleteDocs('stock_movements', orphanMov.map(m => m.id));
      purgedCount += orphanMov.length;
    }

    const allOrders = this.getOrders();
    for (const ord of allOrders) {
      const hasA2 = ord.items.some(
        oi => oi.itemId.toLowerCase().includes('a2222') || oi.itemName.toUpperCase().includes('A2222')
      );
      if (hasA2) {
        const remainingLines = ord.items.filter(
          oi => !oi.itemId.toLowerCase().includes('a2222') && !oi.itemName.toUpperCase().includes('A2222')
        );
        if (remainingLines.length === 0) {
          await this.deleteDocFromFirestore('orders', ord.id);
        } else {
          const updatedOrd = { ...ord, items: remainingLines };
          await this.pushDocToFirestore('orders', ord.id, updatedOrd);
        }
      }
    }
    this.notify();
    return { purgedCount };
  }

  // --- STOCK MOVEMENTS ---
  public getStockMovements(): StockMovement[] {
    return this.get(STORAGE_KEYS.STOCK_MOVEMENTS, []);
  }

  private addStockMovementInternal(movement: StockMovement): void {
    const movements = this.getStockMovements();
    movements.push(movement);
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, movements);
    this.pushDocToFirestore('stock_movements', movement.id, movement);
  }

  public addStockMovement(movement: StockMovement): void {
    this.addStockMovementInternal(movement);
    this.notify();
  }

  public deleteStockMovementsByRef(refType: string, refId: string): void {
    const allMovements = this.getStockMovements();
    const toDelete = allMovements.filter(m => m.refType === refType && m.refId === refId);
    const movements = allMovements.filter(
      m => !(m.refType === refType && m.refId === refId)
    );
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, movements);
    toDelete.forEach(m => this.deleteDocFromFirestore('stock_movements', m.id));
  }

  private deleteStockMovementsByItemId(itemId: string): void {
    const allMovements = this.getStockMovements();
    const toDelete = allMovements.filter(m => m.itemId === itemId);
    const movements = allMovements.filter(m => m.itemId !== itemId);
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, movements);
    toDelete.forEach(m => this.deleteDocFromFirestore('stock_movements', m.id));
  }

  private updateOpeningStockMovement(itemId: string, newOpeningQty: number): void {
    const movements = this.getStockMovements();
    const index = movements.findIndex(
      m => m.itemId === itemId && m.type === 'OPENING'
    );
    if (index >= 0) {
      movements[index].qtyChange = Number(newOpeningQty) || 0;
      this.pushDocToFirestore('stock_movements', movements[index].id, movements[index]);
    } else {
      const newMovement: StockMovement = {
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
      };
      movements.push(newMovement);
      this.pushDocToFirestore('stock_movements', newMovement.id, newMovement);
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
    this.pushDocToFirestore('orders', order.id, order);
    this.notify();
  }

  public deleteOrder(id: string): void {
    const orders = this.getOrders().filter(o => o.id !== id);
    this.set(STORAGE_KEYS.ORDERS, orders);
    this.deleteDocFromFirestore('orders', id);
    this.notify();
  }

  // --- SALES (Reduces Stock & Maintains Party Ledger) ---
  public getSales(): Sale[] {
    return this.get(STORAGE_KEYS.SALES, []);
  }

  public getSaleById(id: string): Sale | undefined {
    return this.getSales().find(s => s.id === id);
  }

  public saveSale(sale: Sale): void {
    const sales = this.getSales();
    const index = sales.findIndex(s => s.id === sale.id);

    // Calculate balance due and credit status
    const totalPaid = (Number(sale.recdCash) || 0) + (Number(sale.recdUpi) || 0);
    const balanceDue = Number((sale.billTotal - totalPaid).toFixed(2));
    sale.balanceDue = balanceDue;
    sale.isCreditSale = balanceDue > 0;

    // Remove previous stock movements for this sale if editing
    this.deleteStockMovementsByRef('SALE', sale.id);

    if (index >= 0) {
      sales[index] = sale;
    } else {
      sales.unshift(sale);
    }
    this.set(STORAGE_KEYS.SALES, sales);
    this.pushDocToFirestore('sales', sale.id, sale);

    // Create new stock out movements
    const movements = this.getStockMovements();
    sale.items.forEach(item => {
      const qtyChange = item.baseQty !== undefined ? -Math.abs(Number(item.baseQty)) : -Math.abs(Number(item.qty) || 0);
      const mov: StockMovement = {
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
      };
      movements.push(mov);
      this.pushDocToFirestore('stock_movements', mov.id, mov);
    });
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, movements);

    // Maintain customer statement ledger if sale is associated with a party
    if (sale.partyId) {
      const logs = this.getPartyLogs().filter(l => !(l.type === 'SALE' && l.refNo === sale.billNo));
      const logRecord: PartyLog = {
        id: `log-sale-${sale.id}`,
        partyId: sale.partyId,
        partyName: sale.partyName,
        date: sale.billDate,
        type: 'SALE',
        refNo: sale.billNo,
        totalAmount: sale.billTotal,
        paidAmount: totalPaid,
        balanceChange: balanceDue,
        notes: balanceDue > 0 ? `Credit Sale (Due: ₹${balanceDue})` : 'Full Payment Received',
        createdAt: sale.createdAt || new Date().toISOString()
      };
      logs.push(logRecord);
      this.set(STORAGE_KEYS.PARTY_LOGS, logs);
      this.pushDocToFirestore('party_logs', logRecord.id, logRecord);
    }

    this.notify();
  }

  public deleteSale(id: string): void {
    const sale = this.getSaleById(id);
    const sales = this.getSales().filter(s => s.id !== id);
    this.set(STORAGE_KEYS.SALES, sales);
    this.deleteDocFromFirestore('sales', id);
    this.deleteStockMovementsByRef('SALE', id);

    if (sale) {
      const logs = this.getPartyLogs().filter(l => !(l.type === 'SALE' && l.refNo === sale.billNo));
      this.set(STORAGE_KEYS.PARTY_LOGS, logs);
      this.deleteDocFromFirestore('party_logs', `log-sale-${sale.id}`);
    }

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
    this.pushDocToFirestore('purchases', purchase.id, purchase);

    // Create new stock in movements
    const movements = this.getStockMovements();
    purchase.items.forEach(item => {
      const qtyChange = item.baseQty !== undefined ? Math.abs(Number(item.baseQty)) : Math.abs(Number(item.qty) || 0);
      const mov: StockMovement = {
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
      };
      movements.push(mov);
      this.pushDocToFirestore('stock_movements', mov.id, mov);
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
    this.deleteDocFromFirestore('purchases', id);
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
    this.pushDocToFirestore('self_uses', selfUse.id, selfUse);

    // Create new stock out movements
    const movements = this.getStockMovements();
    selfUse.items.forEach(item => {
      const qtyChange = item.baseQty !== undefined ? -Math.abs(Number(item.baseQty)) : -Math.abs(Number(item.qty) || 0);
      const mov: StockMovement = {
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
      };
      movements.push(mov);
      this.pushDocToFirestore('stock_movements', mov.id, mov);
    });
    this.set(STORAGE_KEYS.STOCK_MOVEMENTS, movements);

    this.notify();
  }

  public deleteSelfUse(id: string): void {
    const selfUses = this.getSelfUses().filter(su => su.id !== id);
    this.set(STORAGE_KEYS.SELF_USES, selfUses);
    this.deleteDocFromFirestore('self_uses', id);
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
    this.pushDocToFirestore('stock_adjustments', adj.id, adj);

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
      stockAdjustments: this.getStockAdjustments(),
      partyLogs: this.getPartyLogs()
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
      if (data.partyLogs) this.set(STORAGE_KEYS.PARTY_LOGS, data.partyLogs);

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
    const { fromDate, toDate, isAllTime } = options;
    const mods = options.modules || {
      orders: Boolean((options as any).deleteOrders || (options as any).orders),
      purchases: Boolean((options as any).deletePurchases || (options as any).purchases),
      sales: Boolean((options as any).deleteSales || (options as any).sales),
      selfUse: Boolean((options as any).deleteSelfUse || (options as any).selfUse),
      adjustments: Boolean((options as any).deleteStockAdjustments || (options as any).adjustments),
      openingStock: Boolean((options as any).deleteOpeningStock || (options as any).openingStock),
      items: Boolean((options as any).deleteItems || (options as any).items),
      suppliers: Boolean((options as any).deleteSuppliers || (options as any).suppliers),
      parties: Boolean((options as any).deleteParties || (options as any).parties),
    };

    const filterByDate = (dateVal?: string) => {
      if (isAllTime) return true;
      if (!dateVal) return true;
      if (!fromDate || !toDate) return true;
      return dateVal >= fromDate && dateVal <= toDate;
    };

    const counts = {
      orders: mods.orders ? this.getOrders().filter(o => filterByDate(o.orderDate)).length : 0,
      purchases: mods.purchases ? this.getPurchases().filter(p => filterByDate(p.billDate)).length : 0,
      sales: mods.sales ? this.getSales().filter(s => filterByDate(s.billDate)).length : 0,
      selfUse: mods.selfUse ? this.getSelfUses().filter(su => filterByDate(su.billDate)).length : 0,
      adjustments: mods.adjustments ? this.getStockAdjustments().filter(a => filterByDate(a.date)).length : 0,
      openingStock: mods.openingStock ? this.getStockMovements().filter(m => m.type === 'OPENING').length : 0,
      items: mods.items ? this.getItems().length : 0,
      suppliers: mods.suppliers ? this.getSuppliers().length : 0,
      parties: mods.parties ? this.getParties().length : 0,
      total: 0
    };

    counts.total = counts.orders + counts.purchases + counts.sales + counts.selfUse +
      counts.adjustments + counts.openingStock + counts.items + counts.suppliers + counts.parties;

    return counts;
  }

  public async deleteDataByFilter(options: DeleteFilterOptions): Promise<{ [key: string]: number }> {
    const { fromDate, toDate, isAllTime } = options;
    const mods = options.modules || {
      orders: Boolean((options as any).deleteOrders || (options as any).orders),
      purchases: Boolean((options as any).deletePurchases || (options as any).purchases),
      sales: Boolean((options as any).deleteSales || (options as any).sales),
      selfUse: Boolean((options as any).deleteSelfUse || (options as any).selfUse),
      adjustments: Boolean((options as any).deleteStockAdjustments || (options as any).adjustments),
      openingStock: Boolean((options as any).deleteOpeningStock || (options as any).openingStock),
      items: Boolean((options as any).deleteItems || (options as any).items),
      suppliers: Boolean((options as any).deleteSuppliers || (options as any).suppliers),
      parties: Boolean((options as any).deleteParties || (options as any).parties),
    };

    const filterByDate = (dateVal?: string) => {
      if (isAllTime) return true;
      if (!dateVal) return true;
      if (!fromDate || !toDate) return true;
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
    if (mods.orders) {
      const allOrders = this.getOrders();
      const ordersToDelete = allOrders.filter(o => filterByDate(o.orderDate));
      const remainingOrders = allOrders.filter(o => !filterByDate(o.orderDate));
      deletedCounts.orders = ordersToDelete.length;
      this.set(STORAGE_KEYS.ORDERS, remainingOrders);
      if (ordersToDelete.length > 0) {
        await this.batchDeleteDocs('orders', ordersToDelete.map(o => o.id));
      }
    }

    // 2. Delete Purchases
    if (mods.purchases) {
      const allPurchases = this.getPurchases();
      const purchasesToDelete = allPurchases.filter(p => filterByDate(p.billDate));
      const remainingPurchases = allPurchases.filter(p => !filterByDate(p.billDate));
      deletedCounts.purchases = purchasesToDelete.length;
      this.set(STORAGE_KEYS.PURCHASES, remainingPurchases);

      const purIds = purchasesToDelete.map(p => p.id);
      if (purIds.length > 0) {
        await this.batchDeleteDocs('purchases', purIds);

        const allMovements = this.getStockMovements();
        const movToDelete = allMovements.filter(m => m.refType === 'PURCHASE' && purIds.includes(m.refId));
        const remainingMovements = allMovements.filter(m => !(m.refType === 'PURCHASE' && purIds.includes(m.refId)));
        this.set(STORAGE_KEYS.STOCK_MOVEMENTS, remainingMovements);
        if (movToDelete.length > 0) {
          await this.batchDeleteDocs('stock_movements', movToDelete.map(m => m.id));
        }
      }
    }

    // 3. Delete Sales
    if (mods.sales) {
      const allSales = this.getSales();
      const salesToDelete = allSales.filter(s => filterByDate(s.billDate));
      const remainingSales = allSales.filter(s => !filterByDate(s.billDate));
      deletedCounts.sales = salesToDelete.length;
      this.set(STORAGE_KEYS.SALES, remainingSales);

      const saleIds = salesToDelete.map(s => s.id);
      if (saleIds.length > 0) {
        await this.batchDeleteDocs('sales', saleIds);

        const allMovements = this.getStockMovements();
        const movToDelete = allMovements.filter(m => m.refType === 'SALE' && saleIds.includes(m.refId));
        const remainingMovements = allMovements.filter(m => !(m.refType === 'SALE' && saleIds.includes(m.refId)));
        this.set(STORAGE_KEYS.STOCK_MOVEMENTS, remainingMovements);
        if (movToDelete.length > 0) {
          await this.batchDeleteDocs('stock_movements', movToDelete.map(m => m.id));
        }

        const partyLogsToDelete = saleIds.map(id => `log-sale-${id}`);
        await this.batchDeleteDocs('party_logs', partyLogsToDelete);
        const remainingLogs = this.getPartyLogs().filter(l => !partyLogsToDelete.includes(l.id));
        this.set(STORAGE_KEYS.PARTY_LOGS, remainingLogs);
      }
    }

    // 4. Delete Self Use
    if (mods.selfUse) {
      const allSelfUses = this.getSelfUses();
      const selfUsesToDelete = allSelfUses.filter(su => filterByDate(su.billDate));
      const remainingSelfUses = allSelfUses.filter(su => !filterByDate(su.billDate));
      deletedCounts.selfUse = selfUsesToDelete.length;
      this.set(STORAGE_KEYS.SELF_USES, remainingSelfUses);

      const suIds = selfUsesToDelete.map(su => su.id);
      if (suIds.length > 0) {
        await this.batchDeleteDocs('self_uses', suIds);

        const allMovements = this.getStockMovements();
        const movToDelete = allMovements.filter(m => m.refType === 'SELF_USE' && suIds.includes(m.refId));
        const remainingMovements = allMovements.filter(m => !(m.refType === 'SELF_USE' && suIds.includes(m.refId)));
        this.set(STORAGE_KEYS.STOCK_MOVEMENTS, remainingMovements);
        if (movToDelete.length > 0) {
          await this.batchDeleteDocs('stock_movements', movToDelete.map(m => m.id));
        }
      }
    }

    // 5. Delete Adjustments
    if (mods.adjustments) {
      const allAdjustments = this.getStockAdjustments();
      const adjustmentsToDelete = allAdjustments.filter(a => filterByDate(a.date));
      const remainingAdjustments = allAdjustments.filter(a => !filterByDate(a.date));
      deletedCounts.adjustments = adjustmentsToDelete.length;
      this.set(STORAGE_KEYS.STOCK_ADJUSTMENTS, remainingAdjustments);

      const adjIds = adjustmentsToDelete.map(a => a.id);
      if (adjIds.length > 0) {
        await this.batchDeleteDocs('stock_adjustments', adjIds);

        const allMovements = this.getStockMovements();
        const movToDelete = allMovements.filter(m => m.refType === 'ADJUSTMENT' && adjIds.includes(m.refId));
        const remainingMovements = allMovements.filter(m => !(m.refType === 'ADJUSTMENT' && adjIds.includes(m.refId)));
        this.set(STORAGE_KEYS.STOCK_MOVEMENTS, remainingMovements);
        if (movToDelete.length > 0) {
          await this.batchDeleteDocs('stock_movements', movToDelete.map(m => m.id));
        }
      }
    }

    // 6. Delete Opening Stock (Wipes ALL OPENING movements & resets openingStock = 0 on all items)
    if (mods.openingStock) {
      const movements = this.getStockMovements();
      const nonOpening = movements.filter(m => m.type !== 'OPENING');
      const openingToDelete = movements.filter(m => m.type === 'OPENING');
      deletedCounts.openingStock = openingToDelete.length;
      this.set(STORAGE_KEYS.STOCK_MOVEMENTS, nonOpening);
      if (openingToDelete.length > 0) {
        await this.batchDeleteDocs('stock_movements', openingToDelete.map(m => m.id));
      }

      const items = this.getItems().map(it => ({ ...it, openingStock: 0 }));
      this.set(STORAGE_KEYS.ITEMS, items);
      if (items.length > 0) {
        await this.batchSetDocs('items', items);
      }
    }

    // 7. Delete Items (Only if explicitly checked)
    if (mods.items) {
      const items = this.getItems();
      deletedCounts.items = items.length;
      this.set(STORAGE_KEYS.ITEMS, []);
      this.set(STORAGE_KEYS.STOCK_MOVEMENTS, []);
      if (items.length > 0) {
        await this.batchDeleteDocs('items', items.map(i => i.id));
      }
      await this.batchDeleteDocs('stock_movements', this.getStockMovements().map(m => m.id));

      const allOrders = this.getOrders();
      if (allOrders.length > 0) {
        await this.batchDeleteDocs('orders', allOrders.map(o => o.id));
      }
      this.set(STORAGE_KEYS.ORDERS, []);
    }

    // 8. Delete Suppliers (Only if explicitly checked)
    if (mods.suppliers) {
      const suppliers = this.getSuppliers();
      deletedCounts.suppliers = suppliers.length;
      this.set(STORAGE_KEYS.SUPPLIERS, []);
      if (suppliers.length > 0) {
        await this.batchDeleteDocs('suppliers', suppliers.map(s => s.id));
      }
    }

    // 9. Delete Parties (Only if explicitly checked)
    if (mods.parties) {
      const parties = this.getParties();
      deletedCounts.parties = parties.length;
      this.set(STORAGE_KEYS.PARTIES, []);
      this.set(STORAGE_KEYS.PARTY_LOGS, []);
      if (parties.length > 0) {
        await this.batchDeleteDocs('parties', parties.map(p => p.id));
      }
      await this.batchDeleteDocs('party_logs', this.getPartyLogs().map(l => l.id));
    }

    this.notify();
    return deletedCounts;
  }
}

export interface DeleteFilterOptions {
  fromDate?: string;
  toDate?: string;
  isCustomDate?: boolean;
  isAllTime?: boolean;
  modules?: {
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
  deleteSales?: boolean;
  deletePurchases?: boolean;
  deleteOrders?: boolean;
  deleteSelfUse?: boolean;
  deleteStockAdjustments?: boolean;
  deleteOpeningStock?: boolean;
  deleteItems?: boolean;
  deleteSuppliers?: boolean;
  deleteParties?: boolean;
}

export const db = new DatabaseService();
