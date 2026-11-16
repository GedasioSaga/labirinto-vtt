/**
 * ARMÁRIO DE BANHEIRO de cima com volume (banheiro moderno, pedido do mestre de 15/11/2026): a COLUNA alta de
 * madeira, encostada na parede (o fundo, a beira de cima), com a PORTA de cima, o NICHO aberto no meio com as
 * TOALHAS dobradas em duas pilhas e a PORTA de baixo. A frente é o lado de baixo.
 *
 * DE CIMA aparece o tampo de madeira lisa (a peça é alta: de cima só se vê o alto dela) com o vaso branco de uma
 * plantinha no canto de trás, que dá a escala e diz "banheiro arrumado". NA 3/4 a frente é desenhada de frente e
 * guardada em faixas debaixo do tampo, como a do guarda-roupa e a da geladeira (`guardaRoupa.ts`): a beira do tampo
 * e a sombra dela, as duas portas lisas com o puxador reto de cromo junto da beira que abre, o nicho escuro com a
 * sombra do alto e as toalhas dobradas (cada uma com a dobra da frente e o vinco), e o rodapé escuro recuado. É o
 * nicho com as toalhas que diz "armário de banheiro". GIRADO, a face de baixo na tela é a lateral (com a beira das
 * portas e o nicho de quina na frente) ou o fundo, desenhados do mesmo jeito (`guardarFaceGirada`).
 *
 * Materiais: `madeira` (a coluna) e `toalha` (as toalhas). O cromo e a louça do vaso são fixos.
 */
import { caixa, capsula, elipse, elipseGirada, type Forma } from './formas'
import { contato, type Cena, type CriarPeca, type MaterialDaPeca } from './motor'
import { QUARTO, type ContextoDoMovel, type MontarMovel } from './contexto'
import { CANTONEIRA, FRESTA, SOMBRA_DA_MADEIRA, fatiar, guardarFaceGirada, naFaixa, type OpcoesDaFrente, type PecaDaFrente } from './guardaRoupa'
import { quartosDoGiro } from './pipaDeitada'
import { BRILHO_DO_CROMO, CROMO, ESCURO, LOUCA, PISO_DO_BANHEIRO, texLouca } from './apoioDoBanheiroModerno'

/** A altura da coluna, em casas, e onde fica o nicho (frações da altura: o chão e o teto dele). */
const ALTURA = 1.35
const NICHO = { chao: 0.36, teto: 0.6 } as const
/** O tampo de frente, a sombra dele, o rodapé, a lateral que sobra em volta das portas e as folgas (px). */
const BEIRA_DO_TAMPO = 2.2
const SOMBRA_DO_TAMPO = 2
const RODAPE = 3
const LATERAL = 1.4
const FOLGA = 0.6
/** A prateleira que separa o nicho das portas (px) e a sombra do alto dentro dele. */
const PRATELEIRA = 1.2
const SOMBRA_DO_NICHO = 3.4
/** O puxador reto de pé, junto da beira que abre: a distância da beira, a folga da ponta, o comprimento e o raio (px). */
const PUXADOR = { afastamento: 2.2, daPonta: 2.4, comprimento: 7.6, raio: 0.55 } as const
/** A madeira de frente: o corpo nas frestas, as portas, o fundo do nicho, a lateral e as costas. */
const TOM_DO_CORPO = 0.74
const TOM_DA_PORTA = 1
const TOM_DO_NICHO = 0.42
const TOM_DA_LATERAL = 0.86
const TOM_DAS_COSTAS = 0.82
/** As toalhas: a altura de cada uma dobrada, a largura da pilha (fração do nicho) e quantas por pilha. */
const TOALHA = { alta: 4.4, parte: 0.42, pilha: 3 } as const
/** A beira das portas vista de lado, na quina da frente (px). */
const PORTA_DE_LADO = 1.4
/** O vaso da plantinha, de cima: a distância dos cantos de trás e o raio (px). */
const VASO = { canto: 5.4, raio: 3.2 } as const
/** As folhas: um verde de musgo apagado (a planta não pode virar a cor mais forte do banheiro). */
const FOLHA: MaterialDaPeca = { classe: 'liso', rgb: [0x6f, 0x80, 0x5c] }

