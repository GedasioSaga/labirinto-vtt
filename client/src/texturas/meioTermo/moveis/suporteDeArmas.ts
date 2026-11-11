/**
 * SUPORTE DE ARMAS de cima com volume (lote 3 dos objetos novos, 11/11/2026):
 * o cavalete da oficina do ferreiro com as armas prontas encostadas em fila.
 * De cima aparece o QUADRO de madeira (a travessa de trás, onde as armas
 * encostam, a travessa da frente, as duas sapatas dos lados e o estrado
 * escuro no fundo) e, dentro dele, O ALTO de cada arma: os punhos das duas
 * ESPADAS, com a guarda e o pomo, a folha da LANÇA e a cabeça do MACHADO; a
 * lâmina e o cabo de cada uma descem e somem atrás da travessa da frente. No
 * pé, por cima dessa travessa, o ESCUDO redondo encostado, visto do alto.
 *
 * NA 3/4 AS ARMAS APARECEM DE FRENTE, EM PÉ, inteiras: cada uma é desenhada
 * de frente uma vez e FATIADA (a ideia do guarda-roupa e da prateleira de
 * depósito). A fatia do alto é a que se vê nas duas vistas; as de baixo ficam
 * GUARDADAS debaixo do estrado e da travessa da frente na vista de cima. O
 * que põe cada fatia no lugar na 3/4 é a regra de sempre (`tresQuartos.ts`):
 * a peça sobe a altura da estrutura que contém o meio da caixa dela. Aqui
 * cada fatia tem a sua ÂNCORA, um tampo solto de um quarto de px, sem sombra,
 * escondido atrás da própria fatia, e a caixa de pintura da fatia é centrada
 * nela (`presa`). A ordem das âncoras de trás para a frente é a ordem em que
 * a 3/4 pinta: a travessa de trás, as armas, a travessa da frente e o escudo.
 *
 * O escudo é a exceção: de cima ele é uma elipse (o disco encostado, visto do
 * alto) e na 3/4 um disco em pé na frente da travessa. A elipse sobe até o
 * meio do disco e fica escondida atrás dele.
 *
 * As medidas do desenho são na TELA da 3/4 (x como na pegada; y = o y do chão
 * menos a altura), então o perfil do tipo tem de ser
 * `{ modo: 'derivado', espessura: 0 }`: com a beirada padrão dos tampos soltos
 * cada âncora ganharia um fio de 3 px debaixo dela.
 *
 * COM O OBJETO GIRADO a 3/4 dá o quarto de volta na cena antes de subir as
 * peças, e as fatias sairiam deitadas. Por isso o desenho lê `c.giro`: girado,
 * ele monta só o quadro (que a 3/4 gira e varre sozinha) e põe as armas
 * inteiras, em pé, de frente para quem olha, onde o giro as deixou
 * (`porArmasGiradas`). De lado elas tombam para a travessa de trás e o escudo
 * aparece de perfil; de costas ficam atrás da travessa de trás.
 *
 * A 25% de zoom sobram a moldura escura, os riscos claros do aço e o disco do
 * escudo: é o que diz "armas" e não "cerca". Material: `madeira` (o cavalete);
 * o aço, o latão, o couro, as hastes e a pintura do escudo são fixos. As armas
 * têm o tamanho do menor lado (2 x 0,6 casas de partida) e os lugares são
 * frações da largura: o suporte esticado espalha as armas.
 */
import { rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { anel, caixa, capsula, dentroDe, elipse, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Projecao, type Textura } from './motor'
import { G, QUARTO, materialDaPeca, type ContextoDoMovel, type MontarMovel } from './contexto'

// ---------- as medidas do cavalete ----------

/** A pegada de partida, em casas: as medidas do menor lado valem 1 nela. */
const FUNDO_DE_PARTIDA = 0.6
const LARGURA_DE_PARTIDA = 2
/** A largura das travessas, das sapatas e dos postes (px do protótipo, no menor lado) e a folga da pegada. */
const TRAVESSA = 5
const FOLGA = 0.5
/** A travessa da frente e o escudo dividem a beira da frente: a faixa das âncoras do escudo fica depois da travessa. */
const FAIXA_DO_ESCUDO = 1
/** Alturas em casas: as sapatas, a travessa da frente, o alto da travessa de trás e os postes. */
const ALTURA_DA_SAPATA = 0.07
const ALTURA_DA_TRAVESSA_DA_FRENTE = 0.2
const ALTURA_DA_TRAVESSA_DE_TRAS = 0.42
const ALTURA_DO_POSTE = 0.5
/** A face da travessa de trás, vista de frente (px do protótipo, no menor lado). */
const FACE_DA_TRAVESSA = 5

// ---------- os materiais fixos ----------

/** O aço polido das lâminas, o ferro batido (o machado, a lança, a bossa e o aro do escudo) e o escuro do vinco da lâmina. */
const ACO: MaterialDaPeca = { classe: 'metal', rgb: [0xb0, 0xb6, 0xba] }
const FERRO: MaterialDaPeca = { classe: 'metal', rgb: rgb(tomDoMeio('ferro', 1.12)) }
const VINCO: MaterialDaPeca = { classe: 'liso', rgb: [0x4c, 0x50, 0x55] }
const LATAO = materialDaPeca('latao')
/** O couro dos punhos (o castanho e o tinto) e a amarra da lança. */
const COURO: MaterialDaPeca = { classe: 'liso', rgb: [0x5e, 0x40, 0x2e] }
const COURO_TINTO: MaterialDaPeca = { classe: 'liso', rgb: [0x74, 0x3c, 0x3a] }
/** As hastes (a lança e o cabo do machado) e as tábuas do escudo: o pinho; o cabo do machado é mais escuro, de tanto uso. */
const HASTE = materialDaPeca('pinho')
/** A pintura do escudo: o vinho da casa, gasto. */
const TINTA: MaterialDaPeca = { classe: 'liso', rgb: [0x86, 0x45, 0x40] }

/** O punho enrolado em tira de couro: as voltas de través. */
const texDoPunho: Textura = (u, _v, _x, _y, _p, s) => {
  s[3] += Math.sin(u * 4.4) * 0.16
}

/** A pintura gasta do escudo: falha nas beiras das tábuas e onde bateram nela. */
const texDaTinta: Textura = (_u, _v, x, y, p, s) => {
  s[5] = limitar(0.82 + ruido(x * 0.5 + p.su, y * 0.5 + p.sv) * 1.1, 0.35, 1)
  s[3] += ruido(x * 0.2 + p.sv, y * 0.2) * 0.1
}

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

// ---------- a âncora e a fatia ----------

/** O lado da âncora (px do protótipo): um tampo solto que não faz sombra e some atrás da peça presa a ela. */
const FRESTA = 0.25
/** Quanto uma fatia passa por cima da vizinha (px do protótipo): sem isso sobraria um fio de chão entre as duas. */
const EMENDA = 0.2
/** Até onde a forma de uma fatia continua valendo depois do corte: mais que o alcance do passo do chanfro. */
const FOLGA_DO_CORTE = 3
const FORA_DA_FAIXA = 1e3

/** Onde uma peça se prende para subir `z` na 3/4. */
interface Ancora {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Cria a âncora em (x, y): o ponto tem de ficar DENTRO de uma peça presa a ela, que a esconde na 3/4. */
function ancorar(cena: Cena, x: number, y: number, z: number): Ancora {
  cena.sombras.push({ forma: caixa(x - FRESTA / 2, y - FRESTA / 2, x + FRESTA / 2, y + FRESTA / 2), z, solta: true, forca: 0 })
  return { x, y, z }
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

/** A peça da frente não tem deslocamento nem sombra própria: a cópia de uma fatia escureceria a da outra. */
type OpcoesDaFrente = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'ruga' | 'curvaY'>

/** Uma peça desenhada como a 3/4 a mostra: x como na pegada, y na tela (o y do chão menos a altura). */
interface PecaDaFrente {
  readonly forma: Forma
  readonly mat: MaterialDaPeca
  readonly o: OpcoesDaFrente
}

/** Põe uma peça na frente (a lista vai de trás para a frente). */
type Por = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaFrente) => void

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
 * devolve ao material as coordenadas da frente. `sombra` = a sombra que a
 * fatia faz no que está por baixo (só a do alto, a que se vê de cima).
 */
function naFatia(P: CriarPeca, peca: PecaDaFrente, fatia: Fatia, sombra?: Projecao): Peca | null {
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
  const du = -z * Math.sin(eixo)
  const dv = -z * Math.cos(eixo)
  const doMaterial = peca.o.textura ?? texturaDaClasse(peca.mat.classe)
  const textura: Textura = (u, v, x, y, p, s, escala) => {
    if (y < visivel0 || y > visivel1) {
      s[5] = 0
      return
    }
    if (doMaterial !== null) doMaterial(u + du, v + dv, x, y - z, p, s, escala)
  }
  return P(presa(guardada, fatia.ancora), peca.mat, { ...peca.o, textura, projeta: sombra })
}

/** Junta as peças da frente numa lista. */
function novaFrente(): { pecas: PecaDaFrente[]; por: Por } {
  const pecas: PecaDaFrente[] = []
  const por: Por = (forma, mat, o) => {
    pecas.push({ forma, mat, o })
  }
  return { pecas, por }
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
 * A fábrica de peças de quem desenha NA TELA da 3/4 com o objeto girado. A
 * 3/4 dá `q` quartos de volta na cena antes de subir as peças (`girarCena`);
 * aqui a peça já sai girada ao contrário (a forma, o veio e o ponto que a
 * textura lê), e a volta da 3/4 a põe de novo como foi desenhada.
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
          : (u, v, x, y, p, s, escala) => {
              const [tx, ty] = girarPonto(x, y, q)
              textura(u, v, tx, ty, p, s, escala)
            },
    })
  }
}

// ---------- as armas, de frente ----------

/** O que cada arma recebe para se desenhar: do desenho dela (x de través, y para CIMA a partir do pé) para a tela, e a escala. */
interface Prancheta {
  readonly em: (p: Ponto) => Ponto
  readonly k: number
  /** O giro da arma na tela: o veio da haste e as voltas do punho correm ao comprido dela. */
  readonly aoComprido: number
  readonly por: Por
  readonly semente: number
}

type Desenho = (t: Prancheta) => void

