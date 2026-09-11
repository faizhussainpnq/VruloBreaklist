import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FaPlay, 
  FaCoffee, 
  FaStop, 
  FaClock, 
  FaExclamationCircle, 
  FaUtensils, 
  FaHistory,
  FaCheckCircle,
  FaTimesCircle,
  FaBell,
  FaTimes
} from "react-icons/fa";
import StarBackground from "../components/StarBackground";
import Navbar from "../components/Navbar";

const API_URL = import.meta.env.VITE_API_URL || "https://vrulobreaklist-1.onrender.com/";

const BREAK_LABELS = {
  break1: "Short Break 1",
  lunch: "Lunch Break",
  break2: "Short Break 2",
};

const BREAK_ALLOWED_MINS = {
  break1: 15,
  lunch: 30,
  break2: 15,
};

// Official shift window — used by both the live dashboard AND the history
// modal so punctuality rules stay consistent everywhere.
const OFFICIAL_SHIFT_START_HOUR = 10; // 10:00 AM
const OFFICIAL_SHIFT_END_HOUR = 19;   // 07:00 PM

// ---- shared helpers ----
// FIX: now also reads an optional seconds group ("hh:mm:ss AM/PM"). Old
// records without seconds ("hh:mm AM/PM") still work exactly as before
// (seconds default to 0).
function parseTimeStringToDate(timeStr, baseDate) {
  if (!timeStr) return null;
  const [time, modifier] = timeStr.split(" ");
  const parts = time.split(":").map(Number);
  let hours = parts[0];
  const minutes = parts[1] || 0;
  const seconds = parts[2] || 0;
  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;
  const d = baseDate ? new Date(baseDate) : new Date();
  d.setHours(hours, minutes, seconds, 0);
  return d;
}

