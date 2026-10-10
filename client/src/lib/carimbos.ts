import type { Carimbo, CarimboImportado, MapData, RegionPoint } from '../types/map'
import { pisoLido } from './pisos'

/**
 * CARIMBOS (fatia 5 do plano do relevo de 09/10/2026): a ferramenta em que o
 * mestre solta objetos no mapa — pinheiro, árvore, palmeira, pedras, poça...
 * Um clique solta um; segurar e arrastar ESPALHA vários (spray com espaço,
 * tamanho e giro variados, densidade escolhida); a borracha tira.
 *
 * Ao contrário da textura (que guarda os passos e pinta de novo), aqui cada
 * objeto É o dado (`MapData.carimbos`): base, tamanho e giro. Fica parado onde
 * foi posto; o sorteio do spray acontece UMA vez, no gesto do mestre, e o
 * mapa guarda o resultado — toda tela desenha o mesmo, sem semente.
 *
 * Folha de propósito (só tipos): o `fogFilter` importa daqui. O desenho dos
 * objetos mora em `src/carimbos/` e o palco em `pixi/drawCarimbos.ts`.
 */

/** O que o PRÓXIMO gesto da ferramenta faz (preferência da ferramenta, fora do map.json). */
export type ModoDoCarimbo = 'carimbo' | 'borracha'

/** O que o soltar do gesto fez, para a tela dizer quando não fez (ou fez só em parte). */
export type ResultadoDoCarimbo =
  | 'carimbou'
  | 'apagou'
  /** Borracha onde não há objeto nenhum. */
  | 'nada-a-apagar'
  /** O carimbo escolhido não existe nesta cena (importado de outra cena ou desfeito, pacote que saiu): nada gravado. */
  | 'tipo-ausente'
  /** A cena chegou ao teto (`TETO_DE_CARIMBOS`): entrou só o que cabia. */
  | 'teto'

/** Tamanho do objeto, em % do tamanho natural dele no mapa (`tamanhoNatural`). */
export const TAMANHO_DO_CARIMBO_MIN = 40
export const TAMANHO_DO_CARIMBO_MAX = 250
export const TAMANHO_DO_CARIMBO_PADRAO = 100

/**
 * Largura do spray (e da borracha): o DIÂMETRO em px do protótipo do relevo,
 * como o pincel de textura — cresce com o mapa, e o mesmo número cobre a
 * mesma fração do continente em qualquer mapa.
 */
export const LARGURA_DO_SPRAY_MIN = 10
export const LARGURA_DO_SPRAY_MAX = 200
export const LARGURA_DO_SPRAY_PADRAO = 48

/** Densidade do spray: 10% = objetos soltos, 100% = copas encostadas. */
export const DENSIDADE_MIN = 0.1
export const DENSIDADE_MAX = 1
export const DENSIDADE_PADRAO = 0.5

/**
 * Teto de objetos por cena. Cada um viaja no mapa do jogador a cada mensagem
 * (~75 bytes): 5.000 já são ~370 KB, e o celular fraco desenha todos. O teto
 * existe para o mapa não crescer sem limite num spray esquecido apertado.
 */
export const TETO_DE_CARIMBOS = 5000

/** Num mapa pequeno de masmorra, o objeto natural nunca fica menor que esta fração da célula. */
const TAMANHO_MINIMO_EM_CELULAS = 0.8

/** Variação do spray em volta do tamanho escolhido (±18%): a mata não sai de árvores clonadas. */
const VARIACAO_DO_SPRAY = 0.18
/** Variação de um carimbo solto por clique (±6%): perto do escolhido, mas dois cliques não saem iguais. */
const VARIACAO_DO_CLIQUE = 0.06

export function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor))
}

/**
 * O lado natural do objeto no mundo, em px: o tamanho dele no protótipo do
 * relevo vezes a `unidade` do mapa (`unidadeDoRelevo`), nunca menor que um
 * tanto da célula, vezes a escolha do mestre (%).
 */
export function tamanhoNatural(unidade: number, grid: number, tamanhoNoPrototipo: number, escolhaPct: number): number {
  const natural = Math.max(tamanhoNoPrototipo * unidade, TAMANHO_MINIMO_EM_CELULAS * grid)
  return (natural * limitar(escolhaPct, TAMANHO_DO_CARIMBO_MIN, TAMANHO_DO_CARIMBO_MAX)) / 100
}

