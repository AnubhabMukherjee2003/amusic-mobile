import { Song } from '../types/music.types'
import { getStreamUrl } from './api.service'

type AudioEventCallback = () => void

class AudioService {
  private audio: HTMLAudioElement
  private currentSong: Song | null = null
  private onPlayCallback: AudioEventCallback | null = null
  private onPauseCallback: AudioEventCallback | null = null
  private onEndedCallback: AudioEventCallback | null = null
  private onTimeUpdateCallback: AudioEventCallback | null = null
  private onLoadedCallback: AudioEventCallback | null = null
  private onErrorCallback: ((error: Error) => void) | null = null
  private mediaSession: any = null
  private wakeLock: any = null

  constructor() {
    this.audio = new Audio()
    this.setupEventListeners()
    this.setupMediaSession()
    this.setupWakeLock()
  }

  private setupEventListeners() {
    this.audio.addEventListener('play', () => {
      this.updateMediaSession()
      this.onPlayCallback?.()
    })

    this.audio.addEventListener('pause', () => {
      this.onPauseCallback?.()
    })

    this.audio.addEventListener('ended', () => {
      this.onEndedCallback?.()
    })

    this.audio.addEventListener('timeupdate', () => {
      this.updatePositionState()
      this.onTimeUpdateCallback?.()
    })

    this.audio.addEventListener('loadedmetadata', () => {
      this.updateMediaSession()
      this.onLoadedCallback?.()
    })

    this.audio.addEventListener('error', (e) => {
      let errorMsg = 'Unknown error'
      if (this.audio.error) {
        switch (this.audio.error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMsg = 'Playback aborted'
            break
          case MediaError.MEDIA_ERR_NETWORK:
            errorMsg = 'Network error - Check your connection'
            break
          case MediaError.MEDIA_ERR_DECODE:
            errorMsg = 'Decode error - Invalid audio format'
            break
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMsg = 'Format not supported'
            break
        }
        errorMsg = `MEDIA_ELEMENT_ERROR: ${errorMsg}`
      }
      const error = new Error(`Audio error: ${errorMsg}`)
      console.error('Audio element error:', error, this.audio.error)
      this.onErrorCallback?.(error)
    })

    // Handle visibility change to maintain playback
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isPlaying()) {
        console.log('App hidden, maintaining playback')
      }
    })
  }

  private setupMediaSession() {
    if ('mediaSession' in navigator) {
      this.mediaSession = navigator.mediaSession
      
      this.mediaSession.setActionHandler('play', () => {
        this.resume()
      })

      this.mediaSession.setActionHandler('pause', () => {
        this.pause()
      })

      this.mediaSession.setActionHandler('seekbackward', () => {
        this.seek(Math.max(0, this.getCurrentTime() - 10))
      })

      this.mediaSession.setActionHandler('seekforward', () => {
        this.seek(Math.min(this.getDuration(), this.getCurrentTime() + 10))
      })

      this.mediaSession.setActionHandler('seekto', (details: any) => {
        if (details.seekTime) {
          this.seek(details.seekTime)
        }
      })
    }
  }

  private async setupWakeLock() {
    if ('wakeLock' in navigator) {
      this.audio.addEventListener('play', async () => {
        try {
          this.wakeLock = await (navigator as any).wakeLock.request('screen')
          console.log('Wake lock acquired')
        } catch (err) {
          console.log('Wake lock request failed:', err)
        }
      })

      this.audio.addEventListener('pause', () => {
        if (this.wakeLock) {
          this.wakeLock.release()
          this.wakeLock = null
          console.log('Wake lock released')
        }
      })
    }
  }

  private updateMediaSession() {
    if (this.mediaSession && this.currentSong) {
      this.mediaSession.metadata = new MediaMetadata({
        title: this.currentSong.name,
        artist: this.currentSong.artist,
        album: this.currentSong.album || 'Unknown Album',
        artwork: this.currentSong.thumbnails?.map(thumb => ({
          src: thumb.url,
          sizes: `${thumb.width}x${thumb.height}`,
          type: 'image/jpeg'
        })) || []
      })
    }
  }

  private updatePositionState() {
    if (this.mediaSession && this.audio.duration) {
      try {
        this.mediaSession.setPositionState({
          duration: this.audio.duration,
          playbackRate: this.audio.playbackRate,
          position: this.audio.currentTime
        })
      } catch (e) {
        // Position state not supported
      }
    }
  }

  async play(song: Song) {
    try {
      // Stop any currently playing audio first
      this.stop()
      
      // Get stream URL from backend
      const streamUrl = await getStreamUrl(song.videoId)
      console.log('Stream URL received:', streamUrl)

      this.currentSong = song
      
      // Set audio properties for better streaming
      this.audio.preload = 'auto'
      
      // Set audio source and load
      this.audio.src = streamUrl
      this.audio.load()
      
      // Load and play
      await this.audio.play()
      
      // Update media session
      this.updateMediaSession()
    } catch (error) {
      console.error('Playback error:', error)
      throw error
    }
  }

  pause() {
    this.audio.pause()
  }

  resume() {
    this.audio.play()
  }

  stop() {
    this.audio.pause()
    this.audio.currentTime = 0
    this.currentSong = null
    
    // Clear media session
    if (this.mediaSession) {
      this.mediaSession.metadata = null
    }
    
    // Release wake lock
    if (this.wakeLock) {
      this.wakeLock.release()
      this.wakeLock = null
    }
  }

  seek(time: number) {
    this.audio.currentTime = time
    this.updatePositionState()
  }

  getCurrentTime(): number {
    return this.audio.currentTime
  }

  getDuration(): number {
    return this.audio.duration || 0
  }

  isPlaying(): boolean {
    return !this.audio.paused
  }

  getCurrentSong(): Song | null {
    return this.currentSong
  }

  setVolume(volume: number) {
    this.audio.volume = Math.max(0, Math.min(1, volume))
  }

  getVolume(): number {
    return this.audio.volume
  }

  setPlaybackRate(rate: number) {
    this.audio.playbackRate = Math.max(0.25, Math.min(2, rate))
    this.updatePositionState()
  }

  getPlaybackRate(): number {
    return this.audio.playbackRate
  }

  // Event callbacks
  onPlay(callback: AudioEventCallback) {
    this.onPlayCallback = callback
  }

  onPause(callback: AudioEventCallback) {
    this.onPauseCallback = callback
  }

  onEnded(callback: AudioEventCallback) {
    this.onEndedCallback = callback
  }

  onTimeUpdate(callback: AudioEventCallback) {
    this.onTimeUpdateCallback = callback
  }

  onLoaded(callback: AudioEventCallback) {
    this.onLoadedCallback = callback
  }

  onError(callback: (error: Error) => void) {
    this.onErrorCallback = callback
  }
}

export const audioService = new AudioService()
