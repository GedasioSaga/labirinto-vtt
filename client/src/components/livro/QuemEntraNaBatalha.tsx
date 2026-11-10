import { useEffect, useId, useState, type FormEvent } from 'react'
import { maximoComposto } from '../../lib/ajusteDaFicha'
import { AVISO_SEM_HP, type CandidatoDaBatalha, type ComoEntra, type EscolhaDaBatalha } from '../../lib/livros/combate'
import { RECURSO_QUE_A_FORCA_MULTIPLICA, numeroDaFicha, type Personagem } from '../../lib/personagem'
import { ImagemOuIniciais } from '../FichaPecas'
import { Acoes, Botao } from '../grimorio/Botao'
import { Dialogo } from '../grimorio/Dialogo'
import './QuemEntraNaBatalha.css'

/**
 * "QUEM ENTRA NA BATALHA?" (M1, docs/planos/livros-de-regras-plano.md): a
 * caixa do Iniciar batalha, depois da abertura, quando a cena tem token sem
 * ficha de combate (`precisaPerguntar(quemPodeEntrar(...))`). Com ficha de
 * combate: marcados. Sem ficha, ou "Só no cenário": desmarcados, cada um com
 * "Ficha mínima (HP 300, golpe 80)" (a escolha de partida de quem não tem
 * ficha), "Como <modelo>" ou, para o de cenário, a própria ficha. Quem não é
 * marcado fica fora da ordem dos turnos. A ficha criada fica no bestiário
 * (decisão D3): quem chama a cria.
 */
export interface QuemEntraNaBatalhaProps {
  /** A caixa à vista. Montada desde antes de abrir, para a saída do diálogo tocar. */
  aberto: boolean
  /** Os tokens da cena, na ordem do mapa (`quemPodeEntrar`), SEM os tokens de jogador sem ficha (ficha mínima é coisa de NPC). */
  candidatos: readonly CandidatoDaBatalha[]
  /** Quantos tokens de jogador sem ficha ficaram fora da lista: a caixa diz isso numa linha, para o mestre não procurar. */
  jogadoresSemFicha: number
  /** Os NPCs que podem servir de modelo ("Como Recruta da Marinha"): os de combate que não são variação. */
  modelos: readonly Personagem[]
  /** As fichas em uso, para o retrato e o HP de quem já tem uma. */
  personagens: readonly Personagem[]
  /** Só os MARCADOS. Quem chama cria as fichas, liga os tokens e chama `combatentesIniciais` com `incluir`. */
  onConfirmar: (escolhas: EscolhaDaBatalha[]) => void
  /** Esc ou "Cancelar": a batalha não começa. */
  onCancelar: () => void
  /**
   * Pedido de 09/11/2026 (item 6): a lista dentro do livro, sem a janela por cima do mapa, para o mestre ver e clicar
   * nas fichas enquanto escolhe. Ausente = a janela de sempre.
   */
  emLinha?: boolean
  /** Pedido de 09/11 (item 6): o nome de cada token com o número dos repetidos ("Urso 1", "Urso 2"). Ausente = o nome do token. */
  rotulos?: ReadonlyMap<string, string>
  /** Pedido de 09/11 (item 6): o mouse (ou o foco) entrou numa linha: acende a ficha no mapa; `null` = saiu. */
  onDestacar?: (tokenId: string | null) => void
  /** Pedido de 09/11 (item 6): a ficha clicada no mapa marca ou desmarca a linha dela; `seq` sobe a cada clique. */
  cliqueNoMapa?: { tokenId: string; seq: number } | null
}

/** O valor de cada opção da lista "como entra". O modelo leva prefixo: id de personagem nunca colide com as palavras fixas. */
const COMO_PROPRIA = 'propria'
const COMO_MINIMA = 'minima'
const PREFIXO_DO_MODELO = 'modelo:'

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

