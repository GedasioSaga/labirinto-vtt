import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import {
  CHAVE_DA_LARGURA,
  LARGURA_MINIMA,
  LARGURA_PADRAO,
  PASSO_DO_TECLADO,
  larguraMaximaPara,
  lerLarguraGuardada,
  prenderLargura,
} from '../../lib/larguraDaPagina'

/**
 * A variável que o livro da mesa (livro.css) e o vão da barra do pé leem.
 * Mora no `:root` porque `--lb-coldir-espaco` mora lá: a barra de
 * ferramentas, os avisos e o que vai por portal acompanham a página.
 */
const VARIAVEL = '--lb-livrodir-pagina'

/** localStorage pode não existir ou lançar (janela privada, dado bloqueado): sem ele, vale o padrão. */
function lerGuardada(): number {
  try {
    return lerLarguraGuardada(window.localStorage.getItem(CHAVE_DA_LARGURA))
  } catch {
    return LARGURA_PADRAO
  }
}

function guardar(largura: number): void {
  try {
    if (largura === LARGURA_PADRAO) window.localStorage.removeItem(CHAVE_DA_LARGURA)
    else window.localStorage.setItem(CHAVE_DA_LARGURA, String(largura))
  } catch {
    // Sem armazenamento, a largura vale até fechar o app.
  }
}

/** No padrão a variável sai: o CSS volta ao token de sempre, e nada muda para quem nunca arrastou. */
function aplicar(largura: number): void {
  const raiz = document.documentElement.style
  if (largura === LARGURA_PADRAO) raiz.removeProperty(VARIAVEL)
  else raiz.setProperty(VARIAVEL, `${largura}px`)
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
 */
export function BordaDaPagina({ escondida }: { escondida: boolean }) {
  const [largura, setLargura] = useState(lerGuardada)
  const [janela, setJanela] = useState(() => window.innerWidth)
  const [puxando, setPuxando] = useState(false)
  const inicio = useRef<{ x: number; largura: number; ponteiro: number } | null>(null)
  const efetiva = prenderLargura(largura, janela)
  const maxima = larguraMaximaPara(janela)

  // Antes da pintura: quem guardou 400 px não vê a página nascer em 262 e pular.
  useLayoutEffect(() => {
    aplicar(efetiva)
  }, [efetiva])

  // Desmontado o livro (tela inicial, prelúdio), o resto do app volta ao padrão.
  useEffect(() => () => aplicar(LARGURA_PADRAO), [])

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
    // A borda está à esquerda da página: puxar para a esquerda alarga.
    mudar(comeco.largura - (event.clientX - comeco.x))
  }

  const aoSoltar = (event: ReactPointerEvent<HTMLDivElement>) => {
    const comeco = inicio.current
    if (comeco === null || event.pointerId !== comeco.ponteiro) return
    inicio.current = null
    setPuxando(false)
    guardar(mudar(comeco.largura - (event.clientX - comeco.x)))
  }

  const aoTeclar = (event: KeyboardEvent<HTMLDivElement>) => {
    const passo = event.shiftKey ? PASSO_DO_TECLADO * 4 : PASSO_DO_TECLADO
    let nova: number
    switch (event.key) {
      case 'ArrowLeft':
        nova = efetiva + passo
        break
      case 'ArrowRight':
        nova = efetiva - passo
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
    guardar(mudar(nova))
  }

  return (
    <div
      className={puxando ? 'gr-borda-da-pagina gr-e-puxando' : 'gr-borda-da-pagina'}
      hidden={escondida}
      role="separator"
      aria-orientation="vertical"
      aria-label="Largura da página"
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
      onDoubleClick={() => guardar(mudar(LARGURA_PADRAO))}
    />
  )
}
