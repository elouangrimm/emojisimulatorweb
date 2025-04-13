// scripts/engine/Model.js

/**********************

All agents, objects and such should be shallow shells.
That is, this ONE JSON file should control ALL the behavior.
This way, it's really easy to change it at runtime,
as well as serialize & deserialize.

***********************/

(function (exports) {
    // Singleton
    window.Model = {};

    // Data
    Model.data = {};
    Model.backup = null;
    window.hasUnsavedChanges = false; // Flag for unsaved changes prompt

    // Init (Called once on initial page load by Load.js)
    // Note: This function is NOT called when loading from localStorage or Import,
    // Model.loadModelData handles those cases.
    Model.init = function (data) {
        console.log("Model.js: Initializing model..."); // Log init

        // Save data (and backup for a reset)
        Model.data = data;

        // --- Clean up loaded data ---
        Model.data.meta = Model.data.meta || {};
        Model.data.meta.title =
            Model.data.meta.title || "Untitled Emoji Simulation";
        if (Model.data.meta.description) {
            // Remove old description if present
            delete Model.data.meta.description;
        }
        // Ensure actions arrays exist recursively (good practice)
        const ensureActions = (items) => {
            if (!items || !Array.isArray(items)) return;
            items.forEach((item) => {
                if (item && typeof item === "object") {
                    item.actions = item.actions || [];
                    ensureActions(item.actions); // Recurse
                }
            });
        };
        ensureActions(Model.data.states);
        // --- End data cleanup ---

        // Create backup *after* cleanup
        Model.backup = JSON.parse(JSON.stringify(Model.data));

        // Update tab title
        document.title = Model.data.meta.title + " - Emoji Simulator! 😘";

        // Initialize Grid (creates agents based on Model.data.world)
        Grid.initialize();

        // Initialize Editor UI (reads from Model.data)
        if (UI.options.edit !== UI.NONE) {
            // Clear editor first in case of race conditions/reloads
            if (Editor.dom) Editor.dom.innerHTML = "";
            Editor.create(); // Let Editor.create handle reading Model.data
        }

        // Set initial playback state
        Model.isPlaying = UI.options.paused == UI.NONE; // Use strict equality

        // Update grid visuals
        publish("/grid/updateSize"); // Resize grid visuals
        publish("/grid/updateAgents"); // Draw initial agent states

        // Start animation loop
        _lastTimestamp = null; // Reset timestamp for animation loop
        _ticker = 0;
        requestAnimationFrame(Model.tick);

        window.hasUnsavedChanges = false; // Reset flag after initial load

        // Publish initialization complete event (UI elements listen to this)
        publish("/model/init");
        console.log("Model.js: Initialization complete.");
    };

    // Return to backup state (triggered by Reset button)
    Model.returnToBackup = function () {
        console.log("Model.js: Returning to backup...");

        // Restore data from backup
        Model.data = JSON.parse(JSON.stringify(Model.backup));

        // Reinitialize Grid with restored data
        Grid.reinitialize(); // This also calls Grid.initialize internally

        // Rebuild Editor UI from scratch using restored Model.data
        if (UI.options.edit !== UI.NONE && Editor.dom) {
            // Clear existing editor content safely
            while (Editor.dom.firstChild) {
                Editor.dom.removeChild(Editor.dom.firstChild);
            }
            Editor.create(); // Recreate the editor fully
            // Ensure title UI is updated after recreation
            if (Editor.updateTitleUI) Editor.updateTitleUI();
        } else {
            // Update title even if editor is hidden
            if (Editor.updateTitleUI) Editor.updateTitleUI();
        }

        // Update tab title
        document.title =
            (Model.data.meta.title || "Untitled Emoji Simulation") +
            " - Emoji Simulator! 😘";

        // Update grid visuals
        publish("/grid/updateAgents"); // Show the restored state

        window.hasUnsavedChanges = false; // Reset unsaved flag

        // Publish message that reset is done (e.g., for scrollbar reset)
        publish("/meta/reset/complete");
        console.log("Model.js: Backup restored.");
        Save.updateURL(); // Update URL to reflect the restored state
    };

    // Load new model data (from localStorage, Import, or potentially LZString in future)
    // This function REPLACES the current Model.data and rebuilds UI.
    Model.loadModelData = function (newData) {
        console.log("Model.js: Model.loadModelData called.");
        try {
            // Basic validation
            if (
                !newData ||
                !newData.meta ||
                !newData.states ||
                !newData.world
            ) {
                throw new Error("Invalid simulation data structure.");
            }

            // Ensure actions arrays exist recursively
            const ensureActions = (items) => {
                if (!items || !Array.isArray(items)) return;
                items.forEach((item) => {
                    if (item && typeof item === "object") {
                        item.actions = item.actions || [];
                        ensureActions(item.actions); // Recurse
                    }
                });
            };
            ensureActions(newData.states);

            // Add title if missing, remove description
            newData.meta.title =
                newData.meta.title || "Untitled Emoji Simulation";
            if (newData.meta.description) {
                delete newData.meta.description;
            }

            // *** Replace current data ***
            Model.data = newData;
            Model.backup = JSON.parse(JSON.stringify(Model.data)); // Update backup too

            // Re-initialize Grid with new data
            Grid.reinitialize();

            // Rebuild Editor UI from scratch using new Model.data
            if (UI.options.edit !== UI.NONE && Editor.dom) {
                while (Editor.dom.firstChild) {
                    Editor.dom.removeChild(Editor.dom.firstChild);
                }
                Editor.create();
                if (Editor.updateTitleUI) Editor.updateTitleUI();
            } else {
                if (Editor.updateTitleUI) Editor.updateTitleUI(); // Update title even if editor hidden
            }

            // Update tab title
            document.title =
                (Model.data.meta.title || "Untitled Emoji Simulation") +
                " - Emoji Simulator! 😘";

            // Reset playback state based on loaded meta, or default
            Model.isPlaying =
                newData.meta.play !== undefined ? newData.meta.play : true;
            UI.options.paused = !Model.isPlaying; // Sync UI option

            // Update grid display
            publish("/grid/updateAgents"); // Show the initial state of the loaded model

            window.hasUnsavedChanges = false; // Reset unsaved flag after successful load

            // Publish event AFTER everything is rebuilt/reset
            publish("/model/init"); // Notify UI elements (like playback controls) to update

            console.log(
                "Model.js: Model loaded successfully via loadModelData."
            );
            Save.updateURL(); // Update URL to reflect the newly loaded state
        } catch (error) {
            console.error(
                "Model.js: Failed to load model data inside loadModelData:",
                error
            );
            alert(
                "Error loading simulation data. It might be invalid or corrupted.\n\n" +
                    error.message
            );
            // Optionally, revert to a safe state here, e.g.,
            // Model.returnToBackup(); // Or load a default model
        }
    };

    // --- Playback Control ---
    Model.isPlaying = true;
    Model.play = function () {
        if (!Model.isPlaying) {
            Model.isPlaying = true;
            _lastTimestamp = null; // Reset timestamp to avoid large jump after pause
            publish("/play/start"); // Notify UI
            console.log("Model: Play");
        }
    };
    Model.pause = function () {
        if (Model.isPlaying) {
            Model.isPlaying = false;
            publish("/play/pause"); // Notify UI
            console.log("Model: Pause");
        }
    };

    // --- Animation Loop ---
    let _lastTimestamp = null; // Use let
    let _ticker = 0; // Use let
    Model.tick = function (timestamp) {
        // RAF
        requestAnimationFrame(Model.tick);

        // Ensure model data exists before proceeding
        if (!Model.data || !Model.data.meta) {
            // console.warn("Model.tick: Model data not ready.");
            return;
        }

        // Calculate delta time
        if (!_lastTimestamp) _lastTimestamp = timestamp; // Initialize timestamp on first frame or after play
        const delta = timestamp - _lastTimestamp;
        // If delta is abnormally large (e.g., tab was inactive), cap it to prevent huge jumps
        const maxDelta = 500; // Max delta in ms (e.g., 0.5 seconds)
        _ticker += Math.min(delta, maxDelta);
        _lastTimestamp = timestamp;

        // If paused, do nothing more
        if (!Model.isPlaying) return;

        // Determine steps based on FPS
        const fps = Model.data.meta.fps || 30; // Use default if not set
        const tickerLimit = 1000 / fps;
        if (_ticker < tickerLimit) return; // Not enough time passed for a step

        // Calculate steps missed (with a cap)
        let steps = 0;
        while (_ticker >= tickerLimit) {
            steps++;
            _ticker -= tickerLimit;
        }
        if (steps > 5) {
            // Increase cap slightly?
            console.warn(
                `Simulation lagging: Tried to perform ${steps} steps. Capping at 5.`
            );
            steps = 5;
            _ticker = 0; // Reset ticker if lagging significantly
        }

        // Perform steps
        for (let i = 0; i < steps; i++) {
            Grid.step();
        }

        // Update screen after steps
        publish("/grid/updateAgents");
    };

    // --- Helper Functions ---
    Model.getStateByID = function (id) {
        if (!Model.data || !Model.data.states) return null;
        // Handle potential type mismatch (ID from DOM might be string)
        const numericId = Number(id);
        for (let i = 0; i < Model.data.states.length; i++) {
            const state = Model.data.states[i];
            if (state.id === numericId) return state; // Use strict equality if IDs are numbers
        }
        return null;
    };

    Model.removeStateByID = function (id) {
        if (!Model.data || !Model.data.states) return;
        const numericId = Number(id);
        for (let i = 0; i < Model.data.states.length; i++) {
            const state = Model.data.states[i];
            if (state.id === numericId) {
                // Check if this state is used as the draw brush
                if (Model.data.meta && Model.data.meta.draw == numericId) {
                    Model.data.meta.draw = 0; // Reset draw brush to default
                    publish("/ui/updateStateHeaders"); // Trigger brush update
                }
                Model.data.states.splice(i, 1);
                window.hasUnsavedChanges = true; // Mark change
                Save.updateURL(); // Update URL after structural change
                return; // Exit after removing
            }
        }
    };

    Model.generateNewID = function () {
        if (!Model.data || !Model.data.states) return 0; // Fallback
        let highestID = -1;
        Model.data.states.forEach((state) => {
            if (highestID < state.id) {
                highestID = state.id;
            }
        });
        return highestID + 1;
    };

    // --- Emoji Generation ---
    let emojiIndex = -1; // Use let
    const emojis = [
        // Use const
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
        return { ...emojis[emojiIndex] }; // Return a copy
    };
})(window); // End of Model IIFE

// --- Global Event Listener for Unsaved Changes ---
// This should be outside the IIFE to attach to the global window object
window.addEventListener("beforeunload", (event) => {
    if (window.hasUnsavedChanges) {
        // Standard way to trigger the browser's confirmation dialog.
        event.preventDefault();
        // Chrome requires returnValue to be set.
        event.returnValue = "";
        // Return the confirmation message string (though most modern browsers ignore it)
        return "You have unsaved changes. Are you sure you want to leave?";
    }
    // If no unsaved changes, the browser will close without prompt (return undefined).
});
