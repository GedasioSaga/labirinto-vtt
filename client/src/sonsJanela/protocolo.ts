import { SESSAO_VALIDA } from '../batalhaJanela/protocolo'
import { ehIdDeAudio, MIDIA_AUDIO_MAX_BYTES } from '../lib/midia'
import type { EventoDoMotor, MotivoDaRecusa, MotivoDoFim } from '../lib/sons/aoVivo/motor'
import {
  bibliotecaDoTexto,
  ehAtalhoDeSom,
  fonteDoSomLida,
  PARTES_DOS_SONS,
  type AtalhoDeSom,
  type BibliotecaDeSons,
  type EfeitoNovo,
  type FonteDoSom,
  type MudancaNoEfeito,
  type ParteDosSons,
  type TrechoDoSom,
} from '../lib/sons/biblioteca'

/**
 * O FIO entre a janela principal (o APP, que toca) e a janela dos sons, pelo
 * `BroadcastChannel` de nome secreto (a sessão; o molde da mesa da batalha,
 * `batalhaJanela/protocolo.ts`). Toda mensagem leva a sessão e o lado de quem
 * manda; o app só aplica o pedido que passa por `lerMensagemDaJanela`: nada de
 * campo a mais, texto comprido ou ação fora da lista. A biblioteca anda como
 * texto do `sons.json` e a janela a relê pela mesma porta do disco
 * (`bibliotecaDoTexto`).
 */

export { SESSAO_VALIDA }

/** A página da janela dos sons (`client/sons.html`). */
export const PAGINA_DA_JANELA = '/sons.html'

/** O nome do canal desta sessão. */
export function nomeDoCanal(sessao: string): string {
  return `labirinto-sons-${sessao}`
}

/** Ids, instâncias e nomes que andam no fio: os da biblioteca são curtos (`som_<uuid>`, `pastasom_<uuid>`). */
const TEXTO_MAX = 200
/** O nome do arquivo escolhido para importar (o do Windows vai até 255). */
const NOME_DE_ARQUIVO_MAX = 255

/** Uma mudança na biblioteca feita na janela, com o id que ela já mostra (o app aplica com o mesmo). */
export type MudancaNaBiblioteca =
  | { acao: 'adicionarEfeito'; novo: EfeitoNovo; id: string }
  | { acao: 'editarEfeito'; id: string; mudanca: MudancaNoEfeito }
  | { acao: 'apagarEfeito'; id: string }
  | { acao: 'criarPasta'; nome: string; parte: ParteDosSons; id: string }
  | { acao: 'renomearPasta'; id: string; nome: string }
  | { acao: 'apagarPasta'; id: string }

/**
 * O que a janela pede ao app. `vez` (biblioteca, volume, mudo): a ordem das
 * mudanças desta janela; o espelho diz até qual o app já aplicou.
 */
export type PedidoDosSons =
  | { acao: 'tocar'; efeitoId: string }
  | { acao: 'parar'; efeitoId: string }
  | { acao: 'pararTudo' }
  | { acao: 'mudarVolume'; efeitoId: string; volume: number }
  /** O "Ouvir" do lápis e a prova do link: o motor do app, sem a mesa. */
  | { acao: 'provar'; instancia: string; fonte: FonteDoSom; loop: boolean; volume: number }
  | { acao: 'pararProva'; instancia: string }
  | { acao: 'amostra' }
  | { acao: 'volumeDoAparelho'; vez: number; volume: number }
  | { acao: 'mudo'; vez: number; mudo: boolean }
  | { acao: 'biblioteca'; vez: number; mudanca: MudancaNaBiblioteca }
  | { acao: 'importar'; nome: string; bytes: Uint8Array; parte: ParteDosSons }
  /** Quanto pesa a pasta de mídia da biblioteca: a do app (a janela não diz caminho nenhum). */
  | { acao: 'medir' }
  /** Os bytes de um áudio guardado, para a onda do trecho no lápis. */
  | { acao: 'bytes'; midia: string }

