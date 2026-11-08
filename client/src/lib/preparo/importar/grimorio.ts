import { ehRegistro } from '../molde'

/**
 * O FORMATO DO GRIMÓRIO, lido como o próprio Grimório lê
 * (`grimorio/src/lib/vaultRepo.ts:33-150`, `vinculos.ts:84-110`,
 * `focoRetrato.ts:29-34`, `notebookRepo.ts:60-82`, `types.ts`). As regras de
 * migração são as dele: personagem antigo (sem `versoes`) vira uma forma com
 * o nome do personagem e `corpo` vira `descricao`; cenário antigo vira a
 * versão "Base"; campo que falta ganha o vazio equivalente.
 *
 * A única diferença, de propósito: onde o Grimório sorteia um id
 * (`crypto.randomUUID`), aqui entra a `reserva`, um id fixo tirado do caminho
 * do arquivo. Reimportar o mesmo arquivo dá o mesmo id.
 */

export type Bruto = Record<string, unknown>

export interface ImagemG {
  rel: string
  legenda?: string
}

export interface FocoG {
  x: number
  y: number
}

export interface ItemNoAcervoG {
  itemId: string
  qtd?: number
}

export interface VersaoPersonagemG {
  id: string
  nome: string
  retrato: string | null
  foco?: FocoG
  resumo: string
  descricao: string
  informacao: string
  historia: string
  extras: string
  anotacoes: string
  imagens: ImagemG[]
  acervo: ItemNoAcervoG[]
}

export interface PersonagemG {
  id: string
  nome: string
  versoes: VersaoPersonagemG[]
  versaoAtivaId: string
}

export interface VersaoCenarioG {
  id: string
  nome: string
  retrato: string | null
  foco?: FocoG
  resumo: string
  descricao: string
  informacao: string
  historia: string
  eventos: string
  itens: string
  acervo: ItemNoAcervoG[]
  anotacoes: string
  imagens: ImagemG[]
}

export interface CenarioG {
  id: string
  nome: string
  personagens: string[]
  versoes: VersaoCenarioG[]
  versaoAtivaId: string
}

export interface ItemG {
  id: string
  nome: string
  resumo: string
  retrato: string | null
  foco?: FocoG
  descricao: string
  informacao: string
  efeito: string
}

export interface PaginaG {
  id: string
  titulo: string
  paiId: string | null
  ordem: number
  corpo: string
}

/** Sessão, canvas, mapa e caderno da Escrita têm o mesmo formato (`types.ts:127-142`). */
export interface DocumentoG {
  id: string
  nome: string
  /** A foto do tldraw, intacta (ou `null`). */
  documento: unknown
  camadas?: unknown[]
  versaoCamadas?: number
}

export interface CampanhaG {
  id: string
  nome: string
  descricao: string
}

export interface PastaG {
  id?: string
  nome?: string
}

export const TIPO_PARTICIPA = 'participa'

export interface VinculoG {
  id: string
  deTipo: 'personagem' | 'cenario' | 'item' | 'canvas' | 'pasta'
  deId: string
  paraTipo: 'personagem' | 'cenario' | 'item' | 'campanha'
  paraId: string
  tipo: string
  notas: string
}

// ─── Peças ───────────────────────────────────────────────────────────────────

function textoDe(raw: Bruto, chave: string, padrao = ''): string {
  const valor = raw[chave]
  return typeof valor === 'string' ? valor : padrao
}

function textoOuNulo(raw: Bruto, chave: string): string | null {
  const valor = raw[chave]
  return typeof valor === 'string' ? valor : null
}

/** O id do arquivo; sem id, a reserva (o Grimório sortearia). */
function idOu(raw: Bruto, reserva: string): string {
  const valor = raw.id
  return typeof valor === 'string' && valor !== '' ? valor : reserva
}

function registros(valor: unknown): Bruto[] {
  return Array.isArray(valor) ? valor.filter(ehRegistro) : []
}

function ehPorcentagem(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor <= 100
}

/** `focoRetrato.ts:29-34`: fora de 0–100 = sem enquadramento (centro). */
function focoDe(valor: unknown): FocoG | undefined {
  if (!ehRegistro(valor)) return undefined
  const { x, y } = valor
  return ehPorcentagem(x) && ehPorcentagem(y) ? { x, y } : undefined
}

