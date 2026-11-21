import { useId, useState, type ReactNode } from 'react'
import { CUSTO_MAX, DANO_MAX, NOME_DO_SELO_MAX, TURNOS_DO_SELO_MAX, type VantagemDoDado } from '../../lib/batalha/combate'
import { comportamentoDoSelo, SELOS_COM_REGRA } from '../../lib/batalha/condicoes'
import { CAMPO_DO_DANO } from '../../lib/batalha/formula'
import {
  ATRIBUTOS_DA_REACAO_MAX,
  CASAS_MAX,
  CD_MAX,
  danoUsaArma,
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
  type ReacaoDaMecanica,
  type Teste,
  type UsoDaMecanica,
} from '../../lib/batalha/mecanica/modelo'
import { ehAjuda, formaNova, ladoValido, motivoDoQuem, testeNovo, trocarQuem, trocarUso } from '../../lib/batalha/mecanica/modelos'
import { fraseDoAlvo, fraseDoCusto, fraseDoEfeito, fraseDoLimite, frasesDaReacao, fraseDoTeste, frasesDoDano, frasesDoSelo, frasesDosOutrosCustos, numeroComVirgula, previaDaCd, type FichaDaPrevia } from '../../lib/batalha/mecanica/resumo'
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
  /** Construtor C8: montando o efeito da própria arma (não há "qual arma" a perguntar). */
  naArma?: boolean
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
 * B18: as vezes de um multiplicador ("1,5"). O texto torto ("abc", "0") não
 * fica na tela como se valesse: o campo diz o que aceita e, ao sair dele,
 * volta ao número que a ficha guarda.
 */
