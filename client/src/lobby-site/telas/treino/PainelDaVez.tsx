import { useId, useState, type FormEvent } from 'react'
import type { AlvoDoGolpe, GolpeDaBatalha, PedidoDeAcao, SaidaDaReacao } from '../../../lib/batalha/combate'
import { danoFinal, saidasPossiveis } from '../../../lib/batalha/reacao'
import { bonusDaBatalha, bonusDaReacao } from '../../../lib/batalha/selos'
import { cartaDaVez, type CartaDaOrdem } from '../../../lib/batalha/turnos'
import type { DueloNoFio, JogadaDoDuelo } from '../../../lib/treino/duelo'
import type { LadoDoTreino } from '../../../lib/treino/mesaEmMemoria'
import { golpesDoRobo } from '../../../lib/treino/robo'
import { SISTEMA_DO_LOBBY } from '../contexto'
import { dePe } from './ArenaDaLuta'
import { nomeDaSaida, nomeDoGolpe } from './textosDoTreino'

/**
 * A MINHA VEZ numa luta (fatia T7): o que eu posso fazer agora, pela regra da
 * batalha One Piece. Reagir ao golpe que chegou (rolar a defesa e escolher a
 * saída que o dado liberou), ou, na minha vez, escolher o golpe e o alvo,
 * passar a vez, ou deixar o robô escolher por mim. A lista de golpes é a
 * mesma do robô (os que a ficha paga agora, do mais forte ao mais fraco); o
 * dano mostrado é a prévia: quem decide o dano é a regra (no duelo, o servidor).
 */

/** O golpe com alvo (Atacar ou técnica): o robô só monta estes. */
type GolpeComAlvo = Extract<PedidoDeAcao, { tipo: 'atacar' | 'habilidade' }>

interface ReacaoPendente {
  golpe: GolpeDaBatalha
  alvo: AlvoDoGolpe
}

function tokensDoLado(duelo: DueloNoFio, lado: LadoDoTreino): Set<string> {
  return new Set(duelo.lutadores.vagas.filter((vaga) => vaga.lado === lado).map((vaga) => vaga.tokenId))
}

function reacaoMinha(duelo: DueloNoFio, meus: ReadonlySet<string>): ReacaoPendente | null {
  for (const golpe of duelo.turnos.golpes ?? []) {
    for (const alvo of golpe.alvos) {
      if (meus.has(alvo.tokenId) && alvo.danoFinal === undefined && alvo.podeReagir) return { golpe, alvo }
    }
  }
  return null
}

/** O que a luta espera de mim agora: reagir, agir, ou nada (`null`: a vez é do outro lado, ou acabou). */
export function oQueEsperaDeMim(duelo: DueloNoFio, meuLado: LadoDoTreino): 'reagir' | 'agir' | null {
  if (duelo.fim !== null) return null
  const meus = tokensDoLado(duelo, meuLado)
  if (reacaoMinha(duelo, meus) !== null) return 'reagir'
  // Golpe esperando a reação do outro lado: a vez só anda depois dela.
  const outraReacao = (duelo.turnos.golpes ?? []).some((golpe) => golpe.alvos.some((alvo) => !meus.has(alvo.tokenId) && alvo.danoFinal === undefined && alvo.podeReagir))
  if (outraReacao) return null
  const carta = cartaDaVez(duelo.turnos)
  return carta !== null && meus.has(carta.tokenId) ? 'agir' : null
}

function nomeDoToken(duelo: DueloNoFio, tokenId: string): string {
  const vaga = duelo.lutadores.vagas.find((candidata) => candidata.tokenId === tokenId)
  return duelo.lutadores.personagens.find((personagem) => personagem.id === vaga?.personagemId)?.nome ?? 'Alguém'
}

interface AcoesDoPainel {
  ocupado: boolean
  onJogar(jogada: JogadaDoDuelo): void
  onRoboEscolhe(): void
}

