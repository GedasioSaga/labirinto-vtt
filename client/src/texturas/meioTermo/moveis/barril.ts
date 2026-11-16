/**
 * BARRIL de pé (rework de 15/11/2026, pedido do mestre: "quero um rework do
 * barril"). Antes, na 3/4, ele lia como um toco: o tampo redondo em cima e uma
 * coluna reta de aduelas embaixo, sem barriga e sem aro na frente. Agora é da
 * família dos barris deitados e do tonel (`pipaDeitada.ts`): as mesmas aduelas,
 * os mesmos aros de ferro, o mesmo tampo.
 *
 * DE CIMA aparece o TAMPO (o aro de ferro rente à borda, o topo das aduelas em
 * volta e as tábuas do fundo afundadas, com o batoque) e, em volta dele, o
 * bojo descendo para fora até a barriga, com o aro do quarto.
 *
 * NA 3/4 aparece o barril inteiro: o corpo BOJUDO (mais largo no meio que nas
 * pontas), as aduelas de pé que estreitam para os lados, os quatro aros dando a
 * volta em arco debaixo do tampo (dois em cima e dois embaixo, os das pontas
 * rentes ao tampo e ao chão) e a luz do cilindro (a conta do bojo da pipa: o
 * lado da luz claro, o outro escuro, a beira escurecendo). A regra da 3/4
 * (`tresQuartos.ts`) só sabe SUBIR peças: subir a vista de cima dava a coluna
 * reta, da largura da barriga do chão ao tampo.
 *
 * A SAÍDA é a da pipa deitada. O corpo como ele aparece na 3/4 é desenhado à
 * parte, já no lugar da tela (o QUADRO), e guardado em FATIAS debaixo do bojo
 * da vista de cima, onde nada dele aparece; cada fatia fica pendurada num PINO
 * com a altura dela, e a 3/4 a sobe de volta para o lugar. O quadro é mais alto
 * que o bojo (a altura mais os dois meios tampos) e, na barriga, tão largo
 * quanto ele: cada fatia é guardada onde a corda do bojo ainda a cobre, e as da
 * barriga ficam finas e guardadas bem no meio. O bojo da vista de cima sobe até
 * a barriga, onde fica inteiro atrás do quadro (o contorno dele é a volta mais
 * larga do corpo), e o tampo sobe a altura toda e fica por cima de tudo.
 *
 * GIRO: o barril é redondo. O corpo e a sombra são montados na tela e
 * devolvidos ao objeto (`desgirarCena`): saem iguais em qualquer giro, com a
 * luz no lugar. O tampo e o bojo de cima giram com o objeto, como a imagem da
 * vista de cima (as tábuas do fundo e o batoque vão junto).
 *
 * A SOMBRA no chão não sai de uma coluna (a coluna subiria a vista de cima
 * inteira até o tampo): é o corpo arrastado do pé até o tampo, para baixo à
 * direita, cada volta com o raio dela, em lances que ficam mais suaves longe do
 * pé (a conta da sombra do motor), mais o contato do pé.
 *
 * Materiais: `madeira` (as aduelas, o tampo e o batoque) e `aros`.
 */
