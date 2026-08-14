// pdf.js ships as ES modules since v4, so it is pulled in here rather than through a script
// tag in ui.html. Electron's Node supports require() on ESM, and this keeps the library — and
// its worker path — out of the global scope.
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.mjs");
pdfjsLib.GlobalWorkerOptions.workerSrc = "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs";

class DocReader {
    constructor(opts) {
        const modalElementId = "modal_" + opts.modalId;
        const path = opts.path;
        const scale = 1;
        const canvas = document.getElementById(modalElementId).querySelector(".pdf_canvas");
        const context = canvas.getContext('2d');
        // isEvalSupported keeps a crafted PDF from running script through the font renderer
        // (CVE-2024-4367); encoding the path keeps spaces and non-ASCII names loadable.
        const loadingTask = pdfjsLib.getDocument({
            url: window._encodePathURI(path),
            isEvalSupported: false
        });
        let pdfDoc = null,
            pageNum = 1,
            pageRendering = false,
            pageNumPending = null,
            zoom = 100

        this.renderPage = (num) => {
            pageRendering = true;
            loadingTask.promise.then(function (pdf) {
                pdfDoc.getPage(num).then(function (page) {
                    const viewport = page.getViewport({ scale: scale });
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    const renderContext = {
                        canvasContext: context,
                        viewport: viewport,
                    };
                    const renderTask = page.render(renderContext);
                    renderTask.promise.then(() => {
                        pageRendering = false;
                        if (pageNumPending !== null) {
                            // Was a bare renderPage(): an undefined identifier, so flipping
                            // pages faster than they render threw instead of catching up.
                            this.renderPage(pageNumPending);
                            pageNumPending = null;
                        }
                    });
                });
            });
            document.getElementById(modalElementId).querySelector(".page_num").textContent = num;
        }

        this.queueRenderPage = (num) => {
            if (pageRendering) {
                pageNumPending = num;
            } else {
                this.renderPage(num);
            }
        }

        this.onPrevPage = () => {
            if (pageNum <= 1) {
                return;
            }
            pageNum--;
            this.queueRenderPage(pageNum);
        }

        this.onNextPage = () => {
            if (pageNum >= pdfDoc.numPages) {
                return;
            }
            pageNum++;
            this.queueRenderPage(pageNum);
        }

        this.zoomIn = () => {
            if (zoom >= 200) {
                return;
            }
            zoom = zoom + 10;
            canvas.style.zoom = zoom + "%";
        }

        this.zoomOut = () => {
            if (zoom <= 50) {
                return;
            }
            zoom = zoom - 10;
            canvas.style.zoom = zoom + "%";
        }

        document.getElementById(modalElementId).querySelector(".previous_page").addEventListener('click', this.onPrevPage);
        document.getElementById(modalElementId).querySelector(".next_page").addEventListener('click', this.onNextPage);
        document.getElementById(modalElementId).querySelector(".zoom_in").addEventListener('click', this.zoomIn);
        document.getElementById(modalElementId).querySelector(".zoom_out").addEventListener('click', this.zoomOut);

        pdfjsLib.getDocument({url: window._encodePathURI(path), isEvalSupported: false}).promise.then((pdfDoc_) => {
            pdfDoc = pdfDoc_;
            document.getElementById(modalElementId).querySelector(".page_count").textContent = pdfDoc.numPages;
            this.renderPage(pageNum);
        });
    }
}

module.exports = {
    DocReader
};