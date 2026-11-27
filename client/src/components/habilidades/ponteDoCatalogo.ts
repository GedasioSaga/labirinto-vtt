import type { CartaoDaFicha } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'

/** Grava a habilidade no catálogo do livro e devolve a frase do que aconteceu (lança com a frase pronta). */
export type GuardarNoCatalogoDoLivro = (cartao: CartaoDaFicha, sistema: SistemaDeRpg) => Promise<string>

let guardarRegistrado: GuardarNoCatalogoDoLivro | null = null

/**
 * "Guardar também no catálogo do livro" mora no disco do mestre (`catalogoNoDisco`, Tauri). A lista da
 * ficha é a mesma no app, no site e no jogador, e o site não pode nem importar o Tauri (guarda de
 * import do `vite.lobby.config.ts`). Por isso só a entrada do app (`src/main.tsx`) registra quem grava;
 * fora dele não há registro e a caixa não aparece.
 */
export function registrarGuardarNoCatalogo(guardar: GuardarNoCatalogoDoLivro): void {
  guardarRegistrado = guardar
}

export function guardarNoCatalogoRegistrado(): GuardarNoCatalogoDoLivro | null {
  return guardarRegistrado
}
