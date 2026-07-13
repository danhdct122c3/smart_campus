import React, { useState, useEffect } from 'react';
import { Bell, Search, Mail, MessageSquare, AlertTriangle, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';

const API_URL = "http://localhost:8000/api";

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/notifications?limit=50`);
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

  const filteredItems = notifications.filter(item => {
    const matchesSearch = item.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.user_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'ALL' || item.event_type === filterType;
    return matchesSearch && matchesFilter;
  });

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
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Không tìm thấy thông báo nào.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(0, 0, 0, 0.2)', borderBottom: '1px solid var(--glass-border)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>THỜI GIAN</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>LOẠI SỰ KIỆN</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>KÊNH</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>TIÊU ĐỀ</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>NGƯỜI NHẬN</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
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
                    {item.user_id}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {getStatusBadge(item.status)}
                    {item.error_message && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--status-error)', marginTop: '4px', maxWidth: '150px' }}>
                        {item.error_message}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Notifications;
