# NPCs no Acervo — notas para aprovar

Pedido (21/11/2026, literal): "do lado direito eu não quero ter os npcs com fichas eu quero eles aqui [Acervo de tokens] faça um bom trabalho."
Decisão do dono: as fichas de NPC e de inimigo ficam no Acervo de tokens, pasta NPCs (o mestre pode criar subpastas como Inimigos e Aliados), e abrem com um clique. A coluna da direita fica só com os jogadores.

Protótipo: `docs/design/acervo/npcs-no-acervo.html` (abre direto no navegador, sem servidor). Tudo nele funciona de verdade dentro da página; o mapa e a ficha aberta são de mentira e dizem isso na tela.

## Decisões (do Claude, para o dono confirmar)

1. **O dado não muda de lugar.** A ficha continua no `rpg.json` da pasta de mapas ou no `adventure.json`, como hoje. O acervo passa a MOSTRAR as fichas de NPC da aventura aberta, junto dos tokens do app. Recusado: copiar a ficha para o acervo global. O acervo vale para todas as aventuras e sistemas; a ficha tem vida atual, histórico, cópias, mochila e tokens ligados, e tudo isso é de uma aventura só.
2. **O que entra no acervo:** toda ficha de NPC que é modelo (NPC, inimigo, "Só no cenário", criada na batalha). As cópias aparecem embaixo do modelo ("› 2 cópias", como hoje). O invocado temporário da batalha não entra. Os jogadores ficam só na coluna da direita.
3. **Migração, uma vez por aventura:** os inimigos de hoje (grupo Inimigos) vão para NPCs › Inimigos (a subpasta é criada); os NPCs vão para a raiz de NPCs; cada pasta do mestre da coluna direita (ex.: Marinha) vira subpasta de NPCs com o mesmo nome. No topo do acervo aparece um aviso de uma vez só, com "Entendi". Alternativa: tudo na raiz de NPCs, e o mestre separa.
4. **Subpasta tem um nível só** (NPCs › Inimigos). O botão "Nova subpasta" fica no cabeçalho da pasta de cima. Num segundo nível, o nome perde mais 16 px numa página de 262 px.
5. **O formato do retrato diz o que é a linha:** disco = token do app (como hoje); quadrado de canto arredondado = ficha desta aventura (o mesmo formato das listas de ficha do app). Borda dourada = a ficha tem token no mapa agora.
6. **Clique no nome:** numa ficha, abre a ficha (um clique, como o dono pediu); num token do app, continua pondo no mapa, como hoje. O "+" põe no centro do mapa nos dois. Dá para arrastar até o mapa, até um token (liga a ficha a ele) ou até uma pasta; `Esc` desiste e a linha volta ao lugar.
7. **Linha da ficha:** nome em até 2 linhas e, embaixo, o papel e quantos tokens há no mapa: "Inimigo · 2 no mapa" (conta o modelo e as cópias). Na cópia aparece "no mapa" ou "fora do mapa".
8. **Ficha de NPC que JÁ está no mapa, posta de novo pelo "+" ou pelo arrasto, ganha uma CÓPIA**, e cada token fica com a própria vida. É a mesma regra do "Ligar ficha" de hoje (`lib/ligarFicha.ts`). Hoje, arrastar da coluna direita põe outro token na MESMA ficha (`stores/porPersonagemNoMapa.ts`). Jogador continua com uma ficha só.
9. **Token do acervo que leva ficha (ex.: Goblin), posto no mapa:** na 1ª vez cria a ficha na pasta do token (como hoje, `fichaQueEntra`); nas próximas, faz cópia dela. Hoje cada vez nasce uma ficha solta e a lista enche de "Goblin, Goblin, Goblin".
10. **Ações da ficha num "⋯"** que aparece por cima do fim do nome (como as ações da coluna direita): Abrir ficha, Pôr no centro do mapa, Fazer cópia, Mover para (pastas e subpastas, com a atual marcada) e Apagar. `Shift+F10` abre o menu pelo teclado. Os tokens do app ficam com Mover e Apagar como hoje. Alternativa: "⋯" também nos tokens do app (fica tudo igual, mas muda o que o dono já conhece).
11. **Ordem dentro da pasta:** subpastas primeiro, depois tokens e fichas misturados em ordem de nome, como no Explorer do Windows. Alternativa: as fichas desta aventura antes dos tokens do app.
12. **Subtítulo da página Acervo:** "Tokens do app e as fichas de NPC desta aventura". O de hoje ("Do app, vale para todas as aventuras") deixaria de ser verdade.
13. **Coluna da direita:** cartão "Jogadores" sem grupos nem pastas, "+ Jogador" e "Importar personagens…" (NPC importado vai para Acervo › NPCs, e o resumo da importação diz isso), mais a linha "Fichas de NPC e de inimigo ficam no Acervo" com o botão "Mostrar no Acervo", que abre e destaca a pasta NPCs.
14. **"+ NPC" no topo do acervo** cria a ficha em NPCs e abre a ficha para dar o nome.
15. **A busca do acervo** procura nos tokens, nas fichas e nas cópias; quando uma cópia bate, o modelo dela aparece aberto.
16. **Apagar uma pasta não apaga nada do que está nela:** o conteúdo sobe um nível (da subpasta para a pasta mãe; da pasta de cima para Sem pasta). Se apagar a pasta padrão NPCs, as fichas vão para Sem pasta. Apagar ficha usa o mesmo texto de hoje ("As 2 cópias ficam como fichas soltas").
17. **Mapa sem aventura ou sem sistema:** o acervo fica como hoje, só com os tokens do app e nenhuma linha de ficha.

