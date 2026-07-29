import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Khôi phục session từ localStorage khi F5/Mở lại trang
  useEffect(() => {
    const token = localStorage.getItem('smart_campus_access_token');
    const user = localStorage.getItem('smart_campus_user');
    
    if (token && user) {
      try {
        setCurrentUser(JSON.parse(user));
        setIsAuthenticated(true);
      } catch (e) {
        localStorage.removeItem('smart_campus_access_token');
        localStorage.removeItem('smart_campus_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        // Nếu API báo có Challenge (NEW_PASSWORD_REQUIRED)
        if (data.data && data.data.challenge_name === 'NEW_PASSWORD_REQUIRED') {
          return {
            success: true,
            isChallenge: true,
            session: data.data.session,
            email: email
          };
        }

        const { access_token, user } = data.data;
        
        // Lưu vào localStorage
        localStorage.setItem('smart_campus_access_token', access_token);
        localStorage.setItem('smart_campus_user', JSON.stringify(user));
        
        // Cập nhật State
        setCurrentUser(user);
        setIsAuthenticated(true);
        return { success: true, isChallenge: false, role: user.role };
      } else {
        return { success: false, message: data.message || "Đăng nhập thất bại" };
      }
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, message: "Lỗi kết nối máy chủ" };
    }
  };

  const respondChallenge = async (email, session, newPassword) => {
    try {
      const response = await fetch(`${API_URL}/auth/respond-challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, session, new_password: newPassword }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        const { access_token, user } = data.data;
        
        // Lưu vào localStorage
        localStorage.setItem('smart_campus_access_token', access_token);
        localStorage.setItem('smart_campus_user', JSON.stringify(user));
        
        // Cập nhật State
        setCurrentUser(user);
        setIsAuthenticated(true);
        return { success: true, role: user.role };
      } else {
        return { success: false, message: data.message || "Đổi mật khẩu thất bại" };
      }
    } catch (error) {
      console.error("Challenge error:", error);
      return { success: false, message: "Lỗi kết nối máy chủ" };
    }
  };

  const logout = () => {
    localStorage.removeItem('smart_campus_access_token');
    localStorage.removeItem('smart_campus_user');
    setCurrentUser(null);
    setIsAuthenticated(false);
    // Chuyển hướng về login sẽ được xử lý ở Header hoặc Component gọi hàm này
  };

  if (isLoading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', color: 'white' }}>Đang tải hệ thống...</div>;
  }

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated, isLoading, login, respondChallenge, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
