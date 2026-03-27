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
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans selection:bg-emerald-500/30">
      {/* Top Navigation */}
      <header className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <Settings className="w-5 h-5 text-emerald-500" />
            </div>
            <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">3D Print Optimerer</h1>
          </div>
          
          <div className="flex gap-2 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
            <button
              onClick={() => setActiveTab('stl')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === 'stl' 
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <Box className="w-4 h-4" />
              STL Optimerer
            </button>
            <button
              onClick={() => setActiveTab('gcode')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === 'gcode' 
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <FileCode2 className="w-4 h-4" />
              GCODE Analysator
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === 'guide' 
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm' 
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Vejledning
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 h-[calc(100vh-4rem)]">
        {activeTab === 'stl' && <STLTab />}
        {activeTab === 'gcode' && <div className="h-full overflow-y-auto custom-scrollbar pr-2"><GCodeTab /></div>}
        {activeTab === 'guide' && <div className="h-full overflow-y-auto custom-scrollbar pr-2"><GuideTab /></div>}
      </main>
    </div>
  );
}
