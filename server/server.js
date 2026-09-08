const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const shiftRoutes = require('./routes/shiftRoutes');

// 1. Environment variables load karein (Sabse upar hona chahiye)
dotenv.config();

// 2. Database connect karein
connectDB();

const app = express();

// 3. Middlewares
app.use(cors());
app.use(express.json());

// User Routes add kiya gaya hai
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);
app.use('/api/shifts', shiftRoutes);

// 4. Test Route
app.get('/', (req, res) => {
  res.send('API is running successfully...');
});

// 5. Server Listen
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});