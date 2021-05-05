
const VIDEO_CONTENT_TYPE = "video/webm";

const STORAGE_DEFAULTS = {
    uploadedImgurFiles: [],
    presetButtonAction: "popupWindow",
    imageFormat: "image/jpeg",
    buttonIcon: "default",
    afterGrabAction: "openEditor",
    defaultTool: "arrow",
    fontFamily: "cambria",
    fontSize: "normal",
    lineWeight: 5,
    fontBackground: "semi-transparent",
    blurShape: "selectArea",
    drawingColor: "#f44336", // // must be HEX for color-picker to work! NOT rgba(244,67,54,1)
    downloadButton: true,
    saveAsButton: true,
    uploadButton: true,
    saveToDriveButton: true,
    copyToClipboardButton: true,
    editInPixlrButton: true,
    shareButton: true,
    openButton: true,
    pdfButton: true,
    searchImageButton: true,
    grabEntireScreenButton: true,
    openFromClipboardButton: true,
    openFileButton: true,
    audioInput: "default",
};

var storage = new ChromeStorage();

chrome.commands.onCommand.addListener(async command => {
    try {
        if (command == "grab_selected_area") {
            await grabSelectedArea();
        } else if (command == "select_element") {
            await selectElement();
        } else if (command == "grab_visible_page") {
            await grabVisiblePart();
        } else if (command == "grab_entire_page") {
            await grabEntirePage();
        } else if (command == "grab_entire_screen") {
            await grabScreen();
        } else if (command == "record_screen") {
            await recordScreen();
        }
    } catch (error) {
        alert(error);
    }
});

async function grabSelectedArea(params = {}) {
    console.log("grabSelectedArea", params);
    await setGrabMethod("selectedArea");
    params.urlToGoAfter = "snapshot.html";
    return captureVisibleTab(params);
}

async function setGrabMethod(methodName) {
    return storage.set("grabMethod", methodName);
}


async function captureVisibleTab(params = {}) {
    const imageFormat = await storage.get("imageFormat");
	return new Promise(function(resolve, reject) {
        const captureOptions = {
            format: getCaptureVisibleTabFormat(imageFormat),
        }

        // patch for blurred image in firefox: https://jasonsavard.com/forum/discussion/comment/26542#Comment_26542
        if (DetectClient.isFirefox()) {
            captureOptions.quality = 92;
        }

        chrome.tabs.captureVisibleTab(null, captureOptions, function(data) {
            if (chrome.runtime.lastError) {
                console.warn(chrome.runtime.lastError.message);

                if (!chrome.runtime.lastError.message.includes("chrome-extension")) {
                    if (params.delay) {
                        showMessageNotification("Problem with screenshot", "You must stay within the same tab");
                    }
                }

                grabTab(params).then(() => {
                    resolve();
                }).catch(error => {
                    reject(error);
                });
            } else {
                getActiveTab(tab => {
                    screenShotTab = tab;
                    screenShotData = data;
                    screenShotParams = params;
                    chrome.tabs.create({url: params.urlToGoAfter});
                    resolve();
                });
            }
        });
	});
}



function getCaptureVisibleTabFormat(imageFormat) {
	var captureVisibleTabFormat;
	if (imageFormat == "image/jpeg") {
		captureVisibleTabFormat = "jpeg";
	} else {
		captureVisibleTabFormat = "png";
	}
	return captureVisibleTabFormat;
}


function grabTab(params = {}) {
	params.grabTab = true;
	return grabScreen(params);
}

//return 1st active tab
function getActiveTab(callback) {
	chrome.tabs.query({'active': true, lastFocusedWindow: true}, function(tabs) {
		if (tabs) {
			callback(tabs[0]);
		} else {
			callback();
		}
	});
}

