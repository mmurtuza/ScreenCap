var ITEM_ID = "screenshots";
var canvas;
var context;
var cy = 0;
var SCROLLBAR_WIDTH = 22;
var STICKY_HEADER_PADDING = 200;

var TEST_REDUCED_DONATION = false;

// patch for laptop devicePixelRatio 1.5 issue with firefox
if (DetectClient.isFirefox()) {
    devicePixelRatio = 1;
}

var JError = {};
JError.DID_NOT_CONTRIBUTE = "DID_NOT_CONTRIBUTE";
JError.NETWORK_ERROR = "NETWORK_ERROR";

var ExtensionId = {};
if (DetectClient.isFirefox()) {
    ExtensionId.Drive = "checkerplusforgoogledrive@jasonsavard.com";
} else if (DetectClient.isEdge()) {
	ExtensionId.LocalDrive = "chlojnjhoanbiippnehobiclefodbdic";
	ExtensionId.Drive = "ndcbbjeihlogjndoheabejedggehfbei";
	ExtensionId.LocalScreenshot = "ajdcpfdbildfaahcgabgjhojmbalcnff";
} else {
	ExtensionId.LocalDrive = "chlojnjhoanbiippnehobiclefodbdic";
	ExtensionId.Drive = "pppfmbnpgflleackdcojndfgpiboghga";
	ExtensionId.LocalScreenshot = "ajdcpfdbildfaahcgabgjhojmbalcnff";
}

var Urls = {};
Urls.NotificationError = "https://jasonsavard.com/forum/categories/explain-and-send-screenshots?ref=errorNotification";

var NOTIFICATION_ICON_URL = "images/icons/default128.png";

const Alarms = {
    UPDATE_UNINSTALL_URL: "UPDATE_UNINSTALL_URL"
}

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

const DEFAULT_SETTINGS_ALLOWED_OFF = [];

async function getAudioMedia() {
    const audioInputDeviceId = await storage.get("audioInput");

    let constraints;
    if (audioInputDeviceId == "default") {
        constraints = {
            audio: true
        }
    } else {
        constraints = {
            audio: {
                deviceId: {
                    ideal: audioInputDeviceId
                }
            }
        }
    }

    return navigator.mediaDevices.getUserMedia(constraints);
}

function getScreenMedia(streamId) {
	return navigator.mediaDevices.getUserMedia({
		/*
		width: { max: 1920 },
		height: { max: 1080 },
		frameRate: { max: 10 },
		deviceId: { exact: [sourceId] },
		mediaStreamSource: { exact: ['desktop'] }
		*/
		audio: false,
		video: {
			mandatory: {
				chromeMediaSource: "desktop",
				chromeMediaSourceId: streamId,
				maxWidth: 2560,
				maxHeight: 1440
				//width: { min: 1024, ideal: 1280, max: 1920 },
				//height: { min: 776, ideal: 720, max: 1080 }
			}
		}
	});
}

function captureRecursively(params = {}, callback) {
	console.log("captrecur")
	captureToCanvas(params, function() {
		console.log("sendnext")
		globalThis.setTimeout(function() {
			chrome.tabs.sendMessage(params.tab.id, {msg:"scroll_next", stickyHeaderPadding:STICKY_HEADER_PADDING}, function(response) {
				if (response.msg == "scroll_next_done") {
					console.log("sendnextdone")
					if (response.canScrollAgain) {
						params.stickyHeaderPadding = STICKY_HEADER_PADDING;
					} else {
						params.stickyHeaderPadding = 0;
					}
					captureRecursively(params, callback);
				} else {
					console.log("finish")
					callback();
				}
			});
		}, 150);
	});
}

