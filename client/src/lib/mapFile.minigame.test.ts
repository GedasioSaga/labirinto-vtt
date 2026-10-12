import { describe, expect, it } from 'vitest'
import { FALA_MAX_LENGTH, MINIGAME_PADRAO, NPC_MAX_LENGTH, PREMIO_TEXTO_MAX_LENGTH, type MinigameDoPino } from '../minigames/danca/tipos'
import type { Pin } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

/**
 * MINIGAME no disco: `kind: 'minigame'` é o quinto tipo de pino e `minigame`
 * é campo novo e opcional, lido campo a campo. O torto cai no padrão e o
 * resto do desafio fica; música importada torta vira a demo; pino de
 * minigame sem desafio que preste ganha `MINIGAME_PADRAO`.
 */

const MIDIA = `midia:${'a'.repeat(64)}.mp3`

const IMPORTADO: MinigameDoPino = {
  jogo: 'danca',
  npc: 'Seu Lula',
  fala: 'Dança comigo?',
  musica: {
    tipo: 'arquivo',
    midia: MIDIA,
    nome: 'Forró do porão',
    bpm: 128,
    primeiraBatida: 0.42,
    fase4: 2,
    duracaoS: 95.5,
    coreografias: {
      diversao: [{ t: 1, lane: 0, len: 0, sub: 4 }],
      expert: [
        { t: 1, lane: 3, len: 0.5, sub: 8 },
        { t: 1.25, lane: 1, len: 0, sub: 16 },
      ],
    },
  },
  permitida: 'expert',
  notaMin: 'A',
  premio: { tipo: 'pista', texto: 'O mapa do porão' },
  consequencia: { tipo: 'barulho', texto: 'Os guardas ouvem' },
}

function lerPino(minigame: string, kind = 'minigame'): Pin {
  const json = `{"id": "torto", "pins": [{"id": "m", "x": 1, "y": 2, "kind": "${kind}", "description": "", "image": null${minigame === '' ? '' : `, "minigame": ${minigame}`}}]}`
  return deserializeMap(json).pins[0]
}

function comMusica(musica: unknown): string {
  return JSON.stringify({ ...IMPORTADO, musica })
}

