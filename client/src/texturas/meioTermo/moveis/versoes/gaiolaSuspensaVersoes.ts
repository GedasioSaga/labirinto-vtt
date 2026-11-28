/**
 * As versões da GAIOLA SUSPENSA (L01 do plano de arte por tema, 28/11/2026). A de hoje (fechada e vazia) é o desenho
 * do tipo; aqui ficam a ABERTA VAZIA (a portinhola escancarada para fora nas dobradiças, sem o cadeado, que alguém
 * levou) e a COM OSSOS (fechada, com o que sobrou de quem ficou lá dentro, no fundo de chapa: o crânio virado de
 * costas, sem rosto, dois ossos compridos, as costelas soltas, umas vértebras e a mancha velha debaixo deles).
 *
 * O desenho da gaiola é todo interno (a vista de cima em grupos, a 3/4 desenhada na tela e fatiada em faixas de até
 * 24 px, cada faixa subida por um pino), então a versão roda o desenho-base com a fábrica de peças embrulhada e mexe
 * no caminho, peça a peça, pela semente:
 * - some com a portinhola fechada (8500 a 8508 e o buraco da chave) e com o cadeado de cima (8820);
 * - no lugar dela, em cada faixa, põe a portinhola ABERTA: a mesma, girada para fora em volta do eixo das dobradiças,
 *   que ficam onde estavam; o aro da cintura (8411 e 8431) perde o pedaço que passava pelo vão da porta;
 * - por cima do fundo de chapa e das tiras de trás põe os ossos: na 3/4, em cada faixa, antes da primeira peça da
 *   frente (os aros e as tiras da frente, 8430 a 8449), que os cobrem como cobrem o fundo; de cima, antes da primeira
 *   tira dos flancos (8803), logo depois do fundo.
 * Cada peça posta numa faixa é cortada como o desenho-base corta as dele (`naFatia`): a altura e a ordem vêm do pino
 * da faixa, e a gaiola girada recebe a mesma volta (`pecaNaTela`). Se o desenho-base mudar as sementes, as medidas ou
 * o corte, esta versão tem de acompanhar: tudo o que foi copiado de lá está no bloco marcado.
 */
import type { VersoesDesenhadas } from '.'
import { rgb, type Rgb } from '../../../ruido'
import { montarGaiolaSuspensa } from '../gaiolaSuspensa'
import { G, QUARTO, type MontarMovel } from '../contexto'
import { anel, cadeia, caixa, capsula, elipse, type Forma, type Ponto } from '../formas'
import { ruido, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Sombra, type Textura } from '../motor'

// ---------- copiado de gaiolaSuspensa.ts: o lugar da gaiola, o sino, a portinhola, a ferrugem e o corte das faixas ----------
const GAIOLA_X = 0.12
const LINHA_Y = -0.25
const ESCALA_MINIMA = 0.8
const ESCALA_MAXIMA = 1.5
const FUNDO = 14
const CINTURA = 40
const OMBRO = 64
const RAIO_DO_FUNDO = 12.2
const RAIO_DA_CINTURA = 9.4
const RAIO_DO_OMBRO = 9.8
const ACHATADO = 0.36
const TIRAS = 8
const MEIA_TIRA = 0.95
const MEIO_ARO = 1.05
const PE_DA_PORTA = 22
const ALTO_DA_PORTA = 54
const SOBRA_DA_PORTA = 0.7
const DOBRADICAS: readonly number[] = [27, 49]
const ALTURA_DO_CADEADO = 38
const PASSOS_DA_PORTA = 8
const TOM_DE_TRAS = 0.6
const QUASE_DE_LADO = 0.05
const BRILHO_DO_FERRO = 0.24
const FERRUGEM: Rgb = rgb('#935f47')
const FERRUGEM_CHEIA = 0.8
const FERRUGEM_DAS_CINTAS = 0.16
const EMENDA = 0.2
const FOLGA_DO_CORTE = 3
const FORA_DA_FAIXA = 1e3
/** As sementes das peças do desenho-base que a versão tira, corta ou usa de marco. */
const PORTINHOLA: readonly [number, number] = [8500, 8508]
const AROS_DA_CINTURA: readonly number[] = [8411, 8431]
const PRIMEIRA_TIRA_DE_CIMA = 8803
const CADEADO_DE_CIMA = 8820
/** O buraco da chave da portinhola não tem semente: é o único liso com 0,8 de alfa e sem contorno. */
const ALFA_DO_BURACO_DA_CHAVE = 0.8
// ---------- fim do que foi copiado ----------

