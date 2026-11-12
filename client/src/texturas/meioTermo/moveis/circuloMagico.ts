/**
 * CÍRCULO MÁGICO no chão (lote 13 dos objetos novos, 11/11/2026, grupo Templo
 * e masmorra; pedido do mestre: "círculo mágico no chão"). Um círculo de
 * invocação riscado à mão no piso: três ANÉIS (o de fora, o de dentro da faixa
 * de runas e um pequeno no meio, com um pingo), uma faixa de RUNAS entre os
 * dois de fora, uma ESTRELA de sete pontas inscrita e um CIRCULINHO em cada
 * ponta. Tudo a giz claro azulado, com as FALHAS de quem riscou (o giz pula, o
 * risco da estrela passa da ponta e enverga, o anel de fora não fecha certo
 * onde começou) e dois BORRÕES de quem pisou em cima. Um brilho leve pintado em
 * volta dos traços diz que ele está ativo; não é fonte de luz.
 *
 * As runas são INVENTADAS, de traço simples (arco, degrau, onda, gancho, gota,
 * sempre com um ponto), sorteadas de um alfabeto de oito desenhos que não são
 * letra nem símbolo de verdade, em grupos separados por dois pontos. A estrela
 * é a de sete pontas que liga cada ponta à segunda seguinte ({7/2}): a de
 * cinco e a de seis ficam de fora de propósito (são símbolos de verdade).
 *
 * É objeto de CHÃO RENTE, como o campinho: nenhuma sombra, nenhuma altura;
 * mora por baixo dos outros objetos e das fichas, e a 3/4 sai igual à vista de
 * cima. O círculo inteiro é UMA peça com textura própria (a distância a cada
 * traço, num passo só por pixel), como o gramado do campinho: uma peça por
 * traço custaria a distância de cada uma em cada pixel.
 *
 * Esticado, os anéis viram elipse pela pegada e a estrela e as runas
 * acompanham, mas o traço não engrossa: a distância de cada traço é medida em
 * px do protótipo, não em fração da pegada, e os circulinhos ficam redondos.
 *
 * Para aparecer em chão claro e em chão escuro o traço tem o miolo quase
 * branco e a beira de um azul mais fundo, e por fora uma borda escura fina e
 * meio transparente; o brilho vem por baixo de tudo. As cores não pegam luz
 * nem sombra (a emissão da textura): é tinta no chão.
 *
 * Sem material no painel: o giz é fixo.
 */
