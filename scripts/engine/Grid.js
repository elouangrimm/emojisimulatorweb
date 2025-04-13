(function(exports){

// Singleton Class
exports.Grid = {};

// Initialize
Grid.initialize = function(){

	// Grid size
	var WIDTH = Model.data.world.size.width;
	var HEIGHT = Model.data.world.size.height;

	// Make the 2D array
	var agents = [];
	Grid.array = [];
	for(var y=0;y<HEIGHT;y++){
		Grid.array.push([]);
		for(var x=0;x<WIDTH;x++){
			var agent = new Agent(x,y);
			agents.push(agent);
			Grid.array[y].push(agent);
		}
	}

	// Randomly set agent states based on proportion.
	for(var i=0;i<agents.length;i++){
		agents[i].forceState(_getProportionalRandom());
	}

};
var _getProportionalRandom = function(){

	var proportions = Model.data.world.proportions;

	// Get total
	var total = 0;
	for(var i=0;i<proportions.length;i++){
		total += proportions[i].parts;
	}

	// Get a random number from that, like a dart
	var random = Math.random()*total;

	// Return the state that dart hit
	var current = 0;
	for(var i=0;i<proportions.length;i++){

		// Add to current
		var proportion = proportions[i];
		current += proportion.parts;

		// If so, good! return this stateID
		if(random<current){
			return proportion.stateID;
		}

	}

	// Whoops
	console.error("Something messed up in the random state selector");

}

// Simultaneous Step
Grid.step = function(){

	// Update style
	var UPDATE = Model.data.world.update;

	// Shuffle update order, then do 'em all
	var all = _shuffle(Grid.getAllAgents());
	for(var i=0;i<all.length;i++) all[i].markAsNotUpdated();
	for(var i=0;i<all.length;i++) all[i].calculateNextState();
	for(var i=0;i<all.length;i++) all[i].gotoNextState();

};

var _shuffle = function(array){
	var currentIndex = array.length, temporaryValue, randomIndex;

	// While there remain elements to shuffle...
	while (0 !== currentIndex) {
		// Pick a remaining element...
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex -= 1;

		// And swap it with the current element.
		temporaryValue = array[currentIndex];
		array[currentIndex] = array[randomIndex];
		array[randomIndex] = temporaryValue;
	}

	return array;
}

// Remove agents?
subscribe("/ui/updateStateHeaders",function(){
	for(var y=0;y<Grid.array.length;y++){
		for(var x=0;x<Grid.array[0].length;x++){
			var agent = Grid.array[y][x];
			if(!Model.getStateByID(agent.stateID)){
				agent.forceState(0); // state's gone, force delete it.
			}
		}
	}

	publish("/grid/updateAgents");
});

// Resize all DOMs
var grid_container = document.getElementById("grid_container");
var play_container = document.getElementById("play_container");
var editor_container = document.getElementById("editor_container");

// Render the Emoji
Grid.dom = document.getElementById("grid");
Grid.bg = document.getElementById("grid_bg");
Grid.domContainer = document.getElementById("grid_container");
Grid.css = document.getElementById("grid_style");
Grid.tileSize = 1;
Grid.updateSize = function(){
	console.log("Grid.updateSize called"); // Log when called

	// Ensure grid container and array exist
	if (!Grid.domContainer || !Grid.array || !Grid.array[0]) {
		 console.warn("Grid.updateSize: Cannot update size, elements missing.");
		return;
	}


	// RESIZE OTHER DOMs (Play container, etc.) - Maybe move this elsewhere if not grid specific
	// const editor_container = document.getElementById("editor_container"); // Get it if needed
	// const play_container = document.getElementById("play_container");
	// if (grid_container && editor_container && play_container) {
	//     const availableWidth = document.body.clientWidth - editor_container.offsetWidth; // Calculate based on actual editor width
	//     grid_container.style.width = `${availableWidth}px`;
	//     play_container.style.width = `${availableWidth}px`;
	//     // Height calculation might need review depending on layout
	//     grid_container.style.height = `calc(100vh - ${play_container.offsetHeight}px)`;

	// }


	// --- Calculate Tile Size ---
	const maxWidth = Grid.domContainer.clientWidth;
	const maxHeight = Grid.domContainer.clientHeight;
	const w = Grid.array[0].length;
	const h = Grid.array.length;

	// Ensure w, h, maxWidth, maxHeight are valid numbers > 0
	if (w <= 0 || h <= 0 || maxWidth <= 0 || maxHeight <= 0) {
		console.warn("Grid.updateSize: Invalid dimensions for calculation.");
		return; // Avoid division by zero or incorrect sizing
	}

	const t = Math.max(1, Math.min(Math.floor(maxWidth / w), Math.floor(maxHeight / h))); // Ensure tile size >= 1
	Grid.tileSize = t;
	console.log(`Grid.updateSize: New tile size = ${t}`);


	// --- Update CSS ---
	let css = ""; // Use let
	const gridWidth = w * t;
	const gridHeight = h * t;

	// Grid container positioning (ensure it's centered if needed by parent flex)
	 css += `#grid_container { /* Styles for centering if needed */ } \n`;

	// Position #grid and #grid_bg within the centered container
	 css += `#grid, #grid_bg { width:${gridWidth}px; height:${gridHeight}px; font-size:${t}px; }\n`;

	// Style individual cells (#grid > div > div)
	css += `#grid > div { width:${gridWidth}px; height:${t}px; }\n`; // Row wrapper
	css += `#grid > div > div { width:${t}px; height:${t}px; }\n`; // Cell

	// Style background grid cells (#grid_bg > div)
	css += `#grid_bg > div { width:${t-1}px; height:${t-1}px; border: 1px solid #e0e0e0; }\n`; // Adjusted border/size

	// Apply CSS
	if (Grid.css) Grid.css.innerHTML = css;


	// --- Rebuild Grid Background HTML ---
	let bg_html = ""; // Use let
	for(let y = 0; y < h; y++){
		for(let x = 0; x < w; x++){
			const top = Math.floor(t * y);
			const left = Math.floor(t * x);
			// Add inline styles directly for positioning bg divs
			bg_html += `<div style='top:${top}px; left:${left}px; width:${t-1}px; height:${t-1}px;'></div>`;
		}
	}
	 if (Grid.bg) Grid.bg.innerHTML = bg_html; // Update background grid


	// --- Rebuild *Structure* of Real Grid HTML (Rows and Divs) ---
	// This part ensures the DOM structure matches the grid dimensions
	// It does NOT reset the content (emoji) inside the cells.
	let grid_html = ""; // Use let
	for(let y = 0; y < h; y++){
		grid_html += "<div>"; // Row
		for(let x = 0; x < w; x++) grid_html += `<div>${Grid.array[y][x] ? Model.getStateByID(Grid.array[y][x].stateID)?.icon || '' : ''}</div>`; // Cell + current content
		grid_html += "</div>";
	}
	 if (Grid.dom) Grid.dom.innerHTML = grid_html; // Rebuild grid structure with current content

	// *** DO NOT REINITIALIZE OR REDRAW AGENTS HERE ***
	// Grid.reinitialize(); // << REMOVE THIS if present
	// publish("/grid/updateAgents"); // << REMOVE THIS (unless needed to fix rendering artifacts after structural change)
	console.log("Grid.updateSize finished without reinitializing agents.");
};
subscribe("/grid/updateSize",Grid.updateSize,false);
subscribe("ui/resize",Grid.updateSize,false);

Grid.updateAgents = function(){

	// Update ONLY if the emoji is different
	for(var y=0;y<Grid.array.length;y++){
		for(var x=0;x<Grid.array[0].length;x++){

			var agent = Grid.array[y][x];
			var icon = Model.getStateByID(agent.stateID).icon;
			var currentIcon = Grid.dom.children[y].children[x].innerHTML;

			if(icon!=currentIcon){
				Grid.dom.children[y].children[x].innerHTML = icon;
			}
			
		}
	}

};
subscribe("/grid/updateAgents",Grid.updateAgents);

/////////////////////////////
// External Helper Methods //
/////////////////////////////

Grid.NEIGHBORHOOD_MOORE = "moore";
Grid.NEIGHBORHOOD_NEUMANN = "neumann";
Grid.getNeighbors = function(agent){

	// Oh WOW Polygon's get-neighbor code was O(n^2) what the FU--

	// First, create all possible neighbor coords
	var x = agent.x;
	var y = agent.y;

	// What kinda neighborhood
	var coords;
	var hood = Model.data.world.neighborhood;
	if(hood==Grid.NEIGHBORHOOD_MOORE){
		coords = [
			[x-1,y-1], [x,  y-1], [x+1,y-1],
			[x-1,y  ],            [x+1,y  ],
			[x-1,y+1], [x,  y+1], [x+1,y+1],
		];
	}else if(hood==Grid.NEIGHBORHOOD_NEUMANN){
		coords = [
			[x,y-1], [x-1,y], [x+1,y], [x,y+1],
		];
	}

	// Then, filter out ones that can't work
	coords = coords.filter(function(coord){
		var x = coord[0];
		var y = coord[1];
		if(x<0) return false;
		if(x>=Grid.array[0].length) return false;
		if(y<0) return false;
		if(y>=Grid.array.length) return false;
		return true;
	});

	// Then, get all neighbors at those coords
	var neighbors = [];
	for(var i=0;i<coords.length;i++){
		var x = coords[i][0];
		var y = coords[i][1];
		neighbors.push(Grid.array[y][x]);
	}

	// Return!
	return neighbors;

};

// Get ALL agents (just collapses to a single array)
Grid.getAllAgents = function(){

	// Then, get all neighbors at those coords
	var agents = [];
	for(var y=0;y<Grid.array.length;y++){
		for(var x=0;x<Grid.array[0].length;x++){
			agents.push(Grid.array[y][x]);
		}
	}

	// Return!
	return agents;

};

// Count neighbors of a certain state
Grid.countNeighbors = function(agent,stateID){
	var count = 0;
	var neighbors = Grid.getNeighbors(agent);
	for(var i=0;i<neighbors.length;i++){
		if(neighbors[i].stateID==stateID) count++;
	}
	return count;
};

// Reset world, update the view, and resize to fit
Grid.reinitialize = function(){
	Grid.initialize();
	publish("/grid/updateSize");
	publish("/grid/updateAgents");
};
subscribe("/grid/reinitialize",Grid.reinitialize,false);

///////////////////////////
// Editor UI Shenanigans //
///////////////////////////

Grid.createUI = function(){

	var config = Model.data.world;

	return EditorHelper()
			.label("This world is a ")
			.number(config.size, "width", {
				integer:true,
				min:5, max:50,
				step:1,
				message:"/grid/reinitialize"
			})
			.label(" by ")
			.number(config.size, "height", {
				integer:true,
				min:5, max:50,
				step:1,
				message:"/grid/reinitialize"
			})
			.label(" grid.")
			.label("<br><br>")
			.label("We start with this ratio of things:<br>")
			.proportions()
			.label("<br>")
			.label("And each thing considers ")
			.selector([
				{ name:"the 4 spots to its sides", value:Grid.NEIGHBORHOOD_NEUMANN },
				{ name:"the 8 spots to its sides & corners", value:Grid.NEIGHBORHOOD_MOORE }
			],config,"neighborhood",{
				maxWidth: "none"
			})
			.label(" to be its neighboring spots.")
			.dom;

};

})(window);
