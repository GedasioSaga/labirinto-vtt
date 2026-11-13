import type {
  AmbienteDoMapa,
  DirecaoDoVento,
  EfeitoDoAmbiente,
  EfeitoNoMapa,
  FrequenciaDoRelampago,
  MapData,
  ParticulasDaCena,
  PinceladaDeAmbiente,
  QuantidadeDeParticulas,
  RegionPoint,
  TipoDeFolhas,
  VentoDaCena,
} from '../types/map'
import { caminhosParaJogador } from './penhasco'
import { comPiso, ehPiso } from './pisos'
import { FORCA_DA_NEBLINA_MAX, FORCA_DA_NEBLINA_MIN, PINCELADAS_MAX, PONTOS_MAX, dividirPincelada, type ResultadoDaNeblina } from './neblina'

/**
 * AMBIENTE (pedido do mestre de 12/11/2026: "a ferramenta de neblina pode se
 * tornar ferramenta ambiente"). A ferramenta Neblina vira Ambiente, com seis
 * efeitos: neblina, chuva, brasas, neve, folhas e cinzas e fumaça. Cada um vai
 * no MAPA INTEIRO (uma chave, com intensidade) ou PINTADO numa área, como a
 * neblina já ia. O vento é um só por cena.
 *
 * - A NEBLINA continua nos campos dela (`lib/neblina.ts`): o mapa de antes
 *   abre igual, pixel a pixel, e o app antigo continua lendo.
 * - Os outros cinco moram em `MapData.ambiente` (a chave e o vento) e
 *   `MapData.ambientePintado` (as pinceladas, cada uma com o efeito).
 * - FUMAÇA E BRASAS do mapa inteiro também gravam `MapData.particulas` (a
 *   quantidade de antes), derivada daqui: com fogo na cena, elas nascem dos
 *   fogos (`pixi/particulasDoMapa.ts`), e o app 0.5.61 continua mostrando.
 *
 * Só dados, puros. O desenho é do `pixi/drawAmbiente.ts`.
 */

export const EFEITOS_DO_AMBIENTE: readonly EfeitoDoAmbiente[] = ['chuva', 'brasas', 'neve', 'folhas', 'fumaca']

/** Os seis do painel, na ordem das teclas 1 a 6. */
export type EfeitoDoPainel = 'neblina' | EfeitoDoAmbiente
export const EFEITOS_DO_PAINEL: readonly EfeitoDoPainel[] = ['neblina', 'chuva', 'brasas', 'neve', 'folhas', 'fumaca']

export const INTENSIDADE_MIN = 0
export const INTENSIDADE_MAX = 100

/** Com que intensidade a chave do mapa inteiro liga da primeira vez (os números do protótipo aprovado). */
export const INTENSIDADE_PADRAO: Readonly<Record<EfeitoDoAmbiente, number>> = {
  chuva: 60,
  brasas: 50,
  neve: 55,
  folhas: 50,
  fumaca: 50,
}

export const VENTO_PADRAO: Readonly<VentoDaCena> = { direcao: 'SE', forca: 35 }
export const FORCA_DO_VENTO_MIN = 0
export const FORCA_DO_VENTO_MAX = 100

export const DIRECOES_DO_VENTO: readonly DirecaoDoVento[] = ['NO', 'N', 'NE', 'O', 'L', 'SO', 'S', 'SE']

const RAIZ = Math.SQRT1_2
/** Para onde cada direção sopra, em px de tela (y cresce para baixo). */
export const VETOR_DA_DIRECAO: Readonly<Record<DirecaoDoVento, readonly [number, number]>> = {
  NO: [-RAIZ, -RAIZ],
  N: [0, -1],
  NE: [RAIZ, -RAIZ],
  O: [-1, 0],
  L: [1, 0],
  SO: [-RAIZ, RAIZ],
  S: [0, 1],
  SE: [RAIZ, RAIZ],
}

export const TIPOS_DE_FOLHAS: readonly TipoDeFolhas[] = ['folhas', 'cinzas', 'duas']
export const FREQUENCIAS_DO_RELAMPAGO: readonly FrequenciaDoRelampago[] = ['nao', 'raro', 'frequente']

function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor))
}

