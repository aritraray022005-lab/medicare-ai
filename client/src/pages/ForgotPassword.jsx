import Logo from '../components/Logo';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { KeyRound, Mail, ShieldCheck } from 'lucide-react';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await axios.post('/api/patients/change-password/send-otp', { email });
      if (response.data.status === 'success') {
        setSuccess('OTP has been sent to your email.');
        setStep(2);
      }
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await axios.post('/api/patients/change-password/verify-otp', { 
        email, 
        OTP: otp 
      });
      if (response.status === 200) {
        setSuccess('OTP verified successfully.');
        setStep(3);
      }
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || 'Invalid OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await axios.post('/api/patients/change-password', { 
        email, 
        OTP: otp,
        newpassword: newPassword
      });
      if (response.data.status === 'success') {
        setSuccess('Password changed successfully! Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout animate-fade-in">
      <div className="auth-card">
        <div className="flex justify-center mb-4"><Logo size={64} /></div>
        <div className="flex flex-col items-center mb-8">
          {step === 1 && <Mail size={48} className="text-primary mb-4" />}
          {step === 2 && <ShieldCheck size={48} className="text-primary mb-4" />}
          {step === 3 && <KeyRound size={48} className="text-primary mb-4" />}
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700' }}>
            {step === 1 ? 'Forgot Password' : step === 2 ? 'Verify OTP' : 'Reset Password'}
          </h2>
          <p className="text-muted text-center mt-2">
            {step === 1 ? 'Enter your email to receive an OTP' : 
             step === 2 ? 'Enter the OTP sent to your email' : 
             'Create a new strong password'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-center text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-center text-sm" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
            {success}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleSendOtp} className="flex flex-col">
            <div className="input-group mb-6">
              <label className="input-label" htmlFor="email">Email Address</label>
              <input 
                type="email" 
                id="email" 
                className="input-field" 
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ padding: '0.75rem', fontSize: '1rem' }}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="flex flex-col">
            <div className="input-group mb-6">
              <label className="input-label" htmlFor="otp">Enter OTP</label>
              <input 
                type="text" 
                id="otp" 
                className="input-field" 
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required 
              />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ padding: '0.75rem', fontSize: '1rem' }}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleChangePassword} className="flex flex-col">
            <div className="input-group mb-6">
              <label className="input-label" htmlFor="newPassword">New Password</label>
              <input 
                type="password" 
                id="newPassword" 
                className="input-field" 
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required 
                minLength="8"
              />
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ padding: '0.75rem', fontSize: '1rem' }}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <div className="flex justify-center mt-6">
          <Link to="/login" className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
