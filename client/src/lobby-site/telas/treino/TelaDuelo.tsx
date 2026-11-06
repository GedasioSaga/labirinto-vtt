import { useMemo, useState, type FormEvent } from 'react'
import type { MembroProjetado } from '../../../lib/nuvem/tipos'
import { VOLTA_DO_AUSENTE_MS, type DueloNoFio, type JogadaDoDuelo } from '../../../lib/treino/duelo'
import type { ConviteDoDuelo } from '../../../lib/treino/dueloDoLobby'
import { VAGAS_POR_LADO_MAX, type LadoDoTreino } from '../../../lib/treino/mesaEmMemoria'
import type { EstadoDoDuelo } from '../../dados/dueloDaCampanha'
import { candidatasDoRobo, proximaDoRobo } from '../../dados/roboDoDuelo'
import type { EstadoDaCampanha, FichaDoSite } from '../../dados/sessaoDaCampanha'
import { SISTEMA_DO_LOBBY, useAgora, useSite } from '../contexto'
import { ArenaDaLuta, nomeDaVez } from './ArenaDaLuta'
import { oQueEsperaDeMim, PainelDaVez } from './PainelDaVez'
import { relogioDaVolta, textoDaRecusa, textoDoConviteFechado, textoDoFim, tomDoFim } from './textosDoTreino'

/**
 * O DUELO entre jogadores (fatia T7, sobre o protocolo `duelo.*` da T6):
 * desafiar um colega da mesa com as suas fichas, aceitar ou recusar o desafio
 * recebido, lutar turno a turno sem relógio (resposta 12.15: cada um joga
 * quando puder; quem cansar desiste e o outro vence) e ver o resumo no fim.
 * Quem cai da conexão tem 3 minutos para voltar: a tela mostra a contagem.
 * O servidor decide tudo (o dano, a vez, quem venceu); a tela só pede.
 */

