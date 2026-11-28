import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { nomeDoJogo, ORDEM_DOS_JOGOS, type MinigamesPorJogo } from '../minigames/registro'
import type { LeverDoorOption } from '../lib/lever'
import { lerAudioGuardado } from '../lib/midiaNoDisco'
import { guardarMusicaDaDanca } from '../lib/musicaDaDancaNaAventura'
import { useBibliotecaDeSonsStore } from '../stores/bibliotecaDeSonsStore'
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
import {
  LAGO_MAX_LENGTH,
  LANCES_MAX,
  LANCES_MIN,
  PESCA_TEXTO_MAX_LENGTH,
  type DificuldadePesca,
  type EntradaPesca,
  type MinigamePesca,
} from '../minigames/pesca/tipos'
import { NOTA_DAS_MEDALHAS } from '../minigames/tiro/tela/textos'
import {
  BARRACA_MAX_LENGTH,
  TENTATIVAS_MAX,
  TENTATIVAS_MIN,
  TIRO_TEXTO_MAX_LENGTH,
  type DificuldadeTiro,
  type EntradaTiro,
  type MedalhaTiro,
  type MinigameTiro,
} from '../minigames/tiro/tipos'
import { FLORESTA_MAX_LENGTH, FOGO_TEXTO_MAX_LENGTH, DIFICULDADES_FOGO, type DificuldadeFogo, type MinigameFogo } from '../minigames/fogo/tipos'
import { NOME_DA_DIFICULDADE_FOGO } from '../minigames/fogo/tela/textos'
import type { JogoDoMinigame, MinigameDoPino } from '../minigames/tipos'
import { trocarJogoDoMinigame } from '../lib/pins'
import { DANCA_DURACAO_MAX_S } from '../net/protocoloDaDanca'
import { DancaAoVivoPainel, type DancaAoVivoProps } from './DancaAoVivo'
import { PescaAoVivoPainel } from './PescaAoVivo'
import type { PescaNoPainel } from './pescaNoPainel'
import { TiroAoVivoPainel } from './TiroAoVivo'
import type { TiroNoPainel } from './tiroNoPainel'
import { FogoAoVivoPainel } from './FogoAoVivo'
import type { FogoNoPainel } from './fogoNoPainel'
import { AlavancaAoVivoPainel } from './AlavancaAoVivo'
import type { AlavancaNoPainel } from './alavancaNoPainel'
import { TEXTOS_DA_CENA } from '../minigames/alavanca/cenas'
import { DIF } from '../minigames/alavanca/sim'
import {
  ALAVANCA_FALA_MAX_LENGTH,
  ALAVANCA_LUGAR_MAX_LENGTH,
  ALAVANCA_TEMPO_MAX_S,
  ALAVANCA_TEMPO_MIN_S,
  alavancaNaCena,
  CENAS_ALAVANCA,
  DIFICULDADES_ALAVANCA,
  NOME_DA_CENA_ALAVANCA,
  NOME_DA_DIFICULDADE_ALAVANCA,
  tempoDaAlavanca,
  type CenaAlavanca,
  type DificuldadeAlavanca,
  type EntradaAlavanca,
  type MinigameAlavanca,
} from '../minigames/alavanca/tipos'
import {
  BOLHA_TEXTO_MAX_LENGTH,
  bolhaNoCenario,
  CENARIOS_BOLHA,
  DIFICULDADES_BOLHA,
  NOME_DA_DIFICULDADE_BOLHA,
  NOME_DO_CENARIO_BOLHA,
  type CenarioBolha,
  type DificuldadeBolha,
  type MinigameBolha,
} from '../minigames/bolha/tipos'
import { combinacaoDoPuzzle, mecanicaDesconhecida, NOME_DA_COMBINACAO } from '../puzzles/combinacao'
import { NOME_DO_MODELO, puzzleAbrePorta } from '../puzzles/padroes'
import { aneisNoLugar, giratoriasDoPuzzle, NOME_DAS_GIRATORIAS, NOME_DO_MATERIAL } from '../puzzles/giratorias/giratorias'
import { interruptoresDoPuzzle, lampioesCertos, NOME_DA_LIGACAO, NOME_DO_MATERIAL_DO_PAINEL, NOME_DO_OBJETIVO, NOME_DOS_INTERRUPTORES } from '../puzzles/interruptores/interruptores'
import { NOME_DA_CENA } from '../puzzles/relevo/arte'
import { nomeDoRelevo } from '../puzzles/relevo/relevo'
import { contagemDoPuzzle, pecasPostas, progressoInicial } from '../puzzles/motor'
import { desafiosDo, mapaComProgressoDoPuzzle } from '../lib/desafios'
import { useMapStore } from '../stores/mapStore'
import { devolverAsPecas, useEditorDoPuzzleStore } from './puzzles/editorDoPuzzleStore'
import {
  TEXTO_DA_RECUSA,
  VERSAO_DO_PUZZLE,
  type CastigoDoPuzzle,
  type DesfechoDoPuzzle,
  type EncaixeDoPuzzle,
  type MinigamePuzzle,
  type ProgressoDoPuzzle,
  type RegraDoPuzzle,
  type TipoDeCastigo,
  type VisualDoPuzzle,
} from '../puzzles/tipos'
import { BolhaAoVivoPainel } from './BolhaAoVivo'
import type { BolhaNoPainel } from './bolhaNoPainel'
import { PacoteDoMinigame } from './PacoteDoMinigame'
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
  // SONS F5d: também na pasta da biblioteca de sons (global desde 29/10/2026), de onde `/sons` serve a mesa.
  guardar: (bytes) => guardarMusicaDaDanca(bytes, useBibliotecaDeSonsStore.getState().pasta),
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
  { valor: 'escolha', rotulo: 'O jogador escolhe' },
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

/** Os jogos da escolha, na ordem e com os nomes do registro (B21 das NOTAS do editor: a lista daqui era outra). */
const JOGOS: readonly { valor: JogoDoMinigame; rotulo: string }[] = ORDEM_DOS_JOGOS.map((jogo) => ({ valor: jogo, rotulo: nomeDoJogo(jogo) }))

