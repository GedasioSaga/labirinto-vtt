/**
 * APOIO DO BANHEIRO MODERNO (pedido do mestre de 15/11/2026: "vários mais utensílios para banheiro", no estilo
 * Moderno, que combina com a geladeira de inox): os materiais fixos que o vaso sanitário moderno, o bidê, o box de
 * chuveiro, a banheira moderna, o gabinete e o armário de banheiro dividem, e a peça que só a 3/4 vê. Não é um
 * objeto: não tem registro nem ficha.
 *
 * Os tons ficam contidos, como o resto do Meio-Termo: a louça é um branco quase neutro (a da privada antiga puxa
 * para o creme), o cromo é um cinza frio que vive do brilho do chanfro (o metal do motor), o vidro é um verde-água
 * bem claro e meio transparente, e a pedra clara do piso do box e do tampo é um cinza quente de quartzo.
 */
import type { Rgb } from '../../ruido'
import { G } from './contexto'
import { ruido, texturaDaClasse, type Cena, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Textura } from './motor'
import type { Forma } from './formas'

/** A louça branca moderna: quase neutra, um nada fria (saturação HSV ~0,03). */
export const LOUCA: MaterialDaPeca = { classe: 'liso', rgb: [0xe9, 0xe8, 0xe3] }
/** O cromo: cinza frio médio; quem diz "cromo" é o brilho forte do chanfro e o contorno escuro. */
export const CROMO: MaterialDaPeca = { classe: 'liso', rgb: [0xa6, 0xac, 0xb1] }
/** Brilho do cromo (o `metal` do motor): bem mais polido que o inox escovado da geladeira (0,3). */
export const BRILHO_DO_CROMO = 0.85
/** O vidro: verde-água muito claro. Vai sempre meio transparente. */
export const VIDRO: MaterialDaPeca = { classe: 'liso', rgb: [0xbf, 0xd9, 0xd4] }
/** O reflexo do vidro e da louça polida: quase branco, frio. */
export const REFLEXO: MaterialDaPeca = { classe: 'liso', rgb: [0xf4, 0xf7, 0xf6] }
/** A pedra clara (o piso do box, o tampo): quartzo cinza quente, sem veio. */
export const PEDRA_CLARA: MaterialDaPeca = { classe: 'liso', rgb: [0xcf, 0xcb, 0xc2] }
/** O fundo das frestas, do ralo e dos vãos: o cinza frio bem escuro da geladeira. */
export const ESCURO: MaterialDaPeca = { classe: 'liso', rgb: [0x42, 0x45, 0x48] }
/**
 * O escuro em que o pixel escuro demais é levantado (`cena.corDoPiso`): com o padrão (a nogueira) o contorno da
 * louça e do cromo saía marrom. O mesmo da geladeira.
 */
export const PISO_DO_BANHEIRO: Rgb = [0x46, 0x49, 0x4c]

/**
 * A grossura da borda da louça (px do protótipo): a beirada do aro do vaso e do bidê na 3/4 (o tampo solto da
 * borda) sobre o pé mais estreito, que dá a silhueta de louça de verdade.
 */
export const BORDA_DA_LOUCA = 0.11 * G

/** Abaixo desta escala (pixels da imagem por px do protótipo) a manchinha da pedra vira chuvisco. */
const ESCALA_DA_MANCHA = 1.5

/** A pedra clara: manchas largas e leves e um grão miúdo, que some no tamanho de mesa. */
export const texPedraClara: Textura = (u, v, _x, _y, p, s, escala) => {
  const grao = escala < ESCALA_DA_MANCHA ? 0.3 : 1
  s[3] += ruido(u * 0.07 + p.semente * 3, v * 0.07) * 0.07 + ruido(u * 0.6, v * 0.6 + p.semente) * 0.035 * grao
}

/** A louça polida: só uma mancha larga quase invisível (a louça lisa demais vira plástico). */
export const texLouca: Textura = (u, v, _x, _y, p, s) => {
  s[3] += ruido(u * 0.05 + p.semente * 5, v * 0.05) * 0.035
}

// ---------- a peça que só a 3/4 vê (sem giro) ----------

/** A âncora só contém o próprio ponto; fora dele está longe de tudo e nada dela é pintado. */
const RAIO_DA_ANCORA = 1e-6
const FORA_DA_ANCORA = 1e3
const BORDA_DA_ANCORA = 0.05

/** As opções de uma peça de uma vista só: sem deslocamento nem sombra própria (cairia na outra vista). */
export type OpcoesSoDaTresQuartos = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'curvaY'>

/** Uma peça desenhada já NA TELA da 3/4: x como na pegada, y da tela (o chão da frente em `hh`, para cima negativo). */
export interface PecaDaTela {
  readonly forma: Forma
  readonly mat: MaterialDaPeca
  readonly o: OpcoesSoDaTresQuartos
}

/**
 * Põe as peças que SÓ A 3/4 VÊ, presas a uma âncora no ponto (`x`, `chao`) da pegada: a âncora é uma sombra solta
 * de força zero (a 3/4 a faz estrutura e sobe a peça com ela), e cada peça nasce deslocada a subida dela. A 3/4 a
 * traz de volta para onde foi desenhada (`dy` zero); de cima ela fica deslocada e não pinta (a textura vê o `dy`).
 * A âncora tem de ser a estrutura mais alta no ponto dela, e a base dela (`chao`) decide a vez na ordem de pintura
 * da 3/4. Só vale SEM GIRO: com o giro, a 3/4 entrega à textura a peça de antes da subida (`girarCena`).
 */
export function soNaTresQuartos(P: CriarPeca, cena: Cena, x: number, chao: number, pecas: readonly PecaDaTela[]): void {
  if (pecas.length === 0) return
  let y0 = Infinity
  let y1 = -Infinity
  for (const { forma } of pecas) {
    y0 = Math.min(y0, forma.b[1])
    y1 = Math.max(y1, forma.b[3])
  }
  const meio = (y0 + y1) / 2
  const z = chao - meio
  const ponto: Forma = {
    b: [x, chao, x, chao],
    d: (px, py) => (Math.abs(px - x) < RAIO_DA_ANCORA && Math.abs(py - chao) < RAIO_DA_ANCORA ? -1 : FORA_DA_ANCORA),
  }
  cena.sombras.push({ forma: ponto, z, solta: true, forca: 0, suave: BORDA_DA_ANCORA })
  for (const { forma, mat, o } of pecas) {
    // A caixa de pintura centrada no ponto da âncora: é o meio dela que a 3/4 lê para achar a estrutura.
    const mx = Math.max(x - forma.b[0], forma.b[2] - x)
    const my = Math.max(meio - forma.b[1], forma.b[3] - meio)
    const presa: Forma = { b: [x - mx, meio - my, x + mx, meio + my], d: forma.d }
    const doMaterial = o.textura ?? texturaDaClasse(mat.classe)
    const textura: Textura = (u, v, px, py, p, s, escala) => {
      if (p.dy !== 0) {
        s[5] = 0
        return
      }
      if (doMaterial !== null) doMaterial(u, v, px, py, p, s, escala)
    }
    cena.partes.push(P(presa, mat, { ...o, dy: z, textura }))
  }
}
