import { useId, useState, type FormEvent } from 'react'
import type { CondicaoPropria, MapData } from '../types/map'
import {
  CATALOGO_MAX,
  CONDICOES_POR_FICHA_MAX,
  CORES_DE_CONDICAO,
  SIMBOLO_NOMES,
  SIMBOLO_ORDEM,
  cortarNomeDeCondicao,
  criarCondicaoPropria,
  ehSimboloDeCondicao,
  lerCondicaoPropria,
  limparNomeDeCondicao,
  limparSimboloDigitado,
  simboloDaCondicaoPropria,
  type RascunhoDeCondicao,
  type SimboloDeCondicao,
} from '../lib/condicoesProprias'
import { conditionBadgeLayout } from '../lib/tokenConditions'
import { tokenSizeInSquares } from '../lib/tokenSize'
import { alcanceDaCondicao, tirarCondicaoDeTodasAsCenas, trocarCondicaoEmTodasAsCenas, type AlcanceDaCondicao } from '../stores/condicoesNasCenas'
import { useCondicoesPropriasStore } from '../stores/condicoesPropriasStore'
import { useMapStore } from '../stores/mapStore'
import { Acoes, Botao } from './grimorio/Botao'
import { CampoCor } from './grimorio/CampoCor'
import { andarPelosRadios } from './grimorio/comum'
import { PastilhaDeCondicao } from './PastilhaDeCondicao'
import './CondicoesProprias.css'

const DESENHO_INICIAL: SimboloDeCondicao = 'chama'
/** A prévia nunca passa disto, em px: grade enorme não estoura o formulário. */
const PREVIA_MAX = 64

/**
 * O diâmetro da pastilha em cima DESTA ficha com o mapa a 100% de zoom, em px:
 * a mesma conta do mapa (`conditionBadgeLayout`), para a prévia do formulário
 * sair do tamanho que o mestre vai ver na mesa.
 */
function tamanhoDaPastilhaNoMapa(map: Pick<MapData, 'grid' | 'tokens'>, tokenId: string): number {
  const raioDaFicha = (map.grid * tokenSizeInSquares(map.tokens.find((token) => token.id === tokenId))) / 2
  return Math.min(Math.round(conditionBadgeLayout([tokenId], raioDaFicha, map.grid).radius * 2), PREVIA_MAX)
}

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
  if (alcance.fichas === 0) return 'Nenhuma ficha está com ela agora.'
  return `Ela está em ${ondeEsta(alcance)}. Salvar muda em ${alcance.fichas === 1 ? 'essa ficha também' : 'todas'}.`
}

/** O que o "Excluir de vez" alcança. */
function avisoDeExcluir(alcance: AlcanceDaCondicao): string {
  if (alcance.fichas === 0) return 'Ela sai da sua lista. Nenhuma ficha está com ela.'
  return `Ela sai da sua lista e de ${ondeEsta(alcance)}.`
}

interface FormDaCondicaoProps {
  /** `null` = condição nova. */
  inicial: CondicaoPropria | null
  /** Por que a última tentativa de salvar não gravou; `null` = nada a dizer. */
  aviso: string | null
  /** Diâmetro da pastilha no mapa a 100%, em px: o tamanho da prévia. */
  tamanhoNoMapa: number
  onSalvar: (rascunho: RascunhoDeCondicao) => void
  /** Só ao editar. */
  onExcluir?: () => void
  onFechar: () => void
}

/**
 * Nome, símbolo e cor. Enter no nome salva, Esc fecha sem gravar. O símbolo é
 * um desenho da biblioteca OU o que o mestre digita (uma letra, um número, um
 * emoji): digitar tira a marca do desenho, e escolher um desenho limpa o que
 * foi digitado. A prévia é a pastilha do tamanho que sai em cima da ficha,
 * para ele e para quem joga.
 *
 * Ao editar, o formulário diz quantas fichas levam a condição, em quantas
 * cenas da aventura (o Salvar e o Excluir alcançam todas), e quantas cenas não
 * abriram e ficam de fora. A conta é refeita a cada desenho do formulário: vale
 * a de agora quando o mestre clica em "Excluir".
 */
