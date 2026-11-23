import { Fragment, type ReactNode } from 'react'
import { CUSTO_MAX, DANO_MAX, NOME_DO_SELO_MAX, TURNOS_DO_SELO_MAX } from '../../../lib/batalha/combate'
import { ATRIBUTO_MAX, CASAS_MAX, CD_MAX, FORMULA_MAX, LIMITE_MAX, type Custo, type Efeito, type MecanicaV1, type ModDaPeca } from '../../../lib/batalha/mecanica/modelo'
import { fraseDoAlvo, fraseDoCusto, nomeDoAtributo, type FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import { CampoNumero } from '../../FichaPecas'
import { numeroDoTexto, textoDoNumero, type BlocosProps } from './controles'
import { deltaDoTexto, textoDoDelta, type SeloDaPeca } from './PecasDoSelo'

/**
 * O DEGRAU 2 da tela de montar (SISTEMA.md §8, "Os números"): só as 3 ou 4
 * linhas que a técnica usa, em frase, com o número no meio da frase ("Dá
 * [Força + 20] de dano. Custa [30] [SP]."). O resto (o desenho da área, o
 * teste, a Concentração, os outros selos) fica no Avançado, dobrado.
 */

/** Teto de linhas do degrau 2: mais que isto já é o Avançado. */
const LINHAS_MAX = 4

type Mudar = (mecanica: MecanicaV1) => void
type CuraDaPeca = Extract<Efeito, { tipo: 'cura' }>

/** Número inteiro no meio da frase: o rótulo vai para o leitor de tela, o valor fica preso entre os tetos. */
function NumeroNaFrase({ rotulo, valor, minimo, maximo, onChange }: { rotulo: string; valor: number; minimo: number; maximo: number; onChange: (valor: number) => void }) {
  return <CampoNumero rotulo={rotulo} valor={valor} onChange={(novo) => onChange(Math.min(maximo, Math.max(minimo, novo)))} />
}

/** Texto no meio da frase, da largura do que está escrito. */
function TextoNaFrase({ rotulo, valor, maximo, placeholder, onChange }: { rotulo: string; valor: string; maximo: number; placeholder?: string; onChange: (valor: string) => void }) {
  return (
    <input
      className="lb-input lb-mec__frase-texto"
      aria-label={rotulo}
      value={valor}
      maxLength={maximo}
      placeholder={placeholder}
      size={Math.max(6, (valor === '' ? (placeholder ?? '') : valor).length + 1)}
      spellCheck={false}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function EscolhaNaFrase<T extends string>({ rotulo, valor, opcoes, onChange }: { rotulo: string; valor: T; opcoes: readonly { valor: T; rotulo: string }[]; onChange: (valor: T) => void }) {
  return (
    <select
      className="lb-input lb-mec__frase-escolha"
      aria-label={rotulo}
      value={valor}
      onChange={(event) => {
        const achada = opcoes.find((opcao) => opcao.valor === event.target.value)
        if (achada !== undefined) onChange(achada.valor)
      }}
    >
      {opcoes.map((opcao) => (
        <option key={opcao.valor} value={opcao.valor}>
          {opcao.rotulo}
        </option>
      ))}
    </select>
  )
}

function Frase({ children }: { children: ReactNode }) {
  return <p className="lb-mec__frase">{children}</p>
}

function linhaDaReacao(mecanica: MecanicaV1, onChange: Mudar): ReactNode {
  const { reacao } = mecanica
  if (reacao === undefined) return null
  const { defesa } = reacao
  if (defesa.tipo === 'fica') {
    return (
      <Frase>
        Na reação, toma só <NumeroNaFrase rotulo="Parte do dano que fica, em %" valor={defesa.porcento} minimo={1} maximo={99} onChange={(porcento) => onChange({ ...mecanica, reacao: { ...reacao, defesa: { ...defesa, porcento } } })} />% do dano.
      </Frase>
    )
  }
  if (defesa.tipo === 'rola') {
    return (
      <Frase>
        Na reação, rola o d20 e anula com <NumeroNaFrase rotulo="Total do d20 que anula" valor={defesa.anulaCom} minimo={1} maximo={CD_MAX} onChange={(anulaCom) => onChange({ ...mecanica, reacao: { ...reacao, defesa: { ...defesa, anulaCom } } })} /> ou mais.
      </Frase>
    )
  }
  return <Frase>{defesa.tipo === 'anula' ? 'Na reação, anula o golpe.' : 'Na reação, toma o golpe inteiro.'}</Frase>
}

function linhaDoDano(mecanica: MecanicaV1, onChange: Mudar): ReactNode {
  const { dano } = mecanica
  if (dano === undefined) return null
  const alvo = fraseDoAlvo(mecanica)
  const { base } = dano
  if ('porcento' in base) {
    return (
      <Frase>
        Dá <NumeroNaFrase rotulo="Dano, em % da vida do alvo" valor={base.porcento} minimo={1} maximo={100} onChange={(porcento) => onChange({ ...mecanica, dano: { ...dano, base: { ...base, porcento } } })} />% da vida{' '}
        <EscolhaNaFrase<'hpAtual' | 'hpMaximo'>
          rotulo="De qual vida do alvo"
          valor={base.de === 'hpMaximo' ? 'hpMaximo' : 'hpAtual'}
          opcoes={[
            { valor: 'hpAtual', rotulo: 'atual' },
            { valor: 'hpMaximo', rotulo: 'máxima' },
          ]}
          onChange={(de) => onChange({ ...mecanica, dano: { ...dano, base: { ...base, de } } })}
        />{' '}
        do alvo. {alvo}
      </Frase>
    )
  }
  return (
    <Frase>
      Dá{' '}
      <TextoNaFrase
        rotulo="Quanto dano dá"
        valor={textoDoNumero(base)}
        maximo={FORMULA_MAX}
        placeholder="Força + 20"
        // O "Dano da Arma" e a pergunta de qual arma ficam no Avançado: aqui só o número muda.
        onChange={(texto) => onChange({ ...mecanica, dano: { ...dano, base: numeroDoTexto(texto, DANO_MAX) } })}
      />{' '}
      de dano. {alvo}
    </Frase>
  )
}

const RECURSOS_DA_CURA = [
  { valor: 'hp', rotulo: 'HP' },
  { valor: 'sp', rotulo: 'SP' },
  { valor: 'escudo', rotulo: 'Escudo' },
] as const

function linhaDaCura(mecanica: MecanicaV1, onChange: Mudar): ReactNode {
  // Fase 7 (o Elixir): HP e SP no mesmo alvo, uma frase por cura.
  const indices = mecanica.efeitos.flatMap((efeito, indice) => (efeito.tipo === 'cura' && efeito.em === undefined ? [indice] : []))
  if (indices.length === 0) return null
  return <>{indices.map((indice) => <LinhaDeUmaCura key={indice} mecanica={mecanica} indice={indice} onChange={onChange} />)}</>
}

/** Uma cura no alvo, em frase: o número, a fórmula ou (fase 7) a parte do máximo do alvo. */
function LinhaDeUmaCura({ mecanica, indice, onChange }: { mecanica: MecanicaV1; indice: number; onChange: Mudar }) {
  const cura = mecanica.efeitos[indice]
  if (cura === undefined || cura.tipo !== 'cura') return null
  const trocar = (nova: CuraDaPeca) => onChange({ ...mecanica, efeitos: mecanica.efeitos.map((efeito, j) => (j === indice ? nova : efeito)) })
  const { quanto } = cura
  if ('porcento' in quanto) {
    return (
      <Frase>
        {cura.recurso === 'sp' ? 'Recupera' : 'Cura'} <TextoNaFrase rotulo="Parte do máximo (%)" valor={String(quanto.porcento)} maximo={3} placeholder="50" onChange={(texto) => trocar({ ...cura, quanto: { ...quanto, porcento: Math.min(Math.max(Math.trunc(Number(texto)) || 1, 1), 100) } })} />% do {cura.recurso === 'sp' ? 'SP' : 'HP'} máximo do alvo.
      </Frase>
    )
  }
  const recurso = <EscolhaNaFrase rotulo="O que recupera" valor={cura.recurso} opcoes={RECURSOS_DA_CURA} onChange={(novo) => trocar({ ...cura, recurso: novo })} />
  if ('porCarga' in quanto) return <Frase>Recupera {recurso} pela Concentração (os números de cada carga estão no Avançado).</Frase>
  return (
    <Frase>
      {cura.recurso === 'escudo' ? 'Dá' : 'Recupera'} <TextoNaFrase rotulo="Quanto recupera" valor={textoDoNumero(quanto)} maximo={FORMULA_MAX} placeholder="100" onChange={(texto) => trocar({ ...cura, quanto: numeroDoTexto(texto, DANO_MAX) })} /> de {recurso}.
    </Frase>
  )
}

/** Fase 6 (H14): com quanto o caído volta (a parte do HP máximo dele). */
function linhaDoReviver(mecanica: MecanicaV1, onChange: Mudar): ReactNode {
  const indice = mecanica.efeitos.findIndex((efeito) => efeito.tipo === 'reviver')
  const reviver = mecanica.efeitos[indice]
  if (reviver === undefined || reviver.tipo !== 'reviver' || !('porcento' in reviver.volta)) return null
  const { volta } = reviver
  return (
    <Frase>
      Quem caiu levanta com{' '}
      <NumeroNaFrase rotulo="Parte do HP máximo com que volta, em %" valor={volta.porcento} minimo={1} maximo={100} onChange={(porcento) => onChange({ ...mecanica, efeitos: mecanica.efeitos.map((efeito, j) => (j === indice ? { ...reviver, volta: { ...volta, porcento } } : efeito)) })} />
      % do HP máximo dele.
    </Frase>
  )
}

/** Fase 6 (H05): a área longe: o raio em volta do ponto e o alcance do ponto. */
function linhaDaAreaLonge(mecanica: MecanicaV1, onChange: Mudar): ReactNode {
  const { forma, alcance } = mecanica.alvo
  if (forma.tipo !== 'raio' || forma.centro === undefined) return null
  const ondeCai = forma.centro === 'ponto' ? 'de um ponto' : 'de uma ficha'
  return (
    <Frase>
      Pega quem está a até <NumeroNaFrase rotulo="Casas em volta do centro" valor={forma.casas} minimo={1} maximo={CASAS_MAX} onChange={(casas) => onChange({ ...mecanica, alvo: { ...mecanica.alvo, forma: { ...forma, casas } } })} /> casa {ondeCai}
      {alcance === undefined ? (
        '.'
      ) : (
        <>
          {' '}a até <NumeroNaFrase rotulo="Alcance do centro, em casas" valor={alcance} minimo={1} maximo={CASAS_MAX} onChange={(casas) => onChange({ ...mecanica, alvo: { ...mecanica.alvo, alcance: casas } })} /> casas de quem usa.
        </>
      )}
    </Frase>
  )
}

/**
 * Fase F do alcance: o alcance da forma que sai de quem usa ou do alvo escolhido, com o número no
 * meio da frase ("Leque de [3] casas à frente."). A área longe tem a linha dela; o "em si" e o alvo
 * sem limite não têm número.
 */
function linhaDoAlcance(mecanica: MecanicaV1, onChange: Mudar): ReactNode {
  const { alvo } = mecanica
  const { forma, alcance, alcanceMinimo } = alvo
  if (alvo.quem === 'si') return null
  const casas = (n: number) => (n === 1 ? 'casa' : 'casas')
  const trocarForma = (nova: typeof forma) => onChange({ ...mecanica, alvo: { ...alvo, forma: nova } })
  switch (forma.tipo) {
    case 'um':
    case 'varios': {
      if (alcance === undefined) return null
      const ate = <NumeroNaFrase rotulo="Alcance, em casas" valor={alcance} minimo={Math.max(1, alcanceMinimo ?? 1)} maximo={CASAS_MAX} onChange={(n) => onChange({ ...mecanica, alvo: { ...alvo, alcance: n } })} />
      if (alcanceMinimo !== undefined) {
        return (
          <Frase>
            Pega de <NumeroNaFrase rotulo="Alcance mínimo, em casas" valor={alcanceMinimo} minimo={2} maximo={alcance} onChange={(n) => onChange({ ...mecanica, alvo: { ...alvo, alcanceMinimo: n } })} /> a {ate} casas, nunca colado.
          </Frase>
        )
      }
      return (
        <Frase>
          Pega {forma.tipo === 'um' ? 'um alvo' : 'os alvos'} a até {ate} {casas(alcance)}.
        </Frase>
      )
    }
    case 'linha':
    case 'cruz':
    case 'leque': {
      const numero = <NumeroNaFrase rotulo="Alcance, em casas" valor={forma.casas} minimo={1} maximo={CASAS_MAX} onChange={(n) => trocarForma({ ...forma, casas: n })} />
      const nome = forma.tipo === 'linha' ? 'Linha reta' : forma.tipo === 'cruz' ? 'Cruz' : 'Leque'
      return (
        <Frase>
          {nome} de {numero} {casas(forma.casas)}
          {forma.tipo === 'leque' ? ' à frente' : ''}.
        </Frase>
      )
    }
    case 'raio':
      if (forma.centro !== undefined) return null
      return (
        <Frase>
          Em volta, <NumeroNaFrase rotulo="Alcance, em casas" valor={forma.casas} minimo={1} maximo={CASAS_MAX} onChange={(n) => trocarForma({ ...forma, casas: n })} /> {casas(forma.casas)}.
        </Frase>
      )
    case 'quadrado':
      if (forma.centro !== 'frente') return null
      return (
        <Frase>
          Quadrado de lado <NumeroNaFrase rotulo="Lado do quadrado, em casas" valor={forma.lado} minimo={1} maximo={CASAS_MAX} onChange={(n) => trocarForma({ ...forma, lado: n })} /> à frente.
        </Frase>
      )
  }
}

function linhaDoDreno(mecanica: MecanicaV1, onChange: Mudar): ReactNode {
  const indice = mecanica.efeitos.findIndex((efeito) => efeito.tipo === 'dreno')
  const dreno = mecanica.efeitos[indice]
  if (dreno === undefined || dreno.tipo !== 'dreno') return null
  return (
    <Frase>
      Quem usa recupera{' '}
      <NumeroNaFrase
        rotulo="Parte do dano que volta em vida, em %"
        valor={dreno.porcentoDoDano}
        minimo={1}
        maximo={100}
        onChange={(porcentoDoDano) => onChange({ ...mecanica, efeitos: mecanica.efeitos.map((efeito, j) => (j === indice ? { ...dreno, porcentoDoDano } : efeito)) })}
      />
      % do dano em HP.
    </Frase>
  )
}

/** O primeiro número do selo ("com Força +20"), quando ele tem. */
function NumeroDoSeloNaFrase({ mod, ficha, onChange }: { mod: ModDaPeca; ficha: FichaDaPrevia; onChange: (mod: ModDaPeca) => void }) {
  const opcoes = [...ficha.sistema.atributos.map((atributo) => ({ valor: atributo.id, rotulo: nomeDoAtributo(atributo.id, ficha) })), { valor: 'dano', rotulo: 'Dano' }, { valor: 'reacao', rotulo: 'Reação' }]
  // O alvo gravado que o sistema não tem mais (ficha trocada) aparece como está, para não sumir da escolha.
  const comOGravado = opcoes.some((opcao) => opcao.valor === mod.alvo) ? opcoes : [...opcoes, { valor: mod.alvo, rotulo: mod.alvo }]
  return (
    <>
      , com <EscolhaNaFrase rotulo="O que o selo muda" valor={mod.alvo} opcoes={comOGravado} onChange={(alvo) => onChange({ ...mod, alvo: alvo.slice(0, ATRIBUTO_MAX) })} />{' '}
      <TextoNaFrase rotulo="Quanto o selo muda" valor={textoDoDelta(mod.delta)} maximo={FORMULA_MAX} placeholder="+20" onChange={(texto) => onChange({ ...mod, delta: deltaDoTexto(texto) })} />
    </>
  )
}

function linhaDoSelo(mecanica: MecanicaV1, ficha: FichaDaPrevia, onChange: Mudar): ReactNode {
  const indice = mecanica.efeitos.findIndex((efeito) => efeito.tipo === 'selo')
  const selo = mecanica.efeitos[indice]
  if (selo === undefined || selo.tipo !== 'selo') return null
  const trocar = (novo: SeloDaPeca) => onChange({ ...mecanica, efeitos: mecanica.efeitos.map((efeito, j) => (j === indice ? novo : efeito)) })
  const nome = <TextoNaFrase rotulo="Nome do selo" valor={selo.nome} maximo={NOME_DO_SELO_MAX} placeholder="Sangrando" onChange={(texto) => trocar({ ...selo, nome: texto })} />
  const mods = selo.mods ?? []
  const primeiro = mods[0]
  const tempo =
    typeof selo.duracao === 'number' ? (
      <>
        {' '}
        por <NumeroNaFrase rotulo="Quantas vezes o selo dura" valor={selo.duracao} minimo={1} maximo={TURNOS_DO_SELO_MAX} onChange={(duracao) => trocar({ ...selo, duracao })} /> {selo.duracao === 1 ? 'vez' : 'vezes'}
      </>
    ) : selo.duracao === 'proximoGolpe' ? (
      ' até o próximo golpe'
    ) : (
      ' até tirarem'
    )
  return (
    <Frase>
      {selo.em === 'quemUsa' ? 'Quem usa fica' : selo.em === 'atacante' ? 'Quem atacou fica' : 'Deixa'} {nome}
      {tempo}
      {primeiro !== undefined && <NumeroDoSeloNaFrase mod={primeiro} ficha={ficha} onChange={(mod) => trocar({ ...selo, mods: mods.map((atual, j) => (j === 0 ? mod : atual)) })} />}.
    </Frase>
  )
}

type RecursoDoCusto = 'nada' | Custo['recurso']

const RECURSOS_DO_CUSTO: readonly { valor: RecursoDoCusto; rotulo: string }[] = [
  { valor: 'sp', rotulo: 'SP' },
  { valor: 'hp', rotulo: 'HP' },
  { valor: 'nada', rotulo: 'nada' },
]

/** Custo de partida ao trocar "nada" por um recurso (o dos modelos). */
const CUSTO_DE_PARTIDA = 30

function linhaDoCusto(mecanica: MecanicaV1, onChange: Mudar): ReactNode {
  const aoUsar = mecanica.custos.find((custo) => custo.quando === 'aoUsar')
  const outros = mecanica.custos.filter((custo) => custo.quando !== 'aoUsar')
  const trocar = (novo: Custo | null) => onChange({ ...mecanica, custos: novo === null ? outros : [novo, ...outros] })
  // A ordem fixa dos custos (ao usar primeiro) é a mesma do bloco 2.
  const recurso = (
    <EscolhaNaFrase<RecursoDoCusto>
      rotulo="O que gasta ao usar"
      valor={aoUsar?.recurso ?? 'nada'}
      opcoes={RECURSOS_DO_CUSTO}
      onChange={(novo) => trocar(novo === 'nada' ? null : { recurso: novo, quanto: aoUsar?.quanto ?? { fixo: CUSTO_DE_PARTIDA }, quando: 'aoUsar' })}
    />
  )
  if (aoUsar === undefined) return <Frase>Custa {recurso}.</Frase>
  const { quanto } = aoUsar
  // Porcentagem e fórmula ficam no bloco 2 do Avançado: aqui a frase diz o que está escolhido.
  if (!('fixo' in quanto)) return <Frase>{fraseDoCusto(mecanica)} (no Avançado, bloco 2)</Frase>
  return (
    <Frase>
      Custa <NumeroNaFrase rotulo="Quanto custa ao usar" valor={quanto.fixo} minimo={0} maximo={CUSTO_MAX} onChange={(fixo) => trocar({ ...aoUsar, quanto: { fixo } })} /> {recurso}.
    </Frase>
  )
}

function linhaDoLimite(mecanica: MecanicaV1, onChange: Mudar): ReactNode {
  const { limite } = mecanica
  if (limite.recarga !== undefined) {
    return (
      <Frase>
        Espera <NumeroNaFrase rotulo="Recarga, em vezes" valor={limite.recarga} minimo={1} maximo={LIMITE_MAX} onChange={(recarga) => onChange({ ...mecanica, limite: { ...limite, recarga } })} /> {limite.recarga === 1 ? 'vez' : 'vezes'} para usar de novo.
      </Frase>
    )
  }
  if (limite.usosPorBatalha !== undefined) {
    return (
      <Frase>
        Até <NumeroNaFrase rotulo="Usos por batalha" valor={limite.usosPorBatalha} minimo={1} maximo={LIMITE_MAX} onChange={(usosPorBatalha) => onChange({ ...mecanica, limite: { ...limite, usosPorBatalha } })} /> usos por batalha.
      </Frase>
    )
  }
  return null
}

export function OsNumeros({ mecanica, ficha, onChange }: Pick<BlocosProps, 'mecanica' | 'ficha' | 'onChange'>) {
  // Na ordem em que o golpe acontece; o que passar de 4 linhas fica só no Avançado.
  const linhas = [
    { chave: 'reacao', no: linhaDaReacao(mecanica, onChange) },
    { chave: 'dano', no: mecanica.uso === 'reacao' ? null : linhaDoDano(mecanica, onChange) },
    { chave: 'alcance', no: mecanica.uso === 'reacao' ? null : linhaDoAlcance(mecanica, onChange) },
    { chave: 'area', no: linhaDaAreaLonge(mecanica, onChange) },
    { chave: 'cura', no: linhaDaCura(mecanica, onChange) },
    { chave: 'reviver', no: linhaDoReviver(mecanica, onChange) },
    { chave: 'dreno', no: linhaDoDreno(mecanica, onChange) },
    { chave: 'selo', no: linhaDoSelo(mecanica, ficha, onChange) },
    { chave: 'custo', no: linhaDoCusto(mecanica, onChange) },
    { chave: 'limite', no: linhaDoLimite(mecanica, onChange) },
  ]
    .filter((linha) => linha.no !== null)
    .slice(0, LINHAS_MAX)
  return (
    <section className="lb-mec__numeros" aria-label="Os números">
      <h4 className="lb-mec__comeco-titulo">Os números</h4>
      {linhas.map((linha) => (
        <Fragment key={linha.chave}>{linha.no}</Fragment>
      ))}
    </section>
  )
}
