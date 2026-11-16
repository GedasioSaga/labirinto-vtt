/**
 * MONTANHA de cima com volume (16/11/2026, leva E2 item 11 do mestre), em três tamanhos: a pequena (4 x 4 casas,
 * um cume), a média (6 x 6, dois cumes) e a grande (10 x 8, três cumes numa serra). Arte original no Meio-Termo.
 *
 * TERCEIRA versão (16/11/2026, noite). A segunda, vista no app, ainda não lia como montanha: a silhueta era uma
 * bolha com um bulbo (o morro solto da grande e o ombro da média), o cume tinha raios de leque (a serra lida em
 * ângulo em volta de cada cume), o pé soltava dedos (os braços do esqueleto passavam da massa), a rocha era cinza
 * chapado e escura a 47% e a neve parecia um respingo. Agora:
 *
 * - A FORMA vem primeiro (`distanciaAoPe`): o pé é um maciço compacto em volta da CRISTA principal, a união suave
 *   de cápsulas de largura variável ao longo dela, com a beira irregular pelo ruído e presa na caixa. Uma crista só
 *   por tamanho, sem cume solto: não sobra bulbo. O relevo nunca passa do pé (o `teto` sobe do pé com inclinação
 *   branda), então nenhuma crista vira dedo para fora.
 * - O RELEVO é um CAMPO DE ALTURA (grade de 1 px, cache por tamanho e giro): a crista principal, com os cumes e os
 *   colos, e os ESPORÕES que descem dela para os dois lados, alternados, cada um com os seus ramos. Cada pedaço é
 *   uma aresta de encosta côncava (íngreme no fio, mais branda embaixo); o relevo é o mais alto deles. As GROTAS
 *   ficam entre dois esporões e descem do alto para o pé; por cima, os sulcos miúdos (`erodir`) correm morro abaixo
 *   pela inclinação da forma grande e ramificam. Nada é lido em ângulo em volta do cume.
 * - A COR (`sombrear`): rocha cinza-parda quente (a pedra escolhida puxada para o barranco do Meio-Termo e
 *   clareada), a face virada para a luz do mapa clara e a do outro lado fria e mais escura, a grota funda e a aresta
 *   com fio de luz, nas duas escalas (a larga é a que se lê a 47%); o alto mais claro. O pé é cascalho e capim em
 *   manchas e o alfa cai nos últimos px do pé: a montanha some no chão, sem beira dura.
 * - A NEVE (opcional) cobre os cumes, segue a crista e desce pelas grotas altas (o côncavo segura neve, a aresta e a
 *   face a prumo a soltam), em beira irregular. Nunca uma mancha em volta de um ponto.
 * - A 3/4 é desenhada AQUI (o perfil `propria`, `tresQuartos.ts`): o relevo projetado (a tela é y - z), coluna por
 *   coluna, da frente para trás (`projetar`); a cor é a mesma conta. Um fio escuro separa a crista da frente do que
 *   fica atrás dela.
 *
 * No chão: a sombra do relevo inteiro para baixo à direita (a conta da luz de `SOMBRA_X`/`SOMBRA_Y`, uma varredura).
 *
 * TEMPO: montar o relevo da grande leva dezenas de ms. O raster não o monta de uma vez ao abrir o mapa: pede antes o
 * PREPARO (`prepararRelevo`, os mesmos passos com uma pausa a cada faixa de linhas), que anda nas fatias da fila
 * dele, e só depois monta a cena, já com o relevo guardado. O teste e a folha montam direto (`rodar`).
 *
 * GIRO: o relevo é montado NA TELA (a luz fica no lugar) e devolvido ao referencial do objeto (`desgirarCena`): o
 * giro da imagem (`girarCena`) o traz de volta como foi montado. Material: `pedra`. A neve e o capim são fixos.
 *
 * PEGADA SÓLIDA (para a colisão, `lib/obstaculosDeObjeto.ts`): a elipse de `RAIO_SOLIDO_DA_MONTANHA` da caixa.
 */
import { hash, limitar01, misturar, passoSuave, rgb, type Rgb } from '../../ruido'
import { montanhaComNeve } from '../../../lib/mobilia/montanha'
import { PALETA_MEIO_TERMO } from '../paleta'
import { G, type ContextoDoMovel, type MontarMovel, type PrepararCena } from './contexto'
import { type Forma } from './formas'
import { ruido, type Cena, type Textura } from './motor'
import { desgirarCena, quartosDoGiro } from './pipaDeitada'

/** A elipse que barra, em fração da caixa: o pé da encosta, sem a saia de cascalho que some no chão. */
export const RAIO_SOLIDO_DA_MONTANHA = 0.86

// ---------- a crista de cada tamanho ----------

/** Um ponto da crista principal: onde fica (fração da meia caixa), a altura (casas) e a meia largura do pé ali (fração do raio médio). */
interface PontoDaCrista {
  readonly x: number
  readonly y: number
  readonly altura: number
  readonly largura: number
}

interface Relevo {
  readonly nome: 'pequena' | 'media' | 'grande'
  readonly casasW: number
  readonly casasH: number
  readonly semente: number
  /** A crista de uma ponta à outra; as pontas são baixas (a serra desce até o pé), os cumes são os picos da lista. */
  readonly crista: readonly PontoDaCrista[]
  /** Quantos esporões de cada lado da crista (cada cume ganha um de cada lado; o resto se espalha entre eles). */
  readonly esporoes: number
}

/**
 * Os três relevos. A crista é uma linha só, levemente torta e fora do centro: um cume na pequena, dois na média,
 * três na grande (o mais alto no meio, os outros dois de alturas diferentes), com colos bem mais baixos entre eles.
 * A largura do pé acompanha a altura, então o maciço é compacto e não tem lobo.
 */
const RELEVOS: Readonly<Record<Relevo['nome'], Relevo>> = {
  pequena: {
    nome: 'pequena',
    casasW: 4,
    casasH: 4,
    semente: 11,
    esporoes: 3,
    crista: [
      { x: -0.56, y: 0.28, altura: 0.25, largura: 0.42 },
      { x: -0.28, y: 0.1, altura: 0.9, largura: 0.74 },
      { x: 0.06, y: -0.1, altura: 1.45, largura: 0.84 },
      { x: 0.38, y: -0.16, altura: 0.85, largura: 0.72 },
      { x: 0.58, y: -0.02, altura: 0.22, largura: 0.42 },
    ],
  },
  media: {
    nome: 'media',
    casasW: 6,
    casasH: 6,
    semente: 23,
    esporoes: 5,
    crista: [
      { x: -0.66, y: 0.26, altura: 0.25, largura: 0.34 },
      { x: -0.38, y: 0.1, altura: 1.6, largura: 0.7 },
      { x: -0.08, y: 0.02, altura: 1.1, largura: 0.76 },
      { x: 0.22, y: -0.1, altura: 2.2, largura: 0.8 },
      { x: 0.5, y: 0.0, altura: 1.2, largura: 0.7 },
      { x: 0.66, y: 0.16, altura: 0.25, largura: 0.34 },
    ],
  },
  grande: {
    nome: 'grande',
    casasW: 10,
    casasH: 8,
    semente: 37,
    esporoes: 8,
    crista: [
      { x: -0.74, y: 0.26, altura: 0.3, largura: 0.3 },
      { x: -0.52, y: 0.1, altura: 2.3, largura: 0.6 },
      { x: -0.28, y: -0.02, altura: 1.5, largura: 0.6 },
      { x: -0.03, y: -0.1, altura: 3.2, largura: 0.72 },
      { x: 0.25, y: -0.04, altura: 1.7, largura: 0.6 },
      { x: 0.5, y: 0.06, altura: 2.6, largura: 0.6 },
      { x: 0.74, y: 0.22, altura: 0.3, largura: 0.3 },
    ],
  },
}

// ---------- o pé ----------

/** A crista em px do objeto. */
interface CristaEmPx {
  readonly n: number
  readonly x: Float64Array
  readonly y: Float64Array
  readonly h: Float64Array
  readonly r: Float64Array
}

/** A emenda das cápsulas do pé (fração do raio médio): branda, o maciço sai inteiro, sem cintura entre os cumes. */
const UNIAO_DO_PE = 0.32
/** A beira torta: o empurrão largo (fração do raio médio) e a onda dele, e o recorte miúdo e a onda dele. */
const TORCE_A_BEIRA = 0.08
const ONDA_DA_BEIRA_LARGA = 0.42
const BEIRA_IRREGULAR = 0.045
const ONDA_DA_BEIRA = 0.11
/** A elipse da caixa (fração dela) que o pé nunca passa: a imagem não estoura a pegada. */
const TETO_DA_CAIXA = 0.96

/** O mínimo suave de a e b (a emenda sem quina). */
function minimoSuave(a: number, b: number, k: number): number {
  const t = limitar01(0.5 + (0.5 * (b - a)) / k)
  return b + (a - b) * t - k * t * (1 - t)
}

function maximoSuave(a: number, b: number, k: number): number {
  return -minimoSuave(-a, -b, k)
}

