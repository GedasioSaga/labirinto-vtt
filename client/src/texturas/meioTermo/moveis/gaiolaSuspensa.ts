/**
 * GAIOLA SUSPENSA de cima com volume (lote 14 dos objetos novos, 11/11/2026, grupo Sala de tortura; pedido do
 * mestre: "coloca uns equipamentos de tortura tambem"): a gaiola de ferro estreita, do tamanho de uma pessoa em
 * pé, feita de TIRAS rebitadas em forma de sino, pendurada por uma CORRENTE grossa no BRAÇO de um POSTE de
 * madeira reforçado com ferro (uma forca baixa). Tem uma PORTINHOLA com cadeado e está VAZIA.
 *
 * DE CIMA: a CRUZ do pé (as vigas no chão e as escoras), o capuz de ferro do POSTE, o BRAÇO com as cintas e a
 * GAIOLA vista do alto: as tiras do domo em ESTRELA saindo do capuz, com a luz da curva (claras do lado da luz,
 * escuras do outro: é o que separa o domo de uma roda), o aro do ombro, as tiras dos flancos quase de cutelo até
 * o aro do fundo, o mais largo (o sino abre embaixo), e, pelos vãos, o fundo de chapa lá embaixo, escuro debaixo
 * do domo; ao lado da portinhola, o cadeado de latão. No chão, separada do poste, a SOMBRA da gaiola em grade (as
 * tiras, os aros e o fundo), e as do poste, do braço e da corrente.
 *
 * NA 3/4 a gaiola aparece pendurada, DE FRENTE: o poste em pé na cruz, o braço com a mão-francesa, os elos da
 * corrente e o sino de tiras, com os aros achatados de quem olha de frente e um pouco de cima, as tiras de trás
 * no escuro, o fundo de chapa por dentro e, na frente, a portinhola com as dobradiças e o cadeado. Tudo isso é
 * desenhado na tela da 3/4 (a regra da placa de loja): o desenho é fatiado em faixas de no máximo 24 px, cada
 * faixa guardada no chão da pegada e presa a um PINO (um ponto sem tamanho nem tinta) que a sobe de volta na
 * 3/4; de cima a faixa guardada não pinta (`p.dy` zero). As peças de cima ficam presas a pinos que sobem quase
 * nada e somem na 3/4. As sombras no chão são desenhadas à mão, da geometria de verdade (os aros redondos), e
 * valem para as duas vistas.
 *
 * O GIRO (`c.giro`): a 3/4 recebe o objeto girado e o desenho sai da pegada girada (o braço aponta para o lado,
 * para a frente ou para trás, e a portinhola vai junto); a ordem de pintura troca quando a gaiola fica na frente
 * ou atrás do poste. De cima o giro chega zero (quem gira é a imagem pronta).
 *
 * Material: `madeira` (o poste, o braço e a cruz). O ferro, a ferrugem e o latão do cadeado são fixos. Escreve
 * `cena.corDoPiso` (o escuro do ferro, como a placa de loja). Os lugares são frações da pegada (1 x 1 casa de
 * partida) e as medidas, inclusive as alturas, têm o tamanho do menor lado, preso entre 0,8 e 1,5.
 */
import { rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, cadeia, caixa, capsula, elipse, menos, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { G, QUARTO, type MontarMovel } from './contexto'

// ---------- os materiais fixos ----------

/** O ferro batido das tiras, do braço e das cintas (o da placa de loja). */
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.9)) }
/** O latão do cadeado, escurecido. */
const LATAO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('latao', 0.82)) }
/** O escuro do buraco da chave e da sombra pintada de cima. */
const ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [0x1e, 0x18, 0x14] }
/** A ferrugem da âncora: marrom-alaranjado, não laranja; no miolo da mancha ainda sobra o ferro de baixo. */
const FERRUGEM: Rgb = rgb('#935f47')
const FERRUGEM_CHEIA = 0.8
/** Quanto de ferrugem: a gaiola, exposta ao tempo, mais que as cintas do poste. */
const FERRUGEM_DA_GAIOLA = 0.24
const FERRUGEM_DAS_CINTAS = 0.16
/** O brilho do ferro velho, bem abaixo do metal novo (0,42). */
const BRILHO_DO_FERRO = 0.24
/** O escuro em que o pixel escuro demais é levantado: o cinza-escuro quente da placa de loja. */
const ESCURO_DO_FERRO: Rgb = rgb('#4a4541')

// ---------- o lugar (frações da meia pegada) ----------

/** O poste a oeste, a gaiola a leste, os dois na mesma linha, um pouco ao norte (as sombras caem para o sul). */
const POSTE_X = -0.66
const GAIOLA_X = 0.12
const LINHA_Y = -0.25

// ---------- as medidas (px na gaiola de 1 casa) ----------

const ESCALA_MINIMA = 0.8
const ESCALA_MAXIMA = 1.5
/** A cruz do pé: meio comprimento de cada viga, meia largura e altura; as escoras (onde pegam na viga e a altura em que entram no poste). */
const VIGA_DA_CRUZ = 9.5
const MEIA_VIGA = 2.3
const ALTURA_DA_CRUZ = 4
const PE_DA_ESCORA = 7.4
const ALTO_DA_ESCORA = 17
const RAIO_DA_ESCORA = 1.15
/** O poste: meio lado e altura; as cintas de ferro (a do pé e as de cima), a sobra delas e a meia largura. */
const MEIO_POSTE = 3.3
const ALTURA_DO_POSTE = 106
const CINTAS_DO_POSTE: readonly number[] = [ALTURA_DA_CRUZ + 1.6, 34, 66, 94]
const SOBRA_DA_CINTA = 0.45
const MEIA_CINTA = 1.25
/** O lábio do capuz do poste, que desce pela frente. */
const LABIO_DO_CAPUZ = 2.6
/** O braço: a altura do meio, a meia grossura, quanto passa do poste para trás e da gaiola para a frente. */
const ALTURA_DO_BRACO = 100
const MEIO_BRACO = 2.4
const RABO_DO_BRACO = 0.8
const PONTA_DO_BRACO = 3.6
/** As cintas do braço: a meia largura delas ao comprido e a distância da ponta. */
const MEIA_CINTA_DO_BRACO = 1.1
const CINTA_DA_PONTA = 1.6
/** O olhal debaixo do braço, onde a corrente pega: o raio de fora e o de dentro. */
const OLHO_DO_BRACO = 1.8
const DENTRO_DO_OLHO = 0.85
/** A mão-francesa: a altura em que sai do poste, quanto anda pelo braço e o raio. */
const PE_DA_MAO = 70
const ALCANCE_DA_MAO = 13
const RAIO_DA_MAO = 1.45
/** A gaiola: as alturas do fundo, da cintura, do ombro e do alto do domo, e os raios no fundo, na cintura e no ombro (o sino abre embaixo). */
const FUNDO = 14
const CINTURA = 40
const OMBRO = 64
const TOPO = 76
const RAIO_DO_FUNDO = 12.2
const RAIO_DA_CINTURA = 9.4
const RAIO_DO_OMBRO = 9.8
/** O achatado dos aros na 3/4: o sino é visto de frente e um pouco de cima. */
const ACHATADO = 0.36
/** As tiras: quantas, a meia largura; a meia largura dos aros. */
const TIRAS = 8
const MEIA_TIRA = 0.95
const MEIO_ARO = 1.05
/** Quantos passos tem o perfil do sino (o corpo e o domo) e cada aro. */
const PASSOS_DO_CORPO = 10
const PASSOS_DO_DOMO = 8
const PASSOS_DO_ARCO = 18
const PASSOS_DA_PORTA = 8
/** Uma tira conta como de trás com o cosseno abaixo disto (a de lado fica na frente); o rebite só aparece na que está bem de frente. */
const QUASE_DE_LADO = 0.05
const REBITE_A_VISTA = 0.25
/** O tom das tiras de trás (vistas por dentro, no escuro), o do fundo de chapa e quanto a luz da esquerda clareia as tiras da frente. */
const TOM_DE_TRAS = 0.6
const TOM_DO_FUNDO = 0.62
const TOM_DO_FUNDO_DE_CIMA = 0.5
const LUZ_DE_LADO = 0.12
/** A portinhola: o pé e o alto dela, quanto o caixilho fica para fora das tiras, as dobradiças e a altura do cadeado. */
const PE_DA_PORTA = 22
const ALTO_DA_PORTA = 54
const SOBRA_DA_PORTA = 0.7
const DOBRADICAS: readonly number[] = [27, 49]
const ALTURA_DO_CADEADO = 38
/** O cadeado visto de cima: quanto o meio dele fica para fora do caixilho da portinhola. */
const CADEADO_DE_CIMA = 1
/**
 * De cima os aros (cintas de ferro em pé) aparecem de cutelo, finos, e as tiras dos lados do sino quase de
 * cutelo, mais escuras; só as do domo aparecem deitadas, com a luz da curva. Sem isso a gaiola vista do alto
 * era uma roda de carroça.
 */
