import { invoke, isTauri } from '@tauri-apps/api/core'
import { CENARIO_DURACAO_MAX_S, CENARIO_DURACAO_MIN_S } from '../cenario/catalogo'
import { esquecerEstilosDeCenarioDeFora, IDS_DE_ESTILO_RESERVADOS, registrarEstiloDeCenario } from '../cenario/estilosDeCenario'
import { ANIMACOES_EMBUTIDAS, DURACAO_DE_ANIMACAO_MAX_MS, esquecerAnimacoesDePortaDeFora, registrarAnimacaoDePorta } from '../portas/animacoesDePorta'
import { esquecerTransicoesDeFora, isDuracaoValida, isTransicaoEmbutida, marcarCarregamentoDeFora, registrarTransicao } from '../transicoes/catalogo'
import { ESCALA_MAX, ESCALA_MIN, esquecerTexturasDeFora, IDS_DAS_EMBUTIDAS as IDS_DAS_TEXTURAS, registrarTexturaDoPacote } from '../texturas/catalogo'
import { ehSombraDeCarimbo, esquecerCarimbosDeFora, IDS_DOS_EMBUTIDOS as IDS_DOS_CARIMBOS, registrarCarimboDoPacote, TAMANHO_NATURAL_MAX, TAMANHO_NATURAL_MIN } from '../carimbos/catalogo'
import type { SombraDoCarimbo } from '../carimbos/embutidos'

/**
 * PACOTE DE ANIMAÇÕES (Fase B, lado TS) — animação nova chega pelo GitHub sem
 * instalador novo. O Rust (`desktop/src-tauri/src/net/animacoes.rs`) baixa,
 * confere a assinatura do índice e o sha256 de cada módulo e guarda em
 * `<appData>/animacoes`; daqui para a frente é com este arquivo:
 *
 * - LER o `indice.json` (o Rust só valida o que ele usa; `animacoes` é nosso);
 * - IMPORTAR cada módulo (ES module, `export default` = a função do tipo);
 * - REGISTRAR nos quatro registros: transições (`transicoes/catalogo.ts`), porta
 *   (`portas/animacoesDePorta.ts`), cenário (`cenario/estilosDeCenario.ts`) e
 *   textura (`texturas/catalogo.ts`: a textura nova da ferramenta Texturas
 *   chega pelo mesmo pacote, sem instalador) e carimbo (`carimbos/catalogo.ts`:
 *   o objeto novo da ferramenta Carimbos, idem).
 *
 * Duas origens: o MESTRE (app Tauri) lê os bytes conferidos pelo Rust e
 * importa de um Blob; o JOGADOR (navegador pela LAN ou túnel) pede ao
 * servidor do mestre (`/animacoes/...`), que só entrega o que o índice
 * assinado lista. Animação quebrada fica de fora sozinha: as outras entram.
 */

/** Id de animação do pacote: a mesma forma dos três registros. */
export const ID_DE_ANIMACAO_DO_PACOTE = /^[a-z0-9-]{1,40}$/
/** O mesmo teto de nome dos três registros (o seletor quebra com nome longo). */
export const NOME_DE_ANIMACAO_DO_PACOTE_MAX = 60
/** Único formato de índice que este app entende (o Rust confere o mesmo). */
const FORMATO_DO_INDICE = 1

export type TipoDeAnimacao = 'transicao' | 'porta' | 'cenario' | 'textura' | 'carimbo'

interface EntradaComum {
  id: string
  nome: string
  /** Nome do módulo, um dos `arquivos` do índice. */
  arquivo: string
}

/** Uma animação de `indice.animacoes`, já conferida. */
export type EntradaDoPacote =
  | (EntradaComum & { tipo: 'transicao'; duracaoNaturalS: number; quadroDaMiniaturaS: number })
  | (EntradaComum & { tipo: 'porta'; duracaoMs: number })
  | (EntradaComum & { tipo: 'cenario'; duracaoNaturalS: number; quadroDaMiniaturaS?: number })
  /** Textura: `escala` = lado do ladrilho no mapa, em px do protótipo do relevo (`texturas/embutidas.ts`). */
  | (EntradaComum & { tipo: 'textura'; escala: number })
  /** Carimbo: `tamanho` natural em px do protótipo do relevo e o jeito da sombra (`carimbos/embutidos.ts`). */
  | (EntradaComum & { tipo: 'carimbo'; tamanho: number; sombra: SombraDoCarimbo })

