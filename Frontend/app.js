const API_BASE_URL = "https://golden-recap-mm-api.onrender.com";

let currentJobId = null;
let jobPollTimer = null;
"use strict";

/* =========================================================
   GOLDEN RECAP MM
   FRONTEND APPLICATION LOGIC
   STEP 3 — UI INTERACTIONS + LOCAL STORAGE
   ========================================================= */


/* =========================================================
   DOM HELPERS
   ========================================================= */

const $ = (id) => document.getElementById(id);

const qs = (selector, parent = document) =>
    parent.querySelector(selector);

const qsa = (selector, parent = document) =>
    Array.from(parent.querySelectorAll(selector));


/* =========================================================
   APPLICATION STATE
   ========================================================= */

const defaultSettings = {
    mode: "movie",

    source: "upload",

    videoRatio: "9:16",

    voice: "thiha",

    voiceSpeed: "1.2",

    freezeEnabled: true,
    freezeInterval: 8,
    freezeDuration: 2,
    freezeZoom: "1.2",

    subtitleFont: "Noto Sans Myanmar",
    subtitleSize: 40,

    blurEnabled: false,

    logoEnabled: false,
    logoPosition: "top-right",

    captionEnabled: true,

    thumbnailEnabled: true,

    splitMode: "auto",
    manualSplitLength: 60
};


let settings = {
    ...defaultSettings
};


/* =========================================================
   STORAGE
   ========================================================= */

const STORAGE_KEY =
    "golden_recap_mm_settings_v1";


function loadSettings() {

    try {

        const saved =
            localStorage.getItem(
                STORAGE_KEY
            );

        if (!saved) {
            return;
        }

        const parsed =
            JSON.parse(saved);

        if (
            parsed &&
            typeof parsed === "object"
        ) {

            settings = {
                ...defaultSettings,
                ...parsed
            };
        }

    } catch (error) {

        console.warn(
            "Could not load saved settings:",
            error
        );

        settings = {
            ...defaultSettings
        };
    }
}


function saveSettings() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(settings)
        );

    } catch (error) {

        console.warn(
            "Could not save settings:",
            error
        );
    }
}


/* =========================================================
   VIDEO STATE
   ========================================================= */

let selectedVideoFile = null;

let videoMetadata = {

    name: "",
    size: 0,
    duration: 0,
    width: 0,
    height: 0,
    fps: 0,
    format: ""
};


/* =========================================================
   INITIALIZATION
   ========================================================= */
document.addEventListener(
    "DOMContentLoaded",
    async () => {

        console.log(
            "Golden Recap MM: DOMContentLoaded"
        );

        loadSettings();
        applySettingsToUI();
        setupModeButtons();
        setupSourceTabs();
        setupUpload();
        setupSettings();
        setupRangeInputs();
        setupToggleInputs();
        setupSplitMode();
        setupCustomFont();
        setupUrlInputs();
        setupClearButtons();
        setupGenerateButton();
        setupCancelButton();
        setupNewRecapButton();
        setupLogoButton();

        console.log(
            "Golden Recap MM: Checking backend..."
        );

        await setupBackendStatus();

        console.log(
            "Golden Recap MM: Backend check finished."
        );

        updateAllUI();
    }
);


/* =========================================================
   MODE BUTTONS
   ========================================================= */

function setupModeButtons() {

    const buttons =
        qsa("[data-mode]");

    buttons.forEach(
        (button) => {

            button.addEventListener(
                "click",
                () => {

                    const mode =
                        button.dataset.mode;

                    if (!mode) {
                        return;
                    }

                    settings.mode =
                        mode;

                    buttons.forEach(
                        (item) => {

                            const active =
                                item === button;

                            item.classList.toggle(
                                "active",
                                active
                            );

                            item.setAttribute(
                                "aria-selected",
                                active
                                    ? "true"
                                    : "false"
                            );
                        }
                    );

                    saveSettings();

                    updateModeUI();
                }
            );
        }
    );
}


function updateModeUI() {

    const mode =
        settings.mode === "documentary"
            ? "documentary"
            : "movie";

    const buttons =
        qsa("[data-mode]");

    buttons.forEach(
        (button) => {

            const active =
                button.dataset.mode === mode;

            button.classList.toggle(
                "active",
                active
            );

            button.setAttribute(
                "aria-selected",
                active
                    ? "true"
                    : "false"
            );
        }
    );
}


/* =========================================================
   SOURCE TABS
   ========================================================= */

function setupSourceTabs() {

    const tabs =
        qsa("[data-source]");

    tabs.forEach(
        (tab) => {

            tab.addEventListener(
                "click",
                () => {

                    const source =
                        tab.dataset.source;

                    if (!source) {
                        return;
                    }

                    settings.source =
                        source;

                    tabs.forEach(
                        (item) => {

                            const active =
                                item === tab;

                            item.classList.toggle(
                                "active",
                                active
                            );

                            item.setAttribute(
                                "aria-selected",
                                active
                                    ? "true"
                                    : "false"
                            );
                        }
                    );

                    updateSourceUI();

                    updateGenerateButton();

                    saveSettings();
                }
            );
        }
    );
}