/**
 * A DISTÂNCIA AO PÉ, no objeto (negativa dentro): a união suave das cápsulas da crista, com o ponto empurrado por um
 * ruído largo (a beira não sai paralela à crista) e a distância recortada por um miúdo (a beira irregular), presa na
 * elipse da caixa. As ondas são largas perto da largura do maciço: nenhuma faz lobo.
 */
function distanciaAoPe(c: CristaEmPx, hw: number, hh: number, raio: number, s: number, xo: number, yo: number): number {
  const kw = 1 / (ONDA_DA_BEIRA_LARGA * raio)
  const xw = xo + TORCE_A_BEIRA * raio * ruido(xo * kw + s + 13, yo * kw)
  const yw = yo + TORCE_A_BEIRA * raio * ruido(xo * kw + s + 57, yo * kw + 31)
  const k = UNIAO_DO_PE * raio
  let d = Number.POSITIVE_INFINITY
  for (let i = 0; i < c.n - 1; i += 1) {
    const ax = c.x[i]
    const ay = c.y[i]
    const ex = c.x[i + 1] - ax
    const ey = c.y[i + 1] - ay
    const l2 = ex * ex + ey * ey
    let t = l2 > 0 ? ((xw - ax) * ex + (yw - ay) * ey) / l2 : 0
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const dx = xw - ax - ex * t
    const dy = yw - ay - ey * t
    const di = Math.sqrt(dx * dx + dy * dy) - (c.r[i] + (c.r[i + 1] - c.r[i]) * t)
    d = i === 0 ? di : minimoSuave(d, di, k)
  }
  const rho = Math.sqrt((xo / hw) * (xo / hw) + (yo / hh) * (yo / hh))
  d = maximoSuave(d, (rho - TETO_DA_CAIXA) * Math.min(hw, hh), k * 0.5)
  // O recorte miúdo depois da caixa: onde ela apara, a beira também sai torta (não um arco de elipse).
  const kb = 1 / (ONDA_DA_BEIRA * raio)
  return d + BEIRA_IRREGULAR * raio * (ruido(xo * kb + s * 3, yo * kb) + 0.5 * ruido(xo * kb * 2.3 + 5, yo * kb * 2.3 + s))
}

// ---------- o esqueleto: a crista e os esporões ----------

/** Um pedaço de crista, na TELA: de (ax, ay) na altura ha a (bx, by) na altura hb (px). */
interface Pedaco {
  readonly ax: number
  readonly ay: number
  readonly bx: number
  readonly by: number
  readonly ha: number
  readonly hb: number
}

/** O passo dos pedaços da crista principal (fração do raio médio) e o quanto ela serpenteia de lado. */
const PASSO_DA_CRISTA = 0.07
const SERPENTEIO_DA_CRISTA = 0.035
/** O esporão desce mais depressa junto da crista e deita perto do pé (o perfil côncavo de uma serra). */
const QUEDA_DO_ESPORAO = 1.25
/** Quanto o rumo de um galho vira a cada pedaço (radianos, para os dois lados). */
const SERPENTEIO = 0.45
/** Até onde o esporão vai: para esta fração do raio médio antes da beira do pé (o resto é a saia). */
const FOLGA_DO_ESPORAO = 0.03
/** O esporão mais curto que ainda entra (fração do raio médio). */
const ESPORAO_MINIMO = 0.12
/** O quanto o esporão se inclina para a ponta mais perto da crista (radianos, nas pontas): leque aberto, não espinha de peixe reta. */
const INCLINACAO_PARA_A_PONTA = 0.85
/** Os ramos: a abertura (radianos) e o comprimento (fração do que falta do pai). */
const ABERTURA_MINIMA = 0.55
const ABERTURA_MAXIMA = 0.95
const RAMO_DO_RESTO = 0.62
/** O ramo mais curto que ainda solta raminho (fração do raio médio). */
const RAMO_COM_RAMINHO = 0.22

function alturaNoGalho(h0: number, u: number): number {
  return h0 * (1 - u) ** QUEDA_DO_ESPORAO
}

/** Leva o ponto do objeto para a tela (o giro de `girarCena`). */
function naTela(x: number, y: number, q: number): [number, number] {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : q === 3 ? [y, -x] : [x, y]
}

/** O ponto da tela de volta no objeto. */
function noObjeto(x: number, y: number, q: number): [number, number] {
  return q === 1 ? [y, -x] : q === 2 ? [-x, -y] : q === 3 ? [-y, x] : [x, y]
}

/** O que monta o esqueleto precisa saber: o pé, o giro e o raio médio. */
interface Molde {
  readonly pe: (x: number, y: number) => number
  readonly q: number
  readonly raio: number
  readonly pedacos: Pedaco[]
}

/** Quanto dá para andar de (x, y) no rumo `ang` sem passar da folga do pé (px; no máximo `ate`). */
function alcanceNoPe(m: Molde, x: number, y: number, ang: number, ate: number): number {
  const passo = 0.02 * m.raio
  const folga = -FOLGA_DO_ESPORAO * m.raio
  const [c, s] = [Math.cos(ang), Math.sin(ang)]
  let r = 0
  while (r + passo <= ate && m.pe(x + c * (r + passo), y + s * (r + passo)) < folga) r += passo
  return r
}

/**
 * Um GALHO do esqueleto (nível 1 o esporão, 2 o ramo, 3 o raminho): de (x, y) na altura h0 até o chão, em pedaços
 * que serpenteiam, e os filhos dele, alternados de lado. O comprimento para antes da beira do pé.
 */
function galho(m: Molde, x: number, y: number, rumo: number, comprimento: number, h0: number, nivel: number, semente: number): void {
  const L = alcanceNoPe(m, x, y, rumo, comprimento)
  if (L < (nivel === 1 ? ESPORAO_MINIMO : ESPORAO_MINIMO * 0.5) * m.raio) return
  const pedacos = nivel === 1 ? 5 : nivel === 2 ? 3 : 2
  const passo = L / pedacos
  const pontos: [number, number, number][] = [[x, y, rumo]]
  let ang = rumo
  for (let k = 1; k <= pedacos; k += 1) {
    ang += SERPENTEIO * (hash(k, semente, 3101) - 0.5)
    const [px, py] = pontos[k - 1]
    pontos.push([px + Math.cos(ang) * passo, py + Math.sin(ang) * passo, ang])
    const [ax, ay] = naTela(px, py, m.q)
    const [bx, by] = naTela(pontos[k][0], pontos[k][1], m.q)
    m.pedacos.push({ ax, ay, bx, by, ha: alturaNoGalho(h0, (k - 1) / pedacos), hb: alturaNoGalho(h0, k / pedacos) })
  }
  if (nivel >= 3 || (nivel === 2 && L < RAMO_COM_RAMINHO * m.raio)) return
  const filhos = nivel === 1 ? 2 : 1
  for (let f = 0; f < filhos; f += 1) {
    const u = filhos === 1 ? 0.42 + 0.16 * hash(f, semente, 3102) : 0.28 + f * 0.3 + 0.1 * hash(f, semente, 3102)
    const k = Math.min(pedacos - 1, Math.floor(u * pedacos))
    const resto = u * pedacos - k
    const [px, py] = pontos[k]
    const [qx, qy, angulo] = pontos[k + 1]
    const lado = (f + semente) % 2 === 0 ? 1 : -1
    const abertura = lado * (ABERTURA_MINIMA + (ABERTURA_MAXIMA - ABERTURA_MINIMA) * hash(f, semente, 3103))
    const tamanho = (1 - u) * L * RAMO_DO_RESTO * (0.8 + 0.35 * hash(f, semente, 3104))
    galho(m, px + (qx - px) * resto, py + (qy - py) * resto, angulo + abertura, tamanho, alturaNoGalho(h0, u) * 0.96, nivel + 1, semente * 7 + f * 13 + 5)
  }
}

/** Um ponto ao longo da crista principal: onde, a altura, o rumo e a distância andada desde a primeira ponta. */
interface AoLongo {
  readonly x: number
  readonly y: number
  readonly h: number
  readonly rumo: number
  readonly s: number
}

/**
 * O ESQUELETO na tela: a crista principal em pedaços que serpenteiam (os cumes ficam no lugar) e os esporões de cada
 * lado. Cada cume ganha um esporão de cada lado (o cume vira pirâmide de três ou quatro arestas, não ponto com
 * raios); os outros se espalham, alternados entre os lados, e se inclinam para a ponta mais perto.
 */
