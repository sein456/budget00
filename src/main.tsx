import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './styles/global.css'
import './styles/polish.css'
import './styles/fixes.css'
import './styles/refinement.css'
import './styles/features.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('React kök elementi bulunamadı')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
