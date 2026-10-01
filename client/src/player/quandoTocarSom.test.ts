import { describe, expect, it } from 'vitest'
import type { DiceRollEntry } from '../lib/dice'
import { addToken, addWall, createEmptyMap } from '../lib/mapFactory'
import type { MapData, RegionPoint, Token, Wall } from '../types/map'
import type { PlayerState } from './playerConnection'
import { anotarVistos, criarJaVistos, estaAoVivo, sonsDaMudanca, type JaVistos } from './quandoTocarSom'

/**
 * QUANDO TOCAR UM SOM NO JOGADOR: a regra pura que olha o estado da conexão
 * antes e depois de uma mudança. Os casos de reconexão com as mensagens de
 * verdade do host ficam em `sonsDoJogador.test.ts`.
 */

/** Visão que cobre o mapa inteiro: toda porta está à vista. */
const VISAO_TODA: RegionPoint[][] = [
  [
    { x: -1000, y: -1000 },
    { x: 2000, y: -1000 },
    { x: 2000, y: 2000 },
    { x: -1000, y: 2000 },
  ],
]

/** Visão longe das portas (que ficam em x ≤ 300): a porta só sai pela lembrança. */
const VISAO_LONGE: RegionPoint[][] = [
  [
    { x: 800, y: 800 },
    { x: 900, y: 800 },
    { x: 900, y: 900 },
    { x: 800, y: 900 },
  ],
]

function porta(id: string, aberta: boolean, x = 100): Wall {
  return { id, x1: x, y1: 0, x2: x, y2: 50, blocksLight: !aberta, blocksMove: !aberta, door: { open: aberta, locked: false, kind: 'normal' } }
}

function parede(id: string): Wall {
  return { id, x1: 0, y1: 0, x2: 50, y2: 0, blocksLight: true, blocksMove: true, door: null }
}

function ficha(id: string, piso?: number): Token {
  const base: Token = { id, characterId: null, name: id, x: 25, y: 25, size: 1, image: null }
  return piso === undefined ? base : { ...base, piso }
}

function mapa(id: string, paredes: Wall[] = [], fichas: Token[] = []): MapData {
  const comParedes = paredes.reduce(addWall, createEmptyMap(id, id, 10, 10, 50))
  return fichas.reduce(addToken, comParedes)
}

function rolagem(id: string): DiceRollEntry {
  return { id, from: 'Bia', count: 1, sides: 20, modifier: 0, results: [7], total: 7, at: 1 }
}

/** Jogando de verdade: mapa na tela, recorte já chegou, sem queda. */
function jogando(extra: Partial<PlayerState> = {}): PlayerState {
  return { status: 'playing', rev: 5, sceneEpoch: 1, vision: VISAO_TODA, ...extra }
}

const nada = (): JaVistos => criarJaVistos()

describe('estaAoVivo', () => {
  it('só o jogo valendo: jogando, com recorte, sem queda e sem "Volto já"', () => {
    expect(estaAoVivo(jogando())).toBe(true)
    expect(estaAoVivo(jogando({ status: 'waiting' }))).toBe(false)
    expect(estaAoVivo(jogando({ status: 'connecting' }))).toBe(false)
    // Depois da queda (ou antes do primeiro recorte) o rev é -1: o próximo snapshot é história.
    expect(estaAoVivo(jogando({ rev: -1 }))).toBe(false)
    expect(estaAoVivo(jogando({ reconnecting: { since: 1, attempt: 0, manual: false } }))).toBe(false)
    expect(estaAoVivo(jogando({ away: true }))).toBe(false)
  })
})

describe('sonsDaMudanca: entrada, saída e queda não tocam', () => {
  it('de "conectando" para jogando com 5 dados, alarme e recado: nenhum som (sem rajada na entrada)', () => {
    const antes: PlayerState = { status: 'connecting', rev: -1, sceneEpoch: 0 }
    const depois = jogando({
      diceRolls: ['d1', 'd2', 'd3', 'd4', 'd5'].map(rolagem),
      alarm: { id: 'a1', text: 'Fogo!' },
      note: { id: 'n1', text: 'Silêncio.' },
      map: mapa('m1', [porta('p1', true)]),
    })
    expect(sonsDaMudanca(antes, depois, nada())).toEqual([])
  })

  it('sair do jogo (expulso) sobe a época, mas não é passagem', () => {
    expect(sonsDaMudanca(jogando(), jogando({ status: 'kicked', sceneEpoch: 2 }), nada())).toEqual([])
  })

  it('a queda e a volta não tocam: com "reconectando", e no recorte que chega logo depois (rev -1)', () => {
    const caiu = jogando({ reconnecting: { since: 1, attempt: 0, manual: false }, rev: -1 })
    expect(sonsDaMudanca(jogando(), caiu, nada())).toEqual([])
    const welcome = jogando({ rev: -1 })
    expect(sonsDaMudanca(caiu, welcome, nada())).toEqual([])
    // O recorte da volta traz o que mudou com ele fora: porta aberta, dado novo. É história.
    const antesDaQueda = mapa('m1', [porta('p1', false)])
    const recorteDaVolta = jogando({ rev: 9, map: mapa('m1', [porta('p1', true)]), diceRolls: [rolagem('d9')] })
    expect(sonsDaMudanca({ ...welcome, map: antesDaQueda }, recorteDaVolta, nada())).toEqual([])
  })

  it('"Volto já": fora da mesa, nada toca', () => {
    expect(sonsDaMudanca(jogando({ away: true }), jogando({ away: true, alarm: { id: 'a1', text: 'x' } }), nada())).toEqual([])
  })
})

