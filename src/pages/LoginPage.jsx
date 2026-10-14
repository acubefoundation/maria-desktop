import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useNavigate } from 'react-router-dom';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Coffee, 
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (data) => {
    try {
      setError(null);
      await login(data);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="login-layout">
      {/* ─── Left Column: Sign In Form ─── */}
      <div className="login-form-side">
        {/* Top Brand Nav */}
        <div className="login-nav">
          <div className="login-nav__logo">
            <Coffee size={20} strokeWidth={2.5} />
          </div>
          <span className="login-nav__title">Maria Private Stock</span>
        </div>

        {/* Center Form Section */}
        <div className="login-form-wrapper">
          <div className="login-header">
            <h1 className="login-main-title">Welcome to Maria Private Stock</h1>
            <p className="login-main-subtitle">
              Start your experience with Maria Private Stock by signing in to your account.
            </p>
          </div>

          {error && (
            <div className="login-banner-error mb-4">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="login-form-fields" noValidate>
            {/* Email Field */}
            <div className="login-field">
              <label htmlFor="login-email" className="login-label">
                Email Address <span className="login-required-star">*</span>
              </label>
              <div className="login-input-control">
                <span className="login-input-icon">
                  <Mail size={18} />
                </span>
                <input
                  id="login-email"
                  type="email"
                  placeholder="Enter your email address"
                  className="login-input"
                  autoComplete="email"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="login-field-error">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="login-field">
              <label htmlFor="login-password" className="login-label">
                Password <span className="login-required-star">*</span>
              </label>
              <div className="login-input-control">
                <span className="login-input-icon">
                  <Lock size={18} />
                </span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'} /* type="password" */
                  placeholder="Enter your password"
                  className="login-input login-input--has-right-icon"
                  autoComplete="current-password"
                  {...register('password')}
                />
                <button
                  type="button"
                  className="login-input-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="login-field-error">{errors.password.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="login-submit-btn"
            >
              {isSubmitting ? (
                <>
                  <span className="login-spinner" />
                  <span>Signing In...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="login-footer-text">
          &copy; {new Date().getFullYear()} Maria Private Stock. All rights reserved.
        </div>
      </div>

      {/* ─── Right Column: Visual Showcase (Inspired by Reference) ─── */}
      <div className="login-showcase-side" aria-hidden="true">
        <div className="login-showcase-grid" />
        <div className="login-showcase-glow" />

        {/* Floating Glassmorphism Cards Container */}
        <div className="login-floating-container">
          {/* Card 1: Warehouse Stock & Inflow Summary */}
          <div className="showcase-card showcase-card--summary">
            <div className="showcase-card-header">
              <span className="showcase-card-title">Stock Inflow</span>
              <span className="showcase-badge">This Month</span>
            </div>
            <div className="showcase-summary-body">
              <div className="showcase-stat-value">2,485.50 Qtl</div>
              <div className="showcase-stat-label">Total Inflow Intake</div>
              <div className="showcase-breakdown-list">
                <div className="showcase-legend-item">
                  <span className="showcase-dot showcase-dot--teal" />
                  <span>Washed Arabica (Grade 1 & 2): 1,367.00 Qtl</span>
                </div>
                <div className="showcase-legend-item">
                  <span className="showcase-dot showcase-dot--amber" />
                  <span>Jimma Natural (Grade 4 & 5): 1,118.50 Qtl</span>
                </div>
              </div>
            </div>
            <div className="showcase-card-footer">
              <span className="showcase-footer-tag">Anticipated Intake: 650 Qtl</span>
              <span className="showcase-mini-btn">Explore Batches</span>
            </div>
          </div>

          {/* Card 2: Processing Batches Progress */}
          <div className="showcase-card showcase-card--progress">
            <div className="showcase-progress-title">Processing Lots</div>
            <div className="showcase-progress-date">Due: Oct 15, 2026</div>
            <div className="showcase-progress-amount">
              1,900 <span>/ 2,500 Qtl</span>
            </div>
            <div className="showcase-bar-track">
              <div className="showcase-bar-fill" />
            </div>
            <div className="showcase-bar-desc">
              <span>Required: 600 Qtl</span>
              <span className="font-semibold text-teal-700">76%</span>
            </div>
          </div>

          {/* Card 3: Stock Allocations List */}
          <div className="showcase-card showcase-card--list">
            <div className="showcase-list-header">
              <span className="showcase-card-title">Warehouse Lots</span>
              <span className="showcase-list-sync">
                <RefreshCw size={11} /> Updated just now
              </span>
            </div>
            <div className="showcase-list-total">
              17,366.00 Qtl
              <span className="showcase-pct-pill">+12%</span>
            </div>
            <div className="showcase-list-items">
              <div className="showcase-list-row">
                <div>
                  <div className="showcase-row-name">Sidama Grade 1</div>
                  <div className="showcase-row-sub">Washed Micro-Lot</div>
                </div>
                <div>
                  <div className="showcase-row-val">5,200 Qtl</div>
                  <div className="showcase-row-pct">+3.8%</div>
                </div>
              </div>
              <div className="showcase-list-row">
                <div>
                  <div className="showcase-row-name">Yirgacheffe Cleaned</div>
                  <div className="showcase-row-sub">Ready for Export</div>
                </div>
                <div>
                  <div className="showcase-row-val">3,700 Qtl</div>
                  <div className="showcase-row-pct">+2.5%</div>
                </div>
              </div>
              <div className="showcase-list-row">
                <div>
                  <div className="showcase-row-name">Jimma Special Prep</div>
                  <div className="showcase-row-sub">In Warehouse Storage</div>
                </div>
                <div>
                  <div className="showcase-row-val">1,400 Qtl</div>
                  <div className="showcase-row-pct">+6.2%</div>
                </div>
              </div>
            </div>
            <div className="showcase-review-btn">Review Inventory</div>
          </div>
        </div>

        {/* Showcase Bottom Feature Slogan */}
        <div className="login-showcase-bottom">
          <div className="login-showcase-badge-icon">
            <Coffee size={28} strokeWidth={2.2} />
          </div>
          <h2 className="login-showcase-heading">
            A Unified Hub for Smarter<br />Warehouse Operations
          </h2>
        </div>
      </div>
    </div>
  );
}
export default LoginPage;