const ARO_DE_CIMA = 0.5
const TOM_DO_FLANCO = 0.72
/** As tiras do domo de cima, deitadas, aparecem mais largas que as da 3/4 (que estão de perfil nas beiradas). */
const TIRA_DO_DOMO_DE_CIMA = 1.35
/** A direção da luz do motor (a mesma de `motor.ts`) e quanto a curva do domo muda a luz das tiras dele. */
const LUZ_X = -0.62
const LUZ_Y = -0.48
const LUZ_Z = 0.62
const GANHO_DO_DOMO = 0.85
/** O fundo visto por entre as tiras: escuro embaixo do domo, um pouco menos na beirada, onde a luz entra de lado. */
const SOMBRA_DO_DOMO_NO_FUNDO = 0.3
/** O capuz do alto do domo (o raio e o achatado na 3/4) e a altura do olhal da corrente acima dele. */
const RAIO_DO_CAPUZ = 2.6
const CAPUZ_ACHATADO = 0.55
const OLHAL = 2.8
const OLHAL_X = 1.45
const OLHAL_Y = 1.9
/** A corrente: o passo dos elos e a meia grossura do ferro do elo. */
const PASSO_DO_ELO = 3.2
const FERRO_DO_ELO = 0.55
/** Os tons das faces na tela: a frente no escuro (o da 3/4 derivada) e o alto na luz. */
const TOM_DA_FRENTE = 0.76
const TOM_DO_ALTO = 1.04
/** A sombra do braço que cai no domo, na vista de cima: a altura entre os dois e a força. */
const SOMBRA_DO_BRACO_NO_DOMO = 0.3
/** As forças das sombras desenhadas no chão. */
const SOMBRA_DO_POSTE = 0.28
const SOMBRA_DO_BRACO = 0.26
const SOMBRA_DA_MAO = 0.22
const SOMBRA_DA_GRADE = 0.26
const SOMBRA_DO_FUNDO = 0.3
const SOMBRA_DA_CORRENTE = 0.18
const SOMBRA_DO_PE = 0.34

// ---------- a fatia e os pinos (a regra da placa de loja e da gaiola com aves) ----------

const FATIA_MAXIMA = 24
/** Quanto uma fatia passa por cima da vizinha: sem isso sobraria um fio de chão entre as duas. */
const EMENDA = 0.2
/** Até onde a forma de uma fatia continua valendo depois do corte: mais que o alcance do passo do chanfro. */
const FOLGA_DO_CORTE = 3
const FORA_DA_FAIXA = 1e3
/** A última fatia fica guardada isto abaixo do lugar da tela (as outras, mais): todas sobem na 3/4. */
const FOLGA_DA_GUARDA = 2
const RAIO_DO_PINO = 1e-6
const FORA_DO_PINO = 1e3
const BORDA_DO_PINO = 0.05
/** O pino fica um tanto ao lado do meio do grupo (nenhuma peça tem o meio da caixa nele por acaso) e cada fatia tem o seu. */
const DESVIO_DO_PINO = 0.37
const PASSO_DO_PINO = 0.5
/** O que só aparece de cima sobe quase nada na 3/4: o bastante para sair do lugar e sumir. */
const QUASE_NADA = 0.02

/** As quatro pontas da cruz: norte, oeste, leste e sul (a ordem de pintura na 3/4). */
const PONTAS: readonly Ponto[] = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
]

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

function suave01(t: number): number {
  const u = limitar(t, 0, 1)
  return u * u * (3 - 2 * u)
}

/** O raio do corpo do sino na altura `z` (do fundo ao ombro): abre embaixo, afina na cintura, alarga um pouco no ombro. */
function raioDoCorpo(z: number): number {
  if (z <= CINTURA) return RAIO_DO_FUNDO + (RAIO_DA_CINTURA - RAIO_DO_FUNDO) * suave01((z - FUNDO) / (CINTURA - FUNDO))
  return RAIO_DA_CINTURA + (RAIO_DO_OMBRO - RAIO_DA_CINTURA) * suave01((z - CINTURA) / (OMBRO - CINTURA))
}

/** O perfil do sino: pares (altura, raio) do fundo ao alto do domo, na gaiola de 1 casa. */
function perfilDoSino(): Ponto[] {
  const pares: Ponto[] = []
  for (let i = 0; i <= PASSOS_DO_CORPO; i += 1) {
    const z = FUNDO + ((OMBRO - FUNDO) * i) / PASSOS_DO_CORPO
    pares.push([z, raioDoCorpo(z)])
  }
  for (let i = 1; i <= PASSOS_DO_DOMO; i += 1) {
    const fi = (Math.PI / 2) * (i / PASSOS_DO_DOMO)
    pares.push([OMBRO + (TOPO - OMBRO) * Math.sin(fi), RAIO_DO_OMBRO * Math.cos(fi)])
  }
  return pares
}

