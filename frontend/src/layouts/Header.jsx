import React from 'react';
import { Search, Bell, User } from 'lucide-react';

const Header = () => {
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
      zIndex: 5
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
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative' }}>
          <Bell size={20} color="var(--text-secondary)" />
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: 'var(--accent-danger)', width: '8px', height: '8px', borderRadius: '50%'
          }}></span>
        </button>
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
    </header>
  );
};

export default Header;
