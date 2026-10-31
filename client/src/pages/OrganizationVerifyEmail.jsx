import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Mail, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';

const OrganizationVerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const emailParam = searchParams.get('email') || '';
  const registered = searchParams.get('registered') === 'true';

  const [email, setEmail] = useState(emailParam);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(registered ? 'Registration successful! Verification OTP sent to your email.' : '');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer = null;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Email address is required.');
      return;
    }
    if (!otp || otp.trim().length !== 6) {
      setError('Please enter a valid 6-digit OTP.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('/api/organizations/auth/verify-email', {
        email: email.trim().toLowerCase(),
        otp: otp.trim()
      }, { withCredentials: true });

      if (response.data.status === 'success') {
        await refresh();
        navigate('/organization/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || 'Verification failed. Please check the OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError('Email is required to resend OTP.');
      return;
    }
    if (cooldown > 0) return;

    setResending(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('/api/organizations/auth/resend-verification-otp', {
        email: email.trim().toLowerCase()
      });

      if (response.data.status === 'success') {
        setSuccess('A new 6-digit OTP has been sent to your email.');
        setCooldown(60); // 60s cooldown
      }
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || 'Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-layout animate-fade-in py-12">
      <div className="auth-card max-w-md w-full">
        <div className="flex flex-col items-center mb-6">
          <div className="mb-3"><Logo size={72} /></div>
          <div className="w-14 h-14 bg-blue-50 text-primary rounded-full flex items-center justify-center mb-3">
            <Mail size={28} />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Verify Organization Email</h2>
          <p className="text-muted text-center mt-1 text-sm">
            Please enter the 6-digit verification code sent to your organization's email address.
          </p>
        </div>

        {success && (
          <div className="bg-green-50 text-green-700 p-3 rounded mb-4 text-sm border border-green-200 flex items-center gap-2">
            <CheckCircle size={16} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm border border-red-200 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <div className="input-group">
            <label className="input-label" htmlFor="email">Organization Email</label>
            <input
              type="email"
              id="email"
              className="input-field"
              placeholder="contact@hospital.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="otp">6-Digit Verification Code</label>
            <input
              type="text"
              id="otp"
              maxLength={6}
              className="input-field text-center font-bold tracking-widest text-2xl"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full mt-2"
            disabled={loading}
            style={{ padding: '0.75rem', fontSize: '1rem' }}
          >
            {loading ? 'Verifying Code...' : 'Verify Email & Enter Dashboard'}
          </button>
        </form>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 text-sm">
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="text-primary font-medium flex items-center gap-1 hover:underline disabled:opacity-50"
          >
            <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend OTP'}
          </button>

          <Link to="/organization/login" className="text-muted hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OrganizationVerifyEmail;