function esqueleto(relevo: Relevo, c: CristaEmPx, m: Molde, s: number): void {
  const ao: AoLongo[] = []
  let andado = 0
  for (let i = 0; i < c.n - 1; i += 1) {
    const ex = c.x[i + 1] - c.x[i]
    const ey = c.y[i + 1] - c.y[i]
    const len = Math.hypot(ex, ey)
    const rumo = Math.atan2(ey, ex)
    const partes = Math.max(2, Math.ceil(len / (PASSO_DA_CRISTA * m.raio)))
    let [px, py] = [c.x[i], c.y[i]]
    for (let k = 1; k <= partes; k += 1) {
      const u = k / partes
      // De lado, só no meio do trecho: as pontas (cumes e colos) ficam no lugar.
      const lado = SERPENTEIO_DA_CRISTA * m.raio * Math.sin(Math.PI * u) * 2 * ruido(i * 3.7 + u * 2.3 + s, s * 0.5)
      const qx = c.x[i] + ex * u - Math.sin(rumo) * lado
      const qy = c.y[i] + ey * u + Math.cos(rumo) * lado
      const ha = c.h[i] + (c.h[i + 1] - c.h[i]) * ((k - 1) / partes)
      const hb = c.h[i] + (c.h[i + 1] - c.h[i]) * u
      const [ax, ay] = naTela(px, py, m.q)
      const [bx, by] = naTela(qx, qy, m.q)
      m.pedacos.push({ ax, ay, bx, by, ha, hb })
      andado += Math.hypot(qx - px, qy - py)
      ao.push({ x: qx, y: qy, h: hb, rumo, s: andado })
      px = qx
      py = qy
    }
  }
  const total = andado
  const pontoEm = (alvo: number): AoLongo => ao.find((p) => p.s >= alvo) ?? ao[ao.length - 1]
  // Os cumes (os picos da lista) e as distâncias deles na crista.
  const cumes: number[] = []
  for (let i = 1; i < c.n - 1; i += 1) {
    if (c.h[i] > c.h[i - 1] && c.h[i] > c.h[i + 1]) cumes.push(ao.find((p) => Math.hypot(p.x - c.x[i], p.y - c.y[i]) < 0.5)?.s ?? 0)
  }
  const espaco = total / (relevo.esporoes + 0.5)
  for (const lado of [1, -1] as const) {
    const lugares = [...cumes]
    for (let k = 0; k < relevo.esporoes; k += 1) {
      const alvo = (k + (lado === 1 ? 0.6 : 1.1)) * espaco
      if (alvo < 0.06 * total || alvo > 0.94 * total) continue
      if (lugares.every((l) => Math.abs(l - alvo) > 0.55 * espaco)) lugares.push(alvo)
    }
    lugares.forEach((alvo, n) => {
      const p = pontoEm(alvo + espaco * 0.12 * (hash(n, lado + 2, s) - 0.5))
      const meio = (p.s / total - 0.5) * 2
      const inclina = INCLINACAO_PARA_A_PONTA * meio * Math.abs(meio) ** 0.4 + 0.3 * (hash(n, lado + 5, s) - 0.5)
      // A normal do lado, puxada para a ponta mais perto (o leque se abre nas pontas da serra).
      const rumo = p.rumo + lado * (Math.PI / 2) - lado * inclina
      galho(m, p.x, p.y, rumo, 2 * m.raio, p.h * 0.95, 1, s * 31 + n * 17 + (lado === 1 ? 3 : 9))
    })
  }
}

// ---------- o campo de altura ----------

/**
 * A encosta de uma aresta, CÔNCAVA: íngreme junto do fio (as duas inclinações somadas) e mais branda longe dele (só a
 * de longe), com a troca a uns `CURVA_DO_FLANCO` px do fio. A grota entre dois esporões sai em V no alto e de fundo
 * aberto embaixo, e o pé dos esporões se junta numa encosta só (com a encosta reta, sobrava chão chato entre eles e
 * os esporões liam como espinhos num prato). A de longe passa da descida de um esporão (cerca de 1): o esporão
 * aparece por cima do flanco da crista. O raio arredonda o fio (px). 1 = 45 graus.
 */
const INCLINACAO_PERTO_DO_FIO = 1.4
const INCLINACAO_DO_FLANCO = 1.1
const CURVA_DO_FLANCO = 25
const RAIO_DA_CRISTA = 4
/** O pé: o teto com que o relevo pode subir da beira (só apara a ponta de um esporão) e a emenda com a encosta (px). */
const INCLINACAO_DO_PE = 1.7
const EMENDA_DO_PE = 8
/**
 * A BASE do maciço, por baixo das arestas: sobe da beira do pé com inclinação branda até um teto (fração do cume mais
 * alto). Em cima as arestas passam dela (o alto é recortado); embaixo ela fica por cima (a encosta baixa é lisa e
 * desce até o pé). Sem ela sobrava um anel chato entre a ponta dos esporões e a beira, e a montanha lia como prato.
 */
const INCLINACAO_DA_BASE = 0.5
const TETO_DA_BASE = 0.22
/** A emenda entre a base e as arestas (fração do cume mais alto): sem quina onde a encosta encontra a base. */
const EMENDA_DA_BASE = 0.07
/** Abaixo disto (px) o campo não precisa de conta: é chão longe do pé. */
const FUNDO = -6
/** A grade grossa do esqueleto (px): a conta cara anda de 2 em 2 e a fina é interpolada (a crista já é arredondada). */
const PASSO_GROSSO = 2
/** O empurrão do ruído antes de ler o esqueleto: a amplitude e o tamanho da onda, em fração do raio médio. */
const TORCIDO = 0.06
const ONDA_DO_TORCIDO = 0.45
/** As arestas de rocha: a força (fração do cume mais alto), a onda (fração do raio médio) e as oitavas. */
const FORCA_DAS_ARESTAS = 0.03
const ONDA_DAS_ARESTAS = 0.1
const OITAVAS_DAS_ARESTAS = 3
/** As arestas miúdas, na grade fina, e a altura (px) abaixo da qual elas somem (a beira fica lisa para o alfa). */
const FORCA_DAS_ARESTAS_MIUDAS = 0.016
const ONDA_DAS_ARESTAS_MIUDAS = 0.045
const ARESTAS_ACIMA_DE = 8
/** O côncavo em duas escalas: o borrão (px) e a régua de cada um (a grota em V de inclinação do flanco fica perto de 1). */
const RAIO_DO_CONCAVO = 4
const REGUA_DO_CONCAVO = 3.2
const RAIO_DO_LARGO = 12
const REGUA_DO_LARGO = 9
/** Abaixo disto a inclinação não divide a distância (o cume chato não faz a distância explodir). */
const INCLINACAO_MINIMA = 0.3
/** Linhas de grade entre duas pausas do preparo: cada pausa fica bem abaixo da fatia de 8 ms da fila. */
const LINHAS_POR_PASSO = 24

/** O relevo pronto, na TELA, numa grade de 1 px com o nó (0, 0) em (x0, y0). */
interface Terreno {
  readonly x0: number
  readonly y0: number
  readonly nx: number
  readonly ny: number
  /** A altura (px; negativa no chão em volta), a inclinação, o côncavo miúdo e o largo, e a distância até o pé (negativa dentro). */
  readonly h: Float32Array
  readonly gx: Float32Array
  readonly gy: Float32Array
  readonly concavo: Float32Array
  readonly largo: Float32Array
  readonly pe: Float32Array
  /** A distância até a borda da sombra no chão (negativa dentro). */
  readonly sombra: Float32Array
  /** O cume mais alto (px) e as caixas do pé e da sombra. */
  readonly maisAlto: number
  readonly caixaDoPe: readonly [number, number, number, number]
  readonly caixaDaSombra: readonly [number, number, number, number]
  /** A 3/4, feita só quando pedida. */
  tres?: Projecao
}

/** O que `lerTerreno` devolve: altura, inclinação em x e em y, o côncavo e o largo (sem alocar no laço do pintor). */
const LIDO = new Float64Array(5)

function lerTerreno(t: Terreno, x: number, y: number): void {
  let fx = x - t.x0
  let fy = y - t.y0
  fx = fx < 0 ? 0 : fx > t.nx - 1.001 ? t.nx - 1.001 : fx
  fy = fy < 0 ? 0 : fy > t.ny - 1.001 ? t.ny - 1.001 : fy
  const i = Math.floor(fx)
  const j = Math.floor(fy)
  const tx = fx - i
  const ty = fy - j
  const a = j * t.nx + i
  const b = a + 1
  const c = a + t.nx
  const d = c + 1
  const w00 = (1 - tx) * (1 - ty)
  const w10 = tx * (1 - ty)
  const w01 = (1 - tx) * ty
  const w11 = tx * ty
  LIDO[0] = t.h[a] * w00 + t.h[b] * w10 + t.h[c] * w01 + t.h[d] * w11
  LIDO[1] = t.gx[a] * w00 + t.gx[b] * w10 + t.gx[c] * w01 + t.gx[d] * w11
  LIDO[2] = t.gy[a] * w00 + t.gy[b] * w10 + t.gy[c] * w01 + t.gy[d] * w11
  LIDO[3] = t.concavo[a] * w00 + t.concavo[b] * w10 + t.concavo[c] * w01 + t.concavo[d] * w11
  LIDO[4] = t.largo[a] * w00 + t.largo[b] * w10 + t.largo[c] * w01 + t.largo[d] * w11
}

