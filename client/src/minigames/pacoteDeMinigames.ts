import { Channel, invoke, isTauri } from '@tauri-apps/api/core'

/**
 * PACOTE DE MINIGAMES: o jogo Godot (o motor tem 38 MB) não vem no instalador.
 * Na primeira vez que o mestre abre o pino do jogo, o app baixa o pacote da
 * release "minigames" do GitHub, confere a assinatura e guarda em
 * `<appData>/minigames/<jogo>`; dali em diante abre sem internet, e o servidor
 * da sala serve os arquivos aos jogadores em `/minigames/<jogo>/`.
 *
 * Quem baixa, confere e serve é o Rust (`minigames_ler_indice` e
 * `minigames_atualizar`, molde de `net/animacoes.rs`); o pacote sai de
 * `scripts/pacote-minigames.cjs`. Aqui ficam o contrato com o Rust, conferido
 * em tempo de execução, e o estado que o painel do pino mostra (um por jogo,
 * fora do React: fechar e reabrir o painel no meio do download continua a
 * mesma barra).
 */

export type JogoDoPacote = 'fogo'

export const NOME_DO_JOGO_DO_PACOTE: Record<JogoDoPacote, string> = {
  fogo: 'Fogo na Floresta',
}

/** Único formato de índice que este app entende (o `FORMATO` do script). */
const FORMATO = 1

/** O índice instalado, só o que a tela usa. */
export interface IndiceDoMinigame {
  versao: number
  /** Soma dos arquivos (em gzip): o que se baixa. */
  tamanho: number
}

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function inteiroPositivo(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 1
}

function tamanhoValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

/** O texto do índice (já conferido pelo Rust) do `jogo`; `null` = fora da forma ou de outro jogo. */
export function lerIndiceDoMinigame(texto: string, jogo: JogoDoPacote): IndiceDoMinigame | null {
  let valor: unknown
  try {
    valor = JSON.parse(texto)
  } catch {
    return null
  }
  if (!objeto(valor) || valor.formato !== FORMATO || valor.jogo !== jogo || !inteiroPositivo(valor.versao) || !Array.isArray(valor.arquivos)) return null
  let tamanho = 0
  for (const arquivo of valor.arquivos) {
    if (!objeto(arquivo) || !tamanhoValido(arquivo.tamanho)) return null
    tamanho += arquivo.tamanho
  }
  return { versao: valor.versao, tamanho }
}

/** O `estado` de `minigames_atualizar` (o mesmo `Estado` do pacote de animações, em snake_case). */
export type EstadoDaAtualizacao = 'novo' | 'igual' | 'antigo' | 'app_velho' | 'sem_internet' | 'invalido'
const ESTADOS: readonly EstadoDaAtualizacao[] = ['novo', 'igual', 'antigo', 'app_velho', 'sem_internet', 'invalido']

export interface RespostaDaAtualizacao {
  estado: EstadoDaAtualizacao
  /** A versão instalada DEPOIS da chamada; `null` = nenhuma (falhou e não havia pacote). */
  versao: number | null
}

/** Confere em tempo de execução o que veio do Rust. */
export function lerRespostaDaAtualizacao(valor: unknown): RespostaDaAtualizacao | null {
  if (!objeto(valor)) return null
  const estado = ESTADOS.find((e) => e === valor.estado)
  if (estado === undefined) return null
  if (valor.versao !== null && !inteiroPositivo(valor.versao)) return null
  return { estado, versao: valor.versao }
}

/** Uma mensagem do canal de progresso: bytes baixados e o total do pacote. */
export interface ProgressoDoDownload {
  baixado: number
  total: number
}

export function lerProgresso(valor: unknown): ProgressoDoDownload | null {
  if (!objeto(valor) || !tamanhoValido(valor.baixado) || !tamanhoValido(valor.total) || valor.baixado > valor.total) return null
  return { baixado: valor.baixado, total: valor.total }
}

/** O mundo de fora; o teste troca por uma falsa. Os retornos são `unknown`: quem lê confere. */
export interface PortaDoPacoteDeMinigames {
  /** Só o app instalado baixa; no navegador (e no Vite) quem serve o jogo é o servidor de páginas. */
  disponivel(): boolean
  /** `invoke('minigames_ler_indice')`: o texto do índice instalado, ou `null`. */
  lerIndice(jogo: JogoDoPacote): Promise<unknown>
  /** `invoke('minigames_atualizar')`: baixa se houver versão nova; o progresso chega por `aoProgredir`. */
  atualizar(jogo: JogoDoPacote, aoProgredir: (valor: unknown) => void): Promise<unknown>
}

