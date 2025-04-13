(function(exports){

    const LOCAL_STORAGE_KEY = 'emojiSimSaves'; // Key for storing saves
    exports.Save = {};

    // --- Local Storage Functions ---

    // Load all saves from localStorage
    Save.loadFromLocalStorage = function() {
        const saves = localStorage.getItem(LOCAL_STORAGE_KEY);
        try {
            return saves ? JSON.parse(saves) : [];
        } catch (e) {
            console.error("Error parsing localStorage saves:", e);
            return []; // Return empty array on error
        }
    };

    // Save the entire array of saves back to localStorage
    Save.saveAllToLocalStorage = function(savesArray) {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(savesArray));
        } catch (e) {
            console.error("Error saving to localStorage:", e);
            alert("Could not save simulation locally. Storage might be full or disabled.");
        }
    };

    // Add or update a specific simulation by name
    Save.saveToLocalStorage = function(name, data) {
        if (!name || typeof name !== 'string' || name.trim() === '') {
            alert("Please enter a valid name for your simulation.");
            return false; // Indicate failure
        }
        const saves = Save.loadFromLocalStorage();
        const existingIndex = saves.findIndex(s => s.name === name);
        const saveData = { name: name, data: JSON.stringify(data) }; // Store data as string

        if (existingIndex > -1) {
            // Update existing save
            saves[existingIndex] = saveData;
        } else {
            // Add new save
            saves.push(saveData);
        }
        Save.saveAllToLocalStorage(saves);
        window.hasUnsavedChanges = false; // Mark as saved
        console.log(`Simulation "${name}" saved locally.`);
        publish("/save/localStorage/success", [saves]); // Notify UI to update dropdown
        return true; // Indicate success
    };

    // Delete a simulation by name
    Save.deleteFromLocalStorage = function(name) {
        let saves = Save.loadFromLocalStorage();
        const initialLength = saves.length;
        saves = saves.filter(s => s.name !== name);

        if (saves.length < initialLength) {
            Save.saveAllToLocalStorage(saves);
            console.log(`Simulation "${name}" deleted from local storage.`);
            publish("/save/localStorage/success", [saves]); // Notify UI to update dropdown
             return true;
        }
         return false; // Not found
    };


    // --- Sharing URL Function ---
    // Generates the shareable URL (no actual upload)
    Save.generateShareURL = function(modelData) {
        try {
            let dataString = JSON.stringify(modelData);
            let compressedData = LZString.compressToEncodedURIComponent(dataString);
            let currentURL = [location.protocol, '//', location.host, location.pathname].join('');
            return currentURL+'?lz='+compressedData;
        } catch (error) {
            console.error("Error generating share URL:", error);
            return null;
        }
    };

    // --- Update Browser URL Bar (Request 8) ---
    let _urlUpdateTimeout = null;
    Save.updateURL = function() {
        // Debounce the URL update to avoid excessive history entries
        clearTimeout(_urlUpdateTimeout);
        _urlUpdateTimeout = setTimeout(() => {
            try {
                if (!Model.data) return; // Don't run if data isn't ready
                const compressedData = LZString.compressToEncodedURIComponent(JSON.stringify(Model.data));
                const newQueryString = '?lz=' + compressedData;
                const currentPath = location.pathname;
                // Use replaceState to avoid polluting history
                history.replaceState(null, '', currentPath + newQueryString);
                // console.log("URL updated."); // Optional: for debugging
            } catch (error) {
                console.error("Error updating URL:", error);
            }
        }, 500); // Debounce time in ms (adjust as needed)
    };


    // --- Combined Save Function ---
    // Called by the main save button
    Save.saveModel = function() {
        const modelName = Model.data.meta.title || "Untitled Simulation"; // Use current title

        // 1. Save to Local Storage
        const savedLocally = Save.saveToLocalStorage(modelName, Model.data);

        // 2. Generate and Display Share URL
        const shareURL = Save.generateShareURL(Model.data);
        publish("/save/shareURL/generated", [shareURL]); // Send URL to UI

        // 3. Update browser URL (already debounced)
        Save.updateURL();

        // 4. Reset unsaved changes flag (done inside saveToLocalStorage)

        if(savedLocally) {
             publish("/notify/success", ["Simulation '" + modelName + "' saved!"]);
        }
    };


})(window);

// Helper function for notifications (can be placed elsewhere too)
(function(exports) {
    exports.showNotification = function(message, type = 'info', duration = 3000) {
        let notification = document.getElementById('notification-banner');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification-banner';
            notification.style.position = 'fixed';
            notification.style.bottom = '70px'; // Above play controls
            notification.style.left = '50%';
            notification.style.transform = 'translateX(-50%)';
            notification.style.padding = '10px 20px';
            notification.style.borderRadius = '8px';
            notification.style.zIndex = '1000';
            notification.style.fontSize = '14px';
            notification.style.fontWeight = '500';
            notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.3s ease-in-out';
            document.body.appendChild(notification);
        }

        notification.textContent = message;
        if (type === 'success') {
            notification.style.backgroundColor = '#d1e7dd'; // Greenish
            notification.style.color = '#0f5132';
        } else if (type === 'error') {
            notification.style.backgroundColor = '#f8d7da'; // Reddish
            notification.style.color = '#842029';
        } else { // info
            notification.style.backgroundColor = '#cfe2ff'; // Bluish
            notification.style.color = '#052c65';
        }

        // Fade in
        setTimeout(() => { notification.style.opacity = '1'; }, 50);


        // Clear previous timeout if exists
        if (notification.timeoutId) {
            clearTimeout(notification.timeoutId);
        }

        // Fade out after duration
        notification.timeoutId = setTimeout(() => {
            notification.style.opacity = '0';
            // Optional: remove element after fade out
             setTimeout(() => {
                 if (notification.parentNode && notification.style.opacity === '0') {
                     // notification.parentNode.removeChild(notification);
                 }
             }, 300); // Wait for transition
        }, duration);
    };

    subscribe("/notify/success", (message) => showNotification(message, 'success'));
    subscribe("/notify/error", (message) => showNotification(message, 'error'));
    subscribe("/notify/info", (message) => showNotification(message, 'info'));

})(window);