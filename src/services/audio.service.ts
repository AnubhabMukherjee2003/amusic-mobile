import { Song } from '../types/music.types'
import { getStreamUrl } from './api.service'
import { Capacitor } from '@capacitor/core'

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
  private isNative: boolean = false
  private audioContext: any = null
  private isIntentionallyPaused: boolean = false

  constructor() {
    this.audio = new Audio()
    this.isNative = Capacitor.isNativePlatform()
    this.setupEventListeners()
    this.setupMediaSession()
    this.setupBackgroundAudio()
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

  private async setupBackgroundAudio() {
    console.log('Setting up background audio support')

    // Setup AudioContext for better audio handling
    try {
      const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext
      if (AudioContext) {
        this.audioContext = new AudioContext()
        
        // Resume audio context on user interaction
        const resumeAudio = () => {
          if (this.audioContext.state === 'suspended') {
            this.audioContext.resume()
          }
        }
        
        document.addEventListener('touchstart', resumeAudio, { once: false })
        document.addEventListener('click', resumeAudio, { once: false })
      }
    } catch (error) {
      console.log('AudioContext setup failed:', error)
    }

    // Enhanced visibility change handling for background playback
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.isPlaying()) {
        console.log('App backgrounded - maintaining audio playback')
        
        // Ensure audio continues playing (only if not intentionally paused)
        setTimeout(() => {
          if (this.currentSong && this.audio.paused && !this.isIntentionallyPaused) {
            this.audio.play().catch(console.error)
          }
        }, 100)
      } else if (!document.hidden && this.currentSong) {
        console.log('App foregrounded - checking audio state')
        this.updateMediaSession()
      }
    })

    // Handle page lifecycle events
    document.addEventListener('freeze', () => {
      console.log('Page frozen - audio should continue')
    })

    document.addEventListener('resume', () => {
      console.log('Page resumed - checking audio state')
      if (this.currentSong && this.audio.paused && !this.isIntentionallyPaused) {
        this.audio.play().catch(console.error)
      }
    })

    // Prevent audio interruption on focus loss
    window.addEventListener('blur', () => {
      console.log('Window blur - maintaining audio')
    })

    window.addEventListener('focus', () => {
      console.log('Window focus - checking audio state')
      if (this.currentSong && this.audio.paused && !this.isIntentionallyPaused) {
        this.audio.play().catch(console.error)
      }
    })

    // Handle audio interruptions (but not intentional pauses)
    this.audio.addEventListener('pause', () => {
      if (this.currentSong && !this.audio.ended && !this.isIntentionallyPaused) {
        console.log('Audio paused unexpectedly, attempting to resume...')
        setTimeout(() => {
          if (this.currentSong && this.audio.paused && !this.isIntentionallyPaused) {
            this.audio.play().catch(console.error)
          }
        }, 500)
      }
    })
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
      
      // Request audio focus on native platforms
      if (this.isNative) {
        this.requestAudioFocus()
      }
      
      // Get stream URL from backend
      const streamUrl = await getStreamUrl(song.videoId)
      console.log('Stream URL received:', streamUrl)

      this.currentSong = song
      
      // Set audio properties for better streaming and background playback
      this.audio.preload = 'auto'
      this.audio.crossOrigin = 'anonymous'
      
      // Set audio source and load
      this.audio.src = streamUrl
      this.audio.load()
      
      // Resume audio context if suspended
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }
      
      // Load and play
      await this.audio.play()
      
      // Update media session
      this.updateMediaSession()
      
      console.log('Audio playback started successfully')
      
    } catch (error) {
      console.error('Playback error:', error)
      throw error
    }
  }

  private requestAudioFocus() {
    // Request audio focus to prevent other apps from interrupting
    if ((window as any).cordova?.plugins?.audioManagement) {
      try {
        (window as any).cordova.plugins.audioManagement.requestAudioFocus(
          () => console.log('Audio focus granted'),
          () => console.log('Audio focus denied')
        )
      } catch (error) {
        console.log('Audio focus request failed:', error)
      }
    }
  }

  pause() {
    this.isIntentionallyPaused = true
    this.audio.pause()
  }

  resume() {
    this.isIntentionallyPaused = false
    this.audio.play().catch(console.error)
  }

  stop() {
    this.audio.pause()
    this.audio.currentTime = 0
    this.currentSong = null
    
    // Clear media session
    if (this.mediaSession) {
      this.mediaSession.metadata = null
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