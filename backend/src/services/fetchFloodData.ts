import * as fs from 'fs';
import { logger } from '@utils/logger';
import { getSentinelHubToken } from './sentinelAuth';
import type { FloodFeature } from '@interfaces/types';
import type { BBox } from 'geojson'; 
import { processTiffToGeojson } from '@utils/tiffToGeojson'; 

import { BUFFER_TIFF, PROCESSING_API_URL, DEBUG_OUTPUT_PATH, EVALSCRIPT_PATH } from '@root/config'

/**
 * Pobiera dane o zakresie powodzi (Geotiff) z Sentinel Hub na podstawie BBOX
 * i konwertuje je do formatu GeoJSON Polygon.
 * * @param bbox Bounding Box ([minLon, minLat, maxLon, maxLon])
 * @returns Tablica cech GeoJSON Polygon
 */
export async function fetchFloodData(bbox: BBox): Promise<FloodFeature[]> {
  logger.info("FETCH:SH", `Pobieranie danych powodziowych dla BBOX: ${bbox.join(', ')}`);

  if (BUFFER_TIFF && fs.existsSync(DEBUG_OUTPUT_PATH)) {
    logger.warn("FETCH:SH", `Plik TIFF debugowy już istnieje (${DEBUG_OUTPUT_PATH}). Pomijam pobieranie z Sentinel Hub.`);
    
    try {
      const arrayBuffer = fs.readFileSync(DEBUG_OUTPUT_PATH).buffer;
      
      return await processTiffToGeojson(arrayBuffer, bbox);

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
      logger.error("FETCH:SH", `Błąd api Sentinel Hub`);
      throw new Error(`Błąd Processing API: ${response.status} - ${errorText}`);
    }

    logger.info("FETCH:SH", `✅ Geotiff pomyślnie pobrany z Sentinel Hub`);

    const arrayBuffer = await response.arrayBuffer();
    
    if (BUFFER_TIFF) {
      try {
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(DEBUG_OUTPUT_PATH, buffer);
        logger.info("FETCH:SH", `✅ Geotiff pomyślnie zapisany na dysku: ${DEBUG_OUTPUT_PATH}`);
      } catch (fileError) {
        logger.error("FETCH:SH", `Błąd podczas zapisu pliku TIFF: ${(fileError as Error).message}`);
      }
    }
    
    return await processTiffToGeojson(arrayBuffer, bbox);

  } catch (error) {
    logger.error("FETCH:SH", `Nie udało się przetworzyć danych Sentinel Hub: ${(error as Error).message}`);
    throw error; 
  }
}