describe('mapFile: minigame', () => {
  it('o minigame (com música importada e a porta ligada) vai e volta do disco igual', () => {
    const map = {
      ...createEmptyMap('map_m', 'M', 5, 5, 64),
      pins: [{ id: 'm', x: 64, y: 64, kind: 'minigame' as const, description: '', image: null, portaLigada: 'porta-1', minigame: IMPORTADO }], // literal: `kind` é PinKind, não string
    }
    const lido = deserializeMap(serializeMap(map)).pins[0]
    expect(lido.kind).toBe('minigame')
    expect(lido.portaLigada).toBe('porta-1')
    expect(lido.minigame).toEqual(IMPORTADO)
  })

  it('pino de minigame sem o campo, ou com lixo, ganha o padrão', () => {
    for (const valor of ['', 'null', '1', '"danca"', '[]', '{}', '{"jogo": "xadrez"}']) {
      const pino = lerPino(valor)
      expect(pino.kind, `minigame: ${valor}`).toBe('minigame')
      expect(pino.minigame, `minigame: ${valor}`).toEqual(MINIGAME_PADRAO)
    }
  })

  it('o padrão lido é cópia: mexer nele não alcança a constante', () => {
    const pino = lerPino('')
    expect(pino.minigame).not.toBe(MINIGAME_PADRAO)
    expect(pino.minigame?.premio).not.toBe(MINIGAME_PADRAO.premio)
  })

  it('campo torto cai no padrão e o resto do desafio fica', () => {
    const torto = JSON.stringify({
      jogo: 'danca',
      npc: 42,
      fala: '   Vem dançar   ',
      musica: { tipo: 'demo' },
      permitida: 'impossivel',
      notaMin: 'Z',
      premio: { tipo: 'ouro', texto: 7 },
      consequencia: 'nada',
      extra: 'campo desconhecido',
    })
    const lido = lerPino(torto).minigame
    expect(lido).toEqual({
      jogo: 'danca',
      npc: MINIGAME_PADRAO.npc,
      fala: 'Vem dançar',
      musica: { tipo: 'demo' },
      permitida: MINIGAME_PADRAO.permitida,
      notaMin: MINIGAME_PADRAO.notaMin,
      premio: MINIGAME_PADRAO.premio,
      consequencia: MINIGAME_PADRAO.consequencia,
    })
    expect(serializeMap(deserializeMap(`{"id": "x", "pins": [{"id": "m", "x": 1, "y": 2, "kind": "minigame", "description": "", "image": null, "minigame": ${torto}}]}`))).not.toContain('campo desconhecido')
  })

  it('textos aparados e cortados nos limites de tipos.ts', () => {
    const longo = JSON.stringify({
      ...IMPORTADO,
      npc: `  ${'n'.repeat(NPC_MAX_LENGTH + 30)}  `,
      fala: 'f'.repeat(FALA_MAX_LENGTH + 30),
      premio: { tipo: 'item', texto: 'p'.repeat(PREMIO_TEXTO_MAX_LENGTH + 30) },
      consequencia: { tipo: 'espera', texto: 'c'.repeat(PREMIO_TEXTO_MAX_LENGTH + 30) },
    })
    const lido = lerPino(longo).minigame
    expect(lido?.npc).toBe('n'.repeat(NPC_MAX_LENGTH))
    expect(lido?.fala).toHaveLength(FALA_MAX_LENGTH)
    expect(lido?.premio.texto).toHaveLength(PREMIO_TEXTO_MAX_LENGTH)
    expect(lido?.consequencia.texto).toHaveLength(PREMIO_TEXTO_MAX_LENGTH)
  })

  it('música importada inválida vira a demo', () => {
    if (IMPORTADO.musica.tipo !== 'arquivo') throw new Error('o fixture tem de ser importado')
    const boa = IMPORTADO.musica
    const tortas: unknown[] = [
      { ...boa, midia: 'C:\\Users\\mestre\\musica.mp3' },
      { ...boa, midia: `midia:${'a'.repeat(64)}.png` },
      { ...boa, midia: `midia:${'A'.repeat(64)}.mp3` },
      { ...boa, midia: 'https://exemplo.com/musica.mp3' },
      { ...boa, bpm: 0 },
      { ...boa, bpm: '128' },
      { ...boa, primeiraBatida: -1 },
      { ...boa, duracaoS: null },
      { ...boa, fase4: 4 },
      { ...boa, fase4: 1.5 },
      { ...boa, coreografias: null },
      { ...boa, coreografias: { diversao: [] } },
      { tipo: 'radio' },
      'demo',
    ]
    for (const musica of tortas) {
      expect(lerPino(comMusica(musica)).minigame?.musica, JSON.stringify(musica)).toEqual({ tipo: 'demo' })
    }
    // NaN e Infinity não existem em JSON: chegam do disco como `null`.
    expect(lerPino(comMusica({ ...boa, bpm: Number.NaN })).minigame?.musica).toEqual({ tipo: 'demo' })
  })

  it('nota torta da coreografia é descartada e as boas ficam', () => {
    if (IMPORTADO.musica.tipo !== 'arquivo') throw new Error('o fixture tem de ser importado')
    const boa = { t: 2, lane: 2, len: 0, sub: 8 }
    const musica = {
      ...IMPORTADO.musica,
      coreografias: {
        diversao: [boa, { ...boa, lane: 4 }, { ...boa, sub: 2 }, { ...boa, t: -1 }, { ...boa, len: '1' }, null, 'seta'],
        expert: [{ ...boa, t: 3, extra: 'x' }],
      },
    }
    const lida = lerPino(comMusica(musica)).minigame?.musica
    expect(lida?.tipo).toBe('arquivo')
    if (lida?.tipo !== 'arquivo') return
    expect(lida.coreografias.diversao).toEqual([boa])
    expect(lida.coreografias.expert).toEqual([{ ...boa, t: 3 }])
  })

  it('tipo desconhecido continua virando "!", e não leva o minigame junto', () => {
    const pino = lerPino(JSON.stringify(IMPORTADO), 'roleta')
    expect(pino.kind).toBe('exclamacao')
    expect(pino.minigame).toBeUndefined()
  })

  it('minigame em pino de outro tipo é sobra e não entra', () => {
    const pino = lerPino(JSON.stringify(IMPORTADO), 'alavanca')
    expect(pino.kind).toBe('alavanca')
    expect(pino.minigame).toBeUndefined()
  })

  it('mapa antigo abre sem o campo e grava sem ele', () => {
    const antigo = deserializeMap(`{"id": "antigo", "pins": [{"id": "p", "x": 1, "y": 2, "kind": "exclamacao", "description": "", "image": null}]}`)
    expect(antigo.pins[0].minigame).toBeUndefined()
    expect(serializeMap(antigo)).not.toContain('minigame')
  })
})
