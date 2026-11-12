import { useLayoutEffect } from 'react'

/**
 * PILHA DO PÉ — os avisos (`.pp-notice`) e a doca do caminho
 * (`.pp-route-dock`, o "Mostrar a…") moram embaixo, no meio, cada um no seu
 * andar (o `bottom` da regra no `player.css`). Os andares eram contados para
 * um aviso de uma linha, e não fechavam: o "Aguardando o mestre… / Desistir"
 * mora a 68 px e tem 50 px (82 no celular), e cobria o "Mostrar a…" a 72 px;
 * a faixa da porta, de três botões, cruzava o aviso da viagem, e a pausa a
 * 112 px a doca aberta (caça de 12/11/2026, FX-ROTA).
 *
 * Aqui nada é número de andar: medido, cada um fica no seu andar e, se cruzar
 * um de andar mais baixo, sobe acima dele (com a folga do vão dos controles).
 * O de andar mais baixo nunca se mexe por causa de um mais alto, e quem não
 * cruza ninguém fica onde o CSS o pôs. A subida vai na variável
 * `--pp-pe-subida` do próprio elemento (o `translate` da regra lê ela): o
 * andar do CSS continua sendo a casa de cada um.
 */

/** Quem mora no pé da tela, no meio, e não pode cobrir o botão de outro. */
export const SELETOR_DA_PILHA = '.pp-notice, .pp-route-dock'

/** Entre o topo de um e o pé do que sobe acima dele: o vão dos controles (`--lb-control-gap`). */
export const FOLGA_DA_PILHA_PX = 8

/** A variável que o `translate` de `.pp-notice` e `.pp-route-dock` lê (`player.css`). */
const VARIAVEL_DA_SUBIDA = '--pp-pe-subida'

/**
 * Disparado no `document` quando alguém da pilha muda de altura: quem se põe
 * acima dela (o cartão da janela de teste, `acimaDosAvisos.ts`) mede de novo.
 * A subida é um `style`, que nem o observador de árvore nem o de tamanho veem.
 */
export const EVENTO_DA_PILHA = 'pp-pilha-do-pe'

/** Abaixo disto, dois que só se encostam não contam como cruzados (arredondamento do navegador). */
const TOLERANCIA_PX = 0.5

/** Um da pilha: a faixa na horizontal (px da janela) e, na vertical, a casa que o CSS deu. */
export interface CaixaDaPilha {
  esquerda: number
  direita: number
  /** Do fundo da janela ao pé do elemento, sem subida (o `bottom` calculado). */
  base: number
  altura: number
}

const cruzaAColuna = (a: CaixaDaPilha, b: CaixaDaPilha): boolean => a.esquerda < b.direita && a.direita > b.esquerda

const cruzaNaAltura = (baseA: number, alturaA: number, baseB: number, alturaB: number): boolean =>
  Math.min(baseA + alturaA, baseB + alturaB) - Math.max(baseA, baseB) > TOLERANCIA_PX

/**
 * Quanto cada caixa sobe (px inteiros, na ordem de `caixas`) para nenhuma
 * cruzar outra. Do andar mais baixo ao mais alto (no mesmo andar, a ordem da
 * lista): cada uma fica na casa ou, se cruza uma já posta, sobe acima dela e
 * confere de novo.
 */
export function subidasDaPilha(caixas: readonly CaixaDaPilha[], folga = FOLGA_DA_PILHA_PX): number[] {
  const ordem = caixas.map((_, indice) => indice).sort((a, b) => caixas[a].base - caixas[b].base || a - b)
  const subidas = caixas.map(() => 0)
  const postas: Array<{ caixa: CaixaDaPilha; base: number }> = []
  for (const indice of ordem) {
    const caixa = caixas[indice]
    let base = caixa.base
    let k = 0
    while (k < postas.length) {
      const posta = postas[k]
      if (cruzaAColuna(caixa, posta.caixa) && cruzaNaAltura(base, caixa.altura, posta.base, posta.caixa.altura)) {
        // Inteiro: a caixa fica exatamente onde a conta a pôs, e a próxima confere contra ela.
        base = caixa.base + Math.ceil(posta.base + posta.caixa.altura + folga - caixa.base)
        k = 0
      } else {
        k += 1
      }
    }
    subidas[indice] = base - caixa.base
    postas.push({ caixa, base })
  }
  return subidas
}

