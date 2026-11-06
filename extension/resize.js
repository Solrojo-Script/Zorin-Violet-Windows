import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Graphene from 'gi://Graphene';
import Meta from 'gi://Meta';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

function dragAction(state) {
    const mask = Clutter.ModifierType;
    if (!(state & (mask.SUPER_MASK | mask.MOD4_MASK)) || (state & mask.SHIFT_MASK)) return null;
    const control = Boolean(state & mask.CONTROL_MASK);
    const alt = Boolean(state & mask.MOD1_MASK);
    if (alt && !control) return 'resize';
    return null;
}
function resizeOperation(rect, x, y) {
    const west = x < rect.x + rect.width / 2;
    const north = y < rect.y + rect.height / 2;
    return north ? (west ? Meta.GrabOp.RESIZING_NW : Meta.GrabOp.RESIZING_NE)
        : (west ? Meta.GrabOp.RESIZING_SW : Meta.GrabOp.RESIZING_SE);
}

export default class VioletWindowResize {
    constructor(directory) {
        this.dir = directory;
    }

    enable() {
        console.info("Violet resize: pointer-device fix loaded");
        this._dragging = false;
        this._prefs = new Gio.Settings({schema_id: 'org.gnome.desktop.wm.preferences'});
        this._modifierBackup = this.dir.get_child('.move-modifier-backup.json');
        this._moveSuspended = false;
        this._recoverNativeModifier();
        this._beginId = global.display.connect('grab-op-begin', () => { this._dragging = true; });
        this._endId = global.display.connect('grab-op-end', () => { this._dragging = false; });
        this._stageId = global.stage.connect('captured-event', (_stage, event) => {
            this._syncNativeModifier(event.get_state());
            if (event.type() !== Clutter.EventType.BUTTON_PRESS || event.get_button() !== 1)
                return Clutter.EVENT_PROPAGATE;
            const [x, y] = event.get_coords();
            return this._tryGrab(event.get_state(), x, y, event.get_time(), event.get_device())
                ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
        });
        let wasPressed = Boolean(global.get_pointer()[2] & Clutter.ModifierType.BUTTON1_MASK);
        // Client-side surfaces can bypass the Shell stage event. The native
        // grab is still usable while button 1 is held; detect only its edge.
        this._pollId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () => {
            const [x, y, state] = global.get_pointer();
            this._syncNativeModifier(state);
            const pressed = Boolean(state & Clutter.ModifierType.BUTTON1_MASK);
            if (pressed && !wasPressed && !this._dragging)
                this._tryGrab(state, x, y, global.get_current_time(), null);
            wasPressed = pressed;
            return GLib.SOURCE_CONTINUE;
        });
    }

    _recoverNativeModifier() {
        if (!this._modifierBackup.query_exists(null)) return;
        const [ok, bytes] = this._modifierBackup.load_contents(null);
        if (!ok) return;
        const saved = JSON.parse(new TextDecoder().decode(bytes));
        if (this._prefs.get_string('mouse-button-modifier') === '') {
            if (saved.value === null) this._prefs.reset('mouse-button-modifier');
            else this._prefs.set_string('mouse-button-modifier', saved.value);
        }
        this._modifierBackup.delete(null);
    }

    _syncNativeModifier(state) {
        const resizeHeld = dragAction(state) === 'resize' && !Main.sessionMode.isLocked && !Main.overview.visible;
        if (resizeHeld && !this._moveSuspended) {
            this._savedModifier = this._prefs.get_user_value('mouse-button-modifier')?.deep_unpack() ?? null;
            // Record the previous value before changing it, so a Shell restart
            // cannot leave ordinary movement permanently disabled.
            this._modifierBackup.replace_contents(JSON.stringify({value: this._savedModifier}), null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null);
            this._moveSuspended = true;
            this._prefs.set_string('mouse-button-modifier', '');
        } else if (!resizeHeld && this._moveSuspended) {
            this._restoreNativeModifier();
        }
    }

    _restoreNativeModifier() {
        if (!this._moveSuspended) return;
        if (this._prefs.get_string('mouse-button-modifier') === '') {
            if (this._savedModifier === null) this._prefs.reset('mouse-button-modifier');
            else this._prefs.set_string('mouse-button-modifier', this._savedModifier);
        }
        this._moveSuspended = false;
        this._savedModifier = null;
        if (this._modifierBackup.query_exists(null)) this._modifierBackup.delete(null);
    }

    _tryGrab(state, x, y, timestamp, device) {
        const action = dragAction(state);
        if (!action || this._dragging || Main.overview.visible || Main.sessionMode.isLocked) return false;
        const window = global.display.get_focus_window();
        if (!window || window.minimized || window.is_fullscreen()) return false;
        if (!window.allows_resize()) return false;
        // Mutter filters every motion/release event by the leading device.
        // A null device starts the grab (and changes the cursor), but none of
        // the real pointer events can match it. Polling must use the seat's
        // logical pointer, just like Clutter's pointer events do.
        device ??= Clutter.get_default_backend().get_default_seat().get_pointer();
        if (!device) return false;
        const operation = resizeOperation(window.get_frame_rect(), x, y);
        window.raise();
        try {
            const started = window.begin_grab_op(operation, device, null, timestamp, new Graphene.Point({x, y}));
            if (started) this._dragging = true;
            else console.warn('Violet resize: Mutter refused the resize grab');
            return started;
        } catch (error) {
            console.error('Violet resize: native grab failed', error);
            return false;
        }
    }

    disable() {
        if (this._pollId) GLib.source_remove(this._pollId);
        if (this._stageId) global.stage.disconnect(this._stageId);
        if (this._beginId) global.display.disconnect(this._beginId);
        if (this._endId) global.display.disconnect(this._endId);
        this._pollId = this._stageId = this._beginId = this._endId = 0;
        this._dragging = false;
        this._restoreNativeModifier();
        this._prefs = this._modifierBackup = null;
    }
}
