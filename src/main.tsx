import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import './styles/theme.css'

// Prevent Electron from navigating away when a file is dropped outside a
// designated drop zone. Zone-specific React onDrop handlers still run their
// own preventDefault + logic; this is only a fallback for the rest of the window.
window.addEventListener('dragover', e => e.preventDefault())
window.addEventListener('drop', e => e.preventDefault())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
