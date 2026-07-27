import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, User, X, CheckCircle2, XCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const Header = () => {
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_URL}/notifications?limit=5`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const items = data.data.items || [];
          const sorted = items.sort((a, b) => new Date(b.sent_at || 0) - new Date(a.sent_at || 0));
          setNotifications(sorted);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getIconForEventType = (type) => {
    switch (type) {
      case 'AttendanceRecorded': return <CheckCircle2 size={16} color="var(--status-success)" />;
      case 'AttendanceRejected': return <XCircle size={16} color="var(--status-error)" />;
      case 'UnknownFaceDetected': return <AlertTriangle size={16} color="var(--status-warning)" />;
      case 'SecurityIncidentCreated': return <ShieldAlert size={16} color="var(--status-error)" />;
      default: return <Bell size={16} color="var(--accent-primary)" />;
    }
  };

  return (
    <header style={{
      height: '72px',
      borderBottom: '1px solid var(--glass-border)',
      background: 'rgba(30, 41, 59, 0.5)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 2rem',
      position: 'sticky',
      top: 0,
      zIndex: 50 // Increased zIndex for dropdown
    }}>
      <div style={{ position: 'relative', width: '300px' }}>
        <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
        <input 
          type="text" 
          placeholder="Search students, faces, incidents..." 
          style={{
            width: '100%',
            background: 'var(--bg-base)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '0.5rem 1rem 0.5rem 2.5rem',
            color: 'var(--text-primary)',
            outline: 'none',
            fontSize: '0.9rem'
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowNotifs(!showNotifs)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative', display: 'flex' }}
          >
            <Bell size={20} color="var(--text-secondary)" />
            {notifications.length > 0 && (
              <span style={{
                position: 'absolute', top: '-4px', right: '-4px',
                background: 'var(--accent-danger)', width: '8px', height: '8px', borderRadius: '50%'
              }}></span>
            )}
          </button>
          
          {/* Notifications Dropdown */}
          {showNotifs && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '1rem',
              width: '320px',
              background: '#1e293b',
              border: '1px solid var(--glass-border)',
              borderRadius: '12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Thông báo mới</h3>
                <button onClick={() => setShowNotifs(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  <X size={16} />
                </button>
              </div>
              
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Không có thông báo nào.
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.notification_id} style={{ 
                      padding: '0.85rem 1rem', 
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      display: 'flex', gap: '0.75rem',
                      background: 'rgba(255,255,255,0.02)',
                      transition: 'background 0.2s',
                      cursor: 'pointer'
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onClick={() => { setShowNotifs(false); navigate('/notifications'); }}
                    >
                      <div style={{ 
                        width: '32px', height: '32px', borderRadius: '50%', 
                        background: 'rgba(255,255,255,0.05)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 
                      }}>
                        {getIconForEventType(n.event_type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {n.subject}
                        </p>
                        <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.78rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {n.message}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {new Date(n.sent_at).toLocaleString('vi-VN')}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <button 
                onClick={() => { setShowNotifs(false); navigate('/notifications'); }}
                style={{ 
                  padding: '0.75rem', 
                  background: 'rgba(255,255,255,0.02)', 
                  border: 'none', borderTop: '1px solid var(--glass-border)',
                  color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer', textAlign: 'center', transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              >
                Xem tất cả
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>Admin User</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Administrator</p>
          </div>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-base)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--glass-border)'
          }}>
            <User size={18} color="var(--accent-primary)" />
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </header>
  );
};

export default Header;
