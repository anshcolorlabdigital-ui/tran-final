import React, { useEffect } from 'react';
import { Modal } from './Modal';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

export type AlertType = 'warning' | 'error' | 'info' | 'success';

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: AlertType;
  buttonText?: string;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'warning',
  buttonText = 'OK'
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getHeaderTitle = () => {
    if (title) return title;
    switch (type) {
      case 'error': return 'Error';
      case 'warning': return 'Attention Required';
      case 'success': return 'Success';
      case 'info': default: return 'Information';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'error':
        return <AlertCircle size={28} color="#DC2626" />;
      case 'warning':
        return <AlertTriangle size={28} color="#D97706" />;
      case 'success':
        return <CheckCircle2 size={28} color="#16A34A" />;
      case 'info':
      default:
        return <Info size={28} color="#2563EB" />;
    }
  };

  const getIconBg = () => {
    switch (type) {
      case 'error': return '#FEE2E2';
      case 'warning': return '#FEF3C7';
      case 'success': return '#DCFCE7';
      case 'info': default: return '#DBEAFE';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getHeaderTitle()} maxWidth="440px">
      <div style={{ padding: '8px 4px 16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div
            style={{
              backgroundColor: getIconBg(),
              borderRadius: '50%',
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(0,0,0,0.06)'
            }}
          >
            {getIcon()}
          </div>
          <div style={{ flex: 1, paddingTop: '4px' }}>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', lineHeight: 1.5, margin: 0 }}>
              {message}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '8px', borderTop: '1px solid #E5E7EB' }}>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="btn-customer-save"
            style={{
              padding: '8px 44px',
              fontSize: '1rem',
              minWidth: '130px',
              cursor: 'pointer'
            }}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