function numeroFinito(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

// ---------- os nomes que o painel mostra ----------

/** O nome da intensidade (Garoa, Chuva, Chuva forte, Tempestade...), igual ao protótipo aprovado. */
export function nomeDaIntensidade(efeito: EfeitoDoPainel, valor: number): string {
  switch (efeito) {
    case 'neblina':
      return valor < 30 ? 'Leve' : valor < 65 ? 'Média' : 'Fechada'
    case 'chuva':
      return valor < 30 ? 'Garoa' : valor < 60 ? 'Chuva' : valor < 85 ? 'Chuva forte' : 'Tempestade'
    case 'neve':
      return valor < 30 ? 'Floquinhos' : valor < 65 ? 'Neve' : 'Nevasca'
    case 'brasas':
    case 'folhas':
      return valor < 35 ? 'Poucas' : valor < 70 ? 'Várias' : 'Muitas'
    case 'fumaca':
      return valor < 35 ? 'Pouca' : valor < 70 ? 'Média' : 'Muita'
  }
}

/** O nome da força do vento. */
export function nomeDoVento(forca: number): string {
  return forca <= 0 ? 'Calmo' : forca < 30 ? 'Brisa' : forca < 65 ? 'Vento' : 'Ventania'
}

// ---------- a chave do mapa inteiro ----------

/** A chave de um efeito, já com os padrões: desligada e na intensidade padrão quando o mapa não diz nada. */
export function efeitoDoMapa(map: Pick<MapData, 'ambiente'>, efeito: EfeitoDoAmbiente): Required<EfeitoNoMapa> {
  const atual = map.ambiente?.[efeito]
  return { ligada: atual?.ligada ?? false, intensidade: atual?.intensidade ?? INTENSIDADE_PADRAO[efeito] }
}

/** Quanto do efeito cobre o mapa inteiro, de 0 a 1 (0 = chave desligada). */
export function intensidadeNoMapaInteiro(map: Pick<MapData, 'ambiente'>, efeito: EfeitoDoAmbiente): number {
  const atual = map.ambiente?.[efeito]
  if (atual === undefined || !atual.ligada) return 0
  return limitar(atual.intensidade, INTENSIDADE_MIN, INTENSIDADE_MAX) / INTENSIDADE_MAX
}

export function tipoDeFolhas(map: Pick<MapData, 'ambiente'>): TipoDeFolhas {
  return map.ambiente?.folhas?.tipo ?? 'folhas'
}

export function ventoDoMapa(map: Pick<MapData, 'ambiente'>): VentoDaCena {
  return map.ambiente?.vento ?? VENTO_PADRAO
}

/** O vento em px de tela por unidade (comprimento de 0 a 1): o que o desenho usa. */
export function vetorDoVento(vento: VentoDaCena): [number, number] {
  const [x, y] = VETOR_DA_DIRECAO[vento.direcao]
  const forca = limitar(vento.forca, FORCA_DO_VENTO_MIN, FORCA_DO_VENTO_MAX) / FORCA_DO_VENTO_MAX
  return [x * forca, y * forca]
}

export function relampagoDoMapa(map: Pick<MapData, 'ambiente'>): FrequenciaDoRelampago {
  return map.ambiente?.relampago ?? 'raro'
}

export function somDaChuvaLigado(map: Pick<MapData, 'ambiente'>): boolean {
  return map.ambiente?.somDaChuva !== false
}

export function chaoMolhaLigado(map: Pick<MapData, 'ambiente'>): boolean {
  return map.ambiente?.chaoMolha !== false
}

/** As pinceladas de um efeito, na ordem (a de depois cobre a de antes). */
export function pinceladasDoEfeito(lista: readonly PinceladaDeAmbiente[] | undefined, efeito: EfeitoDoAmbiente): PinceladaDeAmbiente[] {
  return (lista ?? []).filter((p) => p.efeito === efeito)
}

/** O efeito tem alguma pincelada de pincel (a borracha sozinha não desenha nada)? */
export function temPincelDoEfeito(lista: readonly PinceladaDeAmbiente[] | undefined, efeito: EfeitoDoAmbiente): boolean {
  return (lista ?? []).some((p) => p.efeito === efeito && p.tipo === 'pincel')
}

/** A cena tem algum efeito de partícula do Ambiente para desenhar (chave ligada ou pincel)? A neblina é à parte. */
export function temAmbiente(map: Pick<MapData, 'ambiente' | 'ambientePintado'>): boolean {
  return EFEITOS_DO_AMBIENTE.some((e) => intensidadeNoMapaInteiro(map, e) > 0 || temPincelDoEfeito(map.ambientePintado, e))
}

// ---------- fumaça e brasas: a quantidade de antes (`MapData.particulas`) ----------

/** A intensidade (0 a 100) que cada quantidade de antes vira ao abrir um mapa antigo. */
export const INTENSIDADE_DA_QUANTIDADE: Readonly<Record<QuantidadeDeParticulas, number>> = { pouca: 30, media: 60, muita: 90 }

/** A quantidade de antes para uma intensidade: a que as partículas dos fogos usam. */
export function quantidadeDaIntensidade(intensidade: number): QuantidadeDeParticulas {
  return intensidade < 45 ? 'pouca' : intensidade < 75 ? 'media' : 'muita'
}

/** `MapData.particulas` derivado do Ambiente: fumaça e brasas do mapa inteiro ligadas. `undefined` = nenhuma. */
export function particulasDoAmbiente(ambiente: AmbienteDoMapa | undefined): ParticulasDaCena | undefined {
  const fumaca = ambiente?.fumaca?.ligada === true && ambiente.fumaca.intensidade > 0 ? quantidadeDaIntensidade(ambiente.fumaca.intensidade) : undefined
  const brasas = ambiente?.brasas?.ligada === true && ambiente.brasas.intensidade > 0 ? quantidadeDaIntensidade(ambiente.brasas.intensidade) : undefined
  if (fumaca === undefined && brasas === undefined) return undefined
  return { ...(fumaca === undefined ? {} : { fumaca }), ...(brasas === undefined ? {} : { brasas }) }
}

// ---------- trocar ----------

/** O que o painel muda de uma vez. Efeito `null` = tira a chave (volta ao padrão). */
export type MudancaDoAmbiente = Partial<{
  [E in EfeitoDoAmbiente]: (E extends 'folhas' ? EfeitoNoMapa & { tipo?: TipoDeFolhas } : EfeitoNoMapa) | null
}> &
  Partial<Pick<AmbienteDoMapa, 'vento' | 'relampago' | 'somDaChuva' | 'chaoMolha'>>

function normalizarEfeito(efeito: EfeitoNoMapa): EfeitoNoMapa {
  return { ligada: efeito.ligada, intensidade: Math.round(limitar(efeito.intensidade, INTENSIDADE_MIN, INTENSIDADE_MAX)) }
}

function normalizarVento(vento: VentoDaCena): VentoDaCena {
  return { direcao: vento.direcao, forca: Math.round(limitar(vento.forca, FORCA_DO_VENTO_MIN, FORCA_DO_VENTO_MAX)) }
}

/** O ambiente sem as chaves vazias; nada sobrando = `undefined` (o mapa volta a salvar como antes). */
function semVazios(ambiente: AmbienteDoMapa): AmbienteDoMapa | undefined {
  const saida: AmbienteDoMapa = {}
  for (const [chave, valor] of Object.entries(ambiente)) {
    if (valor !== undefined) Object.assign(saida, { [chave]: valor })
  }
  return Object.keys(saida).length === 0 ? undefined : saida
}

/** O mapa com o ambiente e as partículas derivadas trocados; `undefined` tira o campo. */
function comCampos(map: MapData, ambiente: AmbienteDoMapa | undefined): MapData {
  const copia: MapData = { ...map }
  if (ambiente === undefined) delete copia.ambiente
  else copia.ambiente = ambiente
  const particulas = particulasDoAmbiente(ambiente)
  if (particulas === undefined) delete copia.particulas
  else copia.particulas = particulas
  return copia
}

/**
 * O mapa com o ambiente trocado. O mesmo valor devolve o MESMO mapa (sem
 * passo vazio no desfazer). Fumaça e brasas regravam `particulas`.
 */
export function comAmbiente(map: MapData, mudanca: MudancaDoAmbiente): MapData {
  const atual: AmbienteDoMapa = { ...(map.ambiente ?? {}) }
  for (const efeito of EFEITOS_DO_AMBIENTE) {
    if (!(efeito in mudanca)) continue
    const valor = mudanca[efeito]
    if (valor === null || valor === undefined) {
      delete atual[efeito]
      continue
    }
    if (efeito === 'folhas') {
      const tipo = 'tipo' in valor && valor.tipo !== undefined ? valor.tipo : atual.folhas?.tipo
      atual.folhas = { ...normalizarEfeito(valor), ...(tipo === undefined || tipo === 'folhas' ? {} : { tipo }) }
    } else {
      atual[efeito] = normalizarEfeito(valor)
    }
  }
  if (mudanca.vento !== undefined) atual.vento = normalizarVento(mudanca.vento)
  if (mudanca.relampago !== undefined) atual.relampago = mudanca.relampago === 'raro' ? undefined : mudanca.relampago
  if (mudanca.somDaChuva !== undefined) atual.somDaChuva = mudanca.somDaChuva ? undefined : false
  if (mudanca.chaoMolha !== undefined) atual.chaoMolha = mudanca.chaoMolha ? undefined : false
  const novo = semVazios(atual)
  if (JSON.stringify(novo ?? null) === JSON.stringify(map.ambiente ?? null)) return map
  return comCampos(map, novo)
}

/** O mapa com a lista de pinceladas trocada; lista vazia tira o campo. */
export function comAmbientePintado(map: MapData, lista: readonly PinceladaDeAmbiente[]): MapData {
  if (lista.length === 0) {
    if (map.ambientePintado === undefined) return map
    const copia = { ...map }
    delete copia.ambientePintado
    return copia
  }
  return { ...map, ambientePintado: [...lista] }
}

/** Borracha antes de qualquer pincel DO MESMO EFEITO não tira nada: sai. */
export function soComAmbiente(lista: readonly PinceladaDeAmbiente[]): PinceladaDeAmbiente[] {
  const comPincel = new Set<EfeitoDoAmbiente>()
  const saida: PinceladaDeAmbiente[] = []
  for (const passo of lista) {
    if (passo.tipo === 'pincel') comPincel.add(passo.efeito)
    if (comPincel.has(passo.efeito)) saida.push(passo)
  }
  return saida
}

/**
 * A lista do piso com o passo novo no fim (em pedaços acima de `PONTOS_MAX`).
 * A borracha num efeito sem pincel não entra; com o mapa no teto, nada entra.
 */
export function somarPinceladaDeAmbiente(
  doPiso: readonly PinceladaDeAmbiente[],
  passo: PinceladaDeAmbiente,
  totalNoMapa: number = doPiso.length,
): { lista: readonly PinceladaDeAmbiente[]; resultado: ResultadoDaNeblina } {
  if (passo.pontos.length === 0) return { lista: doPiso, resultado: 'vazio' }
  if (passo.tipo === 'borracha' && !temPincelDoEfeito(doPiso, passo.efeito)) return { lista: doPiso, resultado: 'sem-neblina' }
  const pedacos = dividirPincelada(passo).map((p) => ({ ...p, efeito: passo.efeito }))
  if (totalNoMapa + pedacos.length > PINCELADAS_MAX) return { lista: doPiso, resultado: 'cheio' }
  return { lista: [...doPiso, ...pedacos], resultado: 'ok' }
}

/**
 * O que o jogador recebe do pincel: só o pedaço de cada pincelada que encosta
 * no que ele conhece, fora de lugar escondido e de zona oculta (a mesma regra
 * da neblina pintada). Sem isso, a chuva pintada sobre o que ele não explorou
 * desenharia a forma do lugar.
 */
export function ambienteParaJogador(
  lista: readonly PinceladaDeAmbiente[] | undefined,
  conhece: (p: RegionPoint) => boolean,
  escondido: (p: RegionPoint) => boolean,
): PinceladaDeAmbiente[] | undefined {
  if (lista === undefined || lista.length === 0) return undefined
  const saida = soComAmbiente(caminhosParaJogador(lista, conhece, escondido))
  return saida.length > 0 ? saida : undefined
}

// ---------- leitura do arquivo ----------

function lerEfeito(valor: unknown): EfeitoNoMapa | undefined {
  if (typeof valor !== 'object' || valor === null) return undefined
  const { ligada, intensidade } = valor as Record<string, unknown>
  if (typeof ligada !== 'boolean' || !numeroFinito(intensidade)) return undefined
  return normalizarEfeito({ ligada, intensidade })
}

function lerVento(valor: unknown): VentoDaCena | undefined {
  if (typeof valor !== 'object' || valor === null) return undefined
  const { direcao, forca } = valor as Record<string, unknown>
  const dir = DIRECOES_DO_VENTO.find((d) => d === direcao)
  if (dir === undefined || !numeroFinito(forca)) return undefined
  return normalizarVento({ direcao: dir, forca })
}

/**
 * O ambiente do arquivo, ou `undefined`. O que está torto sai (vale o padrão).
 * MIGRAÇÃO: mapa de antes com `particulas` (fumaça e brasas da Luz da cena)
 * ganha a chave do mapa inteiro desses dois, na intensidade da quantidade.
 */
export function lerAmbiente(valor: unknown, particulas: ParticulasDaCena | undefined): AmbienteDoMapa | undefined {
  const bruto = typeof valor === 'object' && valor !== null ? (valor as Record<string, unknown>) : {}
  const ambiente: AmbienteDoMapa = {}
  for (const efeito of EFEITOS_DO_AMBIENTE) {
    const lido = lerEfeito(bruto[efeito])
    if (lido === undefined) continue
    if (efeito === 'folhas') {
      const tipo = TIPOS_DE_FOLHAS.find((t) => typeof bruto.folhas === 'object' && bruto.folhas !== null && t === (bruto.folhas as Record<string, unknown>).tipo)
      ambiente.folhas = { ...lido, ...(tipo === undefined || tipo === 'folhas' ? {} : { tipo }) }
    } else {
      ambiente[efeito] = lido
    }
  }
  const vento = lerVento(bruto.vento)
  if (vento !== undefined) ambiente.vento = vento
  const relampago = FREQUENCIAS_DO_RELAMPAGO.find((f) => f === bruto.relampago)
  if (relampago !== undefined && relampago !== 'raro') ambiente.relampago = relampago
  if (bruto.somDaChuva === false) ambiente.somDaChuva = false
  if (bruto.chaoMolha === false) ambiente.chaoMolha = false
  // A fumaça e as brasas de antes (Luz da cena) viram a chave do Ambiente.
  if (ambiente.fumaca === undefined && particulas?.fumaca !== undefined) ambiente.fumaca = { ligada: true, intensidade: INTENSIDADE_DA_QUANTIDADE[particulas.fumaca] }
  if (ambiente.brasas === undefined && particulas?.brasas !== undefined) ambiente.brasas = { ligada: true, intensidade: INTENSIDADE_DA_QUANTIDADE[particulas.brasas] }
  return semVazios(ambiente)
}

function lerPonto(valor: unknown): RegionPoint | null {
  if (typeof valor !== 'object' || valor === null) return null
  const { x, y } = valor as Record<string, unknown>
  return numeroFinito(x) && numeroFinito(y) ? { x, y } : null
}

function lerPinceladaDeAmbiente(valor: unknown): PinceladaDeAmbiente | null {
  if (typeof valor !== 'object' || valor === null) return null
  const { id, tipo, forca, raio, pontos, piso, efeito } = valor as Record<string, unknown>
  const qual = EFEITOS_DO_AMBIENTE.find((e) => e === efeito)
  if (qual === undefined) return null
  if (typeof id !== 'string' || id.length === 0) return null
  if (tipo !== 'pincel' && tipo !== 'borracha') return null
  if (!numeroFinito(forca)) return null
  if (!numeroFinito(raio) || raio <= 0) return null
  if (!Array.isArray(pontos) || pontos.length === 0) return null
  const lidos: RegionPoint[] = []
  for (const p of pontos.slice(0, PONTOS_MAX)) {
    const ponto = lerPonto(p)
    if (ponto === null) return null
    lidos.push(ponto)
  }
  const passo: PinceladaDeAmbiente = { id, tipo, efeito: qual, forca: limitar(forca, FORCA_DA_NEBLINA_MIN, FORCA_DA_NEBLINA_MAX), raio, pontos: lidos }
  return comPiso(passo, ehPiso(piso) ? piso : undefined)
}

/** As pinceladas do arquivo, ou `undefined`. A quebrada sai; acima do teto, ficam as mais novas. */
export function lerAmbientePintado(valor: unknown): PinceladaDeAmbiente[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const lista: PinceladaDeAmbiente[] = []
  for (const item of valor.slice(-PINCELADAS_MAX)) {
    const passo = lerPinceladaDeAmbiente(item)
    if (passo !== null) lista.push(passo)
  }
  return lista.length > 0 ? lista : undefined
}
