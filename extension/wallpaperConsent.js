import Adw from 'gi://Adw';

/** List the GDM-only extension and helper before starting administrator authorization. */
export function confirmWallpaperInstallation(parent, approved) {
    const dialog = new Adw.MessageDialog({
        transient_for: parent,
        modal: true,
        heading: 'Install GDM wallpaper component?',
        body: 'This action installs and enables the following extension in the GDM login screen:\n\n' +
            'Violet GDM Background\nviolet-gdm-background@solrojo\n\n' +
            'It also installs the wallpaper sync helper and its login startup entry.\n' +
            'Administrator authorization is required. Your desktop extension list stays unchanged.',
    });
    dialog.add_response('cancel', 'Cancel');
    dialog.add_response('install', 'Install and enable');
    dialog.set_response_appearance('install', Adw.ResponseAppearance.SUGGESTED);
    dialog.set_default_response('cancel');
    dialog.set_close_response('cancel');
    dialog.connect('response', (_dialog, response) => {
        if (response === 'install')
            approved();
    });
    dialog.present();
    return dialog;
}
