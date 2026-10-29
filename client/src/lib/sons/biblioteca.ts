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
/**
 * Teto dos segundos de um trecho (A e B): uma semana, o mesmo teto do
 * `deslocamentoS` da rede (`SOM_DESLOCAMENTO_MAX_S` em `net/protocol.ts`).
 * Acima disso o `som.tocar` seria recusado inteiro no jogador.
 */
export const TRECHO_MAX_S = 7 * 24 * 60 * 60

/**
 * As duas partes da aba Sons: Músicas (ambiente, tema de batalha) e Efeitos
 * sonoros (porta, espada). No `sons.json` só a música é marcada (`parte:
 * 'musicas'`); sem a marca é efeito, e assim todo som e toda pasta de antes
 * (que não tinham parte) entram em Efeitos sonoros sem migração.
 */
export type ParteDosSons = 'musicas' | 'efeitos'
export const PARTES_DOS_SONS: readonly ParteDosSons[] = ['musicas', 'efeitos']

/**
 * As categorias que cada parte ganha uma vez (`comCategoriasSugeridas`). O
 * mestre renomeia ou apaga; apagada, não volta (`categoriasSugeridas` fica
 * gravado no `sons.json`).
 */
export const CATEGORIAS_SUGERIDAS: Readonly<Record<ParteDosSons, readonly string[]>> = {
  musicas: ['Ambiente', 'Batalha', 'Taverna'],
  efeitos: ['Combate', 'Magia', 'Natureza'],
}

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
  /**
   * `ref` = `midia:<sha256>.<mp3|ogg|wav|m4a>` (`lib/midia.ts`); `bytes` =
   * tamanho do arquivo. `inicioS` e `fimS` (29/10/2026): o trecho de A até B,
   * como no YouTube; ausentes = o som inteiro. Campos novos na mesma versão 1:
   * o app anterior lê a fonte campo a campo e toca o som inteiro.
   */
  | { tipo: 'arquivo'; ref: string; bytes: number; inicioS?: number; fimS?: number }
  /**
   * `inicioS`: de onde o vídeo começa (e para onde o loop volta), em segundos.
   * `fimS` (F6): onde para (ou de onde o loop volta), sempre depois do início;
   * ausente = até o fim do vídeo. Campo novo na mesma versão 1: o app anterior
   * à F6 lê a fonte campo a campo e só deixa o `fimS` de fora.
   */
  | { tipo: 'youtube'; video: VideoDoYoutube; inicioS?: number; fimS?: number }

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
  /** `null` = fora de pasta. A pasta (categoria) é sempre da mesma parte do som. */
  pastaId: string | null
  /** Ausente = efeito sonoro (todo som de antes de 29/10/2026). */
  parte?: 'musicas'
  favorito?: true
  /** Tecla de 1 a 9; única na biblioteca. */
  atalho?: AtalhoDeSom
  ordem: number
}

/** Um nível só: pasta não tem pasta dentro. Na tela, é a CATEGORIA de uma das partes. */
export interface PastaDeSons {
  id: string
  nome: string
  ordem: number
  /** Ausente = categoria de Efeitos sonoros (toda pasta de antes de 29/10/2026). */
  parte?: 'musicas'
}