export const portaDoPacoteDeMinigamesNoApp: PortaDoPacoteDeMinigames = {
  disponivel: () => isTauri(),
  lerIndice: (jogo) => invoke('minigames_ler_indice', { jogo }),
  atualizar: (jogo, aoProgredir) => invoke('minigames_atualizar', { jogo, progresso: new Channel<unknown>(aoProgredir) }),
}

/** O Tauri rejeita assim o comando que o Rust não registrou (`webview/mod.rs`): app sem o lado do pacote. */
const COMANDO_AUSENTE = /^Command \S+ not found$/

function comandoAusente(erro: unknown): boolean {
  const texto = typeof erro === 'string' ? erro : erro instanceof Error ? erro.message : ''
  return COMANDO_AUSENTE.test(texto)
}

// ---------------------------------------------------------------------------
// Estado por jogo
// ---------------------------------------------------------------------------

export type MotivoDaFalha = 'sem_internet' | 'invalido' | 'app_velho' | 'disco'

export type FaseDoPacote =
  | { tipo: 'conferindo' }
  /** Fora do app: o servidor de páginas serve o jogo (o Vite em dev, `FOGO_WEB_DIR`). */
  | { tipo: 'dispensado' }
  /** `total` nulo = ainda sem resposta do GitHub. */
  | { tipo: 'baixando'; primeiraVez: boolean; baixado: number; total: number | null }
  | { tipo: 'pronto'; versao: number }
  /** O app não tem os comandos do pacote (versão sem o lado Rust). */
  | { tipo: 'sem_suporte' }
  | { tipo: 'falhou'; motivo: MotivoDaFalha }

const CONFERINDO: FaseDoPacote = { tipo: 'conferindo' }
const DISPENSADO: FaseDoPacote = { tipo: 'dispensado' }
const SEM_SUPORTE: FaseDoPacote = { tipo: 'sem_suporte' }

interface RegistroDoJogo {
  fase: FaseDoPacote
  ouvintes: Set<() => void>
  emAndamento: Promise<void> | null
  /** Já perguntou ao GitHub por versão nova neste processo (uma vez basta, como as animações). */
  procurou: boolean
}

const registros = new Map<JogoDoPacote, RegistroDoJogo>()

function registro(jogo: JogoDoPacote): RegistroDoJogo {
  const existente = registros.get(jogo)
  if (existente !== undefined) return existente
  const novo: RegistroDoJogo = { fase: CONFERINDO, ouvintes: new Set(), emAndamento: null, procurou: false }
  registros.set(jogo, novo)
  return novo
}

function mudar(jogo: JogoDoPacote, fase: FaseDoPacote): void {
  const r = registro(jogo)
  r.fase = fase
  for (const ouvinte of r.ouvintes) ouvinte()
}

/** A fase de agora (o mesmo objeto até mudar: serve de snapshot do `useSyncExternalStore`). */
export function faseDoPacote(jogo: JogoDoPacote): FaseDoPacote {
  return registro(jogo).fase
}

