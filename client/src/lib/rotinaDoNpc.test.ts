import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { comRotina, gravarPosto, moverNaCena, planejarRotina, rotinaDoArquivo, tirarPosto } from './rotinaDoNpc'

/**
 * ROTINA DO NPC: o Irmão Tobias tem um posto por apito. Na Aurora fica na
 * capela; no Meio vai ao confessionário, que é OUTRA cena; na Brasa anda para o
 * canto da mesma capela. Na Sombra não tem posto: fica onde está.
 */
const APITO = 'estado_apito'

function tobias(extra: Partial<Token> = {}): Token {
  return {
    id: 'tobias',
    characterId: null,
    name: 'Irmão Tobias',
    x: 100,
    y: 100,
    size: 1,
    image: null,
    npc: true,
    rotina: {
      estadoId: APITO,
      postos: [
        { valor: 'Aurora', sceneId: 'capela', x: 100, y: 100 },
        { valor: 'Meio', sceneId: 'confessionario', x: 300, y: 250 },
        { valor: 'Brasa', sceneId: 'capela', x: 600, y: 400 },
      ],
    },
    ...extra,
  }
}

function capela(tokens: Token[]): MapData {
  return { ...createEmptyMap('map_capela', 'Capela', 20, 20, 50), tokens }
}

function confessionario(tokens: Token[] = []): MapData {
  return { ...createEmptyMap('map_conf', 'Confessionário 77', 20, 20, 50), tokens }
}

describe('planejarRotina: quem vai para onde quando o apito toca', () => {
  it('posto em outra cena: a ficha troca de cena', () => {
    const cenas = [
      { sceneId: 'capela', map: capela([tobias()]) },
      { sceneId: 'confessionario', map: confessionario() },
    ]
    expect(planejarRotina(cenas, APITO, 'Meio')).toEqual([{ tokenId: 'tobias', de: 'capela', para: 'confessionario', x: 300, y: 250 }])
  })

  it('posto na mesma cena: a ficha anda dentro dela', () => {
    const cenas = [{ sceneId: 'capela', map: capela([tobias()]) }]
    expect(planejarRotina(cenas, APITO, 'Brasa')).toEqual([{ tokenId: 'tobias', de: 'capela', para: 'capela', x: 600, y: 400 }])
  })

  it('turno sem posto, ficha já no posto, outro estado ou ficha sem rotina: ninguém anda', () => {
    const semRotina: Token = { id: 'gabi', characterId: null, name: 'Gabi', x: 0, y: 0, size: 1, image: null }
    const cenas = [{ sceneId: 'capela', map: capela([tobias(), semRotina]) }]
    expect(planejarRotina(cenas, APITO, 'Sombra')).toEqual([])
    expect(planejarRotina(cenas, APITO, 'Aurora')).toEqual([])
    expect(planejarRotina(cenas, 'estado_mare', 'Brasa')).toEqual([])
  })

  it('posto numa cena que não abriu fica de fora (a ficha não some do mapa)', () => {
    const cenas = [{ sceneId: 'capela', map: capela([tobias()]) }]
    expect(planejarRotina(cenas, APITO, 'Meio')).toEqual([])
  })

  it('ficha que um jogador segura não entra no apito', () => {
    const cenas = [{ sceneId: 'capela', map: capela([tobias()]) }]
    expect(planejarRotina(cenas, APITO, 'Brasa', new Set(['tobias']))).toEqual([])
    expect(planejarRotina(cenas, APITO, 'Brasa', new Set(['outra']))).toHaveLength(1)
  })
})

