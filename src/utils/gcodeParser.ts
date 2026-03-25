export interface LayerStat {
  layerNum: number;
  z: number;
  time: number; // in seconds
  maxSpeed: number; // mm/s
  avgSpeed: number; // mm/s
  flow: number; // mm^3/s (approx)
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
  
  let layerTime = 0;
  let layerMaxSpeed = 0;
  let layerTotalSpeed = 0;
  let layerMoveCount = 0;
  let layerNum = 0;
  let layerMaxFlow = 0;
  
  const chunkSize = 50000;
  
  for (let i = 0; i < lines.length; i += chunkSize) {
    const chunk = lines.slice(i, i + chunkSize);
    
    for (const line of chunk) {
      if (!line.startsWith('G0') && !line.startsWith('G1')) continue;
      
      const parts = line.split(' ');
      let newX = currentX, newY = currentY, newZ = currentZ, newE = currentE, newF = currentF;
      
      for (const part of parts) {
        if (part.startsWith('X')) newX = parseFloat(part.substring(1));
        if (part.startsWith('Y')) newY = parseFloat(part.substring(1));
        if (part.startsWith('Z')) newZ = parseFloat(part.substring(1));
        if (part.startsWith('E')) newE = parseFloat(part.substring(1));
        if (part.startsWith('F')) newF = parseFloat(part.substring(1));
      }
      
      // Layer change detection (Z increases)
      if (newZ > currentZ + 0.01) {
        if (layerNum > 0 || layerTime > 0) {
          layers.push({
            layerNum,
            z: currentZ,
            time: layerTime,
            maxSpeed: layerMaxSpeed,
            avgSpeed: layerMoveCount > 0 ? layerTotalSpeed / layerMoveCount : 0,
            flow: layerMaxFlow
          });
        }
        layerNum++;
        layerTime = 0;
        layerMaxSpeed = 0;
        layerTotalSpeed = 0;
        layerMoveCount = 0;
        layerMaxFlow = 0;
      }
      
      const dx = newX - currentX;
      const dy = newY - currentY;
      const dz = newZ - currentZ;
      const de = newE - currentE;
      
      const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
      const speed = newF / 60; // mm/s
      
      if (distance > 0) {
        const time = distance / speed;
        layerTime += time;
        
        if (speed > layerMaxSpeed) layerMaxSpeed = speed;
        layerTotalSpeed += speed;
        layerMoveCount++;
        
        // Approximate flow rate: Volume / Time
        // Volume = Area * distance = (pi * (1.75/2)^2) * de
        if (de > 0) {
           const volume = Math.PI * Math.pow(1.75/2, 2) * de;
           const flow = volume / time;
           if (flow > layerMaxFlow) layerMaxFlow = flow;
        }
      }
      
      currentX = newX;
      currentY = newY;
      currentZ = newZ;
      currentE = newE;
      currentF = newF;
    }
    
    // Yield to main thread
    await new Promise(r => setTimeout(r, 0));
    onProgress(Math.min(100, Math.round((i / lines.length) * 100)));
  }
  
  // push last layer
  if (layerTime > 0) {
     layers.push({
        layerNum,
        z: currentZ,
        time: layerTime,
        maxSpeed: layerMaxSpeed,
        avgSpeed: layerMoveCount > 0 ? layerTotalSpeed / layerMoveCount : 0,
        flow: layerMaxFlow
      });
  }
  
  return layers;
}