const PERMITIDAS_DO_FOGO: readonly { valor: 'escolha' | DificuldadeFogo; rotulo: string }[] = [
  { valor: 'escolha', rotulo: 'Você escolhe ao chamar' },
  ...DIFICULDADES_FOGO.map((d) => ({ valor: d, rotulo: `Só ${NOME_DA_DIFICULDADE_FOGO[d]}` })),
]

const PERMITIDAS_DA_BOLHA: readonly { valor: 'escolha' | DificuldadeBolha; rotulo: string }[] = [
  { valor: 'escolha', rotulo: 'Quem começa escolhe' },
  ...DIFICULDADES_BOLHA.map((d) => ({ valor: d, rotulo: `Só ${NOME_DA_DIFICULDADE_BOLHA[d]}` })),
]

const CENARIOS_DA_BOLHA: readonly { valor: CenarioBolha; rotulo: string }[] = CENARIOS_BOLHA.map((c) => ({ valor: c, rotulo: NOME_DO_CENARIO_BOLHA[c] }))

const ENTRADAS: readonly { valor: EntradaPesca; rotulo: string }[] = [
  { valor: 'pino', rotulo: 'O jogador começa no selo' },
  { valor: 'mestre', rotulo: 'Só você chama' },
]

const LANCES: readonly { valor: string; rotulo: string }[] = Array.from({ length: LANCES_MAX - LANCES_MIN + 1 }, (_, i) => {
  const n = String(LANCES_MIN + i)
  return { valor: n, rotulo: n }
})

const PERMITIDAS_PESCA: readonly { valor: 'escolha' | DificuldadePesca; rotulo: string }[] = [
  { valor: 'escolha', rotulo: 'O jogador escolhe' },
  { valor: 'normal', rotulo: 'Só Normal' },
  { valor: 'extremo', rotulo: 'Só Extremo' },
]

/** A barraca de tiro, na ordem e com os nomes do protótipo aprovado. */
const ENTRADAS_DO_TIRO: readonly { valor: EntradaTiro; rotulo: string }[] = ENTRADAS

const TENTATIVAS: readonly { valor: string; rotulo: string }[] = Array.from({ length: TENTATIVAS_MAX - TENTATIVAS_MIN + 1 }, (_, i) => {
  const n = String(TENTATIVAS_MIN + i)
  return { valor: n, rotulo: n }
})

const PERMITIDAS_DO_TIRO: readonly { valor: 'escolha' | DificuldadeTiro; rotulo: string }[] = [
  { valor: 'escolha', rotulo: 'O jogador escolhe' },
  { valor: 'normal', rotulo: 'Só Normal' },
  { valor: 'extremo', rotulo: 'Só Extremo' },
]

const METAS_DO_TIRO: readonly { valor: MedalhaTiro; rotulo: string }[] = [
  { valor: 'bronze', rotulo: 'Bronze' },
  { valor: 'prata', rotulo: 'Prata' },
  { valor: 'ouro', rotulo: 'Ouro' },
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
  /** Travadas (a troca de jogo com partida aberta): mostram a escolha, não mudam. */
  desligado?: boolean
}

