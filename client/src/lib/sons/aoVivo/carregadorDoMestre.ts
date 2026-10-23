import { readDir, stat } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import { refDoId } from '../../midia'
import { pastaDaMidiaDaAventura } from '../../midiaDaPasta'
import { lerAudioGuardado } from '../../midiaNoDisco'
import { criarMotorAoVivoDoNavegador, type MotorAoVivo } from './motor'

/**
 * O LADO DO MESTRE dos sons ao vivo (Sistema 4, fatia F3): de onde vêm os
 * bytes que o motor toca e quanto pesa a pasta de mídia da aventura. O motor
 * não importa Tauri; quem lê o disco é este módulo, injetado nele.
 */

/** O áudio guardado `<appData>/midia/<id>`, lido do disco; lança com a frase pronta quando não está lá. */
export async function carregarBytesDoMestre(idDaMidia: string): Promise<Uint8Array> {
  const bytes = await lerAudioGuardado(refDoId(idDaMidia))
  if (bytes === null) throw new Error('isso não é um áudio guardado')
  return bytes
}

let motorDoMestre: MotorAoVivo | null = null

/** O motor dos sons ao vivo do app do mestre: um só, criado no primeiro pedido (a aba Sons fica sempre montada). */
export function obterMotorDoMestre(): MotorAoVivo {
  motorDoMestre ??= criarMotorAoVivoDoNavegador(carregarBytesDoMestre)
  return motorDoMestre
}

/**
 * Quantos bytes tem a pasta de mídia da aventura (`<aventura>/midia/`): os
 * áudios dos sons e as imagens que viajam com ela. Só os arquivos de dentro
 * (pasta ali dentro não conta). Pasta que ainda não existe pesa 0; arquivo que
 * não deixa ler o tamanho fica fora da soma.
 */
export async function tamanhoDaMidiaDaAventura(pastaDaAventura: string): Promise<number> {
  const pasta = await pastaDaMidiaDaAventura(pastaDaAventura)
  let entradas: Awaited<ReturnType<typeof readDir>>
  try {
    entradas = await readDir(pasta)
  } catch {
    return 0
  }
  const tamanhos = await Promise.all(
    entradas
      .filter((entrada) => entrada.isFile)
      .map(async (entrada) => {
        try {
          return (await stat(await join(pasta, entrada.name))).size
        } catch {
          return 0
        }
      }),
  )
  return tamanhos.reduce((soma, tamanho) => soma + tamanho, 0)
}
