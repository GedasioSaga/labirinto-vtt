/**
 * GUINDASTE DE PORTO de cima com volume (lote L17 de 14/11/2026, construção do grupo Cidade e porto): o guindaste
 * de cais movido a gente, com a RODA DE PISAR de madeira. No CAIS de pedra: a roda grande de pé (dois aros com os
 * raios em X e os degraus de pisar entre eles) no EIXO, apoiada em dois CAVALETES; o MASTRO com as escoras; a
 * LANÇA que sai do mastro para o lado da água, com o estai; o CABO que vai do tambor da roda ao alto do mastro; e,
 * na ponta da lança, o cabo de içar com o CAIXOTE pendurado pela linga. A frente do guindaste é o lado comprido.
 *
 * De cima: os dois aros da roda como duas vigas com os degraus entre elas (uma escada deitada), o eixo e os
 * cavaletes, o mastro, a lança comprida até o caixote sobre o chão (o cais acaba antes, na beira da água), e as
 * SOMBRAS: a da roda cai na pedra do cais como duas elipses com os raios (uma peça escura e transparente, porque a
 * sombra do chão não aparece debaixo da pedra), e é ela que diz "roda" de cima; a roda de pé vista do alto é só uma viga.
 *
 * NA 3/4 (`tresQuartos.ts`; todo tampo tem a beirada `ESPESSURA_DO_GUINDASTE`, a espessura do perfil): cada viga
 * redonda (aro, raio, perna, mastro, lança, cabo) são DISCOS no ar ao longo dela, cada um com a peça de cima dele
 * (o pedaço da viga visto do alto) e a sombra própria; os degraus, o eixo e as travessas são tampos inteiros. O meio
 * de cada peça é um ponto da estrutura dela que nenhuma estrutura mais alta contém (`pontoSoDela`); as peças saem
 * de baixo para cima na vista de cima. A caixa de cada estrutura vai empurrada para a frente NA TELA, para todas
 * sairem depois do cais; é só para isso que o desenho lê `c.giro` (de lado, a roda fica de perfil, como seria vista). Medidas de cima pela pegada, alturas e a roda em casas.
 * Materiais: `madeira` (roda, cavaletes, mastro, lança, caixote) e `pedra` (o cais). A corda e o ferro são fixos.
 */
import { hash } from '../../ruido'
import { caixa, capsula, dentroDe, type Forma, type Ponto } from './formas'
import { SOMBRA_X, SOMBRA_Y, contato, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Sombra, type Textura } from './motor'
import { G, QUARTO, materialDaPeca, type MontarMovel } from './contexto'
import { coluna, comMeioEm, deslocada, disco, doDesenho, pingo, pontoSoDela, quartosDoGiro } from './apoioDaCidadeEPorto'

/** A beirada de cada tampo (px do protótipo): a grossura de cada disco das vigas. O perfil usa este valor. */
export const ESPESSURA_DO_GUINDASTE = 0.09 * G

