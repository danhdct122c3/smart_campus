import React from 'react';

const Card = ({ children, className = '', title }) => {
  return (
    <div className={`glass-panel p-6 ${className}`} style={{ padding: '1.5rem' }}>
      {title && <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', color: 'var(--text-primary)' }}>{title}</h3>}
      {children}
    </div>
  );
};

export default Card;