function pontos(t: Prancheta, lista: readonly Ponto[]): Forma {
  return poligono(lista.map(t.em))
}

/** A lâmina reta de dois gumes, do bico (no pé) até a guarda, com o vinco no meio. */
function lamina(t: Prancheta, meia: number, ate: number): void {
  t.por(pontos(t, [[0, 0], [meia * 0.72, 5.5], [meia, ate], [-meia, ate], [-meia * 0.72, 5.5]]), ACO, { tabua: 0, bisel: meia * 0.9 * t.k, contorno: 0.3, metal: 0.5, semente: t.semente })
  const [ax, ay] = t.em([0, 12])
  const [bx, by] = t.em([0, ate - 2])
  t.por(capsula(ax, ay, bx, by, 0.5 * t.k), VINCO, { bisel: 0, contorno: 0, alfa: 0.42 })
}

/** A espada longa: a guarda de latão de pontas caídas, o punho de couro castanho e o pomo redondo. */
const espadaLonga: Desenho = (t) => {
  lamina(t, 2.4, 48)
  t.por(pontos(t, [[-7, 47.4], [-6.4, 46.4], [6.4, 46.4], [7, 47.4], [6.2, 49.6], [1.6, 50.4], [-1.6, 50.4], [-6.2, 49.6]]), LATAO, { tabua: 0, bisel: 1.1 * t.k, contorno: 0.3, metal: 0.45, semente: t.semente + 1 })
  t.por(pontos(t, [[-1.25, 50], [1.25, 50], [1.1, 58.4], [-1.1, 58.4]]), COURO, { eixo: t.aoComprido, bisel: 1 * t.k, contorno: 0.26, textura: texDoPunho, semente: t.semente + 2 })
  const [px, py] = t.em([0, 60])
  t.por(elipse(px, py, 2.2 * t.k, 2.2 * t.k), LATAO, { tabua: 0, bisel: 2 * t.k, contorno: 0.3, metal: 0.5, semente: t.semente + 3 })
}

/** A espada curta e larga: a guarda reta de ferro, o punho de couro tinto e o pomo chato. */
const espadaCurta: Desenho = (t) => {
  lamina(t, 3, 42)
  t.por(pontos(t, [[-5.6, 41.6], [5.6, 41.6], [5.6, 44.2], [-5.6, 44.2]]), FERRO, { tabua: 0, bisel: 1.1 * t.k, contorno: 0.3, metal: 0.45, semente: t.semente + 1 })
  t.por(pontos(t, [[-1.35, 44], [1.35, 44], [1.2, 51.6], [-1.2, 51.6]]), COURO_TINTO, { eixo: t.aoComprido, bisel: 1 * t.k, contorno: 0.26, textura: texDoPunho, semente: t.semente + 2 })
  t.por(pontos(t, [[-2.5, 51.4], [2.5, 51.4], [2.9, 53.4], [1.6, 55], [-1.6, 55], [-2.9, 53.4]]), FERRO, { tabua: 0, bisel: 1.4 * t.k, contorno: 0.3, metal: 0.5, semente: t.semente + 3 })
}

/** A lança: a haste comprida com a amarra de couro, o alvado com as duas aletas e a folha de aço com a nervura. */
const lanca: Desenho = (t) => {
  t.por(pontos(t, [[-1.25, 0], [1.25, 0], [1.1, 87], [-1.1, 87]]), HASTE, { eixo: t.aoComprido, tabua: 0, bisel: 1.1 * t.k, contorno: 0.3, semente: t.semente })
  t.por(pontos(t, [[-1.5, 56], [1.5, 56], [1.5, 61], [-1.5, 61]]), COURO, { eixo: t.aoComprido, bisel: 0.8 * t.k, contorno: 0.24, textura: texDoPunho, semente: t.semente + 1 })
  t.por(pontos(t, [[-4.2, 85.4], [4.2, 85.4], [3.4, 87.4], [-3.4, 87.4]]), FERRO, { tabua: 0, bisel: 0.8 * t.k, contorno: 0.3, metal: 0.4, semente: t.semente + 2 })
  t.por(pontos(t, [[-1.8, 83.5], [1.8, 83.5], [1.4, 91.5], [-1.4, 91.5]]), FERRO, { tabua: 0, bisel: 1.2 * t.k, contorno: 0.3, metal: 0.4, semente: t.semente + 3 })
  t.por(pontos(t, [[0, 109], [2.3, 103], [3.8, 96.5], [2.8, 92], [1.3, 90.5], [-1.3, 90.5], [-2.8, 92], [-3.8, 96.5], [-2.3, 103]]), ACO, { tabua: 0, bisel: 2.4 * t.k, contorno: 0.3, metal: 0.5, semente: t.semente + 4 })
  const [ax, ay] = t.em([0, 92.5])
  const [bx, by] = t.em([0, 105])
  t.por(capsula(ax, ay, bx, by, 0.42 * t.k), VINCO, { bisel: 0, contorno: 0, alfa: 0.3 })
}

