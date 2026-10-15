import { useEffect, useRef } from 'react'
import { useLivroDoMestreStore } from '../../stores/livroDoMestreStore'

/** `chaveDaSelecao` sem nada selecionado (nem item, nem pino, nem zona oculta). */
export const SEM_SELECAO = '||'
/** Quanto tempo a seleção que o Acervo acabou de criar ainda não puxa a página Ficha. */
const JANELA_DA_SELECAO_DO_ACERVO_MS = 3000
/** Até onde o ponteiro anda e o gesto ainda é um clique (não um arrasto nem um pan). */
const FOLGA_DO_CLIQUE_PX = 4

/** O que está selecionado, numa string: muda quando a seleção muda. */
export function chaveDaSelecao(selecao: readonly { kind: string; id: string }[], pinoId: string | null, zonaId: string | null): string {
  return `${selecao.map((item) => `${item.kind}:${item.id}`).join(',')}|${pinoId ?? ''}|${zonaId ?? ''}`
}

/** O que vale agora na store do mapa, lido na hora (fora do render). */
export interface AlvoDaFicha {
  ferramenta: string
  selecao: string
}

export interface FichaAFrente {
  /** O que nasce do Acervo deixa o Acervo aberto: a seleção dele não puxa a Ficha por um tempo. */
  marcarSelecaoDoAcervo: () => void
  /** Antes de armar pela barra (clique): a Ficha que a ferramenta traz entra animada; a mesma ferramenta de novo também a traz. */
  armarPeloPonteiro: (ferramenta: string) => void
  /** O `pointerdown` (em captura) sobre o mapa: a Ficha que a seleção dele trouxer entra animada; clicar de novo no que já está selecionado também a traz. */
  apertarNoMapa: (evento: { button: number; clientX: number; clientY: number; target: EventTarget | null }) => void
}

/**
 * A FICHA VEM À FRENTE quando o mestre arma uma ferramenta ou seleciona algo,
 * como o `armar()` e o `selecionar()` do protótipo: tira o livro da lombada e,
 * se o gesto veio do ponteiro (clique na barra ou no mapa), a folha entra
 * animada; pelo atalho de teclado, troca na hora. Largar a seleção não troca a
 * página. Repetir o gesto (a mesma ferramenta, o mesmo token) também traz a
 * Ficha de volta, por isso o ponteiro é ouvido no gesto, não só na mudança.
 */
export function useFichaAFrente(ferramenta: string, selecao: string, lerAgora: () => AlvoDaFicha, ferramentaDeSelecionar: string): FichaAFrente {
  const selecaoDoAcervoAte = useRef(0)
  const ultimo = useRef<AlvoDaFicha>({ ferramenta, selecao })
  const armouPeloPonteiro = useRef(false)
  const gestoNoMapa = useRef<{ x: number; y: number; alvo: AlvoDaFicha } | null>(null)

  useEffect(() => {
    const antes = ultimo.current
    ultimo.current = { ferramenta, selecao }
    const animada = armouPeloPonteiro.current || gestoNoMapa.current !== null
    armouPeloPonteiro.current = false
    const armou = antes.ferramenta !== ferramenta
    const selecionou = selecao !== SEM_SELECAO && selecao !== antes.selecao
    if (!armou && !selecionou) return
    if (!armou && performance.now() < selecaoDoAcervoAte.current) {
      selecaoDoAcervoAte.current = 0
      return
    }
    useLivroDoMestreStore.getState().abrirPagina('ficha', animada)
  }, [ferramenta, selecao])

  // Desmontou no meio do gesto: o ouvinte da janela não fica pendurado.
  const soltar = useRef<(() => void) | null>(null)
  useEffect(() => () => soltar.current?.(), [])

  return {
    marcarSelecaoDoAcervo: () => {
      selecaoDoAcervoAte.current = performance.now() + JANELA_DA_SELECAO_DO_ACERVO_MS
    },
    armarPeloPonteiro: (ferramenta) => {
      if (ferramenta === lerAgora().ferramenta) useLivroDoMestreStore.getState().abrirPagina('ficha', true)
      else armouPeloPonteiro.current = true
    },
    apertarNoMapa: (evento) => {
      // Só o botão principal sobre o próprio mapa: menu e balão por cima dele não são gesto de mapa.
      if (evento.button !== 0 || !(evento.target instanceof HTMLCanvasElement)) return
      soltar.current?.()
      gestoNoMapa.current = { x: evento.clientX, y: evento.clientY, alvo: lerAgora() }
      const terminar = (fim: PointerEvent) => {
        soltar.current?.()
        const gesto = gestoNoMapa.current
        // Limpa depois: a seleção que o próprio mapa faz ao soltar ainda conta como gesto do ponteiro.
        window.setTimeout(() => {
          if (gestoNoMapa.current === gesto) gestoNoMapa.current = null
        }, 0)
        if (gesto === null || fim.type !== 'pointerup') return
        const agora = lerAgora()
        const clicou = Math.hypot(fim.clientX - gesto.x, fim.clientY - gesto.y) <= FOLGA_DO_CLIQUE_PX
        const mesmoAlvo = agora.ferramenta === gesto.alvo.ferramenta && agora.selecao === gesto.alvo.selecao
        if (clicou && mesmoAlvo && agora.ferramenta === ferramentaDeSelecionar && agora.selecao !== SEM_SELECAO) {
          useLivroDoMestreStore.getState().abrirPagina('ficha', true)
        }
      }
      window.addEventListener('pointerup', terminar, true)
      window.addEventListener('pointercancel', terminar, true)
      soltar.current = () => {
        window.removeEventListener('pointerup', terminar, true)
        window.removeEventListener('pointercancel', terminar, true)
        soltar.current = null
      }
    },
  }
}
