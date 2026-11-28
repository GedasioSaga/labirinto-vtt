/**
 * PUZZLES — as mensagens do puzzle (plano dos puzzles, §2.2; fase P7).
 * Aditivo como o resto do protocolo: jogador antigo cai no `default` e
 * ignora; mestre antigo responde `error invalid_message`.
 *
 *  - jogador → mestre: `puzzle.entrar` (encostou e tocou em "Examinar"),
 *    `puzzle.acao` (pôr, tirar, bandeja, trocar; na combinação, girar,
 *    ponteiro, apertar e tentar) e `puzzle.sair`;
 *  - mestre → jogador: `puzzle.vista` (o puzzle como ELE o vê, a cada
 *    mudança, a quem está dentro), `puzzle.recusado`, `puzzle.castigo` (só a
 *    quem errou, e só agora), `puzzle.resolvido` (a quem está dentro, cada um
 *    com o que ELE ganhou) e `puzzle.fechado` (o mestre mudou ou apagou).
 *
 * O host é a autoridade: o jogador só pede, e a resposta certa nunca viaja.
 * A vista é montada por lista branca em `puzzles/recorte.ts`; aqui o jogador
 * confere a forma de tudo, e a mensagem torta cai inteira em vez de virar
 * meia tela.
 *
 * Este módulo não importa `protocol.ts`, que importa daqui.
 */
import { ehIdDeDocumento } from '../documentos/leitor'
import { lerAcaoNoPuzzle } from '../puzzles/leitor'
import { ALGARISMOS } from '../puzzles/combinacao'
import {
  BANDEJA_MAX,
  BOTOES_MAX,
  BOTOES_MIN,
  ENCAIXES_MAX,
  ESCALA_DO_CONTROLE_MAX,
  MINUTOS_NO_MOSTRADOR,
  RODAS_MAX,
  RODAS_MIN,
  ROTULO_DO_BOTAO_MAX,
  SEQUENCIA_MAX,
  SIMBOLOS_DA_RODA,
  FORMAS_DO_ENCAIXE,
  INSCRICAO_MAX,
  MODELOS_DO_PUZZLE,
  NOME_DO_PUZZLE_MAX,
  PESO_MAX,
  PV_DO_CASTIGO_MAX,
  TEXTO_DA_RECUSA,
  TEXTO_DO_CASTIGO_MAX,
  TEXTO_DO_PUZZLE_MAX,
  CENAS_DO_RELEVO,
  METAIS_DO_RELEVO,
  PLACAS_DO_RELEVO,
} from '../puzzles/tipos'
import type {
  AcaoNoPuzzle,
  CombinacaoNaVista,
  EncaixeNaVista,
  FormaDoEncaixe,
  ModeloDoPuzzle,
  MotivoDaRecusa,
  PostaNaVista,
  TipoDeCastigo,
  VagaNaVista,
  VisualDoPuzzle,
  VistaDoPuzzle,
} from '../puzzles/tipos'

// ------------------------------------------------------------------ tetos do fio (só barram lixo)

/** Ids de desafio, de ficha, de encaixe e de vaga. */
export const PUZZLE_ID_MAX = 200
/** Nome de item, de quem pôs ("Lara e Bento") e título de documento. */
const NOME_NO_FIO_MAX = 120
/** Referência de imagem (`midia:<id>`); maior que isto não é referência. */
const IMAGEM_NO_FIO_MAX = 512
/** Cor do modelo (`#rrggbb`), com folga. */
const COR_NO_FIO_MAX = 32
/** Vagas da mochila na vista: a mochila de uma ficha nunca chega perto disto. */
const VAGAS_NA_VISTA_MAX = 500
const QUANTIDADE_MAX = 9999
const NUMERO_MAX = 999_999
/** Coordenada e tamanho em % do quadro, com folga para o que o leitor do mapa aceita. */
const PORCENTO_MIN = -1000
const PORCENTO_MAX = 1000
/** Itens do desfecho que viajam no `puzzle.resolvido`. */
const ITENS_DO_PREMIO_MAX = 60
const DOCUMENTOS_DO_PREMIO_MAX = 20

// ------------------------------------------------------------------ recusas

/**
 * Por que o host não deixou. Os do motor e do host (`MotivoDaRecusa`, com o
 * texto em `TEXTO_DA_RECUSA`) mais os da sala: `indisponivel` (cena em pausa,
 * puzzle fora do recorte dele, ele não está dentro) e `congelado` (a ficha está
 * parada).
 */
export type PuzzleMotivoDaRecusa = MotivoDaRecusa | 'indisponivel' | 'congelado'

