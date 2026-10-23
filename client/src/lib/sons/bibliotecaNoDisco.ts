import { exists, readDir, readTextFile, stat, writeTextFile } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import { useToastStore } from '../../stores/toastStore'
import { writeTextFileSafely } from '../mapFileIO'
import { copiarMidiaParaAPasta, pastaDaMidiaDaAventura, type MidiaLevada } from '../midiaDaPasta'
import { guardarAudio } from '../midiaNoDisco'
import { bibliotecaDeSonsVazia, bibliotecaDoTexto, idsDeAudioDaBiblioteca, serializarBiblioteca, type BibliotecaDeSons, type FonteDeArquivo } from './biblioteca'

/**
 * A BIBLIOTECA DE SONS NO DISCO: `<pasta da aventura>/sons.json`, ao lado do
 * `adventure.json` (que não ganha campo nenhum), e os áudios em
 * `<pasta da aventura>/midia/` (`lib/midiaDaPasta.ts`), para a aventura levada
 * a outro computador abrir com os sons. Na volta, quem traz os áudios para
 * `<appData>/midia` é a abertura da aventura (`trazerMidiaAoAbrir`), que já
 * confere cada um pela assinatura dos bytes e pelo hash.
 *
 * Aventura antiga não tem `sons.json`: abre vazia, sem aviso, e nada é
 * gravado até o mestre mudar alguma coisa. App antigo abrindo aventura nova
 * ignora o `sons.json` e os áudios.
 */

export const ARQUIVO_DE_SONS = 'sons.json'
/**
 * Teto do `sons.json`: 200 efeitos ocupam bem menos de 100 KB. Acima disto o
 * arquivo nem é lido (um de 2 GB derrubaria o app) e nada é regravado por cima.
 */
export const SONS_JSON_MAX_BYTES = 1024 * 1024

/** Avisos de som ficam como os de mídia: pedem leitura, não ação. */
const AVISO_DE_SOM_MS = 7000
const NAO_LEU = 'Não foi possível ler os sons desta aventura'

function doisDigitos(numero: number): string {
  return String(numero).padStart(2, '0')
}

/**
 * Onde fica a cópia do `sons.json` que não deu para ler, antes de a
 * biblioteca recomeçar vazia: `sons.invalido-AAAAMMDD-HHMMSS.json`, na hora
 * local. Nome novo a cada vez: a cópia de uma abertura nunca apaga a de outra.
 */
export function nomeDaCopiaDoSonsIlegivel(quando: Date): string {
  const dia = `${quando.getFullYear()}${doisDigitos(quando.getMonth() + 1)}${doisDigitos(quando.getDate())}`
  const hora = `${doisDigitos(quando.getHours())}${doisDigitos(quando.getMinutes())}${doisDigitos(quando.getSeconds())}`
  return `sons.invalido-${dia}-${hora}.json`
}

export interface BibliotecaLida {
  biblioteca: BibliotecaDeSons
  /** Frase pronta para a tela quando a leitura deu errado; `null` = tudo certo (ou não havia `sons.json`). */
  aviso: string | null
  /** `false` = há um `sons.json` que não foi lido; gravar agora passaria por cima dele. */
  podeGravar: boolean
}

/**
 * O erro do disco em frase para a tela. A mensagem crua do `plugin-fs` traz
 * o caminho absoluto (com o nome de usuário do Windows) e não vai para o
 * aviso: só o código do sistema, que serve para procurar o problema.
 */
function motivo(causa: unknown): string {
  const texto = causa instanceof Error ? causa.message : String(causa)
  if (/os error 5\b|denied|negado/i.test(texto)) return 'o Windows negou o acesso ao arquivo (outro programa pode estar com ele aberto)'
  if (/forbidden path|not allowed/i.test(texto)) return 'o app não tem permissão de usar essa pasta'
  const codigo = /os error (\d+)/i.exec(texto)
  return codigo === null ? 'o disco recusou a operação' : `o disco recusou a operação (os error ${codigo[1]})`
}

