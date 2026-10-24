import { estaCalado, useSomStore, type PreferenciaDeSom } from '../../../stores/somStore'
import { ehIdDeAudio, idDaRefDeAudio, type TipoDeAudio } from '../../midia'
import { VOLUME_DE_SOM_PADRAO, type FonteDoSom } from '../biblioteca'
import { obterSaidaAoVivoDoNavegador, quandoOAudioRodar } from '../contexto'

/**
 * MOTOR DOS SONS AO VIVO (Sistema 4, fatia F2; plano em
 * `docs/planos/sons-ao-vivo-2026-10-23.md`): toca os arquivos de áudio da
 * biblioteca da aventura, no mestre e no jogador. Não tem tela nem rede: a aba
 * Sons (F3), a rede (F4) e o jogador (F5) o usam por esta API pequena.
 *
 *  - Quem traz os bytes é INJETADO: o mestre lê do disco (`lerAudioGuardado`),
 *    o jogador busca `/sons/<id>` (com a chave da sala). Dois toques do mesmo arquivo ao mesmo tempo
 *    fazem UMA leitura, com prazo (`PRAZO_DO_CARREGAMENTO_MS`); o efeito
 *    curto cujo áudio chega 2 s depois do pedido é descartado ('atrasado').
 *  - Cache em duas camadas: os bytes como chegaram e o áudio pronto. Até 1 MB
 *    o arquivo fica decodificado (o clique toca na hora); acima, vira Blob
 *    tocado por `<audio>` ligado ao Web Audio, que pula para o meio do arquivo
 *    sem decodificar 15 MB (e `/sons` não tem Range). O corte é pelo tamanho
 *    total na memória: sai o menos usado que não está tocando.
 *  - Limites: `MAX_SONS_SIMULTANEOS` ao todo e `MAX_LOOPS` loops. Efeito curto
 *    acima do limite derruba o efeito curto mais antigo; loop acima do limite é
 *    recusado com motivo (o aviso na tela é da F3).
 *  - Sai pela entrada `aoVivo` do `contexto.ts`, sem o passa-baixa dos sons de
 *    clima. Volume final = volume do efeito x volume do aparelho (`somStore`)
 *    ao quadrado, a curva dos sons de clima; o Mudo zera o ganho sem parar
 *    nada (o loop segue de onde estava).
 *  - Nada toca antes do gesto: efeito curto esperando o destravamento há mais
 *    de `ESPERA_DO_EFEITO_CURTO_MS` é descartado; o loop espera e começa, com o
 *    deslocamento corrigido pelo tempo que esperou, quando o gesto destrava.
 *
 * Os tipos são o subconjunto do Web Audio que o motor usa, para o teste
 * injetar um contexto falso (`audioFalso.fixture.ts`); `N` é o tipo de nó.
 */

const MB = 1024 * 1024

export const MAX_SONS_SIMULTANEOS = 8
export const MAX_LOOPS = 3
/** Players do YouTube ao mesmo tempo (F6): declarado aqui para os limites morarem num lugar só. */
export const MAX_YOUTUBE = 2
export const FADE_AO_PARAR_MS = 150
/** Efeito curto é evento: esperando o gesto (ou o próprio áudio) por mais que isto, chegaria fora de hora. */
export const ESPERA_DO_EFEITO_CURTO_MS = 2000
/**
 * Bytes que não chegam em tanto tempo viram falha: sem prazo, um carregador
 * que nunca responde prende a voz numa das vagas para sempre e trava quem
 * pedir o mesmo arquivo depois. Folgado para os 15 MB do teto pelo túnel (a
 * F7 mede); o efeito curto já cai bem antes, pela regra dos 2 s.
 */
export const PRAZO_DO_CARREGAMENTO_MS = 30_000
/** Até este tamanho o arquivo fica decodificado; acima, toca por `<audio>` a partir de um Blob. */
export const DECODIFICADO_ATE_BYTES = 1 * MB
/**
 * Quantos arquivos a pré-carga traz, no máximo (o mestre manda os primeiros
 * favoritos; o aparelho corta o resto). O servidor da sala (plano F5, seção 2)
 * aceita 30 buscas por 10 s por IP, e os 4 jogadores e a TV podem sair pelo
 * MESMO IP (o túnel de uma casa, o NAT): 5 x 4 = 20 pré-cargas deixam 10
 * buscas para os toques desses 10 s. Com 6 seriam 30, e o 1º toque levaria 429.
 */
export const PRE_CARGA_MAX_ARQUIVOS = 4
/**
 * Buscas da pré-carga ao mesmo tempo, por aparelho, e só quando nenhuma outra
 * está no ar. O servidor aceita 2 por chave e 6 na sala: com 5 aparelhos, 1
 * de cada deixa a vaga do toque, que nunca entra na fila.
 */
