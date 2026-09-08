import React, { useState, useEffect } from 'react';
import { FaCoffee, FaExclamationTriangle, FaUndo } from 'react-icons/fa';

export default function BreakTimer() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [restrictionMsg, setRestrictionMsg] = useState('Break is restricted in the first 1 hour of shift (60m remaining)');

  // Sound Alert Function (Web Audio API)
  const playSiren = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, audioCtx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.log('Audio error:', e);
    }
  };

  // Timer Countdown Logic
  useEffect(() => {
    let interval = null;
    if (isTimerActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          // Play siren/beep in the last 60 seconds
          if (prev <= 60 && prev > 1) {
            playSiren();
          }
          return prev - 1;
        });
      }, 1000);
    } else if (secondsLeft === 0 && isTimerActive) {
      setIsTimerActive(false);
      setRestrictionMsg('Next break available after 1 hour (60m remaining)');
    }
    return () => clearInterval(interval);
  }, [isTimerActive, secondsLeft]);

  // Start 15 Min Break
  const startBreak = () => {
    setSecondsLeft(15 * 60); // 15 Min = 900 Sec
    setIsTimerActive(true);
    setRestrictionMsg('Break in progress...');
  };

  // Reset Timer
  const resetTimer = () => {
    setIsTimerActive(false);
    setSecondsLeft(0);
    setRestrictionMsg('Break is restricted in the first 1 hour of shift (60m remaining)');
  };

  // Format Seconds to MM:SS
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-xl max-w-2xl mx-auto text-center">
      <h3 className="text-xl font-bold text-white mb-2 flex items-center justify-center gap-2">
        <FaCoffee className="text-amber-400" /> Break Control Panel
      </h3>
      
      <p className="text-slate-400 text-sm mb-6 flex items-center justify-center gap-2">
        <FaExclamationTriangle className="text-amber-400" />
        {restrictionMsg}
      </p>

      {/* Timer Display */}
      <div className={`text-6xl font-mono font-bold my-6 tracking-wider transition-all ${
        secondsLeft <= 60 && isTimerActive 
          ? 'text-rose-500 animate-pulse scale-105' 
          : 'text-amber-400'
      }`}>
        {formatTime(secondsLeft)}
      </div>

      {/* Buttons Container */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={startBreak}
          disabled={isTimerActive}
          className={`w-full max-w-xs py-3 rounded-xl font-semibold text-sm transition-all shadow-lg ${
            isTimerActive
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
          }`}
        >
          {isTimerActive ? 'Break in Progress...' : 'Take Break (15m)'}
        </button>

        {isTimerActive && (
          <button
            onClick={resetTimer}
            className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700"
            title="Reset Timer"
          >
            <FaUndo />
          </button>
        )}
      </div>
    </div>
  );
}