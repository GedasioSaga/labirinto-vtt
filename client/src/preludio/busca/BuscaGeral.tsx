import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { buscar, compararTitulos, ROTULO_DO_TIPO, type Achado } from '../../lib/preparo/enciclopedia'
import type { Verbete } from '../../lib/preparo/tipos'
import { entradasDaBusca, usePreludio } from '../estado/preludio'
import { lugarDoVerbete } from '../enciclopedia/ListaDeVerbetes'
import { quadroAberto, viraCartao } from '../quadro/quadroAtivo'

/**
 * BUSCA DO PRELÚDIO (Ctrl+K): procura no nome, nos apelidos e no texto inteiro
 * de todos os verbetes e páginas, sem acento e sem caixa. Abre na hora, sem
 * animação (é atalho de teclado, de uso frequente); setas escolhem, Enter abre,
 * Esc fecha e devolve o foco a quem estava com ele.
 *
 * Com um quadro aberto (F3b), os cartões dele vêm primeiro, em "Neste quadro":
 * Enter leva a câmera até o cartão. Os outros verbetes abrem a página, e
 * Shift+Enter põe o cartão no meio do quadro.
 */

/** Um resultado: um cartão do quadro aberto ou um verbete do Prelúdio. */
type Item =
  | { readonly t: 'cartao'; readonly verbete: Verbete; readonly formaId: string; readonly achado: Achado | null }
  | { readonly t: 'verbete'; readonly achado: Achado; readonly podePor: boolean }

const chaveDoItem = (item: Item) => (item.t === 'cartao' ? `c:${item.verbete.id}` : `v:${item.achado.id}`)

const ID_DA_LISTA = 'pr-busca-lista'

function Resultado({ achado, noQuadro = false }: { achado: Pick<Achado, 'titulo' | 'tipo'> & Partial<Achado>; noQuadro?: boolean }) {
  return (
    <>
      <span className="pr-busca__linha">
        <span className="pr-busca__titulo">{achado.titulo || 'Sem nome'}</span>
        <span className="pr-busca__tipo">{noQuadro ? `${ROTULO_DO_TIPO[achado.tipo].um} · cartão no quadro` : ROTULO_DO_TIPO[achado.tipo].um}</span>
      </span>
      {achado.onde === 'apelido' && <span className="pr-busca__trecho">Também chamado de {achado.apelido}</span>}
      {achado.trecho !== undefined && (
        <span className="pr-busca__trecho">
          {achado.trecho.antes}
          <mark>{achado.trecho.achado}</mark>
          {achado.trecho.depois}
        </span>
      )}
    </>
  )
}