function FormDaCondicao({ inicial, aviso, tamanhoNoMapa, onSalvar, onExcluir, onFechar }: FormDaCondicaoProps) {
  const [nome, setNome] = useState(inicial === null ? '' : inicial.nome)
  const [cor, setCor] = useState(inicial === null ? CORES_DE_CONDICAO[0].valor : inicial.cor)
  const [simbolo, setSimbolo] = useState<SimboloDeCondicao>(
    inicial !== null && ehSimboloDeCondicao(inicial.simbolo) ? inicial.simbolo : DESENHO_INICIAL,
  )
  const [texto, setTexto] = useState(inicial === null ? '' : limparSimboloDigitado(inicial.texto))
  const [confirmando, setConfirmando] = useState(false)
  const nomeId = useId()
  const simboloId = useId()
  const textoId = useId()
  const ajudaId = useId()
  const nomeLimpo = limparNomeDeCondicao(nome)
  const digitado = texto !== ''
  const foraDaPaleta = !CORES_DE_CONDICAO.some((opcao) => opcao.valor === cor.toLowerCase())
  const rascunho: RascunhoDeCondicao = digitado ? { nome: nomeLimpo, cor, simbolo, texto } : { nome: nomeLimpo, cor, simbolo }
  const alcance = inicial === null ? null : alcanceDaCondicao(inicial.id)
  const cenasFechadas = alcance === null ? null : avisoDasCenasFechadas(alcance)

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (nomeLimpo !== '') onSalvar(rascunho)
  }

  return (
    <form
      className="lb-cond-form"
      aria-label={inicial === null ? 'Criar condição' : `Editar ${inicial.nome}`}
      onSubmit={enviar}
      onKeyDown={(evento) => {
        if (evento.key !== 'Escape') return
        evento.stopPropagation()
        onFechar()
      }}
    >
      <div className="gr-campo">
        <label className="gr-campo__rot" htmlFor={nomeId}>
          Nome
        </label>
        {/* Sem `maxLength`, como o símbolo: ele conta unidades de código e cortaria um emoji no meio. Quem corta é a limpeza, entre caracteres. */}
        <input
          id={nomeId}
          className="gr-entrada"
          value={nome}
          placeholder="Queimando"
          autoComplete="off"
          autoFocus
          onChange={(evento) => setNome(cortarNomeDeCondicao(evento.currentTarget.value))}
        />
      </div>
      <div className="gr-campo">
        <span className="gr-campo__rot" id={simboloId}>
          Símbolo
        </span>
        <div className="lb-cond-form__desenhos" role="radiogroup" aria-labelledby={simboloId} onKeyDown={andarPelosRadios}>
          {SIMBOLO_ORDEM.map((opcao) => (
            <button
              key={opcao}
              type="button"
              role="radio"
              className="lb-cond-form__desenho"
              aria-checked={!digitado && opcao === simbolo}
              aria-label={SIMBOLO_NOMES[opcao]}
              title={SIMBOLO_NOMES[opcao]}
              tabIndex={opcao === simbolo ? 0 : -1}
              onClick={() => {
                setSimbolo(opcao)
                setTexto('')
              }}
            >
              <PastilhaDeCondicao symbol={simboloDaCondicaoPropria({ cor, simbolo: opcao })} tamanho={24} />
            </button>
          ))}
        </div>
        <div className="lb-cond-form__digitar">
          <label className="gr-campo__rot" htmlFor={textoId}>
            Ou digite
          </label>
          {/* Sem `maxLength`: ele conta unidades de código e cortaria um emoji no meio. Quem corta é a limpeza, por caractere visto. */}
          <input
            id={textoId}
            className="gr-entrada lb-cond-form__digitado"
            value={texto}
            placeholder="A"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby={ajudaId}
            data-ativo={digitado ? '' : undefined}
            onChange={(evento) => setTexto(limparSimboloDigitado(evento.currentTarget.value))}
          />
          <span className="gr-nota" id={ajudaId}>
            Letra, número ou emoji. Até 2.
          </span>
        </div>
      </div>
      <CampoCor
        rotulo="Cor"
        opcoes={CORES_DE_CONDICAO}
        valor={cor}
        onChange={setCor}
        extra={
          <input
            type="color"
            className={foraDaPaleta ? 'gr-cor lb-pin-outra-cor lb-pin-outra-cor--marcada' : 'gr-cor lb-pin-outra-cor'}
            aria-label="Outra cor…"
            title="Outra cor…"
            value={cor}
            onChange={(evento) => setCor(evento.currentTarget.value)}
          />
        }
      />
      <div className="lb-cond-form__previa">
        <PastilhaDeCondicao symbol={simboloDaCondicaoPropria(rascunho)} tamanho={tamanhoNoMapa} />
        <p className="gr-nota">Assim ela aparece sobre a ficha, com o mapa a 100%.</p>
      </div>
      {alcance !== null && !confirmando && (
        <p className="gr-nota">
          {avisoDeEditar(alcance)}
          {cenasFechadas !== null && ` ${cenasFechadas}`}
        </p>
      )}
      <Acoes>
        <Botao variante="primario" tamanho="p" tipo="submit" disabled={nomeLimpo === ''}>
          {inicial === null ? 'Criar' : 'Salvar'}
        </Botao>
        <Botao variante="fantasma" tamanho="p" onClick={onFechar}>
          Cancelar
        </Botao>
        {onExcluir !== undefined && (
          <Botao variante="perigo" tamanho="p" onClick={() => (confirmando ? onExcluir() : setConfirmando(true))}>
            {confirmando ? 'Excluir de vez' : 'Excluir'}
          </Botao>
        )}
      </Acoes>
      {confirmando && alcance !== null && (
        <p className="gr-nota" role="status">
          {avisoDeExcluir(alcance)}
          {cenasFechadas !== null && ` ${cenasFechadas}`} Clique em "Excluir de vez" para confirmar.
        </p>
      )}
      {aviso !== null && (
        <p className="gr-nota" role="alert">
          {aviso}
        </p>
      )}
    </form>
  )
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
const AVISO_NAO_GRAVOU = 'Não deu para salvar. Confira o nome e a cor.'
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
 * CONDIÇÃO CRIADA PELO MESTRE, dentro do bloco "Condições" da ficha: um chip
 * por condição da lista dele (o clique marca e desmarca na ficha, como nas de
 * fábrica; o lápis ao lado edita), o chip tracejado "Criar condição" e, aberto
 * por ele ou pelo lápis, o formulário.
 *
 * Marcar passa pelo histórico do mapa (Ctrl+Z desfaz). Editar e excluir valem
 * para TODAS as cenas da aventura aberta (`stores/condicoesNasCenas.ts`): na
 * cena aberta o Ctrl+Z desfaz o que mudou nas fichas; nas de fundo, não. A
 * lista em si mora na pasta aberta, num `condicoes.json` ao lado do arquivo
 * das fichas; sem pasta (mapa solto), neste computador
 * (`stores/condicoesPropriasStore.ts`).
 *
 * Condição que veio dentro do mapa e não está na lista (mapa feito em outro
 * computador) também ganha chip: dá para tirar da ficha, e salvar pelo lápis a
 * traz para a lista.
 *
 * Os dois tetos avisam em frase, à vista: a ficha cheia (os chips que não dá
 * para marcar ficam apagados) e a lista cheia (o "Criar condição" diz por quê,
 * em vez de abrir um formulário que não vai gravar).
 */
