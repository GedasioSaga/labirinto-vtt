import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
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
/** Onde fica a cópia do `sons.json` que não deu para ler, antes de a biblioteca recomeçar vazia. */
export const ARQUIVO_DE_SONS_ILEGIVEL = 'sons.invalido.json'

/** Avisos de som ficam como os de mídia: pedem leitura, não ação. */
const AVISO_DE_SOM_MS = 7000
const NAO_LEU = 'Não foi possível ler os sons desta aventura'

export interface BibliotecaLida {
  biblioteca: BibliotecaDeSons
  /** Frase pronta para a tela quando a leitura deu errado; `null` = tudo certo (ou não havia `sons.json`). */
  aviso: string | null
  /** `false` = há um `sons.json` que não foi lido; gravar agora passaria por cima dele. */
  podeGravar: boolean
}

function motivo(causa: unknown): string {
  const texto = causa instanceof Error ? causa.message : String(causa)
  return /os error 5|denied|negado/i.test(texto) ? 'o Windows negou o acesso ao arquivo (outro programa pode estar com ele aberto)' : texto
}

/** Lê o `sons.json` da aventura. Nunca lança: o erro vira `aviso`, e `podeGravar: false` barra quem grava. */
export async function lerBibliotecaDaAventura(pastaDaAventura: string): Promise<BibliotecaLida> {
  let texto: string
  try {
    const caminho = await join(pastaDaAventura, ARQUIVO_DE_SONS)
    // Aventura de antes dos sons: biblioteca vazia, sem aviso e sem migrar nada.
    if (!(await exists(caminho))) return { biblioteca: bibliotecaDeSonsVazia(), aviso: null, podeGravar: true }
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
  try {
    await writeTextFile(await join(pastaDaAventura, ARQUIVO_DE_SONS_ILEGIVEL), texto)
  } catch {
    // Sem a cópia, a biblioteca NÃO recomeça: gravar agora passaria por cima do único exemplar.
    return { biblioteca: bibliotecaDeSonsVazia(), aviso: `${NAO_LEU}: o arquivo estava ilegível e não deu para guardar uma cópia dele.`, podeGravar: false }
  }
  return {
    biblioteca: bibliotecaDeSonsVazia(),
    aviso: `${NAO_LEU}: o arquivo estava ilegível. A biblioteca começa vazia, e o arquivo antigo ficou guardado como ${ARQUIVO_DE_SONS_ILEGIVEL}, na pasta da aventura.`,
    podeGravar: true,
  }
}

function avisarAudioQueFaltou(levada: MidiaLevada): void {
  const n = levada.faltaram.length
  if (n === 0) return
  const texto =
    n === 1
      ? '1 som não foi junto com a aventura: o arquivo dele não está neste computador (ou o disco recusou). Em outro computador ele não toca.'
      : `${n} sons não foram junto com a aventura: os arquivos deles não estão neste computador (ou o disco recusou). Em outro computador eles não tocam.`
  // A chave segura o aviso único: o salvamento sozinho repete a gravação a cada mudança.
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

let filaDaGravacao: Promise<void> = Promise.resolve()

/** Uma gravação depois da outra: a mais nova nunca é passada para trás por uma mais velha que terminou depois. */
function naFila<T>(operacao: () => Promise<T>): Promise<T> {
  const resultado = filaDaGravacao.then(operacao)
  filaDaGravacao = resultado.then(
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
    avisarAudioQueFaltou(levada)
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