export function ouvirPacote(jogo: JogoDoPacote, ouvinte: () => void): () => void {
  const { ouvintes } = registro(jogo)
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

function motivoDoEstado(estado: EstadoDaAtualizacao): MotivoDaFalha {
  if (estado === 'sem_internet' || estado === 'app_velho') return estado
  // 'novo', 'igual' ou 'antigo' sem nada instalado depois não deveria acontecer: trata como pacote torto.
  return 'invalido'
}

/** O índice instalado, `null` se não há; lança o erro do Rust. */
async function versaoInstalada(jogo: JogoDoPacote, porta: PortaDoPacoteDeMinigames): Promise<number | null> {
  const texto = await porta.lerIndice(jogo)
  if (typeof texto !== 'string') return null
  return lerIndiceDoMinigame(texto, jogo)?.versao ?? null
}

/**
 * Pergunta ao GitHub. Sem pacote, a barra aparece já; com pacote, o painel
 * só sai do "pronto" se vier arquivo de verdade (versão nova), e qualquer
 * falha deixa o instalado em uso, em silêncio: é o "funciona sem internet".
 */
async function atualizar(jogo: JogoDoPacote, porta: PortaDoPacoteDeMinigames, instalada: number | null): Promise<void> {
  const primeiraVez = instalada === null
  const voltar = (falha: FaseDoPacote) => mudar(jogo, instalada === null ? falha : { tipo: 'pronto', versao: instalada })
  if (primeiraVez) mudar(jogo, { tipo: 'baixando', primeiraVez, baixado: 0, total: null })
  let bruto: unknown
  try {
    bruto = await porta.atualizar(jogo, (valor) => {
      const progresso = lerProgresso(valor)
      if (progresso !== null) mudar(jogo, { tipo: 'baixando', primeiraVez, ...progresso })
    })
  } catch (erro) {
    console.warn(`minigames: o download de ${jogo} falhou`, erro)
    voltar(comandoAusente(erro) ? SEM_SUPORTE : { tipo: 'falhou', motivo: 'disco' })
    return
  }
  const resposta = lerRespostaDaAtualizacao(bruto)
  if (resposta === null) {
    console.warn(`minigames: resposta do download de ${jogo} fora da forma`)
    voltar({ tipo: 'falhou', motivo: 'invalido' })
    return
  }
  if (resposta.versao !== null) mudar(jogo, { tipo: 'pronto', versao: resposta.versao })
  else voltar({ tipo: 'falhou', motivo: motivoDoEstado(resposta.estado) })
}

async function preparar(jogo: JogoDoPacote, porta: PortaDoPacoteDeMinigames, ocupado: boolean): Promise<void> {
  if (!porta.disponivel()) {
    mudar(jogo, DISPENSADO)
    return
  }
  const r = registro(jogo)
  let instalada = r.fase.tipo === 'pronto' ? r.fase.versao : null
  if (instalada === null) {
    if (r.fase.tipo !== 'conferindo') mudar(jogo, CONFERINDO)
    try {
      instalada = await versaoInstalada(jogo, porta)
    } catch (erro) {
      console.warn(`minigames: não deu para ler o pacote de ${jogo}`, erro)
      mudar(jogo, comandoAusente(erro) ? SEM_SUPORTE : { tipo: 'falhou', motivo: 'disco' })
      return
    }
    if (instalada !== null) mudar(jogo, { tipo: 'pronto', versao: instalada })
  }
  // Com partida aberta não troca o jogo: um jogador poderia carregar metade de cada versão.
  if (instalada !== null && (r.procurou || ocupado)) return
  r.procurou = true
  await atualizar(jogo, porta, instalada)
}

export interface OpcoesDoPreparo {
  porta?: PortaDoPacoteDeMinigames
  /** Há partida deste jogo aberta (convite, jogo ou pausa). */
  ocupado?: boolean
}

/**
 * Deixa o jogo pronto para a sala servir: lê o pacote instalado e, na
 * primeira vez, baixa; com pacote, procura versão nova uma vez por processo.
 * Quem chama no meio pega o mesmo andamento. Nunca rejeita: o resultado é a fase.
 */
export function prepararMinigame(jogo: JogoDoPacote, opcoes: OpcoesDoPreparo = {}): Promise<void> {
  const { porta = portaDoPacoteDeMinigamesNoApp, ocupado = false } = opcoes
  const r = registro(jogo)
  if (r.emAndamento !== null) return r.emAndamento
  if (r.fase.tipo === 'dispensado' || r.fase.tipo === 'sem_suporte') return Promise.resolve()
  if (r.fase.tipo === 'pronto' && (r.procurou || ocupado)) return Promise.resolve()
  const promessa = preparar(jogo, porta, ocupado)
    .catch((erro: unknown) => {
      console.warn(`minigames: o preparo de ${jogo} parou`, erro)
      mudar(jogo, { tipo: 'falhou', motivo: 'disco' })
    })
    .finally(() => {
      r.emAndamento = null
    })
  r.emAndamento = promessa
  return promessa
}

/** Só para teste: volta ao estado de app recém-aberto. */
export function esquecerPacotesDeMinigames(): void {
  registros.clear()
}
