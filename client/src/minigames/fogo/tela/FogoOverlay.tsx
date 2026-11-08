import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FogoDoJogador, FogoParaOJogo } from '../../../player/estadoDoFogo'
import { FOGO_REPASSE_MS, type FogoEntrada, type FogoPlacar } from '../../../net/protocoloDoFogo'
import { FUNCOES_FOGO, type FuncaoFogo } from '../tipos'
import { criarPonteDoJogo, type EstadoDaPonte, type PonteDoJogo } from './ponteDoJogo'
import {
  CONTROLES_DO_FOGO,
  DICA_DA_FUNCAO_FOGO,
  MOTIVO_DO_ENCERRAMENTO_FOGO,
  NOME_DA_DIFICULDADE_FOGO,
  NOME_DA_FUNCAO_FOGO,
  NOME_DO_JOGO_FOGO,
  NOME_DO_RESULTADO_FOGO,
} from './textos'
import './fogo.css'

/**
 * A TELA DO FOGO NA FLORESTA no jogador, por cima do mapa: o convite (com a
 * função escolhida ao entrar), o jogo num iframe (carregado já no convite,
 * escondido, para o `pronto` chegar antes do "Começar") e o resultado.
 *
 * O jogo é um export web do Godot servido pelo mestre em `ROTA_DO_FOGO`
 * (`ponteDoJogo.ts` fala com ele). As entradas dos colegas chegam pelo
 * canal da conexão (`ouvirFogo`), sem passar pelo estado da tela.
 */

/** Onde o mestre serve o jogo (a mesma origem da página do jogador). */
export const ROTA_DO_FOGO = '/minigames/fogo/'
export const URL_DO_JOGO_FOGO = `${ROTA_DO_FOGO}index.html`

export interface AcoesDoFogo {
  prontoFogo(funcao: FuncaoFogo): boolean
  entradasFogo(de: number, lista: FogoEntrada[]): boolean
  hashFogo(tique: number, hash: number): boolean
  fimFogo(tique: number, hash: number, placar: FogoPlacar): boolean
  fecharFogo(): void
  ouvirFogo(ouvinte: (msg: FogoParaOJogo) => void): () => void
}

export interface FogoOverlayProps {
  fogo: FogoDoJogador
  playerId: string | undefined
  acoes: AcoesDoFogo
  /** Troca para a mesa de prova; o app usa a rota do mestre. */
  urlDoJogo?: string
}

export function FogoOverlay(props: FogoOverlayProps) {
  return createPortal(<TelaDoFogo key={props.fogo.sessao} {...props} />, document.body)
}

/** A função que o mestre deu a este jogador no convite (a sugestão inicial). */
function funcaoDoConvite(fogo: FogoDoJogador, playerId: string | undefined): FuncaoFogo {
  const doEstado = fogo.estado?.participantes.find((p) => p.playerId === playerId)?.funcao
  return doEstado ?? fogo.convite.participantes.find((p) => p.playerId === playerId)?.funcao ?? 'bombeiro'
}

