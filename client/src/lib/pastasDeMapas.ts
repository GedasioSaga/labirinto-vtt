import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { ADVENTURE_FILE, parseAdventure } from './adventure'
import { defaultMapsDir, ensureDir, mapDirFor, writeTextFileSafely } from './mapFileIO'
import { levarMidiaParaAPasta, pastaDaMidiaDaAventura, PASTA_DE_MIDIA_DA_AVENTURA, trazerMidiaDaPasta } from './midiaDaPasta'
import { personagensDoArquivo, sistemaDaAventuraDoArquivo, type Personagem } from './personagem'
import { equipesDoArquivo, type Equipe } from './batalha/equipes'
import { useToastStore } from '../stores/toastStore'

/**
 * PASTAS DE MAPAS — a organização do "Carregar Mapa" (pedido do usuário em
 * PEDIDOS.md): o mestre junta mapas e aventuras em pastas, e a pasta pode ter
 * um "Sistema universal" e os "Jogadores principais" — UMA cópia só, que todo
 * mapa da pasta usa (o HP perdido no Reino de Goa continua perdido na Sky
 * Lagoon). Cada mapa pode preferir o próprio ("Configurar só neste mapa"):
 * aí vale o sistema e os personagens do `adventure.json` dele, como sempre.
 *
 * Mora em `<appData>`, como a biblioteca de sistemas e o acervo de tokens: é
 * a organização do mestre neste computador, não conteúdo do mapa — o mapa
 * levado a outra máquina abre com o que é dele.
 *
 *   <appData>/pastas/indice.json      as pastas e o lugar de cada mapa
 *   <appData>/pastas/<id>/rpg.json    o sistema universal e os personagens
 *   <appData>/pastas/<id>/midia/      a cópia da mídia das fichas
 *
 * O mapa é conhecido pela pasta dele em `<appData>/maps` (a CHAVE): é o `id`
 * da lista do Carregar Mapa e não muda ao renomear. Mapa de fora de `maps`
 * (aberto pelo "Procurar no disco…") não entra em pasta.
 *
 * Leitura tolerante (o que não se entende fica de fora, nunca derruba a
 * tela) e gravação por `writeTextFileSafely` com a cópia de antes em
 * `.anterior`, como o índice do acervo (`lib/tokenLibrary.ts`).
 */

const PASTA_DAS_PASTAS = 'pastas'
const ARQUIVO_DO_INDICE = 'indice.json'
const ARQUIVO_DO_RPG = 'rpg.json'
const SUFIXO_ANTERIOR = '.anterior'
const VERSAO = 1

/** Teto do nome da pasta, em caracteres: é título de linha, não texto. */
export const NOME_DA_PASTA_MAX = 60
export const PASTA_SEM_NOME = 'Pasta sem nome'

export interface PastaDeMapas {
  id: string
  nome: string
  /** Recolhida na lista: só o título aparece. Ausente = aberta. */
  recolhida?: true
}

export interface LugarDoMapa {
  /** A pasta do mapa em `<appData>/maps`. */
  chave: string
  pastaId: string
  /** "Configurar só neste mapa": usa o próprio sistema e personagens. Ausente = usa o da pasta. */
  proprio?: true
}

export interface IndiceDasPastas {
  pastas: PastaDeMapas[]
  /** Mapa sem lugar aqui está fora das pastas. Lista, e não objeto: a chave vem do disco e não vira nome de propriedade. */
  mapas: LugarDoMapa[]
}

