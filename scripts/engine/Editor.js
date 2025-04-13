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


    // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
    // >>>>> DEFINE ALL HELPER FUNCTIONS FIRST <<<<<
    // >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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
    Editor.createLabel = function(html){
        const label = document.createElement("div"); // Use div for block layout
        label.className = "editor_label";
        label.innerHTML = html;
        return label;
    };

    // Helper to create text inputs
    Editor.createTextInput = function(readonly = false, placeholder = "") {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "editor_text_input"; // Use consistent class
        input.readOnly = readonly;
        input.placeholder = placeholder;
        return input;
    };

    // Helper to create fancy buttons
    Editor.createFancyButton = function(html, onClick) {
        const button = document.createElement("button"); // Use button element
        button.className = "editor_fancy_button"; // Use consistent class
        button.innerHTML = html;
        if (onClick) {
            button.onclick = onClick;
        }
        return button;
    };

    // Helper to populate the saved simulations dropdown
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


    // Create States UI
    Editor.createStatesUI = function (dom, stateConfigs) {
         if(!dom || !stateConfigs) return; // Guard clause
         dom.innerHTML = ''; // Clear previous states first
         stateConfigs.forEach((stateConfig) => {
            const stateDOM = Editor.createStateUI(stateConfig);
            if(stateDOM) dom.appendChild(stateDOM);
        });
    };

    // Create State UI
    Editor.createStateUI = function (stateConfig) {
        if(!stateConfig) return null; // Guard clause
        const dom = document.createElement("div");
        dom.className = "editor_state";
        dom.dataset.stateId = stateConfig.id;

        const stateHeader = document.createElement("div");
        stateHeader.className = "editor_state_header";
        dom.appendChild(stateHeader);

        const icon = document.createElement("input");
        icon.className = "editor_icon";
        icon.type = "text";
        icon.value = stateConfig.icon || '';
        icon.maxLength = 2;
        icon.title = "Enter emoji (Mac: Cmd+Ctrl+Space)";
        icon.oninput = function () {
            stateConfig.icon = icon.value;
            publish("/ui/updateStateHeaders");
            window.hasUnsavedChanges = true;
            Save.updateURL();
        };
        icon.onclick = () => icon.select();
        stateHeader.appendChild(icon);

        const name = document.createElement("input");
        name.className = "editor_name";
        name.type = "text";
        name.value = stateConfig.name || '[unnamed]';
        name.oninput = function () {
            stateConfig.name = name.value;
            publish("/ui/updateStateHeaders");
            window.hasUnsavedChanges = true;
            Save.updateURL();
        };
        name.onchange = Save.updateURL;
        stateHeader.appendChild(name);

        if (stateConfig.id != 0) { // Don't allow deleting state 0
            const deleteDOM = document.createElement("div");
            deleteDOM.className = "delete_state";
            deleteDOM.innerHTML = "⊗";
            deleteDOM.title = "Delete this state";
            (function (currentConfig, currentDOM) { // Closure to capture correct vars
                deleteDOM.onclick = function () {
                    if (confirm(`Are you sure you want to delete the state "${currentConfig.name}"?`)) {
                        Model.removeStateByID(currentConfig.id);
                        publish("/ui/removeState", [currentConfig.id]);
                        publish("/ui/updateStateHeaders");
                        if (Editor.statesDOM && currentDOM.parentNode === Editor.statesDOM) {
                            Editor.statesDOM.removeChild(currentDOM);
                        }
                    }
                };
            })(stateConfig, dom);
            stateHeader.appendChild(deleteDOM);
        }

        const actionConfigs = (stateConfig.actions = stateConfig.actions || []);
        const actionsDOM = Editor.createActionsUI(actionConfigs); // Use helper
        dom.appendChild(actionsDOM);

        return dom;
    };

     // Create Actions UI
     Editor.createActionsUI = function (actionConfigs, dom) {
        if (!dom) {
            dom = document.createElement("div");
            dom.className = "editor_actions";
        }
        dom.innerHTML = ""; // Clear existing content

        const list = document.createElement("ul");
        dom.appendChild(list);

        actionConfigs.forEach((actionConfig) => {
            const entry = document.createElement("li");
            list.appendChild(entry);

            const deleteDOM = document.createElement("div");
            deleteDOM.className = "delete_action";
            deleteDOM.innerHTML = "⊗";
            deleteDOM.title = "Delete this action";
            (function (configToDelete, parentList, itemElement) { // Closure
                deleteDOM.onclick = function () {
                    const index = actionConfigs.indexOf(configToDelete);
                    if (index > -1) {
                        actionConfigs.splice(index, 1);
                        parentList.removeChild(itemElement);
                        window.hasUnsavedChanges = true;
                        Save.updateURL();
                    } else {
                        console.warn("Could not find action to delete.");
                    }
                };
            })(actionConfig, list, entry);
            entry.appendChild(deleteDOM);

            const actionDOM = Editor.createActionUI(actionConfig); // Use helper
            entry.appendChild(actionDOM);
        });

        const addEntry = document.createElement("li");
        const addActionControl = Editor.createActionAdder(actionConfigs, dom); // Use helper
        addEntry.appendChild(addActionControl);
        list.appendChild(addEntry);

        return dom;
     };

     // Create Action UI (Wrapper for specific action UI builders)
     Editor.createActionUI = function (actionConfig) {
         if (!actionConfig || !actionConfig.type || !window.Actions || !Actions[actionConfig.type]) {
             console.error("Invalid action config or Actions library missing:", actionConfig);
             const errorDom = document.createElement('span'); errorDom.textContent = "[Error]"; errorDom.style.color='red'; return errorDom;
         }
         const action = Actions[actionConfig.type];
         if (typeof action.ui !== 'function') {
              console.error(`Action type "${actionConfig.type}" does not have a .ui() method.`);
              const errorDom = document.createElement('span'); errorDom.textContent = `[UI Error: ${actionConfig.type}]`; errorDom.style.color='orange'; return errorDom;
         }
         return action.ui(actionConfig); // Assumes action.ui exists and returns a DOM element
     };

     // Create Action Adder (The "+ Add New Action" dropdown)
     Editor.createActionAdder = function (actionConfigs, domToUpdate) {
        const keyValues = [{ name: "+ Add New Action", value: "" }];
        if (window.Actions) { // Check if Actions object exists
             for (const key in Actions) {
                 const action = Actions[key];
                 if (action && action.name) { // Check if action and name exist
                     keyValues.push({ name: action.name, value: key });
                 }
             }
        } else {
            console.error("Actions object not found for createActionAdder.");
        }

        const tempConfig = { action: "" };
        const propName = "action";
        const select = Editor.createSelector(keyValues, tempConfig, propName); // Use helper

        select.onchange = function () {
            const selectedValue = select.value;
            if (selectedValue === "" || !window.Actions || !Actions[selectedValue]) return; // Ignore placeholder or invalid

            const defaultProps = Actions[selectedValue].props;
            const newActionConfig = JSON.parse(JSON.stringify(defaultProps || {})); // Deep clone defaults
            newActionConfig.type = selectedValue;
            actionConfigs.push(newActionConfig);

            Editor.createActionsUI(actionConfigs, domToUpdate); // Re-render

            window.hasUnsavedChanges = true;
            Save.updateURL();
        };

        select.className = "editor_new_action_select"; // Assign class for styling

        const container = document.createElement("div");
        container.className = "editor_new_action_container";
        container.appendChild(select);
        return container;
     };

     // Create Selector (Dropdown) - General purpose
     Editor.createSelector = function (keyValues, configObject, propName, options) {
        const select = document.createElement("select");
        options = options || {};
        if (options.maxWidth) select.style.maxWidth = options.maxWidth;

        keyValues.forEach((keyValue) => {
            const option = document.createElement("option");
            option.innerHTML = keyValue.name;
            option.value = keyValue.value;
            select.appendChild(option);
            if (String(keyValue.value) === String(configObject[propName])) {
                option.selected = true;
            }
        });

        select.onchange = function () {
            const newValue = select.value;
            // Only trigger change if value is different
            if (String(configObject[propName]) !== String(newValue)) {
                configObject[propName] = newValue;
                window.hasUnsavedChanges = true;
                if (options.updateUrlOnChange) {
                    Save.updateURL();
                }
                if (options.message) {
                    publish(options.message);
                }
            }
        };
        return select;
     };

     // Create State Selector
     Editor.createStateSelector = function (configObject, propName) {
         const select = document.createElement("select");

        const populateList = () => {
            const currentSelectedValue = select.value;
            select.innerHTML = ""; // Clear old options
            if (!Model.data || !Model.data.states) { // Guard clause
                 console.warn("createStateSelector: Model.data.states not available for populateList.");
                 return;
            }
            const stateConfigs = Model.data.states;
            let foundSelected = false;

            stateConfigs.forEach((stateConfig) => {
                const option = document.createElement("option");
                option.innerHTML = `${stateConfig.icon || '▫️'}: ${stateConfig.name || '[unnamed]'}`; // Use fallback icon/name
                option.value = stateConfig.id;
                select.appendChild(option);
                if (String(stateConfig.id) === String(configObject[propName])) {
                    option.selected = true;
                    foundSelected = true;
                } else if (String(stateConfig.id) === String(currentSelectedValue) && !configObject[propName]) {
                    option.selected = true;
                    foundSelected = true;
                    configObject[propName] = stateConfig.id;
                }
            });

            if (!foundSelected) {
                configObject[propName] = 0; // Default to state 0
                const optionZero = Array.from(select.options).find(opt => opt.value === '0');
                if (optionZero) optionZero.selected = true;
                else if (select.options.length > 0) select.options[0].selected = true; // Fallback
            }
        };

        select.onchange = function () {
            const newValue = select.value;
            if (configObject[propName] != newValue) {
                configObject[propName] = newValue;
                window.hasUnsavedChanges = true;
                Save.updateURL();
            }
        };

        populateList(); // Initial population

        // Subscribe to changes
        const listener1 = subscribe("/ui/updateStateHeaders", populateList);
        const listener2 = subscribe("/ui/removeState", populateList);
        const listener3 = subscribe("/ui/addState", populateList);
        const listenerMetaReset = subscribe("/meta/reset", function () {
            unsubscribe(listener1); unsubscribe(listener2); unsubscribe(listener3); unsubscribe(listenerMetaReset);
        });

        return select;
     };

     // Create Number Input
     Editor.createNumber = function (configObject, propName, options) {
        options = options || {};
        options.multiplier = options.multiplier || 1;
        options.min = options.min !== undefined ? options.min : 0;
        options.max = options.max !== undefined ? options.max : 100;
        options.step = options.step || 1;
        options.integer = options.integer || false;

        const input = document.createElement("input");
        input.type = "text";
        // Ensure configObject[propName] exists before multiplying
        const initialValue = configObject[propName] !== undefined ? configObject[propName] : options.min / options.multiplier; // Default to min value
        input.value = (initialValue * options.multiplier).toFixed(options.integer ? 0 : 1);
        input.className = "editor_number";
        input.options = options;

        const formatValue = (value) => {
            let num = options.integer ? parseInt(value) : parseFloat(value);
            if (isNaN(num)) num = options.min;
            num = Math.max(options.min, Math.min(options.max, num));
            return num;
        };

        const updateModel = (value) => {
            const modelValue = value / options.multiplier;
            if (configObject[propName] !== modelValue) {
                configObject[propName] = modelValue;
                window.hasUnsavedChanges = true;
                // Optional: Save.updateURL(); // maybe only on change/blur
            }
            if (options.message) publish(options.message);
        };

        input.oninput = function () {
            const currentVal = options.integer ? parseInt(input.value) : parseFloat(input.value);
            if (!isNaN(currentVal)) {
                const clampedVal = Math.max(options.min, Math.min(options.max, currentVal));
                updateModel(clampedVal); // Update model as user types/scrubs
            }
        };

        input.onchange = function () { // On blur
            const number = formatValue(input.value);
            input.value = number.toFixed(options.integer ? 0 : 1); // Format display
            updateModel(number); // Ensure model matches formatted value
            Save.updateURL(); // Update URL on final change
        };

        if (window._makeScrubbable) {
            _makeScrubbable(input);
        } else { console.warn("_makeScrubbable function not found."); }

        return input;
     };

     // Create Proportions Input
     Editor.createProportions = function () {
         const dom = document.createElement("div");
         dom.className = "proportions";
         let sliders = [];

         const populate = () => { /* ... implementation ... */ }; // Keep full implementation
         const normalizeProportions = () => { /* ... implementation ... */ }; // Keep full implementation

         populate();
         normalizeProportions();

         const listener1 = subscribe("/ui/updateStateHeaders", () => { /* ... */ });
         const listener2 = subscribe("/meta/reset", function () { /* ... */ });

         return dom;
     };

     // Editor Helper (Factory for chaining UI creation)
     const EditorShortcuts = function(dom){
          const self = this;
          self.dom = dom;
          const _shortcut = function(funcName, EditorFunc){
               const nickname = funcName.charAt(0).toLowerCase() + funcName.substring(1);
               self[nickname] = function(...args){
                    const insertDOM = EditorFunc.apply(null, args);
                    if(insertDOM) self.dom.appendChild(insertDOM); // Only append if element is returned
                    return self;
               };
          };
          // Add shortcuts for all defined Editor.create* helpers
          _shortcut("Label", Editor.createLabel);
          _shortcut("StateSelector", Editor.createStateSelector);
          _shortcut("Selector", Editor.createSelector);
          _shortcut("Number", Editor.createNumber);
          _shortcut("ActionsUI", Editor.createActionsUI);
          _shortcut("Proportions", Editor.createProportions);
           _shortcut("SubTitle", Editor.createSubTitle);
           _shortcut("Divider", Editor.createDivider);
           _shortcut("TextInput", Editor.createTextInput);
           _shortcut("FancyButton", Editor.createFancyButton);
           // Add Title? Editor.createTitle might conflict if used inside helper chain
     };
     exports.EditorHelper = function(tag = "span"){
          const dom = document.createElement(tag);
          const shortcut = new EditorShortcuts(dom);
          return shortcut;
     };

     // --- Add Editor.rebuild function (defined before it's subscribed) ---
      Editor.rebuild = function() {
         console.log("Editor.js: Rebuilding editor UI...");
         if (!Editor.dom) return;
         while (Editor.dom.firstChild) { Editor.dom.removeChild(Editor.dom.firstChild); }
         Editor.create(); // Now helpers are guaranteed to exist
         if (Editor.updateTitleUI) Editor.updateTitleUI();
         if (window.Ps && document.getElementById("editor_container")) {
             try { Ps.update(document.getElementById('editor_container')); } catch(err){}
         }
         console.log("Editor.js: Editor UI rebuilt.");
     };
     // --- End Helper Function Definitions ---


    // --- NOW DEFINE THE MAIN Editor.create FUNCTION ---
    Editor.create = function () {
        console.log("Editor.js: Editor.create called.");

        if (window.UI && UI.options.edit === UI.NONE) {
            console.log("Editor.create: Editor UI is disabled.");
            return;
        }

        // --- Title Input ---
        Editor.titleInput = document.createElement("input");
        Editor.titleInput.type = "text";
        Editor.titleInput.className = "editor_main_title_input";
        Editor.titleInput.value = (Model.data && Model.data.meta && Model.data.meta.title) || "Untitled Simulation";
        Editor.titleInput.placeholder = "Simulation Title";
        Editor.titleInput.oninput = function () {
            const newTitle = Editor.titleInput.value || "Untitled Simulation";
            if (Model.data && Model.data.meta) Model.data.meta.title = newTitle;
            document.title = newTitle + " - Emoji Simulator! 😘";
            window.hasUnsavedChanges = true;
            Save.updateURL();
        };
        Editor.titleInput.onchange = Save.updateURL;
        Editor.dom.appendChild(Editor.titleInput);
        Editor.updateTitleUI = () => {
            if (Editor.titleInput) Editor.titleInput.value = (Model.data && Model.data.meta && Model.data.meta.title) || "Untitled Simulation";
            document.title = ((Model.data && Model.data.meta && Model.data.meta.title) || "Untitled Simulation") + " - Emoji Simulator! 😘";
        };
        Editor.updateTitleUI();

        Editor.dom.appendChild(Editor.createDivider());

        // --- STATES DOM ---
        Editor.dom.appendChild(Editor.createTitle("<span>THINGS</span> WITH RULES"));
        Editor.statesDOM = document.createElement("div");
        Editor.dom.appendChild(Editor.statesDOM);
        if (Model.data && Model.data.states) {
            Editor.createStatesUI(Editor.statesDOM, Model.data.states);
        } else { console.warn("Editor.create: Model.data.states not ready for createStatesUI."); }

        const addStateButton = Editor.createFancyButton(
            "<span class='button-icon'>+</span> New Thing",
            function(){ /* ... add state logic ... */ }
        );
        Editor.dom.appendChild(addStateButton);

        Editor.dom.appendChild(Editor.createDivider());

        // --- WORLD DOM ---
        Editor.dom.appendChild(Editor.createTitle("THE <span>WORLD</span>"));
        Editor.worldDOM = document.createElement("div");
        if (window.Grid && Grid.createUI && Model.data && Model.data.world) {
           const worldUI = Grid.createUI();
            if (worldUI) Editor.worldDOM.appendChild(worldUI);
        } else { console.warn("Editor.create: Grid.createUI or Model.data.world not ready."); Editor.worldDOM.appendChild(document.createTextNode("[World settings loading...]")); }
        Editor.dom.appendChild(Editor.worldDOM);

        Editor.dom.appendChild(Editor.createDivider());

        // --- SAVE / LOAD / IO ---
        Editor.dom.appendChild(Editor.createTitle("<span>SAVE</span> & <span>LOAD</span>"));
        const saveLoadSection = document.createElement("div");
        saveLoadSection.className = "editor_save_load_section";
        try {
            saveLoadSection.appendChild(Editor.createSubTitle("Local Saves"));
            const localSaveRow = document.createElement("div");
            localSaveRow.style.display = "flex";
            localSaveRow.style.gap = "10px";
            localSaveRow.style.alignItems = "center";

            Editor.savedSimsDropdown = document.createElement("select");
            Editor.savedSimsDropdown.title = "Load a previously saved simulation";
            Editor.savedSimsDropdown.style.flexGrow = "1";
            localSaveRow.appendChild(Editor.savedSimsDropdown);
            if(Editor.populateSavedSimsDropdown) Editor.populateSavedSimsDropdown();

            const deleteButton = Editor.createFancyButton(
                "<span class='button-icon'>⊗</span> Delete",
                function () {
                    const selectedName = Editor.savedSimsDropdown.value;
                    if (selectedName && selectedName !== "_placeholder_" && confirm(`Delete simulation "${selectedName}"?`)) { // Simplified confirm
                        if(Save.deleteFromLocalStorage(selectedName)){ publish("/notify/info", [`"${selectedName}" deleted.`]); } else { publish("/notify/error", [`Could not delete "${selectedName}".`]); }
                    }
                }
            );
            deleteButton.style.flexShrink = "0";
            deleteButton.style.backgroundColor = "#b3261e";
            deleteButton.style.color = "#ffffff";
            localSaveRow.appendChild(deleteButton);
            saveLoadSection.appendChild(localSaveRow);

            const saveButton = Editor.createFancyButton("<span class='button-icon'>💾</span> Save Current", Save.saveModel);
            saveButton.id = "save_local_button";
            saveLoadSection.appendChild(saveButton);

            saveLoadSection.appendChild(Editor.createSubTitle("Share Link"));
            saveLoadSection.appendChild(Editor.createLabel("Get a shareable link:"));
            Editor.shareUrlInput = Editor.createTextInput(true);
            Editor.shareUrlInput.placeholder = "Save simulation to generate link...";
            Editor.shareUrlInput.onclick = () => Editor.shareUrlInput.select();
            saveLoadSection.appendChild(Editor.shareUrlInput);

            saveLoadSection.appendChild(Editor.createSubTitle("Import / Export"));
            const importExportRow = document.createElement("div");
            importExportRow.className = "importExportRow";

            const fileInput = document.createElement("input");
            fileInput.type="file"; fileInput.id="importFile"; fileInput.accept=".json"; fileInput.style.display="none";
            fileInput.onchange = function (event) {
                 const file = event.target.files[0];
                 if (!file) return;
                 const reader = new FileReader();
                 reader.onload = function (e) {
                     try {
                         const importedData = JSON.parse(e.target.result);
                         Model.loadModelData(importedData); // Load data
                         publish("/notify/success", [`"${file.name}" imported successfully!`]);
                     } catch (error) { console.error("Import Error:", error); alert("Failed to import file.\n\n" + error.message); publish("/notify/error", ["Import failed."]); }
                     finally { event.target.value = null; } // Reset input
                 };
                 reader.onerror = function (e) { console.error("File Read Error:", e); alert("Error reading file."); publish("/notify/error", ["File read error."]); event.target.value = null; };
                 reader.readAsText(file);
            };
            saveLoadSection.appendChild(fileInput); // Needs to be in DOM to be clicked potentially

            const importButton = Editor.createFancyButton("<span class='button-icon'>📥</span> Import File", () => fileInput.click());
            importButton.id = "import_model_button";
            importExportRow.appendChild(importButton);

            const exportButton = Editor.createFancyButton(
                "<span class='button-icon'>📤</span> Export File",
                function () {
                    try {
                        const modelJson = JSON.stringify(Model.data, null, 2);
                        const blob = new Blob([modelJson], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        const safeTitle = (Model.data?.meta?.title || "emoji-sim").replace(/[^a-z0-9]/gi, '_').toLowerCase();
                        a.href = url;
                        a.download = safeTitle + ".json";
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        publish("/notify/info", ["Exported as " + a.download]);
                    } catch (error) { console.error("Export Error:", error); publish("/notify/error", ["Export failed."]); }
                }
            );
            exportButton.id = "export_model_button";
            importExportRow.appendChild(exportButton);
            saveLoadSection.appendChild(importExportRow);

        } catch(e) { console.error("Error creating save/load UI:", e); saveLoadSection.innerHTML = "[Error loading save/load controls]"; }
        Editor.dom.appendChild(saveLoadSection);

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

        // --- Subscribe to save events ---
        subscribe("/save/shareURL/generated", function(url){
             if (Editor.shareUrlInput) Editor.shareUrlInput.value = url || "Error generating link.";
        });
        subscribe("/save/localStorage/success", Editor.populateSavedSimsDropdown); // Use helper

    }; // <<<< END Editor.create


    // --- Finally, subscribe rebuild function AFTER all helpers and create are defined ---
    subscribe("/model/load/success", Editor.rebuild);
    subscribe("/meta/reset/complete", Editor.rebuild);


})(window); // <<<< END IIFE