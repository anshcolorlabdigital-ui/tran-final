import { db } from './db';
import { ItemStockSummary, Item, OrderStatus } from '../types';

export class StockEngine {
  /**
   * Returns current physical on-hand stock for a specific item by aggregating the stock ledger
   */
  public static getItemCurrentStock(itemId: string): number {
    const movements = db.getStockMovements().filter(m => m.itemId === itemId);
    const total = movements.reduce((acc, m) => acc + (Number(m.qtyChange) || 0), 0);
    return Number(total.toFixed(2));
  }

  /**
   * Returns complete stock summary for all items
   */
  public static getAllItemsStockSummary(): ItemStockSummary[] {
    const items = db.getItems().filter(i => i.isActive !== false);
    const allMovements = db.getStockMovements();
    const allOrders = db.getOrders().filter(o => o.status === 'ORDERED' || o.status === 'PARTIALLY_RECEIVED');

    return items.map(item => {
      const movements = allMovements.filter(m => m.itemId === item.id);

      let openingStock = 0;
      let purchaseQty = 0;
      let saleQty = 0;
      let selfUseQty = 0;
      let adjustmentQty = 0;

      movements.forEach(m => {
        const qty = Number(m.qtyChange) || 0;
        if (m.type === 'OPENING') {
          openingStock += qty;
        } else if (m.type === 'PURCHASE_IN') {
          purchaseQty += qty;
        } else if (m.type === 'SALE_OUT') {
          saleQty += Math.abs(qty);
        } else if (m.type === 'SELF_USE_OUT') {
          selfUseQty += Math.abs(qty);
        } else if (m.type === 'ADJUSTMENT_IN') {
          adjustmentQty += qty;
        } else if (m.type === 'ADJUSTMENT_OUT') {
          adjustmentQty += qty; // qty is negative
        }
      });

      const closingStock = Number(
        (openingStock + purchaseQty - saleQty - selfUseQty + adjustmentQty).toFixed(2)
      );

      const isLowStock = closingStock <= Number(item.minStock || 0);

      // Find if there is an active order placed for this item
      let activeOrder: ItemStockSummary['activeOrder'] = undefined;
      for (const order of allOrders) {
        const foundItem = order.items.find(
          oi => oi.itemId === item.id && (oi.status === 'ORDERED' || oi.status === 'PARTIALLY_RECEIVED')
        );
        if (foundItem) {
          activeOrder = {
            orderNumber: order.orderNumber,
            supplierName: order.supplierName,
            orderDate: order.orderDate,
            status: order.status as OrderStatus,
            orderedQty: foundItem.orderedQty
          };
          break;
        }
      }

      return {
        item,
        openingStock,
        purchaseQty,
        saleQty,
        selfUseQty,
        adjustmentQty,
        closingStock,
        isLowStock,
        activeOrder
      };
    });
  }

  /**
   * Returns list of low-stock items with active order details
   */
  public static getLowStockItems(): ItemStockSummary[] {
    const allSummaries = this.getAllItemsStockSummary();
    return allSummaries.filter(s => s.isLowStock);
  }

  /**
   * Calculates dashboard sales metrics for a specified date
   */
  public static getDashboardSalesMetrics(dateString: string) {
    const sales = db.getSales().filter(s => s.billDate === dateString);
    let cash = 0;
    let online = 0;
    let total = 0;

    sales.forEach(s => {
      cash += Number(s.recdCash) || 0;
      online += Number(s.recdUpi) || 0;
      total += Number(s.billTotal) || 0;
    });

    return {
      cash: Number(cash.toFixed(2)),
      online: Number(online.toFixed(2)),
      total: Number(total.toFixed(2)),
      salesCount: sales.length
    };
  }

  /**
   * Generates next serial / bill number
   */
  public static getNextBillNumber(type: 'SALE' | 'PURCHASE' | 'SELF_USE' | 'ORDER'): string {
    const settings = db.getSettings();
    if (type === 'SALE') {
      const sales = db.getSales();
      const count = sales.length + 1001;
      return `${settings.invoicePrefix || 'INV-'}${count}`;
    }
    if (type === 'PURCHASE') {
      const purchases = db.getPurchases();
      const count = purchases.length + 101;
      return `${settings.purchasePrefix || 'PUR-'}${count}`;
    }
    if (type === 'SELF_USE') {
      const selfUses = db.getSelfUses();
      const count = selfUses.length + 101;
      return `${settings.selfUsePrefix || 'SU-'}${count}`;
    }
    if (type === 'ORDER') {
      const orders = db.getOrders();
      const count = orders.length + 101;
      return `${settings.orderPrefix || 'ORD-'}${count}`;
    }
    return '1001';
  }

  /**
   * Generates next S.No. for items
   */
  public static getNextItemSno(): string {
    const items = db.getItems();
    let maxSno = 1455;
    items.forEach(i => {
      const num = parseInt(i.sno, 10);
      if (!isNaN(num) && num > maxSno) {
        maxSno = num;
      }
    });
    return String(maxSno + 1);
  }
}
