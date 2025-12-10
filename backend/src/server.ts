import * as dotenv from 'dotenv';
import express from 'express';
import { errorHandler } from '@middlewares/errorHandler';
import { logger } from '@utils/logger';

import { loadRoads } from '@loaders/loadRoads';
import { loadFloodZones } from '@loaders/loadFlood';
import { calculateBbox } from '@utils/geometry';

import { buildFloodIndex } from '@utils/flood';
import { setLoadedData, FloodFeatures, RoadFeatures } from './config';
import { routeController } from '@controllers/routeController';

dotenv.config();

const useDynamicFloodMapping = !!process.env.SENTINEL_HUB_CLIENT_ID && !!process.env.SENTINEL_HUB_CLIENT_SECRET;

const PORT = 3000;
const app = express();

app.use(express.json());
app.use(errorHandler);

app.get('/api/evac/route', routeController);

app.get('/api/evac/flood-zones', (req, res) => {
  if (!FloodFeatures || FloodFeatures.length === 0) {
    return res.status(503).json({ error: "Dane stref zalania nie zostały załadowane." });
  }
  
  res.json({
    type: "FeatureCollection",
    features: FloodFeatures
  });
});

app.get('/api/evac/bbox', (req, res) => {
  if (!RoadFeatures || RoadFeatures.length === 0) {
    return res.status(503).json({ error: "Dane dróg nie zostały załadowane." });
  }

  const bbox = calculateBbox(RoadFeatures);

  if (!bbox) {
    return res.status(404).json({ error: "Nie znaleziono danych do obliczenia BBOX." });
  }

  res.json({ bbox });
});

async function startServer() {
  logger.info("SERVER", "🚀 Inicjalizacja Serwera Ewakuacji...");

  try {
    // 1. Ładowanie Dróg (Wymagane do BBOX i Grafu)
    const { features: roadFeaturesGeoJSON, graph: roadsGraph } = loadRoads(); 
    
    // 2. Ładowanie Stref Powodziowych (nowa, asynchroniczna wersja)
    logger.info("SERVER", `Ładowanie stref zalania. Tryb dynamiczny: ${useDynamicFloodMapping ? 'TAK (Sentinel Hub)' : 'NIE (Plik GeoJSON)'}`);

    // Przekazujemy roadFeaturesGeoJSON do obliczenia BBOX wewnątrz loadFloodZones
    const floodPolygons = await loadFloodZones(roadFeaturesGeoJSON, useDynamicFloodMapping);
    
    // 3. Budowanie Indeksu Powodziowego
    const floodIndex = buildFloodIndex(floodPolygons);

    // 4. Ustawienie Danych
    setLoadedData(roadsGraph, roadFeaturesGeoJSON, floodPolygons, floodIndex);

    app.listen(PORT, () => {
      logger.info("SERVER", `✅ Serwer uruchomiony na http://localhost:${PORT}`);
    });
    
    /* const { features: roadFeaturesGeoJSON, graph: roadsGraph } = loadRoads(); 
    
    const floodPolygons = loadFloodZones();
    const floodIndex = buildFloodIndex(floodPolygons);

    setLoadedData(roadsGraph, roadFeaturesGeoJSON, floodPolygons, floodIndex);

    app.listen(PORT, () => {
      logger.info("SERVER", `✅ Serwer uruchomiony na http://localhost:${PORT}`);
    }); */

  } catch (error) {
    logger.critical("SERVER", "❌ Krytyczny błąd podczas uruchamiania serwera:", error);
    process.exit(1);
  }
}

startServer();
