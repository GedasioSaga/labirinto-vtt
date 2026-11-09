import { useEffect, useRef, type KeyboardEvent } from 'react'
import { usePreludio, type AbaDaSessao } from '../estado/preludio'
import { focoFicaFora, guardarFocoFora } from '../quadro/quadroAtivo'

/**
 * AS ABAS DA SESSÃO (fatia F3b): Roteiro e Quadro. A fileira é uma parada só do
 * Tab; as setas, Home e End trocam de aba na hora (sem animação: é ação de
 * teclado), e o foco fica na aba nova mesmo com o quadro abrindo por baixo.
 * Ficam no mesmo lugar nas duas: no topo da página do roteiro e no começo da
 * barra do quadro.
 */

const ABAS: readonly { readonly id: AbaDaSessao; readonly rotulo: string }[] = [
  { id: 'roteiro', rotulo: 'Roteiro' },
  { id: 'quadro', rotulo: 'Quadro' },
]

export const ID_DO_PAINEL_DA_SESSAO = 'pr-painel-da-sessao'

export const idDaAba = (aba: AbaDaSessao) => `pr-aba-da-sessao-${aba}`

export function AbasDaSessao({ sessaoId, aba }: { sessaoId: string; aba: AbaDaSessao }) {
  const ir = usePreludio((estado) => estado.ir)
  const ativa = useRef<HTMLButtonElement>(null)

  // Trocou pelo teclado: a aba nova fica com o foco (o quadro que abre não o toma).
  useEffect(() => {
    if (!focoFicaFora()) return
    const relogio = setTimeout(() => ativa.current?.focus(), 0)
    return () => clearTimeout(relogio)
  }, [])

  const trocar = (nova: AbaDaSessao) => {
    if (nova !== aba) ir({ secao: 'sessoes', sessaoId, aba: nova })
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLButtonElement>) => {
    const atual = ABAS.findIndex((cada) => cada.id === aba)
    const destino =
      evento.key === 'ArrowRight' ? ABAS[(atual + 1) % ABAS.length] : evento.key === 'ArrowLeft' ? ABAS[(atual - 1 + ABAS.length) % ABAS.length] : evento.key === 'Home' ? ABAS[0] : evento.key === 'End' ? ABAS[ABAS.length - 1] : undefined
    if (destino === undefined) return
    evento.preventDefault()
    if (destino.id === aba) return
    guardarFocoFora()
    trocar(destino.id)
  }

  return (
    <div className="pr-abas" role="tablist" aria-label="Partes da sessão">
      {ABAS.map((cada) => {
        const selecionada = cada.id === aba
        return (
          <button
            key={cada.id}
            ref={selecionada ? ativa : undefined}
            type="button"
            role="tab"
            id={idDaAba(cada.id)}
            className="pr-abas__aba"
            aria-selected={selecionada}
            aria-controls={ID_DO_PAINEL_DA_SESSAO}
            tabIndex={selecionada ? 0 : -1}
            onClick={() => trocar(cada.id)}
            onKeyDown={aoTeclar}
          >
            {cada.rotulo}
          </button>
        )
      })}
    </div>
  )
}
