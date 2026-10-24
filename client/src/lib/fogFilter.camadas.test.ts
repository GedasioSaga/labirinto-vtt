/**
 * CAMADAS NO HOST (fatia 2 de `docs/planos/camadas-fase3-2026-10-22.md`): o
 * recorte do jogador pergunta ao olho "Jogadores veem" de cada camada, em todo
 * tipo — chão, linha e marcador inclusive, que antes saíam pela rede e só a
 * tela do jogador escondia — e nada do modelo de camadas (os nomes das camadas
 * livres são segredo do mestre) atravessa. Mapa antigo sai como saía em
 * b934f2a1, menos o chão, a linha e o marcador da camada escondida.
 */
import { describe, expect, it } from 'vitest'
import type { CamadaId, CamadaPadraoId, LayerId, MapData, ModeloDeCamadas, PinceladaDeTextura, Region, TracoDePenhasco } from '../types/map'
import { CAMADAS_PADRAO, MODELO_PADRAO } from './camadas/padrao'
import { filterMapForGroup, filterMapForPlayer, planOfWholeMap, type PlayerMapView } from './fogFilter'
import { nuvensLigadas } from './nuvens'
import { relevoLigado } from './relevo'
import { CAMADA_NO_COMPLETO, MAPAS_COMPLETOS, MAPAS_CONGELADOS, OCULTAS_CONGELADAS, OCULTAS_DO_COMPLETO, mapaCompleto, mapaDeItens, recorteEmJson } from './__fixtures__/recorteDeCamadas'
import congeladoAndar6 from './__fixtures__/recorte-b934f2a1/andar6.json'
import congeladoCompleto from './__fixtures__/recorte-b934f2a1/completo.json'
import congeladoCompletoMemoria from './__fixtures__/recorte-b934f2a1/completo-memoria.json'
import congeladoItens from './__fixtures__/recorte-b934f2a1/itens.json'
import congeladoItensMemoria from './__fixtures__/recorte-b934f2a1/itens-memoria.json'
import congeladoL1 from './__fixtures__/recorte-b934f2a1/L1.json'
import congeladoTorre from './__fixtures__/recorte-b934f2a1/torre.json'

const JOGADOR = 'jogador'
const RAIO = 5000
const NOME_SECRETO = 'Segredo do Lich'
const NOME_DO_OLHO = 'Camada do olho'
const LIVRE: CamadaId = 'livre_16bcc5fe'
/** O olho do jogador mora numa camada livre que nunca se esconde: assim ele enxerga em todo caso, inclusive com Tokens oculta. */
const CAMADA_DO_OLHO: CamadaId = 'livre_ef17883c'
const MODELO: ModeloDeCamadas = { ordem: [...MODELO_PADRAO.ordem, { id: LIVRE, nome: NOME_SECRETO }, { id: CAMADA_DO_OLHO, nome: NOME_DO_OLHO }] }
const CHAVES_DO_MESTRE = ['modeloCamadas', 'ocultasDoJogador', 'opacidadeDasCamadas', 'versaoDasCamadas']

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

const TEXTURA: PinceladaDeTextura = { id: 'tx1', tipo: 'pincel', textura: 'grama', forca: 1, raio: 16, pontos: [{ x: 320, y: 360 }] }
const PENHASCO: TracoDePenhasco = { id: 'pn1', modo: 'riscar', raio: 16, pontos: [{ x: 360, y: 320 }] }

/** As listas do mapa com os ids dos itens de teste (`mapaDeItens`, com os de ponto movidos para o campo aberto). */
const IDS = {
  walls: ['w1', 'w2'],
  floor: ['f1'],
  regions: ['r1', 'casa'],
  stairs: ['s1'],
  lights: ['l1'],
  tokens: ['t1'],
  pins: ['p1'],
  props: ['o1', 'o2'],
  lines: ['ml1'],
  markers: ['mk1'],
  carimbos: ['c1'],
  drawings: ['d1', 'd2', 'd3'],
} as const
type Lista = keyof typeof IDS
const LISTAS: readonly Lista[] = ['walls', 'floor', 'regions', 'stairs', 'lights', 'tokens', 'pins', 'props', 'lines', 'markers', 'carimbos', 'drawings']
const TODOS_OS_IDS: readonly string[] = LISTAS.flatMap((lista) => IDS[lista])

