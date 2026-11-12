/**
 * TOCO COM MACHADO CRAVADO de cima com volume (lote 10 dos objetos novos,
 * 11/11/2026): o cepo de rachar lenha. Um toco BAIXO E LARGO, serrado reto,
 * com a casca em roda (gasta num lado, onde aparece o alburno), e o TOPO liso
 * todo MARCADO DE GOLPES: os talhos curtos do machado, quase todos no rumo do
 * cabo (o lenhador fica sempre no mesmo lugar), cada um com a parede escura do
 * lado da luz e a beira clara do outro, uns cavacos soltos em cima e os anéis
 * apagados pelo uso. Cravado nele, o MACHADO: a cabeça de ferro batido, com o
 * fio polido entrando na madeira (a fenda escura e as fibras levantadas na
 * frente dele), a ponta do cabo com a cunha saindo do olho e o CABO comprido
 * saindo para baixo à esquerda, subindo no ar até o punho com o nó, e a sombra
 * dele caindo longe no chão. Em volta, a LENHA RACHADA: cinco achas (umas com a
 * face rachada para cima, clara, com a tira de casca de um lado; outras com a
 * casca para cima) e, no chão, as LASCAS compridas e os CAVACOS.
 *
 * Não tem raiz, musgo nem cogumelo: é lugar de trabalho, e não o toco velho e
 * quieto (`tocoDeArvore.ts`, de outro grupo). A cabeça do machado vai vista de
 * lado (o fio, o olho e a barba à mostra): cravada de pé, do alto ela seria um
 * risco de ferro. É a única peça desenhada fora da vista de cima.
 *
 * Na 3/4 (derivada, `tresQuartos.ts`): o cepo é uma coluna (sobe o topo, e a
 * frente sai da casca) e o machado inteiro sobe com ele (cada peça presa ao
 * meio do cepo, `presa`), com o cabo no ar acima da sombra dele; cada acha é
 * uma coluna baixa, da grossura dela; lascas e cavacos ficam no chão.
 *
 * A 25% de zoom sobram a roda clara do topo com o aro escuro da casca, o risco
 * escuro do cabo saindo dela com a cabeça de ferro na ponta de dentro e as
 * achas em volta: é o que diz "cepo com machado" e não "toco de árvore"
 * (raízes em estrela) nem "mesa redonda". Material: `lenha` (a casca do cepo e
 * das achas; o cerne sai dela, como nos troncos). O ferro e o cabo são fixos.
 * As medidas saem do menor lado da pegada (1 x 1 casa de partida) e os lugares
 * das achas, de frações dela: o cepo continua redondo no objeto esticado.
 */