/** Um valor de uma grade de nx x ny com o nó (0, 0) em (x0, y0), interpolado; fora dela, `fora`. */
function naGrade(g: Float32Array, nx: number, ny: number, x0: number, y0: number, x: number, y: number, fora: number): number {
  const fx = x - x0
  const fy = y - y0
  if (fx < 0 || fy < 0 || fx >= nx - 1 || fy >= ny - 1) return fora
  const i = Math.floor(fx)
  const j = Math.floor(fy)
  const tx = fx - i
  const ty = fy - j
  const a = j * nx + i
  return (g[a] * (1 - tx) + g[a + 1] * tx) * (1 - ty) + (g[a + nx] * (1 - tx) + g[a + nx + 1] * tx) * ty
}

/** A distância do ponto ao pedaço e onde ele cai nele (0 a 1), em `PERTO`. */
const PERTO = new Float64Array(2)
function pertoDoPedaco(p: Pedaco, x: number, y: number): void {
  const ex = p.bx - p.ax
  const ey = p.by - p.ay
  const l2 = ex * ex + ey * ey
  let t = l2 > 0 ? ((x - p.ax) * ex + (y - p.ay) * ey) / l2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const dx = x - p.ax - ex * t
  const dy = y - p.ay - ey * t
  PERTO[0] = Math.sqrt(dx * dx + dy * dy)
  PERTO[1] = t
}

/** A encosta de uma aresta: quanto ela desceu a `d` px do fio (côncava; o fio é arredondado). */
function descida(d: number): number {
  const r = Math.sqrt(d * d + RAIO_DA_CRISTA * RAIO_DA_CRISTA) - RAIO_DA_CRISTA
  return (INCLINACAO_PERTO_DO_FIO * r) / (1 + r / CURVA_DO_FLANCO) + INCLINACAO_DO_FLANCO * r
}

/** A grade grossa do esqueleto: cada pedaço pinta só onde a encosta dele ainda está acima do `FUNDO`. */
function* esqueletoNaGrade(pedacos: readonly Pedaco[], x0: number, y0: number, nx: number, ny: number, torcidoX: Float32Array, torcidoY: Float32Array, folga: number): Generator<void, Float32Array, void> {
  const h = new Float32Array(nx * ny).fill(FUNDO)
  let feitos = 0
  for (const p of pedacos) {
    const alcance = (Math.max(p.ha, p.hb) - FUNDO) / INCLINACAO_DO_FLANCO + RAIO_DA_CRISTA + folga
    const i0 = Math.max(0, Math.floor((Math.min(p.ax, p.bx) - alcance - x0) / PASSO_GROSSO))
    const i1 = Math.min(nx - 1, Math.ceil((Math.max(p.ax, p.bx) + alcance - x0) / PASSO_GROSSO))
    const j0 = Math.max(0, Math.floor((Math.min(p.ay, p.by) - alcance - y0) / PASSO_GROSSO))
    const j1 = Math.min(ny - 1, Math.ceil((Math.max(p.ay, p.by) + alcance - y0) / PASSO_GROSSO))
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const o = j * nx + i
        pertoDoPedaco(p, torcidoX[o], torcidoY[o])
        const v = p.ha + (p.hb - p.ha) * PERTO[1] - descida(PERTO[0])
        if (v > h[o]) h[o] = v
      }
    }
    feitos += (i1 - i0 + 1) * (j1 - j0 + 1)
    // Uma pausa a cada ~60 mil nós: o pedaço da crista da grande pinta ~25 mil.
    if (feitos > 60_000) {
      feitos = 0
      yield
    }
  }
  return h
}

/** As arestas de rocha: ruído "de crista" (1 - |ruído|, ao quadrado) em oitavas, com a média tirada. */
function arestas(x: number, y: number, k0: number, semente: number): number {
  let soma = 0
  let peso = 0
  let a = 1
  let k = k0
  for (let o = 0; o < OITAVAS_DAS_ARESTAS; o += 1) {
    const r = 1 - Math.abs(2 * ruido(x * k + semente + o * 17, y * k + o * 29))
    soma += a * r * r
    peso += a
    a *= 0.5
    k *= 2.07
  }
  return soma / peso - 0.42
}

/**
 * As GROTAS: o ruído de erosão em células (a técnica do "eroded terrain noise" de Clay John, 2022, refeita aqui). Em
 * cada célula um ponto sorteado; em volta dele, listras cuja onda corre DE LADO na encosta (perpendicular à
 * inclinação), então os sulcos descem morro abaixo. As oitavas finas usam a inclinação já sulcada pelas grossas: os
 * sulcos miúdos entortam para dentro dos maiores e a rede ramifica. Na encosta plana a onda some (sem listra no pé).
 * O peso de cada ponto é um sino barato (1 - d²/r²)², e o cosseno sai de tabela: a conta roda no relevo inteiro.
 */
const CELULA_DA_EROSAO = 0.16
const OITAVAS_DA_EROSAO = 3
/** A profundidade dos sulcos da oitava grossa (fração do cume mais alto). */
const FORCA_DA_EROSAO = 0.035
/** Quantas ondas por célula na encosta de inclinação 1 e quanto a inclinação já sulcada entorta a oitava seguinte. */
const ONDAS_POR_INCLINACAO = 0.75
const RAMIFICA = 0.35
/** A encosta mais branda que já ganha sulco e a que ganha o sulco inteiro. */
const SULCO_A_PARTIR_DE = 0.35
const SULCO_INTEIRO_EM = 0.9
const RAIO_DA_CELULA2 = 2.25
const VOLTA = 1024
const COS_DA_VOLTA = new Float32Array(VOLTA)
const SEN_DA_VOLTA = new Float32Array(VOLTA)
for (let i = 0; i < VOLTA; i += 1) {
  COS_DA_VOLTA[i] = Math.cos((2 * Math.PI * i) / VOLTA)
  SEN_DA_VOLTA[i] = Math.sin((2 * Math.PI * i) / VOLTA)
}

/** O valor (entre -1 e 1) e a derivada (por célula) das listras em p, com a onda `dir` (voltas por célula). */
const LISTRA = new Float64Array(3)
function listras(px: number, py: number, dirX: number, dirY: number, semente: number): void {
  const ix = Math.floor(px)
  const iy = Math.floor(py)
  let v = 0
  let dx = 0
  let dy = 0
  let peso = 0
  for (let j = -1; j <= 1; j += 1) {
    for (let i = -1; i <= 1; i += 1) {
      const cx = ix + i
      const cy = iy + j
      const qx = px - cx - 0.5 * hash(cx, cy, semente)
      const qy = py - cy - 0.5 * hash(cy, cx, semente + 7)
      const d2 = qx * qx + qy * qy
      if (d2 >= RAIO_DA_CELULA2) continue
      const k = 1 - d2 / RAIO_DA_CELULA2
      const w = k * k
      const fase = qx * dirX + qy * dirY
      const t = ((fase - Math.floor(fase)) * VOLTA) | 0
      const sen = SEN_DA_VOLTA[t]
      v += COS_DA_VOLTA[t] * w
      dx -= sen * dirX * w
      dy -= sen * dirY * w
      peso += w
    }
  }
  const norma = peso > 0 ? 1 / peso : 0
  LISTRA[0] = v * norma
  LISTRA[1] = dx * norma * 2 * Math.PI
  LISTRA[2] = dy * norma * 2 * Math.PI
}

/** O quanto as grotas mudam a altura (px) no ponto (x, y) do objeto, com a inclinação da forma grande (gx, gy) ali. */
function erodir(x: number, y: number, gx: number, gy: number, celula: number, maisAlto: number, semente: number): number {
  const inclinacao = Math.sqrt(gx * gx + gy * gy)
  const sulco = passoSuave(SULCO_A_PARTIR_DE, SULCO_INTEIRO_EM, inclinacao)
  if (sulco <= 0) return 0
  let soma = 0
  let hx = 0
  let hy = 0
  let a = FORCA_DA_EROSAO * maisAlto
  let f = 1 / celula
  for (let o = 0; o < OITAVAS_DA_EROSAO; o += 1) {
    // A onda corre de lado na encosta: perpendicular à inclinação (a da forma e a dos sulcos já feitos).
    const ix = gx + RAMIFICA * hx
    const iy = gy + RAMIFICA * hy
    listras(x * f, y * f, ONDAS_POR_INCLINACAO * iy, -ONDAS_POR_INCLINACAO * ix, semente * 13 + o * 101)
    soma += a * LISTRA[0]
    hx += a * LISTRA[1] * f
    hy += a * LISTRA[2] * f
    a *= 0.5
    f *= 2
  }
  return soma * sulco
}

/** Borra a grade com uma caixa de raio `r` nas duas direções (duas passadas, já quase um sino), por soma corrida. */
function* borrar(g: Float32Array, nx: number, ny: number, r: number): Generator<void, Float32Array, void> {
  const a = new Float32Array(g)
  const b = new Float32Array(g.length)
  const lado = 2 * r + 1
  for (let passada = 0; passada < 2; passada += 1) {
    for (let j = 0; j < ny; j += 1) {
      const base = j * nx
      let soma = a[base] * (r + 1)
      for (let k = 1; k <= r; k += 1) soma += a[base + Math.min(nx - 1, k)]
      for (let i = 0; i < nx; i += 1) {
        b[base + i] = soma / lado
        soma += a[base + Math.min(nx - 1, i + r + 1)] - a[base + Math.max(0, i - r)]
      }
    }
    yield
    for (let i = 0; i < nx; i += 1) {
      let soma = b[i] * (r + 1)
      for (let k = 1; k <= r; k += 1) soma += b[Math.min(ny - 1, k) * nx + i]
      for (let j = 0; j < ny; j += 1) {
        a[j * nx + i] = soma / lado
        soma += b[Math.min(ny - 1, j + r + 1) * nx + i] - b[Math.max(0, j - r) * nx + i]
      }
    }
    yield
  }
  return a
}

