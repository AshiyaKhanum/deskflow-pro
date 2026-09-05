import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserDetailModal } from '../components/UserDetailModal';
import { initials } from '../utils/format';

const NAV_ITEMS: Array<{ to: string; label: string; roles: Array<'customer' | 'agent' | 'admin'>; icon: string }> = [
  { to: '/tickets', label: 'Tickets', roles: ['customer', 'agent', 'admin'], icon: '🎫' },
  { to: '/tickets/new', label: 'New Ticket', roles: ['customer'], icon: '➕' },
  { to: '/dashboard', label: 'Dashboard', roles: ['admin'], icon: '📊' },
  { to: '/admin/users', label: 'Users', roles: ['admin'], icon: '👥' },
  { to: '/admin/sla', label: 'SLA Policies', roles: ['admin'], icon: '⏱️' },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMyAccount, setShowMyAccount] = useState(false);

  if (!user) return null;
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role));

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      <aside className={`app-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            D
          </span>
          <div>
            <div>DeskFlow Pro</div>
            <div className="brand-tagline">Support Operations</div>
          </div>
        </div>

        <nav>
          <ul className="nav-list">
            {visibleItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                  end={item.to === '/tickets/new'}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="user-chip user-chip-button"
            onClick={() => setShowMyAccount(true)}
            aria-haspopup="dialog"
          >
            <span className="user-avatar" style={{ background: user.avatarColor }} aria-hidden="true">
              {initials(user.name)}
            </span>
            <div className="user-meta">
              <div className="user-name">{user.name}</div>
              <div className="user-role">{user.role}</div>
            </div>
          </button>
          <button className="btn btn-ghost btn-block btn-sm" onClick={logout} style={{ marginTop: 8 }}>
            Log out
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-expanded={sidebarOpen}
            aria-label="Toggle navigation menu"
          >
            ☰ Menu
          </button>
          <div className="brand" style={{ fontSize: '0.95rem' }}>
            <span className="brand-mark" style={{ width: 26, height: 26 }} aria-hidden="true">
              D
            </span>
            DeskFlow Pro
          </div>
        </header>
        <main id="main-content" className="app-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      {showMyAccount && <UserDetailModal user={user} onClose={() => setShowMyAccount(false)} />}
    </div>
  );
}
