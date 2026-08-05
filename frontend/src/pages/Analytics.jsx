import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  BarChart2, TrendingUp, Users, CheckCircle2, Clock, XCircle,
  RefreshCw, Database, Search, Calendar, ChevronDown, Briefcase,
  AlertTriangle, ListChecks, PieChart, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/* ═══════════════════════════════════════════════════════════════════════════════
   API LAYER
   ═══════════════════════════════════════════════════════════════════════════════ */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchReportSummary(start, end, department = '') {
  const params = new URLSearchParams({ period_start: start, period_end: end });
  if (department && department !== 'ALL') params.append('department', department);
  const res = await fetch(`${API_BASE}/reports/summary?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).data;
}

async function fetchTrend(start, end, department = '') {
  const params = new URLSearchParams({ period_start: start, period_end: end });
  if (department && department !== 'ALL') params.append('department', department);
  const res = await fetch(`${API_BASE}/reports/trend?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).data;
}

async function fetchUserStats(userId, start, end) {
  const params = new URLSearchParams({ period_start: start, period_end: end });
  const res = await fetch(`${API_BASE}/reports/users/${userId}/stats?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).data;
}

async function fetchDepartmentComparison(start, end) {
  const params = new URLSearchParams({ period_start: start, period_end: end });
  const res = await fetch(`${API_BASE}/reports/departments?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).data;
}

async function fetchMyAnalytics(userId, start, end) {
  const params = new URLSearchParams({ user_id: userId, period_start: start, period_end: end });
  const res = await fetch(`${API_BASE}/reports/my-analytics?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).data;
}

async function fetchTasksSummary(department = '') {
  const params = new URLSearchParams({});
  if (department && department !== 'ALL') params.append('department', department);
  const res = await fetch(`${API_BASE}/reports/tasks-summary?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).data;
}

async function searchUsersAPI(query, department = '') {
  const params = new URLSearchParams({ search: query });
  if (department && department !== 'ALL') params.append('department', department);
  const res = await fetch(`${API_BASE}/users?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).data.items || [];
}

async function fetchUserTasksAPI(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}/tasks`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).data.items || [];
}

/* ═══════════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════════ */

function formatDate(d) {
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function getDefaultDates(daysBack = 14) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - daysBack);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function getInitials(name = '') {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SHARED UI COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════════ */

// ── Circular Progress Ring (SVG) ─────────────────────────────────────────────
const CircularProgress = ({ value = 0, size = 56, strokeWidth = 5, color = '#06b6d4' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
    </svg>
  );
};

// ── Donut Chart (SVG) ────────────────────────────────────────────────────────
const DonutChart = ({ data = [], size = 180 }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Chưa có dữ liệu
      </div>
    );
  }
  const cx = size / 2, cy = size / 2, radius = size * 0.36, strokeW = size * 0.18;
  let cumulative = 0;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background ring */}
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeW} />
      {data.filter(d => d.value > 0).map((d, i) => {
        const pct = d.value / total;
        const dashLen = pct * circumference;
        const dashOff = -cumulative * circumference;
        cumulative += pct;
        return (
          <circle key={i} cx={cx} cy={cy} r={radius} fill="none"
            stroke={d.color} strokeWidth={strokeW} strokeLinecap="butt"
            strokeDasharray={`${dashLen} ${circumference - dashLen}`}
            strokeDashoffset={dashOff}
            style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'all 0.8s ease-out' }} />
        );
      })}
      {/* Center text */}
      <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)" fontSize="1.5rem" fontWeight="700" fontFamily="var(--font-heading)">{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--text-muted)" fontSize="0.7rem" fontWeight="500">tổng task</text>
    </svg>
  );
};

