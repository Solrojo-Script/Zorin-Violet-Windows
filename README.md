# Violet Windows

A GNOME Shell extension for window placement, keyboard focus, and the top bar.

- Opens new application windows on the monitor under the pointer and gives ordinary resizable windows a centered initial size. Tiling layouts can still set their own geometry.
- Draws a violet border around the focused window, including standalone dialogs.
- Resizes the active window with **Super + Alt** and a left-button drag.
- Moves the pointer to the newly focused window when confirming Alt+Tab or using Zorin Tiling Shell's directional or sequential focus shortcuts.
- Dismisses Wofi when you click outside it and places application indicators to the left of System Monitor when that indicator is present.

## Requirements

- GNOME Shell 46, the version declared by the extension.
- Zorin Tiling Shell for pointer movement with its keyboard focus shortcuts.
- Wofi and the GNOME System Monitor extension for their respective integrations. Both are optional.

## Installation

1. Download or clone this repository and open a terminal in its directory.
2. Run the installer as your regular desktop user.

   ```sh
   ./install.sh
   ```

3. Log out and back in so GNOME Shell loads the files.
4. Enable **Violet Windows** in the **Extensions** app, or run:

   ```sh
   gnome-extensions enable violet-windows@solrojo
   ```

To update, run the installer again and log out and back in.

## Uninstallation

Disable the extension first so it can restore any temporarily suspended mouse modifier. Then remove its installation directory.

```sh
gnome-extensions disable violet-windows@solrojo
rm -r -- "${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/violet-windows@solrojo"
```
