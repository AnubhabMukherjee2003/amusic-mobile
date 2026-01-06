import React, { useState, useEffect } from 'react'
import { IonButton, IonCard, IonCardContent, IonText } from '@ionic/react'

interface DebugConsoleProps {
  show: boolean
  onToggle: () => void
}

const DebugConsole: React.FC<DebugConsoleProps> = ({ show, onToggle }) => {
  const [logs, setLogs] = useState<string[]>([])

  useEffect(() => {
    if (!show) return

    // Capture console logs
    const originalLog = console.log
    const originalError = console.error
    const originalWarn = console.warn

    const addLog = (type: string, ...args: any[]) => {
      const timestamp = new Date().toLocaleTimeString()
      const message = `[${timestamp}] ${type}: ${args.join(' ')}`
      setLogs(prev => [...prev.slice(-20), message]) // Keep last 20 logs
    }

    console.log = (...args) => {
      originalLog(...args)
      addLog('LOG', ...args)
    }

    console.error = (...args) => {
      originalError(...args)
      addLog('ERROR', ...args)
    }

    console.warn = (...args) => {
      originalWarn(...args)
      addLog('WARN', ...args)
    }

    return () => {
      console.log = originalLog
      console.error = originalError
      console.warn = originalWarn
    }
  }, [show])

  if (!show) {
    return (
      <IonButton 
        fill="clear" 
        size="small" 
        onClick={onToggle}
        style={{ position: 'fixed', top: '10px', right: '10px', zIndex: 9999 }}
      >
        Debug
      </IonButton>
    )
  }

  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      left: '10px', 
      right: '10px', 
      zIndex: 9999,
      maxHeight: '300px'
    }}>
      <IonCard>
        <IonCardContent>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <IonText><strong>Debug Console</strong></IonText>
            <IonButton fill="clear" size="small" onClick={onToggle}>Close</IonButton>
          </div>
          <div style={{ 
            maxHeight: '200px', 
            overflow: 'auto', 
            fontSize: '12px',
            fontFamily: 'monospace',
            backgroundColor: '#000',
            color: '#0f0',
            padding: '8px',
            marginTop: '8px'
          }}>
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
          <IonButton 
            fill="clear" 
            size="small" 
            onClick={() => setLogs([])}
            style={{ marginTop: '8px' }}
          >
            Clear
          </IonButton>
        </IonCardContent>
      </IonCard>
    </div>
  )
}

export default DebugConsole