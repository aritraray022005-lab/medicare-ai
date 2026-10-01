import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import DoctorLogin from './pages/DoctorLogin';
import DoctorRegister from './pages/DoctorRegister';
import DoctorForgotPassword from './pages/DoctorForgotPassword';
import DoctorDashboard from './pages/DoctorDashboard';
import PatientDashboard from './pages/PatientDashboard';
import DoctorLanding from './pages/DoctorLanding';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import ChatPage from './pages/ChatPage';
import SymptomChecker from './pages/SymptomChecker';
import ExploreQA from './pages/ExploreQA';
import AskQuestion from './pages/AskQuestion';
import QuestionDetails from './pages/QuestionDetails';
import DoctorQA from './pages/DoctorQA';
import Footer from './components/Footer';
import axios from 'axios';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute, GuestRoute } from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import './index.css';

const LOGOUT_URL = {
  patient: '/api/patients/auth/logout',
  doctor: '/api/doctors/auth/logout',
  admin: '/api/admin/auth/logout',
};

// The nav only ever lists links the current visitor can actually open.
const AppNavbar = () => {
  const { pathname } = useLocation();
  const auth = useAuth();

  const section = pathname.startsWith('/admin') ? 'admin' : pathname.startsWith('/doctor') ? 'doctor' : 'patient';

  let links = [];
  let actionButton = null;
  let homePath = '/';

  if (section === 'admin') {
    homePath = auth.admin ? '/admin/dashboard' : '/admin/login';
    if (auth.admin) links = [{ to: '/admin/dashboard', label: 'Dashboard' }];
  } else if (section === 'doctor') {
    homePath = '/doctor';
    links = [{ to: '/doctor', label: 'For Doctors', end: true }];
    if (auth.doctor) {
      links.push({ to: '/doctor/dashboard', label: 'Dashboard' }, { to: '/doctor/qa', label: 'Answer Questions' });
    } else {
      links.push({ to: '/doctor/login', label: 'Doctor Login' });
      actionButton = { to: '/doctor/register', label: 'Join as Doctor' };
    }
  } else {
    links = [
      { to: '/', label: 'Home', end: true },
      { to: '/chat', label: 'AI Assistant' },
      { to: '/questions', label: 'Health Q&A' },
    ];
    if (auth.patient) {
      links.splice(2, 0, { to: '/symptom-checker', label: 'Symptom Checker' });
      links.push({ to: '/dashboard', label: 'Dashboard' });
    } else {
      links.push({ to: '/login', label: 'Patient Login' });
      actionButton = { to: '/register', label: 'Get Started' };
    }
  }

  const signedIn = auth[section];
  const handleLogout = async () => {
    try {
      await axios.post(LOGOUT_URL[section], {}, { withCredentials: true });
    } catch (err) {
      console.error('Logout failed', err);
    }
    await auth.refresh();
  };

  return (
    <Navbar
      links={links}
      actionButton={actionButton}
      homePath={homePath}
      onLogout={signedIn ? handleLogout : null}
      logoutTo={section === 'admin' ? '/admin/login' : section === 'doctor' ? '/doctor' : '/'}
    />
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <ScrollToTop />
        <div className="min-h-screen flex flex-col">
          <AppNavbar />
          <div className="flex-1 flex flex-col">
            <Routes>
              {/* Public */}
              <Route path="/" element={<Home />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/questions" element={<ExploreQA />} />
              <Route path="/questions/:id" element={<QuestionDetails />} />
              <Route path="/doctor" element={<DoctorLanding />} />

              {/* Guest only (signed-in users are redirected to their dashboard) */}
              <Route path="/login" element={<GuestRoute role="patient"><Login /></GuestRoute>} />
              <Route path="/register" element={<GuestRoute role="patient"><Register /></GuestRoute>} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/doctor/login" element={<GuestRoute role="doctor"><DoctorLogin /></GuestRoute>} />
              <Route path="/doctor/register" element={<GuestRoute role="doctor"><DoctorRegister /></GuestRoute>} />
              <Route path="/doctor/forgot-password" element={<DoctorForgotPassword />} />
              <Route path="/admin/login" element={<GuestRoute role="admin"><AdminLogin /></GuestRoute>} />

              {/* Patient only */}
              <Route path="/dashboard" element={<ProtectedRoute role="patient"><PatientDashboard /></ProtectedRoute>} />
              <Route path="/symptom-checker" element={<ProtectedRoute role="patient"><SymptomChecker /></ProtectedRoute>} />
              <Route path="/questions/ask" element={<ProtectedRoute role="patient"><AskQuestion /></ProtectedRoute>} />

              {/* Doctor only */}
              <Route path="/doctor/dashboard" element={<ProtectedRoute role="doctor"><DoctorDashboard /></ProtectedRoute>} />
              <Route path="/doctor/qa" element={<ProtectedRoute role="doctor"><DoctorQA /></ProtectedRoute>} />

              {/* Admin only */}
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <Footer />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
