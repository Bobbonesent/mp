import * as player from "player.js";
import * as platform from "platform.js";
import * as command from "util/command.js";
import * as pubsub from "util/pubsub.js";
import * as settings from "settings.js";

const document = window.document;
const node = document.querySelector("#playlist");
const list = node.querySelector("ol");

let current = null;
let items = [];
let height = 0;
let dragging = null;

function highlight() {
	items.forEach(item => {
		item.node.classList.toggle("current", item == current);
	});
}

function updateCommands() {
	command[items.length > 1 ? "enable" : "disable"]("playlist:prev");
	command[items.length > 1 ? "enable" : "disable"]("playlist:next");
	command[items.length > 1 ? "enable" : "disable"]("playlist:randomize");
}

function nodeToIndex(node) {
	let result = -1;
	items.forEach((item, index) => {
		if (item.node == node) { result = index; }
	});
	return result;
}

function playByIndex(index) {
	index = (index + items.length) % items.length; // forcing positive modulus
	current = items[index];
	player.play(current.url);
	highlight();
	updateCommands();
}

command.register("playlist:prev", null, () => playByIndex(items.indexOf(current)-1));
command.register("playlist:next", null, () => playByIndex(items.indexOf(current)+1));

command.register("playlist:randomize", null, () => {
	let newItems = [];
	let index = items.indexOf(current);

	while (items.length) {
		newItems.push(items.splice(index, 1)[0]);
		index = Math.floor(items.length*Math.random());
	}

	items = newItems;

	list.innerHTML = "";
	items.forEach(item => list.appendChild(item.node));

	updateCommands();
});

function syncVisibility() {
	let visible = settings.get("playlist");
	let isVisible = (node.style.display != "none");
	if (visible == isVisible) { return; }

	if (visible) {
		platform.resizeBy(0, height);
		node.style.display = "";
	} else {
		height = node.offsetHeight;
		node.style.display = "none";
		platform.resizeBy(0, -height);
	}
}

export function clear() {
	list.innerHTML = "";
	items = [];
	current = null;
	updateCommands();
}

export function add(url) {
	let item = {
		url: url,
		node: document.createElement("li"),
		remove: document.createElement("button")
	}
	items.push(item);

	list.appendChild(item.node);
	let text = decodeURI(url.href).match(/[^\/]*$/);
	item.node.appendChild(document.createTextNode(text));
	item.remove.title = "Remove from playlist";
	item.node.appendChild(item.remove);
	item.node.draggable = true;

	if (items.length == 1) {
		current = items[0];
		highlight();
	}
	updateCommands();
}

list.addEventListener("click", e => {
	let remove = false, node = e.target;
	if (node.nodeName.toLowerCase() == "button") {
		remove = true;
		node = node.parentNode;
	}

	let index = nodeToIndex(node);
	if (index == -1) { return; }

	e.preventDefault();
	if (remove) {
		let item = items.splice(index, 1)[0];
		item.node.parentNode.removeChild(item.node);
		updateCommands();
	} else {
		playByIndex(index);
	}
});

list.addEventListener("dragstart", e => {
	dragging = nodeToIndex(e.target);
});

list.addEventListener("dragenter", e => {
	let targetIndex = nodeToIndex(e.target);
	if (targetIndex == -1 || targetIndex == dragging) { return; }

	let item = items.splice(dragging, 1)[0];
	items.splice(targetIndex, 0, item);

	list.innerHTML = "";
	items.forEach(item => list.appendChild(item.node));

	dragging = targetIndex;
});

player.audio.addEventListener("ended", e => {
	let index = items.indexOf(current);
	let repeat = settings.get("repeat");

	switch (repeat) {
		case "1": // repeat current
			playByIndex(index);
		break;

		case "N": // repeat playlist, i.e. advance to next/first
			if (index+1 < items.length) {
				playByIndex(index+1);
			} else {
				playByIndex(0);
			}
		break;

		case "": // advance to next
			if (index+1 < items.length) { playByIndex(index+1); }
		break;
	}
});

function syncSettings(message, publisher, data) {
	if (data != "playlist") { return; }
	syncVisibility();
}

pubsub.subscribe("settings-change", syncSettings);
syncVisibility();
clear();
