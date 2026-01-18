'use client';

import { useEffect, useState } from 'react';
import { useBotStore } from '@/store/bot-store';
import { Dashboard, Wallets, Buy, Sell, Settings, LogPanel } from '@/components/bot';
import { TabType } from '@/lib/types';

const tabs: { id: TabType; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'wallets', label: 'Wallets', icon: '💳' },
  { id: 'buy', label: 'Buy', icon: '🟢' },
  { id: 'sell', label: 'Sell', icon: '🔴' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export default function BotPage() {
  const { activeTab, setActiveTab, isLoading, loadingMessage, initServices } = useBotStore();
  const [showMobileLogs, setShowMobileLogs] = useState(false);

  useEffect(() => {
    initServices();
  }, [initServices]);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'wallets':
        return <Wallets />;
      case 'buy':
        return <Buy />;
      case 'sell':
        return <Sell />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-green-400">PumpFun Bot</h1>
          {isLoading && (
            <div className="flex items-center gap-2 text-blue-400">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">{loadingMessage || 'Processing...'}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full">
        {/* Sidebar / Nav */}
        <nav className="bg-gray-900 lg:w-64 border-b lg:border-b-0 lg:border-r border-gray-800">
          <div className="flex lg:flex-col overflow-x-auto lg:overflow-visible">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-left whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-gray-800 text-green-400 border-b-2 lg:border-b-0 lg:border-l-2 border-green-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Content Area */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {renderContent()}
        </main>

        {/* Log Panel (Desktop) */}
        <aside className="hidden xl:block w-80 border-l border-gray-800">
          <LogPanel />
        </aside>
      </div>

      {/* Mobile Log Panel Toggle */}
      <div className="xl:hidden fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setShowMobileLogs(true)}
          className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg border border-gray-700 relative"
        >
          <span className="text-lg">📋</span>
        </button>
      </div>

      {/* Mobile Log Modal */}
      {showMobileLogs && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end xl:hidden">
          <div className="bg-gray-900 w-full h-2/3 rounded-t-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <h3 className="text-white font-semibold">Activity Log</h3>
              <button
                onClick={() => setShowMobileLogs(false)}
                className="text-gray-400 hover:text-white px-2"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <LogPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
