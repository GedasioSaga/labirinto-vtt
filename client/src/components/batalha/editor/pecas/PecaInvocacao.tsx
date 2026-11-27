import { NOME_CURTO_MAX } from '../../../../lib/batalha/mecanica/pecas'
import { Caixa, Frase, Numero, Texto, TextoCurto } from './controlesDaPeca'
import type { PropsDaPeca } from './registro'

/**
 * INVOCAÇÃO (`corpoInvocacao` do protótipo): chama uma criatura com nome, vida, dano e quantos blocos
 * ocupa, com o limite de quantas ao mesmo tempo, a Concentração (0 = não usa) e a Ultra com carga.
 */
export function PecaInvocacao({ peca, aoMudar }: PropsDaPeca<'invocacao'>) {
  return (
    <>
      <Frase>
        <Texto forte>Chama</Texto>
        <TextoCurto rotulo="Nome da criatura" valor={peca.nome} maximo={NOME_CURTO_MAX} placeholder="Lobo" onChange={(nome) => aoMudar({ ...peca, nome })} />
        <Texto>com</Texto>
        <Numero rotulo="Vida" valor={peca.vida} minimo={1} maximo={999} onChange={(vida) => aoMudar({ ...peca, vida })} />
        <Texto>de vida,</Texto>
        <Numero rotulo="Dano" valor={peca.dano} minimo={0} maximo={300} onChange={(dano) => aoMudar({ ...peca, dano })} />
        <Texto>de dano e</Texto>
        <Numero rotulo="Blocos que ocupa" valor={peca.casas} minimo={1} maximo={4} onChange={(casas) => aoMudar({ ...peca, casas })} />
        <Texto>{peca.casas === 1 ? 'bloco' : 'blocos'}</Texto>
      </Frase>
      <Frase>
        <Texto>No máximo</Texto>
        <Numero rotulo="Quantas ao mesmo tempo" valor={peca.max} minimo={1} maximo={6} onChange={(max) => aoMudar({ ...peca, max })} />
        <Texto>ao mesmo tempo; Concentração</Texto>
        <Numero rotulo="Concentração" valor={peca.concentracao} minimo={0} maximo={5} onChange={(concentracao) => aoMudar({ ...peca, concentracao })} />
        <Texto>× (0 = não usa)</Texto>
        <Caixa rotulo="Tem Ultra" marcado={peca.ultra} onChange={(ultra) => aoMudar({ ...peca, ultra })} />
        {peca.ultra && (
          <>
            <Texto>com carga</Texto>
            <Numero rotulo="Carga da Ultra" valor={peca.carga} minimo={1} maximo={10} onChange={(carga) => aoMudar({ ...peca, carga })} />
          </>
        )}
      </Frase>
    </>
  )
}