/** Escolha única em pastilhas: o mesmo `.lb-seg` do tipo do pino. */
function Pastilhas<T extends string>({ rotulo, opcoes, valor, onChange, classe = '', desligado = false }: PastilhasProps<T>) {
  return (
    <div className={`lb-seg lb-minigame__seg ${classe}`.trim()} role="radiogroup" aria-label={rotulo} aria-disabled={desligado || undefined}>
      {opcoes.map((opcao) => (
        <button key={opcao.valor} type="button" role="radio" aria-checked={valor === opcao.valor} className="lb-seg__option" disabled={desligado} onClick={() => onChange(opcao.valor)}>
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
  /** Sala aberta: a pesca ao vivo deste pino (`pescaNoPainel`). `null` ou ausente = sem sala. */
  aoVivoDaPesca?: PescaNoPainel | null
  /** Sala aberta: a barraca de tiro ao vivo deste pino (`tiroNoPainel`). `null` ou ausente = sem sala. */
  aoVivoDoTiro?: TiroNoPainel | null
  /** Sala aberta: o Fogo na Floresta ao vivo (`fogoNoPainel`). `null` ou ausente = sem sala. */
  aoVivoDoFogo?: FogoNoPainel | null
  /** Sala aberta: a Bolha d'Água ao vivo (`bolhaNoPainel`). `null` ou ausente = sem sala. */
  aoVivoDaBolha?: BolhaNoPainel | null
  /** Sala aberta: a Alavanca da ponte ao vivo (`alavancaNoPainel`). `null` ou ausente = sem sala. */
  aoVivoDaAlavanca?: AlavancaNoPainel | null
  /** O teste troca; o app usa o disco e o Web Audio de verdade. */
  caminho?: CaminhoDaMusica
  /**
   * Partida aberta deste desafio (B7 das NOTAS do editor): a troca de jogo trava, com o motivo dito
   * aqui; trocar no meio deixaria a partida nos jogadores sem painel. Ausente ou `null` = troca livre.
   */
  trocaTravada?: string | null
  /**
   * NA FICHA DA PÁGINA JOGOS (editor de 21/11/2026): sem a escolha do jogo (o "Trocar" da ficha),
   * sem quem chama, fala e lugar do convite (o bloco "O convite") e sem "Como começa" (o bloco
   * "Onde fica e como começa"). Ficam as regras, o que vale e a mesa. Ausente = o painel inteiro.
   */
  naFicha?: boolean
}

/**
 * O painel do jogo gravado no pino: no topo, a escolha Dança | Pesca | Tiro (trocar
 * põe o desafio padrão do outro jogo; o Ctrl+Z do `updatePin` desfaz), e
 * embaixo os campos do jogo escolhido.
 */
export function MinigameControls(props: MinigameControlsProps) {
  const { minigame, onChange, trocaTravada = null, naFicha = false } = props
  return (
    <div className="lb-minigame">
      {!naFicha && (
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Jogo</legend>
        {/* Em GRADE de 3 (Dança, Pesca, Tiro / Fogo, Bolha, Alavanca / Puzzle): numa fila só, os jogos
            passavam da largura do rail e a Bolha vazava da caixa (medido em 1366x768, 10/11/2026). */}
        <Pastilhas
          rotulo="Jogo"
          opcoes={JOGOS}
          classe="lb-seg--grid"
          valor={minigame.jogo}
          desligado={trocaTravada !== null}
          // O jogo que já está: nada grava (um passo de desfazer que não muda nada só confundiria o Ctrl+Z).
          onChange={(jogo) => jogo !== minigame.jogo && trocaTravada === null && onChange(trocarJogoDoMinigame(minigame, jogo))}
        />
        {trocaTravada !== null && <span className="lb-label">{trocaTravada}</span>}
      </fieldset>
      )}
      {painelDoJogo(minigame.jogo, props, minigame)}
    </div>
  )
}

/**
 * O PAINEL DO MESTRE de cada jogo do registro (`minigames/registro.ts`): uma
 * entrada por jogo, e jogo novo sem painel não compila.
 */
const PAINEL_DO_JOGO: { readonly [J in JogoDoMinigame]: (props: MinigameControlsProps, minigame: MinigamesPorJogo[J]) => ReactNode } = {
  danca: (props, minigame) => <PainelDaDanca {...props} minigame={minigame} />,
  pesca: (props, minigame) => <PainelDaPesca {...props} minigame={minigame} />,
  tiro: (props, minigame) => <PainelDoTiro {...props} minigame={minigame} />,
  fogo: (props, minigame) => <PainelDoFogo {...props} minigame={minigame} />,
  bolha: (props, minigame) => <PainelDaBolha {...props} minigame={minigame} />,
  alavanca: (props, minigame) => <PainelDaAlavanca {...props} minigame={minigame} />,
  puzzle: (props, minigame) => <PainelDoPuzzle pinId={props.pinId} porta={props.porta} minigame={minigame} />,
}

const TEXTO_DA_REGRA: Readonly<Record<RegraDoPuzzle, string>> = {
  qualquerLugar: 'Qualquer peça do conjunto em qualquer encaixe',
  lugarCerto: 'Cada encaixe aceita só a peça dele',
  ordem: 'Ordem certa: cada peça no seu número',
}

const TEXTO_DO_CASTIGO: Readonly<Record<TipoDeCastigo, string>> = {
  nada: 'Nenhum',
  dano: 'Dano',
  armadilha: 'Armadilha',
  barulho: 'Barulho: avisa você',
}

function textoDoVisual(visual: VisualDoPuzzle): string {
  if (visual.tipo === 'imagem') return visual.imagem === null ? 'Imagem própria (ainda sem imagem)' : 'Imagem própria'
  if (visual.tipo === 'relevo') return nomeDoRelevo(visual)
  const nome = NOME_DO_MODELO[visual.modelo]
  return visual.moldura === 'porta' ? `${nome}, na moldura Porta` : nome
}

function textoDosEncaixes(encaixes: readonly EncaixeDoPuzzle[]): string {
  if (encaixes.length === 0) return 'Nenhum encaixe'
  const semPeca = encaixes.filter((e) => (e.jeito === 'peca' ? e.itemId === null : e.metades.some((metade) => metade === null))).length
  const total = encaixes.length === 1 ? '1 encaixe' : `${encaixes.length} encaixes`
  if (semPeca === 0) return `${total}, todos com a peça certa`
  return `${total}, ${semPeca === 1 ? '1 sem a peça certa' : `${semPeca} sem a peça certa`}`
}

function textoDoDesfecho(desfecho: DesfechoDoPuzzle, abre: boolean): string {
  const partes = [desfecho.modo === 'cena' ? 'Cena e texto' : 'Só texto']
  if (desfecho.itens.length > 0) partes.push(desfecho.itens.length === 1 ? '1 item' : `${desfecho.itens.length} itens`)
  if (desfecho.moedas > 0) partes.push(desfecho.moedas === 1 ? '1 moeda' : `${desfecho.moedas} moedas`)
  if (abre && desfecho.abrePorta) partes.push('abre a porta ligada')
  return partes.join(' · ')
}

function textoDoCastigo(castigo: CastigoDoPuzzle): string {
  const nome = TEXTO_DO_CASTIGO[castigo.tipo]
  return castigo.tipo === 'dano' || castigo.tipo === 'armadilha' ? `${nome}: ${castigo.pv} PV` : nome
}

/** O progresso do puzzle na ficha: "2 de 3 encaixes", "resolvido por Lia", os erros. */
function textoDoProgresso(puzzle: MinigamePuzzle['puzzle'], progresso: ProgressoDoPuzzle | undefined): string {
  if (progresso === undefined) return 'Ninguém mexeu ainda'
  if (progresso.resolvido !== null) return `Resolvido por ${progresso.resolvido.por}`
  // O medalhão não tem erro: só quantos anéis já estão no lugar (o mestre pode ver; o jogador não).
  const giratorias = giratoriasDoPuzzle(puzzle)
  if (giratorias !== null) return `${aneisNoLugar(giratorias, progresso)} de ${giratorias.aneis} anéis no lugar`
  // O painel também: quantos lampiões já estão como o objetivo pede.
  const interruptores = interruptoresDoPuzzle(puzzle)
  if (interruptores !== null) return `${lampioesCertos(interruptores, progresso)} de ${interruptores.quantos} lampiões certos`
  if (combinacaoDoPuzzle(puzzle) !== null) return progresso.erros === 0 ? 'Ainda não abriu' : progresso.erros === 1 ? 'Ainda não abriu · 1 erro' : `Ainda não abriu · ${progresso.erros} erros`
  const { postos, total } = contagemDoPuzzle(puzzle, progresso)
  const erros = progresso.erros === 0 ? '' : progresso.erros === 1 ? ' · 1 erro' : ` · ${progresso.erros} erros`
  return `${postos} de ${total} encaixes${erros}`
}

/**
 * O PUZZLE do desafio na ficha (plano dos puzzles, P6): o resumo, o progresso
 * do mapa, a porta ligada, "Abrir editor" (a tela cheia) e "Zerar progresso".
 */
function PainelDoPuzzle({ pinId, porta, minigame }: Pick<MinigameControlsProps, 'pinId' | 'porta'> & { minigame: MinigamePuzzle }) {
  const { puzzle } = minigame
  const desafio = useMapStore((estado) => desafiosDo(estado.map).find((candidato) => candidato.id === pinId))
  const progresso = desafio?.progressoDoPuzzle
  const [confirmarZerar, setConfirmarZerar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const portaId = useId()
  const ehPorta = puzzleAbrePorta(puzzle)
  const zerado = progresso === undefined || (progresso.resolvido === null && progresso.erros === 0 && !progresso.trocaFeita && pecasPostas(progresso).length === 0)
  const zerar = () => {
    if (!confirmarZerar) {
      setConfirmarZerar(true)
      return
    }
    setConfirmarZerar(false)
    if (progresso === undefined) return
    // As peças postas voltam a quem pôs ANTES de o progresso recomeçar (a P7 liga a devolução).
    devolverAsPecas(pinId, pecasPostas(progresso))
      .then(() => {
        const novo = { ...progressoInicial(puzzle), rev: progresso.rev + 1 }
        useMapStore.getState().applyPlayerChange((map) => mapaComProgressoDoPuzzle(map, pinId, novo))
        setErro(null)
      })
      .catch((causa: unknown) => setErro(causa instanceof Error ? causa.message : String(causa)))
  }
  const versaoNova = minigame.versao > VERSAO_DO_PUZZLE || mecanicaDesconhecida(puzzle)
  const combinacao = combinacaoDoPuzzle(puzzle)
  const giratorias = giratoriasDoPuzzle(puzzle)
  const interruptores = interruptoresDoPuzzle(puzzle)
  const linhas: readonly { rotulo: string; valor: string }[] = interruptores !== null ? [
    // O painel de lampiões: o visual do quadro é o dele, sem troca de peso e sem castigo.
    { rotulo: 'Nome para o jogador', valor: puzzle.nomePublico.trim() === '' ? 'Sem título' : puzzle.nomePublico },
    { rotulo: 'Mecânica', valor: `${NOME_DOS_INTERRUPTORES}: ${interruptores.quantos} lampiões na chapa de ${NOME_DO_MATERIAL_DO_PAINEL[interruptores.material].toLowerCase()}, cada alavanca vira: ${NOME_DA_LIGACAO[interruptores.ligacao].toLowerCase()}` },
    { rotulo: 'Objetivo', valor: interruptores.objetivo === 'todas' ? NOME_DO_OBJETIVO.todas : `${NOME_DO_OBJETIVO.desenho} (${interruptores.desenhoNoPainel ? 'na plaqueta do painel' : 'só com você'})` },
    { rotulo: 'Ao resolver', valor: textoDoDesfecho(puzzle.desfecho, ehPorta) },
    { rotulo: 'Progresso', valor: textoDoProgresso(puzzle, progresso) },
  ] : giratorias !== null ? [
    // O medalhão: o visual do quadro é o dele, sem troca de peso e sem castigo.
    { rotulo: 'Nome para o jogador', valor: puzzle.nomePublico.trim() === '' ? 'Sem título' : puzzle.nomePublico },
    { rotulo: 'Desenho', valor: giratorias.desenho === 'cena' ? `Cena em relevo: ${NOME_DA_CENA[giratorias.cena]}` : giratorias.desenho === 'imagem' ? 'Imagem própria' : 'Símbolos sob a marca' },
    { rotulo: 'Mecânica', valor: `${NOME_DAS_GIRATORIAS}: ${giratorias.aneis} anéis de ${NOME_DO_MATERIAL[giratorias.material].toLowerCase()}${giratorias.vizinhas ? ', cada um leva os do lado' : ''}` },
    { rotulo: 'Ao resolver', valor: textoDoDesfecho(puzzle.desfecho, ehPorta) },
    { rotulo: 'Progresso', valor: textoDoProgresso(puzzle, progresso) },
  ] : [
    { rotulo: 'Nome para o jogador', valor: puzzle.nomePublico.trim() === '' ? 'Sem título' : puzzle.nomePublico },
    { rotulo: 'Visual', valor: textoDoVisual(puzzle.visual) },
    ...(combinacao !== null
      ? [{ rotulo: 'Mecânica', valor: `Combinação: ${NOME_DA_COMBINACAO[combinacao.forma].toLowerCase()}` }]
      : [
          { rotulo: 'Regra', valor: TEXTO_DA_REGRA[puzzle.regra] },
          { rotulo: 'Encaixes', valor: textoDosEncaixes(puzzle.encaixes) },
        ]),
    { rotulo: 'Troca de peso', valor: puzzle.troca === null ? 'Sem troca' : `A bandeja pede ${puzzle.troca.peso}` },
    { rotulo: 'Ao resolver', valor: textoDoDesfecho(puzzle.desfecho, ehPorta) },
    { rotulo: 'Castigo', valor: textoDoCastigo(puzzle.castigo) },
    { rotulo: 'Progresso', valor: textoDoProgresso(puzzle, progresso) },
  ]
  const portaAtual = porta.value !== null && porta.options.some((opcao) => opcao.id === porta.value) ? porta.value : ''
  return (
    <fieldset className="lb-minigame__grupo">
      <legend className="lb-label">{puzzle.nome}</legend>
      {versaoNova && (
        <p className="lb-minigame__aviso" role="alert">
          {TEXTO_DA_RECUSA.versao_nova}
        </p>
      )}
      <div className="lb-minigame__grade">
        <dl className="lb-minigame__medidas">
          {linhas.map((linha) => (
            <div key={linha.rotulo} className="lb-minigame__medida">
              <dt>{linha.rotulo}</dt>
              <dd className="lb-minigame__valor">{linha.valor}</dd>
            </div>
          ))}
        </dl>
      </div>
      {desafio !== undefined && !versaoNova && (
        <button type="button" className="lb-btn" onClick={() => useEditorDoPuzzleStore.getState().abrir({ tipo: 'copia', desafioId: pinId })}>
          Abrir editor
        </button>
      )}
      {ehPorta && puzzle.desfecho.abrePorta && (
        <>
          <label className="lb-label" htmlFor={portaId}>
            Abre a porta
          </label>
          <select id={portaId} className="lb-input" value={portaAtual} disabled={porta.options.length === 0} onChange={(event) => porta.onChange(event.target.value === '' ? null : event.target.value)}>
            <option value="">Nenhuma</option>
            {porta.options.map((opcao) => (
              <option key={opcao.id} value={opcao.id}>
                {opcao.label}
              </option>
            ))}
          </select>
          <span className="lb-label">{porta.options.length === 0 ? 'Ponha uma porta no mapa para o puzzle abrir.' : 'Abre para todos quando o puzzle cede.'}</span>
        </>
      )}
      {desafio !== undefined && !zerado && (
        <button type="button" className="lb-btn" onClick={zerar} onBlur={() => setConfirmarZerar(false)}>
          {confirmarZerar ? 'Zerar mesmo? As peças voltam a quem pôs' : 'Zerar progresso'}
        </button>
      )}
      {erro !== null && (
        <p className="lb-minigame__aviso" role="alert">
          {erro}
        </p>
      )}
      <span className="lb-label">O jogador encosta no selo e examina.</span>
    </fieldset>
  )
}

function painelDoJogo<J extends JogoDoMinigame>(jogo: J, props: MinigameControlsProps, minigame: MinigamesPorJogo[J]): ReactNode {
  return PAINEL_DO_JOGO[jogo](props, minigame)
}

type PainelDaPescaProps = Pick<MinigameControlsProps, 'pinId' | 'onChange' | 'aoVivoDaPesca' | 'naFicha'> & { minigame: MinigamePesca }

/**
 * A pesca do pino, na ordem do protótipo aprovado (visão "Mestre"): quem
 * desafia, a fala, o lago, como começa, os lances, a dificuldade, o prêmio e
 * a consequência. Sem música, nota mínima nem porta: a pesca não abre nada.
 */
function PainelDaPesca({ pinId, minigame, onChange, aoVivoDaPesca, naFicha = false }: PainelDaPescaProps) {
  const baseId = useId()
  const mudar = (patch: Partial<MinigamePesca>) => onChange({ ...minigame, ...patch })
  const id = (nome: string) => `${baseId}-${nome}`
  return (
    <>
      {!naFicha && (
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('npc')}>
          Quem chama
        </label>
        <CampoDeTexto id={id('npc')} valor={minigame.npc} max={NPC_MAX_LENGTH} onCommit={(npc) => mudar({ npc })} />
      </div>
      )}
      {!naFicha && (
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('fala')}>
          O que diz
        </label>
        <CampoDeTexto id={id('fala')} valor={minigame.fala} max={FALA_MAX_LENGTH} linhas={3} onCommit={(fala) => mudar({ fala })} />
      </div>
      )}
      {!naFicha && (
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('lago')}>
          Lugar no convite
        </label>
        <CampoDeTexto id={id('lago')} valor={minigame.lago} max={LAGO_MAX_LENGTH} onCommit={(lago) => mudar({ lago })} />
      </div>
      )}
      {!naFicha && (
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Como começa</legend>
        <Pastilhas rotulo="Como começa" opcoes={ENTRADAS} valor={minigame.entrada} onChange={(entrada) => mudar({ entrada })} />
        <span className="lb-label">
          {minigame.entrada === 'mestre' ? 'Você chama quem pesca, daqui do painel.' : 'O jogador encostado no selo toca em "Pescar" e começa sozinho.'}
        </span>
      </fieldset>
      )}
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Lances por pesca</legend>
        <Pastilhas
          rotulo="Lances por pesca"
          opcoes={LANCES}
          valor={String(minigame.lances)}
          onChange={(lances) => mudar({ lances: Number(lances) })}
          classe="lb-minigame__seg--letras"
        />
      </fieldset>
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Dificuldade</legend>
        <Pastilhas rotulo="Dificuldade" opcoes={PERMITIDAS_PESCA} valor={minigame.permitida} onChange={(permitida) => mudar({ permitida })} />
      </fieldset>
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">O que vale</legend>
        <label className="lb-label" htmlFor={id('premio')}>
          Se pegar algum peixe
        </label>
        <CampoDeTexto id={id('premio')} valor={minigame.premio.texto} max={PESCA_TEXTO_MAX_LENGTH} onCommit={(texto) => mudar({ premio: { texto } })} />
        <label className="lb-label" htmlFor={id('consequencia')}>
          Se o cesto voltar vazio
        </label>
        <CampoDeTexto id={id('consequencia')} valor={minigame.consequencia.texto} max={PESCA_TEXTO_MAX_LENGTH} onCommit={(texto) => mudar({ consequencia: { texto } })} />
        <span className="lb-label">Só texto: aparece no convite e no cesto do jogador. A pesca não abre porta nem entrega item; o peixe fica no cesto.</span>
      </fieldset>
      {aoVivoDaPesca === null || aoVivoDaPesca === undefined ? (
        <span className="lb-label lb-minigame__sem-sala">Abra a mesa online para acompanhar a pesca{minigame.entrada === 'mestre' ? ' e chamar quem pesca' : ''}.</span>
      ) : (
        <PescaAoVivoPainel pinId={pinId} entrada={minigame.entrada} {...aoVivoDaPesca} />
      )}
    </>
  )
}

type PainelDoTiroProps = Pick<MinigameControlsProps, 'pinId' | 'onChange' | 'aoVivoDoTiro' | 'naFicha'> & { minigame: MinigameTiro }

/**
 * A barraca de tiro do pino, na ordem do protótipo aprovado (visão
 * "Mestre"): quem desafia, a fala, o nome da barraca, como começa, as
 * tentativas, a dificuldade permitida, a meta, o prêmio e a consequência.
 * Sem porta nem música: o tiro não abre nada.
 */
function PainelDoTiro({ pinId, minigame, onChange, aoVivoDoTiro, naFicha = false }: PainelDoTiroProps) {
  const baseId = useId()
  const mudar = (patch: Partial<MinigameTiro>) => onChange({ ...minigame, ...patch })
  const id = (nome: string) => `${baseId}-${nome}`
  return (
    <>
      {!naFicha && (
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('npc')}>
          Quem chama
        </label>
        <CampoDeTexto id={id('npc')} valor={minigame.npc} max={NPC_MAX_LENGTH} onCommit={(npc) => mudar({ npc })} />
      </div>
      )}
      {!naFicha && (
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('fala')}>
          O que diz
        </label>
        <CampoDeTexto id={id('fala')} valor={minigame.fala} max={FALA_MAX_LENGTH} linhas={3} onCommit={(fala) => mudar({ fala })} />
      </div>
      )}
      {!naFicha && (
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('barraca')}>
          Lugar no convite
        </label>
        <CampoDeTexto id={id('barraca')} valor={minigame.barraca} max={BARRACA_MAX_LENGTH} onCommit={(barraca) => mudar({ barraca })} />
      </div>
      )}
      {!naFicha && (
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Como começa</legend>
        <Pastilhas rotulo="Como começa" opcoes={ENTRADAS_DO_TIRO} valor={minigame.entrada} onChange={(entrada) => mudar({ entrada })} />
        <span className="lb-label">
          {minigame.entrada === 'mestre' ? 'Os jogadores veem o convite quando você chamar, daqui do painel.' : 'Quem encosta no selo vê o convite e começa quando quiser.'}
        </span>
      </fieldset>
      )}
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Tentativas</legend>
        <Pastilhas rotulo="Tentativas" opcoes={TENTATIVAS} valor={String(minigame.tentativas)} onChange={(n) => mudar({ tentativas: Number(n) })} classe="lb-minigame__seg--letras" />
      </fieldset>
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Dificuldade</legend>
        <Pastilhas rotulo="Dificuldade" opcoes={PERMITIDAS_DO_TIRO} valor={minigame.permitida} onChange={(permitida) => mudar({ permitida })} />
      </fieldset>
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Meta para passar</legend>
        <Pastilhas rotulo="Meta para passar" opcoes={METAS_DO_TIRO} valor={minigame.meta} onChange={(meta) => mudar({ meta })} />
        <span className="lb-label">{NOTA_DAS_MEDALHAS}</span>
      </fieldset>
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">O que vale</legend>
        <label className="lb-label" htmlFor={id('premio')}>
          Se passar da meta
        </label>
        <CampoDeTexto id={id('premio')} valor={minigame.premio.texto} max={TIRO_TEXTO_MAX_LENGTH} onCommit={(texto) => mudar({ premio: { texto } })} />
        <label className="lb-label" htmlFor={id('consequencia')}>
          Se não passar
        </label>
        <CampoDeTexto id={id('consequencia')} valor={minigame.consequencia.texto} max={TIRO_TEXTO_MAX_LENGTH} onCommit={(texto) => mudar({ consequencia: { texto } })} />
        <span className="lb-label">Só texto: aparece no convite e no resultado do jogador. O tiro não abre porta nem entrega item.</span>
      </fieldset>
      {aoVivoDoTiro === null || aoVivoDoTiro === undefined ? (
        <span className="lb-label lb-minigame__sem-sala">Abra a mesa online para acompanhar o placar{minigame.entrada === 'mestre' ? ' e chamar para a barraca' : ''}.</span>
      ) : (
        <TiroAoVivoPainel pinId={pinId} entrada={minigame.entrada} {...aoVivoDoTiro} />
      )}
    </>
  )
}