/** O que o app responde aos pedidos que esperam resposta (tocar, importar, medir, bytes). */
export type RespostaDosSons =
  | { tipo: 'tocou'; limiteNaMesa: boolean }
  | { tipo: 'importado'; nome: string }
  | { tipo: 'arquivos'; arquivos: ReadonlyMap<string, number> }
  | { tipo: 'bytes'; bytes: Uint8Array }
  | { tipo: 'erro'; motivo: string }

/** O que a janela mostra: a biblioteca e o volume do app, e até que mudança da janela isto já inclui. */
export interface EstadoDosSons {
  /** Muda a cada vez que o app (re)liga o fio: a janela recomeça a conta das mudanças dela. */
  app: string
  vez: number
  biblioteca: BibliotecaDeSons
  pasta: string | null
  carregando: boolean
  pendente: boolean
  aviso: string | null
  podeGravar: boolean
  volume: number
  mudo: boolean
}

/** Como o estado anda no fio: a biblioteca como o texto do `sons.json`. */
export type EstadoNoFio = Omit<EstadoDosSons, 'biblioteca'> & { biblioteca: string }

/** Da janela para o app. */
export type MensagemDaJanela =
  | { de: 'janela'; sessao: string; tipo: 'ola' | 'ping' | 'adeus' | 'voltar' }
  | { de: 'janela'; sessao: string; tipo: 'pedido'; id: number; pedido: PedidoDosSons }

/** Do app para a janela. O `inicioEmMs` do `tocando` vai em ms de relógio de parede (`performance.timeOrigin` somado). */
export type MensagemDoApp =
  | { de: 'app'; sessao: string; tipo: 'estado'; estado: EstadoNoFio }
  | { de: 'app'; sessao: string; tipo: 'motor'; evento: EventoDoMotor }
  | { de: 'app'; sessao: string; tipo: 'resposta'; id: number; resposta: RespostaDosSons }
  | { de: 'app'; sessao: string; tipo: 'pong' | 'saiu' | 'fechar' }

/** A mensagem que o app lê, já com a biblioteca relida. */
export type MensagemDoAppLida = Exclude<MensagemDoApp, { tipo: 'estado' }> | { de: 'app'; sessao: string; tipo: 'estado'; estado: EstadoDosSons }

// Tabelas completas: um motivo novo no motor sem entrada aqui não compila.
const MOTIVOS_DA_RECUSA: { readonly [M in MotivoDaRecusa]: M } = {
  'limite-de-loops': 'limite-de-loops',
  'sem-gesto': 'sem-gesto',
  atrasado: 'atrasado',
  'nao-carregou': 'nao-carregou',
  'fonte-invalida': 'fonte-invalida',
  'fonte-sem-suporte': 'fonte-sem-suporte',
  'youtube-bloqueado': 'youtube-bloqueado',
  'youtube-indisponivel': 'youtube-indisponivel',
}
const MOTIVOS_DO_FIM: { readonly [M in MotivoDoFim]: M } = { fim: 'fim', parado: 'parado', derrubado: 'derrubado' }

function objeto(dado: unknown): Record<string, unknown> | null {
  if (typeof dado !== 'object' || dado === null || Array.isArray(dado)) return null
  const lido: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(dado)) lido[chave] = valor
  return lido
}

function texto(valor: unknown, maximo: number = TEXTO_MAX): string | null {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= maximo ? valor : null
}

function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null
}

function parte(valor: unknown): ParteDosSons | null {
  return PARTES_DOS_SONS.find((candidata) => candidata === valor) ?? null
}

/** Ausente = `undefined`; presente e torto = `null`. */
function opcional<T>(valor: unknown, ler: (valor: unknown) => T | null): T | undefined | null {
  return valor === undefined ? undefined : ler(valor)
}

function booleano(valor: unknown): boolean | null {
  return typeof valor === 'boolean' ? valor : null
}

/** A categoria: um id, ou `null` (Sem categoria). */
function pastaId(valor: unknown): string | null | false {
  if (valor === null) return null
  return texto(valor) ?? false
}