/**
 * O quanto a portinhola aberta girou para fora nas dobradiças: quase meia volta, escancarada para o lado. Com 110 graus
 * ela ficava de cutelo para quem olha de frente e lia como um cano solto; assim a 3/4 mostra a porta inteira ao lado do
 * vão, e de cima ela é a barra que sai da beira do sino.
 */
const ABERTURA = (165 * Math.PI) / 180
/** O pedaço do aro da cintura que sai: entre as duas tiras da porta, sem comer a beira delas (rad, folga em px). */
const BEIRA_DA_TIRA = 0.12
const FOLGA_DO_VAO = 0.7
/** Os ossos: o osso velho, apagado (nada de branco), e a mancha escura que ficou no fundo de chapa. */
const OSSO: MaterialDaPeca = { classe: 'liso', rgb: [0xcc, 0xc0, 0xa6] }
const MANCHA: MaterialDaPeca = { classe: 'liso', rgb: [0x2a, 0x20, 0x1a] }
/** O tom dos ossos dentro da gaiola (a sombra do domo) e de cima (lá embaixo, mais escuro ainda). */
const TOM_DO_OSSO = 0.92
const TOM_DO_OSSO_DE_CIMA = 1.02
/** As peças da frente da 3/4 (os aros e as tiras da frente): os ossos entram antes da primeira delas, em cada faixa. */
const FRENTE_DA_TELA: readonly [number, number] = [8430, 8449]

type Versao = 'aberta' | 'ossos'

interface Gaiola {
  readonly k: number
  /** O eixo da gaiola na pegada girada e o ângulo da portinhola (0 = virada para a frente da tela). */
  readonly gx: number
  readonly gy: number
  readonly porta: number
}

interface Desenho {
  readonly forma: Forma
  readonly mat: MaterialDaPeca
  readonly o: OpcoesDaPeca
}

/** A faixa da 3/4 em que o desenho-base está pondo peças agora: a altura do pino, o lugar dele e o trecho da tela. */
interface Faixa {
  readonly z: number
  readonly ancora: Ponto
  readonly de: number
  readonly ate: number
}

// ---------- as contas do desenho-base (as mesmas, copiadas) ----------

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

function suave01(t: number): number {
  const u = limitar(t, 0, 1)
  return u * u * (3 - 2 * u)
}

function raioDoCorpo(z: number): number {
  if (z <= CINTURA) return RAIO_DO_FUNDO + (RAIO_DA_CINTURA - RAIO_DO_FUNDO) * suave01((z - FUNDO) / (CINTURA - FUNDO))
  return RAIO_DA_CINTURA + (RAIO_DO_OMBRO - RAIO_DA_CINTURA) * suave01((z - CINTURA) / (OMBRO - CINTURA))
}

function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

function girarPonto(x: number, y: number, q: number): Ponto {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : q === 3 ? [y, -x] : [x, y]
}

function girarForma(f: Forma, q: number): Forma {
  if (q === 0) return f
  const b = f.b
  const girada: Forma['b'] = q === 1 ? [-b[3], b[0], -b[1], b[2]] : q === 2 ? [-b[2], -b[3], -b[0], -b[1]] : [b[1], -b[2], b[3], -b[0]]
  const volta = 4 - q
  return {
    b: girada,
    d: (x, y) => {
      const [mx, my] = girarPonto(x, y, volta)
      return f.d(mx, my)
    },
  }
}

