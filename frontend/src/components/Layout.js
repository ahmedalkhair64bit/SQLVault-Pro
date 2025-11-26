import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GlobalSearch from './GlobalSearch';

function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="28" height="28" viewBox="0 0 64 64">
              <defs>
                <linearGradient id="sidebarLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#6366f1' }} />
                  <stop offset="100%" style={{ stopColor: '#8b5cf6' }} />
                </linearGradient>
              </defs>
              <ellipse cx="32" cy="16" rx="22" ry="8" fill="url(#sidebarLogoGradient)" />
              <path d="M10 16 v32 a22 8 0 0 0 44 0 v-32" fill="url(#sidebarLogoGradient)" opacity="0.9" />
              <ellipse cx="32" cy="48" rx="22" ry="8" fill="url(#sidebarLogoGradient)" opacity="0.8" />
              <ellipse cx="32" cy="32" rx="22" ry="8" fill="none" stroke="#fff" strokeWidth="2" opacity="0.5" />
              <rect x="24" y="26" width="16" height="14" rx="2" fill="#fff" />
              <path d="M27 26 v-4 a5 5 0 0 1 10 0 v4" fill="none" stroke="#fff" strokeWidth="3" />
              <circle cx="32" cy="33" r="2" fill="url(#sidebarLogoGradient)" />
              <path d="M32 35 v3" stroke="url(#sidebarLogoGradient)" strokeWidth="2" />
            </svg>
            <h2 style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0, fontSize: '1.3rem' }}>
              SQLVault Pro
            </h2>
          </div>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            <span>Dashboard</span>
          </NavLink>
          {isAdmin() && (
            <>
              <NavLink to="/admin/instances" className={({ isActive }) => isActive ? 'active' : ''}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M12 1v6m0 6v10"></path>
                  <path d="M21 12h-6m-6 0H3"></path>
                </svg>
                <span>Manage Instances</span>
              </NavLink>
              <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'active' : ''}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span>Manage Users</span>
              </NavLink>
              <NavLink to="/admin/applications" className={({ isActive }) => isActive ? 'active' : ''}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="3" y1="9" x2="21" y2="9"></line>
                  <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
                <span>Manage Applications</span>
              </NavLink>
            </>
          )}
        </nav>

        {/* Sidebar Footer with Developer Info */}
        <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
          <div className="user-info">
            <div className="user-avatar">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div>{user?.username}</div>
              <small style={{ color: 'var(--text-secondary)' }}>{user?.role}</small>
            </div>
          </div>

          {/* Developer credit in sidebar */}
          <div style={{
            marginTop: '15px',
            paddingTop: '15px',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            textAlign: 'center'
          }}>
            <p style={{ margin: '0 0 5px 0', opacity: 0.8 }}>Open Source Project</p>
            <p style={{ margin: '0 0 8px 0', opacity: 0.6 }}>Built with Vibe Coding</p>
            <a
              href="https://www.linkedin.com/in/ahmed-mohamed-423583151/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--primary-color)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.7rem'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              AHMED MOHAMMED
            </a>
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header className="header">
          <GlobalSearch />
          <button className="btn btn-secondary btn-small" onClick={handleLogout}>
            Logout
          </button>
        </header>
        <main className="main-content" style={{ flex: 1 }}>
          <Outlet />
        </main>

        {/* Main Footer */}
        <footer style={{
          padding: '12px 20px',
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)'
        }}>
          <div>
            <span style={{ opacity: 0.7 }}>SQLVault Pro - Open Source Project | Built with Vibe Coding</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span>Developed by{' '}
              <a
                href="https://www.linkedin.com/in/ahmed-mohamed-423583151/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: '600' }}
              >
                AHMED MOHAMMED
              </a>
            </span>
            <a
              href="https://www.linkedin.com/in/ahmed-mohamed-423583151/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                padding: '5px 10px',
                background: 'rgba(99, 102, 241, 0.1)',
                borderRadius: '4px',
                textDecoration: 'none',
                gap: '5px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              LinkedIn
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default Layout;
