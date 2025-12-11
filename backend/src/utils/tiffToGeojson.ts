import { logger } from '@utils/logger';
import { fromArrayBuffer } from 'geotiff';
import * as turf from '@turf/turf';
import type { FloodFeature } from '@interfaces/types';
import type { BBox } from 'geojson'; 

import { MIN_PIXEL_AREA_THRESHOLD, MIN_AREA_THRESHOLD_SQ_METERS } from '@root/config';

/**
 * Używa prostego algorytmu BFS (Breadth-First Search) do znalezienia 
 * połączonych obszarów i odrzucenia tych, które są mniejsze niż próg.
 */
function filterByConnectedArea(data: Float32Array, width: number, height: number): Float32Array {
  const visited = new Array(width * height).fill(false);
  const cleanedData = new Float32Array(data.length).fill(0); // Czysta tablica wynikowa
  
  // Kierunki ruchu: 8 sąsiadów (możesz użyć tylko 4, ale 8 daje lepsze połączenie)
  const directions = [
      [-1, 0], [1, 0], [0, -1], [0, 1], // 4-połączenie
      [-1, -1], [-1, 1], [1, -1], [1, 1] // 8-połączenie
  ];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;

      // 1. Sprawdzamy tylko nowe, powodziowe piksele
      if (data[index] > 0 && !visited[index]) {
          
        let currentArea: Array<number> = []; // Indeksy pikseli w bieżącej plamie
        let queue: Array<[number, number]> = [[x, y]]; // Kolejka BFS
        visited[index] = true;

        // 2. BFS: Znajdowanie wszystkich połączonych pikseli
        while (queue.length > 0) {
          const [cx, cy] = queue.shift()!;
          const cIndex = cy * width + cx;
          currentArea.push(cIndex);

          for (const [dx, dy] of directions) {
            const nx = cx + dx;
            const ny = cy + dy;
            const nIndex = ny * width + nx;

            // Warunki brzegowe i sprawdzenie stanu
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && 
                !visited[nIndex] && data[nIndex] > 0) 
            {
              visited[nIndex] = true;
              queue.push([nx, ny]);
            }
          }
        }
        
        // 3. Sprawdzenie progu: Czy plama jest wystarczająco duża?
        if (currentArea.length >= MIN_PIXEL_AREA_THRESHOLD) {
          // Jeśli tak, zachowujemy piksele w tablicy wyjściowej
          for (const idx of currentArea) {
            cleanedData[idx] = data[idx];
          }
        }
      }
    }
  }
  return cleanedData;
}

export async function processTiffToGeojson(arrayBuffer: ArrayBuffer, requestBbox: BBox): Promise<FloodFeature[]> {
  logger.debug("TIFF:PROCESS", "Rozpoczynam parsowanie Geotiff i wektoryzację.");
  
  const tiff = await fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters();
  const data = rasters[0] as Float32Array;
  
  const width = image.getWidth();
  const height = image.getHeight();
  
  let originX, originY, pixelSizeX, pixelSizeY;

  if (requestBbox && requestBbox.length === 4) {
      
    const [minLon, minLat, maxLon, maxLat] = requestBbox;
    
    // Obliczanie rozmiaru piksela: (Maksymalna współrzędna - Minimalna współrzędna) / Liczba pikseli
    pixelSizeX = (maxLon - minLon) / width;
    pixelSizeY = (maxLat - minLat) / height;
    
    // Początek (Origin): Górny lewy róg
    originX = minLon; 
    
    // Ponieważ rastry startują z góry (maksymalna Lat)
    originY = maxLat; 
    
    // Musimy odwrócić Y, aby pixelSizeY był ujemny, co jest standardem w rastrach (Y rośnie w dół, Lat maleje)
    pixelSizeY *= -1;
    
    logger.info("TIFF:PROCESS", "⚠️ Używam georeferencji BBOX/rozmiar rastra.");
      
  } else {
    logger.error("TIFF:PROCESS", "❌ Krytyczny błąd: Nie odczytano kluczy, a BBOX jest niepoprawny.");
    return [];
  }

  if (pixelSizeX === 0 || pixelSizeY === 0) {
    logger.error("TIFF:PROCESS", "❌ Krytyczny błąd: Wymiary piksela są zerowe (zły BBOX/rozmiar rastra).");
    return [];
  }
  
  const floodFeatures: FloodFeature[] = [];

  const cleanedData = filterByConnectedArea(data, width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelValue = cleanedData[y * width + x];
      
      if (pixelValue > 0) { 
          
        const lonMin = originX + x * pixelSizeX;
        const lonMax = originX + (x + 1) * pixelSizeX;
        
        const lat1 = originY + y * pixelSizeY;
        const lat2 = originY + (y + 1) * pixelSizeY;
        
        const latMin = Math.min(lat1, lat2);
        const latMax = Math.max(lat1, lat2);

        const polygon: GeoJSON.Polygon = {
          type: 'Polygon',
          coordinates: [[
            [lonMin, latMin],
            [lonMax, latMin],
            [lonMax, latMax],
            [lonMin, latMax],
            [lonMin, latMin]
          ]],
        };

        floodFeatures.push({
          type: 'Feature',
          geometry: polygon,
        } as FloodFeature);
      }
    }
  }
  if (floodFeatures.length === 0) {
    return [];
  }
  
  // Zbieramy wszystkie poligony w FeatureCollection
  const featureCollection = turf.featureCollection(floodFeatures);

  // turf.dissolve jest najczęściej używany do łączenia sąsiadujących/nakładających się geometrii
  // Bez podawania właściwości 'property', turf.dissolve łączy wszystko.
  try {
    const dissolvedFeatures = turf.dissolve(featureCollection);
    
    const finalFeatures: FloodFeature[] = [];
    
    // 3. FILTROWANIE PO POWIERZCHNI
    for (const feature of dissolvedFeatures.features) {
      // turf.area zwraca powierzchnię w metrach kwadratowych (jeśli dane są w WGS84)
      const area = turf.area(feature); 

      if (area >= MIN_AREA_THRESHOLD_SQ_METERS) {
        // Zachowujemy tylko poligony o wystarczającej powierzchni
        if (feature.geometry.type === 'Polygon') {
          // Dla pojedynczego Poligonu: zachowujemy tylko pierwszy pierścień (external shell)
          // Pozostałe pierścienie to dziury, które chcemy usunąć.
          feature.geometry.coordinates = [feature.geometry.coordinates[0]];
            
        } else if (feature.geometry.type === 'MultiPolygon') {
          // Dla MultiPoligonu: iterujemy przez każdy Poligon w kolekcji
          feature.geometry.coordinates = feature.geometry.coordinates.map(polygonCoords => {
            return [polygonCoords[0]];
          });
        }

        feature.properties = { risk_cost: 500, area: area }; 
        finalFeatures.push(feature as FloodFeature);
      }
    }

    logger.info("TIFF:PROCESS", `✅ Scalono do ${finalFeatures.length} dużych poligonów.`);
    return finalFeatures;

  } catch (e) {
    logger.error("TIFF:PROCESS", `Błąd podczas scalania (turf.dissolve): ${(e as Error).message}. Zwracam niescalone poligony.`);
    return floodFeatures;
  }
}
