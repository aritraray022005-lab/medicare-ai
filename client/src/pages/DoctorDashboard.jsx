import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { User, Calendar, LogOut, CheckCircle, XCircle, Clock, BarChart3, TrendingUp, Activity, ChevronLeft, ChevronRight, Filter, Building2, Send, Undo2, DoorOpen, AlertTriangle, Layers, CalendarDays, RefreshCw } from 'lucide-react';
import DoctorClinicLocation from '../components/DoctorClinicLocation';

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('appointments'); // appointments, analytics, availability, affiliations, rooms, settings
  const [actionLoading, setActionLoading] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  // Affiliations state (Phase 4)
  const [affiliations, setAffiliations] = useState([]);
  const [organizationsList, setOrganizationsList] = useState([]);
  const [affLoading, setAffLoading] = useState(false);
  const [affSearch, setAffSearch] = useState('');
  const [affStatusFilter, setAffStatusFilter] = useState('all');
  const [affActionLoading, setAffActionLoading] = useState(null);
  const [affMessage, setAffMessage] = useState('');
  const [affError, setAffError] = useState('');

  // Facility Rooms state (Phase 5)
  const [docRooms, setDocRooms] = useState([]);
  const [docSlots, setDocSlots] = useState([]);
  const [docRoomRequests, setDocRoomRequests] = useState([]);
  const [docRoomBookings, setDocRoomBookings] = useState([]);
  const [docRoomLoading, setDocRoomLoading] = useState(false);
  const [docRoomActionLoading, setDocRoomActionLoading] = useState(null);
  const [docRoomSubTab, setDocRoomSubTab] = useState('slots'); // 'slots', 'requests', 'bookings'
  const [docRoomOrgFilter, setDocRoomOrgFilter] = useState('all');
  const [docRoomMessage, setDocRoomMessage] = useState('');
  const [docRoomError, setDocRoomError] = useState('');
  const [requestModal, setRequestModal] = useState({ open: false, slot: null, notes: '' });
  const [cancelBookingModal, setCancelBookingModal] = useState({ open: false, bookingId: null, reason: '' });

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

  const fetchDoctorAffiliations = async () => {
    try {
      setAffLoading(true);
      const res = await axios.get('/api/doctors/affiliations', { withCredentials: true });
      if (res.data.status === 'success') {
        setAffiliations(res.data.affiliations);
      }
    } catch (err) {
      console.error('Failed to load affiliations', err);
    } finally {
      setAffLoading(false);
    }
  };

  const fetchVerifiedOrganizations = async (searchTerm = '') => {
    try {
      const res = await axios.get(`/api/doctors/organizations?search=${encodeURIComponent(searchTerm)}`, { withCredentials: true });
      if (res.data.status === 'success') {
        setOrganizationsList(res.data.organizations);
      }
    } catch (err) {
      console.error('Failed to load organizations', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [navigate]);

  useEffect(() => {
    if (activeTab === 'affiliations') {
      fetchDoctorAffiliations();
      fetchVerifiedOrganizations(affSearch);
    }
  }, [activeTab]);

  const handleRequestAffiliation = async (organizationId) => {
    setAffActionLoading(organizationId);
    setAffError('');
    setAffMessage('');
    try {
      const res = await axios.post('/api/doctors/affiliations', { organizationId }, { withCredentials: true });
      if (res.data.status === 'success') {
        setAffMessage('Affiliation request submitted successfully!');
        fetchDoctorAffiliations();
      }
    } catch (err) {
      setAffError(err.response?.data?.msg || err.response?.data?.message || 'Failed to submit affiliation request.');
    } finally {
      setAffActionLoading(null);
    }
  };

  const handleWithdrawAffiliation = async (affiliationId) => {
    setAffActionLoading(affiliationId);
    setAffError('');
    setAffMessage('');
    try {
      const res = await axios.patch(`/api/doctors/affiliations/${affiliationId}/withdraw`, {}, { withCredentials: true });
      if (res.data.status === 'success') {
        setAffMessage('Affiliation request withdrawn.');
        fetchDoctorAffiliations();
      }
    } catch (err) {
      setAffError(err.response?.data?.msg || 'Failed to withdraw affiliation.');
    } finally {
      setAffActionLoading(null);
    }
  };

  const fetchDoctorFacilityData = async () => {
    try {
      setDocRoomLoading(true);
      setDocRoomError('');
      const [slotsRes, requestsRes, bookingsRes, roomsRes] = await Promise.all([
        axios.get('/api/doctors/rooms/slots', { withCredentials: true }),
        axios.get('/api/doctors/rooms/requests', { withCredentials: true }),
        axios.get('/api/doctors/rooms/bookings', { withCredentials: true }),
        axios.get('/api/doctors/rooms/available', { withCredentials: true })
      ]);
      if (slotsRes.data.status === 'success') {
        setDocSlots(slotsRes.data.slots || []);
      }
      if (requestsRes.data.status === 'success') {
        setDocRoomRequests(requestsRes.data.requests || []);
      }
      if (bookingsRes.data.status === 'success') {
        setDocRoomBookings(bookingsRes.data.bookings || []);
      }
      if (roomsRes.data.status === 'success') {
        setDocRooms(roomsRes.data.rooms || []);
      }
    } catch (err) {
      console.error('Failed to load facility room data', err);
      setDocRoomError(err.response?.data?.msg || err.response?.data?.message || 'Failed to load room data.');
    } finally {
      setDocRoomLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'rooms') {
      fetchDoctorFacilityData();
    }
  }, [activeTab]);

  const handleOpenRequestModal = (slot) => {
    setDocRoomError('');
    setDocRoomMessage('');
    setRequestModal({ open: true, slot, notes: '' });
  };

  const handleSubmitRoomRequest = async (e) => {
    e.preventDefault();
    if (!requestModal.slot) return;
    setDocRoomActionLoading(requestModal.slot._id);
    setDocRoomError('');
    setDocRoomMessage('');
    try {
      const res = await axios.post('/api/doctors/rooms/requests', {
        roomSlotId: requestModal.slot._id,
        notes: requestModal.notes
      }, { withCredentials: true });

      if (res.data.status === 'success') {
        setDocRoomMessage(`Room request successfully queued! Server sequence #${res.data.request?.sequenceNumber || '1'} (Gen ${res.data.request?.queueGeneration || '1'}).`);
        setRequestModal({ open: false, slot: null, notes: '' });
        fetchDoctorFacilityData();
      }
    } catch (err) {
      setDocRoomError(err.response?.data?.msg || err.response?.data?.message || 'Failed to request room slot.');
    } finally {
      setDocRoomActionLoading(null);
    }
  };

  const handleWithdrawRoomRequest = async (requestId) => {
    setDocRoomActionLoading(requestId);
    setDocRoomError('');
    setDocRoomMessage('');
    try {
      const res = await axios.patch(`/api/doctors/rooms/requests/${requestId}/withdraw`, {}, { withCredentials: true });
      if (res.data.status === 'success') {
        setDocRoomMessage('Room booking request successfully withdrawn.');
        fetchDoctorFacilityData();
      }
    } catch (err) {
      setDocRoomError(err.response?.data?.msg || err.response?.data?.message || 'Failed to withdraw request.');
    } finally {
      setDocRoomActionLoading(null);
    }
  };

  const handleOpenCancelBookingModal = (bookingId) => {
    setDocRoomError('');
    setDocRoomMessage('');
    setCancelBookingModal({ open: true, bookingId, reason: '' });
  };

  const handleConfirmCancelBooking = async (e) => {
    e.preventDefault();
    if (!cancelBookingModal.bookingId) return;
    if (!cancelBookingModal.reason.trim() || cancelBookingModal.reason.trim().length < 5) {
      setDocRoomError('Please provide a cancellation reason with at least 5 characters.');
      return;
    }
    setDocRoomActionLoading(cancelBookingModal.bookingId);
    setDocRoomError('');
    setDocRoomMessage('');
    try {
      const res = await axios.patch(`/api/doctors/rooms/bookings/${cancelBookingModal.bookingId}/cancel`, {
        reason: cancelBookingModal.reason
      }, { withCredentials: true });

      if (res.data.status === 'success') {
        setDocRoomMessage('Room reservation cancelled successfully. Slot has been safely reopened.');
        setCancelBookingModal({ open: false, bookingId: null, reason: '' });
        fetchDoctorFacilityData();
      }
    } catch (err) {
      setDocRoomError(err.response?.data?.msg || err.response?.data?.message || 'Failed to cancel reservation.');
    } finally {
      setDocRoomActionLoading(null);
    }
  };

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
                onClick={() => setActiveTab('affiliations')}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'affiliations' ? 'bg-light text-primary font-medium' : 'hover:bg-gray-50 text-muted'}`}
              >
                <Building2 size={20} /> Affiliations
              </button>
              <button
                onClick={() => setActiveTab('rooms')}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'rooms' ? 'bg-light text-primary font-medium' : 'hover:bg-gray-50 text-muted'}`}
              >
                <DoorOpen size={20} /> Facility Rooms
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

          {(!profile?.isEmailVerified || (!profile?.isVerifiedByAdmin && activeTab !== 'affiliations' && activeTab !== 'rooms' && activeTab !== 'appointments')) && activeTab !== 'settings' ? (
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

              {!profile?.isVerifiedByAdmin && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3.5 rounded-lg mb-5 text-xs flex items-center gap-2">
                  <Building2 size={16} className="text-primary shrink-0" />
                  <span>
                    <strong>Affiliated Facility Consultations:</strong> You can manage consultations booked through your approved healthcare organizations. Independent private clinic appointments require site-wide admin verification.
                  </span>
                </div>
              )}
              
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
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <h4 className="font-semibold text-lg text-gray-900">{appointment.patient?.name || 'Patient'}</h4>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  appointment.status === 'Pending' ? 'bg-orange-100 text-orange-700' :
                                  (appointment.status === 'confirmed' || appointment.status === 'Confirmed') ? 'bg-green-100 text-green-700' :
                                  appointment.status === 'Expired' ? 'bg-gray-100 text-gray-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  appointment.bookingType === 'Organization'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {appointment.bookingType === 'Organization' ? 'Hospital Consultation' : 'Independent Clinic'}
                                </span>
                              </div>

                              {appointment.bookingType === 'Organization' && (
                                <p className="text-xs text-purple-700 font-medium flex items-center gap-1">
                                  <Building2 size={13} />
                                  {appointment.organization?.name || 'Facility'} • Room {appointment.room?.roomNumber || 'Assigned Room'}
                                  {appointment.room?.floor !== undefined ? ` (Floor ${appointment.room.floor})` : ''}
                                </p>
                              )}

                              <div className="text-sm text-muted flex items-center gap-4">
                                <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(appointment.date).toLocaleDateString()}</span>
                                <span className="flex items-center gap-1"><Clock size={14} /> {appointment.time}</span>
                              </div>
                              {appointment.reason && (
                                <p className="text-sm mt-1 text-gray-600"><span className="font-medium text-gray-700">Reason:</span> {appointment.reason}</p>
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

          {activeTab === 'affiliations' && (
            <div className="space-y-8 animate-fade-in">
              {affError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg shadow-sm border border-red-200 flex items-center justify-between">
                  <span>{affError}</span>
                  <button onClick={() => setAffError('')} className="text-red-400 hover:text-red-600">&times;</button>
                </div>
              )}
              {affMessage && (
                <div className="bg-green-50 text-green-700 p-4 rounded-lg shadow-sm border border-green-200 flex items-center justify-between">
                  <span>{affMessage}</span>
                  <button onClick={() => setAffMessage('')} className="text-green-500 hover:text-green-700">&times;</button>
                </div>
              )}

              {/* Informational Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <Building2 size={24} className="text-primary mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Doctor-Organization Affiliations</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      Email-verified doctors can partner with verified healthcare organizations. Once affiliated, you can utilize facility consultation rooms and attend scheduled appointments without requiring independent doctor admin verification.
                    </p>
                  </div>
                </div>
              </div>

              {/* My Affiliations Section */}
              <div className="card">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 pb-4 border-b border-gray-100">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">My Affiliations</h2>
                    <p className="text-sm text-muted">Manage your active affiliations and pending requests</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted font-medium">Filter:</span>
                    <select
                      value={affStatusFilter}
                      onChange={(e) => setAffStatusFilter(e.target.value)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="all">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Revoked">Revoked</option>
                      <option value="Withdrawn">Withdrawn</option>
                    </select>
                  </div>
                </div>

                {affLoading ? (
                  <div className="text-center py-12 text-muted">Loading affiliations...</div>
                ) : affiliations.filter(a => affStatusFilter === 'all' || a.status === affStatusFilter).length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-xl">
                    <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No affiliations found</p>
                    <p className="text-xs text-muted mt-1">Explore verified healthcare partners below to submit your first request.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {affiliations
                      .filter(a => affStatusFilter === 'all' || a.status === affStatusFilter)
                      .map((aff) => {
                        const org = aff.organization || {};
                        const statusColors = {
                          Pending: 'bg-amber-100 text-amber-800 border-amber-200',
                          Approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                          Rejected: 'bg-rose-100 text-rose-800 border-rose-200',
                          Revoked: 'bg-gray-100 text-gray-700 border-gray-200',
                          Withdrawn: 'bg-slate-100 text-slate-600 border-slate-200'
                        };
                        return (
                          <div key={aff._id} className="border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow bg-white flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start gap-2 mb-2">
                                <h4 className="font-bold text-gray-900 text-base">{org.name || 'Healthcare Facility'}</h4>
                                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${statusColors[aff.status] || 'bg-gray-100 text-gray-600'}`}>
                                  {aff.status}
                                </span>
                              </div>
                              <p className="text-xs text-muted mb-1">
                                <span className="font-medium text-gray-700">{org.type || 'Facility'}</span>
                                {org.address?.city && ` • ${org.address.city}`}
                                {org.registrationNumber && ` • Reg: ${org.registrationNumber}`}
                              </p>
                              <div className="text-xs text-gray-500 space-y-1 mt-3 pt-3 border-t border-gray-50">
                                <div>Requested: {new Date(aff.createdAt).toLocaleDateString()}</div>
                                {aff.approvedAt && <div className="text-emerald-700 font-medium">Approved: {new Date(aff.approvedAt).toLocaleDateString()}</div>}
                                {aff.rejectionReason && <div className="text-rose-600">Rejection note: {aff.rejectionReason}</div>}
                                {aff.revocationReason && <div className="text-gray-600">Revocation note: {aff.revocationReason}</div>}
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                              {aff.status === 'Pending' && (
                                <button
                                  onClick={() => handleWithdrawAffiliation(aff._id)}
                                  disabled={affActionLoading === aff._id}
                                  className="text-xs text-rose-600 hover:text-rose-800 font-medium px-3 py-1.5 rounded border border-rose-200 hover:bg-rose-50 transition-colors flex items-center gap-1.5"
                                >
                                  <Undo2 size={13} /> {affActionLoading === aff._id ? 'Withdrawing...' : 'Withdraw Request'}
                                </button>
                              )}
                              {['Rejected', 'Revoked', 'Withdrawn'].includes(aff.status) && (
                                <button
                                  onClick={() => handleRequestAffiliation(org._id)}
                                  disabled={affActionLoading === org._id}
                                  className="text-xs text-primary hover:text-blue-700 font-medium px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-50 transition-colors flex items-center gap-1.5"
                                >
                                  <Send size={13} /> {affActionLoading === org._id ? 'Submitting...' : 'Re-apply'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Explore Verified Organizations Directory */}
              <div className="card">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 pb-4 border-b border-gray-100">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Explore Verified Healthcare Partners</h2>
                    <p className="text-sm text-muted">Submit affiliation requests to approved institutions</p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="Search by name, city..."
                      value={affSearch}
                      onChange={(e) => {
                        setAffSearch(e.target.value);
                        fetchVerifiedOrganizations(e.target.value);
                      }}
                      className="w-full px-3 py-2 pl-9 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <Filter size={14} className="absolute left-3 top-3 text-muted" />
                  </div>
                </div>

                {organizationsList.length === 0 ? (
                  <div className="text-center py-12 text-muted">No verified healthcare organizations found.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {organizationsList.map((org) => {
                      const existingAff = affiliations.find(
                        a => a.organization?._id === org._id || a.organization === org._id
                      );
                      const isActive = existingAff && ['Pending', 'Approved'].includes(existingAff.status);
                      return (
                        <div key={org._id} className="border border-gray-200 rounded-xl p-5 bg-white hover:border-primary/40 transition-colors flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h4 className="font-bold text-gray-900 text-base">{org.name}</h4>
                              <span className="text-xs bg-blue-50 text-primary px-2 py-0.5 rounded font-medium">{org.type}</span>
                            </div>
                            <p className="text-xs text-muted mb-2">
                              {org.address?.city && `${org.address.city}, `}{org.address?.state}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">Reg: {org.registrationNumber}</p>
                            {org.timezone && <p className="text-xs text-gray-400 mt-1">TZ: {org.timezone}</p>}
                          </div>

                          <div className="mt-4 pt-3 border-t border-gray-100">
                            {isActive ? (
                              <div className="text-center py-1.5 text-xs font-semibold rounded bg-gray-50 text-gray-600 border border-gray-200">
                                {existingAff.status === 'Approved' ? '✓ Affiliated Partner' : '⏳ Affiliation Pending'}
                              </div>
                            ) : (
                              <button
                                onClick={() => handleRequestAffiliation(org._id)}
                                disabled={affActionLoading === org._id}
                                className="w-full btn btn-primary text-xs py-2 flex items-center justify-center gap-1.5"
                              >
                                <Send size={13} /> {affActionLoading === org._id ? 'Submitting...' : 'Request Affiliation'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'rooms' && (
            <div className="space-y-8 animate-fade-in">
              {docRoomError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-lg shadow-sm border border-red-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-500 shrink-0" />
                    <span>{docRoomError}</span>
                  </div>
                  <button onClick={() => setDocRoomError('')} className="text-red-400 hover:text-red-600">&times;</button>
                </div>
              )}
              {docRoomMessage && (
                <div className="bg-green-50 text-green-700 p-4 rounded-lg shadow-sm border border-green-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={18} className="text-green-500 shrink-0" />
                    <span>{docRoomMessage}</span>
                  </div>
                  <button onClick={() => setDocRoomMessage('')} className="text-green-500 hover:text-green-700">&times;</button>
                </div>
              )}

              {/* Informational Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <DoorOpen size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">Facility Room Reservations & FCFS Queue</h3>
                      <p className="text-sm text-gray-700 leading-relaxed mt-0.5">
                        Browse available consultation rooms from your approved partner organizations. Requests are allocated using server-controlled First-Come-First-Served (FCFS) sequencing.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={fetchDoctorFacilityData}
                    disabled={docRoomLoading}
                    className="btn btn-outline text-xs py-2 px-3 flex items-center gap-1.5 shrink-0 bg-white"
                  >
                    <RefreshCw size={13} className={docRoomLoading ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Sub-Navigation Tabs */}
              <div className="flex border-b border-gray-200 gap-4">
                <button
                  onClick={() => setDocRoomSubTab('slots')}
                  className={`pb-3 font-semibold text-sm transition-colors relative flex items-center gap-2 ${
                    docRoomSubTab === 'slots' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <CalendarDays size={16} />
                  Available Slots
                  <span className="bg-blue-100 text-primary text-xs px-2 py-0.5 rounded-full font-bold">
                    {docSlots.length}
                  </span>
                </button>
                <button
                  onClick={() => setDocRoomSubTab('requests')}
                  className={`pb-3 font-semibold text-sm transition-colors relative flex items-center gap-2 ${
                    docRoomSubTab === 'requests' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Clock size={16} />
                  My Queue Requests
                  <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full font-bold">
                    {docRoomRequests.length}
                  </span>
                </button>
                <button
                  onClick={() => setDocRoomSubTab('bookings')}
                  className={`pb-3 font-semibold text-sm transition-colors relative flex items-center gap-2 ${
                    docRoomSubTab === 'bookings' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <CheckCircle size={16} />
                  Confirmed Reservations
                  <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-bold">
                    {docRoomBookings.filter(b => b.status === 'Active').length}
                  </span>
                </button>
              </div>

              {/* TAB 1: AVAILABLE SLOTS */}
              {docRoomSubTab === 'slots' && (
                <div className="card">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 pb-4 border-b border-gray-100">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Available Facility Time Slots</h2>
                      <p className="text-sm text-muted">Select an open slot from an approved healthcare facility to join the allocation queue</p>
                    </div>
                    {/* Facility Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted font-medium">Facility:</span>
                      <select
                        value={docRoomOrgFilter}
                        onChange={(e) => setDocRoomOrgFilter(e.target.value)}
                        className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="all">All Affiliated Facilities</option>
                        {Array.from(new Set(docSlots.map(s => s.organization?._id || s.organization))).map(orgId => {
                          const orgSlot = docSlots.find(s => (s.organization?._id || s.organization) === orgId);
                          return (
                            <option key={orgId} value={orgId}>
                              {orgSlot?.organization?.name || 'Facility'}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {docRoomLoading ? (
                    <div className="text-center py-12 text-muted">
                      <RefreshCw className="animate-spin mx-auto mb-2 text-primary" size={24} />
                      Loading facility availability...
                    </div>
                  ) : docSlots.filter(s => docRoomOrgFilter === 'all' || (s.organization?._id || s.organization) === docRoomOrgFilter).length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-xl">
                      <DoorOpen size={40} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500 font-medium">No room slots currently available</p>
                      <p className="text-xs text-muted mt-1">Check back later or ensure you have approved affiliations with healthcare organizations.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {docSlots
                        .filter(s => docRoomOrgFilter === 'all' || (s.organization?._id || s.organization) === docRoomOrgFilter)
                        .map(slot => {
                          const org = slot.organization || {};
                          const room = slot.room || {};
                          const hasQueued = docRoomRequests.some(
                            r => (r.roomSlot?._id === slot._id || r.roomSlot === slot._id) && (r.status === 'PENDING' || r.status === 'QUEUED')
                          );
                          const hasAllocated = docRoomRequests.some(
                            r => (r.roomSlot?._id === slot._id || r.roomSlot === slot._id) && r.status === 'ALLOCATED'
                          );

                          return (
                            <div key={slot._id} className="border border-gray-200 rounded-xl p-5 bg-white hover:border-primary/40 transition-colors flex flex-col justify-between shadow-sm">
                              <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div>
                                    <h4 className="font-bold text-gray-900 text-base">{org.name || 'Healthcare Facility'}</h4>
                                    <span className="text-xs text-muted">{org.type || 'Facility'}</span>
                                  </div>
                                  <span className="text-xs px-2 py-0.5 rounded font-semibold bg-blue-50 text-primary border border-blue-100">
                                    {room.roomNumber ? `Room ${room.roomNumber}` : 'Consultation Room'}
                                  </span>
                                </div>

                                <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-1.5 text-xs text-gray-700">
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-500">Date:</span>
                                    <span className="font-medium text-gray-900">{new Date(slot.startTime).toLocaleDateString()}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-500">Time Interval:</span>
                                    <span className="font-bold text-gray-900">
                                      {slot.localStartTime || new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {slot.localEndTime || new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-500">Timezone:</span>
                                    <span className="font-mono text-gray-600">{slot.timezone || org.timezone || 'UTC'}</span>
                                  </div>
                                  <div className="flex items-center justify-between border-t border-gray-200/60 pt-1.5">
                                    <span className="text-gray-500">Queue Depth:</span>
                                    <span className="font-mono font-bold text-amber-700">
                                      {slot.queueSequenceCounter || 0} waiting (Gen {slot.queueGeneration || 1})
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 pt-3 border-t border-gray-100">
                                {hasAllocated ? (
                                  <div className="text-center py-2 text-xs font-semibold rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center gap-1.5">
                                    <CheckCircle size={13} /> Reserved by You
                                  </div>
                                ) : hasQueued ? (
                                  <div className="text-center py-2 text-xs font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center gap-1.5">
                                    <Clock size={13} /> In FCFS Queue
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleOpenRequestModal(slot)}
                                    disabled={docRoomActionLoading === slot._id}
                                    className="w-full btn btn-primary text-xs py-2 flex items-center justify-center gap-1.5"
                                  >
                                    <Send size={13} /> Request Room Time
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: MY QUEUE REQUESTS */}
              {docRoomSubTab === 'requests' && (
                <div className="card">
                  <div className="mb-6 pb-4 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">My FCFS Queue Requests</h2>
                    <p className="text-sm text-muted">Strict First-Come-First-Served allocation queue status and sequence records</p>
                  </div>

                  {docRoomLoading ? (
                    <div className="text-center py-12 text-muted">Loading queue requests...</div>
                  ) : docRoomRequests.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-xl">
                      <Clock size={40} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500 font-medium">No queue requests submitted yet</p>
                      <p className="text-xs text-muted mt-1">Browse available slots to submit your first room reservation request.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b border-gray-200">
                          <tr>
                            <th className="py-3 px-4">Queue Sequence</th>
                            <th className="py-3 px-4">Facility & Room</th>
                            <th className="py-3 px-4">Scheduled Interval</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Submitted At</th>
                            <th className="py-3 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {docRoomRequests.map(req => {
                            const org = req.organization || {};
                            const room = req.room || {};
                            const slot = req.roomSlot || {};
                            const statusStyles = {
                              PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
                              QUEUED: 'bg-amber-100 text-amber-800 border-amber-200',
                              ALLOCATED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                              WITHDRAWN: 'bg-slate-100 text-slate-700 border-slate-200',
                              CANCELLED: 'bg-gray-100 text-gray-600 border-gray-200',
                              REJECTED_CONFLICT: 'bg-rose-100 text-rose-800 border-rose-200',
                              REJECTED_SUPERSEDED: 'bg-rose-100 text-rose-800 border-rose-200',
                              REJECTED_STALE: 'bg-rose-100 text-rose-800 border-rose-200',
                              REJECTED_DOC_INELIGIBLE: 'bg-rose-100 text-rose-800 border-rose-200',
                              REJECTED_DOCTOR_INELIGIBLE: 'bg-rose-100 text-rose-800 border-rose-200',
                              REJECTED_ORG_SUSPENDED: 'bg-rose-100 text-rose-800 border-rose-200',
                              REJECTED_UNAFFILIATED: 'bg-rose-100 text-rose-800 border-rose-200',
                              REJECTED_INVALID: 'bg-rose-100 text-rose-800 border-rose-200',
                              REJECTED_ROOM_MAINTENANCE: 'bg-rose-100 text-rose-800 border-rose-200',
                              REJECTED_SCHEDULE_CONFLICT: 'bg-rose-100 text-rose-800 border-rose-200',
                              REJECTED_EXPIRED: 'bg-gray-100 text-gray-600 border-gray-200'
                            };

                            return (
                              <tr key={req._id} className="hover:bg-gray-50 transition-colors">
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold bg-blue-100 text-primary px-2 py-0.5 rounded text-xs">
                                      #{req.sequenceNumber}
                                    </span>
                                    <span className="font-mono text-gray-500 text-xs">
                                      (Gen {req.queueGeneration})
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-semibold text-gray-900">{org.name || 'Healthcare Facility'}</div>
                                  <div className="text-xs text-muted">{room.roomNumber ? `Room ${room.roomNumber}` : 'Room'} • {room.type || 'Consultation'}</div>
                                </td>
                                <td className="py-3.5 px-4 text-xs text-gray-700">
                                  <div>{new Date(slot.startTime || req.createdAt).toLocaleDateString()}</div>
                                  <div className="font-mono text-gray-500">
                                    {slot.localStartTime || new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {slot.localEndTime || new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${statusStyles[req.status] || 'bg-gray-100 text-gray-600'}`}>
                                    {req.status}
                                  </span>
                                  {req.rejectionReason && (
                                    <div className="text-[11px] text-rose-600 mt-1 max-w-xs">{req.rejectionReason}</div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-xs text-gray-500">
                                  {new Date(req.createdAt).toLocaleString()}
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  {(req.status === 'PENDING' || req.status === 'QUEUED') && (
                                    <button
                                      onClick={() => handleWithdrawRoomRequest(req._id)}
                                      disabled={docRoomActionLoading === req._id}
                                      className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2.5 py-1 rounded border border-rose-200 hover:bg-rose-50 transition-colors inline-flex items-center gap-1"
                                    >
                                      <Undo2 size={12} />
                                      {docRoomActionLoading === req._id ? 'Withdrawing...' : 'Withdraw'}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CONFIRMED RESERVATIONS */}
              {docRoomSubTab === 'bookings' && (
                <div className="card">
                  <div className="mb-6 pb-4 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900">Confirmed Facility Room Reservations</h2>
                    <p className="text-sm text-muted">Active and completed room bookings across affiliated organizations</p>
                  </div>

                  {docRoomLoading ? (
                    <div className="text-center py-12 text-muted">Loading reservations...</div>
                  ) : docRoomBookings.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-xl">
                      <CheckCircle size={40} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500 font-medium">No confirmed room reservations</p>
                      <p className="text-xs text-muted mt-1">Once your queued requests are allocated by the server, your confirmed bookings will appear here.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {docRoomBookings.map(booking => {
                        const org = booking.organization || {};
                        const room = booking.room || {};
                        const isActive = booking.status === 'Active';

                        return (
                          <div key={booking._id} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:shadow transition-shadow flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start gap-2 mb-2">
                                <div>
                                  <h4 className="font-bold text-gray-900 text-base">{org.name || 'Healthcare Facility'}</h4>
                                  <span className="text-xs text-muted">{room.roomNumber ? `Room ${room.roomNumber}` : 'Facility Room'} • {room.type || 'Consultation'}</span>
                                </div>
                                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                                  isActive ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                  booking.status === 'Completed' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                  'bg-gray-100 text-gray-700 border-gray-200'
                                }`}>
                                  {booking.status}
                                </span>
                              </div>

                              <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-1.5 text-xs text-gray-700">
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-500">Date:</span>
                                  <span className="font-medium text-gray-900">{new Date(booking.startTime).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-500">Scheduled Time:</span>
                                  <span className="font-bold text-gray-900">
                                    {new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(booking.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-500">Facility Timezone:</span>
                                  <span className="font-mono text-gray-600">{booking.timezone || 'UTC'}</span>
                                </div>
                                <div className="flex items-center justify-between border-t border-gray-200/60 pt-1.5">
                                  <span className="text-gray-500">Allocated At:</span>
                                  <span className="text-gray-600">{booking.allocatedAt ? new Date(booking.allocatedAt).toLocaleString() : new Date(booking.createdAt).toLocaleString()}</span>
                                </div>
                              </div>

                              {booking.status === 'Cancelled' && (
                                <div className="mt-3 p-2.5 bg-rose-50 border border-rose-100 rounded text-xs text-rose-800">
                                  <div className="font-semibold">Cancelled: {new Date(booking.cancelledAt || booking.updatedAt).toLocaleString()}</div>
                                  <div>Reason: {booking.cancellationReason || 'No reason specified'}</div>
                                  <div className="text-[11px] text-rose-600">By: {booking.cancelledByType || 'User'}</div>
                                </div>
                              )}
                            </div>

                            {isActive && (
                              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                                <button
                                  onClick={() => handleOpenCancelBookingModal(booking._id)}
                                  disabled={docRoomActionLoading === booking._id}
                                  className="text-xs text-rose-600 hover:text-rose-800 font-medium px-3 py-1.5 rounded border border-rose-200 hover:bg-rose-50 transition-colors flex items-center gap-1.5"
                                >
                                  <XCircle size={13} /> Cancel Reservation
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* MODAL 1: REQUEST ROOM SLOT MODAL */}
              {requestModal.open && requestModal.slot && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-up border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Request Room Booking</h3>
                        <p className="text-xs text-muted">Join the server-controlled FCFS queue</p>
                      </div>
                      <button
                        onClick={() => setRequestModal({ open: false, slot: null, notes: '' })}
                        className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                      >
                        &times;
                      </button>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 mb-4 text-xs text-gray-700 space-y-1">
                      <div className="font-bold text-primary text-sm mb-1">
                        {requestModal.slot.organization?.name || 'Healthcare Facility'}
                      </div>
                      <div>Room: {requestModal.slot.room?.roomNumber ? `Room ${requestModal.slot.room.roomNumber}` : 'Consultation Room'}</div>
                      <div>Date: {new Date(requestModal.slot.startTime).toLocaleDateString()}</div>
                      <div>
                        Interval: {requestModal.slot.localStartTime || new Date(requestModal.slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {requestModal.slot.localEndTime || new Date(requestModal.slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({requestModal.slot.timezone || 'UTC'})
                      </div>
                      <div className="pt-1 text-gray-500 font-mono text-[11px]">
                        Queue generation: {requestModal.slot.queueGeneration || 1} • Waiting: {requestModal.slot.queueSequenceCounter || 0}
                      </div>
                    </div>

                    <form onSubmit={handleSubmitRoomRequest} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Notes / Requirements (Optional)
                        </label>
                        <textarea
                          value={requestModal.notes}
                          onChange={(e) => setRequestModal(prev => ({ ...prev, notes: e.target.value }))}
                          rows={3}
                          placeholder="Special equipment or session requirements..."
                          className="w-full text-xs p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 leading-relaxed">
                        <strong>FCFS Guarantee:</strong> Requests are processed in ascending order of server sequence numbers. If an earlier candidate becomes ineligible or withdraws, the next candidate is evaluated immediately.
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setRequestModal({ open: false, slot: null, notes: '' })}
                          className="btn btn-outline text-xs py-2 px-4"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={docRoomActionLoading === requestModal.slot._id}
                          className="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                        >
                          <Send size={13} />
                          {docRoomActionLoading === requestModal.slot._id ? 'Submitting...' : 'Submit to Queue'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* MODAL 2: CANCEL BOOKING MODAL */}
              {cancelBookingModal.open && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-up border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Cancel Room Reservation</h3>
                        <p className="text-xs text-muted">Safely reopen room availability</p>
                      </div>
                      <button
                        onClick={() => setCancelBookingModal({ open: false, bookingId: null, reason: '' })}
                        className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                      >
                        &times;
                      </button>
                    </div>

                    <form onSubmit={handleConfirmCancelBooking} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Cancellation Reason <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          value={cancelBookingModal.reason}
                          onChange={(e) => setCancelBookingModal(prev => ({ ...prev, reason: e.target.value }))}
                          rows={3}
                          required
                          placeholder="Provide a mandatory reason for auditing and facility records (min 5 characters)..."
                          className="w-full text-xs p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-200"
                        />
                        <span className="text-[11px] text-gray-400">Minimum 5 characters required</span>
                      </div>

                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-[11px] text-rose-800 leading-relaxed">
                        <strong>Reopening Policy:</strong> Cancelling this reservation bumps the slot queue generation and safely reopens it. Historical booking records are permanently preserved for auditing.
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setCancelBookingModal({ open: false, bookingId: null, reason: '' })}
                          className="btn btn-outline text-xs py-2 px-4"
                        >
                          Close
                        </button>
                        <button
                          type="submit"
                          disabled={docRoomActionLoading === cancelBookingModal.bookingId}
                          className="btn bg-rose-600 hover:bg-rose-700 text-white text-xs py-2 px-4 border-none flex items-center gap-1.5"
                        >
                          <XCircle size={13} />
                          {docRoomActionLoading === cancelBookingModal.bookingId ? 'Cancelling...' : 'Confirm Cancellation'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
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
