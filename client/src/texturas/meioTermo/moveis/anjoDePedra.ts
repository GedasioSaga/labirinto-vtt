/**
 * ANJO DE PEDRA (lote 8 dos objetos novos, 11/11/2026), EM PÉ, de frente como
 * o espantalho e a lápide: a estátua de cemitério vista de cima seria uma roda
 * de cabelo entre duas asas, e ninguém diria o que é. A FIGURA alada de manto,
 * de cabeça baixa e mãos juntas na frente do peito, sobre um PEDESTAL baixo.
 *
 * A figura é feita de contornos, nunca de cilindros (a crítica da estátua do
 * lote 2, que na 3/4 virou peça de xadrez): as ASAS fechadas sobem por trás dos
 * ombros até o punho, acima da cabeça, e caem até perto dos pés, com as penas
 * compridas embaixo (as pontas recortam a beira) e as coberteiras em fileiras
 * de escamas, sobrepostas como telha; o MANTO desce dos ombros abrindo em
 * PREGAS de relevo até a barra ondulada; as MANGAS largas pendem dos
 * antebraços; as MÃOS juntas, de dedos para cima; a CABEÇA baixa, com o cabelo
 * cobrindo a testa, o rosto na sombra, os olhos fechados e duas mechas caídas
 * nos ombros. O corpo faz sombra nas asas, a manga no manto, o cabelo no rosto.
 *
 * O tempo: a pedra escorrida de chuva (faixas escuras de pé, mais fortes no
 * pedestal), manchas, musgo nos cantos do pedestal e ao pé, líquen claro nas
 * asas e na cornija. A plaquinha do pedestal tem uma inscrição gasta, que não
 * se lê. Nenhum símbolo de religião de verdade.
 *
 * O desenho é feito numa casa de 56 px e escala com o menor lado da pegada;
 * o punho das asas fica rente ao alto da pegada (o anjo cabe nela). A sombra
 * no chão é a do anjo em pé: o pedestal, o corpo, a cabeça e as asas, cada um
 * arrastado do chão até a sua altura. Material: `pedra`. O musgo
 * e o líquen são fixos. O piso de luz é um cinza quente (`cena.corDoPiso`): com
 * o escuro da nogueira a beira da pedra na sombra saía marrom.
 */
