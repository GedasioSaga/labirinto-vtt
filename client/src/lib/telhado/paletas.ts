/**
 * PALETAS DO TELHADO da Sala: 6 cores por modelo, escolhidas para o mapa
 * (grama #56693f, piso #9a7653, parede #25211d). Tons contidos: saturação
 * baixa e luz no meio da escala, para o telhado ler de longe sem gritar
 * (memória do projeto "texturas sem estourar"). A cor é o tom da água em luz
 * neutra; a textura (`texturas/telhado.ts`) tira dela o lado claro e o escuro.
 *
 * Decisão do usuário (19/10/2026): telha colonial e madeira em tábuas, 6
 * cores cada mais cor livre; teto sem modelo escolhido = telha barro.
 * Meio-Termo (MT6, 23/10/2026): palha em espinha de peixe como 3º modelo, 6
 * cores e cor livre. A padrão é o token `palha` do estilo (`#d6b56a`,
 * `docs/design/vila-meio-termo/README.md`); as outras 5 têm croma menor que
 * ela no OKLab (palha velha, sapé, musgo), para nenhuma gritar mais que o token.
 * Pedido do mestre (12/11/2026, "mais versões de telhados"): ardósia, metal e
 * tabuinhas, 6 cores cada mais cor livre. Mesma régua das de telha e madeira:
 * croma OKLab de 0,004 a 0,076 (telha e madeira vão de 0,008 a 0,078) e luz
 * OKLab de 0,34 a 0,64 (lá também). A ardósia é quase cinza (até
 * 0,024); o cobre novo é a mais forte (0,076) e fica abaixo do vermelho celeiro.
 */

export type ModeloDoTeto = 'telhas' | 'madeira' | 'palha' | 'ardosia' | 'metal' | 'tabuinhas'

export interface CorDoTeto {
  readonly id: string
  readonly nome: string
  /** `#rrggbb`, minúsculo. */
  readonly hex: string
}

/** A ordem do painel (grade de 3 por linha): os três de antes e, embaixo, os de 12/11/2026. */
export const MODELOS_DO_TETO: readonly ModeloDoTeto[] = ['telhas', 'madeira', 'palha', 'ardosia', 'metal', 'tabuinhas']

export const NOME_DO_MODELO: Readonly<Record<ModeloDoTeto, string>> = {
  telhas: 'Telhas',
  madeira: 'Madeira',
  palha: 'Palha',
  ardosia: 'Ardósia',
  metal: 'Metal',
  tabuinhas: 'Tabuinhas',
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
  // Croma OKLab: 0,102 (o token) e de 0,043 a 0,084 nas outras.
  palha: [
    // "Palha dourada", e não "Palha": o painel mostraria "Modelo Palha / Cor Palha".
    { id: 'palha', nome: 'Palha dourada', hex: '#d6b56a' },
    { id: 'palha-clara', nome: 'Palha clara', hex: '#d2bf8c' },
    { id: 'feno', nome: 'Feno', hex: '#b39a5e' },
    { id: 'sape', nome: 'Sapé', hex: '#9a8155' },
    { id: 'palha-velha', nome: 'Palha velha', hex: '#a39478' },
    { id: 'musgo', nome: 'Palha com musgo', hex: '#7d7a5a' },
  ],
  // Croma OKLab de 0,004 a 0,024. Nenhuma se chama "Ardósia": essa é a cor da telha (o painel
  // mostraria "Modelo Ardósia / Cor Ardósia").
  ardosia: [
    { id: 'cinza-azulado', nome: 'Cinza-azulado', hex: '#5b6670' },
    { id: 'grafite', nome: 'Grafite', hex: '#45484e' },
    { id: 'cinza-quente', nome: 'Cinza quente', hex: '#6f6963' },
    { id: 'verde-acinzentado', nome: 'Verde-acinzentado', hex: '#5e6a63' },
    { id: 'roxo-apagado', nome: 'Roxo apagado', hex: '#625b69' },
    { id: 'pedra-lavada', nome: 'Pedra lavada', hex: '#898c8c' },
  ],
  // Croma OKLab: cobre novo 0,076, cobre escurecido 0,053, azinhavre 0,027, ferro oxidado 0,060,
  // chumbo e zinco 0,009. O azinhavre e o zinco desceram de luz na folha de 12/11 (o metal
  // clareia mais a água virada para a luz, e o verde-água claro gritava na vila).
  metal: [
    { id: 'cobre-novo', nome: 'Cobre novo', hex: '#9c6a4e' },
    { id: 'cobre-escurecido', nome: 'Cobre escurecido', hex: '#6e4b3d' },
    { id: 'azinhavre', nome: 'Azinhavre', hex: '#5c716b' },
    { id: 'chumbo', nome: 'Chumbo', hex: '#56595e' },
    { id: 'ferro-oxidado', nome: 'Ferro oxidado', hex: '#7a5242' },
    { id: 'zinco-claro', nome: 'Zinco claro', hex: '#848a8e' },
  ],
  // Croma OKLab: cedro 0,072, mel 0,075, castanho 0,054, verde-musgo 0,045, cinza de chuva e
  // queimado 0,013.
  tabuinhas: [
    { id: 'cedro', nome: 'Cedro', hex: '#8e6045' },
    { id: 'mel', nome: 'Mel', hex: '#a68556' },
    { id: 'castanho', nome: 'Castanho', hex: '#6b4c36' },
    { id: 'cinza-de-chuva', nome: 'Cinza de chuva', hex: '#858078' },
    { id: 'verde-musgo', nome: 'Verde-musgo', hex: '#5e6649' },
    { id: 'queimado', nome: 'Queimado', hex: '#3d3631' },
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