const PERFIL_DO_SINO: readonly Ponto[] = perfilDoSino()
/** Os aros: o do fundo, o da cintura e o do ombro (altura, raio). */
const AROS: readonly Ponto[] = [
  [FUNDO, RAIO_DO_FUNDO],
  [CINTURA, RAIO_DA_CINTURA],
  [OMBRO, RAIO_DO_OMBRO],
]

/** A ferrugem em manchas (a da âncora), nunca em listras: onde o ruído passa do limiar o tom vai para a ferrugem. */
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

/** A luz no domo visto de cima: o lado da luz (em cima, à esquerda) claro, o outro escuro, e mais escuro para a beira, onde a tira desce. */
function texDoDomo(cx: number, cy: number, raio: number): Textura {
  const ferrugem = texFerrugem(FERRUGEM_DA_GAIOLA)
  return (u, v, x, y, p, s, escala) => {
    ferrugem(u, v, x, y, p, s, escala)
    const nx = (x - cx) / raio
    const ny = (y - cy) / raio
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
    s[3] += (nx * LUZ_X + ny * LUZ_Y + nz * LUZ_Z - LUZ_Z) * GANHO_DO_DOMO
  }
}

/** O fundo de chapa visto de cima por dentro da gaiola: a sombra do domo escurece o meio e solta a beirada. */
function texDoFundo(cx: number, cy: number, raioDoDomo: number): Textura {
  const ferrugem = texFerrugem(FERRUGEM_DA_GAIOLA + 0.1)
  return (u, v, x, y, p, s, escala) => {
    ferrugem(u, v, x, y, p, s, escala)
    const r = Math.hypot(x - cx, y - cy) / raioDoDomo
    s[3] -= SOMBRA_DO_DOMO_NO_FUNDO * (1 - suave01(r))
  }
}

// ---------- o giro ----------

function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto girado `q` quartos de volta no sentido da tela, como o `girarPonto` de `tresQuartos.ts`. */
function girarPonto(x: number, y: number, q: number): Ponto {
  return q === 1 ? [-y, x] : q === 2 ? [-x, -y] : q === 3 ? [y, -x] : [x, y]
}

/** A forma girada `q` quartos de volta, como o `girarForma` de `tresQuartos.ts`. */
function girarForma(f: Forma, q: number): Forma {
  if (q === 0) return f
  const b = f.b
  const girada: Caixa = q === 1 ? [-b[3], b[0], -b[1], b[2]] : q === 2 ? [-b[2], -b[3], -b[0], -b[1]] : [b[1], -b[2], b[3], -b[0]]
  const volta = 4 - q
  return {
    b: girada,
    d: (x, y) => {
      const [mx, my] = girarPonto(x, y, volta)
      return f.d(mx, my)
    },
  }
}

/** A fábrica de peças de quem desenha na pegada girada: a peça sai desgirada (a forma, o veio e o ponto que a textura lê) e a volta da 3/4 a põe de novo como foi desenhada. */
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

// ---------- o pino, a peça presa e a fatia ----------

/** O pino: um tampo solto de um ponto só, sem sombra nem tinta, que dá à 3/4 a altura e a ordem do grupo. */
function pino(cena: Cena, x: number, y: number, z: number): void {
  const ponto: Forma = { b: [x, y, x, y], d: (px, py) => (Math.abs(px - x) < RAIO_DO_PINO && Math.abs(py - y) < RAIO_DO_PINO ? -1 : FORA_DO_PINO) }
  cena.sombras.push({ forma: ponto, z, solta: true, forca: 0, suave: BORDA_DO_PINO })
}

/** A mesma forma com a caixa de pintura centrada em (cx, cy): é o meio da caixa que a 3/4 lê para achar o pino. */
function presa(forma: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - forma.b[0], forma.b[2] - cx)
  const my = Math.max(cy - forma.b[1], forma.b[3] - cy)
  return { b: [cx - mx, cy - my, cx + mx, cy + my], d: (x, y) => forma.d(x, y) }
}

/** A peça só é pintada com `dy` zero: a de cima some quando a 3/4 a sobe. */
function soNoLugar(textura: Textura | null): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (p.dy !== 0) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

/** A peça de uma vista só não tem deslocamento nem sombra própria (a sombra dela cairia na outra vista). */
type OpcoesDaFace = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'ruga' | 'curvaY'>

interface Desenho {
  readonly forma: Forma
  readonly mat: MaterialDaPeca
  readonly o: OpcoesDaFace
}

type Por = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaFace) => void

function caixaDe(lista: readonly Desenho[]): Caixa {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const { forma } of lista) {
    x0 = Math.min(x0, forma.b[0])
    y0 = Math.min(y0, forma.b[1])
    x1 = Math.max(x1, forma.b[2])
    y1 = Math.max(y1, forma.b[3])
  }
  return [x0, y0, x1, y1]
}

/** Põe as peças só na vista de cima, num grupo preso a um pino no meio delas. */
function porDeCima(P: CriarPeca, cena: Cena, lista: readonly Desenho[]): void {
  if (lista.length === 0) return
  const b = caixaDe(lista)
  const x = (b[0] + b[2]) / 2 + DESVIO_DO_PINO
  const y = (b[1] + b[3]) / 2
  pino(cena, x, y, QUASE_NADA)
  for (const { forma, mat, o } of lista) cena.partes.push(P(presa(forma, x, y), mat, { ...o, textura: soNoLugar(o.textura ?? texturaDaClasse(mat.classe)) }))
}

/**
 * A cópia da peça da tela que cabe na fatia [de, ate], guardada `z` abaixo, ou nada se a peça não passa por
 * ela. A forma é a peça inteira (o chanfro e o contorno não sabem do corte); a textura esconde o que passa da
 * fatia e devolve ao material as coordenadas da tela. `soNaTresQuartos`: de cima a cópia não foi subida
 * (`p.dy` é zero) e some inteira.
 */
function naFatia(peca: Desenho, de: number, ate: number, z: number, ancora: Ponto, soNaTresQuartos: boolean): Desenho | null {
  const f = peca.forma
  const visivel0 = Math.max(de, f.b[1]) + z - EMENDA
  const visivel1 = Math.min(ate, f.b[3]) + z + EMENDA
  if (visivel1 - visivel0 <= 2 * EMENDA) return null
  const corte0 = visivel0 - FOLGA_DO_CORTE
  const corte1 = visivel1 + FOLGA_DO_CORTE
  const guardada: Forma = { b: [f.b[0], corte0, f.b[2], corte1], d: (x, y) => (y < corte0 || y > corte1 ? FORA_DA_FAIXA : f.d(x, y - z)) }
  const eixo = peca.o.eixo ?? 0
  const du = -z * Math.sin(eixo)
  const dv = -z * Math.cos(eixo)
  const doMaterial = peca.o.textura ?? texturaDaClasse(peca.mat.classe)
  const textura: Textura = (u, v, x, y, p, s, pixels) => {
    if (y < visivel0 || y > visivel1 || (soNaTresQuartos && p.dy === 0)) {
      s[5] = 0
      return
    }
    if (doMaterial !== null) doMaterial(u + du, v + dv, x, y - z, p, s, pixels)
  }
  return { forma: presa(guardada, ancora[0], ancora[1]), mat: peca.mat, o: { ...peca.o, textura } }
}

