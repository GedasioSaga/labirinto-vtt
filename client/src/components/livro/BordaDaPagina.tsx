import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import {
  CHAVE_DA_LARGURA,
  CHAVE_DA_LARGURA_DO_MESTRE,
  LARGURA_MINIMA,
  LARGURA_PADRAO,
  PASSO_DO_TECLADO,
  larguraMaximaPara,
  lerLarguraGuardada,
  prenderLargura,
} from '../../lib/larguraDaPagina'

/** De que livro é a borda: a mesa (direita, borda à esquerda da página) ou o do mestre (esquerda, borda à direita). */
export type LadoDoLivro = 'dir' | 'esq'

interface DadosDoLado {
  /**
   * A variável que o livro (livro.css) e os vãos leem. Mora no `:root` porque
   * `--lb-coldir-espaco` e `--lb-livroesq-espaco` moram lá: a barra de
   * ferramentas, os avisos e o que vai por portal acompanham a página.
   */
  variavel: string
  chave: string
  /** Para onde o ponteiro anda para ALARGAR: a borda da mesa fica à esquerda da página (−1); a do mestre, à direita (+1). */
  sentido: 1 | -1
  rotulo: string
}

const LADOS: Readonly<Record<LadoDoLivro, DadosDoLado>> = {
  dir: { variavel: '--lb-livrodir-pagina', chave: CHAVE_DA_LARGURA, sentido: -1, rotulo: 'Largura da página' },
  esq: { variavel: '--lb-livroesq-pagina', chave: CHAVE_DA_LARGURA_DO_MESTRE, sentido: 1, rotulo: 'Largura da página do livro do mestre' },
}

/** localStorage pode não existir ou lançar (janela privada, dado bloqueado): sem ele, vale o padrão. */
function lerGuardada(chave: string): number {
  try {
    return lerLarguraGuardada(window.localStorage.getItem(chave))
  } catch {
    return LARGURA_PADRAO
  }
}

function guardar(chave: string, largura: number): void {
  try {
    if (largura === LARGURA_PADRAO) window.localStorage.removeItem(chave)
    else window.localStorage.setItem(chave, String(largura))
  } catch {
    // Sem armazenamento, a largura vale até fechar o app.
  }
}

/** No padrão a variável sai: o CSS volta ao token de sempre, e nada muda para quem nunca arrastou. */
function aplicar(variavel: string, largura: number): void {
  const raiz = document.documentElement.style
  if (largura === LARGURA_PADRAO) raiz.removeProperty(variavel)
  else raiz.setProperty(variavel, `${largura}px`)
}

/**
 * A BORDA DE FORA DA PÁGINA do livro da mesa (a esquerda, onde começa o mapa):
 * arrastar muda a largura (os nomes compridos das cenas voltam a caber numa
 * linha), as setas com ela em foco andam de 16 em 16 (Shift: 64) — a seta
 * para a esquerda alarga, como a borda anda —, Home e End vão às pontas e o
 * clique duplo volta ao padrão. A largura fica neste computador e volta igual
 * ao reabrir. Some com a página recolhida.
 *
 * Sem animação: é gesto direto, e a página segue o ponteiro quadro a quadro.
 *
 * `lado="esq"` (27/11/2026) é a mesma borda no livro do mestre, na beira
 * direita da página: lá puxar para a DIREITA alarga, e a seta para a direita
 * também. Cada livro guarda a sua largura.
 */
export function BordaDaPagina({ escondida, lado = 'dir' }: { escondida: boolean; lado?: LadoDoLivro }) {
  const { variavel, chave, sentido, rotulo } = LADOS[lado]
  const [largura, setLargura] = useState(() => lerGuardada(chave))
  const [janela, setJanela] = useState(() => window.innerWidth)
  const [puxando, setPuxando] = useState(false)
  const inicio = useRef<{ x: number; largura: number; ponteiro: number } | null>(null)
  const efetiva = prenderLargura(largura, janela)
  const maxima = larguraMaximaPara(janela)

  // Antes da pintura: quem guardou 400 px não vê a página nascer em 262 e pular.
  useLayoutEffect(() => {
    aplicar(variavel, efetiva)
  }, [variavel, efetiva])

  // Desmontado o livro (tela inicial, prelúdio), o resto do app volta ao padrão.
  useEffect(() => () => aplicar(variavel, LARGURA_PADRAO), [variavel])

  useEffect(() => {
    const aoRedimensionar = () => setJanela(window.innerWidth)
    window.addEventListener('resize', aoRedimensionar)
    return () => window.removeEventListener('resize', aoRedimensionar)
  }, [])

  const mudar = (nova: number) => {
    const presa = prenderLargura(nova, janela)
    setLargura(presa)
    return presa
  }

  const aoApertar = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Só o botão principal; um segundo dedo no meio do arrasto não faz a página pular.
    if (event.button !== 0 || inicio.current !== null) return
    event.preventDefault()
    inicio.current = { x: event.clientX, largura: efetiva, ponteiro: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
    setPuxando(true)
  }

  const aoMover = (event: ReactPointerEvent<HTMLDivElement>) => {
    const comeco = inicio.current
    if (comeco === null || event.pointerId !== comeco.ponteiro) return
    // Na mesa a borda está à esquerda da página (puxar para a esquerda alarga); no mestre, à direita.
    mudar(comeco.largura + sentido * (event.clientX - comeco.x))
  }

  const aoSoltar = (event: ReactPointerEvent<HTMLDivElement>) => {
    const comeco = inicio.current
    if (comeco === null || event.pointerId !== comeco.ponteiro) return
    inicio.current = null
    setPuxando(false)
    guardar(chave, mudar(comeco.largura + sentido * (event.clientX - comeco.x)))
  }

  const aoTeclar = (event: KeyboardEvent<HTMLDivElement>) => {
    const passo = event.shiftKey ? PASSO_DO_TECLADO * 4 : PASSO_DO_TECLADO
    let nova: number
    switch (event.key) {
      // A seta anda como a borda: para o lado de fora da página, alarga.
      case 'ArrowLeft':
        nova = efetiva - sentido * passo
        break
      case 'ArrowRight':
        nova = efetiva + sentido * passo
        break
      // Como no separador do ARIA: Home é o valor mínimo, End o máximo.
      case 'Home':
        nova = LARGURA_MINIMA
        break
      case 'End':
        nova = maxima
        break
      default:
        return
    }
    // A seta é da borda: não chega ao mapa (lá ela empurra o objeto selecionado).
    event.preventDefault()
    event.stopPropagation()
    guardar(chave, mudar(nova))
  }

  return (
    <div
      className={['gr-borda-da-pagina', lado === 'esq' && 'gr-borda-da-pagina--esq', puxando && 'gr-e-puxando'].filter(Boolean).join(' ')}
      hidden={escondida}
      role="separator"
      aria-orientation="vertical"
      aria-label={rotulo}
      aria-valuemin={LARGURA_MINIMA}
      aria-valuemax={maxima}
      aria-valuenow={efetiva}
      tabIndex={0}
      title="Arraste para mudar a largura. Clique duplo volta ao padrão."
      onPointerDown={aoApertar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={aoSoltar}
      onKeyDown={aoTeclar}
      onDoubleClick={() => guardar(chave, mudar(LARGURA_PADRAO))}
    />
  )
}
