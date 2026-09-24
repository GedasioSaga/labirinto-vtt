import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { Drawing, MapData, Pin, Region, Token, Wall } from '../types/map'
import {
  currentObjectKey,
  filterMapObjects,
  isFindObjectShortcut,
  mapObjectKey,
  mapObjectOf,
  mapObjectsOf,
  MAP_OBJECT_GROUPS,
} from './mapObjects'

/**
 * LISTA DE OBJETOS DO MAPA, lado puro: o que a lista mostra (pelo nome, só da
 * cena aberta), a busca, o que o clique pode selecionar e onde a câmera vai.
 * A régua da tela é `e2e/task-jornada-lista-de-objetos.spec.ts`; esta cobra as
 * bordas que ela não mede (sem nome, camada travada, porta entre duas salas).
 */

function sala(id: string, nome: string, x1: number, y1: number, x2: number, y2: number, cor = '#1e8c8c'): Region {
  return {
    id,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
    tag: '',
    fillColor: cor,
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: nome },
  }
}

function porta(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' }, ...extra }
}

function pino(id: string, x: number, y: number, description: string, extra: Partial<Pin> = {}): Pin {
  return { id, x, y, kind: 'exclamacao', description, image: null, ...extra }
}

function ficha(id: string, name: string, x: number, y: number, color: string | null = null): Token {
  return { id, characterId: null, name, x, y, size: 1, image: null, color }
}

function texto(id: string, x: number, y: number, text: string): Drawing {
  return { id, kind: 'text', x, y, text, color: '#ffffff', fontSize: 20 }
}

function cena(extra: Partial<MapData>): MapData {
  return { ...createEmptyMap('map_salao', 'Salão', 40, 16, 50), ...extra }
}

/** A cena da régua: duas salas, a porta da Cripta, o baú, duas fichas e o aviso. */
const SALAO = cena({
  regions: [
    sala('r-entrada', 'Salão de Entrada', 100, 150, 600, 650),
    sala('r-cripta', 'Cripta', 1500, 200, 1850, 600, '#8c1e8c'),
    // Região comum (sem `room`): não é sala, não tem nome.
    { ...sala('r-mar', '', 0, 0, 2000, 800), room: undefined },
  ],
  walls: [
    porta('w-porta', 1500, 350, 1500, 450),
    // Parede sem porta: não entra na lista.
    { id: 'w-parede', x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: null },
  ],
  pins: [pino('p-bau', 1650, 250, 'Baú do tesouro')],
  drawings: [
    texto('t-aviso', 900, 100, 'Cuidado com o chão'),
    // Desenho que não é texto: não entra.
    { id: 'd-linha', kind: 'line', x1: 0, y1: 0, x2: 10, y2: 10, color: '#fff', width: 2 },
  ],
  tokens: [ficha('k-lanterna', 'Lanterna', 1250, 700, '#ff5a00'), ficha('k-heroi', 'Heroi', 250, 300)],
})

const nomes = (map: MapData) => mapObjectsOf(map).map((o) => [o.kind, o.name])

