import React, { useState, useEffect } from 'react';

const EditEmployeeModal = ({ isOpen, onClose, employee, onSave }) => {
  const [formData, setFormData] = useState({ name: '', username: '', shiftTime: '' });

  useEffect(() => {
    if (employee) {
      setFormData({ name: employee.name, username: employee.username, shiftTime: employee.shiftTime });
    }
  }, [employee]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = () => {
    onSave({ ...employee, ...formData });
    onClose();
  };

  return (
    <div class="modal-overlay">
      <div class="modal-box">
        <h3>Edit Employee Details</h3>
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} />
        </div>
        <div class="form-group">
          <label>Username</label>
          <input type="text" name="username" value={formData.username} onChange={handleChange} />
        </div>
        <div class="form-group">
          <label>Shift Time</label>
          <input type="text" name="shiftTime" value={formData.shiftTime} onChange={handleChange} />
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" onClick={handleSubmit}>Save Changes</button>
          <button class="btn" style={{ background: 'var(--border-color)' }} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default EditEmployeeModal;