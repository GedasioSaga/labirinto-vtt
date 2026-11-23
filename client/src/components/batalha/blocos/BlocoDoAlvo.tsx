import { alcanceDaMecanica } from '../../../lib/batalha/alcanceDoCartao'
import { corDoAlcance } from '../../../lib/batalha/alcance/cor'
import { descreverAlcance } from '../../../lib/batalha/alcance/forma'
import { NOME_DO_SELO_MAX } from '../../../lib/batalha/combate'
import { CASAS_MAX, type AlvoDaMecanica, type QuemOAlvoPega } from '../../../lib/batalha/mecanica/modelo'
import { alvoComForma, ehAjuda, formaNova, ladoValido, motivoDoQuem, trocarQuem } from '../../../lib/batalha/mecanica/modelos'
import { fraseDoAlvo } from '../../../lib/batalha/mecanica/resumo'
import { EscolhaDaForma } from '../alcance/EscolhaDaForma'
import { ANEL_MINIMO, FORMAS_NA_TELA, alvoNaForma, formaNaTelaDoAlvo } from '../alcance/formaNaTela'
import { Bloco, CampoInteiro, Escolha, Marcar, Texto, type BlocosProps } from './controles'

/**
 * O bloco 4 da mecânica: em quem pega, a forma do alcance (fase F do alcance, ALCANCE.md §8: os
 * 7 desenhos do protótipo mais a área num ponto e numa ficha, o número em toda forma) e (fase 5)
 * o selo que o alvo precisa ter.
 */

/** Por que a arma montada não pega em aliado nem em quem usa: o Atacar com ela vai em inimigo. */
const ARMA_SO_EM_INIMIGO = 'Na arma, o Atacar vai em inimigo'

const QUEM: readonly { valor: QuemOAlvoPega; rotulo: string }[] = [
  { valor: 'inimigos', rotulo: 'Inimigos' },
  { valor: 'aliados', rotulo: 'Aliados' },
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'escolha', rotulo: 'A escolher' },
  { valor: 'si', rotulo: 'Em quem usa' },
]

type Mudar = (alvo: AlvoDaMecanica) => void

/** Fase 6: o alcance de partida ao desmarcar "Sem limite" (o da Explosão à distância). */
const ALCANCE_DE_PARTIDA = 6

/** O alvo escolhido um a um: 1 alvo ou vários (e o "dividir o dano"). */
function QuantosAlvos({ alvo, onChange }: { alvo: AlvoDaMecanica; onChange: Mudar }) {
  const { forma } = alvo
  if (forma.tipo !== 'um' && forma.tipo !== 'varios') return null
  return (
    <>
      <Escolha
        legenda="Quantos"
        opcoes={[
          { valor: 'um', rotulo: '1 alvo' },
          { valor: 'varios', rotulo: 'Vários' },
        ]}
        valor={forma.tipo}
        onChange={(tipo) => onChange(alvoComForma(alvo, formaNova(tipo, forma)))}
      />
      {forma.tipo === 'varios' && (
        <>
          <CampoInteiro rotulo="Até" valor={forma.max} minimo={2} maximo={CASAS_MAX} depois="alvos" onChange={(max) => onChange(alvoComForma(alvo, { ...forma, max }))} />
          <Marcar rotulo="Dividir o dano entre eles" marcado={forma.dividirDano === true} onChange={(sim) => onChange(alvoComForma(alvo, sim ? { ...forma, dividirDano: true } : { tipo: 'varios', max: forma.max }))} />
        </>
      )}
    </>
  )
}

/** O alcance do alvo escolhido ou do centro da área longe; sem marcar = sem limite (a mesa não confere, como antes). */
function AteQuantasCasas({ alvo, rotulo, onChange }: { alvo: AlvoDaMecanica; rotulo: string; onChange: Mudar }) {
  const trocar = (casas: number | null) => {
    const { alcance: _antes, alcanceMinimo: _minimo, ...sem } = alvo
    onChange(casas === null ? sem : { ...sem, alcance: casas })
  }
  return (
    <>
      {alvo.alcance !== undefined && <CampoInteiro rotulo={rotulo} valor={alvo.alcance} minimo={1} maximo={CASAS_MAX} depois="casas de quem usa" onChange={(casas) => trocar(casas)} />}
      <Marcar rotulo="Sem limite de distância" marcado={alvo.alcance === undefined} onChange={(sim) => trocar(sim ? null : ALCANCE_DE_PARTIDA)} />
    </>
  )
}

