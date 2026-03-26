import { LayerStat, GCodePathLayer } from '../utils/gcodeParser';

// Helper to map speed to color (Blue -> Cyan -> Green -> Yellow -> Red)
function speedToColor(speed: number): [number, number, number] {
  if (speed < 30) return [0, speed / 30, 1];
  if (speed < 60) return [0, 1, 1 - (speed - 30) / 30];
  if (speed < 120) return [(speed - 60) / 60, 1, 0];
  if (speed < 250) return [1, 1 - (speed - 120) / 130, 0];
  return [1, 0, 0];
}

self.onmessage = async (e: MessageEvent) => {
  const { type, file } = e.data;
  
  if (type === 'parseGCode') {
    try {
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
      
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      
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
      let layerFeatureTimes: Record<string, number> = {};
      
      let currentFeatureType = 'Unknown';
      
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
          coolingWarning,
          featureTimes: { ...layerFeatureTimes }
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
        layerFeatureTimes = {};
      };
      
      for (let i = 0; i < lines.length; i += chunkSize) {
        const chunk = lines.slice(i, i + chunkSize);
        
        for (const line of chunk) {
          const trimmedLine = line.trim();
          
          // Feature type detection
          if (trimmedLine.startsWith(';TYPE:') || trimmedLine.startsWith('; TYPE:')) {
            currentFeatureType = trimmedLine.split(':')[1].trim();
          } else if (trimmedLine.startsWith('; feature ')) {
            currentFeatureType = trimmedLine.replace('; feature ', '').trim();
          } else if (trimmedLine.startsWith('; printing type:')) {
            currentFeatureType = trimmedLine.split(':')[1].trim();
          }

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

          if (de > 0) {
            if (newX < minX) minX = newX;
            if (newX > maxX) maxX = newX;
            if (newY < minY) minY = newY;
            if (newY > maxY) maxY = newY;
            if (newZ < minZ) minZ = newZ;
            if (newZ > maxZ) maxZ = newZ;
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
            
            // Track time per feature
            if (de > 0) {
              layerFeatureTimes[currentFeatureType] = (layerFeatureTimes[currentFeatureType] || 0) + time;
            }

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
        
        self.postMessage({ type: 'progress', progress: Math.min(100, Math.round((i / lines.length) * 100)) });
      }
      
      // push last layer
      if (layerTime > 0) {
         pushLayer();
      }
      
      self.postMessage({ type: 'done', result: { layers, boundingBox: { minX, maxX, minY, maxY, minZ, maxZ } } });
    } catch (err) {
      self.postMessage({ type: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  } else if (type === 'parseGCodePath') {
    try {
      const text = await file.text();
      const lines = text.split('\n');
      
      const layers: GCodePathLayer[] = [];
      
      let currentX = 0, currentY = 0, currentZ = 0, currentE = 0;
      let currentF = 3000;
      let isRelativeE = false;
      let highestZ = -999;
      let layerNum = 0;
      
      let currentLayerPositions: number[] = [];
      let currentLayerColors: number[] = [];
      
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
          let newF = currentF;
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

          if (newZ > highestZ + 0.001) {
            if (currentLayerPositions.length > 0) {
              layers.push({
                layerNum,
                z: highestZ,
                positions: new Float32Array(currentLayerPositions),
                colors: new Float32Array(currentLayerColors)
              });
            }
            highestZ = newZ;
            layerNum++;
            currentLayerPositions = [];
            currentLayerColors = [];
          }
          
          if (de > 0) {
            // Extrusion move - add line segment
            currentLayerPositions.push(currentX, currentY, currentZ);
            currentLayerPositions.push(newX, newY, newZ);
            
            // Calculate color based on speed
            const speed = newF / 60; // mm/s
            const color = speedToColor(speed);
            currentLayerColors.push(color[0], color[1], color[2]);
            currentLayerColors.push(color[0], color[1], color[2]);
          }
          
          currentX = newX;
          currentY = newY;
          currentZ = newZ;
          currentE = newE;
          currentF = newF;
        }
        
        self.postMessage({ type: 'progress', progress: Math.min(100, Math.round((i / lines.length) * 100)) });
      }
      
      if (currentLayerPositions.length > 0) {
        layers.push({
          layerNum,
          z: highestZ,
          positions: new Float32Array(currentLayerPositions),
          colors: new Float32Array(currentLayerColors)
        });
      }
      
      self.postMessage({ type: 'done', result: layers });
    } catch (err) {
      self.postMessage({ type: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  }
};