function updateSourceUI() {

    const source =
        settings.source || "upload";


    const tabs =
        qsa("[data-source]");


    tabs.forEach(
        (tab) => {

            const active =
                tab.dataset.source === source;

            tab.classList.toggle(
                "active",
                active
            );

            tab.setAttribute(
                "aria-selected",
                active
                    ? "true"
                    : "false"
            );
        }
    );


    const uploadPanel =
        $("uploadPanel");

    const tiktokPanel =
        $("tiktokPanel");

    const rednotePanel =
        $("rednotePanel");


    if (uploadPanel) {

        uploadPanel.classList.toggle(
            "hidden",
            source !== "upload"
        );
    }


    if (tiktokPanel) {

        tiktokPanel.classList.toggle(
            "hidden",
            source !== "tiktok"
        );
    }


    if (rednotePanel) {

        rednotePanel.classList.toggle(
            "hidden",
            source !== "rednote"
        );
    }
}


/* =========================================================
   FILE UPLOAD
   ========================================================= */

function setupUpload() {

    const fileInput =
        $("videoFile");

    if (!fileInput) {
        return;
    }


    fileInput.addEventListener(
        "change",
        async (event) => {

            const files =
                event.target.files;


            if (
                !files ||
                !files.length
            ) {

                selectedVideoFile =
                    null;

                clearVideoMetadata();

                updateGenerateButton();

                return;
            }


            const file =
                files[0];


            if (!isSupportedVideo(file)) {

                showUploadMessage(
                    "Unsupported video format."
                );

                fileInput.value = "";

                selectedVideoFile =
                    null;

                clearVideoMetadata();

                updateGenerateButton();

                return;
            }


            selectedVideoFile =
                file;


            showUploadMessage(
                "Video selected successfully.",
                true
            );


            await readVideoMetadata(
                file
            );


            updateGenerateButton();
        }
    );
}


/* =========================================================
   VIDEO FORMAT CHECK
   ========================================================= */

function isSupportedVideo(file) {

    const allowedTypes = [

        "video/mp4",
        "video/quicktime",
        "video/x-msvideo",
        "video/x-matroska",
        "video/webm"
    ];


    const allowedExtensions = [

        ".mp4",
        ".mov",
        ".avi",
        ".mkv",
        ".webm"
    ];


    const name =
        (file.name || "")
            .toLowerCase();


    const extension =
        name.includes(".")
            ? name.substring(
                name.lastIndexOf(".")
            )
            : "";


    return (
        allowedTypes.includes(file.type) ||
        allowedExtensions.includes(extension)
    );
}


/* =========================================================
   READ VIDEO METADATA
   ========================================================= */

async function readVideoMetadata(file) {

    return new Promise(
        (resolve) => {

            const video =
                document.createElement(
                    "video"
                );


            const objectUrl =
                URL.createObjectURL(
                    file
                );


            video.preload =
                "metadata";

            video.src =
                objectUrl;


            video.onloadedmetadata =
                () => {

                    const width =
                        video.videoWidth || 0;

                    const height =
                        video.videoHeight || 0;

                    const duration =
                        Number(
                            video.duration
                        ) || 0;


                    videoMetadata = {

                        name:
                            file.name,

                        size:
                            file.size,

                        duration:
                            duration,

                        width:
                            width,

                        height:
                            height,

                        fps:
                            0,

                        format:
                            getFileExtension(
                                file.name
                            )
                    };


                    updateVideoInfo();


                    URL.revokeObjectURL(
                        objectUrl
                    );


                    resolve();
                };


            video.onerror =
                () => {

                    videoMetadata = {

                        name:
                            file.name,

                        size:
                            file.size,

                        duration:
                            0,

                        width:
                            0,

                        height:
                            0,

                        fps:
                            0,

                        format:
                            getFileExtension(
                                file.name
                            )
                    };


                    updateVideoInfo();


                    URL.revokeObjectURL(
                        objectUrl
                    );


                    resolve();
                };
        }
    );
}


/* =========================================================
   VIDEO INFORMATION UI
   ========================================================= */

function updateVideoInfo() {

    const card =
        $("videoInfoCard");

    if (!card) {
        return;
    }


    const hasVideo =
        Boolean(
            selectedVideoFile
        );


    card.classList.toggle(
        "hidden",
        !hasVideo
    );


    if (!hasVideo) {
        return;
    }


    setText(
        "videoName",
        videoMetadata.name || "—"
    );


    setText(
        "videoSize",
        formatFileSize(
            videoMetadata.size
        )
    );


    setText(
        "videoDuration",
        formatDuration(
            videoMetadata.duration
        )
    );


    setText(
        "videoResolution",

        videoMetadata.width &&
        videoMetadata.height

            ? `${videoMetadata.width} × ${videoMetadata.height}`

            : "—"
    );


    setText(
        "videoFps",

        videoMetadata.fps

            ? `${videoMetadata.fps.toFixed(2)} FPS`

            : "Detecting on server"
    );


    setText(
        "videoFormat",

        videoMetadata.format

            ? videoMetadata.format.toUpperCase()

            : "—"
    );
}


function clearVideoMetadata() {

    videoMetadata = {

        name: "",
        size: 0,
        duration: 0,
        width: 0,
        height: 0,
        fps: 0,
        format: ""
    };


    updateVideoInfo();
}


/* =========================================================
   FILE SIZE
   ========================================================= */

function formatFileSize(bytes) {

    if (!bytes) {
        return "0 B";
    }


    const units = [
        "B",
        "KB",
        "MB",
        "GB"
    ];


    let size =
        bytes;

    let index =
        0;


    while (
        size >= 1024 &&
        index < units.length - 1
    ) {

        size /= 1024;

        index++;
    }


    return `${size.toFixed(
        index === 0
            ? 0
            : 2
    )} ${units[index]}`;
}


/* =========================================================
   DURATION
   ========================================================= */