/** A casa do elemento: a faixa visível na horizontal; na vertical, a caixa do CSS (sem a subida nem a entrada de 6 px). */
function caixaDe(elemento: HTMLElement): CaixaDaPilha {
  const r = elemento.getBoundingClientRect()
  return { esquerda: r.left, direita: r.right, base: Number.parseFloat(getComputedStyle(elemento).bottom), altura: elemento.offsetHeight }
}

/** Escreve a subida (ou a tira, em 0); diz se mudou. */
function porSubida(elemento: HTMLElement, subida: number): boolean {
  const valor = subida > 0 ? `${subida}px` : ''
  if (elemento.style.getPropertyValue(VARIAVEL_DA_SUBIDA) === valor) return false
  if (valor === '') elemento.style.removeProperty(VARIAVEL_DA_SUBIDA)
  else elemento.style.setProperty(VARIAVEL_DA_SUBIDA, valor)
  return true
}

/**
 * Enquanto a sessão do jogador estiver na tela, mantém a pilha do pé sem
 * ninguém cobrindo ninguém. Arruma antes da pintura: na mesma volta em que um
 * aviso entra, sai ou troca de classe (árvore), muda de tamanho (texto novo,
 * duas linhas, "Mostrar a…" virando a lista de colegas) ou a janela muda. Só
 * lê o layout com dois ou mais na tela; com um ou nenhum, ninguém sobe.
 */
export function usePilhaDoPe(): void {
  useLayoutEffect(() => {
    const observados = new Set<HTMLElement>()
    // O da montagem: o observador ainda entrega a árvore desmontada quando o `document` global já saiu (fim de teste no jsdom).
    const doc = document

    const arrumar = () => {
      const pilha = Array.from(doc.querySelectorAll(SELETOR_DA_PILHA)).filter((elemento): elemento is HTMLElement => elemento instanceof HTMLElement)
      let mudou = false
      if (pilha.length < 2) {
        for (const elemento of pilha) mudou = porSubida(elemento, 0) || mudou
      } else {
        const medidos = pilha.map((elemento) => ({ elemento, caixa: caixaDe(elemento) })).filter(({ caixa }) => caixa.altura > 0 && Number.isFinite(caixa.base))
        const subidas = subidasDaPilha(medidos.map(({ caixa }) => caixa))
        const subidaDe = new Map(medidos.map(({ elemento }, i) => [elemento, subidas[i]]))
        // Fora da conta (sem tamanho, ou sem `bottom` em px): fica na casa.
        for (const elemento of pilha) mudou = porSubida(elemento, subidaDe.get(elemento) ?? 0) || mudou
      }
      // Só os novos: observar de novo dispara a primeira leitura, e a arrumação não pararia.
      for (const elemento of pilha) {
        if (observados.has(elemento)) continue
        observados.add(elemento)
        tamanho?.observe(elemento)
      }
      for (const antigo of observados) {
        if (antigo.isConnected) continue
        observados.delete(antigo)
        tamanho?.unobserve(antigo)
      }
      if (mudou) doc.dispatchEvent(new Event(EVENTO_DA_PILHA))
    }

    // Sem `ResizeObserver` (jsdom): só a árvore e a janela chamam a arrumação.
    const tamanho = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(arrumar)
    const arvore = new MutationObserver(arrumar)
    // `style` fica de fora: a subida que a arrumação escreve não chama outra arrumação.
    arvore.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    window.addEventListener('resize', arrumar)
    arrumar()

    return () => {
      tamanho?.disconnect()
      arvore.disconnect()
      window.removeEventListener('resize', arrumar)
      for (const elemento of observados) porSubida(elemento, 0)
    }
  }, [])
}