/** A fábrica de peças da 3/4 girada (`pecaNaTela`): a peça sai desgirada e a volta da 3/4 a põe no lugar. */
function pecaNaTela(P: CriarPeca, q: number): CriarPeca {
  if (q === 0) return P
  return (forma, mat, o = {}) => {
    const textura = o.textura
    return P(girarForma(forma, 4 - q), mat, {
      ...o,
      eixo: (o.eixo ?? 0) - q * QUARTO,
      textura:
        textura === undefined
          ? undefined
          : (u, v, x, y, p, s, pixels) => {
              const [tx, ty] = girarPonto(x, y, q)
              textura(u, v, tx, ty, p, s, pixels)
            },
    })
  }
}

function presa(forma: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - forma.b[0], forma.b[2] - cx)
  const my = Math.max(cy - forma.b[1], forma.b[3] - cy)
  return { b: [cx - mx, cy - my, cx + mx, cy + my], d: (x, y) => forma.d(x, y) }
}

function texFerrugem(quanto: number): Textura {
  const metal = texturaDaClasse('metal')
  return (u, v, x, y, p, s, escala) => {
    if (metal !== null) metal(u, v, x, y, p, s, escala)
    const mancha = ruido(x * 0.09 + p.su, y * 0.09 + p.sv) * 1.5 + ruido(x * 0.32 + p.sv, y * 0.32 + p.su) * 0.9 + ruido(x * 1.1 + p.su, y * 1.1) * 0.55
    const q = (mancha + quanto - 0.2) / 0.5
    const t = q <= 0 ? 0 : q >= 1 ? FERRUGEM_CHEIA : q * q * (3 - 2 * q) * FERRUGEM_CHEIA
    s[0] += (FERRUGEM[0] - s[0]) * t
    s[1] += (FERRUGEM[1] - s[1]) * t
    s[2] += (FERRUGEM[2] - s[2]) * t
    s[3] -= t * 0.05
  }
}

/** A cópia da peça da tela na faixa, guardada no chão e presa ao pino dela: o mesmo corte de `naFatia`. */
function naFaixa(peca: Desenho, f: Faixa, soNaTresQuartos: boolean): Desenho | null {
  const fo = peca.forma
  const visivel0 = Math.max(f.de, fo.b[1]) + f.z - EMENDA
  const visivel1 = Math.min(f.ate, fo.b[3]) + f.z + EMENDA
  if (visivel1 - visivel0 <= 2 * EMENDA) return null
  const corte0 = visivel0 - FOLGA_DO_CORTE
  const corte1 = visivel1 + FOLGA_DO_CORTE
  const guardada: Forma = { b: [fo.b[0], corte0, fo.b[2], corte1], d: (x, y) => (y < corte0 || y > corte1 ? FORA_DA_FAIXA : fo.d(x, y - f.z)) }
  const eixo = peca.o.eixo ?? 0
  const du = -f.z * Math.sin(eixo)
  const dv = -f.z * Math.cos(eixo)
  const doMaterial = peca.o.textura ?? texturaDaClasse(peca.mat.classe)
  const textura: Textura = (u, v, x, y, p, s, pixels) => {
    if (y < visivel0 || y > visivel1 || (soNaTresQuartos && p.dy === 0)) {
      s[5] = 0
      return
    }
    if (doMaterial !== null) doMaterial(u + du, v + dv, x, y - f.z, p, s, pixels)
  }
  return { forma: presa(guardada, f.ancora[0], f.ancora[1]), mat: peca.mat, o: { ...peca.o, textura } }
}

// ---------- a faixa em andamento ----------

function ehPino(s: Sombra | undefined): s is Sombra {
  return s !== undefined && s.solta === true && s.forca === 0 && s.forma.b[0] === s.forma.b[2] && s.forma.b[1] === s.forma.b[3]
}

/**
 * A faixa do pino que acabou de entrar: todas as faixas têm a mesma altura (a diferença de `z` entre dois pinos
 * seguidos) e o mesmo lugar guardado, com o pino no meio dele. A primeira faixa (o alto do poste) não tem vizinho
 * antes, mas nela não há porta nem fundo.
 */