export interface BibliotecaDeSons {
  versao: typeof VERSAO_DA_BIBLIOTECA_DE_SONS
  /** As categorias sugeridas já entraram uma vez: apagadas, não voltam. */
  categoriasSugeridas?: true
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

/** A parte de um som ou de uma categoria: sem a marca de música, é efeito. */
export function parteDe(item: { readonly parte?: 'musicas' }): ParteDosSons {
  return item.parte === 'musicas' ? 'musicas' : 'efeitos'
}

/** A marca de parte como fica no objeto: só a música é escrita. */
function marcaDaParte(parte: ParteDosSons): { parte?: 'musicas' } {
  return parte === 'musicas' ? { parte: 'musicas' } : {}
}

/** O trecho de A até B de qualquer fonte; `fimS` ausente = até o fim do som. */
export function trechoDaFonte(fonte: FonteDoSom): { inicioS: number; fimS: number | undefined } {
  return { inicioS: fonte.inicioS ?? 0, fimS: fonte.fimS }
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
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= TRECHO_MAX_S
}

/** O fim do trecho: número finito e depois do início (fim igual ao início não toca nada). */
function fimValido(value: unknown, inicioS: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > inicioS && value <= TRECHO_MAX_S
}

/** Início e fim lidos de um objeto: o torto sai sozinho (o som vai do zero, ou até o fim), em vez de o efeito se perder por ele. */
function trechoLido(inicioS: unknown, fimS: unknown): { inicioS?: number; fimS?: number } {
  const inicio = inicioValido(inicioS) ? inicioS : undefined
  const fim = fimValido(fimS, inicio ?? 0) ? fimS : undefined
  return { ...(inicio === undefined ? {} : { inicioS: inicio }), ...(fim === undefined ? {} : { fimS: fim }) }
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
    return ehRefDeAudio(ref) && tamanhoDeAudioValido(bytes) ? { tipo: 'arquivo', ref, bytes, ...trechoLido(value.inicioS, value.fimS) } : null
  }
  if (value.tipo === 'youtube') {
    const { video } = value
    if (!ehVideoDoYoutube(video)) return null
    return { tipo: 'youtube', video, ...trechoLido(value.inicioS, value.fimS) }
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
 * nível só. `null` e lista vazia são da raiz. A parte que não é `'musicas'`
 * (ausente, ou torta) é Efeitos sonoros: a pasta de antes da divisão fica lá.
 */
function pastaDeSonsLida(value: unknown): PastaDeSons | null {
  if (!isRecord(value) || !ehIdDeSom(value.id)) return null
  const dentroDeOutra = temValor(value.pastaId) || temValor(value.parentId) || temPastasDentro(value.pastas)
  const nome = nomeDeSomLimpo(value.nome)
  if (dentroDeOutra || nome === null || !ordemValida(value.ordem)) return null
  return { id: value.id, nome, ordem: value.ordem, ...(value.parte === 'musicas' ? { parte: 'musicas' } : {}) }
}

/**
 * Um efeito. Campo obrigatório torto (id, nome, fonte, volume, loop, ordem)
 * tira o efeito; o opcional torto sai sozinho. A pasta que não existe (ou foi
 * descartada) põe o efeito na raiz, em vez de perdê-lo. A parte: a do som
 * (sem marca = efeito); com categoria, a da categoria, que é quem o mestre vê
 * agrupando (o `sons.json` editado à mão com as duas em desacordo).
 */
function efeitoDeSomLido(value: unknown, partesDasPastas: ReadonlyMap<string, ParteDosSons>): EfeitoDeSom | null {
  if (!isRecord(value) || !ehIdDeSom(value.id)) return null
  const { volume, loop, ordem, pastaId } = value
  const nome = nomeDeSomLimpo(value.nome)
  const fonte = fonteDoSomLida(value.fonte)
  if (nome === null || fonte === null || !volumeDeSomValido(volume) || typeof loop !== 'boolean' || !ordemValida(ordem)) return null
  const parteDaPasta = typeof pastaId === 'string' ? partesDasPastas.get(pastaId) : undefined
  const parte: ParteDosSons = parteDaPasta ?? (value.parte === 'musicas' ? 'musicas' : 'efeitos')
  return {
    id: value.id,
    nome,
    fonte,
    volume,
    loop,
    pastaId: parteDaPasta === undefined ? null : (pastaId as string),
    ...marcaDaParte(parte),
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
  const partesDasPastas = new Map<string, ParteDosSons>()
  for (const valor of listaCrua(bruto.pastas)) {
    if (pastas.length >= PASTAS_DE_SOM_MAX) break
    const pasta = pastaDeSonsLida(valor)
    if (pasta === null || partesDasPastas.has(pasta.id)) continue
    partesDasPastas.set(pasta.id, parteDe(pasta))
    pastas.push(pasta)
  }

  const efeitos: EfeitoDeSom[] = []
  const efeitoIds = new Set<string>()
  const atalhos = new Set<AtalhoDeSom>()
  for (const valor of listaCrua(bruto.efeitos)) {
    if (efeitos.length >= EFEITOS_DE_SOM_MAX) break
    const efeito = efeitoDeSomLido(valor, partesDasPastas)
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
  const sugeridas = bruto.categoriasSugeridas === true ? { categoriasSugeridas: true as const } : {}
  return { ok: true, biblioteca: { versao: VERSAO_DA_BIBLIOTECA_DE_SONS, ...sugeridas, pastas, efeitos } }
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

/** A pasta existe e é da `parte` (o som e a categoria dele moram sempre na mesma parte). `null` = sem categoria. */
function pastaDaParte(biblioteca: BibliotecaDeSons, pastaId: string | null, parte: ParteDosSons): boolean {
  return pastaId === null || biblioteca.pastas.some((pasta) => pasta.id === pastaId && parteDe(pasta) === parte)
}

/** O trecho de A até B que a tela pede; `null` = o som inteiro. */
export interface TrechoDoSom {
  inicioS: number
  /** Ausente = até o fim do som. */
  fimS?: number
}

/** A fonte com o trecho novo (`null` tira); `null` = trecho torto (B antes de A, negativo, acima do teto). Início 0 não é escrito. */
function fonteComTrecho(fonte: FonteDoSom, trecho: TrechoDoSom | null): FonteDoSom | null {
  if (trecho !== null && (!inicioValido(trecho.inicioS) || (trecho.fimS !== undefined && !fimValido(trecho.fimS, trecho.inicioS)))) return null
  const marcas = trecho === null ? {} : { ...(trecho.inicioS > 0 ? { inicioS: trecho.inicioS } : {}), ...(trecho.fimS === undefined ? {} : { fimS: trecho.fimS }) }
  return fonte.tipo === 'arquivo' ? { tipo: 'arquivo', ref: fonte.ref, bytes: fonte.bytes, ...marcas } : { tipo: 'youtube', video: fonte.video, ...marcas }
}

export interface EfeitoNovo {
  nome: string
  fonte: FonteDoSom
  /** Padrão `VOLUME_DE_SOM_PADRAO`. */
  volume?: number
  loop?: boolean
  pastaId?: string | null
  /** Padrão: a parte da categoria, ou Efeitos sonoros sem categoria. */
  parte?: ParteDosSons
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
  const pasta = pastaId === null ? undefined : biblioteca.pastas.find((candidata) => candidata.id === pastaId)
  const parte = novo.parte ?? (pasta === undefined ? 'efeitos' : parteDe(pasta))
  if (biblioteca.efeitos.length >= EFEITOS_DE_SOM_MAX || !ehIdDeSom(id) || biblioteca.efeitos.some((efeito) => efeito.id === id)) return null
  if (nome === null || fonte === null || !volumeDeSomValido(volume) || !pastaDaParte(biblioteca, pastaId, parte)) return null
  const efeito: EfeitoDeSom = { id, nome, fonte, volume, loop: novo.loop === true, pastaId, ...marcaDaParte(parte), ordem: proximaOrdem(biblioteca.efeitos) }
  return { biblioteca: { ...biblioteca, efeitos: [...biblioteca.efeitos, efeito] }, efeito }
}

export interface MudancaNoEfeito {
  nome?: string
  volume?: number
  loop?: boolean
  pastaId?: string | null
  /** Mudar de parte sem dizer a categoria tira o som da categoria (ela é da outra parte). */
  parte?: ParteDosSons
  /** O trecho de A até B; `null` = o som inteiro. */
  trecho?: TrechoDoSom | null
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
  const parte = mudanca.parte ?? parteDe(atual)
  const trocouDeParte = parte !== parteDe(atual)
  const pastaId = mudanca.pastaId !== undefined ? mudanca.pastaId : trocouDeParte ? null : atual.pastaId
  const fonte = mudanca.trecho === undefined ? atual.fonte : fonteComTrecho(atual.fonte, mudanca.trecho)
  if (nome === null || fonte === null || !volumeDeSomValido(volume) || !pastaDaParte(biblioteca, pastaId, parte)) return null
  if (mudanca.atalho !== undefined && mudanca.atalho !== null && !ehAtalhoDeSom(mudanca.atalho)) return null

  const favorito = mudanca.favorito === undefined ? atual.favorito === true : mudanca.favorito
  const atalho = mudanca.atalho === undefined ? atual.atalho : (mudanca.atalho ?? undefined)
  const mudado: EfeitoDeSom = {
    id: atual.id,
    nome,
    fonte,
    volume,
    loop: mudanca.loop ?? atual.loop,
    pastaId,
    ...marcaDaParte(parte),
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

/** Uma categoria a mais, no fim da `parte` (padrão: Efeitos sonoros). Recusa nome inválido, id repetido e a 51ª. */
export function comPastaNova(
  biblioteca: BibliotecaDeSons,
  nomeBruto: string,
  id: string = novoIdDePastaDeSons(),
  parte: ParteDosSons = 'efeitos',
): { biblioteca: BibliotecaDeSons; pasta: PastaDeSons } | null {
  const nome = nomeDeSomLimpo(nomeBruto)
  if (biblioteca.pastas.length >= PASTAS_DE_SOM_MAX) return null
  if (nome === null || !ehIdDeSom(id) || biblioteca.pastas.some((pasta) => pasta.id === id)) return null
  const pasta: PastaDeSons = { id, nome, ordem: proximaOrdem(biblioteca.pastas), ...marcaDaParte(parte) }
  return { biblioteca: { ...biblioteca, pastas: [...biblioteca.pastas, pasta] }, pasta }
}

/** Nome para comparar categorias: sem caixa e aparado ("ambiente " é a mesma que "Ambiente"). */
function nomeComparavel(nome: string): string {
  return nome.trim().toLocaleLowerCase('pt-BR')
}

/**
 * As categorias sugeridas (`CATEGORIAS_SUGERIDAS`), UMA vez por biblioteca:
 * cada parte ganha as dela que ainda não tem com o mesmo nome (Batalha em
 * Efeitos não impede Batalha em Músicas), até o teto de pastas, e a marca
 * `categoriasSugeridas` impede a volta da que o mestre apagar. Com a marca,
 * devolve a mesma biblioteca. Quem chama é a loja, ao abrir a biblioteca
 * gravável; o disco só recebe as sugestões na próxima gravação.
 */
export function comCategoriasSugeridas(biblioteca: BibliotecaDeSons, novoId: () => string = novoIdDePastaDeSons): BibliotecaDeSons {
  if (biblioteca.categoriasSugeridas === true) return biblioteca
  let atual: BibliotecaDeSons = { ...biblioteca, categoriasSugeridas: true }
  for (const parte of PARTES_DOS_SONS) {
    const existentes = new Set(atual.pastas.filter((pasta) => parteDe(pasta) === parte).map((pasta) => nomeComparavel(pasta.nome)))
    for (const nome of CATEGORIAS_SUGERIDAS[parte]) {
      if (existentes.has(nomeComparavel(nome))) continue
      const resultado = comPastaNova(atual, nome, novoId(), parte)
      if (resultado === null) break
      atual = resultado.biblioteca
    }
  }
  return atual
}

/**
 * O que faz dois sons serem o MESMO som na migração para a biblioteca global:
 * o mesmo arquivo (o id do áudio é o hash do conteúdo) ou o mesmo vídeo do
 * YouTube, com o mesmo trecho de A até B. O trecho conta: dois botões do mesmo
 * vídeo longo em minutos diferentes são dois sons, e juntá-los perderia um.
 */
export function chaveDoSom(fonte: FonteDoSom): string {
  const trecho = `${fonte.inicioS ?? 0}-${fonte.fimS ?? 'fim'}`
  return fonte.tipo === 'arquivo' ? `arquivo:${idDaRefDeAudio(fonte.ref) ?? fonte.ref}:${trecho}` : `youtube:${fonte.video}:${trecho}`
}

export interface BibliotecasJuntadas {
  biblioteca: BibliotecaDeSons
  /** Sons da origem que entraram agora. */
  entraram: number
  /** Sons da origem que o destino já tinha (`chaveDoSom`). */
  repetidos: number
  /** Sons que não entraram porque o destino chegou a `EFEITOS_DE_SOM_MAX`. */
  naoCouberam: number
}

/**
 * A biblioteca de uma aventura (`origem`) dentro da global (`destino`), sem
 * repetir. Categoria: a de mesmo nome e mesma parte que o destino já tem
 * (sem caixa, aparada), senão uma nova no fim; acima do teto de pastas, o som
 * vai sem categoria. Som: o que o destino já tem (`chaveDoSom`) não entra de
 * novo; o novo leva nome, volume, repetir, parte, trecho e favorito, mantém o
 * id quando ele está livre (senão ganha outro), e o atalho só se nenhum som do
 * destino já o usa. A marca `categoriasSugeridas` de qualquer um dos dois
 * fica: a categoria sugerida que o mestre apagou na aventura não volta.
 */
export function comBibliotecaJuntada(
  destino: BibliotecaDeSons,
  origem: BibliotecaDeSons,
  novoIdDePasta: () => string = novoIdDePastaDeSons,
  novoIdDeEfeito: () => string = novoIdDeSom,
): BibliotecasJuntadas {
  let atual: BibliotecaDeSons = destino.categoriasSugeridas === true || origem.categoriasSugeridas === true ? { ...destino, categoriasSugeridas: true } : destino
  const pastaNoDestino = new Map<string, string | null>()
  for (const pasta of [...origem.pastas].sort((a, b) => a.ordem - b.ordem)) {
    const parte = parteDe(pasta)
    const igual = atual.pastas.find((candidata) => parteDe(candidata) === parte && nomeComparavel(candidata.nome) === nomeComparavel(pasta.nome))
    if (igual !== undefined) {
      pastaNoDestino.set(pasta.id, igual.id)
      continue
    }
    const livre = !atual.pastas.some((candidata) => candidata.id === pasta.id)
    const criada = comPastaNova(atual, pasta.nome, livre ? pasta.id : novoIdDePasta(), parte)
    pastaNoDestino.set(pasta.id, criada === null ? null : criada.pasta.id)
    if (criada !== null) atual = criada.biblioteca
  }

  const chaves = new Set(atual.efeitos.map((efeito) => chaveDoSom(efeito.fonte)))
  let entraram = 0
  let repetidos = 0
  let naoCouberam = 0
  for (const efeito of [...origem.efeitos].sort((a, b) => a.ordem - b.ordem)) {
    const chave = chaveDoSom(efeito.fonte)
    if (chaves.has(chave)) {
      repetidos += 1
      continue
    }
    const livre = !atual.efeitos.some((candidato) => candidato.id === efeito.id)
    const pastaId = efeito.pastaId === null ? null : (pastaNoDestino.get(efeito.pastaId) ?? null)
    const novo = comEfeitoNovo(atual, { nome: efeito.nome, fonte: efeito.fonte, volume: efeito.volume, loop: efeito.loop, pastaId, parte: parteDe(efeito) }, livre ? efeito.id : novoIdDeEfeito())
    if (novo === null) {
      naoCouberam += 1
      continue
    }
    const atalhoLivre = efeito.atalho !== undefined && !atual.efeitos.some((candidato) => candidato.atalho === efeito.atalho)
    const marcas: MudancaNoEfeito = { ...(efeito.favorito === true ? { favorito: true } : {}), ...(atalhoLivre ? { atalho: efeito.atalho } : {}) }
    atual = Object.keys(marcas).length === 0 ? novo.biblioteca : (comEfeitoMudado(novo.biblioteca, novo.efeito.id, marcas) ?? novo.biblioteca)
    chaves.add(chave)
    entraram += 1
  }
  return { biblioteca: atual, entraram, repetidos, naoCouberam }
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