import { hash, limitar01, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { capsula, dentroDe, menos, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type Textura } from './motor'
import { G, QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'

const VOLTA = Math.PI * 2
/** O menor meio lado da pegada de partida (1 x 1 casa): os px do desenho valem nele. */
const MEIO_LADO_DE_PARTIDA = G / 2
/** De onde vem a luz, no chão (a do motor: de cima à esquerda). */
const RUMO_DA_LUZ: Ponto = [-0.79, -0.61]

// ---------- o cepo ----------

/** Altura do cepo, em casas: abaixo do joelho, a altura boa de rachar. */
const ALTURA_DO_CEPO = 0.2
/** O meio do cepo (frações da meia pegada: um pouco acima e à direita, o cabo sai para o outro lado), o raio e a grossura da casca (frações do menor meio lado). */
const MEIO_DO_CEPO: Ponto = [0.1, -0.12]
const RAIO_DO_CEPO = 0.58
const CASCA = 0.085
/** Onde a casca caiu (o rumo do meio e a meia abertura, radianos): aparece o alburno, claro e cinzento. */
const SEM_CASCA: readonly [number, number] = [0.85, 0.36]
const ALBURNO: Rgb = [0xa8, 0x98, 0x7c]
/** Pontos do arco da fatia sem casca. */
const LANCES_DA_FATIA = 8

/** O topo gasto: o cinza do uso (e quanto dele), os anéis apagados (quantos por raio, o escuro e quanto aparecem) e o miolo, fora do meio. */
const CINZA_DO_USO: Rgb = [0x9a, 0x92, 0x84]
const QUANTO_DE_USO = 0.34
const ANEIS = 5
const FATOR_DO_ANEL = 0.74
const QUANTO_DE_ANEL = 0.34
const MIOLO: Ponto = [-0.08, 0.1]
const RAIO_DO_MIOLO = 0.06

/** Os talhos do machado no topo: quantos, o comprimento (px do protótipo), o espalho do rumo (o de um em três foge mais) e até onde vão (fração do raio do topo). */
const GOLPES = 22
const GOLPE_CURTO = 2.2
const GOLPE_COMPRIDO = 5.8
const ESPALHO_DO_GOLPE = 0.5
const ESPALHO_DO_GOLPE_TORTO = 1.4
const GOLPES_ATE = 0.86
/** O talho: a parede de cá, na sombra, bem escura (em vezes o cerne); a de lá, virada para a luz, clara. */
const FATOR_DO_TALHO = 0.36
const FATOR_DA_BEIRA_DO_TALHO = 1.16
/** Os cavacos que ficaram em cima do topo: o lugar (frações do raio do topo, a partir do meio) e o tamanho (px do protótipo). */
const CAVACOS_NO_TOPO: readonly (readonly [number, number, number])[] = [
  [0.52, 0.34, 1.5],
  [0.2, 0.62, 1.1],
  [-0.58, 0.22, 1.3],
  [0.42, -0.5, 1],
]

// ---------- o machado ----------

/** O olho do machado (a partir do meio do cepo, px do protótipo), o rumo do cabo (radianos de tela: para baixo à esquerda) e o comprimento dele visto do alto. */
const OLHO: Ponto = [-2.2, -1.4]
const RUMO_DO_CABO = 2.47
const COMPRIMENTO_DO_CABO = 31
/** Onde o cabo começa (dentro do olho), o quanto ele verga para o lado e quantos lances tem. */
const CABO_DE = 1.6
const VERGA_DO_CABO = 0.5
const LANCES_DO_CABO = 16
/** A meia grossura do cabo ao longo dele (a, meia, px do protótipo): fino no meio, o punho e o nó na ponta. */
const PERFIL_DO_CABO: readonly (readonly [number, number])[] = [
  [CABO_DE, 1.45],
  [6, 1.42],
  [18, 1.26],
  [26, 1.36],
  [28.4, 1.5],
  [29.6, 1.86],
  [30.5, 1.6],
  [COMPRIMENTO_DO_CABO, 0.9],
]
/** O punho escurecido pela mão: de onde a onde ele escurece (px ao longo do cabo) e quanto. */
const PUNHO_DE = 21
const PUNHO_ATE = 28
const ESCURO_DO_PUNHO = 0.16
/** Quanto o cabo sobe por px andado (cravado, ele fica a uns 27 graus do chão) e a folga do olho acima do topo, px do protótipo. */
const SUBIDA_DO_CABO = 0.5
const OLHO_ACIMA_DO_TOPO = 2.5

/**
 * A cabeça vista de lado, no referencial do cabo: `a` ao comprido dele (o punho para +a), `b` de través (o fio
 * para +b), px do protótipo. A costa (o martelo) para -b, o olho em volta do cabo e a lâmina abrindo até a linha
 * em que o fio entra na madeira, com a barba puxada para o lado do punho.
 */
const CABECA: readonly Ponto[] = [
  [-1.6, -3.5],
  [1.6, -3.5],
  [2.3, -2.9],
  [2.4, -1.2],
  [2.3, 1.9],
  [2.6, 3.3],
  [3.4, 4.8],
  [4.6, 6],
  [-3.6, 6],
  [-2.9, 4.8],
  [-2.45, 3.3],
  [-2.3, 1.9],
  [-2.4, -1.2],
  [-2.3, -2.9],
]
/** A faixa polida do fio (de onde ela começa até a entrada), a linha em que o fio entra na madeira e as fibras que ele levantou. */
const FIO: readonly Ponto[] = [
  [-2.85, 4.6],
  [3.3, 4.6],
  [4.6, 6],
  [-3.6, 6],
]
const ENTRADA = 6
const FENDA: readonly [Ponto, Ponto] = [
  [-4.2, ENTRADA + 0.2],
  [5.2, ENTRADA + 0.2],
]
const FIBRAS: readonly [Ponto, Ponto] = [
  [-3.6, ENTRADA + 1],
  [4.4, ENTRADA + 1],
]
/** A ponta do cabo saindo do olho, do outro lado da cabeça, com a cunha. */
const PONTA_DO_CABO: readonly Ponto[] = [
  [-3.3, -1.1],
  [-2.3, -1.15],
  [-2.3, 1.35],
  [-3.3, 1.3],
]
const CUNHA: readonly [Ponto, Ponto] = [
  [-2.8, -0.85],
  [-2.8, 1.05],
]
/** A altura média da cabeça acima do topo (px do protótipo): a sombra dela no topo anda por ela. */
const ACIMA_DA_CABECA = 6
/** A cabeça (e o fio, a fenda, a ponta do cabo e a cunha) maior que o desenho acima: o machado é o que salta aos olhos. */
const ESCALA_DA_CABECA = 1.25

// ---------- a lenha em volta ----------

/** Cada acha: o meio (frações da meia pegada), o comprimento e a largura (frações do menor meio lado), o giro, o lado que ficou para cima e o tom. */
interface Acha {
  readonly x: number
  readonly y: number
  readonly comp: number
  readonly larg: number
  readonly ang: number
  readonly face: 'rachada' | 'casca'
  readonly tom: number
}
const ACHAS: readonly Acha[] = [
  { x: 0.41, y: 0.71, comp: 0.66, larg: 0.235, ang: -0.18, face: 'rachada', tom: 1 },
  { x: 0.84, y: -0.07, comp: 0.55, larg: 0.2, ang: 1.42, face: 'casca', tom: 0.95 },
  { x: -0.66, y: -0.64, comp: 0.5, larg: 0.19, ang: 0.6, face: 'rachada', tom: 1.04 },
  { x: 0.57, y: -0.79, comp: 0.45, larg: 0.18, ang: -0.35, face: 'casca', tom: 0.9 },
  { x: -0.77, y: -0.14, comp: 0.46, larg: 0.19, ang: 1.25, face: 'rachada', tom: 0.98 },
]
/** A grossura da acha deitada, em casas (a altura da coluna dela na 3/4). */
const ALTURA_DA_ACHA = 0.07
/** As lascas compridas: o meio (frações da meia pegada), o comprimento (fração do menor meio lado) e o giro. */
const LASCAS: readonly (readonly [number, number, number, number])[] = [
  [-0.3, 0.9, 0.3, 0.25],
  [0.93, 0.56, 0.26, 1.9],
  [-0.9, 0.44, 0.22, -1.2],
  [0.06, -0.92, 0.28, 0.1],
]
const MEIA_LARGURA_DA_LASCA = 0.75
/** Os cavacos no chão: quantos, entre que distâncias do meio do cepo (frações do menor meio lado) e o tamanho (px do protótipo). */
const CAVACOS = 22
const CAVACO_DE = 0.62
const CAVACO_ATE = 1.08
const CAVACO_MENOR = 1.3
const CAVACO_MAIOR = 2.8
/** O cavaco não fica a menos disto da beira da pegada (fração da meia pegada). */
const BEIRA_DO_CAVACO = 0.88

// ---------- os materiais fixos ----------

/** O ferro batido da cabeça, o aço polido do fio e o cabo de freixo, escuro de óleo e de mão. */
const FERRO_DA_CABECA: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.92)) }
const ACO_DO_FIO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.36)) }
const CABO_DO_MACHADO: MaterialDaPeca = { classe: 'madeira', rgb: [0x94, 0x6e, 0x4a] }

