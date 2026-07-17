import React from 'react';

const Input = ({ 
  icon: Icon, 
  className = '', 
  wrapperClassName = '',
  ...props 
}) => {
  return (
    <div className={`input-wrapper ${wrapperClassName}`}>
      {Icon && <Icon size={18} className="input-icon" />}
      <input 
        className={`input-field ${Icon ? 'input-with-icon' : ''} ${className}`} 
        {...props} 
      />
    </div>
  );
};

export default Input;
