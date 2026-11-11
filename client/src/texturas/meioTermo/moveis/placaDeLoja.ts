/**
 * PLACA DE LOJA PENDURADA (lote 7 dos objetos novos, 11/11/2026): o POSTE de
 * madeira fincado no chão, calçado com três pedras; perto do alto dele, o
 * BRAÇO de ferro forjado, com a mão-francesa em VOLUTA por baixo e a ponta
 * enrolada; e, pendurada no braço por duas CORRENTES, a TABULETA de madeira
 * pintada: o campo verde-escuro com uma CANECA de espuma, sem letra nenhuma
 * (serve para a taverna e para qualquer venda).
 *
 * DE CIMA é vista de cima de verdade, e a placa é fina: o topo do poste entre
 * as pedras, o risco de ferro do braço e a tabuleta de quina debaixo dele. A
 * tabuleta balança um pouco para a frente, e por isso aparece uma NESGA da
 * face pintada (o verde e a caneca, achatados): é a cor que liga esta vista à
 * outra. O que mais diz "placa" de cima é a SOMBRA no chão: a do poste,
 * arrastada, e, deitadas pela luz do motor, a do braço, a das correntes e a
 * da tabuleta. A linha da placa fica um pouco para o fundo da pegada: o
 * desenho de cima fica no meio dela e a sombra cai para a frente.
 *
 * NA 3/4 A TABULETA APARECE DE FRENTE. O poste é uma coluna de verdade (a 3/4
 * o varre do chão; o topo dele é de tora, para a frente sair com as fendas da
 * tora, e não com frestas de tábua). O alto do braço e o da tabuleta sobem
 * para a altura de cada um, presos a uma ÂNCORA (um tampo solto de um quarto
 * de px, sem sombra: a ideia da pedra de amolar e do suporte de armas). A
 * voluta, as correntes, as abraçadeiras e a face pintada são desenhadas de
 * frente, na tela da 3/4, e FATIADAS, cada fatia presa à âncora dela.
 *
 * Aqui não há tampo fechado para guardar as fatias na vista de cima, então a
 * peça SE ESCONDE SOZINHA: a textura dela lê `p.dy`, que só deixa de ser zero
 * quando a 3/4 sobe a peça (`tresQuartos.ts`). A fatia da frente devolve alfa
 * zero de cima; a nesga da face, que é só da vista de cima, devolve alfa zero
 * na 3/4. As fatias ficam guardadas no chão onde a sombra já cai, para a
 * imagem de cima não crescer.
 *
 * As medidas da frente são na TELA da 3/4 (x como na pegada; y = o y do chão
 * menos a altura), então o perfil do tipo tem de ser
 * `{ modo: 'derivado', espessura: 0 }`: com a beirada padrão dos tampos soltos
 * cada âncora ganharia um fio de 3 px debaixo dela.
 *
 * COM O OBJETO GIRADO a 3/4 dá o quarto de volta na cena antes de subir as
 * peças, e a tabuleta sairia deitada. Por isso o desenho lê `c.giro` (só a
 * 3/4 o passa: de cima é a imagem que gira) e já entrega a cena girada ao
 * contrário (`pecaNaTela`): na 3/4 a tabuleta fica de frente em qualquer
 * giro. Com meia volta ela sai espelhada, o poste na outra ponta e a linha
 * do outro lado do meio, como a vista de cima a deixou; com um quarto de volta
 * (a placa de través, que de frente seria um risco em cima do poste) ela
 * fica de frente no meio da pegada e passa dela um quarto de casa de cada
 * lado.
 *
 * O desenho é feito numa pegada de 1 x 0,5 casa e escala inteiro com o menor
 * lado. Material: `madeira` (o poste e a tabuleta); o ferro, as pedras e a
 * pintura são fixos. Escreve `cena.corDoPiso` (o escuro do ferro).
 */
import { rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, cadeia, caixa, capsula, elipse, elipseGirada, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Sombra, type Textura } from './motor'
import { PREGO, QUARTO, type MontarMovel } from './contexto'

// ---------- as medidas (px do protótipo na pegada de partida) ----------

/** A pegada de partida: 1 x 0,5 casa. As medidas valem nela, com o meio em (0, 0). */
const LARGURA_DE_PARTIDA = 56
const FUNDO_DE_PARTIDA = 28
/**
 * O y do chão em que a placa está em pé: um pouco para o fundo da pegada, para o desenho de cima (das pedras do
 * calço à nesga da face) ficar no meio dela; a sombra cai para a frente.
 */
const LINHA = -3

