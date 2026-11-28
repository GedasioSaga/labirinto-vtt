/**
 * As VERSÕES da placa de loja (lote L06 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`): a
 * 1ª, a de hoje (a caneca no campo verde, a taverna), é o desenho de `MONTADORES` (`../placaDeLoja.ts`). As outras
 * são a MESMA placa (o poste, o calço, o braço com a voluta, as correntes e a tabuleta de três pranchas) com outro
 * OFÍCIO pintado: a BIGORNA com o martelo (ferreiro), o FRASCO borbulhando (alquimista), os PÃES (padaria), o ESCUDO
 * com as espadas cruzadas (armaduras) e a CAMA com a lua (estalagem). Sem letra nenhuma, como a de hoje. Cada ofício
 * tem o campo de uma cor (todas escuras e apagadas, para a figura clara ler a 1x) e a figura em silhueta cheia: a 1x a
 * tabuleta tem uns 20 pixels, e o que diz o ofício é o contorno.
 *
 * Por que é uma CÓPIA do desenho de hoje: a 3/4 da placa é montada por fatias presas a âncoras (`presa`, `naFatia`,
 * `pecaNaTela`), e nada disso sai de `../placaDeLoja.ts`, que só exporta o montador; o contrato do desenhista proíbe
 * mexer no arquivo base. O código abaixo é o de lá byte a byte, menos a caneca (que virou o `Oficio`) e a cor do
 * campo. Se o arquivo base passar a exportar `faceDaTabuleta` com a figura como parâmetro, esta cópia vira 60
 * linhas (anotado no relatório do L06). Lugar de material: `madeira`, como o tipo.
 *
 * O texto abaixo é o do desenho de hoje.
 *
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
import { rgb, type Rgb } from '../../../ruido'
import { tomDoMeio } from '../../materiais'
import { anel, cadeia, caixa, capsula, dentroDe, elipse, elipseGirada, menos, poligono, uniao, type Caixa, type Forma, type Ponto } from '../formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Sombra, type Textura } from '../motor'
import { PREGO, QUARTO, type MontarMovel } from '../contexto'
import type { VersoesDesenhadas } from '.'

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
function faceDaTabuleta(face: Face, por: PorNaFace, madeira: MaterialDaPeca, tamanho: number, oficio: Oficio): void {
  const k = face.achatado
  const naFace = ([x, z]: Ponto): Ponto => face.ponto(x, z)
  // A tábua, de três pranchas de pé, e o campo pintado dentro da moldura.
  por(poligono(contornoDaTabuleta(0).map(naFace)), madeira, { eixo: QUARTO, tabua: ((TABULETA_ATE - TABULETA_DE) / 3) * tamanho, bisel: 0.9, tom: 0.9, contorno: 0.3, semente: 7420 })
  por(poligono(contornoDaTabuleta(MOLDURA).map(naFace)), oficio.campo, { bisel: 0.4, contorno: 0.16, recesso: { k: 0.8, forca: 0.2 }, textura: texDaTinta, semente: 7421 })
  // Os olhais em que as correntes prendem, no alto, e um prego em cada canto de cima da moldura.
  for (const x of CORRENTES) por(retangulo(face, x - 1.4, ALTO_DA_TABULETA + 0.5, x + 1.4, ALTO_DA_TABULETA - 1.3, 0.4), FERRO, { bisel: 0.5, tom: 1.1, contorno: 0.2, metal: 0.3, semente: 7422 })
  const prego = MOLDURA / 2
  for (const x of [TABULETA_DE + prego, TABULETA_ATE - prego]) {
    por(elipse(...face.ponto(x, ALTO_DA_TABULETA - prego), 0.55, 0.55 * k), PREGO, { bisel: 0.4 * k, tom: 1.2, contorno: 0.1, metal: 0.3, semente: 7423 })
  }

  // A figura do ofício, no lugar da caneca.
  oficio.figura(face, por)
}

// ---------- a placa ----------

/** Põe uma peça desenhada na pegada de partida (quem chama a leva para o tamanho da pegada e para o giro). */
type Por = (forma: Forma, mat: MaterialDaPeca, o?: OpcoesDaPeca) => void

