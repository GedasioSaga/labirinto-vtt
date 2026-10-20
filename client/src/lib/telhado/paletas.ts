/**
 * PALETAS DO TELHADO da Sala: 6 cores por modelo, escolhidas para o mapa
 * (grama #56693f, piso #9a7653, parede #25211d). Tons contidos: saturação
 * baixa e luz no meio da escala, para o telhado ler de longe sem gritar
 * (memória do projeto "texturas sem estourar"). A cor é o tom da água em luz
 * neutra; a textura (`texturas/telhado.ts`) tira dela o lado claro e o escuro.
 *
 * Decisão do usuário (19/10/2026): telha colonial e madeira em tábuas, 6
 * cores cada mais cor livre; teto sem modelo escolhido = telha barro.
 */

export type ModeloDoTeto = 'telhas' | 'madeira'

export interface CorDoTeto {
  readonly id: string
  readonly nome: string
  /** `#rrggbb`, minúsculo. */
  readonly hex: string
}

export const MODELOS_DO_TETO: readonly ModeloDoTeto[] = ['telhas', 'madeira']

export const NOME_DO_MODELO: Readonly<Record<ModeloDoTeto, string>> = {
  telhas: 'Telhas',
  madeira: 'Madeira',
}

export const PALETA_DO_TETO: Readonly<Record<ModeloDoTeto, readonly CorDoTeto[]>> = {
  telhas: [
    { id: 'barro', nome: 'Barro', hex: '#8a5a46' },
    { id: 'terracota-escura', nome: 'Terracota escura', hex: '#6a3f33' },
    { id: 'ardosia', nome: 'Ardósia', hex: '#656b72' },
    { id: 'verde-musgo', nome: 'Verde musgo', hex: '#606a50' },
    { id: 'azul-colonial', nome: 'Azul colonial', hex: '#4a5868' },
    { id: 'preto', nome: 'Preto', hex: '#35373b' },
  ],
  madeira: [
    { id: 'carvalho', nome: 'Carvalho', hex: '#8b6b47' },
    { id: 'nogueira', nome: 'Nogueira', hex: '#5f4532' },
    { id: 'pinho-claro', nome: 'Pinho claro', hex: '#a3875f' },
    { id: 'cinza-envelhecido', nome: 'Cinza envelhecido', hex: '#7b776e' },
    { id: 'vermelho-celeiro', nome: 'Vermelho celeiro', hex: '#733d33' },
    { id: 'verde', nome: 'Verde', hex: '#4d5f4f' },
  ],
}

/** Teto ligado sem modelo escolhido (mapas salvos e salas novas). */
export const MODELO_PADRAO_DO_TETO: ModeloDoTeto = 'telhas'

/** Telha colonial barro. */
export const COR_PADRAO_DO_TETO: string = PALETA_DO_TETO.telhas[0].hex

const COR_HEX = /^#[0-9a-f]{6}$/i

/** `#rrggbb` (6 dígitos). Nome de cor, `#rgb` e lixo ficam de fora. */
export function corDoTetoValida(cor: unknown): cor is string {
  return typeof cor === 'string' && COR_HEX.test(cor)
}

/** A primeira cor da paleta do modelo: o padrão de cada modelo. */
export function corPadraoDoModelo(modelo: ModeloDoTeto): string {
  return PALETA_DO_TETO[modelo][0].hex
}

/** A cor pedida, ou a padrão do modelo quando ela não presta. Sempre minúscula. */
export function corDoTetoOuPadrao(modelo: ModeloDoTeto, cor: unknown): string {
  return corDoTetoValida(cor) ? cor.toLowerCase() : corPadraoDoModelo(modelo)
}

/** A cor da paleta com esse hex, ou `null` (cor livre). */
export function corDaPaleta(modelo: ModeloDoTeto, hex: string): CorDoTeto | null {
  const alvo = hex.toLowerCase()
  return PALETA_DO_TETO[modelo].find((c) => c.hex === alvo) ?? null
}