type PainelDoFogoProps = Pick<MinigameControlsProps, 'pinId' | 'onChange' | 'aoVivoDoFogo' | 'naFicha'> & { minigame: MinigameFogo }

/**
 * O Fogo na Floresta do pino: quem pede ajuda, a fala, a floresta, a
 * dificuldade, o prêmio e a consequência. No selo, qualquer jogador apaga
 * sozinho ("Apagar o fogo", `entradaDe` do registro); a EQUIPE, o mestre chama
 * daqui do painel, com a sala aberta. Não há "Como começa" para escolher: o
 * `entrada` gravado no fogo é de antes e não vale. Sem porta: o fogo não abre nada.
 */
function PainelDoFogo({ pinId, minigame, onChange, aoVivoDoFogo, naFicha = false }: PainelDoFogoProps) {
  const baseId = useId()
  const mudar = (patch: Partial<MinigameFogo>) => onChange({ ...minigame, ...patch })
  const id = (nome: string) => `${baseId}-${nome}`
  // Sala fechada ou sem incêndio = nada aberto; com incêndio aberto o jogo não troca de versão.
  const faseDoFogo = aoVivoDoFogo?.fogo?.fase
  const fogoAberto = faseDoFogo === 'convite' || faseDoFogo === 'jogo' || faseDoFogo === 'pausa'
  return (
    <>
      {!naFicha && (
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('npc')}>
          Quem chama
        </label>
        <CampoDeTexto id={id('npc')} valor={minigame.npc} max={NPC_MAX_LENGTH} onCommit={(npc) => mudar({ npc })} />
      </div>
      )}
      {!naFicha && (
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('fala')}>
          O que diz
        </label>
        <CampoDeTexto id={id('fala')} valor={minigame.fala} max={FALA_MAX_LENGTH} linhas={3} onCommit={(fala) => mudar({ fala })} />
      </div>
      )}
      {!naFicha && (
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('floresta')}>
          Lugar no convite
        </label>
        <CampoDeTexto id={id('floresta')} valor={minigame.floresta} max={FLORESTA_MAX_LENGTH} onCommit={(floresta) => mudar({ floresta })} />
      </div>
      )}
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Dificuldade</legend>
        <Pastilhas rotulo="Dificuldade" opcoes={PERMITIDAS_DO_FOGO} valor={minigame.permitida} onChange={(permitida) => mudar({ permitida })} />
        <span className="lb-label">A equipe inteira joga na mesma dificuldade.</span>
      </fieldset>
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">O que vale</legend>
        <label className="lb-label" htmlFor={id('premio')}>
          Se apagarem o fogo
        </label>
        <CampoDeTexto id={id('premio')} valor={minigame.premio.texto} max={FOGO_TEXTO_MAX_LENGTH} onCommit={(texto) => mudar({ premio: { texto } })} />
        <label className="lb-label" htmlFor={id('consequencia')}>
          Se o fogo vencer
        </label>
        <CampoDeTexto id={id('consequencia')} valor={minigame.consequencia.texto} max={FOGO_TEXTO_MAX_LENGTH} onCommit={(texto) => mudar({ consequencia: { texto } })} />
        <span className="lb-label">Só texto: aparece no convite e no resultado do jogador. O fogo não abre porta nem entrega item.</span>
      </fieldset>
      <PacoteDoMinigame jogo="fogo" ocupado={fogoAberto}>
        {aoVivoDoFogo === null || aoVivoDoFogo === undefined ? (
          <span className="lb-label lb-minigame__sem-sala">Abra a mesa online para chamar para o fogo.</span>
        ) : (
          <FogoAoVivoPainel pinId={pinId} permitida={minigame.permitida} {...aoVivoDoFogo} />
        )}
      </PacoteDoMinigame>
    </>
  )
}

