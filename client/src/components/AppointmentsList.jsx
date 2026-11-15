import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Trash2, Clock, MapPin, Building2, Stethoscope, QrCode, CheckCircle2, X } from 'lucide-react';

const STATUS_STYLES = {
  Confirmed: 'bg-green-100 text-green-800',
  Pending: 'bg-amber-100 text-amber-800',
  'Checked-In': 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-indigo-100 text-indigo-800',
  Completed: 'bg-emerald-100 text-emerald-800',
  Expired: 'bg-gray-100 text-gray-700',
  Missed: 'bg-orange-100 text-orange-800',
  // Legacy name of "Missed" (historical records)
  'No-Show': 'bg-orange-100 text-orange-800',
  Cancelled: 'bg-red-100 text-red-700'
};

const STATUS_LABELS = {
  Pending: 'Awaiting confirmation',
  Confirmed: 'Confirmed',
  'No-Show': 'Missed'
};

const AppointmentsList = ({ onBookNew }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  // QR state for the appointment whose QR panel is open
  const [qrFor, setQrFor] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');

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

  const closeQr = () => {
    setQrFor(null);
    setQrData(null);
    setQrError('');
  };

  const handleShowQr = async (appointmentId) => {
    if (qrFor === appointmentId) {
      closeQr();
      return;
    }
    setQrFor(appointmentId);
    setQrData(null);
    setQrError('');
    setQrLoading(true);
    try {
      const res = await axios.get(`/api/patients/appointment/${appointmentId}/qr`, { withCredentials: true });
      setQrData(res.data);
    } catch (err) {
      setQrError(err.response?.data?.msg || 'Could not load the QR code. Please try again.');
      // The appointment state may have changed (checked in / expired): refresh the list
      fetchAppointments();
    } finally {
      setQrLoading(false);
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
            const docName = docObj?.name ? `Dr. ${docObj.name}` : 'Assigned Doctor';
            const qrAvailable = isOrg && appt.qr?.available;
            const qrOpen = qrFor === appt._id;

            return (
              <div
                key={appt._id}
                className="border border-gray-200 p-5 rounded-xl bg-white shadow-sm hover:shadow transition-shadow"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-2 flex-1">
                    {/* Badges row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 text-xs rounded-full font-bold uppercase tracking-wider ${
                          STATUS_STYLES[appt.status] || 'bg-red-100 text-red-700'
                        }`}
                      >
                        {STATUS_LABELS[appt.status] || appt.status}
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
                    <div className="flex flex-wrap items-center gap-2">
                      {docObj?.profilePicture && (
                        <img src={docObj.profilePicture} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-200" />
                      )}
                      <span className="font-bold text-gray-900 text-lg">{docName}</span>
                      {docObj?.specialization && (
                        <span className="text-xs text-primary font-semibold bg-blue-50 px-2 py-0.5 rounded">
                          {docObj.specialization}
                        </span>
                      )}
                    </div>
                    {(docObj?.qualification || docObj?.experience) && (
                      <p className="text-xs text-gray-500">
                        {[docObj.qualification, docObj.experience ? `${docObj.experience} yrs experience` : null].filter(Boolean).join(' • ')}
                      </p>
                    )}

                    {/* Date, Time & Facility Details (no room / floor information for patients) */}
                    <div className="text-xs text-gray-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1 font-semibold text-gray-800">
                        <Calendar size={13} className="text-gray-400" />
                        {new Date(appt.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-gray-800">
                        <Clock size={13} className="text-gray-400" /> {appt.time}
                      </span>

                      {isOrg && appt.organization && (
                        <span className="flex items-center gap-1 text-purple-700">
                          <Building2 size={13} />
                          {appt.organization.name}
                        </span>
                      )}

                      {!isOrg && docObj?.clinicLocation?.address && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <MapPin size={13} /> {docObj.clinicLocation.address}
                        </span>
                      )}
                    </div>

                    {isOrg && appt.status === 'Confirmed' && !qrAvailable && appt.endDateTime && new Date(appt.endDateTime) > new Date() && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <QrCode size={13} />
                        Your check-in QR code will be available on the day of your appointment.
                      </p>
                    )}

                    {(appt.status === 'Missed' || appt.status === 'No-Show') && (
                      <p className="text-xs text-orange-700">
                        This appointment was missed because no check-in happened before the scheduled end time.
                      </p>
                    )}

                    {(appt.status === 'Checked-In' || appt.status === 'In Progress') && (
                      <p className="text-xs text-blue-700 flex items-center gap-1 font-semibold">
                        <CheckCircle2 size={13} />
                        Checked in{appt.queueNumber ? ` • Queue no. ${appt.queueNumber}` : ''} — please follow the ticket given by the hospital staff.
                      </p>
                    )}

                    {appt.reason && (
                      <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 max-w-xl">
                        <span className="font-semibold text-gray-700">Reason:</span> {appt.reason}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {qrAvailable && (
                      <button
                        onClick={() => handleShowQr(appt._id)}
                        className="btn btn-primary btn-sm flex items-center gap-2 text-xs"
                      >
                        <QrCode size={14} />
                        {qrOpen ? 'Hide check-in QR' : 'Show check-in QR'}
                      </button>
                    )}

                    {/* Cancellation Action */}
                    {(appt.status === 'Pending' || appt.status === 'Confirmed') && (
                      <button
                        onClick={() => handleCancel(appt._id)}
                        disabled={cancellingId === appt._id}
                        className="btn btn-outline border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 btn-sm flex items-center gap-2 text-xs"
                      >
                        <Trash2 size={14} />
                        {cancellingId === appt._id ? 'Cancelling...' : 'Cancel Appointment'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Check-in QR panel */}
                {qrOpen && (
                  <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col items-center text-center">
                    <div className="w-full flex justify-end">
                      <button onClick={closeQr} aria-label="Close QR" className="text-gray-400 hover:text-gray-600">
                        <X size={16} />
                      </button>
                    </div>
                    {qrLoading && <p className="text-sm text-gray-500">Generating your QR code...</p>}
                    {qrError && <p className="text-sm text-red-600">{qrError}</p>}
                    {qrData?.qrCodeDataUrl && (
                      <>
                        <img
                          src={qrData.qrCodeDataUrl}
                          alt="Check-in QR code"
                          className="w-56 h-56 border border-gray-200 rounded-lg p-2 bg-white"
                        />
                        <p className="text-sm font-semibold text-gray-800 mt-3">Show this QR code at the hospital reception</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Hospital staff will scan it and give you a consultation ticket. Valid until{' '}
                          {new Date(qrData.expiresAt).toLocaleString()}. Do not share this code.
                        </p>
                      </>
                    )}
                  </div>
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