/** O cais: a meia pegada que ele ocupa e a altura, em casas. */
const CAIS: readonly [number, number] = [0.97, 0.9]
const ALTURA_DO_CAIS = 0.1
/** A beira do cais do lado da água (fração da meia largura): dali para fora a lança e o caixote ficam sobre o chão. */
const BEIRA_DO_CAIS = 0.6
/** A roda: o meio (fração da meia largura), os aros (fração da meia altura), o raio e a folga do chão (casas). */
const RODA_EM = -0.36
const AROS_EM = 0.3
const RAIO_DA_RODA = 0.88
const FOLGA_DA_RODA = 0.06
const PEDACOS_DO_ARO = 64
const RAIOS_DA_RODA: readonly number[] = [45, 135, 225, 315]
const DEGRAUS_DA_RODA = 16
/** As grossuras (raio, em casas): aro, raio da roda, degrau, eixo, perna, mastro, lança, escora, cabo. */
const GROSSO_DO_ARO = 0.05
const GROSSO_DO_RAIO = 0.034
const GROSSO_DO_DEGRAU = 0.026
const GROSSO_DO_EIXO = 0.055
const GROSSO_DA_PERNA = 0.046
const GROSSO_DO_MASTRO = 0.07
const GROSSO_DA_LANCA = 0.052
const GROSSO_DA_ESCORA = 0.04
const GROSSO_DO_CABO = 0.014
/** Os cavaletes: quanto ficam para fora dos aros (casas) e a abertura das pernas no chão. */
const CAVALETE_FORA = 0.12
const ABERTURA_DO_CAVALETE = 0.32
/** O mastro (fração da meia largura) e a altura dele; a lança, do pé à ponta (fração da meia largura e casas). */
const MASTRO_EM = 0.33
const ALTURA_DO_MASTRO = 2
const PE_DA_LANCA = 1.7
const PONTA_EM = 0.86
const ALTURA_DA_PONTA = 2.15
/** O caixote pendurado: a meia aresta, o alto, e quantos tampos (casas). */
const MEIO_CAIXOTE = 0.13
const ALTO_DO_CAIXOTE = 0.75
const TAMPOS_DO_CAIXOTE = 4
/** O passo dos discos ao longo das vigas (px). */
const PASSO_DA_VIGA = 4.2
const PASSO_DO_CABO = 4
/** Os discos não fazem sombra no chão (sairia um rosário de pingos): a sombra de cada viga é pintada inteira. */
const SOMBRA_DA_VIGA = { suave: 1, forca: 0 } as const
/** A sombra pintada das vigas e dos tampos: a borda e a força (as que se cruzam não somam). */
const SOMBRA_PINTADA = { suave: 1.3, forca: 0.24 } as const
/** A grade da união das sombras na pedra (px) e até onde a distância precisa ser certa. */
const CELULA_DA_UNIAO = 6
const MARGEM_DA_UNIAO = 3
/** A sombra das partes pintada na pedra do cais: a cor e quanto cobre. */
const ESCURO_DA_SOMBRA = 34
const ALFA_DA_SOMBRA = 0.3
/** Quanto cada disco de uma viga de pé anda de lado (px), para a beira de cada um ficar livre. */
const DE_LADO = 0.15
/** Quanto anda de lado (px) o disco que ficou todo coberto pelos de cima. */
const DESVIO_DO_DISCO_COBERTO = 0.35
/** O disco invisível que dá a cor da frente das vigas sem peça: onde fica (fração da meia pegada, sobre a água) e a meia caixa. */
const LUGAR_DO_INVISIVEL: readonly [number, number] = [0.95, -0.85]
const CAIXA_DO_INVISIVEL = 1.6

const CORDA = materialDaPeca('corda')
const FERRO = materialDaPeca('ferro')
const DA_PEDRA = texturaDaClasse('pedra')

type Ponto3 = readonly [number, number, number]

/** A peça que não aparece. */
const texInvisivel: Textura = (_u, _v, _x, _y, _p, s) => {
  s[5] = 0
}

/** A sombra na pedra: só escurece o que está debaixo. */
const texDaSombraNaPedra: Textura = (_u, _v, _x, _y, _p, s) => {
  s[0] = ESCURO_DA_SOMBRA
  s[1] = ESCURO_DA_SOMBRA * 0.95
  s[2] = ESCURO_DA_SOMBRA * 0.9
  s[5] = ALFA_DA_SOMBRA
}

/** A forma com a caixa esticada `mais` px para a frente NA TELA: muda só a vez dela na 3/4. */
function empurrada(forma: Forma, mais: number, quartos: number): Forma {
  const [dx, dy] = doDesenho(0, 1, quartos)
  const [x0, y0, x1, y1] = forma.b
  const b: Forma['b'] = dx > 0.5 ? [x0, y0, x1 + mais, y1] : dx < -0.5 ? [x0 - mais, y0, x1, y1] : dy > 0.5 ? [x0, y0, x1, y1 + mais] : [x0, y0 - mais, x1, y1]
  return { b, d: forma.d }
}