import { hash, type Rgb } from '../../ruido'
import { elipse, type Ponto } from './formas'
import { ruido, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

const VOLTA = Math.PI * 2
const GRAU = Math.PI / 180

// ---------- o desenho (fração da meia pegada, ou px do protótipo quando diz) ----------

/** Os três anéis: o de fora, o de dentro da faixa de runas (onde ficam as pontas da estrela) e o pequeno do meio. */
const ANEL_DE_FORA = 0.9
const ANEL_DAS_RUNAS = 0.74
const ANEL_DO_MEIO = 0.3
/** O meio da faixa das runas, entre os dois anéis de fora. */
const MEIO_DAS_RUNAS = (ANEL_DE_FORA + ANEL_DAS_RUNAS) / 2
/** A estrela de sete pontas {7/2}: cada ponta liga à segunda seguinte. */
const PONTAS = 7
const SALTO = 2
/** Quanto cada risco da estrela passa da ponta (a mão não para na ponta certa) e quanto ele enverga no meio, no máximo (px). */
const PASSA_DA_PONTA = 1.4
const ENVERGA = 0.7
/** O circulinho de cada ponta e o pingo do meio (raios, px). */
const RAIO_DO_CIRCULINHO = 3.1
const RAIO_DO_PINGO = 0.9
/**
 * Quanto os anéis ondulam (px). O de fora não fecha certo: a volta termina
 * `DEGRAU_DO_ANEL` px para fora de onde começou e passa do começo
 * `SOBRA_DO_ANEL` radianos, lado a lado com ele.
 */
const ONDA_DOS_ANEIS = 0.45
const DEGRAU_DO_ANEL = 1.1
const SOBRA_DO_ANEL = 0.24

/** As runas: px por unidade do desenho da runa, o passo de uma a outra ao longo da faixa (px) e uma pausa a cada tantas. */
const ESCALA_DA_RUNA = 2.5
const PASSO_DAS_RUNAS = 7.2
const RUNAS_POR_GRUPO = 6
/** Até onde a faixa das runas é olhada, para dentro e para fora do meio dela (px): a runa mais o brilho. */
const ALCANCE_DA_FAIXA = 2.6 + 3.2

// ---------- o traço (meias larguras, px do protótipo) ----------

/** O miolo claro e a beira azul do traço; as runas, mais finas. */
const MIOLO = 0.38
const TRACO = 0.78
const MIOLO_DA_RUNA = 0.2
const TRACO_DA_RUNA = 0.5
/** Por fora do traço: a borda escura e o brilho. */
const BORDA = 0.45
const BRILHO = 2.6

/**
 * O miolo quase branco, a beira azul, a borda escura e o brilho: um azul só, contido (saturação de 0,05 a
 * 0,45). A beira e a borda são o que segura o traço na lajota clara, onde o miolo quase some.
 */
const COR_DO_MIOLO: Rgb = [0xe2, 0xee, 0xf7]
const COR_DA_BEIRA: Rgb = [0x74, 0x9c, 0xd0]
const COR_DA_BORDA: Rgb = [0x22, 0x2e, 0x40]
const COR_DO_BRILHO: Rgb = [0x9d, 0xc4, 0xec]
const ALFA_DA_BORDA = 0.42
const ALFA_DO_BRILHO = 0.24
/** O giz: onde o ruído cai abaixo do limiar ele pulou (a falha), e quanto a granulação apaga o miolo. */
const LIMIAR_DA_FALHA = -0.38
const FAIXA_DA_FALHA = 0.12
const GRAO_DO_GIZ = 0.16
/** Os borrões de quem pisou: quantos, o raio (px), quanto do traço levam, quanto o alargam (px) e o pó de giz em volta. */
const BORROES = 2
const RAIO_DO_BORRAO = 6.5
const LEVA_DO_TRACO = 0.65
const ALARGA_O_TRACO = 0.6
const ALFA_DO_PO = 0.14

// ---------- as runas inventadas ----------

/** Um risco da runa, no desenho dela: `u` ao longo da faixa e `w` para fora do círculo, de -1 a 1. */
type Risco =
  | { readonly t: 'reta'; readonly a: Ponto; readonly b: Ponto }
  | { readonly t: 'arco'; readonly c: Ponto; readonly r: number; readonly de: number; readonly ate: number }
  | { readonly t: 'anel'; readonly c: Ponto; readonly r: number }
  | { readonly t: 'ponto'; readonly c: Ponto; readonly r: number }

const reta = (ax: number, ay: number, bx: number, by: number): Risco => ({ t: 'reta', a: [ax, ay], b: [bx, by] })
/** Arco de `de` a `ate` graus, no sentido de `u` para `w`. */
const arco = (cx: number, cy: number, r: number, de: number, ate: number): Risco => ({ t: 'arco', c: [cx, cy], r, de: de * GRAU, ate: ate * GRAU })
const anelDaRuna = (cx: number, cy: number, r: number): Risco => ({ t: 'anel', c: [cx, cy], r })
const ponto = (cx: number, cy: number, r: number): Risco => ({ t: 'ponto', c: [cx, cy], r })
const linha = (...pontos: Ponto[]): Risco[] => pontos.slice(1).map((p, i) => reta(pontos[i][0], pontos[i][1], p[0], p[1]))

/**
 * O alfabeto: oito desenhos de traço simples, cada um com um ponto, sem forquilha, sem raio em zigue-zague,
 * sem cruz e sem círculo com ponto no meio (nada de runa, letra ou símbolo de verdade).
 */
const RUNAS: readonly (readonly Risco[])[] = [
  // a meia-lua aberta para o lado, com um esporão nas costas e o ponto na boca (sem o esporão, um C)
  [arco(0.25, 0, 0.75, 105, 255), reta(-0.5, 0, -0.95, 0), ponto(0.4, 0, 0.16)],
  // o degrau, com o ponto ao lado
  [...linha([-0.7, -0.8], [-0.7, 0], [0.2, 0], [0.2, 0.8]), ponto(0.62, -0.55, 0.16)],
  // a onda de três cristas, com o ponto acima (com duas, um W)
  [...linha([-0.9, 0.3], [-0.55, -0.22], [-0.2, 0.3], [0.15, -0.22], [0.5, 0.3], [0.85, -0.22]), ponto(-0.2, -0.72, 0.16)],
  // o anel com três pontos em volta
  [anelDaRuna(0, 0, 0.4), ponto(0, 0.82, 0.13), ponto(-0.62, -0.5, 0.13), ponto(0.62, -0.5, 0.13)],
  // os dois telhados, um sobre o outro, com o ponto em cima (o gancho de antes lia como um J)
  [...linha([-0.6, 0.15], [0, -0.32], [0.6, 0.15]), ...linha([-0.6, 0.78], [0, 0.31], [0.6, 0.78]), ponto(0, -0.78, 0.15)],
  // o ângulo deitado, com o ponto na boca
  [...linha([-0.6, 0.8], [0.55, 0], [-0.6, -0.8]), ponto(-0.25, 0, 0.16)],
  // os dois arcos, com o ponto em cima
  [arco(0, 0, 0.5, 110, 250), arco(0.45, 0, 0.5, 110, 250), ponto(0.62, 0.68, 0.15)],
  // a gota apontando para fora, com o ponto dentro
  [arco(0, -0.35, 0.45, 180, 360), reta(-0.45, -0.35, 0, 0.75), reta(0.45, -0.35, 0, 0.75), ponto(0, -0.3, 0.14)],
]
/** A pausa entre dois grupos de runas: dois pontos. */
const PAUSA: readonly Risco[] = [ponto(0, 0.42, 0.16), ponto(0, -0.42, 0.16)]

/** Distância (em unidades da runa) de (u, w) a um risco. */
function ateORisco(r: Risco, u: number, w: number): number {
  if (r.t === 'reta') {
    const dx = r.b[0] - r.a[0]
    const dy = r.b[1] - r.a[1]
    const pu = u - r.a[0]
    const pw = w - r.a[1]
    let h = (pu * dx + pw * dy) / (dx * dx + dy * dy || 1e-9)
    h = h < 0 ? 0 : h > 1 ? 1 : h
    const qu = pu - dx * h
    const qw = pw - dy * h
    return Math.sqrt(qu * qu + qw * qw)
  }
  const du = u - r.c[0]
  const dw = w - r.c[1]
  const dist = Math.sqrt(du * du + dw * dw)
  if (r.t === 'ponto') return dist - r.r
  if (r.t === 'anel') return Math.abs(dist - r.r)
  let a = Math.atan2(dw, du)
  while (a < r.de) a += VOLTA
  if (a <= r.ate) return Math.abs(dist - r.r)
  const fimU = r.c[0] + Math.cos(r.ate) * r.r - u
  const fimW = r.c[1] + Math.sin(r.ate) * r.r - w
  const iniU = r.c[0] + Math.cos(r.de) * r.r - u
  const iniW = r.c[1] + Math.sin(r.de) * r.r - w
  return Math.sqrt(Math.min(fimU * fimU + fimW * fimW, iniU * iniU + iniW * iniW))
}

function ateARuna(riscos: readonly Risco[], u: number, w: number): number {
  let d = Infinity
  for (const r of riscos) d = Math.min(d, ateORisco(r, u, w))
  return d
}

function limitar01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t
}

