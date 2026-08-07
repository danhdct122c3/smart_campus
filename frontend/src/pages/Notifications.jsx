import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Search, Mail, MessageSquare, AlertTriangle, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const Notifications = () => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const userMap = React.useMemo(() => {
    const map = {};
    users.forEach(u => { map[u.user_id] = u.name || u.email || u.user_id; });
    return map;
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
      fetchUsers();
    }
  }, [currentUser]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      let url = `${API_URL}/notifications?limit=200`;
      if (currentUser && currentUser.role !== 'ADMIN') {
        url += `&user_id=${currentUser.user_id}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Không thể tải dữ liệu thông báo');
      const data = await response.json();
      if (data.success && data.data) {
        setNotifications(data.data.items || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/users?limit=1000`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setUsers(data.data.items || data.data || []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  const filteredItems = notifications.filter(item => {
    const matchesSearch = item.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.user_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'ALL' || item.event_type === filterType;
    return matchesSearch && matchesFilter;
  }).sort((a, b) => new Date(b.sent_at || 0) - new Date(a.sent_at || 0));

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const visibleItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const getIconForEventType = (type) => {
    switch (type) {
      case 'AttendanceRecorded': return <CheckCircle2 size={18} color="var(--status-success)" />;
      case 'AttendanceRejected': return <XCircle size={18} color="var(--status-error)" />;
      case 'UnknownFaceDetected': return <AlertTriangle size={18} color="var(--status-warning)" />;
      case 'SecurityIncidentCreated': return <ShieldAlert size={18} color="var(--status-error)" />;
      default: return <Bell size={18} color="var(--text-muted)" />;
    }
  };

  const getIconForChannel = (channel) => {
    switch (channel) {
      case 'EMAIL': return <Mail size={14} />;
      case 'SMS': return <MessageSquare size={14} />;
      default: return <Bell size={14} />;
    }
  };

  const getStatusBadge = (status) => {
    const isSuccess = status === 'SENT';
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: isSuccess ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        color: isSuccess ? 'var(--status-success)' : 'var(--status-error)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        {isSuccess ? 'Thành công' : 'Thất bại'}
      </span>
    );
  };


  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Lịch sử Thông báo (Notifications)
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Quản lý hệ thống gửi Email và SMS tự động.</p>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ 
        display: 'flex', gap: '1rem', marginBottom: '1.5rem', 
        background: 'var(--bg-panel)', padding: '1rem', borderRadius: '12px',
        border: '1px solid var(--glass-border)'
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Tìm theo chủ đề hoặc Mã người dùng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem',
              background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)',
              borderRadius: '8px', color: 'var(--text-primary)', outline: 'none'
            }}
          />
        </div>
        
        <select 
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--glass-border)', borderRadius: '8px',
            color: 'var(--text-primary)', outline: 'none', cursor: 'pointer'
          }}
        >
          <option value="ALL">Tất cả sự kiện</option>
          <option value="AttendanceRecorded">Điểm danh thành công</option>
          <option value="AttendanceRejected">Điểm danh thất bại</option>
          <option value="UnknownFaceDetected">Phát hiện người lạ</option>
          <option value="SecurityIncidentCreated">Cảnh báo An ninh</option>
          <option value="Custom">Thông báo thủ công</option>
        </select>
      </div>

      {/* Main Content */}
      <div style={{ 
        background: 'var(--bg-panel)', borderRadius: '16px', 
        border: '1px solid var(--glass-border)', overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải dữ liệu...</div>
        ) : error ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--status-error)' }}>Lỗi: {error}</div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có thông báo nào.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(0, 0, 0, 0.2)', borderBottom: '1px solid var(--glass-border)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>THỜI GIAN</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>LOẠI SỰ KIỆN</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>KÊNH</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>TIÊU ĐỀ</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>NGƯỜI NHẬN</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map(item => (
                <tr key={item.notification_id} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s', ':hover': { background: 'rgba(255,255,255,0.02)' } }}>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {new Date(item.sent_at).toLocaleString('vi-VN')}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                      {getIconForEventType(item.event_type)}
                      <span style={{ fontSize: '0.9rem' }}>{item.event_type}</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {getIconForChannel(item.channel)}
                      {item.channel}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-primary)' }}>
                    <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{item.subject}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.message}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {userMap[item.user_id] || item.user_id}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button 
                      onClick={() => setSelectedNotification(item)}
                      style={{
                        background: 'transparent', color: 'var(--accent-primary)',
                        border: '1px solid var(--accent-primary)', borderRadius: '6px',
                        padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem',
                        fontWeight: 500, transition: 'all 0.2s'
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = 'var(--accent-primary)'; e.currentTarget.style.color = 'white'; }}
                      onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Controls */}
      {!loading && !error && filteredItems.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            style={{
              background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)',
              borderRadius: '6px', padding: '0.4rem 0.8rem', cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 1 ? 0.5 : 1
            }}
          >
            &lt;
          </button>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              style={{
                background: currentPage === page ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                color: 'white', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '0.4rem 0.8rem',
                cursor: 'pointer', fontWeight: currentPage === page ? 700 : 400
              }}
            >
              {page}
            </button>
          ))}

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            style={{
              background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)',
              borderRadius: '6px', padding: '0.4rem 0.8rem', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage === totalPages ? 0.5 : 1
            }}
          >
            &gt;
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedNotification && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--bg-panel)', padding: '2rem', borderRadius: '16px',
            width: '550px', maxWidth: '90%', border: '1px solid var(--glass-border)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)', position: 'relative'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
              Chi tiết thông báo
            </h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Người nhận</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {userMap[selectedNotification.user_id] || selectedNotification.user_id}
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Thời gian</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {new Date(selectedNotification.sent_at).toLocaleString('vi-VN')}
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Tiêu đề</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.05rem' }}>
                {selectedNotification.subject}
              </div>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Nội dung chi tiết</div>
              <div style={{ 
                color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: '1.6', 
                background: 'rgba(255,255,255,0.03)', padding: '1rem', 
                borderRadius: '8px', border: '1px solid var(--glass-border)'
              }}>
                {selectedNotification.message}
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button 
                onClick={() => setSelectedNotification(null)} 
                style={{ 
                  background: 'var(--accent-primary)', color: 'white', 
                  border: 'none', padding: '0.6rem 2rem', borderRadius: '8px', 
                  cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default Notifications;