/** O machado de barba: o cabo escuro, o olho e o cepo de ferro, a lâmina para a direita e o fio polido. */
const machado: Desenho = (t) => {
  t.por(pontos(t, [[-1.5, 0], [1.5, 0], [1.35, 70], [-1.35, 70]]), HASTE, { eixo: t.aoComprido, tabua: 0, bisel: 1.2 * t.k, tom: 0.76, contorno: 0.3, semente: t.semente })
  t.por(pontos(t, [[1, 67.4], [4.4, 67.8], [10, 71], [12.2, 65.4], [12.6, 59.2], [11, 53], [6.4, 56.4], [3.8, 59.6], [1, 60.4]]), FERRO, { tabua: 0, bisel: 1.6 * t.k, contorno: 0.3, metal: 0.4, semente: t.semente + 1 })
  t.por(pontos(t, [[10, 71], [12.2, 65.4], [12.6, 59.2], [11, 53], [9.9, 54.3], [11, 59.4], [10.7, 65], [9, 69.8]]), ACO, { tabua: 0, bisel: 0.6 * t.k, contorno: 0.1, metal: 0.55, semente: t.semente + 2 })
  t.por(pontos(t, [[-3.6, 60.8], [-1, 60.4], [-1, 67.4], [-3.6, 67]]), FERRO, { tabua: 0, bisel: 0.9 * t.k, tom: 0.9, contorno: 0.3, metal: 0.4, semente: t.semente + 3 })
  t.por(pontos(t, [[-1.7, 60.2], [1.7, 60.2], [1.7, 67.6], [-1.7, 67.6]]), FERRO, { tabua: 0, bisel: 1 * t.k, tom: 1.1, contorno: 0.26, metal: 0.45, semente: t.semente + 4 })
}

/** Uma arma no cavalete: onde o pé dela fica (fração da meia largura), o tombo (radianos; positivo, o alto cai para a direita) e o comprimento. */
interface Arma {
  readonly x: number
  readonly tombo: number
  readonly comprimento: number
  readonly desenho: Desenho
}

const ARMAS: readonly Arma[] = [
  { x: -0.67, tombo: 0.045, comprimento: 62.2, desenho: espadaLonga },
  { x: -0.36, tombo: -0.03, comprimento: 55, desenho: espadaCurta },
  { x: -0.06, tombo: 0.012, comprimento: 109, desenho: lanca },
  { x: 0.25, tombo: -0.035, comprimento: 71, desenho: machado },
]
/** A fatia guardada de uma arma não passa disto (px do protótipo): tem de caber debaixo do estrado e da travessa. */
const FATIA_MAXIMA = 26
/** A fatia do alto começa um pouco acima da arma: o tombo e o pomo passam do comprimento dela. */
const SOBRA_DO_ALTO = 3
/** A sombra que o alto de cada arma faz no estrado e na travessa de trás. */
const SOMBRA_DA_ARMA: Projecao = { dist: 1.5, forca: 0.36, suave: 0.9 }

// ---------- o escudo ----------

/** O escudo: o meio (fração da meia largura) e o raio (px do protótipo, no menor lado). */
const ESCUDO = { x: 0.65, raio: 13.4 }
/** Visto do alto, encostado: os dois raios da elipse, em frações do raio. */
const ESCUDO_DO_ALTO = { rx: 0.93, ry: 0.36 }
const REBITES = 8
/** Os rebites só cabem no escudo de frente; de perfil (mais estreito que isto, em fração da altura) ele não os mostra. */
const PERFIL_COM_REBITES = 0.6
/** De perfil a bossa estreita com o escudo, mas não some: a menor largura dela, em fração da altura. */
const PERFIL_DA_BOSSA = 0.45

/**
 * O escudo em pé, com o meio em (cx, cy): as tábuas, a metade pintada, o aro de ferro, os rebites e a bossa.
 * De frente os dois raios são iguais; de perfil (o suporte girado de lado) `rx` é menor e o disco vira uma
 * elipse estreita.
 */
function escudoDeFrente(por: Por, cx: number, cy: number, rx: number, ry: number, k: number): void {
  const perfil = rx / ry
  por(elipse(cx, cy, rx, ry), HASTE, { eixo: QUARTO, tabua: 5.4 * k, bisel: 1.2 * k, tom: 0.9, contorno: 0.3, semente: 3540 })
  por(dentroDe(elipse(cx, cy, rx - 1.2 * k, ry - 1.2 * k), caixa(cx - rx, cy - ry, cx, cy + ry)), TINTA, { bisel: 0, contorno: 0, alfa: 0.92, textura: texDaTinta, semente: 3541 })
  por(anel(cx, cy, rx, ry, rx - 2 * k, ry - 2 * k), FERRO, { tabua: 0, bisel: 0.9 * k, tom: 0.84, contorno: 0.3, metal: 0.36, semente: 3542 })
  if (perfil >= PERFIL_COM_REBITES) {
    for (let i = 0; i < REBITES; i += 1) {
      const a = ((i + 0.5) / REBITES) * Math.PI * 2
      por(elipse(cx + Math.cos(a) * (rx - 4.4 * k), cy + Math.sin(a) * (ry - 4.4 * k), 0.7 * k, 0.7 * k), FERRO, { bisel: 0.6 * k, tom: 1.2, contorno: 0.26, metal: 0.5 })
    }
  }
  const bossa = Math.max(perfil, PERFIL_DA_BOSSA)
  por(elipse(cx, cy, 5.2 * k * bossa, 5.2 * k), FERRO, { tabua: 0, bisel: 0.9 * k, tom: 0.86, contorno: 0.3, metal: 0.36, semente: 3543 })
  por(elipse(cx, cy, 3.7 * k * bossa, 3.7 * k), FERRO, { tabua: 0, bisel: 3.6 * k * bossa, tom: 1.16, contorno: 0.26, metal: 0.6, semente: 3544 })
}

