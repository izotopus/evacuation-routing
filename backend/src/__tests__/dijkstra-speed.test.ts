import { findShortestPath } from '@utils/dijkstra';
import { findShortestPath as findShortestPathOptimized } from '@utils/dijkstra-priorityQueue';

// --- Narzędzia do Generowania Grafu ---

// Typy (dla kompletności)
type NodeId = string;
type Graph = Record<NodeId, Record<NodeId, number>>;

/**
 * Generuje losowy gęsty graf o podanej liczbie węzłów.
 * @param numNodes Liczba węzłów (od 'A' do 'Z'...)
 * @param density Gęstość krawędzi (0.0 do 1.0).
 * @param maxWeight Maksymalna waga krawędzi.
 */
function generateRandomGraph(numNodes: number, density: number, maxWeight: number): Graph {
  const graph: Graph = {};
  const nodeNames: NodeId[] = [];

  // Generowanie nazw węzłów (np. 'N0', 'N1', ...)
  for (let i = 0; i < numNodes; i++) {
    nodeNames.push(`N${i}`);
    graph[`N${i}`] = {};
  }

  // Dodawanie krawędzi
  for (const source of nodeNames) {
    for (const target of nodeNames) {
      if (source !== target && Math.random() < density) {
        // Losowa waga od 1 do maxWeight
        const weight = Math.floor(Math.random() * maxWeight) + 1;
        graph[source][target] = weight;
      }
    }
  }
  return graph;
}

// --- Test Wydajności ---

describe('Dijkstra Performance Comparison', () => {

  // Konfiguracja testów
  const TEST_CONFIGS = [
    { name: 'Mały Graf (V=100, gęsty)', nodes: 100, density: 0.8 },
    { name: 'Średni Graf (V=500, gęsty)', nodes: 500, density: 0.6 },
    // { name: 'Duży Graf (V=5000, gęsty)', nodes: 5000, density: 0.5 },
  ];
  
  // Liczba powtórzeń pomiaru dla uśrednienia
  const REPETITIONS = 5; 

  // Używamy .each do dynamicznego generowania testów dla każdej konfiguracji
  it.each(TEST_CONFIGS)(
    'should show performance difference for $name (V=$nodes)', 
    ({ name, nodes, density }) => {
        
      // 1. Ustawienia Grafu i Węzłów Testowych
      const graph = generateRandomGraph(nodes, density, 100);
      
      // Węzeł startowy i końcowy (pierwszy i ostatni wygenerowany)
      const startNode = `N0`;
      const endNode = `N${nodes - 1}`;

      // --- Logika Pomiaru ---

      const measureTime = (algorithm: Function) => {
        let totalTime = 0;
        
        // Powtarzamy pomiar REPETITIONS razy i uśredniamy
        for (let i = 0; i < REPETITIONS; i++) {
          const start = performance.now();
          algorithm(graph, startNode, endNode);
          const end = performance.now();
          totalTime += end - start;
        }
        return totalTime / REPETITIONS;
      };

      // 2. Pomiar czasu dla oryginalnej implementacji O(V^2)
      const timeOriginal = measureTime(findShortestPath);

      // 3. Pomiar czasu dla zoptymalizowanej implementacji O((V+E) log V)
      const timeOptimized = measureTime(findShortestPathOptimized);

      // --- Wynik i Asercje ---
      const estimatedEdges = nodes * nodes * density;

      console.log(`\n--- Wynik Testu: ${name} ---`);
      console.log(`Graf: V=${nodes}, E=${Math.round(estimatedEdges)}, Gęstość: ${density.toFixed(2)}`);
      console.log(`Oryginalna (O(V²)): ${timeOriginal.toFixed(3)} ms`);
      console.log(`Zoptymalizowana (O((V+E) log V)): ${timeOptimized.toFixed(3)} ms`);

      // Wymagamy, aby zoptymalizowana wersja była co najmniej 10% szybsza dla dużych grafów
      // Dla bardzo małych grafów narzut może być większy, więc ta asercja może zawieść.
      if (nodes >= 500) {
          expect(timeOptimized).toBeLessThan(timeOriginal * 0.9);
      } else {
        // Dla małych grafów sprawdzamy tylko, czy obie działają
        expect(timeOriginal).toBeGreaterThan(0);
        expect(timeOptimized).toBeGreaterThan(0);
      }
    },
    30000 // Ustaw timeout testu na 30 sekund (dla dużych grafów)
  );
});