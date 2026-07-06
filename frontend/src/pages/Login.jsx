import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Lock, User, ChevronRight } from 'lucide-react';
import Card from '../components/Card';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Giả lập call API đăng nhập (Cognito) mất 1 giây
    setTimeout(() => {
      setIsLoading(false);
      onLogin(); // Cập nhật state App thành đã đăng nhập
      navigate('/'); // Chuyển hướng về Dashboard
    }, 1000);
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
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
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
                <a href="#" style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', textDecoration: 'none' }}>Quên mật khẩu?</a>
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
        </Card>
      </div>
    </div>
  );
};

export default Login;
