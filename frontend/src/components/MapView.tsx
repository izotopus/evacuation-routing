import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Rectangle, useMapEvents, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchRoute, RouteResponse, fetchFloodZones, FloodZoneCollection, fetchBbox, Bbox } from '../api/evacApi';

type LatLon = [number, number]; 

interface MapState {
  start: LatLon | null; 
  end: LatLon | null;   
  route: RouteResponse | null;
  loading: boolean;
  error: string | null;
  floodZones: FloodZoneCollection | null; 
  floodError: string | null;
  bbox: Bbox | null;
}

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MapViewAdjuster: React.FC<{ bbox: Bbox | null }> = ({ bbox }) => {
  const map = useMap();
  const boundsSetRef = useRef(false); 

  useEffect(() => {
    if (bbox && !boundsSetRef.current) {
      const bounds: L.LatLngBoundsLiteral = [
        [bbox[1], bbox[0]],
        [bbox[3], bbox[2]]
      ];
      
      map.fitBounds(bounds, { 
        padding: [50, 50],
      }); 
      
      boundsSetRef.current = true;
    }
  }, [bbox, map]);

  return null;
};

const LocationMarker: React.FC<{ state: MapState, setState: React.Dispatch<React.SetStateAction<MapState>> }> = ({ state, setState }) => {
  useMapEvents({
    click(e) {
      const newPoint: LatLon = [e.latlng.lat, e.latlng.lng];
      
      if (!state.start) {
        setState(prev => ({ ...prev, start: newPoint, route: null, error: null }));
      } else if (!state.end) {
        setState(prev => ({ ...prev, end: newPoint, route: null, error: null }));
      } else {
        setState(prev => ({ ...prev, start: newPoint, end: null, route: null, loading: false, error: null, floodError: null }));
      }
    },
  });

  return null;
};

export const MapView: React.FC = () => {
  
  const initialCenter: LatLon = [52.107470, 21.255166]; 
  const initialZoom = 13;

  const [state, setState] = useState<MapState>({
    start: null,
    end: null,
    route: null,
    loading: false,
    error: null,
    floodZones: null, 
    floodError: null,
    bbox: null,
  });

  useEffect(() => {
    const loadBbox = async () => {
      try {
        const fetchedBbox = await fetchBbox();
        setState(prev => ({ ...prev, bbox: fetchedBbox }));
      } catch (err: any) {
        console.error("Błąd ładowania BBOX:", err);
      }
    };

    if (!state.bbox) {
      loadBbox();
    }
  }, [state.bbox]);

  useEffect(() => {
    const loadZones = async () => {
      try {
        const zones = await fetchFloodZones();
        setState(prev => ({ ...prev, floodZones: zones }));
      } catch (err: any) {
        console.error("Błąd ładowania stref zalania:", err);
        setState(prev => ({ ...prev, floodError: "Nie udało się wczytać stref zalania." }));
      }
    };

    if (!state.floodZones && !state.floodError) {
      loadZones();
    }
  }, [state.floodZones, state.floodError]);

  const calculateRoute = useCallback(async () => {
    const { start, end } = state;

    if (!start || !end) return;

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await fetchRoute(start, end);
      setState(prev => ({ ...prev, route: result, loading: false }));
    } catch (err: any) {
      console.error("Błąd podczas pobierania trasy:", err);
      setState(prev => ({ ...prev, error: err.message || "Nie znaleziono trasy.", loading: false }));
    }
  }, [state.start, state.end]);

  useEffect(() => {
    if (state.start && state.end) {
      calculateRoute();
    }
  }, [state.start, state.end, calculateRoute]);

  const getBboxBounds = (): L.LatLngBoundsLiteral | null => {
    if (!state.bbox) {
      return null;
    }
    const [minLon, minLat, maxLon, maxLat] = state.bbox;
    
    return [
      [minLat, minLon],
      [maxLat, maxLon]
    ];
  };

  const bboxBounds = getBboxBounds();
  const routeStyle = {
    color: state.route?.properties.riskPenaltyApplied ? '#DC3545' : '#198754',
    weight: 5,
    opacity: 0.8,
  };
  
  const floodZoneStyle = {
    color: '#2980b9',
    fillColor: '#3498db', 
    fillOpacity: 0.4,
    weight: 1.5,
    opacity: 0.8,
  };

  const bboxStyle = {
    color: '#007bff',
    weight: 2,
    opacity: 0.8,
    fillOpacity: 0.025,
    dashArray: '5, 5',
  };

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <MapContainer center={initialCenter} zoom={initialZoom} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
        />

        <MapViewAdjuster bbox={state.bbox} />

        <LocationMarker state={state} setState={setState} />

        {state.floodZones && (
          <GeoJSON 
            data={state.floodZones as any} 
            style={() => floodZoneStyle} 
          />
        )}
        
        {state.start && (
          <Marker position={state.start}>
            <Popup>START</Popup>
          </Marker>
        )}
        
        {state.end && (
          <Marker position={state.end}>
            <Popup>CEL</Popup>
          </Marker>
        )}

        {bboxBounds && (
          <Rectangle 
            bounds={bboxBounds} 
            pathOptions={bboxStyle} 
          />
        )}
        {state.route && (
          <GeoJSON 
            data={state.route as any} 
            style={routeStyle}
          >
            <Popup>
              <strong>Trasa:</strong>
              <br/> Długość: {(state.route.properties.pathLengthMeters / 1000).toFixed(2)} km
              <br/> Unikano ryzyka: {state.route.properties.riskPenaltyApplied ? 'TAK' : 'NIE'}
              <br/> Koszt: {state.route.properties.totalWeightedCost.toFixed(2)}
            </Popup>
          </GeoJSON>
        )}

        <div className="map-overlay">
          {state.loading && <p className="loading"><span className="spinning">⏳</span> Obliczam trasę...</p>}
          {state.error && <p className="error">❌ Błąd: {state.error}</p>}
          {!state.start && !state.loading && <p className="info">Kliknij na mapę wewnątrz obramowania, aby wybrać START.</p>}
          {state.start && !state.end && !state.loading && <p className="info">Wybierz CEL.</p>}
          {state.route && <p className="success">✅ Trasa gotowa! Kliknij linię, aby zobaczyć szczegóły.</p>}
          {state.floodError && <p className="error">❌ {state.floodError}</p>}
        </div>
      </MapContainer>
    </div>
  );
};