export function QuemEntraNaBatalha({ aberto, candidatos, jogadoresSemFicha, modelos, personagens, onConfirmar, onCancelar, emLinha = false, rotulos, onDestacar, cliqueNoMapa = null }: QuemEntraNaBatalhaProps) {
  const idBase = useId()
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(
    () => new Set(candidatos.filter((candidato) => candidato.situacao === 'combate').map((candidato) => candidato.tokenId)),
  )
  const [comoPorToken, setComoPorToken] = useState<Readonly<Record<string, ComoEntra>>>({})
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const comFicha = candidatos.filter((candidato) => candidato.situacao === 'combate')
  const semFicha = candidatos.filter((candidato) => candidato.situacao === 'semFicha' || candidato.situacao === 'soCenario')
  // F2 (fatia A, resposta da Saga): a ficha sem HP fica de fora, sem caixa de marcar; a linha diz por quê.
  const semHp = candidatos.filter((candidato) => candidato.situacao === 'semHp')
  const comoDe = (candidato: CandidatoDaBatalha): ComoEntra => comoPorToken[candidato.tokenId] ?? comoDePartida(candidato)

  const alternar = (tokenId: string) => {
    setMarcados((antes) => {
      const depois = new Set(antes)
      if (depois.has(tokenId)) depois.delete(tokenId)
      else depois.add(tokenId)
      return depois
    })
  }

  // Pedido de 09/11 (item 6): a ficha clicada no mapa marca ou desmarca a linha dela (a sem HP não tem caixa de marcar).
  const cliqueSeq = cliqueNoMapa?.seq ?? 0
  useEffect(() => {
    if (cliqueNoMapa === null || !aberto) return
    const clicado = candidatos.find((candidato) => candidato.tokenId === cliqueNoMapa.tokenId)
    if (clicado !== undefined && clicado.situacao !== 'semHp') alternar(clicado.tokenId)
    // Só o clique novo (`seq`) alterna: a lista e a janela aberta não repetem o último clique.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliqueSeq])

  const nomeDe = (candidato: CandidatoDaBatalha): string => rotulos?.get(candidato.tokenId) ?? candidato.nome
  const total = candidatos.filter((candidato) => marcados.has(candidato.tokenId)).length
  const extras = semFicha.filter((candidato) => marcados.has(candidato.tokenId)).length

  const confirmar = (evento: FormEvent) => {
    evento.preventDefault()
    if (total === 0) return
    onConfirmar(candidatos.filter((candidato) => marcados.has(candidato.tokenId)).map((candidato) => ({ tokenId: candidato.tokenId, como: comoDe(candidato) })))
  }

  const linha = (candidato: CandidatoDaBatalha) => {
    const personagem = candidato.personagemId === null ? undefined : porId.get(candidato.personagemId)
    const idDaMarca = `${idBase}-${candidato.tokenId}`
    const marcado = marcados.has(candidato.tokenId)
    return (
      <li key={candidato.tokenId} className="gr-entra" onMouseEnter={() => onDestacar?.(candidato.tokenId)} onMouseLeave={() => onDestacar?.(null)}>
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
        {candidato.situacao === 'combate' ? (
          // No livro (estreito) a linha tem três colunas: a célula vazia abriria uma linha a mais.
          emLinha ? null : (
            <span />
          )
        ) : (
          <select
            className="gr-entrada gr-entra__como"
            aria-label={`Como ${nomeDe(candidato)} entra`}
            disabled={!marcado}
            value={valorDoComo(comoDe(candidato))}
            onChange={(evento) => {
              const como = comoDoValor(evento.currentTarget.value)
              setComoPorToken((antes) => ({ ...antes, [candidato.tokenId]: como }))
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
    semFicha.length === 0
      ? 'Marque quem luta. Ficha sem HP fica fora da ordem dos turnos.'
      : `Há ${semFicha.length} ${semFicha.length === 1 ? 'token' : 'tokens'} no mapa sem ficha de combate. Marque os que lutam; o resto fica fora da ordem dos turnos.`
  const resumo =
    extras === 0
      ? 'Ninguém sem ficha entra.'
      : `${extras} sem ficha ${extras === 1 ? 'entra' : 'entram'} com a ficha escolhida. A ficha nova fica nos NPCs de combate.`

  const miolo = (
      <form className="gr-entra-form" onSubmit={confirmar} data-gr-foco>
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
        <p className="gr-nota" aria-live="polite">
          {resumo}
        </p>
        <Acoes>
          <Botao tipo="submit" variante="primario" disabled={total === 0}>
            {total === 0 ? 'Marque quem entra' : `Iniciar com ${total}`}
          </Botao>
          <Botao variante="fantasma" onClick={onCancelar}>
            Cancelar
          </Botao>
        </Acoes>
      </form>
  )

  // Pedido de 09/11 (item 6): no livro, sem janela por cima: o mapa fica à vista e clicável.
  if (emLinha) {
    if (!aberto) return null
    return (
      <section className="gr-entra-painel" aria-labelledby={`${idBase}-titulo`}>
        <h3 className="gr-entra-painel__tit" id={`${idBase}-titulo`}>
          Quem entra na batalha?
        </h3>
        <p className="gr-nota">{descricao} Passe o mouse num nome para ver a ficha no mapa. Clicar numa ficha no mapa marca ou desmarca.</p>
        {miolo}
      </section>
    )
  }

  return (
    <Dialogo aberto={aberto} titulo="Quem entra na batalha?" onFechar={onCancelar} descricao={descricao}>
      {miolo}
    </Dialogo>
  )
}
