// Based on: https://patrickkarsh.medium.com/dijkstras-shortest-path-algorithm-in-javascript-1621556a3a15

import type { Graph, NodeId } from '@interfaces/types';
import { logger } from '@utils/logger';

/**
 * Implementacja algorytmu Dijkstry do znajdowania najkrótszej ścieżki.
 * * Uwaga: Ta prosta implementacja używa liniowego przeszukiwania do znalezienia
 * nieodwiedzonego węzła o najmniejszej odległości, co jest wystarczające
 * dla małych i średnich grafów.
 *
 * @param graph Struktura Graph, gdzie wagi krawędzi reprezentują koszt (np. odległość).
 * @param startNodeId ID węzła startowego.
 * @param endNodeId ID węzła końcowego.
 * @returns Obiekt zawierający ścieżkę (path) i całkowity koszt (cost) lub null, jeśli ścieżka nie istnieje.
 */
export function findShortestPath(
    graph: Graph,
    startNodeId: NodeId,
    endNodeId: NodeId
): { path: NodeId[], cost: number } | null {

  logger.info("DIJKSTRA", `Rozpoczynanie wyszukiwania trasy: ${startNodeId} -> ${endNodeId}`);
  
  // 1. Inicjalizacja
  const distances: Record<NodeId, number> = {}; // Przechowuje najkrótsze odległości od startu
  const predecessors: Record<NodeId, NodeId | null> = {}; // Poprzednik w najkrótszej ścieżce
  const visited: Set<NodeId> = new Set(); // Zbiór odwiedzonych węzłów
  const nodes = Object.keys(graph);

  if (nodes.length === 0) {
    logger.warn("DIJKSTRA", "Graf jest pusty. Zakończono.");
    return null;
  }

  // Ustawienie początkowych odległości na nieskończoność
  const INFINITY = Infinity;
  nodes.forEach(node => {
    distances[node] = INFINITY;
    predecessors[node] = null;
  });

  // Odległość do węzła startowego jest 0
  distances[startNodeId] = 0;

  logger.debug("DIJKSTRA", `Inicjalizacja ukończona. Węzłów do przetworzenia: ${nodes.length}`);

  // 2. Główna pętla Dijkstry
  while (visited.size < nodes.length) {
    
    // Znajdź nieodwiedzony węzeł o najmniejszej odległości (O(N) w prostej wersji)
    let closestNode: NodeId | null = null;
    let minDistance = INFINITY;

    for (const node of nodes) {
      if (!visited.has(node) && distances[node] < minDistance) {
        minDistance = distances[node];
        closestNode = node;
      }
    }

    // Jeśli nie ma osiągalnego węzła, kończymy
    if (closestNode === null) {
      logger.info("DIJKSTRA", `Brak osiągalnego węzła o najmniejszej odległości. Zakończenie pętli.`);
      break; 
    }
    
    // Oznacz węzeł jako odwiedzony
    visited.add(closestNode);

    if (visited.size % 100 === 0 && visited.size > 0) {
      logger.debug("DIJKSTRA", `Przetworzono ${visited.size} węzłów. Aktualny węzeł: ${closestNode}, Odległość: ${minDistance.toFixed(2)}`);
    }

    // Jeśli osiągnięto węzeł końcowy, przerywamy pętlę
    if (closestNode === endNodeId) {
      logger.info("DIJKSTRA", `Znaleziono węzeł docelowy ${endNodeId}. Odległość: ${minDistance.toFixed(2)}`);
      break;
    }

    // 3. Relaksacja krawędzi
    const neighbors = graph[closestNode];
    if (neighbors) {
      for (const neighborId in neighbors) {
        const weight = neighbors[neighborId];
        const newDistance = distances[closestNode] + weight;

        // Jeśli nowa odległość jest mniejsza niż obecna
        if (newDistance < distances[neighborId]) {
          distances[neighborId] = newDistance;
          predecessors[neighborId] = closestNode;
        }
      }
    }
  }

  // 4. Rekonstrukcja ścieżki
  const path: NodeId[] = [];
  let currentNode: NodeId | null = endNodeId;

  if (distances[endNodeId] === INFINITY) {
    // Cel nieosiągalny
    logger.warn("DIJKSTRA", `Trasa nieosiągalna z ${startNodeId} do ${endNodeId}.`);
    return null;
  }

  // Cofamy się od celu do startu, używając poprzedników
  while (currentNode) {
    path.unshift(currentNode); // Dodaj na początek tablicy
    if (currentNode === startNodeId) break;
    currentNode = predecessors[currentNode];

    // Zabezpieczenie na wypadek błędu w pętli (powinien być osiągnięty startNodeId)
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