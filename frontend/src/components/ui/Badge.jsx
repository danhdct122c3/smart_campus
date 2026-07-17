import React from 'react';

const Badge = ({ 
  children, 
  variant = 'info', 
  className = '',
  icon: Icon
}) => {
  // Map variant to color variables
  const colorMap = {
    success: 'var(--accent-success)',
    warning: 'var(--accent-warning)',
    danger: 'var(--accent-danger)',
    info: 'var(--accent-primary)',
    default: 'var(--text-muted)'
  };
  
  const color = colorMap[variant] || colorMap.default;

  return (
    <span 
      className={`badge ${className}`} 
      style={{
        background: `${color}22`, 
        color: color, 
        border: `1px solid ${color}55`
      }}
    >
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
};

export default Badge;