export function BuscaGeral({ aoFechar }: { aoFechar: () => void }) {
  const verbetes = usePreludio((estado) => estado.verbetes)
  const ir = usePreludio((estado) => estado.ir)
  const [consulta, setConsulta] = useState('')
  const adiada = useDeferredValue(consulta)
  const entradas = useMemo(() => entradasDaBusca(verbetes), [verbetes])
  const achados = useMemo(() => buscar(entradas, adiada), [entradas, adiada])
  // O quadro aberto e os cartões dele, lidos uma vez ao abrir a busca (ela é modal: nada muda por baixo).
  const [quadro] = useState(quadroAberto)
  const [cartoes] = useState(() => {
    const porVerbete = new Map<string, string>()
    for (const { verbeteId, formaId } of quadro?.cartoes() ?? []) if (!porVerbete.has(verbeteId)) porVerbete.set(verbeteId, formaId)
    return porVerbete
  })
  const itens = useMemo((): Item[] => {
    if (quadro === null) return achados.map((achado) => ({ t: 'verbete', achado, podePor: false }))
    if (adiada.trim() === '') {
      const doQuadro: { verbete: Verbete; formaId: string }[] = []
      for (const [verbeteId, formaId] of cartoes) {
        const verbete = verbetes.get(verbeteId)
        if (verbete !== undefined) doQuadro.push({ verbete, formaId })
      }
      return doQuadro.sort((a, b) => compararTitulos(a.verbete.titulo, b.verbete.titulo)).map(({ verbete, formaId }) => ({ t: 'cartao', verbete, formaId, achado: null }))
    }
    const noQuadro: Item[] = []
    const fora: Item[] = []
    for (const achado of achados) {
      const formaId = cartoes.get(achado.id)
      const verbete = verbetes.get(achado.id)
      if (formaId !== undefined && verbete !== undefined) noQuadro.push({ t: 'cartao', verbete, formaId, achado })
      else fora.push({ t: 'verbete', achado, podePor: quadro.editavel && viraCartao(achado.tipo) })
    }
    return [...noQuadro, ...fora]
  }, [quadro, cartoes, achados, adiada, verbetes])
  const [ativo, setAtivo] = useState(0)
  const campo = useRef<HTMLInputElement>(null)
  const anterior = useRef<Element | null>(typeof document === 'undefined' ? null : document.activeElement)

  useEffect(() => {
    campo.current?.focus()
    const quemTinha = anterior.current
    return () => {
      if (quemTinha instanceof HTMLElement && quemTinha.isConnected) quemTinha.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => setAtivo(0), [adiada])

  useEffect(() => {
    document.getElementById(`pr-busca-${ativo}`)?.scrollIntoView({ block: 'nearest' })
  }, [ativo])

  const abrir = (item: Item | undefined, porNoQuadro = false) => {
    if (item === undefined) return
    if (item.t === 'cartao') {
      aoFechar()
      quadro?.irAoCartao(item.formaId)
      return
    }
    if (porNoQuadro) {
      if (!item.podePor) return
      aoFechar()
      quadro?.porNoQuadro(item.achado.id)
      return
    }
    const verbete = verbetes.get(item.achado.id)
    aoFechar()
    if (verbete !== undefined) ir(lugarDoVerbete(verbete, verbetes))
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    switch (evento.key) {
      case 'Escape':
        aoFechar()
        break
      case 'ArrowDown':
        setAtivo((atual) => (itens.length === 0 ? 0 : (atual + 1) % itens.length))
        break
      case 'ArrowUp':
        setAtivo((atual) => (itens.length === 0 ? 0 : (atual - 1 + itens.length) % itens.length))
        break
      case 'Enter':
        abrir(itens[ativo], evento.shiftKey)
        break
      case 'Tab':
        // O foco fica no campo: a lista se escolhe pelas setas.
        break
      default:
        return
    }
    evento.preventDefault()
    evento.stopPropagation()
  }

  const vazia = adiada.trim() === ''
  const primeiroDeFora = itens.findIndex((item) => item.t === 'verbete')
  const comGrupos = quadro !== null && itens.length > 0
  return (
    // O fundo das caixas do kit, na versão parada: a busca abre pelo teclado e abre sem animação.
    <div className="gr-dlg-fundo gr-dlg-fundo--parado pr-busca-fundo" onMouseDown={(evento) => evento.target === evento.currentTarget && aoFechar()}>
      <div className="pr-busca" role="dialog" aria-modal="true" aria-label="Buscar no Prelúdio" onKeyDown={aoTeclar}>
        <div className="pr-busca__cabeca">
          <svg className="pr-busca__lupa" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m13 13 4 4" />
          </svg>
          <input
            ref={campo}
            className="pr-busca__campo"
            role="combobox"
            aria-expanded={itens.length > 0}
            aria-controls={ID_DA_LISTA}
            aria-activedescendant={itens.length > 0 ? `pr-busca-${ativo}` : undefined}
            aria-autocomplete="list"
            aria-label={quadro === null ? 'Procurar no nome e no texto' : 'Procurar um cartão no quadro, ou no nome e no texto'}
            placeholder={quadro === null ? 'Procurar no nome e no texto…' : 'Procurar um cartão no quadro, ou no texto…'}
            value={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
          />
          <kbd className="gr-kbd">Esc</kbd>
        </div>
        {vazia && itens.length === 0 ? (
          <p className="pr-busca__dica">
            {quadro === null
              ? 'Procura no nome, nos apelidos e no texto inteiro dos verbetes e das páginas. Acento e maiúscula não importam.'
              : 'Este quadro ainda não tem cartões. Procure um verbete: Shift+Enter põe o cartão no meio do quadro.'}
          </p>
        ) : itens.length === 0 ? (
          <p className="pr-busca__dica" role="status">
            Nada com "{adiada.trim()}". Tente uma palavra só ou outro nome.
          </p>
        ) : (
          <ul id={ID_DA_LISTA} className="pr-busca__lista" role="listbox" aria-label={quadro === null ? 'Resultados' : `Cartões de ${quadro.nome || 'Quadro sem nome'} e verbetes`}>
            {itens.map((item, indice) => (
              <li key={chaveDoItem(item)} role="presentation" className="pr-busca__casca">
                {comGrupos && indice === 0 && item.t === 'cartao' && (
                  <span className="pr-busca__grupo" aria-hidden="true">
                    Neste quadro
                  </span>
                )}
                {comGrupos && indice === primeiroDeFora && (
                  <span className="pr-busca__grupo" aria-hidden="true">
                    No Prelúdio
                  </span>
                )}
                <div
                  id={`pr-busca-${indice}`}
                  role="option"
                  aria-selected={indice === ativo}
                  className="pr-busca__item"
                  onMouseMove={() => setAtivo(indice)}
                  onClick={(evento) => abrir(item, evento.shiftKey)}
                >
                  {item.t === 'cartao' ? <Resultado achado={item.achado ?? { titulo: item.verbete.titulo, tipo: item.verbete.tipo }} noQuadro /> : <Resultado achado={item.achado} />}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="pr-busca__rodape" aria-hidden="true">
          <span>
            <kbd className="gr-kbd">↑</kbd> <kbd className="gr-kbd">↓</kbd> escolhe
          </span>
          <span>
            <kbd className="gr-kbd">Enter</kbd> {quadro === null ? 'abre' : 'vai ao cartão ou abre'}
          </span>
          {quadro !== null && quadro.editavel && (
            <span>
              <kbd className="gr-kbd">Shift</kbd> <kbd className="gr-kbd">Enter</kbd> põe no quadro
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