const MOTIVOS_DA_SALA: readonly PuzzleMotivoDaRecusa[] = ['indisponivel', 'congelado']

function ehMotivoDaRecusa(valor: unknown): valor is PuzzleMotivoDaRecusa {
  if (typeof valor !== 'string') return false
  return Object.hasOwn(TEXTO_DA_RECUSA, valor) || MOTIVOS_DA_SALA.some((motivo) => motivo === valor)
}

/** O texto curto de cada recusa, na tela do jogador. */
export function textoDaRecusaDoPuzzle(motivo: PuzzleMotivoDaRecusa): string {
  switch (motivo) {
    case 'indisponivel':
      return 'Não dá para mexer neste puzzle agora.'
    case 'congelado':
      return 'Sua ficha está parada agora.'
    default:
      return TEXTO_DA_RECUSA[motivo]
  }
}

// ------------------------------------------------------------------ o que viaja

/**
 * O erro que castigou: a Ordem certa cheia na ordem errada, o peso errado na
 * bandeja, ou, na combinação, as rodas, a hora ou o botão fora da sequência.
 */
export type ErroDoPuzzleNoFio = { em: 'ordem' | 'combinacao' | 'hora' | 'sequencia' } | { em: 'peso'; soma: number; pedido: number }

/**
 * O castigo como ele chegou a quem errou. `texto` já é o do mestre ou o padrão
 * (vazio só no `nada`); `pv` é o que de fato saiu da ficha (0 no barulho, no
 * nada e na ficha sem vida).
 */
export interface CastigoDoPuzzleNoFio {
  tipo: TipoDeCastigo
  texto: string
  pv: number
}

/** O que UM jogador ganhou ao resolver: quem resolveu leva o desfecho; quem só estava dentro, nada. */
export interface PremioDoPuzzleNoFio {
  itens: { nome: string; quantidade: number }[]
  moedas: number
  /** Os títulos dos documentos que entraram agora na lista dele, com o "novo" (o que ele já tinha não volta aqui). */
  documentos: string[]
}

/** O desfecho como chega a quem está dentro: o mesmo texto para todos, o prêmio de cada um. */
export interface DesfechoDoPuzzleNoFio {
  /** O nome de quem resolveu (a ficha dele). */
  por: string
  modo: 'texto' | 'cena'
  /** O texto do desfecho (o do mestre, ou o padrão). */
  texto: string
  premio: PremioDoPuzzleNoFio
  abriuPorta: boolean
}

/** Por que a tela do puzzle fechou: o mestre mudou a cópia, ou o puzzle saiu do lugar (apagado, outra cena). */
export type PuzzleFechadoMotivo = 'mudou' | 'sumiu'
const MOTIVOS_DO_FECHADO: readonly PuzzleFechadoMotivo[] = ['mudou', 'sumiu']

export type PuzzlePlayerMessage =
  /** `tokenId` ausente: o host usa a primeira ficha dele encostada e solta. */
  | { type: 'puzzle.entrar'; desafioId: string; tokenId?: string }
  /** `rev` = o da vista que ele vê; a tela velha recebe `velho` e a vista nova. */
  | { type: 'puzzle.acao'; desafioId: string; rev: number; acao: AcaoNoPuzzle }
  | { type: 'puzzle.sair'; desafioId: string }

export type PuzzleHostMessage =
  | { type: 'puzzle.vista'; vista: VistaDoPuzzle }
  | { type: 'puzzle.recusado'; desafioId: string; motivo: PuzzleMotivoDaRecusa }
  | { type: 'puzzle.castigo'; desafioId: string; erro: ErroDoPuzzleNoFio; castigo: CastigoDoPuzzleNoFio }
  | ({ type: 'puzzle.resolvido'; desafioId: string } & DesfechoDoPuzzleNoFio)
  | { type: 'puzzle.fechado'; desafioId: string; motivo: PuzzleFechadoMotivo }

// ------------------------------------------------------------------ peças pequenas

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textoAte(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max
}

function idAte(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= PUZZLE_ID_MAX
}

function inteiroAte(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= max
}

function porcento(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= PORCENTO_MIN && value <= PORCENTO_MAX
}

function umDaLista<T extends string>(lista: readonly T[], value: unknown): T | undefined {
  return lista.find((item) => item === value)
}

/** A imagem do fio: referência curta, ou `null`. O que não é texto (ou é grande demais) vira `null`, sem derrubar a vista. */
function imagemDoFio(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= IMAGEM_NO_FIO_MAX ? value : null
}