import { anel, elipse, type Caixa, type Forma } from './formas'
import { bordaDaSombra, contato, SOMBRA_X, SOMBRA_Y, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'
import {
  desgirarCena,
  LUZ_DE_PE,
  noPino,
  pendurar,
  pintarBojo,
  pregar,
  quartosDoGiro,
  voltaDo,
  type Aro,
  type PecaDoQuadro,
  type Pino,
  type Pipa,
} from './pipaDeitada'

// ---------- as medidas ----------

/** A altura do barril, em casas: a do protótipo (`objetos.js`), a linha do balcão. */
const ALTURA = 0.62
/** O raio das pontas (o tampo e o pé), em fração do raio da barriga: o bojo. */
const PONTA = 0.84
/** Aduelas na meia volta da frente, como nos barris deitados. */
const ADUELAS = 9
/** A largura dos aros (px do protótipo): o da ponta, rente ao tampo e ao chão, e o do quarto, um pouco mais estreito. */
const ARO_DA_PONTA = 2.4
const ARO_DO_QUARTO = 2.1
/** Onde fica o meio do aro do quarto, em fração da altura a partir da ponta (o dos barris deitados). */
const LUGAR_DO_ARO_DO_QUARTO = 0.22
/** O aro do quarto visto de cima (px do protótipo): de cima a faixa dele quase some, então fica com esta largura. */
const ARO_DO_QUARTO_DE_CIMA = 1.1
/** O tampo: o aro de ferro rente à borda e o topo das aduelas em volta das tábuas do fundo (px do protótipo). */
const ARO_DO_TAMPO = 1
const TOPO_DAS_ADUELAS = 1.6
/** A largura das tábuas do fundo, em fração do raio dele: três tábuas e meia de lado a lado. */
const TABUA_DO_FUNDO = 0.55
const RAIO_DO_BATOQUE = 1.7
/** Onde fica o batoque no fundo, em fração do raio dele (no alto à direita, como no barril de antes). */
const BATOQUE_X = 0.42
const BATOQUE_Y = 0.3
/**
 * Os tons. O corpo é a frente da 3/4 (de pé, recebe menos luz, como o tampo de frente do barril deitado); o tampo
 * fica de cara para a luz; o fundo é afundado no topo das aduelas; o bojo de cima desce para fora da luz.
 */
const TOM_DO_CORPO = 0.8
const TOM_DO_TOPO = 1.02
const TOM_DO_FUNDO = 0.9
const TOM_DO_BOJO_DE_CIMA = 0.92
const TOM_DO_BATOQUE = 0.66
/**
 * O alto do corpo que fica de fora do quadro (px do protótipo): o tampo cobre essa parte, e a borda de trás do corpo
 * fica por dentro da dele (as duas bordas juntas dobravam o contorno de trás do tampo).
 */
const TOPO_ESCONDIDO = 1.2

// ---------- a forma do barril ----------

/** O barril NA TELA: os meios-eixos da barriga (A de lado a lado, B de trás para a frente), a altura e a queda do bojo. */
interface Geometria {
  readonly A: number
  readonly B: number
  readonly H: number
  /** O raio na altura t é o da barriga vezes raiz de (1 - k u²), com u de -1 (o pé) a 1 (o tampo). */
  readonly k: number
}

function noBojo(g: Geometria, t: number): number {
  return Math.min(1, Math.max(-1, (2 * t) / g.H - 1))
}

/** O raio na altura `t`, em fração do da barriga: o perfil é um arco de elipse, como o da pipa. */
function fator(g: Geometria, t: number): number {
  const u = noBojo(g, t)
  return Math.sqrt(1 - g.k * u * u)
}

/** Quanto o fator muda por px de altura (positivo debaixo da barriga, onde o barril alarga subindo). */
function decliveDoFator(g: Geometria, t: number): number {
  const u = noBojo(g, t)
  return ((-g.k * u) / fator(g, t)) * (2 / g.H)
}

/** A distância (aproximada, a de Inigo Quilez, como em `formas.ts`) do ponto à elipse de meios-eixos rx, ry no centro. */
function distanciaAElipse(px: number, py: number, rx: number, ry: number): number {
  const k0 = Math.sqrt((px * px) / (rx * rx) + (py * py) / (ry * ry))
  const k1 = Math.sqrt((px * px) / (rx * rx * rx * rx) + (py * py) / (ry * ry * ry * ry))
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry)
}

const RAZAO_AUREA = (Math.sqrt(5) - 1) / 2
/** Passos da busca na altura: o intervalo cai a 0,6 milésimo, menos de um centésimo de px. */
const PASSOS_DA_BUSCA = 16

/**
 * As voltas do barril de `t0` a `t1` px de altura, cada uma com o raio dela e posta em (dx t, dy t): a silhueta da
 * 3/4 (cada volta subida a altura dela, dx = 0 e dy = -1) e a sombra no chão (o passo da sombra do motor). A
 * distância é a da volta mais perto, achada por busca áurea na altura: com a volta redonda, a distância ao centro
 * que anda em reta menos o raio do arco do bojo é convexa em t.
 */