import { hash, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { caixa, capsula, dentroDe, elipse, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'

/** O lado da casa em que o anjo é desenhado (px do protótipo). */
const CASA = 56

// As alturas do desenho, em y da casa (0 no meio, para baixo cresce).
/** O chão na frente do soco, de onde as sombras saem, e o tampo do pedestal, onde o anjo pisa. */
const CHAO = 24.5
const TAMPO = 5.4
/** A barra do manto, o ombro, o meio da cabeça e o punho das asas (o alto do desenho). */
const BARRA = 7.4
const OMBRO = -13.4
const CABECA = -19.4
const PUNHO_DA_ASA = -28.6

/** O pedestal: meia largura do soco, do dado e da cornija, e onde cada faixa começa e acaba (y da casa). */
const SOCO = { meia: 23, topo: 19.8, frente: 21.2 }
const DADO = { meia: 19.5, topo: 10.6, pe: 20.2 }
const CORNIJA = { meia: 21, frente: 8.2, pe: 10.9 }
/** A plaquinha rebaixada do dado e as duas linhas gastas da inscrição. */
const PLACA = { meia: 11, topo: 12.6, pe: 18.2 }

/** Os tons da figura e do pedestal (vezes o tom da pedra): o anjo mais claro que a base, as asas mais escuras que o corpo. */
const TOM_DA_FIGURA = 1.08
const TOM_DA_ASA = 0.86
const TOM_DA_PENA = 0.98
const TOM_DA_PREGA = 1.16
const TOM_DO_ROSTO = 0.9

/** O musgo (o das rochas e da estátua): o verde-oliva do Meio-Termo puxado para a pedra. */
const TOM_DO_MUSGO: Rgb = rgb(tomDoMeio('musgo', 0.84))
const QUANTO_DE_PEDRA_NO_MUSGO = 0.16
const RAIO_DA_BOLINHA = 1.05
const BOLINHAS_POR_AREA = 0.24
/** O líquen: rodelas claras e meio transparentes. */
const LIQUEN: MaterialDaPeca = { classe: 'liso', rgb: [0xbe, 0xbb, 0xa0] }
/** O sulco escuro (a linha entre as mãos, os olhos fechados, a inscrição gasta): a pedra bem mais escura. */
const TOM_DO_SULCO = 0.5
/** O escuro em que o pixel escuro demais é levantado: o cinza quente das rochas. */
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

/** O escorrido da chuva: faixas finas de pé (largura e comprimento do ruído) e quanto elas escurecem. */
const LARGURA_DO_ESCORRIDO = 0.7
const COMPRIMENTO_DO_ESCORRIDO = 0.045
const CHUVA_NA_FIGURA = 0.32
const CHUVA_NO_PEDESTAL = 0.62
/** Os fios do cabelo: quantos sulcos em volta do redemoinho e quanto escurecem. */
const FIOS_DO_CABELO = 22
const FUNDO_DO_FIO = 0.12

/** Põe na cena uma peça desenhada na casa de 56 px (quem chama a leva para o tamanho da pegada). */
type Por = (forma: Forma, mat: MaterialDaPeca, o?: OpcoesDaPeca) => void

/**
 * Cápsula de pontas desiguais (o cone de pontas redondas, a de Inigo Quilez):
 * raio `ra` em (ax, ay) e `rb` em (bx, by). Faz as penas (largas na raiz,
 * finas na ponta), as escamas das coberteiras e as pregas do manto.
 */
function conico(ax: number, ay: number, ra: number, bx: number, by: number, rb: number): Forma {
  const caixaDoCone: Caixa = [Math.min(ax - ra, bx - rb), Math.min(ay - ra, by - rb), Math.max(ax + ra, bx + rb), Math.max(ay + ra, by + rb)]
  const dx = bx - ax
  const dy = by - ay
  const h = Math.hypot(dx, dy)
  if (h <= Math.abs(ra - rb) + 1e-6) {
    const [cx, cy, r] = ra >= rb ? [ax, ay, ra] : [bx, by, rb]
    return { b: caixaDoCone, d: (x, y) => Math.hypot(x - cx, y - cy) - r }
  }
  const ux = dx / h
  const uy = dy / h
  const b = (ra - rb) / h
  const a = Math.sqrt(1 - b * b)
  return {
    b: caixaDoCone,
    d(x, y) {
      const px = x - ax
      const py = y - ay
      const aoLongo = px * ux + py * uy
      const atraves = Math.abs(px * uy - py * ux)
      const k = a * aoLongo - b * atraves
      if (k < 0) return Math.sqrt(atraves * atraves + aoLongo * aoLongo) - ra
      if (k > a * h) return Math.sqrt(atraves * atraves + (aoLongo - h) * (aoLongo - h)) - rb
      return atraves * a + aoLongo * b - ra
    },
  }
}

/** Os pontos do lado direito espelhados para o esquerdo. */
function espelho(pontos: readonly Ponto[]): Ponto[] {
  return pontos.map(([x, y]): Ponto => [-x, y])
}

/** A pedra com o escorrido da chuva (faixas de pé, finas e desiguais) e manchas largas do tempo. */
function texDaChuva(forca: number): Textura {
  const pedra = texturaDaClasse('pedra')
  return (u, v, x, y, p, s, escala) => {
    if (pedra !== null) pedra(u, v, x, y, p, s, escala)
    const faixa = ruido(x * LARGURA_DO_ESCORRIDO + 41, y * COMPRIMENTO_DO_ESCORRIDO + 9)
    if (faixa > 0.08) s[3] -= (faixa - 0.08) * forca
    const mancha = ruido(x * 0.13 + 3, y * 0.13 + 17)
    if (mancha > 0.12) s[3] -= (mancha - 0.12) * forca * 0.7
  }
}

/** O cabelo: a pedra com os fios saindo do redemoinho (cx, cy), em sulcos rasos. */
function texDoCabelo(cx: number, cy: number): Textura {
  const chuva = texDaChuva(CHUVA_NA_FIGURA)
  return (u, v, x, y, p, s, escala) => {
    chuva(u, v, x, y, p, s, escala)
    const fase = ((Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI)) * FIOS_DO_CABELO + ruido(x * 0.3, y * 0.3) * 0.8
    const f = Math.abs(fase - Math.floor(fase) - 0.5)
    if (f < 0.16) s[3] -= FUNDO_DO_FIO * (1 - f / 0.16)
  }
}

// ---------- o pedestal ----------

/** Os tufos de musgo do pedestal e do pé: o meio, os dois raios (px da casa). */
const MUSGO_DO_PEDESTAL: readonly (readonly [number, number, number, number])[] = [
  [-18.6, 6.4, 3.2, 1.6],
  [18.4, 7.2, 2.2, 1.3],
  [-21.4, 20.4, 2.6, 1.4],
  [20.6, 21, 3.4, 1.6],
  [-22.2, 24.2, 3.6, 1.5],
  [13.6, 24.6, 3, 1.3],
  [19.6, 10.4, 1.5, 1.2],
]
/** O líquen do pedestal: o meio e o raio. */
const LIQUEN_DO_PEDESTAL: readonly (readonly [number, number, number])[] = [
  [14, 13.6, 2.2],
  [-12.6, 9.4, 1.6],
  [-16.2, 16.8, 1.8],
]

function montarPedestal(por: Por, pedra: MaterialDaPeca): void {
  const chuvaForte = texDaChuva(CHUVA_NO_PEDESTAL)
  const chuvaFraca = texDaChuva(CHUVA_NA_FIGURA)
  // O soco, o degrau do pé: a frente e o tampo dele, na frente do dado.
  por(caixa(-SOCO.meia, SOCO.frente, SOCO.meia, CHAO, 0.5), pedra, { bisel: 1, tom: 0.8, contorno: 0.28, textura: chuvaFraca, semente: 501 })
  por(caixa(-SOCO.meia, SOCO.topo, SOCO.meia, SOCO.frente + 0.2, 0.4), pedra, { bisel: 0.7, tom: 1.02, contorno: 0.26, textura: chuvaFraca, semente: 502 })
  // O dado, com a plaquinha rebaixada e a inscrição gasta.
  por(caixa(-DADO.meia, DADO.topo, DADO.meia, DADO.pe, 0.4), pedra, { bisel: 1.1, tom: 0.88, contorno: 0.28, textura: chuvaForte, semente: 503 })
  por(caixa(-PLACA.meia, PLACA.topo, PLACA.meia, PLACA.pe, 0.4), pedra, { bisel: 0.5, tom: 0.92, contorno: 0.2, recesso: { k: 1.2, forca: 0.32 }, textura: chuvaForte, semente: 504 })
  for (const [meia, y] of [[7.6, 14.6], [5.4, 16.4]] as const) {
    por(capsula(-meia, y, meia, y, 0.36), pedra, { bisel: 0, contorno: 0, tom: TOM_DO_SULCO, alfa: 0.55, semente: 505 })
  }
  // A cornija, que sai do dado e faz sombra nele, e o tampo dela, onde o anjo pisa.
  por(caixa(-CORNIJA.meia, CORNIJA.frente, CORNIJA.meia, CORNIJA.pe, 0.5), pedra, { bisel: 0.9, tom: 0.94, contorno: 0.28, textura: chuvaFraca, semente: 506, projeta: { dist: 1.1, forca: 0.3 } })
  por(caixa(-CORNIJA.meia, TAMPO, CORNIJA.meia, CORNIJA.frente + 0.2, 0.4), pedra, { bisel: 0.7, tom: 1.08, contorno: 0.26, textura: chuvaFraca, semente: 507 })
  LIQUEN_DO_PEDESTAL.forEach(([x, y, r], k) => {
    por(elipse(x, y, r, r * 0.72), LIQUEN, { bisel: 0, contorno: 0, alfa: 0.4, suave: 0.6, semente: 510 + k })
  })
}

/** Um tufo de musgo: um punhado de bolinhas sorteadas na mancha de meio (cx, cy) e raios (rx, ry), cada uma com o seu tom. */
function tufoDeMusgo(por: Por, cor: MaterialDaPeca, cx: number, cy: number, rx: number, ry: number, sem: number): void {
  const bolinhas = Math.max(3, Math.round(Math.PI * rx * ry * BOLINHAS_POR_AREA))
  for (let i = 0; i < bolinhas; i += 1) {
    // Mais bolinhas perto do meio da mancha (a raiz do sorteio as espalharia por igual).
    const longe = hash(i, sem, 135)
    const t = hash(i, sem, 136) * 2 * Math.PI
    const r = RAIO_DA_BOLINHA * (0.7 + 0.7 * hash(i, sem, 137))
    por(elipse(cx + Math.cos(t) * rx * longe, cy + Math.sin(t) * ry * longe, r, r * 0.86), cor, { bisel: r * 0.7, contorno: 0.26, tom: 0.82 + 0.3 * hash(i, sem, 138), semente: sem * 31 + i })
  }
}

// ---------- as asas ----------

/** A asa direita (a esquerda é o espelho): da raiz no ombro, sobe pela beira de dentro até o punho e desce pela de fora até as pontas das penas. */
const ASA: readonly Ponto[] = [
  [4.8, -13.6],
  [5.3, -19.5],
  [6.5, -23.6],
  [8.3, -26.6],
  [10.7, PUNHO_DA_ASA + 0.2],
  [12.7, PUNHO_DA_ASA],
  [14.7, -27.4],
  [16.4, -24.6],
  [17.4, -20.4],
  [17.8, -15],
  [17.5, -9.5],
  [16.6, -4.4],
  [15.6, 0.2],
  [14.6, 2.6],
  [13.6, 1.2],
  [12.4, 5],
  [11.4, 3.4],
  [10.4, 6],
  [9.4, 4.2],
  [8.2, 4.6],
  [6.6, 0.8],
]
/** As penas compridas (a raiz larga e a ponta fina, nas pontas da beira de baixo): x, y e raio da raiz, x, y e raio da ponta. */
const PENAS: readonly (readonly [number, number, number, number, number, number])[] = [
  [16.4, -15.2, 1.5, 14.6, 2.6, 0.5],
  [14.4, -15.6, 1.6, 12.4, 5, 0.5],
  [12.2, -15.6, 1.6, 10.4, 6, 0.5],
  [10, -15.2, 1.5, 8.5, 4.4, 0.5],
]
/**
 * As coberteiras, em fileiras de escamas de baixo para cima (cada fileira cobre a raiz da de baixo, como
 * telha): x, o alto e o pé de cada escama, o raio de cima e o de baixo (a escama é redonda embaixo).
 */
const FILEIRAS: readonly (readonly (readonly [number, number, number, number, number])[])[] = [
  [
    [16.3, -20.6, -14.6, 0.9, 1.9],
    [14.2, -20.8, -14.4, 0.9, 2],
    [12.1, -20.6, -14.2, 0.9, 2],
    [10, -20.2, -14.2, 0.9, 1.9],
    [7.9, -19.8, -14.4, 0.9, 1.8],
  ],
  [
    [15.6, -24.6, -20.2, 0.8, 1.6],
    [13.6, -25.2, -19.8, 0.8, 1.7],
    [11.5, -25.2, -19.8, 0.8, 1.7],
    [9.4, -24.8, -19.8, 0.8, 1.7],
    [7.4, -23.8, -19.6, 0.8, 1.6],
  ],
  [
    [14.6, -27.4, -23.8, 0.65, 1.4],
    [12.6, -27.8, -23.6, 0.65, 1.45],
    [10.6, -27.4, -23.6, 0.65, 1.45],
    [8.7, -26.4, -23.4, 0.65, 1.35],
  ],
  [
    [13.4, -28.4, -26.6, 0.55, 1.1],
    [11.4, -28.2, -26.4, 0.55, 1.1],
  ],
]

/** Uma asa: o fundo escuro (o vão entre as penas), as penas compridas e as fileiras de escamas, de baixo para cima. */
function montarAsa(por: Por, pedra: MaterialDaPeca, lado: 1 | -1): void {
  const chuva = texDaChuva(CHUVA_NA_FIGURA)
  const pontos = lado === 1 ? [...ASA] : espelho(ASA)
  const asa = poligono(pontos)
  por(asa, pedra, { bisel: 2.2, tom: TOM_DA_ASA * TOM_DA_FIGURA, contorno: 0.3, textura: chuva, semente: 520 + lado })
  // Do lado direito da tela para o esquerdo: a pena da esquerda fica por cima e faz sombra na da direita (a luz vem da esquerda).
  const porX = <T extends readonly number[]>(lista: readonly T[]): T[] => [...lista].sort((a, b) => lado * (b[0] - a[0]))
  porX(PENAS).forEach(([ax, ay, ra, bx, by, rb], i) => {
    por(dentroDe(conico(lado * ax, ay, ra, lado * bx, by, rb), asa), pedra, {
      bisel: 0.9,
      tom: TOM_DA_PENA * TOM_DA_FIGURA * (0.97 + 0.06 * hash(i, lado + 3, 521)),
      contorno: 0.3,
      textura: chuva,
      semente: 530 + i,
      projeta: { dist: 0.7, forca: 0.26 },
    })
  })
  FILEIRAS.forEach((fileira, f) => {
    porX(fileira).forEach(([x, alto, pe, rAlto, rPe], i) => {
      por(dentroDe(conico(lado * x, alto, rAlto, lado * x, pe, rPe), asa), pedra, {
        bisel: 0.8,
        tom: TOM_DA_PENA * TOM_DA_FIGURA * (1 + 0.025 * f) * (0.97 + 0.06 * hash(i, f + 7, 522)),
        contorno: 0.3,
        textura: chuva,
        semente: 540 + f * 10 + i,
        projeta: { dist: 0.6, forca: 0.24 },
      })
    })
  })
}

// ---------- o manto, as mangas e as mãos ----------

/** O manto, dos ombros à barra (o lado direito; o esquerdo é o espelho), largo embaixo. */
const MANTO_DIREITO: readonly Ponto[] = [
  [1.9, -15.8],
  [5.6, OMBRO - 0.5],
  [6.6, OMBRO + 1],
  [6.6, -8],
  [6, -2],
  [6.8, 2],
  [8.4, 5],
  [9.4, BARRA - 0.4],
  [6, BARRA],
  [2, BARRA + 0.3],
]
/** As pregas do manto, das mãos à barra (x, y e raio de cima, x, y e raio de baixo): a ponta de baixo ondula a barra. */
const PREGAS: readonly (readonly [number, number, number, number, number, number])[] = [
  [-5, 0.6, 0.55, -8.1, 6.6, 1.05],
  [-3.2, -3.4, 0.6, -5.5, 6.9, 1.3],
  [-1, -5, 0.5, -2.2, 7.2, 1.25],
  [1.2, -5, 0.5, 1.6, 7.3, 1.2],
  [3.4, -3.2, 0.6, 5, 7, 1.3],
  [5.4, 1, 0.55, 7.9, 6.7, 1.05],
]
/** A manga direita: do ombro ao cotovelo, a boca larga no pulso e o pano que pende do antebraço até a ponta. */
const MANGA: readonly Ponto[] = [
  [5, -13.6],
  [6.9, -12.9],
  [8, -10.2],
  [8.6, -6],
  [8.5, -2.4],
  [7.6, 1.2],
  [6.6, 3.2],
  [5.5, 0.6],
  [4.2, -2.6],
  [2.6, -5.8],
  [1.6, -7.4],
  [1.5, -9.2],
  [3, -8.8],
  [4.6, -8.2],
  [5, -10.6],
]
/** As dobras de cada manga, ao comprido do pano que pende. */
const DOBRAS_DA_MANGA: readonly (readonly [number, number, number, number, number, number])[] = [
  [7.5, -6.2, 0.45, 6.9, 2.2, 0.75],
  [5.3, -5, 0.4, 5.7, 0, 0.6],
]

function montarManto(por: Por, pedra: MaterialDaPeca): void {
  const chuva = texDaChuva(CHUVA_NA_FIGURA)
  // O corpo faz sombra nas asas, atrás dele.
  const manto = poligono([...MANTO_DIREITO, ...espelho(MANTO_DIREITO).reverse()])
  por(manto, pedra, { bisel: 1.8, tom: TOM_DA_FIGURA * 0.94, contorno: 0.3, textura: chuva, semente: 560, projeta: { dist: 1.5, forca: 0.32 } })
  PREGAS.forEach(([ax, ay, ra, bx, by, rb], i) => {
    por(conico(ax, ay, ra, bx, by, rb), pedra, { bisel: rb, tom: TOM_DA_FIGURA * TOM_DA_PREGA * (0.97 + 0.06 * hash(i, 2, 561)), contorno: 0.22, textura: chuva, semente: 562 + i, projeta: { dist: 0.6, forca: 0.2 } })
  })
  // A gola em V, por baixo do cabelo.
  for (const lado of [-1, 1]) por(conico(lado * 2.8, -14.8, 0.45, 0, -13, 0.6), pedra, { bisel: 0.6, tom: TOM_DA_FIGURA * TOM_DA_PREGA, contorno: 0.22, textura: chuva, semente: 570 })
}

function montarMangasEMaos(por: Por, pedra: MaterialDaPeca): void {
  const chuva = texDaChuva(CHUVA_NA_FIGURA)
  for (const lado of [-1, 1] as const) {
    const pontos = lado === 1 ? [...MANGA] : espelho(MANGA)
    por(poligono(pontos), pedra, { bisel: 1.6, tom: TOM_DA_FIGURA * (lado < 0 ? 1.02 : 0.97), contorno: 0.3, textura: chuva, semente: 575 + lado, projeta: { dist: 1.2, forca: 0.28 } })
    DOBRAS_DA_MANGA.forEach(([ax, ay, ra, bx, by, rb], i) => {
      por(conico(lado * ax, ay, ra, lado * bx, by, rb), pedra, { bisel: rb, tom: TOM_DA_FIGURA * TOM_DA_PREGA, contorno: 0.2, textura: chuva, semente: 578 + i })
    })
  }
  // As mãos juntas, de dedos para cima (para o rosto baixo), e a linha entre as palmas.
  por(conico(0, -7.6, 1.35, 0.15, -12.3, 0.55), pedra, { bisel: 1, tom: TOM_DA_FIGURA * 1.08, contorno: 0.3, textura: chuva, semente: 580, projeta: { dist: 0.8, forca: 0.24 } })
  por(conico(0.05, -8, 0.17, 0.12, -11.8, 0.12), pedra, { bisel: 0, contorno: 0, tom: TOM_DO_SULCO, alfa: 0.7, semente: 581 })
}

// ---------- a cabeça ----------

/** O redemoinho do cabelo, de onde os fios saem (a cabeça baixa mostra o alto dela). */
const REDEMOINHO: Ponto = [-0.3, -23.4]

function montarCabeca(por: Por, pedra: MaterialDaPeca): void {
  const chuva = texDaChuva(CHUVA_NA_FIGURA)
  const cabelo = texDoCabelo(REDEMOINHO[0], REDEMOINHO[1])
  // O cabelo de trás, com as duas mechas caídas nos ombros; o rosto baixo na sombra; o nariz e os olhos fechados.
  const nuca = uniao(uniao(elipse(-0.3, CABECA - 0.2, 4.1, 4.1), conico(-3.4, -18.4, 1.7, -4.3, -12.6, 0.9)), conico(3, -18.4, 1.7, 3.9, -12.8, 0.9))
  por(nuca, pedra, { bisel: 1.8, tom: TOM_DA_FIGURA, contorno: 0.3, textura: cabelo, semente: 590, projeta: { dist: 1, forca: 0.26 } })
  por(elipse(-0.5, -17.5, 2.45, 2.6), pedra, { bisel: 1.4, tom: TOM_DA_FIGURA * TOM_DO_ROSTO, contorno: 0.26, textura: chuva, semente: 591 })
  por(conico(-0.45, -17.6, 0.3, -0.4, -16.2, 0.45), pedra, { bisel: 0.4, tom: TOM_DA_FIGURA * 1.1, contorno: 0.14, textura: chuva, semente: 592 })
  for (const [ax, bx] of [[-1.75, -0.95], [0.05, 0.85]] as const) {
    por(capsula(ax, -17.2, bx, -17.05, 0.2), pedra, { bisel: 0, contorno: 0, tom: TOM_DO_SULCO, alfa: 0.75, semente: 593 })
  }
  // O cabelo da testa, por cima do rosto: a cabeça baixa esconde a metade de cima da cara.
  por(elipse(-0.4, -20.5, 3.6, 2.25), pedra, { bisel: 1.4, tom: TOM_DA_FIGURA * 1.04, contorno: 0.26, textura: cabelo, semente: 594, projeta: { dist: 0.9, forca: 0.32 } })
}

/** Os líquens da figura: o meio e o raio (assimétricos: o tempo não é simétrico). */
const LIQUEN_DA_FIGURA: readonly (readonly [number, number, number])[] = [
  [11.6, -25.4, 1.5],
  [-13.8, -22.2, 1.3],
  [-15.6, -8, 1.2],
  [7.6, 4.4, 1],
]

export const montarAnjoDePedra: MontarMovel = (c, cena) => {
  const e = Math.min(c.w, c.h) / CASA
  /** A forma desenhada na casa de 56 px, no tamanho da pegada. */
  const naPegada = (f: Forma): Forma => (e === 1 ? f : { b: [f.b[0] * e, f.b[1] * e, f.b[2] * e, f.b[3] * e], d: (x, y) => f.d(x / e, y / e) * e })
  const por: Por = (forma, mat, o) => {
    cena.partes.push(c.peca(naPegada(forma), mat, o))
  }
  const pedra = c.m.pedra
  cena.corDoPiso = ESCURO_DA_PEDRA

  // A sombra do anjo em pé: o soco rente e o pedestal arrastado; o corpo, a cabeça e as asas arrastados do chão
  // ao alto de cada um (o trecho até o tampo some debaixo da sombra do pedestal, que é mais forte: elas não somam).
  const altura = (y: number): number => (CHAO - y) * e
  cena.sombras.push(contato(naPegada(caixa(-SOCO.meia - 0.4, CHAO - 1.8, SOCO.meia + 0.4, CHAO + 0.4, 0.6)), 0.32))
  cena.sombras.push({ forma: naPegada(caixa(-SOCO.meia, CHAO - 1.4, SOCO.meia, CHAO + 0.2, 0.6)), z: altura(TAMPO), forca: 0.3 })
  cena.sombras.push({ forma: naPegada(elipse(0, CHAO - 0.6, 9.4, 1.9)), z: altura(OMBRO), forca: 0.28 })
  cena.sombras.push({ forma: naPegada(elipse(0, CHAO - 0.6, 3.8, 1.6)), z: altura(CABECA - 4), forca: 0.28 })
  for (const lado of [-1, 1]) cena.sombras.push({ forma: naPegada(elipse(lado * 12.6, CHAO - 0.6, 4.6, 1.8)), z: altura(PUNHO_DA_ASA), forca: 0.26 })

  montarPedestal(por, pedra)
  const musgo: MaterialDaPeca = { classe: 'folha', rgb: misturar(TOM_DO_MUSGO, pedra.rgb, QUANTO_DE_PEDRA_NO_MUSGO) }
  MUSGO_DO_PEDESTAL.forEach(([x, y, rx, ry], k) => tufoDeMusgo(por, musgo, x, y, rx, ry, 600 + k))
  montarAsa(por, pedra, 1)
  montarAsa(por, pedra, -1)
  montarManto(por, pedra)
  montarMangasEMaos(por, pedra)
  montarCabeca(por, pedra)
  LIQUEN_DA_FIGURA.forEach(([x, y, r], k) => {
    por(elipse(x, y, r, r * 0.75), LIQUEN, { bisel: 0, contorno: 0, alfa: 0.38, suave: 0.5, semente: 620 + k })
  })
  // O musgo que subiu na barra do manto e nas pontas das penas, onde a água para.
  tufoDeMusgo(por, musgo, -6.4, BARRA + 0.2, 2.2, 0.9, 630)
  tufoDeMusgo(por, musgo, 10.8, 5.6, 1.8, 0.9, 631)
}
