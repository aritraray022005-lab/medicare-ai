import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HeartPulse, Stethoscope, Building2, TriangleAlert } from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';

// Same section rule the navbar uses, so the footer highlights where you are.
const sectionOf = (pathname) =>
  pathname.startsWith('/admin') ? 'admin'
  : pathname.startsWith('/doctor') ? 'doctor'
  : pathname.startsWith('/organization') ? 'organization'
  : 'patient';

const Footer = () => {
  const { pathname } = useLocation();
  const auth = useAuth();
  const here = sectionOf(pathname);

  const roles = [
    {
      key: 'patient', title: 'For Patients', icon: HeartPulse, color: '#0f8b83',
      blurb: 'Check symptoms, find verified doctors and book real appointment slots.',
      links: auth.patient
        ? [['/dashboard', 'My dashboard'], ['/symptom-checker', 'Symptom checker'], ['/chat', 'AI assistant'], ['/questions', 'Health Q&A']]
        : [['/register', 'Create a free account'], ['/login', 'Patient login'], ['/chat', 'AI assistant'], ['/questions', 'Health Q&A']],
    },
    {
      key: 'doctor', title: 'For Doctors', icon: Stethoscope, color: '#1479b8',
      blurb: 'Publish slots, review symptoms and verify appointments.',
      links: auth.doctor
        ? [['/doctor/dashboard', 'My dashboard'], ['/doctor/qa', 'Answer questions'], ['/doctor', 'About doctor tools']]
        : [['/doctor', 'About doctor tools'], ['/doctor/register', 'Join as a doctor'], ['/doctor/login', 'Doctor login']],
    },
    {
      key: 'organization', title: 'For Facilities', icon: Building2, color: '#b45f10',
      blurb: 'Manage rooms, approve doctor affiliations and join the verified network.',
      links: auth.organization
        ? [['/organization/dashboard', 'My dashboard'], ['/organization', 'About facility tools']]
        : [['/organization', 'About facility tools'], ['/organization/register', 'Register your facility'], ['/organization/login', 'Facility login']],
    },
  ];

  const signedInAs = roles.filter((r) => auth[r.key]).map((r) => r.title.replace('For ', '').replace(/s$/, ''));

  return (
    <footer className="site-footer">
      <div className="container pt-12 pb-8">
        <div className="sf-grid">
          <div>
            <Logo size={40} light />
            <p className="text-sm mt-4 max-w-xs">
              A patient-doctor platform for symptom triage, verified doctors and real appointment slots.
            </p>
            {signedInAs.length > 0 && (
              <span className="sf-session"><i /> Signed in as {signedInAs.join(' & ')}</span>
            )}
            <p className="text-xs mt-5 flex gap-2 max-w-xs" style={{ color: '#f5c9a0' }}>
              <TriangleAlert size={15} className="shrink-0 mt-0.5" />
              <span>Not for emergencies. In an emergency, call your local emergency number.</span>
            </p>
          </div>

          {roles.map(({ key, title, icon: Icon, color, blurb, links }) => (
            <nav key={key} aria-label={title} className={`sf-role${here === key ? ' current' : ''}`} style={{ '--role-c': color }}>
              <h4>
                <span className="sf-badge"><Icon size={16} /></span>
                {title}
                {here === key && <span className="sf-here">You&rsquo;re here</span>}
              </h4>
              <p>{blurb}</p>
              <ul>
                {links.map(([to, label]) => (<li key={to + label}><Link to={to}>{label}</Link></li>))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="sf-bottom">
          <p>&copy; {new Date().getFullYear()} MEDICARE AI. All rights reserved.</p>
          <p style={{ maxWidth: '34rem' }}>
            Information on this site is for guidance only and does not replace advice from a qualified doctor.
          </p>
          <Link to="/admin/login" className="text-xs" style={{ opacity: 0.7 }}>Admin</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
