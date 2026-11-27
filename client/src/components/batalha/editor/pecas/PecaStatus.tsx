import { ITENS_DO_STATUS_MAX, PECA_DE_PARTIDA, TURNOS_DA_PECA_MAX, type ItemDoStatus } from '../../../../lib/batalha/mecanica/pecas'
import { Escolher, Frase, Mais, Nota, Numero, Segmentos, Texto, Tirar } from './controlesDaPeca'
import type { PropsDaPeca } from './registro'
import { ATRIBUTOS_DAS_PECAS, STATUS_DAS_PECAS, semOItem, trocado, turnos } from './vocabulario'

const ITEM_DE_PARTIDA: ItemDoStatus = PECA_DE_PARTIDA.status.itens[0] ?? { atributo: 'forca', modo: 'fixo', valor: 10, porcento: 50, de: 'determinacao', dura: 'turnos', turnos: 3 }

/** A linha nova do "+ Atributo": a de partida, no primeiro atributo que a peça ainda não muda. */
function itemNovo(itens: readonly ItemDoStatus[]): ItemDoStatus {
  const livre = STATUS_DAS_PECAS.find((opcao) => !itens.some((item) => item.atributo === opcao.valor))
  return { ...ITEM_DE_PARTIDA, atributo: livre?.valor ?? ITEM_DE_PARTIDA.atributo }
}

/** O tempo de uma linha, como o selo o conta (`turnos` só pesa em "alguns turnos"). */
function tempoDaLinha(item: ItemDoStatus): string {
  return item.dura === 'turnos' ? `turnos:${item.turnos}` : item.dura
}

function LinhaDoStatus({ item, podeTirar, aoMudar, aoTirar }: { item: ItemDoStatus; podeTirar: boolean; aoMudar: (item: ItemDoStatus) => void; aoTirar: () => void }) {
  const nome = STATUS_DAS_PECAS.find((opcao) => opcao.valor === item.atributo)?.rotulo ?? item.atributo
  return (
    <li className="lb-pc__item">
      <Escolher rotulo="Atributo" valor={item.atributo} opcoes={STATUS_DAS_PECAS} onChange={(atributo) => aoMudar({ ...item, atributo })} />
      <Segmentos
        rotulo={`${nome}: fixo ou fórmula`}
        valor={item.modo}
        opcoes={[
          { valor: 'fixo', rotulo: 'fixo' },
          { valor: 'formula', rotulo: 'fórmula' },
        ]}
        onChange={(modo) => aoMudar({ ...item, modo })}
      />
      {item.modo === 'fixo' ? (
        <Numero rotulo={`${nome}: quanto`} valor={item.valor} minimo={-200} maximo={200} semZero onChange={(valor) => aoMudar({ ...item, valor })} />
      ) : (
        <>
          <Numero rotulo={`${nome}: porcentagem`} valor={item.porcento} minimo={-200} maximo={200} semZero onChange={(porcento) => aoMudar({ ...item, porcento })} />
          <Texto>% de</Texto>
          <Escolher rotulo={`${nome}: de qual atributo`} valor={item.de} opcoes={ATRIBUTOS_DAS_PECAS} onChange={(de) => aoMudar({ ...item, de })} />
        </>
      )}
      <Texto>por</Texto>
      <Escolher
        rotulo={`${nome}: quanto tempo`}
        valor={item.dura}
        opcoes={[
          { valor: 'turnos', rotulo: 'alguns turnos' },
          { valor: 'batalha', rotulo: 'até o fim da batalha' },
          { valor: 'permanente', rotulo: 'para sempre (grava na ficha)' },
        ]}
        onChange={(dura) => aoMudar({ ...item, dura })}
      />
      {item.dura === 'turnos' && (
        <>
          <Numero rotulo={`${nome}: turnos`} valor={item.turnos} minimo={1} maximo={TURNOS_DA_PECA_MAX} onChange={(n) => aoMudar({ ...item, turnos: n })} />
          <Texto>{turnos(item.turnos)}</Texto>
        </>
      )}
      {podeTirar && <Tirar rotulo={`Tirar ${nome}`} onClick={aoTirar} />}
    </li>
  )
}

/**
 * MUDA ATRIBUTO (mecânica 6; `corpoStatus` do protótipo): soma ou tira atributo do dono, de um aliado ou
 * de todos os aliados, fixo ou por fórmula (uma parte de outro atributo de quem usa, no valor da hora),
 * por alguns turnos, até o fim da batalha ou para sempre. Na batalha vira o selo dos Efeitos.
 */
export function PecaStatus({ peca, mecanica, aoMudar }: PropsDaPeca<'status'>) {
  const { itens } = peca
  // O golpe guarda um selo só em quem usa (modelo.ts, "mais de um selo em quem usa"): num ataque, as
  // linhas no dono precisam do mesmo tempo, senão a técnica inteira fica inválida ao salvar.
  const temposNoDono = peca.quem === 'si' && mecanica.dano !== undefined ? new Set(itens.filter((item) => item.dura !== 'permanente').map(tempoDaLinha)).size : 0
  return (
    <>
      <Frase>
        <Texto forte>Em quem</Texto>
        <Segmentos
          rotulo="Em quem"
          valor={peca.quem}
          opcoes={[
            { valor: 'si', rotulo: 'o dono' },
            { valor: 'aliado', rotulo: 'um aliado' },
            { valor: 'todos', rotulo: 'todos os aliados' },
          ]}
          onChange={(quem) => aoMudar({ ...peca, quem })}
        />
      </Frase>
      <ul className="lb-pc__lista">
        {itens.map((item, indice) => (
          <LinhaDoStatus
            key={indice}
            item={item}
            podeTirar={itens.length > 1}
            aoMudar={(novo) => aoMudar({ ...peca, itens: trocado(itens, indice, novo) })}
            aoTirar={() => aoMudar({ ...peca, itens: semOItem(itens, indice) })}
          />
        ))}
      </ul>
      {itens.length < ITENS_DO_STATUS_MAX && (
        <div>
          <Mais onClick={() => aoMudar({ ...peca, itens: [...itens, itemNovo(itens)] })}>Atributo</Mais>
        </div>
      )}
      {temposNoDono > 1 && <p className="lb-pc__alerta">Num ataque, o que muda no dono precisa ter o mesmo tempo em todas as linhas: o golpe guarda uma condição só em quem usa.</p>}
      <Nota>Fórmula usa o valor da hora: se a Determinação subir na batalha, o bônus sobe junto. Negativo tira.</Nota>
    </>
  )
}
