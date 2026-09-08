import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaDownload, FaUserClock } from "react-icons/fa";
import { buildMonthHistory } from "../utils/ShiftUtils";

// employee: the raw employee object (must include `.shifts`)
export default function EmployeeHistoryModal({ open, onClose, darkMode, employee, month }) {
  const rows = useMemo(() => {
    if (!employee) return [];
    return buildMonthHistory(employee.shifts, month);
  }, [employee, month]);

  const handleDownload = () => {
    if (!employee) return;

    const header = ["Date", "Status", "Shift Start", "Shift End", "Work Hours", "Violations"];
    const lines = rows.map((r) => [
      r.date,
      r.status,
      r.shiftStart,
      r.shiftEnd,
      r.workHours,
      r.violations.map((v) => `${v.type} (${v.detail})`).join(" | ")
    ]);

    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${employee.name.replace(/\s+/g, "_")}_${employee.empId}_${month}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      {open && employee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`p-6 rounded-3xl border max-w-3xl w-full shadow-2xl max-h-[85vh] overflow-y-auto ${
              darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-extrabold text-lg flex items-center gap-2">
                <FaUserClock className={darkMode ? "text-amber-400" : "text-amber-600"} />
                {employee.name}'s Monthly History
              </h3>
              <button onClick={onClose} className="text-slate-400 hover:text-rose-500 cursor-pointer">
                <FaTimes />
              </button>
            </div>
            <p className={`text-xs mb-4 font-mono ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
              {employee.empId} &middot; {month}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className={`border-b text-xs uppercase font-extrabold ${
                    darkMode ? "border-slate-800 text-slate-400" : "border-slate-200 text-slate-500"
                  }`}>
                    <th className="pb-2 px-2">Date</th>
                    <th className="pb-2 px-2">Status</th>
                    <th className="pb-2 px-2">Shift Start</th>
                    <th className="pb-2 px-2">Shift End</th>
                    <th className="pb-2 px-2">Work Hours</th>
                    <th className="pb-2 px-2">Violations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/20 text-xs">
                  {rows.map((r) => {
                    const isAbsent = r.status === "Absent";
                    const hasViolation = r.violations.length > 0;
                    let rowStyle = "";
                    if (isAbsent) {
                      rowStyle = darkMode ? "bg-rose-950/30 text-rose-200" : "bg-rose-50 text-rose-800";
                    } else if (hasViolation) {
                      rowStyle = darkMode ? "bg-amber-950/20 text-amber-200" : "bg-amber-50 text-amber-800";
                    }
                    return (
                      <tr key={r.date} className={rowStyle}>
                        <td className="py-2 px-2 font-mono">{r.date}</td>
                        <td className="py-2 px-2 font-bold">{r.status}</td>
                        <td className="py-2 px-2 font-mono">{r.shiftStart || "—"}</td>
                        <td className="py-2 px-2 font-mono">{r.shiftEnd || "—"}</td>
                        <td className="py-2 px-2 font-mono">{r.workHours || "—"}</td>
                        <td className="py-2 px-2">
                          {hasViolation ? (
                            <span className="font-bold text-amber-500">
                              {r.violations.map((v) => v.type).join(", ")}
                            </span>
                          ) : (
                            <span className={darkMode ? "text-slate-500" : "text-slate-400"}>None</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-6 text-center text-slate-500">
                        No shift records for this month.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-all shadow-lg cursor-pointer"
              >
                <FaDownload /> Download CSV
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
