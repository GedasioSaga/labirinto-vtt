import { abrirFonteDoDesenhado, type IdDoDesenhado } from './fonte'
import { ALTURAS_DO_TRACO, lerBordaDoTraco, lerFaceDoTraco, type AlturaDoTraco, type BordaDoTraco, type FaceDoTraco } from './traco'

/**
 * O CARREGADOR DOS TRAÇOS DO DESENHADO (plano de 29/10/2026, F4): baixa e
 * decodifica as imagens de uma face (cor e relevo de cada altura) ou de uma
 * borda do pacote, pela `FonteDoDesenhado`, só quando um renderer pede.
 *
 * - O traço vai para a placa como textura (o shader de `pixi/malhaDoTraco.ts`
 *   lê a imagem): aqui fica só a imagem decodificada; cada palco faz as
 *   texturas dele e as solta. Nenhum `ImageData` na memória comum.
 * - Teto por item (CONTRATO 11.10): 6 MiB na placa, com mipmaps. O que passa
 *   não carrega e o traço fica no Atual.
 * - Enquanto não chega, ou se falhar, quem pediu pinta o Atual; quando chega,
 *   os ouvintes (`assinarTracosDesenhados`) repintam. A falha tenta de novo
 *   depois de `ESPERA_DEPOIS_DA_FALHA_MS` (a rede do jogador pode voltar).
 */

/** Os traços que o app usa: o penhasco e a borda dele (F4a); a parede, a janela e a grade (F4b). */
export const TRACOS_DO_DESENHADO = ['penhasco', 'penhasco-borda', 'parede', 'janela', 'grade-de-prisao'] as const satisfies readonly IdDoDesenhado[]
export type IdDoTracoDesenhado = (typeof TRACOS_DO_DESENHADO)[number]

const MEBIBYTE = 1024 * 1024
/** Teto na placa por item (11.10), imagens somadas com mipmaps. */
export const TETO_POR_TRACO = 6 * MEBIBYTE
/** Os mipmaps somam um terço à imagem. */
const FATOR_DOS_MIPS = 4 / 3
const ESPERA_DEPOIS_DA_FALHA_MS = 10_000

export interface FaceCarregada {
  readonly face: FaceDoTraco
  /** O `textura.json` como veio (a parede lê dele o bloco `parede` e o `tingir`). */
  readonly bruto: unknown
  readonly imagens: Readonly<Record<AlturaDoTraco, { readonly cor: HTMLImageElement; readonly relevo: HTMLImageElement }>>
  /** O que a face pesa na placa (RGBA + mipmaps), por palco. */
  readonly bytes: number
}

export interface BordaCarregada {
  readonly borda: BordaDoTraco
  readonly imagem: HTMLImageElement
  readonly bytes: number
}

type Pronto = { readonly tipo: 'face'; readonly face: FaceCarregada } | { readonly tipo: 'borda'; readonly borda: BordaCarregada }

type Estado =
  | { readonly tipo: 'carregando' }
  | { readonly tipo: 'pronto'; readonly pronto: Pronto }
  | { readonly tipo: 'falhou'; readonly quando: number }

const estados = new Map<IdDoTracoDesenhado, Estado>()
const ouvintes = new Set<() => void>()

