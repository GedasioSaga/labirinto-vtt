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
 * Teto do texto da foto ACEITA, em caracteres: o que o recorte do jogador, o
 * renderer e o host ainda reconhecem como foto. Fica gravada no arquivo do
 * mapa: sem teto, o mapa salvo cresceria sem limite. É maior que o teto de
 * ENVIO (`TOKEN_PHOTO_SEND_MAX_CHARS`) de propósito: mapa salvo antes do teto
 * de envio pode ter cópia embutida entre os dois, e ela continua aparecendo.
 */
export const TOKEN_PHOTO_MAX_CHARS = 512_000

/**
 * Teto do texto da foto que SAI agora, em caracteres — o que
 * `buildTokenPhotoData` produz e o que o jogador envia em `token.edit`. O
 * servidor da mesa derruba o jogador acima de `PLAYER_MESSAGE_MAX_BYTES`
 * (64 KiB, net/protocol.ts); 48 mil caracteres de base64 são ASCII puro (1
 * byte cada, sem escape no JSON) e deixam ~16 KiB para o resto da mensagem —
 * a pior `token.edit` fica abaixo de 80% do limite (tokenPhoto.cabe.test.ts).
 * Uma foto WebP de 256 px costuma caber inteira; quando não, ela é reduzida.
 */
export const TOKEN_PHOTO_SEND_MAX_CHARS = 48_000

/** Lado máximo da cópia que viaja, em px: o token nunca aparece maior que uma célula da grade. */
export const TOKEN_PHOTO_MAX_SIDE = 256

/**
 * Lados tentados, em ordem, quando a foto não cabe no teto de envio. O último
 * (64 px) ainda reconhece um rosto no tamanho em que o token aparece; menor que
 * isso, é melhor recusar com aviso do que mandar um borrão.
 */
const TOKEN_PHOTO_SIDES = [TOKEN_PHOTO_MAX_SIDE, 192, 128, 96, 64]

/** Qualidades tentadas, em ordem, em cada lado, até a foto caber em `TOKEN_PHOTO_SEND_MAX_CHARS`. */
const TOKEN_PHOTO_QUALITIES = [0.85, 0.7, 0.55]

/** Aviso em português para quem escolheu uma foto que não cabe de jeito nenhum. */
export const TOKEN_PHOTO_TOO_BIG_MESSAGE = 'essa foto é pesada demais para a mesa — escolha uma imagem menor'

/** A referência é auto-contida (e cabe no teto)? Único jeito aceito de uma foto viajar. */
export function isTokenPhotoData(value: unknown): value is string {
  return typeof value === 'string' && value.length <= TOKEN_PHOTO_MAX_CHARS && TOKEN_PHOTO_PATTERN.test(value)
}

/** A foto tem a forma certa E cabe numa mensagem que o servidor aceita? Condição para SAIR da máquina do jogador. */
export function fitsTokenPhotoSend(value: unknown): value is string {
  return isTokenPhotoData(value) && value.length <= TOKEN_PHOTO_SEND_MAX_CHARS
}

/**
 * Codifica a foto com o maior lado limitado a `maxSide` px, na qualidade
 * pedida, e devolve a referência `data:image/...;base64,...`.
 */
export type TokenPhotoEncoder = (maxSide: number, quality: number) => string

/**
 * Escolhe a MAIOR foto que cabe no teto de envio: desce a qualidade, depois o
 * lado, e para na primeira que cabe. Lança `TOKEN_PHOTO_TOO_BIG_MESSAGE` quando
 * nem o menor lado cabe — quem escolheu a foto vê o aviso, e nada é enviado.
 *
 * Separada do canvas para ser testável em jsdom (tokenPhoto.cabe.test.ts).
 */
export function fitTokenPhoto(encode: TokenPhotoEncoder): string {
  for (const lado of TOKEN_PHOTO_SIDES) {
    for (const qualidade of TOKEN_PHOTO_QUALITIES) {
      const referencia = encode(lado, qualidade)
      // Medido ANTES da checagem: o predicado de `fitsTokenPhotoSend` deixa
      // `referencia` como `never` no ramo falso (mesma nota de `tokenPhotoLabel`).
      // Navegador sem encoder WebP devolve PNG, que ignora a qualidade: repetir
      // o mesmo lado daria a mesma imagem — só o lado menor muda o tamanho.
      const ignoraQualidade = referencia.startsWith('data:image/png')
      if (fitsTokenPhotoSend(referencia)) return referencia
      if (ignoraQualidade) break
    }
  }
  throw new Error(TOKEN_PHOTO_TOO_BIG_MESSAGE)
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
 * Reduz a foto até caber no teto de envio (`fitTokenPhoto`) e devolve a
 * referência auto-contida que viaja. Precisa de `createImageBitmap` e de
 * canvas 2D de verdade: roda no navegador (tela do jogador) e no webview do
 * mestre, nunca em jsdom.
 *
 * Reduzir aqui, e não no destino, é o que mantém a promessa do teto: a decisão
 * do tamanho é de quem escolhe a foto, e quem recebe só confere.
 */
export async function buildTokenPhotoData(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D não disponível')
    const maiorLado = Math.max(bitmap.width, bitmap.height)
    return fitTokenPhoto((ladoMaximo, qualidade) => {
      const escala = maiorLado > ladoMaximo ? ladoMaximo / maiorLado : 1
      // Redimensionar o canvas limpa o desenho: redesenha sempre do ORIGINAL,
      // nunca de uma cópia já reduzida (reduzir duas vezes borra à toa).
      canvas.width = Math.max(1, Math.round(bitmap.width * escala))
      canvas.height = Math.max(1, Math.round(bitmap.height * escala))
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      // Navegador sem WebP devolve PNG na mesma chamada — `fitTokenPhoto` trata os dois.
      return canvas.toDataURL('image/webp', qualidade)
    })
  } finally {
    bitmap.close()
  }
}
