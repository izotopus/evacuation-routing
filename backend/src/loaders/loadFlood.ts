import * as fs from 'fs';
import * as path from 'path';

import { logger } from '@utils/logger';
import { BBox, FeatureCollection } from 'geojson';
import { calculateBbox } from '@utils/geometry';
import { FloodPolygonFeature } from '@utils/flood';
import type { RoadFeature, FloodFeature } from '@interfaces/types';
import { fetchFloodData } from '@services/fetchFloodData';

const FLOOD_FILE_PATH = path.join(process.cwd(), 'data', 'flood.geojson');

/**
 * Ładuje dane o strefach zalewowych.
 * Wybiera źródło danych na podstawie konfiguracji środowiskowej.
 */
export async function loadFloodZones(roadFeatures: RoadFeature[], useDynamicFloodMapping: boolean): Promise<FloodFeature[]> {
  
  if (useDynamicFloodMapping) {
    
    logger.info("LOADER:FLOOD", "Wykryto dane autoryzacyjne Sentinel Hub. Próba pobrania danych satelitarnych.");
    try {
      // 1. Obliczenie BBOX z roads.geojson
      const bbox = calculateBbox(roadFeatures) || [0, 0, 0, 0]; 
      
      // 2. Pobranie i przetworzenie Geotiff na poligony GeoJSON
      const floodZones = await fetchFloodData(bbox); 
      
      logger.info("LOADER:FLOOD", `Pobrano ${floodZones.length} stref powodziowych z Sentinel Hub.`);
      return floodZones;
      
    } catch (error) {
      logger.error("LOADER:FLOOD", `BŁĄD pobierania z Sentinel Hub: ${(error as Error).message}. Używam awaryjnego pliku GeoJSON.`);
    }

  } 
  
  if (fs.existsSync(FLOOD_FILE_PATH)) {

    logger.info("LOADER:FLOOD", `Ładowanie stref zalewowych z lokalnego pliku: ${FLOOD_FILE_PATH}`);
    try {
      const data = fs.readFileSync(FLOOD_FILE_PATH, 'utf-8');
      const geojsonData = JSON.parse(data);
      
      // Prosta walidacja, że to FeatureCollection
      if (geojsonData.type !== 'FeatureCollection') {
          throw new Error('Plik musi być typu FeatureCollection.');
      }
      
      // Przetwarzanie cech Polygon na FloodFeature
      return geojsonData.features.filter((f: any) => f.geometry.type === 'Polygon') as FloodFeature[];

    } catch (error) {
      logger.error("LOADER:FLOOD", `BŁĄD podczas ładowania lub parsowania ${FLOOD_FILE_PATH}: ${(error as Error).message}`);
      return [];
    }

  }

  logger.warn("LOADER:FLOOD", "Brak pliku flood.geojson i nie skonfigurowano Sentinel Hub. Strefy zagrożeń nie będą uwzględniane.");
  return [];
}

/**
 * Wczytuje poligony zagrożenia (Flood Zones) z pliku GeoJSON.
 * @returns Tablica obiektów FloodPolygonFeature.
 */
/* export function loadFloodZones(): FloodPolygonFeature[] {
  try {
    logger.debug("LOADER:FLOODS", `Ładowanie stref zalania z: ${FLOOD_FILE_PATH}`);
    
    if (!fs.existsSync(FLOOD_FILE_PATH)) {
        logger.warn("LOADER:FLOODS", "Plik flood.geojson nie istnieje. Zwracam pustą listę zagrożeń.");
        return [];
    }

    const data = fs.readFileSync(FLOOD_FILE_PATH, 'utf-8');
    const geojson: FeatureCollection = JSON.parse(data);

    // Filtrowanie i rzutowanie tylko na Poligony
    const floodFeatures = geojson.features.filter(
      (f): f is FloodPolygonFeature => f.geometry && f.geometry.type === 'Polygon'
    ) as FloodPolygonFeature[];

    logger.info("LOADER:FLOODS", `Wczytano ${floodFeatures.length} poligonów zagrożeń.`);
    return floodFeatures;

  } catch (error) {
    logger.error("LOADER:FLOODS", "Błąd ładowania stref zalania:", error);
    return [];
  }
} */