import { useState } from 'react'
import type { CondicaoPropria } from '../types/map'
import { CATALOGO_MAX, CONDICOES_POR_FICHA_MAX, simboloDaCondicaoPropria } from '../lib/condicoesProprias'
import { alcanceDaCondicao, tirarCondicaoDeTodasAsCenas, type AlcanceDaCondicao } from '../stores/condicoesNasCenas'
import { useCondicoesPropriasStore } from '../stores/condicoesPropriasStore'
import { useMapStore } from '../stores/mapStore'
import { EditorDaCondicao } from './condicoes/editor/EditorDaCondicao'
import { PastilhaDeCondicao } from './PastilhaDeCondicao'
import './CondicoesProprias.css'

function quantas(quantidade: number, uma: string, varias: string): string {
  return quantidade === 1 ? `1 ${uma}` : `${quantidade} ${varias}`
}

/** Onde a condição está marcada, em frase: "3 fichas, em 2 cenas". */
function ondeEsta({ fichas, cenas }: AlcanceDaCondicao): string {
  return `${quantas(fichas, 'ficha', 'fichas')}, em ${quantas(cenas, 'cena', 'cenas')}`
}

/** A cena que não abriu não muda: o aviso diz quantas ficaram de fora. `null` = todas abriram. */
function avisoDasCenasFechadas({ cenasFechadas }: AlcanceDaCondicao): string | null {
  if (cenasFechadas === 0) return null
  return cenasFechadas === 1
    ? '1 cena não abriu: as fichas dela ficam como estão.'
    : `${cenasFechadas} cenas não abriram: as fichas delas ficam como estão.`
}

/** O que o Salvar de uma edição alcança. */
function avisoDeEditar(alcance: AlcanceDaCondicao): string {
  if (alcance.fichas === 0) return 'Nenhuma ficha do mapa está com ela agora.'
  return `No mapa, ela está em ${ondeEsta(alcance)}. Salvar muda em ${alcance.fichas === 1 ? 'essa ficha também' : 'todas'}.`
}

/** O que o Apagar alcança. */
function avisoDeExcluir(alcance: AlcanceDaCondicao): string {
  if (alcance.fichas === 0) return 'Apagar tira da sua lista.'
  return `Apagar tira da sua lista e de ${ondeEsta(alcance)}.`
}

/** O que o editor diz a mais em "Onde ela aparece", aberto pelo lápis: o alcance nas cenas da aventura. */
function notaDoAlcance(alcance: AlcanceDaCondicao): string {
  return [avisoDeEditar(alcance), avisoDeExcluir(alcance), avisoDasCenasFechadas(alcance)].filter((frase): frase is string => frase !== null).join(' ')
}

/** O lápis do "editar", no traço dos ícones do painel. */
function Lapis() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  )
}

function Mais() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

type Edicao = { tipo: 'nova' } | { tipo: 'editar'; condicao: CondicaoPropria }

const AVISO_LISTA_CHEIA = `Sua lista já tem ${CATALOGO_MAX} condições. Exclua uma para criar outra.`
const AVISO_FICHA_CHEIA = `Esta ficha já tem ${CONDICOES_POR_FICHA_MAX} condições criadas. Tire uma para marcar outra.`

export interface CondicoesPropriasProps {
  /** A ficha selecionada. */
  tokenId: string
  /** As condições criadas que estão nela, já limpas (`condicoesPropriasOf`). */
  naFicha: readonly CondicaoPropria[]
  /** Classe do chip: a mesma das condições de fábrica do bloco onde estes entram. */
  classeDoChip: string
}

