import React from 'react';
import { Users as UsersIcon, Plus, MoreVertical, ShieldCheck, ShieldAlert } from 'lucide-react';
import Card from '../components/Card';

const Users = () => {
  const usersList = [
    { id: 'usr_001', name: 'Nguyễn Văn A', email: 'nva@smartcampus.edu', role: 'STUDENT', status: 'ACTIVE', faceRegistered: true },
    { id: 'usr_002', name: 'Trần Thị B', email: 'ttb@smartcampus.edu', role: 'STUDENT', status: 'ACTIVE', faceRegistered: false },
    { id: 'usr_003', name: 'Lê Văn C', email: 'lvc@smartcampus.edu', role: 'STAFF', status: 'ACTIVE', faceRegistered: true },
    { id: 'usr_004', name: 'Phạm Thị D', email: 'ptd@smartcampus.edu', role: 'ADMIN', status: 'INACTIVE', faceRegistered: false },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <UsersIcon color="var(--accent-primary)" /> Users & Faces
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage system users and their biometric data.</p>
        </div>
        <button style={{
          background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '8px',
          padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
          fontWeight: 500
        }}>
          <Plus size={18} /> Add User
        </button>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--glass-border)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Name & Email</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Role</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Status</th>
              <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem' }}>Face Data</th>
              <th style={{ padding: '1rem', width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            {usersList.map((user, idx) => (
              <tr key={user.id} style={{ borderBottom: idx === usersList.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
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
                    background: user.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: user.status === 'ACTIVE' ? 'var(--accent-success)' : 'var(--accent-danger)',
                    padding: '0.25rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600
                  }}>
                    {user.status}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  {user.faceRegistered ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-success)', fontSize: '0.875rem' }}>
                      <ShieldCheck size={16} /> Registered
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      <ShieldAlert size={16} /> No Data
                    </div>
                  )}
                </td>
                <td style={{ padding: '1rem', textAlign: 'center' }}>
                  <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <MoreVertical size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

export default Users;
