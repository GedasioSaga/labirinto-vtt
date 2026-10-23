/**
 * CAMADAS NO ARQUIVO (`map.json` e `adventure.json`). Todo campo é novo e
 * opcional: ausente continua ausente (o round-trip do mapa de antes não ganha
 * chave) e valor torto é DESCARTADO, nunca recusa o mapa. O modelo de
 * camadas mora na aventura; o mapa só guarda o estado da cena.
 */
import type { CamadaDef, CamadaId, MapData, ModeloDeCamadas, NaCamada } from '../../types/map'
import { ehCamadaId, ehCamadaPadrao } from './padrao'

/** Teto do nome de camada livre, em caracteres (o painel mostra uma linha). */
export const NOME_DE_CAMADA_MAX = 40

/**
 * Lista de ids de camada: o que não é id sai, repetido sai; o que não é lista
 * vira ausente. FALHA FECHADA: lista com itens em que nenhum id sobrou também
 * vira ausente — para `ocultasDoJogador`, ausente segue `hiddenLayers`, e uma
 * lista vazia diria "o jogador vê tudo". Lista vazia no arquivo continua vazia.
 */
export function lerListaDeCamadas(valor: unknown): CamadaId[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const lista: CamadaId[] = []
  for (const item of valor) if (ehCamadaId(item) && !lista.includes(item)) lista.push(item)
  return valor.length > 0 && lista.length === 0 ? undefined : lista
}

/** Nome de camada: texto aparado, no teto (contado em caracteres, sem partir emoji); outro tipo ou em branco = undefined. */
export function lerNomeDeCamada(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined
  const nome = Array.from(valor.trim()).slice(0, NOME_DE_CAMADA_MAX).join('').trimEnd()
  return nome === '' ? undefined : nome
}

/** Opacidade por camada: só número de 0 a 1 em chave de camada; o que não é objeto vira ausente. */
export function lerOpacidades(valor: unknown): Partial<Record<CamadaId, number>> | undefined {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return undefined
  const entradas: [string, unknown][] = Object.entries(valor)
  const opacidades: Partial<Record<CamadaId, number>> = {}
  for (const [chave, bruto] of entradas) {
    if (ehCamadaId(chave) && typeof bruto === 'number' && Number.isFinite(bruto) && bruto >= 0 && bruto <= 1) opacidades[chave] = bruto
  }
  return opacidades
}

/** Só a versão 2 existe; o resto é mapa de antes. */
export function lerVersaoDasCamadas(valor: unknown): 2 | undefined {
  return valor === 2 ? 2 : undefined
}

export function ocultasDoJogadorDoArquivo(valor: unknown): Pick<MapData, 'ocultasDoJogador'> {
  const ocultasDoJogador = lerListaDeCamadas(valor)
  return ocultasDoJogador === undefined ? {} : { ocultasDoJogador }
}

export function opacidadesDoArquivo(valor: unknown): Pick<MapData, 'opacidadeDasCamadas'> {
  const opacidadeDasCamadas = lerOpacidades(valor)
  return opacidadeDasCamadas === undefined ? {} : { opacidadeDasCamadas }
}

export function versaoDasCamadasDoArquivo(valor: unknown): Pick<MapData, 'versaoDasCamadas'> {
  const versaoDasCamadas = lerVersaoDasCamadas(valor)
  return versaoDasCamadas === undefined ? {} : { versaoDasCamadas }
}

/**
 * Entidade lida do disco: `camada` que não é id de camada perde a CHAVE (o
 * item volta à camada padrão do tipo e o valor cru não volta ao disco nem vai
 * ao jogador). Ausente ou id válido devolve o MESMO objeto: mapa de antes não
 * ganha chave nem muda a ordem das chaves.
 */
export function semCamadaTorta<T extends NaCamada>(item: T): T {
  if (!('camada' in item) || ehCamadaId(item.camada)) return item
  const copia = { ...item }
  delete copia.camada
  return copia
}

/** O campo `camada` de um objeto cru do arquivo: só id de camada entra. */
export function camadaLida(valor: object): NaCamada {
  const camada: unknown = 'camada' in valor ? valor.camada : undefined
  return ehCamadaId(camada) ? { camada } : {}
}

/**
 * O modelo da aventura: entrada sem id válido ou repetida sai; `nome` só
 * texto, aparado e no teto. Camada livre com nome em branco (depois de
 * aparar) sai inteira; camada padrão fica, só sem o nome. Forma errada vira
 * ausente, e `ordem` com itens em que nenhuma entrada sobrou também.
 */
export function lerModeloDeCamadas(valor: unknown): ModeloDeCamadas | undefined {
  if (typeof valor !== 'object' || valor === null || !('ordem' in valor) || !Array.isArray(valor.ordem)) return undefined
  const ordem: CamadaDef[] = []
  const vistos = new Set<string>()
  for (const item of valor.ordem) {
    if (typeof item !== 'object' || item === null || !('id' in item)) continue
    const id: unknown = item.id
    if (!ehCamadaId(id) || vistos.has(id)) continue
    const cru: unknown = 'nome' in item ? item.nome : undefined
    const nome = lerNomeDeCamada(cru)
    if (nome === undefined && typeof cru === 'string' && !ehCamadaPadrao(id)) continue
    vistos.add(id)
    ordem.push(nome === undefined ? { id } : { id, nome })
  }
  return valor.ordem.length > 0 && ordem.length === 0 ? undefined : { ordem }
}
