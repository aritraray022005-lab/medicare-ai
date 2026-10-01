import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { User, Calendar, LogOut, CheckCircle, XCircle, Clock, BarChart3, TrendingUp, Activity, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import DoctorClinicLocation from '../components/DoctorClinicLocation';

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('appointments'); // appointments, analytics, availability, settings
  const [actionLoading, setActionLoading] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  // Appointment Filter & Pagination
  const [appointmentFilter, setAppointmentFilter] = useState('All');
  const [appointmentPage, setAppointmentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Verification state
  const [verifyMode, setVerifyMode] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [message, setMessage] = useState('');

  const ALL_SLOTS = [
    "10:00", "11:00", "12:00", "13:00", "14:00", 
    "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
  ];
  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  const fetchDashboardData = async () => {
    try {
      // Fetch profile
      const profileRes = await axios.get('/api/doctors/profile', {
        withCredentials: true
      });
      if (profileRes.data.status === 'success') {
        setProfile(profileRes.data.user);
        setAvailability(profileRes.data.user.availability || {
          sunday: [], monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: []
        });
      }

      // Fetch appointments
      const appointmentsRes = await axios.get('/api/doctors/appointment', {
        withCredentials: true
      });
      if (appointmentsRes.data.status === 'success') {
        setAppointments(appointmentsRes.data.data);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/doctor/login');
      } else if (err.response?.status === 404 && err.response?.data?.msg === "No appointments found for this doctor.") {
        setAppointments([]);
      } else {
        setError('Failed to load dashboard data.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await axios.post('/api/doctors/auth/logout', {}, { withCredentials: true });
      await refresh();
      navigate('/');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setError('');
    try {
      const response = await axios.delete('/api/doctors/profile', {
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

  const handleUpdateStatus = async (appointmentId, newStatus) => {
    setActionLoading(appointmentId);
    try {
      const response = await axios.patch('/api/doctors/appointment/status', 
        { appointmentId, status: newStatus },
        { withCredentials: true }
      );
      
      if (response.data.status === 'success') {
        // Refresh data
        fetchDashboardData();
      }
    } catch (err) {
      alert(err.response?.data?.msg || err.response?.data?.message || 'Failed to update appointment status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleProfilePictureUpload = async (e) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('profilePicture', file);

    try {
      const response = await axios.patch('/api/doctors/profile/picture', formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.status === 'success') {
        setProfile(prev => ({
          ...prev,
          profilePicture: response.data.data.profilePicture
        }));
        alert('Profile picture updated successfully!');
      }
    } catch (err) {
      alert(err.response?.data?.msg || err.response?.data?.message || 'Failed to update profile picture.');
    }
  };

  const toggleSlot = (day, slot) => {
    if (!availability) return;
    setAvailability(prev => {
      const daySlots = prev[day] || [];
      if (daySlots.includes(slot)) {
        return { ...prev, [day]: daySlots.filter(s => s !== slot) };
      } else {
        // Keep sorted
        const newSlots = [...daySlots, slot].sort((a, b) => parseInt(a) - parseInt(b));
        return { ...prev, [day]: newSlots };
      }
    });
  };

  const handleSaveAvailability = async () => {
    setAvailabilityLoading(true);
    try {
      const response = await axios.patch('/api/doctors/profile/availability', availability, {
        withCredentials: true
      });
      if (response.data.status === 'success') {
        alert('Availability updated successfully!');
      }
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to update availability.');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleSendVerifyOTP = async () => {
    setVerifyLoading(true);
    setMessage('');
    setError('');
    
    try {
      const response = await axios.post('/api/doctors/auth/send-otp', {}, {
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
      const response = await axios.post('/api/doctors/auth/verify-otp', { OTP: otp }, {
        withCredentials: true
      });
      if (response.status === 200 || response.data.status === 'success') {
        setMessage('Email verified successfully!');
        setVerifyMode(false);
        fetchDashboardData(); // refresh profile
      }
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || 'Invalid or expired OTP.');
    } finally {
      setVerifyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-primary text-xl font-medium flex items-center gap-2">
          <Activity className="animate-spin" /> Loading Dashboard...
        </div>
      </div>
    );
  }

  // Analytics Calculations
  const totalAppointments = appointments.length;
  const pendingAppointments = appointments.filter(a => a.status === 'Pending').length;
  const confirmedAppointments = appointments.filter(a => a.status === 'confirmed' || a.status === 'Confirmed').length;
  const cancelledAppointments = appointments.filter(a => a.status === 'cancelled' || a.status === 'Cancelled').length;
  const expiredAppointments = appointments.filter(a => a.status === 'Expired').length;

  return (
    <div className="container py-8 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0">
          <div className="card sticky top-24">
            <div className="flex flex-col items-center mb-6">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-primary/20 flex items-center justify-center mb-4 shadow-md">
                {profile?.profilePicture ? (
                  <img 
                    src={profile.profilePicture.startsWith('http') ? profile.profilePicture : `/${profile.profilePicture.replace(/\\/g, '/')}`} 
                    alt="Doctor Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-primary text-white flex items-center justify-center text-3xl font-bold">
                    {profile?.name?.charAt(0) || 'D'}
                  </div>
                )}
              </div>
              <h3 className="text-lg font-bold text-center">Dr. {profile?.name}</h3>
              <p className="text-muted text-sm text-center">{profile?.specialization || 'Doctor'}</p>
              {profile?.isVerifiedByAdmin ? (
                <span className="mt-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                  <CheckCircle size={12} /> Verified
                </span>
              ) : (
                <span className="mt-2 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                  <Clock size={12} /> Pending Verification
                </span>
              )}
            </div>
            
            <nav className="flex flex-col gap-2">
              <button 
                onClick={() => setActiveTab('appointments')}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'appointments' ? 'bg-light text-primary font-medium' : 'hover:bg-gray-50 text-muted'}`}
              >
                <Calendar size={20} /> Appointments
              </button>
              <button 
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'analytics' ? 'bg-light text-primary font-medium' : 'hover:bg-gray-50 text-muted'}`}
              >
                <BarChart3 size={20} /> Analytics
              </button>
              <button 
                onClick={() => setActiveTab('availability')}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'availability' ? 'bg-light text-primary font-medium' : 'hover:bg-gray-50 text-muted'}`}
              >
                <Clock size={20} /> Availability
              </button>
              <button 
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-light text-primary font-medium' : 'hover:bg-gray-50 text-muted'}`}
              >
                <User size={20} /> Settings
              </button>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-red-50 text-red-600 mt-4 border border-transparent hover:border-red-100"
              >
                <LogOut size={20} /> Logout
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg shadow-sm mb-6 flex items-center gap-2">
              <XCircle size={20} /> {error}
            </div>
          )}
          
          {message && (
            <div className="bg-green-50 text-green-700 p-4 rounded-lg shadow-sm mb-6 flex items-center gap-2">
              <CheckCircle size={20} /> {message}
            </div>
          )}

          {(!profile?.isEmailVerified || !profile?.isVerifiedByAdmin) && activeTab !== 'settings' ? (
            <div className="card min-h-[500px] animate-fade-in flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-white to-blue-50 border-2 border-primary/10">
              <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <CheckCircle size={48} className="text-primary" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome to Medicare AI!</h2>
              <p className="text-lg text-gray-600 mb-8 max-w-lg">
                We're excited to have you on board. To ensure the highest quality of care, all doctor accounts must be verified before you can manage appointments.
              </p>
              
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 w-full max-w-md mb-8 space-y-4 text-left">
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${profile?.isEmailVerified ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    {profile?.isEmailVerified ? <CheckCircle size={16} /> : <span className="font-bold">1</span>}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-800">Email Verification</h4>
                    <p className="text-sm text-gray-500">{profile?.isEmailVerified ? 'Your email is verified.' : 'Please verify your email address.'}</p>
                  </div>
                  {!profile?.isEmailVerified && (
                    <button onClick={handleSendVerifyOTP} disabled={verifyLoading} className="btn btn-primary text-sm px-4 py-1.5 h-auto">
                      {verifyLoading ? 'Sending...' : 'Verify Now'}
                    </button>
                  )}
                </div>
                
                {verifyMode && !profile?.isEmailVerified && (
                  <form onSubmit={handleVerifyOTP} className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Enter OTP sent to your email</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={otp} 
                        onChange={(e) => setOtp(e.target.value)} 
                        className="input-field py-2" 
                        placeholder="6-digit code"
                        required 
                      />
                      <button type="submit" disabled={verifyLoading} className="btn btn-primary h-auto">
                        Submit
                      </button>
                    </div>
                  </form>
                )}

                <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${profile?.isVerifiedByAdmin ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    {profile?.isVerifiedByAdmin ? <CheckCircle size={16} /> : <span className="font-bold">2</span>}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-800">Admin Approval</h4>
                    <p className="text-sm text-gray-500">{profile?.isVerifiedByAdmin ? 'Your account is approved.' : 'Waiting for admin to review your profile.'}</p>
                  </div>
                </div>
              </div>
              
              <div className="text-gray-500">
                <p className="mb-2">Need help or have questions?</p>
                <a href="mailto:medicare.ai.service@gmail.com" className="inline-flex items-center gap-2 bg-blue-50 text-primary hover:bg-blue-100 px-6 py-3 rounded-full font-medium transition-colors border border-blue-200 shadow-sm">
                  Contact Medicare AI Team
                </a>
              </div>
            </div>
          ) : activeTab === 'appointments' && (
            <div className="card min-h-[500px] animate-fade-in flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-gray-100 gap-4">
                <h2 className="text-2xl font-bold text-gray-800">Appointment Management</h2>
                
                <div className="flex items-center gap-2">
                  <Filter size={18} className="text-gray-400" />
                  <select 
                    className="input-field py-2 text-sm w-40"
                    value={appointmentFilter}
                    onChange={(e) => {
                      setAppointmentFilter(e.target.value);
                      setAppointmentPage(1);
                    }}
                  >
                    <option value="All">All Appointments</option>
                    <option value="Pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
              </div>
              
              {(() => {
                const filteredAppointments = appointments.slice().reverse().filter(a => {
                  if (appointmentFilter === 'All') return true;
                  return a.status.toLowerCase() === appointmentFilter.toLowerCase();
                });
                const paginatedAppointments = filteredAppointments.slice((appointmentPage - 1) * ITEMS_PER_PAGE, appointmentPage * ITEMS_PER_PAGE);
                const appointmentTotalPages = Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE) || 1;

                return (
                  <div className="flex flex-col flex-1">
                    {paginatedAppointments.length === 0 ? (
                      <div className="text-center py-12 text-muted flex-1 flex flex-col items-center justify-center">
                        <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                        <p className="text-lg">No {appointmentFilter !== 'All' ? appointmentFilter.toLowerCase() : ''} appointments found.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 flex-1">
                        {paginatedAppointments.map(appointment => (
                          <div key={appointment._id} className="border border-gray-100 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-sm transition-shadow">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-lg">{appointment.patient?.name || 'Unknown Patient'}</h4>
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  appointment.status === 'Pending' ? 'bg-orange-100 text-orange-700' :
                                  (appointment.status === 'confirmed' || appointment.status === 'Confirmed') ? 'bg-green-100 text-green-700' :
                                  appointment.status === 'Expired' ? 'bg-gray-100 text-gray-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                                </span>
                              </div>
                              <div className="text-sm text-muted flex items-center gap-4">
                                <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(appointment.date).toLocaleDateString()}</span>
                                <span className="flex items-center gap-1"><Clock size={14} /> {appointment.time}</span>
                              </div>
                              {appointment.reason && (
                                <p className="text-sm mt-2 text-gray-600"><span className="font-medium text-gray-700">Reason:</span> {appointment.reason}</p>
                              )}
                            </div>
                            
                            {appointment.status === 'Pending' && (
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleUpdateStatus(appointment._id, 'confirmed')}
                                  disabled={actionLoading === appointment._id}
                                  className="btn btn-primary text-sm flex items-center gap-1"
                                >
                                  <CheckCircle size={16} /> {actionLoading === appointment._id ? '...' : 'Accept'}
                                </button>
                                <button 
                                  onClick={() => handleUpdateStatus(appointment._id, 'cancelled')}
                                  disabled={actionLoading === appointment._id}
                                  className="btn btn-outline text-sm text-red-600 hover:bg-red-50 hover:border-red-200 flex items-center gap-1"
                                >
                                  <XCircle size={16} /> {actionLoading === appointment._id ? '...' : 'Reject'}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pagination */}
                    {appointmentTotalPages > 1 && (
                      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                        <span className="text-sm text-gray-500">
                          Showing {(appointmentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(appointmentPage * ITEMS_PER_PAGE, filteredAppointments.length)} of {filteredAppointments.length}
                        </span>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setAppointmentPage(p => Math.max(1, p - 1))}
                            disabled={appointmentPage === 1}
                            className="p-1.5 rounded-md border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <span className="text-sm font-medium px-2">{appointmentPage} / {appointmentTotalPages}</span>
                          <button 
                            onClick={() => setAppointmentPage(p => Math.min(appointmentTotalPages, p + 1))}
                            disabled={appointmentPage === appointmentTotalPages}
                            className="p-1.5 rounded-md border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="card min-h-[500px] animate-fade-in">
              <h2 className="text-2xl font-bold mb-6 pb-4 border-b border-gray-100">Performance Analytics</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <div className="bg-light p-6 rounded-xl border border-gray-100 flex flex-col items-center justify-center">
                  <div className="text-primary mb-2"><BarChart3 size={32} /></div>
                  <div className="text-3xl font-bold text-gray-800">{totalAppointments}</div>
                  <div className="text-sm text-muted font-medium mt-1">Total Appointments</div>
                </div>
                <div className="bg-green-50 p-6 rounded-xl border border-green-100 flex flex-col items-center justify-center">
                  <div className="text-green-600 mb-2"><CheckCircle size={32} /></div>
                  <div className="text-3xl font-bold text-green-700">{confirmedAppointments}</div>
                  <div className="text-sm text-green-600 font-medium mt-1">Confirmed</div>
                </div>
                <div className="bg-orange-50 p-6 rounded-xl border border-orange-100 flex flex-col items-center justify-center">
                  <div className="text-orange-600 mb-2"><Clock size={32} /></div>
                  <div className="text-3xl font-bold text-orange-700">{pendingAppointments}</div>
                  <div className="text-sm text-orange-600 font-medium mt-1">Pending</div>
                </div>
                <div className="bg-red-50 p-6 rounded-xl border border-red-100 flex flex-col items-center justify-center">
                  <div className="text-red-600 mb-2"><XCircle size={32} /></div>
                  <div className="text-3xl font-bold text-red-700">{cancelledAppointments}</div>
                  <div className="text-sm text-red-600 font-medium mt-1">Cancelled</div>
                </div>
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 flex flex-col items-center justify-center">
                  <div className="text-gray-500 mb-2"><Calendar size={32} /></div>
                  <div className="text-3xl font-bold text-gray-600">{expiredAppointments}</div>
                  <div className="text-sm text-gray-500 font-medium mt-1">Expired</div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800">
                  <TrendingUp size={20} className="text-primary" /> Performance Summary
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-600">Acceptance Rate</span>
                      <span className="font-bold text-gray-800">
                        {totalAppointments ? Math.round((confirmedAppointments / totalAppointments) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${totalAppointments ? (confirmedAppointments / totalAppointments) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-600">Rejection Rate</span>
                      <span className="font-bold text-gray-800">
                        {totalAppointments ? Math.round((cancelledAppointments / totalAppointments) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div className="bg-red-500 h-2.5 rounded-full" style={{ width: `${totalAppointments ? (cancelledAppointments / totalAppointments) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted mt-6 text-center">
                  Note: A higher acceptance rate generally indicates better availability and patient satisfaction.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'availability' && (
            <div className="card min-h-[500px] animate-fade-in">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                <h2 className="text-2xl font-bold">Manage Availability</h2>
                <button 
                  onClick={handleSaveAvailability} 
                  disabled={availabilityLoading}
                  className="btn btn-primary"
                >
                  {availabilityLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              <div className="space-y-6">
                {DAYS.map(day => (
                  <div key={day} className="border border-gray-100 rounded-lg p-4">
                    <h3 className="font-bold text-lg capitalize mb-3 text-gray-800">{day}</h3>
                    <div className="flex flex-wrap gap-2">
                      {ALL_SLOTS.map(slot => {
                        const isSelected = availability?.[day]?.includes(slot);
                        return (
                          <button
                            key={slot}
                            onClick={() => toggleSlot(day, slot)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                              isSelected 
                                ? 'bg-primary text-white border-primary shadow-sm' 
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                    {(!availability?.[day] || availability[day].length === 0) && (
                      <p className="text-sm text-red-500 mt-2 font-medium">No slots selected. You are unavailable on this day.</p>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex justify-end">
                <button 
                  onClick={handleSaveAvailability} 
                  disabled={availabilityLoading}
                  className="btn btn-primary"
                >
                  {availabilityLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="card min-h-[500px] animate-fade-in">
              <h2 className="text-2xl font-bold mb-6 pb-4 border-b border-gray-100">Account Settings</h2>
              
              <div className="mb-8">
                <h3 className="font-bold text-gray-800 mb-4">Profile Picture</h3>
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-primary/20 flex-shrink-0">
                    <img 
                      src={profile?.profilePicture ? 
                        (profile.profilePicture.startsWith('http') ? profile.profilePicture : `/${profile.profilePicture.replace(/\\/g, '/')}`) 
                        : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"} 
                      alt="Doctor Profile" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <label className="btn btn-outline cursor-pointer mb-2 inline-block">
                      Change Picture
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleProfilePictureUpload}
                      />
                    </label>
                    <p className="text-xs text-muted">Square image, max 5MB (JPG, PNG)</p>
                  </div>
                </div>
              </div>
              
              <DoctorClinicLocation profile={profile} onUpdate={fetchDashboardData} />

              <div className="mt-8 pt-6 border-t border-red-100">
                <h3 className="text-red-600 font-bold mb-2">Danger Zone</h3>
                {showDeleteConfirm ? (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="text-red-800 font-medium mb-3">Are you sure you want to delete your doctor account? This action cannot be undone.</p>
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
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