function faixaAtual(cena: Cena): Faixa | null {
  const n = cena.sombras.length
  const atual = cena.sombras[n - 1]
  const antes = cena.sombras[n - 2]
  if (!ehPino(atual) || !ehPino(antes)) return null
  const altura = antes.z - atual.z
  if (altura <= 0) return null
  const ancora: Ponto = [atual.forma.b[0], atual.forma.b[1]]
  const de = ancora[1] - altura / 2 - atual.z
  return { z: atual.z, ancora, de, ate: de + altura }
}

const VAZIA = (forma: Forma): Forma => ({ b: forma.b, d: () => FORA_DA_FAIXA })

// ---------- a portinhola aberta ----------

/** O ponto da portinhola em `teta` e `z` (`fora` px além do caixilho), girado para fora em volta do eixo das dobradiças. */
function naPortaAberta(g: Gaiola, teta: number, z: number, fora = 0): Ponto {
  const t0 = g.porta - Math.PI / TIRAS
  const r = raioDoCorpo(z) + SOBRA_DA_PORTA
  const [hx, hd] = [r * Math.sin(t0), r * Math.cos(t0)]
  const [vx, vd] = [(r + fora) * Math.sin(teta) - hx, (r + fora) * Math.cos(teta) - hd]
  const [co, si] = [Math.cos(ABERTURA), Math.sin(ABERTURA)]
  const [x, d] = [hx + vx * co - vd * si, hd + vx * si + vd * co]
  return [g.gx + x * g.k, g.gy + d * g.k * ACHATADO - z * g.k]
}

/** O ponto do sino na tela (`naGaiola`). */
function naGaiola(g: Gaiola, teta: number, z: number, r: number): Ponto {
  return [g.gx + r * g.k * Math.sin(teta), g.gy + r * g.k * ACHATADO * Math.cos(teta) - z * g.k]
}

/** A portinhola aberta na tela: as três barras em pé, as duas travessas, as dobradiças (no lugar) e o ferrolho com a argola. */
function portaAberta(g: Gaiola, ferro: MaterialDaPeca): Desenho[] {
  const { k } = g
  const t0 = g.porta - Math.PI / TIRAS
  const t1 = g.porta + Math.PI / TIRAS
  const tom = Math.cos(g.porta) > -QUASE_DE_LADO ? 1 : TOM_DE_TRAS
  const op = (semente: number, fator = 1): OpcoesDaPeca => ({ tabua: 0, bisel: 0.7 * k, tom: tom * fator, contorno: 0.28, metal: BRILHO_DO_FERRO, textura: texFerrugem(FERRUGEM_DAS_CINTAS), semente })
  const passos = Array.from({ length: PASSOS_DA_PORTA + 1 }, (_, i) => i / PASSOS_DA_PORTA)
  const deLado = (teta: number): Forma => cadeia(passos.map((f) => naPortaAberta(g, teta, PE_DA_PORTA + (ALTO_DA_PORTA - PE_DA_PORTA) * f)), MEIA_TIRA * 1.15 * k)
  const deTraves = (z: number): Forma => cadeia(passos.map((f) => naPortaAberta(g, t0 + (t1 - t0) * f, z)), MEIO_ARO * 1.1 * k)
  const lista: Desenho[] = [
    { forma: deLado(g.porta), mat: ferro, o: op(8530, 0.94) },
    { forma: deLado(t0), mat: ferro, o: op(8531) },
    { forma: deLado(t1), mat: ferro, o: op(8532) },
    { forma: deTraves(PE_DA_PORTA), mat: ferro, o: op(8533) },
    { forma: deTraves(ALTO_DA_PORTA), mat: ferro, o: op(8534) },
  ]
  for (const z of DOBRADICAS) {
    const [x, y] = naGaiola(g, t0, z, raioDoCorpo(z) + 2 * SOBRA_DA_PORTA)
    lista.push({ forma: capsula(x, y - 1.7 * k, x, y + 1.7 * k, 0.85 * k), mat: ferro, o: op(8535, 1.1) })
  }
  // O ferrolho na barra solta e a argola onde o cadeado ficava: os dois foram junto com a porta.
  const [fx, fy] = naPortaAberta(g, t1, ALTURA_DO_CADEADO, SOBRA_DA_PORTA)
  lista.push({ forma: caixa(fx - 1.1 * k, fy - 1.6 * k, fx + 1.1 * k, fy + 1.6 * k, 0.4 * k), mat: ferro, o: op(8536, 1.05) })
  lista.push({ forma: anel(fx, fy + 1.7 * k, 1.15 * k, 1.25 * k, 0.55 * k, 0.65 * k), mat: ferro, o: op(8537, 1.15) })
  return lista
}