/** Os botões de ligar e desligar fichas (cada uma uma vez, até o teto do lado). */
export function EscolhaDeFichas({ fichas, escolhidas, aoMudar, rotulo }: { fichas: readonly { id: string; nome: string }[]; escolhidas: readonly string[]; aoMudar(ids: string[]): void; rotulo: string }) {
  return (
    <div className="lo-tr-fichas" role="group" aria-label={rotulo}>
      {fichas.map((ficha) => {
        const marcada = escolhidas.includes(ficha.id)
        return (
          <button
            key={ficha.id}
            type="button"
            className="lo-tr-ficha"
            aria-pressed={marcada}
            disabled={!marcada && escolhidas.length >= VAGAS_POR_LADO_MAX}
            onClick={() => aoMudar(marcada ? escolhidas.filter((id) => id !== ficha.id) : [...escolhidas, ficha.id])}
          >
            {ficha.nome}
          </button>
        )
      })}
    </div>
  )
}

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
  const [escolhidas, setEscolhidas] = useState<string[]>(minhas[0] === undefined ? [] : [minhas[0].doc.id])
  return (
    <li className="lo-tr-convite">
      <p className="lo-tr-convite__texto">
        <b>{convite.de.nome}</b> te desafiou com {nomesDasFichas(campanha, convite.fichasDe)}. O desafio vale por mais {minutosAte(convite.venceEm - agora)}.
      </p>
      {minhas.length === 0 ? (
        <p className="lo-motivo">Você não tem personagem na mesa para aceitar.</p>
      ) : (
        <EscolhaDeFichas fichas={minhas.map((ficha) => ({ id: ficha.doc.id, nome: ficha.doc.nome }))} escolhidas={escolhidas} aoMudar={setEscolhidas} rotulo="Com quem você luta" />
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
  const [escolhidas, setEscolhidas] = useState<string[]>(minhas[0] === undefined ? [] : [minhas[0].doc.id])
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
        <EscolhaDeFichas fichas={minhas.map((ficha) => ({ id: ficha.doc.id, nome: ficha.doc.nome }))} escolhidas={escolhidas} aoMudar={setEscolhidas} rotulo="Com quem você luta" />
      </div>
      <div className="lo-tr-vez__botoes">
        <button type="submit" className="lo-btn lo-btn--primario" disabled={ocupado || para === null || escolhidas.length === 0}>
          Desafiar
        </button>
      </div>
    </form>
  )
}

function DueloEmAndamento({ duelo, meuLado, ocupado }: { duelo: DueloNoFio; meuLado: LadoDoTreino; ocupado: boolean }) {
  const site = useSite()
  const agora = useAgora(1_000)
  const [confirmarDesistencia, setConfirmarDesistencia] = useState(false)
  const outroLado: LadoDoTreino = meuLado === 'a' ? 'b' : 'a'
  const outro = duelo.jogadores[outroLado]
  const espera = oQueEsperaDeMim(duelo, meuLado)
  const vez = nomeDaVez(duelo)

  function jogar(jogada: JogadaDoDuelo) {
    site.duelo()?.jogar(duelo.id, jogada)
  }
  function roboEscolhe() {
    const proxima = proximaDoRobo({ turnos: duelo.turnos, regras: duelo.regras, lutadores: duelo.lutadores, jogadores: duelo.jogadores }, SISTEMA_DO_LOBBY, null)
    const primeira = proxima === null || proxima.lado !== meuLado ? undefined : candidatasDoRobo(proxima.jogada, duelo.seq)[0]
    if (primeira !== undefined) jogar(primeira)
  }

  return (
    <section className="lo-tr-duelo" aria-label={`Duelo com ${outro.nome}`}>
      {outro.ausenteDesde !== null && (
        <p className="lo-tr-ausente" role="status">
          <span className="lo-tr-ausente__ponto" aria-hidden="true" />
          {outro.nome} caiu da conexão: <span className="lo-tr-ausente__relogio">{relogioDaVolta(outro.ausenteDesde + VOLTA_DO_AUSENTE_MS - agora)}</span> para voltar.
        </p>
      )}
      {espera !== null ? (
        <PainelDaVez duelo={duelo} meuLado={meuLado} ocupado={ocupado} onJogar={jogar} onRoboEscolhe={roboEscolhe} />
      ) : (
        <p className="lo-tr-estado" role="status">
          Rodada {duelo.turnos.rodada}. {vez === null ? `Esperando ${outro.nome}.` : `Vez de ${vez.nome}.`} Sem relógio: {outro.nome} joga quando puder.
        </p>
      )}
      <ArenaDaLuta duelo={duelo} meuLado={meuLado} nomeDoMeuLado="Seu lado" nomeDoOutroLado={`Lado de ${outro.nome}`} />
      <div className="lo-tr-desistir">
        {confirmarDesistencia ? (
          <div
            className="lo-confirma"
            role="group"
            aria-label="Confirmar desistência"
            onKeyDown={(evento) => {
              if (evento.key !== 'Escape') return
              evento.stopPropagation()
              setConfirmarDesistencia(false)
            }}
          >
            <p>Desistir agora? {outro.nome} vence o duelo.</p>
            <div>
              <button type="button" className="lo-btn" disabled={ocupado} onClick={() => site.duelo()?.desistir(duelo.id)}>
                Desistir de vez
              </button>
              {/* O foco vai para o lado seguro: Enter sem querer não entrega o duelo. */}
              <button type="button" className="lo-btn lo-btn--fantasma" autoFocus onClick={() => setConfirmarDesistencia(false)}>
                Continuar lutando
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="lo-btn lo-btn--fantasma" onClick={() => setConfirmarDesistencia(true)}>
            Desistir do duelo
          </button>
        )}
      </div>
    </section>
  )
}

function DueloAcabado({ duelo, contaId, aberto }: { duelo: DueloNoFio; contaId: string; aberto: boolean }) {
  const meuLado: LadoDoTreino = duelo.jogadores.a.contaId === contaId ? 'a' : 'b'
  const outro = duelo.jogadores[meuLado === 'a' ? 'b' : 'a']
  if (duelo.fim === null) return null
  return (
    <li>
      {/* O mais novo já abre: é o resumo do duelo que acabou de terminar. */}
      <details className="lo-tr-acabado" open={aberto}>
        <summary>
          <span className="lo-tr-acabado__texto" data-tom={tomDoFim(duelo.fim, meuLado)}>
            Contra {outro.nome}: {textoDoFim(duelo.fim, meuLado, outro.nome)}
          </span>
          <span className="lo-motivo">Rodada {duelo.turnos.rodada}</span>
        </summary>
        <ArenaDaLuta duelo={duelo} meuLado={meuLado} nomeDoMeuLado="Seu lado" nomeDoOutroLado={`Lado de ${outro.nome}`} />
      </details>
    </li>
  )
}

export function TelaDuelo({ campanha, duelo }: { campanha: EstadoDaCampanha; duelo: EstadoDoDuelo }) {
  const site = useSite()
  const eu = campanha.eu
  const minhas = useMemo(() => fichasDoDuelo(campanha), [campanha])
  if (eu === null) return <p className="lo-vazio">Esta conta não está na mesa.</p>
  const colegas = campanha.membros.filter((membro) => membro.papel === 'jogador' && membro.contaId !== eu.contaId)
  const ocupado = duelo.esperando !== null
  const ativo = duelo.duelos.find((candidato) => candidato.fim === null)
  const acabados = duelo.duelos.filter((candidato) => candidato.fim !== null)
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
        <DueloEmAndamento duelo={ativo} meuLado={ativo.jogadores.a.contaId === eu.contaId ? 'a' : 'b'} ocupado={ocupado} />
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
            {acabados.map((acabado, i) => (
              <DueloAcabado key={acabado.id} duelo={acabado} contaId={eu.contaId} aberto={i === 0} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
