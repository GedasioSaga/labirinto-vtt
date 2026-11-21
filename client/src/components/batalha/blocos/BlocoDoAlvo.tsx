import { NOME_DO_SELO_MAX } from '../../../lib/batalha/combate'
import { CASAS_MAX, type FormaDoAlvo, type QuemOAlvoPega } from '../../../lib/batalha/mecanica/modelo'
import { ehAjuda, formaNova, ladoValido, motivoDoQuem, trocarQuem } from '../../../lib/batalha/mecanica/modelos'
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
    case 'raio':
      return (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo={forma.tipo === 'linha' ? 'Comprimento' : 'Até'} valor={forma.casas} minimo={1} maximo={CASAS_MAX} depois={forma.tipo === 'linha' ? 'casas' : 'casas de quem usa'} onChange={(casas) => onChange({ ...forma, casas })} />
        </div>
      )
    case 'quadrado':
      return (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Lado" valor={forma.lado} minimo={1} maximo={CASAS_MAX} depois={`casas (${forma.lado}x${forma.lado})`} onChange={(lado) => onChange({ ...forma, lado: ladoValido(lado, forma.centro) })} />
          <Escolha
            legenda="Onde"
            opcoes={[
              { valor: 'frente', rotulo: 'À frente' },
              { valor: 'si', rotulo: 'Em volta de quem usa' },
            ]}
            valor={forma.centro}
            onChange={(centro) => onChange({ ...forma, centro, lado: ladoValido(forma.lado, centro) })}
          />
          {forma.centro === 'si' && <p className="lb-field__hint">Em volta de quem usa, o lado é ímpar: 3x3 pega 1 casa para cada lado.</p>}
        </div>
      )
  }
}

/** O selo de partida do "só vale em quem tem" (a redoma da Florescer). */
const SELO_EXIGIDO_DE_PARTIDA = 'Redoma'

export function BlocoDoAlvo({ mecanica, onChange }: Pick<BlocosProps, 'mecanica' | 'onChange'>) {
  const { alvo } = mecanica
  const exige = alvo.exigeSelo
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
            onChange={(tipo) => onChange({ ...mecanica, alvo: { ...alvo, forma: formaNova(tipo, alvo.forma) } })}
          />
          <ParametrosDaForma forma={alvo.forma} onChange={(forma) => onChange({ ...mecanica, alvo: { ...alvo, forma } })} />
        </>
      )}
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
