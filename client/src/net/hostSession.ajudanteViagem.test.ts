import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostSession, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * AJUDANTE CONTRATADO e o pino de viagem: quem atravessa é o PERSONAGEM do
 * jogador, mesmo quando o ajudante emprestado está mais perto do pino. Se o
 * ajudante fosse no lugar dele, o personagem ficaria para trás e a cena do
 * jogador viraria a de destino — sem olhos lá quando o acordo é "sem visão".
 */

const CODE = 'AJVIA1'
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'
const MINUTO_PRAZO = 30

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino']): Pin {
  return { id, x, y, kind: 'viagem', description: id, image: null, destino }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

/** Herói longe do alçapão, Tiziu (o ajudante) quase em cima dele. */
function mundo(): HostWorld {
  const salao: MapData = {
    ...createEmptyMap('mapa-salao', 'Salão', 40, 10, 50),
    tokens: [token('heroi', 200, 200), token('tiziu', 380, 200)],
    pins: [viagem('alcapao', 400, 200, { sceneId: CRIPTA, pinId: 'fundo' })],
  }
  const cripta: MapData = {
    ...createEmptyMap('mapa-cripta', 'Cripta Rubra', 40, 10, 50),
    tokens: [],
    pins: [viagem('fundo', 1000, 250, { sceneId: SALAO, pinId: 'alcapao' })],
  }
  return { open: { sceneId: SALAO, name: 'Salão', map: salao }, background: [{ sceneId: CRIPTA, name: 'Cripta Rubra', map: cripta }] }
}

function mesa(w: HostWorld): { s: HostSession; ana: string } {
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: 700,
    now: () => 1_000_000,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const ana = welcomeOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w).outbound).playerId
  return { s, ana }
}

/** Pede o alçapão e o mestre deixa ir: a transferência que o integrador aplicaria. */
function atravessa(s: HostSession, w: HostWorld): HostResult {
  s.broadcast(w)
  const pedido = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'alcapao' }, w)
  const requestId = pedido.travelRequest?.requestId
  if (requestId === undefined) throw new Error('esperava o pedido chegar ao mestre')
  return s.approveTravel(requestId, w)
}

describe('ajudante contratado: quem atravessa o pino', () => {
  it('o herói atravessa, não o ajudante sem olhos que está mais perto do pino', () => {
    const w = mundo()
    const { s, ana } = mesa(w)
    s.assignToken(ana, 'heroi')
    s.lendToken(ana, 'tiziu', { tarefa: 'vigiar a porta', minutos: MINUTO_PRAZO, visao: false })
    const r = atravessa(s, w)
    expect(r.applyTransfer?.tokenId).toBe('heroi')
    expect(r.applyTransfer?.toSceneId).toBe(CRIPTA)
  })

  it('o herói atravessa também quando o ajudante tem olhos', () => {
    const w = mundo()
    const { s, ana } = mesa(w)
    s.assignToken(ana, 'heroi')
    s.lendToken(ana, 'tiziu', { tarefa: 'vigiar a porta', minutos: MINUTO_PRAZO, visao: true })
    expect(atravessa(s, w).applyTransfer?.tokenId).toBe('heroi')
  })

  it('só com o ajudante na mão, é ele que atravessa (a ficha segue o jogador)', () => {
    const w = mundo()
    const { s, ana } = mesa(w)
    s.lendToken(ana, 'tiziu', { tarefa: 'descer sozinho', minutos: MINUTO_PRAZO, visao: true })
    const r = atravessa(s, w)
    expect(r.applyTransfer?.tokenId).toBe('tiziu')
    expect(r.applyTransfer?.toSceneId).toBe(CRIPTA)
  })

  it('controle: sem empréstimo, entre duas fichas próprias atravessa a mais perto do pino', () => {
    const w = mundo()
    const { s, ana } = mesa(w)
    s.assignToken(ana, 'heroi')
    s.assignToken(ana, 'tiziu')
    expect(atravessa(s, w).applyTransfer?.tokenId).toBe('tiziu')
  })
})

/**
 * O "Levar para…" e o "Juntar o grupo" do mestre (`sendPlayer`) seguem a mesma
 * regra do pino: vai o personagem, não o ajudante — mesmo quando o ajudante foi
 * emprestado ANTES do personagem ser dado (e está primeiro na lista de posse).
 */
describe('ajudante contratado: quem o mestre leva para outra cena', () => {
  const PONTO_DO_GRUPO = { x: 600, y: 250 }

  it('"Levar para…": vai o herói, mesmo com o ajudante emprestado antes dele', () => {
    const w = mundo()
    const { s, ana } = mesa(w)
    s.lendToken(ana, 'tiziu', { tarefa: 'vigiar a porta', minutos: MINUTO_PRAZO, visao: false })
    s.assignToken(ana, 'heroi')
    const r = s.sendPlayer(ana, CRIPTA, null, w)
    expect(r.applyTransfer?.tokenId).toBe('heroi')
    expect(r.applyTransfer?.toSceneId).toBe(CRIPTA)
  })

  it('"Juntar o grupo": vai o herói ao ponto do grupo, não o ajudante', () => {
    const w = mundo()
    const { s, ana } = mesa(w)
    s.lendToken(ana, 'tiziu', { tarefa: 'vigiar a porta', minutos: MINUTO_PRAZO, visao: true })
    s.assignToken(ana, 'heroi')
    const r = s.sendPlayer(ana, CRIPTA, null, w, PONTO_DO_GRUPO)
    expect(r.applyTransfer?.tokenId).toBe('heroi')
    expect(r.applyTransfer?.x).toBe(PONTO_DO_GRUPO.x)
    expect(r.applyTransfer?.y).toBe(PONTO_DO_GRUPO.y)
  })

  it('só com o ajudante na mão, é ele que o mestre leva', () => {
    const w = mundo()
    const { s, ana } = mesa(w)
    s.lendToken(ana, 'tiziu', { tarefa: 'descer sozinho', minutos: MINUTO_PRAZO, visao: true })
    const r = s.sendPlayer(ana, CRIPTA, null, w)
    expect(r.applyTransfer?.tokenId).toBe('tiziu')
    expect(r.applyTransfer?.toSceneId).toBe(CRIPTA)
  })

  it('controle: sem empréstimo, vai a primeira ficha que o mestre deu', () => {
    const w = mundo()
    const { s, ana } = mesa(w)
    s.assignToken(ana, 'tiziu')
    s.assignToken(ana, 'heroi')
    expect(s.sendPlayer(ana, CRIPTA, null, w).applyTransfer?.tokenId).toBe('tiziu')
  })
})
