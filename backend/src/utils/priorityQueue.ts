type NodeId = string;
type QueueItem = {
  priority: number; // Odległość (cost)
  value: NodeId;    // ID węzła
};

/**
 * Zoptymalizowana Kolejka Priorytetowa zaimplementowana jako Min-Heap.
 * Złożoność enqueue/dequeue: O(log N).
 */
export class MinHeapPriorityQueue {
  private heap: QueueItem[] = [];

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Wstawia element i utrzymuje własność kopca (Min-Heap).
   * Złożoność: O(log N).
   */
  enqueue(priority: number, value: NodeId): void {
    this.heap.push({ priority, value });
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Usuwa i zwraca element o najniższym priorytecie (minimum).
   * Złożoność: O(log N).
   */
  dequeue(): QueueItem | undefined {
    if (this.isEmpty()) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    // Zamień pierwszy element (min.) z ostatnim
    this.swap(0, this.heap.length - 1);
    const min = this.heap.pop();
    
    // Przywróć własność kopca
    this.bubbleDown(0);
    return min;
  }

  // --- Metody Pomocnicze Kopca ---

  private parentIndex(i: number): number {
    return Math.floor((i - 1) / 2);
  }

  private leftChildIndex(i: number): number {
    return 2 * i + 1;
  }

  private rightChildIndex(i: number): number {
    return 2 * i + 2;
  }

  private swap(i: number, j: number): void {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  /**
   * ⬆️ "Przepycha" nowo wstawiony element w górę, dopóki nie znajdzie
   * swojego miejsca w kopcu (ma mniejszy priorytet niż rodzic).
   */
  private bubbleUp(index: number): void {
    let current = index;
    let parent = this.parentIndex(current);

    // Dopóki bieżący element ma mniejszy priorytet niż jego rodzic
    while (current > 0 && this.heap[current].priority < this.heap[parent].priority) {
      this.swap(current, parent);
      current = parent;
      parent = this.parentIndex(current);
    }
  }

  /**
   * ⬇️ "Przepycha" element ze szczytu (po usunięciu minimum) w dół,
   * wybierając zawsze mniejsze z dzieci.
   */
  private bubbleDown(index: number): void {
    let current = index;
    const lastIndex = this.heap.length - 1;

    while (true) {
      let left = this.leftChildIndex(current);
      let right = this.rightChildIndex(current);
      let smallest = current;

      // Sprawdź, czy lewy potomek istnieje i ma mniejszy priorytet
      if (left <= lastIndex && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }

      // Sprawdź, czy prawy potomek istnieje i ma mniejszy priorytet
      if (right <= lastIndex && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }

      // Jeśli smallest to nie jest obecny węzeł, zamień i kontynuuj w dół
      if (smallest !== current) {
        this.swap(current, smallest);
        current = smallest;
      } else {
        // Kopiec jest w równowadze
        break;
      }
    }
  }
}