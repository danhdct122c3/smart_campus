import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users as UsersIcon, Plus, MoreVertical, ShieldCheck, ShieldAlert, X, Loader, Edit2, Camera, Upload, CameraOff, ClipboardList, CheckCircle2, Clock, RotateCcw, AlertTriangle } from 'lucide-react';
import Card from '../components/Card';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = 'https://d2utvhhrx300xg.cloudfront.net/api/users';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editUserId, setEditUserId] = useState(null);

  const { currentUser } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    email: 'staff@example.com',
    role: 'STAFF',
    department: 'Software Engineering',
    employee_id: '',
    status: 'ACTIVE'
  });

  // Task History state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskUser, setTaskUser] = useState(null);
  const [userTasks, setUserTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const handleOpenTaskHistory = async (user) => {
    setTaskUser(user);
    setShowTaskModal(true);
    setLoadingTasks(true);
    try {
      const res = await fetch(`https://d2utvhhrx300xg.cloudfront.net/api/users/${user.user_id}/tasks`);
      const json = await res.json();
      setUserTasks(json.data?.items || []);
    } catch (err) {
      console.error(err);
      setUserTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Face registration state
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [faceUserId, setFaceUserId] = useState(null);
  const [faceUserName, setFaceUserName] = useState('');
  const [faceMode, setFaceMode] = useState('upload'); // 'upload' | 'webcam'
  const [faceStream, setFaceStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [faceSubmitting, setFaceSubmitting] = useState(false);
  const [faceResult, setFaceResult] = useState(null);
  const faceVideoRef = useRef(null);

  const fetchUsers = async (loadMore = false) => {
    try {
      if (loadMore) setLoadingMore(true);
      else setLoading(true);

      let url = `${API_BASE_URL}?limit=30`;
      if (loadMore && cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
      }

      // Nếu là Quản lý, chỉ cho phép xem nhân sự trong phòng ban
      if (currentUser?.role === 'MANAGER' && currentUser?.department) {
        url += `&department=${encodeURIComponent(currentUser.department)}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error('Không thể lấy danh sách API');
      const json = await res.json();

      const newItems = json.data.items || [];
      if (loadMore) {
        setUsers(prev => [...prev, ...newItems]);
        if (newItems.length > 0) setCurrentPage(prev => prev + 1);
      } else {
        setUsers(newItems);
        setCurrentPage(1);
      }

      setCursor(json.data.next_key);
      setHasMore(!!json.data.next_key);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối máy chủ API.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      return { ...prev, [name]: value };
    });
  };

  const handleOpenAdd = () => {
    setEditMode(false);
    setEditUserId(null);
    setFormData({
      name: '',
      email: '',
      role: currentUser?.role === 'MANAGER' ? 'STAFF' : 'STAFF',
      department: currentUser?.role === 'MANAGER' ? currentUser.department : 'NONE',
      employee_id: `EMP-${Math.floor(10000 + Math.random() * 90000)}`,
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
      department: user.department || 'NONE',
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
          department: formData.department !== 'NONE' ? formData.department : null,
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

  // ── Face Registration Logic ──
  const openFaceModal = (user) => {
    setFaceUserId(user.user_id);
    setFaceUserName(user.name);
    setFaceMode('upload');
    setCapturedImage(null);
    setFaceResult(null);
    setShowFaceModal(true);
  };

  const closeFaceModal = () => {
    if (faceStream) { faceStream.getTracks().forEach(t => t.stop()); setFaceStream(null); }
    setShowFaceModal(false);
    setCapturedImage(null);
    setFaceResult(null);
  };

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
    if (!capturedImage || !faceUserId) return;
    setFaceSubmitting(true);
    setFaceResult(null);
    try {
      const res = await fetch('https://d2utvhhrx300xg.cloudfront.net/api/faces/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: faceUserId, image_base64: capturedImage }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setFaceResult({ success: true, message: 'Đăng ký khuôn mặt thành công!', data: json.data });
        fetchUsers(); // Refresh list
      } else {
        setFaceResult({ success: false, message: json.message || 'Đăng ký thất bại' });
      }
    } catch (err) {
      setFaceResult({ success: false, message: 'Lỗi kết nối: ' + err.message });
    } finally {
      setFaceSubmitting(false);
    }
  };

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);
  const visibleUsers = users.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <UsersIcon color="var(--accent-primary)" /> Users & Faces
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Quản lý người dùng và dữ liệu nhận diện khuôn mặt.</p>
        </div>
        {['ADMIN', 'DIRECTOR', 'MANAGER'].includes(currentUser?.role) && (
          <button
            onClick={handleOpenAdd}
            style={{
              background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '8px',
              padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
              fontWeight: 500
            }}>
            <Plus size={18} /> Add User
          </button>
        )}
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
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Họ Tên & Email</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Vai trò</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Phòng ban</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Mã nhân sự</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Trạng thái</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Khuôn mặt</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Công việc</th>
                  <th style={{ padding: '1rem', width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {visibleUsers.map((user, idx) => (
                  <tr key={user.user_id} style={{ borderBottom: idx === visibleUsers.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
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
                    <td style={{ padding: '1rem' }}>
                      <span style={{
                        background: 'rgba(59,130,246,0.1)', padding: '0.25rem 0.5rem',
                        borderRadius: '4px', fontSize: '0.75rem', color: '#60a5fa', fontWeight: 500
                      }}>
                        {user.department === 'NONE' || !user.department ? 'Chưa phân bổ' : user.department}
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
                      {user.face_id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-success)', fontSize: '0.875rem' }}>
                          <ShieldCheck size={16} /> Đã đăng ký
                        </div>
                      ) : (
                        ['ADMIN', 'DIRECTOR'].includes(currentUser?.role) ? (
                          <button
                            onClick={() => openFaceModal(user)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                              background: 'rgba(6,182,212,0.1)', color: 'var(--accent-primary)',
                              border: '1px solid rgba(6,182,212,0.3)', borderRadius: '6px',
                              padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(6,182,212,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(6,182,212,0.1)'}
                          >
                            <Camera size={14} /> Đăng ký
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Chưa đăng ký</span>
                        )
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <button
                        onClick={() => handleOpenTaskHistory(user)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
                          border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px',
                          padding: '0.3rem 0.65rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
                      >
                        <ClipboardList size={14} /> Lịch sử Task
                      </button>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {['ADMIN', 'DIRECTOR'].includes(currentUser?.role) && (
                        <button
                          onClick={() => handleOpenEdit(user)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Edit2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {visibleUsers.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Chưa có người dùng nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {users.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.4rem 0.8rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>
                  &lt;
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{
                      background: currentPage === page ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                      color: 'white', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.4rem 0.8rem', cursor: 'pointer'
                    }}
                  >
                    {page}
                  </button>
                ))}

                <button
                  disabled={currentPage === totalPages && !hasMore}
                  onClick={() => {
                    if (currentPage < totalPages) {
                      setCurrentPage(p => p + 1);
                    } else if (hasMore) {
                      fetchUsers(true);
                    }
                  }}
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.4rem 0.8rem', cursor: (currentPage === totalPages && !hasMore) ? 'not-allowed' : 'pointer', opacity: (currentPage === totalPages && !hasMore) ? 0.5 : 1 }}>
                  {loadingMore && currentPage === totalPages ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : '>'}
                </button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* MODAL */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <Card style={{ width: '100%', maxWidth: '500px', padding: '1.5rem', position: 'relative' }}>
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
                  disabled={currentUser?.role === 'MANAGER'}
                  style={{ width: '100%', padding: '0.75rem', background: currentUser?.role === 'MANAGER' ? 'rgba(255,255,255,0.05)' : 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: currentUser?.role === 'MANAGER' ? 'var(--text-muted)' : 'white' }}
                >
                  <option value="STAFF" style={{ color: 'black' }}>Nhân viên (Staff)</option>
                  {currentUser?.role !== 'MANAGER' && (
                    <>
                      <option value="ADMIN" style={{ color: 'black' }}>Quản trị viên (Admin)</option>
                      <option value="DIRECTOR" style={{ color: 'black' }}>Giám đốc (Director)</option>
                      <option value="MANAGER" style={{ color: 'black' }}>Quản lý (Manager)</option>
                      <option value="SECURITY" style={{ color: 'black' }}>Bảo vệ (Security)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Phòng ban</label>
                <select
                  name="department" value={formData.department} onChange={handleChange}
                  disabled={currentUser?.role === 'MANAGER'}
                  style={{ width: '100%', padding: '0.75rem', background: currentUser?.role === 'MANAGER' ? 'rgba(255,255,255,0.05)' : 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: currentUser?.role === 'MANAGER' ? 'var(--text-muted)' : 'white' }}
                >
                  {currentUser?.role === 'MANAGER' ? (
                    <option value={currentUser.department} style={{ color: 'black' }}>{currentUser.department}</option>
                  ) : (
                    <>
                      <option value="NONE" style={{ color: 'black' }}>Không thuộc phòng ban nào</option>
                      <option value="IT" style={{ color: 'black' }}>Công nghệ thông tin (IT)</option>
                      <option value="MAINTENANCE" style={{ color: 'black' }}>Bảo trì cơ sở vật chất (Maintenance)</option>
                      <option value="SECURITY" style={{ color: 'black' }}>An ninh bảo vệ (Security)</option>
                      <option value="HR" style={{ color: 'black' }}>Nhân sự (HR)</option>
                      <option value="ADMIN" style={{ color: 'black' }}>Hành chính (Admin)</option>
                    </>
                  )}
                </select>
              </div>

              {!editMode && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Mã nhân sự</label>
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

      {/* FACE REGISTRATION MODAL */}
      {showFaceModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <Card style={{ width: '100%', maxWidth: '520px', padding: '1.5rem', position: 'relative' }}>
            <button
              onClick={closeFaceModal}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Camera size={22} color="var(--accent-primary)" /> Đăng ký Khuôn mặt
            </h2>
            <p style={{ margin: '0 0 1.25rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Nhân viên: <strong style={{ color: 'var(--text-primary)' }}>{faceUserName}</strong>
            </p>

            {/* Mode Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => { stopFaceCamera(); setFaceMode('upload'); setCapturedImage(null); }}
                style={{
                  flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)',
                  background: faceMode === 'upload' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                  color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                }}
              >
                <Upload size={16} /> Upload ảnh
              </button>
              <button
                onClick={() => { setCapturedImage(null); startFaceCamera(); }}
                style={{
                  flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--glass-border)',
                  background: faceMode === 'webcam' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                  color: 'white', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                }}
              >
                <Camera size={16} /> Chụp Webcam
              </button>
            </div>

            {/* Preview Area */}
            <div style={{
              width: '100%', height: '280px', borderRadius: '12px', overflow: 'hidden',
              background: '#0f172a', border: '1px solid var(--glass-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem',
              position: 'relative'
            }}>
              {faceMode === 'webcam' && faceStream && !capturedImage ? (
                <>
                  <video ref={faceVideoRef} autoPlay playsInline muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* Capture overlay button */}
                  <button
                    onClick={captureFromWebcam}
                    style={{
                      position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)',
                      width: '56px', height: '56px', borderRadius: '50%',
                      background: 'rgba(255,255,255,0.9)', border: '3px solid var(--accent-primary)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.3)', transition: 'transform 0.15s'
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'translateX(-50%) scale(0.9)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'translateX(-50%) scale(1)'}
                  >
                    <Camera size={24} color="var(--accent-primary)" />
                  </button>
                </>
              ) : capturedImage ? (
                <img src={capturedImage} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Upload size={40} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Chọn ảnh hoặc chụp từ Webcam</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', opacity: 0.6 }}>JPEG / PNG, tối đa 5MB</p>
                </div>
              )}
            </div>

            {/* Upload input (only in upload mode) */}
            {faceMode === 'upload' && !capturedImage && (
              <label style={{
                display: 'block', padding: '0.75rem', borderRadius: '8px',
                border: '2px dashed rgba(6,182,212,0.3)', textAlign: 'center',
                cursor: 'pointer', color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600,
                marginBottom: '1rem', transition: 'border-color 0.2s'
              }}>
                <input type="file" accept="image/jpeg,image/png" onChange={handleFileUpload} style={{ display: 'none' }} />
                📁 Chọn file ảnh từ máy tính
              </label>
            )}

            {/* Clear / Retake */}
            {capturedImage && (
              <button
                onClick={() => setCapturedImage(null)}
                style={{
                  width: '100%', padding: '0.5rem', marginBottom: '0.75rem', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)',
                  color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem'
                }}
              >
                🔄 Chọn ảnh khác
              </button>
            )}

            {/* Result */}
            {faceResult && (
              <div style={{
                padding: '0.75rem', borderRadius: '8px', marginBottom: '0.75rem',
                background: faceResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${faceResult.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: faceResult.success ? 'var(--accent-success)' : 'var(--accent-danger)',
                fontSize: '0.85rem', fontWeight: 600
              }}>
                {faceResult.success ? '✅' : '❌'} {faceResult.message}
                {faceResult.data && (
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', fontWeight: 400, opacity: 0.8 }}>
                    Độ tin cậy: {faceResult.data.confidence?.toFixed(1)}%
                  </p>
                )}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={faceResult?.success ? closeFaceModal : submitFaceRegistration}
              disabled={(!capturedImage && !faceResult?.success) || faceSubmitting}
              style={{
                width: '100%', padding: '0.875rem', borderRadius: '8px', border: 'none',
                background: faceResult?.success ? 'var(--accent-success)' : 'var(--accent-primary)',
                color: 'white', fontWeight: 700, fontSize: '0.95rem',
                cursor: (!capturedImage && !faceResult?.success) || faceSubmitting ? 'not-allowed' : 'pointer',
                opacity: (!capturedImage && !faceResult?.success) || faceSubmitting ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
            >
              {faceSubmitting ? (
                <><Loader size={16} style={{ animation: 'spin 1s linear infinite', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Đang xử lý...</>
              ) : faceResult?.success ? (
                '✓ Đóng'
              ) : (
                '🚀 Đăng ký khuôn mặt'
              )}
            </button>
          </Card>
        </div>
      )}

      {/* Task History Modal */}
      {showTaskModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <Card style={{ width: '650px', maxWidth: '95%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', position: 'relative', padding: '1.5rem', background: 'var(--bg-panel)', border: '1px solid var(--glass-border)' }}>
            <button onClick={() => setShowTaskModal(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={20} />
            </button>

            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardList color="var(--accent-primary)" /> Lịch sử công việc
            </h3>
            <p style={{ margin: '0 0 1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Nhân sự: <strong style={{ color: '#fff' }}>{taskUser?.name}</strong> ({taskUser?.email})
            </p>

            <div style={{ flex: 1, overflowY: 'auto', pr: '0.5rem' }}>
              {loadingTasks ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Loader className="spin" size={24} style={{ marginBottom: '0.75rem', animation: 'spin 1s linear infinite' }} />
                  <p>Đang tải danh sách công việc...</p>
                </div>
              ) : userTasks.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  Chưa có công việc nào được giao cho nhân sự này.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {userTasks.map((task) => {
                    const statusColors = {
                      OPEN: { bg: 'rgba(100,116,139,0.15)', color: 'var(--text-muted)', label: 'TODO' },
                      TODO: { bg: 'rgba(100,116,139,0.15)', color: 'var(--text-muted)', label: 'TODO' },
                      IN_PROGRESS: { bg: 'rgba(6,182,212,0.15)', color: 'var(--accent-primary)', label: 'ĐANG LÀM' },
                      IN_REVIEW: { bg: 'rgba(245,158,11,0.15)', color: 'var(--accent-warning)', label: 'CHỜ DUYỆT' },
                      COMPLETED: { bg: 'rgba(16,185,129,0.15)', color: 'var(--accent-success)', label: 'HOÀN THÀNH' },
                      DONE: { bg: 'rgba(16,185,129,0.15)', color: 'var(--accent-success)', label: 'HOÀN THÀNH' },
                    };
                    const st = statusColors[task.status] || statusColors.OPEN;

                    return (
                      <div key={task.task_id} style={{
                        padding: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '4px', background: st.bg, color: st.color }}>
                              {st.label}
                            </span>
                            {task.priority && (
                              <span style={{
                                fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '4px',
                                background: task.priority === 'URGENT' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                                color: task.priority === 'URGENT' ? 'var(--accent-danger)' : 'var(--text-secondary)'
                              }}>
                                {({'LOW': 'THẤP', 'MEDIUM': 'TRUNG BÌNH', 'HIGH': 'CAO', 'URGENT': 'KHẨN CẤP'})[task.priority] || task.priority}
                              </span>
                            )}
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              • {task.created_at?.slice(0, 10) || 'N/A'}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                              {task.description}
                            </p>
                          )}
                        </div>
                        {task.due_date && (
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Hạn chót</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: new Date(task.due_date) < new Date() && !['COMPLETED', 'DONE'].includes(task.status) ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
                              📅 {new Date(task.due_date).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '1rem' }}>
              <button
                onClick={() => setShowTaskModal(false)}
                style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Đóng
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Users;
