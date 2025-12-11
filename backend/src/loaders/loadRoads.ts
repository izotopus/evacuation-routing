import * as fs from 'fs';
import * as path from 'path';

import { logger } from '@utils/logger';
import { FeatureCollection } from 'geojson'; 
import type { Graph, RoadFeature } from '@interfaces/types';
import { buildGraph } from '@utils/graph';
import { ROADS_FILE_PATH } from '@root/config';

export interface LoadedRoads {
  features: RoadFeature[];
  graph: Graph;
}

/**
 * Ładuje plik GeoJSON dróg, zwraca cechy i przetwarza je na Graf.
 * @returns Obiekt zawierający cechy dróg i graf.
 */
export function loadRoads(): LoadedRoads {
  try {
    logger.debug("LOADER:ROADS", `Ładowanie i budowa grafu z: ${ROADS_FILE_PATH}`);
    
    if (!fs.existsSync(ROADS_FILE_PATH)) {
      logger.warn("LOADER:ROADS", "Plik roads.geojson nie istnieje. Zwracam puste dane.");
      return { features: [], graph: {} };
    }

    const data = fs.readFileSync(ROADS_FILE_PATH, 'utf-8');
    const geojson: FeatureCollection = JSON.parse(data);

    // 1. Filtrowanie i rzutowanie tylko na obiekty LineString (drogi)
    const roadFeatures = geojson.features.filter(
      (f): f is RoadFeature => f.geometry && f.geometry.type === 'LineString'
    ) as RoadFeature[];

    if (roadFeatures.length === 0) {
      logger.warn("LOADER:ROADS", "Brak LineString w roads.geojson. Zwracam pusty graf.");
      return { features: [], graph: {} };
    }

    // 2. Budowa grafu na podstawie wczytanych cech
    const graph = buildGraph(roadFeatures);

    logger.info("LOADER:ROADS",`Zbudowano graf z ${Object.keys(graph).length} węzłami.`);
    return { features: roadFeatures, graph };

  } catch (error) {
    logger.error("LOADER:ROADS", "Błąd ładowania lub budowy grafu:", error);
    return { features: [], graph: {} };
  }
}
