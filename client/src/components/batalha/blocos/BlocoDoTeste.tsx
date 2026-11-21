import type { VantagemDoDado } from '../../../lib/batalha/combate'
import { CD_MAX, FORMULA_MAX, type CdDoTeste, type MecanicaV1, type NumeroDaCd, type NumeroSimples, type QuemRolaNoTeste, type Teste } from '../../../lib/batalha/mecanica/modelo'
import { ehAjuda, testeNovo } from '../../../lib/batalha/mecanica/modelos'
import { fraseDoTeste, previaDaCd, type FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import { Bloco, Escolha, Marcar, numeroDoTexto, Texto, textoDoNumero, type BlocosProps, type Opcao } from './controles'

/** O bloco 5 da mecânica: como acerta (reage, não erra, teste contra CD com "metade se passar", disputa). */

type DadoDoTeste = 'normal' | VantagemDoDado

const DADOS: readonly Opcao<DadoDoTeste>[] = [
  { valor: 'normal', rotulo: '1 d20' },
  { valor: 'vantagem', rotulo: 'Com vantagem' },
  { valor: 'desvantagem', rotulo: 'Com desvantagem' },
]

/** Quem rola num teste: o atributo (os do sistema da ficha) e o dado (vantagem: 2 d20, fica o maior; desvantagem: o menor). */
function QuemRolaNoBloco({ legenda, quem, ficha, onChange }: { legenda: string; quem: QuemRolaNoTeste; ficha: FichaDaPrevia; onChange: (quem: QuemRolaNoTeste) => void }) {
  return (
    <div className="lb-mec__linha lb-mec__linha--recuo">
      <Escolha legenda={legenda} opcoes={ficha.sistema.atributos.map((atributo) => ({ valor: atributo.id, rotulo: atributo.nome }))} valor={quem.atributo} onChange={(atributo) => onChange({ ...quem, atributo })} />
      <Escolha legenda="O dado" opcoes={DADOS} valor={quem.vantagem ?? 'normal'} onChange={(dado) => onChange(dado === 'normal' ? { atributo: quem.atributo } : { atributo: quem.atributo, vantagem: dado })} />
    </div>
  )
}

/** Uma CD de uma carga: o número ou a fórmula num campo só ("12", "12 + mod(Carisma)"), com a prévia na ficha. */
function CampoDaCd({ rotulo, numero, ficha, onChange }: { rotulo: string; numero: NumeroSimples; ficha: FichaDaPrevia; onChange: (numero: NumeroSimples) => void }) {
  const previa = 'formula' in numero ? previaDaCd(numero.formula, ficha) : null
  return (
    <span className="lb-mec__cd">
      <Texto rotulo={rotulo} valor={textoDoNumero(numero)} maximo={FORMULA_MAX} placeholder="Ex.: 12 + mod(Carisma)" onChange={(texto) => onChange(numeroDoTexto(texto, CD_MAX))} />
      {previa !== null && <span className="lb-mec__numero-depois">{previa}</span>}
    </span>
  )
}

const CD_DE_PARTIDA = 12

/** A tabela da CD pela Concentração: sem carga sempre testa; da carga 1 à 3, um número ou "pega sem teste". */
function CdPorCarga({ cd, ficha, onChange }: { cd: Extract<CdDoTeste, { porCarga: unknown }>; ficha: FichaDaPrevia; onChange: (cd: CdDoTeste) => void }) {
  const [zero, um, dois, tres] = cd.porCarga
  const comCarga: readonly { rotulo: string; numero: NumeroDaCd; trocar: (numero: NumeroDaCd) => CdDoTeste }[] = [
    { rotulo: 'Carga 1', numero: um, trocar: (numero) => ({ porCarga: [zero, numero, dois, tres] }) },
    { rotulo: 'Carga 2', numero: dois, trocar: (numero) => ({ porCarga: [zero, um, numero, tres] }) },
    { rotulo: 'Carga 3', numero: tres, trocar: (numero) => ({ porCarga: [zero, um, dois, numero] }) },
  ]
  return (
    <div className="lb-mec__cargas">
      <CampoDaCd rotulo="Sem carga" numero={zero} ficha={ficha} onChange={(numero) => onChange({ porCarga: [numero, um, dois, tres] })} />
      {comCarga.map((carga) => (
        <div key={carga.rotulo} className="lb-mec__carga">
          {carga.numero === 'automatico' ? <span className="lb-mec__numero-rotulo">{carga.rotulo}</span> : <CampoDaCd rotulo={carga.rotulo} numero={carga.numero} ficha={ficha} onChange={(numero) => onChange(carga.trocar(numero))} />}
          <Marcar rotulo="pega sem teste" marcado={carga.numero === 'automatico'} onChange={(sim) => onChange(carga.trocar(sim ? 'automatico' : { fixo: CD_DE_PARTIDA }))} />
        </div>
      ))}
    </div>
  )
}

const TESTES: readonly { valor: Teste['tipo']; rotulo: string }[] = [
  { valor: 'reacao', rotulo: 'O alvo reage normal (d20)' },
  { valor: 'naoErra', rotulo: 'Não erra' },
  { valor: 'resistencia', rotulo: 'O alvo testa contra uma CD' },
  { valor: 'disputa', rotulo: 'Disputa (d20 contra d20)' },
]

type SePassar = Extract<Teste, { tipo: 'resistencia' }>['sePassar']

/** O teste de resistência: quem testa, a CD (um valor ou pela Concentração) e o que acontece se o alvo passar. */
function TesteDeResistencia({ teste, mecanica, ficha, onChange }: { teste: Extract<Teste, { tipo: 'resistencia' }>; mecanica: MecanicaV1; ficha: FichaDaPrevia; onChange: (teste: Teste) => void }) {
  const porCarga = 'porCarga' in teste.cd
  // A CD pela Concentração pede a carga, que o dano sem Concentração não gasta (a leitura recusa).
  const semConcentracao = mecanica.dano !== undefined && !mecanica.dano.multiplicadores.concentracao ? 'O dano não multiplica com a Concentração (bloco 6): a CD não pode depender dela.' : null
  const valor: NumeroSimples = 'porCarga' in teste.cd ? teste.cd.porCarga[0] : teste.cd
  // Fase 5 (B16): a metade só faz sentido com dano.
  const semDano = mecanica.dano === undefined ? 'Sem dano (bloco 6), não há metade para dar.' : null
  return (
    <>
      <QuemRolaNoBloco legenda="O alvo testa" quem={teste.alvo} ficha={ficha} onChange={(alvo) => onChange({ ...teste, alvo })} />
      <div className="lb-mec__linha lb-mec__linha--recuo">
        <Escolha<'valor' | 'porCarga'>
          legenda="A CD"
          opcoes={[
            { valor: 'valor', rotulo: 'Um valor' },
            { valor: 'porCarga', rotulo: 'Pela Concentração', bloqueio: porCarga ? null : semConcentracao },
          ]}
          valor={porCarga ? 'porCarga' : 'valor'}
          onChange={(como) => onChange({ ...teste, cd: como === 'valor' ? valor : { porCarga: [valor, valor, valor, 'automatico'] } })}
        />
        {'porCarga' in teste.cd ? <CdPorCarga cd={teste.cd} ficha={ficha} onChange={(cd) => onChange({ ...teste, cd })} /> : <CampoDaCd rotulo="CD" numero={teste.cd} ficha={ficha} onChange={(cd) => onChange({ ...teste, cd })} />}
      </div>
      <p className="lb-field__hint">O app rola o d20 do alvo + o mod do atributo (metade do rank). Passa com o total igual ou acima da CD. Na fórmula, mod(Carisma) é o mod de quem usa.</p>
      <Escolha<SePassar>
        legenda="Se o alvo passar"
        opcoes={[
          { valor: 'nada', rotulo: 'Nada acontece' },
          { valor: 'devolveCusto', rotulo: 'Nada, e a técnica não gasta' },
          { valor: 'metade', rotulo: 'Toma metade do dano', bloqueio: teste.sePassar === 'metade' ? null : semDano },
        ]}
        valor={teste.sePassar}
        onChange={(sePassar) => onChange({ ...teste, sePassar })}
      />
      {teste.sePassar === 'metade' && <p className="lb-field__hint">Quem passa toma metade (para baixo) e não leva o selo do golpe.</p>}
    </>
  )
}

export function BlocoDoTeste({ mecanica, ficha, onChange }: Pick<BlocosProps, 'mecanica' | 'ficha' | 'onChange'>) {
  const ajuda = ehAjuda(mecanica.alvo.quem)
  const { teste } = mecanica
  const semAtributos = ficha.sistema.atributos.length === 0 ? 'O sistema da ficha não tem atributos para testar.' : null
  const trocarTeste = (novo: Teste) => onChange({ ...mecanica, teste: novo })
  return (
    <Bloco numero={5} titulo="Como acerta" frase={fraseDoTeste(mecanica, ficha)} abertoAoMontar={!ajuda}>
      {ajuda ? (
        <p className="lb-field__hint">Em aliado ou em quem usa, não há teste: a ajuda sempre pega.</p>
      ) : (
        <>
          <Escolha
            legenda="O teste"
            opcoes={TESTES.map((opcao) => ({ ...opcao, bloqueio: (opcao.valor === 'resistencia' || opcao.valor === 'disputa') && opcao.valor !== teste.tipo ? semAtributos : null }))}
            valor={teste.tipo}
            onChange={(tipo) => trocarTeste(testeNovo(tipo, teste, ficha.sistema))}
          />
          {teste.tipo === 'resistencia' && <TesteDeResistencia teste={teste} mecanica={mecanica} ficha={ficha} onChange={trocarTeste} />}
          {teste.tipo === 'disputa' && (
            <>
              <QuemRolaNoBloco legenda="Quem usa rola" quem={teste.usuario} ficha={ficha} onChange={(usuario) => trocarTeste({ ...teste, usuario })} />
              <QuemRolaNoBloco legenda="O alvo rola" quem={teste.alvo} ficha={ficha} onChange={(alvo) => trocarTeste({ ...teste, alvo })} />
              <p className="lb-field__hint">O app rola os dois d20 + o mod do atributo (metade do rank). Quem usa só vence com o total maior: o empate fica com o alvo.</p>
            </>
          )}
        </>
      )}
    </Bloco>
  )
}
