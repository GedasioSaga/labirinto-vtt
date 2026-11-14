/**
 * VARAL DE BANDEIRINHAS de cima com volume (L09 dos objetos novos,
 * 14/11/2026, grupo Taverna e festa): o enfeite da festa junina. Dois MASTROS
 * de madeira, a CORDA amarrada logo abaixo do topo deles e caindo numa
 * BARRIGA leve no meio, e as BANDEIRINHAS de pano penduradas lado a lado: o
 * retângulo com o RECORTE em V embaixo (a bandeirinha de São João, e não o
 * triângulo de aniversário), em seis cores que se alternam, uma em cada três
 * de chita (bolinhas claras), com a bainha dobrada por cima da corda e a ponta
 * de baixo balançando um pouco para um lado.
 *
 * De cima as bandeirinhas aparecem EM ESCORÇO, como as roupas do varal de
 * roupa (`varalDeRoupa.ts`): a bainha no lugar dela, na corda, e o pano
 * encolhido para a frente. No chão, a sombra comprida: a curva da corda (é ela
 * que mostra a barriga) e a de cada bandeirinha inteira, caídas para baixo à
 * direita. A 25% de zoom sobra a fila de retalhos coloridos entre os dois
 * pinos dos mastros.
 *
 * NA 3/4 (perfil `{ modo: 'derivado', espessura: 0 }`) cada bandeirinha é
 * desenhada de frente e cortada em FAIXAS deitadas, cada uma presa num PINO na
 * altura dela (a sanfona do varal de roupa): na 3/4 cada faixa sobe um pouco
 * menos que a de cima e a bandeirinha se abre inteira, pendurada da corda. A
 * CORDA é cortada em pedaços curtos, cada um preso num pino na altura da curva
 * no meio dele, e cada pedaço é desenhado um pouco inclinado (o quanto a curva
 * sobe ou desce dentro dele): de cima isso dá um desvio de menos de meio px, e
 * na 3/4 a corda sai como uma curva lisa, sem degraus. O alto de cada
 * bandeirinha acompanha a curva da corda.
 *
 * GIRO (`c.giro`, que só chega na 3/4): com meia volta as bandeirinhas são
 * montadas de frente para o outro lado (desenho desgirado, como o varal de
 * roupa); com um quarto de volta o varal é visto de ponta e cada bandeirinha
 * vira uma fita de pano ao longo da corda.
 *
 * Os mastros e a corda saem de `criarVaral`, `montarCorda` e `montarMastros`,
 * que o varal de lanternas (`varalDeLanternas.ts`) também usa. As
 * bandeirinhas têm medida própria: o varal esticado ganha mais bandeirinhas,
 * nunca bandeirinha esticada. Material: `madeira` (os mastros); a corda e os
 * panos são fixos.
 */
