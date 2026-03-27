import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin, logout as apiLogout, setTokens, getToken, decodeJWT, clearTokens } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have an existing token on mount
    const token = getToken();
    if (token) {
      const decoded = decodeJWT(token);
      if (decoded && decoded.exp * 1000 > Date.now()) {
        setUser(decoded);
      } else {
        clearTokens();
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username, password) => {
    const decoded = await apiLogin(username, password);
    setUser(decoded);
    return decoded;
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    navigate('/login');
  }, [navigate]);

  const isAuthenticated = !!user;

  if (loading) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated }}>
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

export default AuthContext;