/** A caixa dos nós com valor abaixo de `limite` em `g` (a forma e as folgas): nunca vazia (cai na grade inteira). */
function caixaDe(g: Float32Array, nx: number, ny: number, x0: number, y0: number, limite: number, folga: number): [number, number, number, number] {
  let [i0, j0, i1, j1] = [nx, ny, -1, -1]
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      if (g[j * nx + i] >= limite) continue
      if (i < i0) i0 = i
      if (i > i1) i1 = i
      if (j < j0) j0 = j
      if (j > j1) j1 = j
    }
  }
  if (i1 < 0) return [x0, y0, x0 + nx - 1, y0 + ny - 1]
  return [x0 + i0 - folga, y0 + j0 - folga, x0 + i1 + folga, y0 + j1 + folga]
}

/** A distância (negativa dentro) da curva de nível zero de `v`: o valor dividido pela inclinação dele. */
function* distanciaDoNivel(v: Float32Array, nx: number, ny: number): Generator<void, Float32Array, void> {
  const d = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const o = j * nx + i
      const ia = i > 0 ? i - 1 : 0
      const ib = i < nx - 1 ? i + 1 : nx - 1
      const ja = j > 0 ? j - 1 : 0
      const jb = j < ny - 1 ? j + 1 : ny - 1
      const gx = (v[j * nx + ib] - v[j * nx + ia]) / (ib - ia)
      const gy = (v[jb * nx + i] - v[ja * nx + i]) / (jb - ja)
      const g = Math.sqrt(gx * gx + gy * gy)
      d[o] = -v[o] / (g > INCLINACAO_MINIMA ? g : INCLINACAO_MINIMA)
    }
    if (j % (LINHAS_POR_PASSO * 4) === 0) yield
  }
  return d
}

/** A margem da grade além da caixa (px): o pé, a sombra e a distância de fora precisam de chão em volta. */
const MARGEM = 6

/**
 * O relevo de um tamanho na TELA, para a pegada (w x h px do objeto) e o giro (quartos de volta), em PASSOS: pausa a
 * cada faixa de linhas (o raster anda isto nas fatias da fila; o teste roda tudo de uma vez com `rodar`).
 */
function* montarTerreno(relevo: Relevo, w: number, h: number, q: number): Generator<void, Terreno, void> {
  const [hw, hh] = [w / 2, h / 2]
  const escala = Math.min(w / (relevo.casasW * G), h / (relevo.casasH * G))
  const raio = Math.sqrt(hw * hh)
  const s = relevo.semente
  const n = relevo.crista.length
  const crista: CristaEmPx = { n, x: new Float64Array(n), y: new Float64Array(n), h: new Float64Array(n), r: new Float64Array(n) }
  relevo.crista.forEach((p, i) => {
    crista.x[i] = p.x * hw
    crista.y[i] = p.y * hh
    crista.h[i] = p.altura * G * escala
    crista.r[i] = p.largura * raio
  })
  const pe = (x: number, y: number): number => distanciaAoPe(crista, hw, hh, raio, s, x, y)
  const molde: Molde = { pe, q, raio, pedacos: [] }
  esqueleto(relevo, crista, molde, s)
  let maisAltoDaCrista = 0
  for (let i = 0; i < n; i += 1) if (crista.h[i] > maisAltoDaCrista) maisAltoDaCrista = crista.h[i]
  yield

  const [tw, th] = q % 2 === 1 ? [hh, hw] : [hw, hh]
  const mx = Math.ceil(tw + MARGEM)
  const my = Math.ceil(th + MARGEM)
  const [nx, ny, x0, y0] = [2 * mx + 1, 2 * my + 1, -mx, -my]
  // A grade grossa: o ponto empurrado pelo ruído (lido no objeto e levado à tela) e o esqueleto.
  // Um nó a mais que a fina em cada direção: a fina nunca lê fora da grossa (fora, o chão saltava e a sombra riscava a beira).
  const gnx = mx + 2
  const gny = my + 2
  const torcidoX = new Float32Array(gnx * gny)
  const torcidoY = new Float32Array(gnx * gny)
  const amplitude = TORCIDO * raio
  // O giro em coeficientes (as voltas de 90 graus): nos laços quentes, sem um par novo por nó.
  const [oa, oc] = noObjeto(1, 0, q)
  const [ob, od] = noObjeto(0, 1, q)
  const [ta, tc] = naTela(1, 0, q)
  const [tb, td] = naTela(0, 1, q)
  const onda = 1 / (ONDA_DO_TORCIDO * raio)
  for (let j = 0; j < gny; j += 1) {
    for (let i = 0; i < gnx; i += 1) {
      const xs = x0 + i * PASSO_GROSSO
      const ys = y0 + j * PASSO_GROSSO
      const xo = oa * xs + ob * ys
      const yo = oc * xs + od * ys
      const ux = amplitude * ruido(xo * onda + s, yo * onda)
      const uy = amplitude * ruido(xo * onda + s + 40, yo * onda + 40)
      torcidoX[j * gnx + i] = xs + ta * ux + tb * uy
      torcidoY[j * gnx + i] = ys + tc * ux + td * uy
    }
  }
  yield
  const grossa = yield* esqueletoNaGrade(molde.pedacos, x0, y0, gnx, gny, torcidoX, torcidoY, amplitude)
  // A forma grande na grade grossa: as arestas sobre a base do maciço, emendadas sem quina.
  const dentroDoPe = new Float32Array(gnx * gny)
  for (let j = 0; j < gny; j += 1) {
    for (let i = 0; i < gnx; i += 1) {
      const o = j * gnx + i
      const xs = x0 + i * PASSO_GROSSO
      const ys = y0 + j * PASSO_GROSSO
      const dentro = -pe(oa * xs + ob * ys, oc * xs + od * ys)
      dentroDoPe[o] = dentro
      const base = minimoSuave(INCLINACAO_DA_BASE * dentro, TETO_DA_BASE * maisAltoDaCrista, EMENDA_DA_BASE * maisAltoDaCrista)
      grossa[o] = maximoSuave(grossa[o], base, EMENDA_DA_BASE * maisAltoDaCrista)
    }
    if (j % LINHAS_POR_PASSO === 0) yield
  }
  // As GROTAS (`erodir`, que corre morro abaixo pela inclinação da forma grande), a rocha quebrada por cima e o teto
  // do pé: nada passa do pé.
  const kArestas = 1 / (ONDA_DAS_ARESTAS * raio)
  const esculpido = new Float32Array(gnx * gny)
  const celula = CELULA_DA_EROSAO * raio
  for (let j = 0; j < gny; j += 1) {
    const ja = j > 0 ? j - 1 : 0
    const jb = j < gny - 1 ? j + 1 : gny - 1
    for (let i = 0; i < gnx; i += 1) {
      const o = j * gnx + i
      const xs = x0 + i * PASSO_GROSSO
      const ys = y0 + j * PASSO_GROSSO
      const xo = oa * xs + ob * ys
      const yo = oc * xs + od * ys
      let z = grossa[o]
      if (z > 0) {
        const ia = i > 0 ? i - 1 : 0
        const ib = i < gnx - 1 ? i + 1 : gnx - 1
        // A inclinação da forma grande, no objeto (o ruído da erosão é lido no objeto: girar a peça só gira o desenho).
        const gxs = (grossa[j * gnx + ib] - grossa[j * gnx + ia]) / ((ib - ia) * PASSO_GROSSO)
        const gys = (grossa[jb * gnx + i] - grossa[ja * gnx + i]) / ((jb - ja) * PASSO_GROSSO)
        // Sem sulco no cume (as arestas dele ficam limpas) nem rocha quebrada na base chata (o pé fica liso).
        const gxo = oa * gxs + ob * gys
        const gyo = oc * gxs + od * gys
        z += erodir(xo, yo, gxo, gyo, celula, maisAltoDaCrista, s) * (1 - passoSuave(0.6, 0.95, z / maisAltoDaCrista))
        z += FORCA_DAS_ARESTAS * maisAltoDaCrista * Math.sqrt(Math.min(1, Math.max(0, z) / maisAltoDaCrista)) * passoSuave(0.2, 0.9, Math.sqrt(gxo * gxo + gyo * gyo)) * arestas(xo, yo, kArestas, s * 5)
      }
      z = minimoSuave(z, INCLINACAO_DO_PE * dentroDoPe[o], EMENDA_DO_PE)
      esculpido[o] = z > FUNDO ? z : FUNDO
    }
    if (j % LINHAS_POR_PASSO === 0) yield
  }
  grossa.set(esculpido)
  // A grade fina: a grossa interpolada e as arestas miúdas da rocha (lisas na saia, onde o alfa cai).
  const altura = new Float32Array(nx * ny)
  const kMiuda = 1 / (ONDA_DAS_ARESTAS_MIUDAS * raio)
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      let z = naGrade(grossa, gnx, gny, 0, 0, i / PASSO_GROSSO, j / PASSO_GROSSO, FUNDO)
      if (z > 0) {
        const xo = oa * (x0 + i) + ob * (y0 + j)
        const yo = oc * (x0 + i) + od * (y0 + j)
        z += FORCA_DAS_ARESTAS_MIUDAS * maisAltoDaCrista * Math.sqrt(Math.min(1, z / maisAltoDaCrista)) * passoSuave(0, ARESTAS_ACIMA_DE, z) * arestas(xo, yo, kMiuda, s * 9)
      }
      altura[j * nx + i] = z
    }
    if (j % (LINHAS_POR_PASSO * 2) === 0) yield
  }
  const gx = new Float32Array(nx * ny)
  const gy = new Float32Array(nx * ny)
  let maisAlto = 0
  for (let j = 0; j < ny; j += 1) {
    for (let i = 0; i < nx; i += 1) {
      const o = j * nx + i
      const ia = i > 0 ? i - 1 : 0
      const ib = i < nx - 1 ? i + 1 : nx - 1
      const ja = j > 0 ? j - 1 : 0
      const jb = j < ny - 1 ? j + 1 : ny - 1
      gx[o] = (altura[j * nx + ib] - altura[j * nx + ia]) / (ib - ia)
      gy[o] = (altura[jb * nx + i] - altura[ja * nx + i]) / (jb - ja)
      if (altura[o] > maisAlto) maisAlto = altura[o]
    }
  }
  yield
  // O côncavo nas duas escalas: o borrão menos a altura (a grota fica acima da média em volta), na régua de cada um.
  const miuda = yield* borrar(altura, nx, ny, RAIO_DO_CONCAVO)
  const larga = yield* borrar(altura, nx, ny, RAIO_DO_LARGO)
  const concavo = new Float32Array(nx * ny)
  const largo = new Float32Array(nx * ny)
  for (let o = 0; o < concavo.length; o += 1) {
    concavo[o] = (miuda[o] - altura[o]) / REGUA_DO_CONCAVO
    largo[o] = (larga[o] - altura[o]) / REGUA_DO_LARGO
  }
  yield
  const distanciaDoPe = yield* distanciaDoNivel(altura, nx, ny)
  // A sombra no chão é só a que passa do próprio relevo (o pé baixo à luz não faz sombra embaixo de si: com o alfa
  // caindo na saia, ela aparecia como um aro escuro em volta da montanha inteira).
  const projetada = sombraNoChao(altura, nx, ny)
  for (let o = 0; o < projetada.length; o += 1) projetada[o] -= (altura[o] > 0 ? altura[o] : 0) + 1
  yield
  const sombra = yield* distanciaDoNivel(projetada, nx, ny)
  return {
    x0,
    y0,
    nx,
    ny,
    h: altura,
    gx,
    gy,
    concavo,
    largo,
    pe: distanciaDoPe,
    sombra,
    maisAlto,
    caixaDoPe: caixaDe(distanciaDoPe, nx, ny, x0, y0, 3, 1),
    caixaDaSombra: caixaDe(sombra, nx, ny, x0, y0, 3, 1),
  }
}

