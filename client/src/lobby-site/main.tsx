import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { themeCss } from '../theme'
import { iniciarSite } from './dados/lobbyStore'
import { SiteContexto } from './telas/contexto'
import { Site } from './telas/Site'
import './telas/lobby.css'

// Entrada do site do Lobby (`client/lobby-site/index.html`, build em
// `vite.lobby.config.ts`). Roda no navegador do jogador, fora do Tauri: nada
// deste arquivo nem do que ele importa pode puxar `@tauri-apps/*`, `pixi.js` ou
// `three` (a guarda do build recusa). A camada de dados é a da S2 (`dados/`);
// as telas são as da S3 (`telas/`, docs/planos/lobby-jogadores-2026-11-05.md).

// As mesmas custom properties `--lb-*` do app (ver o main.tsx da raiz), antes do primeiro render.
const estiloDoTema = document.createElement('style')
estiloDoTema.id = 'lb-theme'
estiloDoTema.textContent = themeCss()
document.head.prepend(estiloDoTema)

const site = iniciarSite(window)

const root = document.getElementById('root')
if (!root) throw new Error('lobby-site/index.html sem #root')
createRoot(root).render(
  <StrictMode>
    <SiteContexto.Provider value={site}>
      <Site />
    </SiteContexto.Provider>
  </StrictMode>,
)