/** Fatia o desenho da tela em faixas e guarda todas no chão, debaixo da última: cada faixa sobe pelo seu pino. */
function fatiar(P: CriarPeca, cena: Cena, frente: readonly Desenho[], soNaTresQuartos: boolean): void {
  if (frente.length === 0) return
  const b = caixaDe(frente)
  const fatias = Math.ceil((b[3] - b[1]) / FATIA_MAXIMA)
  const altura = (b[3] - b[1]) / fatias
  const guardada = b[3] - altura + FOLGA_DA_GUARDA
  const xDoPino = (b[0] + b[2]) / 2 + DESVIO_DO_PINO
  for (let j = 0; j < fatias; j += 1) {
    const de = b[1] + altura * j
    const z = guardada - de
    const ancora: Ponto = [xDoPino + j * PASSO_DO_PINO, guardada + altura / 2]
    pino(cena, ancora[0], ancora[1], z)
    for (const peca of frente) {
      const copia = naFatia(peca, de, de + altura, z, ancora, soNaTresQuartos)
      if (copia !== null) cena.partes.push(P(copia.forma, copia.mat, copia.o))
    }
  }
}

// ---------- a planta (a pegada girada, que é o chão da tela da 3/4) ----------

interface Planta {
  /** O tamanho do desenho: 1 na gaiola de 1 casa. */
  readonly k: number
  readonly mad: MaterialDaPeca
  /** O meio do pé do poste e o eixo da gaiola, na pegada girada. */
  readonly poste: Ponto
  readonly gaiola: Ponto
  /** Para onde o braço aponta, na pegada girada (de quarto em quarto). */
  readonly rumo: Ponto
  /** Do meio do poste ao eixo da gaiola. */
  readonly vao: number
  /** O ângulo da portinhola (0 = virada para a frente da tela). */
  readonly porta: number
}

/** O ponto `t` px adiante do meio do poste, no rumo do braço. */
function noRumo(pl: Planta, t: number): Ponto {
  return [pl.poste[0] + pl.rumo[0] * t, pl.poste[1] + pl.rumo[1] * t]
}

/** O ponto (x, y) da pegada girada, a `z` do chão, na tela da 3/4. */
function naTela(x: number, y: number, z: number): Ponto {
  return [x, y - z]
}

/** Onde cai no chão a sombra do ponto (x, y) a `z` do chão. */
function noChao(x: number, y: number, z: number): Ponto {
  return [x + SOMBRA_X * z, y + SOMBRA_Y * z]
}

/** A caixa (na pegada girada) do trecho do braço de `t0` a `t1`, com meia largura `meia`. */
function trecho(pl: Planta, t0: number, t1: number, meia: number): Caixa {
  const [ax, ay] = noRumo(pl, t0)
  const [bx, by] = noRumo(pl, t1)
  const px = -pl.rumo[1] * meia
  const py = pl.rumo[0] * meia
  const xs = [ax + px, ax - px, bx + px, bx - px]
  const ys = [ay + py, ay - py, by + py, by - py]
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

/** O bloco de pé (a caixa `b` da pegada girada, de `z0` a `z1`) na tela: a frente e o alto. */
function bloco(b: Caixa, z0: number, z1: number): { readonly frente: Forma; readonly alto: Forma } {
  return { frente: caixa(b[0], b[3] - z1, b[2], b[3] - z0), alto: caixa(b[0], b[1] - z1, b[2], b[3] - z1) }
}

/** As cintas do braço, em px adiante do meio do poste: junto do poste, na mão-francesa e na ponta. */
function cintasDoBraco(pl: Planta): number[] {
  const a = MEIO_POSTE * pl.k
  return [a + CINTA_DA_PONTA * pl.k, a + ALCANCE_DA_MAO * pl.k, pl.vao + (PONTA_DO_BRACO - CINTA_DA_PONTA) * pl.k]
}

function cabecaDeRebite(x: number, y: number, r: number): Desenho {
  return { forma: elipse(x, y, r, r), mat: FERRO, o: { tabua: 0, bisel: r * 0.85, tom: 1.25, contorno: 0.26, metal: 0.42 } }
}

function rebite(por: Por, x: number, y: number, r: number): void {
  const d = cabecaDeRebite(x, y, r)
  por(d.forma, d.mat, d.o)
}

function deFerro(k: number, tom: number, semente: number, quanto: number): OpcoesDaFace {
  return { tabua: 0, bisel: 0.6 * k, tom, contorno: 0.28, metal: BRILHO_DO_FERRO, textura: texFerrugem(quanto), semente }
}

// ---------- a 3/4 (na tela, de trás para a frente) ----------

/** Uma escora do pé: da viga, na ponta (dx, dy), até a face do poste. */
function escora(pl: Planta, por: Por, dx: number, dy: number, semente: number): void {
  const { k } = pl
  const [cx, cy] = pl.poste
  const pe = PE_DA_ESCORA * k
  const a = MEIO_POSTE * k
  const de = naTela(cx + dx * pe, cy + dy * pe, ALTURA_DA_CRUZ * k)
  const ate = naTela(cx + dx * a, cy + dy * a, ALTO_DA_ESCORA * k)
  por(cadeia([de, ate], RAIO_DA_ESCORA * k), pl.mad, { tabua: 0, bisel: RAIO_DA_ESCORA * k, tom: 0.9, contorno: 0.26, semente })
}

/** A cruz do pé, de trás para a frente, e as escoras que o poste esconde ou que ficam do lado dele. */
function cruzAtras(pl: Planta, por: Por): void {
  const { k, mad } = pl
  const [cx, cy] = pl.poste
  const v = VIGA_DA_CRUZ * k
  const w = MEIA_VIGA * k
  const h = ALTURA_DA_CRUZ * k
  const viga = (b: Caixa, eixo: number, semente: number): void => {
    const { frente, alto } = bloco(b, 0, h)
    por(frente, mad, { tabua: 0, bisel: 0.6, tom: TOM_DA_FRENTE, contorno: 0.24, semente })
    por(alto, mad, { eixo, tabua: 0, bisel: 0.7, tom: TOM_DO_ALTO, contorno: 0.24, semente: semente + 1 })
    // O parafuso que chumba a ponta da viga no chão.
    const [px, py] = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]
    const fora = v - CINTA_DA_PONTA * k
    if (Math.abs(px - cx) > w || Math.abs(py - cy) > w) {
      const [ux, uy] = [Math.sign(px - cx), Math.sign(py - cy)]
      rebite(por, ...naTela(cx + ux * fora, cy + uy * fora, h), 0.75 * k)
    }
  }
  viga([cx - w, cy - v, cx + w, cy - w], QUARTO, 8000)
  escora(pl, por, 0, -1, 8002)
  viga([cx - v, cy - w, cx - w, cy + w], 0, 8004)
  viga([cx + w, cy - w, cx + v, cy + w], 0, 8006)
  viga([cx - w, cy - w, cx + w, cy + w], 0, 8008)
  escora(pl, por, -1, 0, 8010)
  escora(pl, por, 1, 0, 8011)
  viga([cx - w, cy + w, cx + w, cy + v], QUARTO, 8012)
}

