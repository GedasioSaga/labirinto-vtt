import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent } from 'react'
import type { PedidoDeReacao } from '../../lib/batalha/combate'
import { BotaoDeReacao } from './BotaoDeReacao'
import { CaixaDeReacao, chaveDaReacao, type ReacaoNaCaixa } from './CaixaDeReacao'
import { useReacaoNoCentro } from './centroDaReacao'
import './vezNoCentro.css'

/**
 * A CARTA REAÇÃO DO MESTRE NO CENTRO (pedido de 10/11/2026): os golpes que
 * esperam a reação de um NPC (ou de ficha sem personagem) abrem sobre o mapa,
 * no meio do lugar do menu da vez, na mesma caixa do jogador
 * (`CaixaDeReacao`). Uma por vez, na ordem da aba, com "1 de 2" e as setas;
 * "Rolar todas" rola a fila inteira, como antes. Esc ou Recolher deixam só o
 * botão REAÇÃO (o mestre vê o mapa); golpe novo reabre a carta. A regra não
 * muda: os pedidos saem pela mesma `onPedir`.
 */

export interface ReacaoNoCentroProps {
  /** As reações do mestre, na ordem da aba Batalha. */
  itens: readonly ReacaoNaCaixa[]
  onPedir: (pedido: PedidoDeReacao) => boolean
}

export function ReacaoNoCentro({ itens, onPedir }: ReacaoNoCentroProps) {
  const escolhida = useReacaoNoCentro((state) => state.escolhida)
  const recolhida = useReacaoNoCentro((state) => state.recolhida)
  const lugar = useRef<HTMLDivElement>(null)
  /** O lugar da fila à vista da última vez: a escolhida que resolveu dá a vez à que subiu para o lugar dela. */
  const ultimo = useRef(0)
  const vistas = useRef<ReadonlySet<string>>(new Set())
  const focarORecolhido = useRef(false)
  /** D2, como o menu da vez: as teclas só são ditas com o foco na carta, quando funcionam. */
  const [comFoco, setComFoco] = useState(false)

  const total = itens.length
  const achada = escolhida === null ? -1 : itens.findIndex((item) => chaveDaReacao(item) === escolhida)
  const indice = total === 0 ? -1 : achada >= 0 ? achada : Math.min(ultimo.current, total - 1)
  const atual = indice < 0 ? undefined : itens[indice]
  const chaveAtual = atual === undefined ? null : chaveDaReacao(atual)
  const naFrente = atual !== undefined && !recolhida

  // Golpe novo esperando o mestre: a carta abre, como a do jogador. Antes da pintura: o menu já sai de trás nesse quadro.
  const chaves = itens.map(chaveDaReacao).join('|')
  useLayoutEffect(() => {
    const agora = new Set(chaves === '' ? [] : chaves.split('|'))
    const nova = [...agora].some((chave) => !vistas.current.has(chave))
    vistas.current = agora
    if (nova) useReacaoNoCentro.getState().abrir()
  }, [chaves])

  useLayoutEffect(() => {
    ultimo.current = Math.max(indice, 0)
    useReacaoNoCentro.getState().mostrar(chaveAtual, naFrente)
  }, [indice, chaveAtual, naFrente])
  useEffect(() => () => useReacaoNoCentro.getState().mostrar(null, false), [])

  // A seta que trocou a reação fica com o foco (a reação que entra o daria ao Rolar 1d20, e o Enter seguinte rolaria sem
  // querer). Um quadro depois: o efeito da reação que entra (filho, e no modo estrito rodado de novo) foca antes.
  const setaComFoco = useRef<number | null>(null)
  useEffect(() => {
    const passo = setaComFoco.current
    setaComFoco.current = null
    if (passo === null) return
    const quadro = requestAnimationFrame(() => lugar.current?.querySelector<HTMLButtonElement>(`.bt-reacao__seta[data-passo="${passo}"]`)?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(quadro)
  }, [chaveAtual])

  // Recolhida com o foco na carta: o foco vai ao botão REAÇÃO (como o "Ações" do menu da vez), antes de o menu o pedir de volta.
  useLayoutEffect(() => {
    if (!recolhida || !focarORecolhido.current) return
    focarORecolhido.current = false
    lugar.current?.querySelector<HTMLButtonElement>('.bt-botao-reacao')?.focus({ preventScroll: true })
  }, [recolhida])

  if (atual === undefined) return null

  if (recolhida) {
    return (
      <div ref={lugar} className="bt-reacao-no-centro" data-recolhida="sim">
        <BotaoDeReacao esperando={total} aberta={false} onAbrir={() => useReacaoNoCentro.getState().abrir()} />
      </div>
    )
  }

  const trazer = (passo: number) => {
    const proxima = itens[(indice + passo + total) % total]
    if (proxima === undefined) return
    setaComFoco.current = document.activeElement instanceof HTMLElement && document.activeElement.classList.contains('bt-reacao__seta') ? passo : null
    useReacaoNoCentro.getState().trazer(chaveDaReacao(proxima))
  }
  const recolher = () => {
    focarORecolhido.current = lugar.current?.contains(document.activeElement) ?? false
    useReacaoNoCentro.getState().recolher()
  }
  const focoSaiu = (evento: FocusEvent<HTMLDivElement>) => {
    if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setComFoco(false)
  }
  const nomeDe = (reacao: ReacaoNaCaixa | undefined) => reacao?.por?.nome ?? reacao?.alvo ?? 'a outra'
  // Enter: antes do dado, o foco nasce no Rolar 1d20 (Overload, Surpresa e o rebater não rolam); depois, na melhor saída.
  const podeRolar = atual.rolagem === undefined && atual.overload !== true && atual.surpresa !== true && atual.por === undefined
  const doEnter = podeRolar ? 'rola' : atual.rolagem !== undefined ? 'escolhe' : null

  return (
    <div ref={lugar} className="bt-reacao-no-centro" onFocus={() => setComFoco(true)} onBlur={focoSaiu}>
      <CaixaDeReacao
        reacoes={[atual]}
        todas={itens}
        onPedir={onPedir}
        onFechar={recolher}
        rotuloDoFechar="Recolher"
        rolarComEnter
        focoNaCaixa
        conta={
          total > 1 ? (
            <span className="bt-reacao__fila">
              <button type="button" className="bt-reacao__seta" data-passo={-1} aria-label={`Reação anterior: ${nomeDe(itens[(indice - 1 + total) % total])}`} onClick={() => trazer(-1)}>
                ‹
              </button>
              <span aria-live="polite">
                {indice + 1} de {total}
              </span>
              <button type="button" className="bt-reacao__seta" data-passo={1} aria-label={`Próxima reação: ${nomeDe(itens[(indice + 1) % total])}`} onClick={() => trazer(1)}>
                ›
              </button>
            </span>
          ) : undefined
        }
        dica={
          <>
            {comFoco && (
              <>
                {doEnter !== null && (
                  <>
                    <kbd>Enter</kbd> {doEnter} ·{' '}
                  </>
                )}
                <kbd>Esc</kbd> recolhe ·{' '}
              </>
            )}
            quem não reagir toma o golpe na virada da rodada
          </>
        }
      />
    </div>
  )
}
