/**
 * AS CAMADAS NA TELA DO JOGADOR (fatia 4 de `docs/planos/camadas-fase3-2026-10-22.md`).
 *
 * O host manda `camadasDoJogador` (só id e opacidade, NUNCA o nome) na ordem
 * da lista, só com as camadas que o jogador vê, e só quando algo difere do
 * padrão: mapa antigo sai idêntico. A tela do jogador monta daqui o modelo e
 * as opacidades da pilha (`player/pilhaDoJogador.ts`).
 */
import type { CamadaDoJogador, CamadaId, MapData, ModeloDeCamadas } from '../../types/map'
import { contextoDeCamadas, type CamposDeCamadas, type ContextoDeCamadas } from './consulta'
import { CAMADAS_PADRAO, MODELO_PADRAO, ehCamadaId, ehCamadaPadrao } from './padrao'

/** Opacidade no intervalo de sempre; 1 = sem campo. */
function alfaValido(valor: number): number {
  return Math.min(1, Math.max(0, valor))
}

/**
 * HOST: o que a tela do jogador precisa das camadas. `undefined` quando a
 * ordem das camadas que ele vê é a padrão e todas estão a 100% — a tela dele
 * já desenha assim (e o recorte do mapa antigo fica igual ao de sempre).
 */
export function camadasDoJogadorDoMapa(map: CamposDeCamadas, livresComItens?: ReadonlySet<CamadaId>): CamadaDoJogador[] | undefined {
  const camadas = contextoDeCamadas(map)
  // Livre só com item no pacote (quem chama diz quais): vazia não tem o que ordenar, e o id só diria que ela existe.
  const vistas = camadas.ordem.filter((id) => camadas.jogadorVe(id) && (ehCamadaPadrao(id) || livresComItens === undefined || livresComItens.has(id)))
  const lista = vistas.map((id): CamadaDoJogador => {
    const alfa = camadas.alfa(id)
    return alfa === 1 ? { id } : { id, alfa }
  })
  const padrao = CAMADAS_PADRAO.filter((id) => camadas.jogadorVe(id))
  const naOrdemPadrao = vistas.length === padrao.length && vistas.every((id, i) => id === padrao[i])
  if (naOrdemPadrao && lista.every((c) => c.alfa === undefined)) return undefined
  return lista
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/**
 * Teto da lista que o jogador aceita: as 13 padrão e 51 livres. Folga larga
 * para uma cena de verdade; acima disso é pacote torto ou hostil, e a tela não
 * monta uma pilha desse tamanho por um campo que só decide ordem e opacidade.
 */
export const MAX_CAMADAS_DO_JOGADOR = 64

/**
 * Teto do id de camada que o jogador aceita: `livre_` e 34 caracteres. O id
 * que a fatia 7 cria é `livre_` e uma parte aleatória de 10 ou mais; o padrão
 * de leitura do mapa (`ehCamadaId`) aceita até 64 depois de `livre_`, folga
 * que a rede não precisa carregar.
 */
export const MAX_CARACTERES_DO_ID_DE_CAMADA = 40

/**
 * JOGADOR: leitura tolerante do campo. Ausente, ou torto em qualquer ponto
 * (não lista, item sem id de camada, opacidade que não é número, id
 * repetido, mais de `MAX_CAMADAS_DO_JOGADOR` itens, id com mais de
 * `MAX_CARACTERES_DO_ID_DE_CAMADA` caracteres): `undefined` = a ordem padrão,
 * tudo a 100%. O corte do que ele não vê é do host; aqui só se decide a ordem
 * e a opacidade.
 */
export function lerCamadasDoJogador(valor: unknown): CamadaDoJogador[] | undefined {
  if (!Array.isArray(valor) || valor.length === 0 || valor.length > MAX_CAMADAS_DO_JOGADOR) return undefined
  const vistas = new Set<CamadaId>()
  const lista: CamadaDoJogador[] = []
  for (const item of valor) {
    if (!ehRegistro(item) || !ehCamadaId(item.id) || item.id.length > MAX_CARACTERES_DO_ID_DE_CAMADA || vistas.has(item.id)) return undefined
    const { alfa } = item
    if (alfa !== undefined && (typeof alfa !== 'number' || !Number.isFinite(alfa))) return undefined
    vistas.add(item.id)
    // Só id e opacidade seguem: campo a mais (um nome, de versão futura ou à mão) fica de fora.
    lista.push(alfa === undefined || alfaValido(alfa) === 1 ? { id: item.id } : { id: item.id, alfa: alfaValido(alfa) })
  }
  return lista
}

/** O que a leitura devolve igual ao que chegou: mesma referência, para os portões da tela. */
function mesmaLista(a: readonly CamadaDoJogador[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((c, i) => {
    const outro = b[i]
    return ehRegistro(outro) && Object.keys(outro).length === Object.keys(c).length && outro.id === c.id && outro.alfa === c.alfa
  })
}

/** O mapa com o campo já lido: torto vira ausente; campo bom fica com a mesma referência, e o resto do mapa também. */
export function comCamadasDoJogadorLidas(map: MapData): MapData {
  const recebido: unknown = map.camadasDoJogador
  if (recebido === undefined) return map
  const lidas = lerCamadasDoJogador(recebido)
  if (lidas === undefined) {
    const { camadasDoJogador: _torto, ...semCampo } = map
    return semCampo
  }
  return Array.isArray(recebido) && mesmaLista(lidas, recebido) ? map : { ...map, camadasDoJogador: lidas }
}

const camposPorLista = new WeakMap<readonly CamadaDoJogador[], CamposDeCamadas>()

/** Os campos de camadas que a tela do jogador entende: a lista dele vira o modelo; o olho e o cadeado já vieram resolvidos do host. */
function camposDoJogador(lista: readonly CamadaDoJogador[] | undefined): CamposDeCamadas {
  if (lista === undefined) return CAMPOS_PADRAO
  const pronto = camposPorLista.get(lista)
  if (pronto !== undefined) return pronto
  const opacidadeDasCamadas: Partial<Record<CamadaId, number>> = {}
  for (const c of lista) if (c.alfa !== undefined) opacidadeDasCamadas[c.id] = c.alfa
  const modeloCamadas: ModeloDeCamadas = { ordem: lista.map((c) => ({ id: c.id })) }
  const campos: CamposDeCamadas = { hiddenLayers: [], lockedLayers: [], versaoDasCamadas: 2, modeloCamadas, opacidadeDasCamadas }
  camposPorLista.set(lista, campos)
  return campos
}

const CAMPOS_PADRAO: CamposDeCamadas = { hiddenLayers: [], lockedLayers: [], versaoDasCamadas: 2, modeloCamadas: MODELO_PADRAO }

/**
 * O contexto de camadas da tela do jogador: `camadaDe` reconhece as livres
 * da lista dele (o modelo do mestre não vem), `alfa` e `ordem` saem da lista.
 * Memorizado pela referência da lista (o patch mantém a mesma quando não muda).
 */
export function contextoDoJogador(map: Pick<MapData, 'camadasDoJogador'>): ContextoDeCamadas {
  return contextoDeCamadas(camposDoJogador(map.camadasDoJogador))
}

/** O modelo que a pilha do jogador segue: a lista dele, ou a padrão. */
export function modeloDoJogador(map: Pick<MapData, 'camadasDoJogador'>): ModeloDeCamadas {
  return camposDoJogador(map.camadasDoJogador).modeloCamadas ?? MODELO_PADRAO
}
