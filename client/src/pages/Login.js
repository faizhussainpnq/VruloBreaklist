import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaUser, FaLock, FaEye, FaEyeSlash, FaExclamationTriangle } from "react-icons/fa";
import StarBackground from "../components/StarBackground";
import Logo from "../assets/PicsartVruloLogo.png";

function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loginInput, setLoginInput] = useState(""); // Name or Employee ID
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/";

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    // Optional Static Admin Override
    if (loginInput.toLowerCase() === "admin" && password === "admin123") {
      setLoading(true);
      setTimeout(() => navigate("/admin"), 800);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}api/users/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          loginId: loginInput,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Invalid credentials!");
      }

      // Store user info local storage mein (agar zaroorat ho dashboard par)
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      // Smooth delay before redirecting for luxury loading feel
      setTimeout(() => {
        navigate(data.redirectTo || "/employee");
      }, 800);

    } catch (err) {
      // Enhanced descriptive error handling based on failure type
      let errorMessage = err.message;
      if (err.message === "Failed to fetch" || err.name === "TypeError") {
        errorMessage = "Server is waking up or unavailable. Please check your network connection and try again.";
      }
      setError(errorMessage);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      <StarBackground />

      {/* Expensive Full-Screen Luxury Loader Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 backdrop-blur-xl bg-slate-950/80 flex flex-col items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="relative flex flex-col items-center p-8 rounded-3xl bg-slate-900/40 border border-amber-500/30 shadow-[0_0_80px_rgba(245,158,11,0.25)]"
            >
              <div className="absolute inset-0 rounded-3xl bg-amber-400/10 blur-2xl animate-pulse" />
              
              {/* Spinning Luxury Ring with Logo */}
              <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-400 border-r-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                />
                <img
                  src={Logo}
                  alt="Vrulo Logo"
                  className="w-10 h-10 object-contain relative z-10 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]"
                />
              </div>

              <h2 className="text-xl font-bold text-white tracking-wide mb-1">Authenticating</h2>
              <p className="text-amber-400/80 text-xs tracking-widest uppercase font-medium animate-pulse">
                Please wait, entering workspace...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={shake ? { x: [-12, 12, -8, 8, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md z-10"
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.8, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="bg-slate-900/60 backdrop-blur-2xl border border-amber-500/20 rounded-3xl p-8 shadow-[0_0_50px_rgba(245,158,11,0.15)] relative group"
        >
          {/* Glowing Top Yellow Border */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

          <div className="flex flex-col items-center mb-8">
            <motion.div
              initial={{ scale: 8, z: -800, opacity: 0 }}
              animate={{ scale: 1, z: 0, opacity: 1 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative mb-4"
            >
              <div className="absolute inset-0 rounded-2xl bg-amber-400/20 blur-xl animate-pulse" />
              <img
                src={Logo}
                alt="Vrulo Logo"
                className="w-24 h-24 object-contain relative z-10 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]"
              />
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-3xl font-bold text-white tracking-tight"
            >
              Vrulo Breaklist
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-slate-400 text-sm mt-1"
            >
              Shift Timing & Break Tracker
            </motion.p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-xl mb-5 text-sm flex items-center gap-2 overflow-hidden"
              >
                <FaExclamationTriangle className="shrink-0 text-rose-400" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Name or Employee ID
              </label>
              <div className="relative">
                <FaUser className="absolute left-4 top-4 text-amber-400/60" />
                <input
                  type="text"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  placeholder="Enter Name or ID (e.g. WES152)"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-3.5 pl-11 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <FaLock className="absolute left-4 top-4 text-amber-400/60" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-3.5 pl-11 pr-12 text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-4 text-slate-500 hover:text-amber-400 transition-colors"
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02, boxShadow: "0 0 25px rgba(245,158,11,0.4)" }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              type="submit"
              className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold py-3.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all mt-2 disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Log In"}
            </motion.button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500 border-t border-slate-800/80 pt-4">
            Official Timing: <span className="text-amber-400 font-medium">10:00 AM - 07:00 PM</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default Login;