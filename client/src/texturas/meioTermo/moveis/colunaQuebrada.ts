/**
 * COLUNA QUEBRADA (lote L2 das referências, 16/11/2026: versão original, só a ideia do objeto; o pilar inteiro é
 * `pilar.ts`). Na casa da esquerda fica o TOCO: o plinto quadrado com a quina lascada, o toro e o fuste canelado
 * partido em bisel (mais alto do lado de trás, de onde ele quebrou), com a face da quebra áspera e clara. Na casa da
 * direita, o TAMBOR que caiu, deitado ao comprido, com as caneluras correndo de ponta a ponta, a ponta da quebra
 * irregular virada para o toco e a outra cortada certa, com o furo do pino de encaixe; em volta, lascas soltas.
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): cada parte é cortada em fatias deitadas, e na 3/4
 * cada fatia sobe a altura dela. Assim o tambor deitado é um cilindro de verdade nos quatro giros (de lado mostra o
 * comprido com as caneluras; de ponta, a face redonda), e a quebra do toco é um contorno serrilhado de gomos de
 * alturas diferentes. A luz desenhada nas faces vem da normal da pedra levada para a tela (`luzDaNormal`): de cima
 * à esquerda, como no motor, em qualquer giro.
 *
 * As medidas redondas saem da altura da pegada (a coluna tem o raio do pilar de uma casa). Perfil da 3/4:
 * `{ modo: 'derivado', espessura: 0 }`. Material: `pedra`.
 */
import { hash } from '../../ruido'
import { caixa, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, novoFatiador, sombraDoCilindro, sombraNoAr, type Fatiador } from './pilhaDeFatias'
import { disco, ESCURO_DA_PEDRA, lisa, luzDaNormal } from './apoioDasReferencias'

/** Gomos do fuste (o mesmo número do pilar) e as medidas do pilar, em fração do meio lado de uma casa. */
const GOMOS = 16
const PLINTO = 0.97
const RAIO_DO_TORO = 0.74
const RAIO_DO_FUSTE = 0.5
/** O fundo de cada canelura na beira do fuste (px). */
const FUNDO_DA_CANELURA = 1.1
/** Para onde a quebra sobe (no objeto): atrás à esquerda, de onde a coluna quebrou. */
const RUMO_DA_QUEBRA = -Math.PI * 0.8
/** Alturas do plinto e do toro (casas) e a quebra do toco: a média, o bisel e o serrilhado (px acima do toro). */
const ALTURA_DO_PLINTO = 0.11
const ALTURA_DO_TORO = 0.1
const QUEBRA = { media: 15, bisel: 9, serra: 4.5 } as const
/** O tambor deitado: quanto recua da beira direita da pegada e do toco, e o serrilhado da ponta quebrada (px). */
const TAMBOR = { recuoDaPonta: 5, folgaDoToco: 4.5, serra: 3.2 } as const
/** O passo das fatias (px do protótipo): a faixa de cada uma na 3/4. */
const PASSO = 0.8
/** A força das caneluras na luz e a do áspero da quebra. */
const CANELURA = 0.075
const ASPERO = 0.12
/**
 * Quanto o grão da pedra anda por px de altura: cada fatia lê outra linha da textura. Sem isso a frente da 3/4
 * (a faixa de cada fatia, todas no mesmo lugar de cima) repetia a mesma linha e saía riscada de pé.
 */
const GRAO_POR_ALTURA = 2.3

/**
 * O corte do fuste na altura `z`: o disco com as caneluras recortadas na beira (côncavas, separadas pelos filetes),
 * só do lado onde a quebra (`altoDaQuebra`) ainda passa de `z`. `porAltura` leva a diferença de altura para px.
 */
function corteDoFuste(bx: number, r: number, z: number, altoDaQuebra: (x: number, y: number) => number, porAltura: number): Forma {
  return {
    b: [bx - r, -r, bx + r, r],
    d(x, y) {
      const a = Math.atan2(y, x - bx)
      const beira = Math.hypot(x - bx, y) - (r - FUNDO_DA_CANELURA * Math.abs(Math.sin((GOMOS * a) / 2)) ** 0.7)
      return Math.max(beira, (z - altoDaQuebra(x, y)) * porAltura)
    },
  }
}

