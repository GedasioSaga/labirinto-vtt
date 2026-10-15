import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { classes, movimentoReduzido } from './comum'
import './grimorio.css'

export interface PaginaDoMarcador<P extends string> {
  id: P
  rotulo: string
  icone: ReactNode
  /**
   * Ponto de latão no canto: algo nesta página pede atenção (ex.: há seleção e
   * outra página está aberta). Ausente = o marcador não tem ponto; `false` deixa
   * o ponto apagado, pronto para acender com transição.
   */
  ponto?: boolean
  /** Contador vermelho (pedidos, mensagens não lidas); zero esconde. */
  conta?: number
  /** Como o contador é lido ("1 pedido", "3 não lidas"). */
  rotuloDaConta?: string
}

export interface MarcadoresProps<P extends string> {
  /** Nome da fileira ("Páginas do livro do mestre"). */
  rotulo: string
  paginas: readonly PaginaDoMarcador<P>[]
  atual: P
  onTrocar: (pagina: P) => void
  /** `id` do painel (`role="tabpanel"`) que os marcadores trocam. */
  controla: string
  /** Livro recolhido: a fita some e o marcador aberto volta à cor gravada. */
  recolhido?: boolean
}

/**
 * Os marcadores da lombada (o `.marcadores`): abas em pé, com a fita de latão
 * que desliza até a página aberta. As setas para cima e para baixo trocam de
 * página na hora (dando a volta), Home e End vão às pontas, e o Tab entra só
 * no marcador aberto. A fita é movida direto no elemento, sem render: a
 * primeira posição e o movimento reduzido chegam sem animação.
 */
export function Marcadores<P extends string>({ rotulo, paginas, atual, onTrocar, controla, recolhido }: MarcadoresProps<P>) {
  const lista = useRef<HTMLDivElement>(null)
  const fita = useRef<HTMLSpanElement>(null)
  const jaPosicionou = useRef(false)

  useLayoutEffect(() => {
    const aberto = lista.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
    const elemento = fita.current
    if (!aberto || !elemento) return
    const semAnimar = !jaPosicionou.current || movimentoReduzido()
    jaPosicionou.current = true
    if (semAnimar) elemento.classList.add('gr-sem-anim')
    elemento.style.transform = `translateY(${aberto.offsetTop}px)`
    if (semAnimar) {
      // lê o layout para a posição nova valer antes de a transição voltar
      void elemento.offsetWidth
      elemento.classList.remove('gr-sem-anim')
    }
  }, [atual, paginas])

  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    const abas = Array.from(evento.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'))
    const daVez = abas.findIndex((aba) => aba === evento.target)
    if (daVez < 0) return
    const ultimo = abas.length - 1
    const destinos: Record<string, number> = {
      ArrowDown: daVez === ultimo ? 0 : daVez + 1,
      ArrowUp: daVez === 0 ? ultimo : daVez - 1,
      Home: 0,
      End: ultimo,
    }
    if (!Object.hasOwn(destinos, evento.key)) return
    evento.preventDefault()
    const destino = abas[destinos[evento.key]]
    destino.focus()
    destino.click()
  }

  return (
    <div
      ref={lista}
      className={classes('gr-marcadores', recolhido && 'gr-marcadores--recolhido')}
      role="tablist"
      aria-label={rotulo}
      aria-orientation="vertical"
      onKeyDown={teclar}
    >
      <span ref={fita} className="gr-fita" aria-hidden="true" />
      {paginas.map((pagina) => {
        const aberta = pagina.id === atual
        return (
          <button
            key={pagina.id}
            type="button"
            role="tab"
            className="gr-marcador"
            aria-selected={aberta}
            aria-controls={controla}
            tabIndex={aberta ? 0 : -1}
            onClick={() => onTrocar(pagina.id)}
          >
            {pagina.icone}
            <span>{pagina.rotulo}</span>
            {pagina.ponto !== undefined && (
              <span className={classes('gr-marcador__ponto', pagina.ponto && 'gr-vis')} aria-hidden="true" />
            )}
            {pagina.conta ? (
              <>
                <span className="gr-marcador__conta" aria-hidden="true">
                  {pagina.conta}
                </span>
                <span className="gr-sr">, {pagina.rotuloDaConta ?? pagina.conta}</span>
              </>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