function formatDuration(seconds) {

    if (
        !seconds ||
        !Number.isFinite(seconds)
    ) {

        return "—";
    }


    const total =
        Math.round(
            seconds
        );


    const hours =
        Math.floor(
            total / 3600
        );


    const minutes =
        Math.floor(
            (total % 3600) / 60
        );


    const secs =
        total % 60;


    if (hours > 0) {

        return (
            `${hours}:` +
            `${String(
                minutes
            ).padStart(2, "0")}:` +
            `${String(
                secs
            ).padStart(2, "0")}`
        );
    }


    return (
        `${minutes}:` +
        `${String(
            secs
        ).padStart(2, "0")}`
    );
}


/* =========================================================
   FILE EXTENSION
   ========================================================= */

function getFileExtension(name) {

    if (!name) {
        return "";
    }


    const index =
        name.lastIndexOf(".");


    if (index === -1) {
        return "";
    }


    return name.substring(
        index + 1
    );
}


/* =========================================================
   UPLOAD MESSAGE
   ========================================================= */

function showUploadMessage(
    message,
    success = false
) {

    const element =
        $("uploadMessage");


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.classList.toggle(
        "success",
        success
    );


    element.classList.remove(
        "hidden"
    );
}


/* =========================================================
   SETTINGS
   ========================================================= */

function setupSettings() {

    const selectMappings = {

        videoRatio:
            "videoRatio",

        voice:
            "voice",

        voiceSpeed:
            "voiceSpeed",

        freezeZoom:
            "freezeZoom",

        subtitleFont:
            "subtitleFont",

        logoPosition:
            "logoPosition",

        splitMode:
            "splitMode"
    };


    Object.entries(
        selectMappings
    ).forEach(
        ([elementId, stateKey]) => {

            const element =
                $(elementId);


            if (!element) {
                return;
            }


            element.addEventListener(
                "change",
                () => {

                    settings[stateKey] =
                        element.value;


                    saveSettings();

                    updateAllUI();
                }
            );
        }
    );
}


/* =========================================================
   RANGE INPUTS
   ========================================================= */

function setupRangeInputs() {

    const freezeInterval =
        $("freezeInterval");

    const freezeDuration =
        $("freezeDuration");

    const subtitleSize =
        $("subtitleSize");

    const manualSplitLength =
        $("manualSplitLength");


    if (freezeInterval) {

        freezeInterval.addEventListener(
            "input",
            () => {

                settings.freezeInterval =
                    Number(
                        freezeInterval.value
                    );


                updateRangeValue(
                    "freezeInterval",
                    "freezeIntervalValue",
                    `${freezeInterval.value}s`
                );


                saveSettings();
            }
        );
    }


    if (freezeDuration) {

        freezeDuration.addEventListener(
            "input",
            () => {

                settings.freezeDuration =
                    Number(
                        freezeDuration.value
                    );


                updateRangeValue(
                    "freezeDuration",
                    "freezeDurationValue",
                    `${freezeDuration.value}s`
                );


                saveSettings();
            }
        );
    }


    if (subtitleSize) {

        subtitleSize.addEventListener(
            "input",
            () => {

                settings.subtitleSize =
                    Number(
                        subtitleSize.value
                    );


                updateRangeValue(
                    "subtitleSize",
                    "subtitleSizeValue",
                    `${subtitleSize.value}px`
                );


                updateSubtitlePreview();


                saveSettings();
            }
        );
    }


    if (manualSplitLength) {

        manualSplitLength.addEventListener(
            "input",
            () => {

                settings.manualSplitLength =
                    Number(
                        manualSplitLength.value
                    );


                saveSettings();
            }
        );
    }
}


/* =========================================================
   CUSTOM FONT UPLOAD
   ========================================================= */

function setupCustomFont() {

    const fontSelect = $("subtitleFont");
    const fontSettings = $("customFontSettings");
    const fontFile = $("customFontFile");
    const fontName = $("customFontName");

    if (!fontSelect) {
        return;
    }

    function updateCustomFontUI() {

        const isCustom =
            fontSelect.value === "custom";

        if (fontSettings) {
            fontSettings.classList.toggle(
                "hidden",
                !isCustom
            );
        }
    }


    /* -----------------------------------------------------
       FONT SELECT
       ----------------------------------------------------- */

    fontSelect.addEventListener(
        "change",
        () => {

            settings.subtitleFont =
                fontSelect.value;

            saveSettings();

            updateCustomFontUI();
        }
    );


    /* -----------------------------------------------------
       UPLOAD BUTTON
       ----------------------------------------------------- */

    const uploadButton =
        qs(".custom-font-upload");

    if (
        uploadButton &&
        fontFile
    ) {

        uploadButton.addEventListener(
            "click",
            (event) => {

                event.preventDefault();

                fontFile.click();
            }
        );
    }


    /* -----------------------------------------------------
       FONT FILE
       ----------------------------------------------------- */

    if (fontFile) {

        fontFile.addEventListener(
            "change",
            () => {

                const file =
                    fontFile.files &&
                    fontFile.files[0];

                if (!file) {
                    return;
                }


                const fileName =
                    file.name.toLowerCase();


                const validFont =
                    fileName.endsWith(".ttf") ||
                    fileName.endsWith(".otf");


                if (!validFont) {

                    alert(
                        "Please select a .ttf or .otf font file."
                    );

                    fontFile.value = "";

                    if (fontName) {
                        fontName.textContent =
                            "No font selected";
                    }

                    return;
                }


                if (fontName) {

                    fontName.textContent =
                        file.name;
                }


                /* Keep the selected font in frontend state */

                settings.subtitleFont =
                    "custom";

                saveSettings();


                console.log(
                    "Custom font selected:",
                    file.name
                );
            }
        );
    }


    /* -----------------------------------------------------
       INITIAL UI
       ----------------------------------------------------- */

    updateCustomFontUI();
}



