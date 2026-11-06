import Clutter from 'gi://Clutter';
import {WindowSwitcherPopup} from 'resource:///org/gnome/shell/ui/altTab.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';

const TILING = 'zorin-tiling-shell@zorinos.com';

function warpToWindow(window) {
    const {x, y, width, height} = window.get_frame_rect();
    const monitor = Main.layoutManager.monitors[window.get_monitor()];
    if (!monitor)
        return;

    const left = Math.max(x, monitor.x);
    const top = Math.max(y, monitor.y);
    const right = Math.min(x + width, monitor.x + monitor.width);
    const bottom = Math.min(y + height, monitor.y + monitor.height);
    if (right > left && bottom > top)
        Clutter.get_default_backend().get_default_seat().warp_pointer(
            Math.floor((left + right) / 2), Math.floor((top + bottom) / 2));
}

export default class KeyboardFocus {
    enable() {
        this._injections = new InjectionManager();
        this._switcherInjection = new InjectionManager();
        this._switcherInjection.overrideMethod(WindowSwitcherPopup.prototype, '_finish',
            original => function (...args) {
                const window = this._items[this._selectedIndex]?.window;
                const result = original.apply(this, args);
                if (window?.showing_on_its_workspace())
                    warpToWindow(window);
                return result;
            });
        this._stateId = Main.extensionManager.connect('extension-state-changed', (_, extension) => {
            if (extension.uuid === TILING)
                this._attach();
        });
        this._attach();
    }

    _attach() {
        const tiling = Main.extensionManager.lookup(TILING)?.stateObj;
        const prototype = tiling && Object.getPrototypeOf(tiling);
        if (prototype === this._prototype)
            return;
        this._injections.clear();
        this._prototype = prototype;
        if (!prototype)
            return;

        for (const name of ['_onKeyboardFocusWinDirection', '_onKeyboardFocusWin']) {
            if (typeof prototype[name] !== 'function')
                continue;
            this._injections.overrideMethod(prototype, name, original => function (...args) {
                const previous = global.display.get_focus_window();
                const result = original.apply(this, args);
                const window = global.display.get_focus_window();
                if (window && window !== previous)
                    warpToWindow(window);
                return result;
            });
        }
    }

    disable() {
        if (this._stateId)
            Main.extensionManager.disconnect(this._stateId);
        this._stateId = 0;
        this._injections?.clear();
        this._switcherInjection?.clear();
        this._prototype = null;
    }
}
