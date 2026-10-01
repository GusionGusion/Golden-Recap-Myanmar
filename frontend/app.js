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

    source: "local",

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

const STORAGE_KEY = "golden_recap_mm_settings_v1";


function loadSettings() {

    try {

        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return;
        }

        const parsed = JSON.parse(saved);

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
    () => {

        loadSettings();

        applySettingsToUI();

        setupModeButtons();

        setupSourceTabs();

        setupUpload();

        setupSettings();

        setupRangeInputs();

        setupToggleInputs();

        setupSplitMode();

        setupGenerateButton();

        setupCancelButton();

        setupNewRecapButton();

        setupLogoButton();

        setupBackendStatus();

        updateAllUI();
        
        setupCustomFont();

    }
);


/* =========================================================
   MODE BUTTONS
   ========================================================= */

function setupModeButtons() {

    const buttons = qsa(
        "[data-mode]"
    );

    buttons.forEach((button) => {

        button.addEventListener(
            "click",
            () => {

                const mode =
                    button.dataset.mode;

                if (!mode) {
                    return;
                }

                settings.mode = mode;

                buttons.forEach((item) => {

                    item.classList.toggle(
                        "active",
                        item === button
                    );

                    item.setAttribute(
                        "aria-selected",
                        item === button
                            ? "true"
                            : "false"
                    );
                });

                saveSettings();

                updateModeUI();
            }
        );
    });
}


function updateModeUI() {

    const mode =
        settings.mode === "documentary"
            ? "documentary"
            : "movie";

    const buttons = qsa(
        "[data-mode]"
    );

    buttons.forEach((button) => {

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
    });
}


/* =========================================================
   SOURCE TABS
   ========================================================= */

function setupSourceTabs() {

    const tabs = qsa(
        "[data-source]"
    );

    tabs.forEach((tab) => {

        tab.addEventListener(
            "click",
            () => {

                const source =
                    tab.dataset.source;

                if (!source) {
                    return;
                }

                settings.source = source;

                tabs.forEach((item) => {

                    item.classList.toggle(
                        "active",
                        item === tab
                    );

                    item.setAttribute(
                        "aria-selected",
                        item === tab
                            ? "true"
                            : "false"
                    );
                });

                updateSourceUI();

                saveSettings();
            }
        );
    });
}