async function captureToCanvas(params, callback) {
	chrome.tabs.captureVisibleTab(null, {format:getCaptureVisibleTabFormat(await storage.get("imageFormat"))}, function(data) {
		console.log("capture");
		var image = new Image();
		image.onload = function() {
			var height = (cy+image.height > canvas.height) ? canvas.height-cy : image.height;
			if (height > 0) {
				var sx = 0;
				var sy = image.height - height;
				if (params.stickyHeaderPadding) {
					sy += params.stickyHeaderPadding * params.zoomFactor;
				}
				//sy *= params.zoomFactor;
				
				var sWidth = image.width-SCROLLBAR_WIDTH;
				//sWidth *= params.zoomFactor;
				
				var sHeight = height;
				if (params.stickyHeaderPadding) {
					sHeight -= params.stickyHeaderPadding;
				}
				//sHeight *= params.zoomFactor;
				var width = canvas.width-SCROLLBAR_WIDTH;
				if (params.stickyHeaderPadding) {
					height -= params.stickyHeaderPadding;
				}
				//width *= params.zoomFactor;
				//height *= params.zoomFactor;
				
				//context.drawImage(image, sx, sy, sWidth * devicePixelRatio, sHeight * devicePixelRatio, 0, cy, width, height);
				context.drawImage(image, sx, sy, sWidth, sHeight, 0, cy, width, height);
			}
			
			if (cy+image.height < canvas.height) {
				cy += image.height;// / params.zoomFactor;
				if (params.stickyHeaderPadding) {
					cy -= params.stickyHeaderPadding * params.zoomFactor;
				}
			}
			
			callback();
		};
		image.src = data;
	});
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

function possibleDelay(params = {}) {
    let delay;
    console.log("possibledelay", params);
	// chrome-extension pages will probably give an error later, so skip timer this time
	if (!params.grabTab && params.currentWindow && params.currentWindow.url && params.currentWindow.url.includes("chrome-extension://")) {
        delay = null;
	} else {
        delay = params.delay;
    }

    console.log("delay", delay);

	return new Promise((resolve, reject) => {
		if (delay) {
			let intervalTimer;
			let TIMER_NOTIFICATION_ID = "timer";
			if (chrome.notifications.update) {
				let options = {
					title: (delay / ONE_SECOND).toString(),
					message: "",
					type: "progress",
					iconUrl: NOTIFICATION_ICON_URL,
					progress: 100
				};
				chrome.notifications.create(TIMER_NOTIFICATION_ID, options, notificationId => {
					if (chrome.runtime.lastError) {
						console.error(chrome.runtime.lastError.message);
					} else {
						let secondCount = delay / ONE_SECOND;
						intervalTimer = setInterval(() => {
							secondCount--;
							let progress = Math.round(secondCount / (delay / ONE_SECOND) * 100);
							if (progress > 0) {
								options.title = (secondCount).toString();
                                options.progress = progress;

                                // notification.update would freze on 2nd update, so clearing and createing in step instead
                                //chrome.notifications.update(TIMER_NOTIFICATION_ID, options);
                                chrome.notifications.clear(TIMER_NOTIFICATION_ID, () => {
                                    chrome.notifications.create(TIMER_NOTIFICATION_ID, options);
                                });
							}
						}, ONE_SECOND);
					}
				});
			}
			setTimeout(() => {
                clearInterval(intervalTimer);
                console.log("clear notif")
				chrome.notifications.clear(TIMER_NOTIFICATION_ID);
				resolve();
			}, delay);
		} else {
			resolve();
		}
	});
}

async function grabSelectedArea(params = {}) {
    console.log("grabSelectedArea", params);
	await possibleDelay(params);
    await setGrabMethod("selectedArea");
    params.urlToGoAfter = "snapshot.html";
    return captureVisibleTab(params);
}

function selectElement(params) {
    return new Promise((resolve, reject) => {
        return possibleDelay(params).then(() => {
            getActiveTab(tab => {
                chrome.tabs.executeScript(tab.id, {file: "js/contentScriptSelectElement.js"}, function() {
                    if (chrome.runtime.lastError) {
                        console.error("error", chrome.runtime.lastError.message);
                        reject(chrome.runtime.lastError.message);
                    } else {
                        resolve();
                    }
                });
            });
        });
    });
}

async function grabVisiblePart(params = {}) {
	await possibleDelay(params);
    await setGrabMethod("visibleArea");
    params.urlToGoAfter = "editor.html";
    return captureVisibleTab(params);
}

function grabTab(params = {}) {
	params.grabTab = true;
	return grabScreen(params);
}

async function grabScreen(params = {}) {
	let chooseDesktopMediaParams;
	if (params.grabTab) {
        await setGrabMethod("tab");
		chooseDesktopMediaParams = ["tab"];
	} else {
        await setGrabMethod("screen");
		chooseDesktopMediaParams = ["screen", "window"];
    }
    
	return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            command: "closePopupWindow"
        });
		chooseDesktopMedia(chooseDesktopMediaParams).then(streamId => {
			return possibleDelay(params).then(() => {
				return getScreenMedia(streamId).then(stream => {
					let canPlayDetected;
					var video = document.createElement('video');
					video.addEventListener('loadeddata', function () {
						console.log("loadeddata")
					});
					video.addEventListener('playing', function () {
						console.log("playing")
					});
					video.addEventListener('error', function () {
						console.log("error", arguments)
					});
					video.addEventListener('abort', function () {
						console.log("abort", arguments);
					});
					video.addEventListener('canplay', function () {
						console.log("can play");
						if (!canPlayDetected) {
							canPlayDetected = true;
							video.play();

							canvas = document.createElement('canvas');
							context = canvas.getContext('2d');

							canvas.width = video.videoWidth;
							canvas.height = video.videoHeight;

							context.drawImage(video, 0, 0, canvas.width, canvas.height);
							video.pause();
							video.src = '';
							stream.getTracks()[0].stop();
							video.remove();
                            canvas.remove();

                            screenShotTab = null;
                            screenShotData = canvas.toDataURL();
                            chrome.tabs.create({ url: params.urlToGoAfter ?? "editor.html" });
						}
					}, false);
					video.srcObject = stream;
					console.log("video", video);
				})
			})
		}).catch(error => {
			reject(error);
		});
	});
}