const placaCom = (oficio: Oficio): MontarMovel => (c, cena) => {
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
    faceDaTabuleta(nesga, (forma, mat, o) => por(presa(forma, altoDaTabuleta), mat, soDeCima(mat, o)), mad, tamanho, oficio)
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
  faceDaTabuleta({ ponto: (x, z) => [t.lado * x, t.linha + MEIA_GROSSURA - z], achatado: 1 }, naFrente, mad, tamanho, oficio)
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

// ---------- os ofícios (L06) ----------

/**
 * O que a tabuleta leva pintado: a cor do campo e a figura. A figura é desenhada em (x, z) da face, x ao longo da
 * tabuleta (de `TABULETA_DE` a `TABULETA_ATE`) e z a altura (de `PE_DA_TABULETA` a `ALTO_DA_TABULETA`), dentro da
 * moldura: o miolo do campo fica em x 1 a 20 e z 50 a 68, com o meio em (10,4, 59), como a caneca de hoje.
 */
interface Oficio {
  readonly campo: MaterialDaPeca
  readonly figura: (face: Face, por: PorNaFace) => void
}

/** Os campos: escuros e apagados (luz perto da do verde de hoje), cada ofício numa cor, para a figura clara ler a 1x. */
const CAMPO_DO_FERREIRO: MaterialDaPeca = { classe: 'liso', rgb: [0x4a, 0x4f, 0x55] }
const CAMPO_DO_ALQUIMISTA: MaterialDaPeca = { classe: 'liso', rgb: [0x56, 0x4a, 0x68] }
const CAMPO_DA_PADARIA: MaterialDaPeca = { classe: 'liso', rgb: [0x55, 0x5a, 0x3a] }
const CAMPO_DAS_ARMADURAS: MaterialDaPeca = { classe: 'liso', rgb: [0x6a, 0x3e, 0x36] }
const CAMPO_DA_ESTALAGEM: MaterialDaPeca = { classe: 'liso', rgb: [0x3b, 0x47, 0x60] }
/** As tintas das figuras, todas abaixo de 245 e de croma contido: o ferro claro, o vidro, a madeira, o pão e o pano. */
const FERRO_CLARO: MaterialDaPeca = { classe: 'metal', rgb: [0xa4, 0xa3, 0x9d] }
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0xb3, 0xb4, 0xae] }
const MADEIRA_DO_CABO: MaterialDaPeca = { classe: 'liso', rgb: [0x96, 0x6e, 0x48] }
const LATAO_DA_GUARDA: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0x8c, 0x58] }
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x5e, 0x43, 0x33] }
const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0xc2, 0xca, 0xbe] }
const POCAO: MaterialDaPeca = { classe: 'liso', rgb: [0x7c, 0x98, 0x5a] }
const BOLHA: MaterialDaPeca = { classe: 'liso', rgb: [0xd8, 0xdf, 0xcc] }
const ROLHA: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x7a, 0x54] }
const CASCA_DO_PAO: MaterialDaPeca = { classe: 'liso', rgb: [0xbe, 0x8a, 0x50] }
const CASCA_ESCURA: MaterialDaPeca = { classe: 'liso', rgb: [0xa6, 0x72, 0x42] }
const MIOLO_DO_PAO: MaterialDaPeca = { classe: 'liso', rgb: [0xdc, 0xb6, 0x7c] }
const LENCOL_DA_CAMA: MaterialDaPeca = { classe: 'liso', rgb: [0xd6, 0xcd, 0xb6] }
const COBERTA_DA_CAMA: MaterialDaPeca = { classe: 'liso', rgb: [0x9c, 0x56, 0x4a] }
const LUA: MaterialDaPeca = { classe: 'liso', rgb: [0xe0, 0xd5, 0xa6] }

/** A elipse de meio (cx, cz), raios rx e rz, girada `giro` rad na face (de pé ou achatada na nesga). */
function elipseNaFace(face: Face, cx: number, cz: number, rx: number, rz: number, giro = 0): Forma {
  const pontos: Ponto[] = []
  const lados = 24
  for (let i = 0; i < lados; i += 1) {
    const a = (i / lados) * 2 * Math.PI
    const [ex, ez] = [Math.cos(a) * rx, Math.sin(a) * rz]
    pontos.push(face.ponto(cx + ex * Math.cos(giro) - ez * Math.sin(giro), cz + ex * Math.sin(giro) + ez * Math.cos(giro)))
  }
  return poligono(pontos)
}