/* =========================================================
   RANGE VALUE HELPER
   ========================================================= */

function updateRangeValue(
    inputId,
    valueId,
    text
) {

    const input =
        $(inputId);

    const value =
        $(valueId);


    if (input) {

        input.value =
            input.value;
    }


    if (value) {

        value.textContent =
            text;
    }
}


/* =========================================================
   TOGGLE INPUTS
   ========================================================= */

function setupToggleInputs() {

    const toggles = [

        [
            "freezeEnabled",
            "freezeEnabled"
        ],

        [
            "blurEnabled",
            "blurEnabled"
        ],

        [
            "logoEnabled",
            "logoEnabled"
        ],

        [
            "captionEnabled",
            "captionEnabled"
        ],

        [
            "thumbnailEnabled",
            "thumbnailEnabled"
        ]
    ];


    toggles.forEach(
        ([elementId, stateKey]) => {

            const element =
                $(elementId);


            if (!element) {
                return;
            }


            element.addEventListener(
                "change",
                () => {

                    settings[stateKey] =
                        Boolean(
                            element.checked
                        );


                    saveSettings();


                    updateAllUI();
                }
            );
        }
    );
}


/* =========================================================
   SPLIT MODE
   ========================================================= */

function setupSplitMode() {

    const splitMode =
        $("splitMode");


    if (!splitMode) {
        return;
    }


    splitMode.addEventListener(
        "change",
        () => {

            settings.splitMode =
                splitMode.value;


            saveSettings();


            updateSplitUI();
        }
    );
}


function updateSplitUI() {

    const manualSettings =
        $("manualSplitSettings");


    if (!manualSettings) {
        return;
    }


    const isManual =
        settings.splitMode === "manual";


    manualSettings.classList.toggle(
        "hidden",
        !isManual
    );
}


/* =========================================================
   FREEZE UI
   ========================================================= */

function updateFreezeUI() {

    const enabled =
        Boolean(
            settings.freezeEnabled
        );


    const interval =
        $("freezeInterval");

    const duration =
        $("freezeDuration");

    const zoom =
        $("freezeZoom");

    const freezeSettings =
        $("freezeSettings");


    if (interval) {

        interval.disabled =
            !enabled;
    }


    if (duration) {

        duration.disabled =
            !enabled;
    }


    if (zoom) {

        zoom.disabled =
            !enabled;
    }


    if (freezeSettings) {

        freezeSettings.classList.toggle(
            "hidden",
            !enabled
        );
    }
}


/* =========================================================
   BLUR UI
   ========================================================= */

function updateBlurUI() {

    const editor =
        $("blurEditor");


    const enabled =
        Boolean(
            settings.blurEnabled
        );


    if (editor) {

        editor.classList.toggle(
            "hidden",
            !enabled
        );
    }
}


/* =========================================================
   LOGO UI
   ========================================================= */

function updateLogoUI() {

    const logoSettings =
        $("logoSettings");


    const enabled =
        Boolean(
            settings.logoEnabled
        );


    if (logoSettings) {

        logoSettings.classList.toggle(
            "hidden",
            !enabled
        );
    }
}


/* =========================================================
   LOGO FILE / ADJUST BUTTON
   ========================================================= */

function setupLogoButton() {

    const button =
        $("logoAdjustButton");


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            const editor =
                $("logoSettings");


            if (!editor) {
                return;
            }


            editor.scrollIntoView({
                behavior:
                    "smooth",

                block:
                    "center"
            });
        }
    );
}


/* =========================================================
   SUBTITLE PREVIEW
   ========================================================= */

function updateSubtitlePreview() {

    let preview =
        $("subtitlePreview");


    if (!preview) {

        preview =
            qs(
                ".subtitle-preview-text"
            );
    }


    if (!preview) {
        return;
    }


    preview.style.fontSize =
        `${settings.subtitleSize}px`;
}


/* =========================================================
   APPLY SETTINGS TO UI
   ========================================================= */

function applySettingsToUI() {

    updateSelect(
        "videoRatio",
        settings.videoRatio
    );


    updateSelect(
        "voice",
        settings.voice
    );


    updateSelect(
        "voiceSpeed",
        settings.voiceSpeed
    );


    updateSelect(
        "freezeZoom",
        settings.freezeZoom
    );


    updateSelect(
        "subtitleFont",
        settings.subtitleFont
    );


    updateSelect(
        "logoPosition",
        settings.logoPosition
    );


    updateSelect(
        "splitMode",
        settings.splitMode
    );


    updateCheckbox(
        "freezeEnabled",
        settings.freezeEnabled
    );


    updateCheckbox(
        "blurEnabled",
        settings.blurEnabled
    );


    updateCheckbox(
        "logoEnabled",
        settings.logoEnabled
    );


    updateCheckbox(
        "captionEnabled",
        settings.captionEnabled
    );


    updateCheckbox(
        "thumbnailEnabled",
        settings.thumbnailEnabled
    );


    updateRange(
        "freezeInterval",
        settings.freezeInterval
    );


    updateRange(
        "freezeDuration",
        settings.freezeDuration
    );


    updateRange(
        "subtitleSize",
        settings.subtitleSize
    );


    updateRange(
        "manualSplitLength",
        settings.manualSplitLength
    );
}