/** O pedaço do aro da cintura que passava pela porta (na tela), para sair do aro com a porta aberta. */
function vaoNaCintura(g: Gaiola): Forma {
  const t0 = g.porta - Math.PI / TIRAS + BEIRA_DA_TIRA
  const t1 = g.porta + Math.PI / TIRAS - BEIRA_DA_TIRA
  const pontos = Array.from({ length: 9 }, (_, i) => naGaiola(g, t0 + ((t1 - t0) * i) / 8, CINTURA, RAIO_DA_CINTURA))
  return cadeia(pontos, MEIO_ARO * g.k + FOLGA_DO_VAO)
}

/** A portinhola aberta vista de cima: quase de cutelo, do eixo das dobradiças para fora, com o ferrolho na ponta. */
function portaAbertaDeCima(g: Gaiola, ferro: MaterialDaPeca): Desenho[] {
  const { k } = g
  const t0 = g.porta - Math.PI / TIRAS
  const t1 = g.porta + Math.PI / TIRAS
  const z = (PE_DA_PORTA + ALTO_DA_PORTA) / 2
  const r = raioDoCorpo(z) + SOBRA_DA_PORTA
  const deCima = (teta: number): Ponto => {
    const [x, y] = naPortaAberta(g, teta, z)
    return [x, g.gy + (y - g.gy + z * k) / ACHATADO]
  }
  // De cima a porta está de cutelo: a barra reta do eixo à ponta (a travessa de cima) e, nela, o alto das três barras
  // em pé. Curva como a beira do sino, ela lia como uma manivela.
  const [hx, hy] = [g.gx + r * k * Math.sin(t0), g.gy + r * k * Math.cos(t0)]
  const [fx, fy] = deCima(t1)
  const [mx, my] = deCima(g.porta)
  const op = (semente: number, tom: number): OpcoesDaPeca => ({ tabua: 0, bisel: 0.6 * k, tom, contorno: 0.28, metal: BRILHO_DO_FERRO, textura: texFerrugem(FERRUGEM_DAS_CINTAS), semente })
  return [
    { forma: capsula(hx, hy, fx, fy, 1 * k), mat: ferro, o: op(8840, 0.86) },
    ...[[hx, hy], [mx, my], [fx, fy]].map(([x, y], i): Desenho => ({ forma: elipse(x, y, 0.95 * k, 0.95 * k), mat: ferro, o: op(8841 + i, 1.12) })),
  ]
}

// ---------- os ossos ----------

/**
 * Os ossos no fundo de chapa, como pontos do fundo (x para a direita, d para a frente, em px da gaiola de 1 casa) e a
 * altura acima dele. Arrumados no meio e um pouco para a frente, onde o fundo aparece entre as tiras.
 */
interface Osso {
  readonly forma: (no: (x: number, d: number, h: number) => Ponto, k: number) => Forma
  readonly tom: number
  readonly bisel: number
  readonly semente: number
}

