import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, CalendarCheck, ShieldCheck, Stethoscope } from 'lucide-react';
import heroImg from '../assets/hero-doctor.jpg';
import QASection from '../components/QASection';
import { useAuth } from '../context/AuthContext';

const features = [
  { icon: Sparkles, title: 'AI symptom checker', text: 'Describe how you feel and get an urgency level, likely causes and the right specialty to see.' },
  { icon: CalendarCheck, title: 'Real slot booking', text: 'Doctors publish availability; patients book an open slot with their reason and symptoms attached.' },
  { icon: ShieldCheck, title: 'Verified doctors', text: 'Connect with doctors whose profiles have been verified by our admin team.'},
  { icon: Stethoscope, title: 'Smart doctor finder', text: 'Find doctors by specialization, location and available appointment slots.'},
];

const Home = () => {
  const { patient } = useAuth();
  return (
  <div className="animate-fade-in">
    <section className="hero py-14 md:py-20">
      <div className="container grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="pill mb-6"><Sparkles size={15} /> Care that starts before the clinic</span>
          <h1 className="display text-5xl md:text-6xl">Check symptoms, book a doctor, get verified care.</h1>
          <p className="text-muted mt-6 max-w-xl text-lg">
            MEDICARE AI is a patient-doctor platform: triage your symptoms in seconds, book a real availability slot, and let the doctor verify the appointment.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-9">
            <Link to={patient ? '/dashboard' : '/register'} className="btn btn-primary btn-lg">{patient ? 'Go to dashboard' : 'Get started free'}</Link>
            <Link to={patient ? '/symptom-checker' : '/login'} className="btn btn-outline btn-lg">Try symptom checker</Link>
          </div>
        </div>
        <img src={heroImg} alt="Doctor reviewing patient notes on a tablet" className="hero-img" />
      </div>
    </section>

    <section className="py-14 md:py-16">
      <div className="container">
        <h2 className="display text-3xl md:text-4xl mb-8">Everything both sides need</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="feat-card">
              <div className="feature-icon"><Icon size={22} /></div>
              <h3>{title}</h3>
              <p className="text-muted text-sm">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <QASection />

    <section className="section-divider py-16 md:py-20">
      <div className="container text-center flex flex-col items-center">
        <h2 className="display text-3xl md:text-4xl">Are you a doctor?</h2>
        <p className="text-muted mt-4 max-w-xl">
          Create a doctor account to publish your consultation slots, review incoming symptoms and verify appointments from one dashboard.
        </p>
        <Link to="/doctor/register" className="btn btn-primary btn-lg mt-7">Create a doctor account</Link>
      </div>
    </section>
  </div>
  );
};

export default Home;
