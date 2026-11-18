import type { MapData, Region, RegionPoint, Wall } from '../types/map'
import type { SelectionSet } from './selectionModel'
import { canInteract } from './itemTransform'
import { pisoDe } from './pisos'
import { isAxisAlignedRect } from './roomOps'
import { normalizeRotation, roomRotationOf, rotationDelta, snapRoomRotation } from './roomRotation'

/**
 * ALINHAMENTO DAS PAREDES — pedido de 17/11/2026: "faz uma sistema de
 * alinhamento paras paredes que estamos precisando nunca sei quando uma parede
 * ta alinhada".
 *
 * DUAS RÉGUAS. O GRUDE (desenhar e puxar) pega deitada, em pé e a diagonal
 * certinha: 0°, 45°, 90° e os espelhos deles — e o verde do traço puxado
 * (`segmentoReto`) é o aviso desse grude. O SELO, o "Mostrar paredes tortas" e
 * o Endireitar só conhecem o ÂNGULO RETO, 0° e 90°: o mestre, 17/11/2026,
 * "Volta a só 0° e 90°". A parede a 45° exatos é "inclinada 45°", sem botão.
 * Quatro coisas saem deste módulo, todas contas puras (sem store, sem Pixi):
 *
 *  1. GRUDA SOZINHO (`grudarPonto`, `giroComGrude`): a ponta puxada vai para a
 *     reta quando o traço está a poucos graus dela. A folga é em GRAUS, não em
 *     px: 5° é o mesmo desvio num corredor de 2 m e num muro de 40 m, e não
 *     muda com o zoom. Traço curto demais na tela não gruda: a 10 px da âncora
 *     um px de tremor da mão já vale 6°, e a ponta ficaria pulando.
 *  2. VER (`alinhamentoDoSegmento`, `rotuloDoAlinhamento`): "reta ✓" (0°/90°),
 *     "torta 3°" (a poucos graus deles) ou "inclinada 30°" (todo o resto, a
 *     diagonal de 45° inclusive).
 *  3. ACHAR (`paredesTortasDoPiso`): as paredes de 1° a 5° fora de 0°/90°.
 *  4. CONSERTAR (`planoDeEndireitarSala`, `endireitarPoligono`): a sala torta,
 *     de volta a 0°/90°.
 *
 * QUEM MANDA NA PONTA PUXADA, do mais forte para o mais fraco (o canvas compõe
 * nesta ordem em `pixi/PixiCanvas.tsx` → `pontoComGrude`):
 *
 *  a. ÍMÃ DE PONTA (12 px de tela): a ponta cai exata na ponta de outra parede
 *     e nada mais mexe nela. Parede que não fecha deixa a luz e o jogador
 *     passarem; uma parede 2° torta é só feia, e o rótulo avisa.
 *  b. CTRL: solta tudo o que encaixa sozinho — guia, ímã (no arrasto) e este
 *     grude. Só a grade continua, porque ela é do interruptor e do Alt.
 *  c. GRADE do gesto: o ponto vai para a grade ANTES do grude.
 *  d. GUIA MAGENTA: encaixa o ponto nas vizinhas, eixo a eixo, também antes.
 *  e. GRUDE DE ÂNGULO, por último, sobre o ponto que a grade e a guia deixaram:
 *     a menos de 5° da reta ele tem a palavra final e põe a ponta NA reta (a
 *     coordenada é copiada da âncora, sem conta de seno). A guia que deixou de
 *     ser exata some; a que continua exata (inclusive a da própria âncora)
 *     fica. Assim os dois nunca disputam: a guia escolhe ONDE na reta, o grude
 *     garante que É reta.
 */

interface Ponto {
  x: number
  y: number
}

/** Até quantos graus da reta a ponta gruda — e até onde uma parede conta como "torta", e não "inclinada". */
export const GRUDA_TOLERANCIA_GRAUS = 5

/** Abaixo disto, em px de TELA, o traço é curto demais para o ângulo dele querer dizer alguma coisa. */
export const GRUDA_COMPRIMENTO_MINIMO_TELA_PX = 12