function formatClock(date) {
  if (!date) return "--";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatMinsDiff(totalMinutes) {
  if (totalMinutes < 60) {
    return `${totalMinutes} min${totalMinutes > 1 ? 's' : ''}`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) {
    return `${hours} hr${hours > 1 ? 's' : ''}`;
  }
  return `${hours} hr${hours > 1 ? 's' : ''} ${mins} min${mins > 1 ? 's' : ''}`;
}

// Used only inside the history modal to flag a late start / early end for a
// PAST day's record (separate from the live dashboard's own punctuality
// calculators, which still work exactly as before).
function getShiftStartViolation(startDate) {
  if (!startDate) return null;
  const scheduledStart = new Date(startDate);
  scheduledStart.setHours(OFFICIAL_SHIFT_START_HOUR, 0, 0, 0);
  const diffInMins = Math.round((startDate.getTime() - scheduledStart.getTime()) / (1000 * 60));
  if (diffInMins > 0) {
    return { isViolation: true, text: `Started Late by ${formatMinsDiff(diffInMins)}` };
  }
  return { isViolation: false, text: null };
}

function getShiftEndViolation(endDate) {
  if (!endDate) return null;
  const scheduledEnd = new Date(endDate);
  scheduledEnd.setHours(OFFICIAL_SHIFT_END_HOUR, 0, 0, 0);
  const diffInMins = Math.round((scheduledEnd.getTime() - endDate.getTime()) / (1000 * 60));
  if (diffInMins > 0) {
    return { isViolation: true, text: `Ended Early by ${formatMinsDiff(diffInMins)}` };
  }
  return { isViolation: false, text: null };
}

// ---- History Modal, defined right here in the same file (no separate import) ----
function HistoryModal({ isOpen, onClose, userId, darkMode }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState([]);
  const [selectedDate, setSelectedDate] = useState(""); // yyyy-mm-dd, "" = show all

  useEffect(() => {
    if (!isOpen || !userId) return;
    let cancelled = false;

    // Reset the date filter every time the modal is (re)opened
    setSelectedDate("");

    const loadHistory = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_URL}api/users/${userId}`);
        const json = await res.json();
        const user = json?.data || json;
        const shifts = Array.isArray(user?.shifts) ? user.shifts : [];

        const rows = shifts
          .slice()
          .sort((a, b) => (a.date < b.date ? 1 : -1)) // newest first
          .map((shift) => {
            const dayBase = new Date(shift.date);
            const startDate = shift.shiftStart ? parseTimeStringToDate(shift.shiftStart, dayBase) : null;
            const endDate = shift.shiftEnd ? parseTimeStringToDate(shift.shiftEnd, dayBase) : null;

            const breakRows = (shift.breaks || []).map((b) => {
              const bStart = parseTimeStringToDate(b.start, dayBase);
              const bEnd = b.end ? parseTimeStringToDate(b.end, dayBase) : null;
              const allowed = BREAK_ALLOWED_MINS[b.type] ?? 15;
              const actualMins = bStart && bEnd ? Math.round((bEnd.getTime() - bStart.getTime()) / 60000) : null;
              const isOvertime = actualMins !== null && actualMins > allowed;
              return {
                type: b.type,
                label: BREAK_LABELS[b.type] || b.type,
                start: bStart,
                end: bEnd,
                actualMins,
                allowed,
                isOvertime,
              };
            });

            // Late-start / early-end checks for this day
            const startViolation = getShiftStartViolation(startDate);
            const endViolation = getShiftEndViolation(endDate);

            const hasBreakViolation = breakRows.some((b) => b.isOvertime);
            const hasShiftTimingViolation = Boolean(startViolation?.isViolation) || Boolean(endViolation?.isViolation);
            const hasViolation = hasBreakViolation || hasShiftTimingViolation;

            return {
              date: shift.date,
              startDate,
              endDate,
              breakRows,
              breaksUsed: breakRows.length,
              startViolation,
              endViolation,
              hasViolation,
            };
          });

        if (!cancelled) setDays(rows);
      } catch (e) {
        console.error("Failed to load history:", e);
        if (!cancelled) setError("Couldn't load your history right now. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadHistory();
    return () => { cancelled = true; };
  }, [isOpen, userId]);

  if (!isOpen) return null;

  // If a specific date is picked, show only that day's record; otherwise show everything.
  const filteredDays = selectedDate ? days.filter((d) => d.date === selectedDate) : days;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-4xl h-[85vh] overflow-hidden rounded-3xl border shadow-2xl flex flex-col ${
            darkMode ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
          }`}
        >
          <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${darkMode ? "border-slate-800" : "border-slate-200"}`}>
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <FaClock className={darkMode ? "text-amber-400" : "text-amber-600"} /> Shift & Break History
            </h2>
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors ${darkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}
            >
              <FaTimes />
            </button>
          </div>

          {/* Date filter bar */}
          <div className={`flex flex-wrap items-center gap-3 px-6 py-3 border-b shrink-0 ${darkMode ? "border-slate-800" : "border-slate-200"}`}>
            <label className="text-xs font-semibold opacity-70">Select Date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={`text-xs font-mono px-3 py-1.5 rounded-lg border outline-none ${
                darkMode ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
              }`}
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate("")}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                  darkMode ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-600 hover:bg-slate-100"
                }`}
              >
                Clear
              </button>
            )}
          </div>

          {/* Scrollable list — flex-1 + min-h-0 is what makes this scroll inside the modal
              instead of the whole modal growing to fit every day in history. */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
            {loading && <p className="text-sm opacity-70">Loading history...</p>}
            {error && <p className="text-sm text-rose-500">{error}</p>}
            {!loading && !error && filteredDays.length === 0 && (
              <p className="text-sm opacity-70">
                {selectedDate ? "No shift record found for this date." : "No shift history found yet."}
              </p>
            )}

            {!loading && filteredDays.map((day) => (
              <div
                key={day.date}
                className={`border rounded-2xl p-4 ${
                  day.hasViolation
                    ? (darkMode ? "bg-rose-500/10 border-rose-500/40" : "bg-rose-50/80 border-rose-300")
                    : (darkMode ? "bg-emerald-500/10 border-emerald-500/30" : "bg-emerald-50/80 border-emerald-300")
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold">
                    {day.hasViolation ? (
                      <FaExclamationCircle className="text-rose-500" />
                    ) : (
                      <FaCheckCircle className="text-emerald-500" />
                    )}
                    {new Date(day.date).toLocaleDateString([], { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    day.hasViolation
                      ? (darkMode ? "bg-rose-500/20 text-rose-400" : "bg-rose-100 text-rose-700")
                      : (darkMode ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700")
                  }`}>
                    {day.hasViolation ? "Rule Broken" : "Present"}
                  </span>
                </div>

                <div className="mt-3 grid sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-[11px] uppercase font-semibold opacity-60">Shift Start</p>
                    <p className="font-mono font-bold">{formatClock(day.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase font-semibold opacity-60">Shift End</p>
                    <p className="font-mono font-bold">{formatClock(day.endDate)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase font-semibold opacity-60">Breaks Taken</p>
                    <p className="font-mono font-bold">{day.breaksUsed} / 3</p>
                  </div>
                </div>

                {(day.startViolation?.isViolation || day.endViolation?.isViolation) && (
                  <div className={`mt-3 space-y-1.5 text-xs rounded-xl px-3 py-2 border ${
                    darkMode ? "bg-rose-600/20 border-rose-500/50 text-rose-300" : "bg-rose-100 border-rose-300 text-rose-700"
                  }`}>
                    {day.startViolation?.isViolation && (
                      <p className="flex items-center gap-1.5 font-bold">
                        <FaExclamationCircle /> Rule Broken — {day.startViolation.text} (Official start: {String(OFFICIAL_SHIFT_START_HOUR).padStart(2, '0')}:00)
                      </p>
                    )}
                    {day.endViolation?.isViolation && (
                      <p className="flex items-center gap-1.5 font-bold">
                        <FaExclamationCircle /> Rule Broken — {day.endViolation.text} (Official end: {String(OFFICIAL_SHIFT_END_HOUR).padStart(2, '0')}:00)
                      </p>
                    )}
                  </div>
                )}

                {day.breakRows?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {day.breakRows.map((b, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-wrap items-center justify-between gap-2 text-xs rounded-xl px-3 py-2 border ${
                          b.isOvertime
                            ? (darkMode ? "bg-rose-600/20 border-rose-500/50 text-rose-300" : "bg-rose-100 border-rose-300 text-rose-700")
                            : (darkMode ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200")
                        }`}
                      >
                        <span className="flex items-center gap-1.5 font-semibold">
                          {b.type === "lunch" ? <FaUtensils /> : <FaCoffee />} {b.label}
                        </span>
                        <span className="font-mono">{formatClock(b.start)} - {b.end ? formatClock(b.end) : "In progress"}</span>
                        {b.isOvertime && (
                          <span className="flex items-center gap-1 font-bold">
                            <FaExclamationCircle /> Rule Broken — Overtime by {b.actualMins - b.allowed} min (took {b.actualMins} min, allowed {b.allowed} min)
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---- Main Dashboard ----
function EmployeeDashboard() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [shiftStarted, setShiftStarted] = useState(false);
  const [shiftStartTime, setShiftStartTime] = useState(null);
  const [shiftEndTime, setShiftEndTime] = useState(null);
  const [shiftPunctuality, setShiftPunctuality] = useState(null);
  const [shiftEndPunctuality, setShiftEndPunctuality] = useState(null);
  const [onBreak, setOnBreak] = useState(false);
  const [status, setStatus] = useState("Not Started");
  const [lastBreakEndTime, setLastBreakEndTime] = useState(null);

  // True once today's shift has been started AND ended — used to lock the
  // Start Shift button for the rest of the day.
  const [shiftCompletedToday, setShiftCompletedToday] = useState(false);

  const [activeBreakKey, setActiveBreakKey] = useState(null);
  const [activeBreakStartTime, setActiveBreakStartTime] = useState(null);
  // NEW: the (possibly cutoff-capped) total duration in seconds for the
  // currently active break. Combined with activeBreakStartTime, this lets
  // the countdown be recalculated from the real clock at any moment,
  // instead of drifting when ticks are missed (see the effect below).
  const [activeBreakDurationSecs, setActiveBreakDurationSecs] = useState(0);
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(0);
  const audioCtxRef = useRef(null);
  const sirenIntervalRef = useRef(null);

  const [completedBreaks, setCompletedBreaks] = useState({});
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const storedUser = JSON.parse(localStorage.getItem("user") || "null");
  const userId = storedUser?.id || storedUser?._id;
  const userName = storedUser?.name || "Employee";

  const [breaks, setBreaks] = useState({
    break1: { used: false, duration: 15, name: "Short Break 1", icon: FaCoffee },
    lunch: { used: false, duration: 30, name: "Lunch Break", icon: FaUtensils },
    break2: { used: false, duration: 15, name: "Short Break 2", icon: FaCoffee }
  });

  useEffect(() => {
    if (!userId) {
      navigate("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const playSirenBeep = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.error("Audio playback error", e);
    }
  };

  // FIX: Break countdown is now recalculated every tick from real clock
  // time (activeBreakStartTime + activeBreakDurationSecs vs Date.now()),
  // instead of decrementing "prev - 1" each second. The old approach lost
  // time whenever the browser throttled/paused setInterval — which happens
  // whenever the tab goes to background or the user switches to another
  // app/browser window — so the countdown appeared "stuck" until the tab
  // became active again. This version is self-correcting: no matter how
  // long the tab was hidden, the instant it's visible again the remaining
  // time is recomputed from scratch and is always accurate.
  useEffect(() => {
    if (!onBreak || !activeBreakStartTime) return;

    const computeRemaining = () => {
      const elapsed = Math.floor((Date.now() - activeBreakStartTime.getTime()) / 1000);
      return activeBreakDurationSecs - elapsed;
    };

    // Sync immediately (covers the moment the effect (re)starts, e.g. after
    // a page reload that restored an ongoing break).
    setBreakTimeRemaining(computeRemaining());

    const interval = setInterval(() => {
      const remaining = computeRemaining();
      setBreakTimeRemaining(remaining);
      if (remaining <= 60 && remaining > 0) {
        playSirenBeep();
      }
    }, 1000);

    // NEW: the moment the tab/window becomes visible/focused again, resync
    // instantly instead of waiting for the next 1s tick.
    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        setBreakTimeRemaining(computeRemaining());
      }
    };
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onBreak, activeBreakStartTime, activeBreakDurationSecs]);

  const stopSiren = () => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current);
    }
  };

  const formatTimeDifference = (totalMinutes) => {
    if (totalMinutes < 60) {
      return `${totalMinutes} min${totalMinutes > 1 ? 's' : ''}`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (mins === 0) {
      return `${hours} hr${hours > 1 ? 's' : ''}`;
    }
    return `${hours} hr${hours > 1 ? 's' : ''} ${mins} min${mins > 1 ? 's' : ''}`;
  };

  const formatSecondsToMMSS = (totalSecs) => {
    const sign = totalSecs < 0 ? "+" : "";
    const abs = Math.abs(totalSecs);
    const mins = Math.floor(abs / 60);
    const secs = abs % 60;
    return `${sign}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const computeShiftStartPunctuality = (startDate) => {
    const scheduledStart = new Date(startDate);
    scheduledStart.setHours(OFFICIAL_SHIFT_START_HOUR, 0, 0, 0);
    const diffInMins = Math.round((startDate.getTime() - scheduledStart.getTime()) / (1000 * 60));

    if (diffInMins > 0) {
      return { isLate: true, text: `Late by ${formatTimeDifference(diffInMins)}` };
    } else if (diffInMins < 0) {
      const earlyMins = Math.abs(diffInMins);
      return { isLate: false, text: earlyMins === 0 ? "On Time" : `Early by ${formatTimeDifference(earlyMins)}` };
    }
    return { isLate: false, text: "On Time" };
  };

  const computeShiftEndPunctuality = (endDate) => {
    const scheduledEnd = new Date(endDate);
    scheduledEnd.setHours(OFFICIAL_SHIFT_END_HOUR, 0, 0, 0);
    const diffInMins = Math.round((scheduledEnd.getTime() - endDate.getTime()) / (1000 * 60));

    if (diffInMins > 0) {
      return { isEarlyEnd: true, text: `Ended early by ${formatTimeDifference(diffInMins)}` };
    } else if (diffInMins < 0) {
      const overMins = Math.abs(diffInMins);
      return { isEarlyEnd: false, text: `Overtime by ${formatTimeDifference(overMins)}` };
    }
    return { isEarlyEnd: false, text: "Shift Ended On Time" };
  };

  useEffect(() => {
    if (!userId) return;

    const loadTodayShift = async () => {
      try {
        const res = await fetch(`${API_URL}api/users/${userId}`);
        const json = await res.json();
        const user = json?.data || json;
        const todayStr = new Date().toISOString().split("T")[0];
        const todayShift = user?.shifts?.find((s) => s.date === todayStr);

        if (!todayShift) return;

        if (todayShift.shiftStart) {
          const startDate = parseTimeStringToDate(todayShift.shiftStart);
          setShiftStartTime(startDate);
          setShiftPunctuality(computeShiftStartPunctuality(startDate));
          setShiftStarted(!todayShift.shiftEnd);
          setStatus(todayShift.shiftEnd ? "Shift Completed" : "Working");
        }

        if (todayShift.shiftEnd) {
          const endDate = parseTimeStringToDate(todayShift.shiftEnd);
          setShiftEndTime(endDate);
          setShiftEndPunctuality(computeShiftEndPunctuality(endDate));
          // Today's shift is already started + ended — lock the Start button.
          setShiftCompletedToday(true);
        }

        if (Array.isArray(todayShift.breaks) && todayShift.breaks.length > 0) {
          setBreaks((prev) => {
            const updated = { ...prev };
            todayShift.breaks.forEach((b) => {
              if (updated[b.type]) {
                updated[b.type] = { ...updated[b.type], used: true };
              }
            });
            return updated;
          });

          const completedInit = {};
          todayShift.breaks.forEach((b) => {
            if (b.start && b.end) {
              const startDate = parseTimeStringToDate(b.start);
              const endDate = parseTimeStringToDate(b.end);
              const allowedMins = b.type === "lunch" ? 30 : 15;
              const actualMins = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
              const isOvertime = actualMins > allowedMins;
              completedInit[b.type] = {
                start: startDate,
                end: endDate,
                isOvertime,
                overtimeMins: isOvertime ? actualMins - allowedMins : 0,
              };
            }
          });
          setCompletedBreaks(completedInit);

          const ongoing = todayShift.breaks.find((b) => !b.end);
          if (ongoing) {
            const startDate = parseTimeStringToDate(ongoing.start);
            const durationMins = ongoing.type === "lunch" ? 30 : 15;

            const lastHourCutoff = new Date(startDate);
            lastHourCutoff.setHours(OFFICIAL_SHIFT_END_HOUR - 1, 0, 0, 0);
            const secsUntilCutoffFromStart = Math.floor((lastHourCutoff.getTime() - startDate.getTime()) / 1000);
            const cappedDurationSecs =
              secsUntilCutoffFromStart >= 0 && secsUntilCutoffFromStart < durationMins * 60
                ? secsUntilCutoffFromStart
                : durationMins * 60;

            setActiveBreakKey(ongoing.type);
            setActiveBreakStartTime(startDate);
            setActiveBreakDurationSecs(cappedDurationSecs); // NEW: drives the recalculating effect above
            // Initial value — the effect above will immediately recompute
            // this from Date.now() anyway, this is just to avoid a 0/blank flash.
            const elapsedSecs = Math.floor((new Date().getTime() - startDate.getTime()) / 1000);
            setBreakTimeRemaining(cappedDurationSecs - elapsedSecs);
            setOnBreak(true);
            setStatus(`On ${ongoing.type === "lunch" ? "Lunch Break" : ongoing.type === "break1" ? "Short Break 1" : "Short Break 2"}`);
          } else {
            const lastEnded = [...todayShift.breaks].reverse().find((b) => b.end);
            if (lastEnded) setLastBreakEndTime(parseTimeStringToDate(lastEnded.end));
          }
        }
      } catch (e) {
        console.error("Failed to load today's shift status:", e);
      }
    };

    loadTodayShift();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const startShift = async () => {
    if (shiftCompletedToday) return; // extra safety, button is disabled anyway

    const now = new Date();
    setShiftStarted(true);
    setShiftStartTime(now);
    setShiftEndTime(null);
    setShiftEndPunctuality(null);
    setStatus("Working");
    setShiftPunctuality(computeShiftStartPunctuality(now));

    try {
      const res = await fetch(`${API_URL}api/shifts/start/${userId}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to start shift");
    } catch (e) {
      console.error("startShift API error:", e);
    }
  };

  const endShift = async () => {
    const now = new Date();
    setShiftStarted(false);
    setOnBreak(false);
    setShiftEndTime(now);
    setStatus("Shift Completed");
    setShiftEndPunctuality(computeShiftEndPunctuality(now));
    // Lock Start Shift for the rest of today.
    setShiftCompletedToday(true);

    try {
      const res = await fetch(`${API_URL}api/shifts/end/${userId}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to end shift");
    } catch (e) {
      console.error("endShift API error:", e);
    }
  };

  const startBreak = async (key) => {
    const now = new Date();

    const lastHourCutoff = new Date(now);
    lastHourCutoff.setHours(OFFICIAL_SHIFT_END_HOUR - 1, 0, 0, 0);

    const fullDurationSecs = breaks[key].duration * 60;
    const secsUntilCutoff = Math.floor((lastHourCutoff.getTime() - now.getTime()) / 1000);

    const durationSecs =
      secsUntilCutoff >= 0 && secsUntilCutoff < fullDurationSecs
        ? secsUntilCutoff
        : fullDurationSecs;

    setActiveBreakKey(key);
    setActiveBreakStartTime(now);
    setActiveBreakDurationSecs(durationSecs); // NEW: drives the recalculating effect above
    setBreakTimeRemaining(durationSecs);
    setOnBreak(true);
    setStatus(`On ${breaks[key].name}`);
    setBreaks((prev) => ({
      ...prev,
      [key]: { ...prev[key], used: true }
    }));

    try {
      const res = await fetch(`${API_URL}api/shifts/break/start/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: key }),
      });
      if (!res.ok) throw new Error("Failed to start break");
    } catch (e) {
      console.error("startBreak API error:", e);
    }
  };

  const endBreak = async () => {
    stopSiren();
    const finishedBreakKey = activeBreakKey;
    const finishedStart = activeBreakStartTime;
    const now = new Date();

    const isOvertime = breakTimeRemaining <= 0;
    const overtimeMins = isOvertime ? Math.ceil(Math.abs(breakTimeRemaining) / 60) : 0;

    if (finishedBreakKey) {
      setCompletedBreaks((prev) => ({
        ...prev,
        [finishedBreakKey]: {
          start: finishedStart,
          end: now,
          isOvertime,
          overtimeMins,
        },
      }));
    }

    setOnBreak(false);
    setActiveBreakKey(null);
    setActiveBreakStartTime(null);
    setActiveBreakDurationSecs(0);
    setStatus("Working");
    setLastBreakEndTime(now);

    if (!finishedBreakKey) return;

    try {
      const res = await fetch(`${API_URL}api/shifts/break/end/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: finishedBreakKey }),
      });
      if (!res.ok) throw new Error("Failed to end break");
    } catch (e) {
      console.error("endBreak API error:", e);
    }
  };

  const getBreakDisabledStatus = () => {
    if (!shiftStarted || onBreak) {
      return { disabled: true, reason: "Shift is inactive or break is in progress" };
    }

    const now = currentTime.getTime();

    const firstHourStart = new Date(currentTime);
    firstHourStart.setHours(OFFICIAL_SHIFT_START_HOUR, 0, 0, 0);
    const firstHourEnd = new Date(currentTime);
    firstHourEnd.setHours(OFFICIAL_SHIFT_START_HOUR + 1, 0, 0, 0);

    if (now >= firstHourStart.getTime() && now < firstHourEnd.getTime()) {
      const remainingMins = Math.ceil((firstHourEnd.getTime() - now) / (1000 * 60));
      return { disabled: true, reason: `No breaks allowed in the 1st hour of shift (${formatTimeDifference(remainingMins)} remaining)` };
    }

    const shiftEndScheduled = new Date(currentTime);
    shiftEndScheduled.setHours(OFFICIAL_SHIFT_END_HOUR, 0, 0, 0);
    const timeUntilShiftEnd = (shiftEndScheduled.getTime() - now) / (1000 * 60);
    if (timeUntilShiftEnd <= 60 && timeUntilShiftEnd >= 0) {
      return { disabled: true, reason: "No breaks allowed in the last 1 hour of the shift" };
    }

    if (lastBreakEndTime) {
      const timeSinceLastBreak = (now - lastBreakEndTime.getTime()) / (1000 * 60);
      if (timeSinceLastBreak < 60) {
        const remaining = Math.ceil(60 - timeSinceLastBreak);
        return { disabled: true, reason: `60-min Cooldown Active (${formatTimeDifference(remaining)} remaining)` };
      }
    }

    return { disabled: false, reason: "" };
  };

  const breakStatus = getBreakDisabledStatus();
  const isLastMinute = breakTimeRemaining <= 60 && breakTimeRemaining > 0;
  const isOvertime = onBreak && breakTimeRemaining <= 0;

  return (
    <div 
      className={`h-screen w-full font-sans transition-colors duration-300 relative overflow-y-auto overflow-x-hidden ${
        darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      {darkMode && <StarBackground />}

      <style>{`
        @keyframes overtimeBlink {
          0%, 100% { background-color: rgba(190, 18, 60, 0.95); border-color: rgb(244, 63, 94); }
          50% { background-color: rgba(76, 5, 25, 0.95); border-color: rgb(136, 19, 55); }
        }
        .overtime-blink {
          animation: overtimeBlink 0.6s steps(2, jump-none) infinite;
        }
      `}</style>

      <Navbar 
        role="Employee" 
        userName={userName} 
        darkMode={darkMode} 
        setDarkMode={setDarkMode} 
      />

      <main className="max-w-7xl mx-auto p-6 space-y-6 relative z-10 pb-28">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className={`text-2xl md:text-3xl font-extrabold ${darkMode ? "text-white" : "text-slate-900"}`}>
              <span className={darkMode ? "text-amber-400" : "text-amber-600"}>{getGreeting()}</span>, {userName}!
            </h1>
            <p className={`text-xs mt-1 font-medium ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
              Track your shift timings, request breaks, and view active status.
            </p>
          </div>

          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowHistoryModal(true)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm border transition-all ${
              darkMode
                ? "bg-slate-900/60 border-slate-700 text-amber-400 hover:bg-slate-800/60"
                : "bg-white border-slate-300 text-amber-600 hover:bg-slate-50"
            }`}
          >
            <FaHistory /> View History
          </motion.button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={`border rounded-3xl p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-amber-500/30 ${
              darkMode 
                ? "bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/60" 
                : "bg-white/70 border-slate-200/80 shadow-slate-200/50 hover:bg-white/90"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-2xl border shadow-inner ${
                darkMode ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-amber-50 border-amber-300 text-amber-600"
              }`}>
                <FaClock className="text-2xl" />
              </div>
              <div>
                <p className={`text-xs uppercase tracking-wider font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Current Time</p>
                <h2 className={`text-3xl font-extrabold mt-1 font-mono ${darkMode ? "text-white" : "text-slate-900"}`}>{currentTime.toLocaleTimeString()}</h2>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={`border rounded-3xl p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-amber-500/30 ${
              darkMode 
                ? "bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/60" 
                : "bg-white/70 border-slate-200/80 shadow-slate-200/50 hover:bg-white/90"
            }`}
          >
            <p className={`text-xs uppercase tracking-wider font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Official Shift Hours</p>
            <h2 className={`text-2xl font-bold mt-2 ${darkMode ? "text-amber-400" : "text-amber-600"}`}>10:00 AM - 07:00 PM</h2>
            <p className={`text-xs mt-1 ${darkMode ? "text-slate-400" : "text-slate-600"}`}>Total Duration: 9 Hours</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={`border rounded-3xl p-6 shadow-xl backdrop-blur-xl transition-all duration-300 hover:border-amber-500/30 ${
              darkMode 
                ? "bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/60" 
                : "bg-white/70 border-slate-200/80 shadow-slate-200/50 hover:bg-white/90"
            }`}
          >
            <p className={`text-xs uppercase tracking-wider font-semibold ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Current Status</p>
            <div className="flex items-center gap-3 mt-2">
              <span className={`w-3 h-3 rounded-full animate-ping ${onBreak ? 'bg-amber-500' : shiftStarted ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <h2 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>{status}</h2>
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className={`border rounded-3xl p-6 shadow-xl backdrop-blur-xl ${
            darkMode 
              ? "bg-slate-900/40 border-slate-800/80" 
              : "bg-white/70 border-slate-200/80 shadow-slate-200/50"
          }`}
        >
          <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${darkMode ? "text-white" : "text-slate-900"}`}>
            <FaHistory className={darkMode ? "text-amber-400" : "text-amber-600"} /> Shift Action
          </h2>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              {shiftCompletedToday ? (
                <div className="flex items-center gap-3 bg-slate-800/50 text-slate-500 px-8 py-4 rounded-2xl font-extrabold cursor-not-allowed select-none">
                  <FaCheckCircle /> Shift Completed for Today
                </div>
              ) : !shiftStarted ? (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startShift}
                  className="flex items-center gap-3 bg-amber-400 hover:bg-amber-300 text-slate-950 px-8 py-4 rounded-2xl font-extrabold shadow-lg shadow-amber-500/20 transition-all"
                >
                  <FaPlay /> Start Shift
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={endShift}
                  disabled={onBreak}
                  className="flex items-center gap-3 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800/50 disabled:text-slate-500 text-white px-8 py-4 rounded-2xl font-extrabold transition-all shadow-lg shadow-rose-600/20"
                >
                  <FaStop /> End Shift
                </motion.button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {shiftStartTime && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl border backdrop-blur-md ${
                    darkMode ? "bg-slate-950/40 border-slate-800/80" : "bg-slate-50/70 border-slate-200/80"
                  }`}
                >
                  <div>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                      Shift Started At
                    </p>
                    <p className={`text-lg font-extrabold font-mono mt-0.5 ${darkMode ? "text-white" : "text-slate-900"}`}>
                      {shiftStartTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  </div>

                  {shiftPunctuality && (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                      shiftPunctuality.isLate 
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-400" 
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    }`}>
                      {shiftPunctuality.isLate ? <FaTimesCircle /> : <FaCheckCircle />}
                      <span>{shiftPunctuality.text}</span>
                    </div>
                  )}
                </motion.div>
              )}

              {shiftEndTime && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl border backdrop-blur-md ${
                    darkMode ? "bg-slate-950/40 border-slate-800/80" : "bg-slate-50/70 border-slate-200/80"
                  }`}
                >
                  <div>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                      Shift Ended At
                    </p>
                    <p className={`text-lg font-extrabold font-mono mt-0.5 ${darkMode ? "text-white" : "text-slate-900"}`}>
                      {shiftEndTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </p>
                  </div>

                  {shiftEndPunctuality && (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                      shiftEndPunctuality.isEarlyEnd 
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-400" 
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    }`}>
                      {shiftEndPunctuality.isEarlyEnd ? <FaExclamationCircle /> : <FaCheckCircle />}
                      <span>{shiftEndPunctuality.text}</span>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className={`border rounded-3xl p-6 shadow-xl backdrop-blur-xl ${
            darkMode 
              ? "bg-slate-900/40 border-slate-800/80" 
              : "bg-white/70 border-slate-200/80 shadow-slate-200/50"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className={`text-lg font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>Break Controls</h2>
              <p className={`text-xs mt-0.5 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>3 Breaks allowed per day (2 Short Breaks of 15 mins & 1 Lunch Break of 30 mins)</p>
            </div>

            {breakStatus.disabled && shiftStarted && !onBreak && (
              <div className={`px-4 py-2 rounded-xl text-xs flex items-center gap-2 border backdrop-blur-md ${
                darkMode ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-amber-50/80 border-amber-300 text-amber-700"
              }`}>
                <FaExclamationCircle className="shrink-0" />
                <span>{breakStatus.reason}</span>
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            {onBreak ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`text-center py-10 rounded-2xl border backdrop-blur-md relative overflow-hidden ${
                  isOvertime
                    ? "overtime-blink text-white border-2"
                    : isLastMinute 
                    ? (darkMode ? "bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse" : "bg-rose-50/90 border-rose-300 text-rose-800 animate-pulse")
                    : (darkMode ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-amber-50/80 border-amber-200 text-amber-800")
                }`}
              >
                {(isLastMinute || isOvertime) && (
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-bold shadow-lg animate-bounce">
                    <FaBell /> {isOvertime ? "Break Overtime!" : "Break Ending Soon!"}
                  </div>
                )}

                <h3 className="text-3xl font-black mb-1">
                  {activeBreakKey ? breaks[activeBreakKey]?.name : "Break Active"}
                </h3>
                <p className={`text-xs mb-4 ${isOvertime ? "text-white" : darkMode ? "text-slate-300" : "text-slate-600"}`}>
                  {isOvertime ? "🚨 Break time is over — please end your break!" : isLastMinute ? "⚠️ Less than 1 minute remaining!" : "Your break countdown is running."}
                </p>

                <div className={`text-5xl font-mono font-black mb-6 tracking-wider ${isOvertime ? "text-white" : isLastMinute ? "text-rose-500" : ""}`}>
                  {formatSecondsToMMSS(breakTimeRemaining)}
                </div>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={endBreak}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-8 py-3.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all"
                >
                  End Break & Return to Work
                </motion.button>
              </motion.div>
            ) : (
              <div className="grid md:grid-cols-3 gap-5">
                {Object.keys(breaks).map((key) => {
                  const item = breaks[key];
                  const Icon = item.icon;
                  const isDisabled = breakStatus.disabled || item.used;
                  const completed = completedBreaks[key];

                  return (
                    <div 
                      key={key} 
                      className={`border rounded-2xl p-5 flex flex-col justify-between backdrop-blur-md transition-all duration-300 ${
                        completed?.isOvertime
                          ? (darkMode ? "bg-rose-950/40 border-rose-600/60" : "bg-rose-50 border-rose-400")
                          : darkMode 
                            ? "bg-slate-950/40 border-slate-800/80 hover:border-amber-500/40 hover:bg-slate-950/60" 
                            : "bg-slate-50/70 border-slate-200/80 hover:border-amber-400 hover:bg-slate-50"
                      }`}
                    >
                      <div>
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-4 border ${
                          darkMode ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-amber-100/70 border-amber-300 text-amber-600"
                        }`}>
                          <Icon />
                        </div>
                        <h3 className={`font-bold text-base ${darkMode ? "text-white" : "text-slate-900"}`}>{item.name}</h3>
                        <p className={`text-xs mb-3 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{item.duration} Minutes Duration</p>

                        {completed && (
                          <div className={`mb-3 text-[11px] rounded-lg px-2.5 py-2 border ${
                            completed.isOvertime
                              ? "bg-rose-600/20 border-rose-500/50 text-rose-300"
                              : (darkMode ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-300 text-emerald-700")
                          }`}>
                            <p className="font-bold font-mono">
                              {completed.start?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {" - "}
                              {completed.end?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            {completed.isOvertime && (
                              <p className="flex items-center gap-1 mt-1 font-bold">
                                <FaExclamationCircle /> Rule Broken — Overtime by {completed.overtimeMins} min{completed.overtimeMins > 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <motion.button
                        type="button"
                        whileHover={!isDisabled ? { scale: 1.02 } : {}}
                        whileTap={!isDisabled ? { scale: 0.98 } : {}}
                        disabled={isDisabled}
                        onClick={() => startBreak(key)}
                        className={`w-full font-extrabold py-3 rounded-xl transition-all ${
                          isDisabled 
                            ? (darkMode ? "bg-slate-800/40 text-slate-600 border border-slate-800/60" : "bg-slate-200/60 text-slate-400 border border-slate-300/60") 
                            : "bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md shadow-amber-500/10"
                        }`}
                      >
                        {item.used ? "Already Used" : "Start Break"}
                      </motion.button>
                    </div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      <HistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        userId={userId}
        darkMode={darkMode}
      />
    </div>
  );
}

export default EmployeeDashboard;