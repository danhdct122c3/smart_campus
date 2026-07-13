import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import AIAssistant from './pages/AIAssistant';
import Login from './pages/Login';
import Users from './pages/Users';
import Notifications from './pages/Notifications';

function App() {
  // Tạm thời tắt cơ chế bắt buộc đăng nhập (cho phép truy cập thẳng)
  const [isAuthenticated, setIsAuthenticated] = useState(true); 

  return (
    <BrowserRouter>
      <Routes>
        {/* Vẫn giữ trang Login nếu người dùng chủ động truy cập /login */}
        <Route 
          path="/login" 
          element={<Login onLogin={() => setIsAuthenticated(true)} />} 
        />

        {/* Các trang bên trong (Truy cập thẳng không bị đá về /login) */}
        <Route 
          path="/" 
          element={<MainLayout />}
        >
          <Route index element={<Dashboard />} />
          <Route path="ai" element={<AIAssistant />} />
          <Route path="users" element={<Users />} />
          <Route path="attendance" element={<div style={{padding:'2rem'}}>Attendance Page (Mock)</div>} />
          <Route path="security" element={<div style={{padding:'2rem'}}>Security Page (Mock)</div>} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
