import type { Agua, RecorteDaAgua, RegionPoint } from '../../types/map'
import { larguraDoRio } from './dados'
import { curvaGuardada, dentroDoContorno } from './forma'

/**
 * ÁGUA NO RECORTE DO JOGADOR (pedido de 12/11/2026, `PROPOSTA.md` peça 5): a
 * água cortada ao que ele conhece, no molde do `floorInCells` do Chão. A forma
 * de verdade nunca sai: os `pontos` vão vazios e vão só
 *
 * - no lago e no mar, as células conhecidas com água e os trechos da margem
 *   que ele conhece. O campo do jogador (`campo.ts`) só conta essa margem:
 *   a beira que ele não viu não ganha raso, praia nem espuma, então nada
 *   entrega onde está a terra;
 * - no rio, os trechos do traço perto do que ele conhece, com uma folga para a
 *   ponta redonda do trecho cair fora do conhecido (a tela corta pela máscara
 *   do conhecido). A largura do rio vai junto: a outra margem, se estiver na
 *   névoa, sai pela largura (risco (b) da proposta, aceito: com rio de até 6
 *   casas e visão de 6, as duas margens quase sempre aparecem juntas).
 *
 * Água secreta (`secret`) nunca sai; quem chama tira também a da camada que o
 * jogador não vê.
 */

/** Pontos de prova por célula (o centro e quatro em volta): célula pequena com pouca água ainda entra. */
const PROVAS = [
  [0.5, 0.5],
  [0.2, 0.2],
  [0.8, 0.2],
  [0.2, 0.8],
  [0.8, 0.8],
] as const

const arred = (v: number): number => Math.round(v * 10) / 10

/**
 * O ESCONDIDO GUARDADO (M05 da 0.5.62): a cada passo da ficha o recorte
 * perguntava `escondido` (teto fechado, cômodo não visto, zona oculta) de cada
 * ponto do rio e do lago, várias vezes o mesmo ponto (a folga do rio olha os
 * vizinhos de cada ponto conhecido), e a resposta só muda quando muda o lugar
 * escondido, não quando a ficha anda. Cada água guarda a resposta por ponto de
 * prova (o índice dele na curva) para a `chave` do lugar escondido que quem
 * chama monta (`chaveDoEscondido`); sem chave, a resposta vale só nesta
 * chamada. A conta é a mesma: só deixa de ser refeita.
 */
const CHAVES_POR_AGUA = 8

interface EscondidoGuardado {
  chave: string
  porProva: Map<number, boolean>
  /** `moraEm` com o `mora` desta chave (quem chama põe na chave o que muda a sala secreta). */
  mora?: boolean
}

const escondidosDaCurva = new WeakMap<readonly number[], EscondidoGuardado[]>()

function guardadoDaCurva(xy: readonly number[], chave: string): EscondidoGuardado {
  let lista = escondidosDaCurva.get(xy)
  if (lista === undefined) {
    lista = []
    escondidosDaCurva.set(xy, lista)
  }
  const ja = lista.find((g) => g.chave === chave)
  if (ja !== undefined) return ja
  const novo: EscondidoGuardado = { chave, porProva: new Map() }
  lista.push(novo)
  // Uma chave por jogador e por estado do lugar escondido: as mais velhas saem.
  if (lista.length > CHAVES_POR_AGUA) lista.shift()
  return novo
}

/** `escondido` ou `livre` com o índice do ponto de prova (o mesmo índice é sempre o mesmo ponto da mesma curva). */
type PorProva = (indice: number, p: RegionPoint) => boolean

function lembrar(porProva: Map<number, boolean>, escondido: (p: RegionPoint) => boolean): PorProva {
  return (indice, p) => {
    const ja = porProva.get(indice)
    if (ja !== undefined) return ja
    const agora = escondido(p)
    porProva.set(indice, agora)
    return agora
  }
}

const idsDasReferencias = new WeakMap<object, number>()
let proximoIdDeReferencia = 1

/**
 * A chave do lugar escondido para `aguasParaJogador`: o texto e o número entram
 * como estão; o objeto, pela identidade (o mapa é imutável: sala, parede ou
 * zona editada é objeto novo, e a chave muda).
 */
