/**
 * MESA DE JOGO de cima com volume (lote 11 dos objetos novos, 11/11/2026): a
 * mesa de taverna no meio de uma partida. Em cima, o TABULEIRO de damas, oito
 * por oito, na moldura escura, com as pedras claras e as cor de vinho no meio
 * do jogo (uma dama dobrada já chegou ao fundo) e as pedras comidas fora dele,
 * do lado de quem comeu; as CARTAS abertas em leque, o MONTE de cartas
 * viradas, dois DADOS, as MOEDAS empilhadas (latão, cobre e prata) e duas
 * CANECAS, a de madeira com a cerveja escura e a de estanho com espuma. Dos
 * dois lados, os BANQUINHOS redondos de três pés, puxados para fora.
 *
 * O que lê a 25% de zoom é o quadriculado: ele é maior que um tabuleiro de
 * verdade (as coisas de cima da mesa crescem, como os pratos), e as casas
 * claras e escuras ficam bem longe uma da outra na luz. A mesa é a da
 * `mesaComPernas` (o tampo de tábuas com a borda clara, a espessura embaixo,
 * as pernas nas quinas e a sombra de baixo), e o banquinho é a banqueta em
 * miniatura (os pés abrindo para fora, as travessas e o assento gasto).
 *
 * As posições saem de frações da pegada (desenho em 84 x 84 px, 1,5 x 1,5
 * casas) e os tamanhos do menor lado; as alturas são em casas. Na 3/4 a mesa
 * sobe como a mesa (o tampo solto nas pernas) e cada banquinho como a banqueta
 * (os pés em fatias, a estrutura do assento só o miolo). Por isso o perfil é o
 * derivado SEM beirada, como o da banqueta: a espessura do tampo e a dos
 * assentos são as peças deslocadas, nas duas vistas. Nenhum pé de banquinho
 * passa debaixo do tampo: a fatia debaixo dele subiria até a altura da mesa.
 * Material: `madeira` (a mesa e os banquinhos); o resto é fixo.
 */
import { anel, barra, caixa, capsula, dentroDe, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { BURACO, materialDaPeca, QUARTO, tomLongeDoChao, type ContextoDoMovel, type MontarMovel } from './contexto'
import { tomDoMeio } from '../materiais'
import { rgb } from '../../ruido'

/** O lado em que a mesa é desenhada (px do protótipo): 1,5 x 1,5 casas. */
const LADO_DO_DESENHO = 84

// ---------- a mesa ----------

/** O tampo (px do desenho): mais estreito que a pegada, para os banquinhos caberem dos lados. */
const TAMPO = { x0: -25, y0: -30, x1: 25, y1: 26, quina: 2.2 } as const
/** A altura do tampo e a do assento dos banquinhos, em casas. */
const ALTURA_DA_MESA = 0.5
const ALTURA_DO_BANQUINHO = 0.3
/** A perna: o lado e quanto ela sai do tampo na quina. */
const LADO_DA_PERNA = 6
const PERNA_PARA_FORA = 3
/** A tábua do tampo, a espessura que aparece embaixo e à direita, e a borda clara. */
const LARGURA_DA_TABUA = 11.2
const ESPESSURA_EMBAIXO = 2.4
const ESPESSURA_A_DIREITA = 0.45
const LARGURA_DA_BORDA_CLARA = 3.1
const LUZ_DA_BORDA_CLARA = 0.2
/** As sombras (as da `mesaComPernas`). */
const SOMBRA_DE_BAIXO_ALEM = 1.4
const FORCA_DA_SOMBRA_DE_BAIXO = 0.4
const FORCA_DA_SOMBRA_DO_TAMPO = 0.22
const FORCA_DO_CONTATO_DA_PERNA = 0.34
const FORCA_DA_SOMBRA_DA_PERNA = 0.3

// ---------- os materiais fixos ----------

const MOLDURA: MaterialDaPeca = { classe: 'madeira', rgb: [0x6a, 0x4a, 0x32] }
const CASA_ESCURA: MaterialDaPeca = { classe: 'liso', rgb: [0x5e, 0x45, 0x32] }
const CASA_CLARA: MaterialDaPeca = { classe: 'liso', rgb: [0xd9, 0xc4, 0x9c] }
const MARFIM: MaterialDaPeca = { classe: 'liso', rgb: [0xe6, 0xdc, 0xc4] }
const VINHO: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x3f, 0x3a] }
const PAPEL: MaterialDaPeca = { classe: 'liso', rgb: [0xe8, 0xe0, 0xcc] }
const NAIPE_VERMELHO: MaterialDaPeca = { classe: 'liso', rgb: [0xa0, 0x4a, 0x44] }
const NAIPE_PRETO: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x35, 0x33] }
const VERSO: MaterialDaPeca = { classe: 'liso', rgb: [0x8a, 0x4a, 0x46] }
const VERSO_CLARO: MaterialDaPeca = { classe: 'liso', rgb: [0xb4, 0x7c, 0x6c] }
const PINTA: MaterialDaPeca = { classe: 'liso', rgb: [0x3a, 0x33, 0x2e] }
const OURO: MaterialDaPeca = materialDaPeca('latao')
const COBRE: MaterialDaPeca = { classe: 'metal', rgb: [0xa8, 0x70, 0x4f] }
const PRATA: MaterialDaPeca = { classe: 'metal', rgb: [0xb4, 0xb8, 0xb6] }
const ESTANHO: MaterialDaPeca = { classe: 'metal', rgb: [0x8c, 0x90, 0x8e] }
const ESPUMA: MaterialDaPeca = { classe: 'liso', rgb: [0xe6, 0xdc, 0xc0] }
/** A cerveja escura (a dos pratos) e a mancha de caneca no tampo. */
const BEBIDA: MaterialDaPeca = { ...BURACO, rgb: rgb(tomDoMeio('nogueira', 0.72)) }
const MANCHA: MaterialDaPeca = { classe: 'liso', rgb: rgb(tomDoMeio('nogueira', 0.62)) }

