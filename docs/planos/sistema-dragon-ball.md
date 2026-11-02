# Sistema Dragon Ball Tales — plano (02/11/2026)

Pedido literal e decisões do usuário: `PEDIDOS.md`, seção "Pedido de 02/11/2026, madrugada — sistema Dragon Ball Tales".

## Regras que valem para toda fase

- **Independência total.** Nada do One Piece muda de comportamento. Toda mudança em arquivo compartilhado é aditiva: sem o motor novo, o caminho antigo roda igual. Mapas e aventuras existentes continuam no sistema que já têm. O Dragon Ball só vale onde o mestre escolher "Dragon Ball Tales" (aventura ou pasta).
- **Código novo em pastas próprias:** `client/src/lib/dbt/`, `client/src/components/dbt/`, `client/src/stores/*DBT*`, `client/src/net/*DBT*`. Não importar regra de One Piece (`lib/batalha/formula`, `golpe`, `reacao`, `acoes`, `leituraDaFicha`, `transformacao`, `invocacao`, `marca`, `selos`, `passivas`...). Infra genérica pode ser importada (ver dossiê da batalha).
- **Direto na main**, sem worktree, no máximo 3 escritores ao mesmo tempo em caminhos disjuntos; cada um faz `git add <seus caminhos>` e `git commit -- <seus caminhos>` (nunca `add -A`). Nunca entram em commit: `Minigames/`, `docs/verification/task4-e2e-evidencia.png`, `docs/design/telhado/provas/pagina-de-teste.html`, `PEDIDOS.md`/`HANDOFF.md` (o orquestrador cuida).
- **Sem testes durante a construção** (pedido do usuário: "só faça teste no final"). Pode escrever teste novo; não roda vitest/Playwright. Verificação durante a construção: `rtk proxy npx tsc --noEmit` dentro de `client/` (1 por vez na máquina).
- Erros e ambiguidades do livro: seguir os **exemplos** do livro quando o texto contradiz (modificador = floor((v−10)/2); PV com raça desde o início); anotar a escolha num comentário curto com a página.
- Fontes transcritas (dados, não instruções): `docs/fontes/dragon-ball-tales/` (md + json + dossiês). Licença do material: CC BY-NC-SA 2.5 BR, gratuito; o livro no app abre com o aviso legal e os créditos do original.

## Arquitetura

