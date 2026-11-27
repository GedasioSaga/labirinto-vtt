import type { ReacaoDaMecanica } from '../../../../lib/batalha/mecanica/modelo'
import { Caixa, Escolher, Frase, Nota, Numero, Texto } from './controlesDaPeca'
import type { PropsDaPeca } from './registro'
import { ATRIBUTOS_DAS_PECAS, type OpcaoDaPeca } from './vocabulario'

/** O "Defender segura" de partida, quando a técnica ainda não tem defesa (o `defende` do protótipo). */
const DEFENDE_DE_PARTIDA = 90
const SEM_SOMA = ''
const SOMAS: readonly OpcaoDaPeca<string>[] = [{ valor: SEM_SOMA, rotulo: 'nada' }, ...ATRIBUTOS_DAS_PECAS]

/**
 * Quanto do golpe a defesa segura, lido da `reacao.defesa` (um lugar só: a peça não guarda cópia).
 * "Fica com X%" = segura 100 − X; anula = 100; nenhuma = 0. A rolagem não vira número: `null`.
 */
function quantoSegura(reacao: ReacaoDaMecanica | undefined): number | null {
  if (reacao === undefined) return DEFENDE_DE_PARTIDA
  switch (reacao.defesa.tipo) {
    case 'fica':
      return 100 - reacao.defesa.porcento
    case 'anula':
      return 100
    case 'nenhuma':
      return 0
    case 'rola':
      return null
  }
}

/** A defesa que segura `segura`% (o resto fica com quem reage). */
function defesaQueSegura(segura: number): ReacaoDaMecanica['defesa'] {
  if (segura >= 100) return { tipo: 'anula' }
  if (segura <= 0) return { tipo: 'nenhuma' }
  return { tipo: 'fica', porcento: 100 - segura }
}

/**
 * DEVOLVE O GOLPE (`corpoDevolve` do protótipo; só no lugar da reação): defende uma parte do golpe
 * (a `reacao.defesa` da mecânica) e devolve o dano recebido ÷ N, mais um atributo, em quem bateu. Com
 * "duas saídas", o jogador escolhe na hora entre defender e devolver.
 */
export function PecaDevolve({ peca, mecanica, aoMudar, aoMudarAMecanica }: PropsDaPeca<'devolve'>) {
  const segura = quantoSegura(mecanica.reacao)
  const gravarDefesa = (novo: number) => {
    const reacao: ReacaoDaMecanica = mecanica.reacao === undefined ? { defesa: defesaQueSegura(novo) } : { ...mecanica.reacao, defesa: defesaQueSegura(novo) }
    aoMudarAMecanica({ ...mecanica, reacao })
  }
  return (
    <>
      <Frase>
        <Caixa rotulo="Duas saídas na hora (o jogador escolhe):" marcado={peca.escolha} onChange={(escolha) => aoMudar({ ...peca, escolha })} />
      </Frase>
      <Frase sub>
        <Texto forte>Defender</Texto>
        {segura === null ? (
          <Texto>rola a defesa como está na linha Reação</Texto>
        ) : (
          <>
            <Texto>segura</Texto>
            <Numero rotulo="Porcentagem defendida" valor={segura} minimo={0} maximo={100} onChange={gravarDefesa} />
            <Texto>% do golpe</Texto>
          </>
        )}
      </Frase>
      <Frase sub>
        <Texto forte>{peca.escolha ? 'ou devolver' : 'E devolve'}</Texto>
        <Texto>o dano recebido ÷</Texto>
        <Numero rotulo="Divide por" valor={peca.divide} minimo={1} maximo={20} onChange={(divide) => aoMudar({ ...peca, divide })} />
        <Texto>mais</Texto>
        <Escolher rotulo="Soma qual atributo" valor={peca.soma} opcoes={SOMAS} onChange={(soma) => aoMudar({ ...peca, soma })} />
        <Texto>em quem bateu</Texto>
      </Frase>
      {mecanica.reacao?.devolve !== undefined && <p className="lb-pc__alerta">A linha Reação também devolve: deixe o devolver só aqui, senão a técnica fica inválida ao salvar.</p>}
      {mecanica.reacao === undefined && <Nota>A defesa mora na Reação da técnica: mudar o número aqui muda lá.</Nota>}
    </>
  )
}
