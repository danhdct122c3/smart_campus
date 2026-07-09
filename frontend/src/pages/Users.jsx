import React, { useState, useEffect, useRef } from 'react';
import { Users as UsersIcon, Plus, MoreVertical, ShieldCheck, ShieldAlert, X, Loader, Edit2, Camera } from 'lucide-react';
import Card from '../components/Card';

const API_BASE_URL = 'http://127.0.0.1:8000/api/users';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editUserId, setEditUserId] = useState(null);

  // Face Registration State
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [faceUserId, setFaceUserId] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  // Webcam State
  const [useWebcam, setUseWebcam] = useState(false);
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'STUDENT',
    employee_id: '',
    status: 'ACTIVE'
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_BASE_URL);
      if (!res.ok) throw new Error('Không thể lấy danh sách API');
      const json = await res.json();
      setUsers(json.data.items || []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối máy chủ API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      // Tự động tạo mã nhân viên khi đổi vai trò (chỉ khi tạo mới)
      if (name === 'role' && !editMode) {
        const prefix = value.substring(0, 3).toUpperCase();
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        newData.employee_id = `${prefix}-${randomNum}`;
      }
      return newData;
    });
  };

  const handleOpenAdd = () => {
    setEditMode(false);
    setEditUserId(null);
    setFormData({ 
      name: '', 
      email: '', 
      role: 'STUDENT', 
      employee_id: `STU-${Math.floor(1000 + Math.random() * 9000)}`, 
      status: 'ACTIVE' 
    });
    setShowModal(true);
  };

  const handleOpenEdit = (user) => {
    setEditMode(true);
    setEditUserId(user.user_id);
    setFormData({ 
      name: user.name, 
      email: user.email, 
      role: user.role, 
      employee_id: user.employee_id || '',
      status: user.status || 'ACTIVE'
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      
      let url = API_BASE_URL;
      let method = 'POST';
      let bodyData = formData;

      if (editMode) {
        url = `${API_BASE_URL}/${editUserId}`;
        method = 'PATCH';
        bodyData = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          status: formData.status
        };
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || `Lỗi khi ${editMode ? 'cập nhật' : 'tạo'} người dùng`);
      
      setShowModal(false);
      fetchUsers(); // Tải lại danh sách
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenFace = (user) => {
    setFaceUserId(user.user_id);
    setImagePreview(null);
    setUseWebcam(false);
    setShowFaceModal(true);
  };

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleCloseFaceModal = () => {
    stopWebcam();
    setShowFaceModal(false);
  };

  const startWebcam = async () => {
    setUseWebcam(true);
    setImagePreview(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      // Wait for React to render the video element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      alert("Không thể mở Camera: " + err.message);
      setUseWebcam(false);
    }
  };

  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setImagePreview(dataUrl);
      stopWebcam();
      setUseWebcam(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegisterFace = async () => {
    if (!imagePreview) return;
    try {
      setIsSubmitting(true);
      const res = await fetch('http://127.0.0.1:8000/api/faces/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: faceUserId, image_base64: imagePreview })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Lỗi đăng ký khuôn mặt');
      alert('Đăng ký thành công!');
      handleCloseFaceModal();
      fetchUsers();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <UsersIcon color="var(--accent-primary)" /> Users & Faces
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Quản lý người dùng và dữ liệu nhận diện khuôn mặt.</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          style={{
            background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '8px',
            padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
            fontWeight: 500
          }}>
          <Plus size={18} /> Add User
        </button>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader className="spin" size={24} style={{ marginBottom: '1rem' }} />
            <p>Đang tải dữ liệu...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--accent-danger)' }}>
            <p>{error}</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--glass-border)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Họ Tên & Email</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Vai trò</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Mã nhân sự</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Trạng thái</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Khuôn mặt</th>
                <th style={{ padding: '1rem', width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr key={user.user_id} style={{ borderBottom: idx === users.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem' }}>
                    <p style={{ margin: 0, fontWeight: 500, color: 'var(--text-primary)' }}>{user.name}</p>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{user.email}</p>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      background: 'rgba(255,255,255,0.05)', padding: '0.25rem 0.5rem', 
                      borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)'
                    }}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                    {user.employee_id || '-'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      background: user.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: user.status === 'ACTIVE' ? 'var(--accent-success)' : 'var(--accent-danger)',
                      padding: '0.25rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600
                    }}>
                      {user.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {user.face_registered ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-success)', fontSize: '0.875rem' }}>
                        <ShieldCheck size={16} /> Đã ĐK
                      </div>
                    ) : (
                      <button onClick={() => handleOpenFace(user)} style={{
                        background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)',
                        padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem',
                        display: 'flex', alignItems: 'center', gap: '0.25rem'
                      }}>
                        <Camera size={14} /> Đăng ký
                      </button>
                    )}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    <button 
                      onClick={() => handleOpenEdit(user)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Edit2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Chưa có người dùng nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      {/* MODAL */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <Card style={{ width: '100%', maxWidth: '400px', padding: '1.5rem', position: 'relative' }}>
            <button 
              onClick={() => setShowModal(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem' }}>{editMode ? 'Chỉnh sửa User' : 'Thêm người dùng'}</h2>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Họ và tên</label>
                <input 
                  required name="name" value={formData.name} onChange={handleChange}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white' }} 
                  placeholder="VD: Nguyễn Văn A"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Email</label>
                <input 
                  required type="email" name="email" value={formData.email} onChange={handleChange}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white' }} 
                  placeholder="VD: a@example.com"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Vai trò</label>
                <select 
                  name="role" value={formData.role} onChange={handleChange}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white' }}
                >
                  <option value="STUDENT" style={{ color: 'black' }}>Sinh viên (Student)</option>
                  <option value="STAFF" style={{ color: 'black' }}>Nhân viên (Staff)</option>
                  <option value="ADMIN" style={{ color: 'black' }}>Quản trị viên (Admin)</option>
                  <option value="MANAGER" style={{ color: 'black' }}>Quản lý (Manager)</option>
                  <option value="SECURITY" style={{ color: 'black' }}>Bảo vệ (Security)</option>
                  <option value="MAINTENANCE" style={{ color: 'black' }}>Bảo trì (Maintenance)</option>
                </select>
              </div>

              {!editMode && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Mã nhân sự / SV (Tự động tạo)</label>
                  <input 
                    readOnly
                    name="employee_id" value={formData.employee_id} onChange={handleChange}
                    style={{ width: '100%', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-muted)', cursor: 'not-allowed' }} 
                    placeholder="VD: EMP-001"
                  />
                </div>
              )}

              {editMode && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Trạng thái</label>
                  <select 
                    name="status" value={formData.status} onChange={handleChange}
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white' }}
                  >
                    <option value="ACTIVE" style={{ color: 'black' }}>Hoạt động (ACTIVE)</option>
                    <option value="INACTIVE" style={{ color: 'black' }}>Vô hiệu hóa (INACTIVE)</option>
                    <option value="SUSPENDED" style={{ color: 'black' }}>Đình chỉ (SUSPENDED)</option>
                  </select>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSubmitting}
                style={{
                  background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '8px',
                  padding: '0.875rem', marginTop: '0.5rem', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600
                }}>
                {isSubmitting ? 'Đang lưu...' : (editMode ? 'Cập nhật' : 'Tạo mới')}
              </button>
            </form>
          </Card>
        </div>
      )}

      {/* FACE REGISTER MODAL */}
      {showFaceModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <Card style={{ width: '100%', maxWidth: '400px', padding: '1.5rem', position: 'relative' }}>
            <button 
              onClick={handleCloseFaceModal}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem' }}>Đăng ký khuôn mặt</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                width: '100%', height: '240px', background: 'rgba(0,0,0,0.2)',
                border: '2px dashed var(--glass-border)', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', position: 'relative'
              }}>
                {useWebcam ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : imagePreview ? (
                  <img src={imagePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '2rem', textAlign: 'center' }}>
                    Chọn ảnh rõ mặt để đăng ký.<br/>
                    (Nên dùng ảnh thẻ hoặc chụp thẳng mặt)
                  </p>
                )}
              </div>

              {!useWebcam && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input 
                    type="file" 
                    accept="image/jpeg, image/png" 
                    onChange={handleFileChange} 
                    style={{ fontSize: '0.875rem', color: 'var(--text-primary)', flex: 1 }} 
                  />
                  <button 
                    onClick={startWebcam}
                    style={{
                      background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '8px',
                      padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}>
                    <Camera size={16} /> Chụp Webcam
                  </button>
                </div>
              )}

              {useWebcam && (
                <button 
                  onClick={captureImage}
                  style={{
                    background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '8px',
                    padding: '0.75rem', cursor: 'pointer', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem'
                  }}>
                  <Camera size={18} /> Chụp ảnh ngay
                </button>
              )}

              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                * Hỗ trợ định dạng JPEG, PNG (Tối đa 5MB)
              </p>

              <button 
                onClick={handleRegisterFace}
                disabled={isSubmitting || !imagePreview}
                style={{
                  background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '8px',
                  padding: '0.875rem', marginTop: '0.5rem', cursor: (isSubmitting || !imagePreview) ? 'not-allowed' : 'pointer', fontWeight: 600
                }}>
                {isSubmitting ? 'Đang xử lý...' : 'Xác nhận Đăng ký'}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Users;
