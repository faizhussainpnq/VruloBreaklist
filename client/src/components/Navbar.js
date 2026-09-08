import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSignOutAlt, FaMoon, FaSun, FaUserCircle } from 'react-icons/fa';
import Logo from "../assets/PicsartVruloLogo.png";

export default function Navbar({ 
  role = "Employee", 
  userName = "John Smith", 
  darkMode, 
  setDarkMode 
}) {
  const navigate = useNavigate();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleConfirmLogout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <>
      <nav 
        className={`sticky top-0 z-50 w-full backdrop-blur-xl border-b px-6 py-4 flex items-center justify-between shadow-sm transition-all ${
          darkMode ? "bg-slate-900/90 border-slate-800 text-white" : "bg-white/90 border-slate-200 text-slate-900 shadow-slate-200/50"
        }`}
      >
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <img 
            src={Logo} 
            alt="Logo" 
            className="w-16 h-16 transition-transform duration-700 hover:rotate-[360deg]" 
          />
          <span className={`font-extrabold text-lg tracking-wider ${
            darkMode 
              ? "bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent" 
              : "text-amber-600"
          }`}>
            VRULO BREAKLIST
          </span>
        </div>

        {/* User Badge, Theme Toggle & Logout */}
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
            darkMode ? "bg-slate-800/60 border-slate-700 text-slate-200" : "bg-slate-100 border-slate-200 text-slate-800"
          }`}>
            <FaUserCircle className={`text-base ${darkMode ? "text-amber-400" : "text-amber-600"}`} />
            <span>{userName}</span>
            <span className="text-[10px] opacity-60 uppercase bg-amber-400/20 text-amber-500 px-1.5 py-0.5 rounded ml-1">
              {role}
            </span>
          </div>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2.5 rounded-xl border transition-all ${
              darkMode 
                ? "bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700" 
                : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
            }`}
            title="Toggle Theme"
          >
            {darkMode ? <FaSun /> : <FaMoon />}
          </button>

          <button
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
          >
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </nav>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className={`p-6 rounded-3xl border max-w-sm w-full shadow-2xl ${
            darkMode ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-300 text-slate-900"
          }`}>
            <h3 className="text-lg font-extrabold mb-2">Logout Confirmation</h3>
            <p className={`text-xs mb-6 ${darkMode ? "text-slate-400" : "text-slate-600 font-medium"}`}>
              Are you sure you want to logout from VRULO BREAKLIST?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${darkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"}`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLogout}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-lg"
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}