import { appDataDir, dirname, join } from '@tauri-apps/api/path'
import { isTauri } from '@tauri-apps/api/core'
import { exists, readTextFile, stat } from '@tauri-apps/plugin-fs'
import { ADVENTURE_FILE, fileSegments, isSafeRelativeFile, parseAdventure, samePath, type Adventure } from '../../lib/adventure'
import { readCarriedItems } from '../../lib/items'
import { writeTextFileSafely } from '../../lib/mapFileIO'
import { horaDoSalvarDoArquivo } from '../../lib/mochila/horaDoSalvar'
import { juntarMochilas, type BonecoDaJuncao, type CenaDaJuncao, type DiferencaDaMochila, type FichaComVariosBonecos, type JuncaoDaMochila, type OrigemDaMochila } from '../../lib/mochila/juncao'
import { marcadorDaMochilaDoArquivo, VERSAO_DA_MIGRACAO_DA_MOCHILA } from '../../lib/mochila/marcador'
import { chaveDoMapa, idDePastaValido, INDICE_VAZIO, indiceDoArquivo, lugarDoMapa, rpgDoArquivo, type IndiceDasPastas } from '../../lib/pastasDeMapas'
import type { Personagem } from '../../lib/personagem'
import type { RecoveryCopy } from '../../lib/recoveryCopy'
import { moedasDe, readMoedas } from '../../lib/troca'
import { useToastStore } from '../../stores/toastStore'
import type { MapData } from '../../types/map'

/**
 * MOCHILA NA FICHA — a MIGRAÇÃO AO ABRIR (docs/planos/lobby-jogadores-2026-11-05.md
 * §4.2 e §8.1, fatia A2). Pedido do usuário: "mesmo que mude de mapa/aventura
 * seria legal manter os itens".
 *
 * Ao abrir um mapa, ANTES de o editor ler as fichas, leva a mochila e a bolsa
 * dos bonecos para as fichas de quem manda nelas:
 *
 * - mapa que usa a PASTA (`rpg.json` com sistema universal, sem "Configurar só
 *   neste mapa"): as fichas da pasta, juntando as cenas de TODOS os mapas da
 *   pasta que a usam — é uma campanha só;
 * - aventura sem pasta, mapa em "Configurar só neste mapa" ou pasta sem
 *   sistema universal: as fichas do `adventure.json`, com as cenas dela.
 *
 * A regra da junção é `lib/mochila/juncao.ts` (vale a cena salva por último,
 * pela hora de `lib/mochila/horaDoSalvar.ts`; o resto vai para o relatório;
 * ficha ligada a vários bonecos numa mesma cena fica como estava, também no
 * relatório). Antes de gravar: a cópia do arquivo como era
 * (`<arquivo>.antes-da-mochila`, nunca regravada) e o relatório
 * `migracao-da-mochila.json` ao lado. O marcador `mochilaMigrada` vai NO MESMO
 * arquivo das fichas, na mesma gravação: não há meio-termo em que a ficha tem
 * a mochila e a pasta não diz que migrou.
 *
 * Os mapas (`map.json`) não mudam: o boneco de NPC sem ficha segue com a
 * mochila dele, e o espelho do boneco ligado é da fatia A3.
 *
 * Roda depois de resolvida a recuperação: quem chama passa o trabalho
 * recuperado (`RecoveryCopy`), e as cenas dele entram com a hora da cópia em
 * vez da do disco. O disco é injetado (`DiscoDaMigracao`) para o teste correr
 * sobre um disco falso; o app usa `discoDoApp`.
 */

/** O que a migração precisa do disco. */
export interface DiscoDaMigracao {
  /** `<appData>`: onde moram `maps/` e `pastas/`. */
  pastaDoApp(): Promise<string>
  /** O texto do arquivo; `null` = não existe. */
  ler(caminho: string): Promise<string | null>
  /** Grava por cima (no app, com troca segura de arquivo). */
  gravar(caminho: string, texto: string): Promise<void>
  /** Quando o arquivo foi gravado pela última vez, em ms desde a época; 0 = o disco não diz. */
  gravadoEm(caminho: string): Promise<number>
  juntar(...partes: string[]): Promise<string>
  pai(caminho: string): Promise<string>
}