/**
 * CONDIÇÃO CRIADA PELO MESTRE, dentro do bloco "Condições" do token sem ficha: um chip
 * por condição da lista dele (o clique marca e desmarca no token, como nas de
 * fábrica; o lápis ao lado edita), o chip tracejado "Criar condição" e, aberto
 * por ele ou pelo lápis, o editor único da condição (rework das condições, D13:
 * o mesmo de Livros › Condições, com as peças, o prazo, o cartão e o boneco).
 *
 * Marcar passa pelo histórico do mapa (Ctrl+Z desfaz). Salvar e apagar valem
 * para TODAS as cenas da aventura aberta (`stores/condicoesNasCenas.ts`): o
 * editor diz quantas fichas levam a condição, em quantas cenas, e quantas cenas
 * não abriram e ficam de fora. A lista em si mora na pasta aberta, num
 * `condicoes.json` ao lado do arquivo das fichas; sem pasta (mapa solto), neste
 * computador (`stores/condicoesPropriasStore.ts`).
 *
 * Condição que veio dentro do mapa e não está na lista (mapa feito em outro
 * computador) também ganha chip: dá para tirar da ficha, e salvar pelo lápis a
 * traz para a lista.
 *
 * Os dois tetos avisam em frase, à vista: a ficha cheia (os chips que não dá
 * para marcar ficam apagados) e a lista cheia (o "Criar condição" diz por quê,
 * em vez de abrir um editor que não vai gravar).
 */
export function CondicoesProprias({ tokenId, naFicha, classeDoChip }: CondicoesPropriasProps) {
  const catalogo = useCondicoesPropriasStore((state) => state.catalogo)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [listaCheia, setListaCheia] = useState(false)
  const lista = [...catalogo, ...naFicha.filter((daFicha) => !catalogo.some((daLista) => daLista.id === daFicha.id))]
  const fichaCheia = naFicha.length >= CONDICOES_POR_FICHA_MAX

  const abrir = (proxima: Edicao | null) => {
    setListaCheia(false)
    setEdicao(proxima)
  }

  const criar = () => {
    if (catalogo.length >= CATALOGO_MAX) {
      abrir(null)
      setListaCheia(true)
    } else abrir({ tipo: 'nova' })
  }

  // Quem cria a condição no token quer vê-la no token: a nova já sai marcada. A editada o editor já
  // troca em todas as cenas (`trocarCondicaoEmTodasAsCenas`).
  const salvou = (condicao: CondicaoPropria, nova: boolean) => {
    if (nova) useMapStore.getState().alternarCondicaoPropria(tokenId, condicao)
  }

  const apagar = (condicao: CondicaoPropria) => {
    useCondicoesPropriasStore.getState().excluir(condicao.id)
    tirarCondicaoDeTodasAsCenas(condicao.id)
    abrir(null)
  }

  return (
    <>
      {lista.map((condicao) => {
        const marcada = naFicha.some((daFicha) => daFicha.id === condicao.id)
        const travada = !marcada && fichaCheia
        return (
          <span key={condicao.id} className="lb-cond-propria">
            <button
              type="button"
              className={classeDoChip}
              aria-pressed={marcada}
              disabled={travada}
              onClick={() => useMapStore.getState().alternarCondicaoPropria(tokenId, condicao)}
            >
              <PastilhaDeCondicao symbol={simboloDaCondicaoPropria(condicao)} />
              {condicao.nome}
            </button>
            <button
              type="button"
              className="lb-cond-propria__editar"
              aria-label={`Editar ${condicao.nome}`}
              title="Editar"
              aria-haspopup="dialog"
              onClick={() => abrir({ tipo: 'editar', condicao })}
            >
              <Lapis />
            </button>
          </span>
        )
      })}
      <button type="button" className={`${classeDoChip} gr-chip--mais lb-cond-criar`} aria-haspopup="dialog" onClick={criar}>
        <Mais />
        Criar condição
      </button>
      {fichaCheia && (
        <p className="gr-nota lb-cond-aviso" role="status">
          {AVISO_FICHA_CHEIA}
        </p>
      )}
      {listaCheia && (
        <p className="gr-nota lb-cond-aviso" role="alert">
          {AVISO_LISTA_CHEIA}
        </p>
      )}
      {edicao !== null && (
        <EditorDaCondicao
          key={edicao.tipo === 'nova' ? 'nova' : edicao.condicao.id}
          abertura={edicao}
          nota={edicao.tipo === 'editar' ? notaDoAlcance(alcanceDaCondicao(edicao.condicao.id)) : undefined}
          onFechar={() => abrir(null)}
          onSalvou={salvou}
          onApagar={edicao.tipo === 'editar' ? apagar : undefined}
        />
      )}
    </>
  )
}
