import { describe, expect, it } from 'vitest'
import { URL_DO_JOGO_FOGO, urlDoJogoFogoPara } from './FogoOverlay'

describe('urlDoJogoFogoPara', () => {
  it('página do app instalado (Visão de jogador) busca no protocolo minigame, não no resolver do Tauri', () => {
    expect(urlDoJogoFogoPara({ protocol: 'http:', hostname: 'tauri.localhost' })).toBe('http://minigame.localhost/fogo/index.html')
    expect(urlDoJogoFogoPara({ protocol: 'https:', hostname: 'tauri.localhost' })).toBe('https://minigame.localhost/fogo/index.html')
    expect(urlDoJogoFogoPara({ protocol: 'tauri:', hostname: 'localhost' })).toBe('minigame://localhost/fogo/index.html')
  })

  it('jogador servido pela sala (e o Vite) continua na própria origem', () => {
    expect(urlDoJogoFogoPara({ protocol: 'http:', hostname: '192.168.0.6' })).toBe(URL_DO_JOGO_FOGO)
    expect(urlDoJogoFogoPara({ protocol: 'http:', hostname: 'localhost' })).toBe(URL_DO_JOGO_FOGO)
  })
})
