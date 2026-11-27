import { NOME_DO_SELO_MAX } from '../../../../lib/batalha/combate'
import { TURNOS_DA_PECA_MAX, type PecaDiminui as Diminui } from '../../../../lib/batalha/mecanica/pecas'
import { Caixa, Campo, Escolher, Frase, Nota, Numero, Segmentos, Texto, TextoCurto } from './controlesDaPeca'
import type { PropsDaPeca } from './registro'
import { STATUS_DAS_PECAS, turnos, type OpcaoDaPeca } from './vocabulario'

const VOLTA_NO_FIM_DOS_TURNOS: readonly OpcaoDaPeca<Diminui['volta']>[] = [
  { valor: 'turnos', rotulo: 'quando acabam os turnos' },
  { valor: 'batalha', rotulo: 'no fim da batalha' },
  { valor: 'curar', rotulo: 'quando tirarem a condição' },
]
const VOLTA_DEPOIS_DE_TURNOS: readonly OpcaoDaPeca<Diminui['volta']>[] = [
  { valor: 'turnos', rotulo: 'depois de alguns turnos' },
  { valor: 'batalha', rotulo: 'no fim da batalha' },
  { valor: 'curar', rotulo: 'quando tirarem a condição' },
]

function Teto({ peca, aoMudar }: { peca: Diminui; aoMudar: (peca: Diminui) => void }) {
  return (
    <>
      <Caixa rotulo="e para em" marcado={peca.teto} onChange={(teto) => aoMudar({ ...peca, teto })} />
      {peca.teto ? (
        <>
          <Numero rotulo="Teto da perda" valor={peca.tetoValor} minimo={1} maximo={500} onChange={(tetoValor) => aoMudar({ ...peca, tetoValor })} />
          <Texto>{peca.modo === 'porcento' ? '% no total' : 'no total'}</Texto>
        </>
      ) : (
        <Texto>um teto (opcional)</Texto>
      )}
    </>
  )
}

/**
 * DIMINUI ATRIBUTO DO ALVO (mecânica 8, D10; `corpoDiminui` do protótipo): ao acertar, o alvo perde
 * pontos ou % de um atributo de uma vez, a cada turno (somando, com teto opcional) ou a partir de um
 * turno, e volta ao normal no fim dos turnos, da batalha ou quando tirarem a condição. Golpe novo no
 * mesmo alvo recomeça a contagem, sem somar por cima.
 */
export function PecaDiminui({ peca, aoMudar }: PropsDaPeca<'diminui'>) {
  const unidade = peca.modo === 'porcento' ? '%' : ''
  const nomeDoAtributo = STATUS_DAS_PECAS.find((opcao) => opcao.valor === peca.atributo)?.rotulo ?? peca.atributo
  return (
    <>
      <Frase>
        <Texto forte>Ao acertar, o alvo perde</Texto>
        <Numero rotulo="Quanto perde" valor={peca.valor} minimo={1} maximo={500} onChange={(valor) => aoMudar({ ...peca, valor })} />
        <Segmentos
          rotulo="Pontos ou porcentagem"
          valor={peca.modo}
          opcoes={[
            { valor: 'fixo', rotulo: 'pontos' },
            { valor: 'porcento', rotulo: '%' },
          ]}
          onChange={(modo) => aoMudar({ ...peca, modo })}
        />
        <Texto>de</Texto>
        <Escolher rotulo="Qual atributo ou status" valor={peca.atributo} opcoes={STATUS_DAS_PECAS} onChange={(atributo) => aoMudar({ ...peca, atributo })} />
      </Frase>
      <Campo rotulo="Ritmo">
        <Segmentos
          rotulo="Ritmo da perda"
          valor={peca.ritmo}
          opcoes={[
            { valor: 'umaVez', rotulo: 'de uma vez' },
            { valor: 'cadaTurno', rotulo: 'a cada turno' },
            { valor: 'depois', rotulo: 'depois de X turnos' },
          ]}
          onChange={(ritmo) => aoMudar({ ...peca, ritmo })}
        />
      </Campo>
      {peca.ritmo === 'umaVez' && (
        <Frase sub>
          <Texto>Perde tudo no golpe e fica assim por</Texto>
          <Numero rotulo="Por quantos turnos" valor={peca.dura} minimo={1} maximo={TURNOS_DA_PECA_MAX} onChange={(dura) => aoMudar({ ...peca, dura })} />
          <Texto>{`${turnos(peca.dura)}.`}</Texto>
        </Frase>
      )}
      {peca.ritmo === 'cadaTurno' && (
        <Frase sub>
          <Texto>Perde de novo no começo de cada vez do alvo, somando,</Texto>
          <Teto peca={peca} aoMudar={aoMudar} />
        </Frase>
      )}
      {peca.ritmo === 'depois' && (
        <Frase sub>
          <Texto forte>Depois de</Texto>
          <Numero rotulo="Depois de quantos turnos" valor={peca.depoisDe} minimo={1} maximo={TURNOS_DA_PECA_MAX} onChange={(depoisDe) => aoMudar({ ...peca, depoisDe })} />
          <Texto>{turnos(peca.depoisDe)}</Texto>
          <Escolher
            rotulo="Quantas vezes"
            valor={peca.depoisVezes}
            opcoes={[
              { valor: 'uma', rotulo: 'uma vez' },
              { valor: 'cada', rotulo: 'a cada turno' },
            ]}
            onChange={(depoisVezes) => aoMudar({ ...peca, depoisVezes })}
          />
          <span className="lb-pc__seta" aria-hidden="true">
            →
          </span>
          <Texto>{`perde ${peca.valor}${unidade} de ${nomeDoAtributo}`}</Texto>
          {peca.depoisVezes === 'cada' && <Teto peca={peca} aoMudar={aoMudar} />}
        </Frase>
      )}
      <Frase>
        <Texto forte>Volta ao normal</Texto>
        <Escolher rotulo="Quando volta ao normal" valor={peca.volta} opcoes={peca.ritmo === 'umaVez' ? VOLTA_NO_FIM_DOS_TURNOS : VOLTA_DEPOIS_DE_TURNOS} onChange={(volta) => aoMudar({ ...peca, volta })} />
        {peca.volta === 'turnos' && peca.ritmo !== 'umaVez' && (
          <>
            <Numero rotulo="Volta depois de quantos turnos" valor={peca.voltaEm} minimo={1} maximo={TURNOS_DA_PECA_MAX} onChange={(voltaEm) => aoMudar({ ...peca, voltaEm })} />
            <Texto>{`${turnos(peca.voltaEm)} depois do golpe`}</Texto>
          </>
        )}
      </Frase>
      <Frase>
        <Texto>No alvo aparece como a condição</Texto>
        <TextoCurto rotulo="Nome da condição no alvo" valor={peca.nome} maximo={NOME_DO_SELO_MAX} placeholder="Lento" onChange={(nome) => aoMudar({ ...peca, nome })} />
      </Frase>
      <Nota>Golpe novo no mesmo alvo recomeça a contagem; não soma por cima.</Nota>
    </>
  )
}
