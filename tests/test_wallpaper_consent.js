/** GTK dialog integration test; no installer or privileged process is launched. */
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import GdkX11 from 'gi://GdkX11?version=4.0';

const root = Gio.File.new_for_path(ARGV[0]);
const screenshot = ARGV[1];
const {confirmWallpaperInstallation} = await import(root.get_child('extension/wallpaperConsent.js').get_uri());
const app = new Adw.Application({
    application_id: 'io.github.solrojo.VioletConsentTest',
    flags: Gio.ApplicationFlags.NON_UNIQUE,
});
let failure = null;
app.connect('activate', () => {
    Adw.StyleManager.get_default().set_color_scheme(Adw.ColorScheme.FORCE_DARK);
    const parent = new Adw.ApplicationWindow({application: app, title: 'Violet Windows preferences'});
    parent.present();
    let approvals = 0;
    let dialog = confirmWallpaperInstallation(parent, () => approvals++);
    if (dialog.get_default_response() !== 'cancel' || dialog.get_close_response() !== 'cancel')
        throw new Error('The default and closing response must cancel.');
    dialog.response('cancel');
    if (approvals !== 0)
        throw new Error('Cancelling must not call the installer callback.');
    dialog = confirmWallpaperInstallation(parent, () => approvals++);
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
        try {
            if (screenshot) {
                const surface = dialog.get_surface();
                if (!(surface instanceof GdkX11.X11Surface))
                    throw new Error('Screenshot capture requires the isolated X11 display.');
                const [, , , status] = GLib.spawn_sync(null,
                    ['import', '-window', String(surface.get_xid()), screenshot], null,
                    GLib.SpawnFlags.SEARCH_PATH, null);
                if (status !== 0)
                    throw new Error('Could not capture the confirmation dialog.');
            }
            dialog.response('install');
            if (approvals !== 1)
                throw new Error('Only an explicit install response may call the callback.');
        } catch (error) {
            failure = error;
        }
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            parent.close();
            return GLib.SOURCE_REMOVE;
        });
        return GLib.SOURCE_REMOVE;
    });
});
app.run([]);
if (failure)
    throw failure;
print('PASS: cancel default, no action on cancel, explicit install callback.');
