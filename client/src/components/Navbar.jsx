import React, { useState, useEffect } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut } from 'lucide-react';
import Logo from './Logo';

const Navbar = ({ links = [], actionButton = null, homePath = '/', onLogout = null, logoutTo = '/' }) => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => setOpen(false), [pathname]);

  // Lock page scroll while the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const cls = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;

  const logout = async () => {
    await onLogout();
    navigate(logoutTo, { replace: true });
  };

  const items = (mobile) => (
    <>
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.end} className={cls}>{l.label}</NavLink>
      ))}
      {actionButton && (
        <Link to={actionButton.to} className={`btn btn-primary ${mobile ? 'mt-2' : 'ml-2'}`}>{actionButton.label}</Link>
      )}
      {onLogout && (
        <button type="button" onClick={logout} className={`btn btn-outline ${mobile ? 'mt-2' : 'ml-2'}`}>
          <LogOut size={16} /> Logout
        </button>
      )}
    </>
  );

  return (
    <nav className="navbar">
      <div className="container nav-container">
        <Link to={homePath} className="logo" aria-label="MEDICARE AI home">
          <Logo size={44} />
        </Link>

        <div className="nav-links">{items(false)}</div>

        <button
          className="nav-toggle"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && <div className="nav-mobile animate-fade-in">{items(true)}</div>}
    </nav>
  );
};

export default Navbar;
