/**
 * DESENHADO (integração do pacote `godot/desenhado/`, plano de 29/10/2026,
 * seção 1): de onde vêm as imagens do estilo Desenhado.
 *
 * Os renderers nunca sabem o canal: pedem a `FonteDoDesenhado` e recebem a URL
 * de cada arquivo de `exportado/<id>/`. O canal de hoje é o instalador (o Vite
 * copia os PNG para `assets/` com hash no nome, `arquivos.ts`); trocar por um
 * pacote baixado depois (plano, opção B) é trocar só `abrirFonteDoDesenhado`.
 *
 * Este arquivo não importa o canal de propósito: a lista de URLs (~600) só
 * entra na memória quando alguma cena pede o Desenhado.
 */

/**
 * Os ids que o app aceita do pacote: os 79 itens do `INVENTARIO.md` mais o
 * `tronco-caido` (o 37b), as 80 pastas de `exportado/`. Ficam de fora os PNG
 * soltos da raiz de `exportado/` (o protótipo antigo) e o `material-madeira`
 * (o caminho reprovado em 29/10).
 */
export const IDS_DO_DESENHADO = [
  // Onda 1: chão.
  'grama', 'grama-amarela', 'floresta', 'terra', 'caminho', 'chao-de-floresta', 'bosque', 'pinheiros', 'pantano',
  'areia', 'duna', 'pedra', 'neve', 'lajotas', 'lajotas-escuras', 'calcamento', 'conves', 'piso',
  // Onda 2: telhados, faixa e objeto.
  'telhado-telhas', 'telhado-madeira', 'telhado-palha', 'chamine', 'cumeeira-amarrada',
  // Onda 3: carimbos e trechos.
  'arvore', 'arvore-redonda', 'pinheiro', 'pinheiro-nevado', 'palmeira', 'arbusto', 'pedras', 'tronco-caido', 'poca',
  'juncos', 'girassol', 'girassois', 'vaso', 'jardineira', 'sebe',
  // Onda 4: móveis desenhados.
  'movel-aparador', 'movel-arco-do-portao', 'movel-armario', 'movel-balcao', 'movel-balde', 'movel-barraca',
  'movel-barril', 'movel-bau', 'movel-bigorna', 'movel-cadeira', 'movel-caixa', 'movel-carroca', 'movel-catre',
  'movel-cerca', 'movel-feno', 'movel-fogao', 'movel-fogo', 'movel-fogueira', 'movel-fornalha', 'movel-geladeira',
  'movel-lampiao', 'movel-lapide', 'movel-lareira', 'movel-mesa', 'movel-mesa-quadrada', 'movel-mesa-redonda',
  'movel-pia', 'movel-placa-de-seta', 'movel-poco', 'movel-poltrona', 'movel-pratos', 'movel-privada',
  'movel-quadro-de-avisos', 'movel-sofa', 'movel-tapete', 'movel-tapete-longo', 'movel-troncos',
  // Onda 5: traços.
  'penhasco', 'penhasco-borda', 'parede', 'janela', 'grade-de-prisao',
  // Onda 5b: as portas (lote 18).
  'porta', 'porta-dupla', 'porta-portao',
] as const

export type IdDoDesenhado = (typeof IDS_DO_DESENHADO)[number]

const IDS_ACEITOS: ReadonlySet<string> = new Set(IDS_DO_DESENHADO)

/** O texto é um id do pacote que o app aceita? */
export function ehIdDoDesenhado(id: string): id is IdDoDesenhado {
  return IDS_ACEITOS.has(id)
}

/** O que os renderers pedem ao canal, seja ele qual for. */
export interface FonteDoDesenhado {
  /** URL de um arquivo de `exportado/<id>/` (`base-1.png`, `detalhes.png`...); `undefined` = o pacote não tem. */
  urlDe(id: IdDoDesenhado, arquivo: string): string | undefined
  /** Os nomes dos PNG que o pacote tem para o id, em ordem alfabética. */
  arquivosDe(id: IdDoDesenhado): readonly string[]
  /**
   * O `textura.json` do id, como veio do pacote (`null` = não tem). A leitura
   * dos campos é de quem monta (CONTRATO.md seção 3), não do canal.
   */
  textura(id: IdDoDesenhado): Promise<unknown>
}

let aberta: Promise<FonteDoDesenhado> | null = null

/**
 * A fonte do canal de hoje, aberta uma vez só. A primeira chamada baixa a
 * lista de URLs (um pedaço de JS pequeno); nenhum PNG é baixado aqui.
 * Falhou (rede do jogador caiu no meio): a próxima chamada tenta de novo.
 */
export function abrirFonteDoDesenhado(): Promise<FonteDoDesenhado> {
  if (aberta === null) {
    aberta = import('./arquivos').then(
      (canal) => canal.fonteDoInstalador,
      (erro: unknown) => {
        aberta = null
        throw erro
      },
    )
  }
  return aberta
}
