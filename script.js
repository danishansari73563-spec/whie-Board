/* =========================================================
   DRAWBOARD - COMPLETE SCRIPT
   Whiteboard + Pages + Notes + Rich Text
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    /* =====================================================
       ELEMENTS
    ===================================================== */

    const $ = (id) => document.getElementById(id);

    const canvas = $("whiteboard");
    const canvasArea = $("canvasArea");
    const canvasBackground = $("canvasBackground");
    const ctx = canvas.getContext("2d");

    const whiteboardMode = $("whiteboardMode");
    const pagesMode = $("pagesMode");

    const whiteboardModeBtn = $("whiteboardModeBtn");
    const pagesModeBtn = $("pagesModeBtn");

    const colorPicker = $("colorPicker");
    const brushSize = $("brushSize");
    const brushSizeValue = $("brushSizeValue");
    const opacity = $("opacity");
    const opacityValue = $("opacityValue");

    const toolStatus = $("toolStatus");
    const cursorPosition = $("cursorPosition");
    const objectCount = $("objectCount");
    const emptyMessage = $("emptyMessage");

    const richEditor = $("richEditor");
    const pageTitle = $("pageTitle");
    const pageNumber = $("pageNumber");
    const pageFooterNumber = $("pageFooterNumber");
    const wordCount = $("wordCount");
    const pageList = $("pageList");
    const pageSearch = $("pageSearch");

    const paragraphStyle = $("paragraphStyle");
    const fontFamily = $("fontFamily");
    const fontSize = $("fontSize");

    const textEditor = $("textEditor");
    const textInput = $("textInput");
    const textFontFamily = $("textFontFamily");
    const textFontSize = $("textFontSize");

    const noteEditor = $("noteEditor");
    const noteInput = $("noteInput");

    const toast = $("toast");
    const toastMessage = $("toastMessage");

    /* =====================================================
       STATE
    ===================================================== */

    let currentTool = "select";
    let currentColor = "#111827";
    let currentBrushSize = 4;
    let currentOpacity = 1;

    let isDrawing = false;
    let startX = 0;
    let startY = 0;

    let zoom = 1;

    let objects = [];
    let undoStack = [];
    let redoStack = [];

    let textPosition = { x: 100, y: 100 };
    let notePosition = { x: 150, y: 150 };

    let selectedNoteColor = "#fff3a3";

    let pages = [];
    let currentPageId = null;

    let darkMode = false;
    let gridEnabled = false;

    let autosaveTimer = null;

    /* =====================================================
       CANVAS SETUP
    ===================================================== */

    function resizeCanvas() {
        const rect = canvasArea.getBoundingClientRect();

        const oldCanvas = document.createElement("canvas");
        oldCanvas.width = canvas.width;
        oldCanvas.height = canvas.height;

        if (canvas.width && canvas.height) {
            oldCanvas.getContext("2d").drawImage(canvas, 0, 0);
        }

        const dpr = window.devicePixelRatio || 1;

        canvas.width = Math.max(600, rect.width * dpr);
        canvas.height = Math.max(500, rect.height * dpr);

        canvas.style.width = rect.width + "px";
        canvas.style.height = rect.height + "px";

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        redrawCanvas();
    }

    window.addEventListener("resize", resizeCanvas);

    /* =====================================================
       TOOL FUNCTIONS
    ===================================================== */

    function setTool(tool) {
        currentTool = tool;

        document.querySelectorAll(".tool-btn").forEach(btn => {
            btn.classList.toggle(
                "active",
                btn.dataset.tool === tool
            );
        });

        const names = {
            select: "Select",
            pen: "Pen",
            pencil: "Pencil",
            highlighter: "Highlighter",
            eraser: "Eraser",
            line: "Line",
            arrow: "Arrow",
            rectangle: "Rectangle",
            circle: "Circle",
            triangle: "Triangle",
            text: "Text",
            note: "Note",
            image: "Image",
            mic: "Voice",
            hand: "Move"
        };

        toolStatus.textContent = names[tool] || tool;

        canvas.style.cursor =
            tool === "hand"
                ? "grab"
                : tool === "select"
                    ? "default"
                    : "crosshair";

        if (tool === "text") {
            showTextEditor();
        }

        if (tool === "note") {
            showNoteEditor();
        }

        if (tool === "image") {
            $("imageInput").click();
        }

        if (tool === "mic") {
            startVoiceNote();
        }
    }

    document.querySelectorAll(".tool-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            setTool(btn.dataset.tool);
        });
    });

    /* =====================================================
       COLOR
    ===================================================== */

    colorPicker.addEventListener("input", () => {
        currentColor = colorPicker.value;
    });

    document.querySelectorAll(".color-dot").forEach(dot => {
        dot.addEventListener("click", () => {
            currentColor = dot.dataset.color;
            colorPicker.value = currentColor;
        });
    });

    brushSize.addEventListener("input", () => {
        currentBrushSize = Number(brushSize.value);
        brushSizeValue.textContent =
            currentBrushSize + "px";
    });

    opacity.addEventListener("input", () => {
        currentOpacity = Number(opacity.value) / 100;
        opacityValue.textContent =
            opacity.value + "%";
    });

    /* =====================================================
       CANVAS COORDINATES
    ===================================================== */

    function getPointerPosition(e) {
        const rect = canvas.getBoundingClientRect();

        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    /* =====================================================
       DRAWING
    ===================================================== */

    canvas.addEventListener("pointerdown", startDrawing);
    canvas.addEventListener("pointermove", draw);
    canvas.addEventListener("pointerup", stopDrawing);
    canvas.addEventListener("pointerleave", stopDrawing);

    function startDrawing(e) {
        if (
            currentTool === "select" ||
            currentTool === "text" ||
            currentTool === "note" ||
            currentTool === "image" ||
            currentTool === "mic"
        ) {
            return;
        }

        const p = getPointerPosition(e);

        startX = p.x;
        startY = p.y;

        isDrawing = true;

        if (
            currentTool === "pen" ||
            currentTool === "pencil" ||
            currentTool === "highlighter" ||
            currentTool === "eraser"
        ) {
            ctx.beginPath();
            ctx.moveTo(startX, startY);

            configureBrush();
        }
    }

    function configureBrush() {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (currentTool === "eraser") {
            ctx.globalCompositeOperation =
                "destination-out";

            ctx.lineWidth = currentBrushSize * 3;
            ctx.globalAlpha = 1;
        } else {
            ctx.globalCompositeOperation =
                "source-over";

            ctx.lineWidth =
                currentTool === "pencil"
                    ? Math.max(1, currentBrushSize / 2)
                    : currentTool === "highlighter"
                        ? currentBrushSize * 3
                        : currentBrushSize;

            ctx.strokeStyle = currentColor;

            ctx.globalAlpha =
                currentTool === "highlighter"
                    ? 0.25
                    : currentOpacity;
        }
    }

    function draw(e) {
        const p = getPointerPosition(e);

        cursorPosition.textContent =
            `X: ${Math.round(p.x)} Y: ${Math.round(p.y)}`;

        if (!isDrawing) return;

        if (
            currentTool === "pen" ||
            currentTool === "pencil" ||
            currentTool === "highlighter" ||
            currentTool === "eraser"
        ) {
            ctx.lineTo(p.x, p.y);
            ctx.stroke();

            saveCanvasState();
            updateObjectCount();
            hideEmptyMessage();
            return;
        }

        redrawCanvas();

        if (currentTool === "line") {
            drawLine(
                startX,
                startY,
                p.x,
                p.y
            );
        }

        if (currentTool === "arrow") {
            drawArrow(
                startX,
                startY,
                p.x,
                p.y
            );
        }

        if (currentTool === "rectangle") {
            drawRectangle(
                startX,
                startY,
                p.x,
                p.y
            );
        }

        if (currentTool === "circle") {
            drawCircle(
                startX,
                startY,
                p.x,
                p.y
            );
        }

        if (currentTool === "triangle") {
            drawTriangle(
                startX,
                startY,
                p.x,
                p.y
            );
        }
    }

    function stopDrawing(e) {
        if (!isDrawing) return;

        isDrawing = false;

        const p = e
            ? getPointerPosition(e)
            : { x: startX, y: startY };

        if (
            ["line", "arrow", "rectangle",
                "circle", "triangle"].includes(currentTool)
        ) {
            const shape = {
                type: currentTool,
                x1: startX,
                y1: startY,
                x2: p.x,
                y2: p.y,
                color: currentColor,
                size: currentBrushSize,
                opacity: currentOpacity
            };

            objects.push(shape);

            pushUndo();

            redrawCanvas();
            updateObjectCount();
            hideEmptyMessage();
        }

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation =
            "source-over";

        saveEverything();
    }

    /* =====================================================
       SHAPES
    ===================================================== */

    function setupShapeStyle() {
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentBrushSize;
        ctx.globalAlpha = currentOpacity;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    }

    function drawLine(x1, y1, x2, y2) {
        setupShapeStyle();

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    function drawArrow(x1, y1, x2, y2) {
        setupShapeStyle();

        const angle =
            Math.atan2(y2 - y1, x2 - x1);

        const headLength =
            Math.max(12, currentBrushSize * 4);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.beginPath();

        ctx.moveTo(x2, y2);

        ctx.lineTo(
            x2 - headLength * Math.cos(angle - Math.PI / 6),
            y2 - headLength * Math.sin(angle - Math.PI / 6)
        );

        ctx.moveTo(x2, y2);

        ctx.lineTo(
            x2 - headLength * Math.cos(angle + Math.PI / 6),
            y2 - headLength * Math.sin(angle + Math.PI / 6)
        );

        ctx.stroke();
    }

    function drawRectangle(x1, y1, x2, y2) {
        setupShapeStyle();

        ctx.strokeRect(
            x1,
            y1,
            x2 - x1,
            y2 - y1
        );
    }

    function drawCircle(x1, y1, x2, y2) {
        setupShapeStyle();

        const radius =
            Math.sqrt(
                Math.pow(x2 - x1, 2) +
                Math.pow(y2 - y1, 2)
            );

        ctx.beginPath();
        ctx.arc(
            x1,
            y1,
            radius,
            0,
            Math.PI * 2
        );

        ctx.stroke();
    }

    function drawTriangle(x1, y1, x2, y2) {
        setupShapeStyle();

        const centerX =
            (x1 + x2) / 2;

        ctx.beginPath();

        ctx.moveTo(
            centerX,
            y1
        );

        ctx.lineTo(
            x2,
            y2
        );

        ctx.lineTo(
            x1,
            y2
        );

        ctx.closePath();
        ctx.stroke();
    }

    /* =====================================================
       REDRAW
    ===================================================== */

    function redrawCanvas() {
        if (!canvas.width || !canvas.height) return;

        const rect =
            canvas.getBoundingClientRect();

        ctx.clearRect(
            0,
            0,
            rect.width,
            rect.height
        );

        objects.forEach(obj => {

            if (obj.type === "line") {
                drawStoredLine(obj);
            }

            if (obj.type === "arrow") {
                drawStoredArrow(obj);
            }

            if (obj.type === "rectangle") {
                drawStoredRectangle(obj);
            }

            if (obj.type === "circle") {
                drawStoredCircle(obj);
            }

            if (obj.type === "triangle") {
                drawStoredTriangle(obj);
            }
        });

        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation =
            "source-over";
    }

    function storedStyle(obj) {
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = obj.size;
        ctx.globalAlpha = obj.opacity;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    }

    function drawStoredLine(o) {
        storedStyle(o);

        ctx.beginPath();
        ctx.moveTo(o.x1, o.y1);
        ctx.lineTo(o.x2, o.y2);
        ctx.stroke();
    }

    function drawStoredArrow(o) {
        storedStyle(o);

        const angle =
            Math.atan2(
                o.y2 - o.y1,
                o.x2 - o.x1
            );

        const head =
            Math.max(12, o.size * 4);

        ctx.beginPath();
        ctx.moveTo(o.x1, o.y1);
        ctx.lineTo(o.x2, o.y2);
        ctx.stroke();

        ctx.beginPath();

        ctx.moveTo(o.x2, o.y2);

        ctx.lineTo(
            o.x2 - head * Math.cos(angle - Math.PI / 6),
            o.y2 - head * Math.sin(angle - Math.PI / 6)
        );

        ctx.moveTo(o.x2, o.y2);

        ctx.lineTo(
            o.x2 - head * Math.cos(angle + Math.PI / 6),
            o.y2 - head * Math.sin(angle + Math.PI / 6)
        );

        ctx.stroke();
    }

    function drawStoredRectangle(o) {
        storedStyle(o);

        ctx.strokeRect(
            o.x1,
            o.y1,
            o.x2 - o.x1,
            o.y2 - o.y1
        );
    }

    function drawStoredCircle(o) {
        storedStyle(o);

        const radius =
            Math.sqrt(
                Math.pow(o.x2 - o.x1, 2) +
                Math.pow(o.y2 - o.y1, 2)
            );

        ctx.beginPath();

        ctx.arc(
            o.x1,
            o.y1,
            radius,
            0,
            Math.PI * 2
        );

        ctx.stroke();
    }

    function drawStoredTriangle(o) {
        storedStyle(o);

        const centerX =
            (o.x1 + o.x2) / 2;

        ctx.beginPath();

        ctx.moveTo(
            centerX,
            o.y1
        );

        ctx.lineTo(
            o.x2,
            o.y2
        );

        ctx.lineTo(
            o.x1,
            o.y2
        );

        ctx.closePath();
        ctx.stroke();
    }

    /* =====================================================
       UNDO / REDO
    ===================================================== */

    function pushUndo() {
        undoStack.push(
            JSON.stringify(objects)
        );

        if (undoStack.length > 50) {
            undoStack.shift();
        }

        redoStack = [];
    }

    function saveCanvasState() {
        // Keep drawing responsive.
        // Full canvas state is saved through localStorage.
    }

    $("undoBtn").addEventListener("click", undo);

    $("redoBtn").addEventListener("click", redo);

    function undo() {
        if (undoStack.length === 0) {
            showToast("Nothing to undo");
            return;
        }

        redoStack.push(
            JSON.stringify(objects)
        );

        objects =
            JSON.parse(
                undoStack.pop()
            );

        redrawCanvas();
        updateObjectCount();
        saveEverything();

        showToast("Undo");
    }

    function redo() {
        if (redoStack.length === 0) {
            showToast("Nothing to redo");
            return;
        }

        undoStack.push(
            JSON.stringify(objects)
        );

        objects =
            JSON.parse(
                redoStack.pop()
            );

        redrawCanvas();
        updateObjectCount();
        saveEverything();

        showToast("Redo");
    }

    /* =====================================================
       OBJECT COUNT
    ===================================================== */

    function updateObjectCount() {
        objectCount.textContent =
            `Objects: ${objects.length}`;
    }

    function hideEmptyMessage() {
        emptyMessage.style.display = "none";
    }

    function showEmptyMessage() {
        if ($("emptyMessageToggle").checked) {
            emptyMessage.style.display = "flex";
        }
    }

    /* =====================================================
       TEXT POPUP
    ===================================================== */

    function showTextEditor() {
        textEditor.hidden = false;

        textInput.focus();
    }

    $("cancelTextBtn").addEventListener(
        "click",
        () => {
            textEditor.hidden = true;
            textInput.value = "";
            setTool("select");
        }
    );

    $("addTextBtn").addEventListener(
        "click",
        addWhiteboardText
    );

    function addWhiteboardText() {

        const text =
            textInput.value.trim();

        if (!text) {
            showToast("Please enter some text");
            return;
        }

        const font =
            textFontFamily.value;

        const size =
            Number(textFontSize.value) || 24;

        const bold =
            $("boldBtn").classList.contains("active");

        const italic =
            $("italicBtn").classList.contains("active");

        const underline =
            $("underlineBtn").classList.contains("active");

        const obj = {
            type: "text",
            text,
            x: textPosition.x,
            y: textPosition.y,
            font,
            size,
            color: currentColor,
            bold,
            italic,
            underline
        };

        objects.push(obj);

        pushUndo();

        drawTextObject(obj);

        updateObjectCount();
        hideEmptyMessage();

        textInput.value = "";
        textEditor.hidden = true;

        saveEverything();

        setTool("select");

        showToast("Text added");
    }

    function drawTextObject(obj) {

        let style = "";

        if (obj.bold) {
            style += "bold ";
        }

        if (obj.italic) {
            style += "italic ";
        }

        ctx.font =
            `${style}${obj.size}px "${obj.font}"`;

        ctx.fillStyle = obj.color;
        ctx.globalAlpha = 1;

        const lines =
            obj.text.split("\n");

        lines.forEach((line, i) => {
            ctx.fillText(
                line,
                obj.x,
                obj.y + i * obj.size * 1.3
            );
        });
    }

    /* =====================================================
       NOTES
    ===================================================== */

    function showNoteEditor() {
        noteEditor.hidden = false;
        noteInput.focus();
    }

    $("closeNoteBtn").addEventListener(
        "click",
        () => {
            noteEditor.hidden = true;
            noteInput.value = "";
            setTool("select");
        }
    );

    document.querySelectorAll(
        "[data-note-color]"
    ).forEach(btn => {

        btn.addEventListener(
            "click",
            () => {

                selectedNoteColor =
                    btn.dataset.noteColor;

                document.querySelectorAll(
                    "[data-note-color]"
                ).forEach(b => {
                    b.classList.remove("selected");
                });

                btn.classList.add("selected");
            }
        );
    });

    $("addNoteBtn").addEventListener(
        "click",
        addNote
    );

    function addNote() {

        const text =
            noteInput.value.trim();

        if (!text) {
            showToast("Write something in the note");
            return;
        }

        const note = {
            type: "note",
            text,
            x: notePosition.x,
            y: notePosition.y,
            width: 220,
            height: 160,
            color: selectedNoteColor
        };

        objects.push(note);

        pushUndo();

        drawNote(note);

        updateObjectCount();
        hideEmptyMessage();

        noteInput.value = "";
        noteEditor.hidden = true;

        setTool("select");

        saveEverything();

        showToast("Note added");
    }

    function drawNote(note) {

        ctx.globalAlpha = 1;

        ctx.fillStyle = note.color;

        ctx.fillRect(
            note.x,
            note.y,
            note.width,
            note.height
        );

        ctx.strokeStyle = "#999";

        ctx.lineWidth = 1;

        ctx.strokeRect(
            note.x,
            note.y,
            note.width,
            note.height
        );

        ctx.fillStyle = "#111";

        ctx.font =
            '16px "Inter"';

        const words =
            note.text.split(" ");

        let line = "";
        let y = note.y + 30;

        words.forEach(word => {

            const test =
                line + word + " ";

            if (
                ctx.measureText(test).width >
                note.width - 25
            ) {

                ctx.fillText(
                    line,
                    note.x + 12,
                    y
                );

                line =
                    word + " ";

                y += 22;

            } else {
                line = test;
            }
        });

        ctx.fillText(
            line,
            note.x + 12,
            y
        );
    }

    /* =====================================================
       IMAGE
    ===================================================== */

    $("imageInput").addEventListener(
        "change",
        handleImage
    );

    function handleImage(e) {

        const file =
            e.target.files[0];

        if (!file) return;

        const reader =
            new FileReader();

        reader.onload = event => {

            const img =
                new Image();

            img.onload = () => {

                const maxWidth = 350;

                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    const ratio =
                        maxWidth / width;

                    width *= ratio;
                    height *= ratio;
                }

                const obj = {
                    type: "image",
                    src: event.target.result,
                    x: 100,
                    y: 100,
                    width,
                    height
                };

                objects.push(obj);

                pushUndo();

                redrawCanvas();
                updateObjectCount();

                hideEmptyMessage();

                saveEverything();

                showToast("Image added");
            };

            img.src =
                event.target.result;
        };

        reader.readAsDataURL(file);

        e.target.value = "";

        setTool("select");
    }

    /* =====================================================
       VOICE NOTE
    ===================================================== */

    function startVoiceNote() {

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            showToast(
                "Voice recognition is not supported in this browser"
            );

            setTool("select");

            return;
        }

        const recognition =
            new SpeechRecognition();

        recognition.lang = "en-IN";

        recognition.continuous = false;

        recognition.interimResults = false;

        showToast("Listening...");

        recognition.start();

        recognition.onresult = event => {

            const transcript =
                event.results[0][0].transcript;

            noteInput.value =
                transcript;

            showNoteEditor();

            showToast("Voice converted to text");
        };

        recognition.onerror = () => {
            showToast("Voice input stopped");
        };

        recognition.onend = () => {
            setTool("select");
        };
    }

    /* =====================================================
       MODE SWITCH
    ===================================================== */

    whiteboardModeBtn.addEventListener(
        "click",
        () => switchMode("whiteboard")
    );

    pagesModeBtn.addEventListener(
        "click",
        () => switchMode("pages")
    );

    function switchMode(mode) {

        if (mode === "whiteboard") {

            whiteboardMode.classList.add(
                "active-mode"
            );

            pagesMode.classList.remove(
                "active-mode"
            );

            whiteboardModeBtn.classList.add(
                "active"
            );

            pagesModeBtn.classList.remove(
                "active"
            );

        } else {

            pagesMode.classList.add(
                "active-mode"
            );

            whiteboardMode.classList.remove(
                "active-mode"
            );

            pagesModeBtn.classList.add(
                "active"
            );

            whiteboardModeBtn.classList.remove(
                "active"
            );

            renderPages();
        }
    }

    /* =====================================================
       PAGES SYSTEM
    ===================================================== */

    function createPage(
        title = "Untitled Page",
        content = ""
    ) {

        const page = {
            id:
                Date.now().toString() +
                Math.random().toString(36).slice(2),

            title,

            content,

            created:
                new Date().toISOString(),

            updated:
                new Date().toISOString()
        };

        pages.push(page);

        currentPageId =
            page.id;

        loadPage(page);

        savePages();

        renderPages();
    }

    function loadPage(page) {

        if (!page) return;

        currentPageId =
            page.id;

        pageTitle.value =
            page.title;

        richEditor.innerHTML =
            page.content || "";

        const index =
            pages.findIndex(
                p => p.id === page.id
            );

        pageNumber.textContent =
            `Page ${index + 1}`;

        pageFooterNumber.textContent =
            index + 1;

        updateWordCount();

        updatePageActiveState();
    }

    function saveCurrentPage() {

        const page =
            pages.find(
                p => p.id === currentPageId
            );

        if (!page) return;

        page.title =
            pageTitle.value.trim() ||
            "Untitled Page";

        page.content =
            richEditor.innerHTML;

        page.updated =
            new Date().toISOString();

        savePages();

        renderPages(false);

        $("saveStatus").textContent =
            "✓ Saved";
    }

    function savePages() {

        localStorage.setItem(
            "drawboard_pages",
            JSON.stringify(pages)
        );
    }

    function loadPages() {

        try {

            const saved =
                localStorage.getItem(
                    "drawboard_pages"
                );

            if (saved) {
                pages =
                    JSON.parse(saved);
            }

        } catch (error) {
            pages = [];
        }

        if (pages.length === 0) {
            createPage(
                "My First Page",
                "<p>Start writing your page...</p>"
            );
        } else {

            currentPageId =
                pages[0].id;

            loadPage(pages[0]);
        }

        renderPages();
    }

    /* =====================================================
       PAGE LIST
    ===================================================== */

    function renderPages() {

        pageList.innerHTML = "";

        const search =
            pageSearch.value
                .trim()
                .toLowerCase();

        const filtered =
            pages.filter(page => {

                const text =
                    page.title +
                    " " +
                    page.content;

                return text
                    .toLowerCase()
                    .includes(search);
            });

        filtered.forEach((page, index) => {

            const item =
                document.createElement("button");

            item.className =
                "page-item";

            if (page.id === currentPageId) {
                item.classList.add("active");
            }

            item.innerHTML = `
                <div class="page-item-icon">📄</div>
                <div class="page-item-content">
                    <strong>${escapeHTML(page.title)}</strong>
                    <small>${getPreview(page.content)}</small>
                </div>
            `;

            item.addEventListener(
                "click",
                () => {
                    saveCurrentPage();
                    loadPage(page);
                    renderPages();
                }
            );

            pageList.appendChild(item);
        });
    }

    function updatePageActiveState() {

        document.querySelectorAll(
            ".page-item"
        ).forEach(item => {
            item.classList.remove("active");
        });

        const active =
            [...document.querySelectorAll(
                ".page-item"
            )].find(item => {
                return item
                    .querySelector("strong")
                    ?.textContent ===
                    pageTitle.value;
            });

        if (active) {
            active.classList.add("active");
        }
    }

    function getPreview(html) {

        const div =
            document.createElement("div");

        div.innerHTML =
            html || "";

        const text =
            div.textContent
                .replace(/\s+/g, " ")
                .trim();

        return (
            text.substring(0, 45) ||
            "Empty page"
        );
    }

    function escapeHTML(str) {

        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* =====================================================
       NEW PAGE
    ===================================================== */

    $("newPageBtn").addEventListener(
        "click",
        () => {

            saveCurrentPage();

            createPage(
                "Untitled Page",
                ""
            );

            switchMode("pages");

            pageTitle.focus();

            showToast("New page created");
        }
    );

    /* =====================================================
       DELETE PAGE
    ===================================================== */

    $("deletePageBtn").addEventListener(
        "click",
        () => {

            if (pages.length <= 1) {
                showToast(
                    "At least one page must remain"
                );
                return;
            }

            const index =
                pages.findIndex(
                    p => p.id === currentPageId
                );

            pages =
                pages.filter(
                    p => p.id !== currentPageId
                );

            const next =
                pages[
                    Math.max(0, index - 1)
                ];

            currentPageId =
                next.id;

            loadPage(next);

            savePages();
            renderPages();

            showToast("Page deleted");
        }
    );

    /* =====================================================
       DUPLICATE PAGE
    ===================================================== */

    $("duplicatePageBtn").addEventListener(
        "click",
        () => {

            saveCurrentPage();

            const original =
                pages.find(
                    p => p.id === currentPageId
                );

            if (!original) return;

            createPage(
                original.title +
                " Copy",
                original.content
            );

            showToast("Page duplicated");
        }
    );

    /* =====================================================
       SEARCH
    ===================================================== */

    pageSearch.addEventListener(
        "input",
        renderPages
    );

    /* =====================================================
       PAGE TITLE
    ===================================================== */

    pageTitle.addEventListener(
        "input",
        () => {

            $("saveStatus").textContent =
                "● Unsaved";

            clearTimeout(autosaveTimer);

            autosaveTimer =
                setTimeout(
                    saveCurrentPage,
                    500
                );
        }
    );

    /* =====================================================
       RICH TEXT EDITOR
    ===================================================== */

    richEditor.addEventListener(
        "input",
        () => {

            updateWordCount();

            $("saveStatus").textContent =
                "● Unsaved";

            clearTimeout(autosaveTimer);

            autosaveTimer =
                setTimeout(
                    saveCurrentPage,
                    600
                );
        }
    );

    function exec(command, value = null) {

        richEditor.focus();

        document.execCommand(
            command,
            false,
            value
        );

        updateWordCount();
        saveCurrentPage();
    }

    $("pageBoldBtn").addEventListener(
        "click",
        () => exec("bold")
    );

    $("pageItalicBtn").addEventListener(
        "click",
        () => exec("italic")
    );

    $("pageUnderlineBtn").addEventListener(
        "click",
        () => exec("underline")
    );

    $("pageStrikeBtn").addEventListener(
        "click",
        () => exec("strikeThrough")
    );

    /* =====================================================
       FONT
    ===================================================== */

    fontFamily.addEventListener(
        "change",
        () => {
            exec(
                "fontName",
                fontFamily.value
            );
        }
    );

    fontSize.addEventListener(
        "change",
        () => {

            richEditor.focus();

            document.execCommand(
                "fontSize",
                false,
                "7"
            );

            const selection =
                window.getSelection();

            if (
                selection &&
                selection.rangeCount
            ) {

                const range =
                    selection.getRangeAt(0);

                const elements =
                    richEditor.querySelectorAll(
                        'font[size="7"]'
                    );

                elements.forEach(el => {

                    el.removeAttribute("size");

                    el.style.fontSize =
                        fontSize.value + "px";
                });
            }

            saveCurrentPage();
        }
    );

    /* =====================================================
       PARAGRAPH STYLE
    ===================================================== */

    paragraphStyle.addEventListener(
        "change",
        () => {

            const style =
                paragraphStyle.value;

            const commands = {
                paragraph: "p",
                title: "h1",
                heading1: "h2",
                heading2: "h3",
                heading3: "h4",
                quote: "blockquote"
            };

            exec(
                "formatBlock",
                commands[style]
            );
        }
    );

    /* =====================================================
       ALIGNMENT
    ===================================================== */

    $("alignLeftBtn").addEventListener(
        "click",
        () => exec("justifyLeft")
    );

    $("alignCenterBtn").addEventListener(
        "click",
        () => exec("justifyCenter")
    );

    $("alignRightBtn").addEventListener(
        "click",
        () => exec("justifyRight")
    );

    /* =====================================================
       LISTS
    ===================================================== */

    $("bulletListBtn").addEventListener(
        "click",
        () => exec("insertUnorderedList")
    );

    $("numberListBtn").addEventListener(
        "click",
        () => exec("insertOrderedList")
    );

    /* =====================================================
       TEXT COLOR
    ===================================================== */

    $("pageTextColor").addEventListener(
        "input",
        e => {
            exec(
                "foreColor",
                e.target.value
            );
        }
    );

    /* =====================================================
       HIGHLIGHT
    ===================================================== */

    $("pageHighlightColor").addEventListener(
        "input",
        e => {

            richEditor.focus();

            document.execCommand(
                "hiliteColor",
                false,
                e.target.value
            );

            saveCurrentPage();
        }
    );

    /* =====================================================
       LINK
    ===================================================== */

    $("insertLinkBtn").addEventListener(
        "click",
        () => {

            const url =
                prompt(
                    "Enter website URL:"
                );

            if (!url) return;

            exec(
                "createLink",
                url
            );
        }
    );

    /* =====================================================
       PAGE IMAGE
    ===================================================== */

    $("insertPageImageBtn").addEventListener(
        "click",
        () => {
            $("pageImageInput").click();
        }
    );

    $("pageImageInput").addEventListener(
        "change",
        e => {

            const file =
                e.target.files[0];

            if (!file) return;

            const reader =
                new FileReader();

            reader.onload = event => {

                richEditor.focus();

                document.execCommand(
                    "insertHTML",
                    false,
                    `<img src="${event.target.result}"
                          style="max-width:100%;height:auto;border-radius:12px;margin:10px 0;">`
                );

                saveCurrentPage();

                showToast("Image inserted");
            };

            reader.readAsDataURL(file);

            e.target.value = "";
        }
    );

    /* =====================================================
       WORD COUNT
    ===================================================== */

    function updateWordCount() {

        const text =
            richEditor.innerText
                .trim();

        const count =
            text
                ? text.split(/\s+/).length
                : 0;

        wordCount.textContent =
            `${count} ${count === 1 ? "word" : "words"}`;
    }

    /* =====================================================
       IMPORT PAGE
    ===================================================== */

    $("importPageBtn").addEventListener(
        "click",
        () => {

            const input =
                document.createElement("input");

            input.type = "file";

            input.accept =
                ".html,.txt,.json";

            input.onchange = e => {

                const file =
                    e.target.files[0];

                if (!file) return;

                const reader =
                    new FileReader();

                reader.onload = event => {

                    let content =
                        event.target.result;

                    if (
                        file.name
                            .toLowerCase()
                            .endsWith(".json")
                    ) {

                        try {

                            const data =
                                JSON.parse(content);

                            createPage(
                                data.title ||
                                "Imported Page",

                                data.content ||
                                ""
                            );

                        } catch {
                            showToast(
                                "Invalid JSON file"
                            );
                        }

                    } else {

                        createPage(
                            file.name
                                .replace(
                                    /\.[^/.]+$/,
                                    ""
                                ),

                            file.name
                                .toLowerCase()
                                .endsWith(".txt")
                                ? `<p>${escapeHTML(content)}</p>`
                                : content
                        );
                    }

                    showToast("Page imported");
                };

                reader.readAsText(file);
            };

            input.click();
        }
    );

    /* =====================================================
       DOWNLOAD PAGE
    ===================================================== */

    $("downloadPageBtn").addEventListener(
        "click",
        downloadPage
    );

    function downloadPage() {

        saveCurrentPage();

        const title =
            pageTitle.value ||
            "DrawBoard Page";

        const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escapeHTML(title)}</title>

<style>
body{
    font-family:Inter,Arial,sans-serif;
    max-width:850px;
    margin:40px auto;
    padding:30px;
    line-height:1.7;
}
img{
    max-width:100%;
}
</style>

</head>

<body>

<h1>${escapeHTML(title)}</h1>

${richEditor.innerHTML}

</body>
</html>
`;

        const blob =
            new Blob(
                [html],
                { type: "text/html" }
            );

        downloadBlob(
            blob,
            `${safeFilename(title)}.html`
        );

        showToast("Page downloaded");
    }

    /* =====================================================
       PRINT
    ===================================================== */

    $("printPageBtn").addEventListener(
        "click",
        () => {

            saveCurrentPage();

            const printWindow =
                window.open(
                    "",
                    "_blank"
                );

            if (!printWindow) {
                showToast(
                    "Please allow popups"
                );
                return;
            }

            printWindow.document.write(`
                <html>
                <head>
                    <title>${escapeHTML(pageTitle.value)}</title>
                    <style>
                        body{
                            font-family:Arial;
                            max-width:800px;
                            margin:40px auto;
                            line-height:1.7;
                        }
                        img{
                            max-width:100%;
                        }
                    </style>
                </head>

                <body>

                    <h1>
                        ${escapeHTML(pageTitle.value)}
                    </h1>

                    ${richEditor.innerHTML}

                </body>
                </html>
            `);

            printWindow.document.close();

            printWindow.onload = () => {
                printWindow.print();
            };
        }
    );

    /* =====================================================
       SHARE
    ===================================================== */

    $("shareBtn").addEventListener(
        "click",
        openShareModal
    );

    $("sharePageBtn").addEventListener(
        "click",
        openShareModal
    );

    function openShareModal() {

        let data;

        if (
            pagesMode.classList.contains(
                "active-mode"
            )
        ) {

            saveCurrentPage();

            const page =
                pages.find(
                    p => p.id === currentPageId
                );

            data = {
                type: "page",
                title: page?.title || "Page",
                content: page?.content || ""
            };

        } else {

            data = {
                type: "whiteboard",
                objects
            };
        }

        const encoded =
            encodeURIComponent(
                btoa(
                    unescape(
                        encodeURIComponent(
                            JSON.stringify(data)
                        )
                    )
                )
            );

        const url =
            location.href.split("#")[0] +
            "#share=" +
            encoded;

        $("shareLink").value =
            url;

        $("shareModal").hidden = false;
    }

    $("closeShareBtn").addEventListener(
        "click",
        () => {
            $("shareModal").hidden = true;
        }
    );

    $("copyShareLinkBtn").addEventListener(
        "click",
        async () => {

            const link =
                $("shareLink").value;

            try {

                await navigator.clipboard.writeText(
                    link
                );

                showToast(
                    "Share link copied"
                );

            } catch {

                $("shareLink").select();

                document.execCommand("copy");

                showToast(
                    "Share link copied"
                );
            }
        }
    );

    $("nativeShareBtn").addEventListener(
        "click",
        async () => {

            const link =
                $("shareLink").value;

            if (
                navigator.share
            ) {

                try {

                    await navigator.share({
                        title: "DrawBoard",
                        text: "Check my DrawBoard work",
                        url: link
                    });

                } catch {}

            } else {

                await navigator.clipboard.writeText(
                    link
                );

                showToast(
                    "Link copied"
                );
            }
        }
    );

    /* =====================================================
       LOAD SHARED DATA
    ===================================================== */

    function loadSharedData() {

        if (
            !location.hash.startsWith(
                "#share="
            )
        ) {
            return;
        }

        try {

            const encoded =
                decodeURIComponent(
                    location.hash.substring(7)
                );

            const json =
                decodeURIComponent(
                    escape(
                        atob(encoded)
                    )
                );

            const data =
                JSON.parse(json);

            if (data.type === "page") {

                createPage(
                    data.title,
                    data.content
                );

                switchMode("pages");

            }

            if (
                data.type ===
                "whiteboard"
            ) {

                objects =
                    data.objects || [];

                redrawCanvas();

                updateObjectCount();
            }

            showToast(
                "Shared work loaded"
            );

        } catch {

            showToast(
                "Invalid share link"
            );
        }
    }

    /* =====================================================
       SAVE BUTTON
    ===================================================== */

    $("saveBtn").addEventListener(
        "click",
        () => {

            saveEverything();
            saveCurrentPage();

            showToast(
                "Everything saved"
            );
        }
    );

    /* =====================================================
       LOCAL STORAGE
    ===================================================== */

    function saveEverything() {

        try {

            localStorage.setItem(
                "drawboard_objects",
                JSON.stringify(objects)
            );

            localStorage.setItem(
                "drawboard_settings",
                JSON.stringify({
                    color: currentColor,
                    brushSize:
                        currentBrushSize,
                    opacity:
                        currentOpacity,
                    zoom,
                    darkMode,
                    gridEnabled
                })
            );

        } catch (error) {

            console.warn(
                "Could not save:",
                error
            );
        }
    }

    function loadEverything() {

        try {

            const savedObjects =
                localStorage.getItem(
                    "drawboard_objects"
                );

            if (savedObjects) {
                objects =
                    JSON.parse(savedObjects);
            }

            const settings =
                localStorage.getItem(
                    "drawboard_settings"
                );

            if (settings) {

                const s =
                    JSON.parse(settings);

                currentColor =
                    s.color || "#111827";

                currentBrushSize =
                    s.brushSize || 4;

                currentOpacity =
                    s.opacity ?? 1;

                zoom =
                    s.zoom || 1;

                darkMode =
                    s.darkMode || false;

                gridEnabled =
                    s.gridEnabled || false;
            }

        } catch (error) {

            console.warn(
                "Could not load:",
                error
            );
        }

        colorPicker.value =
            currentColor;

        brushSize.value =
            currentBrushSize;

        brushSizeValue.textContent =
            currentBrushSize + "px";

        opacity.value =
            currentOpacity * 100;

        opacityValue.textContent =
            Math.round(
                currentOpacity * 100
            ) + "%";

        applyZoom();
        applyTheme();
        applyGrid();
    }

    /* =====================================================
       EXPORT PNG
    ===================================================== */

    $("exportPNG").addEventListener(
        "click",
        exportPNG
    );

    function exportPNG() {

        const link =
            document.createElement("a");

        link.download =
            "drawboard.png";

        link.href =
            canvas.toDataURL("image/png");

        link.click();

        showToast(
            "PNG exported"
        );
    }

    /* =====================================================
       EXPORT JSON
    ===================================================== */

    $("exportJSON").addEventListener(
        "click",
        () => {

            const data = {
                app: "DrawBoard",
                version: "1.0",
                created:
                    new Date().toISOString(),
                objects
            };

            const blob =
                new Blob(
                    [
                        JSON.stringify(
                            data,
                            null,
                            2
                        )
                    ],
                    {
                        type:
                            "application/json"
                    }
                );

            downloadBlob(
                blob,
                "drawboard-board.json"
            );

            showToast(
                "Board file exported"
            );
        }
    );

    /* =====================================================
       THEME
    ===================================================== */

    $("themeBtn").addEventListener(
        "click",
        toggleTheme
    );

    $("darkModeToggle").addEventListener(
        "change",
        e => {

            darkMode =
                e.target.checked;

            applyTheme();
            saveEverything();
        }
    );

    function toggleTheme() {

        darkMode =
            !darkMode;

        $("darkModeToggle").checked =
            darkMode;

        applyTheme();

        saveEverything();
    }

    function applyTheme() {

        document.body.classList.toggle(
            "dark-mode",
            darkMode
        );

        $("themeBtn").textContent =
            darkMode
                ? "☀️"
                : "🌙";
    }

    /* =====================================================
       SETTINGS
    ===================================================== */

    $("settingsBtn").addEventListener(
        "click",
        () => {

            $("settingsModal").hidden =
                false;

            $("gridToggle").checked =
                gridEnabled;

            $("darkModeToggle").checked =
                darkMode;
        }
    );

    $("closeSettingsBtn").addEventListener(
        "click",
        closeSettings
    );

    $("closeSettingsBtn2").addEventListener(
        "click",
        closeSettings
    );

    function closeSettings() {

        $("settingsModal").hidden =
            true;

        applyGrid();
        applyTheme();

        saveEverything();
    }

    $("gridToggle").addEventListener(
        "change",
        e => {

            gridEnabled =
                e.target.checked;

            applyGrid();
        }
    );

    $("emptyMessageToggle").addEventListener(
        "change",
        e => {

            if (e.target.checked) {

                if (objects.length === 0) {
                    showEmptyMessage();
                }

            } else {

                emptyMessage.style.display =
                    "none";
            }
        }
    );

    function applyGrid() {

        if (gridEnabled) {

            canvasBackground.style.backgroundImage =
                `
                linear-gradient(
                    #e5e7eb 1px,
                    transparent 1px
                ),
                linear-gradient(
                    90deg,
                    #e5e7eb 1px,
                    transparent 1px
                )
                `;

            canvasBackground.style.backgroundSize =
                "25px 25px";

        } else {

            canvasBackground.style.backgroundImage =
                "none";
        }
    }

    /* =====================================================
       ZOOM
    ===================================================== */

    $("zoomInBtn").addEventListener(
        "click",
        () => {

            zoom =
                Math.min(
                    3,
                    zoom + 0.1
                );

            applyZoom();
            saveEverything();
        }
    );

    $("zoomOutBtn").addEventListener(
        "click",
        () => {

            zoom =
                Math.max(
                    0.4,
                    zoom - 0.1
                );

            applyZoom();
            saveEverything();
        }
    );

    function applyZoom() {

        $("zoomValue").textContent =
            Math.round(zoom * 100) +
            "%";

        canvas.style.transform =
            `scale(${zoom})`;

        canvas.style.transformOrigin =
            "top left";
    }

    /* =====================================================
       KEYBOARD SHORTCUTS
    ===================================================== */

    document.addEventListener(
        "keydown",
        e => {

            const ctrl =
                e.ctrlKey || e.metaKey;

            if (ctrl && e.key === "z") {

                e.preventDefault();
                undo();
            }

            if (
                ctrl &&
                e.key === "y"
            ) {

                e.preventDefault();
                redo();
            }

            if (
                ctrl &&
                e.key === "s"
            ) {

                e.preventDefault();

                saveEverything();
                saveCurrentPage();

                showToast(
                    "Saved"
                );
            }

            if (
                ctrl &&
                e.key === "b" &&
                document.activeElement ===
                    richEditor
            ) {

                e.preventDefault();

                exec("bold");
            }

            if (
                ctrl &&
                e.key === "i" &&
                document.activeElement ===
                    richEditor
            ) {

                e.preventDefault();

                exec("italic");
            }

            if (
                ctrl &&
                e.key === "u" &&
                document.activeElement ===
                    richEditor
            ) {

                e.preventDefault();

                exec("underline");
            }

            if (e.key === "Escape") {

                textEditor.hidden = true;
                noteEditor.hidden = true;

                setTool("select");
            }
        }
    );

    /* =====================================================
       CLOSE MODALS BY CLICKING OUTSIDE
    ===================================================== */

    document.querySelectorAll(
        ".modal"
    ).forEach(modal => {

        modal.addEventListener(
            "click",
            e => {

                if (
                    e.target === modal
                ) {
                    modal.hidden = true;
                }
            }
        );
    });

    /* =====================================================
       DOWNLOAD HELPER
    ===================================================== */

    function downloadBlob(
        blob,
        filename
    ) {

        const url =
            URL.createObjectURL(blob);

        const a =
            document.createElement("a");

        a.href = url;

        a.download =
            filename;

        document.body.appendChild(a);

        a.click();

        a.remove();

        setTimeout(
            () => URL.revokeObjectURL(url),
            1000
        );
    }

    function safeFilename(name) {

        return name
            .replace(
                /[<>:"/\\|?*]+/g,
                "_"
            )
            .trim()
            .substring(0, 100) ||
            "drawboard";
    }

    /* =====================================================
       TOAST
    ===================================================== */

    let toastTimer;

    function showToast(message) {

        toastMessage.textContent =
            message;

        toast.classList.add(
            "show"
        );

        clearTimeout(toastTimer);

        toastTimer =
            setTimeout(
                () => {
                    toast.classList.remove(
                        "show"
                    );
                },
                2200
            );
    }
  
    /* =========================================================
   SELECT + MOVE OBJECTS
   ========================================================= */

let selectedObjects = [];
let isMovingObjects = false;
let moveStartX = 0;
let moveStartY = 0;
let originalPositions = [];

function getObjectBounds(obj) {
    if (!obj) return null;

    if (["line", "arrow", "rectangle", "triangle"].includes(obj.type)) {
        return {
            x: Math.min(obj.x1, obj.x2),
            y: Math.min(obj.y1, obj.y2),
            width: Math.abs(obj.x2 - obj.x1),
            height: Math.abs(obj.y2 - obj.y1)
        };
    }

    if (obj.type === "circle") {
        const radius = Math.hypot(
            obj.x2 - obj.x1,
            obj.y2 - obj.y1
        );

        return {
            x: obj.x1 - radius,
            y: obj.y1 - radius,
            width: radius * 2,
            height: radius * 2
        };
    }

    if (["text", "note", "image"].includes(obj.type)) {
        return {
            x: obj.x || 0,
            y: obj.y || 0,
            width: obj.width || 100,
            height: obj.height || 50
        };
    }

    return null;
}


function objectAtPoint(x, y) {

    for (let i = objects.length - 1; i >= 0; i--) {

        const b = getObjectBounds(objects[i]);

        if (!b) continue;

        if (
            x >= b.x &&
            x <= b.x + b.width &&
            y >= b.y &&
            y <= b.y + b.height
        ) {
            return i;
        }
    }

    return -1;
}


/* =========================================================
   SELECT
   ========================================================= */

canvas.addEventListener("pointerdown", function(e) {

    if (currentTool !== "select") return;

    const p = getPointerPosition(e);

    const index = objectAtPoint(p.x, p.y);

    if (index === -1) {

        selectedObjects = [];

        redrawCanvas();

        return;
    }


    /* Shift = multi select */

    if (e.shiftKey) {

        if (selectedObjects.includes(index)) {

            selectedObjects =
                selectedObjects.filter(
                    i => i !== index
                );

        } else {

            selectedObjects.push(index);
        }

    } else {

        selectedObjects = [index];
    }


    /* Save original position */

    originalPositions =
        selectedObjects.map(index => ({
            index: index,
            object: JSON.parse(
                JSON.stringify(objects[index])
            )
        }));


    moveStartX = p.x;
    moveStartY = p.y;

    isMovingObjects = true;

    canvas.setPointerCapture(e.pointerId);

    redrawCanvas();

});


/* =========================================================
   MOVE
   ========================================================= */

canvas.addEventListener("pointermove", function(e) {

    if (
        currentTool !== "select" ||
        !isMovingObjects
    ) {
        return;
    }


    const p = getPointerPosition(e);

    const dx = p.x - moveStartX;
    const dy = p.y - moveStartY;


    originalPositions.forEach(item => {

        const obj = objects[item.index];
        const original = item.object;


        if (
            ["line", "arrow", "rectangle", "triangle"]
                .includes(obj.type)
        ) {

            obj.x1 = original.x1 + dx;
            obj.y1 = original.y1 + dy;

            obj.x2 = original.x2 + dx;
            obj.y2 = original.y2 + dy;

        }


        else if (obj.type === "circle") {

            obj.x1 = original.x1 + dx;
            obj.y1 = original.y1 + dy;

            obj.x2 = original.x2 + dx;
            obj.y2 = original.y2 + dy;

        }


        else if (
            ["text", "note", "image"]
                .includes(obj.type)
        ) {

            obj.x = original.x + dx;
            obj.y = original.y + dy;

        }

    });


    redrawCanvas();

});


/* =========================================================
   STOP MOVE
   ========================================================= */

canvas.addEventListener("pointerup", function(e) {

    if (!isMovingObjects) return;

    isMovingObjects = false;

    try {
        canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}

    canvas.style.cursor = "default";

    saveEverything();

    updateObjectCount();

    redrawCanvas();

    if (selectedObjects.length > 0) {
        showToast("Object moved");
    }

});


/* =========================================================
   DRAW SELECTION
   ========================================================= */

function drawObjectSelection() {

    if (
        currentTool !== "select" ||
        selectedObjects.length === 0
    ) {
        return;
    }


    selectedObjects.forEach(index => {

        const obj = objects[index];

        if (!obj) return;

        const b = getObjectBounds(obj);

        if (!b) return;


        ctx.save();

        ctx.strokeStyle = "#2563eb";

        ctx.lineWidth = 2;

        ctx.setLineDash([6, 4]);

        ctx.strokeRect(
            b.x - 6,
            b.y - 6,
            b.width + 12,
            b.height + 12
        );


        ctx.setLineDash([]);

        ctx.fillStyle = "#2563eb";


        const handles = [
            [b.x - 6, b.y - 6],
            [b.x + b.width + 6, b.y - 6],
            [b.x - 6, b.y + b.height + 6],
            [b.x + b.width + 6, b.y + b.height + 6]
        ];


        handles.forEach(([x, y]) => {

            ctx.fillRect(
                x - 4,
                y - 4,
                8,
                8
            );

        });


        ctx.restore();

    });

}


/* =========================================================
   WRAP REDRAW
   ========================================================= */

const oldRedrawCanvas = redrawCanvas;

redrawCanvas = function() {

    oldRedrawCanvas();

    drawObjectSelection();

};


/* =========================================================
   DELETE SELECTED
   ========================================================= */

document.addEventListener("keydown", function(e) {

    if (
        (e.key === "Delete" ||
         e.key === "Backspace") &&
        selectedObjects.length > 0
    ) {

        e.preventDefault();

        const indexes =
            [...selectedObjects]
                .sort((a, b) => b - a);


        indexes.forEach(index => {

            objects.splice(index, 1);

        });


        selectedObjects = [];

        saveEverything();

        updateObjectCount();

        redrawCanvas();

        showToast("Object deleted");

    }


    /* Escape */

    if (e.key === "Escape") {

        selectedObjects = [];

        redrawCanvas();

    }

});
    /* =====================================================
       INITIALIZE
    ===================================================== */

    loadEverything();

    loadPages();

    resizeCanvas();

    updateObjectCount();

    if (objects.length === 0) {
        showEmptyMessage();
    } else {
        hideEmptyMessage();
    }

    loadSharedData();

    console.log(
        "DrawBoard loaded successfully 🚀"
    );
});