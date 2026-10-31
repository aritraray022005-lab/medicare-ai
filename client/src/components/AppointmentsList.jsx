import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Trash2, Clock, MapPin, User as UserIcon, Building2, Stethoscope } from 'lucide-react';

const AppointmentsList = ({ onBookNew }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/patients/appointment', {
        withCredentials: true
      });
      if (response.data.success) {
        setAppointments(response.data.data || []);
      }
    } catch (err) {
      setError('Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleCancel = async (appointmentId) => {
    const reason = window.prompt('Please enter a cancellation reason (optional):', 'Schedule conflict');
    if (reason === null) return; // User cancelled prompt

    setCancellingId(appointmentId);
    try {
      await axios.delete('/api/patients/appointment', {
        data: { appointmentId, reason: reason.trim() || 'Patient requested cancellation' },
        withCredentials: true
      });
      fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.msg || err.response?.data?.message || 'Failed to cancel appointment');
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted">Loading appointments...</div>;

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
        <div>
          <h2 className="text-2xl font-bold">My Consultations</h2>
          <p className="text-sm text-gray-500">View upcoming clinic and hospital appointments</p>
        </div>
        <button onClick={onBookNew} className="btn btn-primary btn-sm">Book New</button>
      </div>
      
      {error && <div className="text-red-500 mb-4">{error}</div>}

      {appointments.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center border border-gray-100">
          <Calendar size={48} className="text-muted mx-auto mb-4 opacity-50" />
          <p className="text-muted">You have no booked consultations.</p>
          <button onClick={onBookNew} className="btn btn-primary btn-sm mt-4">
            Book an Appointment
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {appointments.map((appt) => {
            const isOrg = appt.bookingType === 'Organization';
            const docObj = appt.doctor;
            const docName = docObj?.name ? `Dr. ${docObj.name}` : (typeof appt.doctor === 'string' ? `Doctor ID: ${appt.doctor}` : 'Assigned Doctor');

            return (
              <div
                key={appt._id}
                className="border border-gray-200 p-5 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white shadow-sm hover:shadow transition-shadow"
              >
                <div className="space-y-2 flex-1">
                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 text-xs rounded-full font-bold uppercase tracking-wider ${
                        appt.status === 'Confirmed'
                          ? 'bg-green-100 text-green-800'
                          : appt.status === 'Pending'
                          ? 'bg-amber-100 text-amber-800'
                          : appt.status === 'Expired'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {appt.status}
                    </span>

                    <span
                      className={`px-2 py-0.5 text-xs rounded-full font-medium flex items-center gap-1 ${
                        isOrg
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {isOrg ? <Building2 size={12} /> : <Stethoscope size={12} />}
                      {isOrg ? 'Hospital Consultation' : 'Independent Clinic'}
                    </span>
                  </div>

                  {/* Doctor Info */}
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-lg">{docName}</span>
                    {docObj?.specialization && (
                      <span className="text-xs text-primary font-semibold bg-blue-50 px-2 py-0.5 rounded">
                        {docObj.specialization}
                      </span>
                    )}
                  </div>

                  {/* Date, Time & Facility Details */}
                  <div className="text-xs text-gray-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1 font-semibold text-gray-800">
                      <Calendar size={13} className="text-gray-400" />
                      {new Date(appt.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-gray-800">
                      <Clock size={13} className="text-gray-400" /> {appt.time}
                    </span>

                    {isOrg && appt.organization && (
                      <span className="flex items-center gap-1 text-purple-700">
                        <Building2 size={13} />
                        {appt.organization.name}
                        {appt.room?.roomNumber && ` • Room ${appt.room.roomNumber}`}
                        {appt.room?.floor !== undefined && ` (Floor ${appt.room.floor})`}
                      </span>
                    )}

                    {!isOrg && docObj?.clinicLocation?.address && (
                      <span className="flex items-center gap-1 text-gray-500">
                        <MapPin size={13} /> {docObj.clinicLocation.address}
                      </span>
                    )}
                  </div>

                  {appt.reason && (
                    <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 max-w-xl">
                      <span className="font-semibold text-gray-700">Reason:</span> {appt.reason}
                    </p>
                  )}
                </div>

                {/* Cancellation Action */}
                {(appt.status === 'Pending' || appt.status === 'Confirmed') && (
                  <button
                    onClick={() => handleCancel(appt._id)}
                    disabled={cancellingId === appt._id}
                    className="btn btn-outline border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 btn-sm shrink-0 flex items-center gap-2 text-xs"
                  >
                    <Trash2 size={14} />
                    {cancellingId === appt._id ? 'Cancelling...' : 'Cancel Appointment'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AppointmentsList;
