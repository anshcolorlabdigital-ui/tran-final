import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../db/db';
import { useApp } from '../../context/AppContext';
import { Party, PartyLog, Sale } from '../../types';
import { formatDateToDisplay, getTodayDateString } from '../../utils/dateUtils';
import { round2, formatCurrency } from '../../utils/calculations';
import {
  FileText,
  Printer,
  Download,
  PlusCircle,
  X,
  ArrowLeft,
  Trash2,
  Search
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PaymentCollectModal } from '../common/PaymentCollectModal';
import { SearchableSelect, SearchableSelectOption } from '../common/SearchableSelect';

export const PartyLedgerReportView: React.FC = () => {
  const {
    refreshKey,
    selectedLedgerPartyId,
    setSelectedLedgerPartyId,
    showToast,
    showAlert
  } = useApp();

  const parties = useMemo(() => db.getParties(), [refreshKey]);
  const sales = useMemo(() => db.getSales(), [refreshKey]);

  // Mode: 'OUTSTANDING_LIST' (all parties table) or 'INDIVIDUAL_LEDGER' (single party details)
  const [viewMode, setViewMode] = useState<'OUTSTANDING_LIST' | 'INDIVIDUAL_LEDGER'>(() => {
    return selectedLedgerPartyId ? 'INDIVIDUAL_LEDGER' : 'OUTSTANDING_LIST';
  });

  // Selected party state
  const [currentPartyId, setCurrentPartyId] = useState<string>(() => {
    if (selectedLedgerPartyId && parties.some(p => p.id === selectedLedgerPartyId)) {
      return selectedLedgerPartyId;
    }
    return parties.length > 0 ? parties[0].id : '';
  });

  // Sync when selectedLedgerPartyId changes from context
  useEffect(() => {
    if (selectedLedgerPartyId && parties.some(p => p.id === selectedLedgerPartyId)) {
      setCurrentPartyId(selectedLedgerPartyId);
      setViewMode('INDIVIDUAL_LEDGER');
    } else if (selectedLedgerPartyId === null) {
      setViewMode('OUTSTANDING_LIST');
    }
  }, [selectedLedgerPartyId, parties]);

  // Date filters
  const [fromDate, setFromDate] = useState<string>('2026-11-01');
  const [toDate, setToDate] = useState<string>(getTodayDateString());
  const [isAllTime, setIsAllTime] = useState<boolean>(true);

  // Party Search Query
  const [partySearchQuery, setPartySearchQuery] = useState<string>('');

  // Payment Receipt Modal State
  const [showPaymentForm, setShowPaymentForm] = useState<boolean>(false);

  // Detailed Bill Log Modal State
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<Sale | null>(null);

  // Active party entity
  const activeParty = useMemo<Party | undefined>(() => {
    return parties.find(p => p.id === currentPartyId);
  }, [parties, currentPartyId]);

  // Ledger logs for the active party
  const rawLogs = useMemo<PartyLog[]>(() => {
    if (!currentPartyId) return [];
    return db.getPartyLogsByPartyId(currentPartyId);
  }, [currentPartyId, refreshKey]);

  // Financial summary for active party
  const summary = useMemo(() => {
    if (!activeParty) {
      return {
        totalBilled: 0,
        totalPaid: 0,
        openingBalance: 0,
        outstandingBalance: 0,
        logsCount: 0
      };
    }
    const balanceSummary = db.getPartyBalanceSummary(activeParty.id);
    return {
      ...balanceSummary,
      openingBalance: Number(activeParty.openingBalance) || 0,
      logsCount: rawLogs.length
    };
  }, [activeParty, rawLogs, refreshKey]);

  // Filtered transactions (excluding synthetic opening balance so it displays in Row 1)
  const transactionLogs = useMemo<PartyLog[]>(() => {
    if (!currentPartyId || !activeParty) return [];

    const nonOpeningLogs = rawLogs.filter(l => l.type !== 'OPENING_BALANCE');

    if (isAllTime) {
      return nonOpeningLogs;
    }

    return nonOpeningLogs.filter(l => {
      return l.date >= fromDate && l.date <= toDate;
    });
  }, [rawLogs, isAllTime, fromDate, toDate, currentPartyId, activeParty]);

  // All parties calculated data for the PARTY OUTSTANDING list view matching mockup
  const partyOutstandingRows = useMemo(() => {
    let rows = parties.map(p => {
      const balSummary = db.getPartyBalanceSummary(p.id);
      const pLogs = db.getPartyLogs().filter(l => l.partyId === p.id && l.type !== 'OPENING_BALANCE');

      let periodDebit = 0;
      let periodCredit = 0;

      pLogs.forEach(l => {
        if (isAllTime || (l.date >= fromDate && l.date <= toDate)) {
          if (l.type === 'SALE') {
            periodDebit += Number(l.totalAmount) || 0;
            periodCredit += Number(l.paidAmount) || 0;
          } else if (l.type === 'PAYMENT') {
            periodCredit += Number(l.paidAmount) || 0;
          }
        }
      });

      const oppBal = Number(p.openingBalance) || 0;
      const netBalance = isAllTime ? (balSummary.outstandingBalance ?? 0) : round2(oppBal + periodDebit - periodCredit);

      return {
        party: p,
        city: p.city || '-',
        oppBalance: oppBal,
        debit: round2(periodDebit),
        credit: round2(periodCredit),
        balance: round2(netBalance)
      };
    });

    if (partySearchQuery.trim()) {
      const q = partySearchQuery.trim().toLowerCase();
      rows = rows.filter(r =>
        r.party.name.toLowerCase().includes(q) ||
        (r.party.phone && r.party.phone.toLowerCase().includes(q)) ||
        (r.city && r.city.toLowerCase().includes(q))
      );
    }

    return rows;
  }, [parties, isAllTime, fromDate, toDate, refreshKey, partySearchQuery]);

  // Totals for PARTY OUTSTANDING list view
  const outstandingTotals = useMemo(() => {
    let totalOpp = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let totalBal = 0;

    partyOutstandingRows.forEach(r => {
      totalOpp += r.oppBalance;
      totalDebit += r.debit;
      totalCredit += r.credit;
      totalBal += r.balance;
    });

    return {
      oppBalance: round2(totalOpp),
      debit: round2(totalDebit),
      credit: round2(totalCredit),
      balance: round2(totalBal)
    };
  }, [partyOutstandingRows]);

  // Party options for SearchableSelect
  const partyOptions = useMemo<SearchableSelectOption[]>(() => {
    return parties.map(p => {
      const bal = db.getPartyBalanceSummary(p.id).outstandingBalance;
      return {
        id: p.id,
        label: p.name,
        subLabel: `${p.city || ''} ${p.phone || ''}`.trim(),
        badge: bal > 0 ? `₹${bal}` : 'Settled',
        badgeBg: bal > 0 ? '#FEE2E2' : '#DCFCE7',
        badgeColor: bal > 0 ? '#991B1B' : '#166534'
      };
    });
  }, [parties, refreshKey]);

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

  // Open individual ledger for a party
  const handleOpenLedger = (partyId: string) => {
    setCurrentPartyId(partyId);
    setSelectedLedgerPartyId(partyId);
    setViewMode('INDIVIDUAL_LEDGER');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open full detail log when clicking any bill
  const handleOpenBillDetail = (refNo?: string) => {
    if (!refNo) return;
    const sale = sales.find(s => s.billNo === refNo || s.id === refNo || (s.billNo && s.billNo.toLowerCase() === refNo.toLowerCase()));
    if (sale) {
      setSelectedSaleDetail(sale);
    } else {
      const orphanLog = transactionLogs.find(l => l.refNo === refNo);
      if (orphanLog && window.confirm(`Invoice for "${refNo}" was not found in sales.\n\nWould you like to remove this orphan entry from the ledger statement?`)) {
        db.deletePartyLog(orphanLog.id);
        showToast(`Orphan entry "${refNo}" deleted from ledger.`, 'success');
      } else {
        showAlert(`Invoice detail log for "${refNo}" not found.`, 'Invoice Not Found', 'info');
      }
    }
  };

  const handleDeleteLog = (log: PartyLog) => {
    const isSale = log.type === 'SALE';
    const msg = isSale
      ? `Are you sure you want to delete invoice entry "${log.refNo || 'entry'}"? This will remove it from the statement.`
      : `Are you sure you want to delete receipt entry "${log.refNo || 'entry'}" of ₹${log.paidAmount || 0}?`;
    if (window.confirm(msg)) {
      db.deletePartyLog(log.id);
      showToast(`Ledger entry ${log.refNo || ''} deleted successfully.`, 'success');
    }
  };

  // Export ledger to Excel
  const handleExportExcel = () => {
    if (viewMode === 'OUTSTANDING_LIST') {
      const rows = partyOutstandingRows.map((r, idx) => ({
        '#': idx + 1,
        'PARTY': r.party.name,
        'CITY': r.city,
        'Opp. Balance': r.oppBalance,
        'Debit (Sales)': r.debit,
        'Credit (Received)': r.credit,
        'Balance (Receivable)': r.balance
      }));
      rows.push({
        '#': 'Total' as any,
        'PARTY': '',
        'CITY': '',
        'Opp. Balance': outstandingTotals.oppBalance,
        'Debit (Sales)': outstandingTotals.debit,
        'Credit (Received)': outstandingTotals.credit,
        'Balance (Receivable)': outstandingTotals.balance
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Party Outstanding');
      XLSX.writeFile(wb, `Party_Outstanding_${getTodayDateString()}.xlsx`);
      showToast('Party outstanding list exported to Excel!', 'success');
    } else {
      if (!activeParty) return;
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
        const isInv = log.type === 'SALE';
        exportRows.push({
          'Date': formatDateToDisplay(log.date),
          'Bill No.': log.refNo || '-',
          'Debit (Billed ₹)': isInv && log.totalAmount ? round2(log.totalAmount) : '',
          'Credit (Paid ₹)': log.paidAmount ? round2(log.paidAmount) : '',
          'Balance (₹)': log.runningBalance !== undefined ? log.runningBalance : log.balanceChange,
          'Mode': log.paymentMode || '',
          'Remarks': log.notes || ''
        });
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Party Ledger');
      XLSX.writeFile(wb, `Party_Ledger_${activeParty.name.replace(/\s+/g, '_')}_${getTodayDateString()}.xlsx`);
      showToast('Party statement ledger exported to Excel!', 'success');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="party-ledger-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
            {viewMode === 'INDIVIDUAL_LEDGER' && (
              <button
                type="button"
                onClick={() => setViewMode('OUTSTANDING_LIST')}
                style={{
                  background: '#F1F5F9',
                  border: '1.5px solid #000000',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 800,
                  fontSize: '0.82rem'
                }}
                title="Back to Outstanding List"
              >
                <ArrowLeft size={16} />
                <span>All Outstanding</span>
              </button>
            )}
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
              <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.35rem', color: '#002B99', letterSpacing: '-0.3px' }}>
                {viewMode === 'OUTSTANDING_LIST' ? 'PARTY OUTSTANDING' : 'PARTY LEDGER'}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowPaymentForm(true)}
              style={{
                background: '#16A34A',
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
              <span>Money Receive</span>
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

        {/* Date Filter Bar matching mockup */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            paddingTop: '6px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontWeight: 800, fontSize: '0.78rem', color: '#4B5563' }}>From Date</label>
            <input
              type="date"
              className="input-text-clean"
              disabled={isAllTime}
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setIsAllTime(false); }}
              style={{ opacity: isAllTime ? 0.5 : 1, width: '140px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontWeight: 800, fontSize: '0.78rem', color: '#4B5563' }}>To Date</label>
            <input
              type="date"
              className="input-text-clean"
              disabled={isAllTime}
              value={toDate}
              onChange={e => { setToDate(e.target.value); setIsAllTime(false); }}
              style={{ opacity: isAllTime ? 0.5 : 1, width: '140px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setQuickFilter('ALL')}
              style={{
                padding: '5px 12px',
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
                padding: '5px 12px',
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
                padding: '5px 12px',
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

          {viewMode === 'INDIVIDUAL_LEDGER' && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', minWidth: '300px' }}>
              <label style={{ fontWeight: 800, fontSize: '0.78rem', color: '#4B5563', whiteSpace: 'nowrap' }}>Switch Party:</label>
              <div style={{ flex: 1 }}>
                <SearchableSelect
                  options={partyOptions}
                  value={currentPartyId}
                  onChange={val => {
                    if (val) {
                      setCurrentPartyId(val);
                      setSelectedLedgerPartyId(val);
                    }
                  }}
                  placeholder="Search customer / party..."
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: PARTY OUTSTANDING (Main view matching Image 3 mockup)             */}
      {/* ========================================================================= */}
      {viewMode === 'OUTSTANDING_LIST' && (
        <>
          {/* TOTAL OUTSTANDING PINK BANNER matching mockup */}
          <div
            style={{
              background: '#F5A3E0',
              border: '2px solid #000000',
              borderRadius: '6px',
              padding: '6px',
              textAlign: 'center'
            }}
          >
            <span
              style={{
                background: '#DC2626',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '1.1rem',
                padding: '4px 18px',
                borderRadius: '2px',
                letterSpacing: '0.04em'
              }}
            >
              TOTAL OUTSTANDING
            </span>
          </div>

          {/* Centered Total Box matching mockup */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
            <div
              style={{
                background: '#FFFFFF',
                border: '2px solid #000000',
                borderRadius: '8px',
                padding: '8px 36px',
                minWidth: '220px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#000000', fontFamily: 'monospace' }}>
                {outstandingTotals.balance}
              </div>
            </div>
          </div>

          {/* Party Search Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1', maxWidth: '420px' }}>
              <Search size={16} color="#6B7280" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                type="text"
                placeholder="Search party by name, phone or city..."
                className="input-text-clean"
                value={partySearchQuery}
                onChange={e => setPartySearchQuery(e.target.value)}
                style={{ paddingLeft: '34px', width: '100%', fontSize: '0.88rem', fontWeight: 700 }}
              />
              {partySearchQuery && (
                <button
                  type="button"
                  onClick={() => setPartySearchQuery('')}
                  style={{ position: 'absolute', right: '10px', top: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
                  title="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4B5563' }}>
              Showing {partyOutstandingRows.length} of {parties.length} Parties
            </div>
          </div>

          {/* Outstanding Table with Lavender Header #D4C4FB matching mockup */}
          <div style={{ background: '#FFFFFF', border: '2px solid #000000', borderRadius: '4px', overflow: 'hidden' }}>
            <div className="table-responsive-wrapper">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                <thead>
                  <tr style={{ background: '#D4C4FB', borderBottom: '2px solid #000000' }}>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900, fontSize: '1rem', color: '#002B99', width: '280px' }}>
                      PARTY
                    </th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900, fontSize: '0.92rem', width: '160px' }}>
                      CITY
                    </th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900, fontSize: '0.92rem', width: '130px' }}>
                      Opp. Balance
                    </th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900, fontSize: '0.92rem', width: '120px' }}>
                      Debit
                    </th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900, fontSize: '0.92rem', width: '120px' }}>
                      Crebit
                    </th>
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900, fontSize: '0.95rem', width: '130px' }}>
                      Balance
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 900, fontSize: '0.92rem', width: '110px' }}>
                      ACTION
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {partyOutstandingRows.map((r) => (
                    <tr
                      key={r.party.id}
                      style={{
                        borderBottom: '1px solid #000000',
                        background: '#FFFFFF',
                        height: '38px'
                      }}
                    >
                      <td style={{ padding: '8px 12px', borderRight: '1px solid #000000', textAlign: 'left', fontWeight: 900, color: '#002B99' }}>
                        {r.party.name}
                      </td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 800 }}>
                        {r.city}
                      </td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 800 }}>
                        {r.oppBalance || ''}
                      </td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 800 }}>
                        {r.debit || ''}
                      </td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 800 }}>
                        {r.credit || ''}
                      </td>
                      <td style={{ padding: '8px 12px', borderRight: '1px solid #000000', textAlign: 'center', fontWeight: 900 }}>
                        {r.balance}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenLedger(r.party.id)}
                          style={{
                            background: '#FFFFFF',
                            color: '#002B99',
                            border: '1px solid #000000',
                            borderRadius: '4px',
                            padding: '3px 14px',
                            fontWeight: 900,
                            fontSize: '0.78rem',
                            cursor: 'pointer'
                          }}
                        >
                          LEDGER
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Empty rows padder if fewer than 5 parties */}
                  {Array.from({ length: Math.max(0, 5 - partyOutstandingRows.length) }).map((_, i) => (
                    <tr key={`empty-out-${i}`} style={{ borderBottom: '1px solid #000000', height: '36px' }}>
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
                <tfoot>
                  <tr style={{ background: '#FFFFFF', borderTop: '2px solid #000000', height: '42px' }}>
                    <td
                      colSpan={2}
                      style={{
                        padding: '8px 12px',
                        fontWeight: 900,
                        fontSize: '1.15rem',
                        textAlign: 'center',
                        borderRight: '1px solid #000000'
                      }}
                    >
                      Total
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 900, fontSize: '1rem', borderRight: '1px solid #000000' }}>
                      {outstandingTotals.oppBalance}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 900, fontSize: '1rem', borderRight: '1px solid #000000' }}>
                      {outstandingTotals.debit}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 900, fontSize: '1rem', borderRight: '1px solid #000000' }}>
                      {outstandingTotals.credit}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 900, fontSize: '1rem', borderRight: '1px solid #000000' }}>
                      {outstandingTotals.balance}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: INDIVIDUAL PARTY LEDGER (Statement View matching mockup)          */}
      {/* ========================================================================= */}
      {viewMode === 'INDIVIDUAL_LEDGER' && (
        <>
          {/* FULL-WIDTH MAGENTA PARTY BANNER matching mockup */}
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
              {activeParty?.name || 'SELECT CUSTOMER / PARTY'}
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
            {/* Card 1: Opp. Balance */}
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
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  color: '#000000',
                  marginBottom: '4px'
                }}
              >
                Opp. Balance
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#000000' }}>
                {summary.openingBalance}
              </div>
            </div>

            {/* Card 2: Debit */}
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
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  color: '#000000',
                  marginBottom: '4px'
                }}
              >
                Debit
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#000000' }}>
                {summary.totalBilled}
              </div>
            </div>

            {/* Card 3: Credit */}
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
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  color: '#000000',
                  marginBottom: '4px'
                }}
              >
                Credit
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#000000' }}>
                {summary.totalPaid}
              </div>
            </div>

            {/* Card 4: Closing Balance */}
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
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  color: '#000000',
                  marginBottom: '4px'
                }}
              >
                Closing Balance
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#000000' }}>
                {summary.outstandingBalance}
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
                    <th style={{ padding: '10px 12px', borderRight: '1px solid #000000', fontWeight: 900, fontSize: '0.95rem', textAlign: 'left' }}>
                      Remarks
                    </th>
                    <th style={{ padding: '10px 8px', width: '70px', fontWeight: 900, fontSize: '0.95rem', textAlign: 'center' }}>
                      Action
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
                    <td style={{ borderRight: '1px solid #000000' }}></td>
                    <td></td>
                  </tr>

                  {/* Transactions */}
                  {transactionLogs.map(log => {
                    const isInvoice = log.type === 'SALE';
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
                          {isInvoice ? (
                            <button
                              type="button"
                              onClick={() => handleOpenBillDetail(log.refNo)}
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
                          {isInvoice && log.totalAmount ? round2(log.totalAmount) : ''}
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
                        <td style={{ padding: '8px 10px', borderRight: '1px solid #000000', textAlign: 'left', fontWeight: 700 }}>
                          {log.notes || ''}
                        </td>
                        <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleDeleteLog(log)}
                            title="Delete Ledger Entry"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#DC2626',
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '4px'
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Pad with empty rows if fewer than 5 transactions */}
                  {Array.from({ length: Math.max(0, 5 - transactionLogs.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #000000', height: '34px' }}>
                      <td style={{ borderRight: '1px solid #000000' }}></td>
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
                      {summary.totalBilled}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 900, fontSize: '1rem', borderRight: '1px solid #000000' }}>
                      {summary.totalPaid}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 900, fontSize: '1rem', borderRight: '1px solid #000000' }}>
                      {summary.outstandingBalance}
                    </td>
                    <td style={{ borderRight: '1px solid #000000' }}></td>
                    <td style={{ borderRight: '1px solid #000000' }}></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Payment Receipt Modal */}
      <PaymentCollectModal
        isOpen={showPaymentForm}
        onClose={() => setShowPaymentForm(false)}
        initialPartyId={activeParty?.id}
      />

      {/* Detailed Bill Log Modal */}
      {selectedSaleDetail && (
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
                Sale Invoice: {selectedSaleDetail.billNo} ({formatDateToDisplay(selectedSaleDetail.billDate)})
              </div>
              <button
                onClick={() => setSelectedSaleDetail(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '16px', overflowY: 'auto' }}>
              <div style={{ marginBottom: '12px', fontWeight: 800 }}>
                Customer / Party: {selectedSaleDetail.partyName}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#ECECEC', borderBottom: '1px solid #000000' }}>
                    <th style={{ padding: '8px' }}>Item</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Rate</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSaleDetail.items.map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <td style={{ padding: '8px', fontWeight: 700 }}>{it.itemName}</td>
                      <td style={{ padding: '8px', textAlign: 'center', fontWeight: 800 }}>{it.qty}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>₹{it.salePrice || (it as any).saleRate || 0}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 800 }}>₹{it.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ textAlign: 'right', marginTop: '16px', fontWeight: 900, fontSize: '1.1rem' }}>
                Bill Total: ₹{selectedSaleDetail.billTotal}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