const BUSCAS_DA_PRE_CARGA = 1
/**
 * Quanto o áudio comprimido cresce ao decodificar, para decidir ANTES: MP3 de
 * 128 kbit/s vira 48 kHz, estéreo, 32 bits por amostra (~24x). O WAV cresce
 * menos; a estimativa alta só faz a pré-carga decodificar menos adiantado.
 */
const CRESCIMENTO_AO_DECODIFICAR = 24
/** A pré-carga decodifica adiantado só até esta fração do orçamento do cache: o resto é do que o clique toca. */
const FRACAO_DO_CACHE_PARA_ADIANTAR = 0.5
export const CACHE_NO_COMPUTADOR_BYTES = 150 * MB
/** Celular (`pointer: coarse`) tem bem menos memória para áudio decodificado. */
export const CACHE_NO_CELULAR_BYTES = 60 * MB
/** Volume e Mudo mudam numa rampa curta: o salto instantâneo do ganho estala. */
const RAMPA_DE_VOLUME_S = 0.03
/** O áudio decodificado guarda cada amostra em 32 bits. */
const BYTES_POR_AMOSTRA_DECODIFICADA = 4

const TIPO_MIME_DO_AUDIO: Record<TipoDeAudio, string> = {
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
}

export interface ParametroAoVivo {
  setValueAtTime(valor: number, quando: number): unknown
  linearRampToValueAtTime(valor: number, quando: number): unknown
  cancelScheduledValues(quando: number): unknown
}

interface NoAoVivo<N> {
  connect(destino: N): unknown
}

export interface GanhoAoVivo<N> extends NoAoVivo<N> {
  readonly gain: ParametroAoVivo
  disconnect(): void
}

export interface BufferAoVivo {
  readonly duration: number
  /** Quadros por canal. */
  readonly length: number
  readonly numberOfChannels: number
}

export interface FonteAoVivo<N> extends NoAoVivo<N> {
  buffer: BufferAoVivo | null
  loop: boolean
  start(quando: number, deslocamento?: number): void
  stop(quando?: number): void
  addEventListener(tipo: 'ended', ouvinte: () => void): void
}

/** O pedaço do `<audio>` que o motor usa. */
export interface ElementoDeAudio {
  src: string
  loop: boolean
  currentTime: number
  readonly duration: number
  play(): Promise<void>
  pause(): void
  addEventListener(tipo: 'loadedmetadata' | 'ended' | 'error', ouvinte: () => void): void
}

export interface ContextoAoVivo<N> {
  readonly currentTime: number
  readonly state: AudioContextState
  createGain(): GanhoAoVivo<N> & N
  createBufferSource(): FonteAoVivo<N>
  createMediaElementSource(elemento: ElementoDeAudio): NoAoVivo<N>
  decodeAudioData(dados: ArrayBuffer): Promise<BufferAoVivo>
}

export interface SaidaAoVivo<N> {
  readonly ctx: ContextoAoVivo<N>
  /** A entrada `aoVivo` do `contexto.ts`: direto no destination, sem passa-baixa. */
  readonly aoVivo: N
}

/** Traz os bytes do áudio `<sha256>.<ext>`; lança quando não consegue. */
export type CarregadorDeBytes = (idDaMidia: string) => Promise<Uint8Array>

export interface OpcoesDoToqueAoVivo {
  /** Ambiente que se repete até o Parar. */
  loop: boolean
  /** De onde começa, em segundos (o loop pego no meio); no loop, dá a volta pela duração. */
  deslocamentoS?: number
  /** De 0 a 1; o ganho final é este vezes o volume do aparelho ao quadrado. */
  volumeDoEfeito: number
}

export type MotivoDaRecusa =
  /** Já há `MAX_LOOPS` loops tocando. */
  | 'limite-de-loops'
  /** Efeito curto que esperou o gesto destravar o áudio por mais de `ESPERA_DO_EFEITO_CURTO_MS`. */
  | 'sem-gesto'
  /** Efeito curto cujo áudio chegou `ESPERA_DO_EFEITO_CURTO_MS` ou mais depois do pedido: tocaria fora de hora. */
  | 'atrasado'
  /** Os bytes não vieram, ou o áudio não decodificou nem tocou. */
  | 'nao-carregou'
  /** A referência não é de um áudio guardado (`midia:<sha256>.<ext>`). */
  | 'fonte-invalida'
  /** Fonte que este motor não toca: o de arquivo recusa YouTube (quem toca vídeo é `motorComYoutube.ts`). */
  | 'fonte-sem-suporte'
  /** YouTube, erros 101, 150 e 153: o vídeo não deixa tocar fora do YouTube (dono, região ou origem sem Referer). */
  | 'youtube-bloqueado'
  /** YouTube, erro 100: o vídeo foi removido ou é privado. */
  | 'youtube-indisponivel'

export type MotivoDoFim = 'fim' | 'parado' | 'derrubado'

