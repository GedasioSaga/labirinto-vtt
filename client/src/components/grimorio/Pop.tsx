import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Tecla } from './Botao'
import { SAIDA_DO_POP_MS, classes, focaveisEm, movimentoReduzido } from './comum'
import './grimorio.css'

export type LadoDoPop = 'baixo' | 'cima' | 'esq' | 'dir'

export interface PopProps {
  aberto: boolean
  /**
   * O botão que abre: dá a posição e recebe o foco de volta. Ele mesmo leva
   * `aria-haspopup` e `aria-expanded={aberto}`.
   */
  gatilho: RefObject<HTMLElement | null>
  onFechar: () => void
  /** De que lado do gatilho abre; `baixo` alinha pela direita, como no protótipo. */
  lado?: LadoDoPop
  /** `menu`: lista de `MenuItem`, as setas andam. `dialogo`: campos soltos, o Tab anda. */
  tipo?: 'menu' | 'dialogo'
  /** Nome acessível do pop. */
  rotulo: string
  /** Título em serifa no topo (só no tipo `dialogo`). */
  titulo?: string
  children: ReactNode
}

const MARGEM_DA_TELA = 8
const DISTANCIA_DO_LADO = 8
const DISTANCIA_DE_BAIXO = 6

interface Posicao {
  x: number
  y: number
  origem: string
}

function posicionar(lado: LadoDoPop, r: DOMRect, largura: number, altura: number): Posicao {
  if (lado === 'cima') return { x: r.left + r.width / 2 - largura / 2, y: r.top - altura - DISTANCIA_DO_LADO, origem: '50% 100%' }
  if (lado === 'esq') return { x: r.left - largura - DISTANCIA_DO_LADO, y: r.top, origem: '100% 0' }
  if (lado === 'dir') return { x: r.right + DISTANCIA_DO_LADO, y: r.top, origem: '0 0' }
  return { x: r.right - largura, y: r.bottom + DISTANCIA_DE_BAIXO, origem: '100% 0' }
}

const itensDoMenu = (pop: HTMLElement) => Array.from(pop.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'))

/**
 * Popover e menu (o `.pop`). Abre a partir do gatilho em 160 ms e sai em 110.
 * Esc fecha e devolve o foco ao gatilho; clicar fora fecha; escolher um item
 * do menu fecha e devolve o foco. No menu as setas andam pelos itens, pulando
 * os desabilitados, e Home/End vão às pontas; Tab sai do menu fechando-o.
 */
export function Pop({ aberto, gatilho, onFechar, lado = 'baixo', tipo = 'menu', rotulo, titulo, children }: PopProps) {
  const caixa = useRef<HTMLDivElement>(null)
  const [montado, setMontado] = useState(aberto)
  if (aberto && !montado) setMontado(true)
  const saindo = !aberto && montado

  useEffect(() => {
    if (!saindo) return
    if (movimentoReduzido()) {
      setMontado(false)
      return
    }
    const prazo = window.setTimeout(() => setMontado(false), SAIDA_DO_POP_MS)
    return () => window.clearTimeout(prazo)
  }, [saindo])

  useLayoutEffect(() => {
    const pop = caixa.current
    const origem = gatilho.current
    if (!aberto || !pop || !origem) return
    const largura = pop.offsetWidth
    const altura = pop.offsetHeight
    const p = posicionar(lado, origem.getBoundingClientRect(), largura, altura)
    pop.style.left = `${Math.max(MARGEM_DA_TELA, Math.min(window.innerWidth - largura - MARGEM_DA_TELA, p.x))}px`
    pop.style.top = `${Math.max(MARGEM_DA_TELA, Math.min(window.innerHeight - altura - MARGEM_DA_TELA, p.y))}px`
    pop.style.setProperty('--gr-origem', p.origem)
    // Pop só de leitura (a nota "Rede local"): o foco vai à própria caixa, para o Esc fechar.
    const primeiro = tipo === 'menu' ? itensDoMenu(pop)[0] : (focaveisEm(pop)[0] ?? pop)
    primeiro?.focus({ preventScroll: true })
  }, [aberto, gatilho, lado, tipo])

  // clicar fora fecha (o próprio gatilho fica de fora: ele alterna sozinho)
  useEffect(() => {
    if (!aberto) return
    const aoApertar = (evento: globalThis.PointerEvent) => {
      const alvo = evento.target
      if (!(alvo instanceof Node)) return
      if (caixa.current?.contains(alvo) || gatilho.current?.contains(alvo)) return
      onFechar()
    }
    document.addEventListener('pointerdown', aoApertar, true)
    return () => document.removeEventListener('pointerdown', aoApertar, true)
  }, [aberto, gatilho, onFechar])

  const fecharDevolvendo = () => {
    onFechar()
    gatilho.current?.focus({ preventScroll: true })
  }

  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    // Com o foco no menu, tecla nenhuma vira atalho do mapa: as setas moveriam
    // a seleção, o Del a apagaria, uma letra trocaria a ferramenta.
    if (tipo === 'menu') evento.stopPropagation()
    if (evento.key === 'Escape') {
      evento.preventDefault()
      evento.stopPropagation()
      fecharDevolvendo()
      return
    }
    if (tipo !== 'menu') return
    if (evento.key === 'Tab') {
      evento.preventDefault()
      fecharDevolvendo()
      return
    }
    const itens = itensDoMenu(evento.currentTarget)
    if (itens.length === 0) return
    const daVez = itens.findIndex((item) => item === document.activeElement)
    const ultimo = itens.length - 1
    const destinos: Record<string, number> = {
      ArrowDown: daVez < 0 || daVez === ultimo ? 0 : daVez + 1,
      ArrowUp: daVez <= 0 ? ultimo : daVez - 1,
      Home: 0,
      End: ultimo,
    }
    if (!Object.hasOwn(destinos, evento.key)) return
    evento.preventDefault()
    itens[destinos[evento.key]].focus()
  }

  // escolher um item: a ação do item roda primeiro (o clique sobe até aqui depois)
  const clicar = (evento: MouseEvent<HTMLDivElement>) => {
    if (tipo !== 'menu' || !(evento.target instanceof Element)) return
    const item = evento.target.closest('[role="menuitem"]')
    if (item instanceof HTMLButtonElement && !item.disabled) fecharDevolvendo()
  }

  if (!montado) return null
  return createPortal(
    <div
      ref={caixa}
      className={classes('gr-pop', saindo && 'gr-sai')}
      role={tipo === 'menu' ? 'menu' : 'dialog'}
      aria-label={rotulo}
      tabIndex={-1}
      inert={saindo}
      onKeyDown={teclar}
      onClick={clicar}
    >
      {titulo && <h2 className="gr-pop__tit">{titulo}</h2>}
      {tipo === 'dialogo' && titulo ? <div className="gr-pop__corpo">{children}</div> : children}
    </div>,
    document.body,
  )
}

