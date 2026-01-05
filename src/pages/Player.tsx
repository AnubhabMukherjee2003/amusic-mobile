import React, { useEffect, useState } from 'react'
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonRange,
  IonSpinner,
  IonText
} from '@ionic/react'
import { playCircle, pauseCircle, stopCircle } from 'ionicons/icons'
import { useParams, useLocation } from 'react-router-dom'
import { usePlayer } from '../context/PlayerContext'
import { Song } from '../types/music.types'
import './Player.css'

const Player: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>()
  const location = useLocation<{ song: Song }>()
  const { currentSong, isPlaying, currentTime, duration, isLoading, playSong, pause, resume, stop, seek } = usePlayer()
  const [error, setError] = useState<string | null>(null)

  const song = location.state?.song

  // Auto-play when a new song is selected (different from current song)
  useEffect(() => {
    if (song && (!currentSong || currentSong.videoId !== song.videoId)) {
      handlePlay()
    }
  }, [song?.videoId]) // Only trigger when videoId changes

  const handlePlay = async () => {
    if (!song) return
    
    try {
      setError(null)
      await playSong(song)
    } catch (err) {
      console.error('Play error:', err)
      setError('Failed to play song. Please try again.')
    }
  }

  const handlePlayPause = () => {
    if (isPlaying) {
      pause()
    } else if (currentSong) {
      resume()
    } else {
      handlePlay()
    }
  }

  const handleSeek = (value: number) => {
    seek(value)
  }

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds === 0) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!song) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar color="dark">
            <IonButtons slot="start">
              <IonBackButton defaultHref="/" />
            </IonButtons>
            <IonTitle>Player</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen color="dark">
          <div className="error-container">
            <IonText color="danger">
              <p>Song not found</p>
            </IonText>
          </div>
        </IonContent>
      </IonPage>
    )
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="dark">
          <IonButtons slot="start">
            <IonBackButton defaultHref="/" />
          </IonButtons>
          <IonTitle>Now Playing</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen color="dark" className="player-content">
        <div className="player-container">
          {/* Album Art */}
          <div className="album-art-container">
            <img
              src={song.thumbnails[song.thumbnails.length - 1]?.url || song.thumbnails[0]?.url}
              alt={song.name}
              className={`album-art ${isPlaying ? 'playing' : ''}`}
            />
          </div>

          {/* Song Info */}
          <IonCard color="dark" className="song-info-card">
            <IonCardContent>
              <h1 className="song-title">{song.name}</h1>
              <p className="song-artist">{song.artist}</p>
              {song.album && <p className="song-album">{song.album}</p>}
            </IonCardContent>
          </IonCard>

          {/* Progress Bar */}
          <div className="progress-container">
            <div className="time-display">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <IonRange
              value={currentTime}
              min={0}
              max={duration || 100}
              onIonChange={(e) => handleSeek(e.detail.value as number)}
              disabled={!currentSong || isLoading}
              color="primary"
            />
          </div>

          {/* Controls */}
          <div className="controls-container">
            {isLoading ? (
              <IonSpinner name="crescent" className="loading-spinner" />
            ) : (
              <>
                <IonButton
                  fill="clear"
                  size="large"
                  onClick={handlePlayPause}
                  disabled={!song}
                  className="play-button"
                >
                  <IonIcon
                    slot="icon-only"
                    icon={isPlaying ? pauseCircle : playCircle}
                    className="control-icon"
                  />
                </IonButton>
                <IonButton
                  fill="clear"
                  size="default"
                  onClick={stop}
                  disabled={!currentSong}
                >
                  <IonIcon slot="icon-only" icon={stopCircle} />
                </IonButton>
              </>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-message">
              <IonText color="danger">
                <p>{error}</p>
              </IonText>
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  )
}

export default Player