const OSSOS: readonly Osso[] = [
  // O fêmur encostado na grade do fundo, à esquerda: na 3/4 é o que aparece acima do fundo, entre as tiras.
  { forma: (no, k) => capsula(...no(-6.2, -2.4, 0.8), ...no(-7.4, -5.6, 10.5), 0.68 * k), tom: 0.9, bisel: 0.55, semente: 8911 },
  { forma: (no, k) => elipse(...no(-7.5, -5.8, 11), 1.05 * k, 0.95 * k), tom: 0.96, bisel: 0.6, semente: 8912 },
  // As costelas soltas, três arcos, à direita do crânio.
  ...[0, 1, 2].map(
    (i): Osso => ({
      forma: (no, k) => cadeia(Array.from({ length: 6 }, (_, j) => no(4.2 + i * 1.6 + 1.7 * Math.sin(-1 + 0.4 * j), 1.6 + 1.2 * Math.cos(-1 + 0.4 * j), 0.4)), 0.4 * k),
      tom: 0.9,
      bisel: 0.3,
      semente: 8905 + i,
    }),
  ),
  // O fêmur deitado na frente, com as duas cabeças.
  { forma: (no, k) => capsula(...no(-4.2, 5.6, 0.6), ...no(4.2, 7, 0.6), 0.7 * k), tom: 0.96, bisel: 0.55, semente: 8901 },
  { forma: (no, k) => elipse(...no(-4.4, 5.5, 0.7), 1.15 * k, 0.95 * k), tom: 1, bisel: 0.6, semente: 8902 },
  { forma: (no, k) => elipse(...no(4.4, 7.1, 0.7), 1.05 * k, 0.9 * k), tom: 1, bisel: 0.6, semente: 8903 },
  // As vértebras em fila, na beira da frente.
  ...[0, 1, 2].map((i): Osso => ({ forma: (no, k) => elipse(...no(5.4 + i * 1.4, 4.6 + i * 0.7, 0.5), 0.72 * k, 0.62 * k), tom: 0.94, bisel: 0.5, semente: 8908 + i })),
  // O crânio virado de costas, no meio e para a frente (de cima, fora do braço e do capuz): um oval liso, sem rosto.
  { forma: (no, k) => elipse(...no(0.8, 3.4, 2.3), 2.8 * k, 2.35 * k), tom: 1, bisel: 1.6, semente: 8900 },
]

function ossos(g: Gaiola, no: (x: number, d: number, h: number) => Ponto, tom: number, mancha: Forma): Desenho[] {
  const lista: Desenho[] = [{ forma: mancha, mat: MANCHA, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.24, suave: 1.6 * g.k, semente: 8899 } }]
  for (const osso of OSSOS) lista.push({ forma: osso.forma(no, g.k), mat: OSSO, o: { tabua: 0, bisel: osso.bisel * g.k, tom: tom * osso.tom, contorno: 0.3, semente: osso.semente } })
  return lista
}

/** Os ossos na tela da 3/4: o fundo achatado, cada osso na altura dele. */
function ossosNaTela(g: Gaiola): Desenho[] {
  const no = (x: number, d: number, h: number): Ponto => [g.gx + x * g.k, g.gy + d * g.k * ACHATADO - (FUNDO + h) * g.k]
  const [mx, my] = no(0.6, 1.2, 0)
  return ossos(g, no, TOM_DO_OSSO, elipse(mx, my, 7 * g.k, 7 * g.k * ACHATADO))
}

/** Os ossos vistos de cima, lá embaixo, entre as tiras do domo. */
function ossosDeCima(g: Gaiola): Desenho[] {
  const no = (x: number, d: number): Ponto => [g.gx + x * g.k, g.gy + d * g.k]
  return ossos(g, no, TOM_DO_OSSO_DE_CIMA, elipse(...no(0.6, 1.2), 7 * g.k, 7 * g.k))
}

// ---------- o desenho-base embrulhado ----------

function ehDaPortinhola(mat: MaterialDaPeca, o: OpcoesDaPeca): boolean {
  const s = o.semente
  if (s !== undefined) return s >= PORTINHOLA[0] && s <= PORTINHOLA[1]
  return mat.classe === 'liso' && o.alfa === ALFA_DO_BURACO_DA_CHAVE && o.contorno === 0
}