/** Raio do spray (e da borracha) em px de mundo. */
export function raioDoSpray(unidade: number, largura: number): number {
  return (limitar(largura, LARGURA_DO_SPRAY_MIN, LARGURA_DO_SPRAY_MAX) * unidade) / 2
}

/**
 * Distância mínima entre dois objetos do spray, em frações do tamanho médio
 * deles: 2,4 na densidade mínima (soltos no campo), 0,62 na máxima (as copas
 * se cobrem um pouco, como na mata fechada do protótipo Diorama).
 */
export function fatorDeEspaco(densidade: number): number {
  const t = (limitar(densidade, DENSIDADE_MIN, DENSIDADE_MAX) - DENSIDADE_MIN) / (DENSIDADE_MAX - DENSIDADE_MIN)
  return 2.4 + (0.62 - 2.4) * t
}

/** O desenho a usar entre os oito que cada objeto da biblioteca tem (um a cada 45°). */
export function varianteDoGiro(giro: number): number {
  return ((Math.round(giro / 45) % 8) + 8) % 8
}

/** Giro guardado: inteiro de 0 a 359. */
export function normalizarGiro(giro: number): number {
  const g = Math.round(giro) % 360
  return g < 0 ? g + 360 : g
}

// ---------------------------------------------------------------------------
// Ids

/** Prefixo do id de carimbo importado. O dois-pontos não cabe no id do pacote nem da biblioteca. */
export const PREFIXO_IMPORTADO = 'importado:'

const ID_DA_BIBLIOTECA = /^[a-z0-9-]{1,40}$/
const ID_IMPORTADO = /^importado:[a-z0-9-]{1,40}$/
/** Id do objeto: curto de propósito (vai ao jogador a cada mensagem). */
const ID_DO_OBJETO = /^[A-Za-z0-9_-]{1,40}$/

/** Tipo que um carimbo pode ter: da biblioteca/pacote (`a-z0-9-`) ou importado (`importado:...`). */
export function ehTipoDeCarimbo(valor: unknown): valor is string {
  return typeof valor === 'string' && (ID_DA_BIBLIOTECA.test(valor) || ID_IMPORTADO.test(valor))
}

export function ehTipoImportado(tipo: string): boolean {
  return tipo.startsWith(PREFIXO_IMPORTADO)
}