/**
 * A união de muitas formas (são centenas de vigas): cada uma entra nas células da grade que a caixa dela toca, e a
 * distância só olha as da célula do ponto. Longe de todas, devolve a margem (a peça só precisa da beira certa).
 */
function juntas(formas: readonly Forma[]): Forma {
  const b: Forma['b'] = [
    Math.min(...formas.map((f) => f.b[0])) - MARGEM_DA_UNIAO,
    Math.min(...formas.map((f) => f.b[1])) - MARGEM_DA_UNIAO,
    Math.max(...formas.map((f) => f.b[2])) + MARGEM_DA_UNIAO,
    Math.max(...formas.map((f) => f.b[3])) + MARGEM_DA_UNIAO,
  ]
  const colunas = Math.max(1, Math.ceil((b[2] - b[0]) / CELULA_DA_UNIAO))
  const linhas = Math.max(1, Math.ceil((b[3] - b[1]) / CELULA_DA_UNIAO))
  const celulas: Forma[][] = Array.from({ length: colunas * linhas }, () => [])
  const celula = (v: number, de: number, n: number): number => Math.min(n - 1, Math.max(0, Math.floor((v - de) / CELULA_DA_UNIAO)))
  for (const f of formas) {
    const [i0, i1] = [celula(f.b[0] - MARGEM_DA_UNIAO, b[0], colunas), celula(f.b[2] + MARGEM_DA_UNIAO, b[0], colunas)]
    const [j0, j1] = [celula(f.b[1] - MARGEM_DA_UNIAO, b[1], linhas), celula(f.b[3] + MARGEM_DA_UNIAO, b[1], linhas)]
    for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) celulas[j * colunas + i].push(f)
  }
  return {
    b,
    d(x, y) {
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) return MARGEM_DA_UNIAO
      let melhor = MARGEM_DA_UNIAO
      for (const f of celulas[celula(y, b[1], linhas) * colunas + celula(x, b[0], colunas)]) {
        const d = f.d(x, y)
        if (d < melhor) melhor = d
      }
      return melhor
    },
  }
}

/** As pedras do cais: fiadas de blocos desencontrados, cada um com o seu tom e a junta escura. */
const texDoCais: Textura = (u, v, x, y, p, s, escala) => {
  if (DA_PEDRA !== null) DA_PEDRA(u, v, x, y, p, s, escala)
  const fileira = Math.floor(y / (0.3 * G))
  const xx = x / (0.46 * G) + (((fileira % 2) + 2) % 2) * 0.5
  const coluna = Math.floor(xx)
  const fx = xx - coluna
  const fy = y / (0.3 * G) - fileira
  const junta = Math.min(fx * 0.46 * G, (1 - fx) * 0.46 * G, fy * 0.3 * G, (1 - fy) * 0.3 * G)
  s[3] += (hash(coluna, fileira, 9911) - 0.5) * 0.14
  if (junta < 0.9) s[3] -= 0.3 * (1 - junta / 0.9)
}

/** Os pontos de A a B, um a cada `passo` px (de altura ou de chão, o que for maior); na viga de pé, cada um um tico de lado. */
function reta(a: Ponto3, b: Ponto3, passo: number): Ponto3[] {
  const chao = Math.hypot(b[0] - a[0], b[1] - a[1])
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[2] - a[2]), chao) / passo))
  const dePe = chao / n < DE_LADO
  const sobe = b[2] >= a[2] ? 1 : -1
  return Array.from({ length: n + 1 }, (_, k): Ponto3 => {
    const t = k / n
    return [a[0] + (b[0] - a[0]) * t + (dePe ? DE_LADO * k * sobe : 0), a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  })
}

interface Parte {
  readonly sombra: Sombra
  /** A peça de cima (o que se vê do alto); sem ela, só o pingo que dá o material da frente. */
  readonly forma: Forma | null
  readonly mat: MaterialDaPeca
  readonly o: OpcoesDaPeca
  /** Só nos discos das vigas: o meio e o raio, para andar o disco de lado quando ele fica todo coberto. */
  readonly disco?: { readonly x: number; readonly y: number; readonly r: number }
}

