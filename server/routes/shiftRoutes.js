const express = require('express');
const router = express.Router();
const { startShift, endShift, startBreak, endBreak, updateBreak, deleteBreak } = require('../controllers/shiftController.js');

router.post('/start/:id', startShift);
router.post('/end/:id', endShift);
router.post('/break/start/:id', startBreak);
router.post('/break/end/:id', endBreak);
router.put('/break/:id/:breakId', updateBreak);
router.delete('/break/:id/:breakId', deleteBreak);

module.exports = router;