export function chaveDoEscondido(partes: readonly (object | string | number)[]): string {
  return partes
    .map((parte) => {
      if (typeof parte !== 'object') return String(parte)
      let id = idsDasReferencias.get(parte)
      if (id === undefined) {
        id = proximoIdDeReferencia
        proximoIdDeReferencia += 1
        idsDasReferencias.set(parte, id)
      }
      return `#${id}`
    })
    .join('|')
}

/** Quais pontos de prova do lago caem dentro do contorno: só da forma, guardado pela curva. */
const dentroDaCurva = new WeakMap<readonly number[], { grid: number; porProva: Map<number, boolean> }>()

function dentroGuardado(xy: readonly number[], grid: number): Map<number, boolean> {
  const ja = dentroDaCurva.get(xy)
  if (ja !== undefined && ja.grid === grid) return ja.porProva
  const porProva = new Map<number, boolean>()
  dentroDaCurva.set(xy, { grid, porProva })
  return porProva
}

function areaComSinal(xy: readonly number[]): number {
  let soma = 0
  const n = xy.length / 2
  for (let i = 0, j = n - 1; i < n; j = i, i += 1) soma += xy[j * 2] * xy[i * 2 + 1] - xy[i * 2] * xy[j * 2 + 1]
  return soma / 2
}

/** Os trechos (fechado: dá a volta) em que todos os pontos são conhecidos. */
function trechosConhecidos(xy: readonly number[], fechado: boolean, conhecido: (i: number) => boolean): number[][] {
  const n = xy.length / 2
  const marca = Array.from({ length: n }, (_, i) => conhecido(i))
  if (marca.every(Boolean)) return [fechado ? [...xy.map(arred), arred(xy[0]), arred(xy[1])] : xy.map(arred)]
  // Fechado: começa logo depois de um ponto desconhecido, para o trecho que passa pelo índice 0 não partir ao meio.
  const inicio = fechado ? marca.indexOf(false) : -1
  const saida: number[][] = []
  let atual: number[] = []
  const fechar = (): void => {
    if (atual.length >= 4) saida.push(atual)
    atual = []
  }
  for (let k = 1; k <= n; k += 1) {
    const i = fechado ? (inicio + k) % n : k - 1
    if (marca[i]) atual.push(arred(xy[i * 2]), arred(xy[i * 2 + 1]))
    else fechar()
  }
  fechar()
  return saida
}

function recorteDaArea(xy: readonly number[], grid: number, livre: PorProva): RecorteDaAgua | null {
  if (xy.length < 6) return null
  // A água do lado em que o produto vetorial é positivo (`campo.ts`): o contorno no sentido da área positiva.
  const orientado = areaComSinal(xy) >= 0 ? xy : invertido(xy)
  // Índices de prova: o ponto i do contorno orientado é i; as provas das células vêm depois dele.
  const margens = trechosConhecidos(orientado, true, (i) => livre(i, { x: orientado[i * 2], y: orientado[i * 2 + 1] }))
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i + 1 < xy.length; i += 2) {
    x0 = Math.min(x0, xy[i])
    y0 = Math.min(y0, xy[i + 1])
    x1 = Math.max(x1, xy[i])
    y1 = Math.max(y1, xy[i + 1])
  }
  const celulas = new Set<string>()
  const dentro = dentroGuardado(xy, grid)
  const n = orientado.length / 2
  const lin0 = Math.floor(y0 / grid)
  const col0 = Math.floor(x0 / grid)
  const colunas = Math.floor(x1 / grid) - col0 + 1
  for (let lin = lin0; lin <= Math.floor(y1 / grid); lin += 1) {
    for (let col = col0; col <= Math.floor(x1 / grid); col += 1) {
      const temAgua = PROVAS.some(([fx, fy], k) => {
        const p = { x: (col + fx) * grid, y: (lin + fy) * grid }
        const indice = n + ((lin - lin0) * colunas + (col - col0)) * PROVAS.length + k
        let naAgua = dentro.get(indice)
        if (naAgua === undefined) {
          naAgua = dentroDoContorno(xy, p.x, p.y)
          dentro.set(indice, naAgua)
        }
        return naAgua && livre(indice, p)
      })
      if (temAgua) celulas.add(`${col},${lin}`)
    }
  }
  // A célula da margem conhecida também entra (a água dela pode não ter pego nenhum ponto de prova).
  for (const m of margens) {
    for (let i = 0; i + 1 < m.length; i += 2) celulas.add(`${Math.floor(m[i] / grid)},${Math.floor(m[i + 1] / grid)}`)
  }
  if (celulas.size === 0) return null
  return { celula: grid, celulas: [...celulas].sort(), margens }
}

