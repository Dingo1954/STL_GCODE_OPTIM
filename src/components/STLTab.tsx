import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage } from '@react-three/drei';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { Upload, RotateCcw, RotateCw, Info, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function STLTab() {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0]);
  const [dimensions, setDimensions] = useState<{x: number, y: number, z: number} | null>(null);
  const [wallCount, setWallCount] = useState<number>(2);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'reading' | 'parsing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
          }
          
          setGeometry(geom);
          setRotation([0, 0, 0]);
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

        <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
          uploadStatus === 'error' ? 'border-red-500/50 bg-red-500/10 hover:bg-red-500/20' :
          uploadStatus === 'success' ? 'border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20' :
          'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800'
        }`}>
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
            <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700/50">
              <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Dimensioner (mm)
              </h3>
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
            </div>

            <div>
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

            <div className="pt-4 border-t border-zinc-800">
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
          </div>
        )}
      </div>

      {/* 3D Viewport */}
      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden relative min-h-[400px]">
        {!geometry && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
            Upload en STL fil for at se den her
          </div>
        )}
        {geometry && (
          <Canvas camera={{ position: [100, 100, 100], fov: 50 }}>
            <color attach="background" args={['#18181b']} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <directionalLight position={[-10, -10, -5]} intensity={0.5} />
            
            <Stage environment="city" intensity={0.5}>
              <mesh geometry={geometry} rotation={rotation}>
                <meshStandardMaterial color="#F27D26" roughness={0.4} metalness={0.1} />
              </mesh>
            </Stage>
            <OrbitControls makeDefault />
            <gridHelper args={[200, 20, '#3f3f46', '#27272a']} position={[0, -0.1, 0]} />
          </Canvas>
        )}
      </div>
    </div>
  );
}
