import * as path from 'path';

// --- USTAWIENIA OGÓLNE I ŚCIEŻKI DO DANYCH ---

/**
 * Czy buforować (zapisywać na dysk) odpowiedź GeoTIFF z Sentinel Hub. 
 * Przydatne do debugowania i weryfikacji danych rastrowych.
 */
export const BUFFER_TIFF = false;

/**
 * Bazowy URL do API przetwarzania Sentinel Hub. 
 * Służy do wysyłania żądań w celu pobrania danych rastrowych (np. powodzi).
 */
export const PROCESSING_API_URL = 'https://services.sentinel-hub.com/api/v1/process';

/**
 * Ścieżka, gdzie tymczasowo zapisywany jest pobrany plik GeoTIFF z danymi powodziowymi (jeśli BUFFER_TIFF jest ustawione na true).
 */
export const DEBUG_OUTPUT_PATH = path.join(process.cwd(), 'data', 'downloaded_flood.tiff');

/**
 * Ścieżka do pliku JavaScript zawierającego skrypt EVALSCRIPT. 
 * Ten skrypt określa, jak Sentinel Hub ma przetwarzać i renderować dane satelitarne (np. identyfikacja powodzi).
 */
export const EVALSCRIPT_PATH = path.join(process.cwd(), 'data', 'evalscript_flood.js');

/**
 * Ścieżka do pliku GeoJSON, w którym zapisane są przetworzone i scalone poligony powodziowe.
 */
export const FLOOD_FILE_PATH = path.join(process.cwd(), 'data', 'flood.geojson');

/**
 * Ścieżka do pliku GeoJSON zawierającego dane wektorowe sieci drogowej (graf routingu).
 */
export const ROADS_FILE_PATH = path.join(process.cwd(), 'data', 'roads.geojson');

// --- USTAWIENIA PRZETWARZANIA GEOJSON/TOPOLOGICZNE ---

/**
 * Minimalna liczba połączonych pikseli (obszar w pikselach), które zostaną zachowane po Connected Component Labeling (CCL). 
 * Plamy mniejsze niż ten próg są traktowane jako szum i usuwane.
 */
export const MIN_PIXEL_AREA_THRESHOLD = 3;

/**
 * Minimalna powierzchnia (w metrach kwadratowych), jaką musi mieć scalony poligon GeoJSON, aby zostać uznany za istotny i zachowany. 
 * Służy do filtrowania małych, izolowanych obszarów po scaleniu (`turf.dissolve`).
 */
export const MIN_AREA_THRESHOLD_SQ_METERS = 15000; // 15 000 m² = 1.5 hektara