/** O poste em pé na cruz: a frente de veio em pé, o alto, as cintas rebitadas e o capuz de ferro com o lábio. */
function poste(pl: Planta, por: Por): void {
  const { k, mad } = pl
  const [cx, cy] = pl.poste
  const a = MEIO_POSTE * k
  const zt = ALTURA_DO_POSTE * k
  const { frente, alto } = bloco([cx - a, cy - a, cx + a, cy + a], ALTURA_DA_CRUZ * k, zt)
  por(frente, mad, { eixo: QUARTO, tabua: 0, bisel: 0.9, tom: TOM_DA_FRENTE + 0.04, contorno: 0.26, semente: 8100 })
  por(alto, mad, { tabua: 0, bisel: 0.7, tom: TOM_DO_ALTO, contorno: 0.24, semente: 8101 })
  const sobra = SOBRA_DA_CINTA * k
  const meia = MEIA_CINTA * k
  CINTAS_DO_POSTE.forEach((zc, i) => {
    const y = cy + a - zc * k
    por(caixa(cx - a - sobra, y - meia, cx + a + sobra, y + meia, 0.3 * k), FERRO, deFerro(k, 0.98, 8110 + i, FERRUGEM_DAS_CINTAS))
    for (const f of [-0.52, 0.52]) rebite(por, cx + a * f, y, 0.5 * k)
  })
  por(caixa(cx - a - sobra, cy + a - zt, cx + a + sobra, cy + a - zt + LABIO_DO_CAPUZ * k, 0.3 * k), FERRO, deFerro(k, 0.9, 8120, FERRUGEM_DAS_CINTAS))
  por(caixa(cx - a - sobra, cy - a - zt - sobra, cx + a + sobra, cy + a - zt, 0.8 * k), FERRO, { ...deFerro(k, 1.1, 8121, FERRUGEM_DAS_CINTAS), bisel: 1.4 * k })
  rebite(por, cx, cy - zt, 0.75 * k)
  for (const f of [-0.55, 0.55]) rebite(por, cx + a * f, cy + a - zt + LABIO_DO_CAPUZ * 0.5 * k, 0.45 * k)
}

/** O braço: a viga deitada (inteira, ou só o que sai da face do poste quando ele aponta para a frente), as cintas e o olhal da corrente. */
function braco(pl: Planta, por: Por, inteiro: boolean): void {
  const { k, mad } = pl
  const a = MEIO_POSTE * k
  const s = MEIO_BRACO * k
  const zb = ALTURA_DO_BRACO * k
  const t1 = pl.vao + PONTA_DO_BRACO * k
  const { frente, alto } = bloco(trecho(pl, inteiro ? -(a + RABO_DO_BRACO * k) : a, t1, s), zb - s, zb + s)
  por(frente, mad, { tabua: 0, bisel: 0.7, tom: TOM_DA_FRENTE, contorno: 0.26, semente: 8200 })
  por(alto, mad, { eixo: pl.rumo[0] !== 0 ? 0 : QUARTO, tabua: 0, bisel: 0.8, tom: TOM_DO_ALTO, contorno: 0.24, semente: 8201 })
  const sobra = SOBRA_DA_CINTA * k
  const meia = MEIA_CINTA_DO_BRACO * k
  cintasDoBraco(pl).forEach((t, i) => {
    const b = trecho(pl, t - meia, t + meia, s + sobra)
    const cinta = bloco(b, zb - s - sobra, zb + s + sobra)
    por(cinta.frente, FERRO, deFerro(k, 0.92, 8210 + i, FERRUGEM_DAS_CINTAS))
    por(cinta.alto, FERRO, deFerro(k, 1.08, 8220 + i, FERRUGEM_DAS_CINTAS))
    rebite(por, (b[0] + b[2]) / 2, b[3] - zb, 0.5 * k)
  })
  const [gx, gy] = pl.gaiola
  rebite(por, ...naTela(gx, gy, zb + s), 0.8 * k)
  const [ox, oy] = naTela(gx, gy, zb - s - OLHO_DO_BRACO * k)
  por(anel(ox, oy, OLHO_DO_BRACO * k, OLHO_DO_BRACO * k, DENTRO_DO_OLHO * k, DENTRO_DO_OLHO * k), FERRO, { ...deFerro(k, 1.05, 8230, FERRUGEM_DAS_CINTAS), bisel: 0.5 * k })
}

/** A mão-francesa: a escora inclinada entre o poste e o braço, com os pregos de ferro nas pontas. */
function maoFrancesa(pl: Planta, por: Por): void {
  const { k } = pl
  const a = MEIO_POSTE * k
  const de = naTela(...noRumo(pl, a), PE_DA_MAO * k)
  const ate = naTela(...noRumo(pl, a + ALCANCE_DA_MAO * k), (ALTURA_DO_BRACO - MEIO_BRACO) * k)
  por(cadeia([de, ate], RAIO_DA_MAO * k), pl.mad, { tabua: 0, bisel: RAIO_DA_MAO * k, tom: 0.88, contorno: 0.26, semente: 8300 })
  for (const [x, y] of [de, ate]) rebite(por, x, y, 0.6 * k)
}

/** O alto e o pé da corrente: do olhal do braço ao olhal do domo. */
function alturasDaCorrente(k: number): readonly [number, number] {
  return [(ALTURA_DO_BRACO - MEIO_BRACO - 2 * OLHO_DO_BRACO) * k, (TOPO + OLHAL + OLHAL_Y) * k]
}

/** A corrente: os elos alternam de frente (o aro) e de lado (o risco). */
function corrente(pl: Planta, por: Por): void {
  const { k } = pl
  const [gx, gy] = pl.gaiola
  const [alto, baixo] = alturasDaCorrente(k)
  const elos = Math.max(2, Math.round((alto - baixo) / (PASSO_DO_ELO * k)))
  const passo = (alto - baixo) / elos
  for (let i = 0; i < elos; i += 1) {
    const [x, y] = naTela(gx, gy, alto - passo * (i + 0.5))
    const deFrente = i % 2 === 0
    const elo = deFrente ? anel(x, y, 1.3 * k, passo * 0.62, FERRO_DO_ELO * k, passo * 0.3) : capsula(x, y - passo * 0.55, x, y + passo * 0.55, FERRO_DO_ELO * k)
    por(elo, FERRO, { ...deFerro(k, deFrente ? 1.05 : 0.85, 8310 + i, FERRUGEM_DAS_CINTAS), bisel: 0.5 * k, metal: 0.32 })
  }
}

type NaGaiola = (teta: number, z: number, r: number) => Ponto

