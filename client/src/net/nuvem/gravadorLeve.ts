import { join } from '@tauri-apps/api/path'
import { writeTextFileSafely } from '../../lib/mapFileIO'
import { idDePastaValido, lerRpgDaPasta, naFilaDaPasta, pastaDasPastas, serializarRpg } from '../../lib/pastasDeMapas'
import type { Personagem } from '../../lib/personagem'

/**
 * O GRAVADOR LEVE DO `rpg.json` (docs/planos/lobby-jogadores-2026-11-05.md
 * §5.6, fatia A5): numa campanha publicada, ~1 s depois da mudança, lê o
 * `rpg.json` do disco, ajusta só as fichas do Lobby e grava pela troca segura.
 * Sem `.anterior` (a fila e o diário são a garantia) e sem copiar mídia (a
 * nuvem só tem `midia:` que o app já tem). Dentro da fila única da pasta: o
 * Salvar e o `editarRpgDaPasta` nunca leem nem gravam no meio dele.
 */

const ARQUIVO_DO_RPG = 'rpg.json'

export function gravarRpgLeve(pastaId: string, ajustar: (personagens: readonly Personagem[]) => Personagem[] | null): Promise<void> {
  return naFilaDaPasta(pastaId, async () => {
    if (!idDePastaValido(pastaId)) throw new Error(`O id "${pastaId}" não serve de nome de pasta.`)
    const lido = await lerRpgDaPasta(pastaId)
    if (!lido.ok) throw new Error(lido.motivo)
    const personagens = ajustar(lido.rpg.personagens)
    if (personagens === null) return
    await writeTextFileSafely(await join(await pastaDasPastas(), pastaId, ARQUIVO_DO_RPG), serializarRpg({ ...lido.rpg, personagens }))
  })
}