// ---------- o tabuleiro ----------

/** O tabuleiro: o meio, o lado da casa, as casas por lado e a largura da moldura (px do desenho). */
const TABULEIRO = { x: 0, y: -4, casa: 3.6, casas: 8, moldura: 1.8 } as const
/** As pedras no meio da partida [coluna, linha] (sempre em casa escura, coluna + linha ímpar). */
const PEDRAS_CLARAS: readonly (readonly [number, number])[] = [[0, 1], [1, 0], [1, 2], [0, 5], [1, 6], [2, 3], [2, 7], [3, 4]]
const PEDRAS_DE_VINHO: readonly (readonly [number, number])[] = [[7, 0], [5, 0], [6, 1], [7, 2], [4, 1], [6, 3], [5, 4], [7, 6]]
/** A dama clara, que já chegou ao fundo do outro lado. */
const DAMA_CLARA: readonly [number, number] = [6, 5]
/** As pedras comidas, fora do tabuleiro, do lado de quem comeu (px do desenho). */
const COMIDAS_DE_VINHO: readonly Ponto[] = [[-20.4, -14.2], [-21.2, -10.8], [-20, -7.6]]
const COMIDAS_CLARAS: readonly Ponto[] = [[19.6, 6.8], [21.6, 9.6]]
const RAIO_DA_PEDRA = 1.3

// ---------- o que mais vai em cima ----------

/** A carta (meia largura e meia altura) e o leque: o pé, a distância do pé ao meio da carta e o giro de cada uma. */
const MEIA_CARTA: Ponto = [2.2, 3.1]
const LEQUE = { x: -9.5, y: 23.4, raio: 3.6, giros: [-0.55, -0.2, 0.15, 0.5] } as const
/** O naipe de cada carta do leque (verdadeiro = vermelho). */
const NAIPES_VERMELHOS: readonly boolean[] = [true, false, false, true]
const MONTE = { x: 4.6, y: 18.2, giro: 0.24, cartas: 4 } as const
/** Os dados [x, y, giro, pontos] e o meio lado de cada um. */
const DADOS: readonly (readonly [number, number, number, number])[] = [[13.6, 14.8, 0.32, 3], [17.8, 19.4, -0.42, 5]]
const MEIO_DADO = 1.4
/** As pintas da face de cima, por quantos pontos (frações do meio lado). */
const PINTAS_DO_DADO: Readonly<Partial<Record<number, readonly Ponto[]>>> = {
  3: [[-0.75, -0.75], [0, 0], [0.75, 0.75]],
  5: [[-0.75, -0.75], [0.75, -0.75], [0, 0], [-0.75, 0.75], [0.75, 0.75]],
}
/** As pilhas de moedas [x, y, quantas, material] e o raio da moeda. */
const MOEDAS: readonly (readonly [number, number, number, MaterialDaPeca])[] = [
  [-20.4, 3.6, 4, OURO],
  [19.6, -3.6, 3, PRATA],
  [21.4, 0.8, 5, COBRE],
  [-21, 8.6, 1, COBRE],
  [21.8, 22.4, 1, OURO],
  [19.2, 23.8, 1, PRATA],
]
const RAIO_DA_MOEDA = 1.9
/** As canecas [x, y, raio, para onde a asa aponta (radianos)]. */
const CANECA_DE_MADEIRA = [-18.6, -24.6, 3.1, Math.PI] as const
const CANECA_DE_ESTANHO = [19.6, -14.6, 3.2, 0] as const
/** As marcas de caneca molhada no tampo [x, y, raio]. */
const MARCAS_DE_CANECA: readonly (readonly [number, number, number])[] = [[-6.4, -26.4, 3.2], [9.6, 23.6, 3.0]]

