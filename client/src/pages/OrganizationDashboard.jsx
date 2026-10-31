import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Building2, ShieldCheck, Clock, AlertTriangle, CheckCircle, MapPin, Phone, Mail, FileText, Settings, Users, Calendar, LogOut, Edit3, Plus, X, Power, PowerOff, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const OrganizationDashboard = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, rooms, affiliations, settings

  // Profile update state
  const [editing, setEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    timezone: 'Asia/Kolkata'
  });
  const [saving, setSaving] = useState(false);

  // Phase 4: Doctor Affiliations State
  const [affiliations, setAffiliations] = useState([]);
  const [affLoading, setAffLoading] = useState(false);
  const [affSubTab, setAffSubTab] = useState('pending'); // pending, approved, history
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, affiliationId: null, reason: '' });
  const [revokeModal, setRevokeModal] = useState({ open: false, affiliationId: null, reason: '' });

  // Phase 5: Room Management & Booking State
  const [rooms, setRooms] = useState([]);
  const [slots, setSlots] = useState([]);
  const [roomBookings, setRoomBookings] = useState([]);
  const [roomRequests, setRoomRequests] = useState([]);
  const [roomSubTab, setRoomSubTab] = useState('rooms'); // rooms, availability, bookings, requests
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [newRoomModal, setNewRoomModal] = useState({ open: false, roomNumber: '', floor: '', department: '', capacity: 1, type: 'Consultation Room' });
  const [cancelRoomBookingModal, setCancelRoomBookingModal] = useState({ open: false, bookingId: null, reason: '' });

  // Phase 6: Facility Patient Consultations State
  const [orgAppointments, setOrgAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentFilter, setAppointmentFilter] = useState('All');

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/organizations/profile', { withCredentials: true });
      if (res.data.status === 'success') {
        setOrganization(res.data.organization);
        setProfileForm({
          name: res.data.organization.name || '',
          phone: res.data.organization.phone || '',
          street: res.data.organization.address?.street || '',
          city: res.data.organization.address?.city || '',
          state: res.data.organization.address?.state || '',
          postalCode: res.data.organization.address?.postalCode || '',
          timezone: res.data.organization.timezone || 'Asia/Kolkata'
        });
      }
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/organization/login');
      } else {
        setError(err.response?.data?.msg || 'Failed to load organization profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAffiliations = async () => {
    setAffLoading(true);
    try {
      const res = await axios.get('/api/organizations/affiliations', { withCredentials: true });
      if (res.data.status === 'success') {
        setAffiliations(res.data.affiliations);
      }
    } catch (err) {
      console.error('Failed to load affiliations:', err);
    } finally {
      setAffLoading(false);
    }
  };

  const fetchRooms = async () => {
    setRoomsLoading(true);
    try {
      const res = await axios.get('/api/organizations/rooms', { withCredentials: true });
      if (res.data.status === 'success') {
        setRooms(res.data.rooms);
      }
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setRoomsLoading(false);
    }
  };

  const fetchSlots = async () => {
    try {
      const res = await axios.get('/api/organizations/slots', { withCredentials: true });
      if (res.data.status === 'success') {
        setSlots(res.data.slots);
      }
    } catch (err) {
      console.error('Failed to load slots:', err);
    }
  };

  const fetchRoomBookings = async () => {
    try {
      const res = await axios.get('/api/organizations/bookings', { withCredentials: true });
      if (res.data.status === 'success') {
        setRoomBookings(res.data.bookings);
      }
    } catch (err) {
      console.error('Failed to load room bookings:', err);
    }
  };

  const fetchRoomRequests = async () => {
    try {
      const res = await axios.get('/api/organizations/requests', { withCredentials: true });
      if (res.data.status === 'success') {
        setRoomRequests(res.data.requests);
      }
    } catch (err) {
      console.error('Failed to load room requests:', err);
    }
  };

  const fetchAllRoomData = () => {
    fetchRooms();
    fetchSlots();
    fetchRoomBookings();
    fetchRoomRequests();
  };

  const fetchOrgAppointments = async () => {
    setAppointmentsLoading(true);
    try {
      const res = await axios.get('/api/organizations/appointments', { withCredentials: true });
      if (res.data.status === 'success') {
        setOrgAppointments(res.data.appointments || []);
      }
    } catch (err) {
      console.error('Failed to load facility appointments:', err);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [navigate]);

  useEffect(() => {
    if (activeTab === 'affiliations') {
      fetchAffiliations();
    } else if (activeTab === 'rooms') {
      fetchAllRoomData();
    } else if (activeTab === 'appointments') {
      fetchOrgAppointments();
    }
  }, [activeTab]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setActionLoading('newRoom');
    setError('');
    setSuccess('');
    try {
      const res = await axios.post('/api/organizations/rooms', newRoomModal, { withCredentials: true });
      if (res.data.status === 'success') {
        setSuccess(`Room ${res.data.room.roomNumber} created successfully.`);
        setNewRoomModal({ open: false, roomNumber: '', floor: '', department: '', capacity: 1, type: 'Consultation Room' });
        fetchRooms();
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to create room.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleOperational = async (roomId, currentOperational) => {
    setActionLoading(roomId);
    setError('');
    setSuccess('');
    try {
      const res = await axios.patch(
        `/api/organizations/rooms/${roomId}/toggle-operational`,
        { isOperational: !currentOperational },
        { withCredentials: true }
      );
      if (res.data.status === 'success') {
        setSuccess(res.data.msg);
        fetchRooms();
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to toggle room status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateSlot = async (e) => {
    e.preventDefault();
    if (!newSlotModal.roomId) {
      setError('Please select a room.');
      return;
    }
    setActionLoading('newSlot');
    setError('');
    setSuccess('');
    try {
      const res = await axios.post(
        `/api/organizations/rooms/${newSlotModal.roomId}/availability`,
        {
          dateStr: newSlotModal.dateStr,
          startTimeStr: newSlotModal.startTimeStr,
          endTimeStr: newSlotModal.endTimeStr
        },
        { withCredentials: true }
      );
      if (res.data.status === 'success') {
        setSuccess('Room availability slot published successfully.');
        setNewSlotModal({ open: false, roomId: '', dateStr: '', startTimeStr: '09:00', endTimeStr: '13:00' });
        fetchSlots();
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to create availability slot.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelSlot = async (slotId) => {
    setActionLoading(slotId);
    setError('');
    setSuccess('');
    try {
      const res = await axios.patch(`/api/organizations/slots/${slotId}/cancel`, {}, { withCredentials: true });
      if (res.data.status === 'success') {
        setSuccess(res.data.msg);
        fetchSlots();
        fetchRoomRequests();
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to cancel slot.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelRoomBooking = async (e) => {
    e.preventDefault();
    if (!cancelRoomBookingModal.bookingId || !cancelRoomBookingModal.reason.trim()) return;
    setActionLoading(cancelRoomBookingModal.bookingId);
    setError('');
    setSuccess('');
    try {
      const res = await axios.patch(
        `/api/organizations/bookings/${cancelRoomBookingModal.bookingId}/cancel`,
        { reason: cancelRoomBookingModal.reason.trim() },
        { withCredentials: true }
      );
      if (res.data.status === 'success') {
        setSuccess('Booking cancelled and slot safely reopened.');
        setCancelRoomBookingModal({ open: false, bookingId: null, reason: '' });
        fetchRoomBookings();
        fetchSlots();
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to cancel room booking.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveAffiliation = async (id) => {
    setActionLoading(id);
    setError('');
    setSuccess('');
    try {
      const res = await axios.patch(`/api/organizations/affiliations/${id}/approve`, {}, { withCredentials: true });
      if (res.data.status === 'success') {
        setSuccess('Doctor affiliation approved successfully.');
        fetchAffiliations();
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to approve affiliation.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectAffiliation = async () => {
    if (!rejectModal.affiliationId) return;
    setActionLoading(rejectModal.affiliationId);
    setError('');
    setSuccess('');
    try {
      const res = await axios.patch(
        `/api/organizations/affiliations/${rejectModal.affiliationId}/reject`,
        { reason: rejectModal.reason || undefined },
        { withCredentials: true }
      );
      if (res.data.status === 'success') {
        setSuccess('Affiliation request rejected.');
        setRejectModal({ open: false, affiliationId: null, reason: '' });
        fetchAffiliations();
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to reject affiliation.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeAffiliation = async () => {
    if (!revokeModal.affiliationId) return;
    setActionLoading(revokeModal.affiliationId);
    setError('');
    setSuccess('');
    try {
      const res = await axios.patch(
        `/api/organizations/affiliations/${revokeModal.affiliationId}/revoke`,
        { reason: revokeModal.reason || undefined },
        { withCredentials: true }
      );
      if (res.data.status === 'success') {
        setSuccess('Doctor affiliation revoked.');
        setRevokeModal({ open: false, affiliationId: null, reason: '' });
        fetchAffiliations();
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to revoke affiliation.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewDoctorProfile = async (affiliationId) => {
    try {
      const res = await axios.get(`/api/organizations/affiliations/${affiliationId}/doctor`, { withCredentials: true });
      if (res.data.status === 'success') {
        setSelectedDoctor({ ...res.data.doctor, affiliation: res.data.affiliation });
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to fetch doctor profile.');
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/organizations/auth/logout', {}, { withCredentials: true });
      await refresh();
      navigate('/organization');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: profileForm.name,
        phone: profileForm.phone,
        address: {
          street: profileForm.street,
          city: profileForm.city,
          state: profileForm.state,
          postalCode: profileForm.postalCode
        },
        timezone: profileForm.timezone
      };

      const res = await axios.patch('/api/organizations/profile', payload, { withCredentials: true });
      if (res.data.status === 'success') {
        setSuccess('Profile updated successfully.');
        setOrganization(res.data.organization);
        setEditing(false);
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="container py-12 text-center">
        <h2 className="text-xl font-bold mb-4">Organization Profile Not Found</h2>
        <button onClick={() => navigate('/organization/login')} className="btn btn-primary">
          Back to Login
        </button>
      </div>
    );
  }

  return (
    <div className="container py-8 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-8">

        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0">
          <div className="card sticky top-24 border-t-4 border-primary">
            <div className="flex flex-col items-center mb-6 text-center">
              <div className="w-20 h-20 bg-blue-50 text-primary rounded-full flex items-center justify-center text-3xl font-bold mb-4 shadow-sm">
                <Building2 size={36} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 leading-tight">
                {organization.name}
              </h3>
              <span className="text-xs text-muted mt-1 uppercase tracking-wider font-semibold">
                {organization.type}
              </span>

              {/* Status Badges */}
              <div className="mt-4 flex flex-col gap-1 w-full items-center">
                {organization.isBlocked ? (
                  <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold flex items-center gap-1">
                    <AlertTriangle size={12} /> Suspended
                  </span>
                ) : organization.isVerifiedByAdmin ? (
                  <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold flex items-center gap-1">
                    <ShieldCheck size={12} /> Verified Facility
                  </span>
                ) : (
                  <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold flex items-center gap-1">
                    <Clock size={12} /> Pending Approval
                  </span>
                )}

                <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 mt-1">
                  <CheckCircle size={11} /> Email Verified
                </span>
              </div>
            </div>

            <nav className="flex flex-col gap-2">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${activeTab === 'overview' ? 'bg-blue-50 text-primary font-medium' : 'hover:bg-gray-50 text-muted'}`}
              >
                <Building2 size={18} /> Facility Overview
              </button>
              <button
                onClick={() => setActiveTab('rooms')}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${activeTab === 'rooms' ? 'bg-blue-50 text-primary font-medium' : 'hover:bg-gray-50 text-muted'}`}
              >
                <Calendar size={18} /> Rooms & Slots
              </button>
              <button
                onClick={() => setActiveTab('affiliations')}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${activeTab === 'affiliations' ? 'bg-blue-50 text-primary font-medium' : 'hover:bg-gray-50 text-muted'}`}
              >
                <Users size={18} /> Affiliated Doctors
              </button>
              <button
                onClick={() => setActiveTab('appointments')}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${activeTab === 'appointments' ? 'bg-blue-50 text-primary font-medium' : 'hover:bg-gray-50 text-muted'}`}
              >
                <Clock size={18} /> Patient Consultations
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${activeTab === 'settings' ? 'bg-blue-50 text-primary font-medium' : 'hover:bg-gray-50 text-muted'}`}
              >
                <Settings size={18} /> Facility Settings
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-gray-100 text-red-600 mt-4 border-t border-gray-100 pt-4"
              >
                <LogOut size={18} /> Sign Out
              </button>
            </nav>
          </div>
        </div>

        {/* Main Panel */}
        <div className="flex-1">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg shadow-sm mb-6 flex items-center gap-2 border border-red-200">
              <AlertTriangle size={20} /> {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 text-green-700 p-4 rounded-lg shadow-sm mb-6 flex items-center gap-2 border border-green-200">
              <CheckCircle size={20} /> {success}
            </div>
          )}

          {/* Verification Notice Banner */}
          {!organization.isVerifiedByAdmin && !organization.isBlocked && (
            <div className="bg-amber-50 border-l-4 border-amber-400 p-5 rounded-r-xl mb-6 shadow-sm">
              <div className="flex items-start gap-3">
                <Clock className="text-amber-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-bold text-amber-900 text-base">Verification In Progress</h4>
                  <p className="text-amber-800 text-sm mt-1 leading-relaxed">
                    Your facility is registered and email-verified. MedCare AI Administration is reviewing your clinical establishment credentials ({organization.registrationNumber}). Once approved, full consultation room allocations and doctor affiliations will become operational.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="card animate-fade-in">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Facility Details</h2>
                  <p className="text-muted text-sm mt-1">Institutional record and operating parameters</p>
                </div>
                <button
                  onClick={() => setEditing(!editing)}
                  className="btn btn-outline flex items-center gap-2 text-sm"
                >
                  <Edit3 size={16} /> {editing ? 'Cancel' : 'Edit Profile'}
                </button>
              </div>

              {!editing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                    <FileText className="text-primary mt-1" size={20} />
                    <div>
                      <span className="text-xs text-muted font-bold uppercase tracking-wide">Registration ID</span>
                      <p className="font-bold text-gray-800 mt-0.5">{organization.registrationNumber}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                    <Mail className="text-primary mt-1" size={20} />
                    <div>
                      <span className="text-xs text-muted font-bold uppercase tracking-wide">Official Email</span>
                      <p className="font-bold text-gray-800 mt-0.5">{organization.email}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                    <Phone className="text-primary mt-1" size={20} />
                    <div>
                      <span className="text-xs text-muted font-bold uppercase tracking-wide">Phone</span>
                      <p className="font-bold text-gray-800 mt-0.5">{organization.phone}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
                    <Clock className="text-primary mt-1" size={20} />
                    <div>
                      <span className="text-xs text-muted font-bold uppercase tracking-wide">Operating Timezone</span>
                      <p className="font-bold text-gray-800 mt-0.5">{organization.timezone}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3 md:col-span-2">
                    <MapPin className="text-primary mt-1" size={20} />
                    <div>
                      <span className="text-xs text-muted font-bold uppercase tracking-wide">Address</span>
                      <p className="font-bold text-gray-800 mt-0.5">
                        {[
                          organization.address?.street,
                          organization.address?.city,
                          organization.address?.state,
                          organization.address?.postalCode,
                          organization.address?.country
                        ].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="input-group">
                      <label className="input-label" htmlFor="name">Facility Name</label>
                      <input
                        type="text"
                        id="name"
                        className="input-field"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label" htmlFor="phone">Phone</label>
                      <input
                        type="tel"
                        id="phone"
                        className="input-field"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label" htmlFor="street">Street Address</label>
                    <input
                      type="text"
                      id="street"
                      className="input-field"
                      value={profileForm.street}
                      onChange={(e) => setProfileForm({ ...profileForm, street: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="input-group">
                      <label className="input-label" htmlFor="city">City</label>
                      <input
                        type="text"
                        id="city"
                        className="input-field"
                        value={profileForm.city}
                        onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                        required
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label" htmlFor="state">State</label>
                      <input
                        type="text"
                        id="state"
                        className="input-field"
                        value={profileForm.state}
                        onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                        required
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label" htmlFor="postalCode">Postal Code</label>
                      <input
                        type="text"
                        id="postalCode"
                        className="input-field"
                        value={profileForm.postalCode}
                        onChange={(e) => setProfileForm({ ...profileForm, postalCode: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end mt-4">
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="btn btn-outline"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn btn-primary"
                    >
                      {saving ? 'Saving...' : 'Save Profile Changes'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {activeTab === 'rooms' && (
            <div className="space-y-6 animate-fade-in">
              {/* Header and Sub-tab selector */}
              <div className="card">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-gray-100">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Facility Rooms & Availability</h2>
                    <p className="text-sm text-muted">
                      Manage consultation rooms, create availability intervals, review bookings, and monitor FCFS allocation queues.
                    </p>
                  </div>

                  {/* Subtabs */}
                  <div className="flex flex-wrap gap-1 p-1 bg-gray-100 rounded-lg">
                    <button
                      onClick={() => setRoomSubTab('rooms')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${roomSubTab === 'rooms' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      <Building2 size={13} /> Rooms ({rooms.length})
                    </button>
                    <button
                      onClick={() => setRoomSubTab('availability')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${roomSubTab === 'availability' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      <Calendar size={13} /> Slots ({slots.length})
                    </button>
                    <button
                      onClick={() => setRoomSubTab('bookings')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${roomSubTab === 'bookings' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      <CheckCircle size={13} /> Bookings ({roomBookings.filter(b => b.status === 'Active').length})
                    </button>
                    <button
                      onClick={() => setRoomSubTab('requests')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${roomSubTab === 'requests' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      <Clock size={13} /> Queue ({roomRequests.filter(r => r.status === 'PENDING').length})
                    </button>
                  </div>
                </div>

                {/* Subtab 1: Rooms Management */}
                {roomSubTab === 'rooms' && (
                  <div className="mt-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-base font-bold text-gray-800">Registered Facility Rooms</h3>
                        <p className="text-xs text-muted">Each room belongs exclusively to your healthcare organization.</p>
                      </div>
                      <button
                        onClick={() => setNewRoomModal({ open: true, roomNumber: '', floor: '', department: '', capacity: 1, type: 'Consultation Room' })}
                        className="btn btn-primary btn-sm flex items-center gap-1.5"
                      >
                        <Plus size={15} /> Add New Room
                      </button>
                    </div>

                    {roomsLoading ? (
                      <div className="text-center py-12 text-muted">Loading rooms...</div>
                    ) : rooms.length === 0 ? (
                      <div className="text-center py-12 text-muted border-2 border-dashed border-gray-100 rounded-xl">
                        <Building2 size={36} className="mx-auto text-gray-300 mb-2" />
                        <p className="font-medium text-gray-600">No rooms created yet</p>
                        <p className="text-xs text-muted mt-1">Click "Add New Room" above to register consultation rooms for doctor reservations.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {rooms.map((r) => (
                          <div key={r._id} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <h4 className="text-lg font-bold text-gray-900">Room {r.roomNumber}</h4>
                                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                    {r.type || 'Consultation Room'}
                                  </span>
                                </div>
                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${r.isOperational ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                  {r.isOperational ? <CheckCircle size={11} /> : <AlertTriangle size={11} />}
                                  {r.isOperational ? 'Operational' : 'Maintenance'}
                                </span>
                              </div>

                              <div className="text-xs text-gray-600 space-y-1 my-3 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                <div><span className="font-medium text-gray-500">Floor:</span> {r.floor || 'Ground'}</div>
                                <div><span className="font-medium text-gray-500">Department:</span> {r.department || 'Outpatient Clinic'}</div>
                                <div><span className="font-medium text-gray-500">Doctor Capacity:</span> {r.capacity} practitioner(s)</div>
                              </div>
                            </div>

                            <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                              <button
                                onClick={() => handleToggleOperational(r._id, r.isOperational)}
                                disabled={actionLoading === r._id}
                                className={`text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors ${
                                  r.isOperational
                                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                }`}
                              >
                                {r.isOperational ? <PowerOff size={13} /> : <Power size={13} />}
                                {actionLoading === r._id ? 'Updating...' : r.isOperational ? 'Mark Maintenance' : 'Mark Operational'}
                              </button>

                              <button
                                onClick={() => setNewSlotModal({ open: true, roomId: r._id, dateStr: '', startTimeStr: '09:00', endTimeStr: '13:00' })}
                                className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                              >
                                <Plus size={12} /> Add Slot
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Subtab 2: Availability Schedule */}
                {roomSubTab === 'availability' && (
                  <div className="mt-6 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                      <div>
                        <h3 className="text-base font-bold text-gray-800">Room Availability Slots</h3>
                        <p className="text-xs text-muted">
                          Configured in facility timezone: <span className="font-bold text-primary">{organization.timezone}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => setNewSlotModal({ open: true, roomId: rooms[0]?._id || '', dateStr: '', startTimeStr: '09:00', endTimeStr: '13:00' })}
                        disabled={rooms.length === 0}
                        className="btn btn-primary btn-sm flex items-center gap-1.5"
                      >
                        <Plus size={15} /> Add Availability Interval
                      </button>
                    </div>

                    {slots.length === 0 ? (
                      <div className="text-center py-12 text-muted border-2 border-dashed border-gray-100 rounded-xl">
                        <Calendar size={36} className="mx-auto text-gray-300 mb-2" />
                        <p className="font-medium text-gray-600">No availability intervals scheduled</p>
                        <p className="text-xs text-muted mt-1">Publish time slots so affiliated doctors can request consultation room time.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {slots.map((s) => (
                          <div key={s._id} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <h4 className="font-bold text-gray-900 text-sm">Room {s.room?.roomNumber || 'N/A'}</h4>
                                  <p className="text-xs text-muted">{s.room?.department || 'General Facility'}</p>
                                </div>
                                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                                  s.status === 'Available' ? 'bg-emerald-100 text-emerald-800' :
                                  s.status === 'Queued' ? 'bg-amber-100 text-amber-800' :
                                  s.status === 'Reserved' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {s.status}
                                </span>
                              </div>

                              <div className="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100 my-2 space-y-1">
                                <div><span className="font-medium text-gray-500">Date:</span> {new Date(s.date).toLocaleDateString()}</div>
                                <div><span className="font-medium text-gray-500">Time:</span> {s.localStartTime || '09:00'} - {s.localEndTime || '13:00'}</div>
                                <div><span className="font-medium text-gray-500">Queue Generation:</span> Gen {s.queueGeneration || 0}</div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-gray-100 flex justify-end">
                              {s.status !== 'Reserved' && (
                                <button
                                  onClick={() => handleCancelSlot(s._id)}
                                  disabled={actionLoading === s._id}
                                  className="text-xs text-red-600 hover:underline font-semibold flex items-center gap-1"
                                >
                                  <Trash2 size={12} /> Cancel Slot
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Subtab 3: Confirmed Bookings */}
                {roomSubTab === 'bookings' && (
                  <div className="mt-6 space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-gray-800">Confirmed Doctor Room Bookings</h3>
                      <p className="text-xs text-muted">Allocated consultation room intervals for affiliated medical practitioners.</p>
                    </div>

                    {roomBookings.length === 0 ? (
                      <div className="text-center py-12 text-muted border-2 border-dashed border-gray-100 rounded-xl">
                        <CheckCircle size={36} className="mx-auto text-gray-300 mb-2" />
                        <p className="font-medium text-gray-600">No room bookings recorded</p>
                        <p className="text-xs text-muted mt-1">When requests are allocated via FCFS, confirmed reservations will appear here.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border border-gray-200 rounded-xl overflow-hidden">
                          <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                            <tr>
                              <th className="p-3">Doctor</th>
                              <th className="p-3">Room</th>
                              <th className="p-3">Date</th>
                              <th className="p-3">Interval</th>
                              <th className="p-3">Status</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {roomBookings.map((b) => (
                              <tr key={b._id} className="hover:bg-gray-50/50">
                                <td className="p-3">
                                  <p className="font-bold text-gray-900">Dr. {b.doctor?.name || 'Doctor'}</p>
                                  <p className="text-muted text-[11px]">{b.doctor?.specialization} • {b.doctor?.email}</p>
                                </td>
                                <td className="p-3 font-semibold text-gray-800">Room {b.room?.roomNumber || 'N/A'}</td>
                                <td className="p-3 text-gray-700">{new Date(b.startDateTime).toLocaleDateString()}</td>
                                <td className="p-3 text-gray-700">{b.roomSlot?.localStartTime || new Date(b.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {b.roomSlot?.localEndTime || new Date(b.endDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full font-bold ${
                                    b.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                                    b.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {b.status}
                                  </span>
                                </td>
                                <td className="p-3 text-right">
                                  {b.status === 'Active' && (
                                    <button
                                      onClick={() => setCancelRoomBookingModal({ open: true, bookingId: b._id, reason: '' })}
                                      className="text-red-600 hover:underline font-semibold"
                                    >
                                      Cancel Booking
                                    </button>
                                  )}
                                  {b.status === 'Cancelled' && (
                                    <span className="text-[11px] text-muted italic">
                                      {b.cancellationReason || 'Cancelled'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Subtab 4: Queue Requests */}
                {roomSubTab === 'requests' && (
                  <div className="mt-6 space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-gray-800">Incoming FCFS Allocation Queue</h3>
                      <p className="text-xs text-muted">
                        Real-time server queue requests ordered by server-controlled sequence numbers.
                      </p>
                    </div>

                    {roomRequests.length === 0 ? (
                      <div className="text-center py-12 text-muted border-2 border-dashed border-gray-100 rounded-xl">
                        <Clock size={36} className="mx-auto text-gray-300 mb-2" />
                        <p className="font-medium text-gray-600">No allocation queue requests</p>
                        <p className="text-xs text-muted mt-1">Incoming doctor room requests will be queued and evaluated here.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border border-gray-200 rounded-xl overflow-hidden">
                          <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                            <tr>
                              <th className="p-3">Sequence</th>
                              <th className="p-3">Doctor</th>
                              <th className="p-3">Room</th>
                              <th className="p-3">Slot Date & Time</th>
                              <th className="p-3">Generation</th>
                              <th className="p-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {roomRequests.map((req) => (
                              <tr key={req._id} className="hover:bg-gray-50/50">
                                <td className="p-3 font-mono font-bold text-primary">#{req.sequenceNumber}</td>
                                <td className="p-3">
                                  <p className="font-bold text-gray-900">Dr. {req.doctor?.name || 'Doctor'}</p>
                                  <p className="text-muted text-[11px]">{req.doctor?.specialization}</p>
                                </td>
                                <td className="p-3 font-semibold text-gray-800">Room {req.room?.roomNumber || 'N/A'}</td>
                                <td className="p-3 text-gray-700">
                                  {req.roomSlot?.date ? new Date(req.roomSlot.date).toLocaleDateString() : 'N/A'}{' '}
                                  ({req.roomSlot?.localStartTime || ''} - {req.roomSlot?.localEndTime || ''})
                                </td>
                                <td className="p-3 font-mono text-muted">Gen {req.queueGeneration}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full font-bold ${
                                    req.status === 'ALLOCATED' ? 'bg-emerald-100 text-emerald-800' :
                                    req.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {req.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal: Add New Room */}
              {newRoomModal.open && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="card max-w-md w-full p-6 bg-white shadow-xl rounded-2xl">
                    <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Plus size={18} className="text-primary" /> Register New Room
                      </h3>
                      <button onClick={() => setNewRoomModal({ ...newRoomModal, open: false })} className="text-muted hover:text-gray-800">
                        <X size={18} />
                      </button>
                    </div>

                    <form onSubmit={handleCreateRoom} className="space-y-4 text-xs">
                      <div className="input-group">
                        <label className="input-label" htmlFor="newRoomNum">Room Number / Identifier *</label>
                        <input
                          type="text"
                          id="newRoomNum"
                          className="input-field"
                          placeholder="e.g. 101, Consultation Suite A"
                          value={newRoomModal.roomNumber}
                          onChange={(e) => setNewRoomModal({ ...newRoomModal, roomNumber: e.target.value })}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="input-group">
                          <label className="input-label" htmlFor="newRoomFloor">Floor</label>
                          <input
                            type="text"
                            id="newRoomFloor"
                            className="input-field"
                            placeholder="e.g. 1st Floor"
                            value={newRoomModal.floor}
                            onChange={(e) => setNewRoomModal({ ...newRoomModal, floor: e.target.value })}
                          />
                        </div>
                        <div className="input-group">
                          <label className="input-label" htmlFor="newRoomDept">Department</label>
                          <input
                            type="text"
                            id="newRoomDept"
                            className="input-field"
                            placeholder="e.g. Cardiology"
                            value={newRoomModal.department}
                            onChange={(e) => setNewRoomModal({ ...newRoomModal, department: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="input-group">
                          <label className="input-label" htmlFor="newRoomType">Room Category</label>
                          <select
                            id="newRoomType"
                            className="input-field"
                            value={newRoomModal.type}
                            onChange={(e) => setNewRoomModal({ ...newRoomModal, type: e.target.value })}
                          >
                            <option value="Consultation Room">Consultation Room</option>
                            <option value="Specialist Clinic">Specialist Clinic</option>
                            <option value="Diagnostics Room">Diagnostics Room</option>
                            <option value="Examination Suite">Examination Suite</option>
                          </select>
                        </div>
                        <div className="input-group">
                          <label className="input-label" htmlFor="newRoomCap">Practitioner Capacity</label>
                          <input
                            type="number"
                            id="newRoomCap"
                            min="1"
                            className="input-field"
                            value={newRoomModal.capacity}
                            onChange={(e) => setNewRoomModal({ ...newRoomModal, capacity: parseInt(e.target.value) || 1 })}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setNewRoomModal({ ...newRoomModal, open: false })}
                          className="btn btn-outline btn-sm"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={actionLoading === 'newRoom'}
                          className="btn btn-primary btn-sm"
                        >
                          {actionLoading === 'newRoom' ? 'Creating...' : 'Register Room'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Modal: Add Availability Interval */}
              {newSlotModal.open && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="card max-w-md w-full p-6 bg-white shadow-xl rounded-2xl">
                    <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Calendar size={18} className="text-primary" /> Publish Availability Slot
                      </h3>
                      <button onClick={() => setNewSlotModal({ ...newSlotModal, open: false })} className="text-muted hover:text-gray-800">
                        <X size={18} />
                      </button>
                    </div>

                    <form onSubmit={handleCreateSlot} className="space-y-4 text-xs">
                      <div className="input-group">
                        <label className="input-label" htmlFor="slotRoom">Select Room *</label>
                        <select
                          id="slotRoom"
                          className="input-field"
                          value={newSlotModal.roomId}
                          onChange={(e) => setNewSlotModal({ ...newSlotModal, roomId: e.target.value })}
                          required
                        >
                          <option value="">-- Choose a room --</option>
                          {rooms.filter(r => r.isOperational).map((r) => (
                            <option key={r._id} value={r._id}>
                              Room {r.roomNumber} ({r.type || 'Consultation Room'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="input-group">
                        <label className="input-label" htmlFor="slotDate">Calendar Date *</label>
                        <input
                          type="date"
                          id="slotDate"
                          className="input-field"
                          value={newSlotModal.dateStr}
                          onChange={(e) => setNewSlotModal({ ...newSlotModal, dateStr: e.target.value })}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="input-group">
                          <label className="input-label" htmlFor="slotStartTime">Start Time (24h) *</label>
                          <input
                            type="time"
                            id="slotStartTime"
                            className="input-field"
                            value={newSlotModal.startTimeStr}
                            onChange={(e) => setNewSlotModal({ ...newSlotModal, startTimeStr: e.target.value })}
                            required
                          />
                        </div>
                        <div className="input-group">
                          <label className="input-label" htmlFor="slotEndTime">End Time (24h) *</label>
                          <input
                            type="time"
                            id="slotEndTime"
                            className="input-field"
                            value={newSlotModal.endTimeStr}
                            onChange={(e) => setNewSlotModal({ ...newSlotModal, endTimeStr: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <p className="text-[11px] text-muted italic">
                        Times are resolved using facility timezone ({organization.timezone}). Canonical UTC timestamps will be computed automatically.
                      </p>

                      <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setNewSlotModal({ ...newSlotModal, open: false })}
                          className="btn btn-outline btn-sm"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={actionLoading === 'newSlot'}
                          className="btn btn-primary btn-sm"
                        >
                          {actionLoading === 'newSlot' ? 'Publishing...' : 'Publish Slot'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Modal: Cancel Room Booking */}
              {cancelRoomBookingModal.open && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="card max-w-md w-full p-6 bg-white shadow-xl rounded-2xl">
                    <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-4">
                      <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
                        <AlertTriangle size={18} /> Cancel Room Reservation
                      </h3>
                      <button onClick={() => setCancelRoomBookingModal({ open: false, bookingId: null, reason: '' })} className="text-muted hover:text-gray-800">
                        <X size={18} />
                      </button>
                    </div>

                    <form onSubmit={handleCancelRoomBooking} className="space-y-4 text-xs">
                      <p className="text-gray-600">
                        Cancelling will clear the reservation, record an auditable cancellation trail, notify the doctor via transactional outbox, and safely reopen the slot under a bumped queue generation.
                      </p>

                      <div className="input-group">
                        <label className="input-label" htmlFor="cancelReason">Reason for Cancellation *</label>
                        <textarea
                          id="cancelReason"
                          rows="3"
                          className="input-field"
                          placeholder="Provide specific administrative justification..."
                          value={cancelRoomBookingModal.reason}
                          onChange={(e) => setCancelRoomBookingModal({ ...cancelRoomBookingModal, reason: e.target.value })}
                          required
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setCancelRoomBookingModal({ open: false, bookingId: null, reason: '' })}
                          className="btn btn-outline btn-sm"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={actionLoading === cancelRoomBookingModal.bookingId}
                          className="btn bg-red-600 hover:bg-red-700 text-white btn-sm"
                        >
                          {actionLoading === cancelRoomBookingModal.bookingId ? 'Cancelling...' : 'Confirm Cancellation'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'affiliations' && (
            <div className="space-y-6 animate-fade-in">
              <div className="card">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-gray-100">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Doctor Affiliations</h2>
                    <p className="text-sm text-muted">Review incoming requests and manage affiliated medical professionals</p>
                  </div>
                  {/* Sub-tabs */}
                  <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                    <button
                      onClick={() => setAffSubTab('pending')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${affSubTab === 'pending' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      Pending Requests
                      {affiliations.filter(a => a.status === 'Pending').length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                          {affiliations.filter(a => a.status === 'Pending').length}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setAffSubTab('approved')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${affSubTab === 'approved' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      Affiliated Doctors
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                        {affiliations.filter(a => a.status === 'Approved').length}
                      </span>
                    </button>
                    <button
                      onClick={() => setAffSubTab('history')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${affSubTab === 'history' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      Request History
                    </button>
                  </div>
                </div>

                {affLoading ? (
                  <div className="text-center py-16 text-muted">Loading doctor affiliations...</div>
                ) : (
                  <div className="mt-6">
                    {/* 1. Pending Requests Sub-tab */}
                    {affSubTab === 'pending' && (
                      <div>
                        {affiliations.filter(a => a.status === 'Pending').length === 0 ? (
                          <div className="text-center py-12 text-muted border-2 border-dashed border-gray-100 rounded-xl">
                            <Users size={36} className="mx-auto text-gray-300 mb-2" />
                            <p className="font-medium text-gray-600">No pending affiliation requests</p>
                            <p className="text-xs text-muted mt-1">When doctors apply to practice at your facility, requests will appear here.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {affiliations
                              .filter(a => a.status === 'Pending')
                              .map((aff) => {
                                const doc = aff.doctor || {};
                                return (
                                  <div key={aff._id} className="border border-amber-200 bg-amber-50/20 rounded-xl p-5 flex flex-col justify-between">
                                    <div>
                                      <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex items-center gap-3">
                                          <div className="w-12 h-12 rounded-full overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                            {doc.profilePicture ? (
                                              <img src={doc.profilePicture} alt={doc.name} className="w-full h-full object-cover" />
                                            ) : (
                                              <span className="text-lg font-bold text-primary">{doc.name?.charAt(0) || 'D'}</span>
                                            )}
                                          </div>
                                          <div>
                                            <h4 className="font-bold text-gray-900 text-base">Dr. {doc.name}</h4>
                                            <p className="text-xs text-primary font-medium">{doc.specialization} • {doc.qualification}</p>
                                          </div>
                                        </div>
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                          Pending
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 py-2 border-y border-amber-100 mb-3">
                                        <div><span className="font-medium text-gray-500">NMR No:</span> {doc.nmrNumber || 'N/A'}</div>
                                        <div><span className="font-medium text-gray-500">Experience:</span> {doc.experience} yrs</div>
                                        <div><span className="font-medium text-gray-500">Email:</span> {doc.email}</div>
                                        <div><span className="font-medium text-gray-500">Phone:</span> {doc.phone || 'N/A'}</div>
                                      </div>

                                      <p className="text-xs text-muted">
                                        Requested on: {new Date(aff.createdAt).toLocaleDateString()}
                                      </p>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-amber-100 flex items-center justify-between gap-2">
                                      <button
                                        onClick={() => handleViewDoctorProfile(aff._id)}
                                        className="text-xs text-primary hover:underline font-medium"
                                      >
                                        Inspect Profile
                                      </button>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => setRejectModal({ open: true, affiliationId: aff._id, reason: '' })}
                                          disabled={actionLoading === aff._id}
                                          className="btn btn-outline text-xs py-1.5 px-3 border-rose-300 text-rose-700 hover:bg-rose-50"
                                        >
                                          Reject
                                        </button>
                                        <button
                                          onClick={() => handleApproveAffiliation(aff._id)}
                                          disabled={actionLoading === aff._id}
                                          className="btn btn-primary text-xs py-1.5 px-4"
                                        >
                                          {actionLoading === aff._id ? 'Approving...' : 'Approve'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 2. Affiliated Doctors Sub-tab */}
                    {affSubTab === 'approved' && (
                      <div>
                        {affiliations.filter(a => a.status === 'Approved').length === 0 ? (
                          <div className="text-center py-12 text-muted border-2 border-dashed border-gray-100 rounded-xl">
                            <CheckCircle size={36} className="mx-auto text-gray-300 mb-2" />
                            <p className="font-medium text-gray-600">No approved affiliations yet</p>
                            <p className="text-xs text-muted mt-1">Approved doctors can reserve rooms and practice at your facility.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {affiliations
                              .filter(a => a.status === 'Approved')
                              .map((aff) => {
                                const doc = aff.doctor || {};
                                return (
                                  <div key={aff._id} className="border border-emerald-200 bg-white rounded-xl p-5 shadow-sm flex flex-col justify-between">
                                    <div>
                                      <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex items-center gap-3">
                                          <div className="w-12 h-12 rounded-full overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                            {doc.profilePicture ? (
                                              <img src={doc.profilePicture} alt={doc.name} className="w-full h-full object-cover" />
                                            ) : (
                                              <span className="text-lg font-bold text-primary">{doc.name?.charAt(0) || 'D'}</span>
                                            )}
                                          </div>
                                          <div>
                                            <h4 className="font-bold text-gray-900 text-base">Dr. {doc.name}</h4>
                                            <p className="text-xs text-primary font-medium">{doc.specialization} • {doc.qualification}</p>
                                          </div>
                                        </div>
                                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                          <CheckCircle size={11} /> Affiliated
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 py-2 border-y border-gray-100 mb-2">
                                        <div><span className="font-medium text-gray-500">NMR No:</span> {doc.nmrNumber || 'N/A'}</div>
                                        <div><span className="font-medium text-gray-500">Experience:</span> {doc.experience} yrs</div>
                                        <div><span className="font-medium text-gray-500">Email:</span> {doc.email}</div>
                                        <div><span className="font-medium text-gray-500">Fee:</span> ₹{doc.consultationFee || 'N/A'}</div>
                                      </div>

                                      <div className="text-xs text-gray-500">
                                        Affiliated since: <span className="font-medium text-gray-700">{new Date(aff.approvedAt || aff.updatedAt).toLocaleDateString()}</span>
                                      </div>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                                      <button
                                        onClick={() => handleViewDoctorProfile(aff._id)}
                                        className="text-xs text-primary hover:underline font-medium"
                                      >
                                        Inspect Profile
                                      </button>
                                      <button
                                        onClick={() => setRevokeModal({ open: true, affiliationId: aff._id, reason: '' })}
                                        disabled={actionLoading === aff._id}
                                        className="text-xs text-rose-600 hover:text-rose-800 font-medium px-3 py-1.5 rounded border border-rose-200 hover:bg-rose-50 transition-colors"
                                      >
                                        Revoke Affiliation
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 3. Request History Sub-tab */}
                    {affSubTab === 'history' && (
                      <div>
                        {affiliations.filter(a => ['Rejected', 'Revoked', 'Withdrawn'].includes(a.status)).length === 0 ? (
                          <div className="text-center py-12 text-muted border-2 border-dashed border-gray-100 rounded-xl">
                            <Clock size={36} className="mx-auto text-gray-300 mb-2" />
                            <p className="font-medium text-gray-600">No request history found</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {affiliations
                              .filter(a => ['Rejected', 'Revoked', 'Withdrawn'].includes(a.status))
                              .map((aff) => {
                                const doc = aff.doctor || {};
                                const statusBadges = {
                                  Rejected: 'bg-rose-100 text-rose-800 border-rose-200',
                                  Revoked: 'bg-gray-100 text-gray-700 border-gray-200',
                                  Withdrawn: 'bg-slate-100 text-slate-700 border-slate-200'
                                };
                                return (
                                  <div key={aff._id} className="border border-gray-200 rounded-xl p-4 bg-white flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-bold text-gray-900 text-sm">Dr. {doc.name || 'Doctor'}</h4>
                                        <span className="text-xs text-muted">({doc.specialization || 'Medical Specialist'})</span>
                                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusBadges[aff.status] || 'bg-gray-100 text-gray-600'}`}>
                                          {aff.status}
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-500 mt-1">
                                        Requested: {new Date(aff.createdAt).toLocaleDateString()}
                                        {aff.rejectionReason && ` • Rejection Reason: ${aff.rejectionReason}`}
                                        {aff.revocationReason && ` • Revocation Reason: ${aff.revocationReason}`}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => handleViewDoctorProfile(aff._id)}
                                      className="text-xs text-primary hover:underline font-medium shrink-0 self-start sm:self-auto"
                                    >
                                      Inspect Profile
                                    </button>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Doctor Full Profile Inspection Modal */}
              {selectedDoctor && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto animate-fade-in shadow-xl">
                    <div className="flex justify-between items-start pb-4 border-b border-gray-100 mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">Dr. {selectedDoctor.name}</h3>
                        <p className="text-sm text-primary font-medium">{selectedDoctor.specialization}</p>
                      </div>
                      <button
                        onClick={() => setSelectedDoctor(null)}
                        className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                      >
                        &times;
                      </button>
                    </div>

                    <div className="space-y-4 text-sm text-gray-700">
                      <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl">
                        <div><span className="font-semibold text-gray-600">Qualification:</span> {selectedDoctor.qualification}</div>
                        <div><span className="font-semibold text-gray-600">Experience:</span> {selectedDoctor.experience} years</div>
                        <div><span className="font-semibold text-gray-600">NMR Number:</span> {selectedDoctor.nmrNumber}</div>
                        <div><span className="font-semibold text-gray-600">Consultation Fee:</span> ₹{selectedDoctor.consultationFee}</div>
                      </div>

                      <div>
                        <span className="font-semibold text-gray-800 block mb-1">Contact Information:</span>
                        <p className="text-xs text-gray-600">Email: {selectedDoctor.email}</p>
                        <p className="text-xs text-gray-600">Phone: {selectedDoctor.phone || 'N/A'}</p>
                      </div>

                      {selectedDoctor.bio && (
                        <div>
                          <span className="font-semibold text-gray-800 block mb-1">Professional Bio:</span>
                          <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-lg">{selectedDoctor.bio}</p>
                        </div>
                      )}

                      {selectedDoctor.clinicLocation?.address && (
                        <div>
                          <span className="font-semibold text-gray-800 block mb-1">Clinic Address:</span>
                          <p className="text-xs text-gray-600">{selectedDoctor.clinicLocation.address}</p>
                        </div>
                      )}

                      <div className="pt-3 border-t border-gray-100 text-xs text-muted">
                        Affiliation Status: <span className="font-semibold text-gray-800">{selectedDoctor.affiliation?.status}</span>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
                      <button onClick={() => setSelectedDoctor(null)} className="btn btn-outline text-xs px-4 py-2">
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Reject Affiliation Modal */}
              {rejectModal.open && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-md w-full p-6 animate-fade-in shadow-xl">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Reject Affiliation Request</h3>
                    <p className="text-xs text-muted mb-4">
                      Please state the reason for rejecting this doctor's affiliation request. The doctor will be notified via email.
                    </p>
                    <textarea
                      value={rejectModal.reason}
                      onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                      placeholder="e.g. Current facility capacity full in this specialization."
                      rows={3}
                      className="w-full text-sm border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-rose-200 mb-4"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setRejectModal({ open: false, affiliationId: null, reason: '' })}
                        className="btn btn-outline text-xs px-4 py-2"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRejectAffiliation}
                        disabled={actionLoading === rejectModal.affiliationId}
                        className="btn bg-rose-600 hover:bg-rose-700 text-white text-xs px-4 py-2 border-none"
                      >
                        {actionLoading === rejectModal.affiliationId ? 'Rejecting...' : 'Confirm Rejection'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Revoke Affiliation Modal */}
              {revokeModal.open && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-md w-full p-6 animate-fade-in shadow-xl">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Revoke Doctor Affiliation</h3>
                    <p className="text-xs text-muted mb-4">
                      Are you sure you want to terminate this doctor's affiliation? Facility room reservations and consultation privileges for this doctor will be revoked.
                    </p>
                    <textarea
                      value={revokeModal.reason}
                      onChange={(e) => setRevokeModal({ ...revokeModal, reason: e.target.value })}
                      placeholder="e.g. End of contract period."
                      rows={3}
                      className="w-full text-sm border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-rose-200 mb-4"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setRevokeModal({ open: false, affiliationId: null, reason: '' })}
                        className="btn btn-outline text-xs px-4 py-2"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRevokeAffiliation}
                        disabled={actionLoading === revokeModal.affiliationId}
                        className="btn bg-rose-600 hover:bg-rose-700 text-white text-xs px-4 py-2 border-none"
                      >
                        {actionLoading === revokeModal.affiliationId ? 'Revoking...' : 'Confirm Revocation'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Phase 6: Patient Consultations Tab */}
          {activeTab === 'appointments' && (
            <div className="card animate-fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-100">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Facility Patient Consultations</h2>
                  <p className="text-sm text-gray-500">Track all patient appointments scheduled in your facility rooms</p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    className="input-field py-1.5 text-xs w-36"
                    value={appointmentFilter}
                    onChange={(e) => setAppointmentFilter(e.target.value)}
                  >
                    <option value="All">All Statuses</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Pending">Pending</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Expired">Expired</option>
                  </select>
                  <button
                    onClick={fetchOrgAppointments}
                    className="btn btn-outline p-2 text-gray-600 hover:text-gray-900"
                    title="Refresh consultations"
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
              </div>

              {appointmentsLoading ? (
                <div className="py-12 text-center text-muted">Loading consultations...</div>
              ) : (() => {
                const filtered = orgAppointments.filter(appt => {
                  if (appointmentFilter === 'All') return true;
                  return appt.status?.toLowerCase() === appointmentFilter.toLowerCase();
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center bg-gray-50 rounded-xl border border-gray-100">
                      <Clock size={36} className="mx-auto text-gray-400 mb-2 opacity-50" />
                      <p className="text-gray-600 font-medium">No patient consultations found.</p>
                      <p className="text-xs text-gray-400 mt-1">Consultations scheduled by patients in your operational rooms will appear here.</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-600 uppercase font-semibold border-b border-gray-100">
                        <tr>
                          <th className="py-3 px-4">Date & Time</th>
                          <th className="py-3 px-4">Patient</th>
                          <th className="py-3 px-4">Doctor</th>
                          <th className="py-3 px-4">Room</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Reason / Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filtered.map(appt => (
                          <tr key={appt._id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-3.5 px-4 font-medium text-gray-900 whitespace-nowrap">
                              <div>{new Date(appt.date).toLocaleDateString()}</div>
                              <div className="text-gray-500 font-normal text-xs">{appt.time}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-gray-800">{appt.patient?.name || 'Patient'}</div>
                              <div className="text-gray-500 text-xs">{appt.patient?.email || ''}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-purple-700">Dr. {appt.doctor?.name || 'Doctor'}</div>
                              <div className="text-gray-500 text-xs">{appt.doctor?.specialization || ''}</div>
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="font-semibold text-gray-800">Room {appt.room?.roomNumber || '—'}</span>
                              {appt.room?.floor !== undefined && (
                                <span className="text-gray-500 text-xs block">Floor {appt.room.floor}</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                appt.status === 'Confirmed' ? 'bg-green-100 text-green-700' :
                                appt.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                                appt.status === 'Expired' ? 'bg-gray-100 text-gray-600' :
                                'bg-rose-100 text-rose-700'
                              }`}>
                                {appt.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-gray-600 max-w-xs truncate">
                              {appt.reason || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="card animate-fade-in">
              <h3 className="text-xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-100">System Parameters</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm font-medium text-gray-700">Schedule Lock Version</span>
                  <span className="badge font-mono">{organization.scheduleVersion}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-sm font-medium text-gray-700">Account Created</span>
                  <span className="text-sm text-muted">{new Date(organization.createdAt || Date.now()).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-medium text-gray-700">Facility ID</span>
                  <span className="font-mono text-xs text-muted">{organization.id}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrganizationDashboard;
