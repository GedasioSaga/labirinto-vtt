/**
 * BOLA DE FERRO COM CORRENTE de cima com volume (lote L01 dos objetos de 24/11/2026, "Prisão: ferro e cela"): a bola
 * de condenado largada no chão. A BOLA é de ferro fundido, fosca e escura, com a luz larga em cima à esquerda, os
 * POROS da fundição, a costura do molde e umas manchas de ferrugem; no flanco esquerdo, rente ao chão, o OLHAL fundido.
 * Dele sai a CORRENTE de elo grosso num arco aberto pelo chão, para longe da bola, até a TORNOZELEIRA aberta, deitada
 * no canto de cima: a mesma braçadeira chata dos grilhões (a faixa larga, as duas metades separadas na dobradiça, a
 * lingueta do fecho). A corrente nunca sai de cima da bola em curva fina: assim a bola lia como bomba de desenho com
 * pavio. Desenho original: só a ideia do objeto.
 *
 * A bola faz a sombra dela no chão, deitada para baixo à direita (só sombras de chão, sem altura: a 3/4 não a vira
 * num cilindro). Rente ao chão como a corrente: na 3/4 (`alturaSolta` de 0,03 casa) sobe um fio e fica como de cima;
 * a bola já é redonda dos dois jeitos. Tudo sai do menor lado da pegada (1 x 1 casa de partida). Sem material
 * escolhido: o ferro é fixo. Os elos seguem o caminho da corrente (`elosAoLongo`, `texDoElo`), com o arame mais grosso
 * que o da corrente de chão, e a tornozeleira é a algema dos grilhões (`algemaAberta`), maior.
 */
import { hash, limitar01, type Rgb } from '../../ruido'
import { anel, capsula, elipse, elipseGirada, menos, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { elosAoLongo, texDoElo, type Elo } from './corrente'
import { ESCURO_DO_FERRO, FERRO_DA_PRISAO, texFerroGasto } from './cadeiraDeFerro'
import { algemaAberta, montarAlgema } from './grilhoesDeParede'

/** A bola foi medida no tamanho de partida (1 casa, 28 px de meio lado): as medidas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = 0.5 * G
/** A bola: o meio (fração da meia pegada) e o raio (px de partida). */
const BOLA = { x: 0.3, y: 0.3, raio: 10.4 } as const
/** O olhal fundido no flanco da bola, rente ao chão: o rumo (radianos) a partir do meio dela, o raio e o aro (px). */
const OLHAL = { rumo: 2.95, raio: 2.6, arame: 1.15 } as const
/** O caminho da corrente (frações da meia pegada), do olhal até perto da tornozeleira: um arco aberto pelo chão. */
const CAMINHO: readonly Ponto[] = [
  [-0.32, 0.3],
  [-0.49, 0.09],
]
/** O passo dos elos grossos (px de partida) e o arame e a largura do elo em frações do meio comprimento dele. */
const PASSO_DOS_ELOS = 6.5
const ARAME_DO_ELO = 0.41
const LARGURA_DO_ELO = 0.62
/** A tornozeleira: o meio (frações), o raio, a faixa, o rumo da dobradiça e quanto a metade solta abriu. */
const TORNOZELEIRA = { x: -0.55, y: -0.55, raio: 6.4, faixa: 2.6, rumo: 1.2, abertura: 1.2 } as const

/** O ferro fundido: mais escuro que o ferro batido e quase sem brilho. */
const TOM_DA_BOLA = 0.84
const BRILHO_DA_BOLA = 0.12
/** O realce fosco e largo da bola (um cinza claro, meio transparente). */
const REALCE: MaterialDaPeca = { classe: 'liso', rgb: [0xb4, 0xb2, 0xac] }
/** O escuro dos poros e o castanho da ferrugem da bola. */
const PORO: Rgb = [0x2d, 0x2b, 0x29]
const FERRUGEM: Rgb = [0x7a, 0x5b, 0x48]

const DO_METAL = texturaDaClasse('metal')

/** O ferro fundido da bola: o metal, os poros da fundição (pontos escuros), a costura do molde e a ferrugem em manchas. */
function texDaBola(cx: number, cy: number, raio: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    // A costura do molde: um fio mais claro numa reta inclinada pelo meio da bola.
    const costura = Math.abs((x - cx) * 0.55 + (y - cy) * 0.84 + raio * 0.12)
    if (costura < 0.45) s[3] += 0.07 * (1 - costura / 0.45)
    // A ferrugem em manchas largas, mais no lado de baixo (onde a umidade do chão sobe).
    const embaixo = limitar01((y - cy) / raio + 0.3)
    const mancha = limitar01((ruido(x * 0.3 + p.su, y * 0.3 + p.sv) + 0.05) * 2.2) * (0.18 + 0.32 * embaixo)
    if (mancha > 0) {
      s[0] += (FERRUGEM[0] - s[0]) * mancha
      s[1] += (FERRUGEM[1] - s[1]) * mancha
      s[2] += (FERRUGEM[2] - s[2]) * mancha
    }
    // Os poros: só a partir de um tamanho em que viram ponto (abaixo eles viram chiado).
    if (escala < 1) return
    const h = hash(Math.floor(x * 1.6), Math.floor(y * 1.6), p.semente)
    if (h > 0.955) {
      s[0] += (PORO[0] - s[0]) * 0.55
      s[1] += (PORO[1] - s[1]) * 0.55
      s[2] += (PORO[2] - s[2]) * 0.55
    }
  }
}

