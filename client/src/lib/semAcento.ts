/** Marcas de acento que o `normalize('NFD')` separa da letra. */
const MARCAS_DE_ACENTO = /[̀-ͯ]/g

/** Texto para comparar nomes: sem acento e em minúscula ("Ébano" → "ebano"). Leve, sem dependências. */
export function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(MARCAS_DE_ACENTO, '').toLowerCase()
}