function montarVersao(versao: Versao): MontarMovel {
  return (c, cena) => {
    const q = quartosDoGiro(c.giro)
    const k = limitar(Math.min(c.w, c.h) / G, ESCALA_MINIMA, ESCALA_MAXIMA)
    const [gx, gy] = girarPonto(GAIOLA_X * c.hw, LINHA_Y * c.hh, q)
    const g: Gaiola = { k, gx, gy, porta: -q * QUARTO }
    const P0 = c.peca
    const naTela = pecaNaTela(P0, q)
    // A última faixa que já recebeu os ossos (a altura do pino dela).
    let faixaComOssos: number | null = null
    // O ferro de cima (o das tiras): a porta aberta vista do alto é dele, não do latão do cadeado que ela substitui.
    let ferroDeCima: MaterialDaPeca | null = null
    const naFaixaAtual = (lista: readonly Desenho[], f: Faixa): void => {
      for (const peca of lista) {
        const copia = naFaixa(peca, f, q === 0)
        if (copia !== null) cena.partes.push(naTela(copia.forma, copia.mat, copia.o))
      }
    }
    const deCimaNoGrupo = (lista: readonly Desenho[], grupo: Forma): void => {
      const [x, y] = [(grupo.b[0] + grupo.b[2]) / 2, (grupo.b[1] + grupo.b[3]) / 2]
      for (const { forma, mat, o } of lista) {
        const doMaterial = o.textura ?? texturaDaClasse(mat.classe)
        const soDeCima: Textura = (u, v, px, py, p, s, escala) => {
          if (p.dy !== 0) {
            s[5] = 0
            return
          }
          if (doMaterial !== null) doMaterial(u, v, px, py, p, s, escala)
        }
        cena.partes.push(P0(presa(forma, x, y), mat, { ...o, textura: soDeCima }))
      }
    }
    const P: CriarPeca = (forma, mat, o = {}) => {
      const s = o.semente
      if (s === PRIMEIRA_TIRA_DE_CIMA) ferroDeCima = mat
      if (versao === 'aberta') {
        if (ehDaPortinhola(mat, o)) {
          const f = s === PORTINHOLA[0] ? faixaAtual(cena) : null
          if (f !== null) naFaixaAtual(portaAberta(g, mat), f)
          return P0(VAZIA(forma), mat, { ...o, alfa: 0 })
        }
        if (s !== undefined && AROS_DA_CINTURA.includes(s)) {
          const f = faixaAtual(cena)
          if (f !== null) {
            const vao = vaoNaCintura(g)
            const guardado = girarForma({ b: vao.b, d: (x, y) => vao.d(x, y - f.z) }, q === 0 ? 0 : 4 - q)
            return P0({ b: forma.b, d: (x, y) => Math.max(forma.d(x, y), -guardado.d(x, y)) }, mat, o)
          }
        }
        if (s === CADEADO_DE_CIMA) {
          deCimaNoGrupo(portaAbertaDeCima(g, ferroDeCima ?? mat), forma)
          return P0(VAZIA(forma), mat, { ...o, alfa: 0 })
        }
      } else if (s !== undefined && s >= FRENTE_DA_TELA[0] && s <= FRENTE_DA_TELA[1]) {
        // Os ossos ficam por cima do fundo e das tiras de trás e por baixo da frente, faixa por faixa.
        const f = faixaAtual(cena)
        if (f !== null && f.z !== faixaComOssos) {
          faixaComOssos = f.z
          naFaixaAtual(ossosNaTela(g), f)
        }
      } else if (s === PRIMEIRA_TIRA_DE_CIMA) {
        deCimaNoGrupo(ossosDeCima(g), forma)
      }
      return P0(forma, mat, o)
    }
    montarGaiolaSuspensa({ ...c, peca: P }, cena)
  }
}

export const versoesDoGaiolaSuspensa: VersoesDesenhadas = {
  abertaVazia: montarVersao('aberta'),
  comOssos: montarVersao('ossos'),
}
