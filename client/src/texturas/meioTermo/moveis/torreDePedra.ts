/**
 * TORRE DE PEDRA de cima com volume (lote 17 dos objetos novos, 12/11/2026,
 * grupo Rua e jardim): a torre redonda de muralha e de castelo. A PAREDE de
 * fiadas de pedra com as juntas desencontradas, a PORTA de tábuas no pé (a
 * frente da torre é o lado da porta), três SETEIRAS, e no alto o PARAPEITO
 * com AMEIAS em volta do TERRAÇO de lajes, com o ALÇAPÃO de madeira e o
 * MASTRO com a BANDEIRA rasgada. No pé, o rodapé de pedra com musgo.
 *
 * De cima: o anel do parapeito com as ameias claras e as seteiras de tiro
 * mais baixas entre elas, o terraço de lajes com o alçapão, o mastro com a
 * bandeira, o rodapé com a soleira da porta e a SOMBRA comprida para baixo à
 * direita, com os dentes das ameias na ponta. São as ameias e a sombra que
 * dizem "torre" e não poço, chafariz ou mesa redonda.
 *
 * NA 3/4 (`tresQuartos.ts`; todo tampo tem a beirada
 * `ESPESSURA_DA_FIADA_DA_TORRE`, a espessura do perfil e a altura de uma fiada):
 * - a parede são FIADAS do chão ao terraço; cada BLOCO é um tampo de casca
 *   fina (só a cara de fora aparece), com uma junta entre um e outro,
 *   desencontrada de uma fiada para a outra; só os blocos da frente NA TELA
 *   entram (os de trás somem atrás da torre e custavam o dobro do tempo);
 * - a PORTA é uma coluna que sai um tico da parede (e a peça de madeira dela
 *   fica nesse tico, fora das fiadas); cada SETEIRA são dois tampos escuros
 *   que saem da parede, o de baixo um tico mais (para a peça de cada um ser só
 *   dele). As duas saem depois das fiadas;
 * - o TERRAÇO sai depois da parede inteira, e tudo o que fica em cima dele
 *   (o anel de baixo do parapeito, as ameias, o mastro) depois dele, na ordem
 *   da base NA TELA: as ameias do fundo, o mastro, as da frente;
 * - o MASTRO são discos empilhados, cada um um décimo de px para o lado, com
 *   um pingo de madeira só dele (a cara sai madeira, não pedra).
 * Por isso o desenho lê `c.giro`. As alturas são em lados (o menor lado).
 * Materiais: `pedra` e `madeira`. O ferro, a bandeira e o musgo são fixos.
 *
 * PEGADA SÓLIDA (para a colisão): o círculo da parede, raio
 * `RAIO_SOLIDO_DA_TORRE` do menor meio lado (0,80, a face de fora das fiadas).
 */
import { hash, misturar, rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, caixa, capsula, elipse, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Sombra, type Textura } from './motor'
import { BURACO, G, materialDaPeca, type MontarMovel } from './contexto'

/** A altura de uma fiada (px do protótipo): a beirada de todo tampo da torre. O perfil usa este valor como espessura. */
export const ESPESSURA_DA_FIADA_DA_TORRE = 0.18 * G
/** O raio da parede em fração do menor meio lado: a pegada sólida da torre. */
export const RAIO_SOLIDO_DA_TORRE = 0.8

