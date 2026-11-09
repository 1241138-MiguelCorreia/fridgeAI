import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import storage from '../services/storage';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

const initialState = {
  isLoading: true,
  isAuthenticated: false,
  token: null,
  user: null,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'RESTORE_TOKEN':
      return { ...state, isLoading: false, token: action.token, user: action.user, isAuthenticated: !!action.token };
    case 'LOGIN':
      return { ...state, isLoading: false, token: action.token, user: action.user, isAuthenticated: true };
    case 'LOGOUT':
      return { ...state, isLoading: false, token: null, user: null, isAuthenticated: false };
    case 'UPDATE_USER':
      return { ...state, user: { ...state.user, ...action.user } };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Restaurar sessão ao iniciar
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const token = await storage.getItem('auth_token');
        const cachedUser = await AsyncStorage.getItem('user_data');
        if (token) {
          const user = cachedUser ? JSON.parse(cachedUser) : null;
          dispatch({ type: 'RESTORE_TOKEN', token, user });
          // Actualizar dados em background
          try {
            const res = await authAPI.me();
            const freshUser = res.data.user;
            await AsyncStorage.setItem('user_data', JSON.stringify(freshUser));
            dispatch({ type: 'UPDATE_USER', user: freshUser });
          } catch (_) {}
        } else {
          dispatch({ type: 'RESTORE_TOKEN', token: null, user: null });
        }
      } catch (_) {
        dispatch({ type: 'RESTORE_TOKEN', token: null, user: null });
      }
    };
    bootstrap();
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login(email, password);
    const { token, user } = res.data;
    await storage.setItem('auth_token', token);
    await AsyncStorage.setItem('user_data', JSON.stringify(user));
    dispatch({ type: 'LOGIN', token, user });
    return user;
  };

  const register = async (name, email, password, confirmPassword) => {
    const res = await authAPI.register(name, email, password, confirmPassword);
    const { token, user } = res.data;
    await storage.setItem('auth_token', token);
    await AsyncStorage.setItem('user_data', JSON.stringify(user));
    dispatch({ type: 'LOGIN', token, user });
    return user;
  };

  const logout = async () => {
    await storage.deleteItem('auth_token');
    await AsyncStorage.removeItem('user_data');
    dispatch({ type: 'LOGOUT' });
  };

  const updateUser = async (updates) => {
    const updated = { ...state.user, ...updates };
    await AsyncStorage.setItem('user_data', JSON.stringify(updated));
    dispatch({ type: 'UPDATE_USER', user: updates });
  };

  const setMode = async (mode) => {
    await authAPI.setMode(mode);
    await updateUser({ mode });
  };

  const setRestrictions = async (restrictions, allergies) => {
    await authAPI.setRestrictions(restrictions, allergies);
    await updateUser({ restrictions, allergies, hasCompletedOnboarding: true });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, updateUser, setMode, setRestrictions }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
