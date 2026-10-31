import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Building2, AlertCircle } from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';

const OrganizationLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useAuth();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setUnverifiedEmail('');

    try {
      const response = await axios.post('/api/organizations/auth/login', formData, {
        withCredentials: true
      });

      if (response.data.status === 'success') {
        await refresh();
        const from = location.state?.from || '/organization/dashboard';
        navigate(from, { replace: true });
      }
    } catch (err) {
      const msg = err.response?.data?.msg || err.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(msg);

      if (err.response?.data?.needsEmailVerification) {
        setUnverifiedEmail(err.response?.data?.email || formData.email);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout animate-fade-in py-12">
      <div className="auth-card">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-3"><Logo size={72} /></div>
          <div className="flex items-center gap-2 mb-1 text-primary font-medium text-sm">
            <Building2 size={18} /> Organization Portal
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Facility Sign In</h2>
          <p className="text-muted text-center mt-1">Sign in with your registered hospital or clinic account</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-center text-sm border border-red-200">
            <div className="flex items-center justify-center gap-2 font-medium mb-1">
              <AlertCircle size={16} /> {error}
            </div>
            {unverifiedEmail && (
              <div className="mt-2">
                <Link
                  to={`/organization/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
                  className="text-primary font-bold underline hover:opacity-80"
                >
                  Verify your email address now &rarr;
                </Link>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="input-group mb-4">
            <label className="input-label" htmlFor="email">Organization Email</label>
            <input
              type="email"
              id="email"
              name="email"
              className="input-field"
              placeholder="contact@hospital.org"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group mb-6">
            <label className="input-label" htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              className="input-field"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
            style={{ padding: '0.75rem', fontSize: '1rem' }}
          >
            {loading ? 'Authenticating...' : 'Sign In as Organization'}
          </button>
        </form>

        <p className="text-center text-muted mt-6 text-sm">
          Don't have an organization account?{' '}
          <Link to="/organization/register" className="text-primary font-medium hover:underline">
            Register your facility
          </Link>
        </p>
      </div>
    </div>
  );
};

export default OrganizationLogin;