/** O que sai quando a camada padrão está escondida e nenhum item escolheu camada. */
const CORTE_PADRAO: Record<CamadaPadraoId, readonly string[]> = {
  chao: ['f1'],
  salas: ['r1', 'casa'],
  desenhos: ['d1'],
  terreno: ['c1'],
  paredes: ['w1', 'ml1'],
  portas: ['w2', 'mk1'],
  escadas: ['s1'],
  objetos: ['o1'],
  decoracao: ['o2'],
  iluminacao: ['l1'],
  tokens: ['t1'],
  anotacoes: ['p1', 'd2', 'd3'],
  telhados: [],
}

/** Mapa da versão 2 com um item de cada tipo; `escolhida` põe TODOS os itens (e o telhado) nela. */
function mapaV2(ocultas: CamadaId[], escolhida?: CamadaId): MapData {
  const base = mapaDeItens()
  const naCamada = <T extends object>(item: T): T => (escolhida === undefined ? item : { ...item, camada: escolhida })
  const regions = base.regions.map((r): Region => {
    const comCamada = naCamada(r)
    return comCamada.room === undefined || escolhida === undefined ? comCamada : { ...comCamada, room: { ...comCamada.room, camadaDoTelhado: escolhida } }
  })
  return {
    ...base,
    walls: base.walls.map(naCamada),
    regions,
    stairs: base.stairs.map(naCamada),
    lights: base.lights.map((l) => naCamada({ ...l, x: 560, y: 320 })),
    tokens: base.tokens.map((t) => (t.id === 'olho' ? { ...t, x: 320, y: 320, camada: CAMADA_DO_OLHO } : naCamada({ ...t, x: 320, y: 560 }))),
    pins: (base.pins ?? []).map(naCamada),
    props: base.props.map(naCamada),
    floor: base.floor.map(naCamada),
    lines: base.lines.map(naCamada),
    markers: base.markers.map((m) => naCamada({ ...m, cx: 480, cy: 400 })),
    carimbos: (base.carimbos ?? []).map((c) => naCamada({ ...c, x: 400, y: 480 })),
    drawings: base.drawings.map(naCamada),
    texturas: [TEXTURA],
    penhascos: [PENHASCO],
    relevo: true,
    nuvens: true,
    hiddenLayers: ['salas'],
    ocultasDoJogador: ocultas,
    opacidadeDasCamadas: { [LIVRE]: 0.5, salas: 0.3 },
    versaoDasCamadas: 2,
    modeloCamadas: MODELO,
  }
}

/** O recorte de UM jogador e o da TELA DA MESA (`filterMapForGroup`), os dois com a planta inteira na memória. */
function recortes(map: MapData): [string, PlayerMapView][] {
  const remembered = planOfWholeMap(map)
  const doJogador = filterMapForPlayer(map, JOGADOR, { [JOGADOR]: ['olho'] }, RAIO, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, remembered)
  const daMesa = filterMapForGroup(map, [{ tokenIds: ['olho'], visionRadius: RAIO }], undefined, undefined, undefined, { remembered })
  return [['jogador', doJogador], ['mesa', daMesa]]
}

function idsNaLista(view: PlayerMapView, lista: Lista): string[] {
  const itens: readonly { id: string }[] = lista === 'carimbos' ? (view.map.carimbos ?? []) : lista === 'pins' ? (view.map.pins ?? []) : view.map[lista]
  // O olho é a ficha do próprio jogador, na camada dela: não é item de teste.
  return itens.map((item) => item.id).filter((id) => id !== 'olho')
}

/** Tudo o que o recorte entrega ao chamador, menos a memória da planta (`plan`), que fica no host. */
function textoDoRecorte(view: PlayerMapView): string {
  const { plan: _memoriaDoHost, ...vai } = view
  return JSON.stringify(vai)
}

