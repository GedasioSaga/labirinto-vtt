import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { maximoComposto } from '../../lib/ajusteDaFicha'
import type { LadoDoNpc } from '../../lib/batalha/equipes'
import { AVISO_SEM_HP, type CandidatoDaBatalha, type ComoEntra, type EscolhaDaBatalha } from '../../lib/livros/combate'
import { RECURSO_QUE_A_FORCA_MULTIPLICA, numeroDaFicha, type Personagem } from '../../lib/personagem'
import { ROTULO_DO_LADO } from '../batalha/ladoDoNpcNaTela'
import { ImagemOuIniciais } from '../FichaPecas'
import { Acoes, Botao } from '../grimorio/Botao'
import './QuemEntraNaBatalha.css'

/**
 * "QUEM ENTRA NA BATALHA?" (M1, docs/planos/livros-de-regras-plano.md): a
 * lista de quem luta, dentro do livro, sem janela por cima do mapa (pedido de
 * 09/11/2026, item 6): o mestre vê e clica nas fichas enquanto escolhe. É a
 * MESMA lista no "Iniciar batalha" e no "Incluir na batalha" (conserto de
 * 09/11, achados 2 e 3).
 *
 * Com ficha de combate: marcados (ou só quem o mestre selecionou no mapa,
 * `marcadosDePartida`). Sem ficha, ou "Só no cenário": desmarcados, cada um
 * com "Ficha mínima (HP 300, golpe 80)" (a escolha de partida de quem não tem
 * ficha), "Como <modelo>" ou, para o de cenário, a própria ficha. Cada NPC
 * escolhe o lado: "Contra os jogadores" (o padrão) ou "Do lado dos jogadores".
 * Quem não é marcado fica fora da ordem dos turnos. A ficha criada fica no
 * bestiário (decisão D3): quem chama a cria.
 */
export interface QuemEntraNaBatalhaProps {
  /** A lista à vista. */
  aberto: boolean
  /** Os tokens da cena, na ordem do mapa (`quemPodeEntrar`), SEM os tokens de jogador sem ficha (ficha mínima é coisa de NPC). */
  candidatos: readonly CandidatoDaBatalha[]
  /** Quantos tokens de jogador sem ficha ficaram fora da lista: a caixa diz isso numa linha, para o mestre não procurar. */
  jogadoresSemFicha: number
  /** Os NPCs que podem servir de modelo ("Como Recruta da Marinha"): os de combate que não são variação. */
  modelos: readonly Personagem[]
  /** As fichas em uso, para o retrato e o HP de quem já tem uma. */
  personagens: readonly Personagem[]
  /** Só os MARCADOS, e o lado de cada NPC marcado (por token). Quem chama cria as fichas, liga os tokens e põe cada NPC no lado. */
  onConfirmar: (escolhas: EscolhaDaBatalha[], lados: ReadonlyMap<string, LadoDoNpc>) => void
  /** Esc ou "Cancelar": nada acontece. */
  onCancelar: () => void
  /** O nome de cada token com o número dos repetidos ("Urso 1", "Urso 2"). Ausente = o nome do token. */
  rotulos?: ReadonlyMap<string, string>
  /** O mouse (ou o foco) entrou numa linha: acende a ficha no mapa; `null` = saiu. */
  onDestacar?: (tokenId: string | null) => void
  /** A ficha clicada no mapa marca ou desmarca a linha dela; `seq` sobe a cada clique. */
  cliqueNoMapa?: { tokenId: string; seq: number } | null
  /** Quem já vem marcado (as fichas que o mestre selecionou no mapa, mais os jogadores). Ausente = todos com ficha de combate. */
  marcadosDePartida?: ReadonlySet<string>
  /** A linha que diz que a seleção do mapa escolheu quem veio marcado, ao lado do "Todos" (que a desfaz). Ausente = a seleção não filtrou. */
  avisoDaSelecao?: string | null
  /** O lado de agora de um NPC com ficha. Ausente = a lista não pergunta o lado. */
  ladoDe?: (personagemId: string) => LadoDoNpc
  /** O título do painel. Ausente = "Quem entra na batalha?". */
  titulo?: string
  /** O rótulo do botão com `quantos` marcados. Ausente = "Iniciar com N". */
  rotuloDoConfirmar?: (quantos: number) => string
  /** O rótulo do botão quando a cena não tem ninguém para marcar (ele confirma assim mesmo). Ausente = o botão fica apagado. */
  rotuloSemNinguem?: string
  /** Os campos de antes da lista, dentro do mesmo formulário (o "Iniciar batalha": abertura, nome, desempate, regra). */
  antes?: ReactNode
  /** Uma classe a mais no formulário. */
  classeDoForm?: string
}