/** O cerne do corte de cada madeira, claro e quente, contido: os mesmos dos troncos (`troncos.ts`). */
const CERNE_DO_CARVALHO: Rgb = [0xb0, 0x8a, 0x5e]
const CERNE_DO_PINHO: Rgb = [0xbf, 0x9b, 0x69]
const CERNE_DA_BETULA: Rgb = [0xc6, 0xb2, 0x8b]
/** A casca do pinho (a lenha x 1,1) é a mais clara das duas fendidas: a luz dela separa do carvalho. */
const VERMELHO_DA_CASCA_DO_PINHO = 115
/** O tom das achas e lascas (a madeira rachada, mais clara que o topo gasto) e o dos cavacos novos e velhos. */
const FATOR_DA_RACHADA = 1.06
const FATOR_DO_CAVACO_NOVO = 1.1
const FATOR_DO_CAVACO_VELHO = 0.84

// ---------- ajudantes ----------

function vezes(c: Rgb, k: number): Rgb {
  return [c[0] * k, c[1] * k, c[2] * k]
}

function misturarEm(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

/** O cerne que combina com a casca escolhida: a bétula pela textura, o pinho pela luz da casca. */
function cerneDa(casca: MaterialDaPeca): Rgb {
  if (casca.casca === 'betula') return CERNE_DA_BETULA
  return casca.rgb[0] >= VERMELHO_DA_CASCA_DO_PINHO ? CERNE_DO_PINHO : CERNE_DO_CARVALHO
}

/** O torto do contorno do cepo: serrado, ele é quase redondo (três ondas pequenas). */
function tortoDoCepo(teta: number): number {
  return 0.022 * Math.cos(3 * teta + 0.4) + 0.016 * Math.cos(5 * teta - 1) + 0.01 * Math.cos(8 * teta + 2.1)
}

/**
 * A mesma forma com a caixa de pintura centrada em (cx, cy) (`bancadaDeFerramentas.ts`): o desenho não muda,
 * mas o meio da caixa, que é o que a 3/4 lê para saber em que estrutura a peça está, cai no meio do cepo.
 */
function presa(forma: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - forma.b[0], forma.b[2] - cx)
  const my = Math.max(cy - forma.b[1], forma.b[3] - cy)
  return { b: [cx - mx, cy - my, cx + mx, cy + my], d: (x, y) => forma.d(x, y) }
}

