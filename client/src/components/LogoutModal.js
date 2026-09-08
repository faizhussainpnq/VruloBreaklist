import React from 'react';

const LogoutModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>Are you sure you want to logout?</h3>
        <div class="modal-actions">
          <button class="btn btn-primary" onClick={onConfirm}>Yes, Logout</button>
          <button class="btn" style={{ background: 'var(--border-color)' }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default LogoutModal;