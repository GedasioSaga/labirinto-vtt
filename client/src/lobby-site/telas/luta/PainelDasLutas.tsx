import { useEffect, useRef, useState } from 'react'
import type { LutaAcontecendo, LutaNoHistorico } from '../../../lib/treino/lutaDoLobby'
import type { EstadoDasLutas } from '../../dados/lutasDaCampanha'
import type { EstadoDaCampanha } from '../../dados/sessaoDaCampanha'
import { useAgora, useSite } from '../contexto'
import { CriarLuta } from './CriarLuta'
import { LutaNaArena } from './LutaNaArena'
import { lutasDaConta } from './lutasDaConta'
import { SalaDeEspera } from './SalaDeEspera'
import { nomeDoLado, quandoFoi, textoDaEsperaFechada, textoDaRecusaDaLuta, textoDoResultado, TEXTO_DO_MODO } from './textosDaLuta'
import './luta.css'

/**
 * AS LUTAS COM VÁRIOS NA TELA DO DUELO (Arena multijogador F5, plano §2 e §6),
 * embaixo de "Desafiar": criar a luta (times ou todos contra todos) e as salas
 * de espera desta conta; "Lutas acontecendo agora" com "Assistir"; e o
 * "Histórico de lutas" da mesa, com o registro final de cada uma só para ler.
 * Vale também para o mestre (que não tem ficha na mesa): ele cria como Judge
 * ou árbitro, assiste e lê o histórico. A luta de que a conta participa abre
 * na Arena (`LutaNaArena`).
 */

/**
 * `minhaComo`: a conta joga ou arbitra esta luta ("luta"), só assiste
 * ("assistindo") ou não está nela (`null`). `presa`: a conta já está noutra
 * luta (jogando, arbitrando ou assistindo), e o servidor recusaria o Assistir.
 */
function ItemAcontecendo({ luta, minhaComo, presa, ocupado, onVoltar }: { luta: LutaAcontecendo; minhaComo: 'luta' | 'assistindo' | null; presa: boolean; ocupado: boolean; onVoltar(): void }) {
  const site = useSite()
  const cheia = luta.vagas <= 0
  return (
    <li className="lo-tr-acabado lo-lu-item">
      <span className="lo-tr-acabado__texto">{luta.lados.map((lado) => nomeDoLado(lado, luta.modo)).join(' × ')}</span>
      <span className="lo-tag">{TEXTO_DO_MODO[luta.modo]}</span>
      <span className="lo-motivo">
        rodada {luta.rodada}
        {luta.assistindo > 0 ? `, ${luta.assistindo} assistindo` : ''}
      </span>
      {luta.pausada && <span className="lo-tag lo-tag--brasa">pausada</span>}
      {minhaComo !== null ? (
        <button type="button" className="lo-btn lo-btn--primario" onClick={onVoltar}>
          {minhaComo === 'assistindo' ? 'Voltar a assistir' : 'Voltar à luta'}
        </button>
      ) : (
        <button type="button" className="lo-btn" disabled={ocupado || cheia || presa} title={cheia ? 'A luta já tem 12 pessoas' : presa ? 'Uma luta por vez' : undefined} onClick={() => site.lutas()?.assistir(luta.id)}>
          Assistir
        </button>
      )}
    </li>
  )
}

function ItemDoHistorico({ luta, agora, aberta, abrindo, onAbrir, onFecharRegistro }: { luta: LutaNoHistorico; agora: number; aberta: LutaNoHistorico | null; abrindo: boolean; onAbrir(): void; onFecharRegistro(): void }) {
  const lendo = aberta !== null && aberta.id === luta.id
  const idDoRegistro = `registro-${luta.id}`
  return (
    <li className="lo-lu-historico">
      <div className="lo-lu-historico__linha">
        <span className="lo-tr-acabado__texto" data-tom={luta.vencedor === null ? 'empate' : undefined}>
          {textoDoResultado(luta)}
        </span>
        <span className="lo-tag">{TEXTO_DO_MODO[luta.modo]}</span>
        <span className="lo-motivo">
          {quandoFoi(luta.fim, agora)}, {luta.rodadas} {luta.rodadas === 1 ? 'rodada' : 'rodadas'}
        </span>
        <button type="button" className="lo-btn lo-btn--fantasma" aria-expanded={lendo} aria-controls={lendo ? idDoRegistro : undefined} disabled={abrindo} onClick={lendo ? onFecharRegistro : onAbrir}>
          {lendo ? 'Fechar o registro' : abrindo ? 'Abrindo…' : 'Ler o registro'}
        </button>
      </div>
      <ul className="lo-lu-historico__lados">
        {luta.lados.map((lado) => (
          <li key={lado.lado}>
            <b>{nomeDoLado(lado, luta.modo)}</b>
            {luta.modo === 'times' && lado.contas.length > 0 ? `: ${lado.contas.map((conta) => conta.nome).join(', ')}` : ''} <span className="lo-motivo">com {lado.fichas.join(', ')}</span>
          </li>
        ))}
      </ul>
      {lendo && (
        <ol className="lo-lu-registro" id={idDoRegistro} aria-label="Registro final, só para ler">
          {(aberta.registro ?? []).length === 0 && <li className="lo-motivo">O registro desta luta não ficou guardado.</li>}
          {(aberta.registro ?? []).map((linha) => (
            <li key={linha.id} data-riscada={linha.desfeita === undefined ? undefined : ''}>
              <span className="lo-motivo">R{linha.rodada}</span> <b>{linha.autor}</b> {linha.texto}
            </li>
          ))}
        </ol>
      )}
    </li>
  )
}

