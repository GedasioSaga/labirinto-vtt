/**
 * ABISMO (terceira cara do Desnível, 16/11/2026; referência do templo na
 * caverna, `tmp/referencias-2026-11-15/FALTA.md`, "Outro" 2): o buraco fundo
 * que o mestre contorna à mão. A tela desenha a parede escurecendo para baixo,
 * a beira esfarelada e, se ele quiser, um brilho no fundo (`pixi/drawAbismo.ts`).
 *
 * Segura o ANDAR da ficha do JOGADOR, não a visão: o contorno vira parede que
 * deixa ver só nas contas de andar dele (`paredesParaAndarDoJogador`), como o
 * carimbo que barra. O mestre atravessa, como nos objetos. A ficha que já está
 * dentro do buraco sai (nunca prender).
 *
 * Mora na camada Terreno, como o barranco: o olho e o cadeado dela valem para
 * ele. Campo novo e opcional (`MapData.abismos`): o mapa de antes abre e salva
 * igual, e o app antigo ignora a lista.
 *
 * Tudo aqui é puro: sem Pixi nem store.
 */
import type { Abismo, BrilhoDoAbismo, CamadaId, MapData, RegionPoint, Wall } from '../types/map'
import type { CarimboQueIlumina } from './luzDoFogo'
import { pisoDe } from './pisos'

// ILHAS (17/11/2026, o abismo por pincel de `lib/abismoPintado.ts`): chão de pé dentro do buraco,
// cada uma um contorno fechado dentro da boca. Campo NOVO e OPCIONAL: o abismo contornado à mão
// não tem. Declarado aqui até entrar em `types/map.ts`.
declare module '../types/map' {
  interface Abismo {
    ilhas?: RegionPoint[][]
  }
}

/** A camada em que todo abismo mora (o abismo não escolhe camada). */
export const CAMADA_DO_ABISMO: CamadaId = 'terreno'
/** Os brilhos do fundo, na ordem do painel (sem brilho vem antes, como "Nenhum"). */
export const BRILHOS_DO_ABISMO: readonly BrilhoDoAbismo[] = ['brasa', 'verde']
/** Teto da leitura do arquivo: abismos por mapa, pontos por contorno e ilhas por abismo. */
export const TETO_DE_ABISMOS = 200
export const TETO_DE_PONTOS_DO_ABISMO = 400
export const TETO_DE_ILHAS_DO_ABISMO = 64
/** A boca menor que isto (lado de um quadrado, em casas) não vira abismo: foi um clique tremido. */
export const LADO_MINIMO_EM_CASAS = 0.6

// ─────────────────────────────────────────────────────────────
// O campo do mapa e a leitura do arquivo
// ─────────────────────────────────────────────────────────────