describe('mapObjectsOf — o que a lista mostra', () => {
  it('pelo nome: salas, portas, pinos, tokens e textos da cena, nessa ordem, e em ordem alfabética dentro de cada grupo', () => {
    expect(nomes(SALAO)).toEqual([
      ['room', 'Cripta'],
      ['room', 'Salão de Entrada'],
      ['door', 'Porta'],
      ['pin', 'Baú do tesouro'],
      ['token', 'Heroi'],
      ['token', 'Lanterna'],
      ['text', 'Cuidado com o chão'],
    ])
  })

  it('os grupos da tela seguem a mesma ordem, cada um com o nome que o app já usa', () => {
    expect(MAP_OBJECT_GROUPS.map((g) => [g.kind, g.label])).toEqual([
      ['room', 'Salas'],
      ['door', 'Portas'],
      ['pin', 'Pinos'],
      ['token', 'Tokens'],
      ['text', 'Textos'],
    ])
  })

  it('a chave de cada linha é tipo:id', () => {
    expect(mapObjectsOf(SALAO).map((o) => o.key)).toEqual([
      'room:r-cripta',
      'room:r-entrada',
      'door:w-porta',
      'pin:p-bau',
      'token:k-heroi',
      'token:k-lanterna',
      'text:t-aviso',
    ])
    expect(mapObjectKey('door', 'w-porta')).toBe('door:w-porta')
  })

  it('a porta diz de que sala ela é; entre duas salas, as duas', () => {
    expect(mapObjectOf(SALAO, 'door:w-porta')?.detail).toBe('Cripta')
    const corredor = cena({
      regions: [sala('r-a', 'Corredor', 0, 0, 500, 500), sala('r-b', 'Adega', 500, 0, 900, 500)],
      walls: [porta('w-meio', 500, 200, 500, 300)],
    })
    expect(mapObjectOf(corredor, 'door:w-meio')?.detail).toBe('Adega e Corredor')
    const solta = cena({ walls: [porta('w-solta', 3000, 3000, 3000, 3100)] })
    expect(mapObjectOf(solta, 'door:w-solta')?.detail).toBe('')
  })

  it('porta dupla e portão têm o nome do tipo', () => {
    const map = cena({
      walls: [
        porta('w-dupla', 0, 0, 100, 0, { door: { open: false, locked: false, kind: 'double' } }),
        porta('w-portao', 0, 50, 100, 50, { door: { open: false, locked: false, kind: 'gate' } }),
      ],
    })
    expect(nomes(map)).toEqual([
      ['door', 'Porta dupla'],
      ['door', 'Portão'],
    ])
  })

  it('sem nome, a linha diz o que é', () => {
    const map = cena({
      regions: [sala('r-x', '   ', 0, 0, 100, 100)],
      tokens: [ficha('k-x', '', 10, 10)],
      drawings: [texto('t-x', 0, 0, '  ')],
    })
    expect(nomes(map)).toEqual([
      ['room', 'Sala sem nome'],
      ['token', 'Token sem nome'],
      ['text', 'Texto vazio'],
    ])
  })

  it('pino sem descrição usa o resumo do pino; texto de várias linhas vira a primeira, e longo ganha reticências', () => {
    const longo = 'Um corredor que parece não terminar nunca, com tochas apagadas dos dois lados'
    const map = cena({
      pins: [pino('p-vazio', 0, 0, ''), pino('p-viagem', 10, 10, '', { kind: 'viagem' })],
      drawings: [texto('t-duas', 0, 0, 'Primeira linha\nSegunda linha'), texto('t-longo', 0, 50, longo)],
    })
    const pinos = mapObjectsOf(map).filter((o) => o.kind === 'pin').map((o) => o.name)
    expect(pinos).toEqual(['Pino de viagem', 'Ponto de interesse !'])
    const textos = mapObjectsOf(map).filter((o) => o.kind === 'text').map((o) => o.name)
    expect(textos).toContain('Primeira linha')
    const cortado = textos.find((t) => t.startsWith('Um corredor'))
    expect(cortado?.endsWith('…')).toBe(true)
    expect(cortado?.length).toBeLessThanOrEqual(60)
  })

  it('só a cena aberta: o mapa é a cena, então nada de fora dele aparece', () => {
    const torre = cena({ tokens: [ficha('k-guarda', 'Guarda da Torre', 1000, 400)] })
    expect(nomes(SALAO).some(([, nome]) => nome === 'Guarda da Torre')).toBe(false)
    expect(nomes(torre)).toEqual([['token', 'Guarda da Torre']])
  })
})

