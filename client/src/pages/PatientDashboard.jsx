import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { User, Calendar, Settings, LogOut } from 'lucide-react';

import AppointmentsList from '../components/AppointmentsList';
import BookAppointment from '../components/BookAppointment';
import PatientProfile from '../components/PatientProfile';

const PatientDashboard = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'profile'); 
  const [appointmentView, setAppointmentView] = useState(location.state?.appointmentView || 'list'); 

  useEffect(() => {
    if (location.state?.activeTab) setActiveTab(location.state.activeTab);
    if (location.state?.appointmentView) setAppointmentView(location.state.appointmentView);
  }, [location]);

  const fetchProfile = async () => {
    try {
      const response = await axios.get('/api/patients/profile', {
        withCredentials: true
      });
      if (response.data.status === 'success') {
        setProfile(response.data.user);
      }
    } catch (err) {
      setError('Failed to load profile. Please sign in again.');
      if (err.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await axios.post('/api/patients/auth/logout', {}, { withCredentials: true });
      await refresh();
      navigate('/');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-primary text-xl font-medium">Loading Dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg shadow-sm mb-4 max-w-md text-center">
          {error}
        </div>
        <button onClick={() => navigate('/login')} className="btn btn-primary">Go to Login</button>
      </div>
    );
  }

  return (
    <div className="container py-8 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-8">

        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0">
          <div className="card sticky top-24">
            <div className="flex flex-col items-center mb-6">
              <div className="w-20 h-20 bg-primary text-white rounded-full flex items-center justify-center text-3xl font-bold mb-4 shadow-md">
                {profile?.name?.charAt(0) || 'P'}
              </div>
              <h3 className="text-lg font-bold text-center">{profile?.name}</h3>
              <p className="text-muted text-sm text-center">{profile?.email}</p>
            </div>

            <nav className="flex flex-col gap-2">
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'profile' ? 'bg-light text-primary font-medium' : 'hover:bg-gray-50 text-muted'}`}
              >
                <User size={20} /> My Profile
              </button>
              <button
                onClick={() => { setActiveTab('appointments'); setAppointmentView('list'); }}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'appointments' ? 'bg-light text-primary font-medium' : 'hover:bg-gray-50 text-muted'}`}
              >
                <Calendar size={20} /> Appointments
              </button>
              <button
                className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-gray-50 text-muted"
              >
                <Settings size={20} /> Settings
              </button>
              <button
                onClick={() => navigate('/chat')}
                className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-green-50 text-green-600 mt-4 border border-transparent hover:border-green-100"
              >
                <span className="font-bold">🤖 Chat with AI</span>
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
          <div className="card min-h-[500px]">
            {activeTab === 'profile' && (
              <PatientProfile profile={profile} onProfileUpdate={fetchProfile} />
            )}

            {activeTab === 'appointments' && (
              <div className="animate-fade-in">
                {appointmentView === 'list' ? (
                  <AppointmentsList onBookNew={() => setAppointmentView('book')} />
                ) : (
                  <BookAppointment
                    onBack={() => setAppointmentView('list')}
                    onSuccess={() => setAppointmentView('list')}
                    isVerified={profile?.isEmailVerified}
                    initialSpecialty={location.state?.recommendedSpecialty}
                  />
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PatientDashboard;