/** "Mostrar paredes tortas" marca de 1° a 5°: abaixo de 1° é ruído de conta e de giro, acima de 5° é diagonal de propósito. */
export const TORTA_MINIMO_GRAUS = 1

/** De quantos em quantos graus mora uma reta do GRUDE (0°, 45°, 90°…). */
const PASSO_DA_RETA = 45

/** De quantos em quantos graus mora uma reta do SELO e do Endireitar: só o ângulo reto (0°, 90°…). */
const PASSO_DO_ANGULO_RETO = 90

/** Desvio de lado, em px de mundo, abaixo do qual o traço já é reto (a mesma folga de `lib/endireitar.ts`). */
const FOLGA_DA_RETA_PX = 0.01

/** Abaixo disto (px de mundo) duas pontas são o mesmo ponto. */
const COMPRIMENTO_NULO = 1e-9

/**
 * Para onde o traço aponta, em graus de [0, 360). Com o y crescendo para baixo
 * (Pixi), crescer é girar no sentido horário na tela — a mesma conta do rótulo
 * do desenho (`pixi/world.ts` → `angleDegrees`).
 */
export function anguloDoSegmento(a: Ponto, b: Ponto): number {
  const graus = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
  return graus < 0 ? graus + 360 : graus
}

interface Desvio {
  /** A reta mais perto: múltiplo de `passo` em [0, 360). */
  alvo: number
  /** Quanto o traço passa da reta, em graus com sinal, de −passo/2 a passo/2. */
  graus: number
  comprimento: number
}

/** O desvio do traço até a reta mais perto, entre as que moram de `passo` em `passo` graus. */
function desvioDaReta(a: Ponto, b: Ponto, passo: number): Desvio {
  const angulo = anguloDoSegmento(a, b)
  const maisPerto = Math.round(angulo / passo) * passo
  return { alvo: maisPerto % 360, graus: angulo - maisPerto, comprimento: Math.hypot(b.x - a.x, b.y - a.y) }
}

/** O traço já está NA reta: o desvio de lado cabe na folga de conta. Comprimento zero conta como reto. */
function estaNaReta(desvio: Desvio): boolean {
  if (desvio.comprimento <= COMPRIMENTO_NULO) return true
  return desvio.comprimento * Math.sin((Math.abs(desvio.graus) * Math.PI) / 180) <= FOLGA_DA_RETA_PX
}

/** Reta (0°/90°), torta (a poucos graus deles) ou inclinada (todo o resto, a diagonal de 45° inclusive). */
export type Alinhamento =
  | { estado: 'reta' }
  | { estado: 'torta'; graus: number }
  /** `graus`: para onde o traço aponta, de 0 a 180; `null` quando são vários lados, cada um para um lado. */
  | { estado: 'inclinada'; graus: number | null }

const RETA: Alinhamento = { estado: 'reta' }

/**
 * O alinhamento de um traço, na régua do selo: só o ângulo reto. A 45° exatos
 * é "inclinada 45°" — o Endireitar a deitaria, e o selo não chama de reta o que
 * o Endireitar mudaria.
 */
export function alinhamentoDoSegmento(a: Ponto, b: Ponto): Alinhamento {
  const desvio = desvioDaReta(a, b, PASSO_DO_ANGULO_RETO)
  if (estaNaReta(desvio)) return RETA
  const graus = Math.abs(desvio.graus)
  if (graus <= GRUDA_TOLERANCIA_GRAUS) return { estado: 'torta', graus }
  return { estado: 'inclinada', graus: anguloDoSegmento(a, b) % 180 }
}

/**
 * O traço está numa reta do GRUDE (0°, 45°, 90°…)? É o que pinta a parede de
 * verde enquanto ela é puxada: o aviso de que ela grudou, a diagonal inclusive.
 */
export function segmentoReto(a: Ponto, b: Ponto): boolean {
  return estaNaReta(desvioDaReta(a, b, PASSO_DA_RETA))
}

/** "0,4" abaixo de um grau (com vírgula, como as medidas do mapa), inteiro dali para cima. */
function grausCurtos(graus: number): string {
  if (graus >= 0.95) return String(Math.round(graus))
  return Math.max(0.1, Math.round(graus * 10) / 10).toFixed(1).replace('.', ',')
}