export interface IndiceDoPacote {
  versao: number
  animacoes: readonly EntradaDoPacote[]
}

/** A entrada boa, ou o motivo curto (vai ao console) de ela ficar de fora. */
export type LeituraDeEntrada = { entrada: EntradaDoPacote } | { motivo: string }

function numeroFinito(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

function idEmbutido(tipo: TipoDeAnimacao, id: string): boolean {
  if (tipo === 'transicao') return isTransicaoEmbutida(id)
  if (tipo === 'porta') return ANIMACOES_EMBUTIDAS.some((animacao) => animacao.id === id)
  if (tipo === 'textura') return IDS_DAS_TEXTURAS.includes(id)
  if (tipo === 'carimbo') return IDS_DOS_CARIMBOS.includes(id)
  return IDS_DE_ESTILO_RESERVADOS.includes(id)
}

function lerTipo(valor: unknown): TipoDeAnimacao | null {
  return valor === 'transicao' || valor === 'porta' || valor === 'cenario' || valor === 'textura' || valor === 'carimbo' ? valor : null
}

/**
 * Confere UMA entrada de `indice.animacoes`. Id de embutida fica de fora: a
 * embutida ganha (funciona sem internet e não muda por download).
 */
export function lerEntradaDoPacote(valor: unknown, arquivos: ReadonlySet<string>): LeituraDeEntrada {
  if (typeof valor !== 'object' || valor === null) return { motivo: 'entrada não é objeto' }
  if (!('id' in valor) || typeof valor.id !== 'string' || !ID_DE_ANIMACAO_DO_PACOTE.test(valor.id)) return { motivo: 'id' }
  const id = valor.id
  const tipo = 'tipo' in valor ? lerTipo(valor.tipo) : null
  if (tipo === null) return { motivo: `${id}: tipo` }
  if (idEmbutido(tipo, id)) return { motivo: `${id}: id de animação embutida` }
  if (!('nome' in valor) || typeof valor.nome !== 'string') return { motivo: `${id}: nome` }
  const nome = valor.nome.trim()
  if (nome === '' || nome.length > NOME_DE_ANIMACAO_DO_PACOTE_MAX) return { motivo: `${id}: nome` }
  if (!('arquivo' in valor) || typeof valor.arquivo !== 'string' || !arquivos.has(valor.arquivo)) return { motivo: `${id}: arquivo fora do índice` }
  const comum: EntradaComum = { id, nome, arquivo: valor.arquivo }

  if (tipo === 'porta') {
    const duracaoMs = 'duracaoMs' in valor ? valor.duracaoMs : undefined
    if (!numeroFinito(duracaoMs) || duracaoMs <= 0 || duracaoMs > DURACAO_DE_ANIMACAO_MAX_MS) return { motivo: `${id}: duracaoMs` }
    return { entrada: { ...comum, tipo, duracaoMs } }
  }

  if (tipo === 'textura') {
    const escala = 'escala' in valor ? valor.escala : undefined
    if (!numeroFinito(escala) || escala < ESCALA_MIN || escala > ESCALA_MAX) return { motivo: `${id}: escala` }
    return { entrada: { ...comum, tipo, escala } }
  }

  if (tipo === 'carimbo') {
    const tamanho = 'tamanho' in valor ? valor.tamanho : undefined
    if (!numeroFinito(tamanho) || tamanho < TAMANHO_NATURAL_MIN || tamanho > TAMANHO_NATURAL_MAX) return { motivo: `${id}: tamanho` }
    const sombra = 'sombra' in valor ? valor.sombra : undefined
    if (!ehSombraDeCarimbo(sombra)) return { motivo: `${id}: sombra` }
    return { entrada: { ...comum, tipo, tamanho, sombra } }
  }

  const duracaoNaturalS = 'duracaoNaturalS' in valor ? valor.duracaoNaturalS : undefined
  const quadro = 'quadroDaMiniaturaS' in valor ? valor.quadroDaMiniaturaS : undefined
  if (tipo === 'transicao') {
    if (!isDuracaoValida(duracaoNaturalS)) return { motivo: `${id}: duracaoNaturalS` }
    if (!numeroFinito(quadro) || quadro < 0 || quadro > duracaoNaturalS) return { motivo: `${id}: quadroDaMiniaturaS` }
    return { entrada: { ...comum, tipo, duracaoNaturalS, quadroDaMiniaturaS: quadro } }
  }

  if (!numeroFinito(duracaoNaturalS) || duracaoNaturalS < CENARIO_DURACAO_MIN_S || duracaoNaturalS > CENARIO_DURACAO_MAX_S) return { motivo: `${id}: duracaoNaturalS` }
  // A miniatura do cenário é opcional e só um palpite: fora da animação, some e a entrada fica.
  const quadroValido = numeroFinito(quadro) && quadro >= 0 && quadro <= duracaoNaturalS
  return { entrada: quadroValido ? { ...comum, tipo, duracaoNaturalS, quadroDaMiniaturaS: quadro } : { ...comum, tipo, duracaoNaturalS } }
}

/** Os nomes de `indice.arquivos`; o Rust já conferiu forma, sha256 e tamanho. */
function nomesDosArquivos(valor: unknown): Set<string> | null {
  if (!Array.isArray(valor)) return null
  const nomes = new Set<string>()
  for (const arquivo of valor) {
    if (typeof arquivo !== 'object' || arquivo === null || !('nome' in arquivo) || typeof arquivo.nome !== 'string') return null
    nomes.add(arquivo.nome)
  }
  return nomes
}

/**
 * Lê o `indice.json`. `null` = índice inteiro sem serventia (não é JSON,
 * formato que este app não entende). Entrada ruim só sai ela, com o motivo
 * no console; a mesma animação (tipo + id) duas vezes vale a primeira.
 */
export function lerIndiceDoPacote(texto: string): IndiceDoPacote | null {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return null
  }
  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) return null
  if (!('formato' in bruto) || bruto.formato !== FORMATO_DO_INDICE) return null
  if (!('versao' in bruto) || !Number.isSafeInteger(bruto.versao) || !numeroFinito(bruto.versao) || bruto.versao < 1) return null
  const versao = bruto.versao
  const arquivos = 'arquivos' in bruto ? nomesDosArquivos(bruto.arquivos) : null
  if (arquivos === null) return null
  const lista = 'animacoes' in bruto && Array.isArray(bruto.animacoes) ? bruto.animacoes : []
  const animacoes: EntradaDoPacote[] = []
  const vistas = new Set<string>()
  for (const valor of lista) {
    const leitura = lerEntradaDoPacote(valor, arquivos)
    if ('motivo' in leitura) {
      console.warn(`animações: entrada do pacote fora (${leitura.motivo})`)
      continue
    }
    const chave = chaveDaEntrada(leitura.entrada)
    if (vistas.has(chave)) {
      console.warn(`animações: ${chave} repetida no pacote; vale a primeira`)
      continue
    }
    vistas.add(chave)
    animacoes.push(leitura.entrada)
  }
  return { versao, animacoes }
}