/** Os ângulos das tiras em volta do sino: a portinhola fica entre as duas primeiras. */
function angulosDasTiras(pl: Planta): number[] {
  return Array.from({ length: TIRAS }, (_, i) => pl.porta + Math.PI / TIRAS + (2 * Math.PI * i) / TIRAS)
}

/** A portinhola entre as duas tiras da frente: o caixilho, a barra do meio, as dobradiças e o cadeado no ferrolho. */
function portinhola(pl: Planta, por: Por, naGaiola: NaGaiola, tom: number): void {
  const { k } = pl
  const t0 = pl.porta - Math.PI / TIRAS
  const t1 = pl.porta + Math.PI / TIRAS
  const r = (z: number): number => raioDoCorpo(z) + SOBRA_DA_PORTA
  const op = (semente: number, fator = 1): OpcoesDaFace => ({ ...deFerro(k, tom * fator, semente, FERRUGEM_DAS_CINTAS), bisel: 0.7 * k })
  const deLado = (teta: number): Forma => {
    const pontos: Ponto[] = []
    for (let i = 0; i <= PASSOS_DA_PORTA; i += 1) {
      const z = PE_DA_PORTA + ((ALTO_DA_PORTA - PE_DA_PORTA) * i) / PASSOS_DA_PORTA
      pontos.push(naGaiola(teta, z, r(z)))
    }
    return cadeia(pontos, MEIA_TIRA * 1.15 * k)
  }
  const deTraves = (z: number): Forma => {
    const pontos: Ponto[] = []
    for (let i = 0; i <= PASSOS_DA_PORTA; i += 1) pontos.push(naGaiola(t0 + ((t1 - t0) * i) / PASSOS_DA_PORTA, z, r(z)))
    return cadeia(pontos, MEIO_ARO * 1.1 * k)
  }
  por(deLado(pl.porta), FERRO, op(8500, 0.94))
  por(deLado(t0), FERRO, op(8501))
  por(deLado(t1), FERRO, op(8502))
  por(deTraves(PE_DA_PORTA), FERRO, op(8503))
  por(deTraves(ALTO_DA_PORTA), FERRO, op(8504))
  for (const z of DOBRADICAS) {
    const [x, y] = naGaiola(t0, z, r(z) + SOBRA_DA_PORTA)
    por(capsula(x, y - 1.7 * k, x, y + 1.7 * k, 0.85 * k), FERRO, op(8505, 1.1))
  }
  // O ferrolho no caixilho e o cadeado de latão pendurado nele, com o buraco da chave.
  const [hx, hy] = naGaiola(t1, ALTURA_DO_CADEADO, r(ALTURA_DO_CADEADO) + SOBRA_DA_PORTA)
  por(caixa(hx - 1.1 * k, hy - 1.6 * k, hx + 1.1 * k, hy + 1.6 * k, 0.4 * k), FERRO, op(8506, 1.05))
  por(anel(hx, hy + 1.7 * k, 1.15 * k, 1.25 * k, 0.55 * k, 0.65 * k), FERRO, op(8507, 1.15))
  por(caixa(hx - 1.7 * k, hy + 2.5 * k, hx + 1.7 * k, hy + 6.1 * k, 0.9 * k), LATAO, { tabua: 0, bisel: 1.1 * k, tom, contorno: 0.28, metal: 0.38, semente: 8508 })
  por(elipse(hx, hy + 4.1 * k, 0.4 * k, 0.65 * k), ESCURO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.8 })
}

/** O sino de tiras: as de trás no escuro, o fundo de chapa por dentro, os aros, as tiras da frente, os rebites, a portinhola e o capuz. */
function gaiola(pl: Planta, por: Por): void {
  const { k } = pl
  const [gx, gy] = pl.gaiola
  const naGaiola: NaGaiola = (teta, z, r) => [gx + r * k * Math.sin(teta), gy + r * k * ACHATADO * Math.cos(teta) - z * k]
  const tira = (teta: number): Forma => cadeia(PERFIL_DO_SINO.map(([z, r]) => naGaiola(teta, z, r)), MEIA_TIRA * k)
  const arco = (z: number, r: number, de: number, ate: number): Forma => {
    const pontos: Ponto[] = []
    for (let i = 0; i <= PASSOS_DO_ARCO; i += 1) pontos.push(naGaiola(de + ((ate - de) * i) / PASSOS_DO_ARCO, z, r))
    return cadeia(pontos, MEIO_ARO * k)
  }
  const ferro = (tom: number, semente: number): OpcoesDaFace => ({ ...deFerro(k, tom, semente, FERRUGEM_DA_GAIOLA), bisel: MEIA_TIRA * k, contorno: 0.24 })
  const angulos = angulosDasTiras(pl)
  const portaNaFrente = Math.cos(pl.porta) > -QUASE_DE_LADO

  // 1. O lado de trás, visto por dentro e no escuro: as tiras e as metades de trás dos aros.
  angulos.forEach((t, i) => {
    if (Math.cos(t) < -QUASE_DE_LADO) por(tira(t), FERRO, ferro(TOM_DE_TRAS, 8400 + i))
  })
  AROS.forEach(([z, r], i) => por(arco(z, r, Math.PI / 2, (3 * Math.PI) / 2), FERRO, ferro(TOM_DE_TRAS, 8410 + i)))
  if (!portaNaFrente) portinhola(pl, por, naGaiola, TOM_DE_TRAS)
  // 2. O fundo de chapa, visto de cima por entre as tiras.
  por(elipse(gx, gy - FUNDO * k, RAIO_DO_FUNDO * k, RAIO_DO_FUNDO * k * ACHATADO), FERRO, { ...deFerro(k, TOM_DO_FUNDO, 8420, FERRUGEM_DA_GAIOLA + 0.1), bisel: 0.8 * k, contorno: 0.2 })
  // 3. A frente: as metades da frente dos aros, as tiras (a luz vem da esquerda) e os rebites nos cruzamentos.
  AROS.forEach(([z, r], i) => por(arco(z, r, -Math.PI / 2, Math.PI / 2), FERRO, ferro(1, 8430 + i)))
  angulos.forEach((t, i) => {
    if (Math.cos(t) >= -QUASE_DE_LADO) por(tira(t), FERRO, ferro(1 - LUZ_DE_LADO * Math.sin(t), 8440 + i))
  })
  for (const t of angulos) {
    if (Math.cos(t) < REBITE_A_VISTA) continue
    for (const [z, r] of AROS) rebite(por, ...naGaiola(t, z, r + 0.3), 0.55 * k)
  }
  if (portaNaFrente) portinhola(pl, por, naGaiola, 1)
  // 4. O capuz do alto do domo e o olhal da corrente.
  por(elipse(gx, gy - TOPO * k, RAIO_DO_CAPUZ * k, RAIO_DO_CAPUZ * CAPUZ_ACHATADO * k), FERRO, { ...ferro(1.12, 8450), bisel: 1.2 * k })
  const [ox, oy] = naTela(gx, gy, (TOPO + OLHAL) * k)
  por(anel(ox, oy, OLHAL_X * k, OLHAL_Y * k, 0.65 * k, 1.05 * k), FERRO, { ...ferro(1.05, 8451), bisel: 0.5 * k })
}

