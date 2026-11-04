import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Stethoscope, CalendarDays, ClipboardList, BadgeCheck, MessagesSquare,
  Building2, UserPlus, ShieldCheck, Clock, LayoutDashboard,
} from 'lucide-react';
import { Ecg, SectionHead, Steps, FeatureCards } from '../components/LandingParts';
import { useAuth } from '../context/AuthContext';

const benefits = [
  { icon: CalendarDays, title: 'Publish your slots', text: 'Set when you are available. Patients can only book times that are genuinely open.' },
  { icon: ClipboardList, title: 'See symptoms first', text: 'Each booking arrives with the patient\u2019s reason and symptoms, so you can prepare.' },
  { icon: BadgeCheck, title: 'Verify appointments', text: 'Confirm or decline requests from one place and keep your day under control.' },
  { icon: MessagesSquare, title: 'Answer health questions', text: 'Help the public with free Q&A and build trust with future patients.' },
];

const steps = [
  { title: 'Create your account', text: 'Register with your name, specialization and professional details.' },
  { title: 'Get verified', text: 'Our admin team reviews your profile so patients can trust it.' },
  { title: 'Open your calendar', text: 'Publish consultation slots and start receiving appointment requests.' },
];

const DoctorLanding = () => {
  const { doctor } = useAuth();
  return (
    <div className="theme-doctor">
      <section className="lp-hero py-12 md:py-20">
        <span className="lp-blob b1" /><span className="lp-blob b2" />
        <div className="container lp-hero-grid">
          <div>
            <span className="pill lp-rise"><Stethoscope size={15} /> MEDICARE AI for Doctors</span>
            <h1 className="display mt-5 lp-rise d1">Spend your time on patients, not on scheduling.</h1>
            <p className="lp-lead lp-rise d2">
              Join our network of verified medical professionals. Publish your slots, review symptoms in advance and verify appointments from a single dashboard.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8 lp-rise d3">
              {doctor ? (
                <Link to="/doctor/dashboard" className="btn btn-role btn-lg"><LayoutDashboard size={18} /> Open my dashboard</Link>
              ) : (
                <>
                  <Link to="/doctor/register" className="btn btn-role btn-lg">Join as a doctor <ArrowRight size={18} /></Link>
                  <Link to="/doctor/login" className="btn btn-role-outline btn-lg">Log in to dashboard</Link>
                </>
              )}
            </div>
            <div className="lp-chips lp-rise d3">
              <span className="lp-chip"><ShieldCheck size={15} /> Admin-verified profile</span>
              <span className="lp-chip"><Clock size={15} /> You control your hours</span>
            </div>
            <div className="mt-8 max-w-md" aria-hidden="true"><Ecg /></div>
          </div>

          {/* Illustrative dashboard preview (decorative) */}
          <div className="lp-visual lp-rise d2" aria-hidden="true">
            <div className="lp-mock">
              <div className="lp-mock-head">
                <span>Today&rsquo;s schedule</span>
                <span className="lp-mock-dots"><i /><i /><i /></span>
              </div>
              <div className="lp-row"><div><b>10:00 AM</b><small>Follow-up visit</small></div><span className="lp-tag ok">Verified</span></div>
              <div className="lp-row"><div><b>10:30 AM</b><small>New patient &middot; chest pain</small></div><span className="lp-tag wait">Needs review</span></div>
              <div className="lp-row"><div><b>11:00 AM</b><small>Slot published</small></div><span className="lp-tag open">Open</span></div>
              <div className="lp-row"><div><b>11:30 AM</b><small>Slot published</small></div><span className="lp-tag open">Open</span></div>
            </div>
            <div className="lp-float f1"><span className="dot"><ClipboardList size={16} /></span><div><b>Symptoms attached</b><span className="sub">Ready before the visit</span></div></div>
            <div className="lp-float f2"><span className="dot"><BadgeCheck size={16} /></span><div><b>Profile verified</b><span className="sub">Trusted by patients</span></div></div>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="container">
          <SectionHead title="Everything a busy clinic day needs" sub="Simple tools that fit around how you already work." />
          <FeatureCards items={benefits} />
        </div>
      </section>

      <section className="lp-section alt">
        <div className="container">
          <SectionHead title="Get started in three steps" sub="Most of the setup is a one-time job." />
          <Steps items={steps} />
        </div>
      </section>

      <section className="lp-section">
        <div className="container max-w-5xl">
          <div className="lp-cta">
            <h2 className="display">Ready to see patients who are ready for you?</h2>
            <p>Create your doctor account today. You can also link up with hospitals and clinics through affiliation requests.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7">
              <Link to={doctor ? '/doctor/dashboard' : '/doctor/register'} className="btn btn-white btn-lg" style={{ width: 'auto' }}>
                {doctor ? 'Open my dashboard' : 'Create a doctor account'} <ArrowRight size={18} />
              </Link>
              <Link to="/organization" className="btn btn-ghost btn-lg" style={{ width: 'auto' }}><Building2 size={18} /> Explore facilities</Link>
            </div>
          </div>
          <p className="text-center text-sm text-muted mt-6">
            Not a doctor? <Link to="/" className="text-primary font-semibold hover:underline">Go to the patient home</Link>
          </p>
        </div>
      </section>
    </div>
  );
};

export default DoctorLanding;
