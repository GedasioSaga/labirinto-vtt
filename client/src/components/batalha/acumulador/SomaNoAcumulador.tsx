import { useContext, useMemo } from 'react'
import { PASSO_DO_ACUMULADOR_MAX, REGRAS_DO_ACUMULADOR_MAX } from '../../../lib/batalha/requisitos/modelo'
import type { CartaoDaFicha } from '../../../lib/personagem'
import { CampoInteiro, Escolha, Marcar } from '../blocos/controles'
import { acumuladoresNaFicha, comOAcumuladorGravado, comSomaDaTecnica, somaDaTecnica, type AcumuladorNaFicha } from './acumuladoresDaFicha'
import { MexerNaFicha } from './mexerNaFicha'

/** Por que "se acertar" ainda não dá: o motor de hoje sobe o acumulador no acerto de qualquer golpe, sem saber qual técnica acertou. */
const SE_ACERTAR_AINDA_NAO = 'Se acertar ainda não roda: a batalha de hoje não sabe qual técnica acertou (fica para o motor da ED4). Ao usar já vale.'

/**
 * "+N <acumulador>" NOS EFEITOS DA TÉCNICA (ED6, o lugar que a ED5 deixou): a técnica soma N num
 * acumulador da ficha ao ser usada. Grava a regra "usar a técnica X" no acumulador (no cartão que o
 * define), que é o que o motor de hoje roda; por isso precisa da ficha inteira (`MexerNaFicha`) e só
 * aparece para o mestre editando a ficha.
 */
export function SomaNoAcumulador({ cartao }: { cartao: CartaoDaFicha }) {
  const ficha = useContext(MexerNaFicha)
  const lista = useMemo(() => (ficha === null ? [] : acumuladoresNaFicha(ficha.personagem)), [ficha])
  if (ficha === null) return null
  const tecnica = { id: cartao.id, nome: cartao.nome.trim() }
  const somar = (item: AcumuladorNaFicha, quanto: number | null) => {
    const novo = comSomaDaTecnica(item.acumulador, tecnica, quanto)
    if (novo !== null) ficha.mudar(comOAcumuladorGravado(ficha.personagem, item, novo))
  }
  return (
    <div className="lb-acu-soma" role="group" aria-label="Soma num acumulador">
      <p className="lb-mec__legenda">Soma num acumulador</p>
      {lista.length === 0 ? (
        <p className="lb-ed__dica">A ficha não tem acumulador. Crie um em «Acumuladores», no topo da aba Habilidades.</p>
      ) : (
        lista.map((item) => {
          const soma = somaDaTecnica(item.acumulador, tecnica)
          const semEspaco = soma === null && item.acumulador.sobe.length >= REGRAS_DO_ACUMULADOR_MAX
          const bloqueio = tecnica.nome === '' ? 'Dê um nome à técnica primeiro.' : item.deAppNovo ? 'Acumulador de um app mais novo: atualize o app.' : semEspaco ? `${item.acumulador.nome} já tem ${REGRAS_DO_ACUMULADOR_MAX} jeitos de subir.` : null
          return (
            <div key={item.acumulador.id} className="lb-acu-soma__linha">
              <Marcar rotulo={`Soma em ${item.acumulador.nome}`} marcado={soma !== null} bloqueio={bloqueio} onChange={(marcado) => somar(item, marcado ? 1 : null)} />
              {soma !== null && (
                <>
                  <CampoInteiro rotulo="+" valor={soma} minimo={1} maximo={PASSO_DO_ACUMULADOR_MAX} depois={item.acumulador.nome} onChange={(quanto) => somar(item, quanto)} />
                  <Escolha
                    legenda={`Quando soma em ${item.acumulador.nome}`}
                    valor="aoUsar"
                    opcoes={[
                      { valor: 'aoUsar', rotulo: 'ao usar' },
                      { valor: 'seAcertar', rotulo: 'se acertar', bloqueio: SE_ACERTAR_AINDA_NAO },
                    ]}
                    onChange={() => undefined}
                  />
                </>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