// ---------- de cima (sem giro) ----------

function cruzDeCima(pl: Planta): Desenho[] {
  const { k, mad } = pl
  const [cx, cy] = pl.poste
  const v = VIGA_DA_CRUZ * k
  const w = MEIA_VIGA * k
  const a = MEIO_POSTE * k
  const pe = PE_DA_ESCORA * k
  const madeira = (eixo: number, tom: number, semente: number): OpcoesDaFace => ({ eixo, tabua: 0, bisel: 0.8, tom, contorno: 0.26, semente })
  const lista: Desenho[] = [
    { forma: caixa(cx - w, cy - v, cx + w, cy + v, 0.5 * k), mat: mad, o: madeira(QUARTO, 0.96, 8600) },
    { forma: caixa(cx - v, cy - w, cx + v, cy + w, 0.5 * k), mat: mad, o: madeira(0, 1, 8601) },
  ]
  PONTAS.forEach(([dx, dy], i) => {
    lista.push({ forma: capsula(cx + dx * a, cy + dy * a, cx + dx * pe, cy + dy * pe, RAIO_DA_ESCORA * k), mat: mad, o: madeira(dx === 0 ? QUARTO : 0, 1.1, 8602 + i) })
    const fora = v - CINTA_DA_PONTA * k
    lista.push(cabecaDeRebite(cx + dx * fora, cy + dy * fora, 0.75 * k))
  })
  return lista
}

/**
 * A gaiola vista do alto, como quem olha para dentro de um sino de grade: o fundo de chapa lá embaixo, as
 * tiras dos lados quase de cutelo entre o aro do fundo (o mais largo) e o do ombro, as tiras do domo em estrela
 * com a luz da curva, o capuz, o cadeado e a sombra do braço no domo.
 */
function gaiolaDeCima(pl: Planta): Desenho[] {
  const { k } = pl
  const [gx, gy] = pl.gaiola
  const rF = RAIO_DO_FUNDO * k
  const rO = RAIO_DO_OMBRO * k
  const aro = MEIO_ARO * k
  const fino = ARO_DE_CIMA * k
  const ferro = (tom: number, semente: number): OpcoesDaFace => ({ ...deFerro(k, tom, semente, FERRUGEM_DA_GAIOLA), bisel: MEIA_TIRA * k, contorno: 0.24 })
  const angulos = angulosDasTiras(pl)
  const lista: Desenho[] = [{ forma: elipse(gx, gy, rF, rF), mat: FERRO, o: { ...ferro(TOM_DO_FUNDO_DE_CIMA, 8800), bisel: 0.6 * k, textura: texDoFundo(gx, gy, rO) } }]
  angulos.forEach((t, i) => {
    lista.push({ forma: capsula(gx + rO * Math.sin(t), gy + rO * Math.cos(t), gx + rF * Math.sin(t), gy + rF * Math.cos(t), fino * 1.2), mat: FERRO, o: { ...ferro(TOM_DO_FLANCO, 8803 + i), bisel: fino } })
  })
  lista.push({ forma: anel(gx, gy, rF + fino, rF + fino, rF - fino, rF - fino), mat: FERRO, o: { ...ferro(0.84, 8801), bisel: fino } })
  lista.push({ forma: anel(gx, gy, rO + fino, rO + fino, rO - fino, rO - fino), mat: FERRO, o: { ...ferro(0.96, 8802), bisel: fino } })
  angulos.forEach((t, i) => {
    const largura = MEIA_TIRA * TIRA_DO_DOMO_DE_CIMA * k
    lista.push({ forma: capsula(gx, gy, gx + rO * Math.sin(t), gy + rO * Math.cos(t), largura), mat: FERRO, o: { ...ferro(1.08, 8810 + i), bisel: largura, textura: texDoDomo(gx, gy, rO + aro) } })
  })
  for (const t of angulos) lista.push(cabecaDeRebite(gx + rO * Math.sin(t), gy + rO * Math.cos(t), 0.55 * k))
  // O cadeado, pendurado do lado de fora da portinhola, aparece de cima entre o aro do ombro e o do fundo.
  const t1 = pl.porta + Math.PI / TIRAS
  const rC = (raioDoCorpo(ALTURA_DO_CADEADO) + 2 * SOBRA_DA_PORTA + CADEADO_DE_CIMA) * k
  const [px, py] = [gx + rC * Math.sin(t1), gy + rC * Math.cos(t1)]
  lista.push({ forma: caixa(px - 1.7 * k, py - 1.1 * k, px + 1.7 * k, py + 1.1 * k, 0.8 * k), mat: LATAO, o: { tabua: 0, bisel: 0.9 * k, tom: 1, contorno: 0.28, metal: 0.38, semente: 8820 } })
  lista.push({ forma: elipse(gx, gy, RAIO_DO_CAPUZ * k, RAIO_DO_CAPUZ * k), mat: FERRO, o: { ...ferro(1.1, 8821), bisel: 1.3 * k, textura: texDoDomo(gx, gy, rO + aro) } })
  lista.push(cabecaDeRebite(gx, gy, 0.7 * k))
  // A sombra do braço, que passa por cima, cai no domo (só no domo: no chão quem a pinta é a sombra de verdade).
  const altura = (ALTURA_DO_BRACO - MEIO_BRACO - TOPO) * k
  const [ax, ay] = noRumo(pl, -(MEIO_POSTE + RABO_DO_BRACO) * k)
  const [bx, by] = noRumo(pl, pl.vao + PONTA_DO_BRACO * k)
  const faixa = capsula(ax + SOMBRA_X * altura, ay + SOMBRA_Y * altura, bx + SOMBRA_X * altura, by + SOMBRA_Y * altura, MEIO_BRACO * k)
  const domo = elipse(gx, gy, rO + aro, rO + aro)
  lista.push({ forma: menos(faixa, menos(faixa, domo)), mat: ESCURO, o: { tabua: 0, bisel: 0, contorno: 0, alfa: SOMBRA_DO_BRACO_NO_DOMO, suave: 1 } })
  return lista
}

function bracoDeCima(pl: Planta): Desenho[] {
  const { k, mad } = pl
  const s = MEIO_BRACO * k
  const sobra = SOBRA_DA_CINTA * k
  const meia = MEIA_CINTA_DO_BRACO * k
  const b = trecho(pl, -(MEIO_POSTE + RABO_DO_BRACO) * k, pl.vao + PONTA_DO_BRACO * k, s)
  const lista: Desenho[] = [{ forma: caixa(b[0], b[1], b[2], b[3], 0.6 * k), mat: mad, o: { tabua: 0, bisel: 1, tom: 1.06, contorno: 0.26, semente: 8710 } }]
  cintasDoBraco(pl).forEach((t, i) => {
    const c = trecho(pl, t - meia, t + meia, s + sobra)
    lista.push({ forma: caixa(c[0], c[1], c[2], c[3], 0.3 * k), mat: FERRO, o: deFerro(k, 1.08, 8711 + i, FERRUGEM_DAS_CINTAS) })
    lista.push(cabecaDeRebite(...noRumo(pl, t), 0.5 * k))
  })
  lista.push(cabecaDeRebite(...pl.gaiola, 0.8 * k))
  return lista
}

