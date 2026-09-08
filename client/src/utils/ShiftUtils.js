// src/utils/shiftUtils.js
//
// Central place for shift/break/violation logic so the dashboard and the
// two modals all agree on the same rules.
//
// ⚠️ ADJUST THESE to match your actual company policy — they are the only
// "guessed" values in this file. Everything else is pure calculation.
export const EXPECTED_SHIFT_START = "10:00 AM";
export const EXPECTED_SHIFT_END = "7:00 PM";
export const LATE_GRACE_MINUTES = 5;        // minutes allowed before "late" counts
export const EARLY_LEAVE_GRACE_MINUTES = 0; // minutes allowed before "left early" counts
export const ALLOWED_BREAK_MINUTES = 30;     // max break length before it's a violation

// ---- time helpers ----

export const parseTimeToMinutes = (time) => {
  if (!time) return null;
  const match = String(time).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();

  if (hour === 12) hour = 0;
  if (period === "PM") hour += 12;

  return hour * 60 + minute;
};

// Turns a raw minute count into "Xh Ym" (or just "Ym" under an hour) so
// violation messages never show something like "363 min late".
export const formatMinutes = (totalMinutes) => {
  const mins = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const durationLabel = (startMinutes, endMinutes) => {
  if (startMinutes === null || endMinutes === null) return "";
  let diff = endMinutes - startMinutes;
  if (diff < 0) diff += 24 * 60;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
};

export const calculateWorkHours = (start, end) => {
  const s = parseTimeToMinutes(start);
  const e = parseTimeToMinutes(end);
  return durationLabel(s, e);
};

export const todayDateString = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ---- break status ----
// Expects each shift entry to optionally carry a `breaks` array:
//   shift.breaks = [{ start: "1:00 PM", end: "1:30 PM" }, { start: "4:00 PM" }]
// A break with a `start` but no `end` is the "currently active" break.
// If your backend stores breaks differently (e.g. single breakStart/breakEnd
// fields), just adapt getActiveBreak() below — everything else stays the same.

export const getActiveBreak = (shift) => {
  const breaks = Array.isArray(shift?.breaks) ? shift.breaks : [];
  return breaks.find((b) => b?.start && !b?.end) || null;
};

// Formats a signed second count as "MM:SS" for a live-ticking countdown.
export const formatCountdown = (totalSeconds) => {
  const abs = Math.abs(Math.round(totalSeconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// Returns { onBreak, breakStart, elapsedSeconds, remainingSeconds,
//           elapsedMinutes, remainingMinutes, isOvertime }
// Second-level precision so the UI can tick a real countdown every second;
// the *Minutes fields are kept for anything that only needs whole minutes.
export const getBreakStatus = (shift, now = new Date()) => {
  const activeBreak = getActiveBreak(shift);
  if (!activeBreak) return { onBreak: false };

  const startMinutes = parseTimeToMinutes(activeBreak.start);
  if (startMinutes === null) return { onBreak: false };

  const startTotalSeconds = startMinutes * 60;
  const nowTotalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  let elapsedSeconds = nowTotalSeconds - startTotalSeconds;
  if (elapsedSeconds < 0) elapsedSeconds += 24 * 3600;

  const remainingSeconds = ALLOWED_BREAK_MINUTES * 60 - elapsedSeconds;

  return {
    onBreak: true,
    breakStart: activeBreak.start,
    elapsedSeconds,
    remainingSeconds,
    elapsedMinutes: Math.floor(elapsedSeconds / 60),
    remainingMinutes: Math.ceil(remainingSeconds / 60),
    isOvertime: remainingSeconds < 0
  };
};

// ---- violation detection ----
// Returns an array of { type, detail } for a single day's shift record.

export const computeShiftViolations = (shift, now = new Date()) => {
  const violations = [];
  if (!shift) return violations;

  const expectedStart = parseTimeToMinutes(EXPECTED_SHIFT_START);
  const expectedEnd = parseTimeToMinutes(EXPECTED_SHIFT_END);
  const actualStart = parseTimeToMinutes(shift.shiftStart);
  const actualEnd = parseTimeToMinutes(shift.shiftEnd);

  if (actualStart !== null && expectedStart !== null) {
    const lateBy = actualStart - expectedStart;
    if (lateBy > LATE_GRACE_MINUTES) {
      violations.push({
        type: "Late Arrival",
        detail: `Checked in ${formatMinutes(lateBy)} late (expected ${EXPECTED_SHIFT_START})`
      });
    }
  }

  if (actualEnd !== null && expectedEnd !== null) {
    const earlyBy = expectedEnd - actualEnd;
    if (earlyBy > EARLY_LEAVE_GRACE_MINUTES) {
      violations.push({
        type: "Left Early",
        detail: `Left ${formatMinutes(earlyBy)} early (expected ${EXPECTED_SHIFT_END})`
      });
    }
  }

  const breaks = Array.isArray(shift.breaks) ? shift.breaks : [];
  breaks.forEach((b, idx) => {
    if (b?.start && b?.end) {
      const s = parseTimeToMinutes(b.start);
      const e = parseTimeToMinutes(b.end);
      if (s !== null && e !== null) {
        let dur = e - s;
        if (dur < 0) dur += 24 * 60;
        if (dur > ALLOWED_BREAK_MINUTES) {
          violations.push({
            type: "Break Overrun",
            detail: `Break #${idx + 1} lasted ${formatMinutes(dur)} (limit ${formatMinutes(ALLOWED_BREAK_MINUTES)})`
          });
        }
      }
    }
  });

  const liveBreak = getBreakStatus(shift, now);
  if (liveBreak.onBreak && liveBreak.isOvertime) {
    violations.push({
      type: "Break Overrun",
      detail: `Still on break, ${formatMinutes(Math.abs(liveBreak.remainingMinutes))} over the ${formatMinutes(ALLOWED_BREAK_MINUTES)} limit`
    });
  }

  return violations;
};

// Finds a specific date's shift entry inside a user's `shifts` array.
export const findShiftByDate = (shifts, dateStr) =>
  (Array.isArray(shifts) ? shifts : []).find((s) => s.date === dateStr) || null;

// Builds one row per calendar day for a given "YYYY-MM" month, up to today
// if the month is the current one, otherwise the full month.
export const buildMonthHistory = (shifts, monthStr) => {
  const [year, month] = monthStr.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const now = new Date();
  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() + 1 === month;
  const lastDay = isCurrentMonth ? now.getDate() : daysInMonth;

  const rows = [];
  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const shift = findShiftByDate(shifts, dateStr);
    const violations = computeShiftViolations(shift, now);

    rows.push({
      date: dateStr,
      status: shift?.shiftStart ? "Present" : "Absent",
      shiftStart: shift?.shiftStart || "",
      shiftEnd: shift?.shiftEnd || "",
      workHours: shift?.shiftEnd ? calculateWorkHours(shift.shiftStart, shift.shiftEnd) : "",
      violations
    });
  }

  return rows.reverse(); // most recent day first
};