/** O polígono dado em (x, z) da face. */
function poligonoNaFace(face: Face, pontos: readonly Ponto[]): Forma {
  return poligono(pontos.map(([x, z]) => face.ponto(x, z)))
}

/** A tira reta de largura `larg` de (ax, az) a (bx, bz) na face. */
function tiraNaFace(face: Face, ax: number, az: number, bx: number, bz: number, larg: number): Forma {
  const l = Math.hypot(bx - ax, bz - az) || 1
  const [nx, nz] = [(-(bz - az) / l) * (larg / 2), ((bx - ax) / l) * (larg / 2)]
  return poligonoNaFace(face, [[ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz], [ax - nx, az - nz]])
}

/** FERREIRO: a bigorna (o bico para a esquerda, a mesa, a cintura e o pé largo) e o martelo no ar, de cabeça para cima. */
function bigorna(face: Face, por: PorNaFace): void {
  const k = face.achatado
  por(tiraNaFace(face, 5.4, 62.8, 13.2, 66.2, 1.15), MADEIRA_DO_CABO, { bisel: 0.45 * k, contorno: 0.28, semente: 7424 })
  por(tiraNaFace(face, 12.6, 68.3, 14.6, 64.0, 2.5), FERRO_CLARO, { bisel: 0.7 * k, contorno: 0.32, metal: 0.3, semente: 7425 })
  const corpo: readonly Ponto[] = [
    [2.4, 60.0], [4.6, 61.1], [6.8, 61.8], [17.8, 61.8], [17.8, 59.4], [15.0, 58.8], [13.6, 56.2], [15.2, 53.8],
    [17.0, 52.8], [17.0, 50.8], [3.8, 50.8], [3.8, 52.8], [5.6, 53.8], [7.2, 56.2], [6.8, 58.4], [4.8, 59.3],
  ]
  por(poligonoNaFace(face, corpo), FERRO_CLARO, { bisel: 0.9 * k, contorno: 0.34, metal: 0.32, semente: 7426 })
  // A mesa gasta pelo martelo: a faixa clara do tampo.
  por(retangulo(face, 6.9, 61.7, 17.6, 60.9, 0.2), FERRO_CLARO, { bisel: 0.25 * k, tom: 1.2, contorno: 0, metal: 0.4, semente: 7427 })
}

/** ALQUIMISTA: o balão de vidro de fundo redondo, a poção verde até o meio, as bolhas subindo e a rolha. */
function frasco(face: Face, por: PorNaFace): void {
  const k = face.achatado
  const [cx, cz, r] = [10.4, 55.6, 5.2]
  por(retangulo(face, 9.2, 68.4, 11.6, 66.2, 0.5), ROLHA, { bisel: 0.5 * k, contorno: 0.3, semente: 7424 })
  const vidro = uniao(elipseNaFace(face, cx, cz, r, r), uniao(retangulo(face, 8.9, 65.6, 11.9, 59.4, 0.3), retangulo(face, 8.3, 66.5, 12.5, 65.2, 0.5)))
  por(vidro, VIDRO, { bisel: 1 * k, contorno: 0.32, semente: 7425 })
  por(dentroDe(elipseNaFace(face, cx, cz, r - 1, r - 1), retangulo(face, cx - r, 57.4, cx + r, cz - r, 0)), POCAO, { bisel: 0.7 * k, contorno: 0.2, semente: 7426 })
  for (const [x, z, rb] of [[9.2, 59.0, 0.62], [11.3, 60.4, 0.5], [10.2, 62.6, 0.42]] as const) {
    por(elipseNaFace(face, x, z, rb, rb), BOLHA, { bisel: 0.3 * k, contorno: 0.14, semente: 7427 })
  }
  // O reflexo do vidro, do lado da luz.
  por(elipseNaFace(face, 7.6, 57.6, 0.8, 1.7, -0.5), BOLHA, { bisel: 0.3 * k, contorno: 0, tom: 1.1, alfa: 0.8, semente: 7428 })
}