export const montarGuindasteDePorto: MontarMovel = (c, cena) => {
  const P = c.peca
  const { hw, hh } = c
  const quartos = quartosDoGiro(c.giro)
  const g = G
  const madeira = c.m.madeira
  const pedra = c.m.pedra
  const partes: Parte[] = []
  /** O que faz sombra: cada trecho de viga (de ponto a ponto, raio) e cada tampo (forma e altura). */
  const trechos: { readonly a: Ponto3; readonly b: Ponto3; readonly r: number }[] = []
  const tampos: { readonly forma: Forma; readonly z: number }[] = []
  /** As sombras de tudo num chão à altura `base`: cada ponto andado pela altura acima dele. */
  const sombrasEm = (base: number): Forma[] => [
    ...trechos.map(({ a, b, r }) => capsula(a[0] + SOMBRA_X * (a[2] - base), a[1] + SOMBRA_Y * (a[2] - base), b[0] + SOMBRA_X * (b[2] - base), b[1] + SOMBRA_Y * (b[2] - base), r)),
    ...tampos.map(({ forma, z }) => deslocada(forma, SOMBRA_X * (z - base), SOMBRA_Y * (z - base))),
  ]
  const zCais = ALTURA_DO_CAIS * g
  const madeiraDe = (semente: number, tom = 1, eixo = 0, r = 2): OpcoesDaPeca => ({ tabua: 0, eixo, bisel: r * 0.6, contorno: 0.2, tom, projeta: { dist: 0.9, forca: 0.28 }, semente })

  /** Uma viga redonda de discos pelos pontos: cada disco com o pedaço da viga visto de cima (até o meio dos vizinhos). */
  const viga = (pts: readonly Ponto3[], raio: number, mat: MaterialDaPeca, semente: number, tom = 1, fechada = false): void => {
    const n = pts.length
    for (let k = 0; k + 1 < n; k += 1) trechos.push({ a: pts[k], b: pts[k + 1], r: raio })
    if (fechada) trechos.push({ a: pts[n - 1], b: pts[0], r: raio })
    pts.forEach(([x, y, z], k) => {
      const ant = k > 0 ? pts[k - 1] : fechada ? pts[n - 1] : null
      const prox = k + 1 < n ? pts[k + 1] : fechada ? pts[0] : null
      const [ax, ay] = ant === null ? [x, y] : [(ant[0] + x) / 2, (ant[1] + y) / 2]
      const [bx, by] = prox === null ? [x, y] : [(prox[0] + x) / 2, (prox[1] + y) / 2]
      const eixo = Math.abs(bx - ax) >= Math.abs(by - ay) ? 0 : QUARTO
      partes.push({ sombra: { forma: disco(x, y, raio), z, solta: true, ...SOMBRA_DA_VIGA }, forma: capsula(ax, ay, bx, by, raio * 0.94), mat, o: madeiraDe(semente + k, tom, eixo, raio), disco: { x, y, r: raio } })
    })
  }
  /** Um tampo inteiro (o degrau, o eixo, a travessa): a forma é a estrutura e a peça de cima. */
  const tampo = (forma: Forma, z: number, mat: MaterialDaPeca, o: OpcoesDaPeca): void => {
    partes.push({ sombra: { forma, z, solta: true, ...SOMBRA_DA_VIGA }, forma, mat, o })
    tampos.push({ forma, z })
  }

  // ---------- a roda de pisar: os dois aros, os raios em X, os degraus e o eixo ----------
  const xRoda = RODA_EM * hw
  const rRoda = RAIO_DA_RODA * g
  const zRoda = zCais + rRoda + FOLGA_DA_RODA * g
  const yAro = AROS_EM * hh
  const naRoda = (t: number, rho: number, y: number): Ponto3 => [xRoda + Math.cos(t) * rho, y, zRoda + Math.sin(t) * rho]
  ;[-1, 1].forEach((lado, i) => {
    const y = lado * yAro
    const aro = Array.from({ length: PEDACOS_DO_ARO }, (_, k) => naRoda((k * 2 * Math.PI) / PEDACOS_DO_ARO, rRoda, y))
    viga(aro, GROSSO_DO_ARO * g, madeira, 9900 + i * 100, 1.06, true)
    RAIOS_DA_RODA.forEach((graus, j) => {
      const t = (graus * Math.PI) / 180
      viga(reta(naRoda(t, GROSSO_DO_EIXO * g + 1, y), naRoda(t, rRoda - GROSSO_DO_ARO * g, y), PASSO_DA_VIGA), GROSSO_DO_RAIO * g, madeira, 9940 + i * 100 + j * 12, 0.94)
    })
  })
  for (let k = 0; k < DEGRAUS_DA_RODA; k += 1) {
    const t = ((k + 0.5) * 2 * Math.PI) / DEGRAUS_DA_RODA
    const [x, , z] = naRoda(t, rRoda - GROSSO_DO_ARO * g * 0.6, 0)
    const r = GROSSO_DO_DEGRAU * g
    tampo(capsula(x, -yAro, x, yAro, r), z, madeira, madeiraDe(10100 + k, 0.98, QUARTO, r))
  }
  const rEixo = GROSSO_DO_EIXO * g
  const yEixo = yAro + CAVALETE_FORA * g + rEixo
  tampo(capsula(xRoda, -yEixo, xRoda, yEixo, rEixo), zRoda, madeira, madeiraDe(10120, 0.9, QUARTO, rEixo))

  // ---------- os cavaletes: duas pernas abertas e a travessa, um de cada lado da roda ----------
  const abertura = ABERTURA_DO_CAVALETE * g
  ;[-1, 1].forEach((lado, i) => {
    const y = lado * (yAro + CAVALETE_FORA * g)
    for (const sx of [-1, 1]) viga(reta([xRoda + sx * abertura, y, zCais + 1], [xRoda, y, zRoda + 1], PASSO_DA_VIGA), GROSSO_DA_PERNA * g, madeira, 10130 + i * 40 + (sx + 1) * 10, 0.96)
    const zTravessa = zCais + (zRoda - zCais) * 0.42
    const meia = abertura * 0.58
    tampo(capsula(xRoda - meia, y, xRoda + meia, y, GROSSO_DA_PERNA * g * 0.8), zTravessa, madeira, madeiraDe(10170 + i, 0.92, 0, 2))
  })

  // ---------- o mastro, as três escoras, a lança com a escora dela e o estai ----------
  const xMastro = MASTRO_EM * hw
  const zMastro = ALTURA_DO_MASTRO * g
  const xPonta = PONTA_EM * hw
  const zPonta = ALTURA_DA_PONTA * g
  viga(reta([xMastro, 0, zCais + 1], [xMastro, 0, zMastro], PASSO_DA_VIGA), GROSSO_DO_MASTRO * g, madeira, 10200, 1.02)
  for (const [ex, ey] of [[0, -0.42 * hh], [0, 0.42 * hh], [0.3 * g, 0]] as const) {
    viga(reta([xMastro + ex, ey, zCais + 1], [xMastro, 0, 0.85 * g], PASSO_DA_VIGA), GROSSO_DA_ESCORA * g, madeira, 10240 + Math.round(ey + ex), 0.92)
  }
  const zPeDaLanca = PE_DA_LANCA * g
  viga(reta([xMastro + GROSSO_DO_MASTRO * g, 0, zPeDaLanca], [xPonta, 0, zPonta], PASSO_DA_VIGA), GROSSO_DA_LANCA * g, madeira, 10300, 1.04)
  const meioDaLanca = 0.55
  viga(reta([xMastro + GROSSO_DO_MASTRO * g, 0, 0.95 * g], [xMastro + (xPonta - xMastro) * meioDaLanca, 0, zPeDaLanca + (zPonta - zPeDaLanca) * meioDaLanca - 1], PASSO_DA_VIGA), GROSSO_DA_ESCORA * g, madeira, 10340, 0.92)
  viga(reta([xMastro, 0, zMastro], [xPonta - 2, 0, zPonta + 1], PASSO_DO_CABO), GROSSO_DO_CABO * g, CORDA, 10380, 1)

  // ---------- os cabos: do tambor da roda ao alto do mastro, e o de içar da ponta da lança ao caixote ----------
  viga(reta([xRoda + rEixo, 0, zRoda], [xMastro - GROSSO_DO_MASTRO * g, 0, zMastro - 4], PASSO_DO_CABO), GROSSO_DO_CABO * g, CORDA, 10400, 1)
  const zCaixote = ALTO_DO_CAIXOTE * g
  viga(reta([xPonta, 0, zPonta - 2], [xPonta, 0, zCaixote + 5], PASSO_DO_CABO), GROSSO_DO_CABO * g, CORDA, 10440, 1)

  // ---------- o caixote pendurado: tampos de cima para baixo, cada um um tico de lado; a linga e o gancho ----------
  const m = MEIO_CAIXOTE * g
  const e = ESPESSURA_DO_GUINDASTE
  for (let k = 0; k < TAMPOS_DO_CAIXOTE; k += 1) {
    const dx = -0.2 * k
    const forma = caixa(xPonta - m + dx, -m, xPonta + m + dx, m, 0.8)
    if (k === 0) tampos.push({ forma, z: zCaixote })
    partes.push({ sombra: { forma, z: zCaixote - k * e, solta: true, ...SOMBRA_DA_VIGA }, forma: k === 0 ? forma : null, mat: madeira, o: { tabua: 4, eixo: 0, bisel: 1, contorno: 0.3, tom: 1.08, projeta: { dist: 1, forca: 0.3 }, semente: 10480 } })
  }

  // ---------- o cais: a estrutura e o chão de tudo ----------
  const cais = caixa(-CAIS[0] * hw, -CAIS[1] * hh, BEIRA_DO_CAIS * hw, CAIS[1] * hh, 1.5)
  const sombraDoCais = coluna(cais, zCais)
  const S = cena.sombras
  S.push(contato(cais, 0.3), sombraDoCais)
  for (const forma of sombrasEm(0)) S.push({ forma, z: 0, ...SOMBRA_PINTADA })
  // Cada parte vai para a 3/4 com a caixa empurrada para a frente NA TELA: todas saem depois do cais (senão ele as
  // cobre), e entre elas a ordem fica a de antes. A busca do meio da peça usa a forma de verdade.
  const empurrar = 2 * Math.max(hw, hh)
  const naCena = new Map<Parte, Sombra>()
  for (const p of partes) {
    const s: Sombra = { ...p.sombra, forma: empurrada(p.sombra.forma, empurrar, quartos) }
    naCena.set(p, s)
    S.push(s)
  }
  /**
   * A metade de baixo de um aro (ou de um raio) fica toda debaixo da metade de cima na vista de cima: sem ponto
   * livre, ela sairia sem peça, na cor da pedra. Andado um tico para fora (o aro do fundo para trás, o da frente para
   * a frente), a beira dele fica livre e recebe a peça.
   */
  const andadoDeLado = (p: Parte): Ponto | null => {
    const s = naCena.get(p)
    if (p.disco === undefined || s === undefined) return null
    const { x, y, r } = p.disco
    const nova = disco(x, y + (y >= 0 ? 1 : -1) * DESVIO_DO_DISCO_COBERTO, r)
    const andada: Sombra = { ...s, forma: empurrada(nova, empurrar, quartos) }
    S[S.indexOf(s)] = andada
    naCena.set(p, andada)
    return pontoSoDela(andada, S, nova)
  }
  const ondeFica = (p: Parte): Ponto | null => {
    const s = naCena.get(p)
    return s === undefined ? null : pontoSoDela(s, S, p.sombra.forma)
  }

  // ---------- as peças: o cais, os dormentes e a sombra das partes na pedra; depois cada parte, de baixo para cima ----------
  const L = cena.partes
  const noCais = pontoSoDela(sombraDoCais, S)
  const [cx, cy] = noCais ?? [-CAIS[0] * hw * 0.9, CAIS[1] * hh * 0.9]
  L.push(P(comMeioEm(cais, cx, cy), pedra, { tabua: 0, bisel: 1.6, contorno: 0.28, tom: 0.9, textura: texDoCais, semente: 9890 }))
  // Um disco de madeira invisível com a maior caixa do objeto, no chão da água (fora de toda estrutura): o disco de
  // viga que ainda ficar sem peça tem a frente na cor da maior peça do objeto (`tresQuartos.ts`), e assim sai de
  // madeira, não da pedra do cais.
  const [ix, iy] = LUGAR_DO_INVISIVEL
  const [vx, vy] = [ix * hw, iy * hh]
  const meia = CAIXA_DO_INVISIVEL * Math.max(hw, hh)
  L.push(P({ b: [vx - meia, vy - meia, vx + meia, vy + meia], d: (x, y) => Math.hypot(x - vx, y - vy) - 0.3 }, madeira, { tabua: 0, bisel: 0, contorno: 0, textura: texInvisivel, semente: 9892 }))
  // A sombra que a roda, o mastro e a lança fazem no cais (a do chão não aparece debaixo da pedra): é ela que diz
  // "roda" de cima. Cada parte andada pela altura acima do cais, como as sombras do chão andam.
  const sombraNaPedra = juntas(sombrasEm(zCais))
  L.push(P(comMeioEm(dentroDe(sombraNaPedra, cais), cx, cy), pedra, { tabua: 0, bisel: 0, contorno: 0, textura: texDaSombraNaPedra, semente: 9891 }))
  const dormentes: readonly Forma[] = [
    ...[-1, 1].map((lado) => caixa(xRoda - abertura - 3, lado * (yAro + CAVALETE_FORA * g) - 3, xRoda + abertura + 3, lado * (yAro + CAVALETE_FORA * g) + 3, 0.8)),
    caixa(xMastro - 4, -0.42 * hh - 3, xMastro + 4, 0.42 * hh + 3, 0.8),
  ]
  dormentes.forEach((d, i) => L.push(P(comMeioEm(d, cx, cy), madeira, { tabua: 0, eixo: i < 2 ? 0 : QUARTO, bisel: 1, contorno: 0.3, tom: 0.78, projeta: { dist: 1, forca: 0.3 }, semente: 9895 + i })))
  const ordem = [...partes].sort((a, b) => a.sombra.z - b.sombra.z)
  for (const p of ordem) {
    const ponto = ondeFica(p) ?? andadoDeLado(p)
    if (ponto === null) continue
    if (p.forma === null) L.push(pingo(P, ponto[0], ponto[1], p.mat, (p.o.semente ?? 0) + 7))
    else L.push(P(comMeioEm(p.forma, ponto[0], ponto[1]), p.mat, p.o))
  }

  // A linga (duas cordas em X do gancho aos cantos) e o gancho, no tampo de cima do caixote.
  const tampoDoCaixote = partes.find((p) => p.forma !== null && p.sombra.z === zCaixote && p.mat === madeira && p.o.tabua === 4)
  const ancora: Ponto | null = tampoDoCaixote === undefined ? null : ondeFica(tampoDoCaixote)
  if (ancora !== null) {
    for (const [sx, sy] of [[-1, -1], [1, 1], [-1, 1], [1, -1]] as const) {
      L.push(P(comMeioEm(capsula(xPonta, 0, xPonta + sx * m * 0.8, sy * m * 0.8, 0.5), ancora[0], ancora[1]), CORDA, { tabua: 0, bisel: 0.4, contorno: 0.25, semente: 10490 + sx + 2 * sy }))
    }
    L.push(P(comMeioEm(disco(xPonta, 0, 1.6), ancora[0], ancora[1]), FERRO, { tabua: 0, bisel: 1, contorno: 0.3, metal: 0.4, projeta: { dist: 0.8, forca: 0.3 }, semente: 10499 }))
  }
}