export type MigracaoDaMochila =
  | {
      feita: false
      /** `sem-fichas`: nada a migrar (mapa solto fora de pasta, lista vazia); `ja-migrada`: o marcador já está lá; `arquivo-ilegivel`: o índice ou as fichas não abriram — o app tem a própria recuperação, e gravar por cima seria pior. */
      porque: 'sem-fichas' | 'ja-migrada' | 'arquivo-ilegivel'
    }
  | {
      feita: true
      /** O arquivo das fichas que recebeu a mochila e o marcador. */
      arquivo: string
      relatorio: string
      copiaDeAntes: string
      fichas: number
      diferencas: number
      /** Fichas ligadas a mais de um boneco numa mesma cena: ficaram como estavam, e o relatório lista os bonecos. */
      variosBonecos: number
    }

export const ARQUIVO_DO_RELATORIO = 'migracao-da-mochila.json'
export const SUFIXO_DA_COPIA_DE_ANTES = '.antes-da-mochila'
const VERSAO_DO_RELATORIO = 1

// Os mesmos nomes de `lib/pastasDeMapas.ts` e `lib/mapFileIO.ts` (lá são privados). O mapa que entra numa pasta convertida (`mochilaPendente.ts`) usa os daqui.
export const PASTA_DOS_MAPAS = 'maps'
export const PASTA_DAS_PASTAS = 'pastas'
const ARQUIVO_DO_INDICE = 'indice.json'
export const ARQUIVO_DO_RPG = 'rpg.json'
export const ARQUIVO_DO_MAPA = 'map.json'
const SUFIXO_ANTERIOR = '.anterior'

export type Bruto = Record<string, unknown>

