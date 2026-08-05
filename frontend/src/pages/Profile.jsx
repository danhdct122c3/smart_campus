import React, { useState } from 'react';
import { UserCircle, Loader, KeyRound, CheckCircle2, Edit2 } from 'lucide-react';
import Card from '../components/Card';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = 'https://z302xxoa9a.execute-api.ap-southeast-1.amazonaws.com/api';

const Profile = () => {
  const { currentUser, setCurrentUser } = useAuth();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passResult, setPassResult] = useState(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [isUpdatingPhone, setIsUpdatingPhone] = useState(false);

  if (!currentUser) return null;

  const handleUpdatePhone = async () => {
    if (!newPhone) return;
    setIsUpdatingPhone(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/${currentUser.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: newPhone })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Cập nhật thất bại');
      
      setCurrentUser({ ...currentUser, phone: newPhone });
      setIsEditingPhone(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsUpdatingPhone(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPassResult({ success: false, message: 'Mật khẩu xác nhận không khớp.' });
      return;
    }
    
    setIsSubmitting(true);
    setPassResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser.email,
          current_password: currentPassword,
          new_password: newPassword
        }),
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Đổi mật khẩu thất bại');
      
      setPassResult({ success: true, message: 'Đổi mật khẩu thành công!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPassResult({ success: false, message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          Hồ sơ cá nhân
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Quản lý thông tự cá nhân và dữ liệu sinh trắc học.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Thông tin cá nhân */}
        <Card title="Thông tin cơ bản">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserCircle size={40} color="var(--text-muted)" />
                </div>
                <div>
                    <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>{currentUser.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{currentUser.email}</div>
                </div>
            </div>

            <div style={{ height: '1px', background: 'var(--glass-border)', margin: '0.5rem 0' }}></div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Phòng ban</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{currentUser.department || 'N/A'}</div>
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Vai trò</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{currentUser.role}</div>
                </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Số điện thoại</div>
                    {!isEditingPhone ? (
                        <div style={{ color: 'var(--text-primary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {currentUser.phone || 'Chưa cập nhật'}
                            <button onClick={() => { setNewPhone(currentUser.phone || ''); setIsEditingPhone(true); }} style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0 }}>
                                <Edit2 size={14} />
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input 
                                value={newPhone} 
                                onChange={(e) => setNewPhone(e.target.value)}
                                style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white', width: '120px', fontSize: '0.875rem' }}
                            />
                            <button onClick={handleUpdatePhone} disabled={isUpdatingPhone} style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '4px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                                {isUpdatingPhone ? '...' : 'Lưu'}
                            </button>
                            <button onClick={() => setIsEditingPhone(false)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '0.75rem' }}>
                                Hủy
                            </button>
                        </div>
                    )}
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Ngày bắt đầu</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {currentUser.created_at ? new Date(currentUser.created_at).toLocaleDateString('vi-VN') : 'N/A'}
                    </div>
                </div>
            </div>
            
            <div style={{ marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Trạng thái Khuôn mặt</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.5rem', borderRadius: '4px', background: currentUser.face_registered ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: currentUser.face_registered ? 'var(--status-success)' : 'var(--status-error)', fontSize: '0.75rem', fontWeight: 600 }}>
                    {currentUser.face_registered ? 'Đã đăng ký' : 'Chưa đăng ký'}
                </div>
            </div>
          </div>
          </div>
        </Card>

        {/* Form đổi mật khẩu */}
        <Card title="Đổi mật khẩu">
          {!showPasswordForm ? (
            <div style={{ marginTop: '1rem' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>Bạn nên thay đổi mật khẩu định kỳ để bảo vệ tài khoản.</p>
                <button 
                  onClick={() => setShowPasswordForm(true)}
                  style={{
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px',
                    padding: '0.75rem 1.5rem', cursor: 'pointer', fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                  }}
                >
                  <KeyRound size={18} /> Thay đổi mật khẩu
                </button>
            </div>
          ) : (
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Mật khẩu hiện tại</label>
              <input 
                type="password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Mật khẩu mới</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Xác nhận mật khẩu mới</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white' }} 
              />
            </div>

            {passResult && (
              <div style={{
                  padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem',
                  background: passResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid', borderColor: passResult.success ? 'var(--status-success)' : 'var(--status-error)',
                  color: passResult.success ? 'var(--status-success)' : 'var(--status-error)',
                  display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}>
                  {passResult.success ? <CheckCircle2 size={16} /> : null}
                  {passResult.message}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isSubmitting}
              style={{
                marginTop: '0.5rem',
                background: 'var(--accent-primary)',
                color: 'white', border: 'none', borderRadius: '8px',
                padding: '0.75rem', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                opacity: isSubmitting ? 0.7 : 1
              }}
            >
              {isSubmitting ? <Loader size={18} className="spin" /> : <KeyRound size={18} />}
              {isSubmitting ? 'Đang xử lý...' : 'Cập nhật mật khẩu'}
            </button>
            <button 
              type="button" 
              onClick={() => setShowPasswordForm(false)}
              style={{
                background: 'transparent',
                color: 'var(--text-secondary)', border: 'none',
                padding: '0.5rem', cursor: 'pointer', fontWeight: 500,
                textAlign: 'center'
              }}
            >
              Hủy
            </button>
          </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Profile;
