'use client';

import { motion } from 'framer-motion';
import { useSurvivalStore } from '@/store/survival';

interface StatBarProps {
  label: string;
  value: number;
  icon: string;
  color: string;
  bgColor: string;
}

function StatBar({ label, value, icon, color, bgColor }: StatBarProps) {
  const isCritical = value < 25;
  const isLow = value < 50;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="text-gray-300">{label}</span>
        </div>
        <motion.span
          className={`font-mono font-bold ${isCritical ? 'text-red-400' : isLow ? 'text-yellow-400' : 'text-white'}`}
          animate={isCritical ? { opacity: [1, 0.5, 1] } : {}}
          transition={{ duration: 0.5, repeat: isCritical ? Infinity : 0 }}
        >
          {Math.round(value)}%
        </motion.span>
      </div>
      <div className={`h-3 rounded-full overflow-hidden ${bgColor}`}>
        <motion.div
          className={`h-full rounded-full ${color} ${isCritical ? 'animate-pulse' : ''}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export function PlayerStats() {
  const { playerStats, inventory, worldState } = useSurvivalStore();

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="text-3xl">🧑</span>
            <motion.div
              className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full ${playerStats.health > 50 ? 'bg-green-500' : playerStats.health > 25 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
              animate={{
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
              }}
            />
          </div>
          <div>
            <h3 className="text-white font-bold">CLAUDE</h3>
            <p className="text-xs text-gray-400">Day {worldState.daysSurvived + 1} Survivor</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Status</div>
          <div className={`font-medium ${playerStats.health > 50 ? 'text-green-400' : playerStats.health > 25 ? 'text-yellow-400' : 'text-red-400'
            }`}>
            {playerStats.health > 75 ? 'Healthy' :
              playerStats.health > 50 ? 'Tired' :
                playerStats.health > 25 ? 'Wounded' : 'Critical'}
          </div>
        </div>
      </div>

      {/* Stat Bars */}
      <div className="space-y-3">
        <StatBar
          label="Health"
          value={playerStats.health}
          icon="❤️"
          color="bg-gradient-to-r from-red-600 to-red-400"
          bgColor="bg-red-950/50"
        />
        <StatBar
          label="Hunger"
          value={playerStats.hunger}
          icon="🍖"
          color="bg-gradient-to-r from-orange-600 to-orange-400"
          bgColor="bg-orange-950/50"
        />
        <StatBar
          label="Thirst"
          value={playerStats.thirst}
          icon="💧"
          color="bg-gradient-to-r from-blue-600 to-blue-400"
          bgColor="bg-blue-950/50"
        />
        <StatBar
          label="Energy"
          value={playerStats.energy}
          icon="⚡"
          color="bg-gradient-to-r from-yellow-600 to-yellow-400"
          bgColor="bg-yellow-950/50"
        />
        <StatBar
          label="Morale"
          value={playerStats.morale}
          icon="🧠"
          color="bg-gradient-to-r from-purple-600 to-purple-400"
          bgColor="bg-purple-950/50"
        />
      </div>

      {/* Inventory */}
      <div className="pt-2 border-t border-gray-700/50">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm text-gray-400 font-medium">Inventory</h4>
          <span className="text-xs text-gray-500">{inventory.length} items</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {inventory.length > 0 ? (
            inventory.map((item) => (
              <motion.div
                key={item.id}
                className="flex items-center gap-1 bg-gray-800/80 px-2 py-1 rounded-lg border border-gray-600/50"
                whileHover={{ scale: 1.05 }}
                title={item.name}
              >
                <span>{item.icon}</span>
                <span className="text-xs text-gray-300">x{item.quantity}</span>
              </motion.div>
            ))
          ) : (
            <span className="text-xs text-gray-500 italic">Empty...</span>
          )}
        </div>
      </div>

      {/* Quick status warnings */}
      {(playerStats.health < 30 || playerStats.hunger < 30 || playerStats.thirst < 30 || playerStats.energy < 30) && (
        <motion.div
          className="bg-red-900/30 border border-red-500/50 rounded-lg p-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex items-center gap-2 text-red-400">
            <span className="text-lg">⚠️</span>
            <span className="text-sm font-medium">
              {playerStats.health < 30 && 'CRITICAL HEALTH! '}
              {playerStats.hunger < 30 && 'STARVING! '}
              {playerStats.thirst < 30 && 'DEHYDRATED! '}
              {playerStats.energy < 30 && 'EXHAUSTED! '}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
