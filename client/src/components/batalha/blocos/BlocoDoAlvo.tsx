import { NOME_DO_SELO_MAX } from '../../../lib/batalha/combate'
import { CASAS_MAX, centroDaArea, type FormaDoAlvo, type QuemOAlvoPega } from '../../../lib/batalha/mecanica/modelo'
import { alvoComForma, ehAjuda, formaNova, ladoValido, motivoDoQuem, trocarQuem } from '../../../lib/batalha/mecanica/modelos'
import { fraseDoAlvo } from '../../../lib/batalha/mecanica/resumo'
import { Bloco, CampoInteiro, Escolha, Marcar, Texto, type BlocosProps } from './controles'

/** O bloco 4 da mecânica: em quem pega, o desenho da área e (fase 5) o selo que o alvo precisa ter. */

const QUEM: readonly { valor: QuemOAlvoPega; rotulo: string }[] = [
  { valor: 'inimigos', rotulo: 'Inimigos' },
  { valor: 'aliados', rotulo: 'Aliados' },
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'escolha', rotulo: 'A escolher' },
  { valor: 'si', rotulo: 'Em quem usa' },
]

const FORMAS: readonly { valor: FormaDoAlvo['tipo']; rotulo: string }[] = [
  { valor: 'um', rotulo: '1 alvo' },
  { valor: 'varios', rotulo: 'Vários' },
  { valor: 'linha', rotulo: 'Linha' },
  { valor: 'quadrado', rotulo: 'Quadrado' },
  { valor: 'raio', rotulo: 'Raio' },
]

function ParametrosDaForma({ forma, onChange }: { forma: FormaDoAlvo; onChange: (forma: FormaDoAlvo) => void }) {
  switch (forma.tipo) {
    case 'um':
      return null
    case 'varios':
      return (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Até" valor={forma.max} minimo={2} maximo={CASAS_MAX} depois="alvos" onChange={(max) => onChange({ ...forma, max })} />
          <Marcar rotulo="Dividir o dano entre eles" marcado={forma.dividirDano === true} onChange={(sim) => onChange(sim ? { ...forma, dividirDano: true } : { tipo: 'varios', max: forma.max })} />
        </div>
      )
    case 'linha':
      return (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Comprimento" valor={forma.casas} minimo={1} maximo={CASAS_MAX} depois="casas" onChange={(casas) => onChange({ ...forma, casas })} />
        </div>
      )
    case 'raio': {
      // Fase 6: em volta de quem usa (como sempre), de um ponto escolhido (a granada) ou de uma ficha escolhida.
      const centro = forma.centro ?? 'si'
      const deQuem = centro === 'ponto' ? 'casas do ponto' : centro === 'alvo' ? 'casas da ficha escolhida' : 'casas de quem usa'
      return (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Até" valor={forma.casas} minimo={1} maximo={CASAS_MAX} depois={deQuem} onChange={(casas) => onChange({ ...forma, casas })} />
          <Escolha
            legenda="Em volta de"
            opcoes={[
              { valor: 'si', rotulo: 'Quem usa' },
              { valor: 'ponto', rotulo: 'Um ponto' },
              { valor: 'alvo', rotulo: 'Uma ficha' },
            ]}
            valor={centro}
            onChange={(novo) => onChange(novo === 'si' ? { tipo: 'raio', casas: forma.casas } : { tipo: 'raio', casas: forma.casas, centro: novo })}
          />
        </div>
      )
    }
    case 'quadrado':
      return (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Lado" valor={forma.lado} minimo={1} maximo={CASAS_MAX} depois={`casas (${forma.lado}x${forma.lado})`} onChange={(lado) => onChange({ ...forma, lado: ladoValido(lado, forma.centro) })} />
          <Escolha
            legenda="Onde"
            opcoes={[
              { valor: 'frente', rotulo: 'À frente' },
              { valor: 'si', rotulo: 'Em volta de quem usa' },
              { valor: 'ponto', rotulo: 'Em volta de um ponto' },
            ]}
            valor={forma.centro}
            onChange={(centro) => onChange({ ...forma, centro, lado: ladoValido(forma.lado, centro) })}
          />
          {forma.centro !== 'frente' && <p className="lb-field__hint">Em volta, o lado é ímpar: 3x3 pega 1 casa para cada lado.</p>}
        </div>
      )
  }
}

