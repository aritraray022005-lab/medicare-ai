import Logo from '../components/Logo';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Shield, Mail, Lock, Eye, EyeOff } from 'lucide-react';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/admin/auth/login', formData, { withCredentials: true });
      if (response.data.status === 'success') {
        await refresh();
        navigate('/admin/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout animate-fade-in">
      <div className="auth-card" style={{ borderTop: '4px solid #dc2626' }}>
        <div className="flex flex-col items-center text-center mb-7">
          <Logo size={52} />
          <span className="inline-flex items-center gap-1.5 mt-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider" style={{ background: '#fee2e2', color: '#b91c1c' }}>
            <Shield size={14} /> Admin portal
          </span>
          <h2 className="text-2xl sm:text-3xl mt-3">Welcome back</h2>
          <p className="text-muted mt-1 text-sm">Authorized personnel only</p>
        </div>

        {error && (
          <div role="alert" className="bg-red-50 text-red-600 p-3 rounded-xl mb-5 text-sm font-medium border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="input-group">
            <label className="input-label" htmlFor="email">Admin email</label>
            <div className="input-wrap">
              <span className="input-icon" aria-hidden="true"><Mail size={18} /></span>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="username"
                className="input-field input-with-icon"
                placeholder="admin@medicare.ai"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="password">Password</label>
            <div className="input-wrap">
              <span className="input-icon" aria-hidden="true"><Lock size={18} /></span>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                autoComplete="current-password"
                className="input-field input-with-icon has-toggle"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="input-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn w-full text-white mt-2"
            style={{ background: '#dc2626', padding: '0.8rem', boxShadow: '0 8px 18px -8px rgb(220 38 38 / 0.6)' }}
            disabled={loading}
          >
            {loading ? 'Authenticating…' : 'Secure login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