async function maybeStartAudioRecorder(params = {}) { // popupwindow, enableMic
    if (params.enableMic || await storage.get("alwaysRecordAudio")) {
        // need to use popupwindow or else the user would not get prompted to accept/deny when called from background
        return getAudioMedia();
    }
}

function startVideoRecorder(videoStream, audioStream) {
	console.log("videostream", videoStream);
	return new Promise((resolve, reject) => {
		chrome.runtime.getBackgroundPage(bg => {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message);
                throw chrome.runtime.lastError.message;
            } else {
                var video = document.createElement('video');
                document.body.appendChild(video);
    
                var blob;
                var chunks = [];
                var options = { mimeType: VIDEO_CONTENT_TYPE }
    
                if (audioStream) {
                    videoStream.addTrack(audioStream.getAudioTracks()[0]);
                }
    
                // somebody clicked on "Stop sharing"
                videoStream.getVideoTracks()[0].onended = function () {
                    if (bg.mediaRecorder.state != "inactive") {
                        bg.mediaRecorder.stop();
                    }
                };
    
                video.srcObject = videoStream;
                video.muted = true;
                // using autoplay instead of .play because in Brave getting user gesture error
                video.autoplay = true;
    
                bg.mediaRecorder = new MediaRecorder(videoStream, options);
                bg.mediaRecorder.start();
                bg.mediaRecorder.onstart = function (e) {
                    chrome.browserAction.setPopup({ popup: "" });
                    bg.recordingScreen = true;
                }
                bg.mediaRecorder.ondataavailable = function (e) {
                    chunks.push(e.data);
                }
                bg.mediaRecorder.onwarning = function (e) {
                    console.warn('mediarecord wraning: ' + e);
                };
                bg.mediaRecorder.onerror = function (e) {
                    console.error('mediarecord error: ' + e);
                    bg.recordingScreen = false;
                    throw e;
                };
                bg.mediaRecorder.onstop = function (e) {
                    console.log("onstop");
                    bg.recordingScreen = false;
                    initPopup();
    
                    videoStream.getTracks()[0].stop();
    
                    blob = new Blob(chunks, { 'type': VIDEO_CONTENT_TYPE });
                    video.src = URL.createObjectURL(blob);
                    video.controls = true;
    
                    bg.screenShotTab = null;
                    bg.screenShotData = video.src;
                    bg.videoBlob = blob;
                    chrome.tabs.create({ url: "editor.html" });
                    resolve();
                }
            }
		});
	});
}

