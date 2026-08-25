import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { themeCss } from './theme'
import './main.css'

// Os tokens de `theme.ts` viram custom properties aqui, antes do primeiro
// render, para `main.css` ter os `var(--lb-*)` já resolvidos no primeiro paint.
const themeStyle = document.createElement('style')
themeStyle.id = 'lb-theme'
themeStyle.textContent = themeCss()
document.head.prepend(themeStyle)

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