/** O poste: onde fica, o raio e a altura. */
const POSTE = -20.5
const RAIO_DO_POSTE = 3.3
const ALTURA_DO_POSTE = 96
/** O braço: a altura do meio dele, o raio do ferro, onde acaba e o raio da ponta enrolada. */
const ALTURA_DO_BRACO = 86
const RAIO_DO_BRACO = 1.15
const PONTA_DO_BRACO = 24
const RAIO_DA_PONTA = 2.4
/** A tabuleta: de onde a onde vai, o alto e o pé dela, a meia grossura da tábua e o chanfro dos dois cantos de baixo. */
const TABULETA_DE = -2.4
const TABULETA_ATE = 23.2
const MEIO_DA_TABULETA = (TABULETA_DE + TABULETA_ATE) / 2
const ALTO_DA_TABULETA = 72
const PE_DA_TABULETA = 46.4
const MEIA_GROSSURA = 2
const CHANFRO_DA_TABULETA = 3
/** A moldura de madeira que sobra em volta do campo pintado. */
const MOLDURA = 2.3
/** De cima a tabuleta aparece balançando para a frente: o pé dela fica este tanto à frente do alto. */
const BALANCO = 5.8
/** Onde as duas correntes prendem. */
const CORRENTES: readonly number[] = [1.4, 19.4]
/** Os elos de uma corrente, do braço para a tabuleta: a altura do primeiro e o passo. */
const ELOS = 5
const PRIMEIRO_ELO = 83.5
const PASSO_DO_ELO = 2.5
/** As duas abraçadeiras que prendem o ferro no poste (a altura do meio de cada uma): a do braço e a do pé da voluta. */
const ABRACADEIRAS: readonly number[] = [ALTURA_DO_BRACO, 65.6]

/** A mão-francesa: um quarto de elipse do poste até debaixo do braço (os dois raios) e o caracol em que ela acaba. */
const VOLUTA_AO_COMPRIDO = 16
const VOLUTA_NA_ALTURA = 19.2
const FIM_DO_ARCO_DA_VOLUTA = -6
const RAIO_DO_CARACOL = 2.3
const MIOLO_DO_CARACOL = 0.7
const VOLTA_DO_CARACOL = 450
const RAIO_DO_FERRO_DA_VOLUTA = 0.75
/** O passo, em graus, dos pontos de uma curva de ferro. */
const PASSO_DA_CURVA = 12

/** A caneca: o meio, o alto e o pé, a meia largura em cima e embaixo, e as duas cintas. */
const MEIO_DA_CANECA = 8.9
const ALTO_DA_CANECA = 64.6
const PE_DA_CANECA = 51.4
const MEIA_BOCA_DA_CANECA = 4.2
const MEIO_PE_DA_CANECA = 5
const CINTAS_DA_CANECA: readonly number[] = [61.8, 54]

/** As pedras do calço em volta do pé do poste: [x, y a partir da linha, meio comprimento, meia largura, giro]. */
const CALCOS: readonly (readonly [number, number, number, number, number])[] = [
  [-25.2, 1.7, 2.6, 2, 0.5],
  [-18.1, 4.6, 2.5, 1.9, -0.4],
  [-16.2, -3.3, 2.2, 1.7, 0.9],
]

// ---------- os materiais fixos ----------

/** O ferro forjado, escuro. */
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 0.9)) }
/** O escuro em que o pixel escuro demais é levantado: cinza quente, como no canhão (com o da nogueira o ferro saía marrom). */
const ESCURO_DO_FERRO: Rgb = rgb('#4a4541')
/** As pedras do calço. */
const PEDRA: MaterialDaPeca = { classe: 'pedra', pedra: 'granito', rgb: [0x9c, 0x97, 0x8c] }
/** A pintura: o campo verde-escuro desbotado, a caneca cor de louça, as cintas dela e a espuma. */
const CAMPO: MaterialDaPeca = { classe: 'liso', rgb: [0x4e, 0x69, 0x60] }
const LOUCA: MaterialDaPeca = { classe: 'liso', rgb: [0xdc, 0xc8, 0x98] }
const CINTA: MaterialDaPeca = { classe: 'liso', rgb: [0x8c, 0x70, 0x4c] }
const ESPUMA: MaterialDaPeca = { classe: 'liso', rgb: [0xf0, 0xe9, 0xd9] }

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

/** A tinta gasta do campo: falha aqui e ali, e a madeira da tabuleta aparece por baixo. */
const texDaTinta: Textura = (_u, _v, x, y, p, s) => {
  s[5] = limitar(0.86 + ruido(x * 0.45 + p.su, y * 0.45 + p.sv) * 0.9, 0.5, 1)
  s[3] += ruido(x * 0.2 + p.sv, y * 0.2) * 0.08
}