/** Avisado quando um traço fica pronto (quem pintou o Atual no lugar dele repinta). */
export function assinarTracosDesenhados(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

function avisar(): void {
  for (const o of [...ouvintes]) o()
}

/** O que os traços prontos pesam na placa, por palco (o portão de memória da integração lê este número). */
export function bytesDosTracosDesenhados(): number {
  let soma = 0
  for (const e of estados.values()) {
    if (e.tipo !== 'pronto') continue
    soma += e.pronto.tipo === 'face' ? e.pronto.face.bytes : e.pronto.borda.bytes
  }
  return soma
}

function bytesNaPlaca(largura: number, altura: number): number {
  return Math.ceil(largura * altura * 4 * FATOR_DOS_MIPS)
}

/** Um PNG da fonte, decodificado e no tamanho que o `textura.json` diz; `null` = não serve. */
async function abrirImagem(url: string | undefined, largura: number, altura: number): Promise<HTMLImageElement | null> {
  if (url === undefined) return null
  const imagem = new Image()
  imagem.decoding = 'async'
  imagem.src = url
  try {
    await imagem.decode()
  } catch {
    return null
  }
  return imagem.naturalWidth === largura && imagem.naturalHeight === altura ? imagem : null
}

async function carregarFace(id: IdDoTracoDesenhado): Promise<Pronto | null> {
  const fonte = await abrirFonteDoDesenhado()
  const bruto: unknown = await fonte.textura(id)
  const face = lerFaceDoTraco(bruto)
  if (face === null) return null
  let bytes = 0
  for (const a of ALTURAS_DO_TRACO) bytes += 2 * bytesNaPlaca(face.alturas[a].largura, face.alturas[a].altura)
  if (bytes > TETO_POR_TRACO) {
    console.warn(`[desenhado] '${id}' passa do teto de ${TETO_POR_TRACO / MEBIBYTE} MiB na placa; fica o Atual`)
    return null
  }
  const lidas = await Promise.all(
    ALTURAS_DO_TRACO.flatMap((a) => {
      const { cor, relevo, largura, altura } = face.alturas[a]
      return [abrirImagem(fonte.urlDe(id, cor), largura, altura), abrirImagem(fonte.urlDe(id, relevo), largura, altura)]
    }),
  )
  const [bc, br, mc, mr, ac, ar] = lidas
  if (bc == null || br == null || mc == null || mr == null || ac == null || ar == null) return null
  const imagens = { baixo: { cor: bc, relevo: br }, medio: { cor: mc, relevo: mr }, alto: { cor: ac, relevo: ar } }
  return { tipo: 'face', face: { face, bruto, imagens, bytes } }
}

async function carregarBorda(id: IdDoTracoDesenhado): Promise<Pronto | null> {
  const fonte = await abrirFonteDoDesenhado()
  const borda = lerBordaDoTraco(await fonte.textura(id))
  if (borda === null) return null
  const bytes = bytesNaPlaca(borda.largura, borda.altura)
  if (bytes > TETO_POR_TRACO) return null
  const imagem = await abrirImagem(fonte.urlDe(id, borda.arquivo), borda.largura, borda.altura)
  return imagem === null ? null : { tipo: 'borda', borda: { borda, imagem, bytes } }
}

async function carregar(id: IdDoTracoDesenhado, parte: 'face' | 'borda'): Promise<void> {
  try {
    const pronto = parte === 'face' ? await carregarFace(id) : await carregarBorda(id)
    if (pronto === null) {
      estados.set(id, { tipo: 'falhou', quando: Date.now() })
      console.warn(`[desenhado] o traço '${id}' não serve ou não abriu; fica o Atual`)
      return
    }
    estados.set(id, { tipo: 'pronto', pronto })
    avisar()
  } catch (erro: unknown) {
    estados.set(id, { tipo: 'falhou', quando: Date.now() })
    console.warn(`[desenhado] o traço '${id}' não carregou; fica o Atual`, erro)
  }
}

function pedir(id: IdDoTracoDesenhado, parte: 'face' | 'borda'): Pronto | null {
  const e = estados.get(id)
  if (e?.tipo === 'pronto') return e.pronto
  if (e?.tipo === 'carregando') return null
  if (e?.tipo === 'falhou' && Date.now() - e.quando < ESPERA_DEPOIS_DA_FALHA_MS) return null
  estados.set(id, { tipo: 'carregando' })
  void carregar(id, parte)
  return null
}

/** A face `id` pronta, ou `null` (começa a carregar; quem pediu pinta o Atual e repinta no aviso). */
export function pedirFaceDoTraco(id: IdDoTracoDesenhado): FaceCarregada | null {
  const p = pedir(id, 'face')
  return p?.tipo === 'face' ? p.face : null
}

/** A borda `id` pronta, como `pedirFaceDoTraco`. */
export function pedirBordaDoTraco(id: IdDoTracoDesenhado): BordaCarregada | null {
  const p = pedir(id, 'borda')
  return p?.tipo === 'borda' ? p.borda : null
}

const IDS: ReadonlySet<string> = new Set(TRACOS_DO_DESENHADO)

/** O id de traço que o app usa? (A face aponta a borda pelo id do pacote.) */
export function ehTracoDesenhado(id: string): id is IdDoTracoDesenhado {
  return IDS.has(id)
}