async function recordScreen(params = {}) {
    await setGrabMethod("recordScreen");

    let audioStream;
    try {
        // patch: could not get both video and audio when using screencapture "chromeMediaSource" so we first the audio then the video and merge then with .addTrack below
        audioStream = await maybeStartAudioRecorder(params);
    } catch (error) {
        console.error("error", error);
        // v2 was getting this new error "Failed due to shutdown" so decided to uncomment them all
        // v1 permission not granted to audio AND could not be prompted to either (probably inside popup window)
        //if (error.name == "MediaDeviceFailedDueToShutdown" || error.name == "PermissionDeniedError" || error.name == "PermissionDismissedError") {
            chrome.tabs.create({ url: 'promptForMic.html?error=' + error.name });
        //}
        throw error;
    }

    try {
        chrome.runtime.sendMessage({
            command: "closePopupWindow"
        });
        const streamId = await chooseDesktopMedia(["screen", "window", "tab"]);
        chrome.runtime.getBackgroundPage(bg => {
            bg.stayAlive();
        });
        const videoStream = await getScreenMedia(streamId);
        await startVideoRecorder(videoStream, audioStream);
    } catch (error) {
        console.error(error);
        if (audioStream) {
            audioStream.getTracks()[0].stop();
        }
        let errorMsg;
        if (error.message) {
            errorMsg = error.message;
        } else {
            errorMsg = error;
        }
        if (error.name != "cancelledDesktopCapture") {
            showCouldNotCompleteActionNotification(errorMsg);
        }
        throw error;
    } finally {
        chrome.runtime.getBackgroundPage(bg => {
            bg.cancelStayAlive();
        });
    }
}

async function grabEntirePage() {
    await setGrabMethod("entirePage");

	return new Promise((resolve, reject) => {
		getActiveTab(tab => {
			var sendMessageResponded = false;
			
			chrome.tabs.executeScript(tab.id, {file:"js/contentScript.js"}, function() {
	
				if (chrome.runtime.lastError) {
					console.error("error", chrome.runtime.lastError.message);
					reject(chrome.runtime.lastError.message);
				} else {
					
					chrome.tabs.getZoom(function(zoomFactor) {
						chrome.tabs.sendMessage(tab.id, {msg:"scroll_init"}, function(response) {
							sendMessageResponded = true;

							if (typeof OffscreenCanvas != "undefined") {
								canvas = new OffscreenCanvas(response.width * devicePixelRatio, response.height * devicePixelRatio);
							} else if (typeof document != "undefined") {
								canvas = document.createElement("canvas");
								canvas.width = response.width * devicePixelRatio;
								canvas.height = response.height * devicePixelRatio;
							}

							context = canvas.getContext("2d");
							cy = 0;
			
							captureRecursively({tab:tab, zoomFactor:zoomFactor, scrollInitResponse:response}, async () => {
                                screenShotTab = tab,
                                screenShotData = await getDataUrl(canvas),
                                chrome.tabs.create({url: "editor.html"});
                                resolve();
							});
		
						});
					});
				}
				
			});
	
			setTimeout(function() {
				if (!sendMessageResponded) {
					reject("no sendMessageResponded");
				}
			}, 500);
	
		});
	});
}

async function openEditor(dataUrl, sameWindow) {
    await sendMessageToBG("setScreenshotVars", {
        screenShotData: dataUrl
    });
    if (sameWindow) {
        location.href = "editor.html";
    } else {
        chrome.tabs.create({url: "editor.html"});
    }
}

async function openFromClipboard(params = {}) {
    if (params.crop) {
        await setGrabMethod("openFromClipboardAndCrop");
    } else {
        await setGrabMethod("openFromClipboard");
    }

	return new Promise((resolve, reject) => {
		let permissions = {permissions: ["clipboardRead"]};
		chrome.permissions.contains(permissions, result => {
			new Promise((resolve, reject) => {
				if (result) {
					resolve();
				} else {
					chrome.permissions.request(permissions, granted => {
						if (chrome.runtime.lastError) {
							reject(chrome.runtime.lastError.message);
						} else {
							if (granted) {
								resolve();
							} else {
								// do nothing
								reject({permissionNotGranted:true});
							}
						}
					});
				}
			}).then(async () => {
                document.execCommand("paste");
                await sendMessageToBG("setVar", {
                    name: "screenShotTab",
                    value: null
                });
                resolve();
			}).catch(error => {
				reject(error);
			})
		});
	});
}

async function initPopup() {
	console.log("initPopup");
	if (await storage.get("presetButtonAction") == "popupWindow") {
		console.log("popup");
		chrome.browserAction.setPopup({popup:"popup.html"});
	} else {
		chrome.browserAction.setPopup({popup:""});
	}
}