/**
 * A SOMBRA NO CHÃO, numa varredura: o ponto está na sombra se algum ponto do relevo na direção da luz (o contrário
 * de `SOMBRA_X`/`SOMBRA_Y`, a mesma conta das sombras do motor) está mais alto que a distância até ele. Andando uma
 * coluna para a direita a sombra anda `1 / SOMBRA_X` de altura; a linha de antes é lida interpolada em y.
 */
function sombraNoChao(h: Float32Array, nx: number, ny: number): Float32Array {
  const s = new Float32Array(h)
  const desce = 1 / SOMBRA_X_DA_MONTANHA
  const dy = SOMBRA_Y_DA_MONTANHA * desce
  for (let i = 1; i < nx; i += 1) {
    for (let j = 0; j < ny; j += 1) {
      const fy = j - dy
      if (fy < 0) continue
      const j0 = Math.floor(fy)
      const t = fy - j0
      const j1 = Math.min(ny - 1, j0 + 1)
      const antes = s[j0 * nx + i - 1] * (1 - t) + s[j1 * nx + i - 1] * t - desce
      const o = j * nx + i
      if (antes > s[o]) s[o] = antes
    }
  }
  return s
}

/** A direção da sombra no chão (px por px de altura): a do motor (`motor.ts`, `SOMBRA_X` e `SOMBRA_Y`). */
const SOMBRA_X_DA_MONTANHA = 0.27
const SOMBRA_Y_DA_MONTANHA = 0.21

// ---------- a 3/4: o relevo projetado ----------

/**
 * A PROJEÇÃO da 3/4 (a tela é y - z), na mesma coluna de 1 px do terreno e em linhas de 1 px: para cada pixel, o y
 * do ponto do relevo que ele mostra (NaN = chão), a distância até a silhueta e o fio entre uma crista da frente e o
 * que fica atrás dela.
 */
interface Projecao {
  readonly y0: number
  readonly nl: number
  readonly visto: Float32Array
  readonly silhueta: Float32Array
  readonly fio: Float32Array
  readonly caixa: readonly [number, number, number, number]
}

/** O salto de profundidade (px do relevo) entre dois pixels vizinhos que já é uma crista na frente de outra. */
const SALTO_DA_CRISTA = 7
/** Colunas entre duas pausas da projeção. */
const COLUNAS_POR_PASSO = 48

function* projetar(t: Terreno): Generator<void, Projecao, void> {
  const { nx, ny, x0, h } = t
  const subida = Math.ceil(t.maisAlto) + 2
  const y0 = t.y0 - subida
  const nl = ny + subida
  const visto = new Float32Array(nx * nl).fill(Number.NaN)
  // m = y' + o maior (h - y) da linha y' para a frente: m >= 0 é relevo na tela, e a curva m = 0 é a silhueta.
  const m = new Float32Array(nx * nl)
  const maiorDaFrente = new Float32Array(ny)
  for (let i = 0; i < nx; i += 1) {
    let maior = -Infinity
    for (let j = ny - 1; j >= 0; j -= 1) {
      const g = h[j * nx + i] - (t.y0 + j)
      if (g > maior) maior = g
      maiorDaFrente[j] = maior
    }
    // Da frente para trás, como um pintor de relevo: cada ponto cobre as linhas da tela entre a altura dele e o topo
    // do que já foi coberto (e nunca abaixo do próprio pé).
    let topo = Infinity
    let anterior = Number.NaN
    for (let j = ny - 1; j >= 0; j -= 1) {
      const z = h[j * nx + i]
      const y = t.y0 + j
      if (z < 0) {
        anterior = Number.NaN
        continue
      }
      const p = y - z
      const ate = Math.min(topo, y + 0.5)
      for (let k = Math.ceil(p - y0); y0 + k < ate; k += 1) {
        const yl = y0 + k
        // Entre este ponto e o da frente (projeção `anterior`), o y do relevo anda em linha reta.
        const frac = anterior > p ? Math.min(1, (yl - p) / (anterior - p)) : 0
        visto[k * nx + i] = y + frac
      }
      if (p < topo) topo = p
      anterior = p
    }
    for (let k = 0; k < nl; k += 1) {
      const yl = y0 + k
      const f = yl - t.y0
      let v: number
      if (f <= 0) v = maiorDaFrente[0]
      else if (f >= ny - 1) v = h[(ny - 1) * nx + i] - (t.y0 + ny - 1)
      else {
        const j = Math.floor(f)
        const a = f - j
        const aqui = (h[j * nx + i] - (t.y0 + j)) * (1 - a) + (h[(j + 1) * nx + i] - (t.y0 + j + 1)) * a
        v = Math.max(aqui, maiorDaFrente[j + 1])
      }
      m[k * nx + i] = yl + v
    }
    if (i % COLUNAS_POR_PASSO === 0) yield
  }
  const silhueta = yield* distanciaDoNivel(m, nx, nl)
  const fio = new Float32Array(nx * nl)
  for (let k = 1; k < nl; k += 1) {
    for (let i = 1; i < nx - 1; i += 1) {
      const o = k * nx + i
      const v = visto[o]
      if (Number.isNaN(v)) continue
      // A crista da frente: o pixel de cima (ou do lado) mostra um ponto bem mais ao fundo.
      const cima = visto[o - nx]
      const esquerda = visto[o - 1]
      const direita = visto[o + 1]
      let salto = 0
      if (!Number.isNaN(cima)) salto = Math.max(salto, v - cima)
      if (!Number.isNaN(esquerda)) salto = Math.max(salto, v - esquerda)
      if (!Number.isNaN(direita)) salto = Math.max(salto, v - direita)
      fio[o] = passoSuave(SALTO_DA_CRISTA * 0.6, SALTO_DA_CRISTA * 1.6, salto)
    }
    if (k % (LINHAS_POR_PASSO * 4) === 0) yield
  }
  return { y0, nl, visto, silhueta, fio, caixa: caixaDe(silhueta, nx, nl, x0, y0, 3, 1) }
}