/** A madeira de pé: veio de cima a baixo, sem tábuas (a porta lisa). */
function madeiraDePe(tom: number, semente: number, bisel: number): OpcoesDaFrente {
  return { eixo: QUARTO, tabua: 0, bisel, tom, contorno: 0.2, semente }
}

/** O que corre no alto das faces: a sombra do tampo e a beira dele, de madeira deitada. */
function beiraDoTampo(mad: MaterialDaPeca, xa: number, xb: number, H: number): PecaDaFrente[] {
  const alto = -H + BEIRA_DO_TAMPO
  return [
    { forma: caixa(xa + 0.5, alto - 0.3, xb - 0.5, alto + SOMBRA_DO_TAMPO, 0), mat: SOMBRA_DA_MADEIRA, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 1.2, semente: 9520 } },
    { forma: caixa(xa, -H, xb, alto, 0.5), mat: mad, o: { eixo: 0, tabua: 0, bisel: 0.7, tom: 1.04, contorno: 0.18, semente: 9521 } },
  ]
}

/** O puxador reto de cromo, de pé: a sombra dele na porta e a barra (`y0` = o alto, `y1` = o pé; y < 0). */
function puxador(x: number, y0: number, y1: number): PecaDaFrente[] {
  const { raio } = PUXADOR
  return [
    { forma: capsula(x + 0.9, y0 + 0.9, x + 0.9, y1 + 0.9, raio + 0.25), mat: SOMBRA_DA_MADEIRA, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.3, suave: 1, semente: 9522 } },
    { forma: capsula(x, y0, x, y1, raio), mat: CROMO, o: { eixo: QUARTO, tabua: 0, bisel: raio * 0.9, contorno: 0.24, metal: BRILHO_DO_CROMO, semente: 9523 } },
  ]
}

/** Uma pilha de toalhas dobradas no chão do nicho: cada uma com a dobra redonda da frente, o vinco e a sombra na de baixo. */
function pilhaDeToalhas(toalha: MaterialDaPeca, xa: number, xb: number, chao: number, semente: number): PecaDaFrente[] {
  const pecas: PecaDaFrente[] = []
  for (let i = 0; i < TOALHA.pilha; i += 1) {
    // Cada toalha sai um nada para o lado da de baixo, como quem empilhou à mão.
    const desvio = (i % 2 === 0 ? 1 : -1) * 0.5 * i
    const y1 = chao - i * TOALHA.alta
    const y0 = y1 - TOALHA.alta + 0.15
    const tom = [1, 0.94, 1.03][i % 3]
    pecas.push({ forma: caixa(xa + desvio, y0, xb + desvio, y1, 1.3), mat: toalha, o: { eixo: 0, bisel: 1.2, tom, contorno: 0.2, semente: semente + i } })
    // A dobra de cima pega a luz (pano não brilha: só um degrau mais claro); o vinco do meio fica na sombra.
    pecas.push({ forma: caixa(xa + desvio + 1.2, y0 + 0.5, xb + desvio - 1.2, y0 + 1.2, 0.35), mat: toalha, o: { tabua: 0, bisel: 0, tom: 1.12, contorno: 0, alfa: 0.35, suave: 0.5, semente: semente + 10 + i } })
    pecas.push({ forma: caixa(xa + desvio + 1.4, y0 + TOALHA.alta * 0.56, xb + desvio - 1.4, y0 + TOALHA.alta * 0.56 + 0.4), mat: SOMBRA_DA_MADEIRA, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.2, suave: 0.3, semente: semente + 20 + i } })
  }
  return pecas
}