describe('mapObjectsOf — para onde a câmera vai', () => {
  it('sala: o meio da caixa, e a caixa inteira para caber na tela', () => {
    const cripta = mapObjectOf(SALAO, 'room:r-cripta')
    expect(cripta?.focus).toEqual({ x: 1675, y: 400 })
    expect(cripta?.bounds).toEqual({ minX: 1500, minY: 200, maxX: 1850, maxY: 600 })
  })

  it('token: o centro dele, com a caixa do tamanho na grade', () => {
    const lanterna = mapObjectOf(SALAO, 'token:k-lanterna')
    expect(lanterna?.focus).toEqual({ x: 1250, y: 700 })
    expect(lanterna?.bounds).toEqual({ minX: 1225, minY: 675, maxX: 1275, maxY: 725 })
  })

  it('porta: o meio do vão', () => {
    expect(mapObjectOf(SALAO, 'door:w-porta')?.focus).toEqual({ x: 1500, y: 400 })
  })

  it('pino: o meio do desenho (a cabeça fica acima da ponta cravada)', () => {
    const bau = mapObjectOf(SALAO, 'pin:p-bau')
    expect(bau?.focus.x).toBe(1650)
    expect(bau?.focus.y).toBeLessThan(250)
    expect(bau?.bounds.maxY).toBe(250)
  })

  it('texto: a caixa começa no ponto do texto e cresce para a direita e para baixo', () => {
    const aviso = mapObjectOf(SALAO, 'text:t-aviso')
    expect(aviso?.bounds.minX).toBe(900)
    expect(aviso?.bounds.minY).toBe(100)
    expect(aviso?.focus.x).toBeGreaterThan(900)
    expect(aviso?.focus.y).toBeGreaterThan(100)
  })

  it('a marca da linha: a cor do chão da sala e a do token; pino de viagem é marcado', () => {
    expect(mapObjectOf(SALAO, 'room:r-cripta')?.color).toBe('#8c1e8c')
    expect(mapObjectOf(SALAO, 'token:k-lanterna')?.color).toBe('#ff5a00')
    // Token sem cor própria: a cor de fábrica, a mesma do disco no mapa.
    expect(mapObjectOf(SALAO, 'token:k-heroi')?.color).toMatch(/^#[0-9a-f]{6}$/)
    const viagem = cena({ pins: [pino('p-v', 0, 0, 'Escada da torre', { kind: 'viagem' })] })
    expect(mapObjectOf(viagem, 'pin:p-v')?.travel).toBe(true)
    expect(mapObjectOf(SALAO, 'pin:p-bau')?.travel).toBe(false)
  })
})

describe('bloqueio: o que o clique da lista leva até lá mas não seleciona', () => {
  it('nada travado nem oculto: todos selecionáveis', () => {
    expect(mapObjectsOf(SALAO).every((o) => o.blockedReason === null)).toBe(true)
  })

  it('camada travada: a mesma regra do clique no mapa', () => {
    const map = { ...SALAO, lockedLayers: ['portas' as const, 'tokens' as const] }
    expect(mapObjectOf(map, 'door:w-porta')?.blockedReason).toBe('camada travada')
    expect(mapObjectOf(map, 'token:k-lanterna')?.blockedReason).toBe('camada travada')
    expect(mapObjectOf(map, 'room:r-cripta')?.blockedReason).toBeNull()
  })

  it('camada oculta', () => {
    const map = { ...SALAO, hiddenLayers: ['anotacoes' as const] }
    expect(mapObjectOf(map, 'pin:p-bau')?.blockedReason).toBe('camada oculta')
    expect(mapObjectOf(map, 'text:t-aviso')?.blockedReason).toBe('camada oculta')
  })

  it('parede travada não deixa selecionar a porta; pino oculto no editor também não', () => {
    const map = cena({ walls: [porta('w-t', 0, 0, 100, 0, { locked: true })], pins: [pino('p-o', 0, 0, 'Segredo', { hidden: true })] })
    expect(mapObjectOf(map, 'door:w-t')?.blockedReason).toBe('parede travada')
    expect(mapObjectOf(map, 'pin:p-o')?.blockedReason).toBe('oculto no editor')
  })

  it('sala travada e token travado continuam selecionáveis: é pelo painel que o mestre destrava', () => {
    const map = cena({ regions: [{ ...sala('r-t', 'Ilha', 0, 0, 100, 100), locked: true }], tokens: [{ ...ficha('k-t', 'Dragão', 0, 0), locked: true }] })
    expect(mapObjectOf(map, 'room:r-t')?.blockedReason).toBeNull()
    expect(mapObjectOf(map, 'token:k-t')?.blockedReason).toBeNull()
  })
})

describe('mapObjectOf', () => {
  it('objeto que saiu do mapa, ou chave que não é de objeto da lista, devolve null', () => {
    expect(mapObjectOf(SALAO, 'token:sumiu')).toBeNull()
    expect(mapObjectOf(SALAO, 'room:r-mar')).toBeNull()
    expect(mapObjectOf(SALAO, 'door:w-parede')).toBeNull()
    expect(mapObjectOf(SALAO, 'text:d-linha')).toBeNull()
    expect(mapObjectOf(SALAO, 'qualquer')).toBeNull()
  })
})

describe('filterMapObjects — a busca', () => {
  const todos = mapObjectsOf(SALAO)
  const achados = (busca: string) => filterMapObjects(todos, busca).map((o) => o.name)

  it('sem diferença de maiúscula: "crip" acha a Cripta (e a porta dela), e mais ninguém', () => {
    expect(achados('crip')).toEqual(['Cripta', 'Porta'])
    expect(achados('CRIP')).toEqual(['Cripta', 'Porta'])
  })

  it('sem diferença de acento: "salao" acha o Salão de Entrada; "chao" acha o aviso', () => {
    expect(achados('salao')).toEqual(['Salão de Entrada'])
    expect(achados('chao')).toEqual(['Cuidado com o chão'])
  })

  it('várias palavras precisam aparecer todas', () => {
    expect(achados('porta crip')).toEqual(['Porta'])
    expect(achados('porta entrada')).toEqual([])
  })

  it('busca vazia ou só espaços devolve a lista inteira', () => {
    expect(filterMapObjects(todos, '')).toEqual(todos)
    expect(filterMapObjects(todos, '   ')).toEqual(todos)
  })
})

describe('currentObjectKey — a linha marcada é a do objeto selecionado no editor', () => {
  it('sala, porta, token e texto selecionados; pino aberto no painel', () => {
    expect(currentObjectKey(SALAO, [{ kind: 'region', id: 'r-cripta' }], null)).toBe('room:r-cripta')
    expect(currentObjectKey(SALAO, [{ kind: 'wall', id: 'w-porta' }], null)).toBe('door:w-porta')
    expect(currentObjectKey(SALAO, [{ kind: 'token', id: 'k-heroi' }], null)).toBe('token:k-heroi')
    expect(currentObjectKey(SALAO, [{ kind: 'drawing', id: 't-aviso' }], null)).toBe('text:t-aviso')
    expect(currentObjectKey(SALAO, [], 'p-bau')).toBe('pin:p-bau')
  })

  it('o que não está na lista não marca nada: parede sem porta, região comum, desenho, vários, nada', () => {
    expect(currentObjectKey(SALAO, [{ kind: 'wall', id: 'w-parede' }], null)).toBeNull()
    expect(currentObjectKey(SALAO, [{ kind: 'region', id: 'r-mar' }], null)).toBeNull()
    expect(currentObjectKey(SALAO, [{ kind: 'drawing', id: 'd-linha' }], null)).toBeNull()
    expect(
      currentObjectKey(
        SALAO,
        [
          { kind: 'token', id: 'k-heroi' },
          { kind: 'token', id: 'k-lanterna' },
        ],
        null,
      ),
    ).toBeNull()
    expect(currentObjectKey(SALAO, [], null)).toBeNull()
    expect(currentObjectKey(SALAO, [], 'pino-que-sumiu')).toBeNull()
  })
})

describe('isFindObjectShortcut — Ctrl+K abre a busca', () => {
  const tecla = (over: Partial<Parameters<typeof isFindObjectShortcut>[0]>) =>
    isFindObjectShortcut({ key: 'k', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, targetTagName: 'BODY', ...over })

  it('Ctrl+K e Cmd+K, com ou sem Caps Lock', () => {
    expect(tecla({})).toBe(true)
    expect(tecla({ ctrlKey: false, metaKey: true })).toBe(true)
    expect(tecla({ key: 'K' })).toBe(true)
    // Foco num botão (ex.: a linha da lista) não é campo de texto.
    expect(tecla({ targetTagName: 'BUTTON' })).toBe(true)
  })

  it('K sozinho, com Shift ou Alt, ou digitando num campo de texto: não é o atalho', () => {
    expect(tecla({ ctrlKey: false })).toBe(false)
    expect(tecla({ shiftKey: true })).toBe(false)
    expect(tecla({ altKey: true })).toBe(false)
    expect(tecla({ key: 'j' })).toBe(false)
    expect(tecla({ targetTagName: 'INPUT' })).toBe(false)
    expect(tecla({ targetTagName: 'TEXTAREA' })).toBe(false)
  })
})
