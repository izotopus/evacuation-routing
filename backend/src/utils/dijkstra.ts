// Based on: https://patrickkarsh.medium.com/dijkstras-shortest-path-algorithm-in-javascript-1621556a3a15

import { logger } from '@utils/logger';

type Graph = Record<NodeId, Record<NodeId, number>>;
type NodeId = string;

class SimplePriorityQueue<T> {
  private items: { priority: number; value: T }[] = [];

  enqueue(priority: number, value: T): void {
    const newItem = { priority, value };
    this.items.push(newItem);
    // Sortujemy malejąco, aby min-heap miał najmniejszą wartość na końcu,
    // co umożliwia szybkie usuwanie (pop)
    this.items.sort((a, b) => b.priority - a.priority); 
    // UWAGA: Ta operacja sortowania jest O(N log N) i jest powodem,
    // dla którego użycie prawdziwego kopca jest lepsze (O(log N)).
  }

  dequeue(): T | undefined {
    return this.items.pop()?.value; // O(1)
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }
}

/**
 * Implementacja algorytmu Dijkstry, zoptymalizowana za pomocą
 * (symulowanej) Kolejki Priorytetowej.
 *
 * @param graph Struktura Graph, gdzie wagi krawędzi reprezentują koszt.
 * @param startNodeId ID węzła startowego.
 * @param endNodeId ID węzła końcowego.
 * @returns Obiekt zawierający ścieżkę (path) i całkowity koszt (cost) lub null, jeśli ścieżka nie istnieje.
 */
export function findShortestPath(
    graph: Graph,
    startNodeId: NodeId,
    endNodeId: NodeId
): { path: NodeId[], cost: number } | null {

  logger.info("DIJKSTRA", `Rozpoczynanie wyszukiwania trasy (zoptymalizowane): ${startNodeId} -> ${endNodeId}`);
  
  // 1. Inicjalizacja
  const distances: Record<NodeId, number> = {}; 
  const predecessors: Record<NodeId, NodeId | null> = {}; 
  const visited: Set<NodeId> = new Set(); // Nadal potrzebny, by ignorować przetworzone węzły
  const nodes = Object.keys(graph);

  if (nodes.length === 0) {
    logger.warn("DIJKSTRA", "Graf jest pusty. Zakończono.");
    return null;
  }

  const INFINITY = Infinity;
  nodes.forEach(node => {
    distances[node] = INFINITY;
    predecessors[node] = null;
  });

  // 2. Inicjalizacja Kolejki Priorytetowej (PQ)
  const pq = new SimplePriorityQueue<NodeId>();
  distances[startNodeId] = 0;
  pq.enqueue(0, startNodeId); // Wstawienie (odległość, węzeł)
  
  // 3. Główna pętla Dijkstry - działa, dopóki PQ ma elementy
  while (!pq.isEmpty()) {
    
    // Pobierz węzeł o najmniejszej odległości z PQ
    const closestNode = pq.dequeue();

    if (!closestNode) continue; // Pusty dequeue

    // * Kluczowa optymalizacja: Ignoruj węzły już przetworzone *
    // Węzeł mógł zostać "zrelaksowany" i ponownie wstawiony do PQ
    // ze względu na nową, mniejszą odległość, ale jego stare (gorsze) wpisy
    // wciąż tam są. Odwiedzamy go tylko raz.
    if (visited.has(closestNode)) {
      continue;
    }
    
    // Oznacz węzeł jako odwiedzony (przetworzony)
    visited.add(closestNode);
    const currentDistance = distances[closestNode];

    // Jeśli osiągnięto węzeł końcowy
    if (closestNode === endNodeId) {
      logger.info("DIJKSTRA", `Znaleziono węzeł docelowy ${endNodeId}. Odległość: ${currentDistance.toFixed(2)}`);
      break;
    }

    // 4. Relaksacja krawędzi
    const neighbors = graph[closestNode];
    if (neighbors) {
      for (const neighborId in neighbors) {
        const weight = neighbors[neighborId];
        const newDistance = currentDistance + weight;

        // Jeśli nowa odległość jest mniejsza niż obecna zapisana w 'distances'
        if (newDistance < distances[neighborId]) {
          distances[neighborId] = newDistance;
          predecessors[neighborId] = closestNode;
          
          // * Dodaj lub zaktualizuj węzeł w PQ *
          // W zoptymalizowanej wersji dodajemy nowy, lepszy wpis do PQ.
          pq.enqueue(newDistance, neighborId);
        }
      }
    }
  }

  // 5. Rekonstrukcja ścieżki (bez zmian)
  const path: NodeId[] = [];
  let currentNode: NodeId | null = endNodeId;

  if (distances[endNodeId] === INFINITY) {
    logger.error("DIJKSTRA", `Trasa nieosiągalna z ${startNodeId} do ${endNodeId}.`);
    return null;
  }

  while (currentNode) {
    path.unshift(currentNode); 
    if (currentNode === startNodeId) break;
    currentNode = predecessors[currentNode];

    if (!currentNode && path[0] !== startNodeId) {
        logger.error("DIJKSTRA", "Wykryto błąd w rekonstrukcji ścieżki. Ścieżka przerwana.");
        return null; 
    }
  }

  logger.info("DIJKSTRA", `✅ Wyszukiwanie zakończone pomyślnie. Koszt: ${distances[endNodeId].toFixed(2)}`);

  return { 
    path: path, 
    cost: distances[endNodeId] 
  };
}