type PainelDaBolhaProps = Pick<MinigameControlsProps, 'pinId' | 'onChange' | 'aoVivoDaBolha' | 'naFicha'> & { minigame: MinigameBolha }

/**
 * A Bolha d'Água do pino, no molde do fogo: quem pede ajuda, a fala, o
 * cenário, como começa, a dificuldade permitida, o prêmio e a consequência.
 * O mestre chama daqui (equipe ou cada um no seu); com "Jogador toca no
 * pino", o jogador também começa sozinho no cartão. Sem porta: a bolha não
 * abre nada.
 */
function PainelDaBolha({ pinId, minigame, onChange, aoVivoDaBolha, naFicha = false }: PainelDaBolhaProps) {
  const baseId = useId()
  const mudar = (patch: Partial<MinigameBolha>) => onChange({ ...minigame, ...patch })
  const id = (nome: string) => `${baseId}-${nome}`
  // Sala fechada ou sem partida = nada aberto; com partida aberta o jogo não troca de versão.
  const faseDaBolha = aoVivoDaBolha?.bolha?.fase
  const bolhaAberta = faseDaBolha === 'convite' || faseDaBolha === 'jogo' || faseDaBolha === 'pausa'
  return (
    <>
      {!naFicha && (
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('npc')}>
          Quem chama
        </label>
        <CampoDeTexto id={id('npc')} valor={minigame.npc} max={NPC_MAX_LENGTH} onCommit={(npc) => mudar({ npc })} />
      </div>
      )}
      {!naFicha && (
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('fala')}>
          O que diz
        </label>
        <CampoDeTexto id={id('fala')} valor={minigame.fala} max={FALA_MAX_LENGTH} linhas={3} onCommit={(fala) => mudar({ fala })} />
      </div>
      )}
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Cenário</legend>
        <Pastilhas rotulo="Cenário" opcoes={CENARIOS_DA_BOLHA} valor={minigame.cenario} onChange={(cenario) => cenario !== minigame.cenario && onChange(bolhaNoCenario(minigame, cenario))} />
      </fieldset>
      {!naFicha && (
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Como começa</legend>
        <Pastilhas rotulo="Como começa" opcoes={ENTRADAS} valor={minigame.entrada} onChange={(entrada) => mudar({ entrada })} />
        <span className="lb-label">
          {minigame.entrada === 'pino' ? 'O jogador começa sozinho no cartão do selo; você também pode chamar a mesa daqui.' : 'Só você chama, daqui do painel.'}
        </span>
      </fieldset>
      )}
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Dificuldade</legend>
        <Pastilhas rotulo="Dificuldade" opcoes={PERMITIDAS_DA_BOLHA} valor={minigame.permitida} onChange={(permitida) => mudar({ permitida })} />
        <span className="lb-label">Quem começa escolhe: você, ao chamar a mesa, ou o jogador sozinho no selo.</span>
      </fieldset>
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">O que vale</legend>
        <label className="lb-label" htmlFor={id('premio')}>
          Se apagar o fogo
        </label>
        <CampoDeTexto id={id('premio')} valor={minigame.premio.texto} max={BOLHA_TEXTO_MAX_LENGTH} onCommit={(texto) => mudar({ premio: { texto } })} />
        <label className="lb-label" htmlFor={id('consequencia')}>
          Se não apagar
        </label>
        <CampoDeTexto id={id('consequencia')} valor={minigame.consequencia.texto} max={BOLHA_TEXTO_MAX_LENGTH} onCommit={(texto) => mudar({ consequencia: { texto } })} />
        <span className="lb-label">Só texto: aparece no convite e no resultado do jogador. A bolha não abre porta nem entrega item.</span>
      </fieldset>
      <PacoteDoMinigame jogo="bolha" ocupado={bolhaAberta}>
        {aoVivoDaBolha === null || aoVivoDaBolha === undefined ? (
          <span className="lb-label lb-minigame__sem-sala">Abra a mesa online para chamar para a bolha.</span>
        ) : (
          <BolhaAoVivoPainel pinId={pinId} permitida={minigame.permitida} {...aoVivoDaBolha} />
        )}
      </PacoteDoMinigame>
    </>
  )
}