function voltasArrastadas(g: Geometria, dx: number, dy: number, t0: number, t1: number): Forma {
  const b: Caixa = [Math.min(dx * t0, dx * t1) - g.A, Math.min(dy * t0, dy * t1) - g.B, Math.max(dx * t0, dx * t1) + g.A, Math.max(dy * t0, dy * t1) + g.B]
  const naAltura = (x: number, y: number, t: number): number => {
    const f = fator(g, t)
    return distanciaAElipse(x - dx * t, y - dy * t, g.A * f, g.B * f)
  }
  return {
    b,
    d(x, y) {
      let a = t0
      let c = t1
      let m1 = c - RAZAO_AUREA * (c - a)
      let m2 = a + RAZAO_AUREA * (c - a)
      let d1 = naAltura(x, y, m1)
      let d2 = naAltura(x, y, m2)
      for (let i = 0; i < PASSOS_DA_BUSCA; i += 1) {
        if (d1 <= d2) {
          c = m2
          m2 = m1
          d2 = d1
          m1 = c - RAZAO_AUREA * (c - a)
          d1 = naAltura(x, y, m1)
        } else {
          a = m1
          m1 = m2
          d1 = d2
          m2 = a + RAZAO_AUREA * (c - a)
          d2 = naAltura(x, y, m2)
        }
      }
      return Math.min(d1, d2, naAltura(x, y, t0), naAltura(x, y, t1))
    },
  }
}

// ---------- o corpo na 3/4 ----------

/** Voltas da conta que acha o ponto do corpo de cada pixel (a altura depende do raio, e o raio, da altura). */
const VOLTAS_DA_CONTA = 4

/**
 * O corpo na 3/4, com o pé no chão em (0, 0) da tela: o ponto da volta da altura t no ângulo θ (0 de frente)
 * aparece em x = A f sen θ e y = B f cos θ - t. Cada aro vira um arco por baixo do tampo; as aduelas estreitam para
 * os lados. A tinta é a do bojo da pipa (`pintarBojo`), com o eixo de pé na tela.
 */
function texDoCorpo(pipa: Pipa, g: Geometria): Textura {
  const { A, B, H } = g
  return (_u, _v, x, y, p, s) => {
    let f = 1
    let seno = 0
    let t = H / 2
    for (let i = 0; i < VOLTAS_DA_CONTA; i += 1) {
      seno = Math.min(1, Math.max(-1, x / (A * f)))
      t = Math.min(H, Math.max(0, B * f * Math.sqrt(1 - seno * seno) - y))
      f = fator(g, t)
    }
    seno = Math.min(1, Math.max(-1, x / (A * f)))
    const cosseno = Math.sqrt(1 - seno * seno)
    // A normal na tela: x para o lado, y pela inclinação da aduela (para cima acima da barriga), z para quem olha.
    const raio = Math.hypot(A * seno, B * cosseno)
    pintarBojo(pipa, voltaDo(pipa, seno), t, seno, raio * decliveDoFator(g, t), cosseno, LUZ_DE_PE, p, s)
  }
}

/** Os quatro aros, como os da pipa (`em` = o meio, em fração da altura a partir do pé). */
function arosDoBarril(H: number): Aro[] {
  const ponta = ARO_DA_PONTA / 2 / H
  return [
    { em: ponta, largura: ARO_DA_PONTA },
    { em: LUGAR_DO_ARO_DO_QUARTO, largura: ARO_DO_QUARTO },
    { em: 1 - LUGAR_DO_ARO_DO_QUARTO, largura: ARO_DO_QUARTO },
    { em: 1 - ponta, largura: ARO_DA_PONTA },
  ]
}

/** O material com o tom já aplicado: o ferro dos aros pintados no corpo fica na mesma luz da madeira em volta. */
function noTom(m: MaterialDaPeca, tom: number): MaterialDaPeca {
  return { ...m, rgb: [m.rgb[0] * tom, m.rgb[1] * tom, m.rgb[2] * tom] }
}

// ---------- as fatias guardadas ----------

/** As linhas do quadro andam de tanto em tanto (px do protótipo), e a meia largura de cada uma é tirada a cada meio px de altura. */
const PASSO_DAS_LINHAS = 0.25
const PASSO_DA_ALTURA = 0.5
/**
 * A margem que a fatia guardada deixa até a borda do bojo de cima (px do protótipo): o serrilhado dela fica todo
 * debaixo da madeira dele. A barriga, tão larga quanto o bojo, não tem margem: fica no meio, no máximo isto para fora.
 */