/** A linha de `pontos` engrossada: cada ponto com a meia largura dele, um lado na ida e o outro na volta. */
function fita(pontos: readonly Ponto[], meias: readonly number[]): Forma {
  const ida: Ponto[] = []
  const volta: Ponto[] = []
  const ultimo = pontos.length - 1
  pontos.forEach(([x, y], k) => {
    const [xa, ya] = pontos[Math.max(0, k - 1)]
    const [xb, yb] = pontos[Math.min(ultimo, k + 1)]
    const l = Math.hypot(xb - xa, yb - ya) || 1
    const nx = (-(yb - ya) / l) * meias[k]
    const ny = ((xb - xa) / l) * meias[k]
    ida.push([x + nx, y + ny])
    volta.push([x - nx, y - ny])
  })
  return poligono([...ida, ...volta.reverse()])
}

/** A meia grossura do cabo em `a` (px ao longo dele), pela tabela. */
function meiaDoCabo(a: number): number {
  for (let i = 1; i < PERFIL_DO_CABO.length; i += 1) {
    const [a1, m1] = PERFIL_DO_CABO[i]
    if (a <= a1) {
      const [a0, m0] = PERFIL_DO_CABO[i - 1]
      return m0 + ((m1 - m0) * (a - a0)) / (a1 - a0)
    }
  }
  return PERFIL_DO_CABO[PERFIL_DO_CABO.length - 1][1]
}

// ---------- texturas ----------

/** O topo do cepo: os anéis apagados, o cinza do uso em manchas, os riscos finos no rumo do cabo e o miolo escuro. */
function texDoTopo(mx: number, my: number, raio: number, cerne: Rgb): Textura {
  const anel = vezes(cerne, FATOR_DO_ANEL)
  const co = Math.cos(RUMO_DO_CABO)
  const si = Math.sin(RUMO_DO_CABO)
  return (_u, _v, x, y, p, s) => {
    const q = Math.hypot(x - mx, y - my) / raio + ruido(x * 0.3 + 17, y * 0.3) * 0.05
    const onda = Math.sin(q * ANEIS * VOLTA)
    misturarEm(s, anel, onda > 0.3 ? ((onda - 0.3) / 0.7) * QUANTO_DE_ANEL : 0)
    misturarEm(s, CINZA_DO_USO, limitar01(ruido(x * 0.14 + 5, y * 0.14 + 9) * 1.6 + 0.55) * QUANTO_DE_USO)
    // Os riscos finos do uso, no rumo do cabo: o ruído esticado ao comprido dele.
    const ao = x * co + y * si
    const de = -x * si + y * co
    s[3] += ruido(ao * 0.25 + p.su, de * 2.2) * 0.08 - q * 0.04 + ruido(x * 0.9, y * 0.9) * 0.03
    if (q < RAIO_DO_MIOLO) s[3] -= 0.16 * (1 - q / RAIO_DO_MIOLO)
  }
}

/** O ferro batido: as marcas largas do martelo e o grão da carepa (`bancadaDeFerramentas.ts`). */
const texDeForjado: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.55 + p.su, y * 0.55 + p.sv) * 0.3 + ruido(x * 1.6, y * 1.6 + p.su) * 0.08
}

/** O cabo: o veio da madeira ao comprido e o punho escurecido pela mão. `a` sai da distância ao olho no rumo do cabo. */
function texDoCabo(ox: number, oy: number, k: number): Textura {
  const madeira = texturaDaClasse('madeira')
  const co = Math.cos(RUMO_DO_CABO)
  const si = Math.sin(RUMO_DO_CABO)
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const a = ((x - ox) * co + (y - oy) * si) / k
    s[3] -= ESCURO_DO_PUNHO * limitar01((a - PUNHO_DE) / (PUNHO_ATE - PUNHO_DE))
  }
}

// ---------- as partes ----------

/** O cepo como as outras partes o leem: o meio, o contorno da casca, o topo serrado e a escala do desenho. */
interface Cepo {
  readonly cx: number
  readonly cy: number
  readonly contorno: Forma
  readonly topo: Forma
  readonly raioDoTopo: number
  readonly z: number
  /** Os px do desenho em px da pegada: o menor meio lado sobre o de partida. */
  readonly k: number
}

function medirCepo(c: ContextoDoMovel): Cepo {
  const R = Math.min(c.hw, c.hh)
  const cx = MEIO_DO_CEPO[0] * c.hw
  const cy = MEIO_DO_CEPO[1] * c.hh
  const raio = R * RAIO_DO_CEPO
  const raioDoTopo = raio - R * CASCA
  const roda = (r: number): Forma => ({
    b: [cx - r * 1.06, cy - r * 1.06, cx + r * 1.06, cy + r * 1.06],
    d: (x, y) => Math.hypot(x - cx, y - cy) - r * (1 + tortoDoCepo(Math.atan2(y - cy, x - cx))),
  })
  return { cx, cy, contorno: roda(raio), topo: roda(raioDoTopo), raioDoTopo, z: c.g * ALTURA_DO_CEPO, k: R / MEIO_LADO_DE_PARTIDA }
}

