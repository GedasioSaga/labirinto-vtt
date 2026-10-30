import { useId, useState, type FormEvent } from 'react'
import { maximoComposto } from '../../lib/ajusteDaFicha'
import type { CandidatoDaBatalha, ComoEntra, EscolhaDaBatalha } from '../../lib/livros/combate'
import { RECURSO_QUE_A_FORCA_MULTIPLICA, type Personagem } from '../../lib/personagem'
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
  return temHp ? `${tipo} · HP ${maximoComposto(personagem, RECURSO_QUE_A_FORCA_MULTIPLICA).total}` : tipo
}

export function QuemEntraNaBatalha({ aberto, candidatos, jogadoresSemFicha, modelos, personagens, onConfirmar, onCancelar }: QuemEntraNaBatalhaProps) {
  const idBase = useId()
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(
    () => new Set(candidatos.filter((candidato) => candidato.situacao === 'combate').map((candidato) => candidato.tokenId)),
  )
  const [comoPorToken, setComoPorToken] = useState<Readonly<Record<string, ComoEntra>>>({})
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const comFicha = candidatos.filter((candidato) => candidato.situacao === 'combate')
  const semFicha = candidatos.filter((candidato) => candidato.situacao !== 'combate')
  const comoDe = (candidato: CandidatoDaBatalha): ComoEntra => comoPorToken[candidato.tokenId] ?? comoDePartida(candidato)

  const alternar = (tokenId: string) => {
    setMarcados((antes) => {
      const depois = new Set(antes)
      if (depois.has(tokenId)) depois.delete(tokenId)
      else depois.add(tokenId)
      return depois
    })
  }

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
      <li key={candidato.tokenId} className="gr-entra">
        <input type="checkbox" id={idDaMarca} checked={marcado} onChange={() => alternar(candidato.tokenId)} />
        <label htmlFor={idDaMarca}>
          <span className="gr-entra__retrato">
            <ImagemOuIniciais imagem={personagem?.retrato} nome={personagem?.nome ?? candidato.nome} />
          </span>
          <span className="gr-entra__nome">
            {candidato.nome}
            <small>{legendaDe(candidato, personagem)}</small>
          </span>
        </label>
        {candidato.situacao === 'combate' ? (
          <span />
        ) : (
          <select
            className="gr-entrada gr-entra__como"
            aria-label={`Como ${candidato.nome} entra`}
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

  const descricao = `Há ${semFicha.length} ${semFicha.length === 1 ? 'token' : 'tokens'} no mapa sem ficha de combate. Marque os que lutam; o resto fica fora da ordem dos turnos.`
  const resumo =
    extras === 0
      ? 'Ninguém sem ficha entra.'
      : `${extras} sem ficha ${extras === 1 ? 'entra' : 'entram'} com a ficha escolhida. A ficha nova fica nos NPCs de combate.`

  return (
    <Dialogo aberto={aberto} titulo="Quem entra na batalha?" onFechar={onCancelar} descricao={descricao}>
      <form className="gr-entra-form" onSubmit={confirmar} data-gr-foco>
        {comFicha.length > 0 && (
          <fieldset className="gr-entra-grupo">
            <legend className="gr-entra-grupo__tit">Têm ficha de combate</legend>
            <ul className="gr-entra-lista">{comFicha.map(linha)}</ul>
          </fieldset>
        )}
        <fieldset className="gr-entra-grupo">
          <legend className="gr-entra-grupo__tit">Sem ficha de combate</legend>
          <ul className="gr-entra-lista">{semFicha.map(linha)}</ul>
        </fieldset>
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
    </Dialogo>
  )
}
