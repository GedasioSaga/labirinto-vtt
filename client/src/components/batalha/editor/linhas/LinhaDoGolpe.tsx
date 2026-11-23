import { useId, useMemo } from 'react'
import { CD_MAX, CASAS_MAX, REGRA_DE_PARTIDA, SELOS_NO_GOLPE_MAX, TESTE_DO_TIPO_DE_PARTIDA, TIPOS_QUE_BATEM, TIPOS_QUE_CAUSAM, type GolpeDaMecanica, type MecanicaV1, type QuandoOTipoPega, type RegraQuePoeCondicao, type TesteDoTipo, type TipoComRegra, type TipoDoGolpe, type TipoQueBate, type TipoQueCausa } from '../../../../lib/batalha/mecanica/modelo'
import { NOME_DO_TIPO, pecasParaOMotor } from '../../../../lib/batalha/mecanica/golpe'
import { frasesDoGolpe, type FichaDaPrevia } from '../../../../lib/batalha/mecanica/resumo'
import { DANO_MAX, NOME_DO_SELO_MAX, TURNOS_DO_SELO_MAX } from '../../../../lib/batalha/combate'
import { CampoInteiro, Escolha, Texto } from '../../blocos/controles'
import type { MudarNoEditor } from '../mudarNoEditor'

type EscolhaDoTipo = TipoComRegra<TipoDoGolpe>

/** O que a tela muda numa regra (cada tipo usa os seus). */
interface MudancaNaRegra {
  quando?: QuandoOTipoPega
  teste?: TesteDoTipo
  vezes?: number
  casas?: number
  porVez?: number
  porcento?: number
  forca?: number
  dano?: number
  nome?: string
}

const QUANDO_PEGA: readonly { valor: QuandoOTipoPega; rotulo: string }[] = [
  { valor: 'sempre', rotulo: 'Sempre que acertar' },
  { valor: 'teste', rotulo: 'Com teste' },
  { valor: 'soTipo', rotulo: 'Só o tipo, sem efeito' },
]

/** O teto do "por cento que passa o Escudo" e do "quanto cai" do Enfraquecer. */
const PORCENTO_MAX = 100

function regraQuePoe(regra: RegraQuePoeCondicao, mudanca: MudancaNaRegra): RegraQuePoeCondicao {
  const quando = mudanca.quando ?? regra.quando
  // O teste só existe no "com teste"; voltar a ele traz o de antes (ou o de partida).
  const teste = quando === 'teste' ? (mudanca.teste ?? regra.teste ?? TESTE_DO_TIPO_DE_PARTIDA) : undefined
  return { quando, vezes: mudanca.vezes ?? regra.vezes, ...(teste === undefined ? {} : { teste }) }
}

/** A escolha com a regra mudada, no tipo dela. */
function comMudanca(escolha: EscolhaDoTipo, mudanca: MudancaNaRegra): EscolhaDoTipo {
  switch (escolha.tipo) {
    case 'perfurante':
      return { tipo: 'perfurante', regra: { porcento: mudanca.porcento ?? escolha.regra.porcento } }
    case 'impacto':
      return { tipo: 'impacto', regra: { ...regraQuePoe(escolha.regra, mudanca), casas: mudanca.casas ?? escolha.regra.casas } }
    case 'congelamento':
      return { tipo: 'congelamento', regra: { ...regraQuePoe(escolha.regra, mudanca), casas: mudanca.casas ?? escolha.regra.casas } }
    case 'cortante':
      return { tipo: 'cortante', regra: { ...regraQuePoe(escolha.regra, mudanca), porVez: mudanca.porVez ?? escolha.regra.porVez } }
    case 'queimadura':
      return { tipo: 'queimadura', regra: { ...regraQuePoe(escolha.regra, mudanca), porVez: mudanca.porVez ?? escolha.regra.porVez } }
    case 'veneno':
      return { tipo: 'veneno', regra: { ...regraQuePoe(escolha.regra, mudanca), porVez: mudanca.porVez ?? escolha.regra.porVez } }
    case 'choque':
      return { tipo: 'choque', regra: { ...regraQuePoe(escolha.regra, mudanca), porVez: mudanca.porVez ?? escolha.regra.porVez } }
    case 'cegueira':
      return { tipo: 'cegueira', regra: regraQuePoe(escolha.regra, mudanca) }
    case 'enfraquecer':
      return { tipo: 'enfraquecer', regra: { ...regraQuePoe(escolha.regra, mudanca), forca: mudanca.forca ?? escolha.regra.forca, dano: mudanca.dano ?? escolha.regra.dano } }
    case 'outro':
      return { tipo: 'outro', regra: { ...regraQuePoe(escolha.regra, mudanca), nome: mudanca.nome ?? escolha.regra.nome, porVez: mudanca.porVez ?? escolha.regra.porVez } }
  }
}