function idsEntregues(view: PlayerMapView): string[] {
  return LISTAS.flatMap((lista) => idsNaLista(view, lista))
}

function semNadaDoModelo(view: PlayerMapView): void {
  const texto = textoDoRecorte(view)
  expect(texto).not.toContain(NOME_SECRETO)
  expect(texto).not.toContain(NOME_DO_OLHO)
  expect(texto).not.toContain(LIVRE)
  for (const chave of CHAVES_DO_MESTRE) expect(Object.keys(view.map)).not.toContain(chave)
}

function terrenoNoRecorte(view: PlayerMapView): Record<string, boolean> {
  return {
    texturas: (view.map.texturas ?? []).length > 0,
    penhascos: (view.map.penhascos ?? []).length > 0,
    relevo: view.map.relevo === true,
    nuvens: view.map.nuvens === true,
    ceuDasNuvens: view.map.ceuDasNuvens !== undefined,
  }
}

const TERRENO_TODO = { texturas: true, penhascos: true, relevo: true, nuvens: true, ceuDasNuvens: true }
const TERRENO_NENHUM = { texturas: false, penhascos: false, relevo: false, nuvens: false, ceuDasNuvens: false }

/** O terreno que sai com a camada `camada` escondida dos jogadores num mapa v2. */
function terrenoEsperado(camada: CamadaId): Record<string, boolean> {
  if (camada === 'terreno') return TERRENO_NENHUM
  // Chão escondido dos jogadores: o céu entregaria a caixa do chão escondido; nem céu nem nuvens.
  if (camada === 'chao') return { ...TERRENO_TODO, nuvens: false, ceuDasNuvens: false }
  return TERRENO_TODO
}

function telhadoDaCasa(view: PlayerMapView): boolean | undefined {
  return view.map.regions.find((r) => r.id === 'casa')?.room?.roof
}

