import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Peças pequenas da ficha Dragon Ball: stepper −/+, interruptor, grupo de
 * opções com setas, a dica da conta (fórmula do livro) e o texto longo que
 * abre. Visual "Scouter" do protótipo docs/design/ficha-dragon-ball/prototipo.html.
 */

// ───────────────────────────────────────────────────────────────────────────
// Dica da conta
// ───────────────────────────────────────────────────────────────────────────

/** A primeira dica espera um instante (passar o mouse não acende tudo); a vizinha, logo depois, abre na hora. */
const ATRASO_DA_DICA_MS = 350
const JANELA_DA_DICA_SEGUINTE_MS = 500
const LARGURA_DA_DICA = 310
const MARGEM_DA_DICA = 8
let dicaFechadaEm = 0

interface PosicaoDaDica {
  esquerda: number
  topo: number | null
  base: number | null
  instantanea: boolean
}

export interface DicaPronta {
  /** Espalhe no elemento que mostra a dica (precisa ser focável). */
  props: {
    ref: (elemento: HTMLElement | null) => void
    onMouseEnter: () => void
    onMouseLeave: () => void
    onFocus: () => void
    onBlur: () => void
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
    'aria-describedby': string | undefined
  }
  dica: ReactNode
}

/** A dica da conta num elemento qualquer: pairar ou focar abre, sair ou Esc fecha. `conteudo` null = sem dica. */
export function useDica(conteudo: ReactNode | null): DicaPronta {
  const id = useId()
  const elemento = useRef<HTMLElement | null>(null)
  const temporizador = useRef(0)
  const [posicao, setPosicao] = useState<PosicaoDaDica | null>(null)

  useEffect(() => () => window.clearTimeout(temporizador.current), [])

  const mostrar = useCallback((instantanea: boolean) => {
    const caixa = elemento.current?.getBoundingClientRect()
    if (caixa === undefined) return
    const esquerda = Math.min(Math.max(MARGEM_DA_DICA, caixa.left + caixa.width / 2 - LARGURA_DA_DICA / 2), window.innerWidth - LARGURA_DA_DICA - MARGEM_DA_DICA)
    // Perto do pé da tela a dica sobe; o resto desce, para não cobrir o número lido.
    const acima = caixa.bottom + 160 > window.innerHeight
    setPosicao({ esquerda, topo: acima ? null : caixa.bottom + 6, base: acima ? window.innerHeight - caixa.top + 6 : null, instantanea })
  }, [])

  const abrir = useCallback(
    (comAtraso: boolean) => {
      if (conteudo === null) return
      window.clearTimeout(temporizador.current)
      const seguinte = Date.now() - dicaFechadaEm < JANELA_DA_DICA_SEGUINTE_MS
      if (!comAtraso || seguinte) mostrar(seguinte)
      else temporizador.current = window.setTimeout(() => mostrar(false), ATRASO_DA_DICA_MS)
    },
    [conteudo, mostrar],
  )

  const fechar = useCallback(() => {
    window.clearTimeout(temporizador.current)
    setPosicao((atual) => {
      if (atual !== null) dicaFechadaEm = Date.now()
      return null
    })
  }, [])

  const props: DicaPronta['props'] = {
    ref: (no) => {
      elemento.current = no
    },
    onMouseEnter: () => abrir(true),
    onMouseLeave: fechar,
    onFocus: () => abrir(false),
    onBlur: fechar,
    onKeyDown: (event) => {
      // Esc fecha só a dica: sem isto o mesmo Esc fecharia a ficha inteira.
      if (event.key !== 'Escape' || posicao === null) return
      event.stopPropagation()
      fechar()
    },
    'aria-describedby': posicao === null ? undefined : id,
  }

  const dica =
    posicao === null || conteudo === null
      ? null
      : createPortal(
          <div
            id={id}
            role="tooltip"
            className="dbf-dica"
            data-instantanea={posicao.instantanea ? '' : undefined}
            style={{ left: posicao.esquerda, top: posicao.topo ?? undefined, bottom: posicao.base ?? undefined, width: LARGURA_DA_DICA }}
          >
            {conteudo}
          </div>,
          document.body,
        )

  return { props, dica }
}

/** O corpo da dica: o que é o número e a conta com os números da ficha. */
export function ContaDaDica({ titulo, conta, nota }: { titulo: string; conta: string; nota?: string | null }) {
  return (
    <>
      <p className="dbf-dica__t">{titulo}</p>
      <p className="dbf-dica__conta">{conta}</p>
      {nota !== undefined && nota !== null && <p className="dbf-dica__nota">{nota}</p>}
    </>
  )
}

