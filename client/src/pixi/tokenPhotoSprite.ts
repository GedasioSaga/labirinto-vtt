import { Assets, Sprite, Text, Texture } from 'pixi.js'
import { textoDoSelo } from '../lib/batalha/selos'
import { isTokenPhotoData } from '../lib/tokenPhoto'
import { screenLabelSizing } from './screenLabel'

/**
 * Peças de Pixi compartilhadas pelo token com foto nos DOIS lados — editor do
 * mestre (`pixi/tokensRenderer.ts`) e tela do jogador (`player/PlayerView.tsx`).
 * Estão aqui para o recorte redondo ser literalmente o mesmo nos dois: o
 * usuário olha as duas telas e espera ver o mesmo token.
 */

/**
 * Textura de uma referência auto-contida (`data:image/...;base64,...`).
 *
 * Por que não `Assets.load`: o Assets do Pixi escolhe o parser pela extensão
 * da URL, e data URL não tem extensão — ele cai no parser errado e a promessa
 * rejeita. `Image` + `decode()` resolve o caso auto-contido sem depender de
 * detecção nenhuma, e `decode()` garante que a textura nasce já decodificada
 * (sem primeiro quadro em branco).
 */
export async function textureFromDataUrl(src: string): Promise<Texture> {
  const img = new Image()
  img.src = src
  await img.decode()
  return Texture.from(img)
}

/**
 * Encaixa a foto no círculo no modo "cobrir": ela preenche o círculo inteiro e
 * o excesso do lado maior fica fora da máscara. É o que o usuário pediu — foto
 * RECORTADA dentro do círculo —, e nunca deforma: esticar os dois lados para o
 * mesmo tamanho (o que o render fazia antes) achatava rosto em foto retrato.
 *
 * Textura ainda vazia (`Texture.EMPTY`, enquanto o carregamento não volta) cai
 * no quadrado do diâmetro: sem dimensão não há proporção a preservar.
 */
export function fitPhotoSprite(sprite: Sprite, photoRadius: number): void {
  const lado = photoRadius * 2
  const { width, height } = sprite.texture
  if (width <= 0 || height <= 0) {
    sprite.width = lado
    sprite.height = lado
    return
  }
  sprite.scale.set(Math.max(lado / width, lado / height))
}

/**
 * BATALHA F3 (fatia T): a imagem da forma no lugar da foto do token, enquanto
 * o cartão está ligado e o dono escolheu trocar. Por tokenId, o src JÁ PRONTO
 * para carregar: a embutida (`data:image/...`) ou a URL da mídia resolvida por
 * quem monta o canvas (`resolverComBase`, `lib/midia.ts`). Nunca um caminho do
 * disco: não passa por `convertFileSrc`.
 */
export type FotosDaForma = ReadonlyMap<string, string>

/** BATALHA F3 (Q5): um selo como a ficha o mostra; `turnos` null = até o mestre tirar. */
export interface SeloNaFicha {
  nome: string
  turnos: number | null
}

/** Por tokenId, os selos da ficha na ordem em que foram postos. */
export type SelosNasFichas = ReadonlyMap<string, readonly SeloNaFicha[]>

/** Nome (`Container.label`) do texto dos selos na ficha, nos dois lados: é por ele que um teste o acha. */
export const SELOS_NA_FICHA_LABEL = 'selos'
/** Tamanho da letra dos selos, em px de mundo no zoom 1 (um pouco menor que o nome). */
export const SELOS_NA_FICHA_FONT_SIZE = 11
/** Âmbar claro com contorno escuro: lê sobre foto, disco e chão, e não se confunde com o branco do nome. */
const SELOS_NA_FICHA_FILL = 0xffe2a0
const SELOS_NA_FICHA_OUTLINE = 0x1a1208
/** Folga entre o pé do texto e o alto do disco, em fração do raio: as pastilhas de condição sentam na borda. */
const SELOS_NA_FICHA_FOLGA = 0.35
/** Folga mínima em px de mundo, para a ficha pequena. */
const SELOS_NA_FICHA_FOLGA_MIN = 4

/** "ATORDOADO 2", um por linha; "CEGO" sem número quando é até tirar. Sem selo = texto vazio. */
export function textoDosSelosNaFicha(selos: readonly SeloNaFicha[] | undefined): string {
  if (selos === undefined || selos.length === 0) return ''
  return selos.map((selo) => textoDoSelo(selo).toLocaleUpperCase('pt-BR')).join('\n')
}

/**
 * O texto dos selos, nascido escondido. Quem chama o cria só na primeira ficha
 * que ganha selo e depois só o esvazia: `Text` destruído no meio da sessão
 * derruba o Pixi 8.20 (TexturePool.returnTexture).
 */
export function criarTextoDosSelos(): Text {
  const texto = new Text({
    text: '',
    style: {
      fontSize: SELOS_NA_FICHA_FONT_SIZE,
      fontWeight: '700',
      letterSpacing: 0.5,
      align: 'center',
      fill: SELOS_NA_FICHA_FILL,
      stroke: { color: SELOS_NA_FICHA_OUTLINE, width: 3 },
    },
  })
  // Pé do texto no alto do disco: com mais selos, as linhas sobem.
  texto.anchor.set(0.5, 1)
  texto.label = SELOS_NA_FICHA_LABEL
  texto.visible = false
  return texto
}

/** Põe o texto (já criado) com os selos da ficha de raio `raio`, logo acima do disco. `''` esconde. */
export function pintarTextoDosSelos(texto: Text, conteudo: string, raio: number, cameraScale: number): void {
  texto.text = conteudo
  texto.position.set(0, -raio - Math.max(SELOS_NA_FICHA_FOLGA_MIN, raio * SELOS_NA_FICHA_FOLGA))
  escalarTextoDosSelos(texto, cameraScale)
}

/** No zoom atual: nunca menor que o piso de leitura na tela, e escondido no zoom em que o nome também some (`screenLabel.ts`). */
export function escalarTextoDosSelos(texto: Text, cameraScale: number): void {
  const sizing = screenLabelSizing(SELOS_NA_FICHA_FONT_SIZE, cameraScale)
  texto.scale.set(sizing.scale)
  texto.visible = texto.text !== '' && sizing.visible
}

/**
 * Textura da imagem da forma. A embutida não passa pelo `Assets` (data URL não
 * tem extensão; ver `textureFromDataUrl`); a da mídia tem extensão no id e vai
 * direto ao `Assets.load`, que guarda por URL (a mesma forma não baixa duas vezes).
 */
export async function texturaDaForma(src: string): Promise<Texture> {
  return isTokenPhotoData(src) ? textureFromDataUrl(src) : Assets.load<Texture>(src)
}