describe('camada escondida só dos jogadores: nada dela chega ao jogador nem à tela da mesa', () => {
  it('controle: sem camada escondida, todo item de teste, o telhado e o terreno chegam', () => {
    for (const [quem, view] of recortes(mapaV2([]))) {
      expect(idsEntregues(view).sort(), quem).toEqual([...TODOS_OS_IDS].sort())
      expect(telhadoDaCasa(view), quem).toBe(true)
      expect(terrenoNoRecorte(view), quem).toEqual(TERRENO_TODO)
      semNadaDoModelo(view)
    }
  })

  for (const camada of [...CAMADAS_PADRAO, LIVRE]) {
    it(`todo item na camada "${camada}" escondida dos jogadores fica no host`, () => {
      const map = mapaV2([camada], camada)
      // Sem memória a lista do mapa vai inteira ao corte final (`recalledList`): o corte por camada tem de estar lá também.
      const semMemoria = filterMapForPlayer(map, JOGADOR, { [JOGADOR]: ['olho'] }, RAIO)
      for (const [quem, view] of [...recortes(map), ['jogador sem memória', semMemoria] as const]) {
        const texto = textoDoRecorte(view)
        for (const id of TODOS_OS_IDS) expect(texto, `${quem}: ${id}`).not.toContain(`"${id}"`)
        expect(idsEntregues(view), quem).toEqual([])
        expect(view.map.regions.some((r) => r.room?.roof === true), quem).toBe(false)
        expect(terrenoNoRecorte(view), quem).toEqual(terrenoEsperado(camada))
        semNadaDoModelo(view)
      }
    })
  }

  for (const camada of CAMADAS_PADRAO) {
    it(`sem camada escolhida, esconder "${camada}" dos jogadores corta só os itens dela`, () => {
      const cortados = CORTE_PADRAO[camada]
      for (const [quem, view] of recortes(mapaV2([camada]))) {
        expect(idsEntregues(view).sort(), quem).toEqual(TODOS_OS_IDS.filter((id) => !cortados.includes(id)).sort())
        if (camada === 'telhados') expect(telhadoDaCasa(view), quem).toBeUndefined()
        else if (camada !== 'salas') expect(telhadoDaCasa(view), quem).toBe(true)
        expect(terrenoNoRecorte(view), quem).toEqual(terrenoEsperado(camada))
        semNadaDoModelo(view)
      }
    })
  }

  it('mapa antigo com ocultasDoJogador: hiddenLayers do recorte é o olho "Jogadores veem" já resolvido, não o do mestre', () => {
    const { versaoDasCamadas: _versao, ...antigo } = mapaV2(['paredes', 'chao', LIVRE])
    for (const [quem, view] of recortes(antigo)) expect(view.map.hiddenLayers, quem).toEqual(['paredes'])
  })

  // Até a fatia 4 a tela do jogador lê `hiddenLayers` no sentido ANTIGO (chão some com 'salas', desenho com
  // 'anotacoes', parede sem olhar `camada`); o recorte não leva a versão, então no v2 a lista esconderia demais.
  it('mapa v2: hiddenLayers do recorte sai vazio (o host já cortou tudo)', () => {
    for (const [quem, view] of recortes(mapaV2(['paredes', 'chao', LIVRE]))) expect(view.map.hiddenLayers, quem).toEqual([])
  })

  it('mapa v2 com Salas escondida só dos jogadores e Chão à vista: o chão sai e hiddenLayers vai vazio', () => {
    const map: MapData = { ...mapaV2(['salas']), hiddenLayers: [] }
    for (const [quem, view] of recortes(map)) {
      expect(idsNaLista(view, 'floor'), quem).toEqual(['f1'])
      expect(idsNaLista(view, 'regions'), quem).toEqual([])
      expect(view.map.hiddenLayers, quem).toEqual([])
    }
  })

  it('camada livre escondida dos jogadores sem o modelo no mapa: nada dela sai (falha fechada)', () => {
    // Ninguém copia ainda o modelo da aventura para o mapa: sem ele, a livre cairia na padrão do tipo e sairia.
    const { modeloCamadas: _semModelo, ...map } = mapaV2([LIVRE], LIVRE)
    const semMemoria = filterMapForPlayer(map, JOGADOR, { [JOGADOR]: ['olho'] }, RAIO)
    for (const [quem, view] of [...recortes(map), ['jogador sem memória', semMemoria] as const]) {
      expect(idsEntregues(view), quem).toEqual([])
      expect(view.map.regions.some((r) => r.room?.roof === true), quem).toBe(false)
      semNadaDoModelo(view)
    }
  })

  it('camada livre desconhecida que NÃO está escondida dos jogadores: o item sai na padrão do tipo, sem o campo', () => {
    const { modeloCamadas: _semModelo, ...map } = mapaV2([LIVRE], 'livre_edd8d147')
    for (const [quem, view] of recortes(map)) {
      expect(idsEntregues(view).sort(), quem).toEqual([...TODOS_OS_IDS].sort())
      expect(JSON.stringify(view.map), quem).not.toContain('livre_edd8d147')
    }
  })

  it('camada torta ou livre que o modelo não tem não atravessa: o item sai na camada padrão, sem o campo', () => {
    const base = mapaV2([])
    const torta: unknown = 'Covil do Lich'
    const map: MapData = {
      ...base,
      walls: base.walls.map((w) => (w.id === 'w1' ? { ...w, camada: 'livre_d30eefbd' } : w)),
      floor: base.floor.map((f) => Object.assign({}, f, { camada: torta })),
    }
    for (const [quem, view] of recortes(map)) {
      expect(view.map.walls.find((w) => w.id === 'w1')?.camada, quem).toBeUndefined()
      expect(view.map.floor.find((f) => f.id === 'f1')?.camada, quem).toBeUndefined()
      expect(JSON.stringify(view.map), quem).not.toContain('Covil do Lich')
    }
  })
})