const MARGEM_DA_GUARDA = 0.8
const TOLERANCIA_DA_GUARDA = 0.03
/** A fatia mais baixa não desce: sobe este nada (a altura do quadro já no lugar, `pinoNoLugar` da pipa). */
const DESCIDA_MINIMA = 0.02

interface Fatia {
  /** As linhas da tela que a fatia mostra (sem fim nas pontas do quadro). */
  readonly faixa: readonly [number, number]
  /** Quanto ela desce para ficar guardada: a altura do pino. */
  readonly z: number
  /** O meio da fatia guardada, em y da vista de cima. */
  readonly guardada: number
}

/** A meia largura do quadro na linha `Y` da tela: a da volta mais larga que passa por ela. */
function meiaLargura(g: Geometria, Y: number, ate: number): number {
  let w = 0
  for (let t = 0; ; t = Math.min(ate, t + PASSO_DA_ALTURA)) {
    const f = fator(g, t)
    const q = (Y + t) / (g.B * f)
    if (q * q < 1) w = Math.max(w, g.A * f * Math.sqrt(1 - q * q))
    if (t >= ate) return w
  }
}

/**
 * As fatias do quadro, de cima para baixo. Cada linha só pode ficar guardada até uma certa distância do meio do
 * bojo de cima (onde a corda dele ainda a cobre, com a margem); a fatia cresce enquanto houver uma descida que sirva a
 * todas as linhas dela e fica com a que a deixa mais perto do meio.
 */
function fatiar(g: Geometria, ate: number, yTopo: number, yBase: number): Fatia[] {
  const folga = (Y: number): number => {
    const precisa = Math.min(meiaLargura(g, Y, ate) + MARGEM_DA_GUARDA, g.A - TOLERANCIA_DA_GUARDA) / g.A
    return precisa >= 1 ? 0 : g.B * Math.sqrt(1 - precisa * precisa)
  }
  const fatias: Fatia[] = []
  const linhas = Math.ceil((yBase - yTopo) / PASSO_DAS_LINHAS)
  let primeira = 0
  let lo = -Infinity
  let hi = Infinity
  const fechar = (ultima: number, fim: boolean): void => {
    const de = yTopo + primeira * PASSO_DAS_LINHAS
    const ate1 = yTopo + ultima * PASSO_DAS_LINHAS
    const meio = (de + ate1) / 2
    const z = lo <= hi ? Math.min(hi, Math.max(lo, -meio)) : Math.max(DESCIDA_MINIMA, -meio)
    fatias.push({ faixa: [primeira === 0 ? -Infinity : de - PASSO_DAS_LINHAS / 2, fim ? Infinity : ate1 + PASSO_DAS_LINHAS / 2], z, guardada: meio + z })
  }
  for (let i = 0; i <= linhas; i += 1) {
    const Y = yTopo + i * PASSO_DAS_LINHAS
    const s = folga(Y)
    const lo1 = Math.max(lo, -Y - s, DESCIDA_MINIMA)
    const hi1 = Math.min(hi, -Y + s)
    if (lo1 <= hi1 || i === primeira) {
      lo = lo1
      hi = hi1
      continue
    }
    fechar(i - 1, false)
    primeira = i
    lo = Math.max(-Y - s, DESCIDA_MINIMA)
    hi = -Y + s
  }
  fechar(linhas, true)
  return fatias
}

// ---------- os pinos ----------

/** Dois pinos ficam a esta distância, no mínimo (px do protótipo): a peça de um não cai no outro. */
const ESPACO_DOS_PINOS = 0.4
/** Os x em que o pino de uma fatia pode ficar, do meio para fora (px do protótipo). */
const COLUNAS_DOS_PINOS = [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2, 2.5, -2.5]
/**
 * A linha da fila de cada pino fica a esta distância do ponto dele, no mínimo (px do protótipo): a beirada que a 3/4
 * dá ao pino só pinta na caixa da fila, e o ponto do pino, perto dela, sairia como um pingo de madeira.
 */
