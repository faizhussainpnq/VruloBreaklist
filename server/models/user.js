const mongoose = require('mongoose');

const breakSchema = new mongoose.Schema({
  type: { type: String },
  start: { type: String },
  end: { type: String }
});

const shiftSchema = new mongoose.Schema({
  date: { type: String },
  shiftStart: { type: String },
  shiftEnd: { type: String },
  breaks: [breakSchema]
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  employeeId: { type: String, required: true, unique: true },
  email: { type: String, default: "" },
  phone: { type: String, default: "" },
  password: { type: String, required: true },
  role: { type: String, default: "employee" },
  shifts: [shiftSchema]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);