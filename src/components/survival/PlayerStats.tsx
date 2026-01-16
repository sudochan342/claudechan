'use client';

import { motion } from 'framer-motion';
import { useSurvivalStore } from '@/store/survival';

interface StatBarProps {
  label: string;
  value: number;
  icon: string;
  gradient: string;
  bgColor: string;
}

function StatBar({ label, value, icon, gradient, bgColor }: StatBarProps) {
  const isCritical = value < 25;
  const isLow = value < 50;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="font-bold text-gray-700">{label}</span>
        </div>
        <motion.span
          className={`font-black text-lg ${isCritical ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-emerald-600'}`}
          animate={isCritical ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.5, repeat: isCritical ? Infinity : 0 }}
        >
          {Math.round(value)}%
        </motion.span>
      </div>
      <div className={`h-4 rounded-full overflow-hidden ${bgColor} shadow-inner`}>
        <motion.div
          className={`h-full rounded-full ${gradient} ${isCritical ? 'animate-pulse' : ''}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}
        />
      </div>
    </div>
  );
}

export function PlayerStats() {
  const { playerStats, inventory, worldState } = useSurvivalStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/95 backdrop-blur-xl rounded-3xl border-4 border-white/50 shadow-2xl shadow-emerald-500/20 p-5 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <motion.div
              className="text-5xl"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              🧑
            </motion.div>
            <motion.div
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-lg ${
                playerStats.health > 50 ? 'bg-emerald-500' : playerStats.health > 25 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </div>
          <div>
            <h3 className="text-xl font-black bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
              CLAUDE
            </h3>
            <p className="text-sm font-semibold text-gray-500">Day {worldState.daysSurvived + 1} Survivor</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status</div>
          <div className={`font-black text-lg ${
            playerStats.health > 50 ? 'text-emerald-500' : playerStats.health > 25 ? 'text-amber-500' : 'text-red-500'
          }`}>
            {playerStats.health > 75 ? '💪 Healthy' :
              playerStats.health > 50 ? '😓 Tired' :
                playerStats.health > 25 ? '🤕 Hurt' : '💀 Critical'}
          </div>
        </div>
      </div>

      {/* Stat Bars */}
      <div className="space-y-4">
        <StatBar
          label="Health"
          value={playerStats.health}
          icon="❤️"
          gradient="bg-gradient-to-r from-red-500 via-rose-500 to-pink-500"
          bgColor="bg-red-100"
        />
        <StatBar
          label="Hunger"
          value={playerStats.hunger}
          icon="🍖"
          gradient="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500"
          bgColor="bg-orange-100"
        />
        <StatBar
          label="Thirst"
          value={playerStats.thirst}
          icon="💧"
          gradient="bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500"
          bgColor="bg-blue-100"
        />
        <StatBar
          label="Energy"
          value={playerStats.energy}
          icon="⚡"
          gradient="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400"
          bgColor="bg-yellow-100"
        />
        <StatBar
          label="Morale"
          value={playerStats.morale}
          icon="🧠"
          gradient="bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500"
          bgColor="bg-purple-100"
        />
      </div>

      {/* Inventory */}
      <div className="pt-4 border-t-2 border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-gray-700 flex items-center gap-2">
            <span>🎒</span> Inventory
          </h4>
          <span className="px-3 py-1 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-full text-xs font-bold text-emerald-700">
            {inventory.length} items
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {inventory.length > 0 ? (
            inventory.map((item) => (
              <motion.div
                key={item.id}
                className="flex items-center gap-2 bg-gradient-to-r from-gray-50 to-gray-100 px-3 py-2 rounded-xl border-2 border-gray-200 shadow-sm"
                whileHover={{ scale: 1.05, y: -2 }}
                title={item.name}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm font-bold text-gray-700">x{item.quantity}</span>
              </motion.div>
            ))
          ) : (
            <div className="w-full text-center py-4">
              <span className="text-gray-400 italic">🎒 Empty backpack...</span>
            </div>
          )}
        </div>
      </div>

      {/* Warnings */}
      {(playerStats.health < 30 || playerStats.hunger < 30 || playerStats.thirst < 30 || playerStats.energy < 30) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-4 shadow-lg shadow-red-500/30"
        >
          <div className="flex items-center gap-3 text-white">
            <motion.span
              className="text-3xl"
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              ⚠️
            </motion.span>
            <div>
              <div className="font-black text-lg">DANGER!</div>
              <div className="text-sm font-medium opacity-90">
                {playerStats.health < 30 && 'CRITICAL HEALTH! '}
                {playerStats.hunger < 30 && 'STARVING! '}
                {playerStats.thirst < 30 && 'DEHYDRATED! '}
                {playerStats.energy < 30 && 'EXHAUSTED! '}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
