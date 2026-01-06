import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.amusic.app',
  appName: 'Amusic',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#1a1a2e'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a2e',
      showSpinner: false
    },
    BackgroundMode: {
      enabled: true,
      title: 'Amusic',
      text: 'Playing music in background',
      silent: false
    }
  }
};

export default config;
