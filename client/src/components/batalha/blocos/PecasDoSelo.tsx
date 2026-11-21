import { useId } from 'react'
import { DANO_MAX, MODS_POR_SELO_MAX, NOME_DO_SELO_MAX, TURNOS_DO_SELO_MAX } from '../../../lib/batalha/combate'
import { comportamentoDoSelo, SELOS_COM_REGRA } from '../../../lib/batalha/condicoes'
import { ATRIBUTO_MAX, FORMULA_MAX, type Efeito, type ModDaPeca, type NumeroSimples, type RegraDoSelo } from '../../../lib/batalha/mecanica/modelo'
import { frasesDoSelo, type FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import { SELOS_PRONTOS } from '../../../lib/batalha/selos'
import { CampoInteiro, Escolha, Marcar, Texto, type Opcao } from './controles'

/**
 * O SELO DA PEÇA (construtor C5; fase 5 de SISTEMA.md): o nome (pronto com
 * regra ou livre), em quem cai, os números que soma ("Força +20"), a regra
 * própria (dano e cura recebidos), o que mexe por vez (tira HP pelo lembrete,
 * tira SP no fim da vez com o dreno, ou regenera) e por quanto tempo. A regra
 * do nome (`condicoes.ts`) continua valendo, então a frase muda enquanto o
 * mestre digita.
 */

export type SeloDaPeca = Extract<Efeito, { tipo: 'selo' }>
type ComoDura = 'vezes' | 'proximoGolpe' | 'ateTirar'
type EmQuemDoSelo = 'alvo' | 'quemUsa' | 'atacante'
type PorVez = 'nada' | 'tiraHp' | 'tiraSp' | 'daHp' | 'daSp'

/** O selo sem uma das chaves opcionais. */
function semChave<K extends 'porTurno' | 'em' | 'mods' | 'regra'>(selo: SeloDaPeca, chave: K): Omit<SeloDaPeca, K> {
  const { [chave]: _fora, ...resto } = selo
  return resto
}

function porVezDo(selo: SeloDaPeca): PorVez {
  const porTurno = selo.porTurno
  if (porTurno === undefined) return 'nada'
  if (porTurno.sinal === 'da') return porTurno.recurso === 'hp' ? 'daHp' : 'daSp'
  return porTurno.recurso === 'hp' ? 'tiraHp' : 'tiraSp'
}

const POR_VEZ: readonly Opcao<PorVez>[] = [
  { valor: 'nada', rotulo: 'Nada' },
  { valor: 'tiraHp', rotulo: 'Tira HP' },
  { valor: 'tiraSp', rotulo: 'Tira SP' },
  { valor: 'daHp', rotulo: 'Regenera HP' },
  { valor: 'daSp', rotulo: 'Regenera SP' },
]

/** O "por vez" novo, com o número que já havia (ou 10). */
function porTurnoNovo(como: Exclude<PorVez, 'nada'>, fixo: number): NonNullable<SeloDaPeca['porTurno']> {
  const recurso = como === 'tiraHp' || como === 'daHp' ? 'hp' : 'sp'
  return como === 'daHp' || como === 'daSp' ? { recurso, quanto: { fixo }, direto: true, sinal: 'da' } : { recurso, quanto: { fixo }, direto: true }
}

const FRASE_DO_POR_VEZ: Readonly<Record<Exclude<PorVez, 'nada'>, string>> = {
  tiraHp: 'de HP no começo de cada vez dele, direto (o mestre clica Aplicar)',
  tiraSp: 'de SP no fim de cada vez dele',
  daHp: 'de HP no fim de cada vez dele',
  daSp: 'de SP no fim de cada vez dele',
}

/** "20", "-20" = número fixo; outro texto = fórmula na ficha de quem usa ("Força * 0,1"). */
export function deltaDoTexto(texto: string): NumeroSimples {
  const limpo = texto.trim()
  if (/^[-+]?\d+$/.test(limpo)) {
    const valor = Number(limpo)
    if (Math.abs(valor) <= DANO_MAX) return { fixo: valor }
  }
  return { formula: texto }
}

export function textoDoDelta(delta: NumeroSimples): string {
  return 'fixo' in delta ? (delta.fixo > 0 ? `+${delta.fixo}` : String(delta.fixo)) : delta.formula
}

/** Um número do selo: o que muda (atributo da ficha, o dano ou a reação) e quanto. */
function NumeroDoSelo({ mod, indice, ficha, onChange, onTirar }: { mod: ModDaPeca; indice: number; ficha: FichaDaPrevia; onChange: (mod: ModDaPeca) => void; onTirar: () => void }) {
  const id = useId()
  const opcoes = [...ficha.sistema.atributos.map((atributo) => ({ valor: atributo.id, rotulo: atributo.nome })), { valor: 'dano', rotulo: 'Dano' }, { valor: 'reacao', rotulo: 'Reação' }]
  return (
    <div className="lb-mec__linha lb-mec__linha--recuo">
      <span className="lb-mec__texto">
        <label className="lb-mec__numero-rotulo" htmlFor={id}>
          {`Número ${indice + 1}`}
        </label>
        <select id={id} className="lb-input" value={mod.alvo} onChange={(event) => onChange({ ...mod, alvo: event.target.value.slice(0, ATRIBUTO_MAX) })}>
          {opcoes.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
      </span>
      <Texto rotulo="Quanto" valor={textoDoDelta(mod.delta)} maximo={FORMULA_MAX} placeholder="Ex.: +20 ou -10" onChange={(texto) => onChange({ ...mod, delta: deltaDoTexto(texto) })} />
      <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" aria-label={`Tirar o número ${indice + 1} do selo`} onClick={onTirar}>
        ×
      </button>
    </div>
  )
}

/** A regra de partida: toma 20% a menos de dano; a cura recebida cai pela metade. */
const DANO_RECEBIDO_DE_PARTIDA = -20
const CURA_RECEBIDA_DE_PARTIDA = -50
/** Teto da regra do selo (+200% = toma o triplo), o mesmo da leitura. */
const REGRA_MAX = 200

function RegraDaPeca({ selo, onChange }: { selo: SeloDaPeca; onChange: (selo: SeloDaPeca) => void }) {
  const regra = selo.regra ?? {}
  const trocar = (nova: RegraDoSelo) => onChange(nova.danoRecebido === undefined && nova.curaRecebida === undefined ? semChave(selo, 'regra') : { ...selo, regra: nova })
  const semUma = (chave: 'danoRecebido' | 'curaRecebida'): RegraDoSelo => {
    const { [chave]: _fora, ...resto } = regra
    return resto
  }
  return (
    <>
      <Marcar rotulo="Muda o dano que quem tem o selo recebe" marcado={regra.danoRecebido !== undefined} onChange={(sim) => trocar(sim ? { ...regra, danoRecebido: DANO_RECEBIDO_DE_PARTIDA } : semUma('danoRecebido'))} />
      {regra.danoRecebido !== undefined && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Dano recebido" valor={regra.danoRecebido} minimo={-100} maximo={REGRA_MAX} depois="% (−20 = toma 20% a menos; +50 = 50% a mais)" onChange={(danoRecebido) => trocar({ ...regra, danoRecebido })} />
        </div>
      )}
      <Marcar rotulo="Muda a cura que quem tem o selo recebe" marcado={regra.curaRecebida !== undefined} onChange={(sim) => trocar(sim ? { ...regra, curaRecebida: CURA_RECEBIDA_DE_PARTIDA } : semUma('curaRecebida'))} />
      {regra.curaRecebida !== undefined && (
        <div className="lb-mec__linha lb-mec__linha--recuo">
          <CampoInteiro rotulo="Cura recebida" valor={regra.curaRecebida} minimo={-100} maximo={REGRA_MAX} depois="% (−50 = metade)" onChange={(curaRecebida) => trocar({ ...regra, curaRecebida })} />
        </div>
      )}
    </>
  )
}

interface PecasDoSeloProps {
  selo: SeloDaPeca
  /** O golpe é de ajuda (aliado ou em si): o selo pronto com regra (Atordoado...) não aparece. */
  ajuda: boolean
  /** Fase 4: em quem o selo pode cair, pelo "Quando usa" (só na reação = só em quem atacou). */
  emQuemPode: readonly EmQuemDoSelo[]
  /** Por que "em quem usa" não pode agora (já há outro selo nele); `null` = pode. */
  bloqueioEmQuemUsa: string | null
  listaId: string
  ficha: FichaDaPrevia
  onChange: (selo: SeloDaPeca) => void
}

const ROTULO_DE_EM_QUEM: Readonly<Record<EmQuemDoSelo, string>> = { alvo: 'No alvo', quemUsa: 'Em quem usa', atacante: 'Em quem atacou (só quando reage)' }

export function PecasDoSelo({ selo, ajuda, emQuemPode, bloqueioEmQuemUsa, listaId, ficha, onChange }: PecasDoSeloProps) {
  const regra = comportamentoDoSelo(selo.nome)
  const pronto = regra === null ? undefined : SELOS_COM_REGRA.find((nome) => comportamentoDoSelo(nome) === regra)
  const frases = frasesDoSelo(selo, ficha)
  const daRegra = regra?.porVez
  const porVez = porVezDo(selo)
  const como: ComoDura = typeof selo.duracao === 'number' ? 'vezes' : selo.duracao
  const mods = selo.mods ?? []
  const em: EmQuemDoSelo = selo.em ?? 'alvo'
  const trocarMods = (novos: readonly ModDaPeca[]) => onChange(novos.length === 0 ? semChave(selo, 'mods') : { ...selo, mods: novos })
  const primeiroAtributo = ficha.sistema.atributos.at(0)?.id ?? 'dano'
  const tira = selo.porTurno
  return (
    <div className="lb-mec__selo">
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
          onChange={(nome) => onChange(semChave({ ...selo, nome: nome === 'outro' ? '' : nome }, 'porTurno'))}
        />
      )}
      <div className="lb-mec__linha">
        <Texto rotulo="Nome do selo" valor={selo.nome} maximo={NOME_DO_SELO_MAX} lista={listaId} placeholder="Ex.: Envenenado" onChange={(nome) => onChange({ ...selo, nome })} />
      </div>
      <p className="lb-field__hint lb-mec__regra">{frases.length === 0 ? 'Sem regra própria: o app só mostra o selo na carta.' : `O que faz: ${frases.join('; ')}.`}</p>
      {emQuemPode.length > 1 && (
        <Escolha<EmQuemDoSelo>
          legenda="Em quem cai"
          opcoes={emQuemPode.map((valor) => ({ valor, rotulo: valor === 'alvo' && ajuda ? 'Em quem recebe' : ROTULO_DE_EM_QUEM[valor], bloqueio: valor === 'quemUsa' && em !== 'quemUsa' ? bloqueioEmQuemUsa : null }))}
          valor={em}
          onChange={(novo) => onChange(novo === 'alvo' ? semChave(selo, 'em') : { ...selo, em: novo })}
        />
      )}
      {mods.map((mod, indice) => (
        <NumeroDoSelo key={`${indice}-${mods.length}`} mod={mod} indice={indice} ficha={ficha} onChange={(novo) => trocarMods(mods.map((atual, j) => (j === indice ? novo : atual)))} onTirar={() => trocarMods(mods.filter((_, j) => j !== indice))} />
      ))}
      {mods.length < MODS_POR_SELO_MAX && (
        <button type="button" className="lb-btn lb-btn--compact lb-mec__mais" onClick={() => trocarMods([...mods, { alvo: primeiroAtributo, delta: { fixo: 20 } }])}>
          + Número (Força +20, Dano -10)
        </button>
      )}
      {mods.length > 0 && <p className="lb-field__hint lb-mec__regra">O número entra na conta de quem tem o selo enquanto ele durar; negativo tira.</p>}
      <RegraDaPeca selo={selo} onChange={onChange} />
      {daRegra !== undefined && regra !== null ? (
        <p className="lb-field__hint lb-mec__regra">{`${regra.nome} sempre tira ${daRegra} de HP por vez, pelo nome.`}</p>
      ) : (
        <div className="lb-mec__linha">
          <Escolha<PorVez> legenda="A cada vez" opcoes={POR_VEZ} valor={porVez} onChange={(novo) => onChange(novo === 'nada' ? semChave(selo, 'porTurno') : { ...selo, porTurno: porTurnoNovo(novo, tira?.quanto.fixo ?? 10) })} />
          {tira !== undefined && porVez !== 'nada' && (
            <CampoInteiro rotulo={porVez === 'daHp' || porVez === 'daSp' ? 'Ganha' : 'Tira'} valor={tira.quanto.fixo} minimo={1} maximo={DANO_MAX} depois={FRASE_DO_POR_VEZ[porVez]} onChange={(fixo) => onChange({ ...selo, porTurno: { ...tira, quanto: { fixo } } })} />
          )}
          {tira !== undefined && porVez === 'tiraSp' && (
            <CampoInteiro
              rotulo="Quem usou ganha"
              valor={tira.paraQuemUsa ?? 0}
              minimo={0}
              maximo={DANO_MAX}
              depois="de SP por vez (0 = nada)"
              onChange={(paraQuemUsa) => {
                const { paraQuemUsa: _antes, ...semDreno } = tira
                onChange({ ...selo, porTurno: paraQuemUsa === 0 ? semDreno : { ...semDreno, paraQuemUsa } })
              }}
            />
          )}
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
