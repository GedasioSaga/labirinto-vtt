/**
 * COMPARTILHAR COM O MESTRE (B6, pedido de 28/10/2026): a medida do jogador
 * chega só à tela do mestre (`medidaDoJogador`, nunca no `outbound` de algum
 * jogador), e a entrada hostil morre em silêncio — no parser ou no host.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token, Wall } from '../types/map'
import { createHostSession, MEDIDA_JANELA_MS, MEDIDA_MAX_POR_JANELA, type HostResult, type HostWorld } from './hostSession'
import { parsePlayerMessage } from './protocol'
import type { Casa } from '../lib/batalha/blocos'
import { somarNaTrilha } from '../lib/batalha/caminhoAndado'

const CODE = 'MEDE06'
const GRID = 50

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null }
}

function mundo(): HostWorld {
  const map: MapData = { ...createEmptyMap('mapa-medida', 'Medida', 20, 12, GRID), tokens: [ficha('lia', 125, 125), ficha('bruno', 325, 125)] }
  return { open: { sceneId: 'cena', name: 'Cena', map }, background: [] }
}

function playerIdOf(r: HostResult): string {
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function mesa(batalha: boolean) {
  let agora = 1_000_000
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 400, now: () => agora, randomId: () => `id-${(n += 1)}`, getBatalha: () => batalha })
  const w = mundo()
  const lia = playerIdOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Lia' }, w))
  const bruno = playerIdOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bruno' }, w))
  s.assignToken(lia, 'lia')
  s.assignToken(bruno, 'bruno')
  s.broadcast(w)
  /** A mensagem passa pelo parser do fio, como no socket; `null` = o parser já recusou. */
  const medir = (bruta: unknown): HostResult | null => {
    const msg = parsePlayerMessage(JSON.stringify(bruta))
    return msg === null ? null : s.handleMessage('c1', msg, w)
  }
  return { s, lia, medir, avancar: (ms: number) => (agora += ms) }
}

const CONE = { ferramenta: 'cone', origem: { col: 2, row: 2 }, direcao: 'sudeste', comprimento: 4 }

