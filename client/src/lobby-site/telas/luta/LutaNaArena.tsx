import { useEffect, useMemo, useRef, useState } from 'react'
import { GRADES_DA_ARENA, type CasaDaArena } from '../../../lib/arena/grade'
import { cartaDaVez } from '../../../lib/batalha/turnos'
import { VOLTA_DO_AUSENTE_MS, type JogadaDoDuelo } from '../../../lib/treino/duelo'
import type { LadoDaLuta, VagaDaLuta } from '../../../lib/treino/mesaEmMemoria'
import type { LutaRecebida } from '../../dados/fioDaLuta'
import type { RecusaDaLuta } from '../../dados/lutasDaCampanha'
import { useAgora, useSite } from '../contexto'
import { Icone } from '../Icone'
import { ArenaDaLuta, type JogadasDaLuta } from '../treino/ArenaDaLuta'
import type { RespostaDoAndar } from '../treino/grade/GradeDaArena'
import { relogioDaVolta } from '../treino/textosDoTreino'
import { PainelDoArbitro } from './PainelDoArbitro'
import { juntarNomes, nomeDoTime, textoDaRecusaDaLuta, textoDoFimDaLuta, tomDoFimDaLuta, TEXTO_DO_MODO } from './textosDaLuta'

/**
 * A LUTA DE N LADOS NA ARENA (Arena multijogador F5): a mesma Arena do treino
 * e do duelo, com o olhar que o servidor mandou para esta conta.
 *  - QUEM JOGA: o menu da vez e a reação só das fichas dela (no time, o colega
 *    joga as dele), andar só a ficha dela na vez dela;
 *  - QUEM ASSISTE: só olha (a grade, a ordem e o registro), sem o que cada
 *    lado ainda não revelou; "Parar de assistir" sai da lista;
 *  - O ÁRBITRO: não joga; o painel dele fica ao lado da grade, a faixa diz
 *    de quem é a vez (nunca "Sua vez") e o Desfazer do Registro é o do painel.
 * A luta acabada mostra o resumo e só se olha.
 */

interface AndarNoServidor {
  tokenId: string
  casa: CasaDaArena
  responder: (aceito: boolean) => void
}

