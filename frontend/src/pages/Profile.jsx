import React, { useState, useRef } from 'react';
import { Camera, Upload, CameraOff, CheckCircle2, UserCircle, Loader } from 'lucide-react';
import Card from '../components/Card';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

const Profile = () => {
  const { currentUser, setCurrentUser } = useAuth();
  
  const [faceMode, setFaceMode] = useState('upload'); // 'upload' | 'webcam'
  const [faceStream, setFaceStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [faceSubmitting, setFaceSubmitting] = useState(false);
  const [faceResult, setFaceResult] = useState(null);
  const faceVideoRef = useRef(null);

  if (!currentUser) return null;

  const startFaceCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 } });
      setFaceStream(s);
      setFaceMode('webcam');
      setCapturedImage(null);
      setTimeout(() => { if (faceVideoRef.current) faceVideoRef.current.srcObject = s; }, 100);
    } catch (e) {
      alert('Không thể mở camera: ' + e.message);
    }
  };

  const stopFaceCamera = () => {
    if (faceStream) { faceStream.getTracks().forEach(t => t.stop()); setFaceStream(null); }
    setFaceMode('upload');
  };

  const captureFromWebcam = () => {
    if (!faceVideoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = faceVideoRef.current.videoWidth || 480;
    canvas.height = faceVideoRef.current.videoHeight || 360;
    canvas.getContext('2d').drawImage(faceVideoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
    stopFaceCamera();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      alert('Chỉ hỗ trợ ảnh JPEG hoặc PNG');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Ảnh không được vượt quá 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setCapturedImage(ev.target.result);
    reader.readAsDataURL(file);
  };

  const submitFaceRegistration = async () => {
    if (!capturedImage || !currentUser.user_id) return;
    setFaceSubmitting(true);
    setFaceResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/faces/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.user_id, image_base64: capturedImage }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Đăng ký khuôn mặt thất bại');
      
      setFaceResult({ success: true, message: 'Đăng ký khuôn mặt thành công!' });
      
      // Cập nhật state current user để hiện thị là đã đăng ký khuôn mặt (nếu cần)
      if (setCurrentUser) {
          setCurrentUser({...currentUser, face_registered: true});
      }

      setCapturedImage(null);
    } catch (err) {
      setFaceResult({ success: false, message: err.message });
    } finally {
      setFaceSubmitting(false);
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
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
            </div>
            
            <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Trạng thái Khuôn mặt</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.5rem', borderRadius: '4px', background: currentUser.face_registered ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: currentUser.face_registered ? 'var(--status-success)' : 'var(--status-error)', fontSize: '0.75rem', fontWeight: 600 }}>
                    {currentUser.face_registered ? 'Đã đăng ký' : 'Chưa đăng ký'}
                </div>
            </div>
          </div>
        </Card>

        {/* Đăng ký khuôn mặt */}
        <Card title="Đăng ký Khuôn mặt">
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Hãy cập nhật khuôn mặt của bạn để sử dụng tính năng Điểm danh (Attendance). Bạn có thể tải ảnh chụp chính diện hoặc dùng Camera.
            </p>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                    onClick={() => { stopFaceCamera(); setCapturedImage(null); }}
                    style={{
                        flex: 1, padding: '0.5rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500,
                        border: '1px solid',
                        borderColor: faceMode === 'upload' ? 'var(--accent-primary)' : 'var(--glass-border)',
                        background: faceMode === 'upload' ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                        color: faceMode === 'upload' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer'
                    }}
                >
                    <Upload size={16} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                    Tải ảnh lên
                </button>
                <button
                    onClick={startFaceCamera}
                    style={{
                        flex: 1, padding: '0.5rem', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500,
                        border: '1px solid',
                        borderColor: faceMode === 'webcam' ? 'var(--accent-primary)' : 'var(--glass-border)',
                        background: faceMode === 'webcam' ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                        color: faceMode === 'webcam' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer'
                    }}
                >
                    <Camera size={16} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                    Chụp Camera
                </button>
            </div>

            <div style={{
                border: '1px dashed var(--glass-border)', borderRadius: '8px',
                height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.2)', position: 'relative', overflow: 'hidden'
            }}>
                {faceMode === 'upload' && !capturedImage && (
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                        <input type="file" accept="image/jpeg, image/png" onChange={handleFileUpload} id="profile-upload" style={{ display: 'none' }} />
                        <label htmlFor="profile-upload" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Upload size={24} color="var(--text-muted)" />
                            </div>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Nhấn để chọn ảnh thẻ (JPG/PNG)</span>
                        </label>
                    </div>
                )}

                {faceMode === 'webcam' && !capturedImage && (
                    <>
                        <video ref={faceVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                            onClick={captureFromWebcam}
                            style={{
                                position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
                                background: 'white', color: 'black', border: 'none', borderRadius: '50%',
                                width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                            }}
                        >
                            <Camera size={24} />
                        </button>
                        <button
                            onClick={stopFaceCamera}
                            style={{
                                position: 'absolute', top: '16px', right: '16px',
                                background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '4px',
                                padding: '4px', cursor: 'pointer'
                            }}
                        >
                            <CameraOff size={16} />
                        </button>
                    </>
                )}

                {capturedImage && (
                    <>
                        <img src={capturedImage} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        <button
                            onClick={() => { setCapturedImage(null); if(faceMode==='webcam') startFaceCamera(); }}
                            style={{
                                position: 'absolute', top: '16px', right: '16px',
                                background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '4px',
                                padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem'
                            }}
                        >
                            Thử lại
                        </button>
                    </>
                )}
            </div>

            {faceResult && (
                <div style={{
                    padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem',
                    background: faceResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid', borderColor: faceResult.success ? 'var(--status-success)' : 'var(--status-error)',
                    color: faceResult.success ? 'var(--status-success)' : 'var(--status-error)',
                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}>
                    {faceResult.success ? <CheckCircle2 size={16} /> : null}
                    {faceResult.message}
                </div>
            )}

            <button
                onClick={submitFaceRegistration}
                disabled={!capturedImage || faceSubmitting}
                style={{
                    background: (!capturedImage || faceSubmitting) ? 'var(--bg-card)' : 'var(--accent-primary)',
                    color: (!capturedImage || faceSubmitting) ? 'var(--text-muted)' : 'white',
                    border: '1px solid', borderColor: (!capturedImage || faceSubmitting) ? 'var(--glass-border)' : 'var(--accent-primary)',
                    padding: '0.75rem', borderRadius: '8px', fontWeight: 600, cursor: (!capturedImage || faceSubmitting) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s'
                }}
            >
                {faceSubmitting ? (
                    <><Loader size={18} className="spin" /> Đang xử lý...</>
                ) : (
                    'Cập nhật Khuôn mặt'
                )}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
