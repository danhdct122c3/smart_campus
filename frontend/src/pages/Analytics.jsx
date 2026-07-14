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

async function fetchReportSummary(start, end) {
  const params = new URLSearchParams({ period_start: start, period_end: end });
  const res = await fetch(`${API_BASE}/reports/summary?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.data;
}

async function fetchTrend(start, end) {
  const params = new URLSearchParams({ period_start: start, period_end: end });
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

// ── Sub-components ────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <div style={{
    background: 'rgba(30,41,59,0.7)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    cursor: 'default',
  }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 32px ${color}20`; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</h2>
        {sub && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>{sub}</p>}
      </div>
      <div style={{ background: `${color}18`, padding: '0.75rem', borderRadius: '12px', color }}>
        <Icon size={22} />
      </div>
    </div>
  </div>
);

const DataSourceBadge = ({ source }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
    fontSize: '0.7rem', fontWeight: 600,
    padding: '0.25rem 0.6rem', borderRadius: '999px',
    background: source === 'athena' ? 'rgba(139,92,246,0.15)' : 'rgba(6,182,212,0.15)',
    color: source === 'athena' ? 'var(--accent-secondary)' : 'var(--accent-primary)',
    border: `1px solid ${source === 'athena' ? 'rgba(139,92,246,0.3)' : 'rgba(6,182,212,0.3)'}`,
  }}>
    {source === 'athena' ? <Zap size={10} /> : <Database size={10} />}
    {source === 'athena' ? 'Amazon Athena' : 'DynamoDB'}
  </span>
);

const SectionCard = ({ title, children, badge, action }) => (
  <div style={{
    background: 'rgba(30,41,59,0.7)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '1.5rem',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
        {badge}
      </div>
      {action}
    </div>
    {children}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.8rem',
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '0.15rem 0' }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      border: '3px solid rgba(6,182,212,0.2)',
      borderTopColor: 'var(--accent-primary)',
      animation: 'spin 0.8s linear infinite',
    }} />
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

const Analytics = () => {
  const defaults = getDefaultDates(14);
  const [dateRange, setDateRange] = useState(defaults);
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [userIdInput, setUserIdInput] = useState('');
  const [loading, setLoading] = useState({ summary: false, trend: false, user: false });
  const [errors, setErrors] = useState({ summary: null, trend: null, user: null });

  const loadSummaryAndTrend = useCallback(async () => {
    setLoading(l => ({ ...l, summary: true, trend: true }));
    setErrors(e => ({ ...e, summary: null, trend: null }));
    try {
      const [s, t] = await Promise.all([
        fetchReportSummary(dateRange.start, dateRange.end),
        fetchTrend(dateRange.start, dateRange.end),
      ]);
      setSummary(s);
      setTrend(t);
    } catch (err) {
      setErrors(e => ({ ...e, summary: err.message, trend: err.message }));
    } finally {
      setLoading(l => ({ ...l, summary: false, trend: false }));
    }
  }, [dateRange]);

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
            Analytics & Reports
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>WF5 — Thống kê điểm danh từ DynamoDB / Amazon Athena</p>
        </div>

        {/* Date Range Picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
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
            disabled={loading.summary || loading.trend}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.55rem 1rem', borderRadius: '10px',
              background: 'var(--accent-primary)', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
              opacity: (loading.summary || loading.trend) ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} style={{ animation: (loading.summary || loading.trend) ? 'spin 0.8s linear infinite' : 'none' }} />
            Tải lại
          </button>
        </div>
      </div>

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
          <StatCard icon={Users} label="Tổng người dùng" value={summary.total_users} sub="trong hệ thống" color="var(--accent-secondary)" />
          <StatCard icon={CheckCircle2} label="Số ngày báo cáo" value={summary.daily_summaries?.length || 0} sub="ca học ghi nhận" color="var(--accent-success)" />
          <StatCard icon={XCircle} label="Top vắng mặt" value={summary.top_absent_users?.length || 0} sub="người cần chú ý" color="var(--accent-danger)" />
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

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Analytics;