// ---------- o banquinho ----------

/** Os banquinhos [x, y, giro dos pés, veio do assento]: o de oeste com um pé para fora, o de leste espelhado. */
const BANQUINHOS: readonly (readonly [number, number, number, number])[] = [
  [-31.6, 6, Math.PI, 0.4],
  [31.6, -10, 0, -0.7],
]
const BANQUINHO = { assento: 5.6, espessura: 1.5, encaixe: 2.0, pisada: 8.8, pe: 1.1, miolo: 2.2, travessa: 0.6, travessaNoPe: 0.78 } as const
const FATIAS_DO_PE = 30
const SOBRA_DA_FATIA = 1.0
const TOM_DO_PE = 0.82
const TOM_DA_TRAVESSA = 0.7
const TOM_DA_ESPESSURA = 0.66
const LONGE_DO_CHAO = 0.08

// ---------- as contas ----------

function limitar01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

/**
 * O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta (`giro`, em
 * graus; de cima é sempre 0), como na banqueta.
 */
function desgirado(dx: number, dy: number, giro: number): [number, number] {
  const quartos = ((Math.round(giro / 90) % 4) + 4) % 4
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** O retângulo de meio (cx, cy), meios lados (mx, my), girado `ang` e de quinas arredondadas `r`. */
function retanguloGirado(cx: number, cy: number, mx: number, my: number, ang: number, r: number): Forma {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  const ix = mx - r
  const iy = my - r
  const miolo = poligono(
    ([[-ix, -iy], [ix, -iy], [ix, iy], [-ix, iy]] as const).map(([x, y]): Ponto => [cx + x * co - y * si, cy + x * si + y * co]),
  )
  const alem = Math.hypot(mx, my)
  return { b: [cx - alem, cy - alem, cx + alem, cy + alem], d: (x, y) => miolo.d(x, y) - r }
}

/** O ponto (x, y) do desenho de uma peça de meio (cx, cy) girada `ang`. */
function noGiro(cx: number, cy: number, ang: number, x: number, y: number): Ponto {
  const co = Math.cos(ang)
  const si = Math.sin(ang)
  return [cx + x * co - y * si, cy + x * si + y * co]
}

/**
 * As casas claras de um tabuleiro de `n` x `n` casas de lado `q`, com o canto de cima à esquerda em (x0, y0): a
 * casa (i, j) é clara quando i + j é par. Dentro do tabuleiro a distância é a da casa até a beira dela (as
 * vizinhas de lado são sempre da outra cor); fora, a distância até o tabuleiro.
 */
function casasClaras(x0: number, y0: number, q: number, n: number): Forma {
  const lado = q * n
  return {
    b: [x0, y0, x0 + lado, y0 + lado],
    d(x, y) {
      const u = (x - x0) / q
      const v = (y - y0) / q
      if (u < 0 || v < 0 || u >= n || v >= n) {
        const fx = Math.max(x0 - x, 0, x - x0 - lado)
        const fy = Math.max(y0 - y, 0, y - y0 - lado)
        return Math.hypot(fx, fy)
      }
      const i = Math.floor(u)
      const j = Math.floor(v)
      const fu = u - i
      const fv = v - j
      const aBeira = Math.min(fu, 1 - fu, fv, 1 - fv) * q
      return (i + j) % 2 === 0 ? -aBeira : aBeira
    },
  }
}

// ---------- as texturas ----------

/** O veio de madeira com a borda clara: a luz cresce do fim da faixa até a quina do tampo (a da `mesaComPernas`). */
function madeiraComBordaClara(forma: Forma, largura: number): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const t = -forma.d(x, y)
    if (t < largura) s[3] += LUZ_DA_BORDA_CLARA * (1 - (t > 0 ? t : 0) / largura)
  }
}