/** O mapa com esta lista de abismos; a lista vazia tira o campo (o mapa sem abismo salva como antes). */
export function comAbismos(map: MapData, abismos: Abismo[]): MapData {
  if (abismos.length === 0) {
    if (map.abismos === undefined) return map
    const { abismos: _fora, ...resto } = map
    return resto
  }
  return { ...map, abismos }
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function numeroFinito(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

function ehBrilho(valor: unknown): valor is BrilhoDoAbismo {
  return BRILHOS_DO_ABISMO.some((b) => b === valor)
}

/**
 * Os abismos do arquivo, lidos com cuidado: o item sem id, com menos de 3
 * pontos bons ou com id repetido sai; o brilho desconhecido (de uma versão
 * mais nova) vira "sem brilho"; o piso só entra inteiro e diferente de 0; a
 * ilha com menos de 3 pontos bons sai (as outras ficam).
 * `undefined` sem nenhum abismo bom (o campo nem entra no mapa).
 */
export function lerAbismos(valor: unknown): Abismo[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const vistos = new Set<string>()
  const lidos: Abismo[] = []
  for (const item of valor) {
    if (lidos.length >= TETO_DE_ABISMOS) break
    if (!ehObjeto(item) || typeof item.id !== 'string' || item.id === '' || vistos.has(item.id) || !Array.isArray(item.pontos)) continue
    const pontos = lerContorno(item.pontos)
    if (pontos.length < 3) continue
    vistos.add(item.id)
    const piso = numeroFinito(item.piso) && Number.isInteger(item.piso) && item.piso !== 0 ? item.piso : undefined
    const ilhas: RegionPoint[][] = []
    for (const ilha of Array.isArray(item.ilhas) ? item.ilhas : []) {
      if (ilhas.length >= TETO_DE_ILHAS_DO_ABISMO) break
      const contorno = Array.isArray(ilha) ? lerContorno(ilha) : []
      if (contorno.length >= 3) ilhas.push(contorno)
    }
    lidos.push({ id: item.id, pontos, ...(ilhas.length > 0 ? { ilhas } : {}), ...(ehBrilho(item.brilho) ? { brilho: item.brilho } : {}), ...(piso !== undefined ? { piso } : {}) })
  }
  return lidos.length === 0 ? undefined : lidos
}

/** Os pontos bons de um contorno do arquivo, até o teto. */
function lerContorno(valor: readonly unknown[]): RegionPoint[] {
  const pontos: RegionPoint[] = []
  for (const p of valor) {
    if (pontos.length >= TETO_DE_PONTOS_DO_ABISMO) break
    if (ehObjeto(p) && numeroFinito(p.x) && numeroFinito(p.y)) pontos.push({ x: p.x, y: p.y })
  }
  return pontos
}

// ─────────────────────────────────────────────────────────────
// Geometria
// ─────────────────────────────────────────────────────────────

/** Os abismos do piso `piso`, na ordem do mapa. */
export function abismosDoPiso(lista: readonly Abismo[] | undefined, piso: number): Abismo[] {
  return lista === undefined ? [] : lista.filter((a) => pisoDe(a) === piso)
}

/** O ponto está dentro da boca (par-ímpar: o contorno que se cruza ainda responde algo estável). */
export function pontoNoContorno(pontos: readonly RegionPoint[], p: RegionPoint): boolean {
  let dentro = false
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i, i += 1) {
    const a = pontos[i]
    const b = pontos[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro
  }
  return dentro
}

/** O ponto está no BURACO do abismo: dentro da boca e fora das ilhas (em cima de uma ilha é chão de pé). */
export function pontoNoAbismo(abismo: Pick<Abismo, 'pontos' | 'ilhas'>, p: RegionPoint): boolean {
  if (!pontoNoContorno(abismo.pontos, p)) return false
  return abismo.ilhas === undefined || !abismo.ilhas.some((ilha) => pontoNoContorno(ilha, p))
}

/** O abismo de cima (o último da lista) do piso que tem o ponto no buraco (a ilha não conta); `null` se nenhum. */
export function abismoNoPonto(lista: readonly Abismo[] | undefined, piso: number, p: RegionPoint): Abismo | null {
  if (lista === undefined) return null
  for (let i = lista.length - 1; i >= 0; i -= 1) {
    const abismo = lista[i]
    if (pisoDe(abismo) === piso && abismo.pontos.length >= 3 && pontoNoAbismo(abismo, p)) return abismo
  }
  return null
}

/** A caixa da boca, no formato das caixas da seleção. `null` sem pontos. */
export function caixaDoAbismo(abismo: Pick<Abismo, 'pontos'>): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (abismo.pontos.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of abismo.pontos) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX, minY, maxX, maxY }
}

/** A área da boca (px de mundo ao quadrado), sem sinal. */
export function areaDoContorno(pontos: readonly RegionPoint[]): number {
  let soma = 0
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i, i += 1) soma += pontos[j].x * pontos[i].y - pontos[i].x * pontos[j].y
  return Math.abs(soma) / 2
}

/** O centro de massa da boca; a média dos pontos quando a área é quase nula. */
export function centroDoContorno(pontos: readonly RegionPoint[]): RegionPoint {
  let soma = 0
  let cx = 0
  let cy = 0
  for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i, i += 1) {
    const cruz = pontos[j].x * pontos[i].y - pontos[i].x * pontos[j].y
    soma += cruz
    cx += (pontos[j].x + pontos[i].x) * cruz
    cy += (pontos[j].y + pontos[i].y) * cruz
  }
  if (Math.abs(soma) < 1e-6) {
    const n = Math.max(1, pontos.length)
    return { x: pontos.reduce((t, p) => t + p.x, 0) / n, y: pontos.reduce((t, p) => t + p.y, 0) / n }
  }
  return { x: cx / (3 * soma), y: cy / (3 * soma) }
}

