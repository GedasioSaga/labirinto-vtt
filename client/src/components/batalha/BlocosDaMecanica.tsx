import { useId, useState, type ReactNode } from 'react'
import { CUSTO_MAX, DANO_MAX, NOME_DO_SELO_MAX, TURNOS_DO_SELO_MAX, type VantagemDoDado } from '../../lib/batalha/combate'
import { comportamentoDoSelo, SELOS_COM_REGRA } from '../../lib/batalha/condicoes'
import { CAMPO_DO_DANO } from '../../lib/batalha/formula'
import {
  CASAS_MAX,
  CD_MAX,
  EFEITOS_MAX,
  EXTRAS_MAX,
  FORMULA_MAX,
  LIMITE_MAX,
  TEXTO_A_MAO_MAX,
  VEZES_MAX,
  type AcaoDaMecanica,
  type CdDoTeste,
  type Custo,
  type Efeito,
  type FormaDoAlvo,
  type MecanicaV1,
  type Numero,
  type NumeroDaCd,
  type NumeroSimples,
  type QuemOAlvoPega,
  type QuemRolaNoTeste,
  type Teste,
} from '../../lib/batalha/mecanica/modelo'
import { ehAjuda, formaNova, ladoValido, motivoDoQuem, testeNovo, trocarQuem } from '../../lib/batalha/mecanica/modelos'
import { fraseDoAlvo, fraseDoCusto, fraseDoEfeito, fraseDoLimite, fraseDoTeste, frasesDoDano, frasesDoSelo, frasesDosOutrosCustos, numeroComVirgula, previaDaCd, type FichaDaPrevia } from '../../lib/batalha/mecanica/resumo'
import { SELOS_PRONTOS } from '../../lib/batalha/selos'
import type { CartaoDaFicha } from '../../lib/personagem'
import { CampoDeDano } from '../CampoDeDano'
import { CampoNumero } from '../FichaPecas'

/**
 * OS 7 BLOCOS da tela de montar a mecânica (construtor, fatia C2; seção 3 do
 * plano), na ordem em que o motor resolve o golpe. Cada bloco é uma seção que
 * abre e fecha; fechada, o cabeçalho diz em frase o que está escolhido. Só
 * aparecem as peças que o motor já executa (C1): o que não executa não vira
 * botão, vira lembrete à mão.
 */

export interface BlocosProps {
  mecanica: MecanicaV1
  /** O cartão que está sendo montado (o campo Dano de exemplo da prévia sai dele). */
  cartao: CartaoDaFicha
  ficha: FichaDaPrevia
  onChange: (mecanica: MecanicaV1) => void
}

// ─── Peças de controle ──────────────────────────────────────────────────────

interface Opcao<T extends string> {
  valor: T
  rotulo: string
  /** Por que não dá para escolher agora; ausente = dá. */
  bloqueio?: string | null
}

/** Botões de escolha única: rádio de verdade por baixo (setas, Espaço e o rótulo funcionam como o sistema). */
function Escolha<T extends string>({ legenda, opcoes, valor, onChange }: { legenda: string; opcoes: readonly Opcao<T>[]; valor: T; onChange: (valor: T) => void }) {
  const nome = useId()
  const bloqueios = opcoes.flatMap((opcao) => (opcao.bloqueio === null || opcao.bloqueio === undefined ? [] : [opcao.bloqueio]))
  const motivo = bloqueios[0]
  return (
    <fieldset className="lb-mec__escolha">
      <legend className="lb-mec__legenda">{legenda}</legend>
      <div className="lb-mec__opcoes">
        {opcoes.map((opcao) => {
          const bloqueada = opcao.bloqueio !== null && opcao.bloqueio !== undefined
          return (
            <label key={opcao.valor} className="lb-mec__opcao" data-bloqueada={bloqueada ? '' : undefined} title={bloqueada ? (opcao.bloqueio ?? undefined) : undefined}>
              <input className="lb-sr-only" type="radio" name={nome} value={opcao.valor} checked={opcao.valor === valor} disabled={bloqueada} onChange={() => onChange(opcao.valor)} />
              <span>{opcao.rotulo}</span>
            </label>
          )
        })}
      </div>
      {motivo !== undefined && <p className="lb-field__hint">{motivo}</p>}
    </fieldset>
  )
}