// ---------- a montagem ----------

/** As medidas do cavalete já no tamanho do móvel, as formas do quadro e onde ficam as armas e o escudo. */
interface Cavalete {
  readonly c: ContextoDoMovel
  readonly cena: Cena
  readonly k: number
  /** Do fundo para a frente: de onde a onde vão a travessa de trás e a da frente. */
  readonly tras0: number
  readonly tras1: number
  readonly frente0: number
  readonly frente1: number
  /** A meia largura por dentro das sapatas. */
  readonly dentro: number
  /** Alturas (px do protótipo): a travessa da frente e o alto da de trás. */
  readonly zFrente: number
  readonly zTras: number
  /** O quadro: as estruturas de verdade, que a 3/4 varre. */
  readonly travessaDeTras: Forma
  readonly travessaDaFrente: Forma
  readonly sapatas: readonly Forma[]
  readonly postes: readonly Forma[]
  /** O pé das armas (no estrado, logo atrás da travessa da frente; daí para cima é a tela da 3/4) e até onde as fatias guardadas descem na vista de cima. */
  readonly pe: number
  readonly guardaAte: number
  /** O escudo: o raio, o x do meio e o chão em que ele apoia, na frente da travessa. */
  readonly raio: number
  readonly xDoEscudo: number
  readonly chaoDoEscudo: number
}

/** Mede o cavalete e põe no chão as sombras e as estruturas dele. `q` = os quartos de volta do objeto na 3/4. */
function medirCavalete(c: ContextoDoMovel, cena: Cena, q: number): Cavalete {
  const { hw, hh, g } = c
  const k = Math.min(c.h / FUNDO_DE_PARTIDA, c.w / LARGURA_DE_PARTIDA) / G
  const larg = TRAVESSA * k
  // Do fundo para a frente: a travessa de trás, o estrado, a travessa da frente e a faixa das âncoras do escudo.
  const tras0 = -hh + FOLGA
  const tras1 = tras0 + larg
  const frente1 = hh - FAIXA_DO_ESCUDO
  const frente0 = frente1 - larg
  const dentro = hw - FOLGA - larg
  const zSapata = g * ALTURA_DA_SAPATA
  const zFrente = g * ALTURA_DA_TRAVESSA_DA_FRENTE
  const zTras = g * ALTURA_DA_TRAVESSA_DE_TRAS

  const travessaDeTras = caixa(-dentro, tras0, dentro, tras1, 0.8 * k)
  const travessaDaFrente = caixa(-dentro, frente0, dentro, frente1, 0.8 * k)
  // A sapata começa onde o poste acaba: na 3/4 ela passa na frente do pé dele, e não por cima do poste inteiro.
  const sapatas = [-1, 1].map((lado) => caixa(Math.min(lado * dentro, lado * (hw - FOLGA)), tras1 - 0.2, Math.max(lado * dentro, lado * (hw - FOLGA)), frente1, 0.8 * k))
  const postes = [-1, 1].map((lado) => caixa(Math.min(lado * dentro, lado * (hw - FOLGA)), tras0, Math.max(lado * dentro, lado * (hw - FOLGA)), tras1, 0.6 * k))
  // O chão: o contato em volta do cavalete e a sombra do conjunto, caída para baixo à direita NA TELA (com o
  // objeto girado ela é desenhada na pegada já girada e desgirada, para a volta da 3/4 a pôr no lugar).
  const [meiaLargura, meioFundo] = q % 2 === 1 ? [hh, hw] : [hw, hh]
  const caida = caixa(-meiaLargura + 5 * k, -meioFundo + FOLGA + 4 * k, meiaLargura + 3.4 * k, meioFundo - FAIXA_DO_ESCUDO + 3 * k, 2 * k)
  cena.sombras.push(
    contato(caixa(-hw + FOLGA, tras0, hw - FOLGA, frente1, 1), 0.32),
    { forma: girarForma(caida, (4 - q) % 4), z: 0, suave: 2.6 * k, forca: 0.2 },
    { forma: travessaDeTras, z: zTras, solta: true, forca: 0.2 },
    { forma: travessaDaFrente, z: zFrente },
  )
  for (const sapata of sapatas) cena.sombras.push({ forma: sapata, z: zSapata })
  for (const poste of postes) cena.sombras.push({ forma: poste, z: g * ALTURA_DO_POSTE, forca: 0.24 })

  return {
    c,
    cena,
    k,
    tras0,
    tras1,
    frente0,
    frente1,
    dentro,
    zFrente,
    zTras,
    travessaDeTras,
    travessaDaFrente,
    sapatas,
    postes,
    pe: frente0 - 0.8 * k,
    guardaAte: frente1 - 0.8 * k,
    raio: ESCUDO.raio * k,
    xDoEscudo: ESCUDO.x * hw,
    chaoDoEscudo: frente1 + FAIXA_DO_ESCUDO * 0.6,
  }
}