/* =========================================================
   SELECT HELPER
   ========================================================= */

function updateSelect(
    id,
    value
) {

    const element =
        $(id);


    if (!element) {
        return;
    }


    const option =
        Array.from(
            element.options
        ).find(
            (item) =>
                item.value ===
                String(value)
        );


    if (option) {

        element.value =
            String(value);
    }
}


/* =========================================================
   CHECKBOX HELPER
   ========================================================= */

function updateCheckbox(
    id,
    value
) {

    const element =
        $(id);


    if (!element) {
        return;
    }


    element.checked =
        Boolean(value);
}


/* =========================================================
   RANGE HELPER
   ========================================================= */

function updateRange(
    id,
    value
) {

    const element =
        $(id);


    if (!element) {
        return;
    }


    element.value =
        String(value);
}


/* =========================================================
   UPDATE ALL UI
   ========================================================= */

function updateAllUI() {

    updateModeUI();

    updateSourceUI();

    updateFreezeUI();

    updateBlurUI();

    updateLogoUI();

    updateSplitUI();

    updateSubtitlePreview();

    updateRangeLabels();

    updateVideoInfo();

    updateGenerateButton();
}


/* =========================================================
   RANGE LABELS
   ========================================================= */

function updateRangeLabels() {

    const freezeInterval =
        $("freezeInterval");

    const freezeDuration =
        $("freezeDuration");

    const subtitleSize =
        $("subtitleSize");


    if (freezeInterval) {

        updateRangeValue(
            "freezeInterval",
            "freezeIntervalValue",
            `${freezeInterval.value}s`
        );
    }


    if (freezeDuration) {

        updateRangeValue(
            "freezeDuration",
            "freezeDurationValue",
            `${freezeDuration.value}s`
        );
    }


    if (subtitleSize) {

        updateRangeValue(
            "subtitleSize",
            "subtitleSizeValue",
            `${subtitleSize.value}px`
        );
    }
}


/* =========================================================
   GENERATE BUTTON
   ========================================================= */

function setupGenerateButton() {
    const button = $("generateButton");

    if (!button) return;

    button.addEventListener("click", async () => {
        if (!validateBeforeGenerate()) return;

        const source = settings.source;

        if (source === "upload" && !selectedVideoFile) {
            alert("Please select a video first.");
            return;
        }

        showProcessingView();
        updateProgress(5, "Uploading Video");

        button.disabled = true;

        try {
            const formData = new FormData();

            /*
             * Current frontend uses:
             * upload / tiktok / rednote
             *
             * Backend currently expects:
             * local / tiktok / rednote
             */
            const backendSource =
                source === "upload"
                    ? "local"
                    : source;

            formData.append(
                "source",
                backendSource
            );

            formData.append(
                "settings",
                JSON.stringify(settings)
            );

            if (source === "upload") {
                formData.append(
                    "video",
                    selectedVideoFile
                );
            }

            if (source === "tiktok") {
                const input = $("tiktokUrl");

                const url = input
                    ? input.value.trim()
                    : "";

                if (!url) {
                    throw new Error(
                        "Please enter a TikTok video URL."
                    );
                }

                formData.append(
                    "source_url",
                    url
                );
            }

            if (source === "rednote") {
                const input = $("rednoteUrl");

                const url = input
                    ? input.value.trim()
                    : "";

                if (!url) {
                    throw new Error(
                        "Please enter a RedNote video URL."
                    );
                }

                formData.append(
                    "source_url",
                    url
                );
            }

            const response = await fetch(
                `${API_BASE_URL}/api/jobs`,
                {
                    method: "POST",
                    body: formData
                }
            );

            if (!response.ok) {
                let errorMessage =
                    "Could not create the recap job.";

                try {
                    const errorData =
                        await response.json();

                    if (errorData.detail) {
                        errorMessage =
                            errorData.detail;
                    }
                } catch (error) {
                    // Ignore JSON parsing error.
                }

                throw new Error(
                    errorMessage
                );
            }

            const job = await response.json();

            currentJobId = job.job_id;

            updateProgress(
                job.progress ?? 5,
                job.stage ?? "Uploading Video"
            );

            startJobPolling(
                currentJobId
            );

        } catch (error) {
            console.error(
                "Create job failed:",
                error
            );

            stopJobPolling();

            currentJobId = null;

            alert(
                error.message ||
                "Failed to connect to the backend."
            );

            restoreMainView();
        } finally {
            button.disabled = false;
        }
    });
}
/* =========================================================
   JOB POLLING
   ========================================================= */

function startJobPolling(jobId) {
    stopJobPolling();

    if (!jobId) {
        return;
    }

    pollJobStatus(jobId);

    jobPollTimer = setInterval(() => {
        pollJobStatus(jobId);
    }, 1000);
}


function stopJobPolling() {
    if (jobPollTimer) {
        clearInterval(jobPollTimer);
        jobPollTimer = null;
    }
}