function ChromeStorage(params = {}) {
	var that = this;
	
	var storageArea;
	if (params.storageArea == "sync" && chrome.storage.sync) {
		storageArea = chrome.storage.sync;
	} else {
		storageArea = chrome.storage.local;
	}

	this.get = function(key, raw = null) {
        return new Promise((resolve, reject) => {
            storageArea.get(key, items => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError.message);
                } else {
                    if (items[key] === undefined) {
                        if (raw) {
                            resolve();
                        } else {
                            resolve(STORAGE_DEFAULTS[key]);
                        }
                    } else {
                        if (!raw) {
                            items[key] = JSON.parse(JSON.stringify(items[key]), dateReviver);
                        }
                        resolve(items[key]);
                    }
                }
            });
        });
    }

    this.getRaw = function(key) {
        return that.get(key, true);
    }

    this.getEncodedUint8Array = async function(key) {
        const value = await that.getRaw(key);

        if (typeof value !== "undefined") {
            const ary = value.split(',');
            return Uint8Array.from(ary);
        }
    }

    this.getEncodedArrayBuffer = async function(key) {
        const uint8array = await that.getEncodedUint8Array(key);
        return uint8array?.buffer;
    }
	
	this.set = function(key, value) {
		return new Promise((resolve, reject) => {
			if (value === undefined) {
				var error = "value not set for key: " + key;
				console.error(error);
				reject(error);
			}
			
			var storageValue;

			// clone any objects/dates etc. or else we could modify the object outside and the cache will also be changed
			if (value instanceof Date) {
				storageValue = value.toJSON(); // must stringify this one because chrome.storage does not serialize
            } else if (value instanceof Uint8Array) {
                storageValue = value.toString();
            } else if (value instanceof ArrayBuffer) {
                const uint8array = new Int8Array(value);
                storageValue = uint8array.toString();
			} else if (value !== null && typeof value === 'object') {
                storageValue = JSON.parse(JSON.stringify(value));
			} else {
				storageValue = value;
			}
			
			var item = {};
			item[key] = storageValue;
			storageArea.set(item, function() {
				if (chrome.runtime.lastError) {
					var error = "Error with saving key: " + key + " " + chrome.runtime.lastError.message;
					console.error(error);
					reject(error);
				} else {
					resolve();
				}
			});
		});
	}
    
    this.setEncryptedObj = async function (key, value, replacer = null) {
        const encryptedObj = await Encryption.encryptObj(value, replacer);
        return that.set(key, encryptedObj);
    };

    this.getEncryptedObj = async function(key, reviver = null) {
        const value = await that.getEncodedArrayBuffer(key);
        try {
            return await Encryption.decryptObj(value, reviver);
        } catch (error) {
            console.log("Use default value probably not enc or first time: ", error);
            return STORAGE_DEFAULTS[key];
        }
    }
    
	this.enable = function(key) {
		return that.set(key, true);
	}

	this.disable = function(key) {
		return that.set(key, false);
	}
	
	this.setDate = function(key) {
		return that.set(key, new Date());
	}
	
	this.toggle = async function(key) {
    	if (await that.get(key)) {
    		return that.remove(key);
    	} else {
    		return that.set(key, true);
    	}
	}
	
	this.remove = function(key) {
		return new Promise((resolve, reject) => {
			storageArea.remove(key, function() {
				if (chrome.runtime.lastError) {
					var error = "Error removing key: " + key + " " + chrome.runtime.lastError.message;
					console.error(error);
					reject(error);
				} else {
					resolve();
				}
			});
		});
	}
	
	this.clear = function() {
		return new Promise((resolve, reject) => {
			storageArea.clear(function() {
				if (chrome.runtime.lastError) {
					var error = "Error clearing cache: " + chrome.runtime.lastError.message;
					console.error(error);
					reject(error);
				} else {
					resolve();
				}
			});
		});
	}
	
	this.firstTime = async function(key) {
		if (await that.get("_" + key)) {
			return false;
		} else {
			await that.set("_" + key, new Date());
			return true;
		}
	}
}

