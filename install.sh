#!/bin/sh
set -eu

source_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/extension
uuid=violet-windows@solrojo
destination=${XDG_DATA_HOME:-"$HOME/.local/share"}/gnome-shell/extensions/$uuid

if [ "$(id -u)" -eq 0 ]; then
    printf '%s\n' 'Run the installer as your regular GNOME user.' >&2
    exit 1
fi

# Installing this project is also an explicit opt-in; EOF is a safe cancellation.
assume_yes=false
dry_run=false
for argument in "$@"; do
    case "$argument" in
        --yes|-y) assume_yes=true ;;
        --dry-run) dry_run=true ;;
        --help|-h)
            printf '%s\n' 'Usage: ./install.sh [--yes] [--dry-run]' \
                '--yes confirms installation of Violet Windows only.'
            exit 0 ;;
        *) printf 'Unknown option: %s\n' "$argument" >&2; exit 1 ;;
    esac
done
printf '%s\n' 'Violet Windows — installation plan' \
    'The following desktop extension will be installed:' \
    '  Violet Windows (violet-windows@solrojo)' \
    'Other GNOME extensions: none' \
    'Automatic activation: none' \
    'GDM wallpaper synchronization is a separate opt-in.'
if [ "$dry_run" = true ]; then
    printf '%s\n' 'Dry run: no files or settings were changed.'
    exit 0
fi
if [ "$assume_yes" != true ]; then
    printf 'Install Violet Windows? [y/N]: '
    answer=''
    IFS= read -r answer || answer=''
    case "$answer" in
        y|Y|yes|YES|Yes) ;;
        *) printf '%s\n' 'Cancelled. No files or settings were changed.'; exit 0 ;;
    esac
fi

install -d "$destination/gdm"
install -m 644 "$source_dir"/*.js "$source_dir/stylesheet.css" \
    "$source_dir/metadata.json" "$source_dir/../install-gdm.py" "$destination/"
install -m 644 "$source_dir/../gdm/gdm.css" "$destination/gdm/"
install -d "$destination/wallpaper/gdm-background"
install -m 644 "$source_dir/../wallpaper/"*.py "$destination/wallpaper/"
install -m 644 "$source_dir/../wallpaper/gdm-background/"* "$destination/wallpaper/gdm-background/"
printf 'Installed in %s\n' "$destination"
printf '%s\n' 'Log out and back in, then enable Violet Windows in the Extensions app.'
