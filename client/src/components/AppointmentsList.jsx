import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Trash2, Clock, MapPin, User as UserIcon } from 'lucide-react';

const AppointmentsList = ({ onBookNew }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/patients/appointment', {
        withCredentials: true
      });
      if (response.data.success) {
        setAppointments(response.data.data);
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
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await axios.delete('/api/patients/appointment', {
        data: { appointmentId },
        withCredentials: true
      });
      // Refresh the list
      fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to cancel appointment');
    }
  };

  if (loading) return <div className="p-8 text-center text-muted">Loading appointments...</div>;

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
        <h2 className="text-2xl font-bold">My Appointments</h2>
        <button onClick={onBookNew} className="btn btn-primary btn-sm">Book New</button>
      </div>
      
      {error && <div className="text-red-500 mb-4">{error}</div>}

      {appointments.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center border border-gray-100">
          <Calendar size={48} className="text-muted mx-auto mb-4 opacity-50" />
          <p className="text-muted">You have no upcoming appointments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {appointments.map((appt) => (
            <div key={appt._id} className="border border-gray-100 p-4 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white shadow-sm">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${appt.status === 'Confirmed' ? 'bg-green-100 text-green-700' : appt.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : appt.status === 'Expired' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'}`}>
                    {appt.status}
                  </span>
                  <span className="font-semibold text-lg">{new Date(appt.date).toLocaleDateString()}</span>
                  <span className="flex items-center text-muted text-sm gap-1"><Clock size={14}/> {appt.time}</span>
                </div>
                <div className="text-muted text-sm flex items-center gap-2 mb-1">
                  <UserIcon size={14} /> Doctor ID: {appt.doctor} {/* Ideally we populate the doctor name on backend */}
                </div>
                {appt.reason && <p className="text-sm mt-2"><span className="font-medium text-text-main">Reason:</span> {appt.reason}</p>}
              </div>
              
              {(appt.status === 'Pending' || appt.status === 'Confirmed') && (
                <button 
                  onClick={() => handleCancel(appt._id)}
                  className="btn btn-outline border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 btn-sm shrink-0 flex items-center gap-2"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  <Trash2 size={16} /> Cancel
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AppointmentsList;