/** Identidade de uma animação entre pacotes: o mesmo id pode existir em tipos diferentes. */
export function chaveDaEntrada(entrada: Pick<EntradaDoPacote, 'tipo' | 'id'>): string {
  return `${entrada.tipo}:${entrada.id}`
}

// ---------------------------------------------------------------------------
// Origens: de onde vêm o índice e os módulos
// ---------------------------------------------------------------------------

export interface OrigemDoPacote {
  /** O texto do índice; `null` = não há pacote. Lança = não deu para ler agora. */
  lerIndice(): Promise<string | null>
  /** O módulo (o namespace do `import()`). `versao` serve para não reaproveitar módulo velho em cache. */
  importar(arquivo: string, versao: number): Promise<unknown>
}

type Invocar = (comando: string, args?: Record<string, unknown>) => Promise<unknown>
type ImportarUrl = (url: string) => Promise<unknown>

/**
 * O `import()` de verdade. `@vite-ignore`: a URL só existe em tempo de
 * execução (Blob ou rota do servidor), e o Vite não deve tentar resolvê-la.
 */
const importarDeVerdade: ImportarUrl = (url) => import(/* @vite-ignore */ url)

/** O módulo como bytes de JavaScript: o comando devolve `ArrayBuffer` (corpo cru do IPC). */
function bytesDoModulo(valor: unknown, arquivo: string): ArrayBuffer | Uint8Array {
  if (valor instanceof ArrayBuffer) return valor
  if (valor instanceof Uint8Array) return valor
  throw new Error(`animações: ${arquivo} não veio como bytes`)
}

