import { exists, readDir, readTextFile, remove, writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import type { Token } from '../types/map'
import { buildTokenSharedPhoto, importTokenImage } from './imageImport'
import { ErroQueEnsina } from './erroQueEnsina'
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
 * bastante. O índice guarda o NOME que o importador escolheu — não o caminho
 * inteiro, para a pasta do acervo poder ser copiada para outra máquina sem que
 * as fotos sumam (ver `ItemDoAcervo.arquivo`).
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
/** Cópia do índice tirada antes de CADA gravação — ver `guardarIndiceAnterior`. */
const ARQUIVO_ANTERIOR = 'acervo.json.anterior'
/** Versão do formato do índice; `acervo.json` de versão futura é lido como os campos que conhecemos. */
const VERSAO_DO_INDICE = 1

/** Item como ele fica GRAVADO no `acervo.json`. */
export interface ItemDoAcervo {
  id: string
  nome: string
  /** Tamanho em múltiplos da célula da grade — o mesmo `Token.size`. */
  tamanho: number
  /**
   * NOME do arquivo de imagem dentro da pasta do acervo — `token_<id>.webp` —,
   * nunca o caminho inteiro.
   *
   * Guardar o caminho absoluto quebrava a única forma natural de levar o
   * acervo junto: copiar `%APPDATA%\com.labirinto.app\tokens` para outro PC (ou
   * para outro usuário do Windows, ou depois de reinstalar com perfil novo).
   * Depois da cópia, todo `arquivo` apontava para o `C:\Users\<o de antes>` e o
   * painel abria com a estante inteira sem miniatura, com os arquivos ali do
   * lado do próprio `acervo.json`. Índice antigo, com caminho absoluto, continua
   * abrindo: `caminhoDaImagem` reconhece os dois formatos.
   */
  arquivo: string
}

/** O que `itensDoIndice` extrai do texto: o que ele entende, e o que ele preserva sem entender. */
export interface IndiceLido {
  itens: ItemDoAcervo[]
  /** Itens que este código não reconhece e regrava intactos — ver `itensDoIndice`. */
  ignorados: unknown[]
}

/** Item como a TELA o recebe: com a resposta de "a imagem ainda está lá?". */
export interface ItemDoAcervoNaTela extends ItemDoAcervo {
  /**
   * `false` quando o arquivo de imagem sumiu do disco (pasta limpa à mão,
   * pendrive removido). O item continua na lista, sem miniatura — some da
   * lista seria perder o nome que a pessoa deu, por causa de um arquivo.
   */
  imagemNoDisco: boolean
  /** Caminho absoluto de agora, resolvido a partir de `arquivo` e da pasta do acervo. */
  caminho: string
}

export interface AcervoCarregado {
  itens: ItemDoAcervoNaTela[]
  /** Frase pronta para a tela quando a leitura deu errado; `null` = tudo certo. */
  aviso: string | null
  /**
   * O índice foi LIDO de verdade? Esta é a diferença entre "o acervo está
   * vazio" e "não deu para saber o que tem no acervo", e ela existe porque as
   * duas chegavam aqui como `itens: []`.
   *
   * Sem ela, uma leitura que falhasse por I/O (arquivo travado por antivírus ou
   * sincronizador, permissão negada) fazia o próximo "Salvar no acervo" gravar
   * um índice com UM item e o próximo "Apagar" gravar um índice VAZIO — por
   * cima de um acervo bom, sem erro nenhum na tela. Medido em 18/09/2026 com
   * `apagarDoAcervo` contra um disco falso: 20 itens viravam 0 e as 19 imagens
   * ficavam órfãs na pasta. Quem grava agora recusa o trabalho enquanto isto
   * for `false`.
   *
   * JSON ilegível NÃO cai aqui: ali o arquivo antigo é preservado como
   * `acervo.json.invalido` antes de o acervo recomeçar vazio, e recomeçar é o
   * único caminho possível.
   */
  lido: boolean
  /** Itens do índice que este código não reconhece; voltam intactos na gravação. */
  ignorados: unknown[]
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
/** A mensagem crua do sistema, do jeito que ela veio — o que vai entre parênteses. */
function textoCru(causa: unknown): string {
  return causa instanceof Error ? causa.message : String(causa)
}

function motivoEmPortugues(causa: unknown): string {
  const bruto = textoCru(causa)
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
export function itensDoIndice(texto: string): IndiceLido | null {
  let lido: Partial<IndiceGravado>
  try {
    lido = JSON.parse(texto) as Partial<IndiceGravado>
  } catch {
    return null
  }
  if (!lido || typeof lido !== 'object' || !Array.isArray(lido.itens)) return null
  const itens: ItemDoAcervo[] = []
  const ignorados: unknown[] = []
  for (const bruto of lido.itens) {
    const item = itemValido(bruto)
    // Item quebrado sai fora sozinho; o resto do acervo continua abrindo, que
    // é o oposto de "perdi todos os meus NPCs por causa de uma linha". Mas ele
    // sai fora só da LISTA, não do arquivo: guardado aqui, volta inteiro na
    // próxima gravação. Sem isso, um item que uma versão futura do formato
    // gravou (campo novo que este código não conhece) era apagado de vez pelo
    // primeiro "Salvar no acervo" de uma versão antiga.
    if (item !== null) itens.push(item)
    else ignorados.push(bruto)
  }
  return { itens, ignorados }
}

function serializarIndice(itens: readonly ItemDoAcervo[], ignorados: readonly unknown[]): string {
  const indice: IndiceGravado = { versao: VERSAO_DO_INDICE, itens: [...itens, ...(ignorados as ItemDoAcervo[])] }
  return JSON.stringify(indice, null, 2)
}

/**
 * Lê o acervo. NUNCA lança: pasta que ainda não existe é acervo vazio (é a
 * primeira execução), e arquivo ilegível é acervo vazio COM aviso.
 */
export async function listarAcervo(): Promise<AcervoCarregado> {
  let texto: string
  let pasta: string
  try {
    pasta = await pastaDoAcervo()
    const caminho = await join(pasta, ARQUIVO_DO_INDICE)
    // Pasta ainda sem índice é a primeira execução, não uma leitura que falhou:
    // `lido` continua verdadeiro e o primeiro "Salvar no acervo" pode gravar.
    if (!(await exists(caminho))) return { itens: [], aviso: null, lido: true, ignorados: [] }
    texto = await readTextFile(caminho)
  } catch (erro) {
    return { itens: [], aviso: `${AVISO}: ${motivoEmPortugues(erro)}.`, lido: false, ignorados: [] }
  }

  const indice = itensDoIndice(texto)
  if (indice === null) {
    await guardarIndiceInvalido(texto)
    return { itens: [], aviso: AVISO_ILEGIVEL, lido: true, ignorados: [] }
  }

  const naTela: ItemDoAcervoNaTela[] = []
  for (const item of indice.itens) {
    const caminho = await caminhoDaImagem(item.arquivo, pasta)
    let imagemNoDisco = false
    try {
      imagemNoDisco = await exists(caminho)
    } catch {
      // Caminho que o sistema recusa sequer consultar (unidade removida) conta
      // como imagem ausente — o item aparece sem miniatura, e nada quebra.
    }
    naTela.push({ ...item, imagemNoDisco, caminho })
  }
  return { itens: naTela, aviso: null, lido: true, ignorados: indice.ignorados }
}

/**
 * `arquivo` do índice → caminho absoluto de agora.
 *
 * Aceita os DOIS formatos porque o índice de 18/09/2026 (o único que pode
 * existir antes desta mudança) guardava caminho absoluto: quem já tem acervo
 * gravado continua vendo as fotos, e o formato novo — só o nome — passa a valer
 * a partir da próxima gravação.
 */
async function caminhoDaImagem(arquivo: string, pasta: string): Promise<string> {
  const absoluto = arquivo.indexOf('/') !== -1 || arquivo.indexOf('\\') !== -1
  return absoluto ? arquivo : join(pasta, arquivo)
}

/** Caminho absoluto → só o nome do arquivo, que é o que o índice guarda. */
function nomeDeArquivo(caminho: string): string {
  const corte = Math.max(caminho.lastIndexOf('/'), caminho.lastIndexOf('\\'))
  return corte === -1 ? caminho : caminho.slice(corte + 1)
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
  if (virgula === -1) throw new Error('a foto embutida deste token está num formato que não dá para gravar')
  // Hoje só chega aqui o que `isTokenPhotoData` aprova, e o padrão dele exige
  // `;base64,` (lib/tokenPhoto.ts:23) — então o `;` existe sempre. O piso é
  // para o dia em que esse padrão aceitar `data:image/webp,...`: sem ele, o
  // `slice` até -1 comeria a última letra e o arquivo sairia `.web`.
  const pontoEVirgula = dataUrl.indexOf(';')
  const fimDoTipo = pontoEVirgula === -1 || pontoEVirgula > virgula ? virgula : pontoEVirgula
  const tipo = dataUrl.slice('data:image/'.length, fimDoTipo)
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
  // `ErroQueEnsina`, e não `Error`: a frase termina numa tarefa da pessoa
  // ("escolha uma imagem para ele antes de guardar no acervo"), e quem lança é
  // quem sabe disso. `App.tsx` lê a marca e mostra o aviso sem prazo — ver
  // `lib/erroQueEnsina.ts`.
  if (foto === null) throw new ErroQueEnsina(SEM_FOTO_PARA_SALVAR)

  const acervo = await listarAcervo()
  exigirLeitura(acervo, 'guardar o token no acervo')

  // O nome sai ANTES da gravação da imagem. Token de mapa antigo, ou criado
  // fora do type-checker, pode chegar sem `name` — e com a conta feita depois,
  // `name.trim()` estourava com o arquivo de imagem já no disco, deixando uma
  // foto órfã que nenhum "apagar" alcança (ele só varre o que tem item no
  // índice) e um toast em inglês de sistema.
  const nomeCru = typeof token.name === 'string' ? token.name.trim() : ''
  const nomeBase = nomeCru.length > 0 ? nomeCru : NOME_PADRAO
  const tamanho = typeof token.size === 'number' && Number.isFinite(token.size) && token.size > 0 ? token.size : 1

  const id = crypto.randomUUID()
  const pasta = await pastaDoAcervo()

  let arquivo: string
  try {
    await ensureDir(pasta)
    if (isTokenPhotoData(foto)) {
      const { bytes, extensao } = fotoEmBytes(foto)
      arquivo = `token_${id}.${extensao}`
      await writeFile(await join(pasta, arquivo), bytes)
    } else {
      arquivo = nomeDeArquivo((await importTokenImage(foto, pasta, id)).destPath)
    }
  } catch (erro) {
    throw falha('guardar a imagem do token no acervo', erro)
  }

  const item: ItemDoAcervo = {
    id,
    nome: uniqueMapName(nomeBase, acervo.itens.map((outro) => outro.nome)),
    tamanho,
    arquivo,
  }
  await gravarIndice([...acervo.itens.map(semCampoDeTela), item], 'guardar o token no acervo', acervo.ignorados)
  return item
}

export const ACERVO_NAO_LIDO =
  'não deu para ler o acervo agora, então nada foi alterado. Feche outro programa que possa estar com a pasta aberta (antivírus, sincronizador de nuvem) e tente de novo'

/**
 * Recusa a gravação enquanto o índice não pôde ser lido.
 *
 * É a guarda que impede o defeito medido em 18/09/2026: sem ela, uma leitura
 * falha virava lista vazia e a gravação seguinte passava por cima do acervo
 * inteiro, calada. Vale para salvar, apagar e renomear — todos os três
 * reescrevem o índice inteiro a partir do que leram.
 */
function exigirLeitura(acervo: AcervoCarregado, acao: string): void {
  if (acervo.lido) return
  throw new Error(`${acao}: ${ACERVO_NAO_LIDO}`)
}

/** O que é resposta de agora (`imagemNoDisco`, `caminho`) não vira dado gravado. */
function semCampoDeTela(item: ItemDoAcervoNaTela): ItemDoAcervo {
  return { id: item.id, nome: item.nome, tamanho: item.tamanho, arquivo: item.arquivo }
}

async function gravarIndice(itens: readonly ItemDoAcervo[], acao: string, ignorados: readonly unknown[]): Promise<void> {
  try {
    const caminho = await caminhoDoIndice()
    await ensureDir(await pastaDoAcervo())
    await guardarIndiceAnterior(caminho)
    await writeTextFileSafely(caminho, serializarIndice(itens, ignorados))
  } catch (erro) {
    throw falha(acao, erro)
  }
}

/**
 * Cópia do índice ANTES de cada gravação, em `acervo.json.anterior`.
 *
 * `writeTextFileSafely` já protege contra a gravação interrompida no meio, mas
 * não contra a gravação que dá certo com a lista errada. Uma linha de defesa a
 * mais custa um arquivo pequeno e é a diferença entre "perdi 30 NPCs" e
 * "renomeie um arquivo". Melhor esforço: sem a cópia, a gravação segue — travar
 * o salvamento por causa do backup seria trocar um risco por um estorvo certo.
 */
async function guardarIndiceAnterior(caminho: string): Promise<void> {
  try {
    if (!(await exists(caminho))) return
    await writeTextFile(await join(await pastaDoAcervo(), ARQUIVO_ANTERIOR), await readTextFile(caminho))
  } catch {
    // Sem cópia desta vez; a gravação em si continua valendo.
  }
}

/**
 * A foto que o disco RECUSOU apagar.
 *
 * `ErroQueEnsina`, e não `Error`: a frase termina numa tarefa da pessoa —
 * fechar o programa que está segurando o arquivo e apagá-lo à mão —, e essa
 * tarefa acontece FORA do app, na pasta, com o nome do arquivo na mão. O nome
 * é um `token_<uuid>...`: um aviso que se apaga sozinho aos 7 s leva embora a
 * única informação que torna a tarefa possível. Mesmo argumento do conserto de
 * 21/09/2026 em `stores/toastStore.ts`, e o oposto de `IMAGEM_SUMIU_DO_ACERVO`,
 * que relata um arquivo que JÁ não existe e não deixa nada a fazer.
 *
 * `arquivos` fica no erro (e não só embutido na frase) para quem tratar poder
 * contar e listar sem reler texto.
 */
export class FotoQueSobrouNoDisco extends ErroQueEnsina {
  readonly arquivos: readonly string[]

  constructor(message: string, arquivos: readonly string[]) {
    super(message)
    this.name = 'FotoQueSobrouNoDisco'
    this.arquivos = arquivos
  }
}

/**
 * O erro é "o item saiu da estante, mas a foto ficou no disco"?
 *
 * Existe para `App.tsx` escolher a frase de abertura certa sem saber como a
 * marca é feita — mesmo motivo de `ensinaOQueFazer` em `lib/erroQueEnsina.ts`.
 */
export function fotoSobrouNoDisco(err: unknown): err is FotoQueSobrouNoDisco {
  return err instanceof FotoQueSobrouNoDisco
}

/** Frase do aviso: o que sobrou, onde, por quê, e o que a pessoa faz com isso. */
function avisoDeFotoQueSobrou(arquivos: readonly string[], pasta: string, causa: unknown): string {
  const lista = arquivos.join(', ')
  const quantos = arquivos.length === 1 ? 'a foto' : 'as fotos'
  return (
    `${quantos} ${lista} continua${arquivos.length === 1 ? '' : 'm'} em ${pasta} (${textoCru(causa)}). ` +
    'O nome já saiu da estante; feche o programa que estiver com o arquivo aberto ' +
    '(antivírus, sincronizador de nuvem, visualizador de fotos) e apague-o à mão por lá.'
  )
}

/**
 * Apaga o item e os arquivos de imagem dele.
 *
 * Varre a pasta por `token_<id>` em vez de apagar só o caminho do índice:
 * `importTokenImage` pode ter deixado DOIS arquivos (o original e a versão
 * reamostrada) e só um deles está no índice — apagar pelo índice deixaria o
 * outro na pasta para sempre.
 *
 * O ÍNDICE SAI PRIMEIRO, E ISSO É DE PROPÓSITO: tirar o item da lista é o que a
 * pessoa pediu, e segurar o nome na estante porque o antivírus não soltou o
 * arquivo faria o gesto dela não acontecer por um motivo que não é dela. O que
 * NÃO pode é a tela ficar idêntica à de um apagamento que deu certo — era esse
 * o defeito: o `catch` em volta da varredura engolia `os error 5` e a foto
 * ficava no `%APPDATA%` para sempre, calada (jornada
 * `e2e/task-jornada-apagar-limpa-disco.spec.ts`).
 *
 * A varredura NÃO para no primeiro arquivo que resiste: o item pode ter dois, e
 * apagar o que dá enquanto se anota o que sobrou deixa menos lixo do que
 * desistir no primeiro erro. Só no fim, com a lista completa, o erro sobe.
 */
export async function apagarDoAcervo(id: string): Promise<void> {
  const acervo = await listarAcervo()
  exigirLeitura(acervo, 'apagar o token do acervo')
  const alvo = acervo.itens.find((item) => item.id === id)
  const restantes = acervo.itens.filter((item) => item.id !== id)
  await gravarIndice(restantes.map(semCampoDeTela), 'apagar o token do acervo', acervo.ignorados)

  const pasta = await pastaDoAcervo()
  const sobraram: string[] = []
  let causa: unknown = null
  try {
    for (const entrada of await readDir(pasta)) {
      if (!entrada.isFile || entrada.name.indexOf(`token_${id}`) !== 0) continue
      try {
        await remove(await join(pasta, entrada.name))
      } catch (erro) {
        sobraram.push(entrada.name)
        if (causa === null) causa = erro
      }
    }
  } catch (erro) {
    // Nem LISTAR a pasta deu (unidade removida, permissão negada na pasta).
    // Não dá para saber quantos arquivos são; o índice sabe o nome de um deles,
    // e um nome verdadeiro vale mais que um aviso genérico. Item que já não
    // estava no índice não tem nome nenhum a oferecer — aí vai o prefixo.
    sobraram.push(alvo === undefined ? `token_${id}*` : nomeDeArquivo(alvo.arquivo))
    causa = erro
  }

  if (sobraram.length === 0) return
  throw new FotoQueSobrouNoDisco(avisoDeFotoQueSobrou(sobraram, pasta, causa), sobraram)
}

export const ITEM_NAO_ENCONTRADO = 'este token não está mais no acervo'

/** Troca o nome do item. Mesmo sufixo numérico de `salvarNoAcervo` em caso de colisão. */
export async function renomearNoAcervo(id: string, nome: string): Promise<ItemDoAcervo> {
  const acervo = await listarAcervo()
  exigirLeitura(acervo, 'renomear o token do acervo')
  const alvo = acervo.itens.find((item) => item.id === id)
  if (!alvo) throw new Error(ITEM_NAO_ENCONTRADO)

  const base = nome.trim().length > 0 ? nome.trim() : NOME_PADRAO
  const outros = acervo.itens.filter((item) => item.id !== id)
  const renomeado: ItemDoAcervo = { ...semCampoDeTela(alvo), nome: uniqueMapName(base, outros.map((item) => item.nome)) }
  await gravarIndice(
    acervo.itens.map((item) => (item.id === id ? renomeado : semCampoDeTela(item))),
    'renomear o token do acervo',
    acervo.ignorados,
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
  // `caminho`, não `arquivo`: o índice guarda o NOME do arquivo, e quem copia
  // precisa do caminho absoluto resolvido contra a pasta do acervo de AGORA.
  const importada = await importTokenImage(item.caminho, mapDir, tokenId)
  let imageData: string | null = null
  try {
    imageData = await buildTokenSharedPhoto(item.caminho)
  } catch {
    // Mesmo critério de `App.tsx` ao escolher a imagem: perder a foto INTEIRA
    // porque a cópia que viaja não saiu seria trocar um problema pequeno
    // (jogador vê bolinha) por um grande (mestre também vê).
  }
  return { image: importada.destPath, imageData }
}

/** O que a peça trazida do acervo leva ao nascer no mapa. */
export interface PecaDoAcervo {
  id: string
  size: number
  image: string | null
  imageData: string | null
  npc: true
}

/**
 * A peça que sai do acervo nasce marcada como NPC: o acervo É a estante de
 * NPCs prontos do mestre, e sem a marca o Mordomo recém-colocado virava o
 * primeiro botão "Atribuir" do card de quem espera personagem (cena aberta
 * vem antes das outras). Quando o mestre quer entregar a peça a um jogador,
 * desliga "Ficha de NPC" no painel ou usa a lista completa.
 */
export function pecaDoAcervo(
  item: Pick<ItemDoAcervoNaTela, 'tamanho'>,
  tokenId: string,
  foto: { image: string | null; imageData: string | null },
): PecaDoAcervo {
  return { id: tokenId, size: item.tamanho, image: foto.image, imageData: foto.imageData, npc: true }
}