function updateSourceUI() {

    const source =
        settings.source || "local";

    const tabs = qsa(
        "[data-source]"
    );

    tabs.forEach((tab) => {

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
    });

    const localPanel =
        $("localUploadPanel");

    const tiktokPanel =
        $("tiktokPanel");

    const rednotePanel =
        $("rednotePanel");


    if (localPanel) {

        localPanel.classList.toggle(
            "hidden",
            source !== "local"
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

            if (!files || !files.length) {

                selectedVideoFile = null;

                clearVideoMetadata();

                return;
            }

            const file = files[0];

            if (!isSupportedVideo(file)) {

                showUploadMessage(
                    "Unsupported video format."
                );

                fileInput.value = "";

                return;
            }

            selectedVideoFile = file;

            showUploadMessage(
                "Video selected successfully.",
                true
            );

            await readVideoMetadata(file);
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
        (file.name || "").toLowerCase();

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
                document.createElement("video");

            const objectUrl =
                URL.createObjectURL(file);

            video.preload = "metadata";

            video.src = objectUrl;

            video.onloadedmetadata = () => {

                const width =
                    video.videoWidth || 0;

                const height =
                    video.videoHeight || 0;

                const duration =
                    Number(video.duration) || 0;


                videoMetadata = {

                    name: file.name,

                    size: file.size,

                    duration: duration,

                    width: width,

                    height: height,

                    fps: 0,

                    format: getFileExtension(
                        file.name
                    )
                };


                updateVideoInfo();

                URL.revokeObjectURL(
                    objectUrl
                );

                resolve();
            };


            video.onerror = () => {

                videoMetadata = {

                    name: file.name,

                    size: file.size,

                    duration: 0,

                    width: 0,

                    height: 0,

                    fps: 0,

                    format: getFileExtension(
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
        Boolean(selectedVideoFile);


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

    let size = bytes;

    let index = 0;

    while (
        size >= 1024 &&
        index < units.length - 1
    ) {

        size /= 1024;

        index++;
    }

    return `${size.toFixed(
        index === 0 ? 0 : 2
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
        Math.round(seconds);

    const hours =
        Math.floor(total / 3600);

    const minutes =
        Math.floor(
            (total % 3600) / 60
        );

    const secs =
        total % 60;


    if (hours > 0) {

        return (
            `${hours}:` +
            `${String(minutes).padStart(2, "0")}:` +
            `${String(secs).padStart(2, "0")}`
        );
    }


    return (
        `${minutes}:` +
        `${String(secs).padStart(2, "0")}`
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

        videoRatio: "videoRatio",

        voice: "voice",

        voiceSpeed: "voiceSpeed",

        freezeZoom: "freezeZoom",

        subtitleFont: "subtitleFont",

        logoPosition: "logoPosition",

        splitMode: "splitMode"
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

    const fontSelect =
        $("subtitleFont");

    const fontSettings =
        $("customFontSettings");

    const fontFile =
        $("customFontFile");

    const fontName =
        $("customFontName");


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


    fontSelect.addEventListener(
        "change",
        () => {

            settings.subtitleFont =
                fontSelect.value;

            saveSettings();

            updateCustomFontUI();
        }
    );


    if (fontFile) {

        fontFile.addEventListener(
            "change",
            () => {

                const file =
                    fontFile.files[0];

                if (!file) {
                    return;
                }


                const fileName =
                    file.name.toLowerCase();


                if (
                    !fileName.endsWith(".ttf") &&
                    !fileName.endsWith(".otf")
                ) {

                    alert(
                        "Please select a .ttf or .otf font file."
                    );

                    fontFile.value = "";

                    return;
                }


                if (fontName) {

                    fontName.textContent =
                        file.name;
                }


                console.log(
                    "Custom font selected:",
                    file.name
                );
            }
        );
    }


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
   LOGO FILE
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
                behavior: "smooth",
                block: "center"
            });
        }
    );
}


/* =========================================================
   SUBTITLE PREVIEW
   ========================================================= */

function updateSubtitlePreview() {

    const preview =
        $("subtitlePreview");

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
                item.value === String(value)
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

    const button =
        $("generateButton");

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        () => {

            if (!validateBeforeGenerate()) {
                return;
            }

            /*
             * STEP 3:
             * Frontend only.
             *
             * STEP 6/7:
             * This will be replaced with:
             *
             * POST /api/jobs
             *
             * and then job polling.
             */

            showProcessingView();

            console.log(
                "Golden Recap MM settings:",
                settings
            );

            console.log(
                "Selected video:",
                selectedVideoFile
            );
        }
    );
}


/* =========================================================
   GENERATE VALIDATION
   ========================================================= */

function validateBeforeGenerate() {

    if (
        settings.source === "local" &&
        !selectedVideoFile
    ) {

        showError(
            "Please select a video first."
        );

        return false;
    }


    if (
        settings.source === "tiktok"
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


    if (
        settings.source === "rednote"
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

function updateProgress(
    percent,
    stage
) {

    const percentElement =
        $("progressPercent");

    const stageElement =
        $("processingStage");

    const circle =
        $("progressCircle");


    if (percentElement) {

        percentElement.textContent =
            `${percent}%`;
    }


    if (stageElement) {

        stageElement.textContent =
            stage;
    }


    if (circle) {

        const circumference =
            2 * Math.PI * 52;

        const offset =
            circumference -
            (
                percent / 100
            ) * circumference;

        circle.style.strokeDasharray =
            circumference;

        circle.style.strokeDashoffset =
            offset;
    }
}


/* =========================================================
   CANCEL
   ========================================================= */

function setupCancelButton() {

    const button =
        $("cancelButton");

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        () => {

            /*
             * STEP 20:
             * This will call:
             *
             * POST /api/jobs/{job_id}/cancel
             *
             * For now only restore the UI.
             */

            restoreMainView();
        }
    );
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

    selectedVideoFile = null;

    clearVideoMetadata();

    const fileInput =
        $("videoFile");

    if (fileInput) {
        fileInput.value = "";
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
        top: 0,
        behavior: "smooth"
    });
}


/* =========================================================
   BACKEND STATUS
   ========================================================= */

function setupBackendStatus() {

    /*
     * STEP 6:
     * Replace this with real API health check:
     *
     * GET /health
     */

    const statusText =
        $("backendStatusText");

    const statusDot =
        $("backendStatusDot");


    if (statusText) {

        statusText.textContent =
            "Frontend Ready";
    }


    if (statusDot) {

        statusDot.classList.add(
            "online"
        );
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

    const localReady =
        settings.source !== "local" ||
        Boolean(selectedVideoFile);


    button.disabled =
        !localReady;
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


setupUrlInputs();


/* =========================================================
   KEYBOARD ACCESSIBILITY
   ========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Escape"
        ) {

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
