import { findShortestPath } from '@utils/dijkstra';
import { Graph } from '@interfaces/types';

describe('Dijkstra Algorithm', () => {
  
  const testGraph: Graph = {
    'A': { 'B': 1, 'C': 4 },
    'B': { 'C': 2, 'D': 5 },
    'C': { 'D': 1 },
    'D': { 'E': 1 },
    'E': {}
  };

  it('should find the shortest path and cost between A and E', () => {
    const result = findShortestPath(testGraph, 'A', 'E');

    // Oczekiwana najkrótsza trasa: A -> B -> C -> D -> E (koszt 1+2+1+1 = 5)
    expect(result).not.toBeNull();
    
    if (result) {
      expect(result.cost).toBe(5);
      expect(result.path).toEqual(['A', 'B', 'C', 'D', 'E']);
    }
  });

  it('should return null for unreachable node', () => {
    // Dodajmy odizolowany węzeł
    const unreachableGraph: Graph = { ...testGraph, 'F': { 'G': 1 } };
    
    const result = findShortestPath(unreachableGraph, 'A', 'G');
    
    // Oczekiwany wynik: null, ponieważ G jest nieosiągalne z A
    expect(result).toBeNull();
  });

  it('should return 0 cost for path from start to start', () => {
    const result = findShortestPath(testGraph, 'A', 'A');

    expect(result).not.toBeNull();
    if (result) {
      expect(result.cost).toBe(0);
      expect(result.path).toEqual(['A']);
    }
  });

  it('should handle an empty graph', () => {
    const emptyGraph: Graph = {};
    const result = findShortestPath(emptyGraph, '1', '2');

    expect(result).toBeNull();
  });
});