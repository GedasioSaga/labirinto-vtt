import { useId, useState, type FormEvent } from 'react'
import type { CondicaoPropria } from '../types/map'
import {
  CATALOGO_MAX,
  CONDICAO_NOME_MAX,
  CONDICOES_POR_FICHA_MAX,
  CORES_DE_CONDICAO,
  SIMBOLO_NOMES,
  SIMBOLO_ORDEM,
  criarCondicaoPropria,
  ehSimboloDeCondicao,
  lerCondicaoPropria,
  limparNomeDeCondicao,
  simboloDaCondicaoPropria,
  type RascunhoDeCondicao,
  type SimboloDeCondicao,
} from '../lib/condicoesProprias'
import {
  CONDITION_GLYPH_FRACTION,
  CONDITION_GLYPH_STROKE_FRACTION,
  CONDITION_INK,
  CONDITION_OUTLINE_FRACTION,
  type ConditionSymbol,
  type ConditionSymbolPoint,
} from '../lib/tokenConditions'
import { useCondicoesPropriasStore } from '../stores/condicoesPropriasStore'
import { useMapStore } from '../stores/mapStore'
import { Acoes, Botao } from './grimorio/Botao'
import { CampoCor } from './grimorio/CampoCor'
import { andarPelosRadios } from './grimorio/comum'
import './CondicoesProprias.css'

/** Centro e raio da pastilha no `viewBox` de 24: sobra 1 unidade para o contorno não ser cortado na borda. */
const CENTRO = 12
const RAIO = 10.5

/**
 * Uma pastilha de condição como SVG — a mesma geometria que
 * `pixi/drawTokenConditions.ts` desenha em cima da ficha, lida da mesma fonte
 * (`ConditionSymbol`) e nas mesmas proporções: o botão mostra a marca que vai
 * sair no mapa. Serve às cinco de fábrica e às criadas pelo mestre.
 *
 * Decorativa (`aria-hidden`): quem carrega o nome é o texto ou o rótulo do botão.
 */
export function PastilhaDeCondicao({ symbol, tamanho = 18 }: { symbol: ConditionSymbol; tamanho?: number }) {
  const scale = RAIO * CONDITION_GLYPH_FRACTION
  const width = RAIO * CONDITION_GLYPH_STROKE_FRACTION
  const tinta = symbol.ink ?? CONDITION_INK
  const ponto = (p: ConditionSymbolPoint): string => `${(CENTRO + p.x * scale).toFixed(2)},${(CENTRO + p.y * scale).toFixed(2)}`
  return (
    <svg className="lb-token-condition__badge" width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx={CENTRO} cy={CENTRO} r={RAIO} fill={symbol.fill} stroke={CONDITION_INK} strokeWidth={RAIO * CONDITION_OUTLINE_FRACTION} />
      {(symbol.solids ?? []).map((solid, i) => (
        <polygon key={`cheio-${i}`} points={solid.map(ponto).join(' ')} fill={tinta} />
      ))}
      {symbol.strokes.map((stroke, i) => {
        const points = stroke.points.map(ponto).join(' ')
        return stroke.closed === true ? (
          <polygon key={`traco-${i}`} points={points} fill="none" stroke={tinta} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <polyline key={`traco-${i}`} points={points} fill="none" stroke={tinta} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
        )
      })}
      {(symbol.dots ?? []).map((dot, i) => (
        <circle
          key={`ponto-${i}`}
          cx={CENTRO + dot.x * scale}
          cy={CENTRO + dot.y * scale}
          r={dot.r * scale}
          fill={dot.hole === true ? symbol.fill : tinta}
        />
      ))}
    </svg>
  )
}

const DESENHO_INICIAL: SimboloDeCondicao = 'chama'

interface FormDaCondicaoProps {
  /** `null` = condição nova. */
  inicial: CondicaoPropria | null
  /** Por que a última tentativa de salvar não gravou; `null` = nada a dizer. */
  aviso: string | null
  onSalvar: (rascunho: RascunhoDeCondicao) => void
  /** Só ao editar. */
  onExcluir?: () => void
  onFechar: () => void
}

/**
 * Nome, desenho e cor. Enter no nome salva, Esc fecha sem gravar. Os desenhos
 * aparecem já na cor escolhida: o que o mestre vê aqui é a pastilha que sai em
 * cima da ficha, para ele e para quem joga.
 */
