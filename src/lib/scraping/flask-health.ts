/**
 * Check if Flask scraping service is healthy and available
 */
export async function checkFlaskHealth(): Promise<boolean> {
  const flaskUrl = process.env.FLASK_API_URL || 'http://127.0.0.1:5000';
  
  try {
    const response = await fetch(`${flaskUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    return response.ok;
  } catch (error) {
    console.error('Flask health check failed:', error);
    return false;
  }
}

