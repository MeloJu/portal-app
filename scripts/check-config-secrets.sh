#!/usr/bin/env bash
set -euo pipefail

root="${1:-.}"
status=0

sensitive='(pass(word)?|secret|token|credential|private[-_.]?key|api[-_.]?key|signing[-_.]?key)'

allowed_key_suffix='(key-store-type|keys|key-alias|key-prefix|key-store-provider)'

while IFS= read -r -d '' file; do
	line_number=0
	while IFS= read -r line || [ -n "$line" ]; do
		line_number=$((line_number + 1))

		case "${line#"${line%%[![:space:]]*}"}" in
			'#'*|'!'*|'') continue ;;
		esac

		key=$(printf '%s' "$line" | sed -nE 's/^[[:space:]]*([A-Za-z0-9._-]+)[[:space:]]*[:=].*/\1/p')
		[ -z "$key" ] && continue

		printf '%s' "$key" | grep -qiE "$sensitive" || continue
		printf '%s' "$key" | grep -qiE "^${allowed_key_suffix}$" && continue

		value=$(printf '%s' "$line" | sed -E 's/^[[:space:]]*[A-Za-z0-9._-]+[[:space:]]*[:=][[:space:]]*//; s/[[:space:]]*$//')
		value=${value%\"}
		value=${value#\"}
		value=${value%\'}
		value=${value#\'}

		# vazio e placeholder de ambiente sao aceitos
		[ -z "$value" ] && continue
		case "$value" in
			'${'*'}') continue ;;
		esac

		printf 'segredo fixo em %s:%s -> %s\n' "$file" "$line_number" "$key" >&2
		status=1
	done <"$file"
done < <(find "$root" -type d \( -name target -o -name node_modules -o -name .git \) -prune -o \
	-type f \( -name 'application*.yml' -o -name 'application*.yaml' -o -name 'application*.properties' \) -print0)

if [ "$status" -ne 0 ]; then
	printf '\nValores sensiveis devem vir do ambiente: use ${NOME_DA_VARIAVEL}.\n' >&2
	printf 'Ver backend/docs/SECURITY.md, secao 5.\n' >&2
	exit 1
fi

echo "ok: nenhum segredo fixo em application*.{yml,yaml,properties}"
