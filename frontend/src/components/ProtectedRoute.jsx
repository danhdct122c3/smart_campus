import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { isAuthenticated, currentUser } = useAuth();

  // Nếu chưa đăng nhập -> Đẩy về /login
  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Nếu route có yêu cầu role cụ thể, nhưng user hiện tại không nằm trong danh sách
  if (allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
    // Tự động chuyển hướng về trang chủ đích phù hợp với vai trò của họ
    if (['STAFF', 'SECURITY', 'MAINTENANCE'].includes(currentUser.role)) {
      return <Navigate to="/my-tasks" replace />;
    }
    if (['MANAGER', 'PO', 'PM'].includes(currentUser.role)) {
      return <Navigate to="/tasks" replace />;
    }
    // Mặc định cho các trường hợp khác
    return <Navigate to="/" replace />;
  }

  // Hợp lệ -> Render các trang con (Outlet)
  return <Outlet />;
};

export default ProtectedRoute;