/** Um número que mostra de onde veio: focável, a dica abre no foco e ao pairar. */
export function Formula({ titulo, conta, nota, className, rotulo, children }: { titulo: string; conta: string; nota?: string | null; className?: string; rotulo?: string; children: ReactNode }) {
  const { props, dica } = useDica(<ContaDaDica titulo={titulo} conta={conta} nota={nota} />)
  return (
    <>
      <span {...props} tabIndex={0} className={`dbf-f${className === undefined ? '' : ` ${className}`}`} aria-label={rotulo}>
        {children}
      </span>
      {dica}
    </>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Controles
// ───────────────────────────────────────────────────────────────────────────

export function Stepper({
  rotulo,
  valor,
  onMenos,
  onMais,
  podeMenos = true,
  podeMais = true,
  className,
}: {
  /** "Força": vira "Diminuir Força" e "Aumentar Força". */
  rotulo: string
  valor: ReactNode
  onMenos: () => void
  onMais: () => void
  podeMenos?: boolean
  podeMais?: boolean
  className?: string
}) {
  return (
    <span className={`dbf-stepper${className === undefined ? '' : ` ${className}`}`} role="group" aria-label={rotulo}>
      <button type="button" className="dbf-sbtn" aria-label={`Diminuir ${rotulo}`} disabled={!podeMenos} onClick={onMenos}>
        −
      </button>
      <span className="dbf-stepper__v" aria-live="polite">
        {valor}
      </span>
      <button type="button" className="dbf-sbtn" aria-label={`Aumentar ${rotulo}`} disabled={!podeMais} onClick={onMais}>
        +
      </button>
    </span>
  )
}

export function Interruptor({ ligado, onTrocar, children, disabled = false, descritoPor }: { ligado: boolean; onTrocar: () => void; children: ReactNode; disabled?: boolean; descritoPor?: string }) {
  return (
    <button type="button" className="dbf-sw" role="switch" aria-checked={ligado} disabled={disabled} aria-describedby={descritoPor} onClick={onTrocar}>
      <span className="dbf-sw__t" aria-hidden="true" />
      {children}
    </button>
  )
}

export interface OpcaoDoGrupo<T extends string> {
  valor: T
  texto: ReactNode
  desabilitada?: boolean
}

/** Grupo de opções (role radiogroup): uma parada só do Tab, as setas trocam. */
export function Segmentos<T extends string>({ rotulo, opcoes, valor, onTrocar, className }: { rotulo: string; opcoes: readonly OpcaoDoGrupo<T>[]; valor: T; onTrocar: (valor: T) => void; className?: string }) {
  const grupo = useRef<HTMLDivElement>(null)
  const teclas = (event: KeyboardEvent<HTMLDivElement>) => {
    const passo = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (passo === 0) return
    event.preventDefault()
    const habilitadas = opcoes.filter((opcao) => opcao.desabilitada !== true)
    const atual = habilitadas.findIndex((opcao) => opcao.valor === valor)
    const proxima = habilitadas[(atual + passo + habilitadas.length) % habilitadas.length]
    if (proxima === undefined) return
    onTrocar(proxima.valor)
    // O foco segue a escolha, como num grupo de rádio nativo.
    requestAnimationFrame(() => grupo.current?.querySelector<HTMLButtonElement>(`[data-valor="${CSS.escape(proxima.valor)}"]`)?.focus())
  }
  return (
    <div ref={grupo} className={`dbf-seg${className === undefined ? '' : ` ${className}`}`} role="radiogroup" aria-label={rotulo} onKeyDown={teclas}>
      {opcoes.map((opcao) => (
        <button
          key={opcao.valor}
          type="button"
          role="radio"
          data-valor={opcao.valor}
          aria-checked={opcao.valor === valor}
          tabIndex={opcao.valor === valor ? 0 : -1}
          disabled={opcao.desabilitada === true}
          onClick={() => onTrocar(opcao.valor)}
        >
          {opcao.texto}
        </button>
      ))}
    </div>
  )
}

/** Texto do livro: longo abre em 2 linhas com "Ler tudo". */
const TEXTO_CURTO_MAX = 170

export function TextoQueAbre({ texto, className }: { texto: string; className?: string }) {
  const [aberto, setAberto] = useState(false)
  const limpo = texto.trim()
  if (limpo.length === 0) return null
  const longo = limpo.length > TEXTO_CURTO_MAX || limpo.split('\n').length > 2
  return (
    <>
      <p className={`dbf-texto${className === undefined ? '' : ` ${className}`}${longo && !aberto ? ' dbf-clamp' : ''}`}>{limpo}</p>
      {longo && (
        <button type="button" className="dbf-lnk" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
          {aberto ? 'Mostrar menos' : 'Ler tudo'}
        </button>
      )}
    </>
  )
}

/** Barra de uso (slots, carga): passou do teto fica vermelha. */
export function BarraDeUso({ usado, total, rotulo, mensagem, dica }: { usado: number; total: number; rotulo: string; mensagem: ReactNode; dica: { titulo: string; conta: string } }) {
  const acima = usado > total
  const fracao = total > 0 ? Math.min(1, usado / total) : usado > 0 ? 1 : 0
  return (
    <div className={`dbf-stb${acima ? ' dbf-stb--over' : ''}`}>
      <div className="dbf-stb__top">
        <span>{rotulo}</span>
        <Formula titulo={dica.titulo} conta={dica.conta} className="dbf-stb__v">
          {usado} de {total}
        </Formula>
      </div>
      <div className="dbf-stb__bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${fracao})` }} />
      </div>
      <p className="dbf-stb__msg">{mensagem}</p>
    </div>
  )
}

/** Número digitado: inteiro ou null enquanto não é ("", "-"). */
export function inteiroDoCampo(texto: string): number | null {
  if (!/^-?\d+$/.test(texto.trim())) return null
  const valor = Number(texto.trim())
  return Number.isSafeInteger(valor) ? valor : null
}