/** O y do relevo que o pixel (x, y') da 3/4 mostra: interpolado entre linhas vizinhas do mesmo pedaço; no chão, o próprio y'. */
function yVisto(t: Terreno, p: Projecao, x: number, y: number): number {
  const fx = x - t.x0
  const fy = y - p.y0
  if (fx < 0 || fy < 0 || fx >= t.nx - 1 || fy >= p.nl - 1) return y
  const i = Math.round(fx)
  const k = Math.floor(fy)
  const a = p.visto[k * t.nx + i]
  const b = p.visto[(k + 1) * t.nx + i]
  if (Number.isNaN(a)) return Number.isNaN(b) ? y : b
  if (Number.isNaN(b) || Math.abs(b - a) > SALTO_DA_CRISTA) return fy - k < 0.5 || Number.isNaN(b) ? a : b
  return a + (b - a) * (fy - k)
}

// ---------- o cache e o preparo ----------

/** Quantos relevos ficam guardados: as duas vistas, a neve e os níveis de um tamanho e giro leem o mesmo. */
const GUARDADOS_NO_MAXIMO = 4
const GUARDADOS = new Map<string, Terreno>()

function chaveDoRelevo(relevo: Relevo, w: number, h: number, q: number): string {
  return `${relevo.nome}|${w}|${h}|${q}`
}

function guardar(chave: string, t: Terreno): void {
  GUARDADOS.set(chave, t)
  if (GUARDADOS.size > GUARDADOS_NO_MAXIMO) GUARDADOS.delete(GUARDADOS.keys().next().value as string)
}

/** Roda os passos até o fim e devolve o que eles montam (o caminho de uma vez: o teste, a folha e o relevo frio sem preparo). */
function rodar<T>(passos: Generator<void, T, void>): T {
  let r = passos.next()
  while (r.done !== true) r = passos.next()
  return r.value
}

/**
 * O PREPARO do raster: monta (em passos) o relevo deste tamanho e giro e, na 3/4, a projeção, e guarda. Já guardado,
 * não faz nada. Roda antes de `montarCena`, que então só lê o cache.
 */
function* prepararRelevo(relevo: Relevo, w: number, h: number, q: number, tres: boolean): Generator<void, void, void> {
  const chave = chaveDoRelevo(relevo, w, h, q)
  let t = GUARDADOS.get(chave)
  if (t === undefined) {
    t = yield* montarTerreno(relevo, w, h, q)
    guardar(chave, t)
  }
  if (tres && t.tres === undefined) t.tres = yield* projetar(t)
}

function terrenoDe(relevo: Relevo, w: number, h: number, q: number): Terreno {
  const chave = chaveDoRelevo(relevo, w, h, q)
  const guardado = GUARDADOS.get(chave)
  if (guardado !== undefined) {
    // O mais usado vai para o fim (o primeiro do mapa é o que sai).
    GUARDADOS.delete(chave)
    GUARDADOS.set(chave, guardado)
    return guardado
  }
  const novo = rodar(montarTerreno(relevo, w, h, q))
  guardar(chave, novo)
  return novo
}

function projecaoDe(t: Terreno): Projecao {
  if (t.tres === undefined) t.tres = rodar(projetar(t))
  return t.tres
}

/** O preparo de um tamanho, como o raster o pede: `null` quando o relevo (e a projeção, na 3/4) já está guardado. */
function preparoDe(relevo: Relevo): PrepararCena {
  return (w, h, giro, vista) => {
    const q = quartosDoGiro(giro)
    const t = GUARDADOS.get(chaveDoRelevo(relevo, w, h, q))
    const tres = vista === 'tres-quartos'
    if (t !== undefined && (!tres || t.tres !== undefined)) return null
    return prepararRelevo(relevo, w, h, q, tres)
  }
}

// ---------- a cor ----------

/** A luz NA TELA: a do motor (`motor.ts`, de cima à esquerda, um pouco mais da esquerda). */
const LUZ_X = -0.62
const LUZ_Y = -0.48
/** A face virada para a luz clareia e a do outro lado escurece (luz somada), a encosta íngreme escurece um pouco, e o teto dos dois lados. */
const FORCA_DA_ENCOSTA = 0.58
const ESCURO_DO_INGREME = 0.16
const LUZ_MAIS_ESCURA = -0.4
const LUZ_MAIS_CLARA = 0.24
/** A grota escurece e a aresta ganha um fio de luz: na escala miúda e na larga (a que se lê a 47%). */
const ESCURO_DO_VALE = 0.1
const LUZ_DA_CRISTA = 0.06
const ESCURO_DO_VALE_LARGO = 0.12
const LUZ_DA_CRISTA_LARGA = 0.06
/** O alto fica mais claro (o ar entre o olho e o pé). */
const CLARO_DO_ALTO = 0.04
/** O grão da rocha (luz somada) e as manchas de tom, uma mais quente e outra mais fria, e o tamanho delas (1/px). */
const GRAO_DA_ROCHA = 0.035
const MANCHA_DA_ROCHA = 0.22
const ONDA_DA_MANCHA = 0.028
/** A face na sombra puxa para o frio (a luz do céu), no máximo isto. */
const FRIO_NA_SOMBRA = 0.32
/** O fio escuro da crista da frente na 3/4. */
const ESCURO_DO_FIO = 0.2

/** A SAIA do pé: até que altura (fração do cume mais alto), em que inclinação ela some e quanto toma da cor. */
const ALTURA_DA_SAIA = 0.12
const INCLINACAO_DA_SAIA = 1.05
const COR_DA_SAIA = 0.85
/** O alfa cai na saia, do pé até esta altura (fração do cume mais alto, nunca menos de 6 px): a montanha some no chão, sem beira, qualquer que seja o chão. */
const DESBOTA_DO_PE = 0.09
const DESBOTA_MINIMO = 6

/** A neve no sol e na sombra (azulada, contida). */
const NEVE_NO_SOL: Rgb = [0xe2, 0xe4, 0xe0]
const NEVE_NA_SOMBRA: Rgb = [0xa9, 0xb4, 0xc1]
/** A linha da neve (fração do cume mais alto) e o que a mexe: a grota segura, a face a prumo e a aresta soltam, a sombra guarda. */
const LINHA_DA_NEVE = 0.54
const NEVE_NO_CONCAVO = 0.18
const NEVE_NO_LARGO = 0.08
const NEVE_ESCORRE_DE = 1.7
const NEVE_ESCORRE_ATE = 2.5
const NEVE_NA_FACE_A_PRUMO = 0.16
const NEVE_NA_SOMBRA_GUARDA = 0.07
const RASGO_DA_NEVE = 0.055
/** A borda da neve (fração do cume mais alto, de cada lado): estreita, a neve tem beira. */
const BEIRA_DA_NEVE = 0.022
/** Na neve a luz da encosta fica mais branda. */
const LUZ_NA_NEVE = 0.4

/** Os tons fixos do Meio-Termo: o cinza-pardo da telha de madeira e um tico do barranco esquentam a rocha, a pedra clareia, o capim é a grama na sombra com musgo. */
const PARDO: Rgb = rgb(PALETA_MEIO_TERMO.telhaMadeira.base)
const BARRANCO: Rgb = rgb(PALETA_MEIO_TERMO.barranco.base)
const PEDRA_CLARA: Rgb = rgb(PALETA_MEIO_TERMO.pedra.base)
const CAPIM: Rgb = misturar(rgb(PALETA_MEIO_TERMO.grama.base), rgb(PALETA_MEIO_TERMO.musgo.base), 0.3)
const FRIO: Rgb = rgb(PALETA_MEIO_TERMO.telhaAzulClara.base)
/** Quanto a rocha puxa para o pardo, para o barranco (o quente) e para a pedra clara (não lê escura a 47%). */
const PARDO_DA_ROCHA = 0.45
const QUENTE_DA_ROCHA = 0.08
const CLARO_DA_ROCHA = 0.05
/** O escuro em que o pixel escuro demais é levantado (o piso de luz da pedra: cinza quente). */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

interface Clima {
  readonly neve: boolean
  readonly maisAlto: number
  readonly rocha: Rgb
  readonly quente: Rgb
  readonly fria: Rgb
  readonly alta: Rgb
  readonly cascalho: Rgb
  /** A altura (px) em que o alfa do pé chega a 1. */
  readonly desbota: number
}

function puxar(s: Float32Array, cor: Rgb, k: number): void {
  s[0] += (cor[0] - s[0]) * k
  s[1] += (cor[1] - s[1]) * k
  s[2] += (cor[2] - s[2]) * k
}

/**
 * A COR de um ponto (x, y) do relevo em `s` (a conta do pintor: cor, luz somada, emissão, alfa, pontilhado): a
 * rocha com as manchas e o grão, a luz pela encosta, a grota e a aresta nas duas escalas, o alto, a saia, o alfa do
 * pé e a neve.
 */
