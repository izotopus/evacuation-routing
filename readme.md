# 🌊 System Ewakuacji Powodziowej (Backend)

Ten backend jest serwerem Node.js/Express odpowiedzialnym za ładowanie danych GeoJSON (dróg i stref zalewowych), budowę grafu sieci drogowego oraz obliczanie optymalnych tras ewakuacyjnych z uwzględnieniem kosztów ryzyka powodziowego (algorytm Dijkstry).

## 📚 Główne Biblioteki GeoSpatial

Projekt opiera się na dwóch kluczowych bibliotekach do przetwarzania danych geograficznych:

| Biblioteka | Zastosowanie w projekcie | Opis |
| :--- | :--- | :--- |
| **@turf/turf** | **Obliczenia i przetwarzanie GeoJSON** | Biblioteka do zaawansowanych operacji geoprzestrzennych. Używana do: <br> • **Obliczania długości** segmentów drogowych (koszt krawędzi). <br> • **Obliczania BBOX** (obwiedni) załadowanych danych. <br> • **Snappingu** punktów start/end do najbliższych segmentów drogowych. |
| **geojson** | **Definicje typów GeoJSON** | Zbiór interfejsów TypeScript. Używany wyłącznie do zapewnienia **silnego typowania** dla wszystkich struktur danych GeoJSON (np. `Feature`, `LineString`, `Polygon`, `FeatureCollection`), co zwiększa bezpieczeństwo i czytelność kodu. |
| **rbush** | **Indeksowanie Przestrzenne** | Wykorzystywana do budowy i utrzymywania **indeksu przestrzennego R-tree** (FloodIndex). Umożliwia bardzo szybkie sprawdzanie, czy dany segment drogi jest **zgodny z poligonem powodziowym** (detekcja kolizji). |


## 🌍 Zarządzanie Źródłem Danych Powodziowych

System obsługuje dwa tryby pobierania danych powodziowych:

### 1. Tryb Lokalny (Domyślny)

* **Aktywacja:** Domyślny, gdy zmienne `SENTINEL_HUB_CLIENT_ID` i `SENTINEL_HUB_CLIENT_SECRET` **nie są zdefiniowane** w pliku `.env`.
* **Działanie:** System załaduje dane powodziowe z lokalnego pliku określonego w konfiguracji (`config.ts: FLOOD_FILE_PATH`). Ten plik musi być wcześniej wygenerowany (np. przez poprzednie uruchomienie serwisu) lub umieszczony ręcznie.
* **Przeznaczenie:** Szybkie testowanie algorytmów routingu i unikanie opóźnień związanych z API.

### 2. Tryb Sentinel Hub (Dynamiczne Pobieranie)

* **Aktywacja:** Gdy **obie** zmienne `SENTINEL_HUB_CLIENT_ID` i `SENTINEL_HUB_CLIENT_SECRET` **są poprawnie zdefiniowane** w pliku `.env`.
* **Działanie:** System automatycznie pobierze token autoryzacyjny, a następnie wyśle żądanie do API Sentinel Hub w celu uzyskania najnowszych danych powodziowych (w postaci GeoTIFF) dla zadanego obszaru BBOX. Następnie przetworzy te dane (CCL, scalanie, wygładzanie) i wykorzysta je do routingu.
* **Przeznaczenie:** Praca z aktualnymi danymi satelitarnymi.


## ⚙️ Konfiguracja i Zmienne Środowiskowe

Projekt wykorzystuje zmienne środowiskowe do zarządzania danymi dostępowymi do zewnętrznych serwisów.

Stwórz plik `.env` w katalogu głównym projektu i wypełnij go następującymi danymi:

```env
# --- Wymagane Dane Autoryzacyjne dla Sentinel Hub ---
# Jeśli te zmienne są zdefiniowane, system automatycznie przełączy się na pobieranie 
# aktualnych danych powodziowych z API Sentinel Hub.
SENTINEL_HUB_CLIENT_ID="[Twój Client ID]"
SENTINEL_HUB_CLIENT_SECRET="[Twój Secret]"
```


## 📄 Plik Konfiguracyjny Aplikacji (`config.ts`)

Plik `config.ts` przechowuje **stałe, niezmienne parametry** niezbędne do działania serwisu oraz przetwarzania danych GeoTIFF na GeoJSON. Te wartości są traktowane jako twarde ustawienia aplikacji (w przeciwieństwie do zmiennych środowiskowych, które są danymi dostępowymi).

### Kluczowe Ustawienia Zawarte w `config.ts`:

| Stała | Cel | Wartość |
| :--- | :--- | :--- |
| `PROCESSING_API_URL` | Endpoint API do pobierania danych z Sentinel Hub. | URL |
| `*_FILE_PATH` | Definicje ścieżek do lokalnych plików wejściowych i wyjściowych (np. `roads.geojson`, `flood.geojson`). | Ścieżka |
| `BUFFER_TIFF` | Flaga logiczna sterująca zapisem pobranego GeoTIFF na dysk (dla debugowania). | `true` / `false` |
| `MIN_PIXEL_AREA_THRESHOLD` | Próg dla algorytmu CCL (usuwanie szumu rastrowego). | Liczba pikseli |
| `MIN_AREA_THRESHOLD_SQ_METERS` | Próg powierzchni dla scalonego poligonu (filtracja końcowa). | Wartość w $\text{m}^2$ |

