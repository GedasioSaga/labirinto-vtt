// COMANDO DO VAZAMENTO — "nada do mestre atravessa o recorte do jogador, nem
// pelo campo que ninguém citou por nome".
//
// POR QUE ESTE ARQUIVO EXISTE. `fogFilter.test.ts` prova o recorte campo a
// campo, com o NOME de cada campo escrito à mão ('props', 'tokens',
// 'background'...). É prova boa para o passado e cega para o futuro:
// `lib/fogFilter.ts:383` monta o mapa do jogador com `{ ...map }` e só depois
// sobrescreve campo a campo, então TODA proteção é POR NOME. Qualquer lista
// nova em `MapData` (os pinos de ponto de interesse, por exemplo) atravessa
// inteira — sem filtro de `hidden`/`secret` e com o caminho do disco do
// mestre dentro — e a suíte fica verde sem nunca saber que ela existe.
//
// Os testes daqui não citam nome de campo NENHUM na varredura: eles caminham
// o JSON devolvido inteiro e denunciam o CAMINHO do campo que vazou.
import { describe, expect, it } from 'vitest'
import type {
  ConcealZone, Drawing, FloorPiece, Light, MapData, MapLine, MapMarker, Prop, Region, Stair, Token, Wall,
} from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

// ─────────────────────────────────────────────────────────────
// A VARREDURA (não conhece nome de campo nenhum)
// ─────────────────────────────────────────────────────────────

