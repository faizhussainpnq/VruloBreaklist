import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTimes, FaExclamationTriangle } from "react-icons/fa";

// entries: [{ name, empId, violations: [{ type, detail }] }]
export default function ViolationsModal({ open, onClose, darkMode, entries }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`p-6 rounded-3xl border max-w-lg w-full shadow-2xl max-h-[80vh] overflow-y-auto ${
              darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-extrabold text-lg flex items-center gap-2 text-amber-500">
                <FaExclamationTriangle /> Today's Rule Violations
              </h3>
              <button onClick={onClose} className="text-slate-400 hover:text-rose-500 cursor-pointer">
                <FaTimes />
              </button>
            </div>

            {entries.length === 0 ? (
              <p className={`text-xs ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                No violations today. Everyone is on track.
              </p>
            ) : (
              <div className="space-y-3">
                {entries.map((emp) => (
                  <div
                    key={emp.empId}
                    className={`p-4 rounded-2xl border ${
                      darkMode ? "bg-amber-500/10 border-amber-500/30" : "bg-amber-50 border-amber-200"
                    }`}
                  >
                    <p className={`text-sm font-extrabold ${darkMode ? "text-white" : "text-slate-900"}`}>
                      {emp.name}{" "}
                      <span className={`text-xs font-mono font-normal ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                        ({emp.empId})
                      </span>
                    </p>
                    <ul className="mt-2 space-y-1">
                      {emp.violations.map((v, idx) => (
                        <li key={idx} className="text-xs flex gap-2">
                          <span className="font-bold text-amber-500 shrink-0">{v.type}:</span>
                          <span className={darkMode ? "text-slate-300" : "text-slate-700"}>{v.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