describe('terreno escondido dos jogadores no Continente', () => {
  // Sem a chave do mestre, o padrão do Continente é relevo e nuvens LIGADOS: `undefined` no recorte deixaria os dois ligados.
  for (const tipo of [{ continente: true }, { worldMap: true }] as const) {
    it(`relevo e nuvens saem desligados, explícitos (${Object.keys(tipo)[0]})`, () => {
      const { relevo: _relevo, nuvens: _nuvens, ...oculto } = mapaV2(['terreno'])
      for (const [quem, view] of recortes({ ...oculto, ...tipo })) {
        expect(relevoLigado(view.map), quem).toBe(false)
        expect(nuvensLigadas(view.map), quem).toBe(false)
        expect(view.map.ceuDasNuvens, quem).toBeUndefined()
      }
      // Controle: com Terreno à vista, o padrão do Continente liga os dois.
      const { relevo: _r, nuvens: _n, ...visivel } = mapaV2([])
      for (const [quem, view] of recortes({ ...visivel, ...tipo })) {
        expect(relevoLigado(view.map), quem).toBe(true)
        expect(nuvensLigadas(view.map), quem).toBe(true)
      }
    })
  }
})

describe('nuvens: o céu sai da caixa do chão que o jogador conhece', () => {
  const comNuvens = (campos: Partial<MapData>): MapData => ({ ...mapaDeItens(), nuvens: true, ...campos })
  const ceus = (map: MapData) => recortes(map).map(([quem, view]) => [quem, view.map.ceuDasNuvens] as const)
  const MAPA_INTEIRO = { x: 0, y: 0, largura: 640, altura: 640 }

  for (const tipo of [{}, { worldMap: true }] as const) {
    it(`mapa antigo com Salas escondida: o céu é o de sem nada escondido, não o retângulo do mapa${Object.keys(tipo).length > 0 ? ' (mapa-múndi)' : ''}`, () => {
      const semNada = ceus(comNuvens(tipo))
      for (const [quem, ceu] of semNada) {
        expect(ceu, quem).toBeDefined()
        expect(ceu, quem).not.toEqual(MAPA_INTEIRO)
      }
      expect(ceus(comNuvens({ ...tipo, hiddenLayers: ['salas'] }))).toEqual(semNada)
    })
  }

  it('mapa v2 com Chão escondido dos jogadores: nem céu nem nuvens', () => {
    for (const tipo of [{}, { worldMap: true }] as const) {
      for (const [quem, view] of recortes({ ...mapaV2(['chao']), ...tipo })) {
        expect(view.map.ceuDasNuvens, quem).toBeUndefined()
        expect(nuvensLigadas(view.map), quem).toBe(false)
      }
    }
  })

  it('mapa v2 com Salas escondida só dos jogadores e Chão à vista: o céu é a caixa do chão, como sem nada escondido', () => {
    const semNada = ceus(mapaV2([]))
    for (const [quem, ceu] of semNada) expect(ceu, quem).not.toEqual(MAPA_INTEIRO)
    expect(ceus({ ...mapaV2(['salas']), hiddenLayers: [] })).toEqual(semNada)
  })
})

const IDS_DO_COMPLETO = Object.keys(CAMADA_NO_COMPLETO).sort()

/** Os ids de `mapaCompleto` que o recorte entrega, em toda lista que a camada corta. */
function idsDoCompleto(view: PlayerMapView): string[] {
  const m = view.map
  const listas: readonly (readonly { id: string }[])[] = [m.walls, m.regions, m.floor, m.lines, m.markers, m.lights, m.stairs, m.props, m.tokens, m.pins ?? [], m.drawings, m.carimbos ?? []]
  return listas
    .flatMap((lista) => lista.map((item) => item.id))
    .filter((id) => id !== 'olho')
    .sort()
}

const SOZINHAS: readonly CamadaPadraoId[] = ['chao', 'salas', 'desenhos', 'terreno', 'paredes', 'portas', 'escadas', 'objetos', 'decoracao', 'iluminacao', 'tokens', 'anotacoes']
const OCULTAS_V2_DO_COMPLETO: readonly (readonly CamadaPadraoId[])[] = [
  [],
  ...SOZINHAS.map((camada) => [camada]),
  ['tokens', 'iluminacao'],
  ['objetos', 'decoracao'],
  ['chao', 'escadas'],
  ['paredes', 'portas'],
  ['desenhos', 'anotacoes'],
  ['salas', 'terreno'],
]