/**
 * 1. O QUE FICA GUARDADO, por baixo de tudo: a face da travessa de trás e as fatias de baixo das armas.
 * Devolve as fatias do alto de cada arma, que vão por cima do quadro.
 */
function guardarArmas(v: Cavalete): Peca[] {
  const { c, cena, k, tras0, tras1, frente0, dentro, zTras, pe, guardaAte } = v
  const { hw, peca: P } = c
  const mad = c.m.madeira
  const L = cena.partes
  /** Onde o alto de cada arma fica na vista de cima e onde a fatia do alto é cortada (debaixo da travessa da frente). */
  const altoDeCima = tras0 + 0.8 * k
  const corteDeCima = frente0 + 1.2 * k
  const faceDeTras = novaFrente()
  faceDeTras.por(caixa(-dentro, tras1 - zTras, dentro, tras1 - zTras + FACE_DA_TRAVESSA * k, 0.6 * k), mad, { tabua: 0, bisel: 1 * k, tom: 0.8, contorno: 0.24, semente: 3500 })
  // Guardada logo atrás da travessa, debaixo do estrado: a âncora dela fica antes das das armas, e a 3/4 a pinta atrás delas.
  const zDaFace = zTras + 1.5 * k
  const ancoraDaFace = ancorar(cena, hw * 0.12, tras1 - zTras + (FACE_DA_TRAVESSA * k) / 2 + zDaFace, zDaFace)
  for (const peca of faceDeTras.pecas) {
    const copia = naFatia(P, peca, { de: -Infinity, ate: Infinity, ancora: ancoraDaFace })
    if (copia !== null) L.push(copia)
  }

  /** As fatias do alto de cada arma, para pintar depois do estrado. */
  const altos: Peca[] = []
  ARMAS.forEach((arma, i) => {
    const co = Math.cos(arma.tombo)
    const si = Math.sin(arma.tombo)
    const xDoPe = arma.x * hw
    const em = ([x, y]: Ponto): Ponto => [xDoPe + (x * co + y * si) * k, pe - (y * co - x * si) * k]
    const frente = novaFrente()
    arma.desenho({ em, k, aoComprido: QUARTO - arma.tombo, por: frente.por, semente: 3510 + i * 6 })
    /** O x do eixo da arma na altura `y` da tela: as âncoras ficam nele, dentro da lâmina ou da haste. */
    const noEixo = (y: number): number => xDoPe + (pe - y) * Math.tan(arma.tombo)
    const alto = pe - arma.comprimento * k
    const fimDoAlto = Math.min(pe, alto + (corteDeCima - altoDeCima))
    const zDoAlto = altoDeCima - alto
    // A âncora do alto fica no meio do quadro, em cima do eixo da arma.
    const yDaAncora = (tras1 + frente0) / 2 - 2 * k
    const fatiaDoAlto: Fatia = { de: alto - SOBRA_DO_ALTO * k, ate: fimDoAlto, ancora: ancorar(cena, noEixo(yDaAncora - zDoAlto), yDaAncora, zDoAlto) }
    for (const peca of frente.pecas) {
      const copia = naFatia(P, peca, fatiaDoAlto, SOMBRA_DA_ARMA)
      if (copia !== null) altos.push(copia)
    }
    // O resto, do corte até o pé, em fatias guardadas; a de baixo é a última (a 3/4 pinta do fundo para a frente).
    const resto = pe - fimDoAlto
    const fatias = Math.ceil(resto / (FATIA_MAXIMA * k))
    for (let j = 0; j < fatias; j += 1) {
      const de = fimDoAlto + (resto * j) / fatias
      const ate = fimDoAlto + (resto * (j + 1)) / fatias
      const z = guardaAte - ate
      const yDaFatia = Math.min(guardaAte - (ate - de) / 2, frente0 - 0.6 * k) - 0.6 * (fatias - 1 - j)
      const fatia: Fatia = { de, ate, ancora: ancorar(cena, noEixo(yDaFatia - z), yDaFatia, z) }
      for (const peca of frente.pecas) {
        const copia = naFatia(P, peca, fatia)
        if (copia !== null) L.push(copia)
      }
    }
  })
  return altos
}

/** O escudo em pé, no chão, na frente da travessa: a metade de baixo quase no lugar e a de cima guardada. */
function guardarEscudoEmPe(v: Cavalete): void {
  const { c, cena, k, frente1, guardaAte, raio, xDoEscudo, chaoDoEscudo } = v
  const P = c.peca
  const L = cena.partes
  const meioDoEscudo = chaoDoEscudo - raio
  const emPe = novaFrente()
  escudoDeFrente(emPe.por, xDoEscudo, meioDoEscudo, raio, raio, k)
  const zDeCima = guardaAte - meioDoEscudo - 0.6 * k
  const metades: readonly Fatia[] = [
    { de: -Infinity, ate: meioDoEscudo, ancora: ancorar(cena, xDoEscudo, frente1 + FAIXA_DO_ESCUDO * 0.3, zDeCima) },
    { de: meioDoEscudo, ate: Infinity, ancora: ancorar(cena, xDoEscudo, frente1 + FAIXA_DO_ESCUDO * 0.8, FRESTA) },
  ]
  for (const metade of metades) {
    for (const peca of emPe.pecas) {
      const copia = naFatia(P, peca, metade)
      if (copia !== null) L.push(copia)
    }
  }
}

