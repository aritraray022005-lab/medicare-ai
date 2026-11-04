import React from 'react';

/** Heartbeat line that draws itself once on load (decorative). */
export const Ecg = () => (
  <svg className="lp-ecg" viewBox="0 0 600 80" preserveAspectRatio="none" aria-hidden="true">
    <path pathLength="1" d="M0 40 H190 L212 40 L228 10 L248 70 L266 24 L280 40 H600" />
  </svg>
);

/** Centered section heading with optional sub-text. */
export const SectionHead = ({ title, sub }) => (
  <div className="lp-head">
    <h2 className="display">{title}</h2>
    {sub && <p>{sub}</p>}
  </div>
);

/** Numbered how-it-works list. items = [{ title, text }] */
export const Steps = ({ items }) => (
  <ol className="lp-steps" style={{ '--cols': items.length }}>
    {items.map((s, i) => (
      <li key={s.title} className="lp-step">
        <div className="num">{i + 1}</div>
        <h3 className="display">{s.title}</h3>
        <p>{s.text}</p>
      </li>
    ))}
  </ol>
);

/** Grid of icon cards. items = [{ icon, title, text }] */
export const FeatureCards = ({ items, cols = 'lg:grid-cols-4' }) => (
  <div className={`grid grid-cols-1 sm:grid-cols-2 ${cols} gap-5`}>
    {items.map(({ icon: Icon, title, text }) => (
      <div key={title} className="lp-card">
        <div className="lp-icon"><Icon size={22} /></div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    ))}
  </div>
);
