import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, User, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    // Small delay for smooth UI feedback
    setTimeout(() => {
      const res = login(identifier, password);
      if (!res.success) {
        setErrorMessage(res.message || 'Login failed. Please check your credentials.');
        setIsLoading(false);
      }
    }, 200);
  };

  const handleQuickFill = (userType: 'admin' | 'staff') => {
    if (userType === 'admin') {
      setIdentifier('admin');
      setPassword('admin');
    } else {
      setIdentifier('operator');
      setPassword('operator');
    }
    setErrorMessage('');
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-card-container">
        {/* Brand Header */}
        <div className="login-brand-header">
          <div className="login-brand-badge">
            <ShieldCheck size={28} color="#166534" />
          </div>
          <h1 className="login-app-title">RAW MATERIAL MANAGEMENT</h1>
          <p className="login-app-subtitle">Secure Multi-User Access & Role Management</p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="login-error-banner">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-input-group">
            <label className="login-label">
              Email or Username
              <span style={{ color: '#EA3943', marginLeft: '2px' }}>*</span>
            </label>
            <div className="login-input-box">
              <User size={18} className="login-input-icon" />
              <input
                type="text"
                className="login-input-field"
                placeholder="admin@ansh.com or username"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                autoFocus
                required
              />
            </div>
            <span className="login-field-hint">
              Admins can use email/username; Staff use assigned username.
            </span>
          </div>

          <div className="login-input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="login-label">
                Password
                <span style={{ color: '#EA3943', marginLeft: '2px' }}>*</span>
              </label>
            </div>
            <div className="login-input-box">
              <Lock size={18} className="login-input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="login-input-field"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="login-toggle-pass"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to System</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Credentials */}
        <div className="login-demo-section">
          <div className="login-demo-label">
            <Sparkles size={14} color="#6B46C1" />
            <span>Quick Login Credentials</span>
          </div>
          <div className="login-demo-grid">
            <button
              type="button"
              className="login-demo-chip admin-chip"
              onClick={() => handleQuickFill('admin')}
              title="Click to fill Admin credentials"
            >
              <span className="chip-role">ADMIN</span>
              <span className="chip-details">admin / admin</span>
            </button>

            <button
              type="button"
              className="login-demo-chip staff-chip"
              onClick={() => handleQuickFill('staff')}
              title="Click to fill Staff credentials"
            >
              <span className="chip-role">STAFF</span>
              <span className="chip-details">operator / operator</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
