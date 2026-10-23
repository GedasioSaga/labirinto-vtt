import { BufferImageSource, Texture } from 'pixi.js'
import type { Prop } from '../types/map'
import { formaDoTapete, normalizarCorDeTecido, normalizarCorDoMovel, vistaDoMovel, voltaDaCerca } from '../lib/mobilia'
import { FATIA_DO_LADRILHO_MS } from '../texturas/ladrilhos'
import { LUGARES_DE_MATERIAL, materialMaisPerto, type OpcaoDeMaterial } from '../texturas/meioTermo/materiais'
import { escalaDoNivel, GRADE_DE_REFERENCIA, montarCena, temTextura, type DesenhoDoMovel } from '../texturas/meioTermo/moveis'
import { limitesDaCena, pintarCenaEmPassos, type Cena, type LimitesDaImagem } from '../texturas/meioTermo/moveis/motor'

/**
 * IMAGEM PRONTA DOS MÓVEIS do Meio-Termo (plano
 * `docs/planos/meio-termo-texturas-objetos-2026-10-23.md`, seções 2 e 5, MT2).
 *
 * Cada móvel vira a CHAVE da imagem: {tipo, vista do mapa, Frente/Lado,
 * materiais, forma, curva (de 5 em 5 graus), pegada em casas (de 0,25 em
 * 0,25), nível de resolução 1|2|3}. Móveis com a mesma chave dividem a mesma
 * imagem; a semente do veio é o hash da chave SEM o nível, para o veio não
 * pular ao mudar o zoom.
 *
 * A imagem nasce com o tamanho final e transparente: quem desenha põe o
 * desenho de linhas por baixo enquanto ela não fica pronta. A geração entra
 * numa FILA de fatias de 8 ms (o mesmo ritmo de `texturas/ladrilhos.ts`) e,
 * pronta, os bytes vão para a mesma textura de uma vez com `source.update()`:
 * o `Graphics` que já a desenha mostra a imagem sem ser repintado (o jogador
 * não precisa mudar a chave de repintura dele).
 *
 * Cache LRU por bytes: 64 MB no computador, 24 MB com `pointer: coarse`. A
 * imagem que sai do cache não é destruída: um `Graphics` ainda pode estar
 * desenhando ela, e o coletor de lixo (e o do Pixi) a solta quando ninguém
 * mais a usa.
 */

/** A única vista desta fatia; a 3/4 chega com a MT11. */
export type VistaDoMapa = 'de-cima'

export const NIVEL_MAXIMO = 3
/** Passo da pegada na chave, em casas. */
export const PASSO_DAS_CASAS = 0.25
/** Passo da curva na chave, em graus. */
export const PASSO_DA_CURVA = 5
const MEGABYTE = 1024 * 1024
export const TETO_NO_COMPUTADOR = 64 * MEGABYTE
export const TETO_NO_TOQUE = 24 * MEGABYTE
/** Lado máximo da imagem em pixels: móvel enorme ganha menos pixels por px, não uma textura que a placa recusa. */
const LADO_MAXIMO_DA_IMAGEM = 2048
const BYTES_POR_PIXEL = 4

export interface ChaveDoMovel {
  readonly desenho: DesenhoDoMovel
  readonly vistaDoMapa: VistaDoMapa
  readonly forma: string
  readonly curva: number
  readonly nivel: number
}

/** O que a silhueta passa para cá: o tamanho e a aparência do móvel. */
export type MovelParaImagem = Pick<
  Prop,
  'width' | 'height' | 'mobilia' | 'mobiliaCor' | 'mobiliaCorDaLinha' | 'mobiliaVista' | 'mobiliaCurva' | 'mobiliaForma' | 'mobiliaCorDoTravesseiro' | 'mobiliaCorDoCobertor'
>

/** Pixels da imagem por px de mundo: 1, 2 ou 3 (a 4x a cama passava de 50 ms). */
export function nivelDeResolucao(cameraScale: number, rendererResolution: number): number {
  const pedido = Math.ceil(cameraScale * rendererResolution)
  return Number.isFinite(pedido) ? Math.min(NIVEL_MAXIMO, Math.max(1, pedido)) : 1
}

function arredondar(valor: number, passo: number): number {
  return Math.round(valor / passo) * passo
}

/** Pegada em casas na grade de referência, de 0,25 em 0,25, nunca menos de 0,25. */
function casasDe(px: number): number {
  return Math.max(PASSO_DAS_CASAS, arredondar(px / GRADE_DE_REFERENCIA, PASSO_DAS_CASAS))
}

/**
 * Material no lugar da cor: cada campo de cor que o móvel já tem vira o
 * material mais perto da lista do lugar (`materialMaisPerto`). A cama usa os
 * 3 campos de hoje (madeira, cobertor, travesseiro); o resto, a "Cor" (o
 * material principal) e a "Cor da linha" (o segundo).
 */
