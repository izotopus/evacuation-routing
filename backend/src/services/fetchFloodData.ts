import { logger } from '@utils/logger';
import { getSentinelHubToken } from './sentinelAuth';
import { FloodFeature } from '@interfaces/types';
import { BBox } from 'geojson'; 
import { fromArrayBuffer } from 'geotiff';
import * as turf from '@turf/turf';

import * as fs from 'fs';
import * as path from 'path';
const DEBUG_OUTPUT_PATH = path.join(process.cwd(), 'data', 'downloaded_flood.tiff');

const MIN_PIXEL_AREA_THRESHOLD = 1;

const PROCESSING_API_URL = 'https://services.sentinel-hub.com/api/v1/process';

const EVALSCRIPT_PATH = path.join(process.cwd(), 'data', 'evalscript_flood.js');

/**
 * Czyści raster z pojedynczych, szumiących pikseli.
 * Używa prostego algorytmu sąsiedztwa, by zostawić tylko grupy większe niż MIN_PIXEL_AREA_THRESHOLD.
 * * @param data Dane rastrowe (np. Float32Array)
 * @param width Szerokość rastra
 * @param height Wysokość rastra
 * @returns Nowa, "oczyszczona" tablica danych
 */
function cleanRasterData(data: Float32Array, width: number, height: number): Float32Array {
  // Tworzymy kopię, by nie modyfikować oryginalnych danych
  const cleanedData = new Float32Array(data); 

  // Pętla omija krawędzie (dla prostoty)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      const pixelValue = data[index];
      // Interesują nas tylko piksele oznaczone jako powódź
      if (pixelValue <= 0) {
      // if (pixelValue > 0) {
        
        let neighborCount = 0;
        
        // Sprawdzanie 8 sąsiadów
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue; // Pomiń siebie
            
            const neighborIndex = (y + dy) * width + (x + dx);
            
            // Sprawdzenie, czy sąsiad jest powodzią
            if (data[neighborIndex] > 0) { 
              neighborCount++;
            }
          }
        }
        
        // Jeśli piksel ma zbyt mało sąsiadów, uznajemy go za szum i go usuwamy
        // UWAGA: Można tu zastosować bardziej zaawansowany "Region Growing"

        if (neighborCount < MIN_PIXEL_AREA_THRESHOLD) { 
          cleanedData[index] = 0; // Ustawienie wartości na 'brak powodzi'
        }
      }
    }
  }
  return cleanedData;
}

/**
 * Używa prostego algorytmu BFS (Breadth-First Search) do znalezienia 
 * połączonych obszarów i odrzucenia tych, które są mniejsze niż próg.
 */
function filterByConnectedArea(data: Float32Array, width: number, height: number): Float32Array {
    const MIN_PIXEL_AREA_THRESHOLD = 5; // Może być stałą globalną

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

async function processTiffToGeojson(arrayBuffer: ArrayBuffer, requestBbox: BBox): Promise<FloodFeature[]> {
    logger.debug("TIFF:PROCESS", "Rozpoczynam parsowanie Geotiff i wektoryzację.");
    
    const tiff = await fromArrayBuffer(arrayBuffer);
    const image = await tiff.getImage();
    const rasters = await image.readRasters();
    const data = rasters[0] as Float32Array;
    
    
    const width = image.getWidth();
    const height = image.getHeight();
    
    // --- POPRAWNE POZYSKANIE MATRYCY Z TAGÓW ---
    
    // 1. Spróbuj odczytać tag matrycy transformacji (kod 34264)
    // Matryca jest tablicą 16-elementową (4x4)
    const transformTag = image.getFileDirectory().ModelTransformationTag;
    
    // 2. Jeśli tag nie istnieje, próbujemy odczytać tradycyjne klucze
    const tiePoint = image.getGeoKeys().ModelTiepoint; 
    const pixelScale = image.getGeoKeys().ModelPixelScale; 
    
    let originX, originY, pixelSizeX, pixelSizeY;

    // AWARIJNY OBLICZENIA Z BBOX (jeśli klucze są puste, co wiemy z logów)
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
        
        logger.warn("TIFF:PROCESS", "⚠️ Używam awaryjnej georeferencji BBOX/rozmiar rastra. Klucze TIFF nieobecne.");
        
    } else {
        logger.error("TIFF:PROCESS", "❌ Krytyczny błąd: Nie odczytano kluczy, a BBOX jest niepoprawny.");
        return [];
    }

    // Sprawdzenie, czy obliczenia mają sens
    if (pixelSizeX === 0 || pixelSizeY === 0) {
        logger.error("TIFF:PROCESS", "❌ Krytyczny błąd: Wymiary piksela są zerowe (zły BBOX/rozmiar rastra).");
        return [];
    }
    
    // --- LOGOWANIE DANYCH TRANSFORMACJI AWARIJNEJ ---
    // logger.debug("TIFF:PROCESS", `OriginX: ${originX}, OriginY: ${originY}`);
    // logger.debug("TIFF:PROCESS", `PixelSizeX: ${pixelSizeX}, PixelSizeY: ${pixelSizeY}`);

    // ... (funkcja cleanRasterData, jeśli jest używana)
    // const cleanedData = cleanRasterData(data, width, height);

    const floodFeatures: FloodFeature[] = [];

    const cleanedData = filterByConnectedArea(data, width, height);
    // const cleanedData = cleanRasterData(data, width, height);

    // Iteracja po pikselach
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
                  [lonMin, latMin] // Zamykający
                ]],
              };

              // Dodanie do wyniku
              floodFeatures.push({
                type: 'Feature',
                geometry: polygon,
                /* properties: { 
                  risk_cost: 500, 
                  pixel_value: pixelValue
                }, */
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
        
        // Funkcja dissolve zwraca FeatureCollection. Musimy tylko przepisać typ.
        const finalFeatures = dissolvedFeatures.features.map(f => {
             // Jeśli oryginalna kara to 500, musimy ją przypisać do scalonej geometrii
             f.properties = { risk_cost: 500 }; 
             return f as FloodFeature;
        });

        logger.info("TIFF:PROCESS", `✅ Scalono do ${finalFeatures.length} dużych poligonów.`);
        return finalFeatures;

    } catch (e) {
        logger.error("TIFF:PROCESS", `Błąd podczas scalania (turf.dissolve): ${(e as Error).message}. Zwracam niescalone poligony.`);
        return floodFeatures;
    }
    
    return floodFeatures;
}

