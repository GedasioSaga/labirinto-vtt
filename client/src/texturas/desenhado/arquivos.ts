import { ehIdDoDesenhado, type FonteDoDesenhado, type IdDoDesenhado } from './fonte'

/**
 * O CANAL DO INSTALADOR do Desenhado (plano de 29/10/2026, seção 1, opção A,
 * aceita pelo usuário): as imagens vão DENTRO do app, pelo Vite, direto de
 * `godot/desenhado/exportado/<id>/`, sem cópia.
 *
 * - Os PNG viram arquivo próprio em `assets/` com hash no nome (o `?url` mais o
 *   `build.assetsInlineLimit` do `vite.config.ts`, que nunca os embute em base64
 *   no JS). O jogador recebe pela mesma rota `/assets/` do servidor do app, com
 *   o cache imutável que o nome com hash já tem.
 * - No desenvolvimento a pasta fica fora do `root` do Vite (`client/`): o
 *   `server.fs.allow` do `vite.config.ts` a libera.
 * - Só este arquivo conhece o glob. Ele só é carregado por `abrirFonteDoDesenhado`
 *   (`fonte.ts`), sob demanda: abrir o app no estilo Atual não baixa nem a lista.
 */

// Só as pastas de id (a raiz de `exportado/` tem o protótipo antigo) e nunca o caminho reprovado.
const URLS_DOS_PNG = import.meta.glob<string>(
  ['../../../../godot/desenhado/exportado/*/*.png', '!../../../../godot/desenhado/exportado/material-madeira/*'],
  { eager: true, query: '?url', import: 'default' },
)

// Um pedaço de JS por textura, baixado só quando alguém pede aquele id.
const TEXTURAS = import.meta.glob<unknown>(
  ['../../../../godot/desenhado/exportado/*/textura.json', '!../../../../godot/desenhado/exportado/material-madeira/*'],
  { import: 'default' },
)

/** `../../../../godot/desenhado/exportado/<id>/<arquivo>` → `[id, arquivo]`; caminho de outro formato = `null`. */
function idEArquivo(caminho: string): [string, string] | null {
  const partes = caminho.split('/')
  const arquivo = partes.at(-1)
  const id = partes.at(-2)
  return arquivo === undefined || id === undefined ? null : [id, arquivo]
}

/** id → (arquivo → URL), só dos ids da lista (a segunda trava, depois do glob). */
function indexarPorId<T>(entradas: Record<string, T>): Map<IdDoDesenhado, Map<string, T>> {
  const porId = new Map<IdDoDesenhado, Map<string, T>>()
  for (const caminho of Object.keys(entradas).sort()) {
    const partes = idEArquivo(caminho)
    if (partes === null || !ehIdDoDesenhado(partes[0])) continue
    const [id, arquivo] = partes
    const doId = porId.get(id) ?? new Map<string, T>()
    doId.set(arquivo, entradas[caminho])
    porId.set(id, doId)
  }
  return porId
}

const PNG_POR_ID = indexarPorId(URLS_DOS_PNG)
const TEXTURA_POR_ID = indexarPorId(TEXTURAS)
const SEM_ARQUIVOS: readonly string[] = []

export const fonteDoInstalador: FonteDoDesenhado = {
  urlDe: (id, arquivo) => PNG_POR_ID.get(id)?.get(arquivo),
  arquivosDe: (id) => {
    const doId = PNG_POR_ID.get(id)
    return doId === undefined ? SEM_ARQUIVOS : [...doId.keys()]
  },
  textura: async (id) => {
    const carregar = TEXTURA_POR_ID.get(id)?.get('textura.json')
    return carregar === undefined ? null : carregar()
  },
}