function materiaisDoMovel(prop: MovelParaImagem, tipo: DesenhoDoMovel['tipo']): OpcaoDeMaterial[] {
  const cores =
    tipo === 'catre'
      ? [normalizarCorDoMovel(prop.mobiliaCor), normalizarCorDeTecido(tipo, prop.mobiliaCorDoCobertor), normalizarCorDeTecido(tipo, prop.mobiliaCorDoTravesseiro)]
      : [normalizarCorDoMovel(prop.mobiliaCor), normalizarCorDoMovel(prop.mobiliaCorDaLinha)]
  return LUGARES_DE_MATERIAL[tipo].map((lugar, i) => materialMaisPerto(cores[i], lugar))
}

/** Texto do desenho, sem o nível: dele sai a semente. */
function textoDoDesenho(chave: Omit<ChaveDoMovel, 'nivel'>): string {
  const d = chave.desenho
  return [d.tipo, chave.vistaDoMapa, d.lado, d.materiais.join(','), chave.forma, chave.curva, d.casasW, d.casasH].join('|')
}

/** O texto da chave inteira, o que o cache guarda. */
export function textoDaChave(chave: ChaveDoMovel): string {
  return `${textoDoDesenho(chave)}|${chave.nivel}`
}

const FNV_BASE = 2166136261
const FNV_PRIMO = 16777619
/** A semente fica pequena: entra multiplicada nas coordenadas do ruído, e número grande perde a fração. */
const SEMENTES = 1000

function sementeDoTexto(texto: string): number {
  let h = FNV_BASE
  for (let i = 0; i < texto.length; i += 1) h = Math.imul(h ^ texto.charCodeAt(i), FNV_PRIMO)
  return (h >>> 0) % SEMENTES
}

/** A chave da imagem do móvel, ou `null` se o tipo ainda não tem desenho com textura. */
export function chaveDoMovel(prop: MovelParaImagem, cameraScale: number, rendererResolution: number): ChaveDoMovel | null {
  const tipo = prop.mobilia
  if (!temTextura(tipo)) return null
  const semSemente = {
    tipo,
    lado: vistaDoMovel(prop),
    materiais: materiaisDoMovel(prop, tipo),
    casasW: casasDe(prop.width),
    casasH: casasDe(prop.height),
    semente: 0,
  }
  const parcial = { vistaDoMapa: 'de-cima' as const, forma: formaDoTapete(prop), curva: arredondar(voltaDaCerca(prop), PASSO_DA_CURVA) }
  const semente = sementeDoTexto(textoDoDesenho({ ...parcial, desenho: semSemente }))
  return { ...parcial, desenho: { ...semSemente, semente }, nivel: nivelDeResolucao(cameraScale, rendererResolution) }
}

/** O teto de bytes do aparelho: menor com dedo (celular, tablet). */
export function tetoDeBytesDoAparelho(): number {
  const toque = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  return toque ? TETO_NO_TOQUE : TETO_NO_COMPUTADOR
}

/** A imagem de um móvel, pronta ou ainda na fila, e onde ela fica em px do protótipo. */
export interface ImagemDoMovel {
  readonly textura: Texture
  readonly limites: LimitesDaImagem
  /** Pixels da imagem por px do protótipo. */
  readonly S: number
  readonly casasW: number
  readonly casasH: number
  readonly pronta: boolean
}

interface Entrada {
  readonly chave: string
  readonly textura: Texture
  readonly pixels: Uint8ClampedArray
  readonly limites: LimitesDaImagem
  readonly S: number
  readonly casasW: number
  readonly casasH: number
  readonly bytes: number
  readonly passos: Generator<void, void, void>
  pronta: boolean
  /** Saiu do cache antes de ficar pronta: a fila pula. */
  cancelada: boolean
}

export interface OpcoesDoRaster {
  readonly tetoDeBytes?: number
  /** Agenda a próxima fatia (padrão: `setTimeout(…, 0)`, que dá a vez ao navegador). */
  readonly agendar?: (fatia: () => void) => void
  readonly agora?: () => number
  readonly fatiaMs?: number
}

/** A escala da imagem no nível, menor se o móvel for tão grande que passaria do lado máximo. */
function escalaELimites(nivel: number, cena: Cena): { S: number; limites: LimitesDaImagem } {
  let S = escalaDoNivel(nivel)
  let limites = limitesDaCena(cena, S)
  const maior = Math.max(limites.W, limites.H)
  if (maior > LADO_MAXIMO_DA_IMAGEM) {
    S *= LADO_MAXIMO_DA_IMAGEM / maior
    limites = limitesDaCena(cena, S)
  }
  return { S, limites }
}

export class RasterDosMoveis {
  /** Imagens começadas (cada uma é gerada uma vez só enquanto estiver no cache). */
  geradas = 0
  /** Imagens que terminaram de gerar. */
  prontas = 0
  private bytesNoCache = 0
  private readonly cache = new Map<string, Entrada>()
  private readonly fila: Entrada[] = []
  private bombaAgendada = false
  private readonly tetoDeBytes: number
  private readonly agendar: (fatia: () => void) => void
  private readonly agora: () => number
  private readonly fatiaMs: number

