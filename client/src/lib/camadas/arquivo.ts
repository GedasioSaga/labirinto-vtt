/**
 * CAMADAS NO ARQUIVO (`map.json` e `adventure.json`). Todo campo é novo e
 * opcional: ausente continua ausente (o round-trip do mapa de antes não ganha
 * chave) e valor torto é DESCARTADO, nunca recusa o mapa. O modelo de
 * camadas mora na aventura; o mapa só guarda o estado da cena.
 */
import type { CamadaDef, CamadaId, MapData, ModeloDeCamadas, NaCamada } from '../../types/map'
import { ehCamadaId } from './padrao'

/** Lista de ids de camada: o que não é id sai, repetido sai; o que não é lista vira ausente. */
export function lerListaDeCamadas(valor: unknown): CamadaId[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const lista: CamadaId[] = []
  for (const item of valor) if (ehCamadaId(item) && !lista.includes(item)) lista.push(item)
  return lista
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

/** O campo `camada` de um objeto cru do arquivo: só id de camada entra. */
export function camadaLida(valor: object): NaCamada {
  const camada: unknown = 'camada' in valor ? valor.camada : undefined
  return ehCamadaId(camada) ? { camada } : {}
}

/** O modelo da aventura: entrada sem id válido ou repetida sai; `nome` só texto. Forma errada vira ausente. */
export function lerModeloDeCamadas(valor: unknown): ModeloDeCamadas | undefined {
  if (typeof valor !== 'object' || valor === null || !('ordem' in valor) || !Array.isArray(valor.ordem)) return undefined
  const ordem: CamadaDef[] = []
  const vistos = new Set<string>()
  for (const item of valor.ordem) {
    if (typeof item !== 'object' || item === null || !('id' in item)) continue
    const id: unknown = item.id
    if (!ehCamadaId(id) || vistos.has(id)) continue
    vistos.add(id)
    const nome: unknown = 'nome' in item ? item.nome : undefined
    ordem.push(typeof nome === 'string' ? { id, nome } : { id })
  }
  return { ordem }
}
