import { Feature, LineString, Position, FeatureCollection, GeoJsonProperties, BBox, Geometry } from 'geojson'; 

export type NodeId = string;

export type RoadFeature = Feature<LineString>;
export type Coordinates = Position;

// Reprezentacja Grafu: Lista sąsiedztwa
// { 'nodeA': { 'nodeB': costAB, 'nodeC': costAC }, ... }
export interface Graph {
  [key: NodeId]: {
    [neighborId: NodeId]: number; // Koszt (waga) krawędzi
  };
}

export interface RouteResult {
  path: NodeId[];
  cost: number;
  routeGeojson: GeoJSON.Feature<GeoJSON.LineString>;
}

export interface IGeoJsonRBushInstance {
  load(featureCollection: FeatureCollection<Geometry, GeoJsonProperties>): void;
  search(
    geojson: BBox | FeatureCollection<Geometry, GeoJsonProperties> | Feature<Geometry, GeoJsonProperties>
  ): FeatureCollection<Geometry, GeoJsonProperties>;
}

export interface FloodFeature extends GeoJSON.Feature {
    geometry: GeoJSON.Polygon;
    properties: {
        risk_cost: number; // np. dodatkowy koszt za metr
        [key: string]: any;
    };
}

// export type BBox = [number, number, number, number];