import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { PaginaDaBiblioteca } from '../../../lib/livros/paginasDaBiblioteca'
import { pendenciasDasFerramentas, type FerramentaDaBiblioteca, type PendenciasDasFerramentas } from '../../../lib/livros/pendenciasDasFerramentas'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { useAcervoDeItensStore } from '../../../stores/acervoDeItensStore'
import { lerPropostasDoAlcance } from '../../../stores/alcanceDosAntigos'
import { useCatalogoStore } from '../../../stores/catalogoStore'
import { useMundoDoLivroStore } from '../../../stores/mundoDoLivroStore'
import { lerPropostasDosRequisitos } from '../../../stores/requisitosDosAntigos'
import { formatarNumero } from '../comum'
import { IconeDaBiblioteca } from './IconeDaBiblioteca'

/**
 * O MENU "FERRAMENTAS" (protótipo aprovado em 23/11): os cinco botões de
 * manutenção que dividiam o topo com a ação principal viram um menu só, com o
 * que falta em cada um, contado dos dados reais pelas mesmas contas que a
 * ferramenta faz ao abrir. Ferramenta em dia fica apagada no lugar de sempre
 * (decisão 3 do protótipo, a recomendada). Cada entrada abre o fluxo que já
 * existe. Setas, Enter; Esc devolve o foco ao botão.
 */

interface DadosDaFerramenta {
  id: FerramentaDaBiblioteca
  nome: string
  faz: string
  un: readonly [string, string]
  paginas: readonly PaginaDaBiblioteca[]
}

const FERRAMENTAS: readonly DadosDaFerramenta[] = [
  { id: 'juntar', nome: 'Juntar das fichas da pasta', faz: 'Traz para o livro o que só está nas fichas', un: ['nova', 'novas'], paginas: ['habilidades', 'itens'] },
  { id: 'alcance', nome: 'Dar alcance aos antigos', faz: 'Propõe o alcance de cada um pelo texto', un: ['pendente', 'pendentes'], paginas: ['habilidades', 'itens'] },
  { id: 'requisitos', nome: 'Dar requisitos aos antigos', faz: 'Propõe o que cada um pede para ser usado', un: ['pendente', 'pendentes'], paginas: ['habilidades', 'itens'] },
  { id: 'ligar', nome: 'Ligar ao Acervo pelo nome', faz: 'Liga cada item do livro à coisa do Acervo de mesmo nome', un: ['sem ligação', 'sem ligação'], paginas: ['itens'] },
  { id: 'armas', nome: 'Juntar as armas', faz: 'Faz cada arma dizer o mesmo no livro, no Acervo e nas fichas', un: ['com diferença', 'com diferença'], paginas: ['itens'] },
]

/** Espera depois da última mudança antes de recontar: as contas não rodam no meio de uma digitação nem no quadro que abre a página. */
const ESPERA_DA_CONTA_MS = 250

/** As contas, depois que a página abriu e cada vez que o livro, o Acervo ou as fichas mudam; as propostas dos arquivos são lidas uma vez. */
function usePendencias(sistema: SistemaDeRpg, ligado: boolean): PendenciasDasFerramentas | null {
  const catalogo = useCatalogoStore((state) => state.itens)
  const acervoPode = useAcervoDeItensStore((state) => state.podeGravar)
  const acervo = useAcervoDeItensStore((state) => state.itens)
  const pastasDoAcervo = useAcervoDeItensStore((state) => state.pastas)
  const aberto = useMundoDoLivroStore((state) => state.aberto)
  const daPasta = useMundoDoLivroStore((state) => state.daPasta)
  const [propostas, setPropostas] = useState<{ alcance: Awaited<ReturnType<typeof lerPropostasDoAlcance>>; requisitos: Awaited<ReturnType<typeof lerPropostasDosRequisitos>> } | null>(null)
  const [pendencias, setPendencias] = useState<PendenciasDasFerramentas | null>(null)

  useEffect(() => {
    let vivo = true
    // As duas leituras nunca lançam (sem arquivo, vem a lista vazia com o aviso).
    void Promise.all([lerPropostasDoAlcance(), lerPropostasDosRequisitos()]).then(([alcance, requisitos]) => {
      if (vivo) setPropostas({ alcance, requisitos })
    })
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    if (!ligado || propostas === null) return
    const relogio = window.setTimeout(() => {
      const comPasta = aberto !== null && daPasta !== null
      setPendencias(
        pendenciasDasFerramentas({
          sistema,
          catalogo,
          acervo: acervoPode ? acervo : [],
          pastasDoAcervo: acervoPode ? pastasDoAcervo : [],
          pastaId: comPasta ? aberto.pastaId : null,
          personagens: comPasta ? daPasta : [],
          propostasDoAlcance: propostas.alcance,
          propostasDosRequisitos: propostas.requisitos,
        }),
      )
    }, ESPERA_DA_CONTA_MS)
    return () => window.clearTimeout(relogio)
  }, [ligado, propostas, sistema, catalogo, acervoPode, acervo, pastasDoAcervo, aberto, daPasta])

  return ligado ? pendencias : null
}

