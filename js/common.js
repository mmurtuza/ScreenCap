function customShowError(error) {
    if (globalThis.$) {
        $(document).ready(function () {
            $("body")
                .show()
                .removeAttr("hidden")
                .css("opacity", 1)
                .prepend($("<div style='background:red;color:white;padding:5px;z-index:999'>").text(error))
                ;
        });
    } else {
        showCouldNotCompleteActionNotification(error);
    }
}

function displayUncaughtError(errorStr) {
	if (globalThis.polymerPromise2?.then) {
		polymerPromise2.then(() => {
			if (globalThis.showError) {
                // must catch errors here to prevent onerror loop
                showError(errorStr).catch(e => {
                    console.error(e);
                    customShowError(errorStr);
                });
			} else {
				customShowError(errorStr);
			}
		}).catch(error => {
			customShowError(errorStr);
		});
	} else {
		customShowError(errorStr);
	}
}

globalThis.onerror = function(msg, url, line) {
	var thisUrl = removeOrigin(url).substr(1); // also remove beginning slash '/'
	var thisLine;
	if (line) {
		thisLine = " (" + line + ") ";
	} else {
		thisLine = " ";
	}
	
	var category = "JS Errors"; 
	var GAError = thisUrl + thisLine + msg;
	var label = navigator.appVersion;
	
	sendGA(category, GAError, label);
	
	var errorStr = msg + " (" + thisUrl + " " + line + ")";

    // patch for this weird error
	if (msg && msg.indexOf && msg.includes("ResizeObserver loop limit exceed")) {
		return true;
	}

    displayUncaughtError(errorStr);
	
	//return false; // false prevents default error handling.
};

globalThis.addEventListener('unhandledrejection', function (event) {
    const error = event.reason.stack ? event.reason.stack : event.reason;
    console.error("unhandledrejection", error);
    displayUncaughtError(error);
  
    // Prevent the default handling (error in console)
    //event.preventDefault();
});

//usage: [url] (optional, will use location.href by default)
function removeOrigin(url) {
	var linkObject;
	if (arguments.length && url) {
		try {
			linkObject = document.createElement('a');
			linkObject.href = url;
		} catch (e) {
			console.error("jerror: could not create link object: " + e);
		}
	} else {
		linkObject = location;
	}
	
	if (linkObject) {
		return linkObject.pathname + linkObject.search + linkObject.hash;
	} else {
		return url;
	}
}

