import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class VioletGdmBackground extends Extension {
    enable() {
        if (!Main.sessionMode.isGreeter) return;
        this._css = this.dir.get_child('style.css');
        this._context = St.ThemeContext.get_for_stage(global.stage);
        this._theme = null;
        this._themeId = this._context.connect('changed', () => this._syncTheme());
        this._syncTheme();
        this._monitorsId = Main.layoutManager.connect('monitors-changed', () => this._refresh());
        this._startupId = Main.layoutManager.connect('startup-complete', () => this._refresh());
        this._refresh();
        if (!this._group) {
            let attempts = 0;
            this._retryId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                this._refresh();
                if (this._group || ++attempts >= 50) {
                    this._retryId = 0;
                    return GLib.SOURCE_REMOVE;
                }
                return GLib.SOURCE_CONTINUE;
            });
        }
    }
    _syncTheme() {
        const theme = this._context.get_theme();
        if (theme === this._theme) return;
        const old = this._theme;
        this._theme = theme;
        if (old) old.unload_stylesheet(this._css);
        if (theme) theme.load_stylesheet(this._css);
    }
    _refresh() {
        const parent = Main.screenShield?._lockDialogGroup;
        if (!parent) return;
        if (!this._group) {
            this._parent = parent;
            parent.add_style_class_name('violet-gdm-per-monitor');
            this._group = new St.Widget({reactive: false, can_focus: false});
            this._group.add_constraint(new Clutter.BindConstraint({source: parent, coordinate: Clutter.BindCoordinate.ALL}));
            parent.insert_child_at_index(this._group, 0);
        }
        this._group.destroy_all_children();
        for (const monitor of Main.layoutManager.monitors) {
            const background = new St.Widget({style_class: 'violet-gdm-monitor', reactive: false, can_focus: false});
            background.set_position(monitor.x, monitor.y);
            background.set_size(monitor.width, monitor.height);
            this._group.add_child(background);
        }
    }
    disable() {
        if (this._retryId) GLib.source_remove(this._retryId);
        if (this._monitorsId) Main.layoutManager.disconnect(this._monitorsId);
        if (this._startupId) Main.layoutManager.disconnect(this._startupId);
        if (this._themeId) this._context.disconnect(this._themeId);
        this._group?.destroy();
        this._group = null;
        this._parent?.remove_style_class_name('violet-gdm-per-monitor');
        this._parent = null;
        if (this._theme) this._theme.unload_stylesheet(this._css);
        this._theme = this._context = this._css = null;
        this._retryId = this._monitorsId = this._startupId = this._themeId = 0;
    }
}
