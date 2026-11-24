/**
 * BANCO DE PEDRA de cima com volume (lote L01 dos objetos de 24/11/2026, "Prisão: ferro e cela"; da cela e da cripta).
 * Uma LAJE maciça e grossa pousada sobre dois BLOCOS de pedra. A laje tem a quina gasta e redonda, duas lascas (uma na
 * quina de trás à direita, outra na beira da frente), uma RACHADURA fina que entra pela beira de trás e, na metade da
 * frente, o lugar onde se senta, mais claro e liso de anos de uso. Perto da ponta esquerda, os RISCOS de quem contou
 * os dias: dois feixes de cinco, cavados de leve. Os blocos ficam inteiros debaixo da laje, recuados de todos os
 * lados: de cima, quem diz que são dois apoios é a SOMBRA (a da laje, alta, é mansa; a dos blocos, mais escura, sai um
 * fio na frente de cada um). Desenho original: só a ideia do banco de pedra.
 *
 * Como a laje de sacrifício: de cima aparecem a laje e a sombra comprida; na 3/4 (DERIVADO, com a beirada da grossura
 * dela, `ESPESSURA_DO_BANCO_DE_PEDRA`, que o perfil da 3/4 usa) a laje é um tampo solto com UMA face da frente na
 * grossura inteira (a lasca da beira da frente vira um entalhe nela) e os dois blocos são colunas, com o vão entre
 * eles. Nenhuma peça desenha a grossura de cima: ela subia junto com a laje e riscava a face da 3/4 no meio. A frente é
 * o lado de baixo. Material: `pedra`; os riscos e a rachadura saem do tom dela.
 */
import { limitar01, misturar, type Rgb } from '../../ruido'
import { cadeia, caixa, capsula, elipse, menos, type Ponto } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'

/** A altura do banco (do chão ao alto da laje), em casas, e a grossura da laje: a beirada na 3/4. */
const ALTURA = 0.44
export const ESPESSURA_DO_BANCO_DE_PEDRA = 0.12 * G
/** A pegada de partida (2 x 0,7 casa), em px: as medidas miúdas escalam por ela. */
const COMPRIMENTO_DE_PARTIDA = 2 * G
const FUNDO_DE_PARTIDA = 0.7 * G
/** A laje: quanto recua das pontas e das beiras compridas da pegada (px). Os blocos: da ponta da laje e o comprimento. */
const LAJE = { daPonta: 1.4, daBeira: 3.4 } as const
/**
 * Os blocos ficam inteiros debaixo da laje: atrás, um pouco além da beira dela (de cima as abas que saíam atrás liam
 * como dois tocos soltos); na frente, recuados (na 3/4 a estrutura de base mais ao sul é desenhada por último, e o
 * bloco que saía na frente cobria a laje inteira como se estivesse na frente dela).
 */
const BLOCO = { daPonta: 4.6, comprimento: 20, atras: LAJE.daBeira + 0.6, frente: LAJE.daBeira + 1 } as const
/**
 * As sombras: a da laje, alta, é mansa e larga; a dos blocos, mais escura e de beira curta, sai um pouco da beira da
 * frente debaixo de cada um (é ela que diz, de cima, "dois apoios"); a do chão debaixo da laje fica só entre os blocos e
 * longe da beira da frente (na 3/4 é o vão escuro; de cima, escondida).
 */
const FORCA_DA_LAJE = 0.15
const FORCA_DOS_BLOCOS = 0.44
const BORDA_DOS_BLOCOS = 1.3
const FORCA_DEBAIXO = 0.3
/** O escuro dos riscos e da rachadura, e o escuro em que o pixel escuro demais é levantado. */
const ESCURO: Rgb = [0x2c, 0x29, 0x26]
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x43, 0x40]

const DA_PEDRA = texturaDaClasse('pedra')

/**
 * O tampo da laje: a pedra e, na metade da frente, o lugar de sentar polido pelo uso (mais claro, com o grão pela
 * metade), numa elipse larga e mansa.
 */
