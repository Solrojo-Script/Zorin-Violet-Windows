import Meta from 'gi://Meta';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class WindowBorder {
    enable() {
        this._border = new St.Widget({
            style_class: 'violet-active-window-border',
            reactive: false,
            visible: false,
        });
        global.window_group.add_child(this._border);
        this._signals = [
            [global.display, global.display.connect('notify::focus-window', () => this._trackFocus())],
            [global.display, global.display.connect('restacked', () => this._update())],
            [global.display, global.display.connect('in-fullscreen-changed', () => this._update())],
            [Main.overview, Main.overview.connect('showing', () => this._border.hide())],
            [Main.overview, Main.overview.connect('hidden', () => this._update())],
            [Main.sessionMode, Main.sessionMode.connect('updated', () => this._update())],
        ];
        this._windowSignals = [];
        this._trackFocus();
    }

    _trackFocus() {
        this._disconnectWindow();
        this._window = global.display.get_focus_window();
        this._actor = this._window?.get_compositor_private();
        if (this._window && this._actor) {
            for (const signal of ['position-changed', 'size-changed', 'notify::minimized', 'notify::fullscreen'])
                this._windowSignals.push([this._window, this._window.connect(signal, () => this._update())]);
            this._windowSignals.push([this._actor, this._actor.connect('notify::mapped', () => this._update())]);
            this._windowSignals.push([this._actor, this._actor.connect('destroy', () => {
                this._disconnectWindow();
                this._border.hide();
            })]);
        }
        this._update();
    }

    _disconnectWindow() {
        for (const [object, id] of this._windowSignals ?? [])
            object.disconnect(id);
        this._windowSignals = [];
        this._window = null;
        this._actor = null;
    }

    _update() {
        const window = this._window;
        const actor = this._actor;
        const group = global.window_group;
        const type = window?.get_window_type();
        const framed = type === Meta.WindowType.NORMAL ||
            type === Meta.WindowType.DIALOG || type === Meta.WindowType.MODAL_DIALOG;
        if (!framed || !actor?.mapped || actor.get_parent() !== group ||
            window.is_override_redirect() || window.get_title()?.startsWith('@!') ||
            window.get_gtk_application_id?.() === 'com.rastersoft.ding' ||
            window.get_wm_class()?.toLowerCase() === 'com.rastersoft.ding' ||
            window.minimized || window.is_fullscreen() ||
            Main.overview.visible || Main.sessionMode.isLocked) {
            this._border.hide();
            return;
        }
        const frame = window.get_frame_rect();
        this._border.set_position(frame.x, frame.y);
        this._border.set_size(frame.width, frame.height);
        if (this._border.get_previous_sibling() !== actor)
            group.set_child_above_sibling(this._border, actor);
        this._border.show();
    }

    disable() {
        this._disconnectWindow();
        for (const [object, id] of this._signals ?? [])
            object.disconnect(id);
        this._signals = [];
        this._border?.destroy();
        this._border = null;
    }
}