describe('mapa completo v2 (chão, linha, marcador, luz, nuvens, escada, objeto, decoração): o corte de cada camada', () => {
  for (const ocultas of OCULTAS_V2_DO_COMPLETO) {
    it(`escondidas dos jogadores: ${ocultas.length === 0 ? 'nenhuma (controle: tudo sai)' : ocultas.join(' + ')}`, () => {
      const base = mapaCompleto()
      // O olho mora em Telhados, que nenhum caso esconde: ele enxerga em todo caso, inclusive com Tokens escondida.
      const tokens = base.tokens.map((t) => (t.id === 'olho' ? { ...t, camada: 'telhados' as const } : t))
      const map: MapData = { ...base, tokens, versaoDasCamadas: 2, hiddenLayers: [], ocultasDoJogador: [...ocultas] }
      const esperados = IDS_DO_COMPLETO.filter((id) => !ocultas.includes(CAMADA_NO_COMPLETO[id]))
      const terrenoOculto = ocultas.includes('terreno')
      const ceu = !terrenoOculto && !ocultas.includes('chao')
      const semMemoria = filterMapForPlayer(map, JOGADOR, { [JOGADOR]: ['olho'] }, RAIO)
      for (const [quem, view] of [...recortes(map), ['jogador sem memória', semMemoria] as const]) {
        expect(idsDoCompleto(view), quem).toEqual(esperados)
        expect(view.map.hiddenLayers, quem).toEqual([])
        expect(relevoLigado(view.map), quem).toBe(!terrenoOculto)
        expect(nuvensLigadas(view.map), quem).toBe(ceu)
        expect(view.map.ceuDasNuvens !== undefined, quem).toBe(ceu)
      }
    })
  }
})

const CONGELADOS: Record<string, Record<string, unknown>> = {
  L1: congeladoL1,
  andar6: congeladoAndar6,
  torre: congeladoTorre,
  itens: congeladoItens,
  'itens-memoria': congeladoItensMemoria,
}

/** Chão, linha e marcador da camada escondida: o código de antes mandava (a tela do jogador só não desenhava); agora o host corta. */
const CORTADOS_AGORA = new Map([
  ['salas', 'floor'],
  ['paredes', 'lines'],
  ['portas', 'markers'],
])

function mapaDoRecorte(view: unknown): Record<string, unknown> {
  if (!ehRegistro(view) || !ehRegistro(view.map)) throw new Error('recorte sem mapa')
  return view.map
}

/** A memória da planta (`plan`) da lista `chave`, como `recorteEmJson` a escreve: `{ mapa: [[id, item], ...] }`. */
function idsNoPlano(view: unknown, chave: string): unknown[] {
  if (!ehRegistro(view) || !ehRegistro(view.plan)) throw new Error('recorte sem plano')
  const lista = view.plan[chave]
  if (!ehRegistro(lista) || !Array.isArray(lista.mapa)) throw new Error(`plano sem ${chave}`)
  return lista.mapa.map((par: unknown) => (Array.isArray(par) ? par[0] : par))
}

/** O recorte sem a lista `chave` no mapa e na memória da planta. */
function semCampoDoMapa(view: unknown, chave: string): unknown {
  if (!ehRegistro(view) || !ehRegistro(view.plan)) throw new Error('recorte sem mapa')
  const { [chave]: _cortado, ...resto } = mapaDoRecorte(view)
  const { [chave]: _naMemoria, ...planoSemChave } = view.plan
  return { ...view, map: resto, plan: planoSemChave }
}

