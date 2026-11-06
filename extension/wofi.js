import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const SYSTEM_MONITOR = 'system-monitor@gnome-shell-extensions.gcampax.github.com';
const SHELL_ROLES = new Set([
    'activities', 'appMenu', 'quickSettings', 'dateMenu', 'a11y', 'keyboard',
    'dwellClick', 'screenRecording', 'screenSharing',
]);
function isWofi(window) {
    const names = [window.get_wm_class(), window.get_wm_class_instance(), window.get_gtk_application_id?.()];
    return names.some(name => typeof name === 'string' && /^(wofi|wofi\.desktop)$/i.test(name));
}
export default class WofiPanelBehavior {
    enable() {
        this._right = Main.panel._rightBox;
        this._pendingClose = new Set();
        this._reorderId = 0;
        this._indicatorWatches = new Map();
        this._appearanceOrder = 0;
        this._panelBoxes = [Main.panel._leftBox, Main.panel._centerBox, this._right];
        this._panelSignals = this._panelBoxes.flatMap(box =>
            ['child-added', 'child-removed'].map(signal =>
                [box, box.connect(signal, () => this._queueOrder())]));
        this._stageId = global.stage.connect('captured-event', (_stage, event) => {
            if (event.type() === Clutter.EventType.BUTTON_PRESS || event.type() === Clutter.EventType.TOUCH_BEGIN) {
                const [x, y] = event.get_coords();
                this._closeOutside(x, y, event.get_time());
            }
            return Clutter.EVENT_PROPAGATE;
        });
        this._createdId = global.display.connect('window-created', () => this._startPointerWatch());
        this._startPointerWatch();
        this._queueOrder();
    }
    _startPointerWatch() {
        if (this._pointerPollId) return;
        const buttonMask = Clutter.ModifierType.BUTTON1_MASK | Clutter.ModifierType.BUTTON2_MASK | Clutter.ModifierType.BUTTON3_MASK;
        let lastButtons = global.get_pointer()[2] & buttonMask;
        let emptyPolls = 0;
        // Desktop icons are client surfaces: their clicks may never reach
        // Shell's captured-event handler or change the focused Meta.Window.
        this._pointerPollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 20, () => {
            const windows = global.get_window_actors().map(actor => actor.get_meta_window()).filter(window =>
                window && !window.minimized && window.showing_on_its_workspace() && isWofi(window));
            if (!windows.length) {
                if (++emptyPolls >= 50) {
                    this._pointerPollId = 0;
                    return GLib.SOURCE_REMOVE;
                }
            } else {
                emptyPolls = 0;
            }
            const [x, y, modifiers] = global.get_pointer();
            const buttons = modifiers & buttonMask;
            if (windows.length && (buttons & ~lastButtons))
                this._closeOutside(x, y, global.get_current_time());
            lastButtons = buttons;
            return GLib.SOURCE_CONTINUE;
        });
    }
    _queueOrder() {
        if (this._reorderId) return;
        this._reorderId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._reorderId = 0;
            if (!this._right) return GLib.SOURCE_REMOVE;
            const monitor = Main.panel.statusArea[SYSTEM_MONITOR]?.container;
            const apps = [];
            for (const [role, indicator] of Object.entries(Main.panel.statusArea)) {
                const actor = indicator?.container;
                const parent = actor?.get_parent();
                if (role === SYSTEM_MONITOR || SHELL_ROLES.has(role) ||
                    !this._panelBoxes.includes(parent)) continue;

                let watch = this._indicatorWatches.get(indicator);
                if (!watch) {
                    watch = {order: ++this._appearanceOrder, parent,
                        index: parent.get_children().indexOf(actor)};
                    watch.visibleId = indicator.connect('notify::visible', () => {
                        if (indicator.visible)
                            watch.order = ++this._appearanceOrder;
                        this._queueOrder();
                    });
                    watch.destroyId = indicator.connect('destroy', () => {
                        this._indicatorWatches.delete(indicator);
                        this._queueOrder();
                    });
                    this._indicatorWatches.set(indicator, watch);
                }
                if (parent !== this._right) {
                    parent.remove_child(actor);
                    this._right.add_child(actor);
                }
                apps.push({actor, order: watch.order});
            }
            apps.sort((a, b) => b.order - a.order);
            const actors = apps.map(app => app.actor);
            const ordered = this._right.get_children().filter(actor => !actors.includes(actor));
            const index = ordered.indexOf(monitor);
            ordered.splice(index >= 0 ? index : 0, 0, ...actors);
            ordered.forEach((actor, index) => {
                if (this._right.get_child_at_index(index) !== actor)
                    this._right.set_child_at_index(actor, index);
            });
            return GLib.SOURCE_REMOVE;
        });
    }
    _closeOutside(x, y, timestamp) {
        const windows = global.get_window_actors().map(actor => actor.get_meta_window()).filter(window =>
            window && !window.minimized && window.showing_on_its_workspace() && isWofi(window));
        if (!windows.length) return;
        if (windows.some(window => {
            const rect = window.get_frame_rect();
            return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
        })) return;
        const sourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._pendingClose.delete(sourceId);
            const current = new Set(global.get_window_actors().map(actor => actor.get_meta_window()));
            for (const window of windows) {
                if (current.has(window) && window.showing_on_its_workspace()) window.delete(timestamp);
            }
            return GLib.SOURCE_REMOVE;
        });
        this._pendingClose.add(sourceId);
    }
    disable() {
        if (this._createdId) global.display.disconnect(this._createdId);
        if (this._pointerPollId) GLib.source_remove(this._pointerPollId);
        this._createdId = this._pointerPollId = 0;
        if (this._stageId) global.stage.disconnect(this._stageId);
        for (const [box, id] of this._panelSignals)
            box.disconnect(id);
        for (const [indicator, watch] of this._indicatorWatches) {
            indicator.disconnect(watch.visibleId);
            indicator.disconnect(watch.destroyId);
            const actor = indicator.container;
            if (watch.parent !== this._right && actor.get_parent() === this._right) {
                this._right.remove_child(actor);
                watch.parent.insert_child_at_index(actor,
                    Math.min(watch.index, watch.parent.get_n_children()));
            }
        }
        this._indicatorWatches.clear();
        if (this._reorderId) GLib.source_remove(this._reorderId);
        for (const id of this._pendingClose ?? []) GLib.source_remove(id);
        this._pendingClose?.clear();
        this._stageId = this._reorderId = 0;
        this._right = null;
    }
}