describe('sonsDaMudanca: passagem', () => {
  it('a época sobe com as duas pontas jogando: só a passagem, mesmo com portas diferentes e item novo', () => {
    const antes = jogando({ map: mapa('m1', [porta('p1', false)]) })
    const depois = jogando({ sceneEpoch: 2, map: mapa('m1', [porta('p1', true)]), item: { id: 3, phase: 'taken', nome: 'Chave' } })
    expect(sonsDaMudanca(antes, depois, nada())).toEqual(['passagem'])
  })

  it('a resposta "Você chegou" vem no mesmo scene.changed que já subiu a época: não toca de novo', () => {
    // playerConnection.ts: `scene.changed` sobe a época e, logo atrás, põe `travel` em arrived/moved/gathered.
    const subiu = jogando({ sceneEpoch: 2 })
    const chegadas: Array<'arrived' | 'moved' | 'gathered'> = ['arrived', 'moved', 'gathered']
    for (const phase of chegadas) {
      expect(sonsDaMudanca(subiu, jogando({ sceneEpoch: 2, travel: { id: 7, phase } }), nada())).toEqual([])
    }
  })

  it('a ficha dele troca de piso pela escada (mesma cena): passagem', () => {
    const antes = jogando({ ownTokens: ['eu'], map: mapa('m1', [], [ficha('eu')]) })
    const depois = jogando({ ownTokens: ['eu'], map: mapa('m1', [], [ficha('eu', 1)]) })
    expect(sonsDaMudanca(antes, depois, nada())).toEqual(['passagem'])
  })

  it('piso de ficha alheia, ficha que só aparece agora ou mapa de outra cena: não é passagem', () => {
    const colega = jogando({ ownTokens: ['eu'], map: mapa('m1', [], [ficha('eu'), ficha('bia')]) })
    expect(sonsDaMudanca(colega, jogando({ ownTokens: ['eu'], map: mapa('m1', [], [ficha('eu'), ficha('bia', 2)]) }), nada())).toEqual([])
    const sozinho = jogando({ ownTokens: ['eu'], map: mapa('m1') })
    expect(sonsDaMudanca(sozinho, jogando({ ownTokens: ['eu'], map: mapa('m1', [], [ficha('eu', 1)]) }), nada())).toEqual([])
    const cenaVelha = jogando({ ownTokens: ['eu'], map: mapa('m1', [], [ficha('eu')]) })
    expect(sonsDaMudanca(cenaVelha, jogando({ ownTokens: ['eu'], map: mapa('m2', [], [ficha('eu', 1)]) }), nada())).toEqual([])
  })

  it('o rótulo do andar muda sem ninguém andar (o mestre ligou ou renomeou os andares): nada toca', () => {
    expect(sonsDaMudanca(jogando(), jogando({ andares: { atual: 'Térreo', outros: [] } }), nada())).toEqual([])
    const terreo = jogando({ andares: { atual: 'Térreo', outros: [] } })
    expect(sonsDaMudanca(terreo, jogando({ andares: { atual: 'Saguão', outros: [] } }), nada())).toEqual([])
  })
})

describe('sonsDaMudanca: item e porta trancada', () => {
  it('item pego (taken) com id novo toca; o mesmo id, a recusa e o "enviado" não', () => {
    const pegou = jogando({ item: { id: 3, phase: 'taken', nome: 'Chave' } })
    expect(sonsDaMudanca(jogando(), pegou, nada())).toEqual(['item'])
    expect(sonsDaMudanca(pegou, jogando({ item: { id: 3, phase: 'taken', nome: 'Chave' } }), nada())).toEqual([])
    expect(sonsDaMudanca(jogando(), jogando({ item: { id: 4, phase: 'denied' } }), nada())).toEqual([])
    expect(sonsDaMudanca(jogando(), jogando({ item: { id: 5, phase: 'sent', direct: true } }), nada())).toEqual([])
  })

  it('porta trancada com id novo toca; longe e o mesmo aviso não', () => {
    const trancada = jogando({ doorNotice: { id: 4, reason: 'locked', wallId: 'p1' } })
    expect(sonsDaMudanca(jogando(), trancada, nada())).toEqual(['trancada'])
    expect(sonsDaMudanca(trancada, jogando({ doorNotice: { id: 4, reason: 'locked', wallId: 'p1' } }), nada())).toEqual([])
    expect(sonsDaMudanca(jogando(), jogando({ doorNotice: { id: 5, reason: 'far', wallId: 'p1' } }), nada())).toEqual([])
  })
})