/** Os cavacos e as lascas, no chão, por baixo de tudo. Nenhum cavaco cai na sombra do cabo (ele a apagaria). */
function montarMiudeza(c: ContextoDoMovel, cena: Cena, cepo: Cepo, cerne: Rgb, sombraDoCabo: Forma): void {
  const P = c.peca
  const L = cena.partes
  const R = Math.min(c.hw, c.hh)
  const novo: MaterialDaPeca = { classe: 'madeira', rgb: vezes(cerne, FATOR_DO_CAVACO_NOVO) }
  const velho: MaterialDaPeca = { classe: 'madeira', rgb: vezes(misturar(cerne, CINZA_DO_USO, 0.4), FATOR_DO_CAVACO_VELHO) }
  for (let i = 0; i < CAVACOS; i += 1) {
    const rumo = hash(i, 1, 7700) * VOLTA
    const longe = R * (CAVACO_DE + (CAVACO_ATE - CAVACO_DE) * hash(i, 2, 7700))
    const x = Math.max(-c.hw * BEIRA_DO_CAVACO, Math.min(c.hw * BEIRA_DO_CAVACO, cepo.cx + Math.cos(rumo) * longe))
    const y = Math.max(-c.hh * BEIRA_DO_CAVACO, Math.min(c.hh * BEIRA_DO_CAVACO, cepo.cy + Math.sin(rumo) * longe))
    if (sombraDoCabo.d(x, y) < 1) continue
    const t = (CAVACO_MENOR + (CAVACO_MAIOR - CAVACO_MENOR) * hash(i, 3, 7700)) * cepo.k
    const giro = hash(i, 4, 7700) * Math.PI
    const co = Math.cos(giro)
    const si = Math.sin(giro)
    const cantos: readonly Ponto[] = [[-t, -0.45 * t], [0.8 * t, -0.6 * t], [t, 0.4 * t], [-0.7 * t, 0.55 * t]]
    const forma = poligono(cantos.map(([a, b]): Ponto => [x + a * co - b * si, y + a * si + b * co]))
    cena.sombras.push(contato(forma, 0.26))
    L.push(P(forma, hash(i, 5, 7700) < 0.65 ? novo : velho, { eixo: giro, tabua: 0, bisel: 0.5, contorno: 0.26, tom: 0.92 + 0.16 * hash(i, 6, 7700), semente: 7701 + i }))
  }
  LASCAS.forEach(([fx, fy, comp, giro], i) => {
    const x = fx * c.hw
    const y = fy * c.hh
    const meio = (comp * R) / 2
    const w = MEIA_LARGURA_DA_LASCA * cepo.k
    const co = Math.cos(giro)
    const si = Math.sin(giro)
    const cantos: readonly Ponto[] = [[-meio, 0], [-meio * 0.3, -w], [meio * 0.6, -w * 0.7], [meio, 0], [meio * 0.4, w * 0.8], [-meio * 0.5, w]]
    const forma = poligono(cantos.map(([a, b]): Ponto => [x + a * co - b * si, y + a * si + b * co]))
    cena.sombras.push(contato(forma, 0.26))
    L.push(P(forma, novo, { eixo: giro, tabua: 0, bisel: 0.5, contorno: 0.28, tom: 0.96, semente: 7730 + i }))
  })
}

/**
 * As achas em volta do cepo, cada uma uma coluna baixa: a casca, a face rachada (ou a beira dela) e o corte de uma
 * ponta. A acha é cunha: a ponta serrada é reta, a outra sai torta do machado.
 */
