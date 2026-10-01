import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Shield, Users, Stethoscope, Activity, CheckCircle, XCircle, LogOut, UserPlus, Ban, Search, Clock, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, doctors, patients, admins
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Search, Filters & Pagination
  const [doctorSearch, setDoctorSearch] = useState('');
  const [doctorVerificationFilter, setDoctorVerificationFilter] = useState('all');
  const [doctorBlockFilter, setDoctorBlockFilter] = useState('all');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientBlockFilter, setPatientBlockFilter] = useState('all');
  const [doctorPage, setDoctorPage] = useState(1);
  const [patientPage, setPatientPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // New admin form
  const [newAdmin, setNewAdmin] = useState({ email: '', password: '' });

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [docRes, patRes] = await Promise.all([
        axios.get('/api/admin/get-doctors', { withCredentials: true }),
        axios.get('/api/admin/get-patients', { withCredentials: true }).catch(() => ({ data: { patients: [] } }))
      ]);
      
      if (docRes.data.status === 'success') {
        setDoctors(docRes.data.doctors);
      }
      if (patRes.data && patRes.data.patients) {
        setPatients(patRes.data.patients);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/admin/login');
      } else {
        setError('Failed to load admin data.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await axios.post('/api/admin/auth/logout', {}, { withCredentials: true });
      await refresh();
      navigate('/');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const handleVerifyDoctor = async (doctorId, isVerified) => {
    setActionLoading(`verify-${doctorId}`);
    try {
      await axios.patch('/api/admin/doctor/verification', { doctorId, isVerified }, { withCredentials: true });
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.msg || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlockDoctor = async (doctorId, isBlocked) => {
    setActionLoading(`block-doc-${doctorId}`);
    try {
      await axios.patch('/api/admin/doctor/block', { doctorId, isBlocked }, { withCredentials: true });
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.msg || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlockPatient = async (patientId, isBlocked) => {
    setActionLoading(`block-pat-${patientId}`);
    try {
      await axios.patch('/api/admin/patient/block', { patientId, isBlocked }, { withCredentials: true });
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.msg || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegisterAdmin = async (e) => {
    e.preventDefault();
    setActionLoading('register-admin');
    setError('');
    setSuccess('');
    try {
      const res = await axios.post('/api/admin/auth/register', newAdmin, { withCredentials: true });
      if (res.data.status === 'success') {
        setSuccess('New admin registered successfully!');
        setNewAdmin({ email: '', password: '' });
      }
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to register admin');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-red-600 text-xl font-medium flex items-center gap-2">
          <Activity className="animate-spin" /> Loading Admin Portal...
        </div>
      </div>
    );
  }

  // Filter & Paginate Doctors
  const filteredDoctors = doctors.filter(d => {
    if (!d.isEmailVerified) return false;
    if (doctorVerificationFilter === 'verified' && !d.isVerifiedByAdmin) return false;
    if (doctorVerificationFilter === 'unverified' && d.isVerifiedByAdmin) return false;
    if (doctorBlockFilter === 'blocked' && !d.isBlocked) return false;
    if (doctorBlockFilter === 'unblocked' && d.isBlocked) return false;
    
    if (!doctorSearch) return true;
    const term = doctorSearch.toLowerCase();
    return d.name?.toLowerCase().includes(term) || d.email?.toLowerCase().includes(term);
  });
  const paginatedDoctors = filteredDoctors.slice((doctorPage - 1) * ITEMS_PER_PAGE, doctorPage * ITEMS_PER_PAGE);
  const doctorTotalPages = Math.ceil(filteredDoctors.length / ITEMS_PER_PAGE) || 1;

  // Filter & Paginate Patients
  const filteredPatients = patients.filter(p => {
    if (patientBlockFilter === 'blocked' && !p.isBlocked) return false;
    if (patientBlockFilter === 'unblocked' && p.isBlocked) return false;
    
    if (!patientSearch) return true;
    const term = patientSearch.toLowerCase();
    return p.name?.toLowerCase().includes(term) || p.email?.toLowerCase().includes(term);
  });
  const paginatedPatients = filteredPatients.slice((patientPage - 1) * ITEMS_PER_PAGE, patientPage * ITEMS_PER_PAGE);
  const patientTotalPages = Math.ceil(filteredPatients.length / ITEMS_PER_PAGE) || 1;
  
  // Analytics
  const totalDoctors = doctors.length;
  const verifiedDoctors = doctors.filter(d => d.isVerifiedByAdmin).length;
  const totalPatients = patients.length;

  return (
    <div className="container py-8 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0">
          <div className="card sticky top-24 border-t-4 border-red-500">
            <div className="flex flex-col items-center mb-6">
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl font-bold mb-4 shadow-md">
                <Shield size={36} />
              </div>
              <h3 className="text-lg font-bold text-center">System Admin</h3>
              <span className="mt-2 text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">
                Root Access
              </span>
            </div>
            
            <nav className="flex flex-col gap-2">
              <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-red-50 text-red-700 font-medium' : 'hover:bg-gray-50 text-muted'}`}>
                <Activity size={20} /> Dashboard
              </button>
              <button onClick={() => setActiveTab('doctors')} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'doctors' ? 'bg-red-50 text-red-700 font-medium' : 'hover:bg-gray-50 text-muted'}`}>
                <Stethoscope size={20} /> Manage Doctors
              </button>
              <button onClick={() => setActiveTab('patients')} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'patients' ? 'bg-red-50 text-red-700 font-medium' : 'hover:bg-gray-50 text-muted'}`}>
                <Users size={20} /> Manage Patients
              </button>
              <button onClick={() => setActiveTab('admins')} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'admins' ? 'bg-red-50 text-red-700 font-medium' : 'hover:bg-gray-50 text-muted'}`}>
                <UserPlus size={20} /> Register Admin
              </button>
              <button onClick={handleLogout} className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-gray-100 text-gray-700 mt-4 border border-transparent">
                <LogOut size={20} /> Secure Logout
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
          {success && (
            <div className="bg-green-50 text-green-700 p-4 rounded-lg shadow-sm mb-6 flex items-center gap-2">
              <CheckCircle size={20} /> {success}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="card min-h-[500px] animate-fade-in">
              <h2 className="text-2xl font-bold mb-6 pb-4 border-b border-gray-100 text-gray-800">Platform Analytics</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200 shadow-sm flex flex-col items-center">
                  <div className="text-blue-600 mb-2"><Stethoscope size={36} /></div>
                  <div className="text-4xl font-extrabold text-blue-800">{totalDoctors}</div>
                  <div className="text-sm text-blue-700 font-medium mt-2 uppercase tracking-wide">Total Doctors</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200 shadow-sm flex flex-col items-center">
                  <div className="text-green-600 mb-2"><CheckCircle size={36} /></div>
                  <div className="text-4xl font-extrabold text-green-800">{verifiedDoctors}</div>
                  <div className="text-sm text-green-700 font-medium mt-2 uppercase tracking-wide">Approved Doctors</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200 shadow-sm flex flex-col items-center">
                  <div className="text-purple-600 mb-2"><Users size={36} /></div>
                  <div className="text-4xl font-extrabold text-purple-800">{totalPatients}</div>
                  <div className="text-sm text-purple-700 font-medium mt-2 uppercase tracking-wide">Total Patients</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'doctors' && (
            <div className="card min-h-[500px] animate-fade-in flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-gray-100 gap-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  Manage Doctors
                  <span className="text-sm font-normal text-muted bg-gray-100 px-3 py-1 rounded-full hidden md:inline-block">Email-Verified Only</span>
                </h2>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <select 
                    className="input-field py-2 text-sm bg-white"
                    value={doctorVerificationFilter}
                    onChange={(e) => { setDoctorVerificationFilter(e.target.value); setDoctorPage(1); }}
                  >
                    <option value="all">All Verifications</option>
                    <option value="verified">Verified</option>
                    <option value="unverified">Unverified</option>
                  </select>
                  <select 
                    className="input-field py-2 text-sm bg-white"
                    value={doctorBlockFilter}
                    onChange={(e) => { setDoctorBlockFilter(e.target.value); setDoctorPage(1); }}
                  >
                    <option value="all">All Status</option>
                    <option value="unblocked">Active</option>
                    <option value="blocked">Blocked</option>
                  </select>
                  <div className="input-wrap w-full sm:w-64 shrink-0">
                    <span className="input-icon" aria-hidden="true"><Search size={16} /></span>
                    <input 
                      type="text" 
                      placeholder="Search name or email..." 
                      className="input-field input-with-icon input-sm"
                      value={doctorSearch}
                      onChange={(e) => {
                        setDoctorSearch(e.target.value);
                        setDoctorPage(1);
                      }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-4 flex-1">
                {paginatedDoctors.length === 0 ? (
                  <p className="text-center text-muted py-8">No doctors found matching your search.</p>
                ) : (
                  paginatedDoctors.map(doctor => (
                    <div key={doctor._id} className={`border ${doctor.isBlocked ? 'border-red-200 bg-red-50' : 'border-gray-200'} rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all shadow-sm hover:shadow-md`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          {doctor.profilePicture ? (
                            <img src={doctor.profilePicture} alt={doctor.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center font-bold text-lg">
                              {doctor.name.charAt(0)}
                            </div>
                          )}
                          <h4 className="font-bold text-lg text-gray-900">{doctor.name}</h4>
                          {doctor.isVerifiedByAdmin ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><CheckCircle size={12}/> Verified</span>
                          ) : (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Clock size={12}/> Pending</span>
                          )}
                          {doctor.isBlocked && (
                            <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Ban size={12}/> BLOCKED</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{doctor.specialization} • {doctor.qualification} • {doctor.experience} Yrs Exp</p>
                        <p className="text-sm text-gray-500 font-mono mb-2">{doctor.email}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-2 pt-2 border-t border-gray-100">
                          <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-1 rounded">NMR: {doctor.nmrNumber || 'N/A'}</span>
                          {doctor.medicalRegistrationCertificate && (
                            <a 
                              href={`/${doctor.medicalRegistrationCertificate.replace(/\\/g, '/')}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-xs flex items-center gap-1 text-primary hover:underline font-medium"
                            >
                              <FileText size={14} /> View Certificate
                            </a>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 lg:flex-col lg:w-40 justify-center">
                        <button 
                          onClick={() => handleVerifyDoctor(doctor._id, !doctor.isVerifiedByAdmin)}
                          disabled={actionLoading === `verify-${doctor._id}`}
                          className={`btn text-sm py-1.5 px-3 w-full ${doctor.isVerifiedByAdmin ? 'btn-outline border-orange-200 text-orange-600 hover:bg-orange-50' : 'bg-green-600 text-white hover:bg-green-700 border-none'}`}
                        >
                          {actionLoading === `verify-${doctor._id}` ? 'Processing...' : doctor.isVerifiedByAdmin ? 'Revoke Approval' : 'Approve Doctor'}
                        </button>
                        
                        <button 
                          onClick={() => handleBlockDoctor(doctor._id, !doctor.isBlocked)}
                          disabled={actionLoading === `block-doc-${doctor._id}`}
                          className={`btn text-sm py-1.5 px-3 w-full ${doctor.isBlocked ? 'bg-gray-800 text-white hover:bg-gray-900 border-none' : 'btn-outline border-red-200 text-red-600 hover:bg-red-50'}`}
                        >
                          {actionLoading === `block-doc-${doctor._id}` ? 'Processing...' : doctor.isBlocked ? 'Unblock Doctor' : 'Block Doctor'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Doctor Pagination */}
              {doctorTotalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                  <span className="text-sm text-gray-500">
                    Showing {(doctorPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(doctorPage * ITEMS_PER_PAGE, filteredDoctors.length)} of {filteredDoctors.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setDoctorPage(p => Math.max(1, p - 1))}
                      disabled={doctorPage === 1}
                      className="p-1.5 rounded-md border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="text-sm font-medium px-2">{doctorPage} / {doctorTotalPages}</span>
                    <button 
                      onClick={() => setDoctorPage(p => Math.min(doctorTotalPages, p + 1))}
                      disabled={doctorPage === doctorTotalPages}
                      className="p-1.5 rounded-md border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'patients' && (
            <div className="card min-h-[500px] animate-fade-in flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-gray-100 gap-4">
                <h2 className="text-2xl font-bold text-gray-800">Manage Patients</h2>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <select 
                    className="input-field py-2 text-sm bg-white"
                    value={patientBlockFilter}
                    onChange={(e) => { setPatientBlockFilter(e.target.value); setPatientPage(1); }}
                  >
                    <option value="all">All Status</option>
                    <option value="unblocked">Active</option>
                    <option value="blocked">Blocked</option>
                  </select>
                  <div className="input-wrap w-full sm:w-64 shrink-0">
                    <span className="input-icon" aria-hidden="true"><Search size={16} /></span>
                    <input 
                      type="text" 
                      placeholder="Search name or email..." 
                      className="input-field input-with-icon input-sm"
                      value={patientSearch}
                      onChange={(e) => {
                        setPatientSearch(e.target.value);
                        setPatientPage(1);
                      }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-4 flex-1">
                {paginatedPatients.length === 0 ? (
                  <p className="text-center text-muted py-8">No patients found matching your search.</p>
                ) : (
                  paginatedPatients.map(patient => (
                    <div key={patient._id} className={`border ${patient.isBlocked ? 'border-red-200 bg-red-50' : 'border-gray-200'} rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-sm hover:shadow-md`}>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-bold text-lg text-gray-900">{patient.name}</h4>
                          {patient.isBlocked && (
                            <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Ban size={12}/> BLOCKED</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 font-mono">{patient.email}</p>
                      </div>
                      
                      <div>
                        <button 
                          onClick={() => handleBlockPatient(patient._id, !patient.isBlocked)}
                          disabled={actionLoading === `block-pat-${patient._id}`}
                          className={`btn text-sm py-1.5 px-4 w-full sm:w-auto ${patient.isBlocked ? 'bg-gray-800 text-white hover:bg-gray-900 border-none' : 'btn-outline border-red-200 text-red-600 hover:bg-red-50'}`}
                        >
                          {actionLoading === `block-pat-${patient._id}` ? 'Processing...' : patient.isBlocked ? 'Unblock Patient' : 'Block Patient'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Patient Pagination */}
              {patientTotalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                  <span className="text-sm text-gray-500">
                    Showing {(patientPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(patientPage * ITEMS_PER_PAGE, filteredPatients.length)} of {filteredPatients.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setPatientPage(p => Math.max(1, p - 1))}
                      disabled={patientPage === 1}
                      className="p-1.5 rounded-md border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="text-sm font-medium px-2">{patientPage} / {patientTotalPages}</span>
                    <button 
                      onClick={() => setPatientPage(p => Math.min(patientTotalPages, p + 1))}
                      disabled={patientPage === patientTotalPages}
                      className="p-1.5 rounded-md border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'admins' && (
            <div className="card min-h-[500px] animate-fade-in">
              <h2 className="text-2xl font-bold mb-6 pb-4 border-b border-gray-100 text-gray-800">Register New Admin</h2>
              
              <div className="max-w-md bg-gray-50 p-6 rounded-xl border border-gray-200">
                <form onSubmit={handleRegisterAdmin} className="space-y-4">
                  <div className="input-group">
                    <label className="input-label">Admin Email</label>
                    <input 
                      type="email" 
                      value={newAdmin.email} 
                      onChange={(e) => setNewAdmin({...newAdmin, email: e.target.value})}
                      className="input-field" 
                      placeholder="admin@medicare.ai"
                      required 
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Secure Password</label>
                    <input 
                      type="password" 
                      value={newAdmin.password} 
                      onChange={(e) => setNewAdmin({...newAdmin, password: e.target.value})}
                      className="input-field" 
                      placeholder="••••••••"
                      minLength={8}
                      required 
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="btn bg-red-600 hover:bg-red-700 text-white w-full border-none py-3 mt-4"
                    disabled={actionLoading === 'register-admin'}
                  >
                    {actionLoading === 'register-admin' ? 'Registering...' : 'Create Admin Account'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