/** O selo do painel: "reta ✓", "torta 3°", "inclinada 30°". */
export function rotuloDoAlinhamento(alinhamento: Alinhamento): string {
  if (alinhamento.estado === 'reta') return 'reta ✓'
  if (alinhamento.estado === 'torta') return `torta ${grausCurtos(alinhamento.graus)}°`
  return alinhamento.graus === null ? 'inclinada' : `inclinada ${Math.round(alinhamento.graus)}°`
}

// ─────────────────────────────────────────────────────────────
// Gruda sozinho
// ─────────────────────────────────────────────────────────────

/** A reta que passa pela âncora e em que a ponta gruda: um ponto e uma direção (de 0°, 45°, 90° ou 135°). */
interface Reta {
  ancora: Ponto
  /** Múltiplo de 45 em [0, 180): a reta não tem sentido, só direção. */
  direcao: 0 | 45 | 90 | 135
  /** Quanto a ponta estava fora dela, em graus. */
  desvio: number
}

function direcaoDaReta(alvo: number): Reta['direcao'] {
  const dobrado = alvo % 180
  if (dobrado === 45) return 45
  if (dobrado === 90) return 90
  if (dobrado === 135) return 135
  return 0
}

/** A reta da âncora em que `ponto` grudaria, ou `null`: longe demais dela, ou traço curto demais. */
function retaParaGrudar(ancora: Ponto, ponto: Ponto, comprimentoMinimo: number): Reta | null {
  const desvio = desvioDaReta(ancora, ponto, PASSO_DA_RETA)
  if (desvio.comprimento < comprimentoMinimo || desvio.comprimento <= COMPRIMENTO_NULO) return null
  if (Math.abs(desvio.graus) > GRUDA_TOLERANCIA_GRAUS) return null
  return { ancora, direcao: direcaoDaReta(desvio.alvo), desvio: Math.abs(desvio.graus) }
}

/**
 * O ponto da reta mais perto de `ponto`. Deitada e em pé COPIAM a coordenada
 * da âncora (x1 === x2 sai exato, sem ruído de seno); a outra coordenada é a
 * do ponteiro, então a ponta acompanha a mão ao longo da reta em vez de manter
 * o comprimento. Na diagonal, os dois lados ficam com o mesmo tamanho.
 */
function projetarNaReta(reta: Reta, ponto: Ponto): Ponto {
  const { ancora } = reta
  if (reta.direcao === 0) return { x: ponto.x, y: ancora.y }
  if (reta.direcao === 90) return { x: ancora.x, y: ponto.y }
  const dx = ponto.x - ancora.x
  const dy = ponto.y - ancora.y
  const lado = (Math.abs(dx) + Math.abs(dy)) / 2
  return { x: ancora.x + (dx < 0 ? -lado : lado), y: ancora.y + (dy < 0 ? -lado : lado) }
}

const VETOR_DA_DIRECAO: Record<Reta['direcao'], Ponto> = {
  0: { x: 1, y: 0 },
  45: { x: 1, y: 1 },
  90: { x: 0, y: 1 },
  135: { x: 1, y: -1 },
}

/** Onde duas retas se cruzam; `null` quando são paralelas. Deitada e em pé copiam a coordenada da âncora. */
function cruzamento(p: Reta, q: Reta): Ponto | null {
  const u = VETOR_DA_DIRECAO[p.direcao]
  const v = VETOR_DA_DIRECAO[q.direcao]
  const denominador = u.x * v.y - u.y * v.x
  if (denominador === 0) return null
  const t = ((q.ancora.x - p.ancora.x) * v.y - (q.ancora.y - p.ancora.y) * v.x) / denominador
  const ponto = { x: p.ancora.x + t * u.x, y: p.ancora.y + t * u.y }
  for (const reta of [p, q]) {
    if (reta.direcao === 0) ponto.y = reta.ancora.y
    if (reta.direcao === 90) ponto.x = reta.ancora.x
  }
  return ponto
}

export interface PontoGrudado {
  ponto: Ponto
  /** A ponta saiu de onde estava para ficar numa reta. */
  grudou: boolean
}