function sombrear(t: Terreno, clima: Clima, x: number, y: number, s: Float32Array): void {
  lerTerreno(t, x, y)
  const h = LIDO[0]
  const gx = LIDO[1]
  const gy = LIDO[2]
  const concavo = LIDO[3]
  const largo = LIDO[4]
  const relativa = h / clima.maisAlto
  // A rocha: o tom do alto (mais claro) e as manchas largas, uma mais quente e outra mais fria.
  s[0] = clima.rocha[0]
  s[1] = clima.rocha[1]
  s[2] = clima.rocha[2]
  puxar(s, clima.alta, passoSuave(0.3, 1, relativa) * 0.4)
  const mancha = ruido(x * ONDA_DA_MANCHA + 11, y * ONDA_DA_MANCHA + 3) * 2
  puxar(s, mancha > 0 ? clima.quente : clima.fria, Math.abs(mancha) * MANCHA_DA_ROCHA)
  // A luz da encosta: só a parte de lado da normal (a face de frente para a luz clareia, a de costas escurece, a de
  // lado fica), e a encosta íngreme um pouco mais escura.
  const inclinacao = Math.sqrt(gx * gx + gy * gy)
  const nz = 1 / Math.sqrt(inclinacao * inclinacao + 1)
  const sol = (-gx * LUZ_X - gy * LUZ_Y) * nz
  let luz = FORCA_DA_ENCOSTA * sol - ESCURO_DO_INGREME * (1 - nz)
  luz -= ESCURO_DO_VALE * passoSuave(0.15, 1.1, concavo)
  luz += LUZ_DA_CRISTA * passoSuave(0.15, 1.1, -concavo)
  luz -= ESCURO_DO_VALE_LARGO * passoSuave(0.1, 1, largo)
  luz += LUZ_DA_CRISTA_LARGA * passoSuave(0.1, 1, -largo)
  luz += CLARO_DO_ALTO * relativa
  luz += GRAO_DA_ROCHA * (ruido(x * 0.5 + 3, y * 0.5) + 0.6 * ruido(x * 1.3, y * 1.3 + 7))
  luz = luz < LUZ_MAIS_ESCURA ? LUZ_MAIS_ESCURA : luz > LUZ_MAIS_CLARA ? LUZ_MAIS_CLARA : luz
  // A face de costas para a luz puxa para o frio do céu: a sombra não é só o mesmo cinza mais escuro.
  if (sol < 0) puxar(s, FRIO, Math.min(1, -sol * 2.4) * FRIO_NA_SOMBRA)
  s[3] += luz
  // A saia do pé: cascalho e capim em manchas, onde o pé é baixo e não é a prumo; o alfa cai no fim dela.
  if (relativa < ALTURA_DA_SAIA) {
    const saia = (1 - passoSuave(ALTURA_DA_SAIA * 0.3, ALTURA_DA_SAIA, relativa)) * (1 - passoSuave(INCLINACAO_DA_SAIA * 0.55, INCLINACAO_DA_SAIA, inclinacao))
    if (saia > 0) {
      const capim = passoSuave(-0.08, 0.12, ruido(x * 0.045 + 5, y * 0.045) + 0.5 * ruido(x * 0.13, y * 0.13 + 9))
      const k = COR_DA_SAIA * saia
      puxar(s, clima.cascalho, k * (1 - capim))
      puxar(s, CAPIM, k * capim)
      s[3] -= luz * saia * 0.5
    }
  }
  s[5] *= passoSuave(0, clima.desbota, h)
  if (!clima.neve || relativa < LINHA_DA_NEVE - 0.35) return
  // A linha da neve: desce nas grotas, foge da aresta e da face a prumo, fica mais na sombra e se rasga no ruído.
  const rasgo = ruido(x * 0.06 + 3, y * 0.06 + 41) * 1.2 + ruido(x * 0.19 + 7, y * 0.19) * 0.6
  const prumo = passoSuave(NEVE_ESCORRE_DE, NEVE_ESCORRE_ATE, inclinacao)
  const excesso =
    relativa -
    LINHA_DA_NEVE +
    NEVE_NO_CONCAVO * Math.max(-0.6, Math.min(1.4, concavo)) +
    NEVE_NO_LARGO * Math.max(-1, Math.min(1, largo)) -
    NEVE_NA_FACE_A_PRUMO * prumo -
    NEVE_NA_SOMBRA_GUARDA * sol * 2 +
    RASGO_DA_NEVE * rasgo
  const neve = passoSuave(-BEIRA_DA_NEVE, BEIRA_DA_NEVE, excesso)
  if (neve <= 0) return
  const sombra = limitar01(-sol * 2.2 + 0.25 * (1 - nz))
  s[0] += (NEVE_NO_SOL[0] + (NEVE_NA_SOMBRA[0] - NEVE_NO_SOL[0]) * sombra - s[0]) * neve
  s[1] += (NEVE_NO_SOL[1] + (NEVE_NA_SOMBRA[1] - NEVE_NO_SOL[1]) * sombra - s[1]) * neve
  s[2] += (NEVE_NO_SOL[2] + (NEVE_NA_SOMBRA[2] - NEVE_NO_SOL[2]) * sombra - s[2]) * neve
  s[3] -= neve * (1 - LUZ_NA_NEVE) * luz
}

// ---------- a cena ----------

/** A sombra no chão: a força e o borrão (px). */
const FORCA_DA_SOMBRA = 0.24
const BORRAO_DA_SOMBRA = 2.6

/** A forma lida de uma grade de distâncias, com a caixa dada (fora da grade, longe). */
function formaDaGrade(g: Float32Array, nx: number, ny: number, x0: number, y0: number, caixa: readonly [number, number, number, number]): Forma {
  return { b: [caixa[0], caixa[1], caixa[2], caixa[3]], d: (x, y) => naGrade(g, nx, ny, x0, y0, x, y, 50) }
}

function montarRelevo(relevo: Relevo, c: ContextoDoMovel, cena: Cena): void {
  const q = quartosDoGiro(c.giro)
  const t = terrenoDe(relevo, c.w, c.h, q)
  const p = c.vista === 'tres-quartos' ? projecaoDe(t) : null
  const pedra = c.m.pedra
  const rocha = misturar(misturar(misturar(pedra.rgb, PARDO, PARDO_DA_ROCHA), BARRANCO, QUENTE_DA_ROCHA), PEDRA_CLARA, CLARO_DA_ROCHA)
  const clima: Clima = {
    neve: montanhaComNeve(c.variante),
    maisAlto: t.maisAlto,
    rocha,
    quente: misturar(rocha, BARRANCO, 0.35),
    fria: misturar(rocha, FRIO, 0.4),
    alta: misturar(rocha, PEDRA_CLARA, 0.35),
    cascalho: misturar(rocha, PEDRA_CLARA, 0.15),
    desbota: Math.max(DESBOTA_MINIMO, DESBOTA_DO_PE * t.maisAlto),
  }
  const tela: Cena = { partes: [], sombras: [], corDoPiso: ESCURO_DA_PEDRA }

  // No chão (as duas vistas): a sombra do relevo. Sem contato escuro em volta do pé: a saia some no chão.
  tela.sombras.push({ forma: formaDaGrade(t.sombra, t.nx, t.ny, t.x0, t.y0, t.caixaDaSombra), z: 0, suave: BORRAO_DA_SOMBRA, forca: FORCA_DA_SOMBRA })

  // O corpo: de cima, a curva do pé; na 3/4, a silhueta do relevo projetado. A cor é a mesma conta.
  const corpo = p === null ? formaDaGrade(t.pe, t.nx, t.ny, t.x0, t.y0, t.caixaDoPe) : formaDaGrade(p.silhueta, t.nx, p.nl, t.x0, p.y0, p.caixa)
  const textura: Textura =
    p === null
      ? (_u, _v, x, y, _peca, s) => sombrear(t, clima, x, y, s)
      : (_u, _v, x, y, _peca, s) => {
          sombrear(t, clima, x, yVisto(t, p, x, y), s)
          s[3] -= ESCURO_DO_FIO * naGrade(p.fio, t.nx, p.nl, t.x0, p.y0, x, y, 0)
        }
  tela.partes.push(c.peca(corpo, pedra, { tabua: 0, bisel: 0, contorno: 0, textura, semente: 2200 }))

  if (q === 0) {
    cena.partes.push(...tela.partes)
    cena.sombras.push(...tela.sombras)
    cena.corDoPiso = tela.corDoPiso
  } else desgirarCena(tela, q, cena)
}

export const montarMontanhaPequena: MontarMovel = (c, cena) => montarRelevo(RELEVOS.pequena, c, cena)
export const montarMontanhaMedia: MontarMovel = (c, cena) => montarRelevo(RELEVOS.media, c, cena)
export const montarMontanhaGrande: MontarMovel = (c, cena) => montarRelevo(RELEVOS.grande, c, cena)

export const prepararMontanhaPequena: PrepararCena = preparoDe(RELEVOS.pequena)
export const prepararMontanhaMedia: PrepararCena = preparoDe(RELEVOS.media)
export const prepararMontanhaGrande: PrepararCena = preparoDe(RELEVOS.grande)
