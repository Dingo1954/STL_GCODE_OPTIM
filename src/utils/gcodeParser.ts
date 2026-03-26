export interface LayerStat {
  layerNum: number;
  z: number;
  layerHeight: number;
  time: number; // in seconds
  printTime: number; // time spent extruding
  travelTime: number; // time spent traveling
  filamentUsed: number; // mm of filament
  maxSpeed: number; // mm/s
  avgSpeed: number; // mm/s
  flow: number; // mm^3/s (approx)
  avgFanSpeed: number; // 0-255
  sharpCornerHighSpeedCount: number; // Count of sharp corners taken at high speed
  coolingWarning: boolean; // True if layer is long/slow but has low cooling, or very short with low cooling
  featureTimes: Record<string, number>; // Time spent on different features (e.g., Infill, Perimeter)
}

export interface GCodeParseResult {
  layers: LayerStat[];
  boundingBox: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
}

export function parseGCode(
  file: File, 
  onProgress: (progress: number) => void
): Promise<GCodeParseResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/gcodeWorker.ts', import.meta.url), { type: 'module' });
    
    worker.onmessage = (e) => {
      const { type, progress, result, error } = e.data;
      if (type === 'progress') {
        onProgress(progress);
      } else if (type === 'done') {
        worker.terminate();
        resolve(result);
      } else if (type === 'error') {
        worker.terminate();
        reject(new Error(error));
      }
    };
    
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
    
    worker.postMessage({ type: 'parseGCode', file });
  });
}

export interface GCodePathLayer {
  layerNum: number;
  z: number;
  positions: Float32Array; // [x1, y1, z1, x2, y2, z2, ...] for LineSegments
  colors: Float32Array; // [r1, g1, b1, r2, g2, b2, ...]
}

// Helper to map speed to color (Blue -> Cyan -> Green -> Yellow -> Red)
export function speedToColor(speed: number): [number, number, number] {
  if (speed < 30) return [0, speed / 30, 1];
  if (speed < 60) return [0, 1, 1 - (speed - 30) / 30];
  if (speed < 120) return [(speed - 60) / 60, 1, 0];
  if (speed < 250) return [1, 1 - (speed - 120) / 130, 0];
  return [1, 0, 0];
}

export function parseGCodePath(
  file: File,
  onProgress: (progress: number) => void
): Promise<GCodePathLayer[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/gcodeWorker.ts', import.meta.url), { type: 'module' });
    
    worker.onmessage = (e) => {
      const { type, progress, result, error } = e.data;
      if (type === 'progress') {
        onProgress(progress);
      } else if (type === 'done') {
        worker.terminate();
        resolve(result);
      } else if (type === 'error') {
        worker.terminate();
        reject(new Error(error));
      }
    };
    
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
    
    worker.postMessage({ type: 'parseGCodePath', file });
  });
}

export interface OptimizeOptions {
  flowMultiplier?: number;
}

export async function optimizeGCode(file: File, layerStats: LayerStat[], options?: OptimizeOptions): Promise<Blob> {
  const text = await file.text();
  const lines = text.split('\n');
  const optimizedLines: string[] = [];
  
  let highestZ = -999;
  let layerNum = 0;
  let isSpeedReduced = false;
  let isAccelReduced = false;
  let optimizationsCount = 0;
  
  optimizedLines.push("; ===============================================");
  optimizedLines.push("; --- OPTIMERET AF 3D PRINT OPTIMERER ---");
  optimizedLines.push("; Dato: " + new Date().toLocaleString());
  if (options?.flowMultiplier && options.flowMultiplier !== 100) {
    optimizedLines.push(`; Flow Multiplier: ${options.flowMultiplier}%`);
    optimizedLines.push(`M221 S${options.flowMultiplier} ; >>> OPTIMERET: Global flow rate sat til ${options.flowMultiplier}%`);
  }
  optimizedLines.push("; ===============================================");

  const applyLayerOptimizations = (num: number, output: string[]) => {
    const stats = layerStats.find(s => s.layerNum === num);
    if (stats) {
      // 1. Cooling Optimization
      if (stats.coolingWarning) {
        output.push("M106 S255 ; >>> OPTIMERET: Maksimal køling pga. kort lagtid (Lag " + num + ")");
        optimizationsCount++;
        
        // If layer time is critically short (< 10s), forcefully slow down the print
        if (stats.time < 10) {
          const speedFactor = Math.max(30, Math.round((stats.time / 15) * 100)); // Slow down to min 30%
          output.push(`M220 S${speedFactor} ; >>> OPTIMERET: Hastighed reduceret til ${speedFactor}% for at sikre køling`);
          isSpeedReduced = true;
          optimizationsCount++;
        }
      }

      // 2. Sharp Corner / Quality Optimization
      if (stats.sharpCornerHighSpeedCount > 10) {
        if (!isSpeedReduced) {
          output.push("M220 S80 ; >>> OPTIMERET: Reduceret hastighed pga. skarpe hjørner (Lag " + num + ")");
          isSpeedReduced = true;
          optimizationsCount++;
        }
        if (!isAccelReduced) {
          output.push("M204 P500 ; >>> OPTIMERET: Reduceret acceleration for bedre hjørnekvalitet");
          isAccelReduced = true;
          optimizationsCount++;
        }
      } 
      
      // 3. Reset Optimizations if conditions are normal
      if (!stats.coolingWarning && stats.sharpCornerHighSpeedCount <= 10) {
        if (isSpeedReduced) {
          output.push("M220 S100 ; >>> OPTIMERET: Hastighed nulstillet (Lag " + num + ")");
          isSpeedReduced = false;
        }
        if (isAccelReduced) {
          // Assuming default acceleration is around 1000-1500. We'll use 1000 as a safe default reset.
          output.push("M204 P1000 ; >>> OPTIMERET: Acceleration nulstillet");
          isAccelReduced = false;
        }
      }
    }
  };
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect layer change via comment (preferred)
    if (trimmed.startsWith(';') && (
      trimmed.includes('LAYER:') || 
      trimmed.includes('LAYER_CHANGE') || 
      trimmed.toLowerCase().includes('layer ')
    )) {
      layerNum++;
      applyLayerOptimizations(layerNum, optimizedLines);
    } 
    // Detect layer change via Z height (fallback)
    else if (trimmed.startsWith('G0') || trimmed.startsWith('G1')) {
      const zMatch = trimmed.match(/Z([\d.]+)/);
      const eMatch = trimmed.match(/E([\d.-]+)/);
      
      if (zMatch && eMatch && parseFloat(eMatch[1]) > 0) {
        const newZ = parseFloat(zMatch[1]);
        if (newZ > highestZ + 0.001) {
          highestZ = newZ;
          layerNum++;
          applyLayerOptimizations(layerNum, optimizedLines);
        }
      }
    }
    
    optimizedLines.push(line);
  }

  if (optimizationsCount === 0) {
    optimizedLines.push("; INFO: Ingen kritiske problemer fundet. Ingen ændringer foretaget.");
  } else {
    optimizedLines.push("; INFO: " + optimizationsCount + " optimeringer blev indsat i filen.");
  }
  
  return new Blob([optimizedLines.join('\n')], { type: 'text/plain' });
}
