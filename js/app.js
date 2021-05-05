document.getElementById("capElement").addEventListener("click", captureElement);

function captureElement() {


    // capturing.then(onCaptured, onError);

    // creating.then(onCreated, onError);
    // msg;
    // sleep(60000);
    var capturing = chrome.tabs.captureVisibleTab(null, null, (imageUri) => {
        console.log('hi');
        console.log(imageUri);
        i = imageUri;


        // creating.then(onCreated, onError);
    });




    function onCaptured(imageUri) {
        console.log(imageUri);
    }


    var creating = chrome.tabs.create({
        url: "snapshot.html",

    }).postMessage("Murtuza");


    function onCreated(tab) {
        console.log(`Created new tab: ${tab.id}`)
    }

    function onError(error) {
        console.log(`Error: ${error}`);
    }

}

window.addEventListener("message", (event) => {
    // Do we trust the sender of this message?  (might be
    // different from what we originally opened, for example).
    if (event.origin !== "extension://ppacppediejkcoikockahgfnpajmahnk/snapshot.html")
        return;

    // event.source is popup
    // event.data is "hi there yourself!  the secret response is: rheeeeet!"
}, false);

// chrome.runtime.onMessage.addListener(
//     function (request, sender, sendResponse) {
//         console.log(sender.tab ?
//             "from a content script:" + sender.tab.url :
//             "from the extension");
//         if (request.greeting == "hello")
//             sendResponse({ farewell: "goodbye" });
//     }
// );


// var msg = chrome.runtime.sendMessage(creeting.tab, imgURL, (e) => {

// });


