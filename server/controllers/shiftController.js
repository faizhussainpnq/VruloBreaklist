const User = require('../models/User');
const d = () => new Date().toISOString().split('T')[0];
const t = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

exports.startShift = async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    let s = u.shifts.find(x => x.date === d());
    if (!s) u.shifts.push({ date: d(), shiftStart: t(), breaks: [] }); else s.shiftStart = t();
    await u.save(); res.json({ success: true, data: u });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.endShift = async (req, res) => {
  try {
    const u = await User.findById(req.params.id), s = u.shifts.find(x => x.date === d());
    s.shiftEnd = t(); await u.save(); res.json({ success: true, data: u });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.startBreak = async (req, res) => {
  try {
    const u = await User.findById(req.params.id), s = u.shifts.find(x => x.date === d());
    s.breaks.push({ type: req.body.type, start: t(), end: '' }); await u.save(); res.json({ success: true, data: u });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.endBreak = async (req, res) => {
  try {
    const u = await User.findById(req.params.id), s = u.shifts.find(x => x.date === d());
    s.breaks.find(b => b.type === req.body.type && !b.end).end = t(); await u.save(); res.json({ success: true, data: u });
  } catch (e) { res.status(500).json({ error: e.message }); }
};