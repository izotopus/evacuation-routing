import { logger } from '@utils/logger';

const AUTH_URL = 'https://services.sentinel-hub.com/oauth/token';

let accessToken: string | null = null;
let tokenExpiry: number = 0; // Czas wygaśnięcia w milisekundach

/**
 * Pobiera token dostępu OAuth z Sentinel Hub.
 */
async function getSentinelHubToken(): Promise<string> {
  const CLIENT_ID = process.env.SENTINEL_HUB_CLIENT_ID;
  const CLIENT_SECRET = process.env.SENTINEL_HUB_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Brak SENTINEL_HUB_CLIENT_ID lub SECRET w zmiennych środowiskowych.");
  }

  // Sprawdzenie, czy token jest nadal ważny (dajemy 5 minut marginesu)
  if (accessToken && tokenExpiry > Date.now() + 300000) { 
    return accessToken;
  }

  logger.info("AUTH:SH", "Pobieranie nowego tokenu dostępu Sentinel Hub...");
  
  try {
    const response = await fetch(AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'grant_type': 'client_credentials',
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Błąd autoryzacji Sentinel Hub: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    accessToken = data.access_token;
    // Ustawienie czasu wygaśnięcia (teraz + sekundy_ważności * 1000)
    tokenExpiry = Date.now() + (data.expires_in * 1000); 

    logger.info("AUTH:SH", "Token Sentinel Hub pomyślnie uzyskany.");
    return accessToken || '';

  } catch (error) {
    logger.error("AUTH:SH", `Błąd podczas pobierania tokenu: ${(error as Error).message}`);
    throw new Error("Nie udało się uzyskać tokenu Sentinel Hub.");
  }
}

export { getSentinelHubToken };