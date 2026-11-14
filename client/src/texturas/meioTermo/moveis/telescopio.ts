/**
 * TELESCÓPIO de cima com volume (lote L12 dos objetos novos, 14/11/2026, "Descanso e brincadeira"): a luneta de
 * astrônomo num TRIPÉ de madeira. As três PERNAS abrem do PRATO da cabeça até o chão, cada uma com a ponteira de
 * metal; no prato, o GARFO com os dois botões do eixo segura o TUBO de metal, inclinado para o céu: a ocular escura
 * embaixo, perto de quem olha, o tubo que engrossa com os anéis, o buscador fininho ao lado e o PARA-SOL largo na
 * ponta, com a LENTE à mostra (o tubo aponta para cima, e de cima se vê a lente em elipse, escura, com o reflexo).
 * No chão, no canto livre, a CARTA DO CÉU aberta, com o círculo das estrelas e as ligações das constelações.
 *
 * Coisa vista do alto que vira forma estranha precisa de pista: aqui são a lente em elipse com o reflexo na ponta
 * mais larga, a ocular escura na outra e as três pernas abertas em estrela (com a sombra comprida de cada uma). A 25%
 * de zoom sobram o risco claro do tubo na diagonal, a ponta redonda escura e o Y das pernas.
 *
 * Na 3/4 (`tresQuartos.ts`, derivado SEM beirada, `espessura: 0`, como o balanço): o prato é um tampo solto na
 * altura da cabeça (o garfo e os botões estão nele); as PERNAS e o TUBO são peças inclinadas cortadas em FATIAS ao
 * longo do eixo, cada uma um tampo solto na altura do meio dela (a técnica da banqueta e do balanço; as estruturas
 * das fatias são âncoras sem sombra, e a sombra de cada peça é a forma dela projetada no chão, calculada aqui). Com
 * beirada, cada fatia ganhava um dente embaixo (o tubo e as pernas saíam serrilhados) e a âncora que ficava sem
 * peça pintava a beirada sozinha, solta no ar. As pernas abrem a 45 graus do tubo ou mais: o trecho de perna que
 * passa debaixo do tubo sobe com ele e some debaixo dele, como some de verdade. A carta fica no chão, sem estrutura.
 *
 * Materiais: `madeira` (o tripé) e `tubo` (o tubo, o garfo e as ponteiras). A lente e a carta são fixas.
 */
import { limitar01, misturar, type Rgb } from '../../ruido'
import { barra, caixa, capsula, dentroDe, elipse, elipseGirada, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type Cena, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import { G, LENCOL, type ContextoDoMovel, type MontarMovel } from './contexto'

/** O desenho foi medido em 1 casa (28 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIA_PEGADA = 0.5 * G
const GRAUS = Math.PI / 180

/** A cabeça do tripé: onde fica (frações do menor meio lado) e a altura do eixo do tubo (casas). */
const CABECA: Ponto = [-0.12, 0.08]
const ALTURA_DO_EIXO = 0.7
/**
 * As pernas: o rumo de cada uma (graus) e o alcance do pé (fração do menor meio lado). Nenhuma fica a menos de 45
 * graus da linha do tubo: na 3/4, o trecho de perna que passa debaixo dele sobe junto e some (na primeira folha,
 * com 120 graus certinhos, uma perna ficava a 30 graus do tubo e sumia pela metade).
 */
const RUMOS_DAS_PERNAS: readonly number[] = [50, 185, 275]
const ALCANCE_DO_PE = 0.78
/** O tubo: o rumo da lente (graus), a inclinação para o céu (graus), o comprimento (fração do menor meio lado) e onde fica o eixo (fração do comprimento, a partir da ocular). */
const RUMO_DO_TUBO = -40
const INCLINACAO = 30
const COMPRIMENTO_DO_TUBO = 1.9
const EIXO_NO_TUBO = 0.4
/** Ao longo do tubo (frações dele, a partir da ocular): o fim da ocular e o começo do para-sol. */
const FIM_DA_OCULAR = 0.11
const COMECO_DO_PARA_SOL = 0.8
/** Os raios em px de partida: a ocular, o tubo fino e o grosso, o para-sol, o buscador e a perna. */
const RAIO_DA_OCULAR = 1.7
const RAIO_DO_TUBO: readonly [number, number] = [2.9, 3.8]
const RAIO_DO_PARA_SOL = 4.6
const RAIO_DO_BUSCADOR = 1.1
const RAIO_DA_PERNA = 1.3
/** Os anéis do tubo (frações dele) e a meia largura de cada um. */
const ANEIS: readonly number[] = [0.2, 0.36, 0.48, 0.74]
const MEIO_ANEL = 0.012
/** O prato da cabeça (px de partida): o raio dele. */
const RAIO_DO_PRATO = 7.4

/**
 * Fatias miúdas: a perna é íngreme, e cada fatia é um pedaço na direção da planta subido inteiro, então na 3/4 a
 * beira dela vira dente; com 72 o dente fica abaixo de meio px na mesa (com 32 a perna saía em corrente a 4x).
 */
const FATIAS_DA_PERNA = 72
const FATIAS_DO_TUBO = 48
const SOBRA_DA_FATIA = 1

/** A lente: o vidro escuro azulado e o reflexo; a ocular é o metal escurecido. */
const LENTE: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x3d, 0x4a] }
const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xe6, 0xee, 0xf0] }
const METAL_ESCURO: Rgb = [0x3c, 0x37, 0x31]
/** A carta do céu: a tinta das estrelas e das linhas, e o azul do círculo. */
const TINTA: Rgb = [0x3a, 0x34, 0x40]
const CEU_DA_CARTA: Rgb = [0x5d, 0x68, 0x80]