/** PADARIA: o pão redondo atrás, o pãozinho à direita e o filão na frente, com os cortes da casca. */
function paes(face: Face, por: PorNaFace): void {
  const k = face.achatado
  por(elipseNaFace(face, 7.0, 61.4, 3.7, 3.5), CASCA_ESCURA, { bisel: 1.1 * k, contorno: 0.32, semente: 7424 })
  por(tiraNaFace(face, 5.2, 61.0, 8.8, 61.8, 0.8), MIOLO_DO_PAO, { bisel: 0.3 * k, contorno: 0.1, semente: 7425 })
  por(tiraNaFace(face, 6.6, 59.6, 7.4, 63.2, 0.8), MIOLO_DO_PAO, { bisel: 0.3 * k, contorno: 0.1, semente: 7425 })
  por(elipseNaFace(face, 15.4, 61.8, 2.7, 2.5), CASCA_DO_PAO, { bisel: 0.9 * k, contorno: 0.32, semente: 7426 })
  const giro = 0.16
  por(elipseNaFace(face, 11.2, 54.6, 7.6, 3.5, giro), CASCA_DO_PAO, { bisel: 1.2 * k, contorno: 0.34, semente: 7427 })
  for (const x of [7.6, 11.1, 14.6]) {
    const z = 55.6 + (x - 11.2) * giro
    por(tiraNaFace(face, x - 1.1, z - 1.3, x + 0.9, z + 1.4, 0.75), MIOLO_DO_PAO, { bisel: 0.3 * k, contorno: 0.1, semente: 7428 })
  }
}

/** Uma espada de punho em (hx, hz) e ponta em (px, pz): o pomo, o cabo de couro, a guarda e a lâmina que afina. */
function espada(face: Face, por: PorNaFace, hx: number, hz: number, px: number, pz: number, semente: number): void {
  const k = face.achatado
  const l = Math.hypot(px - hx, pz - hz)
  const [ux, uz] = [(px - hx) / l, (pz - hz) / l]
  const [gx, gz] = [hx + ux * 3.4, hz + uz * 3.4]
  const meia = 0.72
  por(poligonoNaFace(face, [[gx - uz * meia, gz + ux * meia], [px - ux * 1.6 - uz * meia * 0.8, pz - uz * 1.6 + ux * meia * 0.8], [px, pz], [px - ux * 1.6 + uz * meia * 0.8, pz - uz * 1.6 - ux * meia * 0.8], [gx + uz * meia, gz - ux * meia]]), ACO, { bisel: 0.35 * k, contorno: 0.3, metal: 0.4, semente })
  por(tiraNaFace(face, hx, hz, gx, gz, 0.95), COURO, { bisel: 0.3 * k, contorno: 0.25, semente: semente + 1 })
  por(tiraNaFace(face, gx - uz * 2.2, gz + ux * 2.2, gx + uz * 2.2, gz - ux * 2.2, 0.85), LATAO_DA_GUARDA, { bisel: 0.3 * k, contorno: 0.28, semente: semente + 2 })
  por(elipseNaFace(face, hx, hz, 0.8, 0.8), LATAO_DA_GUARDA, { bisel: 0.4 * k, contorno: 0.28, semente: semente + 3 })
}

/** ARMADURAS: o escudo de aço com a borda e a bossa, sobre duas espadas cruzadas (o punho embaixo, a ponta em cima). */
function escudo(face: Face, por: PorNaFace): void {
  const k = face.achatado
  espada(face, por, 3.4, 51.4, 18.0, 68.2, 7424)
  espada(face, por, 17.4, 51.4, 2.8, 68.2, 7428)
  const contornoDoEscudo = (r: number): Ponto[] => [
    [4.6 + r, 66.4 - r], [10.4, 67.0 - r], [16.2 - r, 66.4 - r], [16.2 - r, 59.2], [15.4 - r * 0.9, 55.6],
    [13.4 - r * 0.7, 52.6 + r * 0.4], [10.4, 50.4 + r * 1.3], [7.4 + r * 0.7, 52.6 + r * 0.4], [5.4 + r * 0.9, 55.6], [4.6 + r, 59.2],
  ]
  por(poligonoNaFace(face, contornoDoEscudo(0)), ACO, { bisel: 0.8 * k, contorno: 0.34, metal: 0.38, semente: 7432 })
  por(poligonoNaFace(face, contornoDoEscudo(1.1)), ACO, { bisel: 0.9 * k, tom: 0.84, contorno: 0.18, metal: 0.3, semente: 7433 })
  por(elipseNaFace(face, 10.4, 59.4, 1.6, 1.6), ACO, { bisel: 0.9 * k, tom: 1.12, contorno: 0.3, metal: 0.45, semente: 7434 })
}