function distanciaAoSegmento(p: RegionPoint, a: RegionPoint, b: RegionPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const tamanho = dx * dx + dy * dy
  const t = tamanho === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / tamanho))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Douglas-Peucker num trecho aberto: os pontos que a tolerância deixa ficar, com as duas pontas. */
function simplificarTrecho(pontos: readonly RegionPoint[], tolerancia: number): RegionPoint[] {
  if (pontos.length <= 2) return [...pontos]
  const primeiro = pontos[0]
  const ultimo = pontos[pontos.length - 1]
  let maior = -1
  let indice = 0
  for (let i = 1; i < pontos.length - 1; i += 1) {
    const d = distanciaAoSegmento(pontos[i], primeiro, ultimo)
    if (d > maior) {
      maior = d
      indice = i
    }
  }
  if (maior <= tolerancia) return [primeiro, ultimo]
  const esquerda = simplificarTrecho(pontos.slice(0, indice + 1), tolerancia)
  return [...esquerda.slice(0, -1), ...simplificarTrecho(pontos.slice(indice), tolerancia)]
}

/**
 * O contorno traçado à mão, enxuto: Douglas-Peucker com a tolerância dada e o
 * fecho sem o ponto repetido. Se ainda passar do teto, a tolerância dobra.
 */
export function contornoSimplificado(pontos: readonly RegionPoint[], tolerancia: number): RegionPoint[] {
  let tol = Math.max(0.5, tolerancia)
  for (let tentativa = 0; tentativa < 8; tentativa += 1) {
    const fechado = [...pontos, pontos[0]]
    const enxuto = simplificarTrecho(fechado, tol).slice(0, -1)
    if (enxuto.length <= TETO_DE_PONTOS_DO_ABISMO) return enxuto.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }))
    tol *= 2
  }
  return pontos.slice(0, TETO_DE_PONTOS_DO_ABISMO).map((p) => ({ x: p.x, y: p.y }))
}

/** A boca traçada é grande o bastante para virar abismo? (área de um quadrado de `LADO_MINIMO_EM_CASAS`). */
export function contornoValeAbismo(pontos: readonly RegionPoint[], grid: number): boolean {
  const lado = LADO_MINIMO_EM_CASAS * grid
  return pontos.length >= 3 && areaDoContorno(pontos) >= lado * lado
}

/**
 * Quanto o fundo desce na tela (px de mundo): metade da altura da boca, entre
 * 0,9 e 2,4 casas. A boca pequena ainda mostra parede; a fenda comprida fica
 * com a parede de cima e o resto no escuro do fundo.
 */
export function profundidadeDoAbismo(abismo: Pick<Abismo, 'pontos'>, grid: number): number {
  const caixa = caixaDoAbismo(abismo)
  const altura = caixa === null ? 0 : caixa.maxY - caixa.minY
  return Math.min(2.4 * grid, Math.max(0.9 * grid, altura * 0.5))
}

/** Os abismos de `ids` andam (dx, dy). Nada andou: a MESMA lista (o arrasto travado não gasta passo no Ctrl+Z). */
export function moverAbismos(lista: Abismo[], ids: ReadonlySet<string>, dx: number, dy: number): Abismo[] {
  if ((dx === 0 && dy === 0) || ids.size === 0) return lista
  let mudou = false
  const depois = lista.map((abismo) => {
    if (!ids.has(abismo.id)) return abismo
    mudou = true
    const andar = (p: RegionPoint): RegionPoint => ({ x: p.x + dx, y: p.y + dy })
    return { ...abismo, pontos: abismo.pontos.map(andar), ...(abismo.ilhas !== undefined ? { ilhas: abismo.ilhas.map((ilha) => ilha.map(andar)) } : {}) }
  })
  return mudou ? depois : lista
}

