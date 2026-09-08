const User = require('../models/User');
const bcrypt = require('bcryptjs');

exports.registerUser = async (req, res) => {
  try {
    // 1. Role ko req.body se destructure karein (Default value 'employee' rakhi hai)
    const { name, employeeId, password, role = 'employee' } = req.body;

    if (!name || !employeeId || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, employeeId, and password are required' 
      });
    }

    const existingUser = await User.findOne({ employeeId });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Employee ID already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Pass 'role' inside User.create
    const newUser = await User.create({
      name,
      employeeId,
      password: hashedPassword,
      role // <-- Yahan role pass karna zaroori hai
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: newUser._id,
        name: newUser.name,
        employeeId: newUser.employeeId,
        role: newUser.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
};


exports.updateUser = async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(200).json({ success: true, data: updated });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
};


// Controller file ke bottom me add karein
exports.loginUser = async (req, res) => {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name/Employee ID and password are required' 
      });
    }

    const cleanLoginId = loginId.trim();

    // Case-insensitive matching for both Name and Employee ID
    const user = await User.findOne({
      $or: [
        { employeeId: { $regex: new RegExp(`^${cleanLoginId}$`, 'i') } },
        { name: { $regex: new RegExp(`^${cleanLoginId}$`, 'i') } }
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Invalid credentials' });
    }

    // Password check
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Role-based routing logic
    const redirectPath = user.role === 'admin' ? '/admin' : '/employee';

    res.status(200).json({
      success: true,
      message: 'Login successful',
      redirectTo: redirectPath,
      user: {
        id: user._id,
        name: user.name,
        employeeId: user.employeeId,
        role: user.role
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};