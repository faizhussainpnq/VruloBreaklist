import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom"; 
import { motion, AnimatePresence } from "framer-motion";
import {
  FaClock,
  FaSearch,
  FaCalendarAlt,
  FaEdit,
  FaTrash,
  FaExclamationTriangle,
  FaTimes,
  FaChartPie,
  FaUserMinus,
  FaUserPlus,
  FaEye,
  FaEyeSlash,
  FaCheckCircle,
  FaRedo,
  FaMugHot,
  FaUndo,
  FaSave,
  FaBan
} from "react-icons/fa";
import StarBackground from "../components/StarBackground";
import Navbar from "../components/Navbar";
import ViolationsModal from "../components/ViolationsModal";
import EmployeeHistoryModal from "../components/EmployeeHistoryModal";
import {
  calculateWorkHours,
  computeShiftViolations,
  getBreakStatus,
  findShiftByDate,
  todayDateString,
  formatCountdown,
  getEffectiveAllowedMinutes,
  parseTimeToMinutes,
  formatMinutes,
  EXPECTED_SHIFT_END,
} from "../utils/ShiftUtils.js";

// If your break-manage routes (PUT/DELETE /break/:id/:breakId) are mounted
// under a different prefix than the other break routes, change ONLY this
// constant — everything else in BreakManageModal uses it automatically.
const BREAK_MANAGE_API_PREFIX = "api/shifts/break";

const BREAK_TYPE_LABELS = {
  break1: "Short Break 1",
  lunch: "Lunch Break",
  break2: "Short Break 2",
};

// NEW: Reusable spinning-ring loader. Pass `size` (px) and optional className
// for color (uses currentColor so parent text-color controls it).
const Spinner = ({ size = 20, className = "" }) => (
  <svg
    className={`animate-spin ${className}`}
    style={{ width: size, height: size }}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="3.5"
    />
    <path
      className="opacity-90"
      d="M12 2a10 10 0 0 1 10 10"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
    />
  </svg>
);

