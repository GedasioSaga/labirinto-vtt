import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FogoDoJogador, FogoParaOJogo } from '../../../player/estadoDoFogo'
import { FOGO_REPASSE_MS, type FogoEntrada, type FogoPlacar, type FogoResumoDoPlacar, type FogoStatus } from '../../../net/protocoloDoFogo'
import { ALTURAS_FOGO, DIFICULDADES_FOGO, FERRAMENTAS_FOGO, type DificuldadeFogo, type FerramentaFogo } from '../tipos'
import { criarPonteDoJogo, type EstadoDaPonte, type PonteDoJogo } from './ponteDoJogo'
import {
  AVISO_MOUSE_E_TECLADO_FOGO,
  CONTROLES_DO_FOGO,
  DICA_DA_FERRAMENTA_FOGO,
  ERRO_DA_CARGA_DEMORADA,
  ERRO_DO_JOGO_AUSENTE,
  MOTIVO_DO_ENCERRAMENTO_FOGO,
  NOME_DA_DIFICULDADE_FOGO,
  NOME_DA_FERRAMENTA_FOGO,
  NOME_DO_JOGO_FOGO,
  NOME_DO_RESULTADO_FOGO,
  fogosApagadosFogo,
  fraseDoModoFogo,
  fraseDoMotivoFogo,
  linhaDaAlturaFogo,
} from './textos'
import './fogo.css'

/**
 * A TELA DO FOGO NA FLORESTA no jogador, por cima do mapa: o convite (com a
 * ferramenta escolhida ao entrar), o jogo num iframe (carregado já no convite,
 * escondido, para o `pronto` chegar antes do "Começar") e o resultado.
 *
 * O jogo é em primeira pessoa (ponte versão 2): o clique no jogo prende o
 * mouse (`allow="pointer-lock"`) e não há controle de toque.
 *
 * O jogo é um export web do Godot servido pelo mestre em `ROTA_DO_FOGO`
 * (`ponteDoJogo.ts` fala com ele). As entradas dos colegas chegam pelo
 * canal da conexão (`ouvirFogo`), sem passar pelo estado da tela.
 */

/** Onde o mestre serve o jogo (a mesma origem da página do jogador). */
export const ROTA_DO_FOGO = '/minigames/fogo/'
export const URL_DO_JOGO_FOGO = `${ROTA_DO_FOGO}index.html`

/**
 * De onde ESTA página carrega o jogo. A do jogador servida pela sala (e o
 * Vite em dev) acha o jogo na própria origem. Uma página do app instalado (a
 * Visão de jogador do mestre) não tem sala: a URL relativa caía no resolver
 * do Tauri, que responde caminho desconhecido com o `index.html` do editor, e
 * o jogo nunca dizia `pronto`. Ela busca no protocolo `minigame` do app
 * (`net/protocolo_minigame.rs`), que lê o pacote baixado.
 */
export function urlDoJogoFogoPara(local: Pick<Location, 'protocol' | 'hostname'>): string {
  if (local.protocol === 'tauri:') return 'minigame://localhost/fogo/index.html'
  if (local.hostname === 'tauri.localhost') return `${local.protocol}//minigame.localhost/fogo/index.html`
  return URL_DO_JOGO_FOGO
}
/**
 * Até quando esperar o `pronto` do jogo: são ~38 MB do motor (10 MB com gzip),
 * e numa rede local fraca isso leva meio minuto. Passou disso, é erro.
 */
const FOGO_CARGA_MAX_MS = 90_000

