import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import type { ItemDoCatalogo } from '../../../lib/acervoDeItens'
import { normalizarParaBusca } from '../../../lib/buscaNoLivro'
import { moverNaGrade } from '../../../lib/moverNaGrade'
import { useAcervoDeItensStore } from '../../../stores/acervoDeItensStore'
import { ImagemOuIniciais } from '../../FichaPecas'
import { Desenho, Icone, type DesenhoDoConteudo } from './DesenhosDoConteudo'

/*
 * A ESCOLHA DO ACERVO no conteúdo do baú (redesign de 21/11/2026, decisões 3,
 * 4, 5 e 8 de docs/design/bau/NOTAS.md): a grade de miniaturas na ordem do
 * acervo, a busca sem acento por nome e categoria, a faixa de categorias e a
 * prévia da peça marcada. O foco mora na busca e o teclado é o do seletor de
 * emoji: ← → uma peça, ↑ ↓ uma linha, PageUp/PageDown três linhas, Enter põe
 * a marcada, Esc fecha. Pôr não fecha: a peça ganha o selo ×N e a busca fica
 * com o texto selecionado.
 */

/** O selo da peça não passa de três dígitos. */
const SELO_MAX = 999
/** PageUp/PageDown andam três linhas. */
const LINHAS_DO_SALTO = 3

interface ItemAchavel {
  item: ItemDoCatalogo
  nome: string
  categoria: string
}

export interface EscolhaDoAcervoProps {
  /** Quantos de cada item do acervo já estão dentro, pelo id. */
  quantos: ReadonlyMap<string, number>
  /** O objeto já tem o teto de tipos: só dá para somar nos que estão. */
  cheioDeTipos: boolean
  tiposMax: number
  /** "no baú", "na caixa", "no barril". */
  noObjeto: string
  /** "põe no baú", na dica do Enter. */
  poe: string
  /** O desenho do objeto, no acervo vazio. */
  desenho: DesenhoDoConteudo
  /** O item que acabou de entrar (o selo dele dá o passo de escala); `vez` muda a cada pôr. */
  ultimoPosto: { id: string; vez: number } | null
  /** A busca, para o "+ Item do acervo" voltar a ela com a escolha aberta. */
  buscaRef: RefObject<HTMLInputElement | null>
  aoPor: (item: ItemDoCatalogo) => void
  aoFechar: () => void
  anunciar: (texto: string) => void
}

