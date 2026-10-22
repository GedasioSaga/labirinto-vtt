import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from '../icons'
import { Botao } from './Botao'
import { SAIDA_DO_DIALOGO_MS, classes, focaveisEm, movimentoReduzido } from './comum'
import './grimorio.css'

export interface DialogoProps {
  aberto: boolean
  titulo: string
  onFechar: () => void
  /** 420 px, para confirmações e escolhas curtas; o padrão é 760. */
  pequeno?: boolean
  /** 640 px e a altura da janela: a prévia grande do cenário, que cabe numa tela de 900 px sem rolar. */
  cena?: boolean
  /**
   * Confirmação destrutiva: vira `alertdialog`, o clique no fundo não fecha e o
   * foco começa em `focoInicial` (o botão seguro, "Cancelar").
   */
  alerta?: boolean
  /**
   * Quem recebe o foco ao abrir; sem ele, o primeiro controle de dentro do
   * `[data-gr-foco]` do corpo (o conteúdo, e não a navegação de seções), senão
   * o primeiro controle do corpo, senão o Fechar.
   */
  focoInicial?: RefObject<HTMLElement | null>
  /** Frase curta embaixo do título; vira a descrição acessível da janela. */
  descricao?: ReactNode
  /** Classe a mais na caixa (`.gr-dlg`), para a largura e o corpo de cada janela. */
  classe?: string
  /**
   * Abre parada, sem a entrada: a janela que se abre pelo teclado (Atalhos, com
   * o "?") e é lida na hora. A saída continua.
   */
  semEntrada?: boolean
  /**
   * Tecla dentro da janela, antes do Esc e do Tab daqui; `preventDefault` nela
   * encerra a tecla (o "?" que fecha a Atalhos).
   */
  aoTeclar?: (evento: KeyboardEvent<HTMLDivElement>) => void
  children: ReactNode
}

/**
 * Casca de diálogo (o `.dlg`): papel do livro sobre o fundo escurecido. O foco
 * entra ao abrir e volta a quem abriu ao fechar; o Tab circula só dentro; Esc
 * fecha; clicar no fundo fecha (menos no `alerta`). Entra em 220 ms e sai em 140.
 */
export function Dialogo({ aberto, titulo, onFechar, pequeno, cena, alerta, focoInicial, descricao, classe, semEntrada, aoTeclar, children }: DialogoProps) {
  const tituloId = useId()
  const descricaoId = useId()
  const corpo = useRef<HTMLDivElement>(null)
  const fechar = useRef<HTMLButtonElement>(null)
  const antes = useRef<HTMLElement | null>(null)
  const [montado, setMontado] = useState(aberto)
  if (aberto && !montado) setMontado(true)
  const saindo = !aberto && montado

  useEffect(() => {
    if (!saindo) return
    if (movimentoReduzido()) {
      setMontado(false)
      return
    }
    const prazo = window.setTimeout(() => setMontado(false), SAIDA_DO_DIALOGO_MS)
    return () => window.clearTimeout(prazo)
  }, [saindo])

  useLayoutEffect(() => {
    if (!aberto) {
      // Fechou: o foco volta a quem abriu, já no começo da saída. Fica no corpo
      // do efeito e não na limpeza: a limpeza roda no meio do commit, e logo
      // depois o React devolve o foco ao campo de dentro do diálogo.
      antes.current?.focus({ preventScroll: true })
      antes.current = null
      return
    }
    if (antes.current === null) {
      const ativo = document.activeElement
      antes.current = ativo instanceof HTMLElement ? ativo : null
    }
    const conteudo = corpo.current?.querySelector<HTMLElement>('[data-gr-foco]') ?? corpo.current
    const primeiroDoConteudo = conteudo ? focaveisEm(conteudo)[0] : undefined
    const primeiroDoCorpo = corpo.current ? focaveisEm(corpo.current)[0] : undefined
    const alvo = focoInicial?.current ?? primeiroDoConteudo ?? primeiroDoCorpo ?? fechar.current
    alvo?.focus({ preventScroll: true })
  }, [aberto, focoInicial])
  // desmontado ainda aberto (a tela que o montou sumiu): devolve o foco do mesmo jeito
  useEffect(() => () => antes.current?.focus({ preventScroll: true }), [])

  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    // Janela modal: tecla nenhuma daqui vira atalho do mapa atrás dela (o mapa
    // ouve no `window`): uma letra trocaria a ferramenta, o Del apagaria a seleção.
    evento.stopPropagation()
    aoTeclar?.(evento)
    if (evento.defaultPrevented) return
    if (evento.key === 'Escape') {
      evento.preventDefault()
      evento.stopPropagation()
      onFechar()
      return
    }
    if (evento.key !== 'Tab') return
    const focaveis = focaveisEm(evento.currentTarget)
    if (focaveis.length === 0) {
      evento.preventDefault()
      return
    }
    const primeiro = focaveis[0]
    const ultimo = focaveis[focaveis.length - 1]
    const ativo = document.activeElement
    // Foco fora da lista do Tab (a própria caixa, depois de um clique no texto): o
    // navegador o levaria ao app atrás da janela, e lá as teclas viram atalho do mapa.
    const fora = !focaveis.some((focavel) => focavel === ativo)
    const sair = evento.shiftKey ? ativo === primeiro || fora : ativo === ultimo || fora
    if (!sair) return
    evento.preventDefault()
    const destino = evento.shiftKey ? ultimo : primeiro
    destino.focus()
  }

  if (!montado) return null
  return createPortal(
    <div
      className={classes('gr-dlg-fundo', semEntrada && 'gr-dlg-fundo--parado', saindo && 'gr-sai')}
      inert={saindo}
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !alerta) onFechar()
      }}
    >
      <div
        className={classes('gr-dlg', pequeno && 'gr-dlg--p', cena && 'gr-dlg--cena', classe)}
        role={alerta ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descricao === undefined ? undefined : descricaoId}
        // Clique no texto da janela deixa o foco aqui, e não no `body`, de onde o Esc iria para o mapa.
        tabIndex={-1}
        onKeyDown={teclar}
      >
        <div className="gr-dlg__topo">
          <div className="gr-dlg__cabeca">
            <h2 className="gr-dlg__tit" id={tituloId}>
              {titulo}
            </h2>
            {descricao !== undefined && (
              <p className="gr-dlg__desc" id={descricaoId}>
                {descricao}
              </p>
            )}
          </div>
          <Botao ref={fechar} soIcone aria-label="Fechar" onClick={onFechar}>
            <CloseIcon />
          </Botao>
        </div>
        <div ref={corpo} className="gr-dlg__corpo">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
