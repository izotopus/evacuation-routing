import * as turf from '@turf/turf';
import { logger } from '@utils/logger';
import { Feature, LineString } from 'geojson'; 
import { findShortestPath } from '@utils/dijkstra-priorityQueue';
import { findClosestGraphNode } from '@utils/geometry';
import { 
  modifyGraphForRisk, 
  buildFloodIndex, 
} from '@utils/flood'; 

import { LoadedGraph, RoadFeatures, FloodFeatures } from '../config'; 
import type { Coordinates, Graph } from '@interfaces/types';

/**
 * Oblicza rekomendowaną trasę ewakuacji omijającą zagrożenia.
 * @param startCoords Koordynaty startowe [lon, lat].
 * @param endCoords Koordynaty końcowe [lon, lat].
 * @returns GeoJSON LineString trasy wraz z metadanymi lub null.
 */
export function calculateRoute(
    startCoords: Coordinates, 
    endCoords: Coordinates
): Feature<LineString> | null { 

  // 1. Walidacja danych
  if (Object.keys(LoadedGraph).length === 0) {
    logger.error("ROUTE", "Graf drogowy nie został załadowany.");
    return null;
  }

  // --- LOGIKA UNIKANIA ZAGROŻEŃ ---
  let finalGraph: Graph = LoadedGraph;

  // Sprawdzamy, czy wczytaliśmy jakiekolwiek strefy zalania
  if (FloodFeatures.length > 0) {
    // Budowanie indexu zagrożeń
    const floodIndex = buildFloodIndex(FloodFeatures); 
    
    // Modyfikacja grafu pierwotnego na podstawie stref zalania
    finalGraph = modifyGraphForRisk(LoadedGraph, RoadFeatures, floodIndex);
  }
  // ---------------------------------

  // 2. Dopasowanie punktów do grafu (Snapping)
  const startNodeId = findClosestGraphNode(startCoords, RoadFeatures, finalGraph);
  const endNodeId = findClosestGraphNode(endCoords, RoadFeatures, finalGraph);

  if (!startNodeId || !endNodeId) {
    logger.warn("ROUTE", "Nie można dopasować punktu startowego lub końcowego do grafu.");
    return null;
  }

  // 3. Obliczenie najkrótszej ścieżki na ZMODYFIKOWANYM grafie
  const route = findShortestPath(finalGraph, startNodeId, endNodeId);

  if (!route) {
    logger.warn("ROUTE", "Nie znaleziono ścieżki między wybranymi węzłami.");
    return null;
  }

  // 4. Konwersja ścieżki (NodeId[]) na GeoJSON LineString
  const routeCoordinates: Coordinates[] = route.path.map((id: string) => id.split(',').map((c: string) => parseFloat(c)));

  const finalRouteLine = turf.lineString(routeCoordinates);
  const actualLengthMeters = turf.length(finalRouteLine, { units: 'kilometers' }) * 1000;

  // Zwracamy GeoJSON LineString z metadanymi
  const routeGeojson: Feature<LineString> = turf.lineString(routeCoordinates, {
    totalWeightedCost: route.cost,
    pathLengthMeters: actualLengthMeters, // Czysta długość geometryczna
    startNode: startNodeId,
    endNode: endNodeId,
    // Proste sprawdzenie, czy kara została naliczona (z tolerancją na zaokrąglenia)
    riskPenaltyApplied: route.cost > actualLengthMeters + 1 
  });

  return routeGeojson;
}