function invertido(xy: readonly number[]): number[] {
  const out: number[] = []
  for (let i = xy.length - 2; i >= 0; i -= 2) out.push(xy[i], xy[i + 1])
  return out
}

/** O meio e as duas margens de cada ponto do rio, nesta ordem: os índices de prova 3i, 3i + 1 e 3i + 2. */
const LADOS_DO_RIO = [0, 1, -1] as const

function recorteDoRio(xy: readonly number[], meia: number, grid: number, livre: PorProva, escondido: PorProva): RecorteDaAgua | null {
  const n = xy.length / 2
  if (n < 2) return null
  const s: number[] = [0]
  for (let i = 1; i < n; i += 1) s.push(s[i - 1] + Math.hypot(xy[i * 2] - xy[i * 2 - 2], xy[i * 2 + 1] - xy[i * 2 - 1]))
  const conhecido: boolean[] = []
  for (let i = 0; i < n; i += 1) {
    const a = Math.max(0, i - 1)
    const b = Math.min(n - 1, i + 1)
    const dx = xy[b * 2] - xy[a * 2]
    const dy = xy[b * 2 + 1] - xy[a * 2 + 1]
    const l = Math.hypot(dx, dy) || 1
    const nx = -dy / l
    const ny = dx / l
    const x = xy[i * 2]
    const y = xy[i * 2 + 1]
    // Conhecido pelo meio ou por uma das margens, mas o meio nunca em lugar escondido dele.
    conhecido.push(!escondido(i * 3, { x, y }) && LADOS_DO_RIO.some((k, lado) => livre(i * 3 + lado, { x: x + nx * meia * k, y: y + ny * meia * k })))
  }
  // A folga: a ponta redonda do trecho e a margem de fora (1,3 casa) caem além do conhecido.
  // Nunca para dentro da sala escondida ou da zona oculta: o ponto de lá diria que o rio entra nela.
  const folga = meia + grid * 1.4
  const marcado = conhecido.slice()
  const deFora = (j: number): boolean => !escondido(j * 3, { x: xy[j * 2], y: xy[j * 2 + 1] })
  for (let i = 0; i < n; i += 1) {
    if (!conhecido[i]) continue
    for (let j = i - 1; j >= 0 && s[i] - s[j] <= folga && deFora(j); j -= 1) marcado[j] = true
    for (let j = i + 1; j < n && s[j] - s[i] <= folga && deFora(j); j += 1) marcado[j] = true
  }
  // A FASE da correnteza (`s0` do trecho) mede o rio só pelo que não está escondido: o pedaço escondido entra
  // pela reta entre as pontas de fora dele. Medido pela curva, trocar só o miolo escondido mudava a correnteza
  // visível rio abaixo (F-N05 da 0.5.62). Sem nada escondido, a fase é a própria `s`.
  const fase: number[] = [0]
  let ultimoDeFora = deFora(0) ? 0 : -1
  for (let i = 1; i < n; i += 1) {
    if (!deFora(i)) {
      fase.push(fase[i - 1])
      continue
    }
    const k = ultimoDeFora
    ultimoDeFora = i
    if (k < 0) {
      fase.push(0)
      continue
    }
    // Depois de um ponto de fora, a curva; saindo do escondido, a reta desde o último ponto de fora.
    fase.push(fase[k] + (k === i - 1 ? s[i] - s[k] : Math.hypot(xy[i * 2] - xy[k * 2], xy[i * 2 + 1] - xy[k * 2 + 1])))
  }
  const trechos: { s0: number; pontos: number[] }[] = []
  let atual: { s0: number; pontos: number[] } | null = null
  for (let i = 0; i < n; i += 1) {
    if (marcado[i]) {
      atual ??= { s0: arred(fase[i]), pontos: [] }
      atual.pontos.push(arred(xy[i * 2]), arred(xy[i * 2 + 1]))
    } else if (atual !== null) {
      if (atual.pontos.length >= 4) trechos.push(atual)
      atual = null
    }
  }
  if (atual !== null && atual.pontos.length >= 4) trechos.push(atual)
  return trechos.length === 0 ? null : { celula: grid, trechos }
}

