import React from 'react';
import { Users, Camera, ShieldAlert, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import Card from '../components/Card';

const Dashboard = () => {
  // Mock Data
  const stats = [
    { label: 'Total Present Today', value: '1,248', icon: Users, color: 'var(--accent-primary)' },
    { label: 'Cameras Active', value: '24/24', icon: Camera, color: 'var(--accent-success)' },
    { label: 'Security Alerts', value: '3', icon: ShieldAlert, color: 'var(--accent-danger)' },
    { label: 'Attendance Rate', value: '94.2%', icon: CheckCircle, color: 'var(--accent-secondary)' },
  ];

  const recentEvents = [
    { id: 1, type: 'ATTENDANCE', user: 'Nguyen Van A', room: 'A1-201', time: '08:15 AM', status: 'PRESENT' },
    { id: 2, type: 'ATTENDANCE', user: 'Tran Thi B', room: 'A1-201', time: '08:16 AM', status: 'LATE' },
    { id: 3, type: 'SECURITY', detail: 'Unknown face detected', room: 'Gate 3', time: '08:20 AM', level: 'HIGH' },
    { id: 4, type: 'ATTENDANCE', user: 'Le Van C', room: 'B2-104', time: '08:22 AM', status: 'PRESENT' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Campus Overview</h1>
        <p style={{ color: 'var(--text-muted)' }}>Real-time attendance and security monitoring.</p>
      </div>

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
                  <h2 style={{ fontSize: '2rem', color: 'var(--text-primary)' }}>{stat.value}</h2>
                </div>
                <div style={{ 
                  background: `${stat.color}15`, 
                  padding: '0.75rem', 
                  borderRadius: '12px',
                  color: stat.color
                }}>
                  <Icon size={24} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        {/* Main Chart Area (Placeholder) */}
        <Card title="Attendance Trend (This Week)">
          <div style={{ 
            height: '300px', 
            background: 'rgba(255,255,255,0.02)', 
            borderRadius: '8px', 
            border: '1px dashed var(--glass-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)'
          }}>
            [ Chart Visualization Placeholder ]
          </div>
        </Card>

        {/* Live Event Feed */}
        <Card title="Live Events">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recentEvents.map(evt => (
              <div key={evt.id} style={{ 
                display: 'flex', alignItems: 'flex-start', gap: '1rem',
                padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px'
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
