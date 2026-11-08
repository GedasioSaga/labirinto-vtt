import { FEATURES, type FeatureFlags } from '../features'

/**
 * A CHAVE DO PRELÚDIO (docs/planos/preludio-2026-11-08.md §5). Ligado =
 * `FEATURES.preparo` (para todo mundo, quando o mestre disser "pode ligar") OU
 * o atalho escondido da tela inicial, que liga só neste PC.
 *
 * O "só neste PC" mora no localStorage do WebView, e não em `<appData>/preparo/`:
 * com a chave desligada nada pode ler nem gravar lá. Quem descobrir o atalho
 * só vê os próprios dados.
 */

const LIGADO_NESTE_PC = 'lb-preparo:neste-pc'

/** localStorage pode faltar ou lançar (janela privada, armazenamento bloqueado): aí fica desligado. */
export function preparoLigadoNestePc(): boolean {
  try {
    return window.localStorage.getItem(LIGADO_NESTE_PC) === '1'
  } catch {
    return false
  }
}

/** Liga ou desliga só neste PC e devolve como ficou (sem armazenamento, continua como estava). */
export function alternarPreparoNestePc(): boolean {
  const ligar = !preparoLigadoNestePc()
  try {
    if (ligar) window.localStorage.setItem(LIGADO_NESTE_PC, '1')
    else window.localStorage.removeItem(LIGADO_NESTE_PC)
  } catch {
    // Sem armazenamento a chave não muda; quem chamou mostra o estado devolvido.
  }
  return preparoLigadoNestePc()
}

/** O Prelúdio pode abrir, ler e gravar? */
export function preparoLigado(flags: Readonly<FeatureFlags> = FEATURES): boolean {
  return flags.preparo || preparoLigadoNestePc()
}

/** Campo onde a pessoa digita: atalho nenhum dispara ali dentro. */
function dentroDeCampoDeTexto(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false
  return alvo.isContentEditable || alvo.closest('input, textarea, select') !== null
}

/**
 * Ctrl+Alt+P, o atalho escondido da tela inicial. Pela tecla física (`code`),
 * para valer em qualquer layout de teclado; tecla segurada (`repeat`) não
 * liga e desliga sem parar.
 */
export function ehAtalhoDoPreparo(evento: KeyboardEvent): boolean {
  return (
    evento.code === 'KeyP' &&
    evento.ctrlKey &&
    evento.altKey &&
    !evento.shiftKey &&
    !evento.metaKey &&
    !evento.repeat &&
    !dentroDeCampoDeTexto(evento.target)
  )
}