export function LutaNaArena({ luta, eu, conectado, ocupado, recusa, onFechar }: { luta: LutaRecebida; eu: string; conectado: boolean; ocupado: boolean; recusa: RecusaDaLuta | null; onFechar(): void }) {
  const site = useSite()
  const agora = useAgora(1_000)
  const andando = useRef<AndarNoServidor | null>(null)
  const [confirmarSaida, setConfirmarSaida] = useState(false)
  const [painelAberto, setPainelAberto] = useState(luta.olhar === 'arbitro')
  /** A linha cujo Desfazer o árbitro pediu pelo Registro da faixa: "Desfazendo…" até a resposta. */
  const [desfazendo, setDesfazendo] = useState<string | null>(null)
  const minha = luta.participantes.find((participante) => participante.contaId === eu) ?? null
  const meuLado = luta.olhar === 'jogador' ? (minha?.lado ?? null) : null
  const { fim } = luta
  const pausada = luta.pausada === true
  const joga = luta.olhar === 'jogador' && fim === null
  const arbitra = luta.olhar === 'arbitro'

  useEffect(() => {
    if (!ocupado) setDesfazendo(null)
  }, [ocupado])
  // O Desfazer do Registro é o do painel: só o árbitro, com a luta correndo e a conexão em dia. Enquanto
  // outro pedido espera resposta ele sai da linha (o pedido voltaria recusado sem ninguém ver).
  const desfazPeloRegistro = arbitra && fim === null && conectado && (!ocupado || desfazendo !== null)
  function desfazer(linhaId: string): void {
    if (site.lutas()?.arbitrar(luta.id, { tipo: 'desfazer', seq: luta.seq }) === true) setDesfazendo(linhaId)
  }

  /** No times, "Time A"; no todos contra todos, quem luta por aquele lado. */
  const nomeDoLado = (lado: LadoDaLuta): string => {
    if (luta.modo === 'times') return nomeDoTime(lado)
    const nomes = luta.participantes.filter((participante) => participante.lado === lado).map((participante) => (participante.contaId === eu ? 'você' : participante.nome))
    return nomes.length === 0 ? `Lado ${lado.toUpperCase()}` : juntarNomes(nomes)
  }

  function jogar(jogada: JogadaDoDuelo): boolean {
    return site.lutas()?.jogar(luta.id, jogada) ?? false
  }
  const jogadas = useMemo<JogadasDaLuta | null>(
    () =>
      !joga || pausada
        ? null
        : {
            agir: (vez, pedido) => jogar({ tipo: 'agir', seq: luta.seq, vez, pedido }),
            reagir: (pedido) => jogar({ tipo: 'reagir', seq: luta.seq, pedido }),
            passarVez: (cartaId, rodada) => jogar({ tipo: 'passar', seq: luta.seq, vez: { cartaId, rodada } }),
            marcar: (pedido) => jogar({ tipo: 'marcar', seq: luta.seq, pedido }),
            escolherArmas: (personagemId, armas) => jogar({ tipo: 'armas', seq: luta.seq, personagemId, armas }),
            passiva: (pedido) => jogar({ tipo: 'passiva', seq: luta.seq, pedido }),
            evoluir: (pedido) => jogar({ tipo: 'evoluir', seq: luta.seq, pedido }),
          },
    // A jogada leva o `seq` do estado que a tela mostra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [luta, joga, pausada],
  )

  // A resposta do andar: o pedido terminou, a ficha ficou na casa pedida (aceito) ou volta.
  useEffect(() => {
    const pendente = andando.current
    if (pendente === null || ocupado) return
    andando.current = null
    const casa = luta.posicoes[pendente.tokenId]
    pendente.responder(casa !== undefined && casa.col === pendente.casa.col && casa.row === pendente.casa.row)
  }, [ocupado, luta])
  useEffect(() => () => andando.current?.responder(false), [])

  function andar(tokenId: string, casa: CasaDaArena, contraDe: string | undefined): RespostaDoAndar {
    const { turnos } = luta
    const vez = contraDe === undefined && turnos.vez !== null ? { cartaId: turnos.vez, rodada: turnos.rodada } : null
    const passo: JogadaDoDuelo = { tipo: 'andar', seq: luta.seq, vez, tokenId, col: casa.col, row: casa.row }
    if (!jogar(contraDe === undefined ? passo : { ...passo, contraDe })) return false
    andando.current?.responder(false)
    return new Promise<boolean>((responder) => {
      andando.current = { tokenId, casa, responder }
    })
  }

  const carta = cartaDaVez(luta.turnos)
  const vagaDaVez = carta === null ? undefined : luta.lutadores.vagas.find((vaga) => vaga.tokenId === carta.tokenId)
  const fichaDaVez = luta.lutadores.personagens.find((personagem) => personagem.id === vagaDaVez?.personagemId)?.nome
  const quemDaVez = vagaDaVez === undefined ? null : `${fichaDaVez ?? 'a ficha'} (${nomeDoLado(vagaDaVez.lado)})`
  const ehMinha = (vaga: VagaDaLuta): boolean => vaga.contaId === eu
  const ausente = fim === null ? luta.participantes.find((participante) => participante.ausenteDesde !== null && participante.contaId !== eu && participante.robo !== true && participante.papel !== 'espectador') : undefined

  const estado = (() => {
    if (fim !== null) return null
    if (pausada) return 'Pausada pelo árbitro. As jogadas voltam quando ele retomar.'
    if (ocupado) return 'Enviando…'
    if (!conectado) return 'Sem conexão: tentando voltar. Até lá, nada sai daqui.'
    if (luta.olhar === 'assistindo') return `Você está assistindo: só olhar.${quemDaVez === null ? '' : ` Vez de ${quemDaVez}.`}`
    if (luta.olhar === 'arbitro') return `Você arbitra: ninguém joga por aqui.${quemDaVez === null ? '' : ` Vez de ${quemDaVez}.`}`
    if (luta.vista?.minhaVez === true) return null
    return quemDaVez === null ? 'Esperando a próxima jogada. Sem relógio: cada um joga quando puder.' : `Vez de ${quemDaVez}. Sem relógio: cada um joga quando puder.`
  })()

  const titulo = luta.olhar === 'assistindo' ? `Assistindo: ${TEXTO_DO_MODO[luta.modo]}` : luta.olhar === 'arbitro' ? `Arbitrando: ${TEXTO_DO_MODO[luta.modo]}` : `Luta: ${TEXTO_DO_MODO[luta.modo]}`
  const lados = [...new Set(luta.lutadores.vagas.map((vaga) => vaga.lado))].sort()

  return (
    <ArenaDaLuta
      titulo={titulo}
      icone="duelo"
      fio={luta}
      vista={luta.vista}
      arbitra={arbitra}
      onDesfazer={desfazPeloRegistro ? desfazer : undefined}
      desfazendo={desfazendo === null ? undefined : new Set([desfazendo])}
      meuLado={meuLado}
      ehMinha={ehMinha}
      grade={GRADES_DA_ARENA[luta.tamanho]}
      jogadas={jogadas}
      podeAndar={(vaga, emPe) => joga && !pausada && ehMinha(vaga) && emPe && conectado && !ocupado && vaga.tokenId === carta?.tokenId}
      onAndar={andar}
      detalhes={<span>{lados.map(nomeDoLado).join(' × ')}</span>}
      aviso={
        pausada && fim === null ? (
          <p className="lo-ar-aviso" role="status">
            <span className="lo-ar-aviso__ponto" aria-hidden="true" />
            Pausada pelo árbitro
          </p>
        ) : ausente !== undefined && ausente.ausenteDesde !== null ? (
          <p className="lo-ar-aviso" role="status">
            <span className="lo-ar-aviso__ponto" aria-hidden="true" />
            {ausente.nome} caiu da conexão: <span className="lo-ar-aviso__relogio">{relogioDaVolta(ausente.ausenteDesde + VOLTA_DO_AUSENTE_MS - agora)}</span> para voltar.
          </p>
        ) : undefined
      }
      acoes={
        <>
          {luta.olhar === 'arbitro' && fim === null && (
            <button type="button" className="lo-btn" aria-expanded={painelAberto} onClick={() => setPainelAberto((antes) => !antes)}>
              Painel do árbitro
            </button>
          )}
          {luta.olhar === 'assistindo' && fim === null && (
            <button
              type="button"
              className="lo-btn"
              disabled={ocupado || !conectado}
              onClick={() => {
                if (site.lutas()?.parar(luta.id) === true) onFechar()
              }}
            >
              Parar de assistir
            </button>
          )}
          {luta.olhar !== 'assistindo' && fim === null && (
            <button type="button" className="lo-btn" aria-expanded={confirmarSaida} onClick={() => setConfirmarSaida((antes) => !antes)}>
              Sair da luta
            </button>
          )}
          <button type="button" className="lo-btn lo-btn--fantasma" onClick={onFechar}>
            <Icone nome="voltar" /> {fim === null ? 'Sair da tela' : 'Fechar'}
          </button>
        </>
      }
      estado={estado}
      recusa={recusa === null || (recusa.id !== undefined && recusa.id !== luta.id) ? null : { texto: textoDaRecusaDaLuta(recusa.motivo, recusa.texto), n: recusa.n }}
      onEsquecerRecusa={() => site.lutas()?.esquecerAvisos()}
      fim={
        fim === null ? null : (
          <>
            <p className="lo-ar-fim__titulo" data-tom={tomDoFimDaLuta(fim, meuLado)}>
              {textoDoFimDaLuta(fim, meuLado, nomeDoLado)}
            </p>
            <p className="lo-ar-fim__nota">
              {lados.map(nomeDoLado).join(' × ')}: rodada {luta.turnos.rodada}.
            </p>
            <div className="lo-ar-fim__botoes">
              <button type="button" className="lo-btn lo-btn--primario" autoFocus onClick={onFechar}>
                Fechar
              </button>
            </div>
          </>
        )
      }
      sobre={
        fim !== null ? undefined : confirmarSaida ? (
          <div
            className="lo-confirma lo-ar-confirma"
            role="group"
            aria-label="Confirmar a saída"
            onKeyDown={(evento) => {
              if (evento.key !== 'Escape') return
              evento.stopPropagation()
              setConfirmarSaida(false)
            }}
          >
            <p>{luta.olhar === 'arbitro' ? 'Sair da luta? Ela segue sem árbitro (pausada, ela volta a correr).' : 'Sair da luta? As suas fichas saem da ordem e a luta segue sem você.'}</p>
            <div>
              <button type="button" className="lo-btn" disabled={ocupado || !conectado} onClick={() => site.lutas()?.sair(luta.id)}>
                Sair de vez
              </button>
              <button type="button" className="lo-btn lo-btn--fantasma" autoFocus onClick={() => setConfirmarSaida(false)}>
                Continuar
              </button>
            </div>
          </div>
        ) : luta.olhar === 'arbitro' && painelAberto ? (
          <PainelDoArbitro luta={luta} ocupado={ocupado || !conectado} nomeDoLado={nomeDoLado} onFechar={() => setPainelAberto(false)} />
        ) : undefined
      }
    />
  )
}
