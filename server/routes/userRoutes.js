const express = require('express');
const router = express.Router();
const { 
  registerUser, 
  getAllUsers, 
  getUserById, 
  deleteUser, 
  updateUser, 
  loginUser 
} = require('../controllers/userController');

// Authentication Routes
router.post('/register', registerUser);
router.post('/login', loginUser); // Add this line

// CRUD Routes
router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.delete('/delete/:id', deleteUser);
router.put('/update/:id', updateUser);

module.exports = router;