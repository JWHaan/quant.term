import React, { useState } from 'react';
import { LayoutDashboard, BarChart3, Activity, Settings, Menu, X } from 'lucide-react';

const Layout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: isSidebarOpen ? 'var(--sidebar-width)' : '60px',
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.3s ease',
          overflow: 'hidden',
          zIndex: 10
        }}
      >
        <div style={{ 
          height: 'var(--header-height)', 
          display: 'flex', 
          alignItems: 'center', 
          padding: '0 var(--spacing-md)',
          borderBottom: '1px solid var(--border-color)',
          justifyContent: isSidebarOpen ? 'space-between' : 'center'
        }}>
          {isSidebarOpen && <span className="mono" style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>QUANT.TERM</span>}
          <button 
            onClick={toggleSidebar}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)' }}
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav style={{ flex: 1, padding: 'var(--spacing-md) 0' }}>
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" isOpen={isSidebarOpen} active />
          <NavItem icon={<Activity size={20} />} label="Volatility" isOpen={isSidebarOpen} />
          <NavItem icon={<BarChart3 size={20} />} label="Analysis" isOpen={isSidebarOpen} />
          <NavItem icon={<Settings size={20} />} label="Settings" isOpen={isSidebarOpen} />
        </nav>

        <div style={{ 
          padding: 'var(--spacing-md)', 
          borderTop: '1px solid var(--border-color)',
          fontSize: '12px',
          color: 'var(--text-muted)',
          textAlign: 'center'
        }}>
          {isSidebarOpen ? 'v1.0.0-alpha' : 'v1'}
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{
          height: 'var(--header-height)',
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--spacing-lg)',
          justifyContent: 'space-between'
        }}>
          <h1 style={{ fontSize: '18px', fontWeight: '500' }}>Market Overview</h1>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: '12px', color: 'var(--accent-primary)' }}>● LIVE</span>
            <span className="mono" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>BTC/USD 98,432.50</span>
          </div>
        </header>
        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-lg)', position: 'relative' }}>
          {children}
        </div>
      </main>
    </div>
  );
};

const NavItem = ({ icon, label, isOpen, active }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    cursor: 'pointer',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    backgroundColor: active ? 'var(--bg-tertiary)' : 'transparent',
    borderLeft: active ? '3px solid var(--accent-primary)' : '3px solid transparent',
    marginBottom: '4px',
    transition: 'all 0.2s'
  }}>
    <div style={{ minWidth: '24px', display: 'flex', justifyContent: 'center' }}>
      {icon}
    </div>
    {isOpen && (
      <span style={{ marginLeft: 'var(--spacing-md)', fontSize: '14px' }}>
        {label}
      </span>
    )}
  </div>
);

export default Layout;
