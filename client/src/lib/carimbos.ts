import type { Carimbo, CarimboImportado, MapData, RegionPoint } from '../types/map'
import { pisoLido } from './pisoDaEntidade'
import { camadaLida } from './camadas/arquivo'

/**
 * CARIMBOS (fatia 5 do plano do relevo de 09/10/2026): a ferramenta em que o
 * mestre solta objetos no mapa — pinheiro, árvore, palmeira, pedras, poça...
 * Um clique solta um; segurar e arrastar ESPALHA vários (spray com espaço,
 * tamanho e giro variados, densidade escolhida); no TRAÇO, arrastar solta um
 * a cada passo fixo ao longo do caminho (a sebe, a trilha de pedras); a
 * borracha tira.
 *
 * Ao contrário da textura (que guarda os passos e pinta de novo), aqui cada
 * objeto É o dado (`MapData.carimbos`): base, tamanho e giro. Fica parado onde
 * foi posto; o sorteio do spray acontece UMA vez, no gesto do mestre, e o
 * mapa guarda o resultado — toda tela desenha o mesmo, sem semente.
 *
 * Folha de propósito (só tipos): o `fogFilter` importa daqui. O desenho dos
 * objetos mora em `src/carimbos/` e o palco em `pixi/drawCarimbos.ts`.
 */

/**
 * O que o PRÓXIMO gesto da ferramenta faz (preferência da ferramenta, fora do
 * map.json): `carimbo` = clique solta um, arrasto espalha (spray); `traco` =
 * clique solta um, arrasto solta um a cada passo fixo ao longo do caminho
 * (`criarTraco`); `borracha` tira.
 */
export type ModoDoCarimbo = 'carimbo' | 'traco' | 'borracha'

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
  /** A camada do objeto está travada: nada mudou; a store já avisou com "Destravar". */
  | 'camada-travada'

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

/** O cadeado ligado: o único jeito de o campo existir no carimbo. */
const COM_CADEADO: Pick<Carimbo, 'locked'> = { locked: true }
/** "Barra a passagem" e "Tapa a visão" ligados: só assim os campos existem. */
const COM_BARRA: Pick<Carimbo, 'barra'> = { barra: true }
const COM_TAPA: Pick<Carimbo, 'tapaVisao'> = { tapaVisao: true }
/** O giro livre do importado: também só existe ligado. */
const COM_GIRO_LIVRE: Pick<Carimbo, 'giroLivre'> = { giroLivre: true }

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
  // CAMADA (`lib/camadas`): campo novo e opcional; ausente ou torto = Terreno, a camada padrão do carimbo.
  // O cadeado (Fase 2) só fica quando é `true`: o resto some, e o mapa de antes abre igual.
  const travado = 'locked' in valor && valor.locked === true ? COM_CADEADO : {}
  // As chaves de jogo (Fase 2) também: só `true` fica.
  const barra = 'barra' in valor && valor.barra === true ? COM_BARRA : {}
  const tapa = 'tapaVisao' in valor && valor.tapaVisao === true ? COM_TAPA : {}
  // O giro livre só vale no importado (o da biblioteca escolhe o desenho pelo giro): no outro, sai.
  const livre = 'giroLivre' in valor && valor.giroLivre === true && ehTipoImportado(tipo) ? COM_GIRO_LIVRE : {}
  return { id, tipo, x, y, tamanho, giro: numeroFinito(giro) ? normalizarGiro(giro) : 0, ...pisoLido(valor), ...camadaLida(valor), ...travado, ...barra, ...tapa, ...livre }
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
    if (p !== q && (p.id !== q.id || p.tipo !== q.tipo || p.x !== q.x || p.y !== q.y || p.tamanho !== q.tamanho || p.giro !== q.giro || p.locked !== q.locked || p.barra !== q.barra || p.tapaVisao !== q.tapaVisao || p.giroLivre !== q.giroLivre)) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Edição (Fase 2, 15/11/2026: "o carimbo porque não consigo editar?")
//
// O carimbo continua carimbo no arquivo (feito para milhares), e ganha a mão
// dos objetos: o Selecionar o acha no ponto, o laço o pega, o arrasto o move.

