var screenShotTab;
var screenShotData;

async function overlayOnSelect(s, c) {
	$("#clickAndDrag").hide();
	var image = document.getElementById("image");


	var canvas;
	if (typeof OffscreenCanvas != "undefined") {
		canvas = new OffscreenCanvas(c.w * devicePixelRatio, c.h * devicePixelRatio);
	} else if (typeof document != "undefined") {
		canvas = document.createElement("canvas");

		// set canvas.STYLE.width for hidpi blurry issues, refer to http://www.html5rocks.com/en/tutorials/canvas/hidpi/
		// note this technique must also be used in the editor.html
    	canvas.width = c.w * devicePixelRatio;
    	canvas.height = c.h * devicePixelRatio;

    	canvas.style.width = c.w + 'px';
    	canvas.style.height = c.h + 'px';
	}

	const context = canvas.getContext('2d');

	context.scale(devicePixelRatio, devicePixelRatio);
	
	// Crop and resize the image: sx, sy, sw, sh, dx, dy, dw, dh.
	//context.drawImage(image, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h); // this worked for grab and crop
	context.drawImage(image, c.x * devicePixelRatio, c.y * devicePixelRatio, c.w * devicePixelRatio, c.h * devicePixelRatio, 0, 0, c.w, c.h);

	try {
		screenShotData = await getDataUrl(canvas);

        await sendMessageToBG("setScreenshotVars", {
			screenShotTab: screenShotTab,
			screenShotData: screenShotData
        })
        location.href = "editor.html";
	} catch (error) {
		alert(error);
	}
}

function init() {
	$("#imageWrapper").mousemove(function(e) {
		$("#clickAndDrag").css({
			top: (e.pageY + 15) + "px",
			left: (e.pageX + 15) + "px"
		});
	});
	$('#image').attr("src", screenShotData);
	
	$('#image').on("load", function() {
		// patch: then turn off the above listener because .Jcrop would reload the image???
		$('#image').off();
		
		setTimeout(async function() {
			$("#imageWrapper").show();

			$('#image').Jcrop({
				//aspectRatio: devicePixelRatio,
				canResize: false,
				fadeDuration: 0,
				bgOpacity: 0.7,
				minSize: [0,0],
				setSelect: [ -1, -1, -1, -1 ]
			});
			
			if (await getGrabMethod() == "openFromClipboardAndCrop") {
				$("#imageWrapper").addClass("patchForOpenFromClipboardAndCrop");
				var $jcropCanvas = $("#imageWrapper canvas");
				$jcropCanvas.css("width", $jcropCanvas.width() / devicePixelRatio);
				$jcropCanvas.css("height", $jcropCanvas.height() / devicePixelRatio);
			}
			
			var container = $('#image').Jcrop("api").container;
			container
				.on('cropstart', function() {
					$(".jcrop-box, .jcrop-shades div, .jcrop-selection.jcrop-nodrag .jcrop-box, .jcrop-nodrag .jcrop-shades div").css("cursor", "crosshair");
					$("#clickAndDrag").hide();
				})
				.on('cropend', function(e, s, c) {
					console.log("crop end");
					overlayOnSelect(s, c);
				})
			;

			$("#clickAndDrag").show();
			
		}, 1);
	});
}

$(document).ready(function() {			

    initUI();

    sendMessageToBG("getScreenshotVars").then(bg => {
		screenShotTab = bg.screenShotTab;
		screenShotData = bg.screenShotData;
		init();
    });
});