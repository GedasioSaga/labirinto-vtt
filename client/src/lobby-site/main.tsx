import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Entrada do site do Lobby (`client/lobby-site/index.html`, build em
// `vite.lobby.config.ts`). Roda no navegador do jogador, fora do Tauri: nada
// deste arquivo nem do que ele importa pode puxar `@tauri-apps/*`, `pixi.js` ou
// `three` (a guarda do build recusa). Por enquanto só o esqueleto da fatia S1;
// dados e rotas chegam na S2 e as telas na S3 (docs/planos/lobby-jogadores-2026-11-05.md).

function Esqueleto() {
  return (
    <main className="lobby-esqueleto">
      <h1 className="lobby-esqueleto__titulo">Lobby do Labirinto</h1>
      <p className="lobby-esqueleto__texto">As fichas da campanha vão aparecer aqui.</p>
    </main>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('lobby-site/index.html sem #root')
createRoot(root).render(
  <StrictMode>
    <Esqueleto />
  </StrictMode>,
)