function Reagir({ duelo, pendente, ocupado, onJogar, onRoboEscolhe }: AcoesDoPainel & { duelo: DueloNoFio; pendente: ReacaoPendente }) {
  const { golpe, alvo } = pendente
  const chega = alvo.dano ?? 0
  const modificador = bonusDaReacao(bonusDaBatalha(duelo.turnos.selos, alvo.tokenId))
  const atacante = nomeDoToken(duelo, golpe.atacanteTokenId)
  const meu = nomeDoToken(duelo, alvo.tokenId)
  const reagir = (pedido: Extract<JogadaDoDuelo, { tipo: 'reagir' }>['pedido']) => onJogar({ tipo: 'reagir', seq: duelo.seq, pedido })
  const saidas: SaidaDaReacao[] = alvo.rolagem === undefined ? [] : saidasPossiveis(alvo.rolagem.d20, alvo.rolagem.total).filter((saida) => saida !== 'contra')

  return (
    <div className="lo-tr-vez" role="group" aria-label={`Defesa de ${meu}`}>
      <p className="lo-tr-vez__titulo">
        {atacante} usou {golpe.nome} em {meu}: chegam {chega.toLocaleString('pt-BR')} de dano.
      </p>
      {alvo.rolagem === undefined ? (
        <div className="lo-tr-vez__botoes">
          <button type="button" className="lo-btn lo-btn--primario" disabled={ocupado} onClick={() => reagir({ tipo: 'rolar', golpeId: golpe.id, tokenId: alvo.tokenId, modificador })}>
            Rolar a defesa (d20 {modificador >= 0 ? '+' : '−'} {Math.abs(modificador)})
          </button>
          <button type="button" className="lo-btn" disabled={ocupado} onClick={() => reagir({ tipo: 'naoReagir', golpeId: golpe.id, tokenId: alvo.tokenId })}>
            Não reagir
          </button>
          <button type="button" className="lo-btn lo-btn--fantasma" disabled={ocupado} onClick={onRoboEscolhe}>
            O robô escolhe
          </button>
        </div>
      ) : (
        <>
          <p className="lo-tr-vez__dado">
            Tirou <b>{alvo.rolagem.d20}</b> no d20, total <b>{alvo.rolagem.total}</b>. Escolha a saída:
          </p>
          <div className="lo-tr-vez__botoes">
            {saidas.map((saida, i) => (
              <button
                key={saida}
                type="button"
                className={i === 0 ? 'lo-btn lo-btn--primario' : 'lo-btn'}
                disabled={ocupado}
                onClick={() => reagir({ tipo: 'escolher', golpeId: golpe.id, tokenId: alvo.tokenId, saida })}
              >
                {nomeDaSaida(saida)} ({danoFinal(chega, saida).toLocaleString('pt-BR')} de dano)
              </button>
            ))}
            <button type="button" className="lo-btn lo-btn--fantasma" disabled={ocupado} onClick={onRoboEscolhe}>
              O robô escolhe
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function Agir({ duelo, carta, meuLado, ocupado, onJogar, onRoboEscolhe }: AcoesDoPainel & { duelo: DueloNoFio; carta: CartaDaOrdem; meuLado: LadoDoTreino }) {
  const idDosGolpes = useId()
  const idDosAlvos = useId()
  const { turnos, regras, lutadores } = duelo
  const golpes = golpesDoRobo({ turnos, regras, vagas: lutadores.vagas, personagens: lutadores.personagens, sistema: SISTEMA_DO_LOBBY, golpesNaVez: 0 }, carta).filter(
    (candidato): candidato is GolpeComAlvo => candidato.tipo === 'atacar' || candidato.tipo === 'habilidade',
  )
  const porId = new Map(lutadores.personagens.map((personagem) => [personagem.id, personagem]))
  const naOrdem = new Set(turnos.cartas.map((candidata) => candidata.tokenId))
  const alvos = lutadores.vagas.filter((vaga) => {
    const doc = porId.get(vaga.personagemId)
    return vaga.lado !== meuLado && naOrdem.has(vaga.tokenId) && doc !== undefined && dePe(doc)
  })
  const quem = carta.personagemId === null ? undefined : porId.get(carta.personagemId)
  const [golpeEscolhido, setGolpeEscolhido] = useState(0)
  const [alvoEscolhido, setAlvoEscolhido] = useState<string | null>(golpes[0]?.alvos[0]?.tokenId ?? alvos[0]?.tokenId ?? null)
  const golpe: GolpeComAlvo | undefined = golpes[golpeEscolhido]
  const vez = { cartaId: carta.id, rodada: turnos.rodada }

  function golpear(evento: FormEvent) {
    evento.preventDefault()
    if (golpe === undefined || alvoEscolhido === null || ocupado) return
    // O dano vai `null`: a regra recalcula pela ficha (no duelo, o servidor), como na T5.
    const pedido: PedidoDeAcao = { ...golpe, alvos: [{ tokenId: alvoEscolhido, dano: null }] }
    onJogar({ tipo: 'agir', seq: duelo.seq, vez, pedido })
  }

  return (
    <form className="lo-tr-vez" onSubmit={golpear} aria-label={`Vez de ${quem?.nome ?? 'seu personagem'}`}>
      <p className="lo-tr-vez__titulo">Vez de {quem?.nome ?? 'seu personagem'}. O que fazer?</p>
      {golpes.length === 0 ? (
        <p className="lo-motivo">Nenhum golpe que dê para pagar agora (a ação já foi gasta, ou falta Energia). Passe a vez.</p>
      ) : (
        <div className="lo-tr-escolhas">
          <fieldset className="lo-tr-grupo">
            <legend id={idDosGolpes}>Golpe</legend>
            {golpes.map((candidato, i) => {
              const dano = candidato.alvos[0]?.dano
              return (
                <label key={`${candidato.tipo}-${i}`} className="lo-tr-opcao">
                  <input type="radio" name={idDosGolpes} checked={golpeEscolhido === i} onChange={() => setGolpeEscolhido(i)} />
                  <span className="lo-tr-opcao__nome">{nomeDoGolpe(candidato, quem)}</span>
                  {typeof dano === 'number' && <span className="lo-tr-opcao__valor">{dano.toLocaleString('pt-BR')} de dano</span>}
                </label>
              )
            })}
          </fieldset>
          <fieldset className="lo-tr-grupo">
            <legend id={idDosAlvos}>Alvo</legend>
            {alvos.map((vaga) => (
              <label key={vaga.tokenId} className="lo-tr-opcao">
                <input type="radio" name={idDosAlvos} checked={alvoEscolhido === vaga.tokenId} onChange={() => setAlvoEscolhido(vaga.tokenId)} />
                <span className="lo-tr-opcao__nome">{porId.get(vaga.personagemId)?.nome ?? vaga.id}</span>
              </label>
            ))}
          </fieldset>
        </div>
      )}
      <div className="lo-tr-vez__botoes">
        {golpes.length > 0 && (
          <button type="submit" className="lo-btn lo-btn--primario" disabled={ocupado || alvoEscolhido === null}>
            Golpear
          </button>
        )}
        <button type="button" className="lo-btn" disabled={ocupado} onClick={() => onJogar({ tipo: 'passar', seq: duelo.seq, vez })}>
          Passar a vez
        </button>
        <button type="button" className="lo-btn lo-btn--fantasma" disabled={ocupado} onClick={onRoboEscolhe}>
          O robô escolhe
        </button>
      </div>
    </form>
  )
}

/** O painel da minha jogada; nada quando a luta não espera nada de mim. */
export function PainelDaVez({ duelo, meuLado, ocupado, onJogar, onRoboEscolhe }: AcoesDoPainel & { duelo: DueloNoFio; meuLado: LadoDoTreino }) {
  const espera = oQueEsperaDeMim(duelo, meuLado)
  if (espera === 'reagir') {
    const pendente = reacaoMinha(duelo, tokensDoLado(duelo, meuLado))
    if (pendente === null) return null
    return <Reagir key={`${pendente.golpe.id}:${duelo.seq}`} duelo={duelo} pendente={pendente} ocupado={ocupado} onJogar={onJogar} onRoboEscolhe={onRoboEscolhe} />
  }
  if (espera === 'agir') {
    const carta = cartaDaVez(duelo.turnos)
    if (carta === null) return null
    return <Agir key={`${carta.id}:${duelo.seq}`} duelo={duelo} carta={carta} meuLado={meuLado} ocupado={ocupado} onJogar={onJogar} onRoboEscolhe={onRoboEscolhe} />
  }
  return null
}