/** Caixa de marcar com o rótulo na frente (clicar no texto marca). */
function Marcar({ rotulo, marcado, onChange, bloqueio }: { rotulo: string; marcado: boolean; onChange: (marcado: boolean) => void; bloqueio?: string | null }) {
  const bloqueada = bloqueio !== null && bloqueio !== undefined
  return (
    <div className="lb-mec__marcar-linha">
      <label className="lb-mec__marcar" data-bloqueada={bloqueada ? '' : undefined}>
        <input type="checkbox" checked={marcado} disabled={bloqueada} onChange={(event) => onChange(event.target.checked)} />
        <span>{rotulo}</span>
      </label>
      {bloqueada && <span className="lb-field__hint">{bloqueio}</span>}
    </div>
  )
}

/** Número inteiro com rótulo visível ao lado, preso entre `minimo` e `maximo`. */
function CampoInteiro({ rotulo, valor, minimo, maximo, onChange, depois }: { rotulo: string; valor: number; minimo: number; maximo: number; onChange: (valor: number) => void; depois?: string }) {
  const id = useId()
  return (
    <span className="lb-mec__numero">
      <label className="lb-mec__numero-rotulo" htmlFor={id}>
        {rotulo}
      </label>
      <CampoNumero id={id} rotulo={rotulo} valor={valor} onChange={(novo) => onChange(Math.min(maximo, Math.max(minimo, novo)))} />
      {depois !== undefined && <span className="lb-mec__numero-depois">{depois}</span>}
    </span>
  )
}

/** Texto de uma linha com rótulo visível. */
function Texto({ rotulo, valor, maximo, onChange, placeholder, lista }: { rotulo: string; valor: string; maximo: number; onChange: (valor: string) => void; placeholder?: string; lista?: string }) {
  const id = useId()
  return (
    <span className="lb-mec__texto">
      <label className="lb-mec__numero-rotulo" htmlFor={id}>
        {rotulo}
      </label>
      <input id={id} className="lb-input" value={valor} maxLength={maximo} placeholder={placeholder} list={lista} spellCheck={false} onChange={(event) => onChange(event.target.value)} />
    </span>
  )
}

/**
 * Um bloco numerado que abre e fecha; fechado, a frase do que está escolhido.
 * `abertoAoMontar` vale só quando o editor abre: depois, quem abre e fecha é
 * a pessoa. O bloco não fecha sozinho quando o conteúdo muda (desmarcar "Dá
 * dano", tirar o último efeito, "Sem limite"): fechava embaixo do cursor, e o
 * foco do teclado sumia junto com o controle.
 */
function Bloco({ numero, titulo, frase, abertoAoMontar, children }: { numero: number; titulo: string; frase: string; abertoAoMontar: boolean; children: ReactNode }) {
  const [aberto, setAberto] = useState(abertoAoMontar)
  return (
    <details className="lb-mec__bloco" open={aberto} onToggle={(event) => setAberto(event.currentTarget.open)}>
      <summary className="lb-mec__bloco-cab">
        <span className="lb-mec__bloco-numero" aria-hidden="true">
          {numero}
        </span>
        <span className="lb-mec__bloco-titulo">{titulo}</span>
        <span className="lb-mec__bloco-frase">{frase}</span>
      </summary>
      <div className="lb-mec__bloco-corpo">{children}</div>
    </details>
  )
}

// ─── Leitura e escrita dos números da peça ──────────────────────────────────

/** O texto de um número da peça ("100", "Força + 10"). */
function textoDoNumero(numero: NumeroSimples): string {
  return 'fixo' in numero ? String(numero.fixo) : numero.formula
}

/** O texto digitado vira número fixo (só dígitos, dentro do teto) ou fórmula. */
function numeroDoTexto(texto: string, maximo: number): NumeroSimples {
  const limpo = texto.trim()
  if (/^\d+$/.test(limpo)) {
    const valor = Number(limpo)
    if (valor <= maximo) return { fixo: valor }
  }
  return { formula: texto }
}