async function setButtonIcon() {
    const buttonIcon = await storage.get("buttonIcon");
	chrome.browserAction.setIcon({ path: {
			"19": `images/icons/${buttonIcon}19.png`,
			"38": `images/icons/${buttonIcon}38.png`
		}
	});
}

async function initContextMenu() {
	chrome.contextMenus.removeAll();
	
	var contexts = ["browser_action"];
	if (!storage.get("removeMenuItems")) {
		contexts.push("page");
	}

    chrome.contextMenus.create({id: "grabSelectedArea", title: getMessage("selectArea"), contexts: contexts});
    chrome.contextMenus.create({id: "selectElement", title: getMessage("selectElement"), contexts: contexts});
	chrome.contextMenus.create({id: "grabVisiblePart", title: getMessage("grabVisiblePart"), contexts: contexts});
	chrome.contextMenus.create({id: "grabEntirePage", title: getMessage("grabEntirePage"), contexts: contexts});
	if (DetectClient.isChrome()) {
		chrome.contextMenus.create({ id: "grabEntireScreen", title: getMessage("grabEntireScreen"), contexts: contexts });
		chrome.contextMenus.create({ id: "recordScreen", title: getMessage("recordScreen"), contexts: contexts });
	}
}

async function daysElapsedSinceFirstInstalled() {
	if (TEST_REDUCED_DONATION) {
		return true;
	}
	
	return Math.abs(Math.round(new Date(await storage.get("installDate")).diffInDays()));
}

async function isEligibleForReducedDonation() {
	if (TEST_REDUCED_DONATION) {
		return true;
	}
	
	return (await daysElapsedSinceFirstInstalled() >= (14) && !await storage.get("donationClicked"));
}

function getImageFormatExtension(imageFormat) {
	var extension;
	if (imageFormat == "image/jpeg") {
		extension = ".jpg";
	} else {
		extension = ".png";
	}
	return extension;
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

function showMessageNotification(title, message, error) {
   var options = {
        type: "basic",
        title: title,
        message: message,
        iconUrl: NOTIFICATION_ICON_URL,
        priority: 1
   }
   
   var notificationId;
   if (error) {
	   notificationId = "error";
	   options.contextMessage = "Error: " + error;
	   if (DetectClient.isChrome()) {
		   options.buttons = [{title:"If this is frequent then click here to report it", iconUrl:"images/open.svg"}];
	   }
   } else {
	   notificationId = "message";
   }
   
   chrome.notifications.create(notificationId, options, function(notificationId) {
	   if (chrome.runtime.lastError) {
		   console.error(chrome.runtime.lastError.message);
	   } else {
		   setTimeout(function () {
			   chrome.notifications.clear(notificationId);
		   }, error ? seconds(15) : seconds(5));
	   }
   });
}

async function copyToClipboard() {
    // clipboard.write returned Sanitize error when using image/jpeg so forcing to png
    const blob = await canvasToBlob(canvas, "image/png");
    /* From file...
    const imgURL = '/images/jason.png';
    const data = await fetch(imgURL);
    const blob = await data.blob();
    */

    await navigator.clipboard.write([
        new ClipboardItem({
            [blob.type]: blob
        })
    ]);
}

function RGBToHex(r,g,b) {
    return RGBAToHexA(r,g,b);
}

function RGBAToHexA(r,g,b,a = "") {
    r = r.toString(16);
    g = g.toString(16);
    b = b.toString(16);
    if (a != "") {
        a = Math.round(a * 255).toString(16);
    }
  
    if (r.length == 1)
      r = "0" + r;
    if (g.length == 1)
      g = "0" + g;
    if (b.length == 1)
      b = "0" + b;
    if (a == 1)
      a = "0" + a;
  
    return "#" + r + g + b + a;
}

function openChangelog(ref) {
    const url = new URL("https://jasonsavard.com/wiki/Explain_and_Send_Screenshots_changelog");
    url.searchParams.set("cUrl", chrome.runtime.getURL("contribute.html"));
    if (ref) {
        url.searchParams.set("ref", ref);
    }
    openUrl(url.href);
}

async function getGrabMethod() {
    return storage.get("grabMethod");
}

async function setGrabMethod(methodName) {
    return storage.set("grabMethod", methodName);
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