## Plano de dados

**Resumo:** a ficha não muda de arquivo. Só nascem um mapa novo no dono das fichas (ficha → pasta do acervo) e as subpastas no `acervo.json`. Nenhuma ficha, token, cópia ou mochila é reescrita.

### Hoje
- **Fichas:** `personagens[]` do dono das fichas (`stores/donoDasFichas.ts`), que é o `rpg.json` da pasta de mapas quando o mapa herda o sistema, senão o `adventure.json`. O token aponta para a ficha por `Token.characterId`. Cópia = ficha com `combate.modeloId`, sincronizada por `sincronizarVariacoes` (`lib/livros/combate.ts`). Mochila e moedas ficam na ficha: uma mochila por ficha, mesmo com vários tokens (commit cae9034c).
- **Pastas do mestre da coluna direita:** `pastasDeFichas[]` (`{id, nome, fichas[]}`), no mesmo dono (`lib/pastasDeFichas.ts`, lidas em `lib/adventure.ts:294` e `lib/pastasDeMapas.ts:279`).
- **Grupos Jogadores/NPCs/Inimigos:** calculados na hora (`grupoDaFicha`); nada é gravado.
- **Acervo:** global, `<appData>/tokens/acervo.json` versão 3 (`lib/tokenLibrary.ts`). Tem `pastas[]` sem subpastas (`{id, nome, recolhida}`; as padrão `npcs`, `veiculos` e `jogadores` têm id fixo) e `itens[]` (foto, tamanho, pasta, e opcionalmente ficha `{sistemaId, personagem}`, mochila, moedas e luzes). Antes de cada gravação o app guarda uma cópia em `acervo.json.anterior`.

### Depois
- **Fichas:** no mesmo lugar e sem campo novo na ficha.
- **Dono das fichas** ganha `fichasNoAcervo?: Record<personagemId, LugarDaFicha>`, com `LugarDaFicha = { pasta: string | null; nomeDaPasta?: string; nomeDaMae?: string; daPeca?: string }`:
  - `pasta` = id da pasta do acervo; `null` = Sem pasta.
  - `nomeDaPasta` e `nomeDaMae` servem quando a aventura vai para outro PC ou passa pelo Lobby, onde o id da pasta é outro. A pasta é achada pelo nome dentro da mesma mãe; se não achar, a ficha vai para NPCs; se NPCs foi apagada, para Sem pasta. O app nunca cria pasta sozinho ao abrir noutro PC.
  - `daPeca` = id do token do acervo de onde a ficha nasceu (decisão 9).
  - Ficha sem entrada no mapa → fica em NPCs (ficha nova da batalha, importada, "+ NPC"). Cópia nunca tem entrada: anda com o modelo.
  - O leitor é tolerante, no molde de `pastasDeFichasDoArquivo`: entrada torta é descartada, e id de ficha que não existe é ignorado.