// ------------------------------------------------------------------ do jogador, no host

/** Do jogador, no host: a sessão confere o resto (alcance, recorte, rev, mochila). */
export function parsePuzzlePlayerMessage(value: unknown): PuzzlePlayerMessage | null {
  if (!isRecord(value) || !idAte(value.desafioId)) return null
  const desafioId = value.desafioId
  switch (value.type) {
    case 'puzzle.entrar':
      if (value.tokenId === undefined) return { type: 'puzzle.entrar', desafioId }
      return idAte(value.tokenId) ? { type: 'puzzle.entrar', desafioId, tokenId: value.tokenId } : null
    case 'puzzle.acao': {
      if (!inteiroAte(value.rev, Number.MAX_SAFE_INTEGER)) return null
      const acao = lerAcaoNoPuzzle(value.acao)
      return acao === null ? null : { type: 'puzzle.acao', desafioId, rev: value.rev, acao }
    }
    case 'puzzle.sair':
      return { type: 'puzzle.sair', desafioId }
    default:
      return null
  }
}

// ------------------------------------------------------------------ do mestre, no jogador

function lerVisual(value: unknown): VisualDoPuzzle | null {
  if (!isRecord(value)) return null
  if (value.tipo === 'imagem') return value.imagem === null ? { tipo: 'imagem', imagem: null } : { tipo: 'imagem', imagem: imagemDoFio(value.imagem) }
  if (value.tipo === 'relevo') {
    // O painel em relevo: cena de fábrica ou a imagem do mestre (`cena: null`), e o metal.
    const cena = value.cena === null ? null : umDaLista(CENAS_DO_RELEVO, value.cena)
    const metal = umDaLista(METAIS_DO_RELEVO, value.metal)
    if (cena === undefined || metal === undefined) return null
    return { tipo: 'relevo', cena, imagem: cena === null && value.imagem !== null ? imagemDoFio(value.imagem) : null, metal }
  }
  if (value.tipo !== 'modelo') return null
  const modelo: ModeloDoPuzzle | undefined = umDaLista(MODELOS_DO_PUZZLE, value.modelo)
  const moldura = value.moldura === 'original' || value.moldura === 'porta' ? value.moldura : undefined
  const cores = value.cores
  if (modelo === undefined || moldura === undefined || !textoAte(value.inscricao, INSCRICAO_MAX) || !isRecord(cores)) return null
  const { parede, chao, objeto } = cores
  if (!textoAte(parede, COR_NO_FIO_MAX) || !textoAte(chao, COR_NO_FIO_MAX) || !textoAte(objeto, COR_NO_FIO_MAX)) return null
  return { tipo: 'modelo', modelo, cores: { parede, chao, objeto }, inscricao: value.inscricao, moldura }
}

function lerPosta(value: unknown): PostaNaVista | null | undefined {
  if (value === null) return null
  if (!isRecord(value) || !textoAte(value.nome, NOME_NO_FIO_MAX) || !textoAte(value.por, NOME_NO_FIO_MAX)) return undefined
  return { nome: value.nome, imagem: imagemDoFio(value.imagem), por: value.por }
}

function lerEncaixe(value: unknown): EncaixeNaVista | null {
  if (!isRecord(value) || !idAte(value.id) || !porcento(value.x) || !porcento(value.y) || !porcento(value.t)) return null
  const forma: FormaDoEncaixe | undefined = umDaLista(FORMAS_DO_ENCAIXE, value.forma)
  const jeito = value.jeito === 'peca' || value.jeito === 'metades' ? value.jeito : undefined
  const posta = lerPosta(value.posta)
  if (forma === undefined || jeito === undefined || posta === undefined) return null
  const encaixe: EncaixeNaVista = { id: value.id, x: value.x, y: value.y, t: value.t, forma, jeito, posta }
  if (value.metadesPostas === 0 || value.metadesPostas === 1 || value.metadesPostas === 2) encaixe.metadesPostas = value.metadesPostas
  else if (value.metadesPostas !== undefined) return null
  // A placa do painel em relevo (o desenho do vão).
  if (inteiroAte(value.placa, PLACAS_DO_RELEVO - 1)) encaixe.placa = value.placa
  else if (value.placa !== undefined) return null
  return encaixe
}

