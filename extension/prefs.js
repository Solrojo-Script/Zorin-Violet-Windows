import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const ALTERNATIVE = '/etc/alternatives/gdm-theme.gresource';
const VIOLET_THEME = '/usr/local/share/gnome-shell/theme/VioletWindows-GDM/gnome-shell-theme.gresource';

export default class VioletWindowsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const page = new Adw.PreferencesPage({title: 'Appearance', icon_name: 'preferences-desktop-appearance-symbolic'});
        const group = new Adw.PreferencesGroup({
            title: 'GDM login screen',
            description: 'Apply the violet style to the system login screen. Your current wallpaper is preserved.',
        });
        const row = new Adw.ActionRow({title: 'Violet login theme'});
        const apply = new Gtk.Button({label: 'Apply', valign: Gtk.Align.CENTER});
        const restore = new Gtk.Button({label: 'Restore previous', valign: Gtk.Align.CENTER});
        const syncRow = new Adw.ActionRow({
            title: 'Follow desktop wallpaper',
            subtitle: 'Keep GDM up to date, with a separate wallpaper copy on each monitor.',
        });
        const sync = new Gtk.Button({label: 'Enable sync', valign: Gtk.Align.CENTER});

        function refresh(message = '') {
            let selected;
            try {
                selected = GLib.file_read_link(ALTERNATIVE);
            } catch {
                // This system does not expose a GDM theme alternative.
            }
            const active = selected === VIOLET_THEME;
            apply.sensitive = Boolean(selected);
            apply.label = active ? 'Reapply' : 'Apply';
            restore.sensitive = active;
            sync.sensitive = true;
            row.subtitle = message || (active ? 'Violet Windows theme selected' :
                selected ? 'Uses the current system theme' : 'GDM theme selection is unavailable on this system');
        }

        const run = (args) => {
            apply.sensitive = restore.sensitive = false;
            sync.sensitive = false;
            row.subtitle = 'Waiting for administrator authorization…';
            try {
                const installer = this.dir.get_child('install-gdm.py').get_path();
                const process = Gio.Subprocess.new(
                    ['/usr/bin/pkexec', '/usr/bin/python3', '-I', installer, ...args],
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
                process.communicate_utf8_async(null, null, (proc, result) => {
                    try {
                        const [, , stderr] = proc.communicate_utf8_finish(result);
                        refresh(proc.get_successful()
                            ? 'Saved. The change appears the next time GDM opens.'
                            : stderr.trim().split('\n').at(-1) || 'The change was cancelled or could not be applied.');
                    } catch (error) {
                        refresh(error.message);
                    }
                });
            } catch (error) {
                refresh(error.message);
            }
        };

        apply.connect('clicked', () => run([]));
        restore.connect('clicked', () => run(['--restore']));
        sync.connect('clicked', () => run(['--sync-wallpaper']));
        row.add_suffix(apply);
        row.add_suffix(restore);
        group.add(row);
        syncRow.add_suffix(sync);
        group.add(syncRow);
        page.add(group);
        window.add(page);
        refresh();
    }
}