  constructor(opcoes: OpcoesDoRaster = {}) {
    this.tetoDeBytes = opcoes.tetoDeBytes ?? tetoDeBytesDoAparelho()
    this.agendar = opcoes.agendar ?? ((fatia) => setTimeout(fatia, 0))
    this.agora = opcoes.agora ?? (() => performance.now())
    this.fatiaMs = opcoes.fatiaMs ?? FATIA_DO_LADRILHO_MS
  }

  get bytes(): number {
    return this.bytesNoCache
  }

  get teto(): number {
    return this.tetoDeBytes
  }

  /** Tem a imagem desta chave guardada? (Não mexe na ordem do LRU.) */
  guardada(chave: string): boolean {
    return this.cache.has(chave)
  }

  /**
   * A imagem do móvel nesta câmera: a guardada, ou uma nova, transparente,
   * que entra na fila. `null` = o tipo ainda não tem desenho com textura.
   */
  imagemDoMovel(prop: MovelParaImagem, cameraScale: number, rendererResolution: number): ImagemDoMovel | null {
    const chave = chaveDoMovel(prop, cameraScale, rendererResolution)
    if (chave === null) return null
    const texto = textoDaChave(chave)
    const guardada = this.cache.get(texto)
    if (guardada !== undefined) {
      // Usada agora: vai para o fim da fila do LRU.
      this.cache.delete(texto)
      this.cache.set(texto, guardada)
      return guardada
    }
    return this.comecar(texto, chave)
  }

  private comecar(texto: string, chave: ChaveDoMovel): Entrada {
    const cena = montarCena(chave.desenho)
    const { S, limites } = escalaELimites(chave.nivel, cena)
    const pixels = new Uint8ClampedArray(limites.W * limites.H * BYTES_POR_PIXEL)
    // Bytes já multiplicados pelo alfa (a pintura compõe assim): a placa não multiplica de novo.
    const source = new BufferImageSource({ resource: pixels, width: limites.W, height: limites.H, format: 'rgba8unorm', alphaMode: 'premultiplied-alpha', scaleMode: 'linear' })
    const entrada: Entrada = {
      chave: texto,
      textura: new Texture({ source }),
      pixels,
      limites,
      S,
      casasW: chave.desenho.casasW,
      casasH: chave.desenho.casasH,
      bytes: pixels.byteLength,
      passos: pintarCenaEmPassos(cena, S, limites, pixels, true),
      pronta: false,
      cancelada: false,
    }
    this.geradas += 1
    this.cache.set(texto, entrada)
    this.bytesNoCache += entrada.bytes
    this.podar()
    this.fila.push(entrada)
    this.agendarBomba()
    return entrada
  }

  /** Tira as mais antigas até caber no teto; a que acabou de entrar fica, mesmo sozinha acima dele. */
  private podar(): void {
    while (this.bytesNoCache > this.tetoDeBytes && this.cache.size > 1) {
      const maisAntiga = this.cache.keys().next()
      if (maisAntiga.done === true) return
      const entrada = this.cache.get(maisAntiga.value)
      this.cache.delete(maisAntiga.value)
      if (entrada === undefined) continue
      this.bytesNoCache -= entrada.bytes
      if (!entrada.pronta) entrada.cancelada = true
    }
  }

  private agendarBomba(): void {
    if (this.bombaAgendada) return
    this.bombaAgendada = true
    this.agendar(() => this.bombear())
  }

  /**
   * Uma fatia: anda as imagens da fila, uma linha por vez, até passar de
   * `fatiaMs` (ao menos uma linha por fatia, para a fila sempre andar).
   */
  private bombear(): void {
    this.bombaAgendada = false
    const inicio = this.agora()
    let primeira = true
    while (this.fila.length > 0) {
      if (!primeira && this.agora() - inicio >= this.fatiaMs) break
      primeira = false
      const entrada = this.fila[0]
      if (entrada.cancelada) {
        this.fila.shift()
        continue
      }
      let passo = entrada.passos.next()
      while (passo.done !== true && this.agora() - inicio < this.fatiaMs) passo = entrada.passos.next()
      if (passo.done !== true) break
      this.fila.shift()
      entrada.pronta = true
      this.prontas += 1
      // Os bytes já estão no lugar: a textura sobe de novo para a placa, sem repintar o `Graphics`.
      entrada.textura.source.update()
    }
    if (this.fila.length > 0) this.agendarBomba()
  }
}

let padrao: RasterDosMoveis | null = null

/** O raster da sessão (criado na primeira imagem pedida). */
export function rasterDosMoveis(): RasterDosMoveis {
  padrao ??= new RasterDosMoveis()
  return padrao
}

/** Troca o raster da sessão num teste (fila controlada, teto pequeno); `null` volta ao padrão. */
export function trocarRasterNoTeste(raster: RasterDosMoveis | null): void {
  padrao = raster
}
