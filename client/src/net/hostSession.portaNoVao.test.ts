/**
 * Porta não fecha em cima de quem está no vão. Antes, `handleDoorToggle`
 * invertia a porta sem olhar o vão: a porta fechava por cima da ficha, que
 * ficava presa DENTRO da parede. Agora, com uma ficha que o jogador VÊ no
 * vão, fechar é recusado com `blocked` (aviso curto na tela dele). Ficha que o
 * mestre esconde não conta: recusar por ela diria ao jogador que há alguém
 * ali. O resultado aceito leva quem abriu/fechou, para o aviso do mestre.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token, Wall } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const GRID = 40

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, door: Wall['door'] = null): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door }
}

const aberta = { open: true, locked: false, kind: 'normal' as const }

/** Parede vertical em x=500 partida por uma porta (y 180..220), como a ferramenta Porta faz. */
function mapaComPorta(tokens: Token[], door: NonNullable<Wall['door']> = aberta): MapData {
  return {
    ...createEmptyMap('m', 'Salao Norte', 1000, 1000, GRID),
    walls: [
      parede('acima', 500, 0, 500, 180),
      { ...parede('porta', 500, 180, 500, 220, door), blocksLight: false },
      parede('abaixo', 500, 220, 500, 1000),
    ],
    tokens,
  }
}

/** Ana joga com o 'heroi' (e Bia, se pedida, com o 'aliado'); snapshot já enviado. */
function mesa(source: MapData | HostWorld, comBia = false) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entrar = (clientId: string, name: string, tokenId: string): string => {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, source).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
    return welcome.playerId
  }
  const ana = entrar('c1', 'Ana', 'heroi')
  if (comBia) entrar('c2', 'Bia', 'aliado')
  s.broadcast(source)
  return { s, ana }
}

const fechar = (s: ReturnType<typeof mesa>['s'], source: MapData | HostWorld): HostResult =>
  s.handleMessage('c1', { type: 'door.toggle', wallId: 'porta' }, source)

const bloqueada = [{ clientId: 'c1', msg: { type: 'door.toggle.rejected', wallId: 'porta', reason: 'blocked' } }]

describe('porta não fecha em cima de quem está no vão', () => {
  it('ficha de outro jogador parada no vão: fechar é recusado com "blocked" e a porta fica aberta', () => {
    const map = mapaComPorta([ficha('heroi', 460, 200), ficha('aliado', 500, 200)])
    const { s } = mesa(map, true)
    const r = fechar(s, map)
    expect(r.applyDoor).toBeUndefined()
    expect(r.outbound).toEqual(bloqueada)
  })

  it('a própria ficha no vão também segura a porta', () => {
    const map = mapaComPorta([ficha('heroi', 505, 200)])
    const { s } = mesa(map)
    const r = fechar(s, map)
    expect(r.applyDoor).toBeUndefined()
    expect(r.outbound).toEqual(bloqueada)
  })

  it('ficha encostada no batente (borda tocando a porta, sem entrar no vão) não impede de fechar', () => {
    // Raio 20: o centro a 20 px da porta só encosta nela.
    const map = mapaComPorta([ficha('heroi', 460, 200), ficha('aliado', 480, 200)])
    const { s } = mesa(map, true)
    const r = fechar(s, map)
    expect(r.applyDoor).toMatchObject({ wallId: 'porta', open: false })
    expect(r.outbound).toEqual([])
  })

  it('abrir uma porta fechada nunca é barrado pelo vão', () => {
    const map = mapaComPorta([ficha('heroi', 460, 200), ficha('aliado', 500, 200)], { ...aberta, open: false })
    const { s } = mesa(map, true)
    const r = fechar(s, map)
    expect(r.applyDoor).toMatchObject({ wallId: 'porta', open: true })
    expect(r.outbound).toEqual([])
  })

  it('ficha que o mestre esconde (oculta ou secreta) no vão NÃO chega ao jogador como "blocked"', () => {
    for (const escondida of [{ hidden: true }, { secret: true }]) {
      const map = mapaComPorta([ficha('heroi', 460, 200), ficha('monstro', 500, 200, escondida)])
      const { s } = mesa(map)
      const r = fechar(s, map)
      // A recusa diria que há alguém ali: a porta fecha como se o vão estivesse livre.
      expect(r.applyDoor).toMatchObject({ wallId: 'porta', open: false })
      expect(r.outbound).toEqual([])
      expect(JSON.stringify(r.outbound)).not.toContain('monstro')
    }
  })

  it('a recusa não diz QUEM está no vão: nem nome nem id da ficha vão ao jogador', () => {
    const map = mapaComPorta([ficha('heroi', 460, 200), ficha('aliado', 500, 200)])
    const { s } = mesa(map, true)
    const texto = JSON.stringify(fechar(s, map).outbound)
    expect(texto).toContain('blocked')
    expect(texto).not.toContain('aliado')
    expect(texto).not.toContain('Bia')
  })
})

describe('o mestre sabe quem mexeu na porta', () => {
  it('porta aceita leva o jogador e o nome dele no applyDoor, e nada disso vai ao jogador', () => {
    const map = mapaComPorta([ficha('heroi', 460, 200)], { ...aberta, open: false })
    const { s, ana } = mesa(map)
    const r = fechar(s, map)
    expect(r.applyDoor).toEqual({ wallId: 'porta', open: true, playerId: ana, playerName: 'Ana' })
    expect(r.outbound).toEqual([])
  })

  it('porta numa cena de fundo: o aviso do mestre recebe também o nome da cena', () => {
    const salao = { ...createEmptyMap('m-salao', 'Salao Norte', 1000, 1000, GRID), tokens: [] }
    const cripta = { ...mapaComPorta([ficha('heroi', 460, 200)]), id: 'm-cripta', name: 'Cripta Rubra' }
    const mundo: HostWorld = {
      open: { sceneId: 's-a', name: 'Salao Norte', map: salao },
      background: [{ sceneId: 's-b', name: 'Cripta Rubra', map: cripta }],
    }
    const { s, ana } = mesa(mundo)
    const r = fechar(s, mundo)
    expect(r.applyDoor).toEqual({ wallId: 'porta', open: false, sceneId: 's-b', sceneName: 'Cripta Rubra', playerId: ana, playerName: 'Ana' })
    expect(JSON.stringify(r.outbound)).not.toContain('Cripta Rubra')
  })
})
