import type { TipoMobilia } from './mobilia/tipos'

/**
 * A NATUREZA MORA NO CARIMBO (Fase 6, decisão do mestre de 15/11/2026: "Tem uma
 * clara diferença entre Objeto, Estrutura e Carimbo, Carimbo coloque no carimbo
 * tudo que é natural").
 *
 * Cada peça natural que nasceu como Objeto aponta para o carimbo que faz o mesmo
 * papel. Com carimbo, ela SAI do catálogo do Objeto (menu, ficha da ferramenta,
 * busca, troca de tipo); sem carimbo que case, ela FICA no Objeto até a arte do
 * carimbo existir, para o mestre não perder a peça no meio do caminho.
 *
 * Só o MENU muda. O objeto já posto num mapa continua Objeto, igual (mesmo desenho,
 * mesma regra de barrar, mesma ficha): nada é convertido sem o mestre ver. A ficha
 * dele ainda mostra o tipo (`catalogoComOTipo` põe de volta o tipo que saiu).
 *
 * Meio natural, meio feito pela mão, decidido peça a peça (Claude, 16/11/2026):
 * - canteiro de flores: FEITO (a borda do canteiro); as flores soltas são o carimbo "Flores do campo";
 * - laranjeira em canteiro: FEITA (a árvore plantada no caixote do navio); a árvore solta é a "Macieira";
 * - troncos: FEITOS (lenha cortada e empilhada); a árvore caída é o "Tronco caído";
 * - toco com machado cravado, horta, plantação em fileiras, feno, vaso, jardineira: FEITOS (trabalho de gente);
 * - teia de aranha: fica no Objeto (enfeite de canto de masmorra, junto das tochas, não paisagem).
 */
export interface NaturezaDoObjeto {
  /** O carimbo da biblioteca (`carimbos/`) que faz o papel da peça; `null` = ainda sem arte. */
  readonly carimbo: string | null
  /** O que falta desenhar, quando `carimbo` é `null` (a lista de pedidos de arte). */
  readonly arteQueFalta?: string
}

export const NATUREZA_DO_OBJETO: Readonly<Partial<Record<TipoMobilia, NaturezaDoObjeto>>> = {
  // "Pedras" do carimbo; para o rio há os "Seixos de rio" e, maior, o "Rochedo com musgo".
  pedrasERochas: { carimbo: 'pedras' },
  tocoDeArvore: { carimbo: 'toco-seco' },
  // O desenho do Meio-Termo da árvore seca já diz: "É a árvore morta dos carimbos" (`texturas/meioTermo/moveis/arvoreSeca.ts`).
  arvoreSeca: { carimbo: 'arvore-morta' },
  // A sebe é comprida e curva como a cerca, e o carimbo só guarda tipo, tamanho e giro: a "Sebe aparada" é um
  // MÓDULO que emenda no vizinho (`carimbos/novos/sebeAparada.ts`), e a sebe se desenha clicando um ao lado do outro.
  sebe: { carimbo: 'sebe-aparada' },
}

/** O carimbo que faz o papel deste Objeto, ou `null` (não é natureza, ou a arte ainda não existe). */
export function carimboDaNatureza(tipo: TipoMobilia): string | null {
  return NATUREZA_DO_OBJETO[tipo]?.carimbo ?? null
}

/** A peça natural que já tem carimbo: sai do catálogo do Objeto (o que está posto no mapa fica igual). */
export function foiParaOCarimbo(tipo: TipoMobilia): boolean {
  return carimboDaNatureza(tipo) !== null
}
