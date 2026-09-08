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
  FaCheckCircle
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
  formatCountdown
} from "../utils/ShiftUtils";

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

  // Password visibility state for Register Modal
  const [showPassword, setShowPassword] = useState(false);

  // Registration Success Banner State
  const [successMessage, setSuccessMessage] = useState("");

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

  const API_URL = (import.meta.env.VITE_API_URL || "https://vrulobreaklist-1.onrender.com/")

  // Ticks every second so "on break" shows a live running countdown and
  // today's violations stay current, without needing a page refresh.
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

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

  const getUsers = async () => {
    try {
      setLoadingUsers(true);

      const response = await fetch(`${API_URL}api/users`, {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      const data = await response.json().catch(() => ({}));

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

      setEmployees(users.map(normalizeUser));
    } catch (error) {
      console.error("GET USERS ERROR:", error);
      alert(`Users fetch error: ${error.message}`);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    getUsers();
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
      const response = await fetch(`${API_URL}api/users/delete/${deletingEmployee.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `Delete failed (${response.status})`);
      }

      setEmployees((prev) => prev.filter((e) => e.id !== deletingEmployee.id));
      setDeletingEmployee(null);
      setSuccessMessage("Employee deleted successfully!");
      setTimeout(() => setSuccessMessage(""), 2000);
    } catch (error) {
      console.error("DELETE USER ERROR:", error);
      alert(`Delete error: ${error.message}`);
    }
  };

 const handleSaveEdit = async (e) => {
  e.preventDefault();

  if (!editingEmployee?.id) return;

  try {
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

    const response = await fetch(
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

    const data = await response.json().catch(() => ({}));

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
    alert(`Update error: ${error.message}`);
  }
};

  const handleRegisterEmployee = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        name: newEmployee.name.trim(),
        employeeId: newEmployee.empId.trim(),
        password: newEmployee.password
      };

      const response = await fetch(`${API_URL}api/users/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `Registration failed (${response.status})`);
      }

      const registeredUser = data.user || data.data || data.newUser || data;

      // Backend response agar user object na bhi de, registration ke baad
      // complete fresh list GET karke table ko sync kar denge.
      if (registeredUser && (registeredUser._id || registeredUser.id)) {
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
      alert(`Registration error: ${error.message}`);
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

  return (
    <div className={`h-screen w-full overflow-y-auto overflow-x-hidden font-sans flex flex-col transition-colors duration-300 ${
      darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
    }`}>
      {darkMode && <StarBackground />}

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
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-xs text-slate-500">
                      Loading employees...
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
                {!loadingUsers && filteredEmployees.length === 0 && (
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
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${darkMode ? "text-slate-400" : "text-slate-600"}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-all shadow-lg cursor-pointer"
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
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${darkMode ? "text-slate-400" : "text-slate-600"}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-all shadow-lg cursor-pointer"
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
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${darkMode ? "text-slate-400" : "text-slate-600"}`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteEmployee}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-lg cursor-pointer"
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
    </div>
  );
}
