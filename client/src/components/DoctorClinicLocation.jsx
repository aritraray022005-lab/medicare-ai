import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapPin, Navigation, Search, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

const DoctorClinicLocation = ({ profile, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  const [address, setAddress] = useState(profile?.clinicLocation?.address || '');
  const [latitude, setLatitude] = useState(profile?.clinicLocation?.latitude || '');
  const [longitude, setLongitude] = useState(profile?.clinicLocation?.longitude || '');

  useEffect(() => {
    if (profile?.clinicLocation) {
      setAddress(profile.clinicLocation.address || '');
      setLatitude(profile.clinicLocation.latitude || '');
      setLongitude(profile.clinicLocation.longitude || '');
    }
  }, [profile]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setLoading(true);
    setError('');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setLoading(false);
        if (!address) {
          setAddress('My Current Location (Please update with actual address)');
        }
      },
      (err) => {
        setLoading(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied. Please allow location access or enter manually.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Location information is unavailable.');
            break;
          case err.TIMEOUT:
            setError('The request to get user location timed out.');
            break;
          default:
            setError('An unknown error occurred while fetching location.');
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleConfirmLocation = async () => {
    if (!address || !latitude || !longitude) {
      setError('Please provide address, latitude, and longitude.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.patch(
        '/api/doctors/profile',
        {
          clinicLocation: {
            address,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude)
          }
        },
        { withCredentials: true }
      );

      if (response.data.status === 'success') {
        setSuccess('Clinic location updated successfully!');
        setIsEditing(false);
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      setError(err.response?.data?.msg || err.response?.data?.message || 'Failed to update clinic location.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm mt-8">
      <h3 className="font-bold text-xl text-gray-800 mb-4 flex items-center gap-2">
        <MapPin className="text-primary" /> Clinic Location
      </h3>
      <p className="text-sm text-gray-500 mb-6">
        Your location will be saved as your clinic location and will be shown to patients for navigation. 
        MedCare AI does not continuously track your location.
      </p>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 mb-4 text-sm">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-600 p-3 rounded-lg flex items-center gap-2 mb-4 text-sm">
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {!isEditing && profile?.clinicLocation?.latitude ? (
        <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-gray-800 mb-1">Current Clinic Location</p>
              <p className="text-gray-600 mb-3">{profile.clinicLocation.address}</p>
              <div className="text-xs text-gray-400 font-mono">
                Lat: {profile.clinicLocation.latitude.toFixed(4)}, Lng: {profile.clinicLocation.longitude.toFixed(4)}
              </div>
            </div>
            <button 
              onClick={() => setIsEditing(true)}
              className="btn btn-outline text-sm"
            >
              Change Location
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="input-group">
            <label className="font-bold text-gray-700 mb-2 block">Clinic Address</label>
            <input 
              type="text" 
              className="input-field"
              placeholder="e.g. ABC Clinic, Salt Lake, Kolkata"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="input-group">
              <label className="font-bold text-gray-700 mb-2 block">Latitude</label>
              <input 
                type="number" 
                step="any"
                className="input-field bg-gray-50"
                placeholder="22.5867"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="font-bold text-gray-700 mb-2 block">Longitude</label>
              <input 
                type="number" 
                step="any"
                className="input-field bg-gray-50"
                placeholder="88.4171"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button 
              onClick={handleUseCurrentLocation}
              disabled={loading}
              className="btn bg-blue-50 text-blue-600 hover:bg-blue-100 border-none flex items-center justify-center gap-2 flex-1"
            >
              <Navigation size={18} /> Use My Current Location
            </button>
            <button 
              onClick={handleConfirmLocation}
              disabled={loading || !address || !latitude || !longitude}
              className="btn btn-primary flex items-center justify-center gap-2 flex-1"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
              Confirm Clinic Location
            </button>
          </div>
          
          {profile?.clinicLocation?.latitude && (
            <button 
              onClick={() => setIsEditing(false)}
              className="text-gray-500 text-sm hover:text-gray-700 w-full text-center mt-2"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DoctorClinicLocation;