export interface RpgDaPasta {
  /** O "Sistema universal": id de um sistema da biblioteca. Ausente = a pasta só organiza, cada mapa usa o próprio. */
  sistemaDeRpg?: string
  /** Os "Jogadores principais": a cópia ÚNICA que todo mapa da pasta usa. */
  personagens: Personagem[]
  /** BATALHA F1: as equipes seguem os personagens (decisão Q5). Ausente = sem equipes. */
  equipes?: Equipe[]
  /**
   * MOCHILA NA FICHA (docs/planos/lobby-jogadores-2026-11-05.md §4.2): a
   * versão da migração que já trouxe a mochila e a bolsa dos bonecos para as
   * fichas desta pasta (hoje, 1). Mora na PASTA, e não em cada ficha, porque a
   * mochila vazia nem é gravada (`readCarriedItems`): toda ficha da pasta conta
   * como migrada, inclusive a criada depois. Ausente = ainda não migrada.
   */
  mochilaMigrada?: number
  /** TREINO DO LOBBY (plano do Lobby §8.2, T8): os NPCs que o mestre liberou. Ausente = nenhum. */
  treino?: TreinoDaPasta
}

/**
 * Os inimigos do treino moram na PASTA, como lista de ids, e não num campo do
 * personagem: liberar não muda a ficha (nem vira op do Lobby), e o NPC que
 * sai da pasta simplesmente deixa de achar o id dele aqui.
 */
export interface TreinoDaPasta {
  inimigosLiberados: string[]
}

/** Teto da lista no disco: mais que isso é arquivo mexido à mão. */
const INIMIGOS_LIBERADOS_MAX = 500
const ID_DO_PERSONAGEM_MAX = 200

/** A pasta do mapa aberto, como o editor a usa (`stores/adventureStore.ts`). */
export interface PastaAberta extends RpgDaPasta {
  chave: string
  pastaId: string
  nome: string
  /** "Configurar só neste mapa" ligado. */
  proprio: boolean
}

export const INDICE_VAZIO: IndiceDasPastas = { pastas: [], mapas: [] }
export const RPG_VAZIO: RpgDaPasta = { personagens: [] }

// ───────────────────────────────────────────────────────────────────────────
// Regras puras
// ───────────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** O id vira nome de pasta no disco: só o formato que o app gera passa. */
const ID_DE_PASTA = /^pasta_[A-Za-z0-9-]{1,64}$/

export function idDePastaValido(valor: unknown): valor is string {
  return typeof valor === 'string' && ID_DE_PASTA.test(valor)
}

export function novoIdDePasta(): string {
  return `pasta_${crypto.randomUUID()}`
}

/** A chave é o nome de UMA pasta (`mapDirFor` ainda confere ao montar o caminho). */
function chaveValida(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= 200 && !/[\\/]/.test(valor) && valor !== '.' && valor !== '..'
}

/** Sem espaço nas pontas, no teto sem partir emoji (conta por caractere, não por unidade UTF-16); vazio vira "Pasta sem nome". */
export function limparNomeDaPasta(bruto: string): string {
  const nome = Array.from(bruto.trim()).slice(0, NOME_DA_PASTA_MAX).join('').trim()
  return nome.length > 0 ? nome : PASTA_SEM_NOME
}

/**
 * O índice como veio do disco. Pasta sem id válido sai (não haveria onde
 * guardar o RPG dela); id repetido: a primeira vence. Lugar de mapa que
 * aponta para pasta que não existe sai — o mapa volta para fora das pastas,
 * nunca some da lista.
 */
export function indiceDoArquivo(valor: unknown): IndiceDasPastas {
  if (!isRecord(valor)) return INDICE_VAZIO
  const pastas: PastaDeMapas[] = []
  const ids = new Set<string>()
  for (const bruta of Array.isArray(valor.pastas) ? valor.pastas : []) {
    if (!isRecord(bruta) || !idDePastaValido(bruta.id) || ids.has(bruta.id)) continue
    ids.add(bruta.id)
    const nome = limparNomeDaPasta(typeof bruta.nome === 'string' ? bruta.nome : '')
    pastas.push(bruta.recolhida === true ? { id: bruta.id, nome, recolhida: true } : { id: bruta.id, nome })
  }
  const mapas: LugarDoMapa[] = []
  const chaves = new Set<string>()
  for (const bruto of Array.isArray(valor.mapas) ? valor.mapas : []) {
    if (!isRecord(bruto) || !chaveValida(bruto.chave) || chaves.has(bruto.chave)) continue
    if (typeof bruto.pastaId !== 'string' || !ids.has(bruto.pastaId)) continue
    chaves.add(bruto.chave)
    mapas.push(bruto.proprio === true ? { chave: bruto.chave, pastaId: bruto.pastaId, proprio: true } : { chave: bruto.chave, pastaId: bruto.pastaId })
  }
  return { pastas, mapas }
}

