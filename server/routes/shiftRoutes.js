const express = require('express');
const router = express.Router();
const { startShift, endShift, startBreak, endBreak } = require('../controllers/shiftController');

router.post('/start/:id', startShift);
router.post('/end/:id', endShift);
router.post('/break/start/:id', startBreak);
router.post('/break/end/:id', endBreak);

module.exports = router;