/**
 * GRUDA SOZINHO: leva `ponto` para a reta das âncoras quando o traço até elas
 * está a menos de `GRUDA_TOLERANCIA_GRAUS` de 0°, 45° ou 90°.
 *
 * Uma âncora: a outra ponta da parede (ao desenhar e ao puxar a ponta). Duas:
 * os vizinhos do vértice de uma sala — se os dois lados querem grudar, o
 * vértice vai para o cruzamento das duas retas (o canto reto); se só um quer,
 * vai para a reta dele; se as duas retas são paralelas, ganha a de menor desvio.
 *
 * `comprimentoMinimo` em px de MUNDO (`GRUDA_COMPRIMENTO_MINIMO_TELA_PX` pelo
 * zoom): lado mais curto que isso não gruda. Nada a grudar devolve o MESMO
 * ponto, para quem chama saber que a guia magenta continua valendo.
 */
export function grudarPonto(ponto: Ponto, ancoras: readonly Ponto[], comprimentoMinimo: number): PontoGrudado {
  const retas: Reta[] = []
  for (const ancora of ancoras) {
    const reta = retaParaGrudar(ancora, ponto, comprimentoMinimo)
    if (reta !== null) retas.push(reta)
  }
  if (retas.length === 0) return { ponto, grudou: false }
  const [primeira, segunda] = [...retas].sort((p, q) => p.desvio - q.desvio)
  const alvo = (segunda === undefined ? null : cruzamento(primeira, segunda)) ?? projetarNaReta(primeira, ponto)
  return { ponto: alvo, grudou: alvo.x !== ponto.x || alvo.y !== ponto.y }
}

/**
 * Os dois vizinhos de um vértice do polígono (o de antes e o de depois): as
 * âncoras de `grudarPonto` quando o mestre puxa o vértice de uma sala. Menos de
 * três pontos não fecham sala nenhuma, e o índice de fora não tem vizinho.
 */
export function vizinhosDoVertice(pontos: readonly Ponto[], indice: number): Ponto[] {
  const total = pontos.length
  if (total < 3 || !Number.isInteger(indice) || indice < 0 || indice >= total) return []
  const antes = pontos[(indice - 1 + total) % total]
  const depois = pontos[(indice + 1) % total]
  return [{ x: antes.x, y: antes.y }, { x: depois.x, y: depois.y }]
}

/**
 * O ângulo da sala no arrasto da alça de girar. Solto, gruda no quarto de
 * volta (0°, 90°, 180°, −90°) quando está a menos de `GRUDA_TOLERANCIA_GRAUS`
 * dele, e fora disso anda de grau em grau, como antes. Shift continua de 15 em
 * 15. `livre` (Ctrl): de grau em grau sempre, para deixar a sala a 3° de
 * propósito.
 */
export function giroComGrude(graus: number, shift: boolean, livre: boolean): number {
  if (shift || livre) return snapRoomRotation(graus, shift)
  const quarto = normalizeRotation(Math.round(graus / 90) * 90)
  return Math.abs(rotationDelta(graus, quarto)) <= GRUDA_TOLERANCIA_GRAUS ? quarto : snapRoomRotation(graus, false)
}

// ─────────────────────────────────────────────────────────────
// A sala: selo e conserto
// ─────────────────────────────────────────────────────────────

/** Quanto dois lados podem diferir (fração do comprimento) e ainda serem "do mesmo tamanho". */
const FOLGA_DO_LADO_IGUAL = 0.02
/** Quanto duas viradas podem diferir, em graus, e ainda serem "a mesma virada". */
const FOLGA_DA_VIRADA_IGUAL = 1.5
/** De quantos lados em diante o polígono regular é uma sala redonda (o quadrado e o triângulo não são). */
const LADOS_DA_SALA_REDONDA = 5

/**
 * Sala REDONDA: a Sala Circular e o Polígono Regular, todos os lados do mesmo
 * tamanho e todas as viradas iguais. Os lados dela passam por todos os ângulos
 * de propósito — um círculo de 64 lados tem lado a 2,8° —, então ela não é
 * "torta", não entra no "Mostrar paredes tortas" e o Endireitar não a amassa.
 */
