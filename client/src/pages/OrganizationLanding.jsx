import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, Calendar, Users, ShieldCheck, Clock } from 'lucide-react';
import Logo from '../components/Logo';

const features = [
  {
    icon: Building2,
    title: 'Facility & Room Management',
    desc: 'Configure consultation rooms, specialized departments, and operating slots with deterministic concurrency protection.'
  },
  {
    icon: Users,
    title: 'Doctor Affiliations',
    desc: 'Review and approve doctor affiliation requests to expand your healthcare provider network seamlessly.'
  },
  {
    icon: Calendar,
    title: 'Atomic FCFS Scheduling',
    desc: 'First-Come, First-Served queue-based allocation ensuring zero double-bookings across all rooms.'
  },
  {
    icon: ShieldCheck,
    title: 'Admin-Verified Network',
    desc: 'Gain MedCare AI verified organization status to participate in the unified patient appointment network.'
  }
];

const OrganizationLanding = () => (
  <div className="animate-fade-in py-14 px-4">
    <div className="hero min-h-[70vh] flex flex-col items-center justify-center max-w-4xl mx-auto text-center">
      <Logo size={88} text={false} />
      <span className="pill mt-6 mb-4">
        <Building2 size={16} /> Healthcare Facilities Network
      </span>
      <h1 className="display text-4xl md:text-6xl mb-6">
        MEDICARE AI <span className="gradient-text">for Organizations</span>
      </h1>
      <p className="text-lg md:text-xl text-muted max-w-2xl mb-10 leading-relaxed">
        Hospitals, clinics, and medical centres: manage consultation rooms, coordinate doctor affiliations, and deliver seamless verified care under strict scheduling guarantees.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
        <Link to="/organization/login" className="btn btn-primary btn-lg flex-1">
          Organization Login
        </Link>
        <Link to="/organization/register" className="btn btn-outline btn-lg flex-1">
          Register Facility <ArrowRight size={18} />
        </Link>
      </div>
    </div>

    <div className="container max-w-5xl py-12">
      <h2 className="display text-2xl md:text-3xl text-center mb-8">
        Built for modern clinical operations
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="feat-card text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center">
            <div className="w-12 h-12 bg-blue-50 text-primary rounded-full flex items-center justify-center mb-4">
              <Icon size={24} />
            </div>
            <h3 className="font-bold text-lg mb-2 text-gray-800">{title}</h3>
            <p className="text-muted text-sm leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default OrganizationLanding;
