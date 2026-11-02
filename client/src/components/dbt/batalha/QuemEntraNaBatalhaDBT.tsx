import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { Equipe } from '../../../lib/batalha/equipes'
import { LADO_DOS_JOGADORES, LADO_DOS_NPCS } from '../../../lib/dbt/batalha/inicio'
import type { EntranteDBT } from '../../../lib/dbt/batalha/tipos'
import type { Personagem } from '../../../lib/personagem'
import { ImagemOuIniciais } from '../../FichaPecas'
import { Acoes, Botao } from '../../grimorio/Botao'
import { Dialogo } from '../../grimorio/Dialogo'
import '../../livro/QuemEntraNaBatalha.css'
import './batalhaDBT.css'
import type { LadoNoMenuDBT } from './OrdemDoMestreDBT'

/**
 * "QUEM ENTRA NA BATALHA?" no Dragon Ball (seção 19, a caixa do Iniciar):
 * depois da abertura, o mestre marca quais fichas da cena lutam e de que
 * lado (as equipes da mesa, "Jogadores" ou "NPCs"). O lado decide quem é
 * inimigo e quem é aliado no alvo das técnicas. Marcados de partida: os de
 * `entrantesDaCena` (jogador e NPC de combate); NPC "só no cenário" e token
 * de NPC sem ficha começam de fora (o sem ficha entra à mão: o mestre resolve
 * os números). Token escondido não aparece: mostre-o no mapa para ele lutar.
 * Mesmo desenho da caixa do One Piece (`QuemEntraNaBatalha.css`).
 */

/** O pedaço do token que a caixa lê. */
export interface TokenParaEntrar {
  id: string
  characterId: string | null
  name: string
  hidden?: boolean
  npc?: boolean
  imageData?: string | null
}

export interface CandidatoDBT {
  tokenId: string
  personagemId: string | null
  nome: string
  imagem: string | null
  npc: boolean
  ladoInicial: string
  marcadoInicial: boolean
  /** "Jogador", "NPC · só no cenário", "NPC · sem ficha Dragon Ball, à mão"... */
  legenda: string
}

export interface CandidatosDaBatalhaDBT {
  candidatos: CandidatoDBT[]
  /** Tokens escondidos no mapa: ficam fora. */
  escondidos: number
  /** Tokens que não são NPC e não têm personagem ligado: ficam fora (sem ficha não há o que ler). */
  semPersonagem: number
}

/** Quem a caixa lista, na ordem do mapa, com o lado e a marca de partida. */
export function candidatosDaBatalhaDBT(tokens: readonly TokenParaEntrar[], personagens: readonly Personagem[], equipes: readonly Equipe[]): CandidatosDaBatalhaDBT {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const candidatos: CandidatoDBT[] = []
  let escondidos = 0
  let semPersonagem = 0
  for (const token of tokens) {
    if (token.hidden === true) {
      escondidos += 1
      continue
    }
    const nome = token.name.trim() || 'Ficha'
    const personagem = token.characterId === null ? undefined : porId.get(token.characterId)
    if (personagem === undefined) {
      if (token.npc !== true) {
        semPersonagem += 1
        continue
      }
      candidatos.push({ tokenId: token.id, personagemId: null, nome, imagem: token.imageData ?? null, npc: true, ladoInicial: LADO_DOS_NPCS, marcadoInicial: false, legenda: 'Sem ficha: entra à mão (o mestre resolve os números)' })
      continue
    }
    const npc = personagem.tipo !== 'jogador'
    const equipe = equipes.find((candidata) => candidata.membros.includes(personagem.id))
    const soCenario = npc && personagem.soCenario === true
    const partes = [npc ? 'NPC' : 'Jogador']
    if (soCenario) partes.push('só no cenário')
    if (personagem.dbt === undefined) partes.push('sem ficha Dragon Ball, à mão')
    candidatos.push({
      tokenId: token.id,
      personagemId: personagem.id,
      nome,
      imagem: token.imageData || personagem.retrato || null,
      npc,
      ladoInicial: equipe?.id ?? (npc ? LADO_DOS_NPCS : LADO_DOS_JOGADORES),
      marcadoInicial: !soCenario,
      legenda: partes.join(' · '),
    })
  }
  return { candidatos, escondidos, semPersonagem }
}

export interface QuemEntraNaBatalhaDBTProps {
  /** A caixa à vista. Montada desde antes de abrir, para a saída do diálogo tocar. */
  aberto: boolean
  candidatos: readonly CandidatoDBT[]
  /** `ladosDaBatalhaDBT(equipes)`. */
  lados: readonly LadoNoMenuDBT[]
  /** Quantos ficaram fora da lista (escondidos e sem personagem), para o mestre não procurar. */
  fora: { escondidos: number; semPersonagem: number }
  /** Só os MARCADOS, com o lado escolhido. Quem chama liga a batalha com eles. */
  onConfirmar: (entrantes: EntranteDBT[]) => void
  /** Esc ou "Cancelar": a batalha não começa. */
  onCancelar: () => void
}

function contagem(quantos: number, um: string, varios: string): string {
  return `${quantos} ${quantos === 1 ? um : varios}`
}

