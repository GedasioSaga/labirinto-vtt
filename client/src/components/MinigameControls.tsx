import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import type { LeverDoorOption } from '../lib/lever'
import { guardarAudio, lerAudioGuardado } from '../lib/midiaNoDisco'
import {
  prepararMusicaImportada,
  reajustar,
  tempoDosToques,
  tempoMexido,
  type AnaliseDaMusica,
  type AudioDecodificado,
  type MusicaPreparada,
} from '../minigames/danca/analise'
import { BPM_DEMO, somDeClique } from '../minigames/danca/som'
import {
  DIFICULDADES_DANCA,
  FALA_MAX_LENGTH,
  LETRAS_DANCA,
  NPC_MAX_LENGTH,
  PREMIO_TEXTO_MAX_LENGTH,
  type ConsequenciaDanca,
  type DificuldadeDanca,
  type MinigameDanca,
  type MusicaDaDanca,
  type PremioDanca,
} from '../minigames/danca/tipos'
import type { MinigameDoPino } from '../minigames/tipos'
import { DANCA_DURACAO_MAX_S } from '../net/protocoloDaDanca'
import { DancaAoVivoPainel, type DancaAoVivoProps } from './DancaAoVivo'
import './MinigameControls.css'

/**
 * PINO DE MINIGAME no painel do mestre: o desafio de dança inteiro, na ordem
 * do protótipo aprovado (`docs/design/minigame-danca/prototipo/index.html`,
 * visão "Mestre") — quem desafia, a fala, a música, a dificuldade, a nota
 * mínima, o que acontece quando passa e quando não passa — e, com a sala
 * aberta, o "Chamar para dançar" (`DancaAoVivo.tsx`).
 *
 * Tudo grava no pino (`onChange` com o desafio inteiro, `porta.onChange` com
 * a porta ligada). Texto grava ao sair do campo (ou Enter): cada letra não
 * vira um passo do desfazer, como o nome do item pegável.
 *
 * A música importada é analisada UMA vez aqui, no mestre: o ritmo e as duas
 * coreografias vão gravados no pino, e a análise (com os quadros de energia,
 * que não cabem no pino) fica só na memória, para refazer as setas quando o
 * mestre corrige o tempo. Depois de reabrir o app, o áudio volta do disco
 * (`lerAudioGuardado`) no primeiro ajuste ou na primeira prévia.
 */

type MusicaImportada = Extract<MusicaDaDanca, { tipo: 'arquivo' }>
type Tempo = { bpm: number; primeiraBatida: number }

/** O que o painel usa de fora; o teste troca por um de mentira (sem disco, sem Web Audio no jsdom). */
export interface CaminhoDaMusica {
  /** Grava os bytes na mídia da mesa e devolve `midia:<id>`; lança com a frase pronta. */
  guardar(bytes: Uint8Array): Promise<string>
  /** Os bytes de uma música já guardada; `null` = não é referência de áudio. */
  ler(ref: string): Promise<Uint8Array | null>
  decodificar(bytes: Uint8Array): Promise<AudioDecodificado>
  preparar(buffer: AudioDecodificado, semente: string, aoProgredir: (fracao: number) => void): Promise<MusicaPreparada>
}

/** A análise mediu tudo a 48 kHz (o protótipo também): decodificar em outra taxa daria outro tempo. */
const TAXA_DA_ANALISE = 48000

async function decodificarNoNavegador(bytes: Uint8Array): Promise<AudioDecodificado> {
  // Contexto de 1 quadro: só decodifica (e reamostra para 48 kHz), não toca nada.
  const ctx = new OfflineAudioContext(1, 1, TAXA_DA_ANALISE)
  // Cópia: `decodeAudioData` toma posse do buffer, e os bytes ainda podem ser de quem chamou.
  return ctx.decodeAudioData(bytes.slice().buffer)
}

const CAMINHO_DO_APP: CaminhoDaMusica = {
  guardar: guardarAudio,
  ler: lerAudioGuardado,
  decodificar: decodificarNoNavegador,
  preparar: prepararMusicaImportada,
}