export type EventoDoMotor =
  /** Pedido antes de o gesto destravar o áudio: a F5 mostra a faixinha "toque para ouvir". */
  | { tipo: 'esperando'; instancia: string }
  /** O gesto (ou o áudio que voltou a rodar) tirou da espera; ainda falta o arquivo: a faixinha sai. Só vem depois de 'esperando'. */
  | { tipo: 'carregando'; instancia: string }
  /** Começou a soar; a barra de progresso (F3) anda a partir de `inicioEmMs` (relógio `agora`). */
  | { tipo: 'tocando'; instancia: string; loop: boolean; duracaoS: number; deslocamentoS: number; inicioEmMs: number }
  | { tipo: 'terminou'; instancia: string; motivo: MotivoDoFim }
  | { tipo: 'recusado'; instancia: string; motivo: MotivoDaRecusa }

export type ResultadoDoToque = { aceito: true } | { aceito: false; motivo: MotivoDaRecusa }

export interface MotorAoVivo {
  /** Toca a `fonte` como `instancia`; a mesma instância tocando antes é trocada por esta. */
  tocar(instancia: string, fonte: FonteDoSom, opcoes: OpcoesDoToqueAoVivo): ResultadoDoToque
  /** Desce o ganho até 0 em `fadeMs` e para. Instância que não existe: nada acontece. */
  parar(instancia: string, fadeMs?: number): void
  pararTudo(): void
  mudarVolume(instancia: string, volumeDoEfeito: number): void
  /** Traz os bytes antes do clique (e decodifica os pequenos, se o áudio já destravou). Ids inválidos são ignorados. */
  precarregar(ids: readonly string[]): void
  assinar(ouvinte: (evento: EventoDoMotor) => void): () => void
  /** Para tudo sem fade, solta os ouvintes do aparelho e esvazia o cache. */
  desmontar(): void
}

export interface DependenciasDoMotor<N> {
  carregarBytes: CarregadorDeBytes
  /** A saída de agora; `null` antes do 1º gesto criar o contexto. */
  obterSaida: () => SaidaAoVivo<N> | null
  /** Avisa cada vez que o áudio volta a rodar (pelo gesto ou fora dele); devolve a função que tira o ouvinte. */
  aoDestravar: (ouvinte: () => void) => () => void
  lerPreferencia: () => PreferenciaDeSom
  assinarPreferencia: (ouvinte: () => void) => () => void
  criarElementoDeAudio: () => ElementoDeAudio
  criarUrlDoAudio: (bytes: Uint8Array, tipoMime: string) => string
  revogarUrl: (url: string) => void
  /** Relógio em ms, monotônico. */
  agora: () => number
  orcamentoDoCacheBytes: number
  /**
   * Avisa quando a reserva de `<audio>` destravados é reposta (um gesto novo,
   * F5): o toque que esperava porque o `play()` foi recusado com o contexto já
   * rodando tenta de novo, já que o aviso de destravamento não viria.
   */
  aoReporReservas?: (ouvinte: () => void) => () => void
}

/**
 * `<audio>` destravados por um gesto (F5). No iOS só toca depois o elemento
 * que tocou dentro de um toque; o motor tira daqui antes de criar um novo.
 */
export interface ReservaDeAudios {
  /** Um `<audio>` destravado, que sai da reserva; `null` quando ela acabou. */
  tirar(): ElementoDeAudio | null
  /** Avisa a cada reposição (um gesto); devolve a função que tira o ouvinte. */
  aoRepor(ouvinte: () => void): () => void
}

export interface OpcoesDoMotorDoNavegador {
  /** Os `<audio>` destravados pelo toque na faixinha (jogador e TV); sem ela, cada toque cria um novo. */
  reservas?: ReservaDeAudios
  /** De onde vêm o volume e o Mudo; o padrão é o do aparelho (`somStore`). A TV passa uma fixa. */
  preferencia?: Pick<DependenciasDoMotor<AudioNode>, 'lerPreferencia' | 'assinarPreferencia'>
}

/** O que guarda cada arquivo: os bytes ainda por decodificar, o áudio decodificado ou o Blob do arquivo grande. */
type Guardado = { tipo: 'bytes'; bytes: Uint8Array } | { tipo: 'decodificado'; buffer: BufferAoVivo } | { tipo: 'blob'; url: string }
type AudioPronto = Exclude<Guardado, { tipo: 'bytes' }>

interface EntradaDoCache {
  readonly guardado: Guardado
  /** Bytes que ocupa na memória. */
  readonly custo: number
}

interface Tocador<N> {
  readonly ctx: ContextoAoVivo<N>
  readonly ganho: GanhoAoVivo<N>
  /** Desce o ganho até 0 em `fadeMs` e para de soar no fim da descida. */
  encerrar(fadeMs: number): void
}

interface Voz<N> {
  readonly instancia: string
  readonly id: string
  readonly loop: boolean
  readonly deslocamentoS: number
  /** Quando o toque foi pedido (relógio `agora`): corrige o deslocamento do loop que esperou. */
  readonly pedidoEmMs: number
  volumeDoEfeito: number
  /** O último ganho mandado ao nó: de onde parte a próxima rampa. */
  ganhoAplicado: number
  estado: 'carregando' | 'esperando' | 'tocando'
  avisouEspera: boolean
  expira: ReturnType<typeof setTimeout> | null
  /** `null` até o som estar ligado ao grafo. */
  tocador: Tocador<N> | null
}