describe('moverNaCena: o movimento dentro da cena', () => {
  it('põe a ficha no posto e devolve o MESMO mapa quando nada muda', () => {
    const map = capela([tobias()])
    const movido = moverNaCena(map, [{ tokenId: 'tobias', de: 'capela', para: 'capela', x: 600, y: 400 }])
    expect(movido.tokens[0]).toEqual(expect.objectContaining({ id: 'tobias', x: 600, y: 400 }))
    // Movimento para outra cena não é desta função; ficha que não está no mapa, também não.
    expect(moverNaCena(map, [{ tokenId: 'tobias', de: 'capela', para: 'confessionario', x: 1, y: 1 }])).toBe(map)
    expect(moverNaCena(map, [{ tokenId: 'fantasma', de: 'capela', para: 'capela', x: 1, y: 1 }])).toBe(map)
  })
})

describe('gravar e tirar posto', () => {
  it('gravar troca o posto do mesmo valor e acrescenta valor novo; tirar apaga só aquele', () => {
    const rotina = { estadoId: APITO, postos: [{ valor: 'Aurora', sceneId: 'capela', x: 1, y: 2 }] }
    const trocado = gravarPosto(rotina, { valor: 'Aurora', sceneId: 'confessionario', x: 5, y: 6 })
    expect(trocado.postos).toEqual([{ valor: 'Aurora', sceneId: 'confessionario', x: 5, y: 6 }])
    const acrescido = gravarPosto(trocado, { valor: 'Meio', sceneId: 'capela', x: 7, y: 8 })
    expect(acrescido.postos.map((p) => p.valor)).toEqual(['Aurora', 'Meio'])
    expect(tirarPosto(acrescido, 'Aurora').postos.map((p) => p.valor)).toEqual(['Meio'])
  })

  it('comRotina(undefined) grava a ficha sem a chave, como ficha de antes do campo', () => {
    const solta = comRotina(tobias(), undefined)
    expect('rotina' in solta).toBe(false)
    expect(solta.name).toBe('Irmão Tobias')
  })
})

describe('arquivo: mapa antigo abre igual e rotina torta não derruba o mapa', () => {
  it('ficha sem rotina no arquivo continua sem a chave', () => {
    const semRotina: Token = { id: 'gabi', characterId: null, name: 'Gabi', x: 0, y: 0, size: 1, image: null }
    const lido = deserializeMap(serializeMap(capela([semRotina])))
    expect(lido.tokens).toHaveLength(1)
    expect('rotina' in lido.tokens[0]).toBe(false)
  })

  it('rotina boa faz o caminho de ida e volta pelo arquivo', () => {
    const lido = deserializeMap(serializeMap(capela([tobias()])))
    expect(lido.tokens[0].rotina).toEqual(tobias().rotina)
  })

  it('posto torto sai; rotina sem posto bom some', () => {
    expect(
      rotinaDoArquivo({
        estadoId: APITO,
        postos: [
          { valor: 'Aurora', sceneId: 'capela', x: 1, y: 2 },
          { valor: 'Aurora', sceneId: 'capela', x: 9, y: 9 },
          { valor: 'Meio', sceneId: '', x: 1, y: 2 },
          { valor: 'Brasa', sceneId: 'capela', x: 'longe', y: 2 },
          { valor: 'Sombra', sceneId: 'capela', x: Number.NaN, y: 2 },
          null,
        ],
      }),
    ).toEqual({ estadoId: APITO, postos: [{ valor: 'Aurora', sceneId: 'capela', x: 1, y: 2 }] })
    expect(rotinaDoArquivo({ estadoId: APITO, postos: [] })).toBeUndefined()
    expect(rotinaDoArquivo({ postos: [{ valor: 'Aurora', sceneId: 'capela', x: 1, y: 2 }] })).toBeUndefined()
    expect(rotinaDoArquivo('Aurora: missa')).toBeUndefined()
    const torto = JSON.stringify({ ...JSON.parse(serializeMap(capela([]))), tokens: [{ ...tobias(), rotina: { estadoId: 7 } }] })
    const lido = deserializeMap(torto)
    expect(lido.tokens[0].name).toBe('Irmão Tobias')
    expect('rotina' in lido.tokens[0]).toBe(false)
  })
})
