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
        input.className = "editor_text_input"; // Use consistent class
        input.readOnly = readonly;
        input.placeholder = placeholder;
        return input;
    };

    // Helper to create fancy buttons
    Editor.createFancyButton = function (html, onClick) {
        const button = document.createElement("button"); // Use button element
        button.className = "editor_fancy_button"; // Use consistent class
        button.innerHTML = html;
        if (onClick && typeof onClick === "function") {
            // Ensure onClick is a function
            button.onclick = onClick;
        }
        return button;
    };

    // Helper to populate the saved simulations dropdown
    Editor.populateSavedSimsDropdown = function () {
        if (!Editor.savedSimsDropdown) {
            // console.warn("populateSavedSimsDropdown called before dropdown exists.");
            return;
        }

        const saves = Save.loadFromLocalStorage();
        const currentSelection = Editor.savedSimsDropdown.value;
        Editor.savedSimsDropdown.innerHTML = ""; // Clear existing options

        const placeholderOption = document.createElement("option");
        placeholderOption.value = "_placeholder_";
        placeholderOption.textContent = "Load a local save...";
        placeholderOption.disabled = true;
        // Select placeholder initially or if current selection is gone
        placeholderOption.selected =
            !saves.some((s) => s.name === currentSelection) ||
            !currentSelection ||
            currentSelection === "_placeholder_";
        Editor.savedSimsDropdown.appendChild(placeholderOption);

        saves.forEach((save) => {
            const option = document.createElement("option");
            option.value = save.name;
            option.textContent = save.name;
            if (save.name === currentSelection) {
                option.selected = true;
            }
            Editor.savedSimsDropdown.appendChild(option);
        });

        // Define onchange handler (ensure it's only set once, maybe remove previous if needed)
        Editor.savedSimsDropdown.onchange = function () {
            const selectedName = this.value;
            if (selectedName && selectedName !== "_placeholder_") {
                if (
                    window.hasUnsavedChanges &&
                    !confirm("Discard unsaved changes and load simulation?")
                ) {
                    this.value = currentSelection || "_placeholder_"; // Revert selection
                    return;
                }
                const saves = Save.loadFromLocalStorage();
                const selectedSave = saves.find((s) => s.name === selectedName);
                if (selectedSave?.data) {
                    // Use optional chaining
                    try {
                        const parsedData = JSON.parse(selectedSave.data);
                        Model.loadModelData(parsedData);
                        publish("/notify/success", [
                            `Loaded "${selectedName}".`,
                        ]);
                    } catch (e) {
                        /* ... error handling ... */
                    }
                }
            }
        };
    };

    // Create States UI
    Editor.createStatesUI = function (dom, stateConfigs) {
        if (!dom || !stateConfigs) return;
        dom.innerHTML = "";
        stateConfigs.forEach((stateConfig) => {
            const stateDOM = Editor.createStateUI(stateConfig);
            if (stateDOM) dom.appendChild(stateDOM);
        });
    };

    // Create State UI
    Editor.createStateUI = function (stateConfig) {
        if (!stateConfig) return null;
        const dom = document.createElement("div");
        dom.className = "editor_state";
        dom.dataset.stateId = stateConfig.id;

        const stateHeader = document.createElement("div");
        stateHeader.className = "editor_state_header";
        dom.appendChild(stateHeader);

        const icon = document.createElement("input");
        icon.className = "editor_icon";
        icon.type = "text";
        icon.value = stateConfig.icon || "";
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
        name.value = stateConfig.name || "[unnamed]";
        name.oninput = function () {
            stateConfig.name = name.value;
            publish("/ui/updateStateHeaders");
            window.hasUnsavedChanges = true;
            Save.updateURL();
        };
        name.onchange = Save.updateURL;
        stateHeader.appendChild(name);

        if (stateConfig.id != 0) {
            const deleteDOM = document.createElement("div");
            deleteDOM.className = "delete_state";
            deleteDOM.innerHTML = "⊗";
            deleteDOM.title = "Delete this state";
            (function (currentConfig, currentDOM) {
                // Closure
                deleteDOM.onclick = function () {
                    if (
                        confirm(
                            `Are you sure you want to delete the state "${
                                currentConfig.name || "[unnamed]"
                            }"?`
                        )
                    ) {
                        // Use name from config
                        Model.removeStateByID(currentConfig.id);
                        // publish("/ui/removeState", [currentConfig.id]); // removeStateByID might handle necessary publishes
                        // publish("/ui/updateStateHeaders");
                        if (
                            Editor.statesDOM &&
                            currentDOM.parentNode === Editor.statesDOM
                        ) {
                            Editor.statesDOM.removeChild(currentDOM);
                        }
                    }
                };
            })(stateConfig, dom);
            stateHeader.appendChild(deleteDOM);
        }

        const actionConfigs = (stateConfig.actions = stateConfig.actions || []);
        const actionsDOM = Editor.createActionsUI(actionConfigs);
        dom.appendChild(actionsDOM);

        return dom;
    };

    // Create Actions UI
    Editor.createActionsUI = function (actionConfigs, dom) {
        if (!actionConfigs) actionConfigs = []; // Ensure it's an array
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
            (function (configToDelete, parentList, itemElement) {
                // Closure
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

            const actionDOM = Editor.createActionUI(actionConfig);
            if (actionDOM) entry.appendChild(actionDOM); // Only append if valid
        });

        const addEntry = document.createElement("li");
        const addActionControl = Editor.createActionAdder(actionConfigs, dom);
        addEntry.appendChild(addActionControl);
        list.appendChild(addEntry);

        return dom;
    };

    // Create Action UI (Wrapper)
    Editor.createActionUI = function (actionConfig) {
        if (
            !actionConfig?.type ||
            !window.Actions ||
            !Actions[actionConfig.type]
        ) {
            // Use optional chaining
            console.error(
                "Invalid action config or Actions library missing:",
                actionConfig
            );
            const errorDom = document.createElement("span");
            errorDom.textContent = "[Error]";
            errorDom.style.color = "red";
            return errorDom;
        }
        const action = Actions[actionConfig.type];
        if (typeof action.ui !== "function") {
            console.error(
                `Action type "${actionConfig.type}" does not have a .ui() method.`
            );
            const errorDom = document.createElement("span");
            errorDom.textContent = `[UI Error: ${actionConfig.type}]`;
            errorDom.style.color = "orange";
            return errorDom;
        }
        // Wrap the action UI in a container span for consistent inline-block behavior
        const actionContainer = document.createElement("span");
        actionContainer.className = "action-ui-container"; // Add class for potential styling
        const actionUIElement = action.ui(actionConfig);
        if (actionUIElement) actionContainer.appendChild(actionUIElement);
        return actionContainer;
    };

    // Create Action Adder ("+ Add New Action" dropdown)
    Editor.createActionAdder = function (actionConfigs, domToUpdate) {
        const keyValues = [{ name: "+new", value: "" }]; // Shorter text
        if (window.Actions) {
            for (const key in Actions) {
                if (Actions[key]?.name) {
                    // Check name exists
                    keyValues.push({ name: Actions[key].name, value: key });
                }
            }
        } else {
            console.error("Actions object not found for createActionAdder.");
        }

        const tempConfig = { action: "" };
        const select = Editor.createSelector(keyValues, tempConfig, "action"); // Use helper

        select.onchange = function () {
            const selectedValue = select.value;
            if (
                selectedValue === "" ||
                !window.Actions ||
                !Actions[selectedValue]
            )
                return;

            const defaultProps = Actions[selectedValue].props;
            const newActionConfig = JSON.parse(
                JSON.stringify(defaultProps || {})
            );
            newActionConfig.type = selectedValue;
            actionConfigs.push(newActionConfig);

            Editor.createActionsUI(actionConfigs, domToUpdate); // Re-render parent

            window.hasUnsavedChanges = true;
            Save.updateURL();
        };

        select.className = "editor_new_action_select"; // Assign class

        const container = document.createElement("div");
        container.className = "editor_new_action_container";
        container.appendChild(select);
        return container;
    };

    // Create Selector (Dropdown) - General purpose
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
            option.innerHTML = keyValue.name;
            option.value = keyValue.value;
            select.appendChild(option);
            // Use non-strict comparison for flexibility if IDs are sometimes numbers/strings
            if (keyValue.value == configObject[propName]) {
                option.selected = true;
            }
        });

        select.onchange = function () {
            const newValue = select.value;
            if (configObject[propName] != newValue) {
                // Use non-strict comparison here too
                configObject[propName] = newValue;
                window.hasUnsavedChanges = true;
                if (options.updateUrlOnChange) Save.updateURL();
                if (options.message) publish(options.message);
            }
        };
        return select;
    };

    // Create State Selector
    Editor.createStateSelector = function (configObject, propName) {
        const select = document.createElement("select");

        const populateList = () => {
            const currentSelectedValue = select.value;
            select.innerHTML = "";
            if (!Model.data?.states) return; // Guard clause
            const stateConfigs = Model.data.states;
            let foundSelected = false;

            stateConfigs.forEach((stateConfig) => {
                const option = document.createElement("option");
                option.innerHTML = `${stateConfig.icon || "▫️"}: ${
                    stateConfig.name || "[unnamed]"
                }`;
                option.value = stateConfig.id;
                select.appendChild(option);
                if (stateConfig.id == configObject[propName]) {
                    // Non-strict compare
                    option.selected = true;
                    foundSelected = true;
                } else if (
                    stateConfig.id == currentSelectedValue &&
                    !configObject[propName]
                ) {
                    // Non-strict compare
                    option.selected = true;
                    foundSelected = true;
                    configObject[propName] = stateConfig.id;
                }
            });

            if (!foundSelected) {
                configObject[propName] = 0;
                const optionZero = Array.from(select.options).find(
                    (opt) => opt.value == "0"
                ); // Non-strict compare
                if (optionZero) optionZero.selected = true;
                else if (select.options.length > 0)
                    select.options[0].selected = true;
            }
        };

        select.onchange = function () {
            const newValue = select.value;
            if (configObject[propName] != newValue) {
                // Non-strict compare
                configObject[propName] = newValue;
                window.hasUnsavedChanges = true;
                Save.updateURL();
            }
        };

        populateList();

        const listener1 = subscribe("/ui/updateStateHeaders", populateList);
        const listener2 = subscribe("/ui/removeState", populateList);
        const listener3 = subscribe("/ui/addState", populateList);
        const listenerMetaReset = subscribe(
            "/meta/reset/complete",
            function () {
                // Use correct event
                unsubscribe(listener1);
                unsubscribe(listener2);
                unsubscribe(listener3);
                unsubscribe(listenerMetaReset);
            }
        );

        return select;
    };

    // Create Number Input
    Editor.createNumber = function (configObject, propName, options) {
        // Keep previous implementation
        options = options || {};
        options.multiplier = options.multiplier || 1;
        options.min = options.min !== undefined ? options.min : 0;
        options.max = options.max !== undefined ? options.max : 100;
        options.step = options.step || 1;
        options.integer = options.integer || false;

        const input = document.createElement("input");
        input.type = "text";
        const initialValue =
            configObject[propName] !== undefined
                ? configObject[propName]
                : options.min / options.multiplier;
        input.value = (initialValue * options.multiplier).toFixed(
            options.integer ? 0 : 1
        );
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
            const currentVal = options.integer
                ? parseInt(input.value)
                : parseFloat(input.value);
            if (!isNaN(currentVal)) {
                const clampedVal = Math.max(
                    options.min,
                    Math.min(options.max, currentVal)
                );
                updateModel(clampedVal); // Update model as user types/scrubs
            }
        };

        input.onchange = function () {
            // On blur
            const number = formatValue(input.value);
            input.value = number.toFixed(options.integer ? 0 : 1); // Format display
            updateModel(number); // Ensure model matches formatted value
            Save.updateURL(); // Update URL on final change
        };

        if (window._makeScrubbable) {
            _makeScrubbable(input);
        } else {
            console.warn("_makeScrubbable not found.");
        }

        return input;
    };

    // Create Proportions Input
    Editor.createProportions = function () {
        // Keep previous implementation
        const dom = document.createElement("div");
        dom.className = "proportions";
        let sliders = [];

        const populate = () => {
            console.log("Proportions populate called");
            dom.innerHTML = ""; // Clear
            sliders = [];
            // Guard clause for model data readiness
            if (!Model.data?.world?.proportions || !Model.data?.states) {
                 console.warn("Proportions: Model data not ready for populate.");
                 dom.innerHTML = "[State data loading...]"; // Placeholder
                 return;
            }
            const proportions = Model.data.world.proportions;
            const states = Model.data.states;

            // --- Sync proportions with states ---
            const oldProportionsMap = new Map(proportions.map((p) => [p.stateID, p.parts]));
            const newProportions = states.map((state) => ({
                stateID: state.id,
                parts: oldProportionsMap.get(state.id) || 0
            }));
            proportions.length = 0; // Clear original array in place
            Array.prototype.push.apply(proportions, newProportions); // Push new items
            // --- End Sync ---


            let totalParts = proportions.reduce((sum, p) => sum + p.parts, 0);
            if (totalParts <= 0 && proportions.length > 0) {
                 console.warn("Proportions: Total parts zero, normalizing.");
                 totalParts = proportions.length;
                 proportions.forEach(p => p.parts = 1);
            } else if (proportions.length === 0) {
                console.warn("Proportions: No states/proportions to display.");
                 dom.innerHTML = "[No states defined]";
                 return;
            }


            proportions.forEach((proportion, index) => {
                const state = Model.getStateByID(proportion.stateID);
                if (!state) {
                     console.warn(`Proportions: State not found for ID ${proportion.stateID}`);
                     return; // Skip if state is missing
                }

                const lineDOM = document.createElement("div");
                dom.appendChild(lineDOM);

                const iconDOM = document.createElement("span");
                iconDOM.innerHTML = state.icon || '▫️';
                iconDOM.title = state.name || '[unnamed]';
                lineDOM.appendChild(iconDOM);

                const slider = document.createElement("input");
                slider.type = "range"; slider.min = 0; slider.max = 100; slider.step = 1;
                // Normalize initial value based on *current* total parts
                slider.value = totalParts > 0 ? Math.round((proportion.parts / totalParts) * 100) : 0;
                // Update model proportion based on *initial normalized* value (important!)
                proportion.parts = parseFloat(slider.value);

                slider.dataset.index = index;
                sliders.push(slider);
                lineDOM.appendChild(slider);

                let snapshot = [];
                slider.onmousedown = function () {
                    snapshot = sliders.map((s) => parseFloat(s.value));
                };

                slider.oninput = function () { // Keep the complex update logic from before
                    const currentIndex = parseInt(this.dataset.index);
                    const currentValue = parseFloat(this.value);
                    if (isNaN(currentValue)) return; // Safety check

                    const oldValue = snapshot[currentIndex];
                    if (isNaN(oldValue)) { // Initialize snapshot if needed
                         snapshot = sliders.map((s) => parseFloat(s.value));
                    }
                    // const delta = currentValue - oldValue; // Delta not directly needed

                    let otherTotalSnapshot = 0;
                    snapshot.forEach((val, i) => {
                        if (i !== currentIndex && !isNaN(val)) otherTotalSnapshot += val;
                    });

                    let scale = 1;
                    if (otherTotalSnapshot > 0) {
                        scale = (100 - currentValue) / otherTotalSnapshot;
                    } else if (sliders.length > 1) {
                        // Distribute remaining evenly ONLY if others were actually zero in snapshot
                        const remainingValue = Math.round((100 - currentValue) / (sliders.length - 1));
                        sliders.forEach((s, i) => {
                            if (i !== currentIndex) {
                                s.value = remainingValue;
                                if (Model.data.world.proportions[i]) Model.data.world.proportions[i].parts = remainingValue;
                            }
                        });
                        if (Model.data.world.proportions[currentIndex]) Model.data.world.proportions[currentIndex].parts = currentValue;
                        normalizeProportions(); // Recalculate and normalize fully
                        Grid.reinitialize();
                        window.hasUnsavedChanges = true;
                        Save.updateURL();
                        return; // Exit early
                    }

                    // Apply scaling based on snapshot
                    let currentAppliedTotal = currentValue;
                    sliders.forEach((s, i) => {
                        if (i !== currentIndex) {
                            const snapshotValue = isNaN(snapshot[i]) ? 0 : snapshot[i]; // Handle NaN in snapshot
                            const scaledValue = Math.round(snapshotValue * scale);
                            s.value = scaledValue;
                            if (Model.data.world.proportions[i]) Model.data.world.proportions[i].parts = scaledValue;
                            currentAppliedTotal += scaledValue;
                        } else {
                             if (Model.data.world.proportions[i]) Model.data.world.proportions[i].parts = currentValue;
                        }
                    });

                     // Adjust rounding errors
                     normalizeProportions(); // Call normalize which handles rounding

                    Grid.reinitialize();
                    window.hasUnsavedChanges = true;
                    Save.updateURL();
                };
            }); // End forEach proportion

             // Final normalization after initial populate based on normalized slider values
             normalizeProportions();

            // Disable slider if only one state
            if (sliders.length === 1) {
                sliders[0].value = 100;
                sliders[0].disabled = true;
                if (Model.data.world.proportions[0]) Model.data.world.proportions[0].parts = 100;
            }
        };
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

        populate();
        normalizeProportions();

        const listener1 = subscribe("/ui/updateStateHeaders", () => {
            /* ... */
        });
        const listener2 = subscribe("/meta/reset", function () {
            /* ... */
        });

        return dom;
    };

    // Editor Helper (Factory for chaining UI creation)
    const EditorShortcuts = function (dom) {
        const self = this;
        self.dom = dom;
        const _shortcut = function (funcName, EditorFunc) {
            const nickname =
                funcName.charAt(0).toLowerCase() + funcName.substring(1);
            self[nickname] = function (...args) {
                if (typeof EditorFunc !== "function") {
                    // Add check
                    console.error(
                        `Editor helper function ${funcName} is not defined.`
                    );
                    return self; // Prevent error and allow chaining
                }
                const insertDOM = EditorFunc.apply(null, args);
                if (insertDOM) self.dom.appendChild(insertDOM);
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
    };
    exports.EditorHelper = function (tag = "span") {
        const dom = document.createElement(tag);
        const shortcut = new EditorShortcuts(dom);
        return shortcut;
    };

    // --- Add Editor.rebuild function (defined before it's subscribed) ---
    Editor.rebuild = function () {
        console.log("Editor.js: Rebuilding editor UI...");
        if (!Editor.dom) return;
        while (Editor.dom.firstChild) {
            Editor.dom.removeChild(Editor.dom.firstChild);
        }
        Editor.create(); // Now helpers are guaranteed to exist
        if (Editor.updateTitleUI) Editor.updateTitleUI(); // Update title after rebuild
        if (window.Ps && document.getElementById("editor_container")) {
            try {
                Ps.update(document.getElementById("editor_container"));
            } catch (err) {}
        }
        console.log("Editor.js: Editor UI rebuilt.");
    };
    // --- End Helper Function Definitions ---

    // --- NOW DEFINE THE MAIN Editor.create FUNCTION ---
    Editor.create = function () {
        console.log("Editor.js: Editor.create called.");

        if (!Editor.dom) {
            console.error("Editor.create: Editor DOM not found.");
            return;
        } // Guard clause
        // Clear DOM explicitly here as rebuild might not always be the entry point
        // while (Editor.dom.firstChild) { Editor.dom.removeChild(Editor.dom.firstChild); }

        if (window.UI && UI.options.edit === UI.NONE) {
            console.log("Editor.create: Editor UI is disabled.");
            return;
        }

        // --- Title Input ---
        Editor.titleInput = document.createElement("input");
        Editor.titleInput.type = "text";
        Editor.titleInput.className = "editor_main_title_input";
        Editor.titleInput.value =
            (Model.data && Model.data.meta && Model.data.meta.title) ||
            "Untitled Simulation";
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
            if (Editor.titleInput)
                Editor.titleInput.value =
                    (Model.data && Model.data.meta && Model.data.meta.title) ||
                    "Untitled Simulation";
            document.title =
                ((Model.data && Model.data.meta && Model.data.meta.title) ||
                    "Untitled Simulation") + " - Emoji Simulator! 😘";
        };
        Editor.updateTitleUI();

        Editor.dom.appendChild(Editor.createDivider());

        // --- STATES DOM ---
        Editor.dom.appendChild(
            Editor.createTitle("<span>THINGS</span> WITH RULES")
        );
        Editor.statesDOM = document.createElement("div"); // Create if not exists
        Editor.dom.appendChild(Editor.statesDOM);
        if (Model.data?.states) {
            // Optional chaining
            Editor.createStatesUI(Editor.statesDOM, Model.data.states);
        } else {
            console.warn("Editor.create: Model.data.states not ready.");
        }

        const addStateButton = Editor.createFancyButton(
            "<span class='button-icon'>+</span> New Thing",
            function () {
                const emoji = Model.generateNewEmoji();
                const newStateConfig = {
                    id: Model.generateNewID(),
                    icon: emoji.icon,
                    name: "[new thing]",
                    actions: [],
                };
                if (Model.data?.states) Model.data.states.push(newStateConfig); // Optional chaining
                const stateDOM = Editor.createStateUI(newStateConfig);
                if (Editor.statesDOM && stateDOM)
                    Editor.statesDOM.appendChild(stateDOM); // Check both
                publish("/ui/addState", [newStateConfig.id]);
                publish("/ui/updateStateHeaders");
                window.hasUnsavedChanges = true;
                Save.updateURL();
            }
        );
        Editor.dom.appendChild(addStateButton);

        Editor.dom.appendChild(Editor.createDivider());

        // --- WORLD DOM ---
        Editor.dom.appendChild(Editor.createTitle("THE <span>WORLD</span>"));
        Editor.worldDOM = document.createElement("div");
        if (window.Grid?.createUI && Model.data?.world) {
            // Optional chaining
            const worldUI = Grid.createUI();
            if (worldUI) Editor.worldDOM.appendChild(worldUI);
        } else {
            console.warn(
                "Editor.create: Grid.createUI or Model.data.world not ready."
            );
            Editor.worldDOM.appendChild(
                document.createTextNode("[World settings loading...]")
            );
        }
        Editor.dom.appendChild(Editor.worldDOM);

        Editor.dom.appendChild(Editor.createDivider());

        // --- SAVE / LOAD / IO ---
        Editor.dom.appendChild(
            Editor.createTitle("<span>SAVE</span> & <span>LOAD</span>")
        );
        const saveLoadSection = document.createElement("div");
        saveLoadSection.className = "editor_save_load_section";
        try {
            saveLoadSection.appendChild(Editor.createSubTitle("Local Saves"));
            const localSaveRow = document.createElement("div");
            localSaveRow.style.display = "flex";
            localSaveRow.style.gap = "10px";
            localSaveRow.style.alignItems = "center";

            Editor.savedSimsDropdown = document.createElement("select");
            Editor.savedSimsDropdown.title =
                "Load a previously saved simulation";
            Editor.savedSimsDropdown.style.flexGrow = "1";
            localSaveRow.appendChild(Editor.savedSimsDropdown);
            if (Editor.populateSavedSimsDropdown)
                Editor.populateSavedSimsDropdown();

            const deleteButton = Editor.createFancyButton(
                "<span class='button-icon'>⊗</span> Delete",
                function () {
                    /* ... delete logic ... */
                }
            );
            deleteButton.style.flexShrink = "0";
            deleteButton.style.backgroundColor = "#b3261e";
            deleteButton.style.color = "#ffffff";
            localSaveRow.appendChild(deleteButton);
            saveLoadSection.appendChild(localSaveRow);

            const saveButton = Editor.createFancyButton(
                "<span class='button-icon'>💾</span> Save Current",
                Save.saveModel
            );
            saveButton.id = "save_local_button";
            saveLoadSection.appendChild(saveButton);

            saveLoadSection.appendChild(Editor.createSubTitle("Share Link"));
            saveLoadSection.appendChild(
                Editor.createLabel("Get a shareable link:")
            );
            Editor.shareUrlInput = Editor.createTextInput(true);
            Editor.shareUrlInput.placeholder =
                "Save simulation to generate link...";
            Editor.shareUrlInput.onclick = () => Editor.shareUrlInput.select();
            saveLoadSection.appendChild(Editor.shareUrlInput);

            saveLoadSection.appendChild(
                Editor.createSubTitle("Import / Export")
            );
            const importExportRow = document.createElement("div");
            importExportRow.className = "importExportRow";

            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.id = "importFile";
            fileInput.accept = ".json";
            fileInput.style.display = "none";
            fileInput.onchange = function (event) {
                const file = event.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function (e) {
                    try {
                        const importedData = JSON.parse(e.target.result);
                        Model.loadModelData(importedData); // Load data
                        publish("/notify/success", [
                            `"${file.name}" imported successfully!`,
                        ]);
                    } catch (error) {
                        console.error("Import Error:", error);
                        alert("Failed to import file.\n\n" + error.message);
                        publish("/notify/error", ["Import failed."]);
                    } finally {
                        event.target.value = null;
                    } // Reset input
                };
                reader.onerror = function (e) {
                    console.error("File Read Error:", e);
                    alert("Error reading file.");
                    publish("/notify/error", ["File read error."]);
                    event.target.value = null;
                };
                reader.readAsText(file);
            };
            saveLoadSection.appendChild(fileInput); // Needs to be in DOM

            const importButton = Editor.createFancyButton(
                "<span class='button-icon'>📥</span> Import File",
                () => fileInput.click()
            );
            importButton.id = "import_model_button";
            importExportRow.appendChild(importButton);

            const exportButton = Editor.createFancyButton(
                "<span class='button-icon'>📤</span> Export File",
                function () {
                    /* ... export logic ... */
                }
            );
            exportButton.id = "export_model_button";
            importExportRow.appendChild(exportButton);
            saveLoadSection.appendChild(importExportRow);
        } catch (e) {
            console.error("Error creating save/load UI:", e);
            saveLoadSection.innerHTML = "[Error loading save/load controls]";
        }
        Editor.dom.appendChild(saveLoadSection);

        Editor.dom.appendChild(Editor.createDivider());

        // --- CREDITS ---
        if (window.UI && UI.options.edit === UI.ADVANCED) {
            const creditsLabel = Editor.createLabel(/* ... credits html ... */);
            creditsLabel.className = "credits_label";
            Editor.dom.appendChild(creditsLabel);
        }

        // --- Subscribe to save events ---
        // Note: These might get re-subscribed if rebuild doesn't handle unsubscription
        subscribe("/save/shareURL/generated", function (url) {
            if (Editor.shareUrlInput)
                Editor.shareUrlInput.value = url || "Error generating link.";
        });
        subscribe(
            "/save/localStorage/success",
            Editor.populateSavedSimsDropdown
        );
    }; // <<<< END Editor.create

    // --- Finally, subscribe rebuild function AFTER all helpers and create are defined ---
    subscribe("/model/load/success", Editor.rebuild);
    subscribe("/meta/reset/complete", Editor.rebuild);
})(window); // <<<< END IIFE
