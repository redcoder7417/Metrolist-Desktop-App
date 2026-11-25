import React, { createContext, useState, useCallback, useEffect } from 'react';
import ToastContainer from '../components/ToastContainer';

export const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto remove after 3s
    setTimeout(() => {
      removeToast(id);
    }, 3000);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const { message, type } = e.detail || {};
      if (message) addToast(message, type || 'info');
    };
    window.addEventListener('appToast', handler);
    return () => window.removeEventListener('appToast', handler);
  }, [addToast]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};
