import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { Upload, RotateCcw, RotateCw, Info, Loader2, CheckCircle2, AlertCircle, Wand2, Layers, Eye, EyeOff, Save, Maximize2, Box as BoxIcon, FileCode2, AlertTriangle } from 'lucide-react';
import { parseGCodePath, GCodePathLayer } from '../utils/gcodeParser';

export default function STLTab() {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [dimensions, setDimensions] = useState<{x: number, y: number, z: number} | null>(null);
  const [wallCount, setWallCount] = useState<number>(2);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'reading' | 'parsing' | 'success' | 'error'>('idle');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [optimizationMessage, setOptimizationMessage] = useState<string | null>(null);

  // GCode Overlay States
  const [gcodeLayers, setGcodeLayers] = useState<GCodePathLayer[]>([]);
  const [showGCode, setShowGCode] = useState<boolean>(true);
  const [currentLayerIndex, setCurrentLayerIndex] = useState<number>(0);
  const [gcodeUploadStatus, setGcodeUploadStatus] = useState<'idle' | 'reading' | 'parsing' | 'success' | 'error'>('idle');
  const [gcodeErrorMessage, setGcodeErrorMessage] = useState<string>('');
  const [gcodeFileName, setGcodeFileName] = useState<string>('');
  const [gcodeCenter, setGcodeCenter] = useState<THREE.Vector3>(new THREE.Vector3());
  const [viewMode, setViewMode] = useState<'solid' | 'wireframe' | 'xray'>('solid');
  const controlsRef = useRef<any>(null);
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  
  // Drag and drop states
  const [isDraggingStl, setIsDraggingStl] = useState(false);
  const [isDraggingGcode, setIsDraggingGcode] = useState(false);

  const { combinedGCodePositions, combinedGCodeColors, layerOffsets } = useMemo(() => {
    if (!gcodeLayers.length) return { combinedGCodePositions: null, combinedGCodeColors: null, layerOffsets: [] };
    
    // Calculate total length of all positions
    let totalLength = 0;
    const offsets: number[] = [];
    
    for (let i = 0; i < gcodeLayers.length; i++) {
      offsets.push(totalLength);
      if (gcodeLayers[i]) {
        totalLength += gcodeLayers[i].positions.length;
      }
    }
    // Add final offset for the end of the last layer
    offsets.push(totalLength);
    
    const combinedPos = new Float32Array(totalLength);
    const combinedCol = new Float32Array(totalLength);
    let currentOffset = 0;
    for (let i = 0; i < gcodeLayers.length; i++) {
      if (gcodeLayers[i]) {
        const len = gcodeLayers[i].positions.length;
        combinedPos.set(gcodeLayers[i].positions, currentOffset);
        
        // Use colors if available, otherwise default to green
        if (gcodeLayers[i].colors && gcodeLayers[i].colors.length === len) {
          combinedCol.set(gcodeLayers[i].colors, currentOffset);
        } else {
          // Fallback to green
          for (let j = 0; j < len; j+=3) {
            combinedCol[currentOffset + j] = 0.06; // R (approx #10b981)
            combinedCol[currentOffset + j + 1] = 0.72; // G
            combinedCol[currentOffset + j + 2] = 0.5; // B
          }
        }
        currentOffset += len;
      }
    }
    
    return { combinedGCodePositions: combinedPos, combinedGCodeColors: combinedCol, layerOffsets: offsets };
  }, [gcodeLayers]);

  useEffect(() => {
    if (geometryRef.current && layerOffsets.length > 0 && currentLayerIndex >= 0) {
      const start = layerOffsets[currentLayerIndex] / 3;
      const count = (layerOffsets[currentLayerIndex + 1] - layerOffsets[currentLayerIndex]) / 3;
      geometryRef.current.setDrawRange(start, count);
    }
  }, [currentLayerIndex, layerOffsets, showGCode]);

  const resetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const handleSaveSTL = () => {
    if (!geometry) return;
    setIsSaving(true);

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        const exporter = new STLExporter();
        
        // Create a temporary mesh to apply the rotation
        const tempMesh = new THREE.Mesh(geometry);
        tempMesh.rotation.set(rotation[0], rotation[1], rotation[2]);
        tempMesh.updateMatrixWorld();
        
        // Export the mesh. STLExporter.parse returns a string or ArrayBuffer
        // We use binary: true for smaller file size
        const result = exporter.parse(tempMesh, { binary: true });
        
        const blob = new Blob([result], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = url;
        
        // Include wall count in filename if it's been changed from default
        const wallSuffix = wallCount !== 2 ? `_${wallCount}walls` : '';
        const newFileName = fileName.toLowerCase().endsWith('.stl') 
          ? fileName.slice(0, -4) + '_optimized' + wallSuffix + '.stl'
          : fileName + '_optimized' + wallSuffix + '.stl';
          
        link.download = newFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setOptimizationMessage("STL fil gemt med succes!");
      } catch (err) {
        console.error("Error saving STL:", err);
        setErrorMessage("Kunne ikke gemme STL filen.");
      } finally {
        setIsSaving(false);
      }
    }, 100);
  };

  const handleAutoOptimize = () => {
    if (!dimensions) return;

    const { x, y, z } = dimensions;
    let newRotation: [number, number, number] = [0, 0, 0];
    let message = "";
    let newWallCount = wallCount;

    // Find the smallest dimension to orient along the Z-axis (up)
    // This maximizes bed adhesion and aligns layer lines along the longer axes for strength.
    if (z <= x && z <= y) {
      // Z is already the smallest, no rotation needed
      newRotation = [0, 0, 0];
      message = "Modellen er allerede optimalt orienteret (fladest muligt).";
    } else if (x <= y && x <= z) {
      // X is the smallest, rotate around Y by 90 degrees to lay it flat
      newRotation = [0, Math.PI / 2, 0];
      message = "Roteret 90° om Y-aksen for at maksimere kontaktfladen og styrken.";
    } else {
      // Y is the smallest, rotate around X by 90 degrees to lay it flat
      newRotation = [Math.PI / 2, 0, 0];
      message = "Roteret 90° om X-aksen for at maksimere kontaktfladen og styrken.";
    }

    // Suggest wall count based on aspect ratio (thin parts need more walls)
    const maxDim = Math.max(x, y, z);
    const minDim = Math.min(x, y, z);
    if (maxDim / minDim > 5 || minDim < 10) {
      newWallCount = 4;
      message += " Delen er tynd/lang. Anbefaler 4 vægge for ekstra styrke.";
    } else {
      newWallCount = 2;
      message += " Standard 2 vægge er tilstrækkeligt.";
    }

    setRotation(newRotation);
    setWallCount(newWallCount);
    setOptimizationMessage(message);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLLabelElement>) => {
    let file: File | undefined;
    if ('dataTransfer' in e) {
      file = e.dataTransfer.files?.[0];
    } else {
      file = e.target.files?.[0];
    }
    if (!file) return;
    
    if (file.size > 150 * 1024 * 1024) {
      setUploadStatus('error');
      setErrorMessage('Filen er for stor (max 150MB). For at undgå at browseren crasher, er denne grænse indført.');
      return;
    }

    setFileName(file.name);
    setUploadStatus('reading');
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadStatus('parsing');
      
      // Use setTimeout to allow UI to update to 'parsing' before heavy synchronous work
      setTimeout(() => {
        try {
          const contents = event.target?.result as ArrayBuffer;
          const loader = new STLLoader();
          const geom = loader.parse(contents);
          geom.computeBoundingBox();
          
          if (geom.boundingBox) {
            const size = new THREE.Vector3();
            geom.boundingBox.getSize(size);
            setDimensions({ x: size.x, y: size.y, z: size.z });
            // Center the geometry so it aligns with the centered GCode
            geom.center();
          }
          
          setGeometry(geom);
          setRotation([0, 0, 0]);
          setOptimizationMessage(null);
          setUploadStatus('success');
        } catch (err) {
          console.error(err);
          setUploadStatus('error');
          setErrorMessage('Kunne ikke læse STL filen. Er den korrupt?');
        }
      }, 50);
    };
    reader.onerror = () => {
      setUploadStatus('error');
      setErrorMessage('Fejl ved læsning af fil.');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleReset = () => {
    setGeometry(null);
    setFileName('');
    setGcodeLayers([]);
    setGcodeFileName('');
    setGcodeUploadStatus('idle');
    setUploadStatus('idle');
    setErrorMessage('');
    setDimensions(null);
  };

  const handleGCodeUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLLabelElement>) => {
    let file: File | undefined;
    if ('dataTransfer' in e) {
      file = e.dataTransfer.files?.[0];
    } else {
      file = e.target.files?.[0];
    }
    if (!file) return;
    
    if (file.size > 150 * 1024 * 1024) {
      setGcodeUploadStatus('error');
      // We don't have a dedicated error message state for GCode yet, but we can just reset
      alert('GCode filen er for stor (max 150MB).');
      return;
    }

    // Infer filename from STL if the uploaded file has a generic name or we want to link them
    let newGcodeFileName = file.name;
    if (fileName && (file.name === 'data' || file.name.startsWith('blob'))) {
       newGcodeFileName = fileName.toLowerCase().endsWith('.stl') 
          ? fileName.slice(0, -4) + '.gcode'
          : fileName + '.gcode';
    }
    setGcodeFileName(newGcodeFileName);
    setGcodeUploadStatus('parsing');
    
    try {
      const layers = await parseGCodePath(file, () => {});
      
      // Calculate center of the GCode path to align it with the STL
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      
      layers.forEach(layer => {
        for (let i = 0; i < layer.positions.length; i += 3) {
          const x = layer.positions[i];
          const y = layer.positions[i+1];
          const z = layer.positions[i+2];
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (z < minZ) minZ = z;
          if (z > maxZ) maxZ = z;
        }
      });
      
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const cz = (minZ + maxZ) / 2;
      
      setGcodeCenter(new THREE.Vector3(cx, cy, cz));
      setGcodeLayers(layers);
      setCurrentLayerIndex(Math.floor(layers.length / 2));
      setGcodeUploadStatus('success');
      setShowGCode(true);
    } catch (err) {
      console.error(err);
      setGcodeUploadStatus('error');
      setGcodeErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const rotate = (axis: 'x' | 'y' | 'z', deg: number) => {
    const rad = deg * (Math.PI / 180);
    setRotation(prev => {
      const next = [...prev] as [number, number, number];
      if (axis === 'x') next[0] += rad;
      if (axis === 'y') next[1] += rad;
      if (axis === 'z') next[2] += rad;
      return next;
    });
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-full">
      {/* Sidebar */}
      <div className="w-full md:w-80 bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">STL Optimerer</h2>
          <p className="text-zinc-400 text-sm">
            Upload din STL fil for at analysere og optimere orienteringen for maksimal styrke.
          </p>
        </div>

        <label 
          className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            isDraggingStl ? 'border-emerald-500 bg-emerald-500/10' :
            uploadStatus === 'error' ? 'border-red-500/50 bg-red-500/10 hover:bg-red-500/20' :
            uploadStatus === 'success' ? 'border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20' :
            'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDraggingStl(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDraggingStl(false); }}
          onDrop={(e) => { e.preventDefault(); setIsDraggingStl(false); handleFileUpload(e); }}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
            {uploadStatus === 'idle' && (
              <>
                <Upload className="w-8 h-8 mb-3 text-zinc-400" />
                <p className="mb-2 text-sm text-zinc-400"><span className="font-semibold">Klik for at uploade</span></p>
                <p className="text-xs text-zinc-500">.STL filer</p>
              </>
            )}
            {uploadStatus === 'reading' && (
              <>
                <Loader2 className="w-8 h-8 mb-3 text-emerald-500 animate-spin" />
                <p className="text-sm text-zinc-300">Læser fil...</p>
              </>
            )}
            {uploadStatus === 'parsing' && (
              <>
                <Loader2 className="w-8 h-8 mb-3 text-emerald-500 animate-spin" />
                <p className="text-sm text-zinc-300">Analyserer 3D model...</p>
              </>
            )}
            {uploadStatus === 'success' && (
              <>
                <CheckCircle2 className="w-8 h-8 mb-3 text-emerald-500" />
                <p className="text-sm text-emerald-400 font-medium truncate max-w-[200px]">{fileName}</p>
                <p className="text-xs text-emerald-500/70 mt-1">Upload fuldført</p>
              </>
            )}
            {uploadStatus === 'error' && (
              <>
                <AlertCircle className="w-8 h-8 mb-3 text-red-500" />
                <p className="text-sm text-red-400 font-medium">Upload fejlede</p>
                <p className="text-xs text-red-500/70 mt-1">{errorMessage}</p>
              </>
            )}
          </div>
          <input type="file" accept=".stl" className="hidden" onChange={handleFileUpload} disabled={uploadStatus === 'reading' || uploadStatus === 'parsing'} />
        </label>

        {geometry && (
          <div className="space-y-6">
            <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50" title="Modellens dimensioner i millimeter (Bredde x Dybde x Højde).">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Dimensioner (mm)
                </h3>
                <button 
                  onClick={handleReset}
                  className="text-xs flex items-center gap-1 text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-900/50 px-2 py-1 rounded border border-red-900/50 transition-colors"
                  title="Nulstil og fjern fil"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Nulstil
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-zinc-900 p-2 rounded">
                  <div className="text-xs text-zinc-500">X</div>
                  <div className="font-mono text-sm text-zinc-200">{dimensions?.x.toFixed(1)}</div>
                </div>
                <div className="bg-zinc-900 p-2 rounded">
                  <div className="text-xs text-zinc-500">Y</div>
                  <div className="font-mono text-sm text-zinc-200">{dimensions?.y.toFixed(1)}</div>
                </div>
                <div className="bg-zinc-900 p-2 rounded">
                  <div className="text-xs text-zinc-500">Z</div>
                  <div className="font-mono text-sm text-zinc-200">{dimensions?.z.toFixed(1)}</div>
                </div>
              </div>

              <button 
                onClick={handleAutoOptimize}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                title="Forsøger automatisk at finde den bedste orientering for modellen for at minimere behovet for supportmateriale og maksimere styrken."
              >
                <Wand2 className="w-4 h-4" />
                Auto-Optimér
              </button>
              
              {optimizationMessage && (
                <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded text-sm text-emerald-400 leading-relaxed">
                  {optimizationMessage}
                </div>
              )}
            </div>

            <div title="Rotér modellen for at sikre at de svageste punkter (mellem lagene) ikke udsættes for direkte belastning.">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">Rotér for styrke</h3>
              <p className="text-xs text-zinc-500 mb-4">
                Husk: FDM-print er svagest mellem lagene (Z-aksen). Rotér din model så belastningen ligger langs X/Y-aksen.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">X-Akse</span>
                  <div className="flex gap-2">
                    <button onClick={() => rotate('x', -45)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300"><RotateCcw className="w-4 h-4" /></button>
                    <button onClick={() => rotate('x', 45)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300"><RotateCw className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Y-Akse</span>
                  <div className="flex gap-2">
                    <button onClick={() => rotate('y', -45)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300"><RotateCcw className="w-4 h-4" /></button>
                    <button onClick={() => rotate('y', 45)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300"><RotateCw className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Z-Akse</span>
                  <div className="flex gap-2">
                    <button onClick={() => rotate('z', -45)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300"><RotateCcw className="w-4 h-4" /></button>
                    <button onClick={() => rotate('z', 45)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300"><RotateCw className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800" title="At øge antallet af vægge (perimeters) er ofte den mest effektive måde at øge en 3D-printet dels styrke på, frem for at øge infill.">
              <h3 className="text-sm font-medium text-zinc-300 mb-2">Styrk med ekstra vægge</h3>
              <p className="text-xs text-zinc-500 mb-4">
                Mange tror infill giver styrke, men væggene (walls) bærer den største belastning. At øge fra 2 til 4 vægge kan gøre din del op til 2-3x stærkere!
              </p>
              <div className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                <div className="flex flex-col">
                  <span className="text-sm text-zinc-300">Væg-antal (Wall count)</span>
                  <span className={`text-xs font-medium ${wallCount === 4 ? 'text-emerald-500' : 'text-zinc-500'}`}>
                    {wallCount === 4 ? 'Optimeret til styrke' : 'Standard (2)'}
                  </span>
                </div>
                <button
                  onClick={() => setWallCount(wallCount === 2 ? 4 : 2)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    wallCount === 4 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
                  }`}
                >
                  {wallCount === 4 ? '4 Vægge' : 'Anvend 4 Vægge'}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <button 
                onClick={handleSaveSTL}
                disabled={isSaving || !geometry}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-4 rounded-lg font-bold transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Gem Optimeret STL
              </button>
              <p className="text-[10px] text-zinc-500 mt-2 text-center">
                Gemmer modellen med den valgte rotation og orientering.
              </p>
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-300 mb-2">GCode Overlay</h3>
              <p className="text-xs text-zinc-500 mb-4">
                Upload en GCode fil for at visualisere printstien ovenpå din 3D model.
              </p>
              
              {gcodeLayers.length === 0 ? (
                <>
                  <label 
                    className={`flex flex-col items-center justify-center w-full h-20 border border-dashed rounded-lg cursor-pointer transition-colors ${
                      isDraggingGcode ? 'border-emerald-500 bg-emerald-500/10' :
                      gcodeUploadStatus === 'error' ? 'border-red-500/50 bg-red-500/10 hover:bg-red-500/20' :
                      'border-zinc-700 bg-zinc-800/30 hover:bg-zinc-800'
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingGcode(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDraggingGcode(false); }}
                    onDrop={(e) => { e.preventDefault(); setIsDraggingGcode(false); handleGCodeUpload(e); }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {gcodeUploadStatus === 'parsing' ? (
                        <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                      ) : (
                        <Layers className="w-4 h-4 text-zinc-400" />
                      )}
                      <span className="text-sm text-zinc-400">
                        {gcodeUploadStatus === 'parsing' ? 'Analyserer GCode...' : 'Upload GCode fil'}
                      </span>
                    </div>
                    <input type="file" accept=".gcode" className="hidden" onChange={handleGCodeUpload} disabled={gcodeUploadStatus === 'parsing'} />
                  </label>
                  {gcodeUploadStatus === 'error' && gcodeErrorMessage && (
                    <p className="text-xs text-red-400 mt-2 text-center">{gcodeErrorMessage}</p>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileCode2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span className="text-xs font-medium text-zinc-300 truncate" title={gcodeFileName}>
                        {gcodeFileName}
                      </span>
                    </div>
                    <button 
                      onClick={() => {
                        setGcodeLayers([]);
                        setGcodeFileName('');
                        setGcodeUploadStatus('idle');
                      }}
                      className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                      title="Fjern GCode"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Vis GCode sti</span>
                    <button 
                      onClick={() => setShowGCode(!showGCode)}
                      className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                    >
                      {showGCode ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {showGCode && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>Lag 1</span>
                        <span className="font-medium text-emerald-400">Lag {currentLayerIndex + 1} / {gcodeLayers.length}</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max={gcodeLayers.length - 1} 
                        value={currentLayerIndex} 
                        onChange={(e) => setCurrentLayerIndex(parseInt(e.target.value))}
                        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3D Viewport */}
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden relative min-h-[400px] group">
        {!geometry && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
            Upload en STL fil for at se den her
          </div>
        )}
        {geometry && (
          <>
            {/* Viewport Controls Overlay */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-zinc-950/80 backdrop-blur-md border border-zinc-800 rounded-lg p-1 flex flex-col gap-1">
                <button 
                  onClick={() => setViewMode('solid')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'solid' ? 'bg-emerald-500 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
                  title="Solid visning"
                >
                  <BoxIcon className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('wireframe')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'wireframe' ? 'bg-emerald-500 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
                  title="Wireframe visning"
                >
                  <Layers className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('xray')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'xray' ? 'bg-emerald-500 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
                  title="X-Ray visning"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
              <button 
                onClick={resetCamera}
                className="bg-zinc-950/80 backdrop-blur-md border border-zinc-800 p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                title="Nulstil kamera"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            <Canvas shadows>
              <PerspectiveCamera makeDefault position={[100, 100, 100]} fov={50} />
              <color attach="background" args={['#111113']} />
              <ambientLight intensity={0.5} />
              <spotLight position={[50, 50, 50]} angle={0.15} penumbra={1} intensity={1} castShadow />
              <pointLight position={[-50, -50, -50]} intensity={0.5} />
              
              <Stage environment="city" intensity={0.5} adjustCamera={false}>
                <mesh geometry={geometry} rotation={rotation} castShadow receiveShadow>
                  <meshStandardMaterial 
                    color="#F27D26" 
                    roughness={0.4} 
                    metalness={0.1} 
                    wireframe={viewMode === 'wireframe'}
                    transparent={viewMode === 'xray'}
                    opacity={viewMode === 'xray' ? 0.4 : 1}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                
                {showGCode && combinedGCodePositions && combinedGCodeColors && layerOffsets.length > 0 && (
                  <group position={[-gcodeCenter.x, -gcodeCenter.y, -gcodeCenter.z]}>
                    <lineSegments>
                      <bufferGeometry ref={geometryRef}>
                        <bufferAttribute 
                          attach="attributes-position" 
                          count={combinedGCodePositions.length / 3} 
                          array={combinedGCodePositions} 
                          itemSize={3} 
                        />
                        <bufferAttribute 
                          attach="attributes-color" 
                          count={combinedGCodeColors.length / 3} 
                          array={combinedGCodeColors} 
                          itemSize={3} 
                        />
                      </bufferGeometry>
                      <lineBasicMaterial vertexColors={true} linewidth={1} opacity={0.8} transparent />
                    </lineSegments>
                  </group>
                )}
              </Stage>
              <OrbitControls ref={controlsRef} makeDefault />
              <gridHelper args={[400, 40, '#27272a', '#18181b']} position={[0, -0.1, 0]} />
            </Canvas>
          </>
        )}
      </div>
    </div>
  );
}
