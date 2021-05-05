window.onload = function () {

    // document.getElementById('image').setAttribute('src', './image.webp');

    // chrome.storage.sync.get(['urlVal'], function (result) {
    //     console.log('Value currently is ' + result.urlVal);
    // });


    chrome.runtime.onMessageExternal.addListener(

        async (data, sender) => {
            console.log("hi2")
            console.log(data)
        }

    );

}


// Called sometime after postMessage is called
window.addEventListener("message", (event) => {
    // Do we trust the sender of this message?
    if (event.origin !== "extension://ppacppediejkcoikockahgfnpajmahnk/snapshot.html:8080")
        return;

    // event.source is window.opener
    // event.data is "hello there!"

    // Assuming you've verified the origin of the received message (which
    // you must do in any case), a convenient idiom for replying to a
    // message is to call postMessage on event.source and provide
    // event.origin as the targetOrigin.
    event.source.postMessage("hi there yourself!  the secret response " +
        "is: rheeeeet!",
        event.origin);
}, false);