/** A madeira do pé só dentro da fatia (`de` a `ate` ao longo do pé, a partir do meio do banquinho), como na banqueta. */
function soNaFatia(cx: number, cy: number, ux: number, uy: number, de: number, ate: number): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    const aoLongo = (x - cx) * ux + (y - cy) * uy
    if (aoLongo < de || aoLongo >= ate) {
      s[5] = 0
      return
    }
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
  }
}

/** O assento gasto no meio (o miolo polido e a cova rasa de tanto sentar), o da banqueta. */
function texDoAssento(cx: number, cy: number, raio: number, paraASombra: readonly [number, number]): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    const dx = x - cx
    const dy = y - cy
    const r = Math.hypot(dx, dy) / raio
    const beira = 0.62 + ruido(x * 0.45 + p.su, y * 0.45) * 0.3
    s[3] += 0.14 * (1 - limitar01((r - beira + 0.15) / 0.3)) - 0.08 * limitar01((r - 0.66) / 0.3)
    if (r > 1e-6 && r < 1) s[3] += 0.1 * ((dx * paraASombra[0] + dy * paraASombra[1]) / (r * raio)) * 2.6 * r * (1 - r * r)
  }
}

/** A casa do tabuleiro: o liso com um grão miúdo de madeira, sem veio (o veio sujava o quadriculado). */
const texDaCasa: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.7 + p.su, y * 0.7 + p.sv) * 0.06
}

// ---------- a montagem ----------

/** O que a montagem passa a cada parte: o contexto, a cena, o ponto na pegada e o tamanho. */
interface Obra {
  readonly c: ContextoDoMovel
  readonly cena: Cena
  readonly em: (x: number, y: number) => Ponto
  readonly k: number
}

function por(o: Obra, forma: Forma, mat: MaterialDaPeca, op: OpcoesDaPeca): void {
  o.cena.partes.push(o.c.peca(forma, mat, op))
}