var DetectClient = {};
DetectClient.isChrome = function() {
	return /chrome/i.test(navigator.userAgent) && !DetectClient.isOpera();
}
DetectClient.isFirefox = function() {
	return /firefox/i.test(navigator.userAgent);
}
DetectClient.isEdge = function() {
	return /edg\//i.test(navigator.userAgent);
}
DetectClient.isWindows = function() {
	return /windows/i.test(navigator.userAgent);
}
DetectClient.isNewerWindows = function() {
	return navigator.userAgent.match(/Windows NT 1\d\./i) != null; // Windows NT 10+
}
DetectClient.isMac = function() {
	return /mac/i.test(navigator.userAgent);
}
DetectClient.isLinux = function() {
	return /linux/i.test(navigator.userAgent);
}
DetectClient.isOpera = function() {
	return /opr\//i.test(navigator.userAgent);
}
DetectClient.isRockMelt = function() {
	return /rockmelt/i.test(navigator.userAgent);
}
DetectClient.isChromeOS = function() {
	return /cros/i.test(navigator.userAgent);
}
DetectClient.getChromeChannel = function(callback) {
	fetchJSON("https://omahaproxy.appspot.com/all.json?callback=?").then(data => {
		var versionDetected;
		var stableDetected = false;
		var stableVersion;

		for (var a=0; a<data.length; a++) {

			var osMatched = false;
			// patch because Chromebooks/Chrome OS has a platform value of "Linux i686" but it does say CrOS in the useragent so let's use that value
			if (DetectClient.isChromeOS()) {
				if (data[a].os == "cros") {
					osMatched = true;
				}
			} else { // the rest continue with general matching...
				if (navigator.userAgent.toLowerCase().includes(data[a].os)) {
					osMatched = true;
				}
			}
			
			if (osMatched) {
				for (var b = 0; b < data[a].versions.length; b++) {
					if (data[a].versions[b].channel == "stable") {
						stableVersion = data[a].versions[b];
					}
                    if (navigator.userAgent.includes(data[a].versions[b].previous_version)
                    || navigator.userAgent.includes(data[a].versions[b].version)) {
						// it's possible that the same version is for the same os is both beta and stable???
						versionDetected = data[a].versions[b];
						if (data[a].versions[b].channel == "stable") {
							stableDetected = true;
							callback(versionDetected);
							return;
						}
					}
				}

				var chromeVersionMatch = navigator.userAgent.match(/Chrome\/(\d+(.\d+)?(.\d+)?(.\d+)?)/i);
				if (chromeVersionMatch) {
					var currentVersionObj = parseVersionString(chromeVersionMatch[1]);
					var stableVersionObj = parseVersionString(stableVersion.previous_version);
					if (currentVersionObj.major < stableVersionObj.major) {
						resolve({ oldVersion: true, reason: "major diff" });
						return;
					} else if (currentVersionObj.major == stableVersionObj.major) {
						if (currentVersionObj.minor < stableVersionObj.minor) {
							resolve({ oldVersion: true, reason: "minor diff" });
							return;
						} else if (currentVersionObj.minor == stableVersionObj.minor) {
							/*
							if (currentVersionObj.patch < stableVersionObj.patch) {
								resolve({ oldVersion: true, reason: "patch diff" });
								return;
							}
							*/
							// commented above to ignore patch differences
							stableDetected = true;
							resolve(stableVersion);
							return;
						}
					}
				}				
			}
		}

		// probably an alternative based browser like RockMelt because I looped through all version and didn't find any match
		if (data.length && !versionDetected) {
			callback({channel:"alternative based browser"});
		} else {
			callback(versionDetected);
		}
	});
}


async function initUI() {
    if (await storage.get("darkMode") && !location.href.includes("contribute.")) {
        document.documentElement.setAttribute("color-scheme", "dark");
    } else {
        document.documentElement.setAttribute("color-scheme", "white");
    }

    await initMisc();
    initMessages();
}



function sendMessageToBG(command, params, stringifyParams = false) {
    if (!DetectClient.isFirefox()) {
        stringifyParams = false;
    }

    if (window.inBackground) { // if running in same context
        if (command.includes(".")) { // ie. forgottenReminder.start
            const commands = command.split(".");
            return window[commands[0]][commands[1]](params);
        } else {
            return window[command](params);
        }
    } else {
        return new Promise((resolve, reject) => {
            if (stringifyParams) {
                params = JSON.stringify(params);
            }
            chrome.runtime.sendMessage({command: command, params: params, stringifyParams: stringifyParams}, response => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError.message);
                } else {
                    response = initUndefinedObject(response);
                    if (response && response.error) {
                        console.log("error2", response);
                        if (response.error.message) { // recreate errorobj
                            const errorObj = Error(response.error.message);
                            copyObj(response.error, errorObj);
                            console.error("recreate error obj", errorObj)
                            reject(errorObj);
                        } else {
                            reject(response.error);
                        }
                    } else {
                        resolve(response);
                    }
                }
            });
        });
    }
}