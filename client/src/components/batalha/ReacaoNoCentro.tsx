import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent } from 'react'
import type { PedidoDeReacao } from '../../lib/batalha/combate'
import { BotaoDeReacao } from './BotaoDeReacao'
import { CaixaDeReacao, chaveDaReacao, type ReacaoNaCaixa } from './CaixaDeReacao'
import { focoPodeIrParaACarta, useReacaoNoCentro } from './centroDaReacao'
import { movimentoReduzido } from './dadosDoMenu'
import './vezNoCentro.css'

/** A sombra de sangue da carta (o `::after` de `.bt-reacao`, a 8 px) e quanto ela salta ao chamar o mestre. */
const SOMBRA = 'translate(8px, 8px)'
const SOMBRA_SALTADA = 'translate(15px, 15px)'

/**
 * A carta abriu (ou ganhou reação) sem pegar o foco: a sombra salta uma vez, depois da entrada da carta. Só
 * transform (movimento reduzido: a sombra pisca, sem andar). O jsdom não tem `animate`.
 */
function baterASombra(carta: Element | null): void {
  if (carta === null || typeof carta.animate !== 'function') return
  const quadros = movimentoReduzido() ? [{ opacity: 1 }, { opacity: 0.35, offset: 0.4 }, { opacity: 1 }] : [{ transform: SOMBRA }, { transform: SOMBRA_SALTADA, offset: 0.35 }, { transform: SOMBRA }]
  carta.animate(quadros, { duration: 300, delay: 180, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', pseudoElement: '::after' })
}

/**
 * A CARTA REAÇÃO DO MESTRE NO CENTRO (pedido de 10/11/2026): os golpes que
 * esperam a reação de um NPC (ou de ficha sem personagem) abrem sobre o mapa,
 * no meio do lugar do menu da vez, na mesma caixa do jogador
 * (`CaixaDeReacao`). Uma por vez, na ordem da aba, com "1 de 2" e as setas;
 * "Rolar todas" rola a fila inteira, como antes. Esc ou Recolher deixam só o
 * botão REAÇÃO (o mestre vê o mapa); golpe novo reabre a carta, e só leva o
 * foco se o mestre não estiver digitando nem fora da batalha. A regra não
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

  // Auditoria de 10/11: o foco que a carta dá SOZINHA (golpe novo, a seguinte da fila, o dado que volta) só vem com o
  // foco no corpo, no mapa ou na batalha (`focoPodeIrParaACarta`); com o mestre digitando, a carta abre sem o foco e
  // bate uma vez a sombra de sangue. O que o mestre pede (a linha da aba, o REAÇÃO, as setas) sobe `foco` e foca sempre.
  const pedidoDeFoco = useReacaoNoCentro((state) => state.foco)
  const focoAtendido = useRef(pedidoDeFoco)
  const intencional = pedidoDeFoco !== focoAtendido.current
  const [chamadas, setChamadas] = useState(0)
  const chamouNoQuadro = useRef(false)
  const chamar = () => {
    if (chamouNoQuadro.current) return
    chamouNoQuadro.current = true
    requestAnimationFrame(() => (chamouNoQuadro.current = false))
    setChamadas((antes) => antes + 1)
    baterASombra(lugar.current?.querySelector('.bt-reacao') ?? null)
  }
  const podeFocar = () => {
    if (intencional || focoPodeIrParaACarta(document.activeElement, lugar.current)) return true
    chamar()
    return false
  }
  useEffect(() => {
    if (!intencional) return
    focoAtendido.current = pedidoDeFoco
    // A reação pedida já estava à vista (a linha dela, de novo): nada remontou, então o foco vem daqui.
    const elemento = lugar.current
    if (elemento === null || elemento.contains(document.activeElement)) return
    const alvo = elemento.querySelector<HTMLElement>('.bt-reacao__opcoes button:not(:disabled)') ?? elemento.querySelector<HTMLElement>('.bt-reacao')
    alvo?.focus({ preventScroll: true })
    // `intencional` sai de `pedidoDeFoco`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoDeFoco])

  // Golpe novo esperando o mestre: a carta abre, como a do jogador, mas sem pedir o foco. Antes da pintura: o menu já
  // sai de trás nesse quadro. Com a carta já aberta na mesma reação, nada remonta (nem o foco anda): a sombra bate para
  // avisar. A que abre ou troca agora decide no efeito da reação que entra (`podeFocar`).
  const chaves = itens.map(chaveDaReacao).join('|')
  /** A reação aberta no quadro anterior; `null` = fechada ou recolhida. */
  const abertaAntes = useRef<string | null>(null)
  useLayoutEffect(() => {
    const agora = new Set(chaves === '' ? [] : chaves.split('|'))
    const nova = [...agora].some((chave) => !vistas.current.has(chave))
    vistas.current = agora
    if (!nova) return
    const jaAberta = abertaAntes.current !== null && abertaAntes.current === chaveAtual
    useReacaoNoCentro.getState().abrir(false)
    if (jaAberta && !(lugar.current?.contains(document.activeElement) ?? false)) chamar()
    // `chamar` lê só refs e o setter; `chaveAtual` sai de `chaves`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaves])

  useLayoutEffect(() => {
    ultimo.current = Math.max(indice, 0)
    abertaAntes.current = naFrente ? chaveAtual : null
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
    <div ref={lugar} className="bt-reacao-no-centro" data-chamadas={chamadas === 0 ? undefined : chamadas} onFocus={() => setComFoco(true)} onBlur={focoSaiu}>
      <CaixaDeReacao
        reacoes={[atual]}
        todas={itens}
        onPedir={onPedir}
        onFechar={recolher}
        rotuloDoFechar="Recolher"
        rolarComEnter
        focoNaCaixa
        podeFocar={podeFocar}
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
