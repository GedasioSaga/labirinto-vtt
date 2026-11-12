import { useLayoutEffect, type RefObject } from 'react'

/**
 * VISÃO DE JOGADOR — onde pousa o cartão "Você é o mestre:" (`PedidosDoTeste`).
 * Embaixo, no meio, ACIMA do que a tela do jogador põe ali: os avisos
 * (`.pp-notice`, cada um no seu andar), o caminho da régua (`.pp-route-dock`)
 * e o recado do Olhar. Antes era um `bottom` fixo de 76 px, contado para um
 * aviso de uma linha a 24 px do fundo; o "Aguardando o mestre… / Desistir"
 * mora a 68 px e tem 50 px de altura, e o cartão cobria o "Desistir" (P08 da
 * caça de 12/11). Medido, o cartão sobe com o aviso que estiver lá, de
 * qualquer altura ou andar, sem número para acertar quando um aviso mudar.
 */

/** O que mora no pé da tela, no meio, e o cartão não pode cobrir. */
export const SELETOR_DO_PE = '.pp-notice, .pp-route-dock, .vj-recado-do-olhar'

/** Entre o topo do mais alto deles e o pé do cartão: a folga de antes (76 − 24 − 38 px). */
export const FOLGA_ACIMA_DO_PE_PX = 14

/** A variável que o CSS do cartão lê (`PedidosDoTeste.css`); sem ela, o cartão desce ao chão dos avisos. */
const VARIAVEL_DA_BASE = '--vj-pedidos-base'

export interface Faixa {
  esquerda: number
  direita: number
}

/** Uma caixa em px da janela, como `getBoundingClientRect` a dá. */
export interface CaixaNaJanela extends Faixa {
  topo: number
  base: number
}

/**
 * Distância do fundo da janela ao pé do cartão: acima do topo mais alto entre
 * as caixas que cruzam a coluna do cartão e moram na metade de baixo. Nenhuma
 * (nada no pé, ou só caixas sem tamanho): `null`, e o CSS usa o chão.
 */
export function baseAcimaDoPe(caixas: readonly CaixaNaJanela[], coluna: Faixa, alturaDaJanela: number): number | null {
  let topoMaisAlto: number | null = null
  for (const caixa of caixas) {
    const temTamanho = caixa.base > caixa.topo && caixa.direita > caixa.esquerda
    const cruzaAColuna = caixa.esquerda < coluna.direita && caixa.direita > coluna.esquerda
    // Um aviso que um dia more no alto não pode puxar o cartão para lá.
    const moraEmbaixo = (caixa.topo + caixa.base) / 2 > alturaDaJanela / 2
    if (!temTamanho || !cruzaAColuna || !moraEmbaixo) continue
    if (topoMaisAlto === null || caixa.topo < topoMaisAlto) topoMaisAlto = caixa.topo
  }
  return topoMaisAlto === null ? null : Math.ceil(alturaDaJanela - topoMaisAlto + FOLGA_ACIMA_DO_PE_PX)
}

const caixaDe = (elemento: Element): CaixaNaJanela => {
  const r = elemento.getBoundingClientRect()
  return { topo: r.top, base: r.bottom, esquerda: r.left, direita: r.right }
}

/**
 * Enquanto `ativo`, mantém o cartão `cartao` acima do pé da tela. Mede antes
 * da pintura e de novo quando algo muda: aviso que entra, sai ou troca de
 * texto (árvore), que muda de tamanho (duas linhas), que termina a entrada
 * (a subida de 6 px), e a janela. Uma medida por quadro, no máximo; o estado
 * do React não muda (só a variável no `style` do cartão).
 */
export function useCartaoAcimaDoPe(cartao: RefObject<HTMLElement | null>, ativo: boolean): void {
  useLayoutEffect(() => {
    const elemento = cartao.current
    if (!ativo || elemento === null) return

    let quadro = 0
    const agendar = () => {
      if (quadro !== 0) return
      quadro = requestAnimationFrame(() => {
        quadro = 0
        medir()
      })
    }
    const tamanho = new ResizeObserver(agendar)
    const arvore = new MutationObserver(agendar)
    const observados = new Set<Element>()

    const medir = () => {
      const doPe = Array.from(document.querySelectorAll(SELETOR_DO_PE))
      const coluna = caixaDe(elemento)
      const base = baseAcimaDoPe(doPe.map(caixaDe), coluna, window.innerHeight)
      if (base === null) elemento.style.removeProperty(VARIAVEL_DA_BASE)
      else elemento.style.setProperty(VARIAVEL_DA_BASE, `${base}px`)
      // Só os novos: observar de novo dispara a primeira leitura, e a medida não pararia.
      for (const visto of doPe) {
        if (observados.has(visto)) continue
        observados.add(visto)
        tamanho.observe(visto)
      }
      for (const antigo of observados) {
        if (antigo.isConnected) continue
        observados.delete(antigo)
        tamanho.unobserve(antigo)
      }
    }

    // `style` fica de fora: a variável que a medida escreve no cartão não chama outra medida.
    arvore.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden'] })
    window.addEventListener('resize', agendar)
    document.addEventListener('animationend', agendar, true)
    document.addEventListener('transitionend', agendar, true)
    medir()

    return () => {
      cancelAnimationFrame(quadro)
      tamanho.disconnect()
      arvore.disconnect()
      window.removeEventListener('resize', agendar)
      document.removeEventListener('animationend', agendar, true)
      document.removeEventListener('transitionend', agendar, true)
    }
  }, [cartao, ativo])
}
