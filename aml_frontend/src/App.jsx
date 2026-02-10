import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AMLDashboard from './AMLDashboard';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';

const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) return <div className="min-h-screen bg-blue-900 flex items-center justify-center text-white">Loading...</div>;
  if (!token) return <Navigate to="/login" />;

  return children;
};

import { GoogleOAuthProvider } from '@react-oauth/google';

function App() {
  return (
    <GoogleOAuthProvider clientId="406038150169-1m2fs1pesvhker6ik84hjgoeonpj24rt.apps.googleusercontent.com">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AMLDashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
