import { Position, Feature, LineString, FeatureCollection, Polygon } from 'geojson'; 
export type Coordinates = Position;

const API_BASE_URL = '/api/evac';

export type Bbox = [number, number, number, number]; 

export interface RouteResponse extends Feature<LineString> {
  properties: {
    totalWeightedCost: number;
    pathLengthMeters: number;
    startNode: string;
    endNode: string;
    riskPenaltyApplied: boolean;
    [key: string]: any;
  };
}

export type FloodZoneCollection = FeatureCollection<Polygon>;

export async function fetchBbox(): Promise<Bbox> {
  const url = `${API_BASE_URL}/bbox`;
  
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Nieznany błąd.' }));
    throw new Error(`Błąd API podczas pobierania BBOX: ${errorData.error || response.statusText}`);
  }

  const data = await response.json();
  return data.bbox as Bbox;
}

/**
 * Oblicza trasę ewakuacji przez API.
 * @param start Lat, Lon (format Leaflet/frontend)
 * @param end Lat, Lon (format Leaflet/frontend)
 * @returns GeoJSON LineString z metadanymi trasy.
 */
export async function fetchRoute(
    start: [number, number], // [lat, lon]
    end: [number, number]    // [lat, lon]
): Promise<RouteResponse> {
  
  const startParam = `${start[0]},${start[1]}`;
  const endParam = `${end[0]},${end[1]}`;

  const url = `${API_BASE_URL}/route?start=${startParam}&end=${endParam}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(errorJson.error || `Błąd API: ${response.status}`);
    } catch {
      throw new Error(`Błąd API: ${response.status} - ${errorText}`);
    }
  }

  return response.json();
}

export async function fetchFloodZones(): Promise<FloodZoneCollection> {
  const url = `${API_BASE_URL}/flood-zones`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Błąd API podczas pobierania stref zalania: ${response.status}`);
  }
  return response.json();
}