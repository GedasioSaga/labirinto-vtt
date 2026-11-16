/**
 * LIXEIRA DE PEDAL de inox (banheiro moderno, desenhista B, 15/11/2026; o mestre pediu "vários mais utensílios para
 * banheiro" no estilo moderno, o da geladeira de inox). A lata redonda de inox escovado, com a tampa de beira cheia,
 * a dobradiça de plástico grafite atrás e o pedal na frente, rente ao chão.
 *
 * DE CIMA aparece a TAMPA: o disco de inox escovado com a beira arredondada (o brilho fica do lado da luz), a barra
 * grafite da dobradiça na beira de trás e, na frente, a ponta do PEDAL saindo debaixo da lata. A 25% de zoom sobram o
 * disco cinza frio com o risco escuro atrás e a sombra comprida: é o que diz "lixeira" e não "balde" (o balde é
 * aberto, com água e alça).
 *
 * NA 3/4 a lata é desenhada em fatias (`pilhaDeFatias.ts`): o anel grafite do pé, o corpo de inox com o risco do
 * escovado de pé, a luz do cilindro (a esquerda clara, o reflexo da janela e a beira escura), o friso escuro entre o
 * corpo e a tampa, a beira da tampa e, por cima, a dobradiça; o pedal fica na frente, no chão. Girada, o pedal vai
 * para onde o giro o leva (de lado, saindo na beira; de costas, escondido atrás da lata).
 *
 * O perfil da 3/4 tem de ser `{ modo: 'derivado', espessura: 0 }`. Sem material escolhido: o inox e o grafite são
 * fixos, como na geladeira. Escreve `cena.corDoPiso` (o escuro do metal).
 */
import { caixa, elipse } from './formas'
import { contato, ruido, type MaterialDaPeca, type Textura } from './motor'
import { QUARTO, type MontarMovel } from './contexto'
import { alturas, luzDoCilindro, naTela, novoFatiador, sombraDoCilindro, type OpcoesDaFatia } from './pilhaDeFatias'
import { ESCURO_DO_METAL, GRAFITE, INOX, texEscovado } from './tonsDoBanheiroModerno'

/** A altura da lata em casas (a tampa) e o raio dela, em fração do menor meio lado (sobra a frente para o pedal). */
const ALTURA = 0.4
const RAIO = 0.74
/** Quanto a lata recua da frente da pegada, em fração do menor meio lado: o pedal cabe na frente dela. */
const RECUO = 0.08
/** As faixas da lata, de baixo para cima (px do protótipo): o anel do pé, o friso da tampa e a beira da tampa. */
const PE = 1.2
const FRISO = { de: 3.5, ate: 2.9 } as const
const ABAULADO = 0.8
/** O passo entre duas fatias (px do protótipo): a faixa de cada uma na 3/4. */
const PASSO = 0.5
/** O pedal: meia largura (fração do raio), quanto entra debaixo da lata e quanto sai dela, e a altura (px). */
const PEDAL = { meiaLargura: 0.3, entra: 1.6, sai: 3.2, de: 0.4, ate: 2.6 } as const
/** A dobradiça: meia largura (fração do raio), quanto passa da beira de trás para fora e para dentro, e a altura (px). */
const DOBRADICA = { meiaLargura: 0.42, fora: 0.5, dentro: 2.5, altura: 1.3 } as const

/** Os tons do inox: o corpo de frente (menos luz que a tampa), a beira da tampa e o pedal. */
const TOM_DO_CORPO = 0.88
const TOM_DA_BEIRA = 0.97
/** O reflexo da janela no corpo e o brilho (do motor) da tampa. */
const REFLEXO = 0.16
const BRILHO_DA_TAMPA = 0.35

/** Abaixo desta escala (pixels por px do protótipo) o risco de pé do escovado vira chuvisco: fica um terço dele. */
const ESCALA_DO_RISCO = 1.5

