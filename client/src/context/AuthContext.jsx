import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const probe = async (url) => {
  try {
    await axios.get(url, { withCredentials: true });
    return true;
  } catch {
    return false;
  }
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState({ patient: false, doctor: false, admin: false });
  const [loading, setLoading] = useState(true);

  // Re-check every role's cookie against the server. Call after login / logout.
  const refresh = useCallback(async () => {
    const [patient, doctor, admin] = await Promise.all([
      probe('/api/patients/profile'),
      probe('/api/doctors/profile'),
      probe('/api/admin/auth/me'),
    ]);
    setSession({ patient, doctor, admin });
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo(() => ({ ...session, loading, refresh }), [session, loading, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