> **Uwaga:** Wszelkie zmiany w sposobie filtrowania danych powodziowych lub w geometrii (np. wygładzanie krawędzi) powinny być dokonywane poprzez modyfikację wartości w pliku `config.ts`.


## 🚀 Uruchomienie Projektu

### Wymagania wstępne

* Node.js (v18+)
* npm lub yarn

### Instalacja i Start

1.  **Przejdź do katalogu `backend/`**

2.  **Uzupełnij plik `.env` danymi autoryzacyjnymi Sentinel Hub**, jeśli chcesz użyć aktualnych danych satelitarnych.

3.  **Instalacja zależności:**
    ```bash
    npm install
    ```

4.  **Uruchomienie w trybie deweloperskim (z hot-reloadem):**
    ```bash
    npm run dev
    ```
    Serwer uruchomi się na porcie `3000` (http://localhost:3000).

5.  **Uruchomienie produkcyjne (po kompilacji):**
    ```bash
    npm run build
    npm start
    ```
---

## 🌐 Uruchomienie Frontendu

Po upewnieniu się, że serwer backendu działa, możesz uruchomić aplikację kliencką:

1.  **Otwórz nowy terminal** i **przejdź do katalogu `frontend/`**.
2.  **Zainstaluj zależności frontendu (jeśli jeszcze tego nie zrobiono):**
    ```bash
    npm install
    ```
3.  **Uruchom aplikację kliencką (Frontend):**
    ```bash
    npm run dev
    ```
    Aplikacja frontendu uruchomi się zazwyczaj na porcie `5173` (lub innym wolnym porcie Vite, np. http://localhost:5173). Możesz teraz otworzyć ten adres w przeglądarce.

---

## 🗺️ Struktura Danych GeoJSON

Aplikacja wymaga, aby w katalogu **`backend/data/`** znajdowały się następujące pliki:

| Plik | Typ Geometrii | Wymagane Właściwości (`properties`) | Źródło Generowania |
| :--- | :--- | :--- | :--- |
| **`roads.geojson`** | `LineString` | Brak specyficznych, ale muszą być poprawne cechy drogowe. | **Overpass Turbo** (`https://overpass-turbo.eu/`) |
| **`flood.geojson`** | `Polygon` | **`risk_cost: number`** | **GeoJSON.io** (`https://geojson.io/`) |

---

**Opis:**

* **`roads.geojson`**: Zawiera sieć dróg, używaną do budowy Grafu.
* **`flood.geojson`**: Zawiera symulowane strefy zalewowe. Wartość `risk_cost` jest dodawana do kosztu krawędzi podczas routingu.

## 📡 Testowe Wywołania API

Wszystkie endpointy są dostępne pod bazowym adresem `/api/evac`.

| Endpoint | Metoda | Opis |
| :--- | :--- | :--- |
| `/api/evac/route` | `GET` | Oblicza najkrótszą i najbezpieczniejszą trasę. |
| `/api/evac/bbox` | `GET` | Zwraca obwiednię (BBOX) dla wszystkich dróg. |
| `/api/evac/flood-zones` | `GET` | Zwraca wszystkie poligony stref zalewowych. |

### 1. Obliczenie Trasy (Routing)

**Zapytanie (przykład dla Otwocka):**
Obliczenie trasy z punktu (52.13, 21.15) do (52.10, 21.18).

```bash
curl "http://localhost:3000/api/evac/route?start=52.13,21.15&end=52.10,21.18"
```

**Odpowiedź:**
```json
Odpowiedź: GeoJSON LineString z właściwościami zawierającymi całkowity koszt (totalWeightedCost) i długość.
```

### 2. Pobranie Obwiedni (BBOX)

Zwraca obwiednię całej załadowanej sieci dróg. Używane przez frontend do inicjalizacji widoku mapy.

| Endpoint | Metoda | Opis |
| :--- | :--- | :--- |
| `/api/evac/bbox` | `GET` | Zwraca minimalny prostokąt obejmujący wszystkie drogi. |

**Odpowiedź:**
```json
{
  "bbox": [minLon, minLat, maxLon, maxLat]
}
```

### 3. Pobranie Stref Zalewowych

Zwraca poligony stref zalewowych.

| Endpoint | Metoda | Opis |
| :--- | :--- | :--- |
| `/api/evac/flood-zones` | `GET` | Zwraca GeoJSON FeatureCollection z poligonami. |

**Odpowiedź:** 
```json
Odpowiedź: GeoJSON FeatureCollection z poligonami
```

## 🧪 Testy Jednostkowe (Unit Tests)

Projekt wykorzystuje framework **Jest** do zapewnienia stabilności i poprawności kluczowych algorytmów.

### Uruchomienie Testów

Aby uruchomić wszystkie testy jednostkowe w katalogu `backend/`, użyj skryptu:

```bash
npm test
```

### Pokrycie Testowe

Główne obszary pokryte testami to:

* **Logika routingu (Dijkstra):** Sprawdzenie poprawności znajdowania najkrótszej ścieżki i kosztów, a także obsługa nieosiągalnych węzłów (`src/__tests__/dijkstra.test.ts`).
* **Ładowanie Danych:** Weryfikacja, czy pliki GeoJSON są poprawnie wczytywane, a nieprawidłowe geometrie są odrzucane (`src/__tests__/loaders.test.ts`).
* **Geoprocessing:** Testowanie poprawności obliczeń geograficznych, takich jak **Bounding Box (BBOX)** i budowanie indeksów przestrzennych **R-tree** dla stref zalewowych (`src/__tests__/geo.test.ts`).