import { describe, expect, it } from 'vitest'
import type { EnderecoDaMesa } from './fonte'
import { enderecoDeEntrada } from './rotas'

/**
 * "Entrar na mesa agora" (B6): a URL que a aba do jogador abre leva o convite
 * SÓ no fragmento, que o navegador não manda ao servidor nem ao Referer.
 */

const BILHETE = 'v1.eyJzIjoiSzdRMk1YIiwiYyI6ImNvbnRhX2JpYSJ9.c2lnbmF0dXJhLWRlLXRlc3Rl'
const TUNEL: EnderecoDaMesa = { tipo: 'tunel', url: 'https://mare-alta-sem-farol.trycloudflare.com/player' }
const LAN: EnderecoDaMesa = { tipo: 'lan', url: 'http://192.168.0.12:7777/player' }

describe('enderecoDeEntrada', () => {
  it('leva o convite só depois do # e nunca na query', () => {
    for (const endereco of [TUNEL, LAN]) {
      const url = enderecoDeEntrada(endereco, BILHETE)
      expect(url).toBe(`${endereco.url}#entrar=${BILHETE}`)
      if (url === null) continue
      const lida = new URL(url)
      expect(lida.search).toBe('')
      expect(lida.hash).toBe(`#entrar=${BILHETE}`)
      expect(url.indexOf(BILHETE)).toBeGreaterThan(url.indexOf('#'))
      expect(url.slice(0, url.indexOf('#'))).not.toContain('?')
    }
  })

  it('não monta URL que levaria o convite a outro lugar ou para a query', () => {
    const tortos: EnderecoDaMesa[] = [
      { tipo: 'tunel', url: 'https://mare-alta.trycloudflare.com/player?entrar=x' },
      { tipo: 'tunel', url: 'https://mare-alta.trycloudflare.com/player#x' },
      { tipo: 'tunel', url: 'https://mare-alta.example.com/player' },
      { tipo: 'lan', url: 'http://8.8.8.8:7777/player' },
      { tipo: 'lan', url: 'http://192.168.0.12:7777/player/' },
      { tipo: 'tunel', url: LAN.url },
    ]
    for (const endereco of tortos) expect(enderecoDeEntrada(endereco, BILHETE)).toBeNull()
    for (const bilhete of ['', 'v1.a.b?x=1', 'v1.a.b&c', 'v1.a.b#c', 'v2.a.b', 'v1.a']) expect(enderecoDeEntrada(TUNEL, bilhete)).toBeNull()
  })
})