export function salaRedonda(pontos: readonly Ponto[]): boolean {
  const n = pontos.length
  if (n < LADOS_DA_SALA_REDONDA) return false
  const lados = pontos.map((p, i) => Math.hypot(pontos[(i + 1) % n].x - p.x, pontos[(i + 1) % n].y - p.y))
  const maior = Math.max(...lados)
  if (maior <= COMPRIMENTO_NULO || maior - Math.min(...lados) > maior * FOLGA_DO_LADO_IGUAL) return false
  const viradas = pontos.map((p, i) => normalizeRotation(anguloDoSegmento(p, pontos[(i + 1) % n]) - anguloDoSegmento(pontos[(i + n - 1) % n], p)))
  return Math.max(...viradas) - Math.min(...viradas) <= FOLGA_DA_VIRADA_IGUAL
}

/**
 * O selo da sala: "torta" com o maior desvio dos lados tortos; "reta" quando
 * todo lado está numa reta; "inclinada" quando sobra lado em diagonal de
 * propósito e nenhum torto. Sala redonda não tem selo (`null`).
 */
export function alinhamentoDaSala(pontos: readonly Ponto[]): Alinhamento | null {
  if (pontos.length < 3 || salaRedonda(pontos)) return null
  let pior = 0
  let inclinada = false
  pontos.forEach((p, i) => {
    const lado = alinhamentoDoSegmento(p, pontos[(i + 1) % pontos.length])
    if (lado.estado === 'torta') pior = Math.max(pior, lado.graus)
    else if (lado.estado === 'inclinada') inclinada = true
  })
  if (pior > 0) return { estado: 'torta', graus: pior }
  return inclinada ? { estado: 'inclinada', graus: null } : RETA
}

type TipoDoLado = 'h' | 'v' | 'livre'

/** Deitado, em pé, ou livre: a mais de 5° do ângulo reto (a diagonal de 45° inclusive) ou curto demais. */
function tipoDoLado(a: Ponto, b: Ponto, comprimentoMinimo: number): TipoDoLado {
  const desvio = desvioDaReta(a, b, PASSO_DO_ANGULO_RETO)
  if (desvio.comprimento < comprimentoMinimo || Math.abs(desvio.graus) > GRUDA_TOLERANCIA_GRAUS) return 'livre'
  return desvio.alvo % 180 === 0 ? 'h' : 'v'
}

/** Grupos de vértices que têm de ficar com a MESMA coordenada (união de conjuntos, com compressão de caminho). */
function gruposDe(n: number, pares: readonly [number, number][]): number[][] {
  const pai = Array.from({ length: n }, (_, i) => i)
  const raiz = (i: number): number => {
    let r = i
    while (pai[r] !== r) r = pai[r]
    while (pai[i] !== r) [pai[i], i] = [r, pai[i]]
    return r
  }
  for (const [a, b] of pares) pai[raiz(a)] = raiz(b)
  const grupos = new Map<number, number[]>()
  for (let i = 0; i < n; i += 1) grupos.set(raiz(i), [...(grupos.get(raiz(i)) ?? []), i])
  return [...grupos.values()].filter((grupo) => grupo.length > 1)
}

/** Folga para dizer que uma coordenada já está na grade do mapa. */
const FOLGA_DA_GRADE = 1e-6

/**
 * A coordenada de um grupo de vértices que vão ficar alinhados: a de quem já
 * está na grade do mapa (a mais perto da média, se houver mais de uma), senão a
 * média. Sala desenhada na grade e depois entortada volta para a grade, e o
 * canto que estava certo não sai do lugar.
 */
function coordenadaDoGrupo(valores: readonly number[], grade: number): number {
  const media = valores.reduce((soma, v) => soma + v, 0) / valores.length
  if (!Number.isFinite(grade) || grade <= 0) return media
  const naGrade = valores.filter((v) => Math.abs(v - Math.round(v / grade) * grade) <= FOLGA_DA_GRADE)
  if (naGrade.length === 0) return media
  return naGrade.reduce((melhor, v) => (Math.abs(v - media) < Math.abs(melhor - media) ? v : melhor))
}

