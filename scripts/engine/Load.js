(function () {
    // Get the path to the JSON
    function getParameterByName(name) {
        name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
            results = regex.exec(location.search);
        return results === null
            ? ""
            : decodeURIComponent(results[1].replace(/\+/g, " "));
    }

    let path; // Use let
    let simDataSource = null;

    /*
    // Local or Remote or URL?
    var local, lz, url;
    if ((local = getParameterByName("s"))) {
        // note: "=" not "=="
        path = "models/" + local + ".json";
    } else if ((lz = getParameterByName("lz"))) {
        // also: "=" not "=="
        //path = Save.baseURL+remote+".json?print=pretty";
        // REPLACE WITH LZ-WHATEVER.
    } else if ((url = getParameterByName("url"))) {
        // yup: "=" not "=="
        path = url;
    } else {
        path = "models/blank.json";
    }
    */

    const lz = getParameterByName("lz");
    const local = getParameterByName("s");
    const url = getParameterByName("url");

    if (lz) {
        console.log("Loading from LZString parameter...");
        try {
            const compressedData =
                LZString.decompressFromEncodedURIComponent(lz);
            simDataSource = JSON.parse(compressedData);
            // No need for reqwest, proceed directly to onLoadSuccess
        } catch (e) {
            console.error("Failed to decompress/parse LZString:", e);
            alert(
                "Could not load the simulation from the URL. It might be corrupted. Loading default simulation."
            );
            path = "models/forest.json"; // Fallback to default
        }
    } else if (local) {
        console.log(`Loading local model: ${local}`);
        path = `models/${local}.json`;
    } else if (url) {
        console.log(`Loading remote URL: ${url}`);
        path = url;
    } else {
        console.log("Loading default model: forest.json");
        path = "models/forest.json";
    }

    let onLoadSuccess = (model) => {
        if (model && model.meta && model.meta.description) {
            delete model.meta.description;
            console.log(
                "Removed legacy 'description' field from loaded model."
            );
        }
        // Add title if missing
        if (model && model.meta && !model.meta.title) {
            model.meta.title = "Untitled Emoji Simulation"; // Assign default title
        }
        // Recursive: every state, and action within, must have actions.
        // Yeah this over-does it, but whatever.
        var _mustHaveActions = function (array) {
            for (var i = 0; i < array.length; i++) {
                var item = array[i];
                item.actions = item.actions || [];
                _mustHaveActions(item.actions);
            }
        };
        _mustHaveActions(model.states);

        // Show all the UI, whatever.
        document.body.style.display = "flex";

        // Now init 'em
        Model.loadModelData(model);
    };

    const onLoadError = (err) => {
        console.error("Failed to load simulation data from path:", path, err);
        alert(
            `Error loading simulation from ${path}. Please check the source or try the default.\n\nLoading default simulation...`
        );
        // Attempt to load default as fallback
        path = "models/forest.json"; // Ensure path is default
        simDataSource = null; // Clear any potentially bad direct source
        loadFromPath(); // Try again with default path
    };

    const loadFromPath = () => {
        reqwest({
            url: path,
            type: "json",
            method: "get",
            error: onLoadError,
            success: onLoadSuccess,
        });
    };

    // --- Execution ---
    if (simDataSource) {
        // If data came directly from lz string, load it immediately
        onLoadSuccess(simDataSource);
    } else if (path) {
        // Otherwise, load from the determined path
        loadFromPath();
    } else {
        // Should not happen with the logic above, but as a safety net:
        console.error("No valid simulation source found.");
        alert("Could not determine a simulation to load.");
        document.body.style.display = "flex"; // Show body anyway
        // Maybe load a truly blank state?
        // Model.loadModelData({ meta: { title: "Error State" }, states: [{id:0, icon:"", name:"empty", actions:[]}], world: { size:{width:10, height:10}, proportions:[{stateID:0, parts:100}]}});
    }
})();