function montarAchas(c: ContextoDoMovel, cena: Cena, cerne: Rgb): void {
  const P = c.peca
  const L = cena.partes
  const R = Math.min(c.hw, c.hh)
  const casca = c.m.lenha
  const rachada: MaterialDaPeca = { classe: 'madeira', rgb: vezes(cerne, FATOR_DA_RACHADA) }
  const corte: MaterialDaPeca = { classe: 'liso', rgb: vezes(cerne, FATOR_DO_CAVACO_NOVO) }
  ACHAS.forEach((acha, i) => {
    const cx = acha.x * c.hw
    const cy = acha.y * c.hh
    const m = (acha.comp * R) / 2
    const w = (acha.larg * R) / 2
    const co = Math.cos(acha.ang)
    const si = Math.sin(acha.ang)
    const noMapa = ([a, b]: Ponto): Ponto => [cx + a * co - b * si, cy + a * si + b * co]
    const emForma = (cantos: readonly Ponto[]): Forma => poligono(cantos.map(noMapa))
    // A ponta serrada (+m) reta; a rachada (-m) em bico torto, de um lado só.
    const forma = emForma([[-m * 0.62, -w * 0.9], [-m * 0.3, -w], [m * 0.95, -w * 0.95], [m, -w * 0.45], [m * 0.97, w * 0.9], [m * 0.9, w], [-m * 0.7, w * 0.92], [-m, w * 0.35]])
    const sem = 7600 + i * 6
    cena.sombras.push({ forma, z: c.g * ALTURA_DA_ACHA, forca: 0.26 }, contato(forma, 0.32))
    L.push(P(forma, casca, { eixo: acha.ang, bisel: w * (acha.face === 'casca' ? 0.85 : 0.5), tom: acha.tom * 0.92, contorno: 0.24, semente: sem }))
    if (acha.face === 'rachada') {
      // A face rachada para cima, clara, com o veio comprido da acha; a casca fica numa tira de um lado.
      const face = emForma([[-m * 0.94, w * 0.22], [-m * 0.5, -w * 0.8], [m * 0.95, -w * 0.8], [m * 0.97, w * 0.3], [-m * 0.6, w * 0.5]])
      L.push(P(dentroDe(face, forma), rachada, { eixo: acha.ang, tabua: 0, bisel: 0.6, tom: acha.tom, contorno: 0.14, semente: sem + 1 }))
    } else {
      // A casca para cima: da face rachada só aparece a beira, uma tira clara de um lado.
      const beira = emForma([[-m * 0.95, -w], [m * 0.94, -w * 0.96], [m * 0.94, -w * 0.5], [-m * 0.95, -w * 0.55]])
      L.push(P(dentroDe(beira, forma), rachada, { eixo: acha.ang, tabua: 0, bisel: 0.4, tom: acha.tom * 0.95, contorno: 0.14, semente: sem + 1 }))
    }
    // O corte de uma ponta, a madeira de dentro (a acha veio de uma rodela serrada).
    const ponta = emForma([[m * 0.84, -w * 0.92], [m * 0.98, -w * 0.9], [m, -w * 0.45], [m * 0.97, w * 0.86], [m * 0.84, w * 0.9]])
    L.push(P(dentroDe(ponta, forma), corte, { eixo: acha.ang + QUARTO, bisel: 0.4, contorno: 0.18, semente: sem + 3 }))
  })
}

/** O cepo: a casca em roda (com o pedaço sem casca), o topo gasto, os talhos e os cavacos em cima dele. */
function montarCepo(c: ContextoDoMovel, cena: Cena, cepo: Cepo, cerne: Rgb): void {
  const P = c.peca
  const L = cena.partes
  const { cx, cy, k } = cepo
  const R = Math.min(c.hw, c.hh)
  const raio = R * RAIO_DO_CEPO
  cena.sombras.push({ forma: cepo.contorno, z: cepo.z }, contato(cepo.contorno, 0.34))
  L.push(P(cepo.contorno, c.m.lenha, { polar: { cx, cy, r: raio }, bisel: R * CASCA * 0.95, contorno: 0.28, tom: 0.94, semente: 7501 }))
  // Onde a casca caiu: o alburno, claro e cinzento, num pedaço da roda.
  const [rumo, abre] = SEM_CASCA
  const fatia: Ponto[] = [[cx, cy]]
  for (let i = 0; i <= LANCES_DA_FATIA; i += 1) {
    const t = rumo - abre + (2 * abre * i) / LANCES_DA_FATIA
    fatia.push([cx + Math.cos(t) * raio * 1.3, cy + Math.sin(t) * raio * 1.3])
  }
  L.push(P(dentroDe(menos(cepo.contorno, cepo.topo), poligono(fatia)), { classe: 'liso', rgb: ALBURNO }, { bisel: R * CASCA * 0.6, contorno: 0.24, semente: 7502 }))
  // O topo serrado, gasto.
  const mx = cx + MIOLO[0] * cepo.raioDoTopo
  const my = cy + MIOLO[1] * cepo.raioDoTopo
  L.push(P(cepo.topo, { classe: 'liso', rgb: cerne }, { bisel: 0.8, contorno: 0.22, textura: texDoTopo(mx, my, cepo.raioDoTopo, cerne), semente: 7503 }))
  // Os talhos: a beira clara (a parede de lá, virada para a luz) e, um pouco para o lado da luz, a parede escura.
  const claro: MaterialDaPeca = { classe: 'liso', rgb: vezes(cerne, FATOR_DA_BEIRA_DO_TALHO) }
  const escuro: MaterialDaPeca = { classe: 'liso', rgb: vezes(cerne, FATOR_DO_TALHO) }
  const [lx, ly] = RUMO_DA_LUZ
  for (let i = 0; i < GOLPES; i += 1) {
    const longe = Math.sqrt(hash(i, 1, 7510)) * GOLPES_ATE * cepo.raioDoTopo
    const onde = hash(i, 2, 7510) * VOLTA
    const x = cx + Math.cos(onde) * longe
    const y = cy + Math.sin(onde) * longe
    const espalho = i % 3 === 0 ? ESPALHO_DO_GOLPE_TORTO : ESPALHO_DO_GOLPE
    const rumoDoTalho = RUMO_DO_CABO + (hash(i, 3, 7510) - 0.5) * 2 * espalho
    const meio = ((GOLPE_CURTO + (GOLPE_COMPRIDO - GOLPE_CURTO) * hash(i, 4, 7510)) * k) / 2
    const ex = Math.cos(rumoDoTalho) * meio
    const ey = Math.sin(rumoDoTalho) * meio
    const talho = (d: number, r: number): Forma => dentroDe(capsula(x - ex + lx * d, y - ey + ly * d, x + ex + lx * d, y + ey + ly * d, r), cepo.topo)
    L.push(P(talho(-0.4 * k, 0.32 * k), claro, { bisel: 0, contorno: 0, alfa: 0.55, semente: 7511 + i * 2 }))
    L.push(P(talho(0.12 * k, 0.3 * k), escuro, { bisel: 0, contorno: 0, alfa: 0.66, semente: 7512 + i * 2 }))
  }
  // Os cavacos que ficaram em cima.
  const cavaco: MaterialDaPeca = { classe: 'madeira', rgb: vezes(cerne, FATOR_DO_CAVACO_NOVO) }
  CAVACOS_NO_TOPO.forEach(([fx, fy, t], i) => {
    const x = cx + fx * cepo.raioDoTopo
    const y = cy + fy * cepo.raioDoTopo
    const s = t * k
    const giro = 0.7 + i * 1.3
    const co = Math.cos(giro)
    const si = Math.sin(giro)
    const cantos: readonly Ponto[] = [[-s, -0.45 * s], [0.8 * s, -0.6 * s], [s, 0.4 * s], [-0.7 * s, 0.55 * s]]
    L.push(P(poligono(cantos.map(([a, b]): Ponto => [x + a * co - b * si, y + a * si + b * co])), cavaco, { eixo: giro, tabua: 0, bisel: 0.5, contorno: 0.26, semente: 7580 + i, projeta: { dist: 0.6, forca: 0.3 } }))
  })
}

