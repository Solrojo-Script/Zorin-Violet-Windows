import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import KeyboardFocus from './keyboard-focus.js';
import WindowPlacement from './placement.js';
import WindowResize from './resize.js';
import WindowBorder from './border.js';
import WofiPanelBehavior from './wofi.js';

export default class VioletWindows extends Extension {
    enable() {
        this._features = [];
        for (const feature of [
            new WindowPlacement(), new WindowResize(this.dir),
            new WofiPanelBehavior(), new WindowBorder(), new KeyboardFocus(),
        ]) {
            try {
                feature.enable();
                this._features.push(feature);
            } catch (error) {
                console.error('Violet Windows could not start a feature', error);
                try {
                    feature.disable();
                } catch (cleanupError) {
                    console.error('Violet Windows could not clean up a feature', cleanupError);
                }
            }
        }
    }

    disable() {
        for (const feature of (this._features ?? []).reverse()) {
            try {
                feature.disable();
            } catch (error) {
                console.error('Violet Windows could not stop a feature', error);
            }
        }
        this._features = null;
    }
}