function lerTrecho(valor: unknown): TrechoDoSom | null | false {
  if (valor === null) return null
  const o = objeto(valor)
  const inicioS = o === null ? null : numero(o.inicioS)
  if (o === null || inicioS === null) return false
  if (o.fimS === undefined) return { inicioS }
  const fimS = numero(o.fimS)
  return fimS === null ? false : { inicioS, fimS }
}

function lerAtalho(valor: unknown): AtalhoDeSom | null | false {
  if (valor === null) return null
  return ehAtalhoDeSom(valor) ? valor : false
}

/** O efeito novo campo a campo (a loja confere os valores de novo: aqui é só a forma). */
function lerEfeitoNovo(valor: unknown): EfeitoNovo | null {
  const o = objeto(valor)
  if (o === null) return null
  const nome = texto(o.nome)
  const fonte = fonteDoSomLida(o.fonte)
  const volume = opcional(o.volume, numero)
  const loop = opcional(o.loop, booleano)
  const daParte = opcional(o.parte, parte)
  const pasta = o.pastaId === undefined ? undefined : pastaId(o.pastaId)
  if (nome === null || fonte === null || volume === null || loop === null || daParte === null || pasta === false) return null
  const novo: EfeitoNovo = { nome, fonte }
  if (volume !== undefined) novo.volume = volume
  if (loop !== undefined) novo.loop = loop
  if (daParte !== undefined) novo.parte = daParte
  if (pasta !== undefined) novo.pastaId = pasta
  return novo
}

/** A mudança no efeito campo a campo; campo torto recusa a mudança inteira (como a loja). */
function lerMudancaNoEfeito(valor: unknown): MudancaNoEfeito | null {
  const o = objeto(valor)
  if (o === null) return null
  const mudanca: MudancaNoEfeito = {}
  if (o.nome !== undefined) {
    const nome = typeof o.nome === 'string' && o.nome.length <= TEXTO_MAX ? o.nome : null
    if (nome === null) return null
    mudanca.nome = nome
  }
  if (o.volume !== undefined) {
    const volume = numero(o.volume)
    if (volume === null) return null
    mudanca.volume = volume
  }
  if (o.loop !== undefined) {
    const loop = booleano(o.loop)
    if (loop === null) return null
    mudanca.loop = loop
  }
  if (o.favorito !== undefined) {
    const favorito = booleano(o.favorito)
    if (favorito === null) return null
    mudanca.favorito = favorito
  }
  if (o.parte !== undefined) {
    const lida = parte(o.parte)
    if (lida === null) return null
    mudanca.parte = lida
  }
  if (o.pastaId !== undefined) {
    const lida = pastaId(o.pastaId)
    if (lida === false) return null
    mudanca.pastaId = lida
  }
  if (o.trecho !== undefined) {
    const lido = lerTrecho(o.trecho)
    if (lido === false) return null
    mudanca.trecho = lido
  }
  if (o.atalho !== undefined) {
    const lido = lerAtalho(o.atalho)
    if (lido === false) return null
    mudanca.atalho = lido
  }
  return mudanca
}

function lerMudancaNaBiblioteca(valor: unknown): MudancaNaBiblioteca | null {
  const o = objeto(valor)
  if (o === null) return null
  const id = texto(o.id)
  if (id === null) return null
  switch (o.acao) {
    case 'adicionarEfeito': {
      const novo = lerEfeitoNovo(o.novo)
      return novo === null ? null : { acao: 'adicionarEfeito', novo, id }
    }
    case 'editarEfeito': {
      const mudanca = lerMudancaNoEfeito(o.mudanca)
      return mudanca === null ? null : { acao: 'editarEfeito', id, mudanca }
    }
    case 'apagarEfeito':
    case 'apagarPasta':
      return { acao: o.acao, id }
    case 'criarPasta': {
      const nome = texto(o.nome)
      const daParte = parte(o.parte)
      return nome === null || daParte === null ? null : { acao: 'criarPasta', nome, parte: daParte, id }
    }
    case 'renomearPasta': {
      const nome = texto(o.nome)
      return nome === null ? null : { acao: 'renomearPasta', id, nome }
    }
    default:
      return null
  }
}

