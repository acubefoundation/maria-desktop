
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  House,
  Buildings,
  ArrowDown,
  ArrowUp,
  Funnel,
  Package,
  FileText,
  Users,
  GearSix,
  ClipboardText,
  SignOut,
  Coffee,
  Trash,
  Database,
} from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext';
import './Sidebar.css';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', Icon: House },
  // Clients stays hidden for COMPANY_VIEWER - it is the client roster itself.
  { to: '/companies', label: 'Clients', Icon: Buildings, roles: ['ADMIN', 'WAREHOUSE_MANAGER', 'VIEWER'] },
  { to: '/entries', label: 'Coffee In', Icon: ArrowDown },
  { to: '/processing', label: 'Processing', Icon: Funnel },
  { to: '/outings', label: 'Coffee Out', Icon: ArrowUp },
  { to: '/stock', label: 'Stock', Icon: Package },
  { to: '/reports', label: 'Reports', Icon: FileText },
];

const adminItems = [
  { to: '/users', label: 'Users', Icon: Users },
  { to: '/trash', label: 'Trash', Icon: Trash },
  { to: '/settings', label: 'Settings', Icon: GearSix },
  { to: '/backup', label: 'Backup', Icon: Database },
  { to: '/audit', label: 'Audit Log', Icon: ClipboardText },
];

export function Sidebar({ isOpen, onClose }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // A COMPANY_VIEWER never sees the Clients roster. Coffee In, Processing and
  // Coffee Out stay visible but read-only: the API scopes them to the
  // viewer's own company and every create/edit control is gated on canWrite.
  const visibleNavItems = navItems.filter(
    ({ roles }) => !roles || roles.includes(user?.role)
  );

  return (
    <>
      <div
        className={`sidebar-overlay ${
          isOpen ? 'sidebar-overlay--open' : ''
        }`}
        onClick={onClose}
      />

      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        {/* Brand */}
        <div className="sidebar__brand">
          <div className="sidebar__brand-icon">
            <Coffee size={20} weight="fill" />
          </div>

          <div className="sidebar__brand-text">
            <span className="sidebar__brand-name">Maria Private Stock</span>
            <span className="sidebar__brand-badge">
              <span className="sidebar__brand-dot" />
              WH-01 Active
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar__nav">
          <ul className="sidebar__list">
{visibleNavItems.map(({ to, label, Icon }) => (
  <li key={to} className={to === '/dashboard' ? 'sidebar__item--dashboard' : undefined}>
    <NavLink
      to={to}
      className={({ isActive }) =>
        `sidebar__link ${
          isActive ? 'sidebar__link--active' : ''
        } ${
          to === '/dashboard'
            ? 'sidebar__link--dashboard'
            : ''
        }`
      }
      onClick={onClose}
    >
      <Icon
        size={18}
        weight="regular"
        className="sidebar__icon"
      />
      <span className="sidebar__link-text">{label}</span>
    </NavLink>
  </li>
))}
          </ul>

          {/* Administration - desktop only */}
          {isAdmin && (
            <div className="sidebar__admin">
              <div className="sidebar__divider" />

              <p className="sidebar__section-label">
                Administration
              </p>

              <ul className="sidebar__list">
{adminItems.map(({ to, label, Icon }) => (
  <li key={to}>
    <NavLink
      to={to}
      className={({ isActive }) =>
        `sidebar__link ${
          isActive ? 'sidebar__link--active' : ''
        }`
      }
      onClick={onClose}
    >
      <Icon
        size={18}
        weight="regular"
        className="sidebar__icon"
      />
      <span className="sidebar__link-text">{label}</span>
    </NavLink>
  </li>
))}
              </ul>
            </div>
          )}
        </nav>

        {/* User footer - desktop only */}
        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__user-avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>

            <div className="sidebar__user-info">
              <span className="sidebar__user-name">
                {user?.name}
              </span>

              <span className="sidebar__user-role">
                {user?.role?.replace('_', ' ')}
              </span>
            </div>
          </div>

          <button
            className="sidebar__logout"
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
          >
            <SignOut size={16} weight="regular" />
          </button>
        </div>
      </aside>
    </>
  );
}