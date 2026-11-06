#!/bin/sh
set -eu

source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/extension
uuid=violet-windows@solrojo
destination=${XDG_DATA_HOME:-"$HOME/.local/share"}/gnome-shell/extensions/$uuid

if [ "$(id -u)" -eq 0 ]; then
    printf '%s\n' 'Run the installer as your regular GNOME user.' >&2
    exit 1
fi

install -d "$destination/gdm"
install -m 644 "$source_dir"/*.js "$source_dir/stylesheet.css" \
    "$source_dir/metadata.json" "$source_dir/../install-gdm.py" "$destination/"
install -m 644 "$source_dir/../gdm/gdm.css" "$destination/gdm/"
printf 'Installed in %s\n' "$destination"
printf '%s\n' 'Log out and back in, then enable Violet Windows in the Extensions app.'
