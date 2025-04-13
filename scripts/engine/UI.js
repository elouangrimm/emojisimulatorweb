// scripts/engine/UI.js
(function (exports) {
    // Ensure EVERYTHING is inside this IIFE

    /////////////////////////
    //// VARS AND STUFF /////
    /////////////////////////

    // Get the path to the JSON
    function getParameterByName(name) {
        name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
            results = regex.exec(location.search);
        return results === null
            ? ""
            : decodeURIComponent(results[1].replace(/\+/g, " "));
    }

    // UI Vars, like options
    exports.UI = {
        options: {},
        NONE: 0,
        BASIC: 1,
        ADVANCED: 2,
    };

    // How much UI to show?
    UI.options.edit = getParameterByName("edit") || 2;
    UI.options.play = getParameterByName("play") || 2;
    UI.options.bg = getParameterByName("bg") || 1;
    UI.options.paused = getParameterByName("paused") || 0;

    ///////////////////////////////
    ///// HIDE INTERAFACES??? /////
    ///////////////////////////////

    // Edit Sidebar
    if (UI.options.edit == UI.NONE) {
        document.getElementById("editor_container").style.display = "none";
    }

    // Play Controls
    if (UI.options.play == UI.NONE) {
        document.getElementById("play_container").style.display = "none";
    }
    if (UI.options.play == UI.BASIC) {
        const playControls = document.getElementById("play_controls");
        if (playControls) playControls.setAttribute("basic", "true"); // Use setAttribute
    }

    // The Background
    if (UI.options.bg == UI.NONE) {
        // CSS: transparent BG, no grid.
        const css = document.getElementById("ui_style");
        if (css)
            css.innerHTML = "#grid_bg{ display:none; } #grid{color:#1c1b1f}"; // Use M3 text color
    }

    const editorContainer = document.getElementById("editor_container");
    const gridContainer = document.getElementById("grid_container"); // Get grid container too
    const resizer = document.getElementById("editor_resizer");

    let isResizing = false;
    let startX = 0;
    let initialEditorWidth = 0;
    const minEditorWidth = 280; // Minimum pixel width for editor

    if (resizer && editorContainer && gridContainer) {
        // Check if elements exist

        resizer.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return; // Only main button
            isResizing = true;
            startX = e.clientX;
            initialEditorWidth = editorContainer.offsetWidth;
            document.body.classList.add("is-resizing"); // Add class to prevent selection

            // Attach listeners to window for dragging anywhere
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);

            e.preventDefault(); // Prevent default drag behavior
        });

        const handleMouseMove = (e) => {
            if (!isResizing) return;

            const currentX = e.clientX;
            const deltaX = currentX - startX;
            let newEditorWidth = initialEditorWidth - deltaX; // Drag right decreases editor width

            // Apply constraints
            const maxEditorWidth = window.innerWidth * 0.7; // Example: max 70% of window
            newEditorWidth = Math.max(
                minEditorWidth,
                Math.min(newEditorWidth, maxEditorWidth)
            );

            // Apply styles for flexbox resizing
            editorContainer.style.flexBasis = `${newEditorWidth}px`;

            // --- Trigger debounced resize ---
            triggerDebouncedResize();

            // Prevent default text selection behavior which can interfere
            e.preventDefault();
        };

        const handleMouseUp = (e) => {
            if (isResizing) {
                isResizing = false;
                document.body.classList.remove("is-resizing"); // Remove class

                // Remove window listeners
                window.removeEventListener("mousemove", handleMouseMove);
                window.removeEventListener("mouseup", handleMouseUp);

                // --- Trigger final resize ---
                triggerDebouncedResize(true); // Force immediate trigger on mouse up

                // Update Perfect Scrollbar if it exists
                if (window.Ps && editorContainer) {
                    try {
                        Ps.update(editorContainer);
                    } catch (err) {}
                }
                console.log("Resizing ended.");
            }
        };

        // --- Debounced Resize Publisher ---
        let resizeDebounceTimeout = null;
        const triggerDebouncedResize = (immediate = false) => {
            clearTimeout(resizeDebounceTimeout);
            const delay = immediate ? 0 : 50; // Shorter delay during drag, immediate on mouseup
            resizeDebounceTimeout = setTimeout(() => {
                console.log(`Publishing ui/resize (Immediate: ${immediate})`);
                publish("ui/resize"); // Publish event for grid etc.
                // Update Perfect Scrollbar after resize calculation is done
                if (window.Ps && editorContainer) {
                    try {
                        Ps.update(editorContainer);
                    } catch (err) {}
                }
            }, delay);
        };
    } else {
        console.warn("Resizer elements not found, resizing disabled.");
    }

    /////////////////////////
    ///// PLAY CONTROLS /////
    /////////////////////////

    // RESET
    const play_reset = document.getElementById("play_reset");
    if (play_reset) {
        play_reset.onclick = function () {
            if (
                window.hasUnsavedChanges &&
                !confirm("Resetting will discard unsaved changes. Continue?")
            ) {
                return; // Don't reset if user cancels
            }
            Model.returnToBackup(); // Use backup which doesn't have unsaved changes flag set initially
            // No need to reinitialize Grid here, Model.returnToBackup handles it
            publish("/notify/info", ["Simulation reset to original state."]);
        };
    }

    // PLAY/PAUSE
    const play_pause = document.getElementById("play_pause");
    const updatePauseUI = function () {
        if (!play_pause) return;
        const isPlaying = window.Model ? Model.isPlaying : false;
        // Get the icon span inside the button
        const iconSpan = play_pause.querySelector(".material-symbols-outlined");
        if (!iconSpan) return; // Exit if span not found

        if (isPlaying) {
            // play_pause.innerHTML = "pause"; // Remove text setting
            iconSpan.textContent = "pause"; // Set icon name
            play_pause.setAttribute("paused", "false");
            play_pause.title = "Pause Simulation";
        } else {
            iconSpan.textContent = "play_arrow"; // Set icon name
            play_pause.setAttribute("paused", "true");
            play_pause.title = "Play Simulation";
        }
    };

    const play_draw_icon_container = document.getElementById(
        "play_draw_icon_container"
    );

    // Inside _updateBrushIcon
    const _updateBrushIcon = function () {
        // Use the container found above
        if (!play_draw_icon_container || !Model.data || !Model.data.meta)
            return;

        const state = Model.getStateByID(Model.data.meta.draw);
        if (state) {
            play_draw_icon_container.innerHTML = state.icon || "?"; // Set emoji in container
            play_draw.title = `Drawing: ${state.name} (${state.icon || "?"})`;
        } else {
            play_draw_icon_container.innerHTML = " "; // Blank if state not found
            play_draw.title = "Select Draw Brush";
            if (Model.data.meta.draw !== 0) {
                console.warn(
                    `Draw state ID ${Model.data.meta.draw} not found, resetting to 0.`
                );
                Model.data.meta.draw = 0;
                window.hasUnsavedChanges = true;
                Save.updateURL();
                _updateBrushIcon(); // Retry update
            }
        }
    };

    // Inside play_draw.onclick, update reference if needed (or just use container directly)
    if (play_draw) {
        play_draw.onclick = function () {
            if (
                !Model.data ||
                !Model.data.states ||
                Model.data.states.length === 0
            )
                return;

            // Get current state and index
            const currentStateId = Model.data.meta.draw;
            const stateIndex = Model.data.states.findIndex(
                (s) => s.id == currentStateId
            ); // Find by ID

            // Calculate next index, ensuring it loops correctly
            let nextIndex = 0; // Default to first state
            if (stateIndex !== -1) {
                // If current state was found
                nextIndex = (stateIndex + 1) % Model.data.states.length;
            } else {
                console.warn(
                    `Current draw state ID ${currentStateId} not found. Resetting to first state.`
                );
            }
            let nextIndex = 0;
            if (nextState) {
                Model.data.meta.draw = nextState.id;
                _updateBrushIcon(); // Update brush icon display
                // window.hasUnsavedChanges = true; // Maybe don't mark brush change as needing save
                // Save.updateURL();
            }
        };
    }

    if (play_pause) {
        play_pause.onclick = function () {
            Model.isPlaying = !Model.isPlaying;
            updatePauseUI();
        };
    }
    // Listen for external changes to play state
    subscribe("/play/start", updatePauseUI);
    subscribe("/play/pause", updatePauseUI);

    // STEP
    const play_step = document.getElementById("play_step");
    if (play_step) {
        play_step.onclick = function () {
            Model.pause(); // Ensure paused
            updatePauseUI(); // Update UI
            Grid.step();
            publish("/grid/updateAgents");
            window.hasUnsavedChanges = true; // Stepping is a change
            Save.updateURL(); // Update URL after step
        };
    }

    // PLAYBACK SPEED - OnInput, use 'input' event for better cross-browser compatibility
    const playback_speed = document.getElementById("control_fps");
    if (playback_speed) {
        playback_speed.addEventListener("input", function () {
            // Use addEventListener
            const fps = parseInt(playback_speed.value, 10);
            if (!isNaN(fps) && Model.data && Model.data.meta) {
                Model.data.meta.fps = fps;
                window.hasUnsavedChanges = true; // Changing speed is a change
                // Don't update URL constantly on slider drag, maybe on change (mouseup)
            }
        });
        // Update URL when slider interaction finishes
        playback_speed.addEventListener("change", function () {
            Save.updateURL();
        });
    }

    // UPDATE THE PLAYBACK UI on load/reset
    const updatePlaybackUI = () => {
        updatePauseUI();
        if (playback_speed && Model.data && Model.data.meta) {
            playback_speed.value = Model.data.meta.fps || 30;
        }
    };
    subscribe("/model/init", updatePlaybackUI);
    subscribe("/meta/reset/complete", updatePlaybackUI); // Use the correct reset event

    /////////////////////////
    ///// CHANGE STATES ///// (Drawing)
    /////////////////////////

    const play_draw = document.getElementById("play_draw");
    const play_draw_icon = document.querySelector("#play_draw > div");

    const _updateBrushIcon = function () {
        // Define before use
        if (!play_draw_icon || !Model.data || !Model.data.meta) return;
        const state = Model.getStateByID(Model.data.meta.draw);
        if (state) {
            play_draw_icon.innerHTML = state.icon || "?"; // Fallback icon
            play_draw.title = `Drawing: ${state.name} (${state.icon})`; // Update title
        } else {
            play_draw_icon.innerHTML = " "; // Blank if state not found
            play_draw.title = "Select Draw Brush";
            // Attempt to reset draw ID if invalid
            if (Model.data.meta.draw !== 0) {
                console.warn(
                    `Draw state ID ${Model.data.meta.draw} not found, resetting to 0.`
                );
                Model.data.meta.draw = 0;
                window.hasUnsavedChanges = true;
                Save.updateURL();
                _updateBrushIcon(); // Retry update
            }
        }
    };

    if (play_draw) {
        play_draw.onclick = function () {
            if (
                !Model.data ||
                !Model.data.states ||
                Model.data.states.length === 0
            )
                return;

            // Get current state and index
            const currentStateId = Model.data.meta.draw;
            const stateIndex = Model.data.states.findIndex(
                (s) => s.id == currentStateId
            ); // Find by ID

            // Calculate next index, ensuring it loops correctly
            let nextIndex = 0; // Default to first state
            if (stateIndex !== -1) {
                // If current state was found
                nextIndex = (stateIndex + 1) % Model.data.states.length;
            } else {
                console.warn(
                    `Current draw state ID ${currentStateId} not found. Resetting to first state.`
                );
            }

            // Set next state ID
            const nextState = Model.data.states[nextIndex];
            if (nextState) {
                Model.data.meta.draw = nextState.id;
                _updateBrushIcon(); // Update brush icon
                window.hasUnsavedChanges = true; // Changing brush isn't really a saveable change? Maybe not.
                // Save.updateURL(); // Don't update URL just for brush change
            }
        };
    }

    // Subscribe to updates that might affect the brush
    subscribe("/model/init", _updateBrushIcon); // Update brush on load
    subscribe("/ui/updateStateHeaders", _updateBrushIcon); // Update on state edits
    subscribe("/ui/removeState", function (deleted_id) {
        // Update if current brush state is deleted
        if (
            Model.data &&
            Model.data.meta &&
            Model.data.meta.draw == deleted_id
        ) {
            // Check ID type match if needed
            Model.data.meta.draw = 0; // Default to state 0 (empty)
            _updateBrushIcon();
            window.hasUnsavedChanges = true;
            Save.updateURL();
        }
    });

    // Mouse Drawing Logic
    const Mouse = { x: 0, y: 0, pressed: false };
    const MouseLast = { x: 0, y: 0 }; // Keep track of last point for line drawing
    let MouseTiles = []; // Tiles affected in the current step/drag

    const getRealMouse = function (event) {
        // Use Grid.dom which is the actual #grid element
        if (!Grid.dom || !Grid.tileSize) return;

        const gridRect = Grid.dom.getBoundingClientRect(); // Get #grid's position relative to viewport

        // Calculate mouse position relative to the element's top-left corner
        const mouseX = event.clientX - gridRect.left;
        const mouseY = event.clientY - gridRect.top;

        // Convert relative mouse position to grid coordinates
        Mouse.x = Math.floor(mouseX / Grid.tileSize);
        Mouse.y = Math.floor(mouseY / Grid.tileSize);

        // Debugging log:
        // console.log(`MouseCoords: client(${event.clientX}, ${event.clientY}), gridRect(${gridRect.left.toFixed(1)}, ${gridRect.top.toFixed(1)}), relative(${mouseX.toFixed(1)}, ${mouseY.toFixed(1)}), tile(${Mouse.x}, ${Mouse.y})`);
    };
    // Bresenham's Line algorithm
    function bLine(x0, y0, x1, y1) {
        const coords = [];
        const dx = Math.abs(x1 - x0),
            sx = x0 < x1 ? 1 : -1;
        const dy = -Math.abs(y1 - y0),
            sy = y0 < y1 ? 1 : -1;
        let err = dx + dy,
            e2; /* error value e_xy */

        while (true) {
            coords.push({ x: x0, y: y0 });
            if (x0 === x1 && y0 === y1) break;
            e2 = 2 * err;
            if (e2 >= dy) {
                err += dy;
                x0 += sx;
            } /* e_xy+e_x > 0 */
            if (e2 <= dx) {
                err += dx;
                y0 += sy;
            } /* e_xy+e_y < 0 */
        }
        return coords;
    }

    const getMousedTiles = function () {
        // Calculate tiles covered by the line
        MouseTiles = bLine(MouseLast.x, MouseLast.y, Mouse.x, Mouse.y);
    };

    const changeTiles = function () {
        if (!Model.data || !Model.data.world || !Grid.array) return;

        const WIDTH = Model.data.world.size.width;
        const HEIGHT = Model.data.world.size.height;
        let changed = false;

        MouseTiles.forEach((tile) => {
            const x = tile.x;
            const y = tile.y;

            // Bounds check
            if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return; // Use >= for width/height

            // Get agent if grid row exists
            const row = Grid.array[y];
            if (!row) return;
            const agent = row[x];
            if (!agent) return;

            // Get current draw state ID
            const drawStateID = Model.data.meta.draw;

            // Only change if the state is different
            if (agent.stateID !== drawStateID) {
                agent.forceState(drawStateID);
                changed = true;
            }
        });

        // Update the rendering only if something changed
        if (changed) {
            publish("/grid/updateAgents");
            window.hasUnsavedChanges = true; // Mark changes
            // Save.updateURL(); // Update URL on mouseup instead
        }
    };

    // Attach listeners to the container for better event capturing
    if (Grid.domContainer) {
        Grid.domContainer.addEventListener(
            "mousedown",
            function (event) {
                if (event.button !== 0) return; // Only main button
                Mouse.pressed = true;
                getRealMouse(event);
                MouseLast.x = Mouse.x; // Set last position on initial press
                MouseLast.y = Mouse.y;
                getMousedTiles(); // Get initial tile(s)
                changeTiles(); // Change initial tile(s)
                event.preventDefault(); // Prevent text selection during drag
            },
            false
        );

        Grid.domContainer.addEventListener(
            "mousemove",
            function (event) {
                if (!Mouse.pressed) return;
                getRealMouse(event); // Update current mouse position
                getMousedTiles(); // Get tiles for the line segment
                changeTiles(); // Change the tiles
                MouseLast.x = Mouse.x; // Update last position for next segment
                MouseLast.y = Mouse.y;
            },
            false
        );
    }
    // Use a single window mouseup listener
    window.addEventListener(
        "mouseup",
        function (event) {
            if (event.button !== 0) return; // Only main button
            if (Mouse.pressed) {
                // If we were drawing
                Save.updateURL(); // Update URL when drawing stroke is finished
                Mouse.pressed = false;
            }
            if (scrubInput) {
                // If we were scrubbing
                Save.updateURL(); // Update URL when scrubbing is finished
                scrubInput = null;
            }
        },
        false
    );
    // Add mouseleave for the grid container to stop drawing if mouse leaves area while pressed
    if (Grid.domContainer) {
        Grid.domContainer.addEventListener(
            "mouseleave",
            function (event) {
                if (Mouse.pressed) {
                    Save.updateURL(); // Update URL if drawing stops due to leaving
                    Mouse.pressed = false;
                }
            },
            false
        );
    }

    ////////////////////////////
    //// MAKE IT SCRUBBABLE ////
    ////////////////////////////

    // Define Mouse2 *inside* the IIFE and only once
    const Mouse2 = { x: 0, y: 0 }; // Use const
    let scrubInput = null; // Use let
    let scrubPosition = { x: 0, y: 0 }; // Use let
    let scrubStartValue = 0; // Use let

    // Attach _makeScrubbable to the exports (or window) so Editor.js can use it
    exports._makeScrubbable = function (input) {
        if (!input) return;
        input.addEventListener(
            "mousedown",
            function (e) {
                if (e.button !== 0) return; // Only main button
                scrubInput = e.target;
                scrubPosition.x = e.clientX;
                scrubPosition.y = e.clientY;
                // Try parsing value robustly
                const currentValue = parseFloat(input.value);
                scrubStartValue = isNaN(currentValue) ? 0 : currentValue;
                e.preventDefault(); // Prevent text selection
            },
            false
        );
        input.addEventListener(
            "click",
            function (e) {
                e.target.select();
            },
            false
        );
    };

    window.addEventListener(
        "mousemove",
        function (e) {
            // Update Mouse2 (used for scrubbing delta calculation)
            Mouse2.x = e.clientX;
            Mouse2.y = e.clientY;

            if (!scrubInput) return; // Exit if not scrubbing

            scrubInput.blur(); // De-focus the input during scrub

            const deltaX = e.clientX - scrubPosition.x;
            const steps = Math.round(deltaX / 10); // How many steps based on 10px movement
            const increment = steps * (scrubInput.options.step || 1); // Calculate total change
            let val = scrubStartValue + increment; // Calculate new value

            // Clamp to min/max
            if (scrubInput.options.min !== undefined) {
                val = Math.max(scrubInput.options.min, val);
            }
            if (scrubInput.options.max !== undefined) {
                val = Math.min(scrubInput.options.max, val);
            }

            // Format (Integer or Float)
            const formattedValue = scrubInput.options.integer
                ? val.toFixed(0)
                : val.toFixed(1); // Adjust precision as needed

            // Update input value only if it changed to avoid unnecessary input events
            if (scrubInput.value !== formattedValue) {
                scrubInput.value = formattedValue;
                // Trigger the input's oninput handler manually if it exists
                if (typeof scrubInput.oninput === "function") {
                    scrubInput.oninput();
                }
                // Trigger a generic input event for listeners added via addEventListener
                const event = new Event("input", {
                    bubbles: true,
                    cancelable: true,
                });
                scrubInput.dispatchEvent(event);
            }
        },
        false
    );
    // MouseUp listener is already consolidated above to handle both drawing and scrubbing

    /////////////////////////
    //// SCROLLING STUFF ////
    /////////////////////////
    const editor_container = document.getElementById("editor_container");
    if (editor_container) {
        // Initialize Perfect Scrollbar if the container exists
        try {
            // Ensure Ps is initialized on the CONTAINER
            Ps.initialize(editor_container, {
                suppressScrollX: true,
                wheelSpeed: 0.7,
                minScrollbarLength: 20,
            });

            // Ensure updates happen (resize, model init, reset)
            // These listeners should already be present from previous steps
            window.addEventListener("resize", function () {
                Ps.update(editor_container);
            });
            subscribe("/model/init", function () {
                Ps.update(editor_container);
            });
            subscribe("/meta/reset/complete", function () {
                // Use correct event
                editor_container.scrollTop = 0;
                Ps.update(editor_container);
            });
            // Add update after rebuild too
            subscribe("/model/load/success", function () {
                // When model is loaded
                editor_container.scrollTop = 0; // Scroll to top
                Ps.update(editor_container);
            });
        } catch (e) {
            console.error("Failed to initialize Perfect Scrollbar:", e);
            // Fallback to native scrollbar
            editor_container.style.overflowY = "auto";
        }
    }

    ///////////////////////
    //// RESIZE SHTUFF ////
    ///////////////////////
    // Debounce resize events for performance
    let resizeTimeout;
    window.addEventListener(
        "resize",
        function () {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                publish("ui/resize"); // Publish the debounced event
            }, 150); // Adjust timeout as needed
        },
        false
    );

    let windowResizeTimeout;
    window.addEventListener(
        "resize",
        function () {
            clearTimeout(windowResizeTimeout);
            windowResizeTimeout = setTimeout(() => {
                publish("ui/resize"); // Grid and other components listen to this

                // Explicitly update scrollbar on window resize too
                if (window.Ps && editorContainer) {
                    try {
                        Ps.update(editorContainer);
                    } catch (err) {}
                }
                console.log("Window resized, updated UI.");
            }, 150);
        },
        false
    );
})(window); // End of UI module IIFE