/** `null` = o texto não é JSON (arquivo danificado): quem chama decide se tenta a cópia anterior. */
function indiceDoTexto(texto: string): IndiceDasPastas | null {
  try {
    return indiceDoArquivo(JSON.parse(texto))
  } catch {
    return null
  }
}

export function serializarIndice(indice: IndiceDasPastas): string {
  return JSON.stringify({ versao: VERSAO, pastas: indice.pastas, mapas: indice.mapas }, null, 2)
}

export function criarPasta(indice: IndiceDasPastas, nome: string): { indice: IndiceDasPastas; pasta: PastaDeMapas } {
  const pasta: PastaDeMapas = { id: novoIdDePasta(), nome: limparNomeDaPasta(nome) }
  return { indice: { ...indice, pastas: [...indice.pastas, pasta] }, pasta }
}

export function renomearPasta(indice: IndiceDasPastas, pastaId: string, nome: string): IndiceDasPastas {
  return { ...indice, pastas: indice.pastas.map((pasta) => (pasta.id === pastaId ? { ...pasta, nome: limparNomeDaPasta(nome) } : pasta)) }
}

/**
 * Tira a pasta da lista. Os mapas dela SAEM da pasta e ficam na lista (nada
 * é apagado do disco); o RPG dela fica em `<appData>/pastas/<id>` — quem
 * chama não apaga nada, e cada mapa volta a usar o próprio sistema e personagens.
 */
export function apagarPasta(indice: IndiceDasPastas, pastaId: string): IndiceDasPastas {
  return { pastas: indice.pastas.filter((pasta) => pasta.id !== pastaId), mapas: indice.mapas.filter((lugar) => lugar.pastaId !== pastaId) }
}

export function alternarRecolhida(indice: IndiceDasPastas, pastaId: string): IndiceDasPastas {
  return {
    ...indice,
    pastas: indice.pastas.map((pasta) => {
      if (pasta.id !== pastaId) return pasta
      const { recolhida: _antes, ...aberta } = pasta
      return pasta.recolhida === true ? aberta : { ...aberta, recolhida: true }
    }),
  }
}

/**
 * Põe o mapa `chave` na pasta `pastaId` (`null` = fora das pastas). Entrar
 * em OUTRA pasta começa usando o da pasta nova: o "só neste mapa" era sobre a
 * pasta de antes. Pasta que não existe, ou o mapa já ali: o mesmo índice.
 */
export function moverMapa(indice: IndiceDasPastas, chave: string, pastaId: string | null): IndiceDasPastas {
  const atual = indice.mapas.find((lugar) => lugar.chave === chave)
  if ((atual?.pastaId ?? null) === pastaId) return indice
  const outros = indice.mapas.filter((lugar) => lugar.chave !== chave)
  if (pastaId === null) return { ...indice, mapas: outros }
  if (!indice.pastas.some((pasta) => pasta.id === pastaId) || !chaveValida(chave)) return indice
  return { ...indice, mapas: [...outros, { chave, pastaId }] }
}

/** "Configurar só neste mapa" (`true`) ou "Usar o da pasta" (`false`). Mapa fora das pastas: o mesmo índice. */
export function definirProprio(indice: IndiceDasPastas, chave: string, proprio: boolean): IndiceDasPastas {
  if (!indice.mapas.some((lugar) => lugar.chave === chave)) return indice
  return {
    ...indice,
    mapas: indice.mapas.map((lugar) => {
      if (lugar.chave !== chave) return lugar
      const { proprio: _antes, ...semProprio } = lugar
      return proprio ? { ...semProprio, proprio: true } : semProprio
    }),
  }
}