export interface MenuItemProps {
  icone?: ReactNode
  /** Tecla à direita ("Ctrl S"). */
  atalho?: string
  /** Segunda linha apagada, embaixo do nome. */
  detalhe?: string
  perigo?: boolean
  /** Fica no lugar de sempre, apagado e pulado pelas setas. */
  disabled?: boolean
  /** Id de uma frase de fora do item que também o descreve (a nota no pé do menu). */
  descritoPor?: string
  /** O evento diz se a escolha veio do mouse (`detail > 0`) ou do teclado (0). */
  onClick: (evento: MouseEvent<HTMLButtonElement>) => void
  children: ReactNode
}

/**
 * Linha do menu (o `.menu__item`). O nome acessível é só o texto do item: o
 * detalhe embaixo vira a descrição, e a tecla desenhada fica fora dos dois
 * (é para os olhos; `getByRole('menuitem', { name })` acha o item pelo nome).
 */
export function MenuItem({ icone, atalho, detalhe, perigo, disabled, descritoPor, onClick, children }: MenuItemProps) {
  const id = useId()
  const descricao = [detalhe ? `${id}-detalhe` : null, descritoPor ?? null].filter((parte) => parte !== null).join(' ')
  return (
    <button
      type="button"
      role="menuitem"
      className={classes('gr-menu__item', perigo && 'gr-menu__item--perigo')}
      tabIndex={-1}
      disabled={disabled}
      aria-labelledby={`${id}-nome`}
      aria-describedby={descricao === '' ? undefined : descricao}
      onClick={onClick}
    >
      {icone}
      <span>
        <span id={`${id}-nome`}>{children}</span>
        {detalhe && <small id={`${id}-detalhe`}>{detalhe}</small>}
      </span>
      {atalho && <Tecla>{atalho}</Tecla>}
    </button>
  )
}

export function MenuSeparador() {
  return <div className="gr-menu__sep" role="separator" />
}

/** Frase de ajuda no pé do menu; os itens que ela explica a ligam pelo `descritoPor`. */
export function MenuNota({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="gr-menu__nota" role="presentation">
      {children}
    </p>
  )
}

/** Legenda pequena de um trecho do menu ("Esta cena"). */
export function MenuRotulo({ children }: { children: ReactNode }) {
  return (
    <div className="gr-menu__rot" role="presentation">
      {children}
    </div>
  )
}