// ─────────────────────────────────────────────────────────────
// O andar: o contorno vira parede que deixa ver
// ─────────────────────────────────────────────────────────────

const PREFIXO_DA_PAREDE = 'abismo:'

/** O id é de uma beira de abismo (e não de uma parede do mapa)? */
export function ehParedeDeAbismo(id: string): boolean {
  return id.startsWith(PREFIXO_DA_PAREDE)
}

const SEM_PAREDES: readonly Wall[] = []
const paredesPorLista = new WeakMap<readonly Abismo[], Map<number, readonly Wall[]>>()

/**
 * As beiras dos abismos do piso como paredes que deixam ver e não deixam
 * passar (`blocksLight: false`). Só para as contas de andar: nunca vão para
 * `map.walls`, para o desenho nem para a visão. Guardado pela lista: a mesma
 * lista devolve o MESMO array. A beira de cada ILHA também segura: quem está
 * em cima dela fica nela, e quem está fora não a alcança pelo buraco.
 */
export function paredesDosAbismos(lista: readonly Abismo[] | undefined, piso: number): readonly Wall[] {
  if (lista === undefined || lista.length === 0) return SEM_PAREDES
  let porPiso = paredesPorLista.get(lista)
  if (porPiso === undefined) {
    porPiso = new Map()
    paredesPorLista.set(lista, porPiso)
  }
  const guardadas = porPiso.get(piso)
  if (guardadas !== undefined) return guardadas
  const paredes: Wall[] = []
  for (const abismo of lista) {
    if (pisoDe(abismo) !== piso || abismo.pontos.length < 3) continue
    const beira = (contorno: readonly RegionPoint[], nome: string): void => {
      contorno.forEach((a, i) => {
        const b = contorno[(i + 1) % contorno.length]
        paredes.push({ id: `${PREFIXO_DA_PAREDE}${abismo.id}:${nome}${i}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, blocksLight: false, blocksMove: true, door: null, ...(piso !== 0 ? { piso } : {}) })
      })
    }
    beira(abismo.pontos, '')
    abismo.ilhas?.forEach((ilha, n) => {
      if (ilha.length >= 3) beira(ilha, `ilha${n}:`)
    })
  }
  const resultado = paredes.length === 0 ? SEM_PAREDES : paredes
  porPiso.set(piso, resultado)
  return resultado
}

const juntadas = new WeakMap<Wall[], WeakMap<readonly Wall[], Map<string, Wall[]>>>()

/**
 * `base` mais as beiras dos abismos do piso. O abismo que tem `de` dentro (a
 * ficha caiu ou foi posta lá) fica de fora: ela sobe para fora. As mesmas
 * entradas devolvem o MESMO array (as malhas e os blocos da batalha guardam
 * cache pela referência das paredes); sem abismo, a própria `base`.
 */
export function comParedesDosAbismos(base: Wall[], lista: readonly Abismo[] | undefined, piso: number, de: RegionPoint | null): Wall[] {
  const todas = paredesDosAbismos(lista, piso)
  if (todas.length === 0 || lista === undefined) return base
  // Só o buraco conta: a ficha em cima de uma ilha está em chão de pé, e a beira continua segurando.
  const dentro = de === null ? [] : lista.filter((a) => pisoDe(a) === piso && a.pontos.length >= 3 && pontoNoAbismo(a, de)).map((a) => `${PREFIXO_DA_PAREDE}${a.id}:`)
  let porTodas = juntadas.get(base)
  if (porTodas === undefined) {
    porTodas = new WeakMap()
    juntadas.set(base, porTodas)
  }
  let porChave = porTodas.get(todas)
  if (porChave === undefined) {
    porChave = new Map()
    porTodas.set(todas, porChave)
  }
  const chave = dentro.join('|')
  const guardada = porChave.get(chave)
  if (guardada !== undefined) return guardada
  const valem = dentro.length === 0 ? todas : todas.filter((w) => !dentro.some((prefixo) => w.id.startsWith(prefixo)))
  const juntas = [...base, ...valem]
  porChave.set(chave, juntas)
  return juntas
}

const filtradas = new WeakMap<readonly Abismo[], Map<string, Abismo[]>>()

/**
 * A lista sem os abismos que o recorte nunca entrega ao jogador (`escondido`,
 * do host). Nenhum escondido: a PRÓPRIA lista; os mesmos escondidos da mesma
 * lista: o MESMO array (as paredes guardam cache pela referência).
 */
export function semAbismosEscondidos(lista: readonly Abismo[], escondido: (abismo: Abismo) => boolean): Abismo[] | readonly Abismo[] {
  const fora = lista.filter(escondido)
  if (fora.length === 0) return lista
  let porChave = filtradas.get(lista)
  if (porChave === undefined) {
    porChave = new Map()
    filtradas.set(lista, porChave)
  }
  const chave = fora.map((a) => a.id).join('|')
  const guardada = porChave.get(chave)
  if (guardada !== undefined) return guardada
  const ficam = lista.filter((a) => !fora.includes(a))
  porChave.set(chave, ficam)
  return ficam
}

/** As paredes sem as beiras de abismo: a conta de "passaria se não fosse o abismo?" da recusa `abismo`. */
export function semParedesDeAbismo<W extends { readonly id: string }>(paredes: readonly W[]): W[] {
  return paredes.filter((w) => !ehParedeDeAbismo(w.id))
}

// ─────────────────────────────────────────────────────────────
// O recorte do jogador
// ─────────────────────────────────────────────────────────────

/** Teto de amostras por abismo no recorte (o passo cresce na boca enorme). */
const TETO_DE_AMOSTRAS = 1500

/** Pontos da beira (a cada `passo`) e de dentro do buraco (grade de `passo`, fora das ilhas): o que o recorte pergunta. */
export function amostrasDoAbismo(abismo: Pick<Abismo, 'pontos' | 'ilhas'>, passoPedido: number): RegionPoint[] {
  const caixa = caixaDoAbismo(abismo)
  if (caixa === null) return []
  const area = Math.max(1, (caixa.maxX - caixa.minX) * (caixa.maxY - caixa.minY))
  const passo = Math.max(passoPedido, Math.sqrt(area / TETO_DE_AMOSTRAS))
  const amostras: RegionPoint[] = []
  abismo.pontos.forEach((a, i) => {
    const b = abismo.pontos[(i + 1) % abismo.pontos.length]
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / passo))
    for (let k = 0; k < n; k += 1) amostras.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n })
  })
  for (let y = caixa.minY + passo / 2; y < caixa.maxY; y += passo) {
    for (let x = caixa.minX + passo / 2; x < caixa.maxX; x += passo) {
      const p = { x, y }
      if (pontoNoAbismo(abismo, p)) amostras.push(p)
    }
  }
  return amostras
}

/**
 * Os abismos que vão ao jogador: os do piso do grupo que encostam no que ele
 * conhece (`conhece`: visão, explorado, cômodo lembrado), fora de lugar
 * escondido. Vão inteiros (a tela dele só pinta o pedaço conhecido, sob a
 * máscara da névoa). O que MORA na sala secreta fechada (`mora`, a maioria das
 * amostras lá) não sai; o que só passa por ela sai inteiro.
 * `undefined` sem nenhum.
 */
export function abismosParaJogador(
  lista: readonly Abismo[] | undefined,
  piso: number,
  grid: number,
  conhece: (p: RegionPoint) => boolean,
  escondido: (p: RegionPoint) => boolean,
  mora: (p: RegionPoint) => boolean = () => false,
): Abismo[] | undefined {
  if (lista === undefined || lista.length === 0) return undefined
  const passo = Math.max(4, grid / 2)
  const saem = lista.filter((abismo) => {
    if (pisoDe(abismo) !== piso || abismo.pontos.length < 3) return false
    const amostras = amostrasDoAbismo(abismo, passo)
    if (amostras.length === 0) return false
    if (amostras.filter(mora).length * 2 > amostras.length) return false
    return amostras.some((p) => !escondido(p) && conhece(p))
  })
  return saem.length === 0 ? undefined : saem
}

// ─────────────────────────────────────────────────────────────
// A luz do fundo
// ─────────────────────────────────────────────────────────────

/** O carimbo cuja luz o brilho do fundo empresta (`LUZ_DOS_CARIMBOS` em `lib/luzDoFogo.ts`). */
export const LUZ_DO_BRILHO: Readonly<Record<BrilhoDoAbismo, string>> = {
  brasa: 'fenda-em-brasa',
  verde: 'cristais-verdes',
}
/** Os pontos de luz de um abismo: um a cada tantas casas dentro da boca, até o teto. */
const PASSO_DA_LUZ_EM_CASAS = 2.5
const TETO_DE_LUZES_POR_ABISMO = 8

/**
 * Os pontos de luz do fundo de um abismo que brilha: dentro da boca, pelo
 * menos `PASSO_DA_LUZ_EM_CASAS` um do outro (a fenda fina e comprida também
 * ganha luz ao longo dela), até o teto. A luz espalha igual para todo lado da
 * beira.
 */
export function pontosDeLuzDoAbismo(abismo: Abismo, grid: number): RegionPoint[] {
  const caixa = caixaDoAbismo(abismo)
  if (caixa === null || abismo.brilho === undefined) return []
  const distancia = PASSO_DA_LUZ_EM_CASAS * grid
  const passo = Math.max(grid * 0.5, Math.sqrt(((caixa.maxX - caixa.minX) * (caixa.maxY - caixa.minY)) / 2000))
  const pontos: RegionPoint[] = []
  for (let y = caixa.minY + passo / 2; y < caixa.maxY && pontos.length < TETO_DE_LUZES_POR_ABISMO; y += passo) {
    for (let x = caixa.minX + passo / 2; x < caixa.maxX && pontos.length < TETO_DE_LUZES_POR_ABISMO; x += passo) {
      const p = { x, y }
      if (pontoNoAbismo(abismo, p) && pontos.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= distancia)) pontos.push(p)
    }
  }
  if (pontos.length === 0) pontos.push(centroDoContorno(abismo.pontos))
  return pontos
}

const SEM_CARIMBOS: object = {}
const luzesPorAbismos = new WeakMap<readonly Abismo[], WeakMap<object, Map<number, readonly CarimboQueIlumina[]>>>()

/**
 * Os carimbos que iluminam, mais um "carimbo de luz" por ponto de luz de cada
 * abismo que brilha: a brasa empresta a luz da fenda em brasa e o verde a dos
 * cristais verdes, com o mesmo tom, alcance e tremor. Sem abismo que brilhe, a
 * PRÓPRIA lista de carimbos (o mapa de luz compara por referência); as mesmas
 * listas devolvem o MESMO array.
 */
export function carimbosComOsAbismos(
  carimbos: readonly CarimboQueIlumina[] | undefined,
  abismos: readonly Abismo[] | undefined,
  grid: number,
  piso = 0,
): readonly CarimboQueIlumina[] | undefined {
  if (abismos === undefined || !abismos.some((a) => a.brilho !== undefined && pisoDe(a) === piso)) return carimbos
  let porCarimbos = luzesPorAbismos.get(abismos)
  if (porCarimbos === undefined) {
    porCarimbos = new WeakMap()
    luzesPorAbismos.set(abismos, porCarimbos)
  }
  const chave = carimbos ?? SEM_CARIMBOS
  let porGrade = porCarimbos.get(chave)
  if (porGrade === undefined) {
    porGrade = new Map()
    porCarimbos.set(chave, porGrade)
  }
  const chaveDaGrade = grid * 1000 + piso
  const guardada = porGrade.get(chaveDaGrade)
  if (guardada !== undefined) return guardada
  const daLuz: CarimboQueIlumina[] = []
  for (const abismo of abismos) {
    if (abismo.brilho === undefined || pisoDe(abismo) !== piso) continue
    const tipo = LUZ_DO_BRILHO[abismo.brilho]
    for (const p of pontosDeLuzDoAbismo(abismo, grid)) daLuz.push({ tipo, x: p.x, y: p.y })
  }
  const juntas = [...(carimbos ?? []), ...daLuz]
  porGrade.set(chaveDaGrade, juntas)
  return juntas
}