/** O topo cortado do poste: os anéis da tora em volta do miolo. */
function texDoTopo(cx: number, cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const dist = Math.hypot(x - cx, y - cy)
    s[3] += Math.sin(dist * 3.2 + ruido(x * 0.4 + p.su, y * 0.4) * 2.4) * 0.07 - 0.03
  }
}

// ---------- a âncora e a fatia ----------

/** O lado da âncora: um tampo solto que não faz sombra e some atrás da peça presa a ela; e a borda da sombra (nula) dela. */
const FRESTA = 0.25
const BORDA_DA_ANCORA = 0.1
/** Quanto uma fatia passa por cima da vizinha: sem isso sobraria um fio de chão entre as duas. */
const EMENDA = 0.2
/** Até onde a forma de uma fatia continua valendo depois do corte: mais que o alcance do passo do chanfro. */
const FOLGA_DO_CORTE = 3
const FORA_DA_FAIXA = 1e3
/** A altura máxima de uma fatia: a frente da placa cabe em duas. */
const FATIA_MAXIMA = 24
/** A que distância da linha, para a frente, as fatias ficam guardadas na vista de cima: no chão, onde a sombra já cai. */
const GUARDA = 9

/** Onde uma peça se prende para subir `z` na 3/4. */
interface Ancora {
  readonly x: number
  readonly y: number
  readonly z: number
}

/**
 * A mesma forma com a caixa de pintura centrada na âncora: o desenho não muda
 * (fora da forma nada pinta), mas o meio da caixa, que é o que a 3/4 lê para
 * saber em que estrutura a peça está, cai na âncora.
 */
function presa(forma: Forma, a: Ancora): Forma {
  const mx = Math.max(a.x - forma.b[0], forma.b[2] - a.x)
  const my = Math.max(a.y - forma.b[1], forma.b[3] - a.y)
  return { b: [a.x - mx, a.y - my, a.x + mx, a.y + my], d: (x, y) => forma.d(x, y) }
}

/** A peça da face não tem deslocamento nem sombra própria: a cópia de uma fatia escureceria a da outra. */
type OpcoesDaFace = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'ruga' | 'curvaY'>

/** Uma peça desenhada como a 3/4 a mostra: x como na pegada, y na tela (o y do chão menos a altura). */
interface PecaDaFrente {
  readonly forma: Forma
  readonly mat: MaterialDaPeca
  readonly o: OpcoesDaFace
}

/** Põe uma peça da face (a lista vai de trás para a frente). */
type PorNaFace = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaFace) => void

/** Uma fatia da frente: de onde a onde vai na tela da 3/4 e a âncora dela (a fatia fica guardada `z` abaixo do lugar da tela). */
interface Fatia {
  readonly de: number
  readonly ate: number
  readonly ancora: Ancora
}

/**
 * A cópia da peça da frente que cabe à fatia, ou nada se a peça não passa por
 * ela. A forma é a peça inteira, descida para o lugar guardado (o chanfro e o
 * contorno não sabem do corte); a textura esconde o que passa da fatia e
 * devolve ao material as coordenadas da frente. `escala` = o tamanho do
 * desenho na pegada (o veio anda em px da cena). `soNaTresQuartos`: de cima a
 * peça não foi subida (`p.dy` é zero) e a textura a esconde inteira.
 */
function naFatia(peca: PecaDaFrente, fatia: Fatia, escala: number, soNaTresQuartos: boolean): PecaDaFrente | null {
  const f = peca.forma
  const z = fatia.ancora.z
  const visivel0 = Math.max(fatia.de, f.b[1]) + z - EMENDA
  const visivel1 = Math.min(fatia.ate, f.b[3]) + z + EMENDA
  if (visivel1 - visivel0 <= 2 * EMENDA) return null
  const corte0 = visivel0 - FOLGA_DO_CORTE
  const corte1 = visivel1 + FOLGA_DO_CORTE
  const guardada: Forma = {
    b: [f.b[0], corte0, f.b[2], corte1],
    d: (x, y) => (y < corte0 || y > corte1 ? FORA_DA_FAIXA : f.d(x, y - z)),
  }
  const eixo = peca.o.eixo ?? 0
  const du = -z * escala * Math.sin(eixo)
  const dv = -z * escala * Math.cos(eixo)
  const doMaterial = peca.o.textura ?? texturaDaClasse(peca.mat.classe)
  const textura: Textura = (u, v, x, y, p, s, pixels) => {
    if (y < visivel0 || y > visivel1 || (soNaTresQuartos && p.dy === 0)) {
      s[5] = 0
      return
    }
    if (doMaterial !== null) doMaterial(u + du, v + dv, x, y - z, p, s, pixels)
  }
  return { forma: presa(guardada, fatia.ancora), mat: peca.mat, o: { ...peca.o, textura } }
}