function isRecord(value: unknown): value is Bruto {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** O JSON do texto se for um objeto; `null` = texto torto. */
export function objetoDoTexto(texto: string): Bruto | null {
  try {
    const valor: unknown = JSON.parse(texto)
    return isRecord(valor) ? valor : null
  } catch {
    return null
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura das cenas
// ───────────────────────────────────────────────────────────────────────────

/** Os bonecos de um `map.json` pelos MESMOS leitores do mapa (`readCarriedItems`, `readMoedas`); boneco torto sai. */
function bonecosDoArquivo(mapa: Bruto): BonecoDaJuncao[] {
  if (!Array.isArray(mapa.tokens)) return []
  return mapa.tokens.flatMap((token): BonecoDaJuncao[] => {
    if (!isRecord(token)) return []
    const characterId = typeof token.characterId === 'string' ? token.characterId : null
    const mochila = readCarriedItems(token.mochila)
    const moedas = readMoedas(token.moedas)
    const nome = typeof token.name === 'string' ? { name: token.name } : {}
    return [{ characterId, ...nome, ...(mochila === undefined ? {} : { mochila }), ...(moedas === undefined ? {} : { moedas }) }]
  })
}

function bonecosDoMapa(mapa: MapData): BonecoDaJuncao[] {
  return mapa.tokens.map(({ characterId, name, mochila, moedas }) => ({ characterId, name, mochila, moedas }))
}

/** As cenas lidas e as que não abriram (vão ao relatório). */
export interface CenasLidas {
  cenas: CenaDaJuncao[]
  naoAbriram: string[]
}

/** Uma cena do disco; ilegível ou sumida vai para `naoAbriram`. */
async function lerCena(disco: DiscoDaMigracao, caminho: string, mapa: string, cena: string, lidas: CenasLidas): Promise<void> {
  const nome = cena === '' ? mapa : `${mapa} › ${cena}`
  const texto = await disco.ler(caminho)
  const bruto = texto === null ? null : objetoDoTexto(texto)
  if (bruto === null) {
    lidas.naoAbriram.push(`${nome} (${texto === null ? 'arquivo não encontrado' : 'arquivo danificado'})`)
    return
  }
  // A hora do último SALVAR: renomear/duplicar regravam o arquivo sem jogo e deixam a de antes nele; o `mtime` só na falta.
  const gravadaEm = horaDoSalvarDoArquivo(bruto) ?? (await disco.gravadoEm(caminho))
  lidas.cenas.push({ origem: { mapa, cena, gravadaEm }, bonecos: bonecosDoArquivo(bruto) })
}

/** O caminho absoluto da cena; `null` = caminho perigoso no `adventure.json` (a cena fica de fora, como no app). */
async function caminhoDaCena(disco: DiscoDaMigracao, dir: string, arquivo: string): Promise<string | null> {
  return isSafeRelativeFile(arquivo) ? disco.juntar(dir, ...fileSegments(arquivo)) : null
}

/** O trabalho recuperado quando ele é DESTA aventura (a cena aberta dele está na lista). */
interface CopiaDaAventura {
  caminhoDaCenaAberta: string
  copia: RecoveryCopy
}

function copiaDaAventura(recuperado: RecoveryCopy | null, caminhos: readonly (string | null)[]): CopiaDaAventura | null {
  if (recuperado === null || recuperado.mapPath === null) return null
  const aberta = recuperado.mapPath
  return caminhos.some((caminho) => caminho !== null && samePath(caminho, aberta)) ? { caminhoDaCenaAberta: aberta, copia: recuperado } : null
}

/** A cena como o trabalho recuperado a tem (com a hora da cópia); `null` = a cópia não tem mudança nela. */
function cenaDaCopia(recuperada: CopiaDaAventura | null, caminho: string, sceneId: string, origem: Omit<OrigemDaMochila, 'gravadaEm'>): CenaDaJuncao | null {
  if (recuperada === null) return null
  const { copia } = recuperada
  const mapa: MapData | undefined = samePath(caminho, recuperada.caminhoDaCenaAberta) ? copia.map : copia.scenes[sceneId]
  return mapa === undefined ? null : { origem: { ...origem, gravadaEm: copia.savedAtMs }, bonecos: bonecosDoMapa(mapa) }
}

/**
 * As cenas de uma aventura. Do trabalho recuperado: a cena aberta dele e as de
 * fundo com mudança entram com a hora da cópia, no lugar da versão do disco;
 * cena recuperada que nem chegou ao `adventure.json` (criada e não salva) entra também.
 */
async function lerCenasDaAventura(disco: DiscoDaMigracao, dir: string, aventura: Adventure, recuperado: RecoveryCopy | null, lidas: CenasLidas): Promise<void> {
  const caminhos = await Promise.all(aventura.scenes.map((entrada) => caminhoDaCena(disco, dir, entrada.file)))
  const recuperada = copiaDaAventura(recuperado, caminhos)
  for (const [indice, entrada] of aventura.scenes.entries()) {
    const caminho = caminhos[indice]
    if (caminho === null) {
      lidas.naoAbriram.push(`${aventura.name} › ${entrada.name} (caminho inválido)`)
      continue
    }
    const daCopia = cenaDaCopia(recuperada, caminho, entrada.id, { mapa: aventura.name, cena: entrada.name })
    if (daCopia === null) await lerCena(disco, caminho, aventura.name, entrada.name, lidas)
    else lidas.cenas.push(daCopia)
  }
  if (recuperada === null) return
  for (const [sceneId, mapa] of Object.entries(recuperada.copia.scenes)) {
    if (aventura.scenes.some((entrada) => entrada.id === sceneId)) continue
    lidas.cenas.push({ origem: { mapa: aventura.name, cena: mapa.name, gravadaEm: recuperada.copia.savedAtMs }, bonecos: bonecosDoMapa(mapa) })
  }
}

/** A aventura de `dir` (`adventure.json` que abre) ou `null`: aí a pasta é de um mapa solto. */
async function aventuraDaPasta(disco: DiscoDaMigracao, dir: string): Promise<{ aventura: Adventure; texto: string; bruto: Bruto; caminho: string } | null> {
  const caminho = await disco.juntar(dir, ADVENTURE_FILE)
  const texto = await disco.ler(caminho)
  if (texto === null) return null
  const bruto = objetoDoTexto(texto)
  if (bruto === null) return null
  try {
    return { aventura: parseAdventure(texto), texto, bruto, caminho }
  } catch {
    // `adventure.json` quebrado: o app abre o mapa solto (`findAdventureFor`), e aqui também.
    return null
  }
}

/** As cenas de um mapa da pasta: as da aventura, ou o `map.json` solto. */
export async function lerCenasDoMapa(disco: DiscoDaMigracao, dir: string, recuperado: RecoveryCopy | null, lidas: CenasLidas): Promise<void> {
  const achada = await aventuraDaPasta(disco, dir)
  if (achada !== null) {
    await lerCenasDaAventura(disco, dir, achada.aventura, recuperado, lidas)
    return
  }
  const caminho = await disco.juntar(dir, ARQUIVO_DO_MAPA)
  if (recuperado !== null && recuperado.mapPath !== null && samePath(caminho, recuperado.mapPath)) {
    lidas.cenas.push({ origem: { mapa: recuperado.map.name, cena: '', gravadaEm: recuperado.savedAtMs }, bonecos: bonecosDoMapa(recuperado.map) })
    return
  }
  const texto = await disco.ler(caminho)
  const bruto = texto === null ? null : objetoDoTexto(texto)
  const nome = bruto !== null && typeof bruto.name === 'string' ? bruto.name : dir
  await lerCena(disco, caminho, nome, '', lidas)
}

/**
 * A aventura de quem `caminhoDoMapa` é cena, como o app a acha
 * (`findAdventureFor`): na pasta do arquivo e duas acima (`scenes/<id>/map.json`).
 */
async function aventuraDoMapa(disco: DiscoDaMigracao, caminhoDoMapa: string): Promise<{ aventura: Adventure; texto: string; bruto: Bruto; caminho: string; dir: string } | null> {
  const propria = await disco.pai(caminhoDoMapa)
  const candidatas = [propria, await disco.pai(await disco.pai(propria))]
  for (const dir of candidatas) {
    if (dir.length === 0) continue
    const achada = await aventuraDaPasta(disco, dir)
    if (achada === null) continue
    for (const entrada of achada.aventura.scenes) {
      const caminho = await caminhoDaCena(disco, dir, entrada.file)
      if (caminho !== null && samePath(caminho, caminhoDoMapa)) return { ...achada, dir }
    }
  }
  return null
}

// ───────────────────────────────────────────────────────────────────────────
// Gravação
// ───────────────────────────────────────────────────────────────────────────

/**
 * O arquivo das fichas como estava, só com a mochila e a bolsa de cada ficha
 * trocadas e o marcador: o resto (inclusive campo que este app não conhece)
 * fica byte a byte como veio, para a diferença com a cópia de antes ser só a migração.
 */
function brutoMigrado(bruto: Bruto, personagens: readonly Personagem[]): Bruto {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const lista = !Array.isArray(bruto.personagens)
    ? bruto.personagens
    : bruto.personagens.map((cru: unknown) => {
        if (!isRecord(cru) || typeof cru.id !== 'string') return cru
        const migrado = porId.get(cru.id)
        if (migrado === undefined) return cru
        const { mochila: _antes, moedas: _bolsaDeAntes, ...resto } = cru
        return {
          ...resto,
          ...(migrado.mochila === undefined ? {} : { mochila: migrado.mochila }),
          ...(migrado.moedas === undefined ? {} : { moedas: migrado.moedas }),
        }
      })
  return { ...bruto, personagens: lista, mochilaMigrada: VERSAO_DA_MIGRACAO_DA_MOCHILA }
}

function hora(ms: number): string | null {
  return ms > 0 ? new Date(ms).toISOString() : null
}

function origemDoRelatorio(origem: OrigemDaMochila): { mapa: string; cena: string; gravadaEm: string | null } {
  return { mapa: origem.mapa, cena: origem.cena, gravadaEm: hora(origem.gravadaEm) }
}

function diferencaDoRelatorio(diferenca: DiferencaDaMochila): Bruto {
  const comum = { ficha: diferenca.personagem, fichaId: diferenca.personagemId, ...origemDoRelatorio(diferenca.origem) }
  switch (diferenca.tipo) {
    case 'item-diferente':
      return { tipo: diferenca.tipo, ...comum, item: diferenca.vale.nome, vale: diferenca.vale, naOutraCena: diferenca.outro }
    case 'item-de-outra-cena':
      return { tipo: diferenca.tipo, ...comum, item: diferenca.item.nome, ficouNaFicha: diferenca.item }
    case 'moedas-diferentes':
      return { tipo: diferenca.tipo, ...comum, vale: diferenca.vale, naOutraCena: diferenca.outra }
  }
}

/** Uma ficha com vários bonecos numa cena: cada cena com o que cada boneco carrega, para o mestre decidir. */
function variosBonecosDoRelatorio(ficha: FichaComVariosBonecos): Bruto {
  return {
    ficha: ficha.personagem,
    fichaId: ficha.personagemId,
    cenas: ficha.cenas.map(({ origem, bonecos }) => ({
      ...origemDoRelatorio(origem),
      bonecos: bonecos.map((boneco) => ({ boneco: boneco.name ?? '', mochila: boneco.mochila ?? [], moedas: moedasDe(boneco) })),
    })),
  }
}

/** O relatório para o mestre ler (§9, passo 11): de onde veio cada mochila e cada diferença, com o mapa e a cena. */
function textoDoRelatorio(onde: string, copiaDeAntes: string, juncao: JuncaoDaMochila, naoAbriram: readonly string[], agoraMs: number): string {
  const porId = new Map(juncao.personagens.map((personagem) => [personagem.id, personagem]))
  return JSON.stringify(
    {
      versao: VERSAO_DO_RELATORIO,
      feitaEm: new Date(agoraMs).toISOString(),
      onde,
      regra: 'Vale a mochila e a bolsa da cena salva por último. O mesmo item diferente noutra cena não muda nada; item que só existia noutra cena também ficou na ficha. Ficha ligada a mais de um boneco numa mesma cena ficou como estava, com a mochila em cada boneco: decida qual vale. Confira as diferenças abaixo.',
      copiaDeAntes,
      fichas: juncao.bases.map((base) => {
        const ficha = porId.get(base.personagemId)
        return { ficha: base.personagem, fichaId: base.personagemId, veioDe: origemDoRelatorio(base.origem), mochila: ficha?.mochila ?? [], moedas: ficha?.moedas ?? 0 }
      }),
      fichasSemBoneco: juncao.semBoneco.map((ficha) => ficha.personagem),
      fichasComVariosBonecos: juncao.variosBonecos.map(variosBonecosDoRelatorio),
      diferencas: juncao.diferencas.map(diferencaDoRelatorio),
      cenasQueNaoAbriram: naoAbriram,
    },
    null,
    2,
  )
}

interface Alvo {
  /** O arquivo das fichas: `rpg.json` da pasta ou `adventure.json`. */
  arquivo: string
  /** O texto dele como está no disco agora (vira a cópia de antes). */
  texto: string
  bruto: Bruto
  personagens: readonly Personagem[]
  /** A pasta onde o relatório fica (a do arquivo das fichas). */
  dir: string
  /** "pasta One Piece", "aventura Sky Lagoon": como o relatório chama o lugar. */
  onde: string
}

async function migrar(disco: DiscoDaMigracao, alvo: Alvo, lidas: CenasLidas, agoraMs: number): Promise<MigracaoDaMochila> {
  const juncao = juntarMochilas(alvo.personagens, lidas.cenas)
  const copiaDeAntes = `${alvo.arquivo}${SUFIXO_DA_COPIA_DE_ANTES}`
  // A cópia é do arquivo ANTES da PRIMEIRA migração: uma segunda tentativa (a primeira caiu antes do marcador) não a regrava.
  if ((await disco.ler(copiaDeAntes)) === null) await disco.gravar(copiaDeAntes, alvo.texto)
  const relatorio = await disco.juntar(alvo.dir, ARQUIVO_DO_RELATORIO)
  await disco.gravar(relatorio, textoDoRelatorio(alvo.onde, copiaDeAntes, juncao, lidas.naoAbriram, agoraMs))
  await disco.gravar(alvo.arquivo, JSON.stringify(brutoMigrado(alvo.bruto, juncao.personagens), null, 2))
  return { feita: true, arquivo: alvo.arquivo, relatorio, copiaDeAntes, fichas: juncao.bases.length, diferencas: juncao.diferencas.length, variosBonecos: juncao.variosBonecos.length }
}

/** O índice das pastas como o app o lê (`lerIndice`): o arquivo, senão a cópia `.anterior`; `null` = nenhum dos dois abre. */
export async function lerIndice(disco: DiscoDaMigracao, pastaDasPastas: string): Promise<IndiceDasPastas | null> {
  const caminho = await disco.juntar(pastaDasPastas, ARQUIVO_DO_INDICE)
  const texto = await disco.ler(caminho)
  if (texto === null) return INDICE_VAZIO
  const bruto = objetoDoTexto(texto) ?? objetoDoTexto((await disco.ler(`${caminho}${SUFIXO_ANTERIOR}`)) ?? '')
  return bruto === null ? null : indiceDoArquivo(bruto)
}

async function migrarPasta(disco: DiscoDaMigracao, indice: IndiceDasPastas, pastaDosMapas: string, pastaId: string, nome: string, rpg: Omit<Alvo, 'personagens' | 'onde'>, recuperado: RecoveryCopy | null, agoraMs: number): Promise<MigracaoDaMochila> {
  const lido = rpgDoArquivo(rpg.bruto)
  if (lido.mochilaMigrada !== undefined) return { feita: false, porque: 'ja-migrada' }
  if (lido.personagens.length === 0) return { feita: false, porque: 'sem-fichas' }
  const lidas: CenasLidas = { cenas: [], naoAbriram: [] }
  // Todo mapa da pasta que USA a pasta: é uma campanha só. "Configurar só neste mapa" fica de fora (tem as próprias fichas).
  for (const lugar of indice.mapas) {
    if (lugar.pastaId !== pastaId || lugar.proprio === true) continue
    await lerCenasDoMapa(disco, await disco.juntar(pastaDosMapas, lugar.chave), recuperado, lidas)
  }
  return migrar(disco, { ...rpg, personagens: lido.personagens, onde: `pasta ${nome}` }, lidas, agoraMs)
}

async function migrarAventura(disco: DiscoDaMigracao, caminhoDoMapa: string, recuperado: RecoveryCopy | null, agoraMs: number): Promise<MigracaoDaMochila> {
  const achada = await aventuraDoMapa(disco, caminhoDoMapa)
  // Mapa solto fora de pasta: as fichas moram em `adventure.json`, e ele não tem.
  if (achada === null) return { feita: false, porque: 'sem-fichas' }
  if (marcadorDaMochilaDoArquivo(achada.bruto.mochilaMigrada) !== undefined) return { feita: false, porque: 'ja-migrada' }
  const personagens = achada.aventura.personagens ?? []
  if (personagens.length === 0) return { feita: false, porque: 'sem-fichas' }
  const lidas: CenasLidas = { cenas: [], naoAbriram: [] }
  await lerCenasDaAventura(disco, achada.dir, achada.aventura, recuperado, lidas)
  const alvo: Alvo = { arquivo: achada.caminho, texto: achada.texto, bruto: achada.bruto, personagens, dir: achada.dir, onde: `aventura ${achada.aventura.name}` }
  return migrar(disco, alvo, lidas, agoraMs)
}

export interface OpcoesDaMigracao {
  /** O trabalho que o mestre acabou de recuperar (`handleRecover`); `null` = abriu do disco. */
  recuperado?: RecoveryCopy | null
  agora?: () => number
}

/**
 * Migra a mochila das fichas que o mapa `caminhoDoMapa` usa, se ainda não
 * migraram. Chamar ANTES de ler o mapa para o editor. Lança só se o disco
 * recusar a gravação; quem chama decide (`migrarMochilaAoAbrir` avisa e abre o mapa como antes).
 */
export async function migrarMochilaDoMapa(caminhoDoMapa: string, disco: DiscoDaMigracao, opcoes: OpcoesDaMigracao = {}): Promise<MigracaoDaMochila> {
  const recuperado = opcoes.recuperado ?? null
  const agoraMs = (opcoes.agora ?? Date.now)()
  const pastaDoApp = await disco.pastaDoApp()
  const pastaDosMapas = await disco.juntar(pastaDoApp, PASTA_DOS_MAPAS)
  const chave = chaveDoMapa(caminhoDoMapa, pastaDosMapas)
  if (chave !== null) {
    const pastaDasPastas = await disco.juntar(pastaDoApp, PASTA_DAS_PASTAS)
    const indice = await lerIndice(disco, pastaDasPastas)
    if (indice === null) return { feita: false, porque: 'arquivo-ilegivel' }
    const lugar = lugarDoMapa(indice, chave)
    if (lugar !== null && !lugar.proprio && idDePastaValido(lugar.pasta.id)) {
      const dir = await disco.juntar(pastaDasPastas, lugar.pasta.id)
      const arquivo = await disco.juntar(dir, ARQUIVO_DO_RPG)
      const texto = await disco.ler(arquivo)
      if (texto !== null) {
        const bruto = objetoDoTexto(texto)
        // Danificado: o app abre pela cópia `.anterior` e regrava ao salvar a pasta; migra na abertura seguinte.
        if (bruto === null) return { feita: false, porque: 'arquivo-ilegivel' }
        // Pasta com sistema universal manda nas fichas (`pastaQueManda`); sem ele, o mapa usa as próprias.
        if (rpgDoArquivo(bruto).sistemaDeRpg !== undefined) {
          return migrarPasta(disco, indice, pastaDosMapas, lugar.pasta.id, lugar.pasta.nome, { arquivo, texto, bruto, dir }, recuperado, agoraMs)
        }
      }
    }
  }
  return migrarAventura(disco, caminhoDoMapa, recuperado, agoraMs)
}

// ───────────────────────────────────────────────────────────────────────────
// No app
// ───────────────────────────────────────────────────────────────────────────

/** O disco de verdade: `<appData>` do app e a gravação com troca segura (`writeTextFileSafely`). */
export const discoDoApp: DiscoDaMigracao = {
  pastaDoApp: appDataDir,
  ler: async (caminho) => ((await exists(caminho)) ? readTextFile(caminho) : null),
  gravar: writeTextFileSafely,
  gravadoEm: async (caminho) => {
    try {
      const info = await stat(caminho)
      return info.mtime === null ? 0 : info.mtime.getTime()
    } catch {
      return 0
    }
  },
  juntar: join,
  pai: dirname,
}

function motivo(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/**
 * A migração na abertura do app (`App.tsx`: abrir pelo Carregar Mapa ou pelo
 * seletor, e Recuperar). Nunca lança e nunca impede o mapa de abrir: falhou,
 * avisa e o mapa abre como antes (a abertura seguinte tenta de novo, porque o
 * marcador só vai junto com as fichas). Fora do app (navegador dos testes), não faz nada.
 */
export async function migrarMochilaAoAbrir(caminhoDoMapa: string, recuperado: RecoveryCopy | null = null): Promise<void> {
  if (!isTauri()) return
  try {
    const feita = await migrarMochilaDoMapa(caminhoDoMapa, discoDoApp, { recuperado })
    if (!feita.feita) return
    const diferencas = feita.diferencas === 0 ? 'Nenhuma diferença entre os mapas.' : `${feita.diferencas} diferença(s) entre os mapas: confira em ${feita.relatorio}.`
    const variosBonecos = feita.variosBonecos === 0 ? '' : ` ${feita.variosBonecos} ficha(s) ligada(s) a mais de um boneco no mesmo mapa ficaram como estavam, com a mochila em cada boneco: decida em ${feita.relatorio}.`
    useToastStore.getState().push('info', `A mochila e a bolsa de ${feita.fichas} personagem(ns) passaram a morar na ficha. ${diferencas}${variosBonecos}`)
  } catch (erro) {
    useToastStore.getState().push('error', `Não deu para passar a mochila para as fichas (${motivo(erro)}): o mapa abre como antes.`)
  }
}