/** "1,5" ou "1.5" → 1,5; torto = `null`. */
function vezesDoTexto(texto: string): number | null {
  const valor = Number(texto.trim().replace(',', '.'))
  return Number.isFinite(valor) && valor > 0 && valor <= VEZES_MAX ? valor : null
}

const DANO_DA_ARMA = /dano\s+da\s+arma/i

// ─── Os 7 blocos ────────────────────────────────────────────────────────────

const RECURSOS: readonly Opcao<'sp' | 'hp'>[] = [
  { valor: 'sp', rotulo: 'SP' },
  { valor: 'hp', rotulo: 'HP' },
]

type ComoCusta = 'fixo' | 'maximo' | 'atual' | 'formula'

function comoCusta(custo: Custo): ComoCusta {
  if ('porcento' in custo.quanto) return custo.quanto.de
  return 'fixo' in custo.quanto ? 'fixo' : 'formula'
}

function BlocoDoCusto({ mecanica, onChange }: Pick<BlocosProps, 'mecanica' | 'onChange'>) {
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
  return (
    <Bloco numero={1} titulo="Quanto custa" frase={[fraseDoCusto(mecanica), ...frasesDosOutrosCustos(mecanica)].join(' ')} abertoAoMontar>
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
    </Bloco>
  )
}

const ACOES: readonly Opcao<AcaoDaMecanica>[] = [
  { valor: 'simples', rotulo: 'Simples' },
  { valor: 'bonus', rotulo: 'Bônus' },
  { valor: 'completa', rotulo: 'Completa' },
  { valor: 'livre', rotulo: 'Livre' },
  { valor: 'perguntar', rotulo: 'Perguntar na hora' },
]

function BlocoDaAcao({ mecanica, onChange }: Pick<BlocosProps, 'mecanica' | 'onChange'>) {
  const frase = mecanica.acao === 'perguntar' ? 'Quem usa escolhe na hora.' : `Gasta ${ACOES.find((acao) => acao.valor === mecanica.acao)?.rotulo ?? ''}.`
  return (
    <Bloco numero={2} titulo="Que ação gasta" frase={frase} abertoAoMontar>
      <Escolha legenda="A ação" opcoes={ACOES} valor={mecanica.acao} onChange={(acao) => onChange({ ...mecanica, acao })} />
    </Bloco>
  )
}

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

function BlocoDoAlvo({ mecanica, onChange }: Pick<BlocosProps, 'mecanica' | 'onChange'>) {
  const { alvo } = mecanica
  return (
    <Bloco numero={3} titulo="Em quem pega" frase={fraseDoAlvo(mecanica)} abertoAoMontar>
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
    </Bloco>
  )
}

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

const CD_DE_PARTIDA = 12

const TESTES: readonly { valor: Teste['tipo']; rotulo: string }[] = [
  { valor: 'reacao', rotulo: 'O alvo reage normal (d20)' },
  { valor: 'naoErra', rotulo: 'Não erra' },
  { valor: 'resistencia', rotulo: 'O alvo testa contra uma CD' },
  { valor: 'disputa', rotulo: 'Disputa (d20 contra d20)' },
]

/** O teste de resistência: quem testa, a CD (um valor ou pela Concentração) e o que acontece se o alvo passar. */
function TesteDeResistencia({ teste, mecanica, ficha, onChange }: { teste: Extract<Teste, { tipo: 'resistencia' }>; mecanica: MecanicaV1; ficha: FichaDaPrevia; onChange: (teste: Teste) => void }) {
  const porCarga = 'porCarga' in teste.cd
  // A CD pela Concentração pede a carga, que o dano sem Concentração não gasta (a leitura recusa).
  const semConcentracao = mecanica.dano !== undefined && !mecanica.dano.multiplicadores.concentracao ? 'O dano não multiplica com a Concentração (bloco 5): a CD não pode depender dela.' : null
  const valor: NumeroSimples = 'porCarga' in teste.cd ? teste.cd.porCarga[0] : teste.cd
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
      <Escolha<Extract<Teste, { tipo: 'resistencia' }>['sePassar']>
        legenda="Se o alvo passar"
        opcoes={[
          { valor: 'nada', rotulo: 'Nada acontece' },
          { valor: 'devolveCusto', rotulo: 'Nada, e a técnica não gasta' },
        ]}
        valor={teste.sePassar}
        onChange={(sePassar) => onChange({ ...teste, sePassar })}
      />
    </>
  )
}