async function pollJobStatus(jobId) {
    if (!jobId) {
        return;
    }

    try {
        const response = await fetch(
    `${API_BASE_URL}/api/jobs/${jobId}`
);

if (response.status === 404) {

    console.warn(
        "Job no longer exists on backend:",
        jobId
    );

    stopJobPolling();

    if (currentJobId === jobId) {
        currentJobId = null;
    }

    restoreMainView();

    alert(
        "This processing job is no longer available. Please generate the recap again."
    );

    return;
}

if (!response.ok) {
    throw new Error(
        "Could not read job status."
    );
}
        }

        const job = await response.json();

        updateProgress(
            job.progress ?? 0,
            job.stage ?? "Processing"
        );


        /* -----------------------------------------
           PROCESSING
           ----------------------------------------- */

        if (
            job.status === "queued" ||
            job.status === "processing"
        ) {
            return;
        }


        /* -----------------------------------------
           CANCELLING
           ----------------------------------------- */

        if (job.status === "cancelling") {
            updateProgress(
                job.progress ?? 0,
                "Cancelling"
            );

            return;
        }


        /* -----------------------------------------
           COMPLETED
           ----------------------------------------- */

        if (job.status === "completed") {
            stopJobPolling();

            updateProgress(
                100,
                "Final Video Ready"
            );

            setTimeout(() => {
                showResultView(
                    job.result
                );
            }, 500);

            return;
        }


        /* -----------------------------------------
           CANCELLED
           ----------------------------------------- */

        if (job.status === "cancelled") {
            stopJobPolling();

            currentJobId = null;

            restoreMainView();

            return;
        }


        /* -----------------------------------------
           FAILED
           ----------------------------------------- */

        if (job.status === "failed") {
            stopJobPolling();

            currentJobId = null;

            restoreMainView();

            alert(
                job.error ||
                job.message ||
                "Processing failed."
            );

            return;
        }

    } catch (error) {
        console.error(
            "Job polling failed:",
            error
        );
    }
}

/* =========================================================
   GENERATE VALIDATION
   ========================================================= */

function validateBeforeGenerate() {

    const source =
        settings.source;


    /* -----------------------------------------------------
       LOCAL UPLOAD
       ----------------------------------------------------- */

    if (
        source === "upload" &&
        !selectedVideoFile
    ) {

        showError(
            "Please select a video first."
        );


        return false;
    }


    /* -----------------------------------------------------
       TIKTOK
       ----------------------------------------------------- */

    if (
        source === "tiktok"
    ) {

        const input =
            $("tiktokUrl");


        if (
            !input ||
            !input.value.trim()
        ) {

            showError(
                "Please enter a TikTok video link."
            );


            return false;
        }
    }


    /* -----------------------------------------------------
       REDNOTE
       ----------------------------------------------------- */

    if (
        source === "rednote"
    ) {

        const input =
            $("rednoteUrl");


        if (
            !input ||
            !input.value.trim()
        ) {

            showError(
                "Please enter a RedNote video link."
            );


            return false;
        }
    }


    return true;
}


/* =========================================================
   ERROR MESSAGE
   ========================================================= */

function showError(message) {

    const existing =
        $("appError");


    if (existing) {

        existing.textContent =
            message;


        existing.classList.remove(
            "hidden"
        );


        setTimeout(
            () => {

                existing.classList.add(
                    "hidden"
                );

            },
            4000
        );


        return;
    }


    alert(message);
}


/* =========================================================
   PROCESSING VIEW
   ========================================================= */

function showProcessingView() {

    const settingsSection =
        $("settingsSection");

    const generateButton =
        $("generateButton");

    const processingView =
        $("processingView");


    if (settingsSection) {

        settingsSection.classList.add(
            "hidden"
        );
    }


    if (generateButton) {

        generateButton.classList.add(
            "hidden"
        );
    }


    if (processingView) {

        processingView.classList.remove(
            "hidden"
        );
    }


    updateProgress(
        5,
        "Uploading Video"
    );
}


/* =========================================================
   PROGRESS
   ========================================================= */

function updateProgress(percent, stage) {
    const progressPercent =
        $("progressPercent");

    const processingStage =
        $("processingStage");

    const processingDescription =
        $("processingDescription");

    const progressCircle =
        $("progressCircle");


    const safePercent = Math.max(
        0,
        Math.min(
            100,
            Number(percent) || 0
        )
    );


    if (progressPercent) {
        progressPercent.textContent =
            `${Math.round(safePercent)}%`;
    }


    if (processingStage) {
        processingStage.textContent =
            stage || "Processing";
    }


    if (processingDescription) {
        processingDescription.textContent =
            "Please wait while Golden Recap MM processes your video.";
    }


    if (progressCircle) {
        progressCircle.style.setProperty(
            "--progress",
            `${safePercent * 3.6}deg`
        );
    }
}

/* =========================================================
   CANCEL JOB
   ========================================================= */

