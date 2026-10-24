import { ehIdDeAudio, ehRefDeAudio, idDaRefDeAudio, MIDIA_AUDIO_MAX_BYTES } from '../midia'

/**
 * BIBLIOTECA DE SONS da aventura (Sistema 4, sons ao vivo; plano em
 * `docs/planos/sons-ao-vivo-2026-10-23.md`): os efeitos que o mestre toca na
 * mesa, em pastas de um nível só. Regras puras; o disco fica em
 * `bibliotecaNoDisco.ts` e a tela lê `stores/bibliotecaDeSonsStore.ts`.
 *
 * Mora em `<pasta da aventura>/sons.json`, nunca no `adventure.json`. O que vem
 * de lá pode ter sido editado à mão ou vindo de outro computador: quem lê
 * descarta a entrada torta (o efeito, a pasta, o atalho repetido) em vez de
 * recusar o arquivo inteiro. Quem muda (`comEfeitoNovo`, `comEfeitoMudado`...)
 * recusa com `null` o que a leitura descartaria: o que se grava sempre volta.
 */

export const VERSAO_DA_BIBLIOTECA_DE_SONS = 1
/** O arquivo da biblioteca, ao lado do `adventure.json`. Mora aqui (e não no disco) para `midiaDaPasta.ts` lê-lo sem ciclo de import. */
export const ARQUIVO_DE_SONS = 'sons.json'
/**
 * Teto do `sons.json`: 200 efeitos ocupam bem menos de 100 KB. Acima disto o
 * arquivo nem é lido (um de 2 GB derrubaria o app) e nada é regravado por cima.
 */
export const SONS_JSON_MAX_BYTES = 1024 * 1024
export const NOME_DE_SOM_MAX = 40
export const EFEITOS_DE_SOM_MAX = 200
/** Pastas de um nível só, em chips no topo da aba: 50 já não cabem numa olhada. */
export const PASTAS_DE_SOM_MAX = 50
/**
 * Quantas entradas cruas (válidas ou não) a leitura olha em cada lista do
 * `sons.json`: o teto de efeitos conta só os válidos, e um arquivo com
 * milhares de entradas tortas faria a leitura passar por todas.
 */
export const ENTRADAS_CRUAS_DE_SOM_MAX = 2000
export const VOLUME_DE_SOM_PADRAO = 0.8
export const NOME_DE_SOM_PADRAO = 'Som sem nome'

/** O id de 11 caracteres que o YouTube dá a cada vídeo. */
const FORMA_DO_VIDEO_DO_YOUTUBE = /^[A-Za-z0-9_-]{11}$/
/** Id de efeito e de pasta: curto e sem nada que vire caminho ou HTML. */
const FORMA_DO_ID = /^[A-Za-z0-9_-]{1,80}$/

export type AtalhoDeSom = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

declare const MARCA_DO_VIDEO_DO_YOUTUBE: unique symbol
/**
 * O id do vídeo JÁ conferido por `ehVideoDoYoutube`. A marca faz o tipo exigir
 * o validador: uma string solta não vira fonte de YouTube, e o endereço do
 * player (F6) nunca é montado a partir do que o mestre colou.
 */
export type VideoDoYoutube = string & { readonly [MARCA_DO_VIDEO_DO_YOUTUBE]: true }

export type FonteDoSom =
  /** `ref` = `midia:<sha256>.<mp3|ogg|wav|m4a>` (`lib/midia.ts`); `bytes` = tamanho do arquivo. */
  | { tipo: 'arquivo'; ref: string; bytes: number }
  /** `inicioS`: de onde o vídeo começa (e para onde o loop volta), em segundos. */
  | { tipo: 'youtube'; video: VideoDoYoutube; inicioS?: number }

export type FonteDeArquivo = Extract<FonteDoSom, { tipo: 'arquivo' }>

export interface EfeitoDeSom {
  id: string
  /** De 1 a 40 caracteres, aparado. Só do mestre: não vai pela rede. */
  nome: string
  fonte: FonteDoSom
  /** De 0 a 1; o volume final é este vezes o do aparelho. */
  volume: number
  /** Ambiente que se repete até o Parar. */
  loop: boolean
  /** `null` = fora de pasta. */
  pastaId: string | null
  favorito?: true
  /** Tecla de 1 a 9; única na biblioteca. */
  atalho?: AtalhoDeSom
  ordem: number
}

