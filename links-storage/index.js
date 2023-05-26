let links = []
const linkInputEl = document.getElementById("link-input-el")
const inputBtn = document.getElementById("input-btn")
const ulEl = document.getElementById("ul-el")
const deleteBtn = document.getElementById("delete-btn")
const linksFromLocalStorage = JSON.parse( localStorage.getItem("links") )
const tabBtn = document.getElementById("tab-btn")

if (linksFromLocalStorage) {
    links = linksFromLocalStorage
    render(links)
}

tabBtn.addEventListener("click", function(){    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
        links.push(tabs[0].url)
        localStorage.setItem("links", JSON.stringify(links) )
        render(links)
    })
})

function render(linksToRender) {
    let listItems = ""
    for (let i = 0; i < linksToRender.length; i++) {
        listItems += `
            <li>
                <a target='_blank' href='${linksToRender[i]}'>
                    ${linksToRender[i]}
                </a>
            </li>
        `
    }
    ulEl.innerHTML = listItems
}

deleteBtn.addEventListener("dblclick", function() {
    localStorage.clear()
    links = []
    render(links)
})

inputBtn.addEventListener("click", function() {
    links.push(linkInputEl.value)
    linkInputEl.value = ""
    localStorage.setItem("links", JSON.stringify(links) )
    render(links)
})