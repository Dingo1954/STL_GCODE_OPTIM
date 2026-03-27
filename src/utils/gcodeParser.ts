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
  coolingWarning?: boolean;
  cornerPositions?: Float32Array; // [x1, y1, z1, x2, y2, z2, ...] for Points
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
  fixCooling?: boolean;
  fixCorners?: boolean;
  fixFlow?: boolean;
}

export async function optimizeGCode(file: File, layerStats: LayerStat[], options?: OptimizeOptions): Promise<Blob> {
  const text = await file.text();
  const lines = text.split('\n');
  const optimizedLines: string[] = [];
  
  let highestZ = -999;
  let currentZ = -999;
  let lastOptimizedZ = -999;
  let currentSpeedFactor = 100;
  let currentAccel = 1000;
  let optimizationsCount = 0;
  
  optimizedLines.push("; ===============================================");
  optimizedLines.push("; --- OPTIMERET AF 3D PRINT OPTIMERER ---");
  optimizedLines.push("; Dato: " + new Date().toLocaleString());
  if (options?.flowMultiplier && options.flowMultiplier !== 100) {
    optimizedLines.push(`; Flow Multiplier: ${options.flowMultiplier}%`);
    optimizedLines.push(`M221 S${options.flowMultiplier} ; >>> OPTIMERET: Global flow rate sat til ${options.flowMultiplier}%`);
  }
  optimizedLines.push("; ===============================================");

  const applyLayerOptimizations = (zHeight: number, output: string[]) => {
    // Find the stats for the layer that matches this Z height (with a small tolerance)
    const stats = layerStats.find(s => Math.abs(s.z - zHeight) < 0.01);
    
    if (stats && zHeight > lastOptimizedZ + 0.01) {
      lastOptimizedZ = zHeight;
      const needsCoolingFix = options?.fixCooling && stats.coolingWarning;
      const needsCornerFix = options?.fixCorners && stats.sharpCornerHighSpeedCount > 10;
      const needsFlowFix = options?.fixFlow && stats.flow > 15;

      let targetSpeedFactor = 100;
      let targetAccel = 1000;
      let needsCooling = false;

      if (needsCoolingFix) {
        needsCooling = true;
        if (stats.time < 10) {
          targetSpeedFactor = Math.min(targetSpeedFactor, Math.max(30, Math.round((stats.time / 15) * 100)));
        }
      }

      if (needsCornerFix) {
        targetSpeedFactor = Math.min(targetSpeedFactor, 80);
        targetAccel = Math.min(targetAccel, 500);
      }

      if (needsFlowFix) {
        targetSpeedFactor = Math.min(targetSpeedFactor, Math.max(10, Math.round((15 / stats.flow) * 100)));
      }

      if (needsCooling) {
        output.push(`M106 S255 ; >>> OPTIMERET: Maksimal køling pga. kort lagtid (Z: ${zHeight.toFixed(2)})`);
        optimizationsCount++;
      }

      if (targetSpeedFactor !== currentSpeedFactor) {
        output.push(`M220 S${targetSpeedFactor} ; >>> OPTIMERET: Hastighed justeret til ${targetSpeedFactor}% (Z: ${zHeight.toFixed(2)})`);
        currentSpeedFactor = targetSpeedFactor;
        optimizationsCount++;
      }

      if (targetAccel !== currentAccel) {
        output.push(`M204 P${targetAccel} ; >>> OPTIMERET: Acceleration justeret til ${targetAccel} (Z: ${zHeight.toFixed(2)})`);
        currentAccel = targetAccel;
        optimizationsCount++;
      }
    }
  };
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Update current Z height
    if (trimmed.startsWith('G0') || trimmed.startsWith('G1')) {
      const zMatch = trimmed.match(/Z([\d.]+)/);
      if (zMatch) {
        currentZ = parseFloat(zMatch[1]);
      }
      
      // If we are extruding and we are at a new Z height, apply optimizations
      const eMatch = trimmed.match(/E([\d.-]+)/);
      if (eMatch && parseFloat(eMatch[1]) > 0 && currentZ > highestZ + 0.001) {
        highestZ = currentZ;
        applyLayerOptimizations(highestZ, optimizedLines);
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