- **Acervo versão 4:** `PastaDoAcervo.dentroDe?: string` (id da pasta mãe, um nível; se a mãe não existe, vira pasta de cima). O app antigo lê a versão 4 pelo que conhece: a subpasta aparece como pasta comum, nada some.
- `pastasDeFichas` fica gravado como está. A tela nova não usa mais, mas também não apaga.

### Migração (como garantir que nenhuma ficha, token ou cópia se perde)
1. **Quando roda:** ao abrir um mapa cujo dono tem fichas de NPC e ainda não tem `fichasNoAcervo` (a existência do campo é a marca). Só roda com o acervo lido de verdade (`AcervoCarregado.lido === true`). Se não foi lido, não migra e mostra o aviso de acervo não lido, a mesma recusa que o app já faz para não gravar por cima de um acervo que não leu.
2. **Função pura** `migrarFichasParaOAcervo(personagens, pastasDeFichas, pastasDoAcervo) → { pastasNovas, lugares }`. Para cada ficha de NPC que é modelo (não cópia, não invocada): se está numa pasta do mestre X → subpasta X de NPCs (reaproveita se já existe com o mesmo nome); senão, se é do grupo Inimigos → subpasta Inimigos; senão → raiz de NPCs. Jogador fica de fora.
3. **Ordem de gravação:** primeiro o acervo (as subpastas; o `.anterior` já é tirado), depois o dono (`fichasNoAcervo`), pelo mesmo caminho de sempre (`pastaSuja` ou `structureDirty`). Se a segunda gravação falhar, a próxima abertura migra de novo e reaproveita as subpastas pelo nome. Rodar duas vezes dá o mesmo resultado.
4. **A migração só ESCREVE coisa nova.** `personagens[]`, tokens, cópias, mochilas, `pastasDeFichas` e `acervo.json → itens` ficam byte a byte iguais.
5. **Conferência proposta**, sem teste automático (teste só entra quando o dono pedir): antes e depois, a mesma contagem de `personagens`, de tokens com `characterId`, de cópias por `modeloId`, de itens de mochila por ficha e de `itens` no `acervo.json`. É um script node de umas 20 linhas sobre os JSON.
6. **Voltar atrás:** basta abrir a versão anterior do app, que ignora `fichasNoAcervo` e lê `pastasDeFichas`. Cuidado: se o app antigo salvar a aventura, o campo novo some (o `lib/adventure.ts` só regrava os campos que conhece). Ao voltar para o app novo, a migração roda de novo a partir das pastas antigas: as mudanças de pasta feitas no app novo se perdem, as fichas não.

### Onde o dado aparece entre telas
- **Ficha criada ou movida no acervo** ("+ NPC", "Fazer cópia", soltar no mapa): aparece na ficha do token, no "Ligar ficha ›" do token (`SubmenuLigarFicha.tsx`, que não muda), em "Quem entra na batalha?" e na ficha que o jogador vê pela mesa, como hoje.
- **Não aparece** na coluna da direita (pela decisão do dono). O jogador nunca vê o acervo; o `fichasNoAcervo` é do mestre e não vai pela rede da mesa.
- **Falta conferir:** se a sincronização do Lobby (`net/nuvem/emissor`, site do Lobby) preserva um campo desconhecido do `rpg.json`. Se não preservar, o lugar das fichas volta para NPCs depois de uma sincronização; as fichas não se perdem.

## Arquivos a mudar

