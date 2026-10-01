import { useMapStore } from '../stores/mapStore'
import { haAlgoParaEndireitar } from './endireitar'
import { isEditableTarget } from './keymap'
import { criarDetectorDeToqueDeAlt } from './toqueDeAlt'

/**
 * ENDIREITAR COM ALT — pedido 5 de 30/09/2026 (PEDIDOS.md), fatia 2: o Alt
 * TOCADO (`lib/toqueDeAlt.ts`) endireita a seleção
 * (`stores/mapStore.ts` → `endireitarSelecionados`, um passo de desfazer).
 *
 * Ligado em `main.tsx`, antes do primeiro render, e não no `PixiCanvas`: dos
 * ouvintes de captura da janela, o registrado primeiro roda primeiro. Assim
 * nenhum `stopImmediatePropagation` de outro ouvinte esconde do detector a
 * tecla ou o clique que fazem do Alt um modificador.
 *
 * Fica mudo — e sem `preventDefault`, para a tecla seguir até quem é dono
 * dela — quando:
 * - o Alt não foi TOQUE: segurado é do medir (pedido 3); combinado é de
 *   Alt+arrastar, Alt+setas, AltGr, Alt+Tab e de todo Alt no meio de um gesto;
 * - o foco está num campo de texto: o Alt é do campo;
 * - há janela modal aberta: o mapa está atrás dela;
 * - a ferramenta não é Selecionar: é com ela que se escolhe a linha pronta, e
 *   nas outras pode haver um traço ponto a ponto aberto (Caminho, Polígono),
 *   que tem botão solto entre um clique e outro;
 * - a seleção não tem nada torto (`haAlgoParaEndireitar`). Parede presa e item
 *   travado CONTAM: o toque age, nada muda, e o aviso diz por quê.
 */

/** O que o Alt lê da store na hora do toque, e a ação que chama. */
export type EstadoDoEndireitarComAlt = Pick<
  ReturnType<typeof useMapStore.getState>,
  'map' | 'selection' | 'activeTool' | 'endireitarSelecionados'
>

/** A store de verdade no app; no teste, uma de mentira para contar as chamadas. */
export interface FonteDoEndireitar {
  getState(): EstadoDoEndireitarComAlt
}

const CAPTURA: AddEventListenerOptions = { capture: true }
const CAPTURA_PASSIVA: AddEventListenerOptions = { capture: true, passive: true }
const PASSIVA: AddEventListenerOptions = { passive: true }

/**
 * Um segundo `instalar` (o `main.tsx` reavaliado pelo HMR) troca o anterior:
 * dois detectores ligados chamariam a ação duas vezes, e o aviso de "ficou
 * como estava" sairia em dobro.
 */
let desinstalarAtual: (() => void) | null = null

function ouvirNaJanela<K extends keyof WindowEventMap>(
  janela: Window,
  tipo: K,
  ouvinte: (evento: WindowEventMap[K]) => void,
  opcoes: AddEventListenerOptions,
): () => void {
  janela.addEventListener(tipo, ouvinte, opcoes)
  return () => janela.removeEventListener(tipo, ouvinte, opcoes)
}

function ouvirNoDocumento<K extends keyof DocumentEventMap>(
  doc: Document,
  tipo: K,
  ouvinte: (evento: DocumentEventMap[K]) => void,
  opcoes: AddEventListenerOptions,
): () => void {
  doc.addEventListener(tipo, ouvinte, opcoes)
  return () => doc.removeEventListener(tipo, ouvinte, opcoes)
}

/** Mesma régua dos atalhos (`lib/keymap.ts`): interruptor e botão não digitam, campo de texto sim. */
function focoEmCampoDeTexto(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false
  return isEditableTarget(alvo.tagName, alvo instanceof HTMLInputElement ? alvo.type : undefined, alvo.isContentEditable)
}

/** Liga o Alt tocado ao endireitar. Devolve a função que desliga tudo o que ligou. */
export function instalarEndireitarComAlt(janela: Window = window, store: FonteDoEndireitar = useMapStore): () => void {
  if (desinstalarAtual !== null) desinstalarAtual()
  const doc = janela.document
  const detector = criarDetectorDeToqueDeAlt()

  const podeEndireitar = (soltura: KeyboardEvent): boolean => {
    if (focoEmCampoDeTexto(soltura.target)) return false
    if (doc.querySelector('[aria-modal="true"]') !== null) return false
    const { map, selection, activeTool } = store.getState()
    return activeTool === 'select' && haAlgoParaEndireitar(map, selection)
  }

  const aoSoltarTecla = (evento: KeyboardEvent): void => {
    if (detector.teclaSubiu(evento) !== 'toque' || !podeEndireitar(evento)) return
    // O Alt foi do endireitar: no navegador, o Alt sozinho ainda levaria o foco ao menu.
    evento.preventDefault()
    store.getState().endireitarSelecionados()
  }

  const desligadores = [
    ouvirNaJanela(janela, 'keydown', (evento) => detector.teclaDesceu(evento), CAPTURA),
    ouvirNaJanela(janela, 'keyup', aoSoltarTecla, CAPTURA),
    ouvirNaJanela(janela, 'pointerdown', () => detector.ponteiroDesceu(), CAPTURA_PASSIVA),
    ouvirNaJanela(janela, 'pointerup', () => detector.ponteiroSubiu(), CAPTURA_PASSIVA),
    ouvirNaJanela(janela, 'pointercancel', () => detector.ponteiroSubiu(), CAPTURA_PASSIVA),
    ouvirNaJanela(janela, 'pointermove', (evento) => detector.ponteiroMoveu(evento.clientX, evento.clientY, evento.buttons), CAPTURA_PASSIVA),
    ouvirNaJanela(janela, 'wheel', () => detector.interromper(), CAPTURA_PASSIVA),
    // Sem captura: o blur de um campo não sobe até a janela, então só chega aqui o
    // da própria janela (Alt+Tab), quando o keyup do Alt vai para outro programa.
    ouvirNaJanela(janela, 'blur', () => detector.zerar(), PASSIVA),
    ouvirNoDocumento(doc, 'visibilitychange', () => detector.zerar(), PASSIVA),
  ]

  const desinstalar = (): void => {
    for (const desligar of desligadores) desligar()
    if (desinstalarAtual === desinstalar) desinstalarAtual = null
  }
  desinstalarAtual = desinstalar
  return desinstalar
}