/** A pasta do mapa e o modo dele; `null` = fora das pastas. */
export function lugarDoMapa(indice: IndiceDasPastas, chave: string): { pasta: PastaDeMapas; proprio: boolean } | null {
  const lugar = indice.mapas.find((candidato) => candidato.chave === chave)
  const pasta = lugar === undefined ? undefined : indice.pastas.find((candidata) => candidata.id === lugar.pastaId)
  if (lugar === undefined || pasta === undefined) return null
  return { pasta, proprio: lugar.proprio === true }
}

function semBarraNoFim(caminho: string): string {
  return caminho.replace(/\\/g, '/').replace(/\/+$/, '')
}

/**
 * A chave do mapa no caminho `caminho`: a primeira pasta dentro de
 * `pastaDosMapas` (`<appData>/maps/<chave>/map.json` e
 * `<appData>/maps/<chave>/scenes/<id>/map.json` dão a mesma chave). `null` =
 * o arquivo mora fora da pasta dos mapas. Windows não distingue maiúscula.
 */
export function chaveDoMapa(caminho: string, pastaDosMapas: string): string | null {
  const raiz = `${semBarraNoFim(pastaDosMapas)}/`
  const normalizado = semBarraNoFim(caminho)
  if (!normalizado.toLowerCase().startsWith(raiz.toLowerCase())) return null
  const partes = normalizado.slice(raiz.length).split('/')
  // Só arquivo DENTRO de uma pasta de mapa: a própria pasta dos mapas não é mapa.
  if (partes.length < 2 || partes.includes('..')) return null
  return chaveValida(partes[0]) ? partes[0] : null
}

/** O `rpg.json` como veio do disco: sistema que não é texto sai; personagens pelo leitor da aventura (`lib/personagem.ts`). */
export function rpgDoArquivo(valor: unknown): RpgDaPasta {
  if (!isRecord(valor)) return RPG_VAZIO
  const sistemaDeRpg = sistemaDaAventuraDoArquivo(valor.sistemaDeRpg)
  const personagens = personagensDoArquivo(valor.personagens) ?? []
  const equipes = equipesDoArquivo(valor.equipes)
  const base: RpgDaPasta = sistemaDeRpg === undefined ? { personagens } : { sistemaDeRpg, personagens }
  return comTreino(comMochilaMigrada(comEquipes(base, equipes), mochilaMigradaDoArquivo(valor.mochilaMigrada)), treinoDoArquivo(valor.treino))
}

/** A lista do treino como veio do disco: só ids em texto, sem repetir, no teto. Torta conta como ausente. */
function treinoDoArquivo(valor: unknown): TreinoDaPasta | undefined {
  if (!isRecord(valor) || !Array.isArray(valor.inimigosLiberados)) return undefined
  const ids = valor.inimigosLiberados.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= ID_DO_PERSONAGEM_MAX)
  return { inimigosLiberados: [...new Set(ids)].slice(0, INIMIGOS_LIBERADOS_MAX) }
}

/**
 * A lista do treino SEGUE o RPG na leitura, na gravação e na cópia, como o
 * marcador da mochila. Vazia continua na cópia em memória (tirar o último
 * inimigo precisa sobrescrever a lista de antes); no disco, vazia não é gravada.
 */
function comTreino(rpg: RpgDaPasta, treino: TreinoDaPasta | undefined): RpgDaPasta {
  return treino === undefined ? rpg : { ...rpg, treino }
}

/** Sem equipes (ausente ou lista vazia), sem a chave: o `rpg.json` de antes continua igual. */
function comEquipes(rpg: RpgDaPasta, equipes: Equipe[] | undefined): RpgDaPasta {
  return equipes === undefined || equipes.length === 0 ? rpg : { ...rpg, equipes }
}