/** O TOCO em pé em (bx, 0): o plinto lascado, o toro bojudo e o fuste partido em bisel. */
function montarToco(f: Fatiador, pedra: MaterialDaPeca, bx: number, R: number, g: number): number {
  const q = f.q
  const daPedra = texturaDaClasse(pedra.classe)
  const zPlinto = g * ALTURA_DO_PLINTO
  const zToro = zPlinto + g * ALTURA_DO_TORO
  const rToro = R * RAIO_DO_TORO
  const rFuste = R * RAIO_DO_FUSTE

  // O PLINTO: o quadrado com a quina da frente à direita lascada; a face de cada lado com a luz dela.
  const p = R * PLINTO
  const lasca = R * 0.24
  const plinto = poligono([[bx - p, -p], [bx + p, -p], [bx + p, p - lasca], [bx + p - lasca * 0.35, p - lasca * 0.5], [bx + p - lasca * 0.7, p - lasca * 0.15], [bx + p - lasca, p], [bx - p, p]])
  const facesDoPlinto = (z: number): Textura => (u, v, x, y, pc, s, escala) => {
    if (daPedra !== null) daPedra(u, v + z * GRAO_POR_ALTURA, x, y + z * GRAO_POR_ALTURA, pc, s, escala)
    // A face mais perto do ponto (os quatro lados do quadrado) dá a normal.
    const [dx, dy] = [x - bx, y]
    const nx = Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0
    const ny = nx === 0 ? Math.sign(dy) : 0
    s[3] += luzDaNormal(nx, ny, 0, q)
  }
  for (const z of alturas(0, zPlinto, 1.2)) {
    const topo = z >= zPlinto - 1e-6
    f.fatia(0, z, plinto, pedra, topo ? { tabua: 0, bisel: 1.6, tom: 0.9, contorno: 0.28, semente: 5501 } : lisa(0.86, facesDoPlinto(z), 5500))
  }

  // O TORO: o anel bojudo (o raio cresce até o meio da altura dele e volta).
  const daBojo = (z: number): Textura => (u, v, x, y, pc, s, escala) => {
    if (daPedra !== null) daPedra(u, v + z * GRAO_POR_ALTURA, x, y + z * GRAO_POR_ALTURA, pc, s, escala)
    const a = Math.atan2(y, x - bx)
    const t = (z - zPlinto) / (zToro - zPlinto) - 0.5
    s[3] += luzDaNormal(Math.cos(a), Math.sin(a), -t * 1.6, q)
  }
  for (const z of alturas(zPlinto, zToro, PASSO)) {
    const t = (z - zPlinto) / (zToro - zPlinto)
    const r = rFuste + (rToro - rFuste) * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2)) * 0.92 + (rToro - rFuste) * 0.08
    const topo = z >= zToro - 1e-6
    f.fatia(0, z, disco(bx, 0, r), pedra, topo ? { tabua: 0, bisel: 1.2, tom: 0.96, contorno: 0.24, semente: 5511 } : lisa(0.94, daBojo(z), 5510))
  }

  // O FUSTE partido: em cada altura, o corte canelado do lado onde a quebra ainda passa (a quebra é um plano torto
  // que sobe para trás à esquerda, serrilhado pelo ruído). De cima aparece a quebra inteira, áspera e clara; na 3/4,
  // a beira de cada fatia é o lado do fuste, com a luz do cilindro e as caneluras.
  const [ux, uy] = [Math.cos(RUMO_DA_QUEBRA), Math.sin(RUMO_DA_QUEBRA)]
  const altoDaQuebra = (x: number, y: number): number =>
    zToro + QUEBRA.media + (QUEBRA.bisel * ((x - bx) * ux + y * uy)) / rFuste + QUEBRA.serra * (ruido((x - bx) * 0.32 + 3.1, y * 0.32) + 0.6 * ruido((x - bx) * 0.9, y * 0.9 + 5.3))
  const zMaximo = zToro + QUEBRA.media + QUEBRA.bisel + QUEBRA.serra
  const porAltura = rFuste / (2 * QUEBRA.bisel)
  const fatiaDoFuste = (z: number): Textura => (u, v, x, y, pc, s, escala) => {
    const a = Math.atan2(y, x - bx)
    const naBeira = Math.hypot(x - bx, y) > rFuste - FUNDO_DA_CANELURA - 1.3
    if (naBeira) {
      if (daPedra !== null) daPedra(u, v + z * GRAO_POR_ALTURA, x, y + z * GRAO_POR_ALTURA, pc, s, escala)
      s[3] += luzDaNormal(Math.cos(a), Math.sin(a), 0, q) + CANELURA * Math.cos(GOMOS * a)
      return
    }
    // A face da quebra: a luz do plano (virado para onde ela desce) e o áspero.
    if (daPedra !== null) daPedra(u, v, x, y, pc, s, escala)
    s[3] += luzDaNormal(-ux * 0.45, -uy * 0.45, 0.9, q) + ASPERO * (ruido(x * 0.9, y * 0.9) + 0.5 * ruido(x * 2.1, y * 2.1)) + 0.08
  }
  alturas(zToro, zMaximo, PASSO).forEach((z, k) => {
    const opcoes = k === 0 ? { tabua: 0, bisel: 0, contorno: 0.24, tom: 0.97, textura: fatiaDoFuste(z), semente: 5531 } : lisa(0.97, fatiaDoFuste(z), 5531)
    f.fatia(1, z, corteDoFuste(bx, rFuste, z, altoDaQuebra, porAltura), pedra, opcoes)
  })
  return zMaximo
}