/** A maioria dos pontos da curva cai em `lugar`: a água MORA lá. */
function moraEm(xy: readonly number[], lugar: (p: RegionPoint) => boolean): boolean {
  let dentro = 0
  for (let i = 0; i + 1 < xy.length; i += 2) if (lugar({ x: xy[i], y: xy[i + 1] })) dentro += 1
  return xy.length > 0 && dentro * 2 > xy.length / 2
}

/**
 * A água como o jogador a recebe, ou `null` (secreta, ou nada dela no que ele
 * conhece). `conhece`: o ponto é dele (visto, explorado); `escondido`: sala
 * escondida dele ou zona oculta. `mora`: o lugar que não esconde o que só PASSA
 * por ele, mas esconde a água que mora nele (a maioria da curva lá): a sala
 * secreta fechada, que para o jogador é chão aberto (F-N04 da 0.5.62).
 * `chave`: o estado do lugar escondido e da sala secreta (`chaveDoEscondido`);
 * com ela, `escondido` de cada ponto e `mora` ficam lembrados de um passo a
 * outro. Quem a passa garante que, com a mesma chave, os dois respondem igual.
 */
export function aguaParaJogador(
  agua: Agua,
  grid: number,
  conhece: (p: RegionPoint) => boolean,
  escondido: (p: RegionPoint) => boolean,
  mora: (p: RegionPoint) => boolean = () => false,
  chave?: string,
): Agua | null {
  if (agua.secret === true || grid <= 0) return null
  const xy = curvaGuardada(agua, grid)
  const guardado = chave === undefined ? null : guardadoDaCurva(xy, chave)
  const escondidoEm = lembrar(guardado === null ? new Map() : guardado.porProva, escondido)
  const livre = (indice: number, p: RegionPoint): boolean => !escondidoEm(indice, p) && conhece(p)
  const moraNele = guardado === null ? moraEm(xy, mora) : (guardado.mora ??= moraEm(xy, mora))
  if (moraNele) return null
  const recorte = agua.tipo === 'rio' ? recorteDoRio(xy, (larguraDoRio(agua) * grid) / 2, grid, livre, escondidoEm) : recorteDaArea(xy, grid, livre)
  if (recorte === null) return null
  // Sem nome (é do mestre) e sem a forma: só o que o desenho precisa.
  const saida: Agua = { id: agua.id, tipo: agua.tipo, pontos: [], cor: agua.cor, recorte }
  if (agua.tipo === 'rio') saida.largura = larguraDoRio(agua)
  if (agua.barra === true) saida.barra = true
  if (agua.velocidade !== undefined) saida.velocidade = agua.velocidade
  if (agua.ondas !== undefined) saida.ondas = agua.ondas
  if (agua.espuma !== undefined) saida.espuma = agua.espuma
  if (agua.piso !== undefined) saida.piso = agua.piso
  return saida
}

/** As águas do recorte do jogador; `undefined` = nenhuma (o campo não vai). */
export function aguasParaJogador(
  aguas: readonly Agua[] | undefined,
  grid: number,
  conhece: (p: RegionPoint) => boolean,
  escondido: (p: RegionPoint) => boolean,
  mora?: (p: RegionPoint) => boolean,
  chave?: string,
): Agua[] | undefined {
  if (aguas === undefined || aguas.length === 0) return undefined
  const saida = aguas.map((a) => aguaParaJogador(a, grid, conhece, escondido, mora, chave)).filter((a): a is Agua => a !== null)
  return saida.length > 0 ? saida : undefined
}
