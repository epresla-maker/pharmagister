"use client";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MaintenancePage() {
  const router = useRouter();
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [error, setError] = useState("");

  // Titkos admin belépési kód
  const SECRET_CODE = "pharma2026admin";

  const handleAdminAccess = () => {
    if (adminCode === SECRET_CODE) {
      // Cookie beállítása a bypass-hoz
      document.cookie = "maintenance_bypass=true; path=/; max-age=86400";
      router.push("/login");
    } else {
      setError("Hibás kód!");
      setTimeout(() => setError(""), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 flex items-center justify-center p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" style={{ animationDelay: "1s" }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse" style={{ animationDelay: "2s" }}></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 max-w-2xl w-full"
      >
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 md:p-12 shadow-2xl border border-white/20">
          {/* Logo / Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
              Pharmagister
            </h1>
          </motion.div>

          {/* Maintenance message */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 bg-yellow-500/20 text-yellow-300 px-4 py-2 rounded-full mb-6">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="font-medium">Karbantartás alatt</span>
            </div>

            <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4">
              🔧 Fejlesztés folyamatban
            </h2>

            <p className="text-lg text-gray-300 mb-6 leading-relaxed">
              A <span className="text-purple-300 font-semibold">Pharmagister</span> platform jelenleg 
              karbantartás alatt áll. Dolgozunk azon, hogy egy <span className="text-indigo-300 font-semibold">teljesen megújult</span>, 
              gyorsabb és modernebb élményt nyújthassunk Önnek.
            </p>

            <div className="bg-white/5 rounded-2xl p-6 mb-8">
              <p className="text-gray-400 text-sm mb-2">Várható befejezés</p>
              <div className="flex items-center justify-center gap-4">
                <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl px-6 py-4">
                  <span className="text-4xl font-bold text-white">2026</span>
                </div>
                <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl px-6 py-4">
                  <span className="text-4xl font-bold text-white">02</span>
                </div>
                <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl px-6 py-4">
                  <span className="text-4xl font-bold text-white">03</span>
                </div>
              </div>

            </div>

            <div className="space-y-3 text-gray-300">
              <p className="flex items-center justify-center gap-2">
                <span className="text-green-400">✓</span>
                Új, modern felhasználói felület
              </p>
              <p className="flex items-center justify-center gap-2">
                <span className="text-green-400">✓</span>
                Gyorsabb és megbízhatóbb működés
              </p>
              <p className="flex items-center justify-center gap-2">
                <span className="text-green-400">✓</span>
                Mobilbarát PWA alkalmazás
              </p>
            </div>

            <p className="text-gray-400 mt-8 text-sm">
              Köszönjük türelmét!
            </p>
          </motion.div>

          {/* Hidden admin access */}
          <div className="mt-8 pt-6 border-t border-white/10">
            {!showAdminLogin ? (
              <button
                onClick={() => setShowAdminLogin(true)}
                className="text-gray-500 text-xs hover:text-gray-400 transition-colors"
              >
                Admin hozzáférés
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-3"
              >
                <input
                  type="password"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  placeholder="Admin kód"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  onKeyDown={(e) => e.key === "Enter" && handleAdminAccess()}
                />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button
                  onClick={handleAdminAccess}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 rounded-lg transition-colors"
                >
                  Belépés
                </button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          © 2026 Pharmagister - Minden jog fenntartva
        </p>
      </motion.div>
    </div>
  );
}