describe('compartilhar com o mestre', () => {
  it('chega só ao mestre, e apagar ou cair tira a marca de lá', () => {
    const { s, lia, medir } = mesa(true)
    const r = medir({ type: 'medida.compartilhar', medida: CONE })
    expect(r?.outbound).toEqual([])
    expect(r?.medidaDoJogador).toMatchObject({ playerId: lia, name: 'Lia', mapId: 'mapa-medida', emBatalha: true, medida: CONE })
    expect(medir({ type: 'medida.compartilhar', medida: null })?.medidaDoJogador).toEqual({ playerId: lia, apagar: true })
    // Nada mais a apagar: não manda nada ao mestre.
    expect(medir({ type: 'medida.compartilhar', medida: null })?.medidaDoJogador).toBeUndefined()
    medir({ type: 'medida.compartilhar', medida: CONE })
    const queda = s.disconnect('c1')
    expect(queda.medidaDoJogador).toEqual({ playerId: lia, apagar: true })
  })

  it('entrada inválida é descartada em silêncio, e o excesso por segundo também', () => {
    const { medir, avancar } = mesa(true)
    const tortas: unknown[] = [
      { ...CONE, direcao: 'cima' },
      { ...CONE, comprimento: 999 },
      { ferramenta: 'circulo', centro: { col: 2, row: 2 }, raio: 2.5 },
      { ferramenta: '<img src=x onerror=alert(1)>', de: { x: 1, y: 1 }, ate: { x: 2, y: 2 } },
      { ferramenta: 'regua', de: { x: 1, y: 1 }, ate: { x: '9', y: 2 } },
      { ferramenta: 'visao', de: { col: 1, row: 1 }, para: { col: 3, row: 1 }, ve: 'sim' },
    ]
    for (const medida of tortas) expect(medir({ type: 'medida.compartilhar', medida })).toBeNull()
    const foraDoMapa: unknown[] = [
      { ...CONE, origem: { col: 50, row: 2 } },
      { ferramenta: 'regua', de: { x: -10, y: 5 }, ate: { x: 100, y: 5 } },
      { ferramenta: 'visao', de: { col: 1, row: 1 }, para: { col: 1, row: 12 } },
    ]
    for (const medida of foraDoMapa) {
      const r = medir({ type: 'medida.compartilhar', medida })
      expect(r?.outbound).toEqual([])
      expect(r?.medidaDoJogador).toBeUndefined()
    }
    // Texto do jogador não viaja: o campo a mais some no parser, o mestre monta o rótulo dos números.
    const comTexto = medir({ type: 'medida.compartilhar', medida: { ferramenta: 'regua', de: { x: 10, y: 10 }, ate: { x: 210, y: 10 }, rotulo: '<b>oi</b>' } })
    expect(JSON.stringify(comTexto?.medidaDoJogador)).not.toContain('<b>')

    avancar(MEDIDA_JANELA_MS)
    let aceitas = 0
    for (let k = 0; k < MEDIDA_MAX_POR_JANELA + 5; k += 1) {
      if (medir({ type: 'medida.compartilhar', medida: { ...CONE, comprimento: 1 + (k % 4) } })?.medidaDoJogador !== undefined) aceitas += 1
    }
    expect(aceitas).toBe(MEDIDA_MAX_POR_JANELA)
    avancar(MEDIDA_JANELA_MS)
    expect(medir({ type: 'medida.compartilhar', medida: CONE })?.medidaDoJogador).toBeDefined()
  })

  it('esbarrar na parede invisível REVELA para ele e avisa o mestre com o nome dele (regra de 27/10)', () => {
    const oculta: Wall = { id: 'oculta', x1: 900, y1: 0, x2: 900, y2: 600, blocksLight: true, blocksMove: true, door: null, hidden: true }
    const map: MapData = { ...createEmptyMap('mapa-medida', 'Medida', 20, 12, GRID), tokens: [ficha('lia', 125, 125)], walls: [oculta] }
    const w: HostWorld = { open: { sceneId: 'cena', name: 'Cena', map }, background: [] }
    const avisos: string[] = []
    let n = 0
    const s = createHostSession({
      code: CODE,
      visionRadius: 200,
      now: () => 1_000_000,
      randomId: () => `id-${(n += 1)}`,
      getBatalha: () => true,
      onEsbarrouNaParede: (nome, invisivel) => avisos.push(`${nome}:${invisivel ? 'invisível' : 'névoa'}`),
    })
    const lia = playerIdOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Lia' }, w))
    s.assignToken(lia, 'lia')
    s.broadcast(w)
    // Antes da parede: nada a avisar.
    const curto = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'lia', x: 325, y: 125 }, w)
    expect(curto.outbound[0]?.msg).toMatchObject({ type: 'token.move.accepted', blocos: 4 })
    expect(avisos).toEqual([])
    // Através dela (fora da visão de 200 px na hora do recorte): a ficha para diante da parede e o mestre fica sabendo.
    const longe = s.handleMessage('c1', { type: 'token.move', reqId: 'r2', tokenId: 'lia', x: 975, y: 125 }, w)
    expect(longe.outbound[0]?.msg).toMatchObject({ type: 'token.move.accepted', x: 875, y: 125 })
    expect(avisos).toEqual(['Lia:invisível'])
    expect(JSON.stringify(longe.outbound)).not.toContain('esbarrou')
    // REVELA: diante dela, o recorte de Lia passa a trazer a parede invisível (sem o esbarrão, nunca traria).
    const diante: HostWorld = { open: { sceneId: 'cena', name: 'Cena', map: { ...map, tokens: [ficha('lia', 875, 125)] } }, background: [] }
    const tela = s.broadcast(diante).outbound.find((o) => o.clientId === 'c1' && o.msg.type === 'snapshot')?.msg
    expect(tela?.type === 'snapshot' ? tela.map.walls.map((p) => p.id) : null).toEqual(['oculta'])
    // A parede já é dela: andar de novo contra ela não avisa outra vez.
    s.handleMessage('c1', { type: 'token.move', reqId: 'r3', tokenId: 'lia', x: 975, y: 125 }, diante)
    expect(avisos).toEqual(['Lia:invisível'])
  })

  it('caminho andado: inteiro e com a conta para quem andou; ao colega, só as casas que ele vê; zerar chega aos dois', () => {
    const noMestre: { caminhos: Record<string, number>; trilhas: Record<string, readonly Casa[]>; zerados: number; rev: number } = { caminhos: {}, trilhas: {}, zerados: 0, rev: 0 }
    let n = 0
    const s = createHostSession({
      code: CODE,
      visionRadius: 200,
      now: () => 1_000_000,
      randomId: () => `id-${(n += 1)}`,
      getBatalha: () => true,
      onBatalhaAndou: (_cena, tokenId, blocos, casas) => {
        noMestre.caminhos = { ...noMestre.caminhos, [tokenId]: (noMestre.caminhos[tokenId] ?? 0) + blocos }
        noMestre.trilhas = { ...noMestre.trilhas, [tokenId]: somarNaTrilha(noMestre.trilhas[tokenId] ?? [], casas) }
        noMestre.rev += 1
      },
      getCaminhosDaBatalha: () => noMestre,
    })
    const base = createEmptyMap('mapa-medida', 'Medida', 20, 12, GRID)
    const antes: HostWorld = { open: { sceneId: 'cena', name: 'Cena', map: { ...base, tokens: [ficha('lia', 125, 125), ficha('bruno', 325, 275)] } }, background: [] }
    const lia = playerIdOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Lia' }, antes))
    const bruno = playerIdOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bruno' }, antes))
    s.assignToken(lia, 'lia')
    s.assignToken(bruno, 'bruno')
    s.broadcast(antes)
    expect(s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'lia', x: 325, y: 125 }, antes).outbound[0]?.msg).toMatchObject({ blocos: 4 })
    const depois: HostWorld = { open: { sceneId: 'cena', name: 'Cena', map: { ...base, tokens: [ficha('lia', 325, 125), ficha('bruno', 325, 275)] } }, background: [] }
    const caminhosDe = (r: HostResult, clientId: string) => {
      const msg = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
      return msg?.type === 'snapshot' ? msg.caminhos : undefined
    }
    const r = s.broadcast(depois)
    const fila = (cols: number[]) => cols.map((col) => ({ col, row: 2 }))
    expect(caminhosDe(r, 'c1')).toEqual({ zerados: 0, fichas: [{ tokenId: 'lia', casas: fila([2, 3, 4, 5, 6]), blocos: 4 }] })
    // Bruno, de (6,5) com 200 px de visão, vê as casas 4 a 6 da fila 2; as outras ficam fora, e a conta é só de Lia.
    expect(caminhosDe(r, 'c2')).toEqual({ zerados: 0, fichas: [{ tokenId: 'lia', casas: fila([4, 5, 6]) }] })
    // "Zerar caminhos" (só o mestre): o recorte refaz para os dois, sem caminho e com o `zerados` novo.
    Object.assign(noMestre, { caminhos: {}, trilhas: {}, zerados: 1, rev: noMestre.rev + 1 })
    const zerado = s.broadcast(depois)
    expect(caminhosDe(zerado, 'c1')).toEqual({ zerados: 1, fichas: [] })
    expect(caminhosDe(zerado, 'c2')).toEqual({ zerados: 1, fichas: [] })
  })

  it('fora da batalha só a régua vale', () => {
    const { medir } = mesa(false)
    expect(medir({ type: 'medida.compartilhar', medida: CONE })?.medidaDoJogador).toBeUndefined()
    expect(medir({ type: 'medida.compartilhar', medida: { ferramenta: 'regua', de: { x: 0, y: 0 }, ate: { x: 150, y: 0 } } })?.medidaDoJogador).toMatchObject({ emBatalha: false })
  })
})
