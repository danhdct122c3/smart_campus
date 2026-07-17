import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Camera, ShieldAlert, CheckCircle, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import Card from '../components/Card';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function formatDate(d) {
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 7);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.6rem 0.9rem', fontSize: '0.8rem' }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { start, end } = getDefaultDates();
    Promise.all([
      fetch(`${API_BASE}/reports/summary?period_start=${start}&period_end=${end}`).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/reports/trend?period_start=${start}&period_end=${end}`).then(r => r.ok ? r.json() : null),
    ]).then(([s, t]) => {
      if (s?.data) setSummary(s.data);
      if (t?.data) setTrend(t.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Aggregate trend chart data by date
  const trendChartData = (() => {
    if (!trend?.points?.length) return [];
    const byDate = {};
    trend.points.forEach(p => {
      if (!byDate[p.date]) byDate[p.date] = { date: formatDate(p.date), present: 0, late: 0 };
      byDate[p.date].present += p.present;
      byDate[p.date].late += p.late;
    });
    return Object.values(byDate);
  })();

  const stats = [
    {
      label: 'Attendance Rate',
      value: summary ? `${summary.overall_attendance_rate}%` : '—',
      icon: CheckCircle,
      color: 'var(--accent-success)',
    },
    {
      label: 'Total Users',
      value: summary ? summary.total_users : '—',
      icon: Users,
      color: 'var(--accent-primary)',
    },
    {
      label: 'Cameras Active',
      value: '24/24',
      icon: Camera,
      color: 'var(--accent-secondary)',
    },
    {
      label: 'Security Alerts',
      value: '3',
      icon: ShieldAlert,
      color: 'var(--accent-danger)',
    },
  ];

  const recentEvents = [
    { id: 1, type: 'ATTENDANCE', user: 'Nguyen Van A', room: 'A1-201', time: '08:15', status: 'PRESENT' },
    { id: 2, type: 'ATTENDANCE', user: 'Tran Thi B', room: 'A1-201', time: '08:16', status: 'LATE' },
    { id: 3, type: 'SECURITY', detail: 'Unknown face detected', room: 'Gate 3', time: '08:20', level: 'HIGH' },
    { id: 4, type: 'ATTENDANCE', user: 'Le Van C', room: 'B2-104', time: '08:22', status: 'PRESENT' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <PageHeader 
        title="Campus Overview" 
        description="Real-time attendance and security monitoring."
      />

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                    {stat.label}
                  </p>
                  <h2 style={{ fontSize: '2rem', color: 'var(--text-primary)' }}>
                    {loading && idx < 2 ? '...' : stat.value}
                  </h2>
                </div>
                <div style={{
                  background: `${stat.color}15`,
                  padding: '0.75rem',
                  borderRadius: '12px',
                  color: stat.color,
                }}>
                  <Icon size={24} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Trend Chart — real data */}
        <Card title="Attendance Trend (This Week)">
          {loading ? (
            <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Loading...
            </div>
          ) : trendChartData.length === 0 ? (
            <div style={{
              height: 280, background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
              border: '1px dashed var(--glass-border)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'var(--text-muted)',
            }}>
              No data for this period
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <TrendingUp size={14} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Live from {trend?.data_source === 'athena' ? 'Amazon Athena' : 'DynamoDB'}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={trendChartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gLate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--text-muted)" tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="present" name="Present" stroke="#06b6d4" fill="url(#gPresent)" strokeWidth={2} dot={{ r: 3, fill: '#06b6d4' }} />
                  <Area type="monotone" dataKey="late" name="Late" stroke="#f59e0b" fill="url(#gLate)" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Live Event Feed */}
        <Card title="Live Events">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recentEvents.map(evt => (
              <div key={evt.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '1rem',
                padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px',
              }}>
                <div style={{ marginTop: '2px' }}>
                  {evt.type === 'ATTENDANCE'
                    ? <CheckCircle size={18} color={evt.status === 'PRESENT' ? 'var(--accent-success)' : 'var(--accent-warning)'} />
                    : <AlertTriangle size={18} color="var(--accent-danger)" />
                  }
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', fontWeight: 500, margin: '0 0 0.25rem 0' }}>
                    {evt.type === 'ATTENDANCE' ? evt.user : evt.detail}
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={12} /> {evt.time}
                    </span>
                    <span>📍 {evt.room}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