export interface DependenciasDoMestre {
  invocar?: Invocar
  importarUrl?: ImportarUrl
  criarUrl?: (blob: Blob) => string
  revogarUrl?: (url: string) => void
}

/**
 * MESTRE (Tauri): o Rust reconfere a assinatura do índice e o sha256 de cada
 * módulo a cada leitura. O módulo vira Blob para o `import()`; a URL é
 * revogada assim que o import termina (o módulo já está na memória).
 */
export function criarOrigemDoMestre(dependencias: DependenciasDoMestre = {}): OrigemDoPacote {
  const invocar: Invocar = dependencias.invocar ?? ((comando, args) => invoke(comando, args))
  const importarUrl = dependencias.importarUrl ?? importarDeVerdade
  const criarUrl = dependencias.criarUrl ?? ((blob: Blob) => URL.createObjectURL(blob))
  const revogarUrl = dependencias.revogarUrl ?? ((url: string) => URL.revokeObjectURL(url))
  return {
    async lerIndice() {
      const texto = await invocar('animacoes_ler_indice')
      return typeof texto === 'string' ? texto : null
    },
    async importar(arquivo) {
      const bytes = bytesDoModulo(await invocar('animacoes_ler_arquivo', { nome: arquivo }), arquivo)
      const url = criarUrl(new Blob([bytes], { type: 'text/javascript' }))
      try {
        return await importarUrl(url)
      } finally {
        revogarUrl(url)
      }
    },
  }
}

type Buscar = (url: string, init?: RequestInit) => Promise<Response>

export interface DependenciasDoJogador {
  buscar?: Buscar
  importarUrl?: ImportarUrl
  /** Onde o servidor da sala serve o pacote. */
  base?: string
}

/** Rota do servidor da sala (`net/server.rs`): só entrega o que o índice assinado lista. */
export const ROTA_DAS_ANIMACOES = '/animacoes/'

/**
 * JOGADOR (navegador pela LAN ou pelo túnel): a mesma origem da página do
 * jogador. 404 no índice = o mestre não tem pacote, em silêncio. O `?v=` no
 * módulo faz o navegador pedir de novo quando o pacote muda de versão.
 */
export function criarOrigemDoJogador(dependencias: DependenciasDoJogador = {}): OrigemDoPacote {
  const buscar: Buscar = dependencias.buscar ?? ((url, init) => fetch(url, init))
  const importarUrl = dependencias.importarUrl ?? importarDeVerdade
  const base = dependencias.base ?? ROTA_DAS_ANIMACOES
  return {
    async lerIndice() {
      const resposta = await buscar(`${base}indice.json`, { cache: 'no-store' })
      if (resposta.status === 404) return null
      if (!resposta.ok) throw new Error(`animações: o mestre respondeu ${resposta.status}`)
      // Só o servidor da sala responde JSON aqui; um servidor de páginas que
      // devolve o HTML do app para qualquer caminho (o Vite de dev) = sem pacote.
      if (!(resposta.headers.get('content-type') ?? '').includes('application/json')) return null
      return resposta.text()
    },
    importar(arquivo, versao) {
      return importarUrl(`${base}${encodeURIComponent(arquivo)}?v=${versao}`)
    },
  }
}

export const origemDoMestre: OrigemDoPacote = criarOrigemDoMestre()
export const origemDoJogador: OrigemDoPacote = criarOrigemDoJogador()

// ---------------------------------------------------------------------------
// Carregar e registrar
// ---------------------------------------------------------------------------

export interface ResultadoDoCarregamento {
  /** Versão do pacote registrado; `null` = nenhum. */
  versao: number | null
  /** As animações que entraram nos registros, na ordem do índice. */
  registradas: readonly EntradaDoPacote[]
  /** Não deu para ler o índice (rede, disco): os registros ficaram como estavam. */
  falhouAoLer: boolean
}

