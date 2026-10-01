import type { MedidorDoAlt } from './altMeasure'
import { isEditableTarget } from './keymap'

/**
 * MEDIR COM ALT — pedido 3, fatia 5: liga os eventos da janela ao medidor do
 * Alt segurado (`lib/altMeasure.ts`) e avisa o canvas quando a medida pode ter
 * aparecido ou sumido. Quem desenha é o canvas; este módulo não sabe de mapa
 * nem de seleção.
 *
 * Ouvintes na fase de CAPTURA da janela, como os do endireitar
 * (`lib/endireitarComAlt.ts`): o clique que cancela a medida tem de chegar
 * aqui ANTES de o canvas começar o gesto. Se chegasse depois, o gesto
 * começaria com a medida ainda desenhada na camada das guias.
 *
 * O canvas também é avisado no PRAZO da janela do toque: com o mouse parado
 * em cima da peça, nenhum evento chega quando o Alt passa a medir, e sem o
 * prazo a medida só apareceria quando o mouse mexesse.
 *
 * O keydown do Alt, com o canvas parado e o foco fora de campo de texto, leva
 * `preventDefault`: o Alt solto sozinho não pode levar o foco ao menu (do
 * navegador, ou o modo de menu do WebView2 no app). O keyup NÃO: ele é do
 * endireitar (toque) e de quem mais for dono dele. AltGr do ABNT2 (Ctrl+Alt)
 * e Alt com Windows seguem intocados, porque digitam e trocam de janela.
 *
 * A perda de foco da janela (Alt+Tab) zera o medidor aqui mesmo, como o
 * endireitar zera o dele e o laser o dele (`onWindowBlur` do canvas): cada um
 * esquece o próprio Alt, e o desligar tira tudo de uma vez.
 */

export interface OpcoesDoMedirComAlt {
  /** O canvas está parado (nenhum gesto em curso): só então o Alt solto é do medir. */
  ocioso: () => boolean
  /** O Alt pode ter passado a medir, ou deixado de medir, em `agora` (relógio do `timeStamp` dos eventos). */
  aoMudar: (agora: number) => void
}

const CAPTURA: AddEventListenerOptions = { capture: true }
const CAPTURA_PASSIVA: AddEventListenerOptions = { capture: true, passive: true }
const PASSIVA: AddEventListenerOptions = { passive: true }

/** Mesma régua dos atalhos (`lib/keymap.ts`): interruptor e botão não digitam, campo de texto sim. */
function focoEmCampoDeTexto(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false
  return isEditableTarget(alvo.tagName, alvo instanceof HTMLInputElement ? alvo.type : undefined, alvo.isContentEditable)
}

/** Liga a janela ao medidor. Devolve a função que desliga tudo o que ligou, prazo pendente incluído. */
export function ouvirAltDeMedir(janela: Window, medidor: MedidorDoAlt, opcoes: OpcoesDoMedirComAlt): () => void {
  const doc = janela.document
  let prazo: number | null = null

  const cancelarPrazo = (): void => {
    if (prazo === null) return
    janela.clearTimeout(prazo)
    prazo = null
  }

  /** O Alt acabou de descer: o canvas é avisado de novo quando a janela do toque acabar. */
  const armarPrazo = (agora: number): void => {
    cancelarPrazo()
    const medeEm = medidor.medePeloTempoEm()
    if (medeEm === null) return
    prazo = janela.setTimeout(() => {
      prazo = null
      opcoes.aoMudar(medeEm)
    }, Math.max(0, medeEm - agora))
  }

  const aoDescerTecla = (evento: KeyboardEvent): void => {
    medidor.teclaDesceu(evento)
    if (evento.key === 'Alt' && !evento.repeat) {
      if (opcoes.ocioso() && !evento.ctrlKey && !evento.metaKey && !focoEmCampoDeTexto(evento.target)) evento.preventDefault()
      armarPrazo(evento.timeStamp)
    }
    opcoes.aoMudar(evento.timeStamp)
  }

  const aoSubirTecla = (evento: KeyboardEvent): void => {
    medidor.teclaSubiu(evento)
    if (evento.key === 'Alt') cancelarPrazo()
    opcoes.aoMudar(evento.timeStamp)
  }

  const esquecer = (evento: Event): void => {
    medidor.zerar()
    cancelarPrazo()
    opcoes.aoMudar(evento.timeStamp)
  }

  const aoDescerPonteiro = (evento: PointerEvent): void => {
    medidor.ponteiroDesceu()
    opcoes.aoMudar(evento.timeStamp)
  }

  const aoSubirPonteiro = (evento: PointerEvent): void => {
    medidor.ponteiroSubiu()
    opcoes.aoMudar(evento.timeStamp)
  }

  const aoRolar = (evento: WheelEvent): void => {
    medidor.interromper()
    opcoes.aoMudar(evento.timeStamp)
  }

  const desligadores = [
    ouvirNaJanela(janela, 'keydown', aoDescerTecla, CAPTURA),
    ouvirNaJanela(janela, 'keyup', aoSubirTecla, CAPTURA),
    ouvirNaJanela(janela, 'pointerdown', aoDescerPonteiro, CAPTURA_PASSIVA),
    ouvirNaJanela(janela, 'pointerup', aoSubirPonteiro, CAPTURA_PASSIVA),
    ouvirNaJanela(janela, 'pointercancel', aoSubirPonteiro, CAPTURA_PASSIVA),
    // O movimento só alimenta o medidor: quem redesenha a medida com o mouse
    // andando é o pointermove do canvas, que sabe qual peça está sob ele.
    ouvirNaJanela(janela, 'pointermove', (evento) => medidor.ponteiroMoveu(evento.clientX, evento.clientY, evento.buttons), CAPTURA_PASSIVA),
    ouvirNaJanela(janela, 'wheel', aoRolar, CAPTURA_PASSIVA),
    // Sem captura: o blur de um campo não sobe até a janela; só chega aqui o da própria janela (Alt+Tab).
    ouvirNaJanela(janela, 'blur', esquecer, PASSIVA),
    ouvirNoDocumento(doc, 'visibilitychange', esquecer, PASSIVA),
  ]

  return () => {
    cancelarPrazo()
    for (const desligar of desligadores) desligar()
  }
}

function ouvirNaJanela<K extends keyof WindowEventMap>(
  janela: Window,
  tipo: K,
  ouvinte: (evento: WindowEventMap[K]) => void,
  modo: AddEventListenerOptions,
): () => void {
  janela.addEventListener(tipo, ouvinte, modo)
  return () => janela.removeEventListener(tipo, ouvinte, modo)
}

function ouvirNoDocumento<K extends keyof DocumentEventMap>(
  doc: Document,
  tipo: K,
  ouvinte: (evento: DocumentEventMap[K]) => void,
  modo: AddEventListenerOptions,
): () => void {
  doc.addEventListener(tipo, ouvinte, modo)
  return () => doc.removeEventListener(tipo, ouvinte, modo)
}