/** Um BANQUINHO: os pés abrindo para fora em fatias, as travessas baixas e o assento gasto por cima. */
function montarBanquinho(o: Obra, x: number, y: number, giroDosPes: number, veio: number, semente: number): void {
  const { c, cena, k } = o
  const [cx, cy] = o.em(x, y)
  const mad = c.m.madeira
  const tom = tomLongeDoChao(mad, LONGE_DO_CHAO)
  const zAssento = c.g * ALTURA_DO_BANQUINHO
  const espessura = BANQUINHO.espessura * k
  const zPe = zAssento - espessura
  const rAssento = BANQUINHO.assento * k
  const rEncaixe = BANQUINHO.encaixe * k
  const rPisada = BANQUINHO.pisada * k
  const raioDoPe = BANQUINHO.pe * k
  const alturaDoPe = (r: number): number => zPe * limitar01((rPisada - r) / (rPisada - rEncaixe))
  const direcoes = [giroDosPes, giroDosPes + (2 * Math.PI) / 3, giroDosPes - (2 * Math.PI) / 3]

  // A sombra do assento no chão, solta e caída para o lado (a estrutura dele é só o miolo, sem sombra).
  const [sx, sy] = desgirado(SOMBRA_X * zAssento, SOMBRA_Y * zAssento, c.giro)
  cena.sombras.push({ forma: elipse(cx + sx, cy + sy, rAssento, rAssento), z: 0, suave: 0.8 + 0.09 * zAssento, forca: 0.26 })

  // As TRAVESSAS, baixas, de pé a pé.
  const rTravessa = BANQUINHO.travessaNoPe * rPisada
  const zTravessa = alturaDoPe(rTravessa)
  const raioDaTravessa = BANQUINHO.travessa * k
  direcoes.forEach((a0, i) => {
    const a1 = direcoes[(i + 1) % direcoes.length]
    const [ax, ay] = [cx + Math.cos(a0) * rTravessa, cy + Math.sin(a0) * rTravessa]
    const [bx, by] = [cx + Math.cos(a1) * rTravessa, cy + Math.sin(a1) * rTravessa]
    const travessa = capsula(ax, ay, bx, by, raioDaTravessa)
    cena.sombras.push({ forma: travessa, z: zTravessa, solta: true }, contato(travessa, 0.2))
    por(o, travessa, mad, { eixo: Math.atan2(by - ay, bx - ax), tabua: 0, bisel: raioDaTravessa * 0.9, contorno: 0.28, tom: tom * TOM_DA_TRAVESSA, semente: semente + i })
  })

  // Os PÉS, do encaixe debaixo do assento até a pisada, em fatias (a de cima na altura do assento, a de baixo no chão).
  const comeco = rEncaixe - raioDoPe
  const passo = (rPisada + raioDoPe - comeco) / FATIAS_DO_PE
  const sobra = SOBRA_DA_FATIA * k
  direcoes.forEach((a, i) => {
    const ux = Math.cos(a)
    const uy = Math.sin(a)
    const pe = capsula(cx + ux * rEncaixe, cy + uy * rEncaixe, cx + ux * rPisada, cy + uy * rPisada, raioDoPe)
    const faixa = (de: number, ate: number): Forma => barra(cx + ux * de, cy + uy * de, cx + ux * ate, cy + uy * ate, 2 * raioDoPe + 2)
    cena.sombras.push(contato(elipse(cx + ux * rPisada, cy + uy * rPisada, raioDoPe * 1.1, raioDoPe * 1.1), 0.34))
    for (let j = 0; j < FATIAS_DO_PE; j += 1) {
      const de = comeco + j * passo
      const ate = de + passo
      const z = alturaDoPe((de + ate) / 2)
      if (z > 0) cena.sombras.push({ forma: dentroDe(pe, faixa(de, ate)), z, solta: true })
      const fatia: Forma = { b: faixa(de - sobra, ate + sobra).b, d: pe.d }
      por(o, fatia, mad, { eixo: a, tabua: 0, bisel: raioDoPe * 0.85, contorno: 0.28, tom: tom * TOM_DO_PE, semente: semente + 10 + i, textura: soNaFatia(cx, cy, ux, uy, de - sobra, ate + sobra) })
    }
  })

  // O ASSENTO: a estrutura é só o miolo, com a caixa do banquinho inteiro (para ser o último a pintar).
  const alcance = rPisada + raioDoPe + 1
  const miolo = elipse(cx, cy, BANQUINHO.miolo * k, BANQUINHO.miolo * k)
  cena.sombras.push({ forma: { b: [cx - alcance, cy - alcance, cx + alcance, cy + alcance], d: miolo.d }, z: zAssento, solta: true, forca: 0 })
  const assento = elipse(cx, cy, rAssento, rAssento)
  const [lx, ly] = desgirado(SOMBRA_X, SOMBRA_Y, c.giro)
  const comprimento = Math.hypot(lx, ly)
  por(o, assento, mad, { dx: 0.3 * k, dy: espessura, eixo: veio, tabua: 0, bisel: 0.6 * k, contorno: 0.24, tom: tom * TOM_DA_ESPESSURA, semente: semente + 20 })
  por(o, assento, mad, { eixo: veio, tabua: 0, bisel: 1.3 * k, contorno: 0.14, tom, semente: semente + 21, textura: texDoAssento(cx, cy, rAssento, [lx / comprimento, ly / comprimento]) })
}

