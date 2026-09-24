/**
 * CONDIÇÃO NA FICHA — a parte pura: a lista curta, o que vale num mapa vindo
 * do disco, o liga/desliga de uma condição e ONDE cada marca fica em cima da
 * ficha. A régua de tela é `e2e/task-jornada-condicao-na-ficha.spec.ts`; aqui
 * se prova a regra que as duas telas (editor e jogador) dividem.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token, TokenCondition } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import {
  TOKEN_CONDITION_LABELS,
  TOKEN_CONDITION_ORDER,
  TOKEN_CONDITION_SYMBOLS,
  conditionBadgeLayout,
  isTokenCondition,
  toggleTokenCondition,
  tokenConditionsForPlayer,
  tokenConditionsOf,
} from './tokenConditions'

function ficha(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x: 100, y: 100, size: 1, image: null, ...extra }
}

function mapaCom(tokens: Token[]): MapData {
  return { ...createEmptyMap('m', 'M', 20, 12, 50), tokens }
}

describe('a lista de condições', () => {
  it('são as cinco do pedido, na ordem do painel, com o nome que a pessoa lê', () => {
    expect(TOKEN_CONDITION_ORDER).toEqual(['envenenado', 'caido', 'dormindo', 'atordoado', 'invisivel'])
    expect(TOKEN_CONDITION_ORDER.map((c) => TOKEN_CONDITION_LABELS[c])).toEqual(['Envenenado', 'Caído', 'Dormindo', 'Atordoado', 'Invisível'])
  })

  it('só reconhece os ids da lista', () => {
    expect(isTokenCondition('caido')).toBe(true)
    expect(isTokenCondition('Caído')).toBe(false)
    expect(isTokenCondition('morto')).toBe(false)
    expect(isTokenCondition(3)).toBe(false)
    expect(isTokenCondition(null)).toBe(false)
  })

  it('cada condição tem ícone PRÓPRIO: cor chapada diferente e desenho diferente', () => {
    const cores = TOKEN_CONDITION_ORDER.map((c) => TOKEN_CONDITION_SYMBOLS[c].fill)
    expect(new Set(cores).size).toBe(TOKEN_CONDITION_ORDER.length)
    for (const cor of cores) expect(cor).toMatch(/^#[0-9a-f]{6}$/)
    const desenhos = TOKEN_CONDITION_ORDER.map((c) => {
      const { fill: _cor, ...forma } = TOKEN_CONDITION_SYMBOLS[c]
      return JSON.stringify(forma)
    })
    expect(new Set(desenhos).size).toBe(TOKEN_CONDITION_ORDER.length)
  })

  it('duas pastilhas quaisquer se distinguem pela cor (soma |dR|+|dG|+|dB| acima de 60), não só pelo traço', () => {
    const rgb = (hex: string): number[] => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
    for (const a of TOKEN_CONDITION_ORDER) {
      for (const b of TOKEN_CONDITION_ORDER) {
        if (a === b) continue
        const [ra, ga, ba] = rgb(TOKEN_CONDITION_SYMBOLS[a].fill)
        const [rb, gb, bb] = rgb(TOKEN_CONDITION_SYMBOLS[b].fill)
        expect(Math.abs(ra - rb) + Math.abs(ga - gb) + Math.abs(ba - bb), `${a} × ${b}`).toBeGreaterThan(60)
      }
    }
  })

  it('o desenho de cada ícone cabe dentro da pastilha (régua normalizada -1..1)', () => {
    for (const condicao of TOKEN_CONDITION_ORDER) {
      const simbolo = TOKEN_CONDITION_SYMBOLS[condicao]
      const pontos = [...simbolo.strokes.flatMap((s) => s.points), ...(simbolo.solids ?? []).flat()]
      expect(pontos.length, condicao).toBeGreaterThan(0)
      for (const p of pontos) expect(Math.hypot(p.x, p.y), condicao).toBeLessThanOrEqual(1.35)
    }
  })
})

describe('tokenConditionsOf — o que vale de uma ficha vinda do disco', () => {
  it('ficha sem o campo (mapa de antes da feature) não tem condição', () => {
    expect(tokenConditionsOf(ficha('a'))).toEqual([])
    expect(tokenConditionsOf(undefined)).toEqual([])
  })

  it('lixo de arquivo editado à mão cai fora; repetido vira um; a ordem é a da lista', () => {
    const suja = { conditions: ['invisivel', 'segredo do mestre', 7, null, 'envenenado', 'invisivel', { id: 'caido' }] }
    expect(tokenConditionsOf(suja)).toEqual(['envenenado', 'invisivel'])
  })

  it('campo que não é lista vale nenhuma condição, sem quebrar', () => {
    expect(tokenConditionsOf({ conditions: 'envenenado' })).toEqual([])
    expect(tokenConditionsOf({ conditions: { envenenado: true } })).toEqual([])
    expect(tokenConditionsOf({ conditions: null })).toEqual([])
  })
})

describe('toggleTokenCondition — marcar e desmarcar na ficha', () => {
  it('marca na ficha certa e não mexe na outra', () => {
    const antes = mapaCom([ficha('lanterna'), ficha('ogro')])
    const depois = toggleTokenCondition(antes, 'lanterna', 'envenenado')
    expect(depois.tokens.find((t) => t.id === 'lanterna')?.conditions).toEqual(['envenenado'])
    expect(depois.tokens.find((t) => t.id === 'ogro')).toBe(antes.tokens[1])
    expect(antes.tokens[0].conditions).toBeUndefined()
  })

  it('a segunda condição entra na ordem da lista, não na ordem do clique', () => {
    let mapa = mapaCom([ficha('lanterna')])
    mapa = toggleTokenCondition(mapa, 'lanterna', 'invisivel')
    mapa = toggleTokenCondition(mapa, 'lanterna', 'caido')
    expect(mapa.tokens[0].conditions).toEqual(['caido', 'invisivel'])
  })

  it('desmarcar a última devolve a ficha EXATAMENTE como era, sem campo vazio sobrando', () => {
    const original = ficha('ogro', { color: '#ff5a00' })
    let mapa = mapaCom([original])
    mapa = toggleTokenCondition(mapa, 'ogro', 'caido')
    mapa = toggleTokenCondition(mapa, 'ogro', 'caido')
    expect(mapa.tokens[0]).toEqual(original)
    expect('conditions' in mapa.tokens[0]).toBe(false)
  })

  it('ficha que não existe devolve o MESMO mapa (nada para desfazer)', () => {
    const mapa = mapaCom([ficha('lanterna')])
    expect(toggleTokenCondition(mapa, 'nao-existe', 'dormindo')).toBe(mapa)
  })

  it('desmarcar limpa junto o lixo que o arquivo trouxe no campo', () => {
    const suja = { ...ficha('lanterna'), conditions: ['dormindo', 'xyz'] as unknown as TokenCondition[] }
    const mapa = toggleTokenCondition(mapaCom([suja]), 'lanterna', 'dormindo')
    expect('conditions' in mapa.tokens[0]).toBe(false)
  })
})

describe('condição no arquivo do mapa', () => {
  it('salvar e reabrir devolve as condições marcadas (a luta continua na próxima sessão)', () => {
    const marcado = toggleTokenCondition(toggleTokenCondition(mapaCom([ficha('ogro')]), 'ogro', 'caido'), 'ogro', 'dormindo')
    const reaberto = deserializeMap(serializeMap(marcado))
    expect(tokenConditionsOf(reaberto.tokens[0])).toEqual(['caido', 'dormindo'])
  })

  it('mapa de antes da feature reabre sem campo inventado', () => {
    const reaberto = deserializeMap(serializeMap(mapaCom([ficha('ogro')])))
    expect('conditions' in reaberto.tokens[0]).toBe(false)
  })
})

describe('tokenConditionsForPlayer — o recorte do campo novo', () => {
  it('ficha limpa atravessa como está (mesma instância)', () => {
    const limpa = ficha('a', { conditions: ['caido', 'dormindo'] })
    expect(tokenConditionsForPlayer(limpa)).toBe(limpa)
    const sem = ficha('b')
    expect(tokenConditionsForPlayer(sem)).toBe(sem)
  })

  it('só os ids da lista chegam ao jogador: texto do mestre escondido no campo não atravessa', () => {
    const suja = { ...ficha('a'), conditions: ['atordoado', 'o mestre sabe que é o traidor'] as unknown as TokenCondition[] }
    const recorte = tokenConditionsForPlayer(suja)
    expect(recorte.conditions).toEqual(['atordoado'])
    expect(JSON.stringify(recorte)).not.toContain('traidor')
  })

  it('campo sem nada que valha some, em vez de viajar vazio ou cru', () => {
    const suja = { ...ficha('a'), conditions: ['nada disso'] as unknown as TokenCondition[] }
    expect('conditions' in tokenConditionsForPlayer(suja)).toBe(false)
  })
})

describe('conditionBadgeLayout — onde as marcas ficam, em cima da ficha', () => {
  const RAIO_DA_FICHA = 23
  const GRADE = 50

  it('sem condição, nenhuma marca', () => {
    expect(conditionBadgeLayout([], RAIO_DA_FICHA, GRADE).badges).toEqual([])
  })

  it('uma condição: a marca fica no alto da ficha, centrada, sentada na borda', () => {
    const { radius, badges } = conditionBadgeLayout(['envenenado'], RAIO_DA_FICHA, GRADE)
    expect(badges).toHaveLength(1)
    expect(badges[0].condition).toBe('envenenado')
    expect(badges[0].x).toBeCloseTo(0, 6)
    expect(badges[0].y).toBeCloseTo(-RAIO_DA_FICHA, 6)
    // Grande o bastante para ler o desenho, pequena o bastante para não tapar a ficha.
    expect(radius).toBeGreaterThanOrEqual(GRADE * 0.15)
    expect(radius).toBeLessThanOrEqual(RAIO_DA_FICHA / 2)
  })

  it('as cinco juntas: todas na metade de cima, simétricas, sem uma encostar na outra', () => {
    const { radius, badges } = conditionBadgeLayout(TOKEN_CONDITION_ORDER, RAIO_DA_FICHA, GRADE)
    expect(badges.map((b) => b.condition)).toEqual(TOKEN_CONDITION_ORDER)
    for (const b of badges) {
      expect(Math.hypot(b.x, b.y)).toBeCloseTo(RAIO_DA_FICHA, 6)
      expect(b.y).toBeLessThanOrEqual(1e-9)
    }
    for (let i = 1; i < badges.length; i += 1) {
      expect(Math.hypot(badges[i].x - badges[i - 1].x, badges[i].y - badges[i - 1].y)).toBeGreaterThanOrEqual(2 * radius)
    }
    const xs = badges.map((b) => b.x)
    expect(xs[0]).toBeCloseTo(-xs[4], 6)
    expect(xs[1]).toBeCloseTo(-xs[3], 6)
  })

  it('a marca acompanha a GRADE, não o tamanho da ficha: o dragão não ganha pastilha gigante', () => {
    const humano = conditionBadgeLayout(['dormindo'], 23, GRADE)
    const dragao = conditionBadgeLayout(['dormindo'], 73, GRADE)
    expect(dragao.radius).toBeCloseTo(humano.radius, 6)
    expect(dragao.badges[0].y).toBeCloseTo(-73, 6)
  })

  it('ficha minúscula encolhe a marca junto, em vez de a marca engolir a ficha', () => {
    const { radius } = conditionBadgeLayout(['caido'], 6, GRADE)
    expect(radius).toBeLessThanOrEqual(3)
    expect(radius).toBeGreaterThan(0)
  })

  it('raio de ficha inválido não desenha nada (sem NaN no Pixi)', () => {
    expect(conditionBadgeLayout(['caido'], Number.NaN, GRADE).badges).toEqual([])
    expect(conditionBadgeLayout(['caido'], 0, GRADE).badges).toEqual([])
  })
})