/** Formas de caminho de arquivo do disco do mestre que nunca podem sair pela rede. */
const PADROES_DE_CAMINHO: readonly { nome: string; re: RegExp }[] = [
  { nome: 'compartilhamento de rede (UNC)', re: /^\\\\[^\\]+\\/ },
  { nome: 'letra de unidade do Windows', re: /[A-Za-z]:[\\/]/ },
  { nome: 'URL de arquivo local', re: /file:\/\// },
  { nome: 'home de Linux', re: /\/home\// },
  { nome: 'home de macOS', re: /\/Users\// },
  { nome: 'pasta de aplicativo do Windows', re: /AppData/ },
]

interface Vazamento {
  /** Caminho DENTRO do JSON devolvido, ex.: `props[0].src`. */
  caminho: string
  motivo: string
}

/** ids que a ENTRADA marcou como `hidden: true` e/ou `secret: true`, com o rótulo do que foi marcado. */
function idsMarcadosNaEntrada(valor: unknown, encontrados = new Map<string, string>()): Map<string, string> {
  if (Array.isArray(valor)) {
    for (const item of valor) idsMarcadosNaEntrada(item, encontrados)
    return encontrados
  }
  if (valor === null || typeof valor !== 'object') return encontrados
  const obj = valor as Record<string, unknown>
  const marcas = [obj.hidden === true ? 'hidden' : '', obj.secret === true ? 'secret' : ''].filter((m) => m !== '')
  if (typeof obj.id === 'string' && marcas.length > 0) encontrados.set(obj.id, marcas.join('+'))
  for (const v of Object.values(obj)) idsMarcadosNaEntrada(v, encontrados)
  return encontrados
}

/** Caminha o recorte devolvido inteiro e devolve tudo que não podia estar lá, com o endereço. */
function varrerVazamentos(recorte: unknown, marcadosNaEntrada: ReadonlyMap<string, string>): Vazamento[] {
  const achados: Vazamento[] = []
  const visitar = (valor: unknown, caminho: string): void => {
    if (typeof valor === 'string') {
      const padrao = PADROES_DE_CAMINHO.find((p) => p.re.test(valor))
      if (padrao !== undefined) achados.push({ caminho, motivo: `caminho de disco do mestre (${padrao.nome}): ${valor}` })
      return
    }
    if (Array.isArray(valor)) {
      valor.forEach((item, i) => visitar(item, `${caminho}[${i}]`))
      return
    }
    if (valor === null || typeof valor !== 'object') return
    const obj = valor as Record<string, unknown>
    const marca = typeof obj.id === 'string' ? marcadosNaEntrada.get(obj.id) : undefined
    if (marca !== undefined) achados.push({ caminho, motivo: `item marcado ${marca} na entrada (id "${String(obj.id)}") saiu no recorte` })
    for (const [chave, v] of Object.entries(obj)) visitar(v, caminho === '' ? chave : `${caminho}.${chave}`)
  }
  visitar(recorte, '')
  return achados
}

const relatar = (achados: readonly Vazamento[]): string => achados.map((a) => `${a.caminho} — ${a.motivo}`).join('\n')

// ─────────────────────────────────────────────────────────────
// O MAPA DO MESTRE (toda lista de MapData, cada uma com item marcado)
// ─────────────────────────────────────────────────────────────

const DISCO_WINDOWS = 'C:\\Users\\mestre\\AppData\\Roaming\\labirinto\\maps\\m1\\token_x.webp'
const DISCO_LINUX = '/home/mestre/.local/share/labirinto/maps/m1/prop_altar.webp'
const DISCO_MAC = '/Users/mestre/Library/Application Support/labirinto/maps/m1/fundo.webp'
const DISCO_REDE = '\\\\servidor\\campanhas\\labirinto\\maps\\m1\\porta_secreta.webp'

/** Perto do token do jogador: fora da visão o item sumiria pela posição, e a marca `hidden`/`secret` nunca seria testada. */
const PERTO = { x: 200, y: 200 }
const LONGE = 1800
const RAIO_DE_VISAO = 240
const JOGADOR = 'jogador'
const POSSE = { [JOGADOR]: ['token_do_jogador'] }

// `blocksLight: false` em toda parede: a visão vira um círculo limpo de raio
// 240, então o que sai do recorte sai pela MARCA, não por sombra acidental.
function parede(id: string, x1: number, y1: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2: x1 + 20, y2: y1, blocksLight: false, blocksMove: true, door: null, ...extra }
}

function mapaCompletoDoMestre(): MapData {
  const tokens: Token[] = [
    { id: 'token_do_jogador', characterId: null, name: 'Herói', x: PERTO.x, y: PERTO.y, size: 1, image: DISCO_WINDOWS },
    { id: 'token_visivel', characterId: null, name: 'Aliado', x: 230, y: 200, size: 1, image: DISCO_LINUX },
    { id: 'token_oculto', characterId: null, name: 'Emboscada', x: 220, y: 180, size: 1, image: DISCO_WINDOWS, hidden: true },
    { id: 'token_secreto', characterId: null, name: 'Dragão', x: 180, y: 220, size: 1, image: DISCO_REDE, secret: true },
  ]
  const props: Prop[] = [
    { id: 'prop_visivel', src: DISCO_LINUX, x: 240, y: 210, width: 50, height: 50, linkedMapPath: DISCO_WINDOWS },
    { id: 'prop_oculto', src: DISCO_WINDOWS, x: 210, y: 230, width: 50, height: 50, linkedMapPath: null, hidden: true },
    { id: 'prop_secreto', src: DISCO_REDE, x: 190, y: 190, width: 50, height: 50, linkedMapPath: DISCO_MAC, secret: true },
  ]
  const regions: Region[] = [
    { id: 'regiao_visivel', points: quadrado(160, 160, 80), tag: 'sala', fillColor: '#444', fillPattern: 'solid', data: {} },
    { id: 'regiao_oculta', points: quadrado(170, 170, 60), tag: 'oculta', fillColor: '#444', fillPattern: 'solid', data: {}, hidden: true },
    { id: 'regiao_secreta', points: quadrado(180, 180, 40), tag: 'secreta', fillColor: '#444', fillPattern: 'solid', data: {}, secret: true },
  ]
  const stairs: Stair[] = [
    { id: 'escada_visivel', shape: 'straight', direction: 'up', segments: [{ x1: 205, y1: 205, x2: 245, y2: 205 }], stepWidth: 50 },
    { id: 'escada_oculta', shape: 'straight', direction: 'down', segments: [{ x1: 195, y1: 215, x2: 235, y2: 215 }], stepWidth: 50, hidden: true },
    { id: 'escada_secreta', shape: 'straight', direction: 'down', segments: [{ x1: 195, y1: 185, x2: 235, y2: 185 }], stepWidth: 50, secret: true },
  ]
  const drawings: Drawing[] = [
    { id: 'traco_visivel', kind: 'freehand', points: [{ x: 205, y: 195 }, { x: 225, y: 195 }], color: '#fff', width: 2 },
    { id: 'traco_secreto', kind: 'text', x: 215, y: 225, text: `nota do mestre: ${DISCO_WINDOWS}`, color: '#fff', fontSize: 12, secret: true },
  ]
  const lights: Light[] = [
    { id: 'luz_visivel', x: 215, y: 215, radius: 100, color: '#fff', intensity: 1 },
    { id: 'luz_oculta', x: 185, y: 185, radius: 100, color: '#fff', intensity: 1, hidden: true },
  ]
  const floor: FloorPiece[] = [
    { id: 'chao_visivel', shape: { kind: 'rect', cx: LONGE, cy: LONGE, w: 100, h: 100 }, op: 'add', modifiers: {} },
    { id: 'chao_oculto', shape: { kind: 'rect', cx: LONGE, cy: LONGE + 200, w: 100, h: 100 }, op: 'add', modifiers: {}, hidden: true },
  ]
  const lines: MapLine[] = [{ id: 'linha', points: [{ x: 205, y: 205 }, { x: 235, y: 205 }], closed: false, dotted: false, color: '#fff', width: 1 }]
  const markers: MapMarker[] = [{ id: 'marcador', cx: 220, cy: 220, w: 10, h: 4, rotation: 0, color: '#fff' }]
  const concealZones: ConcealZone[] = [{ id: 'zona', points: quadrado(LONGE - 400, LONGE - 400, 100), name: 'esconderijo do vilão', revealed: false }]

  return {
    ...createEmptyMap('m_vazamento', 'Cripta do mestre', 2000, 2000, 50),
    background: { type: 'image', src: DISCO_MAC },
    frame: { title: 'Cripta', x: 0, y: 0, w: 2000, h: 2000 },
    fog: { mode: 'per-token', revealed: ['celula_do_mestre'] },
    ownerId: 'mestre',
    scenarioLink: DISCO_WINDOWS,
    walls: [parede('parede_visivel', 205, 240), parede('parede_oculta', 195, 245, { hidden: true })],
    tokens, props, regions, stairs, drawings, lights, floor, lines, markers, concealZones,
  }
}

function quadrado(x: number, y: number, lado: number): { x: number; y: number }[] {
  return [{ x, y }, { x: x + lado, y }, { x: x + lado, y: y + lado }, { x, y: y + lado }]
}

/**
 * Listas de topo que NÃO são lista de entidade do mapa e por isso não entram na
 * fixture. Ausência aqui é a resposta certa, não esquecimento.
 */
const LISTA_QUE_NAO_E_ENTIDADE: Record<string, string> = {
  hiddenLayers: 'lista de ids de camada; preenchê-la esconderia por camada e mascararia o filtro por marca',
  lockedLayers: 'lista de ids de camada; trava edição no mestre, não tem recorte de jogador',
}

describe('recorte do jogador — nada do mestre atravessa, nem por campo sem nome', () => {
  it('o mapa do mestre não deixa lista de MapData sem item na fixture', () => {
    // Sentinela de cobertura: sem isto, uma lista NOVA em MapData entraria no
    // schema sem nunca passar pela varredura, e o teste abaixo continuaria
    // verde por não ter o que varrer.
    const referencia = createEmptyMap('m_ref', 'Referência', 100, 100, 50) as unknown as Record<string, unknown>
    const fixture = mapaCompletoDoMestre() as unknown as Record<string, unknown>
    const vazias = Object.keys(referencia).filter(
      (campo) => Array.isArray(referencia[campo]) && !(campo in LISTA_QUE_NAO_E_ENTIDADE) && (fixture[campo] as unknown[]).length === 0,
    )

    expect(
      vazias,
      `lista(s) de MapData sem item no mapa desta fixture: ${vazias.join(', ')}. ` +
        'Acrescente a esta fixture pelo menos um item visível, um com `hidden: true` e um com `secret: true` (quando o tipo aceitar), ' +
        'cada campo de imagem com caminho de disco do mestre — ou documente em LISTA_QUE_NAO_E_ENTIDADE.',
    ).toEqual([])
  })

  it('o recorte não leva caminho do disco do mestre nem item marcado hidden/secret', () => {
    const mapaDoMestre = mapaCompletoDoMestre()
    const marcados = idsMarcadosNaEntrada(mapaDoMestre)

    const { map: recorte } = filterMapForPlayer(mapaDoMestre, JOGADOR, POSSE, RAIO_DE_VISAO)
    const achados = varrerVazamentos(recorte, marcados)

    expect(
      achados,
      `vazou para o jogador:\n${relatar(achados)}\n` +
        'Em lib/fogFilter.ts o mapa do jogador é montado com `{ ...map }` e limpo campo a campo: campo novo atravessa sozinho. ' +
        'Acrescente a linha que filtra `hidden`/`secret` e apaga o caminho de arquivo dessa lista.',
    ).toEqual([])

    // Tônus: sem isto, um recorte que devolvesse tudo vazio passaria com louvor.
    expect(marcados.size, 'a fixture precisa ter item marcado para a varredura ter o que procurar').toBeGreaterThan(0)
    expect(recorte.tokens.map((t) => t.id)).toEqual(['token_do_jogador', 'token_visivel'])
    expect(recorte.props.map((p) => p.id)).toEqual(['prop_visivel'])
    expect(recorte.walls.map((w) => w.id)).toEqual(['parede_visivel'])
  })

  it('a varredura tem dente: ela REPROVA o mapa do mestre cru, sem recorte nenhum', () => {
    // Varredura que nunca reprova nada é decoração: o verde do teste acima só
    // vale porque este vermelho existe.
    const mapaDoMestre = mapaCompletoDoMestre()
    const achados = varrerVazamentos(mapaDoMestre, idsMarcadosNaEntrada(mapaDoMestre))
    const caminhos = achados.map((a) => a.caminho)

    expect(caminhos).toContain('background.src')
    expect(caminhos).toContain('tokens[0].image')
    expect(caminhos).toContain('props[0].linkedMapPath')
    expect(caminhos).toContain('tokens[2]') // token_oculto, marcado hidden
    expect(caminhos).toContain('regions[2]') // regiao_secreta, marcada secret
  })

  it('CONTROLE POSITIVO: a varredura pega lista nova que ninguém citou por nome — e ela vaza hoje', () => {
    // `__campoNovoDeTeste` faz o papel da próxima lista do schema (os pinos de
    // ponto de interesse, por exemplo). O `expect` abaixo descreve o
    // comportamento de HOJE: o recorte deixa a lista passar inteira.
    const comCampoNovo = {
      ...mapaCompletoDoMestre(),
      __campoNovoDeTeste: [{ id: 'pino_secreto', label: 'Entrada da cripta', src: DISCO_WINDOWS, hidden: true }],
    } as unknown as MapData
    const marcados = idsMarcadosNaEntrada(comCampoNovo)

    const { map: recorte } = filterMapForPlayer(comCampoNovo, JOGADOR, POSSE, RAIO_DE_VISAO)
    const achados = varrerVazamentos(recorte, marcados)

    expect(achados.map((a) => a.caminho)).toEqual(['__campoNovoDeTeste[0]', '__campoNovoDeTeste[0].src'])
    expect(
      relatar(achados),
      'Se isto ficou VERDE, a varredura enxerga campo que nenhum teste cita por nome — é o dente que falta em fogFilter.test.ts. ' +
        'Se ficou VERMELHO porque não vazou mais, alguém fechou o buraco de lib/fogFilter.ts: apague este caso e mova a lista para a fixture.',
    ).toContain('item marcado hidden na entrada (id "pino_secreto") saiu no recorte')
  })
})