/**
 * O marcador da migração da mochila como veio do disco: só versão inteira e
 * positiva. Torto conta como ausente (pasta ainda não migrada), como todo
 * campo que a leitura tolerante não entende.
 */
function mochilaMigradaDoArquivo(valor: unknown): number | undefined {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0 ? valor : undefined
}

/**
 * O marcador SEGUE o RPG na leitura, na gravação e na cópia: perdido no
 * caminho, a migração rodaria de novo ao reabrir e copiaria do boneco para a
 * ficha uma mochila já gasta. Ausente, sem a chave: o `rpg.json` de antes continua igual.
 */
function comMochilaMigrada(rpg: RpgDaPasta, mochilaMigrada: number | undefined): RpgDaPasta {
  return mochilaMigrada === undefined ? rpg : { ...rpg, mochilaMigrada }
}

function rpgDoTexto(texto: string): RpgDaPasta | null {
  try {
    return rpgDoArquivo(JSON.parse(texto))
  } catch {
    return null
  }
}

export function serializarRpg(rpg: RpgDaPasta): string {
  const equipes = rpg.equipes === undefined || rpg.equipes.length === 0 ? {} : { equipes: rpg.equipes }
  const marcador = rpg.mochilaMigrada === undefined ? {} : { mochilaMigrada: rpg.mochilaMigrada }
  const treino = rpg.treino === undefined || rpg.treino.inimigosLiberados.length === 0 ? {} : { treino: rpg.treino }
  return JSON.stringify(
    { versao: VERSAO, ...(rpg.sistemaDeRpg === undefined ? {} : { sistemaDeRpg: rpg.sistemaDeRpg }), personagens: rpg.personagens, ...equipes, ...marcador, ...treino },
    null,
    2,
  )
}

/** Os de `novos` cujo id a pasta ainda não tem: copiar duas vezes do mesmo mapa não duplica ninguém. */
export function personagensQueAPastaNaoTem(atuais: readonly Personagem[], novos: readonly Personagem[]): Personagem[] {
  const ids = new Set(atuais.map((personagem) => personagem.id))
  return novos.filter((personagem) => !ids.has(personagem.id))
}

/**
 * O "Sistema universal" da configuração da pasta: troca SÓ o sistema (`null`
 * = "Nenhum", a pasta só organiza). Os personagens, as equipes e o marcador da
 * mochila ficam: sem o marcador, voltar a um sistema converteria a pasta de
 * novo e copiaria do boneco para a ficha uma mochila já gasta.
 */
export function rpgComSistema(rpg: RpgDaPasta, sistemaId: string | null): RpgDaPasta {
  const { sistemaDeRpg: _antes, ...semSistema } = rpg
  return sistemaId === null ? semSistema : { ...semSistema, sistemaDeRpg: sistemaId }
}

/**
 * "Copiar de um mapa": os personagens do mapa que a pasta ainda não tem
 * entram no fim, e a pasta ainda sem sistema adota o do mapa (as fichas
 * copiadas foram feitas nele). O resto do RPG da pasta fica como estava —
 * as equipes e o marcador da mochila também (ver `rpgComSistema`).
 */
export function rpgComOsPersonagensDoMapa(rpg: RpgDaPasta, doMapa: RpgDaPasta): RpgDaPasta {
  const personagens = [...rpg.personagens, ...personagensQueAPastaNaoTem(rpg.personagens, doMapa.personagens)]
  const sistemaDeRpg = rpg.sistemaDeRpg ?? doMapa.sistemaDeRpg
  return sistemaDeRpg === undefined ? { ...rpg, personagens } : { ...rpg, sistemaDeRpg, personagens }
}

/** Só o RPG de uma `PastaAberta` (sem chave, nome e modo): é o que vai para o `rpg.json`. */
export function rpgDe(pasta: RpgDaPasta): RpgDaPasta {
  const base: RpgDaPasta = pasta.sistemaDeRpg === undefined ? { personagens: pasta.personagens } : { sistemaDeRpg: pasta.sistemaDeRpg, personagens: pasta.personagens }
  return comTreino(comMochilaMigrada(comEquipes(base, pasta.equipes), pasta.mochilaMigrada), pasta.treino)
}

