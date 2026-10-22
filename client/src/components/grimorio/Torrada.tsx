import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { CloseIcon } from '../icons'
import { Botao } from './Botao'
import { SAIDA_DA_TORRADA_MS, SAIDA_DA_TORRADA_REDUZIDA_MS, classes, movimentoReduzido } from './comum'
import './grimorio.css'

export interface TorradaProps {
  mensagem: ReactNode
  /** "Desfazer" ou outra recuperação; com ação a torrada fica o dobro do tempo. */
  acao?: { rotulo: string; onClick: () => void }
  /** Chamado depois da animação de saída: é quando quem monta tira a torrada da lista. */
  onFechar?: () => void
  /**
   * Quanto fica. `null`: o prazo é de quem monta (a pilha de avisos do app, cujo
   * relógio mora na `toastStore`), e a torrada só sai quando `saindo` chega.
   */
  duracaoMs?: number | null
  /** A saída pedida por fora (a store já tirou o aviso): a mesma animação de quando ela sai sozinha. */
  saindo?: boolean
  /** `alert` interrompe o leitor de tela (erro); `status`, o padrão, anuncia sem interromper. */
  papel?: 'status' | 'alert'
  /** Botões no lugar da `acao` (os de um aviso do app, que agem e tiram o aviso por conta própria). */
  acoes?: ReactNode
  /** Com ele, o × "Dispensar aviso" no fim da torrada. */
  onDispensar?: () => void
  /** Classe a mais, para quem procura o aviso pelo nome de sempre (`.lb-toast`). */
  className?: string
  /** A caixa da torrada, para quem monta esperar a transição de saída (`Toast.tsx`). */
  ref?: Ref<HTMLDivElement>
}

const DURACAO_SIMPLES_MS = 2600
const DURACAO_COM_ACAO_MS = 5200

/**
 * Aviso que some sozinho (o `.torrada`). Ponteiro em cima segura; a ação fecha
 * na hora depois de agir. Não pega o foco de ninguém. Com `duracaoMs={null}`
 * quem manda no tempo é quem monta (os avisos do app, `Toast.tsx`).
 */
export function Torrada({ mensagem, acao, onFechar, duracaoMs, saindo: saindoPorFora = false, papel = 'status', acoes, onDispensar, className, ref }: TorradaProps) {
  const duracao = duracaoMs === undefined ? (acao ? DURACAO_COM_ACAO_MS : DURACAO_SIMPLES_MS) : duracaoMs
  const [saindoSozinha, setSaindoSozinha] = useState(false)
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
    setSaindoSozinha(true)
    saida.current = window.setTimeout(
      () => aoFechar.current?.(),
      movimentoReduzido() ? SAIDA_DA_TORRADA_REDUZIDA_MS : SAIDA_DA_TORRADA_MS,
    )
  }, [])

  const contar = useCallback(() => {
    window.clearTimeout(prazo.current)
    if (!fechou.current && duracao !== null) prazo.current = window.setTimeout(fechar, duracao)
  }, [fechar, duracao])

  useEffect(() => {
    contar()
    return () => window.clearTimeout(prazo.current)
  }, [contar])
  useEffect(() => () => window.clearTimeout(saida.current), [])

  const saindo = saindoSozinha || saindoPorFora
  return (
    <div
      ref={ref}
      className={classes('gr-torrada', className, saindo && 'gr-sai')}
      role={papel}
      inert={saindo}
      onPointerEnter={() => window.clearTimeout(prazo.current)}
      onPointerLeave={contar}
    >
      <span className="gr-torrada__msg">{mensagem}</span>
      {acoes}
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
      {onDispensar && (
        <Botao soIcone tamanho="p" aria-label="Dispensar aviso" onClick={onDispensar}>
          <CloseIcon />
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
