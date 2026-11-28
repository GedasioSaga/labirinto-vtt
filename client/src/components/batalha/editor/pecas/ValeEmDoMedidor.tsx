import { mesmaReferencia } from '../../../../lib/batalha/requisitos/contexto'
import type { AcumuladorDaFicha, Referencia, ValeEmDoAcumulador } from '../../../../lib/batalha/requisitos/modelo'
import { Campo, Frase, Nota, PorDaLista, Segmentos, Texto, Tirar } from './controlesDaPeca'
import type { OpcaoDaPeca } from './vocabulario'

type OndeVale = ValeEmDoAcumulador['em']

const ONDE_VALE: readonly OpcaoDaPeca<OndeVale>[] = [
  { valor: 'todo', rotulo: 'Todo golpe' },
  { valor: 'tecnicas', rotulo: 'Só estas técnicas' },
  { valor: 'fisicos', rotulo: 'Só físicos' },
  { valor: 'tiros', rotulo: 'Só tiros' },
  { valor: 'dona', rotulo: 'Só a técnica dona' },
]

/**
 * O "VALE EM" do dano do medidor (pedido do dono de 28/11/2026): em que golpes o dano a mais ("Igual em
 * todo nível" e o dos marcos) soma. Padrão: todo golpe (sem `valeEm` gravado). Os atributos valem sempre,
 * porque são da ficha e não do golpe (decisão do Claude). "Só a técnica dona" = o cartão deste medidor.
 */
export function ValeEmDoMedidor({ a, tecnicas, gravar }: { a: AcumuladorDaFicha; tecnicas: readonly Referencia[]; gravar: (a: AcumuladorDaFicha) => void }) {
  const vale: ValeEmDoAcumulador = a.valeEm ?? { em: 'todo' }
  const comVale = (novo: ValeEmDoAcumulador): AcumuladorDaFicha => {
    const { valeEm: _vale, ...sem } = a
    return novo.em === 'todo' ? sem : { ...sem, valeEm: novo }
  }
  // A lista vazia não é gravada (o leitor a recusa): sem técnica nenhuma, volta a valer em todo golpe.
  const comAs = (lista: readonly Referencia[]): AcumuladorDaFicha => comVale(lista.length === 0 ? { em: 'todo' } : { em: 'tecnicas', tecnicas: lista })
  const escolhidas = vale.em === 'tecnicas' ? vale.tecnicas : []
  const livres = tecnicas.filter((tecnica) => !escolhidas.some((ja) => mesmaReferencia(ja, tecnica)))
  const trocar = (em: OndeVale): void => {
    if (em !== 'tecnicas') return gravar(comVale({ em }))
    const primeira = tecnicas[0]
    if (vale.em !== 'tecnicas' && primeira !== undefined) gravar(comAs([primeira]))
  }
  const opcoes = tecnicas.length === 0 && vale.em !== 'tecnicas' ? ONDE_VALE.filter((opcao) => opcao.valor !== 'tecnicas') : ONDE_VALE
  return (
    <Campo rotulo="Vale em">
      <Frase>
        <Texto>O dano a mais soma em</Texto>
        <Segmentos rotulo="O dano a mais soma em" valor={vale.em} opcoes={opcoes} onChange={trocar} />
      </Frase>
      {vale.em === 'tecnicas' && (
        <Frase>
          {vale.tecnicas.map((tecnica, indice) => (
            <span key={tecnica.id ?? tecnica.nome} className="lb-pc__junto">
              <Texto>{tecnica.nome}</Texto>
              <Tirar rotulo={`Tirar ${tecnica.nome} do Vale em`} onClick={() => gravar(comAs(vale.tecnicas.filter((_, outro) => outro !== indice)))} />
            </span>
          ))}
          {livres.length > 0 && (
            <PorDaLista
              rotulo="Mais uma técnica no Vale em"
              opcoes={livres.map((tecnica) => ({ valor: tecnica.id ?? tecnica.nome, rotulo: tecnica.nome }))}
              onPor={(chave) => {
                const tecnica = livres.find((candidata) => (candidata.id ?? candidata.nome) === chave)
                if (tecnica !== undefined) gravar(comAs([...vale.tecnicas, tecnica]))
              }}
            />
          )}
        </Frase>
      )}
      {vale.em !== 'todo' && <Nota>Os atributos dos marcos valem sempre: são da ficha, não do golpe.</Nota>}
    </Campo>
  )
}