export function QuemEntraNaBatalhaDBT({ aberto, candidatos, lados, fora, onConfirmar, onCancelar }: QuemEntraNaBatalhaDBTProps) {
  const idBase = useId()
  const todosRef = useRef<HTMLInputElement>(null)
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(() => new Set(candidatos.filter((candidato) => candidato.marcadoInicial).map((candidato) => candidato.tokenId)))
  const [ladoPorToken, setLadoPorToken] = useState<Readonly<Record<string, string>>>({})
  const ladoDe = (candidato: CandidatoDBT) => ladoPorToken[candidato.tokenId] ?? candidato.ladoInicial
  const nomeDoLado = (id: string) => lados.find((lado) => lado.id === id)?.nome ?? id
  const comFicha = candidatos.filter((candidato) => candidato.personagemId !== null)
  const semFicha = candidatos.filter((candidato) => candidato.personagemId === null)
  const escolhidos = candidatos.filter((candidato) => marcados.has(candidato.tokenId))
  const total = escolhidos.length
  const todos = total > 0 && total === candidatos.length
  const algum = total > 0 && !todos

  // "Todos" com o traço quando só parte está marcada.
  useEffect(() => {
    if (todosRef.current !== null) todosRef.current.indeterminate = algum
  }, [algum])

  const alternar = (tokenId: string) => {
    setMarcados((antes) => {
      const depois = new Set(antes)
      if (depois.has(tokenId)) depois.delete(tokenId)
      else depois.add(tokenId)
      return depois
    })
  }

  const confirmar = (evento: FormEvent) => {
    evento.preventDefault()
    if (total === 0) return
    onConfirmar(escolhidos.map((candidato) => ({ tokenId: candidato.tokenId, personagemId: candidato.personagemId, nome: candidato.nome, lado: ladoDe(candidato), npc: candidato.npc })))
  }

  // "Entram 4: 2 Jogadores, 2 NPCs." Um lado só = ninguém tem inimigo: avisa antes de começar.
  const porLado = new Map<string, number>()
  for (const candidato of escolhidos) porLado.set(ladoDe(candidato), (porLado.get(ladoDe(candidato)) ?? 0) + 1)
  const resumo =
    total === 0
      ? 'Ninguém marcado.'
      : `Entram ${total}: ${[...porLado].map(([lado, quantos]) => `${quantos} ${nomeDoLado(lado)}`).join(', ')}.`
  const umLadoSo = total > 1 && porLado.size === 1

  const linha = (candidato: CandidatoDBT) => {
    const idDaMarca = `${idBase}-${candidato.tokenId}`
    const marcado = marcados.has(candidato.tokenId)
    return (
      <li key={candidato.tokenId} className="gr-entra">
        <input type="checkbox" id={idDaMarca} checked={marcado} onChange={() => alternar(candidato.tokenId)} />
        <label htmlFor={idDaMarca}>
          <span className="gr-entra__retrato">
            <ImagemOuIniciais imagem={candidato.imagem} nome={candidato.nome} />
          </span>
          <span className="gr-entra__nome">
            {candidato.nome}
            <small>{candidato.legenda}</small>
          </span>
        </label>
        <select
          className="gr-entrada dbb-entra__lado"
          aria-label={`Lado de ${candidato.nome}`}
          disabled={!marcado}
          value={ladoDe(candidato)}
          onChange={(evento) => {
            const lado = evento.currentTarget.value
            setLadoPorToken((antes) => ({ ...antes, [candidato.tokenId]: lado }))
          }}
        >
          {lados.map((lado) => (
            <option key={lado.id} value={lado.id}>
              {lado.nome}
            </option>
          ))}
        </select>
      </li>
    )
  }

  const notas: string[] = []
  if (fora.escondidos > 0) notas.push(`${contagem(fora.escondidos, 'ficha escondida fica', 'fichas escondidas ficam')} fora: mostre no mapa para lutar.`)
  if (fora.semPersonagem > 0) notas.push(`${contagem(fora.semPersonagem, 'token de jogador sem personagem fica', 'tokens de jogador sem personagem ficam')} fora: ligue a ficha no token para lutar.`)

  return (
    <Dialogo aberto={aberto} titulo="Quem entra na batalha?" onFechar={onCancelar} descricao="Marque quem luta e escolha o lado de cada um. O lado decide quem é inimigo no alvo das técnicas.">
      <form className="gr-entra-form" onSubmit={confirmar} data-gr-foco>
        {candidatos.length === 0 ? (
          <p className="gr-nota">Nenhuma ficha no mapa desta cena. Ponha tokens com personagem e inicie de novo.</p>
        ) : (
          <>
            <label className="dbb-entra__todos">
              <input ref={todosRef} type="checkbox" checked={todos} onChange={() => setMarcados(todos ? new Set() : new Set(candidatos.map((candidato) => candidato.tokenId)))} />
              Todos ({candidatos.length})
            </label>
            {comFicha.length > 0 && (
              <fieldset className="gr-entra-grupo">
                <legend className="gr-entra-grupo__tit">Fichas da cena</legend>
                <ul className="gr-entra-lista">{comFicha.map(linha)}</ul>
              </fieldset>
            )}
            {semFicha.length > 0 && (
              <fieldset className="gr-entra-grupo">
                <legend className="gr-entra-grupo__tit">NPCs sem ficha</legend>
                <ul className="gr-entra-lista">{semFicha.map(linha)}</ul>
              </fieldset>
            )}
          </>
        )}
        {notas.map((nota) => (
          <p key={nota} className="gr-nota">
            {nota}
          </p>
        ))}
        <p className="gr-nota" aria-live="polite">
          {resumo}
          {umLadoSo && ' Todos do mesmo lado: ninguém é inimigo de ninguém. Troque o lado de alguém se for luta.'}
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
