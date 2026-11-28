import { pedidoDaMarca, type ComoPagaAMarca } from '../../../../lib/batalha/comoMarca'
import { Escolher, Frase, Numero, Segmentos, Texto } from './controlesDaPeca'
import { ATRIBUTOS_DAS_PECAS, type OpcaoDaPeca } from './vocabulario'

const SEM_TESTE = ''
const TESTES: readonly OpcaoDaPeca<string>[] = [{ valor: SEM_TESTE, rotulo: 'sem teste' }, ...ATRIBUTOS_DAS_PECAS]
/** 'e' = paga E passa no teste; 'ou' = um dos dois (`lib/batalha/comoMarca.ts`). */
const PAGA_E_OU: readonly OpcaoDaPeca<ComoPagaAMarca>[] = [
  { valor: 'e', rotulo: 'e' },
  { valor: 'ou', rotulo: 'ou' },
]

/** A CD do teste, onde a batalha rola sozinha (o "Anula o dano"); a Marca não tem (o teste dela é da mesa). */
export interface CdDoPagaETesta {
  valor: number
  minimo: number
  maximo: number
  rotulo: string
  aoMudar: (cd: number) => void
}

export interface PropsDoPagaETesta {
  /** O começo da frase: "Para marcar, paga", "Para anular, paga". */
  comeco: string
  /** Os nomes acessíveis do SP, do e/ou e do teste ("SP para marcar", "Paga e/ou testa", "Teste para marcar"). */
  rotulos: { paga: string; como: string; teste: string }
  paga: number
  pagaMax: number
  /** O atributo do teste ('' = sem teste). */
  teste: string
  como: ComoPagaAMarca | undefined
  /** Ausente = a frase não mostra CD. */
  cd?: CdDoPagaETesta
  aoPagar: (paga: number) => void
  aoTestar: (teste: string) => void
  aoEscolherComo: (como: ComoPagaAMarca) => void
}

/**
 * PAGA E/OU TESTA (pedido de 27/11/2026, "e/ou"): a frase "paga N SP e/ou passa num teste de X" que a Marca e o
 * "Anula o dano" usam igual; o que ela quer dizer é o `pedidoDaMarca` (`lib/batalha/comoMarca.ts`). Com o SP e
 * o teste, o seletor e/ou; com um dos dois vazio, a frase diz qual vale.
 */
export function PagaETesta({ comeco, rotulos, paga, pagaMax, teste, como, cd, aoPagar, aoTestar, aoEscolherComo }: PropsDoPagaETesta) {
  const pedido = pedidoDaMarca(paga, teste, como)
  return (
    <Frase sub>
      <Texto>{comeco}</Texto>
      <Numero rotulo={rotulos.paga} valor={paga} minimo={0} maximo={pagaMax} onChange={aoPagar} />
      <Texto>SP</Texto>
      {pedido === 'e' || pedido === 'ou' ? (
        <Segmentos rotulo={rotulos.como} valor={pedido} opcoes={PAGA_E_OU} onChange={aoEscolherComo} />
      ) : (
        <Texto>{pedido === 'soPaga' ? '(só paga) · teste:' : pedido === 'soTeste' ? '(só o teste) e' : '·'}</Texto>
      )}
      {pedido !== 'soPaga' && <Texto>passa num teste de</Texto>}
      <Escolher rotulo={rotulos.teste} valor={teste} opcoes={TESTES} onChange={aoTestar} />
      {cd !== undefined && teste !== SEM_TESTE && (
        <>
          <Texto>CD</Texto>
          <Numero rotulo={cd.rotulo} valor={cd.valor} minimo={cd.minimo} maximo={cd.maximo} onChange={cd.aoMudar} />
        </>
      )}
    </Frase>
  )
}
