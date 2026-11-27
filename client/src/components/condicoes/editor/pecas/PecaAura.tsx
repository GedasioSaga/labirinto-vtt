import { AURA_DESTA_MESMA, CASAS_DA_AURA_MAX, type PecaDaCondicaoDa } from '../../../../lib/condicoes/modelo'
import { Caixa, Escolher, Frase, Numero, Segmentos, Texto } from '../../../batalha/editor/pecas/controlesDaPeca'
import type { PropsDaPecaDaCondicao } from '../registro'
import './estilo'
import { casas, nomeNoContexto, outrasDoContexto, QUEM_DA_AURA_NA_TELA, type OpcaoDaCondicao } from './vocabulario'

type PecaDaAura = PecaDaCondicaoDa<'aura'>

/** A aura com outra condição: o "passa adiante" só existe quando ela espalha a si mesma. */
function comCondicao(peca: PecaDaAura, cond: string): PecaDaAura {
  const { espalha, ...sem } = peca
  return cond === AURA_DESTA_MESMA && espalha === true ? { ...sem, cond, espalha } : { ...sem, cond }
}

/**
 * AURA (`corpoAura` do protótipo): quem estiver a até N casas de quem tem (os aliados dele, os inimigos ou
 * todos) pega esta mesma condição ou outra do catálogo, enquanto ficar perto. Espalhando a si mesma, quem
 * pegou pode passar adiante. A condição citada vai pelo id (D5).
 */
export function PecaAura({ peca, condicao, contexto, aoMudar }: PropsDaPecaDaCondicao<'aura'>) {
  const outras = outrasDoContexto(contexto, condicao.id).map((outra): OpcaoDaCondicao<string> => ({ valor: outra.id, rotulo: outra.nome }))
  // A citada que saiu do catálogo continua escolhida, com o nome do aviso ("condição apagada"), até o mestre trocar.
  const sumiu = peca.cond !== AURA_DESTA_MESMA && !outras.some((opcao) => opcao.valor === peca.cond)
  const opcoes: readonly OpcaoDaCondicao<string>[] = [
    { valor: AURA_DESTA_MESMA, rotulo: 'esta mesma condição' },
    ...(sumiu ? [{ valor: peca.cond, rotulo: nomeNoContexto(peca.cond, contexto) }] : []),
    ...outras,
  ]
  return (
    <>
      <Frase>
        <Texto>Quem estiver a até</Texto>
        <Numero rotulo="Casas" valor={peca.casas} minimo={1} maximo={CASAS_DA_AURA_MAX} onChange={(n) => aoMudar({ ...peca, casas: n })} />
        <Texto>{`${casas(peca.casas)}:`}</Texto>
        <Segmentos rotulo="Quem pega" valor={peca.quem} opcoes={QUEM_DA_AURA_NA_TELA} onChange={(quem) => aoMudar({ ...peca, quem })} />
      </Frase>
      <Frase>
        <Texto>pega</Texto>
        <Escolher rotulo="Qual condição" valor={peca.cond} opcoes={opcoes} onChange={(cond) => aoMudar(comCondicao(peca, cond))} />
        <Texto>enquanto estiver perto</Texto>
      </Frase>
      {peca.cond === AURA_DESTA_MESMA && (
        <Frase sub>
          <Caixa
            rotulo="E passa adiante (quem pega espalha também)"
            marcado={peca.espalha === true}
            onChange={(ligado) => {
              const { espalha: _antes, ...sem } = peca
              aoMudar(ligado ? { ...sem, espalha: true } : sem)
            }}
          />
        </Frase>
      )}
    </>
  )
}
