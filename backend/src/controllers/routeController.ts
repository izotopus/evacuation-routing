import { Request, Response } from 'express';
import { logger } from '@utils/logger';
import { calculateRoute } from '@services/routeService';
import type { Coordinates } from '@interfaces/types';

/**
 * Waliduje format współrzędnych "lat,lon" i zwraca [lon, lat]
 * @param param String "lat,lon"
 * @returns Koordynaty [lon, lat] lub null
 */
function parseCoordinates(param: any): Coordinates | null {
  if (typeof param !== 'string') return null;
  
  const parts = param.split(',').map(p => parseFloat(p.trim()));
  
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    // API przyjmuje lat,lon, ale GeoJSON/Turf używa [lon, lat]
    const lat = parts[0];
    const lon = parts[1];
    return [lon, lat];
  }
  return null;
}

/**
 * Obsługuje endpoint /api/evac/route
 * GET /api/evac/route?start=lat,lon&end=lat,lon
 */
export function routeController(req: Request, res: Response) {
  const startParam = req.query.start as string;
  const endParam = req.query.end as string;

  const startCoords = parseCoordinates(startParam);
  const endCoords = parseCoordinates(endParam);

  if (!startCoords || !endCoords) {
    return res.status(400).json({ 
      error: "Wymagane parametry: start=lat,lon i end=lat,lon z poprawnymi współrzędnymi." 
    });
  }

  try {
    const routeGeojson = calculateRoute(startCoords, endCoords);

    if (routeGeojson) {

      return res.json(routeGeojson);

    } else {

      return res.status(404).json({ 
        error: "Nie można znaleźć ścieżki. Sprawdź, czy punkty są w zasięgu sieci drogowej." 
      });
      
    }
  } catch (error) {
    logger.warn("ROUTE", "Błąd podczas obliczania trasy:", error);
    return res.status(500).json({ error: "Wewnętrzny błąd serwera." });
  }
}