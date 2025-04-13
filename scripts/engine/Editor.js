// scripts/engine/Editor.js
(function (exports) {
    // Singleton Class
    exports.Editor = {};

    // DOM References
    Editor.dom = document.getElementById("editor");
    Editor.statesDOM = null;
    Editor.worldDOM = null;
    Editor.titleInput = null; // Reference to the title input
    Editor.savedSimsDropdown = null; // Reference to the dropdown
    Editor.shareUrlInput = null; // Reference to the share URL input

    Editor.rebuild = function () {
        console.log("Editor.js: Rebuilding editor UI...");
        if (!Editor.dom) return;

        // Clear existing editor content safely
        while (Editor.dom.firstChild) {
            Editor.dom.removeChild(Editor.dom.firstChild);
        }
        // Recreate the editor from scratch using current Model.data
        Editor.create(); // Assumes Editor.create correctly reads Model.data
        // Ensure title UI is updated after recreation
        if (Editor.updateTitleUI) Editor.updateTitleUI();

        // Update scrollbar after UI is rebuilt
        if (window.Ps && document.getElementById("editor_container")) {
            try {
                Ps.update(document.getElementById("editor_container"));
            } catch (err) {}
        }
        console.log("Editor.js: Editor UI rebuilt.");
    };

    // Subscribe to the model load event
    subscribe("/model/load/success", Editor.rebuild);

    // Also subscribe to reset event to rebuild editor
    subscribe("/meta/reset/complete", Editor.rebuild);

    // Create from model
    Editor.create = function() {
		console.log("Editor.js: Editor.create called.");
		// Note: Editor.dom should already be cleared by Editor.rebuild before this runs again
	
		// Check if editor should be shown
		if (window.UI && UI.options.edit === UI.NONE) {
			console.log("Editor.create: Editor UI is disabled.");
			return; // Don't build if disabled
		}
	
		// --- Title Input ---
		Editor.titleInput = document.createElement("input");
		Editor.titleInput.type = "text";
		Editor.titleInput.className = "editor_main_title_input"; // Use specific class if needed
		Editor.titleInput.value = (Model.data && Model.data.meta && Model.data.meta.title) || "Untitled Simulation";
		Editor.titleInput.placeholder = "Simulation Title";
		Editor.titleInput.oninput = function() {
			const newTitle = Editor.titleInput.value || "Untitled Simulation";
			if (Model.data && Model.data.meta) Model.data.meta.title = newTitle;
			document.title = newTitle + " - Emoji Simulator! 😘";
			window.hasUnsavedChanges = true;
			Save.updateURL();
		};
		Editor.titleInput.onchange = Save.updateURL;
		Editor.dom.appendChild(Editor.titleInput);
		// Define updateTitleUI helper (could be outside create, but needs access to Editor.titleInput)
		Editor.updateTitleUI = () => {
			if (Editor.titleInput) Editor.titleInput.value = (Model.data && Model.data.meta && Model.data.meta.title) || "Untitled Simulation";
			document.title = ((Model.data && Model.data.meta && Model.data.meta.title) || "Untitled Simulation") + " - Emoji Simulator! 😘";
		};
		// Call it once during creation
		Editor.updateTitleUI();
	
		// Divider
		Editor.dom.appendChild(Editor.createDivider());
	
		// --- STATES DOM ---
		Editor.dom.appendChild(Editor.createTitle("<span>THINGS</span> WITH RULES"));
		Editor.statesDOM = document.createElement("div");
		Editor.dom.appendChild(Editor.statesDOM);
		if (Model.data && Model.data.states) {
			Editor.createStatesUI(Editor.statesDOM, Model.data.states);
		} else {
			console.warn("Editor.create: Model.data.states not ready for createStatesUI.");
		}
	
		// --- Add State Button ---
		const addStateButton = Editor.createFancyButton(
			"<span class='button-icon'>+</span> New Thing",
			function(){
				const emoji = Model.generateNewEmoji();
				const newStateConfig = { id: Model.generateNewID(), icon: emoji.icon, name: "[new thing]", actions: [] };
				if (Model.data && Model.data.states) Model.data.states.push(newStateConfig);
				const stateDOM = Editor.createStateUI(newStateConfig);
				if (Editor.statesDOM) Editor.statesDOM.appendChild(stateDOM);
				publish("/ui/addState",[newStateConfig.id]);
				publish("/ui/updateStateHeaders");
				window.hasUnsavedChanges = true;
				Save.updateURL();
			}
		);
		Editor.dom.appendChild(addStateButton);
	
		// Divider
		Editor.dom.appendChild(Editor.createDivider());
	
		// --- WORLD DOM ---
		Editor.dom.appendChild(Editor.createTitle("THE <span>WORLD</span>"));
		Editor.worldDOM = document.createElement("div");
		if (window.Grid && Grid.createUI && Model.data && Model.data.world) {
		   const worldUI = Grid.createUI();
			if (worldUI) Editor.worldDOM.appendChild(worldUI);
		} else {
			 console.warn("Editor.create: Grid.createUI or Model.data.world not ready.");
			 Editor.worldDOM.appendChild(document.createTextNode("[World settings loading...]"));
		}
		Editor.dom.appendChild(Editor.worldDOM);
	
		// Divider
		Editor.dom.appendChild(Editor.createDivider());
	
		// --- SAVE / LOAD / IO --- (Only ONE instance of this block)
		Editor.dom.appendChild(Editor.createTitle("<span>SAVE</span> & <span>LOAD</span>"));
		const saveLoadSection = document.createElement("div");
		saveLoadSection.className = "editor_save_load_section";
		try {
			saveLoadSection.appendChild(Editor.createSubTitle("Local Saves"));
			const localSaveRow = document.createElement("div");
			localSaveRow.style.display = "flex"; // Basic styling for the row
			localSaveRow.style.gap = "10px";
			localSaveRow.style.alignItems = "center";
	
			Editor.savedSimsDropdown = document.createElement("select");
			Editor.savedSimsDropdown.title = "Load a previously saved simulation";
			Editor.savedSimsDropdown.style.flexGrow = "1"; // Allow dropdown to grow
			localSaveRow.appendChild(Editor.savedSimsDropdown);
			if(Editor.populateSavedSimsDropdown) Editor.populateSavedSimsDropdown(); // Populate if function exists
	
			const deleteButton = Editor.createFancyButton(
				 "<span class='button-icon'>⊗</span> Delete", // Use span for icon
				function () {
					const selectedName = Editor.savedSimsDropdown.value;
					if (selectedName && selectedName !== "_placeholder_" && confirm(/*...*/)) {
						if(Save.deleteFromLocalStorage(selectedName)){ /*...*/ } else { /*...*/ }
					}
				}
			);
			 // Apply specific delete button styles if needed (using classes is better long-term)
			deleteButton.style.flexShrink = "0";
			deleteButton.style.backgroundColor = "#b3261e"; // Error color (example)
			deleteButton.style.color = "#ffffff";
			localSaveRow.appendChild(deleteButton);
			saveLoadSection.appendChild(localSaveRow);
	
			const saveButton = Editor.createFancyButton("<span class='button-icon'>💾</span> Save Current", Save.saveModel);
			saveButton.id = "save_local_button";
			saveLoadSection.appendChild(saveButton);
	
			saveLoadSection.appendChild(Editor.createSubTitle("Share Link"));
			saveLoadSection.appendChild(Editor.createLabel("Get a shareable link:"));
			Editor.shareUrlInput = Editor.createTextInput(true); // Readonly
			Editor.shareUrlInput.placeholder = "Save simulation to generate link...";
			Editor.shareUrlInput.onclick = () => Editor.shareUrlInput.select();
			saveLoadSection.appendChild(Editor.shareUrlInput);
	
			saveLoadSection.appendChild(Editor.createSubTitle("Import / Export"));
			const importExportRow = document.createElement("div");
			importExportRow.className = "importExportRow"; // Add class for styling
	
			const fileInput = document.createElement("input"); fileInput.type="file"; fileInput.id="importFile"; fileInput.accept=".json"; fileInput.style.display="none";
			fileInput.onchange = function (event) { /* ... file reading logic ... */ };
			saveLoadSection.appendChild(fileInput); // Append hidden input somewhere accessible
	
			const importButton = Editor.createFancyButton("<span class='button-icon'>📥</span> Import File", () => fileInput.click());
			importButton.id = "import_model_button";
			importExportRow.appendChild(importButton);
	
			const exportButton = Editor.createFancyButton("<span class='button-icon'>📤</span> Export File", function () { /* ... export logic ... */ });
			exportButton.id = "export_model_button";
			importExportRow.appendChild(exportButton);
			saveLoadSection.appendChild(importExportRow);
	
		} catch(e) {
			 console.error("Error creating save/load UI:", e);
			 saveLoadSection.innerHTML = "[Error loading save/load controls]";
		}
		Editor.dom.appendChild(saveLoadSection);
	
		// Divider
		Editor.dom.appendChild(Editor.createDivider());
	
		// --- CREDITS ---
		if (window.UI && UI.options.edit === UI.ADVANCED) {
			 const creditsLabel = Editor.createLabel(`
				Designed by <a href='https://ncase.me/' target='_blank'>Nicky Case</a>~
				p.s: <a href='https://github.com/elouangrimm/emojisimulatorweb' target='_blank'>open source!</a>
				<br>Mods by Elouan Grimm and Gemini 2.5 Pro Experimental
			`);
			 creditsLabel.className = "credits_label";
			 Editor.dom.appendChild(creditsLabel);
		}
	
		// --- Subscribe to save events --- (Make sure these are only subscribed once)
		 // Consider unsubscribing previous listeners if Editor.create is called multiple times?
		 // Simple approach for now assumes Editor.create is part of a full rebuild triggered by Editor.rebuild
		subscribe("/save/shareURL/generated", function(url){
			 if (Editor.shareUrlInput) Editor.shareUrlInput.value = url || "Error generating link.";
		});
		subscribe("/save/localStorage/success", Editor.populateSavedSimsDropdown);
	
	}

        Editor.dom.appendChild(addStateButton);

        // Divider
        Editor.dom.appendChild(Editor.createDivider());

        /////////////////////
        ///// WORLD DOM /////
        /////////////////////

        Editor.dom.appendChild(Editor.createTitle("THE <span>WORLD</span>"));

        Editor.worldDOM = document.createElement("div");
        Editor.dom.appendChild(Editor.worldDOM);
        Editor.worldDOM.appendChild(Grid.createUI()); // Assumes Grid.createUI is updated if needed

        // Divider
        Editor.dom.appendChild(Editor.createDivider());

        ///////////////////////////
        ///// SAVE / LOAD / IO //// (Request 3, 6)
        ///////////////////////////
        Editor.dom.appendChild(
            Editor.createTitle("<span>SAVE</span> & <span>LOAD</span>")
        );

        const saveLoadSection = document.createElement("div");
        saveLoadSection.className = "editor_save_load_section";
        Editor.dom.appendChild(saveLoadSection);

        // --- Local Saves ---
        saveLoadSection.appendChild(Editor.createSubTitle("Local Saves"));

        const localSaveRow = document.createElement("div");
        localSaveRow.style.display = "flex";
        localSaveRow.style.gap = "10px";
        localSaveRow.style.marginBottom = "10px";

        // Dropdown for saved simulations
        Editor.savedSimsDropdown = document.createElement("select");
        Editor.savedSimsDropdown.title = "Load a previously saved simulation";
        localSaveRow.appendChild(Editor.savedSimsDropdown);
        Editor.populateSavedSimsDropdown(); // Initial population

        // Delete button
        const deleteButton = Editor.createFancyButton(
            "<span class='button-icon'>⊗</span> Delete",
            function () {
                const selectedName = Editor.savedSimsDropdown.value;
                if (
                    selectedName &&
                    selectedName !== "_placeholder_" &&
                    confirm(
                        `Are you sure you want to delete the saved simulation "${selectedName}"?`
                    )
                ) {
                    if (Save.deleteFromLocalStorage(selectedName)) {
                        publish("/notify/info", [
                            `Simulation "${selectedName}" deleted.`,
                        ]);
                    } else {
                        publish("/notify/error", [
                            `Could not find simulation "${selectedName}" to delete.`,
                        ]);
                    }
                }
            }
        );
        deleteButton.style.flexShrink = "0"; // Prevent shrinking
        deleteButton.style.height = "40px"; // Match select height better
        deleteButton.style.padding = "0 15px";
        deleteButton.style.backgroundColor = "#b3261e"; // Error color
        deleteButton.style.color = "#ffffff";
        deleteButton.style.marginBottom = "0"; // Override default margin
        localSaveRow.appendChild(deleteButton);

        saveLoadSection.appendChild(localSaveRow);

        // Save Button (Triggers Local Save + URL Gen)
        const saveButton = Editor.createFancyButton(
            "<span class='button-icon'>💾</span> Save Current",
            Save.saveModel
        );
        saveButton.id = "save_local_button"; // Assign ID if needed
        saveLoadSection.appendChild(saveButton);

        // --- Share URL ---
        saveLoadSection.appendChild(Editor.createSubTitle("Share Link"));
        saveLoadSection.appendChild(
            Editor.createLabel(
                "Get a shareable link for your current simulation:"
            )
        );
        Editor.shareUrlInput = Editor.createTextInput(true); // Readonly input
        Editor.shareUrlInput.placeholder =
            "Save simulation to generate link...";
        Editor.shareUrlInput.title = "Copy this link to share your simulation";
        Editor.shareUrlInput.onclick = () => Editor.shareUrlInput.select();
        saveLoadSection.appendChild(Editor.shareUrlInput);

        // --- Import / Export ---
        saveLoadSection.appendChild(Editor.createSubTitle("Import / Export"));

        const importExportRow = document.createElement("div");
        importExportRow.style.display = "flex";
        importExportRow.style.gap = "10px";

        // Hidden file input
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.id = "importFile"; // Used by label/button
        fileInput.accept = ".json"; // Accept only JSON files
        fileInput.style.display = "none";
        fileInput.onchange = function (event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const content = e.target.result;
                    const importedData = JSON.parse(content);
                    // Use the loadModelData function to handle loading
                    Model.loadModelData(importedData);
                    publish("/notify/success", [
                        `"${file.name}" imported successfully!`,
                    ]);
                } catch (error) {
                    console.error("Error reading or parsing file:", error);
                    alert(
                        "Failed to import file. Please ensure it's a valid JSON simulation file.\n\n" +
                            error.message
                    );
                    publish("/notify/error", ["Failed to import file."]);
                } finally {
                    // Reset file input to allow importing the same file again
                    event.target.value = null;
                }
            };
            reader.onerror = function (e) {
                console.error("Error reading file:", e);
                alert("An error occurred while reading the file.");
                publish("/notify/error", ["Error reading file."]);
                event.target.value = null;
            };
            reader.readAsText(file);
        };
        saveLoadSection.appendChild(fileInput);

        // Import Button (triggers file input)
        const importButton = Editor.createFancyButton(
            "<span class='button-icon'>📥</span> Import File",
            () => fileInput.click()
        );
        importButton.id = "import_model_button";
        importExportRow.appendChild(importButton);

        // Export Button
        const exportButton = Editor.createFancyButton(
            "<span class='button-icon'>📤</span> Export File",
            function () {
                try {
                    const modelJson = JSON.stringify(Model.data, null, 2); // Pretty print JSON
                    const blob = new Blob([modelJson], {
                        type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    const safeTitle = (Model.data.meta.title || "emoji-sim")
                        .replace(/[^a-z0-9]/gi, "_")
                        .toLowerCase();
                    a.href = url;
                    a.download = safeTitle + ".json";
                    document.body.appendChild(a); // Required for Firefox
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    publish("/notify/info", ["Exported as " + a.download]);
                } catch (error) {
                    console.error("Error exporting model:", error);
                    publish("/notify/error", ["Failed to export simulation."]);
                }
            }
        );
        exportButton.id = "export_model_button";
        importExportRow.appendChild(exportButton);

        saveLoadSection.appendChild(importExportRow);

        // Divider
        Editor.dom.appendChild(Editor.createDivider());

        //////////////////////
        ///// CREDITS /////
        //////////////////////
        if (UI.options.edit == UI.ADVANCED) {
            // Only show credits/links in advanced mode
            const creditsLabel = Editor.createLabel(`
				Designed by <a href='https://ncase.me/' target='_blank'>Nicky Case</a>~
				p.s: <a href='https://github.com/elouangrimm/emojisimulatorweb' target='_blank'>open source!</a>
				<br>Mods by Elouan Grimm and Gemini 2.5 Pro Experimental
			`);
            creditsLabel.className = "credits_label"; // Use class for styling
            Editor.dom.appendChild(creditsLabel);
        }

        // Subscribe to save events AFTER UI elements are created
        subscribe("/save/shareURL/generated", function (url) {
            if (Editor.shareUrlInput) {
                Editor.shareUrlInput.value = url || "Error generating link.";
                if (url) {
                    Editor.shareUrlInput.select();
                }
            }
        })

        // Update dropdown when local saves change
        subscribe(
            "/save/localStorage/success",
            Editor.populateSavedSimsDropdown
        );
		
    // Helper to create title headers
    Editor.createTitle = function (html) {
        const dom = document.createElement("div");
        dom.className = "editor_title";
        dom.innerHTML = html;
        return dom;
    };
    // Helper to create subtitles within sections
    Editor.createSubTitle = function (text) {
        const dom = document.createElement("h3");
        dom.textContent = text;
        return dom;
    };

    // Helper to create HR dividers
    Editor.createDivider = function () {
        return document.createElement("hr");
    };

    // Helper to create labels/help text
    Editor.createLabel = function (html) {
        const label = document.createElement("div"); // Use div for block layout
        label.className = "editor_label";
        label.innerHTML = html;
        return label;
    };

    // Helper to create text inputs
    Editor.createTextInput = function (readonly = false, placeholder = "") {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "editor_text_input";
        input.readOnly = readonly;
        input.placeholder = placeholder;
        return input;
    };

    // Helper to create fancy buttons
    Editor.createFancyButton = function (html, onClick) {
        const button = document.createElement("button"); // Use button element
        button.className = "editor_fancy_button";
        button.innerHTML = html;
        button.onclick = onClick;
        return button;
    };

    // Populate the saved simulations dropdown
    Editor.populateSavedSimsDropdown = function () {
        if (!Editor.savedSimsDropdown) return;

        const saves = Save.loadFromLocalStorage();
        const currentSelection = Editor.savedSimsDropdown.value; // Remember current selection
        Editor.savedSimsDropdown.innerHTML = ""; // Clear existing options

        // Add placeholder
        const placeholderOption = document.createElement("option");
        placeholderOption.value = "_placeholder_";
        placeholderOption.textContent = "Load a local save...";
        placeholderOption.disabled = true;
        placeholderOption.selected = !saves.some(
            (s) => s.name === currentSelection
        ); // Select if nothing else is
        Editor.savedSimsDropdown.appendChild(placeholderOption);

        // Add saved simulations
        saves.forEach((save) => {
            const option = document.createElement("option");
            option.value = save.name;
            option.textContent = save.name;
            if (save.name === currentSelection) {
                option.selected = true; // Restore selection
            }
            Editor.savedSimsDropdown.appendChild(option);
        });

        // Add event listener for loading
        Editor.savedSimsDropdown.onchange = function () {
            const selectedName = this.value;
            if (selectedName && selectedName !== "_placeholder_") {
                if (
                    window.hasUnsavedChanges &&
                    !confirm(
                        "You have unsaved changes. Loading a simulation will discard them. Continue?"
                    )
                ) {
                    // User cancelled, revert dropdown selection if possible
                    this.value = currentSelection || "_placeholder_";
                    return;
                }

                const saves = Save.loadFromLocalStorage();
                const selectedSave = saves.find((s) => s.name === selectedName);
                if (selectedSave && selectedSave.data) {
                    try {
                        const parsedData = JSON.parse(selectedSave.data);
                        Model.loadModelData(parsedData); // Load the data
                        publish("/notify/success", [
                            `Loaded "${selectedName}".`,
                        ]);
                    } catch (e) {
                        console.error("Error parsing saved data:", e);
                        alert(
                            `Error loading "${selectedName}". The saved data might be corrupted.`
                        );
                        publish("/notify/error", [
                            `Error loading "${selectedName}".`,
                        ]);
                    }
                }
            }
        };
    };

    // Create States UI (Minor changes: remove description textarea)
    Editor.createStatesUI = function (dom, stateConfigs) {
        // For each state config...
        stateConfigs.forEach((stateConfig) => {
            const stateDOM = Editor.createStateUI(stateConfig);
            dom.appendChild(stateDOM);
        });
    };

    // Create State UI (Minor changes: remove description textarea creation)
    Editor.createStateUI = function (stateConfig) {
        const dom = document.createElement("div");
        dom.className = "editor_state";
        dom.dataset.stateId = stateConfig.id;

        const stateHeader = document.createElement("div");
        stateHeader.className = "editor_state_header";
        dom.appendChild(stateHeader);

        const icon = document.createElement("input");
        icon.className = "editor_icon";
        icon.type = "text";
        icon.value = stateConfig.icon;
        icon.maxLength = 2; // Limit icon length
        icon.oninput = function () {
            stateConfig.icon = icon.value;
            publish("/ui/updateStateHeaders");
            window.hasUnsavedChanges = true;
            Save.updateURL();
        };
        icon.onclick = () => icon.select();
        stateHeader.appendChild(icon);

        // Name Input (keep as is)
        const name = document.createElement("input");
        name.className = "editor_name";
        name.type = "text";
        name.value = stateConfig.name;
        name.oninput = function () {
            stateConfig.name = name.value;
            publish("/ui/updateStateHeaders");
            window.hasUnsavedChanges = true;
            Save.updateURL();
        };
        name.onchange = Save.updateURL;
        stateHeader.appendChild(name);

        // Delete Button (keep as is)
        if (stateConfig.id != 0) {
            const deleteDOM = document.createElement("div");
            deleteDOM.className = "delete_state";
            deleteDOM.innerHTML = "⊗";
            deleteDOM.title = "Delete this state";
            // Use closure to capture correct stateConfig and dom element
            (function (currentConfig, currentDOM) {
                deleteDOM.onclick = function () {
                    if (
                        confirm(
                            `Are you sure you want to delete the state "${currentConfig.name}"?`
                        )
                    ) {
                        Model.removeStateByID(currentConfig.id); // Splice away (already marks unsaved & updates URL)
                        publish("/ui/removeState", [currentConfig.id]); // remove state
                        publish("/ui/updateStateHeaders"); // update state headers
                        if (
                            Editor.statesDOM &&
                            currentDOM.parentNode === Editor.statesDOM
                        ) {
                            Editor.statesDOM.removeChild(currentDOM); // and, remove this DOM child
                        }
                    }
                };
            })(stateConfig, dom);
            stateHeader.appendChild(deleteDOM);
        }

        // Actions (keep as is)
        const actionConfigs = (stateConfig.actions = stateConfig.actions || []);
        const actionsDOM = Editor.createActionsUI(actionConfigs);
        dom.appendChild(actionsDOM);

        return dom;
    };

    // Actions UI - Uses helper functions now
    Editor.createActionsUI = function (actionConfigs, dom) {
        // Reset/Create DOM
        if (!dom) {
            dom = document.createElement("div");
            dom.className = "editor_actions";
        }
        dom.innerHTML = ""; // Clear existing content

        // List
        const list = document.createElement("ul");
        dom.appendChild(list);

        // All them actions
        actionConfigs.forEach((actionConfig) => {
            const entry = document.createElement("li");
            list.appendChild(entry);

            // Delete button (using closure to capture correct config and elements)
            const deleteDOM = document.createElement("div");
            deleteDOM.className = "delete_action";
            deleteDOM.innerHTML = "⊗";
            deleteDOM.title = "Delete this action";
            (function (configToDelete, parentList, itemElement) {
                deleteDOM.onclick = function () {
                    const index = actionConfigs.indexOf(configToDelete);
                    if (index > -1) {
                        actionConfigs.splice(index, 1); // Splice away
                        parentList.removeChild(itemElement); // remove entry
                        window.hasUnsavedChanges = true;
                        Save.updateURL(); // Update URL
                    } else {
                        console.warn("Could not find action to delete.");
                    }
                };
            })(actionConfig, list, entry);
            entry.appendChild(deleteDOM);

            // The actual action UI
            const actionDOM = Editor.createActionUI(actionConfig);
            entry.appendChild(actionDOM);
        });

        // Add action button
        const addEntry = document.createElement("li");
        const addActionControl = Editor.createActionAdder(actionConfigs, dom);
        addEntry.appendChild(addActionControl);
        list.appendChild(addEntry);

        return dom;
    };

    Editor.createActionUI = function (actionConfig) {
        if (
            !actionConfig ||
            !actionConfig.type ||
            !Actions[actionConfig.type]
        ) {
            console.error("Invalid action config or type:", actionConfig);
            const errorDom = document.createElement("span");
            errorDom.textContent = "[Error: Invalid Action]";
            errorDom.style.color = "red";
            return errorDom;
        }
        const action = Actions[actionConfig.type];
        return action.ui(actionConfig);
    };

    Editor.createActionAdder = function (actionConfigs, domToUpdate) {
        const keyValues = [
            { name: "+ Add New Action", value: "" }, // Placeholder/Trigger text
        ];

        // Populate with Actions
        for (const key in Actions) {
            const action = Actions[key];
            keyValues.push({ name: action.name, value: key });
        }

        // Create select (placeholder options)
        const tempConfig = { action: "" }; // Temporary object for selector
        const propName = "action";
        const select = Editor.createSelector(keyValues, tempConfig, propName);

        // Select has new onchange
        select.onchange = function () {
            const selectedValue = select.value;
            // default, do nothing
            if (selectedValue === "") return;

            // otherwise, add new action to this array
            const defaultProps = Actions[selectedValue].props;
            const newActionConfig = JSON.parse(JSON.stringify(defaultProps)); // Deep clone defaults
            newActionConfig.type = selectedValue;
            actionConfigs.push(newActionConfig);

            // then, force the parent actions DOM to re-render
            Editor.createActionsUI(actionConfigs, domToUpdate); // Pass the DOM to update

            window.hasUnsavedChanges = true;
            Save.updateURL(); // Update URL
        };

        select.className = "editor_new_action_select"; // Add a class if specific styling needed

        // Wrap in a simple container for layout within the LI if needed
        const container = document.createElement("div");
        container.className = "editor_new_action_container"; // Add class for styling
        container.appendChild(select);
        return container;
    };

    // Selector (Dropdown) - General purpose
    Editor.createSelector = function (
        keyValues,
        configObject,
        propName,
        options
    ) {
        const select = document.createElement("select");
        options = options || {};
        if (options.maxWidth) select.style.maxWidth = options.maxWidth;

        keyValues.forEach((keyValue) => {
            const option = document.createElement("option");
            option.innerHTML = keyValue.name; // Use innerHTML for potential icons/markup
            option.value = keyValue.value;
            select.appendChild(option);

            // Set selected state (handle potential type mismatch)
            if (String(keyValue.value) === String(configObject[propName])) {
                option.selected = true;
            }
        });

        // Update the config object on change
        select.onchange = function () {
            configObject[propName] = select.value; // Store the value
            window.hasUnsavedChanges = true; // Mark changes
            // Don't update URL on every dropdown change, maybe only for specific ones like world settings
            if (options.updateUrlOnChange) {
                Save.updateURL();
            }
            // Publish message if provided
            if (options.message) {
                publish(options.message);
            }
        };

        // Initial URL update if needed
        if (options.updateUrlOnChange) {
            // Save.updateURL(); // Potentially too frequent on init
        }

        return select;
    };

    // State Selector (Specific type of selector)
    Editor.createStateSelector = function (configObject, propName) {
        const select = document.createElement("select");

        const populateList = () => {
            const currentSelectedValue = select.value; // Remember selection
            select.innerHTML = ""; // Clear old options
            const stateConfigs = Model.data.states;
            let foundSelected = false;

            stateConfigs.forEach((stateConfig) => {
                const option = document.createElement("option");
                option.innerHTML = `${stateConfig.icon}: ${stateConfig.name}`;
                option.value = stateConfig.id;
                select.appendChild(option);

                // Check if this should be selected
                if (String(stateConfig.id) === String(configObject[propName])) {
                    option.selected = true;
                    foundSelected = true;
                } else if (
                    String(stateConfig.id) === String(currentSelectedValue) &&
                    !configObject[propName]
                ) {
                    // If the config doesn't have a value yet, but this was previously selected, keep it
                    option.selected = true;
                    foundSelected = true; // Consider it found for setting config below
                    configObject[propName] = stateConfig.id; // Set the value in the config now
                }
            });

            // If the stored ID in configObject no longer exists, default to state 0 (blank)
            if (!foundSelected) {
                configObject[propName] = 0; // Default to state 0
                if (select.options.length > 0) {
                    const optionZero = Array.from(select.options).find(
                        (opt) => opt.value === "0"
                    );
                    if (optionZero) optionZero.selected = true;
                    else select.options[0].selected = true; // Fallback to first option
                }
            }
            // Update URL if needed (state changes are significant)
            // Save.updateURL(); // Potentially too frequent
        };

        // Update the config object on change
        select.onchange = function () {
            const newValue = select.value;
            // Only mark change if value actually changes
            if (configObject[propName] != newValue) {
                configObject[propName] = newValue;
                window.hasUnsavedChanges = true;
                Save.updateURL(); // Update URL on state selection change
            }
        };

        // Initial population
        populateList();

        // Subscribe to changes in state headers (icon, name, add, delete)
        const listener1 = subscribe("/ui/updateStateHeaders", populateList);
        const listener2 = subscribe("/ui/removeState", populateList); // Repopulate when state is removed
        const listener3 = subscribe("/ui/addState", populateList); // Repopulate when state is added

        // Unsubscribe on reset to prevent memory leaks
        const listenerMetaReset = subscribe("/meta/reset", function () {
            unsubscribe(listener1);
            unsubscribe(listener2);
            unsubscribe(listener3);
            unsubscribe(listenerMetaReset);
        });

        return select;
    };

    // Number Input
    Editor.createNumber = function (configObject, propName, options) {
        options = options || {};
        options.multiplier = options.multiplier || 1;
        options.min = options.min !== undefined ? options.min : 0; // Allow 0 min
        options.max = options.max !== undefined ? options.max : 100; // Allow 0 max? No.
        options.step = options.step || 1;
        options.integer = options.integer || false; // Default to float

        const input = document.createElement("input");
        input.type = "text"; // Use text for scrubbing and formatting
        input.value = (configObject[propName] * options.multiplier).toFixed(
            options.integer ? 0 : 1
        );
        input.className = "editor_number";
        input.options = options; // Store options directly on element for scrubbing logic

        const formatValue = (value) => {
            let num = options.integer ? parseInt(value) : parseFloat(value);
            if (isNaN(num)) num = options.min; // Default to min if invalid

            // Clamp value
            num = Math.max(options.min, Math.min(options.max, num));

            return num;
        };

        const updateModel = (value) => {
            const modelValue = value / options.multiplier;
            // Only update and mark unsaved if value actually changed
            if (configObject[propName] !== modelValue) {
                configObject[propName] = modelValue;
                window.hasUnsavedChanges = true;
                // Maybe only update URL on change/blur, not input
                // Save.updateURL();
            }
            // Message?
            if (options.message) publish(options.message);
        };

        // Update on input (live typing/scrubbing)
        input.oninput = function () {
            // Don't format strictly during input to allow typing decimals/negatives
            const currentVal = options.integer
                ? parseInt(input.value)
                : parseFloat(input.value);
            if (!isNaN(currentVal)) {
                // Only update model if it's a number
                const clampedVal = Math.max(
                    options.min,
                    Math.min(options.max, currentVal)
                );
                updateModel(clampedVal);
            }
        };

        // On change (blur), format and clamp strictly
        input.onchange = function () {
            const number = formatValue(input.value);
            input.value = number.toFixed(options.integer ? 0 : 1); // Format correctly
            updateModel(number); // Ensure model has the final formatted value
            Save.updateURL(); // Update URL after number input is finalized
        };

        // Make it scrubbable (using UI._makeScrubbable defined elsewhere)
        if (window._makeScrubbable) {
            // Check if function exists
            _makeScrubbable(input);
        } else {
            console.warn("_makeScrubbable function not found.");
        }

        return input;
    };

    // Proportions Input
    Editor.createProportions = function () {
        const dom = document.createElement("div");
        dom.className = "proportions";
        let sliders = []; // Keep track of sliders

        const populate = () => {
            dom.innerHTML = ""; // Clear
            sliders = []; // Reset sliders array
            const proportions = (Model.data.world.proportions =
                Model.data.world.proportions || []);
            const states = Model.data.states;

            // Ensure proportions array matches current states
            const oldProportionsMap = new Map(
                proportions.map((p) => [p.stateID, p.parts])
            );
            const newProportions = states.map((state) => ({
                stateID: state.id,
                parts: oldProportionsMap.get(state.id) || 0, // Default to 0 if state is new
            }));

            // Replace proportions in Model.data
            Model.data.world.proportions.length = 0; // Clear original array
            Array.prototype.push.apply(
                Model.data.world.proportions,
                newProportions
            ); // Push new items

            // Calculate initial total for normalization
            let totalParts = newProportions.reduce(
                (sum, p) => sum + p.parts,
                0
            );
            if (totalParts <= 0) {
                // Avoid division by zero, set equal parts if all zero
                totalParts = newProportions.length || 1; // Avoid division by zero
                newProportions.forEach((p) => (p.parts = 1));
            }

            // Create UI for each proportion
            newProportions.forEach((proportion, index) => {
                const state = Model.getStateByID(proportion.stateID);
                if (!state) return; // Skip if state somehow doesn't exist

                const lineDOM = document.createElement("div");
                dom.appendChild(lineDOM);

                const iconDOM = document.createElement("span");
                iconDOM.innerHTML = state.icon;
                iconDOM.title = state.name;
                lineDOM.appendChild(iconDOM);

                const slider = document.createElement("input");
                slider.type = "range";
                slider.min = 0;
                slider.max = 100;
                slider.step = 1;
                // Normalize initial value
                slider.value = Math.round(
                    (proportion.parts / totalParts) * 100
                );
                proportion.parts = parseFloat(slider.value); // Update model immediately with normalized value

                slider.dataset.index = index; // Store index
                sliders.push(slider);
                lineDOM.appendChild(slider);

                // --- Event handling using closures ---
                let snapshot = []; // Snapshot for dragging
                slider.onmousedown = function () {
                    snapshot = sliders.map((s) => parseFloat(s.value)); // Create snapshot of current UI values
                };

                slider.oninput = function () {
                    const currentIndex = parseInt(this.dataset.index);
                    const currentValue = parseFloat(this.value);
                    const oldValue = snapshot[currentIndex];
                    const delta = currentValue - oldValue;

                    let otherTotal = 0;
                    snapshot.forEach((val, i) => {
                        if (i !== currentIndex) otherTotal += val;
                    });

                    let scale = 1;
                    if (otherTotal > 0) {
                        // Calculate scale needed for others to make total 100
                        scale = (100 - currentValue) / otherTotal;
                    } else if (sliders.length > 1) {
                        // If others were zero, distribute remaining evenly
                        const remainingValue =
                            (100 - currentValue) / (sliders.length - 1);
                        sliders.forEach((s, i) => {
                            if (i !== currentIndex) {
                                s.value = Math.round(remainingValue);
                                Model.data.world.proportions[i].parts =
                                    Math.round(remainingValue);
                            }
                        });
                        // Update current slider's model data
                        Model.data.world.proportions[currentIndex].parts =
                            currentValue;
                        normalizeProportions(); // Final normalization pass maybe needed
                        Grid.reinitialize();
                        window.hasUnsavedChanges = true;
                        Save.updateURL(); // Update URL after proportions change
                        return; // Skip scaling logic below
                    }

                    // Apply scaling to other sliders based on snapshot
                    let appliedTotal = currentValue; // Start with the current slider's value
                    sliders.forEach((s, i) => {
                        if (i !== currentIndex) {
                            const scaledValue = Math.round(snapshot[i] * scale);
                            s.value = scaledValue;
                            Model.data.world.proportions[i].parts = scaledValue;
                            appliedTotal += scaledValue;
                        } else {
                            Model.data.world.proportions[i].parts =
                                currentValue; // Update model for current
                        }
                    });

                    // Adjust rounding errors to ensure total is 100
                    let diff = 100 - appliedTotal;
                    if (diff !== 0 && sliders.length > 1) {
                        // Apply difference to the edited slider or the largest other slider
                        let adjustIndex = currentIndex;
                        if (Math.abs(diff) > 0 && sliders.length > 1) {
                            // Find a slider to adjust (e.g., the one being dragged or largest non-zero)
                            let largestOtherIdx = -1;
                            let largestOtherVal = -1;
                            sliders.forEach((s, i) => {
                                if (
                                    i !== currentIndex &&
                                    parseFloat(s.value) > largestOtherVal
                                ) {
                                    largestOtherVal = parseFloat(s.value);
                                    largestOtherIdx = i;
                                }
                            });
                            adjustIndex =
                                largestOtherIdx !== -1 &&
                                parseFloat(sliders[adjustIndex].value) + diff <
                                    0
                                    ? largestOtherIdx
                                    : currentIndex;
                            if (
                                parseFloat(sliders[adjustIndex].value) + diff >=
                                0
                            ) {
                                // Ensure adjustment doesn't go below 0
                                sliders[adjustIndex].value =
                                    parseFloat(sliders[adjustIndex].value) +
                                    diff;
                                Model.data.world.proportions[
                                    adjustIndex
                                ].parts = parseFloat(
                                    sliders[adjustIndex].value
                                );
                            } else {
                                // Fallback: Distribute diff among others if primary adjustment fails
                                normalizeProportions();
                            }
                        }
                    }

                    Grid.reinitialize(); // Reinitialize grid on change
                    window.hasUnsavedChanges = true; // Mark changes
                    Save.updateURL(); // Update URL after proportions change
                };
            });

            // Disable if only one state
            if (sliders.length === 1) {
                sliders[0].value = 100;
                sliders[0].disabled = true;
                Model.data.world.proportions[0].parts = 100;
            }
            normalizeProportions(); // Ensure initial state is normalized
        };

        // Helper function to ensure proportions add up to 100 after programmatic changes
        const normalizeProportions = () => {
            if (!Model.data.world || !Model.data.world.proportions) return;
            const props = Model.data.world.proportions;
            let total = props.reduce((sum, p) => sum + p.parts, 0);
            if (total <= 0 || props.length === 0) return; // Nothing to normalize or avoid div by zero

            let checkTotal = 0;
            props.forEach((p, index) => {
                const normalized = Math.round((p.parts / total) * 100);
                p.parts = normalized;
                if (sliders[index]) sliders[index].value = normalized; // Update UI
                checkTotal += normalized;
            });

            // Adjust rounding errors
            let diff = 100 - checkTotal;
            if (diff !== 0 && props.length > 0) {
                // Add/subtract difference from the largest proportion
                let largestIndex = 0;
                props.forEach((p, index) => {
                    if (p.parts > props[largestIndex].parts) {
                        largestIndex = index;
                    }
                });
                props[largestIndex].parts += diff;
                if (props[largestIndex].parts < 0)
                    props[largestIndex].parts = 0; // Don't go below zero
                if (sliders[largestIndex])
                    sliders[largestIndex].value = props[largestIndex].parts;
            }
        };

        // Initial population
        populate();
        normalizeProportions(); // Ensure it's normalized initially

        // Subscribe to state changes
        const listener1 = subscribe("/ui/updateStateHeaders", () => {
            populate();
            normalizeProportions();
            Grid.reinitialize(); // Reinit grid when states change
            window.hasUnsavedChanges = true; // Mark changes
            Save.updateURL();
        });
        const listener2 = subscribe("/meta/reset", function () {
            unsubscribe(listener1);
            unsubscribe(listener2);
        });

        return dom;
    };

    /////////////////////////
    ///// EDITOR HELPER ///// (Used internally by Editor.create*)
    /////////////////////////

    const EditorShortcuts = function (dom) {
        const self = this;
        self.dom = dom;

        const _shortcut = function (funcName, EditorFunc) {
            const nickname =
                funcName.charAt(0).toLowerCase() + funcName.substring(1);
            self[nickname] = function (...args) {
                // Use rest parameters
                const insertDOM = EditorFunc.apply(null, args); // Use apply
                self.dom.appendChild(insertDOM);
                return self; // Return the helper itself for chaining
            };
        };

        _shortcut("Label", Editor.createLabel);
        _shortcut("StateSelector", Editor.createStateSelector);
        _shortcut("Selector", Editor.createSelector);
        _shortcut("Number", Editor.createNumber);
        _shortcut("ActionsUI", Editor.createActionsUI);
        _shortcut("Proportions", Editor.createProportions);
    };

    // Factory for the helper
    exports.EditorHelper = function (tag = "span") {
        // Default tag
        const dom = document.createElement(tag);
        const shortcut = new EditorShortcuts(dom);
        return shortcut;
    };
})(window); // End of Editor module
