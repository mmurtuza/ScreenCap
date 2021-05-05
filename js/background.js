console.log("from background")

chrome.runtime.onMessageExternal.addListener(
    async (data, sender) => {
        console.log(data)

    }

);