async function _processTiffToGeojson(arrayBuffer: ArrayBuffer): Promise<FloodFeature[]> {
  // ...
  const tiff = await fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();
  const rasters = await image.readRasters();
  const data = rasters[0] as Float32Array;
  
  const width = image.getWidth();
  const height = image.getHeight();
  
  // --- POPRAWNE UZYSKANIE DANYCH GEOTRANSFORMACJI ---
  
  // Pobranie Tablicy Tie Points (zazwyczaj [X-coord, Y-coord, Z-coord, Lon, Lat, Alt])
  const tiePoint = image.getGeoKeys().ModelTiepoint; 
  
  // Pobranie skali piksela (rozdzielczość w jednostkach geograficznych)
  const pixelScale = image.getGeoKeys().ModelPixelScale; 
  
  // Ustalenie punktu startowego (górny lewy narożnik)
  // tiePoint[3] = Lon / E-W
  // tiePoint[4] = Lat / N-S
  const originX = tiePoint && tiePoint.length >= 4 ? tiePoint[3] : 0; 
  const originY = tiePoint && tiePoint.length >= 5 ? tiePoint[4] : 0;

  // Ustalenie rozmiaru piksela
  // pixelScale[0] = rozmiar w osi X
  // pixelScale[1] = rozmiar w osi Y (musi być ujemny, jeśli idziemy w dół)
  const pixelSizeX = pixelScale && pixelScale.length >= 1 ? pixelScale[0] : 0;
  const pixelSizeY = pixelScale && pixelScale.length >= 2 ? pixelScale[1] * -1 : 0;

  logger.debug("TIFF:PROCESS", `OriginX: ${originX}, OriginY: ${originY}`);
  logger.debug("TIFF:PROCESS", `PixelSizeX: ${pixelSizeX}, PixelSizeY: ${pixelSizeY}`);
  
  // --------------------------------------------------

  const floodFeatures: FloodFeature[] = [];

  const cleanedData = cleanRasterData(data, width, height);

  // Iteracja po pikselach
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelValue = cleanedData[y * width + x];

      if (pixelValue > 0) {
        
        // Obliczenie geograficznych współrzędnych narożników piksela
        // X (Lon)
        const lonMin = originX + x * pixelSizeX;
        const lonMax = originX + (x + 1) * pixelSizeX;
        
        // Y (Lat) - UWAGA: Y w rastrze rośnie w dół, a Lat rośnie w górę
        const latMax = originY + y * pixelSizeY; 
        const latMin = originY + (y + 1) * pixelSizeY;
        
        // Tworzenie GeoJSON Polygon dla tego piksela (Tesselacja)
        const polygon: GeoJSON.Polygon = {
          type: 'Polygon',
          coordinates: [[
            [lonMin, latMin],
            [lonMax, latMin],
            [lonMax, latMax],
            [lonMin, latMax],
            [lonMin, latMin] // Zamykający
          ]],
        };

        // Dodanie do wyniku
        floodFeatures.push({
          type: 'Feature',
          geometry: polygon,
          /* properties: { 
            risk_cost: 500, 
            pixel_value: pixelValue
          }, */
        } as FloodFeature);
      }
    }
  }
  // ...
  return floodFeatures;
}

