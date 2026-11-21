import { CUSTO_MAX, NOME_DO_SELO_MAX } from '../../../lib/batalha/combate'
import { FORMULA_MAX, ITENS_POR_USO_MAX, type AcaoDaMecanica, type Custo, type CustoEmItem, type UsoDaMecanica } from '../../../lib/batalha/mecanica/modelo'
import { trocarUso } from '../../../lib/batalha/mecanica/modelos'
import { fraseDoCusto, frasesDosOutrosCustos } from '../../../lib/batalha/mecanica/resumo'
import { Bloco, CampoInteiro, Escolha, Marcar, Texto, type BlocosProps, type Opcao } from './controles'

/** Os blocos 1 a 3 da mecânica: quando usa, quanto custa (com o item da mochila, fase 5) e que ação gasta. */

const RECURSOS: readonly Opcao<'sp' | 'hp'>[] = [
  { valor: 'sp', rotulo: 'SP' },
  { valor: 'hp', rotulo: 'HP' },
]

type ComoCusta = 'fixo' | 'maximo' | 'atual' | 'formula'

function comoCusta(custo: Custo): ComoCusta {
  if ('porcento' in custo.quanto) return custo.quanto.de
  return 'fixo' in custo.quanto ? 'fixo' : 'formula'
}

/** O item de partida do "gasta da mochila" (o da Medicina). */
const ITEM_DE_PARTIDA: CustoEmItem = { nome: 'Kit Médico', quantos: 1 }

/** Fase 5 (`custoEmItem`): cada uso gasta N do item da mochila; sem sobrar, a técnica fica apagada. */
function CustoNaMochila({ mecanica, onChange }: Pick<BlocosProps, 'mecanica' | 'onChange'>) {
  const item = mecanica.custoEmItem
  const trocar = (novo: CustoEmItem | null) => {
    const { custoEmItem: _antes, ...sem } = mecanica
    onChange(novo === null ? sem : { ...sem, custoEmItem: novo })
  }
  return (
    <>
      <Marcar rotulo="Gasta um item da mochila a cada uso" marcado={item !== undefined} onChange={(sim) => trocar(sim ? ITEM_DE_PARTIDA : null)} />
      {item !== undefined && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Gasta" valor={item.quantos} minimo={1} maximo={ITENS_POR_USO_MAX} onChange={(quantos) => trocar({ ...item, quantos })} />
          {/* O nome novo solta o item do Acervo: ele contava pelo id do item de antes. */}
          <Texto rotulo="Item" valor={item.nome} maximo={NOME_DO_SELO_MAX} placeholder="Ex.: Kit Médico" onChange={(nome) => trocar({ nome, quantos: item.quantos })} />
        </div>
      )}
      {item !== undefined && <p className="lb-field__hint">Conta pelo nome do item na mochila de quem usa. Sem o item, a técnica fica apagada no menu.</p>}
    </>
  )
}