const NADA_CARREGADO: ResultadoDoCarregamento = { versao: null, registradas: [], falhouAoLer: false }

let ultimoCarregamento: ResultadoDoCarregamento = NADA_CARREGADO
let carregamentoEmAndamento: Promise<ResultadoDoCarregamento> | null = null
/** Cada carregamento pega um número; só o mais novo mexe nos registros. */
let geracao = 0

/** O `export default` do módulo, ou `undefined`. */
function exportPadrao(modulo: unknown): unknown {
  if (typeof modulo !== 'object' || modulo === null || !('default' in modulo)) return undefined
  return modulo.default
}

/** Entrega a função do módulo ao registro do tipo, que confere a forma e recusa o que não serve. */
function registrarEntrada(entrada: EntradaDoPacote, modulo: unknown): boolean {
  const funcao = exportPadrao(modulo)
  if (typeof funcao !== 'function') return false
  const { id, nome } = entrada
  switch (entrada.tipo) {
    case 'transicao':
      return registrarTransicao({ id, nome, duracaoNaturalS: entrada.duracaoNaturalS, quadroDaMiniaturaS: entrada.quadroDaMiniaturaS, criar: funcao })
    case 'porta':
      return registrarAnimacaoDePorta({ id, nome, duracaoMs: entrada.duracaoMs, desenhar: funcao })
    case 'cenario': {
      const quadro = entrada.quadroDaMiniaturaS === undefined ? {} : { quadroDaMiniaturaS: entrada.quadroDaMiniaturaS }
      return registrarEstiloDeCenario({ id, nome, duracaoNaturalS: entrada.duracaoNaturalS, ...quadro, criar: funcao })
    }
    case 'textura':
      return registrarTexturaDoPacote({ id, nome, escala: entrada.escala, cor: funcao })
    case 'carimbo':
      return registrarCarimboDoPacote({ id, nome, tamanho: entrada.tamanho, sombra: entrada.sombra, desenhar: funcao })
  }
}

function esquecerTodasDeFora(): void {
  esquecerTransicoesDeFora()
  esquecerAnimacoesDePortaDeFora()
  esquecerEstilosDeCenarioDeFora()
  esquecerTexturasDeFora()
  esquecerCarimbosDeFora()
}

interface ModuloImportado {
  entrada: EntradaDoPacote
  modulo: unknown
}

/**
 * TODOS os módulos antes de mexer nos registros: a porta precisa do desenho
 * síncrono, e a galeria aberta troca de uma vez, sem piscar vazia. O que
 * falha ao importar vira `null` e fica de fora sozinho.
 */
function importarTodos(origem: OrigemDoPacote, indice: IndiceDoPacote): Promise<Array<ModuloImportado | null>> {
  return Promise.all(
    indice.animacoes.map(async (entrada) => {
      try {
        return { entrada, modulo: await origem.importar(entrada.arquivo, indice.versao) }
      } catch (erro) {
        console.warn(`animações: ${chaveDaEntrada(entrada)} não carregou`, erro)
        return null
      }
    }),
  )
}

async function carregar(origem: OrigemDoPacote, textoDoIndice: string | null | undefined, minha: number): Promise<ResultadoDoCarregamento> {
  let texto: string | null
  try {
    texto = textoDoIndice !== undefined ? textoDoIndice : await origem.lerIndice()
  } catch (erro) {
    console.warn('animações: não deu para ler o índice do pacote', erro)
    return { ...ultimoCarregamento, falhouAoLer: true }
  }
  const indice = texto === null ? null : lerIndiceDoPacote(texto)
  if (texto !== null && indice === null) console.warn('animações: índice do pacote ilegível; fica sem animações de fora')
  const importados = indice === null ? [] : await importarTodos(origem, indice)
  // Outro carregamento começou enquanto este importava: o mais novo manda.
  if (minha !== geracao) return carregamentoEmAndamento ?? ultimoCarregamento
  esquecerTodasDeFora()
  const registradas: EntradaDoPacote[] = []
  for (const item of importados) {
    if (item === null) continue
    if (registrarEntrada(item.entrada, item.modulo)) registradas.push(item.entrada)
    else console.warn(`animações: ${chaveDaEntrada(item.entrada)} não tem a forma do contrato`)
  }
  ultimoCarregamento = { versao: indice === null ? null : indice.versao, registradas, falhouAoLer: false }
  return ultimoCarregamento
}