/** A MESA: as pernas nas quinas, a espessura do tampo, o tampo de tábuas com a borda clara e as sombras. */
function montarMesa(o: Obra): void {
  const { c, cena, k } = o
  const mad = c.m.madeira
  const altura = c.g * ALTURA_DA_MESA
  const [x0, y0] = o.em(TAMPO.x0, TAMPO.y0)
  const [x1, y1] = o.em(TAMPO.x1, TAMPO.y1)
  const quina = TAMPO.quina * k
  const tampo = caixa(x0, y0, x1, y1, quina)
  const lado = LADO_DA_PERNA * k
  const fora = PERNA_PARA_FORA * k
  const pernas = ([[x0, y0, -1, -1], [x1, y0, 1, -1], [x0, y1, -1, 1], [x1, y1, 1, 1]] as const).map(([qx, qy, sx, sy]) => {
    const px = qx + sx * fora - (sx > 0 ? lado : 0)
    const py = qy + sy * fora - (sy > 0 ? lado : 0)
    return caixa(px, py, px + lado, py + lado, 0.12 * lado)
  })
  const alem = SOMBRA_DE_BAIXO_ALEM * k
  cena.sombras.push(
    { forma: caixa(x0 - alem, y0 - alem, x1 + alem, y1 + alem, quina + alem), z: 0, suave: alem, forca: FORCA_DA_SOMBRA_DE_BAIXO },
    { forma: tampo, z: altura, solta: true, suave: 1.8, forca: FORCA_DA_SOMBRA_DO_TAMPO },
  )
  for (const perna of pernas) {
    const b = perna.b
    const folga = 0.08 * (b[2] - b[0])
    cena.sombras.push(contato(caixa(b[0] - folga, b[1] - folga, b[2] + folga, b[3] + folga, 0.3 * (b[2] - b[0])), FORCA_DO_CONTATO_DA_PERNA), { forma: perna, z: altura, suave: 0.9, forca: FORCA_DA_SOMBRA_DA_PERNA })
  }
  pernas.forEach((perna, i) => por(o, perna, mad, { eixo: QUARTO, tabua: 0, bisel: 0.9, contorno: 0.16, tom: 0.64, semente: 6104 + i }))
  por(o, tampo, mad, { eixo: QUARTO, dx: ESPESSURA_A_DIREITA * k, dy: ESPESSURA_EMBAIXO * k, tabua: 0, bisel: 0.7, contorno: 0.2, tom: 0.66, semente: 6103 })
  por(o, tampo, mad, { eixo: QUARTO, tabua: LARGURA_DA_TABUA * k, bisel: 1.6, contorno: 0.06, tom: 0.97, semente: 6100, textura: madeiraComBordaClara(tampo, LARGURA_DA_BORDA_CLARA * k) })
  // As marcas de caneca molhada, de outras noites.
  MARCAS_DE_CANECA.forEach(([x, y, r], i) => {
    const [mx, my] = o.em(x, y)
    por(o, anel(mx, my, r * k, r * k, (r - 0.55) * k, (r - 0.55) * k), MANCHA, { bisel: 0, contorno: 0, alfa: 0.2, suave: 0.4 * k, semente: 6110 + i })
  })
}

/** Uma pedra de damas: o disco com a sombra no tabuleiro e a cova rasa do meio; `dobrada` = a dama, duas pedras. */
function pedra(o: Obra, x: number, y: number, mat: MaterialDaPeca, semente: number, dobrada = false): void {
  const { k } = o
  const r = RAIO_DA_PEDRA * k
  const camadas: readonly Ponto[] = dobrada ? [[0.25, 0.35], [-0.2, -0.35]] : [[0, 0]]
  camadas.forEach(([dx, dy], i) => {
    const px = x + dx * k
    const py = y + dy * k
    por(o, elipse(px, py, r, r), mat, { bisel: 0.55 * k, contorno: 0.3, tom: 0.96 + i * 0.06, semente: semente + i, projeta: { dist: 0.55 * k, forca: 0.32 } })
    por(o, elipse(px, py, 0.62 * r, 0.62 * r), mat, { bisel: 0, contorno: 0, tom: 0.97 + i * 0.06, recesso: { k: 0.35 * k, forca: 0.22 }, semente: semente + 5 + i })
  })
}

/** O TABULEIRO de damas: a moldura escura, o campo das casas escuras, as casas claras por cima e as pedras. */
function montarTabuleiro(o: Obra): void {
  const { k } = o
  const [cx, cy] = o.em(TABULEIRO.x, TABULEIRO.y)
  const q = TABULEIRO.casa * k
  const lado = q * TABULEIRO.casas
  const m = TABULEIRO.moldura * k
  const x0 = cx - lado / 2
  const y0 = cy - lado / 2
  por(o, caixa(x0 - m, y0 - m, x0 + lado + m, y0 + lado + m, 0.8 * k), MOLDURA, { eixo: 0, tabua: 0, bisel: 0.7 * k, contorno: 0.26, semente: 6200, projeta: { dist: 0.9 * k, forca: 0.3 } })
  por(o, caixa(x0, y0, x0 + lado, y0 + lado, 0.2 * k), CASA_ESCURA, { bisel: 0, contorno: 0.16, recesso: { k: 0.5 * k, forca: 0.2 }, textura: texDaCasa, semente: 6201 })
  por(o, casasClaras(x0, y0, q, TABULEIRO.casas), CASA_CLARA, { bisel: 0, contorno: 0, textura: texDaCasa, semente: 6202 })
  const naCasa = ([i, j]: readonly [number, number]): Ponto => [x0 + (i + 0.5) * q, y0 + (j + 0.5) * q]
  PEDRAS_CLARAS.forEach((casa, i) => pedra(o, ...naCasa(casa), MARFIM, 6210 + i * 10))
  PEDRAS_DE_VINHO.forEach((casa, i) => pedra(o, ...naCasa(casa), VINHO, 6310 + i * 10))
  pedra(o, ...naCasa(DAMA_CLARA), MARFIM, 6400, true)
  COMIDAS_DE_VINHO.forEach(([x, y], i) => pedra(o, ...o.em(x, y), VINHO, 6410 + i * 10))
  COMIDAS_CLARAS.forEach(([x, y], i) => pedra(o, ...o.em(x, y), MARFIM, 6450 + i * 10))
}