/** Um nível só: pasta não tem pasta dentro. */
export interface PastaDeSons {
  id: string
  nome: string
  ordem: number
}

export interface BibliotecaDeSons {
  versao: typeof VERSAO_DA_BIBLIOTECA_DE_SONS
  pastas: PastaDeSons[]
  /** No máximo `EFEITOS_DE_SOM_MAX`. */
  efeitos: EfeitoDeSom[]
}

/** Quem escuta o próximo clique (seletor do topo da aba Sons). Não é gravado: vale enquanto a aba está aberta. */
export type AlvoDosSons = { tipo: 'todos' } | { tipo: 'cena'; sceneId: string } | { tipo: 'escolhidos'; playerIds: string[] }

export function bibliotecaDeSonsVazia(): BibliotecaDeSons {
  return { versao: VERSAO_DA_BIBLIOTECA_DE_SONS, pastas: [], efeitos: [] }
}

export function novoIdDeSom(): string {
  return `som_${crypto.randomUUID()}`
}

export function novoIdDePastaDeSons(): string {
  return `pastasom_${crypto.randomUUID()}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Corta sem partir um emoji (par substituto) no meio. */
function cortado(valor: string, max: number): string {
  if (valor.length <= max) return valor
  const ultima = valor.charCodeAt(max - 1)
  return valor.slice(0, ultima >= 0xd800 && ultima <= 0xdbff ? max - 1 : max)
}

// ───────────────────────────────────────────────────────────────────────────
// Validadores
// ───────────────────────────────────────────────────────────────────────────

export function ehVideoDoYoutube(value: unknown): value is VideoDoYoutube {
  return typeof value === 'string' && FORMA_DO_VIDEO_DO_YOUTUBE.test(value)
}

export function ehAtalhoDeSom(value: unknown): value is AtalhoDeSom {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 9
}

function ehIdDeSom(value: unknown): value is string {
  return typeof value === 'string' && FORMA_DO_ID.test(value)
}

export function volumeDeSomValido(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

function ordemValida(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function tamanhoDeAudioValido(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MIDIA_AUDIO_MAX_BYTES
}

function inicioValido(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

/** O nome aparado; `null` quando fica vazio ou passa de 40 caracteres. */
export function nomeDeSomLimpo(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const nome = raw.trim()
  return nome.length >= 1 && nome.length <= NOME_DE_SOM_MAX ? nome : null
}

/** O nome do arquivo importado como nome do efeito: sem pasta e sem extensão, aparado e no teto; vazio vira o padrão. */
export function nomeDeSomDoArquivo(nomeDoArquivo: string): string {
  const semPasta = nomeDoArquivo.slice(Math.max(nomeDoArquivo.lastIndexOf('/'), nomeDoArquivo.lastIndexOf('\\')) + 1)
  const semExtensao = semPasta.replace(/\.[^.]*$/, '')
  return cortado(semExtensao.trim(), NOME_DE_SOM_MAX).trim() || NOME_DE_SOM_PADRAO
}

/** A fonte refeita campo a campo (o que sobra no objeto fica de fora); `null` = torta. */
export function fonteDoSomLida(value: unknown): FonteDoSom | null {
  if (!isRecord(value)) return null
  if (value.tipo === 'arquivo') {
    const { ref, bytes } = value
    return ehRefDeAudio(ref) && tamanhoDeAudioValido(bytes) ? { tipo: 'arquivo', ref, bytes } : null
  }
  if (value.tipo === 'youtube') {
    const { video, inicioS } = value
    if (!ehVideoDoYoutube(video)) return null
    // O início é opcional: o torto sai sozinho e o vídeo começa do zero, em vez de o efeito se perder por ele.
    return inicioValido(inicioS) ? { tipo: 'youtube', video, inicioS } : { tipo: 'youtube', video }
  }
  return null
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura do sons.json
// ───────────────────────────────────────────────────────────────────────────

/** Campo presente e com valor: `null` e ausente dizem o mesmo ("nenhum"). */
function temValor(value: unknown): boolean {
  return value !== undefined && value !== null
}

/** Pastas dentro de verdade: a lista vazia (ou nula) não põe nada dentro. */
function temPastasDentro(value: unknown): boolean {
  return temValor(value) && !(Array.isArray(value) && value.length === 0)
}

/**
 * Uma pasta. A que diz estar dentro de outra (`pastaId` ou `parentId` com
 * valor) ou traz pastas dentro (`pastas` não vazio) sai: a biblioteca tem um
 * nível só. `null` e lista vazia são da raiz.
 */
function pastaDeSonsLida(value: unknown): PastaDeSons | null {
  if (!isRecord(value) || !ehIdDeSom(value.id)) return null
  const dentroDeOutra = temValor(value.pastaId) || temValor(value.parentId) || temPastasDentro(value.pastas)
  const nome = nomeDeSomLimpo(value.nome)
  if (dentroDeOutra || nome === null || !ordemValida(value.ordem)) return null
  return { id: value.id, nome, ordem: value.ordem }
}

/**
 * Um efeito. Campo obrigatório torto (id, nome, fonte, volume, loop, ordem)
 * tira o efeito; o opcional torto sai sozinho. A pasta que não existe (ou foi
 * descartada) põe o efeito na raiz, em vez de perdê-lo.
 */
function efeitoDeSomLido(value: unknown, pastaIds: ReadonlySet<string>): EfeitoDeSom | null {
  if (!isRecord(value) || !ehIdDeSom(value.id)) return null
  const { volume, loop, ordem, pastaId } = value
  const nome = nomeDeSomLimpo(value.nome)
  const fonte = fonteDoSomLida(value.fonte)
  if (nome === null || fonte === null || !volumeDeSomValido(volume) || typeof loop !== 'boolean' || !ordemValida(ordem)) return null
  return {
    id: value.id,
    nome,
    fonte,
    volume,
    loop,
    pastaId: typeof pastaId === 'string' && pastaIds.has(pastaId) ? pastaId : null,
    ...(value.favorito === true ? { favorito: true } : {}),
    ...(ehAtalhoDeSom(value.atalho) ? { atalho: value.atalho } : {}),
    ordem,
  }
}

function semAtalho(efeito: EfeitoDeSom): EfeitoDeSom {
  const { atalho: _semUso, ...resto } = efeito
  return resto
}

/** A lista crua do `sons.json`, cortada antes de olhar cada entrada; o que não é lista vira vazia. */
function listaCrua(value: unknown): unknown[] {
  return Array.isArray(value) ? value.slice(0, ENTRADAS_CRUAS_DE_SOM_MAX) : []
}

export type TextoDaBiblioteca = { ok: true; biblioteca: BibliotecaDeSons } | { ok: false; motivo: 'ilegivel' | 'versao-mais-nova' }

/**
 * O `sons.json` como biblioteca. `ilegivel` = não é JSON de biblioteca;
 * `versao-mais-nova` = gravado por um app mais novo, que este não entende (e
 * não deve regravar por cima). Id repetido fica só o primeiro; atalho
 * repetido fica com o primeiro efeito, e o seguinte continua sem atalho.
 */
export function bibliotecaDoTexto(texto: string): TextoDaBiblioteca {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return { ok: false, motivo: 'ilegivel' }
  }
  if (!isRecord(bruto) || typeof bruto.versao !== 'number') return { ok: false, motivo: 'ilegivel' }
  if (bruto.versao > VERSAO_DA_BIBLIOTECA_DE_SONS) return { ok: false, motivo: 'versao-mais-nova' }
  if (bruto.versao !== VERSAO_DA_BIBLIOTECA_DE_SONS) return { ok: false, motivo: 'ilegivel' }

  const pastas: PastaDeSons[] = []
  const pastaIds = new Set<string>()
  for (const valor of listaCrua(bruto.pastas)) {
    if (pastas.length >= PASTAS_DE_SOM_MAX) break
    const pasta = pastaDeSonsLida(valor)
    if (pasta === null || pastaIds.has(pasta.id)) continue
    pastaIds.add(pasta.id)
    pastas.push(pasta)
  }

  const efeitos: EfeitoDeSom[] = []
  const efeitoIds = new Set<string>()
  const atalhos = new Set<AtalhoDeSom>()
  for (const valor of listaCrua(bruto.efeitos)) {
    if (efeitos.length >= EFEITOS_DE_SOM_MAX) break
    const efeito = efeitoDeSomLido(valor, pastaIds)
    if (efeito === null || efeitoIds.has(efeito.id)) continue
    efeitoIds.add(efeito.id)
    if (efeito.atalho === undefined) {
      efeitos.push(efeito)
    } else if (atalhos.has(efeito.atalho)) {
      efeitos.push(semAtalho(efeito))
    } else {
      atalhos.add(efeito.atalho)
      efeitos.push(efeito)
    }
  }
  return { ok: true, biblioteca: { versao: VERSAO_DA_BIBLIOTECA_DE_SONS, pastas, efeitos } }
}

export function serializarBiblioteca(biblioteca: BibliotecaDeSons): string {
  return `${JSON.stringify(biblioteca, null, 2)}\n`
}

/** Os ids de áudio que a pasta da aventura tem de levar (`lib/midiaDaPasta.ts`), sem repetir e em ordem. */
export function idsDeAudioDaBiblioteca(biblioteca: BibliotecaDeSons): string[] {
  const ids = new Set<string>()
  for (const efeito of biblioteca.efeitos) {
    if (efeito.fonte.tipo !== 'arquivo') continue
    const id = idDaRefDeAudio(efeito.fonte.ref)
    if (id !== null) ids.add(id)
  }
  return [...ids].sort()
}

/** Os áudios que um `sons.json` cita; `'todos'` = não dá para saber quais, então vale para qualquer áudio. */
export type AudiosCitados = ReadonlySet<string> | 'todos'

/**
 * Os áudios que o texto de um `sons.json` CITA, para a abertura NÃO os trazer
 * para `<appData>/midia` (`lib/midiaDaPasta.ts`): aquela pasta a sala serve em
 * `/media/{id}` sem chave, e o som da biblioteca só sai pela rota com chave
 * (`/sons/{id}`). Mais largo que `idsDeAudioDaBiblioteca` de propósito: conta
 * todo texto com forma de id ou de referência de áudio, inclusive no efeito
 * torto que a leitura descartaria. Na dúvida é `'todos'`: texto que não é JSON
 * e versão mais nova (a forma nova pode guardar o áudio de outro jeito).
 */
export function audiosCitadosNoTexto(texto: string): AudiosCitados {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return 'todos'
  }
  if (isRecord(bruto) && typeof bruto.versao === 'number' && bruto.versao > VERSAO_DA_BIBLIOTECA_DE_SONS) return 'todos'
  const ids = new Set<string>()
  // Pilha, não recursão: o JSON aninhado fundo (cabe em 1 MB) estouraria a pilha de chamadas.
  const pendentes: unknown[] = [bruto]
  while (pendentes.length > 0) {
    const valor = pendentes.pop()
    if (typeof valor === 'string') {
      const id = ehIdDeAudio(valor) ? valor : idDaRefDeAudio(valor)
      if (id !== null) ids.add(id)
    } else if (Array.isArray(valor)) {
      for (const item of valor) pendentes.push(item)
    } else if (isRecord(valor)) {
      for (const [chave, item] of Object.entries(valor)) pendentes.push(chave, item)
    }
  }
  return ids
}

// ───────────────────────────────────────────────────────────────────────────
// Mudanças (puras: devolvem a biblioteca nova, ou `null` = recusada)
// ───────────────────────────────────────────────────────────────────────────

function proximaOrdem(itens: readonly { ordem: number }[]): number {
  return itens.reduce((maior, item) => Math.max(maior, item.ordem + 1), 0)
}

function pastaExiste(biblioteca: BibliotecaDeSons, pastaId: string | null): boolean {
  return pastaId === null || biblioteca.pastas.some((pasta) => pasta.id === pastaId)
}

export interface EfeitoNovo {
  nome: string
  fonte: FonteDoSom
  /** Padrão `VOLUME_DE_SOM_PADRAO`. */
  volume?: number
  loop?: boolean
  pastaId?: string | null
}

/** Um efeito a mais, no fim. Recusa nome, volume, fonte ou pasta inválidos, e o que passaria de 200. */
export function comEfeitoNovo(
  biblioteca: BibliotecaDeSons,
  novo: EfeitoNovo,
  id: string = novoIdDeSom(),
): { biblioteca: BibliotecaDeSons; efeito: EfeitoDeSom } | null {
  const nome = nomeDeSomLimpo(novo.nome)
  // A fonte é conferida de novo: o tipo garante a forma, não que a referência tenha a forma de áudio.
  const fonte = fonteDoSomLida(novo.fonte)
  const volume = novo.volume ?? VOLUME_DE_SOM_PADRAO
  const pastaId = novo.pastaId ?? null
  if (biblioteca.efeitos.length >= EFEITOS_DE_SOM_MAX || !ehIdDeSom(id) || biblioteca.efeitos.some((efeito) => efeito.id === id)) return null
  if (nome === null || fonte === null || !volumeDeSomValido(volume) || !pastaExiste(biblioteca, pastaId)) return null
  const efeito: EfeitoDeSom = { id, nome, fonte, volume, loop: novo.loop === true, pastaId, ordem: proximaOrdem(biblioteca.efeitos) }
  return { biblioteca: { ...biblioteca, efeitos: [...biblioteca.efeitos, efeito] }, efeito }
}

export interface MudancaNoEfeito {
  nome?: string
  volume?: number
  loop?: boolean
  pastaId?: string | null
  favorito?: boolean
  /** `null` tira o atalho. Dar um atalho que outro efeito tem TIRA dele: o atalho é único. */
  atalho?: AtalhoDeSom | null
}

/** O efeito com a mudança aplicada; recusa o efeito que não existe e qualquer campo inválido (nada muda pela metade). */
export function comEfeitoMudado(biblioteca: BibliotecaDeSons, id: string, mudanca: MudancaNoEfeito): BibliotecaDeSons | null {
  const atual = biblioteca.efeitos.find((efeito) => efeito.id === id)
  if (atual === undefined) return null
  const nome = mudanca.nome === undefined ? atual.nome : nomeDeSomLimpo(mudanca.nome)
  const volume = mudanca.volume ?? atual.volume
  const pastaId = mudanca.pastaId === undefined ? atual.pastaId : mudanca.pastaId
  if (nome === null || !volumeDeSomValido(volume) || !pastaExiste(biblioteca, pastaId)) return null
  if (mudanca.atalho !== undefined && mudanca.atalho !== null && !ehAtalhoDeSom(mudanca.atalho)) return null

  const favorito = mudanca.favorito === undefined ? atual.favorito === true : mudanca.favorito
  const atalho = mudanca.atalho === undefined ? atual.atalho : (mudanca.atalho ?? undefined)
  const mudado: EfeitoDeSom = {
    id: atual.id,
    nome,
    fonte: atual.fonte,
    volume,
    loop: mudanca.loop ?? atual.loop,
    pastaId,
    ...(favorito ? { favorito: true } : {}),
    ...(atalho !== undefined ? { atalho } : {}),
    ordem: atual.ordem,
  }
  const efeitos = biblioteca.efeitos.map((efeito) => {
    if (efeito.id === id) return mudado
    return atalho !== undefined && efeito.atalho === atalho ? semAtalho(efeito) : efeito
  })
  return { ...biblioteca, efeitos }
}

export function semEfeito(biblioteca: BibliotecaDeSons, id: string): BibliotecaDeSons | null {
  if (!biblioteca.efeitos.some((efeito) => efeito.id === id)) return null
  return { ...biblioteca, efeitos: biblioteca.efeitos.filter((efeito) => efeito.id !== id) }
}

export function comPastaNova(
  biblioteca: BibliotecaDeSons,
  nomeBruto: string,
  id: string = novoIdDePastaDeSons(),
): { biblioteca: BibliotecaDeSons; pasta: PastaDeSons } | null {
  const nome = nomeDeSomLimpo(nomeBruto)
  if (biblioteca.pastas.length >= PASTAS_DE_SOM_MAX) return null
  if (nome === null || !ehIdDeSom(id) || biblioteca.pastas.some((pasta) => pasta.id === id)) return null
  const pasta: PastaDeSons = { id, nome, ordem: proximaOrdem(biblioteca.pastas) }
  return { biblioteca: { ...biblioteca, pastas: [...biblioteca.pastas, pasta] }, pasta }
}

export function comPastaRenomeada(biblioteca: BibliotecaDeSons, id: string, nomeBruto: string): BibliotecaDeSons | null {
  const nome = nomeDeSomLimpo(nomeBruto)
  if (nome === null || !biblioteca.pastas.some((pasta) => pasta.id === id)) return null
  return { ...biblioteca, pastas: biblioteca.pastas.map((pasta) => (pasta.id === id ? { ...pasta, nome } : pasta)) }
}

/** Apaga a pasta; os efeitos dela vão para a raiz (apagar pasta não apaga som). */
export function semPasta(biblioteca: BibliotecaDeSons, id: string): BibliotecaDeSons | null {
  if (!biblioteca.pastas.some((pasta) => pasta.id === id)) return null
  return {
    ...biblioteca,
    pastas: biblioteca.pastas.filter((pasta) => pasta.id !== id),
    efeitos: biblioteca.efeitos.map((efeito) => (efeito.pastaId === id ? { ...efeito, pastaId: null } : efeito)),
  }
}
