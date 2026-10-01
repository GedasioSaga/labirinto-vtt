/**
 * TOQUE DE ALT — a classificação do Alt sozinho, fonte ÚNICA dos dois pedidos
 * de 30/09/2026 que disputam a tecla (PEDIDOS.md):
 *
 *  - pedido 5, "Endireitar": Alt TOCADO — apertar e soltar em menos de
 *    `ALT_TOQUE_JANELA_MS`, sem nenhuma outra entrada no meio — endireita a
 *    seleção (`lib/endireitar.ts`). Decide-se na SOLTURA: no keydown, todo
 *    Alt+arrastar endireitaria a linha antes de duplicar.
 *  - pedido 3, guias de medição estilo Figma (outra trilha): Alt SEGURADO é
 *    dele, para medir. Soltar depois da janela — ou depois de mexer o mouse
 *    com o Alt apertado, que é medir ou mirar — dá 'segurado', e o endireitar
 *    não faz nada.
 *
 * O Alt que já tem dono continua dele: Alt+arrastar duplica, Alt durante o
 * gesto inverte a grade, Alt+setas move 1 px, AltGr do ABNT2 (Ctrl+Alt ou
 * 'AltGraph') digita símbolo, Alt+Shift troca o idioma do teclado, Alt+Tab
 * troca de janela. Qualquer tecla, clique ou rolagem no meio, ou um botão do
 * mouse JÁ apertado quando o Alt desce (arrasto em andamento), faz da soltura
 * um 'combinado' — que também não faz nada. Errar para o lado do 'combinado'
 * é barato (o mestre toca o Alt de novo); errar para o 'toque' mexe no mapa
 * no meio de um gesto e empurra um passo de desfazer que nunca existiu.
 *
 * Módulo PURO: sem DOM, sem store e sem relógio próprio — o instante vem do
 * `timeStamp` do próprio evento, e os ouvintes da janela são de quem usa. Quem
 * liga isto ao endireitar fica em outro arquivo, para a classificação servir
 * às duas trilhas sem arrastar a store junto.
 */

/** Soltar o Alt antes disto (ms), sem outra entrada, é TOQUE. Daqui em diante é SEGURADO. */
export const ALT_TOQUE_JANELA_MS = 600

/** Até quanto o mouse pode andar (px de tela, desde o keydown do Alt) sem deixar de ser toque. */
export const ALT_TOQUE_MOVIMENTO_MAX_PX = 3

/**
 * - 'toque': o gatilho do endireitar (pedido 5).
 * - 'segurado': passou da janela, ou o mouse andou — é do medir (pedido 3).
 * - 'combinado': o Alt foi modificador de outra entrada — não é de ninguém aqui.
 */
export type SolturaDoAlt = 'toque' | 'segurado' | 'combinado'

/** O que aconteceu entre o keydown e o keyup do Alt. */
export interface RegistroDoAlt {
  /** `timeStamp` do keydown do Alt. */
  apertouEm: number
  /** `timeStamp` do keyup do Alt — mesmo relógio do keydown. */
  soltouEm: number
  /** Maior distância, em px de tela, que o mouse andou com o Alt apertado. */
  movimentoPx: number
  /** Houve outra tecla, clique, rolagem ou botão do mouse apertado no meio. */
  outraEntrada: boolean
}

/**
 * Classifica a soltura do Alt. Instante inválido (NaN, soltura antes do
 * aperto) cai em 'segurado': na dúvida, o toque não acontece.
 */
export function classificarSolturaDoAlt(registro: RegistroDoAlt): SolturaDoAlt {
  if (registro.outraEntrada) return 'combinado'
  const duracao = registro.soltouEm - registro.apertouEm
  if (!(duracao >= 0 && duracao < ALT_TOQUE_JANELA_MS)) return 'segurado'
  return registro.movimentoPx > ALT_TOQUE_MOVIMENTO_MAX_PX ? 'segurado' : 'toque'
}

/** Só os campos do `KeyboardEvent` que o detector lê: o evento real serve, e o teste passa um objeto. */
export interface TeclaDoAlt {
  key: string
  repeat: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  timeStamp: number
}

