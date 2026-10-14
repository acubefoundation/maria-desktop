import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, MagnifyingGlass, Users, GearSix, ClipboardText, SignOut, Trash, Coffee, X, Database } from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import './TopBar.css';

export function TopBar({ onMenuToggle }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate('/entries?search=' + encodeURIComponent(searchQuery.trim()));
      setSearchQuery('');
    }
  };

  const handleProfileAction = (path) => {
    navigate(path);
    setProfileMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const { user, logout, isAdmin } = useAuth();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <>
      <header className="topbar">
        <div className="topbar__left">
          <div className="topbar__brand">
            <span className="topbar__brand-icon" aria-hidden="true">
              <Coffee size={18} weight="fill" />
            </span>
            <span className="topbar__brand-name">Maria Private Stock</span>
          </div>
          <div className="topbar__search">
            <MagnifyingGlass size={16} className="topbar__search-icon" />
            <input 
              type="text" 
              placeholder="Search batches, clients..." 
              className="topbar__search-input" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>
        <div className="topbar__right">
          <span className="topbar__time">{timeStr}</span>
          <div className="topbar__user">
            <button 
              className="topbar__user-avatar" 
              onClick={() => setProfileMenuOpen(true)}
              aria-label="User menu"
            >
              {user?.name?.charAt(0).toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Profile Dropdown Modal */}
      <Modal
        isOpen={profileMenuOpen}
        onClose={() => setProfileMenuOpen(false)}
        size="sm"
        className="topbar__profile-modal"
      >
        <div className="topbar__profile-modal-content">
          <div className="topbar__profile-modal-header">
            <div className="topbar__profile-user">
              <div className="topbar__profile-avatar">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="topbar__profile-name">{user?.name}</span>
                <span className="topbar__profile-role">{user?.role?.replace('_', ' ')}</span>
              </div>
            </div>
            <button className="topbar__profile-close" onClick={() => setProfileMenuOpen(false)} aria-label="Close">
              <X size={18} weight="regular" />
            </button>
          </div>
          <div className="topbar__profile-divider" />
          <nav className="topbar__profile-nav">
            {/* Settings is a read page for every signed-in role: grades,
                origins and locations populate the entry and dispatch dropdowns.
                Only the writes on it are ADMIN-only. */}
            <button
              className="topbar__profile-nav-item"
              onClick={() => handleProfileAction('/settings')}
            >
              <GearSix size={18} weight="regular" />
              <span>Settings</span>
            </button>
            {/* Users, Audit Log and Trash are ADMIN-only server-side, so they
                are hidden rather than left to fail with a 403. */}
            {isAdmin && (
              <>
                <button
                  className="topbar__profile-nav-item"
                  onClick={() => handleProfileAction('/users')}
                >
                  <Users size={18} weight="regular" />
                  <span>Users</span>
                </button>
                <button
                  className="topbar__profile-nav-item"
                  onClick={() => handleProfileAction('/audit')}
                >
                  <ClipboardText size={18} weight="regular" />
                  <span>Audit Log</span>
                </button>
                <button
                  className="topbar__profile-nav-item"
                  onClick={() => handleProfileAction('/trash')}
                >
                  <Trash size={18} weight="regular" />
                  <span>Trash</span>
                </button>
                <button
                  className="topbar__profile-nav-item"
                  onClick={() => handleProfileAction('/backup')}
                >
                  <Database size={18} weight="regular" />
                  <span>Backup</span>
                </button>
              </>
            )}
            <div className="topbar__profile-divider" />
            <button 
              className="topbar__profile-nav-item topbar__profile-nav-item--danger" 
              onClick={handleLogout}
            >
              <SignOut size={18} weight="regular" />
              <span>Sign Out</span>
            </button>
          </nav>
        </div>
      </Modal>
    </>
  );
}