function vez(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0 ? valor : null
}

/** O pedido inteiro, campo a campo; torto = `null`. */
export function lerPedido(dado: unknown): PedidoDosSons | null {
  const o = objeto(dado)
  if (o === null) return null
  switch (o.acao) {
    case 'tocar':
    case 'parar': {
      const efeitoId = texto(o.efeitoId)
      return efeitoId === null ? null : { acao: o.acao, efeitoId }
    }
    case 'pararTudo':
    case 'amostra':
    case 'medir':
      return { acao: o.acao }
    case 'mudarVolume': {
      const efeitoId = texto(o.efeitoId)
      const volume = numero(o.volume)
      return efeitoId === null || volume === null ? null : { acao: 'mudarVolume', efeitoId, volume }
    }
    case 'provar': {
      const instancia = texto(o.instancia)
      const fonte = fonteDoSomLida(o.fonte)
      const loop = booleano(o.loop)
      const volume = numero(o.volume)
      return instancia === null || fonte === null || loop === null || volume === null ? null : { acao: 'provar', instancia, fonte, loop, volume }
    }
    case 'pararProva': {
      const instancia = texto(o.instancia)
      return instancia === null ? null : { acao: 'pararProva', instancia }
    }
    case 'volumeDoAparelho': {
      const deQuando = vez(o.vez)
      const volume = numero(o.volume)
      return deQuando === null || volume === null ? null : { acao: 'volumeDoAparelho', vez: deQuando, volume }
    }
    case 'mudo': {
      const deQuando = vez(o.vez)
      const mudo = booleano(o.mudo)
      return deQuando === null || mudo === null ? null : { acao: 'mudo', vez: deQuando, mudo }
    }
    case 'biblioteca': {
      const deQuando = vez(o.vez)
      const mudanca = lerMudancaNaBiblioteca(o.mudanca)
      return deQuando === null || mudanca === null ? null : { acao: 'biblioteca', vez: deQuando, mudanca }
    }
    case 'importar': {
      const nome = texto(o.nome, NOME_DE_ARQUIVO_MAX)
      const daParte = parte(o.parte)
      // O teto antes de tocar no disco: o mesmo do Importar da página.
      const bytes = o.bytes instanceof Uint8Array && o.bytes.byteLength <= MIDIA_AUDIO_MAX_BYTES ? o.bytes : null
      return nome === null || daParte === null || bytes === null ? null : { acao: 'importar', nome, bytes, parte: daParte }
    }
    case 'bytes':
      return ehIdDeAudio(o.midia) ? { acao: 'bytes', midia: o.midia } : null
    default:
      return null
  }
}

/** A mensagem da janela desta sessão; outra sessão, outro lado ou forma torta = `null`. */
export function lerMensagemDaJanela(dado: unknown, sessao: string): MensagemDaJanela | null {
  const o = objeto(dado)
  if (o === null || o.de !== 'janela' || o.sessao !== sessao) return null
  switch (o.tipo) {
    case 'ola':
    case 'ping':
    case 'adeus':
    case 'voltar':
      return { de: 'janela', sessao, tipo: o.tipo }
    case 'pedido': {
      if (typeof o.id !== 'number' || !Number.isSafeInteger(o.id)) return null
      const pedido = lerPedido(o.pedido)
      return pedido === null ? null : { de: 'janela', sessao, tipo: 'pedido', id: o.id, pedido }
    }
    default:
      return null
  }
}

