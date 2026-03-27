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
  coolingThreshold?: number;
  speedReductionPercent?: number;
  flowLimit?: number;
}

export interface OptimizationLog {
  lineNum: number;
  message: string;
}

export async function optimizeGCode(file: File, layerStats: LayerStat[], options?: OptimizeOptions): Promise<{ blob: Blob, logs: OptimizationLog[] }> {
  const logs: OptimizationLog[] = [];
  const blobParts: string[] = [];
  
  let highestZ = -999;
  let currentZ = -999;
  let lastOptimizedZ = -999;
  let currentSpeedFactor = 100;
  let currentAccel = 1000;
  let optimizationsCount = 0;
  let lineNum = 0;
  
  let isCoolingForced = false;
  let isSpeedForced = false;
  let isAccelForced = false;
  
  const header: string[] = [];
  header.push("; ===============================================");
  header.push("; --- OPTIMERET AF 3D PRINT OPTIMERER ---");
  header.push("; Dato: " + new Date().toLocaleString());
  if (options?.flowMultiplier && options.flowMultiplier !== 100) {
    header.push(`; Flow Multiplier: ${options.flowMultiplier}%`);
    const msg = `M221 S${options.flowMultiplier} ; >>> OPTIMERET: Global flow rate sat til ${options.flowMultiplier}%`;
    header.push(msg);
    logs.push({ lineNum: 0, message: msg });
  }
  header.push("; ===============================================");
  header.push("");
  blobParts.push(header.join('\n') + '\n');

  let currentLayerIndex = 0;

  const applyLayerOptimizations = (zHeight: number, output: string[]) => {
    // Find the stats for the layer that matches this Z height (with a small tolerance)
    let stats = null;
    // Start searching from the current index to avoid O(N^2) complexity
    for (let i = currentLayerIndex; i < layerStats.length; i++) {
      if (Math.abs(layerStats[i].z - zHeight) < 0.01) {
        stats = layerStats[i];
        currentLayerIndex = i;
        break;
      }
    }
    
    if (!stats) {
      // Fallback: search from the beginning if not found (e.g., non-sequential Z heights)
      stats = layerStats.find(s => Math.abs(s.z - zHeight) < 0.01);
    }
    
    if (stats && zHeight > lastOptimizedZ + 0.01) {
      lastOptimizedZ = zHeight;
      
      const coolingThresh = options?.coolingThreshold ?? 10;
      const speedReduc = options?.speedReductionPercent ?? 80;
      const flowLim = options?.flowLimit ?? 15;

      const needsCoolingFix = options?.fixCooling && (stats.coolingWarning || stats.time < coolingThresh);
      const needsCornerFix = options?.fixCorners && stats.sharpCornerHighSpeedCount > 10;
      const needsFlowFix = options?.fixFlow && stats.flow > flowLim;

      let targetSpeedFactor = 100;
      let targetAccel = 1000;
      let needsCooling = false;

      if (needsCoolingFix) {
        needsCooling = true;
        isCoolingForced = true;
        if (stats.time < coolingThresh) {
          targetSpeedFactor = Math.min(targetSpeedFactor, Math.max(30, Math.round((stats.time / (coolingThresh * 1.5)) * 100)));
        }
      } else {
        isCoolingForced = false;
      }

      if (needsCornerFix) {
        targetSpeedFactor = Math.min(targetSpeedFactor, speedReduc);
        targetAccel = Math.min(targetAccel, 500);
      }

      if (needsFlowFix) {
        targetSpeedFactor = Math.min(targetSpeedFactor, Math.max(10, Math.round((flowLim / stats.flow) * 100)));
      }

      if (needsCooling) {
        const msg = `M106 S255 ; >>> OPTIMERET: Maksimal køling pga. kort lagtid (Z: ${zHeight.toFixed(2)}, Tid: ${stats.time.toFixed(1)}s)`;
        output.push(msg);
        logs.push({ lineNum: lineNum + output.length, message: msg });
        optimizationsCount++;
      }

      if (targetSpeedFactor !== currentSpeedFactor) {
        let reason = 'Ukendt';
        if (needsCoolingFix && stats.time < 10) reason = `Kort lagtid (${stats.time.toFixed(1)}s)`;
        else if (needsCornerFix) reason = `Skarpe hjørner (${stats.sharpCornerHighSpeedCount})`;
        else if (needsFlowFix) reason = `Højt flow (${stats.flow.toFixed(1)} mm³/s)`;
        
        const msg = `M220 S${targetSpeedFactor} ; >>> OPTIMERET: Hastighed justeret til ${targetSpeedFactor}% pga. ${reason} (Z: ${zHeight.toFixed(2)})`;
        output.push(msg);
        logs.push({ lineNum: lineNum + output.length, message: msg });
        currentSpeedFactor = targetSpeedFactor;
        optimizationsCount++;
        isSpeedForced = true;
      } else {
        isSpeedForced = false;
      }

      if (targetAccel !== currentAccel) {
        const msg = `M204 P${targetAccel} ; >>> OPTIMERET: Acceleration justeret til ${targetAccel} pga. Skarpe hjørner (${stats.sharpCornerHighSpeedCount}) (Z: ${zHeight.toFixed(2)})`;
        output.push(msg);
        logs.push({ lineNum: lineNum + output.length, message: msg });
        currentAccel = targetAccel;
        optimizationsCount++;
        isAccelForced = true;
      } else {
        isAccelForced = false;
      }
    }
  };
  
  const chunkSize = 1024 * 1024 * 2; // 2MB chunks
  let offset = 0;
  let leftover = '';

  while (offset < file.size) {
    const slice = file.slice(offset, offset + chunkSize);
    const text = await slice.text();
    const chunkStr = leftover + text;
    const lines = chunkStr.split('\n');
    
    if (offset + chunkSize < file.size) {
      leftover = lines.pop() || '';
    } else {
      leftover = '';
    }

    const chunkOutput: string[] = [];
    for (const line of lines) {
      lineNum++;
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
          applyLayerOptimizations(highestZ, chunkOutput);
        }
      }
      
      // Comment out conflicting slicer commands if we forced an optimization for this layer
      if (trimmed.startsWith('M106') || trimmed.startsWith('M107')) {
        if (isCoolingForced) {
          chunkOutput.push(`; ${line} ; >>> OPTIMERET: Deaktiveret af 3D Print Optimerer (tvungen køling for dette lag)`);
          continue;
        }
      } else if (trimmed.startsWith('M220')) {
        if (isSpeedForced) {
          chunkOutput.push(`; ${line} ; >>> OPTIMERET: Deaktiveret af 3D Print Optimerer (tvungen hastighed for dette lag)`);
          continue;
        }
      } else if (trimmed.startsWith('M204')) {
        if (isAccelForced) {
          chunkOutput.push(`; ${line} ; >>> OPTIMERET: Deaktiveret af 3D Print Optimerer (tvungen acceleration for dette lag)`);
          continue;
        }
      } else if (trimmed.startsWith('M221')) {
        if (options?.flowMultiplier && options.flowMultiplier !== 100) {
          chunkOutput.push(`; ${line} ; >>> OPTIMERET: Deaktiveret af 3D Print Optimerer (tvunget globalt flow)`);
          continue;
        }
      }
      
      chunkOutput.push(line);
    }
    
    blobParts.push(chunkOutput.join('\n') + '\n');
    offset += chunkSize;
    
    // Yield to the main thread to prevent UI freezing
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  if (leftover) {
    lineNum++;
    const chunkOutput: string[] = [];
    const trimmed = leftover.trim();
    if (trimmed.startsWith('G0') || trimmed.startsWith('G1')) {
      const zMatch = trimmed.match(/Z([\d.]+)/);
      if (zMatch) currentZ = parseFloat(zMatch[1]);
      const eMatch = trimmed.match(/E([\d.-]+)/);
      if (eMatch && parseFloat(eMatch[1]) > 0 && currentZ > highestZ + 0.001) {
        highestZ = currentZ;
        applyLayerOptimizations(highestZ, chunkOutput);
      }
    }
    
    if (trimmed.startsWith('M106') || trimmed.startsWith('M107')) {
      if (isCoolingForced) {
        chunkOutput.push(`; ${leftover} ; >>> OPTIMERET: Deaktiveret af 3D Print Optimerer (tvungen køling for dette lag)`);
      } else {
        chunkOutput.push(leftover);
      }
    } else if (trimmed.startsWith('M220')) {
      if (isSpeedForced) {
        chunkOutput.push(`; ${leftover} ; >>> OPTIMERET: Deaktiveret af 3D Print Optimerer (tvungen hastighed for dette lag)`);
      } else {
        chunkOutput.push(leftover);
      }
    } else if (trimmed.startsWith('M204')) {
      if (isAccelForced) {
        chunkOutput.push(`; ${leftover} ; >>> OPTIMERET: Deaktiveret af 3D Print Optimerer (tvungen acceleration for dette lag)`);
      } else {
        chunkOutput.push(leftover);
      }
    } else if (trimmed.startsWith('M221')) {
      if (options?.flowMultiplier && options.flowMultiplier !== 100) {
        chunkOutput.push(`; ${leftover} ; >>> OPTIMERET: Deaktiveret af 3D Print Optimerer (tvunget globalt flow)`);
      } else {
        chunkOutput.push(leftover);
      }
    } else {
      chunkOutput.push(leftover);
    }
    
    blobParts.push(chunkOutput.join('\n') + '\n');
  }

  const footer: string[] = [];
  if (optimizationsCount === 0) {
    footer.push("; INFO: Ingen kritiske problemer fundet. Ingen ændringer foretaget.");
  } else {
    footer.push("; INFO: " + optimizationsCount + " optimeringer blev indsat i filen.");
  }
  blobParts.push(footer.join('\n'));
  
  return { blob: new Blob(blobParts, { type: 'text/plain' }), logs };
}