/** O tipo novo com a regra de partida (os padrões aprovados no protótipo). */
function tipoQueBateNovo(tipo: TipoQueBate): TipoComRegra<TipoQueBate> {
  switch (tipo) {
    case 'impacto':
      return { tipo, regra: REGRA_DE_PARTIDA.impacto }
    case 'cortante':
      return { tipo, regra: REGRA_DE_PARTIDA.cortante }
    case 'perfurante':
      return { tipo, regra: REGRA_DE_PARTIDA.perfurante }
  }
}

function tipoQueCausaNovo(tipo: TipoQueCausa): TipoComRegra<TipoQueCausa> {
  switch (tipo) {
    case 'queimadura':
      return { tipo, regra: REGRA_DE_PARTIDA.queimadura }
    case 'veneno':
      return { tipo, regra: REGRA_DE_PARTIDA.veneno }
    case 'congelamento':
      return { tipo, regra: REGRA_DE_PARTIDA.congelamento }
    case 'choque':
      return { tipo, regra: REGRA_DE_PARTIDA.choque }
    case 'cegueira':
      return { tipo, regra: REGRA_DE_PARTIDA.cegueira }
    case 'enfraquecer':
      return { tipo, regra: REGRA_DE_PARTIDA.enfraquecer }
    case 'outro':
      return { tipo, regra: REGRA_DE_PARTIDA.outro }
  }
}

function ehQueBate(escolha: EscolhaDoTipo): escolha is TipoComRegra<TipoQueBate> {
  return escolha.tipo === 'impacto' || escolha.tipo === 'cortante' || escolha.tipo === 'perfurante'
}

/** A mecânica com o golpe novo; sem tipo nenhum, a chave sai (a técnica volta a caber na versão de antes). */
function comGolpe(mecanica: MecanicaV1, golpe: GolpeDaMecanica): MecanicaV1 {
  const { golpe: _antes, ...sem } = mecanica
  const causa = golpe.causa === undefined || golpe.causa.length === 0 ? undefined : golpe.causa
  if (golpe.bate === undefined && causa === undefined) return sem
  return { ...sem, golpe: { ...(golpe.bate === undefined ? {} : { bate: golpe.bate }), ...(causa === undefined ? {} : { causa }) } }
}

/** Quantas condições o golpe põe: os tipos que pegam (o Perfurante e o "só o tipo" não) e os selos dos Efeitos no alvo. */
function condicoesNoGolpe(mecanica: MecanicaV1): number {
  const { bate, causa = [] } = mecanica.golpe ?? {}
  const tipos = [...(bate === undefined || bate.tipo === 'perfurante' ? [] : [bate]), ...causa].filter((escolha) => escolha.regra.quando !== 'soTipo')
  return tipos.length + mecanica.efeitos.filter((efeito) => efeito.tipo === 'selo' && efeito.em === undefined).length
}

/**
 * O que a batalha ainda não faz com este tipo (EDITOR.md §4, fase ED4): o teste para pegar e a
 * reação com desvantagem do Congelado. `null` = o app já faz.
 */