function FormDaCondicao({ inicial, aviso, onSalvar, onExcluir, onFechar }: FormDaCondicaoProps) {
  const [nome, setNome] = useState(inicial === null ? '' : inicial.nome)
  const [cor, setCor] = useState(inicial === null ? CORES_DE_CONDICAO[0].valor : inicial.cor)
  const [simbolo, setSimbolo] = useState<SimboloDeCondicao>(
    inicial !== null && ehSimboloDeCondicao(inicial.simbolo) ? inicial.simbolo : DESENHO_INICIAL,
  )
  const [confirmando, setConfirmando] = useState(false)
  const nomeId = useId()
  const desenhoId = useId()
  const nomeLimpo = limparNomeDeCondicao(nome)
  const foraDaPaleta = !CORES_DE_CONDICAO.some((opcao) => opcao.valor === cor.toLowerCase())

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (nomeLimpo !== '') onSalvar({ nome: nomeLimpo, cor, simbolo })
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
        <input
          id={nomeId}
          className="gr-entrada"
          value={nome}
          maxLength={CONDICAO_NOME_MAX}
          placeholder="Queimando"
          autoComplete="off"
          autoFocus
          onChange={(evento) => setNome(evento.currentTarget.value)}
        />
      </div>
      <div className="gr-campo">
        <span className="gr-campo__rot" id={desenhoId}>
          Desenho
        </span>
        <div className="lb-cond-form__desenhos" role="radiogroup" aria-labelledby={desenhoId} onKeyDown={andarPelosRadios}>
          {SIMBOLO_ORDEM.map((opcao) => (
            <button
              key={opcao}
              type="button"
              role="radio"
              className="lb-cond-form__desenho"
              aria-checked={opcao === simbolo}
              aria-label={SIMBOLO_NOMES[opcao]}
              title={SIMBOLO_NOMES[opcao]}
              tabIndex={opcao === simbolo ? 0 : -1}
              onClick={() => setSimbolo(opcao)}
            >
              <PastilhaDeCondicao symbol={simboloDaCondicaoPropria({ cor, simbolo: opcao })} tamanho={24} />
            </button>
          ))}
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
      {confirmando && (
        <p className="gr-nota" role="status">
          Ela sai da sua lista e das fichas desta cena. Clique em "Excluir de vez" para confirmar.
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
const DICA_FICHA_CHEIA = `Uma ficha leva até ${CONDICOES_POR_FICHA_MAX} condições criadas. Tire uma para marcar esta.`

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
 * Marcar, editar e excluir passam pelo histórico do mapa (Ctrl+Z desfaz o que
 * mudou nas fichas). A lista em si mora neste computador
 * (`stores/condicoesPropriasStore.ts`).
 *
 * Condição que veio dentro do mapa e não está na lista (mapa feito em outro
 * computador) também ganha chip: dá para tirar da ficha, e salvar pelo lápis a
 * traz para a lista.
 */
export function CondicoesProprias({ tokenId, naFicha, classeDoChip }: CondicoesPropriasProps) {
  const catalogo = useCondicoesPropriasStore((state) => state.catalogo)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const lista = [...catalogo, ...naFicha.filter((daFicha) => !catalogo.some((daLista) => daLista.id === daFicha.id))]
  const fichaCheia = naFicha.length >= CONDICOES_POR_FICHA_MAX
  const criando = edicao !== null && edicao.tipo === 'nova'

  const abrir = (proxima: Edicao | null) => {
    setAviso(null)
    setEdicao(proxima)
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
    else useMapStore.getState().trocarCondicaoPropriaNasFichas(condicao)
    abrir(null)
  }

  const excluir = (id: string) => {
    useCondicoesPropriasStore.getState().excluir(id)
    useMapStore.getState().tirarCondicaoPropriaDasFichas(id)
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
              title={travada ? DICA_FICHA_CHEIA : undefined}
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
      <button
        type="button"
        className={`${classeDoChip} gr-chip--mais lb-cond-criar`}
        aria-expanded={criando}
        onClick={() => abrir(criando ? null : { tipo: 'nova' })}
      >
        <Mais />
        Criar condição
      </button>
      {edicao !== null && (
        <FormDaCondicao
          key={edicao.tipo === 'nova' ? 'nova' : edicao.condicao.id}
          inicial={edicao.tipo === 'nova' ? null : edicao.condicao}
          aviso={aviso}
          onSalvar={salvar}
          onExcluir={edicao.tipo === 'nova' ? undefined : () => excluir(edicao.condicao.id)}
          onFechar={() => abrir(null)}
        />
      )}
    </>
  )
}