// ───────────────────────────────────────────────────────────────────────────
// Disco
// ───────────────────────────────────────────────────────────────────────────

function motivo(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

export async function pastaDasPastas(): Promise<string> {
  return join(await appDataDir(), PASTA_DAS_PASTAS)
}

/** `<appData>/pastas/<id>`, só para id no formato do app: o id vem de um arquivo que pode ter sido editado à mão. */
async function pastaDe(pastaId: string): Promise<string> {
  if (!idDePastaValido(pastaId)) throw new Error(`O id "${pastaId}" não serve de nome de pasta.`)
  return join(await pastaDasPastas(), pastaId)
}

async function lerSeExiste(caminho: string): Promise<string | null> {
  if (!(await exists(caminho))) return null
  return readTextFile(caminho)
}

/**
 * Cópia do arquivo ANTES de gravar por cima, em `<arquivo>.anterior`.
 * `writeTextFileSafely` protege da gravação que morre no meio, não da que dá
 * certo com a lista errada. Melhor esforço: sem a cópia, a gravação segue.
 */
async function guardarAnterior(caminho: string): Promise<void> {
  try {
    if (!(await exists(caminho))) return
    await writeTextFile(`${caminho}${SUFIXO_ANTERIOR}`, await readTextFile(caminho))
  } catch {
    // Sem cópia desta vez; a gravação em si continua valendo.
  }
}

export interface IndiceLido {
  indice: IndiceDasPastas
  /** O que a tela deve dizer (arquivo danificado, disco recusou); `null` = leu limpo. */
  aviso: string | null
}

/** Lê o índice; `falhou` = o disco nem deixou ler — aí ninguém deve gravar por cima. */
async function lerIndice(): Promise<IndiceLido & { falhou: boolean }> {
  try {
    const caminho = await join(await pastaDasPastas(), ARQUIVO_DO_INDICE)
    const texto = await lerSeExiste(caminho)
    if (texto === null) return { indice: INDICE_VAZIO, aviso: null, falhou: false }
    const lido = indiceDoTexto(texto)
    if (lido !== null) return { indice: lido, aviso: null, falhou: false }
    const anterior = await lerSeExiste(`${caminho}${SUFIXO_ANTERIOR}`)
    const daCopia = anterior === null ? null : indiceDoTexto(anterior)
    if (daCopia !== null) return { indice: daCopia, aviso: 'O arquivo das pastas estava danificado: voltou a cópia anterior.', falhou: false }
    return { indice: INDICE_VAZIO, aviso: 'O arquivo das pastas está danificado: os mapas aparecem fora das pastas.', falhou: false }
  } catch (erro) {
    return { indice: INDICE_VAZIO, aviso: `Não deu para ler as pastas: ${motivo(erro)}.`, falhou: true }
  }
}

/** O índice para a tela. NUNCA lança: sem arquivo (primeira vez) é o índice vazio. */
export async function lerIndiceDasPastas(): Promise<IndiceLido> {
  const { indice, aviso } = await lerIndice()
  return { indice, aviso }
}

/**
 * Lê, muda e grava o índice numa ida só: a mudança vale sobre o que está no
 * disco, e não sobre a cópia que a tela leu antes. Lança com a razão em
 * português — inclusive quando o disco nem deixou ler: gravar o índice vazio
 * por cima seria tirar todos os mapas das pastas.
 */
export async function mudarIndiceDasPastas(mudar: (indice: IndiceDasPastas) => IndiceDasPastas): Promise<IndiceDasPastas> {
  const lido = await lerIndice()
  if (lido.falhou) throw new Error(lido.aviso ?? 'Não deu para ler as pastas.')
  const novo = mudar(lido.indice)
  try {
    const pasta = await pastaDasPastas()
    await ensureDir(pasta)
    const caminho = await join(pasta, ARQUIVO_DO_INDICE)
    await guardarAnterior(caminho)
    await writeTextFileSafely(caminho, serializarIndice(novo))
  } catch (erro) {
    throw new Error(`Não deu para guardar as pastas: ${motivo(erro)}.`)
  }
  return novo
}

export type RpgLido = { ok: true; rpg: RpgDaPasta } | { ok: false; motivo: string }

/**
 * O RPG da pasta. Nunca lança. Sem arquivo = sem sistema e sem personagens
 * (pasta nova). Arquivo danificado: a cópia anterior; sem ela, `ok: false` —
 * quem abre o mapa NÃO deve herdar uma lista vazia e gravá-la por cima.
 */
export async function lerRpgDaPasta(pastaId: string): Promise<RpgLido> {
  try {
    const caminho = await join(await pastaDe(pastaId), ARQUIVO_DO_RPG)
    const texto = await lerSeExiste(caminho)
    if (texto === null) return { ok: true, rpg: RPG_VAZIO }
    const lido = rpgDoTexto(texto)
    if (lido !== null) return { ok: true, rpg: lido }
    const anterior = await lerSeExiste(`${caminho}${SUFIXO_ANTERIOR}`)
    const daCopia = anterior === null ? null : rpgDoTexto(anterior)
    if (daCopia !== null) return { ok: true, rpg: daCopia }
    return { ok: false, motivo: 'o arquivo dos personagens da pasta está danificado' }
  } catch (erro) {
    return { ok: false, motivo: motivo(erro) }
  }
}

/**
 * A vez de quem está mexendo no `rpg.json` de uma pasta (LOBBY, plano §5.6):
 * quem já está na fila passa a vez adiante e grava sem entrar de novo.
 */
export interface VezNaPasta {
  readonly pastaId: string
}

/** Uma cadeia por pasta: a próxima gravação só começa quando a anterior terminou (deu certo ou não). */
const filasDasPastas = new Map<string, Promise<unknown>>()
const vezesAtivas = new Set<VezNaPasta>()

/**
 * FILA ÚNICA POR PASTA (docs/planos/lobby-jogadores-2026-11-05.md §5.6): todo
 * ler-mudar-gravar do `rpg.json` de uma pasta passa por aqui, um por vez — o
 * Salvar, o `editarRpgDaPasta` e o gravador leve do Lobby
 * (`net/nuvem/gravadorLeve.ts`). Sem ela, o gravador leve podia ler o disco
 * entre a leitura e a gravação de outro e um dos dois gravava por cima do
 * outro. `passo` recebe a vez: quem chama `gravarRpgDaPasta` de dentro dele a
 * passa adiante (senão esperaria a si mesmo).
 */
export function naFilaDaPasta<T>(pastaId: string, passo: (vez: VezNaPasta) => Promise<T>): Promise<T> {
  const anterior = filasDasPastas.get(pastaId) ?? Promise.resolve()
  const vez: VezNaPasta = { pastaId }
  const resultado = anterior.then(async () => {
    vezesAtivas.add(vez)
    try {
      return await passo(vez)
    } finally {
      vezesAtivas.delete(vez)
    }
  })
  const fim = resultado.catch(() => undefined)
  filasDasPastas.set(pastaId, fim)
  // A cadeia que terminou e ninguém seguiu sai do mapa (não acumula uma por pasta aberta na vida do app).
  void fim.then(() => {
    if (filasDasPastas.get(pastaId) === fim) filasDasPastas.delete(pastaId)
  })
  return resultado
}

function jaNaVez(pastaId: string, vez: VezNaPasta | undefined): boolean {
  return vez !== undefined && vez.pastaId === pastaId && vezesAtivas.has(vez)
}

/**
 * Grava o RPG da pasta e leva a mídia das fichas para `<id>/midia` (como a
 * aventura leva a dela, `lib/midiaDaPasta.ts`). Lança com a razão em
 * português; a mídia que não foi só vira aviso. Entra na fila única da pasta
 * (`naFilaDaPasta`); quem já está nela passa a `vez`.
 */
export function gravarRpgDaPasta(pastaId: string, rpg: RpgDaPasta, vez?: VezNaPasta): Promise<void> {
  if (jaNaVez(pastaId, vez)) return gravarRpgDaPastaAgora(pastaId, rpg)
  return naFilaDaPasta(pastaId, () => gravarRpgDaPastaAgora(pastaId, rpg))
}

async function gravarRpgDaPastaAgora(pastaId: string, rpg: RpgDaPasta): Promise<void> {
  let pasta: string
  try {
    pasta = await pastaDe(pastaId)
    await ensureDir(pasta)
    const caminho = await join(pasta, ARQUIVO_DO_RPG)
    await guardarAnterior(caminho)
    await writeTextFileSafely(caminho, serializarRpg(rpg))
  } catch (erro) {
    throw new Error(`Não deu para guardar os personagens da pasta: ${motivo(erro)}.`)
  }
  await levarMidiaParaAPasta(await join(pasta, PASTA_DE_MIDIA_DA_AVENTURA), { personagens: rpg.personagens })
}

/**
 * O sistema e os personagens de um mapa SALVO (a aventura `<appData>/maps/<chave>`),
 * para "Copiar de um mapa" na configuração da pasta. A mídia dele volta para
 * `<appData>/midia` antes, para os retratos da cópia aparecerem. `null` =
 * mapa solto, aventura ilegível ou sem nada para copiar. Nunca lança.
 */
export async function rpgDoMapaSalvo(chave: string): Promise<RpgDaPasta | null> {
  try {
    const dir = await mapDirFor(chave)
    const texto = await lerSeExiste(await join(dir, ADVENTURE_FILE))
    if (texto === null) return null
    const aventura = parseAdventure(texto)
    const personagens = aventura.personagens ?? []
    if (personagens.length === 0 && aventura.sistemaDeRpg === undefined) return null
    await trazerMidiaDaPasta(await pastaDaMidiaDaAventura(dir))
    return aventura.sistemaDeRpg === undefined ? { personagens } : { sistemaDeRpg: aventura.sistemaDeRpg, personagens }
  } catch {
    return null
  }
}

/**
 * A pasta do mapa que acabou de abrir de `caminho`, com o RPG dela lido e a
 * mídia dos personagens de volta em `<appData>/midia`. `null` = fora das
 * pastas (ou fora de `<appData>/maps`). RPG da pasta ilegível: avisa e abre o
 * mapa com o que é dele — herdar uma lista vazia e salvar apagaria a de verdade.
 * Nunca lança.
 */
export async function pastaAbertaDoArquivo(caminho: string): Promise<PastaAberta | null> {
  let chave: string | null
  try {
    chave = chaveDoMapa(caminho, await defaultMapsDir())
  } catch {
    return null
  }
  if (chave === null) return null
  const { indice } = await lerIndiceDasPastas()
  const lugar = lugarDoMapa(indice, chave)
  if (lugar === null) return null
  const lido = await lerRpgDaPasta(lugar.pasta.id)
  if (!lido.ok) {
    useToastStore.getState().push('error', `Não deu para ler os personagens da pasta "${lugar.pasta.nome}" (${lido.motivo}): o mapa abre com o próprio sistema e personagens.`)
    return null
  }
  try {
    await trazerMidiaDaPasta(await join(await pastaDe(lugar.pasta.id), PASTA_DE_MIDIA_DA_AVENTURA))
  } catch {
    // Sem a mídia, os retratos mostram as iniciais; as fichas valem mais que a foto.
  }
  return { chave, pastaId: lugar.pasta.id, nome: lugar.pasta.nome, proprio: lugar.proprio, ...lido.rpg }
}
