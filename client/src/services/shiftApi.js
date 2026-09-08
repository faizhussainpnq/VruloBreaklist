import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://vrulobreaklist-1.onrender.com/'
});

export const apiStartShift = (employeeId) => API.post(`/shifts/start/${employeeId}`);
export const apiEndShift = (shiftId) => API.post(`/shifts/end/${shiftId}`);
export const apiStartBreak = (shiftId, type) => API.post(`/shifts/break/start/${shiftId}`, { type });
export const apiEndBreak = (shiftId) => API.post(`/shifts/break/end/${shiftId}`);