interface MenuDeFerramentasProps {
  pagina: PaginaDaBiblioteca
  sistema: SistemaDeRpg
  podeGravar: boolean
  /** Juntar ou Ligar gravando agora: o menu espera. */
  ocupado: boolean
  onEscolher: (ferramenta: FerramentaDaBiblioteca) => void
}

export function MenuDeFerramentas({ pagina, sistema, podeGravar, ocupado, onEscolher }: MenuDeFerramentasProps) {
  const menuId = useId()
  const [aberto, setAberto] = useState(false)
  /** Aberto pela seta (teclado): aparece na hora, sem animar. */
  const [peloTeclado, setPeloTeclado] = useState(false)
  const botaoRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const pendencias = usePendencias(sistema, podeGravar)
  const daPagina = FERRAMENTAS.filter((ferramenta) => ferramenta.paginas.includes(pagina))
  const comTrabalho = pendencias === null ? 0 : daPagina.filter((ferramenta) => pendencias[ferramenta.id] > 0).length
  const parado = !podeGravar || ocupado

  const fechar = (devolverFoco: boolean) => {
    setAberto(false)
    if (devolverFoco) botaoRef.current?.focus()
  }

  // O menu aberto recebe o foco no primeiro item; clicar fora fecha.
  useEffect(() => {
    if (!aberto) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const aoClicar = (event: PointerEvent) => {
      const alvo = event.target
      if (alvo instanceof Node && (menuRef.current?.contains(alvo) === true || botaoRef.current?.contains(alvo) === true)) return
      setAberto(false)
    }
    window.addEventListener('pointerdown', aoClicar, true)
    return () => window.removeEventListener('pointerdown', aoClicar, true)
  }, [aberto])

  const teclarNoMenu = (event: KeyboardEvent<HTMLDivElement>) => {
    const itens = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const atual = itens.findIndex((item) => item === document.activeElement)
    let proximo: number | null = null
    if (event.key === 'ArrowDown') proximo = (atual + 1) % itens.length
    else if (event.key === 'ArrowUp') proximo = (atual - 1 + itens.length) % itens.length
    else if (event.key === 'Home') proximo = 0
    else if (event.key === 'End') proximo = itens.length - 1
    else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      fechar(true)
      return
    } else if (event.key === 'Tab') {
      setAberto(false)
      return
    }
    if (proximo === null || itens.length === 0) return
    event.preventDefault()
    itens[proximo]?.focus()
  }

  const escolher = (ferramenta: DadosDaFerramenta, emDia: boolean) => {
    if (emDia) return
    fechar(true)
    onEscolher(ferramenta.id)
  }

  return (
    <span className="mu-bib-ancora">
      <button
        ref={botaoRef}
        type="button"
        className="mu-bt"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? menuId : undefined}
        aria-disabled={parado}
        aria-label={comTrabalho > 0 ? `Ferramentas: ${formatarNumero(comTrabalho)} com coisa a fazer` : 'Ferramentas'}
        title={podeGravar ? undefined : 'Parado até o livro ser lido'}
        onClick={() => {
          if (parado) return
          setPeloTeclado(false)
          setAberto((antes) => !antes)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !parado) {
            event.preventDefault()
            setPeloTeclado(true)
            setAberto(true)
          }
        }}
      >
        <IconeDaBiblioteca nome="ferramenta" />
        {ocupado ? 'Juntando…' : 'Ferramentas'}
        {comTrabalho > 0 && (
          <span className="mu-bib-bt__n" aria-hidden="true">
            {formatarNumero(comTrabalho)}
          </span>
        )}
        <IconeDaBiblioteca nome="seta" />
      </button>
      {aberto && (
        <div className="mu-bib-pop" data-instantaneo={peloTeclado ? '' : undefined} id={menuId} role="menu" aria-label="Ferramentas" ref={menuRef} onKeyDown={teclarNoMenu}>
          {daPagina.map((ferramenta) => {
            const n = pendencias === null ? null : pendencias[ferramenta.id]
            const emDia = n === 0
            return (
              <button key={ferramenta.id} type="button" role="menuitem" className="mu-bib-menu__item" aria-disabled={emDia} tabIndex={-1} onClick={() => escolher(ferramenta, emDia)}>
                <IconeDaBiblioteca nome="ferramenta" />
                <span className="mu-bib-menu__nome">{ferramenta.nome}</span>
                <span className="mu-bib-menu__n">{n === null ? '…' : emDia ? 'em dia' : `${formatarNumero(n)} ${n === 1 ? ferramenta.un[0] : ferramenta.un[1]}`}</span>
                <span className="mu-bib-menu__faz">{ferramenta.faz}</span>
              </button>
            )
          })}
          <p className="mu-bib-menu__nota">Dar alcance, Dar requisitos e Juntar as armas mostram a lista antes de gravar. Juntar das fichas e Ligar ao Acervo gravam na hora.</p>
        </div>
      )}
    </span>
  )
}