/** A FRENTE, de frente (x de `xa` a `xb`, y = 0 no chão e negativo para cima). */
function desenharFrente(c: ContextoDoMovel, H: number, xa: number, xb: number): PecaDaFrente[] {
  const mad = c.m.madeira
  const nichoChao = H * NICHO.chao
  const nichoTeto = H * NICHO.teto
  const xi0 = xa + LATERAL
  const xi1 = xb - LATERAL
  const pecas: PecaDaFrente[] = [
    { forma: caixa(xa, -H, xb, 0, 0.5), mat: mad, o: madeiraDePe(TOM_DO_CORPO, 9530, 0.9) },
    { forma: caixa(xi0, -RODAPE, xi1, 0, 0.3), mat: ESCURO, o: { tabua: 0, bisel: 0.4, contorno: 0.1, recesso: { k: 1.2, forca: 0.3 }, semente: 9531 } },
    // O NICHO: o fundo escuro, a sombra do alto e as duas pilhas de toalhas no chão dele.
    { forma: caixa(xi0, -nichoTeto, xi1, -nichoChao, 0.4), mat: mad, o: { eixo: 0, tabua: 0, bisel: 0.4, tom: TOM_DO_NICHO, contorno: 0.22, recesso: { k: 2, forca: 0.3 }, semente: 9532 } },
  ]
  const largura = xi1 - xi0
  const pilha = largura * TOALHA.parte
  pecas.push(...pilhaDeToalhas(c.m.toalha, xi0 + 1.4, xi0 + 1.4 + pilha, -nichoChao - 0.2, 9540))
  pecas.push(...pilhaDeToalhas(c.m.toalha, xi1 - 1.4 - pilha, xi1 - 1.4, -nichoChao - 0.2, 9550))
  pecas.push({ forma: caixa(xi0 + 0.3, -nichoTeto, xi1 - 0.3, -nichoTeto + SOMBRA_DO_NICHO, 0), mat: SOMBRA_DA_MADEIRA, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.4, suave: 1.6, semente: 9533 } })
  // A beira da prateleira do chão do nicho, que pega a luz.
  pecas.push({ forma: caixa(xi0, -nichoChao, xi1, -nichoChao + PRATELEIRA, 0.3), mat: mad, o: { eixo: 0, tabua: 0, bisel: 0.4, tom: 1.06, contorno: 0.16, semente: 9534 } })
  // As PORTAS: a de baixo (do rodapé ao nicho) e a de cima (do nicho ao tampo), com o puxador junto da beira direita.
  const portas: readonly (readonly [number, number])[] = [
    [RODAPE + FOLGA, nichoChao - FOLGA],
    [nichoTeto + FOLGA, H - BEIRA_DO_TAMPO - FOLGA],
  ]
  portas.forEach(([pe, topo], i) => {
    pecas.push({ forma: caixa(xi0, -topo, xi1, -pe, 0.6), mat: mad, o: madeiraDePe(TOM_DA_PORTA, 9535 + i, 0.9) })
    const x = xi1 - PUXADOR.afastamento
    // O puxador fica do lado do nicho: no alto da porta de baixo e no pé da de cima.
    const y0 = i === 0 ? -topo + PUXADOR.daPonta : -pe - PUXADOR.daPonta - PUXADOR.comprimento
    pecas.push(...puxador(x, y0, y0 + PUXADOR.comprimento))
  })
  pecas.push(...beiraDoTampo(mad, xa, xb, H))
  return pecas
}

/** A LATERAL, de frente (x na tela): a chapa de madeira, a beira das portas e o vão do nicho na quina da frente (`quina` = -1 à esquerda, 1 à direita) e a beira do tampo. */
function desenharLateral(c: ContextoDoMovel, H: number, hx: number, quina: -1 | 1): PecaDaFrente[] {
  const mad = c.m.madeira
  const xq = quina * hx
  const xPorta = xq - quina * PORTA_DE_LADO
  const x0 = Math.min(xq, xPorta)
  const x1 = Math.max(xq, xPorta)
  const pecas: PecaDaFrente[] = [{ forma: caixa(-hx, -H, hx, 0, 0.5), mat: mad, o: madeiraDePe(TOM_DA_LATERAL, 9560, 0.9) }]
  for (const [pe, topo] of [[RODAPE + FOLGA, H * NICHO.chao - FOLGA], [H * NICHO.teto + FOLGA, H - BEIRA_DO_TAMPO - FOLGA]] as const) {
    pecas.push({ forma: caixa(x0, -topo, x1, -pe, 0.4), mat: mad, o: madeiraDePe(TOM_DA_PORTA, 9561, 0.5) })
  }
  pecas.push({ forma: caixa(x0, -RODAPE, x1, 0, 0.3), mat: ESCURO, o: { tabua: 0, bisel: 0.3, contorno: 0.1, semente: 9562 } })
  pecas.push(...beiraDoTampo(mad, -hx, hx, H))
  return pecas
}

