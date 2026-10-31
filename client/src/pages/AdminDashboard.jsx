import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Shield, Users, Stethoscope, Activity, CheckCircle, XCircle, LogOut, UserPlus, Ban, Search, Clock, ChevronLeft, ChevronRight, FileText, Building2, AlertCircle } from 'lucide-react';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, doctors, patients, organizations, affiliations, admins
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [affiliations, setAffiliations] = useState([]);
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
  const [orgSearch, setOrgSearch] = useState('');
  const [orgVerificationFilter, setOrgVerificationFilter] = useState('all');
  const [orgBlockFilter, setOrgBlockFilter] = useState('all');
  const [orgTypeFilter, setOrgTypeFilter] = useState('all');
  const [doctorPage, setDoctorPage] = useState(1);
  const [patientPage, setPatientPage] = useState(1);
  const [orgPage, setOrgPage] = useState(1);

  // Affiliations state
  const [affSearch, setAffSearch] = useState('');
  const [affStatusFilter, setAffStatusFilter] = useState('all');
  const [affPage, setAffPage] = useState(1);
  const [resolveModal, setResolveModal] = useState({ open: false, affiliation: null, action: 'approve', reason: '' });

  const ITEMS_PER_PAGE = 5;

  // New admin form
  const [newAdmin, setNewAdmin] = useState({ email: '', password: '' });

  const fetchAffiliations = async () => {
    try {
      const res = await axios.get('/api/admin/affiliations', { withCredentials: true });
      if (res.data && res.data.affiliations) {
        setAffiliations(res.data.affiliations);
      }
    } catch (err) {
      console.error('Failed to load affiliations', err);
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [docRes, patRes, orgRes, affRes] = await Promise.all([
        axios.get('/api/admin/get-doctors', { withCredentials: true }),
        axios.get('/api/admin/get-patients', { withCredentials: true }).catch(() => ({ data: { patients: [] } })),
        axios.get('/api/admin/organizations', { withCredentials: true }).catch(() => ({ data: { organizations: [] } })),
        axios.get('/api/admin/affiliations', { withCredentials: true }).catch(() => ({ data: { affiliations: [] } }))
      ]);
      
      if (docRes.data.status === 'success') {
        setDoctors(docRes.data.doctors);
      }
      if (patRes.data && patRes.data.patients) {
        setPatients(patRes.data.patients);
      }
      if (orgRes.data && orgRes.data.organizations) {
        setOrganizations(orgRes.data.organizations);
      }
      if (affRes.data && affRes.data.affiliations) {
        setAffiliations(affRes.data.affiliations);
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

  const handleVerifyOrganization = async (organizationId, isVerified) => {
    setActionLoading(`verify-org-${organizationId}`);
    try {
      await axios.patch('/api/admin/organization/verification', { organizationId, isVerified }, { withCredentials: true });
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.msg || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlockOrganization = async (organizationId, isBlocked) => {
    setActionLoading(`block-org-${organizationId}`);
    try {
      await axios.patch('/api/admin/organization/block', { organizationId, isBlocked }, { withCredentials: true });
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.msg || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveAffiliation = async (e) => {
    e.preventDefault();
    if (!resolveModal.affiliation) return;
    setActionLoading(`resolve-${resolveModal.affiliation._id}`);
    setError('');
    setSuccess('');
    try {
      await axios.patch(`/api/admin/affiliations/${resolveModal.affiliation._id}/resolve`, {
        action: resolveModal.action,
        reason: resolveModal.reason
      }, { withCredentials: true });
      setSuccess(`Affiliation successfully ${resolveModal.action === 'approve' ? 'approved' : resolveModal.action === 'reject' ? 'rejected' : 'revoked'}.`);
      setResolveModal({ open: false, affiliation: null, action: 'approve', reason: '' });
      await fetchAffiliations();
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to resolve affiliation');
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

  // Filter & Paginate Organizations
  const filteredOrganizations = organizations.filter(o => {
    if (orgVerificationFilter === 'verified' && !o.isVerifiedByAdmin) return false;
    if (orgVerificationFilter === 'unverified' && o.isVerifiedByAdmin) return false;
    if (orgBlockFilter === 'blocked' && !o.isBlocked) return false;
    if (orgBlockFilter === 'unblocked' && o.isBlocked) return false;
    if (orgTypeFilter !== 'all' && o.type !== orgTypeFilter) return false;

    if (!orgSearch) return true;
    const term = orgSearch.toLowerCase();
    return (
      o.name?.toLowerCase().includes(term) ||
      o.email?.toLowerCase().includes(term) ||
      o.registrationNumber?.toLowerCase().includes(term) ||
      o.address?.city?.toLowerCase().includes(term)
    );
  });
  const paginatedOrganizations = filteredOrganizations.slice((orgPage - 1) * ITEMS_PER_PAGE, orgPage * ITEMS_PER_PAGE);
  const orgTotalPages = Math.ceil(filteredOrganizations.length / ITEMS_PER_PAGE) || 1;

  // Filter & Paginate Affiliations
  const filteredAffiliations = affiliations.filter(a => {
    if (affStatusFilter !== 'all' && a.status !== affStatusFilter) return false;
    if (!affSearch) return true;
    const term = affSearch.toLowerCase();
    const docName = a.doctor?.name?.toLowerCase() || '';
    const docEmail = a.doctor?.email?.toLowerCase() || '';
    const orgName = a.organization?.name?.toLowerCase() || '';
    const orgEmail = a.organization?.email?.toLowerCase() || '';
    return docName.includes(term) || docEmail.includes(term) || orgName.includes(term) || orgEmail.includes(term);
  });
  const paginatedAffiliations = filteredAffiliations.slice((affPage - 1) * ITEMS_PER_PAGE, affPage * ITEMS_PER_PAGE);
  const affTotalPages = Math.ceil(filteredAffiliations.length / ITEMS_PER_PAGE) || 1;
  
  // Analytics
  const totalDoctors = doctors.length;
  const verifiedDoctors = doctors.filter(d => d.isVerifiedByAdmin).length;
  const totalPatients = patients.length;
  const totalOrganizations = organizations.length;
  const verifiedOrganizations = organizations.filter(o => o.isVerifiedByAdmin).length;
  const totalAffiliations = affiliations.length;
  const pendingAffiliations = affiliations.filter(a => a.status === 'Pending').length;

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
              <button onClick={() => setActiveTab('organizations')} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${activeTab === 'organizations' ? 'bg-red-50 text-red-700 font-medium' : 'hover:bg-gray-50 text-muted'}`}>
                <Building2 size={20} /> Manage Organizations
              </button>
              <button onClick={() => setActiveTab('affiliations')} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${activeTab === 'affiliations' ? 'bg-red-50 text-red-700 font-medium' : 'hover:bg-gray-50 text-muted'}`}>
                <div className="flex items-center gap-3">
                  <FileText size={20} /> Affiliations
                </div>
                {pendingAffiliations > 0 && (
                  <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-bold">
                    {pendingAffiliations}
                  </span>
                )}
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
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 shadow-sm flex flex-col items-center">
                  <div className="text-blue-600 mb-2"><Stethoscope size={28} /></div>
                  <div className="text-2xl font-extrabold text-blue-800">{totalDoctors}</div>
                  <div className="text-xs text-blue-700 font-semibold mt-1 uppercase tracking-wide text-center">Doctors ({verifiedDoctors} Appr.)</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200 shadow-sm flex flex-col items-center">
                  <div className="text-purple-600 mb-2"><Users size={28} /></div>
                  <div className="text-2xl font-extrabold text-purple-800">{totalPatients}</div>
                  <div className="text-xs text-purple-700 font-semibold mt-1 uppercase tracking-wide text-center">Patients</div>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-xl border border-indigo-200 shadow-sm flex flex-col items-center">
                  <div className="text-indigo-600 mb-2"><Building2 size={28} /></div>
                  <div className="text-2xl font-extrabold text-indigo-800">{totalOrganizations}</div>
                  <div className="text-xs text-indigo-700 font-semibold mt-1 uppercase tracking-wide text-center">Facilities</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200 shadow-sm flex flex-col items-center">
                  <div className="text-green-600 mb-2"><CheckCircle size={28} /></div>
                  <div className="text-2xl font-extrabold text-green-800">{verifiedOrganizations}</div>
                  <div className="text-xs text-green-700 font-semibold mt-1 uppercase tracking-wide text-center">Approved Facilities</div>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-xl border border-amber-200 shadow-sm flex flex-col items-center">
                  <div className="text-amber-600 mb-2"><FileText size={28} /></div>
                  <div className="text-2xl font-extrabold text-amber-800">{totalAffiliations}</div>
                  <div className="text-xs text-amber-700 font-semibold mt-1 uppercase tracking-wide text-center">Affiliations ({pendingAffiliations} Pend.)</div>
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

          {activeTab === 'organizations' && (
            <div className="card min-h-[500px] animate-fade-in flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-gray-100 gap-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Building2 className="text-red-600" size={24} />
                  Manage Healthcare Organizations
                </h2>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <select
                    className="input-field py-2 text-sm bg-white"
                    value={orgTypeFilter}
                    onChange={(e) => { setOrgTypeFilter(e.target.value); setOrgPage(1); }}
                  >
                    <option value="all">All Facility Types</option>
                    <option value="Hospital">Hospitals</option>
                    <option value="Clinic">Clinics</option>
                    <option value="Medical Centre">Medical Centres</option>
                  </select>

                  <select
                    className="input-field py-2 text-sm bg-white"
                    value={orgVerificationFilter}
                    onChange={(e) => { setOrgVerificationFilter(e.target.value); setOrgPage(1); }}
                  >
                    <option value="all">All Verification</option>
                    <option value="verified">Admin Verified</option>
                    <option value="unverified">Pending Approval</option>
                  </select>

                  <select
                    className="input-field py-2 text-sm bg-white"
                    value={orgBlockFilter}
                    onChange={(e) => { setOrgBlockFilter(e.target.value); setOrgPage(1); }}
                  >
                    <option value="all">All Access</option>
                    <option value="unblocked">Active Only</option>
                    <option value="blocked">Suspended Only</option>
                  </select>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative mb-6">
                <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by facility name, email, registration number, or city..."
                  value={orgSearch}
                  onChange={(e) => { setOrgSearch(e.target.value); setOrgPage(1); }}
                  className="input-field pl-10"
                />
              </div>

              {/* Organizations List */}
              <div className="flex-1 flex flex-col gap-4">
                {paginatedOrganizations.length === 0 ? (
                  <div className="text-center py-12 text-muted">
                    No healthcare organizations match the search and filter criteria.
                  </div>
                ) : (
                  paginatedOrganizations.map((org) => (
                    <div
                      key={org._id}
                      className="p-5 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-all shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4"
                    >
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <h3 className="font-bold text-lg text-gray-900">{org.name}</h3>
                          <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold uppercase">
                            {org.type}
                          </span>
                          {org.isBlocked ? (
                            <span className="text-xs bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <Ban size={12} /> Suspended
                            </span>
                          ) : org.isVerifiedByAdmin ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <CheckCircle size={12} /> Approved Network
                            </span>
                          ) : (
                            <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <Clock size={12} /> Pending Approval
                            </span>
                          )}
                          {org.isEmailVerified && (
                            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                              Email Verified
                            </span>
                          )}
                        </div>

                        <div className="text-sm text-gray-600 flex flex-wrap gap-x-6 gap-y-1 mt-2">
                          <div>
                            <span className="text-muted font-medium">Reg No: </span>
                            <span className="font-mono text-gray-800 font-semibold">{org.registrationNumber}</span>
                          </div>
                          <div>
                            <span className="text-muted font-medium">Email: </span>
                            <span className="text-gray-800">{org.email}</span>
                          </div>
                          <div>
                            <span className="text-muted font-medium">Phone: </span>
                            <span className="text-gray-800">{org.phone}</span>
                          </div>
                          <div>
                            <span className="text-muted font-medium">Location: </span>
                            <span className="text-gray-800">
                              {[org.address?.city, org.address?.state].filter(Boolean).join(', ') || 'N/A'}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted font-medium">Timezone: </span>
                            <span className="text-gray-800">{org.timezone || 'Asia/Kolkata'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100">
                        {/* Approval Toggle */}
                        {org.isVerifiedByAdmin ? (
                          <button
                            onClick={() => handleVerifyOrganization(org._id, false)}
                            disabled={actionLoading === `verify-org-${org._id}`}
                            className="btn btn-outline text-amber-700 hover:bg-amber-50 text-xs py-2 px-3 flex items-center gap-1.5"
                          >
                            <XCircle size={14} />
                            {actionLoading === `verify-org-${org._id}` ? 'Updating...' : 'Revoke Approval'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleVerifyOrganization(org._id, true)}
                            disabled={actionLoading === `verify-org-${org._id}`}
                            className="btn bg-green-600 hover:bg-green-700 text-white text-xs py-2 px-3 flex items-center gap-1.5 border-none"
                          >
                            <CheckCircle size={14} />
                            {actionLoading === `verify-org-${org._id}` ? 'Approving...' : 'Approve Facility'}
                          </button>
                        )}

                        {/* Block/Unblock Toggle */}
                        {org.isBlocked ? (
                          <button
                            onClick={() => handleBlockOrganization(org._id, false)}
                            disabled={actionLoading === `block-org-${org._id}`}
                            className="btn bg-gray-800 hover:bg-gray-900 text-white text-xs py-2 px-3 flex items-center gap-1.5 border-none"
                          >
                            <CheckCircle size={14} />
                            {actionLoading === `block-org-${org._id}` ? 'Lifting...' : 'Lift Suspension'}
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to suspend access for ${org.name}?`)) {
                                handleBlockOrganization(org._id, true);
                              }
                            }}
                            disabled={actionLoading === `block-org-${org._id}`}
                            className="btn bg-red-600 hover:bg-red-700 text-white text-xs py-2 px-3 flex items-center gap-1.5 border-none"
                          >
                            <Ban size={14} />
                            {actionLoading === `block-org-${org._id}` ? 'Suspending...' : 'Suspend Access'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              {orgTotalPages > 1 && (
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
                  <span className="text-sm text-muted">
                    Showing {(orgPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(orgPage * ITEMS_PER_PAGE, filteredOrganizations.length)} of {filteredOrganizations.length} facilities
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setOrgPage((p) => Math.max(1, p - 1))}
                      disabled={orgPage === 1}
                      className="p-1.5 rounded-md border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="text-sm font-medium px-2">{orgPage} / {orgTotalPages}</span>
                    <button
                      onClick={() => setOrgPage((p) => Math.min(orgTotalPages, p + 1))}
                      disabled={orgPage === orgTotalPages}
                      className="p-1.5 rounded-md border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'affiliations' && (
            <div className="card min-h-[500px] animate-fade-in flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-gray-100 gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    Doctor-Organization Affiliations
                    <span className="text-sm font-normal text-muted bg-gray-100 px-3 py-1 rounded-full hidden md:inline-block">
                      Administrative Control & Resolution
                    </span>
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Review and resolve affiliation states. Approved doctors can utilize facility room allocations without requiring independent doctor admin verification.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <select
                    className="input-field py-2 text-sm bg-white"
                    value={affStatusFilter}
                    onChange={(e) => { setAffStatusFilter(e.target.value); setAffPage(1); }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Revoked">Revoked</option>
                    <option value="Withdrawn">Withdrawn</option>
                  </select>
                  <div className="input-wrap w-full sm:w-64 shrink-0">
                    <span className="input-icon" aria-hidden="true"><Search size={16} /></span>
                    <input
                      type="text"
                      placeholder="Search doctor or facility..."
                      className="input-field input-with-icon input-sm"
                      value={affSearch}
                      onChange={(e) => {
                        setAffSearch(e.target.value);
                        setAffPage(1);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Affiliations List */}
              <div className="space-y-4 flex-1">
                {paginatedAffiliations.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <FileText className="mx-auto text-gray-400 mb-2" size={32} />
                    <p className="text-gray-600 font-medium">No affiliations found matching the criteria.</p>
                  </div>
                ) : (
                  paginatedAffiliations.map((aff) => {
                    const statusColors = {
                      Pending: 'bg-amber-100 text-amber-800 border-amber-200',
                      Approved: 'bg-green-100 text-green-800 border-green-200',
                      Rejected: 'bg-red-100 text-red-800 border-red-200',
                      Revoked: 'bg-gray-100 text-gray-800 border-gray-200',
                      Withdrawn: 'bg-slate-100 text-slate-700 border-slate-200'
                    };

                    return (
                      <div key={aff._id} className="p-5 border border-gray-200 rounded-xl hover:border-gray-300 transition-all bg-white shadow-sm flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-gray-100">
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[aff.status] || 'bg-gray-100 text-gray-700'}`}>
                              {aff.status}
                            </span>
                            <span className="text-xs text-gray-400">
                              Requested: {new Date(aff.createdAt).toLocaleDateString()}
                            </span>
                            {aff.approvedAt && (
                              <span className="text-xs text-green-600">
                                Approved: {new Date(aff.approvedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => setResolveModal({
                              open: true,
                              affiliation: aff,
                              action: aff.status === 'Approved' ? 'revoke' : 'approve',
                              reason: ''
                            })}
                            className="btn btn-outline text-red-600 hover:bg-red-50 text-xs py-1.5 px-3 flex items-center gap-1.5"
                          >
                            <Shield size={14} /> Resolve / Override
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Doctor Info */}
                          <div className="bg-blue-50/50 p-3.5 rounded-lg border border-blue-100">
                            <div className="flex items-center gap-2 text-xs font-bold text-blue-800 uppercase tracking-wide mb-1.5">
                              <Stethoscope size={14} /> Doctor Information
                            </div>
                            <div className="text-sm font-bold text-gray-900">{aff.doctor?.name || 'Unknown Doctor'}</div>
                            <div className="text-xs text-gray-600">{aff.doctor?.email}</div>
                            <div className="text-xs text-gray-500 mt-0.5">Specialization: {aff.doctor?.specialization || 'General'}</div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${aff.doctor?.isVerifiedByAdmin ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {aff.doctor?.isVerifiedByAdmin ? 'Admin Verified' : 'Not Admin Verified (Permitted via Affiliation)'}
                              </span>
                              {aff.doctor?.isBlocked && (
                                <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-red-100 text-red-700">
                                  Doctor Blocked
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Organization Info */}
                          <div className="bg-purple-50/50 p-3.5 rounded-lg border border-purple-100">
                            <div className="flex items-center gap-2 text-xs font-bold text-purple-800 uppercase tracking-wide mb-1.5">
                              <Building2 size={14} /> Facility Information
                            </div>
                            <div className="text-sm font-bold text-gray-900">{aff.organization?.name || 'Unknown Facility'}</div>
                            <div className="text-xs text-gray-600">{aff.organization?.email}</div>
                            <div className="text-xs text-gray-500 mt-0.5">Type: {aff.organization?.type || 'Clinic'}</div>
                            <div className="text-xs text-gray-500">
                              {aff.organization?.address ? `${aff.organization.address.city || ''}, ${aff.organization.address.state || ''}` : ''}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${aff.organization?.isVerifiedByAdmin ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {aff.organization?.isVerifiedByAdmin ? 'Facility Verified' : 'Facility Pending Admin'}
                              </span>
                              {aff.organization?.isBlocked && (
                                <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-red-100 text-red-700">
                                  Facility Blocked
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Notes and Audit Trail */}
                        {(aff.requestNotes || aff.rejectionReason || aff.revocationReason || aff.resolvedBy) && (
                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-xs space-y-1.5">
                            {aff.requestNotes && (
                              <p className="text-gray-700"><span className="font-semibold text-gray-900">Request Notes:</span> {aff.requestNotes}</p>
                            )}
                            {aff.rejectionReason && (
                              <p className="text-red-700"><span className="font-semibold">Rejection Reason:</span> {aff.rejectionReason}</p>
                            )}
                            {aff.revocationReason && (
                              <p className="text-amber-800"><span className="font-semibold">Revocation Reason:</span> {aff.revocationReason}</p>
                            )}
                            {aff.resolvedBy && (
                              <div className="pt-1.5 border-t border-gray-200 text-purple-800">
                                <span className="font-semibold">Administratively Resolved</span> by {aff.resolvedBy?.email || 'Admin'} on {new Date(aff.resolvedAt).toLocaleString()}
                                {aff.resolutionNotes && <span> — "{aff.resolutionNotes}"</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination */}
              {affTotalPages > 1 && (
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
                  <span className="text-sm text-muted">
                    Showing {(affPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(affPage * ITEMS_PER_PAGE, filteredAffiliations.length)} of {filteredAffiliations.length} affiliations
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAffPage((p) => Math.max(1, p - 1))}
                      disabled={affPage === 1}
                      className="p-1.5 rounded-md border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="text-sm font-medium px-2">{affPage} / {affTotalPages}</span>
                    <button
                      onClick={() => setAffPage((p) => Math.min(affTotalPages, p + 1))}
                      disabled={affPage === affTotalPages}
                      className="p-1.5 rounded-md border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Admin Resolution Modal */}
          {resolveModal.open && resolveModal.affiliation && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-fade-in">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Shield className="text-red-600" size={20} />
                      Administrative Affiliation Resolution
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Doctor: {resolveModal.affiliation.doctor?.name} | Facility: {resolveModal.affiliation.organization?.name}
                    </p>
                  </div>
                  <button
                    onClick={() => setResolveModal({ open: false, affiliation: null, action: 'approve', reason: '' })}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle size={20} />
                  </button>
                </div>

                <form onSubmit={handleResolveAffiliation} className="space-y-4">
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <div>
                      Current status: <span className="font-bold">{resolveModal.affiliation.status}</span>. Administrative resolution executes with concurrency locks and logs your admin ID with a transactional audit outbox notification.
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                      Resolution Action
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['approve', 'reject', 'revoke'].map((act) => (
                        <button
                          key={act}
                          type="button"
                          onClick={() => setResolveModal({ ...resolveModal, action: act })}
                          className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center capitalize transition-colors ${
                            resolveModal.action === act
                              ? act === 'approve'
                                ? 'bg-green-600 text-white border-green-600'
                                : act === 'reject'
                                ? 'bg-red-600 text-white border-red-600'
                                : 'bg-gray-800 text-white border-gray-800'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {act}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                      Resolution Notes / Reason (Optional)
                    </label>
                    <textarea
                      rows={3}
                      className="input-field text-sm w-full"
                      placeholder="Enter justification or audit resolution details..."
                      value={resolveModal.reason}
                      onChange={(e) => setResolveModal({ ...resolveModal, reason: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setResolveModal({ open: false, affiliation: null, action: 'approve', reason: '' })}
                      className="btn btn-outline text-gray-600 text-xs py-2 px-4"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading === `resolve-${resolveModal.affiliation._id}`}
                      className="btn bg-red-600 hover:bg-red-700 text-white text-xs py-2 px-5 border-none font-semibold"
                    >
                      {actionLoading === `resolve-${resolveModal.affiliation._id}` ? 'Applying...' : 'Apply Resolution'}
                    </button>
                  </div>
                </form>
              </div>
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
