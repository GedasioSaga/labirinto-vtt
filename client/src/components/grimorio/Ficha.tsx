import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronDownIcon } from '../icons'
import { classes } from './comum'
import './grimorio.css'

export interface FichaProps {
  titulo: string
  /** Medalha redonda de latão à esquerda do título. */
  icone?: ReactNode
  /** O que está dentro, numa palavra ("Ligado", "3 itens"); some com a ficha aberta. */
  resumo?: string
  /** Controlada: quem monta guarda se está aberta. Sem ela vale `abertaInicial`. */
  aberta?: boolean
  abertaInicial?: boolean
  onAlternar?: (aberta: boolean) => void
  /** Sem o filete entre o cabeçalho e o miolo (o bloco essencial). */
  plana?: boolean
  /** Entra com a subida curta de quem acabou de ser acrescentado. */
  nova?: boolean
  /** Nível do título; 3 porque a ficha mora dentro de uma página que já tem título. */
  nivel?: 2 | 3 | 4
  /** Id do botão do cabeçalho: quem monta põe o foco nele (o recurso do pino que acabou de entrar). */
  idDoCabecalho?: string
  /**
   * O resumo vira a descrição do cabeçalho, não parte do nome: quem procura a
   * ficha pelo título exato ("Camadas") acha aberta ou fechada, e o leitor de
   * tela ouve "Camadas, recolhido, 9 de 9 visíveis" (o molde da contagem de
   * `CollapsibleSection`).
   */
  resumoForaDoNome?: boolean
  /** Endereço estável (`data-secao`) para quem leva o foco até a ficha de fora. */
  secao?: string
  children: ReactNode
}

/**
 * Cartão recolhível (o `.ficha`). O cabeçalho inteiro é um botão dentro do
 * título; fechada, o miolo fica `inert`, fora do Tab e do leitor de tela, e o
 * acordeão anima a altura pela grade (`0fr` → `1fr`).
 */
export function Ficha({
  titulo,
  icone,
  resumo,
  aberta,
  abertaInicial = false,
  onAlternar,
  plana,
  nova,
  nivel = 3,
  idDoCabecalho,
  resumoForaDoNome,
  secao,
  children,
}: FichaProps) {
  const id = useId()
  const idDoResumo = `${id}-resumo`
  const [abertaLocal, setAbertaLocal] = useState(abertaInicial)
  const estaAberta = aberta ?? abertaLocal
  const Titulo = nivel === 2 ? 'h2' : nivel === 4 ? 'h4' : 'h3'
  const alternar = () => {
    if (aberta === undefined) setAbertaLocal(!estaAberta)
    onAlternar?.(!estaAberta)
  }
  // Aberta, o resumo some da tela (grimorio.css): some da descrição também.
  const descreveComResumo = resumoForaDoNome === true && resumo !== undefined && resumo !== '' && !estaAberta
  return (
    <section className={classes('gr-ficha', estaAberta && 'gr-e-aberta', plana && 'gr-ficha--plana', nova && 'gr-e-nova')} data-secao={secao}>
      <Titulo className="gr-ficha__h">
        <button
          type="button"
          id={idDoCabecalho}
          className="gr-ficha__cab"
          aria-expanded={estaAberta}
          aria-controls={id}
          aria-describedby={descreveComResumo ? idDoResumo : undefined}
          onClick={alternar}
        >
          {icone && <span className="gr-ficha__med">{icone}</span>}
          <span className="gr-ficha__tit">{titulo}</span>
          {resumo && (
            <span className="gr-ficha__resumo" id={resumoForaDoNome === true ? idDoResumo : undefined} aria-hidden={resumoForaDoNome === true ? true : undefined}>
              {resumo}
            </span>
          )}
          <span className="gr-ficha__seta">
            <ChevronDownIcon />
          </span>
        </button>
      </Titulo>
      <div className="gr-ficha__corpo" id={id} inert={!estaAberta}>
        <div className="gr-ficha__miolo">
          <div className="gr-ficha__dentro">{children}</div>
        </div>
      </div>
    </section>
  )
}

const TECLAS_ENTRE_CABECALHOS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End'])

/**
 * Pilha de fichas. Com o foco num cabeçalho, as setas passam ao cabeçalho
 * vizinho sem abrir nada, e Home/End vão ao primeiro e ao último.
 *
 * A tecla usada aqui para na pilha, como em `andarPelosRadios` (comum.ts): o
 * mapa (`PixiCanvas`) ouve o teclado no `window`, não lê o `preventDefault` e,
 * com o foco num botão, faz da seta um empurrão da seleção. O livro fica na
 * Cena com uma sala selecionada, e a seta que levava o foco a "Camadas do
 * chão" também descia a sala uma casa (dez com Shift).
 */
export function Fichas({ children }: { children: ReactNode }) {
  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (!TECLAS_ENTRE_CABECALHOS.has(evento.key)) return
    const pilha = evento.currentTarget
    const cabecalhos = Array.from(pilha.querySelectorAll<HTMLElement>('.gr-ficha__cab')).filter(
      (cabecalho) => cabecalho.closest('.gr-fichas') === pilha,
    )
    const atual = cabecalhos.findIndex((cabecalho) => cabecalho === evento.target)
    if (atual < 0) return
    const ultimo = cabecalhos.length - 1
    const destino =
      evento.key === 'Home' ? 0 : evento.key === 'End' ? ultimo : evento.key === 'ArrowDown' ? Math.min(ultimo, atual + 1) : Math.max(0, atual - 1)
    evento.preventDefault()
    evento.stopPropagation()
    cabecalhos[destino].focus()
  }
  return (
    <div className="gr-fichas" onKeyDown={teclar}>
      {children}
    </div>
  )
}
