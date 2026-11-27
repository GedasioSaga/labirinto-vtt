import { APAGA_MAX } from '../../../../lib/condicoes/modelo'
import { Caixa, Frase, Nota, PorDaLista, Texto, Tirar } from '../../../batalha/editor/pecas/controlesDaPeca'
import { PastilhaDeCondicao } from '../../../PastilhaDeCondicao'
import type { PropsDaPecaDaCondicao } from '../registro'
import './estilo'
import { nomeNoContexto, outrasDoContexto, simboloDaFabricaPeloId } from './vocabulario'

/** O tamanho da pastilha no chip (o `pastilha(o, 22)` do protótipo). */
const PASTILHA_NO_CHIP = 20

/**
 * CONTRA-CONDIÇÃO (`corpoContra` do protótipo): ao entrar, apaga as condições escolhidas; enquanto durar,
 * pode impedir que elas peguem nele. As apagadas vão pelo id (D5). A regra se escreve uma vez, aqui: o
 * cartão de cada apagada diz sozinho "sai se ganhar esta" (`quemApaga`).
 */
export function PecaContra({ peca, condicao, contexto, aoMudar, pastilhaDe = simboloDaFabricaPeloId }: PropsDaPecaDaCondicao<'contra'>) {
  const podePor = outrasDoContexto(contexto, condicao.id)
    .filter((outra) => !peca.apaga.includes(outra.id))
    .map((outra) => ({ valor: outra.id, rotulo: outra.nome }))
  const nomeDaEsta = condicao.nome.trim() === '' ? 'esta' : condicao.nome.trim()
  return (
    <>
      <Frase>
        <Texto forte>Ao entrar, apaga</Texto>
        {peca.apaga.length > 0 ? (
          <ul className="lb-cd-chips">
            {peca.apaga.map((id) => {
              const nome = nomeNoContexto(id, contexto)
              const simbolo = pastilhaDe(id)
              return (
                <li key={id} className="lb-cd-chip">
                  {simbolo === null ? <span className="lb-cd-chip__sem" aria-hidden="true" /> : <PastilhaDeCondicao symbol={simbolo} tamanho={PASTILHA_NO_CHIP} />}
                  {nome}
                  <Tirar rotulo={`Tirar ${nome}`} onClick={() => aoMudar({ ...peca, apaga: peca.apaga.filter((outro) => outro !== id) })} />
                </li>
              )
            })}
          </ul>
        ) : (
          <Texto>nenhuma ainda</Texto>
        )}
        {peca.apaga.length < APAGA_MAX && podePor.length > 0 && <PorDaLista rotulo="Condição" opcoes={podePor} onPor={(id) => aoMudar({ ...peca, apaga: [...peca.apaga, id] })} />}
      </Frase>
      <Frase>
        <Caixa rotulo="Enquanto durar, essas não pegam nele" marcado={peca.impede} onChange={(impede) => aoMudar({ ...peca, impede })} />
      </Frase>
      <Nota>{`O cartão das apagadas mostra sozinho "sai se ganhar ${nomeDaEsta}".`}</Nota>
    </>
  )
}
