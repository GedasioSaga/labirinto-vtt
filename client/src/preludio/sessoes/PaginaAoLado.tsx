import { useEffect, useRef, type KeyboardEvent } from 'react'
import { formaDe, idNovo } from '../../lib/preparo/enciclopedia'
import type { Forma, Secao, Verbete } from '../../lib/preparo/tipos'
import { BarraDoTexto } from '../editor/sobDemanda'
import { lugarDoVerbete } from '../enciclopedia/ListaDeVerbetes'
import { SecaoDoVerbete } from '../enciclopedia/PaginaDoVerbete'
import { usePreludio } from '../estado/preludio'

/**
 * AS NOTAS DA SESSÃO LADO A LADO (correção da F3c, o `Workspace.tsx` do
 * Grimório: as páginas à esquerda, o quadro à direita). O roteiro que veio do
 * Grimório mora nas páginas da sessão; aqui elas abrem dentro do próprio lado,
 * sem sair da sessão nem levar o quadro embora. As abas no alto do lado
 * escolhem entre a folha da sessão e cada página; a página escolhida fica
 * guardada por sessão enquanto o app está aberto.
 */

const TEXTO_VAZIO = { type: 'doc' as const, content: [{ type: 'paragraph' }] }

/** A folha da sessão (o roteiro dela, o "O que aconteceu", o Revelar). */
export const NOTA_DA_SESSAO = 'sessao'

export const ID_DO_PAINEL_DAS_NOTAS = 'pr-notas-da-sessao'
export const idDaNota = (nota: string) => `pr-nota-${nota}`

/** O que cada sessão mostra no lado esquerdo: a folha dela ou uma página (some quando o app fecha). */
const escolhidas = new Map<string, string>()

/** A página que acabou de nascer pelo lado: abre com o título selecionado para digitar por cima (uma vez). */
let paginaRecemCriada: string | null = null

export function abrirPaginaComOTituloSelecionado(paginaId: string): void {
  paginaRecemCriada = paginaId
}

/**
 * A nota que o lado mostra. Sem escolha guardada, a sessão importada (casca sem
 * roteiro, o texto nas páginas) abre na primeira página; as outras, na folha.
 */
export function notaDaSessao(sessao: Verbete, forma: Forma, paginas: readonly Verbete[]): string {
  const guardada = escolhidas.get(sessao.id)
  if (guardada === NOTA_DA_SESSAO || paginas.some((pagina) => pagina.id === guardada)) return guardada ?? NOTA_DA_SESSAO
  return forma.secoes.length === 0 && paginas[0] !== undefined ? paginas[0].id : NOTA_DA_SESSAO
}

export function guardarNotaDaSessao(sessaoId: string, nota: string): void {
  escolhidas.set(sessaoId, nota)
}

interface AbasProps {
  readonly paginas: readonly Verbete[]
  readonly escolhida: string
  readonly podeCriar: boolean
  readonly aoEscolher: (nota: string) => void
  readonly aoCriar: () => void
}

/**
 * As abas do lado das notas: "Sessão" e uma por página. Uma parada só do Tab;
 * as setas, Home e End trocam na hora (ação de teclado: sem animação).
 */