/**
 * ENDIREITAR O POLÍGONO de uma sala: cada lado a menos de 5° de deitado ou em
 * pé vira reto, e os outros (diagonal, a de 45° inclusive, e lado curto demais)
 * ficam como estão, ligando os mesmos cantos. A ordem e a quantidade de
 * vértices não mudam, então as paredes presas a cada lado acompanham
 * (`mapFactory.updateRegionPoint`).
 *
 * Os vértices ligados por lados deitados ficam com o mesmo y, e os ligados por
 * lados em pé, com o mesmo x (`coordenadaDoGrupo`). Sai exato, e a sala em L
 * torta vira um L reto. Até 17/11/2026 a quina chanfrada perto de 45° também ia
 * para os 45°; o mestre pediu o Endireitar só em 0° e 90°.
 *
 * Se algum lado encolheria a nada (dois cantos no mesmo ponto), desiste e
 * devolve a sala como estava. Nada a mudar devolve o MESMO array.
 */
export function endireitarPoligono(pontos: readonly RegionPoint[], grade: number, comprimentoMinimo = 1): readonly RegionPoint[] {
  const n = pontos.length
  if (n < 3 || salaRedonda(pontos)) return pontos
  const tipos = pontos.map((p, i) => tipoDoLado(p, pontos[(i + 1) % n], comprimentoMinimo))
  const novos = pontos.map((p) => ({ x: p.x, y: p.y }))

  const lados = (tipo: TipoDoLado): [number, number][] => {
    const pares: [number, number][] = []
    tipos.forEach((t, i) => {
      if (t === tipo) pares.push([i, (i + 1) % n])
    })
    return pares
  }
  for (const grupo of gruposDe(n, lados('h'))) {
    const y = coordenadaDoGrupo(grupo.map((i) => pontos[i].y), grade)
    for (const i of grupo) novos[i].y = y
  }
  for (const grupo of gruposDe(n, lados('v'))) {
    const x = coordenadaDoGrupo(grupo.map((i) => pontos[i].x), grade)
    for (const i of grupo) novos[i].x = x
  }

  const encolheu = novos.some((p, i) => {
    const q = novos[(i + 1) % n]
    const antes = Math.hypot(pontos[(i + 1) % n].x - pontos[i].x, pontos[(i + 1) % n].y - pontos[i].y)
    return antes > COMPRIMENTO_NULO && Math.hypot(q.x - p.x, q.y - p.y) <= COMPRIMENTO_NULO
  })
  if (encolheu) return pontos
  return novos.some((p, i) => p.x !== pontos[i].x || p.y !== pontos[i].y) ? novos : pontos
}

/** O que o Endireitar faz com uma sala: gira a retangular de volta à reta, ou acerta os cantos do polígono. */
export type PlanoDaSala = { tipo: 'giro'; graus: number } | { tipo: 'pontos'; pontos: readonly RegionPoint[] }

/**
 * O plano para endireitar uma sala, ou `null` quando não há o que fazer (já
 * reta, redonda, ou inclinada a mais de 5° de deitada e de em pé — a 45° inclusive).
 *
 * Sala RETANGULAR girada: gira de volta até o quarto de volta mais perto (0°,
 * 90°, 180°, −90°), pelo mesmo caminho do campo "Rotação" (`mapFactory.rotateRegion`) — continua
 * retângulo, do mesmo tamanho, as sub-salas vão junto e a que saiu da grade
 * volta para ela. Polígono (e retângulo de arquivo antigo, torto com o ângulo
 * em zero): `endireitarPoligono`.
 */
export function planoDeEndireitarSala(regiao: Pick<Region, 'points' | 'room'>, grade: number): PlanoDaSala | null {
  if (regiao.room?.shape === 'rect' && regiao.points.length === 4) {
    const giro = roomRotationOf(regiao.room)
    const falta = rotationDelta(giro, Math.round(giro / PASSO_DO_ANGULO_RETO) * PASSO_DO_ANGULO_RETO)
    if (falta !== 0 && Math.abs(falta) <= GRUDA_TOLERANCIA_GRAUS) return { tipo: 'giro', graus: falta }
    if (isAxisAlignedRect(regiao.points)) return null
  }
  const pontos = endireitarPoligono(regiao.points, grade)
  return pontos === regiao.points ? null : { tipo: 'pontos', pontos }
}

