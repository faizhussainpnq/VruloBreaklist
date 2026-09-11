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

// Breaks are NOT all the same length. break1 / break2 are 15-min short
// breaks, lunch is 30 min.
export const BREAK_DURATIONS = {
  break1: 15,
  lunch: 30,
  break2: 15,
};

// Fallback for any break with an unrecognized/missing `type` (defensive
// only — with normal usage every break has a valid type).
const DEFAULT_BREAK_MINUTES = 15;

// Looks up the allowed duration (in minutes) for a given break object.
export const getAllowedBreakMinutes = (brk) =>
  BREAK_DURATIONS[brk?.type] ?? DEFAULT_BREAK_MINUTES;

// EmployeeDashboard.jsx refuses to let a break run into the shift's
// last hour — if a break is started close enough to shift-end that its
// full duration would spill past (shiftEnd - 1 hour), the employee side
// caps that break's duration to whatever time is left before that cutoff
// (see `lastHourCutoff` / `secsUntilCutoff` in startBreak() there).
// getEffectiveAllowedMinutes() reproduces that exact same cutoff so both
// screens always agree.
export const getEffectiveAllowedMinutes = (brk, shiftEndTime = EXPECTED_SHIFT_END) => {
  const base = getAllowedBreakMinutes(brk);

  const startMinutes = parseTimeToMinutes(brk?.start);
  const shiftEndMinutes = parseTimeToMinutes(shiftEndTime);
  if (startMinutes === null || shiftEndMinutes === null) return base;

  // Same rule as EmployeeDashboard: no break may run past (shift end - 1hr).
  const cutoffMinutes = shiftEndMinutes - 60;
  const minutesUntilCutoff = cutoffMinutes - startMinutes;

  // Only cap when the break actually starts before the cutoff but wouldn't
  // finish before it — mirrors the `>= 0 && < fullDuration` check used on
  // the employee side exactly.
  if (minutesUntilCutoff >= 0 && minutesUntilCutoff < base) {
    return minutesUntilCutoff;
  }
  return base;
};

// Kept for backward compatibility with any other code that imports this
// constant directly. Do NOT use this for per-break calculations anymore —
// use getAllowedBreakMinutes(brk) instead, since breaks have different
// allowed lengths depending on their `type`.
export const ALLOWED_BREAK_MINUTES = 30;

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

// FIX: seconds-precision parser. Handles BOTH "hh:mm AM/PM" (old records,
// no seconds — treated as :00) AND "hh:mm:ss AM/PM" (new records, once the
// backend starts saving seconds). This is what makes the admin panel's
// live countdown match the employee's live countdown to the second instead
// of being off by up to 59 seconds.
export const parseTimeToSeconds = (time) => {
  if (!time) return null;
  const match = String(time)
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] ? Number(match[3]) : 0;
  const period = match[4].toUpperCase();

  if (hour === 12) hour = 0;
  if (period === "PM") hour += 12;

  return hour * 3600 + minute * 60 + second;
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
//   shift.breaks = [{ type: "break1", start: "1:00 PM", end: "1:30 PM" }, { type: "lunch", start: "4:00 PM" }]
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

// Returns { onBreak, breakStart, breakType, allowedMinutes, elapsedSeconds,
//           remainingSeconds, elapsedMinutes, remainingMinutes, isOvertime }
// Second-level precision so the UI can tick a real countdown every second;
// the *Minutes fields are kept for anything that only needs whole minutes.
//
// FIX: uses parseTimeToSeconds (not parseTimeToMinutes) for the break's
// start time, so the admin panel's countdown lines up second-for-second
// with the employee dashboard's own live countdown instead of being off
// by up to 59 seconds (the gap that used to make "15 min" look like "14 min").
export const getBreakStatus = (shift, now = new Date()) => {
  const activeBreak = getActiveBreak(shift);
  if (!activeBreak) return { onBreak: false };

  const startTotalSeconds = parseTimeToSeconds(activeBreak.start);
  if (startTotalSeconds === null) return { onBreak: false };

  // Cutoff-aware duration (getEffectiveAllowedMinutes) — otherwise a break
  // started near shift-end shows a longer countdown here than it actually
  // gets on the employee screen.
  const allowedMinutes = getEffectiveAllowedMinutes(activeBreak);

  const nowTotalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  let elapsedSeconds = nowTotalSeconds - startTotalSeconds;
  if (elapsedSeconds < 0) elapsedSeconds += 24 * 3600;

  const remainingSeconds = allowedMinutes * 60 - elapsedSeconds;

  return {
    onBreak: true,
    breakStart: activeBreak.start,
    breakType: activeBreak.type,
    allowedMinutes,
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
      // Same cutoff-aware duration as the live countdown, so a break taken
      // right before shift-end is judged against the shorter capped limit
      // it actually had, not the full 15/30 min.
      const allowedMinutes = getEffectiveAllowedMinutes(b);
      if (s !== null && e !== null) {
        let dur = e - s;
        if (dur < 0) dur += 24 * 60;
        // Compare against THIS break's own allowed duration, not a flat
        // 30 min for every break.
        if (dur > allowedMinutes) {
          violations.push({
            type: "Break Overrun",
            detail: `Break #${idx + 1} lasted ${formatMinutes(dur)} (limit ${formatMinutes(allowedMinutes)})`
          });
        }
      }
    }
  });

  const liveBreak = getBreakStatus(shift, now);
  if (liveBreak.onBreak && liveBreak.isOvertime) {
    violations.push({
      type: "Break Overrun",
      detail: `Still on break, ${formatMinutes(Math.abs(liveBreak.remainingMinutes))} over the ${formatMinutes(liveBreak.allowedMinutes)} limit`
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