/** Uma peça reta e inclinada: de `de` (na altura `zDe`) até `ate` (`zAte`), com a forma inteira e o maior raio. */
interface Inclinada {
  readonly de: Ponto
  readonly ate: Ponto
  readonly zDe: number
  readonly zAte: number
  readonly forma: Forma
  readonly raio: number
}

/** A textura só dentro da fatia (de `a0` a `a1` ao longo do eixo, a partir de `origem`). */
function soNaFatia(textura: Textura | null, origem: Ponto, ux: number, uy: number, a0: number, a1: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    const ao = (x - origem[0]) * ux + (y - origem[1]) * uy
    if (ao < a0 || ao >= a1) {
      s[5] = 0
      return
    }
    if (textura !== null) textura(u, v, x, y, p, s, escala)
  }
}

/**
 * A peça inclinada cortada em FATIAS ao longo do eixo: cada fatia é a forma inteira, pintada só dentro da faixa
 * dela, e a estrutura dela é uma âncora sem sombra na altura do meio da faixa. A caixa da peça é a do trecho do
 * eixo: o meio dela cai no eixo, dentro da âncora da própria fatia.
 */
function emFatias(c: ContextoDoMovel, cena: Cena, inc: Inclinada, fatias: number, mat: MaterialDaPeca, o: OpcoesDaPeca, textura: Textura | null): void {
  const [ax, ay] = inc.de
  const dx = inc.ate[0] - ax
  const dy = inc.ate[1] - ay
  const comprimento = Math.hypot(dx, dy) || 1
  const ux = dx / comprimento
  const uy = dy / comprimento
  const r = inc.raio
  const a0 = -r
  const passo = (comprimento + 2 * r) / fatias
  const sobra = passo * SOBRA_DA_FATIA
  const no = (a: number): Ponto => [ax + ux * a, ay + uy * a]
  const caixaDoTrecho = (de: number, ate: number): Caixa => {
    const [x0, y0] = no(de)
    const [x1, y1] = no(ate)
    return [Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r]
  }
  for (let j = 0; j < fatias; j += 1) {
    const de = a0 + j * passo
    const ate = de + passo
    // A fatia cujo meio cai fora da peça (além da ocular ou da lente) não tem âncora que a segure: ficaria no chão,
    // pintando a ponta da peça solta (na segunda folha, um crescente escuro ao lado do tubo). A vizinha a cobre.
    const [mx, my] = no((de + ate) / 2)
    if (inc.forma.d(mx, my) > 0) continue
    const t = limitar01((de + ate) / 2 / comprimento)
    const z = inc.zDe + (inc.zAte - inc.zDe) * t
    const [xa, ya] = no(de)
    const [xb, yb] = no(ate)
    if (z > 0) cena.sombras.push({ forma: dentroDe(inc.forma, barra(xa, ya, xb, yb, 2 * r + 2)), z, solta: true, forca: 0, suave: 0.1 })
    cena.partes.push(c.peca({ b: caixaDoTrecho(de - sobra, ate + sobra), d: inc.forma.d }, mat, { ...o, eixo: Math.atan2(uy, ux), textura: soNaFatia(textura, inc.de, ux, uy, de - sobra, ate + sobra) }))
  }
}

/** A sombra no chão de uma peça inclinada: a cápsula do pé até o topo afastado pela altura. */
function sombraInclinada(de: Ponto, zDe: number, ate: Ponto, zAte: number, raio: number): Forma {
  return capsula(de[0] + SOMBRA_X * zDe, de[1] + SOMBRA_Y * zDe, ate[0] + SOMBRA_X * zAte, ate[1] + SOMBRA_Y * zAte, raio)
}

