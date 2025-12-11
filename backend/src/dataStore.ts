import type { Graph, RoadFeature, IGeoJsonRBushInstance } from '@interfaces/types';
import { FloodPolygonFeature } from '@utils/flood';

export let LoadedGraph: Graph = {};
export let RoadFeatures: RoadFeature[] = [];
export let FloodFeatures: FloodPolygonFeature[] = [];
export let FloodIndex: IGeoJsonRBushInstance | null = null;

export function setLoadedData(
  graph: Graph, 
  features: RoadFeature[],
  floodFeatures: FloodPolygonFeature[],
  floodIndex: IGeoJsonRBushInstance,
) {
  LoadedGraph = graph;
  RoadFeatures = features;
  FloodFeatures = floodFeatures;
  FloodIndex = floodIndex;
}