function texDoTampo(meioX: number, meioY: number, raioX: number, raioY: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    const antes = s[3]
    if (DA_PEDRA !== null) DA_PEDRA(u, v, x, y, p, s, escala)
    const ex = (x - meioX) / raioX
    const ey = (y - meioY) / raioY
    const polido = limitar01(1 - (ex * ex + ey * ey)) ** 0.7
    s[3] = antes + (s[3] - antes) * (1 - 0.55 * polido) + 0.08 * polido
  }
}

export const montarBancoDePedra: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const k = Math.min(w / COMPRIMENTO_DE_PARTIDA, h / FUNDO_DE_PARTIDA)
  const pedra = c.m.pedra
  const L = cena.partes
  cena.corDoPiso = ESCURO_DA_PEDRA
  const zTopo = g * ALTURA
  const zBloco = zTopo - ESPESSURA_DO_BANCO_DE_PEDRA
  const [lx0, ly0, lx1, ly1] = [-hw + LAJE.daPonta * k, -hh + LAJE.daBeira * k, hw - LAJE.daPonta * k, hh - LAJE.daBeira * k]
  const laje = menos(menos(caixa(lx0, ly0, lx1, ly1, 2.2 * k), elipse(lx1 - 0.8 * k, ly0 + 0.4 * k, 3.4 * k, 2.4 * k)), elipse(lx0 + 14 * k, ly1 + 0.5 * k, 2.6 * k, 1.5 * k))
  const escuro: MaterialDaPeca = { classe: 'liso', rgb: misturar(pedra.rgb, ESCURO, 0.72) }

  // As sombras: a laje solta, os dois blocos (colunas, com o contato) e o chão escuro entre eles, debaixo da laje.
  cena.sombras.push({ forma: laje, z: zTopo, solta: true, forca: FORCA_DA_LAJE })
  const blocos = [-1, 1].map((lado) => {
    const xa = lado < 0 ? lx0 + BLOCO.daPonta * k : lx1 - (BLOCO.daPonta + BLOCO.comprimento) * k
    return caixa(xa, -hh + BLOCO.atras * k, xa + BLOCO.comprimento * k, hh - BLOCO.frente * k, 1.3 * k)
  })
  for (const bloco of blocos) cena.sombras.push({ forma: bloco, z: zBloco, forca: FORCA_DOS_BLOCOS, suave: BORDA_DOS_BLOCOS * k }, contato(bloco, 0.34))
  cena.sombras.push({ forma: caixa(blocos[0].b[2] - 1 * k, ly0 + 1 * k, blocos[1].b[0] + 1 * k, ly1 - 2.4 * k, 1.5 * k), z: 0, suave: 1.6 * k, forca: FORCA_DEBAIXO })

  // A LAJE: o tampo e o lugar de sentar polido.
  L.push(P(laje, pedra, { tabua: 0, bisel: 2.4 * k, tom: 1, contorno: 0.28, textura: texDoTampo(0, ly1 - 8 * k, (lx1 - lx0) * 0.42, 9 * k), semente: 26221 }))

  // A RACHADURA fina que entra pela beira de trás.
  const rachadura: readonly Ponto[] = [[22 * k, ly0 + 0.3 * k], [20.6 * k, ly0 + 4 * k], [23.2 * k, ly0 + 7.6 * k], [21.8 * k, ly0 + 11.4 * k], [23.4 * k, ly0 + 13.2 * k]]
  L.push(P(cadeia(rachadura, 0.3 * k), escuro, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.55, semente: 26230 }))

  // Os RISCOS de contar os dias: dois feixes de quatro em pé cortados por um de través, cavados de leve.
  for (let feixe = 0; feixe < 2; feixe += 1) {
    const x0 = lx0 + (9 + feixe * 7.4) * k
    const [ya, yb] = [ly0 + 3.4 * k, ly0 + 8.4 * k]
    for (let j = 0; j < 4; j += 1) {
      const x = x0 + j * 1.3 * k + (j % 2) * 0.15 * k
      L.push(P(capsula(x, ya + (j % 2) * 0.3 * k, x + 0.25 * k, yb, 0.26 * k), escuro, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.5, semente: 26240 + feixe * 6 + j }))
    }
    L.push(P(capsula(x0 - 0.9 * k, yb - 0.6 * k, x0 + 4.9 * k, ya + 0.9 * k, 0.26 * k), escuro, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.5, semente: 26245 + feixe * 6 }))
  }
}