function tipoMimeDoId(id: string): string {
  for (const [extensao, tipo] of Object.entries(TIPO_MIME_DO_AUDIO)) if (id.endsWith(`.${extensao}`)) return tipo
  return TIPO_MIME_DO_AUDIO.mp3
}

function custoDecodificado(buffer: BufferAoVivo): number {
  return buffer.length * buffer.numberOfChannels * BYTES_POR_AMOSTRA_DECODIFICADA
}

function volumeValido(volume: number): number {
  return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : VOLUME_DE_SOM_PADRAO
}

/** Pelo nome, não por `instanceof Error`: `DOMException` herda de `Error` só nos navegadores mais novos. */
/** A promessa, ou a falha quando ela não responde em `prazoMs`. */
function comPrazo<T>(promessa: Promise<T>, prazoMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const prazo = setTimeout(() => reject(new Error('o áudio não chegou no prazo')), prazoMs)
    promessa.then(
      (valor) => {
        clearTimeout(prazo)
        resolve(valor)
      },
      (erro: unknown) => {
        clearTimeout(prazo)
        reject(erro)
      },
    )
  })
}

function erroDeAutoplay(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && 'name' in erro && erro.name === 'NotAllowedError'
}

export function criarMotorAoVivo<N>(deps: DependenciasDoMotor<N>): MotorAoVivo {
  const { carregarBytes, obterSaida, lerPreferencia, criarElementoDeAudio, criarUrlDoAudio, revogarUrl, agora } = deps
  /** Ordem de inserção = idade: a primeira é a mais antiga. */
  const vozes = new Map<string, Voz<N>>()
  const ouvintes = new Set<(evento: EventoDoMotor) => void>()
  /** Ordem de inserção = uso: o primeiro é o menos usado. */
  const cache = new Map<string, EntradaDoCache>()
  const buscando = new Map<string, Promise<void>>()
  const decodificando = new Map<string, Promise<BufferAoVivo>>()
  /** Ids da pré-carga que ainda não começaram a descer, na ordem pedida. */
  let filaDaPreCarga: string[] = []
  /** Uma decodificação adiantada por vez (`adiantarDecodificacao`). */
  let adiantando = false
  /** Depois do `desmontar`, o que ainda chega não é guardado: ninguém mais revogaria nem esvaziaria. */
  let desmontado = false

  function emitir(evento: EventoDoMotor): void {
    for (const ouvinte of [...ouvintes]) {
      try {
        ouvinte(evento)
      } catch (erro) {
        // A tela quebrada não para o som; o erro ainda aparece no console.
        queueMicrotask(() => {
          throw erro
        })
      }
    }
  }

  const viva = (voz: Voz<N>): boolean => vozes.get(voz.instancia) === voz

  // ---- cache ----

  function descartarDoCache(id: string, entrada: EntradaDoCache): void {
    cache.delete(id)
    if (entrada.guardado.tipo === 'blob') revogarUrl(entrada.guardado.url)
  }

  function cortarCache(): void {
    let total = 0
    for (const entrada of cache.values()) total += entrada.custo
    if (total <= deps.orcamentoDoCacheBytes) return
    const emUso = new Set<string>()
    for (const voz of vozes.values()) emUso.add(voz.id)
    for (const [id, entrada] of [...cache]) {
      if (total <= deps.orcamentoDoCacheBytes) return
      if (emUso.has(id)) continue
      descartarDoCache(id, entrada)
      total -= entrada.custo
    }
  }

  function guardar(id: string, guardado: Guardado, custo: number): void {
    if (desmontado) return
    cache.delete(id)
    cache.set(id, { guardado, custo })
    cortarCache()
  }

  /** A entrada do arquivo, marcada como a mais usada. */
  function usar(id: string): EntradaDoCache | undefined {
    const entrada = cache.get(id)
    if (entrada === undefined) return undefined
    cache.delete(id)
    cache.set(id, entrada)
    return entrada
  }

  function garantirBytes(id: string): Promise<void> {
    if (cache.has(id)) return Promise.resolve()
    const emCurso = buscando.get(id)
    if (emCurso !== undefined) return emCurso
    const busca = comPrazo(
      Promise.resolve().then(() => carregarBytes(id)),
      PRAZO_DO_CARREGAMENTO_MS,
    )
      .then((bytes) => {
        // Antes de criar a URL do Blob: depois do desmontar, ninguém a revogaria.
        if (desmontado) return
        if (bytes.length > DECODIFICADO_ATE_BYTES) guardar(id, { tipo: 'blob', url: criarUrlDoAudio(bytes, tipoMimeDoId(id)) }, bytes.length)
        else guardar(id, { tipo: 'bytes', bytes }, bytes.length)
      })
      .finally(() => {
        buscando.delete(id)
        puxarPreCarga()
      })
    buscando.set(id, busca)
    return busca
  }

  /**
   * A próxima da pré-carga desce quando nenhuma busca está no ar: o toque
   * busca na hora (passa à frente) e a fila espera ele acabar.
   */
  function puxarPreCarga(): void {
    if (desmontado || buscando.size >= BUSCAS_DA_PRE_CARGA) return
    let id = filaDaPreCarga.shift()
    while (id !== undefined && (cache.has(id) || buscando.has(id))) id = filaDaPreCarga.shift()
    if (id === undefined) return
    // Pré-carga é adiantamento: se falhar, o clique tenta de novo e avisa.
    garantirBytes(id).then(adiantarDecodificacao, () => undefined)
  }

  function decodificar(id: string, bytes: Uint8Array, ctx: ContextoAoVivo<N>): Promise<BufferAoVivo> {
    const emCurso = decodificando.get(id)
    if (emCurso !== undefined) return emCurso
    // Cópia: o decodeAudioData toma posse do ArrayBuffer, e os bytes podem ser de quem os trouxe.
    const decodificacao = ctx
      .decodeAudioData(bytes.slice().buffer)
      .then((buffer) => {
        guardar(id, { tipo: 'decodificado', buffer }, custoDecodificado(buffer))
        return buffer
      })
      .finally(() => {
        decodificando.delete(id)
      })
    decodificando.set(id, decodificacao)
    return decodificacao
  }

  async function audioPronto(id: string, ctx: ContextoAoVivo<N>): Promise<AudioPronto> {
    await garantirBytes(id)
    const entrada = usar(id)
    // A voz que pediu protege a entrada do corte; sem ela aqui, algo a tirou no meio do caminho.
    if (entrada === undefined) throw new Error('o áudio saiu do cache antes de tocar')
    const { guardado } = entrada
    if (guardado.tipo === 'bytes') return { tipo: 'decodificado', buffer: await decodificar(id, guardado.bytes, ctx) }
    return guardado
  }

  /** Os bytes guardados que cabem decodificados na parte adiantável do orçamento, pela estimativa; `null` = nenhum. */
  function proximoParaAdiantar(): { id: string; bytes: Uint8Array } | null {
    let total = 0
    for (const entrada of cache.values()) total += entrada.custo
    const teto = deps.orcamentoDoCacheBytes * FRACAO_DO_CACHE_PARA_ADIANTAR
    for (const [id, entrada] of cache) {
      if (entrada.guardado.tipo !== 'bytes' || decodificando.has(id)) continue
      // Decodificado, o arquivo troca os bytes pelo áudio pronto na conta.
      if (total - entrada.custo + entrada.custo * CRESCIMENTO_AO_DECODIFICAR <= teto) return { id, bytes: entrada.guardado.bytes }
    }
    return null
  }

  /**
   * Decodifica o que a pré-carga trouxe, UM por vez e só o que cabe: 1 MB de
   * MP3 vira ~25 MB decodificado, e decodificar todos juntos estoura a memória
   * do celular antes de o corte do cache agir. O que não coube fica em bytes e
   * decodifica no clique.
   */
  function adiantarDecodificacao(): void {
    if (adiantando || desmontado) return
    const saida = obterSaida()
    if (saida === null || saida.ctx.state !== 'running') return
    const proximo = proximoParaAdiantar()
    if (proximo === null) return
    adiantando = true
    decodificar(proximo.id, proximo.bytes, saida.ctx)
      // Adiantamento: se falhar aqui, o clique tenta de novo e avisa.
      .catch(() => undefined)
      .finally(() => {
        adiantando = false
        adiantarDecodificacao()
      })
  }

  // ---- vozes ----

  /**
   * O aparelho entra AO QUADRADO, a mesma curva dos sons de clima
   * (`tocarReceita`): com a barra em linha reta, a 35% o som ao vivo sairia
   * ~9 dB acima do clima.
   */
  function ganhoDesejado(voz: Voz<N>): number {
    const preferencia = lerPreferencia()
    return estaCalado(preferencia) ? 0 : voz.volumeDoEfeito * preferencia.volume * preferencia.volume
  }

  /** Leva o ganho da voz até `alvo` em `duracaoS`, a partir do último valor mandado; devolve quando chega. */
  function levarGanho(voz: Voz<N>, tocador: Tocador<N>, alvo: number, duracaoS: number): number {
    const { gain } = tocador.ganho
    const agoraS = tocador.ctx.currentTime
    gain.cancelScheduledValues(agoraS)
    gain.setValueAtTime(voz.ganhoAplicado, agoraS)
    gain.linearRampToValueAtTime(alvo, agoraS + duracaoS)
    voz.ganhoAplicado = alvo
    return agoraS + duracaoS
  }

  function aplicarGanho(voz: Voz<N>): void {
    if (voz.tocador === null) return
    const alvo = ganhoDesejado(voz)
    if (alvo !== voz.ganhoAplicado) levarGanho(voz, voz.tocador, alvo, RAMPA_DE_VOLUME_S)
  }

  function soltarVoz(voz: Voz<N>): void {
    vozes.delete(voz.instancia)
    if (voz.expira !== null) {
      clearTimeout(voz.expira)
      voz.expira = null
    }
  }

  function encerrarVoz(voz: Voz<N>, fadeMs: number, motivo: MotivoDoFim): void {
    soltarVoz(voz)
    if (voz.tocador !== null) voz.tocador.encerrar(fadeMs)
    emitir({ tipo: 'terminou', instancia: voz.instancia, motivo })
  }

  function recusarVoz(voz: Voz<N>, motivo: MotivoDaRecusa): void {
    soltarVoz(voz)
    if (voz.tocador !== null) voz.tocador.encerrar(0)
    emitir({ tipo: 'recusado', instancia: voz.instancia, motivo })
  }

  function terminouSozinha(voz: Voz<N>): void {
    soltarVoz(voz)
    emitir({ tipo: 'terminou', instancia: voz.instancia, motivo: 'fim' })
  }

  function marcarTocando(voz: Voz<N>, duracaoS: number, deslocamentoS: number): void {
    voz.estado = 'tocando'
    emitir({ tipo: 'tocando', instancia: voz.instancia, loop: voz.loop, duracaoS, deslocamentoS, inicioEmMs: agora() })
  }

  /**
   * De onde a voz começa. O loop soma o tempo desde o pedido (carregando ou
   * esperando o gesto) e dá a volta pela duração (sem duração válida, começa
   * do 0). O efeito curto começa no deslocamento pedido se ele ainda cabe;
   * `null` = já teria acabado, ou não há o que tocar (duração 0 ou NaN). A
   * duração infinita (arquivo sem duração no cabeçalho) toca: nenhum
   * deslocamento fica depois do fim dela.
   */
  function deslocamentoDeInicio(voz: Voz<N>, duracaoS: number): number | null {
    if (!voz.loop) return voz.deslocamentoS < duracaoS ? voz.deslocamentoS : null
    if (!(Number.isFinite(duracaoS) && duracaoS > 0)) return 0
    return (voz.deslocamentoS + (agora() - voz.pedidoEmMs) / 1000) % duracaoS
  }

  function ligarGanho(voz: Voz<N>, saida: SaidaAoVivo<N>): GanhoAoVivo<N> & N {
    const ganho = saida.ctx.createGain()
    voz.ganhoAplicado = ganhoDesejado(voz)
    ganho.gain.setValueAtTime(voz.ganhoAplicado, saida.ctx.currentTime)
    ganho.connect(saida.aoVivo)
    return ganho
  }

  function iniciarDecodificado(voz: Voz<N>, saida: SaidaAoVivo<N>, buffer: BufferAoVivo): void {
    const deslocamento = deslocamentoDeInicio(voz, buffer.duration)
    if (deslocamento === null) {
      terminouSozinha(voz)
      return
    }
    const { ctx } = saida
    const ganho = ligarGanho(voz, saida)
    const fonte = ctx.createBufferSource()
    fonte.buffer = buffer
    fonte.loop = voz.loop
    fonte.connect(ganho)
    const tocador: Tocador<N> = {
      ctx,
      ganho,
      encerrar: (fadeMs) => fonte.stop(levarGanho(voz, tocador, 0, fadeMs / 1000)),
    }
    // Chega no fim natural e também depois do stop: o nó sai do grafo nos dois.
    fonte.addEventListener('ended', () => {
      ganho.disconnect()
      if (viva(voz) && voz.tocador === tocador) terminouSozinha(voz)
    })
    fonte.start(0, deslocamento)
    voz.tocador = tocador
    marcarTocando(voz, buffer.duration, deslocamento)
  }

  function iniciarPorElemento(voz: Voz<N>, saida: SaidaAoVivo<N>, url: string): void {
    const { ctx } = saida
    const elemento = criarElementoDeAudio()
    elemento.loop = voz.loop
    const ganho = ligarGanho(voz, saida)
    ctx.createMediaElementSource(elemento).connect(ganho)
    const soltarElemento = (): void => {
      elemento.pause()
      ganho.disconnect()
    }
    const tocador: Tocador<N> = {
      ctx,
      ganho,
      encerrar: (fadeMs) => {
        levarGanho(voz, tocador, 0, fadeMs / 1000)
        if (fadeMs > 0) setTimeout(soltarElemento, fadeMs)
        else soltarElemento()
      },
    }
    const minha = (): boolean => viva(voz) && voz.tocador === tocador
    // O deslocamento do loop precisa da duração, que só existe depois dos metadados.
    elemento.addEventListener('loadedmetadata', () => {
      if (!minha()) return
      const deslocamento = deslocamentoDeInicio(voz, elemento.duration)
      if (deslocamento === null) {
        terminouSozinha(voz)
        soltarElemento()
        return
      }
      elemento.currentTime = deslocamento
      // Só soa quando o play() responde: avisar antes deixaria quem ouve achando que tocou.
      elemento.play().then(
        () => {
          if (minha()) marcarTocando(voz, elemento.duration, deslocamento)
        },
        (erro: unknown) => {
          if (!minha()) return
          if (!erroDeAutoplay(erro)) {
            recusarVoz(voz, 'nao-carregou')
            return
          }
          // O navegador quer um gesto para este <audio> (iOS): solta este, e o
          // próximo destravamento cria outro. O curto segue a regra dos 2 s desde o pedido.
          soltarElemento()
          voz.tocador = null
          if (voz.loop || agora() - voz.pedidoEmMs < ESPERA_DO_EFEITO_CURTO_MS) esperarGesto(voz)
          else recusarVoz(voz, 'sem-gesto')
        },
      )
    })
    elemento.addEventListener('ended', () => {
      ganho.disconnect()
      if (minha()) terminouSozinha(voz)
    })
    elemento.addEventListener('error', () => {
      if (minha()) recusarVoz(voz, 'nao-carregou')
    })
    voz.tocador = tocador
    elemento.src = url
  }

  function esperarGesto(voz: Voz<N>): void {
    voz.estado = 'esperando'
    if (!voz.avisouEspera) {
      voz.avisouEspera = true
      emitir({ tipo: 'esperando', instancia: voz.instancia })
    }
    if (voz.loop || voz.expira !== null) return
    const resta = ESPERA_DO_EFEITO_CURTO_MS - (agora() - voz.pedidoEmMs)
    voz.expira = setTimeout(() => {
      voz.expira = null
      if (viva(voz) && voz.estado === 'esperando') recusarVoz(voz, 'sem-gesto')
    }, Math.max(0, resta))
  }

  function iniciar(voz: Voz<N>, saida: SaidaAoVivo<N>, pronto: AudioPronto): void {
    if (!viva(voz)) return
    if (!voz.loop && agora() - voz.pedidoEmMs >= ESPERA_DO_EFEITO_CURTO_MS) {
      recusarVoz(voz, 'atrasado')
      return
    }
    // Suspenso de novo enquanto carregava (tela bloqueada no celular): espera o próximo gesto.
    if (saida.ctx.state !== 'running') {
      esperarGesto(voz)
      return
    }
    try {
      if (pronto.tipo === 'decodificado') iniciarDecodificado(voz, saida, pronto.buffer)
      else iniciarPorElemento(voz, saida, pronto.url)
    } catch {
      // Nó recusado pelo navegador (contexto fechado): a voz não toca, e quem pediu fica sabendo.
      if (viva(voz)) recusarVoz(voz, 'nao-carregou')
    }
  }

  function tentarIniciar(voz: Voz<N>): void {
    if (!viva(voz)) return
    const saida = obterSaida()
    if (saida === null || saida.ctx.state !== 'running') {
      esperarGesto(voz)
      return
    }
    if (voz.expira !== null) {
      clearTimeout(voz.expira)
      voz.expira = null
    }
    voz.estado = 'carregando'
    // Saiu da espera: a faixinha não pede outro toque enquanto o arquivo desce. Se voltar a esperar, avisa de novo.
    if (voz.avisouEspera) {
      voz.avisouEspera = false
      emitir({ tipo: 'carregando', instancia: voz.instancia })
    }
    audioPronto(voz.id, saida.ctx).then(
      (pronto) => iniciar(voz, saida, pronto),
      () => {
        if (viva(voz)) recusarVoz(voz, 'nao-carregou')
      },
    )
  }

  /** O gesto destravou: começa o que esperava e decodifica o que a pré-carga trouxe. */
  function retomar(): void {
    for (const voz of [...vozes.values()]) {
      if (voz.estado !== 'esperando') continue
      if (!voz.loop && agora() - voz.pedidoEmMs >= ESPERA_DO_EFEITO_CURTO_MS) recusarVoz(voz, 'sem-gesto')
      else tentarIniciar(voz)
    }
    adiantarDecodificacao()
  }

  /** Abre lugar para uma voz nova derrubando o efeito curto mais antigo (loop nunca é derrubado). */
  function abrirVaga(): void {
    while (vozes.size >= MAX_SONS_SIMULTANEOS) {
      const maisAntigo = [...vozes.values()].find((voz) => !voz.loop)
      if (maisAntigo === undefined) return
      encerrarVoz(maisAntigo, FADE_AO_PARAR_MS, 'derrubado')
    }
  }

  function contarLoops(): number {
    let loops = 0
    for (const voz of vozes.values()) if (voz.loop) loops++
    return loops
  }

  function recusar(instancia: string, motivo: MotivoDaRecusa): ResultadoDoToque {
    emitir({ tipo: 'recusado', instancia, motivo })
    return { aceito: false, motivo }
  }

  const desligarPreferencia = deps.assinarPreferencia(() => {
    for (const voz of vozes.values()) aplicarGanho(voz)
  })
  const desligarDestravar = deps.aoDestravar(retomar)
  const desligarReposicao = deps.aoReporReservas?.(retomar)

  return {
    tocar(instancia, fonte, opcoes) {
      if (fonte.tipo !== 'arquivo') return recusar(instancia, 'fonte-sem-suporte')
      const id = idDaRefDeAudio(fonte.ref)
      if (id === null) return recusar(instancia, 'fonte-invalida')
      const anterior = vozes.get(instancia)
      // O limite antes de encerrar a anterior: recusado, o som que já tocava segue. A anterior, se era loop, sai da conta.
      const loopsQueFicam = contarLoops() - (anterior !== undefined && anterior.loop ? 1 : 0)
      if (opcoes.loop && loopsQueFicam >= MAX_LOOPS) return recusar(instancia, 'limite-de-loops')
      if (anterior !== undefined) encerrarVoz(anterior, 0, 'parado')
      abrirVaga()
      const pedido = opcoes.deslocamentoS ?? 0
      const voz: Voz<N> = {
        instancia,
        id,
        loop: opcoes.loop,
        deslocamentoS: Number.isFinite(pedido) && pedido > 0 ? pedido : 0,
        pedidoEmMs: agora(),
        volumeDoEfeito: volumeValido(opcoes.volumeDoEfeito),
        ganhoAplicado: 0,
        estado: 'carregando',
        avisouEspera: false,
        expira: null,
        tocador: null,
      }
      vozes.set(instancia, voz)
      // Os bytes vêm já, até antes do gesto; a falha volta para a voz quando ela for tocar.
      garantirBytes(id).catch(() => undefined)
      tentarIniciar(voz)
      return { aceito: true }
    },

    parar(instancia, fadeMs = FADE_AO_PARAR_MS) {
      const voz = vozes.get(instancia)
      if (voz === undefined) return
      encerrarVoz(voz, Number.isFinite(fadeMs) ? Math.max(0, fadeMs) : FADE_AO_PARAR_MS, 'parado')
    },

    pararTudo() {
      for (const voz of [...vozes.values()]) encerrarVoz(voz, FADE_AO_PARAR_MS, 'parado')
    },

    mudarVolume(instancia, volumeDoEfeito) {
      const voz = vozes.get(instancia)
      if (voz === undefined || !Number.isFinite(volumeDoEfeito)) return
      voz.volumeDoEfeito = volumeValido(volumeDoEfeito)
      aplicarGanho(voz)
    },

    precarregar(ids) {
      // A pré-carga nova troca a anterior (como no mestre); o que já desce segue.
      filaDaPreCarga = [...new Set(ids.filter((id) => ehIdDeAudio(id)))].slice(0, PRE_CARGA_MAX_ARQUIVOS)
      puxarPreCarga()
    },

    assinar(ouvinte) {
      ouvintes.add(ouvinte)
      return () => {
        ouvintes.delete(ouvinte)
      }
    },

    desmontar() {
      desmontado = true
      filaDaPreCarga = []
      for (const voz of [...vozes.values()]) encerrarVoz(voz, 0, 'parado')
      desligarPreferencia()
      desligarDestravar()
      desligarReposicao?.()
      for (const [id, entrada] of [...cache]) descartarDoCache(id, entrada)
      ouvintes.clear()
    },
  }
}