/**
 * Pobiera dane o zakresie powodzi (Geotiff) z Sentinel Hub na podstawie BBOX
 * i konwertuje je do formatu GeoJSON Polygon.
 * * @param bbox Bounding Box ([minLon, minLat, maxLon, maxLon])
 * @returns Tablica cech GeoJSON Polygon
 */
export async function fetchFloodData(bbox: BBox): Promise<FloodFeature[]> {
  logger.info("FETCH:SH", `Pobieranie danych powodziowych dla BBOX: ${bbox.join(', ')}`);

  if (fs.existsSync(DEBUG_OUTPUT_PATH)) {
    logger.warn("FETCH:SH", `Plik TIFF debugowy już istnieje (${DEBUG_OUTPUT_PATH}). Pomijam pobieranie z Sentinel Hub.`);
    
    try {
      const arrayBuffer = fs.readFileSync(DEBUG_OUTPUT_PATH).buffer;
      
      // TUTAJ NASTĄPI DALSZE PRZETWARZANIE PRZEZ geotiff.js
      return await processTiffToGeojson(arrayBuffer, bbox); // <--- Przykładowe wywołanie

      // return []; // Tymczasowy return

    } catch (e) {
      logger.error("FETCH:SH", `Błąd podczas odczytu istniejącego pliku TIFF: ${(e as Error).message}. Będę kontynuować pobieranie.`);
    }
  }
  
  let EVALSCRIPT_FLOOD: string;
  try {
    EVALSCRIPT_FLOOD = fs.readFileSync(EVALSCRIPT_PATH, 'utf-8');
    logger.debug("FETCH:SH", `Evalscript wczytany z ${EVALSCRIPT_PATH}`);
  } catch (e) {
    logger.error("FETCH:SH", `Krytyczny błąd: Nie można odczytać Evalscript z ${EVALSCRIPT_PATH}`);
    throw new Error("Brak pliku Evalscript.");
  }

  try {
    const token = await getSentinelHubToken();

    // 1. Definicja żądania
    const requestBody = {
      input: {
        bounds: { bbox },
        data: [
          {
            type: "S1GRD",
            dataFilter: {
              timeRange: {
                from: "2025-11-01T00:00:00Z",
                to: "2025-12-10T23:59:59Z",
              },
            },
          }
        ],
      },
      output: {
        width: 512,
        height: 512,
        crs: 'EPSG:4326',
        responses: [
          {
            identifier: "default",
            format: { "type": "image/tiff" }
          }
        ]
      },
      evalscript: EVALSCRIPT_FLOOD,
    };
    
    // 2. Wykonanie zapytania
    const response = await fetch(PROCESSING_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Błąd Processing API: ${response.status} - ${errorText}`);
    }

    // 3. Odbiór i Parsowanie Geotiff
    const arrayBuffer = await response.arrayBuffer();
    
    try {
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(DEBUG_OUTPUT_PATH, buffer);
      logger.info("FETCH:SH", `✅ Geotiff pomyślnie zapisany na dysku: ${DEBUG_OUTPUT_PATH}`);
    } catch (fileError) {
      logger.error("FETCH:SH", `Błąd podczas zapisu pliku TIFF: ${(fileError as Error).message}`);
    }

    // ====================================================================
    // Poniżej musisz zaimplementować logikę konwersji RASTER -> VECTOR
    // ====================================================================

    // Poniższy kod to pseudokod dla Geotiff -> GeoJSON:
    
    // const tiff = await fromArrayBuffer(arrayBuffer);
    // const image = await tiff.getImage();
    // const raster = await image.readRasters();
    
    // **!!! KRYTYCZNY KROK !!!**
    // Tutaj musiałby nastąpić proces wektoryzacji (konwersji pikseli
    // o wartościach powodziowych na poligony GeoJSON). 
    // Wymaga to implementacji algorytmu "Polygonization" lub "Contouring", 
    // co jest bardzo złożone bez GDAL.
    
    // Na potrzeby prototypu zwrócimy pustą tablicę lub zwrócimy jeden 
    // prosty poligon, aby przetestować przepływ danych:
    
    return await processTiffToGeojson(arrayBuffer, bbox); // <--- Przykładowe wywołanie
    logger.warn("FETCH:SH", "Wektoryzacja Geotiff niezaimplementowana. Zwracam pustą tablicę.");

    // Zwracamy pustą tablicę, dopóki konwersja rastra na wektor nie jest gotowa
    return []; 

  } catch (error) {
    logger.error("FETCH:SH", `Nie udało się przetworzyć danych Sentinel Hub: ${(error as Error).message}`);
    // Przekazanie błędu, aby loadFloodZones mógł użyć lokalnego pliku
    throw error; 
  }
}