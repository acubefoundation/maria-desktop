import React, { useState } from 'react';
import {
  Database,
  Download,
  Clock,
  FileCode,
  WarningCircle,
  CheckCircle,
} from '@phosphor-icons/react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { api } from '../lib/api';
import './BackupPage.css';

export function BackupPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lastBackup, setLastBackup] = useState(null);

  const handleBackup = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Use the shared api client (not a raw fetch) so the request goes to
      // the resolved backend base URL. A relative /api/backup would hit the
      // SPA origin on the deployed frontend, where no backend rewrite exists.
      const response = await api.get('/backup', {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const date = new Date().toISOString().split('T')[0];
      link.setAttribute(
        'download',
        `${import.meta.env.VITE_APP_NAME || 'db-backup'}-${date}.json`,
      );

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      const now = new Date();
      setLastBackup(now.toLocaleString());
      setMessage(
        `Backup downloaded successfully: ${
          import.meta.env.VITE_APP_NAME || 'db-backup'
        }-${date}.json`,
      );
    } catch (err) {
      setError('Backup failed. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Only show to admins
  if (user?.role !== 'ADMIN') {
    return (
      <div className="mocca-page">
        <div className="mocca-header">
          <div className="mocca-title-group">
            <span className="mocca-subtitle">WORKSPACE</span>
            <h1 className="mocca-title">Database Backup</h1>
          </div>
        </div>
        <div className="backup-access-denied">
          <WarningCircle size={48} />
          <h2>Access Denied</h2>
          <p>Only administrators can access the backup page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mocca-page">
      <div className="mocca-header">
        <div className="mocca-title-group">
          <span className="mocca-subtitle">WORKSPACE</span>
          <h1 className="mocca-title">Database Backup</h1>
        </div>
      </div>

      <div className="backup-container">
        {/* Main Backup Card */}
        <Card className="backup-card">
          <CardHeader>
            <CardTitle>
              <Database size={20} />
              Create Backup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="backup-description">
              Download a complete JSON snapshot of your database. This includes all tables,
              records, and metadata. Use this for disaster recovery or data migration.
            </p>

            <div className="backup-info-grid">
              <div className="backup-info-item">
                <FileCode size={16} />
                <span>Format: JSON</span>
              </div>
              <div className="backup-info-item">
                <Clock size={16} />
                <span>On demand</span>
              </div>
              <div className="backup-info-item">
                <CheckCircle size={16} />
                <span>Admin only</span>
              </div>
            </div>

            <div className="backup-actions">
              <Button
                onClick={handleBackup}
                disabled={loading}
                variant="primary"
                size="lg"
              >
                <Download size={18} />
                {loading ? 'Creating Backup...' : 'Download Backup'}
              </Button>
            </div>

            {message && (
              <div className="backup-message backup-success">
                <CheckCircle size={16} />
                {message}
              </div>
            )}
            {error && (
              <div className="backup-message backup-error">
                <WarningCircle size={16} />
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Backup Information Card */}
        <Card className="backup-card">
          <CardHeader>
            <CardTitle>Backup Information</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="backup-info-list">
              <li><strong>What's included:</strong> All database tables, all rows, timestamps</li>
              <li><strong>Format:</strong> JSON (can be opened in any text editor)</li>
              <li><strong>Frequency:</strong> Manual - download whenever you need a snapshot</li>
              <li><strong>Retention:</strong> Store backups locally and delete old ones as needed</li>
              <li><strong>Security:</strong> Only administrators can create backups</li>
            </ul>

            {lastBackup && (
              <div className="backup-last">
                <Clock size={14} />
                <span>Last backup: {lastBackup}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}