/**
 * Acompanha os eventos e diz, na soltura do Alt, qual foi o gesto. Quem usa
 * repassa os eventos da janela (de preferência na fase de captura, para nenhum
 * `stopPropagation` esconder um clique do detector).
 */
export interface DetectorDeToqueDeAlt {
  /** keydown de qualquer tecla. */
  teclaDesceu(tecla: TeclaDoAlt): void
  /** keyup de qualquer tecla. Na soltura de um Alt acompanhado devolve o gesto; fora disso, `null`. */
  teclaSubiu(tecla: Pick<TeclaDoAlt, 'key' | 'timeStamp'>): SolturaDoAlt | null
  /** pointerdown: clique com o Alt apertado é Alt+clique (duplica, inverte o pincel). */
  ponteiroDesceu(): void
  /** pointerup e pointercancel. */
  ponteiroSubiu(): void
  /** pointermove em px de tela; `botoes` é o `MouseEvent.buttons` (0 = nenhum apertado). */
  ponteiroMoveu(x: number, y: number, botoes: number): void
  /** Rolagem, ou qualquer outra entrada que faça do Alt um modificador. */
  interromper(): void
  /** Janela perdeu o foco ou a aba sumiu: o keyup pode nunca chegar (Alt+Tab). Esquece tudo. */
  zerar(): void
}

interface AltApertado {
  apertouEm: number
  /** Onde o mouse estava quando o Alt desceu; `null` até o primeiro movimento conhecido. */
  origem: { x: number; y: number } | null
  movimentoPx: number
  outraEntrada: boolean
}

export function criarDetectorDeToqueDeAlt(): DetectorDeToqueDeAlt {
  let apertado: AltApertado | null = null
  let botaoApertado = false
  let ultimaPosicao: { x: number; y: number } | null = null

  const marcarOutraEntrada = (): void => {
    if (apertado !== null) apertado.outraEntrada = true
  }

  return {
    teclaDesceu(tecla) {
      if (tecla.key !== 'Alt') {
        // 'AltGraph', 'Control', 'Shift', 'Tab', setas, letras: o Alt virou modificador.
        marcarOutraEntrada()
        return
      }
      // Segurar o Alt repete o keydown: não rearma nem estende a janela.
      if (tecla.repeat) return
      if (apertado !== null) {
        // Os dois Alts juntos: não é toque de um Alt só.
        apertado.outraEntrada = true
        return
      }
      apertado = {
        apertouEm: tecla.timeStamp,
        origem: ultimaPosicao,
        movimentoPx: 0,
        // Ctrl+Alt é o AltGr do ABNT2; com Shift ou Windows é outro atalho. Botão
        // apertado: o Alt chegou no meio de um arrasto.
        outraEntrada: tecla.ctrlKey || tecla.metaKey || tecla.shiftKey || botaoApertado,
      }
    },
    teclaSubiu(tecla) {
      if (tecla.key !== 'Alt') {
        marcarOutraEntrada()
        return null
      }
      if (apertado === null) return null
      const { apertouEm, movimentoPx, outraEntrada } = apertado
      apertado = null
      return classificarSolturaDoAlt({ apertouEm, soltouEm: tecla.timeStamp, movimentoPx, outraEntrada })
    },
    ponteiroDesceu() {
      botaoApertado = true
      marcarOutraEntrada()
    },
    ponteiroSubiu() {
      botaoApertado = false
      marcarOutraEntrada()
    },
    ponteiroMoveu(x, y, botoes) {
      // O pointerup perdido fora da janela (ou o pointerdown que não foi visto)
      // se corrige aqui: o movimento diz se há botão apertado agora.
      botaoApertado = botoes !== 0
      ultimaPosicao = { x, y }
      if (apertado === null) return
      if (botaoApertado) apertado.outraEntrada = true
      if (apertado.origem === null) {
        apertado.origem = { x, y }
        return
      }
      apertado.movimentoPx = Math.max(apertado.movimentoPx, Math.hypot(x - apertado.origem.x, y - apertado.origem.y))
    },
    interromper: marcarOutraEntrada,
    zerar() {
      apertado = null
      botaoApertado = false
      ultimaPosicao = null
    },
  }
}
