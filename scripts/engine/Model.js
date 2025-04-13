(function (exports) {
    console.log("Model.js: Starting IIFE execution.");

    // Singleton
    window.Model = {};
    console.log("Model.js: window.Model object created.");

    // Data
    Model.data = {};
    Model.backup = null;
    window.hasUnsavedChanges = false;
    console.log("Model.js: Initial variables defined.");

    // --- Playback State ---
    let _rafID = null; // Store the requestAnimationFrame ID
    let _lastTimestamp = 0; // Timestamp of the last processed frame
    let _timeAccumulator = 0; // Accumulates time delta between frames
    Model.isPlaying = false; // Default to not playing initially

    // --- Init Function ---
    Model.init = function (data) {
        console.log("Model.js: Initializing model (Model.init)...");
        Model.data = data;
        Model.data.meta = Model.data.meta || {};
        Model.data.meta.title = Model.data.meta.title || "Untitled Simulation";
        if (Model.data.meta.description) delete Model.data.meta.description;
        const ensureActions = (items) => {
            /* ... keep ensureActions ... */
        };
        ensureActions(Model.data.states);
        Model.backup = JSON.parse(JSON.stringify(Model.data));
        document.title = Model.data.meta.title + " - Emoji Simulator! 😘";

        Grid.initialize();

        if (UI.options.edit !== UI.NONE) {
            if (Editor.dom) Editor.dom.innerHTML = "";
            Editor.create();
            if (Editor.updateTitleUI) Editor.updateTitleUI();
        } else {
            if (Editor.updateTitleUI) Editor.updateTitleUI();
        }

        // Set initial playback state FROM MODEL DATA (or default to true if not specified)
        Model.isPlaying =
            Model.data.meta?.play !== undefined ? Model.data.meta.play : true;
        console.log("Model.init: isPlaying initial value:", Model.isPlaying);

        publish("/grid/updateSize");
        publish("/grid/updateAgents"); // Show initial state

        window.hasUnsavedChanges = false;

        // Start the loop *conditionally* based on initial state
        if (Model.isPlaying) {
            Model.play(); // Use the play function to start the loop correctly
        } else {
            // Ensure loop is stopped if not playing initially
            if (_rafID) cancelAnimationFrame(_rafID);
            _rafID = null;
            _lastTimestamp = 0; // Reset timestamp if starting paused
            _timeAccumulator = 0;
            publish("/play/pause"); // Ensure UI reflects paused state
        }

        publish("/model/init"); // Notify UI controls AFTER setting play state
        console.log("Model.js: Initialization complete.");
    };
    console.log("Model.js: Model.init function defined.");

    // --- Return to backup ---
    Model.returnToBackup = function () {
        console.log("Model.js: Returning to backup...");
        if (!Model.backup) {
            console.error("Model.returnToBackup: No backup available!");
            return;
        }
        Model.data = JSON.parse(JSON.stringify(Model.backup));

        Grid.reinitialize();

        if (UI.options.edit !== UI.NONE && Editor.dom) {
            while (Editor.dom.firstChild)
                Editor.dom.removeChild(Editor.dom.firstChild);
            Editor.create();
            if (Editor.updateTitleUI) Editor.updateTitleUI();
        } else {
            if (Editor.updateTitleUI) Editor.updateTitleUI();
        }
        document.title =
            (Model.data.meta?.title || "Untitled") + " - Emoji Simulator! 😘";
        publish("/grid/updateAgents"); // Show restored state

        // Reset playback to match backup's state or default
        const shouldBePlaying =
            Model.data.meta?.play !== undefined ? Model.data.meta.play : true;
        if (shouldBePlaying) {
            Model.play(); // Start loop if needed
        } else {
            Model.pause(); // Ensure loop is stopped
        }

        window.hasUnsavedChanges = false;
        publish("/meta/reset/complete");
        console.log("Model.js: Backup restored.");
        Save.updateURL();
    };
    console.log("Model.js: Model.returnToBackup function defined.");

    Model.loadModelData = function (newData) {
        console.log("Model.js: Model.loadModelData called.");
        try {
            if (!newData?.meta || !newData?.states || !newData?.world)
                throw new Error("Invalid sim data.");
            const ensureActions = (items) => {
                /* ... keep ensureActions ... */
            };
            ensureActions(newData.states);
            newData.meta.title = newData.meta.title || "Untitled Simulation";
            if (newData.meta.description) delete newData.meta.description;

            Model.data = newData;
            Model.backup = JSON.parse(JSON.stringify(Model.data));
            console.log("Model.loadModelData: Model.data replaced.");

            Grid.reinitialize();
            document.title =
                (Model.data.meta.title || "Untitled") +
                " - Emoji Simulator! 😘";

            // Reset playback state based on NEW loaded data
            const shouldBePlaying =
                newData.meta?.play !== undefined ? newData.meta.play : true;
            console.log(
                "Model.loadModelData: Loaded model play state:",
                shouldBePlaying
            );

            publish("/model/load/success"); // Trigger Editor rebuild FIRST
            publish("/grid/updateAgents"); // Show new initial state

            window.hasUnsavedChanges = false;

            // Start/Stop loop based on loaded state AFTER UI rebuild trigger
            if (shouldBePlaying) {
                Model.play();
            } else {
                Model.pause();
            }

            publish("/model/init"); // Notify playback controls AFTER setting state
            console.log("Model.js: Model loaded via loadModelData.");
            Save.updateURL();
        } catch (error) {
            console.error("Model.js: Failed inside loadModelData:", error);
            alert(
                "Error processing simulation data. It might be invalid or corrupted.\n\n" +
                    error.message
            );
        }
    };
    console.log(
        "Model.js: Model.loadModelData function defined. Type:",
        typeof Model.loadModelData
    );

    // --- Playback Control ---
    Model.play = function () {
        if (!Model.isPlaying) {
            console.log("Model: Play triggered.");
            Model.isPlaying = true;
            // Reset timing variables *only* if loop wasn't already running
            if (!_rafID) {
                console.log(
                    "Model.play: Resetting timestamp and starting loop."
                );
                _lastTimestamp = 0; // Reset timestamp to prevent large jump
                _timeAccumulator = 0;
                // Start the loop if it's not already running
                _rafID = requestAnimationFrame(Model.tick);
            } else {
                console.log(
                    "Model.play: Loop already running, just setting isPlaying flag."
                );
                // If loop was already running (e.g., due to fast clicks),
                // ensure timestamp is relatively recent to avoid huge initial delta.
                // Setting _lastTimestamp = 0 forces a reset on the next tick.
                _lastTimestamp = 0;
            }
            publish("/play/start"); // Notify UI
        } else {
            console.log("Model: Play called but already playing.");
        }
    };

    Model.pause = function () {
        if (Model.isPlaying) {
            console.log("Model: Pause triggered.");
            Model.isPlaying = false;
            // We DON'T cancel the RAF here - the loop continues but Model.tick checks Model.isPlaying
            // This allows resuming smoothly without restarting the RAF loop itself.
            // If you wanted to completely stop RAF:
            // if (_rafID) {
            //    cancelAnimationFrame(_rafID);
            //    _rafID = null;
            // }
            publish("/play/pause"); // Notify UI
        } else {
            console.log("Model: Pause called but already paused.");
        }
    };
    console.log("Model.js: Play/Pause functions defined.");

    Model.tick = function (timestamp) {
        // Always request the next frame first
        _rafID = requestAnimationFrame(Model.tick);

        try {
            // Add error handling around the core tick logic
            if (!Model.data || !Model.data.meta) {
                // console.warn("Tick skipped: Model data not ready.");
                return; // Exit if essential data is missing
            }

            // --- Timing Calculation ---
            if (!_lastTimestamp) {
                // First frame after init/resume, just set timestamp and exit
                // console.log("Tick: Initializing timestamp.");
                _lastTimestamp = timestamp;
                return;
            }
            const delta = timestamp - _lastTimestamp;
            _lastTimestamp = timestamp; // Update for the next frame

            // --- If Paused, Do Nothing More ---
            if (!Model.isPlaying) {
                // Still running RAF, but not processing steps
                return;
            }

            // --- Accumulate Time ---
            // Cap delta to prevent huge jumps if tab was inactive
            const maxDelta = 500; // ms
            const cappedDelta = Math.min(delta, maxDelta);
            _timeAccumulator += cappedDelta;
            // console.log(`Tick: delta=${delta.toFixed(1)}, capped=${cappedDelta.toFixed(1)}, accum=${_timeAccumulator.toFixed(1)}`); // Debug log

            // --- Determine Steps based on FPS ---
            const fps = Model.data.meta.fps || 30;
            const timePerStep = 1000 / fps; // ms required for one step

            if (timePerStep <= 0) {
                // Avoid infinite loop if fps is invalid
                console.error(
                    "Tick: Invalid FPS or timePerStep:",
                    fps,
                    timePerStep
                );
                Model.pause(); // Pause simulation on error
                return;
            }

            let stepsToPerform = 0;
            while (_timeAccumulator >= timePerStep) {
                stepsToPerform++;
                _timeAccumulator -= timePerStep;
            }

            // --- Step Execution ---
            if (stepsToPerform > 0) {
                const maxStepsPerFrame = 10; // Increase cap? Test performance.
                if (stepsToPerform > maxStepsPerFrame) {
                    console.warn(
                        `Tick Lag: ${stepsToPerform} steps capped to ${maxStepsPerFrame}. Accumulator reset.`
                    );
                    stepsToPerform = maxStepsPerFrame;
                    _timeAccumulator = 0; // Reset accumulator if lagging badly
                }

                // console.log(`Tick: Performing ${stepsToPerform} steps.`); // Log steps
                for (let i = 0; i < stepsToPerform; i++) {
                    if (!Model.isPlaying) break; // Stop stepping immediately if paused mid-frame
                    Grid.step(); // Execute one simulation step
                }

                // --- Update Screen AFTER Performing Steps ---
                if (Model.isPlaying) {
                    // Only update screen if still playing after steps
                    publish("/grid/updateAgents");
                }
            }
        } catch (error) {
            console.error("Error during Model.tick execution:", error);
            Model.pause(); // Pause the simulation if an error occurs in the loop
            publish("/notify/error", ["Simulation error occurred. Paused."]);
        }
    };
    console.log("Model.js: Tick function defined.");

    // --- Helper Functions ---
    Model.getStateByID = function (id) {
        if (!Model.data || !Model.data.states) return null;
        const numericId = Number(id);
        for (let i = 0; i < Model.data.states.length; i++) {
            const state = Model.data.states[i];
            if (state.id === numericId) return state;
        }
        return null;
    };

    Model.removeStateByID = function (id) {
        if (!Model.data || !Model.data.states) return;
        const numericId = Number(id);
        for (let i = 0; i < Model.data.states.length; i++) {
            const state = Model.data.states[i];
            if (state.id === numericId) {
                if (Model.data.meta && Model.data.meta.draw == numericId) {
                    Model.data.meta.draw = 0;
                    publish("/ui/updateStateHeaders");
                }
                Model.data.states.splice(i, 1);
                window.hasUnsavedChanges = true;
                Save.updateURL();
                return;
            }
        }
    };

    Model.generateNewID = function () {
        if (!Model.data || !Model.data.states) return 0;
        let highestID = -1;
        Model.data.states.forEach((state) => {
            if (highestID < state.id) {
                highestID = state.id;
            }
        });
        return highestID + 1;
    };
    console.log("Model.js: Helper functions defined.");

    // --- Emoji Generation ---
    let emojiIndex = -1;
    const emojis = [
        { icon: "😺" },
        { icon: "🌸" },
        { icon: "🍇" },
        { icon: "🎱" },
        { icon: "🐚" },
        { icon: "🌲" },
        { icon: "🔥" },
        { icon: "💀" },
        { icon: "🌊" },
        { icon: "🏖" },
        { icon: "🌍" },
        { icon: "⭐" },
        { icon: "🚀" },
        { icon: "👾" },
        { icon: "🤖" },
    ];
    Model.generateNewEmoji = function () {
        emojiIndex = (emojiIndex + 1) % emojis.length;
        return { ...emojis[emojiIndex] };
    };
    console.log("Model.js: Emoji generator defined.");

    console.log("Model.js: End of IIFE execution.");
})(window); // End of Model IIFE

// --- Global Event Listener for Unsaved Changes ---
window.addEventListener("beforeunload", (event) => {
    if (window.hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = ""; // Required for Chrome
        return "You have unsaved changes. Are you sure you want to leave?"; // Standard message
    }
});
console.log("Model.js: 'beforeunload' listener attached.");

// Final check after script runs
console.log(
    "Model.js: Script execution finished. window.Model type:",
    typeof window.Model
);
