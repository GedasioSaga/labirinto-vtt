import { NOME_DO_SELO_MAX } from '../../../../lib/batalha/combate'
import { Caixa, Escolher, Frase, Numero, Segmentos, Texto, TextoCurto } from './controlesDaPeca'
import type { PropsDaPeca } from './registro'
import { ATRIBUTOS_DAS_PECAS, turnos, type OpcaoDaPeca } from './vocabulario'

const SEM_TESTE = ''
const TESTES: readonly OpcaoDaPeca<string>[] = [{ valor: SEM_TESTE, rotulo: 'sem teste' }, ...ATRIBUTOS_DAS_PECAS]

/**
 * MARCA (D10; `corpoMarca` do protótipo): o acerto deixa uma marca no alvo (sempre, perguntando
 * "Marcar?" com SP e teste, ou só em golpe à distância); o próximo golpe na marca dá N vezes o dano,
 * só do dono ou de qualquer um do grupo, e a marca some ao ser atingida ou no fim dos turnos.
 */
export function PecaMarca({ peca, aoMudar }: PropsDaPeca<'marca'>) {
  return (
    <>
      <Frase>
        <Texto forte>Marca</Texto>
        <Escolher
          rotulo="Quando marca"
          valor={peca.quando}
          opcoes={[
            { valor: 'aoAcertar', rotulo: 'sempre que acertar' },
            { valor: 'pergunta', rotulo: 'ao acertar, pergunta "Marcar?"' },
            { valor: 'tiro', rotulo: 'só em golpe à distância' },
          ]}
          onChange={(quando) => aoMudar({ ...peca, quando })}
        />
        <Texto>com o nome</Texto>
        <TextoCurto rotulo="Nome da marca" valor={peca.nome} maximo={NOME_DO_SELO_MAX} placeholder="Marcado" onChange={(nome) => aoMudar({ ...peca, nome })} />
      </Frase>
      {peca.quando === 'pergunta' && (
        <Frase sub>
          <Texto>Para marcar, paga</Texto>
          <Numero rotulo="SP para marcar" valor={peca.paga} minimo={0} maximo={200} onChange={(paga) => aoMudar({ ...peca, paga })} />
          <Texto>SP e passa num teste de</Texto>
          <Escolher rotulo="Teste para marcar" valor={peca.teste} opcoes={TESTES} onChange={(teste) => aoMudar({ ...peca, teste })} />
        </Frase>
      )}
      <Frase>
        <Texto>O próximo golpe na marca dá</Texto>
        <Numero rotulo="Vezes o dano" valor={peca.vezes} minimo={2} maximo={5} onChange={(vezes) => aoMudar({ ...peca, vezes })} />
        <Texto>vezes o dano; aproveita</Texto>
        <Segmentos
          rotulo="Quem aproveita"
          valor={peca.quem}
          opcoes={[
            { valor: 'dono', rotulo: 'só o dono' },
            { valor: 'todos', rotulo: 'qualquer um do grupo' },
          ]}
          onChange={(quem) => aoMudar({ ...peca, quem })}
        />
      </Frase>
      <Frase>
        <Caixa rotulo="A marca some quando é atingida" marcado={peca.some} onChange={(some) => aoMudar({ ...peca, some })} />
        <Texto>e dura no máximo</Texto>
        <Numero rotulo="Turnos da marca" valor={peca.turnos} minimo={1} maximo={10} onChange={(n) => aoMudar({ ...peca, turnos: n })} />
        <Texto>{turnos(peca.turnos)}</Texto>
      </Frase>
    </>
  )
}