function imagensDe(valor: unknown): ImagemG[] {
  return registros(valor).flatMap((imagem): ImagemG[] => {
    const rel = imagem.rel
    if (typeof rel !== 'string' || rel === '') return []
    const legenda = imagem.legenda
    return [typeof legenda === 'string' ? { rel, legenda } : { rel }]
  })
}

/** Acervo antigo sem a chave vira vazio; entrada sem `itemId` sai (`vaultRepo.ts:49,96`). */
function acervoDe(valor: unknown): ItemNoAcervoG[] {
  return registros(valor).flatMap((entrada): ItemNoAcervoG[] => {
    const { itemId, qtd } = entrada
    if (typeof itemId !== 'string') return []
    return typeof qtd === 'number' && Number.isFinite(qtd) ? [{ itemId, qtd }] : [{ itemId }]
  })
}

function comFoco<T extends { foco?: FocoG }>(base: T, raw: Bruto): T {
  const foco = focoDe(raw.foco)
  if (foco !== undefined) base.foco = foco
  return base
}

/** A forma ativa: a pedida, se existir; senão a primeira (`vaultRepo.ts:69-71`). */
function ativaDe(raw: Bruto, versoes: readonly { id: string }[], primeira: string): string {
  const pedida = raw.versaoAtivaId
  return typeof pedida === 'string' && versoes.some((versao) => versao.id === pedida) ? pedida : primeira
}

// ─── Fichas ──────────────────────────────────────────────────────────────────

function versaoPersonagem(raw: Bruto, reserva: string): VersaoPersonagemG {
  return comFoco<VersaoPersonagemG>(
    {
      id: idOu(raw, reserva),
      nome: textoDe(raw, 'nome'),
      retrato: textoOuNulo(raw, 'retrato'),
      resumo: textoDe(raw, 'resumo'),
      descricao: textoDe(raw, 'descricao', textoDe(raw, 'corpo')),
      informacao: textoDe(raw, 'informacao'),
      historia: textoDe(raw, 'historia'),
      extras: textoDe(raw, 'extras'),
      anotacoes: textoDe(raw, 'anotacoes'),
      imagens: imagensDe(raw.imagens),
      acervo: acervoDe(raw.acervo),
    },
    raw,
  )
}

/** `vaultRepo.ts:59-81`. O personagem plano antigo vira uma forma que herda o nome dele. */
export function normalizarPersonagem(raw: Bruto, reserva: string): PersonagemG {
  const brutas = registros(raw.versoes)
  const versoes =
    brutas.length > 0
      ? brutas.map((versao, posicao) => versaoPersonagem(versao, `${reserva}-forma${posicao}`))
      : [versaoPersonagem({ ...raw, id: undefined }, `${reserva}-forma0`)]
  const versaoAtivaId = ativaDe(raw, versoes, versoes[0].id)
  const ativa = versoes.find((versao) => versao.id === versaoAtivaId) ?? versoes[0]
  return { id: idOu(raw, reserva), nome: ativa.nome, versoes, versaoAtivaId }
}

function versaoCenario(raw: Bruto, reserva: string, nomePadrao: string): VersaoCenarioG {
  return comFoco<VersaoCenarioG>(
    {
      id: idOu(raw, reserva),
      nome: textoDe(raw, 'nome', nomePadrao),
      retrato: textoOuNulo(raw, 'retrato'),
      resumo: textoDe(raw, 'resumo'),
      descricao: textoDe(raw, 'descricao'),
      informacao: textoDe(raw, 'informacao'),
      historia: textoDe(raw, 'historia'),
      eventos: textoDe(raw, 'eventos'),
      itens: textoDe(raw, 'itens'),
      acervo: acervoDe(raw.acervo),
      anotacoes: textoDe(raw, 'anotacoes'),
      imagens: imagensDe(raw.imagens),
    },
    raw,
  )
}

const VERSAO_BASE = 'Base'

/** `vaultRepo.ts:106-128`. O cenário plano antigo vira a versão "Base" (o id e o nome do cenário não passam para ela). */
export function normalizarCenario(raw: Bruto, reserva: string): CenarioG {
  const brutas = registros(raw.versoes)
  const versoes =
    brutas.length > 0
      ? brutas.map((versao, posicao) => versaoCenario(versao, `${reserva}-forma${posicao}`, VERSAO_BASE))
      : [versaoCenario({ ...raw, id: undefined, nome: undefined }, `${reserva}-forma0`, VERSAO_BASE)]
  const personagens = Array.isArray(raw.personagens) ? raw.personagens.filter((id): id is string => typeof id === 'string') : []
  return { id: idOu(raw, reserva), nome: textoDe(raw, 'nome'), personagens, versoes, versaoAtivaId: ativaDe(raw, versoes, versoes[0].id) }
}