/** As COSTAS, de frente: o fundo de madeira, a sombra no pé e a beira do tampo. */
function desenharCostas(c: ContextoDoMovel, H: number, hx: number): PecaDaFrente[] {
  return [
    { forma: caixa(-hx, -H, hx, 0, 0.5), mat: c.m.madeira, o: madeiraDePe(TOM_DAS_COSTAS, 9565, 0.9) },
    { forma: caixa(-hx + 0.4, -0.9, hx - 0.4, 0, 0.2), mat: SOMBRA_DA_MADEIRA, o: { tabua: 0, bisel: 0, contorno: 0, alfa: 0.35, suave: 0.6, semente: 9566 } },
    ...beiraDoTampo(c.m.madeira, -hx, hx, H),
  ]
}

/** A frente guardada debaixo do tampo (sem giro): o corpo até as frestas, as cantoneiras, as frestas e as cópias. */
function guardarAFrente(c: ContextoDoMovel, cena: Cena, H: number): void {
  const { hw, hh, h } = c
  const { faixas, frente } = fatiar(H, 0, 0, h, hh)
  cena.sombras.push({ forma: caixa(-hw, -hh, hw, frente, 1), z: H })
  for (const xa of [-hw, hw - CANTONEIRA]) cena.sombras.push({ forma: caixa(xa, frente, xa + CANTONEIRA, hh), z: H })
  for (const fx of faixas) {
    if (fx.topo > fx.pe) cena.sombras.push({ forma: caixa(-hw + CANTONEIRA, fx.base, hw - CANTONEIRA, fx.base + FRESTA), z: fx.z, solta: true, forca: 0 })
  }
  const desenho = desenharFrente(c, H, -hw, hw)
  for (const fx of faixas) {
    for (const peca of desenho) {
      const copia = naFaixa(c.peca, peca, fx)
      if (copia !== null) cena.partes.push(copia)
    }
  }
}

/** A plantinha no vaso branco, de cima: o vaso, a terra e a roseta de folhas (as de fora primeiro, as de dentro por cima). */
function plantinha(P: CriarPeca, cena: Cena, x: number, y: number): void {
  const L = cena.partes
  L.push(P(elipse(x, y, VASO.raio, VASO.raio), LOUCA, { bisel: 1.4, contorno: 0.26, textura: texLouca, semente: 9570, projeta: { dist: 2, forca: 0.3 } }))
  L.push(P(elipse(x, y, VASO.raio - 0.8, VASO.raio - 0.8), ESCURO, { bisel: 0, tom: 1.2, contorno: 0, semente: 9571 }))
  for (const [voltas, comprido, giro, tom] of [[7, 3.3, 0.25, 0.9], [5, 2.2, 0.9, 1.04]] as const) {
    for (let i = 0; i < voltas; i += 1) {
      const a = giro + (i * 2 * Math.PI) / voltas
      const r = comprido * (i % 2 === 0 ? 1 : 0.85)
      const folha: Forma = elipseGirada(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.55, 0.85, a)
      L.push(P(folha, FOLHA, { bisel: 0.6, tom: tom + 0.04 * (i % 2), contorno: 0.24, semente: 9572 + i, projeta: { dist: 1, forca: 0.24 } }))
    }
  }
}

export const montarArmarioDeBanheiro: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  cena.corDoPiso = PISO_DO_BANHEIRO
  const H = g * ALTURA
  const quartos = quartosDoGiro(c.giro)

  // A coluna: a frente (sem giro) ou a face que o giro põe embaixo na tela, guardadas debaixo do tampo.
  if (quartos === 0) guardarAFrente(c, cena, H)
  else if (quartos % 2 === 1) guardarFaceGirada(P, cena, quartos, H, { xa: -hh, xb: hh, y0: -hw, y1: hw, raio: 1 }, desenharLateral(c, H, hh, quartos === 1 ? -1 : 1))
  else guardarFaceGirada(P, cena, quartos, H, { xa: -hw, xb: hw, y0: -hh, y1: hh, raio: 1 }, desenharCostas(c, H, hw))
  cena.sombras.push(contato(caixa(-hw, -hh, hw, hh, 1)))

  // O TAMPO de madeira lisa e a plantinha no canto de trás.
  cena.partes.push(P(caixa(-hw, -hh, hw, hh, 1.2), c.m.madeira, { eixo: 0, tabua: 0, bisel: 1.3, contorno: 0.24, semente: 9500 }))
  plantinha(P, cena, -hw + VASO.canto, -hh + VASO.canto)
}