/** O teto do nome da música no disco e no convite (`mapFile.ts` e `protocoloDaDanca.ts`: 80). */
const NOME_DA_MUSICA_MAX = 80
const NOME_SEM_NOME = 'Música importada'
/** A prévia toca 12 s a partir de meia batida antes da primeira, como no protótipo. */
const PREVIA_DURACAO_S = 12
const PREVIA_ANTES_S = 0.5
/** Folga para o `start` agendado não cair no passado. */
const PREVIA_ATRASO_S = 0.15
/** "Bater o tempo": 8 toques (a reta precisa de 4; 8 aguentam um toque torto). */
const TOQUES_DO_BATER = 8
/** Confiança da análise: acima de 0,6 é alta, acima de 0,3 média (protótipo). */
const CONFIANCA_ALTA = 0.6
const CONFIANCA_MEDIA = 0.3
const MINUTOS_MAX = DANCA_DURACAO_MAX_S / 60

export const MUSICA_ERROS = {
  naoAbriu: 'Este arquivo não abriu como áudio. Tente um MP3, OGG ou WAV.',
  longaDemais: `Esta música passa de ${MINUTOS_MAX} minutos: use um trecho menor.`,
  guardadaSumiu: 'Não deu para ler a música guardada. Importe o arquivo de novo.',
  toquesIrregulares: 'Os toques ficaram irregulares. Tente de novo, no ritmo da música.',
} as const

/** O aviso de música sem setas, com a dificuldade quando só uma ficou vazia. */
export function avisoDeSemSetas(vazias: readonly DificuldadeDanca[]): string | null {
  if (vazias.length === 0) return null
  const onde = vazias.length === 1 ? ` no ${NOME_DA_DIFICULDADE[vazias[0]]}` : ''
  return `Esta música não deu setas${onde}: confira o tempo ou use a faixa demo.`
}

const NOME_DA_DIFICULDADE: Record<DificuldadeDanca, string> = { diversao: 'Diversão', expert: 'Expert' }

const PERMITIDAS: readonly { valor: MinigameDanca['permitida']; rotulo: string }[] = [
  { valor: 'escolha', rotulo: 'Jogador escolhe' },
  { valor: 'diversao', rotulo: 'Só Diversão' },
  { valor: 'expert', rotulo: 'Só Expert' },
]

const PREMIOS: readonly { valor: PremioDanca; rotulo: string }[] = [
  { valor: 'item', rotulo: 'Item na mochila' },
  { valor: 'pista', rotulo: 'Pista' },
  { valor: 'bonus', rotulo: 'Bônus no próximo teste' },
  { valor: 'nada', rotulo: 'Nenhum prêmio' },
]

const CONSEQUENCIAS: readonly { valor: ConsequenciaDanca; rotulo: string }[] = [
  { valor: 'teste', rotulo: 'Penalidade no próximo teste' },
  { valor: 'barulho', rotulo: 'Barulho: o mestre narra' },
  { valor: 'espera', rotulo: 'Só tenta de novo na próxima rodada' },
  { valor: 'nada', rotulo: 'Nenhuma' },
]

// ------------------------------------------------------------------ memória da música

interface AudioNaMemoria {
  midia: string
  buffer: AudioDecodificado
  analise: AnaliseDaMusica
}

/**
 * UM áudio decodificado por vez: 3 min de estéreo a 48 kHz passam de 60 MB.
 * Fica fora do componente para sobreviver à troca de pino no painel.
 */
let audioNaMemoria: AudioNaMemoria | null = null
/** A última música importada de cada pino: voltar de "Faixa demo" para "Arquivo importado" não pede o arquivo de novo. */
const ultimaImportada = new Map<string, MusicaImportada>()

/** Para os testes: cada um começa sem música na memória. */
export function esquecerMusicasNaMemoria(): void {
  audioNaMemoria = null
  ultimaImportada.clear()
}

