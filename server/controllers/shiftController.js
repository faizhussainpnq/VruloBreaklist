const User = require('../models/user.js');

// Sab kuch IST (Asia/Kolkata) mein calculate karo taaki server ke timezone
// (cloud hosts UTC pe chalte hain) par depend na kare. UTC hone ki wajah se hi
// 10 AM IST ki jagah 4:30 AM store ho raha tha.
const TZ = 'Asia/Kolkata';

// en-CA -> "YYYY-MM-DD" format, IST calendar day ke hisaab se stable date key.
const d = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });

// IST time "10:05 AM" format mein.
const t = () =>
  new Date().toLocaleTimeString('en-US', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

exports.startShift = async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    let s = u.shifts.find(x => x.date === d());
    if (!s) {
      // Din ka pehla start -> naya object banao.
      u.shifts.push({ date: d(), shiftStart: t(), breaks: [] });
    } else {
      // Usi din dobara start (galti se jaldi end kar diya): naya object mat banao,
      // SAME object update karo. Original shiftStart rehne do, sirf shiftEnd clear
      // karke shift ko dobara open kar do.
      if (!s.shiftStart) s.shiftStart = t();
      s.shiftEnd = '';
    }
    await u.save();
    res.json({ success: true, data: u });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.endShift = async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    const s = u.shifts.find(x => x.date === d());
    s.shiftEnd = t();
    await u.save();
    res.json({ success: true, data: u });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.startBreak = async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    const s = u.shifts.find(x => x.date === d());
    s.breaks.push({ type: req.body.type, start: t(), end: '' });
    await u.save();
    res.json({ success: true, data: u });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

exports.endBreak = async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    const s = u.shifts.find(x => x.date === d());
    s.breaks.find(b => b.type === req.body.type && !b.end).end = t();
    await u.save();
    res.json({ success: true, data: u });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};