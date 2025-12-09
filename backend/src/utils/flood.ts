import GeoJsonRBush from 'geojson-rbush';
import { logger } from '@utils/logger';
import * as turf from '@turf/turf';
import { Feature, Polygon, LineString, BBox } from 'geojson'; 
import type { NodeId, Graph, RoadFeature, IGeoJsonRBushInstance } from '@interfaces/types';

const EXTREME_COST = 1000000; 
const PRECISION = 6;

export type FloodPolygonFeature = Feature<Polygon>;

/**
 * Buduje Spatial Index (R-tree) dla poligonów zalania.
 * @param floodFeatures Lista obiektów GeoJSON Polygon (strefy zalania).
 * @returns Utworzony index R-tree.
 */
export function buildFloodIndex(
  floodFeatures: FloodPolygonFeature[]
): IGeoJsonRBushInstance {
  
  const spatialIndex: IGeoJsonRBushInstance = GeoJsonRBush(); 
  
  spatialIndex.load(turf.featureCollection(floodFeatures));
  logger.info("GRAPH", `Zbudowano R-tree dla ${floodFeatures.length} poligonów zagrożeń.`);
  return spatialIndex;
}

/**
 * Sprawdza, czy dany segment drogi jest zagrożony przez poligony w indexie.
 */
function isSegmentRisky(segmentLine: Feature<LineString>, spatialIndex: IGeoJsonRBushInstance): boolean {
  const segmentBboxArray = turf.bbox(segmentLine);
  const candidates = spatialIndex.search(segmentBboxArray as BBox);
  
  for (const candidate of candidates.features) {
    if (turf.booleanIntersects(segmentLine, candidate as Feature<Polygon>)) {
      return true;
    }
  }
  return false;
}

/**
 * Modyfikuje wagi krawędzi w grafie, by unikać stref zalania.
 */
export function modifyGraphForRisk(
    originalGraph: Graph, 
    roadFeatures: RoadFeature[], 
    spatialIndex: IGeoJsonRBushInstance
): Graph {
    
  const modifiedGraph: Graph = JSON.parse(JSON.stringify(originalGraph));
  let blockedSegmentsCount = 0;

  roadFeatures.forEach((feature) => {
    const line = feature.geometry;
    if (!line || line.type !== 'LineString') return;

    const coords = line.coordinates;

    // Iterujemy przez każdy fizyczny segment linii drogowej
    for (let i = 0; i < coords.length - 1; i++) {
      const startCoords = coords[i];
      const endCoords = coords[i + 1];

      // Tworzymy GeoJSON LineString dla segmentu (używamy typu Feature<LineString>)
      const segmentLine: Feature<LineString> = turf.lineString([startCoords, endCoords]);
      
      // Generowanie ID węzłów w sposób spójny z graph.ts
      const startNodeId = `${startCoords[0].toFixed(PRECISION)},${startCoords[1].toFixed(PRECISION)}` as NodeId;
      const endNodeId = `${endCoords[0].toFixed(PRECISION)},${endCoords[1].toFixed(PRECISION)}` as NodeId;

      const isRisky = isSegmentRisky(segmentLine, spatialIndex);

      if (isRisky) {
        // Jeśli segment jest zagrożony, ustawiamy bardzo wysoką wagę
        const newCost = EXTREME_COST; 
        
        // Modyfikacja wagi w obu kierunkach
        if (modifiedGraph[startNodeId] && modifiedGraph[startNodeId][endNodeId] !== undefined) {
          // Dodajemy bardzo wysoki koszt do istniejącej wagi (aby utrzymać bazową długość)
          modifiedGraph[startNodeId][endNodeId] += newCost;
          blockedSegmentsCount++;
        }
        if (modifiedGraph[endNodeId] && modifiedGraph[endNodeId][startNodeId] !== undefined) {
          modifiedGraph[endNodeId][startNodeId] += newCost;
        }
      }
    }
  });

  logger.info("GRAPH", `Zmodyfikowano wagi dla ${blockedSegmentsCount} unikalnych segmentów drogowych.`);
  return modifiedGraph;
}