describe('mapa antigo: o recorte é o de b934f2a1', () => {
  for (const caso of MAPAS_CONGELADOS) {
    for (const [nome, ocultas] of Object.entries(OCULTAS_CONGELADAS)) {
      it(`${caso.nome}, oculta: ${nome}`, () => {
        const congelado = CONGELADOS[caso.nome][nome]
        const agora = recorteEmJson(caso, ocultas)
        const chave = CORTADOS_AGORA.get(nome)
        if (chave === undefined) {
          expect(agora).toStrictEqual(congelado)
          return
        }
        // A exceção: a lista da camada escondida sai vazia; todo o resto é o de antes.
        expect(mapaDoRecorte(agora)[chave]).toEqual([])
        expect(semCampoDoMapa(agora, chave)).toStrictEqual(semCampoDoMapa(congelado, chave))
        // Na memória da planta, nada novo: o que não saiu não foi visto. O que ele já lembrava continua lá.
        const antes = idsNoPlano(congelado, chave)
        for (const id of idsNoPlano(agora, chave)) expect(antes).toContain(id)
        if (caso.memoria) expect(idsNoPlano(agora, chave)).toEqual(antes)
      })
    }
  }

  it('a exceção morde: o código de antes mandava o chão, a linha e o marcador com a camada escondida', () => {
    expect(mapaDoRecorte(CONGELADOS.itens.salas).floor).toHaveLength(1)
    expect(mapaDoRecorte(CONGELADOS.itens.paredes).lines).toHaveLength(1)
    expect(mapaDoRecorte(CONGELADOS['itens-memoria'].portas).markers).toHaveLength(1)
  })
})

const CONGELADOS_COMPLETOS: Record<string, Record<string, unknown>> = {
  completo: congeladoCompleto,
  'completo-memoria': congeladoCompletoMemoria,
}

/** Chão, linha e marcador: a lista que o host passou a cortar com a camada escondida (o resto é o de antes). */
const CORTE_NOVO_NO_ANTIGO: Partial<Record<LayerId, string>> = { salas: 'floor', paredes: 'lines', portas: 'markers' }

/** O recorte sem as listas `chaves` no mapa e na memória da planta. */
function semCampos(view: unknown, chaves: readonly string[]): unknown {
  if (!ehRegistro(view) || !ehRegistro(view.plan)) throw new Error('recorte sem plano')
  const mapa: Record<string, unknown> = { ...mapaDoRecorte(view) }
  const plano: Record<string, unknown> = { ...view.plan }
  for (const chave of chaves) {
    delete mapa[chave]
    delete plano[chave]
  }
  return { ...view, map: mapa, plan: plano }
}

describe('mapa completo antigo: o recorte é o de b934f2a1, menos chão, linha e marcador da camada escondida', () => {
  for (const caso of MAPAS_COMPLETOS) {
    for (const [nome, ocultas] of Object.entries(OCULTAS_DO_COMPLETO)) {
      it(`${caso.nome}, oculta: ${nome}`, () => {
        const congelado = CONGELADOS_COMPLETOS[caso.nome][nome]
        const agora = recorteEmJson(caso, ocultas)
        const chaves = ocultas.flatMap((camada) => CORTE_NOVO_NO_ANTIGO[camada] ?? [])
        for (const chave of chaves) expect(mapaDoRecorte(agora)[chave], chave).toEqual([])
        expect(semCampos(agora, chaves)).toStrictEqual(semCampos(congelado, chaves))
        for (const chave of chaves) {
          const antes = idsNoPlano(congelado, chave)
          for (const id of idsNoPlano(agora, chave)) expect(antes, chave).toContain(id)
          if (caso.memoria) expect(idsNoPlano(agora, chave), chave).toEqual(antes)
        }
      })
    }
  }

  it('o congelado morde: sem nada escondido, chão, linha, marcador, luz, escada, objetos, fichas e céu saíam', () => {
    for (const nome of ['completo', 'completo-memoria']) {
      const mapa = mapaDoRecorte(CONGELADOS_COMPLETOS[nome].nenhuma)
      for (const lista of ['floor', 'lines', 'markers', 'lights', 'stairs', 'props', 'tokens', 'drawings']) {
        const itens = mapa[lista]
        expect(Array.isArray(itens) && itens.length > 0, `${nome}: ${lista}`).toBe(true)
      }
      expect(mapa.ceuDasNuvens, nome).toBeDefined()
      expect(mapa.ceuDasNuvens, nome).not.toEqual({ x: 0, y: 0, largura: 1280, altura: 1280 })
    }
  })
})
