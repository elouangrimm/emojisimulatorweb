// scripts/engine/Model.js

/**********************

All agents, objects and such should be shallow shells.
That is, this ONE JSON file should control ALL the behavior.
This way, it's really easy to change it at runtime,
as well as serialize & deserialize.

***********************/

(function(exports){
    console.log("Model.js: Starting IIFE execution."); // Log Start

	// Singleton
	window.Model = {}; // Define Model on the window object
    console.log("Model.js: window.Model object created.");

	// Data
	Model.data = {};
	Model.backup = null;
    window.hasUnsavedChanges = false; // Flag for unsaved changes prompt
    console.log("Model.js: Initial variables defined.");

	// Init (Called once on initial page load by Load.js AFTER data is fetched)
    // This sets up the simulation based on the initially loaded data.
	Model.init = function(data){
        console.log("Model.js: Initializing model (Model.init)...");

		// Save data (and backup for a reset)
		Model.data = data;

		// --- Clean up initially loaded data ---
        Model.data.meta = Model.data.meta || {};
        Model.data.meta.title = Model.data.meta.title || "Untitled Emoji Simulation";
        if (Model.data.meta.description) {
            console.log("Model.init: Removing legacy 'description'.");
            delete Model.data.meta.description;
        }
        const ensureActions = (items) => {
             if (!items || !Array.isArray(items)) return;
             items.forEach(item => {
                 if (item && typeof item === 'object') {
                     item.actions = item.actions || [];
                     ensureActions(item.actions);
                 }
             });
         };
         ensureActions(Model.data.states);
         // --- End data cleanup ---

        // Create backup *after* cleanup
		Model.backup = JSON.parse(JSON.stringify(Model.data));
        console.log("Model.init: Backup created.");

        // Update tab title
        document.title = Model.data.meta.title + " - Emoji Simulator! 😘";

		// Initialize Grid
		Grid.initialize();

		// Initialize Editor UI (only if enabled)
		if(UI.options.edit !== UI.NONE) {
            if(Editor.dom) Editor.dom.innerHTML = ''; // Clear first
            Editor.create(); // Rebuild editor
             if(Editor.updateTitleUI) Editor.updateTitleUI(); // Ensure title input reflects model
		} else {
             if(Editor.updateTitleUI) Editor.updateTitleUI(); // Update title display even if editor hidden
        }

		// Set initial playback state
		Model.isPlaying = (UI.options.paused == UI.NONE);
        console.log("Model.init: isPlaying set to:", Model.isPlaying);

		// Update grid visuals
		publish("/grid/updateSize");
		publish("/grid/updateAgents");

		// Start animation loop
		_lastTimestamp = null; // Reset timestamp for animation loop
        _ticker = 0;
		requestAnimationFrame(Model.tick);

        window.hasUnsavedChanges = false; // Reset flag after initial load

		// Publish initialization complete event
		publish("/model/init"); // UI elements listen to this
        console.log("Model.js: Initialization complete (Model.init finished).");
	};
     console.log("Model.js: Model.init function defined.");


	// Return to backup state (triggered by Reset button)
	Model.returnToBackup = function(){
        console.log("Model.js: Returning to backup...");

		// Restore data from backup
		Model.data = JSON.parse(JSON.stringify(Model.backup));

		// Reinitialize Grid with restored data
		Grid.reinitialize();

        // Rebuild Editor UI from scratch using restored Model.data
		if(UI.options.edit !== UI.NONE && Editor.dom) {
            while (Editor.dom.firstChild) {
                Editor.dom.removeChild(Editor.dom.firstChild);
            }
            Editor.create();
            if (Editor.updateTitleUI) Editor.updateTitleUI();
		} else {
            if (Editor.updateTitleUI) Editor.updateTitleUI();
        }

        // Update tab title
         document.title = (Model.data.meta.title || "Untitled Emoji Simulation") + " - Emoji Simulator! 😘";

         // Update grid visuals
         publish("/grid/updateAgents");

         window.hasUnsavedChanges = false; // Reset unsaved flag

		// Publish message that reset is done
		publish("/meta/reset/complete");
        console.log("Model.js: Backup restored.");
         Save.updateURL(); // Update URL

	};
    console.log("Model.js: Model.returnToBackup function defined.");


    Model.loadModelData = function (newData) { // <<<<< START Function definition assignment
        console.log("Model.js: Model.loadModelData called.");
        try {
            // --- Basic validation and data preparation ---
            if (!newData || !newData.meta || !newData.states || !newData.world) {
                throw new Error("Invalid simulation data structure.");
            }
            const ensureActions = (items) => { /* ... keep ensureActions ... */ };
            ensureActions(newData.states);
            newData.meta.title = newData.meta.title || "Untitled Emoji Simulation";
            if (newData.meta.description) delete newData.meta.description;
            // --- End data prep ---

            // *** Replace current data ***
            Model.data = newData;
            Model.backup = JSON.parse(JSON.stringify(Model.data));
            console.log("Model.loadModelData: Model.data replaced.");

            // *** Re-initialize Grid (Depends only on Model.data) ***
            Grid.reinitialize();

            // *** Update Tab Title (Depends only on Model.data) ***
            document.title = (Model.data.meta.title || "Untitled Emoji Simulation") + " - Emoji Simulator! 😘";

            // *** Set Model's internal playback state (Doesn't need UI) ***
            Model.isPlaying = newData.meta.play !== undefined ? newData.meta.play : true;
            console.log("Model.loadModelData: Model.isPlaying set to:", Model.isPlaying);


            // *** Trigger UI rebuilds via events AFTER data is loaded ***
            publish("/model/load/success"); // Editor listens
            publish("/grid/updateAgents"); // Grid listens
            window.hasUnsavedChanges = false; // Reset flag
            publish("/model/init"); // UI playback controls listen

            console.log("Model.js: Model loaded successfully via loadModelData. Events published.");
            Save.updateURL(); // Update URL

        } catch (error) {
            console.error("Model.js: Failed inside loadModelData:", error);
            alert("Error processing simulation data. It might be invalid or corrupted.\n\n" + error.message);
        }
    };
    console.log("Model.js: Model.loadModelData function defined. Type:", typeof Model.loadModelData);


	// --- Playback Control ---
	Model.isPlaying = true;
	Model.play = function(){
        if (!Model.isPlaying) {
            console.log("Model: Play triggered.");
            Model.isPlaying = true;
            _lastTimestamp = null; // Reset timestamp to avoid jump
            publish("/play/start");
        }
	};
	Model.pause = function(){
        if (Model.isPlaying) {
            console.log("Model: Pause triggered.");
            Model.isPlaying = false;
            publish("/play/pause");
        }
	};
     console.log("Model.js: Play/Pause functions defined.");


    // --- Animation Loop ---
	let _lastTimestamp = null;
	let _ticker = 0;
	Model.tick = function(timestamp){
		requestAnimationFrame(Model.tick);
        if (!Model.data || !Model.data.meta) return;

		if(!_lastTimestamp) {
            _lastTimestamp = timestamp;
             _ticker = 0; // Reset ticker on first frame/resume
             return; // Skip first frame after init/resume
        }
		const delta = timestamp - _lastTimestamp;
		_lastTimestamp = timestamp;

		if(!Model.isPlaying) return; // Check pause *after* updating timestamp

        const maxDelta = 500;
        const cappedDelta = Math.min(delta, maxDelta);
		_ticker += cappedDelta;

        const fps = Model.data.meta.fps || 30;
		const tickerLimit = 1000 / fps;
		if(_ticker < tickerLimit) return;

		let steps = 0;
		while(_ticker >= tickerLimit){
			steps++;
			_ticker -= tickerLimit;
		}
		const maxSteps = 5;
		if(steps > maxSteps) {
            console.warn(`Tick Lag: ${steps} steps capped to ${maxSteps}`);
            steps = maxSteps;
            _ticker = 0;
        }

		for(let i = 0; i < steps; i++){
			Grid.step();
		}

		publish("/grid/updateAgents");
	};
    console.log("Model.js: Tick function defined.");


	// --- Helper Functions ---
	Model.getStateByID = function(id){
        if (!Model.data || !Model.data.states) return null;
        const numericId = Number(id);
		for(let i=0; i<Model.data.states.length; i++){
			const state = Model.data.states[i];
			if(state.id === numericId) return state;
		}
		return null;
	};

	Model.removeStateByID = function(id){
        if (!Model.data || !Model.data.states) return;
        const numericId = Number(id);
		for(let i=0; i<Model.data.states.length; i++){
			const state = Model.data.states[i];
			if(state.id === numericId){
                if (Model.data.meta && Model.data.meta.draw == numericId) {
                    Model.data.meta.draw = 0;
                    publish("/ui/updateStateHeaders");
                }
				Model.data.states.splice(i,1);
                window.hasUnsavedChanges = true;
                Save.updateURL();
				return;
			}
		}
	};

	Model.generateNewID = function(){
        if (!Model.data || !Model.data.states) return 0;
		let highestID = -1;
		Model.data.states.forEach(state => {
            if(highestID < state.id){
				highestID = state.id;
			}
        });
		return highestID + 1;
	};
    console.log("Model.js: Helper functions defined.");


	// --- Emoji Generation ---
	let emojiIndex = -1;
	const emojis = [
		{ icon: "😺" }, { icon: "🌸" }, { icon: "🍇" }, { icon: "🎱" }, { icon: "🐚" },
        { icon: "🌲" }, { icon: "🔥" }, { icon: "💀" }, { icon: "🌊" }, { icon: "🏖" },
        { icon: "🌍" }, { icon: "⭐" }, { icon: "🚀" }, { icon: "👾" }, { icon: "🤖" }
	];
	Model.generateNewEmoji = function(){
		emojiIndex = (emojiIndex + 1) % emojis.length;
		return { ...emojis[emojiIndex] };
	};
    console.log("Model.js: Emoji generator defined.");

    console.log("Model.js: End of IIFE execution.");
})(window); // End of Model IIFE


// --- Global Event Listener for Unsaved Changes ---
window.addEventListener('beforeunload', (event) => {
  if (window.hasUnsavedChanges) {
    event.preventDefault();
    event.returnValue = ''; // Required for Chrome
    return 'You have unsaved changes. Are you sure you want to leave?'; // Standard message
  }
});
console.log("Model.js: 'beforeunload' listener attached.");

// Final check after script runs
console.log("Model.js: Script execution finished. window.Model type:", typeof window.Model);