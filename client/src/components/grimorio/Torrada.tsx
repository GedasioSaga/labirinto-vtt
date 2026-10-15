import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Botao } from './Botao'
import { SAIDA_DA_TORRADA_MS, SAIDA_DA_TORRADA_REDUZIDA_MS, classes, movimentoReduzido } from './comum'
import './grimorio.css'

export interface TorradaProps {
  mensagem: ReactNode
  /** "Desfazer" ou outra recuperação; com ação a torrada fica o dobro do tempo. */
  acao?: { rotulo: string; onClick: () => void }
  /** Chamado depois da animação de saída: é quando quem monta tira a torrada da lista. */
  onFechar: () => void
  duracaoMs?: number
}

const DURACAO_SIMPLES_MS = 2600
const DURACAO_COM_ACAO_MS = 5200

/**
 * Aviso que some sozinho (o `.torrada`). Ponteiro em cima segura; a ação fecha
 * na hora depois de agir. Não pega o foco de ninguém.
 */
export function Torrada({ mensagem, acao, onFechar, duracaoMs }: TorradaProps) {
  const duracao = duracaoMs ?? (acao ? DURACAO_COM_ACAO_MS : DURACAO_SIMPLES_MS)
  const [saindo, setSaindo] = useState(false)
  const prazo = useRef(0)
  const saida = useRef(0)
  const fechou = useRef(false)
  const aoFechar = useRef(onFechar)
  useEffect(() => {
    aoFechar.current = onFechar
  })

  const fechar = useCallback(() => {
    if (fechou.current) return
    fechou.current = true
    window.clearTimeout(prazo.current)
    setSaindo(true)
    saida.current = window.setTimeout(
      () => aoFechar.current(),
      movimentoReduzido() ? SAIDA_DA_TORRADA_REDUZIDA_MS : SAIDA_DA_TORRADA_MS,
    )
  }, [])

  const contar = useCallback(() => {
    window.clearTimeout(prazo.current)
    if (!fechou.current) prazo.current = window.setTimeout(fechar, duracao)
  }, [fechar, duracao])

  useEffect(() => {
    contar()
    return () => window.clearTimeout(prazo.current)
  }, [contar])
  useEffect(() => () => window.clearTimeout(saida.current), [])

  return (
    <div
      className={classes('gr-torrada', saindo && 'gr-sai')}
      role="status"
      onPointerEnter={() => window.clearTimeout(prazo.current)}
      onPointerLeave={contar}
    >
      <span>{mensagem}</span>
      {acao && (
        <Botao
          variante="latao"
          tamanho="p"
          onClick={() => {
            acao.onClick()
            fechar()
          }}
        >
          {acao.rotulo}
        </Botao>
      )}
    </div>
  )
}

/** Onde as torradas empilham, centradas acima da barra de ferramentas. */
export function Torradas({ children }: { children: ReactNode }) {
  return (
    <section className="gr-torradas" aria-label="Avisos">
      {children}
    </section>
  )
}