function lerTroca(value: unknown): VistaDoPuzzle['troca'] | undefined {
  if (value === null) return null
  if (!isRecord(value) || !porcento(value.x) || !porcento(value.y) || !inteiroAte(value.pesoPedido, PESO_MAX) || typeof value.feita !== 'boolean') return undefined
  if (!Array.isArray(value.naBandeja) || value.naBandeja.length > BANDEJA_MAX) return undefined
  const naBandeja: { nome: string; peso: number }[] = []
  for (const pedra of value.naBandeja) {
    if (!isRecord(pedra) || !textoAte(pedra.nome, NOME_NO_FIO_MAX) || !inteiroAte(pedra.peso, PESO_MAX)) return undefined
    naBandeja.push({ nome: pedra.nome, peso: pedra.peso })
  }
  return { x: value.x, y: value.y, pesoPedido: value.pesoPedido, naBandeja, feita: value.feita }
}

function lerDica(value: unknown): VistaDoPuzzle['dica'] | undefined {
  if (value === null) return null
  if (!isRecord(value)) return undefined
  if (value.tipo === 'texto') return textoAte(value.texto, TEXTO_DO_PUZZLE_MAX) ? { tipo: 'texto', texto: value.texto } : undefined
  if (value.tipo === 'documento' && textoAte(value.titulo, NOME_NO_FIO_MAX)) {
    // Só o que ele já leu leva o id (o da lista dele); o que não leu vem sem título e sem id.
    if (value.podeLer === true) return ehIdDeDocumento(value.docId) ? { tipo: 'documento', titulo: value.titulo, podeLer: true, docId: value.docId } : undefined
    if (value.podeLer === false) return { tipo: 'documento', titulo: value.titulo, podeLer: false }
  }
  return undefined
}

function lerVaga(value: unknown): VagaNaVista | null {
  if (!isRecord(value) || !idAte(value.vagaId) || !textoAte(value.nome, NOME_NO_FIO_MAX) || typeof value.peca !== 'boolean') return null
  if (!inteiroAte(value.quantidade, QUANTIDADE_MAX) || value.quantidade < 1) return null
  return { vagaId: value.vagaId, nome: value.nome, imagem: imagemDoFio(value.imagem), quantidade: value.quantidade, peca: value.peca }
}

/** Lê cada item da lista com `ler`; um torto derruba a lista inteira (`null`). */
function lerLista<T>(value: unknown, max: number, ler: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value) || value.length > max) return null
  const lidos: T[] = []
  for (const item of value) {
    const lido = ler(item)
    if (lido === null) return null
    lidos.push(lido)
  }
  return lidos
}

/** O controle da combinação: ausente = puzzle de encaixes (`undefined`); torto = `null`, e a vista cai inteira. */
function lerCombinacaoNaVista(value: unknown): CombinacaoNaVista | null | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value) || !porcento(value.x) || !porcento(value.y) || typeof value.s !== 'number' || !Number.isFinite(value.s) || value.s <= 0 || value.s > ESCALA_DO_CONTROLE_MAX) return null
  const { x, y, s } = value
  switch (value.forma) {
    case 'numeros':
    case 'simbolos': {
      const tamanho = value.forma === 'numeros' ? ALGARISMOS : SIMBOLOS_DA_RODA.length
      const rodas = lerLista(value.rodas, RODAS_MAX, (roda) => (inteiroAte(roda, tamanho - 1) ? roda : null))
      return rodas === null || rodas.length < RODAS_MIN ? null : { x, y, s, forma: value.forma, rodas }
    }
    case 'relogio':
      return inteiroAte(value.minutos, MINUTOS_NO_MOSTRADOR - 1) ? { x, y, s, forma: 'relogio', minutos: value.minutos } : null
    case 'botoes': {
      const rotulos = lerLista(value.rotulos, BOTOES_MAX, (rotulo) => (textoAte(rotulo, ROTULO_DO_BOTAO_MAX) ? rotulo : null))
      if (rotulos === null || rotulos.length < BOTOES_MIN || !inteiroAte(value.total, SEQUENCIA_MAX) || !inteiroAte(value.certos, value.total)) return null
      return { x, y, s, forma: 'botoes', rotulos, total: value.total, certos: value.certos }
    }
    default:
      return null
  }
}

