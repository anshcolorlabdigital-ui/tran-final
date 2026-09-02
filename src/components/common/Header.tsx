import React from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatDateToDisplay } from '../../utils/dateUtils';
import { User, Calendar, ShieldCheck, RefreshCw } from 'lucide-react';

export const Header: React.FC = () => {
  const { selectedDate, setSelectedDate, triggerRefresh } = useApp();
  const { currentUser, users, switchUser } = useAuth();

  return (
    <header className="app-top-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h1 className="app-title">RAW MATERIAL MANAGEMENT SYSTEM</h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* Date Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '4px 10px', borderRadius: '8px', border: '1px solid #000000' }}>
          <Calendar size={16} color="#4B5563" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>DATE:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={e => e.target.value && setSelectedDate(e.target.value)}
            style={{
              border: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              color: '#000000',
              outline: 'none',
              cursor: 'pointer'
            }}
            title="Select Dashboard / Transaction Date"
          />
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#111827', marginLeft: '4px' }}>
            ({formatDateToDisplay(selectedDate)})
          </span>
        </div>

        {/* Refresh button */}
        <button
          onClick={triggerRefresh}
          title="Refresh Data"
          style={{
            background: '#FFFFFF',
            border: '1px solid #000000',
            borderRadius: '6px',
            padding: '6px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: 700,
            fontSize: '0.8rem'
          }}
        >
          <RefreshCw size={14} />
          Sync
        </button>

        {/* Active User Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', padding: '4px 10px', borderRadius: '8px', border: '1px solid #000000' }}>
          <User size={16} color="#4B5563" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>USER:</span>
          <select
            value={currentUser.id}
            onChange={e => switchUser(e.target.value)}
            style={{
              border: 'none',
              fontWeight: 800,
              fontSize: '0.9rem',
              outline: 'none',
              cursor: 'pointer',
              background: 'transparent'
            }}
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: currentUser.role === 'ADMIN' ? '#DCFCE7' : '#FEF3C7',
              color: currentUser.role === 'ADMIN' ? '#166534' : '#92400E',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px'
            }}
          >
            <ShieldCheck size={12} />
            {currentUser.role}
          </span>
        </div>
      </div>
    </header>
  );
};
