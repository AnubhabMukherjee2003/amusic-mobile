import { Song, StreamResponse } from '../types/music.types'

// Use environment variable or fallback to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

/**
 * Search for songs on YouTube Music
 */
export async function searchSongs(query: string): Promise<Song[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}`
    )
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Search error:', error)
    throw error
  }
}

/**
 * Get stream URL for a video (returns proxied URL through backend)
 */
export async function getStreamUrl(videoId: string): Promise<string> {
  // Return the proxy endpoint URL - backend will handle the actual stream
  return `${API_BASE_URL}/api/stream/${videoId}`
}

/**
 * Check API health
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`)
    return response.ok
  } catch (error) {
    return false
  }
}