import { hash, misturar, type Rgb } from '../../ruido'
import { anel, cadeia, caixa, capsula, poligono, type Caixa, type Forma, type Ponto } from './formas'
import { contato, ruido, SOMBRA_X, SOMBRA_Y, TOM_DA_CORDA, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type Peca, type Sombra, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

// ---------- o varal: os mastros e a corda (o varal de lanternas usa os mesmos) ----------

/** Alturas em casas: o topo dos mastros e a corda, amarrada logo abaixo dele (bem acima da cabeça, como na festa). */
const ALTURA_DO_MASTRO = 2
const ALTURA_DA_CORDA = 1.95
/** Quanto a corda cai no meio, em fração do meio vão: o bastante para a 3/4 e a sombra mostrarem a curva. */
const BARRIGA = 0.1
/** O mastro: o raio (casas) e a distância do meio dele à ponta da pegada (px do protótipo). */
const RAIO_DO_MASTRO = 0.05
const MASTRO_DA_PONTA = 4
/** A corda: a distância ao fundo da pegada, o raio e o comprimento de cada pedaço (px do protótipo). */
const CORDA_DO_FUNDO = 6.5
const RAIO_DA_CORDA = 0.6
const PEDACO_DA_CORDA = 2
/** Meia medida do pino de cada pedaço da corda (px): pequeno, escondido debaixo do pedaço. */
const PINO = 0.12
/** A corda de palha clara da cerca, a laçada no mastro e a ponta solta que sobra do nó (px do protótipo). */
const CORDA: MaterialDaPeca = { classe: 'corda', rgb: TOM_DA_CORDA }
const LACADA = 0.8
const PONTA_SOLTA = { raio: 0.5, sai: 1.6, cai: 2.8 } as const
/** A sombra de cada mastro (um risco firme) e a da corda. */
const SOMBRA_DO_MASTRO = { suave: 1.5, forca: 0.22 } as const
const SOMBRA_DA_CORDA = { raio: 0.45, suave: 1.8, forca: 0.14 } as const
/** Em quantos pontos a sombra da corda segue a curva. */
const PONTOS_DA_SOMBRA_DA_CORDA = 24

/** O varal montado: onde estão os mastros e a corda, e para onde cai a sombra no desenho. */
export interface Varal {
  readonly P: CriarPeca
  readonly L: Peca[]
  readonly sombras: Sombra[]
  /** O meio de cada mastro fica em ±`xMastro`, na linha da corda (`yCorda`). */
  readonly xMastro: number
  readonly yCorda: number
  readonly raio: number
  readonly zMastro: number
  /** A altura da corda junto do mastro e quanto ela cai no meio. */
  readonly zPonta: number
  readonly barriga: number
  /** Os quartos de volta (0 a 3) que a 3/4 pinta. */
  readonly quartos: number
  /** A direção da sombra no desenho por px de altura (cai para baixo à direita NA TELA). */
  readonly sx: number
  readonly sy: number
}

/** Os quartos de volta (0 a 3) do giro que a 3/4 pinta. */
export function quartosDeVolta(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O deslocamento no desenho que cai em (dx, dy) NA TELA depois do quarto de volta que a 3/4 pinta (o do varal de roupa). */
export function desgirado(dx: number, dy: number, quartos: number): [number, number] {
  return quartos === 1 ? [dy, -dx] : quartos === 2 ? [-dx, -dy] : quartos === 3 ? [-dy, dx] : [dx, dy]
}

/** Só a altura, para a 3/4: uma estrutura que não faz sombra no chão. */
export function estrutura(forma: Forma, z: number): Sombra {
  return { forma, z, solta: true, forca: 0, suave: 0.1 }
}

/** Círculo com a distância exata (a sombra do mastro alto mede a forma muitas vezes por pixel). */
export function circulo(cx: number, cy: number, r: number): Forma {
  return {
    b: [cx - r, cy - r, cx + r, cy + r],
    d: (x, y) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r,
  }
}

/** A mesma forma com outra caixa de pintura (tem de conter a forma inteira). */
export function naCaixa(f: Forma, b: Caixa): Forma {
  return { b, d: (x, y) => f.d(x, y) }
}

/** A forma com a caixa crescida até o meio dela cair em (cx, cy): a 3/4 lê o meio da caixa para saber com quem a peça sobe. */
export function comMeioEm(f: Forma, cx: number, cy: number): Forma {
  const mx = Math.max(cx - f.b[0], f.b[2] - cx)
  const my = Math.max(cy - f.b[1], f.b[3] - cy)
  return naCaixa(f, [cx - mx, cy - my, cx + mx, cy + my])
}

export function criarVaral(c: ContextoDoMovel, cena: Cena): Varal {
  const quartos = quartosDeVolta(c.giro)
  const raio = c.g * RAIO_DO_MASTRO
  const xMastro = c.hw - MASTRO_DA_PONTA
  const [sx, sy] = desgirado(SOMBRA_X, SOMBRA_Y, quartos)
  return {
    P: c.peca,
    L: cena.partes,
    sombras: cena.sombras,
    xMastro,
    yCorda: -c.hh + CORDA_DO_FUNDO,
    raio,
    zMastro: c.g * ALTURA_DO_MASTRO,
    zPonta: c.g * ALTURA_DA_CORDA,
    barriga: BARRIGA * (xMastro - raio),
    quartos,
    sx,
    sy,
  }
}

/** Onde a corda começa e acaba: na beira de cada mastro (o pedaço de dentro do mastro subiria com ele). */
export function vaoDaCorda(v: Varal): number {
  return v.xMastro - v.raio
}

/** A altura da corda em `x`: a do nó junto do mastro, caindo em parábola até o meio. */
export function zDaCorda(v: Varal, x: number): number {
  const t = Math.min(1, Math.abs(x) / vaoDaCorda(v))
  return v.zPonta - v.barriga * (1 - t * t)
}

/** O sentido em que a 3/4 vê o varal de frente: 1 sem giro, -1 com meia volta (0 de ponta). */
export function sinalDeFrente(v: Varal): number {
  return v.quartos === 0 ? 1 : v.quartos === 2 ? -1 : 0
}

/** Os meios de `n` coisas de largura `largura` repartidas por igual entre `de` e `ate`, com pelo menos `folga` entre elas. */
export function repartir(de: number, ate: number, largura: number, folga: number): number[] {
  const n = Math.max(1, Math.floor((ate - de + folga) / (largura + folga)))
  const passo = (ate - de) / n
  return Array.from({ length: n }, (_, i) => de + passo * (i + 0.5))
}

/** A sombra da corda no chão: segue a curva, mais longe onde a corda está mais alta. */
export function sombraDaCorda(v: Varal): void {
  const vao = vaoDaCorda(v)
  const pontos: Ponto[] = []
  for (let i = 0; i <= PONTOS_DA_SOMBRA_DA_CORDA; i += 1) {
    const x = -vao + (2 * vao * i) / PONTOS_DA_SOMBRA_DA_CORDA
    const z = zDaCorda(v, x)
    pontos.push([x + v.sx * z, v.yCorda + v.sy * z])
  }
  v.sombras.push({ forma: cadeia(pontos, SOMBRA_DA_CORDA.raio), z: 0, suave: SOMBRA_DA_CORDA.suave, forca: SOMBRA_DA_CORDA.forca })
}

/**
 * A CORDA, de mastro a mastro, em pedaços curtos: cada um preso num pino na
 * altura da curva no meio dele e inclinado o tanto que a curva sobe ou desce
 * dentro dele (de frente; de ponta a corda corre para o fundo e fica reta).
 */
export function montarCorda(v: Varal): void {
  const vao = vaoDaCorda(v)
  const n = Math.max(8, Math.ceil((2 * vao) / PEDACO_DA_CORDA))
  const passo = (2 * vao) / n
  const sinal = sinalDeFrente(v)
  for (let i = 0; i < n; i += 1) {
    const xa = -vao + i * passo
    const xb = xa + passo
    const xm = (xa + xb) / 2
    const zm = zDaCorda(v, xm)
    const ya = v.yCorda + sinal * (zm - zDaCorda(v, xa))
    const yb = v.yCorda + sinal * (zm - zDaCorda(v, xb))
    v.sombras.push(estrutura(caixa(xm - PINO, v.yCorda - PINO, xm + PINO, v.yCorda + PINO), zm))
    v.L.push(v.P(comMeioEm(capsula(xa, ya, xb, yb, RAIO_DA_CORDA), xm, v.yCorda), CORDA, { eixo: Math.atan2(yb - ya, xb - xa), bisel: 0.5, contorno: 0.26, semente: 9101 + (i % 5) }))
  }
}

/** Topo de madeira cortada: anéis em volta do meio do mastro (como o mourão da cerca). */
function texDoTopo(cx: number, cy: number): Textura {
  return (_u, _v, x, y, p, s) => {
    const longe = Math.hypot(x - cx, y - cy) + ruido(x * 0.2 + p.semente, y * 0.2) * 1.2
    s[3] += Math.sin(longe * 4.2) * 0.04 + ruido(x * 0.6, y * 0.6) * 0.05 + 0.06
  }
}

/** Os MASTROS: o risco da sombra, a ponta solta do nó, a laçada da corda e o topo cortado. */
export function montarMastros(v: Varal, madeira: MaterialDaPeca): void {
  for (const lado of [-1, 1]) {
    const px = lado * v.xMastro
    const mastro = circulo(px, v.yCorda, v.raio)
    v.sombras.push({ forma: mastro, z: v.zMastro, ...SOMBRA_DO_MASTRO }, contato(mastro, 0.3))
    const ponta = capsula(px + lado * v.raio * 0.5, v.yCorda + v.raio * 0.7, px + lado * (v.raio * 0.5 + PONTA_SOLTA.sai), v.yCorda + v.raio * 0.7 + PONTA_SOLTA.cai, PONTA_SOLTA.raio)
    v.L.push(v.P(comMeioEm(ponta, px, v.yCorda), CORDA, { eixo: Math.atan2(PONTA_SOLTA.cai, lado * PONTA_SOLTA.sai), bisel: 0.5, tom: 0.96, contorno: 0.26, semente: 9112 + lado }))
    v.L.push(v.P(anel(px, v.yCorda, v.raio + LACADA, v.raio + LACADA, v.raio - 0.3, v.raio - 0.3), CORDA, { arco: { cx: px, cy: v.yCorda, r: v.raio, a0: 0 }, bisel: 0.6, contorno: 0.26, semente: 9115 + lado }))
    // O topo leva a maior caixa do mastro: é da maior peça que a 3/4 tira o material da frente dele (madeira, e não corda).
    const emVolta = v.raio * 0.7 + PONTA_SOLTA.cai + PONTA_SOLTA.raio + 0.5
    v.L.push(v.P(naCaixa(mastro, [px - emVolta, v.yCorda - emVolta, px + emVolta, v.yCorda + emVolta]), madeira, { tabua: 0, bisel: 0.8, contorno: 0.28, textura: texDoTopo(px, v.yCorda), semente: 9118 + lado }))
  }
}

// ---------- a sanfona: o pano pendurado de frente ----------

/** A altura de cada faixa (px do protótipo) e o quanto ela entra debaixo da seguinte. */
const FAIXA = 1.25
const TRANSPASSE = 1
/** O escorço de cima: cada faixa desce só este tanto da altura dela em relação à de cima. */
const ESCORCO = 0.45
/** O meio da caixa de cada faixa, a partir do alto dela (px): é onde fica o pino dela. */
const MEIO_DA_FAIXA = 0.9
/** O pino de cada faixa (px): mais baixo que o passo das faixas de cima (`FAIXA * ESCORCO`). */
const FRESTA = { meiaLargura: 0.4, meiaAltura: 0.08 } as const

/** Um pano pendurado de frente: `forma` com x a partir do meio dele e y da corda para baixo (px do protótipo). */
interface Pano {
  readonly forma: Forma
  readonly mat: MaterialDaPeca
  readonly textura: Textura
  /** Onde ficam os pinos das faixas (x) e o y mais fundo em que um pino ainda cai dentro do pano. */
  readonly xDoPino: number
  readonly fundoDoPino: number
  readonly semente: number
}

/** A forma e a textura com meia volta em torno da origem (o pano de frente para o outro lado). */
function emMeiaVolta(f: Forma): Forma {
  return { b: [-f.b[2], -f.b[3], -f.b[0], -f.b[1]], d: (x, y) => f.d(-x, -y) }
}
function texEmMeiaVolta(tex: Textura): Textura {
  return (u, v, x, y, p, s, escala) => tex(u, v, -x, -y, p, s, escala)
}

/**
 * O pano DE FRENTE, em sanfona, com o meio dele em `x` na corda, pendurado da
 * altura `zTopo`. As faixas vão de baixo para cima na lista: de cima, cada uma
 * cobre a de baixo e deixa à mostra só a beira dela.
 */
function pendurarDeFrente(v: Varal, pano: Pano, x: number, zTopo: number): void {
  const sinal = sinalDeFrente(v)
  const [, alto, , baixo] = pano.forma.b
  const meia = (pano.forma.b[2] - pano.forma.b[0]) / 2 + Math.abs(pano.xDoPino) + 1
  const faixas = Math.max(1, Math.floor((pano.fundoDoPino - alto - MEIO_DA_FAIXA) / FAIXA) + 1)
  const forma = sinal > 0 ? pano.forma : emMeiaVolta(pano.forma)
  const textura = sinal > 0 ? pano.textura : texEmMeiaVolta(pano.textura)
  for (let k = faixas - 1; k >= 0; k -= 1) {
    const y0 = alto + k * FAIXA
    const y1 = k === faixas - 1 ? baixo + 1 : y0 + FAIXA + TRANSPASSE
    const meio = y0 + MEIO_DA_FAIXA
    const meiaAltura = Math.max(meio - y0, y1 - meio)
    // A faixa: o pano só entre y0 e y1 (no lado que a meia volta leva), com a caixa centrada no pino dela.
    const de = sinal > 0 ? y0 : -y1
    const ate = sinal > 0 ? y1 : -y0
    const xp = sinal * pano.xDoPino
    const yp = sinal * meio
    const fatia: Forma = { b: [xp - meia, yp - meiaAltura, xp + meia, yp + meiaAltura], d: (px, py) => Math.max(forma.d(px, py), de - py, py - ate) }
    // De cima a faixa fica `sobe` px acima do lugar dela de frente; na 3/4 ela sobe esse tanto a menos que a corda.
    const sobe = k * FAIXA * (1 - ESCORCO)
    const fx = x + xp
    const fy = v.yCorda + sinal * (meio - sobe)
    v.sombras.push(estrutura(caixa(fx - FRESTA.meiaLargura, fy - FRESTA.meiaAltura, fx + FRESTA.meiaLargura, fy + FRESTA.meiaAltura), zTopo - sobe))
    v.L.push(v.P(fatia, pano.mat, { bisel: 0, contorno: 0, textura, dx: x, dy: v.yCorda - sinal * sobe, semente: pano.semente }))
  }
}

/** A meia grossura do pano visto de ponta (px) e o raio do pino dele. */
const MEIA_FITA = 0.65
const PINO_DA_FITA = 0.3

/** O pano visto DE PONTA (o varal com um quarto de volta na 3/4): uma fita ao longo da corda, caindo para o lado que fica embaixo na tela. */
function pendurarDePonta(v: Varal, pano: Pano, x: number, zTopo: number): void {
  const sul = v.quartos === 1 ? 1 : -1
  const largura = pano.forma.b[2] - pano.forma.b[0]
  const comprimento = pano.forma.b[3]
  const de = x - largura / 2 + (sul < 0 ? -comprimento : 0)
  const ate = x + largura / 2 + (sul > 0 ? comprimento : 0)
  v.sombras.push(estrutura(circulo((de + ate) / 2, v.yCorda, PINO_DA_FITA), zTopo))
  v.L.push(v.P(caixa(de, v.yCorda - MEIA_FITA, ate, v.yCorda + MEIA_FITA, MEIA_FITA * 0.7), pano.mat, { bisel: 0.5, contorno: 0.24, semente: pano.semente }))
}

/** Pendura o pano do jeito que a 3/4 vê o varal (de frente ou de ponta). */
export function pendurar(v: Varal, pano: Pano, x: number, zTopo: number): void {
  if (v.quartos % 2 === 1) pendurarDePonta(v, pano, x, zTopo)
  else pendurarDeFrente(v, pano, x, zTopo)
}

// ---------- as bandeirinhas ----------

/** A bandeirinha (casas): a largura, a altura nos lados, o fundo do recorte em V e a folga entre duas. */
const BANDEIRINHA = { largura: 0.24, altura: 0.3, recorte: 0.1, folga: 0.06 } as const
/** Quanto a ponta de baixo balança para um lado, no máximo (px), e a folga entre o mastro e a primeira (px). */
const BALANCO = 0.9
const FOLGA_DO_MASTRO = 2.5
/** As seis cores de festa, contidas (saturação até ~0,6), na ordem em que se alternam (as fitas do mastro usam as mesmas). */
export const CORES_DE_FESTA: readonly Rgb[] = [
  [0xaa, 0x58, 0x4c],
  [0xd0, 0xb0, 0x68],
  [0x50, 0x74, 0xa0],
  [0x60, 0x88, 0x56],
  [0xc8, 0x7c, 0x56],
  [0xc0, 0x80, 0x88],
]
/** As bolinhas da chita: o passo da grade, o raio e a cor (o creme do pano cru). */
const CHITA = { passo: 2.6, raio: 0.55, cor: [0xea, 0xe0, 0xc8] as Rgb, forca: 0.75 } as const
/** O contorno do pano, pintado na textura (as faixas não têm contorno próprio, senão cada corte ganhava um risco). */
const BEIRA = { larga: 0.8, forca: 0.26 } as const
/** A bainha dobrada por cima da corda (px) e quanto ela escurece. */
const BAINHA = { alta: 1.4, sombra: 0.1 } as const
/** As ondas do pano pendurado, mais fundas para baixo. */
const ONDA = { passo: 0.85, torta: 2.4, forca: 0.07 } as const
/** A sombra de cada bandeirinha no chão. */
const SOMBRA_DA_BANDEIRINHA = { suave: 1.6, forca: 0.2 } as const

/** A pintura da bandeirinha de frente: o pano, a chita, a bainha, as ondas e a beira escura. */
function texDaBandeirinha(inteira: Forma, topo: (x: number) => number, altura: number, chita: boolean, sem: number): Textura {
  const tecido = texturaDaClasse('tecido')
  return (u, v, x, y, p, s, escala) => {
    if (tecido !== null) tecido(u, v, x, y, p, s, escala)
    if (chita) {
      // Bolinhas em grade desencontrada, uma fileira sim, outra meio passo adiante.
      const fila = Math.floor(y / CHITA.passo)
      const gx = x + (fila % 2 === 0 ? 0 : CHITA.passo / 2)
      const dx = gx - (Math.floor(gx / CHITA.passo) + 0.5) * CHITA.passo
      const dy = y - (fila + 0.5) * CHITA.passo
      const d = Math.hypot(dx, dy) - CHITA.raio
      if (d < 0.3) {
        const t = CHITA.forca * Math.min(1, (0.3 - d) / 0.5)
        const cor = misturar([s[0], s[1], s[2]], CHITA.cor, t)
        s[0] = cor[0]
        s[1] = cor[1]
        s[2] = cor[2]
      }
    }
    const dentro = -inteira.d(x, y)
    let luz = dentro < BEIRA.larga ? -BEIRA.forca * (1 - Math.max(0, dentro) / BEIRA.larga) : 0
    const daCorda = y - topo(x)
    if (daCorda < BAINHA.alta) luz -= BAINHA.sombra * (daCorda < BAINHA.alta * 0.5 ? 0.6 : 1)
    const fundo = Math.max(0, Math.min(1, daCorda / altura))
    luz += Math.sin(x * ONDA.passo + ruido(x * 0.08 + sem, y * 0.05 + sem) * ONDA.torta) * ONDA.forca * (0.3 + 0.7 * fundo)
    s[3] += luz
  }
}

export const montarVaralDeBandeirinhas: MontarMovel = (c, cena) => {
  const v = criarVaral(c, cena)
  const largura = BANDEIRINHA.largura * c.g
  const altura = BANDEIRINHA.altura * c.g
  const recorte = BANDEIRINHA.recorte * c.g
  const sinal = sinalDeFrente(v)
  const vao = vaoDaCorda(v) - FOLGA_DO_MASTRO
  const meios = repartir(-vao, vao, largura, BANDEIRINHA.folga * c.g)

  sombraDaCorda(v)
  meios.forEach((xf, i) => {
    const zf = zDaCorda(v, xf)
    const balanco = (hash(i, 31, 977) - 0.5) * 2 * BALANCO
    // O alto acompanha a corda: na 3/4 o pano de frente sobe com o pino do meio, e a beira de cima fica na curva.
    const topo = (px: number): number => zf - zDaCorda(v, xf + (sinal === 0 ? 1 : sinal) * px)
    const meia = largura / 2
    const pontos: Ponto[] = [
      [-meia, topo(-meia)],
      [meia, topo(meia)],
      [meia + balanco, altura + topo(meia)],
      [balanco, altura - recorte + topo(0)],
      [-meia + balanco, altura + topo(-meia)],
    ]
    const forma = poligono(pontos)
    // O pino de cada faixa vai do lado em que o alto está mais alto (o pino da primeira faixa cai dentro do pano).
    const xDoPino = (topo(meia) < topo(-meia) ? 1 : -1) * 0.35 * largura
    const fundoDoPino = altura - recorte * 0.35 + Math.min(topo(meia), topo(-meia)) - 1
    const cor = CORES_DE_FESTA[i % CORES_DE_FESTA.length]
    const mat: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: cor }
    const textura = texDaBandeirinha(forma, topo, altura, i % 3 === 1, 9200 + i)
    pendurar(v, { forma, mat, textura, xDoPino, fundoDoPino, semente: 9200 + i }, xf, zf)
    // A sombra da bandeirinha inteira no chão: cada ponto do pano cai pela altura dele.
    const noChao = pontos.map(([px, py]): Ponto => {
      const z = zf - py
      return [xf + px + v.sx * z, v.yCorda + v.sy * z]
    })
    cena.sombras.push({ forma: poligono(noChao), z: 0, ...SOMBRA_DA_BANDEIRINHA })
  })

  // A corda por cima das bainhas, e os mastros, mais altos, por último.
  montarCorda(v)
  montarMastros(v, c.m.madeira)
}
