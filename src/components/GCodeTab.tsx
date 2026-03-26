import React, { useState } from 'react';
import { Upload, AlertTriangle, Clock, Zap, Wind, CornerUpRight, Download, FileJson, Ruler, Move, Box, Loader2, File } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area, ComposedChart, Bar, Legend } from 'recharts';
import { parseGCode, LayerStat, optimizeGCode } from '../utils/gcodeParser';

interface GCodeStats {
  totalTime: number;
  maxSpeed: number;
  avgSpeed: number;
  layerCount: number;
  maxFlow: number;
  coolingWarnings: number;
  cornerWarnings: number;
  totalFilament: number;
  totalPrintTime: number;
  totalTravelTime: number;
  layerHeightConsistency: number; // Standard deviation of layer heights
}

export default function GCodeTab() {
  const [layers, setLayers] = useState<LayerStat[]>([]);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<GCodeStats>({ 
    totalTime: 0, maxSpeed: 0, avgSpeed: 0, layerCount: 0, maxFlow: 0, 
    coolingWarnings: 0, cornerWarnings: 0, totalFilament: 0, totalPrintTime: 0, 
    totalTravelTime: 0, layerHeightConsistency: 0 
  });
  const [fileName, setFileName] = useState<string>('');
  const [visibleLayersCount, setVisibleLayersCount] = useState(100);
  const [error, setError] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const validateGCodeFile = async (file: File): Promise<boolean> => {
    // Læs de første 256KB af filen for at validere
    const slice = file.slice(0, 256 * 1024);
    const text = await slice.text();
    
    // Tjek for almindelige GCODE kommandoer (G0, G1, G2, G3, M104, M109, M140, M190, etc.)
    const gcodeRegex = /^(G[0-3]|G28|G9[01]|M10[4679]|M140|M190|M8[23])/m;
    return gcodeRegex.test(text);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);
    setOriginalFile(file);
    setIsProcessing(true);
    setProgress(0);
    
    try {
      const isValid = await validateGCodeFile(file);
      if (!isValid) {
        setError("Den uploadede fil ser ikke ud til at være en gyldig GCODE fil. Filen mangler almindelige GCODE kommandoer.");
        setIsProcessing(false);
        return;
      }

      const parsedLayers = await parseGCode(file, setProgress);
      setLayers(parsedLayers);
      setVisibleLayersCount(100);
      
      let totalTime = 0;
      let maxSpeed = 0;
      let totalSpeed = 0;
      let maxFlow = 0;
      let coolingWarnings = 0;
      let cornerWarnings = 0;
      let totalFilament = 0;
      let totalPrintTime = 0;
      let totalTravelTime = 0;
      
      const layerHeights: number[] = [];

      parsedLayers.forEach(l => {
        totalTime += l.time;
        totalPrintTime += l.printTime;
        totalTravelTime += l.travelTime;
        totalFilament += l.filamentUsed;
        
        if (l.maxSpeed > maxSpeed) maxSpeed = l.maxSpeed;
        totalSpeed += l.avgSpeed;
        if (l.flow > maxFlow) maxFlow = l.flow;
        if (l.coolingWarning) coolingWarnings++;
        if (l.sharpCornerHighSpeedCount > 10) cornerWarnings++; // Arbitrary threshold for a "bad" layer
        
        if (l.layerHeight > 0 && l.layerHeight < 1) { // Filter out weird anomalous layer heights
            layerHeights.push(l.layerHeight);
        }
      });
      
      // Calculate standard deviation of layer heights
      let layerHeightConsistency = 0;
      if (layerHeights.length > 0) {
          const meanHeight = layerHeights.reduce((a, b) => a + b, 0) / layerHeights.length;
          const variance = layerHeights.reduce((a, b) => a + Math.pow(b - meanHeight, 2), 0) / layerHeights.length;
          layerHeightConsistency = Math.sqrt(variance);
      }

      setStats({ 
        totalTime, 
        maxSpeed, 
        avgSpeed: parsedLayers.length > 0 ? totalSpeed / parsedLayers.length : 0,
        layerCount: parsedLayers.length,
        maxFlow,
        coolingWarnings, 
        cornerWarnings,
        totalFilament,
        totalPrintTime,
        totalTravelTime,
        layerHeightConsistency
      });
    } catch (err) {
      console.error("Error parsing GCODE:", err);
      setError("Der opstod en fejl under læsning af GCODE filen.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOptimizeAndDownload = async () => {
    if (!originalFile || layers.length === 0) return;
    
    setIsOptimizing(true);
    try {
      const optimizedBlob = await optimizeGCode(originalFile, layers);
      const url = URL.createObjectURL(optimizedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName ? fileName.replace('.gcode', '-optimeret.gcode') : 'optimeret.gcode';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error optimizing GCODE:", err);
      setError("Der opstod en fejl under optimering af GCODE filen.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.layers && data.stats) {
          setLayers(data.layers);
          setStats(data.stats);
          setVisibleLayersCount(100);
        } else {
          setError("Ugyldig analyse-fil. Filen mangler layers eller stats.");
        }
      } catch (err) {
        console.error("Error parsing JSON:", err);
        setError("Kunne ikke læse JSON filen. Den er muligvis korrupt.");
      }
    };
    reader.readAsText(file);
  };

  const CustomDot = (props: any) => {
    const { cx, cy, payload, dataKey } = props;
    
    // Cooling Warning Marker (Yellow Triangle/Wind)
    if (dataKey === 'time' && payload.coolingWarning) {
      return (
        <g transform={`translate(${cx - 8}, ${cy - 8})`}>
          <circle cx="8" cy="8" r="8" fill="#f59e0b" fillOpacity="0.2" />
          <path 
            d="M8 2L14 12H2L8 2Z" 
            fill="#f59e0b" 
            stroke="#18181b" 
            strokeWidth="1"
          />
          <path 
            d="M8 5V9M8 11H8.01" 
            stroke="#18181b" 
            strokeWidth="1.5" 
            strokeLinecap="round"
          />
        </g>
      );
    }

    // Sharp Corner Warning Marker (Red Diamond/Corner)
    if (dataKey === 'sharpCornerHighSpeedCount' && payload.sharpCornerHighSpeedCount > 10) {
      return (
        <g transform={`translate(${cx - 8}, ${cy - 8})`}>
          <circle cx="8" cy="8" r="10" fill="#ef4444" fillOpacity="0.2" />
          <rect 
            x="3" y="3" width="10" height="10" 
            transform="rotate(45 8 8)" 
            fill="#ef4444" 
            stroke="#18181b" 
            strokeWidth="1"
          />
          <path 
            d="M6 10L10 10L10 6" 
            fill="none" 
            stroke="#18181b" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </g>
      );
    }

    // Critical Speed Marker (Red Dot)
    if (dataKey === 'avgSpeed' && payload.avgSpeed < 40) {
      return (
        <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#18181b" strokeWidth={2} />
      );
    }

    // High Flow Marker (Amber Dot)
    if (dataKey === 'flow' && payload.flow > 15) {
      return (
        <circle cx={cx} cy={cy} r={5} fill="#f59e0b" stroke="#18181b" strokeWidth={2} />
      );
    }
    return null;
  };

  const exportToJson = () => {
    const data = { stats, layers };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName ? `${fileName.replace('.gcode', '')}-analyse.json` : 'gcode-analyse.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
      <div className="flex flex-col gap-6 w-full">
        <div className="w-full md:w-96 bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">GCODE Analysator</h2>
          <p className="text-zinc-400 text-sm mb-6">
            Find svage punkter, hastighedsfejl og køleproblemer før du printer.
          </p>
          
          <div className="flex flex-col gap-3">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-zinc-700 border-dashed rounded-xl cursor-pointer bg-zinc-800/50 hover:bg-zinc-800 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-3 text-zinc-400" />
                <p className="mb-2 text-sm text-zinc-400"><span className="font-semibold">Upload .gcode</span></p>
              </div>
              <input type="file" accept=".gcode" className="hidden" onChange={handleFileUpload} disabled={isProcessing} />
            </label>

            <label className="flex items-center justify-center w-full py-3 border border-zinc-700 border-dashed rounded-lg cursor-pointer bg-zinc-800/30 hover:bg-zinc-800 transition-colors">
              <div className="flex items-center gap-2 text-zinc-400">
                <FileJson className="w-4 h-4" />
                <span className="text-xs font-medium">Eller indlæs gemt analyse (.json)</span>
              </div>
              <input type="file" accept=".json" className="hidden" onChange={handleJsonUpload} disabled={isProcessing} />
            </label>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-950/30 border border-red-900/50 rounded-lg flex items-start gap-2 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

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
          <div className="w-full flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-zinc-900 border border-zinc-800 rounded-xl p-5 gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 shrink-0">
                  <File className="w-6 h-6" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Analyse Resultater</span>
                  <h2 className="text-xl font-bold text-zinc-100 truncate max-w-[250px] sm:max-w-[400px] lg:max-w-[600px]" title={fileName || 'Ukendt fil'}>
                    {fileName || 'Ukendt fil'}
                  </h2>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={exportToJson}
                  className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-1.5 px-3 rounded-lg text-sm font-medium transition-colors border border-zinc-700"
                  title="Download analyse som JSON"
                >
                  <FileJson className="w-4 h-4 text-emerald-500" />
                  Gem Analyse (.json)
                </button>
                
                {originalFile && (
                  <button 
                    onClick={handleOptimizeAndDownload}
                    disabled={isOptimizing}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 px-3 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                  >
                    {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Optimér & Gem GCODE
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col justify-center">
                <div className="flex items-center gap-3 text-zinc-400 mb-2">
                  <Clock className="w-5 h-5" />
                  <span className="text-sm font-medium">Estimeret Tid</span>
                </div>
                <div className="text-3xl font-mono text-zinc-100">{formatTime(stats.totalTime)}</div>
                <div className="text-xs text-zinc-500 mt-2">
                  Print: {formatTime(stats.totalPrintTime)} | Rejse: {formatTime(stats.totalTravelTime)}
                </div>
              </div>
              
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col justify-center">
                <div className="flex items-center gap-3 text-zinc-400 mb-2">
                  <Box className="w-5 h-5" />
                  <span className="text-sm font-medium">Filament Forbrug</span>
                </div>
                <div className="text-3xl font-mono text-zinc-100">
                  {(stats.totalFilament * Math.PI * Math.pow(1.75 / 2, 2) * 0.00124).toFixed(1)} <span className="text-lg text-zinc-500">g</span>
                </div>
                <div className="text-sm font-medium text-emerald-400 mt-1">
                  Pris: {(stats.totalFilament * Math.PI * Math.pow(1.75 / 2, 2) * 0.00124 * 0.5).toFixed(2)} kr. <span className="text-xs text-zinc-500 font-normal">(0,50 kr/g)</span>
                </div>
                <div className="text-xs text-zinc-500 mt-2">
                  {(stats.totalFilament / 1000).toFixed(2)} m | Gns. flow: {stats.maxFlow.toFixed(1)} mm³/s
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col justify-center">
                <div className="flex items-center gap-3 text-zinc-400 mb-2">
                  <Ruler className="w-5 h-5" />
                  <span className="text-sm font-medium">Lag Konsistens</span>
                </div>
                <div className="text-3xl font-mono text-zinc-100">
                  {stats.layerHeightConsistency < 0.01 ? 'Fremragende' : stats.layerHeightConsistency < 0.05 ? 'God' : 'Variabel'}
                </div>
                <div className="text-xs text-zinc-500 mt-2">
                  Afvigelse: ±{stats.layerHeightConsistency.toFixed(3)} mm
                </div>
              </div>
              
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col justify-center">
                <div className="flex items-center gap-3 text-zinc-400 mb-2">
                  <Move className="w-5 h-5" />
                  <span className="text-sm font-medium">Rejse Optimeret</span>
                </div>
                <div className="text-3xl font-mono text-zinc-100">
                  {((stats.totalPrintTime / stats.totalTime) * 100).toFixed(0)}<span className="text-lg text-zinc-500">%</span>
                </div>
                <div className="text-xs text-zinc-500 mt-2">
                  Tid brugt på at printe vs rejse
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col justify-center">
                <div className="flex items-center gap-3 text-zinc-400 mb-2">
                  <Zap className="w-5 h-5" />
                  <span className="text-sm font-medium">Gns. Hastighed</span>
                </div>
                <div className="text-3xl font-mono text-zinc-100">{stats.avgSpeed.toFixed(0)} <span className="text-lg text-zinc-500">mm/s</span></div>
                <div className="text-xs text-zinc-500 mt-2">
                  Maks: {stats.maxSpeed.toFixed(0)} mm/s
                </div>
              </div>

              <div className={`border rounded-xl p-6 flex flex-col justify-center ${stats.coolingWarnings > 0 ? 'bg-amber-950/20 border-amber-900/50' : 'bg-zinc-900 border-zinc-800'}`}>
                <div className={`flex items-center gap-3 mb-2 ${stats.coolingWarnings > 0 ? 'text-amber-500' : 'text-zinc-400'}`}>
                  <Wind className="w-5 h-5" />
                  <span className="text-sm font-medium">Køle-advarsler</span>
                </div>
                <div className={`text-3xl font-mono ${stats.coolingWarnings > 0 ? 'text-amber-400' : 'text-zinc-100'}`}>
                  {stats.coolingWarnings} <span className="text-lg opacity-50">lag</span>
                </div>
              </div>

              <div className={`border rounded-xl p-6 flex flex-col justify-center ${stats.cornerWarnings > 0 ? 'bg-red-950/20 border-red-900/50' : 'bg-zinc-900 border-zinc-800'}`}>
                <div className={`flex items-center gap-3 mb-2 ${stats.cornerWarnings > 0 ? 'text-red-500' : 'text-zinc-400'}`}>
                  <CornerUpRight className="w-5 h-5" />
                  <span className="text-sm font-medium">Hurtige Hjørner</span>
                </div>
                <div className={`text-3xl font-mono ${stats.cornerWarnings > 0 ? 'text-red-400' : 'text-zinc-100'}`}>
                  {stats.cornerWarnings} <span className="text-lg opacity-50">lag</span>
                </div>
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
            <h3 className="text-zinc-100 font-medium mb-1">Lag-tid & Køling</h3>
            <p className="text-xs text-zinc-500 mb-6">Tid brugt per lag (grøn) vs. blæserhastighed (blå). Korte lag kræver høj køling.</p>
            <div className="flex-1 w-full min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={layers} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="layerNum" stroke="#52525b" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <YAxis yAxisId="left" stroke="#52525b" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#52525b" tick={{ fill: '#71717a', fontSize: 12 }} domain={[0, 255]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                    formatter={(value: number, name: string, props: any) => {
                      const { payload } = props;
                      if (name === 'time') {
                        const label = `${value.toFixed(1)}s`;
                        return payload.coolingWarning 
                          ? [`${label} (⚠️ Køle-advarsel)`, 'Lag-tid'] 
                          : [label, 'Lag-tid'];
                      }
                      if (name === 'avgFanSpeed') return [`${Math.round((value/255)*100)}%`, 'Blæser'];
                      return [value, name];
                    }}
                    labelFormatter={(label) => `Lag ${label}`}
                  />
                  <ReferenceLine yAxisId="left" y={15} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Kritisk kort tid', fill: '#f59e0b', fontSize: 10 }} />
                  <Line yAxisId="left" type="monotone" dataKey="time" stroke="#10b981" strokeWidth={2} dot={<CustomDot dataKey="time" />} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="stepAfter" dataKey="avgFanSpeed" stroke="#3b82f6" strokeWidth={2} dot={false} opacity={0.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Speed & Corners Chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
            <h3 className="text-zinc-100 font-medium mb-1">Hastighed & Hjørner</h3>
            <p className="text-xs text-zinc-500 mb-6">Gns. hastighed (lilla) og antal skarpe hjørner taget ved høj fart (rød).</p>
            <div className="flex-1 w-full min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={layers} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="layerNum" stroke="#52525b" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <YAxis yAxisId="left" stroke="#52525b" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#52525b" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                    formatter={(value: number, name: string, props: any) => {
                      const { payload } = props;
                      if (name === 'avgSpeed') return [`${value.toFixed(0)} mm/s`, 'Gns. Hastighed'];
                      if (name === 'sharpCornerHighSpeedCount') {
                        return payload.sharpCornerHighSpeedCount > 10
                          ? [`${value} (⚠️ Hurtige hjørner)`, 'Hurtige Hjørner']
                          : [value, 'Hurtige Hjørner'];
                      }
                      return [value, name];
                    }}
                    labelFormatter={(label) => `Lag ${label}`}
                  />
                  <Area yAxisId="left" type="monotone" dataKey="avgSpeed" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} strokeWidth={2} />
                  <Area yAxisId="right" type="monotone" dataKey="sharpCornerHighSpeedCount" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="sharpCornerHighSpeedCount" stroke="transparent" dot={<CustomDot dataKey="sharpCornerHighSpeedCount" />} activeDot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Average Speed Chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
            <h3 className="text-zinc-100 font-medium mb-1">Gennemsnitlig Hastighed</h3>
            <p className="text-xs text-zinc-500 mb-6">Gennemsnitlig printhastighed per lag. Markering ved kritisk lav hastighed (40 mm/s).</p>
            <div className="flex-1 w-full min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={layers} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="layerNum" stroke="#52525b" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <YAxis stroke="#52525b" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                    formatter={(value: number) => [`${value.toFixed(0)} mm/s`, 'Gns. Hastighed']}
                    labelFormatter={(label) => `Lag ${label}`}
                  />
                  <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Kritisk grænse (40 mm/s)', fill: '#ef4444', fontSize: 10 }} />
                  <Line type="monotone" dataKey="avgSpeed" stroke="#0ea5e9" strokeWidth={2} dot={<CustomDot dataKey="avgSpeed" />} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Print vs Travel Time Chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
            <h3 className="text-zinc-100 font-medium mb-1">Print vs Rejse Tid per Lag</h3>
            <p className="text-xs text-zinc-500 mb-6">Sammenligning af tid brugt på ekstrudering (grøn) vs. rejsebevægelser (orange).</p>
            <div className="flex-1 w-full min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={layers} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="layerNum" stroke="#52525b" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <YAxis stroke="#52525b" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(1)}s`, 
                      name === 'printTime' ? 'Print Tid' : 'Rejse Tid'
                    ]}
                    labelFormatter={(label) => `Lag ${label}`}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="printTime" name="Print Tid" stackId="a" fill="#10b981" />
                  <Bar dataKey="travelTime" name="Rejse Tid" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Filament Flow Chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col">
            <h3 className="text-zinc-100 font-medium mb-1">Filament Flow (mm³/s)</h3>
            <p className="text-xs text-zinc-500 mb-6">Volumetrisk flow per lag. Markering ved høj flow (15 mm³/s).</p>
            <div className="flex-1 w-full min-h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={layers} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="layerNum" stroke="#52525b" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <YAxis stroke="#52525b" tick={{ fill: '#71717a', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#f4f4f5' }}
                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                    formatter={(value: number) => [`${value.toFixed(2)} mm³/s`, 'Flow']}
                    labelFormatter={(label) => `Lag ${label}`}
                  />
                  <ReferenceLine y={15} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Høj flow (15 mm³/s)', fill: '#f59e0b', fontSize: 10 }} />
                  <Area type="monotone" dataKey="flow" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.1} strokeWidth={2} dot={<CustomDot dataKey="flow" />} activeDot={{ r: 6 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart Legend / Key */}
          <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 flex flex-wrap gap-6 justify-center">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path d="M8 2L14 12H2L8 2Z" fill="#f59e0b" stroke="#18181b" strokeWidth="1" />
              </svg>
              <span>Køle-advarsel (Kort lagtid + lav køling)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <rect x="3" y="3" width="10" height="10" transform="rotate(45 8 8)" fill="#ef4444" stroke="#18181b" strokeWidth="1" />
              </svg>
              <span>Hurtige hjørner ({'>'}10 skarpe hjørner ved høj fart)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <div className="w-3 h-3 rounded-full bg-red-500 border border-zinc-900" />
              <span>Kritisk lav hastighed (&lt;40 mm/s)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <div className="w-3 h-3 rounded-full bg-amber-500 border border-zinc-900" />
              <span>Høj flow ({'>'}15 mm³/s)</span>
            </div>
          </div>

          {/* Layer Table */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col lg:col-span-2">
            <h3 className="text-zinc-100 font-medium mb-4">Lag Detaljer</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-zinc-400">
                <thead className="text-xs text-zinc-500 uppercase bg-zinc-800/50">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Lag</th>
                    <th className="px-4 py-3">Z (mm)</th>
                    <th className="px-4 py-3">Tid</th>
                    <th className="px-4 py-3">Flow</th>
                    <th className="px-4 py-3">Gns. Hastighed</th>
                    <th className="px-4 py-3">Køling</th>
                    <th className="px-4 py-3 rounded-tr-lg">Advarsler</th>
                  </tr>
                </thead>
                <tbody>
                  {layers.slice(0, visibleLayersCount).map((layer) => (
                    <tr 
                      key={layer.layerNum} 
                      className={`border-b border-zinc-800/50 last:border-0 transition-colors ${
                        layer.coolingWarning ? 'bg-amber-950/20' : 
                        layer.sharpCornerHighSpeedCount > 10 ? 'bg-red-950/20' : 
                        'hover:bg-zinc-800/30'
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-zinc-300">{layer.layerNum}</td>
                      <td className="px-4 py-3">{layer.z.toFixed(2)}</td>
                      <td className="px-4 py-3">{formatTime(layer.time)}</td>
                      <td className="px-4 py-3">
                        <span className={layer.flow > 15 ? "text-amber-400 font-medium" : ""}>
                          {layer.flow.toFixed(2)} mm³/s
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={layer.avgSpeed < 40 ? "text-red-400 font-medium" : ""}>
                          {layer.avgSpeed.toFixed(0)} mm/s
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={layer.coolingWarning ? "text-amber-400 font-medium" : ""}>
                            {Math.round((layer.avgFanSpeed / 255) * 100)}%
                          </span>
                          {layer.coolingWarning && (
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]" title="Køle-advarsel">
                              <Wind className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {layer.coolingWarning && (
                            <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-medium" title="Køle-advarsel: Kort lag med lav køling, eller langt/langsomt lag med lav køling">
                              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                              <span>Køle-advarsel</span>
                            </div>
                          )}
                          {layer.sharpCornerHighSpeedCount > 10 && (
                            <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium" title="Hjørne-advarsel: Mange skarpe hjørner taget ved høj hastighed">
                              <CornerUpRight className="w-3.5 h-3.5 mr-1.5" />
                              <span>Hurtige hjørner ({layer.sharpCornerHighSpeedCount})</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleLayersCount < layers.length && (
              <div className="mt-4 flex justify-center">
                <button 
                  onClick={() => setVisibleLayersCount(prev => prev + 100)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Vis flere lag ({layers.length - visibleLayersCount} tilbage)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