/**
 * Guarda o texto ilegível numa cópia nova; devolve o nome dela, ou `null` sem
 * cópia. O texto é de quem escreveu o `sons.json` (pode ser de qualquer um):
 * a cópia nunca passa por cima de arquivo que já existe (`createNew`) nem
 * escreve por um atalho, que poderia apontar para fora da pasta. Atalho se vê
 * na listagem da pasta: o `lstat` não está entre as permissões do app.
 */
async function guardarCopiaDoIlegivel(pastaDaAventura: string, texto: string): Promise<string | null> {
  const nome = nomeDaCopiaDoSonsIlegivel(new Date())
  try {
    const entradas = await readDir(pastaDaAventura)
    if (entradas.some((entrada) => entrada.name === nome && entrada.isSymlink)) return null
    await writeTextFile(await join(pastaDaAventura, nome), texto, { createNew: true })
    return nome
  } catch {
    return null
  }
}

/**
 * Lê o `sons.json` da aventura. Nunca lança: o erro vira `aviso`, e
 * `podeGravar: false` barra quem grava. Entra na MESMA fila das gravações:
 * voltar a uma aventura cuja última mudança ainda está indo para o disco lê
 * o arquivo já com ela, e não o de antes.
 */
export function lerBibliotecaDaAventura(pastaDaAventura: string): Promise<BibliotecaLida> {
  return naFila(() => lerAgora(pastaDaAventura))
}

async function lerAgora(pastaDaAventura: string): Promise<BibliotecaLida> {
  let texto: string
  try {
    const caminho = await join(pastaDaAventura, ARQUIVO_DE_SONS)
    // Aventura de antes dos sons: biblioteca vazia, sem aviso e sem migrar nada.
    if (!(await exists(caminho))) return { biblioteca: bibliotecaDeSonsVazia(), aviso: null, podeGravar: true }
    // O tamanho antes do texto: o arquivo enorme não entra na memória.
    if ((await stat(caminho)).size > SONS_JSON_MAX_BYTES) {
      return {
        biblioteca: bibliotecaDeSonsVazia(),
        aviso: `${NAO_LEU}: sons.json grande demais (passa de ${SONS_JSON_MAX_BYTES / (1024 * 1024)} MB). Até ele ser trocado, nada novo é guardado, para não apagar o que está lá.`,
        podeGravar: false,
      }
    }
    texto = await readTextFile(caminho)
  } catch (erro) {
    return { biblioteca: bibliotecaDeSonsVazia(), aviso: `${NAO_LEU}: ${motivo(erro)}.`, podeGravar: false }
  }
  const lido = bibliotecaDoTexto(texto)
  if (lido.ok) return { biblioteca: lido.biblioteca, aviso: null, podeGravar: true }
  if (lido.motivo === 'versao-mais-nova') {
    return {
      biblioteca: bibliotecaDeSonsVazia(),
      aviso: 'Os sons desta aventura foram gravados por uma versão mais nova do app: atualize para usá-los. Até lá, nada novo é guardado, para não apagar os de lá.',
      podeGravar: false,
    }
  }
  const copia = await guardarCopiaDoIlegivel(pastaDaAventura, texto)
  if (copia === null) {
    // Sem a cópia, a biblioteca NÃO recomeça: gravar agora passaria por cima do único exemplar.
    return { biblioteca: bibliotecaDeSonsVazia(), aviso: `${NAO_LEU}: o arquivo estava ilegível e não deu para guardar uma cópia dele.`, podeGravar: false }
  }
  return {
    biblioteca: bibliotecaDeSonsVazia(),
    aviso: `${NAO_LEU}: o arquivo estava ilegível. A biblioteca começa vazia, e o arquivo antigo ficou guardado como ${copia}, na pasta da aventura.`,
    podeGravar: true,
  }
}