/** O tubo de metal: a ocular escurecida, os anéis escuros com o fio de luz depois, e o buscador um pouco mais escuro. */
function texDoTubo(ocular: Ponto, ux: number, uy: number, comprimento: number, raio: number): Textura {
  const metal = texturaDaClasse('metal')
  return (u, v, x, y, p, s, escala) => {
    if (metal !== null) metal(u, v, x, y, p, s, escala)
    const rx = x - ocular[0]
    const ry = y - ocular[1]
    const t = (rx * ux + ry * uy) / comprimento
    const fora = Math.abs(rx * -uy + ry * ux) > raio
    if (t < FIM_DA_OCULAR) {
      s[0] = METAL_ESCURO[0]
      s[1] = METAL_ESCURO[1]
      s[2] = METAL_ESCURO[2]
      return
    }
    if (fora) s[3] -= 0.12
    for (const anel of ANEIS) {
      const d = Math.abs(t - anel)
      if (d < MEIO_ANEL) s[3] -= 0.3
      else if (d < MEIO_ANEL * 2.2 && t > anel) s[3] += 0.12
    }
    if (t > COMECO_DO_PARA_SOL && t < COMECO_DO_PARA_SOL + MEIO_ANEL * 1.6) s[3] -= 0.34
  }
}

/** A carta do céu: o pergaminho, o círculo azul das estrelas, as estrelas e as ligações das constelações. */
function texDaCarta(cx: number, cy: number, raio: number, k: number): Textura {
  const tecido = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (tecido !== null) tecido(u, v, x, y, p, s, escala)
    const d = Math.hypot(x - cx, y - cy)
    if (d < raio) {
      const t = 0.62 * (1 - limitar01((d - raio + 0.6 * k) / (0.6 * k)) * 0.4)
      const cor = misturar([s[0], s[1], s[2]], CEU_DA_CARTA, t)
      s[0] = cor[0]
      s[1] = cor[1]
      s[2] = cor[2]
    } else if (d < raio + 0.45 * k) {
      const cor = misturar([s[0], s[1], s[2]], TINTA, 0.7)
      s[0] = cor[0]
      s[1] = cor[1]
      s[2] = cor[2]
    }
    s[3] += ruido(x * 0.3 + p.su, y * 0.3) * 0.05
  }
}

/** As estrelas da carta (frações do raio do círculo) e as ligações (pares de índices). */
const ESTRELAS: readonly Ponto[] = [[-0.5, -0.3], [-0.15, -0.5], [0.2, -0.2], [0.5, -0.42], [0.35, 0.3], [-0.1, 0.45], [-0.55, 0.25]]
const LIGACOES: readonly (readonly [number, number])[] = [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [5, 6]]

