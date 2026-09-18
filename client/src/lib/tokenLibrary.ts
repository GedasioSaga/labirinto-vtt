import { exists, readDir, readTextFile, remove, writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import type { Token } from '../types/map'
import { buildTokenSharedPhoto, importTokenImage } from './imageImport'
import { ensureDir, uniqueMapName, writeTextFileSafely } from './mapFileIO'
import { isTokenPhotoData, tokenPhotoRef } from './tokenPhoto'

/**
 * ACERVO DE TOKENS PRONTOS — o goblin que a pessoa desenhou uma vez e quer
 * colocar em qualquer mesa depois.
 *
 * É GLOBAL DO APP, não do mapa (decisão do usuário, 18/09/2026: "salvar Tokens
 * pre prontos, tipos tokens de npcs e afins para colocar para os jogadores").
 * Por isso mora em `appDataDir()/tokens`, IRMÃ de `appDataDir()/maps` — o
 * molde é `lib/mapFileIO.ts`, o único precedente de armazenamento do app, e
 * este módulo reusa dele `ensureDir`, `writeTextFileSafely` e `uniqueMapName`
 * em vez de reinventar os três.
 *
 * O que fica no disco:
 *   <appData>/tokens/acervo.json          índice: id, nome, tamanho, arquivo
 *   <appData>/tokens/token_<id>*.png|webp a foto, pelo pipeline de imageImport
 *
 * A imagem passa por `importTokenImage` (o MESMO importador de "Escolher
 * imagem..."), então ela chega aqui já reamostrada no teto de 1024 px. O nome
 * do arquivo é decidido lá dentro: `token_<id>.webp` quando houve
 * reamostragem, `token_<id>_original.<ext>` quando a foto já era pequena o
 * bastante. Por isso o índice guarda o CAMINHO que o importador devolveu, em
 * vez de montar um nome por conta própria.
 *
 * NENHUMA função daqui derruba a tela por arquivo estranho: `listarAcervo`
 * nunca lança (devolve acervo vazio + aviso em português), e as que escrevem
 * lançam com a razão já traduzida, para o toast de `App.tsx` mostrar frase de
 * gente e não `os error 5`.
 */

/** Nome da pasta dentro de `appDataDir()`. Irmã de `maps` (lib/mapFileIO.ts). */
const PASTA_DO_ACERVO = 'tokens'
const ARQUIVO_DO_INDICE = 'acervo.json'
/**
 * Onde o índice ilegível é posto de lado antes de o acervo recomeçar vazio.
 * Sem isto, o primeiro "Salvar no acervo" depois de uma corrupção passaria por
 * cima do arquivo antigo e levaria junto qualquer item que ainda desse para
 * recuperar à mão.
 */
const ARQUIVO_INVALIDO = 'acervo.json.invalido'
/** Versão do formato do índice; `acervo.json` de versão futura é lido como os campos que conhecemos. */
const VERSAO_DO_INDICE = 1

/** Item como ele fica GRAVADO no `acervo.json`. */
export interface ItemDoAcervo {
  id: string
  nome: string
  /** Tamanho em múltiplos da célula da grade — o mesmo `Token.size`. */
  tamanho: number
  /** Caminho absoluto da imagem, dentro da pasta do acervo. */
  arquivo: string
}

/** Item como a TELA o recebe: com a resposta de "a imagem ainda está lá?". */
export interface ItemDoAcervoNaTela extends ItemDoAcervo {
  /**
   * `false` quando o arquivo de imagem sumiu do disco (pasta limpa à mão,
   * pendrive removido). O item continua na lista, sem miniatura — some da
   * lista seria perder o nome que a pessoa deu, por causa de um arquivo.
   */
  imagemNoDisco: boolean
}

export interface AcervoCarregado {
  itens: ItemDoAcervoNaTela[]
  /** Frase pronta para a tela quando a leitura deu errado; `null` = tudo certo. */
  aviso: string | null
}

interface IndiceGravado {
  versao: number
  itens: ItemDoAcervo[]
}

/** Começo de TODO aviso desta tela: o usuário reconhece o assunto na primeira linha. */
const AVISO = 'Não foi possível ler o acervo de tokens'

const AVISO_ILEGIVEL = `${AVISO}: o arquivo estava ilegível. O acervo começa vazio, e o arquivo antigo ficou guardado como ${ARQUIVO_INVALIDO}, na mesma pasta.`

/** Nome que a pessoa vê quando salva um token sem nome nenhum. */
const NOME_PADRAO = 'Token sem nome'

export async function pastaDoAcervo(): Promise<string> {
  return join(await appDataDir(), PASTA_DO_ACERVO)
}

async function caminhoDoIndice(): Promise<string> {
  return join(await pastaDoAcervo(), ARQUIVO_DO_INDICE)
}

/**
 * Razão da falha, em português, para o toast de quem chamou.
 *
 * A mensagem crua do Tauri/Windows é inglês de sistema ("Access is denied.
 * (os error 5)") e não diz à pessoa o que fazer. O texto original continua
 * entre parênteses: ele é inútil para o usuário e essencial para quem for
 * consertar depois.
 */
function motivoEmPortugues(causa: unknown): string {
  const bruto = causa instanceof Error ? causa.message : String(causa)
  if (/denied|permission|forbidden|read-?only|os error 5|os error 13/i.test(bruto)) {
    return `a pasta do acervo não aceitou a gravação, provavelmente por falta de permissão de escrita (${bruto})`
  }
  return bruto
}

function falha(acao: string, causa: unknown): Error {
  return new Error(`${acao}: ${motivoEmPortugues(causa)}`)
}

/** Item do JSON que tem os quatro campos, com o tipo certo em cada um. */
function itemValido(valor: ItemDoAcervo | undefined): ItemDoAcervo | null {
  if (!valor || typeof valor !== 'object') return null
  const { id, nome, tamanho, arquivo } = valor
  if (typeof id !== 'string' || id.length === 0) return null
  if (typeof nome !== 'string') return null
  if (typeof arquivo !== 'string' || arquivo.length === 0) return null
  const medida = typeof tamanho === 'number' && Number.isFinite(tamanho) && tamanho > 0 ? tamanho : 1
  return { id, nome, tamanho: medida, arquivo }
}

/**
 * Texto do `acervo.json` → lista de itens, ou `null` quando o arquivo não é um
 * índice de acervo. O `as` é a fronteira de validação (`JSON.parse` devolve
 * `any`): NENHUM campo é usado antes de `itemValido` conferir o tipo dele —
 * mesmo padrão de `deserializeMapFields` em `lib/mapFile.ts`.
 */
export function itensDoIndice(texto: string): ItemDoAcervo[] | null {
  let lido: Partial<IndiceGravado>
  try {
    lido = JSON.parse(texto) as Partial<IndiceGravado>
  } catch {
    return null
  }
  if (!lido || typeof lido !== 'object' || !Array.isArray(lido.itens)) return null
  const itens: ItemDoAcervo[] = []
  for (const bruto of lido.itens) {
    const item = itemValido(bruto)
    // Item quebrado sai fora sozinho; o resto do acervo continua abrindo, que
    // é o oposto de "perdi todos os meus NPCs por causa de uma linha".
    if (item !== null) itens.push(item)
  }
  return itens
}

function serializarIndice(itens: readonly ItemDoAcervo[]): string {
  const indice: IndiceGravado = { versao: VERSAO_DO_INDICE, itens: [...itens] }
  return JSON.stringify(indice, null, 2)
}

/**
 * Lê o acervo. NUNCA lança: pasta que ainda não existe é acervo vazio (é a
 * primeira execução), e arquivo ilegível é acervo vazio COM aviso.
 */
export async function listarAcervo(): Promise<AcervoCarregado> {
  let texto: string
  try {
    const caminho = await caminhoDoIndice()
    if (!(await exists(caminho))) return { itens: [], aviso: null }
    texto = await readTextFile(caminho)
  } catch (erro) {
    return { itens: [], aviso: `${AVISO}: ${motivoEmPortugues(erro)}.` }
  }

  const itens = itensDoIndice(texto)
  if (itens === null) {
    await guardarIndiceInvalido(texto)
    return { itens: [], aviso: AVISO_ILEGIVEL }
  }

  const naTela: ItemDoAcervoNaTela[] = []
  for (const item of itens) {
    let imagemNoDisco = false
    try {
      imagemNoDisco = await exists(item.arquivo)
    } catch {
      // Caminho que o sistema recusa sequer consultar (unidade removida) conta
      // como imagem ausente — o item aparece sem miniatura, e nada quebra.
    }
    naTela.push({ ...item, imagemNoDisco })
  }
  return { itens: naTela, aviso: null }
}

/** Melhor esforço: se nem a cópia der, o aviso na tela continua sendo a verdade útil. */
async function guardarIndiceInvalido(texto: string): Promise<void> {
  try {
    const destino = await join(await pastaDoAcervo(), ARQUIVO_INVALIDO)
    await writeTextFile(destino, texto)
  } catch {
    // Sem cópia de segurança, mas a tela abre e o aviso aparece.
  }
}

/** `data:image/webp;base64,...` → bytes + extensão de arquivo. */
function fotoEmBytes(dataUrl: string): { bytes: Uint8Array; extensao: string } {
  const virgula = dataUrl.indexOf(',')
  const tipo = dataUrl.slice('data:image/'.length, dataUrl.indexOf(';'))
  const binario = atob(dataUrl.slice(virgula + 1))
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
  return { bytes, extensao: tipo === 'jpeg' ? 'jpg' : tipo }
}

export const SEM_FOTO_PARA_SALVAR =
  'este token ainda não tem foto — escolha uma imagem para ele antes de guardar no acervo'

/**
 * Guarda o token no acervo. Devolve o item já gravado (com o nome final, que
 * pode ter ganhado sufixo).
 *
 * Duas origens de foto, porque o token tem duas:
 *  - `image`, o arquivo no disco do mestre: passa por `importTokenImage`, o
 *    mesmo importador de "Escolher imagem...", e entra reamostrado;
 *  - `imageData`, a cópia embutida (é a única foto que o token tem quando o
 *    JOGADOR escolheu a imagem dele): já vem reduzida a 256 px por
 *    `lib/tokenPhoto.ts`, então aqui ela só é decodificada e gravada.
 *
 * NOME REPETIDO: ganha sufixo numérico — "Goblin", "Goblin (2)" — reusando o
 * `uniqueMapName` que a lista de mapas já usa pelo mesmo motivo. Permitir
 * repetido era a outra opção e foi recusada: no painel o item é uma linha com
 * foto e nome, e duas linhas idênticas não dão para distinguir na hora de
 * apagar.
 */
export async function salvarNoAcervo(token: Pick<Token, 'name' | 'size' | 'image' | 'imageData'>): Promise<ItemDoAcervo> {
  const foto = tokenPhotoRef(token)
  if (foto === null) throw new Error(SEM_FOTO_PARA_SALVAR)

  const { itens } = await listarAcervo()
  const id = crypto.randomUUID()
  const pasta = await pastaDoAcervo()

  let arquivo: string
  try {
    await ensureDir(pasta)
    if (isTokenPhotoData(foto)) {
      const { bytes, extensao } = fotoEmBytes(foto)
      arquivo = await join(pasta, `token_${id}.${extensao}`)
      await writeFile(arquivo, bytes)
    } else {
      arquivo = (await importTokenImage(foto, pasta, id)).destPath
    }
  } catch (erro) {
    throw falha('guardar a imagem do token no acervo', erro)
  }

  const nomeBase = token.name.trim().length > 0 ? token.name.trim() : NOME_PADRAO
  const item: ItemDoAcervo = {
    id,
    nome: uniqueMapName(nomeBase, itens.map((outro) => outro.nome)),
    tamanho: token.size,
    arquivo,
  }
  await gravarIndice([...itens.map(semCampoDeTela), item], 'guardar o token no acervo')
  return item
}

/** O campo `imagemNoDisco` é resposta de agora, não dado gravado. */
function semCampoDeTela(item: ItemDoAcervoNaTela): ItemDoAcervo {
  return { id: item.id, nome: item.nome, tamanho: item.tamanho, arquivo: item.arquivo }
}

async function gravarIndice(itens: readonly ItemDoAcervo[], acao: string): Promise<void> {
  try {
    await ensureDir(await pastaDoAcervo())
    await writeTextFileSafely(await caminhoDoIndice(), serializarIndice(itens))
  } catch (erro) {
    throw falha(acao, erro)
  }
}

/**
 * Apaga o item e os arquivos de imagem dele.
 *
 * Varre a pasta por `token_<id>` em vez de apagar só o caminho do índice:
 * `importTokenImage` pode ter deixado DOIS arquivos (o original e a versão
 * reamostrada) e só um deles está no índice — apagar pelo índice deixaria o
 * outro na pasta para sempre. O índice é reescrito mesmo que nenhum arquivo
 * seja removido: o item sumir da lista é o que a pessoa pediu.
 */
export async function apagarDoAcervo(id: string): Promise<void> {
  const { itens } = await listarAcervo()
  const restantes = itens.filter((item) => item.id !== id)
  await gravarIndice(restantes.map(semCampoDeTela), 'apagar o token do acervo')

  const pasta = await pastaDoAcervo()
  try {
    for (const entrada of await readDir(pasta)) {
      if (!entrada.isFile || entrada.name.indexOf(`token_${id}`) !== 0) continue
      await remove(await join(pasta, entrada.name))
    }
  } catch {
    // O item já saiu da lista; arquivo órfão na pasta é lixo, não defeito
    // visível, e avisar sobre ele depois de a ação ter dado certo só assusta.
  }
}

export const ITEM_NAO_ENCONTRADO = 'este token não está mais no acervo'

/** Troca o nome do item. Mesmo sufixo numérico de `salvarNoAcervo` em caso de colisão. */
export async function renomearNoAcervo(id: string, nome: string): Promise<ItemDoAcervo> {
  const { itens } = await listarAcervo()
  const alvo = itens.find((item) => item.id === id)
  if (!alvo) throw new Error(ITEM_NAO_ENCONTRADO)

  const base = nome.trim().length > 0 ? nome.trim() : NOME_PADRAO
  const outros = itens.filter((item) => item.id !== id)
  const renomeado: ItemDoAcervo = { ...semCampoDeTela(alvo), nome: uniqueMapName(base, outros.map((item) => item.nome)) }
  await gravarIndice(
    itens.map((item) => (item.id === id ? renomeado : semCampoDeTela(item))),
    'renomear o token do acervo',
  )
  return renomeado
}

export const IMAGEM_SUMIU_DO_ACERVO =
  'A imagem deste token não está mais no disco: ele foi colocado no mapa sem foto.'

/**
 * Traz a foto do acervo para DENTRO do mapa, do mesmo jeito que "Escolher
 * imagem..." faria: o arquivo é copiado para a pasta do mapa
 * (`importTokenImage`) e a cópia embutida sai junto (`buildTokenSharedPhoto`),
 * que é a única forma da foto atravessar o recorte e chegar ao jogador
 * (`lib/fogFilter.ts`).
 *
 * Copiar, e não apontar para a pasta do acervo, é o que mantém "Exportar mapa
 * (pasta)" levando a foto junto — `rebaseMapImagePaths` só reaponta o que mora
 * dentro da pasta do mapa.
 */
export async function trazerDoAcervo(
  item: ItemDoAcervoNaTela,
  mapDir: string,
  tokenId: string,
): Promise<{ image: string | null; imageData: string | null }> {
  if (!item.imagemNoDisco) return { image: null, imageData: null }
  const importada = await importTokenImage(item.arquivo, mapDir, tokenId)
  let imageData: string | null = null
  try {
    imageData = await buildTokenSharedPhoto(item.arquivo)
  } catch {
    // Mesmo critério de `App.tsx` ao escolher a imagem: perder a foto INTEIRA
    // porque a cópia que viaja não saiu seria trocar um problema pequeno
    // (jogador vê bolinha) por um grande (mestre também vê).
  }
  return { image: importada.destPath, imageData }
}
