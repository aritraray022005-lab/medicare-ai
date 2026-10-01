import Logo from '../components/Logo';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Stethoscope } from 'lucide-react';

const stateCitiesMap = {
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik'],
  'Karnataka': ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubli'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli'],
  'Delhi': ['New Delhi', 'North Delhi', 'South Delhi', 'East Delhi', 'West Delhi'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Noida'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota'],
  'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot']
};

const DoctorRegister = () => {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [formData, setFormData] = useState({
    name: '', email: '', password: '',
    phone: '', specialization: '', experience: '',
    qualification: '', consultationFee: '',
    locationState: '', locationCity: '', nmrNumber: ''
  });
  const [certificateFile, setCertificateFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'locationState') {
      setFormData({ ...formData, locationState: value, locationCity: '' });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setCertificateFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const submitData = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key] !== undefined && formData[key] !== '') {
          submitData.append(key, formData[key]);
        }
      });

      if (certificateFile) {
        submitData.append('medicalRegistrationCertificate', certificateFile);
      }

      // API call to the backend
      const response = await axios.post('/api/doctors/auth/register', submitData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.status === 'success') {
        setSuccess('Registration successful! Redirecting to dashboard...');
        await refresh();
        setTimeout(() => navigate('/doctor/dashboard'), 1500);
      }
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        // Zod validation errors
        setError(errorData.errors.map(e => `${e.field}: ${e.message}`).join(', '));
      } else {
        // Standard backend error
        setError(errorData?.msg || errorData?.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout animate-fade-in">
      <div className="auth-card">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-3"><Logo size={72} /></div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700' }}>Doctor Registration</h2>
          <p className="text-muted text-center mt-2">Join MEDICARE AI as a healthcare professional</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-center text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-center text-sm" style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="input-group">
            <label className="input-label" htmlFor="name">Full Name (Dr.)</label>
            <input
              type="text"
              id="name"
              name="name"
              className="input-field"
              placeholder="Dr. John Doe"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              className="input-field"
              placeholder="doctor@example.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="phone">Phone Number</label>
            <input
              type="text"
              id="phone"
              name="phone"
              className="input-field"
              placeholder="10-digit number"
              value={formData.phone}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="specialization">Specialization</label>
            <select
              id="specialization"
              name="specialization"
              className="input-field"
              value={formData.specialization}
              onChange={handleChange}
              required
            >
              <option value="">Select Specialization</option>
              <option value="General Physician">General Physician</option>
              <option value="Cardiologist">Cardiologist</option>
              <option value="Dermatologist">Dermatologist</option>
              <option value="Neurologist">Neurologist</option>
              <option value="Orthopedic">Orthopedic</option>
              <option value="Pediatrician">Pediatrician</option>
              <option value="Gynecologist">Gynecologist</option>
              <option value="Psychiatrist">Psychiatrist</option>
              <option value="ENT Specialist">ENT Specialist</option>
              <option value="Ophthalmologist">Ophthalmologist</option>
              <option value="Dentist">Dentist</option>
              <option value="Gastroenterologist">Gastroenterologist</option>
              <option value="Pulmonologist">Pulmonologist</option>
              <option value="Nephrologist">Nephrologist</option>
              <option value="Urologist">Urologist</option>
              <option value="Endocrinologist">Endocrinologist</option>
              <option value="Oncologist">Oncologist</option>
              <option value="Radiologist">Radiologist</option>
              <option value="Anesthesiologist">Anesthesiologist</option>
              <option value="General Surgeon">General Surgeon</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="input-group">
              <label className="input-label" htmlFor="experience">Experience (Years)</label>
              <input
                type="number"
                id="experience"
                name="experience"
                className="input-field"
                placeholder="e.g. 5"
                value={formData.experience}
                onChange={handleChange}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="consultationFee">Fee (₹)</label>
              <input
                type="number"
                id="consultationFee"
                name="consultationFee"
                className="input-field"
                placeholder="e.g. 500"
                value={formData.consultationFee}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="qualification">Qualification</label>
            <select
              id="qualification"
              name="qualification"
              className="input-field"
              value={formData.qualification}
              onChange={handleChange}
              required
            >
              <option value="">Select Qualification</option>
              <option value="MBBS">MBBS</option>
              <option value="BDS">BDS</option>
              <option value="BAMS">BAMS</option>
              <option value="BHMS">BHMS</option>
              <option value="BUMS">BUMS</option>
              <option value="BSMS">BSMS</option>
              <option value="MD">MD</option>
              <option value="MS">MS</option>
              <option value="DNB">DNB</option>
              <option value="MDS">MDS</option>
              <option value="DM">DM</option>
              <option value="MCh">MCh</option>
              <option value="Others">Others</option>
            </select>
          </div>

          <div className="input-group">
            <h3 className="font-bold text-gray-800 mb-3 border-b pb-2">Medical Verification</h3>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="nmrNumber">NMR Number</label>
            <input
              type="text"
              id="nmrNumber"
              name="nmrNumber"
              className="input-field"
              placeholder="Enter unique NMR number"
              value={formData.nmrNumber}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="certificate">Medical Registration Certificate (PDF, Max 2MB)</label>
            <input
              type="file"
              id="certificate"
              name="certificate"
              accept=".pdf"
              className="input-field py-2"
              onChange={handleFileChange}
              required
            />
          </div>

          <div className="input-group mt-4">
            <h3 className="font-bold text-gray-800 mb-3 border-b pb-2">Clinic Location</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="input-group">
              <label className="input-label" htmlFor="locationState">State</label>
              <select
                id="locationState"
                name="locationState"
                className="input-field"
                value={formData.locationState}
                onChange={handleChange}
                required
              >
                <option value="">Select State</option>
                <option value="West Bengal">West Bengal</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="Karnataka">Karnataka</option>
                <option value="Tamil Nadu">Tamil Nadu</option>
                <option value="Delhi">Delhi</option>
                <option value="Uttar Pradesh">Uttar Pradesh</option>
                <option value="Rajasthan">Rajasthan</option>
                <option value="Gujarat">Gujarat</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="locationCity">City / Town / Village</label>
              {formData.locationState && formData.locationState !== 'Other' ? (
                <select
                  id="locationCity"
                  name="locationCity"
                  className="input-field"
                  value={formData.locationCity}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select City</option>
                  {stateCitiesMap[formData.locationState]?.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                  <option value="Other">Other</option>
                </select>
              ) : (
                <input
                  type="text"
                  id="locationCity"
                  name="locationCity"
                  className="input-field"
                  placeholder={formData.locationState === 'Other' ? "Enter your city" : "Select a state first"}
                  value={formData.locationCity}
                  onChange={handleChange}
                  required
                  disabled={!formData.locationState}
                />
              )}
            </div>
          </div>

          <div className="input-group mb-6">
            <label className="input-label" htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              className="input-field"
              placeholder="Create a strong password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="8"
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ padding: '0.75rem', fontSize: '1rem' }}>
            {loading ? 'Creating Account...' : 'Register as Doctor'}
          </button>
        </form>

        <p className="text-center text-muted mt-6 text-sm">
          Already have an account? <Link to="/doctor/login" className="text-primary font-medium hover:underline">Sign in here</Link>
        </p>
      </div>
    </div>
  );
};

export default DoctorRegister;
