import React from 'react';
import logoImg from '../assets/logo.png';

/** MEDICARE AI logo (brain + caduceus image). */
export const LogoMark = ({ size = 40 }) => (
  <img src={logoImg} alt="MEDICARE AI logo" height={size} style={{ height: size, width: 'auto' }} />
);

const Logo = ({ size = 40, light = false, text = true }) => (
  <span className="logo-wrap">
    <LogoMark size={size} />
    {text && (
      <span className="logo-text" style={light ? { color: '#fff' } : undefined}>
        MEDICARE<span className="ai"> AI</span>
      </span>
    )}
  </span>
);

export default Logo;
