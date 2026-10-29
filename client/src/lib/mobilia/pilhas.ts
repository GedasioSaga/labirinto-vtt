/**
 * TRONCOS E FENO (pedido do mestre de 29/10/2026): um objeto cada, com duas
 * FORMAS no painel ("Forma"), e cada forma com a sua pegada de partida:
 * - Troncos: a PILHA DE TORAS (troncos grandes deitados em pirâmide, 2 x 1
 *   casa) e a LENHA EMPILHADA (lenha cortada em fileira, 1,5 x 0,5, para
 *   encostar na parede);
 * - Feno: os FARDOS EMPILHADOS (fardos amarrados com corda, 1,5 x 1) e o
 *   MONTE DE FENO (solto, 1 x 1), para estábulo, celeiro e fazenda.
 *
 * Trocar a forma leva a pegada para a da forma nova, com o centro no lugar
 * (como a forma do tapete); depois o mestre estica à vontade. Só a SEGUNDA
 * forma de cada um é gravada (em `Prop.mobiliaForma`): ausente = a primeira.
 * Sem import de Pixi nem de `types/map.ts`: função pura, sem ciclo.
 */

export type FormaDosTroncos = 'toras' | 'lenha'
export type FormaDoFeno = 'fardos' | 'monte'
export type FormaDaPilha = FormaDosTroncos | FormaDoFeno

/** As formas que o mapa grava: a segunda de cada objeto (a primeira é o padrão). */
export type FormaGravadaDaPilha = 'lenha' | 'monte'

/** Os objetos com forma de pilha. */
export type MovelDePilha = 'troncos' | 'feno'

export function ehMovelDePilha(tipo: string | undefined): tipo is MovelDePilha {
  return tipo === 'troncos' || tipo === 'feno'
}

/** A ordem em que o painel oferece as formas: a primeira é a de partida. */
export const FORMAS_DA_PILHA: Readonly<Record<MovelDePilha, readonly FormaDaPilha[]>> = {
  troncos: ['toras', 'lenha'],
  feno: ['fardos', 'monte'],
}

/**
 * O nome de cada forma no painel. Curto de propósito: o mestre chamou de
 * "pilha de toras", "lenha empilhada", "fardos empilhados" e "monte de feno",
 * mas no controle de dois botões do trilho de 264 px os nomes longos quebravam
 * em duas linhas, e o tipo (Troncos, Feno) já está logo acima.
 */
export const ROTULO_DA_FORMA_DA_PILHA: Readonly<Record<FormaDaPilha, string>> = {
  toras: 'Toras',
  lenha: 'Lenha',
  fardos: 'Fardos',
  monte: 'Monte',
}

/** A pegada de partida de cada forma, em casas (largura x altura, sem giro). */
export const CASAS_DA_FORMA_DA_PILHA: Readonly<Record<FormaDaPilha, { readonly largura: number; readonly altura: number }>> = {
  toras: { largura: 2, altura: 1 },
  lenha: { largura: 1.5, altura: 0.5 },
  fardos: { largura: 1.5, altura: 1 },
  monte: { largura: 1, altura: 1 },
}

/**
 * A forma gravada que o tipo aceita: `'lenha'` só nos troncos e `'monte'` só
 * no feno; o resto (a forma de partida, texto torto, outro tipo) vira
 * `undefined`. A mesma porta da leitura, da edição e da travessia.
 */
export function normalizarFormaDaPilha(tipo: string | undefined, valor: unknown): FormaGravadaDaPilha | undefined {
  if (tipo === 'troncos') return valor === 'lenha' ? 'lenha' : undefined
  if (tipo === 'feno') return valor === 'monte' ? 'monte' : undefined
  return undefined
}

/** A forma que vale para os troncos ou o feno: a gravada ou a de partida. */
export function formaDaPilha(tipo: MovelDePilha, valor: unknown): FormaDaPilha {
  return normalizarFormaDaPilha(tipo, valor) ?? FORMAS_DA_PILHA[tipo][0]
}

/** A forma como o desenho com textura a lê (a `variante`, como a dos pratos): 0 a de partida, 1 a outra; outro tipo, 0. */
export function varianteDaPilha(tipo: string | undefined, valor: unknown): number {
  return ehMovelDePilha(tipo) ? FORMAS_DA_PILHA[tipo].indexOf(formaDaPilha(tipo, valor)) : 0
}

/** A forma pertence a este objeto? (o painel dos troncos não aceita "Monte de feno"). */
export function formaDoMovelDePilha(tipo: MovelDePilha, forma: FormaDaPilha): boolean {
  return FORMAS_DA_PILHA[tipo].includes(forma)
}