/** Uma caixa em px de mundo (a mesma forma de `AreaBounds`, sem importar a seleção daqui). */
export interface CaixaDoCarimbo {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Onde o corpo da arte da biblioteca cai, em frações do `tamanho`, a partir do
 * pé: o quadro da arte (`QUADRO_DA_BIBLIOTECA`, de -0,75 a 0,75 e de -1,2 a
 * 0,3) tem folga em volta do desenho; o clique pega só o miolo, para a copa
 * vizinha não roubar o clique da árvore de trás.
 */
const CORPO_DA_BIBLIOTECA: CorpoNoQuadro = { esquerda: -0.45, topo: -1.0, direita: 0.45, base: 0.2 }
/** O importado se desenha centrado no ponto (`QUADRO_DO_IMPORTADO`). */
const CORPO_DO_IMPORTADO: CorpoNoQuadro = { esquerda: -0.5, topo: -0.5, direita: 0.5, base: 0.5 }

interface CorpoNoQuadro {
  readonly esquerda: number
  readonly topo: number
  readonly direita: number
  readonly base: number
}

/** O máximo que o importado sem giro livre inclina, em radianos (0,09 ≈ 5°): não chega a deitar. */
const INCLINACAO_DO_IMPORTADO = 0.09

/**
 * Quanto a imagem do importado gira na tela, em radianos. Com o giro livre
 * (`Carimbo.giroLivre`, o mestre girou), o giro inteiro. Sem ele, o jeito de
 * antes das alças: a imagem só inclina de leve com o giro sorteado, e o mapa
 * de antes continua com a mesma cara.
 */
export function radianosDoImportado(c: Pick<Carimbo, 'giro' | 'giroLivre'>): number {
  const rad = (c.giro * Math.PI) / 180
  return c.giroLivre === true ? rad : Math.sin(rad) * INCLINACAO_DO_IMPORTADO
}

/**
 * A caixa do corpo do carimbo: o que o clique acha, o que o laço mede e onde
 * ficam os cantos das alças. O IMPORTADO com giro livre gira de verdade
 * (`pixi/drawCarimbos.ts`): a caixa dele é a que cerca o quadrado girado, para
 * a ponta da imagem deitada continuar pegando o clique. Sem giro livre, a caixa
 * de antes, reta (a inclinação de uns graus não muda o clique). O da
 * biblioteca não gira a caixa: o giro escolhe um dos oito desenhos, todos no
 * mesmo pé.
 */
export function caixaDoCarimbo(c: Pick<Carimbo, 'tipo' | 'x' | 'y' | 'tamanho' | 'giro' | 'giroLivre'>): CaixaDoCarimbo {
  const importado = ehTipoImportado(c.tipo)
  if (importado && c.giroLivre === true) {
    const rad = (c.giro * Math.PI) / 180
    const meio = CORPO_DO_IMPORTADO.direita * c.tamanho * (Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad)))
    return { minX: c.x - meio, maxX: c.x + meio, minY: c.y - meio, maxY: c.y + meio }
  }
  const q = importado ? CORPO_DO_IMPORTADO : CORPO_DA_BIBLIOTECA
  return { minX: c.x + q.esquerda * c.tamanho, maxX: c.x + q.direita * c.tamanho, minY: c.y + q.topo * c.tamanho, maxY: c.y + q.base * c.tamanho }
}

/**
 * O carimbo debaixo do ponto, o de CIMA na tela: o palco desenha de trás para
 * a frente pela base (`y`, depois `x`, depois a ordem da lista,
 * `pixi/drawCarimbos.ts`), então ganha o de maior `y`. `alcancavel` tira o que
 * o mestre não vê. Varre a lista uma vez: 5.000 caixas são ~0,1 ms, então não
 * há índice para manter em dia a cada mudança.
 */
export function carimboNoPonto(lista: readonly Carimbo[] | undefined, p: RegionPoint, alcancavel?: (c: Carimbo) => boolean): Carimbo | null {
  if (lista === undefined) return null
  let achado: Carimbo | null = null
  for (const c of lista) {
    const caixa = caixaDoCarimbo(c)
    if (p.x < caixa.minX || p.x > caixa.maxX || p.y < caixa.minY || p.y > caixa.maxY) continue
    if (achado !== null && (c.y < achado.y || (c.y === achado.y && c.x < achado.x))) continue
    if (alcancavel !== undefined && !alcancavel(c)) continue
    achado = c
  }
  return achado
}

const indices = new WeakMap<readonly Carimbo[], ReadonlyMap<string, Carimbo>>()