// ── Horizontal Progress Bar ──────────────────────────────────────────────────
const ProgressBar = ({ value = 0, height = 8, color }) => {
  const barColor = color || (value >= 90 ? 'var(--accent-success)' : value >= 70 ? 'var(--accent-warning)' : 'var(--accent-danger)');
  return (
    <div style={{ flex: 1, height, background: 'rgba(255,255,255,0.06)', borderRadius: height / 2, overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(value, 100)}%`, height: '100%', borderRadius: height / 2,
        background: barColor, transition: 'width 0.8s ease-out',
      }} />
    </div>
  );
};

// ── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color = 'var(--accent-primary)', ring = false, ringValue = 0, delay = 0 }) => (
  <div style={{
    background: 'var(--bg-surface)', backdropFilter: 'blur(12px)',
    border: '1px solid var(--glass-border)', borderRadius: '16px',
    padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem',
    animation: `fadeIn 0.5s ${delay}s ease-out both`,
    transition: 'border-color 0.3s, box-shadow 0.3s',
  }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}40`; e.currentTarget.style.boxShadow = `0 0 20px ${color}15`; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--glass-border)'; e.currentTarget.style.boxShadow = 'none'; }}
  >
    {ring ? (
      <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
        <CircularProgress value={ringValue} size={56} color={color} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={color} />
        </div>
      </div>
    ) : (
      <div style={{
        width: 46, height: 46, borderRadius: '12px', flexShrink: 0,
        background: `linear-gradient(135deg, ${color}20, ${color}08)`,
        border: `1px solid ${color}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} color={color} />
      </div>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1, fontFamily: 'var(--font-heading)' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{sub}</div>}
    </div>
  </div>
);

// ── Section Card ─────────────────────────────────────────────────────────────
const SectionCard = ({ title, badge, children, action, icon: SectionIcon, delay = 0 }) => (
  <div style={{
    background: 'var(--bg-surface)', backdropFilter: 'blur(12px)',
    border: '1px solid var(--glass-border)', borderRadius: '16px',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    animation: `fadeIn 0.5s ${delay}s ease-out both`,
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)',
      background: 'rgba(255,255,255,0.015)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {SectionIcon && <SectionIcon size={17} color="var(--accent-primary)" style={{ opacity: 0.7 }} />}
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
        {badge}
      </div>
      {action}
    </div>
    <div style={{ padding: '1.25rem 1.5rem', flex: 1 }}>
      {children}
    </div>
  </div>
);

// ── DataSource Badge ─────────────────────────────────────────────────────────
const DataSourceBadge = ({ source }) => {
  const isAthena = source === 'athena';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.15rem 0.55rem', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 600,
      background: isAthena ? 'rgba(6,182,212,0.12)' : 'rgba(245,158,11,0.12)',
      color: isAthena ? 'var(--accent-primary)' : 'var(--accent-warning)',
      border: `1px solid ${isAthena ? 'rgba(6,182,212,0.25)' : 'rgba(245,158,11,0.25)'}`,
    }}>
      <Database size={10} />
      {isAthena ? 'Athena' : 'DynamoDB'}
    </span>
  );
};

// ── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '10px', padding: '0.65rem 0.9rem', fontSize: '0.8rem',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.75rem' }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
          <strong style={{ color: '#fff' }}>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = ({ text = 'Đang tải dữ liệu...' }) => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem 0', color: 'var(--text-muted)', gap: '0.5rem' }}>
    <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
    <span style={{ fontSize: '0.85rem' }}>{text}</span>
  </div>
);

// ── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    PRESENT: { bg: 'rgba(16,185,129,0.15)', color: 'var(--accent-success)', label: 'Đúng giờ' },
    LATE: { bg: 'rgba(245,158,11,0.15)', color: 'var(--accent-warning)', label: 'Đi muộn' },
    ABSENT: { bg: 'rgba(239,68,68,0.15)', color: 'var(--accent-danger)', label: 'Vắng' },
  };
  const s = map[status] || { bg: 'rgba(100,116,139,0.15)', color: 'var(--text-muted)', label: status };
  return (
    <span style={{ padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════ */

const Analytics = () => {
  const { currentUser } = useAuth();
  const user = currentUser || {};
  const role = user.role || 'STAFF';
  const userDept = user.department || 'IT';

  // Role detection
  const isAdmin = ['ADMIN', 'DIRECTOR', 'PO'].includes(role);
  const isPM = ['PM', 'MANAGER'].includes(role);
  const isStaff = !isAdmin && !isPM;

  const defaults = getDefaultDates(14);
  const [dateRange, setDateRange] = useState(defaults);
  const [department, setDepartment] = useState(isPM ? userDept : 'ALL');

  // Data states
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState(null);
  const [taskData, setTaskData] = useState(null);
  const [deptComparison, setDeptComparison] = useState(null);
  const [myAnalytics, setMyAnalytics] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [userIdInput, setUserIdInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserTasks, setSelectedUserTasks] = useState(null);
  const [visibleRecords, setVisibleRecords] = useState(10);
  const [visibleTasks, setVisibleTasks] = useState(10);

  const [loading, setLoading] = useState({ main: false, user: false });
  const [errors, setErrors] = useState({ main: null, user: null });

  /* ── Load data based on role ────────────────────────────────────────────── */
  const loadData = useCallback(async () => {
    setLoading(l => ({ ...l, main: true }));
    setErrors(e => ({ ...e, main: null }));
    try {
      if (isStaff) {
        const my = await fetchMyAnalytics(user.user_id || user.id || '', dateRange.start, dateRange.end);
        setMyAnalytics(my);
      } else {
        const dept = isPM ? userDept : department;
        const promises = [
          fetchReportSummary(dateRange.start, dateRange.end, dept),
          fetchTrend(dateRange.start, dateRange.end, dept),
          fetchTasksSummary(dept),
        ];
        if (isAdmin) {
          promises.push(fetchDepartmentComparison(dateRange.start, dateRange.end));
        }
        const results = await Promise.all(promises);
        setSummary(results[0]);
        setTrend(results[1]);
        setTaskData(results[2]);
        if (isAdmin && results[3]) setDeptComparison(results[3]);
      }
    } catch (err) {
      setErrors(e => ({ ...e, main: err.message }));
    } finally {
      setLoading(l => ({ ...l, main: false }));
    }
  }, [dateRange, department, isStaff, isPM, isAdmin, user, userDept]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── User lookup ────────────────────────────────────────────────────────── */
  const handleSearchUsers = async () => {
    if (!userIdInput.trim()) return;
    setLoading(l => ({ ...l, user: true }));
    setErrors(e => ({ ...e, user: null }));
    setSearchResults([]);
    setUserStats(null);
    setSelectedUser(null);
    try {
      const searchDept = isPM ? userDept : ''; 
      const results = await searchUsersAPI(userIdInput.trim(), searchDept);
      setSearchResults(results);
      if (results.length === 0) {
        setErrors(e => ({ ...e, user: 'Không tìm thấy nhân viên nào phù hợp.' }));
      }
    } catch (err) {
      setErrors(e => ({ ...e, user: `Lỗi tìm kiếm: ${err.message}` }));
    } finally {
      setLoading(l => ({ ...l, user: false }));
    }
  };

  const handleSelectUser = async (u) => {
    setSelectedUser(u);
    setLoading(l => ({ ...l, user: true }));
    setErrors(e => ({ ...e, user: null }));
    setUserStats(null);
    setSelectedUserTasks(null);
    setVisibleRecords(10);
    setVisibleTasks(10);
    try {
      const [data, tasks] = await Promise.all([
        fetchUserStats(u.user_id, dateRange.start, dateRange.end),
        fetchUserTasksAPI(u.user_id)
      ]);
      setUserStats(data);
      setSelectedUserTasks(tasks);
    } catch (err) {
      setErrors(e => ({ ...e, user: `Lỗi tải thống kê: ${err.message}` }));
    } finally {
      setLoading(l => ({ ...l, user: false }));
    }
  };

  /* ── Computed data ──────────────────────────────────────────────────────── */
  const trendChartData = useMemo(() => {
    if (!trend?.points?.length) return [];
    const byDate = {};
    trend.points.forEach(p => {
      if (!byDate[p.date]) byDate[p.date] = { date: formatDate(p.date), present: 0, late: 0, absent: 0 };
      byDate[p.date].present += p.present;
      byDate[p.date].late += p.late;
      byDate[p.date].absent += (p.absent || 0);
    });
    return Object.values(byDate);
  }, [trend]);

  const trendTotals = useMemo(() => {
    return trendChartData.reduce((acc, d) => ({
      present: acc.present + d.present,
      late: acc.late + d.late,
      absent: acc.absent + d.absent,
    }), { present: 0, late: 0, absent: 0 });
  }, [trendChartData]);

  const taskDonutData = useMemo(() => {
    if (!taskData?.stats) return [];
    const stats = taskData.stats;
    const done = (stats['DONE'] || 0) + (stats['RESOLVED'] || 0) + (stats['COMPLETED'] || 0);
    const ip = (stats['IN_PROGRESS'] || 0) + (stats['IN_REVIEW'] || 0);
    const overdue = stats['OVERDUE'] || 0;
    const todo = (stats['TODO'] || 0) + (stats['OPEN'] || 0);
    const cancelled = (stats['CANCELLED'] || 0) + (stats['REJECTED'] || 0);
    return [
      { label: 'Hoàn thành', value: done, color: '#10b981' },
      { label: 'Đang xử lý', value: ip, color: '#06b6d4' },
      { label: 'Quá hạn', value: Math.max(0, overdue), color: '#ef4444' },
      { label: 'Chờ xử lý', value: Math.max(0, todo), color: '#64748b' },
      { label: 'Đã hủy', value: cancelled, color: '#475569' },
    ].filter(d => d.value > 0);
  }, [taskData]);

  const topAbsentUsers = summary?.top_absent_users?.slice(0, 6) || [];

  /* ── User records mini chart ────────────────────────────────────────────── */
  const userChartData = useMemo(() => {
    if (!userStats?.records?.length) return [];
    const byDate = {};
    userStats.records.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = { date: formatDate(r.date), present: 0, late: 0 };
      if (r.status === 'PRESENT') byDate[r.date].present++;
      else if (r.status === 'LATE') byDate[r.date].late++;
    });
    return Object.values(byDate);
  }, [userStats]);

  /* ═════════════════════════════════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════════════════════════════════ */

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontFamily: 'var(--font-heading)' }}>
            <BarChart2 size={26} color="var(--accent-primary)" />
            {isStaff ? 'Báo cáo cá nhân' : 'Thống kê & Báo cáo'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {isStaff
              ? `Chấm công & tiến độ công việc — ${user.full_name || user.name || ''}`
              : isPM
                ? `Thống kê phòng ${userDept} — Chấm công & Công việc`
                : 'Tổng quan toàn hệ thống — Chấm công & Công việc'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* Department filter (Admin only, locked for PM, hidden for Staff) */}
          {!isStaff && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px', padding: '0.45rem 0.75rem',
            }}>
              <Users size={14} color="var(--text-muted)" />
              <select
                value={isPM ? userDept : department}
                disabled={isPM}
                onChange={e => setDepartment(e.target.value)}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-primary)',
                  fontSize: '0.82rem', outline: 'none', cursor: isPM ? 'not-allowed' : 'pointer',
                }}
              >
                {isPM ? (
                  <option value={userDept} style={{ background: '#1e293b' }}>Phòng: {userDept} 🔒</option>
                ) : (
                  <>
                    <option value="ALL" style={{ background: '#1e293b' }}>Tất cả bộ phận</option>
                    <option value="IT" style={{ background: '#1e293b' }}>IT</option>
                    <option value="MAINTENANCE" style={{ background: '#1e293b' }}>Bảo trì</option>
                    <option value="SECURITY" style={{ background: '#1e293b' }}>An ninh</option>
                    <option value="HR" style={{ background: '#1e293b' }}>Nhân sự</option>
                    <option value="ADMIN" style={{ background: '#1e293b' }}>Ban Giám đốc</option>
                  </>
                )}
              </select>
            </div>
          )}

          {/* Date Range */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px', padding: '0.45rem 0.75rem',
          }}>
            <Calendar size={14} color="var(--text-muted)" />
            <input type="date" value={dateRange.start}
              onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.82rem', outline: 'none' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>→</span>
            <input type="date" value={dateRange.end}
              onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.82rem', outline: 'none' }} />
          </div>

          <button onClick={loadData} disabled={loading.main}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.5rem 0.9rem', borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-primary), #0891b2)',
              color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
              opacity: loading.main ? 0.6 : 1, transition: 'opacity 0.2s',
            }}>
            <RefreshCw size={14} style={{ animation: loading.main ? 'spin 0.8s linear infinite' : 'none' }} />
            Tải lại
          </button>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {errors.main && (
        <div style={{
          padding: '1rem 1.25rem', background: 'rgba(239,68,68,0.08)', borderRadius: '12px',
          border: '1px solid rgba(239,68,68,0.2)', color: 'var(--accent-danger)', fontSize: '0.88rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <AlertTriangle size={16} /> Không thể tải dữ liệu: {errors.main}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
         VIEW 3: STAFF – My Analytics
         ══════════════════════════════════════════════════════════════════════ */}
      {isStaff ? (
        loading.main && !myAnalytics ? <Spinner /> : myAnalytics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <StatCard icon={TrendingUp} label="Tỉ lệ chuyên cần" value={`${myAnalytics.attendance_rate}%`}
                sub={`${myAnalytics.total_sessions} buổi ghi nhận`} color="var(--accent-primary)" ring ringValue={myAnalytics.attendance_rate} delay={0} />
              <StatCard icon={CheckCircle2} label="Có mặt / Đúng giờ" value={`${myAnalytics.present_count}`}
                sub="buổi check-in đúng giờ" color="var(--accent-success)" delay={0.1} />
              <StatCard icon={Clock} label="Đi muộn" value={`${myAnalytics.late_count}`}
                sub="buổi check-in trễ" color="var(--accent-warning)" delay={0.2} />
              <StatCard icon={Briefcase} label="Hiệu suất Task" value={`${myAnalytics.task_workload?.completion_rate || 100}%`}
                sub={`${myAnalytics.task_workload?.completed || 0}/${myAnalytics.task_workload?.total_assigned || 0} công việc`}
                color="var(--accent-secondary)" ring ringValue={myAnalytics.task_workload?.completion_rate || 100} delay={0.3} />
            </div>

            {/* Task Workload + Attendance Logs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.25rem' }}>
              <SectionCard title="Tiến độ công việc" icon={ListChecks} delay={0.2}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[
                    { label: 'Tổng được giao', val: myAnalytics.task_workload?.total_assigned || 0, color: 'var(--text-primary)', bg: 'rgba(255,255,255,0.03)' },
                    { label: 'Hoàn thành', val: myAnalytics.task_workload?.completed || 0, color: 'var(--accent-success)', bg: 'rgba(16,185,129,0.06)' },
                    { label: 'Đang xử lý', val: myAnalytics.task_workload?.in_progress || 0, color: '#60a5fa', bg: 'rgba(59,130,246,0.06)' },
                    { label: 'Quá hạn', val: myAnalytics.task_workload?.overdue || 0, color: (myAnalytics.task_workload?.overdue || 0) > 0 ? 'var(--accent-danger)' : 'var(--text-muted)', bg: (myAnalytics.task_workload?.overdue || 0) > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)' },
                  ].map((item, i) => (
                    <div key={i} style={{
                      padding: '1rem', borderRadius: '12px', background: item.bg,
                      border: `1px solid ${item.bg === 'rgba(255,255,255,0.03)' ? 'rgba(255,255,255,0.05)' : 'transparent'}`,
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: item.color, fontFamily: 'var(--font-heading)' }}>{item.val}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Nhật ký chấm công gần đây" icon={Clock} delay={0.3}>
                <div style={{ overflowY: 'auto', maxHeight: '280px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {['Ngày', 'Ca', 'Trạng thái', 'Thời gian'].map(h => (
                          <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(myAnalytics.recent_records || []).map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '0.6rem 0.75rem', fontWeight: 500 }}>{r.date}</td>
                          <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)' }}>{r.session_type}</td>
                          <td style={{ padding: '0.6rem 0.75rem' }}><StatusBadge status={r.status} /></td>
                          <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text-muted)' }}>
                            {r.timestamp ? new Date(r.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                        </tr>
                      ))}
                      {(!myAnalytics.recent_records || myAnalytics.recent_records.length === 0) && (
                        <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có dữ liệu chấm công</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          </div>
        )

      /* ══════════════════════════════════════════════════════════════════════
         VIEW 1 & 2: ADMIN/PO/DIRECTOR + MANAGER/PM
         ══════════════════════════════════════════════════════════════════════ */
      ) : loading.main && !summary ? <Spinner /> : summary && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ── Summary Stat Cards ─────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
            <StatCard icon={TrendingUp} label="Tỉ lệ chuyên cần" value={`${summary.overall_attendance_rate}%`}
              sub={`${dateRange.start} → ${dateRange.end}`} color="var(--accent-primary)"
              ring ringValue={summary.overall_attendance_rate} delay={0} />
            <StatCard icon={CheckCircle2} label="Đúng giờ" value={`${trendTotals.present} lượt`}
              sub="check-in đúng giờ trong kỳ" color="var(--accent-success)" delay={0.1} />
            <StatCard icon={Clock} label="Đi muộn" value={`${trendTotals.late} lượt`}
              sub="check-in trễ trong kỳ" color="var(--accent-warning)" delay={0.2} />
            <StatCard icon={Users} label="Tổng nhân sự" value={summary.total_users}
              sub={department === 'ALL' ? 'toàn hệ thống' : `phòng ${isPM ? userDept : department}`}
              color="var(--accent-secondary)" delay={0.3} />
          </div>

          {/* ── Main Row: Trend Chart + Task Donut ─────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.25rem' }}>

            {/* Attendance Trend */}
            <SectionCard title="Xu hướng chấm công" icon={TrendingUp} delay={0.2}
              badge={trend && <DataSourceBadge source={trend.data_source} />}
              action={trend?.points?.length > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {trend.points.length} điểm dữ liệu
                </span>
              )}>
              {trendChartData.length === 0 ? (
                <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Không có dữ liệu cho khoảng thời gian này
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={trendChartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                    <defs>
                      <linearGradient id="gradPresent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradLate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: '0.75rem' }} />
                    <Area type="monotone" dataKey="present" name="Có mặt" stroke="#06b6d4" fill="url(#gradPresent)" strokeWidth={2.5} dot={{ r: 3, fill: '#06b6d4', strokeWidth: 0 }} activeDot={{ r: 5, stroke: '#06b6d4', strokeWidth: 2, fill: '#0f172a' }} />
                    <Area type="monotone" dataKey="late" name="Đi muộn" stroke="#f59e0b" fill="url(#gradLate)" strokeWidth={2} dot={{ r: 2.5, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 4, stroke: '#f59e0b', strokeWidth: 2, fill: '#0f172a' }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            {/* Task Overview Donut */}
            <SectionCard title="Tổng quan công việc" icon={PieChart} delay={0.3}
              badge={taskData?.data_source === 'athena' ? (
                <span style={{ padding: '2px 8px', background: 'rgba(6,182,212,0.1)', color: '#06b6d4', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Database size={10} /> Athena
                </span>
              ) : null}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                <DonutChart data={taskDonutData} size={170} />
                {/* Legend */}
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem 1.25rem' }}>
                  {taskDonutData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '2px', background: d.color, display: 'inline-block' }} />
                      <span style={{ color: 'var(--text-muted)' }}>{d.label}</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.value}</span>
                    </div>
                  ))}
                </div>
                {/* Quick stats */}
                {taskData?.stats && (
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', width: '100%',
                  }}>
                    {[
                      { 
                        label: 'Tỉ lệ hoàn thành', 
                        value: `${Object.values(taskData.stats).reduce((a,b)=>a+b, 0) > 0 ? Math.round(((taskData.stats['DONE']||0) + (taskData.stats['RESOLVED']||0)) / Object.values(taskData.stats).reduce((a,b)=>a+b, 0) * 100) : 0}%`, 
                        color: 'var(--accent-success)' 
                      },
                      { label: 'Đang xử lý', value: taskData.stats['IN_PROGRESS'] || 0, color: '#06b6d4' },
                      { label: 'Quá hạn', value: taskDonutData.find(d => d.label === 'Quá hạn')?.value || 0, color: 'var(--accent-danger)' },
                    ].map((s, i) => (
                      <div key={i} style={{ textAlign: 'center', padding: '0.6rem 0.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: s.color, fontFamily: 'var(--font-heading)' }}>{s.value}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          {/* ── Department Comparison (ADMIN/PO only) ──────────────────────── */}
          {isAdmin && deptComparison?.departments && (
            <SectionCard title="Hiệu suất theo Phòng ban" icon={BarChart2} delay={0.4}
              badge={<span style={{ padding: '2px 8px', background: 'rgba(139,92,246,0.1)', color: 'var(--accent-secondary)', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 600 }}>
                Global View
              </span>}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['Phòng ban', 'Nhân sự', 'Tỉ lệ đúng giờ', 'Đi muộn', 'Task', 'Hoàn thành Task', 'Đánh giá'].map(h => (
                        <th key={h} style={{ padding: '0.7rem 0.85rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deptComparison.departments.map((d, idx) => {
                      const evalMap = {
                        EXCELLENT: { emoji: '🟢', text: 'Xuất sắc', bg: 'rgba(34,197,94,0.12)', color: 'var(--accent-success)' },
                        GOOD: { emoji: '🔵', text: 'Tốt', bg: 'rgba(59,130,246,0.12)', color: '#60a5fa' },
                        NEEDS_IMPROVEMENT: { emoji: '🟡', text: 'Cần cải thiện', bg: 'rgba(234,179,8,0.12)', color: 'var(--accent-warning)' },
                      };
                      const ev = evalMap[d.status_evaluation] || evalMap.GOOD;
                      return (
                        <tr key={idx}
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={{ padding: '0.75rem 0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{d.department}</td>
                          <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>{d.total_users}</td>
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <ProgressBar value={d.punctuality_rate} height={6} color="var(--accent-success)" />
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: d.punctuality_rate >= 90 ? 'var(--accent-success)' : 'var(--text-primary)', minWidth: '38px', textAlign: 'right' }}>{d.punctuality_rate}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', color: d.tardiness_index > 15 ? 'var(--accent-warning)' : 'var(--text-muted)', textAlign: 'center' }}>{d.tardiness_index}%</td>
                          <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>{d.total_assigned_tasks}</td>
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <ProgressBar value={d.task_completion_rate} height={6} color="var(--accent-primary)" />
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '38px', textAlign: 'right' }}>{d.task_completion_rate}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem' }}>
                            <span style={{ padding: '3px 10px', borderRadius: '20px', background: ev.bg, color: ev.color, fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {ev.emoji} {ev.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* ── Bottom Row: Top Absent + User Lookup ───────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

            {/* Top Absent / Cần chú ý */}
            <SectionCard title={isPM ? 'Nhân viên cần chú ý (phòng ban)' : 'Nhân viên cần chú ý'}
              icon={AlertTriangle} delay={0.5}>
              {topAbsentUsers.length === 0 ? (
                <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Không có dữ liệu vắng mặt
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {topAbsentUsers.map((u, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.6rem 0.75rem', borderRadius: '10px',
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                      transition: 'background 0.2s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}>
                      {/* Avatar */}
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: `linear-gradient(135deg, ${u.attendance_rate >= 90 ? '#10b981' : u.attendance_rate >= 70 ? '#f59e0b' : '#ef4444'}30, transparent)`,
                        border: `1.5px solid ${u.attendance_rate >= 90 ? '#10b981' : u.attendance_rate >= 70 ? '#f59e0b' : '#ef4444'}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-primary)',
                      }}>
                        {getInitials(u.name)}
                      </div>
                      {/* Name + Dept */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {u.name}
                        </div>
                        {u.department && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: '4px' }}>
                            {u.department}
                          </span>
                        )}
                      </div>
                      {/* Progress */}
                      <div style={{ width: '35%', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ProgressBar value={u.attendance_rate} height={6} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: u.attendance_rate >= 90 ? 'var(--accent-success)' : u.attendance_rate >= 70 ? 'var(--accent-warning)' : 'var(--accent-danger)', minWidth: '36px', textAlign: 'right' }}>
                          {u.attendance_rate}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* User Lookup */}
            <SectionCard title="Tra cứu nhân viên" icon={Search} delay={0.6}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  placeholder="Nhập tên hoặc Mã NV..."
                  value={userIdInput}
                  onChange={e => setUserIdInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearchUsers()}
                  style={{
                    flex: 1, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px', padding: '0.5rem 0.85rem', color: 'var(--text-primary)',
                    fontSize: '0.82rem', outline: 'none', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(6,182,212,0.4)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
                <button onClick={handleSearchUsers} disabled={loading.user || !userIdInput.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.5rem 0.85rem', borderRadius: '8px',
                    background: 'rgba(6,182,212,0.12)', color: 'var(--accent-primary)',
                    border: '1px solid rgba(6,182,212,0.25)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                    opacity: (loading.user || !userIdInput.trim()) ? 0.5 : 1, transition: 'opacity 0.2s',
                  }}>
                  <Search size={14} /> Tìm
                </button>
              </div>

              {loading.user && <Spinner text="Đang tải..." />}
              {errors.user && (
                <p style={{ color: 'var(--accent-danger)', fontSize: '0.8rem', padding: '0.4rem 0' }}>⚠️ {errors.user}</p>
              )}

              {/* Search Results List */}
              {!selectedUser && searchResults.length > 0 && !loading.user && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Kết quả tìm kiếm:</p>
                  {searchResults.map((u) => (
                    <div 
                      key={u.user_id} 
                      onClick={() => handleSelectUser(u)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.75rem', borderRadius: '8px', cursor: 'pointer',
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(6,182,212,0.2), transparent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)'
                      }}>
                        {getInitials(u.name)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{u.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mã NV: {u.user_id.split('-')[0]} • {u.department || 'N/A'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedUser && userStats && !loading.user && createPortal(
                <div style={{
                  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 9999, padding: '1rem'
                }}>
                  <div style={{
                    width: '100%', maxWidth: '650px', background: 'var(--bg-card)', 
                    padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                    display: 'flex', flexDirection: 'column', gap: '1rem',
                    maxHeight: '90vh', overflowY: 'auto'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        Chi tiết nhân viên
                      </p>
                      <button 
                        onClick={() => { setSelectedUser(null); setUserStats(null); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* User Info Card */}
                    <div style={{
                      padding: '0.85rem 1rem', borderRadius: '10px',
                      background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.12)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'linear-gradient(135deg, rgba(6,182,212,0.3), rgba(139,92,246,0.2))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: 700,
                        }}>
                          {getInitials(userStats.full_name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{userStats.full_name}</div>
                          {userStats.department && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '4px' }}>
                              {userStats.department}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem', marginBottom: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Email</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedUser.email}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Số điện thoại</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>{selectedUser.phone || 'Chưa cập nhật'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Vai trò</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>{selectedUser.role}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ngày gia nhập</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString('vi-VN') : 'N/A'}
                          </div>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Dữ liệu khuôn mặt</div>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.15rem 0.5rem', borderRadius: '4px', background: selectedUser.face_registered ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: selectedUser.face_registered ? 'var(--status-success)' : 'var(--status-error)', fontSize: '0.7rem', fontWeight: 600, marginTop: '0.2rem' }}>
                            {selectedUser.face_registered ? 'Đã đăng ký' : 'Chưa đăng ký'}
                          </div>
                        </div>
                      </div>

                      {/* Mini stat chips */}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, background: 'rgba(16,185,129,0.12)', color: 'var(--accent-success)' }}>
                          ✓ {userStats.present_count} Đúng giờ
                        </span>
                        <span style={{ padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, background: 'rgba(245,158,11,0.12)', color: 'var(--accent-warning)' }}>
                          ⏰ {userStats.late_count} Muộn
                        </span>
                        <span style={{ padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(6,182,212,0.12)', color: 'var(--accent-primary)' }}>
                          {userStats.attendance_rate}% Chuyên cần
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      {/* Records */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>Lịch sử điểm danh:</p>
                        <div style={{ maxHeight: '250px', overflowY: 'auto', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                              <tr>
                                {['Ngày', 'Trạng thái'].map(h => (
                                  <th key={h} style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {userStats.records.length === 0 ? (
                                <tr><td colSpan="2" style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Chưa có dữ liệu.</td></tr>
                              ) : userStats.records.slice(0, visibleRecords).map((r, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                  <td style={{ padding: '0.5rem' }}>{r.date}</td>
                                  <td style={{ padding: '0.5rem' }}><StatusBadge status={r.status} /></td>
                                </tr>
                              ))}
                              {userStats.records.length > visibleRecords && (
                                <tr>
                                  <td colSpan="2" style={{ textAlign: 'center', padding: '0.75rem' }}>
                                    <button 
                                      onClick={() => setVisibleRecords(prev => prev + 10)}
                                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                                    >
                                      Tải thêm ({userStats.records.length - visibleRecords} còn lại)
                                    </button>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Tasks List */}
                      {selectedUserTasks && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>Công việc đang thực hiện:</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.2rem' }}>
                            {selectedUserTasks.length === 0 ? (
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Không có công việc nào.</p>
                            ) : selectedUserTasks.slice(0, visibleTasks).map(t => (
                              <div key={t.task_id} style={{
                                padding: '0.6rem 0.75rem', borderRadius: '8px',
                                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                              }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{t.title}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                                  <span style={{ color: 'var(--text-muted)' }}>Hạn: {t.due_date ? new Date(t.due_date).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                                  <span style={{ fontWeight: 600, color: ['DONE', 'COMPLETED'].includes(t.status) ? 'var(--accent-success)' : 'var(--accent-warning)' }}>{t.status}</span>
                                </div>
                              </div>
                            ))}
                            {selectedUserTasks.length > visibleTasks && (
                              <button 
                                onClick={() => setVisibleTasks(prev => prev + 10)}
                                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: '0.5rem', borderRadius: '8px', marginTop: '0.2rem' }}
                              >
                                Tải thêm ({selectedUserTasks.length - visibleTasks} còn lại)
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>,
                document.body
              )}

              {!selectedUser && searchResults.length === 0 && !loading.user && !errors.user && (
                <div style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Nhập Tên hoặc Mã NV để tra cứu
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── Keyframes ───────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default Analytics;
