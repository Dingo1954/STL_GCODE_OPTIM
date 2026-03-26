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
}

export async function parseGCode(
  file: File, 
  onProgress: (progress: number) => void
): Promise<LayerStat[]> {
  const text = await file.text();
  const lines = text.split('\n');
  
  const layers: LayerStat[] = [];
  
  let currentX = 0, currentY = 0, currentZ = 0, currentE = 0;
  let currentF = 3000; // default 50mm/s
  let currentFanSpeed = 0; // 0-255
  let isRelativeE = false;
  
  // Track previous segment vector for corner detection
  let prevDx = 0;
  let prevDy = 0;
  let prevSpeed = 0;
  
  let highestZ = -999;
  let currentLayerHeight = 0;
  
  let layerTime = 0;
  let layerPrintTime = 0;
  let layerTravelTime = 0;
  let layerFilament = 0;
  let layerMaxSpeed = 0;
  let layerPrintSpeedTotal = 0;
  let layerPrintMoveCount = 0;
  let layerNum = 0;
  let layerMaxFlow = 0;
  let layerTotalFanSpeed = 0;
  let layerFanSpeedSamples = 0;
  let layerSharpCornerHighSpeedCount = 0;
  
  const chunkSize = 50000;

  const pushLayer = () => {
    const avgFanSpeed = layerFanSpeedSamples > 0 ? layerTotalFanSpeed / layerFanSpeedSamples : currentFanSpeed;
    const avgSpeed = layerPrintMoveCount > 0 ? layerPrintSpeedTotal / layerPrintMoveCount : 0;
    
    const coolingWarning = (layerTime < 15 && avgFanSpeed < 127) || 
                           (layerTime > 60 && avgSpeed < 30 && avgFanSpeed < 127);

    layers.push({
      layerNum: ++layerNum,
      z: highestZ,
      layerHeight: currentLayerHeight,
      time: layerTime,
      printTime: layerPrintTime,
      travelTime: layerTravelTime,
      filamentUsed: layerFilament,
      maxSpeed: layerMaxSpeed,
      avgSpeed,
      flow: layerMaxFlow,
      avgFanSpeed,
      sharpCornerHighSpeedCount: layerSharpCornerHighSpeedCount,
      coolingWarning
    });

    layerTime = 0;
    layerPrintTime = 0;
    layerTravelTime = 0;
    layerFilament = 0;
    layerMaxSpeed = 0;
    layerPrintSpeedTotal = 0;
    layerPrintMoveCount = 0;
    layerMaxFlow = 0;
    layerTotalFanSpeed = 0;
    layerFanSpeedSamples = 0;
    layerSharpCornerHighSpeedCount = 0;
  };
  
  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunk = lines.slice(i, i + chunkSize);
    
    for (const line of chunk) {
      const trimmedLine = line.trim();
      
      // Slicer comment layer detection (more reliable)
      if (trimmedLine.startsWith(';') && (
          trimmedLine.includes('LAYER:') || 
          trimmedLine.includes('LAYER_CHANGE') || 
          trimmedLine.toLowerCase().includes('layer ')
      )) {
        if (layerTime > 0) {
          pushLayer();
        }
        continue;
      }

      if (trimmedLine.startsWith('M83')) {
        isRelativeE = true;
        continue;
      } else if (trimmedLine.startsWith('M82')) {
        isRelativeE = false;
        continue;
      }

      // Fan speed detection
      if (trimmedLine.startsWith('M106')) {
        const match = trimmedLine.match(/S(\d+)/);
        if (match) currentFanSpeed = parseInt(match[1], 10);
        continue;
      } else if (trimmedLine.startsWith('M107')) {
        currentFanSpeed = 0;
        continue;
      }

      if (!trimmedLine.startsWith('G0') && !trimmedLine.startsWith('G1')) continue;
      
      const parts = trimmedLine.split(' ');
      let newX = currentX, newY = currentY, newZ = currentZ, newF = currentF;
      let parsedE: number | null = null;
      
      for (const part of parts) {
        if (part.startsWith('X')) newX = parseFloat(part.substring(1));
        if (part.startsWith('Y')) newY = parseFloat(part.substring(1));
        if (part.startsWith('Z')) newZ = parseFloat(part.substring(1));
        if (part.startsWith('E')) parsedE = parseFloat(part.substring(1));
        if (part.startsWith('F')) newF = parseFloat(part.substring(1));
      }
      
      let de = 0;
      let newE = currentE;
      if (parsedE !== null) {
        if (isRelativeE) {
          de = parsedE;
          newE = currentE + de;
        } else {
          de = parsedE - currentE;
          newE = parsedE;
        }
      }

      // Layer change detection (Z increases significantly or we haven't seen this Z before)
      // We only count it as a layer change if there was extrusion on the previous Z
      if (newZ > highestZ + 0.001 && de > 0) {
        if (layerTime > 0) {
          pushLayer();
        }
        
        currentLayerHeight = highestZ === -999 ? newZ : newZ - highestZ;
        highestZ = newZ;
      }
      
      const dx = newX - currentX;
      const dy = newY - currentY;
      const dz = newZ - currentZ;
      
      const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
      const speed = newF / 60; // mm/s
      
      if (distance > 0 || Math.abs(de) > 0) {
        const time = distance > 0 ? distance / speed : Math.abs(de) / speed;
        layerTime += time;
        
        layerTotalFanSpeed += currentFanSpeed;
        layerFanSpeedSamples++;
        
        if (de > 0) {
          // Print move
          layerPrintTime += time;
          layerFilament += de;
          
          if (speed > layerMaxSpeed) layerMaxSpeed = speed;
          layerPrintSpeedTotal += speed;
          layerPrintMoveCount++;
          
          // Corner detection
          if (dx !== 0 || dy !== 0) {
            const len = Math.sqrt(dx*dx + dy*dy);
            const nx = dx / len;
            const ny = dy / len;
            
            if (prevDx !== 0 || prevDy !== 0) {
              const dot = nx * prevDx + ny * prevDy;
              if (dot < 0.5 && speed > 40 && prevSpeed > 40) {
                layerSharpCornerHighSpeedCount++;
              }
            }
            
            prevDx = nx;
            prevDy = ny;
            prevSpeed = speed;
          }
          
          if (time > 0) {
             const volume = Math.PI * Math.pow(1.75/2, 2) * de;
             const flow = volume / time;
             if (flow > layerMaxFlow) layerMaxFlow = flow;
          }
        } else {
          layerTravelTime += time;
          prevDx = 0;
          prevDy = 0;
        }
      }
      
      currentX = newX;
      currentY = newY;
      currentZ = newZ;
      currentE = newE;
      currentF = newF;
    }
    
    await new Promise(r => setTimeout(r, 0));
    onProgress(Math.min(100, Math.round((i / lines.length) * 100)));
  }
  
  // push last layer
  if (layerTime > 0) {
     pushLayer();
  }
  
  return layers;
}

