import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Logo from '../components/Logo';

const DoctorLanding = () => (
  <div className="hero min-h-[80vh] flex flex-col items-center justify-center animate-fade-in py-14 px-4">
    <Logo size={96} text={false} />
    <h1 className="display text-4xl md:text-6xl mt-6 mb-6 text-center">
      MEDICARE AI <span className="gradient-text">for Doctors</span>
    </h1>
    <p className="text-lg md:text-xl text-muted max-w-2xl text-center mb-10 leading-relaxed">
      Join our network of verified medical professionals. Publish your slots, review symptoms and verify appointments from one dashboard.
    </p>
    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
      <Link to="/doctor/login" className="btn btn-primary btn-lg flex-1">Login to Dashboard</Link>
      <Link to="/doctor/register" className="btn btn-outline btn-lg flex-1">Register Now <ArrowRight size={18} /></Link>
    </div>
  </div>
);

export default DoctorLanding;
