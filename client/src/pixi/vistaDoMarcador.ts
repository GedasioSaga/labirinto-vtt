import { Container, Graphics, Rectangle, Text } from 'pixi.js'
import { escalaDoMarcador } from '../lib/marcadorDeContinente'
import { SIGNAL_NEUTRAL_COLOR } from '../lib/signals'
import { TOKEN_COLOR_DEFAULT, parseHexColor } from '../lib/tokenColor'
import { AREA_DE_TOQUE, ESTILO_ROTULO, ROTULO_Y, camadasDaPose, desenharChao, desenharCorpo, desenharGiro, poseMarcador } from './drawMarcadorDeContinente'

/**
 * MAPA DE CONTINENTE: o pino da ficha de jogador como árvore do Pixi, a mesma
 * no editor do mestre (`pixi/tokensRenderer.ts`) e na tela do jogador
 * (`player/PlayerView.tsx`). O desenho em si é do módulo puro
 * `drawMarcadorDeContinente.ts`; aqui ficam as camadas e quando cada uma é refeita.
 *
 * A raiz mora DENTRO do wrapper da ficha, no mundo — névoa, máscara e ordem de
 * camadas continuam valendo —, com escala inversa ao zoom: lá dentro tudo é px
 * de TELA. Só a pirâmide (`giro`) é redesenhada por quadro; corpo e chão só
 * andam, e o nome é um `Text` que nunca é destruído no meio da sessão.
 */

/** Cor neutra da mesa como número; o `TOKEN_COLOR_DEFAULT` só satisfaz o tipo (a constante é `#rrggbb` válida). */
const COR_NEUTRA = parseHexColor(SIGNAL_NEUTRAL_COLOR) ?? TOKEN_COLOR_DEFAULT

/** Nome (`Container.label`) da raiz do pino no wrapper — é por ele que o teste o acha. */
export const MARCADOR_LABEL = 'marcador-de-continente'

export interface VistaDoMarcador {
  /** Escala inversa ao zoom; a área de toque (`AREA_DE_TOQUE`) é dela, em px de tela. */
  raiz: Container
  chao: Graphics
  giro: Graphics
  corpo: Graphics
  rotulo: Text
  /** Cor (0xrrggbb) do corpo pintado por último; `null` = ainda não pintado. */
  cor: number | null
  /** Ângulo da pirâmide desenhada por último; `NaN` = refazer no próximo `posar`. */
  angulo: number
  /** Fase do giro desta ficha (`faseDoMarcador`): pinos vizinhos não giram juntos. */
  fase: number
}

export function criarVistaDoMarcador(fase: number): VistaDoMarcador {
  const raiz = new Container()
  raiz.label = MARCADOR_LABEL
  const chao = new Graphics()
  const giro = new Graphics()
  const corpo = new Graphics()
  const rotulo = new Text({ text: '', style: ESTILO_ROTULO })
  rotulo.anchor.set(0.5, 0)
  rotulo.y = ROTULO_Y
  raiz.addChild(chao, giro, corpo, rotulo)
  // A cabeça fica bem acima do ponto da ficha: o toque cobre o pino inteiro e o nome.
  raiz.hitArea = new Rectangle(AREA_DE_TOQUE.x, AREA_DE_TOQUE.y, AREA_DE_TOQUE.largura, AREA_DE_TOQUE.altura)
  desenharChao(chao)
  return { raiz, chao, giro, corpo, rotulo, cor: null, angulo: Number.NaN, fase }
}

/**
 * Cor (`#rrggbb`) e nome. O corpo só se refaz quando a cor muda; cor torta
 * (que o recorte já filtra) cai na cor neutra da mesa em vez de pintar preto.
 */
export function pintarVistaDoMarcador(vista: VistaDoMarcador, cor: string, nome: string): void {
  const numero = parseHexColor(cor) ?? COR_NEUTRA
  if (vista.cor !== numero) {
    vista.corpo.clear()
    desenharCorpo(vista.corpo, numero)
    vista.cor = numero
    vista.angulo = Number.NaN
  }
  if (vista.rotulo.text !== nome) vista.rotulo.text = nome
}

/** Pose do instante: pirâmide no ângulo dele, giro e corpo na altura do flutuar, sombra acompanhando. */
export function posarVistaDoMarcador(vista: VistaDoMarcador, tempoMs: number, reduzirMovimento: boolean): void {
  const cor = vista.cor
  if (cor === null) return
  const pose = poseMarcador(tempoMs, { reduzirMovimento, fase: vista.fase })
  const camadas = camadasDaPose(pose.flutuar)
  vista.giro.y = camadas.deslocY
  vista.corpo.y = camadas.deslocY
  vista.chao.scale.set(camadas.escalaChao)
  vista.chao.alpha = camadas.alphaChao
  if (vista.angulo === pose.angulo) return
  vista.giro.clear()
  desenharGiro(vista.giro, cor, pose.angulo)
  vista.angulo = pose.angulo
}

/** Zoom novo: o pino continua do mesmo tamanho na tela. */
export function escalarVistaDoMarcador(vista: VistaDoMarcador, cameraScale: number): void {
  vista.raiz.scale.set(escalaDoMarcador(cameraScale))
}
