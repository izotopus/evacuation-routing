import { loadRoads } from '@loaders/loadRoads';
import { loadFloodZones } from '@loaders/loadFlood';
import { Graph, RoadFeature } from '@interfaces/types';
import { FloodPolygonFeature } from '@utils/flood'; // Zakładamy, że typ jest w utils/flood

// 1. Mockowanie systemu plików (fs i path)
import * as fs from 'fs';
import * as path from 'path';

// Symulowane dane minimalne dla testów
const MOCK_ROAD_GEOJSON = JSON.stringify({
  "type": "FeatureCollection",
  "features": [
    { "type": "Feature", "geometry": { "type": "LineString", "coordinates": [[1, 1], [2, 2]] }, "properties": { "id": "A", "cost": 1.41 } as any },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [3, 3] }, "properties": { "id": "B" } as any } // Nieprawidłowy typ
  ]
});

const MOCK_FLOOD_GEOJSON = JSON.stringify({
  "type": "FeatureCollection",
  "features": [
    { "type": "Feature", "geometry": { "type": "Polygon", "coordinates": [[[0, 0], [0, 1], [1, 1], [0, 0]]] }, "properties": { "risk_cost": 100 } as any }
  ]
});

// Mockowanie funkcji odczytu pliku
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
}));

// Mockowanie budowania grafu i indeksu (dla izolacji)
jest.mock('../utils/graph', () => ({
  buildGraph: jest.fn(features => {
    // Zwracamy uproszczony graf, aby zasygnalizować sukces
    return features.length > 0 ? { '1': { '2': 1 } } as Graph : {};
  }),
}));

describe('Data Loaders', () => {

  // Ustawienie domyślnego istnienia plików
  (fs.existsSync as jest.Mock).mockReturnValue(true);

  // --- loadRoads Testy ---
  describe('loadRoads', () => {
    it('should correctly load and build graph from roads.geojson', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(MOCK_ROAD_GEOJSON);

      const result = loadRoads();
      
      expect(result.features.length).toBe(1); // Punkt jest ignorowany
      expect(Object.keys(result.graph).length).toBeGreaterThan(0);
    });

    it('should return empty data if roads.geojson is not found', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false); // Tylko dla tego testu
      
      const result = loadRoads();
      
      expect(result.features).toEqual([]);
      expect(result.graph).toEqual({});
    });

    it('should return empty data if roads.geojson is empty or has no LineString', () => {
      (fs.readFileSync as jest.Mock).mockReturnValueOnce(JSON.stringify({ "type": "FeatureCollection", "features": [] }));
      
      const result = loadRoads();

      expect(result.features).toEqual([]);
      expect(result.graph).toEqual({});
    });
  });

  // --- loadFloodZones Testy ---
  describe('loadFloodZones', () => {
    it('should correctly load flood zones from flood.geojson', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(MOCK_FLOOD_GEOJSON);

      const result = loadFloodZones();

      expect(result.length).toBe(1);
      expect(result[0]).toBeDefined(); 
      expect(result[0]!.geometry.type).toBe('Polygon'); 
      expect(result[0]!.properties!.risk_cost).toBe(100); 
    });

    it('should return empty array if flood.geojson is not found', () => {
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
      
      const result = loadFloodZones();

      expect(result).toEqual([]);
    });
  });
});