/** O elo grosso: o do caminho da corrente (o mesmo meio, o mesmo ângulo) com o arame mais grosso e o oval mais largo. */
function eloGrosso(e: Elo): Forma {
  const a = e.meio
  const b = a * LARGURA_DO_ELO
  const t = a * ARAME_DO_ELO
  if (e.deitado) return menos(elipseGirada(e.cx, e.cy, a, b, e.angulo), elipseGirada(e.cx, e.cy, a - t, b - t, e.angulo))
  const [ex, ey] = [Math.cos(e.angulo) * (a - t * 0.5), Math.sin(e.angulo) * (a - t * 0.5)]
  return capsula(e.cx - ex, e.cy - ey, e.cx + ex, e.cy + ey, t * 0.62)
}

export const montarBolaDeFerroComCorrente: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const k = Math.min(hw, hh) / MEIO_LADO_DE_PARTIDA
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO
  const em = ([fx, fy]: Ponto): Ponto => [fx * hw, fy * hh]
  const sombra = (f: Forma, forca: number): void => {
    cena.sombras.push(contato(f, forca))
  }
  const [bx, by] = em([BOLA.x, BOLA.y])
  const R = BOLA.raio * k

  // A SOMBRA da bola no chão: o contato firme no pé e a sombra deitada para baixo à direita, larga e mansa.
  cena.sombras.push({ forma: elipse(bx + R * 0.5, by + R * 0.42, R * 0.98, R * 0.82), z: 0, suave: 2.6 * k, forca: 0.3 })
  sombra(elipse(bx + R * 0.12, by + R * 0.1, R * 0.86, R * 0.86), 0.36)

  // A TORNOZELEIRA aberta, longe da bola, e a CORRENTE grossa do olhal até a dobradiça dela.
  const [ox, oy] = [bx + Math.cos(OLHAL.rumo) * R * 0.9, by + Math.sin(OLHAL.rumo) * R * 0.9]
  const [tx, ty] = em([TORNOZELEIRA.x, TORNOZELEIRA.y])
  const faixa = TORNOZELEIRA.faixa * k
  const tornozeleira = algemaAberta(tx, ty, TORNOZELEIRA.raio * k, faixa, TORNOZELEIRA.rumo, TORNOZELEIRA.abertura)
  const inicio: Ponto = [ox + Math.cos(OLHAL.rumo) * OLHAL.raio * k * 0.7, oy + Math.sin(OLHAL.rumo) * OLHAL.raio * k * 0.7]
  const elos = elosAoLongo([inicio, ...CAMINHO.map(em), tornozeleira.saida], PASSO_DOS_ELOS * k, true)
  montarAlgema(P, L, sombra, tornozeleira, faixa, 24610)
  elos.filter((e) => e.deitado).forEach((e, i) => {
    const forma = eloGrosso(e)
    sombra(forma, 0.34)
    L.push(P(forma, FERRO_DA_PRISAO, { tabua: 0, bisel: e.meio * 0.16, tom: 0.94, metal: 0.4, contorno: 0.3, textura: texDoElo(e, 0.9), semente: 24620 + i }))
  })

  // A BOLA: o corpo (o chanfro do tamanho do raio faz a cúpula), o realce fosco e a borda de baixo mais escura.
  const bola = elipse(bx, by, R, R)
  L.push(P(bola, FERRO_DA_PRISAO, { tabua: 0, bisel: R * 0.95, tom: TOM_DA_BOLA, metal: BRILHO_DA_BOLA, contorno: 0.32, textura: texDaBola(bx, by, R), semente: 24601 }))
  L.push(P(elipse(bx - R * 0.36, by - R * 0.4, R * 0.36, R * 0.27), REALCE, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.13, suave: R * 0.32, semente: 24602 }))

  // O OLHAL fundido no flanco e os elos em pé por cima de tudo (o primeiro passa pelo olhal).
  const olhal = anel(ox, oy, OLHAL.raio * k, OLHAL.raio * k * 0.82, (OLHAL.raio - OLHAL.arame) * k, (OLHAL.raio - OLHAL.arame) * k * 0.72)
  L.push(P(capsula(ox - Math.cos(OLHAL.rumo) * 1.2 * k, oy - Math.sin(OLHAL.rumo) * 1.2 * k, ox, oy, 1.2 * k), FERRO_DA_PRISAO, { tabua: 0, bisel: 0.9 * k, tom: 0.9, metal: 0.2, contorno: 0.26, semente: 24603 }))
  L.push(P(olhal, FERRO_DA_PRISAO, { tabua: 0, bisel: 0.5 * k, tom: 1.04, metal: 0.4, contorno: 0.3, textura: texFerroGasto(olhal, 0, 0.3), semente: 24604, projeta: { dist: 0.7 * k, forca: 0.3 } }))
  elos.filter((e) => !e.deitado).forEach((e, i) => {
    const forma = eloGrosso(e)
    sombra(forma, 0.38)
    L.push(P(forma, FERRO_DA_PRISAO, { tabua: 0, bisel: e.meio * 0.22, tom: 1.06, metal: 0.48, contorno: 0.3, textura: texDoElo(e, 0.75), semente: 24650 + i }))
  })
}
