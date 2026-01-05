export interface Thumbnail {
  url: string
  width: number
  height: number
}

export interface Song {
  name: string
  artist: string
  videoId: string
  thumbnails: Thumbnail[]
  duration: string
  album?: string | null
}

export interface PlayerState {
  currentSong: Song | null
  isPlaying: boolean
  currentTime: number
  duration: number
  isLoading: boolean
}

export interface StreamResponse {
  streamUrl: string
  videoId: string
}