function logError(msg, o) {
	try {
		var onErrorMessage;
		if (o) {
			console.error(msg, o);
			onErrorMessage = msg + " " + o;
		} else {
			console.error(msg);
			onErrorMessage = msg;
		}
		globalThis.onerror(onErrorMessage, location.href);
	} catch (e) {
		console.error("error in onerror?", e);
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

function getInternalPageProtocol() {
	var protocol;
	if (DetectClient.isFirefox()) {
		protocol = "moz-extension:";
	} else {
		protocol = "chrome-extension:";
	}
	return protocol;
}

function isInternalPage(url) {
	if (arguments.length == 0) {
		url = location.href;
	}
	return url && url.indexOf(getInternalPageProtocol()) == 0;
}

function openContributeDialog(key) {
	openGenericDialog({
		title: getMessage("extraFeatures"),
		content: getMessage("extraFeaturesPopup1") + "<br>" + getMessage("extraFeaturesPopup2"),
		otherLabel: getMessage("contribute")
	}).then(function (response) {
		if (response == "other") {
			openUrl("contribute.html?action=" + key);
		}
	});
}

async function setStorage(element, params) {
	var OFF_OR_DEFAULT = DEFAULT_SETTINGS_ALLOWED_OFF.includes(params.key) && (!params.value || STORAGE_DEFAULTS[params.key] == params.value);
	
	if (($(element).closest("[mustDonate]").length || params.mustDonate) && !donationClickedFlagForPreventDefaults && !OFF_OR_DEFAULT) {
		params.event.preventDefault();
		openContributeDialog(params.key);
		return Promise.reject(JError.DID_NOT_CONTRIBUTE);
	} else {
		return storage.set(params.key, params.value);
	}
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

var storage = new ChromeStorage();

var ONE_SECOND = 1000;
var ONE_MINUTE = 60000;
var ONE_HOUR = ONE_MINUTE * 60;
var ONE_DAY = ONE_HOUR * 24;

Calendar = function () {};

if (typeof(jQuery) != "undefined") {
	jQuery.fn.exists = function(){return jQuery(this).length>0;}
	jQuery.fn.unhide = function() {
		this.removeAttr('hidden');
		return this;
	}
	jQuery.fn.hidden = function () {
		this.attr('hidden', true);
		return this;
	}
	var originalShow = jQuery.fn.show;
	jQuery.fn.show = function(duration, callback) {
		if (!duration){
			originalShow.apply(this, arguments);
			this.removeAttr('hidden');
		} else {
			var that = this;
			originalShow.apply(this, [duration, function() {
				that.removeAttr('hidden');
				if (callback){
					callback.call(that);
				}
			}]);
		}
		return this;
	};
}

function seconds(seconds) {
	return seconds * ONE_SECOND;
}

function minutes(minutes) {
	return minutes * ONE_MINUTE;
}

function hours(hours) {
	return hours * ONE_HOUR;
}

async function _readMessagesFile(lang, region) {
    var folderName;
    if (region) {
        folderName = lang + "_" + region.toUpperCase();
    } else {
        folderName = lang;
    }
    
    return fetchJSON(chrome.runtime.getURL("_locales/" + folderName + "/messages.json"));
}

async function _loadLocaleMessagesFile() {
    const localeFormatted = locale.replace("-", "_");
    const lang = localeFormatted.split("_")[0].toLowerCase();
    const region = localeFormatted.split("_")[1];
    
    try {
        localeMessages = await _readMessagesFile(lang, region);
    } catch (error) {
        // if we had region then try lang only
        if (region) {
            console.log("Couldn't find region: " + region + " so try lang only: " + lang);
            try {
                localeMessages = await _readMessagesFile(lang);
            } catch (error) {
                // always resolve
                console.warn(error);
            }
        } else {
            console.warn("Lang not found: " + lang);
        }
    }
}

async function loadLocaleMessages() {
    // only load locales from files if they are not using their browser language (because i18n.getMessage uses the browser language) 
    if (chrome.i18n.getUILanguage && (locale == chrome.i18n.getUILanguage() || locale == chrome.i18n.getUILanguage().substring(0, 2))) {
        // for english just use native calls to get i18n messages
        localeMessages = null;
    } else {
        //console.log("loading locale: " + locale);
        // i haven't created a en-US so let's avoid the error in the console and just push the callback
        if (locale != "en-US") {
            await _loadLocaleMessagesFile();
        }
    }

    // service worker can't use getMessage so if nothing matched must load en file
    if (!globalThis.localeMessages && !chrome.i18n.getMessage) {
        localeMessages = await _readMessagesFile("en");
        console.log("localmessage", localeMessages);
    }
}

function getMessage(messageID, args, thisLocaleMessages) {
    // if localeMessage null because english is being used and we haven't loaded the localeMessage
    if (thisLocaleMessages) {
        localeMessages = thisLocaleMessages;
    }

	if (!globalThis.localeMessages) {
		try {
			localeMessages = chrome.extension.getBackgroundPage().localeMessages;
		} catch (e) {
			// might be in content_script and localMessages not defined because it's in english
			return chrome.i18n.getMessage(messageID, args);
		}				
	}
	if (localeMessages) {
		var messageObj = localeMessages[messageID];	
		if (messageObj) { // found in this language
			var str = messageObj.message;
			
			// patch: replace escaped $$ to just $ (because chrome.i18n.getMessage did it automatically)
			if (str) {
				str = str.replace(/\$\$/g, "$");
			}

			if (args) {
				if (args instanceof Array) {
					for (var a=0; a<args.length; a++) {
						str = str.replace("$" + (a+1), args[a]);
					}
				} else {
					str = str.replace("$1", args);
				}
			}
			return str;
		} else { // default to default language
			return chrome.i18n.getMessage(messageID, args);
		}
	} else {
		return chrome.i18n.getMessage(messageID, args);
	}
}

function analytics() {
	if (DetectClient.isChrome()) {
		var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
		ga.src = '/js/analytics.js';
		// changed append logic a bit because we are in an html import context now
		var s = document.getElementsByTagName('head')[0]; s.appendChild(ga, s);
		
		$(document).ready(function() {
			$("a, input, button").on("click", function() {
				var id = $(this).attr("ga");
				var label = null;
				if (id != "IGNORE") {
					if (!id) {
						id = $(this).attr("id");
					}
					if (!id) {
						id = $(this).attr("snoozeInMinutes");
						if (id) {
							label = "in minutes: " + id; 
							id = "snooze";
						}
						if (!id) {
							id = $(this).attr("snoozeInDays");
							if (id) {
								label = "in days: " + id; 
								id = "snooze";
							}
						}
						if (!id) {
							id = $(this).attr("msg");
						}
						if (!id) {
							id = $(this).attr("msgTitle");
						}
						if (!id) {
							id = $(this).attr("href");
							// don't log # so dismiss it
							if (id == "#") {
								id = null;
							}
						}
						if (id) {
							id = id.replace(/javascript\:/, "");
							// only semicolon so remove it and keep finding other ids
							if (id == ";") {
								id = "";
							}
						}
						if (!id) {
							id = $(this).parent().attr("id");
						}		
					}
					if ($(this).attr("type") != "text") {
						if ($(this).attr("type") == "checkbox") {
							if (this.checked) {
								label = id + "_on";
							} else {
								label = id + "_off";
							}
						}
						var category = $(this).parents("*[gaCategory]");
						var action = null;
						// if gaCategory specified
						if (category.length != 0) {
							category = category.attr("gaCategory");
							action = id;
						} else {
							category = id;
							action = "click";
						}
						
						if (label != null) {
							sendGA(category, action, label);
						} else {
							sendGA(category, action);
						}
					}
				}
			});
		});		
	}
}

//usage: sendGA('category', 'action', 'label');
//usage: sendGA('category', 'action', 'label', value);  // value is a number.
//usage: sendGA('category', 'action', {'nonInteraction': 1});
function sendGA(category, action, label, etc) {
	console.log("%csendGA: " + category + " " + action + " " + label, "font-size:0.6em");

	// patch: seems arguments isn't really an array so let's create one from it
	var argumentsArray = [].splice.call(arguments, 0);

	var gaArgs = ['send', 'event'];
	// append other arguments
	gaArgs = gaArgs.concat(argumentsArray);
	
	// send to google
	if (globalThis.ga) {
		ga.apply(this, gaArgs);
	}
}

function getPaypalLC() {
	var locale = navigator.language;
	var lang = null;
	if (locale) {
		if (locale.match(/zh/i)) {
			lang = "CN"; 
		} else if (locale.match(/_GB/i)) {
			lang = "GB";
		} else if (locale.match(/ja/i)) {
			lang = "JP";
		} else {
			lang = locale.substring(0,2);
		}
		return lang;
	}
}

if (isInternalPage()) {
	if (typeof($) != "undefined") {
		
		// For some reason including scripts for popup window slows down popup window reaction time, so only found that settimeout would work
        if (location.href.includes("popup.")
        || location.href.includes("options.")) {
			setTimeout(function() {
				analytics();
			}, 1000);
		} else {
			analytics();
		}
	}
}

function getPreferredLanguage() {
	if (navigator.languages && navigator.languages.length) {
		return navigator.languages[0];
	} else {
		return navigator.language;
	}
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

async function initMisc(params = {}) {
    if (!globalThis.initMiscPromise) {
        console.info("initMisc");
        globalThis.initMiscPromise = new Promise(async (resolve, reject) => {

            locale = getPreferredLanguage();

            console.time("loadLocaleMessages");
            await loadLocaleMessages();
            console.timeEnd("loadLocaleMessages");

            // MUST USE promise with resolve because I could forget an await on one of these async functions above and could lead to race issue and undefined accounts or buttonIcon ref: https://jasonsavard.com/forum/discussion/comment/24170#Comment_24170
            resolve();
        });
    }
    return globalThis.initMiscPromise;
}

function parseURL(url) {
    var a =  document.createElement('a');
    a.href = url;
    return {
        source: url,
        protocol: a.protocol.replace(':',''),
        host: a.hostname,
        port: a.port,
        query: a.search,
        params: (function(){
            var ret = {},
                seg = a.search.replace(/^\?/,'').split('&'),
                len = seg.length, i = 0, s;
            for (;i<len;i++) {
                if (!seg[i]) { continue; }
                s = seg[i].split('=');
                ret[s[0]] = s[1];
            }
            return ret;
        })(),
        file: (a.pathname.match(/\/([^\/?#]+)$/i) || [,''])[1],
        hash: a.hash.replace('#',''),
        path: a.pathname.replace(/^([^\/])/,'/$1'),
        relative: (a.href.match(/tp:\/\/[^\/]+(.+)/) || [,''])[1],
        segments: a.pathname.replace(/^\//,'').split('/')
    };
}

function initPaperElement($nodes, params = {}) {
	$nodes.each(async (index, element) => {
		var $element = $(element);
		
		var key = $element.attr("storage");
		var permissions = $element.attr("permissions");
		
		// this "selected" attribute behaves weird with jQuery, the value gets sets to selected='selected' always, so we must use native .setAttibute
		if (key && key != "language") { // ignore lang because we use a specific logic inside the options.js
            const value = await storage.get(key);
			if (element.nodeName.equalsIgnoreCase("paper-checkbox")) {
				$element.attr("checked", toBool(value));
			} else if (element.nodeName.equalsIgnoreCase("paper-listbox")) {
				element.setAttribute("selected", value ?? "");
			} else if (element.nodeName.equalsIgnoreCase("paper-radio-group")) {
				element.setAttribute("selected", value ?? "");
			} else if (element.nodeName.equalsIgnoreCase("paper-slider")) {
				element.setAttribute("value", value);
			}
		} else if (permissions) {
			chrome.permissions.contains({permissions: [permissions]}, function(result) {
				$element.attr("checked", result);
			});
		}

		// need a 1ms pause or else setting the default above would trigger the change below?? - so make sure it is forgotten
		setTimeout(function() {
			
			var eventName;
			if (element.nodeName.equalsIgnoreCase("paper-checkbox")) {
				eventName = "change";
			} else if (element.nodeName.equalsIgnoreCase("paper-listbox")) {
				eventName = "iron-activate";
			} else if (element.nodeName.equalsIgnoreCase("paper-radio-group")) {
				eventName = "paper-radio-group-changed";
			} else if (element.nodeName.equalsIgnoreCase("paper-slider")) {
				eventName = "change";
			}
			
			$element.on(eventName, function(event) {
				if (key || params.key) {
					
					var value;
					if (element.nodeName.equalsIgnoreCase("paper-checkbox")) {
						value = element.checked;
					} else if (element.nodeName.equalsIgnoreCase("paper-listbox")) {
						value = event.originalEvent.detail.selected;
					} else if (element.nodeName.equalsIgnoreCase("paper-radio-group")) {
						value = element.selected;
					} else if (element.nodeName.equalsIgnoreCase("paper-slider")) {
						value = $element.attr("value");
					}

                    if (key) {
                        storagePromise = setStorage($element, {event:event, key:key, value:value});
                    } else if (params.key) {
                        params.event = event;
                        params.value = value;
                        storagePromise = setStorage($element, params);
                    }
                    
                    storagePromise.catch(error => {
                        console.error("could not save setting: " + error);
                        if (element.nodeName.equalsIgnoreCase("paper-checkbox")) {
                            element.checked = !element.checked;
                        } else if (element.nodeName.equalsIgnoreCase("paper-listbox")) {
                            $element.closest("paper-dropdown-menu")[0].close();
                        }
                        
                        if (error != JError.DID_NOT_CONTRIBUTE) {
                            showError(error);
                        }
                    });
				} else if (permissions) {
					if (element.checked) {
						chrome.permissions.request({permissions: [permissions]}, function(granted) {
							$element.attr("checked", granted);
						});
					} else {			
						chrome.permissions.remove({permissions: [permissions]}, function(removed) {
							if (removed) {
								$element.attr("checked", false);
							} else {
								// The permissions have not been removed (e.g., you tried to remove required permissions).
								$element.attr("checked", true);
								alert("These permissions could not be removed, they might be required!");
							}
						});
					}
				}
			});
		}, 500);
	});
}

function initOptions() {
	initPaperElement($("[storage], [permissions]"));
}

function initMessages(node) {
	var selector;
	if (node) {
		selector = node;
	} else {
		selector = "*";
	}
	$(selector).each(function() {
		//var parentMsg = $(this);
		var attr = $(this).attr("msg");
		if (attr) {
			var msgArg1 = $(this).attr("msgArg1");
			if (msgArg1) {
				$(this).text(chrome.i18n.getMessage( attr, msgArg1 ));
			} else {
				// look for inner msg nodes to replace before...
				var innerMsg = $(this).find("*[msg]");
				if (innerMsg.exists()) {
					//console.log("inside: ", innerMsg);
					initMessages(innerMsg);
					var msgArgs = new Array();
					innerMsg.each(function(index, element) {
						msgArgs.push( $(this)[0].outerHTML );
					});
					//console.log("msgargs: ", msgArgs);
					//console.log("attr: ", attr);
					//console.log("html: ", chrome.i18n.getMessage(attr, msgArgs))
					$(this).html(chrome.i18n.getMessage(attr, msgArgs));
					//return false;
				} else {
					$(this).text(chrome.i18n.getMessage(attr));
				}
			}
		}
		attr = $(this).attr("msgTitle");
		if (attr) {
			$(this).attr("title", chrome.i18n.getMessage(attr));
		}
		attr = $(this).attr("msgLabel");
		if (attr) {
			var msgArg1 = $(this).attr("msgLabelArg1");
			if (msgArg1) {
				$(this).attr("label", getMessage( $(this).attr("msgLabel"), msgArg1 ));
			} else {
				$(this).attr("label", getMessage(attr));
			}
		}
		attr = $(this).attr("msgText");
		if (attr) {
			var msgArg1 = $(this).attr("msgTextArg1");
			if (msgArg1) {
				$(this).attr("text", getMessage( $(this).attr("msgText"), msgArg1 ));
			} else {
				$(this).attr("text", getMessage(attr));
			}
		}
		attr = $(this).attr("msgSrc");
		if (attr) {
			$(this).attr("src", chrome.i18n.getMessage(attr));
		}
		attr = $(this).attr("msgValue");
		if (attr) {
			$(this).attr("value", chrome.i18n.getMessage(attr));
		}
		attr = $(this).attr("msgPlaceholder");
		if (attr) {
			$(this).attr("placeholder", getMessage(attr));
		}
		attr = $(this).attr("msgHTML");
		if (attr) {
			$(this).html(getMessage(attr));
		}
		attr = $(this).attr("msgHALIGN");
		if (attr) {
			if ($("html").attr("dir") == "rtl" && attr == "right") {
				$(this).attr("horizontal-align", "left");
			} else {
				$(this).attr("horizontal-align", attr);
			}
		}
		attr = $(this).attr("msgPOSITION");
		if (attr) {
			if ($("html").attr("dir") == "rtl" && attr == "left") {
				$(this).attr("position", "right");
			} else {
				$(this).attr("position", attr);
			}
		}
		
	});
	
	if (!DetectClient.isChrome()) {
		$("[chrome-only]").attr("hidden", "");
    }

    if (DetectClient.isEdge()) {
        $("[hide-from-edge]").attr("hidden", "");
    }
}

async function donationClicked(action) {
	if (await storage.get("donationClicked")) {
		return true;
	} else {
		openContributeDialog(action);
		return false;
	}
}

function parseTime(timeString, date) {    
    if (!timeString) return null;
	timeString = timeString.toLowerCase();
    var time = timeString.match(/(\d+)(:(\d\d))?\s*(a?p?)/i); 
    if (time == null) return null;
    var hours = parseInt(time[1],10);    
    if (hours == 12) {
		// Assume noon not midnight if no existant AM/PM
		if (!time[4] || time[4] == "p") {
			hours = 12;
		} else {
			hours = 0;
		}
    } else {
        hours += (hours < 12 && time[4] == "p") ? 12 : 0;
    }
    var d = new Date();
    if (date) {
    	d = date;
    }
    d.setHours(hours);
    d.setMinutes(parseInt(time[3],10) || 0);
    d.setSeconds(0, 0);  
    return d;
}

function findElementByAttribute(array, attributeName, attributeValue) {
	for (a in array) {
		if (array[a][attributeName] == attributeValue) {
			return array[a];
		}
	}
}

function selectOrCreateTab(findUrlStr, urlToOpen, callback) {
	chrome.windows.getAll({populate:true}, function (windows) {
		for(var a=0; a<windows.length; a++) {
			var tabs = windows[a].tabs;
			for(var b=0; b<tabs.length; b++) {
				if (tabs[b].url.includes(findUrlStr)) {
					// Uncomment this once the Chrome maximize bug is resolved: https://code.google.com/p/chromium/issues/detail?id=65371
					//chrome.windows.update(windows[a].id, {left:windows[a].left, width:windows[a].width, focused:true}, function() {
						chrome.tabs.update(tabs[b].id, { selected: true });
						callback({found:true, tab:tabs[b]});
					//});
					return true;
				}
			}
		}
		chrome.tabs.create({url: urlToOpen}, function(tab) {
			callback({found:false, tab:tab});			
		});
		return false;
	});
}

function removeNode(id) {
	var o = document.getElementById(id);
	if (o) {
		o.parentNode.removeChild(o);
	}
}

function addCSS(id, css) {
	removeNode(id);
	var s = document.createElement('style');
	s.setAttribute('id', id);
	s.setAttribute('type', 'text/css');
	s.appendChild(document.createTextNode(css));
	(document.getElementsByTagName('head')[0] || document.documentElement).appendChild(s);
}

function pad(str, times, character) { 
	var s = str.toString();
	var pd = '';
	var ch = character ? character : ' ';
	if (times > s.length) { 
		for (var i=0; i < (times-s.length); i++) { 
			pd += ch; 
		}
	}
	return pd + str.toString();
}

function getBrowserVersion() {
	// Browser name = Chrome, Full version = 4.1.249.1064, Major version = 4, navigator.appName = Netscape, navigator.userAgent = Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US) AppleWebKit/532.5 (KHTML, like Gecko) Chrome/4.1.249.1064 Safari/532.5
	//																															  Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US) AppleWebKit/533.4 (KHTML, like Gecko) Chrome/5.0.375.38 Safari/533.4
	var agent = navigator.userAgent;
	var offset = agent.indexOf("Chrome");
	var version = null;
	if (offset != -1) {
		version = agent.substring(offset+7);
		offset = version.indexOf(";");
		if (offset != -1) {
			version = version.substring(0, offset);
		}
		offset = version.indexOf(" ");
		if (offset != -1) {
			version = version.substring(0, offset);
		}
	}
	if (version) {
		return parseFloat(version);
	}
}

function toBool(str) {
	if ("false" === str || str == undefined) {
		return false;
	} else if ("true" === str) {
		return true;
	} else {
		return str;
	}
}

function getUrlValue(url, name, unescapeFlag) {
	if (url) {
	    var hash;
	    url = url.split("#")[0];
	    var hashes = url.slice(url.indexOf('?') + 1).split('&');
	    for(var i=0; i<hashes.length; i++) {
	        hash = hashes[i].split('=');
	        // make sure no nulls
	        if (hash[0] && name) {
				if (hash[0].toLowerCase() == name.toLowerCase()) {
					if (unescapeFlag) {
						return decodeURIComponent(hash[1]);
					} else {
						return hash[1];
					}
				}
	        }
	    }
	    return null;
	}
}

function setUrlParam(url, param, value) {
	var params = url.split("&");
	for (var a=0; a<params.length; a++) {
		var idx = params[a].indexOf(param + "=");
		if (idx != -1) {
			var currentValue = params[a].substring(idx + param.length + 1);

			if (value == null) {
				return url.replace(param + "=" + currentValue, "");
			} else {
				return url.replace(param + "=" + currentValue, param + "=" + value);
			}
		}
	}
	
	// if there is a hash tag only parse the part before;
	var urlParts = url.split("#");
	var newUrl = urlParts[0];
	
	if (!newUrl.includes("?")) {
		newUrl += "?";
	} else {
		newUrl += "&";
	}
	
	newUrl += param + "=" + value;
	
	// we can not append the original hashtag (if there was one)
	if (urlParts.length >= 2) {
		newUrl += "#" + urlParts[1];
	}
	
	return newUrl;
}

// Usage: getManifest(function(manifest) { display(manifest.version) });
function getManifest(callback) {
	var xhr = new XMLHttpRequest();
	xhr.onload = function() {
		callback(JSON.parse(xhr.responseText));
	};
	xhr.open('GET', './manifest.json', true);
	xhr.send(null);
}

function getExtensionIDFromURL(url) {
	//"chrome-extension://dlkpjianaefoochoggnjdmapfddblocd/options.html"
	return url.split("/")[2]; 
}

function getStatus(request, textStatus) {
	var status; // status/textStatus combos are: 201/success, 401/error, undefined/timeout
	try {
		status = request.status;
	} catch (e) {
		status = textStatus;
	}
	return status;
}

function resetTime(date) {
    date.setHours(0, 0, 0, 0);
    return date;
}

class DateZeroTime extends Date {
    constructor(...dateFields) {
        super(...dateFields);
        resetTime(this);
    }
}

function today() {
	return new DateZeroTime();
}

function yesterday() {
	const yest = new DateZeroTime();
	yest.setDate(yest.getDate()-1);
	return yest;
}

function tomorrow() {
	var tom = new DateZeroTime();
	tom.setDate(tom.getDate()+1);
	return tom;
}

function isToday(date) {
	return date.getFullYear() == today().getFullYear() && date.getMonth() == today().getMonth() && date.getDate() == today().getDate();
}

function isTomorrow(date) {
	var tomorrow = today();
	tomorrow.setDate(tomorrow.getDate()+1);
	return date.getFullYear() == tomorrow.getFullYear() && date.getMonth() == tomorrow.getMonth() && date.getDate() == tomorrow.getDate();
}

function isYesterday(date) {
	var tomorrow = today();
	tomorrow.setDate(tomorrow.getDate()-1);
	return date.getFullYear() == tomorrow.getFullYear() && date.getMonth() == tomorrow.getMonth() && date.getDate() == tomorrow.getDate();
}

Date.prototype.isToday = function () {
	return isToday(this);
};

Date.prototype.isTomorrow = function () {
	return isTomorrow(this);
};

Date.prototype.isYesterday = function () {
	return isYesterday(this);
};

Date.prototype.diffInMillis = function(otherDate) {
	var d1;
	if (otherDate) {
		d1 = new Date(otherDate);
	} else {
		d1 = new Date();
	}	
	var d2 = new Date(this);
	return (d2.getTime() - d1.getTime());
};

Date.prototype.diffInDays = function(otherDate) {
	var d1;
	if (otherDate) {
		d1 = new Date(otherDate);
	} else {
		d1 = today();
	}	
	d1.setHours(1);
	d1.setMinutes(1);
	var d2 = new Date(this);
	d2.setHours(1);
	d2.setMinutes(1);
	return (d2.getTime() - d1.getTime()) / ONE_DAY;
};

function addToArray(str, ary) {
	for (a in ary) {
		if (ary[a] == str) {
			return false;
		}
	}
	ary.push(str);
	return true;
}

function removeFromArray(str, ary) {
	for (var a=0; a<ary.length; a++) {
		if (ary[a] == str) {
			ary.splice(a, 1);
			return true;
		}
	}
	return false;
}

function isInArray(str, ary) {
	for (a in ary) {
		if (ary[a] == str) {
			return true;
		}
	}
	return false;
}

var dateFormat = function () {
	var	token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
		timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
		timezoneClip = /[^-+\dA-Z]/g,
		pad = function (val, len) {
			val = String(val);
			len = len || 2;
			while (val.length < len) val = "0" + val;
			return val;
		};

	// Regexes and supporting functions are cached through closure
	return function (date, mask, utc) {
		var dF = dateFormat;

		// You can't provide utc if you skip other args (use the "UTC:" mask prefix)
		if (arguments.length == 1 && Object.prototype.toString.call(date) == "[object String]" && !/\d/.test(date)) {
			mask = date;
			date = undefined;
		}

		// Passing date through Date applies Date.parse, if necessary
		date = date ? new Date(date) : new Date;
		if (isNaN(date)) throw SyntaxError("invalid date");

		mask = String(dF.masks[mask] || mask || dF.masks["default"]);

		// Allow setting the utc argument via the mask
		if (mask.slice(0, 4) == "UTC:") {
			mask = mask.slice(4);
			utc = true;
		}

		var	_ = utc ? "getUTC" : "get",
			d = date[_ + "Date"](),
			D = date[_ + "Day"](),
			m = date[_ + "Month"](),
			y = date[_ + "FullYear"](),
			H = date[_ + "Hours"](),
			M = date[_ + "Minutes"](),
			s = date[_ + "Seconds"](),
			L = date[_ + "Milliseconds"](),
			o = utc ? 0 : date.getTimezoneOffset(),
			flags = {
				d:    d,
				dd:   pad(d),
				ddd:  dF.i18n.dayNamesShort[D],
				dddd: dF.i18n.dayNames[D],
				m:    m + 1,
				mm:   pad(m + 1),
				mmm:  dF.i18n.monthNamesShort[m],
				mmmm: dF.i18n.monthNames[m],
				yy:   String(y).slice(2),
				yyyy: y,
				h:    H % 12 || 12,
				hh:   pad(H % 12 || 12),
				H:    H,
				HH:   pad(H),
				M:    M,
				MM:   pad(M),
				s:    s,
				ss:   pad(s),
				l:    pad(L, 3),
				L:    pad(L > 99 ? Math.round(L / 10) : L),
				t:    H < 12 ? "a"  : "p",
				tt:   H < 12 ? "am" : "pm",
				T:    H < 12 ? "A"  : "P",
				TT:   H < 12 ? "AM" : "PM",
				Z:    utc ? "UTC" : (String(date).match(timezone) || [""]).pop().replace(timezoneClip, ""),
				o:    (o > 0 ? "-" : "+") + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
				S:    ["th", "st", "nd", "rd"][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10]
			};

		return mask.replace(token, function ($0) {
			return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
		});
	};
}();

// Some common format strings
dateFormat.masks = {
	"default":      "ddd mmm dd yyyy HH:MM:ss",
	shortDate:      "m/d/yy",
	mediumDate:     "mmm d, yyyy",
	longDate:       "mmmm d, yyyy",
	fullDate:       "dddd, mmmm d, yyyy",
	shortTime:      "h:MM TT",
	mediumTime:     "h:MM:ss TT",
	longTime:       "h:MM:ss TT Z",
	isoDate:        "yyyy-mm-dd",
	isoTime:        "HH:MM:ss",
	isoDateTime:    "yyyy-mm-dd'T'HH:MM:ss",
	isoUtcDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"
};

// Internationalization strings
dateFormat.i18n = {
	dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
	dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
	monthNamesShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
	monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
};

dateFormat.i18nEnglish = dateFormat.i18n;  

// For convenience...
Date.prototype.format = function (mask, utc) {
	return dateFormat(this, mask, utc);
};

String.prototype.equalsIgnoreCase = function(str) {
	if (this && str) {
		return this.toLowerCase() == str.toLowerCase();
	}
}

function findTag(str, name) {
	if (str) {
		var index = str.indexOf("<" + name + " ");
		if (index == -1) {
			index = str.indexOf("<" + name + ">");
		}
		if (index == -1) {
			return null;
		}
		var closingTag = "</" + name + ">";
		var index2 = str.indexOf(closingTag);
		return str.substring(index, index2 + closingTag.length);
	}
}

function tweet(url, msg, via) {	
	var langParam = navigator.language.substring(0, 2);
	var popupUrl = "http://twitter.com/intent/tweet?url=" + encodeURIComponent(url) + "&lang=" + langParam;
	if (msg) {
		popupUrl += "&text=" + escape(msg);
	}	
	if (via) {
		popupUrl += "&via=" + via;
	}
	if (!globalThis.open(popupUrl, 'tweet', 'toolbar=0,status=0,resizable=1,width=626,height=256')) {
		chrome.tabs.create({url:popupUrl});
	}
}

function facebookShare(url, msg) {	
	var popupUrl = "http://www.facebook.com/sharer.php?u=" + encodeURIComponent(url);
	if (msg) {
		popupUrl += "&t=" + escape(msg);
	}	
	if (!globalThis.open(popupUrl, 'facebookShare', 'toolbar=0,status=0,resizable=1,width=626,height=356')) {
		chrome.tabs.create({url:popupUrl});
	}
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

function Controller() {
	
	// apps.jasonsavard.com server
	Controller.FULLPATH_TO_PAYMENT_FOLDERS = "https://apps.jasonsavard.com/";
	
	// jasonsavard.com server
	//Controller.FULLPATH_TO_PAYMENT_FOLDERS = "https://jasonsavard.com/apps.jasonsavard.com/";

	// internal only for now
	async function callAjaxController(params) {
        return fetchJSON(Controller.FULLPATH_TO_PAYMENT_FOLDERS + "controller.php", params.data, {
            method: params.method ? params.method : "GET",
            headers: {
                misc: location.href
            }
        });
	}

	Controller.verifyPayment = function(itemID, emails) {
		var data = {
            action: "verifyPayment",
            name: itemID,
            email: emails
        };
		return callAjaxController({data:data});
	}

	Controller.processFeatures = function() {
		storage.enable("donationClicked");
		storage.enable("removeHeaderFooter");
		
		// add to sync also
		if (chrome.storage.sync) {
			chrome.storage.sync.set({"donationClicked":true, "removeHeaderFooter": true}, function() {
				// nothing
			});
		}
		
		chrome.runtime.sendMessage({command: "featuresProcessed"}, function(response) {});
	}

}

function showLoading() {
	var $img = $("<img id='ajaxLoader' src='/images/ajax-loader-big.gif' style='position:fixed;display:none;top:272px;left:48%'/>");
	$("body").append($img);
	$img.fadeIn("slow");
}

function hideLoading() {
	$("#ajaxLoader").remove();
}

function initUndefinedObject(obj) {
    if (typeof obj == "undefined") {
        return {};
    } else {
        return obj;
    }
}

function initUndefinedCallback(callback) {
    if (callback) {
        return callback;
    } else {
        return function() {};
    }
}

function parseVersionString(str) {
    if (typeof(str) != 'string') { return false; }
    var x = str.split('.');
    // parse from string or default to 0 if can't parse
    var maj = parseInt(x[0]) || 0;
    var min = parseInt(x[1]) || 0;
    var pat = parseInt(x[2]) || 0;
    return {
        major: maj,
        minor: min,
        patch: pat
    }
}

function cloneCanvas(oldCanvas) {
    //create a new canvas
    const newCanvas = document.createElement('canvas');
    const context = newCanvas.getContext('2d');

    //set dimensions
    newCanvas.width = oldCanvas.width;
    newCanvas.height = oldCanvas.height;

    //apply the old canvas to the new one
    context.drawImage(oldCanvas, 0, 0);

    //return the new canvas
    return newCanvas;
}

function isCtrlPressed(e) {
	return e.ctrlKey || e.metaKey;
}

function insertScript(url) {
	var script = document.createElement('script');
	script.async = true;
	script.src = url;
	(document.getElementsByTagName('head')[0]||document.getElementsByTagName('body')[0]).appendChild(script);	
}

function insertImport(url, id) {
	var link = document.createElement('link');
	if (id) {
		link.id = id;
	}
	link.rel = 'import';
	link.href = url;
	//link.onload = function(e) {...};
	//link.onerror = function(e) {...};
	document.head.appendChild(link);
}

//for 2nd parmeter of JSON.parse(... , dateReviver);
function dateReviver(key, value) {
    if (isStringDate(value)) {
        return new Date(value);
    } else {
    	return value;
    }
}

function dateReplacer(key, value) {
    if (value instanceof Date) {
        return value.toJSON();
    } else {
    	return value;
    }
}

function isStringDate(str) {
	return typeof str == "string" && str.length == 24 && /\d{4}-\d{2}-\d{2}T\d{2}\:\d{2}\:\d{2}\.\d{3}Z/.test(str);
}

async function sleep(delay) {
    return new Promise(resolve => setTimeout(resolve, delay));
}

function isDomainEmail(email) {
	if (email) {
		email = email.toLowerCase();
		var POPULAR_DOMAINS = ["zoho", "aim", "videotron", "icould", "inbox", "yandex", "rambler", "ya", "sbcglobal", "msn", "me", "facebook", "twitter", "linkedin", "email", "comcast", "gmx", "aol", "live", "google", "outlook", "yahoo", "gmail", "mail", "comcast", "googlemail", "hotmail"];
		
		var foundPopularDomainFlag = POPULAR_DOMAINS.some(function(popularDomain) {
			if (email.includes("@" + popularDomain + ".")) {
				return true;
			}
		});
		
		return !foundPopularDomainFlag;
	}
}

function blobToBase64(blob) {
	return new Promise((resolve, reject) => {
		var fileReader = new FileReader();
		fileReader.onload = function () {
			resolve(this.result);
		};
		fileReader.onabort = fileReader.onerror = function (e) {
			reject(e);
		};
		fileReader.readAsDataURL(blob);
	});
}

function showMessageNotification(title, message, error, extensionConflict) {
	var options = {
		type: "basic",
		title: title,
		message: message,
		iconUrl: NOTIFICATION_ICON_URL,
		priority: 1
	}

	var notificationId;
	if (error) {
		var buttonTitle;

		if (extensionConflict) {
			notificationId = "extensionConflict";
			buttonTitle = "Click here to resolve issue";
		} else {
			notificationId = "error";
			buttonTitle = "If this is frequent then click here to report it";
		}

		if (DetectClient.isChrome()) {
			options.contextMessage = "Error: " + error;
			options.buttons = [{ title: buttonTitle }];
		} else {
			options.message += " Error: " + error;
		}
	} else {
		notificationId = "message";
	}

	chrome.notifications.create(notificationId, options, function (notificationId) {
		if (chrome.runtime.lastError) {
			console.error(chrome.runtime.lastError.message);
		} else {
			setTimeout(function () {
				chrome.notifications.clear(notificationId);
			}, error ? seconds(15) : seconds(5));
		}
	});
}

function showCouldNotCompleteActionNotification(error, extensionConflict) {
	if (extensionConflict) {
		showMessageNotification("Error with last action.", "Try again.", error, extensionConflict);
	} else {
		showMessageNotification("Error with last action.", "Try again or sign out and in.", error);
	}
}

function chooseDesktopMedia(params) {
	return new Promise((resolve, reject) => {
		chrome.desktopCapture.chooseDesktopMedia(params, (streamId, options) => {
			if (streamId) {
				// todo add options to resolve but resolve only accepts 1 param
				resolve(streamId);
			} else {
				let error = new Error("Cancelled desktop capture");
				error.name = "cancelledDesktopCapture";
				reject(error);
			}
		});
	});
}

function getChromeWindows() {
	return new Promise((resolve, reject) => {
		chrome.windows.getAll(windows => {
			// keep only normal windows and not app windows like debugger etc.
			var normalWindows = windows.filter(thisWindow => {
				return thisWindow.type == "normal";
			});
			resolve(normalWindows);
		});
	});
}

function findTab(url) {
	return new Promise((resolve, reject) => {
		chrome.tabs.query({ url: url + "*" }, tabs => {
			if (chrome.runtime.lastError) {
				console.error(chrome.runtime.lastError.message);
				resolve();
			} else {
				if (tabs.length) {
					var tab = tabs.last();
					bg.console.log("force window found")
					chrome.tabs.update(tab.id, { active: true }, () => {
						if (chrome.runtime.lastError) {
							resolve();
						} else {
							// must do this LAST when called from the popup window because if set focus to a window the popup loses focus and disappears and code execution stops
							chrome.windows.update(tab.windowId, { focused: true }, () => {
								resolve({ found: true, tab: tab });
							});
						}
					});
				} else {
					resolve();
				}
			}
		});
	});
}

//usage: openUrl(url, {urlToFind:""})
function openUrl(url, params = {}) {
	return new Promise((resolve, reject) => {
		if (!globalThis.inWidget && chrome.tabs) {
			getChromeWindows().then(normalWindows => {
				if (normalWindows.length == 0) { // Chrome running in background
					var createWindowParams = { url: url };
					if (DetectClient.isChrome()) {
						createWindowParams.focused = true;
					}
					chrome.windows.create(createWindowParams, createdWindow => {
						findTab(url).then(response => {
							resolve(response);
						});
					});
				} else {
					new Promise((resolve, reject) => {
						if (params.urlToFind) {
							findTab(params.urlToFind).then(response => {
								resolve(response);
							});
						} else {
							resolve();
						}
					}).then(response => {
						if (response && response.found) {
							//chrome.tabs.update(response.tab.id, {url:url});
							return Promise.resolve(response);
						} else {
							return createTabAndFocusWindow(url);
						}
					}).then(response => {
						if (location.href.includes("source=toolbar") && DetectClient.isFirefox() && params.autoClose !== false) {
							globalThis.close();
						}
						resolve();
					});
				}
			});
		} else {
			top.location.href = url;
		}
	});
}

function createTabAndFocusWindow(url) {
	return new Promise((resolve, reject) => {
		new Promise((resolve, reject) => {
			if (DetectClient.isFirefox()) { // required for Firefox because when inside a popup the tabs.create would open a tab/url inside the popup but we want it to open inside main browser window 
				chrome.windows.getCurrent(thisWindow => {
					if (thisWindow && thisWindow.type == "popup") {
						chrome.windows.getAll({ windowTypes: ["normal"] }, windows => {
							if (windows.length) {
								resolve(windows[0].id)
							} else {
								resolve();
							}
						});
					} else {
						resolve();
					}
				});
			} else {
				resolve();
			}
		}).then(windowId => {
			var createParams = { url: url };
			if (windowId != undefined) {
				createParams.windowId = windowId;
			}
			chrome.tabs.create(createParams, tab => {
				chrome.windows.update(tab.windowId, { focused: true }, () => {
					resolve(tab);
				});
			});
		});
	});
}

function hexToRgb(hex) {
	var c;
	if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
		c = hex.substring(1).split('');
		if (c.length == 3) {
			c = [c[0], c[0], c[1], c[1], c[2], c[2]];
		}
		c = '0x' + c.join('');
		return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
	}
	//throw new Error('Bad Hex: ' + hex);
}

function rgbToHsv(r, g, b) {
	r /= 255, g /= 255, b /= 255;

	var max = Math.max(r, g, b), min = Math.min(r, g, b);
	var h, s, v = max;

	var d = max - min;
	s = max == 0 ? 0 : d / max;

	if (max == min) {
		h = 0; // achromatic
	} else {
		switch (max) {
			case r: h = (g - b) / d + (g < b ? 6 : 0); break;
			case g: h = (b - r) / d + 2; break;
			case b: h = (r - g) / d + 4; break;
		}

		h /= 6;
	}

	return [h, s, v];
}

function rgbToHsl(r, g, b) {
	r /= 255, g /= 255, b /= 255;
	var max = Math.max(r, g, b), min = Math.min(r, g, b);
	var h, s, l = (max + min) / 2;

	if (max == min) {
		h = s = 0; // achromatic
	} else {
		var d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r: h = (g - b) / d + (g < b ? 6 : 0); break;
			case g: h = (b - r) / d + 2; break;
			case b: h = (r - g) / d + 4; break;
		}
		h /= 6;
	}

	return [h, s, l];
}

function isColorTooLight(color) {
	let rgb = hexToRgb(color);
	if (rgb) {
		let l = rgbToHsl(rgb[0], rgb[1], rgb[2])[2];
		//let isYellow = rgb[0] == 255 && rgb[1] == 253 && rgb[2] == 33; // refer to https://jasonsavard.com/forum/discussion/comment/19187#Comment_19187
		if (l >= 0.85) {
			return true;
		}
	}
}

function getDataUrl(canvas) {
	return new Promise(async (resolve, reject) => {
		if ('toDataURL' in canvas) { // regular canvas element
			resolve(canvas.toDataURL());
        } else { // OffscreenCanvas
			const blob = await canvas.convertToBlob();
			const reader = new FileReader();
			reader.addEventListener('load', () => {
				resolve(reader.result);
			});
			reader.addEventListener('error', error => {
				reject(error);
			});
			reader.readAsDataURL(blob);
		}
	});
}

function ellipsis(str, cutoffLength) {	
	if (str && str.length > cutoffLength) {
		str = str.substring(0, cutoffLength) + " ...";
	}
	return str;
}

async function fetchWrapper(url, options) {
    try {
        return await fetch(url, options);
    } catch (error) {
        console.error("fetch error: " + error);
        if (navigator.onLine) {
            throw "Network problem";
        } else {
            throw "You're offline";
        }
    }
}

async function fetchText(url) {
    const response = await fetchWrapper(url);
    if (response.ok) {
        return response.text();
    } else {
        const error = Error(response.statusText);
        error.status = reponse.status;
        throw error;
    }
}

async function fetchJSON(url, data, options = {}) {
    if (options.method) {
        options.method = options.method.toUpperCase();
    }

    if (data) {
        // default is get
        if (!options.method || /GET/i.test(options.method)) {
            if (!url.searchParams) {
                url = new URL(url);
            }
            Object.keys(data).forEach(key => {
                if (Array.isArray(data[key])) {
                    data[key].forEach(value => {
                        url.searchParams.append(key + "[]", value);
                    });
                } else {
                    url.searchParams.append(key, data[key]);
                }
            });
        } else { // must be post, patch, delete etc..
            if (!options.headers) {
                options.headers = {};
            }

            const contentType = options.headers["content-type"] || options.headers["Content-Type"];
            if (contentType && contentType.includes("application/json")) {
                options.body = JSON.stringify(data);
            } else if (contentType && contentType.includes("multipart/mixed")) {
                options.body = data;
            } else {
                var formData = new FormData();
                Object.keys(data).forEach(key => formData.append(key, data[key]));
                options.body = formData;
            }
        }
    }
    
    console.log("fetchJSON", url, options);
    const response = await fetchWrapper(url, options);
    console.log("response", response);

    let responseData = await response.text();
    if (responseData) {
        try {
            responseData = JSON.parse(responseData);
        } catch (error) {
            console.warn("Response probaby text only: " + error);
        }
    }
    if (response.ok) {
        return responseData;
    } else {
        if (responseData) {
            if (typeof responseData.code === "undefined") { // code property alread exists so let's use fetchReturnCode
                responseData.code = response.status;
            } else {
                responseData.fetchReturnCode = response.status;
            }
            throw responseData;
        } else {
            throw response.statusText;
        }
    }
}