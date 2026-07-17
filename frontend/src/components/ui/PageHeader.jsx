import React from 'react';

const PageHeader = ({ title, description, actions, children }) => {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginBottom: '2rem' 
    }}>
      <div>
        <h1 style={{ 
          fontSize: '1.75rem', 
          fontWeight: 700, 
          color: 'var(--text-primary)', 
          marginBottom: '0.25rem' 
        }}>
          {title}
        </h1>
        {description && (
          <p style={{ color: 'var(--text-muted)' }}>{description}</p>
        )}
      </div>
      {(actions || children) && (
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {actions}
          {children}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
