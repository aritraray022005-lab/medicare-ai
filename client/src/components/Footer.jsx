import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';

const Footer = () => (
  <footer className="footer mt-auto">
    <div className="container py-8 flex flex-col md:flex-row items-center justify-between gap-5 text-sm text-center md:text-left">
      <div className="flex flex-col items-center md:items-start gap-2">
        <Logo size={38} light />
        <p>© {new Date().getFullYear()} MEDICARE AI. All rights reserved.</p>
      </div>
      <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-5 gap-y-2">
        <Link to="/">Home</Link>
        <Link to="/chat">AI Assistant</Link>
        <Link to="/questions">Health Q&amp;A</Link>
        <Link to="/doctor">For Doctors</Link>
      </nav>
    </div>
  </footer>
);

export default Footer;