type PainelDaAlavancaProps = Omit<MinigameControlsProps, 'minigame'> & { minigame: MinigameAlavanca }

const CENAS_DA_ALAVANCA: readonly { valor: CenaAlavanca; rotulo: string }[] = CENAS_ALAVANCA.map((c) => ({ valor: c, rotulo: NOME_DA_CENA_ALAVANCA[c] }))

const DIFICULDADES_DA_ALAVANCA: readonly { valor: DificuldadeAlavanca; rotulo: string }[] = DIFICULDADES_ALAVANCA.map((d) => ({ valor: d, rotulo: NOME_DA_DIFICULDADE_ALAVANCA[d] }))

const ENTRADAS_DA_ALAVANCA: readonly { valor: EntradaAlavanca; rotulo: string }[] = ENTRADAS

/**
 * O DESAFIO DA ALAVANCA DA PONTE, como a aba Mestre do protótipo aprovado em
 * 20/11/2026: dificuldade, tempo limite (8 a 40 s, ou o padrão) e o que
 * acontece quando a ponte desce. "Quantos giram juntos" não é regra (não
 * grava nada): saiu da ficha (decisão 16 de docs/design/jogos/NOTAS.md, B24)
 * e a chance de vitória mora no "Chamar", com quem você marcou de verdade.
 * Mais o lugar e a fala do convite, e como começa (o molde dos outros jogos).
 * No topo, a CENA (Ponte levadiça | Canhão do chão, protótipo do canhão
 * aprovado em 20/11/2026): o mesmo jogo e os mesmos números, só muda o que
 * se vê e se ouve.
 */
