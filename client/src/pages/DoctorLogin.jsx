import Logo from '../components/Logo';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Stethoscope } from 'lucide-react';

const DoctorLogin = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // API call to the backend
      const response = await axios.post('/api/doctors/auth/login', formData, {
        withCredentials: true
      });

      if (response.data.status === 'success') {
        await refresh();
        navigate('/doctor/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout animate-fade-in">
      <div className="auth-card">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-3"><Logo size={72} /></div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Doctor Portal</h2>
          <p className="text-muted text-center mt-2">Sign in to your doctor account</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-center text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="input-group">
            <label className="input-label" htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              className="input-field"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group">
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

          <div className="flex justify-between items-center mb-6 mt-2">
            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" /> Remember me
            </label>
            <Link to="/doctor/forgot-password" className="text-primary text-sm font-medium hover:underline">Forgot password?</Link>
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ padding: '0.75rem', fontSize: '1rem' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-muted mt-6 text-sm">
          Don't have an account? <Link to="/doctor/register" className="text-primary font-medium hover:underline">Register here</Link>
        </p>
      </div>
    </div>
  );
};

export default DoctorLogin;