describe('sonsDaMudanca: portas', () => {
  const com = (paredes: Wall[], extra: Partial<PlayerState> = {}) => jogando({ map: mapa('m1', paredes), ...extra })

  it('uma porta à vista abre: portaAbre; fecha: portaFecha', () => {
    expect(sonsDaMudanca(com([porta('p1', false)]), com([porta('p1', true)]), nada())).toEqual(['portaAbre'])
    expect(sonsDaMudanca(com([porta('p1', true)]), com([porta('p1', false)]), nada())).toEqual(['portaFecha'])
  })

  it('três portas abrindo (alavanca) dão um rangido só; uma abrindo e outra fechando, um de cada', () => {
    const fechadas = com([porta('p1', false, 100), porta('p2', false, 200), porta('p3', false, 300), parede('w1')])
    const abertas = com([porta('p1', true, 100), porta('p2', true, 200), porta('p3', true, 300), parede('w1')])
    expect(sonsDaMudanca(fechadas, abertas, nada())).toEqual(['portaAbre'])
    const misto = com([porta('p1', true, 100), porta('p2', false, 200)])
    const trocado = com([porta('p1', false, 100), porta('p2', true, 200)])
    expect(sonsDaMudanca(misto, trocado, nada()).sort()).toEqual(['portaAbre', 'portaFecha'])
  })

  it('porta que só veio agora no recorte não toca', () => {
    expect(sonsDaMudanca(com([]), com([porta('p1', true)]), nada())).toEqual([])
  })

  it('porta que "abre" ao ser avistada (estava na lembrança) não toca: o jogador só a viu agora', () => {
    // fogFilter: porta fora da visão sai com o estado LEMBRADO (ou fechada, se nunca vista).
    const lembrada = com([porta('p1', false)], { vision: VISAO_LONGE })
    const avistada = com([porta('p1', true)], { vision: VISAO_TODA })
    expect(sonsDaMudanca(lembrada, avistada, nada())).toEqual([])
  })

  it('mesma época mas mapa de outra cena (o snapshot logo depois do scene.changed): não compara portas', () => {
    const velho = jogando({ map: mapa('m1', [porta('p1', false)]) })
    const novo = jogando({ map: mapa('m2', [porta('p1', true)]) })
    expect(sonsDaMudanca(velho, novo, nada())).toEqual([])
  })
})

describe('sonsDaMudanca: dado e aviso', () => {
  it('rolagem com id novo toca, também quando a mais velha sai pelo teto; a mesma lista não', () => {
    const duas = jogando({ diceRolls: [rolagem('d1'), rolagem('d2')] })
    expect(sonsDaMudanca(jogando(), duas, nada())).toEqual(['dado'])
    expect(sonsDaMudanca(duas, jogando({ diceRolls: [rolagem('d1'), rolagem('d2')] }), nada())).toEqual([])
    expect(sonsDaMudanca(duas, jogando({ diceRolls: [rolagem('d2'), rolagem('d3')] }), nada())).toEqual(['dado'])
  })

  it('alarme com id novo toca; o mesmo id não', () => {
    const alarme = jogando({ alarm: { id: 'a1', text: 'Fogo!' } })
    expect(sonsDaMudanca(jogando(), alarme, nada())).toEqual(['aviso'])
    expect(sonsDaMudanca(alarme, jogando({ alarm: { id: 'a1', text: 'Fogo!' } }), nada())).toEqual([])
  })

  it('recado do mestre (sem from) toca; bilhete de colega (com from) não', () => {
    expect(sonsDaMudanca(jogando(), jogando({ note: { id: 'n1', text: 'Silêncio.' } }), nada())).toEqual(['aviso'])
    expect(sonsDaMudanca(jogando(), jogando({ note: { id: 'n2', text: 'Oi', from: 'Ana', via: 'tubo' } }), nada())).toEqual([])
  })

  it('alarme e recado já vistos nesta página (reenvio do host na volta) não tocam de novo', () => {
    const vistos = criarJaVistos()
    vistos.alarmes.add('a1')
    vistos.recados.add('n1')
    expect(sonsDaMudanca(jogando(), jogando({ alarm: { id: 'a1', text: 'Fogo!' } }), vistos)).toEqual([])
    expect(sonsDaMudanca(jogando(), jogando({ note: { id: 'n1', text: 'Silêncio.' } }), vistos)).toEqual([])
  })
})

describe('anotarVistos', () => {
  it('guarda o alarme, o recado aberto, o caderno e a fila de fora', () => {
    const vistos = criarJaVistos()
    anotarVistos(
      vistos,
      jogando({
        alarm: { id: 'a1', text: 'x' },
        note: { id: 'n1', text: 'x' },
        notebook: [{ id: 'n2', text: 'x', at: 1 }],
        awayNotes: [{ id: 'n3', text: 'x', at: 2 }],
      }),
    )
    expect([...vistos.alarmes]).toEqual(['a1'])
    expect([...vistos.recados].sort()).toEqual(['n1', 'n2', 'n3'])
  })
})