export function EscolhaDoAcervo({ quantos, cheioDeTipos, tiposMax, noObjeto, poe, desenho, ultimoPosto, buscaRef, aoPor, aoFechar, anunciar }: EscolhaDoAcervoProps) {
  const itens = useAcervoDeItensStore((state) => state.itens)
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [ativo, setAtivo] = useState(0)
  const [ponta, setPonta] = useState('')
  const gradeRef = useRef<HTMLUListElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)
  const prontoRef = useRef<HTMLButtonElement>(null)
  // Rolar até a marcada só quando quem andou foi o teclado: o ponteiro já está em cima dela.
  const rolarAoMarcar = useRef(false)
  const baseId = useId()
  const gradeId = `${baseId}-grade`
  const opcaoId = (indice: number) => `${baseId}-op-${indice}`

  useEffect(() => {
    void useAcervoDeItensStore.getState().recarregar()
    const campo = buscaRef.current
    if (campo !== null) campo.focus()
    else prontoRef.current?.focus()
    // Só ao abrir: depois o foco é de quem usa.
  }, [buscaRef])

  const achaveis = useMemo<ItemAchavel[]>(() => itens.map((item) => ({ item, nome: normalizarParaBusca(item.nome), categoria: normalizarParaBusca(item.categoria) })), [itens])
  const categorias = useMemo(() => {
    const vistas: string[] = []
    for (const item of itens) if (item.categoria !== '' && !vistas.includes(item.categoria)) vistas.push(item.categoria)
    return vistas
  }, [itens])
  // A categoria que sumiu do acervo (o mestre apagou o último item dela) volta para "Todos".
  const categoriaValida = categoria === '' || categorias.includes(categoria) ? categoria : ''
  const chave = normalizarParaBusca(busca)
  const achados = useMemo(
    () => achaveis.filter((achavel) => (categoriaValida === '' || achavel.item.categoria === categoriaValida) && (chave === '' || achavel.nome.includes(chave) || achavel.categoria.includes(chave))).map((achavel) => achavel.item),
    [achaveis, categoriaValida, chave],
  )
  const marcado = achados.length === 0 ? -1 : Math.min(ativo, achados.length - 1)
  const itemMarcado = marcado < 0 ? undefined : achados[marcado]

  useLayoutEffect(() => {
    if (!rolarAoMarcar.current || marcado < 0) return
    rolarAoMarcar.current = false
    gradeRef.current?.children[marcado]?.scrollIntoView({ block: 'nearest' })
  }, [marcado])

  const medirPontas = useCallback(() => {
    const chips = chipsRef.current
    if (chips === null) return
    const esq = chips.scrollLeft > 2
    const dir = chips.scrollLeft + chips.clientWidth < chips.scrollWidth - 2
    setPonta([esq ? 'esq' : '', dir ? 'dir' : ''].filter((parte) => parte !== '').join(' '))
  }, [])
  useLayoutEffect(medirPontas, [medirPontas, categorias])

  // A roda do mouse rola a faixa de lado. O ouvinte não é passivo (precisa do preventDefault), e fica só na faixa.
  useEffect(() => {
    const chips = chipsRef.current
    if (chips === null) return
    const rodaDeLado = (evento: WheelEvent) => {
      if (Math.abs(evento.deltaX) > Math.abs(evento.deltaY) || chips.scrollWidth <= chips.clientWidth) return
      evento.preventDefault()
      chips.scrollLeft += evento.deltaY
    }
    chips.addEventListener('wheel', rodaDeLado, { passive: false })
    return () => chips.removeEventListener('wheel', rodaDeLado)
  }, [itens.length])

  const colunas = () => {
    const grade = gradeRef.current
    if (grade === null) return 1
    return Math.max(1, getComputedStyle(grade).gridTemplateColumns.split(' ').filter((parte) => parte !== '').length)
  }

  const por = (item: ItemDoCatalogo) => {
    if ((quantos.get(item.id) ?? 0) === 0 && cheioDeTipos) {
      anunciar(`Já tem ${tiposMax} tipos de item ${noObjeto}, o máximo.`)
      return
    }
    aoPor(item)
  }

  const escolherCategoria = (nova: string, focar: boolean) => {
    setCategoria(nova)
    setAtivo(0)
    const chip = chipsRef.current?.querySelector<HTMLButtonElement>(`[data-categoria="${CSS.escape(nova)}"]`)
    if (chip === null || chip === undefined) return
    chip.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    if (focar) chip.focus()
  }

  const aoTeclarNaBusca = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'Escape') {
      evento.preventDefault()
      evento.stopPropagation()
      aoFechar()
      return
    }
    if (evento.key === 'Enter') {
      evento.preventDefault()
      if (itemMarcado === undefined) return
      por(itemMarcado)
      // Digitar de novo troca o termo; Enter de novo soma mais um.
      evento.currentTarget.select()
      return
    }
    const cols = colunas()
    const passos: Partial<Record<string, [number, boolean]>> = {
      ArrowRight: [1, false],
      ArrowLeft: [-1, false],
      ArrowDown: [cols, true],
      ArrowUp: [-cols, true],
      PageDown: [cols * LINHAS_DO_SALTO, true],
      PageUp: [-cols * LINHAS_DO_SALTO, true],
    }
    const passo = passos[evento.key]
    if (passo === undefined || achados.length === 0) return
    evento.preventDefault()
    rolarAoMarcar.current = true
    setAtivo(moverNaGrade(marcado, passo[0], achados.length, cols, passo[1]))
  }

  const aoTeclarNoChip = (evento: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const todas = ['', ...categorias]
    const destino = evento.key === 'ArrowRight' ? indice + 1 : evento.key === 'ArrowLeft' ? indice - 1 : evento.key === 'Home' ? 0 : evento.key === 'End' ? todas.length - 1 : null
    if (destino === null) return
    evento.preventDefault()
    escolherCategoria(todas[Math.max(0, Math.min(todas.length - 1, destino))] ?? '', true)
  }

  const fecharComEsc = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key !== 'Escape') return
    evento.preventDefault()
    evento.stopPropagation()
    aoFechar()
  }

  const vazio = itens.length === 0
  return (
    <div className="lb-conteudo__escolha" role="dialog" aria-label="Itens do acervo" onKeyDown={fecharComEsc}>
      {!vazio && (
        <>
          <div className="lb-conteudo__busca-casa">
            <Icone nome="lupa" />
            <input
              ref={buscaRef}
              className="lb-conteudo__procura"
              type="search"
              placeholder="Procurar no acervo"
              aria-label="Procurar no acervo"
              aria-controls={gradeId}
              aria-activedescendant={marcado < 0 ? undefined : opcaoId(marcado)}
              autoComplete="off"
              spellCheck={false}
              value={busca}
              onChange={(evento) => {
                setBusca(evento.target.value)
                setAtivo(0)
              }}
              onKeyDown={aoTeclarNaBusca}
            />
          </div>
          <div ref={chipsRef} className="lb-conteudo__chips" role="radiogroup" aria-label="Categoria" data-ponta={ponta} onScroll={medirPontas}>
            {['', ...categorias].map((cat, indice) => {
              const marcada = cat === categoriaValida
              return (
                <button
                  key={`c:${cat}`}
                  type="button"
                  className="lb-conteudo__chip"
                  role="radio"
                  aria-checked={marcada}
                  tabIndex={marcada ? 0 : -1}
                  data-categoria={cat}
                  onClick={() => escolherCategoria(cat, true)}
                  onKeyDown={(evento) => aoTeclarNoChip(evento, indice)}
                >
                  {cat === '' ? 'Todos' : cat}
                </button>
              )
            })}
          </div>
        </>
      )}
      {vazio ? (
        <div className="lb-conteudo__escolha-vazia">
          <span className="lb-conteudo__vaga lb-conteudo__vaga--vazia" aria-hidden="true">
            <Desenho nome={desenho} />
          </span>
          <b>O acervo de itens está vazio</b>
          <span>Crie itens na aba Acervo do livro; eles aparecem aqui com a miniatura.</span>
        </div>
      ) : achados.length === 0 ? (
        <SemAchados
          busca={busca.trim()}
          categoria={categoriaValida}
          emOutras={categoriaValida !== '' && chave !== '' && achaveis.some((achavel) => achavel.nome.includes(chave))}
          aoLimpar={() => {
            setBusca('')
            setAtivo(0)
            buscaRef.current?.focus()
          }}
          aoTodas={() => {
            escolherCategoria('', false)
            buscaRef.current?.focus()
          }}
        />
      ) : (
        <>
          <ul ref={gradeRef} id={gradeId} className="lb-conteudo__grade" role="listbox" aria-label="Itens achados">
            {achados.map((item, indice) => {
              const dentro = quantos.get(item.id) ?? 0
              const travada = dentro === 0 && cheioDeTipos
              const rotulo = `${item.nome}${item.categoria !== '' ? `, ${item.categoria}` : ''}${dentro > 0 ? `, ${dentro} ${noObjeto}` : ''}`
              const recemPosto = ultimoPosto !== null && ultimoPosto.id === item.id
              return (
                <li
                  key={item.id}
                  id={opcaoId(indice)}
                  role="option"
                  className="lb-conteudo__peca lb-conteudo__achado"
                  aria-selected={indice === marcado}
                  aria-disabled={travada || undefined}
                  aria-label={rotulo}
                  // A peça não rouba o foco da busca: o teclado continua lá.
                  onMouseDown={(evento) => evento.preventDefault()}
                  onPointerMove={(evento) => {
                    if (evento.pointerType === 'mouse' && indice !== marcado) setAtivo(indice)
                  }}
                  onClick={() => {
                    setAtivo(indice)
                    por(item)
                  }}
                >
                  <span className="lb-conteudo__vaga" aria-hidden="true">
                    <ImagemOuIniciais imagem={item.imagem} nome={item.nome} />
                  </span>
                  {dentro > 0 && (
                    <span key={recemPosto ? `selo-${ultimoPosto.vez}` : 'selo'} className={`lb-conteudo__selo${recemPosto ? ' e-conta' : ''}`} aria-hidden="true">
                      ×{dentro > SELO_MAX ? `${SELO_MAX}+` : dentro}
                    </span>
                  )}
                  <span className="lb-conteudo__peca-nome">{item.nome}</span>
                </li>
              )
            })}
          </ul>
          {itemMarcado !== undefined && <Previa item={itemMarcado} dentro={quantos.get(itemMarcado.id) ?? 0} cheioDeTipos={cheioDeTipos} tiposMax={tiposMax} noObjeto={noObjeto} />}
        </>
      )}
      <div className="lb-conteudo__escolha-pe">
        {!vazio && (
          <>
            <span>
              <kbd>Enter</kbd> {poe}
            </span>
            <span>
              <kbd>Esc</kbd> fecha
            </span>
          </>
        )}
        <button ref={prontoRef} type="button" className="lb-conteudo__bt lb-conteudo__bt--pe" onClick={aoFechar}>
          Pronto
        </button>
      </div>
    </div>
  )
}