const DISTANCIA_DA_FILA = 3
/** O ponto do pino do bojo de cima: um nada abaixo do pino do tampo, no meio. */
const PINO_DO_BOJO = 0.6

function pinoDaFatia(fatia: Fatia, k: number, g: Geometria, yTopo: number, yBase: number, usados: Pino[]): Pino {
  let y = fatia.guardada
  let x = 0
  for (let tentativa = 0; ; tentativa += 1) {
    const livre = COLUNAS_DOS_PINOS.find((cx) => usados.every((u) => Math.hypot(u.x - cx, u.y - y) >= ESPACO_DOS_PINOS))
    if (livre !== undefined) {
      x = livre
      break
    }
    y += ESPACO_DOS_PINOS * (tentativa % 2 === 0 ? 1 : -1) * (tentativa + 1)
  }
  // Na fila, entre o bojo de cima (o primeiro) e o tampo (o último); subida, a caixa da fila fica dentro do quadro.
  let ordem = Math.min(yBase + fatia.z - 0.5, Math.max(yTopo + fatia.z + 0.5, -g.B + 1.5 + 0.01 * k))
  if (Math.abs(ordem - y) < DISTANCIA_DA_FILA) ordem = y + DISTANCIA_DA_FILA
  const pino: Pino = { x, y, z: fatia.z, ordem }
  usados.push(pino)
  return pino
}

/** O pino `p` da tela no referencial do objeto: onde a peça montada de cima precisa ter o meio da caixa. */
function noObjeto(p: Pino, quartos: number): Pino {
  const [x, y] = quartos === 1 ? [p.y, -p.x] : quartos === 2 ? [-p.x, -p.y] : quartos === 3 ? [-p.y, p.x] : [p.x, p.y]
  return { ...p, x, y }
}

// ---------- a vista de cima ----------

/** O bojo visto de cima (as aduelas descendo para fora até a barriga) e o aro do quarto. */
function bojoDeCima(c: ContextoDoMovel, g: Geometria, pino: Pino): Peca[] {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  const fq = fator(g, g.H * (1 - LUGAR_DO_ARO_DO_QUARTO))
  const meio = ARO_DO_QUARTO_DE_CIMA / 2
  return [
    P(noPino(elipse(0, 0, hw, hh), pino), c.m.madeira, { polar: { cx: 0, cy: 0, r: R }, tabua: (Math.PI * R) / ADUELAS, bisel: (1 - PONTA) * R + 1.2, contorno: 0.26, tom: TOM_DO_BOJO_DE_CIMA, semente: 3 }),
    P(noPino(anel(0, 0, hw * fq + meio, hh * fq + meio, hw * fq - meio, hh * fq - meio), pino), c.m.aros, { bisel: 0.6, contorno: 0.3, semente: 4 }),
  ]
}

/** O tampo: o aro de ferro rente à borda, o topo das aduelas, as tábuas do fundo afundadas e o batoque. */
function tampo(c: ContextoDoMovel, pino: Pino): Peca[] {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  const ax = hw * PONTA
  const ay = hh * PONTA
  const fundo = ARO_DO_TAMPO + TOPO_DAS_ADUELAS
  const rf = Math.min(ax, ay) - fundo
  return [
    P(noPino(elipse(0, 0, ax, ay), pino), c.m.aros, { bisel: 0.9, contorno: 0.3, semente: 5 }),
    // O topo das aduelas continua as aduelas do bojo de cima (o mesmo veio em volta, a mesma semente).
    P(noPino(elipse(0, 0, ax - ARO_DO_TAMPO, ay - ARO_DO_TAMPO), pino), c.m.madeira, { polar: { cx: 0, cy: 0, r: R }, tabua: (Math.PI * R) / ADUELAS, bisel: 0.6, tom: TOM_DO_TOPO, contorno: 0.2, semente: 3 }),
    P(noPino(elipse(0, 0, ax - fundo, ay - fundo), pino), c.m.madeira, { tabua: rf * TABUA_DO_FUNDO, bisel: 0.5, recesso: { k: 1.6, forca: 0.3 }, tom: TOM_DO_FUNDO, contorno: 0.24, semente: 7 }),
    P(noPino(elipse((ax - fundo) * BATOQUE_X, (ay - fundo) * BATOQUE_Y, RAIO_DO_BATOQUE, RAIO_DO_BATOQUE), pino), c.m.madeira, { tabua: 0, bisel: 1.3, tom: TOM_DO_BATOQUE, contorno: 0.3, semente: 8 }),
  ]
}

