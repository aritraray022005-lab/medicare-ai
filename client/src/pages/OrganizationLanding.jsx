import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Building2, Users, CalendarDays, ShieldCheck, DoorOpen, MailCheck,
  LayoutDashboard, Stethoscope, BadgeCheck,
} from 'lucide-react';
import { Ecg, SectionHead, Steps, FeatureCards } from '../components/LandingParts';
import { useAuth } from '../context/AuthContext';

const features = [
  { icon: DoorOpen, title: 'Rooms and departments', text: 'Set up consultation rooms, departments and opening slots in one place.' },
  { icon: Users, title: 'Doctor affiliations', text: 'Review and approve doctors who want to practise at your facility.' },
  { icon: CalendarDays, title: 'No double-bookings', text: 'Rooms are booked first-come, first-served, so two doctors never get the same room at the same time.' },
  { icon: ShieldCheck, title: 'Verified network', text: 'Get admin-verified status to join the shared patient appointment network.' },
];

const steps = [
  { title: 'Register your facility', text: 'Add your hospital or clinic details and create your account.' },
  { title: 'Verify your email', text: 'Confirm your address so we know the account is really yours.' },
  { title: 'Get approved', text: 'Our admin team verifies your organization.' },
  { title: 'Add rooms and doctors', text: 'Create rooms, then approve doctors who ask to join you.' },
];

const OrganizationLanding = () => {
  const { organization } = useAuth();
  const busy = [1, 1, 0, 2, 0, 1, 1, 0, 0, 2, 1, 1];  // 1 = booked, 2 = part-booked, 0 = free
  return (
    <div className="theme-org">
      <section className="lp-hero py-12 md:py-20">
        <span className="lp-blob b1" /><span className="lp-blob b2" />
        <div className="container lp-hero-grid">
          <div>
            <span className="pill lp-rise"><Building2 size={15} /> Healthcare facilities network</span>
            <h1 className="display mt-5 lp-rise d1">Run your rooms and doctors without the scheduling headaches.</h1>
            <p className="lp-lead lp-rise d2">
              Hospitals, clinics and medical centres can manage consultation rooms, approve doctor affiliations and offer patients verified care.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8 lp-rise d3">
              {organization ? (
                <Link to="/organization/dashboard" className="btn btn-role btn-lg"><LayoutDashboard size={18} /> Open my dashboard</Link>
              ) : (
                <>
                  <Link to="/organization/register" className="btn btn-role btn-lg">Register your facility <ArrowRight size={18} /></Link>
                  <Link to="/organization/login" className="btn btn-role-outline btn-lg">Facility login</Link>
                </>
              )}
            </div>
            <div className="lp-chips lp-rise d3">
              <span className="lp-chip"><BadgeCheck size={15} /> Admin-verified</span>
              <span className="lp-chip"><CalendarDays size={15} /> Fair room booking</span>
            </div>
            <div className="mt-8 max-w-md" aria-hidden="true"><Ecg /></div>
          </div>

          {/* Illustrative room grid (decorative) */}
          <div className="lp-visual lp-rise d2" aria-hidden="true">
            <div className="lp-mock">
              <div className="lp-mock-head"><span>Room schedule</span><span className="lp-mock-dots"><i /><i /><i /></span></div>
              <div className="lp-grid-mock">
                <span />{['9:00', '10:00', '11:00', '12:00'].map((t) => <span key={t} className="text-center">{t}</span>)}
                {['Room 1', 'Room 2', 'Room 3'].map((r, ri) => (
                  <React.Fragment key={r}>
                    <span>{r}</span>
                    {busy.slice(ri * 4, ri * 4 + 4).map((v, ci) => (
                      <span key={ci} className={`lp-cell ${v === 1 ? 'busy' : v === 2 ? 'half' : ''}`} />
                    ))}
                  </React.Fragment>
                ))}
              </div>
              <div className="lp-row"><div><b>Dr. affiliation request</b><small>Waiting for your approval</small></div><span className="lp-tag wait">Pending</span></div>
            </div>
            <div className="lp-float f1"><span className="dot"><Stethoscope size={16} /></span><div><b>Doctors on your team</b><span className="sub">You approve every one</span></div></div>
            <div className="lp-float f2"><span className="dot"><ShieldCheck size={16} /></span><div><b>Verified facility</b><span className="sub">Trusted by patients</span></div></div>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <div className="container">
          <SectionHead title="Built for everyday clinical operations" sub="The practical tools a facility actually uses, without the clutter." />
          <FeatureCards items={features} />
        </div>
      </section>

      <section className="lp-section alt">
        <div className="container">
          <SectionHead title="From sign-up to first booking" sub="A short, one-time setup." />
          <Steps items={steps} />
        </div>
      </section>

      <section className="lp-section">
        <div className="container max-w-5xl">
          <div className="lp-cta">
            <h2 className="display">Bring your facility onto MEDICARE AI</h2>
            <p>Register in a few minutes, then manage rooms and doctor affiliations from your dashboard.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7">
              <Link to={organization ? '/organization/dashboard' : '/organization/register'} className="btn btn-white btn-lg" style={{ width: 'auto' }}>
                {organization ? 'Open my dashboard' : 'Register your facility'} <ArrowRight size={18} />
              </Link>
              {!organization && <Link to="/organization/login" className="btn btn-ghost btn-lg" style={{ width: 'auto' }}><MailCheck size={18} /> I already have an account</Link>}
            </div>
          </div>
          <p className="text-center text-sm text-muted mt-6">
            Are you a doctor? <Link to="/doctor" className="text-primary font-semibold hover:underline">Visit the doctor page</Link>
          </p>
        </div>
      </section>
    </div>
  );
};

export default OrganizationLanding;
