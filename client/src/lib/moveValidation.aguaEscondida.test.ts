/**
 * ÁGUA QUE BARRA e a REGRA DE OURO (FX-AGUA2-062, bloqueio 3 da auditoria da
 * 0.5.62). Com "Barra a passagem", a ficha do jogador não entra na água; mas a
 * água que o recorte nunca entrega a ele (camada Chão escondida dos jogadores,
 * zona oculta, a que mora na sala secreta) não pode segurar o passo: a recusa
 * "A água barra a passagem" contaria que ela existe. É o que os objetos fazem
 * (`objetoEscondidoDosJogadores`). A que ele só não está vendo agora (névoa,
 * escuro, teto fechado) barra igual, com a recusa da parede que ele não vê.
 *
 * Geometria (px de mundo, mapa 1000 x 1000, grade 40, cena livre, sem Chão e sem parede):
 * a ficha em (300, 460); o lago de 440 a 560 em x e de 400 a 520 em y, no
 * traço reto até (700, 460).
 */
import { describe, expect, it } from 'vitest'
import type { Agua, ConcealZone, MapData, Region, RegionPoint, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { validateTokenMove, type TokenMoveOptions } from './moveValidation'

const GRADE = 40
const POSSE = { p1: ['heroi'] }
const HEROI: Token = { id: 'heroi', characterId: null, name: 'heroi', x: 300, y: 460, size: 1, image: null }
const DO_OUTRO_LADO = { x: 700, y: 460 }
const PASSA = { ok: true, x: DO_OUTRO_LADO.x, y: DO_OUTRO_LADO.y }
const AGUA = { ok: false, reason: 'agua' }
const PAREDE = { ok: false, reason: 'wall' }

const rect = (x0: number, y0: number, x1: number, y1: number): RegionPoint[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]
const lago = (extra: Partial<Agua> = {}): Agua => ({ id: 'lago', tipo: 'lago', pontos: rect(440, 400, 560, 520), cor: '#2f7f8f', barra: true, ...extra })
const zona = (pontos: RegionPoint[], revealed = false): ConcealZone => ({ id: 'z', points: pontos, name: 'Z', revealed })
const salaSecreta = (pontos: RegionPoint[]): Region => ({
  id: 'S',
  points: pontos,
  tag: 'region',
  fillColor: '#4d2f05',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: 'Cofre' },
  secret: true,
})

function cena(aguas: Agua[], extra: Partial<MapData> = {}): MapData {
  // Cena livre: a água conta como Chão, e com o fora do chão bloqueado a ficha seria levada até a margem.
  return { ...createEmptyMap('m', 'M', 25, 25, GRADE), offFloor: 'free', tokens: [HEROI], aguas, ...extra }
}

function arrastar(map: MapData, opcoes: TokenMoveOptions = {}): ReturnType<typeof validateTokenMove> {
  return validateTokenMove(map, { playerId: 'p1', tokenId: 'heroi', x: DO_OUTRO_LADO.x, y: DO_OUTRO_LADO.y }, POSSE, opcoes)
}

describe('água que barra e o que o jogador não recebe', () => {
  it('a escondida dos jogadores não barra nem avisa; a que ele recebe barra com o aviso', () => {
    expect(arrastar(cena([lago()])), 'controle: o lago à vista barra').toEqual(AGUA)
    expect(arrastar(cena([lago({ barra: undefined })])), 'sem a chave, atravessa').toEqual(PASSA)
    expect(arrastar(cena([lago({ secret: true })])), 'secreta').toEqual(PASSA)
    expect(arrastar(cena([lago()], { versaoDasCamadas: 2, ocultasDoJogador: ['chao'] })), 'camada Chão escondida').toEqual(PASSA)
    expect(arrastar(cena([lago()], { versaoDasCamadas: 2, opacidadeDasCamadas: { chao: 0 } })), 'camada Chão apagada a 0%').toEqual(PASSA)
    expect(arrastar(cena([lago()], { concealZones: [zona(rect(420, 380, 580, 540))] })), 'em zona oculta').toEqual(PASSA)
    expect(arrastar(cena([lago()], { concealZones: [zona(rect(420, 380, 580, 540), true)] })), 'zona revelada').toEqual(AGUA)
    expect(arrastar(cena([lago()], { regions: [salaSecreta(rect(420, 380, 580, 540))] })), 'mora na sala secreta').toEqual(PASSA)
    // A que só PASSA pela sala secreta sai inteira para o jogador (a sala fechada é chão aberto): barra.
    expect(arrastar(cena([lago()], { regions: [salaSecreta(rect(530, 380, 600, 540))] })), 'passa pela sala secreta').toEqual(AGUA)
    // O veículo dirigido pelo jogador tem o mesmo filtro (`objetosBarram`).
    const veiculo: TokenMoveOptions = { isHost: true, objetosBarram: true }
    expect(arrastar(cena([lago()]), veiculo)).toEqual(AGUA)
    expect(arrastar(cena([lago()], { concealZones: [zona(rect(420, 380, 580, 540))] }), veiculo)).toEqual(PASSA)
  })

  it('a que ele não está vendo agora (névoa, escuro, teto fechado) barra igual, com a recusa da parede', () => {
    const naoVe: TokenMoveOptions = { aguaAVista: () => false }
    expect(arrastar(cena([lago()]), naoVe)).toEqual(PAREDE)
    expect(arrastar(cena([lago()]), { aguaAVista: (a) => a.id === 'lago' })).toEqual(AGUA)
    // Duas no mesmo traço, uma à vista: quem responde é a que ele vê.
    const duas = cena([lago({ id: 'no-escuro' }), lago({ id: 'lago', pontos: rect(600, 400, 660, 520) })])
    expect(arrastar(duas, { aguaAVista: (a) => a.id === 'lago' })).toEqual(AGUA)
    expect(arrastar(duas, naoVe)).toEqual(PAREDE)
  })
})