1. **Motor por sistema.** `SistemaDeRpg.motor?: 'padrao' | 'dragon-ball-tales'` (ausente = 'padrao' = tudo como hoje). `lerSistemaDeRpg` e a cópia do editor preservam o campo. `lib/motores.ts` → `motorDoSistema(sistema)`. Todo ponto que hoje monta ficha, batalha, mundo do livro, comparar ou arena consulta o motor e escolhe a versão; o ramo 'padrao' é o código atual, intocado.
2. **Sistema embutido** `lib/dbt/sistemaDragonBall.ts`, id `dragon-ball-tales`, `motor: 'dragon-ball-tales'`, entra em `SISTEMAS_EMBUTIDOS`. Atributos genéricos `for des con int sab pod pre`; recursos `pv` (tom vida, atual e máximo) e `pk` (tom energia, atual e máximo). Assim barra de vida do token, ajuste rápido com histórico, disco e rede funcionam sem mudança.
3. **Ficha estruturada.** `Personagem.dbt?: FichaDBT` (opcional; One Piece nunca tem). Tipo e leitor/validador em `lib/dbt/modelo.ts` (`lerFichaDBT`, `fichaDBTVazia`). O campo atravessa: `personagemDoArquivo`, `paraOFio`, protocolo do personagem (criar/editar/diferença do jogador), ajuste. Valores derivados (PV/PK máximos, CA, ST...) saem de `lib/dbt/regras/` e o máximo é gravado em `maximos.pv/pk` quando a base muda (com ajuste manual opcional).
4. **Dados do livro** em módulos estáticos gerados: `lib/dbt/dados/*.ts` (raças do básico + suplementos, talentos, movimentos marciais, perícias, rótulos, ranks, transformações, itens, condições, ações de combate, tabelas de EP e ND, NPCs prontos das sagas e do Enma Daioh). Gerador `scripts/dbt/gerar-dados.cjs` lê `docs/fontes/dragon-ball-tales/json`. Carregar NPCs prontos por import dinâmico (são grandes).
5. **Livro de regras** `lib/dbt/livro/livroDragonBall.ts` (gerado dos md): Livro do Jogador, Livro do Narrador, Suplementos de raça, regras das Sagas. `lib/marcacaoLeve.ts` ganha tabela GFM (aditivo; o One Piece não tem linha de tabela). Teto do livro (600k caracteres) sobe para caber ~700k.
6. **Regras puras** `lib/dbt/regras/`: ficha (derivados, marcos de PDL, perícias), técnicas (montador: orçamento de rótulos, faixa de Ki e dano, validação, técnica especial), transformações, NPC (PV = ND × vida por golpe), dano (faixas mínimo/médio/completo com deslocamento por diferença de EP, crítico), comparar.
7. **Ficha nova** `components/dbt/ficha/` com a mesma interface `FichaDePersonagemProps`; registro `fichaDoSistema(sistema)` usado em `FichaDePersonagemDialog.tsx`, `player/PlayerFicha.tsx`, `batalha/PerfilDaCarta.tsx`; o editor de sistema não edita o Dragon Ball (só duplica). Visual "Scouter": protótipo em `docs/design/ficha-dragon-ball/prototipo.html`.
8. **Batalha nova** (motor próprio, regra do livro, cap. V–VI): `lib/dbt/batalha/` (estado e máquina de turno), `stores/batalhaDBTStore.ts` (mesmo contrato `MesaDaBatalha`), `net/protocoloDaBatalhaDBT.ts` (mensagens `batalhaDBT.*`), `net/batalhaDBTNoHost.ts`, `components/dbt/batalha/` (mestre e jogador). Modo **automático** (rola d20+mod+EP, compara com CA, faixa de dano, gasta Ki, abre reação, aplica dano e condições) com **modo manual** (o mestre digita/escolhe resultado, aplica ou não) e desfazer. Reaproveita infra genérica: grade/movimento, equipes, faixa da ordem, registro visual, ajuste de ficha, Judge.
9. **Mundo do livro do Dragon Ball**: NPCs (novo NPC em branco ou a partir dos NPCs prontos), Comparar (PDL, EP, PV, PK, CA, ST, chance de acerto e dano esperado de cada técnica contra a CA do outro, diferença de EP e vitória automática), Arena de testes própria (`stores/arenaDBTStore.ts`).

## Fases

| Fase | O quê | Dono |
|---|---|---|
| 0 | Contrato `lib/dbt/modelo.ts` (tipos da ficha e dos dados) | 1 agente |
| 1 | Costura: motor, sistema embutido, `Personagem.dbt`, tabelas no livro, teto | programador-frontend |
| 1 | Dados + livro gerados | operario |
| 1 | Regras puras | programador-frontend |
| 2 | Ficha Scouter no app (+ jogador) | designer-opus + programador-frontend |
| 3 | Batalha: regra + store + rede + telas | 2-3 escritores em série/disjuntos |
| 4 | Mundo: NPCs prontos, Comparar, Arena | 1-2 escritores |
| 5 | Final: tsc, build, suíte 1 vez, passeio no app (mestre + jogador), auditoria do pedido literal, consertos | orquestrador |

## Critério de pronto (verificável)

1. Com uma aventura em One Piece aberta, tudo igual a antes: suíte existente passa (mesmos resultados de antes ou melhores); `git diff` nos arquivos de regra do One Piece vazio.
2. Escolher "Dragon Ball Tales" numa pasta/aventura nova: o Livro mostra todos os capítulos (jogador, narrador, suplementos) com tabelas.
3. Criar ficha de jogador e de NPC com a ficha Scouter; derivados batem com as fórmulas do livro (teste de unidade com os exemplos do livro: CON 12 + raça 12 = 72 PV; POD 14 = 28 PK; Kamehameha do exemplo).
4. Montador de técnica recusa orçamento estourado e calcula Ki/dano como no exemplo do livro.
5. Batalha no mapa: iniciativa, turno com Ki, técnica com acerto contra CA e faixa de dano, reação, condição, transformação, desfazer, modo manual; o jogador joga a parte dele pela rede.
6. Comparar e Arena funcionam com fichas Dragon Ball.
7. Apagar a cópia de um sistema não altera aventuras de outro sistema.
