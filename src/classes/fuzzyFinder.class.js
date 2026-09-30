class FuzzyFinder {
    constructor() {
        window.keyboard.detach();
        
        this.disp = new Modal({
            type: "custom",
            title: "Fuzzy cwd file search",
            html: `<input type="search" id="fuzzyFinder" placeholder="Search file in cwd..." />
                <ul id="fuzzyFinder-results">
                    <li class="fuzzyFinderMatchSelected"></li>
                    <li></li>
                    <li></li>
                    <li></li>
                    <li></li>
                </ul>`,
            buttons: [
                {label: "Select", action: "window.activeFuzzyFinder.submit()"}
            ]
        }, () => {
            delete window.activeFuzzyFinder;
            window.keyboard.attach();
            window.term[window.currentTerm].term.focus();
        });
        
        this.input = document.getElementById("fuzzyFinder");
        this.results = document.getElementById("fuzzyFinder-results");
        
        this.input.addEventListener('input', e => {
            if ((e.inputType && e.inputType.startsWith("delete")) || (e.detail && e.detail.startsWith("delete"))) {
                this.input.value = "";
                this.search("");
            } else {
                this.search(this.input.value);
            }
        });
        this.input.addEventListener('change', e => {
                if (e.detail === "enter") {
                    this.submit();
                }
        });
        this.input.addEventListener('keydown', e => {
            switch(e.key) {
                case 'Enter':
                    this.submit();
                    e.preventDefault();
                    break;
                case 'ArrowDown':
                    this.moveSelection(1);
                    e.preventDefault();
                    break;
                case 'ArrowUp':
                    this.moveSelection(-1);
                    e.preventDefault();
                    break;
                default:
                    // Do nothing, input event will be triggered
            }
        });
        
        this.search("");
        this.input.focus();
    }

    // Down wraps round to the first match; up stops at it.
    moveSelection(step) {
        const selectedEl = document.querySelector('li.fuzzyFinderMatchSelected');
        // "No results" has no id and nothing to move to.
        if (!selectedEl || !selectedEl.id) return;
        const selected = Number(selectedEl.id.substr(17));
        const next = (document.getElementById(`fuzzyFinderMatch-${selected+step}`)) ? selected+step : 0;
        selectedEl.removeAttribute("class");
        document.getElementById(`fuzzyFinderMatch-${next}`).setAttribute("class", "fuzzyFinderMatchSelected");
    }

    search(text) {
           let files = window.fsDisp.cwd;
           let i = 0;
           let results = files.filter(file => {
               if (i >= 5 || file.type === "showDisks" || file.type === "up") {
                    return false;
                } else if (file.name.toLowerCase().includes(text.toLowerCase())) {
                    i++
                    return true;
                }
           });
           
           results.sort((a, b) => {
               if (a.name.toLowerCase().startsWith(text.toLowerCase()) && !b.name.toLowerCase().startsWith(text.toLowerCase())) {
                   return -1;
            } else if (!a.name.toLowerCase().startsWith(text.toLowerCase()) && b.name.toLowerCase().startsWith(text.toLowerCase())) {
                return 1;
            } else {
                return 0;
            }
           });
              
        if (results.length === 0) {
             this.results.innerHTML = `<li class="fuzzyFinderMatchSelected">No results</li>
                 <li></li>
                  <li></li>
                  <li></li>
                  <li></li>`;
             // The loop below used to overwrite this with five empty rows, leaving nothing
             // selected, and Enter, the arrows and Select all threw on the missing element.
             return;
         }
         let html = "";
         results.forEach((file, i) => {
             html += `<li id="fuzzyFinderMatch-${i}" class="${(i === 0) ? 'fuzzyFinderMatchSelected' : ''}" onclick="document.querySelector('li.fuzzyFinderMatchSelected').removeAttribute('class');document.getElementById('fuzzyFinderMatch-${i}').setAttribute('class', 'fuzzyFinderMatchSelected')">${window._escapeHtml(file.name)}</li>`;
        });
        if (results.length !== 5) {
            for (let i = results.length; i < 5; i++) {
                html += "<li></li>";
            }
        }
        this.results.innerHTML = html;
      }
      submit() {
         const selectedEl = document.querySelector("li.fuzzyFinderMatchSelected");
         let file = selectedEl ? selectedEl.innerText : "";
         if (file === "No results" || file.length <= 0) {
             this.disp.close();
             return;
        }
        
        let filePath = path.resolve(window.fsDisp.dirpath, file);
        
          // Wrapping in quotes by hand breaks on a file named  don't  and is an injection with
          // a name like  '; rm -rf ~; '  — quote it properly instead.
          window.term[window.currentTerm].write(window._quoteForShell(filePath));
          this.disp.close();
     }
}

module.exports = {
    FuzzyFinder
};