export function BlocoDoCusto({ mecanica, onChange }: Pick<BlocosProps, 'mecanica' | 'onChange'>) {
  const custoDe = (quando: Custo['quando']) => mecanica.custos.find((custo) => custo.quando === quando)
  const trocar = (quando: Custo['quando'], custo: Custo | null) => {
    const outros = mecanica.custos.filter((atual) => atual.quando !== quando)
    // A ordem fixa (ao usar, por vez, depois) deixa a ficha gravada sempre igual.
    const ordem: Custo['quando'][] = ['aoUsar', 'porTurno', 'depois']
    const todos = custo === null ? outros : [...outros, custo]
    onChange({ ...mecanica, custos: todos.sort((a, b) => ordem.indexOf(a.quando) - ordem.indexOf(b.quando)) })
  }
  const aoUsar = custoDe('aoUsar')
  const porTurno = custoDe('porTurno')
  const depois = custoDe('depois')
  const como = aoUsar === undefined ? null : comoCusta(aoUsar)
  const trocarComo = (novo: ComoCusta) => {
    if (aoUsar === undefined) return
    const quanto: Custo['quanto'] = novo === 'fixo' ? { fixo: 30 } : novo === 'formula' ? { formula: '' } : { porcento: 10, de: novo }
    trocar('aoUsar', { ...aoUsar, quanto })
  }
  const doItem = mecanica.custoEmItem === undefined ? [] : [`Gasta ${mecanica.custoEmItem.quantos} ${mecanica.custoEmItem.nome}.`]
  return (
    <Bloco numero={2} titulo="Quanto custa" frase={[fraseDoCusto(mecanica), ...frasesDosOutrosCustos(mecanica), ...doItem].join(' ')} abertoAoMontar>
      <Escolha
        legenda="Ao usar, gasta"
        opcoes={[{ valor: 'nada' as const, rotulo: 'Nada' }, ...RECURSOS]}
        valor={aoUsar?.recurso ?? 'nada'}
        onChange={(recurso) => trocar('aoUsar', recurso === 'nada' ? null : { recurso, quanto: aoUsar?.quanto ?? { fixo: 30 }, quando: 'aoUsar' })}
      />
      {aoUsar !== undefined && como !== null && (
        <div className="lb-mec__linha">
          <Escolha
            legenda="Como conta"
            opcoes={[
              { valor: 'fixo', rotulo: 'Número' },
              { valor: 'maximo', rotulo: '% do máximo' },
              { valor: 'atual', rotulo: '% do atual' },
              { valor: 'formula', rotulo: 'Fórmula' },
            ]}
            valor={como}
            onChange={trocarComo}
          />
          {'fixo' in aoUsar.quanto && <CampoInteiro rotulo="Quanto" valor={aoUsar.quanto.fixo} minimo={0} maximo={CUSTO_MAX} depois={aoUsar.recurso.toUpperCase()} onChange={(fixo) => trocar('aoUsar', { ...aoUsar, quanto: { fixo } })} />}
          {'porcento' in aoUsar.quanto && (
            <CampoInteiro rotulo="Porcentagem" valor={aoUsar.quanto.porcento} minimo={1} maximo={100} depois="%" onChange={(porcento) => 'porcento' in aoUsar.quanto && trocar('aoUsar', { ...aoUsar, quanto: { ...aoUsar.quanto, porcento } })} />
          )}
          {'formula' in aoUsar.quanto && <Texto rotulo="Fórmula" valor={aoUsar.quanto.formula} maximo={FORMULA_MAX} placeholder="Ex.: Espírito + 10" onChange={(formula) => trocar('aoUsar', { ...aoUsar, quanto: { formula } })} />}
        </div>
      )}
      <Marcar rotulo="Técnica mantida: cobra a cada vez (o mestre aplica ou pula)" marcado={porTurno !== undefined} onChange={(sim) => trocar('porTurno', sim ? { recurso: 'sp', quanto: { fixo: 10 }, quando: 'porTurno' } : null)} />
      {porTurno !== undefined && 'fixo' in porTurno.quanto && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <Escolha legenda="Recurso" opcoes={RECURSOS} valor={porTurno.recurso} onChange={(recurso) => trocar('porTurno', { ...porTurno, recurso })} />
          <CampoInteiro rotulo="A cada vez" valor={porTurno.quanto.fixo} minimo={0} maximo={CUSTO_MAX} depois={porTurno.recurso.toUpperCase()} onChange={(fixo) => trocar('porTurno', { ...porTurno, quanto: { fixo } })} />
        </div>
      )}
      <Marcar rotulo="Depois de usar, perde HP (sem bloquear o uso)" marcado={depois !== undefined} onChange={(sim) => trocar('depois', sim ? { recurso: 'hp', quanto: { fixo: 100 }, quando: 'depois' } : null)} />
      {depois !== undefined && 'fixo' in depois.quanto && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Perde" valor={depois.quanto.fixo} minimo={0} maximo={CUSTO_MAX} depois="HP" onChange={(fixo) => trocar('depois', { ...depois, quanto: { fixo } })} />
        </div>
      )}
      <CustoNaMochila mecanica={mecanica} onChange={onChange} />
    </Bloco>
  )
}

export const ACOES: readonly Opcao<AcaoDaMecanica>[] = [
  { valor: 'simples', rotulo: 'Simples' },
  { valor: 'bonus', rotulo: 'Bônus' },
  { valor: 'completa', rotulo: 'Completa' },
  { valor: 'livre', rotulo: 'Livre' },
  { valor: 'perguntar', rotulo: 'Perguntar na hora' },
]

export function BlocoDaAcao({ mecanica, onChange }: Pick<BlocosProps, 'mecanica' | 'onChange'>) {
  const frase = mecanica.acao === 'perguntar' ? 'Quem usa escolhe na hora.' : `Gasta ${ACOES.find((acao) => acao.valor === mecanica.acao)?.rotulo ?? ''}.`
  return (
    <Bloco numero={3} titulo="Que ação gasta" frase={frase} abertoAoMontar>
      <Escolha legenda="A ação" opcoes={ACOES} valor={mecanica.acao} onChange={(acao) => onChange({ ...mecanica, acao })} />
    </Bloco>
  )
}

const USOS: readonly Opcao<UsoDaMecanica>[] = [
  { valor: 'ativa', rotulo: 'Na vez' },
  { valor: 'reacao', rotulo: 'No lugar da reação' },
  { valor: 'ativaOuReacao', rotulo: 'Os dois' },
]

const FRASE_DO_USO: Record<UsoDaMecanica, string> = {
  ativa: 'Na vez, como qualquer técnica.',
  reacao: 'No lugar da reação, antes do d20.',
  ativaOuReacao: 'Na vez ou no lugar da reação.',
}

export function BlocoDoUso({ mecanica, onChange }: Pick<BlocosProps, 'mecanica' | 'onChange'>) {
  const uso = mecanica.uso ?? 'ativa'
  return (
    <Bloco numero={1} titulo="Quando usa" frase={FRASE_DO_USO[uso]} abertoAoMontar={uso !== 'ativa'}>
      <Escolha legenda="Quando usa" opcoes={USOS} valor={uso} onChange={(novo) => onChange(trocarUso(mecanica, novo))} />
      <p className="lb-field__hint">No lugar da reação: aparece na caixa REAÇÃO de quem leva o golpe, antes de rolar o d20. Uma por golpe; não gasta a ação da vez.</p>
    </Bloco>
  )
}