/**
 * Lê o pacote da `origem` e troca as animações de fora dos três registros
 * pelas dele. `textoDoIndice` pula a leitura (o `animacoes_atualizar` já
 * devolveu o índice novo). Nunca rejeita: falha vira console e o que dá.
 */
export function carregarPacoteDeAnimacoes(origem: OrigemDoPacote, textoDoIndice?: string | null): Promise<ResultadoDoCarregamento> {
  geracao += 1
  const promessa = carregar(origem, textoDoIndice, geracao)
  carregamentoEmAndamento = promessa
  // A transição pedida no meio do carregamento espera por ele (`transicoes/motor.ts`).
  marcarCarregamentoDeFora(promessa)
  void promessa.then(() => {
    if (carregamentoEmAndamento === promessa) carregamentoEmAndamento = null
  })
  return promessa
}

/** O último carregamento terminado (esperando o que estiver em andamento). */
export function carregamentoAtual(): Promise<ResultadoDoCarregamento> {
  return carregamentoEmAndamento ?? Promise.resolve(ultimoCarregamento)
}

/** Só para teste: volta ao estado de app recém-aberto. */
export function esquecerPacoteCarregado(): void {
  geracao += 1
  carregamentoEmAndamento = null
  ultimoCarregamento = NADA_CARREGADO
  esquecerTodasDeFora()
}

let carregadoNaPagina: Promise<ResultadoDoCarregamento> | null = null

/**
 * Carrega o pacote uma vez por página: no app (mestre e janela da Visão de
 * jogador, que também é Tauri) pelo Rust; no navegador do jogador, pelo
 * servidor da sala. Falha de leitura deixa tentar de novo na próxima chamada
 * (o jogador reconectou).
 */
export function carregarPacoteDaPagina(): Promise<ResultadoDoCarregamento> {
  if (carregadoNaPagina !== null) return carregadoNaPagina
  const promessa = carregarPacoteDeAnimacoes(isTauri() ? origemDoMestre : origemDoJogador)
  carregadoNaPagina = promessa
  void promessa.then((resultado) => {
    if (resultado.falhouAoLer && carregadoNaPagina === promessa) carregadoNaPagina = null
  })
  return promessa
}

// ---------------------------------------------------------------------------
// Procurar pacote novo (só o mestre, no app)
// ---------------------------------------------------------------------------

/** O `estado` de `animacoes_atualizar` (Rust, `Estado` em snake_case). */
export type EstadoDoAtualizador = 'novo' | 'igual' | 'antigo' | 'app_velho' | 'sem_internet' | 'invalido'
const ESTADOS: readonly EstadoDoAtualizador[] = ['novo', 'igual', 'antigo', 'app_velho', 'sem_internet', 'invalido']

export interface RespostaDoAtualizador {
  estado: EstadoDoAtualizador
  /** Versão e índice do pacote instalado DEPOIS da chamada. */
  versao: number | null
  indice: string | null
}

function lerEstado(valor: unknown): EstadoDoAtualizador | null {
  return ESTADOS.find((estado) => estado === valor) ?? null
}

/** Confere em tempo de execução o que veio do Rust. */
export function lerRespostaDoAtualizador(valor: unknown): RespostaDoAtualizador | null {
  if (typeof valor !== 'object' || valor === null) return null
  const estado = 'estado' in valor ? lerEstado(valor.estado) : null
  if (estado === null) return null
  const versao = 'versao' in valor && numeroFinito(valor.versao) ? valor.versao : null
  const indice = 'indice' in valor && typeof valor.indice === 'string' ? valor.indice : null
  return { estado, versao, indice }
}

/** Tudo o que a procura precisa do mundo de fora; o teste troca por uma falsa. */
export interface PortaDoPacote {
  /** Fora do app (navegador, testes) não há o que procurar. */
  disponivel(): boolean
  /** `invoke('animacoes_atualizar')`: só rejeita por falha de disco local. */
  atualizar(): Promise<unknown>
  origem: OrigemDoPacote
}

export const portaDoPacoteNoApp: PortaDoPacote = {
  disponivel: () => isTauri(),
  atualizar: () => invoke('animacoes_atualizar'),
  origem: origemDoMestre,
}