function suave01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)
}

/** Um risco reto da estrela, já com a sobra nas pontas: o começo, a direção, o comprimento e quanto enverga (px). */
interface RiscoDaEstrela {
  readonly ax: number
  readonly ay: number
  readonly ux: number
  readonly uy: number
  readonly comprimento: number
  readonly enverga: number
}

/** Um anel: a fração da meia pegada e as duas fases da onda. */
interface Anel {
  readonly raio: number
  readonly f2: number
  readonly f3: number
}

/**
 * A pintura do círculo num passo só por pixel: a distância (px) aos anéis, à estrela, aos circulinhos e ao
 * pingo, e à runa da faixa em que o pixel cai; com ela, o pó dos borrões, o brilho, a borda escura e o traço
 * de giz, de baixo para cima. Fora disso o pixel fica transparente.
 */
function texDoCirculo(c: ContextoDoMovel): Textura {
  const { hw, hh } = c
  const sorteio = Math.round(c.w + 7 * c.h)
  const menorMeio = Math.min(hw, hh)
  const aneis: readonly Anel[] = [ANEL_DE_FORA, ANEL_DAS_RUNAS, ANEL_DO_MEIO].map((raio, i) => ({
    raio,
    f2: hash(i, 1, 2210 + sorteio) * VOLTA,
    f3: hash(i, 2, 2210 + sorteio) * VOLTA,
  }))
  const inicioDoAnel = hash(3, 3, 2210 + sorteio) * VOLTA

  // As pontas da estrela, no anel das runas (uma ponta para cima), e os riscos de cada uma à segunda seguinte.
  const giroDaEstrela = -Math.PI / 2 + (hash(4, 4, 2210 + sorteio) - 0.5) * 0.2
  const pontas: Ponto[] = []
  for (let k = 0; k < PONTAS; k += 1) {
    const a = giroDaEstrela + (k * VOLTA) / PONTAS
    pontas.push([Math.cos(a) * hw * ANEL_DAS_RUNAS, Math.sin(a) * hh * ANEL_DAS_RUNAS])
  }
  const riscos: RiscoDaEstrela[] = pontas.map(([ax, ay], k) => {
    const [bx, by] = pontas[(k + SALTO) % PONTAS]
    const l = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)) || 1
    const [ux, uy] = [(bx - ax) / l, (by - ay) / l]
    return {
      ax: ax - ux * PASSA_DA_PONTA,
      ay: ay - uy * PASSA_DA_PONTA,
      ux,
      uy,
      comprimento: l + 2 * PASSA_DA_PONTA,
      enverga: (hash(k, 5, 2210 + sorteio) - 0.5) * 2 * ENVERGA,
    }
  })

  // As runas: quantas cabem na volta da faixa (o perímetro da elipse, Ramanujan) e qual desenho em cada vaga.
  const ea = MEIO_DAS_RUNAS * hw
  const eb = MEIO_DAS_RUNAS * hh
  const perimetro = Math.PI * (3 * (ea + eb) - Math.sqrt((3 * ea + eb) * (ea + 3 * eb)))
  const vagas = Math.max(RUNAS_POR_GRUPO + 1, Math.round(perimetro / PASSO_DAS_RUNAS))
  const passoDaVaga = VOLTA / vagas
  const inicioDasRunas = hash(6, 6, 2210 + sorteio) * VOLTA
  const desenhos: { readonly riscos: readonly Risco[]; readonly espelho: boolean }[] = []
  for (let j = 0; j < vagas; j += 1) {
    const pausa = j % (RUNAS_POR_GRUPO + 1) === RUNAS_POR_GRUPO
    desenhos.push({
      riscos: pausa ? PAUSA : RUNAS[Math.floor(hash(j, 7, 2210 + sorteio) * RUNAS.length) % RUNAS.length],
      espelho: hash(j, 8, 2210 + sorteio) < 0.5,
    })
  }

  // Os borrões: um sobre o anel de fora e outro entre a estrela e as runas, em lados sorteados.
  const borroes: Ponto[] = []
  for (let k = 0; k < BORROES; k += 1) {
    const a = hash(k, 9, 2210 + sorteio) * VOLTA
    const raio = k === 0 ? ANEL_DE_FORA : ANEL_DAS_RUNAS - 0.06
    borroes.push([Math.cos(a) * hw * raio, Math.sin(a) * hh * raio])
  }

  return (_u, _v, x, y, _p, s, escala) => {
    const X = x / hw
    const Y = y / hh
    const rho = Math.sqrt(X * X + Y * Y)
    // Px por unidade de `rho` no ponto (1 / o gradiente): a distância a um anel em px, com a pegada esticada.
    const gx = X / hw
    const gy = Y / hh
    const gl = Math.sqrt(gx * gx + gy * gy)
    const pxPorRho = gl > 1e-9 ? rho / gl : menorMeio
    const th = Math.atan2(Y, X)

    // ---- os traços principais: os anéis, o pingo, os riscos e os circulinhos da estrela ----
    let d = Infinity
    for (let i = 0; i < aneis.length; i += 1) {
      const anel = aneis[i]
      const onda = ONDA_DOS_ANEIS * (0.6 * Math.sin(2 * th + anel.f2) + 0.4 * Math.sin(3 * th + anel.f3))
      const fora = (rho - anel.raio) * pxPorRho - onda
      if (i === 0) {
        // O anel de fora em espiral: a volta termina um degrau para fora e passa do começo lado a lado.
        let a = th - inicioDoAnel
        a -= Math.floor(a / VOLTA) * VOLTA
        d = Math.min(d, Math.abs(fora - (DEGRAU_DO_ANEL * a) / VOLTA))
        if (a < SOBRA_DO_ANEL) d = Math.min(d, Math.abs(fora - DEGRAU_DO_ANEL * (1 + a / VOLTA)))
      } else {
        d = Math.min(d, Math.abs(fora))
      }
    }
    d = Math.min(d, Math.sqrt(x * x + y * y) - RAIO_DO_PINGO)
    for (const r of riscos) {
      const px = x - r.ax
      const py = y - r.ay
      const t = px * r.ux + py * r.uy
      if (t < 0) d = Math.min(d, Math.sqrt(px * px + py * py))
      else if (t > r.comprimento) {
        const qx = px - r.ux * r.comprimento
        const qy = py - r.uy * r.comprimento
        d = Math.min(d, Math.sqrt(qx * qx + qy * qy))
      } else {
        const lado = -px * r.uy + py * r.ux
        d = Math.min(d, Math.abs(lado - r.enverga * Math.sin((Math.PI * t) / r.comprimento)))
      }
    }
    for (const [vx, vy] of pontas) {
      const dx = x - vx
      const dy = y - vy
      d = Math.min(d, Math.abs(Math.sqrt(dx * dx + dy * dy) - RAIO_DO_CIRCULINHO))
    }

    // ---- a runa da vaga em que o pixel cai (só perto da faixa) ----
    let dr = Infinity
    const atravessa = (rho - MEIO_DAS_RUNAS) * pxPorRho
    if (Math.abs(atravessa) < ALCANCE_DA_FAIXA) {
      let a = th - inicioDasRunas
      a -= Math.floor(a / VOLTA) * VOLTA
      const j = Math.min(vagas - 1, Math.floor(a / passoDaVaga))
      const sen = Math.sin(th)
      const cos = Math.cos(th)
      const pxPorRadiano = MEIO_DAS_RUNAS * Math.sqrt(hw * hw * sen * sen + hh * hh * cos * cos)
      const u = ((a - (j + 0.5) * passoDaVaga) * pxPorRadiano) / ESCALA_DA_RUNA
      const desenho = desenhos[j]
      dr = ateARuna(desenho.riscos, desenho.espelho ? -u : u, atravessa / ESCALA_DA_RUNA) * ESCALA_DA_RUNA
    }

    // ---- os borrões: quanto do traço some aqui, e o pó de giz ----
    let borrao = 0
    for (const [bx, by] of borroes) {
      const dx = x - bx
      const dy = y - by
      borrao = Math.max(borrao, suave01(1 - Math.sqrt(dx * dx + dy * dy) / RAIO_DO_BORRAO))
    }
    if (borrao > 0) borrao *= 0.7 + 0.6 * ruido(x * 0.5 + 23, y * 0.5 + 5)

    const foraDoTraco = Math.min(d - TRACO, dr - TRACO_DA_RUNA) - ALARGA_O_TRACO * borrao
    const aPo = borrao > 0 ? ALFA_DO_PO * borrao * limitar01(0.6 + 1.6 * ruido(x * 0.9 + 3, y * 0.9 + 41)) : 0
    s[4] = 1
    if (foraDoTraco > BRILHO && aPo <= 0) {
      s[5] = 0
      return
    }

    // ---- o giz: as falhas, a granulação e o que o borrão levou ----
    const falha = suave01((ruido(x * 0.42 + 13, y * 0.42 + 71) - LIMIAR_DA_FALHA) / FAIXA_DA_FALHA)
    const giz = falha * (1 - LEVA_DO_TRACO * borrao)
    const grao = 1 - GRAO_DO_GIZ * (0.5 + ruido(x * 2.3 + 7, y * 2.3 + 17))
    const aTraco = limitar01(0.5 - foraDoTraco * escala) * giz
    const miolo = limitar01(0.5 - (Math.min(d - MIOLO, dr - MIOLO_DA_RUNA) - ALARGA_O_TRACO * borrao) * escala) * grao
    const aBorda = foraDoTraco > 0 ? ALFA_DA_BORDA * giz * limitar01(1 - foraDoTraco / BORDA) : 0
    const perto = 1 - limitar01(foraDoTraco / BRILHO)
    const aBrilho = ALFA_DO_BRILHO * Math.sqrt(giz) * perto * perto

    // De baixo para cima: o pó, o brilho, a borda escura e o traço ("por cima" de cada camada a anterior).
    let r = COR_DO_MIOLO[0]
    let g = COR_DO_MIOLO[1]
    let b = COR_DO_MIOLO[2]
    let a = aPo
    const cobrir = (cor: Rgb, k: number): void => {
      if (k <= 0) return
      const junto = k + a * (1 - k)
      r = (cor[0] * k + r * a * (1 - k)) / junto
      g = (cor[1] * k + g * a * (1 - k)) / junto
      b = (cor[2] * k + b * a * (1 - k)) / junto
      a = junto
    }
    cobrir(COR_DO_BRILHO, aBrilho)
    cobrir(COR_DA_BORDA, aBorda)
    cobrir(
      [
        COR_DA_BEIRA[0] + (COR_DO_MIOLO[0] - COR_DA_BEIRA[0]) * miolo,
        COR_DA_BEIRA[1] + (COR_DO_MIOLO[1] - COR_DA_BEIRA[1]) * miolo,
        COR_DA_BEIRA[2] + (COR_DO_MIOLO[2] - COR_DA_BEIRA[2]) * miolo,
      ],
      aTraco,
    )
    s[0] = r
    s[1] = g
    s[2] = b
    s[5] = a
  }
}

export const montarCirculoMagico: MontarMovel = (c, cena) => {
  cena.partes.push(c.peca(elipse(0, 0, c.hw, c.hh), { classe: 'liso', rgb: COR_DA_BEIRA }, { bisel: 0, contorno: 0, textura: texDoCirculo(c), semente: 2201 }))
}