/** O selo de partida do "só vale em quem tem" (a redoma da Florescer). */
const SELO_EXIGIDO_DE_PARTIDA = 'Redoma'
/** Fase 6: o alcance de partida ao marcar "Com alcance" (o da Explosão à distância). */
const ALCANCE_DE_PARTIDA = 6

export function BlocoDoAlvo({ mecanica, onChange }: Pick<BlocosProps, 'mecanica' | 'onChange'>) {
  const { alvo } = mecanica
  const exige = alvo.exigeSelo
  // Fase 6: o alcance mede o alvo escolhido ou o centro da área longe.
  const medeAlcance = alvo.forma.tipo === 'um' || alvo.forma.tipo === 'varios' || centroDaArea(alvo.forma) !== null
  const trocarAlcance = (casas: number | null) => {
    const { alcance: _antes, ...sem } = alvo
    onChange({ ...mecanica, alvo: casas === null ? sem : { ...sem, alcance: casas } })
  }
  const trocarExige = (nome: string | null) => {
    const { exigeSelo: _antes, ...sem } = alvo
    onChange({ ...mecanica, alvo: nome === null ? sem : { ...sem, exigeSelo: nome } })
  }
  return (
    <Bloco numero={4} titulo="Em quem pega" frase={`${fraseDoAlvo(mecanica)}${exige === undefined ? '' : ` Só em quem tem ${exige}.`}`} abertoAoMontar>
      <Escolha
        legenda="Pega"
        opcoes={QUEM.map((quem) => ({ ...quem, bloqueio: quem.valor === alvo.quem ? null : motivoDoQuem(mecanica, quem.valor) }))}
        valor={alvo.quem}
        onChange={(quem) => onChange(trocarQuem(mecanica, quem))}
      />
      {alvo.quem !== 'si' && (
        <>
          <Escolha
            legenda="O desenho"
            opcoes={FORMAS}
            valor={alvo.forma.tipo}
            onChange={(tipo) => onChange({ ...mecanica, alvo: alvoComForma(alvo, formaNova(tipo, alvo.forma)) })}
          />
          <ParametrosDaForma forma={alvo.forma} onChange={(forma) => onChange({ ...mecanica, alvo: alvoComForma(alvo, forma) })} />
          {medeAlcance && (
            <>
              {/* Fase 6 (`alvo.alcance`): o host confere pelo mapa; sem marcar, sem limite (como sempre). */}
              <Marcar rotulo={centroDaArea(alvo.forma) === null ? 'Com alcance (o alvo a até N casas)' : 'Com alcance (o centro a até N casas)'} marcado={alvo.alcance !== undefined} onChange={(sim) => trocarAlcance(sim ? ALCANCE_DE_PARTIDA : null)} />
              {alvo.alcance !== undefined && (
                <div className="lb-mec__linha lb-mec__linha--recuo">
                  <CampoInteiro rotulo="Alcance" valor={alvo.alcance} minimo={1} maximo={CASAS_MAX} depois="casas de quem usa" onChange={(casas) => trocarAlcance(casas)} />
                </div>
              )}
            </>
          )}
        </>
      )}
      {alvo.estado === 'caido' && <p className="lb-field__hint">Só em aliado caído (0 de vida): é o reviver.</p>}
      {/* Fase 5 (`alvo.exigeSelo`): só vale em quem já tem o selo; a mira recusa os outros. */}
      <Marcar rotulo={ehAjuda(alvo.quem) ? 'Só em quem já tem um selo' : 'Só contra quem já tem um selo'} marcado={exige !== undefined} onChange={(sim) => trocarExige(sim ? SELO_EXIGIDO_DE_PARTIDA : null)} />
      {exige !== undefined && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <Texto rotulo="O selo" valor={exige} maximo={NOME_DO_SELO_MAX} placeholder="Ex.: Redoma" onChange={(nome) => trocarExige(nome)} />
        </div>
      )}
    </Bloco>
  )
}