function TelaDoFogo({ fogo, playerId, acoes, urlDoJogo = URL_DO_JOGO_FOGO }: FogoOverlayProps) {
  const quadroRef = useRef<HTMLIFrameElement>(null)
  const ponteRef = useRef<PonteDoJogo | null>(null)
  const acoesRef = useRef(acoes)
  acoesRef.current = acoes
  const [estadoDoJogo, setEstadoDoJogo] = useState<EstadoDaPonte>('carregando')
  const [erroDoJogo, setErroDoJogo] = useState<string | null>(null)
  const [funcao, setFuncao] = useState<FuncaoFogo>(() => fogo.pronto ?? funcaoDoConvite(fogo, playerId))

  // A ponte vive enquanto a tela vive: um iframe por sessão (a `key` é a sessão).
  useEffect(() => {
    const origem = new URL(urlDoJogo, window.location.href).origin
    const ponte = criarPonteDoJogo({
      janela: () => quadroRef.current?.contentWindow ?? null,
      enviar: (texto) => quadroRef.current?.contentWindow?.postMessage(texto, origem),
      saida: {
        entradas: (de, lista) => acoesRef.current.entradasFogo(de, lista),
        hash: (tique, hash) => acoesRef.current.hashFogo(tique, hash),
        fim: (tique, hash, placar) => acoesRef.current.fimFogo(tique, hash, placar),
      },
      repassarMinhas: fogo.convite.modo === 'equipe',
      aoMudar: (estado, erro) => {
        setEstadoDoJogo(estado)
        if (erro !== undefined) setErroDoJogo(erro)
      },
    })
    ponteRef.current = ponte
    const aoReceber = (ev: MessageEvent) => ponte.receber({ source: ev.source, data: ev.data })
    window.addEventListener('message', aoReceber)
    const desligarCanal = acoesRef.current.ouvirFogo((msg) => {
      if (msg.type === 'fogo.entradas') ponte.entradasDosColegas(msg.lotes)
      else ponte.sair(msg.id, msg.depoisDe)
    })
    const repasse = window.setInterval(() => ponte.repassar(), FOGO_REPASSE_MS)
    return () => {
      window.clearInterval(repasse)
      desligarCanal()
      window.removeEventListener('message', aoReceber)
      ponteRef.current = null
    }
    // Uma ponte por sessão (a key): o modo não muda dentro dela, e as ações são lidas pela ref.
  }, [urlDoJogo])

  const comecar = fogo.comecar
  useEffect(() => {
    if (comecar === undefined || playerId === undefined) return
    ponteRef.current?.iniciar({ ...comecar, eu: playerId })
    // O teclado vai para o jogo: WASD e Espaço são dele daqui em diante.
    quadroRef.current?.focus()
  }, [comecar, playerId])

  useEffect(() => ponteRef.current?.pausar(fogo.pausada), [fogo.pausada])

  const encerrada = fogo.encerrada
  useEffect(() => {
    if (encerrada !== undefined) ponteRef.current?.encerrar()
  }, [encerrada])

  const emJogo = comecar !== undefined && encerrada === undefined && fogo.desfecho === undefined
  const tela = fogo.desfecho !== undefined ? 'resultado' : encerrada !== undefined ? 'encerrada' : emJogo ? 'jogo' : 'convite'

  return (
    <div className={`lb-fogo lb-fogo--${tela}`} role="dialog" aria-modal="true" aria-label={NOME_DO_JOGO_FOGO}>
      <iframe
        ref={quadroRef}
        className="lb-fogo__jogo"
        src={urlDoJogo}
        title={`${NOME_DO_JOGO_FOGO}: o jogo`}
        allow="autoplay; fullscreen; gamepad"
        aria-hidden={tela !== 'jogo'}
        tabIndex={tela === 'jogo' ? 0 : -1}
      />
      {tela === 'convite' && <Convite fogo={fogo} playerId={playerId} funcao={funcao} setFuncao={setFuncao} estadoDoJogo={estadoDoJogo} acoes={acoes} />}
      {tela === 'jogo' && (
        <div className="lb-fogo__barra" aria-live="polite">
          <span>
            {NOME_DO_JOGO_FOGO} · {comecar === undefined ? '' : NOME_DA_DIFICULDADE_FOGO[comecar.dificuldade]} · {fogo.convite.modo === 'equipe' ? 'Equipe' : 'Solo'}
          </span>
          {estadoDoJogo === 'carregando' && <span>Carregando o jogo…</span>}
          {fogo.pausada && <span className="lb-fogo__selo">Pausado pelo mestre</span>}
          {fogo.fimEnviado && <span className="lb-fogo__selo">Esperando os colegas terminarem…</span>}
          {erroDoJogo !== null && <span className="lb-fogo__selo lb-fogo__selo--erro">O jogo não começou: {erroDoJogo}</span>}
        </div>
      )}
      {tela === 'resultado' && fogo.desfecho !== undefined && <Resultado fogo={fogo} playerId={playerId} onFechar={acoes.fecharFogo} />}
      {tela === 'encerrada' && encerrada !== undefined && (
        <div className="lb-fogo__cartao" role="alert">
          <h2 className="lb-fogo__titulo">{NOME_DO_JOGO_FOGO}</h2>
          <p>{MOTIVO_DO_ENCERRAMENTO_FOGO[encerrada]}</p>
          <button type="button" className="lb-btn lb-btn--primary" onClick={acoes.fecharFogo}>
            Voltar ao mapa
          </button>
        </div>
      )}
    </div>
  )
}

interface ConviteProps {
  fogo: FogoDoJogador
  playerId: string | undefined
  funcao: FuncaoFogo
  setFuncao(funcao: FuncaoFogo): void
  estadoDoJogo: EstadoDaPonte
  acoes: AcoesDoFogo
}

