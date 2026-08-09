import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Lock, User, ChevronRight } from 'lucide-react';
import Card from '../components/Card';
import FaceResetModal from '../components/FaceResetModal';

import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [showFaceReset, setShowFaceReset] = useState(false);
  
  // Challenge State
  const [isChallengeMode, setIsChallengeMode] = useState(false);
  const [session, setSession] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const navigate = useNavigate();
  const { login, respondChallenge } = useAuth();

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    
    const trimmedPassword = password.trim();
    const result = await login(email.trim(), trimmedPassword);
    setIsLoading(false);

    if (result.success) {
      if (result.isChallenge) {
        setIsChallengeMode(true);
        setSession(result.session);
        setErrorMsg('Vui lòng tạo mật khẩu mới cho lần đăng nhập đầu tiên.');
      } else {
        // Điều hướng thông minh dựa trên Role
        if (['STAFF', 'SECURITY', 'TECHNICIAN'].includes(result.role)) navigate('/my-tasks');
        else if (['MANAGER', 'PO', 'PM'].includes(result.role)) navigate('/tasks');
        else navigate('/'); // Admin
      }
    } else {
      setErrorMsg(result.message);
    }
  };

  const handleRespondChallenge = async (e) => {
    e.preventDefault();
    const trimmedNewPassword = newPassword.trim();
    const trimmedConfirmPassword = confirmPassword.trim();
    if (trimmedNewPassword !== trimmedConfirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp.');
      return;
    }
    
    setIsLoading(true);
    setErrorMsg('');
    
    const result = await respondChallenge(email, session, trimmedNewPassword);
    setIsLoading(false);

    if (result.success) {
      if (['STAFF', 'SECURITY', 'TECHNICIAN'].includes(result.role)) navigate('/my-tasks');
      else if (['MANAGER', 'PO', 'PM'].includes(result.role)) navigate('/tasks');
      else navigate('/'); 
    } else {
      setErrorMsg(result.message);
    }
  };

  const autofillDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Password@123'); // Mật khẩu chung cho demo
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at top right, rgba(6, 182, 212, 0.15), transparent 50%), radial-gradient(circle at bottom left, rgba(139, 92, 246, 0.15), transparent 50%)',
      backgroundColor: 'var(--bg-base)'
    }}>
      
      {showFaceReset && (
        <FaceResetModal onClose={() => setShowFaceReset(false)} />
      )}

      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '0 1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div style={{ 
            width: '64px', height: '64px', 
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '1rem',
            boxShadow: '0 8px 32px rgba(6, 182, 212, 0.3)'
          }}>
            <Camera size={32} color="white" />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>
            Smart<span style={{ color: 'var(--accent-primary)' }}>Campus</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Centralized AI Platform</p>
        </div>

        <Card style={{ padding: '2rem' }}>
          {!isChallengeMode ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {errorMsg && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--status-error)', color: 'var(--status-error)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem' }}>
                  {errorMsg}
                </div>
              )}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Email</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@smartcampus.edu" 
                    style={{
                      width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)',
                      borderRadius: '8px', padding: '0.75rem 1rem 0.75rem 2.5rem', color: 'var(--text-primary)',
                      outline: 'none', transition: 'border 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Mật khẩu</label>
                  <button type="button" onClick={() => setShowFaceReset(true)} style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Quên mật khẩu?</button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    style={{
                      width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)',
                      borderRadius: '8px', padding: '0.75rem 1rem 0.75rem 2.5rem', color: 'var(--text-primary)',
                      outline: 'none', transition: 'border 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                style={{
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  color: 'white', border: 'none', borderRadius: '8px', padding: '0.875rem',
                  fontSize: '1rem', fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  marginTop: '0.5rem', transition: 'opacity 0.2s', opacity: isLoading ? 0.7 : 1
                }}
              >
                {isLoading ? 'Đang xác thực...' : 'Đăng nhập'} {!isLoading && <ChevronRight size={18} />}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRespondChallenge} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {errorMsg && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem' }}>
                  {errorMsg}
                </div>
              )}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Mật khẩu mới</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="password" 
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••" 
                    style={{
                      width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)',
                      borderRadius: '8px', padding: '0.75rem 1rem 0.75rem 2.5rem', color: 'var(--text-primary)',
                      outline: 'none', transition: 'border 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                  />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', paddingLeft: '0.25rem' }}>
                  Yêu cầu: Ít nhất 8 ký tự, bao gồm chữ HOA, chữ thường, số và ký tự đặc biệt (!@#$...).
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Xác nhận mật khẩu</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="password" 
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••" 
                    style={{
                      width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)',
                      borderRadius: '8px', padding: '0.75rem 1rem 0.75rem 2.5rem', color: 'var(--text-primary)',
                      outline: 'none', transition: 'border 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                style={{
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  color: 'white', border: 'none', borderRadius: '8px', padding: '0.875rem',
                  fontSize: '1rem', fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  marginTop: '0.5rem', transition: 'opacity 0.2s', opacity: isLoading ? 0.7 : 1
                }}
              >
                {isLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu & Đăng nhập'} {!isLoading && <ChevronRight size={18} />}
              </button>
            </form>
          )}

          {/* DEMO ROLE BADGES */}
          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Trải nghiệm nhanh (Dev Mode)
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
              <BadgeRole icon="👑" label="Admin" email="admin@smartcampus.edu" onClick={() => autofillDemo('admin@smartcampus.edu')} />
              <BadgeRole icon="👔" label="Manager" email="manager@smartcampus.edu" onClick={() => autofillDemo('manager@smartcampus.edu')} />
              <BadgeRole icon="👷" label="Staff" email="staff@smartcampus.edu" onClick={() => autofillDemo('staff@smartcampus.edu')} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

// Component Badge phụ trợ
const BadgeRole = ({ icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--glass-border)',
      borderRadius: '20px',
      padding: '0.4rem 0.75rem',
      fontSize: '0.8rem',
      color: 'var(--text-secondary)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '0.25rem',
      transition: 'all 0.2s',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(6, 182, 212, 0.1)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
  >
    <span>{icon}</span> {label}
  </button>
);

export default Login;