export function CondicoesProprias({ tokenId, naFicha, classeDoChip }: CondicoesPropriasProps) {
  const catalogo = useCondicoesPropriasStore((state) => state.catalogo)
  const tamanhoNoMapa = useMapStore((state) => tamanhoDaPastilhaNoMapa(state.map, tokenId))
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [listaCheia, setListaCheia] = useState(false)
  const lista = [...catalogo, ...naFicha.filter((daFicha) => !catalogo.some((daLista) => daLista.id === daFicha.id))]
  const fichaCheia = naFicha.length >= CONDICOES_POR_FICHA_MAX
  const criando = edicao !== null && edicao.tipo === 'nova'

  const abrir = (proxima: Edicao | null) => {
    setAviso(null)
    setListaCheia(false)
    setEdicao(proxima)
  }

  const criar = () => {
    if (criando) abrir(null)
    else if (catalogo.length >= CATALOGO_MAX) {
      abrir(null)
      setListaCheia(true)
    } else abrir({ tipo: 'nova' })
  }

  const salvar = (rascunho: RascunhoDeCondicao) => {
    if (edicao === null) return
    const condicao = edicao.tipo === 'nova' ? criarCondicaoPropria(rascunho) : lerCondicaoPropria({ ...rascunho, id: edicao.condicao.id })
    if (condicao === null) {
      setAviso(AVISO_NAO_GRAVOU)
      return
    }
    if (!useCondicoesPropriasStore.getState().salvar(condicao)) {
      setAviso(AVISO_LISTA_CHEIA)
      return
    }
    // Quem cria a condição na ficha quer vê-la na ficha: a nova já sai marcada.
    if (edicao.tipo === 'nova') useMapStore.getState().alternarCondicaoPropria(tokenId, condicao)
    else trocarCondicaoEmTodasAsCenas(condicao)
    abrir(null)
  }

  const excluir = (id: string) => {
    useCondicoesPropriasStore.getState().excluir(id)
    tirarCondicaoDeTodasAsCenas(id)
    abrir(null)
  }

  return (
    <>
      {lista.map((condicao) => {
        const marcada = naFicha.some((daFicha) => daFicha.id === condicao.id)
        const travada = !marcada && fichaCheia
        const editando = edicao !== null && edicao.tipo === 'editar' && edicao.condicao.id === condicao.id
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
              aria-expanded={editando}
              onClick={() => abrir(editando ? null : { tipo: 'editar', condicao })}
            >
              <Lapis />
            </button>
          </span>
        )
      })}
      <button type="button" className={`${classeDoChip} gr-chip--mais lb-cond-criar`} aria-expanded={criando} onClick={criar}>
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
        <FormDaCondicao
          key={edicao.tipo === 'nova' ? 'nova' : edicao.condicao.id}
          inicial={edicao.tipo === 'nova' ? null : edicao.condicao}
          aviso={aviso}
          tamanhoNoMapa={tamanhoNoMapa}
          onSalvar={salvar}
          onExcluir={edicao.tipo === 'nova' ? undefined : () => excluir(edicao.condicao.id)}
          onFechar={() => abrir(null)}
        />
      )}
    </>
  )
}
