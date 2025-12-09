import * as turf from '@turf/turf';
import { Feature, LineString } from 'geojson'; 
import type { NodeId, Coordinates, RoadFeature, Graph } from '@interfaces/types';

/**
 * Oblicza prostokąt obwiedni (Bounding Box - BBOX) dla kolekcji cech drogowych.
 * @param roadFeatures - Tablica cech drogowych (GeoJSON LineString).
 * @returns BBOX w formacie [minLon, minLat, maxLon, maxLat] lub null, jeśli brak cech.
 */
export function calculateBbox(roadFeatures: RoadFeature[]): [number, number, number, number] | null {
  if (roadFeatures.length === 0) {
    return null;
  }
  
  const featureCollection = turf.featureCollection(
    roadFeatures as Feature<LineString>[]
  );
  
  return turf.bbox(featureCollection) as [number, number, number, number];
}

/**
 * Odnajduje najbliższy węzeł w grafie do podanego punktu użytkownika.
 *
 * Logika:
 * 1. Znajduje najbliższą cechę drogi (LineString).
 * 2. Znajduje najbliższy węzeł grafu (skrzyżowanie) do punktu użytkownika.
 *
 * @param userPoint Koordynaty [lon, lat] podane przez użytkownika.
 * @param roadFeatures Wszystkie obiekty GeoJSON dróg (LineString).
 * @param graph Zbudowany graf, potrzebujemy tylko kluczy węzłów.
 * @returns ID najbliższego węzła w grafie (NodeId).
 */
export function findClosestGraphNode(
  userPoint: Coordinates,
  roadFeatures: RoadFeature[],
  graph: Graph
): NodeId | null {
    
  const point = turf.point(userPoint);

  // 1. Znajdź najbliższą cechę drogi (LineString)
  let closestRoad: Feature<LineString> | null = null;
  let minDistance = Infinity;

  for (const feature of roadFeatures) {
    const lineFeature = feature as Feature<LineString>; 
    
    // Oblicz odległość do najbliższego punktu na tej linii
    const nearest = turf.nearestPointOnLine(lineFeature, point);
    
    // Oblicz odległość od punktu użytkownika do tego najbliższego punktu na drodze
    const distance = turf.distance(point, nearest, { units: 'meters' });

    if (distance < minDistance) {
      minDistance = distance;
      closestRoad = lineFeature;
    }
  }

  if (!closestRoad) return null; // Brak dróg w pobliżu

  // 2. Snapping do najbliższego WĘZŁA GRAFU
  
  // Lista wszystkich węzłów grafu (jako obiekty Turf Point)
  const graphNodePoints = Object.keys(graph).map(id => {
    const coords = id.split(',').map(c => parseFloat(c));
    return turf.point([coords[0], coords[1]], { id: id });
  });
  
  // Tworzymy GeoJSON FeatureCollection z węzłów
  const nodesCollection = turf.featureCollection(graphNodePoints);

  // Znajdź najbliższy węzeł do punktu użytkownika
  const nearestNode = turf.nearestPoint(point, nodesCollection);

  if (nearestNode.properties && nearestNode.properties.id) {
    // Zwracamy ID najbliższego węzła
    return nearestNode.properties.id as NodeId;
  }
  
  return null;
}