/** O nome inteiro da peça marcada (a peça corta em duas linhas), a categoria e quantos já estão dentro. */
function Previa({ item, dentro, cheioDeTipos, tiposMax, noObjeto }: { item: ItemDoCatalogo; dentro: number; cheioDeTipos: boolean; tiposMax: number; noObjeto: string }) {
  return (
    <div className="lb-conteudo__previa" aria-hidden="true">
      <span className="lb-conteudo__previa-nome" title={item.nome}>
        {item.nome}
      </span>
      <span className="lb-conteudo__previa-conta">{dentro > 0 ? `${dentro.toLocaleString('pt-BR')} ${noObjeto}` : ''}</span>
      <span className="lb-conteudo__previa-cat">{item.categoria === '' ? 'Sem categoria' : item.categoria}</span>
      {dentro === 0 && cheioDeTipos && <span className="lb-conteudo__previa-aviso">Já tem {tiposMax} tipos de item, o máximo. Dá para somar nos que já estão.</span>}
    </div>
  )
}

function SemAchados({ busca, categoria, emOutras, aoLimpar, aoTodas }: { busca: string; categoria: string; emOutras: boolean; aoLimpar: () => void; aoTodas: () => void }) {
  return (
    <div className="lb-conteudo__escolha-vazia" role="status">
      <b>
        Nada com “{busca}”{categoria !== '' ? ` em ${categoria}` : ''}
      </b>
      {emOutras ? (
        <button type="button" className="lb-conteudo__link" onClick={aoTodas}>
          Procurar em todas as categorias
        </button>
      ) : (
        <button type="button" className="lb-conteudo__link" onClick={aoLimpar}>
          Limpar a busca
        </button>
      )}
    </div>
  )
}
