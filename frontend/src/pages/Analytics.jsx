import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  BarChart2, TrendingUp, Users, CheckCircle2, Clock, XCircle,
  RefreshCw, Database, Zap, ChevronDown, Search, Calendar
} from 'lucide-react';

// ── API ───────────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchReportSummary(start, end, department = '') {
  const params = new URLSearchParams({ period_start: start, period_end: end });
  if (department && department !== 'ALL') params.append('department', department);
  const res = await fetch(`${API_BASE}/reports/summary?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function fetchTrend(start, end, department = '') {
  const params = new URLSearchParams({ period_start: start, period_end: end });
  if (department && department !== 'ALL') params.append('department', department);
  const res = await fetch(`${API_BASE}/reports/trend?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function fetchUserStats(userId, start, end) {
  const params = new URLSearchParams({ period_start: start, period_end: end });
  const res = await fetch(`${API_BASE}/reports/users/${userId}/stats?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function fetchDepartmentComparison(start, end) {
  const params = new URLSearchParams({ period_start: start, period_end: end });
  const res = await fetch(`${API_BASE}/reports/departments?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function fetchMyAnalytics(userId, start, end) {
  const params = new URLSearchParams({ user_id: userId, period_start: start, period_end: end });
  const res = await fetch(`${API_BASE}/reports/my-analytics?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d) {
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function getDefaultDates(daysBack = 14) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - daysBack);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

// ── UI Components ─────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub, color = 'var(--accent-primary)' }) => (
  <div style={{
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>{label}</span>
      <div style={{
        width: 38, height: 38,
        borderRadius: '10px',
        background: `${color}1A`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} color={color} />
      </div>
    </div>
    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
      {value}
    </div>
    {sub && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{sub}</span>}
  </div>
);

const SectionCard = ({ title, badge, children, action }) => (
  <div style={{
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
        {badge}
      </div>
      {action}
    </div>
    {children}
  </div>
);

const DataSourceBadge = ({ source }) => {
  const isAthena = source === 'athena';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      padding: '0.2rem 0.6rem',
      borderRadius: '20px',
      fontSize: '0.72rem', fontWeight: 600,
      background: isAthena ? 'rgba(6,182,212,0.15)' : 'rgba(245,158,11,0.15)',
      color: isAthena ? 'var(--accent-primary)' : 'var(--accent-warning)',
      border: `1px solid ${isAthena ? 'rgba(6,182,212,0.3)' : 'rgba(245,158,11,0.3)'}`,
    }}>
      <Database size={11} />
      {isAthena ? 'Amazon Athena (S3 Lake)' : 'DynamoDB Direct'}
    </span>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.82rem',
      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>{label}</p>
      {payload.map((p, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: p.color || '#fff' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || '#fff', display: 'inline-block' }} />
          <span>{p.name}: <strong style={{ color: '#fff' }}>{p.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

const Spinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
    <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
    <span style={{ marginLeft: '0.5rem', fontSize: '0.9rem' }}>Đang tải dữ liệu...</span>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

const Analytics = () => {
  const user = React.useMemo(() => JSON.parse(localStorage.getItem('user') || '{}'), []);
  const role = user.role || 'PO'; // PO | PM | STAFF | STUDENT | DIRECTOR | ADMIN
  const isStaff = role === 'STAFF' || role === 'STUDENT';
  const isPM = role === 'PM' || role === 'MANAGER';
  const userDept = user.department || 'IT';

  const defaults = getDefaultDates(14);
  const [dateRange, setDateRange] = useState(defaults);
  const [department, setDepartment] = useState(isPM ? userDept : 'ALL');
  
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [deptComparison, setDeptComparison] = useState(null);
  const [myAnalytics, setMyAnalytics] = useState(null);
  
  const [userIdInput, setUserIdInput] = useState('');
  const [loading, setLoading] = useState({ summary: false, trend: false, user: false, my: false });
  const [errors, setErrors] = useState({ summary: null, trend: null, user: null, my: null });

  const loadSummaryAndTrend = useCallback(async () => {
    if (isStaff) {
      setLoading(l => ({ ...l, my: true }));
      setErrors(e => ({ ...e, my: null }));
      try {
        const myData = await fetchMyAnalytics(user.user_id || user.id || 'STU001', dateRange.start, dateRange.end);
        setMyAnalytics(myData);
      } catch (err) {
        setErrors(e => ({ ...e, my: err.message }));
      } finally {
        setLoading(l => ({ ...l, my: false }));
      }
      return;
    }

    setLoading(l => ({ ...l, summary: true, trend: true }));
    setErrors(e => ({ ...e, summary: null, trend: null }));
    try {
      const promises = [
        fetchReportSummary(dateRange.start, dateRange.end, department),
        fetchTrend(dateRange.start, dateRange.end, department),
      ];
      if (!isPM) {
        promises.push(fetchDepartmentComparison(dateRange.start, dateRange.end));
      }
      const results = await Promise.all(promises);
      setSummary(results[0]);
      setTrend(results[1]);
      if (!isPM && results[2]) {
        setDeptComparison(results[2]);
      }
    } catch (err) {
      setErrors(e => ({ ...e, summary: err.message, trend: err.message }));
    } finally {
      setLoading(l => ({ ...l, summary: false, trend: false }));
    }
  }, [dateRange, department, isStaff, isPM, user]);

  useEffect(() => { loadSummaryAndTrend(); }, [loadSummaryAndTrend]);

  const loadUserStats = async () => {
    if (!userIdInput.trim()) return;
    setLoading(l => ({ ...l, user: true }));
    setErrors(e => ({ ...e, user: null }));
    setUserStats(null);
    try {
      const data = await fetchUserStats(userIdInput.trim(), dateRange.start, dateRange.end);
      setUserStats(data);
    } catch (err) {
      setErrors(e => ({ ...e, user: `Không tìm thấy user hoặc lỗi: ${err.message}` }));
    } finally {
      setLoading(l => ({ ...l, user: false }));
    }
  };

  // Chart data: aggregate trend points by date
  const trendChartData = (() => {
    if (!trend?.points?.length) return [];
    const byDate = {};
    trend.points.forEach(p => {
      if (!byDate[p.date]) byDate[p.date] = { date: formatDate(p.date), present: 0, late: 0, absent: 0 };
      byDate[p.date].present += p.present;
      byDate[p.date].late += p.late;
      byDate[p.date].absent += p.absent;
    });
    return Object.values(byDate);
  })();

  // Top absent users for bar chart
  const topAbsentData = summary?.top_absent_users?.slice(0, 8).map(u => ({
    name: u.name.split(' ').slice(-2).join(' '),
    rate: u.attendance_rate,
  })) || [];

  // User records chart
  const userChartData = (() => {
    if (!userStats?.records?.length) return [];
    const byDate = {};
    userStats.records.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = { date: formatDate(r.date), present: 0, late: 0 };
      if (r.status === 'PRESENT') byDate[r.date].present++;
      else if (r.status === 'LATE') byDate[r.date].late++;
    });
    return Object.values(byDate);
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <BarChart2 size={28} color="var(--accent-primary)" />
            {isStaff ? 'My Analytics — Báo cáo cá nhân' : 'Analytics & Enterprise Reports'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {isStaff 
              ? `Theo dõi chuyên cần & tiến độ công việc cá nhân (${myAnalytics?.department || user.department || 'Chung'})` 
              : `WF5 — Thống kê điểm danh & Hiệu suất bộ phận từ DynamoDB / Amazon Athena`}
          </p>
        </div>

        {/* Controls: Department selector + Date Range Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {!isStaff && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.5rem 0.85rem' }}>
              <Users size={15} color="var(--text-muted)" />
              <select
                value={department}
                disabled={isPM}
                onChange={e => setDepartment(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none', cursor: isPM ? 'not-allowed' : 'pointer' }}
              >
                {isPM ? (
                  <option value={userDept} style={{ background: '#1e293b' }}>Phòng ban: {userDept} (Khóa quyền PM)</option>
                ) : (
                  <>
                    <option value="ALL" style={{ background: '#1e293b' }}>Toàn trường / Tất cả bộ phận</option>
                    <option value="IT" style={{ background: '#1e293b' }}>IT Department</option>
                    <option value="MAINTENANCE" style={{ background: '#1e293b' }}>Bảo trì (Maintenance)</option>
                    <option value="SECURITY" style={{ background: '#1e293b' }}>An ninh (Security)</option>
                    <option value="HR" style={{ background: '#1e293b' }}>Hành chính Nhân sự (HR)</option>
                    <option value="ADMIN" style={{ background: '#1e293b' }}>Ban Giám hiệu / Admin</option>
                  </>
                )}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.5rem 0.85rem' }}>
            <Calendar size={15} color="var(--text-muted)" />
            <input
              type="date" value={dateRange.start}
              onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>→</span>
            <input
              type="date" value={dateRange.end}
              onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none' }}
            />
          </div>
          <button
            onClick={loadSummaryAndTrend}
            disabled={loading.summary || loading.trend || loading.my}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.55rem 1rem', borderRadius: '10px',
              background: 'var(--accent-primary)', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
              opacity: (loading.summary || loading.trend || loading.my) ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} style={{ animation: (loading.summary || loading.trend || loading.my) ? 'spin 0.8s linear infinite' : 'none' }} />
            Tải lại
          </button>
        </div>
      </div>

      {isStaff ? (
        /* ── My Analytics View for STAFF / STUDENT ── */
        loading.my && !myAnalytics ? (
          <Spinner />
        ) : errors.my ? (
          <div style={{ padding: '1.5rem', background: 'rgba(239,68,68,0.1)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--accent-danger)' }}>
            ⚠️ Không thể tải báo cáo cá nhân: {errors.my}
          </div>
        ) : myAnalytics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
              <StatCard icon={TrendingUp} label="Tỉ lệ Chuyên cần" value={`${myAnalytics.attendance_rate}%`} sub="trên tổng số buổi" color="var(--accent-primary)" />
              <StatCard icon={CheckCircle2} label="Có mặt / Đúng giờ" value={`${myAnalytics.present_count} buổi`} sub="ghi nhận check-in" color="var(--accent-success)" />
              <StatCard icon={Clock} label="Đi muộn" value={`${myAnalytics.late_count} buổi`} sub="check-in trễ giờ" color="var(--accent-warning)" />
              <StatCard icon={Zap} label="Hiệu suất Task" value={`${myAnalytics.task_workload?.completion_rate || 100}%`} sub={`${myAnalytics.task_workload?.completed || 0}/${myAnalytics.task_workload?.total_assigned || 0} công việc`} color="var(--accent-secondary)" />
            </div>

            {/* Task Workload Box */}
            <SectionCard title="Tiến độ & Tải công việc cá nhân (My Task Workload)">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', textAlign: 'center', padding: '0.5rem 0' }}>
                <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{myAnalytics.task_workload?.total_assigned || 0}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Tổng được giao</div>
                </div>
                <div style={{ padding: '1.25rem', background: 'rgba(16,185,129,0.07)', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--accent-success)' }}>{myAnalytics.task_workload?.completed || 0}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Đã hoàn thành</div>
                </div>
                <div style={{ padding: '1.25rem', background: 'rgba(59,130,246,0.07)', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#60a5fa' }}>{myAnalytics.task_workload?.in_progress || 0}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Đang thực hiện</div>
                </div>
                <div style={{ padding: '1.25rem', background: (myAnalytics.task_workload?.overdue || 0) > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)', borderRadius: '12px', border: (myAnalytics.task_workload?.overdue || 0) > 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 700, color: (myAnalytics.task_workload?.overdue || 0) > 0 ? 'var(--accent-danger)' : 'var(--text-muted)' }}>{myAnalytics.task_workload?.overdue || 0}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Quá hạn (Overdue)</div>
                </div>
              </div>
            </SectionCard>

            {/* Daily Attendance Logs Table */}
            <SectionCard title="Nhật ký Check-in / Điểm danh gần đây">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.85rem 1rem' }}>Ngày</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Ca làm việc / Ca học</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Trạng thái</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Thiết bị / Camera</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Thời gian ghi nhận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(myAnalytics.recent_records || []).map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{r.date}</td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>{r.session_type}</td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{
                            padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                            background: r.status === 'PRESENT' ? 'rgba(16,185,129,0.15)' : r.status === 'LATE' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                            color: r.status === 'PRESENT' ? 'var(--accent-success)' : r.status === 'LATE' ? 'var(--accent-warning)' : 'var(--accent-danger)',
                          }}>{r.status}</span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>{r.camera_id || 'AI Camera'}</td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>{r.timestamp ? new Date(r.timestamp).toLocaleTimeString('vi-VN') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )
      ) : (
        /* ── Executive / PM View (existing summary + trend + dept comparison) ── */
        <>
          {/* KPI Cards */}
          {loading.summary && !summary ? (
            <Spinner />
          ) : errors.summary ? (
            <div style={{ padding: '1.5rem', background: 'rgba(239,68,68,0.1)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--accent-danger)', fontSize: '0.9rem' }}>
              ⚠️ Không thể tải dữ liệu: {errors.summary}
            </div>
          ) : summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
              <StatCard icon={TrendingUp} label="Tỉ lệ điểm danh" value={`${summary.overall_attendance_rate}%`} sub={`${dateRange.start} → ${dateRange.end}`} color="var(--accent-primary)" />
              <StatCard icon={Users} label="Tổng nhân sự" value={summary.total_users} sub={department === 'ALL' ? 'toàn hệ thống' : `trong bộ phận ${department}`} color="var(--accent-secondary)" />
              <StatCard icon={CheckCircle2} label="Số ngày báo cáo" value={summary.daily_summaries?.length || 0} sub="ca học ghi nhận" color="var(--accent-success)" />
              <StatCard icon={XCircle} label="Top vắng mặt" value={summary.top_absent_users?.length || 0} sub="người cần chú ý" color="var(--accent-danger)" />
            </div>
          )}

          {/* Department Comparison Matrix (For PO / Director / Admin) */}
          {!isPM && !isStaff && deptComparison?.departments && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BarChart2 size={18} color="var(--accent-secondary)" />
                    Bảng Phong Thần & So Sánh Chéo Phòng Ban (Department Comparison Matrix)
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                    Góc nhìn quản trị Lãnh đạo cấp cao (PO / Director) — Đánh giá tuân thủ KPI & Tải công việc
                  </p>
                </div>
                <span style={{ padding: '4px 10px', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-primary)', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>
                  Quyền hạn: PO / Director Global View
                </span>
              </div>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Bộ phận (Department)</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Tổng nhân sự</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Tỉ lệ Đúng giờ (%)</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Chỉ số Đi muộn (%)</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Task được giao</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Xử lý Task (%)</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Đánh giá KPI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptComparison.departments.map((d, idx) => {
                      const isExcellent = d.status_evaluation === 'EXCELLENT';
                      const isGood = d.status_evaluation === 'GOOD';
                      const badgeBg = isExcellent ? 'rgba(34, 197, 94, 0.15)' : isGood ? 'rgba(59, 130, 246, 0.15)' : 'rgba(234, 179, 8, 0.15)';
                      const badgeColor = isExcellent ? 'var(--accent-success)' : isGood ? '#60a5fa' : 'var(--accent-warning)';
                      const badgeText = isExcellent ? '🟢 Xuất sắc' : isGood ? '🟢 Tốt' : '🟡 Cần cải thiện';
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{d.department}</td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>{d.total_users}</td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 600, color: d.punctuality_rate >= 90 ? 'var(--accent-success)' : 'var(--text-primary)' }}>{d.punctuality_rate}%</td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center', color: d.tardiness_index > 15 ? 'var(--accent-warning)' : 'var(--text-muted)' }}>{d.tardiness_index}%</td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>{d.total_assigned_tasks}</td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 600 }}>{d.task_completion_rate}%</td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                            <span style={{ padding: '4px 12px', borderRadius: '20px', background: badgeBg, color: badgeColor, fontSize: '0.75rem', fontWeight: 600 }}>
                              {badgeText}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Trend Chart */}
          <SectionCard
            title="Xu hướng điểm danh"
            badge={trend && <DataSourceBadge source={trend.data_source} />}
            action={
              trend?.points?.length > 0 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {trend.points.length} điểm dữ liệu
                </span>
              )
            }
          >
            {loading.trend && !trend ? <Spinner /> : trendChartData.length === 0 ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Không có dữ liệu cho khoảng thời gian này
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trendChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradLate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '1rem' }} />
                  <Area type="monotone" dataKey="present" name="Có mặt" stroke="#06b6d4" fill="url(#gradPresent)" strokeWidth={2} dot={{ r: 3, fill: '#06b6d4' }} />
                  <Area type="monotone" dataKey="late" name="Muộn" stroke="#f59e0b" fill="url(#gradLate)" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </SectionCard>

          {/* Bottom row: Top absent + User lookup */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

            {/* Top Absent Users Chart */}
            <SectionCard title="Top vắng mặt nhiều nhất">
              {loading.summary && !summary ? <Spinner /> : topAbsentData.length === 0 ? (
                <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Không có dữ liệu
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topAbsentData} margin={{ top: 5, right: 10, left: -20, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
                    <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CustomTooltip />} formatter={(v) => [`${v}%`, 'Tỉ lệ']} />
                    <Bar dataKey="rate" name="Tỉ lệ điểm danh (%)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            {/* User Stats Lookup */}
            <SectionCard
              title="Tra cứu theo User"
              badge={userStats && <DataSourceBadge source={userStats.data_source} />}
            >
              <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
                <input
                  placeholder="Nhập User ID..."
                  value={userIdInput}
                  onChange={e => setUserIdInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadUserStats()}
                  style={{
                    flex: 1, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px', padding: '0.55rem 0.9rem', color: 'var(--text-primary)',
                    fontSize: '0.85rem', outline: 'none',
                  }}
                />
                <button
                  onClick={loadUserStats}
                  disabled={loading.user || !userIdInput.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.55rem 1rem', borderRadius: '8px',
                    background: 'rgba(6,182,212,0.15)', color: 'var(--accent-primary)',
                    border: '1px solid rgba(6,182,212,0.3)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                    opacity: (loading.user || !userIdInput.trim()) ? 0.5 : 1,
                  }}
                >
                  <Search size={14} />
                  Tìm
                </button>
              </div>

              {loading.user && <Spinner />}
              {errors.user && (
                <p style={{ color: 'var(--accent-danger)', fontSize: '0.82rem', padding: '0.5rem 0' }}>⚠️ {errors.user}</p>
              )}

              {userStats && !loading.user && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* User info */}
                  <div style={{ padding: '0.75rem 1rem', background: 'rgba(6,182,212,0.07)', borderRadius: '10px', border: '1px solid rgba(6,182,212,0.15)' }}>
                    <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{userStats.full_name}</p>
                    {userStats.department && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{userStats.department}</p>}
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.6rem', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--accent-success)' }}>✓ {userStats.present_count} Có mặt</span>
                      <span style={{ color: 'var(--accent-warning)' }}>⏰ {userStats.late_count} Muộn</span>
                      <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{userStats.attendance_rate}%</span>
                    </div>
                  </div>

                  {/* Mini chart */}
                  {userChartData.length > 0 && (
                    <ResponsiveContainer width="100%" height={100}>
                      <BarChart data={userChartData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="var(--text-muted)" />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="present" name="Có mặt" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="late" name="Muộn" fill="#f59e0b" stackId="a" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}

                  {/* Records table */}
                  <div style={{ maxHeight: '130px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                          {['Ngày', 'Ca', 'Trạng thái'].map(h => (
                            <th key={h} style={{ padding: '0.3rem 0.5rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {userStats.records.slice(0, 20).map((r, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '0.3rem 0.5rem' }}>{r.date}</td>
                            <td style={{ padding: '0.3rem 0.5rem', color: 'var(--text-muted)' }}>{r.session_type}</td>
                            <td style={{ padding: '0.3rem 0.5rem' }}>
                              <span style={{
                                padding: '0.1rem 0.45rem', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600,
                                background: r.status === 'PRESENT' ? 'rgba(16,185,129,0.15)' : r.status === 'LATE' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                color: r.status === 'PRESENT' ? 'var(--accent-success)' : r.status === 'LATE' ? 'var(--accent-warning)' : 'var(--accent-danger)',
                              }}>{r.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Analytics;