/**
 * O carimbo pelo id, por um índice guardado pela LISTA (a mesma referência
 * devolve o mesmo índice): a seleção de milhares pergunta um a um sem varrer
 * a lista a cada vez. Sem a lista ou sem o id, `undefined`.
 */
export function carimboPorId(lista: readonly Carimbo[] | undefined, id: string): Carimbo | undefined {
  if (lista === undefined) return undefined
  let indice = indices.get(lista)
  if (indice === undefined) {
    indice = new Map(lista.map((c) => [c.id, c]))
    indices.set(lista, indice)
  }
  return indice.get(id)
}

/** O mapa sem os carimbos de `ids`, num filtro só. Nenhum saiu: o MESMO mapa. */
export function semCarimbos(map: MapData, ids: ReadonlySet<string>): MapData {
  if (ids.size === 0 || map.carimbos === undefined) return map
  const ficam = map.carimbos.filter((c) => !ids.has(c.id))
  return ficam.length === map.carimbos.length ? map : comCarimbos(map, ficam)
}

/** O carimbo pode andar, girar e mudar? O cadeado do item segura (a camada travada é conferida por quem chama). */
export function carimboDestravado(c: Pick<Carimbo, 'locked'>): boolean {
  return c.locked !== true
}

/**
 * A lista com os carimbos de `ids` deslocados por (dx, dy), menos os travados.
 * Nada andou: a MESMA lista (o arrasto parado não vira passo no desfazer).
 */
export function moverCarimbos(lista: Carimbo[], ids: ReadonlySet<string>, dx: number, dy: number): Carimbo[] {
  if ((dx === 0 && dy === 0) || ids.size === 0) return lista
  let mudou = false
  const nova = lista.map((c) => {
    if (!ids.has(c.id) || !carimboDestravado(c)) return c
    mudou = true
    return { ...c, x: c.x + dx, y: c.y + dy }
  })
  return mudou ? nova : lista
}

/** O que a ficha do carimbo muda nele (o resto, posição e id, é do arrasto). */
export interface MudancaDoCarimbo {
  tipo?: string
  tamanho?: number
  giro?: number
  /** `true` trava; `false` destrava (o campo sai). */
  locked?: boolean
  /** "Barra a passagem": `false` tira o campo. */
  barra?: boolean
  /** "Tapa a visão": `false` tira o campo. */
  tapaVisao?: boolean
  /** Giro livre do importado (`Carimbo.giroLivre`): `false` volta à inclinação de antes. No da biblioteca, nunca fica. */
  giroLivre?: boolean
}

/** A mudança só mexe nas chaves (cadeado, passagem, visão)? Essas valem também no carimbo travado. */
export function soAsChaves(mudanca: MudancaDoCarimbo): boolean {
  return mudanca.tipo === undefined && mudanca.tamanho === undefined && mudanca.giro === undefined && mudanca.giroLivre === undefined
}

/**
 * O carimbo com a mudança. O tamanho fica positivo e com uma casa decimal; o
 * giro, de 0 a 359; o tipo torto não entra; o giro livre só fica no importado.
 * Nada mudou: o MESMO carimbo.
 */
export function comMudancaDoCarimbo(c: Carimbo, mudanca: MudancaDoCarimbo): Carimbo {
  const tipo = mudanca.tipo !== undefined && ehTipoDeCarimbo(mudanca.tipo) ? mudanca.tipo : c.tipo
  const tamanho = mudanca.tamanho !== undefined && numeroFinito(mudanca.tamanho) && mudanca.tamanho > 0 ? Math.round(mudanca.tamanho * 10) / 10 : c.tamanho
  const giro = mudanca.giro !== undefined && numeroFinito(mudanca.giro) ? normalizarGiro(mudanca.giro) : c.giro
  const travado = mudanca.locked === undefined ? c.locked === true : mudanca.locked
  const barra = mudanca.barra === undefined ? c.barra === true : mudanca.barra
  const tapa = mudanca.tapaVisao === undefined ? c.tapaVisao === true : mudanca.tapaVisao
  const livre = ehTipoImportado(tipo) && (mudanca.giroLivre === undefined ? c.giroLivre === true : mudanca.giroLivre)
  const chavesIguais = travado === (c.locked === true) && barra === (c.barra === true) && tapa === (c.tapaVisao === true) && livre === (c.giroLivre === true)
  if (tipo === c.tipo && tamanho === c.tamanho && giro === c.giro && chavesIguais) return c
  const { locked: _cadeado, barra: _barra, tapaVisao: _tapa, giroLivre: _livre, ...resto } = c
  return { ...resto, tipo, tamanho, giro, ...(travado ? COM_CADEADO : {}), ...(barra ? COM_BARRA : {}), ...(tapa ? COM_TAPA : {}), ...(livre ? COM_GIRO_LIVRE : {}) }
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
  /** O spray já soltou alguma coisa além do clique? (No traço: a mão já saiu do clique.) */
  espalhou: () => boolean
  /**
   * O ponteiro subiu aqui (`null` = o gesto acabou sem ponto, ponteiro
   * cancelado). O traço fecha o caminho até a ponta; o spray não tem ponta.
   */
  terminar: (ponto: RegionPoint | null) => void
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
    // O spray espalha a cada passo da mão: soltar não acrescenta nada.
    terminar: () => undefined,
  }
}