function setupCancelButton() {
    const button = $("cancelButton");

    if (!button) {
        return;
    }

    button.addEventListener("click", async () => {
        if (!currentJobId) {
            restoreMainView();
            return;
        }

        const jobId = currentJobId;

        button.disabled = true;
        button.textContent = "Cancelling...";

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/jobs/${jobId}/cancel`,
                {
                    method: "POST"
                }
            );

            if (!response.ok) {
                let errorMessage =
                    "Could not cancel the job.";

                try {
                    const errorData =
                        await response.json();

                    if (errorData.detail) {
                        errorMessage =
                            errorData.detail;
                    }
                } catch (error) {
                    // Ignore JSON parsing error.
                }

                throw new Error(
                    errorMessage
                );
            }

            const job =
                await response.json();

            updateProgress(
                job.progress ?? 0,
                "Cancelling"
            );

        } catch (error) {
            console.error(
                "Cancel job failed:",
                error
            );

            button.disabled = false;
            button.textContent = "Cancel";

            alert(
                error.message ||
                "Could not cancel the job."
            );
        }
    });
}

/* =========================================================
   RESTORE MAIN VIEW
   ========================================================= */

function restoreMainView() {

    const settingsSection =
        $("settingsSection");

    const generateButton =
        $("generateButton");

    const processingView =
        $("processingView");


    if (processingView) {

        processingView.classList.add(
            "hidden"
        );
    }


    if (settingsSection) {

        settingsSection.classList.remove(
            "hidden"
        );
    }


    if (generateButton) {

        generateButton.classList.remove(
            "hidden"
        );
    }


    updateAllUI();
}
/* =========================================================
   RESULT VIEW
   FINAL RESULT UI
   ========================================================= */

function showResultView(result) {

    const processingView =
        $("processingView");

    const resultView =
        $("resultView");

    const resultVideoContainer =
        $("resultVideoContainer");

    const resultParts =
        $("resultParts");

    const downloadVideoButton =
        $("downloadVideoButton");

    const downloadThumbnailButton =
        $("downloadThumbnailButton");

    const copyCaptionButton =
        $("copyCaptionButton");

    /* ---------------------------------------------------------
       HIDE PROCESSING
       --------------------------------------------------------- */

    if (processingView) {
        processingView.classList.add(
            "hidden"
        );
    }

    /* ---------------------------------------------------------
       SHOW RESULT
       --------------------------------------------------------- */

    if (resultView) {
        resultView.classList.remove(
            "hidden"
        );
    }

    /* ---------------------------------------------------------
       RESULT DATA
       --------------------------------------------------------- */

    const videoUrl =
        result &&
        (
            result.video_url ||
            result.download_url
        )
            ? (
                result.video_url ||
                result.download_url
            )
            : "";

    const thumbnailUrl =
        result &&
        result.thumbnail_url
            ? result.thumbnail_url
            : "";

    const caption =
        result &&
        result.caption
            ? result.caption
            : "";
    /* ---------------------------------------------------------
       VIDEO PREVIEW
       --------------------------------------------------------- */

    if (resultVideoContainer) {

        if (videoUrl) {

            resultVideoContainer.innerHTML = `
                <div
                    class="final-video-card"
                    style="
                        width:100%;
                        max-width:720px;
                        margin:0 auto;
                        overflow:hidden;
                        border-radius:18px;
                        border:1px solid rgba(217,173,85,0.18);
                        background:#11151d;
                        box-shadow:
                            0 18px 50px
                            rgba(0,0,0,0.28);
                    "
                >

                    <video
                        controls
                        playsinline
                        preload="metadata"
                        poster="${thumbnailUrl}"
                        style="
                            width:100%;
                            height:auto;
                            display:block;
                            background:#080a0f;
                        "
                    >
                        <source
                            src="${videoUrl}"
                            type="video/mp4"
                        >

                        Your browser does not support
                        video playback.
                    </video>

                </div>
            `;

        }
    }

    /* ---------------------------------------------------------
       VIDEO DOWNLOAD
       --------------------------------------------------------- */
    if (downloadVideoButton) {

        if (videoUrl) {

            downloadVideoButton.href =
                videoUrl;

            downloadVideoButton.download =
                "golden-recap-mm.mp4";

            downloadVideoButton.classList.remove(
                "hidden"
            );

            downloadVideoButton.removeAttribute(
                "aria-hidden"
            );

        } else {

            downloadVideoButton.classList.add(
                "hidden"
            );
        }
    }

    /* ---------------------------------------------------------
       THUMBNAIL DOWNLOAD
       --------------------------------------------------------- */

    if (downloadThumbnailButton) {

        if (thumbnailUrl) {

            downloadThumbnailButton.href =
                thumbnailUrl;

            downloadThumbnailButton.download =
                "golden-recap-thumbnail.jpg";

            downloadThumbnailButton.classList.remove(
                "hidden"
            );

            downloadThumbnailButton.removeAttribute(
                "aria-hidden"
            );

        } else {

            downloadThumbnailButton.classList.add(
                "hidden"
            );
        }
    }

    /* ---------------------------------------------------------
       CAPTION
       --------------------------------------------------------- */

    if (copyCaptionButton) {

        copyCaptionButton.dataset.caption =
            caption;

        if (caption) {

            copyCaptionButton.classList.remove(
                "hidden"
            );

        } else {

            copyCaptionButton.classList.add(
                "hidden"
            );
        }
    }

    /* ---------------------------------------------------------
       RESULT PARTS / SPLIT VIDEOS
       --------------------------------------------------------- */

    if (resultParts) {

        resultParts.innerHTML = "";

        if (
            result &&
            Array.isArray(result.parts) &&
            result.parts.length > 0
        ) {

            result.parts.forEach(
                (part, index) => {

                    const partUrl =
                        part.video_url ||
                        part.download_url;

                    if (!partUrl) {
                        return;
                    }

                    const item =
                        document.createElement(
                            "div"
                        );

                    item.className =
                        "result-part";

                    item.innerHTML = `
                        <div
                            style="
                                display:flex;
                                align-items:center;
                                justify-content:space-between;
                                gap:12px;
                                padding:12px 14px;
                                border-radius:12px;
                                border:1px solid
                                    rgba(255,255,255,0.06);
                                background:
                                    rgba(255,255,255,0.025);
                            "
                        >

                            <span
                                style="
                                    color:#e8eaf0;
                                    font-size:12px;
                                    font-weight:600;
                                "
                            >
                                Video ${index + 1}
                            </span>

                            <a
                                href="${partUrl}"
                                target="_blank"
                                rel="noopener"
                                style="
                                    color:#e0b85f;
                                    font-size:11px;
                                    font-weight:700;
                                    text-decoration:none;
                                "
                            >
                                Open Video
                            </a>

                        </div>
                    `;

                    resultParts.appendChild(
                        item
                    );
                }
            );
        }
    }

    /* ---------------------------------------------------------
       FINAL STATE
       --------------------------------------------------------- */

    currentJobId = null;

    /*
     * Keep result view visible.
     * The real backend will provide:
     *
     * video_url
     * download_url
     * thumbnail_url
     * caption
     * parts
     *
     * and this UI will automatically use them.
     */
}

/* =========================================================
   RESULT / NEW RECAP
   ========================================================= */

function setupNewRecapButton() {

    const button =
        $("newRecapButton");


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            resetForNewRecap();
        }
    );
}


function resetForNewRecap() {

    selectedVideoFile =
        null;


    clearVideoMetadata();


    const fileInput =
        $("videoFile");


    if (fileInput) {

        fileInput.value =
            "";
    }


    const resultView =
        $("resultView");


    if (resultView) {

        resultView.classList.add(
            "hidden"
        );
    }


    restoreMainView();


    window.scrollTo({
        top:
            0,

        behavior:
            "smooth"
    });
}
/* =========================================================
   BACKEND STATUS DEBUG
   ========================================================= */

async function setupBackendStatus() {
    const statusText = $("statusText");
    const statusDot = $("statusDot");

    if (!statusText || !statusDot) {
        console.error(
            "Backend status elements not found."
        );
        return;
    }

    statusText.textContent =
        "Backend Connecting...";

    statusDot.classList.remove("online");

    const controller =
        new AbortController();

    const timeoutId =
        setTimeout(() => {
            controller.abort();
        }, 10000);

    try {
        const healthUrl =
            `${API_BASE_URL}/health`;

        console.log(
            "Checking backend:",
            healthUrl
        );

        const response = await fetch(
    healthUrl,
    {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        signal: controller.signal
    }
);

        clearTimeout(timeoutId);

        console.log(
            "Backend response:",
            response.status,
            response.statusText
        );

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status} ${response.statusText}`
            );
        }

        const data =
            await response.json();

        console.log(
            "Backend health data:",
            data
        );

        if (data.status === "online") {
            statusText.textContent =
                "Backend Connected";

            statusDot.classList.add("online");

            return;
        }

        throw new Error(
            "Backend returned status: " +
            data.status
        );

    } catch (error) {
        clearTimeout(timeoutId);

        console.error(
            "BACKEND CONNECTION ERROR:",
            error
        );

        if (error.name === "AbortError") {
            statusText.textContent =
                "Error: Backend Timeout";
        } else {
            statusText.textContent =
                "Error: " + (
                    error.message ||
                    "Connection failed"
                );
        }

        statusDot.classList.remove("online");
    }
}
/* =========================================================
   UTILITY — SET TEXT
   ========================================================= */

