import React, { useState } from 'react';
import axios from 'axios';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';

const PatientProfile = ({ profile, onProfileUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    age: profile?.age || '',
    gender: profile?.gender || '',
    address: profile?.address || ''
  });
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Email verification state
  const [verifyMode, setVerifyMode] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  const handleEditToggle = () => {
    if (isEditing) {
      // Reset form data to current profile on cancel
      setFormData({
        name: profile?.name || '',
        phone: profile?.phone || '',
        age: profile?.age || '',
        gender: profile?.gender || '',
        address: profile?.address || ''
      });
    }
    setIsEditing(!isEditing);
    setMessage('');
    setError('');
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    // Filter out empty strings to avoid Zod validation errors on optional fields
    const payload = {};
    Object.keys(formData).forEach(key => {
      if (formData[key] !== '') {
        payload[key] = formData[key];
      }
    });

    try {
      const response = await axios.patch('/api/patients/profile', payload, {
        withCredentials: true
      });
      if (response.data.status === 'success') {
        setMessage('Profile updated successfully.');
        setIsEditing(false);
        // Call the parent to refresh profile
        if (onProfileUpdate) onProfileUpdate();
      }
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendVerifyOTP = async () => {
    setVerifyLoading(true);
    setMessage('');
    setError('');
    
    try {
      const response = await axios.post('/api/patients/auth/send-otp', {}, {
        withCredentials: true
      });
      if (response.data.status === 'success') {
        setMessage('OTP sent to your email. Please check your inbox.');
        setVerifyMode(true);
      }
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setVerifyLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await axios.post('/api/patients/auth/verify-otp', { OTP: otp }, {
        withCredentials: true
      });
      if (response.status === 200 || response.data.status === 'success') {
        setMessage('Email verified successfully!');
        setVerifyMode(false);
        if (onProfileUpdate) onProfileUpdate();
      }
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || 'Invalid or expired OTP.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setError('');
    try {
      const response = await axios.delete('/api/patients/profile', {
        withCredentials: true
      });
      if (response.data.status === 'success') {
        window.location.href = '/'; // Full reload to clear states
      }
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || 'Failed to delete account.');
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
        <h2 className="text-2xl font-bold">Profile Information</h2>
        {!isEditing && !verifyMode && (
          <button onClick={handleEditToggle} className="btn btn-primary text-sm">
            Edit Profile
          </button>
        )}
      </div>

      {message && (
        <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm flex items-center gap-2" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
          <CheckCircle size={18} /> {message}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Verification Mode */}
      {verifyMode && !isEditing ? (
        <div className="bg-blue-50 p-6 rounded-lg mb-6 border border-blue-100">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <Mail size={18} /> Verify Your Email
          </h3>
          <p className="text-sm text-blue-600 mb-4">We've sent a 6-digit OTP to {profile?.email}</p>
          <form onSubmit={handleVerifyOTP} className="flex gap-3 max-w-sm">
            <input 
              type="text" 
              placeholder="Enter OTP" 
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="input-field"
              required
            />
            <button type="submit" disabled={verifyLoading} className="btn btn-primary whitespace-nowrap">
              {verifyLoading ? 'Verifying...' : 'Verify'}
            </button>
            <button type="button" onClick={() => { setVerifyMode(false); setMessage(''); setError(''); }} className="btn btn-outline whitespace-nowrap">
              Cancel
            </button>
          </form>
        </div>
      ) : null}

      {/* Profile Details or Edit Form */}
      {!isEditing ? (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-muted mb-1">Full Name</p>
              <p className="font-medium text-lg">{profile?.name || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-sm text-muted mb-1">Email Address</p>
              <div className="flex items-center gap-2">
                <p className="font-medium text-lg">{profile?.email}</p>
                {profile?.isEmailVerified ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1 font-medium">
                    <CheckCircle size={12} /> Verified
                  </span>
                ) : (
                  <button 
                    onClick={handleSendVerifyOTP} 
                    disabled={verifyLoading}
                    className="text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 px-2 py-1 rounded-full flex items-center gap-1 font-medium transition-colors"
                  >
                    <AlertCircle size={12} /> {verifyLoading ? 'Sending...' : 'Verify Now'}
                  </button>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted mb-1">Phone Number</p>
              <p className="font-medium text-lg">{profile?.phone || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-sm text-muted mb-1">Age</p>
              <p className="font-medium text-lg">{profile?.age || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-sm text-muted mb-1">Gender</p>
              <p className="font-medium text-lg capitalize">{profile?.gender || 'Not provided'}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted mb-1">Address</p>
              <p className="font-medium text-lg">{profile?.address || 'Not provided'}</p>
            </div>
          </div>
          
          <div className="mt-12 pt-6 border-t border-red-100">
            <h3 className="text-red-600 font-bold mb-2">Danger Zone</h3>
            {showDeleteConfirm ? (
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <p className="text-red-800 font-medium mb-3">Are you sure you want to delete your account? This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button onClick={handleDeleteAccount} disabled={deleteLoading} className="btn bg-red-600 hover:bg-red-700 text-white border-none">
                    {deleteLoading ? 'Deleting...' : 'Yes, Delete My Account'}
                  </button>
                  <button onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading} className="btn btn-outline border-red-200 text-red-700 hover:bg-red-50">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowDeleteConfirm(true)} className="btn btn-outline border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                Delete Account
              </button>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleUpdateProfile}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="input-group mb-0">
              <label className="input-label">Full Name</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} className="input-field" required />
            </div>
            <div className="input-group mb-0">
              <label className="input-label">Phone Number</label>
              <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="input-field" placeholder="e.g. 1234567890" />
            </div>
            <div className="input-group mb-0">
              <label className="input-label">Age</label>
              <input type="number" name="age" value={formData.age} onChange={handleChange} className="input-field" placeholder="e.g. 25" />
            </div>
            <div className="input-group mb-0">
              <label className="input-label">Gender</label>
              <select name="gender" value={formData.gender} onChange={handleChange} className="input-field">
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="input-group mb-0 md:col-span-2">
              <label className="input-label">Address</label>
              <textarea name="address" value={formData.address} onChange={handleChange} className="input-field min-h-[100px]" placeholder="Enter your full address"></textarea>
            </div>
          </div>
          
          <div className="flex gap-4 border-t border-gray-100 pt-6">
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" onClick={handleEditToggle} className="btn btn-outline" disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default PatientProfile;