/** `falhou` = o Rust rejeitou (disco) ou respondeu fora da forma. */
export interface ResultadoDaProcura {
  estado: EstadoDoAtualizador | 'falhou'
  /** Nomes das animações que não existiam antes deste pacote. */
  novas: readonly string[]
}

/** Nomes das animações de `depois` que não estavam em `antes` (por tipo + id). */
export function nomesNovos(antes: ReadonlySet<string>, depois: readonly EntradaDoPacote[]): string[] {
  return depois.filter((entrada) => !antes.has(chaveDaEntrada(entrada))).map((entrada) => entrada.nome)
}

async function procurar(porta: PortaDoPacote): Promise<ResultadoDaProcura> {
  // O que já existia: espera o carregamento da abertura, senão tudo pareceria novo.
  const antes = new Set((await carregamentoAtual()).registradas.map(chaveDaEntrada))
  let resposta: RespostaDoAtualizador | null
  try {
    resposta = lerRespostaDoAtualizador(await porta.atualizar())
  } catch (erro) {
    console.warn('animações: a procura falhou', erro)
    return { estado: 'falhou', novas: [] }
  }
  if (resposta === null) {
    console.warn('animações: resposta da procura fora da forma')
    return { estado: 'falhou', novas: [] }
  }
  if (resposta.estado !== 'novo') {
    console.info(`animações: procura terminou em "${resposta.estado}" (pacote instalado: ${resposta.versao ?? 'nenhum'})`)
    return { estado: resposta.estado, novas: [] }
  }
  const carregado = await carregarPacoteDeAnimacoes(porta.origem, resposta.indice)
  return { estado: 'novo', novas: nomesNovos(antes, carregado.registradas) }
}

let procuraEmAndamento: Promise<ResultadoDaProcura> | null = null

/**
 * Pergunta ao Rust por pacote novo e, havendo, recarrega os registros. A
 * abertura, o botão da tela inicial e os das galerias podem coincidir: quem
 * chega no meio pega a mesma procura.
 */
export function procurarAnimacoesNovas(porta: PortaDoPacote = portaDoPacoteNoApp): Promise<ResultadoDaProcura> {
  if (procuraEmAndamento !== null) return procuraEmAndamento
  const promessa = procurar(porta)
  procuraEmAndamento = promessa
  void promessa.then(() => {
    procuraEmAndamento = null
  })
  return promessa
}

export const TEXTO_ANIMACOES_EM_DIA = 'Animações em dia'
export const TEXTO_ANIMACOES_ATUALIZADAS = 'Animações atualizadas'
export const TEXTO_ANIMACOES_PEDEM_APP_NOVO = 'Há animações novas, mas elas pedem a versão nova do app'
export const TEXTO_ANIMACOES_SEM_PROCURA = 'Não deu para procurar animações agora'

/**
 * A frase para a pessoa. Na ABERTURA só "Animações novas: ..." aparece (quem
 * não pediu não quer saber de "em dia" nem de erro); no BOTÃO, sempre há uma
 * resposta.
 */
export function textoDaProcura(resultado: ResultadoDaProcura, origem: 'abertura' | 'botao'): string | null {
  const pediu = origem === 'botao'
  switch (resultado.estado) {
    case 'novo':
      if (resultado.novas.length > 0) return `Animações novas: ${resultado.novas.join(', ')}`
      return pediu ? TEXTO_ANIMACOES_ATUALIZADAS : null
    case 'igual':
    case 'antigo':
      return pediu ? TEXTO_ANIMACOES_EM_DIA : null
    case 'app_velho':
      return pediu ? TEXTO_ANIMACOES_PEDEM_APP_NOVO : null
    case 'sem_internet':
    case 'invalido':
    case 'falhou':
      return pediu ? TEXTO_ANIMACOES_SEM_PROCURA : null
  }
}

/** A procura da abertura roda uma vez por processo, como a do atualizador (`lib/atualizacao.ts`). */
export interface MemoriaDaProcuraDeAnimacoes {
  jaProcurou: boolean
}

export const memoriaDaProcuraDeAnimacoes: MemoriaDaProcuraDeAnimacoes = { jaProcurou: false }
