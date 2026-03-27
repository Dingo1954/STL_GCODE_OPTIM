/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import STLTab from './components/STLTab';
import GCodeTab from './components/GCodeTab';
import GuideTab from './components/GuideTab';
import { Box, FileCode2, Settings, BookOpen } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'stl' | 'gcode' | 'guide'>('stl');

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-300 font-sans selection:bg-blue-500/30 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1e293b] border-r border-slate-700 flex flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <Settings className="w-5 h-5 text-blue-500" />
            </div>
            <h1 className="text-sm font-semibold text-slate-100 tracking-tight">3D Print Analyse</h1>
          </div>
        </div>
        
        <nav className="flex-1 py-4 px-3 space-y-1">
          <button
            onClick={() => setActiveTab('stl')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'stl' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Box className="w-4 h-4" />
            STL Optimerer
          </button>
          <button
            onClick={() => setActiveTab('gcode')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'gcode' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            GCODE Analysator
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'guide' 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Vejledning
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#0f172a]">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-700 bg-[#0f172a] flex items-center px-6 shrink-0">
          <h2 className="text-lg font-medium text-slate-100">
            {activeTab === 'stl' && 'STL Optimerer'}
            {activeTab === 'gcode' && 'GCODE Analysator'}
            {activeTab === 'guide' && 'Vejledning'}
          </h2>
        </header>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="max-w-7xl mx-auto h-full">
            {activeTab === 'stl' && <STLTab />}
            {activeTab === 'gcode' && <div className="h-full overflow-y-auto custom-scrollbar pr-2"><GCodeTab /></div>}
            {activeTab === 'guide' && <div className="h-full overflow-y-auto custom-scrollbar pr-2"><GuideTab /></div>}
          </div>
        </div>
      </main>
    </div>
  );
}
