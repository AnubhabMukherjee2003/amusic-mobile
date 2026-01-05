import { Song } from '../types/music.types'
import { getStreamUrl } from './api.service'

type AudioEventCallback = () => void

type CordovaMediaError = {
  code: number
  message?: string
}

class AudioService {
  private audio: HTMLAudioElement
  private currentSong: Song | null = null

  private onPlayCallback: AudioEventCallback | null = null
  private onPauseCallback: AudioEventCallback | null = null
  private onEndedCallback: AudioEventCallback | null = null
  private onTimeUpdateCallback: AudioEventCallback | null = null
  private onLoadedCallback: AudioEventCallback | null = null
  private onErrorCallback: ((error: Error) => void) | null = null

  private mediaSession: MediaSession | null = null
  private wakeLock: any = null

  // Cordova Media (native) support
  private media: any = null
  private mediaTimer: number | null = null
  private mediaCurrentTime = 0
  private mediaDuration = 0
  private mediaIsPlaying = false

  constructor() {
    this.audio = new Audio()
    this.setupHtmlEventListeners()
    this.setupMediaSession()
    this.setupWakeLock()
  }

  private setupHtmlEventListeners() {
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

    this.audio.addEventListener('error', () => {
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
    if (!('mediaSession' in navigator)) return
    this.mediaSession = navigator.mediaSession

    this.mediaSession.setActionHandler('play', () => this.resume())
    this.mediaSession.setActionHandler('pause', () => this.pause())
    this.mediaSession.setActionHandler('seekbackward', () => this.seek(Math.max(0, this.getCurrentTime() - 10)))
    this.mediaSession.setActionHandler('seekforward', () => this.seek(Math.min(this.getDuration(), this.getCurrentTime() + 10)))
    this.mediaSession.setActionHandler('seekto', (details: any) => {
      if (typeof details?.seekTime === 'number') this.seek(details.seekTime)
    })
  }

  private setupWakeLock() {
    if (!('wakeLock' in navigator)) return

    this.audio.addEventListener('play', async () => {
      try {
        this.wakeLock = await (navigator as any).wakeLock.request('screen')
      } catch {
        // ignore
      }
    })

    const release = () => {
      if (!this.wakeLock) return
      try {
        this.wakeLock.release()
      } catch {
        // ignore
      }
      this.wakeLock = null
    }

    this.audio.addEventListener('pause', release)
    this.audio.addEventListener('ended', release)
  }

  private updateMediaSession() {
    if (!this.mediaSession || !this.currentSong) return
    this.mediaSession.metadata = new MediaMetadata({
      title: this.currentSong.name,
      artist: this.currentSong.artist,
      album: this.currentSong.album || 'Unknown Album',
      artwork:
        this.currentSong.thumbnails?.map((thumb) => ({
          src: thumb.url,
          sizes: `${thumb.width}x${thumb.height}`,
          type: 'image/jpeg'
        })) || []
    })
  }

  private updatePositionState() {
    if (!this.mediaSession || !this.audio.duration) return
    try {
      this.mediaSession.setPositionState({
        duration: this.audio.duration,
        playbackRate: this.audio.playbackRate,
        position: this.audio.currentTime
      })
    } catch {
      // ignore
    }
  }

  private isCordovaMediaAvailable(): boolean {
    const w = window as any
    return Boolean(w?.cordova && typeof w?.Media === 'function')
  }

  private enableBackgroundPlayback() {
    const w = window as any
    try {
      w?.cordova?.plugins?.backgroundMode?.enable?.()
    } catch {
      // ignore
    }
    try {
      w?.plugins?.insomnia?.keepAwake?.()
    } catch {
      // ignore
    }
  }

  private disableBackgroundPlayback() {
    const w = window as any
    try {
      w?.plugins?.insomnia?.allowSleepAgain?.()
    } catch {
      // ignore
    }
    try {
      w?.cordova?.plugins?.backgroundMode?.disable?.()
    } catch {
      // ignore
    }
  }

  private clearMediaTimer() {
    if (this.mediaTimer) {
      window.clearInterval(this.mediaTimer)
      this.mediaTimer = null
    }
  }

  private startMediaPolling() {
    this.clearMediaTimer()
    if (!this.media) return

    this.mediaTimer = window.setInterval(() => {
      if (!this.media) return

      try {
        const d = Number(this.media.getDuration?.() ?? 0)
        if (d > 0 && d !== this.mediaDuration) {
          this.mediaDuration = d
          this.onLoadedCallback?.()
        }
      } catch {
        // ignore
      }

      try {
        this.media.getCurrentPosition?.(
          (pos: number) => {
            if (typeof pos === 'number' && pos >= 0) {
              this.mediaCurrentTime = pos
              this.onTimeUpdateCallback?.()
            }
          },
          () => {
            // ignore
          }
        )
      } catch {
        // ignore
      }
    }, 500)
  }

  private stopCordovaMedia() {
    this.clearMediaTimer()
    if (this.media) {
      try {
        this.media.stop?.()
      } catch {
        // ignore
      }
      try {
        this.media.release?.()
      } catch {
        // ignore
      }
    }
    this.media = null
    this.mediaCurrentTime = 0
    this.mediaDuration = 0
    this.mediaIsPlaying = false
    this.disableBackgroundPlayback()
  }

  async play(song: Song) {
    this.stop()

    this.currentSong = song
    const streamUrl = await getStreamUrl(song.videoId)

    if (this.isCordovaMediaAvailable()) {
      this.enableBackgroundPlayback()

      const w = window as any
      const MediaCtor = w.Media

      this.media = new MediaCtor(
        streamUrl,
        () => {
          this.mediaIsPlaying = false
          this.onEndedCallback?.()
        },
        (err: CordovaMediaError) => {
          this.mediaIsPlaying = false
          const msg = err?.message ? `${err.code}: ${err.message}` : String(err?.code ?? 'unknown')
          this.onErrorCallback?.(new Error(`Native audio error: ${msg}`))
        },
        (status: number) => {
          const MediaObj = w.Media
          if (status === MediaObj.MEDIA_RUNNING) {
            this.mediaIsPlaying = true
            this.onPlayCallback?.()
          } else if (status === MediaObj.MEDIA_PAUSED) {
            this.mediaIsPlaying = false
            this.onPauseCallback?.()
          } else if (status === MediaObj.MEDIA_STOPPED) {
            this.mediaIsPlaying = false
            this.onPauseCallback?.()
          }
        }
      )

      this.mediaIsPlaying = true
      this.media.play?.()
      this.onPlayCallback?.()
      this.startMediaPolling()
      return
    }

    this.audio.preload = 'auto'
    this.audio.src = streamUrl
    this.audio.load()
    await this.audio.play()
    this.updateMediaSession()
  }

  pause() {
    if (this.media) {
      try {
        this.media.pause?.()
      } catch {
        // ignore
      }
      this.mediaIsPlaying = false
      this.onPauseCallback?.()
      return
    }
    this.audio.pause()
  }

  resume() {
    if (this.media) {
      this.enableBackgroundPlayback()
      this.media.play?.()
      this.mediaIsPlaying = true
      this.onPlayCallback?.()
      this.startMediaPolling()
      return
    }
    this.audio.play()
  }

  stop() {
    if (this.media) this.stopCordovaMedia()

    this.audio.pause()
    this.audio.currentTime = 0
    this.currentSong = null

    if (this.mediaSession) this.mediaSession.metadata = null

    if (this.wakeLock) {
      try {
        this.wakeLock.release()
      } catch {
        // ignore
      }
      this.wakeLock = null
    }
  }

  seek(time: number) {
    if (this.media) {
      try {
        this.media.seekTo?.(Math.max(0, Math.floor(time * 1000)))
        this.mediaCurrentTime = Math.max(0, time)
        this.onTimeUpdateCallback?.()
      } catch {
        // ignore
      }
      return
    }

    this.audio.currentTime = time
    this.updatePositionState()
  }

  getCurrentTime(): number {
    return this.media ? this.mediaCurrentTime : this.audio.currentTime
  }

  getDuration(): number {
    return this.media ? this.mediaDuration || 0 : this.audio.duration || 0
  }

  isPlaying(): boolean {
    return this.media ? this.mediaIsPlaying : !this.audio.paused
  }

  getCurrentSong(): Song | null {
    return this.currentSong
  }

  setVolume(volume: number) {
    const v = Math.max(0, Math.min(1, volume))
    if (this.media) {
      try {
        this.media.setVolume?.(v)
      } catch {
        // ignore
      }
      return
    }
    this.audio.volume = v
  }

  getVolume(): number {
    return this.audio.volume
  }

  setPlaybackRate(rate: number) {
    if (this.media) return
    this.audio.playbackRate = Math.max(0.25, Math.min(2, rate))
    this.updatePositionState()
  }

  getPlaybackRate(): number {
    return this.audio.playbackRate
  }

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
