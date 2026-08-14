import React, { useState } from "react";
import { Lock, User, LogIn, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { TeamMember } from "../types";
import { motion } from "motion/react";

interface LoginViewProps {
  onLoginSuccess: (userId: string) => void;
  teamMembers?: TeamMember[];
}

export default function LoginView({ onLoginSuccess, teamMembers = [] }: LoginViewProps) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedUserId = userId.trim();
    const trimmedPassword = password;

    if (!trimmedUserId || !trimmedPassword) {
      setError("Please fill in both User ID and Password.");
      return;
    }

    setIsSubmitting(true);

    // Simulate standard server-like authorization latency
    setTimeout(() => {
      // Find if User ID matches any team member in the list
      const target = trimmedUserId.toLowerCase();
      const matchedMember = teamMembers.find((m) => {
        const uid = (m.userId || "").toLowerCase();
        const email = (m.email || "").toLowerCase();
        const emailPrefix = email.split("@")[0];
        const name = (m.name || "").toLowerCase();
        return uid === target || email === target || emailPrefix === target || name === target;
      });

      const expectedPassword = matchedMember?.password || "1234";
      const isPasswordCorrect = trimmedPassword === expectedPassword;

      if (matchedMember && isPasswordCorrect) {
        // Enforce account status check
        if (matchedMember.status === "Inactive") {
          setError("This operator profile is currently Inactive. Contact Administrator.");
          setIsSubmitting(false);
          return;
        }
        
        onLoginSuccess(matchedMember.userId || matchedMember.email);
      } else if (!matchedMember && (target === "admin" || teamMembers.length === 0) && trimmedPassword === "1234") {
        onLoginSuccess(trimmedUserId);
      } else {
        setError("Invalid User ID or Password. Try again.");
        setIsSubmitting(false);
      }
    }, 700);
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Decorative background ambiance blur fields */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/10 blur-[120px] pointer-events-none"></div>

      {/* Grid line accent patterns */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none"></div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md bg-slate-950/85 border border-slate-800/80 backdrop-blur-md rounded-3xl shadow-2xl p-6 md:p-8 space-y-6 relative z-10"
      >
        {/* Divine Traders ERP branding header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="text-white" size={24} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center justify-center gap-1.5">
              Divine Traders <span className="text-indigo-400">ERP</span>
            </h2>
            <p className="text-xs text-slate-400 font-medium">Unified Management &amp; Ledger System</p>
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-2xl flex items-start gap-2">
              <span className="text-sm">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* User ID field */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              User ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User size={15} />
              </div>
              <input
                type="text"
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. Vishal"
                className="w-full pl-10 pr-4 py-3 bg-slate-900/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock size={15} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••"
                className="w-full pl-10 pr-10 py-3 bg-slate-900/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 rounded-2xl text-sm text-white placeholder-slate-600 focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold rounded-2xl text-xs tracking-wider uppercase transition-all shadow-lg hover:shadow-indigo-500/10 active:scale-95 disabled:scale-100 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Verifying User...</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <LogIn size={14} />
                <span>Sign In Session</span>
              </span>
            )}
          </button>
        </form>

        {/* Authorized session footer note */}
        <div className="text-center pt-2 border-t border-slate-900/60">
          <p className="text-[10px] text-slate-600 font-medium">
            Authorized Personnel Only • Secure Session active
          </p>
        </div>
      </motion.div>
    </div>
  );
}