function setText(
    id,
    value
) {

    const element =
        $(id);


    if (!element) {
        return;
    }


    element.textContent =
        value;
}


/* =========================================================
   UPDATE GENERATE BUTTON
   ========================================================= */

function updateGenerateButton() {

    const button =
        $("generateButton");


    if (!button) {
        return;
    }


    const source =
        settings.source;


    let ready =
        false;


    if (
        source === "upload"
    ) {

        ready =
            Boolean(
                selectedVideoFile
            );
    }


    else if (
        source === "tiktok"
    ) {

        const input =
            $("tiktokUrl");


        ready =
            Boolean(
                input &&
                input.value.trim()
            );
    }


    else if (
        source === "rednote"
    ) {

        const input =
            $("rednoteUrl");


        ready =
            Boolean(
                input &&
                input.value.trim()
            );
    }


    button.disabled =
        !ready;
}


/* =========================================================
   URL INPUTS
   ========================================================= */

function setupUrlInputs() {

    const tiktok =
        $("tiktokUrl");

    const rednote =
        $("rednoteUrl");


    if (tiktok) {

        tiktok.addEventListener(
            "input",
            () => {

                updateGenerateButton();
            }
        );
    }


    if (rednote) {

        rednote.addEventListener(
            "input",
            () => {

                updateGenerateButton();
            }
        );
    }
}


/* =========================================================
   CLEAR BUTTONS
   ========================================================= */

function setupClearButtons() {

    const clearButtons =
        qsa("[data-clear]");


    clearButtons.forEach(
        (button) => {

            button.addEventListener(
                "click",
                () => {

                    const targetId =
                        button.dataset.clear;


                    if (!targetId) {
                        return;
                    }


                    const target =
                        $(targetId);


                    if (!target) {
                        return;
                    }


                    target.value =
                        "";


                    target.dispatchEvent(
                        new Event(
                            "input",
                            {
                                bubbles:
                                    true
                            }
                        )
                    );


                    updateGenerateButton();
                }
            );
        }
    );
}


/* =========================================================
   KEYBOARD ACCESSIBILITY
   ========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key !== "Escape"
        ) {

            return;
        }


        const processingView =
            $("processingView");


        if (
            processingView &&
            !processingView.classList.contains(
                "hidden"
            )
        ) {

            restoreMainView();
        }
    }
);


/* =========================================================
   DEBUG HELPER
   ========================================================= */

window.GoldenRecapMM = {

    getSettings() {

        return {
            ...settings
        };
    },


    getVideo() {

        return selectedVideoFile;
    },


    getMetadata() {

        return {
            ...videoMetadata
        };
    },


    saveSettings,


    resetSettings() {

        settings = {
            ...defaultSettings
        };


        saveSettings();


        applySettingsToUI();


        updateAllUI();
    }
};