// ---------- a sombra ----------

/** A sombra arrastada sai em lances, cada um mais suave que o de baixo. */
const LANCES_DA_SOMBRA = 4
/** A força do contato do pé: a da sombra de baixo da 3/4 (`tresQuartos.ts`). */
const FORCA_DO_CONTATO = 0.34

/** A sombra no chão, na tela (cai para baixo à direita em qualquer giro): o corpo arrastado do pé ao tampo e o contato. */
function sombrasNaTela(g: Geometria, tela: Cena): void {
  // A força da sombra de uma coluna dessa altura (`motor.ts`).
  const forca = Math.max(0.16, 0.34 - 0.0022 * g.H)
  for (let i = 0; i < LANCES_DA_SOMBRA; i += 1) {
    const t0 = (g.H * i) / LANCES_DA_SOMBRA
    const t1 = (g.H * (i + 1)) / LANCES_DA_SOMBRA
    tela.sombras.push({ forma: voltasArrastadas(g, SOMBRA_X, SOMBRA_Y, t0, t1), z: 0, suave: bordaDaSombra({ z: (t0 + t1) / 2 }), forca })
  }
  tela.sombras.push(contato(elipse(0, 0, g.A * PONTA, g.B * PONTA), FORCA_DO_CONTATO))
}

// ---------- o barril ----------

export const montarBarril: MontarMovel = (c, cena) => {
  const quartos = quartosDoGiro(c.giro)
  const deLado = quartos % 2 === 1
  const g: Geometria = { A: deLado ? c.hh : c.hw, B: deLado ? c.hw : c.hh, H: c.g * ALTURA, k: 1 - PONTA * PONTA }
  const R = Math.min(c.hw, c.hh)
  const pipa: Pipa = {
    comprimento: g.H,
    raio: R,
    raioDaPonta: R * PONTA,
    eixo: 0,
    aduelas: ADUELAS,
    aros: arosDoBarril(g.H),
    madeira: c.m.madeira,
    ferro: noTom(c.m.aros, TOM_DO_CORPO),
    semente: 0,
  }
  // O que é montado na tela: a sombra, o corpo em fatias e os pinos.
  const tela: Cena = { partes: [], sombras: [] }
  sombrasNaTela(g, tela)
  const ate = g.H - TOPO_ESCONDIDO
  const corpo: PecaDoQuadro = {
    forma: voltasArrastadas(g, 0, -1, 0, ate),
    mat: c.m.madeira,
    o: { bisel: 0.9, contorno: 0.26, tom: TOM_DO_CORPO, textura: texDoCorpo(pipa, g), semente: 9 },
  }
  const yTopo = corpo.forma.b[1]
  const yBase = corpo.forma.b[3]
  const pinoDoTampo: Pino = { x: 0, y: 0, z: g.H, ordem: g.B - 1 }
  const pinoDoBojo: Pino = { x: 0, y: PINO_DO_BOJO, z: g.H / 2, ordem: -g.B + 1 }
  const usados: Pino[] = [pinoDoTampo, pinoDoBojo]
  fatiar(g, ate, yTopo, yBase).forEach((fatia, k) => {
    const pino = pinoDaFatia(fatia, k, g, yTopo, yBase, usados)
    pregar(tela, pino)
    pendurar(c.peca, tela.partes, corpo, pino, fatia.faixa)
  })
  pregar(tela, pinoDoBojo)
  pregar(tela, pinoDoTampo)
  if (quartos === 0) {
    cena.partes.push(...tela.partes)
    cena.sombras.push(...tela.sombras)
  } else {
    desgirarCena(tela, quartos, cena)
  }
  // Por cima das fatias guardadas: o bojo de cima (na 3/4, atrás do corpo) e o tampo (na 3/4, no alto).
  cena.partes.push(...bojoDeCima(c, g, noObjeto(pinoDoBojo, quartos)), ...tampo(c, noObjeto(pinoDoTampo, quartos)))
}