/** A análise com o tempo que está NO PINO: o desfazer pode ter voltado o pino, e a memória não sabe. */
function analiseComOTempoDoPino(analise: AnaliseDaMusica, musica: MusicaImportada): AnaliseDaMusica {
  return { ...analise, bpm: musica.bpm, periodo: 60 / musica.bpm, primeiraBatida: musica.primeiraBatida }
}

function nomeDaMusica(arquivo: string): string {
  const semExtensao = arquivo.replace(/\.[^.]+$/, '').trim()
  return semExtensao === '' ? NOME_SEM_NOME : semExtensao.slice(0, NOME_DA_MUSICA_MAX)
}

function decimal(valor: number, casas: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

function textoDaConfianca(confianca: number): string {
  if (confianca > CONFIANCA_ALTA) return 'alta'
  return confianca > CONFIANCA_MEDIA ? 'média' : 'baixa'
}

function frase(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** As dificuldades que alguém pode jogar com esta escolha do mestre. */
function dificuldadesEmJogo(permitida: MinigameDanca['permitida']): readonly DificuldadeDanca[] {
  return permitida === 'escolha' ? DIFICULDADES_DANCA : [permitida]
}

// ------------------------------------------------------------------ prévia (metrônomo e bater o tempo)

let contextoDaPrevia: AudioContext | null = null

/** Um contexto para o painel inteiro: o navegador limita quantos podem existir. */
function contextoDeAudio(): AudioContext {
  contextoDaPrevia ??= new AudioContext()
  return contextoDaPrevia
}

/** O decodificado já é `AudioBuffer` no app; o de mentira dos testes vira um, copiando os canais. */
function bufferTocavel(ctx: AudioContext, buffer: AudioDecodificado): AudioBuffer {
  if (typeof AudioBuffer !== 'undefined' && buffer instanceof AudioBuffer) return buffer
  const copia = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate)
  for (let canal = 0; canal < buffer.numberOfChannels; canal += 1) copia.getChannelData(canal).set(buffer.getChannelData(canal))
  return copia
}

interface PreviaTocando {
  tipo: 'conferir' | 'bater'
  /** O áudio que está tocando: o tempo batido refaz as setas com a análise DELE. */
  memoria: AudioNaMemoria
  ctx: AudioContext
  fonte: AudioBufferSourceNode
  saida: GainNode
  /** Instante do contexto em que o segundo 0 da música soaria. */
  t0: number
  toques: number[]
}

function pararPrevia(previa: PreviaTocando | null): void {
  if (previa === null) return
  // Os cliques já agendados saem pela mesma saída: desligá-la cala o resto.
  previa.saida.disconnect()
  try {
    previa.fonte.stop()
  } catch {
    // Já tinha parado sozinha.
  }
}

/** O segundo da música que está soando AGORA, descontado o atraso da saída de áudio. */
function segundoOuvido(previa: PreviaTocando): number {
  const latencia = Number.isFinite(previa.ctx.outputLatency) ? previa.ctx.outputLatency : previa.ctx.baseLatency
  return previa.ctx.currentTime - latencia - previa.t0
}

// ------------------------------------------------------------------ campos

interface CampoDeTextoProps {
  id: string
  valor: string
  max: number
  onCommit(valor: string): void
  linhas?: number
  rotuloAcessivel?: string
  desligado?: boolean
}

/** Rascunho enquanto digita; grava ao sair do campo (ou Enter, no campo de uma linha). */
function CampoDeTexto({ id, valor, max, onCommit, linhas, rotuloAcessivel, desligado = false }: CampoDeTextoProps) {
  const [rascunho, setRascunho] = useState(valor)
  useEffect(() => setRascunho(valor), [valor])
  const commit = () => {
    const limpo = rascunho.trim()
    if (limpo === valor) {
      setRascunho(valor)
      return
    }
    onCommit(limpo)
  }
  if (linhas !== undefined) {
    return (
      <textarea
        id={id}
        className="lb-input lb-textarea"
        rows={linhas}
        maxLength={max}
        value={rascunho}
        aria-label={rotuloAcessivel}
        disabled={desligado}
        onChange={(event) => setRascunho(event.target.value)}
        onBlur={commit}
      />
    )
  }
  return (
    <input
      id={id}
      className="lb-input"
      type="text"
      maxLength={max}
      value={rascunho}
      aria-label={rotuloAcessivel}
      disabled={desligado}
      onChange={(event) => setRascunho(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
      }}
    />
  )
}

interface PastilhasProps<T extends string> {
  rotulo: string
  opcoes: readonly { valor: T; rotulo: string }[]
  valor: T
  onChange(valor: T): void
  classe?: string
}

/** Escolha única em pastilhas: o mesmo `.lb-seg` do tipo do pino. */
function Pastilhas<T extends string>({ rotulo, opcoes, valor, onChange, classe = '' }: PastilhasProps<T>) {
  return (
    <div className={`lb-seg lb-minigame__seg ${classe}`.trim()} role="radiogroup" aria-label={rotulo}>
      {opcoes.map((opcao) => (
        <button key={opcao.valor} type="button" role="radio" aria-checked={valor === opcao.valor} className="lb-seg__option" onClick={() => onChange(opcao.valor)}>
          {opcao.rotulo}
        </button>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ música

interface SecaoDaMusicaProps {
  pinId: string
  musica: MusicaDaDanca
  permitida: MinigameDanca['permitida']
  onMusica(musica: MusicaDaDanca): void
  caminho: CaminhoDaMusica
}

type Aviso = { tipo: 'info' | 'erro'; texto: string } | null

/**
 * "Música": a faixa demo ou o arquivo importado. Importar lê o arquivo, grava
 * na mídia da mesa, decodifica, acha a batida e grava no pino o ritmo e as
 * setas das duas dificuldades. A grade (tempo, 1ª batida, confiança) só
 * aparece com arquivo: é lá que o mestre corrige o tempo quando a análise errou.
 */
function SecaoDaMusica({ pinId, musica, permitida, onMusica, caminho }: SecaoDaMusicaProps) {
  const baseId = useId()
  const arquivoRef = useRef<HTMLInputElement>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [ocupado, setOcupado] = useState(false)
  const [carregada, setCarregada] = useState<AudioNaMemoria | null>(() =>
    musica.tipo === 'arquivo' && audioNaMemoria?.midia === musica.midia ? audioNaMemoria : null,
  )
  const previaRef = useRef<PreviaTocando | null>(null)
  const [previa, setPrevia] = useState<{ tipo: PreviaTocando['tipo']; toques: number } | null>(null)
  const guardada = ultimaImportada.get(pinId)
  const importada = musica.tipo === 'arquivo' ? musica : null

  // Trocar de pino ou fechar o painel cala a prévia: ela não segue tocando sem botão para parar.
  useEffect(() => () => pararPrevia(previaRef.current), [])

  const lembrar = (memoria: AudioNaMemoria) => {
    audioNaMemoria = memoria
    setCarregada(memoria)
  }

  const gravar = (nova: MusicaImportada) => {
    ultimaImportada.set(pinId, nova)
    onMusica(nova)
  }

  const pararTudo = () => {
    pararPrevia(previaRef.current)
    previaRef.current = null
    setPrevia(null)
  }

  const progresso = (fracao: number) => setAviso({ tipo: 'info', texto: `Procurando a batida… ${Math.round(fracao * 100)}%` })

  const decodificar = async (bytes: Uint8Array): Promise<AudioDecodificado> => {
    let buffer: AudioDecodificado
    try {
      buffer = await caminho.decodificar(bytes)
    } catch {
      throw new Error(MUSICA_ERROS.naoAbriu)
    }
    if (buffer.duration > DANCA_DURACAO_MAX_S) throw new Error(MUSICA_ERROS.longaDemais)
    return buffer
  }

  const importar = async (arquivo: File) => {
    pararTudo()
    setOcupado(true)
    setAviso({ tipo: 'info', texto: 'Lendo o arquivo…' })
    try {
      const bytes = new Uint8Array(await arquivo.arrayBuffer())
      let midia: string
      try {
        // Antes de decodificar: o teto e a assinatura recusam em milissegundos o que levaria segundos.
        midia = await caminho.guardar(bytes)
      } catch (erro) {
        throw new Error(`Não deu para importar: ${frase(erro)}.`)
      }
      const buffer = await decodificar(bytes)
      progresso(0)
      const { ritmo, analise } = await caminho.preparar(buffer, pinId, progresso)
      lembrar({ midia, buffer, analise })
      gravar({ tipo: 'arquivo', midia, nome: nomeDaMusica(arquivo.name), ...ritmo })
      setAviso(null)
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: frase(erro) })
    } finally {
      setOcupado(false)
    }
  }

  /** A análise da música do pino: da memória, ou do disco (depois de reabrir o app). `null` = não deu, e o aviso diz. */
  const garantirAudio = async (atual: MusicaImportada): Promise<AudioNaMemoria | null> => {
    if (carregada?.midia === atual.midia) return carregada
    if (audioNaMemoria?.midia === atual.midia) {
      setCarregada(audioNaMemoria)
      return audioNaMemoria
    }
    setOcupado(true)
    setAviso({ tipo: 'info', texto: 'Lendo a música guardada…' })
    try {
      const bytes = await caminho.ler(atual.midia)
      if (bytes === null) throw new Error(MUSICA_ERROS.guardadaSumiu)
      const buffer = await decodificar(bytes)
      const { analise } = await caminho.preparar(buffer, pinId, progresso)
      const memoria = { midia: atual.midia, buffer, analise }
      lembrar(memoria)
      setAviso(null)
      return memoria
    } catch {
      setAviso({ tipo: 'erro', texto: MUSICA_ERROS.guardadaSumiu })
      return null
    } finally {
      setOcupado(false)
    }
  }

  const aplicarTempo = (memoria: AudioNaMemoria, atual: MusicaImportada, novo: Tempo) => {
    // A fase do compasso, a duração e as setas saem da análise; o tempo, do mestre.
    const { ritmo } = reajustar(memoria.analise, novo, pinId)
    gravar({ ...atual, ...ritmo })
  }

  const mexer = async (dBpm: number, dFase: number) => {
    if (importada === null) return
    const memoria = await garantirAudio(importada)
    if (memoria === null) return
    aplicarTempo(memoria, importada, tempoMexido(analiseComOTempoDoPino(memoria.analise, importada), dBpm, dFase))
  }

  const tocar = async (tipo: PreviaTocando['tipo']) => {
    if (importada === null) return
    const memoria = await garantirAudio(importada)
    if (memoria === null) return
    pararTudo()
    const ctx = contextoDeAudio()
    void ctx.resume()
    const saida = ctx.createGain()
    saida.connect(ctx.destination)
    const fonte = ctx.createBufferSource()
    fonte.buffer = bufferTocavel(ctx, memoria.buffer)
    fonte.connect(saida)
    const inicio = Math.max(0, importada.primeiraBatida - PREVIA_ANTES_S)
    const quando = ctx.currentTime + PREVIA_ATRASO_S
    fonte.start(quando, inicio, PREVIA_DURACAO_S)
    const tocando: PreviaTocando = { tipo, memoria, ctx, fonte, saida, t0: quando - inicio, toques: [] }
    if (tipo === 'conferir') {
      // O clique forte abre o compasso: o mestre ouve se a "linha forte" da pista cai no 1 da música.
      const periodo = 60 / importada.bpm
      for (let k = 0, t = importada.primeiraBatida; t < inicio + PREVIA_DURACAO_S; k += 1, t += periodo) {
        if (t >= inicio) somDeClique(ctx, saida, tocando.t0 + t, (((k - importada.fase4) % 4) + 4) % 4 === 0)
      }
    }
    fonte.onended = () => {
      if (previaRef.current?.fonte === fonte) pararTudo()
    }
    previaRef.current = tocando
    setPrevia({ tipo, toques: 0 })
  }

  const conferir = () => {
    if (previa?.tipo === 'conferir') pararTudo()
    else void tocar('conferir')
  }

  const bater = () => {
    const tocando = previaRef.current
    if (tocando === null || tocando.tipo !== 'bater') {
      setAviso(null)
      void tocar('bater')
      return
    }
    tocando.toques.push(segundoOuvido(tocando))
    if (tocando.toques.length < TOQUES_DO_BATER) {
      setPrevia({ tipo: 'bater', toques: tocando.toques.length })
      return
    }
    pararTudo()
    const novo = tempoDosToques(tocando.toques)
    if (novo === null) {
      setAviso({ tipo: 'erro', texto: MUSICA_ERROS.toquesIrregulares })
      return
    }
    // A prévia só toca com música importada no pino; se o mestre trocou para a demo no meio, não há o que ajustar.
    if (importada === null || importada.midia !== tocando.memoria.midia) return
    aplicarTempo(tocando.memoria, importada, novo)
    setAviso({ tipo: 'info', texto: `Tempo batido: ${decimal(novo.bpm, 1)} BPM.` })
  }

  const escolherArquivo = (event: ChangeEvent<HTMLInputElement>) => {
    const arquivo = event.target.files?.[0]
    // Limpa: escolher o MESMO arquivo de novo (depois de um erro) volta a disparar.
    event.target.value = ''
    if (arquivo !== undefined) void importar(arquivo)
  }

  const escolherFonte = (tipo: MusicaDaDanca['tipo']) => {
    pararTudo()
    if (tipo === 'demo') {
      if (importada !== null) ultimaImportada.set(pinId, importada)
      onMusica({ tipo: 'demo' })
    } else if (guardada !== undefined) {
      onMusica(guardada)
    }
  }

  const vazias = importada === null ? [] : dificuldadesEmJogo(permitida).filter((dif) => importada.coreografias[dif].length === 0)
  const semSetas = avisoDeSemSetas(vazias)
  const nomeDoGrupo = `${baseId}-musica`
  const confianca = importada !== null && carregada?.midia === importada.midia ? textoDaConfianca(carregada.analise.confianca) : '—'

  return (
    <fieldset className="lb-minigame__grupo" aria-busy={ocupado}>
      <legend className="lb-label">Música</legend>
      <label className="lb-minigame__radio">
        <input type="radio" name={nomeDoGrupo} checked={musica.tipo === 'demo'} onChange={() => escolherFonte('demo')} />
        Faixa demo: Gingado do Salão Fundo ({BPM_DEMO} BPM)
      </label>
      <label className="lb-minigame__radio">
        <input
          type="radio"
          name={nomeDoGrupo}
          checked={importada !== null}
          disabled={importada === null && guardada === undefined}
          onChange={() => escolherFonte('arquivo')}
        />
        Arquivo importado
      </label>
      <button type="button" className="lb-btn lb-minigame__importar" disabled={ocupado} onClick={() => arquivoRef.current?.click()}>
        Importar música…
      </button>
      <input
        ref={arquivoRef}
        type="file"
        accept="audio/*,.mp3,.ogg,.wav,.m4a"
        hidden
        aria-label="Arquivo de música"
        onChange={escolherArquivo}
      />
      <p className={`lb-minigame__nota${aviso?.tipo === 'erro' ? ' lb-minigame__nota--erro' : ''}`} role="status">
        {aviso !== null ? aviso.texto : importada !== null ? `${importada.nome}: ${decimal(importada.duracaoS, 1)} s` : ''}
      </p>
      {importada !== null && (
        <div className="lb-minigame__grade">
          <dl className="lb-minigame__medidas">
            <div className="lb-minigame__medida">
              <dt>Tempo</dt>
              <dd className="lb-minigame__valor">{decimal(importada.bpm, 1)} BPM</dd>
              <dd className="lb-minigame__botoes">
                <button type="button" className="lb-btn lb-btn--compact" disabled={ocupado} aria-label="Tempo menos 0,1 BPM" onClick={() => void mexer(-0.1, 0)}>
                  −0,1
                </button>
                <button type="button" className="lb-btn lb-btn--compact" disabled={ocupado} aria-label="Tempo mais 0,1 BPM" onClick={() => void mexer(0.1, 0)}>
                  +0,1
                </button>
              </dd>
            </div>
            <div className="lb-minigame__medida">
              <dt>1ª batida</dt>
              <dd className="lb-minigame__valor">{decimal(importada.primeiraBatida, 3)} s</dd>
              <dd className="lb-minigame__botoes">
                <button type="button" className="lb-btn lb-btn--compact" disabled={ocupado} aria-label="Primeira batida 10 ms antes" onClick={() => void mexer(0, -0.01)}>
                  −10 ms
                </button>
                <button type="button" className="lb-btn lb-btn--compact" disabled={ocupado} aria-label="Primeira batida 10 ms depois" onClick={() => void mexer(0, 0.01)}>
                  +10 ms
                </button>
              </dd>
            </div>
            <div className="lb-minigame__medida">
              <dt>Confiança</dt>
              <dd className="lb-minigame__valor">{confianca}</dd>
            </div>
          </dl>
          <div className="lb-minigame__previa">
            <button type="button" className="lb-btn lb-btn--compact" disabled={ocupado} onClick={conferir}>
              {previa?.tipo === 'conferir' ? 'Parar' : 'Conferir com metrônomo'}
            </button>
            <button type="button" className="lb-btn lb-btn--compact" disabled={ocupado} onClick={bater}>
              {previa?.tipo === 'bater' ? `Toque no tempo: ${previa.toques} de ${TOQUES_DO_BATER}` : 'Bater o tempo'}
            </button>
          </div>
          <p className="lb-label">Se o metrônomo não casar com a música, toque "Bater o tempo" e acompanhe 8 batidas.</p>
        </div>
      )}
      {semSetas !== null && (
        <p className="lb-minigame__aviso" role="alert">
          {semSetas}
        </p>
      )}
    </fieldset>
  )
}

// ------------------------------------------------------------------ o painel

export interface PortaDoMinigame {
  /** A porta ligada; `null` = nenhuma. */
  value: string | null
  options: readonly LeverDoorOption[]
  onChange(wallId: string | null): void
}

export interface MinigameControlsProps {
  pinId: string
  minigame: MinigameDoPino
  onChange(minigame: MinigameDoPino): void
  /** "Abre a porta": a mesma lista da alavanca. Só abre se TODOS que dançaram passarem. */
  porta: PortaDoMinigame
  /** Sala aberta: "Chamar para dançar" e a dança ao vivo. `null` = sem sala. */
  aoVivo: Omit<DancaAoVivoProps, 'pinId'> | null
  /** O teste troca; o app usa o disco e o Web Audio de verdade. */
  caminho?: CaminhoDaMusica
}

/**
 * O painel do jogo gravado no pino. A pesca ainda não tem painel (fase 4 do
 * plano da pesca): mostra só o aviso, sem campo que grave nada no pino.
 */
export function MinigameControls(props: MinigameControlsProps) {
  const { minigame } = props
  if (minigame.jogo === 'pesca') {
    return (
      <div className="lb-minigame">
        <div className="lb-field">
          <span className="lb-label">Jogo</span>
          <span className="lb-minigame__jogo">Pesca: painel em construção</span>
        </div>
      </div>
    )
  }
  return <PainelDaDanca {...props} minigame={minigame} />
}

type PainelDaDancaProps = Omit<MinigameControlsProps, 'minigame'> & { minigame: MinigameDanca }

function PainelDaDanca({ pinId, minigame, onChange, porta, aoVivo, caminho = CAMINHO_DO_APP }: PainelDaDancaProps) {
  const baseId = useId()
  const mudar = (patch: Partial<MinigameDanca>) => onChange({ ...minigame, ...patch })
  const portaAtual = porta.value !== null && porta.options.some((o) => o.id === porta.value) ? porta.value : ''
  const semPorta = porta.options.length === 0
  const id = (nome: string) => `${baseId}-${nome}`
  return (
    <div className="lb-minigame">
      <div className="lb-field">
        <span className="lb-label">Jogo</span>
        <span className="lb-minigame__jogo">Dança: setas no ritmo</span>
      </div>
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('npc')}>
          Quem desafia
        </label>
        <CampoDeTexto id={id('npc')} valor={minigame.npc} max={NPC_MAX_LENGTH} onCommit={(npc) => mudar({ npc })} />
      </div>
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('fala')}>
          Fala do desafio
        </label>
        <CampoDeTexto id={id('fala')} valor={minigame.fala} max={FALA_MAX_LENGTH} linhas={3} onCommit={(fala) => mudar({ fala })} />
      </div>
      <SecaoDaMusica pinId={pinId} musica={minigame.musica} permitida={minigame.permitida} onMusica={(musica) => mudar({ musica })} caminho={caminho} />
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Dificuldade</legend>
        <Pastilhas rotulo="Dificuldade" opcoes={PERMITIDAS} valor={minigame.permitida} onChange={(permitida) => mudar({ permitida })} />
      </fieldset>
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Nota mínima para passar</legend>
        <Pastilhas
          rotulo="Nota mínima para passar"
          opcoes={LETRAS_DANCA.map((letra) => ({ valor: letra, rotulo: letra }))}
          valor={minigame.notaMin}
          onChange={(notaMin) => mudar({ notaMin })}
          classe="lb-minigame__seg--letras"
        />
      </fieldset>
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Quando passa</legend>
        <label className="lb-label" htmlFor={id('porta')}>
          Abre a porta
        </label>
        <select
          id={id('porta')}
          className="lb-input"
          value={portaAtual}
          disabled={semPorta}
          aria-describedby={id('porta-efeito')}
          onChange={(event) => porta.onChange(event.target.value === '' ? null : event.target.value)}
        >
          <option value="">Nenhuma</option>
          {porta.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <span id={id('porta-efeito')} className="lb-label">
          {semPorta ? 'Ponha uma porta no mapa para a dança abrir.' : 'Abre, mesmo trancada, se todos que dançarem passarem.'}
        </span>
        <select
          className="lb-input"
          aria-label="Tipo de prêmio"
          value={minigame.premio.tipo}
          onChange={(event) => {
            const tipo = PREMIOS.find((p) => p.valor === event.target.value)?.valor
            if (tipo !== undefined) mudar({ premio: { ...minigame.premio, tipo } })
          }}
        >
          {PREMIOS.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
        </select>
        <CampoDeTexto
          id={id('premio')}
          valor={minigame.premio.texto}
          max={PREMIO_TEXTO_MAX_LENGTH}
          rotuloAcessivel="Prêmio"
          desligado={minigame.premio.tipo === 'nada'}
          onCommit={(texto) => mudar({ premio: { ...minigame.premio, texto } })}
        />
      </fieldset>
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Quando não passa</legend>
        <select
          className="lb-input"
          aria-label="Consequência"
          value={minigame.consequencia.tipo}
          onChange={(event) => {
            const tipo = CONSEQUENCIAS.find((c) => c.valor === event.target.value)?.valor
            if (tipo !== undefined) mudar({ consequencia: { ...minigame.consequencia, tipo } })
          }}
        >
          {CONSEQUENCIAS.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.rotulo}
            </option>
          ))}
        </select>
        <CampoDeTexto
          id={id('consequencia')}
          valor={minigame.consequencia.texto}
          max={PREMIO_TEXTO_MAX_LENGTH}
          rotuloAcessivel="Penalidade"
          desligado={minigame.consequencia.tipo !== 'teste'}
          onCommit={(texto) => mudar({ consequencia: { ...minigame.consequencia, texto } })}
        />
        <span className="lb-label">A consequência nunca tranca a história: a porta sempre aceita outra tentativa.</span>
      </fieldset>
      {aoVivo === null ? (
        <span className="lb-label lb-minigame__sem-sala">Abra a sala, ou a Visão de jogador para testar sozinho, para chamar para dançar.</span>
      ) : (
        <DancaAoVivoPainel pinId={pinId} {...aoVivo} />
      )}
    </div>
  )
}
