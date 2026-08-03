import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays, Plus, CheckCircle2, XCircle, Clock, Home,
  Briefcase, Loader, AlertTriangle, Trash2, ChevronLeft,
  ChevronRight, User, Shield, Coffee, BarChart2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Card from '../components/Card';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const LEAVE_TYPE_CONFIG = {
  WFH: { label: 'Làm việc từ xa (WFH)', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)', icon: Home },
  ANNUAL_LEAVE: { label: 'Nghỉ phép năm', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', icon: Coffee },
  SICK_LEAVE: { label: 'Nghỉ ốm', color: '#ec4899', bg: 'rgba(236,72,153,0.15)', icon: AlertTriangle },
  BUSINESS_TRIP: { label: 'Công tác', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', icon: Briefcase },
};

const STATUS_CONFIG = {
  PENDING: { label: 'Chờ duyệt', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  APPROVED: { label: 'Đã duyệt', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  REJECTED: { label: 'Từ chối', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  CANCELLED: { label: 'Đã hủy', color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
};

const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
const DOW = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const Btn = ({ children, onClick, variant = 'primary', disabled, style = {} }) => {
  const BASE = {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.5rem 1rem', borderRadius: '8px', border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
    fontWeight: 600, fontSize: '0.83rem', transition: 'all .2s', opacity: disabled ? 0.5 : 1,
  };
  const VARIANTS = {
    primary: { background: 'var(--accent-primary)', color: '#fff' },
    success: { background: 'var(--accent-success)', color: '#fff' },
    danger: { background: 'var(--accent-danger)', color: '#fff' },
    ghost: { background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' },
    warning: { background: '#f59e0b', color: '#000' },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...BASE, ...(VARIANTS[variant] || VARIANTS.primary), ...style }}>
      {children}
    </button>
  );
};

const Badge = ({ status, type = 'status' }) => {
  const cfg = type === 'status' ? STATUS_CONFIG[status] : LEAVE_TYPE_CONFIG[status];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.22rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem',
      fontWeight: 600, color: cfg.color, background: cfg.bg,
    }}>
      {Icon && <Icon size={12} />}
      {cfg.label}
    </span>
  );
};

// ── Mini Calendar ─────────────────────────────────────────────────────────────

function MiniCalendar({ myRequests = [], holidays = [], onDateClick, onRangeSelect, isAdmin, isManager }) {
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [hoveredDate, setHoveredDate] = useState(null);
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tooltip, setTooltip] = useState(null); // { date, x, y, info }

  const holidayMap = {};
  holidays.forEach(h => { holidayMap[h.date] = h; });

  const getLocalDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const approvedMap = {};
  myRequests.filter(r => r.status === 'APPROVED').forEach(r => {
    const [sy, sm, sd] = r.date_from.split('-');
    let d = new Date(sy, sm - 1, sd);
    const [ey, em, ed] = r.date_to.split('-');
    const end = new Date(ey, em - 1, ed);
    while (d <= end) {
      approvedMap[getLocalDateStr(d)] = r.leave_type;
      d.setDate(d.getDate() + 1);
    }
  });

  const pendingMap = {};
  myRequests.filter(r => r.status === 'PENDING').forEach(r => {
    const [sy, sm, sd] = r.date_from.split('-');
    let d = new Date(sy, sm - 1, sd);
    const [ey, em, ed] = r.date_to.split('-');
    const end = new Date(ey, em - 1, ed);
    while (d <= end) {
      pendingMap[getLocalDateStr(d)] = r.leave_type;
      d.setDate(d.getDate() + 1);
    }
  });

  const firstDay = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevM = () => setView(v => v.m === 0 ? { y: v.y - 1, m: 11 } : { ...v, m: v.m - 1 });
  const nextM = () => setView(v => v.m === 11 ? { y: v.y + 1, m: 0 } : { ...v, m: v.m + 1 });

  const toDateStr = (d) => `${view.y}-${String(view.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const getCellState = (d) => {
    if (!d) return null;
    const dateStr = toDateStr(d);
    const dow = new Date(view.y, view.m, d).getDay();
    const isToday = today.getFullYear() === view.y && today.getMonth() === view.m && today.getDate() === d;
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = !!holidayMap[dateStr];
    const leaveType = approvedMap[dateStr];
    const pendingType = pendingMap[dateStr];
    return { dateStr, dow, isToday, isWeekend, isHoliday, leaveType, pendingType };
  };

  const getCellStyle = (state) => {
    if (!state) return { width: '2.4rem', height: '2.4rem' };
    const { isToday, isWeekend, isHoliday, leaveType, pendingType } = state;

    let bg = 'transparent', color = 'var(--text-primary)', border = '1px solid transparent', fontWeight = 400;

    if (leaveType) {
      bg = LEAVE_TYPE_CONFIG[leaveType]?.color || '#06b6d4';
      color = '#fff';
      fontWeight = 700;
    } else if (isHoliday) {
      bg = '#10b981';
      color = '#fff';
      fontWeight = 700;
    } else if (pendingType) {
      bg = 'transparent';
      color = '#f59e0b';
      border = '1.5px dashed #f59e0b';
      fontWeight = 700;
    } else if (isWeekend) {
      color = 'var(--text-muted)';
    }

    // "Hôm nay" override
    if (isToday) {
      if (bg === 'transparent') {
        bg = 'var(--accent-primary)';
        color = '#fff';
        fontWeight = 700;
      } else {
        border = '2px solid #fff'; // Nếu trùng với sự kiện thì thêm viền trắng để nổi bật
      }
    }

    const isHovered = state.dateStr === hoveredDate;

    return {
      width: '2.4rem', height: '2.4rem',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: '50%', fontSize: '0.85rem', fontWeight,
      background: bg, color, border,
      cursor: 'pointer',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      transform: isHovered ? 'scale(1.15) translateY(-2px)' : 'scale(1)',
      boxShadow: isHovered ? '0 8px 16px rgba(0,0,0,0.3), 0 0 0 2px var(--accent-primary)' : 'none',
      zIndex: isHovered ? 10 : 1,
    };
  };

  const handleDateClick = (d) => {
    if (!d) return;
    const state = getCellState(d);
    if (state?.isWeekend) return; // Disable clicking on weekends
    const dateStr = toDateStr(d);
    if (onDateClick) onDateClick(dateStr, state);
  };

  const buildTooltipInfo = (state) => {
    if (!state) return null;
    const { dateStr, isToday, isWeekend, isHoliday, leaveType, pendingType } = state;
    const lines = [];
    if (isToday) lines.push('📅 Hôm nay');
    if (isWeekend) lines.push('🏖 Cuối tuần');
    if (isHoliday) lines.push(`🎉 Ngày lễ: ${holidayMap[dateStr]?.name || ''}`);
    if (leaveType) lines.push(`✅ ${LEAVE_TYPE_CONFIG[leaveType]?.label || leaveType}`);
    if (pendingType) lines.push(`⏳ Chờ duyệt: ${LEAVE_TYPE_CONFIG[pendingType]?.label || pendingType}`);
    if (lines.length === 0) lines.push('Nhấn để đăng ký');
    return lines;
  };

  return (
    <div
      style={{
        background: 'linear-gradient(145deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.8) 100%)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
        borderRadius: '20px',
        padding: '1.5rem',
        userSelect: 'none',
        position: 'relative'
      }}
      onMouseLeave={() => { setHoveredDate(null); if (isDragging) setIsDragging(false); setTooltip(null); }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
        <button onClick={prevM} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.4rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.5px' }}>{MONTHS[view.m]} {view.y}</span>
        <button onClick={nextM} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.4rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Hint text */}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'center', letterSpacing: '0.3px' }}>
        Nhấn 1 ngày để thao tác
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '8px' }}>
        {DOW.map((d, idx) => (
          <div key={d} style={{ fontSize: '0.75rem', color: (idx === 5 || idx === 6) ? 'var(--text-muted)' : 'var(--text-secondary)', padding: '0.2rem 0', fontWeight: 700 }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px 2px', textAlign: 'center' }}>
        {cells.map((d, i) => {
          const state = getCellState(d);
          return (
            <div
              key={i}
              style={{ display: 'flex', justifyContent: 'center', position: 'relative', cursor: state?.isWeekend ? 'not-allowed' : (d ? 'pointer' : 'default') }}
              onClick={() => handleDateClick(d)}
              onMouseEnter={() => {
                if (!d) return;
                setHoveredDate(state.dateStr);
                const info = buildTooltipInfo(state);
                setTooltip({ date: state.dateStr, info });
              }}
            >
              <div style={getCellStyle(state)}>
                {d || ''}
                {/* Holiday dot indicator */}
                {state?.isHoliday && !state?.leaveType && (
                  <span style={{ position: 'absolute', bottom: '1px', right: '1px', width: 4, height: 4, borderRadius: '50%', background: '#10b981' }} />
                )}
              </div>

              {/* Tooltip positioned relative to cell */}
              {tooltip && tooltip.date === state?.dateStr && (
                <div style={{
                  position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
                  padding: '0.6rem 1rem', background: 'rgba(15,23,42,0.95)',
                  borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)',
                  fontSize: '0.8rem', zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(10px)', minWidth: 'max-content', whiteSpace: 'nowrap', pointerEvents: 'none',
                }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.3rem', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.3rem', textAlign: 'left' }}>{tooltip.date}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.4rem', textAlign: 'left' }}>
                    {tooltip.info?.map((line, idx) => (
                      <div key={idx} style={{ color: 'var(--text-secondary)' }}>{line}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>


      {/* Legend */}
      <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem 1rem', padding: '1rem', background: 'rgba(0,0,0,0.15)', borderRadius: '12px' }}>
        {Object.entries(LEAVE_TYPE_CONFIG).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: v.color, boxShadow: `0 0 8px ${v.color}80` }} />
            {v.label}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.5)' }} />Ngày lễ
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          <div style={{ width: 10, height: 10, borderRadius: '3px', border: '1.5px dashed #f59e0b' }} />Chờ duyệt
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Leaves() {
  const { currentUser } = useAuth();
  const isAdmin = ['ADMIN', 'DIRECTOR', 'PO'].includes(currentUser?.role);
  const isManager = isAdmin || ['MANAGER', 'PM'].includes(currentUser?.role);
  const isStaff = !isManager;

  // States
  const [myRequests, setMyRequests] = useState([]);
  const [pending, setPending] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [dayStatus, setDayStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [wfhLoading, setWfhLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('calendar');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ leave_type: 'WFH', date_from: '', date_to: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  // Business trip form (Manager/Admin)
  const [showTripForm, setShowTripForm] = useState(false);
  const [tripForm, setTripForm] = useState({ user_id: '', date_from: '', date_to: '', destination: '', note: '' });
  const [users, setUsers] = useState([]);

  // Holiday form (Admin)
  const [showHolidayForm, setShowHolidayForm] = useState(false);
  const [holidayForm, setHolidayForm] = useState({ date: '', name: '', description: '' });

  // Date action panel (inline popup khi click lịch, dành cho Admin)
  const [dateAction, setDateAction] = useState(null); // { date, state }

  const today = new Date().toISOString().slice(0, 10);

  // ── Fetch functions ────────────────────────────────────────────────────────

  const fetchMyRequests = useCallback(async () => {
    if (!currentUser?.user_id) return;
    try {
      const res = await fetch(`${API_BASE}/leaves/my-requests?user_id=${currentUser.user_id}`);
      const json = await res.json();
      if (json.success) setMyRequests(json.data || []);
    } catch (e) { console.error(e); }
  }, [currentUser]);

  const fetchPending = useCallback(async () => {
    if (!isManager) return;
    try {
      const dept = isAdmin ? '' : `&department=${encodeURIComponent(currentUser?.department || '')}`;
      const res = await fetch(`${API_BASE}/leaves/pending?${dept}`);
      const json = await res.json();
      if (json.success) setPending(json.data || []);
    } catch (e) { console.error(e); }
  }, [isManager, isAdmin, currentUser]);

  const fetchHolidays = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/leaves/holidays?year=${new Date().getFullYear()}`);
      const json = await res.json();
      if (json.success) setHolidays(json.data || []);
    } catch (e) { console.error(e); }
  }, []);

  const fetchDayStatus = useCallback(async () => {
    if (!currentUser?.user_id) return;
    try {
      const res = await fetch(`${API_BASE}/leaves/day-status?user_id=${currentUser.user_id}&date=${today}`);
      const json = await res.json();
      if (json.success) setDayStatus(json.data);
    } catch (e) { console.error(e); }
  }, [currentUser, today]);

  const fetchUsers = useCallback(async () => {
    if (!isManager) return;
    try {
      const res = await fetch(`${API_BASE}/users?limit=200`);
      const json = await res.json();
      if (json.success) setUsers(json.data?.items || []);
    } catch (e) { console.error(e); }
  }, [isManager]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMyRequests(), fetchPending(), fetchHolidays(), fetchDayStatus(), fetchUsers()])
      .finally(() => setLoading(false));
  }, [fetchMyRequests, fetchPending, fetchHolidays, fetchDayStatus, fetchUsers]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSubmitRequest = async () => {
    if (!formData.date_from || !formData.date_to) return showToast('Vui lòng chọn khoảng thời gian');
    if (formData.date_from > formData.date_to) return showToast('Ngày bắt đầu không được sau ngày kết thúc');
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/leaves/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, user_id: currentUser.user_id }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setShowForm(false);
        setFormData({ leave_type: 'WFH', date_from: '', date_to: '', reason: '' });
        fetchMyRequests(); fetchDayStatus();
      } else {
        showToast(json.message || 'Gửi request thất bại');
      }
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const handleApprove = async (requestId) => {
    try {
      const res = await fetch(`${API_BASE}/leaves/${requestId}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver_id: currentUser.user_id }),
      });
      if (res.ok) { fetchPending(); fetchMyRequests(); }
      else { const e = await res.json(); showToast(e.message); }
    } catch (e) { console.error(e); }
  };

  const handleReject = async (requestId, note) => {
    const reason = note || window.prompt('Lý do từ chối (tuỳ chọn):') || '';
    try {
      const res = await fetch(`${API_BASE}/leaves/${requestId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver_id: currentUser.user_id, note: reason }),
      });
      if (res.ok) { fetchPending(); fetchMyRequests(); }
      else { const e = await res.json(); showToast(e.message); }
    } catch (e) { console.error(e); }
  };

  const handleWfhCheckin = async () => {
    setWfhLoading(true);
    try {
      const res = await fetch(`${API_BASE}/attendance/wfh-checkin?user_id=${currentUser.user_id}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast(json.data?.message || 'Điểm danh WFH thành công!', 'success');
        fetchDayStatus();
      } else {
        showToast(json.message || 'Lỗi khi điểm danh WFH');
      }
    } catch (e) { console.error(e); }
    finally { setWfhLoading(false); }
  };

  const handleAddTrip = async () => {
    if (!tripForm.user_id || !tripForm.date_from || !tripForm.date_to) return showToast('Vui lòng điền đủ thông tin');
    try {
      const res = await fetch(`${API_BASE}/leaves/business-trip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.user_id },
        body: JSON.stringify(tripForm),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setShowTripForm(false);
        setTripForm({ user_id: '', date_from: '', date_to: '', destination: '', note: '' });
        showToast('Đã thêm ngày công tác thành công!', 'success');
      } else { showToast(json.message || 'Thất bại'); }
    } catch (e) { console.error(e); }
  };

  const handleAddHoliday = async () => {
    if (!holidayForm.date || !holidayForm.name) return showToast('Vui lòng nhập ngày và tên ngày lễ');
    try {
      const res = await fetch(`${API_BASE}/leaves/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(holidayForm),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setShowHolidayForm(false);
        setHolidayForm({ date: '', name: '', description: '' });
        fetchHolidays();
      } else { showToast(json.message || 'Thất bại'); }
    } catch (e) { console.error(e); }
  };

  const handleCancelRequest = async (requestId) => {
    if (!window.confirm('Bạn có chắc chắn muốn hủy đơn này không?')) return;
    try {
      const res = await fetch(`${API_BASE}/leaves/${requestId}/cancel?user_id=${currentUser.user_id}`, { method: 'PATCH' });
      const json = await res.json();
      if (res.ok && json.success) {
        fetchMyRequests();
      } else {
        showToast(json.message || 'Hủy đơn thất bại');
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteHoliday = async (date) => {
    if (!window.confirm(`Xóa ngày lễ ${date}?`)) return;
    try {
      await fetch(`${API_BASE}/leaves/holidays/${date}`, { method: 'DELETE' });
      fetchHolidays();
    } catch (e) { console.error(e); }
  };

  // ── Styles ─────────────────────────────────────────────────────────────────

  const inputStyle = {
    background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', padding: '0.65rem 0.9rem', color: 'var(--text-primary)',
    fontFamily: 'inherit', fontSize: '0.88rem', width: '100%', outline: 'none',
  };
  const labelStyle = { fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', display: 'block' };

  const TAB_STYLE = (active) => ({
    padding: '0.5rem 1.2rem', borderRadius: '8px', border: 'none',
    cursor: 'pointer', fontWeight: 600, fontSize: '0.83rem', fontFamily: 'inherit',
    background: active ? 'var(--accent-primary)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted)',
    transition: 'all .2s',
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.6rem' }}>
            <CalendarDays size={26} color="var(--accent-primary)" /> Nghỉ phép
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.4rem', fontSize: '0.9rem' }}>
            Đăng ký làm việc từ xa, nghỉ phép và quản lý lịch nghỉ
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* WFH Check-in button — only if WFH approved today */}
          {dayStatus?.wfh_approved && (
            <Btn variant="success" onClick={handleWfhCheckin} disabled={wfhLoading}>
              {wfhLoading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Home size={15} />}
              Điểm danh WFH
            </Btn>
          )}
          {/* Staff: submit request */}
          <Btn onClick={() => setShowForm(true)}>
            <Plus size={15} /> Đăng ký nghỉ / WFH
          </Btn>
          {/* Manager/Admin: add business trip */}
          {isManager && (
            <Btn variant="warning" onClick={() => setShowTripForm(true)}>
              <Briefcase size={15} /> Thêm công tác
            </Btn>
          )}
          {/* Admin: add holiday */}
          {isAdmin && (
            <Btn variant="ghost" onClick={() => setShowHolidayForm(true)}>
              <Plus size={15} /> Thêm ngày lễ
            </Btn>
          )}
        </div>
      </div>

      {/* ── Today status banner ── */}
      {dayStatus && (dayStatus.is_off_day || dayStatus.wfh_approved || dayStatus.is_weekend) && (
        <div style={{
          padding: '0.85rem 1.2rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: dayStatus.wfh_approved ? 'rgba(6,182,212,0.1)' : dayStatus.is_holiday ? 'rgba(167,139,250,0.1)' : 'rgba(100,116,139,0.1)',
          border: `1px solid ${dayStatus.wfh_approved ? 'rgba(6,182,212,0.25)' : 'rgba(255,255,255,0.08)'}`,
        }}>
          {dayStatus.wfh_approved
            ? <><Home size={18} color="#06b6d4" /><span style={{ color: '#06b6d4', fontWeight: 600 }}>Hôm nay bạn đang WFH — hãy bấm "Điểm danh WFH" khi bắt đầu làm việc.</span></>
            : dayStatus.is_holiday
              ? <><Shield size={18} color="#a78bfa" /><span style={{ color: '#a78bfa', fontWeight: 600 }}>Hôm nay là ngày lễ: {dayStatus.holiday_name}. Hệ thống sẽ không ghi ABSENT.</span></>
              : dayStatus.is_weekend
                ? <><Coffee size={18} color="var(--text-muted)" /><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Hôm nay là cuối tuần. Chúc bạn nghỉ ngơi vui vẻ!</span></>
                : null
          }
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: '0' }}>
        <button style={TAB_STYLE(activeTab === 'calendar')} onClick={() => setActiveTab('calendar')}>Lịch tháng</button>
        {isManager && <button style={TAB_STYLE(activeTab === 'pending')} onClick={() => setActiveTab('pending')}>
          Chờ duyệt {pending.length > 0 && <span style={{ background: 'var(--accent-danger)', color: '#fff', borderRadius: '10px', padding: '0 6px', fontSize: '0.72rem', marginLeft: 4 }}>{pending.length}</span>}
        </button>}
        <button style={TAB_STYLE(activeTab === 'my')} onClick={() => setActiveTab('my')}>Lịch sử của tôi</button>
        {isAdmin && <button style={TAB_STYLE(activeTab === 'holidays')} onClick={() => setActiveTab('holidays')}>Ngày lễ ({holidays.length})</button>}
      </div>

      {/* ── My Requests tab ── */}
      {activeTab === 'my' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {loading && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}><Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>}
          {!loading && myRequests.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
              <CalendarDays size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p>Chưa có request nào. Bấm "Đăng ký nghỉ / WFH" để tạo mới.</p>
            </div>
          )}
          {myRequests.map(r => (
            <div key={r.request_id} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '12px', padding: '1rem 1.25rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge status={r.leave_type} type="leave" />
                  <Badge status={r.status} type="status" />
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {r.date_from} → {r.date_to}
                </div>
                {r.reason && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.reason}</div>}
                {r.approver_note && r.status !== 'PENDING' && (
                  <div style={{ fontSize: '0.78rem', color: r.status === 'APPROVED' ? '#10b981' : '#ef4444' }}>
                    Ghi chú: {r.approver_note}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.6rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {new Date(r.created_at).toLocaleDateString('vi-VN')}
                </div>
                {(r.status === 'PENDING' || r.status === 'APPROVED') && r.date_from > today && (
                  <Btn variant="ghost" onClick={() => handleCancelRequest(r.request_id)} style={{ color: 'var(--accent-danger)', borderColor: 'rgba(239, 68, 68, 0.2)', padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
                    <XCircle size={14} /> Hủy
                  </Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pending tab (Manager) ── */}
      {activeTab === 'pending' && isManager && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {pending.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
              <CheckCircle2 size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
              <p>Không có request nào đang chờ duyệt.</p>
            </div>
          )}
          {pending.map(r => (
            <div key={r.request_id} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: '12px', padding: '1rem 1.25rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                  <User size={14} color="var(--text-muted)" />
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{users.find(u => u.user_id === r.user_id)?.name || r.user_id}</span>
                  <Badge status={r.leave_type} type="leave" />
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                  {r.date_from} → {r.date_to}
                </div>
                {r.reason && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.reason}</div>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Btn variant="success" onClick={() => handleApprove(r.request_id)}>
                  <CheckCircle2 size={13} /> Duyệt
                </Btn>
                <Btn variant="danger" onClick={() => handleReject(r.request_id)}>
                  <XCircle size={13} /> Từ chối
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Calendar tab ── */}
      {activeTab === 'calendar' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 450px) 1fr', gap: '2rem', alignItems: 'start' }}>
          <MiniCalendar
            myRequests={myRequests}
            holidays={holidays}
            isAdmin={isAdmin}
            isManager={isManager}
            onDateClick={(dateStr, state) => {
              if (isAdmin && !state?.isWeekend && !state?.isHoliday) {
                // Show inline action panel instead of confirm()
                setDateAction({ date: dateStr, state });
              } else {
                setFormData(f => ({ ...f, date_from: dateStr, date_to: dateStr }));
                setShowForm(true);
              }
            }}
          />

          {/* Side panel: summary of events this month */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>



            {/* Quick stats Card */}
            <div style={{
              background: 'linear-gradient(145deg, rgba(30,41,59,0.5) 0%, rgba(15,23,42,0.6) 100%)',
              backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '20px', padding: '1.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.2rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: '10px', background: 'rgba(167,139,250,0.15)', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart2 size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Tổng kết của tôi</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
                {[
                  { label: 'Đã duyệt', count: myRequests.filter(r => r.status === 'APPROVED').length, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                  { label: 'Chờ duyệt', count: myRequests.filter(r => r.status === 'PENDING').length, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                  { label: 'Từ chối', count: myRequests.filter(r => r.status === 'REJECTED').length, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
                ].map(s => (
                  <div key={s.label} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '1.2rem', background: 'rgba(0,0,0,0.15)',
                    borderRadius: '16px', border: `1px solid ${s.bg}`, gap: '0.4rem',
                    transition: 'transform 0.2s', cursor: 'default'
                  }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                    <span style={{ fontWeight: 800, fontSize: '1.8rem', color: s.color, lineHeight: 1 }}>{s.count}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ── Holidays tab (Admin) ── */}
      {activeTab === 'holidays' && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {holidays.map(h => (
            <div key={h.date} style={{
              background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)',
              borderRadius: '10px', padding: '0.75rem 1rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{h.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{h.date}</div>
              </div>
              <button onClick={() => handleDeleteHoliday(h.date)} style={{
                background: 'transparent', border: 'none', color: 'var(--accent-danger)',
                cursor: 'pointer', padding: '0.3rem',
              }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Date Action (Admin only) ── */}
      {dateAction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }} onClick={() => setDateAction(null)}>
          <div style={{ background: 'var(--bg-panel)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '1rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>📅 {dateAction.date}</h3>
              <button onClick={() => setDateAction(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}><XCircle size={20} /></button>
            </div>

            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Bạn muốn thực hiện hành động gì cho ngày này?</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button
                onClick={() => {
                  setHolidayForm({ date: dateAction.date, name: '', description: '' });
                  setShowHolidayForm(true);
                  setDateAction(null);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid rgba(167,139,250,0.3)',
                  background: 'rgba(167,139,250,0.1)', color: '#a78bfa',
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.9rem',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(167,139,250,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(167,139,250,0.1)'}
              >
                <div style={{ background: 'rgba(167,139,250,0.2)', padding: '0.3rem', borderRadius: '8px' }}><Plus size={16} /></div>
                Thêm ngày lễ
              </button>

              <button
                onClick={() => {
                  setFormData(f => ({ ...f, date_from: dateAction.date, date_to: dateAction.date }));
                  setShowForm(true);
                  setDateAction(null);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid rgba(6,182,212,0.3)',
                  background: 'rgba(6,182,212,0.1)', color: '#06b6d4',
                  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.9rem',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(6,182,212,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(6,182,212,0.1)'}
              >
                <div style={{ background: 'rgba(6,182,212,0.2)', padding: '0.3rem', borderRadius: '8px' }}><Coffee size={16} /></div>
                Đăng ký nghỉ / WFH
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Submit Leave Request ── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: 'var(--bg-panel)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <h3 style={{ margin: 0 }}>Đăng ký Nghỉ phép / WFH</h3>

            <div>
              <label style={labelStyle}>Loại đăng ký *</label>
              <select value={formData.leave_type} onChange={e => setFormData({ ...formData, leave_type: e.target.value })} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="WFH" style={{ color: '#000' }}>Làm việc từ xa (WFH)</option>
                <option value="ANNUAL_LEAVE" style={{ color: '#000' }}>Nghỉ phép năm</option>
                <option value="SICK_LEAVE" style={{ color: '#000' }}>Nghỉ ốm</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Ngày *</label>
              <input type="date" value={formData.date_from} min={today} onChange={e => setFormData({ ...formData, date_from: e.target.value, date_to: e.target.value })} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>

            <div>
              <label style={labelStyle}>Lý do (tuỳ chọn)</label>
              <textarea value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} placeholder="Ghi chú lý do..." style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Btn variant="ghost" onClick={() => setShowForm(false)}>Hủy</Btn>
              <Btn onClick={handleSubmitRequest} disabled={submitting}>
                {submitting ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Đang gửi...</> : 'Gửi đăng ký'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Business Trip (Manager/Admin) ── */}
      {showTripForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: 'var(--bg-panel)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <h3 style={{ margin: 0 }}>Thêm ngày Công tác</h3>
            <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-muted)' }}>
              Ngày công tác được tự động phê duyệt. Hệ thống sẽ không ghi ABSENT cho nhân viên vào những ngày này.
            </p>

            <div>
              <label style={labelStyle}>Nhân viên *</label>
              <select value={tripForm.user_id} onChange={e => setTripForm({ ...tripForm, user_id: e.target.value })} style={{ ...inputStyle, appearance: 'none' }}>
                <option value="">-- Chọn nhân viên --</option>
                {users.filter(u => !isAdmin ? u.department === currentUser?.department : true).map(u => (
                  <option key={u.user_id} value={u.user_id} style={{ color: '#000' }}>{u.name} – {u.role}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Ngày công tác *</label>
              <input type="date" value={tripForm.date_from} onChange={e => setTripForm({ ...tripForm, date_from: e.target.value, date_to: e.target.value })} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>

            <div>
              <label style={labelStyle}>Địa điểm công tác</label>
              <input value={tripForm.destination} onChange={e => setTripForm({ ...tripForm, destination: e.target.value })} placeholder="VD: Hà Nội, TP.HCM..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Ghi chú</label>
              <input value={tripForm.note} onChange={e => setTripForm({ ...tripForm, note: e.target.value })} placeholder="Ghi chú thêm..." style={inputStyle} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Btn variant="ghost" onClick={() => setShowTripForm(false)}>Hủy</Btn>
              <Btn variant="warning" onClick={handleAddTrip}>Xác nhận</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Holiday (Admin) ── */}
      {showHolidayForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ background: 'var(--bg-panel)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <h3 style={{ margin: 0 }}>Thêm Ngày Lễ</h3>
            <div>
              <label style={labelStyle}>Ngày *</label>
              <input type="date" value={holidayForm.date} onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>
            <div>
              <label style={labelStyle}>Tên ngày lễ *</label>
              <input value={holidayForm.name} onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })} placeholder="VD: Ngày Quốc Khánh" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Mô tả</label>
              <input value={holidayForm.description} onChange={e => setHolidayForm({ ...holidayForm, description: e.target.value })} placeholder="Tuỳ chọn..." style={inputStyle} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Btn variant="ghost" onClick={() => setShowHolidayForm(false)}>Hủy</Btn>
              <Btn onClick={handleAddHoliday}>Thêm</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', padding: '12px 24px', borderRadius: '8px', zIndex: 9999,
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 500,
          animation: 'fadeInDown 0.3s ease-out'
        }}>
          {toast.type === 'error' ? <AlertTriangle size={18} color="#ef4444" /> : <CheckCircle2 size={18} color="#10b981" />}
          {toast.message}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
