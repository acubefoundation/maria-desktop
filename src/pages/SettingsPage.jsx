import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { User, Palette, ShieldCheck } from '@phosphor-icons/react';
import { useAuth } from '../contexts/AuthContext';
import { usersApi } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import './SettingsPage.css';

export function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="mocca-page">
      <div className="mocca-header">
        <div className="mocca-title-group"><span className="mocca-subtitle">WORKSPACE</span><h1 className="mocca-title">System Settings</h1></div>
      </div>

      <div className="settings-container">
        <div className="settings-nav">
          {['profile', 'security', 'theme'].map(tab => {
            const icons = {
              profile: <User size={18} />,
              security: <ShieldCheck size={18} />,
              theme: <Palette size={18} />,
            };
            const labels = {
              profile: 'Profile Management',
              security: 'Security',
              theme: 'Theme Preferences',
            };
            const isActive = activeTab === tab;
            return (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`settings-nav-btn ${isActive ? 'settings-nav-btn--active' : ''}`}
              >
                {icons[tab]} {labels[tab]}
              </button>
            );
          })}
        </div>

        <div className="settings-content">
          {activeTab === 'profile' && <ProfileTab user={user} />}
          {activeTab === 'security' && <SecurityTab user={user} />}
          {activeTab === 'theme' && <ThemeTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ user }) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  
  const updateMut = useMutation({
    mutationFn: (data) => usersApi.update(user.id, data),
    onSuccess: (data) => {
      alert('Profile updated! Please log out and back in to see changes globally.');
    },
    onError: () => alert('Failed to update profile')
  });

  return (
    <Card>
      <CardHeader><CardTitle>Profile Management</CardTitle></CardHeader>
      <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'var(--color-tertiary)' }}>Full Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'var(--color-tertiary)' }}>Email Address</label>
          <Input value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'var(--color-tertiary)' }}>Role</label>
          <Input value={user?.role || ''} disabled style={{ background: 'var(--color-bg)' }} />
        </div>
        <div style={{ marginTop: 16 }}>
          <Button onClick={() => updateMut.mutate({ name, email })} disabled={updateMut.isPending}>
            {updateMut.isPending ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SecurityTab({ user }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  
  const updateMut = useMutation({
    mutationFn: (data) => usersApi.update(user.id, data),
    onSuccess: () => {
      alert('Password updated!');
      setPassword('');
      setConfirm('');
    },
    onError: () => alert('Failed to update password')
  });

  const handleSave = () => {
    if (password !== confirm) return alert('Passwords do not match');
    if (password.length < 6) return alert('Password too short');
    updateMut.mutate({ password });
  };

  return (
    <Card>
      <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
      <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'var(--color-tertiary)' }}>New Password</label>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 500, color: 'var(--color-tertiary)' }}>Confirm Password</label>
          <Input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
        </div>
        <div style={{ marginTop: 16 }}>
          <Button onClick={handleSave} disabled={updateMut.isPending || !password}>
            {updateMut.isPending ? 'Saving...' : 'Update Password'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ThemeTab() {
  const [theme, setTheme] = useState(localStorage.getItem('mocca-theme') || 'light');

  const applyTheme = (mode) => {
    setTheme(mode);
    localStorage.setItem('mocca-theme', mode);
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Theme Preferences</CardTitle></CardHeader>
      <CardContent style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ color: 'var(--color-tertiary)', fontSize: 14 }}>
          Customize the appearance of the warehouse system to suit your environment.
        </p>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <button 
            style={{ 
              flex: 1, padding: 24, borderRadius: 8, 
              border: `2px solid ${theme === 'light' ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: '#fafafa', color: '#14171c', fontWeight: 600
            }}
            onClick={() => applyTheme('light')}
          >
            Light Mode
          </button>
          <button 
            style={{ 
              flex: 1, padding: 24, borderRadius: 8, 
              border: `2px solid ${theme === 'dark' ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: '#13151c', color: '#f8fafc', fontWeight: 600
            }}
            onClick={() => applyTheme('dark')}
          >
            Dark Mode
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