/** O alto do poste: as cintas aparecendo em volta e o capuz de ferro abaulado, com o rebite do meio e os dos cantos. */
function posteDeCima(pl: Planta): Desenho[] {
  const { k } = pl
  const [cx, cy] = pl.poste
  const a = MEIO_POSTE * k
  const sobra = SOBRA_DA_CINTA * k
  const lista: Desenho[] = [
    { forma: caixa(cx - a - sobra * 2, cy - a - sobra * 2, cx + a + sobra * 2, cy + a + sobra * 2, 0.5 * k), mat: FERRO, o: deFerro(k, 0.84, 8720, FERRUGEM_DAS_CINTAS) },
    { forma: caixa(cx - a - sobra, cy - a - sobra, cx + a + sobra, cy + a + sobra, 0.9 * k), mat: FERRO, o: { ...deFerro(k, 1.1, 8721, FERRUGEM_DAS_CINTAS), bisel: 1.6 * k } },
    cabecaDeRebite(cx, cy, 0.8 * k),
  ]
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) lista.push(cabecaDeRebite(cx + dx * a * 0.62, cy + dy * a * 0.62, 0.45 * k))
  return lista
}

// ---------- as sombras no chão (das duas vistas) ----------

function sombrasNoChao(pl: Planta, cena: Cena): void {
  const { k } = pl
  const [cx, cy] = pl.poste
  const [gx, gy] = pl.gaiola
  const a = MEIO_POSTE * k
  const zb = ALTURA_DO_BRACO * k
  const empurrar = (forma: Forma, forca: number, suave: number): void => {
    cena.sombras.push({ forma, z: 0, forca, suave })
  }
  empurrar(capsula(...noChao(cx, cy, ALTURA_DA_CRUZ * k), ...noChao(cx, cy, ALTURA_DO_POSTE * k), a), SOMBRA_DO_POSTE, 1.2)
  const [ax, ay] = noRumo(pl, -(a + RABO_DO_BRACO * k))
  const [bx, by] = noRumo(pl, pl.vao + PONTA_DO_BRACO * k)
  empurrar(capsula(...noChao(ax, ay, zb), ...noChao(bx, by, zb), MEIO_BRACO * k), SOMBRA_DO_BRACO, 1.3)
  const [mx, my] = noRumo(pl, a)
  const [nx, ny] = noRumo(pl, a + ALCANCE_DA_MAO * k)
  empurrar(capsula(...noChao(mx, my, PE_DA_MAO * k), ...noChao(nx, ny, (ALTURA_DO_BRACO - MEIO_BRACO) * k), RAIO_DA_MAO * k), SOMBRA_DA_MAO, 1.1)
  const [alto, baixo] = alturasDaCorrente(k)
  empurrar(capsula(...noChao(gx, gy, baixo), ...noChao(gx, gy, alto), FERRO_DO_ELO * 1.4 * k), SOMBRA_DA_CORRENTE, 0.9)
  // A gaiola: a grade das tiras e dos aros (redondos de verdade) e o fundo de chapa.
  for (const t of angulosDasTiras(pl)) {
    const pontos = PERFIL_DO_SINO.map(([z, r]) => noChao(gx + r * k * Math.sin(t), gy + r * k * Math.cos(t), z * k))
    empurrar(cadeia(pontos, MEIA_TIRA * k), SOMBRA_DA_GRADE, 0.8)
  }
  for (const [z, r] of AROS) {
    const [sx, sy] = noChao(gx, gy, z * k)
    const [fora, dentro] = [(r + MEIO_ARO) * k, (r - MEIO_ARO) * k]
    empurrar(anel(sx, sy, fora, fora, dentro, dentro), SOMBRA_DA_GRADE, 0.8)
  }
  const [fx, fy] = noChao(gx, gy, FUNDO * k)
  empurrar(elipse(fx, fy, RAIO_DO_FUNDO * k, RAIO_DO_FUNDO * k), SOMBRA_DO_FUNDO, 1)
  // O contato da cruz no chão.
  const v = VIGA_DA_CRUZ * k
  const w = MEIA_VIGA * k
  cena.sombras.push(contato(uniao(caixa(cx - v, cy - w, cx + v, cy + w), caixa(cx - w, cy - v, cx + w, cy + v)), SOMBRA_DO_PE))
}

export const montarGaiolaSuspensa: MontarMovel = (c, cena) => {
  const q = quartosDoGiro(c.giro)
  const k = limitar(Math.min(c.w, c.h) / G, ESCALA_MINIMA, ESCALA_MAXIMA)
  const pl: Planta = {
    k,
    mad: c.m.madeira,
    poste: girarPonto(POSTE_X * c.hw, LINHA_Y * c.hh, q),
    gaiola: girarPonto(GAIOLA_X * c.hw, LINHA_Y * c.hh, q),
    rumo: girarPonto(1, 0, q),
    vao: (GAIOLA_X - POSTE_X) * c.hw,
    porta: -q * QUARTO,
  }
  cena.corDoPiso = ESCURO_DO_FERRO

  // 1. As sombras no chão, que as duas vistas mostram.
  sombrasNoChao(pl, cena)

  // 2. De cima (sem giro; girada, a cena só serve à 3/4): a cruz, a gaiola, o braço e o alto do poste.
  if (q === 0) {
    for (const grupo of [cruzDeCima(pl), gaiolaDeCima(pl), bracoDeCima(pl), posteDeCima(pl)]) porDeCima(c.peca, cena, grupo)
  }

  // 3. A 3/4, de trás para a frente. A gaiola atrás do poste (o braço apontando para o fundo) vem antes de tudo;
  // o braço que aponta para a frente sai da face do poste e vem depois dele.
  const frente: Desenho[] = []
  const por: Por = (forma, mat, o) => {
    frente.push({ forma, mat, o })
  }
  if (q === 3) {
    corrente(pl, por)
    gaiola(pl, por)
  }
  cruzAtras(pl, por)
  if (q !== 1) {
    braco(pl, por, true)
    maoFrancesa(pl, por)
  }
  poste(pl, por)
  escora(pl, por, 0, 1, 8013)
  if (q === 1) {
    maoFrancesa(pl, por)
    braco(pl, por, false)
  }
  if (q !== 3) {
    corrente(pl, por)
    gaiola(pl, por)
  }
  fatiar(pecaNaTela(c.peca, q), cena, frente, q === 0)

  // 4. Girada, as sombras (e os pinos, que são sombras) saem desgiradas: a volta da 3/4 as põe no lugar.
  if (q !== 0) {
    cena.sombras.forEach((s, i) => {
      cena.sombras[i] = { ...s, forma: girarForma(s.forma, 4 - q) }
    })
  }
}
