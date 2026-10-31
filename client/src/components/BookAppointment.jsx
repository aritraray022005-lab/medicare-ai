import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Stethoscope, MapPin, Clock, Calendar as CalendarIcon, Filter, Navigation, Building2, CheckCircle, Search } from 'lucide-react';

const BookAppointment = ({ onBack, onSuccess, isVerified, initialSpecialty }) => {
  // Mode: 'Independent' | 'Organization'
  const [consultationMode, setConsultationMode] = useState('Independent');

  // Independent Doctors State
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [specialtyFilter, setSpecialtyFilter] = useState(initialSpecialty || '');

  // Organization Consultation State
  const [organizations, setOrganizations] = useState([]);
  const [orgSearch, setOrgSearch] = useState('');
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [orgDoctors, setOrgDoctors] = useState([]);
  const [loadingOrgDoctors, setLoadingOrgDoctors] = useState(false);
  const [selectedOrgDoctor, setSelectedOrgDoctor] = useState(null);
  const [orgAvailability, setOrgAvailability] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Common Form State
  const [formData, setFormData] = useState({ date: '', time: '', reason: '' });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // Fetch independent doctors
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await axios.get('/api/patients/appointment/doctors', {
          withCredentials: true
        });
        if (response.data.status === 'success') {
          setDoctors(response.data.data);
        }
      } catch (err) {
        setError('Failed to load independent doctors.');
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, []);

  // Fetch approved organizations
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await axios.get('/api/patients/organizations', {
          withCredentials: true
        });
        if (response.data.status === 'success') {
          setOrganizations(response.data.organizations || []);
        }
      } catch (err) {
        console.error('Failed to load organizations', err);
      }
    };
    fetchOrganizations();
  }, []);

  // When an organization is selected, fetch its affiliated doctors
  const handleSelectOrganization = async (org) => {
    setSelectedOrg(org);
    setSelectedOrgDoctor(null);
    setOrgAvailability([]);
    setSelectedSlot(null);
    setFormData({ date: '', time: '', reason: '' });
    setBookingError('');
    setLoadingOrgDoctors(true);
    try {
      const res = await axios.get(`/api/patients/organizations/${org._id}/doctors`, {
        withCredentials: true
      });
      if (res.data.status === 'success') {
        setOrgDoctors(res.data.doctors || []);
      }
    } catch (err) {
      setBookingError(err.response?.data?.msg || 'Failed to load doctors for this organization.');
    } finally {
      setLoadingOrgDoctors(false);
    }
  };

  // When an affiliated doctor is selected, fetch their availability at this organization
  const handleSelectOrgDoctor = async (doc) => {
    setSelectedOrgDoctor(doc);
    setSelectedSlot(null);
    setFormData({ date: '', time: '', reason: '' });
    setBookingError('');
    setLoadingAvailability(true);
    try {
      const res = await axios.get(`/api/patients/organizations/${selectedOrg._id}/availability?doctorId=${doc._id}`, {
        withCredentials: true
      });
      if (res.data.status === 'success') {
        setOrgAvailability(res.data.availability || []);
      }
    } catch (err) {
      setBookingError(err.response?.data?.msg || 'Failed to load consultation availability.');
    } finally {
      setLoadingAvailability(false);
    }
  };

  const handleIndependentDoctorSelect = (doctor) => {
    setSelectedDoctor(doctor);
    setFormData({ date: '', time: '', reason: '' });
    setBookingError('');
  };

  const getAvailableSlotsForDate = () => {
    if (!selectedDoctor || !formData.date) return [];
    const dateObj = new Date(formData.date);
    if (isNaN(dateObj.getTime())) return [];
    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    return selectedDoctor.availability?.[dayName] || [];
  };

  const handleIndependentSubmit = async (e) => {
    e.preventDefault();
    setBookingLoading(true);
    setBookingError('');

    try {
      const payload = {
        bookingType: 'Independent',
        doctorId: selectedDoctor._id,
        date: formData.date,
        time: formData.time,
        reason: formData.reason
      };

      const response = await axios.post('/api/patients/appointment', payload, {
        withCredentials: true
      });

      if (response.data.status === 'success') {
        alert('Independent appointment booked successfully!');
        onSuccess();
      }
    } catch (err) {
      setBookingError(err.response?.data?.msg || err.response?.data?.message || 'Failed to book appointment.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleOrganizationSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) {
      setBookingError('Please select a consultation slot.');
      return;
    }
    setBookingLoading(true);
    setBookingError('');

    try {
      const payload = {
        bookingType: 'Organization',
        doctorId: selectedOrgDoctor._id,
        organizationId: selectedOrg._id,
        roomId: selectedSlot.roomId,
        roomBookingId: selectedSlot.roomBookingId,
        date: selectedSlot.dateStr,
        time: selectedSlot.timeStr,
        durationMinutes: 30,
        reason: formData.reason
      };

      const response = await axios.post('/api/patients/appointment', payload, {
        withCredentials: true
      });

      if (response.data.status === 'success') {
        alert('Hospital appointment booked successfully!');
        onSuccess();
      }
    } catch (err) {
      setBookingError(err.response?.data?.msg || err.response?.data?.message || 'Failed to book hospital appointment.');
    } finally {
      setBookingLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0];

  const filteredIndependentDoctors = specialtyFilter
    ? doctors.filter(d => d.specialization?.toLowerCase() === specialtyFilter.toLowerCase())
    : doctors;

  const uniqueSpecialties = [...new Set(doctors.map(d => d.specialization))].filter(Boolean);

  const filteredOrgs = organizations.filter(org => {
    const term = orgSearch.toLowerCase();
    return (
      org.name?.toLowerCase().includes(term) ||
      org.address?.city?.toLowerCase().includes(term) ||
      org.type?.toLowerCase().includes(term)
    );
  });

  if (loading) return <div className="p-8 text-center text-muted">Loading available options...</div>;

  return (
    <div className="animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold">Book a Consultation</h2>
            <p className="text-sm text-gray-500">Choose between independent clinic doctors or hospital facility consultations</p>
          </div>
        </div>

        {/* Mode Selector Toggle */}
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setConsultationMode('Independent');
              setSelectedDoctor(null);
              setSelectedOrg(null);
              setSelectedOrgDoctor(null);
              setBookingError('');
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              consultationMode === 'Independent'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Independent Clinic
          </button>
          <button
            type="button"
            onClick={() => {
              setConsultationMode('Organization');
              setSelectedDoctor(null);
              setSelectedOrg(null);
              setSelectedOrgDoctor(null);
              setBookingError('');
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              consultationMode === 'Organization'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Hospital / Facility
          </button>
        </div>
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {/* =========================================================================
          MODE 1: INDEPENDENT DOCTOR CONSULTATIONS (Preserved 100%)
          ========================================================================= */}
      {consultationMode === 'Independent' && (
        <>
          {!selectedDoctor ? (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">Select an independent verified doctor consulting through their clinic</p>
                <div className="flex items-center gap-2">
                  <Filter size={18} className="text-gray-500" />
                  <select
                    value={specialtyFilter}
                    onChange={(e) => setSpecialtyFilter(e.target.value)}
                    className="input-field py-2 text-sm bg-gray-50"
                  >
                    <option value="">All Specialties</option>
                    {initialSpecialty && !uniqueSpecialties.includes(initialSpecialty) && (
                      <option value={initialSpecialty}>{initialSpecialty}</option>
                    )}
                    {uniqueSpecialties.map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredIndependentDoctors.length === 0 ? (
                  <p className="text-muted col-span-2">No verified doctors available matching your criteria.</p>
                ) : (
                  filteredIndependentDoctors.map(doc => (
                    <div
                      key={doc._id}
                      className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow cursor-pointer bg-white"
                      onClick={() => handleIndependentDoctorSelect(doc)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {doc.profilePicture ? (
                            <img src={doc.profilePicture} alt={doc.name} className="w-12 h-12 rounded-full object-cover" />
                          ) : (
                            <div className="w-12 h-12 bg-light text-primary rounded-full flex items-center justify-center font-bold text-xl">
                              {doc.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <h3 className="font-bold text-lg">{doc.name}</h3>
                            <p className="text-primary text-sm font-medium">{doc.specialization}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 mt-4 text-sm text-muted">
                        <span className="flex items-center gap-2"><MapPin size={16} /> {doc.location?.cityTownVillage}, {doc.location?.state}</span>
                        <span className="flex items-center gap-2"><Clock size={16} /> {doc.experience} Years Experience</span>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                          <span className="font-semibold text-text-main">₹{doc.consultationFee}</span>
                          <button className="text-primary font-medium text-sm">Select Doctor</button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Selected Independent Doctor Form */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 border border-gray-200 rounded-lg p-5 bg-gray-50 h-fit">
                <h3 className="font-bold text-lg mb-4">Doctor Details</h3>
                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex gap-3">
                    {selectedDoctor.profilePicture ? (
                      <img src={selectedDoctor.profilePicture} alt={selectedDoctor.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold shrink-0">
                        {selectedDoctor.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-base">{selectedDoctor.name}</p>
                      <p className="text-primary">{selectedDoctor.specialization}</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-3 border-t border-gray-200 flex flex-col gap-2">
                    <span className="flex items-center gap-2 text-muted"><Stethoscope size={16}/> {selectedDoctor.qualification}</span>
                    <span className="flex items-center gap-2 text-muted"><Clock size={16}/> {selectedDoctor.experience} Years Exp.</span>
                    <span className="flex items-center gap-2 text-muted"><MapPin size={16}/> {selectedDoctor.location?.cityTownVillage}, {selectedDoctor.location?.state}</span>
                    <div className="mt-2 text-lg font-bold">Fee: ₹{selectedDoctor.consultationFee}</div>
                  </div>

                  {selectedDoctor.clinicLocation?.latitude ? (
                    <div className="mt-4 p-4 bg-white border border-gray-100 rounded-lg shadow-sm">
                      <div className="flex items-center gap-2 font-bold text-gray-800 mb-2">
                        <MapPin className="text-primary" size={18} /> Clinic Location
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{selectedDoctor.clinicLocation.address}</p>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedDoctor.clinicLocation.latitude},${selectedDoctor.clinicLocation.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn bg-blue-50 text-blue-600 hover:bg-blue-100 border-none text-xs w-full justify-center flex items-center gap-2"
                      >
                        <Navigation size={14} /> Get Directions
                      </a>
                    </div>
                  ) : (
                    <div className="mt-4 p-4 bg-white border border-gray-100 rounded-lg text-center">
                      <p className="text-sm text-gray-500">Clinic location not available</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                {!isVerified ? (
                  <div className="bg-yellow-50 text-yellow-700 p-6 rounded-lg flex flex-col items-center justify-center h-full text-center border border-yellow-200">
                    <p className="font-medium text-lg mb-2">Verification Required</p>
                    <p className="text-sm">Please verify your email address to book an appointment with this doctor.</p>
                  </div>
                ) : (
                  <>
                    {bookingError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{bookingError}</div>}

                    <form onSubmit={handleIndependentSubmit} className="flex flex-col gap-4">
                      <div className="input-group">
                        <label className="input-label">Date</label>
                        <input
                          type="date"
                          className="input-field"
                          min={today}
                          max={maxDate}
                          value={formData.date}
                          onChange={(e) => setFormData({...formData, date: e.target.value, time: ''})}
                          required
                        />
                      </div>

                      {formData.date && (
                        <div className="input-group">
                          <label className="input-label">Available Time Slots</label>
                          {getAvailableSlotsForDate().length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                              {getAvailableSlotsForDate().map(slot => {
                                let isPast = false;
                                if (formData.date === today) {
                                  const currentTimeStr = new Date().toTimeString().split(' ')[0].substring(0, 5);
                                  if (slot < currentTimeStr) isPast = true;
                                }

                                return (
                                  <div
                                    key={slot}
                                    onClick={() => !isPast && setFormData({...formData, time: slot})}
                                    className={`p-2 border rounded-md text-center text-sm font-medium transition-colors ${
                                      isPast
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                                        : formData.time === slot
                                          ? 'bg-primary text-white border-primary cursor-pointer'
                                          : 'bg-white hover:border-primary text-text-main cursor-pointer'
                                    }`}
                                  >
                                    {slot}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-red-500 text-sm mt-1">No slots available on this day.</p>
                          )}
                          <input type="hidden" value={formData.time} required />
                        </div>
                      )}

                      <div className="input-group">
                        <label className="input-label">Reason for Visit (Optional)</label>
                        <textarea
                          className="input-field"
                          rows="3"
                          placeholder="Briefly describe your symptoms or reason for visit"
                          value={formData.reason}
                          onChange={(e) => setFormData({...formData, reason: e.target.value})}
                          maxLength={500}
                        ></textarea>
                      </div>

                      <div className="mt-4 flex gap-3">
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => setSelectedDoctor(null)}
                        >
                          Change Doctor
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary flex-1"
                          disabled={bookingLoading || !formData.date || !formData.time}
                        >
                          {bookingLoading ? 'Booking...' : 'Confirm Appointment'}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* =========================================================================
          MODE 2: HOSPITAL / ORGANIZATION CONSULTATIONS (Phase 6)
          ========================================================================= */}
      {consultationMode === 'Organization' && (
        <div>
          {/* Step 1: Select Organization if not selected */}
          {!selectedOrg ? (
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">1. Select an Approved Healthcare Facility</h3>
                  <p className="text-sm text-gray-500">Choose a verified hospital or clinic center to view affiliated doctors and rooms</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search hospitals or cities..."
                    className="input-field pl-9 py-2 text-sm"
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                  />
                </div>
              </div>

              {filteredOrgs.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
                  <Building2 size={40} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600 font-medium">No approved healthcare organizations available.</p>
                  <p className="text-xs text-gray-400 mt-1">Check back later once facilities publish operational consultation hours.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredOrgs.map(org => (
                    <div
                      key={org._id}
                      onClick={() => handleSelectOrganization(org)}
                      className="border border-gray-200 rounded-xl p-5 hover:border-primary hover:shadow-md transition-all cursor-pointer bg-white flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center font-bold">
                            <Building2 size={24} />
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 leading-snug">{org.name}</h4>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                              {org.type}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-gray-500 space-y-1 mb-4">
                          <p className="flex items-center gap-1.5">
                            <MapPin size={13} className="text-gray-400 shrink-0" />
                            {org.address?.street ? `${org.address.street}, ` : ''}{org.address?.city}, {org.address?.state}
                          </p>
                          <p className="flex items-center gap-1.5">
                            <Clock size={13} className="text-gray-400 shrink-0" /> Timezone: {org.timezone || 'Asia/Kolkata'}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                        <span className="text-green-600 font-medium flex items-center gap-1">
                          <CheckCircle size={12} /> Verified Facility
                        </span>
                        <span className="text-primary font-semibold">View Doctors →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Organization Selected: Step 2 & 3 */
            <div>
              {/* Organization Breadcrumb Banner */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600 text-white rounded-lg flex items-center justify-center font-bold">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-purple-950 text-base">{selectedOrg.name}</h3>
                    <p className="text-xs text-purple-700">
                      {selectedOrg.address?.city}, {selectedOrg.address?.state} • {selectedOrg.timezone || 'Asia/Kolkata'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrg(null);
                    setSelectedOrgDoctor(null);
                    setOrgAvailability([]);
                    setSelectedSlot(null);
                  }}
                  className="btn btn-outline border-purple-300 text-purple-800 hover:bg-purple-100 text-xs py-1.5 px-3"
                >
                  Change Facility
                </button>
              </div>

              {/* Step 2: Select Affiliated Doctor */}
              {!selectedOrgDoctor ? (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">2. Select an Affiliated Doctor</h3>
                  <p className="text-sm text-gray-500 mb-4">The following verified doctors hold active consultation privileges at {selectedOrg.name}</p>

                  {loadingOrgDoctors ? (
                    <div className="p-8 text-center text-muted">Loading affiliated doctors...</div>
                  ) : orgDoctors.length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-gray-600">No active affiliated doctors found for this facility currently.</p>
                      <button
                        onClick={() => setSelectedOrg(null)}
                        className="btn btn-outline text-xs mt-3"
                      >
                        Choose Another Facility
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {orgDoctors.map(doc => (
                        <div
                          key={doc._id}
                          onClick={() => handleSelectOrgDoctor(doc)}
                          className="border border-gray-200 rounded-lg p-4 hover:border-purple-500 hover:shadow-md transition-all cursor-pointer bg-white"
                        >
                          <div className="flex items-center gap-3 mb-3">
                            {doc.profilePicture ? (
                              <img src={doc.profilePicture} alt={doc.name} className="w-12 h-12 rounded-full object-cover" />
                            ) : (
                              <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold text-lg">
                                {doc.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <h4 className="font-bold text-gray-900">{doc.name}</h4>
                              <p className="text-purple-600 text-xs font-semibold">{doc.specialization}</p>
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 space-y-1">
                            <p><span className="font-medium">Qualification:</span> {doc.qualification}</p>
                            <p><span className="font-medium">Experience:</span> {doc.experience} Years</p>
                            <p className="font-semibold text-gray-800 mt-2">Consultation Fee: ₹{doc.consultationFee}</p>
                          </div>
                          <button className="mt-3 w-full btn btn-primary text-xs py-1.5">
                            Select Consultation Room & Slot →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Step 3: Select Room Booking & Consultation Time */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Doctor Summary Sidebar */}
                  <div className="md:col-span-1 border border-gray-200 rounded-lg p-5 bg-gray-50 h-fit">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-base text-gray-900">Doctor Profile</h4>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrgDoctor(null);
                          setOrgAvailability([]);
                          setSelectedSlot(null);
                        }}
                        className="text-xs text-primary underline"
                      >
                        Change Doctor
                      </button>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      {selectedOrgDoctor.profilePicture ? (
                        <img src={selectedOrgDoctor.profilePicture} alt={selectedOrgDoctor.name} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold text-lg">
                          {selectedOrgDoctor.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-gray-900">{selectedOrgDoctor.name}</p>
                        <p className="text-xs text-purple-600 font-semibold">{selectedOrgDoctor.specialization}</p>
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 space-y-2 border-t border-gray-200 pt-3">
                      <p><span className="font-medium">Facility:</span> {selectedOrg.name}</p>
                      <p><span className="font-medium">Experience:</span> {selectedOrgDoctor.experience} Years</p>
                      <p className="font-bold text-sm text-gray-900 pt-1">Fee: ₹{selectedOrgDoctor.consultationFee}</p>
                    </div>
                  </div>

                  {/* Consultation Slots & Booking Confirmation */}
                  <div className="md:col-span-2">
                    {!isVerified ? (
                      <div className="bg-yellow-50 text-yellow-700 p-6 rounded-lg flex flex-col items-center justify-center h-full text-center border border-yellow-200">
                        <p className="font-medium text-lg mb-2">Verification Required</p>
                        <p className="text-sm">Please verify your email address to book a hospital consultation.</p>
                      </div>
                    ) : (
                      <>
                        <h4 className="text-lg font-bold text-gray-900 mb-2">3. Select Consultation Room & Time</h4>
                        <p className="text-sm text-gray-500 mb-4">
                          Showing confirmed room allocations for Dr. {selectedOrgDoctor.name} at {selectedOrg.name}
                        </p>

                        {bookingError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{bookingError}</div>}

                        {loadingAvailability ? (
                          <div className="p-8 text-center text-muted">Checking allocated consultation rooms...</div>
                        ) : orgAvailability.length === 0 ? (
                          <div className="p-6 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200 text-sm">
                            <p className="font-semibold mb-1">No Active Room Allocations Available</p>
                            <p className="text-xs">
                              Dr. {selectedOrgDoctor.name} does not have upcoming approved room bookings at this facility right now. Please choose another doctor or check back soon.
                            </p>
                          </div>
                        ) : (
                          <form onSubmit={handleOrganizationSubmit} className="space-y-5">
                            {/* Available Room Booking Windows */}
                            <div>
                              <label className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-2 block">
                                Available Consultation Windows
                              </label>

                              <div className="space-y-4">
                                {orgAvailability.map((window, wIdx) => (
                                  <div key={wIdx} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 mb-3 border-b border-gray-100">
                                      <div>
                                        <span className="font-bold text-gray-900 text-sm">
                                          📅 {new Date(window.dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                          Room {window.room?.roomNumber} {window.room?.building ? `(${window.room.building}, Floor ${window.room.floor})` : ''} • Window: {window.startDateTimeStr} – {window.endDateTimeStr}
                                        </div>
                                      </div>
                                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">
                                        Operational
                                      </span>
                                    </div>

                                    {/* Discrete Appointment Slots */}
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                      {window.slots?.map((timeStr) => {
                                        const isSelected = selectedSlot &&
                                          selectedSlot.roomBookingId === window.roomBookingId &&
                                          selectedSlot.timeStr === timeStr;

                                        return (
                                          <button
                                            key={timeStr}
                                            type="button"
                                            onClick={() => setSelectedSlot({
                                              roomBookingId: window.roomBookingId,
                                              roomId: window.room?._id,
                                              dateStr: window.dateStr,
                                              timeStr
                                            })}
                                            className={`py-2 px-3 text-xs font-semibold rounded-md border text-center transition-all ${
                                              isSelected
                                                ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                                : 'bg-white hover:border-purple-400 text-gray-800'
                                            }`}
                                          >
                                            {timeStr}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Selected Slot Confirmation Summary */}
                            {selectedSlot && (
                              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 flex items-center justify-between">
                                <div>
                                  <span className="font-bold">Selected Consultation: </span>
                                  {selectedSlot.dateStr} at {selectedSlot.timeStr} (30 mins)
                                </div>
                                <span className="font-bold text-purple-700">Dr. {selectedOrgDoctor.name}</span>
                              </div>
                            )}

                            {/* Reason for Visit */}
                            <div className="input-group">
                              <label className="input-label">Reason for Consultation (Optional)</label>
                              <textarea
                                className="input-field"
                                rows="3"
                                placeholder="Describe symptoms or reasons for your hospital visit"
                                value={formData.reason}
                                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                                maxLength={500}
                              ></textarea>
                            </div>

                            <div className="flex gap-3 pt-2">
                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => setSelectedSlot(null)}
                              >
                                Reset Selection
                              </button>
                              <button
                                type="submit"
                                className="btn btn-primary bg-purple-600 hover:bg-purple-700 border-none flex-1"
                                disabled={bookingLoading || !selectedSlot}
                              >
                                {bookingLoading ? 'Submitting Reservation...' : 'Confirm Hospital Consultation'}
                              </button>
                            </div>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BookAppointment;
