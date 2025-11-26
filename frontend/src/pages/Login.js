import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  if (user) {
    return <Navigate to="/" />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-title">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '10px' }}>
            <svg width="40" height="40" viewBox="0 0 64 64">
              <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#6366f1' }} />
                  <stop offset="100%" style={{ stopColor: '#8b5cf6' }} />
                </linearGradient>
              </defs>
              <ellipse cx="32" cy="16" rx="22" ry="8" fill="url(#logoGradient)" />
              <path d="M10 16 v32 a22 8 0 0 0 44 0 v-32" fill="url(#logoGradient)" opacity="0.9" />
              <ellipse cx="32" cy="48" rx="22" ry="8" fill="url(#logoGradient)" opacity="0.8" />
              <ellipse cx="32" cy="32" rx="22" ry="8" fill="none" stroke="#fff" strokeWidth="2" opacity="0.5" />
              <rect x="24" y="26" width="16" height="14" rx="2" fill="#fff" />
              <path d="M27 26 v-4 a5 5 0 0 1 10 0 v4" fill="none" stroke="#fff" strokeWidth="3" />
              <circle cx="32" cy="33" r="2" fill="url(#logoGradient)" />
              <path d="M32 35 v3" stroke="url(#logoGradient)" strokeWidth="2" />
            </svg>
            <h1 style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
              SQLVault Pro
            </h1>
          </div>
          <p>Enterprise SQL Server Inventory Management</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Disclaimer */}
        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: 'rgba(99, 102, 241, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 8px 0' }}>
            This is an open source project built with Vibe Coding
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '15px',
        textAlign: 'center',
        background: 'rgba(26, 26, 46, 0.95)',
        borderTop: '1px solid var(--border-color)',
        fontSize: '0.85rem',
        color: 'var(--text-secondary)'
      }}>
        <p style={{ margin: '0 0 5px 0' }}>
          Developed by{' '}
          <a
            href="https://www.linkedin.com/in/ahmed-mohamed-423583151/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: '600' }}
          >
            AHMED MOHAMMED
          </a>
        </p>
        <a
          href="https://www.linkedin.com/in/ahmed-mohamed-423583151/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          Connect on LinkedIn
        </a>
      </div>
    </div>
  );
}

export default Login;
