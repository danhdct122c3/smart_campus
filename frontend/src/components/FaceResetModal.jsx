import React, { useState, useRef } from 'react';
import { Camera, X, ChevronRight, CheckCircle, AlertTriangle, Lock } from 'lucide-react';
import Card from './Card';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const FaceResetModal = ({ onClose }) => {
  const [step, setStep] = useState(1); // 1: Email, 2: Camera, 3: New Password, 4: Success
  const [email, setEmail] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Camera state
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [camActive, setCamActive] = useState(false);

  const startCamera = async () => {
    setErrorMsg('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      setStream(s);
      setCamActive(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 100);
    } catch (e) {
      setErrorMsg('Không thể mở Camera: ' + e.message);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setCamActive(false);
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const handleVerifyEmail = (e) => {
    e.preventDefault();
    if (!email.trim()) return setErrorMsg('Vui lòng nhập Email');
    setErrorMsg('');
    setStep(2);
    startCamera();
  };

  const captureAndVerifyFace = async () => {
    if (!videoRef.current) return;
    setIsLoading(true);
    setErrorMsg('');

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imgBase64 = canvas.toDataURL('image/jpeg', 0.85);
    setImageBase64(imgBase64);

    try {
      const res = await fetch(`${API_BASE}/auth/verify-face-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), image_base64: imgBase64 })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        stopCamera();
        setStep(3);
      } else {
        setErrorMsg(data.message || 'Xác thực khuôn mặt thất bại.');
      }
    } catch (e) {
      setErrorMsg('Lỗi kết nối đến máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.trim() !== confirmPassword.trim()) {
      return setErrorMsg('Mật khẩu xác nhận không khớp.');
    }
    
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE}/auth/reset-password-face`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          new_password: newPassword.trim(),
          image_base64: imageBase64
        })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setStep(4);
      } else {
        setErrorMsg(data.message || 'Cập nhật mật khẩu thất bại.');
      }
    } catch (e) {
      setErrorMsg('Lỗi kết nối đến máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '1rem'
    }}>
      <Card style={{ width: '100%', maxWidth: '450px', position: 'relative', overflow: 'hidden' }}>
        <button 
          onClick={handleClose}
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={20} color="var(--accent-primary)" /> Khôi phục bằng Face ID
          </h2>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {errorMsg && (
            <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--status-error)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} /> {errorMsg}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleVerifyEmail}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Vui lòng nhập Email tài khoản của bạn để tiến hành khôi phục mật khẩu.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Email</label>
                <input 
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@smartcampus.edu"
                  style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem', color: 'var(--text-primary)', outline: 'none' }}
                />
              </div>
              <button type="submit" style={{ width: '100%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: 'white', border: 'none', borderRadius: '8px', padding: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                Tiếp tục <ChevronRight size={18} />
              </button>
            </form>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem', textAlign: 'center' }}>
                Đưa khuôn mặt vào khung hình để hệ thống AWS xác thực chủ tài khoản.
              </p>
              
              <div style={{ width: '100%', height: '300px', background: '#000', borderRadius: '12px', overflow: 'hidden', position: 'relative', marginBottom: '1.5rem' }}>
                {camActive ? (
                  <video 
                    ref={videoRef} autoPlay playsInline muted 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    Đang mở Camera...
                  </div>
                )}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, border: '2px solid rgba(6,182,212,0.3)', borderRadius: '12px', pointerEvents: 'none' }} />
              </div>

              <button 
                onClick={captureAndVerifyFace} disabled={!camActive || isLoading}
                style={{ width: '100%', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.875rem', fontWeight: 600, cursor: (!camActive || isLoading) ? 'not-allowed' : 'pointer', opacity: (!camActive || isLoading) ? 0.7 : 1 }}
              >
                {isLoading ? 'Đang xác thực AI...' : 'Chụp và Xác thực'}
              </button>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleResetPassword}>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'inline-flex', background: 'rgba(34,197,94,0.1)', color: 'var(--status-success)', padding: '0.5rem 1rem', borderRadius: '999px', fontSize: '0.875rem', fontWeight: 600, alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={16} /> Khuôn mặt hợp lệ
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Mật khẩu mới</label>
                  <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                    <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                      type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem 1rem 0.75rem 2.5rem', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Xác nhận mật khẩu</label>
                  <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                    <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                      type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem 1rem 0.75rem 2.5rem', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit" disabled={isLoading}
                style={{ width: '100%', background: 'linear-gradient(135deg, var(--status-success), #16a34a)', color: 'white', border: 'none', borderRadius: '8px', padding: '0.875rem', fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1 }}
              >
                {isLoading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
              </button>
            </form>
          )}

          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '2rem 0 1rem' }}>
              <CheckCircle size={64} color="var(--status-success)" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Đổi mật khẩu thành công</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Bạn có thể sử dụng mật khẩu mới để đăng nhập ngay bây giờ.</p>
              <button 
                onClick={handleClose}
                style={{ background: 'var(--glass-border)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem 2rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Quay lại Đăng nhập
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default FaceResetModal;
