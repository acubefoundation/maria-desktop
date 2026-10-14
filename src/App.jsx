import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { RequireRoles } from './components/layout/RequireRoles';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ClientsPage } from './pages/CompaniesPage';
// import { CompanyDetailPage } from './pages/CompanyDetailPage';
import { StockPage } from './pages/StockPage';
import { DriversPage } from './pages/DriversPage';
import { ProcessingPage } from './pages/ProcessingPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { CoffeeEntriesPage } from './pages/CoffeeEntriesPage';
import { NewEntryPage } from './pages/NewEntryPage';
import { EntryDetailPage } from './pages/EntryDetailPage';
import { OutingsPage } from './pages/OutingsPage';
import { NewOutingPage } from './pages/NewOutingPage';
import { ReportsPage } from './pages/ReportsPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { ActivityTodayPage } from './pages/ActivityTodayPage';
import { TrashPage } from './pages/TrashPage';
import { BackupPage } from './pages/BackupPage';

// Pages only warehouse staff may open. COMPANY_VIEWER is absent throughout:
// it never sees the client roster, and it can never open a create form
// (/entries/new, /outings/new stay blocked even though the read-only Coffee In,
// Processing and Coffee Out lists are open to it).
const WAREHOUSE_ROLES = ['ADMIN', 'WAREHOUSE_MANAGER', 'VIEWER'];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  React.useEffect(() => {
    const theme = localStorage.getItem('mocca-theme');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              
              {/* The client roster is admin/manager/viewer only. COMPANY_VIEWER is a
                  customer role and must not reach it - hidden in the nav AND
                  guarded here so typing the URL is no escape hatch. */}
              <Route path="companies" element={
                <RequireRoles roles={WAREHOUSE_ROLES}>
                  <ClientsPage />
                </RequireRoles>
              } />
              {/* <Route path="companies/:id" element={<CompanyDetailPage />} /> */}
              
              <Route path="entries" element={<CoffeeEntriesPage /> } />
              <Route path="entries/new" element={
                <RequireRoles roles={WAREHOUSE_ROLES}>
                  <NewEntryPage />
                </RequireRoles>
              } />
              <Route path="entries/:id" element={<EntryDetailPage /> } />
              
              <Route path="processing" element={<ProcessingPage /> } />
              
              <Route path="outings" element={<OutingsPage /> } />
              <Route path="outings/new" element={
                <RequireRoles roles={WAREHOUSE_ROLES}>
                  <NewOutingPage />
                </RequireRoles>
              } />
              
              <Route path="drivers" element={
                <RequireRoles roles={WAREHOUSE_ROLES}>
                  <Navigate to="/entries" replace />
                </RequireRoles>
              } />
              <Route path="stock" element={<StockPage />} />
              <Route path="reports" element={<ReportsPage />} />
              
              <Route path="activity/today" element={<ActivityTodayPage />} />
              
              {/* Admin Routes */}
              <Route path="users" element={<UsersPage />} />
              <Route path="trash" element={<TrashPage />} />
              <Route path="backup" element={<BackupPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="audit" element={<AuditLogPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
