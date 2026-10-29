import { readDir, stat } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import { ehIdDeAudio, idDaRefDeAudio, idDoAudio, refDoId } from '../../midia'
import { guardarAudioNaPasta, lerAudioDaPasta, pastaDaMidiaDaAventura } from '../../midiaDaPasta'
import { lerAudioGuardado } from '../../midiaNoDisco'
import { useAdventureStore } from '../../../stores/adventureStore'
import { useBibliotecaDeSonsStore } from '../../../stores/bibliotecaDeSonsStore'
import { useToastStore } from '../../../stores/toastStore'
import type { BibliotecaDeSons } from '../biblioteca'
import type { CarregadorDeBytes, MotorAoVivo } from './motor'
import { criarMotorDoNavegadorComYoutube } from './motorComYoutube'

/**
 * O LADO DO MESTRE dos sons ao vivo (Sistema 4, fatia F3): de onde vêm os
 * bytes que o motor toca e quanto pesa a pasta de mídia da biblioteca. O motor
 * não importa Tauri; quem lê o disco é este módulo, injetado nele.
 */

const NAO_E_AUDIO_GUARDADO = 'isso não é um áudio guardado'
/** Sem caminho nem nome de arquivo: o caminho traz o nome de usuário do Windows. */
export const SOM_FORA_DA_PASTA =
  'Um som não estava na pasta da biblioteca de sons e não deu para pôr lá: ele toca neste computador, mas não toca na mesa. Importe o arquivo de novo.'
const AVISO_DE_SOM_FORA_DA_PASTA_MS = 7000

/**
 * O som achado fora da biblioteca (na pasta da aventura, ou em `<appData>/midia`,
 * de antes da biblioteca global) vai para a `midia` dela, de onde `/sons/{id}`
 * serve a mesa: sem isso o mestre ouve e a mesa leva 404 sem saber por quê.
 * Só com o hash conferido (ir com o nome errado daria o mesmo 404);
 * `guardarAudioNaPasta` regrava a cópia trocada e nunca escreve por atalho. O
 * que não vai vira aviso. Nunca lança.
 */
async function devolverAPasta(pastaDaMidia: string, id: string, bytes: Uint8Array): Promise<void> {
  try {
    if ((await idDoAudio(bytes)) === id && (await guardarAudioNaPasta(pastaDaMidia, bytes)) === refDoId(id)) return
  } catch {
    // O disco recusou: vira o aviso abaixo.
  }
  useToastStore.getState().push('error', SOM_FORA_DA_PASTA, AVISO_DE_SOM_FORA_DA_PASTA_MS, { chave: 'som-fora-da-pasta' })
}

/**
 * O carregador do mestre: o áudio vem de `<biblioteca>/midia/<id>` (a pasta da
 * biblioteca de sons global, `<appData>/sons`), conferido (`lerAudioDaPasta`).
 * Sem ele lá, de onde ele morava antes da biblioteca global: a `midia` da
 * aventura aberta e, por fim, `<appData>/midia`; achado fora, ele vai para a
 * biblioteca (`devolverAPasta`). As pastas são perguntadas a cada carga: o
 * motor é um só. Lança com a frase pronta (`AUDIO_GUARDADO_SUMIU`).
 */
export function criarCarregadorDoMestre(pastaDaBiblioteca: () => string | null, pastaDaAventura: () => string | null = () => null): CarregadorDeBytes {
  return async (idDaMidia) => {
    if (!ehIdDeAudio(idDaMidia)) throw new Error(NAO_E_AUDIO_GUARDADO)
    const biblioteca = pastaDaBiblioteca()
    const pastaDaMidia = biblioteca === null ? null : await pastaDaMidiaDaAventura(biblioteca)
    if (pastaDaMidia !== null) {
      const daBiblioteca = await lerAudioDaPasta(pastaDaMidia, idDaMidia)
      if (daBiblioteca !== null) return daBiblioteca
    }
    const aventura = pastaDaAventura()
    const daAventura = aventura === null ? null : await lerAudioDaPasta(await pastaDaMidiaDaAventura(aventura), idDaMidia)
    const bytes = daAventura ?? (await lerAudioGuardado(refDoId(idDaMidia)))
    if (bytes === null) throw new Error(NAO_E_AUDIO_GUARDADO)
    if (pastaDaMidia !== null) await devolverAPasta(pastaDaMidia, idDaMidia, bytes)
    return bytes
  }
}

/** O carregador do app: a biblioteca global (`null` = ainda não lida) e, de antes dela, a aventura aberta. */
export const carregarBytesDoMestre: CarregadorDeBytes = criarCarregadorDoMestre(
  () => useBibliotecaDeSonsStore.getState().pasta,
  () => useAdventureStore.getState().dir,
)

let motorDoMestre: MotorAoVivo | null = null

/** O motor dos sons ao vivo do app do mestre: um só, criado no primeiro pedido (a aba Sons fica sempre montada). */
export function obterMotorDoMestre(): MotorAoVivo {
  motorDoMestre ??= criarMotorDoNavegadorComYoutube(carregarBytesDoMestre)
  return motorDoMestre
}

/** Nome de cada arquivo de uma pasta de mídia e o tamanho dele, em bytes. */
export type ArquivosDaMidia = ReadonlyMap<string, number>

/**
 * Os arquivos da `midia/` de `pastaComMidia` (a biblioteca de sons, ou uma
 * aventura). Só os arquivos de dentro (pasta ali dentro não conta). Pasta que
 * ainda não existe fica vazia; arquivo que não deixa ler o tamanho fica de fora.
 */
export async function arquivosDaMidiaDaPasta(pastaComMidia: string): Promise<ArquivosDaMidia> {
  const pasta = await pastaDaMidiaDaAventura(pastaComMidia)
  let entradas: Awaited<ReturnType<typeof readDir>>
  try {
    entradas = await readDir(pasta)
  } catch {
    return new Map()
  }
  const medidas = await Promise.all(
    entradas
      .filter((entrada) => entrada.isFile)
      .map(async (entrada): Promise<[string, number] | null> => {
        try {
          return [entrada.name, (await stat(await join(pasta, entrada.name))).size]
        } catch {
          return null
        }
      }),
  )
  return new Map(medidas.filter((medida) => medida !== null))
}

/** Quantos bytes tem a `midia/` de `pastaComMidia`. */
export async function tamanhoDaMidiaDaPasta(pastaComMidia: string): Promise<number> {
  return somaDosTamanhos(await arquivosDaMidiaDaPasta(pastaComMidia))
}

function somaDosTamanhos(arquivos: ArquivosDaMidia): number {
  let soma = 0
  for (const tamanho of arquivos.values()) soma += tamanho
  return soma
}

/**
 * O peso da mídia da biblioteca: a pasta mais os áudios citados que ainda não
 * apareceram na última leitura dela. Assim o total muda na hora em que o som
 * entra, não só na próxima leitura da pasta. Áudio usado por dois efeitos
 * conta uma vez.
 */
export function pesoDaMidiaComSons(arquivos: ArquivosDaMidia, biblioteca: BibliotecaDeSons): number {
  let peso = somaDosTamanhos(arquivos)
  const contados = new Set<string>()
  for (const efeito of biblioteca.efeitos) {
    if (efeito.fonte.tipo !== 'arquivo') continue
    const id = idDaRefDeAudio(efeito.fonte.ref)
    if (id === null || arquivos.has(id) || contados.has(id)) continue
    contados.add(id)
    peso += efeito.fonte.bytes
  }
  return peso
}