/** A vista inteira, campo a campo; um campo torto derruba a mensagem. */
export function lerVistaDoPuzzle(value: unknown): VistaDoPuzzle | null {
  if (!isRecord(value) || !idAte(value.desafioId) || !inteiroAte(value.rev, Number.MAX_SAFE_INTEGER) || !textoAte(value.titulo, NOME_DO_PUZZLE_MAX)) return null
  if (typeof value.resolvido !== 'boolean' || !isRecord(value.contagem)) return null
  const { postos, total } = value.contagem
  if (!inteiroAte(postos, ENCAIXES_MAX) || !inteiroAte(total, ENCAIXES_MAX)) return null
  const visual = lerVisual(value.visual)
  const encaixes = lerLista(value.encaixes, ENCAIXES_MAX, lerEncaixe)
  const troca = lerTroca(value.troca)
  const dica = lerDica(value.dica)
  const mochila = lerLista(value.mochila, VAGAS_NA_VISTA_MAX, lerVaga)
  const combinacao = lerCombinacaoNaVista(value.combinacao)
  if (visual === null || encaixes === null || troca === undefined || dica === undefined || mochila === null || combinacao === null) return null
  const vista: VistaDoPuzzle = { desafioId: value.desafioId, rev: value.rev, titulo: value.titulo, visual, encaixes, troca, dica, resolvido: value.resolvido, contagem: { postos, total }, mochila }
  if (combinacao !== undefined) vista.combinacao = combinacao
  if (value.versaoNova === true) vista.versaoNova = true
  return vista
}

function lerErro(value: unknown): ErroDoPuzzleNoFio | null {
  if (!isRecord(value)) return null
  if (value.em === 'ordem' || value.em === 'combinacao' || value.em === 'hora' || value.em === 'sequencia') return { em: value.em }
  if (value.em === 'peso' && inteiroAte(value.soma, NUMERO_MAX) && inteiroAte(value.pedido, PESO_MAX)) return { em: 'peso', soma: value.soma, pedido: value.pedido }
  return null
}

function lerCastigo(value: unknown): CastigoDoPuzzleNoFio | null {
  if (!isRecord(value) || !textoAte(value.texto, TEXTO_DO_CASTIGO_MAX) || !inteiroAte(value.pv, PV_DO_CASTIGO_MAX)) return null
  const tipo = value.tipo === 'nada' || value.tipo === 'dano' || value.tipo === 'armadilha' || value.tipo === 'barulho' ? value.tipo : undefined
  return tipo === undefined ? null : { tipo, texto: value.texto, pv: value.pv }
}

function lerPremio(value: unknown): PremioDoPuzzleNoFio | null {
  if (!isRecord(value) || !inteiroAte(value.moedas, NUMERO_MAX)) return null
  const itens = lerLista(value.itens, ITENS_DO_PREMIO_MAX, (item) =>
    isRecord(item) && textoAte(item.nome, NOME_NO_FIO_MAX) && inteiroAte(item.quantidade, QUANTIDADE_MAX) ? { nome: item.nome, quantidade: item.quantidade } : null,
  )
  const documentos = lerLista(value.documentos, DOCUMENTOS_DO_PREMIO_MAX, (titulo) => (textoAte(titulo, NOME_NO_FIO_MAX) ? titulo : null))
  return itens === null || documentos === null ? null : { itens, moedas: value.moedas, documentos }
}

/** Do mestre, no jogador. O host é de confiança, mas a mensagem torta cai inteira em vez de virar meia tela. */
export function parsePuzzleHostMessage(value: unknown): PuzzleHostMessage | null {
  if (!isRecord(value)) return null
  if (value.type === 'puzzle.vista') {
    const vista = lerVistaDoPuzzle(value.vista)
    return vista === null ? null : { type: 'puzzle.vista', vista }
  }
  if (!idAte(value.desafioId)) return null
  const desafioId = value.desafioId
  switch (value.type) {
    case 'puzzle.recusado':
      return ehMotivoDaRecusa(value.motivo) ? { type: 'puzzle.recusado', desafioId, motivo: value.motivo } : null
    case 'puzzle.castigo': {
      const erro = lerErro(value.erro)
      const castigo = lerCastigo(value.castigo)
      return erro === null || castigo === null ? null : { type: 'puzzle.castigo', desafioId, erro, castigo }
    }
    case 'puzzle.resolvido': {
      const premio = lerPremio(value.premio)
      const modo = value.modo === 'texto' || value.modo === 'cena' ? value.modo : undefined
      if (premio === null || modo === undefined || !textoAte(value.por, NOME_NO_FIO_MAX) || !textoAte(value.texto, TEXTO_DO_PUZZLE_MAX) || typeof value.abriuPorta !== 'boolean') return null
      return { type: 'puzzle.resolvido', desafioId, por: value.por, modo, texto: value.texto, premio, abriuPorta: value.abriuPorta }
    }
    case 'puzzle.fechado': {
      const motivo = umDaLista(MOTIVOS_DO_FECHADO, value.motivo)
      return motivo === undefined ? null : { type: 'puzzle.fechado', desafioId, motivo }
    }
    default:
      return null
  }
}
