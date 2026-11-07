import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('fm_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('fm_access_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verify() {
      if (token) {
        try {
          const profile = await api.getCurrentUser();
          setUser(profile);
          localStorage.setItem('fm_user', JSON.stringify(profile));
        } catch {
          logout();
        }
      }
      setLoading(false);
    }
    verify();
  }, [token]);

  const login = async (username, password) => {
    const data = await api.login(username, password);
    setToken(data.access_token);
    setUser({ username: data.username, role: data.role });
    localStorage.setItem('fm_access_token', data.access_token);
    localStorage.setItem('fm_user', JSON.stringify({ username: data.username, role: data.role }));
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('fm_access_token');
    localStorage.removeItem('fm_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