// NEW: Full-page loading overlay — big glowing ring, blurred backdrop.
// Used whenever employees are being fetched, so it genuinely feels like
// the whole page is loading rather than just a table row.
const FullPageLoader = ({ label = "Loading employees...", darkMode }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className={`fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 backdrop-blur-sm ${
      darkMode ? "bg-slate-950/80" : "bg-slate-100/80"
    }`}
  >
    <div className="relative w-20 h-20 flex items-center justify-center">
      <div
        className={`absolute inset-0 rounded-full border-4 ${
          darkMode ? "border-slate-800" : "border-slate-300"
        }`}
      />
      <div className="absolute inset-0 rounded-full border-4 border-amber-400 border-t-transparent animate-spin shadow-[0_0_20px_rgba(251,191,36,0.4)]" />
      <div className="absolute inset-2 rounded-full border-2 border-amber-400/30 border-b-transparent animate-spin [animation-direction:reverse] [animation-duration:1.2s]" />
    </div>
    <p className={`text-sm font-bold animate-pulse tracking-wide ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
      {label}
    </p>
  </motion.div>
);

// NEW: Centered "action in progress" overlay — used for delete / save /
// register instead of a spinner crammed inside the button. Sits ABOVE the
// modals (z-[80]) so it dims the whole screen including whichever form
// triggered it, feels premium instead of "beech me loading" ugliness.
const ActionOverlay = ({ show, label = "Working on it...", darkMode }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-[3px]"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 8 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className={`flex flex-col items-center gap-4 px-10 py-8 rounded-3xl border shadow-2xl ${
            darkMode
              ? "bg-slate-900/95 border-slate-800"
              : "bg-white/95 border-slate-200"
          }`}
        >
          <div className="relative w-14 h-14 flex items-center justify-center">
            <div
              className={`absolute inset-0 rounded-full border-4 ${
                darkMode ? "border-slate-800" : "border-slate-200"
              }`}
            />
            <div className="absolute inset-0 rounded-full border-4 border-amber-400 border-t-transparent animate-spin shadow-[0_0_18px_rgba(251,191,36,0.45)]" />
          </div>
          <p className={`text-xs font-extrabold tracking-wide animate-pulse ${darkMode ? "text-slate-200" : "text-slate-700"}`}>
            {label}
          </p>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// NEW: Small, styled confirmation modal — replaces the browser's ugly
// native window.confirm() for resetting a break. Matches the rest of the
// app's design language (rounded corners, dark/light aware, amber/rose
// accents) instead of a jarring OS-native popup.
const ConfirmModal = ({ open, title, message, confirmLabel, onConfirm, onCancel, darkMode, danger = true }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-sm rounded-3xl border shadow-2xl p-6 ${
            darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
          }`}
        >
          <div className="flex items-start gap-3 mb-4">
            <div className={`shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center ${
              danger
                ? (darkMode ? "bg-rose-500/15 text-rose-400" : "bg-rose-100 text-rose-600")
                : (darkMode ? "bg-amber-500/15 text-amber-400" : "bg-amber-100 text-amber-600")
            }`}>
              <FaExclamationTriangle />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">{title}</h3>
              <p className={`text-xs mt-1 leading-relaxed ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
                {message}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                darkMode ? "text-slate-400 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-lg ${
                danger
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20"
                  : "bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-500/20"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ---------------------------------------------------------------------
// NEW: Break Management Modal (the "chai cup" modal)
// ---------------------------------------------------------------------
// Shows every break taken TODAY by the given employee, calculated straight
// from the DB record (shift.breaks), flags any break that ran over its
// allowed limit (15 min for break1/break2, 30 min for lunch, cutoff-aware
// via getEffectiveAllowedMinutes so it matches the rest of the app) in red
// with the exact rule that was broken, and lets the admin:
//   - Edit a break's start/end time (e.g. fix a few seconds of network lag)
//   - Reset (delete) a break entirely so the employee can take it again
//     from their own dashboard (useful when they accidentally ended it
//     seconds after starting it)
function BreakManageModal({ open, onClose, darkMode, employee, apiUrl, onUpdated }) {
  // Local copy of today's shift so the modal can update instantly after an
  // edit/reset without waiting for the parent's 5s poll cycle.
  const [shift, setShift] = useState(null);
  const [editingBreakId, setEditingBreakId] = useState(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [localError, setLocalError] = useState("");

  // NEW: which break (if any) is pending a reset confirmation. Replaces
  // window.confirm() with the styled ConfirmModal above.
  const [pendingResetBreak, setPendingResetBreak] = useState(null);

  useEffect(() => {
    if (!open) return;
    const today = todayDateString();
    setShift(findShiftByDate(employee?.shifts, today));
    setEditingBreakId(null);
    setLocalError("");
    setPendingResetBreak(null);
  }, [open, employee]);

  if (!open) return null;

  const userId = employee?.id;
  const shiftId = shift?._id;
  const breaks = Array.isArray(shift?.breaks) ? shift.breaks : [];

  const computeRow = (b) => {
    const allowedMinutes = getEffectiveAllowedMinutes(b, shift?.shiftEnd || EXPECTED_SHIFT_END);
    let durationMinutes = null;
    let isOver = false;
    let overByMinutes = 0;

    if (b.start && b.end) {
      const s = parseTimeToMinutes(b.start);
      const e = parseTimeToMinutes(b.end);
      if (s !== null && e !== null) {
        let dur = e - s;
        if (dur < 0) dur += 24 * 60;
        durationMinutes = dur;
        isOver = dur > allowedMinutes;
        overByMinutes = isOver ? dur - allowedMinutes : 0;
      }
    }

    return { allowedMinutes, durationMinutes, isOver, overByMinutes };
  };

  const startEdit = (b) => {
    setLocalError("");
    setEditingBreakId(b._id);
    setEditStart(b.start || "");
    setEditEnd(b.end || "");
  };

  const cancelEdit = () => {
    setEditingBreakId(null);
    setLocalError("");
  };

  const saveEdit = async (b) => {
    setLocalError("");

    if (!editStart.trim()) {
      setLocalError("Start time is required.");
      return;
    }
    if (parseTimeToMinutes(editStart.trim()) === null) {
      setLocalError('Start time must look like "03:05 PM" (or "03:05:30 PM").');
      return;
    }
    if (editEnd.trim() && parseTimeToMinutes(editEnd.trim()) === null) {
      setLocalError('End time must look like "03:20 PM" (or leave it blank for an ongoing break).');
      return;
    }
    if (!shiftId) {
      setLocalError("Couldn't find today's shift record. Try refreshing.");
      return;
    }

    try {
      setSavingId(b._id);
      const res = await fetch(`${apiUrl}${BREAK_MANAGE_API_PREFIX}/${userId}/${b._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          shiftId,
          start: editStart.trim(),
          end: editEnd.trim(), // empty string clears the end time (reopens the break)
        }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        throw new Error("Server sent an invalid response.");
      }

      if (!res.ok) {
        throw new Error(data.message || `Update failed (${res.status})`);
      }

      const updatedUser = data.data || data.user || data;
      const updatedShift = findShiftByDate(updatedUser?.shifts, todayDateString());
      setShift(updatedShift || shift);
      setEditingBreakId(null);

      // Silently refresh the main table in the background too.
      onUpdated?.(true);
    } catch (err) {
      console.error("UPDATE BREAK ERROR:", err);
      setLocalError(err?.message || "Couldn't save this break. Please try again.");
    } finally {
      setSavingId(null);
    }
  };

  // NEW: this just opens the styled confirmation modal now, instead of
  // running window.confirm() directly. The actual reset logic moved to
  // performResetBreak() below, which the modal's "Reset Break" button calls.
  const requestResetBreak = (b) => {
    if (!shiftId) {
      setLocalError("Couldn't find today's shift record. Try refreshing.");
      return;
    }
    setLocalError("");
    setPendingResetBreak(b);
  };

  const performResetBreak = async () => {
    const b = pendingResetBreak;
    if (!b) return;
    setPendingResetBreak(null);

    try {
      setDeletingId(b._id);
      setLocalError("");

      const res = await fetch(`${apiUrl}${BREAK_MANAGE_API_PREFIX}/${userId}/${b._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ shiftId }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        // some delete endpoints return no body — that's fine
      }

      if (!res.ok) {
        throw new Error(data.message || `Reset failed (${res.status})`);
      }

      const updatedUser = data.data || data.user || data;
      const updatedShift = findShiftByDate(updatedUser?.shifts, todayDateString());
      setShift(
        updatedShift || {
          ...shift,
          breaks: breaks.filter((x) => x._id !== b._id),
        }
      );

      onUpdated?.(true);
    } catch (err) {
      console.error("DELETE BREAK ERROR:", err);
      setLocalError(err?.message || "Couldn't reset this break. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const pendingLabel = pendingResetBreak ? (BREAK_TYPE_LABELS[pendingResetBreak.type] || pendingResetBreak.type) : "";

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl border shadow-2xl flex flex-col ${
              darkMode ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${darkMode ? "border-slate-800" : "border-slate-200"}`}>
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                <FaMugHot className={darkMode ? "text-amber-400" : "text-amber-600"} />
                Today's Breaks — {employee?.name}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${darkMode ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`}
              >
                <FaTimes />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-3">
              {!shift && (
                <p className="text-sm opacity-70">No shift found for today — employee hasn't started their shift yet.</p>
              )}

              {shift && breaks.length === 0 && (
                <p className="text-sm opacity-70">No breaks taken yet today.</p>
              )}

              {localError && (
                <div className={`text-xs font-bold px-3 py-2 rounded-xl border flex items-center gap-2 ${
                  darkMode ? "bg-rose-600/20 border-rose-500/40 text-rose-300" : "bg-rose-100 border-rose-300 text-rose-700"
                }`}>
                  <FaExclamationTriangle className="shrink-0" /> {localError}
                </div>
              )}

              {breaks.map((b) => {
                const { allowedMinutes, durationMinutes, isOver, overByMinutes } = computeRow(b);
                const label = BREAK_TYPE_LABELS[b.type] || b.type;
                const isEditing = editingBreakId === b._id;
                const isSaving = savingId === b._id;
                const isDeleting = deletingId === b._id;
                const ongoing = Boolean(b.start && !b.end);

                return (
                  <div
                    key={b._id}
                    className={`border rounded-2xl p-4 ${
                      isOver
                        ? (darkMode ? "bg-rose-950/40 border-rose-600/50" : "bg-rose-50 border-rose-300")
                        : ongoing
                          ? (darkMode ? "bg-amber-950/20 border-amber-600/40" : "bg-amber-50 border-amber-300")
                          : (darkMode ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-200")
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="font-bold text-sm flex items-center gap-2">
                        <FaMugHot className={darkMode ? "text-amber-400" : "text-amber-600"} />
                        {label}
                      </span>
                      <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full ${
                        isOver
                          ? (darkMode ? "bg-rose-500/20 text-rose-400" : "bg-rose-100 text-rose-700")
                          : ongoing
                            ? (darkMode ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700")
                            : (darkMode ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700")
                      }`}>
                        {isOver ? "Rule Broken" : ongoing ? "Ongoing" : "Within Limit"}
                      </span>
                    </div>

                    {!isEditing ? (
                      <>
                        <div className="grid sm:grid-cols-3 gap-3 text-xs mb-2">
                          <div>
                            <p className="uppercase font-semibold opacity-60 mb-0.5">Start</p>
                            <p className="font-mono font-bold">{b.start || "—"}</p>
                          </div>
                          <div>
                            <p className="uppercase font-semibold opacity-60 mb-0.5">End</p>
                            <p className="font-mono font-bold">{b.end || (ongoing ? "In progress" : "—")}</p>
                          </div>
                          <div>
                            <p className="uppercase font-semibold opacity-60 mb-0.5">Duration / Limit</p>
                            <p className="font-mono font-bold">
                              {durationMinutes !== null ? formatMinutes(durationMinutes) : "—"} / {formatMinutes(allowedMinutes)}
                            </p>
                          </div>
                        </div>

                        {isOver && (
                          <div className={`text-xs font-bold flex items-center gap-1.5 mb-3 ${darkMode ? "text-rose-300" : "text-rose-700"}`}>
                            <FaExclamationTriangle />
                            Rule Broken — took {formatMinutes(durationMinutes)}, allowed {formatMinutes(allowedMinutes)} (over by {formatMinutes(overByMinutes)})
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(b)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                              darkMode ? "bg-slate-800 hover:bg-slate-700 text-amber-400" : "bg-slate-200 hover:bg-slate-300 text-amber-700"
                            }`}
                          >
                            <FaEdit /> Edit Time
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => requestResetBreak(b)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isDeleting ? <Spinner size={12} /> : <FaUndo />}
                            {isDeleting ? "Resetting..." : "Reset Break"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block mb-1 font-bold opacity-70">Start Time</label>
                            <input
                              type="text"
                              value={editStart}
                              onChange={(e) => setEditStart(e.target.value)}
                              placeholder="e.g. 03:05 PM"
                              className={`w-full p-2 rounded-lg border font-mono font-bold text-xs ${
                                darkMode ? "bg-slate-950 border-slate-700 text-amber-400" : "bg-white border-slate-300 text-amber-700"
                              }`}
                            />
                          </div>
                          <div>
                            <label className="block mb-1 font-bold opacity-70">End Time (blank = ongoing)</label>
                            <input
                              type="text"
                              value={editEnd}
                              onChange={(e) => setEditEnd(e.target.value)}
                              placeholder="e.g. 03:20 PM"
                              className={`w-full p-2 rounded-lg border font-mono font-bold text-xs ${
                                darkMode ? "bg-slate-950 border-slate-700 text-amber-400" : "bg-white border-slate-300 text-amber-700"
                              }`}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => saveEdit(b)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isSaving ? <Spinner size={12} /> : <FaSave />}
                            {isSaving ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={cancelEdit}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 transition-colors ${
                              darkMode ? "bg-slate-800 hover:bg-slate-700 text-slate-300" : "bg-slate-200 hover:bg-slate-300 text-slate-700"
                            }`}
                          >
                            <FaBan /> Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* NEW: styled reset confirmation, replacing window.confirm() */}
      <ConfirmModal
        open={Boolean(pendingResetBreak)}
        title={`Reset "${pendingLabel}"?`}
        message={`This deletes today's record for this break for ${employee?.name}, so they can take it again from their own dashboard. This can't be undone.`}
        confirmLabel="Reset Break"
        onConfirm={performResetBreak}
        onCancel={() => setPendingResetBreak(null)}
        darkMode={darkMode}
        danger
      />
    </>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("2026-09");
  const [hoveredSegment, setHoveredSegment] = useState(null);

  // Modals States
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [deletingEmployee, setDeletingEmployee] = useState(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [showViolationsModal, setShowViolationsModal] = useState(false);
  const [historyEmployee, setHistoryEmployee] = useState(null);

  // NEW: Break management modal (the "chai cup" icon)
  const [breakManageEmployee, setBreakManageEmployee] = useState(null);

  // Password visibility state for Register Modal
  const [showPassword, setShowPassword] = useState(false);

  // Registration Success Banner State
  const [successMessage, setSuccessMessage] = useState("");

  // Non-blocking error banner (replaces alert() for a cleaner UX)
  const [actionError, setActionError] = useState("");

  // Loading flags for in-flight actions (prevents double-submits, drives the
  // centered ActionOverlay instead of a spinner glued inside the button)
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Track fetch-users error separately so we can show a Retry state
  const [usersError, setUsersError] = useState("");

  // Register Form State
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    empId: "",
    password: "",
    status: "Working",
    checkIn: "10:00 AM",
    hours: "0h 00m",
    isLate: false,
    violations: 0
  });

  const API_URL = (import.meta.env.VITE_API_URL || "https://vrulobreaklist-1.onrender.com//")

  // Ticks every second so "on break" shows a live running countdown and
  // today's violations stay current, without needing a page refresh.
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Shows a temporary error banner instead of a blocking alert()
  const showError = (message) => {
    setActionError(message);
    setTimeout(() => setActionError(""), 4000);
  };

  // Detects whether a raw user record from the API is the admin account,
  // so admin never shows up in the employee table.
  // Adjust the field names below if your backend uses different keys.
  const isAdminRecord = (user) => {
    if (!user) return false;
    const role = (user.role || user.userType || user.type || user.accountType || "")
      .toString()
      .toLowerCase();
    if (role === "admin" || role === "administrator") return true;
    if (user.isAdmin === true || user.admin === true) return true;
    const empId = (user.employeeId || user.empId || "").toString().toLowerCase();
    if (empId === "admin") return true;
    return false;
  };

  // Wraps fetch with a timeout so a hung/slow server doesn't freeze the UI
  const fetchWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timer);
    }
  };

  // Turns a raw error into a friendly, specific message
  const describeError = (error, fallback) => {
    if (error?.name === "AbortError") {
      return "Request timed out. Please check your connection and try again.";
    }
    if (error instanceof TypeError) {
      return "Couldn't reach the server. Check your internet connection or try again shortly.";
    }
    return error?.message || fallback;
  };

  const normalizeUser = (user) => {
  const shifts = Array.isArray(user.shifts) ? user.shifts : [];

  // Local today's date
  const today = todayDateString();

  // ONLY today's shift
  const todayShift = findShiftByDate(shifts, today);

  const workHours = todayShift?.shiftEnd
    ? calculateWorkHours(todayShift.shiftStart, todayShift.shiftEnd)
    : "";

  return {
    ...user,
    id: user._id || user.id,
    name: user.name || "",
    empId: user.employeeId || user.empId || "",

    status: user.status || (todayShift ? "Working" : "Absent"),

    checkIn: todayShift?.shiftStart || "",
    checkOut: todayShift?.shiftEnd || "",

    hours: workHours,

    isLate: Boolean(user.isLate),
    violations: Number(user.violations || 0)
  };
};

  const [employees, setEmployees] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const getUsers = async (silent = false) => {
    try {
      if (!silent) setLoadingUsers(true);
      setUsersError("");

      const response = await fetchWithTimeout(`${API_URL}api/users`, {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        throw new Error("Server sent an invalid response. Please try again.");
      }

      if (!response.ok) {
        throw new Error(data.message || `Failed to fetch users (${response.status})`);
      }

      const users = Array.isArray(data)
        ? data
        : Array.isArray(data.users)
          ? data.users
          : Array.isArray(data.data)
            ? data.data
            : Array.isArray(data.results)
              ? data.results
              : [];

      // Exclude the admin account from the employee list
      const nonAdminUsers = users.filter((u) => !isAdminRecord(u));

      setEmployees(nonAdminUsers.map(normalizeUser));
    } catch (error) {
      console.error("GET USERS ERROR:", error);
      // Silent polling failures should not spam the error banner / table
      if (!silent) {
        setUsersError(describeError(error, "Something went wrong while loading employees."));
      }
    } finally {
      if (!silent) setLoadingUsers(false);
    }
  };

  useEffect(() => {
    getUsers();
  }, []);

  // NEW: Silently re-fetch employees every few seconds so break/shift
  // changes made elsewhere (start shift, start/end break, etc.) show up
  // here automatically without a manual page refresh.
  useEffect(() => {
    const pollInterval = setInterval(() => {
      getUsers(true); // silent = true -> no full-page loader, no error banner spam
    }, 5000);
    return () => clearInterval(pollInterval);
  }, []);

  // Enrich every employee with today's live violation list + break status.
  // Recomputed whenever `now` ticks so the break countdown and "on break"
  // light stay accurate without re-fetching from the server.
  const displayEmployees = useMemo(() => {
    const today = todayDateString(now);
    return employees.map((emp) => {
      const todayShift = findShiftByDate(emp.shifts, today);
      const violationsToday = computeShiftViolations(todayShift, now);
      const breakStatus = getBreakStatus(todayShift, now);
      return {
        ...emp,
        violationsToday,
        hasViolation: violationsToday.length > 0,
        breakStatus
      };
    });
  }, [employees, now]);

  // Dynamic Statistics Calculations
  const totalEmployees = displayEmployees.length;
  const presentCount = displayEmployees.filter((e) => e.status !== "Absent").length;
  const absentCount = displayEmployees.filter((e) => e.status === "Absent").length;
  const totalViolations = displayEmployees.reduce((sum, emp) => sum + emp.violationsToday.length, 0);

  const violationEntries = displayEmployees
    .filter((emp) => emp.hasViolation)
    .map((emp) => ({ name: emp.name, empId: emp.empId, violations: emp.violationsToday }));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const confirmDeleteEmployee = async () => {
    if (!deletingEmployee?.id) return;

    try {
      setIsDeleting(true);

      const response = await fetchWithTimeout(`${API_URL}api/users/delete/${deletingEmployee.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        // some delete endpoints return no body — that's fine
      }

      if (!response.ok) {
        throw new Error(data.message || `Delete failed (${response.status})`);
      }

      setEmployees((prev) => prev.filter((e) => e.id !== deletingEmployee.id));
      setDeletingEmployee(null);
      setSuccessMessage("Employee deleted successfully!");
      setTimeout(() => setSuccessMessage(""), 2000);
    } catch (error) {
      console.error("DELETE USER ERROR:", error);
      showError(describeError(error, "Couldn't delete this employee. Please try again."));
    } finally {
      setIsDeleting(false);
    }
  };

 const handleSaveEdit = async (e) => {
  e.preventDefault();

  if (!editingEmployee?.id) return;

  try {
    setIsSaving(true);

    // Local today's date
    const today = todayDateString();

    // EXACT structure used by Postman
    const payload = {
      name: editingEmployee.name,
      employeeId: editingEmployee.empId,
      shifts: [
        {
          date: today,
          shiftStart: editingEmployee.checkIn || "",
          shiftEnd: editingEmployee.checkOut || ""
        }
      ]
    };

    console.log("UPDATE PAYLOAD:", payload);

    const response = await fetchWithTimeout(
      `${API_URL}api/users/update/${editingEmployee.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    let data = {};
    try {
      data = await response.json();
    } catch {
      throw new Error("Server sent an invalid response. Please try again.");
    }

    console.log("UPDATE RESPONSE:", data);

    if (!response.ok) {
      throw new Error(
        data.message || `Update failed (${response.status})`
      );
    }

    setEditingEmployee(null);

    setSuccessMessage("Employee updated successfully!");

    setTimeout(() => {
      setSuccessMessage("");
    }, 2000);

    // Get fresh data from database
    await getUsers();

  } catch (error) {
    console.error("UPDATE USER ERROR:", error);
    showError(describeError(error, "Couldn't save changes. Please try again."));
  } finally {
    setIsSaving(false);
  }
};

  const handleRegisterEmployee = async (e) => {
    e.preventDefault();

    if (!newEmployee.name.trim() || !newEmployee.empId.trim() || !newEmployee.password) {
      showError("Please fill in name, employee ID and password.");
      return;
    }

    try {
      setIsRegistering(true);

      const payload = {
        name: newEmployee.name.trim(),
        employeeId: newEmployee.empId.trim(),
        password: newEmployee.password
      };

      const response = await fetchWithTimeout(`${API_URL}api/users/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        throw new Error("Server sent an invalid response. Please try again.");
      }

      if (!response.ok) {
        throw new Error(data.message || `Registration failed (${response.status})`);
      }

      const registeredUser = data.user || data.data || data.newUser || data;

      // Backend response agar user object na bhi de, registration ke baad
      // complete fresh list GET karke table ko sync kar denge.
      // Also make sure we never accidentally add the admin account itself.
      if (
        registeredUser &&
        !isAdminRecord(registeredUser) &&
        (registeredUser._id || registeredUser.id)
      ) {
        setEmployees((prev) => [normalizeUser(registeredUser), ...prev]);
      } else {
        await getUsers();
      }

      setNewEmployee({
        name: "",
        empId: "",
        password: "",
        status: "Working",
        checkIn: "10:00 AM",
        hours: "0h 00m",
        isLate: false,
        violations: 0
      });

      setShowPassword(false);
      setIsRegisterModalOpen(false);

      setSuccessMessage(`Successfully registered ${payload.name}!`);
      setTimeout(() => {
        setSuccessMessage("");
      }, 2000);
    } catch (error) {
      console.error("REGISTER USER ERROR:", error);
      showError(describeError(error, "Couldn't register this employee. Please try again."));
    } finally {
      setIsRegistering(false);
    }
  };

  const filteredEmployees = displayEmployees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.empId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Dynamic Pie Chart Calculation
  const pieData = [
    { label: "Present", value: presentCount, color: "#10b981", hoverBg: "rgba(16, 185, 129, 0.2)" },
    { label: "Absent", value: absentCount, color: "#f43f5e", hoverBg: "rgba(244, 63, 94, 0.2)" },
    { label: "Violations", value: totalViolations, color: "#f59e0b", hoverBg: "rgba(245, 158, 11, 0.2)" },
  ];

  const pieTotal = pieData.reduce((acc, curr) => acc + curr.value, 0) || 1;

  let cumulativePercent = 0;
  const pieSlices = pieData.map((slice) => {
    const percent = slice.value / pieTotal;
    const startAngle = cumulativePercent * 360;
    cumulativePercent += percent;
    const endAngle = cumulativePercent * 360;

    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const x1 = 100 + 80 * Math.cos(startRad);
    const y1 = 100 + 80 * Math.sin(startRad);
    const x2 = 100 + 80 * Math.cos(endRad);
    const y2 = 100 + 80 * Math.sin(endRad);

    const largeArcFlag = percent > 0.5 ? 1 : 0;
    const pathData = percent === 1
      ? "M 100 20 A 80 80 0 1 1 99.99 20 Z"
      : `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

    return { ...slice, pathData, percent: Math.round(percent * 100) };
  });

  // Single source of truth for what the ActionOverlay currently shows —
  // whichever action is in-flight wins (only one can be true at a time in
  // normal usage, but this keeps precedence sane if that ever changes).
  const actionOverlayLabel = isDeleting
    ? "Deleting employee..."
    : isSaving
      ? "Saving changes..."
      : isRegistering
        ? "Registering employee..."
        : "";
  const isActionInFlight = isDeleting || isSaving || isRegistering;

  return (
    <div className={`h-screen w-full overflow-y-auto overflow-x-hidden font-sans flex flex-col transition-colors duration-300 ${
      darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
    }`}>
      {darkMode && <StarBackground />}

      {/* NEW: Full-page loader while employees are being fetched (initial load AND retries) */}
      <AnimatePresence>
        {loadingUsers && (
          <FullPageLoader
            darkMode={darkMode}
            label={employees.length === 0 ? "Loading employee data..." : "Refreshing employee data..."}
          />
        )}
      </AnimatePresence>

      {/* NEW: Centered overlay for delete / save / register — replaces the
          old in-button spinner+text swap so nothing feels cramped. */}
      <ActionOverlay show={isActionInFlight} label={actionOverlayLabel} darkMode={darkMode} />

      <Navbar 
        role="Admin" 
        userName="System Admin" 
        darkMode={darkMode} 
        setDarkMode={setDarkMode} 
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6 relative z-10 pb-20">
        
        {/* Success Confirmation Banner */}
        <AnimatePresence>
          {successMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500 text-slate-950 font-extrabold text-xs shadow-xl shadow-emerald-500/20"
            >
              <FaCheckCircle className="text-base shrink-0" />
              <span>{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Non-blocking error banner (replaces alert()) */}
        <AnimatePresence>
          {actionError && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500 text-white font-extrabold text-xs shadow-xl shadow-rose-500/20"
            >
              <FaExclamationTriangle className="text-base shrink-0" />
              <span>{actionError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className={`text-2xl md:text-3xl font-extrabold ${darkMode ? "text-white" : "text-slate-900"}`}>
              <span className={darkMode ? "text-amber-400" : "text-amber-600"}>{getGreeting()}</span>, System Admin!
            </h1>
            <p className={`text-xs mt-1 font-medium ${darkMode ? "text-slate-400" : "text-slate-600"}`}>
              Manage employees, track breaks & review violations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <FaUserPlus /> Register Employee
            </button>

            <div className={`flex items-center gap-2 border rounded-2xl px-4 py-2 text-xs backdrop-blur-md shadow-sm ${
              darkMode ? "bg-slate-900/80 border-slate-800 text-slate-200" : "bg-white border-slate-300 text-slate-900 font-bold"
            }`}>
              <FaCalendarAlt className={darkMode ? "text-amber-400" : "text-amber-600"} />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Stats Grid & Animated Pie Chart Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-5 rounded-3xl border shadow-sm flex flex-col justify-between ${
                darkMode ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-slate-200/50"
              }`}
            >
              <p className={`text-xs font-bold uppercase ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Total Team</p>
              <h2 className={`text-3xl font-extrabold mt-2 ${darkMode ? "text-white" : "text-slate-900"}`}>{totalEmployees}</h2>
              <p className={`text-[11px] mt-2 ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Active employees listed</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`p-5 rounded-3xl border shadow-sm flex flex-col justify-between ${
                darkMode ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-slate-200/50"
              }`}
            >
              <p className={`text-xs font-bold uppercase ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Present Today</p>
              <h2 className="text-3xl font-extrabold mt-2 text-emerald-500">{presentCount}</h2>
              <p className="text-[11px] text-emerald-500/80 mt-2 font-medium">Includes on-time & late entries</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className={`p-5 rounded-3xl border shadow-sm flex flex-col justify-between ${
                darkMode ? "bg-rose-500/10 border-rose-500/30 text-rose-400" : "bg-rose-50 border-rose-200 text-rose-700"
              }`}
            >
              <p className="text-xs font-bold uppercase flex items-center gap-1.5">
                <FaUserMinus /> Absent Today
              </p>
              <h2 className="text-3xl font-extrabold mt-2">{absentCount}</h2>
              <p className="text-[11px] opacity-80 mt-2 font-medium">Not checked in yet</p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => setShowViolationsModal(true)}
              className={`p-5 rounded-3xl border shadow-sm flex flex-col justify-between cursor-pointer transition-transform hover:scale-[1.02] ${
                darkMode ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-700"
              }`}
              title="Click to see who violated a rule today"
            >
              <p className="text-xs font-bold uppercase flex items-center gap-1.5">
                <FaExclamationTriangle /> Total Violations
              </p>
              <h2 className="text-3xl font-extrabold mt-2">{totalViolations} Alerts</h2>
              <p className="text-[11px] opacity-80 mt-2 font-medium">Click to see who & what</p>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className={`p-6 rounded-3xl border shadow-sm flex flex-col items-center justify-between relative ${
              darkMode ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-slate-200/50"
            }`}
          >
            <div className="w-full flex items-center justify-between mb-2">
              <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                <FaChartPie className={darkMode ? "text-amber-400" : "text-amber-600"} /> Attendance Breakdown
              </h3>
              {hoveredSegment && (
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 animate-pulse">
                  {hoveredSegment.label}: {hoveredSegment.value} ({hoveredSegment.percent}%)
                </span>
              )}
            </div>

            <div className="relative w-44 h-44 my-2 flex items-center justify-center">
              <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90 drop-shadow-md">
                {pieSlices.map((slice, index) => (
                  <motion.path
                    key={index}
                    d={slice.pathData}
                    fill={slice.color}
                    initial={{ scale: 0 }}
                    animate={{ scale: hoveredSegment?.label === slice.label ? 1.06 : 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    onMouseEnter={() => setHoveredSegment(slice)}
                    onMouseLeave={() => setHoveredSegment(null)}
                    className="cursor-pointer transition-opacity hover:opacity-90"
                    style={{ transformOrigin: "100px 100px" }}
                  />
                ))}
              </svg>

              <div className={`absolute w-24 h-24 rounded-full flex flex-col items-center justify-center border ${
                darkMode ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
              }`}>
                <span className={`text-lg font-black ${darkMode ? "text-white" : "text-slate-900"}`}>{totalEmployees}</span>
                <span className={`text-[10px] font-bold uppercase ${darkMode ? "text-slate-400" : "text-slate-500"}`}>Total</span>
              </div>
            </div>

            <div className="flex justify-center items-center gap-4 w-full pt-2 border-t border-slate-800/40 text-xs">
              {pieData.map((item, idx) => (
                <div 
                  key={idx}
                  onMouseEnter={() => setHoveredSegment({ ...item, percent: Math.round((item.value / pieTotal) * 100) })}
                  onMouseLeave={() => setHoveredSegment(null)}
                  className={`flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-lg transition-colors ${
                    hoveredSegment?.label === item.label ? "bg-slate-800/60" : ""
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className={`font-semibold ${darkMode ? "text-slate-300" : "text-slate-700"}`}>
                    {item.label}: <strong className="font-extrabold">{item.value}</strong>
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Employee Table Card */}
        <div className={`p-6 rounded-3xl border shadow-sm ${
          darkMode ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-slate-200/50"
        }`}>
          <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
            <div>
              <h2 className={`text-xl font-bold ${darkMode ? "text-white" : "text-slate-900"}`}>
                Employee Directory & Management
              </h2>
              <p className={`text-xs mt-0.5 ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                Highlighted Rows: <span className="text-rose-500 font-bold">Red = Absent</span> | <span className="text-amber-500 font-bold">Orange = Rule Violation</span> &middot; Click a name for their full history
              </p>
            </div>
            <div className="relative">
              <FaSearch className={`absolute left-3.5 top-3 text-xs ${darkMode ? "text-slate-500" : "text-slate-400"}`} />
              <input
                type="text"
                placeholder="Search Employee..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-9 pr-4 py-2 text-xs border rounded-xl focus:outline-none ${
                  darkMode 
                    ? "bg-slate-950 border-slate-800 text-white" 
                    : "bg-slate-50 border-slate-300 text-slate-900 font-semibold"
                }`}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b text-xs uppercase font-extrabold ${
                  darkMode ? "border-slate-800 text-slate-400" : "border-slate-200 text-slate-500"
                }`}>
                  <th className="pb-3 px-3">Employee</th>
                  <th className="pb-3 px-3">Emp ID</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Shift Start Time</th>
                  <th className="pb-3 px-3">Shift End Time</th>
                  <th className="pb-3 px-3">Work Hours</th>
                  <th className="pb-3 px-3">On Break</th>
                  <th className="pb-3 px-3">Violations</th>
                  <th className="pb-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/20 text-sm">
                {loadingUsers ? (
                  // The FullPageLoader already covers this moment — keep the
                  // table area empty/quiet underneath instead of duplicating text.
                  null
                ) : usersError ? (
                  <tr>
                    <td colSpan="9" className="py-10 text-center text-xs">
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-rose-500 font-bold flex items-center gap-2">
                          <FaExclamationTriangle /> {usersError}
                        </span>
                        <button
                          onClick={getUsers}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 cursor-pointer transition-all"
                        >
                          <FaRedo /> Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredEmployees.map((emp) => {
                  const isAbsent = emp.status === "Absent";
                  const isLate = emp.hasViolation || emp.status === "Late";

                  let rowStyle = darkMode ? "hover:bg-slate-800/30" : "hover:bg-slate-50";
                  if (isAbsent) {
                    rowStyle = darkMode 
                      ? "bg-rose-950/40 border-l-4 border-l-rose-500 text-rose-200 hover:bg-rose-950/60" 
                      : "bg-rose-100/70 border-l-4 border-l-rose-500 text-rose-900 hover:bg-rose-100";
                  } else if (isLate) {
                    rowStyle = darkMode 
                      ? "bg-amber-950/30 border-l-4 border-l-amber-500 text-amber-200 hover:bg-amber-950/50" 
                      : "bg-amber-100/60 border-l-4 border-l-amber-500 text-amber-900 hover:bg-amber-100";
                  } else {
                    rowStyle = darkMode
                      ? "bg-emerald-950/20 border-l-4 border-l-emerald-500 text-emerald-100 hover:bg-emerald-950/40"
                      : "bg-emerald-100/50 border-l-4 border-l-emerald-500 text-emerald-900 hover:bg-emerald-100";
                  }

                  return (
                    <tr key={emp.id} className={`transition-colors ${rowStyle}`}>
                      <td className="py-4 px-3 font-bold">
                        <button
                          type="button"
                          onClick={() => setHistoryEmployee(emp)}
                          className={`hover:underline cursor-pointer text-left ${darkMode ? "hover:text-amber-400" : "hover:text-amber-600"}`}
                          title="View monthly history"
                        >
                          {emp.name}
                        </button>
                      </td>
                      <td className={`py-4 px-3 text-xs font-mono ${darkMode ? "text-slate-400" : "text-slate-600 font-semibold"}`}>
                        {emp.empId}
                      </td>
                      <td className="py-4 px-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          isAbsent
                            ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                            : isLate
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className={`py-4 px-3 text-xs font-mono font-bold ${
                        isAbsent ? "text-slate-500" : isLate ? "text-amber-500" : "text-emerald-500"
                      }`}>
                        {emp.checkIn || "—"}
                      </td>
                      <td className={`py-4 px-3 text-xs font-mono font-bold ${
                        emp.checkOut ? (darkMode ? "text-slate-200" : "text-slate-700") : "text-slate-500"
                      }`}>
                        {emp.checkOut || "—"}
                      </td>
                      <td className="py-4 px-3 text-xs font-mono font-medium">{emp.hours || "—"}</td>
                      <td className="py-4 px-3">
                        {emp.breakStatus.onBreak ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-3 h-3 rounded-full shrink-0 animate-pulse ${
                                emp.breakStatus.isOvertime ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                              }`}
                            />
                            <div>
                              <p className="text-xs font-extrabold text-emerald-500">On Break</p>
                              <p className={`text-[11px] font-mono font-bold ${emp.breakStatus.isOvertime ? "text-rose-500" : darkMode ? "text-slate-400" : "text-slate-500"}`}>
                                {emp.breakStatus.isOvertime
                                  ? `+${formatCountdown(emp.breakStatus.remainingSeconds)} over`
                                  : `${formatCountdown(emp.breakStatus.remainingSeconds)} left`}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                            <span className={`text-xs font-semibold ${darkMode ? "text-slate-500" : "text-slate-400"}`}>Not on break</span>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-3">
                        {emp.violationsToday.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setShowViolationsModal(true)}
                            className="px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer hover:bg-rose-500/30"
                          >
                            {emp.violationsToday.length} Alert(s)
                          </button>
                        ) : (
                          <span className={`text-xs ${darkMode ? "text-slate-500" : "text-slate-400"}`}>None</span>
                        )}
                      </td>
                      
                      <td className="py-4 px-3 text-right space-x-2">
                        {/* NEW: chai-cup icon — opens the Break Management modal */}
                        <button
                          onClick={() => setBreakManageEmployee(emp)}
                          className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer"
                          title="Manage Today's Breaks"
                        >
                          <FaMugHot />
                        </button>
                        <button
                          onClick={() => setEditingEmployee(emp)}
                          className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all cursor-pointer"
                          title="Edit Employee & Time"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => setDeletingEmployee(emp)}
                          className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                          title="Delete Employee"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!loadingUsers && !usersError && filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-xs text-slate-500">
                      No employees found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Register New Employee Modal with Secured Password & Eye Icon */}
      <AnimatePresence>
        {isRegisterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
            <motion.form
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={handleRegisterEmployee}
              className={`p-6 rounded-3xl border max-w-md w-full shadow-2xl ${
                darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
              }`}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-extrabold text-lg flex items-center gap-2">
                  <FaUserPlus className={darkMode ? "text-amber-400" : "text-amber-600"} /> Register New Employee
                </h3>
                <button type="button" onClick={() => setIsRegisterModalOpen(false)} className="text-slate-400 hover:text-rose-500 cursor-pointer">
                  <FaTimes />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className={`block mb-1 font-bold ${darkMode ? "text-slate-400" : "text-slate-700"}`}>Employee Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Alex Turner"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-medium ${
                      darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-300 text-slate-900"
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className={`block mb-1 font-bold ${darkMode ? "text-slate-400" : "text-slate-700"}`}>Employee ID</label>
                  <input
                    type="text"
                    placeholder="e.g. EMP111"
                    value={newEmployee.empId}
                    onChange={(e) => setNewEmployee({ ...newEmployee, empId: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-medium ${
                      darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-300 text-slate-900"
                    }`}
                    required
                  />
                </div>

                {/* Secured Password field with Eye Toggle Icon */}
                <div>
                  <label className={`block mb-1 font-bold ${darkMode ? "text-slate-400" : "text-slate-700"}`}>Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter secure password"
                      value={newEmployee.password}
                      onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                      className={`w-full p-2.5 pr-10 rounded-xl border font-mono font-bold ${
                        darkMode ? "bg-slate-950 border-slate-800 text-amber-400" : "bg-slate-50 border-slate-300 text-amber-700"
                      }`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-3 top-3 text-sm focus:outline-none cursor-pointer ${
                        darkMode ? "text-slate-400 hover:text-amber-400" : "text-slate-500 hover:text-amber-600"
                      }`}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  disabled={isRegistering}
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 ${darkMode ? "text-slate-400" : "text-slate-600"}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="flex items-center justify-center min-w-[150px] px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Register & Continue
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Employee Modal */}
      <AnimatePresence>
        {editingEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
            <form
              onSubmit={handleSaveEdit}
              className={`p-6 rounded-3xl border max-w-md w-full shadow-2xl ${
                darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
              }`}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-extrabold text-lg">Edit Employee Details</h3>
                <button type="button" onClick={() => setEditingEmployee(null)} className="text-slate-400 hover:text-rose-500 cursor-pointer">
                  <FaTimes />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className={`block mb-1 font-bold ${darkMode ? "text-slate-400" : "text-slate-700"}`}>Employee Name</label>
                  <input
                    type="text"
                    value={editingEmployee.name}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-medium ${
                      darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-300 text-slate-900"
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className={`block mb-1 font-bold ${darkMode ? "text-slate-400" : "text-slate-700"}`}>Employee ID</label>
                  <input
                    type="text"
                    value={editingEmployee.empId}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, empId: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-medium ${
                      darkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-300 text-slate-900"
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className={`block mb-1 font-bold flex items-center gap-1 ${darkMode ? "text-amber-400" : "text-amber-700"}`}>
                    <FaClock /> Shift Start Time Override (Check-In)
                  </label>
                  <input
                    type="text"
                    value={editingEmployee.checkIn}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, checkIn: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-mono font-bold ${
                      darkMode ? "bg-slate-950 border-amber-500/30 text-amber-400" : "bg-slate-50 border-amber-400 text-slate-900"
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className={`block mb-1 font-bold flex items-center gap-1 ${darkMode ? "text-amber-400" : "text-amber-700"}`}>
                    <FaClock /> Shift End Time Override (Check-Out)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 7:00 PM"
                    value={editingEmployee.checkOut}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, checkOut: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border font-mono font-bold ${
                      darkMode ? "bg-slate-950 border-amber-500/30 text-amber-400" : "bg-slate-50 border-amber-400 text-slate-900"
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  disabled={isSaving}
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 ${darkMode ? "text-slate-400" : "text-slate-600"}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center justify-center min-w-[130px] px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`p-6 rounded-3xl border max-w-sm w-full shadow-2xl ${
                darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
              }`}
            >
              <h3 className="text-lg font-extrabold mb-2 text-rose-500">Delete Employee?</h3>
              <p className={`text-xs mb-6 ${darkMode ? "text-slate-400" : "text-slate-600 font-medium"}`}>
                Are you sure you want to delete <span className="font-bold text-amber-600">{deletingEmployee.name}</span> ({deletingEmployee.empId})? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeletingEmployee(null)}
                  disabled={isDeleting}
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 ${darkMode ? "text-slate-400" : "text-slate-600"}`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteEmployee}
                  disabled={isDeleting}
                  className="flex items-center justify-center min-w-[110px] px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Yes, Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Total Violations Modal */}
      <ViolationsModal
        open={showViolationsModal}
        onClose={() => setShowViolationsModal(false)}
        darkMode={darkMode}
        entries={violationEntries}
      />

      {/* Employee Monthly History Modal */}
      <EmployeeHistoryModal
        open={Boolean(historyEmployee)}
        onClose={() => setHistoryEmployee(null)}
        darkMode={darkMode}
        employee={historyEmployee}
        month={selectedMonth}
      />

      {/* NEW: Break Management Modal — the "chai cup" modal */}
      <BreakManageModal
        open={Boolean(breakManageEmployee)}
        onClose={() => setBreakManageEmployee(null)}
        darkMode={darkMode}
        employee={breakManageEmployee}
        apiUrl={API_URL}
        onUpdated={getUsers}
      />
    </div>
  );
}