function Convite({ fogo, playerId, funcao, setFuncao, estadoDoJogo, acoes }: ConviteProps) {
  const c = fogo.convite
  const pronto = fogo.pronto
  const statusDe = (id: string) => fogo.estado?.participantes.find((p) => p.playerId === id)
  return (
    <div className="lb-fogo__cartao">
      <p className="lb-fogo__eyebrow">
        {NOME_DO_JOGO_FOGO} · {c.floresta} · {c.modo === 'equipe' ? 'em equipe' : 'cada um no seu incêndio'}
      </p>
      <h2 className="lb-fogo__titulo">{c.npc === '' ? 'Pedido de ajuda' : c.npc}</h2>
      {c.fala !== '' && <p className="lb-fogo__fala">“{c.fala}”</p>}
      {c.premio.texto !== '' && <p className="lb-fogo__premio">Se salvarem a vila: {c.premio.texto}</p>}
      <fieldset className="lb-fogo__funcoes">
        <legend>Sua função ao entrar</legend>
        {FUNCOES_FOGO.map((f) => (
          <label key={f} className="lb-fogo__funcao">
            <input type="radio" name={`fogo-funcao-${fogo.sessao}`} value={f} checked={funcao === f} onChange={() => setFuncao(f)} />
            <span className="lb-fogo__funcao-nome">{NOME_DA_FUNCAO_FOGO[f]}</span>
            <span className="lb-fogo__funcao-dica">{DICA_DA_FUNCAO_FOGO[f]}</span>
          </label>
        ))}
      </fieldset>
      <p className="lb-fogo__dica">{CONTROLES_DO_FOGO} No caminhão dá para trocar de função.</p>
      <ul className="lb-fogo__equipe" aria-label="Quem foi chamado">
        {c.participantes.map((p) => {
          const st = statusDe(p.playerId)
          return (
            <li key={p.playerId}>
              <span className="lb-fogo__nome">{p.playerId === playerId ? `${p.nome} (você)` : p.nome}</span>
              <span>{NOME_DA_FUNCAO_FOGO[st?.funcao ?? p.funcao]}</span>
              <span>{st?.status === 'pronto' ? 'Pronto' : 'Esperando'}</span>
            </li>
          )
        })}
      </ul>
      <div className="lb-fogo__acoes">
        <button type="button" className="lb-btn lb-btn--primary" disabled={pronto === funcao} onClick={() => acoes.prontoFogo(funcao)}>
          {pronto === undefined ? 'Pronto' : pronto === funcao ? 'Pronto: esperando o mestre começar' : 'Trocar para esta função'}
        </button>
        <button type="button" className="lb-btn lb-btn--ghost" onClick={acoes.fecharFogo}>
          Agora não
        </button>
      </div>
      <p className="lb-fogo__dica" aria-live="polite">
        {estadoDoJogo === 'carregando' ? 'Carregando o jogo…' : estadoDoJogo === 'erro' ? 'O jogo não carregou. Avise o mestre.' : 'Jogo carregado.'}
      </p>
    </div>
  )
}

function Resultado({ fogo, playerId, onFechar }: { fogo: FogoDoJogador; playerId: string | undefined; onFechar(): void }) {
  const d = fogo.desfecho
  if (d === undefined) return null
  const p = d.placar
  return (
    <div className="lb-fogo__cartao" role="alert">
      <p className="lb-fogo__eyebrow">{NOME_DO_JOGO_FOGO}</p>
      <h2 className="lb-fogo__titulo">{d.seu.passou ? 'A vila está salva!' : 'O fogo venceu desta vez'}</h2>
      {p !== undefined && (
        <p className="lb-fogo__numeros">
          {p.pontos} pontos · {p.estrelas} {p.estrelas === 1 ? 'estrela' : 'estrelas'} · floresta viva {p.florestaViva}% · {p.casas} {p.casas === 1 ? 'casa' : 'casas'} de pé
        </p>
      )}
      {d.seu.premio !== undefined && <p className="lb-fogo__premio">{d.seu.premio.texto}</p>}
      {d.seu.consequencia !== undefined && <p className="lb-fogo__consequencia">{d.seu.consequencia.texto}</p>}
      <ul className="lb-fogo__equipe" aria-label="Como foi cada um">
        {d.mesa.map((linha) => (
          <li key={linha.playerId}>
            <span className="lb-fogo__nome">{linha.playerId === playerId ? `${linha.nome} (você)` : linha.nome}</span>
            <span>{NOME_DA_FUNCAO_FOGO[linha.funcao]}</span>
            <span>
              {NOME_DO_RESULTADO_FOGO[linha.resultado]} · {linha.pontos} pontos
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className="lb-btn lb-btn--primary" onClick={onFechar}>
        Voltar ao mapa
      </button>
    </div>
  )
}
