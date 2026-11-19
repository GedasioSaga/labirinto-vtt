import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type RefObject } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { resolverComBase } from '../../lib/midia'
import { baseDaMidiaConhecida, baseDaMidiaNoMestre, urlDoVideoNoMestre } from '../../lib/midiaNoDisco'
import { guardarQuadroDoVideo, pedirMiniaturaDoVideo } from '../../lib/miniaturaDoVideo'
import { CUTSCENE_TITULO_MAX } from '../../net/protocol'
import { assinarRedeDaCutscene, lugarDaRedeDaCutscene, redeDaCutscene, redeDaCutsceneEm, type LugarDaCutscene, type ResultadoDoTocar } from '../../net/redeDaCutscene'
import { GALERIA_VIDEO_MAX_BYTES, mensagemDaFalha, tirarDaGaleria } from '../../net/nuvem/galeriaNaNuvem'
import { DESFAZER_REMOCAO_MS, useCutscenesStore, VIDEO_MAX_BYTES, type Cutscene, type ExibicaoEmCurso } from '../../stores/cutscenesStore'
import { useToastStore } from '../../stores/toastStore'
import { Botao } from '../grimorio/Botao'
import { CampoLiga } from '../grimorio/CampoLiga'
import { CampoTexto } from '../grimorio/CampoTexto'
import { Dialogo } from '../grimorio/Dialogo'
import { PREFIXO_DO_TESTE } from '../dancaNoPainel'
import { TituloDaPagina } from './FolhaDoLivro'
import { IconeDoLivro } from './icones'
import { usePaginaAVista } from './paginaAVista'
import './cutscenes.css'

/**
 * CUTSCENES (14/11/2026, pedido do mestre): a página do livro da mesa onde o
 * mestre guarda os vídeos (mp4/webm até 500 MB, copiados para a mídia da mesa
 * pelo Rust, sem passar pela webview), toca para todos e acompanha quem já
 * baixou. O vídeo só toca quando todas as telas baixaram (sem prazo); o mestre
 * pode tocar já ou parar para todos. Com "Na Galeria", depois da 1ª exibição o
 * vídeo sobe para o site dos jogadores (até 150 MB).
 *
 * MINIATURA E ASSISTIR (18/11/2026, pedido do mestre): cada linha mostra o
 * quadro de ~1 s do vídeo (tirado sozinho, um vídeo por vez, quando a lista
 * carrega e quando um vídeo entra), e "Assistir" (ou o clique na miniatura)
 * toca o vídeo só para o mestre, do disco, sem sala: não marca "já tocou" nem
 * sobe para a Galeria. No "Assistir", "Usar este quadro como miniatura" troca
 * a imagem da linha.
 *
 * MODO TREINO (18/11/2026, pedido do mestre): com a janela da Visão de jogador
 * aberta, "Tocar para todos" toca só nela (o teste ganha da sala, como na
 * dança): a janela recebe o vídeo, toca junto e para com "Parar para todos",
 * e nada disso marca "já tocou" nem manda à Galeria. O painel do teste fica à
 * parte do da mesa.
 */

const MB = 1024 * 1024
/** Quanto as setas andam no vídeo do "Assistir", em segundos (o mesmo passo do player do navegador). */
const PASSO_DAS_SETAS_S = 5

interface VideoNaMidia {
  id: string
  tamanho: number
  mime: string
}

function ehVideoNaMidia(valor: unknown): valor is VideoNaMidia {
  if (typeof valor !== 'object' || valor === null) return false
  return 'id' in valor && typeof valor.id === 'string' && 'tamanho' in valor && typeof valor.tamanho === 'number'
}

