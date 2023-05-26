let links = []
const linkInputEl = document.getElementById("link-input-el")
const descriptionInputEl = document.getElementById("description-input-el")
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
        linkDescriptionTuple = [tabs[0].url, descriptionInputEl.value]
        links.push(linkDescriptionTuple)
        localStorage.setItem("links", JSON.stringify(links) )
        render(links)
    })
})

function render(linksToRender) {
    let listItems = ""
    for (let i = 0; i < linksToRender.length; i++) {
        listItems += `
            <li>
                <a target='_blank' href='${linksToRender[i][0]}'>
                    ${linksToRender[i][1]}
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
    linkDescriptionTuple = [linkInputEl.value, descriptionInputEl.value]
    links.push(linkDescriptionTuple)
    linkInputEl.value = ""
    descriptionInputEl.value = ""
    localStorage.setItem("links", JSON.stringify(links) )
    render(links)
})