/**
 * 2 e 3. O QUADRO, que esconde o que está guardado (o estrado no fundo, as sapatas, a travessa de trás e os
 * postes), o ALTO DAS ARMAS por cima dele e a travessa da frente por cima do corte delas.
 */
function montarQuadro(v: Cavalete, altos: readonly Peca[]): void {
  const { c, cena, k, tras0, tras1, frente0, frente1, dentro, travessaDeTras, travessaDaFrente, sapatas, postes } = v
  const P = c.peca
  const mad = c.m.madeira
  const L = cena.partes
  L.push(P(caixa(-dentro - 0.4, tras1 - 0.6, dentro + 0.4, frente0 + 0.6), mad, { tabua: (frente0 - tras1) / 3, bisel: 0.4, contorno: 0.1, tom: 0.6, recesso: { k: 2.2 * k, forca: 0.3 }, semente: 3501 }))
  sapatas.forEach((sapata, i) => L.push(P(sapata, mad, { eixo: QUARTO, tabua: 0, bisel: 1.1 * k, tom: 0.84, contorno: 0.26, semente: 3502 + i })))
  L.push(P(travessaDeTras, mad, { tabua: 0, bisel: 1.2 * k, contorno: 0.26, semente: 3504, projeta: { dist: 1.6, forca: 0.3 } }))
  postes.forEach((poste, i) => {
    L.push(P(poste, mad, { eixo: QUARTO, tabua: 0, bisel: 1.2 * k, tom: 1.1, contorno: 0.28, semente: 3505 + i, projeta: { dist: 1.2, forca: 0.3 } }))
    // A cavilha que prende a travessa no poste.
    L.push(P(elipse((poste.b[0] + poste.b[2]) / 2, (tras0 + tras1) / 2, 0.8 * k, 0.8 * k), mad, { tabua: 0, bisel: 0.5, tom: 0.62, contorno: 0.2 }))
  })

  L.push(...altos)
  L.push(P(travessaDaFrente, mad, { tabua: 0, bisel: 1.2 * k, tom: 0.96, contorno: 0.26, semente: 3507, projeta: { dist: 1, forca: 0.26 } }))
  for (const lado of [-1, 1]) L.push(P(elipse(lado * (dentro - 2.6 * k), (frente0 + frente1) / 2, 0.8 * k, 0.8 * k), mad, { tabua: 0, bisel: 0.5, tom: 0.62, contorno: 0.2 }))

}

/** 4. O ESCUDO VISTO DO ALTO, encostado na travessa da frente; na 3/4 sobe para trás do disco em pé. */
function porEscudoDoAlto(v: Cavalete): void {
  const { c, cena, k, zFrente, raio, xDoEscudo, chaoDoEscudo } = v
  const { hh, peca: P } = c
  const L = cena.partes
  const meioDoEscudo = chaoDoEscudo - raio
  const rx = raio * ESCUDO_DO_ALTO.rx
  const ry = raio * ESCUDO_DO_ALTO.ry
  const yDoAlto = hh - ry - 0.1
  // Mais alto que a travessa da frente, em cima da qual ele está: a âncora dele é a que vale ali.
  const ancoraDoAlto = ancorar(cena, xDoEscudo, yDoAlto, Math.max(zFrente + 1, yDoAlto - meioDoEscudo))
  const doAlto = (forma: Forma): Forma => presa(forma, ancoraDoAlto)
  cena.sombras.push(contato(elipse(xDoEscudo, yDoAlto + 0.6 * k, rx, ry), 0.3))
  L.push(P(doAlto(elipse(xDoEscudo, yDoAlto, rx, ry)), HASTE, { eixo: QUARTO, tabua: 5.4 * k, bisel: 0.9 * k, tom: 0.9, contorno: 0.3, semente: 3540, projeta: { dist: 1.6, forca: 0.36 } }))
  L.push(P(doAlto(dentroDe(elipse(xDoEscudo, yDoAlto, rx - 1.1 * k, ry - 0.5 * k), caixa(xDoEscudo - rx, yDoAlto - ry, xDoEscudo, yDoAlto + ry))), TINTA, { bisel: 0, contorno: 0, alfa: 0.92, textura: texDaTinta, semente: 3541 }))
  L.push(P(doAlto(anel(xDoEscudo, yDoAlto, rx, ry, rx - 1.9 * k, ry - 0.9 * k)), FERRO, { tabua: 0, bisel: 0.7 * k, tom: 0.84, contorno: 0.3, metal: 0.36, semente: 3542 }))
  L.push(P(doAlto(elipse(xDoEscudo, yDoAlto + 0.5 * k, 4 * k, 2.1 * k)), FERRO, { tabua: 0, bisel: 1.8 * k, tom: 1.16, contorno: 0.28, metal: 0.6, semente: 3544 }))
}

// ---------- a 3/4 com o objeto girado ----------

