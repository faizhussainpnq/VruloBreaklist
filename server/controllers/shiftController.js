const User = require('../models/user.js');

const TZ = 'Asia/Kolkata';

// en-CA -> "YYYY-MM-DD" format, IST calendar day ke hisaab se stable date key.
const d = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });

// IST time "10:05 AM" format mein.
const t = () =>
  new Date().toLocaleTimeString('en-US', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
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

exports.updateBreak = async (req, res) => {
  const u = await User.findById(req.params.id);
  const s = u.shifts.id(req.body.shiftId);
  const b = s.breaks.id(req.params.breakId);
  if(req.body.start) b.start = req.body.start;
  if(req.body.end !== undefined) b.end = req.body.end;
  await u.save();
  res.json({ success: true, data: u });
};


// shiftController.js mein ye add karein:
exports.deleteBreak = async (req, res) => {
  const u = await User.findById(req.params.id);
  const s = u.shifts.id(req.body.shiftId);
  s.breaks.pull(req.params.breakId);
  await u.save();
  res.json({ success: true, data: u });
};