/** O valor de cada opção da lista "como entra". O modelo leva prefixo: id de personagem nunca colide com as palavras fixas. */
const COMO_PROPRIA = 'propria'
const COMO_MINIMA = 'minima'
const PREFIXO_DO_MODELO = 'modelo:'
const LADOS: readonly LadoDoNpc[] = ['contra', 'jogadores']

function valorDoComo(como: ComoEntra): string {
  if (como.tipo === 'modelo') return `${PREFIXO_DO_MODELO}${como.modeloId}`
  return como.tipo === 'propria' ? COMO_PROPRIA : COMO_MINIMA
}

function comoDoValor(valor: string): ComoEntra {
  if (valor.startsWith(PREFIXO_DO_MODELO)) return { tipo: 'modelo', modeloId: valor.slice(PREFIXO_DO_MODELO.length) }
  return valor === COMO_PROPRIA ? { tipo: 'propria' } : { tipo: 'minima' }
}

/** Com que ficha o candidato entra se o mestre só marcar: a própria, se tem uma; senão a mínima. */
function comoDePartida(candidato: CandidatoDaBatalha): ComoEntra {
  return candidato.personagemId === null ? { tipo: 'minima' } : { tipo: 'propria' }
}

/** A linha pequena embaixo do nome: o que ele é e o HP de quem já tem ficha (com a força do NPC). */
function legendaDe(candidato: CandidatoDaBatalha, personagem: Personagem | undefined): string {
  if (personagem === undefined) return 'Sem ficha'
  const tipo = candidato.situacao === 'soCenario' ? 'Só no cenário' : personagem.tipo === 'jogador' ? 'Jogador' : 'NPC'
  const temHp = personagem.maximos[RECURSO_QUE_A_FORCA_MULTIPLICA] !== undefined || personagem.recursos[RECURSO_QUE_A_FORCA_MULTIPLICA] !== undefined
  if (!temHp) return tipo
  // Pedido de 09/11 (item 6): a vida de agora e a máxima ("HP 215/300"), para escolher sabendo quem está ferido.
  const maximo = maximoComposto(personagem, RECURSO_QUE_A_FORCA_MULTIPLICA).total
  const temAtual = personagem.recursos[RECURSO_QUE_A_FORCA_MULTIPLICA] !== undefined
  return temAtual ? `${tipo} · HP ${numeroDaFicha(personagem.recursos, RECURSO_QUE_A_FORCA_MULTIPLICA)}/${maximo}` : `${tipo} · HP ${maximo}`
}

