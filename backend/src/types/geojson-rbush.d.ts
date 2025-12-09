import { GeoJsonProperties, Geometry } from 'geojson';

declare module 'geojson-rbush' {
  export function geojsonRbush<
    G extends Geometry = Geometry,
    P extends GeoJsonProperties = GeoJsonProperties,
  >(maxEntries?: number): IGeoJsonRBushInstance;
}