/**
 * O machado cravado no cepo, tudo preso ao meio dele (sobe com o topo na 3/4): a sombra do cabo e da cabeça no
 * topo (pintadas por peças sem tinta que só projetam), a fenda do fio, o cabo, a cabeça, o fio polido e a ponta
 * do cabo com a cunha.
 */
function montarMachado(c: ContextoDoMovel, cena: Cena, cepo: Cepo, cabo: Forma, noCabo: (p: Ponto) => Ponto): void {
  const P = c.peca
  const L = cena.partes
  const { k } = cepo
  const noCepo = (f: Forma): Forma => presa(f, cepo.cx, cepo.cy)
  // A cabeça e o que é dela (o fio, a fenda, a ponta do cabo, a cunha), no referencial do cabo, na escala dela.
  const naCabeca = ([a, b]: Ponto): Ponto => noCabo([a * ESCALA_DA_CABECA, b * ESCALA_DA_CABECA])
  const linha = ([a, b]: readonly [Ponto, Ponto], r: number): Forma => {
    const [ax, ay] = naCabeca(a)
    const [bx, by] = naCabeca(b)
    return capsula(ax, ay, bx, by, r * k)
  }
  const cabeca = poligono(CABECA.map(naCabeca))
  // A sombra do cabo no topo: cada ponto dele anda pela altura em que está acima do topo.
  const pontos: Ponto[] = []
  const meias: number[] = []
  for (let i = 0; i <= LANCES_DO_CABO; i += 1) {
    const a = CABO_DE + ((COMPRIMENTO_DO_CABO - CABO_DE) * i) / LANCES_DO_CABO
    const [x, y] = noCabo([a, -VERGA_DO_CABO * Math.sin((Math.PI * a) / COMPRIMENTO_DO_CABO)])
    const acima = (OLHO_ACIMA_DO_TOPO + SUBIDA_DO_CABO * a) * k
    pontos.push([x + SOMBRA_X * acima, y + SOMBRA_Y * acima])
    meias.push(meiaDoCabo(a) * k)
  }
  const sombraNoTopo = { dist: 0, forca: 0.38, suave: 0.8 }
  L.push(P(noCepo(dentroDe(fita(pontos, meias), cepo.topo)), FERRO_DA_CABECA, { alfa: 0, projeta: sombraNoTopo, semente: 7550 }))
  const dx = SOMBRA_X * ACIMA_DA_CABECA * k
  const dy = SOMBRA_Y * ACIMA_DA_CABECA * k
  L.push(P(noCepo(dentroDe(poligono(CABECA.map(naCabeca).map(([x, y]): Ponto => [x + dx, y + dy])), cepo.topo)), FERRO_DA_CABECA, { alfa: 0, projeta: sombraNoTopo, semente: 7551 }))
  // A fenda onde o fio entrou e as fibras que ele levantou na frente dela.
  const cerne = cerneDa(c.m.lenha)
  L.push(P(noCepo(linha(FIBRAS, 0.34)), { classe: 'liso', rgb: vezes(cerne, FATOR_DA_BEIRA_DO_TALHO) }, { bisel: 0, contorno: 0, alfa: 0.7, semente: 7552 }))
  L.push(P(noCepo(linha(FENDA, 0.5)), { classe: 'liso', rgb: vezes(cerne, FATOR_DO_TALHO) }, { bisel: 0, contorno: 0, semente: 7553 }))
  // O cabo, a cabeça por cima dele, o fio polido e a ponta do cabo com a cunha, do outro lado do olho.
  const [ox, oy] = noCabo([0, 0])
  L.push(P(noCepo(cabo), CABO_DO_MACHADO, { eixo: RUMO_DO_CABO, tabua: 0, bisel: 1.2 * k, contorno: 0.3, textura: texDoCabo(ox, oy, k), semente: 7554 }))
  L.push(P(noCepo(cabeca), FERRO_DA_CABECA, { tabua: 0, bisel: 1.1 * k, contorno: 0.3, metal: 0.35, textura: texDeForjado, semente: 7555 }))
  L.push(P(noCepo(dentroDe(poligono(FIO.map(naCabeca)), cabeca)), ACO_DO_FIO, { tabua: 0, bisel: 0.4, contorno: 0.16, metal: 0.7, semente: 7556 }))
  L.push(P(noCepo(poligono(PONTA_DO_CABO.map(naCabeca))), { classe: 'madeira', rgb: misturar(CABO_DO_MACHADO.rgb, cerne, 0.6) }, { eixo: RUMO_DO_CABO + QUARTO, tabua: 0, bisel: 0.4, contorno: 0.26, semente: 7557 }))
  L.push(P(noCepo(linha(CUNHA, 0.2)), { classe: 'liso', rgb: vezes(cerne, FATOR_DO_TALHO) }, { bisel: 0, contorno: 0, semente: 7558 }))
}