export function QuemEntraNaBatalha({
  aberto,
  candidatos,
  jogadoresSemFicha,
  modelos,
  personagens,
  onConfirmar,
  onCancelar,
  rotulos,
  onDestacar,
  cliqueNoMapa = null,
  marcadosDePartida,
  avisoDaSelecao = null,
  ladoDe,
  titulo = 'Quem entra na batalha?',
  rotuloDoConfirmar = (quantos) => `Iniciar com ${quantos}`,
  rotuloSemNinguem,
  antes,
  classeDoForm,
}: QuemEntraNaBatalhaProps) {
  const idBase = useId()
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(
    () => new Set(candidatos.filter((candidato) => (marcadosDePartida === undefined ? candidato.situacao === 'combate' : candidato.situacao !== 'semHp' && marcadosDePartida.has(candidato.tokenId))).map((candidato) => candidato.tokenId)),
  )
  // O "Todos" desfaz o filtro da seleção do mapa: a linha que o explicava sai junto.
  const [filtroDesfeito, setFiltroDesfeito] = useState(false)
  const [comoPorToken, setComoPorToken] = useState<Readonly<Record<string, ComoEntra>>>({})
  const [ladoPorToken, setLadoPorToken] = useState<Readonly<Record<string, LadoDoNpc>>>({})
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const comFicha = candidatos.filter((candidato) => candidato.situacao === 'combate')
  const semFicha = candidatos.filter((candidato) => candidato.situacao === 'semFicha' || candidato.situacao === 'soCenario')
  // F2 (fatia A, resposta da Saga): a ficha sem HP fica de fora, sem caixa de marcar; a linha diz por quê.
  const semHp = candidatos.filter((candidato) => candidato.situacao === 'semHp')
  const marcaveis = candidatos.filter((candidato) => candidato.situacao !== 'semHp')
  const comoDe = (candidato: CandidatoDaBatalha): ComoEntra => comoPorToken[candidato.tokenId] ?? comoDePartida(candidato)
  const personagemDe = (candidato: CandidatoDaBatalha): Personagem | undefined => (candidato.personagemId === null ? undefined : porId.get(candidato.personagemId))
  /** A ficha nova de quem não tem ficha nasce NPC; quem tem ficha é o que a ficha diz. */
  const ehNpc = (candidato: CandidatoDaBatalha): boolean => (personagemDe(candidato)?.tipo ?? 'npc') === 'npc'
  /** O lado do NPC na lista: o que o mestre escolheu aqui; senão o de agora; sem ficha, "contra" (o padrão). */
  const ladoNaLista = (candidato: CandidatoDaBatalha): LadoDoNpc => ladoPorToken[candidato.tokenId] ?? (candidato.personagemId !== null && ladoDe !== undefined ? ladoDe(candidato.personagemId) : 'contra')

  const alternar = (tokenId: string) => {
    setMarcados((anteriores) => {
      const depois = new Set(anteriores)
      if (depois.has(tokenId)) depois.delete(tokenId)
      else depois.add(tokenId)
      return depois
    })
  }

  // A ficha clicada no mapa marca ou desmarca a linha dela (a sem HP não tem caixa de marcar). Conserto de 09/11
  // (achado 1): só o clique NOVO conta. A lista que nasce com um clique antigo guardado em quem a montou não o repete.
  const ultimoSeq = useRef(cliqueNoMapa?.seq ?? 0)
  const alternarAgora = useRef(alternar)
  alternarAgora.current = alternar
  const candidatosAgora = useRef(candidatos)
  candidatosAgora.current = candidatos
  useEffect(() => {
    if (cliqueNoMapa === null || cliqueNoMapa.seq === ultimoSeq.current) return
    ultimoSeq.current = cliqueNoMapa.seq
    if (!aberto) return
    const clicado = candidatosAgora.current.find((candidato) => candidato.tokenId === cliqueNoMapa.tokenId)
    if (clicado !== undefined && clicado.situacao !== 'semHp') alternarAgora.current(clicado.tokenId)
  }, [cliqueNoMapa, aberto])

  // Abriu: o painel fica à vista no livro e o foco entra no botão de confirmar (Enter inicia; Esc cancela).
  const secao = useRef<HTMLElement>(null)
  const confirmarRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!aberto) return
    if (typeof secao.current?.scrollIntoView === 'function') secao.current.scrollIntoView({ block: 'nearest' })
    // Botão apagado não recebe foco (o Incluir abre com ninguém marcado): o foco vai para a primeira caixa de marcar.
    const botao = confirmarRef.current
    const alvo = botao !== null && !botao.disabled ? botao : secao.current?.querySelector<HTMLElement>('input[type="checkbox"]')
    alvo?.focus({ preventScroll: true })
  }, [aberto])

  if (!aberto) return null

  const nomeDe = (candidato: CandidatoDaBatalha): string => rotulos?.get(candidato.tokenId) ?? candidato.nome
  const escolhidos = candidatos.filter((candidato) => marcados.has(candidato.tokenId))
  const total = escolhidos.length
  const extras = semFicha.filter((candidato) => marcados.has(candidato.tokenId)).length
  const semNinguem = marcaveis.length === 0 && rotuloSemNinguem !== undefined

  const confirmar = (evento: FormEvent) => {
    evento.preventDefault()
    if (total === 0 && !semNinguem) return
    const lados = new Map<string, LadoDoNpc>()
    if (ladoDe !== undefined) for (const candidato of escolhidos) if (ehNpc(candidato)) lados.set(candidato.tokenId, ladoNaLista(candidato))
    onConfirmar(
      escolhidos.map((candidato) => ({ tokenId: candidato.tokenId, como: comoDe(candidato) })),
      lados,
    )
  }

  const teclar = (evento: KeyboardEvent<HTMLElement>) => {
    if (evento.key !== 'Escape') return
    evento.preventDefault()
    evento.stopPropagation()
    onCancelar()
  }

  const linha = (candidato: CandidatoDaBatalha) => {
    const personagem = personagemDe(candidato)
    const idDaMarca = `${idBase}-${candidato.tokenId}`
    const marcado = marcados.has(candidato.tokenId)
    return (
      <li key={candidato.tokenId} className="gr-entra" data-token={candidato.tokenId} onMouseEnter={() => onDestacar?.(candidato.tokenId)} onMouseLeave={() => onDestacar?.(null)}>
        <input
          type="checkbox"
          id={idDaMarca}
          checked={marcado}
          onChange={() => alternar(candidato.tokenId)}
          onFocus={() => onDestacar?.(candidato.tokenId)}
          onBlur={() => onDestacar?.(null)}
        />
        <label htmlFor={idDaMarca}>
          <span className="gr-entra__retrato">
            <ImagemOuIniciais imagem={personagem?.retrato} nome={personagem?.nome ?? candidato.nome} />
          </span>
          <span className="gr-entra__nome">
            {nomeDe(candidato)}
            <small>{legendaDe(candidato, personagem)}</small>
          </span>
        </label>
        {ladoDe !== undefined && ehNpc(candidato) && (
          <select
            className="gr-entrada gr-entra__como"
            aria-label={`De que lado ${nomeDe(candidato)} luta`}
            disabled={!marcado}
            value={ladoNaLista(candidato)}
            onChange={(evento) => {
              const lado = LADOS.find((opcao) => opcao === evento.currentTarget.value)
              if (lado !== undefined) setLadoPorToken((anteriores) => ({ ...anteriores, [candidato.tokenId]: lado }))
            }}
          >
            {LADOS.map((lado) => (
              <option key={lado} value={lado}>
                {ROTULO_DO_LADO[lado]}
              </option>
            ))}
          </select>
        )}
        {candidato.situacao !== 'combate' && (
          <select
            className="gr-entrada gr-entra__como"
            aria-label={`Como ${nomeDe(candidato)} entra`}
            disabled={!marcado}
            value={valorDoComo(comoDe(candidato))}
            onChange={(evento) => {
              const como = comoDoValor(evento.currentTarget.value)
              setComoPorToken((anteriores) => ({ ...anteriores, [candidato.tokenId]: como }))
            }}
          >
            {candidato.personagemId !== null && <option value={COMO_PROPRIA}>Com a própria ficha, só nesta batalha</option>}
            <option value={COMO_MINIMA}>Ficha mínima (HP 300, golpe 80)</option>
            {modelos.map((modelo) => (
              <option key={modelo.id} value={`${PREFIXO_DO_MODELO}${modelo.id}`}>
                Como {modelo.nome}
              </option>
            ))}
          </select>
        )}
      </li>
    )
  }

  const descricao =
    marcaveis.length === 0
      ? 'Nenhuma ficha nesta cena para marcar.'
      : semFicha.length === 0
        ? 'Marque quem luta.'
        : `Marque quem luta. Há ${semFicha.length} ${semFicha.length === 1 ? 'token' : 'tokens'} sem ficha de combate: marcado, entra com a ficha escolhida.`

  return (
    <section ref={secao} className="gr-entra-painel" aria-labelledby={`${idBase}-titulo`} onKeyDown={teclar}>
      <h3 className="gr-entra-painel__tit" id={`${idBase}-titulo`}>
        {titulo}
      </h3>
      <form className={['gr-entra-form', classeDoForm].filter(Boolean).join(' ')} onSubmit={confirmar}>
        {antes}
        <p className="gr-nota">
          {descricao}
          {marcaveis.length > 0 && ' Passe o mouse num nome para ver a ficha no mapa. Clicar numa ficha no mapa marca ou desmarca.'}
        </p>
        {marcaveis.length > 0 && (
          <div className="gr-entra-todos">
            {avisoDaSelecao !== null && !filtroDesfeito && <p className="gr-nota gr-entra-todos__aviso">{avisoDaSelecao}</p>}
            <Botao
              tamanho="p"
              onClick={() => {
                setMarcados(new Set(marcaveis.map((candidato) => candidato.tokenId)))
                setFiltroDesfeito(true)
              }}
            >
              Todos
            </Botao>
            <Botao tamanho="p" onClick={() => setMarcados(new Set())}>
              Nenhum
            </Botao>
            <span className="gr-entra-todos__conta" aria-live="polite">
              {total} de {marcaveis.length}
            </span>
          </div>
        )}
        {comFicha.length > 0 && (
          <fieldset className="gr-entra-grupo">
            <legend className="gr-entra-grupo__tit">Têm ficha de combate</legend>
            <ul className="gr-entra-lista">{comFicha.map(linha)}</ul>
          </fieldset>
        )}
        {semFicha.length > 0 && (
          <fieldset className="gr-entra-grupo">
            <legend className="gr-entra-grupo__tit">Sem ficha de combate</legend>
            <ul className="gr-entra-lista">{semFicha.map(linha)}</ul>
          </fieldset>
        )}
        {semHp.length > 0 && (
          <p className="gr-nota">
            Ficam de fora, {AVISO_SEM_HP}: {semHp.map(nomeDe).join(', ')}. Dê HP máximo à ficha para ela lutar.
          </p>
        )}
        {jogadoresSemFicha > 0 && (
          <p className="gr-nota">
            {jogadoresSemFicha === 1
              ? '1 token de jogador sem ficha fica fora: ligue a ficha dele no token para ele lutar.'
              : `${jogadoresSemFicha} tokens de jogador sem ficha ficam fora: ligue a ficha de cada um no token para eles lutarem.`}
          </p>
        )}
        {extras > 0 && (
          <p className="gr-nota" aria-live="polite">
            {extras} sem ficha {extras === 1 ? 'entra' : 'entram'} com a ficha escolhida. A ficha nova fica nos NPCs de combate.
          </p>
        )}
        <div className="gr-entra-acoes">
          <Acoes>
            <Botao ref={confirmarRef} tipo="submit" variante="primario" disabled={total === 0 && !semNinguem}>
              {semNinguem ? rotuloSemNinguem : total === 0 ? 'Marque quem entra' : rotuloDoConfirmar(total)}
            </Botao>
            <Botao variante="fantasma" onClick={onCancelar}>
              Cancelar
            </Botao>
          </Acoes>
        </div>
      </form>
    </section>
  )
}