function PainelDaAlavanca({ pinId, minigame, onChange, porta, aoVivoDaAlavanca, naFicha = false }: PainelDaAlavancaProps) {
  const baseId = useId()
  const id = (nome: string) => `${baseId}-${nome}`
  const mudar = (patch: Partial<MinigameAlavanca>) => onChange({ ...minigame, ...patch })
  const tempoPadrao = DIF[minigame.dificuldade].tempo
  // O controle desliza sem gravar: cada passo gravado seria um Ctrl+Z a mais. Grava ao soltar.
  const [arrastando, setArrastando] = useState<number | null>(null)
  const tempoVisto = arrastando ?? minigame.tempo ?? tempoPadrao
  const gravarTempo = () => {
    if (arrastando === null) return
    setArrastando(null)
    const tempo = tempoDaAlavanca(arrastando)
    if (tempo !== minigame.tempo) mudar({ tempo })
  }
  const portaAtual = porta.value !== null && porta.options.some((o) => o.id === porta.value) ? porta.value : ''
  const semPorta = porta.options.length === 0
  const T = TEXTOS_DA_CENA[minigame.cena]
  return (
    <>
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Cena</legend>
        <Pastilhas rotulo="Cena" opcoes={CENAS_DA_ALAVANCA} valor={minigame.cena} onChange={(cena) => cena !== minigame.cena && onChange(alavancaNaCena(minigame, cena))} />
        <span className="lb-label">O mesmo jogo e os mesmos números nas duas cenas: só muda o que se vê e se ouve.</span>
      </fieldset>
      {!naFicha && (
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('lugar')}>
          Lugar no convite
        </label>
        <CampoDeTexto id={id('lugar')} valor={minigame.lugar} max={ALAVANCA_LUGAR_MAX_LENGTH} onCommit={(lugar) => mudar({ lugar })} />
      </div>
      )}
      {!naFicha && (
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('fala')}>
          O que diz
        </label>
        <CampoDeTexto id={id('fala')} valor={minigame.fala} max={ALAVANCA_FALA_MAX_LENGTH} linhas={3} onCommit={(fala) => mudar({ fala })} />
      </div>
      )}
      {!naFicha && (
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Como começa</legend>
        <Pastilhas rotulo="Como começa" opcoes={ENTRADAS_DA_ALAVANCA} valor={minigame.entrada} onChange={(entrada) => mudar({ entrada })} />
        <span className="lb-label">
          {minigame.entrada === 'pino' ? 'O jogador gira sozinho pelo cartão do selo; você também pode chamar a equipe daqui.' : 'Só você chama, daqui do painel.'}
        </span>
      </fieldset>
      )}
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">Dificuldade</legend>
        <Pastilhas rotulo="Dificuldade" opcoes={DIFICULDADES_DA_ALAVANCA} valor={minigame.dificuldade} onChange={(dificuldade) => mudar({ dificuldade })} />
      </fieldset>
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('tempo')}>
          Tempo limite
        </label>
        <div className="lb-alavanca-tempo">
          <input
            id={id('tempo')}
            className="lb-range"
            type="range"
            min={ALAVANCA_TEMPO_MIN_S}
            max={ALAVANCA_TEMPO_MAX_S}
            step={1}
            value={tempoVisto}
            onChange={(event) => setArrastando(Number(event.target.value))}
            onPointerUp={gravarTempo}
            onKeyUp={gravarTempo}
            onBlur={gravarTempo}
          />
          <output className="lb-num" htmlFor={id('tempo')}>
            {tempoVisto} s
          </output>
          <button type="button" className="lb-btn lb-btn--compact" disabled={minigame.tempo === null && arrastando === null} onClick={() => {
            setArrastando(null)
            mudar({ tempo: null })
          }}>
            Padrão
          </button>
        </div>
      </div>
      <fieldset className="lb-minigame__grupo">
        <legend className="lb-label">{T.quandoVencer}</legend>
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
          <option value="">{T.semPorta}</option>
          {porta.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <span id={id('porta-efeito')} className="lb-label">
          {semPorta ? T.ponhaPorta : portaAtual === '' ? T.efeitoSemPorta : T.efeitoComPorta}
        </span>
      </fieldset>
      {aoVivoDaAlavanca === null || aoVivoDaAlavanca === undefined ? (
        <span className="lb-label lb-minigame__sem-sala">Abra a mesa online para chamar para a alavanca.</span>
      ) : (
        <AlavancaAoVivoPainel pinId={pinId} cena={minigame.cena} dificuldade={minigame.dificuldade} tempo={minigame.tempo} {...aoVivoDaAlavanca} />
      )}
    </>
  )
}

