import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Song, PlayerState } from '../types/music.types'
import { audioService } from '../services/audio.service'

interface PlayerContextType extends PlayerState {
  playSong: (song: Song) => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => void
  seek: (time: number) => void
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined)

export const PlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PlayerState>({
    currentSong: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isLoading: false
  })

  useEffect(() => {
    // Setup audio service callbacks
    audioService.onPlay(() => {
      setState(prev => ({ ...prev, isPlaying: true, isLoading: false }))
    })

    audioService.onPause(() => {
      setState(prev => ({ ...prev, isPlaying: false }))
    })

    audioService.onTimeUpdate(() => {
      setState(prev => ({
        ...prev,
        currentTime: audioService.getCurrentTime(),
        duration: audioService.getDuration()
      }))
    })

    audioService.onLoaded(() => {
      setState(prev => ({
        ...prev,
        duration: audioService.getDuration()
      }))
    })

    audioService.onEnded(() => {
      setState(prev => ({
        ...prev,
        isPlaying: false,
        currentTime: 0
      }))
    })

    audioService.onError((error) => {
      console.error('Audio playback error:', error)
      setState(prev => ({
        ...prev,
        isPlaying: false,
        isLoading: false
      }))
    })
  }, [])

  const playSong = async (song: Song) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, currentSong: song }))
      await audioService.play(song)
    } catch (error) {
      console.error('Failed to play song:', error)
      setState(prev => ({ ...prev, isLoading: false }))
      throw error
    }
  }

  const pause = () => {
    audioService.pause()
  }

  const resume = () => {
    audioService.resume()
  }

  const stop = () => {
    audioService.stop()
    setState({
      currentSong: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      isLoading: false
    })
  }

  const seek = (time: number) => {
    audioService.seek(time)
  }

  return (
    <PlayerContext.Provider value={{ ...state, playSong, pause, resume, stop, seek }}>
      {children}
    </PlayerContext.Provider>
  )
}

export const usePlayer = () => {
  const context = useContext(PlayerContext)
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider')
  }
  return context
}