function ehCelular(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
}

/**
 * O motor do app, com o Web Audio, o `<audio>` e o volume do aparelho de
 * verdade. Cada lado passa quem traz os bytes: o mestre, o disco; o jogador e
 * a TV, a sala (`/sons/<id>`), com os `<audio>` da reserva destravada no toque.
 */
export function criarMotorAoVivoDoNavegador(carregarBytes: CarregadorDeBytes, { reservas, preferencia }: OpcoesDoMotorDoNavegador = {}): MotorAoVivo {
  return criarMotorAoVivo<AudioNode>({
    carregarBytes,
    obterSaida: obterSaidaAoVivoDoNavegador,
    aoDestravar: quandoOAudioRodar,
    lerPreferencia: preferencia?.lerPreferencia ?? (() => useSomStore.getState()),
    assinarPreferencia: preferencia?.assinarPreferencia ?? ((ouvinte) => useSomStore.subscribe(() => ouvinte())),
    // `createMediaElementSource` vale uma vez por elemento: o da reserva sai dela para sempre.
    criarElementoDeAudio: () => reservas?.tirar() ?? new Audio(),
    ...(reservas === undefined ? {} : { aoReporReservas: (ouvinte: () => void) => reservas.aoRepor(ouvinte) }),
    criarUrlDoAudio: (bytes, tipoMime) => URL.createObjectURL(new Blob([bytes], { type: tipoMime })),
    revogarUrl: (url) => URL.revokeObjectURL(url),
    agora: () => performance.now(),
    orcamentoDoCacheBytes: ehCelular() ? CACHE_NO_CELULAR_BYTES : CACHE_NO_COMPUTADOR_BYTES,
  })
}