/** De lado, as armas tombam para a travessa de trás (radianos). */
const ENCOSTO_DE_LADO = 0.15
/** O pé das armas giradas fica um pouco mais para dentro do estrado (px do protótipo, no menor lado). */
const RECUO_DO_PE = 2.5
/** A âncora da arma em pé fica nesta altura dela, dentro da lâmina ou da haste (px do protótipo, no menor lado). */
const ALTURA_DA_ANCORA = 1.6
/** O que é desenhado direto na tela sobe quase nada: a âncora só entra na ordem em que a 3/4 pinta. */
const QUASE_NADA = 0.02
/** O escudo visto de perfil (o disco encostado, olhado de lado): os dois raios, em frações do raio. */
const ESCUDO_DE_PERFIL = { rx: 0.32, ry: 1.1 }

/**
 * A 3/4 DO SUPORTE GIRADO (`q` quartos de volta). O quadro é o da vista de
 * cima, com as estruturas de verdade: a 3/4 o gira e o varre sozinha. As
 * armas não podem ir fatiadas (as fatias girariam junto e sairiam deitadas ou
 * de ponta-cabeça): aqui cada uma é desenhada inteira, em pé, de frente para
 * quem olha, com o pé onde o giro o pôs, e sai desgirada da fábrica
 * (`pecaNaTela`). De lado (um quarto de volta) elas tombam para a travessa de
 * trás e o escudo aparece de perfil, do lado de fora da travessa da frente;
 * de costas (meia volta) ficam atrás da travessa de trás, que ganha a face.
 */
function porArmasGiradas(v: Cavalete, q: number): void {
  const { c, cena, k, tras0, frente1, dentro, zTras, pe, raio, xDoEscudo, chaoDoEscudo } = v
  const P = pecaNaTela(c.peca, q)
  const tela: Cena = { partes: [], sombras: [] }
  const deCostas = q === 2
  // Para que lado da tela ficou o fundo do suporte: 1 à direita, -1 à esquerda, 0 de costas.
  const [fundo] = girarPonto(0, -1, q)
  // De costas a arma é vista pelo outro lado: o machado aponta para o lado contrário.
  const espelho = deCostas ? -1 : 1
  ARMAS.forEach((arma, i) => {
    const [px, py] = girarPonto(arma.x * c.hw, pe - RECUO_DO_PE * k, q)
    const tombo = deCostas ? -arma.tombo : fundo * ENCOSTO_DE_LADO + arma.tombo
    const co = Math.cos(tombo)
    const si = Math.sin(tombo)
    const em = ([x, y]: Ponto): Ponto => [px + (espelho * x * co + y * si) * k, py - (y * co - espelho * x * si) * k]
    const frente = novaFrente()
    arma.desenho({ em, k, aoComprido: QUARTO - tombo, por: frente.por, semente: 3510 + i * 6 })
    const [ax, ay] = em([0, ALTURA_DA_ANCORA])
    const ancora = ancorar(tela, ax, ay, QUASE_NADA)
    for (const peca of frente.pecas) tela.partes.push(P(presa(peca.forma, ancora), peca.mat, { ...peca.o, projeta: SOMBRA_DA_ARMA }))
  })

  // O escudo, onde o giro o pôs: de costas, inteiro, lá atrás (a travessa da frente passa na frente do pé dele);
  // de lado, de perfil, encostado por fora na travessa da frente.
  const [ex, ey] = girarPonto(xDoEscudo, chaoDoEscudo, q)
  const escudo = novaFrente()
  const rx = deCostas ? raio : raio * ESCUDO_DE_PERFIL.rx
  const ry = deCostas ? raio : raio * ESCUDO_DE_PERFIL.ry
  const cx = deCostas ? ex : -fundo * (frente1 + rx * 0.9)
  const chao = deCostas ? ey : ey + raio * 0.9
  escudoDeFrente(escudo.por, cx, chao - ry, rx, ry, k)
  const ancoraDoEscudo = ancorar(tela, cx, chao - 2 * k, QUASE_NADA)
  for (const peca of escudo.pecas) tela.partes.push(P(presa(peca.forma, ancoraDoEscudo), peca.mat, peca.o))

  if (deCostas) {
    // A travessa de trás ficou na frente: a face dela, que a 3/4 não varre (o perfil não dá beirada aos tampos soltos).
    const alto = -tras0 - zTras
    const ancoraDaFace = ancorar(tela, c.hw * 0.12, alto + (FACE_DA_TRAVESSA * k) / 2, QUASE_NADA)
    tela.partes.push(P(presa(caixa(-dentro, alto, dentro, alto + FACE_DA_TRAVESSA * k, 0.6 * k), ancoraDaFace), c.m.madeira, { tabua: 0, bisel: 1 * k, tom: 0.8, contorno: 0.24, semente: 3500 }))
  }

  // As peças já saíram desgiradas da fábrica; as âncoras (que são sombras) são desgiradas aqui.
  cena.partes.push(...tela.partes)
  for (const sombra of tela.sombras) cena.sombras.push({ ...sombra, forma: girarForma(sombra.forma, (4 - q) % 4) })
}

export const montarSuporteDeArmas: MontarMovel = (c, cena) => {
  const q = quartosDoGiro(c.giro)
  const v = medirCavalete(c, cena, q)
  if (q !== 0) {
    montarQuadro(v, [])
    porArmasGiradas(v, q)
    return
  }
  const altos = guardarArmas(v)
  guardarEscudoEmPe(v)
  montarQuadro(v, altos)
  porEscudoDoAlto(v)
}
