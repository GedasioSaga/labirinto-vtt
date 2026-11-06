import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { CasaDaArena } from '../../../lib/arena/grade'
import { cartaDaVez } from '../../../lib/batalha/turnos'
import type { MembroProjetado } from '../../../lib/nuvem/tipos'
import { VOLTA_DO_AUSENTE_MS, type DueloNoFio, type JogadaDoDuelo } from '../../../lib/treino/duelo'
import type { ConviteDoDuelo } from '../../../lib/treino/dueloDoLobby'
import { VAGAS_POR_LADO_MAX, type LadoDoTreino } from '../../../lib/treino/mesaEmMemoria'
import type { DueloRecebido } from '../../../lib/treino/vistaDoDuelo'
import type { EstadoDoDuelo, RecusaDoDuelo } from '../../dados/dueloDaCampanha'
import { candidatasDoRobo, proximaDoRobo } from '../../dados/roboDoDuelo'
import type { EstadoDaCampanha, FichaDoSite } from '../../dados/sessaoDaCampanha'
import { SISTEMA_DO_LOBBY, useAgora, useSite } from '../contexto'
import { Icone } from '../Icone'
import { ArenaDaLuta, type JogadasDaLuta } from './ArenaDaLuta'
import type { RespostaDoAndar } from './grade/GradeDaArena'
import { fichasDoPedido, MontagemDoDuelo, montagemInicialDoDuelo } from './montagem/MontagemDoDuelo'
import type { PecaNaGrade } from './montagem/regrasDaMontagem'
import { nomeDaVez, oQueEsperaDeMim } from './quemJoga'
import { contar, relogioDaVolta, textoDaRecusa, textoDoConviteFechado, textoDoFim, tomDoFim } from './textosDoTreino'

/**
 * O DUELO entre jogadores (fatia T7, sobre o protocolo `duelo.*` da T6):
 * desafiar um colega da mesa com as suas fichas, aceitar ou recusar o desafio
 * recebido, lutar turno a turno sem relógio (resposta 12.15: cada um joga
 * quando puder; quem cansar desiste e o outro vence) e ver o resumo no fim.
 * Quem cai da conexão tem 3 minutos para voltar: a tela mostra a contagem.
 * O servidor decide tudo (o dano, a vez, quem venceu); a tela só pede. A luta
 * abre na Arena (fatia H, `ArenaDaLuta`) com a vista do lado desta conta.
 */

/** As minhas fichas que podem duelar: minhas e na mesa (o servidor confere o dono de novo). */
function fichasDoDuelo(campanha: EstadoDaCampanha): FichaDoSite[] {
  const eu = campanha.eu?.contaId
  return campanha.fichas.filter((ficha) => ficha.ehMinha && ficha.visivel === 'mesa' && (ficha.doc.dono === undefined || ficha.doc.dono === eu))
}

function nomesDasFichas(campanha: EstadoDaCampanha, ids: readonly string[]): string {
  const nomes = ids.map((id) => campanha.fichas.find((ficha) => ficha.doc.id === id)?.doc.nome ?? 'uma ficha')
  return nomes.length <= 1 ? (nomes[0] ?? 'uma ficha') : `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`
}

function minutosAte(ms: number): string {
  const minutos = Math.max(1, Math.ceil(ms / 60_000))
  return minutos === 1 ? '1 minuto' : `${minutos} minutos`
}