function CampoDasVezes({ rotulo, vezes, onChange }: { rotulo: string; vezes: number; onChange: (vezes: number) => void }) {
  const erroId = useId()
  const [texto, setTexto] = useState(() => numeroComVirgula(vezes))
  const torto = vezesDoTexto(texto) === null
  return (
    <>
      <input
        className="lb-input lb-mec__vezes"
        aria-label={rotulo}
        aria-invalid={torto || undefined}
        aria-describedby={torto ? erroId : undefined}
        inputMode="decimal"
        value={texto}
        onChange={(event) => {
          setTexto(event.target.value)
          const novo = vezesDoTexto(event.target.value)
          if (novo !== null) onChange(novo)
        }}
        onBlur={() => {
          if (torto) setTexto(numeroComVirgula(vezes))
        }}
      />
      {torto && (
        <span className="lb-field__error" id={erroId} role="status">
          Um número maior que 0 e até {VEZES_MAX}; fica ×{numeroComVirgula(vezes)}.
        </span>
      )}
    </>
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
    <Bloco numero={2} titulo="Quanto custa" frase={[fraseDoCusto(mecanica), ...frasesDosOutrosCustos(mecanica)].join(' ')} abertoAoMontar>
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
    <Bloco numero={3} titulo="Que ação gasta" frase={frase} abertoAoMontar>
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
    <Bloco numero={4} titulo="Em quem pega" frase={fraseDoAlvo(mecanica)} abertoAoMontar>
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
  const semConcentracao = mecanica.dano !== undefined && !mecanica.dano.multiplicadores.concentracao ? 'O dano não multiplica com a Concentração (bloco 6): a CD não pode depender dela.' : null
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

function BlocoDoDano({ mecanica, cartao, ficha, onChange, naArma }: BlocosProps) {
  const { dano } = mecanica
  const formula = dano === undefined ? '' : textoDoNumero(dano.base)
  // A prévia usa o campo Dano de sempre (o mesmo leitor da Saúde), num cartão de mentira só com a fórmula.
  const { mecanica: _pecas, mecanicaProposta: _proposta, aMao: _aMao, ...semPecas } = cartao
  const cartaoDaPrevia: CartaoDaFicha = { ...semPecas, campos: { [CAMPO_DO_DANO]: formula } }
  const trocarFormula = (texto: string) => {
    if (dano === undefined) return
    const comArma = DANO_DA_ARMA.test(texto)
    const { arma: _arma, ...semArma } = dano
    // Quem já marcou "perguntar qual arma" continua perguntando enquanto a fórmula tiver o Dano da Arma.
    const arma = dano.arma === 'perguntar' ? 'perguntar' : 'padrao'
    onChange({ ...mecanica, dano: { ...semArma, base: { formula: texto.slice(0, FORMULA_MAX) }, ...(comArma ? { arma } : {}) } })
  }
  const extras = dano?.multiplicadores.extra ?? []
  const trocarExtras = (novos: { nome: string; vezes: number }[]) => {
    if (dano === undefined) return
    const { extra: _velhos, ...mult } = dano.multiplicadores
    onChange({ ...mecanica, dano: { ...dano, multiplicadores: novos.length === 0 ? mult : { ...mult, extra: novos } } })
  }
  return (
    <Bloco numero={6} titulo="Quanto dano" frase={frasesDoDano(mecanica, ficha).join(' ') || 'Sem dano.'} abertoAoMontar={dano !== undefined}>
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
            {naArma !== true && danoUsaArma(dano) && (
              <Marcar rotulo="Pergunta qual arma na hora (já vem marcada a padrão)" marcado={dano.arma === 'perguntar'} onChange={(sim) => onChange({ ...mecanica, dano: { ...dano, arma: sim ? 'perguntar' : 'padrao' } })} />
            )}
          </div>
          {extras.map((extra, indice) => (
            <div key={`${indice}-${extras.length}`} className="lb-mec__linha lb-mec__linha--recuo">
              <Texto rotulo={`Multiplicador ${indice + 1}`} valor={extra.nome} maximo={NOME_DO_SELO_MAX} placeholder="Ex.: Ponto vital" onChange={(nome) => trocarExtras(extras.map((atual, j) => (j === indice ? { ...atual, nome } : atual)))} />
              <span className="lb-mec__texto">
                <span className="lb-mec__numero-rotulo" aria-hidden="true">
                  ×
                </span>
                <CampoDasVezes rotulo={`Vezes do multiplicador ${indice + 1}`} vezes={extra.vezes} onChange={(vezes) => trocarExtras(extras.map((atual, j) => (j === indice ? { ...atual, vezes } : atual)))} />
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
  // Fase 4: só no lugar da reação, o selo vai em quem atacou e a cura e o "tira selos" (efeitos da vez) não existem.
  const soReacao = mecanica.uso === 'reacao'
  const tambemReacao = mecanica.uso === 'ativaOuReacao'
  const semAjuda = soReacao ? 'Só no lugar da reação a técnica não roda na vez: o efeito não teria em quem pegar.' : ajuda ? null : 'Só em aliado ou em quem usa (bloco 4).'
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
    <Bloco numero={7} titulo="O que deixa" frase={frases.length === 0 ? 'Nada além do dano.' : frases.join(' ')} abertoAoMontar={efeitos.length > 0}>
      <Marcar
        rotulo={soReacao ? 'Deixa um selo em quem atacou' : ajuda ? 'Dá um selo' : 'Se acertar, deixa um selo'}
        marcado={selo !== undefined}
        bloqueio={selo === undefined && cheio ? `Já tem ${EFEITOS_MAX} efeitos.` : null}
        onChange={(sim) => trocarUm('selo', sim ? (soReacao ? { tipo: 'selo', nome: 'Marcado', duracao: 1, natureza: 'debuff', em: 'atacante' } : { tipo: 'selo', nome: ajuda ? 'Fortalecido' : 'Atordoado', duracao: 1, natureza: ajuda ? 'buff' : 'debuff' }) : null)}
      />
      {selo !== undefined && <PecasDoSelo selo={selo} ajuda={ajuda && selo.em === undefined} listaId={listaId} ficha={ficha} onChange={(novo) => trocarUm('selo', novo)} />}
      {selo !== undefined && selo.tipo === 'selo' && tambemReacao && (
        <Marcar
          rotulo="Vai em quem atacou (só quando reage)"
          marcado={selo.em === 'atacante'}
          onChange={(sim) => {
            const { em: _em, ...noAlvo } = selo
            trocarUm('selo', sim ? { ...noAlvo, em: 'atacante' } : noAlvo)
          }}
        />
      )}
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

// ─── Fase 4: a técnica no lugar da reação ───────────────────────────────────

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

function BlocoDoUso({ mecanica, onChange }: Pick<BlocosProps, 'mecanica' | 'onChange'>) {
  const uso = mecanica.uso ?? 'ativa'
  return (
    <Bloco numero={1} titulo="Quando usa" frase={FRASE_DO_USO[uso]} abertoAoMontar={uso !== 'ativa'}>
      <Escolha legenda="Quando usa" opcoes={USOS} valor={uso} onChange={(novo) => onChange(trocarUso(mecanica, novo))} />
      <p className="lb-field__hint">No lugar da reação: aparece na caixa REAÇÃO de quem leva o golpe, antes de rolar o d20. Uma por golpe; não gasta a ação da vez.</p>
    </Bloco>
  )
}

type TipoDaDefesa = ReacaoDaMecanica['defesa']['tipo']

const DEFESAS: readonly Opcao<TipoDaDefesa>[] = [
  { valor: 'anula', rotulo: 'Anula' },
  { valor: 'fica', rotulo: 'Fica com %' },
  { valor: 'rola', rotulo: 'Rola o d20' },
  { valor: 'nenhuma', rotulo: 'Toma inteiro' },
]

/** Quanto volta em quem atacou: o divisor do dano que ficou ('0' = nada). */
type Devolve = '0' | '1' | '2' | '3'

const DEVOLVES: readonly Opcao<Devolve>[] = [
  { valor: '0', rotulo: 'Nada' },
  { valor: '2', rotulo: 'Metade' },
  { valor: '3', rotulo: 'Um terço' },
  { valor: '1', rotulo: 'Tudo' },
]

/** O total do d20 que anula, de partida (o do Aparar, H20). */
const ANULA_DE_PARTIDA = 15
/** A parte do dano que fica, de partida (o Bloqueio, H19). */
const PORCENTO_DE_PARTIDA = 50

function defesaNova(tipo: TipoDaDefesa, ficha: FichaDaPrevia): ReacaoDaMecanica['defesa'] {
  if (tipo === 'fica') return { tipo, porcento: PORCENTO_DE_PARTIDA }
  if (tipo !== 'rola') return { tipo }
  const primeiro = ficha.sistema.atributos.at(0)
  return { tipo, atributos: primeiro === undefined ? [] : [primeiro.id], anulaCom: ANULA_DE_PARTIDA }
}

function BlocoDaReacao({ mecanica, ficha, onChange }: Pick<BlocosProps, 'mecanica' | 'ficha' | 'onChange'>) {
  const { reacao } = mecanica
  if (reacao === undefined) return null
  const { defesa } = reacao
  const trocar = (nova: ReacaoDaMecanica) => onChange({ ...mecanica, reacao: nova })
  const rola = defesa.tipo === 'rola'
  const soNoDado = rola ? 'Na reação que rola o dado, o d20 decide: anula ou toma inteiro.' : null
  const contra = reacao.valeContra ?? []
  const trocarContra = (tipo: 'overload' | 'surpresa', sim: boolean) => {
    const { valeContra: _antes, ...resto } = reacao
    const novos = sim ? [...contra.filter((item) => item !== tipo), tipo] : contra.filter((item) => item !== tipo)
    trocar(novos.length === 0 ? resto : { ...resto, valeContra: novos })
  }
  const trocarAtributo = (id: string, sim: boolean) => {
    if (defesa.tipo !== 'rola') return
    const atributos = sim ? [...defesa.atributos.filter((atual) => atual !== id), id] : defesa.atributos.filter((atual) => atual !== id)
    trocar({ ...reacao, defesa: { ...defesa, atributos } })
  }
  return (
    <Bloco numero={8} titulo="Reação" frase={frasesDaReacao(mecanica, ficha).join(' ')} abertoAoMontar>
      <Escolha
        legenda="Defesa"
        opcoes={DEFESAS}
        valor={defesa.tipo}
        onChange={(tipo) => {
          const { devolve: _devolve, curaDoQueChegava: _cura, ...semExtras } = reacao
          // A que rola não devolve nem cura (o motor ainda não faz): os dois saem junto.
          trocar({ ...(tipo === 'rola' ? semExtras : reacao), defesa: defesaNova(tipo, ficha) })
        }}
      />
      {defesa.tipo === 'fica' && (
        <div className="lb-mec__linha">
          <CampoInteiro rotulo="Toma só" valor={defesa.porcento} minimo={1} maximo={99} depois="% do dano" onChange={(porcento) => trocar({ ...reacao, defesa: { ...defesa, porcento } })} />
        </div>
      )}
      {defesa.tipo === 'rola' && (
        <>
          <fieldset className="lb-mec__escolha">
            <legend className="lb-mec__legenda">d20 + o maior modificador entre</legend>
            {ficha.sistema.atributos.map((atributo) => (
              <Marcar
                key={atributo.id}
                rotulo={atributo.nome}
                marcado={defesa.atributos.includes(atributo.id)}
                bloqueio={!defesa.atributos.includes(atributo.id) && defesa.atributos.length >= ATRIBUTOS_DA_REACAO_MAX ? `Até ${ATRIBUTOS_DA_REACAO_MAX} atributos.` : null}
                onChange={(sim) => trocarAtributo(atributo.id, sim)}
              />
            ))}
          </fieldset>
          <div className="lb-mec__linha">
            <CampoInteiro rotulo="Anula com" valor={defesa.anulaCom} minimo={1} maximo={CD_MAX} depois="ou mais" onChange={(anulaCom) => trocar({ ...reacao, defesa: { ...defesa, anulaCom } })} />
          </div>
        </>
      )}
      <Escolha
        legenda="Devolve em quem atacou, sem reação dele"
        opcoes={DEVOLVES.map((opcao) => ({ ...opcao, bloqueio: opcao.valor === '0' ? null : soNoDado }))}
        valor={reacao.devolve === undefined ? '0' : devolveDoDivisor(reacao.devolve.divididoPor)}
        onChange={(valor) => {
          const { devolve: _antes, ...resto } = reacao
          trocar(valor === '0' ? resto : { ...resto, devolve: { divididoPor: Number(valor) } })
        }}
      />
      <Marcar
        rotulo="Parte do dano que chegava vira vida"
        marcado={reacao.curaDoQueChegava !== undefined}
        bloqueio={reacao.curaDoQueChegava === undefined ? soNoDado : null}
        onChange={(sim) => {
          const { curaDoQueChegava: _antes, ...resto } = reacao
          trocar(sim ? { ...resto, curaDoQueChegava: PORCENTO_DE_PARTIDA } : resto)
        }}
      />
      {reacao.curaDoQueChegava !== undefined && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Cura" valor={reacao.curaDoQueChegava} minimo={1} maximo={100} depois="% do que chegava" onChange={(curaDoQueChegava) => trocar({ ...reacao, curaDoQueChegava })} />
        </div>
      )}
      <Marcar rotulo="Vale também contra Overload" marcado={contra.includes('overload')} onChange={(sim) => trocarContra('overload', sim)} />
      <Marcar rotulo="Vale também contra Surpresa" marcado={contra.includes('surpresa')} onChange={(sim) => trocarContra('surpresa', sim)} />
      <Marcar
        rotulo="Só o mestre usa"
        marcado={reacao.soOMestre === true}
        onChange={(sim) => {
          const { soOMestre: _antes, ...resto } = reacao
          trocar(sim ? { ...resto, soOMestre: true } : resto)
        }}
      />
      <p className="lb-field__hint">Escolhida antes do d20; depois do dado não troca. Atordoado e Paralisado não reagem, nem com técnica.</p>
    </Bloco>
  )
}

/** O divisor gravado (1 a 3, `DEVOLVE_DIVIDIDO_MAX`) como a opção da tela. */
function devolveDoDivisor(divisor: number): Devolve {
  if (divisor === 1) return '1'
  return divisor === 3 ? '3' : '2'
}

type TipoDeLimite = 'livre' | 'recarga' | 'usos'

function BlocoDosLimites({ mecanica, onChange }: Pick<BlocosProps, 'mecanica' | 'onChange'>) {
  const { limite } = mecanica
  const tipo: TipoDeLimite = limite.recarga !== undefined ? 'recarga' : limite.usosPorBatalha !== undefined ? 'usos' : 'livre'
  const comOverload = limite.overload === true ? { overload: true as const } : {}
  return (
    <Bloco numero={9} titulo="Limites" frase={fraseDoLimite(mecanica) ?? 'Sem limite: usa sempre que tiver o custo.'} abertoAoMontar={tipo !== 'livre' || limite.overload === true}>
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
      {props.naArma !== true && <BlocoDoUso mecanica={props.mecanica} onChange={props.onChange} />}
      <BlocoDoCusto mecanica={props.mecanica} onChange={props.onChange} />
      {/* Fase 4: só no lugar da reação, a ação, o alvo, o teste e o dano da vez não existem. */}
      {props.mecanica.uso !== 'reacao' && (
        <>
          <BlocoDaAcao mecanica={props.mecanica} onChange={props.onChange} />
          <BlocoDoAlvo mecanica={props.mecanica} onChange={props.onChange} />
          <BlocoDoTeste mecanica={props.mecanica} ficha={props.ficha} onChange={props.onChange} />
          <BlocoDoDano {...props} />
        </>
      )}
      <BlocoDosEfeitos mecanica={props.mecanica} ficha={props.ficha} onChange={props.onChange} />
      <BlocoDaReacao mecanica={props.mecanica} ficha={props.ficha} onChange={props.onChange} />
      <BlocoDosLimites mecanica={props.mecanica} onChange={props.onChange} />
    </div>
  )
}
