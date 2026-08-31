import type { ReactNode } from 'react'
import { MenuShell } from './MenuShell'
import { Toggle } from '../components/Toggle'

interface OptionsScreenProps {
  onBack: () => void
}

interface OptionRowProps {
  label: string
  hint?: string
  children: ReactNode
}

/** Linha "rótulo à esquerda, controle à direita" — repetida nas 5 seções. */
function OptionRow({ label, hint, children }: OptionRowProps) {
  return (
    <div className="lb-optionrow">
      <span className="lb-optionrow__text">
        <span className="lb-optionrow__label">{label}</span>
        {hint && <span className="lb-optionrow__hint">{hint}</span>}
      </span>
      <span className="lb-optionrow__control">{children}</span>
    </div>
  )
}

interface SegOption {
  label: string
  checked: boolean
}

/**
 * Segmentado estático — mesma pinta visual do `.lb-seg` usado em
 * `GridShapePicker`, mas sem estado: o `<fieldset disabled>` do pai já tira
 * todo botão descendente do tab order e suprime o clique, então não há
 * `onChange` para ligar.
 */
function StaticSeg({ groupLabel, options }: { groupLabel: string; options: SegOption[] }) {
  return (
    <div className="lb-seg" role="radiogroup" aria-label={groupLabel}>
      {options.map((option) => (
        <button key={option.label} type="button" role="radio" aria-checked={option.checked} className="lb-seg__option">
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Roadmap navegável de conectividade — cinco `<fieldset disabled>`, zero
 * `useState`. O desabilitado vem de herança de `<fieldset>` (especificação
 * HTML: todo controle descendente, exceto o que estiver dentro do
 * `<legend>`, fica desabilitado automaticamente), não de uma prop `disabled`
 * espalhada por `Toggle`/inputs — então esta tela não tem estado para
 * "esquecer" de desabilitar em algum canto.
 *
 * Cuidado que qualquer edição futura aqui precisa preservar: nunca `value`
 * sem `onChange` (warning do React) — os inputs usam `defaultValue`/
 * `placeholder`/`readOnly`, e o `Toggle` (controlado) usa
 * `checked={x} onChange={() => {}}`.
 */
export function OptionsScreen({ onBack }: OptionsScreenProps) {
  return (
    <MenuShell title="Opções" onBack={onBack} wide crumbs={['Labirinto']}>
      <div className="lb-options">
        <fieldset className="lb-optiongroup lb-card" disabled>
          <legend className="lb-optiongroup__legend">
            <span className="lb-eyebrow">Sala e jogadores</span>
            <span className="lb-badge">Fase 1</span>
          </legend>

          <OptionRow label="Modo de sessão">
            <StaticSeg
              groupLabel="Modo de sessão"
              options={[
                { label: 'Local (LAN)', checked: true },
                { label: 'Servidor remoto', checked: false },
              ]}
            />
          </OptionRow>

          <OptionRow label="Endereço do servidor">
            <input className="lb-input" placeholder="ws://192.168.0.10:8080" readOnly />
          </OptionRow>

          <OptionRow label="Código da sala">
            <input className="lb-input" placeholder="——————" readOnly />
          </OptionRow>

          <OptionRow label="Nome de exibição do mestre">
            <input className="lb-input" placeholder="Mestre" readOnly />
          </OptionRow>

          <OptionRow
            label="Jogadores movem os próprios tokens"
            hint="O servidor valida cada movimento; parede com bloqueio de passagem trava o token."
          >
            <Toggle label="" checked={false} onChange={() => {}} />
          </OptionRow>
        </fieldset>

        <fieldset className="lb-optiongroup lb-card" disabled>
          <legend className="lb-optiongroup__legend">
            <span className="lb-eyebrow">Tela dos jogadores</span>
            <span className="lb-badge">Ideia</span>
          </legend>

          <OptionRow
            label="Abrir segunda janela para os jogadores"
            hint="Segundo monitor ou TV mostrando só o que os jogadores podem ver. Ideia sua, ainda fora do plano aprovado."
          >
            <Toggle label="" checked={false} onChange={() => {}} />
          </OptionRow>
        </fieldset>

        <fieldset className="lb-optiongroup lb-card" disabled>
          <legend className="lb-optiongroup__legend">
            <span className="lb-eyebrow">Personagens (Google Drive)</span>
            <span className="lb-badge">Fase 1</span>
          </legend>

          <OptionRow label='ID da pasta "RPG - Personagens"'>
            <input className="lb-input" placeholder="ID da pasta" readOnly />
          </OptionRow>

          <OptionRow label="Sincronização" hint="Sincronização sob demanda, com cache local — sem verificação automática.">
            <button type="button" className="lb-btn">
              Sincronizar agora
            </button>
          </OptionRow>
        </fieldset>

        <fieldset className="lb-optiongroup lb-card" disabled>
          <legend className="lb-optiongroup__legend">
            <span className="lb-eyebrow">Link de Cenário (Obsidian)</span>
            <span className="lb-badge">Fase 1</span>
          </legend>

          <OptionRow label="Nome do vault">
            <input className="lb-input" placeholder="Meu Vault" readOnly />
          </OptionRow>

          <OptionRow
            label="Visível apenas para o mestre"
            hint="Monta obsidian://open?vault=<vault>&file=<caminho>.md. Nunca enviado aos jogadores."
          >
            <Toggle label="" checked={true} onChange={() => {}} />
          </OptionRow>
        </fieldset>

        <fieldset className="lb-optiongroup lb-card" disabled>
          <legend className="lb-optiongroup__legend">
            <span className="lb-eyebrow">Névoa e Iluminação</span>
            <span className="lb-badge">Fase 3</span>
          </legend>

          <OptionRow label="Modo de névoa">
            <StaticSeg
              groupLabel="Modo de névoa"
              options={[
                { label: 'Desligada', checked: true },
                { label: 'Por token', checked: false },
              ]}
            />
          </OptionRow>

          <OptionRow
            label="Permissões"
            hint="O campo já existe no arquivo do mapa (fog.mode); cálculo real e iluminação dinâmica são Fase 3."
          >
            <button type="button" className="lb-btn">
              Configurar permissões...
            </button>
          </OptionRow>
        </fieldset>

        <p className="lb-options__note">Nada nesta tela é salvo ainda — é o roadmap, não um formulário.</p>
      </div>
    </MenuShell>
  )
}
