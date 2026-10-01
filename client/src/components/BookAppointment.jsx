import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Stethoscope, MapPin, Clock, Calendar as CalendarIcon, Star, Filter, Navigation } from 'lucide-react';

const BookAppointment = ({ onBack, onSuccess, isVerified, initialSpecialty }) => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [formData, setFormData] = useState({ date: '', time: '', reason: '' });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState(initialSpecialty || '');

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
        setError('Failed to load doctors.');
      } finally {
        setLoading(false);
      }
    };
    fetchDoctors();
  }, []);

  const handleDoctorSelect = (doctor) => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBookingLoading(true);
    setBookingError('');
    
    try {
      const payload = {
        doctorId: selectedDoctor._id,
        date: formData.date,
        time: formData.time,
        reason: formData.reason
      };
      
      const response = await axios.post('/api/patients/appointment', payload, {
        withCredentials: true
      });
      
      if (response.data.status === 'success') {
        alert('Appointment booked successfully!');
        onSuccess();
      }
    } catch (err) {
      setBookingError(err.response?.data?.msg || 'Failed to book appointment.');
    } finally {
      setBookingLoading(false);
    }
  };

  const availableSlots = getAvailableSlotsForDate();
  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0];

  const filteredDoctors = specialtyFilter
    ? doctors.filter(d => d.specialization?.toLowerCase() === specialtyFilter.toLowerCase())
    : doctors;

  // Extract unique specialties for the dropdown
  const uniqueSpecialties = [...new Set(doctors.map(d => d.specialization))].filter(Boolean);

  if (loading) return <div className="p-8 text-center text-muted">Loading available doctors...</div>;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold">{selectedDoctor ? 'Complete Booking' : 'Select a Doctor'}</h2>
        </div>
        
        {!selectedDoctor && (
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
        )}
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {!selectedDoctor ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDoctors.length === 0 ? (
            <p className="text-muted col-span-2">No verified doctors available matching your criteria.</p>
          ) : (
            filteredDoctors.map(doc => (
              <div key={doc._id} className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow cursor-pointer bg-white" onClick={() => handleDoctorSelect(doc)}>
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
                    <button className="text-primary font-medium text-sm">View Details</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
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
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="input-group">
                <label className="input-label">Date</label>
                <input 
                  type="date" 
                  className="input-field" 
                  min={today}
                  max={maxDate}
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value, time: ''})} // reset time when date changes
                  required 
                />
              </div>

              {formData.date && (
                <div className="input-group">
                  <label className="input-label">Available Time Slots</label>
                  {availableSlots.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                      {availableSlots.map(slot => {
                        let isPast = false;
                        if (formData.date === today) {
                          const currentTimeStr = new Date().toTimeString().split(' ')[0].substring(0, 5);
                          if (slot < currentTimeStr) {
                            isPast = true;
                          }
                        }

                        return (
                          <div 
                            key={slot}
                            onClick={() => !isPast && setFormData({...formData, time: slot})}
                            className={`p-2 border rounded-md text-center text-sm font-medium transition-colors 
                              ${isPast 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' 
                                : formData.time === slot 
                                  ? 'bg-primary text-white border-primary cursor-pointer' 
                                  : 'bg-white hover:border-primary text-text-main cursor-pointer'}`}
                          >
                            {slot}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-red-500 text-sm mt-1">No slots available on this day.</p>
                  )}
                  {/* Hidden input to ensure validation works if we want */}
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
                  Cancel
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
    </div>
  );
};

export default BookAppointment;