export interface AcoesDoFogo {
  /** No convite `sozinho` (o "Apagar o fogo" do pino), leva a dificuldade e já começa. */
  prontoFogo(ferramenta: FerramentaFogo, dificuldade?: DificuldadeFogo): boolean
  entradasFogo(de: number, lista: FogoEntrada[]): boolean
  hashFogo(tique: number, hash: number): boolean
  fimFogo(tique: number, hash: number, placar: FogoPlacar): boolean
  fecharFogo(): void
  falhouFogo(): boolean
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

/** A ferramenta que o mestre deu a este jogador no convite (a sugestão inicial). */
function ferramentaDoConvite(fogo: FogoDoJogador, playerId: string | undefined): FerramentaFogo {
  const doEstado = fogo.estado?.participantes.find((p) => p.playerId === playerId)?.ferramenta
  return doEstado ?? fogo.convite.participantes.find((p) => p.playerId === playerId)?.ferramenta ?? FERRAMENTAS_FOGO[0]
}

function TelaDoFogo({ fogo, playerId, acoes, urlDoJogo = urlDoJogoFogoPara(window.location) }: FogoOverlayProps) {
  const quadroRef = useRef<HTMLIFrameElement>(null)
  const ponteRef = useRef<PonteDoJogo | null>(null)
  const acoesRef = useRef(acoes)
  acoesRef.current = acoes
  const [estadoDoJogo, setEstadoDoJogo] = useState<EstadoDaPonte>('carregando')
  const [erroDoJogo, setErroDoJogo] = useState<string | null>(null)
  const [ferramenta, setFerramenta] = useState<FerramentaFogo>(() => fogo.pronto ?? ferramentaDoConvite(fogo, playerId))

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
        // Jogo quebrado aqui: o mestre fica sabendo, e ninguém da equipe espera por este aparelho.
        if (estado === 'erro') acoesRef.current.falhouFogo()
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
    // O jogo que não chega vira erro, em vez de "Carregando" para sempre: o prazo
    // pega o download que caiu; a conferência pega na hora a rota que o mestre não serve.
    let viva = true
    const prazo = window.setTimeout(() => ponte.falhouCarga(ERRO_DA_CARGA_DEMORADA), FOGO_CARGA_MAX_MS)
    const conferencia = new AbortController()
    fetch(urlDoJogo, { method: 'HEAD', cache: 'no-store', signal: conferencia.signal })
      .then((resposta) => {
        if (viva && !resposta.ok) ponte.falhouCarga(ERRO_DO_JOGO_AUSENTE)
      })
      // Sem resposta (rede caída, ou a tela fechou e abortou): quem decide é o prazo.
      .catch(() => undefined)
    return () => {
      viva = false
      conferencia.abort()
      window.clearTimeout(prazo)
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
  // `parou`: a partida começou, mas o jogo quebrou neste aparelho (o mestre já foi avisado).
  const tela =
    fogo.desfecho !== undefined ? 'resultado' : encerrada !== undefined ? 'encerrada' : emJogo ? (estadoDoJogo === 'erro' ? 'parou' : 'jogo') : 'convite'

  return (
    <div className={`lb-fogo lb-fogo--${tela}`} role="dialog" aria-modal="true" aria-label={NOME_DO_JOGO_FOGO}>
      {/* pointer-lock: o clique no jogo prende o mouse, que vira o olhar (primeira pessoa). */}
      <iframe
        ref={quadroRef}
        className="lb-fogo__jogo"
        src={urlDoJogo}
        title={`${NOME_DO_JOGO_FOGO}: o jogo`}
        allow="autoplay; fullscreen; gamepad; pointer-lock"
        aria-hidden={tela !== 'jogo'}
        tabIndex={tela === 'jogo' ? 0 : -1}
      />
      {tela === 'convite' && (
        <Convite fogo={fogo} playerId={playerId} ferramenta={ferramenta} setFerramenta={setFerramenta} estadoDoJogo={estadoDoJogo} erroDoJogo={erroDoJogo} acoes={acoes} />
      )}
      {tela === 'jogo' && (
        <div className="lb-fogo__barra" aria-live="polite">
          <span>
            {NOME_DO_JOGO_FOGO} · {comecar === undefined ? '' : NOME_DA_DIFICULDADE_FOGO[comecar.dificuldade]} · {fogo.convite.modo === 'equipe' ? 'Equipe' : 'Solo'}
          </span>
          {estadoDoJogo === 'carregando' && <span>Carregando o jogo…</span>}
          {fogo.pausada && <span className="lb-fogo__selo">Pausado pelo mestre</span>}
          {fogo.fimEnviado && <span className="lb-fogo__selo">Esperando os colegas terminarem…</span>}
        </div>
      )}
      {tela === 'parou' && (
        <div className="lb-fogo__cartao" role="alert">
          <h2 className="lb-fogo__titulo">{NOME_DO_JOGO_FOGO}</h2>
          <p>O jogo parou neste aparelho{erroDoJogo === null ? '' : ` (${erroDoJogo})`}. Você saiu da partida e o mestre já sabe.</p>
          <button type="button" className="lb-btn lb-btn--primary" onClick={acoes.fecharFogo}>
            Voltar ao mapa
          </button>
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
  ferramenta: FerramentaFogo
  setFerramenta(ferramenta: FerramentaFogo): void
  estadoDoJogo: EstadoDaPonte
  erroDoJogo: string | null
  acoes: AcoesDoFogo
}

/** Como cada chamado aparece na lista do convite. */
function statusNoConvite(status: FogoStatus | undefined): string {
  if (status === 'pronto') return 'Pronto'
  if (status === 'fora') return 'Ficou de fora'
  return 'Esperando'
}

function Convite({ fogo, playerId, ferramenta, setFerramenta, estadoDoJogo, erroDoJogo, acoes }: ConviteProps) {
  const c = fogo.convite
  const pronto = fogo.pronto
  const solo = c.modo === 'solo'
  // SOZINHO NO PINO: ninguém espera o mestre. A dificuldade é a que ele deixou;
  // na "escolha", o jogador escolhe aqui, e o "Começar" já abre o incêndio.
  const sozinho = c.sozinho
  const [dificuldade, setDificuldade] = useState<DificuldadeFogo>(() => (sozinho === undefined || sozinho.permitida === 'escolha' ? 'normal' : sozinho.permitida))
  // Só com o jogo carregado: Pronto sem jogo deixaria a equipe esperando entradas que nunca saem.
  const jogoCarregado = estadoDoJogo === 'esperando'
  const statusDe = (id: string) => fogo.estado?.participantes.find((p) => p.playerId === id)
  return (
    <div className="lb-fogo__cartao">
      <p className="lb-fogo__eyebrow">
        {NOME_DO_JOGO_FOGO} · {c.floresta} · {sozinho !== undefined ? 'sozinho' : solo ? 'cada um no seu incêndio' : 'em equipe'}
      </p>
      <h2 className="lb-fogo__titulo">{c.npc === '' ? 'Pedido de ajuda' : c.npc}</h2>
      {c.fala !== '' && <p className="lb-fogo__fala">“{c.fala}”</p>}
      {c.premio.texto !== '' && <p className="lb-fogo__premio">Se salvarem a vila: {c.premio.texto}</p>}
      <p className="lb-fogo__aviso" role="note">
        {AVISO_MOUSE_E_TECLADO_FOGO}
      </p>
      <fieldset className="lb-fogo__ferramentas">
        <legend>{solo ? 'Sua ferramenta principal' : 'Sua ferramenta ao entrar'}</legend>
        {FERRAMENTAS_FOGO.map((f) => (
          <label key={f} className="lb-fogo__ferramenta">
            <input type="radio" name={`fogo-ferramenta-${fogo.sessao}`} value={f} checked={ferramenta === f} onChange={() => setFerramenta(f)} />
            <span className="lb-fogo__ferramenta-nome">{NOME_DA_FERRAMENTA_FOGO[f]}</span>
            <span className="lb-fogo__ferramenta-dica">{DICA_DA_FERRAMENTA_FOGO[f]}</span>
          </label>
        ))}
      </fieldset>
      <p className="lb-fogo__dica">
        {solo
          ? 'Sozinho, só conta o fogo da sua ferramenta principal: as outras alturas também queimam, mais fracas, e atrapalham. No caminhão dá para trocar de ferramenta, mas a principal não muda.'
          : 'Em equipe as 3 alturas contam. Pode repetir ferramenta; no caminhão cada um troca a sua.'}
      </p>
      {sozinho !== undefined &&
        (sozinho.permitida === 'escolha' ? (
          <fieldset className="lb-fogo__ferramentas">
            <legend>Dificuldade</legend>
            {DIFICULDADES_FOGO.map((d) => (
              <label key={d} className="lb-fogo__ferramenta">
                <input type="radio" name={`fogo-dificuldade-${fogo.sessao}`} value={d} checked={dificuldade === d} onChange={() => setDificuldade(d)} />
                <span className="lb-fogo__ferramenta-nome">{NOME_DA_DIFICULDADE_FOGO[d]}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <p className="lb-fogo__dica">Dificuldade: {NOME_DA_DIFICULDADE_FOGO[sozinho.permitida]} (o mestre escolheu).</p>
        ))}
      <p className="lb-fogo__dica">{CONTROLES_DO_FOGO}</p>
      {sozinho === undefined && (
        <ul className="lb-fogo__equipe" aria-label="Quem foi chamado">
          {c.participantes.map((p) => {
            const st = statusDe(p.playerId)
            return (
              <li key={p.playerId}>
                <span className="lb-fogo__nome">{p.playerId === playerId ? `${p.nome} (você)` : p.nome}</span>
                <span>{NOME_DA_FERRAMENTA_FOGO[st?.ferramenta ?? p.ferramenta]}</span>
                <span>{statusNoConvite(st?.status)}</span>
              </li>
            )
          })}
        </ul>
      )}
      <div className="lb-fogo__acoes">
        {sozinho !== undefined ? (
          <button type="button" className="lb-btn lb-btn--primary" disabled={!jogoCarregado || pronto !== undefined} onClick={() => acoes.prontoFogo(ferramenta, dificuldade)}>
            {pronto === undefined ? 'Começar' : 'Começando…'}
          </button>
        ) : (
          <button type="button" className="lb-btn lb-btn--primary" disabled={!jogoCarregado || pronto === ferramenta} onClick={() => acoes.prontoFogo(ferramenta)}>
            {pronto === undefined ? 'Pronto' : pronto === ferramenta ? 'Pronto: esperando o mestre começar' : 'Trocar para esta ferramenta'}
          </button>
        )}
        <button type="button" className="lb-btn lb-btn--ghost" onClick={acoes.fecharFogo}>
          Agora não
        </button>
      </div>
      <p className="lb-fogo__dica" aria-live="polite">
        {estadoDoJogo === 'carregando'
          ? `Carregando o jogo… o ${sozinho === undefined ? 'Pronto' : 'Começar'} libera quando terminar.`
          : estadoDoJogo === 'erro'
            ? `O jogo não carregou${erroDoJogo === null ? '' : ` (${erroDoJogo})`}. Avise o mestre.`
            : 'Jogo carregado.'}
      </p>
    </div>
  )
}

/** O placar do time (no solo, o do próprio jogador): como acabou, os números, o que contou e cada altura. */
function PlacarDoTime({ placar: p }: { placar: FogoResumoDoPlacar }) {
  const motivo = fraseDoMotivoFogo(p.motivo)
  return (
    <>
      {motivo !== null && <p className="lb-fogo__motivo">{motivo}</p>}
      <p className="lb-fogo__numeros">
        {p.pontos} pontos · {p.estrelas} {p.estrelas === 1 ? 'estrela' : 'estrelas'} · floresta viva {p.florestaViva}% · {p.casas} {p.casas === 1 ? 'casa' : 'casas'} de pé
      </p>
      <p className="lb-fogo__dica">{fraseDoModoFogo(p)}</p>
      <ul className="lb-fogo__alturas" aria-label="Como ficou cada altura do fogo">
        {ALTURAS_FOGO.map((a) => (
          <li key={a} className={p.contam.includes(a) ? undefined : 'lb-fogo__altura--nao-conta'}>
            {linhaDaAlturaFogo(a, p.alturas[a], p.contam.includes(a))}
          </li>
        ))}
      </ul>
    </>
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
      {p !== undefined && <PlacarDoTime placar={p} />}
      {d.seu.premio !== undefined && <p className="lb-fogo__premio">{d.seu.premio.texto}</p>}
      {d.seu.consequencia !== undefined && <p className="lb-fogo__consequencia">{d.seu.consequencia.texto}</p>}
      <ul className="lb-fogo__equipe" aria-label="Como foi cada um">
        {d.mesa.map((linha) => (
          <li key={linha.playerId}>
            <span className="lb-fogo__nome">{linha.playerId === playerId ? `${linha.nome} (você)` : linha.nome}</span>
            <span>{NOME_DA_FERRAMENTA_FOGO[linha.ferramenta]}</span>
            <span>
              {NOME_DO_RESULTADO_FOGO[linha.resultado]} · {linha.pontos} pontos · {fogosApagadosFogo(linha.fogoCerto)}
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