function ConviteRecebido({ convite, campanha, minhas, ocupado }: { convite: ConviteDoDuelo; campanha: EstadoDaCampanha; minhas: readonly FichaDoSite[]; ocupado: boolean }) {
  const site = useSite()
  const agora = useAgora(30_000)
  // Quem aceita é o Lado B: monta na metade da direita.
  const [bruta, setLista] = useState<PecaNaGrade[]>(() => montagemInicialDoDuelo(minhas, 'b'))
  const { lista, fichas: escolhidas } = fichasDoPedido(bruta, minhas, 'b')
  return (
    <li className="lo-tr-convite">
      <p className="lo-tr-convite__texto">
        <b>{convite.de.nome}</b> te desafiou com {nomesDasFichas(campanha, convite.fichasDe)}. O desafio vale por mais {minutosAte(convite.venceEm - agora)}.
      </p>
      {minhas.length === 0 ? (
        <p className="lo-motivo">Você não tem personagem na mesa para aceitar.</p>
      ) : (
        <MontagemDoDuelo minhas={minhas} lado="b" nomeDoOutro={convite.de.nome} lista={lista} onMudar={setLista} />
      )}
      <div className="lo-tr-vez__botoes">
        <button type="button" className="lo-btn lo-btn--primario" disabled={ocupado || escolhidas.length === 0} onClick={() => site.duelo()?.aceitar(convite.id, escolhidas)}>
          Aceitar o desafio
        </button>
        <button type="button" className="lo-btn" disabled={ocupado} onClick={() => site.duelo()?.recusar(convite.id)}>
          Recusar
        </button>
      </div>
    </li>
  )
}

function NovoDesafio({ campanha, colegas, minhas, ocupado }: { campanha: EstadoDaCampanha; colegas: readonly MembroProjetado[]; minhas: readonly FichaDoSite[]; ocupado: boolean }) {
  const site = useSite()
  const [para, setPara] = useState<string | null>(colegas[0]?.contaId ?? null)
  // Quem desafia é o Lado A: monta na metade da esquerda.
  const [bruta, setLista] = useState<PecaNaGrade[]>(() => montagemInicialDoDuelo(minhas, 'a'))
  const { lista, fichas: escolhidas } = fichasDoPedido(bruta, minhas, 'a')
  const nomeDoOutro = colegas.find((colega) => colega.contaId === para)?.nome ?? 'o colega'
  const naMesa = new Set(campanha.naMesa.map((presenca) => presenca.contaId))

  function desafiar(evento: FormEvent) {
    evento.preventDefault()
    if (para === null || escolhidas.length === 0 || ocupado) return
    site.duelo()?.convidar(para, escolhidas)
  }

  if (colegas.length === 0) return <p className="lo-vazio">Ainda não há outro jogador nesta mesa para desafiar.</p>
  if (minhas.length === 0) return <p className="lo-vazio">Você precisa de um personagem na mesa para desafiar alguém.</p>
  return (
    <form className="lo-tr-desafio" onSubmit={desafiar}>
      <fieldset className="lo-tr-grupo">
        <legend>Quem você desafia</legend>
        {colegas.map((colega) => (
          <label key={colega.contaId} className="lo-tr-opcao">
            <input type="radio" name="desafiado" checked={para === colega.contaId} onChange={() => setPara(colega.contaId)} />
            <span className="lo-tr-opcao__nome">{colega.nome}</span>
            {naMesa.has(colega.contaId) && <span className="lo-tag lo-tag--online">na mesa agora</span>}
          </label>
        ))}
      </fieldset>
      <div className="lo-campo">
        <span className="lo-tr-rotulo">Com quem você luta (até {VAGAS_POR_LADO_MAX})</span>
        <MontagemDoDuelo minhas={minhas} lado="a" nomeDoOutro={nomeDoOutro} lista={lista} onMudar={setLista} />
      </div>
      <div className="lo-tr-vez__botoes">
        <button type="submit" className="lo-btn lo-btn--primario" disabled={ocupado || para === null || escolhidas.length === 0}>
          Desafiar
        </button>
      </div>
    </form>
  )
}

/** O andar que saiu ao servidor e espera a resposta: a grade segura a ficha na casa nova até ela chegar. */
interface AndarNoServidor {
  tokenId: string
  casa: CasaDaArena
  responder: (aceito: boolean) => void
}