/**
 * Por pasta de aventura, os ids que faltaram no último aviso. O salvamento
 * sozinho grava a cada mudança: o mesmo som faltando não avisa de novo depois
 * que o aviso sai da tela, só quando o conjunto que falta muda.
 */
const faltaJaAvisada = new Map<string, string>()

function avisarAudioQueFaltou(pastaDaAventura: string, levada: MidiaLevada): void {
  const n = levada.faltaram.length
  if (n === 0) {
    faltaJaAvisada.delete(pastaDaAventura)
    return
  }
  const conjunto = [...levada.faltaram].sort().join('|')
  if (faltaJaAvisada.get(pastaDaAventura) === conjunto) return
  faltaJaAvisada.set(pastaDaAventura, conjunto)
  const texto =
    n === 1
      ? '1 som não foi junto com a aventura: o arquivo dele não está neste computador (ou o disco recusou). Em outro computador ele não toca.'
      : `${n} sons não foram junto com a aventura: os arquivos deles não estão neste computador (ou o disco recusou). Em outro computador eles não tocam.`
  // A chave ainda funde com o aviso que está na tela, se o conjunto mudou enquanto ele aparecia.
  useToastStore.getState().push('info', texto, AVISO_DE_SOM_MS, { chave: 'sons-faltou' })
}

/** Leva os áudios da biblioteca para `<aventura>/midia`. Nunca lança: o que não foi vira "faltou". */
async function levarAudios(pastaDaAventura: string, biblioteca: BibliotecaDeSons): Promise<MidiaLevada> {
  const ids = idsDeAudioDaBiblioteca(biblioteca)
  if (ids.length === 0) return { copiados: [], faltaram: [] }
  try {
    return await copiarMidiaParaAPasta(await pastaDaMidiaDaAventura(pastaDaAventura), ids)
  } catch {
    return { copiados: [], faltaram: ids }
  }
}

let filaDoDisco: Promise<void> = Promise.resolve()

/**
 * Uma operação no `sons.json` depois da outra: a gravação mais nova nunca é
 * passada para trás por uma mais velha que terminou depois, e a leitura vê a
 * gravação pedida antes dela.
 */
function naFila<T>(operacao: () => Promise<T>): Promise<T> {
  const resultado = filaDoDisco.then(operacao)
  filaDoDisco = resultado.then(
    () => undefined,
    () => undefined,
  )
  return resultado
}

/**
 * Grava a biblioteca INTEIRA na pasta da aventura: primeiro os áudios (para o
 * `sons.json` nunca apontar para um arquivo que ainda não chegou), depois o
 * `sons.json`, pela gravação segura. Áudio que não foi vira aviso e não
 * impede o resto; o `sons.json` que não grava lança com a frase pronta.
 */
export function gravarBibliotecaNaAventura(pastaDaAventura: string, biblioteca: BibliotecaDeSons): Promise<MidiaLevada> {
  return naFila(async () => {
    const levada = await levarAudios(pastaDaAventura, biblioteca)
    try {
      await writeTextFileSafely(await join(pastaDaAventura, ARQUIVO_DE_SONS), serializarBiblioteca(biblioteca))
    } catch (erro) {
      throw new Error(`Não foi possível gravar os sons da aventura: ${motivo(erro)}.`)
    }
    avisarAudioQueFaltou(pastaDaAventura, levada)
    return levada
  })
}

/**
 * O arquivo de áudio escolhido pelo mestre, guardado em `<appData>/midia`
 * (`guardarAudio`) e pronto para virar a fonte de um efeito. Lança com a frase
 * pronta: `AUDIO_GRANDE_DEMAIS` acima de 15 MB, `AUDIO_NAO_E_AUDIO` quando a
 * assinatura dos bytes não é de MP3, OGG, WAV nem M4A (o nome não conta).
 */
export async function guardarArquivoDeSom(bytes: Uint8Array): Promise<FonteDeArquivo> {
  const ref = await guardarAudio(bytes)
  return { tipo: 'arquivo', ref, bytes: bytes.length }
}
