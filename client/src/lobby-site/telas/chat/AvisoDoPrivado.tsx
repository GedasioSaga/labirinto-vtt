import { useEffect, useId, useRef } from 'react'
import { Icone } from '../Icone'
import { AVISO_DO_PRIVADO } from './textosDoChat'

/**
 * O AVISO HONESTO DO PRIVADO entre dois jogadores (plano do Lobby, 12.19):
 * uma vez, numa janela, ao abrir o primeiro privado da mesa; e sempre, no
 * rodapé de cada privado entre jogadores. Lembrado por conta e mesa no
 * navegador; na demo, só enquanto a página está aberta (a demo recomeça igual).
 */

const PREFIXO_DA_CHAVE = 'lobby.chat.aviso-do-privado'

/** Lembra na memória quando o navegador não guarda (armazenamento bloqueado) e na demo. */
const vistosNestaPagina = new Set<string>()

function chaveDoAviso(campanhaId: string, contaId: string): string {
  return `${PREFIXO_DA_CHAVE}:${campanhaId}:${contaId}`
}

export function avisoJaVisto(campanhaId: string, contaId: string, demo: boolean): boolean {
  const chave = chaveDoAviso(campanhaId, contaId)
  if (vistosNestaPagina.has(chave)) return true
  if (demo) return false
  try {
    return window.localStorage.getItem(chave) === '1'
  } catch {
    // Armazenamento bloqueado: o aviso aparece de novo na próxima página, o que é o lado seguro.
    return false
  }
}

function marcarAvisoVisto(campanhaId: string, contaId: string, demo: boolean): void {
  const chave = chaveDoAviso(campanhaId, contaId)
  vistosNestaPagina.add(chave)
  if (demo) return
  try {
    window.localStorage.setItem(chave, '1')
  } catch {
    // Sem armazenamento: vale só para esta página.
  }
}

/** A janela da primeira vez. Fecha no "Entendi" e no Esc; o foco volta para onde estava. */
export function JanelaDoAviso({ campanhaId, contaId, demo, aoFechar }: { campanhaId: string; contaId: string; demo: boolean; aoFechar(): void }) {
  const tituloId = useId()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const janela = ref.current
    if (janela === null || janela.open) return
    janela.showModal()
    return () => janela.close()
  }, [])

  function fechar(): void {
    marcarAvisoVisto(campanhaId, contaId, demo)
    aoFechar()
  }

  return (
    <dialog
      ref={ref}
      className="lo-chat__aviso"
      aria-labelledby={tituloId}
      onCancel={(evento) => {
        // Esc: conta como lido; quem fecha a janela é o React, junto com o estado.
        evento.preventDefault()
        fechar()
      }}
    >
      <h2 className="lo-chat__aviso-titulo" id={tituloId}>
        Antes de conversar em particular
      </h2>
      <p className="lo-chat__aviso-texto">{AVISO_DO_PRIVADO}</p>
      <div className="lo-chat__aviso-acoes">
        <button type="button" className="lo-btn lo-btn--primario" autoFocus onClick={fechar}>
          Entendi
        </button>
      </div>
    </dialog>
  )
}

/** O rodapé de todo privado entre jogadores: o mesmo texto, sempre. */
export function RodapeDoPrivado() {
  return (
    <p className="lo-chat__rodape">
      <Icone nome="alerta" />
      <span>{AVISO_DO_PRIVADO}</span>
    </p>
  )
}