/**
 * As salas e regiões que a seleção alcança, uma vez cada: a região selecionada
 * e a dona da parede de sala selecionada. Mesmo com a parede de UM lado
 * selecionada o conserto é da sala inteira: endireitar um lado só abriria a
 * quina com o vizinho.
 *
 * Uma passada pelas paredes, e não um `find` por item: com o mapa inteiro
 * selecionado (14 mil paredes) os `find` custariam centenas de ms, e o painel
 * refaz esta conta a cada mudança do mapa (a mesma lição de `lib/endireitar.ts`).
 */
export function regioesDaSelecao(map: MapData, selection: SelectionSet): Region[] {
  const ids = new Set<string>()
  const paredes = new Set<string>()
  for (const item of selection) {
    if (item.kind === 'region') ids.add(item.id)
    else if (item.kind === 'wall') paredes.add(item.id)
  }
  if (paredes.size > 0) {
    for (const parede of map.walls) {
      if (parede.regionId !== undefined && paredes.has(parede.id)) ids.add(parede.regionId)
    }
  }
  return ids.size === 0 ? [] : map.regions.filter((r) => ids.has(r.id))
}

/** Há sala torta na seleção — travada inclusive, que é assunto do aviso. É o que faz o Alt agir em vez de ficar mudo. */
export function haSalaParaEndireitar(map: MapData, selection: SelectionSet): boolean {
  return regioesDaSelecao(map, selection).some((regiao) => planoDeEndireitarSala(regiao, map.grid) !== null)
}

/** O botão "Endireitar" teria o que fazer numa sala da seleção: torta e destravada. */
export function endireitarSalaMudariaAlgo(map: MapData, selection: SelectionSet): boolean {
  return regioesDaSelecao(map, selection).some((regiao) => canInteract(regiao) && planoDeEndireitarSala(regiao, map.grid) !== null)
}

// ─────────────────────────────────────────────────────────────
// Achar as tortas
// ─────────────────────────────────────────────────────────────

/** A parede está de 1° a 5° fora de deitada ou de em pé — o que o "Mostrar paredes tortas" marca. A de 43° não é torta: é inclinada. */
export function paredeTorta(parede: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>): boolean {
  const alinhamento = alinhamentoDoSegmento({ x: parede.x1, y: parede.y1 }, { x: parede.x2, y: parede.y2 })
  return alinhamento.estado === 'torta' && alinhamento.graus >= TORTA_MINIMO_GRAUS
}

/**
 * As paredes tortas do piso. Ficam de fora as que seguem um traço do Pincel ou
 * do Caminho (`desenhoId`: tortas de propósito, e quem as move é o desenho) e
 * as de sala redonda (`salaRedonda`).
 */
export function paredesTortasDoPiso(map: Pick<MapData, 'walls' | 'regions'>, piso: number): Wall[] {
  const redondas = new Map<string, boolean>()
  const daSalaRedonda = (regionId: string): boolean => {
    const sabido = redondas.get(regionId)
    if (sabido !== undefined) return sabido
    const regiao = map.regions.find((r) => r.id === regionId)
    const redonda = regiao !== undefined && salaRedonda(regiao.points)
    redondas.set(regionId, redonda)
    return redonda
  }
  return map.walls.filter((parede) => {
    if (parede.desenhoId !== undefined || pisoDe(parede) !== piso || !paredeTorta(parede)) return false
    return parede.regionId === undefined || !daSalaRedonda(parede.regionId)
  })
}

/** O selo da parede selecionada; a de sala redonda e a que segue um desenho não têm selo. */
export function alinhamentoDaParede(map: Pick<MapData, 'regions'>, parede: Wall): Alinhamento | null {
  if (parede.desenhoId !== undefined) return null
  if (parede.regionId !== undefined) {
    const regiao = map.regions.find((r) => r.id === parede.regionId)
    if (regiao !== undefined && salaRedonda(regiao.points)) return null
  }
  return alinhamentoDoSegmento({ x: parede.x1, y: parede.y1 }, { x: parede.x2, y: parede.y2 })
}