export const montarLixeiraDePedal: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  const menor = Math.min(hw, hh)
  const R = menor * RAIO
  const cx = 0
  const cy = -menor * RECUO
  const H = g * ALTURA
  const xDoEixo = naTela(cx, cy, q)[0]
  cena.corDoPiso = ESCURO_DO_METAL

  // A sombra comprida da lata e o contato no pé.
  cena.sombras.push(sombraDoCilindro(cx, cy, R, H, q, 0.22, 1.6), contato(elipse(cx, cy, R, R), 0.32))

  /** A frente do cilindro na altura z: a luz NA TELA e o risco de pé do escovado. */
  const frente = (z: number, brilho: number): Textura => (_u, _v, x, y, _p, s, escala) => {
    const xt = naTela(x, y, q)[0]
    const risco = escala < ESCALA_DO_RISCO ? 0.33 : 1
    s[3] += luzDoCilindro((xt - xDoEixo) / R, brilho) + (ruido(xt * 0.9 + 17, z * 0.04) * 0.07 + ruido(xt * 0.25, z * 0.015) * 0.04) * risco
  }
  const deFrente = (mat: MaterialDaPeca, tom: number, z: number, brilho: number): [MaterialDaPeca, OpcoesDaFatia] => [mat, { tabua: 0, bisel: 0, contorno: 0, tom, textura: frente(z, brilho), semente: 5101 }]

  // A LATA: o anel grafite do pé, o corpo, o friso escuro, a beira da tampa e a tampa abaulada.
  for (const z of alturas(0, H, PASSO)) {
    const disco = (r: number) => elipse(cx, cy, r, r)
    if (z >= H - 1e-6) {
      f.fatia(1, z, disco(R - ABAULADO), INOX, { eixo: 0, tabua: 0, bisel: R * 0.22, contorno: 0.24, metal: BRILHO_DA_TAMPA, textura: texEscovado, semente: 5100 })
      continue
    }
    const [mat, o] =
      z < PE ? deFrente(GRAFITE, 1.1, z, 0.08)
      : z >= H - FRISO.de && z < H - FRISO.ate ? deFrente(GRAFITE, 1, z, 0.05)
      : z >= H - FRISO.ate ? deFrente(INOX, TOM_DA_BEIRA, z, REFLEXO)
      : deFrente(INOX, TOM_DO_CORPO, z, REFLEXO)
    const r = z < PE ? R - 0.5 : z >= H - FRISO.de && z < H - FRISO.ate ? R - 0.2 : z > H - ABAULADO ? R - (z - (H - ABAULADO)) * 0.6 : R
    f.fatia(1, z, disco(r), mat, o)
  }

  // A DOBRADIÇA grafite em cima da beira de trás: apoiada na tampa, vem depois dela na 3/4.
  const md = R * DOBRADICA.meiaLargura
  const dobradica = caixa(cx - md, cy - R - DOBRADICA.fora, cx + md, cy - R + DOBRADICA.dentro, 1)
  for (const z of alturas(H, H + DOBRADICA.altura, PASSO)) {
    const topo = z >= H + DOBRADICA.altura - 1e-6
    f.fatia(2, z, dobradica, GRAFITE, topo ? { eixo: 0, tabua: 0, bisel: 0.9, contorno: 0.24, metal: 0.2, semente: 5110 } : { tabua: 0, bisel: 0, contorno: 0, tom: 0.9, semente: 5111 })
  }

  // O PEDAL na frente, rente ao chão: na 3/4 vem antes da lata quando o giro o leva para trás dela NA TELA.
  const mp = R * PEDAL.meiaLargura
  const pedal = caixa(cx - mp, cy + R - PEDAL.entra, cx + mp, cy + R + PEDAL.sai, 1.2)
  const atras = naTela(cx, cy + R + PEDAL.sai / 2, q)[1] < naTela(cx, cy, q)[1]
  for (const z of alturas(PEDAL.de, PEDAL.ate, PASSO)) {
    const topo = z >= PEDAL.ate - 1e-6
    f.fatia(atras ? 0 : 2, z, pedal, topo ? INOX : GRAFITE, topo ? { eixo: QUARTO, tabua: 0, bisel: 0.9, contorno: 0.26, metal: 0.4, textura: texEscovado, semente: 5120 } : { tabua: 0, bisel: 0, contorno: 0, tom: 1.05, semente: 5121 })
  }
  f.fatia(atras ? 0 : 2, 0, pedal, GRAFITE, { tabua: 0, bisel: 0, contorno: 0, tom: 0.8, semente: 5122 })

  f.fechar()
}
