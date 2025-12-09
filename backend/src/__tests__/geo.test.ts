import { calculateBbox } from '@utils/geometry';
import { buildFloodIndex, FloodPolygonFeature } from '@utils/flood'; 
import { RoadFeature } from '@interfaces/types';

// Symulowane cechy dróg (LineString)
const mockRoadFeatures: RoadFeature[] = [
  { type: "Feature", geometry: { type: "LineString", coordinates: [[10, 5], [12, 7]] }, properties: { "id": "R1" } as any },
  { type: "Feature", geometry: { type: "LineString", coordinates: [[1, 20], [2, 18]] }, properties: { "id": "R2" } as any },
];

// Symulowane poligony zalewowe
const mockFloodPolygons: FloodPolygonFeature[] = [
  { type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]] }, properties: { "risk_cost": 1000 } as any },
];

describe('Geospatial Utilities', () => {

  // --- calculateBbox Testy ---
  describe('calculateBbox', () => {
    it('should correctly calculate BBOX for a collection of features', () => {
      // Min Lon: 1, Min Lat: 5, Max Lon: 12, Max Lat: 20
      const expectedBbox: [number, number, number, number] = [1, 5, 12, 20];
      
      const result = calculateBbox(mockRoadFeatures);
      
      expect(result).toEqual(expectedBbox);
    });

    it('should return null for an empty feature array', () => {
      const result = calculateBbox([]);
      
      expect(result).toBeNull();
    });
  });

  // --- buildFloodIndex Testy ---
  describe('buildFloodIndex', () => {
    it('should build a searchable R-tree index', () => {
      const index = buildFloodIndex(mockFloodPolygons);

      expect(index).toBeDefined();
      
      const searchBox: [number, number, number, number] = [5, 5, 5, 5]; 
      const searchResult = index.search(searchBox);
      
      expect(searchResult.features.length).toBe(1);
      expect(searchResult.features[0].properties!.risk_cost).toBe(1000);
    });

    it('should return a non-breaking index for an empty array', () => {
      const index = buildFloodIndex([]);
      
      const emptySearchBox: [number, number, number, number] = [0, 0, 1, 1];
      const searchResult = index.search(emptySearchBox);
      
      expect(searchResult.features.length).toBe(0);
    });
  });
});