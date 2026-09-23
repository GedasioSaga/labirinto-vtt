import type { Token } from '../types/map'

/**
 * Foto do token: o que pode atravessar a rede e o que não pode.
 *
 * `Token.image` é o arquivo importado no disco do MESTRE (mesmo pipeline de
 * `Prop.src`) — caminho local, que nunca sai da máquina dele.
 * `Token.imageData` é a cópia pequena e AUTO-CONTIDA da mesma foto
 * (`data:image/...;base64,...`) e é a única forma que o recorte de
 * `lib/fogFilter.ts` deixa passar para o jogador.
 *
 * Este módulo é puro (nenhum import de Pixi, Tauri ou React) para os dois
 * lados — editor do mestre e página do jogador — usarem a MESMA regra.
 */

/**
 * Referência auto-contida de imagem. O casamento com `data:image/...;base64,`
 * e um corpo só de base64 é o que garante, por construção, que aqui não cabe
 * caminho de disco (`C:\...`), endereço de rede (`http://`) nem esquema
 * executável (`javascript:`) — é a validação de fronteira do protocolo, não
 * um detalhe de formatação.
 */
const TOKEN_PHOTO_PATTERN = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/

/**
 * Teto do texto da foto, em caracteres. Ela viaja na mensagem `token.edit` e
 * fica gravada no arquivo do mapa: sem teto, um jogador mandaria megabytes a
 * cada gesto e o mapa salvo cresceria sem limite. 512 mil caracteres ≈ 384 KiB
 * de bytes — folgado para uma foto de 256 px e apertado o bastante para caber
 * num snapshot sem travar a mesa.
 */
export const TOKEN_PHOTO_MAX_CHARS = 512_000

/** Lado máximo da cópia que viaja, em px: o token nunca aparece maior que uma célula da grade. */
export const TOKEN_PHOTO_MAX_SIDE = 256

/** Qualidades tentadas, em ordem, até a foto caber em `TOKEN_PHOTO_MAX_CHARS`. */
const TOKEN_PHOTO_QUALITIES = [0.85, 0.7, 0.55]

/** Aviso em português para quem escolheu uma foto que não cabe de jeito nenhum. */
export const TOKEN_PHOTO_TOO_BIG_MESSAGE = 'essa foto é pesada demais para a mesa — escolha uma imagem menor'

/** A referência é auto-contida (e cabe no teto)? Único jeito aceito de uma foto viajar. */
export function isTokenPhotoData(value: unknown): value is string {
  return typeof value === 'string' && value.length <= TOKEN_PHOTO_MAX_CHARS && TOKEN_PHOTO_PATTERN.test(value)
}

/**
 * Referência que o renderer deve desenhar. O arquivo do mestre vem primeiro
 * (resolução maior, é o original); a cópia embutida é o que sobra quando ele
 * não existe — no jogador, sempre, porque o recorte apaga o caminho.
 *
 * Checagem por veracidade e não `!== null`: token vindo de mapa legado ou de
 * um `addToken` cru de spec e2e pode chegar sem o campo, e `undefined !== null`
 * entraria no ramo "tem foto" com `undefined` na mão (mesma classe de bug já
 * documentada em `pixi/tokensRenderer.ts`).
 */
export function tokenPhotoRef(token: Pick<Token, 'image' | 'imageData'>): string | null {
  return token.image || token.imageData || null
}

/** Nome curto para a tela: caminho de disco vira o nome do arquivo; foto embutida não tem nome. */
export function tokenPhotoLabel(image: string | null | undefined): string {
  if (!image) return ''
  // Guardado ANTES da checagem: o predicado `value is string` de
  // `isTokenPhotoData` remove `string` do ramo FALSO, e ali `image` fica
  // `never`. `caminho` conserva o valor já estreitado para `string`.
  const caminho = image
  if (isTokenPhotoData(image)) return 'Foto escolhida'
  return caminho.split(/[\\/]/).pop() ?? caminho
}

/**
 * Reduz a foto a `TOKEN_PHOTO_MAX_SIDE` e devolve a referência auto-contida
 * que viaja. Precisa de `createImageBitmap` e de canvas 2D de verdade: roda no
 * navegador (tela do jogador) e no webview do mestre, nunca em jsdom.
 *
 * Reduzir aqui, e não no destino, é o que mantém a promessa do teto: a decisão
 * do tamanho é de quem escolhe a foto, e quem recebe só confere.
 */
export async function buildTokenPhotoData(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  try {
    const maiorLado = Math.max(bitmap.width, bitmap.height)
    const escala = maiorLado > TOKEN_PHOTO_MAX_SIDE ? TOKEN_PHOTO_MAX_SIDE / maiorLado : 1
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * escala))
    canvas.height = Math.max(1, Math.round(bitmap.height * escala))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D não disponível')
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (const qualidade of TOKEN_PHOTO_QUALITIES) {
      // Navegador sem WebP devolve PNG na mesma chamada — `isTokenPhotoData` aceita os dois.
      const referencia = canvas.toDataURL('image/webp', qualidade)
      if (isTokenPhotoData(referencia)) return referencia
    }
    throw new Error(TOKEN_PHOTO_TOO_BIG_MESSAGE)
  } finally {
    bitmap.close()
  }
}