/** `vaultRepo.ts:136-150`. */
export function normalizarItem(raw: Bruto, reserva: string): ItemG {
  return comFoco<ItemG>(
    {
      id: idOu(raw, reserva),
      nome: textoDe(raw, 'nome'),
      resumo: textoDe(raw, 'resumo'),
      retrato: textoOuNulo(raw, 'retrato'),
      descricao: textoDe(raw, 'descricao'),
      informacao: textoDe(raw, 'informacao'),
      efeito: textoDe(raw, 'efeito'),
    },
    raw,
  )
}

// ─── Cadernos, documentos, campanhas ─────────────────────────────────────────

/** `notebookRepo.ts:60-82` lê a página crua; aqui o que falta ganha o vazio. */
export function normalizarPagina(raw: Bruto, reserva: string): PaginaG {
  const ordem = raw.ordem
  return {
    id: idOu(raw, reserva),
    titulo: textoDe(raw, 'titulo'),
    paiId: textoOuNulo(raw, 'paiId'),
    ordem: typeof ordem === 'number' && Number.isFinite(ordem) ? ordem : 0,
    corpo: textoDe(raw, 'corpo'),
  }
}

export function normalizarDocumento(raw: Bruto, reserva: string): DocumentoG {
  const documento: DocumentoG = { id: idOu(raw, reserva), nome: textoDe(raw, 'nome'), documento: raw.documento ?? null }
  if (Array.isArray(raw.camadas)) documento.camadas = raw.camadas
  const versaoCamadas = raw.versaoCamadas
  if (typeof versaoCamadas === 'number') documento.versaoCamadas = versaoCamadas
  return documento
}

export function normalizarCampanha(raw: Bruto, reserva: string): CampanhaG {
  return { id: idOu(raw, reserva), nome: textoDe(raw, 'nome'), descricao: textoDe(raw, 'descricao') }
}

export function normalizarPasta(raw: Bruto): PastaG {
  const pasta: PastaG = {}
  if (typeof raw.id === 'string' && raw.id !== '') pasta.id = raw.id
  if (typeof raw.nome === 'string') pasta.nome = raw.nome
  return pasta
}

// ─── Vínculos ────────────────────────────────────────────────────────────────

const PONTAS_DE_ORIGEM: ReadonlySet<string> = new Set(['personagem', 'cenario', 'item', 'canvas', 'pasta'])
const PONTAS_DE_DESTINO: ReadonlySet<string> = new Set(['personagem', 'cenario', 'item', 'campanha'])

function ehOrigem(valor: unknown): valor is VinculoG['deTipo'] {
  return typeof valor === 'string' && PONTAS_DE_ORIGEM.has(valor)
}

function ehDestino(valor: unknown): valor is VinculoG['paraTipo'] {
  return typeof valor === 'string' && PONTAS_DE_DESTINO.has(valor)
}

function textoCheio(valor: unknown): valor is string {
  return typeof valor === 'string' && valor !== ''
}

/**
 * `vinculos.ts:84-110`: entrada sem id, pontas ou tipo, ou com ponta fora do
 * domínio, sai; nota que falta vira ''. Devolve também quantas saíram, para o
 * relatório (o Grimório descarta em silêncio).
 */
export function normalizarVinculos(raw: unknown): { vinculos: VinculoG[]; descartados: number } {
  const lista = ehRegistro(raw) ? raw.vinculos : undefined
  if (!Array.isArray(lista)) return { vinculos: [], descartados: 0 }
  const vinculos: VinculoG[] = []
  for (const entrada of lista) {
    if (!ehRegistro(entrada)) continue
    const { id, deTipo, deId, paraTipo, paraId, tipo, notas } = entrada
    if (!textoCheio(id) || !textoCheio(deId) || !textoCheio(paraId) || !textoCheio(tipo) || !ehOrigem(deTipo) || !ehDestino(paraTipo)) continue
    vinculos.push({ id, deTipo, deId, paraTipo, paraId, tipo, notas: typeof notas === 'string' ? notas : '' })
  }
  return { vinculos, descartados: lista.length - vinculos.length }
}
