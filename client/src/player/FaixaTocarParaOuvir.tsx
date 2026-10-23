import { useSyncExternalStore } from 'react'
import type { SonsAoVivo } from './sonsAoVivoDoJogador'
import './FaixaTocarParaOuvir.css'

/**
 * FAIXINHA "TOQUE PARA OUVIR" (sons ao vivo, fatia F5; contrato em
 * `docs/planos/sons-f5-plano-tecnico-2026-10-23.md`, seção 3). Aparece quando
 * um som do mestre chegou antes de o navegador deixar tocar, e some quando ele
 * começa ou quando nada mais espera. O toque nela, DENTRO do próprio clique e
 * sem esperar nada, destrava o áudio e prepara os `<audio>` de reserva (no
 * iOS, só o elemento que tocou dentro de um toque toca depois); o loop que
 * esperava começa no ponto certo (o motor corrige o deslocamento).
 *
 * Montada pela página do jogador (`main.tsx`) e pela tela da mesa
 * (`TableScreen.tsx`), nunca pelo `PlayerView` (que a Visão de jogador também usa).
 */

const SEM_SONS = (): (() => void) => () => undefined
const NADA_ESPERA = (): number => 0

function IconeDeSom() {
  return (
    <svg className="pp-ouvir__icone" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3 8h3l4-3.5v11L6 12H3z" fill="currentColor" />
      <path d="M13 7.2a4 4 0 0 1 0 5.6M15.2 5a7 7 0 0 1 0 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function FaixaTocarParaOuvir({ sons }: { sons: SonsAoVivo | null }) {
  const esperando = useSyncExternalStore(sons === null ? SEM_SONS : sons.assinar, sons === null ? NADA_ESPERA : sons.esperando)
  // A região viva fica sempre montada: só assim o leitor de tela anuncia a faixinha quando ela aparece.
  return (
    <div className="pp-ouvir" aria-live="polite">
      {sons !== null && esperando > 0 && (
        <button type="button" className="pp-ouvir__botao" onClick={() => sons.tocarParaOuvir()}>
          <IconeDeSom />
          Toque para ouvir
        </button>
      )}
    </div>
  )
}