/** A linha do que acontece agora no duelo, quando não é o menu da minha vez que diz. */
function estadoDoDuelo(duelo: DueloNoFio, meuLado: LadoDoTreino, outro: string, ocupado: boolean): string | null {
  if (ocupado) return 'Enviando a jogada…'
  const espera = oQueEsperaDeMim(duelo, meuLado)
  const vez = nomeDaVez(duelo)
  if (espera === 'agir') return null
  if (espera === 'reagir') return `${vez?.nome ?? 'O outro lado'} golpeou: a defesa é sua (REAÇÃO).`
  if (vez === null || vez.lado === meuLado) return `Esperando ${outro} reagir. Sem relógio: cada um joga quando puder.`
  return `Vez de ${vez.nome}: esperando ${outro} jogar. Sem relógio: cada um joga quando puder.`
}

/**
 * O duelo na Arena (fatia H): o HUD com a vista do meu lado (M2), as jogadas
 * pelo protocolo `duelo.*` e o andar pelo servidor (só a ficha da vez, ou a do
 * "Mover" do contra-ataque). Acabado, a mesma tela mostra o resumo e só se olha.
 */
function DueloNaArena({ duelo, meuLado, conectado, ocupado, recusa, onFechar }: { duelo: DueloRecebido; meuLado: LadoDoTreino; conectado: boolean; ocupado: boolean; recusa: RecusaDoDuelo | null; onFechar(): void }) {
  const site = useSite()
  const agora = useAgora(1_000)
  const [confirmarDesistencia, setConfirmarDesistencia] = useState(false)
  const andando = useRef<AndarNoServidor | null>(null)
  const outroLado: LadoDoTreino = meuLado === 'a' ? 'b' : 'a'
  const outro = duelo.jogadores[outroLado]
  const fim = duelo.fim
  // Quando a MINHA conexão caiu (a Arena fica por cima da página, que mostra o "Sem conexão"). O servidor
  // conta os 3 min desde que vê o fio fechar, que é depois daqui: o relógio local nunca promete mais tempo.
  const [caiuEm, setCaiuEm] = useState<number | null>(() => (conectado ? null : Date.now()))
  useEffect(() => {
    setCaiuEm((antes) => (conectado ? null : (antes ?? Date.now())))
  }, [conectado])
  const caiu = fim === null && caiuEm !== null

  function jogar(jogada: JogadaDoDuelo): boolean {
    return site.duelo()?.jogar(duelo.id, jogada) ?? false
  }
  const jogadas = useMemo<JogadasDaLuta | null>(
    () =>
      duelo.fim !== null
        ? null
        : {
            agir: (vez, pedido) => jogar({ tipo: 'agir', seq: duelo.seq, vez, pedido }),
            reagir: (pedido) => jogar({ tipo: 'reagir', seq: duelo.seq, pedido }),
            passarVez: (cartaId, rodada) => jogar({ tipo: 'passar', seq: duelo.seq, vez: { cartaId, rodada } }),
          },
    // A jogada leva o `seq` do estado que a tela mostra: a conexão muda com o duelo.
    [duelo],
  )

  // A resposta do andar: quando o pedido termina, a ficha ficou na casa pedida (aceito) ou não (recusado: ela volta).
  useEffect(() => {
    const pendente = andando.current
    if (pendente === null || ocupado) return
    andando.current = null
    const casa = duelo.posicoes[pendente.tokenId]
    pendente.responder(casa !== undefined && casa.col === pendente.casa.col && casa.row === pendente.casa.row)
  }, [ocupado, duelo])
  useEffect(() => () => andando.current?.responder(false), [])

  /** Andar vai ao servidor, que decide: na vez da ficha (ou com o "Mover" do contra-ataque), casa dentro da grade e livre. */
  function andar(tokenId: string, casa: CasaDaArena, contraDe: string | undefined): RespostaDoAndar {
    const { turnos } = duelo
    const vez = contraDe === undefined && turnos.vez !== null ? { cartaId: turnos.vez, rodada: turnos.rodada } : null
    const passo: JogadaDoDuelo = { tipo: 'andar', seq: duelo.seq, vez, tokenId, col: casa.col, row: casa.row }
    if (!jogar(contraDe === undefined ? passo : { ...passo, contraDe })) return false
    andando.current?.responder(false)
    return new Promise<boolean>((responder) => {
      andando.current = { tokenId, casa, responder }
    })
  }

  function roboEscolhe() {
    const proxima = proximaDoRobo({ turnos: duelo.turnos, regras: duelo.regras, lutadores: duelo.lutadores, jogadores: duelo.jogadores }, SISTEMA_DO_LOBBY, null)
    const primeira = proxima === null || proxima.lado !== meuLado ? undefined : candidatasDoRobo(proxima.jogada, duelo.seq)[0]
    if (primeira !== undefined) jogar(primeira)
  }

  const vezDoToken = cartaDaVez(duelo.turnos)?.tokenId
  const espera = oQueEsperaDeMim(duelo, meuLado)

  return (
    <ArenaDaLuta
      titulo={`Duelo com ${outro.nome}`}
      icone="duelo"
      fio={duelo}
      vista={duelo.vista}
      meuLado={meuLado}
      jogadas={jogadas}
      podeAndar={(vaga, emPe) => vaga.lado === meuLado && emPe && conectado && !ocupado && vaga.tokenId === vezDoToken}
      onAndar={andar}
      detalhes={<span>{fim === null ? 'Sem relógio' : 'Acabou'}</span>}
      aviso={
        caiu ? (
          <p className="lo-ar-aviso" role="status">
            <span className="lo-ar-aviso__ponto" aria-hidden="true" />
            {/* O `agora` anda de segundo em segundo e pode ser de antes da queda: sem o max, o primeiro quadro diria 3:01. */}
            Você caiu da conexão: <span className="lo-ar-aviso__relogio">{relogioDaVolta(caiuEm + VOLTA_DO_AUSENTE_MS - Math.max(agora, caiuEm))}</span> para voltar.
          </p>
        ) : fim === null && outro.ausenteDesde !== null ? (
          <p className="lo-ar-aviso" role="status">
            <span className="lo-ar-aviso__ponto" aria-hidden="true" />
            {outro.nome} caiu da conexão: <span className="lo-ar-aviso__relogio">{relogioDaVolta(outro.ausenteDesde + VOLTA_DO_AUSENTE_MS - agora)}</span> para voltar.
          </p>
        ) : undefined
      }
      acoes={
        <>
          {fim === null && espera !== null && (
            <button type="button" className="lo-btn lo-btn--fantasma" disabled={ocupado || !conectado} onClick={roboEscolhe}>
              O robô escolhe
            </button>
          )}
          {fim === null && (
            <button type="button" className="lo-btn" aria-expanded={confirmarDesistencia} onClick={() => setConfirmarDesistencia((antes) => !antes)}>
              Desistir do duelo
            </button>
          )}
          <button type="button" className="lo-btn lo-btn--fantasma" onClick={onFechar}>
            <Icone nome="voltar" /> {fim === null ? 'Sair da tela' : 'Fechar'}
          </button>
        </>
      }
      estado={caiu ? 'Sem conexão: tentando voltar. Até lá, nenhuma jogada sai daqui.' : estadoDoDuelo(duelo, meuLado, outro.nome, ocupado)}
      recusa={recusa === null ? null : { texto: textoDaRecusa(recusa.motivo), n: recusa.n }}
      onEsquecerRecusa={() => site.duelo()?.esquecerAvisos()}
      fim={
        fim === null ? null : (
          <>
            <p className="lo-ar-fim__titulo" data-tom={tomDoFim(fim, meuLado)}>
              {textoDoFim(fim, meuLado, outro.nome)}
            </p>
            <p className="lo-ar-fim__nota">
              Contra {outro.nome}: rodada {duelo.turnos.rodada}, {contar(duelo.seq, 'jogada', 'jogadas')}.
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
        fim === null && confirmarDesistencia ? (
          <div
            className="lo-confirma lo-ar-confirma"
            role="group"
            aria-label="Confirmar desistência"
            onKeyDown={(evento) => {
              if (evento.key !== 'Escape') return
              evento.stopPropagation()
              setConfirmarDesistencia(false)
            }}
          >
            <p>{conectado ? `Desistir agora? ${outro.nome} vence o duelo.` : 'Sem conexão: a desistência só sai quando a internet voltar.'}</p>
            <div>
              <button type="button" className="lo-btn" disabled={ocupado || !conectado} onClick={() => site.duelo()?.desistir(duelo.id)}>
                Desistir de vez
              </button>
              {/* O foco vai para o lado seguro: Enter sem querer não entrega o duelo. */}
              <button type="button" className="lo-btn lo-btn--fantasma" autoFocus onClick={() => setConfirmarDesistencia(false)}>
                Continuar lutando
              </button>
            </div>
          </div>
        ) : undefined
      }
    />
  )
}

function DueloAcabado({ duelo, contaId, onRever }: { duelo: DueloNoFio; contaId: string; onRever(): void }) {
  const meuLado: LadoDoTreino = duelo.jogadores.a.contaId === contaId ? 'a' : 'b'
  const outro = duelo.jogadores[meuLado === 'a' ? 'b' : 'a']
  if (duelo.fim === null) return null
  return (
    <li className="lo-tr-acabado">
      <span className="lo-tr-acabado__texto" data-tom={tomDoFim(duelo.fim, meuLado)}>
        Contra {outro.nome}: {textoDoFim(duelo.fim, meuLado, outro.nome)}
      </span>
      <span className="lo-motivo">Rodada {duelo.turnos.rodada}</span>
      <button type="button" className="lo-btn lo-btn--fantasma" onClick={onRever}>
        Rever a luta
      </button>
    </li>
  )
}

export function TelaDuelo({ campanha, duelo }: { campanha: EstadoDaCampanha; duelo: EstadoDoDuelo }) {
  const site = useSite()
  const eu = campanha.eu
  const minhas = useMemo(() => fichasDoDuelo(campanha), [campanha])
  const ativo = duelo.duelos.find((candidato) => candidato.fim === null)
  /** O duelo em andamento que a pessoa tirou da tela (ela volta pelo "Voltar à luta"). */
  const [foraDaTela, setForaDaTela] = useState<string | null>(null)
  /** O duelo acabado aberto na Arena: o que acabou com ela na tela, ou o "Rever a luta". */
  const [revendo, setRevendo] = useState<string | null>(null)
  const ultimoAtivo = useRef<string | null>(null)
  const idDoAtivo = ativo?.id ?? null

  // O duelo que estava na Arena acabou: ela fica com o resumo até a pessoa fechar.
  useEffect(() => {
    const antes = ultimoAtivo.current
    ultimoAtivo.current = idDoAtivo
    if (idDoAtivo === null && antes !== null && antes !== foraDaTela) setRevendo(antes)
  }, [idDoAtivo, foraDaTela])

  if (eu === null) return <p className="lo-vazio">Esta conta não está na mesa.</p>
  const colegas = campanha.membros.filter((membro) => membro.papel === 'jogador' && membro.contaId !== eu.contaId)
  const ocupado = duelo.esperando !== null
  const acabados = duelo.duelos.filter((candidato) => candidato.fim !== null)
  const ladoDe = (candidato: DueloNoFio): LadoDoTreino => (candidato.jogadores.a.contaId === eu.contaId ? 'a' : 'b')
  const naArena = ativo !== undefined && ativo.id !== foraDaTela ? ativo : acabados.find((candidato) => candidato.id === revendo)
  const recebidos = duelo.convites.filter((convite) => convite.para.contaId === eu.contaId)
  const enviado = duelo.convites.find((convite) => convite.de.contaId === eu.contaId)
  const fechado = duelo.fechado
  const outroDoFechado = fechado?.convite === null || fechado === null ? null : fechado.convite.de.contaId === eu.contaId ? fechado.convite.para : fechado.convite.de

  return (
    <div className="lo-tr-pagina-duelo">
      {(duelo.recusa !== null || fechado !== null) && (
        <div className="lo-linha-aviso lo-tr-aviso" role="alert">
          <span>
            {duelo.recusa !== null
              ? textoDaRecusa(duelo.recusa.motivo)
              : fechado !== null
                ? textoDoConviteFechado(fechado.motivo, fechado.convite?.de.contaId === eu.contaId, outroDoFechado?.nome ?? 'O colega')
                : ''}
          </span>
          <button type="button" className="lo-btn lo-btn--fantasma" onClick={() => site.duelo()?.esquecerAvisos()}>
            Ok
          </button>
        </div>
      )}

      {!duelo.emDia ? (
        <p className="lo-carregando" role="status">
          <span className="lo-giro" aria-hidden="true" />
          {campanha.conexao === 'sem-rede' ? 'Sem conexão. O duelo volta quando a internet voltar.' : 'Abrindo os duelos da mesa…'}
        </p>
      ) : ativo !== undefined ? (
        <section className="lo-tr-bloco" aria-labelledby="duelo-ativo">
          <h2 id="duelo-ativo" className="lo-tr-bloco__titulo">
            Duelo com {ativo.jogadores[ladoDe(ativo) === 'a' ? 'b' : 'a'].nome}
          </h2>
          <div className="lo-tr-convite">
            <p className="lo-tr-convite__texto">Em andamento, rodada {ativo.turnos.rodada}. Sem relógio: a luta espera você na Arena.</p>
            <div className="lo-tr-vez__botoes">
              <button type="button" className="lo-btn lo-btn--primario" onClick={() => setForaDaTela(null)}>
                Voltar à luta
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          {recebidos.length > 0 && (
            <section className="lo-tr-bloco" aria-labelledby="duelo-recebidos">
              <h2 id="duelo-recebidos" className="lo-tr-bloco__titulo">
                {recebidos.length === 1 ? 'Desafio para você' : 'Desafios para você'}
              </h2>
              <ul className="lo-tr-convites">
                {recebidos.map((convite) => (
                  <ConviteRecebido key={convite.id} convite={convite} campanha={campanha} minhas={minhas} ocupado={ocupado} />
                ))}
              </ul>
            </section>
          )}
          <section className="lo-tr-bloco" aria-labelledby="duelo-novo">
            <h2 id="duelo-novo" className="lo-tr-bloco__titulo">
              Desafiar um colega
            </h2>
            {enviado !== undefined ? (
              <div className="lo-tr-convite">
                <p className="lo-tr-convite__texto" role="status">
                  <span className="lo-giro" aria-hidden="true" /> Você desafiou <b>{enviado.para.nome}</b> com {nomesDasFichas(campanha, enviado.fichasDe)}. Esperando a resposta.
                </p>
                <div className="lo-tr-vez__botoes">
                  <button type="button" className="lo-btn" disabled={ocupado} onClick={() => site.duelo()?.recusar(enviado.id)}>
                    Desistir do desafio
                  </button>
                </div>
              </div>
            ) : (
              <NovoDesafio campanha={campanha} colegas={colegas} minhas={minhas} ocupado={ocupado} />
            )}
          </section>
        </>
      )}

      {acabados.length > 0 && (
        <section className="lo-tr-bloco" aria-labelledby="duelo-acabados">
          <h2 id="duelo-acabados" className="lo-tr-bloco__titulo">
            Últimos duelos
          </h2>
          <ul className="lo-tr-acabados">
            {acabados.map((acabado) => (
              <DueloAcabado key={acabado.id} duelo={acabado} contaId={eu.contaId} onRever={() => setRevendo(acabado.id)} />
            ))}
          </ul>
        </section>
      )}

      {naArena !== undefined && (
        <DueloNaArena
          // Um duelo, uma Arena: trocar de duelo não herda a mira, o recado nem a confirmação do outro.
          key={naArena.id}
          duelo={naArena}
          meuLado={ladoDe(naArena)}
          conectado={duelo.emDia}
          ocupado={ocupado}
          recusa={duelo.recusa}
          onFechar={() => {
            if (naArena.fim === null) setForaDaTela(naArena.id)
            else setRevendo(null)
          }}
        />
      )}
    </div>
  )
}
