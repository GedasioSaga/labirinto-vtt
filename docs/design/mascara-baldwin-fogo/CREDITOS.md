# Créditos: abertura "Máscara em chamas" (rascunho)

## Modelo 3D

- **Título:** Baldwin IV's mask
- **Autor:** ibuki123
- **Fonte:** <https://sketchfab.com/3d-models/baldwin-ivs-mask-6f273a51d2494a52aab1ce0bf56d10f2>
- **Licença:** Creative Commons Atribuição 4.0 Internacional (CC BY 4.0), <https://creativecommons.org/licenses/by/4.0/>
- **Arquivo usado:** `source/123.glb` do `baldwin-ivs-mask.zip` (extraído em `Animações/entrada/baldwin-mask/`)

O zip não trazia `license.txt` (o pacote "formato original" do Sketchfab não traz) e o `.glb` não tem autor nem
licença nos metadados (só "Marmoset Toolbag 4.0"). A licença foi conferida na API pública do Sketchfab em 27/11/2026
(`api.sketchfab.com/v3/models/6f273a51d2494a52aab1ce0bf56d10f2`: licença "CC Attribution", autor ibuki123,
publicado em 06/07/2023, 6 texturas e 2 materiais, iguais aos do zip). O endereço do modelo tem o mesmo nome do zip
(`baldwin-ivs-mask`).

Crédito obrigatório em todo uso. Linha pronta:

> "Baldwin IV's mask" por ibuki123 (https://sketchfab.com/3d-models/baldwin-ivs-mask-6f273a51d2494a52aab1ce0bf56d10f2),
> licença CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Modificado.

Para a abertura no app, no formato da "Armaduras despertam" (duas linhas no canto):

    Modelo 3D sob CC BY 4.0: “Baldwin IV's mask”, de ibuki123 ·
    (sketchfab.com). Fogo, luz e som feitos por script.

**Modificações feitas aqui** (a CC BY pede que sejam indicadas): a máscara foi posta em pé, reescalada (1 m de
altura na cena) e centrada; a cor da textura foi escurecida (aço escuro) e a rugosidade trocada; brasa emissiva nos
olhos e na borda acrescentada no material; o plano de chão que vinha no arquivo foi tirado. A malha não foi alterada.

## Aviso de propriedade intelectual

A máscara é a do rei Balduíno IV como aparece no filme *Kingdom of Heaven* (2005). A CC BY cobre o modelo 3D do autor,
não o desenho do figurino do filme. Uso pessoal e no RPG sem venda: sem problema prático; em material comercial, é
risco de IP.

## Fogo, fumaça, faíscas, luz e som

Feitos do zero por script nesta pasta, sem asset nem amostra de terceiros:

- fogo e fumaça: simulação Mantaflow do Blender 5.2 (`cena.py`), com detalhe de ruído no shader do volume;
- faíscas: partículas do Blender; luz: luzes pontuais que seguem o combustível;
- som: sintetizado em numpy/scipy (`som.py`), nenhuma gravação nem banco de sons.