function NumerosDoAlvo({ alvo, onChange }: { alvo: AlvoDaMecanica; onChange: Mudar }) {
  const { forma } = alvo
  switch (forma.tipo) {
    case 'um':
    case 'varios': {
      const { alcance, alcanceMinimo } = alvo
      if (alcanceMinimo !== undefined && alcance !== undefined) {
        // O anel: de `alcanceMinimo` a `alcance`, nunca colado (o mínimo de 2 até o máximo).
        return (
          <>
            <QuantosAlvos alvo={alvo} onChange={onChange} />
            <CampoInteiro rotulo="De" valor={alcanceMinimo} minimo={ANEL_MINIMO} maximo={alcance} depois="casas" onChange={(de) => onChange({ ...alvo, alcanceMinimo: de })} />
            <CampoInteiro rotulo="Até" valor={alcance} minimo={Math.max(ANEL_MINIMO, alcanceMinimo)} maximo={CASAS_MAX} depois="casas (nunca colado)" onChange={(ate) => onChange({ ...alvo, alcance: ate })} />
          </>
        )
      }
      return (
        <>
          <QuantosAlvos alvo={alvo} onChange={onChange} />
          <AteQuantasCasas alvo={alvo} rotulo="Até" onChange={onChange} />
        </>
      )
    }
    case 'linha':
    case 'cruz':
    case 'leque':
      return <CampoInteiro rotulo="Distância" valor={forma.casas} minimo={1} maximo={CASAS_MAX} depois="casas" onChange={(casas) => onChange(alvoComForma(alvo, { ...forma, casas }))} />
    case 'raio':
      if (forma.centro === undefined) return <CampoInteiro rotulo="Distância" valor={forma.casas} minimo={1} maximo={CASAS_MAX} depois="casas em volta de quem usa" onChange={(casas) => onChange(alvoComForma(alvo, { ...forma, casas }))} />
      return (
        <>
          <AteQuantasCasas alvo={alvo} rotulo={forma.centro === 'ponto' ? 'O ponto a até' : 'A ficha a até'} onChange={onChange} />
          <CampoInteiro rotulo="Explode" valor={forma.casas} minimo={1} maximo={CASAS_MAX} depois={`${forma.casas === 1 ? 'casa' : 'casas'} em volta ${forma.centro === 'ponto' ? 'do ponto' : 'da ficha'}`} onChange={(casas) => onChange(alvoComForma(alvo, { ...forma, casas }))} />
        </>
      )
    case 'quadrado':
      return (
        <>
          {forma.centro === 'ponto' && <AteQuantasCasas alvo={alvo} rotulo="O ponto a até" onChange={onChange} />}
          <CampoInteiro rotulo="Lado" valor={forma.lado} minimo={1} maximo={CASAS_MAX} depois={`casas (${forma.lado} x ${forma.lado})`} onChange={(lado) => onChange(alvoComForma(alvo, { ...forma, lado: ladoValido(lado, forma.centro) }))} />
          {forma.centro !== 'frente' && <p className="lb-field__hint">Em volta, o lado é ímpar: 3 x 3 pega 1 casa para cada lado.</p>}
        </>
      )
  }
}

/**
 * Na arma montada o alvo é 1 ou vários, marcados na mira (`motivoDaArmaNasPecas`, lib/batalha/mecanica/arma.ts):
 * só o alvo até N e o anel. A arma sem mecânica guarda qualquer forma no campo do cartão.
 */
const FORMAS_DA_ARMA = FORMAS_NA_TELA.filter((opcao) => opcao.tipo === 'alvo' || opcao.tipo === 'anel')

/** O selo de partida do "só vale em quem tem" (a redoma da Florescer). */
const SELO_EXIGIDO_DE_PARTIDA = 'Redoma'

export function BlocoDoAlvo({ mecanica, onChange, naArma = false }: Pick<BlocosProps, 'mecanica' | 'onChange' | 'naArma'>) {
  const { alvo } = mecanica
  const exige = alvo.exigeSelo
  // A cor das casas: a de toda a mesa (`corDoAlcance`): a arma é o Atacar, e sem peça de dano não há dano (`danoDasPecas`).
  const cor = corDoAlcance(naArma || mecanica.dano !== undefined ? { tipo: 'atacar' } : { tipo: 'cartao', dano: { tipo: 'semDano' } })
  const forma = alcanceDaMecanica(mecanica)
  const trocarAlvo = (novo: AlvoDaMecanica) => onChange({ ...mecanica, alvo: novo })
  const trocarExige = (nome: string | null) => {
    const { exigeSelo: _antes, ...sem } = alvo
    onChange({ ...mecanica, alvo: nome === null ? sem : { ...sem, exigeSelo: nome } })
  }
  return (
    <Bloco numero={4} titulo="Em quem pega" frase={`${fraseDoAlvo(mecanica)}${exige === undefined ? '' : ` Só em quem tem ${exige}.`}`} abertoAoMontar>
      <Escolha
        legenda="Pega"
        // ED7: na arma montada, o Atacar vai em inimigo (`motivoDaArmaNasPecas`): ajuda e "em quem usa" ficam cinza com o motivo.
        opcoes={QUEM.map((quem) => ({ ...quem, bloqueio: quem.valor === alvo.quem ? null : naArma && ehAjuda(quem.valor) ? ARMA_SO_EM_INIMIGO : motivoDoQuem(mecanica, quem.valor) }))}
        valor={alvo.quem}
        onChange={(quem) => onChange(trocarQuem(mecanica, quem))}
      />
      {alvo.quem !== 'si' ? (
        <>
          <EscolhaDaForma legenda="Forma do alcance" opcoes={naArma ? FORMAS_DA_ARMA : FORMAS_NA_TELA} valor={formaNaTelaDoAlvo(alvo)} cor={cor} onChange={(tipo) => trocarAlvo(alvoNaForma(alvo, tipo))} />
          {naArma && <p className="lb-field__hint">Na arma montada, o Atacar vai em 1 ou vários alvos: alvo até N ou anel. Linha, leque e área ficam nas técnicas, ou no alcance da arma sem mecânica.</p>}
          <div className="lb-mec__linha lb-mec__linha--recuo">
            <NumerosDoAlvo alvo={alvo} onChange={trocarAlvo} />
          </div>
          <p className="lb-field__hint">
            {forma === null ? 'Sem limite de distância: na mesa nada acende e a distância não é conferida.' : `${descreverAlcance(forma)}. Casas em ${cor === 'azul' ? 'azul: dá dano' : 'verde claro: não dá dano'}.`}
          </p>
        </>
      ) : (
        <p className="lb-field__hint">Só em quem usa: na mesa acende a casa dele.</p>
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
