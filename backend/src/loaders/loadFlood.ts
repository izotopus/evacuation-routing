import * as fs from 'fs';
import * as path from 'path';

import { logger } from '@utils/logger';
import { FeatureCollection } from 'geojson'; 
import { FloodPolygonFeature } from '@utils/flood';

const FLOOD_FILE_PATH = path.join(process.cwd(), 'data', 'flood.geojson');

/**
 * Wczytuje poligony zagrożenia (Flood Zones) z pliku GeoJSON.
 * @returns Tablica obiektów FloodPolygonFeature.
 */
export function loadFloodZones(): FloodPolygonFeature[] {
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
}