/** Id novo de objeto: 12 letras do UUID bastam para uma cena (5.000 objetos no teto). */
export function novoIdDeCarimbo(): string {
  return `c${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

// ---------------------------------------------------------------------------
// Leitura do disco (o arquivo não é confiável: map.json editado à mão, versão futura)

function numeroFinito(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

function lerCarimbo(valor: unknown): Carimbo | null {
  if (typeof valor !== 'object' || valor === null) return null
  const id = 'id' in valor ? valor.id : undefined
  const tipo = 'tipo' in valor ? valor.tipo : undefined
  const x = 'x' in valor ? valor.x : undefined
  const y = 'y' in valor ? valor.y : undefined
  const tamanho = 'tamanho' in valor ? valor.tamanho : undefined
  const giro = 'giro' in valor ? valor.giro : 0
  if (typeof id !== 'string' || !ID_DO_OBJETO.test(id) || !ehTipoDeCarimbo(tipo)) return null
  if (!numeroFinito(x) || !numeroFinito(y) || !numeroFinito(tamanho) || tamanho <= 0) return null
  return { id, tipo, x, y, tamanho, giro: numeroFinito(giro) ? normalizarGiro(giro) : 0, ...pisoLido(valor) }
}

/** Os objetos do arquivo, ou `undefined` (sem o campo). Objeto quebrado ou repetido sai; o resto fica na ordem. */
export function lerCarimbos(valor: unknown): Carimbo[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const lista: Carimbo[] = []
  const vistos = new Set<string>()
  for (const item of valor) {
    if (lista.length >= TETO_DE_CARIMBOS) break
    const carimbo = lerCarimbo(item)
    if (carimbo === null || vistos.has(carimbo.id)) continue
    vistos.add(carimbo.id)
    lista.push(carimbo)
  }
  return lista.length > 0 ? lista : undefined
}

/** Nome de carimbo: o que aparece debaixo da miniatura. */
export const NOME_DE_CARIMBO_MAX = 40

/** Imagem importada embutida: só base64, nunca caminho de disco nem endereço de fora. */
const IMAGEM_EMBUTIDA = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/

/** Teto da imagem importada, em caracteres (a imagem sai com no máximo `LADO_DO_IMPORTADO` px em WebP). */
export const IMAGEM_DO_CARIMBO_MAX_CHARS = 400_000

export function ehImagemDeCarimboImportado(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length <= IMAGEM_DO_CARIMBO_MAX_CHARS && IMAGEM_EMBUTIDA.test(valor)
}

/** O nome limpo: espaços nas pontas fora, até `NOME_DE_CARIMBO_MAX`; vazio vira "Carimbo". */
export function nomeDoCarimbo(nome: string): string {
  const limpo = nome.replace(/\s+/g, ' ').trim().slice(0, NOME_DE_CARIMBO_MAX)
  return limpo === '' ? 'Carimbo' : limpo
}

/** Os carimbos importados do arquivo, ou `undefined`. O quebrado (sem imagem embutida válida) sai. */
export function lerCarimbosImportados(valor: unknown): CarimboImportado[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const lista: CarimboImportado[] = []
  const vistos = new Set<string>()
  for (const item of valor) {
    if (typeof item !== 'object' || item === null || !('id' in item) || !('nome' in item) || !('imagem' in item)) continue
    const { id, nome, imagem } = item
    if (typeof id !== 'string' || !ID_IMPORTADO.test(id) || vistos.has(id)) continue
    if (typeof nome !== 'string' || !ehImagemDeCarimboImportado(imagem)) continue
    vistos.add(id)
    lista.push({ id, nome: nomeDoCarimbo(nome), imagem })
  }
  return lista.length > 0 ? lista : undefined
}

// ---------------------------------------------------------------------------
// O mapa

/** O mapa com estes objetos. Lista vazia tira o campo (o mapa volta a ser o de antes dos carimbos). */
export function comCarimbos(map: MapData, lista: readonly Carimbo[]): MapData {
  if (lista.length > 0) return { ...map, carimbos: [...lista] }
  if (map.carimbos === undefined) return map
  const { carimbos: _semCarimbos, ...resto } = map
  return resto
}

/** O mapa com estes importados. Lista vazia tira o campo. */
export function comCarimbosImportados(map: MapData, lista: readonly CarimboImportado[]): MapData {
  if (lista.length > 0) return { ...map, carimbosImportados: [...lista] }
  if (map.carimbosImportados === undefined) return map
  const { carimbosImportados: _semImportados, ...resto } = map
  return resto
}

/** Tira um carimbo importado e os objetos dele (o chão debaixo volta a aparecer). */
export function semCarimboImportado(map: MapData, id: string): MapData {
  const importados = map.carimbosImportados ?? []
  if (!importados.some((c) => c.id === id)) return map
  const objetos = (map.carimbos ?? []).filter((c) => c.tipo !== id)
  return comCarimbos(comCarimbosImportados(map, importados.filter((c) => c.id !== id)), objetos)
}

/** Os tipos que os objetos usam. */
export function tiposUsados(lista: readonly Carimbo[] | undefined): Set<string> {
  return new Set((lista ?? []).map((c) => c.tipo))
}

/** Mesmos objetos, campo a campo (o mapa do jogador chega em referências novas a cada mensagem). */
export function mesmosCarimbos(a: readonly Carimbo[] | undefined, b: readonly Carimbo[] | undefined): boolean {
  if (a === b) return true
  if (a === undefined || b === undefined || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const p = a[i]
    const q = b[i]
    if (p !== q && (p.id !== q.id || p.tipo !== q.tipo || p.x !== q.x || p.y !== q.y || p.tamanho !== q.tamanho || p.giro !== q.giro)) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Borracha

function distanciaAoSegmento(p: RegionPoint, a: RegionPoint, b: RegionPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const comprimento2 = dx * dx + dy * dy
  const t = comprimento2 === 0 ? 0 : limitar(((p.x - a.x) * dx + (p.y - a.y) * dy) / comprimento2, 0, 1)
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** A distância do ponto ao caminho (um ponto só é um toque). */
function distanciaAoCaminho(p: RegionPoint, caminho: readonly RegionPoint[]): number {
  if (caminho.length === 1) return Math.hypot(p.x - caminho[0].x, p.y - caminho[0].y)
  let menor = Infinity
  for (let i = 1; i < caminho.length; i++) menor = Math.min(menor, distanciaAoSegmento(p, caminho[i - 1], caminho[i]))
  return menor
}

/**
 * Os ids dos objetos debaixo da borracha: a base a menos de um raio do
 * caminho, com um terço do tamanho do objeto de folga — a borracha que passa
 * na copa de uma árvore grande a tira, mesmo sem tocar no tronco.
 */
export function idsDebaixoDaBorracha(lista: readonly Carimbo[] | undefined, caminho: readonly RegionPoint[], raio: number): Set<string> {
  const ids = new Set<string>()
  if (lista === undefined || caminho.length === 0) return ids
  for (const c of lista) if (distanciaAoCaminho(c, caminho) <= raio + c.tamanho / 3) ids.add(c.id)
  return ids
}

// ---------------------------------------------------------------------------
// Spray

/** Sorteio de 0 a 1 (o gesto usa `Math.random`; o teste passa um fixo). */
export type Sorteio = () => number

export interface OpcoesDoSpray {
  tipo: string
  /** O tamanho escolhido, já no mundo (`tamanhoNatural`). */
  tamanho: number
  /** Raio do spray no mundo (`raioDoSpray`). */
  raio: number
  densidade: number
  /** Os objetos que já estão no mapa: o spray não os cobre. */
  existentes: readonly Carimbo[]
  /** Onde o spray pode soltar (a costa: começou na terra, só põe na terra). Sem ela, em qualquer lugar. */
  aceita?: (p: RegionPoint) => boolean
  sorteio?: Sorteio
  novoId?: () => string
  /** Quantos objetos este gesto ainda pode soltar (o teto da cena menos o que já há). */
  vagas?: number
}

export interface Spray {
  /** Solta o primeiro objeto, no ponto exato (o clique), e começa o caminho ali. */
  comecar: (ponto: RegionPoint) => Carimbo | null
  /** O ponteiro andou até aqui: espalha pelo trecho e devolve os que nasceram agora. */
  passar: (ponto: RegionPoint) => Carimbo[]
  /** Todos os que este gesto soltou, na ordem. */
  soltos: () => readonly Carimbo[]
  /** O spray já soltou alguma coisa além do clique? */
  espalhou: () => boolean
}

/** Tentativas de lugar por ponto do caminho: poucas, e o arrasto repetido enche o que faltou. */
const TENTATIVAS_POR_PASSO = 5

/**
 * O SPRAY: um sorteio de pontos dentro do disco do spray, a cada pedaço do
 * caminho, aceitando só os que ficam longe o bastante de todos os objetos
 * (os do mapa e os que o gesto já soltou). Passar de novo no mesmo lugar
 * completa o que faltou, até a densidade escolhida — como uma lata de tinta.
 * Uma grade de baldes deixa a conferência perto de constante por ponto, para
 * mil objetos não pesarem no arrasto.
 */
export function criarSpray(opcoes: OpcoesDoSpray): Spray {
  const sorteio = opcoes.sorteio ?? Math.random
  const novoId = opcoes.novoId ?? novoIdDeCarimbo
  const fator = fatorDeEspaco(opcoes.densidade)
  // O maior tamanho que um objeto deste gesto pode ter define o balde: os
  // vizinhos que importam nunca estão a mais de um balde de distância.
  const maiorTamanho = Math.max(opcoes.tamanho * (1 + VARIACAO_DO_SPRAY), ...opcoes.existentes.map((c) => c.tamanho))
  const lado = Math.max(1, maiorTamanho * fator)
  const baldes = new Map<string, Carimbo[]>()
  const chave = (ix: number, iy: number) => `${ix},${iy}`
  const guardar = (c: Carimbo) => {
    const k = chave(Math.floor(c.x / lado), Math.floor(c.y / lado))
    const balde = baldes.get(k)
    if (balde === undefined) baldes.set(k, [c])
    else balde.push(c)
  }
  for (const c of opcoes.existentes) guardar(c)

  const soltos: Carimbo[] = []
  let vagas = opcoes.vagas ?? Infinity
  let ultimo: RegionPoint | null = null
  let espalhou = false

  const cabe = (p: RegionPoint, tamanho: number): boolean => {
    const ix = Math.floor(p.x / lado)
    const iy = Math.floor(p.y / lado)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const c of baldes.get(chave(ix + dx, iy + dy)) ?? []) {
          if (Math.hypot(c.x - p.x, c.y - p.y) < (fator * (c.tamanho + tamanho)) / 2) return false
        }
      }
    }
    return true
  }

  const criar = (p: RegionPoint, variacao: number): Carimbo => ({
    id: novoId(),
    tipo: opcoes.tipo,
    x: Math.round(p.x),
    y: Math.round(p.y),
    tamanho: Math.round(opcoes.tamanho * (1 + (sorteio() * 2 - 1) * variacao) * 10) / 10,
    giro: normalizarGiro(sorteio() * 360),
  })

  const tentarEm = (centro: RegionPoint, nascidos: Carimbo[]) => {
    for (let i = 0; i < TENTATIVAS_POR_PASSO && vagas > 0; i++) {
      // Ponto uniforme no disco (raiz do sorteio: sem amontoar no meio).
      const angulo = sorteio() * Math.PI * 2
      const distancia = Math.sqrt(sorteio()) * opcoes.raio
      const p = { x: centro.x + Math.cos(angulo) * distancia, y: centro.y + Math.sin(angulo) * distancia }
      if (opcoes.aceita !== undefined && !opcoes.aceita(p)) continue
      const novo = criar(p, VARIACAO_DO_SPRAY)
      if (!cabe(novo, novo.tamanho)) continue
      guardar(novo)
      soltos.push(novo)
      nascidos.push(novo)
      vagas -= 1
      espalhou = true
    }
  }

  return {
    comecar: (ponto) => {
      ultimo = ponto
      if (vagas <= 0) return null
      // O clique solta onde o mestre apontou, sem conferir o espaço: é a escolha dele.
      const primeiro = criar(ponto, VARIACAO_DO_CLIQUE)
      guardar(primeiro)
      soltos.push(primeiro)
      vagas -= 1
      return primeiro
    },
    passar: (ponto) => {
      const nascidos: Carimbo[] = []
      const de = ultimo ?? ponto
      const distancia = Math.hypot(ponto.x - de.x, ponto.y - de.y)
      // Um pedaço a cada ~um terço do raio: o disco varre o caminho sem buraco.
      const passo = Math.max(1, opcoes.raio / 3)
      if (distancia < passo && ultimo !== null) return nascidos
      const pedacos = Math.max(1, Math.ceil(distancia / passo))
      for (let i = 1; i <= pedacos && vagas > 0; i++) {
        const t = i / pedacos
        tentarEm({ x: de.x + (ponto.x - de.x) * t, y: de.y + (ponto.y - de.y) * t }, nascidos)
      }
      ultimo = ponto
      return nascidos
    },
    soltos: () => soltos,
    espalhou: () => espalhou,
  }
}

// ---------------------------------------------------------------------------
// Jogador

/**
 * Os objetos que vão ao jogador: só os de base no que ele conhece, fora de
 * lugar escondido e de zona oculta (`mostra`). O objeto na névoa diria o que
 * há lá (a mata, o oásis). A tela dele ainda o guarda sob a máscara do
 * conhecido, então a copa que passa da borda não aparece.
 */
export function carimbosParaJogador(lista: readonly Carimbo[] | undefined, mostra: (p: RegionPoint) => boolean): Carimbo[] | undefined {
  if (lista === undefined || lista.length === 0) return undefined
  const vao = lista.filter((c) => mostra(c))
  return vao.length > 0 ? vao : undefined
}

/** O nome que o importado leva para fora do editor (recorte do jogador, imagem exportada). */
const NOME_DO_IMPORTADO_NO_RECORTE = 'Carimbo'

/** Os importados que os objetos do jogador usam, sem o nome do mestre; os outros ficam com ele. */
export function importadosParaJogador(
  importados: readonly CarimboImportado[] | undefined,
  carimbos: readonly Carimbo[] | undefined,
): CarimboImportado[] | undefined {
  if (importados === undefined || carimbos === undefined) return undefined
  const usados = tiposUsados(carimbos)
  // O nome sai do nome do arquivo do mestre ("covil-do-dragao.png"): o jogador
  // só precisa do id e da imagem para desenhar, então vai um nome neutro.
  const vao = importados.filter((c) => usados.has(c.id)).map((c) => ({ id: c.id, nome: NOME_DO_IMPORTADO_NO_RECORTE, imagem: c.imagem }))
  return vao.length > 0 ? vao : undefined
}
