import { Channel, invoke } from '@tauri-apps/api/core'
import { useAdventureStore } from '../../stores/adventureStore'
import { pastaDaNuvemNoApp, pastaNoDisco, primitivasDoTauri } from './discoDaNuvem'
import { lerCampanhas } from './estadoNoDisco'

/**
 * GALERIA DO SITE (cutscene, 14/11/2026): o app do mestre sobe o vídeo da
 * mídia da mesa para a campanha publicada da pasta aberta, depois da primeira
 * exibição. Os bytes saem do disco pelo Rust (`nuvem_enviar_video`, em pedaços
 * de 4 MiB); a webview só escolhe a campanha, o vídeo e o título.
 */

/** O mesmo teto do Rust (`GALERIA_VIDEO_MAX_BYTES`) e do Worker: acima disso o vídeo fica só na mesa. */
export const GALERIA_VIDEO_MAX_BYTES = 150 * 1024 * 1024

export interface ProgressoDaSubida {
  enviados: number
  total: number
}

/** A frase do erro da nuvem (`ErroNuvem.mensagem`), ou uma genérica. */
export function mensagemDaFalha(erro: unknown): string {
  if (typeof erro === 'object' && erro !== null && 'mensagem' in erro && typeof erro.mensagem === 'string') return erro.mensagem
  if (typeof erro === 'string' && erro.trim() !== '') return erro
  return 'O vídeo não subiu para a Galeria. Tente de novo.'
}

/** A campanha publicada da pasta aberta; `null` = a pasta não está no Lobby. */
export async function campanhaDaPastaAberta(): Promise<string | null> {
  const pasta = useAdventureStore.getState().pasta
  if (pasta === null) return null
  const raiz = pastaNoDisco(primitivasDoTauri, await pastaDaNuvemNoApp())
  const campanha = (await lerCampanhas(raiz)).find((c) => c.pastaId === pasta.pastaId)
  return campanha?.campanhaId ?? null
}

/** Sobe o vídeo para a Galeria. Lança com o `ErroNuvem` do Rust (use `mensagemDaFalha`). */
export async function enviarVideoParaAGaleria(campanhaId: string, videoId: string, titulo: string, aoAndar: (andamento: ProgressoDaSubida) => void): Promise<void> {
  const progresso = new Channel<ProgressoDaSubida>()
  progresso.onmessage = aoAndar
  await invoke('nuvem_enviar_video', { campanhaId, videoId, titulo, progresso })
}

/** O mestre tira o vídeo da Galeria pelo app (o Worker apaga os bytes). */
export async function tirarDaGaleria(campanhaId: string, videoId: string): Promise<void> {
  await invoke('nuvem_pedir', { pedido: { rota: 'tirarDaGaleria', campanhaId, videoId } })
}