// ---------------------------------------------------------------------------
// Traço (16/11/2026: a sebe saiu do Objeto, que a desenhava num gesto só, e
// virou um módulo do Carimbo; clicar módulo a módulo, ou o spray, que no mais
// denso deixa 0,62 do tamanho entre dois, abria buracos)

/**
 * Como um carimbo anda no TRAÇO: o espaço de um ao outro ao longo do caminho
 * e o que o desenho dele pede. Mora na definição do carimbo
 * (`DefinicaoDeCarimbo.traco`); sem ela, `TRACO_PADRAO`.
 */
export interface TracoDoCarimbo {
  /** De um ao outro, ao longo do caminho, em frações do tamanho: o "Espaço" com que o painel começa. */
  readonly espaco: number
  /**
   * Módulo que emenda no vizinho (a sebe): o traço solta um em cada canto e
   * um na ponta, para a quina não sair mordida nem a sebe parar antes da mão,
   * e todos no mesmo tamanho (a emenda conta com o lado do vizinho).
   */
  readonly emenda?: boolean
  /** O giro segue o rumo do caminho (a trilha de pedras de passo), em vez de sorteado; todos no mesmo tamanho. */
  readonly rumo?: boolean
  /**
   * O chão do desenho achatado em y (a trilha vista um pouco de frente): o
   * espaço e o rumo se medem nesse chão, e a trilha que desce na tela fica no
   * mesmo ritmo da que corre de lado. Ausente = 1 (vista de cima).
   */
  readonly achata?: number
  /** Escolher este carimbo liga o Traço (e escolher outro sem esta marca volta ao Carimbo). */
  readonly preferido?: boolean
}

/** O carimbo sem jeito próprio: um ao lado do outro, a um tamanho de distância (a fileira de árvores). */
export const TRACO_PADRAO: TracoDoCarimbo = { espaco: 1 }

/** O "Espaço" do traço, em frações do tamanho: de bem encostados a três objetos de distância. */
export const ESPACO_DO_TRACO_MIN = 0.2
export const ESPACO_DO_TRACO_MAX = 3

export interface OpcoesDoTraco {
  tipo: string
  /** O tamanho escolhido, já no mundo (`tamanhoNatural`). */
  tamanho: number
  /** O espaço escolhido, em frações do tamanho. */
  espaco: number
  jeito: TracoDoCarimbo
  sorteio?: Sorteio
  novoId?: () => string
  /** Quantos objetos este gesto ainda pode soltar (o teto da cena menos o que já há). */
  vagas?: number
}

/** O caminho guarda um ponto só depois de a mão andar esta fração do passo: o tremido não alonga o caminho. */
const PASSO_DO_CAMINHO = 0.1
/** A mudança de rumo, de um objeto ao seguinte, que já pode ser canto (graus). */
const CANTO_MINIMO_EM_GRAUS = 30
/** O ponto do caminho tem de sair da corda ao menos esta fração do passo para ser canto (a curva larga não é). */
const FUNDO_MINIMO_DO_CANTO = 0.1
/** O canto ou a ponta a menos desta fração do passo de um objeto já solto está coberto. */
const JA_COBERTO = 0.15

interface PontoDoCaminho {
  readonly p: RegionPoint
  /** Distância no chão do desenho do começo do caminho até aqui. */
  readonly arco: number
}

