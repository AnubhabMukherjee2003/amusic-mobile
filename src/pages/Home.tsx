import React, { useState } from 'react'
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonSearchbar,
  IonList,
  IonItem,
  IonThumbnail,
  IonLabel,
  IonSpinner,
  IonText
} from '@ionic/react'
import { useHistory } from 'react-router-dom'
import { searchSongs } from '../services/api.service'
import { Song } from '../types/music.types'
import './Home.css'

const Home: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [songs, setSongs] = useState<Song[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const history = useHistory()

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSongs([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const results = await searchSongs(query)
      setSongs(results)
    } catch (err) {
      console.error('Search failed:', err)
      setError('Search failed. Please try again.')
      setSongs([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSongClick = (song: Song) => {
    history.push(`/player/${song.videoId}`, { song })
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="dark">
          <IonTitle>🎵 Music Search</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen color="dark">
        <IonHeader collapse="condense">
          <IonToolbar color="dark">
            <IonTitle size="large">Search</IonTitle>
          </IonToolbar>
        </IonHeader>

        <div className="search-container">
          <IonSearchbar
            value={searchQuery}
            onIonInput={(e) => setSearchQuery(e.detail.value!)}
            onIonChange={(e) => handleSearch(e.detail.value!)}
            placeholder="Search for songs..."
            debounce={500}
            animated
            color="dark"
          />
        </div>

        {isLoading && (
          <div className="loading-container">
            <IonSpinner name="crescent" />
            <IonText>
              <p>Searching...</p>
            </IonText>
          </div>
        )}

        {error && (
          <div className="error-container">
            <IonText color="danger">
              <p>{error}</p>
            </IonText>
          </div>
        )}

        {!isLoading && songs.length > 0 && (
          <IonList>
            {songs.map((song) => (
              <IonItem
                key={song.videoId}
                button
                onClick={() => handleSongClick(song)}
                detail={true}
              >
                <IonThumbnail slot="start">
                  <img
                    src={song.thumbnails[0]?.url || '/assets/placeholder.png'}
                    alt={song.name}
                  />
                </IonThumbnail>
                <IonLabel>
                  <h2>{song.name}</h2>
                  <p>{song.artist}</p>
                  {song.duration && <p className="duration">{song.duration}</p>}
                </IonLabel>
              </IonItem>
            ))}
          </IonList>
        )}

        {!isLoading && !error && searchQuery && songs.length === 0 && (
          <div className="empty-container">
            <IonText color="medium">
              <p>No results found</p>
            </IonText>
          </div>
        )}

        {!searchQuery && !isLoading && (
          <div className="empty-container">
            <IonText color="medium">
              <p>Search for your favorite songs</p>
            </IonText>
          </div>
        )}
      </IonContent>
    </IonPage>
  )
}

export default Home
