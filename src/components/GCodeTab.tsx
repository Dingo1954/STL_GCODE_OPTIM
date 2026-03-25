import React, { useState } from 'react';
import { Upload, AlertTriangle, Clock, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { parseGCode, LayerStat } from '../utils/gcodeParser';

export default function GCodeTab() {
  const [layers, setLayers] = useState<LayerStat[]>([]);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({ totalTime: 0, maxSpeed: 0, warnings: 0 });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    
    try {
      const parsedLayers = await parseGCode(file, setProgress);
      setLayers(parsedLayers);
      
      let totalTime = 0;
      let maxSpeed = 0;
      let warnings = 0;
      
      parsedLayers.forEach(l => {
        totalTime += l.time;
        if (l.maxSpeed > maxSpeed) maxSpeed = l.maxSpeed;
        if (l.time < 10 && l.time > 0) warnings++; // Layer time < 10s warning
      });
      
      setStats({ totalTime, maxSpeed, warnings });
    } catch (error) {
      console.error("Error parsing GCODE:", error);
      alert("Kunne ikke læse GCODE filen.");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}t ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header & Upload */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="w-full md:w-80 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">GCODE Analysator</h2>
          <p className="text-zinc-400 text-sm mb-6">
            Find svage punkter, hastighedsfejl og køleproblemer før du printer.
          </p>
          
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-zinc-700 border-dashed rounded-xl cursor-pointer bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-8 h-8 mb-3 text-zinc-400" />
              <p className="mb-2 text-sm text-zinc-400"><span className="font-semibold">Upload .gcode</span></p>
            </div>
            <input type="file" accept=".gcode" className="hidden" onChange={handleFileUpload} disabled={isProcessing} />
          </label>

          {isProcessing && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Analyserer...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Overview */}
        {layers.length > 0 && (
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col justify-center">
              <div className="flex items-center gap-3 text-zinc-400 mb-2">
                <Clock className="w-5 h-5" />
                <span className="text-sm font-medium">Estimeret Tid</span>
              </div>
              <div className="text-3xl font-mono text-zinc-100">{formatTime(stats.totalTime)}</div>
            </div>
            
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col justify-center">
              <div className="flex items-center gap-3 text-zinc-400 mb-2">
                <Zap className="w-5 h-5" />
                <span className="text-sm font-medium">Max Hastighed</span>
              </div>
              <div className="text-3xl font-mono text-zinc-100">{Math.round(stats.maxSpeed)} <span className="text-lg text-zinc-500">mm/s</span></div>
            </div>

            <div className={`border rounded-xl p-6 flex flex-col justify-center ${stats.warnings > 0 ? 'bg-amber-950/20 border-amber-900/50' : 'bg-zinc-900 border-zinc-800'}`}>
              <div className={`flex items-center gap-3 mb-2 ${stats.warnings > 0 ? 'text-amber-500' : 'text-zinc-400'}`}>
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm font-medium">Køle-advarsler</span>
              </div>
              <div className={`text-3xl font-mono ${stats.warnings > 0 ? 'text-amber-400' : 'text-zinc-100'}`}>
                {stats.warnings} <span className="text-lg opacity-50">lag &lt; 10s</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      {layers.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-[400px]">
          {/* Layer Time Chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
            <h3 className="text-zinc-100 font-medium mb-1">Lag-tid (Layer Time)</h3>
            <p className="text-xs text-zinc-500 mb-6">Tid brugt per lag. Dykkende kurver under 10s kan smelte toppen.</p>
            <div className="flex-1 w-full min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={layers} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="layerNum" stroke="#52525b" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <YAxis stroke="#52525b" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                    itemStyle={{ color: '#10b981' }}
                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                    formatter={(value: number) => [`${value.toFixed(1)}s`, 'Tid']}
                    labelFormatter={(label) => `Lag ${label}`}
                  />
                  <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Køle-grænse (10s)', fill: '#f59e0b', fontSize: 10 }} />
                  <Line type="monotone" dataKey="time" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Speed Chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
            <h3 className="text-zinc-100 font-medium mb-1">Hastighed (Speed)</h3>
            <p className="text-xs text-zinc-500 mb-6">Gennemsnitlig og maksimal hastighed per lag.</p>
            <div className="flex-1 w-full min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={layers} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="layerNum" stroke="#52525b" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <YAxis stroke="#52525b" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                    formatter={(value: number, name: string) => [`${value.toFixed(0)} mm/s`, name === 'maxSpeed' ? 'Max Hastighed' : 'Gns. Hastighed']}
                    labelFormatter={(label) => `Lag ${label}`}
                  />
                  <Line type="monotone" dataKey="maxSpeed" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="avgSpeed" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
