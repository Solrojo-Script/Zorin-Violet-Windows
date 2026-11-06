import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export default class WindowPlacement {
    enable() {
        this._newWindows = new WeakSet();
        this._mapId = global.window_manager.connect_after('map', (_, actor) =>
            this._sizeNewWindow(actor.get_meta_window()));
        this._signal = GObject.signal_lookup('window-created', Meta.Display.$gtype);
        // Run before window-created handlers, including Zorin's auto-tiling.
        this._hook = GObject.signal_add_emission_hook(this._signal, 0, (_hint, [, window]) => {
            try {
                this._place(window);
            } catch (error) {
                console.error('Violet Windows could not place a new window', error);
            }
            return true;
        });
    }

    _place(window) {
        const layout = Main.layoutManager;
        if (layout._startingUp ||
            window.get_window_type() !== Meta.WindowType.NORMAL ||
            window.get_transient_for() || window.is_attached_dialog() ||
            window.is_override_redirect() || !window.allows_move())
            return;

        if (!window.is_skip_taskbar() && !/^wofi(?:\.desktop)?$/i.test(window.get_wm_class() ?? ''))
            this._newWindows.add(window);

        if (layout.monitors.length < 2)
            return;
        const [x, y] = global.get_pointer();
        const monitor = layout.monitors.find(({x: left, y: top, width, height}) =>
            x >= left && x < left + width && y >= top && y < top + height);
        const current = window.get_monitor();
        if (monitor && current >= 0 && current !== monitor.index)
            window.move_to_monitor(monitor.index);
    }

    _sizeNewWindow(window) {
        if (!this._newWindows.delete(window) || !window.allows_resize() ||
            window.is_fullscreen() || window.get_maximized() || window.assignedTile)
            return;

        const area = window.get_work_area_current_monitor();
        const width = Math.min(1100, Math.floor(area.width * 0.75));
        const height = Math.min(760, Math.floor(area.height * 0.8));
        window.move_resize_frame(false,
            area.x + Math.floor((area.width - width) / 2),
            area.y + Math.floor((area.height - height) / 2), width, height);
    }

    disable() {
        if (this._mapId)
            global.window_manager.disconnect(this._mapId);
        this._mapId = 0;
        if (this._hook)
            GObject.signal_remove_emission_hook(this._signal, this._hook);
        this._hook = 0;
    }
}