function tamanhoLegivel(bytes: number): string {
  return `${(bytes / MB).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

/** O nome do arquivo sem pasta nem extensão, no teto do título. */
function tituloDoArquivo(caminho: string): string {
  const nome = caminho.split(/[\\/]/).pop() ?? 'Cutscene'
  const semExtensao = nome.replace(/\.[^.]+$/, '').replace(/[\r\n]+/g, ' ').trim()
  return (semExtensao === '' ? 'Cutscene' : semExtensao).slice(0, CUTSCENE_TITULO_MAX)
}

const FRASE_DO_TOCAR: Record<Exclude<ResultadoDoTocar, 'ok'>, string> = {
  'sem-jogador': 'Ninguém na mesa para ver: abra a sala e espere os jogadores entrarem.',
  'ja-tocando': 'Já há uma cutscene na mesa. Pare a de agora antes de tocar outra.',
  invalida: 'Esta cutscene tem um título ou vídeo fora do formato. Mude o título e tente de novo.',
}

/** No teste, "ninguém para ver" é a janela da Visão de jogador que ainda não entrou na sala de teste. */
const FRASE_DO_TOCAR_NO_TESTE: Record<Exclude<ResultadoDoTocar, 'ok'>, string> = {
  ...FRASE_DO_TOCAR,
  'sem-jogador': 'A janela da Visão de jogador ainda está abrindo. Espere a tela do jogador aparecer e toque de novo.',
  'ja-tocando': 'Já há uma cutscene na janela de teste. Pare a de agora antes de tocar outra.',
}

function avisar(tipo: 'error' | 'info', texto: string): void {
  useToastStore.getState().push(tipo, texto)
}

/** O começo das URLs da mídia neste computador; `null` enquanto o Tauri responde (ou fora do app). */
function useBaseDaMidia(): string | null {
  const [base, setBase] = useState(baseDaMidiaConhecida)
  useEffect(() => {
    if (base !== null) return
    let viva = true
    baseDaMidiaNoMestre().then(
      (achada) => {
        if (viva) setBase(achada)
      },
      () => undefined,
    )
    return () => {
      viva = false
    }
  }, [base])
  return base
}

/**
 * A miniatura da linha: o quadro guardado, ou o ícone do filme enquanto ele
 * não existe (ou não carrega). Clicar abre o "Assistir". Fora do Tab: a linha
 * já tem o botão "Assistir", e 200 linhas não ganham 200 paradas a mais.
 */
function MiniaturaDaCutscene({ cutscene, base, onAssistir }: { cutscene: Cutscene; base: string | null; onAssistir: () => void }) {
  const url = base === null || cutscene.miniatura === undefined ? null : resolverComBase(base)(cutscene.miniatura)
  const [falhou, setFalhou] = useState<string | null>(null)
  const [pronta, setPronta] = useState<string | null>(null)
  return (
    <button type="button" className="lb-cutscenes__mini" tabIndex={-1} aria-label={`Assistir ${cutscene.titulo}`} onClick={onAssistir}>
      {url !== null && falhou !== url ? (
        <img src={url} alt="" width={112} height={63} decoding="async" draggable={false} data-pronta={pronta === url} onLoad={() => setPronta(url)} onError={() => setFalhou(url)} />
      ) : (
        <span className="lb-cutscenes__mini-icone">
          <IconeDoLivro nome="filme" />
        </span>
      )}
      <span className="lb-cutscenes__mini-play" aria-hidden="true">
        <IconeDoLivro nome="play" />
      </span>
    </button>
  )
}

type AvisoDoQuadro = { tipo: 'ok' | 'erro'; texto: string }

/**
 * O vídeo do "Assistir", do disco deste computador. Tenta com `crossOrigin`
 * (para poder tirar o quadro); se a ponte de arquivos recusar assim, abre sem
 * ele, e o vídeo toca mas o quadro não sai.
 */
function TelaDoAssistir({ cutscene, aberto, video }: { cutscene: Cutscene; aberto: boolean; video: RefObject<HTMLVideoElement | null> }) {
  const [url, setUrl] = useState<string | null>(null)
  const [semCors, setSemCors] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [temQuadro, setTemQuadro] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<AvisoDoQuadro | null>(null)

  useEffect(() => {
    let viva = true
    urlDoVideoNoMestre(cutscene.video).then(
      (achada) => {
        if (!viva) return
        if (achada === null) setErro('Este vídeo está fora do formato da mídia da mesa.')
        else setUrl(achada)
      },
      () => {
        if (viva) setErro('O vídeo só abre no app do Labirinto, com a mídia deste computador.')
      },
    )
    return () => {
      viva = false
    }
  }, [cutscene.video])

  // Fechou: o som para já, sem esperar a janela sair.
  useEffect(() => {
    if (!aberto) video.current?.pause()
  }, [aberto, video])

  // O vídeo entra depois da janela (a URL chega da ponte de arquivos): o foco vai para ele, e o Espaço pausa em vez de
  // apertar o "Fechar", onde a janela pôs o foco ao abrir.
  useEffect(() => {
    if (url !== null) video.current?.focus({ preventScroll: true })
  }, [url, semCors, video])

  const usarQuadro = async () => {
    const elemento = video.current
    // O botão não fica `disabled` enquanto grava: o botão desligado com o foco nele solta o foco para o `body`, e de
    // lá o Esc não fecha a janela (vai para os atalhos do mapa). O segundo clique no meio só não faz nada.
    if (elemento === null || guardando) return
    setGuardando(true)
    setAviso(null)
    const miniatura = await guardarQuadroDoVideo(elemento)
    setGuardando(false)
    if (miniatura === null) {
      setAviso({ tipo: 'erro', texto: 'Não deu para tirar este quadro. Tente outro ponto do vídeo.' })
      return
    }
    useCutscenesStore.getState().mudar(cutscene.id, { miniatura })
    setAviso({ tipo: 'ok', texto: 'Pronto: a miniatura agora é este quadro.' })
  }

  return (
    <div className="lb-assistir">
      {url !== null && erro === null && (
        <video
          // Sem o `crossOrigin` é outro pedido: o elemento novo abre o vídeo de novo.
          key={semCors ? 'sem-cors' : 'com-cors'}
          ref={video}
          className="lb-assistir__video"
          src={url}
          crossOrigin={semCors ? undefined : 'anonymous'}
          controls
          autoPlay
          playsInline
          preload="auto"
          tabIndex={0}
          aria-label={`Vídeo: ${cutscene.titulo}`}
          onLoadedData={() => setTemQuadro(true)}
          onError={() => {
            setTemQuadro(false)
            if (!semCors) setSemCors(true)
            else setErro('Não deu para abrir este vídeo. O arquivo pode ter saído da pasta da mídia, ou o formato não toca neste computador.')
          }}
        />
      )}
      {url === null && erro === null && <p className="lb-cutscenes__nota">Abrindo o vídeo…</p>}
      {erro !== null && (
        <p className="lb-cutscenes__nota lb-cutscenes__nota--erro" role="alert">
          {erro}
        </p>
      )}
      {erro === null && (
        <div className="lb-assistir__acoes">
          <Botao variante="latao" tamanho="p" disabled={!temQuadro || semCors} aria-busy={guardando} onClick={() => void usarQuadro()}>
            <IconeDoLivro nome="imagem" />
            {guardando ? 'Guardando o quadro…' : 'Usar este quadro como miniatura'}
          </Botao>
          <p className={aviso?.tipo === 'erro' ? 'lb-cutscenes__nota lb-cutscenes__nota--erro' : 'lb-cutscenes__nota'} aria-live="polite">
            {semCors ? 'Neste computador o vídeo toca, mas não deixa tirar quadro.' : (aviso?.texto ?? '')}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * "Assistir": o vídeo toca só para o mestre, numa janela sobre o livro. Esc
 * fecha; com o vídeo em foco, Espaço e K tocam e pausam e as setas andam 5 s.
 * O Espaço é do próprio player: o Chromium (e o WebView2, o mesmo motor)
 * alterna o vídeo focado no SOLTAR da tecla, e alternar aqui no apertar
 * desfaria o dele. K e as setas o player não tem: são daqui.
 */
function AssistirCutscene({ cutsceneId, onFechar }: { cutsceneId: string | null; onFechar: () => void }) {
  const lista = useCutscenesStore((estado) => estado.lista)
  const video = useRef<HTMLVideoElement>(null)
  // A última aberta fica enquanto a janela sai, com o vídeo ainda nela.
  const [ultimaId, setUltimaId] = useState(cutsceneId)
  if (cutsceneId !== null && cutsceneId !== ultimaId) setUltimaId(cutsceneId)
  const cutscene = lista.find((c) => c.id === ultimaId)
  const aberto = cutsceneId !== null && cutscene !== undefined

  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    const elemento = video.current
    // Só com o vídeo em foco: num botão, o Espaço é do botão.
    if (elemento === null || evento.target !== elemento) return
    if (evento.key === ' ') {
      // Só não deixa a janela rolar: quem toca e pausa é o player, no soltar.
      evento.preventDefault()
      return
    }
    if (evento.key === 'k' || evento.key === 'K') {
      if (elemento.paused) void elemento.play().catch(() => undefined)
      else elemento.pause()
    } else if (evento.key === 'ArrowLeft') {
      elemento.currentTime = Math.max(0, elemento.currentTime - PASSO_DAS_SETAS_S)
    } else if (evento.key === 'ArrowRight') {
      const adiante = elemento.currentTime + PASSO_DAS_SETAS_S
      elemento.currentTime = Number.isFinite(elemento.duration) ? Math.min(elemento.duration, adiante) : adiante
    } else {
      return
    }
    // O player do navegador não repete a mesma tecla.
    evento.preventDefault()
  }

  return (
    <Dialogo
      aberto={aberto}
      titulo={cutscene?.titulo ?? 'Cutscene'}
      descricao="Só nesta tela: não toca para a mesa e não conta como exibida."
      onFechar={onFechar}
      classe="lb-assistir-dlg"
      focoInicial={video}
      aoTeclar={teclar}
    >
      {cutscene !== undefined && <TelaDoAssistir key={cutscene.id} cutscene={cutscene} aberto={aberto} video={video} />}
    </Dialogo>
  )
}

/** "1:05": minutos e segundos do tempo decorrido. */
function tempoLegivel(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** O relógio do painel: anda de segundo em segundo só enquanto a exibição toca. */
function useTempoDecorrido(desde: number | undefined): string | null {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (desde === undefined) return
    setAgora(Date.now())
    const relogio = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(relogio)
  }, [desde])
  return desde === undefined ? null : tempoLegivel(agora - desde)
}

/** O painel da exibição de um lugar: os botões falam só com a rede dele (a da mesa segue parável com o teste aberto). */
function PainelDaExibicao({ exibicao, lugar }: { exibicao: ExibicaoEmCurso; lugar: LugarDaCutscene }) {
  const prontas = exibicao.telas.filter((tela) => tela.pronta).length
  const esperando = exibicao.fase === 'esperando'
  const noTeste = lugar === 'teste'
  const decorrido = useTempoDecorrido(esperando ? undefined : exibicao.tocandoDesde)
  const tocando = `${noTeste ? 'Tocando na Visão de jogador' : 'Tocando na mesa'}${decorrido === null ? '' : ` há ${decorrido}`}`
  return (
    <section className="lb-cutscenes__painel" aria-label={noTeste ? 'Cutscene no teste' : 'Cutscene na mesa'} data-lugar={lugar}>
      <p className="lb-cutscenes__painel-titulo">
        <strong>{exibicao.titulo}</strong>
        {/* O relógio muda a cada segundo: fora do aria-live, para o leitor de tela não ler o tempo sem parar. */}
        <span className="lb-cutscenes__painel-tempo">{esperando ? `Baixando: ${prontas} de ${exibicao.telas.length} telas prontas` : tocando}</span>
      </p>
      <ul className="lb-cutscenes__telas">
        {exibicao.telas.map((tela) => (
          <li key={tela.clientId} className="lb-cutscenes__tela" data-falhou={tela.falhou}>
            <span className="lb-cutscenes__tela-nome">{noTeste ? `${PREFIXO_DO_TESTE}${tela.nome}` : tela.nome}</span>
            <span className="lb-cutscenes__tela-estado">{tela.falhou ? 'não chegou' : tela.terminou ? 'terminou' : tela.pronta ? 'pronta' : `${tela.pct}%`}</span>
            <span className="lb-cutscenes__barra" aria-hidden="true">
              <span className="lb-cutscenes__cheio" style={{ transform: `scaleX(${tela.pct / 100})` }} />
            </span>
          </li>
        ))}
      </ul>
      <div className="lb-cutscenes__acoes">
        {esperando && (
          <Botao variante="latao" tamanho="p" onClick={() => redeDaCutsceneEm(lugar)?.tocarAgora()}>
            Tocar agora
          </Botao>
        )}
        <Botao variante="perigo" tamanho="p" onClick={() => redeDaCutsceneEm(lugar)?.parar()}>
          Parar para todos
        </Botao>
      </div>
    </section>
  )
}

function EstadoDaGaleria({ cutscene }: { cutscene: Cutscene }) {
  const galeria = cutscene.galeria
  if (cutscene.tamanho > GALERIA_VIDEO_MAX_BYTES) return <p className="lb-cutscenes__nota">Passa de 150 MB: fica só na mesa, não vai para a Galeria.</p>
  if (!cutscene.naGaleria || galeria === undefined) return cutscene.naGaleria ? <p className="lb-cutscenes__nota">Vai para a Galeria do site depois da 1ª exibição.</p> : null
  switch (galeria.estado) {
    case 'enviando':
      return <p className="lb-cutscenes__nota">Subindo para a Galeria: {galeria.pct}%</p>
    case 'enviado':
      return <p className="lb-cutscenes__nota">Na Galeria do site.</p>
    case 'grande':
      return <p className="lb-cutscenes__nota">Passa de 150 MB: fica só na mesa, não vai para a Galeria.</p>
    case 'erro':
      return (
        <p className="lb-cutscenes__nota lb-cutscenes__nota--erro">
          {galeria.erro}{' '}
          <button type="button" className="lb-cutscenes__link" onClick={() => void useCutscenesStore.getState().enviarParaAGaleria(cutscene.id)}>
            Tentar de novo
          </button>
        </p>
      )
  }
}

/**
 * REMOVER (18/11/2026, análise Fable): a linha sai na hora, com "Desfazer" no
 * aviso; o vídeo (até 500 MB) só sai da mídia da mesa quando o prazo do
 * Desfazer acaba e nenhuma outra linha usa o mesmo arquivo (`cutscenesStore`).
 */
function removerComDesfazer(cutscene: Cutscene): void {
  const loja = useCutscenesStore.getState()
  if (!loja.remover(cutscene.id)) return
  useToastStore.getState().push('info', `"${cutscene.titulo}" saiu da lista. O vídeo sai do disco em ${DESFAZER_REMOCAO_MS / 1000} s.`, DESFAZER_REMOCAO_MS, {
    actions: [{ label: 'Desfazer', run: () => useCutscenesStore.getState().desfazerRemocao(cutscene.id) }],
  })
}

/**
 * O vídeo que está na Galeria do site: remover só da lista deixaria o vídeo lá
 * sem o botão de tirar (só pelo site). A janela pergunta qual dos dois.
 */
function ConfirmarRemocaoDaGaleria({ cutscene, onFechar }: { cutscene: Cutscene | null; onFechar: () => void }) {
  const [tirando, setTirando] = useState(false)
  const [ultima, setUltima] = useState(cutscene)
  if (cutscene !== null && cutscene !== ultima) setUltima(cutscene)
  const tirarERemover = async () => {
    const galeria = ultima?.galeria
    if (ultima === null || galeria?.estado !== 'enviado' || tirando) return
    setTirando(true)
    try {
      await tirarDaGaleria(galeria.campanhaId, ultima.video)
      removerComDesfazer(ultima)
      onFechar()
      void useCutscenesStore.getState().conferirGaleria()
    } catch (erro) {
      avisar('error', mensagemDaFalha(erro))
    } finally {
      setTirando(false)
    }
  }
  return (
    <Dialogo
      aberto={cutscene !== null}
      titulo="Remover a cutscene?"
      descricao={ultima === null ? undefined : `"${ultima.titulo}" está na Galeria do site dos jogadores.`}
      onFechar={onFechar}
      pequeno
    >
      <p className="lb-cutscenes__nota">Removendo só daqui, o vídeo continua na Galeria e só sai de lá pelo site.</p>
      <div className="lb-cutscenes__acoes">
        <Botao variante="perigo" tamanho="p" aria-busy={tirando} onClick={() => void tirarERemover()}>
          {tirando ? 'Tirando da Galeria…' : 'Tirar da Galeria e remover'}
        </Botao>
        <Botao
          tamanho="p"
          onClick={() => {
            if (ultima !== null) removerComDesfazer(ultima)
            onFechar()
          }}
        >
          Remover só daqui
        </Botao>
        <Botao variante="fantasma" tamanho="p" onClick={onFechar}>
          Cancelar
        </Botao>
      </div>
    </Dialogo>
  )
}

interface LinhaDaCutsceneProps {
  cutscene: Cutscene
  /** Para onde o "Tocar" vai agora; `null` = sem sala nem teste. */
  lugar: LugarDaCutscene | null
  ocupada: boolean
  podeGravar: boolean
  base: string | null
  onAssistir: () => void
  onRemoverDaGaleria: () => void
}

function LinhaDaCutscene({ cutscene, lugar, ocupada, podeGravar, base, onAssistir, onRemoverDaGaleria }: LinhaDaCutsceneProps) {
  const [tirando, setTirando] = useState(false)
  const loja = useCutscenesStore.getState
  const comSala = lugar !== null
  const tocar = () => {
    const rede = redeDaCutscene()
    if (rede === null) return
    const frases = lugarDaRedeDaCutscene() === 'teste' ? FRASE_DO_TOCAR_NO_TESTE : FRASE_DO_TOCAR
    const resultado = rede.tocar({ cutsceneId: cutscene.id, video: cutscene.video, titulo: cutscene.titulo })
    if (resultado !== 'ok') avisar('error', frases[resultado])
  }
  const tirar = async () => {
    const galeria = cutscene.galeria
    if (galeria?.estado !== 'enviado') return
    setTirando(true)
    try {
      await tirarDaGaleria(galeria.campanhaId, cutscene.video)
      loja().mudar(cutscene.id, { naGaleria: false, galeria: undefined })
      avisar('info', `"${cutscene.titulo}" saiu da Galeria do site.`)
      void loja().conferirGaleria()
    } catch (erro) {
      avisar('error', mensagemDaFalha(erro))
    } finally {
      setTirando(false)
    }
  }
  const cabeNaGaleria = cutscene.tamanho <= GALERIA_VIDEO_MAX_BYTES
  return (
    <li className="lb-cutscenes__item">
      <div className="lb-cutscenes__topo">
        <MiniaturaDaCutscene cutscene={cutscene} base={base} onAssistir={onAssistir} />
        <div className="lb-cutscenes__dados">
          <CampoTexto
            rotulo="Título"
            valor={cutscene.titulo}
            maxLength={CUTSCENE_TITULO_MAX}
            onChange={(titulo) => {
              const limpo = titulo.replace(/[\r\n]+/g, ' ')
              if (limpo.trim() !== '') loja().mudar(cutscene.id, { titulo: limpo })
            }}
          />
          <p className="lb-cutscenes__nota">
            {tamanhoLegivel(cutscene.tamanho)}
            {cutscene.exibida ? ' · já tocou na mesa' : ''}
          </p>
        </div>
      </div>
      <CampoLiga
        rotulo="Na Galeria"
        ajuda={cabeNaGaleria ? 'Depois de tocar, o vídeo fica no site dos jogadores, aba Galeria.' : 'Acima de 150 MB o vídeo não vai para o site.'}
        ligado={cutscene.naGaleria && cabeNaGaleria}
        disabled={!cabeNaGaleria || cutscene.galeria?.estado === 'enviando'}
        onChange={(naGaleria) => {
          loja().mudar(cutscene.id, { naGaleria })
          // Ligado depois de já ter tocado: sobe agora.
          if (naGaleria && cutscene.exibida && cutscene.galeria?.estado !== 'enviado') void loja().enviarParaAGaleria(cutscene.id)
        }}
      />
      <EstadoDaGaleria cutscene={cutscene} />
      <div className="lb-cutscenes__acoes">
        <Botao variante="primario" tamanho="p" disabled={!comSala || ocupada} onClick={tocar}>
          <IconeDoLivro nome="filme" />
          {/* Com a Visão de jogador aberta o vídeo vai só à janela de teste: o rótulo diz isso. */}
          {lugar === 'teste' ? 'Tocar no teste' : 'Tocar para todos'}
        </Botao>
        <Botao tamanho="p" onClick={onAssistir}>
          <IconeDoLivro nome="play" />
          Assistir
        </Botao>
        {cutscene.galeria?.estado === 'enviado' && (
          <Botao variante="fantasma" tamanho="p" disabled={tirando} onClick={() => void tirar()}>
            Tirar da Galeria
          </Botao>
        )}
        <Botao
          variante="fantasma"
          tamanho="p"
          disabled={ocupada || !podeGravar}
          onClick={() => (cutscene.galeria?.estado === 'enviado' ? onRemoverDaGaleria() : removerComDesfazer(cutscene))}
        >
          Remover da lista
        </Botao>
      </div>
    </li>
  )
}

export function PaginaCutscenes() {
  const lista = useCutscenesStore((estado) => estado.lista)
  const exibicao = useCutscenesStore((estado) => estado.exibicao)
  const exibicaoDoTeste = useCutscenesStore((estado) => estado.exibicaoDoTeste)
  const carregada = useCutscenesStore((estado) => estado.carregada)
  const podeGravar = useCutscenesStore((estado) => estado.podeGravar)
  const aviso = useCutscenesStore((estado) => estado.aviso)
  const lugar = useSyncExternalStore(assinarRedeDaCutscene, lugarDaRedeDaCutscene)
  const [importando, setImportando] = useState(false)
  const [assistindo, setAssistindo] = useState<string | null>(null)
  const [removendoDaGaleria, setRemovendoDaGaleria] = useState<Cutscene | null>(null)
  const base = useBaseDaMidia()
  const aVista = usePaginaAVista()

  // Ao abrir, relê a Galeria do site: o mestre pode ter tirado um vídeo por lá.
  // Sem o disco do app (navegador puro), a lista fica vazia sem erro solto.
  useEffect(() => {
    const loja = useCutscenesStore.getState()
    loja
      .carregar()
      .then(() => loja.conferirGaleria())
      .catch(() => undefined)
  }, [])

  // A miniatura que falta (o vídeo que acabou de entrar, ou os de antes de 18/11) sai sozinha, um vídeo por vez.
  // O pedido é um só por vídeo nesta sessão: mudar o título não pede de novo, e o que falhou fica com o ícone.
  // Só com a página à vista: as páginas do livro ficam todas montadas, e no meio do jogo ninguém vê esta.
  useEffect(() => {
    if (!carregada || !aVista) return
    for (const cutscene of lista) {
      if (cutscene.miniatura !== undefined) continue
      const { video } = cutscene
      void pedirMiniaturaDoVideo(video).then((miniatura) => {
        if (miniatura !== null) useCutscenesStore.getState().darMiniaturaAoVideo(video, miniatura)
      })
    }
  }, [carregada, aVista, lista])

  const adicionar = async () => {
    const escolhido = await open({ multiple: false, directory: false, filters: [{ name: 'Vídeo (mp4, webm)', extensions: ['mp4', 'webm'] }] })
    if (typeof escolhido !== 'string') return
    setImportando(true)
    try {
      const video: unknown = await invoke('midia_importar_video', { caminho: escolhido })
      if (!ehVideoNaMidia(video)) throw new Error('o app não devolveu o vídeo importado')
      const loja = useCutscenesStore.getState()
      loja.adicionar({ id: `cut_${crypto.randomUUID()}`, titulo: tituloDoArquivo(escolhido), video: video.id, tamanho: video.tamanho, naGaleria: video.tamanho <= GALERIA_VIDEO_MAX_BYTES, exibida: false })
      if (video.tamanho > GALERIA_VIDEO_MAX_BYTES) avisar('info', 'O vídeo passa de 150 MB: toca na mesa, mas não vai para a Galeria do site.')
    } catch (erro) {
      avisar('error', `Não deu para adicionar o vídeo: ${erro instanceof Error ? erro.message : String(erro)}`)
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="lb-cutscenes" role="region" aria-label="Cutscenes">
      <TituloDaPagina titulo="Cutscenes" sub={`Vídeos mp4 ou webm até ${VIDEO_MAX_BYTES / MB} MB. Toca quando todos baixarem.`} />
      {exibicao !== null && <PainelDaExibicao exibicao={exibicao} lugar="sala" />}
      {exibicaoDoTeste !== null && <PainelDaExibicao exibicao={exibicaoDoTeste} lugar="teste" />}
      {lugar === null && <p className="lb-cutscenes__nota">Abra a sala para tocar uma cutscene para os jogadores. Sem sala, “Assistir” toca o vídeo só aqui.</p>}
      {lugar === 'teste' && (
        <p className="lb-cutscenes__nota" data-lugar="teste">
          Visão de jogador aberta: “Tocar no teste” toca só na janela de teste. Não conta como exibida nem vai para a Galeria.
        </p>
      )}
      {aviso !== null && (
        <p className="lb-cutscenes__nota lb-cutscenes__nota--erro" role="alert">
          {aviso.texto}{' '}
          {aviso.tipo === 'leitura' && (
            <button type="button" className="lb-cutscenes__link" onClick={() => void useCutscenesStore.getState().recarregar()}>
              Tentar de novo
            </button>
          )}
        </p>
      )}
      <Botao variante="latao" tamanho="p" disabled={importando || (carregada && !podeGravar)} onClick={() => void adicionar()}>
        <IconeDoLivro nome="mais" />
        {importando ? 'Copiando o vídeo…' : 'Adicionar vídeo…'}
      </Botao>
      {lista.length === 0 ? (
        <p className="lb-cutscenes__nota">{aviso?.tipo === 'leitura' && !podeGravar ? 'A lista não abriu: nada é mostrado nem gravado até ela abrir.' : 'Nenhuma cutscene ainda.'}</p>
      ) : (
        <ul className="lb-cutscenes__lista">
          {lista.map((cutscene) => (
            <LinhaDaCutscene
              key={cutscene.id}
              cutscene={cutscene}
              lugar={lugar}
              ocupada={exibicao !== null || exibicaoDoTeste !== null}
              podeGravar={podeGravar}
              base={base}
              onAssistir={() => setAssistindo(cutscene.id)}
              onRemoverDaGaleria={() => setRemovendoDaGaleria(cutscene)}
            />
          ))}
        </ul>
      )}
      <AssistirCutscene cutsceneId={assistindo} onFechar={() => setAssistindo(null)} />
      <ConfirmarRemocaoDaGaleria cutscene={removendoDaGaleria} onFechar={() => setRemovendoDaGaleria(null)} />
    </div>
  )
}
