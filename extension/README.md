# Extensão da Lumi (verificação de links com anúncio)

Quando a Lumi abre o bypass.city no quadro, o usuário resolve o captcha normalmente. A extensão só
**lê** o link revelado que aparece na tela e manda para a Lumi, que fecha o quadro e já analisa no
VirusTotal. Ela não clica em nada nem toca no captcha, e só age dentro de um quadro aberto pela Lumi.

## Instalar (Chrome/Edge)

1. Abra `chrome://extensions` (ou `edge://extensions`) e ligue o **Modo do desenvolvedor**.
2. **Carregar sem compactação** → escolha esta pasta `extension/`.
3. Recarregue a Lumi. Na etapa de verificação aparece a dica "a extensão da Lumi traz o link revelado".

## Instalar (Firefox 121+)

1. Abra `about:debugging#/runtime/this-firefox`.
2. **Carregar extensão temporária...** → escolha o arquivo `extension/manifest.json`.
3. Em `about:addons` → Lumi Links → **Permissões**, ative o acesso a bypass.city e localhost, se estiver desligado.
4. Recarregue a Lumi.

A extensão temporária some quando o Firefox fecha; para algo permanente, publique na loja da Mozilla.
No Firefox a página-mãe não é informada ao quadro, então a Lumi se apresenta com a mensagem `lumi:hello`.

## Aviso nativo de instalação no Firefox

O Firefox mostra "Este site quer instalar uma extensão" quando o site oferece um `.xpi` **assinado pela Mozilla**
(o Chrome não permite isso: lá o botão leva para a loja).

1. Crie as chaves de API em https://addons.mozilla.org/developers/addon/api/key/ (conta gratuita).
2. Assine como distribuição própria (não aparece na loja):
   `npx web-ext sign --source-dir extension --channel unlisted --api-key <JWT issuer> --api-secret <JWT secret>`
3. Copie o `.xpi` gerado para `frontend/public/lumi-links.xpi` e defina no front
   `VITE_LUMI_EXTENSION_XPI_URL=/lumi-links.xpi`.

Sem `.xpi` nem loja configurados, a notificação da Lumi abre o passo a passo de instalação local.

## Produção

Adicione o domínio da Lumi em `LUMI_ORIGINS` (`bypass-result.js`) e em `matches` do `lumi-bridge.js` (`manifest.json`).

## Se parar de funcionar

O link é lido pelo layout atual do bypass.city (link "Open bypassed Link" ou a linha "The resolved url is").
Se eles mudarem a página, ajuste `findResult` em `bypass-result.js`. Sem a extensão, a Lumi continua
aceitando o link colado (Ctrl+V ou botão Colar).