type PainelDaDancaProps = Omit<MinigameControlsProps, 'minigame'> & { minigame: MinigameDanca }

function PainelDaDanca({ pinId, minigame, onChange, porta, aoVivo, caminho = CAMINHO_DO_APP, naFicha = false }: PainelDaDancaProps) {
  const baseId = useId()
  const mudar = (patch: Partial<MinigameDanca>) => onChange({ ...minigame, ...patch })
  const portaAtual = porta.value !== null && porta.options.some((o) => o.id === porta.value) ? porta.value : ''
  const semPorta = porta.options.length === 0
  const id = (nome: string) => `${baseId}-${nome}`
  return (
    <>
      {!naFicha && (
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('npc')}>
          Quem chama
        </label>
        <CampoDeTexto id={id('npc')} valor={minigame.npc} max={NPC_MAX_LENGTH} onCommit={(npc) => mudar({ npc })} />
      </div>
      )}
      {!naFicha && (
      <div className="lb-field">
        <label className="lb-label" htmlFor={id('fala')}>
          O que diz
        </label>
        <CampoDeTexto id={id('fala')} valor={minigame.fala} max={FALA_MAX_LENGTH} linhas={3} onCommit={(fala) => mudar({ fala })} />
      </div>
      )}
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
        <span className="lb-label lb-minigame__sem-sala">Abra a mesa online, ou a Visão de jogador para testar sozinho, para chamar para dançar.</span>
      ) : (
        <DancaAoVivoPainel pinId={pinId} {...aoVivo} />
      )}
    </>
  )
}