- `client/src/lib/tokenLibrary.ts`: `dentroDe` nas pastas, `VERSAO_DO_INDICE = 4`, `pastasValidas` lê a mãe, criar subpasta, apagar pasta sobe o conteúdo um nível.
- `client/src/lib/fichasNoAcervo.ts` (novo): `LugarDaFicha`, o leitor tolerante, `organizarAcervo(itens, pastas, personagens, lugares, busca)` (junta tokens e fichas por pasta, reaproveitando `raizDaCopia` e a busca de `lib/pastasDeFichas.ts`), `migrarFichasParaOAcervo` e a pasta da ficha com a volta por nome.
- `client/src/lib/adventure.ts` e `client/src/lib/pastasDeMapas.ts`: ler e gravar `fichasNoAcervo`, ao lado de `pastasDeFichas`.
- `client/src/stores/donoDasFichas.ts` e `client/src/stores/adventureStore.ts`: `fichasNoAcervoAtivas`, `salvarLugarDaFicha` e a migração ao abrir.
- `client/src/stores/porPersonagemNoMapa.ts`: decisão 8 (NPC já no mapa → `novaVariacao` e o token na cópia, reaproveitando `planejarLigacao`).
- `client/src/stores/criarToken.ts` (onde `fichaQueEntra` é usada): decisão 9 (`daPeca`; da 2ª vez em diante, cópia). `fichaQueEntra` também é chamada em `lib/tamanhoAoEntrar.ts` e `lib/travessiaDaFicha.ts`: falta conferir se a regra da decisão 9 vale lá.
- `client/src/components/TokenLibraryPanel.tsx` e `TokenLibraryPanel.css`: subpastas, linha de ficha (retrato quadrado, papel, "no mapa", cópias), o "⋯" com menu (no molde do `MenuDaPasta` de `ListaDePersonagens.tsx`), "+ NPC", o aviso de migração e o arrasto da ficha. O gesto de `PersonagensSection.tsx` vira um hook comum (`useArrastoDaLinha`).
- `client/src/components/livro/PaginaAcervo.tsx`: o subtítulo.
- `client/src/components/PropertiesPanel.tsx` (linha 1211): passar ao acervo as fichas, os lugares, `abrirFicha` e o mapa (`host`, `vista`).
- `client/src/components/PersonagensSection.tsx` e `ListaDePersonagens.tsx`: só jogadores, sem grupos e pastas; "+ Jogador"; "Mostrar no Acervo"; a importação diz para onde foram os NPCs.
- **Não mudam:** `SubmenuLigarFicha.tsx`, `QuemEntraNaBatalha`, a ficha do jogador e a rede da mesa.
- **Jornadas que tocam estes painéis** (não editadas; o dono decide): `client/e2e/task-jornada-acervo-recebe-token.spec.ts` e `client/e2e/task-panel-sections.spec.ts`.

## Medido no protótipo

Navegador sem janela, 1280x800, pelo `ux-driver medir`:
- Arrastar uma ficha até o mapa: quadro p95 de 16,9 ms; nenhuma tarefa longa (máximo 0 ms).
- Arrastar até uma subpasta e até um token: p95 de 16,8 ms; 0 ms de tarefa longa.
- Rolar a página do acervo (1400 px): p95 de 16,9 ms; 0 ms de tarefa longa.
- A interação mais lenta foi soltar no mapa, com 64 ms.

**Conferido clicando:** Entendi, "› 2 cópias", "⋯" pelo mouse e por `Shift+F10`, `Esc` devolvendo o foco, busca "cav" (6 de 39), arrastar Bento para Marinha, arrastar Lobo até o token Sombra (nasce Lobo 2), Goblin duas vezes (nasce Goblin 2), `Ctrl+Z`, "+ NPC" com nome, nova subpasta Aliados, apagar Marinha (Capitão Morgan sobe para NPCs) e "Mostrar no Acervo".

**Não visto:** toque, movimento reduzido na tela, nome com emoji ou texto de outro alfabeto, e o acervo com centenas de linhas.
