import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Building2, AlertCircle, CheckCircle } from 'lucide-react';
import Logo from '../components/Logo';

const OrganizationRegister = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    type: 'Hospital',
    registrationNumber: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    timezone: 'Asia/Kolkata'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must contain at least 8 characters.');
      return;
    }

    setLoading(true);

    const payload = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      type: formData.type,
      registrationNumber: formData.registrationNumber,
      address: {
        street: formData.street,
        city: formData.city,
        state: formData.state,
        postalCode: formData.postalCode,
        country: formData.country || 'India'
      },
      timezone: formData.timezone || 'Asia/Kolkata'
    };

    try {
      const response = await axios.post('/api/organizations/auth/register', payload, {
        withCredentials: true
      });

      if (response.data.status === 'success') {
        navigate(`/organization/verify-email?email=${encodeURIComponent(formData.email)}&registered=true`);
      }
    } catch (err) {
      if (err.response?.data?.errors && err.response.data.errors.length > 0) {
        setError(err.response.data.errors.map((e) => e.message).join(', '));
      } else {
        setError(err.response?.data?.msg || err.response?.data?.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout animate-fade-in py-12">
      <div className="auth-card max-w-xl w-full">
        <div className="flex flex-col items-center mb-6">
          <div className="mb-3"><Logo size={72} /></div>
          <div className="flex items-center gap-2 mb-1 text-primary font-medium text-sm">
            <Building2 size={18} /> Healthcare Facilities Registration
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Register Facility</h2>
          <p className="text-muted text-center mt-1">
            Register your hospital, clinic, or medical centre on MedCare AI
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm border border-red-200 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="input-group">
              <label className="input-label" htmlFor="name">Facility Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                className="input-field"
                placeholder="e.g. Apollo City Clinic"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="type">Facility Type *</label>
              <select
                id="type"
                name="type"
                className="input-field"
                value={formData.type}
                onChange={handleChange}
                required
              >
                <option value="Hospital">Hospital</option>
                <option value="Clinic">Clinic</option>
                <option value="Medical Centre">Medical Centre</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="input-group">
              <label className="input-label" htmlFor="email">Official Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                className="input-field"
                placeholder="admin@facility.org"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="phone">Official Phone *</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                className="input-field"
                placeholder="+91-9876543210"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="registrationNumber">
              Clinical Registration Number *
            </label>
            <input
              type="text"
              id="registrationNumber"
              name="registrationNumber"
              className="input-field"
              placeholder="e.g. CEA/WB/2026/0491"
              value={formData.registrationNumber}
              onChange={handleChange}
              required
            />
            <span className="text-xs text-muted mt-1">
              Must match your official government clinical establishment registration.
            </span>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Location & Address</h4>

            <div className="input-group mb-3">
              <label className="input-label" htmlFor="street">Street Address</label>
              <input
                type="text"
                id="street"
                name="street"
                className="input-field"
                placeholder="123 Hospital Road, Sector 4"
                value={formData.street}
                onChange={handleChange}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="input-group">
                <label className="input-label" htmlFor="city">City *</label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  className="input-field"
                  placeholder="e.g. Kolkata"
                  value={formData.city}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="state">State *</label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  className="input-field"
                  placeholder="e.g. West Bengal"
                  value={formData.state}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="postalCode">Postal Code</label>
                <input
                  type="text"
                  id="postalCode"
                  name="postalCode"
                  className="input-field"
                  placeholder="e.g. 700001"
                  value={formData.postalCode}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Account Security</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="input-group">
                <label className="input-label" htmlFor="password">Password *</label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  className="input-field"
                  placeholder="Min. 8 characters"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="confirmPassword">Confirm Password *</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  className="input-field"
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full mt-4"
            disabled={loading}
            style={{ padding: '0.75rem', fontSize: '1rem' }}
          >
            {loading ? 'Creating Organization Account...' : 'Register Organization'}
          </button>
        </form>

        <p className="text-center text-muted mt-6 text-sm">
          Already registered?{' '}
          <Link to="/organization/login" className="text-primary font-medium hover:underline">
            Sign in to Organization Portal
          </Link>
        </p>
      </div>
    </div>
  );
};

export default OrganizationRegister;