/** `naoAbriram`: o pedaço do site com as lutas não baixou (`lutasNaoAbriram` do store); sem ele o painel ficaria para sempre em "Abrindo". */
export function PainelDasLutas({ campanha, lutas, naoAbriram, soLeitura }: { campanha: EstadoDaCampanha; lutas: EstadoDasLutas | null; naoAbriram: boolean; soLeitura: boolean }) {
  const site = useSite()
  const agora = useAgora(60_000)
  const [criando, setCriando] = useState(false)
  /** A luta em andamento que a pessoa tirou da tela (volta pelo "Voltar à luta"). */
  const [foraDaTela, setForaDaTela] = useState<string | null>(null)
  /** A luta que acabou com a Arena aberta: fica com o resumo até a pessoa fechar. */
  const [revendo, setRevendo] = useState<string | null>(null)
  const ultimaAtiva = useRef<string | null>(null)
  const eu = campanha.eu?.contaId ?? ''
  // Quem joga ou arbitra tem "a sua" luta; quem só assiste, a assistida (as duas abrem na Arena).
  const { minha: ativa, assistida } = lutasDaConta(lutas?.lutas ?? [])
  const naFrente = ativa ?? assistida
  const idNaFrente = naFrente?.id ?? null

  useEffect(() => {
    const antes = ultimaAtiva.current
    ultimaAtiva.current = idNaFrente
    if (idNaFrente === null && antes !== null && antes !== foraDaTela && lutas?.lutas.some((luta) => luta.id === antes) === true) setRevendo(antes)
  }, [idNaFrente, foraDaTela, lutas])

  if (soLeitura) {
    return (
      <section className="lo-tr-bloco" aria-labelledby="lutas-vista">
        <h2 id="lutas-vista" className="lo-tr-bloco__titulo">
          Lutas com vários
        </h2>
        <p className="lo-vazio">No “Ver como” as lutas com vários ficam de fora: elas aparecem só para quem está nelas.</p>
      </section>
    )
  }
  if (lutas === null && naoAbriram) {
    return (
      <div className="lo-linha-aviso lo-tr-aviso" role="alert">
        <span>As lutas da mesa não abriram: a parte do site com elas não chegou. Confira a conexão e tente de novo (se não vier, recarregue a página).</span>
        <button type="button" className="lo-btn" onClick={() => site.tentarAsLutasDeNovo()}>
          Tentar de novo
        </button>
      </div>
    )
  }
  if (lutas === null || !lutas.emDia) {
    return (
      <p className="lo-carregando" role="status">
        <span className="lo-giro" aria-hidden="true" />
        {campanha.conexao === 'sem-rede' ? 'Sem conexão. As lutas voltam quando a internet voltar.' : 'Abrindo as lutas da mesa…'}
      </p>
    )
  }

  const ocupado = lutas.esperando !== null
  const minhaSala = lutas.convites.find((espera) => espera.criador.contaId === eu)
  const naArena = naFrente !== undefined && naFrente.id !== foraDaTela ? naFrente : lutas.lutas.find((luta) => luta.id === revendo)
  const outrasAcontecendo = lutas.acontecendo.some((luta) => luta.id !== idNaFrente)
  const { historico, fechada, recusa } = lutas
  const avisoDaPagina =
    lutas.torta
      ? 'Chegou uma luta num formato que esta página não lê. Recarregue a página para ver a versão nova do site.'
      : recusa !== null && naArena === undefined
        ? textoDaRecusaDaLuta(recusa.motivo)
        : fechada !== null
          ? textoDaEsperaFechada(fechada.motivo, fechada.espera?.criador.contaId === eu, fechada.espera?.criador.nome ?? 'Quem criou')
          : null

  return (
    <>
      {avisoDaPagina !== null && (
        <div className="lo-linha-aviso lo-tr-aviso" role="alert">
          <span>{avisoDaPagina}</span>
          <button type="button" className="lo-btn lo-btn--fantasma" onClick={() => site.lutas()?.esquecerAvisos()}>
            Ok
          </button>
        </div>
      )}

      <section className="lo-tr-bloco" aria-labelledby="lutas-varios">
        <h2 id="lutas-varios" className="lo-tr-bloco__titulo">
          Luta com vários
        </h2>
        {lutas.convites.length > 0 && (
          <ul className="lo-tr-convites">
            {lutas.convites.map((espera) => (
              <SalaDeEspera key={espera.id} espera={espera} campanha={campanha} ocupado={ocupado} />
            ))}
          </ul>
        )}
        {ativa !== undefined ? (
          <div className="lo-tr-convite">
            <p className="lo-tr-convite__texto">
              {ativa.olhar === 'arbitro' ? 'Você está arbitrando uma luta agora' : 'Você está numa luta agora'}, rodada {ativa.turnos.rodada}. Uma luta por vez.
            </p>
            <div className="lo-tr-vez__botoes">
              <button type="button" className="lo-btn lo-btn--primario" onClick={() => setForaDaTela(null)}>
                Voltar à luta
              </button>
            </div>
          </div>
        ) : assistida !== undefined ? (
          <div className="lo-tr-convite">
            <p className="lo-tr-convite__texto">Você está assistindo a uma luta, rodada {assistida.turnos.rodada}. Uma luta por vez: para criar ou aceitar outra, pare de assistir.</p>
            <div className="lo-tr-vez__botoes">
              <button type="button" className="lo-btn lo-btn--primario" onClick={() => setForaDaTela(null)}>
                Voltar a assistir
              </button>
              <button type="button" className="lo-btn" disabled={ocupado} onClick={() => site.lutas()?.parar(assistida.id)}>
                Parar de assistir
              </button>
            </div>
          </div>
        ) : minhaSala !== undefined ? null : criando ? (
          <CriarLuta campanha={campanha} ocupado={ocupado} onFechar={() => setCriando(false)} />
        ) : (
          <div className="lo-lu-chamada">
            <p className="lo-motivo">Mais de 2: times de qualquer tamanho ou todos contra todos. O mestre pode entrar como Judge ou como árbitro.</p>
            <button type="button" className="lo-btn" disabled={ocupado} onClick={() => setCriando(true)}>
              Criar uma luta
            </button>
          </div>
        )}
      </section>

      <section className="lo-tr-bloco" aria-labelledby="lutas-agora">
        <h2 id="lutas-agora" className="lo-tr-bloco__titulo">
          Lutas acontecendo agora
        </h2>
        {lutas.acontecendo.length === 0 ? (
          <p className="lo-vazio">Nenhuma luta agora. Quando alguém começar uma, ela aparece aqui para assistir.</p>
        ) : (
          <ul className="lo-tr-acabados">
            {lutas.acontecendo.map((luta) => (
              <ItemAcontecendo
                key={luta.id}
                luta={luta}
                minhaComo={luta.id === ativa?.id ? 'luta' : luta.id === assistida?.id ? 'assistindo' : null}
                presa={naFrente !== undefined}
                ocupado={ocupado}
                onVoltar={() => setForaDaTela(null)}
              />
            ))}
          </ul>
        )}
        {naFrente !== undefined && outrasAcontecendo && (
          <p className="lo-motivo">Uma luta por vez: para assistir outra, {ativa !== undefined ? 'saia da sua antes' : 'pare de assistir esta antes'}.</p>
        )}
      </section>

      <section className="lo-tr-bloco" aria-labelledby="lutas-historico">
        <h2 id="lutas-historico" className="lo-tr-bloco__titulo">
          Histórico de lutas
        </h2>
        {historico.lista.length === 0 ? (
          <p className="lo-vazio">{historico.carregando ? 'Abrindo o histórico…' : 'Nenhuma luta acabou ainda nesta mesa.'}</p>
        ) : (
          <ul className="lo-lu-historicos">
            {historico.lista.map((luta) => (
              <ItemDoHistorico
                key={luta.id}
                luta={luta}
                agora={agora}
                aberta={historico.aberta}
                abrindo={historico.abrindo === luta.id}
                onAbrir={() => site.lutas()?.abrirDoHistorico(luta.id)}
                onFecharRegistro={() => site.lutas()?.fecharDoHistorico()}
              />
            ))}
          </ul>
        )}
        {historico.temMais && (
          <div className="lo-tr-vez__botoes">
            <button type="button" className="lo-btn lo-btn--fantasma" disabled={historico.carregando} onClick={() => site.lutas()?.maisHistorico()}>
              {historico.carregando ? 'Abrindo…' : 'Ver lutas mais antigas'}
            </button>
          </div>
        )}
      </section>

      {naArena !== undefined && (
        <LutaNaArena
          // Uma luta, uma Arena: trocar de luta não herda a mira, o recado nem o painel.
          key={naArena.id}
          luta={naArena}
          eu={eu}
          conectado={lutas.emDia && campanha.conexao === 'em-dia'}
          ocupado={ocupado}
          recusa={recusa}
          onFechar={() => {
            if (naArena.fim === null) setForaDaTela(naArena.id)
            else setRevendo(null)
          }}
        />
      )}
    </>
  )
}