export interface GCodePathLayer {
  layerNum: number;
  z: number;
  positions: Float32Array; // [x1, y1, z1, x2, y2, z2, ...] for LineSegments
}

export async function parseGCodePath(
  file: File,
  onProgress: (progress: number) => void
): Promise<GCodePathLayer[]> {
  const text = await file.text();
  const lines = text.split('\n');
  
  const layers: GCodePathLayer[] = [];
  
  let currentX = 0, currentY = 0, currentZ = 0, currentE = 0;
  let isRelativeE = false;
  let highestZ = -999;
  let layerNum = 0;
  
  let currentLayerPositions: number[] = [];
  
  const chunkSize = 50000;
  
  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunk = lines.slice(i, i + chunkSize);
    
    for (const line of chunk) {
      if (line.startsWith('M83')) {
        isRelativeE = true;
        continue;
      } else if (line.startsWith('M82')) {
        isRelativeE = false;
        continue;
      }

      if (!line.startsWith('G0') && !line.startsWith('G1')) continue;
      
      const parts = line.split(' ');
      let newX = currentX, newY = currentY, newZ = currentZ;
      let parsedE: number | null = null;
      
      for (const part of parts) {
        if (part.startsWith('X')) newX = parseFloat(part.substring(1));
        if (part.startsWith('Y')) newY = parseFloat(part.substring(1));
        if (part.startsWith('Z')) newZ = parseFloat(part.substring(1));
        if (part.startsWith('E')) parsedE = parseFloat(part.substring(1));
      }
      
      let de = 0;
      let newE = currentE;
      if (parsedE !== null) {
        if (isRelativeE) {
          de = parsedE;
          newE = currentE + de;
        } else {
          de = parsedE - currentE;
          newE = parsedE;
        }
      }

      if (newZ > highestZ + 0.001) {
        if (currentLayerPositions.length > 0) {
          layers.push({
            layerNum,
            z: highestZ,
            positions: new Float32Array(currentLayerPositions)
          });
        }
        highestZ = newZ;
        layerNum++;
        currentLayerPositions = [];
      }
      
      if (de > 0) {
        // Extrusion move - add line segment
        // Three.js uses Y up, Z forward by default. GCode uses Z up.
        // We map X->X, Y->Z, Z->Y to match standard Three.js axes, or we can just keep them raw
        // and rotate the group. Let's keep them raw: X, Y, Z.
        currentLayerPositions.push(currentX, currentY, currentZ);
        currentLayerPositions.push(newX, newY, newZ);
      }
      
      currentX = newX;
      currentY = newY;
      currentZ = newZ;
      currentE = newE;
    }
    
    await new Promise(r => setTimeout(r, 0));
    onProgress(Math.min(100, Math.round((i / lines.length) * 100)));
  }
  
  if (currentLayerPositions.length > 0) {
    layers.push({
      layerNum,
      z: highestZ,
      positions: new Float32Array(currentLayerPositions)
    });
  }
  
  return layers;
}

export async function optimizeGCode(file: File, layerStats: LayerStat[]): Promise<Blob> {
  const text = await file.text();
  const lines = text.split('\n');
  const optimizedLines: string[] = [];
  
  let highestZ = -999;
  let layerNum = 0;
  let isSpeedReduced = false;
  let optimizationsCount = 0;
  
  optimizedLines.push("; ===============================================");
  optimizedLines.push("; --- OPTIMERET AF 3D PRINT OPTIMERER ---");
  optimizedLines.push("; Dato: " + new Date().toLocaleString());
  optimizedLines.push("; ===============================================");

  const applyLayerOptimizations = (num: number, output: string[]) => {
    const stats = layerStats.find(s => s.layerNum === num);
    if (stats) {
      if (stats.coolingWarning) {
        output.push("M106 S255 ; >>> OPTIMERET: Øget køling pga. kort lagtid (Lag " + num + ")");
        optimizationsCount++;
      }
      if (stats.sharpCornerHighSpeedCount > 10) {
        output.push("M220 S80 ; >>> OPTIMERET: Reduceret hastighed pga. skarpe hjørner (Lag " + num + ")");
        isSpeedReduced = true;
        optimizationsCount++;
      } else if (isSpeedReduced) {
        output.push("M220 S100 ; >>> OPTIMERET: Hastighed nulstillet (Lag " + num + ")");
        isSpeedReduced = false;
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
