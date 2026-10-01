import Logo from '../components/Logo';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { UserPlus } from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // API call to the backend
      const response = await axios.post('/api/patients/auth/register', formData, {
        withCredentials: true
      });

      if (response.data.status === 'success') {
        setSuccess('Registration successful! Redirecting to dashboard...');
        await refresh();
        setTimeout(() => navigate('/dashboard'), 1000);
      }
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout animate-fade-in">
      <div className="auth-card">
        <div className="flex justify-center mb-4"><Logo size={64} /></div>
        <div className="flex flex-col items-center mb-8">
          <UserPlus size={48} className="text-primary mb-4" />
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Create Account</h2>
          <p className="text-muted text-center mt-2">Join MEDICARE AI as a patient</p>
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

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="input-group">
            <label className="input-label" htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              className="input-field"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              className="input-field"
              placeholder="john@example.com"
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
              placeholder="Create a strong password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="8"
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ padding: '0.75rem', fontSize: '1rem' }}>
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <p className="text-center text-muted mt-6 text-sm">
          Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Sign in here</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
