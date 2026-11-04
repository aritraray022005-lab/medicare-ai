import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, CalendarCheck, ShieldCheck, Stethoscope, MessageCircle, HeartPulse,
  CircleHelp, ArrowRight, BadgeCheck, TriangleAlert, Building2,
} from 'lucide-react';
import heroImg from '../assets/hero-doctor.jpg';
import QASection from '../components/QASection';
import { Ecg, SectionHead, Steps, FeatureCards } from '../components/LandingParts';
import { useAuth } from '../context/AuthContext';

const features = [
  { icon: Sparkles, title: 'AI symptom checker', text: 'Describe how you feel and get an urgency level, likely causes and the right specialty to see.' },
  { icon: CalendarCheck, title: 'Real slot booking', text: 'Doctors publish their availability. You pick an open slot and attach your reason and symptoms.' },
  { icon: ShieldCheck, title: 'Verified doctors', text: 'Every doctor profile is checked by our admin team before it appears.' },
  { icon: Stethoscope, title: 'Smart doctor finder', text: 'Search by specialization, location and available appointment slots.' },
];

const steps = [
  { title: 'Describe how you feel', text: 'Tell the AI assistant your symptoms in plain words. No medical terms needed.' },
  { title: 'Pick a doctor and a slot', text: 'See verified doctors for the right specialty and book a time that is really free.' },
  { title: 'Get it confirmed', text: 'The doctor reviews your symptoms and verifies the appointment for you.' },
];

const Home = () => {
  const { patient } = useAuth();

  const tiles = [
    { to: '/chat', icon: MessageCircle, title: 'Chat with the AI assistant', sub: 'Ask anything, any time' },
    { to: patient ? '/symptom-checker' : '/login', icon: HeartPulse, title: 'Check my symptoms', sub: 'Get an urgency level in seconds' },
    { to: patient ? '/dashboard' : '/register', icon: CalendarCheck, title: 'Book an appointment', sub: 'Find a doctor and an open slot' },
    { to: '/questions', icon: CircleHelp, title: 'Browse health Q&A', sub: 'Answers from verified doctors' },
  ];

  return (
    <div className="theme-patient">
      <section className="lp-hero py-12 md:py-20">
        <span className="lp-blob b1" /><span className="lp-blob b2" />
        <div className="container lp-hero-grid">
          <div>
            <span className="pill lp-rise"><Sparkles size={15} /> Care that starts before the clinic</span>
            <h1 className="display mt-5 lp-rise d1">Understand your symptoms. See a verified doctor. Book a real slot.</h1>
            <p className="lp-lead lp-rise d2">
              MEDICARE AI helps you work out what to do next, then connects you with a doctor who has an open appointment.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8 lp-rise d3">
              <Link to={patient ? '/dashboard' : '/register'} className="btn btn-role btn-lg">
                {patient ? 'Go to my dashboard' : 'Get started free'} <ArrowRight size={18} />
              </Link>
              <Link to={patient ? '/symptom-checker' : '/login'} className="btn btn-role-outline btn-lg">Try the symptom checker</Link>
            </div>
            <div className="lp-chips lp-rise d3">
              <span className="lp-chip"><BadgeCheck size={15} /> Verified doctors</span>
              <span className="lp-chip"><CalendarCheck size={15} /> Real availability</span>
              <span className="lp-chip"><CircleHelp size={15} /> Free expert Q&amp;A</span>
            </div>
            <div className="mt-8 max-w-md" aria-hidden="true"><Ecg /></div>
          </div>

          <div className="lp-visual lp-rise d2">
            <img src={heroImg} alt="Doctor reviewing patient notes on a tablet" className="lp-photo" />
            <div className="lp-float f1" aria-hidden="true">
              <span className="dot"><Sparkles size={16} /></span>
              <div><b>AI triage</b><span className="sub">See a doctor soon</span></div>
            </div>
            <div className="lp-float f2" aria-hidden="true">
              <span className="dot"><BadgeCheck size={16} /></span>
              <div><b>Appointment verified</b><span className="sub">Confirmed by your doctor</span></div>
            </div>
          </div>
        </div>
      </section>

      <div className="lp-notice">
        <TriangleAlert size={16} />
        <span>MEDICARE AI is not for emergencies. If you think your life is at risk, call your local emergency number right away.</span>
      </div>

      <section className="lp-section">
        <div className="container">
          <SectionHead title="What do you need today?" sub="Pick a starting point. You can always change your mind." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {tiles.map(({ to, icon: Icon, title, sub }) => (
              <Link key={title} to={to} className="lp-tile">
                <span className="lp-icon" style={{ width: '2.8rem', height: '2.8rem', flexShrink: 0 }}><Icon size={20} /></span>
                <span><b>{title}</b><span className="sub">{sub}</span></span>
                <ArrowRight size={18} className="arrow" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section alt">
        <div className="container">
          <SectionHead title="How it works" sub="From “I don't feel well” to a confirmed appointment in three steps." />
          <Steps items={steps} />
        </div>
      </section>

      <section className="lp-section">
        <div className="container">
          <SectionHead title="Everything both sides need" sub="Built so patients feel looked after and doctors stay organised." />
          <FeatureCards items={features} />
        </div>
      </section>

      <QASection />

      <section className="lp-section">
        <div className="container">
          <SectionHead title="Are you part of the care team?" sub="MEDICARE AI also has dedicated spaces for doctors and healthcare facilities." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            <div className="theme-doctor lp-card">
              <div className="lp-icon"><Stethoscope size={22} /></div>
              <h3>I'm a doctor</h3>
              <p>Publish your consultation slots, review incoming symptoms and verify appointments from one dashboard.</p>
              <Link to="/doctor" className="btn btn-role btn-lg mt-5" style={{ width: 'auto' }}>Explore doctor tools <ArrowRight size={18} /></Link>
            </div>
            <div className="theme-org lp-card">
              <div className="lp-icon"><Building2 size={22} /></div>
              <h3>I run a clinic or hospital</h3>
              <p>Manage consultation rooms, approve doctor affiliations and keep your schedule free of double-bookings.</p>
              <Link to="/organization" className="btn btn-role btn-lg mt-5" style={{ width: 'auto' }}>Explore facility tools <ArrowRight size={18} /></Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