/** Raios em fração do menor meio lado: a face de fora, a de dentro (o terraço), o rodapé. */
const DE_FORA = RAIO_SOLIDO_DA_TORRE
const DE_DENTRO = 0.62
const RODAPE = 0.9
const BLOCOS_POR_FIADA = 16
/** A casca de cada bloco da parede (px): só a cara de fora é vista. */
const CASCA_DA_PAREDE = 5
/** A meia junta entre dois blocos (px). */
const MEIA_JUNTA = 0.45
const AMEIAS = 12
/** A ameia ocupa esta fração do passo; o resto é a seteira de tiro (a abertura entre duas). */
const CHEIO_DA_AMEIA = 0.6
/** A porta: o meio (90 = a frente), a meia abertura (rad), quanto sai da parede (px) e a altura (lados). */
const PORTA_EM = Math.PI / 2
const MEIA_PORTA = 0.2
const PORTA_SAI = 2
const ALTURA_DA_PORTA = 0.36
/** As seteiras: o ângulo de cada uma, a meia abertura e a altura do pé (lados). */
const SETEIRAS: readonly number[] = [(55 * Math.PI) / 180, (125 * Math.PI) / 180, (3 * Math.PI) / 2]
const MEIA_SETEIRA = 0.035
const PE_DA_SETEIRA = 0.24
/** Alturas em lados (3 casas na pegada de partida): o terraço (2,3 casas). */
const ALTURA_DO_TERRACO = 0.767
/** O mastro: onde fica (fração do meio lado), o raio, a altura acima do terraço (lados) e a bandeira. */
const MASTRO: readonly [number, number] = [0.2, -0.26]
const RAIO_DO_MASTRO = 0.028
const ALTURA_DO_MASTRO = 0.37
const BANDEIRA: readonly Ponto[] = [[0, -0.02], [0.3, 0.02], [0.24, 0.07], [0.31, 0.12], [0.2, 0.11], [0.14, 0.16], [0, 0.12]]
/** O alçapão no terraço: o meio, as meias medidas e as duas cintas. */
const ALCAPAO: readonly [number, number, number, number] = [-0.22, 0.14, 0.15, 0.12]
/** As lajes do terraço (px de lado) e o musgo no rodapé (ângulo, raio em fração). */
const LAJE: readonly [number, number] = [0.42 * G, 0.3 * G]
const MUSGO_NO_RODAPE: readonly (readonly [number, number])[] = [[3.7, 0.07], [4.1, 0.05], [4.6, 0.06], [2.6, 0.045], [5.4, 0.04], [1.25, 0.04]]

const ESCURO_DA_PEDRA: [number, number, number] = [0x45, 0x43, 0x40]
const FERRO = materialDaPeca('ferro')
const BANDEIRA_VINHO = materialDaPeca('vinho')
const DA_PEDRA = texturaDaClasse('pedra')

function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