/** ESTALAGEM: a cama de cabeceira alta, o travesseiro e a coberta vermelha dobrada, e a lua minguante no alto. */
function cama(face: Face, por: PorNaFace): void {
  const k = face.achatado
  por(menos(elipseNaFace(face, 15.2, 65.2, 2.7, 2.7), elipseNaFace(face, 16.5, 66.0, 2.3, 2.3)), LUA, { bisel: 0.5 * k, contorno: 0.26, semente: 7424 })
  for (const [x, z] of [[9.0, 66.6], [11.8, 64.4], [6.8, 64.0]] as const) por(elipseNaFace(face, x, z, 0.42, 0.42), LUA, { bisel: 0.2 * k, contorno: 0, semente: 7425 })
  const madeira: MaterialDaPeca = MADEIRA_DO_CABO
  por(uniao(retangulo(face, 2.6, 62.4, 4.6, 51.0, 0.4), elipseNaFace(face, 3.6, 62.9, 1.15, 1.15)), madeira, { bisel: 0.5 * k, contorno: 0.32, semente: 7426 })
  por(uniao(retangulo(face, 16.4, 58.8, 18.2, 51.0, 0.4), elipseNaFace(face, 17.3, 59.3, 0.95, 0.95)), madeira, { bisel: 0.5 * k, contorno: 0.32, semente: 7427 })
  por(retangulo(face, 4.4, 55.4, 16.6, 53.6, 0.3), madeira, { bisel: 0.4 * k, tom: 0.86, contorno: 0.3, semente: 7428 })
  por(retangulo(face, 4.6, 58.0, 16.4, 55.2, 0.7), LENCOL_DA_CAMA, { bisel: 0.6 * k, contorno: 0.28, semente: 7429 })
  por(elipseNaFace(face, 6.7, 58.6, 1.9, 1.1), LENCOL_DA_CAMA, { bisel: 0.6 * k, tom: 1.06, contorno: 0.28, semente: 7430 })
  por(poligonoNaFace(face, [[9.0, 58.7], [16.8, 58.7], [16.8, 54.4], [8.6, 54.4]]), COBERTA_DA_CAMA, { bisel: 0.6 * k, contorno: 0.3, semente: 7431 })
  por(retangulo(face, 9.0, 58.7, 16.8, 57.7, 0.3), LENCOL_DA_CAMA, { bisel: 0.3 * k, tom: 0.96, contorno: 0.18, semente: 7432 })
}

const FERREIRO: Oficio = { campo: CAMPO_DO_FERREIRO, figura: bigorna }
const ALQUIMISTA: Oficio = { campo: CAMPO_DO_ALQUIMISTA, figura: frasco }
const PADARIA: Oficio = { campo: CAMPO_DA_PADARIA, figura: paes }
const ARMADURAS: Oficio = { campo: CAMPO_DAS_ARMADURAS, figura: escudo }
const ESTALAGEM: Oficio = { campo: CAMPO_DA_ESTALAGEM, figura: cama }

/** Ids na ordem do painel, depois da 1ª (a taverna, a de hoje): ferreiro, alquimista, padaria, armaduras, estalagem. */
export const versoesDoPlacaDeLoja: VersoesDesenhadas = {
  ferreiro: placaCom(FERREIRO),
  alquimista: placaCom(ALQUIMISTA),
  padaria: placaCom(PADARIA),
  armaduras: placaCom(ARMADURAS),
  estalagem: placaCom(ESTALAGEM),
}