/** Um naipe miúdo: o losango vermelho (ouros) ou a gota preta (espadas), de meio (x, y) e tamanho `t`. */
function naipe(x: number, y: number, t: number, ang: number, vermelho: boolean): Forma {
  if (vermelho) return poligono([noGiro(x, y, ang, 0, -t), noGiro(x, y, ang, t * 0.7, 0), noGiro(x, y, ang, 0, t), noGiro(x, y, ang, -t * 0.7, 0)])
  const [px, py] = noGiro(x, y, ang, 0, -t * 0.9)
  const [bx, by] = noGiro(x, y, ang, 0, t * 0.15)
  return capsula(px, py, bx, by, t * 0.62)
}

/** As CARTAS abertas em leque: cada uma com o naipe no canto (o que fica à mostra) e a de cima com o naipe grande. */
function montarCartas(o: Obra): void {
  const { k } = o
  const [px, py] = o.em(LEQUE.x, LEQUE.y)
  const [mx, my] = [MEIA_CARTA[0] * k, MEIA_CARTA[1] * k]
  LEQUE.giros.forEach((ang, i) => {
    const [cx, cy] = noGiro(px, py, ang, 0, -LEQUE.raio * k)
    const vermelho = NAIPES_VERMELHOS[i]
    const cor = vermelho ? NAIPE_VERMELHO : NAIPE_PRETO
    por(o, retanguloGirado(cx, cy, mx, my, ang, 0.45 * k), PAPEL, { bisel: 0.35 * k, contorno: 0.24, semente: 6500 + i, projeta: { dist: 0.5 * k, forca: 0.26 } })
    por(o, naipe(...noGiro(cx, cy, ang, -mx + 0.95 * k, -my + 1.25 * k), 0.62 * k, ang, vermelho), cor, { bisel: 0, contorno: 0, semente: 6510 + i })
    if (i === LEQUE.giros.length - 1) por(o, naipe(cx, cy + 0.2 * k, 1.25 * k, ang, vermelho), cor, { bisel: 0.2 * k, contorno: 0.1, semente: 6520 })
  })
}

/** O MONTE de cartas viradas: as beiras das de baixo e, por cima, o verso cor de vinho com a beira clara e o losango. */
function montarMonte(o: Obra): void {
  const { k } = o
  const [x, y] = o.em(MONTE.x, MONTE.y)
  const [mx, my] = [MEIA_CARTA[0] * k, MEIA_CARTA[1] * k]
  for (let i = 0; i < MONTE.cartas; i += 1) {
    const dx = (MONTE.cartas - 1 - i) * 0.32 * k
    const dy = (MONTE.cartas - 1 - i) * 0.42 * k
    const ang = MONTE.giro + (i % 2 === 0 ? 0.03 : -0.03)
    por(o, retanguloGirado(x + dx, y + dy, mx, my, ang, 0.45 * k), PAPEL, { bisel: 0.3 * k, contorno: 0.24, tom: 0.9 + i * 0.03, semente: 6600 + i, projeta: { dist: 0.4 * k, forca: 0.22 } })
  }
  por(o, retanguloGirado(x, y, mx - 0.45 * k, my - 0.45 * k, MONTE.giro, 0.25 * k), VERSO, { bisel: 0.2 * k, contorno: 0.12, semente: 6610 })
  por(o, naipe(x, y, 1.5 * k, MONTE.giro, true), VERSO_CLARO, { bisel: 0, contorno: 0.08, semente: 6611 })
}

