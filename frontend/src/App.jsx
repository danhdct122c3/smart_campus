import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import AIAssistant from './pages/AIAssistant';
import Login from './pages/Login';
import Users from './pages/Users';
import Notifications from './pages/Notifications';
import Attendance from './pages/Attendance';
import Analytics from './pages/Analytics';
import Tasks from './pages/Tasks';
import Profile from './pages/Profile';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Route bảo vệ cơ bản: Bất cứ ai đã đăng nhập đều vào được Layout */}
          <Route path="/" element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              {/* ADMIN, MANAGER, PO, PM, DIRECTOR */}
              <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR', 'MANAGER', 'PO', 'PM']} />}>
                <Route path="ai" element={<AIAssistant />} />
                <Route path="users" element={<Users />} />
              </Route>

              {/* ADMIN ONLY */}
              <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR']} />}>
                <Route path="security" element={<div style={{padding:'2rem'}}>Security Page (Mock)</div>} />
              </Route>

              {/* EVERYONE LOGGED IN */}
              <Route index element={<Analytics />} />
              <Route path="profile" element={<Profile />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="notifications" element={<Notifications />} />
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
