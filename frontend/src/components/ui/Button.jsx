import React from 'react';

const Button = ({ 
  children, 
  variant = 'primary', 
  className = '', 
  icon: Icon,
  disabled = false,
  ...props 
}) => {
  return (
    <button 
      className={`btn btn-${variant} ${className}`} 
      disabled={disabled}
      {...props}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

export default Button;