/** As opções da peça que só a vista de cima mostra: na 3/4 ela foi subida (`p.dy` deixou de ser zero) e a textura a esconde. */
function soDeCima(mat: MaterialDaPeca, o: OpcoesDaFace): OpcoesDaFace {
  const doMaterial = o.textura ?? texturaDaClasse(mat.classe)
  const textura: Textura = (u, v, x, y, p, s, pixels) => {
    if (p.dy !== 0) {
      s[5] = 0
      return
    }
    if (doMaterial !== null) doMaterial(u, v, x, y, p, s, pixels)
  }
  return { ...o, textura }
}

// ---------- o giro na 3/4 ----------

/** Os quartos de volta do giro do objeto (0 a 3). */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto girado `q` quartos de volta no sentido da tela, como o `girarPonto` de `tresQuartos.ts`. */
function girarPonto(x: number, y: number, q: number): [number, number] {
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

/**
 * A fábrica de peças de quem desenha NA TELA da 3/4. Com o objeto girado, a
 * 3/4 dá `q` quartos de volta na cena antes de subir as peças (`girarCena`).
 * Aqui a peça já sai girada ao contrário (a forma, o veio e o ponto que a
 * textura lê): a volta da 3/4 a põe de novo como foi desenhada. Sem giro, é a
 * fábrica de sempre, byte a byte.
 */
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

// ---------- a prancheta ----------

/** Onde a placa está na tela: os pontos do desenho já saem do lado certo (a placa espelhada troca o x). */
interface Prancheta {
  /** 1, ou -1 com a placa espelhada (o poste na outra ponta). */
  readonly lado: number
  /** O y do chão em que a placa está em pé. */
  readonly linha: number
}

/** O ponto da frente, na tela da 3/4: `x` ao longo da placa, `z` a altura. */
function naTela(t: Prancheta, x: number, z: number): Ponto {
  return [t.lado * x, t.linha - z]
}

/** Onde cai no chão a sombra do ponto que está em `x`, na altura `z`. */
function sombraDe(t: Prancheta, x: number, z: number): Ponto {
  return [t.lado * x + SOMBRA_X * z, t.linha + SOMBRA_Y * z]
}

/** O retângulo no chão (a vista de cima), com o y a partir da linha da placa. */
function deCima(t: Prancheta, x0: number, y0: number, x1: number, y1: number, raio: number): Forma {
  return caixa(Math.min(t.lado * x0, t.lado * x1), t.linha + y0, Math.max(t.lado * x0, t.lado * x1), t.linha + y1, raio)
}

/**
 * Como a face da tabuleta é projetada: de frente (a 3/4) ou achatada no chão
 * (a nesga da vista de cima, com a tabuleta balançando).
 */
interface Face {
  /** O ponto da face que está em `x`, na altura `z`. */
  readonly ponto: (x: number, z: number) => Ponto
  /** Quanto a altura encolhe: 1 de frente; na nesga, o balanço dividido pela altura da tabuleta. */
  readonly achatado: number
}

/** O retângulo da face, de `x0` a `x1` e de `zAlto` a `zBaixo`. */
function retangulo(face: Face, x0: number, zAlto: number, x1: number, zBaixo: number, raio: number): Forma {
  const [ax, ay] = face.ponto(x0, zAlto)
  const [bx, by] = face.ponto(x1, zBaixo)
  return caixa(Math.min(ax, bx), ay, Math.max(ax, bx), by, raio)
}

/** Os pontos (x, z) de um caracol em volta de (cx, cz): do ângulo `de` ao `ate` (graus; 0 = para a ponta do braço, 90 = para cima), o raio indo de `r0` a `r1`. */
function caracol(cx: number, cz: number, de: number, ate: number, r0: number, r1: number): Ponto[] {
  const passos = Math.ceil(Math.abs(ate - de) / PASSO_DA_CURVA)
  const pontos: Ponto[] = []
  for (let i = 0; i <= passos; i += 1) {
    const t = i / passos
    const ang = ((de + (ate - de) * t) * Math.PI) / 180
    const r = r0 + (r1 - r0) * t
    pontos.push([cx + r * Math.cos(ang), cz + r * Math.sin(ang)])
  }
  return pontos
}

// ---------- a frente: o ferro ----------

function frenteDoFerro(t: Prancheta, por: PorNaFace): void {
  const ferro = (pontos: readonly Ponto[], raio: number, semente: number): void => {
    por(cadeia(pontos.map(([x, z]) => naTela(t, x, z)), raio), FERRO, { bisel: raio, contorno: 0.28, metal: 0.3, semente })
  }
  // O braço, do poste até a ponta, que enrola para cima e para trás.
  ferro([[POSTE + RAIO_DO_POSTE, ALTURA_DO_BRACO], [PONTA_DO_BRACO, ALTURA_DO_BRACO]], RAIO_DO_BRACO, 7400)
  ferro(caracol(PONTA_DO_BRACO, ALTURA_DO_BRACO + RAIO_DA_PONTA, -90, 300, RAIO_DA_PONTA, 0.8), RAIO_DO_FERRO_DA_VOLUTA, 7401)
  // A mão-francesa: sai do poste, faz a barriga para baixo e sobe até debaixo do braço, onde enrola para dentro.
  const cantoX = POSTE + RAIO_DO_POSTE
  const cantoZ = ALTURA_DO_BRACO - RAIO_DO_BRACO
  const arco: Ponto[] = []
  for (let graus = -90; graus <= FIM_DO_ARCO_DA_VOLUTA; graus += PASSO_DA_CURVA / 2) {
    const ang = (graus * Math.PI) / 180
    arco.push([cantoX + VOLUTA_AO_COMPRIDO * Math.cos(ang), cantoZ + VOLUTA_NA_ALTURA * Math.sin(ang)])
  }
  const [fimX, fimZ] = arco[arco.length - 1]
  ferro([...arco, ...caracol(fimX - RAIO_DO_CARACOL, fimZ, 0, VOLTA_DO_CARACOL, RAIO_DO_CARACOL, MIOLO_DO_CARACOL)], RAIO_DO_FERRO_DA_VOLUTA, 7402)
  // As abraçadeiras em volta do poste, cada uma com o rebite.
  ABRACADEIRAS.forEach((z, i) => {
    const [x0, y0] = naTela(t, POSTE - RAIO_DO_POSTE - 0.5, z + 1.6)
    const [x1, y1] = naTela(t, POSTE + RAIO_DO_POSTE + 0.5, z - 1.6)
    por(caixa(Math.min(x0, x1), y0, Math.max(x0, x1), y1, 0.6), FERRO, { tabua: 0, bisel: 0.7, tom: 0.92, contorno: 0.28, metal: 0.2, semente: 7404 + i })
    por(elipse(...naTela(t, POSTE - 0.6, z), 0.6, 0.6), PREGO, { bisel: 0.5, tom: 1.3, contorno: 0.1, metal: 0.34, semente: 7406 })
  })
  // As correntes: os elos de frente (o anel) e de lado (o risco), um sim, um não.
  for (const x of CORRENTES) {
    for (let i = 0; i < ELOS; i += 1) {
      const [ex, ey] = naTela(t, x, PRIMEIRO_ELO - i * PASSO_DO_ELO)
      const elo = i % 2 === 0 ? anel(ex, ey, 1.05, 1.65, 0.4, 1) : capsula(ex, ey - 1.3, ex, ey + 1.3, 0.45)
      por(elo, FERRO, { bisel: 0.4, tom: 1.12, contorno: 0.22, metal: 0.3, semente: 7408 + i })
    }
  }
}

// ---------- a face da tabuleta ----------

/** O contorno da tabuleta (ou do campo, com `recuo`): reto em cima, os dois cantos de baixo chanfrados. */
function contornoDaTabuleta(recuo: number): Ponto[] {
  const [x0, x1] = [TABULETA_DE + recuo, TABULETA_ATE - recuo]
  const [alto, pe] = [ALTO_DA_TABULETA - recuo, PE_DA_TABULETA + recuo]
  const chanfro = CHANFRO_DA_TABULETA - recuo * 0.4
  return [[x0, alto], [x1, alto], [x1, pe + chanfro], [x1 - chanfro, pe], [x0 + chanfro, pe], [x0, pe + chanfro]]
}

/** A face pintada, de frente ou achatada (`face`). `tamanho` = o tamanho do desenho na pegada (a largura das pranchas anda em px da cena). */
function faceDaTabuleta(face: Face, por: PorNaFace, madeira: MaterialDaPeca, tamanho: number): void {
  const k = face.achatado
  const naFace = ([x, z]: Ponto): Ponto => face.ponto(x, z)
  // A tábua, de três pranchas de pé, e o campo pintado dentro da moldura.
  por(poligono(contornoDaTabuleta(0).map(naFace)), madeira, { eixo: QUARTO, tabua: ((TABULETA_ATE - TABULETA_DE) / 3) * tamanho, bisel: 0.9, tom: 0.9, contorno: 0.3, semente: 7420 })
  por(poligono(contornoDaTabuleta(MOLDURA).map(naFace)), CAMPO, { bisel: 0.4, contorno: 0.16, recesso: { k: 0.8, forca: 0.2 }, textura: texDaTinta, semente: 7421 })
  // Os olhais em que as correntes prendem, no alto, e um prego em cada canto de cima da moldura.
  for (const x of CORRENTES) por(retangulo(face, x - 1.4, ALTO_DA_TABULETA + 0.5, x + 1.4, ALTO_DA_TABULETA - 1.3, 0.4), FERRO, { bisel: 0.5, tom: 1.1, contorno: 0.2, metal: 0.3, semente: 7422 })
  const prego = MOLDURA / 2
  for (const x of [TABULETA_DE + prego, TABULETA_ATE - prego]) {
    por(elipse(...face.ponto(x, ALTO_DA_TABULETA - prego), 0.55, 0.55 * k), PREGO, { bisel: 0.4 * k, tom: 1.2, contorno: 0.1, metal: 0.3, semente: 7423 })
  }

  // A caneca: a asa por trás do corpo, o corpo mais largo no pé, as duas cintas e a espuma transbordando.
  const meio = (ALTO_DA_CANECA + PE_DA_CANECA) / 2
  por(anel(...face.ponto(MEIO_DA_CANECA + 4.7, meio), 3.5, 4.3 * k, 2, 2.8 * k), LOUCA, { bisel: 0.6 * k, tom: 0.94, contorno: 0.3, semente: 7424 })
  const corpo: readonly Ponto[] = [
    [MEIO_DA_CANECA - MEIA_BOCA_DA_CANECA, ALTO_DA_CANECA],
    [MEIO_DA_CANECA + MEIA_BOCA_DA_CANECA, ALTO_DA_CANECA],
    [MEIO_DA_CANECA + MEIO_PE_DA_CANECA, PE_DA_CANECA],
    [MEIO_DA_CANECA - MEIO_PE_DA_CANECA, PE_DA_CANECA],
  ]
  por(poligono(corpo.map(naFace)), LOUCA, { bisel: 1.1 * k, contorno: 0.3, semente: 7425 })
  for (const z of CINTAS_DA_CANECA) {
    // A cinta acompanha o corpo, que alarga para o pé.
    const meia = MEIA_BOCA_DA_CANECA + ((ALTO_DA_CANECA - z) / (ALTO_DA_CANECA - PE_DA_CANECA)) * (MEIO_PE_DA_CANECA - MEIA_BOCA_DA_CANECA) - 0.3
    por(retangulo(face, MEIO_DA_CANECA - meia, z + 0.6, MEIO_DA_CANECA + meia, z - 0.6, 0.2), CINTA, { bisel: 0.3 * k, contorno: 0.1, semente: 7426 })
  }
  // A espuma: três bolhas em cima da boca e o fio que escorre pelo lado.
  const bolha = (x: number, z: number, r: number): Forma => elipse(...face.ponto(x, z), r, r * k)
  const espuma = [
    bolha(MEIO_DA_CANECA - 2.7, ALTO_DA_CANECA + 1, 2.1),
    bolha(MEIO_DA_CANECA, ALTO_DA_CANECA + 1.6, 2.4),
    bolha(MEIO_DA_CANECA + 2.7, ALTO_DA_CANECA + 1, 2.1),
    retangulo(face, MEIO_DA_CANECA - 4.9, ALTO_DA_CANECA + 1.4, MEIO_DA_CANECA - 3.2, ALTO_DA_CANECA - 3.8, 0.85),
  ].reduce(uniao)
  por(espuma, ESPUMA, { bisel: 1.2 * k, contorno: 0.26, semente: 7427 })
}

// ---------- a placa ----------

/** Põe uma peça desenhada na pegada de partida (quem chama a leva para o tamanho da pegada e para o giro). */
type Por = (forma: Forma, mat: MaterialDaPeca, o?: OpcoesDaPeca) => void

export const montarPlacaDeLoja: MontarMovel = (c, cena) => {
  const tamanho = Math.min(c.w / LARGURA_DE_PARTIDA, c.h / FUNDO_DE_PARTIDA)
  const q = quartosDoGiro(c.giro)
  // Com meia volta a linha passa para o outro lado do meio da pegada; de través (um quarto de volta), fica no meio.
  const t: Prancheta = { lado: q >= 2 ? -1 : 1, linha: q === 0 ? LINHA : q === 2 ? -LINHA : 0 }
  const P = pecaNaTela(c.peca, q)
  const mad = c.m.madeira
  /** A forma desenhada na pegada de partida, no tamanho da pegada. */
  const naPegada = (f: Forma): Forma => (tamanho === 1 ? f : { b: [f.b[0] * tamanho, f.b[1] * tamanho, f.b[2] * tamanho, f.b[3] * tamanho], d: (x, y) => f.d(x / tamanho, y / tamanho) * tamanho })
  const por: Por = (forma, mat, o = {}) => {
    const textura = o.textura
    // A textura própria lê o ponto na pegada de partida, como a forma.
    const opcoes: OpcoesDaPeca = textura === undefined || tamanho === 1 ? o : { ...o, textura: (u, v, x, y, p, s, pixels) => textura(u, v, x / tamanho, y / tamanho, p, s, pixels) }
    cena.partes.push(P(naPegada(forma), mat, opcoes))
  }
  const sombrear = (s: Sombra): void => {
    cena.sombras.push({ ...s, forma: naPegada(s.forma), z: s.z * tamanho })
  }
  /**
   * Cria a âncora em (x, y): o ponto tem de ficar DENTRO de uma peça presa a ela, que a esconde na 3/4. A borda
   * fina é para a caixa da imagem: a âncora é alta, e com o borrão padrão da altura (que não pinta nada, a força é
   * zero) a imagem cresceria para baixo à direita.
   */
  const ancorar = (x: number, y: number, z: number): Ancora => {
    sombrear({ forma: caixa(x - FRESTA / 2, y - FRESTA / 2, x + FRESTA / 2, y + FRESTA / 2), z, solta: true, forca: 0, suave: BORDA_DA_ANCORA })
    return { x, y, z }
  }
  cena.corDoPiso = ESCURO_DO_FERRO

  // 1. AS SOMBRAS NO CHÃO: a do poste é arrastada (e faz dele uma coluna na 3/4); as do braço, das correntes, da
  // mão-francesa e da tabuleta, que estão num plano em pé, são deitadas pela luz do motor e desenhadas no chão.
  const xDoPoste = t.lado * POSTE
  sombrear({ forma: elipse(xDoPoste, t.linha, RAIO_DO_POSTE - 0.2, RAIO_DO_POSTE - 0.2), z: ALTURA_DO_POSTE, forca: 0.3 })
  sombrear(contato(elipse(xDoPoste, t.linha, RAIO_DO_POSTE + 0.7, RAIO_DO_POSTE + 0.7), 0.3))
  sombrear({ forma: capsula(...sombraDe(t, POSTE, ALTURA_DO_BRACO), ...sombraDe(t, PONTA_DO_BRACO + RAIO_DA_PONTA, ALTURA_DO_BRACO), 1), z: 0, suave: 1.5, forca: 0.22 })
  sombrear({ forma: capsula(...sombraDe(t, POSTE + RAIO_DO_POSTE, ABRACADEIRAS[1]), ...sombraDe(t, -2, ALTURA_DO_BRACO - 2), 0.6), z: 0, suave: 1.3, forca: 0.14 })
  for (const x of CORRENTES) sombrear({ forma: capsula(...sombraDe(t, x, ALTO_DA_TABULETA), ...sombraDe(t, x, ALTURA_DO_BRACO), 0.5), z: 0, suave: 1.1, forca: 0.16 })
  sombrear({ forma: poligono(contornoDaTabuleta(0).map(([x, z]) => sombraDe(t, x, z))), z: 0, suave: 1.5, forca: 0.28 })

  // 2. NO CHÃO: as pedras do calço em volta do pé do poste (o topo dele as cobre onde passa).
  CALCOS.forEach(([x, y, comprido, largo, giro], i) => {
    const pedra = elipseGirada(t.lado * x, t.linha + y, comprido, largo, t.lado * giro)
    sombrear(contato(pedra, 0.26))
    por(pedra, PEDRA, { bisel: largo * 0.8, tom: 0.92 + 0.08 * i, contorno: 0.3, semente: 7430 + i })
  })

  // 3. O ALTO DE CADA COISA, que é o que se vê de cima: a tabuleta de quina, com os olhais; o braço por cima dela,
  // com o elo de cada corrente; e o topo do poste, que passa do braço. Cada um sobe para a sua altura na 3/4.
  const altoDaTabuleta = ancorar(t.lado * MEIO_DA_TABULETA, t.linha + MEIA_GROSSURA - 0.4, ALTO_DA_TABULETA)
  if (q === 0) {
    // A nesga da face, só de cima (sem giro a cena tanto pode ser a de cima quanto a da 3/4; com giro é sempre a 3/4).
    const achatado = BALANCO / (ALTO_DA_TABULETA - PE_DA_TABULETA)
    const nesga: Face = { ponto: (x, z) => [t.lado * x, t.linha + MEIA_GROSSURA + (ALTO_DA_TABULETA - z) * achatado], achatado }
    faceDaTabuleta(nesga, (forma, mat, o) => por(presa(forma, altoDaTabuleta), mat, soDeCima(mat, o)), mad, tamanho)
  }
  por(presa(deCima(t, TABULETA_DE, -MEIA_GROSSURA, TABULETA_ATE, MEIA_GROSSURA, 0.5), altoDaTabuleta), mad, { tabua: 0, bisel: 0.8, tom: 1.06, contorno: 0.28, semente: 7440, projeta: { dist: 1.2, forca: 0.26 } })
  for (const x of CORRENTES) por(presa(deCima(t, x - 1.5, -1.3, x + 1.5, 1.3, 0.4), altoDaTabuleta), FERRO, { bisel: 0.5, tom: 1.1, contorno: 0.2, metal: 0.3, semente: 7441 })
  const altoDoBraco = ancorar(t.lado * (MEIO_DA_TABULETA - 3), t.linha, ALTURA_DO_BRACO)
  por(presa(capsula(t.lado * (POSTE + 2), t.linha, t.lado * (PONTA_DO_BRACO + RAIO_DA_PONTA), t.linha, RAIO_DO_BRACO), altoDoBraco), FERRO, { bisel: RAIO_DO_BRACO, contorno: 0.28, metal: 0.3, semente: 7442 })
  for (const x of CORRENTES) por(presa(elipse(t.lado * x, t.linha, 0.9, 1.75), altoDoBraco), FERRO, { bisel: 0.6, tom: 1.2, contorno: 0.22, metal: 0.3, semente: 7443 })
  // O topo é de tora (a casca): é dele que a 3/4 tira o material da frente do poste, que sai com as fendas ao
  // comprido, e não com frestas de tábua. A textura própria põe os anéis do corte no topo.
  const tora: MaterialDaPeca = { classe: 'casca', casca: 'fendida', rgb: mad.rgb }
  por(elipse(xDoPoste, t.linha, RAIO_DO_POSTE, RAIO_DO_POSTE), tora, { bisel: 1.3, tom: 1.04, contorno: 0.3, textura: texDoTopo(xDoPoste, t.linha), semente: 7444 })

  // 4. A FRENTE, que só a 3/4 mostra: desenhada na tela e fatiada. A âncora de cada fatia fica no braço (a fatia
  // de cima) ou no meio da tabuleta (a de baixo), atrás de uma peça fechada.
  const frente: PecaDaFrente[] = []
  const naFrente: PorNaFace = (forma, mat, o) => {
    frente.push({ forma, mat, o })
  }
  frenteDoFerro(t, naFrente)
  // A face fica à frente da linha a meia grossura da tábua, como o alto dela na vista de cima.
  faceDaTabuleta({ ponto: (x, z) => [t.lado * x, t.linha + MEIA_GROSSURA - z], achatado: 1 }, naFrente, mad, tamanho)
  const alto = Math.min(...frente.map((p) => p.forma.b[1]))
  const baixo = Math.max(...frente.map((p) => p.forma.b[3]))
  const fatias = Math.ceil((baixo - alto) / FATIA_MAXIMA)
  const yDoBraco = t.linha - ALTURA_DO_BRACO
  const [altoDaFace, peDaFace] = [t.linha + MEIA_GROSSURA - ALTO_DA_TABULETA, t.linha + MEIA_GROSSURA - PE_DA_TABULETA]
  for (let j = 0; j < fatias; j += 1) {
    const de = alto + ((baixo - alto) * j) / fatias
    const ate = alto + ((baixo - alto) * (j + 1)) / fatias
    const z = t.linha + GUARDA - de
    const yDaAncora = yDoBraco > de && yDoBraco < ate ? yDoBraco : limitar((de + ate) / 2, altoDaFace + MOLDURA + 1, peDaFace - MOLDURA - 1)
    const fatia: Fatia = { de, ate, ancora: ancorar(t.lado * MEIO_DA_TABULETA, yDaAncora + z, z) }
    for (const peca of frente) {
      // Sem giro a peça se esconde de cima; com giro a cena é sempre a da 3/4.
      const copia = naFatia(peca, fatia, tamanho, q === 0)
      if (copia !== null) por(copia.forma, copia.mat, copia.o)
    }
  }

  // As peças já saíram desgiradas da fábrica; as sombras (e as âncoras, que são sombras) são desgiradas aqui.
  if (q !== 0) {
    cena.sombras.forEach((s, i) => {
      cena.sombras[i] = { ...s, forma: girarForma(s.forma, 4 - q) }
    })
  }
}
