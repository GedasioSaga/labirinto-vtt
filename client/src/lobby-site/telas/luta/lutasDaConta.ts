import type { LutaRecebida } from '../../dados/fioDaLuta'

/**
 * As lutas em andamento que chegam a esta conta, separadas pelo olhar (Arena
 * multijogador F5). O servidor manda pelo mesmo `luta.estado` a luta que a
 * conta joga ou arbitra e a que ela só assiste; a tela trata cada uma de um
 * jeito ("Voltar à luta" e "Voltar a assistir"). As duas ocupam a conta: quem
 * assiste não cria, não aceita nem assiste outra até parar (`contaOcupada` do
 * servidor), e o servidor nunca deixa as duas existirem ao mesmo tempo.
 */
export interface LutasDaConta {
  /** A que a conta joga ou arbitra e que ainda não acabou. */
  minha: LutaRecebida | undefined
  /** A que a conta só assiste e que ainda não acabou. */
  assistida: LutaRecebida | undefined
}

export function lutasDaConta(lutas: readonly LutaRecebida[]): LutasDaConta {
  const andando = lutas.filter((luta) => luta.fim === null)
  return {
    minha: andando.find((luta) => luta.olhar !== 'assistindo'),
    assistida: andando.find((luta) => luta.olhar === 'assistindo'),
  }
}