export const montarTelescopio: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const mad = c.m.madeira
  const tubo = c.m.tubo
  const L = cena.partes
  const menor = Math.min(hw, hh)
  const k = menor / MEIA_PEGADA
  const cabeca: Ponto = [CABECA[0] * menor, CABECA[1] * menor]
  const zEixo = g * ALTURA_DO_EIXO
  const raioDoPrato = RAIO_DO_PRATO * k
  const zPrato = zEixo - RAIO_DO_TUBO[1] * k - 0.6 * k

  // A CARTA DO CÉU no canto livre de trás à esquerda, no chão, com as pontas enroladas.
  const cartaX = -menor * 0.55
  const cartaY = -menor * 0.6
  const giroDaCarta = -12 * GRAUS
  const meiaCarta: readonly [number, number] = [7.2 * k, 5 * k]
  const naCarta = (a: number, b: number): Ponto => [cartaX + a * Math.cos(giroDaCarta) - b * Math.sin(giroDaCarta), cartaY + a * Math.sin(giroDaCarta) + b * Math.cos(giroDaCarta)]
  const carta = poligono([naCarta(-meiaCarta[0], -meiaCarta[1]), naCarta(meiaCarta[0], -meiaCarta[1]), naCarta(meiaCarta[0], meiaCarta[1]), naCarta(-meiaCarta[0], meiaCarta[1])])
  const raioDoCeu = meiaCarta[1] * 0.78
  cena.sombras.push(contato(carta, 0.22))
  L.push(P(carta, LENCOL, { eixo: giroDaCarta, bisel: 0.6 * k, tom: 1.02, contorno: 0.24, textura: texDaCarta(cartaX, cartaY, raioDoCeu, k), semente: 7700 }))
  for (const lado of [-1, 1]) {
    const [rx, ry] = naCarta(lado * meiaCarta[0], 0)
    const [ax, ay] = naCarta(lado * meiaCarta[0], -meiaCarta[1])
    const [bx, by] = naCarta(lado * meiaCarta[0], meiaCarta[1])
    L.push(P(capsula(ax, ay, bx, by, 1.2 * k), LENCOL, { eixo: giroDaCarta + Math.PI / 2, bisel: 1.2 * k, tom: 0.92, contorno: 0.26, semente: 7701 + lado, projeta: { dist: 0.8 * k, forca: 0.26 } }))
    L.push(P(elipse(rx, ry, 0.5 * k, 0.5 * k), LENCOL, { bisel: 0, tom: 0.6, contorno: 0, semente: 7703 }))
  }
  const estrelaClara: MaterialDaPeca = { classe: 'liso', rgb: [0xe8, 0xe2, 0xcc] }
  const estrela = (i: number): Ponto => {
    const [fx, fy] = ESTRELAS[i]
    const [ex, ey] = [fx * raioDoCeu, fy * raioDoCeu]
    return [cartaX + ex * Math.cos(giroDaCarta) - ey * Math.sin(giroDaCarta), cartaY + ex * Math.sin(giroDaCarta) + ey * Math.cos(giroDaCarta)]
  }
  LIGACOES.forEach(([a, b], i) => {
    const [xa, ya] = estrela(a)
    const [xb, yb] = estrela(b)
    L.push(P(capsula(xa, ya, xb, yb, 0.18 * k), estrelaClara, { bisel: 0, contorno: 0, alfa: 0.55, semente: 7705 + i }))
  })
  ESTRELAS.forEach((_, i) => {
    const [x, y] = estrela(i)
    L.push(P(elipse(x, y, 0.42 * k, 0.42 * k), estrelaClara, { bisel: 0, contorno: 0, semente: 7712 + i }))
  })

  // As PERNAS, do pé até a beira do prato, em fatias, com a ponteira de metal no chão e a sombra comprida.
  const rp = RAIO_DA_PERNA * k
  RUMOS_DAS_PERNAS.forEach((rumo, i) => {
    const a = rumo * GRAUS
    const pe: Ponto = [cabeca[0] + Math.cos(a) * menor * ALCANCE_DO_PE, cabeca[1] + Math.sin(a) * menor * ALCANCE_DO_PE]
    const topo: Ponto = [cabeca[0] + Math.cos(a) * raioDoPrato * 0.55, cabeca[1] + Math.sin(a) * raioDoPrato * 0.55]
    cena.sombras.push({ forma: sombraInclinada(pe, 0, topo, zPrato, rp), z: 0, suave: 1.8 * k, forca: 0.26 }, contato(elipse(pe[0], pe[1], rp * 1.2, rp * 1.2), 0.32))
    emFatias(c, cena, { de: pe, ate: topo, zDe: 0, zAte: zPrato, forma: capsula(pe[0], pe[1], topo[0], topo[1], rp), raio: rp }, FATIAS_DA_PERNA, mad, { tabua: 0, bisel: rp, tom: 0.96, contorno: 0.28, semente: 7720 + i }, texturaDaClasse('madeira'))
    L.push(P(elipse(pe[0], pe[1], rp * 1.05, rp * 1.05), tubo, { bisel: rp, tom: 0.8, contorno: 0.3, semente: 7725 + i }))
  })

  // O PRATO da cabeça, tampo solto, e o GARFO com os botões do eixo, de través do tubo.
  const prato = elipse(cabeca[0], cabeca[1], raioDoPrato, raioDoPrato)
  cena.sombras.push({ forma: prato, z: zPrato, solta: true, forca: 0.24 })
  L.push(P(prato, mad, { polar: { cx: cabeca[0], cy: cabeca[1], r: raioDoPrato }, tabua: 0, bisel: 1.2 * k, tom: 0.9, contorno: 0.28, semente: 7730 }))
  const ux = Math.cos(RUMO_DO_TUBO * GRAUS)
  const uy = Math.sin(RUMO_DO_TUBO * GRAUS)
  for (const lado of [-1, 1]) {
    const nx = -uy * lado
    const ny = ux * lado
    const braco = (RAIO_DO_TUBO[1] + 1) * k
    const bx = cabeca[0] + nx * braco
    const by = cabeca[1] + ny * braco
    L.push(P(barra(bx - ux * 2.4 * k, by - uy * 2.4 * k, bx + ux * 2.4 * k, by + uy * 2.4 * k, 1.5 * k), tubo, { eixo: RUMO_DO_TUBO * GRAUS, tabua: 0, bisel: 0.7 * k, tom: 0.85, contorno: 0.3, semente: 7731 + lado }))
    L.push(P(elipse(bx + nx * 1.6 * k, by + ny * 1.6 * k, 1.25 * k, 1.25 * k), tubo, { bisel: 1.25 * k, tom: 1.1, contorno: 0.3, metal: 0.6, semente: 7733 + lado, projeta: { dist: 1 * k, forca: 0.3 } }))
  }

  // O TUBO inclinado para o céu, em fatias: a ocular, o tubo que engrossa, o buscador ao lado e o para-sol com a lente.
  const comprimento = menor * COMPRIMENTO_DO_TUBO
  const noChao = Math.cos(INCLINACAO * GRAUS)
  const subida = Math.sin(INCLINACAO * GRAUS)
  const atras = comprimento * EIXO_NO_TUBO
  const frente = comprimento - atras
  const ocular: Ponto = [cabeca[0] - ux * atras * noChao, cabeca[1] - uy * atras * noChao]
  const lenteP: Ponto = [cabeca[0] + ux * frente * noChao, cabeca[1] + uy * frente * noChao]
  const zOcular = zEixo - atras * subida
  const zLente = zEixo + frente * subida
  const noTubo = (t: number, lado: number): Ponto => {
    const ao = t * comprimento * noChao
    return [ocular[0] + ux * ao - uy * lado, ocular[1] + uy * ao + ux * lado]
  }
  const trecho = (t0: number, r0: number, t1: number, r1: number): Forma => poligono([noTubo(t0, -r0), noTubo(t1, -r1), noTubo(t1, r1), noTubo(t0, r0)])
  const rPara = RAIO_DO_PARA_SOL * k
  const lente = elipseGirada(lenteP[0], lenteP[1], rPara * subida, rPara, RUMO_DO_TUBO * GRAUS)
  const [b0x, b0y] = noTubo(0.32, (RAIO_DO_TUBO[1] + 0.6) * k)
  const [b1x, b1y] = noTubo(0.6, (RAIO_DO_TUBO[1] + 0.6) * k)
  const [fimOcularX, fimOcularY] = noTubo(FIM_DA_OCULAR + 0.02, 0)
  const formaDoTubo = uniao(
    uniao(capsula(ocular[0], ocular[1], fimOcularX, fimOcularY, RAIO_DA_OCULAR * k), trecho(FIM_DA_OCULAR, RAIO_DO_TUBO[0] * k, COMECO_DO_PARA_SOL, RAIO_DO_TUBO[1] * k)),
    uniao(uniao(trecho(COMECO_DO_PARA_SOL, rPara, 1, rPara), lente), capsula(b0x, b0y, b1x, b1y, RAIO_DO_BUSCADOR * k)),
  )
  cena.sombras.push({ forma: sombraInclinada(ocular, zOcular, lenteP, zLente, RAIO_DO_TUBO[1] * k), z: 0, suave: 2.6 * k, forca: 0.26 })
  emFatias(
    c,
    cena,
    { de: ocular, ate: lenteP, zDe: zOcular, zAte: zLente, forma: formaDoTubo, raio: rPara },
    FATIAS_DO_TUBO,
    tubo,
    { tabua: 0, bisel: RAIO_DO_TUBO[1] * k, contorno: 0.3, metal: 0.55, semente: 7740 },
    texDoTubo(ocular, ux, uy, comprimento * noChao, RAIO_DO_TUBO[1] * k * 1.05),
  )
  // A LENTE na ponta: o aro claro, o vidro escuro e o reflexo da janela do céu.
  L.push(P(elipseGirada(lenteP[0], lenteP[1], rPara * subida * 0.78, rPara * 0.8, RUMO_DO_TUBO * GRAUS), LENTE, { bisel: 0.8 * k, contorno: 0.2, metal: 0.4, semente: 7750 }))
  const [rx, ry] = [lenteP[0] - 0.9 * k, lenteP[1] - 1.5 * k]
  L.push(P(elipseGirada(rx, ry, 0.5 * k, 1.4 * k, RUMO_DO_TUBO * GRAUS + 0.3), REFLEXO, { bisel: 0, contorno: 0, alfa: 0.7, suave: 0.4 * k, semente: 7751 }))
  L.push(P(caixa(cabeca[0] - 0.9 * k, cabeca[1] - 0.9 * k, cabeca[0] + 0.9 * k, cabeca[1] + 0.9 * k, 0.4 * k), tubo, { bisel: 0.6 * k, tom: 1.15, contorno: 0.3, metal: 0.6, semente: 7752 }))
}
