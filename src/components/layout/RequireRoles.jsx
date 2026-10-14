import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AppSplash } from './AppSplash';

/**
 * Blocks a route for roles that must not reach it.
 *
 * Hiding a nav link is not access control - a COMPANY_VIEWER can still type
 * /companies in the URL bar. This redirects them somewhere they do belong.
 */
export function RequireRoles({ roles, children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AppSplash message="Checking your access" />;
  }

  if (user && roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace state={{ from: location.pathname }} />;
  }

  return children;
}