/**
 * O TRAÇO: arrastar solta um objeto a cada `espaco × tamanho` medidos AO
 * LONGO do caminho da mão (não em linha reta), o primeiro no ponto do clique.
 * O caminho só guarda o ponto quando a mão anda um décimo do passo, então o
 * tremido não junta os objetos. Sem a conferência de espaço do spray: o
 * mestre põe a sebe por cima da que já existe, e a trilha de pedras entra na
 * água, porque o traço é dele.
 *
 * O módulo que emenda (`jeito.emenda`) ganha também um no CANTO: a cada
 * objeto solto, se o rumo virou mais que `CANTO_MINIMO_EM_GRAUS` entre os
 * dois últimos trechos, o ponto do caminho mais longe da corda entre eles é o
 * canto, e recebe um. Sem isso, o quadrado do módulo deixa a quina de fora
 * mordida (até meio passo de cada lado). E um na PONTA, onde a mão soltou.
 */
export function criarTraco(opcoes: OpcoesDoTraco): Spray {
  const sorteio = opcoes.sorteio ?? Math.random
  const novoId = opcoes.novoId ?? novoIdDeCarimbo
  const { jeito } = opcoes
  const achata = jeito.achata !== undefined && jeito.achata > 0 ? jeito.achata : 1
  const iguais = jeito.emenda === true || jeito.rumo === true
  const passo = Math.max(1, limitar(opcoes.espaco, ESPACO_DO_TRACO_MIN, ESPACO_DO_TRACO_MAX) * opcoes.tamanho)
  /** A distância no chão do desenho: o y achatado volta ao tamanho de verdade. */
  const noChao = (a: RegionPoint, b: RegionPoint) => Math.hypot(b.x - a.x, (b.y - a.y) / achata)
  /** O rumo de `a` para `b`, em graus, no chão do desenho (0 = para a direita, 90 = para baixo na tela). */
  const rumoDe = (a: RegionPoint, b: RegionPoint) => (Math.atan2((b.y - a.y) / achata, b.x - a.x) * 180) / Math.PI

  const caminho: PontoDoCaminho[] = []
  const soltos: Carimbo[] = []
  /** Os objetos do passo fixo (sem os de canto e de ponta), com o lugar deles no caminho. */
  const marcos: Array<{ readonly indice: number; readonly ponto: PontoDoCaminho }> = []
  let vagas = opcoes.vagas ?? Infinity
  let proximoArco = passo
  let saiu = false

  // Um décimo de px basta (o spray arredonda ao px; aqui o passo é que manda na emenda).
  const decimo = (v: number) => Math.round(v * 10) / 10
  const criar = (p: RegionPoint, giro: number): Carimbo => ({
    id: novoId(),
    tipo: opcoes.tipo,
    x: decimo(p.x),
    y: decimo(p.y),
    tamanho: decimo(opcoes.tamanho * (iguais ? 1 : 1 + (sorteio() * 2 - 1) * VARIACAO_DO_CLIQUE)),
    giro: normalizarGiro(giro),
  })
  /** O giro do objeto: o rumo, quando o desenho pede; senão sorteado (só troca o desenho entre os oito). */
  const giroDe = (rumo: number) => (jeito.rumo === true ? rumo : sorteio() * 360)

  const soltar = (p: RegionPoint, rumo: number, nascidos: Carimbo[]): number | null => {
    if (vagas <= 0) return null
    const novo = criar(p, giroDe(rumo))
    soltos.push(novo)
    nascidos.push(novo)
    vagas -= 1
    return soltos.length - 1
  }

  const coberto = (p: RegionPoint) => soltos.some((c) => noChao(c, p) < JA_COBERTO * passo)

  /** O canto entre os marcos `a` e `b` (o ponto do caminho mais longe da corda), se o rumo virou no meio. */
  const cantoEntre = (a: PontoDoCaminho, meio: PontoDoCaminho, b: PontoDoCaminho): RegionPoint | null => {
    const antes = rumoDe(a.p, meio.p)
    const depois = rumoDe(meio.p, b.p)
    const virada = Math.abs((((depois - antes) % 360) + 540) % 360 - 180)
    if (virada < CANTO_MINIMO_EM_GRAUS) return null
    const corda = noChao(a.p, b.p)
    if (corda === 0) return null
    let canto: RegionPoint | null = null
    let fundo = FUNDO_MINIMO_DO_CANTO * passo
    for (const q of caminho) {
      if (q.arco <= a.arco || q.arco >= b.arco) continue
      // A distância do ponto à corda, no chão do desenho (o produto vetorial pela corda).
      const d = Math.abs((b.p.x - a.p.x) * ((q.p.y - a.p.y) / achata) - ((b.p.y - a.p.y) / achata) * (q.p.x - a.p.x)) / corda
      if (d > fundo) {
        fundo = d
        canto = q.p
      }
    }
    return canto
  }

  /** O módulo que emenda: confere o canto entre os três últimos marcos (e a ponta, quando é ela o último). */
  const conferirCanto = (ultimo: PontoDoCaminho, nascidos: Carimbo[]) => {
    if (jeito.emenda !== true || marcos.length < 2) return
    const a = marcos[marcos.length - 2].ponto
    const meio = marcos[marcos.length - 1].ponto
    const canto = cantoEntre(a, meio, ultimo)
    if (canto !== null && !coberto(canto)) soltar(canto, rumoDe(a.p, ultimo.p), nascidos)
  }

  /** Mais um ponto no caminho: solta os do passo fixo que caem no trecho novo. */
  const andar = (ponto: RegionPoint, nascidos: Carimbo[]) => {
    const de = caminho[caminho.length - 1]
    const trecho = noChao(de.p, ponto)
    const ate: PontoDoCaminho = { p: ponto, arco: de.arco + trecho }
    caminho.push(ate)
    saiu = true
    while (proximoArco <= ate.arco && vagas > 0) {
      const t = (proximoArco - de.arco) / trecho
      const marco: PontoDoCaminho = { p: { x: de.p.x + (ponto.x - de.p.x) * t, y: de.p.y + (ponto.y - de.p.y) * t }, arco: proximoArco }
      const anterior = marcos[marcos.length - 1]
      conferirCanto(marco, nascidos)
      const indice = soltar(marco.p, rumoDe(anterior.ponto.p, marco.p), nascidos)
      if (indice === null) break
      // O primeiro esperava o rumo: só agora se sabe para onde a trilha vai.
      if (jeito.rumo === true && marcos.length === 1) soltos[anterior.indice] = { ...soltos[anterior.indice], giro: normalizarGiro(rumoDe(anterior.ponto.p, marco.p)) }
      marcos.push({ indice, ponto: marco })
      proximoArco += passo
    }
  }

  return {
    comecar: (ponto) => {
      const inicio: PontoDoCaminho = { p: ponto, arco: 0 }
      caminho.push(inicio)
      // Sem rumo ainda: a trilha de um clique só corre de lado (0°).
      const indice = soltar(ponto, 0, [])
      if (indice === null) return null
      marcos.push({ indice, ponto: inicio })
      return soltos[indice]
    },
    passar: (ponto) => {
      const nascidos: Carimbo[] = []
      const ultimo = caminho[caminho.length - 1]
      if (ultimo === undefined || noChao(ultimo.p, ponto) < PASSO_DO_CAMINHO * passo) return nascidos
      andar(ponto, nascidos)
      return nascidos
    },
    soltos: () => soltos,
    espalhou: () => saiu,
    terminar: (ponto) => {
      // Um clique (a mão nem saiu dele): fica o objeto do clique, sozinho.
      if (!saiu || marcos.length === 0) return
      const nascidos: Carimbo[] = []
      const ultimo = caminho[caminho.length - 1]
      if (ponto !== null && noChao(ultimo.p, ponto) > 0) andar(ponto, nascidos)
      const fim = caminho[caminho.length - 1]
      if (jeito.emenda !== true || coberto(fim.p)) return
      // A ponta como último marco: o canto logo antes dela também fecha.
      conferirCanto(fim, nascidos)
      soltar(fim.p, rumoDe(marcos[marcos.length - 1].ponto.p, fim.p), nascidos)
    },
  }
}

// ---------------------------------------------------------------------------
// Jogador

/**
 * Os objetos que vão ao jogador: só os de base no que ele conhece, fora de
 * lugar escondido e de zona oculta (`mostra`). O objeto na névoa diria o que
 * há lá (a mata, o oásis). A tela dele ainda o guarda sob a máscara do
 * conhecido, então a copa que passa da borda não aparece. `mostra` recebe o
 * carimbo inteiro: o que tapa a visão é medido também pela pegada
 * (`lib/fogFilter.ts`), porque o pé dele mora atrás da borda que segura o olhar.
 */
export function carimbosParaJogador(lista: readonly Carimbo[] | undefined, mostra: (c: Carimbo) => boolean): Carimbo[] | undefined {
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
