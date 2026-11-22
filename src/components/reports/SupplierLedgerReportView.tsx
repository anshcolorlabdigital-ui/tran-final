import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { Supplier, SupplierLog, Purchase } from '../../types';
import { formatDateToDisplay, getTodayDateString } from '../../utils/dateUtils';
import { round2, formatCurrency } from '../../utils/calculations';
import {
  FileText,
  Printer,
  Download,
  PlusCircle,
  X,
  ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SupplierPaymentModal } from '../common/SupplierPaymentModal';

export const SupplierLedgerReportView: React.FC = () => {
  const {
    refreshKey,
    selectedLedgerSupplierId,
    setSelectedLedgerSupplierId,
    showToast,
    showAlert
  } = useApp();

  const suppliers = useMemo(() => db.getSuppliers(), [refreshKey]);
  const purchases = useMemo(() => db.getPurchases(), [refreshKey]);

  // Selected supplier state
  const [currentSupplierId, setCurrentSupplierId] = useState<string>(() => {
    if (selectedLedgerSupplierId && suppliers.some(s => s.id === selectedLedgerSupplierId)) {
      return selectedLedgerSupplierId;
    }
    return suppliers.length > 0 ? suppliers[0].id : '';
  });

  // Sync when selectedLedgerSupplierId changes from context
  useEffect(() => {
    if (selectedLedgerSupplierId && suppliers.some(s => s.id === selectedLedgerSupplierId)) {
      setCurrentSupplierId(selectedLedgerSupplierId);
    }
  }, [selectedLedgerSupplierId, suppliers]);

  // Date filters
  const [fromDate, setFromDate] = useState<string>('2026-04-01');
  const [toDate, setToDate] = useState<string>(getTodayDateString());
  const [isAllTime, setIsAllTime] = useState<boolean>(true);

  // Supplier Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);

  // Detailed Purchase Bill Modal State
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = useState<Purchase | null>(null);

  // Active supplier entity
  const activeSupplier = useMemo<Supplier | undefined>(() => {
    return suppliers.find(s => s.id === currentSupplierId);
  }, [suppliers, currentSupplierId]);

  // Ledger logs for the active supplier
  const rawLogs = useMemo<SupplierLog[]>(() => {
    if (!currentSupplierId) return [];
    return db.getSupplierLogsBySupplierId(currentSupplierId);
  }, [currentSupplierId, refreshKey]);

  // Financial summary
  const summary = useMemo(() => {
    if (!activeSupplier) {
      return {
        totalPurchased: 0,
        totalPaid: 0,
        openingBalance: 0,
        payableBalance: 0,
        logsCount: 0
      };
    }
    const balanceSummary = db.getSupplierBalanceSummary(activeSupplier.id);
    return {
      ...balanceSummary,
      openingBalance: Number(activeSupplier.openingBalance) || 0,
      logsCount: rawLogs.length
    };
  }, [activeSupplier, rawLogs, refreshKey]);

  // Filtered transactions (excluding synthetic opening balance so it displays in Row 1)
  const transactionLogs = useMemo<SupplierLog[]>(() => {
    if (!currentSupplierId || !activeSupplier) return [];

    const nonOpeningLogs = rawLogs.filter(l => l.type !== 'OPENING_BALANCE');

    if (isAllTime) {
      return nonOpeningLogs;
    }

    return nonOpeningLogs.filter(l => {
      return l.date >= fromDate && l.date <= toDate;
    });
  }, [rawLogs, isAllTime, fromDate, toDate, currentSupplierId, activeSupplier]);

  // Handle supplier change from dropdown
  const handleSelectSupplier = (supplierId: string) => {
    setCurrentSupplierId(supplierId);
    setSelectedLedgerSupplierId(supplierId);
  };

  // Quick preset filters
  const setQuickFilter = (type: 'ALL' | 'TODAY' | 'MONTH') => {
    const today = getTodayDateString();
    if (type === 'ALL') {
      setIsAllTime(true);
    } else if (type === 'TODAY') {
      setIsAllTime(false);
      setFromDate(today);
      setToDate(today);
    } else if (type === 'MONTH') {
      setIsAllTime(false);
      const parts = today.split('-');
      setFromDate(`${parts[0]}-${parts[1]}-01`);
      setToDate(today);
    }
  };

  // Open full detail log when clicking any purchase bill
  const handleOpenPurchaseDetail = (refNo?: string) => {
    if (!refNo) return;
    const purchase = purchases.find(
      p => p.billNo === refNo || p.id === refNo || (p.billNo && p.billNo.toLowerCase() === refNo.toLowerCase())
    );
    if (purchase) {
      setSelectedPurchaseDetail(purchase);
    } else {
      showAlert(`Purchase invoice detail for "${refNo}" not found.`, 'Purchase Bill Not Found', 'info');
    }
  };

  // Export ledger to Excel
  const handleExportExcel = () => {
    if (!activeSupplier) return;
    const exportRows: Record<string, any>[] = [
      {
        'Date': '',
        'Bill No.': 'OPP. BALANCE',
        'Debit (Billed ₹)': '',
        'Credit (Paid ₹)': '',
        'Balance (₹)': summary.openingBalance,
        'Mode': '',
        'Remarks': 'Opening Balance'
      }
    ];

    transactionLogs.forEach(log => {
      exportRows.push({
        'Date': formatDateToDisplay(log.date),
        'Bill No.': log.refNo || '-',
        'Debit (Billed ₹)': log.totalAmount || '',
        'Credit (Paid ₹)': log.paidAmount || '',
        'Balance (₹)': log.runningBalance !== undefined ? log.runningBalance : log.balanceChange,
        'Mode': log.paymentMode || '',
        'Remarks': log.notes || ''
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Supplier Ledger');
    XLSX.writeFile(wb, `Supplier_Ledger_${activeSupplier.name.replace(/\s+/g, '_')}_${getTodayDateString()}.xlsx`);
    showToast('Supplier statement ledger exported to Excel!', 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="supplier-ledger-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* TOP HEADER & ACTION BAR matching mockup */}
      <div
        style={{
          background: '#FFFFFF',
          border: '2px solid #000000',
          borderRadius: '10px',
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                background: '#002B99',
                color: '#FFFFFF',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.25rem', color: '#002B99', letterSpacing: '-0.3px' }}>
                SUPPLIER LEDGER
              </h2>
              <div style={{ fontSize: '0.78rem', color: '#6B7280', fontWeight: 600 }}>
                Comprehensive purchase logs, vendor payments outgoing, and running balance ledger
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowPaymentModal(true)}
              style={{
                background: '#DC2626',
                color: '#FFFFFF',
                border: '1.5px solid #000000',
                fontWeight: 900,
                fontSize: '0.85rem',
                padding: '7px 14px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <PlusCircle size={16} />
              <span>Pay Supplier</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              style={{
                background: '#FFFFFF',
                color: '#000000',
                border: '1.5px solid #000000',
                fontWeight: 800,
                fontSize: '0.85rem',
                padding: '7px 12px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Download size={15} />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              style={{
                background: '#FFFFFF',
                color: '#000000',
                border: '1.5px solid #000000',
                fontWeight: 800,
                fontSize: '0.85rem',
                padding: '7px 12px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Printer size={15} />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Filter controls row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            alignItems: 'flex-end',
            paddingTop: '8px',
            borderTop: '1px solid #E5E7EB'
          }}
        >
          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.75rem', color: '#4B5563', marginBottom: '3px' }}>
              Select Vendor / Supplier
            </label>
            <select
              className="input-text-clean"
              value={currentSupplierId}
              onChange={e => handleSelectSupplier(e.target.value)}
              style={{ width: '100%', fontWeight: 800, fontSize: '0.9rem' }}
            >
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.75rem', color: '#4B5563', marginBottom: '3px' }}>
              From Date
            </label>
            <input
              type="date"
              className="input-text-clean"
              disabled={isAllTime}
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setIsAllTime(false); }}
              style={{ width: '100%', opacity: isAllTime ? 0.5 : 1 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 800, fontSize: '0.75rem', color: '#4B5563', marginBottom: '3px' }}>
              To Date
            </label>
            <input
              type="date"
              className="input-text-clean"
              disabled={isAllTime}
              value={toDate}
              onChange={e => { setToDate(e.target.value); setIsAllTime(false); }}
              style={{ width: '100%', opacity: isAllTime ? 0.5 : 1 }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setQuickFilter('ALL')}
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: 900,
                borderRadius: '4px',
                border: '1.5px solid #000000',
                background: isAllTime ? '#002B99' : '#FFFFFF',
                color: isAllTime ? '#FFFFFF' : '#000000',
                cursor: 'pointer'
              }}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('MONTH')}
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: 900,
                borderRadius: '4px',
                border: '1.5px solid #000000',
                background: !isAllTime ? '#002B99' : '#FFFFFF',
                color: !isAllTime ? '#FFFFFF' : '#000000',
                cursor: 'pointer'
              }}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setQuickFilter('TODAY')}
              style={{
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: 900,
                borderRadius: '4px',
                border: '1.5px solid #000000',
                background: '#FFFFFF',
                color: '#000000',
                cursor: 'pointer'
              }}
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {/* FULL-WIDTH MAGENTA SUPPLIER BANNER matching mockup */}
      <div
        style={{
          background: '#F5A3E0',
          border: '2px solid #000000',
          borderRadius: '8px',
          padding: '8px 16px',
          textAlign: 'left'
        }}
      >
        <span
          style={{
            fontWeight: 900,
            fontSize: '1.25rem',
            color: '#000000',
            letterSpacing: '0.02em',
            textTransform: 'uppercase'
          }}
        >
          {activeSupplier?.name || 'SELECT SUPPLIER'}
        </span>
      </div>

      {/* 4 KPI SUMMARY CARDS matching mockup */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px'
        }}
      >
        {/* Card 1: SUPPLIER OPP. BALANCE */}
        <div
          style={{
            background: '#FFFFFF',
            border: '2px solid #000000',
            borderRadius: '8px',
            padding: '10px 14px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              display: 'inline-block',
              background: '#DC2626',
              color: '#FFFFFF',
              fontSize: '0.72rem',
              fontWeight: 900,
              padding: '2px 8px',
              borderRadius: '2px',
              textTransform: 'uppercase',
              marginBottom: '6px'
            }}
          >
            SUPPLIER OPP. BALANCE
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#000000' }}>
            {summary.openingBalance}
          </div>
        </div>

        {/* Card 2: TOTAL PURCHASES */}
        <div
          style={{
            background: '#FFFFFF',
            border: '2px solid #000000',
            borderRadius: '8px',
            padding: '10px 14px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              display: 'inline-block',
              background: '#DC2626',
              color: '#FFFFFF',
              fontSize: '0.72rem',
              fontWeight: 900,
              padding: '2px 8px',
              borderRadius: '2px',
              textTransform: 'uppercase',
              marginBottom: '6px'
            }}
          >
            TOTAL PURCHASES
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#000000' }}>
            {summary.totalPurchased}
          </div>
        </div>

        {/* Card 3: TOTAL PAID TO SUPPLIER */}
        <div
          style={{
            background: '#FFFFFF',
            border: '2px solid #000000',
            borderRadius: '8px',
            padding: '10px 14px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              display: 'inline-block',
              background: '#DC2626',
              color: '#FFFFFF',
              fontSize: '0.72rem',
              fontWeight: 900,
              padding: '2px 8px',
              borderRadius: '2px',
              textTransform: 'uppercase',
              marginBottom: '6px'
            }}
          >
            TOTAL PAID TO SUPPLIER
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#000000' }}>
            {summary.totalPaid}
          </div>
        </div>

        {/* Card 4: NET PAYBLE BALANCE */}
        <div
          style={{
            background: '#FFFFFF',
            border: '2px solid #000000',
            borderRadius: '8px',
            padding: '10px 14px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              display: 'inline-block',
              background: '#DC2626',
              color: '#FFFFFF',
              fontSize: '0.72rem',
              fontWeight: 900,
              padding: '2px 8px',
              borderRadius: '2px',
              textTransform: 'uppercase',
              marginBottom: '6px'
            }}
          >
            NET PAYBLE BALANCE
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#000000' }}>
            {summary.payableBalance}
          </div>
        </div>
      </div>

      {/* DETAILED TRANSACTION LEDGER TABLE matching mockup */}
      <div
        style={{
          background: '#FFFFFF',
          border: '2px solid #000000',
          borderRadius: '10px',
          overflow: 'hidden'
        }}
      >
        <div className="table-responsive-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
            <thead>
              <tr style={{ background: '#D4C4FB', borderBottom: '2px solid #000000' }}>
                <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', width: '130px', fontWeight: 900, fontSize: '0.95rem' }}>
                  Date
                </th>
                <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', width: '150px', fontWeight: 900, fontSize: '0.95rem' }}>
                  Bill No.
                </th>
                <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', width: '140px', fontWeight: 900, fontSize: '0.95rem', color: '#002B99' }}>
                  Debit (Billed ₹)
                </th>
                <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', width: '140px', fontWeight: 900, fontSize: '0.95rem', color: '#16A34A' }}>
                  Credit (Paid ₹)
                </th>
                <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', width: '150px', fontWeight: 900, fontSize: '0.95rem', color: '#DC2626' }}>
                  Balance (₹)
                </th>
                <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', width: '100px', fontWeight: 900, fontSize: '0.95rem' }}>
                  Mode
                </th>
                <th style={{ padding: '10px 12px', fontWeight: 900, fontSize: '0.95rem', textAlign: 'left' }}>
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Row 1: Light cyan OPP. BALANCE ROW matching mockup */}
              <tr style={{ background: '#CFF4FC', borderBottom: '1px solid #000000', height: '48px' }}>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td style={{ borderRight: '1px solid #000000', padding: '6px 10px', lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 900, fontSize: '0.85rem', color: '#000000' }}>OPP. BALACE</div>
                  <div style={{ fontWeight: 900, fontSize: '1rem', color: '#000000' }}>{summary.openingBalance}</div>
                </td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td></td>
              </tr>

              {/* Transactions */}
              {transactionLogs.map(log => {
                const isPurchase = log.type === 'PURCHASE';
                const displayBalance = log.runningBalance !== undefined ? log.runningBalance : log.balanceChange;
                return (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: '1px solid #000000',
                      background: '#FFFFFF',
                      height: '38px'
                    }}
                  >
                    <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 800 }}>
                      {formatDateToDisplay(log.date)}
                    </td>
                    <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 800 }}>
                      {isPurchase ? (
                        <button
                          type="button"
                          onClick={() => handleOpenPurchaseDetail(log.refNo)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#000000',
                            fontWeight: 800,
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                        >
                          {log.refNo}
                        </button>
                      ) : (
                        <span>{log.refNo || '-'}</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 800 }}>
                      {log.totalAmount ? round2(log.totalAmount) : ''}
                    </td>
                    <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 800 }}>
                      {log.paidAmount ? round2(log.paidAmount) : ''}
                    </td>
                    <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 800 }}>
                      {round2(displayBalance)}
                    </td>
                    <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', fontWeight: 800 }}>
                      {log.paymentMode || ''}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700 }}>
                      {log.notes || ''}
                    </td>
                  </tr>
                );
              })}

              {/* Pad with empty rows if fewer than 5 transactions to give clean table look */}
              {Array.from({ length: Math.max(0, 5 - transactionLogs.length) }).map((_, i) => (
                <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #000000', height: '34px' }}>
                  <td style={{ borderRight: '1px solid #000000' }}></td>
                  <td style={{ borderRight: '1px solid #000000' }}></td>
                  <td style={{ borderRight: '1px solid #000000' }}></td>
                  <td style={{ borderRight: '1px solid #000000' }}></td>
                  <td style={{ borderRight: '1px solid #000000' }}></td>
                  <td style={{ borderRight: '1px solid #000000' }}></td>
                  <td></td>
                </tr>
              ))}
            </tbody>

            {/* Bottom Total Row matching mockup */}
            <tfoot>
              <tr style={{ background: '#FFFFFF', borderTop: '2px solid #000000', height: '42px' }}>
                <td
                  colSpan={2}
                  style={{
                    padding: '8px 12px',
                    fontWeight: 900,
                    fontSize: '1.1rem',
                    textAlign: 'center',
                    borderRight: '1px solid #000000'
                  }}
                >
                  Total
                </td>
                <td style={{ padding: '8px 10px', fontWeight: 900, fontSize: '1rem', borderRight: '1px solid #000000' }}>
                  {summary.totalPurchased}
                </td>
                <td style={{ padding: '8px 10px', fontWeight: 900, fontSize: '1rem', borderRight: '1px solid #000000' }}>
                  {summary.totalPaid}
                </td>
                <td style={{ padding: '8px 10px', fontWeight: 900, fontSize: '1rem', borderRight: '1px solid #000000' }}>
                  {summary.payableBalance}
                </td>
                <td style={{ borderRight: '1px solid #000000' }}></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      <SupplierPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        initialSupplierId={activeSupplier?.id}
      />

      {/* Detailed Purchase Bill Modal */}
      {selectedPurchaseDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '2px solid #000000',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                background: '#D4C4FB',
                padding: '12px 18px',
                borderBottom: '2px solid #000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>
                Purchase Invoice: {selectedPurchaseDetail.billNo} ({formatDateToDisplay(selectedPurchaseDetail.billDate)})
              </div>
              <button
                onClick={() => setSelectedPurchaseDetail(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '16px', overflowY: 'auto' }}>
              <div style={{ marginBottom: '12px', fontWeight: 800 }}>
                Supplier: {selectedPurchaseDetail.supplierName}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#ECECEC', borderBottom: '1px solid #000000' }}>
                    <th style={{ padding: '8px' }}>Item</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Basic Rate</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurchaseDetail.items.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '8px', fontWeight: 700 }}>{it.itemName}</td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 800 }}>{it.qty}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>₹{it.purchaseRate}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800 }}>₹{it.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ textAlign: 'right', marginTop: '16px', fontWeight: 900, fontSize: '1.1rem' }}>
                Total Bill Amount: ₹{selectedPurchaseDetail.billTotal}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