/** Os DADOS: o cubo de osso com as quinas gastas e as pintas da face de cima. */
function montarDados(o: Obra): void {
  const { k } = o
  DADOS.forEach(([dx, dy, ang, pontos], i) => {
    const [x, y] = o.em(dx, dy)
    const meio = MEIO_DADO * k
    por(o, retanguloGirado(x, y, meio, meio, ang, 0.45 * k), PAPEL, { bisel: 0.5 * k, contorno: 0.28, semente: 6700 + i, projeta: { dist: 0.7 * k, forca: 0.3 } })
    for (const [px, py] of PINTAS_DO_DADO[pontos] ?? []) {
      const [cx, cy] = noGiro(x, y, ang, px * k, py * k)
      por(o, elipse(cx, cy, 0.3 * k, 0.3 * k), PINTA, { bisel: 0, contorno: 0, semente: 6710 + i })
    }
  })
}

/** As MOEDAS: cada pilha subindo um pouco para a luz (as beiras das de baixo à mostra embaixo à direita). */
function montarMoedas(o: Obra): void {
  const { k } = o
  MOEDAS.forEach(([x, y, quantas, mat], i) => {
    const [cx, cy] = o.em(x, y)
    const r = RAIO_DA_MOEDA * k
    for (let j = 0; j < quantas; j += 1) {
      const mx = cx - j * 0.14 * k
      const my = cy - j * 0.46 * k
      const ultima = j === quantas - 1
      por(o, elipse(mx, my, r, r), mat, { bisel: 0.5 * k, contorno: 0.26, tom: ultima ? 1.02 : 0.86, metal: 0.45, semente: 6800 + i * 10 + j, projeta: { dist: 0.4 * k, forca: 0.26 } })
      if (ultima) por(o, elipse(mx, my, 0.62 * r, 0.62 * r), mat, { bisel: 0, contorno: 0.06, tom: 0.98, metal: 0.4, recesso: { k: 0.3 * k, forca: 0.16 }, semente: 6805 + i * 10 })
    }
  })
}

/** Uma CANECA vista de cima: a asa, a borda (anel) e o que tem dentro, com a sombra no tampo. */
function caneca(o: Obra, [x, y, raio, asa]: readonly [number, number, number, number], parede: MaterialDaPeca, dentro: MaterialDaPeca, espuma: boolean, semente: number): void {
  const { k } = o
  const [cx, cy] = o.em(x, y)
  const r = raio * k
  const [ax, ay] = [Math.cos(asa), Math.sin(asa)]
  por(o, capsula(cx + ax * r * 0.7, cy + ay * r * 0.7, cx + ax * r * 1.5, cy + ay * r * 1.5, 0.72 * k), parede, { bisel: 0.6 * k, tom: 0.9, contorno: 0.22, metal: 0.3, semente })
  por(o, anel(cx, cy, r, r, r * 0.7, r * 0.7), parede, { bisel: 0.8 * k, contorno: 0.22, metal: 0.35, semente: semente + 1, projeta: { dist: 1.0 * k, forca: 0.3 } })
  por(o, elipse(cx, cy, r * 0.7, r * 0.7), dentro, { bisel: espuma ? 0.6 * k : 0, contorno: 0.1, tom: espuma ? 0.98 : 1, recesso: { k: 0.8 * k, forca: espuma ? 0.16 : 0.25 }, ruga: espuma ? 0.8 : 0, semente: semente + 2 })
  if (espuma) {
    for (const [bx, by, br] of [[-0.9, -0.5, 0.42], [0.6, 0.7, 0.36], [0.9, -0.6, 0.3]] as const) {
      por(o, elipse(cx + bx * k, cy + by * k, br * k, br * k), dentro, { bisel: br * k, contorno: 0.12, tom: 1.06, semente: semente + 3 })
    }
  }
}

export const montarMesaDeJogo: MontarMovel = (c, cena) => {
  const sx = c.w / LADO_DO_DESENHO
  const sy = c.h / LADO_DO_DESENHO
  const o: Obra = { c, cena, em: (x, y) => [x * sx, y * sy], k: Math.min(sx, sy) }
  BANQUINHOS.forEach(([x, y, giroDosPes, veio], i) => montarBanquinho(o, x, y, giroDosPes, veio, 6000 + i * 40))
  montarMesa(o)
  montarTabuleiro(o)
  montarCartas(o)
  montarMonte(o)
  montarDados(o)
  montarMoedas(o)
  caneca(o, CANECA_DE_MADEIRA, materialDaPeca('nogueira'), BEBIDA, false, 6900)
  caneca(o, CANECA_DE_ESTANHO, ESTANHO, ESPUMA, true, 6910)
}
