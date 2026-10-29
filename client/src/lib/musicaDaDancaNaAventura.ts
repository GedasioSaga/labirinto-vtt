import type { MusicaDaDanca } from '../minigames/danca/tipos'
import { useToastStore } from '../stores/toastStore'
import { idDaRefDeAudio, idDoAudio, refDoId } from './midia'
import { guardarAudioNaPasta, lerAudioDaPasta, pastaDaMidiaDaAventura } from './midiaDaPasta'
import { guardarAudio, lerAudioGuardado } from './midiaNoDisco'

/**
 * A MÚSICA DA DANÇA NA PASTA DA AVENTURA (SONS F5d, 24/10/2026). O jogador
 * baixa a música importada por `/sons/<id>` com a chave, e o servidor da sala
 * só lê a `midia` da pasta que a aba Sons informa: a da biblioteca de sons,
 * `<appData>/sons`, global desde 29/10/2026 (antes, a da aventura; o
 * parâmetro `pastaDaAventura` daqui é essa pasta). `<appData>/midia` continua com a cópia que o mestre
 * toca neste computador e que a Visão de jogador lê, mas deixa de ser a fonte
 * do jogador: `/media/<id>` não serve mais áudio.
 *
 * Sem pasta (aventura nova ainda não salva), a música importada não tem de
 * onde sair para a mesa: o convite da sala é recusado com aviso
 * (`prepararMusicaDaDancaNaMesa`), e a faixa demo segue valendo.
 */

/** Sem caminho nem nome de arquivo: o caminho traz o nome de usuário do Windows. */
export const MUSICA_FORA_DA_AVENTURA = 'A música da dança não está neste computador, então não chega aos jogadores. Importe o arquivo de novo no pino.'
const AVISO_DA_MUSICA_MS = 7000

/**
 * A música importada no painel do pino: grava em `<appData>/midia` (o mestre
 * toca e a Visão de jogador lê) e, com a aventura numa pasta, em
 * `<aventura>/midia` (de onde a sala serve). Devolve `midia:<id>`; lança com a
 * frase pronta, como `guardarAudio` (teto e assinatura antes do disco).
 */
export async function guardarMusicaDaDanca(bytes: Uint8Array, pastaDaAventura: string | null): Promise<string> {
  const ref = await guardarAudio(bytes)
  if (pastaDaAventura !== null) await guardarAudioNaPasta(await pastaDaMidiaDaAventura(pastaDaAventura), bytes)
  return ref
}

function avisarMusicaFora(): false {
  useToastStore.getState().push('error', MUSICA_FORA_DA_AVENTURA, AVISO_DA_MUSICA_MS, { chave: 'musica-da-danca-fora-da-aventura' })
  return false
}

/**
 * Garante a música `ref` em `<aventura>/midia/<id>`, conferida pelo hash (a
 * cópia trocada daria 404 na sala). Faltando lá (dança gravada antes da F5d,
 * ou pino de outra aventura), copia de `<appData>/midia`, só com o hash certo.
 * O que não dá vira aviso sem caminho. Nunca lança: `false` = não está lá.
 */
export async function garantirMusicaNaAventura(ref: string, pastaDaAventura: string): Promise<boolean> {
  const id = idDaRefDeAudio(ref)
  if (id === null) return avisarMusicaFora()
  try {
    const pasta = await pastaDaMidiaDaAventura(pastaDaAventura)
    if ((await lerAudioDaPasta(pasta, id)) !== null) return true
    const bytes = await lerAudioGuardado(ref)
    if (bytes !== null && (await idDoAudio(bytes)) === id && (await guardarAudioNaPasta(pasta, bytes)) === refDoId(id)) return true
  } catch {
    // Não está em <appData>/midia, ou o disco recusou: vira o aviso abaixo.
  }
  return avisarMusicaFora()
}

/**
 * Antes do convite da SALA (nunca o da Visão de jogador, que lê do disco): a
 * música pode sair para a mesa? A faixa demo sempre pode. A importada pede a
 * pasta da aventura; com ela, a cópia na pasta é garantida em segundo plano
 * (a liberação vai no `net_send` do convite, e o jogador baixa em seguida).
 * Síncrona: o painel decide na hora se o convite sai.
 */
export function prepararMusicaDaDancaNaMesa(
  musica: MusicaDaDanca,
  pastaDaAventura: string | null,
  garantir: (ref: string, pasta: string) => Promise<boolean> = garantirMusicaNaAventura,
): boolean {
  if (musica.tipo !== 'arquivo') return true
  if (pastaDaAventura === null) return false
  void garantir(musica.midia, pastaDaAventura)
  return true
}