function BlocoDoTeste({ mecanica, ficha, onChange }: Pick<BlocosProps, 'mecanica' | 'ficha' | 'onChange'>) {
  const ajuda = ehAjuda(mecanica.alvo.quem)
  const { teste } = mecanica
  const semAtributos = ficha.sistema.atributos.length === 0 ? 'O sistema da ficha não tem atributos para testar.' : null
  const trocarTeste = (novo: Teste) => onChange({ ...mecanica, teste: novo })
  return (
    <Bloco numero={4} titulo="Como acerta" frase={fraseDoTeste(mecanica, ficha)} abertoAoMontar={!ajuda}>
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

function BlocoDoDano({ mecanica, cartao, ficha, onChange }: BlocosProps) {
  const { dano } = mecanica
  const formula = dano === undefined ? '' : textoDoNumero(dano.base)
  // A prévia usa o campo Dano de sempre (o mesmo leitor da Saúde), num cartão de mentira só com a fórmula.
  const { mecanica: _pecas, mecanicaProposta: _proposta, aMao: _aMao, ...semPecas } = cartao
  const cartaoDaPrevia: CartaoDaFicha = { ...semPecas, campos: { [CAMPO_DO_DANO]: formula } }
  const trocarFormula = (texto: string) => {
    if (dano === undefined) return
    const comArma = DANO_DA_ARMA.test(texto)
    const { arma: _arma, ...semArma } = dano
    onChange({ ...mecanica, dano: { ...semArma, base: { formula: texto.slice(0, FORMULA_MAX) }, ...(comArma ? { arma: 'padrao' } : {}) } })
  }
  const extras = dano?.multiplicadores.extra ?? []
  const trocarExtras = (novos: { nome: string; vezes: number }[]) => {
    if (dano === undefined) return
    const { extra: _velhos, ...mult } = dano.multiplicadores
    onChange({ ...mecanica, dano: { ...dano, multiplicadores: novos.length === 0 ? mult : { ...mult, extra: novos } } })
  }
  return (
    <Bloco numero={5} titulo="Quanto dano" frase={frasesDoDano(mecanica, ficha).join(' ') || 'Sem dano.'} abertoAoMontar={dano !== undefined}>
      <Marcar
        rotulo="Dá dano"
        marcado={dano !== undefined}
        onChange={(sim) => {
          if (!sim) {
            const { dano: _fora, ...semDano } = mecanica
            onChange(semDano)
            return
          }
          onChange({ ...mecanica, dano: { base: { formula: '' }, multiplicadores: { concentracao: true, surpresa: true } } })
        }}
      />
      {dano !== undefined && (
        <>
          <CampoDeDano
            rotulo="Fórmula do dano"
            campoId={CAMPO_DO_DANO}
            cartao={cartaoDaPrevia}
            personagem={ficha.personagem}
            sistema={ficha.sistema}
            semDanoDaArma={false}
            ehArma={false}
            semModo
            onChange={(novo) => trocarFormula(novo.campos[CAMPO_DO_DANO] ?? '')}
          />
          <div className="lb-mec__marcas">
            <Marcar rotulo="Perfurante" marcado={dano.perfurante === true} onChange={(perfurante) => onChange({ ...mecanica, dano: { ...dano, perfurante } })} />
            <Marcar rotulo="Multiplica com a Concentração" marcado={dano.multiplicadores.concentracao} onChange={(concentracao) => onChange({ ...mecanica, dano: { ...dano, multiplicadores: { ...dano.multiplicadores, concentracao } } })} />
            <Marcar rotulo="Multiplica com a Surpresa" marcado={dano.multiplicadores.surpresa} onChange={(surpresa) => onChange({ ...mecanica, dano: { ...dano, multiplicadores: { ...dano.multiplicadores, surpresa } } })} />
          </div>
          {extras.map((extra, indice) => (
            <div key={`${indice}-${extras.length}`} className="lb-mec__linha lb-mec__linha--recuo">
              <Texto rotulo={`Multiplicador ${indice + 1}`} valor={extra.nome} maximo={NOME_DO_SELO_MAX} placeholder="Ex.: Ponto vital" onChange={(nome) => trocarExtras(extras.map((atual, j) => (j === indice ? { ...atual, nome } : atual)))} />
              <span className="lb-mec__texto">
                <span className="lb-mec__numero-rotulo" aria-hidden="true">
                  ×
                </span>
                <input
                  className="lb-input lb-mec__vezes"
                  aria-label={`Vezes do multiplicador ${indice + 1}`}
                  inputMode="decimal"
                  defaultValue={numeroComVirgula(extra.vezes)}
                  onChange={(event) => {
                    const vezes = vezesDoTexto(event.target.value)
                    if (vezes !== null) trocarExtras(extras.map((atual, j) => (j === indice ? { ...atual, vezes } : atual)))
                  }}
                />
              </span>
              <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" aria-label={`Tirar o multiplicador ${indice + 1}`} onClick={() => trocarExtras(extras.filter((_, j) => j !== indice))}>
                ×
              </button>
            </div>
          ))}
          {extras.length < EXTRAS_MAX && (
            <button type="button" className="lb-btn lb-btn--compact lb-mec__mais" onClick={() => trocarExtras([...extras, { nome: '', vezes: 1.5 }])}>
              + Multiplicador (furtivo, ponto vital)
            </button>
          )}
        </>
      )}
    </Bloco>
  )
}

function textoDaCura(quanto: Numero, carga: 0 | 1 | 2 | 3): string {
  if ('porCarga' in quanto) return textoDoNumero(quanto.porCarga[carga])
  return carga === 0 ? textoDoNumero(quanto) : ''
}

type SeloDaPeca = Extract<Efeito, { tipo: 'selo' }>
type ComoDura = 'vezes' | 'proximoGolpe' | 'ateTirar'

/** Construtor C5: o "tira X por vez" que a tela escreve (só HP fixo, direto: a peça confere). */
function porTurnoDe(fixo: number): NonNullable<SeloDaPeca['porTurno']> {
  return { recurso: 'hp', quanto: { fixo }, direto: true }
}

/** O selo sem o "tira por vez" (trocar de selo pronto começa do zero). */
function semPorTurno(selo: SeloDaPeca): SeloDaPeca {
  const { porTurno: _antes, ...resto } = selo
  return resto
}

/**
 * Construtor C5, o selo da peça: o nome (pronto com regra ou livre), o que ele
 * faz em frase, quanto tira por vez e por quanto tempo. A regra vem do nome
 * (`condicoes.ts`), então a frase muda enquanto o mestre digita.
 */
function PecasDoSelo({ selo, ajuda, listaId, ficha, onChange }: { selo: SeloDaPeca; ajuda: boolean; listaId: string; ficha: FichaDaPrevia; onChange: (selo: SeloDaPeca) => void }) {
  const regra = comportamentoDoSelo(selo.nome)
  const pronto = regra === null ? undefined : SELOS_COM_REGRA.find((nome) => comportamentoDoSelo(nome) === regra)
  const frases = frasesDoSelo(selo, ficha)
  const daRegra = regra?.porVez
  const tira = selo.porTurno?.quanto.fixo ?? daRegra
  const como: ComoDura = typeof selo.duracao === 'number' ? 'vezes' : selo.duracao
  return (
    <div className="lb-mec__selo lb-mec__linha--recuo">
      <datalist id={listaId}>
        {[...SELOS_COM_REGRA, ...SELOS_PRONTOS.filter((nome) => comportamentoDoSelo(nome) === null)].map((nome) => (
          <option key={nome} value={nome} />
        ))}
      </datalist>
      {!ajuda && (
        <Escolha
          legenda="Selo pronto"
          opcoes={[...SELOS_COM_REGRA.map((nome) => ({ valor: nome, rotulo: nome })), { valor: 'outro' as const, rotulo: 'Outro' }]}
          valor={pronto ?? 'outro'}
          onChange={(nome) => onChange(semPorTurno({ ...selo, nome: nome === 'outro' ? '' : nome }))}
        />
      )}
      <div className="lb-mec__linha">
        <Texto rotulo="Nome do selo" valor={selo.nome} maximo={NOME_DO_SELO_MAX} lista={listaId} placeholder="Ex.: Envenenado" onChange={(nome) => onChange({ ...selo, nome })} />
      </div>
      <p className="lb-field__hint lb-mec__regra">{frases.length === 0 ? 'Sem regra própria: o app só mostra o selo na carta.' : `O que faz: ${frases.join('; ')}.`}</p>
      <Marcar
        rotulo="Tira HP no começo de cada vez dele (o mestre clica Aplicar)"
        marcado={tira !== undefined}
        bloqueio={regra !== null && daRegra !== undefined ? `${regra.nome} sempre tira.` : null}
        onChange={(sim) => onChange(sim ? { ...selo, porTurno: porTurnoDe(10) } : semPorTurno(selo))}
      />
      {tira !== undefined && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Tira" valor={tira} minimo={1} maximo={DANO_MAX} depois="de HP por vez, direto (sem o Escudo)" onChange={(fixo) => onChange({ ...selo, porTurno: porTurnoDe(fixo) })} />
        </div>
      )}
      <div className="lb-mec__linha">
        <Escolha
          legenda="Por quanto tempo"
          opcoes={[
            { valor: 'vezes', rotulo: 'Algumas vezes' },
            { valor: 'proximoGolpe', rotulo: 'Até o próximo golpe' },
            { valor: 'ateTirar', rotulo: 'Até tirarem' },
          ]}
          valor={como}
          onChange={(novo) => onChange({ ...selo, duracao: novo === 'vezes' ? 1 : novo })}
        />
        {typeof selo.duracao === 'number' && <CampoInteiro rotulo="Dura" valor={selo.duracao} minimo={1} maximo={TURNOS_DO_SELO_MAX} depois={selo.duracao === 1 ? 'vez' : 'vezes'} onChange={(duracao) => onChange({ ...selo, duracao })} />}
      </div>
      <p className="lb-field__hint lb-mec__regra">
        {typeof selo.duracao === 'number'
          ? 'Conta na vez de quem tem o selo: desce 1 no fim de cada vez dele (1 = até o fim da próxima vez dele).'
          : selo.duracao === 'proximoGolpe'
            ? 'Sai quando outro golpe chegar em quem tem o selo.'
            : 'Fica até o mestre tirar na carta.'}
      </p>
    </div>
  )
}

function BlocoDosEfeitos({ mecanica, ficha, onChange }: Pick<BlocosProps, 'mecanica' | 'ficha' | 'onChange'>) {
  const listaId = useId()
  const { efeitos } = mecanica
  const ajuda = ehAjuda(mecanica.alvo.quem)
  const selo = efeitos.find((efeito) => efeito.tipo === 'selo')
  const cura = efeitos.find((efeito) => efeito.tipo === 'cura')
  const tira = efeitos.some((efeito) => efeito.tipo === 'tirarSelos')
  const lembretes = efeitos.flatMap((efeito, indice) => (efeito.tipo === 'aMao' ? [{ indice, texto: efeito.texto }] : []))
  const cheio = efeitos.length >= EFEITOS_MAX
  // Ordem fixa: selo, cura, tirar selos, lembretes (a ficha gravada sai sempre igual).
  const ordem: Efeito['tipo'][] = ['selo', 'cura', 'tirarSelos', 'aMao']
  const trocarEfeitos = (novos: Efeito[]) => onChange({ ...mecanica, efeitos: [...novos].sort((a, b) => ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo)) })
  const trocarUm = (tipo: 'selo' | 'cura' | 'tirarSelos', novo: Efeito | null) => trocarEfeitos([...efeitos.filter((efeito) => efeito.tipo !== tipo), ...(novo === null ? [] : [novo])])
  const semAjuda = ajuda ? null : 'Só em aliado ou em quem usa (bloco 3).'
  const trocarCura = (carga: 0 | 1 | 2 | 3, texto: string) => {
    if (cura === undefined) return
    const numero = numeroDoTexto(texto, DANO_MAX)
    if (!('porCarga' in cura.quanto)) {
      trocarUm('cura', { ...cura, quanto: numero })
      return
    }
    const cargas = [...cura.quanto.porCarga] as [NumeroSimples, NumeroSimples, NumeroSimples, NumeroSimples]
    cargas[carga] = numero
    trocarUm('cura', { ...cura, quanto: { porCarga: cargas } })
  }
  const frases = efeitos.map((efeito) => fraseDoEfeito(efeito, mecanica, ficha))
  return (
    <Bloco numero={6} titulo="O que deixa" frase={frases.length === 0 ? 'Nada além do dano.' : frases.join(' ')} abertoAoMontar={efeitos.length > 0}>
      <Marcar
        rotulo={ajuda ? 'Dá um selo' : 'Se acertar, deixa um selo'}
        marcado={selo !== undefined}
        bloqueio={selo === undefined && cheio ? `Já tem ${EFEITOS_MAX} efeitos.` : null}
        onChange={(sim) => trocarUm('selo', sim ? { tipo: 'selo', nome: ajuda ? 'Fortalecido' : 'Atordoado', duracao: 1, natureza: ajuda ? 'buff' : 'debuff' } : null)}
      />
      {selo !== undefined && <PecasDoSelo selo={selo} ajuda={ajuda} listaId={listaId} ficha={ficha} onChange={(novo) => trocarUm('selo', novo)} />}
      <Marcar rotulo="Cura HP" marcado={cura !== undefined} bloqueio={cura === undefined ? (semAjuda ?? (cheio ? `Já tem ${EFEITOS_MAX} efeitos.` : null)) : null} onChange={(sim) => trocarUm('cura', sim ? { tipo: 'cura', recurso: 'hp', quanto: { fixo: 100 }, emQuem: 'alvo' } : null)} />
      {cura !== undefined && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <Texto rotulo={'porCarga' in cura.quanto ? 'Sem carga' : 'Cura'} valor={textoDaCura(cura.quanto, 0)} maximo={FORMULA_MAX} placeholder="Ex.: 100 ou Espírito × 2" onChange={(texto) => trocarCura(0, texto)} />
          {'porCarga' in cura.quanto &&
            ([1, 2, 3] as const).map((carga) => <Texto key={carga} rotulo={`Carga ${carga}`} valor={textoDaCura(cura.quanto, carga)} maximo={FORMULA_MAX} onChange={(texto) => trocarCura(carga, texto)} />)}
          <Marcar
            rotulo="Muda com a Concentração"
            marcado={'porCarga' in cura.quanto}
            onChange={(sim) => {
              const zero = 'porCarga' in cura.quanto ? cura.quanto.porCarga[0] : cura.quanto
              trocarUm('cura', { ...cura, quanto: sim ? { porCarga: [zero, zero, zero, zero] } : zero })
            }}
          />
        </div>
      )}
      <Marcar rotulo="Tira os selos negativos" marcado={tira} bloqueio={tira ? null : (semAjuda ?? (cheio ? `Já tem ${EFEITOS_MAX} efeitos.` : null))} onChange={(sim) => trocarUm('tirarSelos', sim ? { tipo: 'tirarSelos', quais: 'negativos' } : null)} />
      <div className="lb-mec__lembretes">
        {lembretes.map((lembrete, numero) => (
          <div key={lembrete.indice} className="lb-mec__linha">
            <Texto
              rotulo={`Lembrete ${numero + 1}`}
              valor={lembrete.texto}
              maximo={TEXTO_A_MAO_MAX}
              placeholder="O que o app não faz e o mestre confere"
              onChange={(texto) => trocarEfeitos(efeitos.map((efeito, j) => (j === lembrete.indice ? { tipo: 'aMao', texto } : efeito)))}
            />
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" aria-label={`Tirar o lembrete ${numero + 1}`} onClick={() => trocarEfeitos(efeitos.filter((_, j) => j !== lembrete.indice))}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className="lb-btn lb-btn--compact lb-mec__mais" disabled={cheio} title={cheio ? `Já tem ${EFEITOS_MAX} efeitos` : undefined} onClick={() => trocarEfeitos([...efeitos, { tipo: 'aMao', texto: '' }])}>
          + Lembrete à mão
        </button>
        <p className="lb-field__hint">O lembrete não executa nada: aparece na mira e no registro para o mestre conferir.</p>
      </div>
    </Bloco>
  )
}

type TipoDeLimite = 'livre' | 'recarga' | 'usos'

function BlocoDosLimites({ mecanica, onChange }: Pick<BlocosProps, 'mecanica' | 'onChange'>) {
  const { limite } = mecanica
  const tipo: TipoDeLimite = limite.recarga !== undefined ? 'recarga' : limite.usosPorBatalha !== undefined ? 'usos' : 'livre'
  const comOverload = limite.overload === true ? { overload: true as const } : {}
  return (
    <Bloco numero={7} titulo="Limites" frase={fraseDoLimite(mecanica) ?? 'Sem limite: usa sempre que tiver o custo.'} abertoAoMontar={tipo !== 'livre' || limite.overload === true}>
      <Escolha
        legenda="Quantas vezes"
        opcoes={[
          { valor: 'livre', rotulo: 'Sem limite' },
          { valor: 'recarga', rotulo: 'Recarga' },
          { valor: 'usos', rotulo: 'Usos por batalha' },
        ]}
        valor={tipo}
        onChange={(novo) => onChange({ ...mecanica, limite: { ...comOverload, ...(novo === 'recarga' ? { recarga: 2 } : novo === 'usos' ? { usosPorBatalha: 3 } : {}) } })}
      />
      {limite.recarga !== undefined && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Espera" valor={limite.recarga} minimo={1} maximo={LIMITE_MAX} depois={limite.recarga === 1 ? 'vez para usar de novo' : 'vezes para usar de novo'} onChange={(recarga) => onChange({ ...mecanica, limite: { ...comOverload, recarga } })} />
        </div>
      )}
      {limite.usosPorBatalha !== undefined && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Até" valor={limite.usosPorBatalha} minimo={1} maximo={LIMITE_MAX} depois="usos por batalha" onChange={(usosPorBatalha) => onChange({ ...mecanica, limite: { ...comOverload, usosPorBatalha } })} />
        </div>
      )}
      <Marcar
        rotulo="Overload (1 por batalha, gasta a Ação Completa; só outra Overload defende)"
        marcado={limite.overload === true}
        onChange={(sim) => {
          const { overload: _antes, ...semOverload } = limite
          onChange({ ...mecanica, limite: sim ? { ...semOverload, overload: true } : semOverload })
        }}
      />
    </Bloco>
  )
}

/** Os 7 blocos, na ordem em que o motor resolve o golpe. */
export function BlocosDaMecanica(props: BlocosProps) {
  return (
    <div className="lb-mec__blocos">
      <BlocoDoCusto mecanica={props.mecanica} onChange={props.onChange} />
      <BlocoDaAcao mecanica={props.mecanica} onChange={props.onChange} />
      <BlocoDoAlvo mecanica={props.mecanica} onChange={props.onChange} />
      <BlocoDoTeste mecanica={props.mecanica} ficha={props.ficha} onChange={props.onChange} />
      <BlocoDoDano {...props} />
      <BlocoDosEfeitos mecanica={props.mecanica} ficha={props.ficha} onChange={props.onChange} />
      <BlocoDosLimites mecanica={props.mecanica} onChange={props.onChange} />
    </div>
  )
}