/** O TAMBOR deitado ao comprido, de `x0` (a ponta quebrada) a `x1` (a cortada), com o eixo em y = `ya`. */
function montarTambor(f: Fatiador, pedra: MaterialDaPeca, x0: number, x1: number, ya: number, r: number): void {
  const q = f.q
  const daPedra = texturaDaClasse(pedra.classe)
  for (const z of alturas(0, 2 * r, PASSO)) {
    const meia = Math.sqrt(Math.max(0, r * r - (z - r) * (z - r)))
    if (meia < 0.35) continue
    // A ponta quebrada entra e sai de fatia em fatia: o serrilhado aparece de cima e na 3/4.
    const ponta = x0 + TAMBOR.serra * hash(Math.round(z * 3), 1, 5540) + 1.2 * Math.sin(z * 0.6)
    const corte = poligono([[ponta, ya - meia], [x1, ya - meia], [x1, ya + meia], [ponta + 1.1 * hash(Math.round(z), 2, 5541), ya + meia]])
    const textura: Textura = (u, v, x, y, pc, s, escala) => {
      if (daPedra !== null) daPedra(u + z * GRAO_POR_ALTURA, v + z * GRAO_POR_ALTURA, x, y + z * GRAO_POR_ALTURA, pc, s, escala)
      // O ângulo da face em volta do eixo (y, z): dá a luz do rolo (o lombo claro, a barriga escura) e as caneluras.
      const a = Math.atan2(z - r, y - ya)
      const sen = Math.sin(a)
      const barriga = Math.min(1, Math.max(0, (-sen - 0.2) / 0.8))
      let luz = luzDaNormal(0, Math.cos(a), sen, q) + 0.1 * sen - 0.2 * barriga * barriga + CANELURA * Math.cos(GOMOS * a)
      if (x > x1 - 1.1) {
        // A ponta cortada: a face redonda com o furo do pino no meio (aparece de ponta, num quarto de volta).
        const raio = Math.hypot(y - ya, z - r)
        luz = luzDaNormal(1, 0, 0, q) + 0.04 + (raio < r * 0.16 ? -0.4 : 0) + (raio > r * 0.82 ? CANELURA * Math.cos(GOMOS * a) : 0)
      } else if (x < ponta + 1.6) {
        luz = luzDaNormal(-1, 0, 0, q) + ASPERO * ruido(y * 1.1, z * 1.1) + 0.05
      }
      s[3] += luz
    }
    f.fatia(1, z, corte, pedra, z >= 2 * r - PASSO ? { tabua: 0, bisel: 0.3, contorno: 0.12, tom: 1, textura, semente: 5550 } : lisa(0.98, textura, 5551))
  }
}

/** As lascas soltas no chão: pedrinhas de poucas fatias. */
function montarLascas(f: Fatiador, pedra: MaterialDaPeca, lista: readonly (readonly [number, number, number, number])[]): void {
  lista.forEach(([cx, cy, r, alto], i) => {
    const pontos: Ponto[] = []
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * 2 * Math.PI + i
      const rr = r * (0.7 + 0.45 * hash(i, k, 5560))
      pontos.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8])
    }
    const lasca = poligono(pontos)
    for (const z of alturas(0, alto, 1)) {
      const topo = z >= alto - 1e-6
      f.fatia(0, z, lasca, pedra, topo ? { tabua: 0, bisel: 0.8, contorno: 0.24, tom: 1.04 - 0.1 * hash(i, 9, 5561), semente: 5562 + i } : { tabua: 0, bisel: 0, contorno: 0, tom: 0.78, semente: 5570 + i })
    }
  })
}

export const montarColunaQuebrada: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const pedra = c.m.pedra
  const f = novoFatiador(P, cena, c.giro)
  cena.corDoPiso = ESCURO_DA_PEDRA
  // A coluna tem o raio do pilar de uma casa: as medidas redondas saem da altura da pegada.
  const R = hh
  const bx = -hw + R
  const zToco = montarToco(f, pedra, bx, R, g)
  const r = R * RAIO_DO_FUSTE
  const x0 = bx + R * PLINTO + TAMBOR.folgaDoToco
  const x1 = hw - TAMBOR.recuoDaPonta
  const ya = R * 0.08
  montarTambor(f, pedra, x0, x1, ya, r)
  montarLascas(f, pedra, [
    [x0 - 2.6, hh - 5, 2.2, 2.2],
    [x0 + 6, -hh + 5.2, 1.8, 1.6],
    [bx + R * 0.6, hh - 2.6, 1.6, 1.5],
    [x1 - 7, hh - 3.6, 1.4, 1.2],
  ])
  f.fechar()

  // As sombras: a do toco (o fuste até a quebra e o plinto) e a do tambor deitado, e o contato de tudo.
  cena.sombras.push(
    sombraDoCilindro(bx, 0, r, zToco, f.q, 0.24, 1.6),
    sombraNoAr(caixa(bx - R * PLINTO, -R * PLINTO, bx + R * PLINTO, R * PLINTO, 1), g * ALTURA_DO_PLINTO, f.q, 0.22, 1.2),
    sombraNoAr(caixa(x0, ya - r * 0.9, x1, ya + r * 0.9, r * 0.8), r * 1.2, f.q, 0.24, 2),
    contato(caixa(bx - R * PLINTO, -R * PLINTO, bx + R * PLINTO, R * PLINTO, 1), 0.3),
    contato(elipse((x0 + x1) / 2, ya, (x1 - x0) / 2, r * 0.7), 0.34),
  )
}
