import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Tecla } from './Botao'
import { BALAO_QUENTE_MS, ESPERA_DO_BALAO_MS, SAIDA_DO_BALAO_MS, classes, movimentoReduzido } from './comum'
import './grimorio.css'

/** O que o gatilho recebe: espalhe no botão (`<button {...gatilho}>`). */
export interface PropsDoGatilho {
  ref: (no: HTMLElement | null) => void
  onPointerEnter: (evento: PointerEvent<HTMLElement>) => void
  onPointerLeave: () => void
  onPointerDown: () => void
  onFocus: (evento: FocusEvent<HTMLElement>) => void
  onBlur: () => void
  onKeyDown: (evento: KeyboardEvent<HTMLElement>) => void
  'aria-describedby': string | undefined
}

export interface BalaoProps {
  texto: string
  /** Atalho desenhado como tecla ("Ctrl Z"). */
  atalho?: string
  /** Legenda apagada no fim (o grupo da ferramenta). */
  grupo?: string
  children: (gatilho: PropsDoGatilho) => ReactNode
}

const MARGEM_DA_TELA = 8
const DISTANCIA_DO_ALVO = 8
/** Gatilho mais perto do topo que isto abre o balão para baixo. */
const TOPO_QUE_VIRA_PARA_BAIXO = 60

type Fase = { tipo: 'fechado' } | { tipo: 'aberto'; instantaneo: boolean } | { tipo: 'saindo' }
const FECHADO: Fase = { tipo: 'fechado' }
const SAINDO: Fase = { tipo: 'saindo' }

/*
 * Estado dividido por todos os balões, como o balão único do protótipo: até
 * quando um vizinho abre sem esperar, e quem está aberto agora (abrir outro
 * fecha este na hora, sem as duas caixas na tela).
 */
let quenteAte = 0
let fecharOAberto: (() => void) | null = null

/** No jsdom `:focus-visible` não existe; lá todo foco conta como de teclado. */
function focoDeTeclado(elemento: HTMLElement): boolean {
  try {
    return elemento.matches(':focus-visible')
  } catch {
    return true
  }
}

/**
 * Balão com atalho (o `.balao`). Ao pairar com o mouse espera 320 ms; se outro
 * balão acabou de fechar, o vizinho aparece na hora e sem animação. Foco pelo
 * teclado mostra sem esperar; sair, clicar ou Esc esconde. Toque não abre.
 */
export function Balao({ texto, atalho, grupo, children }: BalaoProps) {
  const id = useId()
  const alvo = useRef<HTMLElement | null>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const espera = useRef(0)
  const saida = useRef(0)
  const visivel = useRef<{ instantaneo: boolean } | null>(null)
  const [fase, setFase] = useState<Fase>(FECHADO)

  const fecharJa = useCallback(() => {
    window.clearTimeout(espera.current)
    window.clearTimeout(saida.current)
    visivel.current = null
    if (fecharOAberto === fecharJa) fecharOAberto = null
    setFase(FECHADO)
  }, [])

  const abrir = useCallback(
    (instantaneo: boolean) => {
      window.clearTimeout(espera.current)
      window.clearTimeout(saida.current)
      if (fecharOAberto && fecharOAberto !== fecharJa) fecharOAberto()
      fecharOAberto = fecharJa
      visivel.current = { instantaneo }
      setFase({ tipo: 'aberto', instantaneo })
    },
    [fecharJa],
  )

  const esconder = useCallback(() => {
    window.clearTimeout(espera.current)
    const aberto = visivel.current
    if (!aberto) return
    visivel.current = null
    quenteAte = Date.now() + BALAO_QUENTE_MS
    // quem abriu sem animação sai sem animação, como no protótipo
    if (aberto.instantaneo || movimentoReduzido()) {
      fecharJa()
      return
    }
    // a classe foi posta à mão (efeito abaixo); tirá-la à mão é o que dispara o esmaecer
    caixa.current?.classList.remove('gr-vis')
    setFase(SAINDO)
    saida.current = window.setTimeout(fecharJa, SAIDA_DO_BALAO_MS)
  }, [fecharJa])

  const pedir = (semEsperar: boolean) => {
    if (Date.now() < quenteAte) abrir(true)
    else if (semEsperar) abrir(false)
    else {
      window.clearTimeout(espera.current)
      espera.current = window.setTimeout(() => abrir(false), ESPERA_DO_BALAO_MS)
    }
  }

  useEffect(
    () => () => {
      window.clearTimeout(espera.current)
      window.clearTimeout(saida.current)
      if (fecharOAberto === fecharJa) fecharOAberto = null
    },
    [fecharJa],
  )

  // posiciona antes de pintar; a classe que acende vem no quadro seguinte,
  // senão a transição não tem de onde partir
  useLayoutEffect(() => {
    if (fase.tipo !== 'aberto') return
    const balao = caixa.current
    const gatilho = alvo.current
    if (!balao || !gatilho) return
    const r = gatilho.getBoundingClientRect()
    const emBaixo = r.top < TOPO_QUE_VIRA_PARA_BAIXO
    const largura = balao.offsetWidth
    const x = Math.max(MARGEM_DA_TELA, Math.min(window.innerWidth - largura - MARGEM_DA_TELA, r.left + r.width / 2 - largura / 2))
    const y = emBaixo ? r.bottom + DISTANCIA_DO_ALVO : r.top - balao.offsetHeight - DISTANCIA_DO_ALVO
    balao.style.left = `${x}px`
    balao.style.top = `${y}px`
    balao.style.transformOrigin = emBaixo ? '50% 0' : '50% 100%'
    if (fase.instantaneo) {
      balao.classList.add('gr-vis')
      return
    }
    const quadro = window.requestAnimationFrame(() => balao.classList.add('gr-vis'))
    return () => window.cancelAnimationFrame(quadro)
  }, [fase])

  const gatilho: PropsDoGatilho = {
    ref: (no) => {
      alvo.current = no
    },
    onPointerEnter: (evento) => {
      if (evento.pointerType === 'mouse') pedir(false)
    },
    onPointerLeave: esconder,
    onPointerDown: esconder,
    onFocus: (evento) => {
      if (focoDeTeclado(evento.currentTarget)) pedir(true)
    },
    onBlur: esconder,
    onKeyDown: (evento) => {
      if (evento.key === 'Escape') esconder()
    },
    'aria-describedby': fase.tipo === 'aberto' ? id : undefined,
  }

  return (
    <>
      {children(gatilho)}
      {fase.tipo !== 'fechado' &&
        createPortal(
          <div
            ref={caixa}
            id={id}
            role="tooltip"
            className={classes('gr-balao', fase.tipo === 'aberto' && fase.instantaneo && 'gr-instantaneo')}
          >
            <span>{texto}</span>
            {atalho && <Tecla>{atalho}</Tecla>}
            {grupo && <small>{grupo}</small>}
          </div>,
          document.body,
        )}
    </>
  )
}