function lerEventoDoMotor(dado: unknown): EventoDoMotor | null {
  const o = objeto(dado)
  const instancia = o === null ? null : texto(o.instancia)
  if (o === null || instancia === null) return null
  switch (o.tipo) {
    case 'esperando':
    case 'carregando':
      return { tipo: o.tipo, instancia }
    case 'tocando': {
      const duracaoS = numero(o.duracaoS)
      const deslocamentoS = numero(o.deslocamentoS)
      const inicioEmMs = numero(o.inicioEmMs)
      const loop = booleano(o.loop)
      if (duracaoS === null || deslocamentoS === null || inicioEmMs === null || loop === null) return null
      return { tipo: 'tocando', instancia, loop, duracaoS, deslocamentoS, inicioEmMs }
    }
    case 'terminou': {
      const motivo = Object.values(MOTIVOS_DO_FIM).find((candidato) => candidato === o.motivo)
      return motivo === undefined ? null : { tipo: 'terminou', instancia, motivo }
    }
    case 'recusado': {
      const motivo = Object.values(MOTIVOS_DA_RECUSA).find((candidato) => candidato === o.motivo)
      return motivo === undefined ? null : { tipo: 'recusado', instancia, motivo }
    }
    default:
      return null
  }
}

function lerResposta(dado: unknown): RespostaDosSons | null {
  const o = objeto(dado)
  if (o === null) return null
  switch (o.tipo) {
    case 'tocou':
      return typeof o.limiteNaMesa === 'boolean' ? { tipo: 'tocou', limiteNaMesa: o.limiteNaMesa } : null
    case 'importado':
      return typeof o.nome === 'string' ? { tipo: 'importado', nome: o.nome } : null
    case 'arquivos': {
      if (!(o.arquivos instanceof Map)) return null
      const arquivos = new Map<string, number>()
      for (const [nome, bytes] of o.arquivos) if (typeof nome === 'string' && typeof bytes === 'number') arquivos.set(nome, bytes)
      return { tipo: 'arquivos', arquivos }
    }
    case 'bytes':
      return o.bytes instanceof Uint8Array ? { tipo: 'bytes', bytes: o.bytes } : null
    case 'erro':
      return typeof o.motivo === 'string' ? { tipo: 'erro', motivo: o.motivo } : null
    default:
      return null
  }
}

function lerEstado(dado: unknown): EstadoDosSons | null {
  const o = objeto(dado)
  if (o === null || typeof o.biblioteca !== 'string') return null
  const lida = bibliotecaDoTexto(o.biblioteca)
  const app = texto(o.app)
  const volume = numero(o.volume)
  if (!lida.ok || app === null || typeof o.vez !== 'number' || !Number.isSafeInteger(o.vez) || volume === null) return null
  if (typeof o.carregando !== 'boolean' || typeof o.pendente !== 'boolean' || typeof o.podeGravar !== 'boolean' || typeof o.mudo !== 'boolean') return null
  const pasta = typeof o.pasta === 'string' ? o.pasta : null
  const aviso = typeof o.aviso === 'string' ? o.aviso : null
  return { app, vez: o.vez, biblioteca: lida.biblioteca, pasta, carregando: o.carregando, pendente: o.pendente, aviso, podeGravar: o.podeGravar, volume, mudo: o.mudo }
}

/** A mensagem do app desta sessão. A janela confia no app (a mesma origem e o mesmo app), mas relê cada forma antes de usar. */
export function lerMensagemDoApp(dado: unknown, sessao: string): MensagemDoAppLida | null {
  const o = objeto(dado)
  if (o === null || o.de !== 'app' || o.sessao !== sessao) return null
  switch (o.tipo) {
    case 'estado': {
      const estado = lerEstado(o.estado)
      return estado === null ? null : { de: 'app', sessao, tipo: 'estado', estado }
    }
    case 'motor': {
      const evento = lerEventoDoMotor(o.evento)
      return evento === null ? null : { de: 'app', sessao, tipo: 'motor', evento }
    }
    case 'resposta': {
      const resposta = lerResposta(o.resposta)
      return typeof o.id !== 'number' || resposta === null ? null : { de: 'app', sessao, tipo: 'resposta', id: o.id, resposta }
    }
    case 'pong':
    case 'saiu':
    case 'fechar':
      return { de: 'app', sessao, tipo: o.tipo }
    default:
      return null
  }
}
