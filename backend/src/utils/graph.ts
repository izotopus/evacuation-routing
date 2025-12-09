import * as turf from '@turf/turf';
import { logger } from '@utils/logger';
import type { Graph, NodeId, RoadFeature, Coordinates } from '@interfaces/types';

// Precyzja do haszowania współrzędnych
const PRECISION = 6;

/**
 * Generuje unikalny klucz węzła na podstawie współrzędnych.
 */
function getNodeId(coords: Coordinates): NodeId { 
  // [lon, lat]
  return `${coords[0].toFixed(PRECISION)},${coords[1].toFixed(PRECISION)}`;
}

/**
 * Buduje graf dróg z listy obiektów GeoJSON LineString.
 * @param roadFeatures Tablica obiektów GeoJSON LineString (drogi).
 * @returns Zbudowana struktura Graph.
 */
export function buildGraph(roadFeatures: RoadFeature[]): Graph {
  const graph: Graph = {};

  roadFeatures.forEach((feature) => {
    const line = feature.geometry;
    if (!line || line.type !== 'LineString') return;

    const coords = line.coordinates;

    for (let i = 0; i < coords.length - 1; i++) {
      const startCoords = coords[i];
      const endCoords = coords[i + 1];

      // Tworzymy tymczasową krawędź do obliczenia długości (w metrach)
      const segment = turf.lineString([startCoords, endCoords]);
      // Używamy 'kilometers', następnie mnożymy przez 1000, 
      // aby uniknąć problemów z zaokrąglaniem małych długości
      const distanceKm = turf.length(segment, { units: 'kilometers' });
      const cost = distanceKm * 1000; // Koszt w metrach

      const startNodeId = getNodeId(startCoords);
      const endNodeId = getNodeId(endCoords);

      // Dodajemy krawędzie dwukierunkowo (jeśli zakładamy ruch dwukierunkowy)
      
      // Start -> End
      if (!graph[startNodeId]) {
        graph[startNodeId] = {};
      }
      // Dodajemy krawędź tylko, jeśli nowa waga jest mniejsza (zabezpieczenie przed zduplikowanymi drogami)
      if (!graph[startNodeId][endNodeId] || cost < graph[startNodeId][endNodeId]) {
          graph[startNodeId][endNodeId] = cost;
      }

      // End -> Start (ruch dwukierunkowy)
      if (!graph[endNodeId]) {
        graph[endNodeId] = {};
      }
      if (!graph[endNodeId][startNodeId] || cost < graph[endNodeId][startNodeId]) {
        graph[endNodeId][startNodeId] = cost;
      }
    }
  });

  logger.info("GRAPH", `Graf zbudowany: ${Object.keys(graph).length} węzłów.`);
  return graph;
}
