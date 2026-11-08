import { compararCaminhos, juntar, soNaNuvem, type LeitorDoCofre } from './cofre'

/**
 * O INVENTÁRIO DO COFRE (plano §4, passo 2): cada arquivo numa lista, com o
 * tamanho. Só lista e pergunta o tamanho; o conteúdo não é aberto aqui, então
 * um arquivo que está só na nuvem do OneDrive não é baixado.
 */

export type EstadoNoDisco =
  /** Está no disco: pode ser lido. */
  | 'local'
  /** Só na nuvem do OneDrive: não é lido, e vira falha na lista. */
  | 'soNaNuvem'
  /** Link simbólico ou junção: não é seguido nem lido, e vira falha na lista. */
  | 'atalho'
  /** Não deu nem para saber o tamanho. */
  | 'semInfo'

export interface ArquivoInventariado {
  readonly caminho: string
  readonly bytes: number
  readonly estado: EstadoNoDisco
  /** Por que não deu para saber o tamanho (`semInfo`). */
  readonly motivo?: string
}

export interface PastaIlegivel {
  readonly caminho: string
  readonly motivo: string
}

export interface Inventario {
  /** Em ordem fixa de caminho. */
  readonly arquivos: readonly ArquivoInventariado[]
  /** Pastas que não deu para listar: o que há dentro delas ficou fora da lista. */
  readonly pastasIlegiveis: readonly PastaIlegivel[]
}

function motivoDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

async function inventariarArquivo(leitor: LeitorDoCofre, caminho: string): Promise<ArquivoInventariado> {
  try {
    const { bytes, atributos } = await leitor.info(caminho)
    return { caminho, bytes, estado: soNaNuvem(atributos) ? 'soNaNuvem' : 'local' }
  } catch (erro) {
    return { caminho, bytes: 0, estado: 'semInfo', motivo: motivoDe(erro) }
  }
}

/** Anda o cofre inteiro, inclusive as pastas com ponto (a `.lixeira` também é importada). */
export async function inventariar(leitor: LeitorDoCofre): Promise<Inventario> {
  const arquivos: ArquivoInventariado[] = []
  const pastasIlegiveis: PastaIlegivel[] = []
  const pendentes: string[] = ['']
  for (let pasta = pendentes.pop(); pasta !== undefined; pasta = pendentes.pop()) {
    let entradas
    try {
      entradas = await leitor.listar(pasta)
    } catch (erro) {
      pastasIlegiveis.push({ caminho: pasta, motivo: motivoDe(erro) })
      continue
    }
    const daPasta: string[] = []
    for (const entrada of entradas) {
      const caminho = juntar(pasta, entrada.nome)
      if (entrada.tipo === 'pasta') pendentes.push(caminho)
      else if (entrada.tipo === 'atalho') arquivos.push({ caminho, bytes: 0, estado: 'atalho' })
      else daPasta.push(caminho)
    }
    arquivos.push(...(await Promise.all(daPasta.map((caminho) => inventariarArquivo(leitor, caminho)))))
  }
  arquivos.sort((a, b) => compararCaminhos(a.caminho, b.caminho))
  pastasIlegiveis.sort((a, b) => compararCaminhos(a.caminho, b.caminho))
  return { arquivos, pastasIlegiveis }
}
