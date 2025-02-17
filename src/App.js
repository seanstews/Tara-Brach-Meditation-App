import React, { useState, useEffect } from 'react';
import SpotifyWebApi from 'spotify-web-api-js';
import styles from './App.module.css';

const spotify = new SpotifyWebApi();

function App() {
  const [token, setToken] = useState(null);
  const [meditations, setMeditations] = useState([]);
  const [selectedDuration, setSelectedDuration] = useState(15);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFoundMeditation, setHasFoundMeditation] = useState(false);

  const loginToSpotify = () => {
    const redirectUri = window.location.href.includes('github.io') 
      ? 'https://seanstews.github.io/Tara-Brach-Meditation-App'
      : 'http://localhost:3000';
    
    const scopes = [
      'streaming',
      'user-read-email',
      'user-read-private',
      'user-library-read',
      'user-read-playback-state',
      'user-modify-playback-state',
      'playlist-read-private',
      'playlist-read-collaborative'
    ].join('%20');
    
    window.location.href = `https://accounts.spotify.com/authorize?client_id=${process.env.REACT_APP_SPOTIFY_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scopes}&response_type=token&show_dialog=true`;
  };

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const token = hash.substring(1).split("&")[0].split("=")[1];
      setToken(token);
      spotify.setAccessToken(token);
      window.location.hash = "";
    }

    const validateToken = async () => {
      const isValid = await checkTokenValidity();
      if (!isValid && token) {
        setToken(null);
      }
    };

    validateToken();

    const interval = setInterval(validateToken, 1800000);

    return () => clearInterval(interval);
  }, [token]);

  const checkTokenValidity = async () => {
    if (!token) return false;
    
    try {
      await spotify.getMe();
      return true;
    } catch (error) {
      console.log("Token expired or invalid");
      setToken(null);
      return false;
    }
  };

  const findMeditation = async () => {
    try {
      const isValid = await checkTokenValidity();
      if (!isValid) {
        setError("Your session has expired. Please log in again.");
        return;
      }

      setIsLoading(true);
      setError(null);
      
      console.log("Starting meditation search...");
      const initialSearch = await spotify.search('Tara Brach Meditation:', ['episode'], { limit: 1 });
      const totalEpisodes = initialSearch.episodes.total;
      console.log(`Found ${totalEpisodes} total episodes`);
      
      if (totalEpisodes === 0) {
        setError("Unable to access Spotify podcast content. Please make sure you have a valid Spotify account with podcast access.");
        setIsLoading(false);
        return;
      }

      const maxOffset = Math.max(0, totalEpisodes - 50);
      const randomOffset = Math.floor(Math.random() * maxOffset);
      
      console.log(`Searching from offset: ${randomOffset}`);
      
      const result = await spotify.search(
        'Tara Brach Meditation:', 
        ['episode'], 
        { 
          limit: 50,
          offset: randomOffset 
        }
      );
      
      const allMeditations = result.episodes.items;
      console.log(`Retrieved ${allMeditations.length} episodes in this batch`);
      
      const meditationEpisodes = allMeditations.filter(episode => 
        episode.name.startsWith('Meditation:')
      );

      console.log(`Found ${meditationEpisodes.length} meditation episodes in this batch`);
      
      const targetDuration = selectedDuration * 60000;
      const validMeditations = meditationEpisodes.filter(med => {
        const durationDiff = Math.abs(med.duration_ms - targetDuration);
        const isValid = durationDiff <= 120000;
        
        if (isValid) {
          console.log(`Found matching meditation: ${med.name} - Duration: ${Math.floor(med.duration_ms/60000)} minutes`);
        }
        
        return isValid;
      });
      
      console.log(`Found ${validMeditations.length} meditations matching duration ${selectedDuration} minutes`);
      
      if (validMeditations.length > 0) {
        const random = Math.floor(Math.random() * validMeditations.length);
        setCurrentTrack(validMeditations[random]);
        setHasFoundMeditation(true);
      } else {
        setError(`No meditations found close to ${selectedDuration} minutes. This might be due to Spotify access restrictions. Please try again or try a different duration.`);
        setCurrentTrack(null);
      }
      
    } catch (err) {
      console.error('Search error:', err);
      setError(`Error finding meditation: ${err.message}. Please try logging in again.`);
      if (err.status === 401 || err.status === 403) {
        setToken(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container} style={{
      background: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), 
                  url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80')`
    }}>
      <div className={styles.contentWrapper}>
        <h1 className={styles.title}>Tara Brach Meditation Player</h1>
        <p className={styles.subtitle}>
          {!token 
            ? "Welcome! Click the button below to login to your Spotify account."
            : "Select how long you have to meditate, then click the button to start your meditation."
          }
        </p>
        
        {!token ? (
          <button onClick={loginToSpotify}>Login to Spotify</button>
        ) : (
          <>
            <input 
              type="range" 
              min="5" 
              max="30" 
              value={selectedDuration}
              onChange={(e) => setSelectedDuration(e.target.value)}
            />
            <p>Duration: {selectedDuration} minutes</p>
            <button onClick={findMeditation} disabled={isLoading}>
              {isLoading 
                ? 'Searching...' 
                : hasFoundMeditation 
                  ? 'Find Another Meditation'
                  : 'Start Meditation'
              }
            </button>
            
            {error && (
              <p style={{ color: 'red' }}>{error}</p>
            )}
            
            {currentTrack && (
              <div style={{ marginTop: '20px' }}>
                <iframe
                  src={`https://open.spotify.com/embed/episode/${currentTrack.id}`}
                  width="300"
                  height="380"
                  frameBorder="0"
                  allowtransparency="true"
                  allow="encrypted-media"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
