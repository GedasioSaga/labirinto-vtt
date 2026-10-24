import { readDir, stat } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import { ehIdDeAudio, idDaRefDeAudio, refDoId } from '../../midia'
import { lerAudioDaPasta, pastaDaMidiaDaAventura } from '../../midiaDaPasta'
import { lerAudioGuardado } from '../../midiaNoDisco'
import { useBibliotecaDeSonsStore } from '../../../stores/bibliotecaDeSonsStore'
import type { BibliotecaDeSons } from '../biblioteca'
import { criarMotorAoVivoDoNavegador, type CarregadorDeBytes, type MotorAoVivo } from './motor'

/**
 * O LADO DO MESTRE dos sons ao vivo (Sistema 4, fatia F3): de onde vêm os
 * bytes que o motor toca e quanto pesa a pasta de mídia da aventura. O motor
 * não importa Tauri; quem lê o disco é este módulo, injetado nele.
 */

const NAO_E_AUDIO_GUARDADO = 'isso não é um áudio guardado'

/**
 * O carregador do mestre: o áudio vem de `<aventura>/midia/<id>`, conferido
 * (`lerAudioDaPasta`), porque o som da biblioteca não mora mais em
 * `<appData>/midia` (fechamento (b) da F5). Sem ele lá, de `<appData>/midia/<id>`:
 * a aventura nova ainda sem pasta guarda ali, e o som de versão anterior pode
 * não ter chegado à pasta. A pasta é perguntada a cada carga: o motor é um só e
 * a aventura aberta muda. Lança com a frase pronta (`AUDIO_GUARDADO_SUMIU`).
 */
export function criarCarregadorDoMestre(pastaDaAventura: () => string | null): CarregadorDeBytes {
  return async (idDaMidia) => {
    if (!ehIdDeAudio(idDaMidia)) throw new Error(NAO_E_AUDIO_GUARDADO)
    const pasta = pastaDaAventura()
    if (pasta !== null) {
      const daAventura = await lerAudioDaPasta(await pastaDaMidiaDaAventura(pasta), idDaMidia)
      if (daAventura !== null) return daAventura
    }
    const bytes = await lerAudioGuardado(refDoId(idDaMidia))
    if (bytes === null) throw new Error(NAO_E_AUDIO_GUARDADO)
    return bytes
  }
}

/** O carregador do app: a pasta é a da biblioteca de sons aberta (`dir` nulo = sem pasta ainda). */
export const carregarBytesDoMestre: CarregadorDeBytes = criarCarregadorDoMestre(() => useBibliotecaDeSonsStore.getState().dir)

let motorDoMestre: MotorAoVivo | null = null

/** O motor dos sons ao vivo do app do mestre: um só, criado no primeiro pedido (a aba Sons fica sempre montada). */
export function obterMotorDoMestre(): MotorAoVivo {
  motorDoMestre ??= criarMotorAoVivoDoNavegador(carregarBytesDoMestre)
  return motorDoMestre
}

/** Nome de cada arquivo da pasta de mídia da aventura e o tamanho dele, em bytes. */
export type ArquivosDaMidia = ReadonlyMap<string, number>

/**
 * Os arquivos da pasta de mídia da aventura (`<aventura>/midia/`): os áudios
 * dos sons e as imagens que viajam com ela. Só os arquivos de dentro (pasta ali
 * dentro não conta). Pasta que ainda não existe fica vazia; arquivo que não
 * deixa ler o tamanho fica de fora.
 */
export async function arquivosDaMidiaDaAventura(pastaDaAventura: string): Promise<ArquivosDaMidia> {
  const pasta = await pastaDaMidiaDaAventura(pastaDaAventura)
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

/** Quantos bytes tem a pasta de mídia da aventura. */
export async function tamanhoDaMidiaDaAventura(pastaDaAventura: string): Promise<number> {
  return somaDosTamanhos(await arquivosDaMidiaDaAventura(pastaDaAventura))
}

function somaDosTamanhos(arquivos: ArquivosDaMidia): number {
  let soma = 0
  for (const tamanho of arquivos.values()) soma += tamanho
  return soma
}

/**
 * O peso da mídia da aventura com os sons: a pasta mais os áudios da
 * biblioteca que ainda não chegaram nela (a cópia corre depois de gravar o
 * `sons.json`). Assim o total muda na hora em que o som entra, não só na
 * próxima leitura da pasta. Áudio usado por dois efeitos conta uma vez.
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