export function AbasDasNotas({ paginas, escolhida, podeCriar, aoEscolher, aoCriar }: AbasProps) {
  const lista = useRef<HTMLDivElement>(null)
  const notas = [{ id: NOTA_DA_SESSAO, rotulo: 'Sessão' }, ...paginas.map((pagina) => ({ id: pagina.id, rotulo: pagina.titulo || 'Página sem nome' }))]

  // A aba escolhida fica à vista na fileira que rola (muitas páginas, lado estreito).
  useEffect(() => {
    lista.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [escolhida])

  const aoTeclar = (evento: KeyboardEvent<HTMLButtonElement>) => {
    const atual = notas.findIndex((nota) => nota.id === escolhida)
    const destino =
      evento.key === 'ArrowRight'
        ? notas[(atual + 1) % notas.length]
        : evento.key === 'ArrowLeft'
          ? notas[(atual - 1 + notas.length) % notas.length]
          : evento.key === 'Home'
            ? notas[0]
            : evento.key === 'End'
              ? notas[notas.length - 1]
              : undefined
    if (destino === undefined) return
    evento.preventDefault()
    aoEscolher(destino.id)
    requestAnimationFrame(() => document.getElementById(idDaNota(destino.id))?.focus())
  }

  return (
    <div className="pr-notas">
      <div ref={lista} className="pr-notas__abas" role="tablist" aria-label="Notas da sessão">
        {notas.map((nota) => {
          const ativa = nota.id === escolhida
          return (
            <button
              key={nota.id}
              id={idDaNota(nota.id)}
              type="button"
              role="tab"
              className="pr-notas__aba"
              aria-selected={ativa}
              aria-controls={ID_DO_PAINEL_DAS_NOTAS}
              tabIndex={ativa ? 0 : -1}
              title={nota.rotulo}
              onClick={() => aoEscolher(nota.id)}
              onKeyDown={aoTeclar}
            >
              {nota.rotulo}
            </button>
          )
        })}
      </div>
      {podeCriar && (
        <button type="button" className="pr-notas__nova" aria-label="Nova página nesta sessão" title="Nova página nesta sessão" onClick={aoCriar}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 4.5v11M4.5 10h11" />
          </svg>
        </button>
      )}
    </div>
  )
}

interface PaginaProps {
  readonly pagina: Verbete
  readonly sessaoId: string
}

/** A página da sessão aberta no lado: o título e as seções, com a barra de texto, como a folha da sessão. */
export function PaginaAoLado({ pagina, sessaoId }: PaginaProps) {
  const avisoDeLeitura = usePreludio((estado) => estado.soLeitura.get(pagina.id))
  const travado = usePreludio((estado) => estado.travado)
  const mudarVerbete = usePreludio((estado) => estado.mudarVerbete)
  const titulo = useRef<HTMLInputElement>(null)
  const idDoTitulo = `pr-pagina-ao-lado-${pagina.id}`
  const forma = formaDe(pagina, null)
  const editavel = avisoDeLeitura === undefined && !travado

  useEffect(() => {
    if (paginaRecemCriada !== pagina.id) return
    paginaRecemCriada = null
    if (titulo.current === null || titulo.current.readOnly) return
    titulo.current.focus({ preventScroll: true })
    titulo.current.select()
  }, [pagina.id])

  if (forma === undefined) return null

  const mudar = (fazer: (atual: Verbete) => Verbete) => mudarVerbete(pagina.id, fazer)
  const mudarForma = (fazer: (atual: Forma) => Forma) => mudar((atual) => ({ ...atual, formas: atual.formas.map((outra) => (outra.id === forma.id ? fazer(outra) : outra)) }))
  const mudarSecao = (secaoId: string, fazer: (atual: Secao) => Secao) => mudarForma((atual) => ({ ...atual, secoes: atual.secoes.map((secao) => (secao.id === secaoId ? fazer(secao) : secao)) }))
  const abrirInteira = () => {
    const { ir, verbetes } = usePreludio.getState()
    ir(lugarDoVerbete(pagina, verbetes), { lugar: { secao: 'sessoes', sessaoId, aba: 'roteiro' }, rotulo: 'Voltar à sessão' })
  }

  return (
    <div className="pr-folha pr-folha--ao-lado">
      <article className="pr-verbete" tabIndex={-1} aria-labelledby={idDoTitulo}>
        {avisoDeLeitura !== undefined && (
          <p className="pr-aviso" role="note">
            {avisoDeLeitura}
          </p>
        )}
        {travado && (
          <p className="pr-aviso" role="status">
            O Prelúdio está gravando uma importação ou uma cópia restaurada. A edição volta quando terminar.
          </p>
        )}
        <header className="pr-verbete__cabeca pr-verbete__cabeca--doc">
          <div className="pr-verbete__nomes">
            <h2 className="pr-sr" id={idDoTitulo}>
              {pagina.titulo || 'Página sem nome'}
            </h2>
            <input
              ref={titulo}
              className="pr-verbete__titulo"
              value={pagina.titulo}
              aria-label="Título da página"
              placeholder="Página sem nome"
              readOnly={!editavel}
              onChange={(evento) => {
                const novo = evento.target.value
                // Forma única com o mesmo nome da página acompanha o título (como na página inteira).
                mudar((atual) => ({ ...atual, titulo: novo, formas: atual.formas.length === 1 && atual.formas[0]?.nome === atual.titulo ? atual.formas.map((unica) => ({ ...unica, nome: novo })) : atual.formas }))
              }}
            />
            <div className="pr-verbete__meta">
              <span className="pr-verbete__tipo">Página da sessão</span>
              <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={abrirInteira}>
                Abrir a página inteira
              </button>
            </div>
          </div>
        </header>
        <div className="pr-barra-casca">
          <BarraDoTexto />
        </div>
        <div className="pr-secoes" key={forma.id}>
          {forma.secoes.map((secao, indice) => (
            <SecaoDoVerbete
              key={secao.id}
              secao={secao}
              dono={pagina.titulo || 'página sem nome'}
              documento
              primeira={indice === 0}
              editavel={editavel}
              montada
              aoMudar={(fazer) => mudarSecao(secao.id, fazer)}
            />
          ))}
          {forma.secoes.length === 0 && <p className="pr-quieto">Página em branco.</p>}
          {editavel && (
            <button
              type="button"
              className="gr-bt gr-bt--p gr-bt--fantasma pr-secoes__nova"
              onClick={() =>
                mudarForma((atual) => ({
                  ...atual,
                  secoes: [...atual.secoes, { id: idNovo('sc'), titulo: atual.secoes.length === 0 ? '' : 'Nova seção', texto: TEXTO_VAZIO, segredo: false }],
                }))
              }
            >
              {forma.secoes.length === 0 ? 'Começar a escrever' : '+ Nova seção'}
            </button>
          )}
        </div>
      </article>
    </div>
  )
}
