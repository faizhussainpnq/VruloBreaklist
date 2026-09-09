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
  FaBell
} from "react-icons/fa";
import StarBackground from "../components/StarBackground";
import Navbar from "../components/Navbar";

const API_URL = import.meta.env.VITE_API_URL || "https://vrulobreaklist-1.onrender.com/";

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

  // New states for Break Timer & Siren
  const [activeBreakKey, setActiveBreakKey] = useState(null);
  const [breakTimeRemaining, setBreakTimeRemaining] = useState(0); // in seconds
  const audioCtxRef = useRef(null);
  const sirenIntervalRef = useRef(null);

  // Logged-in user (saved in localStorage during Login.jsx)
  const storedUser = JSON.parse(localStorage.getItem("user") || "null");
  const userId = storedUser?.id || storedUser?._id;
  const userName = storedUser?.name || "Employee";

  const OFFICIAL_SHIFT_START_HOUR = 10; // 10:00 AM
  const OFFICIAL_SHIFT_END_HOUR = 19;   // 07:00 PM (19:00)

  const [breaks, setBreaks] = useState({
    break1: { used: false, duration: 15, name: "Short Break 1", icon: FaCoffee },
    lunch: { used: false, duration: 30, name: "Lunch Break", icon: FaUtensils },
    break2: { used: false, duration: 15, name: "Short Break 2", icon: FaCoffee }
  });

  // If no logged-in user found, send back to login
  useEffect(() => {
    if (!userId) {
      navigate("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Current Time Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Play Siren / Beep Sound using Web Audio API
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
      osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch alert tone
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.error("Audio playback error", e);
    }
  };

  // Break Countdown & Siren Logic
  useEffect(() => {
    let interval = null;
    if (onBreak) {
      interval = setInterval(() => {
        setBreakTimeRemaining((prev) => {
          // No more auto-ending at 0 — it keeps counting down into negative
          // (overtime) until the employee manually ends the break.
          // Keep beeping through the last minute AND while in overtime.
          if (prev <= 60) {
            playSirenBeep();
          }

          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [onBreak, breakTimeRemaining]);

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

  // ---- Helpers to work with backend's "hh:mm AM/PM" time strings ----
  const parseTimeStringToDate = (timeStr) => {
    if (!timeStr) return null;
    const [time, modifier] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);
    if (modifier === "PM" && hours !== 12) hours += 12;
    if (modifier === "AM" && hours === 12) hours = 0;
    const dateObj = new Date();
    dateObj.setHours(hours, minutes, 0, 0);
    return dateObj;
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

  // Restore today's shift/break state from backend (so a page refresh doesn't lose progress)
  useEffect(() => {
    if (!userId) return;

    const loadTodayShift = async () => {
      try {
        const res = await fetch(`${API_URL}api/users/${userId}`);
        const json = await res.json();
        const user = json?.data || json; // supports { success, data } or a plain user object
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

          const ongoing = todayShift.breaks.find((b) => !b.end);
          if (ongoing) {
            const startDate = parseTimeStringToDate(ongoing.start);
            const durationMins =
              ongoing.type === "lunch" ? 30 : 15; // matches breaks config above

            // Same 6:00 PM cutoff cap as startBreak, so a refreshed page shows the
            // same (possibly shortened) countdown instead of the full duration.
            const lastHourCutoff = new Date(startDate);
            lastHourCutoff.setHours(OFFICIAL_SHIFT_END_HOUR - 1, 0, 0, 0);
            const secsUntilCutoffFromStart = Math.floor((lastHourCutoff.getTime() - startDate.getTime()) / 1000);
            const cappedDurationSecs =
              secsUntilCutoffFromStart >= 0 && secsUntilCutoffFromStart < durationMins * 60
                ? secsUntilCutoffFromStart
                : durationMins * 60;

            const elapsedSecs = Math.floor((new Date().getTime() - startDate.getTime()) / 1000);
            const remaining = cappedDurationSecs - elapsedSecs;

            setActiveBreakKey(ongoing.type);
            setBreakTimeRemaining(remaining);
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

    try {
      const res = await fetch(`${API_URL}api/shifts/end/${userId}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to end shift");
    } catch (e) {
      console.error("endShift API error:", e);
    }
  };

  const startBreak = async (key) => {
    const now = new Date();

    // Cutoff = start of the "last hour, no breaks" window (6:00 PM).
    // If the full break would run past this cutoff, cap the countdown to
    // whatever time is actually left until 6:00 PM.
    const lastHourCutoff = new Date(now);
    lastHourCutoff.setHours(OFFICIAL_SHIFT_END_HOUR - 1, 0, 0, 0);

    const fullDurationSecs = breaks[key].duration * 60;
    const secsUntilCutoff = Math.floor((lastHourCutoff.getTime() - now.getTime()) / 1000);

    const durationSecs =
      secsUntilCutoff >= 0 && secsUntilCutoff < fullDurationSecs
        ? secsUntilCutoff
        : fullDurationSecs;

    setActiveBreakKey(key);
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
    setOnBreak(false);
    setActiveBreakKey(null);
    setStatus("Working");
    setLastBreakEndTime(new Date());

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

    // 1st hour restriction: fixed official window (10:00 AM - 11:00 AM), regardless of
    // when the employee actually clocked in (early or late)
    const firstHourStart = new Date(currentTime);
    firstHourStart.setHours(OFFICIAL_SHIFT_START_HOUR, 0, 0, 0);
    const firstHourEnd = new Date(currentTime);
    firstHourEnd.setHours(OFFICIAL_SHIFT_START_HOUR + 1, 0, 0, 0);

    if (now >= firstHourStart.getTime() && now < firstHourEnd.getTime()) {
      const remainingMins = Math.ceil((firstHourEnd.getTime() - now) / (1000 * 60));
      return { disabled: true, reason: `No breaks allowed in the 1st hour of shift (${formatTimeDifference(remainingMins)} remaining)` };
    }

    // Last 1 hour restriction before official shift end (19:00 / 7:00 PM)
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

      {/* Blinking red alert used once a break runs into overtime */}
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
        <div>
          <h1 className={`text-2xl md:text-3xl font-extrabold ${darkMode ? "text-white" : "text-slate-900"}`}>
            <span className={darkMode ? "text-amber-400" : "text-amber-600"}>{getGreeting()}</span>, {userName}!
          </h1>
          <p className={`text-xs mt-1 font-medium ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
            Track your shift timings, request breaks, and view active status.
          </p>
        </div>

        {/* Top Info Glass Cards */}
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

        {/* Shift Action & Timing Details Glass Card */}
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
              {!shiftStarted ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startShift}
                  className="flex items-center gap-3 bg-amber-400 hover:bg-amber-300 text-slate-950 px-8 py-4 rounded-2xl font-extrabold shadow-lg shadow-amber-500/20 transition-all"
                >
                  <FaPlay /> Start Shift
                </motion.button>
              ) : (
                <motion.button
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

        {/* Break Controls Glass Card */}
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

                {/* Live Countdown Clock */}
                <div className={`text-5xl font-mono font-black mb-6 tracking-wider ${isOvertime ? "text-white" : isLastMinute ? "text-rose-500" : ""}`}>
                  {formatSecondsToMMSS(breakTimeRemaining)}
                </div>

                <motion.button
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

                  return (
                    <div 
                      key={key} 
                      className={`border rounded-2xl p-5 flex flex-col justify-between backdrop-blur-md transition-all duration-300 ${
                        darkMode 
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
                        <p className={`text-xs mb-6 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>{item.duration} Minutes Duration</p>
                      </div>

                      <motion.button
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
    </div>
  );
}

export default EmployeeDashboard;
