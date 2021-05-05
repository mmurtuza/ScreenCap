document.getElementById("capElement").addEventListener("click", captureElement);

// var imgUrl;
var ScreenS = {
    imgUrl: [],

    shared: {
        imageDirtyCutAt: 0,
        imageDataURL: 0,

        originalScrollTop: 0,

        tab: {
            id: 0,
            url: "",
            title: "",
            hasVscrollbar: false
        }
    },
}

function captureElement() {

    var capturing = chrome.tabs.captureVisibleTab(null, null, (imageUri) => {
        console.log('hi');
        // console.log(imageUri);

        ScreenS.shared.imageDataURL = imageUri;
        ScreenS.imgUrl = dataToBlobURL(imageUri);

    });
    // capturing.then(onCaptured, onError);

    screenshotReturn(ScreenS.shared);

    function onCaptured(imageUri) {
        console.log(imageUri);
    }

    function onError(error) {
        console.log(`Error: ${error}`);
    }

    function dataToBlobURL(dataURL) {
        /****************************************************************************************************
         * Converts a data:// URL (i.e. `canvas.toDataURL("image/png")`) to a blob:// URL.
         * This allows a shorter URL and a simple management of big data objects.
         *
         * Contributor: Ben Ellis <https://github.com/ble>
         */
        var parts = dataURL.match(/data:([^;]*)(;base64)?,([0-9A-Za-z+/]+)/);

        if (parts && parts.length >= 3) {
            // Assume base64 encoding
            var binStr = atob(parts[3]);

            // Convert to binary in ArrayBuffer
            var buf = new ArrayBuffer(binStr.length);
            var view = new Uint8Array(buf);
            for (var i = 0; i < view.length; i++)
                view[i] = binStr.charCodeAt(i);

            // Create blob with mime type, create URL for it
            var blob = new Blob([view], { 'type': parts[1] });
            var objectURL = window.URL.createObjectURL(blob);

            // console.log(objectURL);

            return objectURL;
        } else {
            return null;
        }
    }


    function screenshotReturn(shared) {
        function pad2(str) { if ((str + "").length == 1) return "0" + str; return "" + str; }

        var d = new Date();
        var timestamp = '' + d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + '-' + pad2(d.getHours()) + '' + pad2(d.getMinutes()) + '\'' + pad2(d.getSeconds()) + '';
        var filename = "pageshot of '" + normalizeFileName(shared.tab.title) + "' @ " + timestamp;
        // var blobURL = dataToBlobURL(shared.imageDataURL);
        var blobURL = ScreenS.imgUrl;

        if (blobURL) {
            // ****** Add DOM Elements to Page
            renderTemplate("overlay", {
                blobURL: blobURL,
                filename: filename,
                pageHeight: window.document.body.scrollHeight,
            }, function (div) {
                // ****** Add Event Listeners
                function actionRemoveDiv() {
                    // Closes the extension overlays.
                    if (div) div.parentElement.removeChild(div);

                    // Cleanup
                    window.URL.revokeObjectURL(blobURL);
                }
                function actionDragFile(e) {
                    if (window.location.protocol === "https:") {
                        // we can't set the name, fall back to the ugly name
                    } else {
                        // Set a nice name
                        e.dataTransfer.setData("DownloadURL", "image/png:" + filename + ".png:" + blobURL);
                        //e.dataTransfer.setData("DownloadURL", "text/plain:feh.txt:data:feadhsahdsha");
                    }
                }
                window.document.getElementById('chrome-extension__blipshot-dim').addEventListener("click", actionRemoveDiv);
                window.document.getElementById('chrome-extension__blipshot-img').addEventListener("dragstart", actionDragFile);
            });
        } else {
            // ****** No content! Maybe page too long?
            alert("\n\n\nI'm sorry.\n\nThere was some trouble in generating the screenshot.\n\nIt might be due to Chrome canvas size limitations.\nTry on a shorter page?\n\n\n");
        }

    }

    function normalizeFileName(string) {
        out = string;
        //out = out.replace(/"/, '\''); // To avoid collision with DOM attribute
        //out = out.replace(/\/\?<>\\:\*\|/, '-'); // Windows safe
        out = out.replace(/[^a-zA-Z0-9_\-+,;'!?$£@&%()\[\]=]/g, " ").replace(/ +/g, " "); // Hard replace
        return out;
    }

    function renderTemplate(name, data, callback) {
        /****************************************************************************************************
         * Loads the template and rendes it on the DOM.
         */
        var name = name || "template";

        if (!templates[name]) {
            // Load, cache and use
            var xhr = new XMLHttpRequest();
            xhr.addEventListener("load", function () {
                templates[name] = this.responseText;
                appendTemplate(templates[name], data, callback);
            });
            xhr.open("GET", chrome.runtime.getURL("resources/" + name + ".html"));
            xhr.send();
        } else {
            // Use cached
            appendTemplate(templates[name], data, callback);
        }
    }

    // chrome.tabs.captureVisibleTab(null, null, function (data) {
    //     chrome.tabs.query(
    //         { active: true, lastFocusedWindow: true },
    //         function (tabs) {
    //             if (tabs) {
    //                 tabs[0];
    //             }
    //         }
    //     );
    // });
}




