# Violet Windows

A GNOME Shell extension for window placement, keyboard focus, and the top bar.

- Opens new application windows on the monitor under the pointer and gives ordinary resizable windows a centered initial size. Tiling layouts can still set their own geometry.
- Draws a violet border around the focused window, including standalone dialogs.
- Styles the GNOME lock screen, including its clock, avatar, password field, and panel.
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

## Optional GDM login theme

On Zorin OS with GNOME Shell 46, the separate GDM installer adds the violet clock, top bar, menus, dialogs, and avatar styling to the active greeter theme. It preserves that theme's background and other assets. The desktop extension installer handles the **Super+L** lock screen.

Install Python 3 and the `libglib2.0-dev-bin` package for `gresource` and `glib-compile-resources`. From the repository directory, run:

```sh
python3 install-gdm.py --check
sudo python3 install-gdm.py
```

Save the previous theme path printed by the installer. Log out when ready to see the theme in GDM. To switch back, replace `PREVIOUS_THEME_PATH` with the path you saved on the first install:

```sh
sudo update-alternatives --set gdm-theme.gresource "PREVIOUS_THEME_PATH"
```