function chegaDepois(escolha: EscolhaDoTipo): string | null {
  if (escolha.tipo === 'perfurante' || escolha.regra.quando === 'soTipo') return null
  if (escolha.regra.quando === 'teste') return 'O teste para pegar chega na próxima fase'
  return escolha.tipo === 'congelamento' ? 'O Congelado chega na próxima fase' : null
}

interface RegraDoTipoProps {
  escolha: EscolhaDoTipo
  frase: string
  ficha: FichaDaPrevia
  onMudar: (mudanca: MudancaNaRegra) => void
  onTirar: () => void
}

/** Um tipo escolhido: o que faz em frase, os números dele, quando pega e o teste. */
function RegraDoTipo({ escolha, frase, ficha, onMudar, onTirar }: RegraDoTipoProps) {
  const nome = NOME_DO_TIPO[escolha.tipo]
  const depois = chegaDepois(escolha)
  const atributos = ficha.sistema.atributos
  return (
    <div className="lb-ed__regra" data-tipo={escolha.tipo}>
      <div className="lb-ed__regra-cab">
        <span className="lb-ed__regra-tit">{nome}</span>
        <span className="lb-ed__etq" data-c={depois === null ? 'auto' : 'depois'} title={depois ?? 'O motor da batalha já faz isto'}>
          {depois === null ? 'o app já faz' : 'chega na próxima fase'}
        </span>
        <button type="button" className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p lb-ed__bt--ic" aria-label={`Tirar ${nome}`} onClick={onTirar}>
          ×
        </button>
      </div>
      <p className="lb-ed__dica lb-ed__regra-frase">{frase}</p>
      <div className="lb-ed__regra-faz">
        {escolha.tipo === 'perfurante' ? (
          <CampoInteiro rotulo="Passa" valor={escolha.regra.porcento} minimo={1} maximo={PORCENTO_MAX} depois="% do dano direto no HP" onChange={(porcento) => onMudar({ porcento })} />
        ) : (
          escolha.regra.quando !== 'soTipo' && (
            <>
              {escolha.tipo === 'outro' && <Texto rotulo="Nome" valor={escolha.regra.nome} maximo={NOME_DO_SELO_MAX} placeholder="Marcado" onChange={(nomeDoSelo) => onMudar({ nome: nomeDoSelo })} />}
              <CampoInteiro rotulo="Dura" valor={escolha.regra.vezes} minimo={1} maximo={TURNOS_DO_SELO_MAX} depois={escolha.regra.vezes === 1 ? 'vez dele' : 'vezes dele'} onChange={(vezes) => onMudar({ vezes })} />
              {(escolha.tipo === 'cortante' || escolha.tipo === 'queimadura' || escolha.tipo === 'veneno' || escolha.tipo === 'outro') && (
                <CampoInteiro rotulo="Tira" valor={escolha.regra.porVez} minimo={escolha.tipo === 'outro' ? 0 : 1} maximo={DANO_MAX} depois="de HP por vez" onChange={(porVez) => onMudar({ porVez })} />
              )}
              {escolha.tipo === 'choque' && <CampoInteiro rotulo="Tira" valor={escolha.regra.porVez} minimo={1} maximo={DANO_MAX} depois="de SP por vez" onChange={(porVez) => onMudar({ porVez })} />}
              {escolha.tipo === 'congelamento' && <CampoInteiro rotulo="Alcance" valor={escolha.regra.casas} minimo={1} maximo={CASAS_MAX} depois="casas a menos" onChange={(casas) => onMudar({ casas })} />}
              {escolha.tipo === 'enfraquecer' && (
                <>
                  <CampoInteiro rotulo="Força −" valor={escolha.regra.forca} minimo={0} maximo={DANO_MAX} onChange={(forca) => onMudar({ forca })} />
                  <CampoInteiro rotulo="Dano −" valor={escolha.regra.dano} minimo={0} maximo={DANO_MAX} onChange={(dano) => onMudar({ dano })} />
                </>
              )}
            </>
          )
        )}
        {escolha.tipo === 'impacto' && <CampoInteiro rotulo="Empurra" valor={escolha.regra.casas} minimo={0} maximo={CASAS_MAX} depois="casas (o mestre move a ficha)" onChange={(casas) => onMudar({ casas })} />}
      </div>
      {escolha.tipo !== 'perfurante' && (
        <div className="lb-ed__regra-quando">
          <Escolha<QuandoOTipoPega> legenda={`Quando ${nome} pega`} opcoes={QUANDO_PEGA} valor={escolha.regra.quando} onChange={(quando) => onMudar({ quando })} />
          {escolha.regra.quando === 'teste' && (
            <div className="lb-mec__linha">
              <span className="lb-mec__numero">
                <label className="lb-mec__numero-rotulo">
                  O alvo testa{' '}
                  <select
                    className="lb-input lb-ed__sel"
                    value={escolha.regra.teste?.atributo ?? TESTE_DO_TIPO_DE_PARTIDA.atributo}
                    onChange={(evento) => onMudar({ teste: { atributo: evento.target.value, cd: escolha.regra.teste?.cd ?? TESTE_DO_TIPO_DE_PARTIDA.cd } })}
                  >
                    {!atributos.some((atributo) => atributo.id === (escolha.regra.teste?.atributo ?? TESTE_DO_TIPO_DE_PARTIDA.atributo)) && <option value={escolha.regra.teste?.atributo ?? TESTE_DO_TIPO_DE_PARTIDA.atributo}>{escolha.regra.teste?.atributo ?? TESTE_DO_TIPO_DE_PARTIDA.atributo}</option>}
                    {atributos.map((atributo) => (
                      <option key={atributo.id} value={atributo.id}>
                        {atributo.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </span>
              <CampoInteiro
                rotulo="contra CD"
                valor={escolha.regra.teste !== undefined && 'fixo' in escolha.regra.teste.cd ? escolha.regra.teste.cd.fixo : 12}
                minimo={1}
                maximo={CD_MAX}
                depois="; falhou, pega"
                onChange={(cd) => onMudar({ teste: { atributo: escolha.regra.teste?.atributo ?? TESTE_DO_TIPO_DE_PARTIDA.atributo, cd: { fixo: cd } } })}
              />
            </div>
          )}
        </div>
      )}
      {depois !== null && <p className="lb-ed__depois">{depois} (ED4). Até lá, na batalha, esta técnica vai à mão: o mestre aplica. Aqui ela já fica guardada.</p>}
    </div>
  )
}

/**
 * LINHA GOLPE (EDITOR.md §3.1 e §3.2; protótipo `htmlGolpe`): como bate (um só) e o que causa
 * (vários, até o teto de condições no mesmo golpe). Grava a ESCOLHA na mecânica (`golpe`, versão
 * 4); quem a vira peças é a leitura do motor (`pecasParaOMotor`), nunca o editor.
 */
export function LinhaDoGolpe({ mecanica, ficha, onChange }: { mecanica: MecanicaV1; ficha: FichaDaPrevia; onChange: MudarNoEditor }) {
  const rotuloId = useId()
  const golpe = mecanica.golpe ?? {}
  const causa = golpe.causa ?? []
  const cheio = condicoesNoGolpe(mecanica) >= SELOS_NO_GOLPE_MAX
  const frases = useMemo(() => frasesDoGolpe(mecanica, ficha), [mecanica, ficha])
  // O que a batalha lê hoje: o motivo de ir à mão (o teste para pegar, o Congelado, o teto) aparece sem esconder.
  const motor = useMemo(() => pecasParaOMotor(mecanica), [mecanica])
  const escolhidos: EscolhaDoTipo[] = [...(golpe.bate === undefined ? [] : [golpe.bate]), ...causa]

  const trocarBate = (tipo: TipoQueBate) => onChange(comGolpe(mecanica, { ...golpe, bate: golpe.bate?.tipo === tipo ? undefined : tipoQueBateNovo(tipo) }))
  const trocarCausa = (tipo: TipoQueCausa) => {
    const tem = causa.some((escolha) => escolha.tipo === tipo)
    if (!tem && cheio) return
    onChange(comGolpe(mecanica, { ...golpe, causa: tem ? causa.filter((escolha) => escolha.tipo !== tipo) : [...causa, tipoQueCausaNovo(tipo)] }))
  }
  const mudar = (escolha: EscolhaDoTipo, mudanca: MudancaNaRegra) => {
    const nova = comMudanca(escolha, mudanca)
    if (ehQueBate(nova)) onChange(comGolpe(mecanica, { ...golpe, bate: nova }))
    else onChange(comGolpe(mecanica, { ...golpe, causa: causa.map((atual) => (atual.tipo === nova.tipo ? nova : atual)) }))
  }
  const tirar = (escolha: EscolhaDoTipo) => (ehQueBate(escolha) ? trocarBate(escolha.tipo) : trocarCausa(escolha.tipo))

  return (
    <>
      <div className="lb-ed__tipos-linha">
        <span className="lb-ed__rot" id={`${rotuloId}-bate`}>
          Como bate
        </span>
        <div className="lb-ed__tipos" role="group" aria-labelledby={`${rotuloId}-bate`}>
          {TIPOS_QUE_BATEM.map((tipo) => (
            <button key={tipo} type="button" className="lb-ed__tipo" aria-pressed={golpe.bate?.tipo === tipo} data-tipo={tipo} onClick={() => trocarBate(tipo)}>
              {NOME_DO_TIPO[tipo]}
            </button>
          ))}
        </div>
      </div>
      <div className="lb-ed__tipos-linha">
        <span className="lb-ed__rot" id={`${rotuloId}-causa`}>
          O que causa
        </span>
        <div className="lb-ed__tipos" role="group" aria-labelledby={`${rotuloId}-causa`}>
          {TIPOS_QUE_CAUSAM.map((tipo) => {
            const marcado = causa.some((escolha) => escolha.tipo === tipo)
            const travado = !marcado && cheio
            return (
              <button
                key={tipo}
                type="button"
                className="lb-ed__tipo"
                aria-pressed={marcado}
                aria-disabled={travado || undefined}
                title={travado ? `Até ${SELOS_NO_GOLPE_MAX} condições no mesmo golpe` : undefined}
                data-tipo={tipo}
                onClick={() => trocarCausa(tipo)}
              >
                {NOME_DO_TIPO[tipo]}
              </button>
            )
          })}
        </div>
      </div>
      {escolhidos.length === 0 ? (
        <p className="lb-ed__vazio">O golpe ainda não tem tipo. Escolha como bate e o que causa; cada um já vem com uma regra que dá para mudar. Sem tipo, ele só dá o dano.</p>
      ) : (
        <div className="lb-ed__regras">
          {escolhidos.map((escolha, indice) => (
            <RegraDoTipo key={escolha.tipo} escolha={escolha} frase={frases[indice] ?? ''} ficha={ficha} onMudar={(mudanca) => mudar(escolha, mudanca)} onTirar={() => tirar(escolha)} />
          ))}
        </div>
      )}
      {cheio && <p className="lb-ed__dica">Este golpe já põe {SELOS_NO_GOLPE_MAX} condições: o máximo num golpe só. Para outra, mude um tipo para "Só o tipo, sem efeito".</p>}
      {motor.tipo === 'invalida' && escolhidos.every((escolha) => chegaDepois(escolha) === null) && (
        <p className="lb-ed__depois" role="note">
          Na batalha, por enquanto, esta técnica vai à mão: {motor.motivo}.
        </p>
      )}
    </>
  )
}
