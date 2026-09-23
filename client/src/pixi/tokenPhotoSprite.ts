import { Sprite, Texture } from 'pixi.js'

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