export const montarTocoComMachado: MontarMovel = (c, cena) => {
  const cepo = medirCepo(c)
  const cerne = cerneDa(c.m.lenha)
  const { k } = cepo
  // O referencial do cabo: `a` ao comprido dele, a partir do olho, `b` de través.
  const ox = cepo.cx + OLHO[0] * k
  const oy = cepo.cy + OLHO[1] * k
  const co = Math.cos(RUMO_DO_CABO)
  const si = Math.sin(RUMO_DO_CABO)
  const noCabo = ([a, b]: Ponto): Ponto => [ox + (a * co - b * si) * k, oy + (a * si + b * co) * k]
  const pontos: Ponto[] = []
  const meias: number[] = []
  for (let i = 0; i <= LANCES_DO_CABO; i += 1) {
    const a = CABO_DE + ((COMPRIMENTO_DO_CABO - CABO_DE) * i) / LANCES_DO_CABO
    pontos.push(noCabo([a, -VERGA_DO_CABO * Math.sin((Math.PI * a) / COMPRIMENTO_DO_CABO)]))
    meias.push(meiaDoCabo(a) * k)
  }
  const cabo = fita(pontos, meias)
  // A sombra do cabo no chão: do ponto em que ele sai do cepo até o punho, cada ponta pela altura dela.
  const sobreOCepo = (a: number): boolean => {
    const [x, y] = noCabo([a, 0])
    return cepo.contorno.d(x, y) < 0
  }
  let aDaBeira = CABO_DE
  while (aDaBeira < COMPRIMENTO_DO_CABO && sobreOCepo(aDaBeira)) aDaBeira += 0.5
  const altura = (a: number): number => cepo.z + (OLHO_ACIMA_DO_TOPO + SUBIDA_DO_CABO * a) * k
  const [bx, by] = noCabo([aDaBeira, 0])
  const [px, py] = noCabo([COMPRIMENTO_DO_CABO - 1, 0])
  const sombraDoCabo = capsula(bx + SOMBRA_X * altura(aDaBeira), by + SOMBRA_Y * altura(aDaBeira), px + SOMBRA_X * altura(COMPRIMENTO_DO_CABO), py + SOMBRA_Y * altura(COMPRIMENTO_DO_CABO), 1.4 * k)
  cena.sombras.push({ forma: sombraDoCabo, z: 0, suave: 1.5, forca: 0.3 })
  montarMiudeza(c, cena, cepo, cerne, sombraDoCabo)
  montarAchas(c, cena, cerne)
  montarCepo(c, cena, cepo, cerne)
  montarMachado(c, cena, cepo, cabo, noCabo)
}
