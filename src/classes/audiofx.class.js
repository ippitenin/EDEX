class AudioManager {
    constructor() {
        const path = require("path");
        const {Howl, Howler} = require("howler");

        if (window.settings.audio === true) {
            if(window.settings.disableFeedbackAudio === false) {
                this.stdout = new Howl({
                    src: [path.join(__dirname, "assets", "audio", "stdout.wav")],
                    volume: 0.4
                });
                this.granted = new Howl({
                    src: [path.join(__dirname, "assets", "audio", "granted.wav")]
                });
            }
            this.keyboard = new Howl({
                src: [path.join(__dirname, "assets", "audio", "keyboard.wav")]
            });
            this.theme = new Howl({
                src: [path.join(__dirname, "assets", "audio", "theme.wav")]
            });
            this.expand = new Howl({
                src: [path.join(__dirname, "assets", "audio", "expand.wav")]
            });
            this.panels = new Howl({
                src: [path.join(__dirname, "assets", "audio", "panels.wav")]
            });
            this.scan = new Howl({
                src: [path.join(__dirname, "assets", "audio", "scan.wav")]
            });

            Howler.volume(window.settings.audioVolume);
        } else {
            Howler.volume(0.0);
        }

        // Only the sounds something still plays are loaded; the fork's sound scheme dropped the
        // typing, folder and alert effects. Any other name gets a silent stand-in from the proxy.
        return new Proxy(this, {
            get: (target, sound) => {
                if (sound in target) {
                    return target[sound];
                } else {
                    return {
                        play: () => {return true;}
                    }
                }
            }
        });
    }
}

module.exports = {
    AudioManager
};