function naTela(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [-y, x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [y, -x] : [x, y]
}

function doDesenho(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

function baseNaTela(b: Caixa, quartos: number): number {
  return Math.max(naTela(b[0], b[1], quartos)[1], naTela(b[2], b[3], quartos)[1], naTela(b[0], b[3], quartos)[1], naTela(b[2], b[1], quartos)[1])
}

function esticadaParaAFrente(forma: Forma, ate: number, quartos: number): Forma {
  const [dx, dy] = doDesenho(0, 1, quartos)
  const [x0, y0, x1, y1] = forma.b
  const b: Caixa =
    dx > 0.5 ? [x0, y0, Math.max(x1, ate), y1] : dx < -0.5 ? [Math.min(x0, -ate), y0, x1, y1] : dy > 0.5 ? [x0, y0, x1, Math.max(y1, ate)] : [x0, Math.min(y0, -ate), x1, y1]
  return { b, d: forma.d }
}

function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

function deslocada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/** O ângulo de (x, y) até `meio`, entre -π e π. */
function desvio(x: number, y: number, meio: number): number {
  const a = Math.atan2(y, x) - meio
  return a - 2 * Math.PI * Math.round(a / (2 * Math.PI))
}

/** Um SETOR de anel: entre os raios r0 e r1, `meia` radianos para cada lado de `meio`. */
function setor(r0: number, r1: number, meio: number, meia: number): Forma {
  const xs: number[] = []
  const ys: number[] = []
  for (let i = 0; i <= 8; i += 1) {
    const a = meio - meia + (meia * i) / 4
    for (const r of [r0, r1]) {
      xs.push(Math.cos(a) * r)
      ys.push(Math.sin(a) * r)
    }
  }
  return {
    b: [Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1],
    d(x, y) {
      const r = Math.hypot(x, y)
      const fora = Math.abs(desvio(x, y, meio)) - meia
      return Math.max(r - r1, r0 - r, r * Math.sin(Math.max(-Math.PI / 2, Math.min(Math.PI / 2, fora))))
    },
  }
}

/**
 * Uma FIADA da parede: a casca de fora do anel (`CASCA_DA_PAREDE` px até `r1`) em blocos, com a junta começando
 * em `giro` (rad), só na metade da frente NA TELA (e um pouco dos lados): a de trás some atrás da torre.
 */
function fiadaDaFrente(r1: number, giro: number, quartos: number): Forma {
  const passo = (2 * Math.PI) / BLOCOS_POR_FIADA
  const r0 = r1 - CASCA_DA_PAREDE
  const corte = -0.25 * r1
  const [p, q] = [doDesenho(-r1, corte, quartos), doDesenho(r1, r1, quartos)]
  return {
    b: [Math.min(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[0], q[0]), Math.max(p[1], q[1])],
    d(x, y) {
      const r = Math.hypot(x, y)
      const t = (Math.atan2(y, x) - giro) / passo
      return Math.max(r - r1, r0 - r, MEIA_JUNTA - r * Math.abs(t - Math.round(t)) * passo, corte - naTela(x, y, quartos)[1])
    },
  }
}

/**
 * As AMEIAS de r0 a r1 numa forma só (o custo da 3/4 vai com o número de estruturas): um setor de meia abertura
 * `meia` em cada passo, a primeira meio passo depois da porta. `lado` corta NA TELA: -1 só as do fundo, 1 só as
 * da frente, 0 todas.
 */
function coroaDeAmeias(r0: number, r1: number, meia: number, quartos: number, lado: -1 | 0 | 1): Forma {
  const passo = (2 * Math.PI) / AMEIAS
  const giro = PORTA_EM + passo / 2
  return {
    b: [-r1 - 1, -r1 - 1, r1 + 1, r1 + 1],
    d(x, y) {
      const r = Math.hypot(x, y)
      const t = (Math.atan2(y, x) - giro) / passo
      const fora = (Math.abs(t - Math.round(t)) * passo - meia) * r
      const corte = lado === 0 ? -Infinity : -lado * naTela(x, y, quartos)[1]
      return Math.max(r - r1, r0 - r, fora, corte)
    },
  }
}

/** Uma CUNHA de anel entre os raios r0 e r1 e os ângulos a0 < a1 (menos de meia volta): sem arco-tangente. */
function cunha(r0: number, r1: number, a0: number, a1: number): Forma {
  const [c0, s0, c1, s1] = [Math.cos(a0), Math.sin(a0), Math.cos(a1), Math.sin(a1)]
  const xs = [c0 * r0, c0 * r1, c1 * r0, c1 * r1, Math.cos((a0 + a1) / 2) * r1]
  const ys = [s0 * r0, s0 * r1, s1 * r0, s1 * r1, Math.sin((a0 + a1) / 2) * r1]
  return {
    b: [Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1],
    d(x, y) {
      const r = Math.hypot(x, y)
      return Math.max(r - r1, r0 - r, s0 * x - c0 * y, c1 * y - s1 * x)
    },
  }
}

/** O anel do parapeito: de r0 a r1 em `blocos` blocos, com a junta fina entre eles começando em `giro` (rad). */
function anelDeBlocos(r0: number, r1: number, blocos: number, giro: number): Forma {
  const passo = (2 * Math.PI) / blocos
  return {
    b: [-r1, -r1, r1, r1],
    d(x, y) {
      const r = Math.hypot(x, y)
      const t = (Math.atan2(y, x) - giro) / passo
      // A junta é curta (meio passo no máximo): o arco vale pela distância.
      return Math.max(r - r1, r0 - r, MEIA_JUNTA - r * Math.abs(t - Math.round(t)) * passo)
    },
  }
}

/** As lajes do terraço: a pedra, as juntas escuras e cada laje com o seu tom, em fileiras desencontradas. */
const texLajes: Textura = (u, v, x, y, p, s, escala) => {
  if (DA_PEDRA !== null) DA_PEDRA(u, v, x, y, p, s, escala)
  const fileira = Math.floor(y / LAJE[1])
  const xx = x / LAJE[0] + (((fileira % 2) + 2) % 2) * 0.5
  const coluna = Math.floor(xx)
  const [fx, fy] = [xx - coluna, y / LAJE[1] - fileira]
  const junta = Math.min(fx * LAJE[0], (1 - fx) * LAJE[0], fy * LAJE[1], (1 - fy) * LAJE[1])
  s[3] += (hash(coluna, fileira, 1771) - 0.5) * 0.14
  if (junta < 1) s[3] -= 0.3 * (1 - junta)
}

export const montarTorreDePedra: MontarMovel = (c, cena) => {
  const P = c.peca
  const R = Math.min(c.hw, c.hh)
  const lado = 2 * R
  const e = ESPESSURA_DA_FIADA_DA_TORRE
  const pedra = c.m.pedra
  const madeira = c.m.madeira
  const quartos = quartosDoGiro(c.giro)
  const L = cena.partes
  const S = cena.sombras
  cena.corDoPiso = ESCURO_DA_PEDRA
  const f = (v: number): number => v * R
  const [rFora, rDentro] = [f(DE_FORA), f(DE_DENTRO)]
  const zTerraco = ALTURA_DO_TERRACO * lado
  const passoDaAmeia = (2 * Math.PI) / AMEIAS
  const meiaAmeia = (passoDaAmeia * CHEIO_DA_AMEIA) / 2
  // Uma seteira de tiro bem na frente da porta: as ameias ficam meio passo para cada lado dela.
  const ameias = Array.from({ length: AMEIAS }, (_, i) => PORTA_EM + (i + 0.5) * passoDaAmeia)
  const solta = (forma: Forma, z: number): Sombra => ({ forma, z, solta: true, forca: 0 })
  /** Em cima do terraço: sai depois dele, na ordem da base NA TELA. */
  const emCima = (forma: Forma, mais = 0): Forma => esticadaParaAFrente(forma, R * (0.91 + 0.01 * (baseNaTela(forma.b, quartos) / R + 1) + mais), quartos)
  const daPedra = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ bisel: 1.4, contorno: 0.28, semente, ...mais })

  // ---------- as sombras no chão: o contato, o corpo comprido e os dentes das ameias na ponta ----------
  const zAmeia = zTerraco + 3 * e
  const [cx, cy] = doDesenho(0.27 * (zTerraco + e), 0.21 * (zTerraco + e), quartos)
  S.push(contato(elipse(0, 0, rFora * 1.03, rFora * 1.03), 0.36), { forma: capsula(0, 0, cx, cy, rFora + 1), z: 0, suave: 3, forca: 0.34 })
  const [ax, ay] = doDesenho(0.27 * zAmeia, 0.21 * zAmeia, quartos)
  S.push({ forma: deslocada(coroaDeAmeias(rDentro, rFora + 1, meiaAmeia, quartos, 0), ax, ay), z: 0, suave: 2.6, forca: 0.32 })

  // ---------- no chão: o rodapé em oito pedaços (o meio de cada um fora da parede), a soleira e o musgo ----------
  const rodape = f(RODAPE)
  for (let i = 0; i < 8; i += 1) {
    const meio = (i * Math.PI) / 4
    const pedaco = cunha(rFora - 2, rodape, meio - Math.PI / 8 - 0.002, meio + Math.PI / 8 + 0.002)
    L.push(P(comMeioEm(pedaco, Math.cos(meio) * f(0.85), Math.sin(meio) * f(0.85)), pedra, daPedra(17900 + i, { tom: 0.86 })))
  }
  const soleira = caixa(-f(0.15), rFora + 1, f(0.15), f(0.88), 1.2)
  L.push(P(soleira, pedra, daPedra(17910, { tom: 1.02 })))
  const musgo: MaterialDaPeca = { classe: 'folha', rgb: misturar(rgb(tomDoMeio('musgo', 0.84)), pedra.rgb, 0.16) }
  MUSGO_NO_RODAPE.forEach(([a, r], i) => {
    const [mx, my] = [Math.cos(a) * f(0.86), Math.sin(a) * f(0.86)]
    const bolinhas = 5 + Math.round(hash(i, 3, 1790) * 3)
    for (let k = 0; k < bolinhas; k += 1) {
      const t = hash(i, k, 1791) * 2 * Math.PI
      const longe = hash(i, k, 1792) * f(r)
      const raio = 1.05 * (0.7 + 0.7 * hash(i, k, 1793))
      L.push(P(comMeioEm(elipse(mx + Math.cos(t) * longe, my + Math.sin(t) * longe * 0.7, raio, raio * 0.86), mx, my), musgo, { bisel: raio * 0.7, contorno: 0.26, tom: 0.82 + 0.3 * hash(i, k, 1794), semente: 17920 + i * 16 + k }))
    }
  })

  // ---------- a parede: as fiadas, do chão ao terraço, com as juntas desencontradas ----------
  // Cada fiada é a casca de fora do anel (o alto, a fiada de cima cobre), só na metade da frente NA TELA: o anel
  // inteiro levava 2,7 s na 3/4, e um tampo por bloco, 4 s (o custo vai com o número de estruturas).
  const fiadas = Math.ceil(zTerraco / e - 0.01)
  for (let k = 0; k < fiadas; k += 1) {
    const z = Math.min(zTerraco, e * (k + 1))
    S.push(solta(fiadaDaFrente(rFora, (k % 2) * (Math.PI / BLOCOS_POR_FIADA) + k * 0.07, quartos), z))
  }

  // ---------- a porta (sai um tico da parede) e as seteiras (dois tampos escuros cada) ----------
  const naFrenteDaParede = (forma: Forma): Forma => esticadaParaAFrente(forma, f(0.85), quartos)
  S.push({ forma: naFrenteDaParede(setor(rFora - 4, rFora + PORTA_SAI, PORTA_EM, MEIA_PORTA)), z: ALTURA_DA_PORTA * lado, forca: 0 })
  L.push(P(comMeioEm(setor(rFora + 0.4, rFora + PORTA_SAI, PORTA_EM, MEIA_PORTA), 0, rFora + 1.2), madeira, { tabua: 0, bisel: 0.5, contorno: 0.3, tom: 0.9, semente: 17930 }))
  SETEIRAS.forEach((meio, i) => {
    const zPe = PE_DA_SETEIRA * lado + (i === 2 ? e : 0)
    ;[1.3, 0.7].forEach((sai, j) => {
      const fresta = setor(rFora - 3, rFora + sai, meio, MEIA_SETEIRA)
      S.push(solta(naFrenteDaParede(fresta), zPe + e * (j + 1)))
      const [px, py] = [Math.cos(meio) * (rFora + sai - 0.3), Math.sin(meio) * (rFora + sai - 0.3)]
      L.push(P(comMeioEm(setor(rFora + sai - 0.6, rFora + sai, meio, MEIA_SETEIRA), px, py), BURACO, { tabua: 0, bisel: 0, contorno: 0.2, tom: 0.5, semente: 17940 + i * 2 + j }))
    })
  })

  // ---------- o terraço de lajes, com o alçapão ----------
  S.push(solta(esticadaParaAFrente(elipse(0, 0, rDentro, rDentro), f(0.9), quartos), zTerraco))
  L.push(P(elipse(0, 0, rDentro + 1, rDentro + 1), pedra, { bisel: 0, contorno: 0.2, tom: 0.92, recesso: { k: 4, forca: 0.42 }, textura: texLajes, semente: 17950 }))
  const [jx, jy, jw, jh] = [f(ALCAPAO[0]), f(ALCAPAO[1]), f(ALCAPAO[2]), f(ALCAPAO[3])]
  L.push(P(caixa(jx - jw, jy - jh, jx + jw, jy + jh, 1), madeira, { tabua: 5, bisel: 1, contorno: 0.32, tom: 0.92, semente: 17951 }))
  for (const fy of [-0.55, 0.55]) L.push(P(caixa(jx - jw - 0.6, jy + fy * jh - 1.3, jx + jw + 0.6, jy + fy * jh + 1.3, 0.4), FERRO, { tabua: 0, bisel: 0.6, contorno: 0.3, tom: 0.9, metal: 0.3, semente: fy > 0 ? 17953 : 17952 }))
  L.push(P(anel(jx + jw * 0.55, jy, 2.4, 2.4, 1.3, 1.3), FERRO, { tabua: 0, bisel: 0.6, contorno: 0.3, metal: 0.35, projeta: { dist: 0.8, forca: 0.3 }, semente: 17954 }))

  // ---------- o parapeito: o anel de baixo (com o peitoril das seteiras de tiro) e as ameias ----------
  // As juntas do anel ficam entre o meio de cada ameia e o de cada vão (no meio, a peça não subiria com ele).
  S.push(solta(esticadaParaAFrente(anelDeBlocos(rDentro, rFora + 1, AMEIAS * 2, PORTA_EM + Math.PI / 24), R * 0.905, quartos), zTerraco + e))
  const meioVao = (passoDaAmeia * (1 - CHEIO_DA_AMEIA)) / 2
  for (const meio of ameias) {
    const vao = meio + passoDaAmeia / 2
    L.push(P(comMeioEm(setor(rDentro, rFora + 1, vao, meioVao), Math.cos(vao) * f(0.71), Math.sin(vao) * f(0.71)), pedra, daPedra(17960, { tom: 0.9 })))
  }

  // ---------- o mastro (antes das ameias da frente) com a bandeira ----------
  const [mx, my] = [f(MASTRO[0]), f(MASTRO[1])]
  const rMastro = f(RAIO_DO_MASTRO)
  const niveis = Math.ceil((ALTURA_DO_MASTRO * lado) / e - 0.01)
  for (let k = 0; k < niveis; k += 1) {
    const ox = mx + 0.1 * k
    S.push(solta(emCima(elipse(ox, my, rMastro, rMastro), 0.0001 * k), zTerraco + Math.min(ALTURA_DO_MASTRO * lado, e * (k + 1))))
    // O pingo de madeira, dentro deste disco e fora dos de cima: a cara deste trecho sai madeira.
    L.push(P(elipse(ox - rMastro + 0.05, my, 0.25, 0.25), madeira, { bisel: 0, contorno: 0, semente: 17970 + k }))
  }
  const topo: Ponto = [mx + 0.1 * (niveis - 1), my]
  const bandeira = poligono(BANDEIRA.map(([x, y]): Ponto => [topo[0] + f(x), topo[1] + f(y)]))
  L.push(P(comMeioEm(bandeira, topo[0], topo[1]), BANDEIRA_VINHO, { tabua: 0, bisel: 1, contorno: 0.32, tom: 0.95, projeta: { dist: 1.6, forca: 0.32 }, semente: 17980 }))
  L.push(P(elipse(topo[0], topo[1], rMastro * 1.5, rMastro * 1.5), madeira, { tabua: 0, bisel: rMastro, contorno: 0.32, tom: 0.85, projeta: { dist: 1.2, forca: 0.3 }, semente: 17981 }))

  // ---------- as ameias: dois tampos cada, o de cima com a pedra do alto ----------
  // As do fundo NA TELA saem antes do mastro, as da frente depois; cada metade em dois tampos (a altura da ameia).
  for (const [lado, chave] of [[-1, 0.915], [1, 0.96]] as const) {
    const metade = esticadaParaAFrente(coroaDeAmeias(rDentro, rFora + 1, meiaAmeia, quartos, lado), R * chave, quartos)
    S.push(solta(metade, zTerraco + 2 * e), solta(metade, zAmeia))
  }
  ameias.forEach((meio, i) => {
    L.push(P(setor(rDentro, rFora + 1, meio, meiaAmeia), pedra, daPedra(17990 + i, { bisel: 2, tom: 1.08 + 0.06 * hash(i, 1, 1799) })))
  })
}
